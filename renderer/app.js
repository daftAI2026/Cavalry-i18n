/**
 * [INPUT]: 依赖 window.cavalryI18n 的 Promise API 与 renderer/index.html 的固定控件 id
 * [OUTPUT]: 对外提供跨平台桌面补丁器的系统语言本土化、安装位置状态、语言选择、英文刷新、权限弹窗、应用并重启交互，以及 Windows 自定义不可写根的无 UAC 状态说明
 * [POS]: renderer 的唯一交互源，被 index.html 直接加载；只消费平台中立 bridge 契约，不假定 .app 或 .exe 布局，且只在 requestElevation 时公开 Windows 管理员重试
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
const appVersion = document.querySelector('#appVersion');
const appPathText = document.querySelector('#appPath');
const languageSectionLabel = document.querySelector('#languageSectionLabel');
const currentLabel = document.querySelector('#currentLabel');
const currentLanguage = document.querySelector('#currentLanguage');
const switchToLabel = document.querySelector('#switchToLabel');
const languageSelect = document.querySelector('#languageSelect');
const browseButton = document.querySelector('#browseButton');
const extractButton = document.querySelector('#extractButton');
const applyButton = document.querySelector('#applyButton');
const permissionButton = document.querySelector('#permissionButton');
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
  languages: [],
  needsExtract: false,
  appManagementGranted: null,
  platform: '',
  permissionAction: 'none',
};
let modalPrimaryAction = null;
let modalSecondaryAction = null;

const UI_TEXT = {
  en: {
    appTitle: 'Cavalry Language Switcher',
    appFound: 'Cavalry {version}',
    appFoundNoVersion: 'Cavalry found',
    appNotFound: 'Cavalry not found',
    appPathFallback: 'Tried:\n{candidates}',
    chooseAppAria: 'Choose Cavalry installation',
    language: 'Language',
    current: 'Current',
    switchTo: 'Switch to',
    apply: 'Apply & Restart',
    retryApply: 'Retry Apply',
    refreshEnglish: 'Refresh English',
    openPrivacySecurity: 'Open permission settings',
    requestElevation: 'Retry as administrator',
    close: 'Close',
    readyPermission: 'System permission may be required to modify the Cavalry installation.',
    customRootNotWritable:
      'The selected Cavalry folder is not writable. Windows administrator retry is only available for installations under Program Files; choose a writable copy or update this folder’s permissions.',
    readyToApply: 'Ready to apply a language pack.',
    chooseAppToContinue: 'Choose a Cavalry installation to continue.',
    needsExtract: 'English source files need to be refreshed before the next patch.',
    chooseAppFirst: 'Choose a Cavalry installation first.',
    noLanguage: 'No language pack is available.',
    refreshingEnglish: 'Refreshing the English snapshot...',
    extractFailed: 'Could not refresh the English snapshot.',
    extractSuccess: 'English snapshot refreshed ({count} files).',
    applying: 'Applying {language}...',
    waitingPermission: 'Waiting for system permission.',
    patchFailed: 'Patch failed.',
    restartWarning: 'Language applied, but Cavalry could not be restarted.',
    applied: 'Applied {language} and restarted Cavalry.{warning}',
    openPrivacyFailed: 'Could not open permission settings.',
    bootstrapFailed: 'Bootstrap failed: {detail}',
    detail: ' Details: {detail}',
    confirmTitle: 'Install language pack?',
    confirmBody:
      'The selected language pack will modify the chosen Cavalry installation. Cavalry will restart after the files are applied.',
    continue: 'Continue',
    cancel: 'Cancel',
    permissionTitle: 'System permission required',
    permissionBody:
      'Approve the operating system permission request for Cavalry Language Switcher, then retry.',
  },
  'zh-Hans': {
    appTitle: 'Cavalry 语言切换器',
    appFound: 'Cavalry {version}',
    appFoundNoVersion: '已找到 Cavalry',
    appNotFound: '未找到 Cavalry',
    appPathFallback: '已尝试：\n{candidates}',
    chooseAppAria: '选择 Cavalry 安装位置',
    language: '语言',
    current: '当前',
    switchTo: '切换为',
    apply: '应用并重启',
    retryApply: '重试应用',
    refreshEnglish: '刷新英文',
    openPrivacySecurity: '打开权限设置',
    requestElevation: '以管理员身份重试',
    close: '关闭',
    readyPermission: '修改 Cavalry 安装目录可能需要系统授权。',
    customRootNotWritable:
      '所选 Cavalry 文件夹不可写。Windows 仅能为“Program Files”下的安装请求管理员重试；请选择可写副本或调整此文件夹的权限。',
    readyToApply: '可以开始应用语言包。',
    chooseAppToContinue: '请选择 Cavalry 安装位置后继续。',
    needsExtract: '下次补丁前需要先刷新英文源文件。',
    chooseAppFirst: '请先选择 Cavalry 安装位置。',
    noLanguage: '没有可用的语言包。',
    refreshingEnglish: '正在刷新英文快照...',
    extractFailed: '无法刷新英文快照。',
    extractSuccess: '英文快照已刷新（{count} 个文件）。',
    applying: '正在应用{language}...',
    waitingPermission: '正在等待系统授权。',
    patchFailed: '应用语言包失败。',
    restartWarning: '语言已应用，但无法重启 Cavalry。',
    applied: '已应用{language}并重启 Cavalry。{warning}',
    openPrivacyFailed: '无法打开权限设置。',
    bootstrapFailed: '启动失败：{detail}',
    detail: '详情：{detail}',
    confirmTitle: '安装语言包？',
    confirmBody:
      '所选语言包会修改当前 Cavalry 安装目录；文件应用完成后将重启 Cavalry。',
    continue: '继续',
    cancel: '取消',
    permissionTitle: '需要系统授权',
    permissionBody: '请批准操作系统为 Cavalry 语言切换器显示的权限请求，然后重试。',
  },
  'zh-Hant': {
    appTitle: 'Cavalry 語言切換器',
    appFound: 'Cavalry {version}',
    appFoundNoVersion: '已找到 Cavalry',
    appNotFound: '未找到 Cavalry',
    appPathFallback: '已嘗試：\n{candidates}',
    chooseAppAria: '選擇 Cavalry 安裝位置',
    language: '語言',
    current: '目前',
    switchTo: '切換為',
    apply: '套用並重新啟動',
    retryApply: '重試套用',
    refreshEnglish: '重新整理英文',
    openPrivacySecurity: '打開權限設定',
    requestElevation: '以系統管理員身分重試',
    close: '關閉',
    readyPermission: '修改 Cavalry 安裝目錄可能需要系統授權。',
    customRootNotWritable:
      '所選 Cavalry 資料夾不可寫入。Windows 僅能為「Program Files」下的安裝要求以系統管理員身分重試；請選擇可寫入的副本或調整此資料夾的權限。',
    readyToApply: '可以開始套用語言包。',
    chooseAppToContinue: '請先選擇 Cavalry 安裝位置再繼續。',
    needsExtract: '下次補丁前需要先重新整理英文來源檔案。',
    chooseAppFirst: '請先選擇 Cavalry 安裝位置。',
    noLanguage: '沒有可用的語言包。',
    refreshingEnglish: '正在重新整理英文快照...',
    extractFailed: '無法重新整理英文快照。',
    extractSuccess: '英文快照已重新整理（{count} 個檔案）。',
    applying: '正在套用{language}...',
    waitingPermission: '正在等待系統授權。',
    patchFailed: '套用語言包失敗。',
    restartWarning: '語言已套用，但無法重新啟動 Cavalry。',
    applied: '已套用{language}並重新啟動 Cavalry。{warning}',
    openPrivacyFailed: '無法打開權限設定。',
    bootstrapFailed: '啟動失敗：{detail}',
    detail: '詳情：{detail}',
    confirmTitle: '安裝語言包？',
    confirmBody:
      '所選語言包會修改目前 Cavalry 安裝目錄；檔案套用完成後將重新啟動 Cavalry。',
    continue: '繼續',
    cancel: '取消',
    permissionTitle: '需要系統授權',
    permissionBody: '請允許作業系統為 Cavalry 語言切換器顯示的權限請求，然後重試。',
  },
  ja_JP: {
    appTitle: 'Cavalry 言語スイッチャー',
    appFound: 'Cavalry {version}',
    appFoundNoVersion: 'Cavalry が見つかりました',
    appNotFound: 'Cavalry が見つかりません',
    appPathFallback: '確認した場所:\n{candidates}',
    chooseAppAria: 'Cavalry のインストール先を選択',
    language: '言語',
    current: '現在',
    switchTo: '切り替え先',
    apply: '適用して再起動',
    retryApply: '適用を再試行',
    refreshEnglish: '英語を更新',
    openPrivacySecurity: '権限設定を開く',
    requestElevation: '管理者として再試行',
    close: '閉じる',
    readyPermission: 'Cavalry のインストール先を変更するにはシステム権限が必要な場合があります。',
    customRootNotWritable:
      '選択した Cavalry フォルダーには書き込めません。Windows で管理者として再試行できるのは Program Files 配下のインストールのみです。書き込み可能なコピーを選ぶか、このフォルダーのアクセス許可を変更してください。',
    readyToApply: '言語パックを適用できます。',
    chooseAppToContinue: '続行するには Cavalry のインストール先を選択してください。',
    needsExtract: '次のパッチの前に英語ソースファイルを更新する必要があります。',
    chooseAppFirst: '先に Cavalry のインストール先を選択してください。',
    noLanguage: '利用できる言語パックがありません。',
    refreshingEnglish: '英語スナップショットを更新しています...',
    extractFailed: '英語スナップショットを更新できませんでした。',
    extractSuccess: '英語スナップショットを更新しました（{count} ファイル）。',
    applying: '{language}を適用しています...',
    waitingPermission: 'システム権限を待っています。',
    patchFailed: '言語パックの適用に失敗しました。',
    restartWarning: '言語は適用されましたが、Cavalry を再起動できませんでした。',
    applied: '{language}を適用して Cavalry を再起動しました。{warning}',
    openPrivacyFailed: '権限設定を開けませんでした。',
    bootstrapFailed: '起動に失敗しました: {detail}',
    detail: ' 詳細: {detail}',
    confirmTitle: '言語パックをインストールしますか？',
    confirmBody:
      '選択した言語パックは Cavalry のインストール先を変更します。ファイルの適用後に Cavalry を再起動します。',
    continue: '続行',
    cancel: 'キャンセル',
    permissionTitle: 'システム権限が必要です',
    permissionBody:
      'Cavalry 言語スイッチャーに対するオペレーティングシステムの権限要求を許可してから再試行してください。',
  },
};

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

function setBusy(isBusy) {
  browseButton.disabled = isBusy;
  extractButton.disabled = isBusy;
  applyButton.disabled = isBusy;
  languageSelect.disabled = isBusy;
}

function updateLanguageOptions(languages) {
  languageSelect.innerHTML = languages
    .map((language) => `<option value="${language.value}">${language.label}</option>`)
    .join('');
}

function languageLabel(code) {
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
  permissionButton.textContent = t('openPrivacySecurity');
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
      runApply(nextLanguage);
    },
    onSecondary: closeModal,
  });
}

function showPermissionWait(nextLanguage) {
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
      runApply(nextLanguage);
    },
    onSecondary: needsElevation ? closeModal : openPrivacySecurity,
  });
}

async function bootstrap() {
  localizeShell();
  const bootstrapState = await api.getStatus();
  state.appPath = bootstrapState.appPath || '';
  state.currentLang = bootstrapState.currentLang || 'en';
  state.languages = bootstrapState.languages || [];
  state.needsExtract = Boolean(bootstrapState.needsExtract);
  state.appManagementGranted =
    typeof bootstrapState.appManagementGranted === 'boolean'
      ? bootstrapState.appManagementGranted
      : null;
  state.platform = bootstrapState.platform || '';
  state.permissionAction = bootstrapState.permissionAction || 'none';
  document.documentElement.dataset.platform = state.platform;

  updateLanguageOptions(state.languages);
  languageSelect.value = state.currentLang;
  currentLanguage.textContent = languageLabel(state.currentLang);
  setPermissionWait(false);

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

  if (!state.appPath) {
    setStatus(t('chooseAppToContinue'), 'warning');
    return;
  }

  if (state.needsExtract) {
    setStatus(t('needsExtract'), 'warning');
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

browseButton.addEventListener('click', async () => {
  const result = await api.browseApp();
  if (result.canceled) {
    return;
  }

  await bootstrap();
});

extractButton.addEventListener('click', async () => {
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
    setStatus(t('extractSuccess', { count: result.count }), 'success');
  } finally {
    setBusy(false);
  }
});

applyButton.addEventListener('click', async () => {
  if (!state.appPath) {
    setStatus(t('chooseAppFirst'), 'warning');
    return;
  }
  if (!languageSelect.value) {
    setStatus(t('noLanguage'), 'warning');
    return;
  }

  showApplyConfirmation(languageSelect.value);
});

async function runApply(nextLanguage) {
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
      setStatus(withDetail('patchFailed', result.error), 'error');
      return;
    }

    const restart = await api.restartCavalry(state.appPath);
    await bootstrap();

    if (!restart.ok) {
      setStatus(withDetail('restartWarning', restart.error), 'warning');
      return;
    }

    const warningSuffix = result.warning ? ` ${result.warning}` : '';
    setStatus(
      t('applied', { language: languageLabel(nextLanguage), warning: warningSuffix }),
      result.warning ? 'warning' : 'success'
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

permissionButton.addEventListener('click', () => {
  if (state.permissionAction === 'requestElevation') {
    runApply(languageSelect.value);
    return;
  }
  openPrivacySecurity();
});
modalPrimaryButton.addEventListener('click', () => modalPrimaryAction && modalPrimaryAction());
modalSecondaryButton.addEventListener('click', () => modalSecondaryAction && modalSecondaryAction());
modalCloseButton.addEventListener('click', closeModal);
modalBackdrop.addEventListener('click', (event) => {
  if (event.target === modalBackdrop) closeModal();
});

bootstrap().catch((error) => {
  setStatus(t('bootstrapFailed', { detail: error.stack || error.message }), 'error');
});

/* ── Custom Select: sync with native <select> ── */
(function initCustomSelect() {
  const trigger = document.querySelector('#selectTrigger');
  const popup = document.querySelector('#selectPopup');
  const triggerText = trigger.querySelector('.select-trigger-text');
  let focusedIndex = -1;

  function syncPopup() {
    const options = Array.from(languageSelect.options);
    popup.innerHTML = options
      .map(
        (opt, i) =>
          `<li class="select-option" role="option" data-value="${opt.value}" aria-selected="${opt.value === languageSelect.value}" data-index="${i}">${opt.textContent}</li>`
      )
      .join('');
    triggerText.textContent =
      options.find((o) => o.value === languageSelect.value)?.textContent || '';
    focusedIndex = -1;
  }

  function open() {
    if (trigger.disabled) return;
    syncPopup();
    popup.setAttribute('data-open', '');
    trigger.setAttribute('aria-expanded', 'true');
    focusedIndex = Array.from(languageSelect.options).findIndex(
      (o) => o.value === languageSelect.value
    );
    updateFocus();
  }

  function close() {
    popup.removeAttribute('data-open');
    trigger.setAttribute('aria-expanded', 'false');
    focusedIndex = -1;
  }

  function isOpen() {
    return popup.hasAttribute('data-open');
  }

  function pick(value) {
    languageSelect.value = value;
    languageSelect.dispatchEvent(new Event('change', { bubbles: true }));
    close();
  }

  function updateFocus() {
    popup.querySelectorAll('.select-option').forEach((el, i) => {
      if (i === focusedIndex) el.setAttribute('data-focused', '');
      else el.removeAttribute('data-focused');
    });
    const focused = popup.querySelector('[data-focused]');
    if (focused) focused.scrollIntoView({ block: 'nearest' });
  }

  trigger.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    isOpen() ? close() : open();
  });

  popup.addEventListener('click', (e) => {
    const option = e.target.closest('.select-option');
    if (option) pick(option.dataset.value);
  });

  document.addEventListener('click', (e) => {
    if (isOpen() && !trigger.contains(e.target) && !popup.contains(e.target)) close();
  });

  trigger.addEventListener('keydown', (e) => {
    const items = popup.querySelectorAll('.select-option');
    if (!isOpen()) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        open();
      }
      return;
    }
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); focusedIndex = Math.min(focusedIndex + 1, items.length - 1); updateFocus(); return; }
    if (e.key === 'ArrowUp') { e.preventDefault(); focusedIndex = Math.max(focusedIndex - 1, 0); updateFocus(); return; }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (focusedIndex >= 0 && items[focusedIndex]) pick(items[focusedIndex].dataset.value);
    }
  });

  new MutationObserver(syncPopup).observe(languageSelect, { childList: true, attributes: true });
  languageSelect.addEventListener('change', syncPopup);

  const origDisabledDesc = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'disabled');
  Object.defineProperty(languageSelect, 'disabled', {
    get() { return origDisabledDesc.get.call(this); },
    set(v) {
      origDisabledDesc.set.call(this, v);
      trigger.disabled = v;
    },
  });

  syncPopup();
})();
