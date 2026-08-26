/**
 * [INPUT]: 依赖 commands 测试 fixture、平台条件编译 runner 与 commands facade 的 apply/restart seam。
 * [OUTPUT]: 覆盖打包资源解析、macOS 注入器定位、Windows QPA ACTIVE/诊断环境启动边界与语言应用回归场景。
 * [POS]: commands/tests 的运行时集成测试；将资源、应用、重启行为从基础契约测试中隔离。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
use super::super::apply_language_inner;
#[cfg(any(target_os = "macos", target_os = "windows"))]
use super::super::restart_cavalry_inner;
#[cfg(target_os = "windows")]
use super::super::restart_cavalry_inner_with_qpa_inspector;
#[cfg(not(target_os = "macos"))]
use super::make_english_snapshot;
use super::{make_bundle, make_language, status_for_paths, write};
#[cfg(target_os = "windows")]
use super::{make_windows_install, write_windows_runtime_state, WindowsRuntimeRestartRunner};
use crate::privilege::RecordingRunner;
use std::fs;
#[cfg(target_os = "windows")]
use std::path::Path;

#[cfg(target_os = "windows")]
fn active_qpa(
    _layout: &crate::install::InstallLayout,
) -> Result<crate::windows_qpa::QpaInspection, String> {
    Ok(crate::windows_qpa::QpaInspection {
        state: crate::windows_qpa::QpaDeploymentState::Active,
        phase: Some(crate::windows_qpa::QpaManifestPhase::Active),
        current_qwindows_sha256: Some("a".repeat(64)),
        detail: "test-owned ACTIVE inspection".to_string(),
    })
}

#[test]
fn status_uses_packaged_resource_languages_when_repo_root_is_missing() {
    let temp = tempfile::tempdir().unwrap();
    let repo = temp.path().join("missing-repo");
    let state = temp.path().join("state");
    let resources = temp.path().join("resources");
    make_language(&resources, "zh-Hans");
    make_language(&resources, "ja_JP");

    let status = status_for_paths(&repo, &state, &resources, Vec::new()).unwrap();
    let values = status
        .languages
        .iter()
        .map(|language| language.value.as_str())
        .collect::<Vec<_>>();

    assert!(values.contains(&"en"));
    assert!(values.contains(&"zh-Hans"));
    assert!(values.contains(&"ja_JP"));
}

#[test]
fn status_finds_languages_when_tauri_stores_parent_resources_under_up_dir() {
    let temp = tempfile::tempdir().unwrap();
    let repo = temp.path().join("missing-repo");
    let state = temp.path().join("state");
    let resources = temp.path().join("resources");
    make_language(&resources.join("_up_"), "zh-Hans");
    make_language(&resources.join("_up_"), "zh-Hant");
    make_language(&resources.join("_up_"), "ja_JP");

    let status = status_for_paths(&repo, &state, &resources, Vec::new()).unwrap();
    let values = status
        .languages
        .iter()
        .map(|language| language.value.as_str())
        .collect::<Vec<_>>();

    assert_eq!(values, vec!["en", "zh-Hans", "zh-Hant", "ja_JP"]);
}

#[test]
fn apply_language_uses_packaged_resource_languages_when_repo_root_is_missing() {
    let temp = tempfile::tempdir().unwrap();
    let repo = temp.path().join("missing-repo");
    let state = temp.path().join("state");
    let resources = temp.path().join("resources");
    let app = make_bundle(temp.path());
    make_language(&resources, "zh-Hans");
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
}

#[test]
fn apply_language_finds_languages_when_tauri_stores_parent_resources_under_up_dir() {
    let temp = tempfile::tempdir().unwrap();
    let repo = temp.path().join("missing-repo");
    let state = temp.path().join("state");
    let resources = temp.path().join("resources");
    let app = make_bundle(temp.path());
    make_language(&resources.join("_up_"), "zh-Hans");
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
}

#[test]
fn apply_language_finds_sibling_injector_when_resource_dir_points_at_up_dir() {
    let temp = tempfile::tempdir().unwrap();
    let repo = temp.path().join("missing-repo");
    let state = temp.path().join("state");
    let resources = temp.path().join("resources");
    let resource_dir = resources.join("_up_");
    let app = make_bundle(temp.path());
    make_language(&resource_dir, "zh-Hans");
    write(
        &resources.join("injector/libCavalryTranslatorInjector.dylib"),
        b"injector",
    );

    let mut runner = RecordingRunner::default();
    let result = apply_language_inner(
        &repo,
        &state,
        &resource_dir,
        &app,
        "zh-Hans",
        &mut runner,
        "2026-04-23T00:00:00.000Z",
    )
    .unwrap();

    assert!(result.ok);
    assert_eq!(result.current_lang.as_deref(), Some("zh-Hans"));
}

#[test]
#[cfg(not(any(target_os = "macos", target_os = "windows")))]
fn non_macos_apply_language_english_skips_keychain_patch() {
    let temp = tempfile::tempdir().unwrap();
    let repo = temp.path().join("repo");
    let state = temp.path().join("state");
    let resources = temp.path().join("resources");
    let app = make_bundle(temp.path());
    make_language(&repo, "zh-Hans");
    make_english_snapshot(&state, &app);
    write(
        &resources.join("injector/libCavalryTranslatorInjector.dylib"),
        b"injector",
    );
    fs::create_dir_all(&state).unwrap();
    fs::write(
            state.join("state.json"),
            format!(
                "{{\"appPath\":\"{}\",\"cavalryVersion\":\"2.7.2\",\"currentLang\":\"zh-Hans\",\"lastPatchedAt\":\"old\"}}\n",
                app.to_string_lossy()
            ),
        )
        .unwrap();
    fs::remove_file(app.join("Contents/Frameworks/libExtensionLayer.dylib")).unwrap();

    let mut runner = RecordingRunner::default();
    let result = apply_language_inner(
        &repo,
        &state,
        &resources,
        &app,
        "en",
        &mut runner,
        "2026-04-23T00:00:00.000Z",
    )
    .unwrap();

    assert!(result.ok);
    assert_eq!(result.current_lang.as_deref(), Some("en"));
}

#[test]
#[cfg(target_os = "macos")]
fn apply_language_patch_failure_aborts_resign() {
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
    fs::remove_file(app.join("Contents/Frameworks/libExtensionLayer.dylib")).unwrap();

    let mut runner = RecordingRunner::default();
    let error = apply_language_inner(
        &repo,
        &state,
        &resources,
        &app,
        "zh-Hans",
        &mut runner,
        "2026-04-23T00:00:00.000Z",
    )
    .unwrap_err();

    assert!(error.contains("libExtensionLayer.dylib"), "{error}");
    assert!(!runner
        .commands
        .iter()
        .any(|command| command.program == "codesign"));
}

#[test]
#[cfg(target_os = "windows")]
fn restart_cavalry_inner_passes_packaged_plugin_environment_to_windows_runner() {
    let temp = tempfile::tempdir().unwrap();
    let app = temp.path().join("Cavalry");
    let state_dir = temp.path().join("state");
    let resources = temp.path().join("resources");
    let plugin = app.join("generic/cavalryi18n.dll");
    write(&app.join("Cavalry.exe"), b"binary");
    write(&app.join("assets/Definitions/appStrings.json"), b"{}");
    write(&app.join("assets/Definitions/nodeStrings.json"), b"{}");
    write(&plugin, b"plugin");
    write(
        &resources.join("injector/windows/generic/cavalryi18n.dll"),
        b"plugin",
    );
    write(&app.join(crate::install::LANG_MARKER_NAME), b"zh-Hans\n");
    let install_root = crate::install::normalize_path(&app);
    write_windows_runtime_state(&state_dir, &install_root, "zh-Hans");

    let mut runner = WindowsRuntimeRestartRunner::default();
    restart_cavalry_inner_with_qpa_inspector(
        temp.path(),
        &state_dir,
        &resources,
        &app,
        &mut runner,
        active_qpa,
    )
    .unwrap();

    let variables = runner
        .environment
        .iter()
        .map(|(key, value)| {
            (
                key.to_string_lossy().to_string(),
                value.to_string_lossy().to_string(),
            )
        })
        .collect::<std::collections::BTreeMap<_, _>>();
    assert_eq!(runner.commands[0].program, "powershell.exe");
    assert_eq!(
        runner.commands[1].program,
        install_root.join("Cavalry.exe").to_string_lossy()
    );
    assert_eq!(
        runner.working_directory.as_deref(),
        Some(install_root.as_path())
    );
    assert_eq!(variables.len(), 1);
    assert!(!variables.contains_key("QT_PLUGIN_PATH"));
    assert!(!variables.contains_key("QT_QPA_GENERIC_PLUGINS"));
    assert!(!variables.contains_key("CAVALRY_I18N_LANG"));
    assert!(Path::new(&variables["CAVALRY_I18N_DIAGNOSTIC_MARKER"]).is_absolute());
}

#[test]
#[cfg(target_os = "windows")]
fn restart_cavalry_inner_refuses_tampered_installed_plugin_before_spawn() {
    let temp = tempfile::tempdir().unwrap();
    let app = make_windows_install(temp.path());
    let state_dir = temp.path().join("state");
    let resources = temp.path().join("resources");
    let repo = temp.path().join("repo");
    let install_root = crate::install::normalize_path(&app);
    write(
        &resources.join("injector/windows/generic/cavalryi18n.dll"),
        b"trusted-plugin",
    );
    write(&app.join("generic/cavalryi18n.dll"), b"tampered-plugin");
    write(&app.join(crate::install::LANG_MARKER_NAME), b"zh-Hans\n");
    write_windows_runtime_state(&state_dir, &install_root, "zh-Hans");

    let mut runner = WindowsRuntimeRestartRunner::default();
    let error =
        restart_cavalry_inner(&repo, &state_dir, &resources, &app, &mut runner).unwrap_err();

    assert!(error.contains("integrity check failed"), "{error}");
    assert!(error.contains("Reapply the selected language"), "{error}");
    assert!(runner.commands.is_empty());
    assert!(runner.environment.is_empty());
}

#[test]
#[cfg(target_os = "windows")]
fn restart_cavalry_inner_refuses_missing_trusted_plugin_before_spawn() {
    let temp = tempfile::tempdir().unwrap();
    let app = make_windows_install(temp.path());
    let state_dir = temp.path().join("state");
    let resources = temp.path().join("resources");
    let repo = temp.path().join("repo");
    let install_root = crate::install::normalize_path(&app);
    write(&app.join("generic/cavalryi18n.dll"), b"installed-plugin");
    write(&app.join(crate::install::LANG_MARKER_NAME), b"ja_JP\n");
    write_windows_runtime_state(&state_dir, &install_root, "ja_JP");

    let mut runner = WindowsRuntimeRestartRunner::default();
    let error =
        restart_cavalry_inner(&repo, &state_dir, &resources, &app, &mut runner).unwrap_err();

    assert!(error.contains("Could not verify"), "{error}");
    assert!(error.contains("Reapply the selected language"), "{error}");
    assert!(runner.commands.is_empty());
    assert!(runner.environment.is_empty());
}

#[test]
#[cfg(target_os = "macos")]
fn restart_cavalry_inner_uses_runner() {
    let temp = tempfile::tempdir().unwrap();
    let app = make_bundle(temp.path());
    let mut runner = RecordingRunner::default();
    restart_cavalry_inner(
        temp.path(),
        &temp.path().join("state"),
        temp.path(),
        &app,
        &mut runner,
    )
    .unwrap();
    assert_eq!(runner.commands.len(), 1);
    assert_eq!(runner.commands[0].program, "open");
    assert_eq!(
        runner.commands[0].args,
        vec!["-n", fs::canonicalize(app).unwrap().to_str().unwrap()]
    );
}
