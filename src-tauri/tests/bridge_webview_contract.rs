/**
 * [INPUT]: 依赖 cavalry_i18n_tauri::bridge 与 src/lib.rs 装配源码
 * [OUTPUT]: 对外提供 pre-page-load bridge 注入与 invoke 兼容层 contract tests
 * [POS]: src-tauri/tests 的 bridge 守门，确保 vanilla renderer 在页面脚本前拿到 cavalryI18n API
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
use cavalry_i18n_tauri::bridge::script;
use std::{fs, path::Path};

#[test]
fn bridge_exposes_cavalry_i18n_api() {
    let source = script();
    for token in [
        "window.__TAURI__",
        "window.cavalryI18n",
        "getStatus",
        "browseApp",
        "extractEnglish",
        "applyLanguage",
        "restartCavalry",
        "invoke('get_status')",
    ] {
        assert!(source.contains(token), "{token} missing from bridge script");
    }
}

#[test]
fn bridge_is_injected_before_page_scripts() {
    let manifest_dir = Path::new(env!("CARGO_MANIFEST_DIR"));
    let lib_rs = fs::read_to_string(manifest_dir.join("src/lib.rs")).unwrap();
    let bridge_rs = fs::read_to_string(manifest_dir.join("src/bridge.rs")).unwrap();
    assert!(
        lib_rs.contains(".append_invoke_initialization_script(bridge::script())"),
        "Tauri builder must inject the compatibility bridge before renderer scripts execute"
    );
    assert!(
        bridge_rs.contains("include_str!(\"../../desktop-patcher/renderer/tauri-bridge.js\")"),
        "bridge.rs should reuse the checked-in renderer bridge instead of drifting from the HTML-loaded copy"
    );
}
