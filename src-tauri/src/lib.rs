/**
 * [INPUT]: 依赖 tauri Builder/默认菜单、稳定 commands facade、共享 window_chrome/统一 About 窗口 owner/macOS permission handoff、Windows 提升 worker/uninstall restore/headless launch/QPA、共享 operation_lock/runtime_paths/diagnostics 与 platform_runtime。
 * [OUTPUT]: 提供 run、macOS 系统应用菜单与 Windows renderer 共用的独立 About 窗口、仅由 main WebView 执行的跨平台首帧显露、macOS Overlay 对齐与 Windows 透明外壳预初始化、App Management 原生交接、Windows 三类早期分流、Updater plugin、稳定九命令注册表及平台门控 runtime；启动期不探测或恢复语言事务 journal。
 * [POS]: src-tauri/src 的应用装配层；组合命令 facade、共享运行基础与进程入口边界，但不承载具体写入、事务恢复或系统命令业务。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
mod about_window;
pub mod bridge;
pub mod commands;
pub mod detect;
mod diagnostics;
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
const MAIN_PLATFORM_INIT_SCRIPT: &str = r#"
document.addEventListener('DOMContentLoaded', () => {
  document.documentElement.dataset.platform = 'macos';
  document.body.dataset.platform = 'macos';
  document.dispatchEvent(new CustomEvent('cavalry-platform-ready', { detail: 'macos' }));
  if (window.__TAURI_INTERNALS__.metadata.currentWindow.label !== 'main') return;
  requestAnimationFrame(() => {
    window.__TAURI_INTERNALS__.invoke('plugin:window|show', { label: 'main' })
      .then(() => window.__TAURI_INTERNALS__.invoke('plugin:window|set_focus', { label: 'main' }))
      .catch(() => {});
  });
}, { once: true });
"#;

#[cfg(target_os = "windows")]
const MAIN_PLATFORM_INIT_SCRIPT: &str = r#"
document.addEventListener('DOMContentLoaded', () => {
  document.documentElement.dataset.platform = 'windows';
  document.body.dataset.platform = 'windows';
  document.dispatchEvent(new CustomEvent('cavalry-platform-ready', { detail: 'windows' }));
  if (window.__TAURI_INTERNALS__.metadata.currentWindow.label !== 'main') return;
  requestAnimationFrame(() => {
    window.__TAURI_INTERNALS__.invoke('plugin:window|show', { label: 'main' })
      .then(() => window.__TAURI_INTERNALS__.invoke('plugin:window|set_focus', { label: 'main' }))
      .catch(() => {});
  });
}, { once: true });
"#;

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
    let builder = tauri::Builder::default().manage(commands::UpdaterState::default());

    #[cfg(target_os = "macos")]
    let builder = builder.menu(build_macos_menu).on_menu_event(|app, event| {
        if event.id().as_ref() == MACOS_ABOUT_MENU_ID {
            let _ = about_window::show_about_window(app);
        }
    });

    let builder = builder.append_invoke_initialization_script(MAIN_PLATFORM_INIT_SCRIPT);

    let builder = builder.on_page_load(|webview, payload| {
        use tauri::{webview::PageLoadEvent, Manager};

        if webview.label() == "main" && matches!(payload.event(), PageLoadEvent::Finished) {
            if let Some(window) = webview.app_handle().get_webview_window("main") {
                if !window.is_visible().unwrap_or(false) {
                    window
                        .show()
                        .and_then(|_| window.set_focus())
                        .expect("Main window could not be revealed after page load");
                }
            }
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

#[cfg(test)]
mod tests {
    use super::MAIN_PLATFORM_INIT_SCRIPT;

    #[test]
    fn platform_initialization_reveals_only_the_main_webview() {
        assert!(MAIN_PLATFORM_INIT_SCRIPT.contains("metadata.currentWindow.label !== 'main'"));
        assert!(MAIN_PLATFORM_INIT_SCRIPT.contains("plugin:window|show', { label: 'main' }"));
        assert!(MAIN_PLATFORM_INIT_SCRIPT.contains("plugin:window|set_focus', { label: 'main' }"));
    }
}
