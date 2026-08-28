/**
 * [INPUT]: 依赖 Tauri 的预注入 __TAURI_INTERNALS__.invoke（或兼容 __TAURI__.core.invoke）能力。
 * [OUTPUT]: 冻结最小 window.cavalryI18n API；仅转发 camelCase 业务 payload、固定 project-link id、应用版本与 main-window caption 操作，丢弃 raw warning、updater URL/签名/原始响应，并将 transport rejection 归一为 Error。
 * [POS]: renderer 的非视觉桥，关闭 withGlobalTauri 后仍在 app.js 前加载；业务只消费稳定 DTO，Windows caption 只消费标签固定的 Tauri window 命令。
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
  const UPDATE_ERROR_CODE_MANIFEST = Object.freeze([
    'updaterNotConfigured',
    'updaterUnsupportedPlatform',
    'updateCheckFailed',
    'updateInstallFailed',
    'updateNotChecked',
    'updateBusy',
    'updateStateUnavailable',
  ]);
  const PROJECT_LINK_MANIFEST = Object.freeze(['repository', 'license']);

  function resolveInvoke() {
    const internals = window.__TAURI_INTERNALS__;
    if (internals && typeof internals.invoke === 'function') return internals.invoke;
    const core = window.__TAURI__ && window.__TAURI__.core;
    if (core && typeof core.invoke === 'function') return core.invoke;
    throw new Error('Tauri invoke bridge is not ready.');
  }

  function invokeCommand(command, payload, requireResult) {
    return Promise.resolve()
      .then(() => resolveInvoke()(command, payload))
      .then((result) => {
        if (requireResult && typeof result === 'undefined') {
          throw new Error(`${command} returned undefined`);
        }
        return result;
      })
      .catch((error) => {
        const detail = (error && (error.message || String(error))) || 'unknown invoke error';
        throw new Error(`${command} failed: ${detail}`);
      });
  }

  function invoke(command, payload) {
    return invokeCommand(command, payload, true);
  }

  function invokeWindow(command) {
    return invokeCommand(`plugin:window|${command}`, { label: 'main' }, false);
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
      reconciliationRequired: result.reconciliationRequired === true,
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
      reconciliationRequired: result.reconciliationRequired === true,
      error: pick(result.error, null),
      errorCode: pick(result.errorCode, null),
    };
  }

  function normalizeUpdate(result, fallbackErrorCode) {
    const errorCode = typeof result.errorCode === 'string'
      ? UPDATE_ERROR_CODE_MANIFEST.includes(result.errorCode)
        ? result.errorCode
        : fallbackErrorCode
      : null;
    const available = result.available === true && typeof result.version === 'string';
    return {
      currentVersion: typeof result.currentVersion === 'string' ? result.currentVersion : '',
      version: available ? result.version.slice(0, 64) : null,
      notes: typeof result.notes === 'string' ? result.notes.slice(0, 4000) : null,
      pubDate: typeof result.pubDate === 'string' ? result.pubDate.slice(0, 64) : null,
      available,
      errorCode,
    };
  }

  window.cavalryI18n = Object.freeze({
    getStatus: () => invoke('get_status').then(normalizeStatus),
    browseApp: () => invoke('browse_app').then(normalizeBrowse),
    extractEnglish: (appPath) => invoke('extract_english', { appPath }).then(normalizeAction),
    applyLanguage: (appPath, lang) =>
      invoke('apply_language', { appPath, lang }).then(normalizeAction),
    openPrivacySecurity: () => invoke('open_privacy_security').then(normalizeAction),
    openProjectLink: (link) => {
      if (!PROJECT_LINK_MANIFEST.includes(link)) return Promise.reject(new Error('Unsupported project link.'));
      return invoke('open_project_link', { link }).then(normalizeAction);
    },
    getSwitcherVersion: () => invoke('plugin:app|version').then((version) => String(version || '').slice(0, 64)),
    checkUpdate: () =>
      invoke('check_update').then((result) => normalizeUpdate(result, 'updateCheckFailed')),
    installUpdate: () =>
      invoke('install_update').then((result) => normalizeUpdate(result, 'updateInstallFailed')),
    minimizeWindow: () => invokeWindow('minimize'),
    toggleMaximizeWindow: () => invokeWindow('toggle_maximize'),
    isWindowMaximized: () => invokeWindow('is_maximized').then((result) => result === true),
    closeWindow: () => invokeWindow('close'),
  });
})();
