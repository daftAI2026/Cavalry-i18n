/**
 * [INPUT]: 依赖各平台权限复制、bundle/restart 适配器与 CommandRunner；接收 staged CopyPair、只读发现命令和受控启动请求。
 * [OUTPUT]: 保持 privilege::{CommandRunner, RecordingRunner, RealCommandRunner, CopyOutcome,...} 兼容入口，提供 typed 写入前 graceful close、有界 macOS 签名/只读 seal 验证、Windows 提升 worker 早期分流，并向 crate 内提供无控制台 captured command。
 * [POS]: src-tauri/src 的系统命令 facade；平台安全、提升事务与辅助进程可见性下沉到职责模块，命令层不直接触碰 UAC/AppleScript。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
mod copy_transaction;
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
