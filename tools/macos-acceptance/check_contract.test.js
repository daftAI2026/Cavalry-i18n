/**
 * [INPUT]: 依赖 macos-acceptance 的 tracked 源码闭包、host 身份原语、冻结媒体 fixture、构建脚本与 Node harness
 * [OUTPUT]: 对外提供跨平台可运行的静态合同，阻断缺失/篡改 host 身份、临时 Cache 依赖、源码树内构建物、弱窗口绑定与 live 命令假通过
 * [POS]: macos-acceptance 的 CI 边界；只验证可复现输入和 fail-closed 协议，不启动 Cavalry、不冒充真机 PASS
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');
const {
  MATRIX_SCHEMA, assertSameHostIdentity, collectMacHostIdentity, validateHostIdentity,
} = require('./host_identity');

const ROOT = __dirname;
const REPO = path.resolve(ROOT, '..', '..');
const PROTOCOL = '[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md';
const TEXT_SOURCES = Object.freeze([
  'acceptance_harness.js',
  'artifact_identity.js',
  'build_acceptance_v2.sh',
  'check_contract.test.js',
  'host_identity.js',
  'path_safety.js',
  'source_contract.js',
  'drivers/macos_main_acceptance_driver.mm',
  'drivers/macos_main_common.inc',
  'drivers/macos_main_entry.inc',
  'drivers/macos_main_save.inc',
  'drivers/macos_main_save_replace.inc',
  'drivers/macos_main_search_tag.inc',
  'drivers/macos_main_tracking.inc',
  'drivers/macos_supplemental_acceptance_driver.mm',
  'drivers/macos_supplemental_capture.inc',
  'drivers/macos_supplemental_onboarding_trigger.inc',
  'helpers/cgwindow_exact.swift',
]);
const FIXTURES = Object.freeze([
  'fixtures/replace-source.png',
  'fixtures/replace-source.mp4',
  'fixtures/dynamic-proof-two.png',
]);

function read(relative) {
  return fs.readFileSync(path.join(ROOT, relative), 'utf8');
}

function pngDimensions(relative) {
  const data = fs.readFileSync(path.join(ROOT, relative));
  assert.equal(data.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  assert.equal(data.subarray(12, 16).toString('ascii'), 'IHDR');
  return { width: data.readUInt32BE(16), height: data.readUInt32BE(20) };
}
function walkFiles(folder) {
  return fs.readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(folder, entry.name);
    return entry.isDirectory() ? walkFiles(file) : [file];
  });
}

test('tracked macOS acceptance source closure is complete and GEB-aligned', () => {
  for (const relative of [...TEXT_SOURCES, ...FIXTURES, 'CLAUDE.md', 'drivers/CLAUDE.md']) {
    const stat = fs.lstatSync(path.join(ROOT, relative));
    assert.ok(stat.isFile(), `${relative} must be a regular file`);
    assert.equal(stat.isSymbolicLink(), false, `${relative} must not be a symlink`);
  }
  for (const relative of TEXT_SOURCES) {
    const source = read(relative);
    assert.match(source, new RegExp(PROTOCOL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.ok(source.split('\n').length - 1 <= 800, `${relative} exceeds 800 lines`);
  }
  assert.match(read('CLAUDE.md'), new RegExp(PROTOCOL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(read('drivers/CLAUDE.md'), new RegExp(PROTOCOL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});

test('harness freezes the real source closure and exact-window evidence protocol', () => {
  const harness = read('acceptance_harness.js');
  const sourceContract = read('source_contract.js');
  for (const literal of [
    "'zh-Hans', 'zh-Hant', 'ja_JP'",
    "'search', 'add-tag', 'save', 'replace', 'tracking', 'onboarding', 'transform'",
    'MATRIX_SCHEMA',
    'MACHINE-COMPLETE-MANUAL-PENDING',
    'PASS-48-OF-48',
    'nativeWindowNumber',
    "['-x', '-l', String(windowID), outputPath]",
    "flag: 'wx'",
    "'expected-executable-sha256'",
    "target.cavalryVersion !== '2.7.2' || target.qtVersion !== '6.6.3'",
    'fs.realpathSync(expectedRoot) !== fs.realpathSync(ROOT)',
  ]) {
    assert.ok(harness.includes(literal), `missing harness contract: ${literal}`);
  }
  assert.ok(
    sourceContract.includes("'fixtures/replace-source.png', 'fixtures/replace-source.mp4', 'fixtures/dynamic-proof-two.png'"),
    'shared source contract must freeze all three real media fixtures'
  );
  assert.match(harness, /points\.length !== 48 \|\| new Set\(keys\)\.size !== 48/);
  assert.match(harness, /seen\.size !== 48/);
  assert.doesNotMatch(harness, /cgwindow_all|dynamic-proof-two\.mp4/);
  assert.match(harness, /host, repository, target/);
  assert.match(harness, /assertSameHostIdentity\(validateHostIdentity\(machine\.host\), collectMacHostIdentity\(\)\)/);
});

test('onboarding polling stays inside the Qt event loop', () => {
  const driver = read('drivers/macos_supplemental_acceptance_driver.mm');
  const start = driver.indexOf('void processOnboarding()');
  const end = driver.indexOf('\nQJsonObject diagnosticsJson', start);
  assert.ok(start >= 0 && end > start, 'onboarding state machine must remain inspectable');
  const stateMachine = driver.slice(start, end);
  assert.ok(
    (stateMachine.match(/QTimer::singleShot\(\s*100,\s*qApp/g) || []).length >= 3,
    'all onboarding polls and transitions must use Qt timers',
  );
  assert.doesNotMatch(stateMachine, /dispatch_after|dispatch_get_main_queue/);
});

test('live matrix host identity is collected from fixed sw_vers and fails closed on omission or tampering', () => {
  const calls = [];
  const spawn = (file, args) => {
    calls.push([file, ...args]);
    const values = { '-productVersion': '15.6.1\n', '-buildVersion': '24G90\n' };
    return { status: 0, stdout: values[args[0]], stderr: '' };
  };
  const host = collectMacHostIdentity({ platform: 'darwin', spawnSync: spawn });
  assert.equal(MATRIX_SCHEMA, 'cavalry-i18n.acceptance-v2.matrix/v6');
  assert.deepEqual(host, { productVersion: '15.6.1', buildVersion: '24G90' });
  assert.deepEqual(calls, [
    ['/usr/bin/sw_vers', '-productVersion'],
    ['/usr/bin/sw_vers', '-buildVersion'],
  ]);
  assert.throws(() => validateHostIdentity({ buildVersion: '24G90' }), /keys mismatch/);
  assert.throws(
    () => validateHostIdentity({ productVersion: '15.6.1', buildVersion: 'tampered' }),
    /buildVersion is invalid/,
  );
  assert.throws(
    () => assertSameHostIdentity(host, { ...host, buildVersion: '24G91' }),
    /does not match the current live macOS host/,
  );
  assert.throws(
    () => collectMacHostIdentity({ platform: 'linux', spawnSync: spawn }),
    /requires darwin/,
  );
});

test('source contains no machine-local acceptance dependency or generated binary', () => {
  const combined = TEXT_SOURCES.map(read).join('\n');
  assert.doesNotMatch(combined, /\/Users\/[^/\s]+/);
  assert.doesNotMatch(combined, /Library\/Caches\/Cavalry-i18n\/acceptance-v2-src/);
  assert.doesNotMatch(combined, /tools\/macos-acceptance\/bin/);
  const generated = walkFiles(ROOT)
    .map((file) => path.relative(ROOT, file))
    .filter((name) => /\.(?:dylib|dll|exe|o)$/.test(name) || /(?:^|\/)cgwindow_exact$/.test(name));
  assert.deepEqual(generated, []);
});

test('build requires an empty repository-external output and refuses the real Applications bundle', () => {
  const build = read('build_acceptance_v2.sh');
  assert.match(build, /out=""/);
  assert.match(build, /--compile-only/);
  assert.match(build, /--out <external-dir>/);
  assert.match(build, /compile-only does not accept a Cavalry clone/);
  assert.match(build, /output must stay outside the repository and acceptance source/);
  assert.match(build, /git -C "\$root" rev-parse --show-toplevel/);
  assert.match(build, /output must stay outside the source worktree/);
  assert.match(build, /output must be a new or empty non-symlink directory/);
  assert.match(build, /clone must stay outside \/Applications/);
  assert.match(build, /acceptance target must remain Qt 6\.6\.3/);
  assert.match(build, /Qt SDK mismatch/);
  assert.match(build, /Clone Qt mismatch/);
  assert.doesNotMatch(build, /out="\$root\/bin"/);
});

test('live mutations stay inside the disposable clone/session and cleanup keeps PID ownership', () => {
  const harness = read('acceptance_harness.js');
  const artifacts = read('artifact_identity.js');
  const safety = read('path_safety.js');
  assert.match(harness, /strictRealChild\(cloneRoot, destination, 'Guide destination'\)/);
  assert.match(harness, /resolveNewSession\(requirePath\('session-dir'\), \[repo, clone\.appPath\]\)/);
  assert.match(
    safety,
    /for \(const root of forbiddenRoots\)[\s\S]*rejectInside\(fs\.realpathSync\(root\), session, 'Session directory'\)/,
  );
  assert.match(harness, /fs\.mkdirSync\(session, \{ recursive: false, mode: 0o700 \}\)/);
  assert.match(artifacts, /regular\(file\);\s*fs\.chmodSync\(file, 0o444\)/);
  assert.match(harness, /sameProcess\(processIdentity\(child\.pid, executable\), initial\)/);
  assert.doesNotMatch(harness, /catch \(error\) \{\s*try \{ process\.kill\(child\.pid, 'SIGKILL'\)/);
});

test('each language stage binds the launched executable and loaded Qt runtime through seal', () => {
  const harness = read('acceptance_harness.js');
  assert.match(harness, /sameArtifact\(initial\.executable, stageRecord\.executable\)/);
  assert.match(harness, /sameArtifact\(runtimeQtLoaded, stageRecord\.runtimeQtCore\)/);
  assert.match(harness, /sameArtifact\(manifest\.initial\?\.executable, stage\.executable\)/);
  assert.match(harness, /verifyIdentity\(machine\.qt\.sdk\.core, 'Qt SDK core'\)/);
  assert.match(harness, /verifyIdentity\(machine\.qt\.finalRuntimeCore, 'Final Qt runtime core'\)/);
  assert.match(harness, /verifyIdentity\(machine\.clone\.finalExecutable, 'Final clone executable'\)/);
});

test('review symlinks fail before an external target can be chmodded', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'cavalry-review-boundary-'));
  try {
    const session = path.join(temp, 'session');
    const external = path.join(temp, 'external.json');
    const review = path.join(session, 'review.json');
    fs.mkdirSync(session, { mode: 0o700 });
    fs.writeFileSync(external, '{}\n', { mode: 0o600 });
    fs.symlinkSync(external, review);
    const before = fs.statSync(external).mode & 0o777;
    const result = spawnSync(process.execPath, [
      path.join(ROOT, 'acceptance_harness.js'),
      '--seal-review', '--session-dir', session, '--review', review,
    ], { encoding: 'utf8' });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Regular non-symlink file required/);
    assert.equal(fs.statSync(external).mode & 0o777, before);
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});

test('package scripts expose contracts, explicit build, live matrix, and review seal', () => {
  const scripts = JSON.parse(fs.readFileSync(path.join(REPO, 'package.json'), 'utf8')).scripts;
  assert.equal(
    scripts['build:acceptance:macos'],
    'zsh tools/macos-acceptance/build_acceptance_v2.sh',
  );
  assert.equal(
    scripts['test:acceptance:macos:compile'],
    'zsh tools/macos-acceptance/build_acceptance_v2.sh --compile-only',
  );
  assert.equal(
    scripts['test:acceptance:macos:contracts'],
    'node --test tools/macos-acceptance/check_contract.test.js',
  );
  assert.equal(
    scripts['test:acceptance:macos:live'],
    'node tools/macos-acceptance/acceptance_harness.js --matrix',
  );
  assert.equal(
    scripts['seal:acceptance:macos'],
    'node tools/macos-acceptance/acceptance_harness.js --seal-review',
  );
  assert.match(scripts['test:contracts'], /tools\/macos-acceptance\/check_contract\.test\.js/);
  assert.match(scripts['check:app'], /tools\/macos-acceptance\/acceptance_harness\.js/);
  assert.match(scripts['check:app'], /tools\/macos-acceptance\/path_safety\.js/);
  assert.match(scripts['check:app'], /tools\/macos-acceptance\/artifact_identity\.js/);
});

test('PR macOS CI compiles the producer without a vendor app and does not claim live PASS', () => {
  const workflow = fs.readFileSync(path.join(REPO, '.github', 'workflows', 'build.yml'), 'utf8');
  assert.match(
    workflow,
    /Compile tracked macOS acceptance producer without a vendor app[\s\S]*test ! -e \/Applications\/Cavalry\.app/,
  );
  assert.match(
    workflow,
    /npm run test:acceptance:macos:compile --[\s\S]*--qt-prefix "\$CAVALRY_QT_PREFIX"[\s\S]*--out "\$out"/,
  );
  assert.match(workflow, /codesign --verify --strict "\$dylib"/);
  assert.doesNotMatch(
    workflow.match(/Compile tracked macOS acceptance producer without a vendor app[\s\S]*?(?=\n  \w|\Z)/)?.[0] || '',
    /test:acceptance:macos:live|PASS-48-OF-48|Cavalry\.app.*open/,
  );
});

test('fixture media are real, distinct, minimal inputs', () => {
  assert.deepEqual(pngDimensions('fixtures/replace-source.png'), { width: 64, height: 48 });
  assert.deepEqual(pngDimensions('fixtures/dynamic-proof-two.png'), { width: 64, height: 48 });
  assert.notDeepEqual(
    fs.readFileSync(path.join(ROOT, 'fixtures/replace-source.png')),
    fs.readFileSync(path.join(ROOT, 'fixtures/dynamic-proof-two.png')),
  );
  const mp4 = fs.readFileSync(path.join(ROOT, 'fixtures/replace-source.mp4'));
  assert.ok(mp4.length > 512, 'tracking MP4 must not be a textual placeholder');
  assert.equal(mp4.subarray(4, 8).toString('ascii'), 'ftyp');
  assert.ok(mp4.includes(Buffer.from('moov')));
  assert.ok(mp4.includes(Buffer.from('mdat')));
});

test('live and review modes fail closed before platform side effects when required inputs are absent', () => {
  const harness = path.join(ROOT, 'acceptance_harness.js');
  const matrix = spawnSync(process.execPath, [harness, '--matrix'], { encoding: 'utf8' });
  assert.notEqual(matrix.status, 0);
  assert.match(matrix.stderr, /--repo is required/);

  const review = spawnSync(process.execPath, [harness, '--seal-review'], { encoding: 'utf8' });
  assert.notEqual(review.status, 0);
  assert.match(review.stderr, /--session-dir is required/);
});
