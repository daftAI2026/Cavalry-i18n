#!/usr/bin/env node
/**
 * [INPUT]: record_toolchain_evidence.js、create_toolchain_evidence_bundle.js、当前工具链与临时 record fixtures
 * [OUTPUT]: 覆盖跨平台 npm 版本 capture、命令缺失 fail-closed、三 producer/commit/target 完整聚合及 Windows 未覆盖面的显式 issue 声明
 * [POS]: release toolchain evidence producer/aggregator 的离线回归测试
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const commit = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).stdout.trim();
const createdAt = spawnSync('git', ['show', '-s', '--format=%cI', commit], { cwd: root, encoding: 'utf8' }).stdout.trim();

function record(output, scope = 'source-contracts', target = 'source-contracts', env = process.env) {
  return spawnSync(process.execPath, [path.join(root, 'tools/record_toolchain_evidence.js'),
    '--commit', commit, '--created-at', createdAt, '--scope', scope, '--target', target, '--output', output,
  ], { cwd: root, encoding: 'utf8', env });
}
function bundle(files, output, releaseCommit = commit) {
  return spawnSync(process.execPath, [path.join(root, 'tools/create_toolchain_evidence_bundle.js'),
    '--release-commit', releaseCommit, '--windows-asset', 'windows.exe', '--output', output,
    ...files.flatMap((file) => ['--record', file]),
  ], { cwd: root, encoding: 'utf8' });
}

test('recording fails closed when a required version command cannot run', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'cavalry-toolchain-fail-'));
  try {
    const result = record(path.join(temp, 'record.json'), 'source-contracts', 'source-contracts', {
      ...process.env,
      PATH: '/nonexistent',
      npm_execpath: '',
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /required npm toolchain identity/i);
    assert.equal(fs.existsSync(path.join(temp, 'record.json')), false);
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
});

test('bundle requires exact producer scopes, successful captures, and one release commit', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'cavalry-toolchain-bundle-'));
  try {
    const specs = [
      ['source-contracts', 'source-contracts'],
      ['macos-aarch64', 'aarch64-apple-darwin'],
      ['macos-x64', 'x86_64-apple-darwin'],
    ];
    const files = specs.map(([scope, target]) => {
      const file = path.join(temp, `${scope}.json`);
      const result = record(file, scope, target);
      assert.equal(result.status, 0, result.stderr || result.stdout);
      return file;
    });
    const output = path.join(temp, 'bundle.json');
    const result = bundle(files, output);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const value = JSON.parse(fs.readFileSync(output, 'utf8'));
    assert.equal(value.releaseCommitSha, commit);
    assert.deepEqual(value.records.map((recordValue) => recordValue.scope), ['macos-aarch64', 'macos-x64', 'source-contracts']);
    assert.equal(value.uncoveredArtifacts[0].platform, 'windows-x64');
    assert.equal(value.uncoveredArtifacts[0].status, 'tracked-as-issue');
    const mismatch = bundle(files, path.join(temp, 'mismatch.json'), 'b'.repeat(40));
    assert.notEqual(mismatch.status, 0);
    assert.match(mismatch.stderr, /does not bind release commit/);
    const hollow = JSON.parse(fs.readFileSync(files[0], 'utf8'));
    hollow.runtime.cargo.stdout = '';
    fs.chmodSync(files[0], 0o644);
    fs.writeFileSync(files[0], `${JSON.stringify(hollow)}\n`);
    const hollowResult = bundle(files, path.join(temp, 'hollow.json'));
    assert.notEqual(hollowResult.status, 0);
    assert.match(hollowResult.stderr, /hollow cargo capture/);
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
});
