/**
 * [INPUT]: 依赖 tauri Builder/默认菜单、稳定 commands facade、共享 window_chrome/统一 About 窗口 owner/macOS permission handoff/启动恢复、Windows 提升 worker/uninstall restore/headless launch/QPA、共享 operation_lock/runtime_paths 与 platform_runtime。
 * [OUTPUT]: 提供 run、macOS 系统应用菜单与 Windows renderer 共用的独立 About 窗口、共享 Overlay 标题栏装配、App Management 原生交接与 pending journal 恢复、Windows 三类早期分流、Updater plugin、稳定九命令注册表及平台门控 runtime。
 * [POS]: src-tauri/src 的应用装配层；组合命令 facade、启动恢复、共享运行基础与进程入口边界，但不承载具体写入或系统命令业务。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
mod about_window;
pub mod bridge;
pub mod commands;
pub mod detect;
#[cfg(target_os = "windows")]
pub mod headless_launch;
pub mod install;
pub mod keychain_patch;
#[cfg(target_os = "macos")]
mod mac_official;
pub mod mac_runtime;
#[cfg(target_os = "macos")]
mod macos_permission_handoff;
mod operation_lock;
pub mod patch;
mod platform_runtime;
pub mod privilege;
mod runtime_paths;
mod startup_recovery;
pub mod state;
#[cfg(target_os = "windows")]
pub mod uninstall_restore;
mod window_chrome;
pub mod windows_install;
#[cfg(target_os = "windows")]
pub mod windows_qpa;
#[cfg(target_os = "windows")]
pub mod windows_runtime;

#[cfg(target_os = "macos")]
const MACOS_ABOUT_MENU_ID: &str = "cavalry-i18n-about";

#[cfg(target_os = "macos")]
fn build_macos_menu(app: &tauri::AppHandle) -> tauri::Result<tauri::menu::Menu<tauri::Wry>> {
    use tauri::menu::{Menu, MenuItem, MenuItemKind};

    let menu = Menu::default(app)?;
    let Some(MenuItemKind::Submenu(app_menu)) = menu.items()?.into_iter().next() else {
        return Err(tauri::Error::AssetNotFound("macOS application menu".into()));
    };
    app_menu.remove_at(0)?;
    let about = MenuItem::with_id(
        app,
        MACOS_ABOUT_MENU_ID,
        format!("About {}", app.package_info().name),
        true,
        None::<&str>,
    )?;
    app_menu.insert(&about, 0)?;
    Ok(menu)
}

#[cfg(target_os = "windows")]
pub fn dispatch_elevated_language_worker_current_process() -> Option<u32> {
    privilege::dispatch_elevated_language_worker_current_process()
}

#[cfg(target_os = "windows")]
pub fn dispatch_uninstall_restore_current_process() -> Option<i32> {
    uninstall_restore::dispatch_current_process()
}

pub fn run() {
    let builder = tauri::Builder::default()
        .manage(commands::UpdaterState::default())
        .manage(startup_recovery::StartupRecoveryStatus::default());

    #[cfg(target_os = "macos")]
    let builder = builder.menu(build_macos_menu).on_menu_event(|app, event| {
        if event.id().as_ref() == MACOS_ABOUT_MENU_ID {
            let _ = about_window::show_about_window(app);
        }
    });

    builder
        .setup(|app| {
            use tauri::Manager;

            #[cfg(target_os = "macos")]
            {
                let main_window = app
                    .get_webview_window("main")
                    .ok_or_else(|| "Main WebView window is unavailable".to_string())?;
                window_chrome::install_macos_traffic_light_alignment(&main_window)?;
            }

            // 共享配置存在时才装配官方 updater；保留缺配置时的可启动失败关闭边界。
            if app.config().plugins.0.contains_key("updater") {
                app.handle()
                    .plugin(tauri_plugin_updater::Builder::new().build())
                    .map_err(|error| format!("Failed to initialize updater plugin: {error}"))?;
            }

            let state_dir = runtime_paths::resolve_state_dir(app.path().app_data_dir().ok());
            let mut runner = privilege::RealCommandRunner;
            let result = startup_recovery::recover_at_startup(&state_dir, &mut runner)
                .map_err(|error| format!("Startup recovery blocked normal operations: {error}"));
            app.state::<startup_recovery::StartupRecoveryStatus>()
                .record(result);
            Ok(())
        })
        .append_invoke_initialization_script(bridge::script())
        .invoke_handler(tauri::generate_handler![
            commands::get_status,
            commands::browse_app,
            commands::apply_language,
            commands::open_privacy_security,
            commands::open_project_link,
            commands::show_about,
            commands::restart_cavalry,
            commands::check_update,
            commands::install_update
        ])
        .run(tauri::generate_context!())
        .expect("failed to run Cavalry-i18n Tauri app");
}
