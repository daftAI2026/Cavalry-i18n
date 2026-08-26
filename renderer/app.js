/**
 * [INPUT]: 依赖 window.cavalryI18n 的 Promise API 与 renderer/index.html 的固定控件 id
 * [OUTPUT]: 对外提供跨平台桌面补丁器的系统语言本土化、安装位置/官方或受管状态、English UI 与独立官方还原、Windows 只读快照后的显式 runtime reconciliation、可组合 warningCodes、state durability 显式刷新重试、本机重装指引、权限弹窗、应用并重启交互，以及 Windows 不可写根/Cavalry 仍运行的稳定状态说明
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
const reconcileButton = document.querySelector('#reconcileButton');
const restoreButton = document.querySelector('#restoreButton');
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
  reconciliationRequired: false,
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
    englishUi: 'English UI',
    apply: 'Apply & Restart',
    restoreOfficial: 'Restore official Cavalry',
    officialMode: 'Installation: verified official runtime',
    modifiedMode: 'Installation: Switcher-managed or unverified runtime',
    recoveryMode: 'Installation: recovery required before further changes',
    retryApply: 'Retry Apply',
    refreshEnglish: 'Refresh English Snapshot',
    reconcileEnglish: 'Reconcile English runtime',
    openPrivacySecurity: 'Open permission settings',
    requestElevation: 'Retry as administrator',
    close: 'Close',
    readyPermission: 'System permission may be required to modify the Cavalry installation.',
    customRootNotWritable:
      'The selected Cavalry folder is not writable. Windows administrator retry is only available for installations under Program Files; choose a writable copy or update this folder’s permissions.',
    readyToApply: 'Ready to apply a language pack.',
    chooseAppToContinue: 'Choose a Cavalry installation to continue.',
    needsExtract: 'English source files need to be refreshed before the next patch.',
    reinstallRequired: 'This Cavalry installation cannot be safely restored because its original English provenance is incomplete. Reinstall Cavalry from the official installer, then choose the new installation.',
    warningStateDurabilityPending:
      'State storage durability could not be confirmed. Refresh the English snapshot again before applying or restoring.',
    warningRecoveryCleanupPending:
      'Recovery cleanup is still pending. Keep the recovery files until the Switcher completes cleanup.',
    warningProtectedRecoveryEvidenceRetained:
      'Protected transaction recovery evidence remains. Do not delete it manually.',
    warningTemporaryCleanupPending:
      'Temporary cleanup is still pending. Close the Switcher before removing temporary files.',
    warningFinderFallbackUsed:
      'macOS used Finder-style replacement because direct copy was blocked.',
    warningNonFatalCleanup: 'A non-fatal cleanup step still needs attention.',
    extractSuccessWarning: 'English snapshot refreshed ({count} files). {warnings}',
    chooseAppFirst: 'Choose a Cavalry installation first.',
    noLanguage: 'No language pack is available.',
    refreshingEnglish: 'Refreshing the English snapshot...',
    extractFailed: 'Could not refresh the English snapshot.',
    extractSuccess: 'English snapshot refreshed ({count} files).',
    reconciliationRequired:
      'English snapshot refreshed ({count} files). Runtime reconciliation is required. Confirm the separate action below.',
    reconciliationPending: 'Runtime reconciliation is required. Confirm the separate action below.',
    reconcilingEnglish: 'Reconciling the English runtime...',
    reconciliationConfirmTitle: 'Reconcile the English runtime?',
    reconciliationConfirmBody:
      'This action may request administrator permission, close Cavalry, modify its runtime files and language marker, then restart Cavalry.',
    reconciliationSuccess: 'English runtime reconciled and Cavalry restarted.',
    reconciliationSuccessWithWarnings: 'English runtime reconciled. {warnings}',
    applying: 'Applying {language}...',
    waitingPermission: 'Waiting for system permission.',
    patchFailed: 'Patch failed.',
    cavalryStillRunning:
      'Cavalry is still running. Save your work, close Cavalry, and try again. The Cavalry installation was not changed.',
    restartWarning: 'Cavalry could not be restarted.',
    applied: 'Applied {language} and restarted Cavalry.{warning}',
    appliedWithWarnings: 'Applied {language}. {warnings}',
    openPrivacyFailed: 'Could not open permission settings.',
    bootstrapFailed: 'Bootstrap failed: {detail}',
    operationFailed: 'Could not contact the desktop service. Try again.',
    startupRecoveryFailed:
      'An interrupted Cavalry update could not be recovered safely. Close Cavalry, relaunch the Switcher, and do not modify the installation manually.',
    detail: ' Details: {detail}',
    confirmTitle: 'Install language pack?',
    confirmBody:
      'The selected language pack will modify the chosen Cavalry installation. Cavalry will restart after the files are applied.',
    restoreConfirmTitle: 'Restore the official Cavalry installation?',
    restoreConfirmBody:
      'This removes Switcher runtime files and restores the captured vendor files and signature. If any complete verified preimage is unavailable, the operation will stop and you must reinstall Cavalry.',
    officialRestoreSuccess: 'The captured official Cavalry installation was restored and restarted.',
    officialRestoreWithWarnings: 'The captured official Cavalry installation was restored. {warnings}',
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
    englishUi: '英文界面',
    apply: '应用并重启',
    restoreOfficial: '恢复官方 Cavalry 安装',
    officialMode: '安装状态：已验证的官方运行时',
    modifiedMode: '安装状态：由切换器管理或尚未验证',
    recoveryMode: '安装状态：必须先完成中断事务恢复',
    retryApply: '重试应用',
    refreshEnglish: '刷新英文快照',
    reconcileEnglish: '修复英文运行时',
    openPrivacySecurity: '打开权限设置',
    requestElevation: '以管理员身份重试',
    close: '关闭',
    readyPermission: '修改 Cavalry 安装目录可能需要系统授权。',
    customRootNotWritable:
      '所选 Cavalry 文件夹不可写。Windows 仅能为“Program Files”下的安装请求管理员重试；请选择可写副本或调整此文件夹的权限。',
    readyToApply: '可以开始应用语言包。',
    chooseAppToContinue: '请选择 Cavalry 安装位置后继续。',
    needsExtract: '下次补丁前需要先刷新英文源文件。',
    reinstallRequired: '此 Cavalry 安装的原始英文来源记录不完整，无法安全还原。请使用官方安装包重新安装 Cavalry，然后选择新的安装位置。',
    warningStateDurabilityPending: '无法确认状态存储已经持久化。请再次刷新英文快照，再应用语言或恢复官方安装。',
    warningRecoveryCleanupPending: '恢复清理仍未完成。请保留恢复文件，等待切换器完成清理。',
    warningProtectedRecoveryEvidenceRetained: '受保护事务的恢复证据仍然存在，请勿手动删除。',
    warningTemporaryCleanupPending: '临时清理仍未完成。请先关闭切换器，再移除临时文件。',
    warningFinderFallbackUsed: 'macOS 阻止直接复制后，已改用 Finder 方式替换文件。',
    warningNonFatalCleanup: '仍有一项非致命清理需要处理。',
    extractSuccessWarning: '英文快照已刷新（{count} 个文件）。{warnings}',
    chooseAppFirst: '请先选择 Cavalry 安装位置。',
    noLanguage: '没有可用的语言包。',
    refreshingEnglish: '正在刷新英文快照...',
    extractFailed: '无法刷新英文快照。',
    extractSuccess: '英文快照已刷新（{count} 个文件）。',
    reconciliationRequired: '英文快照已刷新（{count} 个文件）。仍需修复运行时，请确认下方的独立操作。',
    reconciliationPending: '仍需修复运行时，请确认下方的独立操作。',
    reconcilingEnglish: '正在修复英文运行时...',
    reconciliationConfirmTitle: '修复英文运行时？',
    reconciliationConfirmBody:
      '此操作可能请求管理员权限，关闭 Cavalry，修改运行时文件和语言标记，然后重启 Cavalry。',
    reconciliationSuccess: '英文运行时已修复，Cavalry 已重启。',
    reconciliationSuccessWithWarnings: '英文运行时已修复。{warnings}',
    applying: '正在应用{language}...',
    waitingPermission: '正在等待系统授权。',
    patchFailed: '应用语言包失败。',
    cavalryStillRunning: 'Cavalry 仍在运行。请先保存工作并关闭 Cavalry，然后重试；Cavalry 安装内容未被修改。',
    restartWarning: '无法重启 Cavalry。',
    applied: '已应用{language}并重启 Cavalry。{warning}',
    appliedWithWarnings: '已应用{language}。{warnings}',
    openPrivacyFailed: '无法打开权限设置。',
    bootstrapFailed: '启动失败：{detail}',
    operationFailed: '无法连接桌面服务，请重试。',
    startupRecoveryFailed: '中断的 Cavalry 更新无法安全恢复。请关闭 Cavalry 后重新启动切换器，且不要手动修改安装目录。',
    detail: '详情：{detail}',
    confirmTitle: '安装语言包？',
    confirmBody:
      '所选语言包会修改当前 Cavalry 安装目录；文件应用完成后将重启 Cavalry。',
    restoreConfirmTitle: '恢复官方 Cavalry 安装？',
    restoreConfirmBody:
      '此操作会移除切换器运行文件，并恢复已采集的原厂文件与签名。若任一完整且已验证的原始副本缺失，操作会停止，你需要重新安装 Cavalry。',
    officialRestoreSuccess: '已恢复并重启采集时的官方 Cavalry 安装。',
    officialRestoreWithWarnings: '已恢复采集时的官方 Cavalry 安装。{warnings}',
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
    englishUi: '英文介面',
    apply: '套用並重新啟動',
    restoreOfficial: '還原官方 Cavalry 安裝',
    officialMode: '安裝狀態：已驗證的官方執行環境',
    modifiedMode: '安裝狀態：由切換器管理或尚未驗證',
    recoveryMode: '安裝狀態：必須先完成中斷交易復原',
    retryApply: '重試套用',
    refreshEnglish: '重新整理英文快照',
    reconcileEnglish: '修復英文執行環境',
    openPrivacySecurity: '打開權限設定',
    requestElevation: '以系統管理員身分重試',
    close: '關閉',
    readyPermission: '修改 Cavalry 安裝目錄可能需要系統授權。',
    customRootNotWritable:
      '所選 Cavalry 資料夾不可寫入。Windows 僅能為「Program Files」下的安裝要求以系統管理員身分重試；請選擇可寫入的副本或調整此資料夾的權限。',
    readyToApply: '可以開始套用語言包。',
    chooseAppToContinue: '請先選擇 Cavalry 安裝位置再繼續。',
    needsExtract: '下次補丁前需要先重新整理英文來源檔案。',
    reinstallRequired: '此 Cavalry 安裝的原始英文來源記錄不完整，無法安全還原。請使用官方安裝程式重新安裝 Cavalry，然後選擇新的安裝位置。',
    warningStateDurabilityPending: '無法確認狀態儲存已持久化。請再次重新整理英文快照，再套用語言或還原官方安裝。',
    warningRecoveryCleanupPending: '復原清理仍未完成。請保留復原檔案，等待切換器完成清理。',
    warningProtectedRecoveryEvidenceRetained: '受保護交易的復原證據仍然存在，請勿手動刪除。',
    warningTemporaryCleanupPending: '暫存清理仍未完成。請先關閉切換器，再移除暫存檔案。',
    warningFinderFallbackUsed: 'macOS 阻止直接複製後，已改用 Finder 方式替換檔案。',
    warningNonFatalCleanup: '仍有一項非致命清理需要處理。',
    extractSuccessWarning: '英文快照已重新整理（{count} 個檔案）。{warnings}',
    chooseAppFirst: '請先選擇 Cavalry 安裝位置。',
    noLanguage: '沒有可用的語言包。',
    refreshingEnglish: '正在重新整理英文快照...',
    extractFailed: '無法重新整理英文快照。',
    extractSuccess: '英文快照已重新整理（{count} 個檔案）。',
    reconciliationRequired: '英文快照已重新整理（{count} 個檔案）。仍需修復執行環境，請確認下方的獨立操作。',
    reconciliationPending: '仍需修復執行環境，請確認下方的獨立操作。',
    reconcilingEnglish: '正在修復英文執行環境...',
    reconciliationConfirmTitle: '修復英文執行環境？',
    reconciliationConfirmBody:
      '此操作可能要求系統管理員權限，關閉 Cavalry、修改執行環境檔案和語言標記，然後重新啟動 Cavalry。',
    reconciliationSuccess: '英文執行環境已修復，Cavalry 已重新啟動。',
    reconciliationSuccessWithWarnings: '英文執行環境已修復。{warnings}',
    applying: '正在套用{language}...',
    waitingPermission: '正在等待系統授權。',
    patchFailed: '套用語言包失敗。',
    cavalryStillRunning: 'Cavalry 仍在執行。請先儲存工作並關閉 Cavalry，然後重試；Cavalry 安裝內容未被修改。',
    restartWarning: '無法重新啟動 Cavalry。',
    applied: '已套用{language}並重新啟動 Cavalry。{warning}',
    appliedWithWarnings: '已套用{language}。{warnings}',
    openPrivacyFailed: '無法打開權限設定。',
    bootstrapFailed: '啟動失敗：{detail}',
    operationFailed: '無法連線至桌面服務，請重試。',
    startupRecoveryFailed: '中斷的 Cavalry 更新無法安全復原。請關閉 Cavalry 後重新啟動切換器，且不要手動修改安裝目錄。',
    detail: '詳情：{detail}',
    confirmTitle: '安裝語言包？',
    confirmBody:
      '所選語言包會修改目前 Cavalry 安裝目錄；檔案套用完成後將重新啟動 Cavalry。',
    restoreConfirmTitle: '還原官方 Cavalry 安裝？',
    restoreConfirmBody:
      '此操作會移除切換器執行檔案，並還原已擷取的原廠檔案與簽章。若任何完整且已驗證的原始副本缺失，操作會停止，你需要重新安裝 Cavalry。',
    officialRestoreSuccess: '已還原並重新啟動擷取時的官方 Cavalry 安裝。',
    officialRestoreWithWarnings: '已還原擷取時的官方 Cavalry 安裝。{warnings}',
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
    englishUi: '英語 UI',
    apply: '適用して再起動',
    restoreOfficial: '公式 Cavalry を復元',
    officialMode: 'インストール状態: 検証済みの公式ランタイム',
    modifiedMode: 'インストール状態: Switcher 管理または未検証',
    recoveryMode: 'インストール状態: 中断した処理の復旧が必要です',
    retryApply: '適用を再試行',
    refreshEnglish: '英語スナップショットを更新',
    reconcileEnglish: '英語ランタイムを修復',
    openPrivacySecurity: '権限設定を開く',
    requestElevation: '管理者として再試行',
    close: '閉じる',
    readyPermission: 'Cavalry のインストール先を変更するにはシステム権限が必要な場合があります。',
    customRootNotWritable:
      '選択した Cavalry フォルダーには書き込めません。Windows で管理者として再試行できるのは Program Files 配下のインストールのみです。書き込み可能なコピーを選ぶか、このフォルダーのアクセス許可を変更してください。',
    readyToApply: '言語パックを適用できます。',
    chooseAppToContinue: '続行するには Cavalry のインストール先を選択してください。',
    needsExtract: '次のパッチの前に英語ソースファイルを更新する必要があります。',
    reinstallRequired: 'この Cavalry インストールは元の英語データの来歴が不完全なため、安全に復元できません。公式インストーラーで Cavalry を再インストールしてから、新しいインストール先を選択してください。',
    warningStateDurabilityPending:
      '状態ストレージの永続化を確認できませんでした。言語の適用や公式版の復元を行う前に、英語スナップショットをもう一度更新してください。',
    warningRecoveryCleanupPending:
      '復旧用ファイルのクリーンアップがまだ完了していません。Switcher が完了するまで復旧用ファイルを残してください。',
    warningProtectedRecoveryEvidenceRetained:
      '保護されたトランザクションの復旧証跡が残っています。手動で削除しないでください。',
    warningTemporaryCleanupPending:
      '一時ファイルのクリーンアップがまだ完了していません。Switcher を終了してから一時ファイルを削除してください。',
    warningFinderFallbackUsed:
      'macOS が直接コピーを拒否したため、Finder 方式でファイルを置き換えました。',
    warningNonFatalCleanup: '致命的ではないクリーンアップ処理が残っています。',
    extractSuccessWarning: '英語スナップショットを更新しました（{count} ファイル）。{warnings}',
    chooseAppFirst: '先に Cavalry のインストール先を選択してください。',
    noLanguage: '利用できる言語パックがありません。',
    refreshingEnglish: '英語スナップショットを更新しています...',
    extractFailed: '英語スナップショットを更新できませんでした。',
    extractSuccess: '英語スナップショットを更新しました（{count} ファイル）。',
    reconciliationRequired:
      '英語スナップショットを更新しました（{count} ファイル）。ランタイムの修復が必要です。下の独立した操作を確認してください。',
    reconciliationPending: 'ランタイムの修復が必要です。下の独立した操作を確認してください。',
    reconcilingEnglish: '英語ランタイムを修復しています...',
    reconciliationConfirmTitle: '英語ランタイムを修復しますか？',
    reconciliationConfirmBody:
      'この操作では管理者権限を要求し、Cavalry を終了し、ランタイムファイルと言語マーカーを変更してから Cavalry を再起動する場合があります。',
    reconciliationSuccess: '英語ランタイムを修復し、Cavalry を再起動しました。',
    reconciliationSuccessWithWarnings: '英語ランタイムを修復しました。{warnings}',
    applying: '{language}を適用しています...',
    waitingPermission: 'システム権限を待っています。',
    patchFailed: '言語パックの適用に失敗しました。',
    cavalryStillRunning:
      'Cavalry がまだ起動しています。作業を保存して Cavalry を終了してから再試行してください。Cavalry のインストール内容は変更されていません。',
    restartWarning: 'Cavalry を再起動できませんでした。',
    applied: '{language}を適用して Cavalry を再起動しました。{warning}',
    appliedWithWarnings: '{language}を適用しました。{warnings}',
    openPrivacyFailed: '権限設定を開けませんでした。',
    bootstrapFailed: '起動に失敗しました: {detail}',
    operationFailed: 'デスクトップサービスに接続できませんでした。もう一度お試しください。',
    startupRecoveryFailed:
      '中断した Cavalry 更新を安全に復旧できませんでした。Cavalry を終了して Switcher を再起動し、インストール先を手動で変更しないでください。',
    detail: ' 詳細: {detail}',
    confirmTitle: '言語パックをインストールしますか？',
    confirmBody:
      '選択した言語パックは Cavalry のインストール先を変更します。ファイルの適用後に Cavalry を再起動します。',
    restoreConfirmTitle: '公式 Cavalry インストールを復元しますか？',
    restoreConfirmBody:
      'Switcher のランタイムファイルを削除し、取得済みのベンダーファイルと署名を復元します。完全で検証済みの原本が一つでもない場合は停止し、Cavalry の再インストールが必要です。',
    officialRestoreSuccess: '取得時の公式 Cavalry インストールを復元して再起動しました。',
    officialRestoreWithWarnings: '取得時の公式 Cavalry インストールを復元しました。{warnings}',
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
  applyButton.disabled =
    isBusy || state.needsExtract || state.reconciliationRequired || state.controlsBlocked || durabilityPending;
  reconcileButton.disabled =
    isBusy || !state.reconciliationRequired || state.controlsBlocked || durabilityPending;
  restoreButton.disabled =
    isBusy || state.needsExtract || state.reconciliationRequired || reinstallRequired || state.controlsBlocked || durabilityPending;
  languageSelect.disabled = isBusy || state.controlsBlocked || durabilityPending;
}

function updateLanguageOptions(languages) {
  languageSelect.replaceChildren();
  for (const language of languages) {
    const option = document.createElement('option');
    option.value = language.value;
    option.textContent =
      state.platform === 'macos' && language.value === 'en' ? t('englishUi') : language.label;
    languageSelect.append(option);
  }
}

function languageLabel(code) {
  if (code === 'restore-official') return t('restoreOfficial');
  if (state.platform === 'macos' && code === 'en') return t('englishUi');
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
  reconcileButton.textContent = t('reconcileEnglish');
  restoreButton.textContent = t('restoreOfficial');
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
      void runApply(nextLanguage).catch(recoverOperationFailure);
    },
    onSecondary: closeModal,
  });
}

function showReconciliationConfirmation() {
  showModal({
    title: t('reconciliationConfirmTitle'),
    body: t('reconciliationConfirmBody'),
    primary: t('reconcileEnglish'),
    secondary: t('cancel'),
    onPrimary: () => {
      closeModal();
      void runReconciliation().catch(recoverOperationFailure);
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
  const isReconciliation = nextLanguage === 'reconcile-english';
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
      void (isReconciliation ? runReconciliation() : runApply(nextLanguage)).catch(
        recoverOperationFailure
      );
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
  state.permissionAction = bootstrapState.permissionAction || 'none';
  document.documentElement.dataset.platform = state.platform;

  updateLanguageOptions(state.languages);
  languageSelect.value = state.currentLang;
  currentLanguage.textContent = languageLabel(state.currentLang);
  setPermissionWait(false);

  const showMacInstallationMode = state.platform === 'macos' && Boolean(state.appPath);
  installationModeText.hidden = !showMacInstallationMode;
  restoreButton.hidden = !showMacInstallationMode || state.installationMode === 'official';
  reconcileButton.hidden = !state.reconciliationRequired;
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

  state.reconciliationRequired = false;
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
    state.reconciliationRequired = result.reconciliationRequired === true;
    reconcileButton.hidden = !state.reconciliationRequired;
    setBusy(state.busy);
    const refreshed = state.reconciliationRequired
      ? t('reconciliationRequired', { count: result.count })
      : t('extractSuccess', { count: result.count });
    setStatus(
      state.reconciliationRequired
        ? `${refreshed}${warnings ? ` ${warnings}` : ''}`
        : warnings
        ? t('extractSuccessWarning', { count: result.count, warnings })
        : refreshed,
      state.reconciliationRequired || warnings ? 'warning' : 'success'
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
  if (state.reconciliationRequired) {
    setStatus(t('reconciliationPending'), 'warning');
    return;
  }
  if (state.needsExtract) {
    setStatus(t('needsExtract'), 'warning');
    return;
  }

  showApplyConfirmation(languageSelect.value);
}

function requestReconciliation() {
  if (!state.appPath) {
    setStatus(t('chooseAppFirst'), 'warning');
    return;
  }
  if (!state.reconciliationRequired) {
    return;
  }
  if (state.stateDurabilityPending) {
    requireDurabilityRetry();
    return;
  }
  if (state.controlsBlocked) {
    return;
  }
  showReconciliationConfirmation();
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
  if (state.reconciliationRequired) {
    setStatus(t('reconciliationPending'), 'warning');
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

async function runReconciliation() {
  if (!state.reconciliationRequired) {
    return;
  }
  if (state.stateDurabilityPending) {
    requireDurabilityRetry();
    return;
  }
  state.pendingAction = 'reconcile-english';
  setBusy(true);
  setPermissionWait(false);
  setStatus(t('reconcilingEnglish'));

  try {
    const result = await api.reconcileEnglish(state.appPath);
    if (!result.ok) {
      if (result.permissionRequired) {
        showPermissionWait('reconcile-english');
        return;
      }
      if (result.errorCode === 'cavalryStillRunning') {
        setStatus(t('cavalryStillRunning'), 'error');
        return;
      }
      setStatus(withDetail('patchFailed', result.error), 'error');
      return;
    }

    state.reconciliationRequired = false;
    reconcileButton.hidden = true;
    await bootstrap();

    const warningCodes = result.warningCodes || [];
    const warnings = localizedWarningMessages(warningCodes).join(' ');
    state.stateDurabilityPending = warningCodes.includes('stateDurabilityPending');
    setBusy(state.busy);
    state.pendingAction = '';
    setStatus(
      warnings
        ? t('reconciliationSuccessWithWarnings', { warnings })
        : t('reconciliationSuccess'),
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
    void (pending === 'reconcile-english' ? runReconciliation() : runApply(pending)).catch(
      recoverOperationFailure
    );
    return;
  }
  void openPrivacySecurity().catch(recoverOperationFailure);
}
browseButton.addEventListener('click', () => void browseForApp().catch(recoverOperationFailure));
extractButton.addEventListener('click', () => void refreshEnglishSnapshot().catch(recoverOperationFailure));
applyButton.addEventListener('click', requestApply);
reconcileButton.addEventListener('click', requestReconciliation);
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
