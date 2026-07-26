#!/usr/bin/env node
/**
 * [INPUT]: 依赖 renderer 视图文件与 Tauri bridge，以规范化 LF 文本读取 hash、DOM id 和 API method 锚点
 * [OUTPUT]: 对外提供跨平台 renderer contract 测试，冻结 UI 真相源和 window.cavalryI18n 需求面
 * [POS]: tools 的 Phase 0 UI 冻结测试，确保 Tauri-only renderer 和 bridge 不因平台换行策略漂移
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');
const rendererRoot = path.join(repoRoot, 'renderer');

const EXPECTED_HASHES = {
  'index.html': 'ef7680a61014fb72db0afea39b41e2e3764038fdc9d14b2386858b27ef3ffd5e',
  'styles.css': '29225329fc6ca2c15e4c315d46b837319f6c17decbf8144293f88b1ac2e14f54',
  'app.js': 'ac1c28c0c54d54d5a7b6e2bd1b10c73d399a9da86d14b16e0923992163ed70a6',
  'tauri-bridge.js': '9c7001344e860cd9df076eee3e3c7792326a8951c94e0dfa77b0d5070c54810f',
};

const REQUIRED_IDS = [
  'appVersion',
  'appPath',
  'languageSectionLabel',
  'currentLabel',
  'currentLanguage',
  'switchToLabel',
  'languageSelect',
  'browseButton',
  'extractButton',
  'applyButton',
  'permissionButton',
  'modalBackdrop',
  'modalTitle',
  'modalBody',
  'modalPrimaryButton',
  'modalSecondaryButton',
  'modalCloseButton',
  'statusText',
];

const REQUIRED_API_METHODS = [
  'getStatus',
  'browseApp',
  'extractEnglish',
  'applyLanguage',
  'restartCavalry',
];

function sha256(filePath) {
  const source = fs.readFileSync(filePath, 'utf8').replace(/\r\n?/g, '\n');
  return crypto.createHash('sha256').update(source, 'utf8').digest('hex');
}

test('renderer source hashes stay frozen for the Tauri migration', () => {
  for (const [fileName, expectedHash] of Object.entries(EXPECTED_HASHES)) {
    assert.equal(sha256(path.join(rendererRoot, fileName)), expectedHash, `${fileName} changed`);
  }
});

test('renderer keeps the DOM ids required by app.js and future bridge tests', () => {
  const html = fs.readFileSync(path.join(rendererRoot, 'index.html'), 'utf8');
  for (const id of REQUIRED_IDS) {
    assert.match(html, new RegExp(`id="${id}"`), `#${id} missing`);
  }
});

test('tauri bridge exposes the exact cavalryI18n API surface consumed by renderer app.js', () => {
  const bridge = fs.readFileSync(path.join(rendererRoot, 'tauri-bridge.js'), 'utf8');
  const renderer = fs.readFileSync(path.join(rendererRoot, 'app.js'), 'utf8');

  for (const method of REQUIRED_API_METHODS) {
    assert.match(bridge, new RegExp(`${method}\\s*:`), `${method} not exposed in bridge`);
    assert.match(renderer, new RegExp(`api\\.${method}\\(`), `${method} not consumed by renderer`);
  }
});
