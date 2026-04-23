/**
 * [INPUT]: 依赖 Tauri v2 window.__TAURI__.core.invoke 全局 API
 * [OUTPUT]: 对外提供 pre-page-load bridge script，创建 window.cavalryI18n 兼容层
 * [POS]: src-tauri/src 的 renderer 桥，等价替代 Electron preload.js
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
pub fn script() -> &'static str {
    r#"
(() => {
  const core = window.__TAURI__ && window.__TAURI__.core;
  const invoke = core && core.invoke;
  if (!invoke) {
    return;
  }
  window.cavalryI18n = {
    getStatus: () => invoke('get_status'),
    browseApp: () => invoke('browse_app'),
    extractEnglish: (appPath) => invoke('extract_english', { appPath }),
    applyLanguage: (appPath, lang) => invoke('apply_language', { appPath, lang }),
    restartCavalry: (appPath) => invoke('restart_cavalry', { appPath }),
  };
})();
"#
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
            "restartCavalry",
            "invoke('get_status')",
        ] {
            assert!(source.contains(token), "{token} missing from bridge");
        }
    }
}
