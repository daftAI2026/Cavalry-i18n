/**
 * [INPUT]: 依赖 macos_permission_handoff.m 的固定 C ABI、Tauri main WebviewWindow 原生 NSView、有限 CSS source rect/viewport、单次 PermissionHandoffEvent Channel 与 state 目录耐久 marker。
 * [OUTPUT]: 对外提供首次受保护写入前的 handoff admission、durable presented marker，以及 start/finish App Management handoff；真实 apply 仍是唯一权限成功 oracle。
 * [POS]: src-tauri 的权限交接生命周期边界；首次引导未呈现时阻止 Cavalry 写事务，不读取 TCC、不执行语言事务，marker 只证明设置引导已打开，drag copy 只回报 retryRequested。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
use std::{
    ffi::c_void,
    fs::{self, OpenOptions},
    io::Write,
    os::unix::fs::OpenOptionsExt,
    path::Path,
};

use tauri::Manager;

use crate::commands::{PermissionHandoffEvent, PermissionSourceRect, PermissionViewportSize};

const OUTCOME_RETRY_REQUESTED: i32 = 1;
const OUTCOME_DISMISSED: i32 = 2;
const HANDOFF_MARKER_NAME: &str = "app-management-handoff-v1";
const HANDOFF_MARKER_BYTES: &[u8] = b"presented\n";

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

/// App Management 没有公开只读授权 API。marker 只证明系统引导已经呈现；
/// 真正受保护写事务成功仍是唯一权限 oracle。历史成功 apply 跳过一次性引导。
pub(crate) fn preflight_required(state_dir: &Path) -> bool {
    let marker = state_dir.join(HANDOFF_MARKER_NAME);
    if fs::symlink_metadata(&marker)
        .ok()
        .is_some_and(|metadata| metadata.is_file() && !metadata.file_type().is_symlink())
        && fs::read(&marker).ok().as_deref() == Some(HANDOFF_MARKER_BYTES)
    {
        return false;
    }
    crate::state::read_state_strict(state_dir)
        .map(|state| state.last_patched_at.trim().is_empty())
        .unwrap_or(true)
}

pub(crate) fn record_handoff_presented(state_dir: &Path) -> Result<(), String> {
    fs::create_dir_all(state_dir).map_err(|error| {
        format!("Could not create state directory before App Management handoff: {error}")
    })?;
    if !preflight_required(state_dir) {
        return Ok(());
    }
    let marker = state_dir.join(HANDOFF_MARKER_NAME);
    let temporary = state_dir.join(format!(".{HANDOFF_MARKER_NAME}.{}.tmp", std::process::id()));
    let result = (|| {
        let mut file = OpenOptions::new()
            .write(true)
            .create_new(true)
            .mode(0o600)
            .open(&temporary)
            .map_err(|error| format!("Could not create App Management marker: {error}"))?;
        file.write_all(HANDOFF_MARKER_BYTES)
            .and_then(|()| file.sync_all())
            .map_err(|error| format!("Could not persist App Management marker: {error}"))?;
        fs::rename(&temporary, &marker)
            .map_err(|error| format!("Could not publish App Management marker: {error}"))?;
        fs::File::open(state_dir)
            .and_then(|directory| directory.sync_all())
            .map_err(|error| format!("Could not confirm App Management marker durability: {error}"))
    })();
    if result.is_err() {
        let _ = fs::remove_file(&temporary);
    }
    result
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

#[cfg(test)]
mod tests {
    use super::{preflight_required, record_handoff_presented};

    #[test]
    fn durable_marker_changes_only_the_first_handoff_admission() {
        let temp = tempfile::tempdir().unwrap();
        assert!(preflight_required(temp.path()));
        record_handoff_presented(temp.path()).unwrap();
        assert!(!preflight_required(temp.path()));
        record_handoff_presented(temp.path()).unwrap();
        assert!(!preflight_required(temp.path()));
    }
}
