/**
 * [INPUT]: 依赖生成期native_resource_bundle profile validator、构建包路径、resource输入树、目标架构和批准runtime字节。
 * [OUTPUT]: 校验Cavalry 2.8.1 production架构中立manifest/payload与目标架构runtime内嵌摘要。
 * [POS]: packaged检查共享的纯文件合同；不生成资源、不启动App、不修改build输入。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
'use strict';

const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { validateResourceProfile } = require('./native_resource_bundle');

const LANGUAGES = Object.freeze(['zh-Hans', 'zh-Hant', 'ja_JP']);
const CPU_TYPE_BY_ARCH = Object.freeze({ arm64: 0x0100000c, x86_64: 0x01000007 });

function normalizeTargetArch(targetArch = 'arm64') {
  const normalized = targetArch === 'aarch64' ? 'arm64' : targetArch;
  assert.ok(Object.hasOwn(CPU_TYPE_BY_ARCH, normalized), `unsupported macOS target architecture: ${targetArch}`);
  return normalized;
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function readRegularFile(root, name) {
  const filePath = path.join(root, name);
  const metadata = fs.lstatSync(filePath);
  assert.ok(metadata.isFile() && !metadata.isSymbolicLink(), `${filePath} must be a regular file`);
  return fs.readFileSync(filePath);
}

function verifyNativePackBundle({ sourceRoot, packagedRoot, targetArch = 'arm64' }) {
  const selectedArch = normalizeTargetArch(targetArch);
  const sourceManifestBytes = readRegularFile(sourceRoot, 'manifest.json');
  const packagedManifestBytes = readRegularFile(packagedRoot, 'manifest.json');
  assert.ok(packagedManifestBytes.equals(sourceManifestBytes), 'packaged native manifest differs from build input');

  const manifest = JSON.parse(packagedManifestBytes.toString('utf8'));
  validateResourceProfile(manifest, 'production-2.8');
  assert.equal(manifest.schemaVersion, 1, 'native resource schema differs');
  assert.equal(manifest.cavalryVersion, '2.8.1', 'native resource target version differs');
  assert.equal(manifest.complete, true, 'production native resource profile must be complete');
  assert.deepEqual(
    Object.keys(manifest.packs).sort(),
    [...LANGUAGES].sort(),
    'production native manifest must contain exactly the three product languages'
  );

  const packs = {};
  for (const language of LANGUAGES) {
    const info = manifest.packs[language];
    assert.equal(info.file, `${language}.json`, `${language} pack path differs`);
    const sourceBytes = readRegularFile(sourceRoot, info.file);
    const packagedBytes = readRegularFile(packagedRoot, info.file);
    assert.equal(sourceBytes.length, info.bytes, `${language} source pack length differs from manifest`);
    assert.equal(sha256(sourceBytes), info.sha256, `${language} source pack digest differs from manifest`);
    assert.ok(packagedBytes.equals(sourceBytes), `${language} packaged payload differs from build input`);
    packs[language] = { bytes: packagedBytes.length, sha256: sha256(packagedBytes) };
  }

  return {
    checkedAppArch: selectedArch,
    kind: manifest.kind,
    cavalryVersion: manifest.cavalryVersion,
    complete: manifest.complete,
    manifest: { bytes: packagedManifestBytes.length, sha256: sha256(packagedManifestBytes) },
    packs,
  };
}

function machoArchitectures(bytes) {
  assert.ok(Buffer.isBuffer(bytes) && bytes.length >= 8, 'runtime must contain a Mach-O header');
  const littleMagic = bytes.readUInt32LE(0);
  const bigMagic = bytes.readUInt32BE(0);
  if (littleMagic === 0xfeedfacf) {
    return [bytes.readUInt32LE(4)];
  }
  if (bigMagic === 0xfeedfacf) {
    return [bytes.readUInt32BE(4)];
  }

  const fatEndian = bigMagic === 0xcafebabe || bigMagic === 0xcafebabf ? 'BE'
    : bigMagic === 0xbebafeca || bigMagic === 0xbfbafeca ? 'LE' : '';
  assert.ok(fatEndian, 'runtime must be a 64-bit Mach-O or universal Mach-O');
  const fat64 = bigMagic === 0xcafebabf || bigMagic === 0xbfbafeca;
  const readU32 = fatEndian === 'BE' ? (offset) => bytes.readUInt32BE(offset) : (offset) => bytes.readUInt32LE(offset);
  const count = readU32(4);
  const entrySize = fat64 ? 32 : 20;
  assert.ok(count > 0 && 8 + count * entrySize <= bytes.length, 'universal Mach-O architecture table is truncated');
  return Array.from({ length: count }, (_, index) => readU32(8 + index * entrySize));
}

function verifyEmbeddedRuntime({ executableBytes, runtimeBytes, targetArch = 'arm64' }) {
  assert.ok(Buffer.isBuffer(executableBytes), 'packaged executable bytes are required');
  assert.ok(Buffer.isBuffer(runtimeBytes) && runtimeBytes.length > 0, 'approved runtime bytes are required');
  const selectedArch = normalizeTargetArch(targetArch);
  const architectures = machoArchitectures(runtimeBytes);
  assert.ok(
    architectures.includes(CPU_TYPE_BY_ARCH[selectedArch]),
    `approved runtime must contain a ${selectedArch} Mach-O slice`
  );
  const actualSha256 = sha256(runtimeBytes);
  assert.ok(executableBytes.includes(runtimeBytes), 'approved runtime bytes are not embedded in the packaged executable');
  return { bytes: runtimeBytes.length, sha256: actualSha256, architectures: [selectedArch] };
}

module.exports = { verifyEmbeddedRuntime, verifyNativePackBundle };
