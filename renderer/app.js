/**
 * [INPUT]: 依赖 window.cavalryI18n 的 Promise API、window.createSelectControl 的无依赖选择状态机、renderer/ui-text.js 的稳定文案与 renderer/index.html 的固定控件 id
 * [OUTPUT]: 对外提供跨平台桌面补丁器的四语标题/主任务/Maintenance/动态语义 Alert、初始化 fail-closed 门禁、语言/安装状态双 Badge 语义、受控语言选择、English UI/官方还原、更新 tooltip/无障碍通知与签名冷更新交互；开发预览不访问网络。
 * [POS]: renderer 的唯一交互源，被 index.html 直接加载；只消费平台中立 bridge 契约，把真实可达状态映射为具体结果/风险/恢复动作，以稳定 errorCode/warningCodes 本土化且从不显示 raw backend/updater 数据；原生 dialog 的 close 事件独占清理与焦点归还。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
const appVersion = document.querySelector('#appVersion');
const appPathText = document.querySelector('#appPath');
const skipLink = document.querySelector('#skipLink');
const windowTitle = document.querySelector('#windowTitle');
const updateControl = document.querySelector('#updateControl');
const updateButton = document.querySelector('#updateButton');
const updateTooltip = document.querySelector('#updateTooltip');
const updateAnnouncement = document.querySelector('#updateAnnouncement');
const languageSectionLabel = document.querySelector('#languageSectionLabel');
const maintenanceHeading = document.querySelector('#maintenanceHeading');
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
const extractButton = document.querySelector('#extractButton');
const applyButton = document.querySelector('#applyButton');
const restoreEnglishButton = document.querySelector('#restoreEnglishButton');
const restoreButton = document.querySelector('#restoreButton');
const permissionButton = document.querySelector('#permissionButton');
const statusLabel = document.querySelector('#statusLabel');
const statusText = document.querySelector('#statusText');
const statusPanel = document.querySelector('#statusPanel');
const modalBackdrop = document.querySelector('#modalBackdrop');
const modalTitle = document.querySelector('#modalTitle');
const modalBody = document.querySelector('#modalBody');
const modalPrimaryButton = document.querySelector('#modalPrimaryButton');
const modalSecondaryButton = document.querySelector('#modalSecondaryButton');
const modalCloseButton = document.querySelector('#modalCloseButton');

const languageSelectControl = window.createSelectControl({
  root: languageSelectRoot,
  select: languageSelect,
  trigger: languageSelectTrigger,
  value: languageSelectValue,
  popup: languageSelectPopup,
  list: languageSelectList,
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
  try {
    await bootstrap();
  } catch (_) {
    // The service is unavailable; the local, translated error below is the
    // only safe presentation for a transport failure.
  }
  setStatus('operationFailed', 'error');
}

function setPermissionWait(isWaiting) {
  permissionButton.hidden = !isWaiting || state.permissionAction === 'none';
  permissionButton.textContent =
    state.permissionAction === 'requestElevation'
      ? t('requestElevation')
      : t('openPrivacySecurity');
  applyButton.textContent = isWaiting ? t('retryApply') : t('apply');
}

function setStatus(key, tone = 'neutral', params = {}, messageOverride = null) {
  const message = messageOverride ?? t(key, params);
  statusLabel.textContent = t(STATUS_TITLE_KEYS[key] || 'statusLabel', params);
  statusText.textContent = message;
  statusText.hidden = !message;
  statusText.dataset.tone = tone;
  statusPanel.dataset.tone = tone;
}

function requiresCavalryReinstall() {
  return (
    state.platform === 'macos' &&
    state.installationMode === 'modifiedOrUnverified' &&
    state.needsExtract
  );
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
const UPDATE_ERROR_TEXT_KEYS = Object.freeze({
  updaterNotConfigured: 'updaterNotConfigured',
  updaterUnsupportedPlatform: 'updaterUnsupportedPlatform',
  updateCheckFailed: 'updateCheckFailed',
  updateInstallFailed: 'updateInstallFailed',
  updateNotChecked: 'updateNotChecked',
  updateBusy: 'updateBusy',
  updateStateUnavailable: 'updateStateUnavailable',
});

function localizedWarningMessages(warningCodes) {
  const codes = Array.isArray(warningCodes) ? warningCodes : [];
  return codes.map((code) => t(WARNING_TEXT_KEYS[code] || 'warningNonFatalCleanup'));
}

function requireDurabilityRetry() {
  setStatus('warningStateDurabilityPending', 'warning');
}

function setBusy(isBusy) {
  state.busy = isBusy;
  const notReady = !state.ready;
  const durabilityPending = state.stateDurabilityPending;
  browseButton.disabled = notReady || isBusy || state.controlsBlocked || durabilityPending;
  const reinstallRequired = requiresCavalryReinstall();
  extractButton.disabled = notReady || isBusy || state.controlsBlocked || reinstallRequired;
  applyButton.disabled =
    notReady || isBusy || state.needsExtract || state.controlsBlocked || durabilityPending;
  restoreEnglishButton.disabled =
    notReady ||
    isBusy ||
    !state.appPath ||
    (state.currentLang === 'en' && !state.englishRestoreNeeded) ||
    state.needsExtract ||
    reinstallRequired ||
    state.controlsBlocked ||
    durabilityPending;
  restoreButton.disabled =
    notReady ||
    isBusy ||
    state.needsExtract ||
    reinstallRequired ||
    state.controlsBlocked ||
    durabilityPending;
  languageSelectControl.setDisabled(
    notReady || isBusy || state.controlsBlocked || durabilityPending
  );
  updateButton.disabled = notReady || isBusy;
}

function updateLanguageOptions(languages) {
  languageSelectControl.setOptions(languages.filter((language) => language.value !== 'en'));
}

function languageLabel(code) {
  if (code === 'restore-official') return t('restoreOfficial');
  if (code === 'en') return t('englishUi');
  const match = state.languages.find((language) => language.value === code);
  return match ? match.label : code;
}

function localizeShell() {
  document.documentElement.lang = uiLocale === 'ja_JP' ? 'ja' : uiLocale;
  document.title = t('appTitle');
  windowTitle.textContent = t('appTitle');
  if (!state.ready && !state.appPath) {
    appVersion.textContent = t('appNotFound');
    appPathText.textContent = t('chooseAppToContinue');
  }
  skipLink.textContent = t('skipToControls');
  updateControl.hidden = !(updatePreviewEnabled || state.updateInfo?.available);
  setUpdateTooltipOpen(false);
  updateButton.setAttribute('aria-label', t('updateButtonAria'));
  updateTooltip.textContent = t('updateTooltip');
  languageSectionLabel.setAttribute('aria-label', t('switchTo'));
  currentLabel.textContent = t('current');
  switchToLabel.textContent = t('switchTo');
  maintenanceHeading.textContent = t('maintenance');
  browseButton.setAttribute('aria-label', t('chooseAppAria'));
  extractButton.textContent = t('refreshEnglish');
  extractButton.setAttribute('aria-label', t('refreshEnglishAria'));
  restoreEnglishButton.textContent = t('restoreEnglish');
  restoreButton.textContent = t('restoreOfficialShort');
  restoreButton.setAttribute('aria-label', t('restoreOfficial'));
  permissionButton.textContent = t('openPrivacySecurity');
  statusLabel.textContent = t('loadingTitle');
  modalCloseButton.setAttribute('aria-label', t('close'));
  setPermissionWait(false);
}

function installationBadgeText(mode) {
  if (mode === 'official') return t('officialBadge');
  if (mode === 'recoveryRequired') return t('recoveryBadge');
  if (state.currentLang !== 'en') return t('translatedBadge');
  return t('modifiedBadge');
}

function installationBadgeState(mode) {
  if (mode === 'official' || mode === 'recoveryRequired') return mode;
  return state.currentLang === 'en' ? 'modified' : 'translated';
}

function syncInstallationBadges() {
  const visualState = state.appPath ? state.installationMode : 'unknown';
  const language = languageLabel(state.currentLang);
  const installation = installationModeText.textContent;
  const showInstallation = state.platform === 'macos' && Boolean(state.appPath);
  currentLanguage.setAttribute('aria-label', `${t('current')}: ${language}`);
  currentLanguage.title = language;
  installationBadge.hidden = !showInstallation;
  installationBadge.dataset.state = installationBadgeState(visualState);
  installationBadge.textContent = showInstallation ? installationBadgeText(visualState) : '';
  installationBadge.setAttribute('aria-label', installation || installationBadge.textContent);
  installationBadge.title = installation;
}

function showUpdatePreview() {
  if (!updatePreviewEnabled) return;
  setUpdateTooltipOpen(false);
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

function showUpdateConfirmation() {
  setUpdateTooltipOpen(false);
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
      void installCheckedUpdate(update).catch(() => {
        setStatus('updateInstallFailed', 'error');
      });
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
  setStatus('installingUpdate', 'neutral', { version: update.version });
  try {
    const result = await api.installUpdate();
    if (result.errorCode) {
      setStatus(updateErrorKey(result.errorCode, 'updateInstallFailed'), 'error');
      if (result.errorCode === 'updateNotChecked') {
        state.updateInfo = null;
        updateControl.hidden = true;
      }
    }
  } finally {
    setBusy(false);
  }
}

function setUpdateTooltipOpen(isOpen) {
  updateControl.dataset.tooltipState = isOpen ? 'open' : 'closed';
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
  showModal({
    title: t('restoreConfirmTitle'),
    body: t('restoreConfirmBody'),
    primary: t('restoreOfficial'),
    secondary: t('cancel'),
    onPrimary: () => {
      closeModal();
      void runApply('restore-official').catch(recoverOperationFailure);
    },
    onSecondary: closeModal,
  });
}

function showPermissionWait(nextLanguage) {
  state.pendingAction = nextLanguage;
  const needsElevation = state.permissionAction === 'requestElevation';
  setStatus('waitingPermission', 'warning');
  setPermissionWait(true);
  showModal({
    title: t('permissionTitle'),
    body: t('permissionBody'),
    primary: needsElevation ? t('requestElevation') : t('retryApply'),
    secondary: needsElevation ? t('cancel') : t('openPrivacySecurity'),
    onPrimary: () => {
      closeModal();
      void runApply(nextLanguage).catch(recoverOperationFailure);
    },
    onSecondary: needsElevation
      ? closeModal
      : () => void openPrivacySecurity().catch(recoverOperationFailure),
  });
}

async function bootstrap() {
  state.ready = false;
  setBusy(state.busy);
  localizeShell();
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

  updateLanguageOptions(state.languages);
  const firstTargetLanguage = state.languages.find((language) => language.value !== 'en');
  languageSelectControl.setValue(
    state.currentLang === 'en' ? firstTargetLanguage?.value || '' : state.currentLang
  );
  currentLanguage.textContent = languageLabel(state.currentLang);
  setPermissionWait(false);

  const showMacInstallationMode = state.platform === 'macos' && Boolean(state.appPath);
  installationModeText.hidden = !showMacInstallationMode;
  restoreButton.hidden = !showMacInstallationMode || state.installationMode === 'official';
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
    appPathText.textContent = state.appPath;
    appPathText.title = state.appPath;
  } else {
    appVersion.textContent = t('appNotFound');
    appPathText.textContent = t('appPathFallback', {
      candidates: bootstrapState.defaultAppCandidates.join('\n'),
    });
    appPathText.removeAttribute('title');
  }

  if (state.startupRecoveryError) {
    setStatus('startupRecoveryFailed', 'error');
    return;
  }

  if (!state.appPath) {
    setStatus('chooseAppToContinue', 'warning');
    return;
  }

  if (requiresCavalryReinstall()) {
    setStatus('reinstallRequired', 'error');
    return;
  }

  if (state.needsExtract) {
    setStatus('needsExtract', 'warning');
    return;
  }

  if (state.stateDurabilityPending) {
    requireDurabilityRetry();
    return;
  }

  if (runtimeResidueDetected) {
    setStatus('runtimeResidueWarning', 'warning');
    return;
  }

  if (state.appManagementGranted === true) {
    setStatus('readyToApply', 'success');
    return;
  }

  if (
    state.platform === 'windows' &&
    state.appManagementGranted === false &&
    state.permissionAction === 'none'
  ) {
    setStatus('customRootNotWritable', 'error');
    return;
  }

  setStatus('readyPermission', 'warning');
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

async function refreshEnglishSnapshot() {
  if (!state.appPath) {
    setStatus('chooseAppFirst', 'warning');
    return;
  }

  setBusy(true);
  setPermissionWait(false);
  closeModal();
  setStatus('refreshingEnglish');

  try {
    const result = await api.extractEnglish(state.appPath);
    if (!result.ok) {
      setStatus('extractFailed', 'error');
      return;
    }

    await bootstrap();
    const warningCodes = result.warningCodes || [];
    const warnings = localizedWarningMessages(warningCodes).join(' ');
    state.stateDurabilityPending = warningCodes.includes('stateDurabilityPending');
    const runtimeResidueDetected =
      state.platform === 'windows' && result.reconciliationRequired === true;
    state.englishRestoreNeeded = state.englishRestoreNeeded || runtimeResidueDetected;
    setBusy(state.busy);
    const statusKey = runtimeResidueDetected
      ? 'runtimeResidueAfterRefresh'
      : warnings
        ? 'extractSuccessWarning'
        : 'extractSuccess';
    const message = `${t(statusKey, { count: result.count, warnings })}${
      runtimeResidueDetected && warnings ? ` ${warnings}` : ''
    }`;
    setStatus(
      statusKey,
      runtimeResidueDetected || warnings ? 'warning' : 'success',
      { count: result.count, warnings },
      message
    );
  } finally {
    setBusy(false);
  }
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
  if (state.needsExtract) {
    setStatus('needsExtract', 'warning');
    return;
  }

  showApplyConfirmation(languageSelect.value);
}

function requestEnglishRestore() {
  if (
    state.busy ||
    state.controlsBlocked ||
    (state.currentLang === 'en' && !state.englishRestoreNeeded)
  ) {
    return;
  }
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
  if (state.needsExtract) {
    setStatus('needsExtract', 'warning');
    return;
  }
  showApplyConfirmation('en');
}

function requestOfficialRestore() {
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
  if (state.needsExtract) {
    setStatus('needsExtract', 'warning');
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
  setStatus('applying', 'neutral', { language });

  try {
    const result = await api.applyLanguage(state.appPath, nextLanguage);
    if (!result.ok) {
      if (result.permissionRequired) {
        showPermissionWait(nextLanguage);
        return;
      }
      if (result.errorCode === 'cavalryStillRunning') {
        setStatus('cavalryStillRunning', 'error');
        return;
      }
      setStatus('patchFailed', 'error');
      return;
    }

    await bootstrap();

    const warningCodes = result.warningCodes || [];
    const warnings = localizedWarningMessages(warningCodes).join(' ');
    state.stateDurabilityPending = warningCodes.includes('stateDurabilityPending');
    setBusy(state.busy);
    state.pendingAction = '';
    if (nextLanguage === 'restore-official') {
      setStatus(
        warnings ? 'officialRestoreWithWarnings' : 'officialRestoreSuccess',
        warnings ? 'warning' : 'success',
        { warnings }
      );
      return;
    }
    setStatus(
      warnings ? 'appliedWithWarnings' : 'applied',
      warnings ? 'warning' : 'success',
      { language, warnings, warning: '' }
    );
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
updateControl.addEventListener('mouseenter', () => setUpdateTooltipOpen(true));
updateControl.addEventListener('mouseleave', () => setUpdateTooltipOpen(false));
updateControl.addEventListener('focusin', () => setUpdateTooltipOpen(true));
updateControl.addEventListener('focusout', () => setUpdateTooltipOpen(false));
updateButton.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') setUpdateTooltipOpen(false);
});
browseButton.addEventListener('click', () => void browseForApp().catch(recoverOperationFailure));
extractButton.addEventListener('click', () => void refreshEnglishSnapshot().catch(recoverOperationFailure));
applyButton.addEventListener('click', requestApply);
restoreEnglishButton.addEventListener('click', requestEnglishRestore);
restoreButton.addEventListener('click', requestOfficialRestore);
permissionButton.addEventListener('click', handlePermissionButton);
modalPrimaryButton.addEventListener('click', () =>
  void Promise.resolve(modalPrimaryAction && modalPrimaryAction()).catch(recoverOperationFailure)
);
modalSecondaryButton.addEventListener('click', () =>
  void Promise.resolve(modalSecondaryAction && modalSecondaryAction()).catch(recoverOperationFailure)
);
modalCloseButton.addEventListener('click', closeModal);
modalBackdrop.addEventListener('close', finalizeModalClose);
modalBackdrop.addEventListener('click', (event) => {
  if (
    !event.defaultPrevented &&
    (typeof event.button !== 'number' || event.button === 0) &&
    event.target === modalBackdrop
  ) {
    closeModal();
  }
});

bootstrap()
  .then(() => checkForUpdates())
  .catch(() => {
    setStatus('bootstrapFailed', 'error', { detail: t('operationFailed') });
  });
