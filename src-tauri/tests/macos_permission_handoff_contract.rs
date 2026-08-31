/**
 * [INPUT]: 依赖 commands/contract、macos_permission_handoff Rust owner 与 native AppKit owner 的生产源码。
 * [OUTPUT]: 验证 App Management handoff 保持九命令内固定权限边界、CSS viewport 坐标合同、per-session Channel、真实 apply oracle、公开 file-URL drag、helper 非重叠垂直层级、Reduce Motion 与无 TCC/AX 自动化副作用。
 * [POS]: src-tauri/tests 的只读 macOS 权限交接守门；证明源码边界与可编译合同，不冒充首次授权、多屏或真实 System Settings drop 证据。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
use std::{fs, path::Path};

fn read(relative: &str) -> String {
    fs::read_to_string(Path::new(env!("CARGO_MANIFEST_DIR")).join(relative)).unwrap()
}

fn numeric_constant(source: &str, name: &str) -> f64 {
    let marker = format!("{name} = ");
    let tail = source
        .split_once(&marker)
        .unwrap_or_else(|| panic!("missing constant {name}"))
        .1;
    tail.split_once(';')
        .unwrap_or_else(|| panic!("unterminated constant {name}"))
        .0
        .trim()
        .parse()
        .unwrap_or_else(|_| panic!("constant {name} must remain numeric"))
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
        "CASpringAnimation",
        "CAVArrowMass",
        "CAVArrowStiffness",
        "CAVArrowDamping",
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

#[test]
fn native_helper_keeps_arrow_instruction_row_and_actions_disjoint() {
    let native = read("native/macos_permission_handoff.m");
    let helper_height = numeric_constant(&native, "CAVHelperHeight");
    let panel_inset = numeric_constant(&native, "CAVPanelInset");
    let arrow_size = numeric_constant(&native, "CAVArrowSize");
    let arrow_gap = numeric_constant(&native, "CAVArrowGap");
    let instruction_y = numeric_constant(&native, "CAVInstructionY");
    let instruction_height = numeric_constant(&native, "CAVInstructionHeight");
    let row_y = numeric_constant(&native, "CAVRowY");
    let row_height = numeric_constant(&native, "CAVRowHeight");
    let action_y = numeric_constant(&native, "CAVActionBottomInset");
    let action_height = numeric_constant(&native, "CAVActionHeight");
    let action_width = numeric_constant(&native, "CAVActionWidth");
    let arrow_mass = numeric_constant(&native, "CAVArrowMass");
    let arrow_stiffness = numeric_constant(&native, "CAVArrowStiffness");
    let arrow_damping = numeric_constant(&native, "CAVArrowDamping");

    assert!(action_y + action_height < row_y);
    assert!(
        action_width >= 88.0,
        "four-locale action labels must not truncate"
    );
    assert_eq!(
        (arrow_mass, arrow_stiffness, arrow_damping),
        (1.0, 200.0, 11.0)
    );
    assert!(row_y + row_height < instruction_y);
    assert!(
        instruction_y + instruction_height + arrow_gap + arrow_size <= helper_height - panel_inset
    );
    assert!(native.contains("CAVInstructionY + CAVInstructionHeight + CAVArrowGap"));
}

#[test]
fn native_owner_falls_back_without_a_source_and_cleans_up_lost_settings() {
    let native = read("native/macos_permission_handoff.m");

    assert!(native.contains(
        "BOOL staticFallback = self.reducedMotion || !self.sourceImage || NSIsEmptyRect(self.sourceScreenRect);"
    ));
    assert!(native.contains("if (staticFallback)"));
    assert!(native.contains("[self.helperPanel orderFront:nil]"));
    assert!(native.contains("self.missingSettingsAttempts < CAVSettingsMissingGrace"));
    assert!(native
        .contains("[self sendOutcome:CAVOutcomeDismissed terminal:YES];\n    [self cleanup];"));
    assert!(
        native.contains("[self sendOutcome:CAVOutcomeError terminal:YES];\n    [self cleanup];")
    );
    assert!(native.contains("- (BOOL)canBecomeKeyWindow { return NO; }"));
    assert!(native.contains("- (BOOL)canBecomeMainWindow { return NO; }"));
}
