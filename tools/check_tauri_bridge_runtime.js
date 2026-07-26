#!/usr/bin/env node
/**
 * [INPUT]: 依赖 src-tauri bridge.rs、跨平台 renderer app.js 与一个最小 fake DOM/runtime
 * [OUTPUT]: 对外提供 bridge + app.js 运行时契约测试，证明 Tauri bridge 足以驱动本土化、camelCase-only payload、平台标识、提交后 cleanup warning，以及 macOS openPrivacy、Program Files requestElevation 与不可写自定义根无 UAC 路径
 * [POS]: tools 的 Phase 1 bridge 守门，把字符串级断言升级为 macOS/Windows 平台语义的实际脚本执行
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const repoRoot = path.resolve(__dirname, '..');

function readText(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

function parseOptions(markup) {
  return [...markup.matchAll(/<option value="([^"]+)">([\s\S]*?)<\/option>/g)].map(
    (match) => ({
      value: match[1],
      textContent: match[2],
    })
  );
}

function parsePopupOptions(markup) {
  return [...markup.matchAll(/data-value="([^"]+)"[\s\S]*?data-index="([^"]+)"[\s\S]*?>([\s\S]*?)<\/li>/g)].map(
    (match) => new FakeOptionElement(match[1], match[3], Number(match[2]))
  );
}

class FakeElement {
  constructor(selector = '') {
    this.selector = selector;
    this.textContent = '';
    this.dataset = {};
    this.attributes = new Map();
    this.listeners = new Map();
    this._innerHTML = '';
    this.optionElements = [];
    this.observers = [];
  }

  addEventListener(type, listener) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, []);
    }
    this.listeners.get(type).push(listener);
  }

  dispatchEvent(event) {
    for (const listener of this.listeners.get(event.type) || []) {
      listener(event);
    }
    return true;
  }

  setAttribute(name, value = '') {
    this.attributes.set(name, String(value));
  }

  removeAttribute(name) {
    this.attributes.delete(name);
  }

  hasAttribute(name) {
    return this.attributes.has(name);
  }

  querySelector(selector) {
    if (selector === '.select-trigger-text') {
      return this.triggerText || null;
    }
    if (selector === '[data-focused]') {
      return this.optionElements.find((option) => option.hasAttribute('data-focused')) || null;
    }
    return null;
  }

  querySelectorAll(selector) {
    if (selector === '.select-option') {
      return this.optionElements;
    }
    return [];
  }

  contains(target) {
    return target === this || this.optionElements.includes(target);
  }

  scrollIntoView() {}

  notifyMutation() {
    for (const callback of this.observers) {
      callback();
    }
  }

  set innerHTML(value) {
    this._innerHTML = value;
    this.notifyMutation();
  }

  get innerHTML() {
    return this._innerHTML;
  }
}

class FakeOptionElement extends FakeElement {
  constructor(value, textContent, index) {
    super('.select-option');
    this.dataset = { value, index: String(index) };
    this.textContent = textContent;
    this.className = 'select-option';
  }

  closest(selector) {
    return selector === '.select-option' ? this : null;
  }
}

class FakeSelectElement extends FakeElement {
  constructor() {
    super('#languageSelect');
    this.options = [];
    this._disabled = false;
    this._value = '';
  }

  set innerHTML(value) {
    this._innerHTML = value;
    this.options = parseOptions(value);
    this.notifyMutation();
  }

  get disabled() {
    return this._disabled;
  }

  set disabled(value) {
    this._disabled = Boolean(value);
    this.notifyMutation();
  }

  get value() {
    return this._value;
  }

  set value(value) {
    this._value = value;
    this.notifyMutation();
  }
}

class FakePopupElement extends FakeElement {
  set innerHTML(value) {
    this._innerHTML = value;
    this.optionElements = parsePopupOptions(value);
  }
}

class FakeDocument {
  constructor(elements) {
    this.elements = elements;
    this.listeners = new Map();
    this.documentElement = new FakeElement('html');
    this.title = '';
  }

  querySelector(selector) {
    return this.elements[selector] || null;
  }

  addEventListener(type, listener) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, []);
    }
    this.listeners.get(type).push(listener);
  }
}

function createRuntime(options = {}) {
  const appVersion = new FakeElement('#appVersion');
  const appPath = new FakeElement('#appPath');
  const languageSectionLabel = new FakeElement('#languageSectionLabel');
  const currentLabel = new FakeElement('#currentLabel');
  const currentLanguage = new FakeElement('#currentLanguage');
  const switchToLabel = new FakeElement('#switchToLabel');
  const languageSelect = new FakeSelectElement();
  const browseButton = new FakeElement('#browseButton');
  const extractButton = new FakeElement('#extractButton');
  const applyButton = new FakeElement('#applyButton');
  const permissionButton = new FakeElement('#permissionButton');
  permissionButton.hidden = true;
  const modalBackdrop = new FakeElement('#modalBackdrop');
  modalBackdrop.hidden = true;
  const modalTitle = new FakeElement('#modalTitle');
  const modalBody = new FakeElement('#modalBody');
  const modalPrimaryButton = new FakeElement('#modalPrimaryButton');
  const modalSecondaryButton = new FakeElement('#modalSecondaryButton');
  const modalCloseButton = new FakeElement('#modalCloseButton');
  const statusText = new FakeElement('#statusText');
  const triggerText = new FakeElement('.select-trigger-text');
  const selectTrigger = new FakeElement('#selectTrigger');
  selectTrigger.triggerText = triggerText;
  const selectPopup = new FakePopupElement('#selectPopup');

  const document = new FakeDocument({
    '#appVersion': appVersion,
    '#appPath': appPath,
    '#languageSectionLabel': languageSectionLabel,
    '#currentLabel': currentLabel,
    '#currentLanguage': currentLanguage,
    '#switchToLabel': switchToLabel,
    '#languageSelect': languageSelect,
    '#browseButton': browseButton,
    '#extractButton': extractButton,
    '#applyButton': applyButton,
    '#permissionButton': permissionButton,
    '#modalBackdrop': modalBackdrop,
    '#modalTitle': modalTitle,
    '#modalBody': modalBody,
    '#modalPrimaryButton': modalPrimaryButton,
    '#modalSecondaryButton': modalSecondaryButton,
    '#modalCloseButton': modalCloseButton,
    '#statusText': statusText,
    '#selectTrigger': selectTrigger,
    '#selectPopup': selectPopup,
  });

  const invokeCalls = [];
  const applyResponses = [...(options.applyResponses || [])];
  const window = {
    open(url) {
      invokeCalls.push({ command: 'window_open', payload: url });
    },
    __TAURI__: {
      core: {
        invoke(command, payload) {
          invokeCalls.push({ command, payload });
          if (command === 'get_status') {
            return Promise.resolve({
              appManagementGranted: false,
              appPath: '/Applications/Cavalry.app',
              currentLang: 'zh-Hans',
              languages: [
                { value: 'en', label: 'English' },
                { value: 'zh-Hans', label: '简体中文' },
              ],
              needsExtract: false,
              defaultAppCandidates: ['/Applications/Cavalry.app'],
              permissionAction: 'openPrivacy',
              platform: 'macos',
              version: '2.3.4',
              ...(options.status || {}),
            });
          }
          if (command === 'apply_language' && applyResponses.length > 0) {
            return Promise.resolve(applyResponses.shift());
          }
          return Promise.resolve({ ok: true });
        },
      },
    },
  };

  const context = {
    console,
    document,
    window,
    navigator: {
      language: options.language || 'en-US',
      languages: options.languages || [options.language || 'en-US'],
    },
    MutationObserver: class {
      constructor(callback) {
        this.callback = callback;
      }
      observe(target) {
        target.observers.push(this.callback);
      }
    },
    HTMLSelectElement: FakeSelectElement,
    Event: class {
      constructor(type, options = {}) {
        this.type = type;
        this.bubbles = Boolean(options.bubbles);
      }
    },
    Promise,
    setTimeout,
    clearTimeout,
  };
  context.global = context;
  context.globalThis = context;

  return {
    appVersion,
    appPath,
    languageSectionLabel,
    currentLabel,
    currentLanguage,
    switchToLabel,
    invokeCalls,
    languageSelect,
    extractButton,
    modalBackdrop,
    modalTitle,
    modalBody,
    modalPrimaryButton,
    modalSecondaryButton,
    modalCloseButton,
    permissionButton,
    applyButton,
    selectTrigger,
    statusText,
    triggerText,
    window,
    context,
  };
}

async function flush() {
  await Promise.resolve();
  await new Promise((resolve) => setImmediate(resolve));
  await Promise.resolve();
}

test('tauri bridge boots the original renderer app through invoke', async () => {
  const bridgeScript = readText('renderer/tauri-bridge.js');
  const appScript = readText('renderer/app.js');
  const runtime = createRuntime();

  vm.runInNewContext(bridgeScript, runtime.context, { filename: 'bridge.js' });
  vm.runInNewContext(appScript, runtime.context, { filename: 'app.js' });
  await flush();

  assert.equal(typeof runtime.window.cavalryI18n.getStatus, 'function');
  assert.equal(runtime.appVersion.textContent, 'Cavalry 2.3.4');
  assert.equal(runtime.appPath.textContent, '/Applications/Cavalry.app');
  assert.equal(runtime.currentLanguage.textContent, '简体中文');
  assert.equal(
    runtime.statusText.textContent,
    'System permission may be required to modify the Cavalry installation.'
  );
  assert.equal(runtime.context.document.documentElement.dataset.platform, 'macos');
  assert.equal(runtime.triggerText.textContent, '简体中文');
  assert.deepEqual(runtime.invokeCalls[0], { command: 'get_status', payload: undefined });

  await runtime.window.cavalryI18n.applyLanguage('/Applications/Cavalry.app', 'ja_JP');
  assert.deepEqual(JSON.parse(JSON.stringify(runtime.invokeCalls[1])), {
    command: 'apply_language',
    payload: { appPath: '/Applications/Cavalry.app', lang: 'ja_JP' },
  });
});

test('tauri bridge normalizes only the camelCase command payload surface', async () => {
  const bridgeScript = readText('renderer/tauri-bridge.js');
  const runtime = createRuntime({
    status: {
      appManagementGranted: undefined,
      appPath: undefined,
      currentLang: undefined,
      defaultAppCandidates: undefined,
      diagnostics: { source: 'backend-debug-only' },
      languages: undefined,
      needsExtract: undefined,
      permissionAction: undefined,
      platform: undefined,
      repoRoot: '/repo/debug-only',
      version: undefined,
      app_management_granted: true,
      app_path: '/Applications/Snake.app',
      current_lang: 'ja_JP',
      default_app_candidates: ['/Applications/Snake.app'],
      needs_extract: true,
      permission_action: 'requestElevation',
      platform_name: 'windows',
      repo_root: '/repo/snake',
    },
  });

  vm.runInNewContext(bridgeScript, runtime.context, { filename: 'bridge.js' });
  const status = await runtime.window.cavalryI18n.getStatus();

  assert.deepEqual(JSON.parse(JSON.stringify(status)), {
    appManagementGranted: null,
    appPath: '',
    currentLang: 'en',
    defaultAppCandidates: [],
    languages: [],
    needsExtract: false,
    permissionAction: 'none',
    platform: '',
    version: '',
  });
  assert.equal(Object.hasOwn(status, 'diagnostics'), false);
  assert.equal(Object.hasOwn(status, 'repoRoot'), false);
});

test('renderer localizes visible UI from the system language', async () => {
  const bridgeScript = readText('renderer/tauri-bridge.js');
  const appScript = readText('renderer/app.js');
  const runtime = createRuntime({ language: 'zh-CN' });

  vm.runInNewContext(bridgeScript, runtime.context, { filename: 'bridge.js' });
  vm.runInNewContext(appScript, runtime.context, { filename: 'app.js' });
  await flush();

  assert.equal(runtime.languageSectionLabel.textContent, '语言');
  assert.equal(runtime.currentLabel.textContent, '当前');
  assert.equal(runtime.switchToLabel.textContent, '切换为');
  assert.equal(runtime.applyButton.textContent, '应用并重启');
  assert.equal(runtime.extractButton.textContent, '刷新英文');
  assert.equal(runtime.statusText.textContent, '修改 Cavalry 安装目录可能需要系统授权。');
});

test('renderer hides the permission warning when app management is already granted', async () => {
  const bridgeScript = readText('renderer/tauri-bridge.js');
  const appScript = readText('renderer/app.js');
  const runtime = createRuntime({ status: { appManagementGranted: true } });

  vm.runInNewContext(bridgeScript, runtime.context, { filename: 'bridge.js' });
  vm.runInNewContext(appScript, runtime.context, { filename: 'app.js' });
  await flush();

  assert.equal(runtime.statusText.textContent, 'Ready to apply a language pack.');
});

test('renderer asks for confirmation before applying a language pack', async () => {
  const bridgeScript = readText('renderer/tauri-bridge.js');
  const appScript = readText('renderer/app.js');
  const runtime = createRuntime();

  vm.runInNewContext(bridgeScript, runtime.context, { filename: 'bridge.js' });
  vm.runInNewContext(appScript, runtime.context, { filename: 'app.js' });
  await flush();

  await runtime.applyButton.listeners.get('click')[0]();
  await flush();

  assert.equal(runtime.modalBackdrop.hidden, false);
  assert.equal(runtime.modalTitle.textContent, 'Install language pack?');
  assert.equal(runtime.modalPrimaryButton.textContent, 'Continue');
  assert.equal(runtime.modalSecondaryButton.textContent, 'Cancel');
  assert.deepEqual(
    JSON.parse(JSON.stringify(runtime.invokeCalls.filter((call) => call.command === 'apply_language'))),
    []
  );

  await runtime.modalPrimaryButton.listeners.get('click')[0]();
  await flush();

  assert.equal(runtime.modalBackdrop.hidden, true);
  assert.deepEqual(
    JSON.parse(JSON.stringify(runtime.invokeCalls.find((call) => call.command === 'apply_language'))),
    {
    command: 'apply_language',
    payload: { appPath: '/Applications/Cavalry.app', lang: 'zh-Hans' },
    }
  );
  assert.deepEqual(
    JSON.parse(JSON.stringify(runtime.invokeCalls.find((call) => call.command === 'restart_cavalry'))),
    {
    command: 'restart_cavalry',
    payload: { appPath: '/Applications/Cavalry.app' },
    }
  );
});

test('renderer reports committed copy cleanup residue as a warning instead of a patch failure', async () => {
  const bridgeScript = readText('renderer/tauri-bridge.js');
  const appScript = readText('renderer/app.js');
  const residualPath = 'C:\\Temp\\cavalry-i18n-copy-backup-42';
  const cleanupWarning =
    `Language files were applied, but transaction backups could not be removed from ${residualPath}: simulated cleanup lock.`;
  const runtime = createRuntime({
    status: {
      appPath: 'D:\\Cavalry',
      defaultAppCandidates: ['D:\\Cavalry'],
      permissionAction: 'none',
      platform: 'windows',
    },
    applyResponses: [
      {
        ok: true,
        currentLang: 'zh-Hans',
        warning: cleanupWarning,
      },
    ],
  });

  vm.runInNewContext(bridgeScript, runtime.context, { filename: 'bridge.js' });
  vm.runInNewContext(appScript, runtime.context, { filename: 'app.js' });
  await flush();

  await runtime.applyButton.listeners.get('click')[0]();
  await flush();
  await runtime.modalPrimaryButton.listeners.get('click')[0]();
  await flush();

  assert.equal(runtime.statusText.dataset.tone, 'warning');
  assert.match(runtime.statusText.textContent, /Applied 简体中文 and restarted Cavalry\./);
  assert.match(runtime.statusText.textContent, /transaction backups could not be removed/);
  assert.match(runtime.statusText.textContent, /cavalry-i18n-copy-backup-42/);
  assert.doesNotMatch(runtime.statusText.textContent, /Patch failed/);
});

test('renderer shows a localized system permission dialog and retries the same selection', async () => {
  const bridgeScript = readText('renderer/tauri-bridge.js');
  const appScript = readText('renderer/app.js');
  const runtime = createRuntime({
    language: 'zh-CN',
    applyResponses: [
      {
        ok: false,
        permissionRequired: true,
        error: 'Operation not permitted while modifying /Applications/Cavalry.app',
      },
      { ok: true, currentLang: 'zh-Hans' },
    ],
  });

  vm.runInNewContext(bridgeScript, runtime.context, { filename: 'bridge.js' });
  vm.runInNewContext(appScript, runtime.context, { filename: 'app.js' });
  await flush();

  await runtime.applyButton.listeners.get('click')[0]();
  await flush();
  await runtime.modalPrimaryButton.listeners.get('click')[0]();
  await flush();

  assert.equal(runtime.statusText.dataset.tone, 'warning');
  assert.equal(runtime.statusText.textContent, '正在等待系统授权。');
  assert.equal(runtime.modalBackdrop.hidden, false);
  assert.equal(runtime.modalTitle.textContent, '需要系统授权');
  assert.equal(runtime.modalPrimaryButton.textContent, '重试应用');
  assert.equal(runtime.modalSecondaryButton.textContent, '打开权限设置');
  assert.deepEqual(JSON.parse(JSON.stringify(runtime.invokeCalls.at(-1))), {
    command: 'apply_language',
    payload: { appPath: '/Applications/Cavalry.app', lang: 'zh-Hans' },
  });

  await runtime.modalSecondaryButton.listeners.get('click')[0]();
  assert.deepEqual(JSON.parse(JSON.stringify(runtime.invokeCalls.at(-1))), {
    command: 'open_privacy_security',
  });

  await runtime.modalPrimaryButton.listeners.get('click')[0]();
  await flush();

  assert.deepEqual(
    JSON.parse(JSON.stringify(runtime.invokeCalls.filter((call) => call.command === 'browse_app'))),
    []
  );
  assert.deepEqual(
    JSON.parse(
      JSON.stringify(runtime.invokeCalls.filter((call) => call.command === 'apply_language'))
    ),
    [
      {
        command: 'apply_language',
        payload: { appPath: '/Applications/Cavalry.app', lang: 'zh-Hans' },
      },
      {
        command: 'apply_language',
        payload: { appPath: '/Applications/Cavalry.app', lang: 'zh-Hans' },
      },
    ]
  );
});

test('renderer retries Windows permission failures through elevation without opening macOS settings', async () => {
  const bridgeScript = readText('renderer/tauri-bridge.js');
  const appScript = readText('renderer/app.js');
  const windowsInstall = 'C:\\Program Files\\Cavalry';
  const runtime = createRuntime({
    language: 'zh-CN',
    status: {
      appPath: windowsInstall,
      defaultAppCandidates: [windowsInstall],
      permissionAction: 'requestElevation',
      platform: 'windows',
    },
    applyResponses: [
      {
        ok: false,
        permissionRequired: true,
        error: 'Administrator permission required',
      },
      { ok: true, currentLang: 'zh-Hans' },
    ],
  });

  vm.runInNewContext(bridgeScript, runtime.context, { filename: 'bridge.js' });
  vm.runInNewContext(appScript, runtime.context, { filename: 'app.js' });
  await flush();

  assert.equal(runtime.context.document.documentElement.dataset.platform, 'windows');
  await runtime.applyButton.listeners.get('click')[0]();
  await flush();
  await runtime.modalPrimaryButton.listeners.get('click')[0]();
  await flush();

  assert.equal(runtime.modalPrimaryButton.textContent, '以管理员身份重试');
  assert.equal(runtime.modalSecondaryButton.textContent, '取消');
  assert.equal(runtime.permissionButton.textContent, '以管理员身份重试');
  assert.equal(runtime.permissionButton.hidden, false);

  await runtime.permissionButton.listeners.get('click')[0]();
  await flush();

  const applyCalls = runtime.invokeCalls.filter((call) => call.command === 'apply_language');
  assert.equal(applyCalls.length, 2);
  assert.deepEqual(JSON.parse(JSON.stringify(applyCalls[0].payload)), {
    appPath: windowsInstall,
    lang: 'zh-Hans',
  });
  assert.equal(runtime.invokeCalls.some((call) => call.command === 'open_privacy_security'), false);
});

test('renderer reports an unwritable custom Windows root without offering a UAC retry', async () => {
  const bridgeScript = readText('renderer/tauri-bridge.js');
  const appScript = readText('renderer/app.js');
  const customInstall = 'D:\\Creative Tools\\Cavalry';
  const backendError =
    'The selected Cavalry installation is not writable. Windows administrator retry is available only for installations under the OS-known Program Files folders; choose a writable Cavalry copy or update that folder\'s permissions.';
  const runtime = createRuntime({
    status: {
      appManagementGranted: false,
      appPath: customInstall,
      defaultAppCandidates: [customInstall],
      permissionAction: 'none',
      platform: 'windows',
    },
    applyResponses: [{ ok: false, permissionRequired: false, error: backendError }],
  });

  vm.runInNewContext(bridgeScript, runtime.context, { filename: 'bridge.js' });
  vm.runInNewContext(appScript, runtime.context, { filename: 'app.js' });
  await flush();

  assert.equal(
    runtime.statusText.textContent,
    'The selected Cavalry folder is not writable. Windows administrator retry is only available for installations under Program Files; choose a writable copy or update this folder’s permissions.'
  );
  assert.equal(runtime.statusText.dataset.tone, 'error');
  assert.equal(runtime.permissionButton.hidden, true);

  await runtime.applyButton.listeners.get('click')[0]();
  await flush();
  await runtime.modalPrimaryButton.listeners.get('click')[0]();
  await flush();

  assert.equal(runtime.modalBackdrop.hidden, true);
  assert.equal(runtime.permissionButton.hidden, true);
  assert.equal(
    runtime.statusText.textContent,
    `Patch failed. Details: ${backendError}`
  );
  assert.equal(runtime.invokeCalls.some((call) => call.command === 'open_privacy_security'), false);
  assert.equal(
    runtime.invokeCalls.filter((call) => call.command === 'apply_language').length,
    1
  );
});

test('renderer localizes status failures while preserving backend details', async () => {
  const bridgeScript = readText('renderer/tauri-bridge.js');
  const appScript = readText('renderer/app.js');
  const runtime = createRuntime({
    language: 'zh-CN',
    applyResponses: [{ ok: false, error: 'Backend refused the patch' }],
  });

  vm.runInNewContext(bridgeScript, runtime.context, { filename: 'bridge.js' });
  vm.runInNewContext(appScript, runtime.context, { filename: 'app.js' });
  await flush();

  await runtime.applyButton.listeners.get('click')[0]();
  await flush();
  await runtime.modalPrimaryButton.listeners.get('click')[0]();
  await flush();

  assert.equal(runtime.statusText.textContent, '应用语言包失败。详情：Backend refused the patch');
});

test('custom select dispatches native change when an option is picked', async () => {
  const bridgeScript = readText('renderer/tauri-bridge.js');
  const appScript = readText('renderer/app.js');
  const runtime = createRuntime();
  let changeCount = 0;

  runtime.languageSelect.addEventListener('change', () => {
    changeCount += 1;
  });

  vm.runInNewContext(bridgeScript, runtime.context, { filename: 'bridge.js' });
  vm.runInNewContext(appScript, runtime.context, { filename: 'app.js' });
  await flush();

  runtime.selectTrigger.listeners.get('click')[0]({
    preventDefault() {},
    stopPropagation() {},
  });
  const option = runtime.context.document.querySelector('#selectPopup').optionElements[0];
  runtime.context.document.querySelector('#selectPopup').listeners.get('click')[0]({
    target: option,
  });

  assert.equal(runtime.languageSelect.value, 'en');
  assert.equal(changeCount, 1);
});
