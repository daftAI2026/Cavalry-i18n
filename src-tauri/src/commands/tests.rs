/**
 * [INPUT]: 依赖 commands 各职责模块、临时 bundle fixtures 与 fake CommandRunner。
 * [OUTPUT]: 覆盖 command DTO、snapshot/provenance、事务 marker 与平台 runtime apply/restart。
 * [POS]: commands 的 owner unit tests；通过 facade 公开的 crate-private seam 验证跨模块编排。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#[cfg(target_os = "macos")]
use super::{acquire_bundle_file_lock, injector_source_candidates};
use super::{
    apply_language_inner, extract_english_inner, marker_guarded_transaction_pairs,
    registered_command_names, resource_candidates, restart_cavalry_guarded, status_for_paths,
    sync_state_with_bundle, try_begin_bundle_operation, BUSY_ERROR, COMMAND_NAMES,
};
#[cfg(target_os = "windows")]
use super::{is_app_management_error, permission_action, ActionPayload};
use crate::privilege::{
    CommandRunner, CommandStatus, PostCommitWarning, PostCommitWarningCode, RecordedCommand,
    RecordingRunner,
};
use crate::state::{self, EnglishSnapshotProvenance, State};
use std::{
    fs,
    path::{Path, PathBuf},
};

#[cfg(target_os = "windows")]
use std::ffi::OsString;

#[cfg(target_os = "macos")]
struct VerifyFailsOnceRunner {
    commands: Vec<RecordedCommand>,
    verify_failures: usize,
}

#[cfg(target_os = "macos")]
struct SigningCommandsFailTwiceRunner {
    commands: Vec<RecordedCommand>,
    failures_remaining: usize,
}

#[cfg(target_os = "macos")]
#[derive(Default)]
struct WrongVendorSignatureRunner {
    inner: RecordingRunner,
}

#[cfg(target_os = "macos")]
#[derive(Default)]
struct RestoreSignatureMismatchRunner {
    inner: RecordingRunner,
}

#[cfg(target_os = "macos")]
impl CommandRunner for SigningCommandsFailTwiceRunner {
    fn run(&mut self, program: &str, args: &[String]) -> Result<(), String> {
        self.commands.push(RecordedCommand {
            program: program.to_string(),
            args: args.to_vec(),
        });
        if program == "codesign"
            && args.iter().any(|arg| arg == "--sign")
            && self.failures_remaining > 0
        {
            self.failures_remaining -= 1;
            Err("simulated signing failure".to_string())
        } else {
            Ok(())
        }
    }

    fn run_captured(&mut self, program: &str, args: &[String]) -> Result<CommandStatus, String> {
        self.commands.push(RecordedCommand {
            program: program.to_string(),
            args: args.to_vec(),
        });
        let mut status = CommandStatus {
            exit_code: Some(0),
            stdout: String::new(),
            stderr: String::new(),
        };
        if program == "codesign" && args.iter().any(|arg| arg == "-dv") {
            status.stderr = "TeamIdentifier=TB4YVNQHVC\nCDHash=0123456789abcdef".to_string();
        } else if program == "codesign" && args.iter().any(|arg| arg == "-dr") {
            status.stderr = "designated => anchor apple generic and identifier \"com.scenegroup.cavalry\" and certificate leaf[subject.OU] = TB4YVNQHVC".to_string();
        }
        Ok(status)
    }
}

#[cfg(target_os = "macos")]
impl CommandRunner for VerifyFailsOnceRunner {
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
            Err("bundle seal is damaged".to_string())
        } else {
            Ok(())
        }
    }
}

#[cfg(target_os = "macos")]
impl CommandRunner for WrongVendorSignatureRunner {
    fn run(&mut self, program: &str, args: &[String]) -> Result<(), String> {
        self.inner.run(program, args)
    }

    fn run_captured(&mut self, program: &str, args: &[String]) -> Result<CommandStatus, String> {
        let mut status = self.inner.run_captured(program, args)?;
        if program == "codesign" && args.iter().any(|arg| arg == "-dv") {
            status.stderr = "TeamIdentifier=EVILTEAM00\nCDHash=0123456789abcdef".to_string();
        }
        Ok(status)
    }
}

#[cfg(target_os = "macos")]
impl CommandRunner for RestoreSignatureMismatchRunner {
    fn run(&mut self, program: &str, args: &[String]) -> Result<(), String> {
        self.inner.run(program, args)
    }

    fn run_captured(&mut self, program: &str, args: &[String]) -> Result<CommandStatus, String> {
        let mut status = self.inner.run_captured(program, args)?;
        if program == "codesign"
            && args.iter().any(|arg| arg == "-dv")
            && args.last().is_some_and(|path| {
                plist::Value::from_file(Path::new(path).join("Contents/Info.plist"))
                    .ok()
                    .and_then(|value| {
                        value
                            .as_dictionary()
                            .and_then(|dictionary| dictionary.get("CFBundleExecutable"))
                            .and_then(plist::Value::as_string)
                            .map(str::to_string)
                    })
                    .as_deref()
                    == Some("Cavalry")
            })
        {
            status.stderr = "TeamIdentifier=TB4YVNQHVC\nCDHash=ffffffffffffffff".to_string();
        }
        Ok(status)
    }
}

#[cfg(target_os = "windows")]
#[derive(Default)]
struct WindowsRuntimeRestartRunner {
    commands: Vec<RecordedCommand>,
    environment: Vec<(OsString, OsString)>,
    working_directory: Option<PathBuf>,
}

#[cfg(target_os = "windows")]
impl CommandRunner for WindowsRuntimeRestartRunner {
    fn run(&mut self, program: &str, args: &[String]) -> Result<(), String> {
        self.commands.push(RecordedCommand {
            program: program.to_string(),
            args: args.to_vec(),
        });
        Ok(())
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

    fn spawn_detached_in_with_env_and_pid(
        &mut self,
        program: &str,
        args: &[String],
        working_directory: &Path,
        environment: &[(OsString, OsString)],
    ) -> Result<Option<u32>, String> {
        self.spawn_detached_in_with_env(program, args, working_directory, environment)?;
        let marker = environment
            .iter()
            .find(|(key, _)| key.to_string_lossy() == "CAVALRY_I18N_DIAGNOSTIC_MARKER")
            .map(|(_, value)| PathBuf::from(value))
            .ok_or_else(|| "missing diagnostic marker environment".to_string())?;
        let language = fs::read_to_string(working_directory.join(crate::install::LANG_MARKER_NAME))
            .map_err(|error| error.to_string())?
            .trim()
            .to_string();
        fs::write(
                marker,
                format!(
                    r#"{{"plugin":"cavalryi18n","status":"ready","message":"ok","language":"{language}","translationSource":"embedded-generated-table","translatorInstalled":true,"extensionLayerHookStatus":"waiting-for-extension-layer","extensionLayerHookDetail":"diagnostic-only test marker","qtVersion":"6.6.3","processId":"4242","embeddedEntryCount":1,"exactKeyCount":1,"sourceFallbackCount":1}}"#
                ),
            )
            .map_err(|error| error.to_string())?;
        Ok(Some(4242))
    }
}

#[test]
fn registers_six_commands() {
    assert_eq!(
        registered_command_names(),
        &[
            "get_status",
            "browse_app",
            "extract_english",
            "apply_language",
            "open_privacy_security",
            "restart_cavalry"
        ]
    );
    assert_eq!(COMMAND_NAMES.len(), 6);
}

#[test]
fn language_manifest_is_fixed_and_rejects_unknown_resource_directories() {
    use super::context::{is_supported_language, language_choices_from_roots};

    let choices = language_choices_from_roots(&[
        PathBuf::from("languages"),
        PathBuf::from("untrusted-resource-root"),
    ]);
    assert_eq!(
        choices
            .iter()
            .map(|choice| choice.value.as_str())
            .collect::<Vec<_>>(),
        ["en", "zh-Hans", "zh-Hant", "ja_JP"]
    );
    assert!(is_supported_language("ja_JP"));
    assert!(!is_supported_language("attacker-pack"));
}

#[test]
fn typed_cleanup_warning_never_leaks_infrastructure_paths_or_details_to_renderer() {
    let warning = PostCommitWarning::new(
        PostCommitWarningCode::TransactionBackupCleanup,
        [Path::new("C:/sensitive/cavalry-i18n-copy-backup").to_path_buf()],
        Some("raw filesystem failure detail".to_string()),
    );

    let rendered = super::contract::renderer_warning_for_copy(&[warning], "direct").unwrap();

    assert!(!rendered.contains("C:/sensitive"));
    assert!(!rendered.contains("raw filesystem failure detail"));
    assert!(rendered.contains("[cavalry-i18n-warning-code:"));
    assert!(rendered.contains("temporaryCleanupPending"));
    assert!(!rendered.contains("Language files were applied"));
}

#[test]
#[cfg(target_os = "windows")]
fn unwritable_custom_windows_root_never_maps_to_a_uac_permission_retry() {
    let custom_root = Path::new(r"D:\Creative Tools\Cavalry");
    let custom_root_error =
            "The selected Cavalry installation is not writable. Windows administrator retry is available only for installations under the OS-known Program Files folders; choose a writable Cavalry copy or update that folder's permissions.";

    assert_eq!(permission_action(custom_root, Some(false)), "none");
    assert!(!is_app_management_error(custom_root_error));
    assert!(!is_app_management_error(
            "Refusing administrator elevation for a destination outside Windows known Program Files roots: D:\\Creative Tools\\Cavalry"
        ));
    assert!(!ActionPayload::error(custom_root_error).permission_required);
}

#[test]
fn bundle_lock_conflicts_releases_and_blocks_restart() {
    let temp = tempfile::tempdir().unwrap();
    let state_dir = temp.path().join("state");
    #[cfg(target_os = "macos")]
    {
        let first_file_lock = acquire_bundle_file_lock(&state_dir).unwrap();
        assert_eq!(
            acquire_bundle_file_lock(&state_dir).unwrap_err(),
            BUSY_ERROR
        );
        drop(first_file_lock);
        assert!(acquire_bundle_file_lock(&state_dir).is_ok());
    }

    let first = try_begin_bundle_operation(&state_dir).unwrap();
    match try_begin_bundle_operation(&state_dir) {
        Ok(_) => panic!("second bundle mutation unexpectedly acquired the single-flight lock"),
        Err(error) => assert_eq!(error, BUSY_ERROR),
    }
    let mut runner = RecordingRunner::default();
    let restart = restart_cavalry_guarded(
        temp.path(),
        &state_dir,
        temp.path(),
        Path::new("/tmp/Cavalry.app"),
        &mut runner,
    );
    assert_eq!(restart.error.as_deref(), Some(BUSY_ERROR));
    assert!(runner.commands.is_empty());

    drop(first);
    assert!(try_begin_bundle_operation(&state_dir).is_ok());
}

fn write(path: &Path, value: impl AsRef<[u8]>) {
    fs::create_dir_all(path.parent().unwrap()).unwrap();
    fs::write(path, value).unwrap();
}

#[cfg(target_os = "windows")]
fn write_windows_runtime_state(state_dir: &Path, install_root: &Path, language: &str) {
    state::write_state(
        state_dir,
        &State {
            app_path: install_root.to_string_lossy().to_string(),
            cavalry_version: String::new(),
            cavalry_revision: String::new(),
            current_lang: language.to_string(),
            last_patched_at: String::new(),
            english_snapshot_provenance: None,
        },
    )
    .unwrap();
}

fn write_keychain_dylib(app: &Path) {
    let bytes = crate::keychain_patch::build_synthetic_keychain_dylib(Some("arm64"), false);
    write(
        &app.join("Contents/Frameworks/libExtensionLayer.dylib"),
        bytes,
    );
}

fn signed_macho_arm64(signature: &[u8]) -> Vec<u8> {
    let mut bytes = vec![0_u8; 64];
    bytes[0..4].copy_from_slice(&0xfeedfacf_u32.to_le_bytes());
    bytes[4..8].copy_from_slice(&0x0100_000c_u32.to_le_bytes());
    bytes[16..20].copy_from_slice(&1_u32.to_le_bytes());
    bytes[20..24].copy_from_slice(&16_u32.to_le_bytes());
    bytes[32..36].copy_from_slice(&0x1d_u32.to_le_bytes());
    bytes[36..40].copy_from_slice(&16_u32.to_le_bytes());
    bytes[40..44].copy_from_slice(&64_u32.to_le_bytes());
    bytes[44..48].copy_from_slice(&(signature.len() as u32).to_le_bytes());
    bytes[60] = 0x41;
    bytes.extend_from_slice(signature);
    bytes
}

fn make_bundle(root: &Path) -> std::path::PathBuf {
    let app = root.join("Cavalry.app");
    write(
        &app.join("Contents/Info.plist"),
        r#"<plist><dict>
  <key>CFBundleExecutable</key>
  <string>Cavalry</string>
  <key>CFBundleIdentifier</key>
  <string>com.scenegroup.cavalry</string>
  <key>CFBundleShortVersionString</key>
  <string>2.7.2</string>
  <key>CFBundleVersion</key>
  <string>2.7.2</string>
</dict></plist>"#,
    );
    for (_, asset_rel) in crate::patch::CORE_MAP {
        write(
            &app.join("Contents/assets").join(asset_rel),
            br#"{"value":"en"}"#,
        );
    }
    write(
        &app.join("Contents/assets/Plugins/Gaussian Blur Filter/strings.json"),
        br#"{"value":"en plugin"}"#,
    );
    write(
        &app.join("Contents/MacOS/Cavalry"),
        signed_macho_arm64(b"vendor-signature"),
    );
    write(
        &app.join("Contents/MacOS/crashpad_handler"),
        [0xcf, 0xfa, 0xed, 0xfe],
    );
    write(
        &app.join("Contents/Frameworks/libCavalryFramework.dylib"),
        [0xcf, 0xfa, 0xed, 0xfe],
    );
    write_keychain_dylib(&app);
    write(
        &app.join("Contents/_CodeSignature/CodeResources"),
        b"vendor code resources",
    );
    fs::create_dir_all(app.join("Contents/Resources")).unwrap();
    app
}

fn make_windows_install(root: &Path) -> std::path::PathBuf {
    let app = root.join("Cavalry");
    write(&app.join("Cavalry.exe"), b"binary");
    for (_, asset_rel) in crate::patch::CORE_MAP {
        write(&app.join("assets").join(asset_rel), br#"{"value":"en"}"#);
    }
    write(
        &app.join("assets/Plugins/Gaussian Blur Filter/strings.json"),
        br#"{"value":"en plugin"}"#,
    );
    app
}

fn make_language(root: &Path, lang: &str) {
    let base = root.join("languages").join(lang);
    let value = if lang == "en" {
        br#"{"value":"en"}"#.as_slice()
    } else {
        br#"{"value":"translated"}"#.as_slice()
    };
    let plugin_value = if lang == "en" {
        br#"{"value":"en plugin"}"#.as_slice()
    } else {
        br#"{"value":"translated plugin"}"#.as_slice()
    };
    for (lang_rel, _) in crate::patch::CORE_MAP {
        write(&base.join(lang_rel), value);
    }
    write(&base.join("plugins/gaussianBlurFilter.json"), plugin_value);
    if lang != "en" {
        make_language(root, "en");
    }
}

fn make_english_snapshot(state: &Path, app: &Path) {
    let revision = crate::detect::read_bundle_revision_for_write(app).unwrap();
    crate::patch::extract_english_generation(app, state, &revision).unwrap();
}

#[test]
fn marker_transaction_brackets_assets_with_pending_and_forced_final_marker() {
    let temp = tempfile::tempdir().unwrap();
    let app = temp.path().join("Cavalry");
    let layout = crate::install::InstallLayout::from_root(&app);
    let asset_source = temp.path().join("asset.json");
    let final_source = temp.path().join("final-marker.txt");
    write(&asset_source, b"asset");
    write(&final_source, b"zh-Hans\n");
    let asset = crate::patch::CopyPair {
        src: asset_source,
        dst: app.join("assets/Definitions/appStrings.json"),
    };
    let final_marker = crate::patch::CopyPair {
        src: final_source,
        dst: layout.language_marker.clone(),
    };

    let transaction = marker_guarded_transaction_pairs(
        &layout,
        &temp.path().join("stage"),
        vec![asset.clone()],
        Some(&final_marker),
        false,
    )
    .unwrap();

    assert_eq!(transaction.len(), 3);
    assert_eq!(transaction[0].dst, layout.language_marker);
    assert_eq!(
        fs::read_to_string(&transaction[0].src).unwrap(),
        "pending\n"
    );
    assert_eq!(transaction[1], asset);
    assert_eq!(transaction[2], final_marker);
}

#[test]
fn deferred_final_marker_is_excluded_from_the_pending_resource_transaction() {
    let temp = tempfile::tempdir().unwrap();
    let app = temp.path().join("Cavalry");
    let layout = crate::install::InstallLayout::from_root(&app);
    let asset_source = temp.path().join("asset.json");
    let final_source = temp.path().join("final-marker.txt");
    write(&asset_source, b"asset");
    write(&final_source, b"zh-Hans\n");
    let asset = crate::patch::CopyPair {
        src: asset_source,
        dst: app.join("assets/Definitions/appStrings.json"),
    };
    let final_marker = crate::patch::CopyPair {
        src: final_source,
        dst: layout.language_marker.clone(),
    };

    let prepare = marker_guarded_transaction_pairs(
        &layout,
        &temp.path().join("stage"),
        vec![asset.clone()],
        Some(&final_marker),
        true,
    )
    .unwrap();

    assert_eq!(prepare.len(), 2);
    assert_eq!(prepare[0].dst, layout.language_marker);
    assert_eq!(fs::read_to_string(&prepare[0].src).unwrap(), "pending\n");
    assert_eq!(prepare[1], asset);
    assert!(!prepare.contains(&final_marker));
}

#[test]
fn legacy_state_preserves_language_for_same_app_and_semantic_version() {
    let temp = tempfile::tempdir().unwrap();
    let app = make_bundle(temp.path());
    let app = crate::install::normalize_path(&app);
    let state_dir = temp.path().join("state");
    let previous = State {
        app_path: app.to_string_lossy().to_string(),
        cavalry_version: "2.7.2".into(),
        current_lang: "zh-Hans".into(),
        ..State::default()
    };
    let revision = crate::detect::read_bundle_revision(&app).unwrap();

    let synced = sync_state_with_bundle(&state_dir, previous, &app, "2.7.2", &revision).unwrap();

    assert_eq!(synced.current_lang, "zh-Hans");
    assert_eq!(synced.cavalry_revision, revision);
}

#[test]
fn translated_pending_and_empty_windows_markers_never_capture_english() {
    for marker in ["zh-Hans\n", "pending\n", ""] {
        let temp = tempfile::tempdir().unwrap();
        let repo = temp.path().join("repo");
        let state_dir = temp.path().join("state");
        let app = make_windows_install(temp.path());
        make_language(&repo, "en");
        write(
            &app.join(crate::install::LANG_MARKER_NAME),
            marker.as_bytes(),
        );

        let error = extract_english_inner(&repo, &state_dir, &repo, &app).unwrap_err();

        assert!(error.contains("English extraction refused"), "{error}");
        assert!(!state_dir.join("en").exists());
    }
}

#[test]
fn missing_marker_still_requires_installed_content_to_prove_english() {
    let temp = tempfile::tempdir().unwrap();
    let repo = temp.path().join("repo");
    let state_dir = temp.path().join("state");
    let app = make_windows_install(temp.path());
    make_language(&repo, "en");
    write(
        &app.join("assets/Definitions/appStrings.json"),
        br#"{"value":"translated"}"#,
    );

    let error = extract_english_inner(&repo, &state_dir, &repo, &app).unwrap_err();

    assert!(error.contains("do not match"), "{error}");
    assert!(!state_dir.join("en").exists());
}

#[test]
fn automatic_snapshot_refresh_rejects_a_translated_install() {
    let temp = tempfile::tempdir().unwrap();
    let repo = temp.path().join("repo");
    let state_dir = temp.path().join("state");
    let resources = temp.path().join("resources");
    let app = make_windows_install(temp.path());
    make_language(&repo, "zh-Hans");
    write(&app.join(crate::install::LANG_MARKER_NAME), b"zh-Hans\n");
    let mut runner = RecordingRunner::default();

    let error = apply_language_inner(
        &repo,
        &state_dir,
        &resources,
        &app,
        "zh-Hans",
        &mut runner,
        "2026-07-24T00:00:00.000Z",
    )
    .unwrap_err();

    assert!(error.contains("English extraction refused"), "{error}");
    assert!(!state_dir.join("en").exists());
    assert!(runner.commands.is_empty());
}

#[test]
fn status_uses_snapshot_provenance_and_binary_revision_not_display_version() {
    let temp = tempfile::tempdir().unwrap();
    let repo = temp.path().join("repo");
    let state_dir = temp.path().join("state");
    let resources = temp.path().join("resources");
    let app = make_windows_install(temp.path());
    let app = crate::install::normalize_path(&app);
    make_language(&repo, "en");
    make_english_snapshot(&state_dir, &app);
    let revision = crate::detect::read_bundle_revision(&app).unwrap();
    let identity = crate::patch::english_snapshot_identity(&state_dir, &app, &revision).unwrap();
    state::write_state(
        &state_dir,
        &State {
            app_path: app.to_string_lossy().to_string(),
            cavalry_version: String::new(),
            cavalry_revision: revision.clone(),
            current_lang: "en".into(),
            last_patched_at: String::new(),
            english_snapshot_provenance: Some(EnglishSnapshotProvenance {
                install_root: app.to_string_lossy().to_string(),
                immutable_revision: revision,
                snapshot_generation: Some(identity.generation),
                snapshot_manifest_sha256: Some(identity.manifest_sha256),
                vendor_baseline_id: None,
            }),
        },
    )
    .unwrap();

    let current = status_for_paths(&repo, &state_dir, &resources, vec![app.clone()]).unwrap();
    assert_eq!(current.version, "");
    assert!(!current.needs_extract);

    write(&app.join("Cavalry.exe"), b"binary-mutated");
    let changed = status_for_paths(&repo, &state_dir, &resources, vec![app]).unwrap();
    assert!(changed.needs_extract);
}

#[test]
fn legacy_json_snapshot_without_vendor_baseline_stays_stale_without_status_writing_state() {
    let temp = tempfile::tempdir().unwrap();
    let repo = temp.path().join("repo");
    let state_dir = temp.path().join("state");
    let resources = temp.path().join("resources");
    let app = crate::install::normalize_path(&make_bundle(temp.path()));
    make_language(&repo, "zh-Hans");
    make_english_snapshot(&state_dir, &app);
    write(
        &app.join("Contents/Resources/cavalry-i18n-lang.txt"),
        b"zh-Hans\n",
    );
    state::write_state(
        &state_dir,
        &State {
            app_path: app.to_string_lossy().to_string(),
            cavalry_version: "2.7.2".into(),
            current_lang: "zh-Hans".into(),
            ..State::default()
        },
    )
    .unwrap();
    let state_before = fs::read(state_dir.join("state.json")).unwrap();

    let status = status_for_paths(&repo, &state_dir, &resources, vec![app.clone()]).unwrap();
    let durable = state::read_state(&state_dir).unwrap();

    assert_eq!(status.current_lang, "zh-Hans");
    assert!(status.needs_extract);
    assert!(durable.english_snapshot_provenance.is_none());
    assert_eq!(
        fs::read(state_dir.join("state.json")).unwrap(),
        state_before
    );
}

#[test]
fn unverified_legacy_snapshot_never_acquires_provenance_on_later_status_syncs() {
    let temp = tempfile::tempdir().unwrap();
    let repo = temp.path().join("repo");
    let state_dir = temp.path().join("state");
    let resources = temp.path().join("resources");
    let app = crate::install::normalize_path(&make_bundle(temp.path()));
    make_language(&repo, "zh-Hans");
    make_english_snapshot(&state_dir, &app);
    write(
        &state_dir.join("en/appStrings.json"),
        br#"{"value":"translated"}"#,
    );
    write(
        &app.join("Contents/Resources/cavalry-i18n-lang.txt"),
        b"zh-Hans\n",
    );
    state::write_state(
        &state_dir,
        &State {
            app_path: app.to_string_lossy().to_string(),
            cavalry_version: "2.7.2".into(),
            current_lang: "zh-Hans".into(),
            ..State::default()
        },
    )
    .unwrap();

    for _ in 0..2 {
        let status = status_for_paths(&repo, &state_dir, &resources, vec![app.clone()]).unwrap();
        assert!(status.needs_extract);
    }
    let state = state::read_state(&state_dir).unwrap();
    assert!(state.cavalry_revision.is_empty());
    assert!(state.english_snapshot_provenance.is_none());
}

#[test]
fn resource_candidates_use_one_packaged_root_order_before_repo_fallback() {
    let temp = tempfile::tempdir().unwrap();
    let repo = temp.path().join("repo");
    let resources = temp.path().join("bundle").join("Resources");

    assert_eq!(
        resource_candidates(
            &repo,
            &resources,
            &[std::path::PathBuf::from("languages")],
            Path::new("languages"),
        ),
        vec![
            resources.join("languages"),
            resources.join("_up_").join("languages"),
            resources.parent().unwrap().join("languages"),
            repo.join("languages"),
        ]
    );

    #[cfg(target_os = "macos")]
    assert_eq!(
        injector_source_candidates(&repo, &resources),
        vec![
            resources
                .join("injector")
                .join(crate::mac_runtime::INJECTOR_DYLIB_NAME),
            resources.join(crate::mac_runtime::INJECTOR_DYLIB_NAME),
            resources
                .join("_up_")
                .join("injector")
                .join(crate::mac_runtime::INJECTOR_DYLIB_NAME),
            resources
                .join("_up_")
                .join(crate::mac_runtime::INJECTOR_DYLIB_NAME),
            resources
                .parent()
                .unwrap()
                .join("injector")
                .join(crate::mac_runtime::INJECTOR_DYLIB_NAME),
            resources
                .parent()
                .unwrap()
                .join(crate::mac_runtime::INJECTOR_DYLIB_NAME),
            repo.join("injector")
                .join(crate::mac_runtime::INJECTOR_DYLIB_NAME),
        ]
    );
}

#[test]
fn apply_language_patches_fake_bundle_and_records_macos_commands() {
    let temp = tempfile::tempdir().unwrap();
    let repo = temp.path().join("repo");
    let state = temp.path().join("state");
    let resources = temp.path().join("resources");
    let app = make_bundle(temp.path());
    make_language(&repo, "zh-Hans");
    write(
        &resources.join("injector/libCavalryTranslatorInjector.dylib"),
        b"injector",
    );

    let mut runner = RecordingRunner::default();
    let result = apply_language_inner(
        &repo,
        &state,
        &resources,
        &app,
        "zh-Hans",
        &mut runner,
        "2026-04-23T00:00:00.000Z",
    )
    .unwrap();

    assert!(result.ok);
    assert_eq!(result.current_lang.as_deref(), Some("zh-Hans"));
    assert_eq!(result.warning, None);
    assert!(serde_json::to_value(&result)
        .unwrap()
        .get("warning")
        .is_none());
    #[cfg(target_os = "macos")]
    {
        assert_eq!(
            fs::read_to_string(app.join("Contents/Resources/cavalry-i18n-lang.txt")).unwrap(),
            "zh-Hans\n"
        );
        assert!(fs::read_to_string(app.join("Contents/Info.plist"))
            .unwrap()
            .contains("<string>CavalryLauncher</string>"));
        let (_, keychain_report) = crate::keychain_patch::patch_keychain_query_attributes_bytes(
            &fs::read(app.join("Contents/Frameworks/libExtensionLayer.dylib")).unwrap(),
        )
        .unwrap();
        assert_eq!(keychain_report.already_patched_callsites, 10);
    }
    if cfg!(target_os = "macos") {
        assert!(runner
            .commands
            .iter()
            .any(|command| command.program == "codesign"));
        assert!(!runner
            .commands
            .iter()
            .any(|command| command.program == "xattr"));
    }
}

#[test]
#[cfg(target_os = "macos")]
fn clean_looking_bundle_with_the_wrong_vendor_signature_is_rejected_before_mutation() {
    let temp = tempfile::tempdir().unwrap();
    let repo = temp.path().join("repo");
    let state_dir = temp.path().join("state");
    let resources = temp.path().join("resources");
    let app = make_bundle(temp.path());
    make_language(&repo, "zh-Hans");
    write(
        &resources.join("injector/libCavalryTranslatorInjector.dylib"),
        b"injector",
    );
    let app_strings = app.join("Contents/assets/Definitions/appStrings.json");
    let original = fs::read(&app_strings).unwrap();
    let mut runner = WrongVendorSignatureRunner::default();

    let error = apply_language_inner(
        &repo,
        &state_dir,
        &resources,
        &app,
        "zh-Hans",
        &mut runner,
        "2026-04-23T00:00:00.000Z",
    )
    .unwrap_err();

    assert!(
        error.contains("not the supported vendor identity"),
        "{error}"
    );
    assert_eq!(fs::read(app_strings).unwrap(), original);
    assert!(!app.join("Contents/MacOS/CavalryLauncher").exists());
    assert!(!state_dir.join("state.json").exists());
    assert!(!runner.inner.commands.iter().any(|command| {
        command.program == "xattr" || command.args.iter().any(|arg| arg == "--sign")
    }));
}

#[test]
#[cfg(target_os = "macos")]
fn quarantine_failure_rolls_back_bundle_and_never_commits_target_language_state() {
    let temp = tempfile::tempdir().unwrap();
    let repo = temp.path().join("repo");
    let state_dir = temp.path().join("state");
    let resources = temp.path().join("resources");
    let app = make_bundle(temp.path());
    make_language(&repo, "zh-Hans");
    write(
        &resources.join("injector/libCavalryTranslatorInjector.dylib"),
        b"injector",
    );
    let app_strings = app.join("Contents/assets/Definitions/appStrings.json");
    let info_plist = app.join("Contents/Info.plist");
    let keychain = app.join("Contents/Frameworks/libExtensionLayer.dylib");
    let original_json = fs::read(&app_strings).unwrap();
    let original_plist = fs::read(&info_plist).unwrap();
    let original_keychain = fs::read(&keychain).unwrap();
    let protected = app.join("Contents/protected-quarantine");
    write(&protected, b"protected");
    let status = std::process::Command::new("/usr/bin/xattr")
        .args(["-w", "com.apple.quarantine", "test-fixture"])
        .arg(&protected)
        .status()
        .unwrap();
    assert!(status.success());
    let mut permissions = fs::metadata(&protected).unwrap().permissions();
    permissions.set_readonly(true);
    fs::set_permissions(&protected, permissions).unwrap();
    let mut runner = RecordingRunner::default();

    let error = apply_language_inner(
        &repo,
        &state_dir,
        &resources,
        &app,
        "zh-Hans",
        &mut runner,
        "2026-04-23T00:00:00.000Z",
    )
    .unwrap_err();

    assert!(
        error.contains("Could not remove Gatekeeper quarantine"),
        "{error}"
    );
    assert!(
        error.contains("Exact bundle and state preimages were restored"),
        "{error}"
    );
    assert_eq!(fs::read(app_strings).unwrap(), original_json);
    assert_eq!(fs::read(info_plist).unwrap(), original_plist);
    assert_eq!(fs::read(keychain).unwrap(), original_keychain);
    assert!(!app.join("Contents/MacOS/CavalryLauncher").exists());
    assert_ne!(
        state::read_state(&state_dir).unwrap().current_lang,
        "zh-Hans"
    );
}

#[test]
#[cfg(target_os = "macos")]
fn english_ui_and_official_restore_are_distinct_macos_actions() {
    let temp = tempfile::tempdir().unwrap();
    let repo = temp.path().join("repo");
    let state_dir = temp.path().join("state");
    let resources = temp.path().join("resources");
    let app = make_bundle(temp.path());
    make_language(&repo, "zh-Hans");
    write(
        &resources.join("injector/libCavalryTranslatorInjector.dylib"),
        b"injector",
    );
    let info_path = app.join("Contents/Info.plist");
    let keychain_path = app.join("Contents/Frameworks/libExtensionLayer.dylib");
    let original_info = fs::read(&info_path).unwrap();
    let original_keychain = fs::read(&keychain_path).unwrap();

    apply_language_inner(
        &repo,
        &state_dir,
        &resources,
        &app,
        "zh-Hans",
        &mut RecordingRunner::default(),
        "2026-04-23T00:00:00.000Z",
    )
    .unwrap();
    assert!(app.join("Contents/MacOS/CavalryLauncher").exists());
    assert!(app
        .join("Contents/Frameworks/libCavalryTranslatorInjector.dylib")
        .exists());

    let english_ui = apply_language_inner(
        &repo,
        &state_dir,
        &resources,
        &app,
        "en",
        &mut RecordingRunner::default(),
        "2026-04-23T00:01:00.000Z",
    )
    .unwrap();

    assert!(english_ui.ok);
    assert_eq!(english_ui.current_lang.as_deref(), Some("en"));
    assert_ne!(fs::read(&info_path).unwrap(), original_info);
    assert_ne!(fs::read(&keychain_path).unwrap(), original_keychain);
    assert!(app.join("Contents/MacOS/CavalryLauncher").exists());
    assert!(app
        .join("Contents/Frameworks/libCavalryTranslatorInjector.dylib")
        .exists());
    assert_eq!(
        fs::read_to_string(app.join("Contents/Resources/cavalry-i18n-lang.txt")).unwrap(),
        "en\n"
    );

    let restored = apply_language_inner(
        &repo,
        &state_dir,
        &resources,
        &app,
        super::context::RESTORE_OFFICIAL_ACTION,
        &mut RecordingRunner::default(),
        "2026-04-23T00:02:00.000Z",
    )
    .unwrap();

    assert!(restored.ok);
    assert_eq!(restored.current_lang.as_deref(), Some("en"));
    assert_eq!(fs::read(info_path).unwrap(), original_info);
    assert_eq!(fs::read(keychain_path).unwrap(), original_keychain);
    assert!(!app.join("Contents/MacOS/CavalryLauncher").exists());
    assert!(!app
        .join("Contents/Frameworks/libCavalryTranslatorInjector.dylib")
        .exists());
    assert!(!app
        .join("Contents/Resources/cavalry-i18n-lang.txt")
        .exists());
    assert_eq!(
        fs::read(app.join("Contents/assets/Definitions/appStrings.json")).unwrap(),
        br#"{"value":"en"}"#
    );
}

#[test]
#[cfg(target_os = "macos")]
fn official_restore_signature_mismatch_rolls_back_to_the_complete_managed_preimage() {
    let temp = tempfile::tempdir().unwrap();
    let repo = temp.path().join("repo");
    let state_dir = temp.path().join("state");
    let resources = temp.path().join("resources");
    let app = make_bundle(temp.path());
    make_language(&repo, "zh-Hans");
    write(
        &resources.join("injector/libCavalryTranslatorInjector.dylib"),
        b"injector",
    );
    apply_language_inner(
        &repo,
        &state_dir,
        &resources,
        &app,
        "zh-Hans",
        &mut RecordingRunner::default(),
        "2026-04-23T00:00:00.000Z",
    )
    .unwrap();
    let tracked = [
        app.join("Contents/Info.plist"),
        app.join("Contents/MacOS/CavalryLauncher"),
        app.join("Contents/Frameworks/libCavalryTranslatorInjector.dylib"),
        app.join("Contents/Frameworks/libExtensionLayer.dylib"),
        app.join("Contents/Resources/cavalry-i18n-lang.txt"),
        app.join("Contents/assets/Definitions/appStrings.json"),
        state_dir.join("state.json"),
    ];
    let before = tracked
        .iter()
        .map(|path| fs::read(path).unwrap())
        .collect::<Vec<_>>();
    let mut runner = RestoreSignatureMismatchRunner::default();

    let error = apply_language_inner(
        &repo,
        &state_dir,
        &resources,
        &app,
        super::context::RESTORE_OFFICIAL_ACTION,
        &mut runner,
        "2026-04-23T00:01:00.000Z",
    )
    .unwrap_err();

    assert!(error.contains("signature"), "{error}");
    assert!(error.contains("does not match"), "{error}");
    for (path, expected) in tracked.iter().zip(before) {
        assert_eq!(fs::read(path).unwrap(), expected, "{}", path.display());
    }
}

#[test]
#[cfg(target_os = "macos")]
fn managed_second_apply_accepts_only_a_code_signature_blob_change() {
    let temp = tempfile::tempdir().unwrap();
    let repo = temp.path().join("repo");
    let state_dir = temp.path().join("state");
    let resources = temp.path().join("resources");
    let app = make_bundle(temp.path());
    make_language(&repo, "zh-Hans");
    make_language(&repo, "zh-Hant");
    write(
        &resources.join("injector/libCavalryTranslatorInjector.dylib"),
        b"injector",
    );
    apply_language_inner(
        &repo,
        &state_dir,
        &resources,
        &app,
        "zh-Hans",
        &mut RecordingRunner::default(),
        "2026-04-23T00:00:00.000Z",
    )
    .unwrap();
    let revision = state::read_state(&state_dir).unwrap().cavalry_revision;

    // Real codesign changes the embedded signature bytes (and often their size)
    // while leaving the selected vendor code region unchanged.
    write(
        &app.join("Contents/MacOS/Cavalry"),
        signed_macho_arm64(b"different-sized-managed-ad-hoc-signature"),
    );
    let result = apply_language_inner(
        &repo,
        &state_dir,
        &resources,
        &app,
        "zh-Hant",
        &mut RecordingRunner::default(),
        "2026-04-23T00:01:00.000Z",
    )
    .unwrap();

    assert!(result.ok);
    assert_eq!(result.current_lang.as_deref(), Some("zh-Hant"));
    assert_eq!(
        state::read_state(&state_dir).unwrap().cavalry_revision,
        revision
    );
}

#[test]
#[cfg(target_os = "macos")]
fn managed_runtime_drift_is_rejected_before_a_second_bundle_mutation() {
    let temp = tempfile::tempdir().unwrap();
    let repo = temp.path().join("repo");
    let state_dir = temp.path().join("state");
    let resources = temp.path().join("resources");
    let app = make_bundle(temp.path());
    make_language(&repo, "zh-Hans");
    make_language(&repo, "zh-Hant");
    write(
        &resources.join("injector/libCavalryTranslatorInjector.dylib"),
        b"injector",
    );
    apply_language_inner(
        &repo,
        &state_dir,
        &resources,
        &app,
        "zh-Hans",
        &mut RecordingRunner::default(),
        "2026-04-23T00:00:00.000Z",
    )
    .unwrap();
    let app_strings = app.join("Contents/assets/Definitions/appStrings.json");
    let before = fs::read(&app_strings).unwrap();
    write(
        &app.join("Contents/MacOS/CavalryLauncher"),
        b"drifted wrapper",
    );
    let mut runner = RecordingRunner::default();

    let error = apply_language_inner(
        &repo,
        &state_dir,
        &resources,
        &app,
        "zh-Hant",
        &mut runner,
        "2026-04-23T00:01:00.000Z",
    )
    .unwrap_err();

    assert!(error.contains("launcher wrapper has drifted"), "{error}");
    assert_eq!(fs::read(app_strings).unwrap(), before);
    assert!(!runner.commands.iter().any(|command| {
        command.program == "xattr" || command.args.iter().any(|arg| arg == "--sign")
    }));
    assert_eq!(
        state::read_state(&state_dir).unwrap().current_lang,
        "zh-Hans"
    );
}

#[test]
#[cfg(target_os = "macos")]
fn macos_apply_rolls_back_json_runtime_keychain_and_state_when_signing_fails() {
    let temp = tempfile::tempdir().unwrap();
    let repo = temp.path().join("repo");
    let state_dir = temp.path().join("state");
    let resources = temp.path().join("resources");
    let app = make_bundle(temp.path());
    make_language(&repo, "zh-Hans");
    write(
        &resources.join("injector/libCavalryTranslatorInjector.dylib"),
        b"injector",
    );
    let app_strings = app.join("Contents/assets/Definitions/appStrings.json");
    let info_plist = app.join("Contents/Info.plist");
    let keychain = app.join("Contents/Frameworks/libExtensionLayer.dylib");
    let original_json = fs::read(&app_strings).unwrap();
    let original_plist = fs::read(&info_plist).unwrap();
    let original_keychain = fs::read(&keychain).unwrap();

    let mut runner = SigningCommandsFailTwiceRunner {
        commands: Vec::new(),
        failures_remaining: 2,
    };
    let error = apply_language_inner(
        &repo,
        &state_dir,
        &resources,
        &app,
        "zh-Hans",
        &mut runner,
        "2026-04-23T00:00:00.000Z",
    )
    .unwrap_err();

    assert!(error.contains("simulated signing failure"), "{error}");
    assert!(
        error.contains("Exact bundle and state preimages were restored"),
        "{error}"
    );
    assert_eq!(fs::read(app_strings).unwrap(), original_json);
    assert_eq!(fs::read(info_plist).unwrap(), original_plist);
    assert_eq!(fs::read(keychain).unwrap(), original_keychain);
    assert!(!app.join("Contents/MacOS/CavalryLauncher").exists());
    assert!(!app
        .join("Contents/Frameworks/libCavalryTranslatorInjector.dylib")
        .exists());
    assert!(!app
        .join("Contents/Resources/cavalry-i18n-lang.txt")
        .exists());
    assert_ne!(
        state::read_state(&state_dir).unwrap().current_lang,
        "zh-Hans"
    );
}

#[test]
#[cfg(target_os = "windows")]
fn windows_apply_plan_stages_generic_and_defers_final_marker_for_qpa() {
    let temp = tempfile::tempdir().unwrap();
    let repo = temp.path().join("repo");
    let resources = temp.path().join("resources");
    let app = make_windows_install(temp.path());
    let install_root = crate::install::InstallLayout::from_root(&app).root;
    let source_plugin = resources.join("injector/windows/generic/cavalryi18n.dll");
    write(&source_plugin, b"plugin");
    write(
        &resources.join("injector/windows/qpa/qwindows.dll"),
        b"qpa-proxy",
    );

    let plan = crate::platform_runtime::prepare_apply(
        &repo,
        &resources,
        &app,
        "zh-Hans",
        "2.7.2",
        &temp.path().join("staging"),
        None,
        None,
    )
    .unwrap();

    assert!(plan.defer_final_language_marker);
    assert_eq!(plan.runtime_pairs.len(), 1);
    assert_eq!(plan.runtime_pairs[0].src, source_plugin);
    assert_eq!(
        plan.runtime_pairs[0].dst,
        install_root.join("generic/cavalryi18n.dll")
    );
    assert_eq!(
        plan.final_language_marker.as_ref().unwrap().dst,
        install_root.join(crate::install::LANG_MARKER_NAME)
    );
}

#[test]
#[cfg(target_os = "macos")]
fn repeated_identical_apply_rejects_a_broken_prewrite_signature_without_mutation() {
    let temp = tempfile::tempdir().unwrap();
    let repo = temp.path().join("repo");
    let state = temp.path().join("state");
    let resources = temp.path().join("resources");
    let app = make_bundle(temp.path());
    make_language(&repo, "zh-Hans");
    let injector_source = resources.join("injector/libCavalryTranslatorInjector.dylib");
    write(&injector_source, b"injector");

    let mut first_runner = RecordingRunner::default();
    apply_language_inner(
        &repo,
        &state,
        &resources,
        &app,
        "zh-Hans",
        &mut first_runner,
        "2026-04-23T00:00:00.000Z",
    )
    .unwrap();
    let injector_before =
        fs::read(app.join("Contents/Frameworks/libCavalryTranslatorInjector.dylib")).unwrap();
    let marker_before = fs::read(app.join("Contents/Resources/cavalry-i18n-lang.txt")).unwrap();
    let state_before = fs::read(state.join("state.json")).unwrap();
    let mut second_runner = VerifyFailsOnceRunner {
        commands: Vec::new(),
        verify_failures: 1,
    };
    let error = apply_language_inner(
        &repo,
        &state,
        &resources,
        &app,
        "zh-Hans",
        &mut second_runner,
        "2026-04-23T00:01:00.000Z",
    )
    .unwrap_err();

    assert!(error.contains("bundle seal is damaged"), "{error}");
    assert_eq!(
        fs::read(app.join("Contents/Frameworks/libCavalryTranslatorInjector.dylib")).unwrap(),
        injector_before
    );
    assert_eq!(
        fs::read(app.join("Contents/Resources/cavalry-i18n-lang.txt")).unwrap(),
        marker_before
    );
    assert_eq!(fs::read(state.join("state.json")).unwrap(), state_before);
    assert!(!second_runner
        .commands
        .iter()
        .any(|command| command.args.iter().any(|arg| arg == "--sign")));
}

#[path = "tests/runtime.rs"]
mod runtime;
