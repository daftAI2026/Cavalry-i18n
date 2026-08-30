/**
 * [INPUT]: 依赖 cavalry_i18n_tauri::commands 的注册表与跨平台序列化 payload
 * [OUTPUT]: 对外提供 command 名称、权限动作、platform、Status 版本兼容/官方恢复能力、稳定 errorCode、可组合 warningCodes、Windows residue、Updater DTO 与 camelCase JSON shape contract tests
 * [POS]: src-tauri/tests 的 renderer API 守门，保持九命令和旧字段兼容，并显式暴露平台差异、Managed Legacy/版本只读字段、固定项目外链、可本土化错误、Windows runtime residue 与脱敏更新状态
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
use cavalry_i18n_tauri::commands::{
    registered_command_names, ActionPayload, StatusPayload, UpdatePayload,
};
use std::{fs, path::Path};

#[test]
fn registers_nine_commands_for_renderer_bridge() {
    assert_eq!(
        registered_command_names(),
        &[
            "get_status",
            "browse_app",
            "apply_language",
            "open_privacy_security",
            "open_project_link",
            "show_about",
            "restart_cavalry",
            "check_update",
            "install_update"
        ]
    );
}

#[test]
fn updater_commands_are_registered_in_the_rust_builder() {
    let manifest_dir = Path::new(env!("CARGO_MANIFEST_DIR"));
    let lib_rs = fs::read_to_string(manifest_dir.join("src/lib.rs")).unwrap();

    assert!(lib_rs.contains("tauri_plugin_updater::Builder::new().build()"));
    assert!(lib_rs.contains("commands::check_update"));
    assert!(lib_rs.contains("commands::install_update"));
}

#[test]
fn macos_and_windows_about_entries_share_one_native_window_owner() {
    let manifest_dir = Path::new(env!("CARGO_MANIFEST_DIR"));
    let lib_rs = fs::read_to_string(manifest_dir.join("src/lib.rs")).unwrap();
    let about_rs = fs::read_to_string(manifest_dir.join("src/about_window.rs")).unwrap();

    assert!(lib_rs.contains("fn build_macos_menu"));
    assert!(lib_rs.contains("app_menu.remove_at(0)?"));
    assert!(lib_rs.contains("MACOS_ABOUT_MENU_ID"));
    assert!(lib_rs.contains("about_window::show_about_window(app)"));
    assert!(lib_rs.contains("commands::show_about"));
    assert!(!lib_rs.contains("cavalryI18nShowAbout"));
    assert!(about_rs.contains("ABOUT_WINDOW_LABEL: &str = \"about\""));
    assert!(about_rs.contains("WebviewUrl::App(\"about.html\".into())"));
    for option in [
        ".resizable(false)",
        ".maximizable(false)",
        ".minimizable(false)",
        ".decorations(true)",
    ] {
        assert!(about_rs.contains(option), "About owner must set {option}");
    }
}

#[test]
fn updater_payload_is_camel_case_and_never_exposes_plugin_secrets() {
    let payload = UpdatePayload {
        current_version: "0.7.0".into(),
        version: Some("0.7.1".into()),
        notes: Some("Bug fixes".into()),
        pub_date: Some("2026-08-28T00:00:00.000Z".into()),
        available: true,
        error_code: None,
    };
    let value = serde_json::to_value(payload).unwrap();
    let object = value.as_object().unwrap();

    assert_eq!(object.len(), 6);
    assert_eq!(value["currentVersion"], "0.7.0");
    assert_eq!(value["version"], "0.7.1");
    assert_eq!(value["notes"], "Bug fixes");
    assert_eq!(value["pubDate"], "2026-08-28T00:00:00.000Z");
    assert_eq!(value["available"], true);
    assert_eq!(value["errorCode"], serde_json::Value::Null);
    assert!(value.get("url").is_none());
    assert!(value.get("signature").is_none());
    assert!(value.get("rawJson").is_none());
}

#[test]
fn command_payload_uses_renderer_compatible_camel_case() {
    let payload = ActionPayload {
        ok: true,
        count: None,
        current_lang: Some("zh-Hans".into()),
        warning: Some(
            "Language files were applied; cleanup residual remains at C:\\Temp\\backup".into(),
        ),
        permission_required: true,
        reconciliation_required: true,
        error: None,
        error_code: Some("cavalryStillRunning".into()),
        warning_code: Some("restartFailed".into()),
        warning_codes: vec!["restartFailed".into(), "temporaryCleanupPending".into()],
    };
    let value = serde_json::to_value(payload).unwrap();
    assert_eq!(value["ok"], true);
    assert_eq!(value["currentLang"], "zh-Hans");
    assert_eq!(
        value["warning"],
        "Language files were applied; cleanup residual remains at C:\\Temp\\backup"
    );
    assert_eq!(value["permissionRequired"], true);
    assert_eq!(value["reconciliationRequired"], true);
    assert_eq!(value["errorCode"], "cavalryStillRunning");
    assert_eq!(value["warningCode"], "restartFailed");
    assert_eq!(
        value["warningCodes"],
        serde_json::json!(["restartFailed", "temporaryCleanupPending"])
    );
    assert!(value.get("current_lang").is_none());
    assert!(value.get("permission_required").is_none());
    assert!(value.get("error_code").is_none());
    assert!(value.get("warning_codes").is_none());
}

#[test]
fn status_payload_exposes_app_management_probe_result() {
    let payload = StatusPayload {
        app_management_granted: Some(true),
        app_path: "/Applications/Cavalry.app".into(),
        current_lang: "en".into(),
        installation_mode: "official".into(),
        official_recovery_available: true,
        startup_recovery_error: None,
        default_app_candidates: Vec::new(),
        diagnostics: None,
        languages: Vec::new(),
        needs_extract: false,
        permission_action: "openPrivacy".into(),
        platform: "macos".into(),
        reconciliation_required: true,
        repo_root: "/repo".into(),
        supported_version: "2.7.2".into(),
        version: "2.3.4".into(),
        version_compatibility: "olderUnsupported".into(),
    };
    let value = serde_json::to_value(payload).unwrap();
    assert_eq!(value["appManagementGranted"], true);
    assert_eq!(value["permissionAction"], "openPrivacy");
    assert_eq!(value["platform"], "macos");
    assert_eq!(value["reconciliationRequired"], true);
    assert_eq!(value["installationMode"], "official");
    assert_eq!(value["officialRecoveryAvailable"], true);
    assert_eq!(value["supportedVersion"], "2.7.2");
    assert_eq!(value["versionCompatibility"], "olderUnsupported");
    assert!(value.get("app_management_granted").is_none());
}
