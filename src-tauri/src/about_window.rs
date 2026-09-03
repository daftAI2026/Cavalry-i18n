/**
 * [INPUT]: 依赖 Tauri AppHandle、About 本地页面、固定 `about` 窗口标签与共享 window_chrome；页面内部只消费冻结 bridge 的版本、关闭和项目链接能力。
 * [OUTPUT]: 对外提供唯一的 288px 内容宽 About WebviewWindow owner；macOS 复用主窗口 Overlay/hidden-title/交通灯，Windows 使用无系统标题栏的透明 compositor 外壳并为 10px 自绘阴影扩展窗口尺寸，同时以 main 为原生 owner 保证主窗口关闭时一并销毁；每次打开按主窗口实时物理外框居中并约束在同一显示器，几何不可用时回退屏幕居中。
 * [POS]: src-tauri 的 About 窗口边界；被 macOS 应用菜单和 Windows renderer command 共同调用，主窗口与 About 的外壳几何保持同源，不承载页面内容、外部 URL 或业务状态。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
use tauri::{Manager, WebviewUrl, WebviewWindow, WebviewWindowBuilder};

pub(crate) const ABOUT_WINDOW_LABEL: &str = "about";

const ABOUT_BODY_WIDTH: f64 = 288.0;
const ABOUT_BODY_HEIGHT: f64 = 268.0;
#[cfg(target_os = "windows")]
const WINDOW_SHADOW_INSET: f64 = 10.0;
#[cfg(target_os = "windows")]
const ABOUT_WINDOW_WIDTH: f64 = ABOUT_BODY_WIDTH + WINDOW_SHADOW_INSET * 2.0;
#[cfg(not(target_os = "windows"))]
const ABOUT_WINDOW_WIDTH: f64 = ABOUT_BODY_WIDTH;
#[cfg(target_os = "windows")]
const ABOUT_WINDOW_HEIGHT: f64 =
    ABOUT_BODY_HEIGHT + crate::window_chrome::TITLEBAR_HEIGHT + WINDOW_SHADOW_INSET * 2.0;
#[cfg(target_os = "macos")]
const ABOUT_WINDOW_HEIGHT: f64 = ABOUT_BODY_HEIGHT + crate::window_chrome::TITLEBAR_HEIGHT;
#[cfg(not(any(target_os = "macos", target_os = "windows")))]
const ABOUT_WINDOW_HEIGHT: f64 = ABOUT_BODY_HEIGHT;
const ABOUT_WINDOW_TITLE: &str = "About Cavalry Language Switcher";

#[cfg(target_os = "macos")]
const ABOUT_PLATFORM_INIT_SCRIPT: &str = "document.addEventListener('DOMContentLoaded', () => { document.documentElement.dataset.platform = 'macos'; document.body.dataset.platform = 'macos'; document.dispatchEvent(new CustomEvent('cavalry-platform-ready', { detail: 'macos' })); }, { once: true });";
#[cfg(target_os = "windows")]
const ABOUT_PLATFORM_INIT_SCRIPT: &str = "document.addEventListener('DOMContentLoaded', () => { document.documentElement.dataset.platform = 'windows'; document.body.dataset.platform = 'windows'; document.dispatchEvent(new CustomEvent('cavalry-platform-ready', { detail: 'windows' })); }, { once: true });";
#[cfg(not(any(target_os = "macos", target_os = "windows")))]
const ABOUT_PLATFORM_INIT_SCRIPT: &str = "document.documentElement.dataset.platform = 'other';";

pub(crate) fn show_about_window(app: &tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(ABOUT_WINDOW_LABEL) {
        position_over_main(app, &window)?;
        return reveal(&window);
    }

    let builder = WebviewWindowBuilder::new(
        app,
        ABOUT_WINDOW_LABEL,
        WebviewUrl::App("about.html".into()),
    )
    .initialization_script(ABOUT_PLATFORM_INIT_SCRIPT)
    .title(ABOUT_WINDOW_TITLE)
    .inner_size(ABOUT_WINDOW_WIDTH, ABOUT_WINDOW_HEIGHT)
    .min_inner_size(ABOUT_WINDOW_WIDTH, ABOUT_WINDOW_HEIGHT)
    .max_inner_size(ABOUT_WINDOW_WIDTH, ABOUT_WINDOW_HEIGHT)
    .resizable(false)
    .maximizable(false)
    .minimizable(false)
    .closable(true)
    .focused(true)
    .visible(false);

    #[cfg(target_os = "macos")]
    let builder = builder
        .decorations(true)
        .title_bar_style(tauri::TitleBarStyle::Overlay)
        .hidden_title(true);

    #[cfg(target_os = "windows")]
    let builder = builder.decorations(false).transparent(true).shadow(false);

    #[cfg(target_os = "windows")]
    let builder = {
        let main = app
            .get_webview_window("main")
            .ok_or_else(|| "Main window is unavailable for About ownership".to_string())?;
        builder
            .owner(&main)
            .map_err(|error| format!("About window could not attach to main: {error}"))?
    };

    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    let builder = builder.decorations(true);

    let window = match builder.build() {
        Ok(window) => window,
        Err(error) => {
            // 两次调用可能同时发现窗口不存在；若另一条调用已完成创建，复用它。
            if let Some(window) = app.get_webview_window(ABOUT_WINDOW_LABEL) {
                return reveal(&window);
            }
            return Err(format!("About window could not be created: {error}"));
        }
    };

    #[cfg(target_os = "macos")]
    crate::window_chrome::install_macos_traffic_light_alignment(&window)?;

    position_over_main(app, &window)?;
    reveal(&window)
}

fn position_over_main(app: &tauri::AppHandle, window: &WebviewWindow) -> Result<(), String> {
    let Some(main) = app.get_webview_window("main") else {
        return window
            .center()
            .map_err(|error| format!("About window could not be centered: {error}"));
    };
    let main_position = main
        .outer_position()
        .map_err(|error| format!("Could not read main window position: {error}"))?;
    let main_size = main
        .outer_size()
        .map_err(|error| format!("Could not read main window size: {error}"))?;
    let about_size = window
        .outer_size()
        .map_err(|error| format!("Could not read About window size: {error}"))?;

    let mut x =
        i64::from(main_position.x) + (i64::from(main_size.width) - i64::from(about_size.width)) / 2;
    let mut y = i64::from(main_position.y)
        + (i64::from(main_size.height) - i64::from(about_size.height)) / 2;
    if let Some(monitor) = main
        .current_monitor()
        .map_err(|error| format!("Could not read main window monitor: {error}"))?
    {
        let monitor_position = monitor.position();
        let monitor_size = monitor.size();
        let min_x = i64::from(monitor_position.x);
        let min_y = i64::from(monitor_position.y);
        let max_x = min_x + i64::from(monitor_size.width) - i64::from(about_size.width);
        let max_y = min_y + i64::from(monitor_size.height) - i64::from(about_size.height);
        x = x.clamp(min_x, max_x.max(min_x));
        y = y.clamp(min_y, max_y.max(min_y));
    }
    window
        .set_position(tauri::PhysicalPosition::new(x as i32, y as i32))
        .map_err(|error| format!("About window could not be positioned: {error}"))
}

fn reveal(window: &WebviewWindow) -> Result<(), String> {
    window
        .show()
        .map_err(|error| format!("About window could not be shown: {error}"))?;
    window
        .set_focus()
        .map_err(|error| format!("About window could not be focused: {error}"))?;
    Ok(())
}
