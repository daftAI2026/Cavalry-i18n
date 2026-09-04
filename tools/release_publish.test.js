#!/usr/bin/env node
/**
 * [INPUT]: release_publish.js、临时人工安装/updater dist/remote 资产与显式 test-only fake gh script
 * [OUTPUT]: 覆盖跨平台 fake、confirmed-404 private draft、上传中断恢复、公开前九项分发资产与四项 sidecar 回读、tag/commit/额外资产/鉴权错误 fail-closed
 * [POS]: 幂等 GitHub Release draft-to-public 边界的离线对抗测试；绝不解析 PATH 或触碰真实 gh
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { loadConfig, metadataForTag } = require('./release_metadata');

const repoRoot = path.resolve(__dirname, '..');
const tag = 'cavalry-2.7.2-p999';
const commit = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: repoRoot, encoding: 'utf8' }).stdout.trim();
const createdAtUtc = spawnSync('git', ['show', '-s', '--format=%cI', commit], { cwd: repoRoot, encoding: 'utf8' }).stdout.trim();
const title = 'Cavalry Language Switcher for Cavalry 2.7.2 (Patch 999)';
const metadata = metadataForTag(loadConfig(), tag);
const manualAssets = [
  metadata.RELEASE_ASSET_NAME_AARCH64,
  metadata.RELEASE_ASSET_NAME_X64,
  metadata.RELEASE_ASSET_NAME_WINDOWS_X64,
];
const distribution = [
  ...manualAssets,
  metadata.RELEASE_UPDATER_MANIFEST_NAME,
  metadata.RELEASE_UPDATER_ASSET_NAME_AARCH64,
  metadata.RELEASE_UPDATER_SIGNATURE_NAME_AARCH64,
  metadata.RELEASE_UPDATER_ASSET_NAME_X64,
  metadata.RELEASE_UPDATER_SIGNATURE_NAME_X64,
  metadata.RELEASE_UPDATER_SIGNATURE_NAME_WINDOWS_X64,
];

function fixture() {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cavalry-release-publish-')));
  const dist = path.join(root, 'dist');
  const remote = path.join(root, 'remote');
  fs.mkdirSync(dist);
  fs.mkdirSync(remote);
  manualAssets.forEach((name, index) => fs.writeFileSync(path.join(dist, name), `manual-${index}\n`));
  fs.writeFileSync(path.join(dist, metadata.RELEASE_UPDATER_ASSET_NAME_AARCH64), 'updater-arm\n');
  fs.writeFileSync(path.join(dist, metadata.RELEASE_UPDATER_ASSET_NAME_X64), 'updater-intel\n');
  for (const [name, value] of [
    [metadata.RELEASE_UPDATER_SIGNATURE_NAME_AARCH64, 'signature-arm'],
    [metadata.RELEASE_UPDATER_SIGNATURE_NAME_X64, 'signature-intel'],
    [metadata.RELEASE_UPDATER_SIGNATURE_NAME_WINDOWS_X64, 'signature-windows'],
  ]) {
    fs.writeFileSync(path.join(dist, name), `${Buffer.from(value).toString('base64')}\n`);
  }
  const updaterNotes = path.join(root, 'updater-notes.md');
  fs.writeFileSync(updaterNotes, 'Updater release fixture\n');
  const manifestResult = spawnSync(process.execPath, [
    path.join(repoRoot, 'tools/create_updater_manifest.js'),
    '--tag', tag,
    '--output', path.join(dist, metadata.RELEASE_UPDATER_MANIFEST_NAME),
    '--notes', updaterNotes,
    '--pub-date', createdAtUtc,
    '--darwin-aarch64', path.join(dist, metadata.RELEASE_UPDATER_ASSET_NAME_AARCH64),
    '--darwin-aarch64-signature', path.join(dist, metadata.RELEASE_UPDATER_SIGNATURE_NAME_AARCH64),
    '--darwin-x86_64', path.join(dist, metadata.RELEASE_UPDATER_ASSET_NAME_X64),
    '--darwin-x86_64-signature', path.join(dist, metadata.RELEASE_UPDATER_SIGNATURE_NAME_X64),
    '--windows-x86_64', path.join(dist, metadata.RELEASE_ASSET_NAME_WINDOWS_X64),
    '--windows-x86_64-signature', path.join(dist, metadata.RELEASE_UPDATER_SIGNATURE_NAME_WINDOWS_X64),
  ], { cwd: repoRoot, encoding: 'utf8' });
  assert.equal(manifestResult.status, 0, manifestResult.stderr || manifestResult.stdout);
  fs.writeFileSync(path.join(dist, 'toolchain-evidence.json'), `${JSON.stringify({
    schemaVersion: 1,
    kind: 'ReleaseToolchainEvidence',
    releaseCommitSha: commit,
    createdAtUtc,
    records: [],
    uncoveredArtifacts: [],
  })}\n`);
  fs.writeFileSync(path.join(dist, 'CycloneDX.json'), `${JSON.stringify({
    bomFormat: 'CycloneDX',
    specVersion: '1.5',
    metadata: { component: { properties: [{ name: 'cavalry-i18n:release-commit', value: commit }] } },
    components: [{ name: 'fixture', version: '1.0.0', purl: 'pkg:npm/fixture@1.0.0' }],
  })}\n`);
  const notes = path.join(root, 'notes.md');
  fs.writeFileSync(notes, 'release notes\n');
  const log = path.join(root, 'gh.log');
  const remoteState = path.join(root, 'release-state.json');
  const fakeGh = path.join(root, 'fake-gh.js');
  fs.writeFileSync(fakeGh, `
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const args = process.argv.slice(2);
fs.appendFileSync(process.env.FAKE_GH_LOG, JSON.stringify(args) + '\\n');
const mode = process.env.FAKE_GH_MODE;
const statePath = process.env.FAKE_GH_STATE;
const readState = () => fs.existsSync(statePath) ? JSON.parse(fs.readFileSync(statePath, 'utf8')) : null;
const writeState = (value) => fs.writeFileSync(statePath, JSON.stringify(value));
if (args[0] === 'release' && args[1] === 'view') {
  if (mode === 'unauthorized') { process.stderr.write('HTTP 401 Unauthorized'); process.exit(1); }
  const state = readState();
  if (state) {
    const names = fs.readdirSync(process.env.FAKE_GH_REMOTE).sort();
    if (mode === 'extra') names.push('unexpected.bin');
    process.stdout.write(JSON.stringify({
      assets: names.map((name) => ({name})), isDraft: state.isDraft, isPrerelease: false,
      name: process.env.FAKE_GH_TITLE, tagName: process.env.FAKE_GH_TAG,
      targetCommitish: 'main', body: fs.readFileSync(process.env.FAKE_GH_NOTES, 'utf8'),
    }));
    process.exit(0);
  }
  process.stderr.write('release not found');
  process.exit(1);
}
if (args[0] === 'api') {
  process.stderr.write(mode === 'unauthorized' ? 'HTTP/2.0 401 Unauthorized' : 'HTTP/2.0 404 Not Found');
  process.exit(1);
}
if (args[0] === 'release' && args[1] === 'download') {
  const name = args[args.indexOf('--pattern') + 1];
  const dir = args[args.indexOf('--dir') + 1];
  fs.copyFileSync(path.join(process.env.FAKE_GH_REMOTE, name), path.join(dir, name));
  process.exit(0);
}
if (args[0] === 'release' && args[1] === 'create') {
  if (!args.includes('--draft') || readState()) process.exit(3);
  writeState({isDraft: true});
  process.exit(0);
}
if (args[0] === 'release' && args[1] === 'upload') {
  if (mode === 'upload-fails') { process.stderr.write('simulated upload interruption'); process.exit(4); }
  for (const file of args.slice(3)) fs.copyFileSync(file, path.join(process.env.FAKE_GH_REMOTE, path.basename(file)));
  process.exit(0);
}
if (args[0] === 'release' && args[1] === 'edit') {
  const state = readState();
  if (!state || !args.includes('--draft=false')) process.exit(5);
  writeState({isDraft:false});
  process.exit(0);
}
process.stderr.write('unexpected fake gh invocation: ' + args.join(' '));
process.exit(2);
`);
  return { root, dist, remote, notes, log, remoteState, fakeGh };
}

function run(f, mode, releaseCommit = commit) {
  return spawnSync(process.execPath, [
    path.join(repoRoot, 'tools/release_publish.js'), '--tag', tag,
    '--release-commit', releaseCommit, '--dist', f.dist, '--notes', f.notes, '--title', title,
  ], {
    cwd: repoRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      NODE_ENV: 'test',
      CAVALRY_I18N_TEST_GH_SCRIPT: f.fakeGh,
      CAVALRY_I18N_TEST_TAG_COMMIT_SHA: commit,
      RELEASE_ASSET_NAME_AARCH64: manualAssets[0],
      RELEASE_ASSET_NAME_X64: manualAssets[1],
      RELEASE_ASSET_NAME_WINDOWS_X64: manualAssets[2],
      RELEASE_UPDATER_MANIFEST_NAME: metadata.RELEASE_UPDATER_MANIFEST_NAME,
      RELEASE_UPDATER_ASSET_NAME_AARCH64: metadata.RELEASE_UPDATER_ASSET_NAME_AARCH64,
      RELEASE_UPDATER_SIGNATURE_NAME_AARCH64: metadata.RELEASE_UPDATER_SIGNATURE_NAME_AARCH64,
      RELEASE_UPDATER_ASSET_NAME_X64: metadata.RELEASE_UPDATER_ASSET_NAME_X64,
      RELEASE_UPDATER_SIGNATURE_NAME_X64: metadata.RELEASE_UPDATER_SIGNATURE_NAME_X64,
      RELEASE_UPDATER_SIGNATURE_NAME_WINDOWS_X64: metadata.RELEASE_UPDATER_SIGNATURE_NAME_WINDOWS_X64,
      FAKE_GH_MODE: mode,
      FAKE_GH_REMOTE: f.remote,
      FAKE_GH_STATE: f.remoteState,
      FAKE_GH_LOG: f.log,
      FAKE_GH_TITLE: title,
      FAKE_GH_TAG: tag,
      FAKE_GH_NOTES: f.notes,
    },
  });
}

function verifyProvenance(f) {
  return spawnSync(process.execPath, [
    path.join(repoRoot, 'tools/verify_release_provenance.js'), '--dist', f.dist,
    ...distribution.flatMap((name) => ['--primary', name]),
  ], { cwd: repoRoot, encoding: 'utf8' });
}

test('confirmed 404 uses a private draft, publishes only after exact readback, and reruns idempotently', () => {
  const f = fixture();
  try {
    const created = run(f, 'missing');
    assert.equal(created.status, 0, created.stderr || created.stdout);
    assert.equal(JSON.parse(fs.readFileSync(f.remoteState, 'utf8')).isDraft, false);
    const calls = fs.readFileSync(f.log, 'utf8');
    assert.match(calls, /"create"[^\n]*"--draft"[^\n]*"--verify-tag"/);
    assert.match(calls, /"download"/);
    assert.match(calls, /"edit"[^\n]*"--draft=false"/);

    const provenancePath = path.join(f.dist, 'release-asset-provenance.json');
    const originalProvenance = fs.readFileSync(provenancePath);
    const provenance = JSON.parse(originalProvenance.toString('utf8'));
    provenance.releaseCommitSha = 'b'.repeat(40);
    fs.writeFileSync(provenancePath, `${JSON.stringify(provenance)}\n`);
    const mismatchedCommit = verifyProvenance(f);
    assert.notEqual(mismatchedCommit.status, 0);
    assert.match(mismatchedCommit.stderr, /SBOM does not semantically bind the release commit/);
    fs.writeFileSync(provenancePath, originalProvenance);

    const repeated = run(f, 'existing');
    assert.equal(repeated.status, 0, repeated.stderr || repeated.stdout);
    const primaryPath = path.join(f.dist, manualAssets[0]);
    const primaryBytes = fs.readFileSync(primaryPath);
    fs.writeFileSync(primaryPath, 'post-seal tamper\n');
    const primaryTamper = run(f, 'existing');
    assert.notEqual(primaryTamper.status, 0);
    assert.match(primaryTamper.stderr, /conflicts with local bytes/);
    fs.writeFileSync(primaryPath, primaryBytes);
    fs.writeFileSync(path.join(f.remote, 'release-asset-provenance.json'), 'tampered\n');
    const tampered = run(f, 'existing');
    assert.notEqual(tampered.status, 0);
    assert.match(tampered.stderr, /conflicts with local bytes/);
  } finally { fs.rmSync(f.root, { recursive: true, force: true }); }
});

test('upload interruption stays private and the next run safely completes the draft', () => {
  const f = fixture();
  try {
    const interrupted = run(f, 'upload-fails');
    assert.notEqual(interrupted.status, 0);
    assert.match(interrupted.stderr, /simulated upload interruption/);
    assert.equal(JSON.parse(fs.readFileSync(f.remoteState, 'utf8')).isDraft, true);
    assert.doesNotMatch(fs.readFileSync(f.log, 'utf8'), /"edit"/);
    const recovered = run(f, 'existing');
    assert.equal(recovered.status, 0, recovered.stderr || recovered.stdout);
    assert.equal(JSON.parse(fs.readFileSync(f.remoteState, 'utf8')).isDraft, false);
  } finally { fs.rmSync(f.root, { recursive: true, force: true }); }
});

test('remote auth failure, unexpected assets, public missing assets, and tag mismatch fail closed', () => {
  const unauthorized = fixture();
  try {
    const result = run(unauthorized, 'unauthorized');
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /refusing to treat the error as absence/);
    assert.doesNotMatch(fs.readFileSync(unauthorized.log, 'utf8'), /"create"/);
  } finally { fs.rmSync(unauthorized.root, { recursive: true, force: true }); }

  const extra = fixture();
  try {
    assert.equal(run(extra, 'missing').status, 0);
    const result = run(extra, 'extra');
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /unexpected assets/);
  } finally { fs.rmSync(extra.root, { recursive: true, force: true }); }

  const incomplete = fixture();
  try {
    assert.equal(run(incomplete, 'missing').status, 0);
    fs.unlinkSync(path.join(incomplete.remote, 'CycloneDX.json'));
    const result = run(incomplete, 'existing');
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /public release is incomplete/);
    assert.doesNotMatch(result.stdout, /upload/);
  } finally { fs.rmSync(incomplete.root, { recursive: true, force: true }); }

  const mismatch = fixture();
  try {
    const result = run(mismatch, 'missing', 'b'.repeat(40));
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Tag .* resolves to/);
    assert.equal(fs.existsSync(mismatch.log), false);
  } finally { fs.rmSync(mismatch.root, { recursive: true, force: true }); }
});
