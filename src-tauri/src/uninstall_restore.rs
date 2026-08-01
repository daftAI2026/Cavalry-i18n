/**
 * [INPUT]: 依赖精确 `--uninstall-restore-english` 参数、共享 state/runtime_paths/operation_lock、commands English 事务与真实 CommandRunner。
 * [OUTPUT]: 提供 NSIS 卸载前无 WebView English 恢复分流；只有完整语言事务成功才返回 0，缺失状态、UAC 取消、未知运行时或回滚均返回失败。
 * [POS]: src-tauri/src 的 Windows 控制面卸载边界；“保留翻译”由 NSIS 不调用本入口表达，本入口只承担用户明确选择的“恢复英文并移除自有运行时”。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
use std::{
    env,
    ffi::{OsStr, OsString},
    path::Path,
};

use chrono::{SecondsFormat, Utc};

use crate::{
    commands, detect, operation_lock, patch, privilege::RealCommandRunner, runtime_paths, state,
};

pub const UNINSTALL_RESTORE_ARGUMENT: &str = "--uninstall-restore-english";
const EXIT_SUCCESS: i32 = 0;
const EXIT_RESTORE_FAILED: i32 = 1;

pub fn dispatch_current_process() -> Option<i32> {
    let args = env::args_os().collect::<Vec<_>>();
    if !restore_requested(&args) {
        return None;
    }
    Some(match restore_current_saved_cavalry() {
        Ok(()) => EXIT_SUCCESS,
        Err(_) => EXIT_RESTORE_FAILED,
    })
}

fn restore_requested(args: &[OsString]) -> bool {
    args.len() == 2 && args[1] == OsStr::new(UNINSTALL_RESTORE_ARGUMENT)
}

fn restore_current_saved_cavalry() -> Result<(), String> {
    let current_exe = env::current_exe()
        .map_err(|error| format!("Could not locate Cavalry Language Switcher: {error}"))?;
    let resource_dir = current_exe.parent().ok_or_else(|| {
        format!(
            "Could not resolve the installed Switcher directory from {}.",
            current_exe.display()
        )
    })?;
    let repo_root = runtime_paths::repo_root();
    let state_dir = runtime_paths::current_windows_state_dir();
    restore_from_paths(&repo_root, &state_dir, resource_dir)
}

fn restore_from_paths(
    repo_root: &Path,
    state_dir: &Path,
    resource_dir: &Path,
) -> Result<(), String> {
    let saved = state::read_state(state_dir).ok_or_else(|| {
        "Cannot restore English during uninstall because the saved Cavalry installation state is missing. Reopen the Switcher, select Cavalry, and restore English before uninstalling."
            .to_string()
    })?;
    if saved.app_path.trim().is_empty() {
        return Err(
            "Cannot restore English during uninstall because no Cavalry installation is selected."
                .to_string(),
        );
    }

    let _operation_guard = operation_lock::try_begin_bundle_operation(state_dir)?;
    let mut runner = RealCommandRunner;
    let now = Utc::now().to_rfc3339_opts(SecondsFormat::Millis, true);
    let app_path = detect::resolve_install(Path::new(&saved.app_path))?.root;
    let immutable_revision = detect::read_bundle_revision(&app_path)?;
    let payload = if patch::needs_english_snapshot(
        state_dir,
        saved.english_snapshot_provenance.as_ref(),
        &app_path,
        &immutable_revision,
    ) {
        commands::refresh_english_inner(
            repo_root,
            state_dir,
            resource_dir,
            &app_path,
            &mut runner,
            &now,
        )?
    } else {
        commands::apply_language_inner(
            repo_root,
            state_dir,
            resource_dir,
            &app_path,
            "en",
            &mut runner,
            &now,
        )?
    };
    if payload.ok {
        Ok(())
    } else {
        Err(payload.error.unwrap_or_else(|| {
            "Cavalry English restoration did not commit; uninstall was stopped.".to_string()
        }))
    }
}

#[cfg(test)]
mod tests {
    use super::{restore_requested, UNINSTALL_RESTORE_ARGUMENT};
    use std::ffi::OsString;

    #[test]
    fn uninstall_restore_requires_the_exact_single_argument() {
        assert!(restore_requested(&[
            OsString::from("switcher.exe"),
            OsString::from(UNINSTALL_RESTORE_ARGUMENT),
        ]));
        assert!(!restore_requested(&[OsString::from("switcher.exe")]));
        assert!(!restore_requested(&[
            OsString::from("switcher.exe"),
            OsString::from(UNINSTALL_RESTORE_ARGUMENT),
            OsString::from("extra"),
        ]));
    }
}
