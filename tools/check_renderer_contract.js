#!/usr/bin/env node
/**
 * [INPUT]: renderer 静态 DOM、稳定文案脚本、轻量 Select 状态机、CSP 配置与冻结 bridge API。
 * [OUTPUT]: 守住固定 DOM anchors、原生 macOS 交通灯与可拖拽标题区、Item/自绘 Select/Button Group/Alert 语义层、local-only renderer/Geist 字体、单一更新图标/tooltip/无障碍通知、脱敏 updater bridge、原生 dialog 状态边界、English UI/官方还原分离及最小 bridge 表面。
 * [POS]: renderer 的快速静态契约测试；只证明配置/source 形状，不虚称 packaged WebView CSP 执行。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(repoRoot, relative), 'utf8');
const UI_LOCALE_MARKERS = ['  en: {', "  'zh-Hans': {", "  'zh-Hant': {", '  ja_JP: {'];
const UPDATE_ICON_PATH = 'M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216Zm37.66-101.66a8,8,0,0,1-11.32,11.32L136,107.31V168a8,8,0,0,1-16,0V107.31l-18.34,18.35a8,8,0,0,1-11.32-11.32l32-32a8,8,0,0,1,11.32,0Z';

function uiLocaleBodies(source) {
  return UI_LOCALE_MARKERS.map((marker, index) => {
    const start = source.indexOf(marker);
    assert.notEqual(start, -1, `${marker} locale missing`);
    const nextMarker = UI_LOCALE_MARKERS[index + 1];
    const end = nextMarker ? source.indexOf(nextMarker, start) : source.indexOf('\n};', start);
    assert.notEqual(end, -1, `${marker} locale body is incomplete`);
    return source.slice(start, end);
  });
}

const REQUIRED_IDS = [
  'skipLink', 'mainContent', 'windowTitle', 'appVersion', 'appPath', 'languageSectionLabel', 'maintenanceHeading', 'currentLabel', 'currentLanguage',
  'updateControl', 'updateButton', 'updateTooltip', 'updateAnnouncement',
  'installationMode', 'switchToLabel', 'languageSelectRoot', 'languageSelect', 'languageSelectTrigger', 'languageSelectValue', 'languageSelectPopup', 'languageSelectList', 'browseButton', 'extractButton', 'applyButton', 'restoreEnglishButton', 'restoreButton',
  'permissionButton', 'statusLabel', 'modalBackdrop', 'modalTitle', 'modalBody', 'modalPrimaryButton',
  'modalSecondaryButton', 'modalCloseButton', 'statusText',
];

const REQUIRED_API_METHODS = [
  'getStatus', 'browseApp', 'extractEnglish', 'applyLanguage', 'openPrivacySecurity',
  'checkUpdate', 'installUpdate',
];

test('renderer retains DOM anchors and uses only local resources', () => {
  const html = read('renderer/index.html');
  const styles = read('renderer/styles.css');
  const app = read('renderer/app.js');
  const uiText = read('renderer/ui-text.js');
  for (const id of REQUIRED_IDS) assert.match(html, new RegExp(`id="${id}"`), `#${id} missing`);
  const htmlWithoutSvgNamespace = html.replace(/\s+xmlns="http:\/\/www\.w3\.org\/2000\/svg"/g, '');
  assert.doesNotMatch(htmlWithoutSvgNamespace, /https?:\/\//, 'renderer HTML must not load remote resources');
  assert.doesNotMatch(styles, /@import|url\([\"']?https?:/i, 'styles must not load remote resources');
  assert.match(
    html,
    /<script src="\.\/tauri-bridge\.js"><\/script>\s*<script src="\.\/ui-text\.js"><\/script>\s*<script src="\.\/select-control\.js"><\/script>\s*<script src="\.\/app\.js"><\/script>/,
    'renderer scripts must load bridge, stable text, select state machine, then app'
  );
  assert.match(uiText, /const UI_TEXT = \{/);
  assert.doesNotMatch(app, /const UI_TEXT = \{/);
  assert.match(styles, /@font-face[\s\S]*Geist-Variable\.woff2/);
  assert.match(styles, /@font-face[\s\S]*GeistMono-Variable\.woff2/);
  for (const font of ['Geist-Variable.woff2', 'GeistMono-Variable.woff2', 'OFL.txt']) {
    assert.ok(fs.existsSync(path.join(repoRoot, 'renderer/assets/fonts', font)), `${font} missing`);
  }
  assert.ok(app.split(/\r?\n/).length <= 800, 'renderer/app.js must stay within the 800-line contract');
});

test('update control preserves the supplied small icon and accessible tooltip contract', () => {
  const html = read('renderer/index.html');
  const styles = read('renderer/styles.css');
  const app = read('renderer/app.js');
  const updateButton = html.match(/<button id="updateButton"[\s\S]*?<\/button>/)?.[0];
  assert.ok(updateButton, '#updateButton block missing');
  assert.match(
    updateButton,
    /<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" width="16" height="16" fill="currentColor" viewBox="0 0 256 256" aria-hidden="true" focusable="false">/
  );
  assert.match(updateButton, /id="updateButton"[^>]*aria-label="[^"]+"/);
  assert.match(updateButton, /aria-describedby="updateTooltip"/);
  const pathMatch = updateButton.match(/<path d="([^"]+)"><\/path>/);
  assert.ok(pathMatch, 'update icon path missing');
  assert.equal(pathMatch[1], UPDATE_ICON_PATH, 'update icon path must remain exact');
  assert.match(html, /id="updateControl"[^>]*data-tooltip-state="closed"[^>]*hidden/);
  assert.match(html, /id="updateTooltip"[^>]*role="tooltip"/);
  assert.match(html, /id="updateAnnouncement"[^>]*role="status"[^>]*aria-live="polite"/);
  assert.match(styles, /\.update-button\s*\{[\s\S]*?background: transparent;[\s\S]*?color: var\(--tone-update\)/);
  assert.match(styles, /\.update-button svg\s*\{[\s\S]*?width: 18px;[\s\S]*?height: 18px;/);
  assert.match(styles, /\.tooltip-anchor\[data-tooltip-state="open"\] \.tooltip/);
  assert.match(styles, /\.tooltip\s*\{[\s\S]*?visibility: hidden/);
  assert.doesNotMatch(styles, /transition:\s*all/);
  assert.doesNotMatch(styles, /grain|@keyframes\s+fade-up/);
  assert.match(styles, /:where\(button:not\(\.select-trigger\)\):focus-visible\s*\{/);
  const selectFocusBlock = styles.match(/\.select-trigger:focus-visible\s*\{([^}]*)\}/)?.[1];
  assert.ok(selectFocusBlock, 'select focus state missing');
  assert.match(selectFocusBlock, /border-color:[\s\S]*?background:/);
  assert.doesNotMatch(selectFocusBlock, /outline:|box-shadow:/, 'select must not draw a focus ring');
  assert.match(styles, /@media \(max-width: 420px\)/);
  assert.match(html, /<section class="language-section" aria-labelledby="languageSectionLabel">/);
  assert.match(html, /id="languageSelectTrigger"[^>]*role="combobox"[^>]*aria-haspopup="listbox"[^>]*aria-expanded="false"/);
  assert.match(html, /id="languageSelectList"[^>]*role="listbox"/);
  assert.match(html, /class="maintenance-group"[^>]*role="group"/);
  assert.match(html, /<dialog id="modalBackdrop"[^>]*aria-labelledby="modalTitle"[^>]*aria-describedby="modalBody">/);
  assert.match(html, /id="statusPanel"[^>]*role="status"[^>]*aria-labelledby="statusLabel"/);
  assert.match(styles, /--control-height:\s*36px/);
  assert.match(html, /class="titlebar" data-tauri-drag-region/);
  assert.doesNotMatch(html, /traffic-light|aria-label="Window controls"/, 'macOS traffic lights must remain native');
  assert.match(styles, /\.titlebar\s*\{[\s\S]*?display:\s*flex/);
  assert.match(styles, /\.titlebar\s*\{[\s\S]*?align-items:\s*center/);
  assert.match(styles, /\.titlebar-copy\s*\{[\s\S]*?align-items:\s*center/);
  assert.match(styles, /\.tooltip-anchor\s*\{[\s\S]*?display:\s*inline-flex;[\s\S]*?align-items:\s*center/);
  assert.match(styles, /\.installation-item\s*\{[\s\S]*?display:\s*grid/);
  assert.match(styles, /\.language-control-row\s*\{[\s\S]*?grid-template-columns:\s*repeat\(3/);
  assert.match(styles, /\.maintenance-group\s*\{[\s\S]*?grid-template-columns:\s*repeat\(3/);
  assert.match(styles, /\.status-panel\s*\{[\s\S]*?grid-template-columns:\s*16px minmax\(0, 1fr\) auto/);
  assert.match(styles, /@media \(max-width: 420px\)[\s\S]*?\.maintenance-group \.button\s*\{[\s\S]*?padding-inline: 8px/);
  assert.match(app, /document\.body\.dataset\.platform = state\.platform/);
  assert.match(app, /updateControl\.addEventListener\('mouseenter'/);
  assert.match(app, /updateControl\.addEventListener\('focusin'/);
  assert.match(app, /if \(event\.key === 'Escape'\) setUpdateTooltipOpen\(false\)/);
  assert.match(app, /state\.ready = false;[\s\S]*?setBusy\(state\.busy\);[\s\S]*?await api\.getStatus\(\)/);
});

test('renderer builds language options safely and bridge API is frozen/minimal', () => {
  const app = read('renderer/app.js');
  const selectControl = read('renderer/select-control.js');
  const bridge = read('renderer/tauri-bridge.js');
  assert.doesNotMatch(app, /\.innerHTML\s*=/, 'renderer must not interpolate backend data as HTML');
  assert.match(selectControl, /document\.createElement\('option'\)/);
  assert.match(selectControl, /nativeOption\.textContent\s*=/);
  assert.match(selectControl, /createElementNS\('http:\/\/www\.w3\.org\/2000\/svg', 'svg'\)/);
  assert.match(selectControl, /path\.setAttribute\('d', 'm20 6-11 11-5-5'\)/);
  assert.match(app, /languages\.filter\(\(language\) => language\.value !== 'en'\)/);
  assert.match(app, /runApply\('restore-official'\)/);
  assert.match(app, /showApplyConfirmation\('en'\)/);
  assert.match(app, /restoreEnglishButton\.addEventListener/);
  assert.match(app, /statusLabel\.textContent = t\('statusLabel'\)/);
  assert.match(app, /maintenanceHeading\.textContent = t\('maintenance'\)/);
  assert.match(app, /currentLanguage\.dataset\.state = visualState/);
  assert.match(app, /updateButton\.addEventListener/);
  assert.match(app, /updateControl\.hidden = !\(updatePreviewEnabled \|\| state\.updateInfo\?\.available\)/);
  assert.match(app, /updateTooltip\.textContent = t\('updateTooltip'\)/);
  assert.match(app, /state\.installationMode === 'official'/);
  assert.match(bridge, /Object\.freeze\(\{/);
  assert.match(bridge, /LANGUAGE_MANIFEST/);
  for (const method of REQUIRED_API_METHODS) assert.match(bridge, new RegExp(`${method}:`));
  assert.doesNotMatch(bridge, /restartCavalry:/, 'restart is internal to apply, not a renderer API');
  assert.doesNotMatch(app, /api\.restartCavalry\(/, 'renderer must not split apply/restart operations');
});

test('Tauri configuration disables global injection and declares a local-only CSP', () => {
  const config = JSON.parse(read('src-tauri/tauri.conf.json'));
  assert.equal(config.app.withGlobalTauri, false);
  assert.equal(typeof config.app.security.csp, 'string');
  assert.match(config.app.security.csp, /default-src 'self'/);
  assert.match(config.app.security.csp, /script-src 'self'/);
  assert.doesNotMatch(config.app.security.csp, /https?:\/\//);
  const window = config.app.windows.find((candidate) => candidate.label === 'main');
  assert.equal(window.decorations, true);
  assert.equal(window.titleBarStyle, 'Overlay');
  assert.equal(window.hiddenTitle, true);
  const capabilities = JSON.parse(read('src-tauri/capabilities/default.json'));
  assert.ok(capabilities.permissions.includes('core:window:allow-start-dragging'));
});


test('renderer localizes reinstall and composable warning-code paths without raw warning prose', () => {
  const app = read('renderer/app.js');
  const uiText = read('renderer/ui-text.js');
  const bridge = read('renderer/tauri-bridge.js');
  const styles = read('renderer/styles.css');
  assert.equal((uiText.match(/reinstallRequired:/g) || []).length, 4, 'all four UI locales must localize the reinstall route');
  const localeBodies = uiLocaleBodies(uiText);
  for (const key of [
    'restoreEnglish',
    'restoreOfficialShort',
    'maintenance',
    'refreshEnglishAria',
    'statusLabel',
    'warningStateDurabilityPending',
    'warningRecoveryCleanupPending',
    'warningProtectedRecoveryEvidenceRetained',
    'warningTemporaryCleanupPending',
    'warningFinderFallbackUsed',
    'warningNonFatalCleanup',
    'appliedWithWarnings',
    'officialRestoreWithWarnings',
    'runtimeResidueWarning',
    'runtimeResidueAfterRefresh',
    'updateAvailableAnnouncement',
    'updateConfirmTitle',
    'updateConfirmBody',
    'updateMacAdhocNote',
    'installUpdate',
    'installingUpdate',
    'updaterNotConfigured',
    'updaterUnsupportedPlatform',
    'updateCheckFailed',
    'updateInstallFailed',
    'updateNotChecked',
    'updateBusy',
    'updateStateUnavailable',
  ]) {
    for (const body of localeBodies) {
      assert.match(body, new RegExp(`^\\s{4}${key}:`, 'm'), `${key} missing from a locale`);
    }
  }
  assert.match(app, /function requiresCavalryReinstall\(\)[\s\S]*modifiedOrUnverified[\s\S]*state\.needsExtract/);
  assert.match(app, /setStatus\(t\('reinstallRequired'\), 'error'\)/);
  assert.match(app, /warningCodes\.includes\('stateDurabilityPending'\)/);
  assert.match(app, /browseButton\.disabled[\s\S]*durabilityPending/);
  assert.match(
    app,
    /extractButton\.disabled = notReady \|\| isBusy \|\| state\.controlsBlocked \|\| reinstallRequired/
  );
  assert.match(app, /restoreEnglishButton\.disabled[\s\S]*state\.needsExtract/);
  assert.doesNotMatch(app, /reconcileEnglish|reconcileButton|runReconciliation|showReconciliation/);
  assert.doesNotMatch(app, /state\.reconciliationRequired/, 'residue detection must not become renderer mutation state');
  assert.doesNotMatch(app, /result\.warning(?!Codes)/, 'app.js must never render backend warning prose');
  assert.match(bridge, /WARNING_CODE_MANIFEST/);
  assert.match(bridge, /warning:\s*null/);
  assert.match(bridge, /warningCodes:\s*Object\.freeze/);
  assert.doesNotMatch(bridge, /reconcileEnglish/);
  assert.doesNotMatch(styles, /--text-muted/);
  assert.doesNotMatch(styles, /reconcile-button/);
});

test('update icon stays hidden until preview or a signed updater result and renderer has no network client', () => {
  const html = read('renderer/index.html');
  const app = read('renderer/app.js');
  const bridge = read('renderer/tauri-bridge.js');
  const uiText = read('renderer/ui-text.js');
  assert.match(html, /id="updateControl"[^>]*hidden/);
  assert.match(html, /id="updateTooltip"[^>]*role="tooltip"/);
  assert.match(uiText, /updateTooltip:/);
  assert.match(uiText, /updateMacAdhocNote:/);
  assert.match(app, /function updatePreviewRequested\(\)/);
  assert.match(app, /preview=update/);
  assert.match(app, /window\.__CAVALRY_I18N_PREVIEW__/);
  assert.match(app, /if \(updatePreviewEnabled \|\| typeof api\.checkUpdate !== 'function'\) return/);
  assert.match(app, /const result = await api\.checkUpdate\(\)/);
  assert.match(app, /const result = await api\.installUpdate\(\)/);
  assert.match(bridge, /invoke\('check_update'\)/);
  assert.match(bridge, /invoke\('install_update'\)/);
  assert.match(bridge, /UPDATE_ERROR_CODE_MANIFEST/);
  assert.doesNotMatch(bridge, /url:\s*pick|signature:\s*pick|rawJson:\s*pick/);
  assert.doesNotMatch(app, /fetch\s*\(/i);
  assert.doesNotMatch(app, /axios/i);
  assert.doesNotMatch(app, /openLatestRelease|open_latest_release/);
  assert.doesNotMatch(bridge, /openLatestRelease|open_latest_release/);
});
