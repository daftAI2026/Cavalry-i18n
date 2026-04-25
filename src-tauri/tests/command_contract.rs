/**
 * [INPUT]: 依赖 cavalry_i18n_tauri::commands 的注册表与序列化 payload
 * [OUTPUT]: 对外提供 command 名称、权限提示、App Management 预检状态和 JSON shape contract tests
 * [POS]: src-tauri/tests 的 renderer API 守门，确保 bridge 映射目标稳定
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
fn command_payload_uses_electron_compatible_camel_case() {
    let payload = ActionPayload {
        ok: true,
        count: None,
        current_lang: Some("zh-Hans".into()),
        warning: Some(String::new()),
        permission_required: true,
        error: None,
    };
    let value = serde_json::to_value(payload).unwrap();
    assert_eq!(value["ok"], true);
    assert_eq!(value["currentLang"], "zh-Hans");
    assert_eq!(value["permissionRequired"], true);
    assert!(value.get("current_lang").is_none());
    assert!(value.get("permission_required").is_none());
}

#[test]
fn status_payload_exposes_app_management_probe_result() {
    let payload = StatusPayload {
        app_management_granted: Some(true),
        app_path: "/Applications/Cavalry.app".into(),
        current_lang: "en".into(),
        default_app_candidates: Vec::new(),
        diagnostics: None,
        languages: Vec::new(),
        needs_extract: false,
        repo_root: "/repo".into(),
        version: "2.3.4".into(),
    };
    let value = serde_json::to_value(payload).unwrap();
    assert_eq!(value["appManagementGranted"], true);
    assert!(value.get("app_management_granted").is_none());
}
