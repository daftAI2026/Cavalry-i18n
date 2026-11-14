#!/usr/bin/env node
/**
 * [INPUT]: renderer bridge/user-profile-text/ui-text/language-scope/version-guidance/icons/select/tooltip/path/operation-log/permission-handoff/update-progress/toast/support-footer/about/window-controls/app.js 与最小 fake DOM、Tauri invoke/Channel fake。
 * [OUTPUT]: 验证2.8正常启动沿用p12待机且真实故障保留；验证unset/explicit共用English标签且不改变恢复能力；验证单行关注 footer 四语文案/提示/无障碍名称与 GitHub/X/小红书固定 ID 分发；验证 About「关注」文案和平台区分的四语名称；验证旧宿主四语不支持提示、2.7.2专用p12入口和禁用Switch；保留 camelCase scope/错误白名单、严格 Restore/恢复语义、失败 Activity、局部外链 Toast、任务流、权限、Updater 与组件状态机合同。
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
  constructor() { this.children = []; this._textContent = ''; this.dataset = {}; this.listeners = new Map(); this.attributes = new Map(); this.hidden = false; this.disabled = false; this.value = ''; this.open = false; this.focused = false; this.isConnected = true; this.ownerDocument = null; this.className = ''; this.scrollTop = 0; this.title = ''; this.rect = { x: 10, y: 10, left: 10, top: 10, width: 100, height: 32, right: 110, bottom: 42 }; this.style = { values: new Map(), setProperty: (key, value) => this.style.values.set(key, value) }; this.offsetHeight = 64; }
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
  getBoundingClientRect() { return this.rect; }
}

function runtime({
  status = {},
  reject = null,
  apply = { ok: true, currentLang: 'zh-Hans' },
  applyEvents = null,
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
  aboutPlatform = 'other',
  projectLinkResult = { ok: true },
} = {}) {
  const ids = ['skipLink', 'windowTitle', 'appVersion', 'appPath', 'appPathPrefix', 'appPathLeaf', 'updateControl', 'updateButton', 'updateTooltip', 'updateTooltipText', 'updateAnnouncement', 'supportFooterMessage', 'supportFollowHand', 'supportFollowHandImage', 'supportFooterLinks', 'supportGithubLink', 'supportGithubIcon', 'supportTwitterLink', 'supportTwitterIcon', 'supportXiaohongshuLink', 'supportXiaohongshuIcon', 'aboutControl', 'aboutButton', 'aboutTooltip', 'aboutTooltipText', 'aboutTitle', 'aboutVersion', 'aboutLinks', 'aboutLicenseLabel', 'aboutTwitterLink', 'aboutTwitterLabel', 'aboutTwitterIcon', 'aboutXiaohongshuLink', 'aboutXiaohongshuLabel', 'aboutXiaohongshuIcon', 'aboutRepositoryLink', 'aboutRepositoryIcon', 'aboutLicenseLink', 'aboutWindowControls', 'aboutWindowCloseButton', 'windowsWindowControls', 'windowMinimizeButton', 'windowMaximizeButton', 'windowCloseButton', 'languageSectionLabel', 'currentLabel', 'currentLanguage', 'installationBadge', 'installationMode', 'switchToLabel', 'languageSelectRoot', 'languageSelect', 'languageSelectTrigger', 'languageSelectValue', 'languageSelectPopup', 'languageSelectPopupPlaceholder', 'languageSelectList', 'browseButton', 'applyButton', 'restoreButton', 'permissionButton', 'legacyReleaseButton', 'reportIssueButton', 'statusPanel', 'statusLabel', 'statusIdle', 'statusIntro', 'statusViewport', 'statusOutcome', 'modalBackdrop', 'modalTitle', 'modalBody', 'modalPrimaryButton', 'modalSecondaryButton', 'statusText'];
  const elements = Object.fromEntries(ids.map((id) => [`#${id}`, new Element()]));
  const calls = [];
  const channels = [];
  const updateChannels = [];
  const handoffChannels = [];
  const callbacks = new Map();
  let nextCallbackId = 1;
  const document = {
    documentElement: new Element(), body: new Element(), activeElement: null, title: '',
    visibilityState: 'visible', hasFocus: () => true,
    listeners: new Map(),
    querySelector(selector) { return elements[selector]; },
    createElement() { const element = new Element(); element.ownerDocument = this; return element; },
    createElementNS() { const element = new Element(); element.ownerDocument = this; return element; },
    addEventListener(type, callback) { this.listeners.set(type, [...(this.listeners.get(type) || []), callback]); },
  };
  for (const element of [...Object.values(elements), document.documentElement, document.body]) {
    element.ownerDocument = document;
  }
  document.documentElement.dataset.platform = aboutPlatform;
  const defaultStatus = {
    appManagementGranted: true, appPath: '/Applications/Cavalry.app', currentLang: 'zh-Hans',
    defaultAppCandidates: ['/Applications/Cavalry.app'], languages: [{ value: 'attacker', label: '<img>' }],
    installationMode: 'modifiedOrUnverified', officialRecoveryAvailable: true,
    macosPermissionHandoffRequired: false, needsExtract: false, permissionAction: 'none', platform: 'macos', supportedVersion: '2.7.2',
    version: '2.7.2', versionCompatibility: 'supported', patchStatus: 'current', ...status,
  };
  const applyResults = Array.isArray(apply) ? [...apply] : [apply];
  const nextResult = (results) => (results.length > 1 ? results.shift() : results[0]);
  let maximized = false;
  const windowListeners = new Map();
  const navigator = { language: locale, languages: [locale] };
  const window = {
    navigator,
    MutationObserver: class { observe() {} disconnect() {} },
    innerWidth: 400,
    innerHeight: 556,
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
        const events = applyEvents || (result.ok
          ? [
              { phase: 'verifyInstallation', state: 'running' },
              { phase: 'verifyInstallation', state: 'completed' },
              { phase: 'ensureBaseline', state: 'running' },
              { phase: 'ensureBaseline', state: 'completed' },
              { phase: 'applyTransaction', state: 'running' },
              { phase: 'applyTransaction', state: (result.warningCodes || []).some((code) => code !== 'restartFailed') ? 'warning' : 'completed' },
              ...(result.nativeRestoreOnly === true ? [] : [
                { phase: 'restartCavalry', state: 'running' },
                { phase: 'restartCavalry', state: (result.warningCodes || []).includes('restartFailed') || result.warningCode === 'restartFailed' ? 'warning' : 'completed' },
              ]),
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
              ]);
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
    if (command === 'open_project_link') return Promise.resolve(projectLinkResult);
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
function chooseLanguage(runtimeState, index = null) {
  dispatch(runtimeState.elements['#languageSelectTrigger'], 'click');
  const items = runtimeState.elements['#languageSelectList'].children;
  const target = index ?? items.findIndex((item) => item.dataset.disabled !== 'true');
  dispatch(items[target], 'click');
}
function boot(options) {
  const r = runtime(options);
  vm.runInNewContext(read('renderer/tauri-bridge.js'), r.context, { filename: 'bridge.js' });
  vm.runInNewContext(read('renderer/user-profile-text.js'), r.context, { filename: 'user-profile-text.js' });
  vm.runInNewContext(read('renderer/ui-text.js'), r.context, { filename: 'ui-text.js' });
  vm.runInNewContext(read('renderer/language-scope.js'), r.context, { filename: 'language-scope.js' });
  vm.runInNewContext(read('renderer/version-guidance.js'), r.context, { filename: 'version-guidance.js' });
  vm.runInNewContext(read('renderer/icons.js'), r.context, { filename: 'icons.js' });
  vm.runInNewContext(read('renderer/select-control.js'), r.context, { filename: 'select-control.js' });
  vm.runInNewContext(read('renderer/tooltip-control.js'), r.context, { filename: 'tooltip-control.js' });
  vm.runInNewContext(read('renderer/path-display.js'), r.context, { filename: 'path-display.js' });
  vm.runInNewContext(read('renderer/operation-log.js'), r.context, { filename: 'operation-log.js' });
  vm.runInNewContext(read('renderer/permission-handoff.js'), r.context, { filename: 'permission-handoff.js' });
  vm.runInNewContext(read('renderer/update-progress.js'), r.context, { filename: 'update-progress.js' });
  vm.runInNewContext(read('renderer/toast-control.js'), r.context, { filename: 'toast-control.js' });
  vm.runInNewContext(read('renderer/project-link-control.js'), r.context, { filename: 'project-link-control.js' });
  vm.runInNewContext(read('renderer/support-follow-hand.js'), r.context, { filename: 'support-follow-hand.js' });
  vm.runInNewContext(read('renderer/support-footer.js'), r.context, { filename: 'support-footer.js' });
  vm.runInNewContext(read('renderer/about-control.js'), r.context, { filename: 'about-control.js' });
  vm.runInNewContext(read('renderer/window-controls.js'), r.context, { filename: 'window-controls.js' });
  vm.runInNewContext(read('renderer/app.js'), r.context, { filename: 'app.js' });
  return r;
}

function bootAbout(options) {
  const r = runtime(options);
  vm.runInNewContext(read('renderer/tauri-bridge.js'), r.context, { filename: 'bridge.js' });
  vm.runInNewContext(read('renderer/user-profile-text.js'), r.context, { filename: 'user-profile-text.js' });
  vm.runInNewContext(read('renderer/ui-text.js'), r.context, { filename: 'ui-text.js' });
  vm.runInNewContext(read('renderer/icons.js'), r.context, { filename: 'icons.js' });
  vm.runInNewContext(read('renderer/toast-control.js'), r.context, { filename: 'toast-control.js' });
  vm.runInNewContext(read('renderer/project-link-control.js'), r.context, { filename: 'project-link-control.js' });
  vm.runInNewContext(read('renderer/about-window.js'), r.context, { filename: 'about-window.js' });
  return r;
}

function activityRows(runtimeState) { return runtimeState.elements['#statusText'].children; }
function activityText(runtimeState) { return runtimeState.elements['#statusText'].textContent; }
function activityTitle(runtimeState, index = 0) { return activityRows(runtimeState)[index]?.children[1]?.children[0]?.textContent || ''; }
function toastViewport(runtimeState) { return runtimeState.context.document.body.children.find((child) => child.className === 'toast-viewport'); }

test('main support footer localizes all four accessible labels and dispatches only fixed links', async () => {
  const cases = [
    { locale: 'en-US', message: 'Follow us', nav: 'Support links', github: 'Star us on GitHub', twitter: 'Follow us on X (Twitter)', xiaohongshu: 'Follow us on Xiaohongshu' },
    { locale: 'zh-CN', message: '关注我们', nav: '支持链接', github: '在 GitHub 点 Star 支持我们', twitter: '在 X（Twitter）关注我们', xiaohongshu: '在小红书关注我们' },
    { locale: 'zh-TW', message: '關注我們', nav: '支援連結', github: '在 GitHub 點 Star 支持我們', twitter: '在 X（Twitter）關注我們', xiaohongshu: '在小紅書關注我們' },
    { locale: 'ja-JP', message: 'フォローする', nav: 'サポートリンク', github: 'GitHub で Star を付ける', twitter: 'X（Twitter）でフォローする', xiaohongshu: '小紅書でフォローする' },
  ];
  for (const expected of cases) {
    const r = boot({ locale: expected.locale, projectLinkResult: { ok: false } });
    await flush();
    assert.equal(r.elements['#supportFooterMessage'].textContent, expected.message);
    assert.equal(r.elements['#supportFooterLinks'].attributes.get('aria-label'), expected.nav);
    assert.equal(r.elements['#supportGithubLink'].attributes.get('aria-label'), expected.github);
    assert.equal(r.elements['#supportTwitterLink'].attributes.get('aria-label'), expected.twitter);
    assert.equal(r.elements['#supportXiaohongshuLink'].attributes.get('aria-label'), expected.xiaohongshu);
    for (const [id, label] of [['supportGithubLink', expected.github], ['supportTwitterLink', expected.twitter], ['supportXiaohongshuLink', expected.xiaohongshu]]) {
      assert.equal(r.elements[`#${id}`].attributes.get('title'), label);
    }
    const before = activityText(r);
    let prevented = 0;
    for (const id of ['supportGithubLink', 'supportTwitterLink', 'supportXiaohongshuLink']) {
      dispatch(r.elements[`#${id}`], 'click', { preventDefault() { prevented += 1; } });
    }
    await flush();
    assert.equal(prevented, 3);
    assert.deepEqual(
      r.calls.filter(({ command }) => command === 'open_project_link').map(({ payload }) => payload.link),
      ['repository', 'twitter', 'xiaohongshu']
    );
    assert.equal(activityText(r), before, 'footer failures stay in Toast and do not add Activity rows');
    assert.ok(toastViewport(r), 'a fixed-link failure must use the shared peripheral Toast');
  }
});

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
  assert.equal(r.elements['#languageSelect'].children[0].disabled, true);
  assert.equal(r.elements['#languageSelectList'].children[0].attributes.get('aria-disabled'), 'true');
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
  assert.equal(status.macosPermissionHandoffRequired, false);
  assert.equal(status.supportedVersion, '2.7.2');
  assert.equal(status.versionCompatibility, 'supported');
  assert.equal(Object.hasOwn(status, 'repoRoot'), false);

  const windows = boot({ status: { platform: 'windows', macosPermissionHandoffRequired: true } });
  await flush();
  const windowsStatus = await windows.window.cavalryI18n.getStatus();
  assert.equal(windowsStatus.macosPermissionHandoffRequired, false);
});

test('language patch status controls the current option, badge, and localized update action', async () => {
  const locales = [
    ['en-US', 'Update available', 'Update'],
    ['zh-CN', '可更新', '更新'],
    ['zh-TW', '可更新', '更新'],
    ['ja-JP', '更新可能', '更新'],
  ];

  for (const [locale, badgeText, updateAction] of locales) {
    const r = boot({
      locale,
      status: { currentLang: 'zh-Hans', patchStatus: 'updateAvailable' },
    });
    await flush();
    const current = r.elements['#languageSelectList'].children[0];
    assert.equal(r.elements['#languageSelect'].value, '', `${locale}: bootstrap must not select a language`);
    assert.equal(current.dataset.value, 'zh-Hans');
    assert.equal(current.dataset.disabled, 'false');
    assert.equal(current.attributes.get('aria-disabled'), 'false');
    assert.equal(current.children[0].className, 'select-item-copy');
    assert.equal(current.children[0].children[1].className, 'badge select-item-badge');
    assert.equal(current.children[0].children[1].textContent, badgeText);
    assert.equal(current.children[0].children[1].attributes.get('aria-hidden'), 'true');
    assert.match(current.attributes.get('aria-label'), new RegExp(`${badgeText}$`));

    chooseLanguage(r, 0);
    assert.equal(r.elements['#languageSelect'].value, 'zh-Hans');
    const selectedCopy = r.elements['#languageSelectValue'];
    assert.equal(selectedCopy.textContent, `简体中文${badgeText}`,
      `${locale}: selecting an update must retain its status in the closed trigger`);
    assert.equal(selectedCopy.attributes.get('aria-label'), current.attributes.get('aria-label'));
    assert.equal(r.elements['#applyButton'].textContent, updateAction, locale);
    assert.equal(r.elements['#applyButton'].disabled, false, `${locale}: update action must be available`);
    chooseLanguage(r, 1);
    assert.equal(selectedCopy.textContent, '繁體中文', `${locale}: another language must not inherit the badge`);
    chooseLanguage(r, 0);
    assert.equal(selectedCopy.textContent, `简体中文${badgeText}`);
  }

  const current = boot({ status: { currentLang: 'zh-Hans', patchStatus: 'current' } });
  await flush();
  const currentOption = current.elements['#languageSelectList'].children[0];
  assert.equal(currentOption.dataset.disabled, 'true');
  assert.equal(currentOption.children.length, 2, 'current patch must not render a badge');
  chooseLanguage(current, 0);
  assert.equal(current.elements['#languageSelect'].value, '');
  assert.equal(current.elements['#applyButton'].disabled, true);

  const notApplicable = boot({ status: { currentLang: 'zh-Hans', patchStatus: 'notApplicable' } });
  await flush();
  const notApplicableOption = notApplicable.elements['#languageSelectList'].children[0];
  assert.equal(notApplicableOption.dataset.disabled, 'false', 'only current patch status disables the current language');
  assert.equal(notApplicableOption.children.length, 2, 'notApplicable must not render an update badge');

  const legacy = boot({
    statusRequest: (status) => {
      const { patchStatus, ...withoutPatchStatus } = status;
      return withoutPatchStatus;
    },
  });
  await flush();
  const legacyStatus = await legacy.window.cavalryI18n.getStatus();
  assert.equal(legacyStatus.patchStatus, 'unknown', 'legacy getStatus responses must fail closed to unknown');
  assert.equal(legacy.elements['#languageSelectList'].children[0].dataset.disabled, 'false');
  assert.equal(legacy.elements['#languageSelectList'].children[0].children[0].children[1].textContent, 'Update available');
});

test('selected badge follows option refresh and clears stale content', () => {
  const r = runtime({});
  vm.runInNewContext(read('renderer/select-control.js'), r.context);
  const e = r.elements;
  const control = r.window.createSelectControl({
    root: e['#languageSelectRoot'], select: e['#languageSelect'],
    trigger: e['#languageSelectTrigger'], value: e['#languageSelectValue'],
    popup: e['#languageSelectPopup'], popupPlaceholder: e['#languageSelectPopupPlaceholder'],
    list: e['#languageSelectList'],
  });
  control.setPlaceholder('Choose');
  const option = { value: 'zh-Hans', label: '简体中文', badge: { label: '可更新' } };
  control.setOptions([option]);
  control.setValue('zh-Hans');
  assert.equal(e['#languageSelectValue'].textContent, '简体中文可更新');
  control.setDisabled(true);
  assert.equal(e['#languageSelectValue'].textContent, '简体中文可更新', 'busy state retains selected status');
  control.setOptions([{ ...option, badge: null, disabled: true }]);
  assert.equal(e['#languageSelectValue'].textContent, '简体中文', 'new backend status removes the old badge');
  assert.equal(e['#languageSelectValue'].attributes.get('aria-label'), '简体中文');
  control.setValue('');
  assert.equal(e['#languageSelectValue'].textContent, 'Choose');
  assert.equal(e['#languageSelectValue'].attributes.has('aria-label'), false);
});

test('legacy permission hints do not fabricate a startup warning before an operation fails', async () => {
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

  for (const runtimeState of [macUnknown, windowsElevation, windowsUnwritable]) {
    assert.equal(activityRows(runtimeState).length, 0);
    assert.equal(runtimeState.elements['#statusPanel'].dataset.mode, 'idle');
    assert.equal(runtimeState.elements['#statusIdle'].textContent, 'What would you like to do?');
  }
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
  assert.equal(list.children[0].attributes.get('aria-disabled'), 'true');
  assert.equal(trigger.attributes.get('aria-activedescendant'), 'languageSelectOption-1');

  list.children[0].listeners.get('click')[0]();
  assert.equal(nativeSelect.value, '', 'the visible current language cannot be committed again');
  assert.equal(trigger.attributes.get('aria-expanded'), 'true');

  trigger.listeners.get('keydown')[0](key('ArrowDown'));
  assert.equal(trigger.attributes.get('aria-activedescendant'), 'languageSelectOption-2');
  trigger.listeners.get('keydown')[0](key('Enter'));
  assert.equal(nativeSelect.value, 'ja_JP');
  assert.equal(r.elements['#languageSelectValue'].textContent, '日本語');
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
  await assert.rejects(
    () => r.window.cavalryI18n.openProjectLink('https://www.xiaohongshu.com/user/profile/5f4696c800000000010011f6'),
    /Unsupported project link/
  );

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

test('About follow labels and platform names localize in four locales', async () => {
  for (const [locale, follow, twitterAria, xiaohongshuAria] of [
    ['en-US', 'Follow', 'Follow on X (Twitter)', 'Follow on Xiaohongshu'],
    ['zh-CN', '关注', '在Twitter/X关注', '在小红书关注'],
    ['zh-TW', '關注', '在Twitter/X關注', '在小紅書關注'],
    ['ja-JP', 'フォロー', 'X（Twitter）をフォロー', '小紅書をフォロー'],
  ]) {
    const r = bootAbout({ locale });
    await flush();
    assert.equal(r.elements['#aboutTwitterLabel'].textContent, follow, locale);
    assert.equal(r.elements['#aboutXiaohongshuLabel'].textContent, follow, locale);
    assert.equal(r.elements['#aboutTwitterLink'].attributes.get('aria-label'), twitterAria, locale);
    assert.equal(r.elements['#aboutXiaohongshuLink'].attributes.get('aria-label'), xiaohongshuAria, locale);
    dispatch(r.elements['#aboutTwitterLink'], 'click', { preventDefault() {} });
    dispatch(r.elements['#aboutXiaohongshuLink'], 'click', { preventDefault() {} });
    await flush();

    assert.deepEqual(
      JSON.parse(JSON.stringify(r.calls.filter(({ command }) => command === 'open_project_link'))),
      [
        { command: 'open_project_link', payload: { link: 'twitter' } },
        { command: 'open_project_link', payload: { link: 'xiaohongshu' } },
      ],
      locale
    );
  }
});

test('Windows About chrome uses the shared X and closes only the fixed about label', async () => {
  const r = bootAbout({ locale: 'zh-CN', aboutPlatform: 'windows' });
  await flush();
  const controls = r.elements['#aboutWindowControls'];
  const close = r.elements['#aboutWindowCloseButton'];
  assert.equal(controls.hidden, false);
  assert.equal(close.children.length, 1);
  assert.equal(close.attributes.get('aria-label'), '关闭');
  dispatch(close, 'click');
  await flush();
  assert.deepEqual(
    JSON.parse(JSON.stringify(r.calls.filter(({ command }) => command === 'plugin:window|close'))),
    [{ command: 'plugin:window|close', payload: { label: 'about' } }]
  );
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

test('installation badge follows backend Official projection across built-in locales and UI languages', async () => {
  const uiLocales = [
    ['en-US', 'Official', 'Installation: verified vendor app; no Switcher language override', 'English'],
    ['zh-CN', '官方', '安装状态：已验证原厂应用；无 Switcher 语言覆盖', 'English'],
    ['zh-TW', '官方', '安裝狀態：已驗證原廠應用；無 Switcher 語言覆寫', 'English'],
    ['ja-JP', '公式', 'インストール状態: 検証済みの純正アプリ・Switcher の言語上書きなし', 'English'],
  ];
  const builtInOfficialCases = [
    ['default English', {
      languageScope: 'userProfile', currentLang: 'en', nativeLocaleState: 'unset',
      nativeResourceAvailable: false, installationMode: 'official',
    }, null],
    ['built-in Japanese', {
      languageScope: 'userProfile', currentLang: 'ja_JP', nativeLocaleState: 'explicit',
      nativeResourceAvailable: false, installationMode: 'official',
    }, '日本語'],
  ];

  for (const [locale, badge, modeCopy, defaultEnglishLabel] of uiLocales) {
    for (const [platform, scenario, projectedStatus, languageLabel] of
      ['macos', 'windows'].flatMap(platform => builtInOfficialCases.map(c => [platform, ...c]))) {
      const r = boot({ locale, status: {
        platform,
        version: '2.8.0', supportedVersion: '2.8.0', versionCompatibility: 'supported',
        ...projectedStatus,
      } });
      await flush();
      assert.equal(r.elements['#installationBadge'].textContent, badge, `${scenario}/${locale}`);
      assert.equal(r.elements['#installationBadge'].dataset.state, 'official', `${scenario}/${locale}`);
      assert.equal(r.elements['#installationBadge'].hidden, false, `${scenario}/${locale}`);
      assert.equal(r.elements['#installationMode'].textContent, modeCopy, `${scenario}/${locale}`);
      assert.equal(r.elements['#currentLanguage'].textContent, languageLabel || defaultEnglishLabel, `${scenario}/${locale}`);
    }

    const ownedHans = boot({ locale, status: {
      version: '2.8.0', supportedVersion: '2.8.0', versionCompatibility: 'supported',
      languageScope: 'userProfile', currentLang: 'zh-Hans', nativeLocaleState: 'explicit',
      nativeResourceAvailable: true, patchStatus: 'current', installationMode: 'unknown',
    } });
    await flush();
    assert.equal(ownedHans.elements['#currentLanguage'].textContent, '简体中文', `owned zh-Hans/${locale}`);
    assert.equal(ownedHans.elements['#installationBadge'].hidden, true, `owned zh-Hans/${locale}`);
    assert.equal(ownedHans.elements['#installationBadge'].textContent, '', `owned zh-Hans/${locale}`);
    assert.equal(ownedHans.elements['#installationBadge'].dataset.state, 'unknown', `owned zh-Hans/${locale}`);
    assert.equal(ownedHans.elements['#installationMode'].hidden, true, `owned zh-Hans/${locale}`);
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
  assert.equal(macos.elements['#modalTitle'].textContent, 'Restore English?');
  assert.equal(macos.elements['#modalBody'].textContent, 'Cavalry will return to English and reopen.');
  assert.equal(macos.elements['#modalPrimaryButton'].textContent, 'Restore English');
  macos.elements['#modalPrimaryButton'].listeners.get('click')[0]();
  await flush();
  assert.deepEqual(JSON.parse(JSON.stringify(macos.calls.filter(({ command }) => command === 'apply_language')[0])), {
    command: 'apply_language', payload: { appPath: '/Applications/Cavalry.app', lang: 'restore-official' },
  });
  assert.match(activityText(macos), /Cavalry restored/, 'installation Restore keeps its existing phase wording');

  const windows = boot({
    status: { platform: 'windows', currentLang: 'en', reconciliationRequired: true },
    apply: { ok: true, currentLang: 'en' },
  });
  await flush();
  assert.equal(windows.elements['#restoreButton'].disabled, false);
  assert.equal(windows.elements['#statusLabel'].textContent, 'Task progress');
  assert.equal(activityTitle(windows), 'Restore Cavalry to finish cleanup');
  windows.elements['#restoreButton'].listeners.get('click')[0]();
  assert.equal(windows.elements['#modalTitle'].textContent, 'Restore English?');
  windows.elements['#modalPrimaryButton'].listeners.get('click')[0]();
  await flush();
  assert.deepEqual(JSON.parse(JSON.stringify(windows.calls.filter(({ command }) => command === 'apply_language')[0])), {
    command: 'apply_language', payload: { appPath: '/Applications/Cavalry.app', lang: 'en' },
  });

  const official = boot({ status: { installationMode: 'official', currentLang: 'en' } });
  await flush();
  assert.equal(official.elements['#restoreButton'].hidden, false);
  assert.equal(official.elements['#restoreButton'].disabled, true);
  assert.equal(official.elements['#installationMode'].textContent, 'Installation: verified vendor app; no Switcher language override');
  assert.equal(official.elements['#installationBadge'].textContent, 'Official');
  assert.equal(official.elements['#installationBadge'].dataset.state, 'official');
});

test('managed legacy macOS sends one Restore intent for backend baseline selection', async () => {
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
    command: 'apply_language', payload: { appPath: '/Applications/Cavalry.app', lang: 'restore-official' },
  });
  assert.equal(r.elements['#statusOutcome'].textContent, 'Restored English. Cavalry is now open.');
});

test('managed English disables Restore unless Windows still owns cleanup residue', async () => {
  const macos = boot({
    status: {
      platform: 'macos', currentLang: 'en', installationMode: 'managedLegacy',
      officialRecoveryAvailable: false, needsExtract: false,
    },
  });
  const windows = boot({
    status: {
      platform: 'windows', currentLang: 'en', reconciliationRequired: true,
    },
  });
  await flush();

  assert.equal(macos.elements['#restoreButton'].disabled, true);
  assert.equal(windows.elements['#restoreButton'].disabled, false);
});

test('unsupported Cavalry versions remain read-only with a short unsupported message', async () => {
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
  assert.ok(activityText(older).includes('This Cavalry version isn’t supported.'));
  assert.doesNotMatch(activityText(older), /update|download|corresponding/i);
  assert.equal(older.elements['#legacyReleaseButton'].hidden, true);
  assert.equal(activityTitle(newer), 'Cavalry 2.7.3 isn’t supported yet');
  assert.match(activityText(newer), /won’t modify this installation/i);
  assert.match(activityText(newer), /keep using Cavalry/i);
  assert.doesNotMatch(activityText(newer), /downgrade|reinstall Cavalry/i);
  assert.equal(activityTitle(unknown), 'This Cavalry version isn’t supported');
  assert.match(activityText(unknown), /has not changed your installation/i);
});

test('hosts older than 2.7.2 get only the four-locale unsupported message', async () => {
  for (const [locale, message] of [
    ['en-US', 'This Cavalry version isn’t supported.'],
    ['zh-CN', '暂不支持此 Cavalry 版本。'],
    ['zh-TW', '暫不支援此 Cavalry 版本。'],
    ['ja-JP', 'この Cavalry バージョンには対応していません。'],
  ]) {
    const r = boot({ locale, status: { version: '2.7.1', supportedVersion: '2.8.0', versionCompatibility: 'olderUnsupported' } });
    await flush();
    assert.ok(activityText(r).includes(message), locale);
    assert.equal(r.elements['#legacyReleaseButton'].hidden, true, locale);
    assert.equal(r.elements['#applyButton'].disabled, true, locale);
  }
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
    'verify', 'archive', 'translate', 'open',
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
    command: 'apply_language', payload: { appPath: '/Applications/Cavalry.app', lang: 'zh-Hant' },
  });
  assert.equal(r.calls.some(({ command }) => command === 'restart_cavalry'), false);
});

test('generic installation verification failure offers its fixed issue form without unavailable details or reinstall', async () => {
  const r = boot({
    status: { supportedVersion: '2.7.2' },
    apply: { ok: false, error: 'private backend diagnostic', errorCode: null },
  });
  await flush();
  chooseLanguage(r);
  dispatch(r.elements['#applyButton'], 'click');
  await flush();

  assert.equal(activityTitle(r), 'Couldn’t verify the Cavalry installation');
  assert.match(activityText(r), /Reopen the Switcher and try again/);
  assert.match(activityText(r), /Report a problem/);
  assert.doesNotMatch(activityText(r), /error details/i);
  assert.doesNotMatch(activityText(r), /reinstall|official installer/i);
  assert.doesNotMatch(activityText(r), /private backend diagnostic/);
  assert.equal(r.elements['#reportIssueButton'].hidden, false);
  assert.equal(r.elements['#reportIssueButton'].textContent, 'Report a problem');
  dispatch(r.elements['#reportIssueButton'], 'click');
  await flush();
  assert.deepEqual(
    JSON.parse(JSON.stringify(r.calls.filter(({ command }) => command === 'open_project_link'))),
    [{ command: 'open_project_link', payload: { link: 'reportIssue' } }]
  );
});

test('typed Cavalry-running verification error does not expose the generic issue form', async () => {
  const r = boot({ apply: { ok: false, errorCode: 'cavalryStillRunning' } });
  await flush();
  chooseLanguage(r);
  dispatch(r.elements['#applyButton'], 'click');
  await flush();

  assert.equal(activityTitle(r), 'Cavalry is running');
  assert.equal(r.elements['#reportIssueButton'].hidden, true);
  assert.equal(r.calls.some(({ command }) => command === 'open_project_link'), false);
});

test('issue form browser failure uses a peripheral Toast and preserves the failed Activity', async () => {
  const r = boot({
    locale: 'zh-CN',
    apply: { ok: false, errorCode: null },
    projectLinkResult: { ok: false },
  });
  await flush();
  chooseLanguage(r);
  dispatch(r.elements['#applyButton'], 'click');
  await flush();
  const activityBefore = activityText(r);
  const reportButton = r.elements['#reportIssueButton'];
  assert.equal(reportButton.hidden, false);
  dispatch(reportButton, 'click');
  await flush();

  const viewport = toastViewport(r);
  assert.ok(viewport, 'the shared Toast viewport must be mounted');
  assert.match(viewport.textContent, /无法打开项目链接/);
  assert.equal(activityText(r), activityBefore, 'a peripheral link failure must preserve the failed Activity');
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

test('macOS unfinished marker is actionable through the shared Restore transaction', async () => {
  const r = boot({
    status: { platform: 'macos', currentLang: 'en', reconciliationRequired: true },
    apply: { ok: true, currentLang: 'en' },
  });
  await flush();
  assert.equal(r.elements['#restoreButton'].disabled, false);
  assert.equal(r.elements['#applyButton'].disabled, true);
  r.elements['#restoreButton'].listeners.get('click')[0]();
  r.elements['#modalPrimaryButton'].listeners.get('click')[0]();
  await flush();
  assert.deepEqual(JSON.parse(JSON.stringify(r.calls.filter(({ command }) => command === 'apply_language')[0])), {
    command: 'apply_language', payload: { appPath: '/Applications/Cavalry.app', lang: 'restore-official' },
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
  assert.equal(r.elements['#permissionButton'].hidden, false);
  assert.equal(r.elements['#permissionButton'].textContent, 'Open permission settings');

  r.elements['#modalSecondaryButton'].listeners.get('click')[0]();
  await flush();
  assert.equal(r.elements['#applyButton'].textContent, labels.apply);
  assert.equal(r.elements['#restoreButton'].textContent, labels.restore);
});

test('macOS handoff captures the forward action plus persistent return target and only its session Channel retries', async () => {
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
  r.elements['#permissionButton'].rect = {
    x: 20, y: 430, left: 20, top: 430, width: 360, height: 36, right: 380, bottom: 466,
  };

  dispatch(r.elements['#modalPrimaryButton'], 'click');
  await flush();
  const call = r.calls.find(({ command }) => command === 'open_privacy_security');
  assert.deepEqual(JSON.parse(JSON.stringify(call.payload.request)), {
    permission: 'appManagement',
    sourceRect: { x: 10, y: 10, width: 100, height: 32 },
    returnRect: { x: 20, y: 430, width: 360, height: 36 },
    viewportCss: { width: 400, height: 556 },
  });
  assert.equal(call.payload.onEvent, true);
  assert.equal(r.elements['#modalBackdrop'].open, false, 'native start acknowledgement closes the source only after capture');
  assert.equal(r.calls.filter(({ command }) => command === 'apply_language').length, 1);

  const channel = r.handoffChannels[0];
  r.callbacks.get(channel.id)({ index: 0, message: { outcome: 'retryRequested' } });
  await flush();
  assert.equal(r.calls.filter(({ command }) => command === 'apply_language').length, 2);
});

test('macOS ignores the legacy preflight hint and lets the real Switch transaction decide permission', async () => {
  const r = boot({
    status: {
      platform: 'macos', currentLang: 'zh-Hans', macosPermissionHandoffRequired: true,
      permissionAction: 'none',
    },
    apply: { ok: true, currentLang: 'zh-Hant' },
  });
  await flush();
  chooseLanguage(r);
  dispatch(r.elements['#applyButton'], 'click');
  await flush();

  assert.deepEqual(JSON.parse(JSON.stringify(r.calls.filter(({ command }) => command === 'apply_language')[0])), {
    command: 'apply_language', payload: { appPath: '/Applications/Cavalry.app', lang: 'zh-Hant' },
  });
  assert.equal(r.calls.filter(({ command }) => command === 'open_privacy_security').length, 0);
  assert.equal(r.elements['#modalBackdrop'].open, false);
  assert.equal(r.elements['#permissionButton'].hidden, true);
});

test('macOS ignores the legacy preflight hint and keeps Restore confirmation before the transaction', async () => {
  const r = boot({
    status: {
      platform: 'macos', currentLang: 'zh-Hans', macosPermissionHandoffRequired: true,
      officialRecoveryAvailable: true, permissionAction: 'none',
    },
    apply: { ok: true, currentLang: 'en' },
  });
  await flush();
  assert.equal(r.elements['#restoreButton'].disabled, false);
  dispatch(r.elements['#restoreButton'], 'click');
  await flush();

  assert.equal(r.calls.filter(({ command }) => command === 'apply_language').length, 0);
  assert.equal(r.elements['#modalBackdrop'].open, true);
  assert.equal(r.elements['#modalBody'].textContent, 'Cavalry will return to English and reopen.');
  assert.equal(r.calls.filter(({ command }) => command === 'open_privacy_security').length, 0);

  dispatch(r.elements['#modalPrimaryButton'], 'click');
  await flush();
  assert.deepEqual(JSON.parse(JSON.stringify(r.calls.filter(({ command }) => command === 'apply_language')[0])), {
    command: 'apply_language', payload: { appPath: '/Applications/Cavalry.app', lang: 'restore-official' },
  });
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

test('legacy startup recovery fields cannot turn internal journals into a product blocker', async () => {
  const r = boot({ status: {
    installationMode: 'recoveryRequired',
    startupRecoveryError: 'Cavalry is still running',
  } });
  await flush();
  assert.equal(r.elements['#browseButton'].disabled, false);
  assert.equal(r.elements['#restoreButton'].disabled, false);
  chooseLanguage(r);
  assert.equal(r.elements['#applyButton'].disabled, false);
  assert.equal(r.elements['#statusPanel'].dataset.mode, 'idle');
  assert.doesNotMatch(activityText(r), /Cavalry is still running/);
  assert.equal(r.elements['#installationBadge'].hidden, true);
});


test('macOS incomplete provenance is proven only after the user starts an action', async () => {
  const r = boot({ status: { installationMode: 'modifiedOrUnverified', needsExtract: true } }); await flush();
  assert.equal(r.elements['#restoreButton'].disabled, false);
  chooseLanguage(r);
  assert.equal(r.elements['#applyButton'].disabled, false);
  assert.equal(r.elements['#statusPanel'].dataset.mode, 'idle');
  r.elements['#restoreButton'].listeners.get('click')[0]();
  r.elements['#modalPrimaryButton'].listeners.get('click')[0]();
  await flush();
  assert.equal(r.calls.some(({ command, payload }) => command === 'apply_language' && payload.lang === 'restore-official'), true);
});

test('known macOS signing residue remains an internal recoverable-stock detail', async () => {
  const r = boot({
    status: {
      platform: 'macos', currentLang: 'en', installationMode: 'recoverableStock', needsExtract: true,
    },
  });
  await flush();
  assert.equal(r.elements['#statusPanel'].dataset.mode, 'idle');
  assert.equal(r.elements['#applyButton'].disabled, true, 'Switch still waits for an explicit language');
  assert.equal(r.elements['#restoreButton'].disabled, true, 'clean English does not expose a cleanup action');
  assert.doesNotMatch(activityText(r), /signing|signature|residue/i);
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

test('user-profile status is whitelisted and invalid locales collapse to a visible unknown value', async () => {
  const profile = boot({ status: {
    languageScope: 'userProfile',
    currentLang: 'private-locale-debug-value',
    language_scope: 'installation',
    current_lang: 'zh-Hant',
    nativeResourceAvailable: true,
    debugPayload: 'must-not-cross-the-bridge',
  } });
  await flush();
  const normalized = await profile.window.cavalryI18n.getStatus();
  assert.equal(normalized.languageScope, 'userProfile');
  assert.equal(normalized.currentLang, 'unknown');
  assert.equal(normalized.nativeLocaleState, 'unrecognized', 'missing native-only state is conservative');
  assert.equal(normalized.nativeResourceAvailable, true);
  assert.equal(normalized.language_scope, undefined);
  assert.equal(normalized.current_lang, undefined);
  assert.equal(normalized.debugPayload, undefined);
  assert.equal(profile.elements['#currentLanguage'].textContent, 'Unknown');
  assert.doesNotMatch(activityText(profile), /private-locale-debug-value|must-not-cross-the-bridge/);

  const legacy = boot({ status: {
    language_scope: 'userProfile',
    current_lang: 'zh-Hans',
    currentLang: 'not-a-product-locale',
    nativeResourceAvailable: false,
  } });
  await flush();
  const legacyStatus = await legacy.window.cavalryI18n.getStatus();
  assert.equal(legacyStatus.languageScope, 'installation');
  assert.equal(legacyStatus.currentLang, 'en');
  assert.equal(legacyStatus.nativeResourceAvailable, true);
});

test('nativeLocaleState accepts only the three camelCase user-profile states', async () => {
  for (const [state, currentLang] of [
    ['unset', 'en'],
    ['explicit', 'ja_JP'],
    ['unrecognized', 'unknown'],
  ]) {
    const profile = boot({ status: {
      languageScope: 'userProfile', currentLang, nativeLocaleState: state,
    } });
    await flush();
    const status = await profile.window.cavalryI18n.getStatus();
    assert.equal(status.nativeLocaleState, state);
    assert.equal(status.currentLang, currentLang, 'locale observation state must not overwrite the backend language projection');
  }

  const rejected = boot({ status: {
    languageScope: 'userProfile', currentLang: 'unknown',
    nativeLocaleState: 'private-raw-locale', native_locale_state: 'explicit',
  } });
  await flush();
  const rejectedStatus = await rejected.window.cavalryI18n.getStatus();
  assert.equal(rejectedStatus.nativeLocaleState, 'unrecognized');
  assert.equal(rejectedStatus.native_locale_state, undefined);
  assert.doesNotMatch(JSON.stringify(rejectedStatus), /private-raw-locale/);

  const installation = boot({ status: {
    languageScope: 'installation', currentLang: 'en', nativeLocaleState: 'explicit',
  } });
  await flush();
  const legacyStatus = await installation.window.cavalryI18n.getStatus();
  assert.equal(legacyStatus.nativeLocaleState, null, 'native profile detail is absent from installation scope');
});

test('unset native locale shows the shared English label without selecting a language or granting Restore', async () => {
  const locales = [
    ['en-US', 'English', 'Current: English'],
    ['zh-CN', 'English', '当前: English'],
    ['zh-TW', 'English', '目前: English'],
    ['ja-JP', 'English', '現在: English'],
  ];
  for (const [locale, label, ariaLabel] of locales) {
    const profile = boot({ locale, status: {
      appPath: '', languageScope: 'userProfile', currentLang: 'en', nativeLocaleState: 'unset',
      nativeEnglishRestoreAvailable: false, nativeResourceAvailable: true,
    } });
    await flush();
    assert.equal(profile.elements['#currentLanguage'].textContent, label, `${locale} default label`);
    assert.equal(profile.elements['#currentLanguage'].attributes.get('aria-label'), ariaLabel, `${locale} ARIA`);
    assert.equal(profile.elements['#languageSelect'].value, '', `${locale} must not preselect a target language`);
    assert.equal(profile.elements['#restoreButton'].disabled, true, `${locale} default English is not ownership proof`);
  }

  for (const currentLang of ['unknown', 'zh-Hans']) {
    const inconsistent = boot({ status: {
      appPath: '', languageScope: 'userProfile', currentLang, nativeLocaleState: 'unset',
      nativeEnglishRestoreAvailable: false,
    } });
    await flush();
    assert.equal(inconsistent.elements['#currentLanguage'].textContent, 'Unknown',
      'unset with a non-default current language remains conservative');
  }

  const legacy = boot({ status: {
    appPath: '', languageScope: 'installation', currentLang: 'en', nativeLocaleState: 'unset',
  } });
  await flush();
  assert.equal(legacy.elements['#currentLanguage'].textContent, 'English',
    'installation badges ignore the native-only locale state');
});

test('healthy 2.8 startup matches p12 idle copy across UI locales and platforms', async () => {
  const idle = [
    ['en-US', 'What would you like to do?'],
    ['zh-CN', '这次你想做什么？'],
    ['zh-TW', '這次你想做什麼？'],
    ['ja-JP', '今回は何をしますか？'],
  ];
  for (const [locale, prompt] of idle) {
    for (const platform of ['macos', 'windows']) {
      for (const currentLang of ['en', 'zh-Hans', 'zh-Hant', 'ja_JP']) {
        const r = boot({ locale, status: {
          platform, languageScope: 'userProfile', nativeResourceAvailable: true,
          currentLang, nativeLocaleState: currentLang === 'en' ? 'unset' : 'explicit',
          reconciliationRequired: false, version: '2.8.0', supportedVersion: '2.8.0',
          versionCompatibility: 'supported',
        } });
        await flush();
        assert.equal(r.elements['#statusPanel'].dataset.mode, 'idle', `${locale}/${platform}/${currentLang}`);
        assert.equal(r.elements['#statusIdle'].textContent, prompt);
        assert.equal(activityRows(r).length, 0, 'normal startup creates no status event');
        assert.equal(r.elements['#modalBackdrop'].open, false, 'no new startup confirmation');
        assert.equal(r.calls.filter(({ command }) => command === 'apply_language').length, 0);
      }
    }
  }
});

test('native user-profile Switch applies immediately without a confirmation modal', async () => {
  const r = boot({
    status: {
      languageScope: 'userProfile', nativeResourceAvailable: true, currentLang: 'unknown',
      patchStatus: 'unknown', reconciliationRequired: true, version: '2.8.0', supportedVersion: '2.8.0',
    },
  });
  await flush();

  assert.equal(r.elements['#currentLanguage'].textContent, 'Unknown');
  assert.equal(r.elements['#restoreButton'].disabled, false, 'unknown language must not disable English restore');
  assert.match(activityText(r), /this.*user profile|shared.*user profile|all.*Cavalry.*copies/i);
  chooseLanguage(r);
  assert.equal(r.elements['#applyButton'].disabled, false, 'unknown language must remain re-applicable');
  r.elements['#applyButton'].listeners.get('click')[0]();
  assert.equal(r.elements['#modalBackdrop'].open, false, 'normal user-profile Switch must not show confirmation');
  await flush();
  assert.equal(r.calls.filter(({ command }) => command === 'apply_language').length, 1,
    'normal user-profile Switch starts the selected transaction without a confirmation click');
  const apply = r.calls.find(({ command }) => command === 'apply_language');
  assert.equal(apply.payload.appPath, '/Applications/Cavalry.app');
});

test('native user-profile Restore confirms shared fixed English and remains available without translation resources', async () => {
  const r = boot({ status: {
    languageScope: 'userProfile', nativeResourceAvailable: false, currentLang: 'zh-Hant',
    patchStatus: 'unknown', reconciliationRequired: true, version: '2.8.0', supportedVersion: '2.8.0',
  } });
  await flush();

  assert.equal(r.elements['#languageSelect'].disabled, true, 'missing native resource blocks only language selection');
  assert.equal(r.elements['#applyButton'].disabled, true, 'missing native resource blocks Switch');
  assert.equal(r.elements['#restoreButton'].disabled, false, 'English restoration does not consume the language resource pack');
  assert.match(activityText(r), /native.*translation.*resource|translation.*resource.*unavailable/i);
  assert.match(activityText(r), /shared language state.*recovery|may need recovery/i);

  r.elements['#restoreButton'].listeners.get('click')[0]();
  assert.equal(r.elements['#modalBackdrop'].open, true);
  assert.match(r.elements['#modalBody'].textContent, /all Cavalry copies|every Cavalry copy/i);
  assert.match(r.elements['#modalBody'].textContent, /English/i);
  assert.match(r.elements['#modalBody'].textContent, /not.*previous language|not.*previous locale/i);
  assert.equal(r.calls.filter(({ command }) => command === 'apply_language').length, 0);
  r.elements['#modalPrimaryButton'].listeners.get('click')[0]();
  await flush();
  const restore = r.calls.find(({ command }) => command === 'apply_language');
  assert.equal(restore.payload.lang, 'en', 'user-profile Restore is a fixed English transaction');
  assert.equal(restore.payload.appPath, '/Applications/Cavalry.app', 'appPath remains the restart target');
});

test('typed native user-profile failures stay local and never open App Management or request a 2.7.2 reinstall', async () => {
  const cases = [
    ['nativeUserLanguageConflict', /recovery record|recovery data|shared.*state/i],
    ['nativeResourceUnavailable', /translation resource/i],
    ['nativeUserLanguagePermissionDenied', /user.*configuration|file permissions/i],
  ];
  for (const [errorCode, messagePattern] of cases) {
    const r = boot({
      status: {
        languageScope: 'userProfile', nativeResourceAvailable: true, currentLang: 'zh-Hans',
        version: '2.8.0', supportedVersion: '2.8.0',
      },
      apply: { ok: false, errorCode, error: 'private backend debug prose' },
    });
    await flush();
    chooseLanguage(r);
    r.elements['#applyButton'].listeners.get('click')[0]();
    assert.equal(r.elements['#modalBackdrop'].open, false, 'a normal Switch failure must not require a confirmation click');
    await flush();
    assert.equal(r.calls.filter(({ command }) => command === 'apply_language').length, 1);

    assert.match(activityText(r), messagePattern, `${errorCode} must have fixed localized copy`);
    assert.equal(r.elements['#permissionButton'].hidden, true, `${errorCode} must not route to permission settings`);
    assert.equal(r.calls.some(({ command }) => command === 'open_privacy_security'), false);
    assert.doesNotMatch(activityText(r), /2\.7\.2|private backend debug prose/);
  }
});

test('native conflict reconciliation preserves the failure Activity and unlocks fixed-English Restore', async () => {
  for (const nativeResourceAvailable of [true, false]) {
    let statusReads = 0;
    const r = boot({
      status: {
        languageScope: 'userProfile', nativeResourceAvailable: true, currentLang: 'en',
        patchStatus: 'notApplicable', reconciliationRequired: false,
        version: '2.8.0', supportedVersion: '2.8.0',
      },
      statusRequest: (status) => {
        statusReads += 1;
        return Promise.resolve(statusReads === 1 ? status : {
          ...status,
          nativeResourceAvailable,
          currentLang: 'unknown',
          patchStatus: 'unknown',
          reconciliationRequired: true,
        });
      },
      apply: {
        ok: false,
        errorCode: 'nativeUserLanguageConflict',
        reconciliationRequired: true,
      },
    });
    await flush();
    assert.equal(r.elements['#restoreButton'].disabled, true, 'clean English starts without Restore');
    chooseLanguage(r);
    r.elements['#applyButton'].listeners.get('click')[0]();
    assert.equal(r.elements['#modalBackdrop'].open, false);
    await flush();
    assert.equal(r.calls.filter(({ command }) => command === 'apply_language').length, 1);

    assert.equal(statusReads, 2, 'reconciliation status must be refreshed after the failed write');
    assert.equal(r.elements['#currentLanguage'].textContent, 'Unknown');
    assert.equal(r.elements['#restoreButton'].disabled, false, 'reconciliation permits fixed-English Restore');
    assert.equal(r.elements['#languageSelect'].disabled, !nativeResourceAvailable);
    assert.equal(r.elements['#permissionButton'].hidden, true);
    assert.match(activityText(r), /could not safely complete|recovery record|recovery data/i,
      'status refresh must not replace the typed failure Activity');
  }
});

test('user-profile running-process failure asks users to quit every copy without terminating any instance', async () => {
  const r = boot({
    status: {
      languageScope: 'userProfile', nativeResourceAvailable: true, currentLang: 'zh-Hans',
      version: '2.8.0', supportedVersion: '2.8.0',
    },
    apply: { ok: false, errorCode: 'cavalryStillRunning' },
  });
  await flush();
  chooseLanguage(r);
  r.elements['#applyButton'].listeners.get('click')[0]();
  assert.equal(r.elements['#modalBackdrop'].open, false);
  await flush();
  assert.equal(r.calls.filter(({ command }) => command === 'apply_language').length, 1);

  assert.match(activityText(r), /quit every running Cavalry copy|all running.*Cavalry.*copies/i);
  assert.match(activityText(r), /other versions/i);
  assert.equal(r.calls.some(({ command }) => /terminate|kill/i.test(command)), false);
});

test('user-profile recovery phase describes user configuration records, not bundle backup', async () => {
  const r = boot({
    status: {
      languageScope: 'userProfile', nativeResourceAvailable: true, currentLang: 'en',
      patchStatus: 'notApplicable', version: '2.8.0', supportedVersion: '2.8.0',
    },
    apply: { ok: true, currentLang: 'zh-Hans' },
  });
  await flush();
  chooseLanguage(r);
  r.elements['#applyButton'].listeners.get('click')[0]();
  assert.equal(r.elements['#modalBackdrop'].open, false);
  await flush();
  assert.equal(r.calls.filter(({ command }) => command === 'apply_language').length, 1);

  assert.match(activityText(r), /user configuration recovery record.*checked|recovery record.*confirmed/i);
  assert.doesNotMatch(activityText(r), /recovery files ready|English files|official baseline/i);
});

test('user-profile fixed-English transaction phases name English, not the Cavalry installation', async () => {
  const cases = [
    ['en-US', 'English restored'],
    ['zh-CN', '已恢复英文'],
    ['zh-TW', '已還原英文'],
    ['ja-JP', '英語に戻しました'],
  ];
  for (const [locale, completedCopy] of cases) {
    const r = boot({
      locale,
      status: {
        languageScope: 'userProfile', nativeResourceAvailable: false, currentLang: 'zh-Hans',
        nativeEnglishRestoreAvailable: true, version: '2.8.0', supportedVersion: '2.8.0',
      },
      apply: { ok: true, currentLang: 'en', nativeRestoreOnly: true },
    });
    await flush();
    r.elements['#restoreButton'].listeners.get('click')[0]();
    r.elements['#modalPrimaryButton'].listeners.get('click')[0]();
    await flush();
    assert.match(activityText(r), new RegExp(completedCopy), `${locale} fixed-English commit title`);
    assert.doesNotMatch(activityText(r), /Cavalry restored|已恢复 Cavalry|已還原 Cavalry|Cavalry を復元しました/,
      `${locale} user-profile restore must not say the installation was restored`);
  }
});

test('legacy 2.7.2 host keeps a short p12 link and blocks switching after a Switcher update', async () => {
  const stable = boot({ status: {
    version: '2.7.2', supportedVersion: '2.7.2', versionCompatibility: 'supported',
  } });
  await flush();
  assert.equal(stable.elements['#legacyReleaseButton'].hidden, true);
  assert.equal(stable.elements['#statusPanel'].dataset.state, 'neutral', 'the last 2.7.2 Switcher must not mark its supported target unsupported');

  const tooOld = boot({ status: {
    version: '2.7.1', supportedVersion: '2.8.0', versionCompatibility: 'olderUnsupported',
  } });
  await flush();
  assert.equal(tooOld.elements['#legacyReleaseButton'].hidden, true, 'the fixed legacy link is specifically for Cavalry 2.7.2');

  const labels = [
    ['en-US', 'Download p12 for Cavalry 2.7.2'],
    ['zh-CN', '下载 2.7.2 对应的 p12'],
    ['zh-TW', '下載 2.7.2 對應的 p12'],
    ['ja-JP', 'Cavalry 2.7.2 用の p12 をダウンロード'],
  ];
  let preview;
  for (const [locale, label] of labels) {
    preview = boot({ locale, status: {
      version: '2.7.2', supportedVersion: '2.8.0', versionCompatibility: 'olderUnsupported',
    } });
    await flush();
    assert.equal(preview.elements['#legacyReleaseButton'].hidden, false, locale);
    assert.equal(preview.elements['#legacyReleaseButton'].textContent, label, locale);
    assert.match(activityTitle(preview), /Cavalry 2\.7\.2/);
    assert.equal(preview.elements['#applyButton'].disabled, true, locale);
    assert.equal(preview.calls.some(({ command }) => command === 'apply_language'), false, locale);
  }
  preview.elements['#legacyReleaseButton'].listeners.get('click')[0]();
  await flush();
  assert.deepEqual(
    JSON.parse(JSON.stringify(preview.calls.filter(({ command }) => command === 'open_project_link'))),
    [{ command: 'open_project_link', payload: { link: 'legacyRelease' } }]
  );
  await assert.rejects(() => preview.window.cavalryI18n.openProjectLink('https://attacker.invalid'), /Unsupported project link/);
});

test('hostless English Restore needs strict user-profile ownership and English action evidence', async () => {
  const accepted = boot({ status: {
    appPath: '', languageScope: 'userProfile', currentLang: 'zh-Hans', nativeResourceAvailable: false,
    reconciliationRequired: false, nativeEnglishRestoreAvailable: true,
  } });
  await flush();
  assert.equal((await accepted.window.cavalryI18n.getStatus()).nativeEnglishRestoreAvailable, true);

  for (const value of ['true', 1, null, undefined, false]) {
    const r = boot({ status: {
      appPath: '', languageScope: 'userProfile', nativeEnglishRestoreAvailable: value,
      native_english_restore_available: true,
    } });
    await flush();
    assert.equal((await r.window.cavalryI18n.getStatus()).nativeEnglishRestoreAvailable, false,
      `non-boolean/alternate-name status cannot grant restore: ${String(value)}`);
  }

  const installation = boot({ status: {
    languageScope: 'installation', currentLang: 'en', nativeEnglishRestoreAvailable: true,
  } });
  await flush();
  assert.equal((await installation.window.cavalryI18n.getStatus()).nativeEnglishRestoreAvailable, false,
    'installation-scoped 2.7 status cannot inherit native user-profile ownership');
  for (const status of [
    { languageScope: 'userProfile', currentLang: 'en', nativeEnglishRestoreAvailable: true },
    { languageScope: 'userProfile', currentLang: 'private-locale', nativeEnglishRestoreAvailable: true },
    { languageScope: 'userProfile', currentLang: 'zh-Hans', reconciliationRequired: true, nativeEnglishRestoreAvailable: true },
  ]) {
    const r = boot({ status });
    await flush();
    assert.equal((await r.window.cavalryI18n.getStatus()).nativeEnglishRestoreAvailable, false,
      'English, unknown locale, and reconciliation do not prove a current owned language image');
  }

  const success = boot({ apply: { ok: true, currentLang: 'en', nativeRestoreOnly: true } });
  const acceptedAction = await success.window.cavalryI18n.applyLanguage('', 'en');
  assert.equal(acceptedAction.nativeRestoreOnly, true);
  const rejectedAction = await success.window.cavalryI18n.applyLanguage('', 'zh-Hans');
  assert.equal(rejectedAction.nativeRestoreOnly, false, 'non-English actions cannot claim English-only restore');
  const failure = boot({ apply: { ok: false, nativeRestoreOnly: true } });
  assert.equal((await failure.window.cavalryI18n.applyLanguage('', 'en')).nativeRestoreOnly, false,
    'failed actions cannot claim completed restore');
  for (const result of [
    { ok: true, currentLang: 'zh-Hans', nativeRestoreOnly: true },
    { ok: true, currentLang: 'en', nativeRestoreOnly: 'true' },
    { ok: true, currentLang: 'en', nativeRestoreOnly: true, warningCodes: ['stateDurabilityPending'] },
    { ok: true, currentLang: 'en', nativeRestoreOnly: true, reconciliationRequired: true },
    { ok: true, currentLang: 'en', nativeRestoreOnly: true, permissionRequired: true },
    { ok: true, currentLang: 'en', nativeRestoreOnly: true, errorCode: 'nativeUserLanguageConflict' },
    { ok: true, currentLang: 'en', nativeRestoreOnly: true, error: true },
    { ok: true, currentLang: 'en', native_restore_only: true },
  ]) {
    const malformed = boot({ apply: result });
    assert.equal((await malformed.window.cavalryI18n.applyLanguage('', 'en')).nativeRestoreOnly, false,
      'restore-only action requires success, English result, no warning/conflict/permission, and strict camelCase true');
  }
});

test('hostless native English Restore is available only for strongly owned state and never launches Cavalry', async () => {
  let statusReads = 0;
  const owned = boot({
    status: {
      appPath: '', languageScope: 'userProfile', nativeResourceAvailable: false,
      nativeEnglishRestoreAvailable: true, currentLang: 'zh-Hans', versionCompatibility: 'unknownUnsupported',
    },
    statusRequest: (status) => {
      statusReads += 1;
      return Promise.resolve(statusReads === 1 ? status : {
        ...status, nativeEnglishRestoreAvailable: false, currentLang: 'en', reconciliationRequired: false,
      });
    },
    apply: { ok: true, currentLang: 'en', nativeRestoreOnly: true },
  });
  await flush();
  assert.equal(owned.elements['#restoreButton'].disabled, false, 'strongly owned active image can restore with no host');
  assert.equal(owned.elements['#applyButton'].disabled, true, 'ownership never authorizes Switch without a host');
  assert.equal(owned.elements['#browseButton'].hidden, false, 'existing missing-install Browse remains unchanged');
  owned.elements['#restoreButton'].listeners.get('click')[0]();
  assert.equal(owned.elements['#modalBackdrop'].open, true, 'shared-profile English restore still requires confirmation');
  owned.elements['#modalPrimaryButton'].listeners.get('click')[0]();
  await flush();

  const action = owned.calls.find(({ command }) => command === 'apply_language');
  assert.deepEqual(action?.payload, { appPath: '', lang: 'en' });
  assert.equal(statusReads, 2, 'successful hostless restore refreshes authoritative status');
  assert.equal(owned.elements['#restoreButton'].disabled, true, 'clean English with no remaining owned image hides the action');
  assert.match(owned.elements['#statusOutcome'].textContent, /English restored.*No verified compatible installation; Cavalry was not started/i);
  assert.doesNotMatch(`${activityText(owned)} ${owned.elements['#statusOutcome'].textContent}`, /Cavalry is now open|Restarting Cavalry|Restart the Switcher|restart failed/i);

  const incompatible = boot({ status: {
    appPath: '/Applications/Cavalry.app', languageScope: 'userProfile', nativeResourceAvailable: true,
    nativeEnglishRestoreAvailable: true, currentLang: 'zh-Hans', versionCompatibility: 'olderUnsupported',
    version: '2.7.2', supportedVersion: '2.8.0',
  } });
  await flush();
  assert.equal(incompatible.elements['#restoreButton'].disabled, false,
    'strongly owned English image remains recoverable with an incompatible selected host');
  assert.equal(incompatible.elements['#applyButton'].disabled, true, 'unsupported host still blocks Switch');
  assert.equal(incompatible.elements['#languageSelect'].disabled, true, 'unsupported host still blocks Select');

  const sameVersionVerificationDrift = boot({
    status: {
      appPath: '/Applications/Cavalry.app', languageScope: 'userProfile', nativeResourceAvailable: true,
      nativeEnglishRestoreAvailable: true, currentLang: 'zh-Hans', versionCompatibility: 'supported',
      version: '2.8.0', supportedVersion: '2.8.0',
    },
    apply: { ok: true, currentLang: 'en', nativeRestoreOnly: true },
    applyEvents: [
      { phase: 'verifyInstallation', state: 'running' },
      { phase: 'verifyInstallation', state: 'completed' },
      { phase: 'ensureBaseline', state: 'running' },
      { phase: 'ensureBaseline', state: 'completed' },
      { phase: 'applyTransaction', state: 'running' },
      { phase: 'applyTransaction', state: 'completed' },
    ],
  });
  await flush();
  sameVersionVerificationDrift.elements['#restoreButton'].listeners.get('click')[0]();
  sameVersionVerificationDrift.elements['#modalPrimaryButton'].listeners.get('click')[0]();
  await flush();
  assert.match(activityText(sameVersionVerificationDrift), /English recovery state checked/,
    'same-version hash/host verification failure uses profile recovery copy, never a successful host claim');
  assert.doesNotMatch(activityText(sameVersionVerificationDrift), /Cavalry installation verified|Cavalry のインストールを確認しました/);
  assert.match(sameVersionVerificationDrift.elements['#statusOutcome'].textContent,
    /No verified compatible installation; Cavalry was not started/i);

  for (const status of [
    { appPath: '', languageScope: 'userProfile', currentLang: 'zh-Hans' },
    { appPath: '', languageScope: 'userProfile', currentLang: 'unknown', reconciliationRequired: true },
    { appPath: '', languageScope: 'userProfile', currentLang: 'zh-Hans', nativeEnglishRestoreAvailable: 'true' },
    { appPath: '', languageScope: 'userProfile', currentLang: 'zh-Hans', native_english_restore_available: true },
  ]) {
    const denied = boot({ status });
    await flush();
    assert.equal(denied.elements['#restoreButton'].disabled, true,
      'missing ownership evidence, unknown state, and reconciliation alone never grant hostless Restore');
  }

  const oldInstallation = boot({ status: {
    appPath: '/Applications/Cavalry.app', languageScope: 'installation', currentLang: 'en',
    nativeEnglishRestoreAvailable: true, version: '2.7.2', supportedVersion: '2.7.2',
    versionCompatibility: 'supported',
  } });
  await flush();
  assert.equal((await oldInstallation.window.cavalryI18n.getStatus()).nativeEnglishRestoreAvailable, false);
  assert.equal(oldInstallation.elements['#restoreButton'].disabled, true,
    'the released 2.7 installation Restore contract remains unchanged');
});
