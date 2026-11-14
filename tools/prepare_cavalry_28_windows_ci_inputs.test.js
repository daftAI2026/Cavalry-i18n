/**
 * [INPUT]: 依赖Windows CI输入准备器、冻结官方宿主target与Windows 2.8.1构建包装器。
 * [OUTPUT]: 验证固定2.8.1 MSI/五项文件摘要、admin提取边界、Qt输入、GITHUB_ENV与PowerShell真实语法。
 * [POS]: Windows CI输入准备器合同；Windows调用Parser.ParseFile，不执行产品脚本。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { runPowerShellScript } = require('./powershell_command.js');
const { makeTempDir, cleanupTempDirs } = require('./test_temp_dir.js');
test.after(cleanupTempDirs);

const scriptPath = path.join(__dirname, 'prepare_cavalry_28_windows_ci_inputs.ps1');
const parserPath = path.join(__dirname, 'check_powershell_syntax.ps1');
const scriptBytes = fs.readFileSync(scriptPath);
const script = scriptBytes.toString('utf8').replace(/^\uFEFF/, '');
const target = JSON.parse(fs.readFileSync(path.join(__dirname, 'cavalry_native_windows_target.json'), 'utf8'));
const nativeBuilder = fs.readFileSync(path.join(__dirname, 'windows_native_build.js'), 'utf8');
const productionPowerShellFiles = Object.freeze([
  scriptPath,
  path.join(__dirname, 'check_windows_nsis_install.ps1'),
  path.join(__dirname, 'windows_native_pack.ps1'),
  path.join(__dirname, 'windows_native_pack_contract.ps1'),
]);

test('PowerShell entry keeps the required Windows encoding and file header contract', () => {
  assert.deepEqual([...scriptBytes.subarray(0, 3)], [0xef, 0xbb, 0xbf], 'PowerShell source must use UTF-8 BOM');
  const crlfCount = (script.match(/\r\n/g) || []).length;
  const lfCount = (script.match(/\n/g) || []).length;
  assert.ok(crlfCount > 0, 'PowerShell source must use CRLF');
  assert.equal(lfCount, crlfCount, 'PowerShell source must not contain bare LF');
  assert.match(script, /^<#\r\n\[INPUT\]:/);
  assert.match(script, /\[OUTPUT\]:[\s\S]*\[POS\]:[\s\S]*\[PROTOCOL\]: 变更时更新此头部，然后检查 CLAUDE\.md/);
});

test('official MSI URL is accepted only by the frozen Windows 2.8.1 target hashes', () => {
  assert.equal(target.schemaVersion, 1);
  assert.equal(target.cavalryVersion, '2.8.1');
  assert.equal(target.qtVersion, '6.9.2');
  assert.equal(target.architecture, 'x86_64');
  assert.equal(target.msiSha256, 'b79d08290b6f1320154b9fec46cee1b4bba81a9670af636611f4c53e8057420a');
  assert.equal(Object.keys(target.files).length, 5);
  assert.ok(Object.hasOwn(target.files, 'Cavalry.exe'));
  assert.deepEqual(target.files, {
    'Cavalry.exe': '87689d8e7a37b2e2341cbf5c6327fd960afc65b8385ac35b170d71671961d9ad',
    'Api.dll': '938c61d28bdea82f4d30cc68d1076f8e3f4306b54d2a7d5d04d223d4f8216c61',
    'Core.dll': 'd19ab6b936bf9217ec0fc1abbd348b7dc2aa179a521355ae648afffcd49fcba4',
    'Qt6Core.dll': '63e487c3bb4fb0afae2a1b418e6ec1a45cf1420393bcd1b36039a18c10d2deeb',
    'qwindows.dll': '0673d9050ee2f04c108f7673abdbee57c5bbb5bf84fab39e4a82eb96b1bcc8e8',
  });
  assert.notEqual(target.files['Cavalry.exe'], 'bad89abf30c67b2d2fb3c9d0a26c3cfda9b738164e11bca050ac54ad0e2783a1',
    'the previous Cavalry 2.8.0 executable must not remain an admitted target');
  assert.match(script, /\$target\.cavalryVersion -ne '2\.8\.1'/);
  assert.doesNotMatch(script, /\$target\.cavalryVersion -ne '2\.8\.0'/);
  assert.match(script, /cavalry_native_windows_target\.json/);
  assert.match(script, /Get-FileHash -LiteralPath \$msiPath -Algorithm SHA256/);
  assert.match(script, /\$actualMsiSha256 -cne \$target\.msiSha256\.ToLowerInvariant\(\)/);
  assert.match(script, /foreach \(\$entry in \$targetFiles\)/);
  assert.match(script, /\$actualFileSha256 -cne \$entry\.Value\.ToLowerInvariant\(\)/);
  assert.match(script, /https:\/\/cavalry\.studio\/downloads\/latest\/Cavalry\.msi/);
  assert.doesNotMatch(script, /cavalry_native_target\.json|sourceSha256|japaneseSha256/,
    'catalog source hashes stay owned by the existing native resource bundle');
});

test('the MSI runs administrative extraction only under runner temp, never product installation', () => {
  assert.match(script, /GITHUB_ACTIONS -ne 'true'[\s\S]*?RUNNER_TEMP and GITHUB_ENV are required/);
  assert.match(script, /\$inputRoot = Join-Path \$runnerTemp /);
  assert.match(script, /cavalry-2\.8\.1-windows-inputs-/);
  assert.match(script, /TARGETDIR="\{2\}"/);
  assert.match(script, /Start-Process -FilePath \$msiexec -ArgumentList \$msiArguments -Wait -PassThru/);
  assert.match(script, /if \(\$msiProcess\.ExitCode -ne 0\)/);
  assert.match(script, /Get-ChildItem -LiteralPath \$extractRoot -Filter 'Cavalry\.exe' -File -Recurse/);
  assert.match(script, /Join-Path \$matchingRoots\[0\] 'assets'/);
  assert.match(script, /Join-Path \$assetsRoot 'MetaData'/);
  assert.match(script, /Join-Path \$assetsRoot 'Presets'/);
  assert.doesNotMatch(script, /\/i(?:\s|\")/i, 'the helper must not run msiexec install mode');
  assert.doesNotMatch(script, /Program Files|APPDATA|LOCALAPPDATA|Cavalry\.exe['\"]?\s+\/|Start-Process[^\r\n]*Cavalry\.exe/);
  assert.ok(script.indexOf("GITHUB_ACTIONS -ne 'true'") < script.indexOf('Invoke-WebRequest'));
});

test('Qt input uses the pinned aqt closure and exports only validated native build paths', () => {
  assert.match(script, /version\('aqtinstall'\) == '3\.3\.0'/);
  assert.match(script, /'install-qt', 'windows', 'desktop', '6\.9\.2', 'win64_msvc2022_64'/);
  assert.match(script, /'--archives', 'qtbase'/);
  assert.match(script, /mkspecs\\qconfig\.pri/);
  assert.match(script, /QT_VERSION\\s\*=\\s\*6\\\.9\\\.2/);
  assert.match(script, /AppendAllText\(\$githubEnvPath, \$environmentLines, \[System\.Text\.UTF8Encoding\]::new\(\$false\)\)/);
  assert.match(script, /CAVALRY_NATIVE_ASSETS_ROOT=\$assetsRoot/);
  assert.match(script, /CAVALRY_QT_PREFIX=\$qtPrefix/);
  assert.ok(script.indexOf('if ($qtVersionLines.Count') < script.indexOf('AppendAllText('),
    'GitHub environment paths must be written after SDK verification');
  assert.match(nativeBuilder, /parentEnvironment\.CAVALRY_NATIVE_ASSETS_ROOT/);
  assert.match(nativeBuilder, /parentEnvironment\.CAVALRY_QT_PREFIX/);
  assert.match(nativeBuilder, /production native resource generation/);
});

test('the syntax driver keeps its PowerShell file contract', () => {
  const bytes = fs.readFileSync(parserPath);
  const text = bytes.subarray(3).toString('utf8');

  assert.deepEqual([...bytes.subarray(0, 3)], [0xef, 0xbb, 0xbf], 'syntax driver must use UTF-8 BOM');
  const crlfCount = (text.match(/\r\n/g) || []).length;
  const lfCount = (text.match(/\n/g) || []).length;
  assert.ok(crlfCount > 0, 'syntax driver must use CRLF');
  assert.equal(lfCount, crlfCount, 'syntax driver must not contain bare LF');
  assert.match(text, /^<#\r\n\[INPUT\]:/);
  assert.match(text, /\[OUTPUT\]:[\s\S]*\[POS\]:[\s\S]*\[PROTOCOL\]: 变更时更新此头部，然后检查 CLAUDE\.md/);
  assert.match(text, /System\.Management\.Automation\.Language\.Parser\]::ParseFile/);
  assert.match(text, /\$parseErrors/);
  assert.deepEqual(productionPowerShellFiles.map(file => path.basename(file)), [
    'prepare_cavalry_28_windows_ci_inputs.ps1',
    'check_windows_nsis_install.ps1',
    'windows_native_pack.ps1',
    'windows_native_pack_contract.ps1',
  ]);
});

test('Windows PowerShell parser accepts each production script without executing it', {
  skip: process.platform === 'win32' ? false : 'requires a Windows PowerShell host',
}, () => {
  for (const targetPath of productionPowerShellFiles) {
    const result = runPowerShellScript(parserPath, ['-Path', targetPath]);
    assert.equal(
      result.status,
      0,
      `PowerShell parser rejected ${path.basename(targetPath)} via ${result.command}`
    );
  }
  const invalid = path.join(makeTempDir(), 'invalid.ps1');
  fs.writeFileSync(invalid, 'if ($true\n -or $false) {}\n');
  assert.equal(runPowerShellScript(parserPath, ['-Path', invalid]).status, 1,
    'the real parser must reject the original broken continuation pattern');
});
