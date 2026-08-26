/**
 * [INPUT]: 依赖 worker 已解析的固定 source/destination、lowercase SHA-256 preimage 与 OS-known install root；复用 Windows reparse/containment 守卫。
 * [OUTPUT]: 提供非序列化 payload/preimage、跨 payload/QPA/final marker 的 durable backup journal、写前 postimage 授权、原始父目录重建、同句柄验写与 marker-last hash-aware rollback。
 * [POS]: language_transaction 的文件事务内核；manifest、路径、postimage 与目录恢复由窄协作者投影，本模块不解析 plan、不启动进程，未知当前哈希永不被事后认领或旧备份覆盖。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
use std::{
    collections::HashSet,
    fmt, fs,
    io::{Seek, SeekFrom},
    path::{Path, PathBuf},
};

use super::super::known_folders::{
    ensure_no_reparse_points, metadata_is_reparse_point, path_is_within,
};
use super::path_validation::{
    validate_destination, validate_directory_destination, validate_install_root,
    validate_lower_hash, validate_optional_hash, validate_source, windows_paths_equal,
};

#[path = "destination_io.rs"]
mod destination_io;
#[cfg(test)]
use destination_io::lower_hex;
use destination_io::{hash_open_file, open_exclusive_ordinary_file, LockedDestination};

#[path = "journal_cleanup.rs"]
pub(super) mod journal_cleanup;
use journal_cleanup::{inspect_journal_root, remove_journal_root};

#[cfg(test)]
pub(crate) use super::journal_manifest::RecoveryOutcome;
pub(crate) use super::journal_manifest::{has_pending, recover_pending};
use super::journal_manifest::{persist_manifest, sync_directory, JournalPhase};

#[path = "postimage_ownership.rs"]
mod postimage_ownership;
pub(super) use postimage_ownership::ResolvedPostimage;
#[path = "rollback_directories.rs"]
mod rollback_directories;
use rollback_directories::restore_original_parent_directories;

pub(super) const JOURNAL_PREFIX: &str = ".cavalry-i18n-transaction-";
pub(super) const JOURNAL_STATE_FILE: &str = "journal.state";
pub(super) const JOURNAL_STATE_TEMP_FILE: &str = "journal.state.tmp";
pub(super) const NONCE_HEX_LENGTH: usize = 64;

#[derive(Debug, Clone, PartialEq, Eq)]
pub(super) struct ResolvedPayload {
    pub(super) source: PathBuf,
    pub(super) destination: PathBuf,
    pub(super) source_sha256: String,
    pub(super) expected_destination_sha256: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(super) struct ResolvedPreimage {
    pub(super) destination: PathBuf,
    pub(super) expected_sha256: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(super) struct CleanupResidual {
    pub(super) paths: Vec<PathBuf>,
    pub(super) detail: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(super) enum CommitCleanup {
    Clean,
    Residual(CleanupResidual),
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(super) enum RollbackOutcome {
    Restored,
    Uncertain(CleanupResidual),
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(super) struct StorageError {
    pub(super) message: String,
    pub(super) cleanup_residual: Option<CleanupResidual>,
}

impl StorageError {
    pub(super) fn new(message: impl Into<String>) -> Self {
        Self {
            message: message.into(),
            cleanup_residual: None,
        }
    }

    fn with_residual(message: impl Into<String>, residual: CleanupResidual) -> Self {
        Self {
            message: message.into(),
            cleanup_residual: Some(residual),
        }
    }
}

impl fmt::Display for StorageError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(formatter, "{}", self.message)
    }
}

impl std::error::Error for StorageError {}

#[derive(Debug)]
pub(super) struct JournalEntry {
    pub(super) destination: PathBuf,
    pub(super) original_sha256: Option<String>,
    pub(super) backup: Option<PathBuf>,
    pub(super) original_permissions: Option<fs::Permissions>,
    pub(super) owned_postimages: HashSet<Option<String>>,
}

#[derive(Debug)]
pub(super) struct DurableJournal {
    pub(super) install_root: PathBuf,
    pub(super) journal_root: PathBuf,
    pub(super) entries: Vec<JournalEntry>,
    pub(super) created_directories: Vec<PathBuf>,
    pub(super) applied_payloads: usize,
}

impl DurableJournal {
    pub(super) fn prepare(
        install_root: &Path,
        nonce: &str,
        payloads: &[ResolvedPayload],
        fixed_rollback_surface: &[ResolvedPreimage],
    ) -> Result<Self, StorageError> {
        validate_lower_hash(nonce, "transaction nonce")?;
        let install_root = validate_install_root(install_root)?;
        for payload in payloads {
            validate_lower_hash(&payload.source_sha256, "payload source hash")?;
            validate_optional_hash(
                payload.expected_destination_sha256.as_deref(),
                "payload destination preimage",
            )?;
            validate_source(&payload.source)?;
            validate_destination(&install_root, &payload.destination)?;
        }
        for preimage in fixed_rollback_surface {
            validate_optional_hash(preimage.expected_sha256.as_deref(), "fixed preimage")?;
            validate_destination(&install_root, &preimage.destination)?;
        }

        let journal_root = install_root.join(format!("{JOURNAL_PREFIX}{nonce}"));
        validate_destination(&install_root, &journal_root)?;
        match fs::create_dir(&journal_root) {
            Ok(()) => {}
            Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => {
                return Err(StorageError::new(format!(
                    "Transaction journal already exists: {}",
                    journal_root.display()
                )))
            }
            Err(error) => {
                return Err(StorageError::new(format!(
                    "Could not create transaction journal {}: {error}",
                    journal_root.display()
                )))
            }
        }
        sync_directory(&install_root).map_err(|error| {
            cleanup_failed_prepare(
                &install_root,
                &journal_root,
                0,
                format!("Could not persist transaction journal directory: {error}"),
            )
        })?;
        sync_directory(&journal_root).map_err(|error| {
            cleanup_failed_prepare(
                &install_root,
                &journal_root,
                0,
                format!("Could not persist transaction journal directory: {error}"),
            )
        })?;

        let targets = collect_targets(payloads, fixed_rollback_surface);
        let entries = match snapshot_targets(&install_root, &journal_root, &targets) {
            Ok(entries) => entries,
            Err(error) => {
                return Err(cleanup_failed_prepare(
                    &install_root,
                    &journal_root,
                    targets.len(),
                    error,
                ));
            }
        };
        let journal = Self {
            install_root,
            journal_root,
            entries,
            created_directories: Vec::new(),
            applied_payloads: 0,
        };
        if let Err(error) = journal.persist_manifest(JournalPhase::Prepared) {
            return Err(cleanup_failed_prepare(
                &journal.install_root,
                &journal.journal_root,
                targets.len(),
                error,
            ));
        }
        Ok(journal)
    }

    #[cfg(test)]
    pub(super) fn journal_root(&self) -> &Path {
        &self.journal_root
    }

    pub(super) fn apply_payload(&mut self, payload: &ResolvedPayload) -> Result<(), StorageError> {
        self.apply_payload_with_ownership(payload, false)
    }

    pub(super) fn apply_transition_payload(
        &mut self,
        payload: &ResolvedPayload,
    ) -> Result<(), StorageError> {
        self.apply_payload_with_ownership(payload, true)
    }

    fn apply_payload_with_ownership(
        &mut self,
        payload: &ResolvedPayload,
        allow_owned_preimage: bool,
    ) -> Result<(), StorageError> {
        validate_lower_hash(&payload.source_sha256, "payload source hash")?;
        validate_optional_hash(
            payload.expected_destination_sha256.as_deref(),
            "payload destination preimage",
        )?;
        validate_destination(&self.install_root, &payload.destination)?;
        validate_source(&payload.source)?;

        let mut source = open_exclusive_ordinary_file(&payload.source, "payload source")
            .map_err(StorageError::new)?;
        let actual_source_hash =
            hash_open_file(&mut source, &payload.source).map_err(StorageError::new)?;
        if actual_source_hash != payload.source_sha256 {
            return Err(StorageError::new(format!(
                "Payload source changed before copy: {}",
                payload.source.display()
            )));
        }
        source.seek(SeekFrom::Start(0)).map_err(|error| {
            StorageError::new(format!("Could not rewind payload source: {error}"))
        })?;
        let source_permissions = source
            .metadata()
            .map_err(|error| {
                StorageError::new(format!("Could not inspect payload source: {error}"))
            })?
            .permissions();

        self.ensure_destination_parent(&payload.destination)?;
        let entry_index = self.entry_index(&payload.destination)?;
        let mut destination = LockedDestination::open_for_write(
            &payload.destination,
            payload.expected_destination_sha256.is_some(),
        )
        .map_err(StorageError::new)?;
        let current = destination.preimage_sha256().map(str::to_owned);
        if current != payload.expected_destination_sha256 {
            return Err(StorageError::new(format!(
                "Destination changed before payload write: {}",
                payload.destination.display()
            )));
        }
        let entry = &self.entries[entry_index];
        if current != entry.original_sha256
            && (!allow_owned_preimage || !entry.owned_postimages.contains(&current))
        {
            return Err(StorageError::new(format!(
                "Destination hash is not owned by this transaction: {}",
                payload.destination.display()
            )));
        }

        // 先把预期 postimage 写入 durable manifest，再触碰目标。若进程正好在写入后
        // 崩溃，恢复进程仍能识别这次写入属于本事务；若崩溃在写入前，原始 preimage
        // 仍然满足回滚后置条件。
        self.entries[entry_index]
            .owned_postimages
            .insert(Some(payload.source_sha256.clone()));
        self.persist_manifest(JournalPhase::Applying)
            .map_err(StorageError::new)?;

        let mutation = destination.overwrite_from(&mut source, &source_permissions);
        let installed_hash = mutation.observed_sha256;
        if let Some(hash) = installed_hash.clone() {
            self.entries[entry_index]
                .owned_postimages
                .insert(Some(hash));
        }
        if let Some(error) = mutation.error {
            return Err(StorageError::new(error));
        }
        if installed_hash.as_deref() != Some(payload.source_sha256.as_str()) {
            return Err(StorageError::new(format!(
                "Payload destination hash verification failed: {}",
                payload.destination.display()
            )));
        }
        self.applied_payloads += 1;
        self.persist_manifest(JournalPhase::Applying)
            .map_err(StorageError::new)
    }

    pub(super) fn record_created_directory(
        &mut self,
        directory: &Path,
    ) -> Result<(), StorageError> {
        validate_directory_destination(&self.install_root, directory)?;
        if !self
            .created_directories
            .iter()
            .any(|existing| windows_paths_equal(existing, directory))
        {
            self.created_directories.push(directory.to_path_buf());
            self.persist_manifest(JournalPhase::Applying)
                .map_err(StorageError::new)?;
        }
        Ok(())
    }

    #[cfg(test)]
    pub(super) fn rollback(self) -> RollbackOutcome {
        self.rollback_internal(None)
    }

    /// pending marker 是事务的 fail-closed 门闩；仅在所有其他目标都精确恢复后才恢复旧语言。
    pub(super) fn rollback_fail_closed(self, marker: &Path) -> RollbackOutcome {
        self.rollback_internal(Some(marker))
    }

    fn rollback_internal(mut self, marker: Option<&Path>) -> RollbackOutcome {
        let mut failures = Vec::<(PathBuf, String)>::new();
        if let Err(error) = self.persist_manifest(JournalPhase::RollingBack) {
            failures.push((self.journal_root.clone(), error));
        }
        let marker_index = marker.and_then(|marker| {
            self.entries
                .iter()
                .position(|entry| windows_paths_equal(&entry.destination, marker))
        });
        if marker.is_some() && marker_index.is_none() {
            failures.push((
                marker.unwrap().to_path_buf(),
                "fail-closed marker is not part of the durable journal".to_string(),
            ));
        }
        if let Err(error) =
            inspect_journal_root(&self.install_root, &self.journal_root, self.entries.len())
        {
            failures.push((self.journal_root.clone(), error));
        }
        if let Err((path, error)) = restore_original_parent_directories(
            &self.install_root,
            &self.entries,
            &self.created_directories,
        ) {
            failures.push((path, error));
        }
        for (index, entry) in self.entries.iter().enumerate().rev() {
            if marker_index == Some(index) {
                continue;
            }
            if let Err(error) = rollback_entry(entry) {
                failures.push((entry.destination.clone(), error));
            }
        }
        self.created_directories
            .sort_by_key(|path| std::cmp::Reverse(path.components().count()));
        self.created_directories.dedup();
        for directory in &self.created_directories {
            let removed = match fs::remove_dir(directory) {
                Ok(()) => true,
                Err(error) if error.kind() == std::io::ErrorKind::NotFound => false,
                Err(error) => {
                    failures.push((directory.clone(), error.to_string()));
                    false
                }
            };
            if removed {
                if let Some(parent) = directory.parent() {
                    if let Err(error) = sync_directory(parent) {
                        failures.push((parent.to_path_buf(), error));
                    }
                }
            }
        }
        if failures.is_empty() {
            if let Some(index) = marker_index {
                let entry = &self.entries[index];
                if let Err(error) = rollback_entry(entry) {
                    failures.push((entry.destination.clone(), error));
                }
            }
        }
        if failures.is_empty() {
            match remove_journal_root(&self.install_root, &self.journal_root, self.entries.len()) {
                Ok(()) => RollbackOutcome::Restored,
                Err(error) => RollbackOutcome::Uncertain(CleanupResidual {
                    paths: vec![self.journal_root],
                    detail: error,
                }),
            }
        } else {
            failures.push((
                self.journal_root.clone(),
                "durable backups retained for recovery".to_string(),
            ));
            RollbackOutcome::Uncertain(residual_from_failures(failures))
        }
    }

    pub(super) fn commit(self) -> CommitCleanup {
        if let Err(error) = self.persist_manifest(JournalPhase::Committing) {
            return CommitCleanup::Residual(CleanupResidual {
                paths: vec![self.journal_root.clone()],
                detail: error,
            });
        }
        if let Err(error) = self.verify_committed_postimages() {
            return CommitCleanup::Residual(CleanupResidual {
                paths: vec![self.journal_root.clone()],
                detail: error,
            });
        }
        if let Err(error) = self.persist_manifest(JournalPhase::Committed) {
            return CommitCleanup::Residual(CleanupResidual {
                paths: vec![self.journal_root.clone()],
                detail: error,
            });
        }
        match remove_journal_root(&self.install_root, &self.journal_root, self.entries.len()) {
            Ok(()) => CommitCleanup::Clean,
            Err(error) => CommitCleanup::Residual(CleanupResidual {
                paths: vec![self.journal_root],
                detail: error,
            }),
        }
    }

    pub(super) fn verify_committed_postimages(&self) -> Result<(), String> {
        for entry in &self.entries {
            let current = snapshot_hash(&entry.destination).map_err(|error| error.message)?;
            if !entry.owned_postimages.contains(&current) {
                return Err(format!(
                    "Committed transaction postimage changed unexpectedly: {}",
                    entry.destination.display()
                ));
            }
        }
        Ok(())
    }

    fn entry_index(&self, destination: &Path) -> Result<usize, StorageError> {
        self.entries
            .iter()
            .position(|entry| windows_paths_equal(&entry.destination, destination))
            .ok_or_else(|| {
                StorageError::new(format!(
                    "Destination is not part of the durable journal: {}",
                    destination.display()
                ))
            })
    }

    fn persist_manifest(&self, phase: JournalPhase) -> Result<(), String> {
        persist_manifest(self, phase)
    }

    fn ensure_destination_parent(&mut self, destination: &Path) -> Result<(), StorageError> {
        let parent = destination
            .parent()
            .ok_or_else(|| StorageError::new("Payload destination has no parent."))?;
        let mut missing = Vec::new();
        let mut cursor = parent;
        while !cursor.exists() {
            if !path_is_within(cursor, &self.install_root) {
                return Err(StorageError::new(
                    "Payload parent escaped the selected install root.",
                ));
            }
            missing.push(cursor.to_path_buf());
            cursor = cursor
                .parent()
                .ok_or_else(|| StorageError::new("Payload parent has no existing ancestor."))?;
        }
        // 目录的所有权必须先进入 durable manifest。否则 create_dir 成功后进程若在
        // manifest 更新前崩溃，恢复进程无法知道该目录是本事务创建的。
        for directory in &missing {
            validate_directory_destination(&self.install_root, directory)?;
        }
        if !missing.is_empty() {
            for directory in &missing {
                if !self
                    .created_directories
                    .iter()
                    .any(|existing| windows_paths_equal(existing, directory))
                {
                    self.created_directories.push(directory.clone());
                }
            }
            self.persist_manifest(JournalPhase::Applying)
                .map_err(StorageError::new)?;
        }
        for directory in missing.iter().rev() {
            match fs::create_dir(directory) {
                Ok(()) => {}
                Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => {
                    let metadata = fs::symlink_metadata(directory).map_err(|inspect| {
                        StorageError::new(format!(
                            "Could not inspect payload directory {} after concurrent creation: {inspect}",
                            directory.display()
                        ))
                    })?;
                    if !metadata.is_dir() || metadata_is_reparse_point(&metadata) {
                        return Err(StorageError::new(format!(
                            "Payload directory is not an ordinary directory: {}",
                            directory.display()
                        )));
                    }
                }
                Err(error) => {
                    return Err(StorageError::new(format!(
                        "Could not create payload directory {}: {error}",
                        directory.display()
                    )))
                }
            }
            sync_directory(directory).map_err(StorageError::new)?;
        }
        ensure_no_reparse_points(&self.install_root, destination).map_err(StorageError::new)?;
        Ok(())
    }
}

fn collect_targets(
    payloads: &[ResolvedPayload],
    fixed: &[ResolvedPreimage],
) -> Vec<ResolvedPreimage> {
    let mut output = Vec::with_capacity(payloads.len() + fixed.len());
    for payload in payloads {
        push_unique_target(
            &mut output,
            ResolvedPreimage {
                destination: payload.destination.clone(),
                expected_sha256: payload.expected_destination_sha256.clone(),
            },
        );
    }
    for preimage in fixed {
        push_unique_target(&mut output, preimage.clone());
    }
    output
}

fn push_unique_target(output: &mut Vec<ResolvedPreimage>, candidate: ResolvedPreimage) {
    if output
        .iter()
        .any(|entry| windows_paths_equal(&entry.destination, &candidate.destination))
    {
        // pending/final marker 共享目标；首次记录才是整个事务必须恢复的 preimage。
        return;
    }
    output.push(candidate);
}

fn snapshot_targets(
    install_root: &Path,
    journal_root: &Path,
    targets: &[ResolvedPreimage],
) -> Result<Vec<JournalEntry>, String> {
    let mut seen = Vec::<PathBuf>::new();
    let mut entries = Vec::with_capacity(targets.len());
    for (index, target) in targets.iter().enumerate() {
        if seen
            .iter()
            .any(|path| windows_paths_equal(path, &target.destination))
        {
            return Err(format!(
                "Transaction surface contains conflicting duplicate target {}.",
                target.destination.display()
            ));
        }
        seen.push(target.destination.clone());
        validate_destination(install_root, &target.destination).map_err(|error| error.message)?;
        let actual = snapshot_hash(&target.destination).map_err(|error| error.message)?;
        if actual != target.expected_sha256 {
            return Err(format!(
                "Target preimage changed before journal preparation: {}",
                target.destination.display()
            ));
        }
        let (backup, permissions) = match actual.as_deref() {
            Some(expected) => {
                let backup = journal_root.join(format!("{index}.preimage"));
                let permissions = backup_existing_file(&target.destination, &backup, expected)?;
                (Some(backup), Some(permissions))
            }
            None => (None, None),
        };
        entries.push(JournalEntry {
            destination: target.destination.clone(),
            original_sha256: actual,
            backup,
            original_permissions: permissions,
            owned_postimages: HashSet::new(),
        });
    }
    Ok(entries)
}

fn backup_existing_file(
    source_path: &Path,
    backup_path: &Path,
    expected_hash: &str,
) -> Result<fs::Permissions, String> {
    let mut source = open_exclusive_ordinary_file(source_path, "target preimage")?;
    let actual = hash_open_file(&mut source, source_path)?;
    if actual != expected_hash {
        return Err(format!(
            "Target changed while its durable preimage was opened: {}",
            source_path.display()
        ));
    }
    source.seek(SeekFrom::Start(0)).map_err(|error| {
        format!(
            "Could not rewind target preimage {}: {error}",
            source_path.display()
        )
    })?;
    let permissions = source
        .metadata()
        .map_err(|error| format!("Could not inspect target preimage: {error}"))?
        .permissions();
    let mut backup = fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(backup_path)
        .map_err(|error| format!("Could not create durable backup: {error}"))?;
    std::io::copy(&mut source, &mut backup)
        .map_err(|error| format!("Could not persist durable backup: {error}"))?;
    backup
        .set_permissions(permissions.clone())
        .map_err(|error| format!("Could not preserve backup permissions: {error}"))?;
    backup
        .sync_all()
        .map_err(|error| format!("Could not persist durable backup permissions: {error}"))?;
    drop(backup);
    if let Some(parent) = backup_path.parent() {
        sync_directory(parent)?;
    }
    let backup_hash = snapshot_hash(backup_path).map_err(|error| error.message)?;
    if backup_hash.as_deref() != Some(expected_hash) {
        return Err("Durable backup hash did not match its target preimage.".to_string());
    }
    Ok(permissions)
}

fn rollback_entry(entry: &JournalEntry) -> Result<(), String> {
    match (
        entry.original_sha256.as_deref(),
        entry.backup.as_deref(),
        entry.original_permissions.as_ref(),
    ) {
        (Some(expected), Some(backup), Some(permissions)) => {
            let observed = snapshot_hash(&entry.destination).map_err(|error| error.message)?;
            if observed.as_deref() != Some(expected) && !entry.owned_postimages.contains(&observed)
            {
                return Err(format!(
                    "Current hash is not owned by this transaction; refusing to overwrite {}.",
                    entry.destination.display()
                ));
            }
            if observed.as_deref() == Some(expected) {
                let destination = LockedDestination::open_for_write(&entry.destination, true)?;
                let current = destination.preimage_sha256().map(str::to_owned);
                if current != observed {
                    return Err(format!(
                        "Transaction destination changed while rollback acquired its handle: {}.",
                        entry.destination.display()
                    ));
                }
                return Ok(());
            }
            // 先证明 durable backup 可读且哈希正确，再打开或创建目标文件。
            // 否则目标原本缺失时，损坏的 backup 会留下事务自身制造的空文件。
            let mut source = open_exclusive_ordinary_file(backup, "durable rollback backup")?;
            let actual = hash_open_file(&mut source, backup)?;
            if actual != expected {
                return Err("Durable rollback backup hash changed.".to_string());
            }
            source
                .seek(SeekFrom::Start(0))
                .map_err(|error| format!("Could not rewind rollback backup: {error}"))?;
            let mut destination =
                LockedDestination::open_for_write(&entry.destination, observed.is_some())?;
            let current = destination.preimage_sha256().map(str::to_owned);
            if current != observed {
                return Err(format!(
                    "Transaction destination changed while rollback acquired its handle: {}.",
                    entry.destination.display()
                ));
            }
            let mutation = destination.overwrite_from(&mut source, permissions);
            if let Some(error) = mutation.error {
                return Err(error);
            }
            if mutation.observed_sha256.as_deref() != Some(expected) {
                return Err("Rollback did not reproduce the recorded preimage hash.".to_string());
            }
        }
        (None, None, None) => {
            let Some(destination) =
                LockedDestination::open_existing_for_delete(&entry.destination)?
            else {
                return Ok(());
            };
            let current = destination.preimage_sha256().map(str::to_owned);
            if !entry.owned_postimages.contains(&current) {
                return Err(format!(
                    "Current hash is not owned by this transaction; refusing to delete {}.",
                    entry.destination.display()
                ));
            }
            destination.delete_on_close()?;
        }
        _ => return Err("Durable journal entry is internally inconsistent.".to_string()),
    }
    Ok(())
}

pub(super) fn snapshot_hash(path: &Path) -> Result<Option<String>, StorageError> {
    match fs::symlink_metadata(path) {
        Ok(metadata) => {
            if !metadata.is_file() || metadata_is_reparse_point(&metadata) {
                return Err(StorageError::new(format!(
                    "Refusing non-file or reparse transaction target: {}",
                    path.display()
                )));
            }
            let mut file = open_exclusive_ordinary_file(path, "transaction target")
                .map_err(StorageError::new)?;
            hash_open_file(&mut file, path)
                .map(Some)
                .map_err(StorageError::new)
        }
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(error) => Err(StorageError::new(format!(
            "Could not inspect transaction target {}: {error}",
            path.display()
        ))),
    }
}

fn cleanup_failed_prepare(
    install_root: &Path,
    journal_root: &Path,
    entry_count: usize,
    error: String,
) -> StorageError {
    match remove_journal_root(install_root, journal_root, entry_count) {
        Ok(()) => StorageError::new(error),
        Err(cleanup_error) => StorageError::with_residual(
            error,
            CleanupResidual {
                paths: vec![journal_root.to_path_buf()],
                detail: format!("Could not clean incomplete journal: {cleanup_error}"),
            },
        ),
    }
}

fn residual_from_failures(failures: Vec<(PathBuf, String)>) -> CleanupResidual {
    let mut paths = failures
        .iter()
        .map(|(path, _)| path.clone())
        .collect::<Vec<_>>();
    paths.sort();
    paths.dedup();
    CleanupResidual {
        paths,
        detail: failures
            .into_iter()
            .map(|(path, error)| format!("{}: {error}", path.display()))
            .collect::<Vec<_>>()
            .join(" | "),
    }
}

#[cfg(test)]
#[path = "qpa_journal_tests.rs"]
mod qpa_journal_tests;
#[cfg(test)]
#[path = "storage_tests.rs"]
mod tests;
