/**
 * [INPUT]: 2.8.0审批、冻结2.8.1源目标与AGY生成后经主代理复核的三语delta。
 * [OUTPUT]: 验证33条更新/新增、12条移除、source绑定与默认2.8.0复用边界。
 * [POS]: 原生版本增补行为合同，不授实屏或字体PASS。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { approvedEntries } = require('../languages/native/approved_modules');
const delta = require('../languages/native/release_2_8_1_delta');
const { assertNativeTranslationFormat } = require('./native_translation_format');

const legacy = approvedEntries('2.8.0');
const candidate = approvedEntries('2.8.1');
const legacyByKey = new Map(legacy.map(row => [row.key, row]));
const candidateByKey = new Map(candidate.map(row => [row.key, row]));
const deltaByKey = new Map(delta.entries.map(row => [row.key, row]));
const removedByKey = new Map(delta.removedEntries.map(row => [row.key, row]));

test('2.8.1 delta is source-bound to the frozen target and has full three-locale format coverage', () => {
  const targetPath = path.resolve(__dirname, 'cavalry_native_target_2_8_1.json');
  const targetBytes = fs.readFileSync(targetPath);
  const target = JSON.parse(targetBytes);
  const targetSha256 = crypto.createHash('sha256').update(targetBytes).digest('hex');

  assert.equal(delta.provenance.cavalryVersion, '2.8.1');
  assert.equal(delta.provenance.targetPath, 'tools/cavalry_native_target_2_8_1.json');
  assert.equal(delta.provenance.targetSha256, targetSha256);
  assert.equal(target.cavalryVersion, '2.8.1');
  assert.equal(target.nativeKeys, 10468);

  const targetCatalogs = new Map(target.catalogs.map(row => [row.id, row]));
  assert.deepEqual(delta.provenance.sourceCatalogs.map(row => row.catalogId).sort(), [
    'Definitions/Translation/appStrings',
    'Definitions/Translation/nodeStrings',
  ]);
  for (const row of delta.provenance.sourceCatalogs) {
    const catalog = targetCatalogs.get(row.catalogId);
    assert.ok(catalog, `delta catalog exists in 2.8.1 target: ${row.catalogId}`);
    assert.equal(row.sourcePath, catalog.source);
    assert.equal(row.sourceSha256, catalog.sourceSha256);
    assert.equal(row.japanesePath, catalog.japanese);
    assert.equal(row.japaneseSha256, catalog.japaneseSha256);
  }

  assert.equal(delta.entries.length, 33);
  assert.equal(deltaByKey.size, 33);
  assert.equal(delta.removedEntries.length, 12);
  assert.equal(removedByKey.size, 12);
  for (const row of delta.entries) {
    assert.ok(row.key);
    assert.equal(typeof row.source, 'string');
    assert.ok(Array.isArray(row.notes));
    assert.ok(Array.isArray(row.fieldPath));
    assert.ok(targetCatalogs.has(row.catalogId));
    assert.notEqual(row.dontTranslate, true);
    assert.deepEqual(Object.keys(row.translations).sort(), ['ja_JP', 'zh-Hans', 'zh-Hant']);
    for (const locale of ['zh-Hans', 'zh-Hant', 'ja_JP']) {
      assert.deepEqual(Object.keys(row.translations[locale]).sort(), ['decision', 'text']);
      assert.equal(row.translations[locale].decision, 'translate');
      assertNativeTranslationFormat(row.source, row.translations[locale].text);
    }
  }
});

test('2.8.1 replaces changed-source and metadata rows, adds seven keys, and removes twelve absent approvals', () => {
  const sourceChanged = [];
  const metadataChanged = [];
  const added = [];

  for (const row of delta.entries) {
    const previous = legacyByKey.get(row.key);
    if (!previous) added.push(row.key);
    else if (previous.source !== row.source) sourceChanged.push(row.key);
    else metadataChanged.push(row.key);
  }

  assert.equal(sourceChanged.length, 22);
  assert.equal(metadataChanged.length, 4);
  assert.equal(added.length, 7);
  assert.equal(delta.provenance.migration.sourceChanged, 22);
  assert.equal(delta.provenance.migration.metadataChanged, 4);
  assert.equal(delta.provenance.migration.newKeys, 7);
  assert.equal(delta.provenance.migration.removedKeys, 12);
  assert.equal(delta.provenance.migration.unapprovedDontTranslate, 95);

  for (const row of delta.entries) {
    assert.ok(candidateByKey.has(row.key), `candidate includes delta key ${row.key}`);
    assert.equal(candidateByKey.get(row.key), row);
  }
  for (const row of delta.removedEntries) {
    assert.deepEqual(row.source, legacyByKey.get(row.key)?.source);
    assert.ok(!candidateByKey.has(row.key), `candidate drops removed key ${row.key}`);
  }

  assert.equal(legacy.length, 10753);
  assert.equal(candidate.length, 10748);
  assert.equal(new Set(candidate.map(row => row.key)).size, candidate.length);
});

test('2.8.0 remains the default and other target versions fail closed', () => {
  assert.deepEqual(approvedEntries(), approvedEntries('2.8.0'));
  assert.equal(approvedEntries().length, 10753);
  assert.throws(() => approvedEntries('2.7.2'), /unsupported native approval target/);
  assert.throws(() => approvedEntries('2.8.2'), /unsupported native approval target/);
});
