/**
 * [INPUT]: 依赖 commands/contract、macos_permission_handoff Rust owner 与 native AppKit owner 的生产源码。
 * [OUTPUT]: 验证 App Management handoff 保持九命令内固定权限边界、CSS viewport 坐标合同、per-session Channel、受保护写事务 commit 后先 reverse 再 restart 的真实 apply oracle、finalizer 不重复触发成功 reverse、整条实时 App row 快照承载且只在 System Settings 整窗内接受的 file-URL Copy drag、helper 非重叠垂直层级、Reduce Motion 与无 TCC/AX 自动化副作用。
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
fn protected_commit_starts_reverse_before_restart_and_finalizer_only_cleans_failures() {
    let commands = read("src/commands.rs");

    let finalizer_start = commands
        .find("fn finalize_permission_handoff(payload: ActionPayload)")
        .expect("permission finalizer missing");
    let finalizer_end = commands
        .find("fn complete_permission_handoff_after_commit()")
        .expect("protected-commit handoff helper missing");
    let finalizer = &commands[finalizer_start..finalizer_end];
    assert!(finalizer.contains("if !payload.ok && !payload.permission_required"));
    assert!(!finalizer.contains("finish_app_management_handoff(true)"));

    let apply_start = commands
        .find("let applied = match apply::apply_language_inner_with_reporter")
        .expect("protected apply call missing");
    let apply_gate = commands[apply_start..]
        .find("if !applied.ok")
        .map(|offset| apply_start + offset)
        .expect("protected apply result gate missing");
    let reverse_start = commands
        .find("complete_permission_handoff_after_commit();")
        .expect("commit reverse trigger missing");
    let restart_start = commands
        .find("let mut restart_phase = contract::OperationPhaseGuard::start")
        .expect("restart phase missing");

    assert!(apply_start < apply_gate);
    assert!(
        apply_gate < reverse_start,
        "reverse must follow the protected apply result"
    );
    assert!(
        reverse_start < restart_start,
        "reverse must begin before restart"
    );
    assert!(commands[apply_gate..reverse_start].contains("return Ok(applied);"));
    assert_eq!(
        commands
            .matches("finish_app_management_handoff(true)")
            .count(),
        1,
        "successful reverse must have one commit-time call site"
    );
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
        "NSRect screenFrame = CAVIntegralRectForScale(screen.frame, scale)",
        "initWithScreen:screen frame:screenFrame",
        "NSPasteboardItemDataProvider",
        "[pasteboardItem setDataProvider:self forTypes:@[NSPasteboardTypeFileURL]]",
        "provideDataForType:(NSPasteboardType)type",
        "NSImage *dragImage = CAVSnapshot(self, dragFrame)",
        "[item setDraggingFrame:dragFrame contents:dragImage]",
        "draggingSession:(NSDraggingSession *)session willBeginAtPoint:(NSPoint)screenPoint",
        "self.hidden = YES",
        "self.hidden = NO",
    ] {
        assert!(
            native.contains(required),
            "missing native boundary: {required}"
        );
    }
    for rejected_target_mismatch in [
        "CAVDragImageSize",
        "icon.size = NSMakeSize",
        "CAVDragThreshold",
        "mouseDragged:(NSEvent *)event",
        "CAVTransitionCorridor",
        "sliceFrame",
    ] {
        assert!(
            !native.contains(rejected_target_mismatch),
            "target sample contract forbids this drag/overlay mismatch: {rejected_target_mismatch}"
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
fn native_drop_retry_requires_copy_inside_the_live_settings_window() {
    let native = read("native/macos_permission_handoff.m");

    assert!(native.contains(
        "dragDidEndWithOperation:(NSDragOperation)operation atScreenPoint:(NSPoint)screenPoint"
    ));
    assert!(native.contains("NSRect currentSettingsFrame = CAVSystemSettingsWindowFrame();"));
    assert!(native.contains("BOOL copyAccepted = operation == NSDragOperationCopy;"));
    assert!(native.contains("NSPointInRect(screenPoint, currentSettingsFrame)"));
    assert!(native.contains("if (copyAccepted && endedInsideSettings)"));
    assert!(!native.contains("if ((operation & NSDragOperationCopy) != CAVZero)"));
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
