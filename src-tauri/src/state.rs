/**
 * [INPUT]: 依赖 serde_json 与 state 目录，读取/写入 Tauri state.json；旧版本状态保持顶层 camelCase 兼容。
 * [OUTPUT]: 对外提供 State、严格 EnglishSnapshotProvenance、带 schema/generation/operationId 的 StateDocument、诊断读取、last-known-good 恢复、StateControlReport/StateControlError、typed commit outcome 与显式目录 durability reconfirm。
 * [POS]: src-tauri/src 的状态模块；state.json 是控制面事实，任何新状态都先落盘、fsync、保留 prev 后再原子切换；Windows 以可写 handle 刷新普通文件，rename 后的耐久化问题只能投影为 committed warning，并由显式 retry 重新 fsync；控制 API 不丢 recovery_diagnostic 或 warning。
 * [FAIL-CLOSED]: 当前/last-known-good state 损坏、generation identity 未绑定 installRoot/immutableRevision、部分存在或非小写 SHA-256 时拒绝读写；调用方应消费 strict read、StateControlReport 与 StateCommitOutcome。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
use serde::{Deserialize, Serialize};
#[cfg(unix)]
use std::fs::File;
use std::{
    fmt,
    fs::{self, OpenOptions},
    io::{self, Write},
    path::{Path, PathBuf},
    sync::atomic::{AtomicU64, Ordering},
    time::{SystemTime, UNIX_EPOCH},
};

#[cfg(unix)]
use std::os::unix::fs::{OpenOptionsExt, PermissionsExt};

pub const STATE_SCHEMA_VERSION: u32 = 2;
pub const LEGACY_STATE_SCHEMA_VERSION: u32 = 1;
const STATE_FILE_NAME: &str = "state.json";
const STATE_PREVIOUS_FILE_NAME: &str = "state.json.prev";

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct EnglishSnapshotProvenance {
    pub install_root: String,
    pub immutable_revision: String,
    /// Immutable JSON generation selected by the durable state commit. Older documents omit it
    /// and are migrated only after their complete snapshot is revalidated.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub snapshot_generation: Option<String>,
    /// SHA-256 of the exact path/hash English manifest in `snapshot_generation`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub snapshot_manifest_sha256: Option<String>,
    /// macOS-only combined vendor baseline (runtime bytes + vendor signature + English manifest).
    /// Windows snapshots deliberately leave this unset.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub vendor_baseline_id: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct State {
    pub app_path: String,
    pub cavalry_version: String,
    #[serde(default)]
    pub cavalry_revision: String,
    pub current_lang: String,
    pub last_patched_at: String,
    #[serde(default)]
    pub english_snapshot_provenance: Option<EnglishSnapshotProvenance>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum StateWriteWarning {
    /// `state.json` has already been atomically renamed into place. The warning therefore cannot
    /// be represented as an uncommitted error without lying about the visible filesystem state.
    DirectorySyncAfterCommit { directory: PathBuf, detail: String },
}

impl fmt::Display for StateWriteWarning {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::DirectorySyncAfterCommit { directory, detail } => write!(
                formatter,
                "state generation is committed, but the state directory {} could not be fsynced: {detail}",
                directory.display()
            ),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum StateWriteOutcome {
    Committed {
        state: State,
    },
    CommittedWithWarning {
        state: State,
        warning: StateWriteWarning,
    },
}

/// Stable name for the commit result consumed by control-plane callers.  The historical
/// `StateWriteOutcome` spelling remains available for compatibility.
pub type StateCommitOutcome = StateWriteOutcome;

impl StateWriteOutcome {
    pub fn state(&self) -> &State {
        match self {
            Self::Committed { state } | Self::CommittedWithWarning { state, .. } => state,
        }
    }

    pub fn warning(&self) -> Option<&StateWriteWarning> {
        match self {
            Self::Committed { .. } => None,
            Self::CommittedWithWarning { warning, .. } => Some(warning),
        }
    }

    pub fn into_state(self) -> State {
        match self {
            Self::Committed { state } | Self::CommittedWithWarning { state, .. } => state,
        }
    }
}

impl Default for State {
    fn default() -> Self {
        Self {
            app_path: String::new(),
            cavalry_version: String::new(),
            cavalry_revision: String::new(),
            current_lang: "en".to_string(),
            last_patched_at: String::new(),
            english_snapshot_provenance: None,
        }
    }
}

/// A persisted state document. State deliberately remains the renderer/API DTO so existing Rust
/// callers can continue constructing it with struct literals; persistence metadata lives in this
/// envelope and is flattened into the historical top-level JSON shape.
#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct StateDocument {
    pub schema_version: u32,
    pub generation: u64,
    pub operation_id: String,
    #[serde(flatten)]
    pub state: State,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_known_good: Option<LastKnownGoodState>,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct LastKnownGoodState {
    pub generation: u64,
    pub operation_id: String,
    #[serde(flatten)]
    pub state: State,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum StateReadSource {
    Current,
    Previous,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum StateControlSource {
    Current,
    Previous,
    Default,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct StateReadReport {
    pub document: StateDocument,
    pub source: StateReadSource,
    /// Present when a valid previous generation was used because state.json was unavailable or
    /// invalid. This is intentionally surfaced instead of silently returning a default State.
    pub recovery_diagnostic: Option<String>,
}

/// Typed control-path result.  A previous-generation recovery is never reduced to a bare State:
/// callers can display/record the read diagnostic and still observe whether promotion committed
/// normally or only with a post-rename directory-sync warning.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct StateControlReport {
    pub state: State,
    pub source: StateControlSource,
    pub recovery_diagnostic: Option<String>,
    pub recovery_commit: Option<StateCommitOutcome>,
}

impl StateControlReport {
    pub fn state(&self) -> &State {
        &self.state
    }

    pub fn recovery_warning(&self) -> Option<&StateWriteWarning> {
        self.recovery_commit
            .as_ref()
            .and_then(StateCommitOutcome::warning)
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum StateReadError {
    Missing {
        path: PathBuf,
    },
    Io {
        path: PathBuf,
        detail: String,
    },
    Corrupt {
        path: PathBuf,
        detail: String,
        previous_path: PathBuf,
    },
    UnsupportedSchema {
        path: PathBuf,
        found: u32,
        supported: u32,
    },
    RecoveryFailed {
        current: Box<StateReadError>,
        previous: Box<StateReadError>,
    },
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum StateControlError {
    Read(StateReadError),
    RecoveryCommit {
        recovery_diagnostic: String,
        detail: String,
    },
}

impl fmt::Display for StateControlError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Read(error) => write!(
                formatter,
                "could not load durable application state: {error}"
            ),
            Self::RecoveryCommit {
                recovery_diagnostic,
                detail,
            } => write!(
                formatter,
                "state recovery commit failed after diagnostic {recovery_diagnostic}: {detail}"
            ),
        }
    }
}

impl std::error::Error for StateControlError {}

impl fmt::Display for StateReadError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Missing { path } => {
                write!(formatter, "state file is missing: {}", path.display())
            }
            Self::Io { path, detail } => {
                write!(
                    formatter,
                    "could not read state file {}: {detail}",
                    path.display()
                )
            }
            Self::Corrupt {
                path,
                detail,
                previous_path,
            } => write!(
                formatter,
                "state file {} is corrupt: {detail}; a previous generation may be available at {}",
                path.display(),
                previous_path.display()
            ),
            Self::UnsupportedSchema {
                path,
                found,
                supported,
            } => write!(
                formatter,
                "state file {} uses unsupported schema {found}; supported through {supported}",
                path.display()
            ),
            Self::RecoveryFailed { current, previous } => write!(
                formatter,
                "state recovery failed; current: {current}; previous: {previous}"
            ),
        }
    }
}

impl std::error::Error for StateReadError {}

pub fn normalize(mut state: State) -> State {
    if !matches!(
        state.current_lang.as_str(),
        "en" | "zh-Hans" | "zh-Hant" | "ja_JP"
    ) {
        state.current_lang = "en".to_string();
    }
    state
}

fn validate_state_payload(state: &State) -> Result<(), String> {
    let Some(provenance) = state.english_snapshot_provenance.as_ref() else {
        return Ok(());
    };
    let has_generation_identity = provenance.snapshot_generation.is_some()
        || provenance.snapshot_manifest_sha256.is_some()
        || provenance.vendor_baseline_id.is_some();
    if has_generation_identity && provenance.install_root.trim().is_empty() {
        return Err(
            "English snapshot provenance installRoot must be non-empty when a generation identity is present"
                .to_string(),
        );
    }
    if has_generation_identity && provenance.immutable_revision.trim().is_empty() {
        return Err(
            "English snapshot provenance immutableRevision must be non-empty when a generation identity is present"
                .to_string(),
        );
    }
    match (
        provenance.snapshot_generation.as_deref(),
        provenance.snapshot_manifest_sha256.as_deref(),
        provenance.vendor_baseline_id.as_deref(),
    ) {
        // Historical snapshot provenance predates immutable generation identities.
        (None, None, None) => Ok(()),
        // Windows binds the JSON generation and exact English manifest.
        (Some(generation), Some(manifest), None) => {
            validate_sha256("snapshotGeneration", generation)?;
            validate_sha256("snapshotManifestSha256", manifest)
        }
        // macOS additionally binds that JSON generation to one complete vendor baseline.
        (Some(generation), Some(manifest), Some(vendor_baseline)) => {
            validate_sha256("snapshotGeneration", generation)?;
            validate_sha256("snapshotManifestSha256", manifest)?;
            validate_sha256("vendorBaselineId", vendor_baseline)
        }
        _ => Err(
            "English snapshot provenance identity fields must be all absent (legacy), generation + manifest (Windows), or generation + manifest + vendor baseline (macOS)"
                .to_string(),
        ),
    }
}

fn validate_sha256(field: &str, value: &str) -> Result<(), String> {
    if value.len() == 64
        && value
            .bytes()
            .all(|byte| byte.is_ascii_digit() || matches!(byte, b'a'..=b'f'))
    {
        Ok(())
    } else {
        Err(format!(
            "English snapshot provenance {field} must be a 64-character lowercase SHA-256"
        ))
    }
}

/// Read only the current generation and return an explicit diagnostic on corruption or missing
/// data. This is the strict entry point for command/control paths.
pub fn read_state_strict(state_dir: &Path) -> Result<State, StateReadError> {
    Ok(read_state_document(state_dir)?.state)
}

pub fn read_state_document(state_dir: &Path) -> Result<StateDocument, StateReadError> {
    read_document_at(&state_dir.join(STATE_FILE_NAME))
}

/// Read current state, falling back only to a valid same-directory previous generation. The
/// report keeps the recovery source and the current-file diagnostic visible to the caller.
pub fn read_state_with_recovery(state_dir: &Path) -> Result<StateReadReport, StateReadError> {
    let current_path = state_dir.join(STATE_FILE_NAME);
    match read_document_at(&current_path) {
        Ok(document) => Ok(StateReadReport {
            document,
            source: StateReadSource::Current,
            recovery_diagnostic: None,
        }),
        Err(current_error @ StateReadError::UnsupportedSchema { .. }) => Err(current_error),
        Err(current_error) => {
            let previous_path = state_dir.join(STATE_PREVIOUS_FILE_NAME);
            match read_document_at(&previous_path) {
                Ok(document) => Ok(StateReadReport {
                    document,
                    source: StateReadSource::Previous,
                    recovery_diagnostic: Some(current_error.to_string()),
                }),
                Err(previous_error) => Err(StateReadError::RecoveryFailed {
                    current: Box::new(current_error),
                    previous: Box::new(previous_error),
                }),
            }
        }
    }
}

/// Load state for a control or mutation path. A missing first-run state is the only condition
/// that becomes the default. If current is damaged/missing and prev is valid, prev is atomically
/// promoted before the caller proceeds; unsupported future schemas and double corruption fail.
pub fn read_state_for_control_report(
    state_dir: &Path,
) -> Result<StateControlReport, StateControlError> {
    match read_state_with_recovery(state_dir) {
        Ok(report) if report.source == StateReadSource::Current => Ok(StateControlReport {
            state: report.document.state,
            source: StateControlSource::Current,
            recovery_diagnostic: report.recovery_diagnostic,
            recovery_commit: None,
        }),
        Ok(report) => {
            let recovery_diagnostic = report.recovery_diagnostic.clone().unwrap_or_else(|| {
                "state control path recovered from the previous generation".to_string()
            });
            match publish_recovered_document(state_dir, &report.document) {
                Ok(commit) => Ok(StateControlReport {
                    state: commit.state().clone(),
                    source: StateControlSource::Previous,
                    recovery_diagnostic: Some(recovery_diagnostic),
                    recovery_commit: Some(commit),
                }),
                Err(detail) => Err(StateControlError::RecoveryCommit {
                    recovery_diagnostic,
                    detail,
                }),
            }
        }
        Err(StateReadError::RecoveryFailed { current, previous })
            if matches!(*current, StateReadError::Missing { .. })
                && matches!(*previous, StateReadError::Missing { .. }) =>
        {
            Ok(StateControlReport {
                state: State::default(),
                source: StateControlSource::Default,
                recovery_diagnostic: None,
                recovery_commit: None,
            })
        }
        Err(error) => Err(StateControlError::Read(error)),
    }
}

/// Compatibility API retained for existing callers. New control paths should consume
/// [`read_state_for_control_report`] so recovery diagnostics and post-commit warnings remain
/// visible to the caller.
pub fn read_state_for_control(state_dir: &Path) -> Result<State, String> {
    read_state_for_control_report(state_dir)
        .map(|report| report.state)
        .map_err(|error| error.to_string())
}

/// Compatibility API retained for older callers. New code must use read_state_strict or
/// read_state_with_recovery so corruption is not mistaken for an empty/default state.
pub fn read_state(state_dir: &Path) -> Option<State> {
    read_state_strict(state_dir).ok()
}

pub fn write_state(state_dir: &Path, state: &State) -> Result<State, String> {
    write_state_outcome(state_dir, state).map(StateWriteOutcome::into_state)
}

/// Persist state while preserving the distinction between an uncommitted error and a warning
/// discovered after `state.json` has already become the visible committed generation.
pub fn write_state_outcome(state_dir: &Path, state: &State) -> Result<StateWriteOutcome, String> {
    let operation_id = new_operation_id();
    write_state_with_operation_outcome(state_dir, state, &operation_id)
}

/// Reconfirm the directory entry that made the current state generation visible. This is the
/// explicit retry path for a prior `DirectorySyncAfterCommit`: no state generation is rewritten,
/// but the same directory fsync is attempted again and remains a typed warning if it still fails.
pub fn confirm_state_directory_durability(
    state_dir: &Path,
) -> Result<Option<StateWriteWarning>, String> {
    confirm_state_directory_durability_using(state_dir, sync_directory)
}

fn confirm_state_directory_durability_using<F>(
    state_dir: &Path,
    sync: F,
) -> Result<Option<StateWriteWarning>, String>
where
    F: FnOnce(&Path) -> io::Result<()>,
{
    reject_unsafe_state_directory(state_dir)?;
    match sync(state_dir) {
        Ok(()) => Ok(None),
        Err(error) => Ok(Some(StateWriteWarning::DirectorySyncAfterCommit {
            directory: state_dir.to_path_buf(),
            detail: error.to_string(),
        })),
    }
}

/// Persist a normalized state using a caller-visible operation ID. The new document is fully
/// written and synced in the target directory before the old current file is copied to prev
/// and the new file is atomically renamed into state.json.
pub fn write_state_with_operation(
    state_dir: &Path,
    state: &State,
    operation_id: &str,
) -> Result<State, String> {
    write_state_with_operation_outcome(state_dir, state, operation_id)
        .map(StateWriteOutcome::into_state)
}

/// Operation-ID variant of [`write_state_outcome`]. Existing callers may continue using
/// `write_state_with_operation`; callers that must surface post-commit durability diagnostics
/// should consume this typed outcome instead.
pub fn write_state_with_operation_outcome(
    state_dir: &Path,
    state: &State,
    operation_id: &str,
) -> Result<StateWriteOutcome, String> {
    write_state_with_operation_using(state_dir, state, operation_id, |path, _point| {
        sync_directory(path)
    })
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum DirectorySyncPoint {
    PreviousPublished,
    CurrentPublished,
}

fn write_state_with_operation_using<F>(
    state_dir: &Path,
    state: &State,
    operation_id: &str,
    mut sync: F,
) -> Result<StateWriteOutcome, String>
where
    F: FnMut(&Path, DirectorySyncPoint) -> io::Result<()>,
{
    validate_operation_id(operation_id)?;
    let next_state = normalize(state.clone());
    validate_state_payload(&next_state)?;
    fs::create_dir_all(state_dir).map_err(|error| {
        format!(
            "could not create state directory {}: {error}",
            state_dir.display()
        )
    })?;
    reject_unsafe_state_directory(state_dir)?;

    let state_path = state_dir.join(STATE_FILE_NAME);
    let previous_path = state_dir.join(STATE_PREVIOUS_FILE_NAME);
    let previous_document = match read_document_at(&state_path) {
        Ok(document) => Some(document),
        Err(StateReadError::Missing { .. }) => match read_document_at(&previous_path) {
            Ok(document) => Some(document),
            Err(StateReadError::Missing { .. }) => None,
            Err(error) => {
                return Err(format!(
                    "refusing to overwrite a damaged previous state document: {error}"
                ));
            }
        },
        Err(error) => {
            return Err(format!(
                "refusing to overwrite a damaged state document: {error}"
            ));
        }
    };

    let generation = previous_document
        .as_ref()
        .map(|document| {
            document
                .generation
                .checked_add(1)
                .ok_or_else(|| "state generation overflow".to_string())
        })
        .transpose()?
        .unwrap_or(1);
    let last_known_good = previous_document
        .as_ref()
        .map(|document| LastKnownGoodState {
            generation: document.generation,
            operation_id: document.operation_id.clone(),
            state: document.state.clone(),
        })
        .or_else(|| {
            Some(LastKnownGoodState {
                generation,
                operation_id: operation_id.to_string(),
                state: next_state.clone(),
            })
        });
    let document = StateDocument {
        schema_version: STATE_SCHEMA_VERSION,
        generation,
        operation_id: operation_id.to_string(),
        state: next_state.clone(),
        last_known_good,
    };
    let payload = serde_json::to_vec_pretty(&document).map_err(|error| error.to_string())?;

    let temp_path = state_dir.join(format!(".{STATE_FILE_NAME}.{operation_id}.tmp"));
    write_synced_temp(&temp_path, &payload)?;

    if state_path.is_file() {
        let previous_temp =
            state_dir.join(format!(".{STATE_PREVIOUS_FILE_NAME}.{operation_id}.tmp"));
        if let Err(error) = preserve_file(&state_path, &previous_temp, &previous_path) {
            let _ = fs::remove_file(&temp_path);
            return Err(error);
        }
        sync(state_dir, DirectorySyncPoint::PreviousPublished).map_err(|error| {
            let _ = fs::remove_file(&temp_path);
            format!("could not fsync state directory after preserving prev: {error}")
        })?;
    }

    if let Err(error) = atomic_replace(&temp_path, &state_path) {
        let _ = fs::remove_file(&temp_path);
        return Err(format!(
            "could not atomically publish state generation {generation}: {error}"
        ));
    }
    match sync(state_dir, DirectorySyncPoint::CurrentPublished) {
        Ok(()) => Ok(StateWriteOutcome::Committed { state: next_state }),
        Err(error) => Ok(StateWriteOutcome::CommittedWithWarning {
            state: next_state,
            warning: StateWriteWarning::DirectorySyncAfterCommit {
                directory: state_dir.to_path_buf(),
                detail: error.to_string(),
            },
        }),
    }
}

fn read_document_at(path: &Path) -> Result<StateDocument, StateReadError> {
    let metadata = fs::symlink_metadata(path).map_err(|error| match error.kind() {
        io::ErrorKind::NotFound => StateReadError::Missing {
            path: path.to_path_buf(),
        },
        _ => StateReadError::Io {
            path: path.to_path_buf(),
            detail: error.to_string(),
        },
    })?;
    if metadata.file_type().is_symlink() || !metadata.is_file() {
        return Err(StateReadError::Io {
            path: path.to_path_buf(),
            detail: "refusing a symlink or non-regular state document".to_string(),
        });
    }
    let bytes = fs::read(path).map_err(|error| match error.kind() {
        io::ErrorKind::NotFound => StateReadError::Missing {
            path: path.to_path_buf(),
        },
        _ => StateReadError::Io {
            path: path.to_path_buf(),
            detail: error.to_string(),
        },
    })?;
    decode_document(&bytes, path)
}

fn decode_document(bytes: &[u8], path: &Path) -> Result<StateDocument, StateReadError> {
    let value = serde_json::from_slice::<serde_json::Value>(bytes).map_err(|error| {
        StateReadError::Corrupt {
            path: path.to_path_buf(),
            detail: error.to_string(),
            previous_path: path.with_file_name(STATE_PREVIOUS_FILE_NAME),
        }
    })?;
    let object = value.as_object().ok_or_else(|| StateReadError::Corrupt {
        path: path.to_path_buf(),
        detail: "top-level JSON value must be an object".to_string(),
        previous_path: path.with_file_name(STATE_PREVIOUS_FILE_NAME),
    })?;

    let schema_version = match object.get("schemaVersion") {
        None => LEGACY_STATE_SCHEMA_VERSION,
        Some(value) => value
            .as_u64()
            .and_then(|value| u32::try_from(value).ok())
            .ok_or_else(|| StateReadError::Corrupt {
                path: path.to_path_buf(),
                detail: "schemaVersion must be an unsigned integer".to_string(),
                previous_path: path.with_file_name(STATE_PREVIOUS_FILE_NAME),
            })?,
    };
    if schema_version == 0 {
        return Err(StateReadError::Corrupt {
            path: path.to_path_buf(),
            detail: "schemaVersion must be at least 1".to_string(),
            previous_path: path.with_file_name(STATE_PREVIOUS_FILE_NAME),
        });
    }
    if schema_version > STATE_SCHEMA_VERSION {
        return Err(StateReadError::UnsupportedSchema {
            path: path.to_path_buf(),
            found: schema_version,
            supported: STATE_SCHEMA_VERSION,
        });
    }

    let generation = match object.get("generation") {
        None => 0,
        Some(value) => value.as_u64().ok_or_else(|| StateReadError::Corrupt {
            path: path.to_path_buf(),
            detail: "generation must be an unsigned integer".to_string(),
            previous_path: path.with_file_name(STATE_PREVIOUS_FILE_NAME),
        })?,
    };
    if schema_version >= STATE_SCHEMA_VERSION && generation == 0 {
        return Err(StateReadError::Corrupt {
            path: path.to_path_buf(),
            detail: "schema 2 generation must be positive".to_string(),
            previous_path: path.with_file_name(STATE_PREVIOUS_FILE_NAME),
        });
    }
    let operation_id = match object.get("operationId") {
        Some(value) => value
            .as_str()
            .filter(|value| validate_operation_id(value).is_ok())
            .ok_or_else(|| StateReadError::Corrupt {
                path: path.to_path_buf(),
                detail: "operationId is not filename-safe".to_string(),
                previous_path: path.with_file_name(STATE_PREVIOUS_FILE_NAME),
            })?
            .to_string(),
        None if schema_version < STATE_SCHEMA_VERSION => "legacy".to_string(),
        None => {
            return Err(StateReadError::Corrupt {
                path: path.to_path_buf(),
                detail: "schema 2 state has no operationId".to_string(),
                previous_path: path.with_file_name(STATE_PREVIOUS_FILE_NAME),
            });
        }
    };

    let state = serde_json::from_value::<State>(value.clone()).map_err(|error| {
        StateReadError::Corrupt {
            path: path.to_path_buf(),
            detail: format!("state payload is invalid: {error}"),
            previous_path: path.with_file_name(STATE_PREVIOUS_FILE_NAME),
        }
    })?;
    if !is_supported_language(&state.current_lang) {
        return Err(StateReadError::Corrupt {
            path: path.to_path_buf(),
            detail: format!("unsupported currentLang value: {:?}", state.current_lang),
            previous_path: path.with_file_name(STATE_PREVIOUS_FILE_NAME),
        });
    }
    validate_state_payload(&state).map_err(|detail| StateReadError::Corrupt {
        path: path.to_path_buf(),
        detail: format!("state snapshot provenance is invalid: {detail}"),
        previous_path: path.with_file_name(STATE_PREVIOUS_FILE_NAME),
    })?;
    let last_known_good = object
        .get("lastKnownGood")
        .cloned()
        .map(|value| serde_json::from_value::<LastKnownGoodState>(value))
        .transpose()
        .map_err(|error| StateReadError::Corrupt {
            path: path.to_path_buf(),
            detail: format!("lastKnownGood is invalid: {error}"),
            previous_path: path.with_file_name(STATE_PREVIOUS_FILE_NAME),
        })?;
    if schema_version >= STATE_SCHEMA_VERSION && last_known_good.is_none() {
        return Err(StateReadError::Corrupt {
            path: path.to_path_buf(),
            detail: "schema 2 state has no lastKnownGood generation".to_string(),
            previous_path: path.with_file_name(STATE_PREVIOUS_FILE_NAME),
        });
    }
    if let Some(last_known_good) = &last_known_good {
        if last_known_good.generation > generation
            || validate_operation_id(&last_known_good.operation_id).is_err()
            || !is_supported_language(&last_known_good.state.current_lang)
        {
            return Err(StateReadError::Corrupt {
                path: path.to_path_buf(),
                detail: "lastKnownGood metadata is inconsistent".to_string(),
                previous_path: path.with_file_name(STATE_PREVIOUS_FILE_NAME),
            });
        }
        validate_state_payload(&last_known_good.state).map_err(|detail| {
            StateReadError::Corrupt {
                path: path.to_path_buf(),
                detail: format!("lastKnownGood snapshot provenance is invalid: {detail}"),
                previous_path: path.with_file_name(STATE_PREVIOUS_FILE_NAME),
            }
        })?;
    }

    Ok(StateDocument {
        schema_version,
        generation,
        operation_id,
        state,
        last_known_good,
    })
}

fn write_synced_temp(path: &Path, payload: &[u8]) -> Result<(), String> {
    let mut options = OpenOptions::new();
    options.write(true).create_new(true);
    #[cfg(unix)]
    options.mode(0o600);
    let mut file = options
        .open(path)
        .map_err(|error| format!("could not create state temp {}: {error}", path.display()))?;
    if let Err(error) = file.write_all(payload).and_then(|_| file.sync_all()) {
        let _ = fs::remove_file(path);
        return Err(format!(
            "could not sync state temp {}: {error}",
            path.display()
        ));
    }
    Ok(())
}

fn preserve_file(source: &Path, temp: &Path, destination: &Path) -> Result<(), String> {
    let _ = fs::remove_file(temp);
    fs::copy(source, temp).map_err(|error| {
        format!(
            "could not copy current state {} to prev temp {}: {error}",
            source.display(),
            temp.display()
        )
    })?;
    #[cfg(unix)]
    fs::set_permissions(temp, fs::Permissions::from_mode(0o600)).map_err(|error| {
        format!(
            "could not protect previous state temp {}: {error}",
            temp.display()
        )
    })?;
    sync_file(temp).map_err(|error| {
        format!(
            "could not sync previous state temp {}: {error}",
            temp.display()
        )
    })?;
    if let Err(error) = atomic_replace(temp, destination) {
        let _ = fs::remove_file(temp);
        return Err(format!(
            "could not publish previous state {}: {error}",
            destination.display()
        ));
    }
    Ok(())
}

fn atomic_replace(source: &Path, destination: &Path) -> io::Result<()> {
    #[cfg(windows)]
    if destination.exists() {
        // The source is already durable. Removing the old destination is the only Windows
        // fallback available without a replace-file API; the current state remains untouched
        // when this is used for prev, and the new state temp is never removed before rename.
        fs::remove_file(destination)?;
    }
    fs::rename(source, destination)
}

fn sync_directory(path: &Path) -> io::Result<()> {
    #[cfg(unix)]
    {
        File::open(path)?.sync_all()
    }
    #[cfg(not(unix))]
    {
        let _ = path;
        Ok(())
    }
}

fn sync_file(path: &Path) -> io::Result<()> {
    #[cfg(windows)]
    {
        OpenOptions::new().write(true).open(path)?.sync_all()
    }
    #[cfg(not(windows))]
    {
        File::open(path)?.sync_all()
    }
}

fn validate_operation_id(operation_id: &str) -> Result<(), String> {
    if operation_id.is_empty()
        || operation_id.len() > 128
        || !operation_id
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_' | b'.'))
    {
        return Err(format!(
            "invalid state operation ID; expected 1-128 ASCII filename-safe characters: {operation_id:?}"
        ));
    }
    Ok(())
}

fn is_supported_language(value: &str) -> bool {
    matches!(value, "en" | "zh-Hans" | "zh-Hant" | "ja_JP")
}

fn reject_unsafe_state_directory(state_dir: &Path) -> Result<(), String> {
    let metadata = fs::symlink_metadata(state_dir).map_err(|error| {
        format!(
            "could not inspect state directory {}: {error}",
            state_dir.display()
        )
    })?;
    if metadata.file_type().is_symlink() || !metadata.is_dir() {
        return Err(format!(
            "refusing symlink or non-directory state root {}",
            state_dir.display()
        ));
    }
    #[cfg(unix)]
    fs::set_permissions(state_dir, fs::Permissions::from_mode(0o700)).map_err(|error| {
        format!(
            "could not protect state directory {}: {error}",
            state_dir.display()
        )
    })?;
    Ok(())
}

fn publish_recovered_document(
    state_dir: &Path,
    document: &StateDocument,
) -> Result<StateWriteOutcome, String> {
    reject_unsafe_state_directory(state_dir)?;
    let operation_id = new_operation_id();
    let payload = serde_json::to_vec_pretty(document).map_err(|error| error.to_string())?;
    let temporary = state_dir.join(format!(".{STATE_FILE_NAME}.{operation_id}.recovery.tmp"));
    write_synced_temp(&temporary, &payload)?;
    if let Err(error) = atomic_replace(&temporary, &state_dir.join(STATE_FILE_NAME)) {
        let _ = fs::remove_file(&temporary);
        return Err(format!(
            "could not publish recovered state generation: {error}"
        ));
    }
    match sync_directory(state_dir) {
        Ok(()) => Ok(StateWriteOutcome::Committed {
            state: document.state.clone(),
        }),
        Err(error) => Ok(StateWriteOutcome::CommittedWithWarning {
            state: document.state.clone(),
            warning: StateWriteWarning::DirectorySyncAfterCommit {
                directory: state_dir.to_path_buf(),
                detail: error.to_string(),
            },
        }),
    }
}

pub(crate) fn state_transaction_paths(state_dir: &Path) -> [PathBuf; 2] {
    [
        state_dir.join(STATE_FILE_NAME),
        state_dir.join(STATE_PREVIOUS_FILE_NAME),
    ]
}

pub(crate) fn state_transaction_temporary_paths(
    state_dir: &Path,
    operation_id: &str,
) -> [PathBuf; 2] {
    [
        state_dir.join(format!(".{STATE_FILE_NAME}.{operation_id}.tmp")),
        state_dir.join(format!(".{STATE_PREVIOUS_FILE_NAME}.{operation_id}.tmp")),
    ]
}

pub(crate) fn new_operation_id() -> String {
    static NEXT_OPERATION: AtomicU64 = AtomicU64::new(1);
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    let sequence = NEXT_OPERATION.fetch_add(1, Ordering::Relaxed);
    format!("{now:x}-{:x}-{sequence:x}", std::process::id())
}

#[cfg(test)]
mod tests {
    use super::{
        confirm_state_directory_durability_using, normalize, read_state_strict, sync_file,
        write_state_with_operation_using, DirectorySyncPoint, State, StateWriteOutcome,
        StateWriteWarning,
    };
    use std::io;

    #[test]
    fn normalize_state_defaults_to_english() {
        let state = normalize(State {
            current_lang: "bad".into(),
            ..State::default()
        });
        assert_eq!(state.current_lang, "en");
    }

    #[cfg(windows)]
    #[test]
    fn windows_file_durability_uses_a_write_capable_handle() {
        let temp = tempfile::tempdir().unwrap();
        let path = temp.path().join("state-temp.json");
        std::fs::write(&path, b"durable").unwrap();

        sync_file(&path).expect("FlushFileBuffers requires a write-capable Windows handle");
    }

    #[test]
    fn strict_missing_state_is_not_a_default() {
        let temp = tempfile::tempdir().unwrap();
        let error = read_state_strict(temp.path()).unwrap_err();
        assert!(error.to_string().contains("state file is missing"));
    }

    #[test]
    fn directory_sync_failure_after_state_rename_is_a_committed_warning() {
        let temp = tempfile::tempdir().unwrap();
        let expected = State {
            current_lang: "zh-Hans".to_string(),
            ..State::default()
        };

        let outcome = write_state_with_operation_using(
            temp.path(),
            &expected,
            "fault-after-current-rename",
            |_path, point| {
                assert_eq!(point, DirectorySyncPoint::CurrentPublished);
                Err(io::Error::new(
                    io::ErrorKind::Other,
                    "injected directory fsync failure",
                ))
            },
        )
        .expect("a post-rename durability failure must not be reported as uncommitted");

        match outcome {
            StateWriteOutcome::CommittedWithWarning { state, warning } => {
                assert_eq!(state, expected);
                assert!(matches!(
                    warning,
                    StateWriteWarning::DirectorySyncAfterCommit { ref detail, .. }
                        if detail.contains("injected directory fsync failure")
                ));
            }
            StateWriteOutcome::Committed { .. } => {
                panic!("the injected post-commit failure must remain observable")
            }
        }
        assert_eq!(
            read_state_strict(temp.path()).unwrap(),
            expected,
            "state.json was already committed by the successful rename"
        );
    }

    #[test]
    fn explicit_retry_reconfirms_directory_without_rewriting_state() {
        let temp = tempfile::tempdir().unwrap();
        let warning = confirm_state_directory_durability_using(temp.path(), |_path| {
            Err(io::Error::new(
                io::ErrorKind::Other,
                "injected retry fsync failure",
            ))
        })
        .unwrap()
        .expect("failed durability retry must remain a warning");

        assert!(matches!(
            warning,
            StateWriteWarning::DirectorySyncAfterCommit { ref detail, .. }
                if detail.contains("injected retry fsync failure")
        ));
        assert!(temp.path().read_dir().unwrap().next().is_none());
        assert_eq!(
            confirm_state_directory_durability_using(temp.path(), |_path| Ok(())).unwrap(),
            None
        );
    }
}
