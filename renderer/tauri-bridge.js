/**
 * [INPUT]: 依赖 Tauri 的 __TAURI__/__TAURI_INTERNALS__ invoke 能力
 * [OUTPUT]: 对外提供 window.cavalryI18n 兼容 API，保证 app.js 能拿到同名 Promise 接口
 * [POS]: renderer 的非视觉 Tauri bridge，作为页面脚本前置兼容层
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
(() => {
  if (window.cavalryI18n) {
    return;
  }

  function resolveInvoke() {
    const core = window.__TAURI__ && window.__TAURI__.core;
    if (core && typeof core.invoke === 'function') {
      return core.invoke;
    }
    const internals = window.__TAURI_INTERNALS__;
    if (internals && typeof internals.invoke === 'function') {
      return internals.invoke;
    }
    throw new Error('Tauri invoke bridge is not ready.');
  }

  function invoke(command, payload) {
    return Promise.resolve()
      .then(() => resolveInvoke()(command, payload))
      .then((result) => {
        if (typeof result === 'undefined') {
          throw new Error(`${command} returned undefined`);
        }
        return result;
      })
      .catch((error) => {
        const detail = (error && (error.message || (error.toString && error.toString()))) || 'unknown invoke error';
        throw new Error(`${command} failed: ${detail}`);
      });
  }

  function pick(value, fallback) {
    return typeof value === 'undefined' ? fallback : value;
  }

  function normalizeStatus(result) {
    const granted = pick(result.appManagementGranted, result.app_management_granted);
    return {
      appManagementGranted: typeof granted === 'boolean' ? granted : null,
      appPath: pick(result.appPath, result.app_path || ''),
      currentLang: pick(result.currentLang, result.current_lang || 'en'),
      defaultAppCandidates: pick(
        result.defaultAppCandidates,
        result.default_app_candidates || []
      ),
      diagnostics: pick(result.diagnostics, null),
      languages: pick(result.languages, []),
      needsExtract: pick(result.needsExtract, result.needs_extract || false),
      repoRoot: pick(result.repoRoot, result.repo_root || ''),
      version: pick(result.version, ''),
    };
  }

  function normalizeBrowse(result) {
    return {
      canceled: pick(result.canceled, false),
      appPath: pick(result.appPath, result.app_path || ''),
      version: pick(result.version, ''),
    };
  }

  function normalizeAction(result) {
    return {
      ok: pick(result.ok, false),
      count: pick(result.count, null),
      currentLang: pick(result.currentLang, result.current_lang || null),
      warning: pick(result.warning, null),
      permissionRequired: pick(result.permissionRequired, result.permission_required || false),
      error: pick(result.error, null),
    };
  }

  window.cavalryI18n = {
    getStatus: () => invoke('get_status').then(normalizeStatus),
    browseApp: () => invoke('browse_app').then(normalizeBrowse),
    extractEnglish: (appPath) =>
      invoke('extract_english', { appPath }).then(normalizeAction),
    applyLanguage: (appPath, lang) =>
      invoke('apply_language', { appPath, lang }).then(normalizeAction),
    openPrivacySecurity: () =>
      invoke('open_privacy_security').then(normalizeAction),
    restartCavalry: (appPath) =>
      invoke('restart_cavalry', { appPath }).then(normalizeAction),
  };
})();
