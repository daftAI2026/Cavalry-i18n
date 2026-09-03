/**
 * [INPUT]: 依赖各平台权限复制、bundle/restart 适配器与 CommandRunner；接收 staged CopyPair、只读发现命令和受控启动请求。
 * [OUTPUT]: 保持 privilege::{CommandRunner, RecordingRunner, RealCommandRunner, CopyOutcome,...} 兼容入口，提供普通写入前只读运行探针、显式 restart 的 graceful close、有界 macOS 签名/只读 seal 验证、Windows apply/recovery 提升 worker 早期分流，并让 Program Files journal 仅在用户动作锁内按当前选择经 same-EXE RunAs 边界收敛。
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
    external_signature_component_paths, has_known_external_signature_residue,
    inspect_bundle_signature, seal_patched_bundle, sign_modified_nested_code,
    verify_modified_nested_code, BundleSignatureEvidence,
};
#[cfg(target_os = "macos")]
pub(crate) use macos::process::ensure_cavalry_not_running;
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
        ensure_cavalry_not_running(app_path).map_err(|error| {
            format!("Close the selected Cavalry before transaction recovery: {error}")
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
    // Only delete the structurally validated journal after both exact-byte verification and the
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
pub(crate) fn recover_windows_language_transaction_for_selection<R: CommandRunner>(
    selected_app: &Path,
    runner: &mut R,
) -> Result<(), String> {
    // 调用方已持有共享 operation lock。journal 只在用户发起写入时按当前选择静默
    // 收敛；启动既不扫描保存路径，也不把 crash-safety 投影成产品状态。
    let layout = crate::install::InstallLayout::from_verified_selection(selected_app)?;
    if layout.platform != crate::install::InstallPlatform::Windows
        || !windows::language_transaction::storage::has_pending(&layout.root)?
    {
        return Ok(());
    }
    let install_root = layout.root;
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
