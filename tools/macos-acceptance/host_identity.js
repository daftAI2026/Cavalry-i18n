/**
 * [INPUT]: 依赖现场 macOS 的固定 /usr/bin/sw_vers 边界，或测试注入的等价命令执行器
 * [OUTPUT]: 对外提供严格的 productVersion/buildVersion 主机身份采集、结构校验与同机复验
 * [POS]: macos-acceptance 的 host OS 身份原语；matrix 生成与人工 seal 共用，compile-only 不调用
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
'use strict';

const cp = require('node:child_process');
const { isDeepStrictEqual } = require('node:util');

const MATRIX_SCHEMA = 'cavalry-i18n.acceptance-v2.matrix/v6';
const HOST_KEYS = Object.freeze(['buildVersion', 'productVersion']);

function fail(message) {
  throw new Error(message);
}

function validateHostIdentity(host, label = 'machine.host') {
  if (!host || typeof host !== 'object' || Array.isArray(host)) {
    fail(`${label} must be an object`);
  }
  const keys = Object.keys(host).sort();
  if (!isDeepStrictEqual(keys, HOST_KEYS)) {
    fail(`${label} keys mismatch: expected ${HOST_KEYS.join(', ')}`);
  }
  if (typeof host.productVersion !== 'string' ||
      !/^\d+(?:\.\d+){1,2}$/.test(host.productVersion)) {
    fail(`${label}.productVersion is invalid`);
  }
  if (typeof host.buildVersion !== 'string' ||
      !/^\d{2}[A-Z][0-9A-Za-z]{1,15}$/.test(host.buildVersion)) {
    fail(`${label}.buildVersion is invalid`);
  }
  return { productVersion: host.productVersion, buildVersion: host.buildVersion };
}

function swVersValue(flag, spawnSync = cp.spawnSync) {
  const result = spawnSync('/usr/bin/sw_vers', [flag], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.error || result.status !== 0) {
    const detail = String(result.stderr || result.error?.message || '').trim();
    fail(`/usr/bin/sw_vers ${flag} failed${detail ? `: ${detail}` : ''}`);
  }
  const value = String(result.stdout || '').trim();
  if (!value) fail(`/usr/bin/sw_vers ${flag} returned an empty value`);
  return value;
}

function collectMacHostIdentity(options = {}) {
  const platform = options.platform || process.platform;
  if (platform !== 'darwin') fail(`Live macOS host identity requires darwin, got ${platform}`);
  return validateHostIdentity({
    productVersion: swVersValue('-productVersion', options.spawnSync),
    buildVersion: swVersValue('-buildVersion', options.spawnSync),
  });
}

function assertSameHostIdentity(recorded, current, label = 'machine.host') {
  const expected = validateHostIdentity(recorded, label);
  const actual = validateHostIdentity(current, 'currentHost');
  if (!isDeepStrictEqual(expected, actual)) {
    fail(`${label} does not match the current live macOS host`);
  }
  return expected;
}

module.exports = {
  MATRIX_SCHEMA,
  assertSameHostIdentity,
  collectMacHostIdentity,
  validateHostIdentity,
};
