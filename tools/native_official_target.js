/**
 * [INPUT]: 依赖规范化target原始bytes与当前Cavalry 2.8.1官方目标锁。
 * [OUTPUT]: 锁定当前2.8.1完整target bytes，包含catalog、runtime与schema source摘要。
 * [POS]: native source/provenance合同共用边界；任何target字段漂移都改变摘要或失败。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
'use strict';

const { createHash } = require('node:crypto');
const { isDeepStrictEqual } = require('node:util');

const OFFICIAL_TARGET_SHA256 = '8b2090aa6d0d3fc84d901f781be3b7c8184d784ec65cbb37f51c14b9958e87b0';
const OFFICIAL_FIELDS = Object.freeze([
  'schemaVersion', 'purpose', 'cavalryVersion', 'qtVersion', 'bundleId', 'executable',
  'executableSha256', 'nativeKeys', 'vendorJapaneseKeys', 'catalogs', 'runtimeFiles',
]);
const CURRENT_FIELDS = Object.freeze([
  ...OFFICIAL_FIELDS,
  'supplementalKeys', 'sourceFiles',
]);

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

function officialTargetSha256(targetBytes) {
  const target = parseCanonicalTarget(targetBytes);
  const projection = Object.fromEntries(OFFICIAL_FIELDS.map(field => [field, target[field]]));
  return sha256(Buffer.from(`${JSON.stringify(projection, null, 2)}\n`));
}

function assertOfficialTarget(targetBytes) {
  const target = parseCanonicalTarget(targetBytes);
  const digest = sha256(targetBytes);
  if (digest !== OFFICIAL_TARGET_SHA256) fail(`official target digest differs: ${digest}`);
  if (target.cavalryVersion !== '2.8.1') fail('version differs from the current production target');
  return { target, targetSha256: digest };
}

module.exports = { OFFICIAL_TARGET_SHA256, OFFICIAL_FIELDS, CURRENT_FIELDS, officialTargetSha256, assertOfficialTarget };
