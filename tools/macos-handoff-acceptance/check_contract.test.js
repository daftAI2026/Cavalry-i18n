/**
 * [INPUT]: 依赖 macos-handoff-acceptance producer/probe/L2 与父级工具地图源码。
 * [OUTPUT]: 验证 R5 机器输入门、clean detached source、用户域 Cavalry、只截 Switcher PID、retry 回读合同、无 TCC/AX/输入合成并维持 GEB 契约。
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

const recorder = require('./record_checkpoint');

const SHA256 = 'a'.repeat(64);
const COMMIT = 'b'.repeat(40);
const LIVE_ARGS = {
  'expected-source-commit': COMMIT,
  'expected-switcher-executable-sha256': SHA256,
  'expected-cavalry-executable-sha256': SHA256,
  'expected-cavalry-runtime-sha256': SHA256,
  'expected-vendor-team-id': 'TEAM123456',
  'expected-language': 'zh-Hans',
};

function retryManifest() {
  return {
    expected: {
      sourceCommit: COMMIT,
      switcherExecutableSha256: SHA256,
      cavalryExecutableSha256: SHA256,
      cavalryRuntimeSha256: SHA256,
      vendorTeamId: 'TEAM123456',
      language: 'zh-Hans',
    },
    user: {
      uid: 501,
      home: '/Users/test-user',
      cavalryAppPath: '/Users/test-user/Applications/Cavalry.app',
      applicationSupportStatePath: '/Users/test-user/Library/Application Support/com.daftai.cavalry-i18n/state.json',
    },
  };
}

test('producer keeps a fixed machine-authored evidence vocabulary', () => {
  const { PHASES, SCENARIOS, verify } = recorder;
  assert.equal(typeof verify, 'function');
  for (const phase of [
    'permission-blocked', 'helper-presented', 'drag-cancelled', 'drop-accepted',
    'retry-still-denied', 'retry-verified', 'reverse-complete', 'existing-row',
    'target-lost', 'reduced-motion-helper', 'reduced-motion-complete',
  ]) assert.equal(PHASES.has(phase), true, phase);
  assert.deepEqual(SCENARIOS['fresh-drop-success'], [
    'baseline', 'permission-blocked', 'helper-presented', 'drop-accepted',
    'retry-verified', 'reverse-complete',
  ]);
  assert.deepEqual(SCENARIOS['existing-row-success'], [
    'baseline', 'permission-blocked', 'helper-presented', 'existing-row',
    'retry-verified', 'reverse-complete',
  ]);
  assert.deepEqual(SCENARIOS['manual-retry-still-denied'], [
    'baseline', 'permission-blocked', 'helper-presented', 'retry-still-denied',
  ]);
});

test('non-read-only initialization requires the complete explicit artifact contract', () => {
  assert.throws(
    () => recorder.expectedContractFromArgs({}, 'fresh-drop-success'),
    /--expected-source-commit/,
  );
  assert.deepEqual(
    recorder.expectedContractFromArgs({}, recorder.READ_ONLY_SCENARIO),
    {
      sourceCommit: null,
      switcherExecutableSha256: null,
      cavalryExecutableSha256: null,
      cavalryRuntimeSha256: null,
      vendorTeamId: null,
      language: null,
    },
  );
  assert.deepEqual(
    recorder.expectedContractFromArgs(LIVE_ARGS, 'fresh-drop-success'),
    {
      sourceCommit: COMMIT,
      switcherExecutableSha256: SHA256,
      cavalryExecutableSha256: SHA256,
      cavalryRuntimeSha256: SHA256,
      vendorTeamId: 'TEAM123456',
      language: 'zh-Hans',
    },
  );
  assert.throws(
    () => recorder.expectedContractFromArgs({ ...LIVE_ARGS, 'expected-language': undefined }, 'fresh-drop-success'),
    /--expected-language/,
  );
  assert.throws(
    () => recorder.expectedContractFromArgs({
      ...LIVE_ARGS,
      'expected-switcher-executable-sha256': 'A'.repeat(64),
    }, 'fresh-drop-success'),
    /lowercase hexadecimal/,
  );
  assert.throws(
    () => recorder.expectedContractFromArgs({ ...LIVE_ARGS, 'expected-language': 'fr' }, 'fresh-drop-success'),
    /--expected-language/,
  );
});

test('state proof accepts only the target app, expected language and a non-empty operation id', () => {
  const valid = {
    appPath: '/Users/test-user/Applications/Cavalry.app',
    currentLang: 'zh-Hans',
    operationId: '19ab-2-1',
  };
  assert.deepEqual(
    recorder.validateStatePayload(valid, valid.appPath, 'zh-Hans'),
    valid,
  );
  assert.throws(
    () => recorder.validateStatePayload({ ...valid, appPath: '/Applications/Cavalry.app' }, valid.appPath, 'zh-Hans'),
    /appPath/,
  );
  assert.throws(
    () => recorder.validateStatePayload({ ...valid, currentLang: 'en' }, valid.appPath, 'zh-Hans'),
    /currentLang/,
  );
  assert.throws(
    () => recorder.validateStatePayload({ ...valid, operationId: '' }, valid.appPath, 'zh-Hans'),
    /operationId/,
  );
});

test('retry verification record is positive only when all post-retry fields target the manifest', () => {
  const manifest = retryManifest();
  const valid = {
    schema: 1,
    expectedLanguage: 'zh-Hans',
    marker: { language: 'zh-Hans' },
    codesign: { strict: true },
    state: {
      path: manifest.user.applicationSupportStatePath,
      ownerUid: manifest.user.uid,
      appPath: manifest.user.cavalryAppPath,
      currentLang: 'zh-Hans',
      operationId: '19ab-2-1',
    },
  };
  assert.equal(recorder.validateRetryVerification(valid, manifest), valid);
  for (const [key, mutate] of [
    ['language', (record) => { record.marker.language = 'en'; }],
    ['codesign', (record) => { record.codesign.strict = false; }],
    ['state path', (record) => { record.state.path = '/tmp/state.json'; }],
    ['operation id', (record) => { record.state.operationId = ''; }],
  ]) {
    const invalid = structuredClone(valid);
    mutate(invalid);
    assert.throws(() => recorder.validateRetryVerification(invalid, manifest), /post-retry proof/, key);
  }
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
  assert.equal(recorder.MANIFEST_SCHEMA, 3);
  assert.equal(recorder.CHECKPOINT_SCHEMA, 2);
  assert.equal(recorder.SEAL_SCHEMA, 3);
  assert.match(source, /resolveNewSession\(args\['session-dir'\], \[ROOT, switcher\.path, cavalry\.path\]\)/);
  assert.match(source, /rejectInside\(ROOT, session, 'Session directory'\)/);
  assert.match(source, /symbolic-ref.*HEAD/s);
  assert.match(source, /status', '--porcelain=v1', '--untracked-files=all'/);
  assert.match(source, /sourceTreeOwnerUid/);
  assert.match(source, /expected-source-commit/);
  assert.match(source, /expected-switcher-executable-sha256/);
  assert.match(source, /expected-cavalry-executable-sha256/);
  assert.match(source, /expected-cavalry-runtime-sha256/);
  assert.match(source, /expected-vendor-team-id/);
  assert.match(source, /expected-language/);
  assert.match(source, /Applications', 'Cavalry\.app'/);
  assert.match(source, /applicationSupportStatePath/);
  assert.match(source, /Contents', 'Resources', CAVALRY_LANGUAGE_MARKER/);
  assert.match(source, /strictCodesign\(manifest\.cavalry\.path/);
  assert.match(source, /permissionState: 'not-recorded'/);
  assert.match(source, /PERMISSION_BLOCKED_ASSERTION/);
  assert.doesNotMatch(source, /luo/i);
  assert.match(source, /Cavalry 2\.7\.2 required/);
  assert.match(source, /CAVALRY_RUNTIME_EXECUTABLE = 'Cavalry'/);
  assert.match(source, /verifyIdentity\(manifest\.cavalry\.runtimeExecutable, 'Cavalry runtime executable'\)/);
  assert.match(source, /verifyIdentity\(sealRecord\.manifest, 'Sealed manifest'\)/);
  assert.match(source, /capture identity drifted/);
  assert.match(source, /expects \$\{expectedPhase \|\| '<complete>'\}, got \$\{phase\}/);
  assert.match(source, /Sealed checkpoint order drifted/);
  assert.match(source, /Manifest scenario contract drifted/);
  assert.match(source, /name\.startsWith\('\.checkpoint-'\)/);
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

test('permission-blocked remains an observation-only checkpoint', () => {
  const source = read('tools/macos-handoff-acceptance/record_checkpoint.js');
  assert.match(source, /phase === 'permission-blocked'[\s\S]*PERMISSION_BLOCKED_ASSERTION/);
  assert.match(source, /Only the real Switcher UI was observed/);
  assert.doesNotMatch(source, /permissionGranted\s*:/);
  assert.doesNotMatch(source, /tccState\s*:/);
  assert.doesNotMatch(source, /authorized\s*:/);
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
  assert.match(read('tools/CLAUDE.md'), /clean detached exact source/);
  const scripts = JSON.parse(read('package.json')).scripts;
  assert.equal(scripts['test:handoff:macos:contracts'],
    'node --test tools/macos-handoff-acceptance/check_contract.test.js');
  assert.equal(scripts['record:handoff:macos'],
    'node tools/macos-handoff-acceptance/record_checkpoint.js');
});
