/**
 * [INPUT]: 依赖 worker 已验证的固定 payload/preimage、lowercase SHA-256、OS-known install root containment、固定 journal 与 Windows reparse-safe 文件 I/O 原语。
 * [OUTPUT]: 在不可发现 preparation root 中持久化完整 preimage/manifest 后原子发布 durable journal；正向与回滚 ReplaceFileW 均先持久化带 expected before/after 的 displaced intent，再以 displaced 前像完成证明，目标写入与回滚保留精确 ownership 证据。
 * [POS]: language_transaction 的事务编排核心；负责 preparation 发布、目标 CAS、marker-last 提交与 fail-closed recovery，不解析 plan、不启动进程。
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
use destination_io::{
    hash_open_file, journal_replacement_path, open_exclusive_ordinary_file, LockedDestination,
};

#[path = "journal_cleanup.rs"]
pub(super) mod journal_cleanup;
use journal_cleanup::{inspect_journal_root, remove_journal_root, remove_preparation_root};

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
pub(super) const JOURNAL_PREPARATION_PREFIX: &str = ".cavalry-i18n-preparing-";
pub(super) const JOURNAL_STATE_FILE: &str = "journal.state";
pub(super) const JOURNAL_STATE_TEMP_FILE: &str = "journal.state.tmp";
pub(super) const NONCE_HEX_LENGTH: usize = 64;

fn replacement_path(
    journal_root: &Path,
    destination: &Path,
    entry_index: usize,
    phase: &str,
) -> Result<PathBuf, StorageError> {
    journal_replacement_path(journal_root, destination, entry_index, phase)
        .map_err(StorageError::new)
}

fn remove_owned_replacement(path: &Path) -> Result<(), String> {
    let metadata = match fs::symlink_metadata(path) {
        Ok(metadata) => metadata,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(()),
        Err(error) => {
            return Err(format!(
                "Could not inspect transaction replacement {}: {error}",
                path.display()
            ))
        }
    };
    if !metadata.is_file() || metadata_is_reparse_point(&metadata) {
        return Err(format!(
            "Transaction replacement is not an ordinary file: {}",
            path.display()
        ));
    }
    let Some(mut temporary) = LockedDestination::open_existing_for_delete(path)? else {
        return Ok(());
    };
    temporary.clear_readonly_for_delete()?;
    temporary.delete_on_close()?;
    if let Some(parent) = path.parent() {
        sync_directory(parent)?;
    }
    Ok(())
}

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
    RolledBack,
    Uncertain(CleanupResidual),
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
    pub(super) displaced_publication_pending: bool,
    pub(super) displaced_publication_expected_before_sha256: Option<String>,
    pub(super) displaced_publication_expected_after_sha256: Option<String>,
}

#[derive(Debug)]
pub(super) struct DurableJournal {
    pub(super) install_root: PathBuf,
    pub(super) journal_root: PathBuf,
    pub(super) entries: Vec<JournalEntry>,
    pub(super) created_directories: Vec<PathBuf>,
    pub(super) applied_payloads: usize,
    #[cfg(test)]
    pub(super) fail_next_persist: std::cell::Cell<Option<JournalPhase>>,
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
        let preparation_root = install_root.join(format!("{JOURNAL_PREPARATION_PREFIX}{nonce}"));
        validate_destination(&install_root, &journal_root)?;
        validate_destination(&install_root, &preparation_root)?;
        match fs::symlink_metadata(&journal_root) {
            Ok(_) => {
                return Err(StorageError::new(format!(
                    "Transaction journal already exists: {}",
                    journal_root.display()
                )))
            }
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
            Err(error) => {
                return Err(StorageError::new(format!(
                    "Could not inspect transaction journal {}: {error}",
                    journal_root.display()
                )))
            }
        }
        match fs::symlink_metadata(&preparation_root) {
            Ok(_) => {
                return Err(StorageError::new(format!(
                    "Transaction preparation already exists and was retained for inspection: {}",
                    preparation_root.display()
                )))
            }
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
            Err(error) => {
                return Err(StorageError::new(format!(
                    "Could not inspect transaction preparation {}: {error}",
                    preparation_root.display()
                )))
            }
        }
        match fs::create_dir(&preparation_root) {
            Ok(()) => {}
            Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => {
                return Err(StorageError::new(format!(
                    "Transaction preparation already exists: {}",
                    preparation_root.display()
                )))
            }
            Err(error) => {
                return Err(StorageError::new(format!(
                    "Could not create transaction preparation {}: {error}",
                    preparation_root.display()
                )))
            }
        }
        sync_directory(&install_root).map_err(|error| {
            cleanup_failed_prepare(
                &install_root,
                &preparation_root,
                0,
                format!("Could not persist transaction preparation directory: {error}"),
            )
        })?;
        sync_directory(&preparation_root).map_err(|error| {
            cleanup_failed_prepare(
                &install_root,
                &preparation_root,
                0,
                format!("Could not persist transaction preparation directory: {error}"),
            )
        })?;

        let targets = collect_targets(payloads, fixed_rollback_surface);
        let mut entries = match snapshot_targets(&install_root, &preparation_root, &targets) {
            Ok(entries) => entries,
            Err(error) => {
                return Err(cleanup_failed_prepare(
                    &install_root,
                    &preparation_root,
                    targets.len(),
                    error,
                ));
            }
        };
        for entry in &mut entries {
            if let Some(backup) = entry.backup.as_mut() {
                let name = backup.file_name().ok_or_else(|| {
                    StorageError::new("Durable preparation backup has no file name.")
                })?;
                *backup = journal_root.join(name);
            }
        }
        let journal = Self {
            install_root,
            journal_root: journal_root.clone(),
            entries,
            created_directories: Vec::new(),
            applied_payloads: 0,
            #[cfg(test)]
            fail_next_persist: std::cell::Cell::new(None),
        };
        if let Err(error) = super::journal_manifest::persist_manifest_at(
            &journal,
            JournalPhase::Prepared,
            &preparation_root,
        ) {
            return Err(cleanup_failed_prepare(
                &journal.install_root,
                &preparation_root,
                targets.len(),
                error,
            ));
        }
        sync_directory(&preparation_root).map_err(|error| {
            cleanup_failed_prepare(
                &journal.install_root,
                &preparation_root,
                targets.len(),
                format!("Could not persist transaction preparation: {error}"),
            )
        })?;
        fs::rename(&preparation_root, &journal_root).map_err(|error| {
            cleanup_failed_prepare(
                &journal.install_root,
                &preparation_root,
                targets.len(),
                format!("Could not publish durable transaction journal: {error}"),
            )
        })?;
        sync_directory(&journal.install_root).map_err(|error| {
            StorageError::with_residual(
                "Durable transaction journal was published but its parent directory was not durable.",
                CleanupResidual {
                    paths: vec![journal.journal_root.clone()],
                    detail: error,
                },
            )
        })?;
        Ok(journal)
    }

    #[cfg(test)]
    pub(super) fn journal_root(&self) -> &Path {
        &self.journal_root
    }

    pub(super) fn apply_payload(&mut self, payload: &ResolvedPayload) -> Result<(), StorageError> {
        self.apply_payload_with_ownership(payload, false, None)
    }

    pub(super) fn apply_transition_payload(
        &mut self,
        payload: &ResolvedPayload,
    ) -> Result<(), StorageError> {
        self.apply_payload_with_ownership(payload, true, None)
    }

    #[cfg(test)]
    pub(super) fn apply_payload_with_publish_race(
        &mut self,
        payload: &ResolvedPayload,
        race: impl FnOnce() -> Result<(), String> + 'static,
    ) -> Result<(), StorageError> {
        self.apply_payload_with_ownership(payload, false, Some(Box::new(race)))
    }

    fn apply_payload_with_ownership(
        &mut self,
        payload: &ResolvedPayload,
        allow_owned_preimage: bool,
        before_publish: Option<Box<dyn FnOnce() -> Result<(), String>>>,
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

        let replacement = replacement_path(
            &self.journal_root,
            &payload.destination,
            entry_index,
            "apply",
        )?;
        let displaced = replacement_path(
            &self.journal_root,
            &payload.destination,
            entry_index,
            "displaced",
        )?;
        let existing_target = if let Some(expected_before) =
            payload.expected_destination_sha256.as_ref()
        {
            let entry = &mut self.entries[entry_index];
            entry.displaced_publication_pending = true;
            entry.displaced_publication_expected_before_sha256 = Some(expected_before.clone());
            entry.displaced_publication_expected_after_sha256 = Some(payload.source_sha256.clone());
            self.persist_manifest(JournalPhase::Applying)
                .map_err(StorageError::new)?;
            true
        } else {
            false
        };
        let mutation = destination.overwrite_from_with_before_publish(
            &mut source,
            &source_permissions,
            &replacement,
            Some(&displaced),
            before_publish,
            &payload.source_sha256,
        );
        if let Some(error) = mutation.error {
            return Err(StorageError::new(error));
        }
        let installed_hash = mutation.observed_sha256;
        if installed_hash.as_deref() != Some(payload.source_sha256.as_str()) {
            return Err(StorageError::new(format!(
                "Payload destination hash verification failed: {}",
                payload.destination.display()
            )));
        }
        if existing_target {
            let entry = &mut self.entries[entry_index];
            entry.displaced_publication_pending = false;
            entry.displaced_publication_expected_before_sha256 = None;
            entry.displaced_publication_expected_after_sha256 = None;
        }
        self.entries[entry_index]
            .owned_postimages
            .insert(Some(payload.source_sha256.clone()));
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
            return RollbackOutcome::Uncertain(CleanupResidual {
                paths: vec![self.journal_root.clone()],
                detail: format!(
                    "RollingBack manifest was not durable; no rollback mutation was attempted: {error}"
                ),
            });
        }
        if let Err(error) = self.reconcile_pending_displaced_publications(JournalPhase::RollingBack)
        {
            return RollbackOutcome::Uncertain(CleanupResidual {
                paths: vec![self.journal_root.clone()],
                detail: error,
            });
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
        for index in (0..self.entries.len()).rev() {
            if marker_index == Some(index) {
                continue;
            }
            if let Err(error) = self.rollback_entry_durably(index) {
                failures.push((self.entries[index].destination.clone(), error));
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
                if let Err(error) = self.rollback_entry_durably(index) {
                    failures.push((self.entries[index].destination.clone(), error));
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

    pub(super) fn commit(self, marker: Option<&Path>) -> CommitCleanup {
        if let Err(error) = self.persist_manifest(JournalPhase::Committing) {
            return match self.rollback_internal(marker) {
                RollbackOutcome::Restored => CommitCleanup::RolledBack,
                RollbackOutcome::Uncertain(mut residual) => {
                    residual.detail = format!(
                        "Committing manifest was not durable: {error}; {}",
                        residual.detail
                    );
                    CommitCleanup::Uncertain(residual)
                }
            };
        }
        if let Err(error) = self.verify_committed_postimages() {
            return CommitCleanup::Uncertain(CleanupResidual {
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

    pub(super) fn cleanup_replacement_temps(&self) -> Result<(), String> {
        for (index, entry) in self.entries.iter().enumerate() {
            let current = snapshot_hash(&entry.destination).map_err(|error| error.message)?;
            let staged_member_exists = ["apply", "rollback", "displaced"].iter().any(|phase| {
                replacement_path(&self.journal_root, &entry.destination, index, phase)
                    .ok()
                    .and_then(|path| fs::symlink_metadata(path).ok())
                    .is_some()
            });
            if staged_member_exists
                && current != entry.original_sha256
                && !entry.owned_postimages.contains(&current)
            {
                return Err(format!(
                    "Transaction target changed before staged-member cleanup; preserving evidence: {}",
                    entry.destination.display()
                ));
            }
            for phase in ["apply", "rollback"] {
                let replacement =
                    replacement_path(&self.journal_root, &entry.destination, index, phase)
                        .map_err(|error| error.message)?;
                remove_owned_replacement(&replacement)?;
            }
            let displaced =
                replacement_path(&self.journal_root, &entry.destination, index, "displaced")
                    .map_err(|error| error.message)?;
            if let Some(hash) = snapshot_hash(&displaced).map_err(|error| error.message)? {
                let original_or_owned = entry.original_sha256.as_deref() == Some(hash.as_str())
                    || entry.owned_postimages.contains(&Some(hash.clone()));
                if !original_or_owned {
                    return Err(format!(
                        "Displaced preimage changed outside the transaction; preserving evidence: {}",
                        displaced.display()
                    ));
                }
                remove_owned_replacement(&displaced)?;
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
        #[cfg(test)]
        if self.fail_next_persist.get() == Some(phase) {
            self.fail_next_persist.set(None);
            return Err(format!("injected {phase:?} manifest persistence failure"));
        }
        persist_manifest(self, phase)
    }

    pub(super) fn reconcile_pending_displaced_publications(
        &mut self,
        phase: JournalPhase,
    ) -> Result<(), String> {
        let mut changed = false;
        for (index, entry) in self.entries.iter().enumerate() {
            if !entry.displaced_publication_pending {
                continue;
            }
            let current = snapshot_hash(&entry.destination).map_err(|error| error.message)?;
            let displaced =
                replacement_path(&self.journal_root, &entry.destination, index, "displaced")
                    .map_err(|error| error.message)?;
            let displaced_hash = snapshot_hash(&displaced).map_err(|error| error.message)?;
            let expected_before = entry
                .displaced_publication_expected_before_sha256
                .as_deref()
                .ok_or_else(|| {
                    format!(
                        "Pending displaced publication is missing its expected preimage for {}.",
                        entry.destination.display()
                    )
                })?;
            let expected_after = entry
                .displaced_publication_expected_after_sha256
                .as_deref()
                .ok_or_else(|| {
                    format!(
                        "Pending displaced publication is missing its expected postimage for {}.",
                        entry.destination.display()
                    )
                })?;
            let publication_not_started =
                current.as_deref() == Some(expected_before) && displaced_hash.is_none();
            let publication_completed = current.as_deref() == Some(expected_after)
                && displaced_hash.as_deref() == Some(expected_before);
            if !publication_not_started && !publication_completed {
                return Err(format!(
                    "Pending displaced publication is not safely recoverable for {} (expected_before={expected_before}, expected_after={expected_after}, target={current:?}, displaced={displaced_hash:?}).",
                    entry.destination.display()
                ));
            }
            changed = true;
        }
        if changed {
            for entry in &mut self.entries {
                if entry.displaced_publication_pending {
                    entry.displaced_publication_pending = false;
                    entry.displaced_publication_expected_before_sha256 = None;
                    entry.displaced_publication_expected_after_sha256 = None;
                }
            }
            self.persist_manifest(phase)?;
        }
        Ok(())
    }

    fn rollback_entry_durably(&mut self, index: usize) -> Result<(), String> {
        let intent = self.prepare_rollback_publication_intent(index)?;
        if intent {
            self.persist_manifest(JournalPhase::RollingBack)?;
        }
        let result = rollback_entry(&self.journal_root, &self.entries[index], index);
        if let Err(error) = result {
            return Err(error);
        }
        if intent {
            let before = self.entries[index]
                .displaced_publication_expected_before_sha256
                .clone();
            let after = self.entries[index]
                .displaced_publication_expected_after_sha256
                .clone();
            self.entries[index].displaced_publication_pending = false;
            self.entries[index].displaced_publication_expected_before_sha256 = None;
            self.entries[index].displaced_publication_expected_after_sha256 = None;
            if let Err(error) = self.persist_manifest(JournalPhase::RollingBack) {
                self.entries[index].displaced_publication_pending = true;
                self.entries[index].displaced_publication_expected_before_sha256 = before;
                self.entries[index].displaced_publication_expected_after_sha256 = after;
                return Err(error);
            }
        }
        Ok(())
    }

    fn prepare_rollback_publication_intent(&mut self, index: usize) -> Result<bool, String> {
        let current =
            snapshot_hash(&self.entries[index].destination).map_err(|error| error.message)?;
        let Some(original) = self.entries[index].original_sha256.clone() else {
            return Ok(false);
        };
        if current.as_deref() == Some(original.as_str())
            || !self.entries[index].owned_postimages.contains(&current)
        {
            return Ok(false);
        }
        let Some(before) = current else {
            return Ok(false);
        };
        if self.entries[index].displaced_publication_pending {
            return Err(format!(
                "Rollback entry already has an unresolved displaced publication: {}",
                self.entries[index].destination.display()
            ));
        }
        self.entries[index].displaced_publication_pending = true;
        self.entries[index].displaced_publication_expected_before_sha256 = Some(before);
        self.entries[index].displaced_publication_expected_after_sha256 = Some(original);
        Ok(true)
    }

    #[cfg(test)]
    pub(super) fn fail_next_persist(&self, phase: JournalPhase) {
        self.fail_next_persist.set(Some(phase));
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
            displaced_publication_pending: false,
            displaced_publication_expected_before_sha256: None,
            displaced_publication_expected_after_sha256: None,
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

fn rollback_entry(
    journal_root: &Path,
    entry: &JournalEntry,
    entry_index: usize,
) -> Result<(), String> {
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
            let replacement =
                replacement_path(journal_root, &entry.destination, entry_index, "rollback");
            let replacement = replacement.map_err(|error| error.message)?;
            let displaced =
                replacement_path(journal_root, &entry.destination, entry_index, "displaced")
                    .map_err(|error| error.message)?;
            let mutation = destination.overwrite_from(
                &mut source,
                permissions,
                &replacement,
                Some(&displaced),
                expected,
            );
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
    preparation_root: &Path,
    entry_count: usize,
    error: String,
) -> StorageError {
    match remove_preparation_root(install_root, preparation_root, entry_count) {
        Ok(()) => StorageError::new(error),
        Err(cleanup_error) => StorageError::with_residual(
            error,
            CleanupResidual {
                paths: vec![preparation_root.to_path_buf()],
                detail: format!("Could not clean incomplete preparation: {cleanup_error}"),
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
