/**
 * [INPUT]: 依赖 macos_permission_handoff.m 的固定 C ABI、Tauri main WebviewWindow 原生 NSView、有限 CSS source rect/viewport 与单次 PermissionHandoffEvent Channel。
 * [OUTPUT]: 对外提供 start_app_management_handoff 与 finish_app_management_handoff；前者把有限 CSS rect 交给 AppKit owner，后者只由真实 apply 结果触发 reverse/cleanup。
 * [POS]: src-tauri 的权限交接生命周期边界；不打开任意 URL、不读取 TCC、不执行语言事务，drag copy 只回报 retryRequested。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
use std::ffi::c_void;

use tauri::Manager;

use crate::commands::{PermissionHandoffEvent, PermissionSourceRect, PermissionViewportSize};

const OUTCOME_RETRY_REQUESTED: i32 = 1;
const OUTCOME_DISMISSED: i32 = 2;

type NativeCallback = unsafe extern "C" fn(*mut c_void, i32, bool);

unsafe extern "C" {
    fn cavalry_permission_handoff_start(
        native_view: *mut c_void,
        x: f64,
        y: f64,
        width: f64,
        height: f64,
        viewport_width: f64,
        viewport_height: f64,
        has_source_rect: bool,
        callback: NativeCallback,
        context: *mut c_void,
    );
    fn cavalry_permission_handoff_finish(reverse: bool);
}

struct CallbackContext {
    channel: tauri::ipc::Channel<PermissionHandoffEvent>,
}

unsafe extern "C" fn receive_native_outcome(context: *mut c_void, outcome: i32, terminal: bool) {
    if context.is_null() {
        return;
    }
    // SAFETY: native owner keeps context stable for the session and marks its last callback terminal.
    let callback = unsafe { &*context.cast::<CallbackContext>() };
    if outcome != 0 {
        let outcome = match outcome {
            OUTCOME_RETRY_REQUESTED => "retryRequested",
            OUTCOME_DISMISSED => "dismissed",
            _ => "error",
        };
        let _ = callback.channel.send(PermissionHandoffEvent {
            outcome: outcome.to_string(),
        });
    }
    if terminal {
        // SAFETY: terminal is emitted exactly once; it returns ownership of the Box to Rust.
        drop(unsafe { Box::from_raw(context.cast::<CallbackContext>()) });
    }
}

pub(crate) fn start_app_management_handoff(
    app: &tauri::AppHandle,
    source_rect: Option<PermissionSourceRect>,
    viewport_css: Option<PermissionViewportSize>,
    channel: tauri::ipc::Channel<PermissionHandoffEvent>,
) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "Main WebView window is unavailable".to_string())?;
    let native_view = window
        .ns_view()
        .map_err(|error| format!("Could not access the native macOS WebView: {error}"))?;
    let rect = source_rect.unwrap_or(PermissionSourceRect {
        x: 0.0,
        y: 0.0,
        width: 0.0,
        height: 0.0,
    });
    let viewport = viewport_css.unwrap_or(PermissionViewportSize {
        width: 0.0,
        height: 0.0,
    });
    let context = Box::into_raw(Box::new(CallbackContext { channel })).cast::<c_void>();
    // SAFETY: Tauri owns native_view for the main window lifetime; Objective-C copies all scalar
    // input synchronously and owns context until its single terminal callback.
    unsafe {
        cavalry_permission_handoff_start(
            native_view.cast(),
            rect.x,
            rect.y,
            rect.width,
            rect.height,
            viewport.width,
            viewport.height,
            source_rect.is_some(),
            receive_native_outcome,
            context,
        );
    }
    Ok(())
}

pub(crate) fn finish_app_management_handoff(reverse: bool) {
    // SAFETY: native owner serializes finish on AppKit's main queue and treats missing sessions as a no-op.
    unsafe { cavalry_permission_handoff_finish(reverse) }
}
