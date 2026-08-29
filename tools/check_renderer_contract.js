#!/usr/bin/env node
/**
 * [INPUT]: renderer 静态 DOM、本地应用图标、独立语义 token/图标表、稳定文案脚本、Select/Tooltip/Path/任务事件/Updater/About/Windows caption 状态机、第三方来源通知、CSP/平台窗口配置与冻结 bridge API。
 * [OUTPUT]: 守住固定 DOM anchors、token→共享/组件/平台视觉层单向依赖、macOS 原生交通灯/Windows caption controls、Grid/Flex 分工、Select/Tooltip/Button Group/顶部起排且触底跟随的任务事件视窗、中部省略路径、单一 Phosphor 图标注册表、MarkerIcon/Spinner/shimmer/仅作用于内层滚动区的 scroll-fade 与 MIT 来源、双徽章、独立 About 页面与固定项目外链、脱敏 Updater Channel、AlertDialog，以及全宽 Select + Apply/Restore 单任务流；禁止窗口主内容滚动、不可达旧事件与旧 Recovery/Refresh 残留。
 * [POS]: renderer 的快速静态契约测试；只证明配置/source 形状，不虚称 packaged WebView CSP 执行。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

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
  'permissionButton', 'statusLabel', 'statusViewport', 'modalBackdrop', 'modalTitle', 'modalBody', 'modalPrimaryButton',
  'modalSecondaryButton', 'statusText',
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
  assert.equal(window.cavalryIcons.create('unknown'), null, 'unknown semantic names must fail closed');
});

test('renderer retains DOM anchors and uses only local resources', () => {
  const html = read('renderer/index.html');
  const tokens = read('renderer/tokens.css');
  const styles = read('renderer/styles.css');
  const operationStyles = read('renderer/operation-log.css');
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
  const implementationCss = `${styles}\n${operationStyles}\n${aboutStyles}\n${windowControlStyles}`.replace(/\/\*[\s\S]*?\*\//g, '');
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
  assert.doesNotMatch(icons, /@import|url\([\"']?https?:/i, 'icon registry must not load remote resources');
  assert.doesNotMatch(aboutStyles, /@import|url\([\"']?https?:/i, 'about styles must not load remote resources');
  assert.doesNotMatch(windowControlStyles, /@import|url\([\"']?https?:/i, 'window controls must not load remote resources');
  assert.match(thirdPartyNotices, /## shadcn\/ui[\s\S]*Licensed under the MIT License/);
  assert.match(thirdPartyNotices, /## Phosphor Icons[\s\S]*Licensed under the MIT License/);
  assert.match(
    html,
    /<link rel="stylesheet" href="\.\/tokens\.css" \/>\s*<link rel="stylesheet" href="\.\/styles\.css" \/>\s*<link rel="stylesheet" href="\.\/operation-log\.css" \/>\s*<link rel="stylesheet" href="\.\/about\.css" \/>\s*<link rel="stylesheet" href="\.\/window-controls\.css" \/>/,
    'semantic tokens must load before shared and platform visual implementations'
  );
  assert.match(
    html,
    /<script src="\.\/tauri-bridge\.js"><\/script>\s*<script src="\.\/ui-text\.js"><\/script>\s*<script src="\.\/icons\.js"><\/script>\s*<script src="\.\/select-control\.js"><\/script>\s*<script src="\.\/tooltip-control\.js"><\/script>\s*<script src="\.\/path-display\.js"><\/script>\s*<script src="\.\/operation-log\.js"><\/script>\s*<script src="\.\/update-progress\.js"><\/script>\s*<script src="\.\/about-control\.js"><\/script>\s*<script src="\.\/window-controls\.js"><\/script>\s*<script src="\.\/app\.js"><\/script>/,
    'renderer scripts must load bridge, stable text, icons, component state machines, then app'
  );
  assert.match(icons, /window\.cavalryIcons = Object\.freeze\(\{ create: createIcon \}\)/);
  for (const iconName of ['spinner', 'checkCircle', 'warningCircle', 'errorCircle', 'verify', 'archive', 'translate', 'restore', 'restart', 'download', 'package', 'update']) {
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
  assert.doesNotMatch(aboutStyles, /--[a-z0-9-]+\s*:/i, 'about implementation must consume tokens instead of defining private constants');
  assert.doesNotMatch(windowControlStyles, /--[a-z0-9-]+\s*:/i, 'platform implementation must consume tokens instead of defining private constants');
  assert.doesNotMatch(tunableImplementationCss, /#[0-9a-f]{3,8}|rgba?\(|[+-]?(?:\d+\.?\d*|\.\d+)(?:px|ms|em|deg)|:\s*(?:black|white)(?:\s|;|,)/i, 'implementation CSS must not own tunable design literals');
  const tokenDefinitions = [...tokens.matchAll(/(--[a-z0-9-]+)\s*:/gi)].map((match) => match[1]);
  const tokenReferences = `${tokens}\n${styles}\n${operationStyles}\n${aboutStyles}\n${windowControlStyles}\n${tooltipControl}`;
  assert.deepEqual(
    tokenDefinitions.filter(
      (name) => !tokenReferences.includes(`var(${name})`) && !tooltipControl.includes(`'${name}'`)
    ),
    [],
    'semantic tokens must have a real consumer'
  );
  assert.equal(fs.existsSync(path.join(repoRoot, 'renderer/assets')), false, 'unused bundled font assets must stay removed');
  assert.ok(app.split(/\r?\n/).length <= 800, 'renderer/app.js must stay within the 800-line contract');
  assert.ok(updateProgress.split(/\r?\n/).length <= 800, 'renderer/update-progress.js must stay within the 800-line contract');
  assert.ok(tooltipControl.split(/\r?\n/).length <= 800, 'renderer/tooltip-control.js must stay within the 800-line contract');
  assert.match(cssRule(styles, 'html,\nbody'), /overflow:\s*hidden;/, 'the window must not scroll as a whole');
  assert.match(cssRule(styles, '.content'), /overflow:\s*hidden;/, 'the main content must not scroll');
  const selectListRule = cssRule(styles, '.select-list');
  assert.match(selectListRule, /max-height:\s*var\(--select-popup-max-height\);/);
  assert.match(selectListRule, /overflow-y:\s*auto;/, 'the Select list must own its bounded scroll');
  assert.doesNotMatch(selectListRule, /overflow:\s*hidden;/, 'Select list scrolling must not be clipped');
  const statusPanelRule = cssRule(operationStyles, '.status-panel');
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
  assert.match(html, /<section class="language-section" aria-labelledby="languageSectionLabel">/);
  assert.match(html, /id="languageSelectTrigger"[^>]*role="combobox"[^>]*aria-haspopup="listbox"[^>]*aria-expanded="false"/);
  assert.match(html, /class="select-chevron"[^>]*>[\s\S]*?<svg[^>]*viewBox="0 0 24 24"[\s\S]*?<path d="m6 9 6 6 6-6"><\/path>/);
  assert.match(html, /id="languageSelectList"[^>]*role="listbox"/);
  assert.match(html, /class="language-control-row"[\s\S]*?id="applyButton"[\s\S]*?id="restoreButton"/);
  assert.match(html, /<dialog id="modalBackdrop"[^>]*role="alertdialog"[^>]*aria-modal="true"[^>]*aria-labelledby="modalTitle"[^>]*aria-describedby="modalBody">/);
  assert.match(html, /id="statusPanel"[^>]*aria-labelledby="statusLabel"/);
  assert.match(html, /<h2 id="statusLabel" class="sr-only">Operation progress<\/h2>\s*<div id="statusViewport" class="status-viewport">\s*<ol id="statusText"[^>]*role="log"[^>]*aria-live="polite"[\s\S]*?<button id="permissionButton"/, 'screen-reader task label, bounded live log, and optional recovery action must remain in source order');
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
  assert.match(tokens, /--select-indicator-size:\s*16px/);
  assert.match(styles, /\.select-popup\s*\{[\s\S]*?border:\s*0;[\s\S]*?border-radius:\s*var\(--radius-select-popup\)[\s\S]*?box-shadow:\s*var\(--shadow-select-popup\)/);
  assert.match(selectControl, /function alignPopupToSelectedItem\(selected\)[\s\S]*?getBoundingClientRect\(\)[\s\S]*?alignedTop/);
  assert.doesNotMatch(html, /id="about(?:Dialog|Title|Version|CloseButton|RepositoryLink|RepositoryLabel|LicenseLink|LicenseLabel)"/, 'About content must not remain in the main window');
  assert.match(html, /id="aboutControl"[^>]*data-tooltip-state="closed"[^>]*hidden/);
  assert.match(aboutControl, /createAboutControl/);
  assert.match(aboutControl, /api\.showAbout\(\)/);
  assert.match(aboutControl, /control\.hidden = platform !== 'windows'/);
  assert.doesNotMatch(aboutControl, /https?:\/\//, 'About entry must not own an external URL');
  assert.match(aboutPage, /<script src="\.\/about-window\.js"><\/script>/);
  assert.match(aboutPage, /<img class="about-app-icon" src="\.\/app-icon\.png" alt="" aria-hidden="true" \/>/);
  assert.match(aboutPage, /id="aboutRepositoryLink"[\s\S]*?class="about-link-icon"[\s\S]*?id="aboutRepositoryLabel"/);
  assert.match(aboutWindow, /getSwitcherVersion\(\)/);
  assert.match(aboutWindow, /openProjectLink\(link\)/);
  assert.match(aboutWindow, /wireProjectLink\('#aboutRepositoryLink', 'repository'\)/);
  assert.match(aboutWindow, /wireProjectLink\('#aboutLicenseLink', 'license'\)/);
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
  assert.match(tokens, /--padding-control-inline:\s*var\(--space-3\)/);
  assert.match(styles, /\.titlebar\s*\{[\s\S]*?padding:\s*0 var\(--padding-panel\)/);
  assert.match(styles, /\.window-title\s*\{[\s\S]*?font-size:\s*var\(--type-heading\)[\s\S]*?font-weight:\s*var\(--weight-heading\)[\s\S]*?line-height:\s*var\(--line-height-heading\)/);
  assert.match(styles, /\.content\s*\{[\s\S]*?padding:\s*var\(--padding-window\)/);
  assert.match(styles, /\.content\s*\{[\s\S]*?display:\s*grid;[\s\S]*?grid-template-rows:\s*auto auto minmax\(0,\s*1fr\);[\s\S]*?align-content:\s*start/);
  assert.match(styles, /\.content\s*>\s*section:first-child\s*\{[\s\S]*?margin-bottom:\s*var\(--gap-flow\)/);
  assert.match(styles, /\.language-section\s*\{[\s\S]*?display:\s*grid;[\s\S]*?gap:\s*var\(--section-heading-control-gap\)/);
  assert.match(tokens, /--section-heading-control-gap:\s*var\(--space-2\)/);
  assert.match(styles, /\.language-control-row\s*\{[\s\S]*?gap:\s*var\(--gap-flow\)/);
  assert.match(operationStyles, /\.status-panel\s*\{[\s\S]*?min-height:\s*0;[\s\S]*?margin-top:\s*var\(--gap-flow\)/);
  assert.doesNotMatch(operationStyles, /\.status-label\s*\{/, 'the generic task heading must not be visible');
  assert.match(operationStyles, /\.operation-event-title\s*\{[\s\S]*?font-size:\s*var\(--type-compact\)[\s\S]*?line-height:\s*var\(--line-height-compact\)/);
  assert.doesNotMatch(tokens, /--alert-(?:height|icon|padding|column|copy)/);
  assert.match(tokens, /--operation-marker-size:\s*var\(--space-4\)/);
  assert.match(tokens, /--operation-marker-gap:\s*var\(--space-2\)/);
  assert.match(tokens, /--operation-scrollbar-size:\s*10px/);
  assert.match(tokens, /--operation-marker-description-offset:\s*2px/);
  assert.match(tokens, /--operation-scroll-fade-size:\s*min\(12%, calc\(var\(--space-1\) \* 10\)\)/);
  assert.match(tokens, /--operation-scroll-fade-reveal:\s*calc\(var\(--space-6\) \* 4\)/);
  assert.match(tokens, /--operation-shimmer-angle:\s*20deg/);
  assert.match(tokens, /--operation-shimmer-spread:\s*calc\(3ch \+ var\(--space-1\) \* 10\)/);
  assert.doesNotMatch(styles, /\.separator\s*\{/);
  assert.doesNotMatch(html, /class="separator"/, 'business sections must use spacing rather than decorative dividers');
  assert.doesNotMatch(styles, /text-box-trim/, 'cross-platform layout must not depend on experimental glyph-box trimming');
  assert.doesNotMatch(styles, /\.installation-heading\s*\{[^}]*min-height:/, 'installation typography must size its parent without a duplicate height constraint');
  assert.match(styles, /\.installation-name\s*\{[\s\S]*?line-height:\s*var\(--line-height-heading\)/);
  assert.match(styles, /\.skip-link,\s*\.tooltip,\s*\.app-path\s*\{[\s\S]*?font-size:\s*var\(--type-metadata\)[\s\S]*?font-weight:\s*var\(--weight-regular\)[\s\S]*?line-height:\s*var\(--line-height-metadata\)[\s\S]*?font-synthesis:\s*none/);
  assert.match(styles, /\.badge\s*\{[\s\S]*?font-size:\s*var\(--type-label\)[\s\S]*?font-weight:\s*var\(--weight-regular\)[\s\S]*?line-height:\s*var\(--line-height-label\)/);
  assert.match(styles, /\.app-path\s*\{[\s\S]*?margin:\s*var\(--gap-meta-stack\)\s+0\s+0/);
  assert.match(styles, /\.badge\s*\{[\s\S]*?min-height:\s*var\(--badge-height\)[\s\S]*?padding:\s*0 var\(--badge-padding-inline\)[\s\S]*?border-radius:\s*var\(--radius-pill\)/);
  assert.match(tokens, /--badge-language-bg:\s*#f9f1fe/);
  assert.match(tokens, /--badge-language-border:\s*#eddcf9/);
  assert.match(tokens, /--badge-language-text:\s*#7820bc/);
  assert.match(styles, /\.badge\[data-kind="language"\]\s*\{[\s\S]*?border-color:\s*var\(--badge-language-border\)[\s\S]*?background:\s*var\(--badge-language-bg\)[\s\S]*?color:\s*var\(--badge-language-text\)/);
  assert.match(styles, /\.installation-item\s*\{[\s\S]*?padding:\s*var\(--padding-panel\)/);
  assert.match(operationStyles, /\.status-panel\s*\{[\s\S]*?grid-template-rows:\s*minmax\(0,\s*1fr\) auto;/);
  assert.match(operationStyles, /\.status-viewport\s*\{[\s\S]*?overflow-y:\s*auto/);
  assert.match(operationStyles, /\.status-viewport\[data-overflowing="true"\][\s\S]*?mask-image:\s*linear-gradient/);
  assert.match(operationStyles, /animation-timeline:\s*scroll\(self y\), scroll\(self y\)/);
  assert.match(operationStyles, /\.status-text\s*\{[\s\S]*?display:\s*flex;[\s\S]*?flex-direction:\s*column/);
  assert.doesNotMatch(operationStyles, /\.operation-event:first-child\s*\{[\s\S]*?margin-top:\s*auto/, 'short event streams must begin at the padded top edge');
  assert.match(operationStyles, /\.operation-event\[data-variant="separator"\][\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\) auto minmax\(0, 1fr\)/);
  assert.match(operationStyles, /\.operation-event\s*\{[\s\S]*?display:\s*flex;[\s\S]*?align-items:\s*center;[\s\S]*?gap:\s*var\(--operation-marker-gap\)[\s\S]*?color:\s*var\(--text-secondary\)/);
  assert.match(operationStyles, /\.operation-event-marker\s*\{[\s\S]*?width:\s*var\(--operation-marker-size\);[\s\S]*?height:\s*var\(--operation-marker-size\)/);
  assert.doesNotMatch(operationStyles, /\.operation-event\[data-state="(?:completed|warning|error)"\] \.operation-event-marker\s*\{[\s\S]*?color:/, 'Marker icons must stay monochrome instead of becoming status badges');
  assert.match(operationStyles, /\.operation-event-title\s*\{[\s\S]*?color:\s*inherit;[\s\S]*?font-weight:\s*var\(--weight-regular\)/);
  assert.match(operationStyles, /\.operation-event\[data-state="running"\] \.operation-event-marker\[data-icon="spinner"\] svg\s*\{[\s\S]*?animation:\s*operation-spin/);
  assert.match(operationStyles, /\.operation-event\[data-state="running"\] \.operation-event-title\s*\{[\s\S]*?background-image:\s*linear-gradient[\s\S]*?animation:\s*operation-shimmer/);
  assert.match(operationLog, /DEFAULT_ICON_BY_STATE[\s\S]*?running:\s*'spinner'/);
  assert.match(icons, /const ICONS = Object\.freeze\(\{/);
  assert.match(operationLog, /const overflowing = viewport\.scrollHeight > viewport\.clientHeight;[\s\S]*?viewport\.scrollTop = overflowing \? viewport\.scrollHeight : 0;/);
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
  assert.match(styles, /\.installation-item\s*\{[\s\S]*?display:\s*grid/);
  assert.match(styles, /\.language-control-row\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2/);
  assert.match(styles, /\.select-root\s*\{[\s\S]*?grid-column:\s*1\s*\/\s*-1/);
  assert.match(cssRule(styles, '.content'), /overflow:\s*hidden/);
  assert.match(cssRule(styles, '.select-list'), /overflow-y:\s*auto/);
  assert.match(operationStyles, /\.status-panel\s*\{[\s\S]*?grid-template-rows:\s*minmax\(0, 1fr\) auto/);
  assert.match(app, /document\.body\.dataset\.platform = state\.platform/);
  assert.match(app, /window\.createTooltipControl/);
  assert.doesNotMatch(app, /updateControl\.addEventListener\('(?:mouseenter|focusin)'/);
  assert.match(app, /state\.ready = false;[\s\S]*?setBusy\(state\.busy\);[\s\S]*?await api\.getStatus\(\)/);
});

test('renderer builds language options safely and bridge API is frozen/minimal', () => {
  const html = read('renderer/index.html');
  const app = read('renderer/app.js');
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
  assert.doesNotMatch(app, /maintenanceHeading|extractButton|restoreEnglishButton|refreshEnglish/);
  assert.match(app, /statusLabel\.textContent = t\('taskProgressLabel'\)/);
  assert.match(app, /operationLog\.start\(\{[\s\S]*?restoreTaskTitle[\s\S]*?applyTaskTitle/);
  assert.match(app, /operationLog\.idle\(\)/);
  assert.match(app, /operationLog\.replace\(\{/);
  assert.match(app, /operationLog\.upsert\(operationPhaseCopy\(event, context\)\)/);
  assert.match(app, /installationBadge\.dataset\.state = installationBadgeState\(visualState\)/);
  assert.match(app, /state\.currentLang !== 'en'\) return t\('translatedBadge'\)/);
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
    'translatedBadge',
    'modifiedBadge',
    'statusLabel',
    'taskProgressLabel',
    'applyTaskTitle',
    'restoreTaskTitle',
    'updateTaskTitle',
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
