/**
 * [INPUT]: 依赖 DurableJournal 的路径、preimage/postimage、权限、phase 与固定成员，以及 Windows lstat、containment、FileShare 和目录句柄能力。
 * [OUTPUT]: 提供 schema v3 严格 manifest 的 handle-bound 持久化、读取、校验、文件/目录 fsync 与 startup/apply 前恢复；manifest 可先写隐藏 preparation root，恢复只发现已发布 state，并以双向 displaced intent 保留发布歧义证据。
 * [POS]: language_transaction/storage 的崩溃恢复语义边界；将内存所有权投影为可重建的磁盘真相，不采纳未提交 postimage，固定临时成员仍按路径协议 fail-closed。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
use std::{
    fs,
    io::{Read, Write},
    os::windows::fs::OpenOptionsExt,
    path::Path,
};

use serde::{Deserialize, Serialize};

use super::super::known_folders::{
    ensure_no_reparse_points, metadata_is_reparse_point, path_is_within,
};
use super::path_validation::{
    validate_destination, validate_directory_destination, validate_install_root,
    validate_optional_hash, windows_paths_equal,
};
use super::storage::{
    snapshot_hash, DurableJournal, JournalEntry, RollbackOutcome, JOURNAL_PREFIX,
    JOURNAL_STATE_FILE, JOURNAL_STATE_TEMP_FILE,
};

const JOURNAL_SCHEMA_VERSION: u32 = 3;
const MAX_JOURNAL_ENTRIES: usize = 8192;
const FILE_SHARE_ALL: u32 = 0x0000_0007;
const FILE_FLAG_BACKUP_SEMANTICS: u32 = 0x0200_0000;
const FILE_FLAG_OPEN_REPARSE_POINT: u32 = 0x0020_0000;
const MAX_MANIFEST_BYTES: u64 = 4 * 1024 * 1024;

#[derive(Debug, Clone, Copy, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub(super) enum JournalPhase {
    Prepared,
    Applying,
    RollingBack,
    Committing,
    Committed,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
struct JournalPermission {
    readonly: bool,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
struct JournalEntryManifest {
    destination: String,
    preimage_sha256: Option<String>,
    postimage_sha256: Vec<Option<String>>,
    backup: Option<String>,
    permission: Option<JournalPermission>,
    displaced_publication_pending: bool,
    displaced_publication_expected_before_sha256: Option<String>,
    displaced_publication_expected_after_sha256: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
struct JournalManifest {
    schema_version: u32,
    install_root: String,
    journal_root: String,
    phase: JournalPhase,
    applied_payloads: usize,
    entries: Vec<JournalEntryManifest>,
    created_directories: Vec<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum RecoveryOutcome {
    None,
    RolledBack,
    Completed,
}

pub(super) fn persist_manifest(
    journal: &DurableJournal,
    phase: JournalPhase,
) -> Result<(), String> {
    persist_manifest_at(journal, phase, &journal.journal_root)
}

pub(super) fn persist_manifest_at(
    journal: &DurableJournal,
    phase: JournalPhase,
    journal_root: &Path,
) -> Result<(), String> {
    let manifest = to_manifest(journal, phase)?;
    write_journal_manifest(journal_root, &manifest)
}

fn to_manifest(journal: &DurableJournal, phase: JournalPhase) -> Result<JournalManifest, String> {
    let mut entries = Vec::with_capacity(journal.entries.len());
    for entry in &journal.entries {
        let mut postimage_sha256 = entry.owned_postimages.iter().cloned().collect::<Vec<_>>();
        postimage_sha256.sort();
        entries.push(JournalEntryManifest {
            destination: entry.destination.to_string_lossy().to_string(),
            preimage_sha256: entry.original_sha256.clone(),
            postimage_sha256,
            backup: entry
                .backup
                .as_ref()
                .map(|path| path.to_string_lossy().to_string()),
            permission: entry
                .original_permissions
                .as_ref()
                .map(|permissions| JournalPermission {
                    readonly: permissions.readonly(),
                }),
            displaced_publication_pending: entry.displaced_publication_pending,
            displaced_publication_expected_before_sha256: entry
                .displaced_publication_expected_before_sha256
                .clone(),
            displaced_publication_expected_after_sha256: entry
                .displaced_publication_expected_after_sha256
                .clone(),
        });
    }
    Ok(JournalManifest {
        schema_version: JOURNAL_SCHEMA_VERSION,
        install_root: journal.install_root.to_string_lossy().to_string(),
        journal_root: journal.journal_root.to_string_lossy().to_string(),
        phase,
        applied_payloads: journal.applied_payloads,
        entries,
        created_directories: journal
            .created_directories
            .iter()
            .map(|path| path.to_string_lossy().to_string())
            .collect(),
    })
}

pub(crate) fn has_pending(install_root: &Path) -> Result<bool, String> {
    Ok(!discover_journal_roots(install_root)?.is_empty())
}

pub(crate) fn recover_pending(install_root: &Path) -> Result<RecoveryOutcome, String> {
    let install_root = validate_install_root(install_root).map_err(|error| error.message)?;
    let journals = discover_journal_roots(&install_root)?;
    let Some(journal_root) = journals.first() else {
        return Ok(RecoveryOutcome::None);
    };
    if journals.len() != 1 {
        return Err(format!(
            "Multiple durable language transaction journals exist under {}; recovery is blocked: {}",
            install_root.display(),
            journals
                .iter()
                .map(|path| path.display().to_string())
                .collect::<Vec<_>>()
                .join(", ")
        ));
    }

    let (mut journal, phase) = load_persisted_journal(&install_root, journal_root)?;
    // Unknown members are checked separately after the manifest is parsed. Never turn an
    // inspect failure into an empty journal: cleanup must retain the entire recovery root.
    inspect_journal_root(&install_root, journal_root, journal.entries.len())?;
    // Replacement names are deterministic members of this journal.  A staged file left by a
    // crash is removed only after the fixed member and ordinary-file checks succeed.
    journal.reconcile_pending_displaced_publications(phase)?;
    journal.cleanup_replacement_temps()?;
    match phase {
        JournalPhase::Committing | JournalPhase::Committed => {
            journal.verify_committed_postimages()?;
            remove_journal_root(&install_root, journal_root, journal.entries.len())?;
            Ok(RecoveryOutcome::Completed)
        }
        JournalPhase::Prepared | JournalPhase::Applying | JournalPhase::RollingBack => {
            let marker = install_root.join(crate::install::LANG_MARKER_NAME);
            match journal.rollback_fail_closed(&marker) {
                RollbackOutcome::Restored => Ok(RecoveryOutcome::RolledBack),
                RollbackOutcome::Uncertain(residual) => Err(format!(
                    "Durable language transaction rollback is uncertain: {}",
                    residual.detail
                )),
            }
        }
    }
}

fn discover_journal_roots(install_root: &Path) -> Result<Vec<std::path::PathBuf>, String> {
    let install_root = validate_install_root(install_root).map_err(|error| error.message)?;
    let entries = fs::read_dir(&install_root)
        .map_err(|error| format!("Could not enumerate transaction journals: {error}"))?;
    let mut journals = Vec::new();
    for entry in entries {
        let entry =
            entry.map_err(|error| format!("Could not enumerate transaction journal: {error}"))?;
        let name = entry.file_name();
        if !name.to_string_lossy().starts_with(JOURNAL_PREFIX) {
            continue;
        }
        let path = entry.path();
        validate_journal_root_name(&install_root, &path)?;
        let metadata = fs::symlink_metadata(&path)
            .map_err(|error| format!("Could not inspect transaction journal: {error}"))?;
        if !metadata.is_dir() || metadata_is_reparse_point(&metadata) {
            return Err(format!(
                "Transaction journal is not an ordinary directory: {}",
                path.display()
            ));
        }
        ensure_no_reparse_points(&install_root, &path)?;
        journals.push(path);
    }
    journals.sort();
    Ok(journals)
}

fn load_persisted_journal(
    install_root: &Path,
    journal_root: &Path,
) -> Result<(DurableJournal, JournalPhase), String> {
    let manifest = read_journal_manifest(journal_root)?;
    let allow_missing_backups = matches!(
        manifest.phase,
        JournalPhase::Committing | JournalPhase::Committed
    );
    let entries = manifest_entries(install_root, journal_root, &manifest, allow_missing_backups)?;
    let created_directories = manifest
        .created_directories
        .iter()
        .map(std::path::PathBuf::from)
        .collect::<Vec<_>>();
    Ok((
        DurableJournal {
            install_root: install_root.to_path_buf(),
            journal_root: journal_root.to_path_buf(),
            entries,
            created_directories,
            applied_payloads: manifest.applied_payloads,
            #[cfg(test)]
            fail_next_persist: std::cell::Cell::new(None),
        },
        manifest.phase,
    ))
}

fn manifest_entries(
    install_root: &Path,
    journal_root: &Path,
    manifest: &JournalManifest,
    allow_missing_backups: bool,
) -> Result<Vec<JournalEntry>, String> {
    if manifest.schema_version != JOURNAL_SCHEMA_VERSION {
        return Err(format!(
            "Unsupported durable language journal schema: {}",
            manifest.schema_version
        ));
    }
    if manifest.entries.len() > MAX_JOURNAL_ENTRIES {
        return Err("Durable language journal entry count is outside its bound.".to_string());
    }
    if manifest.applied_payloads > MAX_JOURNAL_ENTRIES * 4 {
        return Err(
            "Durable language journal applied payload count exceeds its bound.".to_string(),
        );
    }
    let manifest_root = std::path::PathBuf::from(&manifest.install_root);
    if !manifest_root.is_absolute() || !windows_paths_equal(&manifest_root, install_root) {
        return Err(
            "Durable language journal install root does not match its location.".to_string(),
        );
    }
    let manifest_journal = std::path::PathBuf::from(&manifest.journal_root);
    validate_journal_root_name(install_root, &manifest_journal)?;
    if !windows_paths_equal(&manifest_journal, journal_root) {
        return Err("Durable language journal path does not match its directory.".to_string());
    }

    let mut seen = Vec::with_capacity(manifest.entries.len());
    let mut entries = Vec::with_capacity(manifest.entries.len());
    for (index, persisted) in manifest.entries.iter().enumerate() {
        let destination = std::path::PathBuf::from(&persisted.destination);
        validate_destination(install_root, &destination).map_err(|error| error.message)?;
        if path_is_within(&destination, journal_root) {
            return Err("Durable language journal entry points into its own journal.".to_string());
        }
        if seen
            .iter()
            .any(|path: &std::path::PathBuf| windows_paths_equal(path, &destination))
        {
            return Err("Durable language journal contains duplicate destinations.".to_string());
        }
        seen.push(destination.clone());
        validate_optional_hash(persisted.preimage_sha256.as_deref(), "journal preimage")
            .map_err(|error| error.message)?;
        if persisted.postimage_sha256.len() > 4 {
            return Err(
                "Durable language journal postimage history exceeds its bound.".to_string(),
            );
        }
        for hash in &persisted.postimage_sha256 {
            validate_optional_hash(hash.as_deref(), "journal postimage")
                .map_err(|error| error.message)?;
        }
        validate_optional_hash(
            persisted
                .displaced_publication_expected_before_sha256
                .as_deref(),
            "displaced publication preimage",
        )
        .map_err(|error| error.message)?;
        validate_optional_hash(
            persisted
                .displaced_publication_expected_after_sha256
                .as_deref(),
            "displaced publication postimage",
        )
        .map_err(|error| error.message)?;
        match (
            persisted.displaced_publication_pending,
            persisted
                .displaced_publication_expected_before_sha256
                .is_some(),
            persisted
                .displaced_publication_expected_after_sha256
                .is_some(),
        ) {
            (true, true, true) | (false, false, false) => {}
            _ => {
                return Err(
                    "Durable journal displaced publication intent is internally inconsistent."
                        .to_string(),
                )
            }
        }

        let (backup, permissions) = match persisted.preimage_sha256.as_deref() {
            Some(expected) => {
                let backup_value = persisted
                    .backup
                    .as_deref()
                    .ok_or_else(|| "Durable journal preimage is missing its backup.".to_string())?;
                let backup = std::path::PathBuf::from(backup_value);
                let expected_backup = journal_root.join(format!("{index}.preimage"));
                if !windows_paths_equal(&backup, &expected_backup) {
                    return Err(
                        "Durable journal backup path is not its fixed owned path.".to_string()
                    );
                }
                let permission = persisted.permission.as_ref().ok_or_else(|| {
                    "Durable journal preimage is missing its permission.".to_string()
                })?;
                match fs::symlink_metadata(&backup) {
                    Ok(metadata) => {
                        ensure_journal_file(journal_root, &backup)?;
                        let backup_hash = snapshot_hash(&backup).map_err(|error| error.message)?;
                        if backup_hash.as_deref() != Some(expected) {
                            return Err("Durable journal backup hash does not match its preimage."
                                .to_string());
                        }
                        if metadata.permissions().readonly() != permission.readonly {
                            return Err(
                                "Durable journal backup permission does not match its manifest."
                                    .to_string(),
                            );
                        }
                        (Some(backup), Some(metadata.permissions()))
                    }
                    Err(error)
                        if allow_missing_backups
                            && error.kind() == std::io::ErrorKind::NotFound =>
                    {
                        // Committed postimages are independently verified; a crash while
                        // deleting owned backups must not strand an already committed result.
                        (Some(backup), None)
                    }
                    Err(error) => {
                        return Err(format!("Could not inspect durable journal backup: {error}"))
                    }
                }
            }
            None => {
                if persisted.backup.is_some() || persisted.permission.is_some() {
                    return Err(
                        "Durable journal missing preimage must not carry backup or permission."
                            .to_string(),
                    );
                }
                (None, None)
            }
        };
        entries.push(JournalEntry {
            destination,
            original_sha256: persisted.preimage_sha256.clone(),
            backup,
            original_permissions: permissions,
            owned_postimages: persisted.postimage_sha256.iter().cloned().collect(),
            displaced_publication_pending: persisted.displaced_publication_pending,
            displaced_publication_expected_before_sha256: persisted
                .displaced_publication_expected_before_sha256
                .clone(),
            displaced_publication_expected_after_sha256: persisted
                .displaced_publication_expected_after_sha256
                .clone(),
        });
    }

    if manifest.created_directories.len() > MAX_JOURNAL_ENTRIES {
        return Err("Durable journal created-directory count exceeds its bound.".to_string());
    }
    let mut seen_directories = Vec::with_capacity(manifest.created_directories.len());
    for value in &manifest.created_directories {
        let directory = std::path::PathBuf::from(value);
        validate_directory_destination(install_root, &directory).map_err(|error| error.message)?;
        if path_is_within(&directory, journal_root) {
            return Err(
                "Durable journal created directory points into its own journal.".to_string(),
            );
        }
        if seen_directories
            .iter()
            .any(|path: &std::path::PathBuf| windows_paths_equal(path, &directory))
        {
            return Err("Durable journal contains duplicate created directories.".to_string());
        }
        seen_directories.push(directory);
    }
    Ok(entries)
}

fn read_journal_manifest(journal_root: &Path) -> Result<JournalManifest, String> {
    let state = read_manifest_file(&journal_root.join(JOURNAL_STATE_FILE))?;
    let temporary = read_manifest_file(&journal_root.join(JOURNAL_STATE_TEMP_FILE))?;
    let bytes = match (state, temporary) {
        (Some(state), None) | (None, Some(state)) => state,
        (Some(state), Some(temporary)) if state == temporary => state,
        (Some(state), Some(_temporary)) => {
            // `journal.state` is the last published generation. The temporary file is written
            // and synced before publication, so when both survive a crash its differing bytes
            // are an uncommitted candidate and must never grant ownership of new postimages.
            state
        }
        (None, None) => return Err("Durable journal state is missing.".to_string()),
    };
    serde_json::from_slice(&bytes)
        .map_err(|error| format!("Durable journal state JSON is invalid: {error}"))
}

fn read_manifest_file(path: &Path) -> Result<Option<Vec<u8>>, String> {
    let mut file = match fs::OpenOptions::new()
        .read(true)
        .share_mode(0)
        .custom_flags(FILE_FLAG_OPEN_REPARSE_POINT)
        .open(path)
    {
        Ok(file) => file,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(error) => return Err(format!("Could not open durable journal state: {error}")),
    };
    let metadata = file
        .metadata()
        .map_err(|error| format!("Could not inspect opened durable journal state: {error}"))?;
    if !metadata.is_file() || metadata_is_reparse_point(&metadata) {
        return Err(format!(
            "Durable journal state is not an ordinary file: {}",
            path.display()
        ));
    }
    if metadata.len() > MAX_MANIFEST_BYTES {
        return Err("Durable journal state exceeds its byte bound.".to_string());
    }
    let mut bytes = Vec::with_capacity(metadata.len() as usize);
    file.read_to_end(&mut bytes)
        .map_err(|error| format!("Could not read durable journal state: {error}"))?;
    Ok(Some(bytes))
}

fn write_journal_manifest(journal_root: &Path, manifest: &JournalManifest) -> Result<(), String> {
    let bytes = serde_json::to_vec_pretty(manifest)
        .map_err(|error| format!("Could not serialize durable journal manifest: {error}"))?;
    if bytes.len() as u64 > MAX_MANIFEST_BYTES {
        return Err("Durable journal manifest exceeds its byte bound.".to_string());
    }
    let state = journal_root.join(JOURNAL_STATE_FILE);
    let temporary = journal_root.join(JOURNAL_STATE_TEMP_FILE);
    ensure_optional_journal_file(journal_root, &temporary)?;
    ensure_optional_journal_file(journal_root, &state)?;
    let mut file = fs::OpenOptions::new()
        .read(true)
        .write(true)
        .create(true)
        .truncate(true)
        .share_mode(0)
        .custom_flags(FILE_FLAG_OPEN_REPARSE_POINT)
        .open(&temporary)
        .map_err(|error| format!("Could not open durable journal state temporary file: {error}"))?;
    let metadata = file.metadata().map_err(|error| {
        format!("Could not inspect opened durable journal temporary file: {error}")
    })?;
    if !metadata.is_file() || metadata_is_reparse_point(&metadata) {
        return Err("Durable journal temporary state is not an ordinary file.".to_string());
    }
    file.write_all(&bytes)
        .and_then(|_| file.sync_all())
        .map_err(|error| format!("Could not persist durable journal state file: {error}"))?;
    drop(file);
    sync_directory(journal_root)?;

    match fs::remove_file(&state) {
        Ok(()) => {}
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
        Err(error) => return Err(format!("Could not replace durable journal state: {error}")),
    }
    sync_directory(journal_root)?;
    fs::rename(&temporary, &state)
        .map_err(|error| format!("Could not publish durable journal state: {error}"))?;
    sync_directory(journal_root)
}

fn validate_journal_root_name(install_root: &Path, journal_root: &Path) -> Result<(), String> {
    if !journal_root.is_absolute() || !path_is_within(journal_root, install_root) {
        return Err("Journal path escaped the install root.".to_string());
    }
    let parent = journal_root
        .parent()
        .ok_or_else(|| "Journal path has no parent.".to_string())?;
    if !windows_paths_equal(parent, install_root) {
        return Err("Journal must be a direct install-root child.".to_string());
    }
    let name = journal_root
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or_else(|| "Journal has an invalid name.".to_string())?;
    let nonce = name
        .strip_prefix(JOURNAL_PREFIX)
        .ok_or_else(|| "Journal lacks the fixed prefix.".to_string())?;
    if nonce.len() != 64
        || !nonce
            .bytes()
            .all(|byte| byte.is_ascii_hexdigit() && !byte.is_ascii_uppercase())
    {
        return Err("Journal nonce is not 64 lowercase hexadecimal characters.".to_string());
    }
    Ok(())
}

fn ensure_journal_file(journal_root: &Path, path: &Path) -> Result<(), String> {
    if !path.is_absolute() || !path_is_within(path, journal_root) {
        return Err("Durable journal backup escaped its journal directory.".to_string());
    }
    if path.parent() != Some(journal_root) {
        return Err("Durable journal backup must be a direct journal child.".to_string());
    }
    let metadata = fs::symlink_metadata(path)
        .map_err(|error| format!("Could not inspect durable journal backup: {error}"))?;
    if !metadata.is_file() || metadata_is_reparse_point(&metadata) {
        return Err(format!(
            "Durable journal backup is not an ordinary file: {}",
            path.display()
        ));
    }
    Ok(())
}

fn ensure_optional_journal_file(journal_root: &Path, path: &Path) -> Result<(), String> {
    if !path.is_absolute()
        || !path_is_within(path, journal_root)
        || path.parent() != Some(journal_root)
    {
        return Err("Durable journal state path is not a direct journal child.".to_string());
    }
    match fs::symlink_metadata(path) {
        Ok(metadata) if metadata.is_file() && !metadata_is_reparse_point(&metadata) => Ok(()),
        Ok(_) => Err(format!(
            "Durable journal state is not an ordinary file: {}",
            path.display()
        )),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(format!(
            "Could not inspect durable journal state {}: {error}",
            path.display()
        )),
    }
}

pub(super) fn sync_directory(path: &Path) -> Result<(), String> {
    let metadata = fs::symlink_metadata(path)
        .map_err(|error| format!("Could not inspect directory for durable sync: {error}"))?;
    if !metadata.is_dir() || metadata_is_reparse_point(&metadata) {
        return Err(format!(
            "Cannot fsync a non-directory transaction path: {}",
            path.display()
        ));
    }
    let directory = fs::OpenOptions::new()
        .read(true)
        .write(true)
        .share_mode(FILE_SHARE_ALL)
        .custom_flags(FILE_FLAG_BACKUP_SEMANTICS)
        .open(path)
        .map_err(|error| format!("Could not open directory for durable sync: {error}"))?;
    directory
        .sync_all()
        .map_err(|error| format!("Could not fsync transaction directory: {error}"))
}

use super::storage::journal_cleanup::{inspect_journal_root, remove_journal_root};
