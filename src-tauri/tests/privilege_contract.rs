/**
 * [INPUT]: 依赖 cavalry_i18n_tauri::privilege 的复制、重签、quarantine 与 restart 边界
 * [OUTPUT]: 对外提供命令顺序与权限回退 contract tests
 * [POS]: src-tauri/tests 的系统边界守门，确保 fake runner 能完整断言 macOS 命令流
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
use cavalry_i18n_tauri::patch::CopyPair;
use cavalry_i18n_tauri::privilege::{
    clear_gatekeeper_quarantine, copy_with_privilege, patch_keychain_query_attributes,
    resign_patched_bundle, restart_commands, RecordedCommand, RecordingRunner,
};
use std::{
    fs,
    path::{Path, PathBuf},
};

fn write(path: &Path, value: &[u8]) {
    fs::create_dir_all(path.parent().unwrap()).unwrap();
    fs::write(path, value).unwrap();
}

fn write_keychain_dylib(app: &Path, bytes: &[u8]) -> PathBuf {
    let target = app
        .join("Contents")
        .join("Frameworks")
        .join("libExtensionLayer.dylib");
    write(&target, bytes);
    target
}

#[test]
fn copy_tries_direct_then_admin_on_permission_error() {
    let temp = tempfile::tempdir().unwrap();
    let source = temp.path().join("src/file.json");
    let dest = temp.path().join("dst/file.json");
    write(&source, br#"{}"#);

    let mut runner = RecordingRunner::default();
    let mode = copy_with_privilege(
        &[CopyPair {
            src: source,
            dst: dest,
        }],
        &mut runner,
    )
    .unwrap();
    assert_eq!(mode, "direct");
    assert!(runner.commands.is_empty());
}

#[test]
fn patch_keychain_query_attributes_patches_two_callsites_per_function() {
    let temp = tempfile::tempdir().unwrap();
    let app = temp.path().join("Cavalry.app");
    let target = write_keychain_dylib(
        &app,
        &cavalry_i18n_tauri::keychain_patch::build_synthetic_keychain_dylib(Some("arm64"), false),
    );
    let before_len = fs::metadata(&target).unwrap().len();

    let report = patch_keychain_query_attributes(&app).unwrap();

    assert_eq!(report.functions, 4);
    assert_eq!(report.patched_callsites, 8);
    assert_eq!(fs::metadata(&target).unwrap().len(), before_len);
}

#[test]
fn patch_keychain_query_attributes_x86_64_replaces_target_call_with_nop_sequence() {
    let temp = tempfile::tempdir().unwrap();
    let app = temp.path().join("Cavalry.app");
    write_keychain_dylib(
        &app,
        &cavalry_i18n_tauri::keychain_patch::build_synthetic_keychain_dylib(Some("x86_64"), false),
    );

    let report = patch_keychain_query_attributes(&app).unwrap();
    let second = patch_keychain_query_attributes(&app).unwrap();

    assert_eq!(report.patched_callsites, 8);
    assert_eq!(second.already_patched_callsites, 8);
}

#[test]
fn patch_keychain_query_attributes_patches_fat_arm64_and_x86_64() {
    let temp = tempfile::tempdir().unwrap();
    let app = temp.path().join("Cavalry.app");
    write_keychain_dylib(
        &app,
        &cavalry_i18n_tauri::keychain_patch::build_synthetic_keychain_dylib(None, true),
    );

    let report = patch_keychain_query_attributes(&app).unwrap();

    assert_eq!(report.patched_callsites, 16);
}

#[test]
fn patch_keychain_query_attributes_is_idempotent_rs() {
    let temp = tempfile::tempdir().unwrap();
    let app = temp.path().join("Cavalry.app");
    write_keychain_dylib(
        &app,
        &cavalry_i18n_tauri::keychain_patch::build_synthetic_keychain_dylib(Some("arm64"), false),
    );

    assert_eq!(
        patch_keychain_query_attributes(&app)
            .unwrap()
            .patched_callsites,
        8
    );
    let second = patch_keychain_query_attributes(&app).unwrap();

    assert_eq!(
        (second.patched_callsites, second.already_patched_callsites),
        (0, 8)
    );
}

#[test]
fn patch_keychain_query_attributes_errors_when_expected_pattern_missing() {
    let temp = tempfile::tempdir().unwrap();
    let app = temp.path().join("Cavalry.app");
    write_keychain_dylib(
        &app,
        &cavalry_i18n_tauri::keychain_patch::build_synthetic_keychain_dylib_missing_sync_get_value(
        ),
    );

    let error = patch_keychain_query_attributes(&app).unwrap_err();

    assert!(error.contains("getValue kSecAttrSynchronizable"), "{error}");
    assert!(error.contains("callsite"), "{error}");
}

#[test]
fn patch_keychain_missing_target_and_missing_string_are_distinct() {
    let temp = tempfile::tempdir().unwrap();
    let app = temp.path().join("Cavalry.app");

    let error = patch_keychain_query_attributes(&app).unwrap_err();
    assert!(error.contains("libExtensionLayer.dylib not found"));

    write_keychain_dylib(&app, b"no keychain pattern here");
    let error = patch_keychain_query_attributes(&app).unwrap_err();
    assert!(error.contains("supported 64-bit Mach-O"));
}

#[test]
fn quarantine_clear_ignores_missing_xattr() {
    let temp = tempfile::tempdir().unwrap();
    let mut runner = RecordingRunner::default();
    clear_gatekeeper_quarantine(temp.path(), &mut runner).unwrap();
    if cfg!(target_os = "macos") {
        assert_eq!(runner.commands[0].program, "xattr");
    }
}

#[test]
fn restart_quits_then_opens_new_instance() {
    let commands = restart_commands(Path::new("/Applications/Cavalry.app"));
    assert_eq!(
        commands,
        vec![
            RecordedCommand {
                program: "osascript".into(),
                args: vec!["-e".into(), "tell application \"Cavalry\" to quit".into()]
            },
            RecordedCommand {
                program: "open".into(),
                args: vec!["-n".into(), "/Applications/Cavalry.app".into()]
            }
        ]
    );
}

#[test]
fn resign_collects_nested_macho_paths() {
    let temp = tempfile::tempdir().unwrap();
    let app = temp.path().join("Cavalry.app");
    write(
        &app.join("Contents/MacOS/Cavalry"),
        &[0xcf, 0xfa, 0xed, 0xfe],
    );
    write(
        &app.join("Contents/MacOS/crashpad_handler"),
        &[0xcf, 0xfa, 0xed, 0xfe],
    );
    write(
        &app.join("Contents/Frameworks/libCavalryFramework.dylib"),
        &[0xcf, 0xfa, 0xed, 0xfe],
    );

    let mut runner = RecordingRunner::default();
    resign_patched_bundle(&app, &mut runner).unwrap();
    if cfg!(target_os = "macos") {
        assert!(runner
            .commands
            .iter()
            .any(|command| command.program == "codesign"));
    }
}
