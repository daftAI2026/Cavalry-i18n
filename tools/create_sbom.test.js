#!/usr/bin/env node
/**
 * [INPUT]: create_sbom.js、锁文件与临时输出目录。
 * [OUTPUT]: 覆盖 deterministic CycloneDX identity、npm lock v3 name 推导、Cargo/npm 完整组件集、排序与拒绝覆盖既有产物。
 * [POS]: 发布 SBOM producer 的离线回归测试。
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
function make(output) {
  return spawnSync(process.execPath, [path.join(root, 'tools/create_sbom.js'), '--tag', 'cavalry-2.7.2-p999', '--release-commit', commit, '--output', output], { cwd: root, encoding: 'utf8' });
}
test('CycloneDX SBOM is deterministic, commit-bound, sorted, and cannot overwrite', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'cavalry-sbom-'));
  try {
    const first = path.join(temp, 'one.json');
    const second = path.join(temp, 'two.json');
    assert.equal(make(first).status, 0);
    assert.equal(make(second).status, 0);
    assert.deepEqual(fs.readFileSync(first), fs.readFileSync(second));
    const bom = JSON.parse(fs.readFileSync(first, 'utf8'));
    assert.equal(bom.bomFormat, 'CycloneDX');
    assert.equal(bom.specVersion, '1.5');
    assert.equal(bom.metadata.component.properties.find((p) => p.name === 'cavalry-i18n:release-commit').value, commit);
    assert.deepEqual(bom.components.map((item) => item.purl), [...bom.components.map((item) => item.purl)].sort());
    const npmPurls = bom.components.filter((item) => item.purl.startsWith('pkg:npm/')).map((item) => item.purl);
    const cargoPurls = bom.components.filter((item) => item.purl.startsWith('pkg:cargo/')).map((item) => item.purl);
    const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
    const expectedNpmCount = Object.entries(lock.packages || {})
      .filter(([location, value]) => location && value?.version && !value?.link).length;
    const expectedCargoCount = fs.readFileSync(path.join(root, 'src-tauri/Cargo.lock'), 'utf8')
      .split('[[package]]').slice(1)
      .filter((block) => /^name = "[^"]+"/m.test(block) && /^version = "[^"]+"/m.test(block)).length;
    assert.equal(npmPurls.length, expectedNpmCount, 'every package-lock v3 dependency must appear in the SBOM');
    assert.equal(cargoPurls.length, expectedCargoCount, 'every Cargo.lock package must appear in the SBOM');
    assert.ok(npmPurls.length > 0, 'the npm component set must not be hollow');
    assert.ok(cargoPurls.length > 0, 'the Cargo component set must not be hollow');
    assert.ok(npmPurls.some((purl) => purl.startsWith('pkg:npm/%40tauri-apps/api@')));
    const overwrite = make(first);
    assert.notEqual(overwrite.status, 0);
    assert.match(overwrite.stderr, /EEXIST/);
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
});
