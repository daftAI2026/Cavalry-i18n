/**
 * [INPUT]: 依赖 packaged_native_resources 的纯校验接口与临时manifest/payload fixture。
 * [OUTPUT]: 锁定2.8.1架构中立资源树与arm64/x86_64目标runtime嵌入校验。
 * [POS]: tools packaged检查的离线合同；不启动Tauri、不读App或用户状态。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  verifyEmbeddedRuntime,
  verifyNativePackBundle,
} = require('./packaged_native_resources');

const LANGUAGES = ['zh-Hans', 'zh-Hant', 'ja_JP'];
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

function writePackTree(root, { kind = 'production-2.8', complete = true } = {}) {
  fs.mkdirSync(root, { recursive: true });
  const packs = {};
  for (const language of LANGUAGES) {
    const bytes = Buffer.from(`approved pack ${language}`);
    const file = `${language}.json`;
    fs.writeFileSync(path.join(root, file), bytes);
    packs[language] = {
      file,
      bytes: bytes.length,
      sha256: sha256(bytes),
      reviewed: 1,
      preserved: 0,
      vendor: 0,
      missing: complete ? 0 : 1,
    };
  }
  const manifest = {
    schemaVersion: 1,
    kind,
    cavalryVersion: '2.8.1',
    nativeKeys: complete ? 1 : 2,
    complete,
    packs,
  };
  fs.writeFileSync(path.join(root, 'manifest.json'), `${JSON.stringify(manifest)}\n`);
  return manifest;
}

function withPackTrees(run, options) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cavalry-packaged-native-'));
  const sourceRoot = path.join(root, 'source');
  const packagedRoot = path.join(root, 'packaged');
  try {
    writePackTree(sourceRoot, options);
    writePackTree(packagedRoot, options);
    return run({ sourceRoot, packagedRoot });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

test('production pack receipt binds architecture-neutral locale bytes to the build input', () => {
  withPackTrees(({ sourceRoot, packagedRoot }) => {
    const arm64 = verifyNativePackBundle({ sourceRoot, packagedRoot });
    const x86_64 = verifyNativePackBundle({ sourceRoot, packagedRoot, targetArch: 'x86_64' });
    assert.equal(arm64.checkedAppArch, 'arm64');
    assert.equal(x86_64.checkedAppArch, 'x86_64');
    assert.equal(x86_64.kind, 'production-2.8');
    assert.equal(x86_64.complete, true);
    assert.deepEqual(Object.keys(x86_64.packs).sort(), [...LANGUAGES].sort());
    assert.deepEqual(x86_64.manifest, arm64.manifest, 'the native pack manifest stays architecture-neutral');
    assert.deepEqual(x86_64.packs, arm64.packs, 'the locale payload hashes stay architecture-neutral');
  });
});

test('production pack receipt rejects wrong profile, incomplete coverage, and payload drift', () => {
  withPackTrees(({ sourceRoot, packagedRoot }) => {
    writePackTree(sourceRoot, { kind: 'development-preview' });
    writePackTree(packagedRoot, { kind: 'development-preview' });
    assert.throws(() => verifyNativePackBundle({ sourceRoot, packagedRoot }), /production-2\.8/i);
  });
  withPackTrees(({ sourceRoot, packagedRoot }) => {
    writePackTree(sourceRoot, { complete: false });
    writePackTree(packagedRoot, { complete: false });
    assert.throws(() => verifyNativePackBundle({ sourceRoot, packagedRoot }), /complete/i);
  });
  withPackTrees(({ sourceRoot, packagedRoot }) => {
    fs.appendFileSync(path.join(packagedRoot, 'ja_JP.json'), 'drift');
    assert.throws(() => verifyNativePackBundle({ sourceRoot, packagedRoot }), /payload|digest|match/i);
  });
});

test('production runtime receipt binds the selected arm64 or x86_64 slice', () => {
  const makeDylib = (cpuType, label) => {
    const dylib = Buffer.alloc(40);
    dylib.writeUInt32LE(0xfeedfacf, 0);
    dylib.writeUInt32LE(cpuType, 4);
    dylib.write(label, 8);
    return dylib;
  };
  const arm64 = makeDylib(0x0100000c, 'arm64 runtime fixture');
  const arm64Executable = Buffer.concat([Buffer.from('prefix'), arm64, Buffer.from('suffix')]);
  assert.deepEqual(verifyEmbeddedRuntime({ executableBytes: arm64Executable, runtimeBytes: arm64 }), {
    sha256: sha256(arm64), bytes: arm64.length, architectures: ['arm64'],
  });

  const x64 = makeDylib(0x01000007, 'x86_64 runtime fixture');
  const x64Executable = Buffer.concat([Buffer.from('prefix'), x64, Buffer.from('suffix')]);
  assert.deepEqual(verifyEmbeddedRuntime({
    executableBytes: x64Executable,
    runtimeBytes: x64,
    targetArch: 'x86_64',
  }), { sha256: sha256(x64), bytes: x64.length, architectures: ['x86_64'] });
  assert.throws(() => verifyEmbeddedRuntime({
    executableBytes: x64Executable, runtimeBytes: x64, targetArch: 'arm64',
  }), /arm64/i);
  assert.throws(() => verifyEmbeddedRuntime({
    executableBytes: arm64Executable, runtimeBytes: arm64, targetArch: 'riscv64',
  }), /unsupported macOS target architecture/i);
  assert.throws(() => verifyEmbeddedRuntime({
    executableBytes: arm64Executable, runtimeBytes: Buffer.from('not Mach-O'),
  }), /Mach-O/i);
  assert.throws(() => verifyEmbeddedRuntime({
    executableBytes: Buffer.from('different executable'),
    runtimeBytes: arm64,
  }), /embedded/i);
});
