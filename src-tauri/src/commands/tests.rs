/**
 * [INPUT]: 渚濊禆 commands 鍚勮亴璐ｆā鍧椼€佷复鏃?bundle fixtures 涓?fake CommandRunner銆? * [OUTPUT]: 瑕嗙洊 command 鍏煎 DTO銆乻napshot/provenance銆佷簨鍔?marker銆乸latform runtime apply/restart銆? * [POS]: commands 鐨?owner unit tests锛涢€氳繃 facade 鍏紑鐨?crate-private seam 楠岃瘉璺ㄦā鍧楃紪鎺掋€? * [PROTOCOL]: 鍙樻洿鏃舵洿鏂版澶撮儴锛岀劧鍚庢鏌?CLAUDE.md
 */
#[cfg(target_os = "macos")]
use super::{acquire_bundle_file_lock, injector_source_candidates};
use super::{
    apply_language_inner, extract_english_inner, is_app_management_error,
    marker_guarded_transaction_pairs, permission_action, registered_command_names,
    resource_candidates, restart_cavalry_guarded, status_for_paths, sync_state_with_bundle,
    try_begin_bundle_operation, ActionPayload, BUSY_ERROR, COMMAND_NAMES,
};
use crate::privilege::{
    CommandRunner, PostCommitWarning, PostCommitWarningCode, RecordedCommand, RecordingRunner,
};
use crate::state::{self, EnglishSnapshotProvenance, State};
use std::{fs, path::Path};

#[cfg(target_os = "windows")]
use std::{ffi::OsString, path::PathBuf};

struct VerifyFailsOnceRunner {
    commands: Vec<RecordedCommand>,
    verify_failures: usize,
}

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
        let language = environment
            .iter()
            .find(|(key, _)| key.to_string_lossy() == "CAVALRY_I18N_LANG")
            .map(|(_, value)| value.to_string_lossy().to_string())
            .ok_or_else(|| "missing language environment".to_string())?;
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
fn typed_cleanup_warning_never_leaks_infrastructure_paths_or_details_to_renderer() {
    let warning = PostCommitWarning::new(
        PostCommitWarningCode::TransactionBackupCleanup,
        [Path::new("C:/sensitive/cavalry-i18n-copy-backup").to_path_buf()],
        Some("raw filesystem failure detail".to_string()),
    );

    let rendered = super::contract::renderer_warning_for_copy(&[warning], "direct").unwrap();

    assert!(!rendered.contains("C:/sensitive"));
    assert!(!rendered.contains("raw filesystem failure detail"));
    assert!(rendered.contains("Language files were applied"));
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

fn make_bundle(root: &Path) -> std::path::PathBuf {
    let app = root.join("Cavalry.app");
    write(
        &app.join("Contents/Info.plist"),
        r#"<plist><dict>
  <key>CFBundleExecutable</key>
  <string>Cavalry</string>
  <key>CFBundleShortVersionString</key>
  <string>2.3.4</string>
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
        [0xcf, 0xfa, 0xed, 0xfe],
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

fn make_english_snapshot(state: &Path) {
    let base = state.join("en");
    for (lang_rel, _) in crate::patch::CORE_MAP {
        write(&base.join(lang_rel), br#"{"value":"en"}"#);
    }
    write(
        &base.join("plugins/gaussianBlurFilter.json"),
        br#"{"value":"en plugin"}"#,
    );
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
fn legacy_state_preserves_language_for_same_app_and_semantic_version() {
    let temp = tempfile::tempdir().unwrap();
    let app = make_bundle(temp.path());
    let app = crate::install::normalize_path(&app);
    let state_dir = temp.path().join("state");
    let previous = State {
        app_path: app.to_string_lossy().to_string(),
        cavalry_version: "2.3.4".into(),
        current_lang: "zh-Hans".into(),
        ..State::default()
    };
    let revision = crate::detect::read_bundle_revision(&app).unwrap();

    let synced = sync_state_with_bundle(&state_dir, previous, &app, "2.3.4", &revision);

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
    make_english_snapshot(&state_dir);
    let revision = crate::detect::read_bundle_revision(&app).unwrap();
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
            }),
        },
    )
    .unwrap();

    let current = status_for_paths(&repo, &state_dir, &resources, vec![app.clone()]);
    assert_eq!(current.version, "");
    assert!(!current.needs_extract);

    write(&app.join("Cavalry.exe"), b"binary-mutated");
    let changed = status_for_paths(&repo, &state_dir, &resources, vec![app]);
    assert!(changed.needs_extract);
}

#[test]
fn verified_legacy_snapshot_migrates_provenance_while_install_is_translated() {
    let temp = tempfile::tempdir().unwrap();
    let repo = temp.path().join("repo");
    let state_dir = temp.path().join("state");
    let resources = temp.path().join("resources");
    let app = crate::install::normalize_path(&make_bundle(temp.path()));
    make_language(&repo, "zh-Hans");
    make_english_snapshot(&state_dir);
    write(
        &app.join("Contents/Resources/cavalry-i18n-lang.txt"),
        b"zh-Hans\n",
    );
    state::write_state(
        &state_dir,
        &State {
            app_path: app.to_string_lossy().to_string(),
            cavalry_version: "2.3.4".into(),
            current_lang: "zh-Hans".into(),
            ..State::default()
        },
    )
    .unwrap();

    let status = status_for_paths(&repo, &state_dir, &resources, vec![app.clone()]);
    let migrated = state::read_state(&state_dir).unwrap();

    assert_eq!(status.current_lang, "zh-Hans");
    assert!(!status.needs_extract);
    assert_eq!(
        migrated
            .english_snapshot_provenance
            .as_ref()
            .map(|value| value.install_root.as_str()),
        Some(app.to_string_lossy().as_ref())
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
    make_english_snapshot(&state_dir);
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
            cavalry_version: "2.3.4".into(),
            current_lang: "zh-Hans".into(),
            ..State::default()
        },
    )
    .unwrap();

    for _ in 0..2 {
        let status = status_for_paths(&repo, &state_dir, &resources, vec![app.clone()]);
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
        assert!(runner
            .commands
            .iter()
            .any(|command| command.program == "xattr"));
    }
}

