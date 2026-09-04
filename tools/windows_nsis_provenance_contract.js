/**
 * [INPUT]: 依赖 schemas/windows_nsis_provenance.schema.json 的版本、目标平台与精确对象结构
 * [OUTPUT]: 对外提供 Windows NSIS provenance 的唯一结构常量、生产文档构造器与 fail-closed 结构验证器
 * [POS]: tools 的跨边界协议真相层；producer 与 acceptance verifier 共享结构，双方仍各自复验真实文件与哈希
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
'use strict';

const schema = require('./schemas/windows_nsis_provenance.schema.json');

const SCHEMA_VERSION = schema.properties.schemaVersion.const;
const TARGET_TRIPLE = schema.properties.target.const;
const TOP_LEVEL_KEYS = Object.freeze([...schema.required]);
const FILE_IDENTITY_KEYS = Object.freeze([...schema.$defs.fileIdentity.required]);
const INPUT_FINGERPRINT_KEYS = Object.freeze([...schema.properties.inputFingerprint.required]);
const INPUT_IDENTITY_KEYS = Object.freeze([...schema.$defs.inputIdentity.required]);
const SHA256_PATTERN = new RegExp(schema.$defs.fileIdentity.properties.sha256.pattern);

function fail(message) {
  throw new Error(`Windows NSIS provenance contract: ${message}`);
}

function assertExactKeys(value, expected, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail(`${field} must be an object.`);
  }
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (JSON.stringify(actual) !== JSON.stringify(wanted)) {
    fail(`${field} keys mismatch: expected ${wanted.join(', ')}, got ${actual.join(', ')}.`);
  }
}

function assertNonEmptyString(value, field) {
  if (typeof value !== 'string' || value.length === 0) {
    fail(`${field} must be a non-empty string.`);
  }
}

function assertSha256(value, field) {
  if (typeof value !== 'string' || !SHA256_PATTERN.test(value)) {
    fail(`${field} must be lowercase 64-character hex.`);
  }
}

function assertSafeLeafName(value, field) {
  assertNonEmptyString(value, field);
  if (value.includes('/') || value.includes('\\') || value.includes('\0') || value === '.' || value === '..') {
    fail(`${field} must be a safe leaf filename.`);
  }
}

function validateFileIdentity(value, field) {
  assertExactKeys(value, FILE_IDENTITY_KEYS, field);
  assertSafeLeafName(value.fileName, `${field}.fileName`);
  if (!Number.isInteger(value.bytes) || value.bytes < 1) {
    fail(`${field}.bytes must be a positive integer.`);
  }
  assertSha256(value.sha256, `${field}.sha256`);
}

function validateInputIdentity(value, field) {
  assertExactKeys(value, INPUT_IDENTITY_KEYS, field);
  assertNonEmptyString(value.path, `${field}.path`);
  if (
    value.path.includes('\\') ||
    value.path.startsWith('/') ||
    /^[A-Za-z]:/.test(value.path) ||
    value.path.split('/').some((part) => part === '' || part === '.' || part === '..')
  ) {
    fail(`${field}.path must be a normalized repository-relative path.`);
  }
  if (!Number.isInteger(value.bytes) || value.bytes < 1) {
    fail(`${field}.bytes must be a positive integer.`);
  }
  assertSha256(value.sha256, `${field}.sha256`);
}

function validateWindowsNsisProvenance(value) {
  assertExactKeys(value, TOP_LEVEL_KEYS, 'provenance');
  if (value.schemaVersion !== SCHEMA_VERSION || value.target !== TARGET_TRIPLE) {
    fail(`target/schema mismatch; expected schema ${SCHEMA_VERSION} for ${TARGET_TRIPLE}.`);
  }
  assertNonEmptyString(value.productName, 'provenance.productName');
  assertNonEmptyString(value.version, 'provenance.version');
  validateFileIdentity(value.installer, 'provenance.installer');
  if (!/x64-setup\.exe$/i.test(value.installer.fileName)) {
    fail('provenance.installer.fileName must identify the Windows x64 NSIS installer.');
  }
  if (value.updaterSignature !== null) {
    validateFileIdentity(value.updaterSignature, 'provenance.updaterSignature');
    if (value.updaterSignature.fileName !== `${value.installer.fileName}.sig`) {
      fail('provenance.updaterSignature.fileName must be adjacent to the installer identity.');
    }
  }
  assertExactKeys(value.inputFingerprint, INPUT_FINGERPRINT_KEYS, 'provenance.inputFingerprint');
  if (value.inputFingerprint.algorithm !== 'sha256') {
    fail('provenance.inputFingerprint.algorithm must be sha256.');
  }
  assertSha256(value.inputFingerprint.value, 'provenance.inputFingerprint.value');
  if (!Array.isArray(value.inputFingerprint.files) || value.inputFingerprint.files.length < 1) {
    fail('provenance.inputFingerprint.files must be a non-empty array.');
  }
  const seen = new Set();
  let previousPath = null;
  value.inputFingerprint.files.forEach((entry, index) => {
    const field = `provenance.inputFingerprint.files[${index}]`;
    validateInputIdentity(entry, field);
    if (seen.has(entry.path)) {
      fail(`provenance.inputFingerprint.files contains duplicate path ${entry.path}.`);
    }
    if (previousPath !== null && previousPath.localeCompare(entry.path, 'en') >= 0) {
      fail('provenance.inputFingerprint.files must be strictly sorted by path.');
    }
    seen.add(entry.path);
    previousPath = entry.path;
  });
  return value;
}

function createWindowsNsisProvenance({ productName, version, installer, updaterSignature, inputFingerprint }) {
  return validateWindowsNsisProvenance({
    schemaVersion: SCHEMA_VERSION,
    target: TARGET_TRIPLE,
    productName,
    version,
    installer,
    updaterSignature,
    inputFingerprint,
  });
}

module.exports = {
  SCHEMA_VERSION,
  TARGET_TRIPLE,
  createWindowsNsisProvenance,
  validateWindowsNsisProvenance,
};
