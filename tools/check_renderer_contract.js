#!/usr/bin/env node
/**
 * [INPUT]: renderer 静态 DOM、CSP 配置与冻结 bridge API。
 * [OUTPUT]: 守住固定 DOM anchors、local-only renderer 资源、无动态 HTML 注入、English UI/官方还原分离、可组合 warningCodes、durability retry 及最小 bridge 表面。
 * [POS]: renderer 的快速静态契约测试；只证明配置/source 形状，不虚称 packaged WebView CSP 执行。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(repoRoot, relative), 'utf8');

const REQUIRED_IDS = [
  'appVersion', 'appPath', 'languageSectionLabel', 'currentLabel', 'currentLanguage',
  'installationMode', 'switchToLabel', 'languageSelect', 'browseButton', 'extractButton', 'applyButton', 'restoreButton',
  'permissionButton', 'modalBackdrop', 'modalTitle', 'modalBody', 'modalPrimaryButton',
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
  assert.match(app, /language\.value === 'en' \? t\('englishUi'\) : language\.label/);
  assert.match(app, /runApply\('restore-official'\)/);
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
  for (const key of [
    'warningStateDurabilityPending',
    'warningRecoveryCleanupPending',
    'warningProtectedRecoveryEvidenceRetained',
    'warningTemporaryCleanupPending',
    'warningFinderFallbackUsed',
    'warningNonFatalCleanup',
    'appliedWithWarnings',
    'officialRestoreWithWarnings',
  ]) {
    assert.equal((app.match(new RegExp(`${key}:`, 'g')) || []).length, 4, `${key} must cover four locales`);
  }
  assert.match(app, /function requiresCavalryReinstall\(\)[\s\S]*modifiedOrUnverified[\s\S]*state\.needsExtract/);
  assert.match(app, /setStatus\(t\('reinstallRequired'\), 'error'\)/);
  assert.match(app, /warningCodes\.includes\('stateDurabilityPending'\)/);
  assert.match(app, /browseButton\.disabled[\s\S]*durabilityPending/);
  assert.match(app, /extractButton\.disabled = isBusy \|\| state\.controlsBlocked \|\| reinstallRequired/);
  assert.doesNotMatch(app, /result\.warning(?!Codes)/, 'app.js must never render backend warning prose');
  assert.match(bridge, /WARNING_CODE_MANIFEST/);
  assert.match(bridge, /warning:\s*null/);
  assert.match(bridge, /warningCodes:\s*Object\.freeze/);
  assert.doesNotMatch(styles, /--text-muted/);
});
