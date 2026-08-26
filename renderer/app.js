/**
 * [INPUT]: 依赖 window.cavalryI18n 的 Promise API、renderer/ui-text.js 的稳定文案与 renderer/index.html 的固定控件 id
 * [OUTPUT]: 对外提供跨平台桌面补丁器的系统语言本土化、安装位置/官方或受管状态、English UI 与英文/官方还原、Windows 只读快照检测、可组合 warningCodes、state durability 显式刷新重试、本机重装指引、权限弹窗、应用并重启交互，以及 Windows 不可写根/Cavalry 仍运行的稳定状态说明
 * [POS]: renderer 的唯一交互源，被 index.html 直接加载；只消费平台中立 bridge 契约，以稳定 errorCode/warningCodes 本土化可恢复状态且从不显示 raw warning；官方还原使用非语言 manifest 的显式内部 action
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
const appVersion = document.querySelector('#appVersion');
const appPathText = document.querySelector('#appPath');
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
  busy: false,
  controlsBlocked: false,
  startupRecoveryError: null,
  stateDurabilityPending: false,
};
let modalPrimaryAction = null;
let modalSecondaryAction = null;


const uiLocale = detectUiLocale();

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

function localizedWarningMessages(warningCodes) {
  const codes = Array.isArray(warningCodes) ? warningCodes : [];
  return codes.map((code) => t(WARNING_TEXT_KEYS[code] || 'warningNonFatalCleanup'));
}

function requireDurabilityRetry() {
  setStatus(t('warningStateDurabilityPending'), 'warning');
}

function setBusy(isBusy) {
  state.busy = isBusy;
  const durabilityPending = state.stateDurabilityPending;
  browseButton.disabled = isBusy || state.controlsBlocked || durabilityPending;
  const reinstallRequired = requiresCavalryReinstall();
  extractButton.disabled = isBusy || state.controlsBlocked || reinstallRequired;
  applyButton.disabled = isBusy || state.needsExtract || state.controlsBlocked || durabilityPending;
  restoreEnglishButton.disabled =
    isBusy || !state.appPath || state.needsExtract || reinstallRequired || state.controlsBlocked || durabilityPending;
  restoreButton.disabled =
    isBusy || state.needsExtract || reinstallRequired || state.controlsBlocked || durabilityPending;
  languageSelect.disabled = isBusy || state.controlsBlocked || durabilityPending;
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
  languageSectionLabel.textContent = t('language');
  currentLabel.textContent = t('current');
  switchToLabel.textContent = t('switchTo');
  browseButton.setAttribute('aria-label', t('chooseAppAria'));
  extractButton.textContent = t('refreshEnglish');
  restoreEnglishButton.textContent = t('restoreEnglish');
  restoreButton.textContent = t('restoreOfficial');
  permissionButton.textContent = t('openPrivacySecurity');
  statusLabel.textContent = t('statusLabel');
  modalCloseButton.setAttribute('aria-label', t('close'));
  setPermissionWait(false);
}

function showModal({ title, body, primary, secondary, onPrimary, onSecondary }) {
  modalTitle.textContent = title;
  modalBody.textContent = body;
  modalPrimaryButton.textContent = primary;
  modalSecondaryButton.textContent = secondary;
  modalPrimaryAction = onPrimary;
  modalSecondaryAction = onSecondary || closeModal;
  modalBackdrop.hidden = false;
}

function closeModal() {
  modalBackdrop.hidden = true;
  modalPrimaryAction = null;
  modalSecondaryAction = null;
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
  state.permissionAction = bootstrapState.permissionAction || 'none';
  document.documentElement.dataset.platform = state.platform;

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
  if (state.busy || state.controlsBlocked) {
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
modalBackdrop.addEventListener('click', (event) => {
  if (event.target === modalBackdrop) closeModal();
});

bootstrap().catch(() => {
  setStatus(t('bootstrapFailed', { detail: t('operationFailed') }), 'error');
});
