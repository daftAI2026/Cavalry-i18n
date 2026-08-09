#!/usr/bin/env node
/**
 * [INPUT]: release_publish.js、临时 dist/remote 资产与显式 test-only fake gh script
 * [OUTPUT]: 覆盖跨平台 fake、confirmed-404 private draft、上传中断恢复、公开前全资产回读、tag/commit/sidecar/额外资产/鉴权错误 fail-closed
 * [POS]: 幂等 GitHub Release draft-to-public 边界的离线对抗测试；绝不解析 PATH 或触碰真实 gh
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { signSeal } = require('./release_seal_signature');

const repoRoot = path.resolve(__dirname, '..');
const tag = 'cavalry-2.7.2-p999';
const commit = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: repoRoot, encoding: 'utf8' }).stdout.trim();
const createdAtUtc = spawnSync('git', ['show', '-s', '--format=%cI', commit], { cwd: repoRoot, encoding: 'utf8' }).stdout.trim();
const title = 'Cavalry Language Switcher for Cavalry 2.7.2 (Patch 999)';
const primary = ['mac-arm.dmg', 'mac-intel.dmg', 'windows.exe'];

function fixture() {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cavalry-release-publish-')));
  const dist = path.join(root, 'dist');
  const remote = path.join(root, 'remote');
  fs.mkdirSync(dist);
  fs.mkdirSync(remote);
  primary.forEach((name, index) => fs.writeFileSync(path.join(dist, name), `primary-${index}\n`));
  fs.writeFileSync(path.join(dist, `${tag}.evidence.json`), '{"evidence":true}\n');
  fs.writeFileSync(path.join(dist, `${tag}.acceptance-attestation.json`), '{"attestation":true}\n');
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
  const identity = (name) => {
    const file = path.join(dist, name);
    const bytes = fs.statSync(file).size;
    return { name, bytes, sha256: crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex') };
  };
  const unsignedSeal = {
    tag,
    releaseCommitSha: commit,
    sourceCommitSha: 'a'.repeat(40),
    acceptanceAttestation: identity(`${tag}.acceptance-attestation.json`),
    acceptanceEvidence: identity(`${tag}.evidence.json`),
    assets: {
      aarch64: identity(primary[0]),
      x64: identity(primary[1]),
      windowsX64: identity(primary[2]),
    },
    supplyChain: {
      sbom: identity('CycloneDX.json'),
      toolchainEvidence: identity('toolchain-evidence.json'),
    },
  };
  const keyPair = crypto.generateKeyPairSync('ed25519');
  const privateKey = keyPair.privateKey.export({ type: 'pkcs8', format: 'pem' });
  const publicDer = keyPair.publicKey.export({ type: 'spki', format: 'der' });
  const trust = crypto.createHash('sha256').update(publicDer).digest('hex');
  unsignedSeal.signature = signSeal(unsignedSeal, privateKey, trust);
  fs.writeFileSync(path.join(dist, 'ReleaseAcceptanceSeal.json'), `${JSON.stringify(unsignedSeal)}\n`);
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
  return { root, dist, remote, notes, log, remoteState, fakeGh, trust };
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
      RELEASE_SEAL_PUBLIC_KEY_SHA256: f.trust,
      RELEASE_ASSET_NAME_AARCH64: primary[0],
      RELEASE_ASSET_NAME_X64: primary[1],
      RELEASE_ASSET_NAME_WINDOWS_X64: primary[2],
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
    ...primary.flatMap((name) => ['--primary', name]),
  ], { cwd: repoRoot, encoding: 'utf8', env: { ...process.env, RELEASE_SEAL_PUBLIC_KEY_SHA256: f.trust } });
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
    assert.match(mismatchedCommit.stderr, /tag\/source\/release identity/);
    fs.writeFileSync(provenancePath, originalProvenance);

    const repeated = run(f, 'existing');
    assert.equal(repeated.status, 0, repeated.stderr || repeated.stdout);
    const primaryPath = path.join(f.dist, primary[0]);
    const primaryBytes = fs.readFileSync(primaryPath);
    fs.writeFileSync(primaryPath, 'post-seal tamper\n');
    const primaryTamper = run(f, 'existing');
    assert.notEqual(primaryTamper.status, 0);
    assert.match(primaryTamper.stderr, /signed seal assets/);
    fs.writeFileSync(primaryPath, primaryBytes);
    fs.writeFileSync(path.join(f.remote, 'ReleaseAcceptanceSeal.json'), 'tampered\n');
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
