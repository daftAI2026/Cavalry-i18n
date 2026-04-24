#!/usr/bin/env node
/**
 * [INPUT]: 依赖 desktop-patcher/renderer 视图文件与 preload.js，读取 hash、DOM id 和 API method 锚点
 * [OUTPUT]: 对外提供 renderer contract 测试，冻结 UI 真相源和 window.cavalryI18n 需求面
 * [POS]: tools 的 Phase 0 UI 冻结测试，被 Tauri bridge 迁移用作不可漂移基准
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');
const desktopRoot = path.join(repoRoot, 'desktop-patcher');
const rendererRoot = path.join(desktopRoot, 'renderer');

const EXPECTED_HASHES = {
  'index.html': '6274250a8d768fe46d67153f9527c29179b0bacaf55bc282987a0b7f84c8f28d',
  'styles.css': 'd25e654f88f6cb31b98472352cd4520f7b81aeacc348e13f7ce8c2f336c0637e',
  'app.js': 'ac3bec7d6918aacb493d80d666fcb589f8f062e71859ff1fb616dd185b8df1dc',
  'tauri-bridge.js': '9b6603bafa5129be0dddcfafcef27182439b0ebeed464be0fe7fb47d2ba01f22',
};

const REQUIRED_IDS = [
  'appVersion',
  'appPath',
  'currentLanguage',
  'languageSelect',
  'browseButton',
  'extractButton',
  'applyButton',
  'permissionButton',
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

test('preload exposes the exact cavalryI18n API surface consumed by renderer app.js', () => {
  const preload = fs.readFileSync(path.join(desktopRoot, 'preload.js'), 'utf8');
  const renderer = fs.readFileSync(path.join(rendererRoot, 'app.js'), 'utf8');

  for (const method of REQUIRED_API_METHODS) {
    assert.match(preload, new RegExp(`${method}\\s*:`), `${method} not exposed in preload`);
    assert.match(renderer, new RegExp(`api\\.${method}\\(`), `${method} not consumed by renderer`);
  }
});
