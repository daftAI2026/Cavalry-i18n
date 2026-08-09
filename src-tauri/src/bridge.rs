/**
 * [INPUT]: 依赖 Tauri v2 pre-page-load window.__TAURI_INTERNALS__.invoke，并保留旧 global core.invoke 兼容读取
 * [OUTPUT]: 对外提供 Builder 实际嵌入的 bridge initialization script，创建最小冻结 window.cavalryI18n 与 warningCodes 兼容层
 * [POS]: src-tauri/src 的 renderer 桥；integration contract 执行此实际 Rust include，packaged WebView/CSP 仍由外部 UI gate 验证
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
pub fn script() -> &'static str {
    include_str!("../../renderer/tauri-bridge.js")
}

#[cfg(test)]
mod tests {
    use super::script;

    #[test]
    fn bridge_exposes_cavalry_i18n_api() {
        let source = script();
        for token in [
            "window.cavalryI18n",
            "getStatus",
            "browseApp",
            "extractEnglish",
            "applyLanguage",
            "openPrivacySecurity",
            "warningCodes",
            "invoke('get_status')",
        ] {
            assert!(source.contains(token), "{token} missing from bridge");
        }
        assert!(!source.contains("restartCavalry:"));
    }
}
