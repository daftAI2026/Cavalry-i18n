#!/usr/bin/env node
/**
 * [INPUT]: 依赖 renderer 视图文件与 Tauri bridge，读取 hash、DOM id 和 API method 锚点
 * [OUTPUT]: 对外提供 renderer contract 测试，冻结 UI 真相源和 window.cavalryI18n 需求面
 * [POS]: tools 的 Phase 0 UI 冻结测试，确保 Tauri-only renderer 和 bridge 不漂移
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
  'index.html': 'f5371832308ace4f37f3c833e341ac5306b59ea6a979a51976d8efad71b4345d',
  'styles.css': '29225329fc6ca2c15e4c315d46b837319f6c17decbf8144293f88b1ac2e14f54',
  'app.js': 'adbdcdb4ed7e9227950888cf8dd8f45142eef953752250251af8c98fd1d3f21f',
  'tauri-bridge.js': 'b583914ca17dbe2f775250cecae3c8598e79fbc8c0064cd8c746192e1e337790',
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
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
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
