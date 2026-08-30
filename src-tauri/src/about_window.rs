/**
 * [INPUT]: 依赖 Tauri AppHandle、About 本地页面、固定 `about` 窗口标签与共享 window_chrome；页面内部只消费冻结 bridge 的版本和项目链接能力。
 * [OUTPUT]: 对外提供唯一的 About WebviewWindow owner；macOS 复用主窗口 Overlay/hidden-title/交通灯几何，Windows 保留原生装饰，后续调用只显示并聚焦既有窗口。
 * [POS]: src-tauri 的 About 窗口边界；被 macOS 应用菜单和 Windows renderer command 共同调用，只选择平台 Chrome，不承载页面内容、外部 URL 或业务状态。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
use tauri::{Manager, WebviewUrl, WebviewWindow, WebviewWindowBuilder};

pub(crate) const ABOUT_WINDOW_LABEL: &str = "about";

const ABOUT_WINDOW_WIDTH: f64 = 320.0;
const ABOUT_BODY_HEIGHT: f64 = 268.0;
#[cfg(target_os = "macos")]
const ABOUT_WINDOW_HEIGHT: f64 = ABOUT_BODY_HEIGHT + crate::window_chrome::TITLEBAR_HEIGHT;
#[cfg(not(target_os = "macos"))]
const ABOUT_WINDOW_HEIGHT: f64 = ABOUT_BODY_HEIGHT;
const ABOUT_WINDOW_TITLE: &str = "About Cavalry Language Switcher";

#[cfg(target_os = "macos")]
const ABOUT_PLATFORM_INIT_SCRIPT: &str = "document.documentElement.dataset.platform = 'macos';";
#[cfg(target_os = "windows")]
const ABOUT_PLATFORM_INIT_SCRIPT: &str = "document.documentElement.dataset.platform = 'windows';";
#[cfg(not(any(target_os = "macos", target_os = "windows")))]
const ABOUT_PLATFORM_INIT_SCRIPT: &str = "document.documentElement.dataset.platform = 'other';";

pub(crate) fn show_about_window(app: &tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(ABOUT_WINDOW_LABEL) {
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
    .decorations(true)
    .center()
    .focused(true)
    .visible(true);

    #[cfg(target_os = "macos")]
    let builder = builder
        .title_bar_style(tauri::TitleBarStyle::Overlay)
        .hidden_title(true);

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

    reveal(&window)
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
