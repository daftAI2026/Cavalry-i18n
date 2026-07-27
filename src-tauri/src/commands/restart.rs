/**
 * [INPUT]: 依赖 detect/state/status 同步、platform_runtime.restart、共享 operation_lock 测试门与 CommandRunner。
 * [OUTPUT]: 提供 restart_cavalry_inner，保持 restart 前 revision/state 同步。
 * [POS]: commands 的重启编排层；平台特定 plugin 环境、PID marker 和 macOS launcher 全下沉 facade。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
use std::path::Path;

use crate::{detect, platform_runtime, privilege::CommandRunner, state};

use super::status::sync_state_with_bundle;

pub fn restart_cavalry_inner<R: CommandRunner>(
    repo_root: &Path,
    state_dir: &Path,
    resource_dir: &Path,
    app_path: &Path,
    runner: &mut R,
) -> Result<(), String> {
    let app_path = detect::resolve_install(app_path)?.root;
    let version = detect::read_bundle_version(&app_path).unwrap_or_default();
    let immutable_revision = detect::read_bundle_revision(&app_path)?;
    let state = sync_state_with_bundle(
        state_dir,
        state::read_state(state_dir).unwrap_or_default(),
        &app_path,
        &version,
        &immutable_revision,
    );
    platform_runtime::restart(
        repo_root,
        state_dir,
        resource_dir,
        &app_path,
        &state,
        runner,
    )
}

#[cfg(test)]
pub(crate) fn restart_cavalry_guarded<R: CommandRunner>(
    repo_root: &Path,
    state_dir: &Path,
    resource_dir: &Path,
    app_path: &Path,
    runner: &mut R,
) -> super::contract::ActionPayload {
    if app_path.as_os_str().is_empty() {
        return super::contract::ActionPayload::error("Select a Cavalry installation first.");
    }
    let _guard = match crate::operation_lock::try_begin_bundle_operation(state_dir) {
        Ok(guard) => guard,
        Err(error) => return super::contract::ActionPayload::error(&error),
    };
    match restart_cavalry_inner(repo_root, state_dir, resource_dir, app_path, runner) {
        Ok(()) => super::contract::ActionPayload::ok(),
        Err(error) => super::contract::ActionPayload::error(&error),
    }
}
