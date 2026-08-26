#!/usr/bin/env node
/**
 * [INPUT]: renderer 静态 DOM、CSP 配置与冻结 bridge API。
 * [OUTPUT]: 守住固定 DOM anchors、local-only renderer 资源、无动态 HTML 注入、English UI/官方还原分离、Windows 只读快照检测、英文恢复入口、可组合 warningCodes、durability retry 及最小 bridge 表面。
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
  'appVersion', 'appPath', 'languageSectionLabel', 'currentLabel', 'currentLanguage',
  'installationMode', 'switchToLabel', 'languageSelect', 'browseButton', 'extractButton', 'applyButton', 'restoreEnglishButton', 'restoreButton',
  'permissionButton', 'statusLabel', 'modalBackdrop', 'modalTitle', 'modalBody', 'modalPrimaryButton',
  'modalSecondaryButton', 'modalCloseButton', 'statusText',
];

const REQUIRED_API_METHODS = [
  'getStatus', 'browseApp', 'extractEnglish', 'applyLanguage', 'openPrivacySecurity',
];

test('renderer retains DOM anchors and uses only local resources', () => {
  const html = read('renderer/index.html');
  const styles = read('renderer/styles.css');
  for (const id of REQUIRED_IDS) assert.match(html, new RegExp(`id="${id}"`), `#${id} missing`);
  assert.doesNotMatch(html, /https?:\/\//, 'renderer HTML must not load remote resources');
  assert.doesNotMatch(styles, /@import|url\([\"']?https?:/i, 'styles must not load remote resources');
});

test('renderer builds language options safely and bridge API is frozen/minimal', () => {
  const app = read('renderer/app.js');
  const bridge = read('renderer/tauri-bridge.js');
  assert.doesNotMatch(app, /\.innerHTML\s*=/, 'renderer must not interpolate backend data as HTML');
  assert.match(app, /document\.createElement\('option'\)/);
  assert.match(app, /option\.textContent\s*=/);
  assert.match(app, /if \(language\.value === 'en'\) continue/);
  assert.match(app, /runApply\('restore-official'\)/);
  assert.match(app, /showApplyConfirmation\('en'\)/);
  assert.match(app, /restoreEnglishButton\.addEventListener/);
  assert.match(app, /statusLabel\.textContent = t\('statusLabel'\)/);
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
});


test('renderer localizes reinstall and composable warning-code paths without raw warning prose', () => {
  const app = read('renderer/app.js');
  const bridge = read('renderer/tauri-bridge.js');
  const styles = read('renderer/styles.css');
  assert.equal((app.match(/reinstallRequired:/g) || []).length, 4, 'all four UI locales must localize the reinstall route');
  const localeBodies = uiLocaleBodies(app);
  for (const key of [
    'restoreEnglish',
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
  ]) {
    for (const body of localeBodies) {
      assert.match(body, new RegExp(`^\\s{4}${key}:`, 'm'), `${key} missing from a locale`);
    }
  }
  assert.match(app, /function requiresCavalryReinstall\(\)[\s\S]*modifiedOrUnverified[\s\S]*state\.needsExtract/);
  assert.match(app, /setStatus\(t\('reinstallRequired'\), 'error'\)/);
  assert.match(app, /warningCodes\.includes\('stateDurabilityPending'\)/);
  assert.match(app, /browseButton\.disabled[\s\S]*durabilityPending/);
  assert.match(app, /extractButton\.disabled = isBusy \|\| state\.controlsBlocked \|\| reinstallRequired/);
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
