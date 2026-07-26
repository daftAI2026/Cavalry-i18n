/**
 * [INPUT]: 依赖 commands 子模块、Tauri command runtime 与 privilege facade。
 * [OUTPUT]: 保持六条稳定 Tauri command、commands::apply_language_inner 与 extract_english_inner 兼容路径。
 * [POS]: renderer API facade；具体状态、快照、锁、写入和平台运行时都下沉到单一职责模块。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
mod apply;
mod context;
mod contract;
mod lock;
mod restart;
mod snapshot;
mod status;
#[cfg(test)]
#[path = "commands/tests.rs"]
mod tests;

use chrono::{SecondsFormat, Utc};
use std::path::Path;

use crate::{detect, privilege};

pub use apply::apply_language_inner;
pub use contract::{
    ActionPayload, BrowsePayload, BundleDiagnostics, LanguageChoice, StatusPayload,
};
pub use restart::restart_cavalry_inner;
pub use snapshot::extract_english_inner;

pub fn registered_command_names() -> &'static [&'static str] {
    &contract::COMMAND_NAMES
}

#[tauri::command]
pub fn get_status(app: tauri::AppHandle) -> StatusPayload {
    status::get_status_for_app(&app)
}

#[tauri::command]
pub fn browse_app(app: tauri::AppHandle) -> BrowsePayload {
    status::browse_for_app(&app)
}

#[tauri::command(rename_all = "camelCase")]
pub async fn extract_english(app: tauri::AppHandle, app_path: String) -> ActionPayload {
    let app_path = match detect::resolve_install(Path::new(&app_path)) {
        Ok(layout) => layout.root,
        Err(error) => return ActionPayload::error(&error),
    };
    let paths = context::AppPaths::for_app(&app);
    let guard = match lock::try_begin_bundle_operation(&paths.state_dir) {
        Ok(guard) => guard,
        Err(error) => return ActionPayload::error(&error),
    };
    match tauri::async_runtime::spawn_blocking(move || {
        let _guard = guard;
        snapshot::extract_english_inner(
            &paths.repo_root,
            &paths.state_dir,
            &paths.resource_dir,
            &app_path,
        )
    })
    .await
    {
        Ok(Ok(count)) => ActionPayload::ok_count(count),
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
    let guard = match lock::try_begin_bundle_operation(&paths.state_dir) {
        Ok(guard) => guard,
        Err(error) => return ActionPayload::error(&error),
    };
    let app_path = match detect::resolve_install(Path::new(&app_path)) {
        Ok(layout) => layout.root,
        Err(error) => return ActionPayload::error(&error),
    };
    let now = Utc::now().to_rfc3339_opts(SecondsFormat::Millis, true);
    match tauri::async_runtime::spawn_blocking(move || {
        let _guard = guard;
        let mut runner = privilege::RealCommandRunner;
        apply::apply_language_inner(
            &paths.repo_root,
            &paths.state_dir,
            &paths.resource_dir,
            &app_path,
            &lang,
            &mut runner,
            &now,
        )
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
    let app_path = match detect::resolve_install(Path::new(&app_path)) {
        Ok(layout) => layout.root,
        Err(error) => return ActionPayload::error(&error),
    };
    let guard = match lock::try_begin_bundle_operation(&paths.state_dir) {
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
#[cfg(test)]
pub(crate) use apply::marker_guarded_transaction_pairs;
#[cfg(test)]
pub(crate) use context::resource_candidates;
#[cfg(test)]
pub(crate) use contract::COMMAND_NAMES;
#[cfg(all(test, target_os = "macos"))]
pub(crate) use lock::acquire_bundle_file_lock;
#[cfg(test)]
pub(crate) use lock::{try_begin_bundle_operation, BUSY_ERROR};
#[cfg(test)]
pub(crate) use restart::restart_cavalry_guarded;
#[cfg(test)]
pub(crate) use status::{
    is_app_management_error, permission_action, status_for_paths, sync_state_with_bundle,
};
