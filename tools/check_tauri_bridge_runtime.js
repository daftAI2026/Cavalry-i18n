#!/usr/bin/env node
/**
 * [INPUT]: 依赖 src-tauri bridge.rs、renderer app.js 与一个最小 fake DOM/runtime
 * [OUTPUT]: 对外提供 bridge + app.js 运行时契约测试，证明 preload 替代层足以驱动原 renderer
 * [POS]: tools 的 Phase 1 bridge 守门，把字符串级断言升级为实际脚本执行
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

function createRuntime() {
  const appVersion = new FakeElement('#appVersion');
  const appPath = new FakeElement('#appPath');
  const currentLanguage = new FakeElement('#currentLanguage');
  const languageSelect = new FakeSelectElement();
  const browseButton = new FakeElement('#browseButton');
  const extractButton = new FakeElement('#extractButton');
  const applyButton = new FakeElement('#applyButton');
  const statusText = new FakeElement('#statusText');
  const triggerText = new FakeElement('.select-trigger-text');
  const selectTrigger = new FakeElement('#selectTrigger');
  selectTrigger.triggerText = triggerText;
  const selectPopup = new FakePopupElement('#selectPopup');

  const document = new FakeDocument({
    '#appVersion': appVersion,
    '#appPath': appPath,
    '#currentLanguage': currentLanguage,
    '#languageSelect': languageSelect,
    '#browseButton': browseButton,
    '#extractButton': extractButton,
    '#applyButton': applyButton,
    '#statusText': statusText,
    '#selectTrigger': selectTrigger,
    '#selectPopup': selectPopup,
  });

  const invokeCalls = [];
  const window = {
    __TAURI__: {
      core: {
        invoke(command, payload) {
          invokeCalls.push({ command, payload });
          if (command === 'get_status') {
            return Promise.resolve({
              appPath: '/Applications/Cavalry.app',
              currentLang: 'zh-Hans',
              languages: [
                { value: 'en', label: 'English' },
                { value: 'zh-Hans', label: '简体中文' },
              ],
              needsExtract: false,
              defaultAppCandidates: ['/Applications/Cavalry.app'],
              version: '2.3.4',
            });
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
    MutationObserver: class {
      constructor(callback) {
        this.callback = callback;
      }
      observe(target) {
        target.observers.push(this.callback);
      }
    },
    HTMLSelectElement: FakeSelectElement,
    Promise,
    setTimeout,
    clearTimeout,
  };
  context.global = context;
  context.globalThis = context;

  return {
    appVersion,
    appPath,
    currentLanguage,
    invokeCalls,
    languageSelect,
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

test('tauri bridge boots the original renderer app without Electron preload', async () => {
  const bridgeScript = readText('desktop-patcher/renderer/tauri-bridge.js');
  const appScript = readText('desktop-patcher/renderer/app.js');
  const runtime = createRuntime();

  vm.runInNewContext(bridgeScript, runtime.context, { filename: 'bridge.js' });
  vm.runInNewContext(appScript, runtime.context, { filename: 'app.js' });
  await flush();

  assert.equal(typeof runtime.window.cavalryI18n.getStatus, 'function');
  assert.equal(runtime.appVersion.textContent, 'Cavalry 2.3.4');
  assert.equal(runtime.appPath.textContent, '/Applications/Cavalry.app');
  assert.equal(runtime.currentLanguage.textContent, '简体中文');
  assert.equal(runtime.statusText.textContent, 'Ready.');
  assert.equal(runtime.triggerText.textContent, '简体中文');
  assert.deepEqual(runtime.invokeCalls[0], { command: 'get_status', payload: undefined });

  await runtime.window.cavalryI18n.applyLanguage('/Applications/Cavalry.app', 'ja_JP');
  assert.deepEqual(JSON.parse(JSON.stringify(runtime.invokeCalls[1])), {
    command: 'apply_language',
    payload: { appPath: '/Applications/Cavalry.app', lang: 'ja_JP' },
  });
});
