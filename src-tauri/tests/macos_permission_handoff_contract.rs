/**
 * [INPUT]: 依赖 commands/contract/update、macos_permission_handoff Rust owner 与 native AppKit owner 的生产源码。
 * [OUTPUT]: 验证 App Management handoff 保持九命令内固定权限边界、CSS viewport 坐标合同、per-session Channel、drop 后同进程 oracle、任何失败均 cleanup、受保护写事务 commit 后先 reverse 再打开 Cavalry、透明底整条实时 App row 快照且只在 System Settings 整窗内接受的 file-URL Copy drag、参考同形 532×112 helper 的单行指令 / Back + App row 几何、single motion surface 的内容与 shadow/stroke 共用边界、底部锚定且带 overscan 的箭头 spring、Reduce Motion 与无 TCC/AX 自动化副作用；权限链不主动重启 Switcher，系统“退出并重新打开”只产生待实机确认的新会话语义，程序 self-restart 只允许 updater 安装完成后持有。
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
    let update = read("src/commands/update.rs");

    assert!(commands.contains("pub fn open_privacy_security("));
    assert!(commands.contains("request: PermissionHandoffRequest"));
    assert!(commands.contains("on_event: tauri::ipc::Channel<PermissionHandoffEvent>"));
    assert!(commands.contains("finalize_permission_handoff(result)"));
    assert!(!commands.contains("!payload.permission_required"));
    assert!(!commands.contains("start_permission_handoff"));
    assert!(contract.contains("self.permission == \"appManagement\""));
    assert!(contract.contains("viewport_css"));
    assert!(contract.contains("match (self.source_rect, self.viewport_css)"));
    assert!(contract.contains("(None, None) => true"));
    assert!(commands.contains("finish_app_management_handoff(true)"));
    assert!(rust_owner.contains("PermissionHandoffEvent"));
    assert!(
        !commands.contains("app.restart()"),
        "permission commands must not duplicate macOS-managed Quit & Reopen"
    );
    assert_eq!(
        update.matches("app.restart()").count(),
        1,
        "programmatic Switcher self-restart belongs only to the completed updater install path"
    );
}

#[test]
fn protected_commit_starts_reverse_before_restart_and_finalizer_cleans_every_failure() {
    let commands = read("src/commands.rs");

    let finalizer_start = commands
        .find("fn finalize_permission_handoff(payload: ActionPayload)")
        .expect("permission finalizer missing");
    let finalizer_end = commands
        .find("fn complete_permission_handoff_after_commit()")
        .expect("protected-commit handoff helper missing");
    let finalizer = &commands[finalizer_start..finalizer_end];
    assert!(finalizer.contains("if !payload.ok"));
    assert!(!finalizer.contains("payload.permission_required"));
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
        "[panel addChildWindow:arrowPanel ordered:NSWindowAbove]",
        "arrowPanel.ignoresMouseEvents = NO",
        "NSTrackingMouseEnteredAndExited",
        "arrow.onHover = ^{ [weakSelf stretchArrow:nil]; }",
        "NSPasteboardItemDataProvider",
        "[pasteboardItem setDataProvider:self forTypes:@[NSPasteboardTypeFileURL]]",
        "provideDataForType:(NSPasteboardType)type",
        "NSImage *dragImage = CAVSnapshot(self.appRowView, self.appRowView.bounds)",
        "[item setDraggingFrame:dragFrame contents:dragImage]",
        "draggingSession:(NSDraggingSession *)session willBeginAtPoint:(NSPoint)screenPoint",
        "self.appRowView.hidden = YES",
        "self.appRowView.hidden = NO",
        "NSBox *box",
        "NSView *appRowView",
        "CAVFlippedView",
        "[_appRowView addSubview:_iconView]",
        "[_appRowView addSubview:_titleField]",
        "Drag %@ to the list above to allow App Management",
        "NSBezelStyleCircular",
        "@available(macOS 11.0, *)",
        "NSImageNameGoLeftTemplate",
        "CAVTextBack",
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
        "[surface addSubview:arrow]",
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
    assert!(native.contains("[self addSubview:_box]"));
    assert!(native.contains("[self addSubview:_appRowView]"));
    assert!(native.find("[self addSubview:_box]") < native.find("[self addSubview:_appRowView]"));
    assert!(!native.contains("detailField"));
    assert!(!native.contains("buttonWithTitle:CAVHelperText(CAVTextRetry)"));
    assert!(!native.contains("buttonWithTitle:CAVHelperText(CAVTextCancel)"));
    assert!(
        !native.contains("CAVSnapshot(self, dragFrame)"),
        "the drag image must exclude the sibling NSBox background"
    );
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
fn native_helper_matches_the_reference_instruction_back_and_app_row_geometry() {
    let native = read("native/macos_permission_handoff.m");
    let helper_width = numeric_constant(&native, "CAVHelperWidth");
    let helper_height = numeric_constant(&native, "CAVHelperHeight");
    let arrow_size = numeric_constant(&native, "CAVArrowSize");
    let instruction_top = numeric_constant(&native, "CAVInstructionTop");
    let instruction_height = numeric_constant(&native, "CAVInstructionHeight");
    let row_top = numeric_constant(&native, "CAVRowTop");
    let row_height = numeric_constant(&native, "CAVRowHeight");
    let horizontal_inset = numeric_constant(&native, "CAVHelperHorizontalInset");
    let back_size = numeric_constant(&native, "CAVBackButtonSize");
    let back_gap = numeric_constant(&native, "CAVBackToRowGap");
    let arrow_mass = numeric_constant(&native, "CAVArrowMass");
    let arrow_stiffness = numeric_constant(&native, "CAVArrowStiffness");
    let arrow_damping = numeric_constant(&native, "CAVArrowDamping");

    assert_eq!((helper_width, helper_height), (532.0, 112.0));
    assert_eq!((instruction_top, instruction_height), (12.0, 28.0));
    assert_eq!((row_top, row_height), (52.0, 44.0));
    assert_eq!((horizontal_inset, back_size, back_gap), (16.0, 32.0, 16.0));
    assert_eq!(arrow_size, 28.0);
    assert_eq!(
        (arrow_mass, arrow_stiffness, arrow_damping),
        (1.0, 200.0, 11.0)
    );
    assert_eq!(instruction_top + instruction_height + 12.0, row_top);
    assert_eq!(row_top + row_height + horizontal_inset, helper_height);
    assert!(native.contains("instructionGroupX + CAVArrowSize + CAVArrowTextGap"));
    assert!(native.contains("CAVHelperHorizontalInset + CAVBackButtonSize + CAVBackToRowGap"));
    assert!(native.contains(
        "[self sendOutcome:CAVOutcomeDismissed terminal:YES];\n  [self finishWithReverse:YES];"
    ));
}

#[test]
fn native_motion_surface_keeps_content_and_effect_layers_on_one_geometry_owner() {
    let native = read("native/macos_permission_handoff.m");

    for required in [
        "@property(nonatomic, strong) NSView *motionSurfaceView;",
        "_motionSurfaceView = [[NSView alloc] initWithFrame:NSZeroRect];",
        "[self addSubview:_motionSurfaceView];",
        "[_motionSurfaceView.layer addSublayer:shadow];",
        "[_motionSurfaceView.layer addSublayer:_strokeLayer];",
        "[_motionSurfaceView addSubview:imageView];",
        "self.motionSurfaceView.frame = frame;",
        "NSRect bounds = self.motionSurfaceView.bounds;",
        "self.sourceImageView.frame = bounds;",
        "self.targetImageView.frame = bounds;",
        "self.strokeLayer.frame = bounds;",
        "shadow.frame = bounds;",
        "CGPathRef path = CAVRoundedPath(bounds);",
    ] {
        assert!(
            native.contains(required),
            "motion surface must own content and visual effects together: {required}"
        );
    }
    assert!(
        !native.contains("[self.layer addSublayer:shadow]"),
        "shadow layers must not remain siblings of the animated surface"
    );
    assert!(
        !native.contains("self.sourceImageView.frame = frame;"),
        "content must be positioned in the animated surface's local bounds"
    );
}

#[test]
fn native_arrow_matches_reference_spring_and_has_unclipped_overscan_canvas() {
    let native = read("native/macos_permission_handoff.m");
    let arrow_size = numeric_constant(&native, "CAVArrowSize");
    let scale_x = numeric_constant(&native, "CAVArrowScaleX");
    let scale_y = numeric_constant(&native, "CAVArrowScaleY");
    let shadow_opacity = numeric_constant(&native, "CAVArrowShadowOpacity");
    let shadow_radius = numeric_constant(&native, "CAVArrowShadowRadius");
    let shadow_y = numeric_constant(&native, "CAVArrowShadowY");
    let vertical_offset = numeric_constant(&native, "CAVArrowVerticalOffset");
    let mass = numeric_constant(&native, "CAVArrowMass");
    let stiffness = numeric_constant(&native, "CAVArrowStiffness");
    let damping = numeric_constant(&native, "CAVArrowDamping");
    let initial_delay = numeric_constant(&native, "CAVArrowInitialDelay");
    let stretch_duration = numeric_constant(&native, "CAVArrowStretchDuration");
    let idle_duration = numeric_constant(&native, "CAVArrowIdleDuration");

    assert_eq!(arrow_size, 28.0);
    assert_eq!((scale_x, scale_y), (1.15, 1.6));
    assert_eq!((shadow_opacity, shadow_radius, shadow_y), (0.23, 7.0, 4.0));
    assert_eq!(vertical_offset, -10.0);
    assert_eq!((mass, stiffness, damping), (1.0, 200.0, 11.0));
    assert_eq!(
        (initial_delay, stretch_duration, idle_duration),
        (0.5, 0.25, 4.0)
    );

    for required in [
        "static const CGFloat CAVArrowShadowBottomInset = CAVArrowShadowRadius + CAVArrowShadowY;",
        "static const CGFloat CAVArrowCanvasWidth = CAVArrowSize + CAVTwo * CAVArrowShadowRadius;",
        "static const CGFloat CAVArrowCanvasHeight = CAVArrowSize * CAVArrowScaleY + CAVArrowShadowRadius + CAVArrowShadowBottomInset;",
        "CGFloat arrowPanelLeft = NSMinX(frame) + arrowX - CAVArrowShadowRadius;",
        "CGFloat arrowPanelBottom = NSMinY(frame) + arrowY - CAVArrowVerticalOffset - CAVArrowShadowBottomInset;",
        "CAVArrowCanvasWidth, CAVArrowCanvasHeight",
        "NSRect arrowGlyphFrame = NSMakeRect(CAVArrowShadowRadius,",
        "CAVArrowCanvasHeight - CAVArrowSize - CAVArrowShadowBottomInset",
        "arrow.layer.anchorPoint = CGPointMake(CAVHalf, CAVOne); arrow.frame = arrowGlyphFrame;",
        "arrow.layer.geometryFlipped = YES",
        "arrow.layer.masksToBounds = NO",
        "arrow.layer.shadowOpacity = CAVArrowShadowOpacity",
        "arrow.layer.shadowRadius = CAVArrowShadowRadius",
        "arrow.layer.shadowOffset = CGSizeMake(CAVZero, CAVArrowShadowY)",
        "spring.initialVelocity = CAVZero",
        "spring.duration = spring.settlingDuration",
        "[self scheduleArrowCycleAfter:CAVArrowIdleDuration]",
    ] {
        assert!(
            native.contains(required),
            "arrow reference contract or clipping guard missing: {required}"
        );
    }
    assert!(
        native.contains("arrowPanel.contentView = arrowCanvas"),
        "the overscan canvas must be the child panel content view"
    );
    assert!(
        !native.contains("CAVArrowSize, CAVArrowSize);\n  CAVNonActivatingPanel"),
        "the arrow panel must not revert to a tight 28x28 clipping window"
    );
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
