#!/usr/bin/env node
/**
 * [INPUT]: 三份 producer ToolchainEvidenceRecord（source-contracts、macOS aarch64/x64）、release commit、Windows x64 资产名与输出路径
 * [OUTPUT]: 确定性 ReleaseToolchainEvidence，逐项校验 capture/commit/target 并明确声明 Windows producer evidence 由 issue 跟踪而非伪装已覆盖
 * [POS]: release supply-chain 的 producer evidence 聚合门；输出字节由 ReleaseAssetProvenance 与 private-draft 回读绑定
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const args = process.argv.slice(2);
const requiredScopes = new Map([
  ['source-contracts', 'source-contracts'],
  ['macos-aarch64', 'aarch64-apple-darwin'],
  ['macos-x64', 'x86_64-apple-darwin'],
]);

function fail(message) { throw new Error(message); }
function optionValue(name) {
  const index = args.indexOf(name);
  if (index === -1) return null;
  const value = args[index + 1];
  if (!value || value.startsWith('--')) fail(`${name} requires a value.`);
  return value;
}
function repeated(name) {
  const values = [];
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] !== name) continue;
    const value = args[index + 1];
    if (!value || value.startsWith('--')) fail(`${name} requires a value.`);
    values.push(value);
  }
  return values;
}
function exactKeys(value, keys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      JSON.stringify(Object.keys(value).sort()) !== JSON.stringify([...keys].sort())) {
    fail(`${label} has missing or unexpected fields.`);
  }
}
function readRecord(file) {
  const absolute = path.resolve(file);
  const stat = fs.lstatSync(absolute);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size < 1) fail(`Toolchain record must be a non-empty regular file: ${absolute}.`);
  const record = JSON.parse(fs.readFileSync(absolute, 'utf8'));
  exactKeys(record, ['schemaVersion', 'kind', 'createdAtUtc', 'commitSha', 'scope', 'target', 'runner', 'pins', 'files', 'runtime', 'envRefs'], `Toolchain record ${file}`);
  if (record.schemaVersion !== 1 || record.kind !== 'ToolchainEvidenceRecord') fail(`Unsupported toolchain record schema: ${file}.`);
  if (!Number.isFinite(Date.parse(record.createdAtUtc)) || !/^[a-f0-9]{40}$/.test(record.commitSha)) fail(`Toolchain record identity is invalid: ${file}.`);
  exactKeys(record.runtime, ['node', 'npm', 'rustc', 'cargo', 'python'], `Toolchain record runtime ${file}`);
  for (const [tool, capture] of Object.entries(record.runtime)) {
    exactKeys(capture, ['command', 'status', 'stdout', 'stderr'], `Toolchain record ${tool} capture ${file}`);
    if (capture.status !== 0 || typeof capture.command !== 'string' || !capture.command || typeof capture.stdout !== 'string' || !capture.stdout.trim()) {
      fail(`Toolchain record ${file} has an unsuccessful or hollow ${tool} capture.`);
    }
  }
  return record;
}

function main() {
  if (args.includes('--check-schema')) {
    const schema = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'tools/schemas/release_toolchain_evidence.schema.json'), 'utf8'));
    if (schema.title !== 'ReleaseToolchainEvidence' || schema.properties?.schemaVersion?.const !== 1) fail('ReleaseToolchainEvidence schema v1 is required.');
    console.log('[create-toolchain-evidence-bundle] OK: schema v1 present');
    return;
  }
  const releaseCommitSha = (optionValue('--release-commit') || process.env.GITHUB_SHA || '').toLowerCase();
  if (!/^[a-f0-9]{40}$/.test(releaseCommitSha)) fail('--release-commit/GITHUB_SHA must be a 40-character SHA.');
  const windowsAssetName = optionValue('--windows-asset');
  if (!windowsAssetName || path.basename(windowsAssetName) !== windowsAssetName) fail('--windows-asset must be a plain filename.');
  const records = repeated('--record').map(readRecord).sort((left, right) => left.scope.localeCompare(right.scope));
  const seen = new Set();
  for (const record of records) {
    if (seen.has(record.scope)) fail(`Duplicate toolchain evidence scope: ${record.scope}.`);
    seen.add(record.scope);
    const expectedTarget = requiredScopes.get(record.scope);
    if (!expectedTarget || record.target !== expectedTarget) fail(`Unexpected toolchain scope/target: ${record.scope}/${record.target}.`);
    if (record.commitSha !== releaseCommitSha) fail(`Toolchain record ${record.scope} does not bind release commit ${releaseCommitSha}.`);
  }
  const missing = [...requiredScopes.keys()].filter((scope) => !seen.has(scope));
  if (missing.length || seen.size !== requiredScopes.size) fail(`Toolchain producer scope set is incomplete: ${missing.join(', ') || '<unexpected scope>'}.`);
  const createdAtValues = new Set(records.map((record) => record.createdAtUtc));
  if (createdAtValues.size !== 1) fail('Toolchain records must use the same commit-derived createdAtUtc.');
  const bundle = {
    schemaVersion: 1,
    kind: 'ReleaseToolchainEvidence',
    releaseCommitSha,
    createdAtUtc: records[0].createdAtUtc,
    records,
    uncoveredArtifacts: [{
      platform: 'windows-x64',
      assetName: windowsAssetName,
      status: 'tracked-as-issue',
      issueUrl: 'https://github.com/daftAI2026/Cavalry-i18n/issues/16',
    }],
  };
  const output = path.resolve(optionValue('--output') || path.join(process.cwd(), 'dist/toolchain-evidence.json'));
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, `${JSON.stringify(bundle, null, 2)}\n`, { flag: 'wx', mode: 0o444 });
  console.log(`[create-toolchain-evidence-bundle] wrote ${output} (${records.length} producer records)`);
}

try { main(); } catch (error) { console.error(`[create-toolchain-evidence-bundle] ${error.message}`); process.exit(1); }
