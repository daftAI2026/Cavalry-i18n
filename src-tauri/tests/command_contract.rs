/**
 * [INPUT]: 依赖 cavalry_i18n_tauri::commands 的注册表与跨平台序列化 payload
 * [OUTPUT]: 对外提供 command 名称、权限动作、platform、稳定 errorCode、可组合 warningCodes 与 camelCase JSON shape contract tests
 * [POS]: src-tauri/tests 的 renderer API 守门，保持六命令和旧字段兼容，并显式暴露平台差异、可本土化错误与非致命清理 codes
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
use cavalry_i18n_tauri::commands::{registered_command_names, ActionPayload, StatusPayload};

#[test]
fn registers_six_commands_for_renderer_bridge() {
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
        startup_recovery_error: None,
        default_app_candidates: Vec::new(),
        diagnostics: None,
        languages: Vec::new(),
        needs_extract: false,
        permission_action: "openPrivacy".into(),
        platform: "macos".into(),
        repo_root: "/repo".into(),
        version: "2.3.4".into(),
    };
    let value = serde_json::to_value(payload).unwrap();
    assert_eq!(value["appManagementGranted"], true);
    assert_eq!(value["permissionAction"], "openPrivacy");
    assert_eq!(value["platform"], "macos");
    assert_eq!(value["installationMode"], "official");
    assert!(value.get("app_management_granted").is_none());
}
