#!/usr/bin/env node
/**
 * [INPUT]: 依赖 Windows NSIS smoke、Windows 目标版本配置及临时 native bundle fixture。
 * [OUTPUT]: 锁定当前 Windows 目标的 production-2.8 三语包，拒绝旧版本及字节漂移。
 * [POS]: tools 的 Windows 安装产物静态合同；不安装软件，不依赖真实构建输出。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
'use strict';

const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const { runPowerShellScript } = require('./powershell_command.js');
const { cleanupTempDirs, makeTempDir } = require('./test_temp_dir.js');

test.after(cleanupTempDirs);

const SCRIPT_PATH = path.join(__dirname, 'check_windows_nsis_install.ps1');
const HELPER_PATH = path.join(__dirname, 'windows_native_pack.ps1');
const DRIVER_PATH = path.join(__dirname, 'windows_native_pack_contract.ps1');
const LOCALES = Object.freeze(['zh-Hans', 'zh-Hant', 'ja_JP']);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');

function nativeResourcesFunction(script) {
  const start = script.indexOf('function Assert-InstalledNativeResources {');
  assert.notEqual(start, -1, 'native pack helper must export the NSIS verifier');
  return script.slice(start);
}

function writeProductionFixture(root) {
  const nativeRoot = path.join(root, 'target', 'native-language-packs');
  fs.mkdirSync(nativeRoot, { recursive: true });
  const packs = {};
  for (const locale of LOCALES) {
    const nativeLocale = locale === 'ja_JP' ? 'ja' : locale;
    const bytes = Buffer.from(`${JSON.stringify([{ type: 'strings', language: nativeLocale, value: { title: { 'UI-text': locale } } }])}\n`);
    fs.writeFileSync(path.join(nativeRoot, `${locale}.json`), bytes);
    packs[locale] = {
      file: `${locale}.json`,
      nativeLocale,
      sha256: hash(bytes),
      bytes: bytes.length,
      reviewed: 1,
      preserved: 0,
      vendor: 0,
      missing: 0,
    };
  }
  const manifest = {
    schemaVersion: 1,
    kind: 'production-2.8',
    cavalryVersion: require('./cavalry_native_windows_target.json').cavalryVersion,
    targetSha256: 'a'.repeat(64),
    inputSha256: 'b'.repeat(64),
    approvedUIKeys: 1,
    nativeKeys: 1,
    supplementalKeys: 0,
    complete: true,
    packs,
  };
  fs.writeFileSync(path.join(nativeRoot, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  return nativeRoot;
}

test('Windows install smoke binds installed resources to current production-2.8 inputs', () => {
  const script = fs.readFileSync(SCRIPT_PATH, 'utf8');
  const helper = fs.readFileSync(HELPER_PATH, 'utf8');
  const verifier = nativeResourcesFunction(helper);

  assert.match(script, /Join-Path \$repoRoot 'src-tauri\\target\\native-language-packs'/);
  assert.match(script, /\. \(Join-Path \$scriptRoot 'windows_native_pack\.ps1'\)/);
  assert.doesNotMatch(script, /\$nativePackLocales|function Assert-InstalledNativeResources/);
  assert.match(verifier, /\$nativePackLocales = @\('zh-Hans', 'zh-Hant', 'ja_JP'\)/);
  assert.match(verifier, /Join-Path \$InstallRoot 'target\\native-language-packs'/);
  assert.match(verifier, /Join-Path \$SourceRoot 'manifest\.json'/);
  assert.match(verifier, /\$manifest\.kind -ceq 'production-2\.8'/);
  assert.match(verifier, /Join-Path \$PSScriptRoot 'cavalry_native_windows_target\.json'/);
  assert.match(verifier, /\$manifest\.cavalryVersion -ceq \$windowsTarget\.cavalryVersion/);
  assert.match(verifier, /\$manifest\.complete -eq \$true/);
  assert.match(verifier, /Compare-Object -ReferenceObject \$expectedLocales -DifferenceObject \$actualLocales -CaseSensitive/);
  assert.match(verifier, /Get-FileHash -LiteralPath \$sourceManifestPath -Algorithm SHA256/);
  assert.match(verifier, /Get-FileHash -LiteralPath \$installedManifestPath -Algorithm SHA256/);
  assert.match(verifier, /\$sourceManifestHash -ceq \$installedManifestHash/);
  assert.match(verifier, /\$sourcePackHash -ceq \$info\.sha256/);
  assert.match(verifier, /\$installedPackHash -ceq \$sourcePackHash/);
  assert.match(verifier, /\$sourcePackLength -eq \$info\.bytes/);
  assert.match(script, /Assert-InstalledNativeResources `\s+-SourceRoot \$sourceNativePackRoot `\s+-InstallRoot \$InstallRoot/);
  assert.doesNotMatch(script, /\$expectedJsonCountPerLocale|function Assert-InstalledLanguages/);
});

test('PowerShell native pack verifier accepts current bytes and rejects drift', {
  skip: process.platform === 'win32' ? false : 'requires Windows PowerShell host',
}, () => {
  const fixtureRoot = makeTempDir();
  const sourceRoot = writeProductionFixture(path.join(fixtureRoot, 'source'));
  const installRoot = path.join(fixtureRoot, 'install');
  const installedRoot = path.join(installRoot, 'target', 'native-language-packs');
  fs.cpSync(sourceRoot, installedRoot, { recursive: true });

  const verify = () => runPowerShellScript(DRIVER_PATH, [
    '-SourceRoot', sourceRoot,
    '-InstallRoot', installRoot,
  ]);
  assert.equal(verify().status, 0, 'matching generated source and installed bytes pass');

  const sourceManifest = path.join(sourceRoot, 'manifest.json');
  const currentManifest = fs.readFileSync(sourceManifest);
  const oldManifest = JSON.parse(currentManifest);
  oldManifest.cavalryVersion = '2.8.0';
  fs.writeFileSync(sourceManifest, JSON.stringify(oldManifest));
  fs.copyFileSync(sourceManifest, path.join(installedRoot, 'manifest.json'));
  assert.equal(verify().status, 1, 'matching old 2.8.0 resources fail current Windows admission');
  fs.writeFileSync(sourceManifest, currentManifest);
  fs.copyFileSync(sourceManifest, path.join(installedRoot, 'manifest.json'));

  const installedManifest = path.join(installedRoot, 'manifest.json');
  fs.appendFileSync(installedManifest, ' ');
  assert.equal(verify().status, 1, 'manifest byte drift fails');
  fs.copyFileSync(path.join(sourceRoot, 'manifest.json'), installedManifest);

  fs.appendFileSync(path.join(installedRoot, 'zh-Hans.json'), 'drift');
  assert.equal(verify().status, 1, 'pack byte drift fails after manifest restoration');
});

test('PowerShell sources retain the UTF-8 BOM and CRLF contract', () => {
  for (const file of [SCRIPT_PATH, HELPER_PATH, DRIVER_PATH]) {
    const bytes = fs.readFileSync(file);
    assert.deepEqual([...bytes.subarray(0, 3)], [0xef, 0xbb, 0xbf], `${path.basename(file)} BOM`);
    const text = bytes.subarray(3).toString('utf8');
    assert.match(text, /\r\n/, `${path.basename(file)} CRLF`);
    assert.doesNotMatch(text.replace(/\r\n/g, ''), /\n/, `${path.basename(file)} has no bare LF`);
  }
});
