/**
 * [INPUT]: 依赖锁定2.8 target、official target bytes投影和独立schema supplement target校验。
 * [OUTPUT]: 证明新增两字段不改旧官方摘要，同时runtime/catalog/count/identity漂移仍拒绝。
 * [POS]: native source/provenance共用边界合同；不更改旧批准模块、补充source或产品状态。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const { assertOfficialTarget, officialTargetSha256, OFFICIAL_TARGET_SHA256 } = require('./native_official_target');
const { assertCandidate281Target } = require('./native_official_target');

const TARGET_PATH = path.join(__dirname, 'cavalry_native_target.json');
const targetBytes = fs.readFileSync(TARGET_PATH);
const canonicalBytes = target => Buffer.from(`${JSON.stringify(target, null, 2)}\n`);

test('2.8.1 candidate has a separate exact source lock without admitting it as 2.8.0', () => {
  const bytes = fs.readFileSync(path.join(__dirname, 'cavalry_native_target_2_8_1.json'));
  const { target } = assertCandidate281Target(bytes);
  assert.equal(target.cavalryVersion, '2.8.1');
  assert.equal(target.nativeKeys, 10468);
  assert.equal(target.vendorJapaneseKeys, 390);
  assert.throws(() => assertOfficialTarget(bytes));
  assert.throws(() => assertCandidate281Target(targetBytes));
  for (const mutate of [
    t => { t.executableSha256 = 'a'.repeat(64); },
    t => { t.catalogs[0].sourceSha256 = 'b'.repeat(64); },
    t => { t.sourceFiles[0].sha256 = 'c'.repeat(64); },
  ]) {
    const changed = structuredClone(target); mutate(changed);
    assert.throws(() => assertCandidate281Target(canonicalBytes(changed)), /candidate target digest/);
  }
});

test('official target domain projects to the frozen pre-supplement SHA', () => {
  const result = assertOfficialTarget(targetBytes);
  assert.equal(result.officialTargetSha256, 'b6c6c6de1145035dc5ead1f21daf27d405de79fb70f430ecc828f6d09522be84');
  assert.equal(OFFICIAL_TARGET_SHA256, result.officialTargetSha256);
  assert.equal(officialTargetSha256(targetBytes), result.officialTargetSha256);
  assert.equal(result.target.nativeKeys, 10473);
  assert.equal(result.target.supplementalKeys, 373);
});

test('official runtime, catalog, key-count and installation identity mutations fail closed', () => {
  const mutations = [
    target => { target.runtimeFiles[0].sha256 = 'a'.repeat(64); },
    target => { target.catalogs[0].sourceSha256 = 'b'.repeat(64); },
    target => { target.nativeKeys += 1; },
    target => { target.bundleId = 'org.example.changed'; },
    target => { target.executableSha256 = 'c'.repeat(64); },
  ];
  for (const mutate of mutations) {
    const changed = JSON.parse(targetBytes.toString('utf8'));
    mutate(changed);
    assert.throws(() => assertOfficialTarget(canonicalBytes(changed)), /official target digest/i);
  }
  const unknownField = JSON.parse(targetBytes.toString('utf8'));
  unknownField.unreviewed = true;
  assert.throws(() => officialTargetSha256(canonicalBytes(unknownField)), /target fields/i);
  const nonCanonical = Buffer.from(targetBytes.toString('utf8').replaceAll('  ', '    '));
  assert.throws(() => officialTargetSha256(nonCanonical), /canonical/i);
});

test('supplement count and source identity are excluded only from official digest and checked separately', () => {
  const variants = [
    target => { target.supplementalKeys = 7; },
    target => { target.sourceFiles[0].path = 'Definitions/other.json'; },
    target => { target.sourceFiles[0].sha256 = 'd'.repeat(64); },
    target => { target.sourceFiles.push({ path: 'other.json', sha256: 'e'.repeat(64) }); },
  ];
  for (const mutate of variants) {
    const changed = JSON.parse(targetBytes.toString('utf8'));
    mutate(changed);
    const bytes = canonicalBytes(changed);
    assert.equal(officialTargetSha256(bytes), OFFICIAL_TARGET_SHA256,
      'only the two explicitly supplemental fields are omitted from the official digest');
    assert.throws(() => assertOfficialTarget(bytes), /supplement/i);
  }
});
