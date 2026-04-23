/**
 * [INPUT]: 依赖 cavalry_i18n_tauri::commands 的注册表与序列化 payload
 * [OUTPUT]: 对外提供 command 名称和 JSON shape contract tests
 * [POS]: src-tauri/tests 的 renderer API 守门，确保 bridge 映射目标稳定
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
use cavalry_i18n_tauri::commands::{registered_command_names, ActionPayload};

#[test]
fn registers_five_commands_for_renderer_bridge() {
    assert_eq!(
        registered_command_names(),
        &[
            "get_status",
            "browse_app",
            "extract_english",
            "apply_language",
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
        error: None,
    };
    let value = serde_json::to_value(payload).unwrap();
    assert_eq!(value["ok"], true);
    assert_eq!(value["currentLang"], "zh-Hans");
    assert!(value.get("current_lang").is_none());
}
