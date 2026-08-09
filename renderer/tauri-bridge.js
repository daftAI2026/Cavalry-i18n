/**
 * [INPUT]: 依赖 Tauri 的预注入 __TAURI_INTERNALS__.invoke（或兼容 __TAURI__.core.invoke）能力。
 * [OUTPUT]: 冻结最小 window.cavalryI18n API；仅转发 camelCase payload（含 macOS 官方/受管安装态与可组合 warningCodes），丢弃 raw warning prose，并将 transport rejection 归一为 Error。
 * [POS]: renderer 的非视觉桥，关闭 withGlobalTauri 后仍在 app.js 前加载；语言 manifest 与 warning code manifest 都不由后端原文决定。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
(() => {
  if (window.cavalryI18n) return;

  const LANGUAGE_MANIFEST = Object.freeze([
    Object.freeze({ value: 'en', label: 'English' }),
    Object.freeze({ value: 'zh-Hans', label: '简体中文' }),
    Object.freeze({ value: 'zh-Hant', label: '繁體中文' }),
    Object.freeze({ value: 'ja_JP', label: '日本語' }),
  ]);
  const WARNING_CODE_MANIFEST = Object.freeze([
    'restartFailed',
    'stateDurabilityPending',
    'recoveryCleanupPending',
    'protectedRecoveryEvidenceRetained',
    'temporaryCleanupPending',
    'finderFallbackUsed',
    'nonFatalCleanup',
  ]);

  function resolveInvoke() {
    const internals = window.__TAURI_INTERNALS__;
    if (internals && typeof internals.invoke === 'function') return internals.invoke;
    const core = window.__TAURI__ && window.__TAURI__.core;
    if (core && typeof core.invoke === 'function') return core.invoke;
    throw new Error('Tauri invoke bridge is not ready.');
  }

  function invoke(command, payload) {
    return Promise.resolve()
      .then(() => resolveInvoke()(command, payload))
      .then((result) => {
        if (typeof result === 'undefined') throw new Error(`${command} returned undefined`);
        return result;
      })
      .catch((error) => {
        const detail = (error && (error.message || String(error))) || 'unknown invoke error';
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
      currentLang: LANGUAGE_MANIFEST.some(({ value }) => value === result.currentLang)
        ? result.currentLang
        : 'en',
      installationMode: pick(result.installationMode, 'unknown'),
      startupRecoveryError: pick(result.startupRecoveryError, null),
      defaultAppCandidates: Array.isArray(result.defaultAppCandidates)
        ? result.defaultAppCandidates.filter((candidate) => typeof candidate === 'string')
        : [],
      languages: LANGUAGE_MANIFEST,
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
    const warningCodes = [];
    const legacyWarningCode =
      typeof result.warningCode === 'string' && WARNING_CODE_MANIFEST.includes(result.warningCode)
        ? result.warningCode
        : null;
    const candidates = [
      ...(Array.isArray(result.warningCodes) ? result.warningCodes : []),
      legacyWarningCode,
    ].filter((code) => typeof code === 'string' && code.length > 0);
    for (const code of candidates) {
      const normalized = WARNING_CODE_MANIFEST.includes(code) ? code : 'nonFatalCleanup';
      if (!warningCodes.includes(normalized)) warningCodes.push(normalized);
    }
    if (warningCodes.length === 0 && result.warning) warningCodes.push('nonFatalCleanup');
    return {
      ok: pick(result.ok, false),
      count: pick(result.count, null),
      currentLang: pick(result.currentLang, null),
      warning: null,
      warningCode: legacyWarningCode,
      warningCodes: Object.freeze(warningCodes),
      permissionRequired: pick(result.permissionRequired, false),
      error: pick(result.error, null),
      errorCode: pick(result.errorCode, null),
    };
  }

  window.cavalryI18n = Object.freeze({
    getStatus: () => invoke('get_status').then(normalizeStatus),
    browseApp: () => invoke('browse_app').then(normalizeBrowse),
    extractEnglish: (appPath) => invoke('extract_english', { appPath }).then(normalizeAction),
    applyLanguage: (appPath, lang) =>
      invoke('apply_language', { appPath, lang }).then(normalizeAction),
    openPrivacySecurity: () => invoke('open_privacy_security').then(normalizeAction),
  });
})();
