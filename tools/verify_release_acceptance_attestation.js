#!/usr/bin/env node
/**
 * [INPUT]: acceptance evidence、canonical protected attestation 与独立公开 fingerprint。
 * [OUTPUT]: exact-shape、Ed25519 trust、evidence bytes、host/matrix/source identity 全绑定验证。
 * [POS]: tag preflight 与 publish 前最后一道 independent acceptance authority 边界。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { isDeepStrictEqual } = require('node:util');
const { validateEvidence, sha256File } = require('./release_acceptance_contract');
const { verifySealSignature } = require('./release_seal_signature');
const args = process.argv.slice(2);
const root = process.cwd();
function fail(message) { throw new Error(message); }
function opt(name) {
  const index = args.indexOf(name);
  if (index < 0) return null;
  const value = args[index + 1];
  if (!value || value.startsWith('--')) fail(`${name} requires a value.`);
  return value;
}
function json(file, label) {
  const absolute = fs.realpathSync(path.resolve(file));
  const stat = fs.lstatSync(absolute);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size < 1) {
    fail(`${label} must be a canonical regular file.`);
  }
  return { value: JSON.parse(fs.readFileSync(absolute, 'utf8')), stat, absolute };
}
function exactKeys(value, expected, label) {
  const actual = Object.keys(value || {}).sort();
  const wanted = [...expected].sort();
  if (JSON.stringify(actual) !== JSON.stringify(wanted)) {
    fail(`${label} keys mismatch.`);
  }
}
function main() {
  const tag = opt('--tag') || process.env.GITHUB_REF_NAME;
  if (!tag) fail('--tag is required.');
  const evidenceInput = json(
    opt('--evidence') || path.join(root, 'release-seals', `${tag}.evidence.json`),
    'Evidence'
  );
  const evidence = validateEvidence(evidenceInput.value);
  const attestationInput = json(
    opt('--attestation') || path.join(root, 'release-seals', `${tag}.acceptance-attestation.json`),
    'Acceptance attestation'
  );
  const attestation = attestationInput.value;
  exactKeys(
    attestation,
    [
      'schemaVersion', 'kind', 'tag', 'sourceCommitSha', 'evidence',
      'targetCavalryVersion', 'qtVersion', 'languages', 'matrix', 'host',
      'createdAtUtc', 'createdBy', 'signature',
    ],
    'Acceptance attestation'
  );
  if (
    evidence.tag !== tag || attestation.schemaVersion !== 1 ||
    attestation.kind !== 'ReleaseAcceptanceAttestation' || attestation.tag !== tag ||
    attestation.sourceCommitSha !== evidence.sourceCommitSha ||
    !Number.isFinite(Date.parse(attestation.createdAtUtc)) ||
    typeof attestation.createdBy !== 'string' || attestation.createdBy.length === 0
  ) {
    fail('Acceptance attestation identity/timestamp/creator mismatch.');
  }
  verifySealSignature(
    attestation,
    opt('--trusted-public-key-sha256') ||
      process.env.RELEASE_ACCEPTANCE_ATTESTATION_PUBLIC_KEY_SHA256
  );
  const expected = {
    name: path.basename(evidenceInput.absolute),
    bytes: evidenceInput.stat.size,
    sha256: sha256File(evidenceInput.absolute),
  };
  if (
    !isDeepStrictEqual(attestation.evidence, expected) ||
    attestation.targetCavalryVersion !== evidence.targetCavalryVersion ||
    attestation.qtVersion !== evidence.qtVersion ||
    !isDeepStrictEqual(attestation.languages, evidence.languages) ||
    attestation.matrix !== evidence.macosAcceptance.matrix ||
    !isDeepStrictEqual(attestation.host, evidence.macosAcceptance.host)
  ) {
    fail('Acceptance attestation does not bind the exact verified evidence.');
  }
  console.log(`[verify-release-acceptance-attestation] OK: ${tag} acceptance authority verified`);
}
try { main(); } catch (error) {
  console.error(`[verify-release-acceptance-attestation] ${error.message}`);
  process.exit(1);
}
