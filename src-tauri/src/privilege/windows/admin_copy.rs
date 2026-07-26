/**
 * [INPUT]: 依赖 known_folders 的 Program Files/reparse 校验、manifest 的 hash-locked UAC 脚本与 CommandRunner。
 * [OUTPUT]: 提供 direct 写入预检、受限 UAC retry、0/42/43/44 事务状态解释与结构化 cleanup warning。
 * [POS]: Windows 复制权限编排；父进程在本地清理临时脚本，提升进程仅透传固定事务退出码。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
use std::{
    collections::HashSet,
    fs,
    path::{Path, PathBuf},
};

use crate::patch::CopyPair;

use super::super::{
    copy_transaction::{CopyCompletion, CopyFailure, PostCommitWarning, PostCommitWarningCode},
    CommandRunner, CommandStatus,
};
use super::{
    known_folders::{
        lexically_absolute_windows_path, paths_equal, validate_windows_copy_pair,
        windows_elevation_supported_for_copy_pairs, windows_trusted_program_files_roots,
    },
    manifest::{
        encode_powershell_command, windows_admin_copy_script, windows_admin_copy_script_loader,
        write_windows_admin_copy_script, write_windows_copy_manifest,
    },
};

pub(crate) const WINDOWS_NON_ELEVATABLE_INSTALL_ERROR: &str =
    "The selected Cavalry installation is not writable. Windows administrator retry is available only for installations under the OS-known Program Files folders; choose a writable Cavalry copy or update that folder's permissions.";

pub(crate) fn retry_if_supported<R: CommandRunner>(
    pairs: &[CopyPair],
    runner: &mut R,
) -> Result<CopyCompletion, CopyFailure> {
    if !windows_elevation_supported_for_copy_pairs(pairs) {
        return Err(CopyFailure::other(WINDOWS_NON_ELEVATABLE_INSTALL_ERROR));
    }
    run_windows_admin_copy(pairs, runner)
}

pub(crate) fn preflight_direct_copy(pairs: &[CopyPair]) -> Result<(), CopyFailure> {
    for (index, pair) in pairs.iter().enumerate() {
        let parent = pair.dst.parent().ok_or_else(|| {
            CopyFailure::other(format!("Missing parent for {}", pair.dst.display()))
        })?;
        if pair.dst.exists() {
            fs::OpenOptions::new()
                .write(true)
                .open(&pair.dst)
                .map_err(|error| {
                    CopyFailure::from_io(
                        format!(
                            "Could not open copy destination {} for writing",
                            pair.dst.display()
                        ),
                        &error,
                    )
                })?;
            continue;
        }
        let probe_parent = nearest_existing_directory(parent)?;
        let probe = probe_parent.join(format!(
            ".cavalry-i18n-write-probe-{}-{index}",
            std::process::id()
        ));
        match fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&probe)
        {
            Ok(_) => {
                if let Err(cleanup_error) = fs::remove_file(&probe) {
                    return Err(CopyFailure::other(format!(
                        "Write probe succeeded, but cleanup could not remove {}: {cleanup_error}",
                        probe.display()
                    ))
                    .with_recovery_residual(
                        [absolute_windows_path_for_report(&probe)],
                        cleanup_error.to_string(),
                    ));
                }
            }
            Err(error) => {
                return Err(CopyFailure::from_io(
                    format!("Could not create write probe {}", probe.display()),
                    &error,
                ));
            }
        }
    }
    Ok(())
}

fn nearest_existing_directory(path: &Path) -> Result<PathBuf, CopyFailure> {
    let mut candidate = path;
    loop {
        match fs::metadata(candidate) {
            Ok(metadata) if metadata.is_dir() => return Ok(candidate.to_path_buf()),
            Ok(_) => {
                return Err(CopyFailure::other(format!(
                    "Copy destination parent is not a directory: {}",
                    candidate.display()
                )));
            }
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
                candidate = candidate.parent().ok_or_else(|| {
                    CopyFailure::other(format!(
                        "Could not find an existing ancestor for copy destination parent {}.",
                        path.display()
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

pub(crate) fn run_windows_admin_copy<R: CommandRunner>(
    pairs: &[CopyPair],
    runner: &mut R,
) -> Result<CopyCompletion, CopyFailure> {
    let trusted_roots = windows_trusted_program_files_roots().map_err(CopyFailure::other)?;
    for pair in pairs {
        validate_windows_copy_pair(pair, &trusted_roots).map_err(CopyFailure::other)?;
    }
    execute_windows_admin_copy(pairs, runner)
}

pub(crate) fn execute_windows_admin_copy<R: CommandRunner>(
    pairs: &[CopyPair],
    runner: &mut R,
) -> Result<CopyCompletion, CopyFailure> {
    let destination_parent_directories = windows_destination_parent_directories(pairs)?;
    let (manifest_path, manifest_hash) = write_windows_copy_manifest(pairs).map_err(|error| {
        CopyFailure::other(format!(
            "Could not prepare administrator copy: {error}. Affected destination parent directories: {}.",
            format_absolute_paths(&destination_parent_directories)
        ))
    })?;
    let script = windows_admin_copy_script(&manifest_path, &manifest_hash);
    let (script_path, script_hash) = match write_windows_admin_copy_script(&script) {
        Ok(result) => result,
        Err(error) => {
            let cleanup_errors = cleanup_windows_temp_files(&[&manifest_path]);
            return Err(with_temp_cleanup_diagnostic(
                CopyFailure::other(format!(
                    "Could not prepare administrator copy: {error}. Affected destination parent directories: {}.",
                    format_absolute_paths(&destination_parent_directories)
                )),
                &cleanup_errors,
            ));
        }
    };
    let result = {
        let loader = windows_admin_copy_script_loader(&script_path, &script_hash);
        let encoded = encode_powershell_command(&loader);
        let command = format!(
            "$ErrorActionPreference='Stop'; $p=Start-Process -FilePath 'powershell.exe' -ArgumentList @('-NoProfile','-NonInteractive','-EncodedCommand','{encoded}') -Verb RunAs -Wait -PassThru; if($null -eq $p.ExitCode){{exit 1}}; exit [int]$p.ExitCode"
        );
        runner.run_captured(
            "powershell.exe",
            &[
                "-NoLogo".to_string(),
                "-NoProfile".to_string(),
                "-NonInteractive".to_string(),
                "-Command".to_string(),
                command,
            ],
        )
    };
    let cleanup_errors = cleanup_windows_temp_files(&[&manifest_path, &script_path]);
    finish_windows_admin_copy(result, &destination_parent_directories, cleanup_errors)
}

pub(crate) fn finish_windows_admin_copy(
    result: Result<CommandStatus, String>,
    destination_parent_directories: &[PathBuf],
    cleanup_errors: Vec<TempCleanupFailure>,
) -> Result<CopyCompletion, CopyFailure> {
    match result {
        Ok(status) => match status.exit_code {
            Some(0) => finish_windows_admin_success(None, destination_parent_directories, cleanup_errors),
            Some(42) => finish_windows_admin_success(
                Some(PostCommitWarning::new(
                    PostCommitWarningCode::ElevatedTransactionCleanup,
                    destination_parent_directories.iter().cloned(),
                    Some("administrator cleanup residuals remain".to_string()),
                )),
                destination_parent_directories,
                cleanup_errors,
            ),
            Some(43) => Err(with_temp_cleanup_diagnostic(
                CopyFailure::other(format!(
                    "Administrator copy failed, but original contents were restored. Affected destination parent directories: {}.",
                    format_absolute_paths(destination_parent_directories)
                )),
                &cleanup_errors,
            )),
            Some(44) => Err(with_temp_cleanup_diagnostic(
                CopyFailure::other(format!(
                    "Administrator copy failed and rollback or cleanup residuals remain beside destination parent directories: {}.",
                    format_absolute_paths(destination_parent_directories)
                )),
                &cleanup_errors,
            )),
            Some(exit_code) => Err(with_temp_cleanup_diagnostic(
                CopyFailure::other(format!(
                    "Administrator copy ended with unknown UAC transaction exit code {exit_code}. Affected destination parent directories: {}. {}",
                    format_absolute_paths(destination_parent_directories),
                    status.diagnostic_summary()
                )),
                &cleanup_errors,
            )),
            None => Err(with_temp_cleanup_diagnostic(
                CopyFailure::other(format!(
                    "Administrator copy ended without an exit code. Affected destination parent directories: {}. {}",
                    format_absolute_paths(destination_parent_directories),
                    status.diagnostic_summary()
                )),
                &cleanup_errors,
            )),
        },
        Err(error) => Err(with_temp_cleanup_diagnostic(
            CopyFailure::other(format!(
                "Could not wait for administrator copy: {error}. Affected destination parent directories: {}.",
                format_absolute_paths(destination_parent_directories)
            )),
            &cleanup_errors,
        )),
    }
}

fn finish_windows_admin_success(
    administrator_warning: Option<PostCommitWarning>,
    destination_parent_directories: &[PathBuf],
    cleanup_errors: Vec<TempCleanupFailure>,
) -> Result<CopyCompletion, CopyFailure> {
    let mut completion = CopyCompletion::new("elevated");
    if let Some(warning) = administrator_warning {
        completion = completion.with_warning(warning);
    }
    if !cleanup_errors.is_empty() {
        completion = completion.with_warning(PostCommitWarning::new(
            PostCommitWarningCode::ElevatedAdministratorCleanup,
            cleanup_errors.iter().map(|failure| failure.path.clone()),
            Some(format_temp_cleanup_errors(&cleanup_errors)),
        ));
    } else if completion.warnings.is_empty() && destination_parent_directories.is_empty() {
        return Err(CopyFailure::other(
            "Administrator copy completed without destination parent directories.",
        ));
    }
    Ok(completion)
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct TempCleanupFailure {
    path: PathBuf,
    error: String,
}

fn cleanup_windows_temp_files(paths: &[&Path]) -> Vec<TempCleanupFailure> {
    cleanup_windows_temp_files_with(paths, |path| {
        fs::remove_file(path).map_err(|error| error.to_string())
    })
}

pub(crate) fn cleanup_windows_temp_files_with<F>(
    paths: &[&Path],
    mut remover: F,
) -> Vec<TempCleanupFailure>
where
    F: FnMut(&Path) -> Result<(), String>,
{
    let mut errors = Vec::new();
    for path in paths {
        if let Err(error) = remover(path) {
            errors.push(TempCleanupFailure {
                path: absolute_windows_path_for_report(path),
                error,
            });
        }
    }
    errors
}

fn windows_destination_parent_directories(pairs: &[CopyPair]) -> Result<Vec<PathBuf>, CopyFailure> {
    let parents = pairs
        .iter()
        .map(|pair| {
            pair.dst
                .parent()
                .ok_or_else(|| {
                    CopyFailure::other(format!("Missing parent for {}", pair.dst.display()))
                })
                .map(absolute_windows_path_for_report)
        })
        .collect::<Result<Vec<_>, _>>()?;
    Ok(dedupe_absolute_windows_paths(parents))
}

fn absolute_windows_path_for_report(path: &Path) -> PathBuf {
    lexically_absolute_windows_path(path).unwrap_or_else(|_| path.to_path_buf())
}

fn dedupe_absolute_windows_paths(paths: impl IntoIterator<Item = PathBuf>) -> Vec<PathBuf> {
    let mut seen = HashSet::new();
    let mut output = Vec::new();
    for path in paths {
        let path = absolute_windows_path_for_report(&path);
        let key = path
            .to_string_lossy()
            .replace('/', "\\")
            .trim_end_matches('\\')
            .to_ascii_lowercase();
        if seen.insert(key) {
            output.push(path);
        }
    }
    output.sort();
    output
}

fn format_absolute_paths(paths: &[PathBuf]) -> String {
    dedupe_absolute_windows_paths(paths.iter().cloned())
        .iter()
        .map(|path| path.display().to_string())
        .collect::<Vec<_>>()
        .join(", ")
}

fn format_temp_cleanup_errors(cleanup_errors: &[TempCleanupFailure]) -> String {
    dedupe_absolute_windows_paths(cleanup_errors.iter().map(|failure| failure.path.clone()))
        .iter()
        .map(|path| {
            let error = cleanup_errors
                .iter()
                .find(|failure| paths_equal(&failure.path, path))
                .map(|failure| failure.error.as_str())
                .unwrap_or("unknown cleanup failure");
            format!("{}: {error}", path.display())
        })
        .collect::<Vec<_>>()
        .join(" | ")
}

fn with_temp_cleanup_diagnostic(
    failure: CopyFailure,
    cleanup_errors: &[TempCleanupFailure],
) -> CopyFailure {
    if cleanup_errors.is_empty() {
        failure
    } else {
        failure.with_recovery_residual(
            dedupe_absolute_windows_paths(
                cleanup_errors.iter().map(|failure| failure.path.clone()),
            ),
            format_temp_cleanup_errors(cleanup_errors),
        )
    }
}
