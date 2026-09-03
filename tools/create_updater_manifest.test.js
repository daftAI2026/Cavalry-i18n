#!/usr/bin/env node
/**
 * [INPUT]: 依赖 create_updater_manifest.js、临时 updater artifacts/签名与仓库 release 元数据
 * [OUTPUT]: 覆盖确定性三平台 manifest、SemVer 与 latest.json 命名、artifact/signature 错配及 symlink 输入失败关闭
 * [POS]: tools 的 updater manifest 离线对抗测试；使用伪签名字节，不读取真实私钥、不联网、不触碰 Release
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { loadConfig, metadataForTag } = require('./release_metadata');

const repoRoot = path.resolve(__dirname, '..');
const tag = 'cavalry-2.7.2-p999';

function fixture() {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cavalry-updater-manifest-')));
  const metadata = metadataForTag(loadConfig(), tag);
  const files = {
    arm: path.join(root, metadata.RELEASE_UPDATER_ASSET_NAME_AARCH64),
    intel: path.join(root, metadata.RELEASE_UPDATER_ASSET_NAME_X64),
    windows: path.join(root, metadata.RELEASE_ASSET_NAME_WINDOWS_X64),
  };
  const signatures = {};
  for (const [key, file] of Object.entries(files)) {
    fs.writeFileSync(file, `artifact-${key}\n`);
    signatures[key] = `${file}.sig`;
    fs.writeFileSync(signatures[key], `${Buffer.from(`signature-${key}`).toString('base64')}\n`);
  }
  const notes = path.join(root, 'notes.md');
  fs.writeFileSync(notes, 'Updater notes\r\nsecond line\r\n');
  return {
    root,
    metadata,
    files,
    signatures,
    notes,
    output: path.join(root, metadata.RELEASE_UPDATER_MANIFEST_NAME),
  };
}

function run(f, overrides = {}) {
  const values = {
    '--tag': tag,
    '--output': f.output,
    '--notes': f.notes,
    '--pub-date': '2026-08-28T08:30:00+08:00',
    '--darwin-aarch64': f.files.arm,
    '--darwin-aarch64-signature': f.signatures.arm,
    '--darwin-x86_64': f.files.intel,
    '--darwin-x86_64-signature': f.signatures.intel,
    '--windows-x86_64': f.files.windows,
    '--windows-x86_64-signature': f.signatures.windows,
    ...overrides,
  };
  return spawnSync(process.execPath, [
    path.join(repoRoot, 'tools/create_updater_manifest.js'),
    ...Object.entries(values).flat(),
  ], { cwd: repoRoot, encoding: 'utf8' });
}

test('writes a deterministic latest.json with exact Tauri platform keys and signed release URLs', () => {
  const f = fixture();
  try {
    const result = run(f);
    assert.equal(result.status, 0, result.stderr);
    const manifest = JSON.parse(fs.readFileSync(f.output, 'utf8'));
    assert.equal(manifest.version, require('../package.json').version);
    assert.equal(manifest.notes, 'Updater notes\nsecond line');
    assert.equal(manifest.pub_date, '2026-08-28T00:30:00.000Z');
    assert.deepEqual(Object.keys(manifest.platforms), [
      'darwin-aarch64',
      'darwin-x86_64',
      'windows-x86_64',
    ]);
    assert.equal(
      manifest.platforms['darwin-aarch64'].url,
      `${f.metadata.RELEASE_UPDATER_DOWNLOAD_BASE_URL}/${f.metadata.RELEASE_UPDATER_ASSET_NAME_AARCH64}`
    );
    assert.equal(
      manifest.platforms['windows-x86_64'].url,
      `${f.metadata.RELEASE_UPDATER_DOWNLOAD_BASE_URL}/${f.metadata.RELEASE_ASSET_NAME_WINDOWS_X64}`
    );
    assert.equal(
      manifest.platforms['darwin-x86_64'].signature,
      Buffer.from('signature-intel').toString('base64')
    );
    const firstBytes = fs.readFileSync(f.output, 'utf8');
    const rerun = run(f);
    assert.equal(rerun.status, 0, rerun.stderr);
    assert.equal(fs.readFileSync(f.output, 'utf8'), firstBytes);
  } finally {
    fs.rmSync(f.root, { recursive: true, force: true });
  }
});

test('fails closed on wrong manifest/artifact/signature names and malformed signature bytes', () => {
  const cases = [
    { overrides: { '--output': '/tmp/not-latest.json' }, expected: /must be named latest\.json/ },
    { overrides: { '--darwin-aarch64': __filename }, expected: /artifact must be named/ },
    { overrides: { '--windows-x86_64-signature': __filename }, expected: /signature must be named/ },
  ];
  for (const entry of cases) {
    const f = fixture();
    try {
      const result = run(f, entry.overrides);
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, entry.expected);
    } finally {
      fs.rmSync(f.root, { recursive: true, force: true });
    }
  }

  const malformed = fixture();
  try {
    fs.writeFileSync(malformed.signatures.windows, 'not a signature\n');
    const result = run(malformed);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /base64 Tauri updater signature/);
  } finally {
    fs.rmSync(malformed.root, { recursive: true, force: true });
  }
});

test('rejects symlink artifact and signature inputs', { skip: process.platform === 'win32' }, () => {
  const f = fixture();
  try {
    const realArtifact = `${f.files.arm}.real`;
    fs.renameSync(f.files.arm, realArtifact);
    fs.symlinkSync(realArtifact, f.files.arm);
    const artifactResult = run(f);
    assert.notEqual(artifactResult.status, 0);
    assert.match(artifactResult.stderr, /non-empty regular file/);

    fs.unlinkSync(f.files.arm);
    fs.renameSync(realArtifact, f.files.arm);
    const realSignature = `${f.signatures.arm}.real`;
    fs.renameSync(f.signatures.arm, realSignature);
    fs.symlinkSync(realSignature, f.signatures.arm);
    const signatureResult = run(f);
    assert.notEqual(signatureResult.status, 0);
    assert.match(signatureResult.stderr, /non-empty regular file/);
  } finally {
    fs.rmSync(f.root, { recursive: true, force: true });
  }
});
