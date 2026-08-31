#!/usr/bin/env node
/**
 * [INPUT]: renderer bridge/ui-text/icons/select/tooltip/path/operation-log/permission-handoff/update-progress/toast/about/window-controls/app.js 与最小 fake DOM、Tauri invoke/Channel fake。
 * [OUTPUT]: 验证 bridge、仅在未发现安装时显露的安装选择、Select Trigger/popup 显式占位与选择、版本只读门禁、Managed Legacy 恢复语义、只读权限未知不产生启动警告、按 macOS/Windows 分流且通过同一 source-rect/session Channel 合同恢复原操作、同进程 oracle 的重复成功前置阶段折叠、任务流、组件状态机、Updater Channel 与不内嵌 changelog 的确认边界、Badge 及 About/外链局部失败 Toast。
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
  constructor() { this.children = []; this._textContent = ''; this.dataset = {}; this.listeners = new Map(); this.attributes = new Map(); this.hidden = false; this.disabled = false; this.value = ''; this.open = false; this.focused = false; this.isConnected = true; this.ownerDocument = null; this.className = ''; this.scrollTop = 0; this.title = ''; this.style = { values: new Map(), setProperty: (key, value) => this.style.values.set(key, value) }; this.offsetHeight = 64; }
  get textContent() { return this.children.length ? this.children.map((child) => child.textContent).join('') : this._textContent; }
  set textContent(value) { this._textContent = String(value ?? ''); }
  get scrollHeight() { return this.children.length; }
  addEventListener(type, callback) { this.listeners.set(type, [...(this.listeners.get(type) || []), callback]); }
  setAttribute(key, value = '') { this.attributes.set(key, String(value)); }
  removeAttribute(key) { this.attributes.delete(key); }
  focus() { this.focused = true; if (this.ownerDocument) this.ownerDocument.activeElement = this; }
  showModal() { this.open = true; this.setAttribute('open', ''); }
  close() { this.open = false; this.removeAttribute('open'); for (const callback of this.listeners.get('close') || []) callback(); }
  append(...children) { this.children.push(...children); this.options = this.children; }
  replaceChildren(...children) { this.children = children; this.options = this.children; }
  remove() { this.isConnected = false; this.hidden = true; }
  contains(target) { return target === this || this.children.some((child) => child.contains?.(target)); }
  getBoundingClientRect() { return { x: 10, y: 10, left: 10, top: 10, width: 100, height: 32, right: 110, bottom: 42 }; }
}

function runtime({
  status = {},
  reject = null,
  apply = { ok: true, currentLang: 'zh-Hans' },
  update = { currentVersion: '0.7.0', version: null, notes: null, pubDate: null, available: false, errorCode: null },
  install = { currentVersion: '0.7.0', version: '0.7.1', notes: null, pubDate: null, available: true, errorCode: 'updateInstallFailed' },
  installEvents = [
    { phase: 'downloading', downloaded: 0, contentLength: null },
    { phase: 'downloading', downloaded: 50, contentLength: 100 },
    { phase: 'installing', downloaded: null, contentLength: null },
  ],
  locale = 'en-US',
  preview = false,
  statusRequest = null,
  styleValues = {},
} = {}) {
  const ids = ['skipLink', 'windowTitle', 'appVersion', 'appPath', 'appPathPrefix', 'appPathLeaf', 'updateControl', 'updateButton', 'updateTooltip', 'updateTooltipText', 'updateAnnouncement', 'aboutControl', 'aboutButton', 'aboutTooltip', 'aboutTooltipText', 'aboutTitle', 'aboutVersion', 'aboutLinks', 'aboutLicenseLabel', 'aboutRepositoryLink', 'aboutLicenseLink', 'windowsWindowControls', 'windowMinimizeButton', 'windowMaximizeButton', 'windowCloseButton', 'languageSectionLabel', 'currentLabel', 'currentLanguage', 'installationBadge', 'installationMode', 'switchToLabel', 'languageSelectRoot', 'languageSelect', 'languageSelectTrigger', 'languageSelectValue', 'languageSelectPopup', 'languageSelectPopupPlaceholder', 'languageSelectList', 'browseButton', 'applyButton', 'restoreButton', 'permissionButton', 'statusPanel', 'statusLabel', 'statusIdle', 'statusIntro', 'statusViewport', 'statusOutcome', 'modalBackdrop', 'modalTitle', 'modalBody', 'modalPrimaryButton', 'modalSecondaryButton', 'statusText'];
  const elements = Object.fromEntries(ids.map((id) => [`#${id}`, new Element()]));
  const calls = [];
  const channels = [];
  const updateChannels = [];
  const handoffChannels = [];
  const callbacks = new Map();
  let nextCallbackId = 1;
  const document = {
    documentElement: new Element(), body: new Element(), activeElement: null, title: '',
    listeners: new Map(),
    querySelector(selector) { return elements[selector]; },
    createElement() { const element = new Element(); element.ownerDocument = this; return element; },
    createElementNS() { const element = new Element(); element.ownerDocument = this; return element; },
    addEventListener(type, callback) { this.listeners.set(type, [...(this.listeners.get(type) || []), callback]); },
  };
  for (const element of [...Object.values(elements), document.documentElement, document.body]) {
    element.ownerDocument = document;
  }
  const defaultStatus = {
    appManagementGranted: true, appPath: '/Applications/Cavalry.app', currentLang: 'zh-Hans',
    defaultAppCandidates: ['/Applications/Cavalry.app'], languages: [{ value: 'attacker', label: '<img>' }],
    installationMode: 'modifiedOrUnverified', officialRecoveryAvailable: true,
    needsExtract: false, permissionAction: 'none', platform: 'macos', supportedVersion: '2.7.2',
    version: '2.7.2', versionCompatibility: 'supported', ...status,
  };
  const applyResults = Array.isArray(apply) ? [...apply] : [apply];
  const nextResult = (results) => (results.length > 1 ? results.shift() : results[0]);
  let maximized = false;
  const windowListeners = new Map();
  const navigator = { language: locale, languages: [locale] };
  const window = {
    navigator,
    innerWidth: 400,
    innerHeight: 484,
    location: { protocol: 'http:', hostname: '127.0.0.1', search: preview ? '?preview=update' : '' },
    addEventListener(type, callback) { windowListeners.set(type, [...(windowListeners.get(type) || []), callback]); },
    __TAURI_INTERNALS__: {
    transformCallback(callback) { const id = nextCallbackId++; callbacks.set(id, callback); return id; },
    unregisterCallback(id) { callbacks.delete(id); },
    invoke(command, payload) {
    if (command === 'apply_language') {
      channels.push(payload.onEvent);
      calls.push({ command, payload: { appPath: payload.appPath, lang: payload.lang } });
    } else if (command === 'install_update') {
      updateChannels.push(payload.onEvent);
      calls.push({ command, payload: { onEvent: Boolean(payload.onEvent) } });
    } else if (command === 'open_privacy_security') {
      handoffChannels.push(payload.onEvent);
      calls.push({ command, payload: { request: payload.request, onEvent: Boolean(payload.onEvent) } });
    } else {
      calls.push({ command, payload });
    }
    if (reject === command) return Promise.reject(new Error('transport failure'));
    if (command === 'get_status') return statusRequest ? statusRequest(defaultStatus) : Promise.resolve(defaultStatus);
    if (command === 'apply_language') {
      const result = nextResult(applyResults);
      const callback = callbacks.get(payload.onEvent.id);
      if (callback) {
        const events = result.ok
          ? [
              { phase: 'verifyInstallation', state: 'running' },
              { phase: 'verifyInstallation', state: 'completed' },
              { phase: 'ensureBaseline', state: 'running' },
              { phase: 'ensureBaseline', state: 'completed' },
              { phase: 'applyTransaction', state: 'running' },
              { phase: 'applyTransaction', state: (result.warningCodes || []).some((code) => code !== 'restartFailed') ? 'warning' : 'completed' },
              { phase: 'restartCavalry', state: 'running' },
              { phase: 'restartCavalry', state: (result.warningCodes || []).includes('restartFailed') || result.warningCode === 'restartFailed' ? 'warning' : 'completed' },
            ]
          : result.permissionRequired
            ? [
                { phase: 'verifyInstallation', state: 'running' },
                { phase: 'verifyInstallation', state: 'completed' },
                { phase: 'ensureBaseline', state: 'running' },
                { phase: 'ensureBaseline', state: 'completed' },
                { phase: 'applyTransaction', state: 'running' },
                { phase: 'applyTransaction', state: 'error' },
              ]
            : [
                { phase: 'verifyInstallation', state: 'running' },
                { phase: 'verifyInstallation', state: 'error' },
              ];
        events.forEach((message, index) => callback({ index, message }));
        callback({ index: events.length, end: true });
      }
      return Promise.resolve(result);
    }
    if (command === 'check_update') return Promise.resolve(update);
    if (command === 'install_update') {
      const callback = callbacks.get(payload.onEvent.id);
      if (callback) {
        installEvents.forEach((message, index) => callback({ index, message }));
        callback({ index: installEvents.length, end: true });
      }
      return Promise.resolve(install);
    }
    if (command === 'plugin:app|version') return Promise.resolve('0.7.0');
    if (command === 'open_privacy_security') return Promise.resolve({ ok: true, handoffOutcome: 'opened' });
    if (command === 'open_project_link') return Promise.resolve({ ok: true });
    if (command === 'show_about') return Promise.resolve({ ok: true });
    if (command === 'plugin:window|is_maximized') return Promise.resolve(maximized);
    if (command === 'plugin:window|toggle_maximize') { maximized = !maximized; return Promise.resolve(); }
    if (command === 'plugin:window|minimize' || command === 'plugin:window|close') return Promise.resolve();
    return Promise.resolve({ ok: true });
    } },
  };
  const context = { window, document, navigator, Promise, console, setTimeout, clearTimeout, getComputedStyle: () => ({ getPropertyValue: (name) => styleValues[name] || '0ms' }) };
  context.globalThis = context;
  return { elements, calls, channels, updateChannels, handoffChannels, callbacks, window, context };
}
async function flush() { await Promise.resolve(); await new Promise((resolve) => setImmediate(resolve)); await Promise.resolve(); }

function dispatch(element, type, event = {}) { for (const listener of element.listeners.get(type) || []) listener(event); }
function chooseLanguage(runtimeState, index = 0) {
  dispatch(runtimeState.elements['#languageSelectTrigger'], 'click');
  dispatch(runtimeState.elements['#languageSelectList'].children[index], 'click');
}
function boot(options) {
  const r = runtime(options);
  vm.runInNewContext(read('renderer/tauri-bridge.js'), r.context, { filename: 'bridge.js' });
  vm.runInNewContext(read('renderer/ui-text.js'), r.context, { filename: 'ui-text.js' });
  vm.runInNewContext(read('renderer/icons.js'), r.context, { filename: 'icons.js' });
  vm.runInNewContext(read('renderer/select-control.js'), r.context, { filename: 'select-control.js' });
  vm.runInNewContext(read('renderer/tooltip-control.js'), r.context, { filename: 'tooltip-control.js' });
  vm.runInNewContext(read('renderer/path-display.js'), r.context, { filename: 'path-display.js' });
  vm.runInNewContext(read('renderer/operation-log.js'), r.context, { filename: 'operation-log.js' });
  vm.runInNewContext(read('renderer/permission-handoff.js'), r.context, { filename: 'permission-handoff.js' });
  vm.runInNewContext(read('renderer/update-progress.js'), r.context, { filename: 'update-progress.js' });
  vm.runInNewContext(read('renderer/toast-control.js'), r.context, { filename: 'toast-control.js' });
  vm.runInNewContext(read('renderer/about-control.js'), r.context, { filename: 'about-control.js' });
  vm.runInNewContext(read('renderer/window-controls.js'), r.context, { filename: 'window-controls.js' });
  vm.runInNewContext(read('renderer/app.js'), r.context, { filename: 'app.js' });
  return r;
}

function bootAbout(options) {
  const r = runtime(options);
  vm.runInNewContext(read('renderer/tauri-bridge.js'), r.context, { filename: 'bridge.js' });
  vm.runInNewContext(read('renderer/ui-text.js'), r.context, { filename: 'ui-text.js' });
  vm.runInNewContext(read('renderer/icons.js'), r.context, { filename: 'icons.js' });
  vm.runInNewContext(read('renderer/toast-control.js'), r.context, { filename: 'toast-control.js' });
  vm.runInNewContext(read('renderer/about-window.js'), r.context, { filename: 'about-window.js' });
  return r;
}

function activityRows(runtimeState) { return runtimeState.elements['#statusText'].children; }
function activityText(runtimeState) { return runtimeState.elements['#statusText'].textContent; }
function activityTitle(runtimeState, index = 0) { return activityRows(runtimeState)[index]?.children[1]?.children[0]?.textContent || ''; }
function toastViewport(runtimeState) { return runtimeState.context.document.body.children.find((child) => child.className === 'toast-viewport'); }

test('Windows caption controls keep right-side native semantics and localized maximize state', async () => {
  const r = boot({ status: { platform: 'windows' }, locale: 'zh-CN' });
  await flush();
  const root = r.elements['#windowsWindowControls'];
  const minimize = r.elements['#windowMinimizeButton'];
  const maximize = r.elements['#windowMaximizeButton'];
  const close = r.elements['#windowCloseButton'];

  assert.equal(root.hidden, false);
  assert.equal(root.dataset.maximized, 'false');
  assert.equal(minimize.attributes.get('aria-label'), '最小化');
  assert.equal(maximize.attributes.get('aria-label'), '最大化');
  assert.equal(close.attributes.get('aria-label'), '关闭');

  maximize.listeners.get('click')[0]();
  await flush();
  assert.equal(root.dataset.maximized, 'true');
  assert.equal(maximize.attributes.get('aria-label'), '还原');
  minimize.listeners.get('click')[0]();
  close.listeners.get('click')[0]();
  await flush();

  assert.deepEqual(
    JSON.parse(JSON.stringify(r.calls
      .filter(({ command }) => command.startsWith('plugin:window|'))
      .map(({ command, payload }) => ({ command, payload })))),
    [
      { command: 'plugin:window|is_maximized', payload: { label: 'main' } },
      { command: 'plugin:window|toggle_maximize', payload: { label: 'main' } },
      { command: 'plugin:window|is_maximized', payload: { label: 'main' } },
      { command: 'plugin:window|minimize', payload: { label: 'main' } },
      { command: 'plugin:window|close', payload: { label: 'main' } },
    ]
  );
});

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
  assert.equal(r.elements['#statusLabel'].textContent, 'Task progress');
  assert.equal(activityRows(r).length, 0);
  assert.equal(r.elements['#statusPanel'].dataset.mode, 'idle');
  assert.equal(r.elements['#statusIdle'].textContent, 'What would you like to do?');
  assert.equal(r.elements['#currentLanguage'].textContent, '简体中文');
  assert.equal(r.elements['#installationBadge'].textContent, '');
  assert.equal(r.elements['#installationBadge'].dataset.state, 'unknown');
  assert.equal(r.elements['#installationBadge'].hidden, true);
  assert.equal(status.installationMode, 'modifiedOrUnverified');
  assert.equal(status.officialRecoveryAvailable, true);
  assert.equal(status.supportedVersion, '2.7.2');
  assert.equal(status.versionCompatibility, 'supported');
  assert.equal(Object.hasOwn(status, 'repoRoot'), false);
});

test('permission capability does not fabricate a startup warning before an operation fails', async () => {
  const macUnknown = boot({ status: {
    platform: 'macos', appManagementGranted: null, permissionAction: 'none',
  } });
  const windowsElevation = boot({ status: {
    platform: 'windows', appManagementGranted: false, permissionAction: 'requestElevation',
  } });
  const windowsUnwritable = boot({ status: {
    platform: 'windows', appManagementGranted: false, permissionAction: 'none',
  } });
  await flush();

  for (const runtimeState of [macUnknown, windowsElevation]) {
    assert.equal(activityRows(runtimeState).length, 0);
    assert.equal(runtimeState.elements['#statusPanel'].dataset.mode, 'idle');
    assert.equal(runtimeState.elements['#statusIdle'].textContent, 'What would you like to do?');
  }
  assert.equal(activityTitle(windowsUnwritable), 'Cavalry folder isn’t writable');
});

test('custom language select keeps Base UI open, active, selected, and keyboard states coherent', async () => {
  const r = boot();
  await flush();
  const trigger = r.elements['#languageSelectTrigger'];
  const popup = r.elements['#languageSelectPopup'];
  const popupPlaceholder = r.elements['#languageSelectPopupPlaceholder'];
  const list = r.elements['#languageSelectList'];
  const nativeSelect = r.elements['#languageSelect'];
  const key = (value) => ({
    key: value,
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    preventDefault() {},
  });

  assert.equal(trigger.disabled, false);
  assert.equal(r.elements['#languageSelectValue'].textContent, 'Choose a language');
  assert.equal(r.elements['#languageSelectValue'].dataset.placeholder, 'true');
  assert.equal(r.elements['#applyButton'].disabled, true);
  trigger.listeners.get('click')[0]();
  assert.equal(trigger.attributes.get('aria-expanded'), 'true');
  assert.equal(popup.hidden, false);
  assert.equal(popupPlaceholder.hidden, false);
  assert.equal(popupPlaceholder.textContent, 'Choose a language');
  assert.equal(list.children[0].attributes.get('aria-selected'), 'false');

  trigger.listeners.get('keydown')[0](key('ArrowDown'));
  assert.equal(trigger.attributes.get('aria-activedescendant'), 'languageSelectOption-1');
  trigger.listeners.get('keydown')[0](key('Enter'));
  assert.equal(nativeSelect.value, 'zh-Hant');
  assert.equal(r.elements['#languageSelectValue'].textContent, '繁體中文');
  assert.equal(trigger.attributes.get('aria-expanded'), 'false');
  assert.equal(popup.hidden, true);
  assert.equal(popupPlaceholder.hidden, true);
  assert.equal(trigger.focused, true);
});

test('About entry delegates to one native window command and keeps links fixed', async () => {
  const r = boot({ locale: 'zh-CN' });
  await flush();
  const button = r.elements['#aboutButton'];

  assert.equal(button.attributes.get('aria-label'), '关于 Cavalry 语言切换器');
  assert.equal(r.elements['#aboutControl'].hidden, true, 'macOS About belongs to the system application menu');
  dispatch(button, 'click');
  await flush();
  assert.deepEqual(
    JSON.parse(JSON.stringify(r.calls.filter(({ command }) => command === 'show_about'))),
    [{ command: 'show_about' }]
  );
  await assert.rejects(() => r.window.cavalryI18n.openProjectLink('https://attacker.invalid'), /Unsupported project link/);

  const windows = boot({ status: { platform: 'windows' } });
  await flush();
  assert.equal(windows.elements['#aboutControl'].hidden, false, 'Windows needs the in-window About entry');
  dispatch(windows.elements['#aboutButton'], 'click');
  await flush();
  assert.deepEqual(
    JSON.parse(JSON.stringify(windows.calls.filter(({ command }) => command === 'show_about'))),
    [{ command: 'show_about' }]
  );
});

test('About window failure uses a local Toast without overwriting the task Activity', async () => {
  const r = boot({ locale: 'zh-CN', reject: 'show_about', status: { platform: 'windows' } });
  await flush();
  const activityBefore = activityText(r);
  dispatch(r.elements['#aboutButton'], 'click');
  await flush();

  const viewport = toastViewport(r);
  assert.ok(viewport, 'the shared Toast viewport must be mounted');
  assert.equal(viewport.attributes.get('aria-label'), '通知');
  assert.equal(viewport.children.length, 1);
  assert.match(viewport.children[0].textContent, /无法打开关于窗口/);
  assert.equal(viewport.children[0].dataset.type, 'error');
  assert.equal(activityText(r), activityBefore, 'a peripheral About failure must preserve the task history');
});

test('project links keep fixed bridge ids and report browser failure inside the About window', async () => {
  const r = bootAbout({ locale: 'en-US', reject: 'open_project_link' });
  await flush();
  dispatch(r.elements['#aboutRepositoryLink'], 'click', { preventDefault() {} });
  await flush();

  assert.deepEqual(
    JSON.parse(JSON.stringify(r.calls.filter(({ command }) => command === 'open_project_link'))),
    [{ command: 'open_project_link', payload: { link: 'repository' } }]
  );
  const viewport = toastViewport(r);
  assert.equal(viewport.children.length, 1);
  assert.match(viewport.children[0].textContent, /Couldn’t open the project link/);
  assert.match(viewport.children[0].textContent, /default browser/);
});

test('idle task viewport centers one localized prompt without creating event rows', async () => {
  for (const [locale, label, prompt] of [
    ['zh-CN', '任务进度', '这次你想做什么？'],
    ['zh-TW', '任務進度', '這次你想做什麼？'],
    ['ja-JP', 'タスクの進行状況', '今回は何をしますか？'],
  ]) {
    const r = boot({ locale });
    await flush();
    assert.equal(r.elements['#statusLabel'].textContent, label, locale);
    assert.equal(activityRows(r).length, 0, locale);
    assert.equal(r.elements['#statusPanel'].dataset.mode, 'idle', locale);
    assert.equal(r.elements['#statusIdle'].textContent, prompt, locale);
    assert.equal(r.elements['#statusViewport'].hidden, true, locale);
  }
});

test('installation badge is reserved for a verified official macOS runtime', async () => {
  for (const [locale, expected] of [
    ['en-US', 'Official'],
    ['zh-CN', '官方'],
    ['zh-TW', '官方'],
    ['ja-JP', '公式'],
  ]) {
    const r = boot({ locale, status: { currentLang: 'en', installationMode: 'official' } });
    await flush();
    assert.equal(r.elements['#installationBadge'].textContent, expected, locale);
    assert.equal(r.elements['#installationBadge'].dataset.state, 'official', locale);
    assert.equal(r.elements['#installationBadge'].hidden, false, locale);
  }

  const managed = boot({ status: { currentLang: 'en', installationMode: 'modifiedOrUnverified' } });
  await flush();
  assert.equal(managed.elements['#currentLanguage'].textContent, 'English');
  assert.equal(managed.elements['#installationBadge'].hidden, true);
  assert.equal(managed.elements['#installationBadge'].textContent, '');
});

test('update icon stays hidden by default and exposes an explicit development-only tooltip preview', async () => {
  for (const [locale, tooltip] of [
    ['en-US', 'New version available'],
    ['zh-CN', '发现新版本'],
    ['zh-TW', '發現新版本'],
    ['ja-JP', '新しいバージョンがあります'],
  ]) {
    const r = boot({ locale });
    await flush();
    assert.equal(r.elements['#updateTooltipText'].textContent, tooltip, locale);
    assert.equal(r.elements['#updateControl'].hidden, true, locale);
    const statusBeforeClick = activityText(r);
    const stateBeforeClick = r.elements['#statusPanel'].dataset.state;
    dispatch(r.elements['#updateButton'], 'click');
    assert.equal(activityText(r), statusBeforeClick, locale);
    assert.equal(r.elements['#statusPanel'].dataset.state, stateBeforeClick, locale);
    assert.deepEqual(
      r.calls.filter(({ command }) => command !== 'get_status').map(({ command }) => command),
      ['check_update']
    );
  }

  const preview = boot({ preview: true });
  await flush();
  assert.equal(preview.elements['#updateControl'].hidden, false);
  assert.equal(preview.elements['#updateControl'].dataset.tooltipState, 'closed');
  preview.elements['#updateControl'].listeners.get('pointerenter')[0]({ pointerType: 'mouse' });
  assert.equal(preview.elements['#updateControl'].dataset.tooltipState, 'open');
  assert.equal(preview.elements['#updateButton'].attributes.get('aria-describedby'), 'updateTooltip');
  preview.elements['#updateControl'].listeners.get('pointerleave')[0]();
  assert.equal(preview.elements['#updateControl'].dataset.tooltipState, 'closed');
  assert.equal(preview.elements['#updateButton'].attributes.has('aria-describedby'), false);
  preview.elements['#updateControl'].listeners.get('focusin')[0]();
  assert.equal(preview.elements['#updateControl'].dataset.tooltipState, 'open');
  preview.elements['#updateButton'].listeners.get('keydown')[0]({ key: 'Escape' });
  assert.equal(preview.elements['#updateControl'].dataset.tooltipState, 'closed');
  preview.elements['#updateControl'].listeners.get('focusin')[0]();
  assert.equal(preview.elements['#updateControl'].dataset.tooltipState, 'open');
  dispatch(preview.elements['#updateButton'], 'click');
  assert.equal(preview.elements['#updateControl'].dataset.tooltipState, 'closed');
  assert.equal(preview.elements['#statusPanel'].dataset.state, 'completed');
  assert.equal(activityRows(preview)[0].children[0].dataset.icon, 'update');
  assert.match(activityText(preview), /preview is active/i);
  assert.equal(preview.calls.filter(({ command }) => command !== 'get_status').length, 0);
});

test('Tooltip filters touch and keeps only one titlebar popup open', async () => {
  const r = boot({ preview: true, status: { platform: 'windows' } });
  await flush();
  const update = r.elements['#updateControl'];
  const about = r.elements['#aboutControl'];

  update.listeners.get('pointerenter')[0]({ pointerType: 'touch' });
  assert.equal(update.dataset.tooltipState, 'closed');
  update.listeners.get('pointerenter')[0]({ pointerType: 'mouse' });
  assert.equal(update.dataset.tooltipState, 'open');
  about.listeners.get('pointerenter')[0]({ pointerType: 'mouse' });
  assert.equal(update.dataset.tooltipState, 'closed');
  assert.equal(about.dataset.tooltipState, 'open');
});

test('installation location keeps the macOS bundle and reduces a long Windows executable to drive plus install folder', async () => {
  const windowsPath = 'C:\\Users\\A-Very-Long-Account-Name\\AppData\\Local\\Cavalry\\Cavalry.exe';
  const r = boot({ status: { appPath: windowsPath, platform: 'windows' } });
  await flush();
  assert.equal(r.elements['#appPathPrefix'].textContent, 'C:\\Users\\…');
  assert.equal(r.elements['#appPathLeaf'].textContent, '\\Cavalry');
  assert.equal(r.elements['#appPath'].attributes.get('aria-label'), 'C:\\Users\\A-Very-Long-Account-Name\\AppData\\Local\\Cavalry');
  assert.ok(
    Array.from(`${r.elements['#appPathPrefix'].textContent}${r.elements['#appPathLeaf'].textContent}`).length <= 36
  );
  assert.equal(r.elements['#appPath'].title, '');
  assert.equal(r.elements['#appPath'].attributes.has('title'), false);

  const mac = boot({ status: { appPath: '/Applications/Cavalry.app', platform: 'macos' } });
  await flush();
  assert.equal(mac.elements['#appPathPrefix'].textContent, '/Applications');
  assert.equal(mac.elements['#appPathLeaf'].textContent, '/Cavalry.app');
});

test('checked update is announced, confirmed, and installed without renderer-controlled artifact data', async () => {
  const r = boot({
    update: {
      currentVersion: '0.7.0',
      version: '0.7.1',
      notes: 'Security and UI fixes',
      pubDate: '2026-08-28T00:00:00.000Z',
      available: true,
      errorCode: null,
      url: 'https://attacker.invalid/update',
      signature: 'must-not-cross',
      rawJson: '<script>',
    },
    install: {
      currentVersion: '0.7.0',
      version: '0.7.1',
      available: true,
      errorCode: 'futureBackendFailure',
    },
  });
  await flush();

  assert.equal(r.elements['#updateControl'].hidden, false);
  assert.match(r.elements['#updateAnnouncement'].textContent, /0\.7\.1/);
  const checked = await r.window.cavalryI18n.checkUpdate();
  assert.deepEqual(Object.keys(checked), [
    'currentVersion', 'version', 'notes', 'pubDate', 'available', 'errorCode',
  ]);

  r.elements['#updateControl'].listeners.get('pointerenter')[0]({ pointerType: 'mouse' });
  assert.equal(r.elements['#updateControl'].dataset.tooltipState, 'open');
  r.context.document.activeElement = r.elements['#updateButton'];
  dispatch(r.elements['#updateButton'], 'click');
  assert.equal(r.elements['#updateControl'].dataset.tooltipState, 'closed');
  assert.equal(r.elements['#modalBackdrop'].open, true);
  assert.equal(r.context.document.activeElement, r.elements['#modalPrimaryButton']);
  assert.match(r.elements['#modalTitle'].textContent, /Update the Switcher/);
  assert.doesNotMatch(r.elements['#modalBody'].textContent, /Security and UI fixes/);
  assert.match(r.elements['#modalBody'].textContent, /ad-hoc/);

  r.elements['#modalPrimaryButton'].listeners.get('click')[0]();
  await flush();
  const installs = r.calls.filter(({ command }) => command === 'install_update');
  assert.equal(installs.length, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(installs[0].payload)), { onEvent: true });
  assert.equal(r.updateChannels.length, 1, 'update install must attach one ordered Tauri Channel');
  assert.equal(activityTitle(r), 'Update downloaded');
  assert.equal(activityRows(r)[0].children[1].children[1].textContent, '100%');
  assert.equal(activityRows(r)[0].children[1].children[1].hidden, false);
  assert.match(r.elements['#statusIntro'].textContent, /^Preparing/);
  assert.match(activityText(r), /Update downloaded/);
  assert.match(activityText(r), /Verifying and installing/);
  assert.equal(r.elements['#statusPanel'].dataset.state, 'error');
  assert.match(activityText(r), /could not be installed/i);
});

test('successful updater events advance one task through download, install, and restart', async () => {
  const r = boot({
    update: {
      currentVersion: '0.7.0', version: '0.7.1', notes: null, pubDate: null,
      available: true, errorCode: null,
    },
    install: {
      currentVersion: '0.7.0', version: '0.7.1', notes: null, pubDate: null,
      available: true, errorCode: null,
    },
    installEvents: [
      { phase: 'downloading', downloaded: 25, contentLength: 100 },
      { phase: 'installing', downloaded: null, contentLength: null },
      { phase: 'restarting', downloaded: null, contentLength: null },
    ],
  });
  await flush();
  dispatch(r.elements['#updateButton'], 'click');
  r.elements['#modalPrimaryButton'].listeners.get('click')[0]();
  await flush();

  assert.match(r.elements['#statusIntro'].textContent, /^Preparing/);
  assert.equal(activityRows(r).length, 3, 'the running task keeps exactly three stable phase rows');
  assert.equal(activityRows(r)[0].children[0].dataset.icon, 'download');
  assert.equal(activityRows(r)[0].children[1].children[1].textContent, '100%');
  assert.equal(activityRows(r)[1].children[0].dataset.icon, 'package');
  assert.equal(activityRows(r)[2].children[0].dataset.icon, 'spinner');
  assert.match(activityText(r), /Restarting the Switcher/);
});

test('updater refusal never fabricates a downloading phase before the backend emits one', async () => {
  const r = boot({
    update: {
      currentVersion: '0.7.0', version: '0.7.1', notes: null, pubDate: null,
      available: true, errorCode: null,
    },
    install: {
      currentVersion: '0.7.0', version: '0.7.1', notes: null, pubDate: null,
      available: true, errorCode: 'updateBusy',
    },
    installEvents: [],
  });
  await flush();
  dispatch(r.elements['#updateButton'], 'click');
  r.elements['#modalPrimaryButton'].listeners.get('click')[0]();
  await flush();

  assert.doesNotMatch(activityText(r), /Downloading version/);
  assert.match(activityText(r), /Another operation is running/);
});

test('bootstrap keeps mutation controls disabled until status is ready', async () => {
  let resolveStatus;
  const pendingStatus = new Promise((resolve) => { resolveStatus = resolve; });
  const r = boot({ statusRequest: () => pendingStatus });
  for (const id of ['#browseButton', '#applyButton', '#restoreButton', '#languageSelect']) {
    assert.equal(r.elements[id].disabled, true, `${id} must fail closed before getStatus resolves`);
  }
  resolveStatus({
    appManagementGranted: true,
    appPath: '/Applications/Cavalry.app',
    currentLang: 'zh-Hans',
    installationMode: 'official',
    startupRecoveryError: null,
    defaultAppCandidates: ['/Applications/Cavalry.app'],
    needsExtract: false,
    permissionAction: 'none',
    platform: 'macos',
    reconciliationRequired: false,
    version: '2.7.2',
  });
  await flush();
  assert.equal(r.elements['#browseButton'].disabled, false);
  assert.equal(r.elements['#applyButton'].disabled, true);
  assert.equal(r.elements['#languageSelect'].disabled, false);
  chooseLanguage(r);
  assert.equal(r.elements['#applyButton'].disabled, false);
});

test('manual installation selection appears only when no installation is found', async () => {
  const healthy = boot();
  const missing = boot({ status: { appPath: '' } });
  const reinstall = boot({ status: { installationMode: 'modifiedOrUnverified', needsExtract: true } });
  const unwritableCustomRoot = boot({ status: {
    platform: 'windows', appManagementGranted: false, permissionAction: 'none',
  } });
  const elevationAvailable = boot({ status: {
    platform: 'windows', appManagementGranted: false, permissionAction: 'requestElevation',
  } });
  await flush();

  assert.equal(healthy.elements['#browseButton'].hidden, true);
  assert.equal(missing.elements['#browseButton'].hidden, false);
  assert.equal(reinstall.elements['#browseButton'].hidden, true);
  assert.equal(unwritableCustomRoot.elements['#browseButton'].hidden, true);
  assert.equal(elevationAvailable.elements['#browseButton'].hidden, true);
});

test('Restore AlertDialog requires an explicit action, blocks Escape dismissal, and restores focus', async () => {
  const r = boot({ status: { currentLang: 'zh-Hans' } });
  await flush();
  const trigger = r.elements['#restoreButton'];
  r.context.document.activeElement = trigger;
  trigger.listeners.get('click')[0]();
  assert.equal(r.elements['#modalBackdrop'].open, true);
  assert.equal(r.context.document.activeElement, r.elements['#modalPrimaryButton']);

  let cancelPrevented = false;
  r.elements['#modalBackdrop'].listeners.get('cancel')[0]({ preventDefault() { cancelPrevented = true; } });
  assert.equal(cancelPrevented, true);
  assert.equal(r.elements['#modalBackdrop'].open, true, 'Escape must not dismiss an AlertDialog');
  r.elements['#modalSecondaryButton'].listeners.get('click')[0]();
  assert.equal(r.elements['#modalBackdrop'].open, false);
  assert.equal(trigger.focused, true, 'the original trigger regains focus after close');
  assert.equal(r.calls.filter(({ command }) => command === 'apply_language').length, 0);
});

test('single Restore maps to the platform transaction and remains visible when not needed', async () => {
  const macos = boot({
    status: { platform: 'macos', currentLang: 'zh-Hans', installationMode: 'modifiedOrUnverified' },
  });
  await flush();
  assert.equal(macos.elements['#restoreButton'].textContent, 'Restore English');
  assert.equal(macos.elements['#restoreButton'].hidden, false);
  assert.equal(macos.elements['#restoreButton'].disabled, false);
  macos.elements['#restoreButton'].listeners.get('click')[0]();
  assert.equal(macos.elements['#modalTitle'].textContent, 'Restore Cavalry?');
  assert.equal(macos.elements['#modalPrimaryButton'].textContent, 'Restore English');
  macos.elements['#modalPrimaryButton'].listeners.get('click')[0]();
  await flush();
  assert.deepEqual(JSON.parse(JSON.stringify(macos.calls.filter(({ command }) => command === 'apply_language')[0])), {
    command: 'apply_language', payload: { appPath: '/Applications/Cavalry.app', lang: 'restore-official' },
  });

  const windows = boot({
    status: { platform: 'windows', currentLang: 'en', reconciliationRequired: true },
    apply: { ok: true, currentLang: 'en' },
  });
  await flush();
  assert.equal(windows.elements['#restoreButton'].disabled, false);
  assert.equal(windows.elements['#statusLabel'].textContent, 'Task progress');
  assert.equal(activityTitle(windows), 'Restore Cavalry to finish cleanup');
  windows.elements['#restoreButton'].listeners.get('click')[0]();
  assert.equal(windows.elements['#modalTitle'].textContent, 'Restore Cavalry?');
  windows.elements['#modalPrimaryButton'].listeners.get('click')[0]();
  await flush();
  assert.deepEqual(JSON.parse(JSON.stringify(windows.calls.filter(({ command }) => command === 'apply_language')[0])), {
    command: 'apply_language', payload: { appPath: '/Applications/Cavalry.app', lang: 'en' },
  });

  const official = boot({ status: { installationMode: 'official', currentLang: 'en' } });
  await flush();
  assert.equal(official.elements['#restoreButton'].hidden, false);
  assert.equal(official.elements['#restoreButton'].disabled, true);
  assert.equal(official.elements['#installationMode'].textContent, 'Installation: verified official runtime');
  assert.equal(official.elements['#installationBadge'].textContent, 'Official');
  assert.equal(official.elements['#installationBadge'].dataset.state, 'official');
});

test('managed legacy macOS remains actionable and Restore returns to managed English', async () => {
  const r = boot({
    status: {
      platform: 'macos', currentLang: 'zh-Hans', installationMode: 'managedLegacy',
      officialRecoveryAvailable: false, needsExtract: false,
    },
    apply: { ok: true, currentLang: 'en' },
  });
  await flush();

  assert.equal(r.elements['#applyButton'].disabled, true, 'Switch waits for an explicit language selection');
  assert.equal(r.elements['#restoreButton'].disabled, false, 'known legacy management evidence remains recoverable');
  assert.notEqual(activityTitle(r), 'Reinstall Cavalry');
  chooseLanguage(r);
  assert.equal(r.elements['#applyButton'].disabled, false);

  r.elements['#restoreButton'].listeners.get('click')[0]();
  r.elements['#modalPrimaryButton'].listeners.get('click')[0]();
  await flush();
  assert.deepEqual(JSON.parse(JSON.stringify(r.calls.filter(({ command }) => command === 'apply_language')[0])), {
    command: 'apply_language', payload: { appPath: '/Applications/Cavalry.app', lang: 'en' },
  });
  assert.equal(r.elements['#statusOutcome'].textContent, 'Restored English. Cavalry is now open.');
});

test('unsupported Cavalry versions are read-only and preserve the user\'s upgrade direction', async () => {
  const older = boot({ status: { version: '2.7.1', versionCompatibility: 'olderUnsupported' } });
  const newer = boot({ status: { version: '2.7.3', versionCompatibility: 'newerUnsupported' } });
  const unknown = boot({ status: { version: 'preview', versionCompatibility: 'unknownUnsupported' } });
  await flush();

  for (const r of [older, newer, unknown]) {
    assert.equal(r.elements['#languageSelect'].disabled, true);
    assert.equal(r.elements['#applyButton'].disabled, true);
    assert.equal(r.elements['#restoreButton'].disabled, true);
    assert.equal(r.calls.some(({ command }) => command === 'apply_language'), false);
  }
  assert.equal(activityTitle(older), 'Cavalry 2.7.1 isn’t supported');
  assert.match(activityText(older), /update Cavalry to 2\.7\.2/i);
  assert.equal(activityTitle(newer), 'Cavalry 2.7.3 isn’t supported yet');
  assert.match(activityText(newer), /won’t modify your newer installation/i);
  assert.match(activityText(newer), /keep using Cavalry normally/i);
  assert.doesNotMatch(activityText(newer), /downgrade|reinstall Cavalry/i);
  assert.equal(activityTitle(unknown), 'This Cavalry version isn’t supported');
  assert.match(activityText(unknown), /has not changed your installation/i);
});

test('clean official macOS install with needsExtract allows Apply to establish its baseline', async () => {
  const r = boot({
    status: { platform: 'macos', currentLang: 'en', installationMode: 'official', needsExtract: true },
    apply: { ok: true, currentLang: 'zh-Hans' },
  });
  await flush();
  chooseLanguage(r);
  assert.equal(r.elements['#applyButton'].disabled, false);
  assert.equal(r.elements['#restoreButton'].disabled, true);
  r.elements['#applyButton'].listeners.get('click')[0]();
  assert.equal(r.elements['#modalBackdrop'].open, false, 'Switch must enter the task directly');
  assert.equal(r.elements['#statusLabel'].textContent, 'Task progress');
  assert.match(r.elements['#statusIntro'].textContent, /^Preparing/);
  assert.equal(activityTitle(r), 'Checking the Cavalry installation');
  await flush();
  assert.deepEqual(activityRows(r).map((row) => row.children[0].dataset.icon), [
    'verify', 'archive', 'translate', 'restart',
  ]);
  assert.equal(r.elements['#statusOutcome'].textContent, 'Switched to 简体中文. Cavalry is now open.');
  assert.deepEqual(JSON.parse(JSON.stringify(r.calls.filter(({ command }) => command === 'apply_language')[0])), {
    command: 'apply_language', payload: { appPath: '/Applications/Cavalry.app', lang: 'zh-Hans' },
  });
  assert.equal(r.channels.length, 1, 'apply must attach one ordered Tauri Channel');
});

test('apply invokes exactly one backend transaction and never exposes a second restart call', async () => {
  const r = boot(); await flush();
  chooseLanguage(r);
  r.elements['#applyButton'].listeners.get('click')[0]();
  await flush();
  assert.deepEqual(JSON.parse(JSON.stringify(r.calls.filter(({ command }) => command === 'apply_language')[0])), {
    command: 'apply_language', payload: { appPath: '/Applications/Cavalry.app', lang: 'zh-Hans' },
  });
  assert.equal(r.calls.some(({ command }) => command === 'restart_cavalry'), false);
});

test('Windows englishRestoreNeeded residue is actionable through Restore despite needsExtract', async () => {
  const r = boot({
    status: { platform: 'windows', currentLang: 'en', needsExtract: true, reconciliationRequired: true },
    apply: { ok: true, currentLang: 'en' },
  });
  await flush();
  assert.equal(r.elements['#installationBadge'].hidden, true, 'macOS-only installation trust badge stays hidden on Windows');
  assert.equal(r.elements['#restoreButton'].disabled, false, 'Windows residue may restore without a baseline snapshot');
  assert.equal(r.elements['#applyButton'].disabled, true, 'Restore remains actionable without silently choosing a new target language');
  assert.equal(activityTitle(r), 'Restore Cavalry to finish cleanup');
  assert.match(activityText(r), /previous Windows language setup/i);
  r.elements['#restoreButton'].listeners.get('click')[0]();
  r.elements['#modalPrimaryButton'].listeners.get('click')[0]();
  await flush();
  assert.deepEqual(JSON.parse(JSON.stringify(r.calls.filter(({ command }) => command === 'apply_language')[0])), {
    command: 'apply_language', payload: { appPath: '/Applications/Cavalry.app', lang: 'en' },
  });
});

test('single Windows Restore reuses the ordinary UAC retry path', async () => {
  const r = boot({
    status: { platform: 'windows', currentLang: 'en', reconciliationRequired: true, permissionAction: 'requestElevation' },
    apply: [
      { ok: false, permissionRequired: true, errorCode: 'permissionRequired' },
      { ok: true, currentLang: 'en' },
    ],
  });
  await flush();
  r.elements['#restoreButton'].listeners.get('click')[0]();
  r.elements['#modalPrimaryButton'].listeners.get('click')[0]();
  await flush();
  assert.equal(r.elements['#modalTitle'].textContent, 'Administrator permission required');
  assert.equal(r.elements['#modalBody'].textContent, 'Retry as administrator, then allow the change when Windows asks.');
  assert.equal(r.calls.filter(({ command }) => command === 'apply_language').length, 1);
  r.elements['#modalPrimaryButton'].listeners.get('click')[0]();
  await flush();
  assert.deepEqual(JSON.parse(JSON.stringify(r.calls.filter(({ command }) => command === 'apply_language')[1])), {
    command: 'apply_language', payload: { appPath: '/Applications/Cavalry.app', lang: 'en' },
  });
});

test('permission AlertDialog exposes the recovery action and preserves Apply/Restore labels', async () => {
  const r = boot({
    status: { platform: 'macos', currentLang: 'zh-Hans', permissionAction: 'none' },
    apply: [
      { ok: false, permissionRequired: true, errorCode: 'permissionRequired' },
      { ok: true, currentLang: 'zh-Hans' },
    ],
  });
  await flush();
  const labels = {
    apply: r.elements['#applyButton'].textContent,
    restore: r.elements['#restoreButton'].textContent,
  };
  assert.deepEqual(labels, { apply: 'Switch', restore: 'Restore English' });

  chooseLanguage(r);
  r.elements['#applyButton'].listeners.get('click')[0]();
  await flush();

  assert.equal(r.elements['#modalTitle'].textContent, 'Allow changes to Cavalry');
  assert.equal(r.elements['#modalBody'].textContent, 'In System Settings, allow Cavalry Language Switcher to modify Cavalry, then retry.');
  assert.equal(r.elements['#modalPrimaryButton'].textContent, 'Open Settings');
  assert.equal(r.elements['#modalSecondaryButton'].textContent, 'Cancel');
  assert.notEqual(r.elements['#modalPrimaryButton'].textContent, 'Retry Apply');
  assert.equal(r.elements['#applyButton'].textContent, labels.apply);
  assert.equal(r.elements['#restoreButton'].textContent, labels.restore);
  const permissionRows = activityRows(r);
  assert.equal(activityTitle(r, 0), 'Cavalry installation verified');
  assert.equal(activityTitle(r, 1), 'Recovery files ready');
  assert.equal(activityTitle(r, permissionRows.length - 1), 'System permission required');
  assert.match(activityText(r), /Allow the Switcher to modify Cavalry, then retry\./);
  assert.doesNotMatch(activityText(r), /desktop service|could not verify the Cavalry installation/i);

  r.elements['#modalSecondaryButton'].listeners.get('click')[0]();
  await flush();
  assert.equal(r.elements['#applyButton'].textContent, labels.apply);
  assert.equal(r.elements['#restoreButton'].textContent, labels.restore);
});

test('macOS handoff captures the real action and only its session Channel retries the original operation', async () => {
  const r = boot({
    status: { platform: 'macos', currentLang: 'en', permissionAction: 'openPrivacy' },
    apply: [
      { ok: false, permissionRequired: true, errorCode: 'permissionRequired' },
      { ok: true, currentLang: 'zh-Hans' },
    ],
  });
  await flush();
  chooseLanguage(r);
  dispatch(r.elements['#applyButton'], 'click');
  await flush();
  assert.equal(r.elements['#modalBackdrop'].open, true);

  dispatch(r.elements['#modalPrimaryButton'], 'click');
  await flush();
  const call = r.calls.find(({ command }) => command === 'open_privacy_security');
  assert.deepEqual(JSON.parse(JSON.stringify(call.payload.request)), {
    permission: 'appManagement',
    sourceRect: { x: 10, y: 10, width: 100, height: 32 },
    viewportCss: { width: 400, height: 484 },
  });
  assert.equal(call.payload.onEvent, true);
  assert.equal(r.elements['#modalBackdrop'].open, false, 'native start acknowledgement closes the source only after capture');
  assert.equal(r.calls.filter(({ command }) => command === 'apply_language').length, 1);

  const channel = r.handoffChannels[0];
  r.callbacks.get(channel.id)({ index: 0, message: { outcome: 'retryRequested' } });
  await flush();
  assert.equal(r.calls.filter(({ command }) => command === 'apply_language').length, 2);
});

test('macOS handoff keeps one prerequisite history when the in-process oracle is still denied', async () => {
  const r = boot({
    status: { platform: 'macos', currentLang: 'en', permissionAction: 'openPrivacy' },
    apply: [
      { ok: false, permissionRequired: true, errorCode: 'permissionRequired' },
      { ok: false, permissionRequired: true, errorCode: 'permissionRequired' },
    ],
  });
  await flush();
  chooseLanguage(r);
  dispatch(r.elements['#applyButton'], 'click');
  await flush();
  dispatch(r.elements['#modalPrimaryButton'], 'click');
  await flush();

  const channel = r.handoffChannels[0];
  r.callbacks.get(channel.id)({ index: 0, message: { outcome: 'retryRequested' } });
  await flush();

  const titles = activityRows(r).map((_row, index) => activityTitle(r, index));
  assert.equal(titles.filter((title) => title === 'Cavalry installation verified').length, 1);
  assert.equal(titles.filter((title) => title === 'Recovery files ready').length, 1);
  assert.equal(titles.at(-1), 'Reopen the Switcher');
  assert.match(activityText(r), /The new permission takes effect after the Switcher quits/);
});

test('macOS handoff allows only one retry transaction in flight per session', async () => {
  const r = runtime();
  vm.runInNewContext(read('renderer/permission-handoff.js'), r.context, { filename: 'permission-handoff.js' });
  let emit;
  let releaseRetry;
  let retryCount = 0;
  const retryPending = new Promise((resolve) => { releaseRetry = resolve; });
  const controller = r.window.createPermissionHandoffController({
    api: {
      openPrivacySecurity: async (_request, onEvent) => {
        emit = onEvent;
        return { ok: true };
      },
    },
    onRetry: () => {
      retryCount += 1;
      return retryPending;
    },
    onError: () => assert.fail('retry guard must not create an error'),
  });

  await controller.open(r.elements['#modalPrimaryButton']);
  emit({ outcome: 'retryRequested' });
  emit({ outcome: 'retryRequested' });
  await flush();
  assert.equal(retryCount, 1, 'duplicate native Retry/drop events must share the active transaction');

  releaseRetry();
  await flush();
  emit({ outcome: 'retryRequested' });
  await flush();
  assert.equal(retryCount, 2, 'a still-denied result may retry after the prior transaction settles');
});

test('transport rejection becomes a localized stable status and re-bootstrap attempt', async () => {
  const r = boot({ reject: 'browse_app' }); await flush();
  r.elements['#browseButton'].listeners.get('click')[0]();
  await flush();
  assert.match(activityText(r), /Could not contact the desktop service\. Try again\./);
  assert.equal(r.elements['#statusPanel'].dataset.state, 'error');
  assert.equal(r.calls.filter(({ command }) => command === 'get_status').length, 2);
});

test('startup recovery failure blocks mutations without exposing raw backend diagnostics', async () => {
  const r = boot({ status: {
    installationMode: 'recoveryRequired',
    startupRecoveryError: 'Cavalry is still running',
  } });
  await flush();
  for (const id of ['#browseButton', '#applyButton', '#restoreButton', '#languageSelect']) {
    assert.equal(r.elements[id].disabled, true, `${id} must be blocked`);
  }
  assert.equal(activityTitle(r), 'Couldn’t recover the interrupted operation');
  assert.match(activityText(r), /couldn.t recover an interrupted update/i);
  assert.doesNotMatch(activityText(r), /Cavalry is still running/);
  assert.equal(r.elements['#statusPanel'].dataset.state, 'error');
  assert.equal(r.elements['#installationBadge'].hidden, true, 'transaction recovery must stay in the actionable Alert instead of masquerading as installation classification');
});


test('macOS incomplete provenance gives a direct reinstall route and blocks Restore', async () => {
  const r = boot({ status: { installationMode: 'modifiedOrUnverified', needsExtract: true } }); await flush();
  assert.equal(r.elements['#restoreButton'].hidden, false, 'the unavailable restore route remains visible');
  assert.equal(r.elements['#restoreButton'].disabled, true, 'official restore must be unavailable with incomplete provenance');
  assert.equal(r.elements['#applyButton'].disabled, true);
  assert.equal(activityTitle(r), 'Reinstall Cavalry');
  assert.match(activityText(r), /Reinstall Cavalry from the official installer/);
  assert.match(activityText(r), /reopen the Switcher/);
  assert.doesNotMatch(activityText(r), /choose the new installation/);
  assert.equal(r.elements['#statusPanel'].dataset.state, 'error');
  r.elements['#restoreButton'].listeners.get('click')[0]();
  assert.equal(r.calls.some(({ command }) => command === 'apply_language'), false, 'a synthetic click cannot bypass the disabled restore route');
  assert.match(activityText(r), /original English files cannot be verified/);
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
  chooseLanguage(r);
  r.elements['#applyButton'].listeners.get('click')[0]();
  await flush();
  assert.equal(r.elements['#statusPanel'].dataset.state, 'warning');
  assert.match(activityText(r), /Cavalry 未打开/);
  assert.match(activityText(r), /临时清理尚未完成/);
  assert.doesNotMatch(activityText(r), /untrusted backend prose/);
});

test('state durability warning blocks mutations and requires a Switcher restart', async () => {
  const r = boot({
    apply: {
      ok: true,
      currentLang: 'zh-Hans',
      warning: 'state path and raw fsync failure must stay private',
      warningCodes: ['stateDurabilityPending'],
    },
  });
  await flush();

  chooseLanguage(r);
  r.elements['#applyButton'].listeners.get('click')[0]();
  await flush();
  assert.equal(r.elements['#statusPanel'].dataset.state, 'warning');
  assert.match(activityText(r), /Restart the Switcher/);
  assert.doesNotMatch(activityText(r), /state path|raw fsync/i);
  for (const id of ['#browseButton', '#applyButton', '#restoreButton', '#languageSelect']) {
    assert.equal(r.elements[id].disabled, true, `${id} must stay blocked pending durability`);
  }
  assert.equal(r.window.cavalryI18n.extractEnglish, undefined, 'the renderer must not expose manual baseline refresh');
});