#[test]
#[cfg(target_os = "windows")]
fn apply_language_stages_generic_plugin_into_selected_install_root() {
    let temp = tempfile::tempdir().unwrap();
    let repo = temp.path().join("repo");
    let state = temp.path().join("state");
    let resources = temp.path().join("resources");
    let app = make_windows_install(temp.path());
    let source_plugin = resources.join("injector/windows/generic/cavalryi18n.dll");
    make_language(&resources, "zh-Hans");
    write(&source_plugin, b"plugin");

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
    assert_eq!(
        fs::read(app.join("generic/cavalryi18n.dll")).unwrap(),
        b"plugin"
    );
    assert_eq!(
        fs::read_to_string(app.join(crate::install::LANG_MARKER_NAME)).unwrap(),
        "zh-Hans\n"
    );
    assert!(runner.commands.is_empty());

    let english = apply_language_inner(
        &repo,
        &state,
        &resources,
        &app,
        "en",
        &mut runner,
        "2026-04-23T00:01:00.000Z",
    )
    .unwrap();
    assert!(english.ok);
    assert_eq!(
        fs::read_to_string(app.join(crate::install::LANG_MARKER_NAME)).unwrap(),
        "en\n"
    );
}

#[test]
fn repeated_identical_apply_repairs_broken_signature_and_keeps_injection_payload() {
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
    let mut second_runner = VerifyFailsOnceRunner {
        commands: Vec::new(),
        verify_failures: 1,
    };
    let second = apply_language_inner(
        &repo,
        &state,
        &resources,
        &app,
        "zh-Hans",
        &mut second_runner,
        "2026-04-23T00:01:00.000Z",
    )
    .unwrap();

    assert!(second.ok);
    assert_eq!(second.current_lang.as_deref(), Some("zh-Hans"));
    #[cfg(target_os = "macos")]
    assert_eq!(
        fs::read(app.join("Contents/Frameworks/libCavalryTranslatorInjector.dylib")).unwrap(),
        fs::read(injector_source).unwrap()
    );
    #[cfg(target_os = "macos")]
    assert_eq!(
        fs::read_to_string(app.join("Contents/Resources/cavalry-i18n-lang.txt")).unwrap(),
        "zh-Hans\n"
    );
    if cfg!(target_os = "macos") {
        let verify_count = second_runner
            .commands
            .iter()
            .filter(|command| command.args.iter().any(|arg| arg == "--verify"))
            .count();
        let signing = second_runner
            .commands
            .iter()
            .filter(|command| command.args.iter().any(|arg| arg == "--sign"))
            .collect::<Vec<_>>();
        assert_eq!(verify_count, 2);
        assert!(!signing.is_empty());
        assert_eq!(
            signing
                .iter()
                .filter(|command| command.args.iter().any(|arg| arg == "--deep"))
                .count(),
            1
        );
        assert!(second_runner
            .commands
            .iter()
            .any(|command| command.program == "xattr"));
    }
}

#[path = "tests/runtime.rs"]
mod runtime;
