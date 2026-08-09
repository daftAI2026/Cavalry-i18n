#!/usr/bin/env node
/**
 * [INPUT]: 依赖 source artifact manifest/schema、workflow 声明、git commit 与 CI 上传/回读后的未压缩 tar source artifact。
 * [OUTPUT]: 逐 entry 解析 tar，拒绝 traversal/link/special/duplicate/forbidden 输入，并将文件集合、bytes 与 executable modes 精确比对该 commit 的独立 `git archive`；marker 不能替代 tree 校验。
 * [POS]: source artifact 守门器；CI 只上传保留 mode 的 tar，并在上传前后都以 `--archive ... --commit ...` 复验。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const rootDir = process.cwd();
const args = process.argv.slice(2);

function optionValue(name) {
  const index = args.indexOf(name);
  if (index === -1) return null;
  const value = args[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`${name} requires a value.`);
  return value;
}
function fail(message) { throw new Error(message); }
function readText(relativePath) { return fs.readFileSync(path.join(rootDir, relativePath), 'utf8'); }
function readJson(relativePath) { return JSON.parse(readText(relativePath)); }

function normalizedRelativePath(value, field) {
  if (typeof value !== 'string' || value.length === 0 || value.includes('\0')) {
    fail(`${field} must be a non-empty relative path.`);
  }
  const slashPath = value.replaceAll('\\', '/');
  if (slashPath.startsWith('/') || /^[A-Za-z]:\//.test(slashPath)) {
    fail(`${field} must not be absolute: ${value}`);
  }
  const normalized = path.posix.normalize(slashPath).replace(/^\.\//, '').replace(/\/$/, '');
  if (normalized === '.' || normalized === '..' || normalized.startsWith('../')) {
    fail(`${field} must not escape the artifact root: ${value}`);
  }
  return normalized;
}
function validateStringList(value, field) {
  if (!Array.isArray(value) || value.length === 0) fail(`${field} must be a non-empty array.`);
  const normalized = value.map((entry, index) => normalizedRelativePath(entry, `${field}[${index}]`));
  if (new Set(normalized).size !== normalized.length) fail(`${field} must not contain duplicates.`);
  return normalized;
}
function loadManifest() {
  const manifest = readJson('tools/source_artifact_manifest.json');
  const schema = readJson('tools/schemas/source_artifact_manifest.schema.json');
  if (manifest.schemaVersion !== schema.properties.schemaVersion.const) {
    fail('source_artifact_manifest.schemaVersion mismatch.');
  }
  if (manifest.kind !== schema.properties.kind.const) fail('source_artifact_manifest.kind mismatch.');
  if (!Array.isArray(manifest.forbiddenFileExtensions) || manifest.forbiddenFileExtensions.length === 0) {
    fail('forbiddenFileExtensions must be a non-empty array.');
  }
  if (!Array.isArray(manifest.forbiddenFileNames) || manifest.forbiddenFileNames.length === 0) {
    fail('forbiddenFileNames must be a non-empty array.');
  }
  const identity = manifest.artifactIdentity;
  if (!identity || typeof identity !== 'object') fail('artifactIdentity is required.');
  if (identity.kind !== 'CavalryI18nSourceArtifact' || identity.schemaVersion !== 1) {
    fail('artifactIdentity kind/schemaVersion is unsupported.');
  }
  return {
    ...manifest,
    requiredPaths: validateStringList(manifest.requiredPaths, 'requiredPaths'),
    sourceArchivePaths: validateStringList(manifest.sourceArchivePaths, 'sourceArchivePaths'),
    forbiddenPathPrefixes: validateStringList(manifest.forbiddenPathPrefixes, 'forbiddenPathPrefixes'),
    artifactIdentity: {
      ...identity,
      markerPath: normalizedRelativePath(identity.markerPath, 'artifactIdentity.markerPath'),
    },
  };
}
function pathExists(base, relativePath) { return fs.existsSync(path.join(base, relativePath)); }
function verifyRepoPaths(manifest) {
  const missing = manifest.requiredPaths.filter((relativePath) => !pathExists(rootDir, relativePath));
  if (missing.length > 0) fail(`Repository missing source-artifact required paths:\n- ${missing.join('\n- ')}`);
}
function verifyWorkflowCoverage(manifest) {
  const workflow = readText('.github/workflows/build.yml');
  for (const required of [
    /- name: Stage and verify deterministic source artifact[\s\S]*node tools\/create_source_artifact\.js[\s\S]*--commit "\$GITHUB_SHA"[\s\S]*--output "\$RUNNER_TEMP\/cavalry-i18n-source\.tar"/,
    /- name: Upload app source artifact[\s\S]*path:\s*\$\{\{ runner\.temp \}\}\/cavalry-i18n-source\.tar/,
    /- name: Download source artifact for round-trip verification[\s\S]*name:\s*cavalry-i18n-tauri-source/,
    /- name: Re-verify downloaded source artifact[\s\S]*verify_source_artifact\.js[\s\S]*--archive "\$RUNNER_TEMP\/cavalry-i18n-source-roundtrip\/cavalry-i18n-source\.tar"[\s\S]*--commit "\$GITHUB_SHA"/,
  ]) {
    if (!required.test(workflow)) fail(`source artifact workflow contract missing: ${required}`);
  }
  for (const archivePath of manifest.sourceArchivePaths) {
    if (!pathExists(rootDir, archivePath)) {
      fail(`sourceArchivePaths entry is absent from the current repository: ${archivePath}`);
    }
  }
}
function hasForbiddenPrefix(relativePath, prefixes) {
  const components = relativePath.split('/');
  return prefixes.some((prefix) => relativePath === prefix || relativePath.startsWith(`${prefix}/`)) ||
    components.some((component) => ['.git', 'node_modules', 'qt_sdk'].includes(component));
}
function hasForbiddenName(relativePath, manifest) {
  const basename = path.posix.basename(relativePath).toLowerCase();
  if (manifest.forbiddenFileNames.map((name) => name.toLowerCase()).includes(basename)) return true;
  if (basename === '.env' || basename.startsWith('.env.')) return true;
  if (/(^|[-_.])(secret|credential|token|password)([-_.]|$)/.test(basename)) return true;
  return manifest.forbiddenFileExtensions.some((extension) => basename.endsWith(extension.toLowerCase()));
}
function parseOctal(field, label) {
  if (field[0] & 0x80) fail(`${label} uses unsupported base-256 tar encoding.`);
  const text = field.toString('ascii').replace(/\0.*$/, '').trim();
  if (!/^[0-7]+$/.test(text || '0')) fail(`${label} is not a canonical octal tar field.`);
  return Number.parseInt(text || '0', 8);
}
function parsePax(data, label) {
  const result = {};
  let offset = 0;
  while (offset < data.length) {
    const space = data.indexOf(0x20, offset);
    if (space === -1) fail(`${label} contains a malformed PAX record.`);
    const lengthText = data.subarray(offset, space).toString('ascii');
    if (!/^[1-9][0-9]*$/.test(lengthText)) fail(`${label} contains a malformed PAX length.`);
    const length = Number(lengthText);
    const end = offset + length;
    if (!Number.isSafeInteger(length) || end > data.length || data[end - 1] !== 0x0a) {
      fail(`${label} contains a truncated PAX record.`);
    }
    const record = data.subarray(space + 1, end - 1).toString('utf8');
    const equals = record.indexOf('=');
    if (equals < 1) fail(`${label} contains a malformed PAX key/value.`);
    result[record.slice(0, equals)] = record.slice(equals + 1);
    offset = end;
  }
  return result;
}
function parseTar(archivePath, manifest, label) {
  const archive = path.resolve(archivePath);
  const stat = fs.lstatSync(archive);
  if (!stat.isFile() || stat.isSymbolicLink()) fail(`${label} must be a regular non-symlink tar file.`);
  const data = fs.readFileSync(archive);
  if (data.length < 1024 || data.length % 512 !== 0) fail(`${label} is not a complete tar archive.`);
  const entries = new Map();
  let offset = 0;
  let zeroBlocks = 0;
  let globalPax = {};
  let nextPax = null;
  while (offset + 512 <= data.length) {
    const header = data.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) {
      zeroBlocks += 1;
      offset += 512;
      if (zeroBlocks >= 2) {
        if (!data.subarray(offset).every((byte) => byte === 0)) fail(`${label} has data after its tar terminator.`);
        break;
      }
      continue;
    }
    if (zeroBlocks > 0) fail(`${label} has a non-zero header after a zero tar block.`);
    const expectedChecksum = parseOctal(header.subarray(148, 156), `${label} checksum`);
    const checksumHeader = Buffer.from(header);
    checksumHeader.fill(0x20, 148, 156);
    const actualChecksum = checksumHeader.reduce((sum, byte) => sum + byte, 0);
    if (actualChecksum !== expectedChecksum) fail(`${label} has an invalid tar header checksum.`);
    const readString = (start, end) => header.subarray(start, end).toString('utf8').replace(/\0.*$/, '');
    const name = readString(0, 100);
    const prefix = readString(345, 500);
    const headerPath = prefix ? `${prefix}/${name}` : name;
    const mode = parseOctal(header.subarray(100, 108), `${label} mode`);
    const size = parseOctal(header.subarray(124, 136), `${label} size`);
    const type = String.fromCharCode(header[156] || 0x30);
    const dataStart = offset + 512;
    const dataEnd = dataStart + size;
    if (dataEnd > data.length) fail(`${label} contains a truncated tar entry.`);
    const payload = data.subarray(dataStart, dataEnd);
    offset = dataStart + Math.ceil(size / 512) * 512;
    if (type === 'g') {
      globalPax = { ...globalPax, ...parsePax(payload, `${label} global PAX`) };
      continue;
    }
    if (type === 'x') {
      if (nextPax) fail(`${label} contains stacked PAX headers.`);
      nextPax = parsePax(payload, `${label} entry PAX`);
      continue;
    }
    const pax = { ...globalPax, ...(nextPax || {}) };
    nextPax = null;
    const relativePath = normalizedRelativePath(pax.path || headerPath, `${label} tar entry`);
    if (hasForbiddenPrefix(relativePath, manifest.forbiddenPathPrefixes) ||
        (type !== '5' && hasForbiddenName(relativePath, manifest))) {
      fail(`${label} contains a generated/private/native/secret entry: ${relativePath}.`);
    }
    if (!['0', '5'].includes(type)) {
      fail(`${label} contains a link or special tar entry (${type}): ${relativePath}.`);
    }
    if (entries.has(relativePath)) fail(`${label} contains duplicate tar path: ${relativePath}.`);
    if (type === '5' && size !== 0) fail(`${label} directory has a non-zero payload: ${relativePath}.`);
    entries.set(relativePath, {
      path: relativePath,
      type: type === '5' ? 'directory' : 'file',
      mode: mode & 0o7777,
      data: type === '5' ? Buffer.alloc(0) : Buffer.from(payload),
    });
  }
  if (zeroBlocks < 2 || nextPax) fail(`${label} lacks a complete tar terminator/entry.`);
  return entries;
}
function runGit(args, options = {}) {
  const result = spawnSync('git', args, { cwd: rootDir, encoding: 'utf8', ...options });
  if (result.status !== 0) fail(`git ${args.join(' ')} failed: ${(result.stderr || result.stdout || '').trim()}`);
  return result;
}
function expectedEntriesForCommit(commit, manifest) {
  const resolved = runGit(['rev-parse', `${commit}^{commit}`]).stdout.trim();
  if (resolved !== commit) fail(`--commit does not resolve to the exact requested commit: ${commit}.`);
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'cavalry-source-reference-'));
  const archive = path.join(temp, 'expected.tar');
  try {
    runGit([
      'archive', '--format=tar', `--output=${archive}`, commit, '--', ...manifest.sourceArchivePaths,
    ]);
    return parseTar(archive, manifest, 'reference git archive');
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
}
function verifyMarker(entry, manifest, expectedCommit) {
  if (!entry || entry.type !== 'file' || (entry.mode & 0o111) !== 0) {
    fail(`Source artifact identity marker is missing, non-regular, or executable: ${manifest.artifactIdentity.markerPath}.`);
  }
  let marker;
  try { marker = JSON.parse(entry.data.toString('utf8')); }
  catch (error) { fail(`Artifact identity marker is not valid JSON: ${error.message}`); }
  if (marker.schemaVersion !== manifest.artifactIdentity.schemaVersion || marker.kind !== manifest.artifactIdentity.kind) {
    fail('Artifact identity marker kind/schemaVersion mismatch.');
  }
  if (marker.commitSha !== expectedCommit) {
    fail(`Artifact identity marker commitSha ${marker.commitSha || '<missing>'} != expected ${expectedCommit}.`);
  }
}
function verifyArchive(manifest, archive, expectedCommit) {
  if (!expectedCommit) fail('--archive requires --commit for exact tree verification.');
  const actual = parseTar(archive, manifest, 'source artifact');
  const marker = actual.get(manifest.artifactIdentity.markerPath);
  verifyMarker(marker, manifest, expectedCommit);
  actual.delete(manifest.artifactIdentity.markerPath);
  const expected = expectedEntriesForCommit(expectedCommit, manifest);
  const actualPaths = [...actual.keys()].sort();
  const expectedPaths = [...expected.keys()].sort();
  if (JSON.stringify(actualPaths) !== JSON.stringify(expectedPaths)) {
    const missing = expectedPaths.filter((entry) => !actual.has(entry));
    const extra = actualPaths.filter((entry) => !expected.has(entry));
    fail(`Source artifact tree differs from commit (missing: ${missing.join(', ') || 'none'}; extra: ${extra.join(', ') || 'none'}).`);
  }
  for (const [relativePath, frozen] of expected) {
    const candidate = actual.get(relativePath);
    if (
      candidate.type !== frozen.type || candidate.mode !== frozen.mode ||
      !candidate.data.equals(frozen.data)
    ) {
      fail(`Source artifact entry bytes/type/mode differ from commit: ${relativePath}.`);
    }
  }
  const missingRequired = manifest.requiredPaths.filter((relativePath) => !actual.has(relativePath));
  if (missingRequired.length > 0) fail(`Source artifact lacks required paths:\n- ${missingRequired.join('\n- ')}`);
}
function main() {
  const manifest = loadManifest();
  const commit = optionValue('--commit');
  if (commit && !/^[a-f0-9]{40}$/.test(commit)) fail('--commit must be a lowercase 40-char SHA.');
  if (args.includes('--check-schema') || args.length === 0 || args.includes('--check-repo')) {
    verifyRepoPaths(manifest);
    console.log('[verify-source-artifact] OK: repository required paths present');
  }
  if (args.includes('--check-workflow') || args.length === 0) {
    verifyWorkflowCoverage(manifest);
    console.log('[verify-source-artifact] OK: workflow source artifact coverage');
  }
  const archive = optionValue('--archive');
  if (archive) {
    verifyArchive(manifest, archive, commit);
    console.log(`[verify-source-artifact] OK: exact commit-bound tar ${path.resolve(archive)}`);
  } else if (commit) {
    fail('--commit requires --archive. Directory upload cannot preserve executable modes.');
  }
  if (optionValue('--dir')) fail('--dir is unsupported; use the mode-preserving tar --archive contract.');
}

try { main(); } catch (error) {
  console.error(`[verify-source-artifact] ${error.message}`);
  process.exit(1);
}
