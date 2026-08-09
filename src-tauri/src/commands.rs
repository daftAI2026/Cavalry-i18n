/**
 * [INPUT]: 依赖 commands 子模块、共享 operation_lock、Tauri command runtime/startup recovery state 与 privilege facade。
 * [OUTPUT]: 保持六条稳定 Tauri command、apply/extract 兼容入口；get_status 显式投影启动恢复阻断，apply 在同一 operation guard 内完成成功后的 restart，并在 facade 处把全部内部 warning prose 收敛为可组合 warningCodes。
 * [POS]: renderer API facade；具体状态、快照、写入和平台运行时下沉至领域模块，GUI 与卸载恢复复用同一单飞/事务语义。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
mod apply;
mod context;
mod contract;
mod restart;
mod snapshot;
mod status;
#[cfg(test)]
#[path = "commands/tests.rs"]
mod tests;

use chrono::{SecondsFormat, Utc};
use std::path::PathBuf;

use crate::{operation_lock, privilege};

pub use apply::apply_language_inner;
pub(crate) use context::RESTORE_OFFICIAL_ACTION;
pub use contract::{
    ActionPayload, BrowsePayload, BundleDiagnostics, LanguageChoice, StatusPayload,
};
pub use restart::restart_cavalry_inner;
pub use snapshot::extract_english_inner;
#[cfg(target_os = "windows")]
pub(crate) use snapshot::refresh_english_inner;

pub fn registered_command_names() -> &'static [&'static str] {
    &contract::COMMAND_NAMES
}

#[tauri::command]
pub fn get_status(
    app: tauri::AppHandle,
    startup_recovery: tauri::State<'_, crate::startup_recovery::StartupRecoveryStatus>,
) -> Result<StatusPayload, String> {
    status::get_status_for_app(&app, startup_recovery.error())
}

#[tauri::command]
pub fn browse_app(app: tauri::AppHandle) -> Result<BrowsePayload, String> {
    status::browse_for_app(&app)
}

#[tauri::command(rename_all = "camelCase")]
pub async fn extract_english(app: tauri::AppHandle, app_path: String) -> ActionPayload {
    let app_path = PathBuf::from(app_path);
    let paths = context::AppPaths::for_app(&app);
    let guard = match operation_lock::try_begin_bundle_operation(&paths.state_dir) {
        Ok(guard) => guard,
        Err(error) => return ActionPayload::error(&error.to_string()),
    };
    match tauri::async_runtime::spawn_blocking(move || -> Result<ActionPayload, String> {
        let _guard = guard;
        let mut runner = privilege::RealCommandRunner;
        let now = Utc::now().to_rfc3339_opts(SecondsFormat::Millis, true);
        snapshot::refresh_english_inner(
            &paths.repo_root,
            &paths.state_dir,
            &paths.resource_dir,
            &app_path,
            &mut runner,
            &now,
        )
    })
    .await
    {
        Ok(Ok(payload)) => payload.into_renderer_contract(),
        Ok(Err(error)) => ActionPayload::error(&error),
        Err(error) => ActionPayload::error(&format!("English extraction task failed: {error}")),
    }
}

#[tauri::command(rename_all = "camelCase")]
pub async fn apply_language(
    app: tauri::AppHandle,
    app_path: String,
    lang: String,
) -> ActionPayload {
    let paths = context::AppPaths::for_app(&app);
    let guard = match operation_lock::try_begin_bundle_operation(&paths.state_dir) {
        Ok(guard) => guard,
        Err(error) => return ActionPayload::error(&error.to_string()),
    };
    let app_path = PathBuf::from(app_path);
    if !context::is_supported_apply_action(&lang) {
        return ActionPayload::error_with_code("Unsupported language pack.", "unsupportedLanguage");
    }
    let now = Utc::now().to_rfc3339_opts(SecondsFormat::Millis, true);
    match tauri::async_runtime::spawn_blocking(move || -> Result<ActionPayload, String> {
        let _guard = guard;
        let mut runner = privilege::RealCommandRunner;
        let applied = apply::apply_language_inner(
            &paths.repo_root,
            &paths.state_dir,
            &paths.resource_dir,
            &app_path,
            &lang,
            &mut runner,
            &now,
        )?
        .into_renderer_contract();
        if !applied.ok {
            return Ok(applied);
        }
        match restart::restart_cavalry_inner(
            &paths.repo_root,
            &paths.state_dir,
            &paths.resource_dir,
            &app_path,
            &mut runner,
        ) {
            Ok(()) => Ok(applied),
            Err(_) => Ok(applied.with_warning_code(contract::RESTART_FAILED_WARNING_CODE)),
        }
    })
    .await
    {
        Ok(Ok(payload)) => payload,
        Ok(Err(error)) if status::is_app_management_error(&error) => {
            ActionPayload::permission_error(&error)
        }
        Ok(Err(error)) => ActionPayload::error(&error),
        Err(error) => ActionPayload::error(&format!("Language apply task failed: {error}")),
    }
}

#[tauri::command]
pub fn open_privacy_security() -> ActionPayload {
    let mut runner = privilege::RealCommandRunner;
    match privilege::open_privacy_security(&mut runner) {
        Ok(()) => ActionPayload::ok(),
        Err(error) => ActionPayload::error(&error),
    }
}

#[tauri::command(rename_all = "camelCase")]
pub async fn restart_cavalry(app: tauri::AppHandle, app_path: String) -> ActionPayload {
    let paths = context::AppPaths::for_app(&app);
    let app_path = PathBuf::from(app_path);
    let guard = match operation_lock::try_begin_bundle_operation(&paths.state_dir) {
        Ok(guard) => guard,
        Err(error) => return ActionPayload::error(&error),
    };
    match tauri::async_runtime::spawn_blocking(move || {
        let _guard = guard;
        let mut runner = privilege::RealCommandRunner;
        restart::restart_cavalry_inner(
            &paths.repo_root,
            &paths.state_dir,
            &paths.resource_dir,
            &app_path,
            &mut runner,
        )
    })
    .await
    {
        Ok(Ok(())) => ActionPayload::ok(),
        Ok(Err(error)) => ActionPayload::error(&error),
        Err(error) => ActionPayload::error(&format!("Cavalry restart task failed: {error}")),
    }
}

#[cfg(target_os = "macos")]
#[cfg(test)]
pub(crate) use crate::mac_runtime::injector_source_candidates;
#[cfg(all(test, target_os = "macos"))]
pub(crate) use crate::operation_lock::acquire_bundle_file_lock;
#[cfg(test)]
pub(crate) use crate::operation_lock::{try_begin_bundle_operation, BUSY_ERROR};
#[cfg(test)]
pub(crate) use apply::marker_guarded_transaction_pairs;
#[cfg(test)]
pub(crate) use context::resource_candidates;
#[cfg(test)]
pub(crate) use contract::COMMAND_NAMES;
#[cfg(test)]
pub(crate) use restart::restart_cavalry_guarded;
#[cfg(all(test, target_os = "windows"))]
pub(crate) use restart::restart_cavalry_inner_with_qpa_inspector;
#[cfg(all(test, target_os = "windows"))]
pub(crate) use status::{is_app_management_error, permission_action};
#[cfg(test)]
pub(crate) use status::{status_for_paths, sync_state_with_bundle};
