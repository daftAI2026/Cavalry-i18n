/**
 * [INPUT]: 依赖 window.cavalryI18n 的 Promise/有序阶段事件 API、window.createOperationLog/window.createUpdateProgress/window.createSelectControl/window.createTooltipControl/window.createPathDisplay/window.createAboutControl/window.createWindowControls 的独立状态机与语义投影、renderer/ui-text.js 的稳定文案与 renderer/index.html 的固定控件 id
 * [OUTPUT]: 对外提供跨平台桌面补丁器的四语标题/单任务流/有界三轨任务视窗与阶段专属语义图标、初始化 fail-closed 门禁、Cavalry 当前语言 Badge 与仅在验证通过时出现的 Official Badge、受控语言选择、平台统一 Restore、AlertDialog 确认、About、更新 tooltip/无障碍通知与签名冷更新交互；首次 Apply 由后端在写事务前自动建立恢复基线，loopback 开发预览只点亮更新入口且不访问网络。
 * [POS]: renderer 的唯一业务交互源，被 index.html 直接加载；只消费平台中立 bridge 契约，把真实后端事件压缩为面向用户的任务阶段，不暴露内部函数名、不虚构结果；持久阻塞留在事件视窗，只有必须立即选择的确认与权限动作进入 AlertDialog，About 由独立 native window owner 管理。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
const appVersion = document.querySelector('#appVersion');
const appPathText = document.querySelector('#appPath');
const appPathPrefix = document.querySelector('#appPathPrefix');
const appPathLeaf = document.querySelector('#appPathLeaf');
const skipLink = document.querySelector('#skipLink');
const windowTitle = document.querySelector('#windowTitle');
const updateControl = document.querySelector('#updateControl');
const updateButton = document.querySelector('#updateButton');
const updateTooltip = document.querySelector('#updateTooltip');
const updateTooltipText = document.querySelector('#updateTooltipText');
const updateAnnouncement = document.querySelector('#updateAnnouncement');
const languageSectionLabel = document.querySelector('#languageSectionLabel');
const currentLabel = document.querySelector('#currentLabel');
const currentLanguage = document.querySelector('#currentLanguage');
const installationBadge = document.querySelector('#installationBadge');
const installationModeText = document.querySelector('#installationMode');
const switchToLabel = document.querySelector('#switchToLabel');
const languageSelectRoot = document.querySelector('#languageSelectRoot');
const languageSelect = document.querySelector('#languageSelect');
const languageSelectTrigger = document.querySelector('#languageSelectTrigger');
const languageSelectValue = document.querySelector('#languageSelectValue');
const languageSelectPopup = document.querySelector('#languageSelectPopup');
const languageSelectList = document.querySelector('#languageSelectList');
const browseButton = document.querySelector('#browseButton');
const applyButton = document.querySelector('#applyButton');
const restoreButton = document.querySelector('#restoreButton');
const permissionButton = document.querySelector('#permissionButton');
const statusLabel = document.querySelector('#statusLabel');
const statusText = document.querySelector('#statusText');
const statusPanel = document.querySelector('#statusPanel');
const statusViewport = document.querySelector('#statusViewport');
const modalBackdrop = document.querySelector('#modalBackdrop');
const modalTitle = document.querySelector('#modalTitle');
const modalBody = document.querySelector('#modalBody');
const modalPrimaryButton = document.querySelector('#modalPrimaryButton');
const modalSecondaryButton = document.querySelector('#modalSecondaryButton');

const languageSelectControl = window.createSelectControl({
  root: languageSelectRoot,
  select: languageSelect,
  trigger: languageSelectTrigger,
  value: languageSelectValue,
  popup: languageSelectPopup,
  list: languageSelectList,
});
const operationLog = window.createOperationLog({
  root: statusPanel, idleMessage: document.querySelector('#statusIdle'),
  intro: document.querySelector('#statusIntro'), viewport: statusViewport,
  list: statusText, outcome: document.querySelector('#statusOutcome'),
});
const updateProgress = window.createUpdateProgress({ log: operationLog, text: t });
const pathDisplay = window.createPathDisplay({ root: appPathText, prefix: appPathPrefix, leaf: appPathLeaf });
const updateTooltipControl = window.createTooltipControl({
  root: updateControl,
  trigger: updateButton,
  popup: updateTooltip,
  descriptionId: 'updateTooltip',
});

const api = window.cavalryI18n;
const state = {
  appPath: '',
  currentLang: 'en',
  installationMode: 'unknown',
  languages: [],
  needsExtract: false,
  appManagementGranted: null,
  platform: '',
  permissionAction: 'none',
  pendingAction: '',
  ready: false,
  busy: false,
  controlsBlocked: false,
  startupRecoveryError: null,
  stateDurabilityPending: false,
  englishRestoreNeeded: false,
  updateInfo: null,
};
let modalPrimaryAction = null;
let modalSecondaryAction = null;
let modalReturnFocus = null;
const uiLocale = detectUiLocale();
const windowControls = window.createWindowControls({ api, text: t });
const aboutControl = window.createAboutControl({
  api,
  text: t,
  onError: () => setStatus('aboutOpenFailed', 'error'),
});

function updatePreviewRequested() {
  const location = window.location;
  if (!location || !['http:', 'https:'].includes(location.protocol)) return false;
  if (!['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)) return false;
  if (window.__CAVALRY_I18N_PREVIEW__ === 'update') return true;
  return /(?:^|[?&])preview=update(?:&|$)/.test(location.search || '');
}

const updatePreviewEnabled = updatePreviewRequested();
function detectUiLocale() {
  const languages = navigator.languages && navigator.languages.length
    ? navigator.languages
    : [navigator.language];
  for (const language of languages) {
    const normalized = normalizeLocale(language);
    if (normalized) return normalized;
  }
  return 'en';
}

function normalizeLocale(language) {
  const value = String(language || '').replace('_', '-').toLowerCase();
  if (!value) return '';
  if (value === 'zh-hans' || value === 'zh-cn' || value === 'zh-sg') return 'zh-Hans';
  if (value === 'zh-hant' || value === 'zh-tw' || value === 'zh-hk' || value === 'zh-mo') {
    return 'zh-Hant';
  }
  if (value.startsWith('ja')) return 'ja_JP';
  if (value.startsWith('en')) return 'en';
  return '';
}
function t(key, params = {}) {
  const text = (UI_TEXT[uiLocale] && UI_TEXT[uiLocale][key]) || UI_TEXT.en[key] || key;
  return text.replace(/\{(\w+)\}/g, (_, name) => String(params[name] ?? ''));
}

async function recoverOperationFailure() {
  operationLog.finishRunning('error');
  try {
    await bootstrap({ renderActivity: false });
  } catch (_) {
    // The service is unavailable; the local, translated error below is the
    // only safe presentation for a transport failure.
  }
  upsertStatus('operationFailed', 'error', {}, null, 'transportFailure');
}

function setPermissionWait(isWaiting) {
  permissionButton.hidden = !isWaiting || state.permissionAction === 'none';
  permissionButton.textContent =
    state.permissionAction === 'requestElevation'
      ? t('requestElevation')
      : t('openPrivacySecurity');
  applyButton.textContent = t('apply');
  restoreButton.textContent = t('restore');
}

function setStatus(key, tone = 'neutral', params = {}, messageOverride = null) {
  const message = messageOverride ?? t(key, params);
  operationLog.replace({
    id: 'status',
    title: t(STATUS_TITLE_KEYS[key] || 'statusLabel', params),
    description: message,
    state: operationStateForTone(tone),
    icon: key === 'updatePreviewAvailable' ? 'update' : undefined,
  });
}

function upsertStatus(key, tone = 'neutral', params = {}, messageOverride = null, id = key) {
  const message = messageOverride ?? t(key, params);
  operationLog.upsert({
    id,
    title: t(STATUS_TITLE_KEYS[key] || 'statusLabel', params),
    description: message,
    state: operationStateForTone(tone),
  });
}

function operationStateForTone(tone) {
  if (tone === 'success') return 'completed';
  if (tone === 'warning' || tone === 'error') return tone;
  return 'neutral';
}

function requiresCavalryReinstall() {
  return (
    state.platform === 'macos' &&
    state.installationMode === 'modifiedOrUnverified' &&
    state.needsExtract
  );
}

function restoreIsNeeded() {
  if (!state.appPath) return false;
  if (state.platform === 'macos') {
    return state.installationMode !== 'official';
  }
  return state.currentLang !== 'en' || state.englishRestoreNeeded;
}

function isRestoreAction(action) {
  return action === 'restore-official' || (state.platform === 'windows' && action === 'en');
}

function restoreIsBlockedByMissingBaseline() {
  return state.needsExtract && !(state.platform === 'windows' && state.englishRestoreNeeded);
}

const WARNING_TEXT_KEYS = Object.freeze({
  restartFailed: 'restartWarning',
  stateDurabilityPending: 'warningStateDurabilityPending',
  recoveryCleanupPending: 'warningRecoveryCleanupPending',
  protectedRecoveryEvidenceRetained: 'warningProtectedRecoveryEvidenceRetained',
  temporaryCleanupPending: 'warningTemporaryCleanupPending',
  finderFallbackUsed: 'warningFinderFallbackUsed',
  nonFatalCleanup: 'warningNonFatalCleanup',
});
const PHASE_ICONS = Object.freeze({
  verifyInstallation: 'verify',
  ensureBaseline: 'archive',
  applyTransaction: 'translate',
  restartCavalry: 'restart',
});
const UPDATE_ERROR_TEXT_KEYS = Object.freeze({
  updaterNotConfigured: 'updaterNotConfigured',
  updaterUnsupportedPlatform: 'updaterUnsupportedPlatform',
  updateCheckFailed: 'updateCheckFailed',
  updateInstallFailed: 'updateInstallFailed',
  updateNotChecked: 'updateNotChecked',
  updateBusy: 'updateBusy',
  updateStateUnavailable: 'updateStateUnavailable',
});

function requireDurabilityRetry() {
  setStatus('warningStateDurabilityPending', 'warning');
}

function operationPhaseCopy({ phase, state: phaseState }, context) {
  const { language, restoring } = context;
  if (phase !== 'restartCavalry') {
    const prefix = phase === 'verifyInstallation'
      ? 'phaseVerifyInstallation'
      : phase === 'ensureBaseline'
        ? 'phaseEnsureRecovery'
        : restoring
          ? 'phaseRestore'
          : 'phaseApply';
    const copyState = phaseState === 'warning' ? 'completed' : phaseState;
    return {
      id: phase,
      title: t(`${prefix}${copyState[0].toUpperCase()}${copyState.slice(1)}Title`, { language }),
      description: phaseState === 'error' ? t('operationFailed') : '',
      state: phaseState,
      icon: phaseState === 'completed' ? (restoring && phase === 'applyTransaction' ? 'restore' : PHASE_ICONS[phase]) : undefined,
    };
  }
  return {
    id: phase,
    title: t(`phaseRestart${phaseState[0].toUpperCase()}${phaseState.slice(1)}Title`),
    description: phaseState === 'warning' || phaseState === 'error' ? t('restartRecovery') : '',
    state: phaseState,
    icon: phaseState === 'completed' ? PHASE_ICONS[phase] : undefined,
  };
}

function updateOperationPhase(event, context) {
  operationLog.upsert(operationPhaseCopy(event, context));
}

function appendPostCommitWarnings(warningCodes) {
  const codes = Array.isArray(warningCodes) ? warningCodes : [];
  for (const code of codes) {
    if (code === 'restartFailed') continue;
    const key = WARNING_TEXT_KEYS[code] || 'warningNonFatalCleanup';
    upsertStatus(key, 'warning', {}, null, `warning-${code}`);
  }
}

function setBusy(isBusy) {
  state.busy = isBusy;
  const notReady = !state.ready;
  const durabilityPending = state.stateDurabilityPending;
  browseButton.disabled = notReady || isBusy || state.controlsBlocked || durabilityPending;
  const reinstallRequired = requiresCavalryReinstall();
  applyButton.disabled =
    notReady ||
    isBusy ||
    !state.appPath ||
    reinstallRequired ||
    state.controlsBlocked ||
    durabilityPending;
  restoreButton.disabled =
    notReady ||
    isBusy ||
    !restoreIsNeeded() ||
    restoreIsBlockedByMissingBaseline() ||
    reinstallRequired ||
    state.controlsBlocked ||
    durabilityPending;
  languageSelectControl.setDisabled(
    notReady || isBusy || reinstallRequired || state.controlsBlocked || durabilityPending
  );
  updateButton.disabled = notReady || isBusy;
}

function updateLanguageOptions(languages) {
  languageSelectControl.setOptions(languages.filter((language) => language.value !== 'en'));
}

function languageLabel(code) {
  if (code === 'restore-official') return t('restore');
  const match = state.languages.find((language) => language.value === code);
  if (match) return match.label;
  return code === 'en' ? 'English' : code;
}

function localizeShell() {
  document.documentElement.lang = uiLocale === 'ja_JP' ? 'ja' : uiLocale;
  document.title = t('appTitle');
  windowTitle.textContent = t('appTitle');
  if (!state.ready && !state.appPath) {
    appVersion.textContent = t('appNotFound');
    pathDisplay.setMessage(t('chooseAppToContinue'));
  }
  skipLink.textContent = t('skipToControls');
  updateControl.hidden = !(updatePreviewEnabled || state.updateInfo?.available);
  updateTooltipControl.close();
  updateButton.setAttribute('aria-label', t('updateButtonAria'));
  updateTooltipText.textContent = t('updateTooltip');
  languageSectionLabel.setAttribute('aria-label', t('switchTo'));
  currentLabel.textContent = t('current');
  switchToLabel.textContent = t('switchTo');
  browseButton.setAttribute('aria-label', t('chooseAppAria'));
  restoreButton.textContent = t('restore');
  restoreButton.setAttribute('aria-label', t('restore'));
  permissionButton.textContent = t('openPrivacySecurity');
  statusLabel.textContent = t('taskProgressLabel');
  operationLog.setIdleMessage(t('idlePrompt'));
  aboutControl.localize();
  windowControls.localize();
  setPermissionWait(false);
}

function syncInstallationBadges() {
  const visualState = state.appPath ? state.installationMode : 'unknown';
  const language = languageLabel(state.currentLang);
  const installation = installationModeText.textContent;
  const showInstallation =
    state.platform === 'macos' &&
    Boolean(state.appPath) &&
    visualState === 'official';
  currentLanguage.setAttribute('aria-label', `${t('current')}: ${language}`);
  currentLanguage.title = language;
  installationBadge.hidden = !showInstallation;
  installationBadge.dataset.state = showInstallation ? 'official' : 'unknown';
  installationBadge.textContent = showInstallation ? t('officialBadge') : '';
  if (showInstallation) {
    installationBadge.setAttribute('aria-label', installation || installationBadge.textContent);
    installationBadge.title = installation;
  } else {
    installationBadge.removeAttribute('aria-label');
    installationBadge.removeAttribute('title');
  }
}

function showUpdatePreview() {
  if (!updatePreviewEnabled) return;
  updateTooltipControl.close();
  setStatus('updatePreviewAvailable', 'success');
}

function updateErrorKey(errorCode, fallback = 'updateCheckFailed') {
  return UPDATE_ERROR_TEXT_KEYS[errorCode] || fallback;
}

function updateConfirmationBody(update) {
  const parts = [t('updateConfirmBody', { version: update.version })];
  if (update.notes) parts.push(update.notes);
  if (state.platform === 'macos') parts.push(t('updateMacAdhocNote'));
  return parts.join('\n\n');
}

function showUpdateFailure(errorCode = 'updateInstallFailed') {
  operationLog.finishRunning('error');
  upsertStatus(
    updateErrorKey(errorCode, 'updateInstallFailed'),
    'error',
    {},
    null,
    'updateFailure'
  );
}

function showUpdateConfirmation() {
  updateTooltipControl.close();
  if (updatePreviewEnabled) {
    showUpdatePreview();
    return;
  }
  if (!state.updateInfo?.available) return;
  const update = state.updateInfo;
  showModal({
    title: t('updateConfirmTitle'),
    body: updateConfirmationBody(update),
    primary: t('installUpdate'),
    secondary: t('cancel'),
    onPrimary: () => {
      closeModal();
      void installCheckedUpdate(update);
    },
    onSecondary: closeModal,
  });
}

async function checkForUpdates() {
  if (updatePreviewEnabled || typeof api.checkUpdate !== 'function') return;
  try {
    const result = await api.checkUpdate();
    if (!result.available) {
      state.updateInfo = null;
      updateControl.hidden = true;
      return;
    }
    state.updateInfo = result;
    updateControl.hidden = false;
    updateAnnouncement.textContent = t('updateAvailableAnnouncement', {
      version: result.version,
    });
  } catch (_) {
    state.updateInfo = null;
    updateControl.hidden = true;
  }
}

async function installCheckedUpdate(update) {
  setBusy(true);
  updateProgress.start(update);
  try {
    const result = await api.installUpdate((event) => updateProgress.project(event, update));
    if (result.errorCode) {
      showUpdateFailure(result.errorCode);
      if (result.errorCode === 'updateNotChecked') {
        state.updateInfo = null;
        updateControl.hidden = true;
      }
    }
  } catch (_) {
    showUpdateFailure();
  } finally {
    setBusy(false);
  }
}

function showModal({ title, body, primary, secondary, onPrimary, onSecondary }) {
  if (modalBackdrop.open) return;
  if (typeof modalBackdrop.showModal !== 'function') {
    setStatus('operationFailed', 'error');
    return;
  }
  modalTitle.textContent = title;
  modalBody.textContent = body;
  modalPrimaryButton.textContent = primary;
  modalSecondaryButton.textContent = secondary;
  modalPrimaryAction = onPrimary;
  modalSecondaryAction = onSecondary || closeModal;
  modalReturnFocus =
    document.activeElement && typeof document.activeElement.focus === 'function'
      ? document.activeElement
      : null;
  modalBackdrop.showModal();
  modalPrimaryButton.focus();
}

function finalizeModalClose() {
  modalPrimaryAction = null;
  modalSecondaryAction = null;
  const returnFocus = modalReturnFocus;
  modalReturnFocus = null;
  if (
    returnFocus &&
    returnFocus.isConnected !== false &&
    typeof returnFocus.focus === 'function'
  ) {
    returnFocus.focus();
  }
}

function closeModal() {
  if (modalBackdrop.open) modalBackdrop.close();
}

function showApplyConfirmation(nextLanguage) {
  showModal({
    title: t('confirmTitle'),
    body: t('confirmBody'),
    primary: t('continue'),
    secondary: t('cancel'),
    onPrimary: () => {
      closeModal();
      void runApply(nextLanguage).catch(recoverOperationFailure);
    },
    onSecondary: closeModal,
  });
}

function showRestoreConfirmation() {
  const restoreAction = state.platform === 'macos' ? 'restore-official' : 'en';
  showModal({
    title: t('restoreConfirmTitle'),
    body: t('restoreConfirmBody'),
    primary: t('restore'),
    secondary: t('cancel'),
    onPrimary: () => {
      closeModal();
      void runApply(restoreAction).catch(recoverOperationFailure);
    },
    onSecondary: closeModal,
  });
}

function showPermissionWait(nextLanguage) {
  state.pendingAction = nextLanguage;
  const needsElevation = state.permissionAction === 'requestElevation';
  upsertStatus('waitingPermission', 'warning', {}, null, 'permissionRequired');
  setPermissionWait(true);
  showModal({
    title: t('permissionTitle'),
    body: t('permissionBody'),
    primary: needsElevation ? t('requestElevation') : t('openSettings'),
    secondary: t('cancel'),
    onPrimary: () => {
      closeModal();
      if (needsElevation) {
        void runApply(nextLanguage).catch(recoverOperationFailure);
      } else {
        void openPrivacySecurity().catch(recoverOperationFailure);
      }
    },
    onSecondary: closeModal,
  });
}

async function bootstrap({ renderActivity = true } = {}) {
  state.ready = false;
  setBusy(state.busy);
  localizeShell();
  if (renderActivity) {
    operationLog.replace({
      id: 'bootstrap',
      title: t('loadingTitle'),
      description: '',
      state: 'running',
    });
  }
  const presentStatus = (...args) => {
    if (renderActivity) setStatus(...args);
  };
  const bootstrapState = await api.getStatus();
  state.appPath = bootstrapState.appPath || '';
  state.currentLang = bootstrapState.currentLang || 'en';
  state.installationMode = bootstrapState.installationMode || 'unknown';
  state.startupRecoveryError = bootstrapState.startupRecoveryError || null;
  state.controlsBlocked = Boolean(state.startupRecoveryError);
  state.languages = bootstrapState.languages || [];
  state.needsExtract = Boolean(bootstrapState.needsExtract);
  state.appManagementGranted =
    typeof bootstrapState.appManagementGranted === 'boolean'
      ? bootstrapState.appManagementGranted
      : null;
  state.platform = bootstrapState.platform || '';
  const runtimeResidueDetected =
    state.platform === 'windows' && bootstrapState.reconciliationRequired === true;
  state.englishRestoreNeeded = runtimeResidueDetected;
  state.permissionAction = bootstrapState.permissionAction || 'none';
  document.documentElement.dataset.platform = state.platform;
  document.body.dataset.platform = state.platform;
  aboutControl.setPlatform(state.platform);
  windowControls.setPlatform(state.platform);

  updateLanguageOptions(state.languages);
  const firstTargetLanguage = state.languages.find((language) => language.value !== 'en');
  languageSelectControl.setValue(
    state.currentLang === 'en' ? firstTargetLanguage?.value || '' : state.currentLang
  );
  currentLanguage.textContent = languageLabel(state.currentLang);
  setPermissionWait(false);

  const showMacInstallationMode = state.platform === 'macos' && Boolean(state.appPath);
  installationModeText.hidden = !showMacInstallationMode;
  installationModeText.textContent =
    state.installationMode === 'official'
      ? t('officialMode')
      : state.installationMode === 'recoveryRequired'
        ? t('recoveryMode')
        : t('modifiedMode');
  syncInstallationBadges();
  state.ready = true;
  setBusy(state.busy);

  if (state.appPath) {
    appVersion.textContent = bootstrapState.version
      ? t('appFound', { version: bootstrapState.version })
      : t('appFoundNoVersion');
    pathDisplay.setPath(state.appPath);
  } else {
    appVersion.textContent = t('appNotFound');
    pathDisplay.setMessage(t('appPathFallback', {
      candidates: bootstrapState.defaultAppCandidates.join('\n'),
    }));
  }

  if (state.startupRecoveryError) {
    presentStatus('startupRecoveryFailed', 'error');
    return;
  }

  if (!state.appPath) {
    presentStatus('chooseAppToContinue', 'warning');
    return;
  }

  if (requiresCavalryReinstall()) {
    presentStatus('reinstallRequired', 'error');
    return;
  }

  if (state.stateDurabilityPending) {
    presentStatus('warningStateDurabilityPending', 'warning');
    return;
  }

  if (runtimeResidueDetected) {
    presentStatus('runtimeResidueWarning', 'warning');
    return;
  }

  if (state.appManagementGranted === true) {
    if (renderActivity) operationLog.idle();
    return;
  }

  if (
    state.platform === 'windows' &&
    state.appManagementGranted === false &&
    state.permissionAction === 'none'
  ) {
    presentStatus('customRootNotWritable', 'error');
    return;
  }

  presentStatus('readyPermission', 'warning');
}

async function browseForApp() {
  if (state.stateDurabilityPending) {
    requireDurabilityRetry();
    return;
  }
  const result = await api.browseApp();
  if (result.canceled) {
    return;
  }

  await bootstrap();
}

function requestApply() {
  if (!state.appPath) {
    setStatus('chooseAppFirst', 'warning');
    return;
  }
  if (!languageSelect.value) {
    setStatus('noLanguage', 'warning');
    return;
  }
  if (requiresCavalryReinstall()) {
    setStatus('reinstallRequired', 'error');
    return;
  }
  if (state.stateDurabilityPending) {
    requireDurabilityRetry();
    return;
  }
  showApplyConfirmation(languageSelect.value);
}

function requestRestore() {
  if (state.busy || state.controlsBlocked || !restoreIsNeeded()) return;
  if (!state.appPath) {
    setStatus('chooseAppFirst', 'warning');
    return;
  }
  if (requiresCavalryReinstall()) {
    setStatus('reinstallRequired', 'error');
    return;
  }
  if (state.stateDurabilityPending) {
    requireDurabilityRetry();
    return;
  }
  if (restoreIsBlockedByMissingBaseline()) {
    setStatus('reinstallRequired', 'error');
    return;
  }
  showRestoreConfirmation();
}

async function runApply(nextLanguage) {
  if (state.stateDurabilityPending) {
    requireDurabilityRetry();
    return;
  }
  state.pendingAction = nextLanguage;
  setBusy(true);
  setPermissionWait(false);
  const language = languageLabel(nextLanguage);
  const restoring = isRestoreAction(nextLanguage);
  const operationContext = { language, restoring };
  operationLog.start({
    intro: t(restoring ? 'restoreIntro' : 'applyIntro', { language }),
  });
  updateOperationPhase({ phase: 'verifyInstallation', state: 'running' }, operationContext);

  try {
    const result = await api.applyLanguage(state.appPath, nextLanguage, (event) => {
      updateOperationPhase(event, operationContext);
    });
    if (!result.ok) {
      if (result.permissionRequired) {
        operationLog.finishRunning('error');
        showPermissionWait(nextLanguage);
        return;
      }
      if (result.errorCode === 'cavalryStillRunning') {
        operationLog.upsert({
          id: 'applyTransaction',
          title: t('closeCavalryTitle'),
          description: t('cavalryStillRunning'),
          state: 'error',
        });
        state.pendingAction = '';
        return;
      }
      operationLog.finishRunning('error');
      state.pendingAction = '';
      return;
    }

    const warningCodes = result.warningCodes || [];
    await bootstrap({ renderActivity: false });

    state.stateDurabilityPending = warningCodes.includes('stateDurabilityPending');
    setBusy(state.busy);
    state.pendingAction = '';
    appendPostCommitWarnings(warningCodes);
    if (warningCodes.length === 0) operationLog.complete(t(restoring ? 'restoreOutcome' : 'applyOutcome', { language }));
  } finally {
    setBusy(false);
  }
}

async function openPrivacySecurity() {
  if (!api.openPrivacySecurity) {
    setStatus('openPrivacyFailed', 'error');
    return;
  }

  const result = await api.openPrivacySecurity();
  if (!result.ok) {
    setStatus('openPrivacyFailed', 'error');
  }
}

function handlePermissionButton() {
  if (state.permissionAction === 'requestElevation') {
    const pending = state.pendingAction || languageSelect.value;
    void runApply(pending).catch(recoverOperationFailure);
    return;
  }
  void openPrivacySecurity().catch(recoverOperationFailure);
}
updateButton.addEventListener('click', showUpdateConfirmation);
browseButton.addEventListener('click', () => void browseForApp().catch(recoverOperationFailure));
applyButton.addEventListener('click', requestApply);
restoreButton.addEventListener('click', requestRestore);
permissionButton.addEventListener('click', handlePermissionButton);
modalPrimaryButton.addEventListener('click', () =>
  void Promise.resolve(modalPrimaryAction && modalPrimaryAction()).catch(recoverOperationFailure)
);
modalSecondaryButton.addEventListener('click', () =>
  void Promise.resolve(modalSecondaryAction && modalSecondaryAction()).catch(recoverOperationFailure)
);
modalBackdrop.addEventListener('close', finalizeModalClose);
modalBackdrop.addEventListener('cancel', (event) => event.preventDefault());

bootstrap()
  .then(() => checkForUpdates())
  .catch(() => setStatus('bootstrapFailed', 'error', { detail: t('operationFailed') }));
