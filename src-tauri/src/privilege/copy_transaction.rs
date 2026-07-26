/**
 * [INPUT]: 依赖 CopyPair、CommandRunner，以及各平台管理员复制适配器；接收已 staging 的文件对。
 * [OUTPUT]: 提供可回滚的 direct copy、CopyOutcome 兼容投影、结构化 CopyFailure 与 PostCommitWarning。
 * [POS]: privilege 的文件事务核心；把恢复残留和提交后清理从字符串协议提升为可合并的内部诊断。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
use std::{
    collections::HashSet,
    fs,
    io::ErrorKind,
    path::{Path, PathBuf},
};

use crate::patch::CopyPair;

use super::{runner::is_permission_error, CommandRunner};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CopyOutcome {
    pub mode: String,
    pub warning: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum PostCommitWarningCode {
    DirectRecoveryResidual,
    TransactionBackupCleanup,
    ElevatedTransactionCleanup,
    ElevatedAdministratorCleanup,
    StagingCleanup,
}

impl PostCommitWarningCode {
    pub(crate) const fn stable_code(self) -> &'static str {
        match self {
            Self::DirectRecoveryResidual => "copy.direct-recovery-residual",
            Self::TransactionBackupCleanup => "copy.transaction-backup-cleanup",
            Self::ElevatedTransactionCleanup => "copy.elevated-transaction-cleanup",
            Self::ElevatedAdministratorCleanup => "copy.elevated-admin-cleanup",
            Self::StagingCleanup => "apply.staging-cleanup",
        }
    }
}

/// 仅在后端内部携带路径和基础设施细节；commands 将 code 映射为稳定 UI 文案，绝不将这些原始路径直接交给 renderer。
#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct PostCommitWarning {
    pub(crate) code: PostCommitWarningCode,
    pub(crate) paths: Vec<PathBuf>,
    pub(crate) detail: Option<String>,
}

impl PostCommitWarning {
    pub(crate) fn new(
        code: PostCommitWarningCode,
        paths: impl IntoIterator<Item = PathBuf>,
        detail: impl Into<Option<String>>,
    ) -> Self {
        let mut paths = paths.into_iter().collect::<Vec<_>>();
        paths.sort();
        paths.dedup();
        Self {
            code,
            paths,
            detail: detail.into(),
        }
    }

    pub(crate) fn stable_code(&self) -> &'static str {
        self.code.stable_code()
    }

    fn legacy_message(&self) -> String {
        let paths = self
            .paths
            .iter()
            .map(|path| path.display().to_string())
            .collect::<Vec<_>>()
            .join(", ");
        let detail = self.detail.as_deref().unwrap_or("unknown cleanup failure");
        match self.code {
            PostCommitWarningCode::DirectRecoveryResidual => format!(
                "Direct-copy recovery residuals before administrator retry: {detail}{}",
                if paths.is_empty() {
                    String::new()
                } else {
                    format!(" ({paths})")
                }
            ),
            PostCommitWarningCode::TransactionBackupCleanup => format!(
                "Language files were applied, but transaction backups could not be removed{}: {detail}. You can remove these files after closing Cavalry Language Switcher.",
                if paths.is_empty() { String::new() } else { format!(" from {paths}") }
            ),
            PostCommitWarningCode::ElevatedTransactionCleanup => format!(
                "Language files were applied, but administrator cleanup residuals remain{}: {detail}.",
                if paths.is_empty() { String::new() } else { format!(" beside {paths}") }
            ),
            PostCommitWarningCode::ElevatedAdministratorCleanup => format!(
                "Language files were applied, but parent temporary cleanup residuals remain{}: {detail}.",
                if paths.is_empty() { String::new() } else { format!(" at {paths}") }
            ),
            PostCommitWarningCode::StagingCleanup => format!(
                "Language files were applied, but staged temporary files could not be removed{}: {detail}. You can remove these files after closing Cavalry Language Switcher.",
                if paths.is_empty() { String::new() } else { format!(" from {paths}") }
            ),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) enum CopyDiagnostic {
    RecoveryResidual { paths: Vec<PathBuf>, detail: String },
}

impl CopyDiagnostic {
    fn recovery_warning(&self) -> PostCommitWarning {
        match self {
            Self::RecoveryResidual { paths, detail } => PostCommitWarning::new(
                PostCommitWarningCode::DirectRecoveryResidual,
                paths.clone(),
                Some(detail.clone()),
            ),
        }
    }

    fn legacy_message(&self) -> String {
        match self {
            Self::RecoveryResidual { paths, detail } => {
                let paths = paths
                    .iter()
                    .map(|path| path.display().to_string())
                    .collect::<Vec<_>>()
                    .join(", ");
                if paths.is_empty() {
                    format!("Recovery residuals remain: {detail}")
                } else {
                    format!("Recovery residuals remain at {paths}: {detail}")
                }
            }
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum CopyFailureKind {
    PermissionDenied,
    Other,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct CopyFailure {
    kind: CopyFailureKind,
    message: String,
    diagnostics: Vec<CopyDiagnostic>,
}

impl CopyFailure {
    pub(crate) fn other(message: impl Into<String>) -> Self {
        Self {
            kind: CopyFailureKind::Other,
            message: message.into(),
            diagnostics: Vec::new(),
        }
    }

    pub(crate) fn permission(message: impl Into<String>) -> Self {
        Self {
            kind: CopyFailureKind::PermissionDenied,
            message: message.into(),
            diagnostics: Vec::new(),
        }
    }

    pub(crate) fn from_io(context: impl Into<String>, error: &std::io::Error) -> Self {
        let message = format!("{}: {error}", context.into());
        if error.kind() == ErrorKind::PermissionDenied || is_permission_error(&message) {
            Self::permission(message)
        } else {
            Self::other(message)
        }
    }

    pub(crate) fn allows_administrator_retry(&self) -> bool {
        self.kind == CopyFailureKind::PermissionDenied
    }

    pub(crate) fn with_recovery_residual(
        mut self,
        paths: impl IntoIterator<Item = PathBuf>,
        detail: impl Into<String>,
    ) -> Self {
        let mut paths = paths.into_iter().collect::<Vec<_>>();
        paths.sort();
        paths.dedup();
        self.diagnostics.push(CopyDiagnostic::RecoveryResidual {
            paths,
            detail: detail.into(),
        });
        self
    }

    pub(crate) fn merge_administrator_failure(mut self, administrator: Self) -> Self {
        self.message = format!(
            "Permission denied while writing Cavalry assets; administrator copy failed: {}",
            administrator.message
        );
        self.kind = CopyFailureKind::Other;
        self.diagnostics.extend(administrator.diagnostics);
        self
    }

    pub(crate) fn recovery_warnings(&self) -> Vec<PostCommitWarning> {
        self.diagnostics
            .iter()
            .map(CopyDiagnostic::recovery_warning)
            .collect()
    }

    pub(crate) fn display(&self) -> String {
        if self.diagnostics.is_empty() {
            self.message.clone()
        } else {
            format!(
                "{}. {}",
                self.message,
                self.diagnostics
                    .iter()
                    .map(CopyDiagnostic::legacy_message)
                    .collect::<Vec<_>>()
                    .join(" ")
            )
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct CopyCompletion {
    pub(crate) mode: String,
    pub(crate) warnings: Vec<PostCommitWarning>,
}

impl CopyCompletion {
    pub(crate) fn new(mode: impl Into<String>) -> Self {
        Self {
            mode: mode.into(),
            warnings: Vec::new(),
        }
    }

    pub(crate) fn with_warning(mut self, warning: PostCommitWarning) -> Self {
        self.warnings.push(warning);
        self
    }

    pub(crate) fn extend_warnings(
        mut self,
        warnings: impl IntoIterator<Item = PostCommitWarning>,
    ) -> Self {
        self.warnings.extend(warnings);
        self
    }

    fn compatibility_outcome(self) -> CopyOutcome {
        let warning = self
            .warnings
            .iter()
            .map(PostCommitWarning::legacy_message)
            .collect::<Vec<_>>()
            .join(" ");
        CopyOutcome {
            mode: self.mode,
            warning: (!warning.is_empty()).then_some(warning),
        }
    }
}

#[derive(Debug)]
pub(crate) struct DirectCopyWriteError {
    kind: CopyFailureKind,
    message: String,
}

impl DirectCopyWriteError {
    pub(crate) fn other(message: impl Into<String>) -> Self {
        Self {
            kind: CopyFailureKind::Other,
            message: message.into(),
        }
    }

    fn from_io(context: impl Into<String>, error: &std::io::Error) -> Self {
        let message = format!("{}: {error}", context.into());
        Self {
            kind: if error.kind() == ErrorKind::PermissionDenied || is_permission_error(&message) {
                CopyFailureKind::PermissionDenied
            } else {
                CopyFailureKind::Other
            },
            message,
        }
    }

    fn into_failure(self) -> CopyFailure {
        CopyFailure {
            kind: self.kind,
            message: self.message,
            diagnostics: Vec::new(),
        }
    }
}

pub fn copy_with_privilege<R: CommandRunner>(
    pairs: &[CopyPair],
    runner: &mut R,
) -> Result<CopyOutcome, String> {
    copy_with_privilege_detailed(pairs, runner)
        .map(CopyCompletion::compatibility_outcome)
        .map_err(|error| error.display())
}

pub(crate) fn copy_with_privilege_detailed<R: CommandRunner>(
    pairs: &[CopyPair],
    runner: &mut R,
) -> Result<CopyCompletion, CopyFailure> {
    if pairs.is_empty() {
        return Ok(CopyCompletion::new("noop"));
    }

    #[cfg(target_os = "windows")]
    if let Err(error) = super::windows::admin_copy::preflight_direct_copy(pairs) {
        if error.allows_administrator_retry() {
            return super::windows::admin_copy::retry_if_supported(pairs, runner);
        }
        return Err(error);
    }

    match run_direct_copy(pairs) {
        Ok(completion) => Ok(completion),
        Err(direct_failure) if direct_failure.allows_administrator_retry() => {
            let recovery_warnings = direct_failure.recovery_warnings();
            #[cfg(target_os = "macos")]
            {
                return super::macos::admin_copy::run_admin_copy(pairs, runner)
                    .map(|completion| completion.extend_warnings(recovery_warnings))
                    .map_err(|administrator| {
                        direct_failure.merge_administrator_failure(administrator)
                    });
            }
            #[cfg(target_os = "windows")]
            {
                return super::windows::admin_copy::retry_if_supported(pairs, runner)
                    .map(|completion| completion.extend_warnings(recovery_warnings))
                    .map_err(|administrator| {
                        direct_failure.merge_administrator_failure(administrator)
                    });
            }
            #[cfg(not(any(target_os = "macos", target_os = "windows")))]
            {
                let _ = runner;
                Err(direct_failure)
            }
        }
        Err(error) => Err(error),
    }
}

#[derive(Debug)]
struct CopyTransactionBackup {
    destination: PathBuf,
    original_backup: Option<PathBuf>,
    original_permissions: Option<fs::Permissions>,
}

fn run_direct_copy(pairs: &[CopyPair]) -> Result<CopyCompletion, CopyFailure> {
    run_direct_copy_with_writer(pairs, copy_file_with_source_permissions)
}

pub(crate) fn run_direct_copy_with_writer<F>(
    pairs: &[CopyPair],
    writer: F,
) -> Result<CopyCompletion, CopyFailure>
where
    F: FnMut(&CopyPair) -> Result<(), DirectCopyWriteError>,
{
    run_direct_copy_with_writer_and_cleanup(pairs, writer, |path| {
        fs::remove_dir_all(path).map_err(|error| error.to_string())
    })
}

pub(crate) fn run_direct_copy_with_writer_and_cleanup<F, C>(
    pairs: &[CopyPair],
    mut writer: F,
    mut cleanup_backup_root: C,
) -> Result<CopyCompletion, CopyFailure>
where
    F: FnMut(&CopyPair) -> Result<(), DirectCopyWriteError>,
    C: FnMut(&Path) -> Result<(), String>,
{
    let created_parent_directories = missing_copy_parent_directories(pairs)?;
    let backup_root = create_copy_transaction_backup_dir()?;
    let backups = match prepare_copy_transaction_backups(pairs, &backup_root) {
        Ok(backups) => backups,
        Err(error) => {
            return match cleanup_backup_root(&backup_root) {
                Ok(()) => Err(error),
                Err(cleanup_error) => Err(error.with_recovery_residual(
                    [backup_root],
                    format!("backup cleanup failed: {cleanup_error}"),
                )),
            };
        }
    };

    for (index, pair) in pairs.iter().enumerate() {
        if let Err(write_error) = writer(pair) {
            // writer 可能在截断当前目标后失败，因此当前项也必须参与回滚。
            let mut failure = write_error.into_failure();
            failure.message = format!(
                "Copy transaction failed at {}: {}",
                pair.dst.display(),
                failure.message
            );
            return match rollback_direct_copy_backups(&backups[..=index]) {
                Ok(()) => {
                    let mut residual_paths = cleanup_empty_directories(&created_parent_directories);
                    if let Err(error) = cleanup_backup_root(&backup_root) {
                        residual_paths.push((backup_root.clone(), error));
                    }
                    if residual_paths.is_empty() {
                        failure
                            .message
                            .push_str(". Original contents were restored.");
                        Err(failure)
                    } else {
                        failure
                            .message
                            .push_str(". Original contents were restored.");
                        Err(failure.with_recovery_residual(
                            residual_paths.iter().map(|(path, _)| path.clone()),
                            residual_paths
                                .iter()
                                .map(|(path, error)| format!("{}: {error}", path.display()))
                                .collect::<Vec<_>>()
                                .join(" | "),
                        ))
                    }
                }
                Err(rollback_error) => {
                    failure.kind = CopyFailureKind::Other;
                    failure.message = format!(
                        "{}. Rollback also failed: {rollback_error}",
                        failure.message
                    );
                    let mut residual_paths = cleanup_empty_directories(&created_parent_directories);
                    residual_paths
                        .push((backup_root.clone(), "recovery backups retained".to_string()));
                    Err(failure.with_recovery_residual(
                        residual_paths.iter().map(|(path, _)| path.clone()),
                        residual_paths
                            .iter()
                            .map(|(path, error)| format!("{}: {error}", path.display()))
                            .collect::<Vec<_>>()
                            .join(" | "),
                    ))
                }
            };
        }
    }

    // 提交后备份不再是恢复材料；删除失败是 warning，绝不伪装成复制失败。
    match cleanup_backup_root(&backup_root) {
        Ok(()) => Ok(CopyCompletion::new("direct")),
        Err(error) => Ok(
            CopyCompletion::new("direct").with_warning(PostCommitWarning::new(
                PostCommitWarningCode::TransactionBackupCleanup,
                [backup_root],
                Some(error),
            )),
        ),
    }
}

fn missing_copy_parent_directories(pairs: &[CopyPair]) -> Result<Vec<PathBuf>, CopyFailure> {
    let mut missing = HashSet::new();
    for pair in pairs {
        let mut candidate = pair.dst.parent().ok_or_else(|| {
            CopyFailure::other(format!("Missing parent for {}", pair.dst.display()))
        })?;
        loop {
            match candidate.try_exists() {
                Ok(true) => break,
                Ok(false) => {
                    missing.insert(candidate.to_path_buf());
                    candidate = candidate.parent().ok_or_else(|| {
                        CopyFailure::other(format!(
                            "Could not find an existing ancestor for {}.",
                            pair.dst.display()
                        ))
                    })?;
                }
                Err(error) => {
                    return Err(CopyFailure::from_io(
                        format!(
                            "Could not inspect copy destination parent {}",
                            candidate.display()
                        ),
                        &error,
                    ));
                }
            }
        }
    }
    let mut directories = missing.into_iter().collect::<Vec<_>>();
    directories.sort_by(|left, right| {
        right
            .components()
            .count()
            .cmp(&left.components().count())
            .then_with(|| right.cmp(left))
    });
    Ok(directories)
}

fn cleanup_empty_directories(directories: &[PathBuf]) -> Vec<(PathBuf, String)> {
    let mut errors = Vec::new();
    for directory in directories {
        match fs::remove_dir(directory) {
            Ok(()) => {}
            Err(error) if error.kind() == ErrorKind::NotFound => {}
            Err(error) => errors.push((directory.clone(), error.to_string())),
        }
    }
    errors
}

fn create_copy_transaction_backup_dir() -> Result<PathBuf, CopyFailure> {
    use std::{
        sync::atomic::{AtomicU64, Ordering},
        time::{SystemTime, UNIX_EPOCH},
    };

    static SEQUENCE: AtomicU64 = AtomicU64::new(0);
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| CopyFailure::other(error.to_string()))?
        .as_nanos();
    for _ in 0..128 {
        let sequence = SEQUENCE.fetch_add(1, Ordering::Relaxed);
        let path = std::env::temp_dir().join(format!(
            "cavalry-i18n-copy-backup-{}-{timestamp}-{sequence}",
            std::process::id()
        ));
        match fs::create_dir(&path) {
            Ok(()) => return Ok(path),
            Err(error) if error.kind() == ErrorKind::AlreadyExists => continue,
            Err(error) => {
                return Err(CopyFailure::from_io(
                    format!(
                        "Could not create copy transaction backup directory {}",
                        path.display()
                    ),
                    &error,
                ));
            }
        }
    }
    Err(CopyFailure::other(
        "Could not allocate a unique copy transaction backup directory.",
    ))
}

fn prepare_copy_transaction_backups(
    pairs: &[CopyPair],
    backup_root: &Path,
) -> Result<Vec<CopyTransactionBackup>, CopyFailure> {
    pairs
        .iter()
        .enumerate()
        .map(|(index, pair)| match fs::metadata(&pair.dst) {
            Ok(metadata) => {
                if !metadata.is_file() {
                    return Err(CopyFailure::other(format!(
                        "Copy transaction destination is not a file: {}",
                        pair.dst.display()
                    )));
                }
                let backup = backup_root.join(format!("{index}.original"));
                fs::copy(&pair.dst, &backup).map_err(|error| {
                    CopyFailure::from_io(
                        format!(
                            "Could not back up {} before copy transaction",
                            pair.dst.display()
                        ),
                        &error,
                    )
                })?;
                fs::set_permissions(&backup, metadata.permissions()).map_err(|error| {
                    CopyFailure::from_io(
                        format!(
                            "Could not preserve permissions while backing up {}",
                            pair.dst.display()
                        ),
                        &error,
                    )
                })?;
                Ok(CopyTransactionBackup {
                    destination: pair.dst.clone(),
                    original_backup: Some(backup),
                    original_permissions: Some(metadata.permissions()),
                })
            }
            Err(error) if error.kind() == ErrorKind::NotFound => Ok(CopyTransactionBackup {
                destination: pair.dst.clone(),
                original_backup: None,
                original_permissions: None,
            }),
            Err(error) => Err(CopyFailure::from_io(
                format!(
                    "Could not inspect {} before copy transaction",
                    pair.dst.display()
                ),
                &error,
            )),
        })
        .collect()
}

fn rollback_direct_copy_backups(backups: &[CopyTransactionBackup]) -> Result<(), String> {
    let mut errors = Vec::new();
    for backup in backups.iter().rev() {
        let result = match (&backup.original_backup, &backup.original_permissions) {
            (Some(source), Some(permissions)) => {
                copy_file_with_permissions(source, &backup.destination, permissions)
                    .map_err(|error| error.message)
            }
            (None, None) => match fs::remove_file(&backup.destination) {
                Ok(()) => Ok(()),
                Err(error) if error.kind() == ErrorKind::NotFound => Ok(()),
                Err(error) => Err(format!(
                    "Could not remove newly created {}: {error}",
                    backup.destination.display()
                )),
            },
            _ => Err(format!(
                "Copy transaction backup metadata is incomplete for {}",
                backup.destination.display()
            )),
        };
        if let Err(error) = result {
            errors.push(error);
        }
    }
    if errors.is_empty() {
        Ok(())
    } else {
        Err(errors.join(" | "))
    }
}

pub(crate) fn copy_file_with_source_permissions(
    pair: &CopyPair,
) -> Result<(), DirectCopyWriteError> {
    let permissions = fs::metadata(&pair.src)
        .map_err(|error| {
            DirectCopyWriteError::from_io(
                format!("Could not inspect staged source {}", pair.src.display()),
                &error,
            )
        })?
        .permissions();
    copy_file_with_permissions(&pair.src, &pair.dst, &permissions)
}

fn copy_file_with_permissions(
    source: &Path,
    destination: &Path,
    permissions: &fs::Permissions,
) -> Result<(), DirectCopyWriteError> {
    let parent = destination.parent().ok_or_else(|| {
        DirectCopyWriteError::other(format!("Missing parent for {}", destination.display()))
    })?;
    fs::create_dir_all(parent).map_err(|error| {
        DirectCopyWriteError::from_io(
            format!(
                "Could not create copy destination parent {}",
                parent.display()
            ),
            &error,
        )
    })?;
    fs::copy(source, destination).map_err(|error| {
        DirectCopyWriteError::from_io(
            format!(
                "Could not copy {} to {}",
                source.display(),
                destination.display()
            ),
            &error,
        )
    })?;
    fs::set_permissions(destination, permissions.clone()).map_err(|error| {
        DirectCopyWriteError::from_io(
            format!(
                "Could not preserve permissions on {}",
                destination.display()
            ),
            &error,
        )
    })
}
