/**
 * [INPUT]: 依赖 packaged handoff session 的 manifest、checkpoint、seal 数据与固定路径/阶段约定；不执行文件系统或系统命令。
 * [OUTPUT]: 对外提供 R5 的阶段词汇、版本常量、参数合同及 manifest/checkpoint/retry 验证器。
 * [POS]: macos-handoff-acceptance 的纯合同层；为 record_checkpoint 提供稳定的数据边界，避免 producer 同时承担协议定义与现场采集。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
'use strict';

const path = require('node:path');

const MANIFEST_SCHEMA = 3;
const CHECKPOINT_SCHEMA = 2;
const SEAL_SCHEMA = 3;
const RETRY_VERIFICATION_SCHEMA = 1;
const READ_ONLY_SCENARIO = 'read-only-baseline';
const CAVALRY_RUNTIME_EXECUTABLE = 'Cavalry';
const CAVALRY_LANGUAGE_MARKER = 'cavalry-i18n-lang.txt';
const CAVALRY_INJECTOR = 'libCavalryTranslatorInjector.dylib';
const APP_DATA_DIRECTORY = 'com.daftai.cavalry-i18n';
const SUPPORTED_LANGUAGES = new Set(['en', 'zh-Hans', 'zh-Hant', 'ja_JP']);
const OPERATION_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const EXPECTED_FIELDS = Object.freeze([
  Object.freeze({ key: 'sourceCommit', argument: 'expected-source-commit', label: '--expected-source-commit' }),
  Object.freeze({ key: 'switcherExecutableSha256', argument: 'expected-switcher-executable-sha256', label: '--expected-switcher-executable-sha256' }),
  Object.freeze({ key: 'cavalryExecutableSha256', argument: 'expected-cavalry-executable-sha256', label: '--expected-cavalry-executable-sha256' }),
  Object.freeze({ key: 'cavalryRuntimeSha256', argument: 'expected-cavalry-runtime-sha256', label: '--expected-cavalry-runtime-sha256' }),
  Object.freeze({ key: 'vendorTeamId', argument: 'expected-vendor-team-id', label: '--expected-vendor-team-id' }),
  Object.freeze({ key: 'language', argument: 'expected-language', label: '--expected-language' }),
]);
const VALUE_ARGUMENTS = new Set([
  'session-dir', 'switcher-app', 'cavalry-app', 'scenario', 'checkpoint',
  ...EXPECTED_FIELDS.map(({ argument }) => argument),
]);
const BOOLEAN_ARGUMENTS = new Set(['initialize', 'seal', 'verify']);
const PERMISSION_BLOCKED_ASSERTION =
  'Only the real Switcher UI was observed; this checkpoint records no permission truth.';
const OBSERVATION_CONTRACT = Object.freeze({ switcherOnly: true, permissionState: 'not-recorded' });
const SCENARIOS = Object.freeze({
  'read-only-baseline': Object.freeze(['baseline']),
  'fresh-drop-success': Object.freeze([
    'baseline', 'permission-blocked', 'helper-presented', 'drop-accepted',
    'retry-verified', 'reverse-complete',
  ]),
  'fresh-drop-still-denied': Object.freeze([
    'baseline', 'permission-blocked', 'helper-presented', 'drop-accepted',
    'retry-still-denied',
  ]),
  'manual-retry-still-denied': Object.freeze([
    'baseline', 'permission-blocked', 'helper-presented', 'retry-still-denied',
  ]),
  'drag-cancel': Object.freeze([
    'baseline', 'permission-blocked', 'helper-presented', 'drag-cancelled',
  ]),
  'existing-row-success': Object.freeze([
    'baseline', 'permission-blocked', 'helper-presented', 'existing-row',
    'retry-verified', 'reverse-complete',
  ]),
  'existing-row-still-denied': Object.freeze([
    'baseline', 'permission-blocked', 'helper-presented', 'existing-row',
    'retry-still-denied',
  ]),
  'target-lost': Object.freeze([
    'baseline', 'permission-blocked', 'helper-presented', 'target-lost',
  ]),
  'reduced-motion-drop-success': Object.freeze([
    'baseline', 'permission-blocked', 'reduced-motion-helper', 'drop-accepted',
    'retry-verified', 'reduced-motion-complete',
  ]),
  'reduced-motion-existing-row-success': Object.freeze([
    'baseline', 'permission-blocked', 'reduced-motion-helper', 'existing-row',
    'retry-verified', 'reduced-motion-complete',
  ]),
});
const PHASES = Object.freeze(new Set(Object.values(SCENARIOS).flat()));

function fail(message) { throw new Error(message); }
function isReadOnlyScenario(scenario) { return scenario === READ_ONLY_SCENARIO; }

function validateLowerHex(value, length, label) {
  if (typeof value !== 'string' || !new RegExp(`^[0-9a-f]{${length}}$`).test(value)) {
    fail(`${label} must be lowercase hexadecimal with ${length} characters`);
  }
  return value;
}

function validateTeamId(value, label) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(value) || value === 'not-set') {
    fail(`${label} must be a concrete vendor Team ID`);
  }
  return value;
}

function validateLanguage(value, label) {
  if (typeof value !== 'string' || !SUPPORTED_LANGUAGES.has(value)) {
    fail(`${label} must be one of ${[...SUPPORTED_LANGUAGES].join(', ')}`);
  }
  return value;
}

function validateExpectedContract(contract, required) {
  if (!contract || typeof contract !== 'object' || Array.isArray(contract)) {
    fail('Expected evidence contract is missing');
  }
  const normalized = {};
  let present = 0;
  for (const { key, label } of EXPECTED_FIELDS) {
    const value = contract[key] == null ? null : contract[key];
    if (value !== null) present += 1;
    normalized[key] = value;
  }
  if (required && present !== EXPECTED_FIELDS.length) {
    const missing = EXPECTED_FIELDS.filter(({ key }) => normalized[key] === null)
      .map(({ label }) => label).join(', ');
    fail(`Non-read-only scenario requires explicit evidence contract: ${missing}`);
  }
  if (!required && present !== 0 && present !== EXPECTED_FIELDS.length) {
    fail('Read-only scenario accepts either no live contract or all expected contract fields');
  }
  if (normalized.sourceCommit !== null) validateLowerHex(normalized.sourceCommit, 40, '--expected-source-commit');
  if (normalized.switcherExecutableSha256 !== null) {
    validateLowerHex(normalized.switcherExecutableSha256, 64, '--expected-switcher-executable-sha256');
  }
  if (normalized.cavalryExecutableSha256 !== null) {
    validateLowerHex(normalized.cavalryExecutableSha256, 64, '--expected-cavalry-executable-sha256');
  }
  if (normalized.cavalryRuntimeSha256 !== null) {
    validateLowerHex(normalized.cavalryRuntimeSha256, 64, '--expected-cavalry-runtime-sha256');
  }
  if (normalized.vendorTeamId !== null) validateTeamId(normalized.vendorTeamId, '--expected-vendor-team-id');
  if (normalized.language !== null) validateLanguage(normalized.language, '--expected-language');
  if (required && normalized.language === 'en') {
    fail('--expected-language must be a non-English live target');
  }
  return normalized;
}

function expectedContractFromArgs(args, scenario) {
  const contract = Object.fromEntries(EXPECTED_FIELDS.map(({ key, argument }) => [
    key, args[argument] === undefined ? null : args[argument],
  ]));
  return validateExpectedContract(contract, !isReadOnlyScenario(scenario));
}

function scenarioPhases(name) {
  const phases = SCENARIOS[name];
  if (!phases) fail(`Unknown scenario: ${name || '<missing>'}`);
  return phases;
}

function validateFreshInstallationProof(proof, manifest) {
  const expected = manifest.expected;
  const cavalryPath = manifest.cavalry.path;
  const statePath = manifest.user.applicationSupportStatePath;
  const markerPath = path.join(cavalryPath, 'Contents', 'Resources', CAVALRY_LANGUAGE_MARKER);
  const injectorPath = path.join(cavalryPath, 'Contents', 'Frameworks', CAVALRY_INJECTOR);
  if (!proof || !proof.state || proof.state.path !== statePath || proof.state.absent !== true ||
      !proof.marker || proof.marker.path !== markerPath || proof.marker.absent !== true ||
      !proof.injector || proof.injector.path !== injectorPath || proof.injector.absent !== true ||
      !proof.vendor || !proof.vendor.codesign || proof.vendor.codesign.path !== cavalryPath ||
      proof.vendor.codesign.strict !== true || proof.vendor.teamId !== expected.vendorTeamId ||
      proof.vendor.executableSha256 !== expected.cavalryExecutableSha256 ||
      proof.vendor.runtimeSha256 !== expected.cavalryRuntimeSha256) {
    fail('Manifest fresh-installation proof is incomplete');
  }
  return proof;
}

function validateManifestContract(manifest) {
  if (!manifest || manifest.schema !== MANIFEST_SCHEMA) {
    fail(`Manifest schema ${MANIFEST_SCHEMA} required`);
  }
  const readOnly = isReadOnlyScenario(manifest.scenario);
  const expected = validateExpectedContract(manifest.expected, !readOnly);
  if (!manifest.repository || typeof manifest.repository.root !== 'string' ||
      typeof manifest.repository.head !== 'string' ||
      manifest.repository.expectedHead !== (expected.sourceCommit || null) ||
      manifest.repository.clean !== true || manifest.repository.detached !== true ||
      !Array.isArray(manifest.repository.status) || manifest.repository.status.length !== 0 ||
      !Number.isInteger(manifest.repository.sourceTreeOwnerUid)) {
    fail('Manifest source lock is invalid');
  }
  validateLowerHex(manifest.repository.head, 40, 'manifest source commit');
  if (expected.sourceCommit !== null && manifest.repository.head !== expected.sourceCommit) {
    fail('Manifest source commit does not match the explicit expected source commit');
  }
  if (!manifest.switcher || !manifest.cavalry ||
      !manifest.switcher.executable || !manifest.cavalry.executable ||
      !manifest.cavalry.runtimeExecutable || !manifest.cavalry.codesign ||
      manifest.cavalry.codesign.path !== manifest.cavalry.path ||
      manifest.cavalry.codesign.strict !== true) {
    fail('Manifest app identity or strict vendor codesign proof is incomplete');
  }
  if (!readOnly) {
    if (!manifest.user || !Number.isInteger(manifest.user.uid) ||
        typeof manifest.user.home !== 'string' ||
        typeof manifest.user.cavalryAppPath !== 'string' ||
        typeof manifest.user.applicationSupportStatePath !== 'string' ||
        manifest.cavalry.path !== manifest.user.cavalryAppPath ||
        manifest.user.cavalryAppPath !== path.join(manifest.user.home, 'Applications', 'Cavalry.app') ||
        manifest.user.applicationSupportStatePath !== path.join(manifest.user.home, 'Library', 'Application Support', APP_DATA_DIRECTORY, 'state.json') ||
        manifest.repository.sourceTreeOwnerUid === manifest.user.uid) {
      fail('Manifest current-user application contract is incomplete');
    }
    if (manifest.cavalry.vendorTeamId !== expected.vendorTeamId ||
        !manifest.cavalry.ownership ||
        manifest.cavalry.ownership.bundleUid !== manifest.user.uid ||
        manifest.cavalry.ownership.executableUid !== manifest.user.uid ||
        manifest.cavalry.ownership.runtimeExecutableUid !== manifest.user.uid) {
      fail('Manifest Cavalry ownership or vendor identity is invalid');
    }
    validateFreshInstallationProof(manifest.freshInstallation, manifest);
  } else if (manifest.user !== null || manifest.freshInstallation !== null) {
    fail('Read-only manifest cannot contain current-user fresh-installation proof');
  }
  return manifest;
}

function manifestSequence(manifest) {
  validateManifestContract(manifest);
  const sequence = scenarioPhases(manifest.scenario);
  if (JSON.stringify(manifest.sequence) !== JSON.stringify(sequence)) {
    fail('Manifest scenario contract drifted');
  }
  return sequence;
}

function validateStatePayload(state, expectedAppPath, expectedLanguage) {
  if (!state || typeof state !== 'object' || Array.isArray(state)) fail('state.json must contain an object');
  if (state.appPath !== expectedAppPath) {
    fail(`state.json appPath does not match target: ${state.appPath || '<missing>'}`);
  }
  if (state.currentLang !== expectedLanguage) {
    fail(`state.json currentLang does not match expected language: ${state.currentLang || '<missing>'}`);
  }
  if (typeof state.operationId !== 'string' || !state.operationId ||
      !OPERATION_ID_PATTERN.test(state.operationId)) {
    fail('state.json operationId must be a non-empty filename-safe value');
  }
  return {
    appPath: state.appPath,
    currentLang: state.currentLang,
    operationId: state.operationId,
  };
}

function validateRetryVerification(record, manifest) {
  if (!record || record.schema !== RETRY_VERIFICATION_SCHEMA ||
      record.expectedLanguage !== manifest.expected.language ||
      !record.marker || record.marker.language !== manifest.expected.language ||
      !record.codesign || record.codesign.strict !== true ||
      !record.state || record.state.path !== manifest.user.applicationSupportStatePath ||
      record.state.ownerUid !== manifest.user.uid ||
      record.state.appPath !== manifest.user.cavalryAppPath ||
      record.state.currentLang !== manifest.expected.language ||
      typeof record.state.operationId !== 'string' ||
      !OPERATION_ID_PATTERN.test(record.state.operationId)) {
    fail('retry-verified record does not contain the required post-retry proof');
  }
  return record;
}

function validateCheckpointRecord(record, phase, manifestPath, manifest) {
  if (!record || record.schema !== CHECKPOINT_SCHEMA || record.phase !== phase ||
      !record.manifest || record.manifest.path !== manifestPath ||
      !Array.isArray(record.captures) || record.captures.length === 0 ||
      !record.observation || record.observation.switcherOnly !== true ||
      record.observation.permissionState !== 'not-recorded') {
    fail(`${phase} checkpoint record is invalid`);
  }
  if (phase === 'permission-blocked') {
    if (record.assertion !== PERMISSION_BLOCKED_ASSERTION) {
      fail('permission-blocked must not fabricate permission truth');
    }
  } else if (record.assertion !== 'Window metadata and images are observations only; permission truth remains the real Switch/Restore result.') {
    fail(`${phase} checkpoint assertion drifted`);
  }
  if (phase === 'retry-verified') validateRetryVerification(record.verification, manifest);
  else if (record.verification !== null) fail(`${phase} cannot contain retry verification`);
  return record;
}

module.exports = {
  APP_DATA_DIRECTORY,
  BOOLEAN_ARGUMENTS,
  CAVALRY_INJECTOR,
  CAVALRY_LANGUAGE_MARKER,
  CAVALRY_RUNTIME_EXECUTABLE,
  CHECKPOINT_SCHEMA,
  EXPECTED_FIELDS,
  MANIFEST_SCHEMA,
  OBSERVATION_CONTRACT,
  PERMISSION_BLOCKED_ASSERTION,
  PHASES,
  READ_ONLY_SCENARIO,
  RETRY_VERIFICATION_SCHEMA,
  SCENARIOS,
  SEAL_SCHEMA,
  SUPPORTED_LANGUAGES,
  VALUE_ARGUMENTS,
  expectedContractFromArgs,
  isReadOnlyScenario,
  manifestSequence,
  scenarioPhases,
  validateCheckpointRecord,
  validateExpectedContract,
  validateFreshInstallationProof,
  validateLanguage,
  validateLowerHex,
  validateManifestContract,
  validateRetryVerification,
  validateStatePayload,
};
