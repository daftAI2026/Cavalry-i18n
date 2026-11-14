/**
 * [INPUT]: 依赖当前2.8.1官方target bytes及其完整SHA-256 source lock。
 * [OUTPUT]: 证明默认target精确绑定当前官方源、运行时、架构计数和schema source。
 * [POS]: native source/provenance合同；不保留并行2.8.0生产target。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const { assertOfficialTarget, OFFICIAL_TARGET_SHA256, CURRENT_FIELDS } = require('./native_official_target');

const TARGET_PATH = path.join(__dirname, 'cavalry_native_target.json');
const targetBytes = fs.readFileSync(TARGET_PATH);
const canonicalBytes = target => Buffer.from(`${JSON.stringify(target, null, 2)}\n`);

test('the default official target is the exact Cavalry 2.8.1 production lock', () => {
  const { target, targetSha256 } = assertOfficialTarget(targetBytes);
  assert.equal(target.cavalryVersion, '2.8.1');
  assert.equal(target.nativeKeys, 10468);
  assert.equal(target.catalogs.length, 17);
  assert.equal(target.vendorJapaneseKeys, 390);
  assert.equal(targetSha256, OFFICIAL_TARGET_SHA256);
  assert.equal(CURRENT_FIELDS.at(-1), 'sourceFiles');
});

test('any official catalog, runtime, source or installation identity change fails closed', () => {
  const mutations = [
    target => { target.runtimeFiles[0].sha256 = 'a'.repeat(64); },
    target => { target.catalogs[0].sourceSha256 = 'b'.repeat(64); },
    target => { target.sourceFiles[0].sha256 = 'c'.repeat(64); },
    target => { target.nativeKeys += 1; },
    target => { target.bundleId = 'org.example.changed'; },
    target => { target.cavalryVersion = '2.8.0'; },
  ];
  for (const mutate of mutations) {
    const changed = JSON.parse(targetBytes.toString('utf8'));
    mutate(changed);
    assert.throws(() => assertOfficialTarget(canonicalBytes(changed)), /official target digest/i);
  }
});

test('target schema and canonical bytes remain locked', () => {
  const unknownField = JSON.parse(targetBytes.toString('utf8'));
  unknownField.unreviewed = true;
  assert.throws(() => assertOfficialTarget(canonicalBytes(unknownField)), /target fields/i);
  const nonCanonical = Buffer.from(targetBytes.toString('utf8').replaceAll('  ', '    '));
  assert.throws(() => assertOfficialTarget(nonCanonical), /canonical/i);
});
