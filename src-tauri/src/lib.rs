/**
 * [INPUT]: 依赖 tauri Builder、稳定 commands facade、macOS AppKit 原生窗口控件/启动恢复、Windows 提升 worker/uninstall restore/headless launch/QPA、共享 operation_lock/runtime_paths 与 platform_runtime。
 * [OUTPUT]: 提供 run、macOS 40px 标题区内上下各留 12px 的原生交通灯对齐与 pending journal 恢复、Windows 三类早期分流、Updater plugin、稳定八命令注册表及平台门控 runtime。
 * [POS]: src-tauri/src 的应用装配层；组合命令 facade、启动恢复、共享运行基础与进程入口边界，但不承载具体写入或系统命令业务。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
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
mod operation_lock;
pub mod patch;
mod platform_runtime;
pub mod privilege;
mod runtime_paths;
mod startup_recovery;
pub mod state;
#[cfg(target_os = "windows")]
pub mod uninstall_restore;
pub mod windows_install;
#[cfg(target_os = "windows")]
pub mod windows_qpa;
#[cfg(target_os = "windows")]
pub mod windows_runtime;

#[cfg(target_os = "macos")]
// AppKit 的交通灯容器相对 AX 外框左移 1pt；13pt 局部坐标在实机外框投影为 12pt。
const MACOS_TRAFFIC_LIGHT_X: f64 = 13.0;
#[cfg(target_os = "macos")]
const MACOS_TRAFFIC_LIGHT_Y: f64 = 22.0;

#[cfg(target_os = "macos")]
fn align_macos_traffic_lights(window: &tauri::WebviewWindow) -> Result<(), String> {
    use objc2_app_kit::{NSWindow, NSWindowButton};

    let pointer = window
        .ns_window()
        .map_err(|error| format!("Could not access the native macOS window: {error}"))?;
    // SAFETY: Tauri 在 WebviewWindow 生命周期内持有该 NSWindow；setup 与
    // window-event 回调均在 AppKit 事件循环线程执行，再进入下方原生控件修改。
    unsafe {
        let native_window: &NSWindow = &*pointer.cast();
        let close = native_window
            .standardWindowButton(NSWindowButton::CloseButton)
            .ok_or_else(|| "Native macOS close button is unavailable".to_string())?;
        let minimize = native_window
            .standardWindowButton(NSWindowButton::MiniaturizeButton)
            .ok_or_else(|| "Native macOS minimize button is unavailable".to_string())?;
        let zoom = native_window
            .standardWindowButton(NSWindowButton::ZoomButton)
            .ok_or_else(|| "Native macOS zoom button is unavailable".to_string())?;
        let container = close
            .superview()
            .and_then(|view| view.superview())
            .ok_or_else(|| "Native macOS title bar container is unavailable".to_string())?;

        let close_frame = close.frame();
        let mut container_frame = container.frame();
        container_frame.size.height = close_frame.size.height + MACOS_TRAFFIC_LIGHT_Y;
        container_frame.origin.y = native_window.frame().size.height - container_frame.size.height;
        container.setFrame(container_frame);

        let spacing = minimize.frame().origin.x - close_frame.origin.x;
        for (index, button) in [close, minimize, zoom].into_iter().enumerate() {
            let mut origin = button.frame().origin;
            origin.x = MACOS_TRAFFIC_LIGHT_X + index as f64 * spacing;
            button.setFrameOrigin(origin);
        }
    }
    Ok(())
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
    tauri::Builder::default()
        .manage(commands::UpdaterState::default())
        .manage(startup_recovery::StartupRecoveryStatus::default())
        .setup(|app| {
            use tauri::Manager;

            #[cfg(target_os = "macos")]
            {
                let main_window = app
                    .get_webview_window("main")
                    .ok_or_else(|| "Main WebView window is unavailable".to_string())?;
                align_macos_traffic_lights(&main_window)?;
                let alignment_window = main_window.clone();
                main_window.on_window_event(move |event| {
                    if matches!(
                        event,
                        tauri::WindowEvent::Resized(_)
                            | tauri::WindowEvent::ScaleFactorChanged { .. }
                    ) {
                        let _ = align_macos_traffic_lights(&alignment_window);
                    }
                });
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
            commands::extract_english,
            commands::apply_language,
            commands::open_privacy_security,
            commands::restart_cavalry,
            commands::check_update,
            commands::install_update
        ])
        .run(tauri::generate_context!())
        .expect("failed to run Cavalry-i18n Tauri app");
}
