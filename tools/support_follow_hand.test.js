/**
 * [INPUT]: 真实support-footer控制器、最小DOM/前台/存储与可推进时钟。
 * [OUTPUT]: 验证完整结果落稳后的一次性引导、后台延期、取消与Reduce Motion；不授像素PASS。
 * [POS]: 无浏览器依赖的renderer行为合同；实际手势外观另由UI Review录屏验收。
 * [PROTOCOL]: 变更时检查tools/CLAUDE.md。
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const source = ['support-follow-hand.js', 'support-footer.js'].map((name) => fs.readFileSync(path.join(__dirname, '../renderer', name), 'utf8')).join('\n');

function fixture({ stored = false, reduced = false, focused = true, storageBlocked = false, random = 0 } = {}) {
  let now = 0, id = 0;
  const timers = new Map(), events = new Map(), observers = [], animations = [];
  const storage = new Map(stored ? [['cavalry-i18n:follow-hand-seen', '1']] : []);
  const elements = new Map();
  const media = { matches: reduced, addEventListener: (type, fn) => events.set(`media:${type}`, fn) };
  const document = {
    visibilityState: 'visible', focused, blocked: false,
    hasFocus() { return this.focused; },
    addEventListener: (type, fn) => events.set(`doc:${type}`, fn),
    querySelector(selector) {
      if (selector.startsWith('dialog')) return document.blocked ? {} : null;
      if (!elements.has(selector)) elements.set(selector, element(selector));
      return elements.get(selector);
    },
  };
  function element(selector) {
    return {
      ownerDocument: document, hidden: true, dataset: {}, style: {}, textContent: '',
      complete: true, naturalWidth: 1494, children: [],
      append(child) { this.children.push(child); },
      setAttribute() {}, addEventListener(type, fn) { this[type] = fn; },
      getBoundingClientRect: () => ({ left: ({ '#supportGithubIcon': 180, '#supportTwitterIcon': 224, '#supportXiaohongshuIcon': 268 })[selector] || 60, top: 472, width: selector === '#supportXiaohongshuIcon' ? 32 : 16, height: 16 }),
      animate(frames, options) {
        const animation = { frames, options, cancelled: false, cancel() { this.cancelled = true; } };
        animations.push(animation); return animation;
      },
    };
  }
  const window = {
    innerWidth: 400,
    matchMedia: () => media,
    addEventListener: (type, fn) => events.set(`win:${type}`, fn),
    MutationObserver: class {
      constructor(fn) { this.notify = fn; this.connected = true; observers.push(this); }
      observe() {} disconnect() { this.connected = false; }
    },
    localStorage: {
      getItem(key) { if (storageBlocked) throw Error('storage unavailable'); return storage.get(key); },
      setItem(key, value) { if (storageBlocked) throw Error('storage unavailable'); storage.set(key, value); },
    },
  };
  vm.runInNewContext(source, {
    window, Math: Object.assign(Object.create(Math), { random: () => random }),
    setTimeout(fn, delay) { const key = ++id; timers.set(key, { at: now + delay, fn }); return key; },
    clearTimeout(key) { timers.delete(key); },
    getComputedStyle: () => ({ getPropertyValue: (key) => key === '--support-follow-hand-overhang' ? '40px' : key.endsWith('-delay') ? '800ms' : '2800ms' }),
  });
  const links = [];
  const control = window.createSupportFooterControl({ document, icons: { create: () => ({}) }, text: (key) => key, openProjectLink: (target) => links.push(target) });
  const hand = document.querySelector('#supportFollowHand');
  const outcome = document.querySelector('#statusOutcome');
  const activity = document.querySelector('#statusPanel');
  function notify() { for (const observer of observers) if (observer.connected) observer.notify(); }
  function settle(text = 'Switched. Cavalry is now open.') {
    activity.dataset.hasOutcome = 'true'; outcome.hidden = false; outcome.textContent = text; notify();
  }
  function tick(ms) {
    const end = now + ms;
    for (;;) {
      const next = [...timers].sort((a, b) => a[1].at - b[1].at)[0];
      if (!next || next[1].at > end) break;
      now = next[1].at; timers.delete(next[0]); next[1].fn();
    }
    now = end;
  }
  return { control, document, hand, outcome, media, storage, elements, animations, links, settle, tick,
    event(type) { events.get(type)?.(); }, offer() { control.offerAfterSuccess('Switched. Cavalry is now open.'); } };
}

test('full successful outcome must settle for 800ms before one 2.8s gesture', () => {
  const f = fixture(); f.offer(); f.tick(3000); assert.equal(f.animations.length, 0);
  f.settle('Switched.'); f.tick(3000); assert.equal(f.animations.length, 0);
  f.settle(); f.tick(799); assert.equal(f.animations.length, 0);
  f.tick(1); assert.equal(f.animations.length, 1); assert.equal(f.hand.hidden, false);
  assert.equal(f.animations[0].options.duration, 2800);
  assert.match(f.animations[0].frames[2].transform, /translate\(188px, 465px\)/);
  assert.equal(f.storage.get('cavalry-i18n:follow-hand-seen'), '1');
  f.animations[0].onfinish(); assert.equal(f.hand.hidden, true);
  f.offer(); f.settle(); f.tick(3000); assert.equal(f.animations.length, 1);
});

test('background success waits for window focus and a fresh readable dwell', () => {
  const f = fixture({ focused: false }); f.offer(); f.settle(); f.tick(3000);
  assert.equal(f.animations.length, 0);
  f.document.focused = true; f.event('win:focus'); f.tick(400);
  f.document.focused = false; f.event('win:blur'); f.tick(1000);
  assert.equal(f.animations.length, 0);
  f.document.focused = true; f.event('win:focus'); f.tick(800);
  assert.equal(f.animations.length, 1);
});

test('hidden document and an open dialog or language list cannot start the hand', () => {
  const f = fixture(); f.document.visibilityState = 'hidden'; f.offer(); f.settle(); f.tick(2000);
  assert.equal(f.animations.length, 0);
  f.document.visibilityState = 'visible'; f.document.blocked = true;
  f.event('doc:visibilitychange'); f.tick(2000); assert.equal(f.animations.length, 0);
  f.document.blocked = false; f.event('win:focus'); f.tick(800);
  assert.equal(f.animations.length, 1);
});

test('new work and user input cancel pending or active guidance', () => {
  for (const event of ['doc:pointerdown', 'doc:keydown', 'busy']) {
    const f = fixture(); f.offer(); f.settle(); f.tick(400);
    if (event === 'busy') { f.control.setBusy(true); f.control.setBusy(false); } else f.event(event);
    f.tick(3000); assert.equal(f.animations.length, 0, event);
  }
  const f = fixture(); f.offer(); f.settle(); f.tick(800); f.event('doc:pointerdown');
  assert.equal(f.hand.hidden, true); assert.equal(f.animations[0].cancelled, true);
});

test('reduced motion skips the gesture and changing preference stops it', () => {
  const f = fixture({ reduced: true }); f.offer(); f.settle(); f.tick(3000);
  assert.equal(f.animations.length, 0);
  const active = fixture(); active.offer(); active.settle(); active.tick(800);
  active.media.matches = true; active.event('media:change');
  assert.equal(active.hand.hidden, true); assert.equal(active.animations[0].cancelled, true);
});

test('prior display or a real footer link click suppresses the request', () => {
  const f = fixture({ stored: true }); f.offer(); f.settle(); f.tick(3000);
  assert.equal(f.animations.length, 0);
  const clicked = fixture();
  clicked.elements.get('#supportTwitterLink').click({ preventDefault() {} });
  assert.deepEqual(clicked.links, ['twitter']);
  clicked.offer(); clicked.settle(); clicked.tick(3000); assert.equal(clicked.animations.length, 0);
});

test('storage unavailable retains once-per-session behavior', () => {
  const f = fixture({ storageBlocked: true }); f.offer(); f.settle(); f.tick(800);
  f.animations[0].onfinish(); f.offer(); f.settle(); f.tick(3000);
  assert.equal(f.animations.length, 1);
});

// Each choice uses the real anchor, without opening a link or changing focus.
test('one random social anchor per play, approaching from the upper-left', () => {
  for (const [random, target, x] of [[0, 'repository', 188], [0.5, 'twitter', 232], [0.999, 'xiaohongshu', 284]]) {
    const f = fixture({ random }); f.offer(); f.settle(); f.tick(800);
    assert.equal(f.hand.dataset.target, target);
    assert.match(f.animations[0].frames[2].transform, new RegExp(`translate\\(${x}px, 465px\\)`));
    const initial = f.animations[0].frames[0].transform.match(/translate\(([-.\d]+)px, ([-.\d]+)px\)/);
    assert.ok(Number(initial[1]) < x && Number(initial[2]) < 465);
    assert.equal(f.links.length, 0);
  }
});
