#!/usr/bin/env node
/**
 * [INPUT]: renderer bridge/ui-text/app.js 与最小 fake DOM、Tauri invoke fake。
 * [OUTPUT]: 验证 camelCase-only 转换、四语/稳定 warningCodes manifest、macOS English UI/官方还原分离、Windows 只读刷新与 typed residue warning、仅非英文运行态允许英文恢复且复用普通 apply、apply warning 组合、state durability 显式刷新重试及 rejection 恢复。
 * [POS]: renderer 生产源的 Node VM 运行时契约；不虚称真实 WebView、packaged CSP 或 Tauri shell 验证。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const repoRoot = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(repoRoot, relative), 'utf8');

class Element {
  constructor() { this.textContent = ''; this.dataset = {}; this.listeners = new Map(); this.attributes = new Map(); this.children = []; this.hidden = false; this.disabled = false; this.value = ''; }
  addEventListener(type, callback) { this.listeners.set(type, [...(this.listeners.get(type) || []), callback]); }
  setAttribute(key, value = '') { this.attributes.set(key, String(value)); }
  append(child) { this.children.push(child); this.options = this.children; }
  replaceChildren() { this.children = []; this.options = this.children; }
}

function runtime({
  status = {},
  reject = null,
  apply = { ok: true, currentLang: 'zh-Hans' },
  extract = { ok: true, count: 38 },
  locale = 'en-US',
} = {}) {
  const ids = ['appVersion', 'appPath', 'languageSectionLabel', 'currentLabel', 'currentLanguage', 'installationMode', 'switchToLabel', 'languageSelect', 'browseButton', 'extractButton', 'applyButton', 'restoreEnglishButton', 'restoreButton', 'permissionButton', 'statusLabel', 'modalBackdrop', 'modalTitle', 'modalBody', 'modalPrimaryButton', 'modalSecondaryButton', 'modalCloseButton', 'statusText'];
  const elements = Object.fromEntries(ids.map((id) => [`#${id}`, new Element()]));
  const calls = [];
  const document = {
    documentElement: new Element(), title: '',
    querySelector(selector) { return elements[selector]; },
    createElement() { return new Element(); },
  };
  const defaultStatus = {
    appManagementGranted: true, appPath: '/Applications/Cavalry.app', currentLang: 'zh-Hans',
    defaultAppCandidates: ['/Applications/Cavalry.app'], languages: [{ value: 'attacker', label: '<img>' }],
    installationMode: 'modifiedOrUnverified', needsExtract: false, permissionAction: 'none', platform: 'macos', version: '2.7.2', ...status,
  };
  const applyResults = Array.isArray(apply) ? [...apply] : [apply];
  const extractResults = Array.isArray(extract) ? [...extract] : [extract];
  const nextResult = (results) => (results.length > 1 ? results.shift() : results[0]);
  const window = { __TAURI_INTERNALS__: { invoke(command, payload) {
    calls.push({ command, payload });
    if (reject === command) return Promise.reject(new Error('transport failure'));
    if (command === 'get_status') return Promise.resolve(defaultStatus);
    if (command === 'apply_language') return Promise.resolve(nextResult(applyResults));
    if (command === 'extract_english') return Promise.resolve(nextResult(extractResults));
    return Promise.resolve({ ok: true });
  } } };
  const context = { window, document, navigator: { language: locale, languages: [locale] }, Promise, console, setTimeout, clearTimeout };
  context.globalThis = context;
  return { elements, calls, window, context };
}
async function flush() { await Promise.resolve(); await new Promise((resolve) => setImmediate(resolve)); await Promise.resolve(); }

function boot(options) {
  const r = runtime(options);
  vm.runInNewContext(read('renderer/tauri-bridge.js'), r.context, { filename: 'bridge.js' });
  vm.runInNewContext(read('renderer/ui-text.js'), r.context, { filename: 'ui-text.js' });
  vm.runInNewContext(read('renderer/app.js'), r.context, { filename: 'app.js' });
  return r;
}

test('bridge exposes frozen camelCase-only manifest and ignores unknown backend languages', async () => {
  const r = boot(); await flush();
  const api = r.window.cavalryI18n;
  assert.equal(Object.isFrozen(api), true);
  const status = await api.getStatus();
  assert.deepEqual(JSON.parse(JSON.stringify(status.languages)), [
    { value: 'en', label: 'English' }, { value: 'zh-Hans', label: '简体中文' },
    { value: 'zh-Hant', label: '繁體中文' }, { value: 'ja_JP', label: '日本語' },
  ]);
  assert.equal(r.elements['#languageSelect'].children.length, 3);
  assert.deepEqual(r.elements['#languageSelect'].children.map(({ value }) => value), ['zh-Hans', 'zh-Hant', 'ja_JP']);
  assert.equal(r.elements['#languageSelect'].children[0].textContent, '简体中文');
  assert.equal(r.elements['#statusLabel'].textContent, 'Status');
  assert.equal(status.installationMode, 'modifiedOrUnverified');
  assert.equal(Object.hasOwn(status, 'repoRoot'), false);
});

test('status panel label follows the selected UI locale', async () => {
  for (const [locale, expected] of [
    ['zh-CN', '操作状态'],
    ['zh-TW', '操作狀態'],
    ['ja-JP', '操作状況'],
  ]) {
    const r = boot({ locale });
    await flush();
    assert.equal(r.elements['#statusLabel'].textContent, expected, locale);
  }
});

test('English restore is disabled in English and otherwise uses the ordinary apply confirmation', async () => {
  const english = boot({ status: { currentLang: 'en' } }); await flush();
  assert.equal(english.elements['#currentLanguage'].textContent, 'English UI');
  assert.equal(english.elements['#languageSelect'].value, 'zh-Hans', 'English current state keeps a stable target default');
  assert.equal(english.elements['#restoreEnglishButton'].disabled, true);
  english.elements['#restoreEnglishButton'].listeners.get('click')[0]();
  assert.equal(english.elements['#modalTitle'].textContent, '');
  assert.equal(english.calls.filter(({ command }) => command === 'apply_language').length, 0);

  const translated = boot({ status: { currentLang: 'zh-Hans' } }); await flush();
  assert.equal(translated.elements['#restoreEnglishButton'].disabled, false);
  translated.elements['#restoreEnglishButton'].listeners.get('click')[0]();
  assert.equal(translated.elements['#modalTitle'].textContent, 'Install language pack?');
  translated.elements['#modalPrimaryButton'].listeners.get('click')[0]();
  await flush();
  assert.deepEqual(JSON.parse(JSON.stringify(translated.calls.filter(({ command }) => command === 'apply_language')[0])), {
    command: 'apply_language', payload: { appPath: '/Applications/Cavalry.app', lang: 'en' },
  });

  const restore = boot(); await flush();
  assert.equal(restore.elements['#restoreButton'].hidden, false);
  restore.elements['#restoreButton'].listeners.get('click')[0]();
  assert.equal(restore.elements['#modalTitle'].textContent, 'Restore the official Cavalry installation?');
  restore.elements['#modalPrimaryButton'].listeners.get('click')[0]();
  await flush();
  assert.deepEqual(JSON.parse(JSON.stringify(restore.calls.filter(({ command }) => command === 'apply_language')[0])), {
    command: 'apply_language', payload: { appPath: '/Applications/Cavalry.app', lang: 'restore-official' },
  });

  const official = boot({ status: { installationMode: 'official', currentLang: 'en' } }); await flush();
  assert.equal(official.elements['#restoreButton'].hidden, true);
  assert.equal(official.elements['#installationMode'].textContent, 'Installation: verified official runtime');
});

test('apply invokes exactly one backend transaction and never exposes a second restart call', async () => {
  const r = boot(); await flush();
  r.elements['#applyButton'].listeners.get('click')[0]();
  r.elements['#modalPrimaryButton'].listeners.get('click')[0]();
  await flush();
  assert.deepEqual(JSON.parse(JSON.stringify(r.calls.filter(({ command }) => command === 'apply_language')[0])), {
    command: 'apply_language', payload: { appPath: '/Applications/Cavalry.app', lang: 'zh-Hans' },
  });
  assert.equal(r.calls.some(({ command }) => command === 'restart_cavalry'), false);
});

test('refresh detects Windows residue without mutation and only the explicit English restore applies', async () => {
  const r = boot({
    status: { platform: 'windows' },
    extract: { ok: true, count: 38, reconciliationRequired: true },
    apply: { ok: true, currentLang: 'en' },
  });
  await flush();

  r.elements['#extractButton'].listeners.get('click')[0]();
  await flush();
  assert.equal(r.calls.filter(({ command }) => command === 'apply_language').length, 0);
  assert.equal(r.elements['#restoreEnglishButton'].disabled, false);
  assert.equal(r.elements['#applyButton'].disabled, false);
  assert.match(r.elements['#statusText'].textContent, /runtime residue/i);
  assert.match(r.elements['#statusText'].textContent, /made no runtime changes/i);

  r.elements['#restoreEnglishButton'].listeners.get('click')[0]();
  assert.equal(r.elements['#modalTitle'].textContent, 'Install language pack?');
  r.elements['#modalPrimaryButton'].listeners.get('click')[0]();
  await flush();
  assert.deepEqual(JSON.parse(JSON.stringify(r.calls.filter(({ command }) => command === 'apply_language')[0])), {
    command: 'apply_language', payload: { appPath: '/Applications/Cavalry.app', lang: 'en' },
  });
});

test('bootstrap shows typed Windows residue warning without blocking apply or restore', async () => {
  const windows = boot({
    status: { platform: 'windows', reconciliationRequired: true },
  });
  await flush();
  assert.equal(windows.elements['#restoreEnglishButton'].disabled, false);
  assert.equal(windows.elements['#applyButton'].disabled, false);
  assert.match(windows.elements['#statusText'].textContent, /runtime residue/i);
  assert.equal(
    windows.calls.filter(({ command }) => command === 'apply_language').length,
    0,
    'bootstrap must not apply implicitly'
  );

  const macos = boot({
    status: { platform: 'macos', reconciliationRequired: true },
  });
  await flush();
  assert.equal(macos.elements['#applyButton'].disabled, false);
  assert.doesNotMatch(macos.elements['#statusText'].textContent, /runtime residue/i);
});

test('bridge exposes typed residue detection without a dedicated reconciliation action', async () => {
  const r = boot({ extract: { ok: true, count: 38, reconciliationRequired: true } });
  await flush();
  const action = await r.window.cavalryI18n.extractEnglish('/Applications/Cavalry.app');
  assert.equal(action.reconciliationRequired, true);
  assert.equal(typeof r.window.cavalryI18n.reconcileEnglish, 'undefined');
});

test('English restore reuses the ordinary UAC retry path', async () => {
  const r = boot({
    status: { platform: 'windows', permissionAction: 'requestElevation' },
    apply: [
      { ok: false, permissionRequired: true, errorCode: 'permissionRequired' },
      { ok: true, currentLang: 'en' },
    ],
  });
  await flush();
  r.elements['#restoreEnglishButton'].listeners.get('click')[0]();
  r.elements['#modalPrimaryButton'].listeners.get('click')[0]();
  await flush();
  assert.equal(r.elements['#modalTitle'].textContent, 'System permission required');
  assert.equal(r.calls.filter(({ command }) => command === 'apply_language').length, 1);
  r.elements['#modalPrimaryButton'].listeners.get('click')[0]();
  await flush();
  assert.deepEqual(JSON.parse(JSON.stringify(r.calls.filter(({ command }) => command === 'apply_language')[1])), {
    command: 'apply_language', payload: { appPath: '/Applications/Cavalry.app', lang: 'en' },
  });
});

test('transport rejection becomes a localized stable status and re-bootstrap attempt', async () => {
  const r = boot({ reject: 'browse_app' }); await flush();
  r.elements['#browseButton'].listeners.get('click')[0]();
  await flush();
  assert.equal(r.elements['#statusText'].textContent, 'Could not contact the desktop service. Try again.');
  assert.equal(r.elements['#statusText'].dataset.tone, 'error');
  assert.equal(r.calls.filter(({ command }) => command === 'get_status').length, 2);
});

test('startup recovery failure blocks every installation mutation control with an explicit diagnostic', async () => {
  const r = boot({ status: {
    installationMode: 'recoveryRequired',
    startupRecoveryError: 'Cavalry is still running',
  } });
  await flush();
  for (const id of ['#browseButton', '#extractButton', '#applyButton', '#restoreEnglishButton', '#restoreButton', '#languageSelect']) {
    assert.equal(r.elements[id].disabled, true, `${id} must be blocked`);
  }
  assert.match(r.elements['#statusText'].textContent, /could not be recovered safely/);
  assert.match(r.elements['#statusText'].textContent, /Cavalry is still running/);
  assert.equal(r.elements['#statusText'].dataset.tone, 'error');
});


test('macOS incomplete provenance gives a direct reinstall route and never confirms official restore', async () => {
  const r = boot({ status: { installationMode: 'modifiedOrUnverified', needsExtract: true } }); await flush();
  assert.equal(r.elements['#restoreButton'].hidden, false, 'the unavailable restore route remains visible');
  assert.equal(r.elements['#restoreButton'].disabled, true, 'official restore must be unavailable with incomplete provenance');
  assert.equal(r.elements['#restoreEnglishButton'].disabled, true, 'English restore must be unavailable without a trusted snapshot');
  assert.equal(r.elements['#extractButton'].disabled, true, 'refreshing English must not be offered as a substitute for a required reinstall');
  assert.equal(r.elements['#applyButton'].disabled, true);
  assert.match(r.elements['#statusText'].textContent, /Reinstall Cavalry from the official installer/);
  assert.equal(r.elements['#statusText'].dataset.tone, 'error');
  r.elements['#restoreButton'].listeners.get('click')[0]();
  assert.equal(r.calls.some(({ command }) => command === 'apply_language'), false, 'a synthetic click cannot bypass the disabled restore route');
  assert.match(r.elements['#statusText'].textContent, /cannot be safely restored/);
  r.elements['#restoreEnglishButton'].listeners.get('click')[0]();
  assert.equal(r.calls.some(({ command }) => command === 'apply_language'), false, 'English restore must not bypass missing snapshot proof');
});

test('apply composes localized warning codes and never renders backend warning prose', async () => {
  const r = boot({
    locale: 'zh-CN',
    apply: {
      ok: true,
      currentLang: 'zh-Hans',
      warning: 'untrusted backend prose',
      warningCode: 'restartFailed',
      warningCodes: ['temporaryCleanupPending'],
    },
  });
  await flush();
  r.elements['#applyButton'].listeners.get('click')[0]();
  r.elements['#modalPrimaryButton'].listeners.get('click')[0]();
  await flush();
  assert.equal(r.elements['#statusText'].dataset.tone, 'warning');
  assert.match(r.elements['#statusText'].textContent, /无法重启 Cavalry/);
  assert.match(r.elements['#statusText'].textContent, /临时清理仍未完成/);
  assert.doesNotMatch(r.elements['#statusText'].textContent, /untrusted backend prose/);
});

test('state durability warning blocks mutations until an explicit successful snapshot retry', async () => {
  const r = boot({
    extract: [
      {
        ok: true,
        count: 38,
        warning: 'state path and raw fsync failure must stay private',
        warningCodes: ['stateDurabilityPending'],
      },
      { ok: true, count: 38, warningCodes: [] },
    ],
  });
  await flush();

  r.elements['#extractButton'].listeners.get('click')[0]();
  await flush();
  assert.equal(r.elements['#statusText'].dataset.tone, 'warning');
  assert.match(r.elements['#statusText'].textContent, /Refresh the English snapshot again/);
  assert.doesNotMatch(r.elements['#statusText'].textContent, /state path|raw fsync/i);
  for (const id of ['#browseButton', '#applyButton', '#restoreEnglishButton', '#restoreButton', '#languageSelect']) {
    assert.equal(r.elements[id].disabled, true, `${id} must stay blocked pending durability`);
  }
  assert.equal(r.elements['#extractButton'].disabled, false, 'Refresh is the only retry control');

  r.elements['#applyButton'].listeners.get('click')[0]();
  assert.equal(
    r.calls.some(({ command }) => command === 'apply_language'),
    false,
    'synthetic clicks cannot bypass the durability guard'
  );
  assert.match(r.elements['#statusText'].textContent, /Refresh the English snapshot again/);

  r.elements['#extractButton'].listeners.get('click')[0]();
  await flush();
  assert.equal(r.calls.filter(({ command }) => command === 'extract_english').length, 2);
  assert.equal(r.elements['#statusText'].dataset.tone, 'success');
  assert.match(r.elements['#statusText'].textContent, /English snapshot refreshed \(38 files\)/);
  for (const id of ['#browseButton', '#applyButton', '#restoreEnglishButton', '#restoreButton', '#languageSelect']) {
    assert.equal(r.elements[id].disabled, false, `${id} should unlock after durability retry`);
  }
});
