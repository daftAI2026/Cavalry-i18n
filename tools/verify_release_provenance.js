#!/usr/bin/env node
/**
 * [INPUT]: release-asset-provenance.json、signed ReleaseAcceptanceSeal、CycloneDX SBOM、toolchain evidence and primary assets.
 * [OUTPUT]: validates public provenance records point to the same tag/source/release commits and exact signed supply-chain/primary artifact bytes.
 * [POS]: last local provenance gate before GitHub Release upload.
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
'use strict';
const fs = require('node:fs'); const path = require('node:path'); const crypto = require('node:crypto');
const { verifySealSignature } = require('./release_seal_signature');
const args = process.argv.slice(2);
function fail(message) { throw new Error(message); }
function optionValue(name) { const i = args.indexOf(name); if (i === -1) return null; const value = args[i + 1]; if (!value || value.startsWith('--')) fail(`${name} requires a value.`); return value; }
function repeated(name) { const result = []; for (let index = 0; index < args.length; index += 1) if (args[index] === name) { const value = args[index + 1]; if (!value || value.startsWith('--')) fail(`${name} requires a value.`); result.push(value); } return result; }
function info(file) { const stat = fs.lstatSync(file); if (!stat.isFile() || stat.isSymbolicLink() || stat.size < 1) fail(`Invalid regular file: ${file}`); return { name: path.basename(file), bytes: stat.size, sha256: crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex') }; }
function same(left, right) { return left && right && left.name === right.name && left.bytes === right.bytes && left.sha256 === right.sha256; }
function exactKeys(value, keys, label) { if (!value || typeof value !== 'object' || Array.isArray(value) || JSON.stringify(Object.keys(value).sort()) !== JSON.stringify([...keys].sort())) fail(`${label} has missing or unexpected fields.`); }
function main() {
 if (args.includes('--check-schema')) {
   const schema = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'tools/schemas/release_asset_provenance.schema.json'), 'utf8'));
   if (schema.title !== 'ReleaseAssetProvenance' || schema.properties?.schemaVersion?.const !== 3) fail('ReleaseAssetProvenance schema v3 is required.');
   console.log('[verify-release-provenance] OK: schema v3 present'); return;
 }
 const dist = path.resolve(optionValue('--dist') || 'dist'); const provenanceFile = path.join(dist, 'release-asset-provenance.json'); const sealFile = path.join(dist, 'ReleaseAcceptanceSeal.json'); const sbomFile = path.join(dist, 'CycloneDX.json'); const toolchainFile = path.join(dist, 'toolchain-evidence.json');
 const provenance = JSON.parse(fs.readFileSync(provenanceFile, 'utf8')); const evidencePath = path.join(dist, `${provenance.tag || ''}.evidence.json`); const attestationPath = path.join(dist, `${provenance.tag || ''}.acceptance-attestation.json`); const seal = JSON.parse(fs.readFileSync(sealFile, 'utf8'));
 exactKeys(provenance, ['schemaVersion', 'kind', 'tag', 'releaseCommitSha', 'sourceCommitSha', 'createdAtUtc', 'assets', 'acceptanceAttestation', 'signedSeal', 'supplyChain', 'signing'], 'Provenance');
 if (provenance.schemaVersion !== 3 || provenance.kind !== 'ReleaseAssetProvenance' || !/^cavalry-2\.7\.2-p[0-9]+$/.test(provenance.tag) || !/^[a-f0-9]{40}$/.test(provenance.releaseCommitSha) || !/^[a-f0-9]{40}$/.test(provenance.sourceCommitSha) || !Number.isFinite(Date.parse(provenance.createdAtUtc))) fail('Provenance identity fields are invalid.');
 verifySealSignature(seal, optionValue('--trusted-public-key-sha256') || process.env.RELEASE_SEAL_PUBLIC_KEY_SHA256 || null);
 if (provenance.tag !== seal.tag || provenance.releaseCommitSha !== seal.releaseCommitSha || provenance.sourceCommitSha !== seal.sourceCommitSha) fail('Provenance tag/source/release identity does not match the signed seal.');
 exactKeys(provenance.signing, ['macos', 'windows'], 'Provenance signing');
 if (provenance.signing.macos !== 'developer-id-notarized' || provenance.signing.windows !== 'authenticode-required-but-tracked-as-issue') fail('Provenance signing declaration is invalid.');
 if (!provenance.acceptanceAttestation || !same(provenance.acceptanceAttestation, info(attestationPath)) || !seal.acceptanceAttestation || !same(seal.acceptanceAttestation, info(attestationPath))) fail('Provenance acceptance attestation identity mismatch.');
 if (!seal.acceptanceEvidence || !same(seal.acceptanceEvidence, info(evidencePath))) fail('Signed seal acceptance evidence does not match the file selected for upload.');
 if (!provenance.signedSeal || !same(provenance.signedSeal, info(sealFile))) fail('Provenance signedSeal does not match ReleaseAcceptanceSeal.json.');
 if (!provenance.supplyChain || !same(provenance.supplyChain.sbom, info(sbomFile)) || !same(provenance.supplyChain.toolchainEvidence, info(toolchainFile))) fail('Provenance supply-chain identities mismatch.');
 if (!seal.supplyChain || !same(seal.supplyChain.sbom, info(sbomFile)) || !same(seal.supplyChain.toolchainEvidence, info(toolchainFile))) fail('Signed seal supply-chain identities mismatch.');
 const sbom = JSON.parse(fs.readFileSync(sbomFile, 'utf8'));
 const sbomCommit = sbom.metadata?.component?.properties?.find((entry) => entry?.name === 'cavalry-i18n:release-commit')?.value;
 if (sbom.bomFormat !== 'CycloneDX' || sbom.specVersion !== '1.5' || sbomCommit !== provenance.releaseCommitSha || !Array.isArray(sbom.components) || sbom.components.length < 1) fail('SBOM does not semantically bind the release commit or has no components.');
 const toolchain = JSON.parse(fs.readFileSync(toolchainFile, 'utf8'));
 if (toolchain.schemaVersion !== 1 || toolchain.kind !== 'ReleaseToolchainEvidence' || toolchain.releaseCommitSha !== provenance.releaseCommitSha) fail('Toolchain evidence does not semantically bind the release commit.');
 if (!Array.isArray(provenance.assets) || provenance.assets.length < 1) fail('Provenance primary assets are required.');
 const names = new Set();
 for (const asset of provenance.assets) {
   if (!asset || typeof asset.name !== 'string' || path.basename(asset.name) !== asset.name || names.has(asset.name)) fail('Provenance contains an invalid or duplicate primary asset.');
   names.add(asset.name);
   if (!same(asset, info(path.join(dist, asset.name)))) fail(`Provenance primary asset mismatch: ${asset.name || '<missing>'}`);
 }
 exactKeys(seal.assets, ['aarch64', 'x64', 'windowsX64'], 'Signed seal assets');
 const sealedAssets = Object.values(seal.assets);
 if (sealedAssets.length !== provenance.assets.length || sealedAssets.some((asset) => !provenance.assets.some((candidate) => same(candidate, asset)))) fail('Provenance primary assets do not match the signed seal assets.');
 const expectedPrimary = repeated('--primary');
 if (expectedPrimary.length && (expectedPrimary.length !== names.size || expectedPrimary.some((name) => !names.has(name)))) fail('Provenance primary asset set does not match required assets.');
 console.log(`[verify-release-provenance] OK: ${provenance.tag} binds signed seal, SBOM, toolchain and ${provenance.assets.length} assets`);
}
try { main(); } catch (error) { console.error(`[verify-release-provenance] ${error.message}`); process.exit(1); }
