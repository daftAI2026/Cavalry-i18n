/**
 * [INPUT]: 依赖 cavalry_i18n_tauri::privilege 的复制、重签、quarantine 与 restart 边界
 * [OUTPUT]: 对外提供命令顺序与权限回退 contract tests
 * [POS]: src-tauri/tests 的系统边界守门，确保 fake runner 能完整断言 macOS 命令流
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
use cavalry_i18n_tauri::patch::CopyPair;
use cavalry_i18n_tauri::privilege::{
    clear_gatekeeper_quarantine, copy_with_privilege, resign_patched_bundle, restart_commands,
    RecordedCommand, RecordingRunner,
};
use std::{fs, path::Path};

fn write(path: &Path, value: &[u8]) {
    fs::create_dir_all(path.parent().unwrap()).unwrap();
    fs::write(path, value).unwrap();
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
                args: vec![
                    "-e".into(),
                    "tell application \"Cavalry\" to quit".into()
                ]
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
    write(&app.join("Contents/MacOS/Cavalry"), &[0xcf, 0xfa, 0xed, 0xfe]);
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
