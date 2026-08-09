#!/usr/bin/env node
/**
 * [INPUT]: package-lock.json、src-tauri/Cargo.lock、release commit/tag 与可选输出路径。
 * [OUTPUT]: deterministic CycloneDX 1.5 JSON SBOM；组件按 purl 排序，metadata 绑定发布 commit。
 * [POS]: release supply-chain sidecar producer；其 bytes are covered by ReleaseAcceptanceSeal.
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const rootDir = process.cwd();
const args = process.argv.slice(2);
function fail(message) { throw new Error(message); }
function optionValue(name) { const i = args.indexOf(name); if (i === -1) return null; const value = args[i + 1]; if (!value || value.startsWith('--')) fail(`${name} requires a value.`); return value; }
function git(gitArgs) { const r = spawnSync('git', gitArgs, { cwd: rootDir, encoding: 'utf8' }); if (r.status !== 0) fail(`git ${gitArgs.join(' ')} failed: ${(r.stderr || r.stdout).trim()}`); return r.stdout.trim(); }
function stableSerial(tag, commit) { const hash = crypto.createHash('sha256').update(`${tag}\n${commit}`).digest('hex'); return `urn:uuid:${hash.slice(0, 8)}-${hash.slice(8, 12)}-5${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`; }
function packageNameFromLockLocation(location) {
  const marker = 'node_modules/';
  const markerIndex = location.lastIndexOf(marker);
  if (markerIndex === -1) fail(`Unsupported npm lock package location: ${location}.`);
  const name = location.slice(markerIndex + marker.length);
  if (!name || name.includes('/node_modules/') || (name.startsWith('@') && name.split('/').length !== 2)) {
    fail(`Could not derive npm package name from lock location: ${location}.`);
  }
  return name;
}
function npmPurl(name, version) {
  const encodedName = name.startsWith('@')
    ? `%40${name.slice(1).split('/').map(encodeURIComponent).join('/')}`
    : encodeURIComponent(name);
  return `pkg:npm/${encodedName}@${encodeURIComponent(version)}`;
}
function npmComponents() {
  const lock = JSON.parse(fs.readFileSync(path.join(rootDir, 'package-lock.json'), 'utf8'));
  return Object.entries(lock.packages || {})
    .filter(([location, value]) => location && value?.version && !value?.link)
    .map(([location, value]) => {
      const name = value.name || packageNameFromLockLocation(location);
      return { type: 'library', name, version: value.version, purl: npmPurl(name, value.version), properties: [{ name: 'cavalry-i18n:lock-path', value: location }] };
    });
}
function cargoComponents() {
  const text = fs.readFileSync(path.join(rootDir, 'src-tauri/Cargo.lock'), 'utf8');
  const components = [];
  for (const block of text.split('[[package]]').slice(1)) {
    const name = block.match(/^name = "([^"]+)"/m)?.[1]; const version = block.match(/^version = "([^"]+)"/m)?.[1];
    if (name && version) components.push({ type: 'library', name, version, purl: `pkg:cargo/${encodeURIComponent(name)}@${encodeURIComponent(version)}` });
  }
  return components;
}
function main() {
  const tag = optionValue('--tag') || process.env.GITHUB_REF_NAME; if (!tag) fail('--tag is required.');
  const commit = (optionValue('--release-commit') || process.env.GITHUB_SHA || git(['rev-parse', 'HEAD'])).toLowerCase();
  if (!/^[a-f0-9]{40}$/.test(commit)) fail('--release-commit must be a 40-char SHA.');
  const components = [...npmComponents(), ...cargoComponents()].sort((a, b) => (a.purl < b.purl ? -1 : a.purl > b.purl ? 1 : 0));
  if (!components.length) fail('SBOM component set is empty.');
  const bom = { bomFormat: 'CycloneDX', specVersion: '1.5', serialNumber: stableSerial(tag, commit), version: 1,
    metadata: { timestamp: git(['show', '-s', '--format=%cI', commit]), component: { type: 'application', name: 'cavalry-i18n', version: JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8')).version, properties: [{ name: 'cavalry-i18n:release-tag', value: tag }, { name: 'cavalry-i18n:release-commit', value: commit }] } }, components };
  const output = path.resolve(optionValue('--output') || path.join(rootDir, 'dist/CycloneDX.json'));
  fs.mkdirSync(path.dirname(output), { recursive: true }); fs.writeFileSync(output, `${JSON.stringify(bom, null, 2)}\n`, { flag: 'wx', mode: 0o444 });
  console.log(`[create-sbom] wrote ${output} (${components.length} components)`);
}
try { main(); } catch (error) { console.error(`[create-sbom] ${error.message}`); process.exit(1); }
