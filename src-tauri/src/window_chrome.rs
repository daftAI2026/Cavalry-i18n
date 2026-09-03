/**
 * [INPUT]: 依赖 Tauri WebviewWindow 与 macOS AppKit 原生窗口按钮；消费 renderer 共享 40px Overlay 标题栏契约。
 * [OUTPUT]: 对外提供 macOS 原生交通灯对齐；窗口缩放或 DPI 变化后重放 AppKit Chrome 几何。
 * [POS]: src-tauri 的 macOS 窗口 Chrome 边界；主窗口与 About 共同消费，Windows compositor alpha 外壳由平台配置和 renderer 共同持有。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

#[cfg(target_os = "macos")]
// AppKit 的交通灯容器相对 AX 外框左移 1pt；13pt 局部坐标在实机外框投影为 12pt。
const MACOS_TRAFFIC_LIGHT_X: f64 = 13.0;
#[cfg(target_os = "macos")]
const MACOS_TRAFFIC_LIGHT_Y: f64 = 22.0;

pub(crate) const TITLEBAR_HEIGHT: f64 = 40.0;

#[cfg(target_os = "macos")]
pub(crate) fn install_macos_traffic_light_alignment(
    window: &tauri::WebviewWindow,
) -> Result<(), String> {
    align_macos_traffic_lights(window)?;
    let alignment_window = window.clone();
    window.on_window_event(move |event| {
        if matches!(
            event,
            tauri::WindowEvent::Resized(_) | tauri::WindowEvent::ScaleFactorChanged { .. }
        ) {
            let _ = align_macos_traffic_lights(&alignment_window);
        }
    });
    Ok(())
}

#[cfg(target_os = "macos")]
fn align_macos_traffic_lights(window: &tauri::WebviewWindow) -> Result<(), String> {
    use objc2_app_kit::{NSWindow, NSWindowButton};

    let pointer = window
        .ns_window()
        .map_err(|error| format!("Could not access the native macOS window: {error}"))?;
    // SAFETY: Tauri 在 WebviewWindow 生命周期内持有该 NSWindow；调用方与
    // window-event 回调均位于 AppKit 事件循环，再进入下方原生控件修改。
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
