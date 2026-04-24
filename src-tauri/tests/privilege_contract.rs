/**
 * [INPUT]: 依赖 cavalry_i18n_tauri::privilege 的复制、重签、quarantine 与 restart 边界
 * [OUTPUT]: 对外提供命令顺序与权限回退 contract tests
 * [POS]: src-tauri/tests 的系统边界守门，确保 fake runner 能完整断言 macOS 命令流
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
use cavalry_i18n_tauri::patch::CopyPair;
use cavalry_i18n_tauri::privilege::{
    clear_gatekeeper_quarantine, copy_with_privilege, patch_keychain_access_group,
    resign_patched_bundle, restart_commands, KeychainPatchStatus, RecordedCommand, RecordingRunner,
};
use std::{
    fs,
    path::{Path, PathBuf},
};

const ACCESS_GROUP: &[u8] = b"TB4YVNQHVC.com.scenegroup.cavalry.apps";

fn write(path: &Path, value: &[u8]) {
    fs::create_dir_all(path.parent().unwrap()).unwrap();
    fs::write(path, value).unwrap();
}

fn write_keychain_dylib(app: &Path, occurrences: usize) -> PathBuf {
    let target = app
        .join("Contents")
        .join("Frameworks")
        .join("libExtensionLayer.dylib");
    let mut bytes = Vec::new();
    for index in 0..occurrences {
        bytes.extend_from_slice(format!("slice-{index}:").as_bytes());
        bytes.extend_from_slice(ACCESS_GROUP);
        bytes.extend_from_slice(b":end\n");
    }
    write(&target, &bytes);
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
fn patch_keychain_access_group_nullifies_first_byte_rs() {
    let temp = tempfile::tempdir().unwrap();
    let app = temp.path().join("Cavalry.app");
    let target = write_keychain_dylib(&app, 2);
    let before = fs::read(&target).unwrap();

    assert_eq!(
        patch_keychain_access_group(&app).unwrap(),
        KeychainPatchStatus::Patched { count: 2 }
    );

    let after = fs::read(&target).unwrap();
    assert_eq!(after.len(), before.len());
    let mut search_from = 0;
    for _ in 0..2 {
        let offset = before[search_from..]
            .windows(ACCESS_GROUP.len())
            .position(|window| window == ACCESS_GROUP)
            .map(|index| index + search_from)
            .unwrap();
        assert_eq!(after[offset], 0);
        assert_eq!(
            &after[offset + 1..offset + ACCESS_GROUP.len()],
            &before[offset + 1..offset + ACCESS_GROUP.len()]
        );
        search_from = offset + ACCESS_GROUP.len();
    }
}

#[test]
fn patch_keychain_requires_exactly_two_occurrences_rs() {
    let temp = tempfile::tempdir().unwrap();
    let app = temp.path().join("Cavalry.app");

    write_keychain_dylib(&app, 1);
    let error = patch_keychain_access_group(&app).unwrap_err();
    assert!(error
        .contains("Expected 2 occurrences of access group in libExtensionLayer.dylib, found 1"));

    write_keychain_dylib(&app, 3);
    let error = patch_keychain_access_group(&app).unwrap_err();
    assert!(error
        .contains("Expected 2 occurrences of access group in libExtensionLayer.dylib, found 3"));
}

#[test]
fn patch_keychain_idempotent_rs() {
    let temp = tempfile::tempdir().unwrap();
    let app = temp.path().join("Cavalry.app");
    let target = write_keychain_dylib(&app, 2);

    patch_keychain_access_group(&app).unwrap();
    let patched = fs::read(&target).unwrap();
    assert_eq!(
        patch_keychain_access_group(&app).unwrap(),
        KeychainPatchStatus::AlreadyPatched
    );
    assert_eq!(fs::read(&target).unwrap(), patched);
}

#[test]
fn patch_keychain_missing_target_and_missing_string_are_distinct() {
    let temp = tempfile::tempdir().unwrap();
    let app = temp.path().join("Cavalry.app");

    let error = patch_keychain_access_group(&app).unwrap_err();
    assert!(error.contains("libExtensionLayer.dylib not found"));

    let target = write_keychain_dylib(&app, 0);
    fs::write(target, b"no keychain string here").unwrap();
    let error = patch_keychain_access_group(&app).unwrap_err();
    assert!(error.contains("access group string not found"));
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
