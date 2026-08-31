#!/usr/bin/env node
/**
 * [INPUT]: renderer/icons.js 与 renderer/operation-log.js、最小 DOM/时钟 fixture。
 * [OUTPUT]: 验证 Marker 稳定 upsert、浏览器下一帧布局收敛后的 live-edge、首尾 Message 改变三轨布局后的溢出/起止边缘回算、快事件可读串行、结果排队与错误立即抢占。
 * [POS]: tools 的任务反馈专属运行时合同；从综合 bridge 测试拆出，避免 renderer 业务 fixture 承担组件内部时序。
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
  constructor() {
    this.children = []; this._textContent = ''; this.dataset = {}; this.listeners = new Map();
    this.attributes = new Map(); this.hidden = false; this.scrollTop = 0; this.clientHeight = 0;
  }
  get textContent() { return this.children.length ? this.children.map((child) => child.textContent).join('') : this._textContent; }
  set textContent(value) { this._textContent = String(value ?? ''); }
  get scrollHeight() { return this.children.length; }
  addEventListener(type, callback) { this.listeners.set(type, [...(this.listeners.get(type) || []), callback]); }
  setAttribute(key, value = '') { this.attributes.set(key, String(value)); }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children = children; }
}

function fixture(styleValues = {}) {
  const elements = Object.fromEntries(
    ['root', 'idle', 'intro', 'viewport', 'list', 'outcome'].map((name) => [name, new Element()])
  );
  const document = { createElement: () => new Element(), createElementNS: () => new Element() };
  let nextFrameId = 1;
  const animationFrames = new Map();
  const window = {
    requestAnimationFrame(callback) {
      const id = nextFrameId++;
      animationFrames.set(id, callback);
      return id;
    },
  };
  const context = {
    window, document, Date, Promise, setTimeout, clearTimeout,
    getComputedStyle: () => ({ getPropertyValue: (name) => styleValues[name] || '0ms' }),
  };
  context.globalThis = context;
  vm.runInNewContext(read('renderer/icons.js'), context, { filename: 'icons.js' });
  vm.runInNewContext(read('renderer/operation-log.js'), context, { filename: 'operation-log.js' });
  const log = window.createOperationLog({
    root: elements.root, idleMessage: elements.idle, intro: elements.intro,
    viewport: elements.viewport, list: elements.list, outcome: elements.outcome,
  });
  const flushAnimationFrames = () => {
    const callbacks = [...animationFrames.values()];
    animationFrames.clear();
    callbacks.forEach((callback) => callback(Date.now()));
  };
  return { elements, log, flushAnimationFrames };
}

function titleAt(elements, index) {
  return elements.list.children[index]?.children[1]?.children[0]?.textContent || '';
}

test('Marker swaps Spinner in place and follows only while the reader stays at the live edge', () => {
  const { elements, log } = fixture();
  elements.viewport.clientHeight = 20;
  Object.defineProperty(elements.viewport, 'scrollHeight', {
    configurable: true, get: () => elements.list.children.length * 20,
  });
  log.replace({ id: 'verify', title: 'Checking', state: 'running' });
  assert.equal(elements.list.children[0].children[0].dataset.icon, 'spinner');
  log.upsert({ id: 'verify', title: 'Checked', state: 'completed', icon: 'verify' });
  assert.equal(elements.list.children.length, 1);
  assert.equal(elements.list.children[0].children[0].dataset.icon, 'verify');
  log.upsert({ id: 'baseline', title: 'Preparing recovery files', state: 'running' });
  assert.equal(elements.viewport.scrollTop, 40);
  assert.equal(elements.viewport.dataset.atEnd, 'true');
  elements.viewport.scrollTop = 0;
  for (const callback of elements.viewport.listeners.get('scroll') || []) callback();
  assert.equal(elements.viewport.dataset.atStart, 'true');
  assert.equal(elements.viewport.dataset.atEnd, 'false');
  log.upsert({ id: 'apply', title: 'Applying', state: 'running' });
  assert.equal(elements.viewport.scrollTop, 0);
});

test('outcome track recalculates overflow when it shrinks the middle viewport', () => {
  const { elements, log } = fixture();
  Object.defineProperty(elements.viewport, 'clientHeight', {
    configurable: true,
    get: () => elements.root.dataset.hasOutcome === 'true' ? 20 : 40,
  });
  Object.defineProperty(elements.viewport, 'scrollHeight', {
    configurable: true,
    get: () => elements.list.children.length * 20,
  });

  log.start({ intro: 'Preparing the task.' });
  log.upsert({ id: 'verify', title: 'Installation verified', state: 'completed', icon: 'verify' });
  log.upsert({ id: 'apply', title: 'Language switched', state: 'completed', icon: 'translate' });
  assert.equal(elements.viewport.dataset.overflowing, 'false');

  log.complete('Task complete.');
  assert.equal(elements.root.dataset.hasOutcome, 'true');
  assert.equal(elements.viewport.dataset.overflowing, 'true');
  assert.equal(elements.viewport.dataset.atEnd, 'true');
  assert.equal(elements.viewport.scrollTop, 40);
});

test('a blocker description remeasures after layout and pushes the live edge upward', () => {
  const { elements, log, flushAnimationFrames } = fixture();
  let committedScrollHeight = 56;
  elements.viewport.clientHeight = 78;
  Object.defineProperty(elements.viewport, 'scrollHeight', {
    configurable: true, get: () => committedScrollHeight,
  });

  log.replace({ id: 'verify', title: 'Installation verified', state: 'completed' });
  log.upsert({ id: 'baseline', title: 'Recovery files ready', state: 'completed' });
  log.upsert({
    id: 'apply',
    title: 'System permission required',
    description: 'Allow Language Switcher to modify Cavalry, then retry.',
    state: 'warning',
    urgent: true,
  });

  assert.equal(elements.viewport.dataset.overflowing, 'false');
  committedScrollHeight = 104;
  flushAnimationFrames();
  assert.equal(elements.viewport.dataset.overflowing, 'true');
  assert.equal(elements.viewport.dataset.atEnd, 'true');
  assert.equal(elements.viewport.scrollTop, 104);
});

test('fast events stay sequential, outcome waits, and terminal error preempts delays', async () => {
  const { elements, log } = fixture({
    '--duration-operation-running-min': '24ms', '--duration-operation-step-gap': '12ms',
  });
  const phases = [
    { id: 'verify', title: 'Checking', state: 'running' },
    { id: 'verify', title: 'Checked', state: 'completed', icon: 'verify' },
    { id: 'apply', title: 'Applying', state: 'running' },
  ];
  log.start({ intro: 'Preparing the task.' });
  phases.forEach(log.upsert);
  log.complete('Task complete.');
  assert.equal(elements.list.children.length, 1);
  assert.equal(elements.outcome.hidden, true);
  await new Promise((resolve) => setTimeout(resolve, 60));
  assert.equal(elements.list.children.length, 2);
  assert.equal(elements.outcome.textContent, 'Task complete.');

  log.start({ intro: 'Preparing another task.' });
  phases.forEach(log.upsert);
  log.upsert({ id: 'apply', title: 'Could not apply', state: 'error' });
  assert.equal(elements.list.children.length, 2);
  assert.equal(titleAt(elements, 1), 'Could not apply');
  assert.equal(elements.list.children[1].children[0].dataset.icon, 'errorCircle');
  assert.equal(elements.outcome.hidden, true);
});
