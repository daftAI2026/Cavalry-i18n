#!/usr/bin/env node
/**
 * [INPUT]: 依赖 package.json、src-tauri/tauri.conf.json、capabilities/default.json 与本地打包 SOP 文档
 * [OUTPUT]: 对外提供 Tauri 打包 SOP 与配置 contract 测试，阻止发布路径退回 Electron 默认链路
 * [POS]: tools 的 Phase 6 打包守门，连接文档相、npm script 与 Tauri bundle 配置
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, relativePath), 'utf8'));
}

function readText(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

test('tauri local build SOP replaces the Electron builder release path', () => {
  const localSop = readText('doc/LOCAL_BUILD_SOP.md');
  const electronArchive = readText('doc/archive/LOCAL_BUILD_ELECTRON_SOP.md');

  assert.match(localSop, /Tauri/i);
  assert.match(localSop, /npm run tauri:build/);
  assert.match(localSop, /CAVALRY_QT_PREFIX/);
  assert.match(localSop, /6\.6\.3/);
  assert.doesNotMatch(localSop, /electron-builder\s+-m/);

  assert.match(electronArchive, /Electron/i);
  assert.match(electronArchive, /npm run build/);
});

test('tauri build scripts and config describe one injector and resource pipeline', () => {
  const pkg = readJson('package.json');
  const config = readJson('src-tauri/tauri.conf.json');
  const resources = config.bundle.resources;

  assert.equal(pkg.scripts['tauri:build'], 'tauri build');
  assert.match(pkg.scripts['build:injector'], /CAVALRY_QT_VERSION=6\.6\.3/);
  assert.equal(config.build.beforeBuildCommand, 'npm run build:injector');
  assert.equal(config.build.frontendDist, '../desktop-patcher/renderer');
  assert.equal(config.app.withGlobalTauri, true);
  assert.equal(resources['../languages'], 'languages');
  assert.equal(
    resources['../desktop-patcher/injector/libCavalryTranslatorInjector.dylib'],
    'injector/libCavalryTranslatorInjector.dylib'
  );
});

test('tauri bundle config preserves the Electron window contract', () => {
  const config = readJson('src-tauri/tauri.conf.json');
  const window = config.app.windows.find((candidate) => candidate.label === 'main');

  assert.ok(window, 'main window missing');
  assert.equal(window.url, 'index.html');
  assert.equal(window.width, 480);
  assert.equal(window.height, 500);
  assert.equal(window.minWidth, 420);
  assert.equal(window.minHeight, 500);
  assert.deepEqual(config.bundle.targets, ['dmg', 'app']);
});

test('tauri window icon is an 8-bit PNG compatible with generate_context', () => {
  const icon = fs.readFileSync(path.join(repoRoot, 'src-tauri/icons/icon.png'));
  assert.equal(icon.toString('hex', 0, 8), '89504e470d0a1a0a');
  assert.equal(icon.readUInt32BE(16), 1024);
  assert.equal(icon.readUInt32BE(20), 1024);
  assert.equal(icon.readUInt8(24), 8, 'Tauri rejects the original 16-bit PNG at runtime');
  assert.equal(icon.readUInt8(25), 6, 'icon.png must be RGBA');
});

test('tauri capability and SOP mention the bridge and packaged resource boundaries', () => {
  const localSop = readText('doc/LOCAL_BUILD_SOP.md');
  const capabilities = readJson('src-tauri/capabilities/default.json');

  assert.ok(capabilities.windows.includes('main'));
  assert.ok(capabilities.permissions.includes('core:default'));
  assert.ok(capabilities.permissions.includes('core:window:default'));
  assert.ok(capabilities.permissions.includes('core:webview:default'));

  for (const requiredText of [
    'bundle.resources',
    'languages',
    'libCavalryTranslatorInjector.dylib',
    'src-tauri/target/release/bundle',
    'DMG',
    '.app',
  ]) {
    assert.match(localSop, new RegExp(requiredText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});
