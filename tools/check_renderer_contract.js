#!/usr/bin/env node
/**
 * [INPUT]: renderer 静态 DOM、语义 token/图标表、Select/Tooltip/Path/Activity/Updater/Toast/About/Windows caption 状态机、UI Review fake bridge/动态目录、来源通知、窗口配置与冻结 bridge API。
 * [OUTPUT]: 守住 UI 单向依赖、固定窗口/Activity、原生标题栏、显式 Select 占位、无描边彩色 Badge、局部失败 Toast、必要 AlertDialog 与单任务流；工作台必须实时消费生产 renderer，禁止复制产品 DOM/CSS、魔法视觉常量、重复反馈和旧 Recovery 残留。
 * [POS]: renderer 的快速静态契约测试；只证明配置/source 形状，不虚称 packaged WebView CSP 执行。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {
  fixtureSource,
  renderReviewDocument,
  workspaceHtml,
} = require('./ui_review_server');
const {
  badgeCatalogHtml,
  feedbackCatalogHtml,
  iconCatalogHtml,
} = require('./ui_review_catalogs');

const repoRoot = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(repoRoot, relative), 'utf8');
const UI_LOCALE_MARKERS = ['  en: {', "  'zh-Hans': {", "  'zh-Hant': {", '  ja_JP: {'];
const UPDATE_ICON_PATH = 'M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216Zm37.66-101.66a8,8,0,0,1-11.32,11.32L136,107.31V168a8,8,0,0,1-16,0V107.31l-18.34,18.35a8,8,0,0,1-11.32-11.32l32-32a8,8,0,0,1,11.32,0Z';
const RESTORE_ICON_PATH = 'M208,32H83.31A15.86,15.86,0,0,0,72,36.69L36.69,72A15.86,15.86,0,0,0,32,83.31V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V48A16,16,0,0,0,208,32ZM88,48h80V80H88ZM208,208H48V83.31l24-24V80A16,16,0,0,0,88,96h80a16,16,0,0,0,16-16V48h24Zm-80-96a40,40,0,1,0,40,40A40,40,0,0,0,128,112Zm0,64a24,24,0,1,1,24-24A24,24,0,0,1,128,176Z';

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

function sourceFunction(source, signature, nextSignature) {
  const start = source.indexOf(signature);
  assert.notEqual(start, -1, `${signature} missing`);
  const end = source.indexOf(nextSignature, start + signature.length);
  assert.notEqual(end, -1, `${signature} boundary missing`);
  return source.slice(start, end);
}

function sourceStatement(source, marker) {
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `${marker} missing`);
  const end = source.indexOf(';', start + marker.length);
  assert.notEqual(end, -1, `${marker} terminator missing`);
  return source.slice(start, end + 1);
}

test('UI Review renders the exact production shell and replaces only the data bridge', () => {
  const production = read('renderer/index.html');
  const review = renderReviewDocument();
  const aboutProduction = read('renderer/about.html');
  const aboutReview = renderReviewDocument('about.html');
  const workspace = workspaceHtml();
  const fixture = fixtureSource();
  const normalized = review
    .replace('\n  <base href="/renderer/" />', '')
    .replace('<script src="/fixture.js"></script>\n  ', '');

  assert.equal(normalized, production, 'review app may inject a base and fixture bridge, but may not copy or edit production UI');
  assert.equal(
    aboutReview.replace('\n  <base href="/renderer/" />', '').replace('<script src="/fixture.js"></script>\n  ', ''),
    aboutProduction,
    'review About may inject a base and fixture bridge, but may not copy or edit production UI'
  );
  assert.match(review, /<script src="\/fixture\.js"><\/script>\s*<script src="\.\/tauri-bridge\.js"><\/script>/);
  assert.match(workspace, /<iframe id="reviewFrame"[^>]*><\/iframe>/);
  assert.match(workspace, /data-scenario="updateAvailable"[^>]*><span>更新可用 · Tooltip<\/span>/);
  for (const view of ['feedback', 'icons', 'badges']) {
    assert.match(workspace, new RegExp(`data-view="${view}"`));
    assert.match(workspace, new RegExp(`${view}: '/catalog/${view}'`));
  }
  assert.doesNotMatch(workspace, /id="(?:appVersion|currentLanguage|statusPanel|languageSelectRoot)"/);
  assert.doesNotMatch(workspace, /class="(?:badge|status-panel|toast)"/);
  assert.match(workspace, /fetch\('\/revision'/);
  assert.match(fixture, /window\.cavalryI18n = Object\.freeze/);
  assert.match(fixture, /\['updateAvailable', 'updateConfirm', 'update', 'updateFailure'\]\.includes\(scenario\)/);
  assert.match(fixture, /scenario === 'permissionMac' \? 'openPrivacy' : 'none'/);
  assert.match(fixture, /installationMode: windowsScenario[\s\S]*?\? 'unknown'/);
  assert.match(fixture, /\['verifyInstallation', 'ensureBaseline', 'applyTransaction', 'restartCavalry'\]/);
  assert.match(fixture, /onEvent\(\{ phase: 'downloading', downloaded, contentLength: total \}\)/);
  assert.doesNotMatch(fixture, /<main|<header|class="badge"|class="status-panel"/, 'fixture owns data only, never product markup');

  const feedbackCatalog = feedbackCatalogHtml();
  const iconCatalog = iconCatalogHtml();
  const badgeCatalog = badgeCatalogHtml();
  for (const catalog of [feedbackCatalog, iconCatalog, badgeCatalog]) {
    assert.match(catalog, /\/renderer\/tokens\.css/);
    assert.match(catalog, /\/renderer\/styles\.css/);
  }
  assert.match(feedbackCatalog, /\/renderer\/ui-text\.js/);
  assert.match(iconCatalog, /\/renderer\/icons\.js/);
  assert.match(badgeCatalog, /\/renderer\/ui-text\.js/);
  assert.doesNotMatch(iconCatalog, /<path\s+d=/, 'icon catalog must use the production icon factory rather than copied paths');
});

function cssRule(source, selector) {
  const start = source.indexOf(selector);
  assert.notEqual(start, -1, `${selector} rule missing`);
  const open = source.indexOf('{', start + selector.length);
  const close = source.indexOf('}', open + 1);
  assert.ok(open > start && close > open, `${selector} rule is incomplete`);
  return source.slice(start, close + 1);
}

const REQUIRED_IDS = [
  'skipLink', 'mainContent', 'windowTitle', 'appVersion', 'appPath', 'appPathPrefix', 'appPathLeaf', 'languageSectionLabel', 'currentLabel', 'currentLanguage', 'installationBadge',
  'updateControl', 'updateButton', 'updateTooltip', 'updateTooltipText', 'updateAnnouncement',
  'aboutControl', 'aboutButton', 'aboutTooltip', 'aboutTooltipText',
  'windowsWindowControls', 'windowMinimizeButton', 'windowMaximizeButton', 'windowCloseButton',
  'installationMode', 'switchToLabel', 'languageSelectRoot', 'languageSelect', 'languageSelectTrigger', 'languageSelectValue', 'languageSelectPopup', 'languageSelectList', 'browseButton', 'applyButton', 'restoreButton',
  'permissionButton', 'statusLabel', 'statusIdle', 'statusIntro', 'statusViewport', 'statusOutcome',
  'modalBackdrop', 'modalTitle', 'modalBody', 'modalPrimaryButton', 'modalSecondaryButton', 'statusText',
];

const REQUIRED_API_METHODS = [
  'getStatus', 'browseApp', 'applyLanguage', 'openPrivacySecurity',
  'openProjectLink', 'showAbout', 'getSwitcherVersion',
  'checkUpdate', 'installUpdate',
  'minimizeWindow', 'toggleMaximizeWindow', 'isWindowMaximized', 'closeWindow',
];

test('semantic icon registry is frozen, defensive, and returns independent accessible SVG nodes', () => {
  const createNode = () => ({
    attributes: new Map(), children: [],
    setAttribute(key, value) { this.attributes.set(key, String(value)); },
    append(...children) { this.children.push(...children); },
  });
  const window = {};
  vm.runInNewContext(read('renderer/icons.js'), {
    window,
    document: { createElementNS: createNode },
  });
  const first = window.cavalryIcons.create('verify');
  const second = window.cavalryIcons.create('verify');
  assert.equal(Object.isFrozen(window.cavalryIcons), true);
  assert.notEqual(first, second, 'each consumer must receive an independent SVG node');
  assert.deepEqual(Object.fromEntries(first.attributes), {
    viewBox: '0 0 256 256', 'aria-hidden': 'true', focusable: 'false', fill: 'currentColor',
  });
  assert.ok(first.children[0].attributes.get('d'));
  assert.equal(
    window.cavalryIcons.create('restore').children[0].attributes.get('d'),
    RESTORE_ICON_PATH,
    'Restore must use the pinned Phosphor Regular FloppyDiskBack path'
  );
  assert.equal(window.cavalryIcons.create('unknown'), null, 'unknown semantic names must fail closed');
});

test('Toast follows the pinned shadcn/Base UI timing while consuming local design tokens', () => {
  const tokens = read('renderer/tokens.css');
  const styles = read('renderer/toast.css');
  const control = read('renderer/toast-control.js');
  const app = read('renderer/app.js');
  const aboutWindow = read('renderer/about-window.js');

  assert.match(control, /const DEFAULT_TIMEOUT_MS = 5000;/);
  assert.match(control, /const DEFAULT_LIMIT = 3;/);
  assert.match(control, /record\.type === 'loading'/, 'loading Toast must not auto-dismiss');
  assert.match(control, /record\.remaining = Math\.max\(record\.remaining - \(now - record\.startedAt\), 0\)/);
  assert.match(control, /viewport\.addEventListener\('mouseenter',[\s\S]*?pauseTimers\(\)/);
  assert.match(control, /viewport\.addEventListener\('focusin',[\s\S]*?pauseTimers\(\)/);
  assert.match(control, /global\.addEventListener\('blur',[\s\S]*?pauseTimers\(\)/);
  assert.match(control, /event\.key !== 'F6'/);
  assert.match(control, /event\.key === 'Escape'/);
  assert.match(control, /while \(records\.length > limit\)/);

  assert.match(tokens, /--toast-viewport-inset:\s*var\(--space-4\)/, 'Toast keeps the approved 16px source inset');
  assert.match(tokens, /--toast-content-padding:\s*var\(--space-4\)/);
  assert.match(tokens, /--toast-content-gap:\s*var\(--space-3\)/);
  assert.match(tokens, /--toast-copy-gap:\s*var\(--space-1\)/);
  assert.match(tokens, /--duration-toast-transform:\s*500ms/);
  assert.match(tokens, /--duration-toast-content:\s*250ms/);
  assert.match(tokens, /--duration-toast-height:\s*150ms/);
  assert.match(styles, /right:\s*var\(--toast-viewport-inset\);[\s\S]*?bottom:\s*var\(--toast-viewport-inset\)/);
  assert.match(styles, /padding:\s*var\(--toast-content-padding\)/);
  assert.match(styles, /inset:\s*calc\(var\(--toast-close-hit-expansion\) \* -1\)/);
  assert.match(styles, /translateY\(var\(--toast-entry-distance\)\)/);

  assert.match(app, /onError:\s*\(\) => toastControl\.show\(/);
  assert.doesNotMatch(app, /onError:\s*\(\) => setStatus\('aboutOpenFailed'/, 'About failure must not overwrite Activity');
  assert.match(aboutWindow, /description:\s*text\(locale, 'openProjectLinkFailed'\)/);
});

test('renderer retains DOM anchors and uses only local resources', () => {
  const html = read('renderer/index.html');
  const tokens = read('renderer/tokens.css');
  const styles = read('renderer/styles.css');
  const operationStyles = read('renderer/operation-log.css');
  const toastStyles = read('renderer/toast.css');
  const toastControl = read('renderer/toast-control.js');
  const icons = read('renderer/icons.js');
  const operationLog = read('renderer/operation-log.js');
  const updateProgress = read('renderer/update-progress.js');
  const tooltipControl = read('renderer/tooltip-control.js');
  const thirdPartyNotices = read('renderer/THIRD_PARTY_NOTICES.md');
  const aboutStyles = read('renderer/about.css');
  const windowControlStyles = read('renderer/window-controls.css');
  const app = read('renderer/app.js');
  const uiText = read('renderer/ui-text.js');
  for (const id of REQUIRED_IDS) assert.match(html, new RegExp(`id="${id}"`), `#${id} missing`);
  assert.doesNotMatch(
    html,
    /id="(?:maintenanceHeading|extractButton|restoreEnglishButton)"/,
    'the single-task UI must not retain the old Recovery controls'
  );
  const htmlWithoutSvgNamespace = html.replace(/\s+xmlns="http:\/\/www\.w3\.org\/2000\/svg"/g, '');
  const implementationCss = `${styles}\n${operationStyles}\n${toastStyles}\n${aboutStyles}\n${windowControlStyles}`.replace(/\/\*[\s\S]*?\*\//g, '');
  const operationWithoutRuntimeState = operationStyles.replace(
    /--operation-(?:scroll-fade-(?:top|bottom)|shimmer-(?:base|highlight))\s*:[^;]+;/g,
    ''
  );
  const tunableImplementationCss = implementationCss
    .replace(/@property\s+--operation-scroll-fade-(?:top|bottom)\s*\{[\s\S]*?\}/g, '')
    .replace(/@keyframes\s+operation-scroll-fade-[^{]+\{[\s\S]*?\n\}/g, '');
  assert.doesNotMatch(htmlWithoutSvgNamespace, /https?:\/\//, 'renderer HTML must not load remote resources');
  assert.doesNotMatch(tokens, /@import|url\(["']?https?:/i, 'tokens must not load remote resources');
  assert.doesNotMatch(styles, /@import|url\([\"']?https?:/i, 'styles must not load remote resources');
  assert.doesNotMatch(operationStyles, /@import|url\([\"']?https?:/i, 'operation log styles must not load remote resources');
  assert.doesNotMatch(toastStyles, /@import|url\([\"']?https?:/i, 'Toast styles must not load remote resources');
  assert.doesNotMatch(icons, /@import|url\([\"']?https?:/i, 'icon registry must not load remote resources');
  assert.doesNotMatch(aboutStyles, /@import|url\([\"']?https?:/i, 'about styles must not load remote resources');
  assert.doesNotMatch(windowControlStyles, /@import|url\([\"']?https?:/i, 'window controls must not load remote resources');
  assert.match(thirdPartyNotices, /## shadcn\/ui[\s\S]*Licensed under the MIT License/);
  assert.match(thirdPartyNotices, /## Phosphor Icons[\s\S]*Licensed under the MIT License/);
  assert.match(
    html,
    /<link rel="stylesheet" href="\.\/tokens\.css" \/>\s*<link rel="stylesheet" href="\.\/styles\.css" \/>\s*<link rel="stylesheet" href="\.\/operation-log\.css" \/>\s*<link rel="stylesheet" href="\.\/toast\.css" \/>\s*<link rel="stylesheet" href="\.\/about\.css" \/>\s*<link rel="stylesheet" href="\.\/window-controls\.css" \/>/,
    'semantic tokens must load before shared and platform visual implementations'
  );
  assert.match(
    html,
    /<script src="\.\/tauri-bridge\.js"><\/script>\s*<script src="\.\/ui-text\.js"><\/script>\s*<script src="\.\/icons\.js"><\/script>\s*<script src="\.\/select-control\.js"><\/script>\s*<script src="\.\/tooltip-control\.js"><\/script>\s*<script src="\.\/path-display\.js"><\/script>\s*<script src="\.\/operation-log\.js"><\/script>\s*<script src="\.\/update-progress\.js"><\/script>\s*<script src="\.\/toast-control\.js"><\/script>\s*<script src="\.\/about-control\.js"><\/script>\s*<script src="\.\/window-controls\.js"><\/script>\s*<script src="\.\/app\.js"><\/script>/,
    'renderer scripts must load bridge, stable text, icons, component state machines, then app'
  );
  assert.match(icons, /window\.cavalryIcons = Object\.freeze\(\{ create: createIcon \}\)/);
  for (const iconName of ['spinner', 'checkCircle', 'warningCircle', 'infoCircle', 'errorCircle', 'verify', 'archive', 'translate', 'restore', 'restart', 'download', 'package', 'update', 'close']) {
    assert.match(icons, new RegExp(`\\b${iconName}: \\{`), `${iconName} must stay in the semantic icon registry`);
  }
  assert.doesNotMatch(operationLog, /const ICONS|createElementNS|<path/, 'operation log must consume icon names without owning SVG path data');
  assert.match(operationLog, /const createIcon = window\.cavalryIcons\.create;/);
  assert.match(uiText, /const UI_TEXT = \{/);
  assert.doesNotMatch(app, /const UI_TEXT = \{/);
  assert.doesNotMatch(`${tokens}\n${styles}`, /@font-face|Geist|assets\/fonts/, 'renderer must use the platform font stack');
  assert.match(tokens, /--font-sans:\s*-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif/);
  assert.match(tokens, /--font-mono:\s*ui-monospace, "SFMono-Regular", "Cascadia Mono", Consolas, monospace/);
  assert.doesNotMatch(styles, /--[a-z0-9-]+\s*:/i, 'shared implementation must consume tokens instead of defining private constants');
  assert.doesNotMatch(operationWithoutRuntimeState, /--[a-z0-9-]+\s*:/i, 'operation implementation may own runtime CSS state, but no private design constants');
  assert.doesNotMatch(toastStyles, /--[a-z0-9-]+\s*:/i, 'Toast implementation must consume tokens instead of defining private constants');
  assert.doesNotMatch(aboutStyles, /--[a-z0-9-]+\s*:/i, 'about implementation must consume tokens instead of defining private constants');
  assert.doesNotMatch(windowControlStyles, /--[a-z0-9-]+\s*:/i, 'platform implementation must consume tokens instead of defining private constants');
  assert.doesNotMatch(tunableImplementationCss, /#[0-9a-f]{3,8}|rgba?\(|[+-]?(?:\d+\.?\d*|\.\d+)(?:px|ms|em|deg)|:\s*(?:black|white)(?:\s|;|,)/i, 'implementation CSS must not own tunable design literals');
  const tokenDefinitions = [...tokens.matchAll(/(--[a-z0-9-]+)\s*:/gi)].map((match) => match[1]);
  const tokenReferences = `${tokens}\n${styles}\n${operationStyles}\n${toastStyles}\n${aboutStyles}\n${windowControlStyles}\n${tooltipControl}\n${operationLog}\n${toastControl}`;
  assert.deepEqual(
    tokenDefinitions.filter(
      (name) => !tokenReferences.includes(`var(${name})`) && !tokenReferences.includes(`'${name}'`)
    ),
    [],
    'semantic tokens must have a real consumer'
  );
  assert.equal(fs.existsSync(path.join(repoRoot, 'renderer/assets')), false, 'unused bundled font assets must stay removed');
  assert.ok(app.split(/\r?\n/).length <= 800, 'renderer/app.js must stay within the 800-line contract');
  assert.ok(updateProgress.split(/\r?\n/).length <= 800, 'renderer/update-progress.js must stay within the 800-line contract');
  assert.ok(tooltipControl.split(/\r?\n/).length <= 800, 'renderer/tooltip-control.js must stay within the 800-line contract');
  assert.ok(toastControl.split(/\r?\n/).length <= 800, 'renderer/toast-control.js must stay within the 800-line contract');
  assert.match(cssRule(styles, 'html,\nbody'), /overflow:\s*hidden;/, 'the window must not scroll as a whole');
  assert.match(cssRule(styles, '.content'), /overflow:\s*hidden;/, 'the main content must not scroll');
  const selectListRule = cssRule(styles, '.select-list');
  assert.match(selectListRule, /max-height:\s*var\(--select-popup-max-height\);/);
  assert.match(selectListRule, /overflow-y:\s*auto;/, 'the Select list must own its bounded scroll');
  assert.doesNotMatch(selectListRule, /overflow:\s*hidden;/, 'Select list scrolling must not be clipped');
  const statusPanelRule = cssRule(operationStyles, '.status-panel');
  const statusPanelWithPermissionRule = cssRule(
    operationStyles,
    '.status-panel:has(> .permission-button:not([hidden]))'
  );
  assert.match(statusPanelRule, /grid-template-rows:\s*minmax\(0,\s*1fr\);/);
  assert.match(statusPanelRule, /gap:\s*0;/, 'a hidden permission row must not retain a grid gap');
  assert.match(statusPanelWithPermissionRule, /grid-template-rows:\s*minmax\(0,\s*1fr\) auto;/);
  assert.match(statusPanelWithPermissionRule, /gap:\s*var\(--operation-group-gap\);/);
  assert.match(statusPanelRule, /padding:\s*var\(--padding-panel\);/);
  assert.match(statusPanelRule, /border:\s*var\(--stroke-hairline\) solid var\(--border\);/);
  assert.match(statusPanelRule, /border-radius:\s*var\(--radius-lg\);/);
  assert.match(cssRule(operationStyles, '.status-viewport'), /overflow-y:\s*auto;/, 'the task event viewport must own its bounded scroll');
});

test('update control preserves the supplied small icon and accessible tooltip contract', () => {
  const html = read('renderer/index.html');
  const tokens = read('renderer/tokens.css');
  const styles = read('renderer/styles.css');
  const operationStyles = read('renderer/operation-log.css');
  const icons = read('renderer/icons.js');
  const operationLog = read('renderer/operation-log.js');
  const aboutStyles = read('renderer/about.css');
  const windowControlStyles = read('renderer/window-controls.css');
  const app = read('renderer/app.js');
  const updateProgress = read('renderer/update-progress.js');
  const bridge = read('renderer/tauri-bridge.js');
  const selectControl = read('renderer/select-control.js');
  const tooltipControl = read('renderer/tooltip-control.js');
  const pathDisplay = read('renderer/path-display.js');
  const windowControls = read('renderer/window-controls.js');
  const aboutControl = read('renderer/about-control.js');
  const aboutPage = read('renderer/about.html');
  const aboutWindow = read('renderer/about-window.js');
  const updateButton = html.match(/<button id="updateButton"[\s\S]*?<\/button>/)?.[0];
  assert.ok(updateButton, '#updateButton block missing');
  assert.match(
    updateButton,
    /<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" width="18" height="18" fill="currentColor" viewBox="0 0 256 256" aria-hidden="true" focusable="false">/
  );
  assert.match(updateButton, /id="updateButton"[^>]*aria-label="[^"]+"/);
  assert.doesNotMatch(updateButton, /aria-describedby=/, 'closed Tooltip must not keep a stale accessible description');
  const pathMatch = updateButton.match(/<path d="([^"]+)"><\/path>/);
  assert.ok(pathMatch, 'update icon path missing');
  assert.equal(pathMatch[1], UPDATE_ICON_PATH, 'update icon path must remain exact');
  assert.match(html, /id="updateControl"[^>]*data-tooltip-state="closed"[^>]*hidden/);
  assert.match(html, /id="updateTooltip"[^>]*data-slot="tooltip-content"[^>]*role="tooltip"[^>]*aria-hidden="true"[\s\S]*?<div class="tooltip-arrow" data-slot="tooltip-arrow" aria-hidden="true"><\/div>/);
  assert.match(html, /id="updateAnnouncement"[^>]*role="status"[^>]*aria-live="polite"/);
  assert.match(styles, /\.update-button\s*\{[\s\S]*?background: transparent;[\s\S]*?color: var\(--tone-update\)/);
  assert.match(tokens, /--titlebar-native-control-size:\s*16px/);
  assert.match(tokens, /--update-icon-visual-size:\s*20px/);
  assert.match(tokens, /--titlebar-action-hit-size:\s*24px/);
  assert.match(html, /class="titlebar-copy"[\s\S]*?id="windowTitle"[\s\S]*?id="updateControl"[\s\S]*?<\/div>/);
  assert.match(styles, /\.update-button\s*\{[\s\S]*?width: var\(--titlebar-action-hit-size\);[\s\S]*?height: var\(--titlebar-action-hit-size\);[\s\S]*?border-radius: var\(--radius-circle\)/);
  assert.match(styles, /\.update-button svg\s*\{[\s\S]*?width: var\(--update-icon-visual-size\);[\s\S]*?height: var\(--update-icon-visual-size\)/);
  assert.doesNotMatch(styles, /--update-icon-path-scale|\.update-button svg path\s*\{[\s\S]*?transform:/);
  assert.match(styles, /body\[data-platform="windows"\] \.native-controls-space\s*\{[\s\S]*?display:\s*none/);
  const updateHoverBlock = styles.match(/\.update-button:hover:not\(:disabled\)\s*\{([^}]*)\}/)?.[1];
  assert.ok(updateHoverBlock, 'update hover state missing');
  assert.doesNotMatch(updateHoverBlock, /translateY/);
  assert.match(styles, /\.tooltip\[data-state="open"\]/);
  assert.match(styles, /\.tooltip\s*\{[\s\S]*?visibility: hidden/);
  assert.match(styles, /\.tooltip\s*\{[\s\S]*?position:\s*fixed;[\s\S]*?padding:\s*var\(--tooltip-padding-block\) var\(--tooltip-padding-inline\)/);
  const tooltipArrowRule = cssRule(styles, '.tooltip-arrow');
  assert.match(tooltipArrowRule, /left:\s*var\(--tooltip-arrow-inline\)/);
  assert.match(tooltipArrowRule, /top:\s*var\(--tooltip-arrow-bottom-inset\)/);
  assert.match(tooltipArrowRule, /width:\s*var\(--tooltip-arrow-size\)/);
  assert.match(tooltipControl, /document\.body\.append\(popup\)/, 'Tooltip popup must use a body portal');
  assert.match(tooltipControl, /event\.pointerType !== 'touch'/, 'touch must not synthesize a Tooltip');
  assert.match(tooltipControl, /trigger\.setAttribute\('aria-describedby', descriptionId\)/);
  assert.match(tooltipControl, /trigger\.removeAttribute\('aria-describedby'\)/);
  assert.match(tooltipControl, /side === 'bottom'/);
  assert.match(tooltipControl, /Math\.min\([\s\S]*?Math\.max\(idealLeft, collisionPadding\)/, 'Tooltip must shift inside the viewport');
  assert.match(pathDisplay, /Math\.max\(path\.lastIndexOf\('\/'\), path\.lastIndexOf\('\\\\'\)\)/);
  assert.match(pathDisplay, /leaf:\s*path\.slice\(slash\)/, 'path display must preserve the final separator and leaf');
  assert.match(styles, /\.app-path-prefix\s*\{[\s\S]*?text-overflow:\s*ellipsis/);
  assert.match(styles, /\.app-path-leaf\s*\{[\s\S]*?flex:\s*0 0 auto/);
  assert.doesNotMatch(styles, /transition:\s*all/);
  assert.doesNotMatch(styles, /grain|@keyframes\s+fade-up/);
  assert.match(styles, /:where\(button:not\(\.select-trigger\)\):focus-visible\s*\{/);
  const selectFocusBlock = styles.match(/\.select-trigger:focus-visible\s*\{([^}]*)\}/)?.[1];
  assert.ok(selectFocusBlock, 'select focus state missing');
  assert.match(selectFocusBlock, /border-color:[\s\S]*?background:/);
  assert.doesNotMatch(selectFocusBlock, /outline:|box-shadow:/, 'select must not draw a focus ring');
  assert.match(
    styles,
    /\.select-popup\s*\{[\s\S]*?top:\s*calc\(100% \+ var\(--select-popup-offset\)\)/,
    'an empty Select must open below its Trigger'
  );
  assert.match(selectControl, /if \(selected >= 0\) alignPopupToSelectedItem\(selected\)/);
  assert.doesNotMatch(
    selectControl,
    /alignPopupToSelectedItem\(selected >= 0 \? selected : activeIndex\)/,
    'pointer movement must not reposition an unselected popup'
  );
  const modalPrimaryFocusBlock = styles.match(/\.modal-actions \.button-primary:focus-visible\s*\{([^}]*)\}/)?.[1];
  assert.ok(modalPrimaryFocusBlock, 'AlertDialog primary focus override missing');
  assert.match(modalPrimaryFocusBlock, /outline:\s*none/);
  assert.match(modalPrimaryFocusBlock, /outline-offset:\s*0/);
  assert.match(styles, /:where\(button:not\(\.select-trigger\)\):focus-visible\s*\{/);
  assert.match(app, /modalBackdrop\.showModal\(\);\s*modalPrimaryButton\.focus\(\)/);
  assert.match(app, /modalBackdrop\.addEventListener\('close', finalizeModalClose\)/);
  assert.match(app, /modalBackdrop\.addEventListener\('cancel', \(event\) => event\.preventDefault\(\)\)/);
  assert.match(app, /const returnFocus = modalReturnFocus;[\s\S]*?returnFocus\.focus\(\)/);
  assert.match(html, /<section class="language-section" aria-labelledby="languageSectionLabel">/);
  assert.match(html, /id="languageSelectTrigger"[^>]*role="combobox"[^>]*aria-haspopup="listbox"[^>]*aria-expanded="false"/);
  assert.match(html, /id="languageSelectValue"[^>]*data-placeholder="true"[^>]*>Choose a language<\/span>/);
  assert.match(html, /class="select-chevron"[^>]*>[\s\S]*?<svg[^>]*viewBox="0 0 24 24"[\s\S]*?<path d="m6 9 6 6 6-6"><\/path>/);
  assert.match(html, /id="languageSelectList"[^>]*role="listbox"/);
  assert.match(html, /class="language-control-row"[\s\S]*?id="applyButton"[^>]*>Switch<\/button>[\s\S]*?id="restoreButton"[^>]*>Restore English<\/button>/);
  assert.match(html, /<dialog id="modalBackdrop"[^>]*role="alertdialog"[^>]*aria-modal="true"[^>]*aria-labelledby="modalTitle"[^>]*aria-describedby="modalBody">/);
  assert.match(html, /id="statusPanel"[^>]*aria-labelledby="statusLabel"/);
  assert.match(html, /id="statusLabel"[\s\S]*?id="statusIdle"[\s\S]*?id="statusIntro"[^>]*hidden[\s\S]*?id="statusViewport"[\s\S]*?id="statusText"[^>]*role="log"[^>]*aria-live="polite"[\s\S]*?id="statusOutcome"[^>]*role="status"[^>]*aria-live="polite"[^>]*hidden[\s\S]*?id="permissionButton"/, 'idle, fixed intro, bounded live log, fixed outcome, and recovery action must remain in source order');
  assert.match(tokens, /--control-height:\s*36px/);
  assert.match(tokens, /--space-5:\s*20px/);
  assert.match(tokens, /--padding-window:\s*var\(--space-5\)/);
  assert.match(tokens, /--gap-section:\s*var\(--space-4\)/);
  assert.match(tokens, /--line-height-heading:\s*24px/);
  assert.match(tokens, /--line-height-metadata:\s*18px/);
  assert.match(tokens, /--line-height-label:\s*16px/);
  assert.match(tokens, /--gap-meta-stack:\s*var\(--space-1\)/);
  assert.match(tokens, /--badge-height:\s*20px/);
  assert.match(tokens, /--badge-padding-inline:\s*var\(--space-2\)/);
  assert.match(tokens, /--radius-pill:\s*999px/);
  assert.match(tokens, /--radius-select-trigger:\s*8px/);
  assert.match(tokens, /--radius-select-popup:\s*8px/);
  assert.match(tokens, /--radius-select-item:\s*6px/);
  assert.match(tokens, /--select-chevron-size:\s*16px/);
  assert.match(tokens, /--select-item-height:\s*28px/);
  assert.match(tokens, /--select-item-padding-leading:\s*var\(--space-2\)/);
  assert.match(tokens, /--select-item-padding-trailing:\s*var\(--space-8\)/);
  assert.match(tokens, /--select-popup-offset:\s*var\(--space-1\)/);
  assert.match(tokens, /--select-indicator-size:\s*16px/);
  assert.match(styles, /\.select-popup\s*\{[\s\S]*?border:\s*0;[\s\S]*?border-radius:\s*var\(--radius-select-popup\)[\s\S]*?box-shadow:\s*var\(--shadow-select-popup\)/);
  assert.match(selectControl, /function alignPopupToSelectedItem\(selected\)[\s\S]*?getBoundingClientRect\(\)[\s\S]*?alignedTop/);
  assert.match(selectControl, /root\.dataset\.placeholder = String\(!hasSelection\)/);
  assert.match(selectControl, /select\.value = options\.some\([\s\S]*?\? previousValue : '';/);
  assert.doesNotMatch(html, /id="about(?:Dialog|Title|Version|CloseButton|RepositoryLink|RepositoryLabel|LicenseLink|LicenseLabel)"/, 'About content must not remain in the main window');
  assert.match(html, /id="aboutControl"[^>]*data-tooltip-state="closed"[^>]*hidden/);
  assert.match(aboutControl, /createAboutControl/);
  assert.match(aboutControl, /api\.showAbout\(\)/);
  assert.match(aboutControl, /control\.hidden = platform !== 'windows'/);
  assert.doesNotMatch(aboutControl, /https?:\/\//, 'About entry must not own an external URL');
  assert.match(aboutPage, /<link rel="stylesheet" href="\.\/toast\.css" \/>/);
  assert.match(aboutPage, /<script src="\.\/icons\.js"><\/script>\s*<script src="\.\/toast-control\.js"><\/script>\s*<script src="\.\/about-window\.js"><\/script>/);
  assert.match(aboutPage, /<img class="about-app-icon" src="\.\/app-icon\.png" alt="" aria-hidden="true" \/>/);
  assert.match(aboutPage, /id="aboutRepositoryLink"[\s\S]*?class="about-link-icon"[\s\S]*?id="aboutRepositoryLabel"/);
  assert.match(aboutWindow, /getSwitcherVersion\(\)/);
  assert.match(aboutWindow, /openProjectLink\(link\)/);
  assert.match(aboutWindow, /wireProjectLink\('#aboutRepositoryLink', 'repository', showProjectLinkError\)/);
  assert.match(aboutWindow, /wireProjectLink\('#aboutLicenseLink', 'license', showProjectLinkError\)/);
  assert.match(aboutWindow, /createToastControl/);
  assert.match(aboutWindow, /projectLinkFailedTitle/);
  assert.doesNotMatch(aboutWindow, /showAbout/);
  assert.doesNotMatch(aboutPage, /https?:\/\//, 'About page must use fixed bridge ids, not renderer URLs');
  assert.match(bridge, /PROJECT_LINK_MANIFEST = Object\.freeze\(\['repository', 'license'\]\)/);
  assert.match(bridge, /invoke\('open_project_link', \{ link \}\)/);
  assert.match(bridge, /showAbout:\s*\(\) => invoke\('show_about'\)\.then\(normalizeAction\)/);
  assert.match(bridge, /invoke\('plugin:app\|version'\)/);
  assert.doesNotMatch(bridge, /openProjectLink:\s*\(url\)/, 'bridge must expose a fixed link id, never a renderer URL');
  assert.match(tokens, /--about-app-icon-size:\s*64px/);
  assert.match(tokens, /--about-link-icon-size:\s*16px/);
  assert.doesNotMatch(aboutStyles, /\.about-(?:dialog|close)\b/);
  assert.match(aboutStyles, /\.about-window\s*\{[\s\S]*?padding:\s*var\(--padding-window\)[\s\S]*?overflow:\s*hidden/);
  assert.match(aboutStyles, /\.about-app-icon\s*\{[\s\S]*?width:\s*var\(--about-app-icon-size\)[\s\S]*?height:\s*var\(--about-app-icon-size\)/);
  assert.deepEqual(
    fs.readFileSync(path.join(repoRoot, 'renderer/app-icon.png')),
    fs.readFileSync(path.join(repoRoot, 'src-tauri/icons/128x128.png')),
    'About must reuse the packaged application icon projection exactly'
  );
  assert.equal(fs.existsSync(path.join(repoRoot, 'renderer/about-dialog.js')), false, 'the old in-window About controller must stay deleted');
  for (const token of [
    '--type-heading: 16px',
    '--type-compact: 14px',
    '--type-label: 13px',
    '--type-metadata: 13px',
    '--weight-regular: 400',
    '--weight-heading: 450',
    '--weight-medium: 500',
  ]) {
    assert.ok(tokens.includes(token), `missing renderer type role: ${token}`);
  }
  for (const token of [
    '--space-1: 4px',
    '--space-2: 8px',
    '--space-3: 12px',
    '--space-4: 16px',
    '--space-5: 20px',
    '--space-6: 24px',
    '--space-8: 32px',
    '--space-16: 64px',
  ]) {
    assert.ok(tokens.includes(token), `missing renderer spacing role: ${token}`);
  }
  assert.match(tokens, /--titlebar-native-gap:\s*var\(--space-2\)/);
  assert.match(tokens, /--titlebar-native-control-size:\s*16px/);
  assert.match(tokens, /--titlebar-text-optical-offset:\s*-1px/);
  assert.match(tokens, /--titlebar-native-controls-width:\s*var\(--space-16\)/);
  assert.match(tokens, /--titlebar-block-padding:\s*var\(--space-3\)/);
  assert.match(tokens, /--titlebar-height:\s*calc\(var\(--titlebar-native-control-size\) \+ var\(--titlebar-block-padding\) \+ var\(--titlebar-block-padding\)\)/);
  assert.match(tokens, /--padding-panel:\s*var\(--space-3\)/);
  assert.match(tokens, /--radius-lg:\s*10px/);
  assert.match(tokens, /--padding-control-inline:\s*var\(--space-3\)/);
  assert.match(styles, /\.titlebar\s*\{[\s\S]*?padding:\s*0 var\(--padding-panel\)/);
  assert.match(styles, /\.window-title\s*\{[\s\S]*?font-size:\s*var\(--type-heading\)[\s\S]*?font-weight:\s*var\(--weight-heading\)[\s\S]*?line-height:\s*var\(--line-height-heading\)/);
  assert.match(styles, /\.content\s*\{[\s\S]*?padding:\s*var\(--padding-window\)/);
  assert.match(styles, /\.content\s*\{[\s\S]*?display:\s*grid;[\s\S]*?grid-template-rows:\s*auto auto minmax\(0,\s*1fr\);[\s\S]*?align-content:\s*start/);
  assert.match(styles, /\.content\s*>\s*section:first-child\s*\{[\s\S]*?margin-bottom:\s*var\(--gap-flow\)/);
  assert.match(styles, /\.language-section\s*\{[\s\S]*?display:\s*grid;[\s\S]*?gap:\s*var\(--section-heading-control-gap\)/);
  assert.match(tokens, /--section-heading-control-gap:\s*var\(--space-2\)/);
  assert.match(tokens, /--dialog-width:\s*320px/);
  assert.match(tokens, /--dialog-header-gap:\s*var\(--space-2\)/);
  assert.match(tokens, /--dialog-content-gap:\s*var\(--space-4\)/);
  assert.match(cssRule(styles, '.modal-backdrop'), /position:\s*fixed;[\s\S]*?inset:\s*var\(--titlebar-height\) 0 0;[\s\S]*?height:\s*auto;/);
  assert.doesNotMatch(cssRule(styles, '.modal-backdrop'), /height:\s*100%/, 'AlertDialog must preserve the desktop titlebar identity layer');
  assert.match(styles, /\.modal-title\s*\{[\s\S]*?font-size:\s*var\(--type-heading\)[\s\S]*?font-weight:\s*var\(--weight-medium\)[\s\S]*?line-height:\s*var\(--line-height-heading\)/);
  assert.match(styles, /\.modal-body\s*\{[\s\S]*?font-size:\s*var\(--type-compact\)[\s\S]*?font-weight:\s*var\(--weight-regular\)[\s\S]*?line-height:\s*var\(--line-height-compact\)[\s\S]*?text-wrap:\s*wrap;[\s\S]*?white-space:\s*pre-line/);
  assert.doesNotMatch(styles, /\.modal-body\s*\{[\s\S]*?text-wrap:\s*balance/, 'AlertDialog prose must preserve natural wrapping');
  assert.match(styles, /\.language-control-row\s*\{[\s\S]*?gap:\s*var\(--gap-flow\)/);
  assert.match(operationStyles, /\.status-panel\s*\{[\s\S]*?min-height:\s*var\(--operation-panel-min-height\);[\s\S]*?margin-top:\s*var\(--gap-flow\)/);
  assert.doesNotMatch(operationStyles, /\.status-label\s*\{/, 'the generic task heading must not be visible');
  assert.match(operationStyles, /\.operation-event-title\s*\{[\s\S]*?font-size:\s*var\(--type-compact\)[\s\S]*?line-height:\s*var\(--line-height-compact\)/);
  assert.doesNotMatch(tokens, /--alert-(?:height|icon|padding|column|copy)/);
  assert.match(tokens, /--operation-marker-size:\s*var\(--space-4\)/);
  assert.match(tokens, /--operation-panel-min-height:\s*176px/);
  assert.match(tokens, /--operation-marker-gap:\s*var\(--space-2\)/);
  assert.match(tokens, /--operation-scrollbar-size:\s*10px/);
  assert.match(tokens, /--operation-marker-description-offset:\s*2px/);
  assert.match(tokens, /--operation-scroll-fade-none:\s*0px/);
  assert.match(tokens, /--operation-scroll-fade-size:\s*var\(--space-2\)/);
  assert.match(tokens, /--duration-message-delta:\s*40ms/);
  assert.match(tokens, /--operation-live-edge-tolerance:\s*var\(--space-1\)/);
  assert.match(tokens, /--operation-scroll-edge-tolerance:\s*var\(--stroke-hairline\)/);
  assert.doesNotMatch(tokens, /--operation-scroll-fade-reveal:/);
  assert.match(tokens, /--operation-shimmer-angle:\s*20deg/);
  assert.match(tokens, /--operation-shimmer-spread:\s*calc\(3ch \+ var\(--space-1\) \* 10\)/);
  assert.match(tokens, /--operation-shimmer-highlight-alpha:\s*0\.2/);
  assert.doesNotMatch(styles, /\.separator\s*\{/);
  assert.doesNotMatch(html, /class="separator"/, 'business sections must use spacing rather than decorative dividers');
  assert.doesNotMatch(styles, /text-box-trim/, 'cross-platform layout must not depend on experimental glyph-box trimming');
  assert.doesNotMatch(styles, /\.installation-heading\s*\{[^}]*min-height:/, 'installation typography must size its parent without a duplicate height constraint');
  assert.match(styles, /\.installation-name\s*\{[\s\S]*?line-height:\s*var\(--line-height-compact\)/);
  assert.match(styles, /\.skip-link,\s*\.tooltip,\s*\.app-path\s*\{[\s\S]*?font-size:\s*var\(--type-metadata\)[\s\S]*?font-weight:\s*var\(--weight-regular\)[\s\S]*?line-height:\s*var\(--line-height-metadata\)[\s\S]*?font-synthesis:\s*none/);
  assert.match(styles, /\.badge\s*\{[\s\S]*?font-size:\s*var\(--type-label\)[\s\S]*?font-weight:\s*var\(--weight-heading\)[\s\S]*?line-height:\s*var\(--line-height-label\)/);
  assert.match(styles, /\.app-path\s*\{[\s\S]*?margin:\s*var\(--gap-meta-stack\)\s+0\s+0/);
  assert.match(styles, /\.badge\s*\{[\s\S]*?min-height:\s*var\(--badge-height\)[\s\S]*?padding:\s*0 var\(--badge-padding-inline\)[\s\S]*?border-radius:\s*var\(--radius-pill\)/);
  assert.match(tokens, /--badge-language-bg:\s*#edf6ff/);
  assert.match(tokens, /--badge-language-text:\s*#0068d6/);
  assert.match(tokens, /--badge-green-bg:\s*#edf9f0/);
  assert.doesNotMatch(tokens, /--badge-(?:language|green)-border:/, 'filled semantic badges must not own a visible outline token');
  assert.match(styles, /\.badge\[data-kind="language"\]\s*\{[\s\S]*?border-color:\s*transparent;[\s\S]*?background:\s*var\(--badge-language-bg\)[\s\S]*?color:\s*var\(--badge-language-text\)/);
  assert.match(styles, /\.badge\[data-state="official"\]\s*\{[\s\S]*?border-color:\s*transparent;[\s\S]*?background:\s*var\(--badge-green-bg\)[\s\S]*?color:\s*var\(--badge-green-text\)/);
  assert.doesNotMatch(styles, /\.badge\[data-state="(?:translated|modified)"\]/);
  assert.match(cssRule(styles, '.installation-item'), /display:\s*flex;[\s\S]*?padding:\s*var\(--padding-panel\)/);
  assert.doesNotMatch(cssRule(styles, '.installation-item'), /grid-template-columns:/, 'an optional folder action must not leave an empty grid track');
  assert.match(html, /id="browseButton"[^>]*disabled hidden/);
  assert.match(app, /function installationSelectionIsRequired\(\)\s*\{\s*return !state\.appPath;\s*\}/);
  assert.match(app, /function syncInstallationSelection\(\)\s*\{[\s\S]*?browseButton\.hidden = !installationSelectionIsRequired\(\)/);
  assert.match(app, /syncInstallationBadges\(\);\s*syncInstallationSelection\(\);\s*state\.ready = true/);
  assert.match(operationStyles, /\.status-task-shell\s*\{[\s\S]*?grid-template-rows:\s*minmax\(0, 1fr\)/);
  assert.match(operationStyles, /\.status-panel\[data-mode="running"\] \.status-task-shell\s*\{[\s\S]*?grid-template-rows:\s*auto minmax\(0, 1fr\)/);
  assert.match(operationStyles, /\.status-panel\[data-mode="running"\]\[data-has-outcome="true"\] \.status-task-shell\s*\{[\s\S]*?grid-template-rows:\s*auto minmax\(0, 1fr\) auto/);
  assert.match(operationStyles, /\.status-idle-message\s*\{[\s\S]*?place-items:\s*center/);
  assert.match(operationStyles, /\.status-message\s*\{[\s\S]*?font-size:\s*var\(--type-compact\)/);
  assert.match(operationStyles, /\.status-viewport\s*\{[\s\S]*?overflow-y:\s*auto/);
  assert.match(operationStyles, /\.status-viewport\[data-overflowing="true"\][\s\S]*?mask-image:\s*linear-gradient/);
  assert.match(operationStyles, /\.status-viewport\[data-overflowing="true"\]\[data-at-start="true"\]\s*\{[\s\S]*?--operation-scroll-fade-top:\s*var\(--operation-scroll-fade-none\)/);
  assert.match(operationStyles, /\.status-viewport\[data-overflowing="true"\]\[data-at-end="true"\]\s*\{[\s\S]*?--operation-scroll-fade-bottom:\s*var\(--operation-scroll-fade-none\)/);
  assert.doesNotMatch(operationStyles, /animation-timeline:\s*scroll\(self y\)/);
  assert.match(operationStyles, /\.status-text\s*\{[\s\S]*?display:\s*flex;[\s\S]*?flex-direction:\s*column/);
  assert.doesNotMatch(operationStyles, /\.operation-event:first-child\s*\{[\s\S]*?margin-top:\s*auto/, 'short event streams must begin at the padded top edge');
  assert.doesNotMatch(operationStyles, /data-variant="separator"/, 'the approved idle and task intro replace decorative separators');
  assert.match(operationStyles, /\.operation-event\s*\{[\s\S]*?display:\s*flex;[\s\S]*?align-items:\s*center;[\s\S]*?gap:\s*var\(--operation-marker-gap\)[\s\S]*?color:\s*var\(--text-secondary\)/);
  assert.match(operationStyles, /\.operation-event-marker\s*\{[\s\S]*?width:\s*var\(--operation-marker-size\);[\s\S]*?height:\s*var\(--operation-marker-size\)/);
  assert.doesNotMatch(operationStyles, /\.operation-event\[data-state="(?:completed|warning|error)"\] \.operation-event-marker\s*\{[\s\S]*?color:/, 'Marker icons must stay monochrome instead of becoming status badges');
  assert.match(operationStyles, /\.operation-event-title\s*\{[\s\S]*?color:\s*inherit;[\s\S]*?font-weight:\s*var\(--weight-regular\)/);
  assert.match(operationStyles, /\.operation-event\[data-state="running"\] \.operation-event-marker\[data-icon="spinner"\] svg\s*\{[\s\S]*?animation:\s*operation-spin/);
  assert.match(operationStyles, /\.operation-event\[data-state="running"\] \.operation-event-title\s*\{[\s\S]*?oklch\([\s\S]*?from currentColor l c h \/ calc\(alpha \* var\(--operation-shimmer-highlight-alpha\)\)[\s\S]*?background-image:\s*linear-gradient[\s\S]*?background-position:\s*0 0[\s\S]*?animation:\s*operation-shimmer/);
  assert.match(operationStyles, /@keyframes operation-shimmer\s*\{[\s\S]*?from\s*\{\s*background-position:\s*100% 0;\s*\}[\s\S]*?to\s*\{\s*background-position:\s*0 0;\s*\}/);
  assert.match(operationLog, /DEFAULT_ICON_BY_STATE[\s\S]*?running:\s*'spinner'/);
  assert.match(icons, /const ICONS = Object\.freeze\(\{/);
  assert.match(operationLog, /const remaining = viewport\.scrollHeight - viewport\.clientHeight - viewport\.scrollTop;[\s\S]*?followLiveEdge = remaining <= cssNumber\('--operation-live-edge-tolerance'\)/);
  assert.match(operationLog, /function syncScrollFade\(\)[\s\S]*?viewport\.dataset\.atStart[\s\S]*?viewport\.dataset\.atEnd/);
  assert.match(operationLog, /String\(text \|\| ''\)\.match\(\/\\S\+\\s\*\/g\)/);
  assert.match(operationLog, /motionDuration\('--duration-message-delta'\)/);
  assert.match(operationLog, /motionDuration\('--duration-operation-running-min'\)/);
  assert.match(operationLog, /motionDuration\('--duration-operation-step-gap'\)/);
  assert.match(operationLog, /cancelVisualQueue\(\{ flushEvents: true \}\);[\s\S]*?renderEvent\(event\)/);
  assert.match(operationStyles, /\.operation-event\s*\{[\s\S]*?animation:\s*operation-marker-enter var\(--duration-feedback\) ease-out both/);
  assert.match(tokens, /--duration-operation-running-min:\s*360ms/);
  assert.match(tokens, /--duration-operation-step-gap:\s*var\(--duration-feedback\)/);
  assert.match(operationLog, /cssNumber\('--operation-live-edge-tolerance'\)/);
  assert.match(app, /verifyInstallation:\s*'verify'[\s\S]*?ensureBaseline:\s*'archive'[\s\S]*?applyTransaction:\s*'translate'[\s\S]*?restartCavalry:\s*'restart'/);
  assert.match(app, /restoring && phase === 'applyTransaction' \? 'restore' : PHASE_ICONS\[phase\]/);
  assert.match(updateProgress, /updateDownloadCompletedTitle[\s\S]*?icon:\s*'download'/);
  assert.match(updateProgress, /updateInstallCompletedTitle[\s\S]*?icon:\s*'package'/);
  assert.match(app, /key === 'updatePreviewAvailable'/);
  assert.match(html, /class="titlebar" data-tauri-drag-region/);
  assert.doesNotMatch(html, /traffic-light/, 'macOS traffic lights must remain native');
  assert.match(html, /id="windowsWindowControls"[^>]*data-maximized="false"[^>]*hidden/);
  assert.match(html, /id="windowMinimizeButton"[^>]*class="window-control-button"/);
  assert.match(html, /id="windowMaximizeButton"[^>]*class="window-control-button"/);
  assert.match(html, /id="windowCloseButton"[^>]*class="window-control-button window-control-close"/);
  assert.match(windowControls, /platform === 'windows'/);
  assert.match(windowControls, /api\.isWindowMaximized\(\)/);
  assert.match(windowControlStyles, /height:\s*var\(--titlebar-height\)/);
  assert.match(windowControlStyles, /background:\s*var\(--surface-hover\)/);
  assert.match(windowControlStyles, /background:\s*var\(--danger\)/);
  assert.doesNotMatch(windowControlStyles, /--windows-caption-(?:hover|active|close)/);
  assert.equal((html.match(/class="window-control-button(?: window-control-close)?"/g) || []).length, 3, 'Windows caption must have exactly three buttons');
  assert.match(tokens, /--windows-caption-button-width:\s*32px/);
  assert.match(windowControlStyles, /\.window-control-button\s*\{[\s\S]*?width:\s*var\(--windows-caption-button-width\)/);
  assert.match(styles, /\.titlebar\s*\{[\s\S]*?display:\s*flex/);
  assert.match(styles, /\.titlebar\s*\{[\s\S]*?align-items:\s*center/);
  assert.match(styles, /\.titlebar\s*\{[\s\S]*?border-bottom:\s*0;[\s\S]*?box-shadow:\s*var\(--shadow-titlebar-divider\)/);
  assert.match(styles, /\.titlebar-copy\s*\{[\s\S]*?align-items:\s*center/);
  assert.match(styles, /\.titlebar-copy\s*\{[\s\S]*?gap:\s*var\(--gap-inline\)/);
  assert.match(styles, /\.window-title\s*\{[\s\S]*?transform:\s*translateY\(var\(--titlebar-text-optical-offset\)\)/);
  assert.match(styles, /\.content\s*\{[\s\S]*?display:\s*grid;[\s\S]*?grid-template-rows:\s*auto auto minmax\(0,\s*1fr\)/);
  assert.match(styles, /\.tooltip-anchor\s*\{[\s\S]*?display:\s*inline-flex;[\s\S]*?align-items:\s*center/);
  assert.match(styles, /\.tooltip-anchor\s*\{[\s\S]*?pointer-events:\s*auto/, 'update control must remain interactive inside non-interactive title copy');
  assert.match(styles, /\.installation-item\s*\{[\s\S]*?display:\s*flex/);
  assert.match(styles, /\.language-control-row\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2/);
  assert.match(styles, /\.select-root\s*\{[\s\S]*?grid-column:\s*1\s*\/\s*-1/);
  assert.match(cssRule(styles, '.content'), /overflow:\s*hidden/);
  assert.match(cssRule(styles, '.select-list'), /overflow-y:\s*auto/);
  assert.match(operationStyles, /\.status-panel\[data-mode="running"\] \.status-task-shell/);
  assert.match(app, /document\.body\.dataset\.platform = state\.platform/);
  assert.match(app, /window\.createTooltipControl/);
  assert.doesNotMatch(app, /updateControl\.addEventListener\('(?:mouseenter|focusin)'/);
  assert.match(app, /state\.ready = false;[\s\S]*?setBusy\(state\.busy\);[\s\S]*?await api\.getStatus\(\)/);
});

test('renderer builds language options safely and bridge API is frozen/minimal', () => {
  const html = read('renderer/index.html');
  const app = read('renderer/app.js');
  const uiText = read('renderer/ui-text.js');
  const selectControl = read('renderer/select-control.js');
  const bridge = read('renderer/tauri-bridge.js');
  assert.doesNotMatch(app, /\.innerHTML\s*=/, 'renderer must not interpolate backend data as HTML');
  assert.match(selectControl, /document\.createElement\('option'\)/);
  assert.match(selectControl, /nativeOption\.textContent\s*=/);
  assert.match(selectControl, /createElementNS\('http:\/\/www\.w3\.org\/2000\/svg', 'svg'\)/);
  assert.match(selectControl, /path\.setAttribute\('d', 'm20 6-11 11-5-5'\)/);
  assert.match(app, /languages\.filter\(\(language\) => language\.value !== 'en'\)/);
  const restoreConfirmationFunction = sourceFunction(
    app,
    'function showRestoreConfirmation() {',
    'function showPermissionWait'
  );
  assert.match(
    restoreConfirmationFunction,
    /const restoreAction = state\.platform === 'macos' \? 'restore-official' : 'en';/
  );
  assert.match(app, /restoreButton\.addEventListener\('click', requestRestore\)/);
  const requestApplyFunction = sourceFunction(app, 'function requestApply() {', 'function requestRestore');
  assert.match(requestApplyFunction, /void runApply\(languageSelect\.value\)\.catch\(recoverOperationFailure\);/);
  assert.doesNotMatch(app, /showApplyConfirmation|t\('confirmTitle'\)|t\('confirmBody'\)/);
  for (const body of uiLocaleBodies(uiText)) {
    assert.match(body, /apply: '(?:Switch|切换|切換|切り替える)'/);
    assert.doesNotMatch(body, /confirmTitle:|confirmBody:|continue:/);
  }
  assert.doesNotMatch(app, /maintenanceHeading|extractButton|restoreEnglishButton|refreshEnglish/);
  assert.match(app, /statusLabel\.textContent = t\('taskProgressLabel'\)/);
  assert.match(app, /operationLog\.start\(\{[\s\S]*?restoreIntro[\s\S]*?applyIntro/);
  assert.match(app, /operationLog\.complete\(\s*t\(restoring \? 'restoreOutcome' : 'applyOutcome'/);
  assert.match(app, /operationLog\.idle\(\)/);
  assert.match(app, /operationLog\.replace\(\{/);
  assert.match(app, /operationLog\.upsert\(operationPhaseCopy\(event, context\)\)/);
  assert.match(app, /visualState === 'official'/);
  assert.match(app, /installationBadge\.dataset\.state = showInstallation \? 'official' : 'unknown'/);
  assert.doesNotMatch(app, /translatedBadge|modifiedBadge|installationBadgeState/);
  assert.match(app, /return code === 'en' \? 'English' : code/);
  assert.doesNotMatch(uiText, /englishUi:/, 'English is a stable Cavalry language identity, not localized shell copy');
  assert.match(html, /id="currentLanguage"[^>]*data-kind="language"[\s\S]*id="installationBadge"[^>]*data-kind="installation"/);
  assert.match(app, /updateButton\.addEventListener/);
  assert.match(app, /updateControl\.hidden = !\(updatePreviewEnabled \|\| state\.updateInfo\?\.available\)/);
  assert.match(app, /updateTooltipText\.textContent = t\('updateTooltip'\)/);
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
  assert.equal(window.width, 400);
  assert.equal(window.height, 484);
  assert.equal(window.minWidth, 400);
  assert.equal(window.minHeight, 484);
  const capabilities = JSON.parse(read('src-tauri/capabilities/default.json'));
  assert.ok(capabilities.permissions.includes('core:window:allow-start-dragging'));
  for (const permission of [
    'core:window:allow-minimize',
    'core:window:allow-toggle-maximize',
    'core:window:allow-close',
  ]) assert.ok(capabilities.permissions.includes(permission));
  const windowsConfig = JSON.parse(read('src-tauri/tauri.windows.conf.json'));
  const windowsWindow = windowsConfig.app.windows.find((candidate) => candidate.label === 'main');
  for (const key of ['title', 'url', 'useHttpsScheme', 'width', 'height', 'minWidth', 'minHeight', 'resizable', 'center']) {
    assert.equal(windowsWindow[key], window[key], `Windows ${key} must reuse the shared window contract`);
  }
  assert.equal(windowsWindow.decorations, false);
  assert.equal(windowsWindow.shadow, true);
});


test('renderer localizes reinstall and composable warning-code paths without raw warning prose', () => {
  const app = read('renderer/app.js');
  const uiText = read('renderer/ui-text.js');
  const bridge = read('renderer/tauri-bridge.js');
  const styles = read('renderer/styles.css');
  assert.equal((uiText.match(/^\s{4}reinstallRequired:/gm) || []).length, 4, 'all four UI locales must localize the reinstall route');
  const localeBodies = uiLocaleBodies(uiText);
  assert.doesNotMatch(uiText, /Managed \/ Unverified|已管理|未验证|未驗證|管理済み \/ 未検証/);
  assert.equal((uiText.match(/^\s{4}restore:/gm) || []).length, 4, 'all four UI locales must localize the single Restore action');
  assert.doesNotMatch(
    uiText,
    /maintenance|refreshEnglish|restoreEnglish|restoreOfficialShort|officialRestore|runtimeResidueAfterRefresh/,
    'obsolete Recovery/Refresh copy must stay deleted'
  );
  for (const key of [
    'officialBadge',
    'statusLabel',
    'taskProgressLabel',
    'idlePrompt',
    'applyIntro',
    'restoreIntro',
    'updateIntro',
    'applyOutcome',
    'restoreOutcome',
    'minimizeWindow',
    'maximizeWindow',
    'restoreWindow',
    'closeWindow',
    'readyToApplyTitle',
    'reinstallCavalryTitle',
    'closeCavalryTitle',
    'preparingApplyTitle',
    'restoringTitle',
    'restoredTitle',
    'appliedTitle',
    'phaseVerifyInstallationRunningTitle',
    'phaseVerifyInstallationCompletedTitle',
    'phaseVerifyInstallationErrorTitle',
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
    'restartRecovery',
    'restoreFailed',
    'warningStateDurabilityPending',
    'warningRecoveryCleanupPending',
    'warningProtectedRecoveryEvidenceRetained',
    'warningTemporaryCleanupPending',
    'warningFinderFallbackUsed',
    'warningNonFatalCleanup',
    'appliedWithWarnings',
    'runtimeResidueWarning',
    'preparingApply',
    'restoring',
    'restoreConfirmTitle',
    'restoreConfirmBody',
    'restoreSuccess',
    'restoreWithWarnings',
    'updateAvailableAnnouncement',
    'updateConfirmTitle',
    'updateConfirmBody',
    'updateMacAdhocNote',
    'installUpdate',
    'updateDownloadRunningTitle',
    'updateDownloadProgress',
    'updateDownloadCompletedTitle',
    'updateInstallRunningTitle',
    'updateInstallCompletedTitle',
    'updateRestartRunningTitle',
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
  const reinstallFunction = sourceFunction(
    app,
    'function requiresCavalryReinstall() {',
    'function restoreIsNeeded'
  );
  assert.match(reinstallFunction, /state\.platform === 'macos'/);
  assert.match(reinstallFunction, /state\.installationMode === 'modifiedOrUnverified'/);
  assert.match(reinstallFunction, /state\.needsExtract/);
  assert.match(app, /setStatus\('reinstallRequired', 'error'\)/);
  assert.match(uiText, /const STATUS_TITLE_KEYS = Object\.freeze\(\{/);
  assert.match(uiText, /reinstallRequired: 'reinstallCavalryTitle'/);
  assert.match(app, /warningCodes\.includes\('stateDurabilityPending'\)/);
  assert.match(app, /browseButton\.disabled[\s\S]*durabilityPending/);
  const setBusyFunction = sourceFunction(app, 'function setBusy(isBusy) {', 'function updateLanguageOptions');
  const applyDisabledStatement = sourceStatement(setBusyFunction, 'applyButton.disabled =');
  assert.match(applyDisabledStatement, /!languageSelect\.value/, 'Switch must require an explicit target-language choice');
  assert.match(applyDisabledStatement, /reinstallRequired[\s\S]*state\.controlsBlocked[\s\S]*durabilityPending;/);
  assert.doesNotMatch(
    applyDisabledStatement,
    /state\.needsExtract/,
    'a clean official install may auto-create its baseline on Apply'
  );
  const restoreDisabledStatement = sourceStatement(setBusyFunction, 'restoreButton.disabled =');
  assert.match(restoreDisabledStatement, /restoreIsNeeded\(\)/);
  assert.match(restoreDisabledStatement, /restoreIsBlockedByMissingBaseline\(\)/);
  assert.match(restoreDisabledStatement, /state\.controlsBlocked[\s\S]*durabilityPending;/);
  const runApplyFunction = sourceFunction(app, 'async function runApply(nextLanguage) {', 'async function openPrivacySecurity');
  assert.match(runApplyFunction, /const restoring = isRestoreAction\(nextLanguage\);/);
  assert.match(runApplyFunction, /phase: 'verifyInstallation', state: 'running'/);
  assert.match(runApplyFunction, /api\.applyLanguage\(state\.appPath, nextLanguage, \(event\) => \{/);
  assert.match(runApplyFunction, /updateOperationPhase\(event, operationContext\)/);
  const restoreConfirmationFunction = sourceFunction(
    app,
    'function showRestoreConfirmation() {',
    'function showPermissionWait'
  );
  assert.match(
    restoreConfirmationFunction,
    /onPrimary: \(\) => \{\s*closeModal\(\);\s*void runApply\(restoreAction\)\.catch\(recoverOperationFailure\);\s*\}/
  );
  const bootstrapFunction = sourceFunction(app, 'async function bootstrap({ renderActivity = true } = {}) {', 'async function browseForApp');
  assert.match(
    bootstrapFunction,
    /const runtimeResidueDetected =\s*state\.platform === 'windows' && bootstrapState\.reconciliationRequired === true;/
  );
  assert.match(bootstrapFunction, /state\.englishRestoreNeeded = runtimeResidueDetected;/);
  assert.match(bootstrapFunction, /languageSelectControl\.setValue\(''\)/, 'bootstrap must not silently preselect a target language');
  const permissionWaitFunction = sourceFunction(
    app,
    'function showPermissionWait(nextLanguage) {',
    'async function bootstrap'
  );
  assert.match(permissionWaitFunction, /primary: needsElevation \? t\('requestElevation'\) : t\('openSettings'\)/);
  assert.match(permissionWaitFunction, /secondary: t\('cancel'\)/);
  assert.doesNotMatch(permissionWaitFunction, /retryApply|Retry Apply/);
  assert.doesNotMatch(app, /maintenanceHeading|extractButton|restoreEnglishButton|refreshEnglish/);
  assert.doesNotMatch(app, /reconcileEnglish|reconcileButton|runReconciliation|showReconciliation/);
  assert.doesNotMatch(app, /state\.reconciliationRequired/, 'residue detection must not become renderer mutation state');
  assert.doesNotMatch(app, /result\.warning(?!Codes)/, 'app.js must never render backend warning prose');
  assert.doesNotMatch(app, /result\.error\b/, 'app.js must never render backend error prose');
  assert.match(bridge, /WARNING_CODE_MANIFEST/);
  assert.match(bridge, /warning:\s*null/);
  assert.match(bridge, /warningCodes:\s*Object\.freeze/);
  assert.doesNotMatch(bridge, /extractEnglish|extract_english/);
  assert.doesNotMatch(bridge, /reconcileEnglish/);
  assert.doesNotMatch(styles, /--text-muted/);
  assert.doesNotMatch(styles, /reconcile-button/);
});

test('update icon stays hidden until preview or an updater check result and renderer has no network client', () => {
  const html = read('renderer/index.html');
  const app = read('renderer/app.js');
  const updateProgress = read('renderer/update-progress.js');
  const bridge = read('renderer/tauri-bridge.js');
  const uiText = read('renderer/ui-text.js');
  assert.match(html, /id="updateControl"[^>]*hidden/);
  assert.match(html, /id="updateTooltip"[^>]*role="tooltip"/);
  assert.match(uiText, /updateTooltip:/);
  assert.match(uiText, /updateMacAdhocNote:/);
  assert.match(app, /function updatePreviewRequested\(\)/);
  assert.match(app, /preview=update/);
  assert.match(app, /window\.__CAVALRY_I18N_PREVIEW__/);
  assert.doesNotMatch(app, /alertPreview|previewLocale|showLongestAlertPreview/);
  assert.match(app, /if \(updatePreviewEnabled \|\| typeof api\.checkUpdate !== 'function'\) return/);
  assert.match(app, /const result = await api\.checkUpdate\(\)/);
  assert.match(app, /const result = await api\.installUpdate\(\(event\) => updateProgress\.project\(event, update\)\)/);
  assert.match(updateProgress, /function createUpdateProgress/);
  assert.match(updateProgress, /phase === 'downloading'/);
  assert.match(updateProgress, /phase === 'installing'/);
  assert.match(updateProgress, /phase === 'restarting'/);
  assert.match(bridge, /invoke\('check_update'\)/);
  assert.match(bridge, /invoke\('install_update', \{ onEvent: channel \}\)/);
  assert.match(bridge, /UPDATE_ERROR_CODE_MANIFEST/);
  assert.match(bridge, /UPDATE_PHASE_MANIFEST/);
  assert.match(bridge, /normalizeUpdateEvent/);
  assert.match(bridge, /class OrderedChannel/);
  assert.match(bridge, /transformCallback/);
  assert.match(bridge, /OPERATION_PHASE_MANIFEST/);
  assert.match(bridge, /onEvent: channel/);
  assert.doesNotMatch(bridge, /url:\s*pick|signature:\s*pick|rawJson:\s*pick/);
  assert.doesNotMatch(app, /fetch\s*\(/i);
  assert.doesNotMatch(app, /axios/i);
  assert.doesNotMatch(app, /openLatestRelease|open_latest_release/);
  assert.doesNotMatch(bridge, /openLatestRelease|open_latest_release/);
});
