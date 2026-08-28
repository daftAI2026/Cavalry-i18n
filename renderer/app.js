/**
 * [INPUT]: 依赖 window.cavalryI18n 的 Promise API、renderer/ui-text.js 的稳定文案与 renderer/index.html 的固定控件 id
 * [OUTPUT]: 对外提供跨平台桌面补丁器的四语界面、初始化 fail-closed 控件门禁、English UI/官方还原、可组合 warningCodes、单一更新图标/tooltip/无障碍通知、签名更新确认与冷安装重启交互；开发预览不访问网络，真实安装只调用 bridge 保存的已检查 Update。
 * [POS]: renderer 的唯一交互源，被 index.html 直接加载；只消费平台中立 bridge 契约，以稳定 errorCode/warningCodes 本土化可恢复状态且从不显示 raw backend/updater 数据；原生 dialog 的 close 事件独占清理与焦点归还。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
const appVersion = document.querySelector('#appVersion');
const appPathText = document.querySelector('#appPath');
const skipLink = document.querySelector('#skipLink');
const updateControl = document.querySelector('#updateControl');
const updateButton = document.querySelector('#updateButton');
const updateTooltip = document.querySelector('#updateTooltip');
const updateAnnouncement = document.querySelector('#updateAnnouncement');
const languageSectionLabel = document.querySelector('#languageSectionLabel');
const currentLabel = document.querySelector('#currentLabel');
const currentLanguage = document.querySelector('#currentLanguage');
const installationModeText = document.querySelector('#installationMode');
const switchToLabel = document.querySelector('#switchToLabel');
const languageSelect = document.querySelector('#languageSelect');
const browseButton = document.querySelector('#browseButton');
const extractButton = document.querySelector('#extractButton');
const applyButton = document.querySelector('#applyButton');
const restoreEnglishButton = document.querySelector('#restoreEnglishButton');
const restoreButton = document.querySelector('#restoreButton');
const permissionButton = document.querySelector('#permissionButton');
const statusLabel = document.querySelector('#statusLabel');
const statusText = document.querySelector('#statusText');
const modalBackdrop = document.querySelector('#modalBackdrop');
const modalTitle = document.querySelector('#modalTitle');
const modalBody = document.querySelector('#modalBody');
const modalPrimaryButton = document.querySelector('#modalPrimaryButton');
const modalSecondaryButton = document.querySelector('#modalSecondaryButton');
const modalCloseButton = document.querySelector('#modalCloseButton');

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

function withDetail(key, detail) {
  return detail ? `${t(key)}${t('detail', { detail })}` : t(key);
}

async function recoverOperationFailure() {
  try {
    await bootstrap();
  } catch (_) {
    // The service is unavailable; the local, translated error below is the
    // only safe presentation for a transport failure.
  }
  setStatus(t('operationFailed'), 'error');
}

function setPermissionWait(isWaiting) {
  permissionButton.hidden = !isWaiting || state.permissionAction === 'none';
  permissionButton.textContent =
    state.permissionAction === 'requestElevation'
      ? t('requestElevation')
      : t('openPrivacySecurity');
  applyButton.textContent = isWaiting ? t('retryApply') : t('apply');
}

function setStatus(message, tone = 'neutral') {
  statusText.textContent = message;
  statusText.dataset.tone = tone;
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
  setStatus(t('warningStateDurabilityPending'), 'warning');
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
  languageSelect.disabled = notReady || isBusy || state.controlsBlocked || durabilityPending;
  updateButton.disabled = notReady || isBusy;
}

function updateLanguageOptions(languages) {
  languageSelect.replaceChildren();
  for (const language of languages) {
    if (language.value === 'en') continue;
    const option = document.createElement('option');
    option.value = language.value;
    option.textContent = language.label;
    languageSelect.append(option);
  }
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
  skipLink.textContent = t('skipToControls');
  updateControl.hidden = !(updatePreviewEnabled || state.updateInfo?.available);
  setUpdateTooltipOpen(false);
  updateButton.setAttribute('aria-label', t('updateButtonAria'));
  updateTooltip.textContent = t('updateTooltip');
  languageSectionLabel.textContent = t('language');
  currentLabel.textContent = t('current');
  switchToLabel.textContent = t('switchTo');
  browseButton.setAttribute('aria-label', t('chooseAppAria'));
  extractButton.textContent = t('refreshEnglish');
  extractButton.setAttribute('aria-label', t('refreshEnglishAria'));
  restoreEnglishButton.textContent = t('restoreEnglish');
  restoreButton.textContent = t('restoreOfficial');
  permissionButton.textContent = t('openPrivacySecurity');
  statusLabel.textContent = t('statusLabel');
  modalCloseButton.setAttribute('aria-label', t('close'));
  setPermissionWait(false);
}

function showUpdatePreview() {
  if (!updatePreviewEnabled) return;
  setUpdateTooltipOpen(false);
  setStatus(t('updatePreviewAvailable'), 'success');
}

function updateErrorText(errorCode, fallback = 'updateCheckFailed') {
  return t(UPDATE_ERROR_TEXT_KEYS[errorCode] || fallback);
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
        setStatus(t('updateInstallFailed'), 'error');
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
  setStatus(t('installingUpdate', { version: update.version }));
  try {
    const result = await api.installUpdate();
    if (result.errorCode) {
      setStatus(updateErrorText(result.errorCode, 'updateInstallFailed'), 'error');
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
    setStatus(t('operationFailed'), 'error');
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
  setStatus(t('waitingPermission'), 'warning');
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
  languageSelect.value =
    state.currentLang === 'en' ? firstTargetLanguage?.value || '' : state.currentLang;
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
  state.ready = true;
  setBusy(state.busy);

  if (state.appPath) {
    appVersion.textContent = bootstrapState.version
      ? t('appFound', { version: bootstrapState.version })
      : t('appFoundNoVersion');
    appPathText.textContent = state.appPath;
  } else {
    appVersion.textContent = t('appNotFound');
    appPathText.textContent = t('appPathFallback', {
      candidates: bootstrapState.defaultAppCandidates.join('\n'),
    });
  }

  if (state.startupRecoveryError) {
    setStatus(withDetail('startupRecoveryFailed', state.startupRecoveryError), 'error');
    return;
  }

  if (!state.appPath) {
    setStatus(t('chooseAppToContinue'), 'warning');
    return;
  }

  if (requiresCavalryReinstall()) {
    setStatus(t('reinstallRequired'), 'error');
    return;
  }

  if (state.needsExtract) {
    setStatus(t('needsExtract'), 'warning');
    return;
  }

  if (state.stateDurabilityPending) {
    requireDurabilityRetry();
    return;
  }

  if (runtimeResidueDetected) {
    setStatus(t('runtimeResidueWarning'), 'warning');
    return;
  }

  if (state.appManagementGranted === true) {
    setStatus(t('readyToApply'), 'success');
    return;
  }

  if (
    state.platform === 'windows' &&
    state.appManagementGranted === false &&
    state.permissionAction === 'none'
  ) {
    setStatus(t('customRootNotWritable'), 'error');
    return;
  }

  setStatus(t('readyPermission'), 'warning');
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
    setStatus(t('chooseAppFirst'), 'warning');
    return;
  }

  setBusy(true);
  setPermissionWait(false);
  closeModal();
  setStatus(t('refreshingEnglish'));

  try {
    const result = await api.extractEnglish(state.appPath);
    if (!result.ok) {
      setStatus(withDetail('extractFailed', result.error), 'error');
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
    const refreshed = runtimeResidueDetected
      ? t('runtimeResidueAfterRefresh', { count: result.count })
      : t('extractSuccess', { count: result.count });
    setStatus(
      runtimeResidueDetected
        ? `${refreshed}${warnings ? ` ${warnings}` : ''}`
        : warnings
        ? t('extractSuccessWarning', { count: result.count, warnings })
        : refreshed,
      runtimeResidueDetected || warnings ? 'warning' : 'success'
    );
  } finally {
    setBusy(false);
  }
}

function requestApply() {
  if (!state.appPath) {
    setStatus(t('chooseAppFirst'), 'warning');
    return;
  }
  if (!languageSelect.value) {
    setStatus(t('noLanguage'), 'warning');
    return;
  }
  if (requiresCavalryReinstall()) {
    setStatus(t('reinstallRequired'), 'error');
    return;
  }
  if (state.stateDurabilityPending) {
    requireDurabilityRetry();
    return;
  }
  if (state.needsExtract) {
    setStatus(t('needsExtract'), 'warning');
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
    setStatus(t('chooseAppFirst'), 'warning');
    return;
  }
  if (requiresCavalryReinstall()) {
    setStatus(t('reinstallRequired'), 'error');
    return;
  }
  if (state.stateDurabilityPending) {
    requireDurabilityRetry();
    return;
  }
  if (state.needsExtract) {
    setStatus(t('needsExtract'), 'warning');
    return;
  }
  showApplyConfirmation('en');
}

function requestOfficialRestore() {
  if (!state.appPath) {
    setStatus(t('chooseAppFirst'), 'warning');
    return;
  }
  if (requiresCavalryReinstall()) {
    setStatus(t('reinstallRequired'), 'error');
    return;
  }
  if (state.stateDurabilityPending) {
    requireDurabilityRetry();
    return;
  }
  if (state.needsExtract) {
    setStatus(t('needsExtract'), 'warning');
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
  setStatus(t('applying', { language: languageLabel(nextLanguage) }));

  try {
    const result = await api.applyLanguage(state.appPath, nextLanguage);
    if (!result.ok) {
      if (result.permissionRequired) {
        showPermissionWait(nextLanguage);
        return;
      }
      if (result.errorCode === 'cavalryStillRunning') {
        setStatus(t('cavalryStillRunning'), 'error');
        return;
      }
      setStatus(withDetail('patchFailed', result.error), 'error');
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
        warnings ? t('officialRestoreWithWarnings', { warnings }) : t('officialRestoreSuccess'),
        warnings ? 'warning' : 'success'
      );
      return;
    }
    setStatus(
      warnings
        ? t('appliedWithWarnings', { language: languageLabel(nextLanguage), warnings })
        : t('applied', { language: languageLabel(nextLanguage), warning: '' }),
      warnings ? 'warning' : 'success'
    );
  } finally {
    setBusy(false);
  }
}

async function openPrivacySecurity() {
  if (!api.openPrivacySecurity) {
    setStatus(t('openPrivacyFailed'), 'error');
    return;
  }

  const result = await api.openPrivacySecurity();
  if (!result.ok) {
    setStatus(withDetail('openPrivacyFailed', result.error), 'error');
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
    setStatus(t('bootstrapFailed', { detail: t('operationFailed') }), 'error');
  });
