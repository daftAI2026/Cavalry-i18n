/**
 * [INPUT]: 依赖规范化target原始bytes、冻结官方字段及Forge8与固定365缺源补充target合同。
 * [OUTPUT]: 单独锁定2.8.1候选完整目标摘要；提供保留旧b6c6官方域摘要的精确投影，不把两项补充元数据混入旧批准身份。
 * [POS]: native source/provenance合同共用边界；只排除已命名补充字段，其他target漂移一律改变摘要或失败。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
'use strict';

const { createHash } = require('node:crypto');
const { isDeepStrictEqual } = require('node:util');
const { assertSupplementTarget, SUPPLEMENT_KEY_COUNT } = require('./native_schema_supplement');
const { FIXED_GAP_LABELS } = require('./native_schema_gap_sources');

const OFFICIAL_TARGET_SHA256 = 'b6c6c6de1145035dc5ead1f21daf27d405de79fb70f430ecc828f6d09522be84';
const CANDIDATE_281_TARGET_SHA256 = 'e606fc03915d5763bfcf08bab6a61e6787fb53cec31415d124bc2b9c07cc9ac8';
const OFFICIAL_FIELDS = Object.freeze([
  'schemaVersion', 'purpose', 'cavalryVersion', 'qtVersion', 'bundleId', 'executable',
  'executableSha256', 'nativeKeys', 'vendorJapaneseKeys', 'catalogs', 'runtimeFiles',
]);
const CURRENT_FIELDS = Object.freeze([...OFFICIAL_FIELDS, 'supplementalKeys', 'sourceFiles']);

function fail(message) { throw new Error(`native target ${message}`); }
function sha256(bytes) { return createHash('sha256').update(bytes).digest('hex'); }

function parseCanonicalTarget(targetBytes) {
  if (!Buffer.isBuffer(targetBytes) && !(targetBytes instanceof Uint8Array)) {
    fail('input must be raw bytes');
  }
  const bytes = Buffer.from(targetBytes);
  let target;
  try { target = JSON.parse(bytes.toString('utf8')); }
  catch { fail('JSON is invalid'); }
  if (!target || typeof target !== 'object' || Array.isArray(target)) fail('must be an object');
  if (!isDeepStrictEqual(Object.keys(target), CURRENT_FIELDS)) fail('fields/order differ from the locked target schema');
  if (!Buffer.from(`${JSON.stringify(target, null, 2)}\n`).equals(bytes)) fail('bytes are not canonical JSON');
  return target;
}

function projectedOfficialBytes(target) {
  const official = Object.fromEntries(OFFICIAL_FIELDS.map(field => [field, target[field]]));
  return Buffer.from(`${JSON.stringify(official, null, 2)}\n`);
}

function officialTargetBytes(targetBytes) {
  return projectedOfficialBytes(parseCanonicalTarget(targetBytes));
}

function officialTargetSha256(targetBytes) {
  return sha256(officialTargetBytes(targetBytes));
}

function assertOfficialTarget(targetBytes) {
  const target = parseCanonicalTarget(targetBytes);
  assertSupplementTarget(target, SUPPLEMENT_KEY_COUNT + FIXED_GAP_LABELS.length);
  const digest = sha256(projectedOfficialBytes(target));
  if (digest !== OFFICIAL_TARGET_SHA256) fail(`official target digest differs: ${digest}`);
  return { target, officialTargetSha256: digest };
}

function assertCandidate281Target(targetBytes) {
  const target = parseCanonicalTarget(targetBytes);
  if (sha256(targetBytes) !== CANDIDATE_281_TARGET_SHA256)
    fail('2.8.1 candidate target digest differs');
  return { target, officialTargetSha256: sha256(projectedOfficialBytes(target)) };
}

module.exports = {
  OFFICIAL_TARGET_SHA256, OFFICIAL_FIELDS, officialTargetBytes,
  officialTargetSha256, assertOfficialTarget,
  assertCandidate281Target, CANDIDATE_281_TARGET_SHA256,
};
