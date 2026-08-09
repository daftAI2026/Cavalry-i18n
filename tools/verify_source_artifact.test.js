#!/usr/bin/env node
/**
 * [INPUT]: source artifact producer/verifier 与临时 git repository / tar mutations。
 * [OUTPUT]: 覆盖真实 commit-bound archive baseline，并证明 marker replay、文件 bytes、executable mode 与 link type 任一漂移均 fail-closed。
 * [POS]: source tar 的对抗回归测试；不依赖 GitHub artifact service，且不信任当前 dirty worktree。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const projectRoot = path.resolve(__dirname, '..');
function run(command, args, cwd) {
  return spawnSync(command, args, { cwd, encoding: 'utf8' });
}
function assertOk(result) { assert.equal(result.status, 0, result.stderr || result.stdout); }
function assertRejected(result, expected) {
  assert.notEqual(result.status, 0, result.stdout);
  assert.match(result.stderr, expected);
}
function setupRepo() {
  const outer = fs.mkdtempSync(path.join(os.tmpdir(), 'cavalry-source-tar-'));
  const repo = path.join(outer, 'repo');
  fs.mkdirSync(path.join(repo, 'tools', 'schemas'), { recursive: true });
  for (const file of ['create_source_artifact.js', 'verify_source_artifact.js']) {
    fs.copyFileSync(path.join(projectRoot, 'tools', file), path.join(repo, 'tools', file));
  }
  fs.copyFileSync(
    path.join(projectRoot, 'tools/schemas/source_artifact_manifest.schema.json'),
    path.join(repo, 'tools/schemas/source_artifact_manifest.schema.json')
  );
  const manifest = {
    schemaVersion: 1,
    kind: 'SourceArtifactManifest',
    requiredPaths: ['README.md', 'bin/run.sh'],
    sourceArchivePaths: ['README.md', 'bin'],
    artifactIdentity: {
      schemaVersion: 1,
      kind: 'CavalryI18nSourceArtifact',
      markerPath: '.cavalry-i18n-source-artifact.json',
    },
    forbiddenPathPrefixes: ['.git', 'node_modules', 'dist'],
    forbiddenFileExtensions: ['.dylib', '.exe', '.pem'],
    forbiddenFileNames: ['credentials.json', 'secrets.json'],
  };
  fs.writeFileSync(
    path.join(repo, 'tools/source_artifact_manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`
  );
  fs.mkdirSync(path.join(repo, 'bin'));
  fs.writeFileSync(path.join(repo, 'README.md'), 'commit-bound source\n');
  fs.writeFileSync(path.join(repo, 'bin/run.sh'), '#!/bin/sh\necho exact\n', { mode: 0o755 });
  assertOk(run('git', ['init', '-q'], repo));
  assertOk(run('git', ['config', 'user.name', 'Source Test'], repo));
  assertOk(run('git', ['config', 'user.email', 'source@example.invalid'], repo));
  assertOk(run('git', ['add', '.'], repo));
  assertOk(run('git', ['commit', '-qm', 'fixture'], repo));
  const commitResult = run('git', ['rev-parse', 'HEAD'], repo);
  assertOk(commitResult);
  const commit = commitResult.stdout.trim();
  const archive = path.join(outer, 'source.tar');
  const create = run(process.execPath, [
    path.join(repo, 'tools/create_source_artifact.js'),
    '--commit', commit,
    '--output', archive,
  ], repo);
  assertOk(create);
  return { outer, repo, commit, archive };
}
function tarEntry(buffer, wanted) {
  let offset = 0;
  while (offset + 512 <= buffer.length) {
    const header = buffer.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) break;
    const text = (start, end) => header.subarray(start, end).toString('utf8').replace(/\0.*$/, '');
    const name = text(0, 100);
    const prefix = text(345, 500);
    const entryPath = prefix ? `${prefix}/${name}` : name;
    const size = Number.parseInt(text(124, 136).trim() || '0', 8);
    if (entryPath === wanted) return { headerOffset: offset, dataOffset: offset + 512, size };
    offset += 512 + Math.ceil(size / 512) * 512;
  }
  throw new Error(`tar entry not found: ${wanted}`);
}
function rewriteHeaderChecksum(buffer, headerOffset) {
  const header = buffer.subarray(headerOffset, headerOffset + 512);
  header.fill(0x20, 148, 156);
  const sum = header.reduce((total, byte) => total + byte, 0);
  const encoded = Buffer.from(`${sum.toString(8).padStart(6, '0')}\0 `, 'ascii');
  encoded.copy(header, 148);
}
function verify(fixture, archive) {
  return run(process.execPath, [
    path.join(fixture.repo, 'tools/verify_source_artifact.js'),
    '--archive', archive,
    '--commit', fixture.commit,
  ], fixture.repo);
}

test('producer emits a mode-preserving tar exactly bound to the requested git commit', () => {
  const fixture = setupRepo();
  try {
    assertOk(verify(fixture, fixture.archive));
    const second = path.join(fixture.outer, 'second.tar');
    assertOk(run(process.execPath, [
      path.join(fixture.repo, 'tools/create_source_artifact.js'),
      '--commit', fixture.commit,
      '--output', second,
    ], fixture.repo));
    assert.deepEqual(fs.readFileSync(second), fs.readFileSync(fixture.archive));
  } finally { fs.rmSync(fixture.outer, { recursive: true, force: true }); }
});

test('marker replay and self-consistent-looking file bytes cannot replace commit tree verification', () => {
  const fixture = setupRepo();
  try {
    const replay = Buffer.from(fs.readFileSync(fixture.archive));
    const marker = tarEntry(replay, '.cavalry-i18n-source-artifact.json');
    const markerText = replay.subarray(marker.dataOffset, marker.dataOffset + marker.size).toString('utf8');
    const otherCommit = 'f'.repeat(40);
    assert.equal(markerText.includes(fixture.commit), true);
    replay.write(markerText.replace(fixture.commit, otherCommit), marker.dataOffset, marker.size, 'utf8');
    const replayPath = path.join(fixture.outer, 'replay.tar');
    fs.writeFileSync(replayPath, replay);
    assertRejected(verify(fixture, replayPath), /commitSha .* != expected/);

    const tampered = Buffer.from(fs.readFileSync(fixture.archive));
    const readme = tarEntry(tampered, 'README.md');
    tampered[readme.dataOffset] ^= 0x01;
    const tamperedPath = path.join(fixture.outer, 'tampered.tar');
    fs.writeFileSync(tamperedPath, tampered);
    assertRejected(verify(fixture, tamperedPath), /bytes\/type\/mode differ from commit: README\.md/);
  } finally { fs.rmSync(fixture.outer, { recursive: true, force: true }); }
});

test('executable mode drift and link substitution are rejected from the tar itself', () => {
  const fixture = setupRepo();
  try {
    const modeDrift = Buffer.from(fs.readFileSync(fixture.archive));
    const executable = tarEntry(modeDrift, 'bin/run.sh');
    Buffer.from('0000644\0', 'ascii').copy(modeDrift, executable.headerOffset + 100);
    rewriteHeaderChecksum(modeDrift, executable.headerOffset);
    const modePath = path.join(fixture.outer, 'mode.tar');
    fs.writeFileSync(modePath, modeDrift);
    assertRejected(verify(fixture, modePath), /bytes\/type\/mode differ from commit: bin\/run\.sh/);

    const linked = Buffer.from(fs.readFileSync(fixture.archive));
    const linkedEntry = tarEntry(linked, 'README.md');
    linked[linkedEntry.headerOffset + 156] = '2'.charCodeAt(0);
    rewriteHeaderChecksum(linked, linkedEntry.headerOffset);
    const linkPath = path.join(fixture.outer, 'link.tar');
    fs.writeFileSync(linkPath, linked);
    assertRejected(verify(fixture, linkPath), /link or special tar entry/);
  } finally { fs.rmSync(fixture.outer, { recursive: true, force: true }); }
});
