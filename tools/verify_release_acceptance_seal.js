#!/usr/bin/env node
/**
 * [INPUT]: 依赖 schema v5 Ed25519 seal、committed acceptance evidence、人工安装/updater 完整分发闭包、supply-chain sidecars、release/source commit 与最终资产目录
 * [OUTPUT]: fail-closed 校验签名/trust anchor、evidence/supply-chain、九项分发字节、updater manifest 语义、两提交身份及 macOS Developer ID notarization=true
 * [POS]: GitHub Release 发布前与本地复验的最终 seal 守门器
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { assertHex, sha256File, validateEvidence } = require('./release_acceptance_contract');
const { verifySealSignature } = require('./release_seal_signature');
const { loadConfig, metadataForTag } = require('./release_metadata');
const { verifyManifestClosure } = require('./create_updater_manifest');

const rootDir = process.cwd();
const args = process.argv.slice(2);
function fail(message) { throw new Error(message); }
function optionValue(name) {
  const index = args.indexOf(name);
  if (index === -1) return null;
  const value = args[index + 1];
  if (!value || value.startsWith('--')) fail(`${name} requires a value.`);
  return value;
}
function readRegular(file, label) {
  const stat = fs.lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink()) fail(`${label} must be a regular non-symlink file: ${file}.`);
  return { value: JSON.parse(fs.readFileSync(file, 'utf8')), stat };
}
function assertFileDigest(value, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${field} is required.`);
  if (!Number.isInteger(value.bytes) || value.bytes < 1) fail(`${field}.bytes must be positive.`);
  if (!/^[a-f0-9]{64}$/.test(value.sha256)) fail(`${field}.sha256 is invalid.`);
}
function verifyAsset(asset, directory, field) {
  assertFileDigest(asset, field);
  if (typeof asset.name !== 'string' || !asset.name || path.basename(asset.name) !== asset.name) {
    fail(`${field}.name must be a plain filename.`);
  }
  if (!directory) return;
  const file = path.join(directory, asset.name);
  const stat = fs.lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size !== asset.bytes) {
    fail(`${field} file/byte mismatch: ${file}.`);
  }
  const digest = sha256File(file);
  if (digest !== asset.sha256) fail(`${field} SHA-256 mismatch: ${file}.`);
}

function main() {
  if (args.includes('--check-schema')) {
    const schema = readRegular(
      path.join(rootDir, 'tools/schemas/release_acceptance_seal.schema.json'),
      'Seal schema'
    ).value;
    if (schema.title !== 'ReleaseAcceptanceSeal' || schema.properties?.schemaVersion?.const !== 5) {
      fail('ReleaseAcceptanceSeal schema v5 is required.');
    }
    console.log('[verify-release-acceptance-seal] OK: schema v5 present');
    return;
  }
  const sealPath = path.resolve(optionValue('--seal') || '');
  const evidencePath = path.resolve(optionValue('--evidence') || '');
  if (!sealPath || !evidencePath || !fs.existsSync(sealPath) || !fs.existsSync(evidencePath)) {
    fail('--seal and --evidence are required and must exist.');
  }
  const seal = readRegular(sealPath, 'Release seal').value;
  const evidenceFile = readRegular(evidencePath, 'Acceptance evidence');
  const evidence = validateEvidence(evidenceFile.value);
  if (!evidence.windowsAcceptance) {
    fail('Windows acceptance summary is required because the seal declares assets.windowsX64.');
  }
  if (path.basename(evidencePath) !== `${evidence.tag}.evidence.json`) {
    fail(`Acceptance evidence filename must be ${evidence.tag}.evidence.json.`);
  }
  const requiredTop = [
    'schemaVersion', 'kind', 'tag', 'releaseCommitSha', 'sourceCommitSha',
    'targetCavalryVersion', 'qtVersion', 'languages', 'acceptanceAttestation', 'acceptanceEvidence',
    'assets', 'supplyChain', 'signing', 'createdAtUtc', 'createdBy', 'signature',
  ].sort();
  if (JSON.stringify(Object.keys(seal).sort()) !== JSON.stringify(requiredTop)) {
    fail('Release seal contains missing or unexpected top-level fields.');
  }
  if (seal.schemaVersion !== 5 || seal.kind !== 'ReleaseAcceptanceSeal') fail('Seal schema/kind mismatch.');
  verifySealSignature(
    seal,
    optionValue('--trusted-public-key-sha256') || process.env.RELEASE_SEAL_PUBLIC_KEY_SHA256 || null
  );
  assertHex(seal.releaseCommitSha, 'releaseCommitSha', 40);
  assertHex(seal.sourceCommitSha, 'sourceCommitSha', 40);
  const tag = optionValue('--tag') || process.env.GITHUB_REF_NAME;
  const releaseCommit = (optionValue('--release-commit') || process.env.GITHUB_SHA || '').toLowerCase();
  if (tag && seal.tag !== tag) fail(`Seal tag ${seal.tag} != ${tag}.`);
  if (releaseCommit && seal.releaseCommitSha !== releaseCommit) {
    fail(`Seal releaseCommitSha ${seal.releaseCommitSha} != ${releaseCommit}.`);
  }
  if (seal.tag !== evidence.tag || seal.sourceCommitSha !== evidence.sourceCommitSha) {
    fail('Seal tag/source commit does not match acceptance evidence.');
  }
  if (
    seal.targetCavalryVersion !== evidence.targetCavalryVersion ||
    seal.qtVersion !== evidence.qtVersion ||
    JSON.stringify(seal.languages) !== JSON.stringify(evidence.languages)
  ) {
    fail('Seal target/language contract does not match acceptance evidence.');
  }
  const attestationPath = path.resolve(optionValue('--attestation') || '');
  if (!attestationPath || !fs.existsSync(attestationPath)) fail('--attestation is required and must exist.');
  const attestationStat = fs.lstatSync(attestationPath);
  if (!attestationStat.isFile() || attestationStat.isSymbolicLink()) fail('Acceptance attestation must be a regular file.');
  verifyAsset(seal.acceptanceAttestation, path.dirname(attestationPath), 'acceptanceAttestation');
  if (seal.acceptanceAttestation.name !== path.basename(attestationPath)) fail('Acceptance attestation binding name mismatch.');
  const binding = seal.acceptanceEvidence;
  const expectedBinding = {
    name: path.basename(evidencePath),
    bytes: evidenceFile.stat.size,
    sha256: sha256File(evidencePath),
    sessionId: evidence.macosAcceptance.sessionId,
    sessionManifestSha256: evidence.macosAcceptance.sessionManifestSha256,
    finalRecordSha256: evidence.macosAcceptance.finalRecord.sha256,
    host: evidence.macosAcceptance.host,
    windowsAcceptance: evidence.windowsAcceptance,
  };
  if (JSON.stringify(binding) !== JSON.stringify(expectedBinding)) {
    fail('Seal acceptanceEvidence binding does not match the committed evidence file.');
  }
  if (
    seal.signing?.macosDeveloperIdNotarized !== true ||
    seal.signing?.windowsAuthenticode !== 'required-but-tracked-as-issue'
  ) {
    fail('Seal signing contract requires notarized Developer ID macOS assets and tracked Windows Authenticode debt.');
  }
  const assetsDir = optionValue('--assets-dir');
  const assetKeys = [
    'aarch64',
    'x64',
    'windowsX64',
    'updaterManifest',
    'updaterAarch64',
    'updaterAarch64Signature',
    'updaterX64',
    'updaterX64Signature',
    'updaterWindowsX64Signature',
  ];
  if (JSON.stringify(Object.keys(seal.assets || {}).sort()) !== JSON.stringify([...assetKeys].sort())) {
    fail('Signed seal assets contain missing or unexpected fields.');
  }
  for (const key of assetKeys) {
    verifyAsset(seal.assets?.[key], assetsDir ? path.resolve(assetsDir) : null, `assets.${key}`);
  }
  if (
    seal.acceptanceEvidence.windowsAcceptance.installer.bytes !== seal.assets.windowsX64.bytes ||
    seal.acceptanceEvidence.windowsAcceptance.installer.sha256 !== seal.assets.windowsX64.sha256
  ) {
    fail('Signed Windows acceptance installer identity does not match assets.windowsX64.');
  }
  if (assetsDir) {
    const directory = path.resolve(assetsDir);
    verifyManifestClosure({
      manifestPath: path.join(directory, seal.assets.updaterManifest.name),
      metadata: metadataForTag(loadConfig(), seal.tag),
      artifacts: {
        'darwin-aarch64': path.join(directory, seal.assets.updaterAarch64.name),
        'darwin-x86_64': path.join(directory, seal.assets.updaterX64.name),
        'windows-x86_64': path.join(directory, seal.assets.windowsX64.name),
      },
      signatures: {
        'darwin-aarch64': path.join(directory, seal.assets.updaterAarch64Signature.name),
        'darwin-x86_64': path.join(directory, seal.assets.updaterX64Signature.name),
        'windows-x86_64': path.join(directory, seal.assets.updaterWindowsX64Signature.name),
      },
    });
  }
  const sidecarsDir = optionValue('--sidecars-dir') || assetsDir;
  verifyAsset(seal.supplyChain?.sbom, sidecarsDir ? path.resolve(sidecarsDir) : null, 'supplyChain.sbom');
  verifyAsset(
    seal.supplyChain?.toolchainEvidence,
    sidecarsDir ? path.resolve(sidecarsDir) : null,
    'supplyChain.toolchainEvidence'
  );
  if (!Number.isFinite(Date.parse(seal.createdAtUtc)) || typeof seal.createdBy !== 'string' || !seal.createdBy) {
    fail('Seal createdAtUtc/createdBy is invalid.');
  }
  console.log(`[verify-release-acceptance-seal] OK: ${seal.tag} binds release ${seal.releaseCommitSha} and source ${seal.sourceCommitSha}`);
}

try { main(); } catch (error) {
  console.error(`[verify-release-acceptance-seal] ${error.message}`);
  process.exit(1);
}
