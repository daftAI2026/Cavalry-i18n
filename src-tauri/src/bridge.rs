/**
 * [INPUT]: 依赖 Tauri v2 window.__TAURI__.core.invoke 全局 API
 * [OUTPUT]: 对外提供 pre-page-load bridge script，创建 window.cavalryI18n 兼容层
 * [POS]: src-tauri/src 的 renderer 桥，提供 Tauri invoke 兼容层
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
            "restartCavalry",
            "invoke('get_status')",
        ] {
            assert!(source.contains(token), "{token} missing from bridge");
        }
    }
}
