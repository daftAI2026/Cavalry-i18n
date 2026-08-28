#!/usr/bin/env node
/**
 * [INPUT]: 依赖已验证的 evidence-only release commit、三份人工安装资产、完整 updater manifest/artifact/signature 闭包、SBOM/toolchain 摘要、macOS 公证信号及受保护 Ed25519 密钥
 * [OUTPUT]: 写出由 Ed25519 签名并同时绑定人工安装与自更新分发字节的 source/release/evidence/supply-chain 资产 seal
 * [POS]: CI 最终资产 seal 生成器；禁止以 confirm flag 代替真实 committed evidence
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { assertHex, sha256File, validateEvidence } = require('./release_acceptance_contract');
const { signSeal } = require('./release_seal_signature');
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
function readRegularJson(file, label) {
  const stat = fs.lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink()) fail(`${label} must be a regular non-symlink file.`);
  return { value: JSON.parse(fs.readFileSync(file, 'utf8')), stat };
}
function assetInfo(file) {
  const absolute = path.resolve(file);
  const stat = fs.lstatSync(absolute);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size < 1) fail(`Asset is invalid: ${absolute}.`);
  return { name: path.basename(absolute), sha256: sha256File(absolute), bytes: stat.size };
}
function sidecarInfo(file, label) {
  const absolute = path.resolve(file || '');
  const stat = fs.lstatSync(absolute);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size < 1) fail(`${label} is invalid: ${absolute}.`);
  return { name: path.basename(absolute), sha256: sha256File(absolute), bytes: stat.size };
}
function git(gitArgs) {
  const result = spawnSync('git', gitArgs, { cwd: rootDir, encoding: 'utf8' });
  if (result.status !== 0) fail(`git ${gitArgs.join(' ')} failed: ${(result.stderr || result.stdout).trim()}`);
  return result.stdout.trim();
}

function main() {
  if (args.includes('--confirm-live-pass')) {
    fail('--confirm-live-pass is forbidden; pass the committed verified --evidence file.');
  }
  if (!args.includes('--macos-notarized')) {
    fail('--macos-notarized is required after the final DMGs pass notarization/staple verification.');
  }
  const tag = optionValue('--tag') || process.env.GITHUB_REF_NAME;
  const releaseCommitSha = (
    optionValue('--release-commit') || process.env.GITHUB_SHA || git(['rev-parse', 'HEAD'])
  ).toLowerCase();
  assertHex(releaseCommitSha, 'releaseCommitSha', 40);
  const evidencePath = path.resolve(optionValue('--evidence') || '');
  if (!tag || !evidencePath || !fs.existsSync(evidencePath)) fail('--tag and --evidence are required.');
  const evidenceFile = readRegularJson(evidencePath, 'Acceptance evidence');
  const evidence = validateEvidence(evidenceFile.value);
  if (!evidence.windowsAcceptance) {
    fail('Windows acceptance summary is required because the release seal declares a Windows artifact.');
  }
  if (evidence.tag !== tag) fail(`Evidence tag ${evidence.tag} != ${tag}.`);
  if (path.basename(evidencePath) !== `${tag}.evidence.json`) {
    fail(`Acceptance evidence filename must be ${tag}.evidence.json.`);
  }

  const releaseConfig = loadConfig();
  const releaseMetadata = metadataForTag(releaseConfig, tag);
  const expectedNames = {
    aarch64: process.env.RELEASE_ASSET_NAME_AARCH64,
    x64: process.env.RELEASE_ASSET_NAME_X64,
    windowsX64: process.env.RELEASE_ASSET_NAME_WINDOWS_X64,
  };
  const assets = {
    aarch64: assetInfo(optionValue('--aarch64') || ''),
    x64: assetInfo(optionValue('--x64') || ''),
    windowsX64: assetInfo(optionValue('--windows-x64') || ''),
    updaterManifest: assetInfo(optionValue('--updater-manifest') || ''),
    updaterAarch64: assetInfo(optionValue('--updater-aarch64') || ''),
    updaterAarch64Signature: assetInfo(optionValue('--updater-aarch64-signature') || ''),
    updaterX64: assetInfo(optionValue('--updater-x64') || ''),
    updaterX64Signature: assetInfo(optionValue('--updater-x64-signature') || ''),
    updaterWindowsX64Signature: assetInfo(optionValue('--updater-windows-x64-signature') || ''),
  };
  verifyManifestClosure({
    manifestPath: path.resolve(optionValue('--updater-manifest') || ''),
    metadata: releaseMetadata,
    artifacts: {
      'darwin-aarch64': path.resolve(optionValue('--updater-aarch64') || ''),
      'darwin-x86_64': path.resolve(optionValue('--updater-x64') || ''),
      'windows-x86_64': path.resolve(optionValue('--windows-x64') || ''),
    },
    signatures: {
      'darwin-aarch64': path.resolve(optionValue('--updater-aarch64-signature') || ''),
      'darwin-x86_64': path.resolve(optionValue('--updater-x64-signature') || ''),
      'windows-x86_64': path.resolve(optionValue('--updater-windows-x64-signature') || ''),
    },
  });
  if (
    evidence.windowsAcceptance.installer.bytes !== assets.windowsX64.bytes ||
    evidence.windowsAcceptance.installer.sha256 !== assets.windowsX64.sha256
  ) {
    fail('Windows acceptance installer identity does not match the final Windows release asset.');
  }
  const acceptanceAttestation = sidecarInfo(optionValue('--acceptance-attestation') || '', 'Acceptance attestation');
  if (acceptanceAttestation.name !== `${tag}.acceptance-attestation.json`) fail('Acceptance attestation filename is invalid.');
  const supplyChain = {
    sbom: sidecarInfo(optionValue('--sbom') || '', 'SBOM'),
    toolchainEvidence: sidecarInfo(optionValue('--toolchain-evidence') || '', 'Toolchain evidence'),
  };
  for (const [key, expected] of Object.entries(expectedNames)) {
    if (expected && assets[key].name !== expected) {
      fail(`Asset ${key} must use release metadata name ${expected}, got ${assets[key].name}.`);
    }
  }
  const seal = {
    schemaVersion: 5,
    kind: 'ReleaseAcceptanceSeal',
    tag,
    releaseCommitSha,
    sourceCommitSha: evidence.sourceCommitSha,
    targetCavalryVersion: releaseConfig.targetCavalryVersion,
    qtVersion: evidence.qtVersion,
    languages: [...evidence.languages],
    acceptanceAttestation,
    acceptanceEvidence: {
      name: path.basename(evidencePath),
      bytes: evidenceFile.stat.size,
      sha256: sha256File(evidencePath),
      sessionId: evidence.macosAcceptance.sessionId,
      sessionManifestSha256: evidence.macosAcceptance.sessionManifestSha256,
      finalRecordSha256: evidence.macosAcceptance.finalRecord.sha256,
      host: evidence.macosAcceptance.host,
      windowsAcceptance: evidence.windowsAcceptance,
    },
    assets,
    supplyChain,
    signing: {
      macosDeveloperIdNotarized: true,
      windowsAuthenticode: 'required-but-tracked-as-issue',
    },
    createdAtUtc: optionValue('--created-at') || git(['show', '-s', '--format=%cI', releaseCommitSha]),
    createdBy: optionValue('--created-by') || 'github-actions',
  };
  seal.signature = signSeal(
    seal,
    process.env.RELEASE_SEAL_PRIVATE_KEY,
    optionValue('--trusted-public-key-sha256') || process.env.RELEASE_SEAL_PUBLIC_KEY_SHA256
  );
  const output = path.resolve(optionValue('--output') || path.join(rootDir, 'dist/ReleaseAcceptanceSeal.json'));
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, `${JSON.stringify(seal, null, 2)}\n`, { flag: 'wx', mode: 0o444 });
  console.log(`[create-release-acceptance-seal] wrote ${output}`);
}

try { main(); } catch (error) {
  console.error(`[create-release-acceptance-seal] ${error.message}`);
  process.exit(1);
}
