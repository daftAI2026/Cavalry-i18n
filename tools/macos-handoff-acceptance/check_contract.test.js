/**
 * [INPUT]: 依赖 macos-handoff-acceptance producer/probe/L2 与父级工具地图源码。
 * [OUTPUT]: 验证只读证据器固定人工阶段、只截 Switcher PID、拒绝仓库内 session、无 TCC/AX/输入合成并维持 GEB 契约。
 * [POS]: macos-handoff-acceptance 的跨平台静态门；不运行 Swift、不打开设置、不冒充 packaged live PASS。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const read = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8');

test('producer keeps a fixed human-authored evidence vocabulary', () => {
  const { PHASES, verify } = require('./record_checkpoint');
  assert.equal(typeof verify, 'function');
  for (const phase of [
    'permission-blocked', 'helper-presented', 'drag-cancelled', 'drop-accepted',
    'retry-still-denied', 'retry-verified', 'reverse-complete', 'existing-row',
    'target-lost', 'reduced-motion-helper', 'reduced-motion-complete',
  ]) assert.equal(PHASES.has(phase), true, phase);
});

test('producer records system settings as metadata but screenshots only switcher-owned windows', () => {
  const source = read('tools/macos-handoff-acceptance/record_checkpoint.js');
  const probe = read('tools/macos-handoff-acceptance/window_probe.swift');
  assert.match(probe, /ownerKind.*systemSettings/s);
  assert.doesNotMatch(probe, /kCGWindowName/);
  assert.match(source, /filter\(\(item\) => item\.ownerKind === 'switcher'\)/);
  assert.match(source, /path: path\.join\(destination, path\.basename\(file\)\)/);
  assert.doesNotMatch(source, /systemSettings[^\n]*screencapture/);
});

test('session output stays outside repository and both app bundles', () => {
  const source = read('tools/macos-handoff-acceptance/record_checkpoint.js');
  assert.match(source, /resolveNewSession\(args\['session-dir'\], \[ROOT, switcher\.path, cavalry\.path\]\)/);
  assert.match(source, /rejectInside\(ROOT, session, 'Session directory'\)/);
  assert.match(source, /Cavalry 2\.7\.2 required/);
  assert.match(source, /verifyIdentity\(sealRecord\.manifest, 'Sealed manifest'\)/);
  assert.match(source, /capture identity drifted/);
});

test('producer and probe never automate privacy state or synthesize user input', () => {
  const combined = [
    read('tools/macos-handoff-acceptance/record_checkpoint.js'),
    read('tools/macos-handoff-acceptance/window_probe.swift'),
  ].join('\n');
  for (const forbidden of [
    'TCC.db', 'tccutil', 'AXUIElement', 'CGEventPost', 'System Events', 'osascript',
    'ScreenCaptureKit', 'Privacy_AppBundles?',
  ]) assert.equal(combined.includes(forbidden), false, forbidden);
});

test('new module keeps L2/L3 protocol and parent navigation', () => {
  const files = [
    'tools/macos-handoff-acceptance/CLAUDE.md',
    'tools/macos-handoff-acceptance/record_checkpoint.js',
    'tools/macos-handoff-acceptance/window_probe.swift',
    'tools/macos-handoff-acceptance/check_contract.test.js',
  ];
  for (const file of files) {
    assert.match(read(file), /\[PROTOCOL\]: 变更时更新此头部，然后检查 CLAUDE\.md/, file);
  }
  assert.match(read(files[0]), /父级: \.\.\/CLAUDE\.md/);
  assert.match(read('tools/CLAUDE.md'), /macos-handoff-acceptance\//);
  const scripts = JSON.parse(read('package.json')).scripts;
  assert.equal(scripts['test:handoff:macos:contracts'],
    'node --test tools/macos-handoff-acceptance/check_contract.test.js');
  assert.equal(scripts['record:handoff:macos'],
    'node tools/macos-handoff-acceptance/record_checkpoint.js');
});
