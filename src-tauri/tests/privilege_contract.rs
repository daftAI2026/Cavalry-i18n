/**
 * [INPUT]: 依赖 privilege facade、其按职责拆分的源码树，以及复制、重签、quarantine 与跨平台 restart 边界。
 * [OUTPUT]: 对外提供权限回退、owned Keychain、macOS 签名及 Windows Known Folder UAC、same-EXE worker 早分流、无控制台 PowerShell、hash-locked loader、0/42/43/44 状态与 typed recovery diagnostics contract tests。
 * [POS]: src-tauri/tests 的系统边界守门；审计 facade 与子模块共同满足安全边界，避免文件拆分掩盖 Windows 提权约束。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
use cavalry_i18n_tauri::patch::CopyPair;
#[cfg(target_os = "windows")]
use cavalry_i18n_tauri::privilege::restart_cavalry_with_environment;
#[cfg(target_os = "macos")]
use cavalry_i18n_tauri::privilege::restart_commands;
use cavalry_i18n_tauri::privilege::{
    clear_gatekeeper_quarantine, copy_with_privilege, ensure_bundle_signature,
    patch_keychain_query_attributes, patch_keychain_query_attributes_with_privilege,
    resign_patched_bundle, CommandRunner, RecordedCommand, RecordingRunner,
};
#[cfg(target_os = "windows")]
use std::ffi::OsString;
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

#[cfg(target_os = "windows")]
fn privilege_source_tree() -> String {
    let source_root = Path::new(env!("CARGO_MANIFEST_DIR")).join("src");
    let mut sources = vec![source_root.join("privilege.rs")];
    collect_privilege_sources(&source_root.join("privilege"), &mut sources);
    sources.sort();
    sources
        .into_iter()
        .map(|path| fs::read_to_string(path).unwrap())
        .collect::<Vec<_>>()
        .join("\n")
}

#[cfg(target_os = "windows")]
fn collect_privilege_sources(directory: &Path, sources: &mut Vec<PathBuf>) {
    for entry in fs::read_dir(directory).unwrap() {
        let path = entry.unwrap().path();
        if path.is_dir() {
            collect_privilege_sources(&path, sources);
        } else if path.extension().is_some_and(|extension| extension == "rs") {
            sources.push(path);
        }
    }
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
    let outcome = copy_with_privilege(
        &[CopyPair {
            src: source,
            dst: dest,
        }],
        &mut runner,
    )
    .unwrap();
    assert_eq!(outcome.mode, "direct");
    assert_eq!(outcome.warning, None);
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
#[cfg(target_os = "macos")]
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

#[cfg(target_os = "windows")]
#[derive(Default)]
struct WindowsRestartRunner {
    commands: Vec<RecordedCommand>,
    environment: Vec<(OsString, OsString)>,
    working_directory: Option<PathBuf>,
    close_error: Option<String>,
}

#[cfg(target_os = "windows")]
impl CommandRunner for WindowsRestartRunner {
    fn run(&mut self, program: &str, args: &[String]) -> Result<(), String> {
        self.commands.push(RecordedCommand {
            program: program.to_string(),
            args: args.to_vec(),
        });
        match self.close_error.take() {
            Some(error) => Err(error),
            None => Ok(()),
        }
    }

    fn spawn_detached_in_with_env(
        &mut self,
        program: &str,
        args: &[String],
        working_directory: &Path,
        environment: &[(OsString, OsString)],
    ) -> Result<(), String> {
        self.commands.push(RecordedCommand {
            program: program.to_string(),
            args: args.to_vec(),
        });
        self.working_directory = Some(working_directory.to_path_buf());
        self.environment = environment.to_vec();
        Ok(())
    }
}

#[test]
#[cfg(target_os = "windows")]
fn windows_restart_uses_absolute_executable_install_root_cwd_and_process_environment() {
    let temp = tempfile::tempdir().unwrap();
    let root = cavalry_i18n_tauri::install::normalize_path(temp.path());
    let mut runner = WindowsRestartRunner::default();
    let environment = vec![(
        OsString::from("CAVALRY_I18N_LANG"),
        OsString::from("zh-Hans"),
    )];

    restart_cavalry_with_environment(&root, &environment, &mut runner).unwrap();

    assert_eq!(runner.commands[0].program, "powershell.exe");
    assert!(!runner.commands[0].args.iter().any(|arg| arg == "/F"));
    assert!(!runner.commands[0].args.iter().any(|arg| arg == "/IM"));
    assert_eq!(
        PathBuf::from(&runner.commands[1].program),
        root.join("Cavalry.exe")
    );
    assert_eq!(runner.working_directory.as_deref(), Some(root.as_path()));
    assert_eq!(runner.environment, environment);
}

#[test]
#[cfg(target_os = "windows")]
fn windows_restart_aborts_before_spawn_when_graceful_close_fails() {
    let temp = tempfile::tempdir().unwrap();
    let root = cavalry_i18n_tauri::install::normalize_path(temp.path());
    let mut runner = WindowsRestartRunner {
        close_error: Some("Cavalry did not exit gracefully".to_string()),
        ..Default::default()
    };

    let error = restart_cavalry_with_environment(&root, &[], &mut runner).unwrap_err();

    assert!(error.contains("did not exit gracefully"), "{error}");
    assert_eq!(
        runner.commands.len(),
        1,
        "spawn must not follow a failed close"
    );
}

#[test]
#[cfg(target_os = "windows")]
fn windows_restart_contract_forbids_forced_termination_and_matches_exact_executable_path() {
    let source = privilege_source_tree();
    let forced_termination = ["Stop", "Process"].join("-");
    let legacy_killer = ["task", "kill"].join("");

    assert!(source.contains("Get-CimInstance Win32_Process"));
    assert!(source.contains("ExecutablePath"));
    assert!(source.contains("[System.String]::Equals"));
    assert!(source.contains("OrdinalIgnoreCase"));
    assert!(source.contains("CloseMainWindow()"));
    assert!(source.contains("WINDOWS_GRACEFUL_CLOSE_TIMEOUT_SECONDS: u64 = 15"));
    assert!(!source.contains(&forced_termination));
    assert!(!source.to_ascii_lowercase().contains(&legacy_killer));
}

#[test]
#[cfg(target_os = "windows")]
fn windows_runtime_powershell_contract_never_allocates_console_windows() {
    let source_root = Path::new(env!("CARGO_MANIFEST_DIR")).join("src");
    let runner = fs::read_to_string(source_root.join("privilege/runner.rs")).unwrap();
    let discovery = fs::read_to_string(source_root.join("windows_install.rs")).unwrap();
    let restart = fs::read_to_string(source_root.join("privilege/restart.rs")).unwrap();
    let admin_copy =
        fs::read_to_string(source_root.join("privilege/windows/admin_copy.rs")).unwrap();

    assert!(runner.contains("const WINDOWS_CREATE_NO_WINDOW: u32 = 0x08000000;"));
    assert!(runner.contains("command.creation_flags(WINDOWS_CREATE_NO_WINDOW);"));
    assert!(runner.contains("let status = self.run_captured(program, args)?;"));
    assert!(runner.contains("captured_command(program)"));
    assert!(discovery.contains("captured_command(\"powershell.exe\")"));
    assert!(!discovery.contains("Command::new(\"powershell.exe\")"));
    assert!(restart.contains("program: \"powershell.exe\".to_string()"));
    assert!(!restart.contains("Command::new("));
    assert!(
        admin_copy.matches("-WindowStyle").count() >= 2,
        "the elevated PowerShell needs both a hidden startup argument and hidden Start-Process style"
    );
    assert!(admin_copy.contains("-Verb RunAs"));
}

#[test]
#[cfg(target_os = "windows")]
fn elevated_language_worker_dispatch_precedes_headless_launch_and_webview_runtime() {
    let main =
        fs::read_to_string(Path::new(env!("CARGO_MANIFEST_DIR")).join("src/main.rs")).unwrap();
    let worker = main
        .find("dispatch_elevated_language_worker_current_process()")
        .expect("main must dispatch the reserved elevated worker");
    let headless = main
        .find("headless_launch::dispatch_current_process()")
        .expect("main must retain the native Cavalry launch path");
    let webview = main
        .find("cavalry_i18n_tauri::run();")
        .expect("main must retain the ordinary Tauri runtime");

    assert!(
        worker < headless && headless < webview,
        "reserved elevated argv must be consumed before any native launch or WebView"
    );
}

#[test]
#[cfg(target_os = "windows")]
fn windows_uac_allowlist_uses_known_folders_and_forbids_environment_root_lookup() {
    let source = privilege_source_tree();
    let legacy_wow64_root = ["Program", "W6432"].concat();
    let legacy_x86_environment = ["ProgramFiles", "(x86)"].concat();
    let environment_lookup = ["var", "_os"].concat();

    assert!(source.contains("SHGetKnownFolderPath"));
    assert!(source.contains("FOLDER_ID_PROGRAM_FILES"));
    assert!(source.contains("FOLDER_ID_PROGRAM_FILES_X86"));
    assert!(source.contains("CoTaskMemFree"));
    assert!(source.contains("[Environment]::GetFolderPath"));
    assert!(source.contains("[System.IO.FileAttributes]::ReparsePoint"));
    assert!(!source.contains(&legacy_wow64_root));
    assert!(!source.contains(&legacy_x86_environment));
    assert!(!source.contains(&environment_lookup));
}

#[test]
#[cfg(target_os = "windows")]
fn windows_uac_manifest_contract_keeps_payload_bounded_and_source_locked() {
    let source = privilege_source_tree();

    assert!(source.contains("cavalry-i18n-admin-copy-"));
    assert!(source.contains("create_new(true)"));
    assert!(source.contains("parse_verified_windows_copy_manifest"));
    assert!(source.contains("ReadAllBytes($manifestPath)"));
    assert!(source.contains("ConvertFrom-Json"));
    assert!(source.contains("sourceSha256"));
    assert!(source.contains("[System.IO.FileShare]::None"));
    assert!(source.contains("Get-OpenStreamSha256Hex"));
    assert!(source.contains("$sourceStream.CopyTo($destinationStream)"));
    assert!(source.contains("windows_admin_copy_script_loader"));
    assert!(source.contains("Administrator copy script hash did not match"));
    assert!(source.contains("cleanup_windows_temp_files"));
    assert!(source.contains("CommandStatus"));
    assert!(source.contains("run_captured"));
    assert!(source.contains("CopyDiagnostic::RecoveryResidual"));
    assert!(source.contains("PostCommitWarningCode"));
    assert!(!source.contains("preserve_direct_copy_recovery_residual"));
    assert!(source.contains("exit [int]$p.ExitCode"));
    assert!(source.contains("exit 0"));
    assert!(source.contains("exit 42"));
    assert!(source.contains("exit 43"));
    assert!(source.contains("exit 44"));
    assert!(source.contains("'\\r' | '\\n' | '\\0' | '\\t'"));
    let legacy_copy = ["Copy", "Item -LiteralPath"].join("-");
    let legacy_warning_variable = ["warning", "Path"].concat();
    let legacy_warning_writer = ["Write", "AllText"].concat();
    assert!(!source.contains(&legacy_copy));
    assert!(!source.contains(&legacy_warning_variable));
    assert!(!source.contains(&legacy_warning_writer));
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
