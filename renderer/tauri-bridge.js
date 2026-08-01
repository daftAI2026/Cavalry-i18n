/**
 * [INPUT]: 依赖 Tauri 的 __TAURI__/__TAURI_INTERNALS__ invoke 能力
 * [OUTPUT]: 对外提供 window.cavalryI18n 兼容 API，将 camelCase Tauri payload、稳定 errorCode 与平台权限语义归一化为 app.js 消费面
 * [POS]: renderer 的非视觉 Tauri bridge，作为页面脚本前置兼容层，保留六命令并隔离后端平台差异
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
    const granted = result.appManagementGranted;
    return {
      appManagementGranted: typeof granted === 'boolean' ? granted : null,
      appPath: pick(result.appPath, ''),
      currentLang: pick(result.currentLang, 'en'),
      defaultAppCandidates: pick(result.defaultAppCandidates, []),
      languages: pick(result.languages, []),
      needsExtract: pick(result.needsExtract, false),
      permissionAction: pick(result.permissionAction, 'none'),
      platform: pick(result.platform, ''),
      version: pick(result.version, ''),
    };
  }

  function normalizeBrowse(result) {
    return {
      canceled: pick(result.canceled, false),
      appPath: pick(result.appPath, ''),
      version: pick(result.version, ''),
    };
  }

  function normalizeAction(result) {
    return {
      ok: pick(result.ok, false),
      count: pick(result.count, null),
      currentLang: pick(result.currentLang, null),
      warning: pick(result.warning, null),
      permissionRequired: pick(result.permissionRequired, false),
      error: pick(result.error, null),
      errorCode: pick(result.errorCode, null),
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
