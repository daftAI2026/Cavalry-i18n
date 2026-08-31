/**
 * [INPUT]: 依赖 renderer/tokens.css、renderer/styles.css、renderer/operation-log.css、renderer/toast.css 的生产视觉契约，依赖 renderer/ui-text.js 的四语文案、renderer/icons.js 的语义图标注册表，以及 renderer/tauri-bridge.js 的语言清单
 * [OUTPUT]: 对外提供 feedbackCatalogHtml、iconCatalogHtml、badgeCatalogHtml 三个离线 UI 审查页生成函数；页面运行时直接读取生产 token、组件 CSS、UI_TEXT 与图标工厂
 * [POS]: tools 的独立审查目录生成器；只描述和展示生产真相，不复制 Badge 样式、产品文案或 SVG path，不进入 Tauri 运行时
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
const fs = require('node:fs');
const path = require('node:path');
const rendererRoot = path.resolve(__dirname, '..', 'renderer');
const locales = Object.freeze(['en', 'zh-Hans', 'zh-Hant', 'ja_JP']);
/* -------------------------------------------------------------------------- */
/* 稳定 key 是目录的唯一数据；产品文案只在页面加载 UI_TEXT 后读取。 */
/* -------------------------------------------------------------------------- */
const feedbackGroups = Object.freeze([
  Object.freeze({
    key: 'event',
    title: 'Event',
    description: '持续任务、持久状态与可回看的结果。',
    keys: Object.freeze([
      'idlePrompt',
      'applyIntro',
      'restoreIntro',
      'updateIntro',
      'applyOutcome',
      'restoreOutcome',
      'loadingTitle',
      'phaseVerifyInstallationRunningTitle',
      'phaseVerifyInstallationCompletedTitle',
      'phaseVerifyInstallationErrorTitle',
      'verifyInstallationRecovery',
      'phaseEnsureRecoveryRunningTitle',
      'phaseEnsureRecoveryCompletedTitle',
      'phaseEnsureRecoveryErrorTitle',
      'phaseApplyRunningTitle',
      'phaseApplyCompletedTitle',
      'phaseApplyErrorTitle',
      'phaseRestoreRunningTitle',
      'phaseRestoreCompletedTitle',
      'phaseRestoreErrorTitle',
      'phaseRestartRunningTitle',
      'phaseRestartCompletedTitle',
      'phaseRestartWarningTitle',
      'phaseRestartErrorTitle',
      'updateDownloadRunningTitle',
      'updateDownloadProgress',
      'updateDownloadCompletedTitle',
      'updateInstallRunningTitle',
      'updateInstallCompletedTitle',
      'updateRestartRunningTitle',
      'appliedTitle',
      'applied',
      'appliedWithWarnings',
      'restoredTitle',
      'restoreSuccess',
      'restoreWithWarnings',
      'readyToApplyTitle',
      'readyToApply',
      'preparingApplyTitle',
      'preparingApply',
      'restoringTitle',
      'restoring',
      'applyingTitle',
      'applying',
      'noLanguageTitle',
      'noLanguage',
      'chooseAppTitle',
      'chooseAppToContinue',
      'reinstallCavalryTitle',
      'reinstallRequired',
      'finishRuntimeCleanupTitle',
      'runtimeResidueWarning',
      'folderNotWritableTitle',
      'customRootNotWritable',
      'permissionRequiredTitle',
      'waitingPermission',
      'closeCavalryTitle',
      'cavalryStillRunning',
      'applyFailedTitle',
      'patchFailed',
      'recoveryFailedTitle',
      'startupRecoveryFailed',
      'settingsFailedTitle',
      'openPrivacyFailed',
      'desktopServiceUnavailableTitle',
      'operationFailed',
      'restartSwitcherTitle',
      'warningStateDurabilityPending',
      'recoveryCleanupPendingTitle',
      'warningRecoveryCleanupPending',
      'keepRecoveryFilesTitle',
      'warningProtectedRecoveryEvidenceRetained',
      'temporaryCleanupPendingTitle',
      'warningTemporaryCleanupPending',
      'finderReplacementTitle',
      'warningFinderFallbackUsed',
      'cleanupAttentionTitle',
      'warningNonFatalCleanup',
      'updateAvailableTitle',
      'updatePreviewAvailable',
      'updateAvailableAnnouncement',
      'updatesUnavailableTitle',
      'updaterNotConfigured',
      'updaterUnsupportedPlatform',
      'updateCheckFailedTitle',
      'updateCheckFailed',
      'updateInstallFailedTitle',
      'updateInstallFailed',
      'checkUpdateAgainTitle',
      'updateNotChecked',
      'operationInProgressTitle',
      'updateBusy',
      'updateStateUnavailable',
    ]),
  }),
  Object.freeze({
    key: 'alert-dialog',
    title: 'AlertDialog',
    description: '必须由用户立即继续或取消的决策。',
    keys: Object.freeze([
      'restoreConfirmTitle',
      'restoreConfirmBody',
      'cancel',
      'restore',
      'updateConfirmTitle',
      'updateConfirmBody',
      'updateMacAdhocNote',
      'installUpdate',
      'permissionTitle',
      'permissionBody',
      'openSettings',
      'requestElevation',
    ]),
  }),
  Object.freeze({
    key: 'toast',
    title: 'Toast',
    description: '没有主任务承载位置的短时外围失败。',
    keys: Object.freeze([
      'aboutOpenFailedTitle',
      'aboutOpenFailed',
      'projectLinkFailedTitle',
      'openProjectLinkFailed',
      'close',
    ]),
  }),
]);
const iconPurposes = Object.freeze({
  spinner: 'running task marker',
  checkCircle: 'completed task marker',
  warningCircle: 'recoverable warning marker',
  infoCircle: 'informational notice marker',
  errorCircle: 'failed task marker',
  verify: 'installation verification marker',
  archive: 'recovery baseline marker',
  translate: 'language switch marker',
  restore: 'restore task marker',
  restart: 'Cavalry launch marker',
  download: 'updater download marker',
  package: 'updater installation marker',
  update: 'available update action',
  close: 'Toast close action',
});
const badgeMatrix = Object.freeze([
  Object.freeze({
    key: 'macos.officialEnglish',
    platform: 'macOS',
    currentLanguage: 'en',
    installationState: 'official',
    showInstallationBadge: true,
  }),
  Object.freeze({
    key: 'macos.modifiedSimplifiedChinese',
    platform: 'macOS',
    currentLanguage: 'zh-Hans',
    installationState: 'modifiedOrUnverified',
    showInstallationBadge: false,
  }),
  Object.freeze({
    key: 'macos.modifiedTraditionalChinese',
    platform: 'macOS',
    currentLanguage: 'zh-Hant',
    installationState: 'modifiedOrUnverified',
    showInstallationBadge: false,
  }),
  Object.freeze({
    key: 'macos.modifiedJapanese',
    platform: 'macOS',
    currentLanguage: 'ja_JP',
    installationState: 'modifiedOrUnverified',
    showInstallationBadge: false,
  }),
  Object.freeze({
    key: 'windows.translatedSimplifiedChinese',
    platform: 'Windows',
    currentLanguage: 'zh-Hans',
    installationState: 'active',
    showInstallationBadge: false,
  }),
]);
const catalogStyle = String.raw`<style>
  html.catalog-document,
  body.catalog-page {
    width: 100%;
    min-width: 0;
    min-height: 100%;
    height: auto;
    margin: 0;
    overflow: auto;
  }
  body.catalog-page {
    padding: var(--space-8);
    background: var(--surface);
    color: var(--text);
  }
  .catalog-shell {
    width: min(100%, 1440px);
    margin: 0 auto;
  }
  .catalog-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-6);
    margin-bottom: var(--space-6);
  }
  .catalog-heading,
  .catalog-section-heading {
    min-width: 0;
  }
  .catalog-heading h1,
  .catalog-section-heading h2,
  .catalog-section-heading p {
    margin: 0;
  }
  .catalog-heading h1 {
    font-size: var(--type-heading);
    font-weight: var(--weight-medium);
    line-height: var(--line-height-heading);
  }
  .catalog-heading p,
  .catalog-section-heading p,
  .catalog-source,
  .catalog-empty,
  .catalog-absence {
    color: var(--text-secondary);
    font-size: var(--type-metadata);
    font-weight: var(--weight-regular);
    line-height: var(--line-height-metadata);
  }
  .catalog-heading p,
  .catalog-source {
    margin-top: var(--space-1);
  }
  .catalog-source code,
  .catalog-key,
  .catalog-state,
  .catalog-style-output {
    font-family: var(--font-mono);
  }
  .catalog-source {
    max-width: 52ch;
    text-align: right;
  }
  .catalog-section {
    display: grid;
    gap: var(--space-3);
    margin-top: var(--space-8);
  }
  .catalog-section:first-child {
    margin-top: 0;
  }
  .catalog-section-heading {
    display: grid;
    gap: var(--space-1);
  }
  .catalog-section-heading h2 {
    font-size: var(--type-compact);
    font-weight: var(--weight-medium);
    line-height: var(--line-height-compact);
  }
  .catalog-table-wrap {
    overflow-x: auto;
    border: var(--stroke-hairline) solid var(--border);
    border-radius: var(--radius-md);
    background: var(--surface-raised);
  }
  .catalog-table {
    width: 100%;
    min-width: 820px;
    border-collapse: collapse;
    table-layout: fixed;
  }
  .catalog-table th,
  .catalog-table td {
    padding: var(--space-3);
    border-bottom: var(--stroke-hairline) solid var(--border);
    vertical-align: top;
    text-align: left;
  }
  .catalog-table tr:last-child th,
  .catalog-table tr:last-child td {
    border-bottom: 0;
  }
  .catalog-table th {
    background: var(--surface-interactive);
    color: var(--text-secondary);
    font-size: var(--type-label);
    font-weight: var(--weight-medium);
    line-height: var(--line-height-label);
  }
  .catalog-table td {
    font-size: var(--type-compact);
    font-weight: var(--weight-regular);
    line-height: var(--line-height-compact);
    overflow-wrap: anywhere;
    white-space: pre-wrap;
  }
  .catalog-table .catalog-key-cell {
    width: 220px;
  }
  .catalog-key {
    color: var(--text-secondary);
    font-size: var(--type-label);
    line-height: var(--line-height-label);
  }
  .catalog-locale-code {
    display: block;
    margin-top: var(--space-1);
    color: var(--text-secondary);
    font-family: var(--font-mono);
    font-size: var(--type-label);
    font-weight: var(--weight-regular);
    line-height: var(--line-height-label);
  }
  .catalog-icon-grid,
  .catalog-badge-grid,
  .catalog-matrix {
    display: grid;
    gap: var(--space-3);
  }
  .catalog-icon-grid {
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  }
  .catalog-icon-card,
  .catalog-badge-card,
  .catalog-matrix-row {
    min-width: 0;
    display: grid;
    gap: var(--space-3);
    padding: var(--space-4);
    border: var(--stroke-hairline) solid var(--border);
    border-radius: var(--radius-md);
    background: var(--surface-raised);
  }
  .catalog-icon-card {
    grid-template-columns: var(--space-8) minmax(0, 1fr);
    align-items: center;
  }
  .catalog-icon-glyph {
    width: var(--space-8);
    height: var(--space-8);
    display: grid;
    place-items: center;
    color: var(--text);
  }
  .catalog-icon-glyph svg {
    width: 100%;
    height: 100%;
  }
  .catalog-icon-copy {
    min-width: 0;
    display: grid;
    gap: var(--space-1);
  }
  .catalog-icon-name,
  .catalog-badge-label,
  .catalog-matrix-key {
    font-family: var(--font-mono);
    font-size: var(--type-label);
    line-height: var(--line-height-label);
  }
  .catalog-icon-name,
  .catalog-badge-label,
  .catalog-matrix-key {
    color: var(--text);
    font-weight: var(--weight-medium);
  }
  .catalog-icon-purpose,
  .catalog-matrix-meta,
  .catalog-style-output {
    color: var(--text-secondary);
    font-size: var(--type-metadata);
    font-weight: var(--weight-regular);
    line-height: var(--line-height-metadata);
  }
  .catalog-badge-grid {
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  }
  .catalog-badge-card {
    align-content: start;
  }
  .catalog-badge-display,
  .catalog-matrix-badges {
    min-height: var(--space-8);
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--space-2);
  }
  .catalog-style-output {
    overflow-wrap: anywhere;
  }
  .catalog-matrix-row {
    grid-template-columns: minmax(180px, 1fr) minmax(0, 2fr);
    align-items: center;
  }
  .catalog-matrix-meta {
    display: grid;
    gap: var(--space-1);
  }
  .catalog-note {
    margin-top: var(--space-3);
    padding: var(--space-3);
    border-left: var(--space-1) solid var(--border-strong);
    color: var(--text-secondary);
    font-size: var(--type-metadata);
    line-height: var(--line-height-metadata);
  }
  @media (max-width: 760px) {
    body.catalog-page {
      padding: var(--space-4);
    }
    .catalog-header,
    .catalog-matrix-row {
      grid-template-columns: 1fr;
      display: grid;
    }
    .catalog-source {
      max-width: none;
      text-align: left;
    }
  }
</style>`;
function jsonForScript(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}
function assetLinks(extra = []) {
  const paths = ['/renderer/tokens.css', '/renderer/styles.css', ...extra];
  return paths.map((asset) => `<link rel="stylesheet" href="${asset}" />`).join('\n  ');
}
function scriptLinks() {
  return [
    '<script src="/renderer/ui-text.js"></script>',
    '<script src="/renderer/icons.js"></script>',
  ].join('\n  ');
}
function pageDocument({ title, extraStyles = [], body, script }) {
  return `<!doctype html>
<html class="catalog-document" lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${title}</title>
  ${assetLinks(extraStyles)}
  ${catalogStyle}
</head>
<body class="catalog-page">
  <main class="catalog-shell">
    ${body}
  </main>
  ${scriptLinks()}
  <script>
${script}
  </script>
</body>
</html>`;
}
function feedbackBody() {
  return String.raw`<header class="catalog-header">
  <div class="catalog-heading">
    <h1>Feedback catalog</h1>
    <p>Event / AlertDialog / Toast 的生产四语审查目录</p>
  </div>
  <p class="catalog-source">文案来自 <code>/renderer/ui-text.js</code>；目录数据只保存稳定 key。</p>
</header>
<div id="feedbackCatalog" aria-live="polite"></div>`;
}
function feedbackScript() {
  return [
    String.raw`(() => {
  'use strict';
  const source = typeof UI_TEXT === 'undefined' ? null : UI_TEXT;
  const localeList = `,
    jsonForScript(locales),
    String.raw`;
  const groups = `,
    jsonForScript(feedbackGroups),
    String.raw`;
  function text(locale, key) {
    const dictionary = source && (source[locale] || source.en);
    return dictionary && Object.prototype.hasOwnProperty.call(dictionary, key)
      ? String(dictionary[key])
      : '—';
  }
  function cell(value, className = '') {
    const element = document.createElement('td');
    if (className) element.className = className;
    element.textContent = value;
    return element;
  }
  function renderGroup(group) {
    const section = document.createElement('section');
    section.className = 'catalog-section';
    section.dataset.group = group.key;
    section.innerHTML = '<div class="catalog-section-heading"><h2></h2><p></p></div>'
      + '<div class="catalog-table-wrap"><table class="catalog-table">'
      + '<caption class="sr-only"></caption><thead><tr><th class="catalog-key-cell" scope="col">UI_TEXT key</th></tr></thead>'
      + '<tbody></tbody></table></div>';
    section.querySelector('h2').textContent = group.title;
    section.querySelector('p').textContent = group.description;
    section.querySelector('caption').textContent = group.title + ' localized values';
    const header = section.querySelector('thead tr');
    for (const locale of localeList) {
      const th = document.createElement('th');
      th.scope = 'col';
      th.textContent = locale;
      header.append(th);
    }
    const body = section.querySelector('tbody');
    for (const key of group.keys) {
      const row = document.createElement('tr');
      const keyCell = document.createElement('th');
      keyCell.scope = 'row';
      keyCell.className = 'catalog-key';
      keyCell.textContent = key;
      row.append(keyCell);
      for (const locale of localeList) row.append(cell(text(locale, key)));
      body.append(row);
    }
    return section;
  }
  const root = document.querySelector('#feedbackCatalog');
  if (!source) {
    root.innerHTML = '<p class="catalog-empty">无法加载 /renderer/ui-text.js。</p>';
    return;
  }
  for (const group of groups) root.append(renderGroup(group));
})();`,
  ].join('');
}
function readIconRegistryNames() {
  const source = fs.readFileSync(path.join(rendererRoot, 'icons.js'), 'utf8');
  const startMarker = 'const ICONS = Object.freeze({';
  const start = source.indexOf(startMarker);
  const end = source.indexOf('\n  });', start + startMarker.length);
  if (start < 0 || end < 0) throw new Error('icons.js registry boundary is missing');
  const registry = source.slice(start + startMarker.length, end);
  const names = [...registry.matchAll(/^\s{4}([A-Za-z][A-Za-z0-9]*):\s*\{/gm)].map((match) => match[1]);
  if (names.length === 0) throw new Error('icons.js registry has no semantic icons');
  return Object.freeze([...new Set(names)]);
}
function iconBody() {
  return String.raw`<header class="catalog-header">
  <div class="catalog-heading">
    <h1>Icon catalog</h1>
    <p>生产语义图标注册表的离线审查页</p>
  </div>
  <p class="catalog-source">图标由 <code>/renderer/icons.js</code> 的 <code>cavalryIcons.create(name)</code> 创建；本页不保存 SVG path。</p>
</header>
<section class="catalog-section" aria-labelledby="iconCatalogHeading">
  <div class="catalog-section-heading">
    <h2 id="iconCatalogHeading">Registered semantic icons</h2>
    <p>用途映射是审查说明，不是产品文案；图形和 currentColor 行为来自生产注册表。</p>
  </div>
  <div id="iconCatalog" class="catalog-icon-grid"></div>
</section>`;
}
function iconScript(names) {
  return [
    String.raw`(() => {
  'use strict';
  const names = `,
    jsonForScript(names),
    String.raw`;
  const purposes = `,
    jsonForScript(iconPurposes),
    String.raw`;
  const root = document.querySelector('#iconCatalog');
  for (const name of names) {
    const card = document.createElement('article');
    card.className = 'catalog-icon-card';
    card.dataset.iconName = name;
    const glyph = document.createElement('span');
    glyph.className = 'catalog-icon-glyph';
    const icon = window.cavalryIcons && window.cavalryIcons.create(name);
    if (icon) glyph.append(icon);
    else glyph.textContent = '—';
    const copy = document.createElement('div');
    copy.className = 'catalog-icon-copy';
    const label = document.createElement('code');
    label.className = 'catalog-icon-name';
    label.textContent = name;
    const purpose = document.createElement('span');
    purpose.className = 'catalog-icon-purpose';
    purpose.textContent = purposes[name] || 'registered semantic icon';
    copy.append(label, purpose);
    card.append(glyph, copy);
    root.append(card);
  }
})();`,
  ].join('');
}
function readLanguageManifest() {
  const source = fs.readFileSync(path.join(rendererRoot, 'tauri-bridge.js'), 'utf8');
  const manifest = [...source.matchAll(/value:\s*'([^']+)',\s*label:\s*'([^']+)'/g)]
    .slice(0, locales.length)
    .map((match) => Object.freeze({ value: match[1], label: match[2] }));
  if (manifest.length !== locales.length) throw new Error('tauri-bridge.js language manifest is incomplete');
  return Object.freeze(manifest);
}
function badgeBody() {
  return String.raw`<header class="catalog-header">
  <div class="catalog-heading">
    <h1>Badge catalog</h1>
    <p>生产 Badge CSS、四种语言与实际安装状态组合</p>
  </div>
  <p class="catalog-source">本页直接加载 <code>/renderer/tokens.css</code> 与 <code>/renderer/styles.css</code>；Badge 不在目录中重写。</p>
</header>
<section class="catalog-section" aria-labelledby="languageBadgesHeading">
  <div class="catalog-section-heading">
    <h2 id="languageBadgesHeading">Language</h2>
    <p>四种语言的标签值来自生产语言清单；颜色、字号、字重和圆角由真实 <code>.badge</code> CSS 决定。</p>
  </div>
  <div id="languageBadges" class="catalog-badge-grid"></div>
</section>
<template id="badgeTemplate"><span class="badge" data-kind="language"></span></template>
<section class="catalog-section" aria-labelledby="officialBadgesHeading">
  <div class="catalog-section-heading">
    <h2 id="officialBadgesHeading">Official</h2>
    <p>同一稳定 key 在四种 UI locale 下的真实文案。</p>
  </div>
  <div id="officialBadges" class="catalog-badge-grid"></div>
</section>
<section class="catalog-section" aria-labelledby="badgeMatrixHeading">
  <div class="catalog-section-heading">
    <h2 id="badgeMatrixHeading">Actual combinations</h2>
    <p>矩阵按 app.js 的 showInstallation 条件展示：只有 macOS 官方英文安装显示第二个 Official Badge。</p>
  </div>
  <div id="badgeMatrix" class="catalog-matrix"></div>
</section>
<p class="catalog-note">颜色和文字对比度请以当前生产 token 的计算样式审查；本页不会通过复制色值或提高本地 CSS 权重来伪造结果。</p>`;
}
function badgeScript(manifest) {
  return [
    String.raw`(() => {
  'use strict';
  const source = typeof UI_TEXT === 'undefined' ? null : UI_TEXT;
  const languageManifest = `,
    jsonForScript(manifest),
    String.raw`;
  const matrix = `,
    jsonForScript(badgeMatrix),
    String.raw`;
  function dictionary(locale) {
    return source && (source[locale] || source.en);
  }
  function text(locale, key) {
    const values = dictionary(locale);
    return values && Object.prototype.hasOwnProperty.call(values, key) ? String(values[key]) : '—';
  }
  function languageLabel(value) {
    return languageManifest.find((language) => language.value === value)?.label || value;
  }
  function makeBadge({ kind, state, value }) {
    const template = document.querySelector('#badgeTemplate');
    const badge = template.content.firstElementChild.cloneNode(true);
    badge.dataset.kind = kind;
    if (state) badge.dataset.state = state;
    badge.textContent = value;
    return badge;
  }
  function styleOutput(badge) {
    const style = getComputedStyle(badge);
    return 'font-weight: ' + style.fontWeight
      + ' · color: ' + style.color
      + ' · background: ' + style.backgroundColor
      + ' · border: ' + style.borderColor;
  }
  function renderLanguageBadges() {
    const root = document.querySelector('#languageBadges');
    for (const language of languageManifest) {
      const card = document.createElement('article');
      card.className = 'catalog-badge-card';
      const label = document.createElement('code');
      label.className = 'catalog-badge-label';
      label.textContent = language.value;
      const display = document.createElement('div');
      display.className = 'catalog-badge-display';
      const badge = makeBadge({ kind: 'language', value: language.label });
      const output = document.createElement('output');
      output.className = 'catalog-style-output';
      display.append(badge);
      card.append(label, display, output);
      root.append(card);
      output.textContent = styleOutput(badge);
    }
  }
  function renderOfficialBadges() {
    const root = document.querySelector('#officialBadges');
    for (const locale of `,
    jsonForScript(locales),
    String.raw`) {
      const card = document.createElement('article');
      card.className = 'catalog-badge-card';
      const label = document.createElement('code');
      label.className = 'catalog-badge-label';
      label.textContent = locale;
      const display = document.createElement('div');
      display.className = 'catalog-badge-display';
      const badge = makeBadge({ kind: 'installation', state: 'official', value: text(locale, 'officialBadge') });
      const output = document.createElement('output');
      output.className = 'catalog-style-output';
      display.append(badge);
      card.append(label, display, output);
      root.append(card);
      output.textContent = styleOutput(badge);
    }
  }
  function renderMatrix() {
    const root = document.querySelector('#badgeMatrix');
    for (const entry of matrix) {
      const row = document.createElement('article');
      row.className = 'catalog-matrix-row';
      row.dataset.case = entry.key;
      const meta = document.createElement('div');
      meta.className = 'catalog-matrix-meta';
      const key = document.createElement('code');
      key.className = 'catalog-matrix-key';
      key.textContent = entry.key;
      const state = document.createElement('span');
      state.className = 'catalog-state';
      state.textContent = entry.platform + ' · ' + entry.installationState;
      meta.append(key, state);
      const badges = document.createElement('div');
      badges.className = 'catalog-matrix-badges';
      badges.append(makeBadge({ kind: 'language', value: languageLabel(entry.currentLanguage) }));
      if (entry.showInstallationBadge) {
        badges.append(makeBadge({ kind: 'installation', state: 'official', value: text('en', 'officialBadge') }));
      } else {
        const absence = document.createElement('span');
        absence.className = 'catalog-absence';
        absence.textContent = 'installation badge: not rendered';
        badges.append(absence);
      }
      row.append(meta, badges);
      root.append(row);
    }
  }
  if (!source) {
    document.querySelector('#badgeMatrix').textContent = '无法加载 /renderer/ui-text.js。';
    return;
  }
  renderLanguageBadges();
  renderOfficialBadges();
  renderMatrix();
})();`,
  ].join('');
}
function feedbackCatalogHtml() {
  return pageDocument({
    title: 'Cavalry Feedback Catalog',
    extraStyles: ['/renderer/operation-log.css', '/renderer/toast.css'],
    body: feedbackBody(),
    script: feedbackScript(),
  });
}
function iconCatalogHtml() {
  const names = readIconRegistryNames();
  return pageDocument({
    title: 'Cavalry Icon Catalog',
    body: iconBody(),
    script: iconScript(names),
  });
}
function badgeCatalogHtml() {
  const manifest = readLanguageManifest();
  return pageDocument({
    title: 'Cavalry Badge Catalog',
    body: badgeBody(),
    script: badgeScript(manifest),
  });
}
module.exports = Object.freeze({
  feedbackCatalogHtml,
  iconCatalogHtml,
  badgeCatalogHtml,
});
