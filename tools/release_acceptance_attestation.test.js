#!/usr/bin/env node
/**
 * [INPUT]: acceptance attestation prepare/assemble/verifier、detached Ed25519 fixtures 与双 fingerprint gate。
 * [OUTPUT]: 证明候选代码不接触私钥、payload bytes/evidence 精确绑定、签名可验证且 release/acceptance keys 必须独立。
 * [POS]: independent acceptance signer 与 dual trust-anchor 的离线回归合同。
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
const { sha256 } = require('./release_seal_signature');

const projectRoot = path.resolve(__dirname, '..');
const tag = 'cavalry-2.7.2-p999';
const source = 'a'.repeat(40);
function run(script, args, cwd, env = {}) {
  return spawnSync(process.execPath, [path.join(projectRoot, 'tools', script), ...args], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, ...env },
  });
}
function fixture() {
  const outer = fs.mkdtempSync(path.join(os.tmpdir(), 'cavalry-attestation-'));
  const repo = path.join(outer, 'repo');
  const seals = path.join(repo, 'release-seals');
  fs.mkdirSync(seals, { recursive: true });
  const evidence = {
    schemaVersion: 3,
    kind: 'ReleaseAcceptanceEvidence',
    tag,
    sourceCommitSha: source,
    targetCavalryVersion: '2.7.2',
    qtVersion: '6.6.3',
    languages: ['zh-Hans', 'zh-Hant', 'ja_JP'],
    macosAcceptance: {
      result: 'PASS-48-OF-48', matrix: '21-run/48-point', producer: 'tools/macos-acceptance',
      sessionId: 'S1',
      finalRecord: { bytes: 1, sha256: '1'.repeat(64) },
      machineRecord: { bytes: 1, sha256: '2'.repeat(64) },
      manualReview: { bytes: 1, sha256: '3'.repeat(64) },
      sessionManifestSha256: '4'.repeat(64),
      host: { productVersion: '15.6', buildVersion: '24G84' },
    },
    createdAtUtc: '2026-08-09T00:00:00Z',
    createdBy: 'test',
  };
  const evidencePath = path.join(seals, `${tag}.evidence.json`);
  fs.writeFileSync(evidencePath, `${JSON.stringify(evidence)}\n`);
  const keyPair = crypto.generateKeyPairSync('ed25519');
  const publicDer = keyPair.publicKey.export({ type: 'spki', format: 'der' });
  return { outer, repo, evidencePath, keyPair, publicDer, trust: sha256(publicDer) };
}

test('candidate prepares canonical bytes; external detached signer assembles a verified attestation', () => {
  const item = fixture();
  try {
    const payload = path.join(item.outer, 'payload.json');
    let result = run('create_release_acceptance_attestation.js', [
      '--tag', tag, '--evidence', item.evidencePath,
      '--prepare', payload,
      '--created-at', '2026-08-09T01:00:00Z', '--created-by', 'offline-reviewer',
    ], item.repo);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const payloadBytes = fs.readFileSync(payload);
    const signaturePath = path.join(item.outer, 'signature.bin');
    const publicPath = path.join(item.outer, 'public.der');
    fs.writeFileSync(signaturePath, crypto.sign(null, payloadBytes, item.keyPair.privateKey));
    fs.writeFileSync(publicPath, item.publicDer);
    result = run('create_release_acceptance_attestation.js', [
      '--tag', tag, '--evidence', item.evidencePath, '--assemble',
      '--payload', payload, '--signature', signaturePath,
      '--public-key-spki-der', publicPath,
      '--trusted-public-key-sha256', item.trust,
    ], item.repo);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const attestation = path.join(item.repo, 'release-seals', `${tag}.acceptance-attestation.json`);
    result = run('verify_release_acceptance_attestation.js', [
      '--tag', tag, '--evidence', item.evidencePath, '--attestation', attestation,
      '--trusted-public-key-sha256', item.trust,
    ], item.repo);
    assert.equal(result.status, 0, result.stderr || result.stdout);

    fs.chmodSync(payload, 0o644);
    fs.writeFileSync(payload, Buffer.concat([payloadBytes, Buffer.from('\n')]));
    fs.rmSync(attestation);
    result = run('create_release_acceptance_attestation.js', [
      '--tag', tag, '--evidence', item.evidencePath, '--assemble',
      '--payload', payload, '--signature', signaturePath,
      '--public-key-spki-der', publicPath,
      '--trusted-public-key-sha256', item.trust,
    ], item.repo);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /not the exact canonical signing payload/);
  } finally { fs.rmSync(item.outer, { recursive: true, force: true }); }
});

test('candidate attestation process refuses any private-key environment exposure', () => {
  const item = fixture();
  try {
    const result = run('create_release_acceptance_attestation.js', [
      '--tag', tag, '--evidence', item.evidencePath,
      '--prepare', path.join(item.outer, 'payload.json'),
    ], item.repo, { RELEASE_ACCEPTANCE_ATTESTATION_PRIVATE_KEY: 'must-never-enter-candidate' });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Do not expose RELEASE_ACCEPTANCE_ATTESTATION_PRIVATE_KEY/);
    const sourceText = fs.readFileSync(
      path.join(projectRoot, 'tools/create_release_acceptance_attestation.js'), 'utf8'
    );
    assert.doesNotMatch(sourceText, /crypto\.createPrivateKey|signSeal\(/);
  } finally { fs.rmSync(item.outer, { recursive: true, force: true }); }
});

test('release seal and acceptance attestation trust anchors must be distinct', () => {
  const cwd = projectRoot;
  const acceptance = 'a'.repeat(64);
  const release = 'b'.repeat(64);
  let result = run('verify_release_trust_anchors.js', [
    '--release-seal-public-key-sha256', release,
    '--acceptance-public-key-sha256', acceptance,
  ], cwd);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  result = run('verify_release_trust_anchors.js', [
    '--release-seal-public-key-sha256', acceptance,
    '--acceptance-public-key-sha256', acceptance,
  ], cwd);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /must use independent public keys/);
});
