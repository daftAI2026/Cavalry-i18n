/**
 * [INPUT]: 依赖 commands/contract、macos_permission_handoff Rust owner 与 native AppKit owner 的生产源码。
 * [OUTPUT]: 验证 App Management handoff 保持九命令内固定权限边界、CSS viewport 坐标合同、per-session Channel、真实 apply oracle、公开 file-URL drag、Reduce Motion 与无 TCC/AX 自动化副作用。
 * [POS]: src-tauri/tests 的只读 macOS 权限交接守门；证明源码边界与可编译合同，不冒充首次授权、多屏或真实 System Settings drop 证据。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
use std::{fs, path::Path};

fn read(relative: &str) -> String {
    fs::read_to_string(Path::new(env!("CARGO_MANIFEST_DIR")).join(relative)).unwrap()
}

#[test]
fn handoff_stays_inside_the_fixed_command_and_real_apply_oracle() {
    let commands = read("src/commands.rs");
    let contract = read("src/commands/contract.rs");
    let rust_owner = read("src/macos_permission_handoff.rs");

    assert!(commands.contains("pub fn open_privacy_security("));
    assert!(commands.contains("request: PermissionHandoffRequest"));
    assert!(commands.contains("on_event: tauri::ipc::Channel<PermissionHandoffEvent>"));
    assert!(commands.contains("finalize_permission_handoff(result)"));
    assert!(commands.contains("payload.permission_required"));
    assert!(!commands.contains("start_permission_handoff"));
    assert!(contract.contains("self.permission == \"appManagement\""));
    assert!(contract.contains("viewport_css"));
    assert!(contract.contains("match (self.source_rect, self.viewport_css)"));
    assert!(contract.contains("(None, None) => true"));
    assert!(commands.contains("finish_app_management_handoff(true)"));
    assert!(rust_owner.contains("PermissionHandoffEvent"));
}

#[test]
fn native_owner_uses_public_dragging_and_never_edits_permission_state() {
    let native = read("native/macos_permission_handoff.m");

    for required in [
        "NSWindowStyleMaskNonactivatingPanel",
        "NSPasteboardTypeFileURL",
        "NSDragOperationCopy",
        "beginDraggingSessionWithItems",
        "accessibilityDisplayShouldReduceMotion",
        "accessibilityDisplayShouldReduceTransparency",
        "CGWindowListCopyWindowInfo",
        "CAVOutcomeRetryRequested",
    ] {
        assert!(
            native.contains(required),
            "missing native boundary: {required}"
        );
    }
    for forbidden in [
        "TCC.db",
        "AXUIElement",
        "CGEventPost",
        "sqlite3",
        "kTCCService",
        "ScreenCaptureKit",
    ] {
        assert!(
            !native.contains(forbidden),
            "forbidden permission automation: {forbidden}"
        );
    }
}
