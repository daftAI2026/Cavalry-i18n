/**
 * [INPUT]: 依赖 Tauri 的预注入 __TAURI_INTERNALS__.invoke/transformCallback/unregisterCallback（或兼容 __TAURI__.core.invoke）能力。
 * [OUTPUT]: 冻结最小 window.cavalryI18n API；Apply Channel 只转发 verify/baseline/apply/restart，Status 保留安装/版本兼容/官方恢复能力与 macOS 权限 handoff 前置标记，内部签名清理事实不进入 DTO；权限入口只接受固定 App Management 与有限 CSS rect，Updater Channel 只转发安全阶段与计数；其余接口仅转发固定 project-link、About 与 main-window caption，丢弃 raw warning、URL/签名/路径/原始响应。
 * [POS]: renderer 的非视觉桥，关闭 withGlobalTauri 后仍在 app.js/about-window.js 前加载；业务只消费稳定 DTO，About 只消费单一 Rust owner 命令，Windows caption 只消费标签固定的 Tauri window 命令。
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
  const VERSION_COMPATIBILITY = new Set([
    'supported', 'olderUnsupported', 'newerUnsupported', 'unknownUnsupported',
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
  const OPERATION_PHASE_MANIFEST = Object.freeze([
    'verifyInstallation',
    'ensureBaseline',
    'applyTransaction',
    'restartCavalry',
  ]);
  const OPERATION_STATE_MANIFEST = Object.freeze(['running', 'completed', 'warning', 'error']);
  const UPDATE_PHASE_MANIFEST = Object.freeze(['downloading', 'installing', 'restarting']);
  const HANDOFF_OUTCOME_MANIFEST = Object.freeze(['opened', 'retryRequested', 'dismissed', 'error']);
  const SERIALIZE_TO_IPC_FN = '__TAURI_TO_IPC_KEY__';

  class OrderedChannel {
    constructor(onmessage) {
      const internals = window.__TAURI_INTERNALS__;
      if (
        !internals ||
        typeof internals.transformCallback !== 'function' ||
        typeof internals.unregisterCallback !== 'function'
      ) {
        throw new Error('Tauri channel bridge is not ready.');
      }
      this.nextMessageIndex = 0;
      this.pendingMessages = new Map();
      this.messageEndIndex = null;
      this.onmessage = onmessage;
      this.id = internals.transformCallback((rawMessage) => this.receive(rawMessage));
    }

    receive(rawMessage) {
      if (!rawMessage || !Number.isInteger(rawMessage.index)) return;
      const { index } = rawMessage;
      if (Object.prototype.hasOwnProperty.call(rawMessage, 'end')) {
        if (index === this.nextMessageIndex) this.cleanup();
        else this.messageEndIndex = index;
        return;
      }
      if (index !== this.nextMessageIndex) {
        this.pendingMessages.set(index, rawMessage.message);
        return;
      }
      this.deliver(rawMessage.message);
      while (this.pendingMessages.has(this.nextMessageIndex)) {
        const message = this.pendingMessages.get(this.nextMessageIndex);
        this.pendingMessages.delete(this.nextMessageIndex);
        this.deliver(message);
      }
      if (this.nextMessageIndex === this.messageEndIndex) this.cleanup();
    }

    deliver(message) {
      this.onmessage(message);
      this.nextMessageIndex += 1;
    }

    cleanup() {
      window.__TAURI_INTERNALS__.unregisterCallback(this.id);
    }

    [SERIALIZE_TO_IPC_FN]() {
      return `__CHANNEL__:${this.id}`;
    }

    toJSON() {
      return this[SERIALIZE_TO_IPC_FN]();
    }
  }

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
    const compatibility = pick(result.versionCompatibility, 'supported');
    return {
      appManagementGranted: typeof granted === 'boolean' ? granted : null,
      appPath: pick(result.appPath, ''),
      currentLang: LANGUAGE_MANIFEST.some(({ value }) => value === result.currentLang)
        ? result.currentLang
        : 'en',
      installationMode: pick(result.installationMode, 'unknown'),
      macosPermissionHandoffRequired: result.platform === 'macos' && result.macosPermissionHandoffRequired === true,
      officialRecoveryAvailable: typeof result.officialRecoveryAvailable === 'boolean'
        ? result.officialRecoveryAvailable
        : result.installationMode !== 'managedLegacy',
      startupRecoveryError: pick(result.startupRecoveryError, null),
      defaultAppCandidates: Array.isArray(result.defaultAppCandidates)
        ? result.defaultAppCandidates.filter((candidate) => typeof candidate === 'string')
        : [],
      languages: LANGUAGE_MANIFEST,
      needsExtract: pick(result.needsExtract, false),
      permissionAction: pick(result.permissionAction, 'none'),
      platform: pick(result.platform, ''),
      reconciliationRequired: result.reconciliationRequired === true,
      supportedVersion: pick(result.supportedVersion, '2.7.2'),
      version: pick(result.version, ''),
      versionCompatibility: VERSION_COMPATIBILITY.has(compatibility)
        ? compatibility
        : 'unknownUnsupported',
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
      handoffOutcome: HANDOFF_OUTCOME_MANIFEST.includes(result.handoffOutcome)
        ? result.handoffOutcome
        : null,
    };
  }

  function normalizeSourceRect(sourceRect) {
    if (sourceRect === null || typeof sourceRect === 'undefined') return null;
    const values = ['x', 'y', 'width', 'height'].map((key) => Number(sourceRect[key]));
    if (!values.every(Number.isFinite) || values[0] < 0 || values[1] < 0 || values[2] <= 0 || values[3] <= 0) return null;
    return Object.freeze({ x: values[0], y: values[1], width: values[2], height: values[3] });
  }

  function normalizeViewport(viewport) {
    if (viewport === null || typeof viewport === 'undefined') return null;
    const values = ['width', 'height'].map((key) => Number(viewport[key]));
    if (!values.every(Number.isFinite) || values[0] <= 0 || values[1] <= 0) return null;
    return Object.freeze({ width: values[0], height: values[1] });
  }

  function normalizeHandoffEvent(result) {
    if (!result || !HANDOFF_OUTCOME_MANIFEST.includes(result.outcome) || result.outcome === 'opened') return null;
    return Object.freeze({ outcome: result.outcome });
  }

  function normalizeOperationEvent(result) {
    if (!result || typeof result !== 'object') return null;
    if (!OPERATION_PHASE_MANIFEST.includes(result.phase)) return null;
    if (!OPERATION_STATE_MANIFEST.includes(result.state)) return null;
    return Object.freeze({ phase: result.phase, state: result.state });
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

  function normalizeUpdateEvent(result) {
    if (!result || typeof result !== 'object') return null;
    if (!UPDATE_PHASE_MANIFEST.includes(result.phase)) return null;
    const downloaded = Number.isSafeInteger(result.downloaded) && result.downloaded >= 0
      ? result.downloaded
      : null;
    const contentLength = Number.isSafeInteger(result.contentLength) && result.contentLength > 0
      ? result.contentLength
      : null;
    return Object.freeze({ phase: result.phase, downloaded, contentLength });
  }

  window.cavalryI18n = Object.freeze({
    getStatus: () => invoke('get_status').then(normalizeStatus),
    browseApp: () => invoke('browse_app').then(normalizeBrowse),
    applyLanguage: (appPath, lang, onEvent = () => {}) => {
      const channel = new OrderedChannel((result) => {
        const event = normalizeOperationEvent(result);
        if (event) onEvent(event);
      });
      return invoke('apply_language', { appPath, lang, onEvent: channel }).then(normalizeAction);
    },
    openPrivacySecurity: (geometry = {}, onEvent = () => {}) => {
      const channel = new OrderedChannel((result) => {
        const event = normalizeHandoffEvent(result);
        if (event) onEvent(event);
      });
      return invoke('open_privacy_security', {
        request: {
          permission: 'appManagement',
          sourceRect: normalizeSourceRect(geometry?.sourceRect),
          viewportCss: normalizeViewport(geometry?.viewportCss),
        },
        onEvent: channel,
      }).then(normalizeAction);
    },
    openProjectLink: (link) => {
      if (!PROJECT_LINK_MANIFEST.includes(link)) return Promise.reject(new Error('Unsupported project link.'));
      return invoke('open_project_link', { link }).then(normalizeAction);
    },
    showAbout: () => invoke('show_about').then(normalizeAction),
    getSwitcherVersion: () => invoke('plugin:app|version').then((version) => String(version || '').slice(0, 64)),
    checkUpdate: () =>
      invoke('check_update').then((result) => normalizeUpdate(result, 'updateCheckFailed')),
    installUpdate: (onEvent = () => {}) => {
      const channel = new OrderedChannel((result) => {
        const event = normalizeUpdateEvent(result);
        if (event) onEvent(event);
      });
      return invoke('install_update', { onEvent: channel })
        .then((result) => normalizeUpdate(result, 'updateInstallFailed'));
    },
    minimizeWindow: () => invokeWindow('minimize'),
    toggleMaximizeWindow: () => invokeWindow('toggle_maximize'),
    isWindowMaximized: () => invokeWindow('is_maximized').then((result) => result === true),
    closeWindow: () => invokeWindow('close'),
  });
})();
