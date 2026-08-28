/**
 * [INPUT]: 依赖 Tauri AppHandle、About 本地页面与固定 `about` 窗口标签；页面内部只消费冻结 bridge 的版本和项目链接能力。
 * [OUTPUT]: 对外提供唯一的 About WebviewWindow owner；首次调用懒创建独立原生装饰窗口，后续调用只显示并聚焦既有窗口。
 * [POS]: src-tauri 的 About 窗口边界；被 macOS 应用菜单和 Windows renderer command 共同调用，不承载页面内容、外部 URL 或业务状态。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
use tauri::{Manager, WebviewUrl, WebviewWindow, WebviewWindowBuilder};

pub(crate) const ABOUT_WINDOW_LABEL: &str = "about";

const ABOUT_WINDOW_WIDTH: f64 = 320.0;
const ABOUT_WINDOW_HEIGHT: f64 = 300.0;
const ABOUT_WINDOW_TITLE: &str = "About Cavalry Language Switcher";

pub(crate) fn show_about_window(app: &tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(ABOUT_WINDOW_LABEL) {
        return reveal(&window);
    }

    let window = match WebviewWindowBuilder::new(
        app,
        ABOUT_WINDOW_LABEL,
        WebviewUrl::App("about.html".into()),
    )
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
    .visible(true)
    .build()
    {
        Ok(window) => window,
        Err(error) => {
            // 两次调用可能同时发现窗口不存在；若另一条调用已完成创建，复用它。
            if let Some(window) = app.get_webview_window(ABOUT_WINDOW_LABEL) {
                return reveal(&window);
            }
            return Err(format!("About window could not be created: {error}"));
        }
    };

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
