/**
 * [INPUT]: 依赖各平台权限复制、bundle/restart 适配器与 CommandRunner；接收 staged CopyPair、只读发现命令和受控启动请求。
 * [OUTPUT]: 保持 privilege::{CommandRunner, RecordingRunner, RealCommandRunner, CopyOutcome,...} 兼容入口，提供 typed 写入前 graceful close、有界 macOS 签名/只读 seal 验证、Windows apply/recovery 提升 worker 早期分流，并让 Program Files 启动恢复先以不跟随 reparse 的保存根只读探针确认 journal，再经 same-EXE RunAs 边界执行。
 * [POS]: src-tauri/src 的跨平台系统命令 facade；平台安全、提升事务、journal 机制与辅助进程可见性下沉到职责模块，命令层不直接触碰 UAC/AppleScript，受保护安装根禁止回退为未提权写入。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
mod copy_transaction;
mod external_link;
mod keychain;
#[cfg(target_os = "macos")]
mod macos;
mod restart;
mod runner;
#[cfg(test)]
#[path = "privilege/tests.rs"]
mod tests;
#[cfg(target_os = "windows")]
mod windows;

use std::path::{Path, PathBuf};

#[cfg(target_os = "windows")]
use std::time::Duration;

pub use copy_transaction::{copy_with_privilege, CopyOutcome};
pub use external_link::{open_project_link, ProjectLink};
pub use keychain::{
    patch_keychain_query_attributes, patch_keychain_query_attributes_with_privilege,
    KeychainPatchReport,
};
pub use restart::{
    close_cavalry_before_modification, open_privacy_security, restart_cavalry,
    restart_cavalry_with_environment, restart_cavalry_with_environment_and_pid, restart_commands,
    CloseCavalryError,
};
pub use runner::{
    CommandRunner, CommandStatus, RealCommandRunner, RecordedCommand, RecordingRunner,
};

#[cfg(not(target_os = "macos"))]
pub(crate) use copy_transaction::copy_with_privilege_detailed;
pub(crate) use copy_transaction::{PostCommitWarning, PostCommitWarningCode};
pub(crate) use keychain::stage_keychain_query_attributes_patch;
#[cfg(target_os = "macos")]
pub(crate) use macos::apply_transaction::{
    MacApplyBeginError, MacApplyTransaction, MacBundlePreimageConstraint,
};
#[cfg(target_os = "macos")]
pub(crate) use macos::bundle::{
    external_signature_component_paths, has_exact_external_signature_residue,
    inspect_bundle_signature, seal_patched_bundle, sign_modified_nested_code,
    verify_modified_nested_code, BundleSignatureEvidence,
};
#[cfg(target_os = "windows")]
pub(crate) use runner::captured_command;
#[cfg(target_os = "windows")]
pub(crate) use windows::language_transaction::parent::{
    apply_if_program_files as apply_windows_program_files_language, ParentApplyError,
    ParentApplyOutcome, ParentApplyRequest,
};

#[cfg(target_os = "windows")]
pub(crate) fn has_pending_windows_language_transaction(
    install_root: &Path,
) -> Result<bool, String> {
    windows::language_transaction::storage::has_pending(install_root)
}

#[cfg(target_os = "windows")]
pub(crate) fn dispatch_elevated_language_worker_current_process() -> Option<u32> {
    use windows::language_transaction::contract::{
        parse_worker_argv, WorkerArgv, WORKER_EXIT_ROLLED_BACK_OR_ZERO_MUTATION_CLEAN,
    };

    let args = std::env::args_os().skip(1).collect::<Vec<_>>();
    match parse_worker_argv(&args) {
        WorkerArgv::NotWorker => None,
        WorkerArgv::Apply(transport) => Some(
            windows::language_transaction::worker::run_elevated_worker(&transport),
        ),
        WorkerArgv::Recover(transport) => {
            Some(windows::language_transaction::worker::run_elevated_recovery_worker(&transport))
        }
        WorkerArgv::HandledError(_) => Some(WORKER_EXIT_ROLLED_BACK_OR_ZERO_MUTATION_CLEAN),
    }
}

/// Windows 管理员重试只服务 OS Known Folder 证明的 Program Files 后代；其他平台保持旧行为返回 false。
pub fn windows_elevation_supported_for_install(install_root: &Path) -> bool {
    #[cfg(target_os = "windows")]
    {
        return windows::known_folders::windows_elevation_supported_for_install(install_root);
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = install_root;
        false
    }
}

pub fn resign_patched_bundle<R: CommandRunner>(
    app_path: &Path,
    modified_nested_code: &[PathBuf],
    runner: &mut R,
) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        return macos::bundle::resign_patched_bundle(app_path, modified_nested_code, runner);
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = (app_path, modified_nested_code, runner);
        Ok(())
    }
}

pub fn ensure_bundle_signature<R: CommandRunner>(
    app_path: &Path,
    runner: &mut R,
) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        return macos::bundle::ensure_bundle_signature(app_path, runner);
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = (app_path, runner);
        Ok(())
    }
}

pub fn clear_gatekeeper_quarantine<R: CommandRunner>(
    app_path: &Path,
    runner: &mut R,
) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        return macos::bundle::clear_gatekeeper_quarantine(app_path, runner);
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = (app_path, runner);
        Ok(())
    }
}

#[cfg(target_os = "macos")]
pub(crate) fn recover_macos_apply_transaction<R: CommandRunner>(
    state_dir: &Path,
    app_path: &Path,
    runner: &mut R,
) -> Result<(), String> {
    if !macos::apply_transaction::has_pending(state_dir) {
        return Ok(());
    }
    if macos::apply_transaction::pending_requires_bundle_restore(state_dir, app_path)? {
        close_cavalry_before_modification(app_path, runner).map_err(|error| {
            format!("Could not close the selected Cavalry before transaction recovery: {error}")
        })?;
    }
    let restored_preimages =
        macos::apply_transaction::recover_pending_guarded(state_dir, app_path)?;
    ensure_bundle_signature(app_path, runner).map_err(|error| {
        if restored_preimages {
            format!("Recovered exact preimages but their bundle signature did not verify: {error}")
        } else {
            format!("Committed macOS postimages failed signature verification: {error}")
        }
    })?;
    // Only delete the authenticated journal after both exact-byte verification and the
    // independent code-signature gate have succeeded.
    macos::apply_transaction::finalize_recovered(state_dir, app_path)?;
    Ok(())
}

#[cfg(target_os = "macos")]
pub(crate) fn recover_macos_apply_for_selection<R: CommandRunner>(
    state_dir: &Path,
    selected_app: &Path,
    runner: &mut R,
) -> Result<(), String> {
    let Some(pending_root) = pending_macos_apply_install_root(state_dir)? else {
        return Ok(());
    };
    let selected_root = std::fs::canonicalize(selected_app).map_err(|error| {
        format!("Could not resolve selected Cavalry while recovery is pending: {error}")
    })?;
    if selected_root != pending_root {
        return Err(format!(
            "Pending macOS recovery belongs to {}, not selected {}.",
            pending_root.display(),
            selected_root.display()
        ));
    }
    recover_macos_apply_transaction(state_dir, &pending_root, runner)
}

#[cfg(target_os = "macos")]
pub(crate) fn pending_macos_apply_install_root(
    state_dir: &Path,
) -> Result<Option<PathBuf>, String> {
    macos::apply_transaction::pending_install_root(state_dir)
}

#[cfg(target_os = "macos")]
pub(crate) fn finalize_verified_macos_apply_recovery(
    state_dir: &Path,
    app_path: &Path,
) -> Result<(), String> {
    macos::apply_transaction::finalize_recovered(state_dir, app_path)
}

#[cfg(target_os = "windows")]
pub(crate) fn recover_windows_language_transactions<R: CommandRunner>(
    state_dir: &Path,
    runner: &mut R,
) -> Result<(), String> {
    // 先用持久化 state 找到唯一受信安装根；没有已保存安装时不扫描任意磁盘目录。
    if pending_windows_language_install_root(state_dir)?.is_none() {
        return Ok(());
    }
    let _operation_guard = match crate::operation_lock::wait_begin_bundle_operation(
        state_dir,
        Duration::from_secs(15),
    ) {
        Ok(guard) => guard,
        Err(error) if error == crate::operation_lock::BUSY_ERROR => return Ok(()),
        Err(error) => return Err(error),
    };

    // 另一个 Switcher 可能已经完成了 journal；锁定后必须重新读取 state 和 journal。
    let Some(install_root) = pending_windows_language_install_root(state_dir)? else {
        return Ok(());
    };
    let trusted_roots = windows::known_folders::windows_trusted_program_files_roots()
        .map_err(|error| format!("WINDOWS_RECOVERY_KNOWN_FOLDER_UNCERTAIN: {error}"))?;
    if windows::known_folders::windows_elevation_supported_for_install_with_roots(
        &install_root,
        &trusted_roots,
    ) {
        return recover_program_files_language_transaction(&install_root);
    }
    match close_cavalry_before_modification(&install_root, runner) {
        Ok(()) => {}
        Err(CloseCavalryError::StillRunning) => {
            return Err(
                "WINDOWS_RECOVERY_CAVALRY_STILL_RUNNING: Cavalry must exit before recovery."
                    .to_string(),
            )
        }
        Err(CloseCavalryError::Command(error)) => {
            return Err(format!(
                "WINDOWS_RECOVERY_CLOSE_FAILED: could not close Cavalry before recovery: {error}"
            ))
        }
    }

    windows::language_transaction::storage::recover_pending(&install_root)?;
    if windows::language_transaction::storage::has_pending(&install_root)? {
        return Err(
            "WINDOWS_RECOVERY_UNCERTAIN: durable language journal remains after recovery."
                .to_string(),
        );
    }
    Ok(())
}

#[cfg(target_os = "windows")]
fn recover_program_files_language_transaction(install_root: &Path) -> Result<(), String> {
    let current_exe = std::env::current_exe()
        .map_err(|error| format!("WINDOWS_RECOVERY_WORKER_UNAVAILABLE: {error}"))?;
    recover_program_files_language_transaction_with_launcher(
        install_root,
        &current_exe,
        windows::language_transaction::launcher::launch_elevated_recovery_worker,
    )
}

#[cfg(target_os = "windows")]
fn recover_program_files_language_transaction_with_launcher<L>(
    install_root: &Path,
    current_exe: &Path,
    launch: L,
) -> Result<(), String>
where
    L: FnOnce(&Path, &str) -> Result<u32, windows::language_transaction::launcher::LaunchError>,
{
    use windows::language_transaction::{
        contract::{
            RecoveryTransport, WORKER_EXIT_CAVALRY_STILL_RUNNING, WORKER_EXIT_COMMITTED_CLEAN,
            WORKER_EXIT_STATE_OR_CLEANUP_UNCERTAIN,
        },
        launcher::LaunchError,
    };

    let worker_hash = windows::language_transaction::worker::hash_locked_file(current_exe)
        .map_err(|error| format!("WINDOWS_RECOVERY_WORKER_UNCERTAIN: {error}"))?;
    let token = RecoveryTransport::new(install_root.to_path_buf(), worker_hash)
        .and_then(|transport| transport.encode())
        .map_err(|error| format!("WINDOWS_RECOVERY_TRANSPORT_INVALID: {error}"))?;
    let exit_code = match launch(current_exe, &token) {
        Ok(code) => code,
        Err(LaunchError::Cancelled(code)) => {
            return Err(format!(
            "WINDOWS_RECOVERY_PERMISSION_REQUIRED: administrator consent was cancelled ({code})."
        ))
        }
        Err(error) => return Err(format!("WINDOWS_RECOVERY_WORKER_LAUNCH_FAILED: {error}")),
    };
    match exit_code {
        WORKER_EXIT_COMMITTED_CLEAN => {}
        WORKER_EXIT_CAVALRY_STILL_RUNNING => {
            return Err(
                "WINDOWS_RECOVERY_CAVALRY_STILL_RUNNING: Cavalry must exit before recovery."
                    .to_string(),
            )
        }
        WORKER_EXIT_STATE_OR_CLEANUP_UNCERTAIN => {
            return Err(
                "WINDOWS_RECOVERY_STATE_UNCERTAIN: elevated recovery could not prove completion."
                    .to_string(),
            )
        }
        code => {
            return Err(format!(
                "WINDOWS_RECOVERY_WORKER_FAILED: elevated recovery returned exit code {code}."
            ))
        }
    }
    if windows::language_transaction::storage::has_pending(install_root)? {
        return Err(
            "WINDOWS_RECOVERY_STATE_UNCERTAIN: pending journal remained after elevated recovery."
                .to_string(),
        );
    }
    Ok(())
}

#[cfg(target_os = "windows")]
fn pending_windows_language_install_root(state_dir: &Path) -> Result<Option<PathBuf>, String> {
    let report = match crate::state::read_state_with_recovery(state_dir) {
        Ok(report) => report,
        Err(error) if state_read_error_is_missing(&error) => return Ok(None),
        Err(error) => {
            return Err(format!(
                "WINDOWS_RECOVERY_STATE_UNCERTAIN: could not load saved install state: {error}"
            ))
        }
    };
    let selected = report.document.state.app_path;
    if selected.trim().is_empty() {
        return Ok(None);
    }
    // Probe the saved root lexically before requiring a complete Cavalry identity. A removed or
    // moved install is a normal no-journal startup state; the probe is lstat-only and rejects
    // every existing reparse/non-directory ancestor before storage enumerates journal children.
    let candidate = lexical_windows_install_root(Path::new(&selected))?;
    if !probe_windows_install_root(&candidate)? {
        return Ok(None);
    }
    if !windows::language_transaction::storage::has_pending(&candidate)? {
        return Ok(None);
    }

    let layout = crate::install::InstallLayout::from_verified_selection(&candidate)?;
    if layout.platform != crate::install::InstallPlatform::Windows {
        return Ok(None);
    }
    if !windows::known_folders::paths_equal(&layout.root, &candidate) {
        return Err(
            "WINDOWS_RECOVERY_ROOT_UNCERTAIN: verified saved install root changed during recovery probe."
                .to_string(),
        );
    }
    if !probe_windows_install_root(&layout.root)? {
        return Ok(None);
    }
    if windows::language_transaction::storage::has_pending(&layout.root)? {
        Ok(Some(layout.root))
    } else {
        Ok(None)
    }
}

#[cfg(target_os = "windows")]
fn lexical_windows_install_root(selection: &Path) -> Result<PathBuf, String> {
    let selection = windows::known_folders::lexically_absolute_windows_path(selection)?;
    let is_executable = selection
        .file_name()
        .and_then(|name| name.to_str())
        .is_some_and(|name| name.eq_ignore_ascii_case("Cavalry.exe"));
    if is_executable {
        selection.parent().map(Path::to_path_buf).ok_or_else(|| {
            "WINDOWS_RECOVERY_ROOT_UNCERTAIN: saved executable has no parent.".to_string()
        })
    } else {
        Ok(selection)
    }
}

#[cfg(target_os = "windows")]
fn probe_windows_install_root(root: &Path) -> Result<bool, String> {
    if !root.is_absolute() {
        return Err(
            "WINDOWS_RECOVERY_ROOT_UNCERTAIN: saved install root is not an absolute path."
                .to_string(),
        );
    }
    let mut ancestors = root
        .ancestors()
        .filter(|path| !path.as_os_str().is_empty())
        .collect::<Vec<_>>();
    ancestors.reverse();
    if ancestors.is_empty() {
        return Err(
            "WINDOWS_RECOVERY_ROOT_UNCERTAIN: saved install root is not an absolute path."
                .to_string(),
        );
    }

    for path in ancestors {
        let metadata = match std::fs::symlink_metadata(path) {
            Ok(metadata) => metadata,
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(false),
            Err(error) => {
                let message = format!(
                    "WINDOWS_RECOVERY_ROOT_UNCERTAIN: could not inspect saved install path {}: {error}",
                    path.display()
                );
                return Err(message);
            }
        };
        if windows::known_folders::metadata_is_reparse_point(&metadata) {
            return Err(format!(
                "WINDOWS_RECOVERY_ROOT_UNCERTAIN: saved install path contains a reparse point: {}",
                path.display()
            ));
        }
        if !metadata.is_dir() {
            return Err(format!(
                "WINDOWS_RECOVERY_ROOT_UNCERTAIN: saved install path component is not a directory: {}",
                path.display()
            ));
        }
    }
    Ok(true)
}

#[cfg(target_os = "windows")]
fn state_read_error_is_missing(error: &crate::state::StateReadError) -> bool {
    let crate::state::StateReadError::RecoveryFailed { current, previous } = error else {
        return false;
    };
    matches!(
        (current.as_ref(), previous.as_ref()),
        (
            crate::state::StateReadError::Missing { .. },
            crate::state::StateReadError::Missing { .. }
        )
    )
}
