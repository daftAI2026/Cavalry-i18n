/**
 * [INPUT]: 依赖 commands 子模块、共享 operation_lock、Tauri command runtime/IPC Channel/startup recovery state 与 privilege facade。
 * [OUTPUT]: 保持九条稳定 Tauri command；renderer 只通过 apply transaction 自动建立恢复基线并执行语言切换或平台 Restore，不暴露独立 snapshot mutation；open_privacy_security 只接受固定 App Management 与有限 source rect；get_status 从安装现实重算 Windows residue并显式投影启动恢复阻断，apply 在同一 operation guard 内通过强类型 Channel 发送 verifyInstallation、ensureBaseline、applyTransaction、restartCavalry 四个真实阶段，受保护写事务提交即以真实 oracle 触发 macOS handoff reverse，再继续 restart 与最终业务结果，任何失败均回收 handoff；macOS 权限只消费 apply 层 typed payload，不再以错误字符串猜测；install_update 通过 camelCase onEvent Channel 投影 downloading、installing、restarting 三个真实更新边界；project link 只接受固定枚举，并在 facade 处把全部内部 warning prose 收敛为可组合 warningCodes；About 只转发到唯一原生窗口 owner；更新 command 只消费 Rust State 中的已检查 Update。
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
mod update;

use chrono::{SecondsFormat, Utc};
use std::path::PathBuf;

use crate::{operation_lock, privilege};

pub use apply::apply_language_inner;
pub(crate) use context::RESTORE_OFFICIAL_ACTION;
pub use contract::{
    ActionPayload, BrowsePayload, BundleDiagnostics, LanguageChoice, OperationEvent,
    PermissionHandoffEvent, PermissionHandoffPayload, PermissionHandoffRequest,
    PermissionSourceRect, PermissionViewportSize, StatusPayload,
};
pub use restart::restart_cavalry_inner;
#[cfg(test)]
pub use snapshot::extract_english_inner;
#[cfg(target_os = "windows")]
pub(crate) use snapshot::refresh_english_inner;
pub(crate) use update::UpdaterState;
pub use update::{UpdateEvent, UpdatePayload, UpdatePhase};

pub fn registered_command_names() -> &'static [&'static str] {
    &contract::COMMAND_NAMES
}

fn finalize_permission_handoff(payload: ActionPayload) -> ActionPayload {
    #[cfg(target_os = "macos")]
    if !payload.ok {
        crate::macos_permission_handoff::finish_app_management_handoff(false);
    }
    payload
}

fn complete_permission_handoff_after_commit() {
    #[cfg(target_os = "macos")]
    crate::macos_permission_handoff::finish_app_management_handoff(true);
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
pub async fn apply_language(
    app: tauri::AppHandle,
    app_path: String,
    lang: String,
    on_event: tauri::ipc::Channel<OperationEvent>,
) -> ActionPayload {
    let progress = contract::TauriOperationReporter::new(on_event);
    // 锁冲突与非法语言都属于 admission；在任何业务阶段开始前直接返回。
    if !context::is_supported_apply_action(&lang) {
        return finalize_permission_handoff(ActionPayload::error_with_code(
            "Unsupported language pack.",
            "unsupportedLanguage",
        ));
    }
    let paths = context::AppPaths::for_app(&app);
    let guard = match operation_lock::try_begin_bundle_operation(&paths.state_dir) {
        Ok(guard) => guard,
        Err(error) => {
            return finalize_permission_handoff(ActionPayload::error(&error.to_string()));
        }
    };
    let app_path = PathBuf::from(app_path);
    let now = Utc::now().to_rfc3339_opts(SecondsFormat::Millis, true);
    let worker_progress = progress.clone();
    let result =
        match tauri::async_runtime::spawn_blocking(move || -> Result<ActionPayload, String> {
            let _guard = guard;
            let mut runner = privilege::RealCommandRunner;
            let applied = match apply::apply_language_inner_with_reporter(
                &paths.repo_root,
                &paths.state_dir,
                &paths.resource_dir,
                &app_path,
                &lang,
                &mut runner,
                &now,
                worker_progress.clone(),
            ) {
                Ok(payload) => payload.into_renderer_contract(),
                Err(error) => return Err(error),
            };
            if !applied.ok {
                return Ok(applied);
            }
            // 受保护写事务已提交，权限 oracle 已成立；先回收 handoff，再继续普通重启阶段。
            complete_permission_handoff_after_commit();

            let mut restart_phase = contract::OperationPhaseGuard::start(
                &worker_progress,
                contract::OperationPhase::RestartCavalry,
            );
            match restart::restart_cavalry_inner(
                &paths.repo_root,
                &paths.state_dir,
                &paths.resource_dir,
                &app_path,
                &mut runner,
            ) {
                Ok(()) => {
                    restart_phase.completed();
                    Ok(applied)
                }
                Err(_) => {
                    // apply 已经提交；重启失败只能是可恢复 warning，不能回写为 apply error。
                    restart_phase.warning();
                    Ok(applied.with_warning_code(contract::RESTART_FAILED_WARNING_CODE))
                }
            }
        })
        .await
        {
            Ok(Ok(payload)) => payload,
            #[cfg(not(target_os = "macos"))]
            Ok(Err(error)) if status::is_app_management_error(&error) => {
                ActionPayload::permission_error(&error)
            }
            Ok(Err(error)) => ActionPayload::error(&error),
            Err(error) => ActionPayload::error(&format!("Language apply task failed: {error}")),
        };
    finalize_permission_handoff(result)
}

#[tauri::command]
pub async fn check_update(app: tauri::AppHandle) -> UpdatePayload {
    update::check_update_inner(app).await
}

#[tauri::command(rename_all = "camelCase")]
pub async fn install_update(
    app: tauri::AppHandle,
    on_event: tauri::ipc::Channel<UpdateEvent>,
) -> UpdatePayload {
    update::install_update_inner(app, update::TauriUpdateProgressReporter::new(on_event)).await
}

#[tauri::command]
pub fn open_privacy_security(
    app: tauri::AppHandle,
    request: PermissionHandoffRequest,
    on_event: tauri::ipc::Channel<PermissionHandoffEvent>,
) -> PermissionHandoffPayload {
    if !request.is_valid() {
        return PermissionHandoffPayload::error("invalidPermissionHandoffRequest");
    }
    #[cfg(target_os = "macos")]
    if crate::macos_permission_handoff::start_app_management_handoff(
        &app,
        request.source_rect,
        request.viewport_css,
        on_event,
    )
    .is_err()
    {
        return PermissionHandoffPayload::error("permissionHandoffStartFailed");
    }
    #[cfg(not(target_os = "macos"))]
    let _ = (app, on_event);
    let mut runner = privilege::RealCommandRunner;
    if privilege::open_privacy_security(&mut runner).is_err() {
        #[cfg(target_os = "macos")]
        crate::macos_permission_handoff::finish_app_management_handoff(false);
        return PermissionHandoffPayload::error("permissionSettingsOpenFailed");
    }
    PermissionHandoffPayload::opened()
}

#[tauri::command(rename_all = "camelCase")]
pub fn open_project_link(link: String) -> ActionPayload {
    let Some(link) = privilege::ProjectLink::from_id(&link) else {
        return ActionPayload::error("Unsupported project link.");
    };
    let mut runner = privilege::RealCommandRunner;
    match privilege::open_project_link(link, &mut runner) {
        Ok(()) => ActionPayload::ok(),
        Err(error) => ActionPayload::error(&error),
    }
}

#[tauri::command]
pub async fn show_about(app: tauri::AppHandle) -> ActionPayload {
    match crate::about_window::show_about_window(&app) {
        Ok(()) => ActionPayload::ok(),
        Err(_) => {
            ActionPayload::error_with_code("About window could not be opened.", "aboutOpenFailed")
        }
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
#[cfg(all(test, target_os = "windows"))]
pub(crate) use apply::build_windows_language_pairs;
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
