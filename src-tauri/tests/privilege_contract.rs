/**
 * [INPUT]: 依赖 cavalry_i18n_tauri::privilege 的复制、重签、quarantine 与 restart 边界
 * [OUTPUT]: 对外提供命令顺序、权限回退、owned Keychain 明细和增量签名 contract tests
 * [POS]: src-tauri/tests 的系统边界守门，确保 fake runner 能断言 macOS 快路径签名后仍执行 deep/strict 验证
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
use cavalry_i18n_tauri::patch::CopyPair;
use cavalry_i18n_tauri::privilege::{
    clear_gatekeeper_quarantine, copy_with_privilege, ensure_bundle_signature,
    patch_keychain_query_attributes, patch_keychain_query_attributes_with_privilege,
    resign_patched_bundle, restart_commands, CommandRunner, RecordedCommand, RecordingRunner,
};
use std::{
    fs,
    path::{Path, PathBuf},
};

fn report_count(
    report: &cavalry_i18n_tauri::keychain_patch::KeychainPatchReport,
    function: &str,
    attribute: &str,
) -> (usize, usize) {
    let detail = report
        .details
        .iter()
        .find(|detail| detail.function == function && detail.attribute == attribute)
        .unwrap_or_else(|| panic!("missing report detail for {function}/{attribute}"));
    (detail.patched_callsites, detail.already_patched_callsites)
}

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

fn make_signing_bundle(root: &Path) -> PathBuf {
    let app = root.join("Cavalry.app");
    for relative in [
        "Contents/MacOS/Cavalry",
        "Contents/MacOS/crashpad_handler",
        "Contents/Frameworks/libCavalryFramework.dylib",
    ] {
        write(&app.join(relative), &[0xcf, 0xfa, 0xed, 0xfe]);
    }
    app
}

struct VerifyFailsRunner {
    commands: Vec<RecordedCommand>,
    verify_failures: usize,
}

impl CommandRunner for VerifyFailsRunner {
    fn run(&mut self, program: &str, args: &[String]) -> Result<(), String> {
        self.commands.push(RecordedCommand {
            program: program.to_string(),
            args: args.to_vec(),
        });
        if program == "codesign"
            && args.iter().any(|arg| arg == "--verify")
            && self.verify_failures > 0
        {
            self.verify_failures -= 1;
            Err("nested code is not signed".to_string())
        } else {
            Ok(())
        }
    }
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

    assert_eq!(report.functions, 5);
    assert_eq!(report.patched_callsites, 10);
    assert_eq!(
        report_count(&report, "valueExists", "kSecAttrAccessGroup"),
        (1, 0)
    );
    assert_eq!(
        report_count(&report, "valueExists", "kSecAttrSynchronizable"),
        (1, 0)
    );
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

    assert_eq!(report.patched_callsites, 10);
    assert_eq!(second.already_patched_callsites, 10);
    assert_eq!(
        report_count(&second, "valueExists", "kSecAttrSynchronizable"),
        (0, 1)
    );
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

    assert_eq!(report.patched_callsites, 20);
    assert_eq!(
        report_count(&report, "valueExists", "kSecAttrAccessGroup"),
        (2, 0)
    );
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
        10
    );
    let second = patch_keychain_query_attributes(&app).unwrap();

    assert_eq!(
        (second.patched_callsites, second.already_patched_callsites),
        (0, 10)
    );
}

#[test]
fn owned_keychain_patch_reuses_the_input_allocation() {
    let bytes =
        cavalry_i18n_tauri::keychain_patch::build_synthetic_keychain_dylib(Some("arm64"), false);
    let input_pointer = bytes.as_ptr();

    let (patched, report) =
        cavalry_i18n_tauri::keychain_patch::patch_keychain_query_attributes_owned(bytes).unwrap();

    assert_eq!(report.patched_callsites, 10);
    assert_eq!(patched.as_ptr(), input_pointer);
}

#[test]
fn patch_keychain_query_attributes_with_privilege_copies_staged_dylib() {
    let temp = tempfile::tempdir().unwrap();
    let app = temp.path().join("Cavalry.app");
    let target = write_keychain_dylib(
        &app,
        &cavalry_i18n_tauri::keychain_patch::build_synthetic_keychain_dylib(Some("arm64"), false),
    );
    let before_len = fs::metadata(&target).unwrap().len();
    let mut runner = RecordingRunner::default();

    let report = patch_keychain_query_attributes_with_privilege(
        &app,
        &temp.path().join("keychain-stage"),
        &mut runner,
    )
    .unwrap();
    let second = patch_keychain_query_attributes_with_privilege(
        &app,
        &temp.path().join("keychain-stage-2"),
        &mut runner,
    )
    .unwrap();

    assert_eq!(report.patched_callsites, 10);
    assert_eq!(second.already_patched_callsites, 10);
    assert_eq!(fs::metadata(&target).unwrap().len(), before_len);
    assert!(runner.commands.is_empty());
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
fn resign_fast_path_signs_changed_code_then_verifies_bundle() {
    let temp = tempfile::tempdir().unwrap();
    let app = make_signing_bundle(temp.path());

    let mut runner = RecordingRunner::default();
    let changed = app.join("Contents/Frameworks/libCavalryFramework.dylib");
    resign_patched_bundle(&app, std::slice::from_ref(&changed), &mut runner).unwrap();
    if cfg!(target_os = "macos") {
        let signing = runner
            .commands
            .iter()
            .filter(|command| command.args.iter().any(|arg| arg == "--sign"))
            .collect::<Vec<_>>();
        assert_eq!(signing.len(), 2);
        assert!(signing
            .iter()
            .all(|command| !command.args.iter().any(|arg| arg == "--deep")));
        assert!(!runner
            .commands
            .iter()
            .any(|command| command.args.iter().any(|arg| arg == "--remove-signature")));
        assert!(runner.commands.iter().any(|command| {
            command.args.iter().any(|arg| arg == "--verify")
                && command.args.iter().any(|arg| arg == "--deep")
                && command.args.iter().any(|arg| arg == "--strict")
        }));
    }
}

#[test]
fn resign_verify_failure_runs_deduplicated_full_repair_then_reverifies() {
    let temp = tempfile::tempdir().unwrap();
    let app = make_signing_bundle(temp.path());
    #[cfg(unix)]
    fs::hard_link(
        app.join("Contents/Frameworks/libCavalryFramework.dylib"),
        app.join("Contents/Frameworks/libCavalryFrameworkAlias.dylib"),
    )
    .unwrap();
    let changed = app.join("Contents/Frameworks/libCavalryFramework.dylib");
    let mut runner = VerifyFailsRunner {
        commands: Vec::new(),
        verify_failures: 1,
    };

    resign_patched_bundle(&app, std::slice::from_ref(&changed), &mut runner).unwrap();

    if cfg!(target_os = "macos") {
        let signing = runner
            .commands
            .iter()
            .filter(|command| command.args.iter().any(|arg| arg == "--sign"))
            .collect::<Vec<_>>();
        assert_eq!(signing.len(), 6);
        assert_eq!(
            runner
                .commands
                .iter()
                .filter(|command| command.args.iter().any(|arg| arg == "--verify"))
                .count(),
            2
        );
        assert_eq!(
            signing
                .iter()
                .filter(|command| command.args.iter().any(|arg| arg == "--deep"))
                .count(),
            1
        );
        assert!(!signing.iter().any(|command| command
            .args
            .iter()
            .any(|arg| arg.ends_with("libCavalryFrameworkAlias.dylib"))));
    }
}

#[test]
fn unchanged_bundle_verifies_without_signing() {
    let temp = tempfile::tempdir().unwrap();
    let app = make_signing_bundle(temp.path());
    let mut runner = RecordingRunner::default();

    ensure_bundle_signature(&app, &mut runner).unwrap();

    if cfg!(target_os = "macos") {
        assert_eq!(runner.commands.len(), 1);
        assert!(runner.commands[0].args.iter().any(|arg| arg == "--verify"));
        assert!(!runner.commands[0].args.iter().any(|arg| arg == "--sign"));
    }
}

#[test]
fn unchanged_bundle_with_broken_seal_repairs_and_reverifies() {
    let temp = tempfile::tempdir().unwrap();
    let app = make_signing_bundle(temp.path());
    let mut runner = VerifyFailsRunner {
        commands: Vec::new(),
        verify_failures: 1,
    };

    ensure_bundle_signature(&app, &mut runner).unwrap();

    if cfg!(target_os = "macos") {
        assert_eq!(
            runner
                .commands
                .iter()
                .filter(|command| command.args.iter().any(|arg| arg == "--verify"))
                .count(),
            2
        );
        assert_eq!(
            runner
                .commands
                .iter()
                .filter(|command| command.args.iter().any(|arg| arg == "--sign"))
                .count(),
            4
        );
    }
}
