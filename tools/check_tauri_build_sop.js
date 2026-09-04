#!/usr/bin/env node
/**
 * [INPUT]: 依赖 package/CHANGELOG、跨平台工具、test_temp_dir.js、DMG 卷标身份解析器、人工安装/updater 发布元数据、共享 Windows NSIS provenance schema/合同/生命周期/live-clone、C++ text-path 源表顺序、PowerShell 双宿主/编码/Onboarding/Adjacent exact-HWND 边界、Tauri 配置与 macOS Info.plist 本地化资源、SOP/README/workflow、发布 provenance schema、Actions full-SHA pins、source artifact manifest 与原生产物忽略策略
 * [OUTPUT]: 对外提供 Tauri-only 发布协议、renderer 视觉验收新进程合同、人工安装/updater 资产命名、macOS DMG `产品 + SemVer + 架构` 卷标、显式 renderer 文档入口、SOP/配置同构窗口合同、`main`/`about` capability 边界、macOS App Management 用途说明及最终 app bundle readback 合同、tag 级 macOS ad-hoc 与独立 updater 签名边界、commit 绑定 acceptance evidence/asset seal、source 完整性、Actions/toolchain pin、幂等 release、平台原生构建隔离、Windows x64 provenance producer-consumer 同构与 PR 级 clean-macOS link gate
 * [POS]: tools 的 Phase 6 打包守门，连接发布协议、构建前 tag ancestry/acceptance、平台 Runner 原生构建、Windows NSIS 安装态与 npm/Tauri 配置
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const zlib = require('node:zlib');
const { spawnSync } = require('node:child_process');
const { installGitHooks } = require('./install_git_hooks.js');
const { runPowerShellScript } = require('./powershell_command.js');
const { resolvePythonCommand } = require('./python_command.js');
const { cleanupTempDirs, makeTempDir } = require('./test_temp_dir.js');
const {
  createDmgVolumeName,
  resolveDmgArchitecture,
} = require('./dmg_volume_identity.js');

test.after(cleanupTempDirs);

const repoRoot = path.resolve(__dirname, '..');

function readJson(relativePath) {
  const filePath = path.isAbsolute(relativePath) ? relativePath : path.join(repoRoot, relativePath);
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function readText(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

const MACOS_APP_MANAGEMENT_KEY = 'NSAppBundlesUsageDescription';
const MACOS_APP_MANAGEMENT_LOCALES = [
  {
    directory: 'en.lproj',
    value:
      "Allow Cavalry Language Switcher to modify Cavalry's local app files to switch its interface language.",
  },
  {
    directory: 'zh-Hans.lproj',
    value: '允许 Cavalry 语言切换器修改 Cavalry 的本地应用文件，以切换界面语言。',
  },
  {
    directory: 'zh-Hant.lproj',
    value: '允許 Cavalry 語言切換器修改 Cavalry 的本機應用程式檔案，以切換介面語言。',
  },
  {
    directory: 'ja.lproj',
    value:
      'Cavalry Language Switcher が Cavalry のローカルアプリファイルを変更し、表示言語を切り替えることを許可します。',
  },
];

function decodeXmlText(value) {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function readPlistString(plistText, key) {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = plistText.match(
    new RegExp(`<key>${escapedKey}</key>\\s*<string>([\\s\\S]*?)</string>`)
  );
  return match ? decodeXmlText(match[1].trim()) : null;
}

function readStringsFileValue(stringsText, key) {
  const entries = [];
  const entryPattern = /^\s*"((?:\\.|[^"])*)"\s*=\s*"((?:\\.|[^"])*)"\s*;\s*$/gm;
  for (const match of stringsText.matchAll(entryPattern)) {
    entries.push({ key: match[1], value: match[2] });
  }

  const matches = entries.filter((entry) => entry.key === key);
  assert.equal(matches.length, 1, `${key} must occur once in InfoPlist.strings`);
  assert.equal(entries.length, 1, 'InfoPlist.strings must contain only the declared purpose key');
  return matches[0].value.replace(/\\([\\"])/g, '$1');
}

function expectedMacOSInfoPlistFiles() {
  return Object.fromEntries(
    MACOS_APP_MANAGEMENT_LOCALES.map(({ directory }) => [
      `Resources/${directory}/InfoPlist.strings`,
      `${directory}/InfoPlist.strings`,
    ])
  );
}

function assertMacOSAppManagementSource() {
  const sourcePlist = readText('src-tauri/Info.plist');
  assert.deepEqual(
    [...sourcePlist.matchAll(/<key>([^<]+)<\/key>/g)].map((match) => match[1]),
    [MACOS_APP_MANAGEMENT_KEY],
    'the custom plist must add only the App Management purpose key'
  );
  assert.equal(
    readPlistString(sourcePlist, MACOS_APP_MANAGEMENT_KEY),
    MACOS_APP_MANAGEMENT_LOCALES[0].value
  );

  for (const { directory, value } of MACOS_APP_MANAGEMENT_LOCALES) {
    const relativePath = path.join('src-tauri', directory, 'InfoPlist.strings');
    assert.equal(readStringsFileValue(readText(relativePath), MACOS_APP_MANAGEMENT_KEY), value);
  }
}

function assertMacOSAppManagementBundle(bundlePath) {
  const contents = path.join(bundlePath, 'Contents');
  const bundlePlist = path.join(contents, 'Info.plist');
  assert.equal(fs.existsSync(bundlePlist), true, `missing bundle Info.plist: ${bundlePlist}`);
  assert.equal(
    readPlistString(fs.readFileSync(bundlePlist, 'utf8'), MACOS_APP_MANAGEMENT_KEY),
    MACOS_APP_MANAGEMENT_LOCALES[0].value
  );

  for (const { directory, value } of MACOS_APP_MANAGEMENT_LOCALES) {
    const resourcePath = path.join(contents, 'Resources', directory, 'InfoPlist.strings');
    const sourcePath = path.join(repoRoot, 'src-tauri', directory, 'InfoPlist.strings');
    assert.equal(fs.existsSync(resourcePath), true, `missing localized resource: ${resourcePath}`);
    assert.deepEqual(
      fs.readFileSync(resourcePath),
      fs.readFileSync(sourcePath),
      `${directory}/InfoPlist.strings must be copied byte-for-byte`
    );
    assert.equal(
      readStringsFileValue(fs.readFileSync(resourcePath, 'utf8'), MACOS_APP_MANAGEMENT_KEY),
      value
    );
  }
}

test('macOS DMG mounted volume identity is product, Switcher SemVer, and architecture', () => {
  const pkg = readJson('package.json');
  const producer = readText('tools/stamp_dmg_icon.sh');
  const verifier = readText('tools/check_dmg_layout.sh');
  const localSop = readText('LOCAL_BUILD_SOP.md');
  const workflow = readText('.github/workflows/build.yml');

  assert.equal(
    createDmgVolumeName('Cavalry Language Switcher_0.7.0_aarch64.dmg', {
      version: pkg.version,
    }),
    `Cavalry Switcher ${pkg.version} arm64`
  );
  assert.equal(
    createDmgVolumeName('Cavalry.Language.Switcher_Cavalry-2.7.2-p12_x64.dmg', {
      version: pkg.version,
    }),
    `Cavalry Switcher ${pkg.version} x64`
  );
  assert.equal(resolveDmgArchitecture('local-arm64.dmg'), 'arm64');
  assert.throws(
    () => resolveDmgArchitecture('Cavalry Language Switcher.dmg'),
    /supported macOS architecture/
  );
  assert.match(producer, /dmg_volume_identity\.js/);
  assert.match(producer, /diskutil rename "\$device_name" "\$volume_name"/);
  assert.match(verifier, /actual_volume_name/);
  assert.match(verifier, /DMG volume title mismatch/);
  assert.match(
    localSop,
    /挂载卷标固定为 `Cavalry Switcher <SemVer> <arch>`/
  );
  assert.match(
    workflow,
    /npm run tauri:build[\s\S]*bash tools\/stamp_dmg_icon\.sh[\s\S]*Name release DMG asset/
  );
});

test('macOS App Management purpose resources are source-complete and bundle-readable', () => {
  const macConfig = readJson('src-tauri/tauri.macos.conf.json');

  assertMacOSAppManagementSource();
  assert.deepEqual(macConfig.bundle.macOS.files, expectedMacOSInfoPlistFiles());

  const bundlePath = process.env.CAVALRY_I18N_TAURI_APP_BUNDLE;
  if (bundlePath) {
    assertMacOSAppManagementBundle(path.resolve(bundlePath));
  }
});

function rgbaPngAlphaContract(relativePath, threshold = 128) {
  const png = fs.readFileSync(path.join(repoRoot, relativePath));
  assert.equal(png.toString('hex', 0, 8), '89504e470d0a1a0a');
  let offset = 8;
  let width = 0;
  let height = 0;
  const idat = [];
  while (offset < png.length) {
    const length = png.readUInt32BE(offset);
    const type = png.toString('ascii', offset + 4, offset + 8);
    const data = png.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      assert.equal(data.readUInt8(8), 8, `${relativePath} must be 8-bit`);
      assert.equal(data.readUInt8(9), 6, `${relativePath} must be RGBA`);
      assert.equal(data.readUInt8(12), 0, `${relativePath} must not be interlaced`);
    } else if (type === 'IDAT') {
      idat.push(data);
    }
    offset += length + 12;
  }

  const bytesPerPixel = 4;
  const scanlineLength = width * bytesPerPixel;
  const inflated = zlib.inflateSync(Buffer.concat(idat));
  assert.equal(inflated.length, (scanlineLength + 1) * height);
  let previous = Buffer.alloc(scanlineLength);
  let firstDecoded = null;
  let sourceOffset = 0;
  let bounds = null;

  function paeth(left, above, upperLeft) {
    const estimate = left + above - upperLeft;
    const leftDistance = Math.abs(estimate - left);
    const aboveDistance = Math.abs(estimate - above);
    const upperLeftDistance = Math.abs(estimate - upperLeft);
    if (leftDistance <= aboveDistance && leftDistance <= upperLeftDistance) return left;
    return aboveDistance <= upperLeftDistance ? above : upperLeft;
  }

  for (let y = 0; y < height; y += 1) {
    const filter = inflated[sourceOffset];
    sourceOffset += 1;
    const current = Buffer.alloc(scanlineLength);
    for (let x = 0; x < scanlineLength; x += 1) {
      const raw = inflated[sourceOffset + x];
      const left = x >= bytesPerPixel ? current[x - bytesPerPixel] : 0;
      const above = previous[x];
      const upperLeft = x >= bytesPerPixel ? previous[x - bytesPerPixel] : 0;
      const predictor = [0, left, above, Math.floor((left + above) / 2), paeth(left, above, upperLeft)][filter];
      assert.notEqual(predictor, undefined, `${relativePath} uses unsupported PNG filter ${filter}`);
      current[x] = (raw + predictor) & 0xff;
    }
    sourceOffset += scanlineLength;
    if (y === 0) firstDecoded = Buffer.from(current);
    for (let x = 0; x < width; x += 1) {
      if (current[(x * bytesPerPixel) + 3] > threshold) {
        bounds = bounds
          ? [Math.min(bounds[0], x), Math.min(bounds[1], y), Math.max(bounds[2], x + 1), Math.max(bounds[3], y + 1)]
          : [x, y, x + 1, y + 1];
      }
    }
    previous = current;
  }
  const cornerAlpha = [
    3,
    ((width - 1) * bytesPerPixel) + 3,
  ].map((index) => previous[index]);
  cornerAlpha.unshift(firstDecoded[3], firstDecoded[((width - 1) * bytesPerPixel) + 3]);
  return { width, height, bounds, cornerAlpha };
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function makeVersionFixture() {
  const tempRoot = makeTempDir('cavalry-version-sync-');
  fs.mkdirSync(path.join(tempRoot, 'tools'), { recursive: true });
  fs.mkdirSync(path.join(tempRoot, 'src-tauri'), { recursive: true });

  fs.copyFileSync(
    path.join(repoRoot, 'tools', 'sync_project_version.js'),
    path.join(tempRoot, 'tools', 'sync_project_version.js')
  );
  fs.writeFileSync(
    path.join(tempRoot, 'CHANGELOG.md'),
    [
      '# Changelog',
      '',
      '## [Unreleased]',
      '',
      '## [9.8.7] - 2026-05-14',
      '- Release fixture.',
      '',
    ].join('\n')
  );
  writeJson(path.join(tempRoot, 'package.json'), { name: 'cavalry-i18n', version: '0.1.0' });
  writeJson(path.join(tempRoot, 'package-lock.json'), {
    name: 'cavalry-i18n',
    version: '0.1.0',
    lockfileVersion: 3,
    packages: {
      '': {
        name: 'cavalry-i18n',
        version: '0.1.0',
      },
    },
  });
  fs.writeFileSync(
    path.join(tempRoot, 'src-tauri', 'Cargo.toml'),
    [
      '[package]',
      'name = "cavalry-i18n-tauri"',
      'version = "0.1.0"',
      'edition = "2021"',
      '',
    ].join('\n')
  );
  writeJson(path.join(tempRoot, 'src-tauri', 'tauri.conf.json'), {
    productName: 'Cavalry Language Switcher',
    version: '0.1.0',
  });
  fs.writeFileSync(
    path.join(tempRoot, 'src-tauri', 'Cargo.lock'),
    [
      '# This file is automatically @generated by Cargo.',
      'version = 4',
      '',
      '[[package]]',
      'name = "cavalry-i18n-tauri"',
      'version = "0.1.0"',
      'dependencies = [',
      ' "tauri",',
      ']',
      '',
      '[[package]]',
      'name = "dpi"',
      'version = "0.1.2"',
      '',
    ].join('\n')
  );

  return tempRoot;
}

function makeWindowsNsisProvenanceFixture() {
  const tempRoot = makeTempDir('cavalry-windows-nsis-provenance-');
  const write = (relativePath, content) => {
    const filePath = path.join(tempRoot, relativePath);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content);
  };
  fs.mkdirSync(path.join(tempRoot, 'tools'), { recursive: true });
  fs.copyFileSync(
    path.join(repoRoot, 'tools', 'windows_nsis_provenance.js'),
    path.join(tempRoot, 'tools', 'windows_nsis_provenance.js')
  );
  fs.copyFileSync(
    path.join(repoRoot, 'tools', 'windows_nsis_provenance_contract.js'),
    path.join(tempRoot, 'tools', 'windows_nsis_provenance_contract.js')
  );
  fs.mkdirSync(path.join(tempRoot, 'tools', 'schemas'), { recursive: true });
  fs.copyFileSync(
    path.join(repoRoot, 'tools', 'schemas', 'windows_nsis_provenance.schema.json'),
    path.join(tempRoot, 'tools', 'schemas', 'windows_nsis_provenance.schema.json')
  );
  writeJson(path.join(tempRoot, 'package.json'), { name: 'cavalry-i18n', version: '9.8.7' });
  writeJson(path.join(tempRoot, 'package-lock.json'), {
    name: 'cavalry-i18n',
    version: '9.8.7',
    lockfileVersion: 3,
    packages: { '': { name: 'cavalry-i18n', version: '9.8.7' } },
  });
  writeJson(path.join(tempRoot, 'src-tauri', 'tauri.conf.json'), {
    productName: 'Cavalry Language Switcher',
    version: '9.8.7',
    build: { frontendDist: '../renderer' },
  });
  writeJson(path.join(tempRoot, 'src-tauri', 'tauri.windows.conf.json'), {
    bundle: {
      targets: ['nsis'],
      resources: {
        '../languages': 'languages',
        '../injector/windows/generic/cavalryi18n.dll': 'injector/windows/generic/cavalryi18n.dll',
        '../injector/windows/qpa/qwindows.dll': 'injector/windows/qpa/qwindows.dll',
      },
      windows: {
        nsis: {
          installerHooks: 'nsis-hooks.nsh',
        },
      },
    },
  });
  writeJson(path.join(tempRoot, 'src-tauri', 'tauri.updater-artifacts.conf.json'), {
    bundle: { createUpdaterArtifacts: true },
  });
  writeJson(path.join(tempRoot, 'src-tauri', 'capabilities', 'default.json'), { permissions: [] });
  write('renderer/index.html', '<!doctype html><title>fixture</title>');
  write('languages/en/appStrings.json', '{"fixture":"English"}\n');
  write('src-tauri/src/lib.rs', 'pub fn fixture() {}\n');
  write('src-tauri/Cargo.toml', '[package]\nname = "fixture"\nversion = "9.8.7"\n');
  write('src-tauri/Cargo.lock', 'version = 4\n');
  write('src-tauri/build.rs', 'fn main() {}\n');
  write('src-tauri/nsis-hooks.nsh', '!macro NSIS_HOOK_POSTUNINSTALL\n!macroend\n');
  write('src-tauri/icons/icon.ico', Buffer.from([0, 0, 1, 0]));
  write(
    'injector/cavalry_i18n_translation_policy.h',
    '// shared Windows/macOS translation policy fixture\n'
  );
  write('injector/generated_translations.inc', '// generated translation fixture\n');
  write(
    'injector/windows/CMakeLists.txt',
    'cmake_minimum_required(VERSION 3.21)\nproject(cavalryi18n_fixture)\n'
  );
  write(
    'injector/windows/cavalry_i18n_qpa_proxy.cpp',
    '// Windows native source fixture\n'
  );
  write('injector/windows/generic/cavalryi18n.dll', Buffer.from('fixture-plugin'));
  write('injector/windows/qpa/qwindows.dll', Buffer.from('fixture-qpa-proxy'));
  return tempRoot;
}

test('tauri local build SOP is the only release path', () => {
  const localSop = readText('LOCAL_BUILD_SOP.md');
  const manualMacSmoke = readText('src-tauri/tests/manual_macos_smoke.rs');

  assert.match(localSop, /Tauri/i);
  assert.match(localSop, /npm run tauri:build/);
  assert.match(localSop, /npm run prepare:qt-sdk/);
  assert.match(localSop, /npm run prepare:qt-sdk:windows/);
  assert.match(localSop, /APPLE_SIGNING_IDENTITY="-"/);
  assert.match(localSop, /tools\/cavalry_qt_target\.json/);
  assert.match(localSop, /6\.6\.3/);
  assert.match(localSop, /renderer 视觉验收必须使用新进程/);
  assert.match(localSop, /pkill -f 'target\/debug\/cavalry-i18n-tauri'/);
  assert.match(localSop, /STALE-RESOURCE-UNVERIFIED/);
  assert.match(localSop, /CAVALRY_I18N_MACOS_SMOKE_APP="\/Volumes\/Cavalry\/Cavalry\.app"/);
  assert.match(localSop, /只读挂载的官方 Cavalry 2\.7\.2 DMG/);
  assert.match(manualMacSmoke, /const SOURCE_APP_ENV: &str = "CAVALRY_I18N_MACOS_SMOKE_APP"/);
  assert.match(manualMacSmoke, /requested\.is_absolute\(\)/);
  assert.match(manualMacSmoke, /critical_source_snapshot\(&source\)/);
  assert.doesNotMatch(localSop, /Electron|electron-builder|test:desktop|check:desktop|desktop-patcher/);
});

test('tauri build scripts and configs isolate the macOS and Windows injectors', () => {
  const pkg = readJson('package.json');
  const config = readJson('src-tauri/tauri.conf.json');
  const macConfig = readJson('src-tauri/tauri.macos.conf.json');
  const windowsConfig = readJson('src-tauri/tauri.windows.conf.json');
  const macResources = macConfig.bundle.resources;
  const windowsResources = windowsConfig.bundle.resources;
  const windowsNsis = windowsConfig.bundle.windows.nsis;
  const qtTarget = readJson('tools/cavalry_qt_target.json');

  assert.equal(
    pkg.scripts['tauri:build'],
    'tauri build --config src-tauri/tauri.macos.conf.json'
  );
  assert.equal(pkg.scripts.build, 'npm run tauri:build');
  assert.equal(
    pkg.scripts['build:tauri:windows'],
    'npm run prepare:qt-sdk:windows && tauri build --target x86_64-pc-windows-msvc --config src-tauri/tauri.windows.conf.json && node tools/windows_nsis_provenance.js --record'
  );
  assert.equal(
    pkg.scripts['build:injector:windows'],
    'node tools/powershell_command.js injector/windows/build.ps1'
  );
  assert.equal(
    pkg.scripts['prepare:tauri:windows-bundle'],
    'npm run build:injector:windows && node tools/windows_nsis_provenance.js --prepare'
  );
  assert.equal(
    pkg.scripts['test:tauri:windows-nsis'],
    'node tools/powershell_command.js tools/check_windows_nsis_install.ps1'
  );
  assert.equal(
    pkg.scripts['test:tauri:manual-windows-live-smoke'],
    'cd src-tauri && cargo test --test manual_windows_live_smoke -- --ignored --nocapture'
  );
  assert.equal(pkg.scripts.desktop, undefined);
  assert.equal(pkg.scripts['build:electron'], undefined);
  assert.equal(pkg.scripts['build:electron:dir'], undefined);
  assert.equal(pkg.scripts['build:dir'], undefined);
  assert.equal(pkg.build, undefined);
  assert.match(pkg.scripts['check:app'], /node --check tools\/windows_nsis_provenance\.js/);
  assert.match(pkg.scripts['check:app'], /node --check tools\/windows_nsis_provenance_contract\.js/);
  assert.equal(pkg.devDependencies.electron, undefined);
  assert.equal(pkg.devDependencies['electron-builder'], undefined);
  assert.equal(pkg.scripts['prepare:qt-sdk'], 'node tools/resolve_cavalry_qt_sdk.js --ensure');
  assert.equal(
    pkg.scripts['prepare:qt-sdk:windows'],
    'node tools/resolve_cavalry_qt_sdk.js --platform windows --ensure'
  );
  assert.match(pkg.scripts['build:injector'], /resolve_cavalry_qt_sdk\.js --print-env --ensure/);
  assert.match(pkg.scripts['build:injector'], /build_translator_injector\.sh injector\/libCavalryTranslatorInjector\.dylib/);
  assert.equal(qtTarget.qtVersion, '6.6.3');
  assert.equal(qtTarget.platforms.macos.sdkPath, 'qt_sdk/6.6.3/macos');
  assert.equal(qtTarget.platforms.macos.aqt.arch, 'clang_64');
  assert.equal(qtTarget.platforms.windows.sdkPath, 'qt_sdk/6.6.3/msvc2019_64');
  assert.equal(qtTarget.platforms.windows.aqt.arch, 'win64_msvc2019_64');
  assert.equal(config.build.beforeBuildCommand, undefined);
  assert.equal(config.build.frontendDist, '../renderer');
  assert.equal(config.app.withGlobalTauri, false);
  assert.equal(macConfig.build.beforeDevCommand, 'npm run build:injector');
  assert.equal(macConfig.build.beforeBuildCommand, 'npm run build:injector');
  assert.deepEqual(macConfig.bundle.targets, ['dmg', 'app']);
  assert.equal(macResources['../languages'], 'languages');
  assert.equal(
    macResources['../injector/libCavalryTranslatorInjector.dylib'],
    'injector/libCavalryTranslatorInjector.dylib'
  );
  assert.deepEqual(windowsConfig.bundle.targets, ['nsis']);
  assert.deepEqual(windowsConfig.bundle.icon, ['icons/icon.ico']);
  assert.equal(windowsConfig.build.beforeDevCommand, 'npm run build:injector:windows');
  assert.equal(windowsConfig.build.beforeBuildCommand, 'npm run prepare:tauri:windows-bundle');
  assert.equal(windowsNsis.installerHooks, 'nsis-hooks.nsh');
  assert.deepEqual(windowsNsis.languages, [
    'English',
    'SimpChinese',
    'TradChinese',
    'Japanese',
  ]);
  assert.equal(windowsNsis.displayLanguageSelector, false);
  assert.equal(windowsNsis.installerIcon, 'icons/icon.ico');
  assert.equal(
    fs.existsSync(path.join(repoRoot, 'src-tauri', windowsNsis.installerIcon)),
    true
  );
  assert.equal(windowsNsis.headerImage, undefined);
  assert.equal(windowsNsis.sidebarImage, undefined);
  assert.deepEqual(windowsResources, {
    '../languages': 'languages',
    '../injector/windows/generic/cavalryi18n.dll': 'injector/windows/generic/cavalryi18n.dll',
    '../injector/windows/qpa/qwindows.dll': 'injector/windows/qpa/qwindows.dll',
  });
  assert.equal(
    Object.entries(windowsResources).some(([source, destination]) => /Qt6.*\.dll/i.test(`${source}\n${destination}`)),
    false,
    'Windows resources must reuse Cavalry Qt instead of bundling a second runtime'
  );
});

test('Windows NSIS provenance binds one new installer to current dirty packaging inputs', () => {
  const tempRoot = makeWindowsNsisProvenanceFixture();
  const script = path.join(tempRoot, 'tools', 'windows_nsis_provenance.js');
  const bundleRoot = path.join(
    tempRoot,
    'src-tauri',
    'target',
    'x86_64-pc-windows-msvc',
    'release',
    'bundle',
    'nsis'
  );
  const installerName = 'Cavalry Language Switcher_9.8.7_x64-setup.exe';
  const installerPath = path.join(bundleRoot, installerName);
  const provenanceModule = require(script);
  const run = (...args) => spawnSync(process.execPath, [script, ...args], {
    cwd: tempRoot,
    encoding: 'utf8',
  });

  fs.mkdirSync(bundleRoot, { recursive: true });
  fs.writeFileSync(installerPath, 'stale-current-version-installer');
  const prepared = run('--prepare');
  assert.equal(prepared.status, 0, prepared.stderr || prepared.stdout);
  assert.equal(fs.existsSync(installerPath), false, 'prepare must remove only the expected old installer');
  assert.equal(
    fs.existsSync(path.join(bundleRoot, 'cavalry-i18n-windows-nsis-build-intent.json')),
    true,
    'prepare must leave a build intent for record'
  );

  fs.writeFileSync(installerPath, 'fresh-installer-bytes');
  const recorded = run('--record');
  assert.equal(recorded.status, 0, recorded.stderr || recorded.stdout);
  const provenancePath = `${installerPath}.provenance.json`;
  const provenance = JSON.parse(fs.readFileSync(provenancePath, 'utf8'));
  assert.equal(provenance.target, 'x86_64-pc-windows-msvc');
  assert.equal(provenance.version, '9.8.7');
  assert.equal(provenance.installer.fileName, installerName);
  assert.equal(provenance.installer.bytes, Buffer.byteLength('fresh-installer-bytes'));
  assert.equal(provenance.updaterSignature, null);
  assert.ok(provenance.inputFingerprint.files.some((entry) => entry.path === 'renderer/index.html'));
  assert.ok(provenance.inputFingerprint.files.some((entry) => entry.path === 'languages/en/appStrings.json'));
  assert.ok(provenance.inputFingerprint.files.some((entry) => entry.path === 'src-tauri/src/lib.rs'));
  assert.ok(provenance.inputFingerprint.files.some((entry) => entry.path === 'injector/windows/generic/cavalryi18n.dll'));
  assert.ok(provenance.inputFingerprint.files.some((entry) => entry.path === 'injector/windows/qpa/qwindows.dll'));
  for (const requiredInput of [
    'package.json',
    'package-lock.json',
    'src-tauri/Cargo.toml',
    'src-tauri/Cargo.lock',
    'src-tauri/build.rs',
    'src-tauri/tauri.conf.json',
    'src-tauri/tauri.windows.conf.json',
    'src-tauri/tauri.updater-artifacts.conf.json',
    'src-tauri/nsis-hooks.nsh',
    'src-tauri/capabilities/default.json',
    'src-tauri/icons/icon.ico',
    'injector/cavalry_i18n_translation_policy.h',
    'injector/generated_translations.inc',
    'injector/windows/CMakeLists.txt',
    'injector/windows/cavalry_i18n_qpa_proxy.cpp',
  ]) {
    assert.ok(
      provenance.inputFingerprint.files.some((entry) => entry.path === requiredInput),
      `provenance must bind ${requiredInput}`
    );
  }

  const verified = run('--verify', installerPath);
  assert.equal(verified.status, 0, verified.stderr || verified.stdout);
  assert.equal(provenanceModule.TARGET_TRIPLE, 'x86_64-pc-windows-msvc');
  assert.doesNotThrow(() => provenanceModule.verify(fs.realpathSync.native(tempRoot), installerPath));
  fs.appendFileSync(installerPath, '-tampered');
  assert.throws(
    () => provenanceModule.verify(fs.realpathSync.native(tempRoot), installerPath),
    /sidecar does not match the current installer bytes and packaging input fingerprint/
  );
  fs.writeFileSync(installerPath, 'fresh-installer-bytes');
  fs.appendFileSync(
    path.join(tempRoot, 'injector', 'windows', 'cavalry_i18n_qpa_proxy.cpp'),
    '// dirty-after-package\n'
  );
  const staleNativeSource = run('--verify', installerPath);
  assert.notEqual(
    staleNativeSource.status,
    0,
    'a dirty native source input must invalidate the old installer sidecar'
  );
  assert.match(
    staleNativeSource.stderr,
    /sidecar does not match the current installer bytes and packaging input fingerprint/
  );
  fs.writeFileSync(
    path.join(tempRoot, 'injector', 'windows', 'cavalry_i18n_qpa_proxy.cpp'),
    '// Windows native source fixture\n'
  );
  fs.appendFileSync(
    path.join(tempRoot, 'injector', 'cavalry_i18n_translation_policy.h'),
    '// dirty-shared-policy-after-package\n'
  );
  const staleSharedTranslationPolicy = run('--verify', installerPath);
  assert.notEqual(
    staleSharedTranslationPolicy.status,
    0,
    'a dirty shared translation policy must invalidate the old installer sidecar'
  );
  assert.match(
    staleSharedTranslationPolicy.stderr,
    /sidecar does not match the current installer bytes and packaging input fingerprint/
  );
  fs.writeFileSync(
    path.join(tempRoot, 'injector', 'cavalry_i18n_translation_policy.h'),
    '// shared Windows/macOS translation policy fixture\n'
  );
  fs.appendFileSync(path.join(tempRoot, 'injector', 'windows', 'qpa', 'qwindows.dll'), '-dirty-after-package');
  const staleInputs = run('--verify', installerPath);
  assert.notEqual(staleInputs.status, 0, 'a dirty packaging input must invalidate the old installer sidecar');
  assert.match(staleInputs.stderr, /sidecar does not match the current installer bytes and packaging input fingerprint/);
});

test('Windows NSIS provenance binds an updater signature only when tag intent requires it', () => {
  const tempRoot = makeWindowsNsisProvenanceFixture();
  const script = path.join(tempRoot, 'tools', 'windows_nsis_provenance.js');
  const bundleRoot = path.join(
    tempRoot,
    'src-tauri',
    'target',
    'x86_64-pc-windows-msvc',
    'release',
    'bundle',
    'nsis'
  );
  const installerPath = path.join(bundleRoot, 'Cavalry Language Switcher_9.8.7_x64-setup.exe');
  const signaturePath = `${installerPath}.sig`;
  const run = (...args) => spawnSync(process.execPath, [script, ...args], {
    cwd: tempRoot,
    encoding: 'utf8',
    env: { ...process.env, CAVALRY_I18N_EXPECT_UPDATER_SIGNATURE: '1' },
  });

  fs.mkdirSync(bundleRoot, { recursive: true });
  const prepared = run('--prepare');
  assert.equal(prepared.status, 0, prepared.stderr || prepared.stdout);
  fs.writeFileSync(installerPath, 'tag-installer');
  fs.writeFileSync(signaturePath, `${Buffer.from('tag-updater-signature').toString('base64')}\n`);
  const recorded = run('--record');
  assert.equal(recorded.status, 0, recorded.stderr || recorded.stdout);
  const provenance = JSON.parse(fs.readFileSync(`${installerPath}.provenance.json`, 'utf8'));
  assert.equal(provenance.schemaVersion, 2);
  assert.equal(provenance.updaterSignature.fileName, path.basename(signaturePath));
  const verified = run('--verify', installerPath);
  assert.equal(verified.status, 0, verified.stderr || verified.stdout);
  fs.appendFileSync(signaturePath, 'tamper');
  const tampered = run('--verify', installerPath);
  assert.notEqual(tampered.status, 0);
  assert.match(tampered.stderr, /sidecar does not match/);
});

test('Windows NSIS provenance refuses foreign stale installers instead of broad deletion', () => {
  const tempRoot = makeWindowsNsisProvenanceFixture();
  const script = path.join(tempRoot, 'tools', 'windows_nsis_provenance.js');
  const bundleRoot = path.join(
    tempRoot,
    'src-tauri',
    'target',
    'x86_64-pc-windows-msvc',
    'release',
    'bundle',
    'nsis'
  );
  const foreignInstaller = path.join(bundleRoot, 'Cavalry Language Switcher_9.8.6_x64-setup.exe');
  fs.mkdirSync(bundleRoot, { recursive: true });
  fs.writeFileSync(foreignInstaller, 'foreign-stale-installer');

  const prepared = spawnSync(process.execPath, [script, '--prepare'], {
    cwd: tempRoot,
    encoding: 'utf8',
  });
  assert.notEqual(prepared.status, 0);
  assert.match(prepared.stderr, /refusing to erase non-current Windows installer output/);
  assert.equal(fs.existsSync(foreignInstaller), true, 'prepare must leave foreign output untouched');
});

test('Windows NSIS provenance refuses an orphan sidecar instead of uploading stale metadata', () => {
  const tempRoot = makeWindowsNsisProvenanceFixture();
  const script = path.join(tempRoot, 'tools', 'windows_nsis_provenance.js');
  const bundleRoot = path.join(
    tempRoot,
    'src-tauri',
    'target',
    'x86_64-pc-windows-msvc',
    'release',
    'bundle',
    'nsis'
  );
  const orphanSidecar = path.join(bundleRoot, 'Cavalry Language Switcher_9.8.6_x64-setup.exe.provenance.json');
  fs.mkdirSync(bundleRoot, { recursive: true });
  fs.writeFileSync(orphanSidecar, '{}\n');

  const prepared = spawnSync(process.execPath, [script, '--prepare'], {
    cwd: tempRoot,
    encoding: 'utf8',
  });
  assert.notEqual(prepared.status, 0);
  assert.match(prepared.stderr, /refusing to erase non-current Windows installer output/);
  assert.equal(fs.existsSync(orphanSidecar), true, 'prepare must leave orphan sidecar visible');
});

test('project version workflow exposes one synchronizer and a pre-commit hook installer', () => {
  const pkg = readJson('package.json');

  assert.equal(pkg.scripts['sync:version'], 'node tools/sync_project_version.js');
  assert.equal(pkg.scripts['check:version'], 'node tools/sync_project_version.js --check');
  assert.equal(pkg.scripts['release:metadata'], 'node tools/release_metadata.js');
  assert.equal(pkg.scripts['check:release'], 'node tools/release_metadata.js --check');
  assert.match(pkg.scripts['check:app'], /node --check tools\/extract_release_changelog\.js/);
  assert.equal(pkg.scripts['hooks:install'], 'node tools/install_git_hooks.js');
  assert.equal(pkg.scripts.postinstall, 'npm run hooks:install');
  assert.doesNotMatch(pkg.scripts['hooks:install'], /\/dev\/null|&&|\|\||\btrue\b/);

  const nonGitRoot = makeTempDir('cavalry-hook-install-');
  const result = spawnSync(process.execPath, [path.join(repoRoot, 'tools', 'install_git_hooks.js')], {
    cwd: nonGitRoot,
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stderr, /skipped \(not-a-git-worktree\)/);

  const calls = [];
  const nodePath = 'D:\\Portable Node\\node.exe';
  const installed = installGitHooks({
    cwd: 'D:\\repo',
    nodePath,
    spawn: (command, args, options) => {
      calls.push({ command, args, cwd: options.cwd });
      return args[0] === 'rev-parse'
        ? { status: 0, stdout: 'true\n' }
        : { status: 0, stdout: '' };
    },
  });
  assert.deepEqual(installed, { installed: true, reason: 'configured' });
  assert.deepEqual(calls, [
    {
      command: 'git',
      args: ['--version'],
      cwd: undefined,
    },
    {
      command: 'git',
      args: ['rev-parse', '--is-inside-work-tree'],
      cwd: 'D:\\repo',
    },
    {
      command: 'git',
      args: ['config', 'core.hooksPath', 'tools/git-hooks'],
      cwd: 'D:\\repo',
    },
    {
      command: 'git',
      args: ['config', 'cavalry-i18n.nodePath', nodePath],
      cwd: 'D:\\repo',
    },
  ]);
});

test('Python resolver honors PYTHON and probes Windows launchers without a shell', () => {
  const explicit = resolvePythonCommand({
    env: { PYTHON: '"C:\\Program Files\\Python\\python.exe"' },
    platform: 'win32',
    spawn: () => {
      throw new Error('explicit PYTHON must not be probed');
    },
  });
  assert.deepEqual(explicit, {
    command: 'C:\\Program Files\\Python\\python.exe',
    args: [],
  });

  const probes = [];
  const discovered = resolvePythonCommand({
    env: {},
    platform: 'win32',
    spawn: (command, args) => {
      probes.push([command, args]);
      return { status: command === 'python' ? 0 : 1 };
    },
  });
  assert.deepEqual(probes[0], ['py', ['-3', '-c', 'import sys']]);
  assert.deepEqual(probes[1], ['python', ['-c', 'import sys']]);
  assert.deepEqual(discovered, { command: 'python', args: [] });

  const localAppData = 'C:\\Users\\Codex\\AppData\\Local';
  const localLauncher = path.join(
    localAppData,
    'Programs',
    'Python',
    'Launcher',
    'py.exe'
  );
  const launcherProbes = [];
  const localDiscovered = resolvePythonCommand({
    env: { LOCALAPPDATA: localAppData },
    platform: 'win32',
    spawn: (command, args) => {
      launcherProbes.push([command, args]);
      return { status: command === localLauncher ? 0 : 1 };
    },
  });
  assert.deepEqual(launcherProbes, [
    [localLauncher, ['-3', '-c', 'import sys']],
  ]);
  assert.deepEqual(localDiscovered, {
    command: localLauncher,
    args: ['-3'],
  });

  assert.throws(
    () =>
      resolvePythonCommand({
        env: {},
        platform: 'win32',
        spawn: () => ({ status: 1 }),
      }),
    /找不到 Python 3.*PYTHON/
  );
});

test('PowerShell launcher prefers pwsh and falls back only when the host is absent', () => {
  const inheritedEnvironment = {
    PATH: String.raw`C:\Windows\System32`,
    PSModulePath: String.raw`C:\Program Files\PowerShell\7\Modules`,
    PSMODULEPATH: String.raw`C:\stale-case-variant`,
  };
  const successCalls = [];
  const success = runPowerShellScript('fixture.ps1', ['fixture-argument'], {
    env: inheritedEnvironment,
    spawn: (command, args, options) => {
      successCalls.push({ command, args, options });
      return { status: 0 };
    },
  });

  assert.equal(success.command, 'pwsh.exe');
  assert.equal(success.status, 0);
  assert.equal(successCalls.length, 1);
  assert.deepEqual(successCalls[0].args, [
    '-NoLogo',
    '-NoProfile',
    '-NonInteractive',
    '-ExecutionPolicy',
    'Bypass',
    '-File',
    'fixture.ps1',
    'fixture-argument',
  ]);
  assert.equal(successCalls[0].options.shell, false);

  const fallbackCalls = [];
  const missing = Object.assign(new Error('pwsh.exe was not found'), { code: 'ENOENT' });
  const fallbackResult = runPowerShellScript('fixture.ps1', ['fixture-argument'], {
    env: inheritedEnvironment,
    spawn: (command, args, options) => {
      fallbackCalls.push({ command, args, options });
      return command === 'pwsh.exe' ? { error: missing, status: null } : { status: 0 };
    },
  });

  assert.equal(fallbackResult.command, 'powershell.exe');
  assert.equal(fallbackResult.status, 0);
  assert.deepEqual(
    fallbackCalls.map(({ command }) => command),
    ['pwsh.exe', 'powershell.exe']
  );
  assert.deepEqual(fallbackCalls[1].args, successCalls[0].args);
  assert.equal(fallbackCalls[1].options.shell, false);
  assert.equal(fallbackCalls[1].options.windowsHide, true);
  assert.equal(fallbackCalls[1].options.stdio, 'inherit');
  assert.equal(fallbackCalls[1].options.env.PATH, inheritedEnvironment.PATH);
  assert.equal(
    Object.keys(fallbackCalls[1].options.env).some(
      (key) => key.toLowerCase() === 'psmodulepath'
    ),
    false
  );

  const failureCalls = [];
  const scriptFailure = runPowerShellScript('fixture.ps1', [], {
    env: inheritedEnvironment,
    spawn: (command, args, options) => {
      failureCalls.push({ command, args, options });
      return { status: 17 };
    },
  });

  assert.equal(scriptFailure.command, 'pwsh.exe');
  assert.equal(scriptFailure.status, 17);
  assert.equal(failureCalls.length, 1);
  assert.equal(failureCalls[0].options.env.PSModulePath, inheritedEnvironment.PSModulePath);

  let signalCalls = 0;
  const signaled = runPowerShellScript('fixture.ps1', [], {
    spawn: () => {
      signalCalls += 1;
      return { signal: 'SIGTERM', status: null };
    },
  });
  assert.equal(signaled.signal, 'SIGTERM');
  assert.equal(signaled.status, null);
  assert.equal(signalCalls, 1);

  const denied = Object.assign(new Error('pwsh.exe access denied'), { code: 'EACCES' });
  let deniedCalls = 0;
  assert.throws(
    () =>
      runPowerShellScript('fixture.ps1', [], {
        spawn: () => {
          deniedCalls += 1;
          return { error: denied, status: null };
        },
      }),
    /access denied/
  );
  assert.equal(deniedCalls, 1);

  assert.throws(
    () =>
      runPowerShellScript('fixture.ps1', [], {
        spawn: () => ({ error: missing, status: null }),
      }),
    /PowerShell 5\.1 or newer was not found/
  );
});

test('release protocol separates internal SemVer from target Cavalry tag naming', () => {
  const releaseConfig = readJson('release.config.json');
  const workflow = readText('.github/workflows/build.yml');
  const localSop = readText('LOCAL_BUILD_SOP.md');
  const windowsBuild = readText('injector/windows/build.ps1');
  const windowsCmake = readText('injector/windows/CMakeLists.txt');
  const windowsProvenance = readText('tools/windows_nsis_provenance.js');
  const macBuild = readText('tools/build_translator_injector.sh');
  const gitignore = readText('.gitignore');

  assert.equal(releaseConfig.targetCavalryVersion, '2.7.2');
  assert.equal(releaseConfig.releaseTagPrefix, 'cavalry-2.7.2-p');
  assert.equal(releaseConfig.releaseTagPattern, '^cavalry-2\\.7\\.2-p[0-9]+$');
  assert.equal(
    releaseConfig.releaseTitleTemplate,
    'Cavalry Language Switcher for Cavalry 2.7.2 patch ${patch}'
  );
  assert.deepEqual(releaseConfig.assetNameTemplates, {
    aarch64: 'Cavalry.Language.Switcher_Cavalry-2.7.2-p${patch}_aarch64.dmg',
    x64: 'Cavalry.Language.Switcher_Cavalry-2.7.2-p${patch}_x64.dmg',
    windowsX64: 'Cavalry.Language.Switcher_Cavalry-2.7.2-p${patch}_windows-x64-setup.exe',
  });
  assert.deepEqual(Object.keys(releaseConfig.assetNameTemplates).sort(), ['aarch64', 'windowsX64', 'x64']);
  assert.deepEqual(releaseConfig.updater, {
    manifestAssetName: 'latest.json',
    downloadBaseUrl: 'https://github.com/daftAI2026/Cavalry-i18n/releases/latest/download',
    macOSAssetNameTemplates: {
      aarch64: 'Cavalry.Language.Switcher_Cavalry-2.7.2-p${patch}_aarch64.app.tar.gz',
      x64: 'Cavalry.Language.Switcher_Cavalry-2.7.2-p${patch}_x64.app.tar.gz',
    },
  });
  assert.match(windowsBuild, /'-A', 'x64'/);
  assert.match(windowsBuild, /function Assert-NoReparsePathChain/);
  assert.match(windowsBuild, /function Reset-GeneratedBuildDirectory/);
  assert.match(windowsBuild, /Get-Command node\.exe/);
  const generateTranslationsIndex = windowsBuild.indexOf(
    '& $nodeCommand.Source $translationGenerator $generatedTranslations'
  );
  const resetBuildIndex = windowsBuild.indexOf('\nReset-GeneratedBuildDirectory');
  const configureIndex = windowsBuild.indexOf('& $cmake @cmakeConfigureArguments');
  assert.ok(generateTranslationsIndex >= 0, 'Windows injector build must regenerate the shared table');
  assert.ok(
    generateTranslationsIndex < resetBuildIndex && resetBuildIndex < configureIndex,
    'translation generation must precede the clean CMake configure/build'
  );
  const macGenerateTranslationsIndex = macBuild.indexOf(
    'node "$REPO_ROOT/tools/generate_embedded_translations.js" "$GENERATED"'
  );
  const macCompileIndex = macBuild.indexOf(
    'clang++ \\\n  -std=c++17 \\\n  -O2'
  );
  assert.ok(macGenerateTranslationsIndex >= 0, 'macOS injector build must regenerate the shared table');
  assert.ok(macCompileIndex >= 0, 'macOS injector production compile command missing');
  assert.ok(
    macGenerateTranslationsIndex < macCompileIndex,
    'macOS injector build must regenerate the shared table before the production compile'
  );
  assert.match(gitignore, /^\/injector\/libCavalryTranslatorInjector\.dylib$/m);
  assert.match(gitignore, /^\/injector\/windows\/generic\/cavalryi18n\.dll$/m);
  assert.match(gitignore, /^\/injector\/windows\/qpa\/qwindows\.dll$/m);
  assert.match(
    windowsBuild,
    /GetDirectoryName\(\$buildDirectory\)[\s\S]*Remove-Item -LiteralPath \$buildDirectory -Recurse -Force/
  );
  assert.match(
    windowsBuild,
    /Assert-NoReparsePathChain -Path \$publishedPlugin[\s\S]*Assert-NoReparsePathChain -Path \$publishedQpaProxy/
  );
  assert.match(windowsCmake, /must be built for x64/);
  assert.match(windowsCmake, /must come from the shared Qt 6\.6\.3 SDK/);
  assert.match(windowsProvenance, /function assertNoReparsePathChain/);
  assert.match(
    windowsProvenance,
    /path\.join\('injector', 'windows'\)[\s\S]*\(\?:cpp\|h\|json\|ps1\)[\s\S]*injector', 'generated_translations\.inc'/
  );
  assert.match(
    windowsProvenance,
    /assertNoReparsePathChain\(bundleRoot, 'Windows NSIS bundle root'\)[\s\S]*fs\.mkdirSync\(bundleRoot[\s\S]*assertNoReparsePathChain\(bundleRoot, 'Windows NSIS bundle root after creation'\)/
  );
  assert.match(workflow, /tags:\s*\['cavalry-\*-p\*'\]/);
  const preflightJob = workflow.match(
    /\r?\n  release_tag_preflight:\r?\n([\s\S]*?)(?=\r?\n  [a-zA-Z_][a-zA-Z0-9_]*:|\s*$)/
  );
  const releaseJob = workflow.match(
    /\r?\n  release:\r?\n([\s\S]*?)(?=\r?\n  [a-zA-Z_][a-zA-Z0-9_]*:|\s*$)/
  );
  assert.ok(preflightJob, 'release_tag_preflight job missing');
  assert.ok(releaseJob, 'release job missing');
  assert.match(
    preflightJob[1],
    /if:\s*startsWith\(github\.ref, 'refs\/tags\/cavalry-'\)[\s\S]*uses:\s*actions\/checkout@[0-9a-f]{40}[\s\S]*fetch-depth:\s*0/,
    'release ancestry needs a tag-only complete checkout with full action SHA pin'
  );
  assert.match(
    preflightJob[1],
    /git fetch --no-tags origin \+refs\/heads\/main:refs\/remotes\/origin\/main[\s\S]*git merge-base --is-ancestor "\$GITHUB_SHA" refs\/remotes\/origin\/main/,
    'tag builds must fail closed unless the tag commit is already contained in origin/main'
  );
  assert.doesNotMatch(preflightJob[1], /acceptance|attestation|release[_-]seal/i);
  for (const jobName of ['build', 'windows_check', 'package_macos']) {
    const job = workflow.match(
      new RegExp(`\\r?\\n  ${jobName}:\\r?\\n([\\s\\S]*?)(?=\\r?\\n  [a-zA-Z_][a-zA-Z0-9_]*:|\\s*$)`)
    );
    assert.ok(job, `${jobName} job missing`);
    assert.match(
      job[1],
      /needs:\s*(?:\[release_tag_preflight|release_tag_preflight)/,
      `${jobName} must not start before the release-tag ancestry preflight`
    );
  }
  assert.match(releaseJob[1], /needs:\s*\[release_tag_preflight,/);
  assert.doesNotMatch(releaseJob[1], /RELEASE_SEAL|ACCEPTANCE_ATTESTATION|ReleaseAcceptanceSeal/);
  assert.doesNotMatch(
    releaseJob[1],
    /merge-base --is-ancestor/,
    'release must consume the shared preflight rather than rechecking ancestry after platform builds'
  );
  assert.match(workflow, /npm run check:release/);
  assert.match(workflow, /npm run release:metadata -- --github-env/);
  assert.match(
    workflow,
    /node tools\/extract_release_changelog\.js[\s\S]*--version "\$INTERNAL_APP_VERSION"[\s\S]*--changelog CHANGELOG\.md[\s\S]*--output release-changes\.md/
  );
  assert.match(
    workflow,
    /## p\$\{RELEASE_PATCH\} 更新内容 \/ Changes[\s\S]*cat release-changes\.md[\s\S]*node tools\/release_publish\.js/
  );
  assert.match(workflow, /RELEASE_ASSET_NAME_AARCH64/);
  assert.match(workflow, /RELEASE_ASSET_NAME_X64/);
  assert.match(workflow, /RELEASE_ASSET_NAME_WINDOWS_X64/);
  assert.match(workflow, /x86_64-apple-darwin/);
  assert.match(localSop, /Internal app version: SemVer/);
  assert.match(localSop, /Release tag: `cavalry-2\.7\.2-pN`/);
  assert.match(localSop, /三种发布资产：/);
  assert.match(localSop, /Cavalry\.Language\.Switcher_Cavalry-2\.7\.2-pN_aarch64\.dmg/);
  assert.match(localSop, /Cavalry\.Language\.Switcher_Cavalry-2\.7\.2-pN_x64\.dmg/);
  assert.match(
    localSop,
    /Cavalry\.Language\.Switcher_Cavalry-2\.7\.2-pN_windows-x64-setup\.exe/
  );
});

test('release metadata script renders GitHub release fields from the patch tag', () => {
  const valid = spawnSync(process.execPath, ['tools/release_metadata.js', '--tag', 'cavalry-2.7.2-p12'], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  const invalid = spawnSync(process.execPath, ['tools/release_metadata.js', '--tag', 'v0.1.11'], {
    cwd: repoRoot,
    encoding: 'utf8',
  });

  assert.equal(valid.status, 0, valid.stderr || valid.stdout);
  assert.deepEqual(JSON.parse(valid.stdout), {
    RELEASE_TAG: 'cavalry-2.7.2-p12',
    RELEASE_PATCH: '12',
    TARGET_CAVALRY_VERSION: '2.7.2',
    INTERNAL_APP_VERSION: readJson('package.json').version,
    RELEASE_TITLE: 'Cavalry Language Switcher for Cavalry 2.7.2 patch 12',
    RELEASE_ASSET_NAME_AARCH64: 'Cavalry.Language.Switcher_Cavalry-2.7.2-p12_aarch64.dmg',
    RELEASE_ASSET_NAME_X64: 'Cavalry.Language.Switcher_Cavalry-2.7.2-p12_x64.dmg',
    RELEASE_ASSET_NAME_WINDOWS_X64:
      'Cavalry.Language.Switcher_Cavalry-2.7.2-p12_windows-x64-setup.exe',
    RELEASE_UPDATER_MANIFEST_NAME: 'latest.json',
    RELEASE_UPDATER_DOWNLOAD_BASE_URL:
      'https://github.com/daftAI2026/Cavalry-i18n/releases/latest/download',
    RELEASE_UPDATER_ASSET_NAME_AARCH64:
      'Cavalry.Language.Switcher_Cavalry-2.7.2-p12_aarch64.app.tar.gz',
    RELEASE_UPDATER_ASSET_NAME_X64:
      'Cavalry.Language.Switcher_Cavalry-2.7.2-p12_x64.app.tar.gz',
    RELEASE_UPDATER_SIGNATURE_NAME_AARCH64:
      'Cavalry.Language.Switcher_Cavalry-2.7.2-p12_aarch64.app.tar.gz.sig',
    RELEASE_UPDATER_SIGNATURE_NAME_X64:
      'Cavalry.Language.Switcher_Cavalry-2.7.2-p12_x64.app.tar.gz.sig',
    RELEASE_UPDATER_SIGNATURE_NAME_WINDOWS_X64:
      'Cavalry.Language.Switcher_Cavalry-2.7.2-p12_windows-x64-setup.exe.sig',
  });
  assert.notEqual(invalid.status, 0, invalid.stderr || invalid.stdout);
  assert.match(invalid.stderr, /does not match/);
});

test('release metadata refuses x86 and i686 asset templates', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'cavalry-release-assets-'));
  try {
    fs.copyFileSync(
      path.join(repoRoot, 'tools', 'release_metadata.js'),
      path.join(tempRoot, 'release_metadata.js')
    );
    writeJson(path.join(tempRoot, 'package.json'), { version: '9.8.7' });
    writeJson(path.join(tempRoot, 'release.config.json'), {
      targetCavalryVersion: '2.7.2',
      releaseTagPrefix: 'cavalry-2.7.2-p',
      releaseTagPattern: '^cavalry-2\\.7\\.2-p[0-9]+$',
      releaseTitleTemplate: 'Cavalry Language Switcher for Cavalry 2.7.2 patch ${patch}',
      assetNameTemplates: {
        aarch64: 'Cavalry.Language.Switcher_Cavalry-2.7.2-p${patch}_aarch64.dmg',
        x64: 'Cavalry.Language.Switcher_Cavalry-2.7.2-p${patch}_x64.dmg',
        windowsX64: 'Cavalry.Language.Switcher_Cavalry-2.7.2-p${patch}_windows-x64-setup.exe',
        windowsX86: 'Cavalry.Language.Switcher_Cavalry-2.7.2-p${patch}_windows-x86-setup.exe',
      },
    });

    const result = spawnSync(process.execPath, ['release_metadata.js', '--check'], {
      cwd: tempRoot,
      encoding: 'utf8',
    });
    assert.notEqual(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stderr, /x86\/i686 releases are unsupported/);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('tag release publishes manual installers plus the signed three-platform updater closure', () => {
  const workflow = readText('.github/workflows/build.yml');
  const releaseJob = workflow.match(
    /\r?\n  release:\r?\n([\s\S]*?)(?=\r?\n  [a-zA-Z_][a-zA-Z0-9_]*:|\s*$)/
  );

  assert.ok(releaseJob, 'release job missing');
  assert.match(releaseJob[1], /name:\s*cavalry-i18n-windows-nsis/);
  assert.match(releaseJob[1], /path:\s*dist\/windows/);
  assert.match(
    releaseJob[1],
    /find dist\/windows -type f -name '\*\.exe'[\s\S]*mv "\$\{windows_installers\[0\]\}" "dist\/\$RELEASE_ASSET_NAME_WINDOWS_X64"/
  );
  assert.match(
    releaseJob[1],
    /\[Windows x64\][\s\S]*RELEASE_ASSET_NAME_WINDOWS_X64/
  );
  assert.doesNotMatch(releaseJob[1], /\[Windows x64 安装器\]/);
  assert.doesNotMatch(releaseJob[1], /windowsX86|windows-x86(?!_64)|i686|win32/i);
  assert.match(releaseJob[1], /find dist -type f -name '\*\.dmg'/);
  assert.match(releaseJob[1], /create_updater_manifest\.js/);
  assert.match(releaseJob[1], /--darwin-aarch64[\s\S]*--darwin-x86_64[\s\S]*--windows-x86_64/);
  assert.match(releaseJob[1], /node tools\/create_updater_manifest\.js[\s\S]*node tools\/release_publish\.js/);
  assert.doesNotMatch(releaseJob[1], /acceptance|attestation|ReleaseAcceptanceSeal/);
  assert.doesNotMatch(releaseJob[1], /--confirm-live-pass/);
  assert.match(
    releaseJob[1],
    /node tools\/release_publish\.js[\s\S]*--dist dist[\s\S]*--notes release-notes\.md/
  );
  assert.match(
    releaseJob[1],
    /gh pr create[\s\S]*release badge/,
    'badge updates must open a PR instead of pushing main directly'
  );
  assert.doesNotMatch(
    releaseJob[1],
    /git push origin HEAD:main/,
    'release must not push badge commits directly to main'
  );
});

test('release changelog extractor selects one exact released SemVer section and fails closed', () => {
  const tempRoot = makeTempDir('cavalry-release-changelog-');
  const changelogPath = path.join(tempRoot, 'CHANGELOG.md');
  const outputPath = path.join(tempRoot, 'release-changes.md');
  const scriptPath = path.join(repoRoot, 'tools', 'extract_release_changelog.js');
  const runExtractor = (version) =>
    spawnSync(
      process.execPath,
      [scriptPath, '--version', version, '--changelog', changelogPath, '--output', outputPath],
      { cwd: repoRoot, encoding: 'utf8' }
    );

  fs.writeFileSync(
    changelogPath,
    [
      '# Changelog',
      '',
      '## [Unreleased]',
      '',
      '### Changed',
      '- Not ready for users.',
      '',
      '## [9.8.7] - 2026-07-14',
      '',
      '### Added',
      '- Exact release note.',
      '',
      '### Fixed',
      '- Exact release fix.',
      '',
      '## [9.8.6] - 2026-07-13',
      '',
      '### Fixed',
      '- Older release note.',
      '',
    ].join('\n')
  );

  const valid = runExtractor('9.8.7');
  assert.equal(valid.status, 0, valid.stderr || valid.stdout);
  assert.equal(
    fs.readFileSync(outputPath, 'utf8'),
    '### Added\n- Exact release note.\n\n### Fixed\n- Exact release fix.\n'
  );
  assert.doesNotMatch(fs.readFileSync(outputPath, 'utf8'), /Not ready|Older release/);

  const missing = runExtractor('9.8.5');
  assert.notEqual(missing.status, 0, missing.stdout);
  assert.match(missing.stderr, /9\.8\.5[\s\S]*not found/i);
  assert.equal(fs.existsSync(outputPath), false, 'a failed extraction must not leave stale release notes');

  fs.writeFileSync(
    changelogPath,
    '# Changelog\n\n## [9.8.7] - 2026-07-14\n\n## [9.8.7] - 2026-07-15\n\n### Fixed\n- Duplicate.\n'
  );
  const duplicate = runExtractor('9.8.7');
  assert.notEqual(duplicate.status, 0, duplicate.stdout);
  assert.match(duplicate.stderr, /9\.8\.7[\s\S]*more than once/i);

  fs.writeFileSync(changelogPath, '# Changelog\n\n## [9.8.7]\n\n### Fixed\n- Missing release date.\n');
  const undated = runExtractor('9.8.7');
  assert.notEqual(undated.status, 0, undated.stdout);
  assert.match(undated.stderr, /9\.8\.7[\s\S]*release date/i);

  fs.writeFileSync(changelogPath, '# Changelog\n\n## [9.8.7] - 2026-07-14\n\n## [9.8.6] - 2026-07-13\n');
  const empty = runExtractor('9.8.7');
  assert.notEqual(empty.status, 0, empty.stdout);
  assert.match(empty.stderr, /9\.8\.7[\s\S]*empty/i);
});

test('README release badges use a generated Shields endpoint instead of the GitHub API token pool', () => {
  const workflow = readText('.github/workflows/build.yml');
  const badge = readJson('docs/badges/release.json');
  const badgeEndpoint =
    'https://img.shields.io/endpoint?url=https%3A%2F%2Fraw.githubusercontent.com%2FdaftAI2026%2FCavalry-i18n%2Fmain%2Fdocs%2Fbadges%2Frelease.json&style=flat-square';

  assert.deepEqual(Object.keys(badge).sort(), ['color', 'label', 'message', 'schemaVersion']);
  assert.equal(badge.schemaVersion, 1);
  assert.equal(badge.label, 'release');
  assert.match(badge.message, /^cavalry-2\.7\.2-p[0-9]+$/);
  assert.equal(badge.color, 'blue');

  for (const readme of ['README.md', 'README.zh-Hans.md', 'README.zh-Hant.md', 'README.ja_JP.md']) {
    const source = readText(readme);
    assert.match(source, new RegExp(badgeEndpoint.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `${readme} should use the generated release endpoint badge`);
    assert.doesNotMatch(source, /img\.shields\.io\/github\/v\/release/, `${readme} should not query Shields GitHub Release directly`);
  }

  assert.match(
    workflow,
    /node tools\/release_publish\.js[\s\S]*docs\/badges\/release\.json[\s\S]*"message": "\$\{GITHUB_REF_NAME\}"/,
    'tag release workflow should update the endpoint badge JSON only after release publish succeeds'
  );
  assert.match(
    workflow,
    /gh pr create[\s\S]*docs: update release badge/,
    'tag release workflow should open a badge PR instead of pushing main directly'
  );
  assert.doesNotMatch(
    workflow,
    /git push origin HEAD:main/,
    'tag release workflow must not push badge commits directly onto main'
  );
});

test('project version synchronizer propagates changelog version across npm, Cargo, and Tauri metadata', () => {
  const tempRoot = makeVersionFixture();
  const result = spawnSync(process.execPath, ['tools/sync_project_version.js'], {
    cwd: tempRoot,
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(readJson(path.join(tempRoot, 'package.json')).version, '9.8.7');
  assert.equal(readJson(path.join(tempRoot, 'package-lock.json')).version, '9.8.7');
  assert.equal(readJson(path.join(tempRoot, 'package-lock.json')).packages[''].version, '9.8.7');
  assert.match(fs.readFileSync(path.join(tempRoot, 'src-tauri', 'Cargo.toml'), 'utf8'), /version = "9\.8\.7"/);
  assert.equal(readJson(path.join(tempRoot, 'src-tauri', 'tauri.conf.json')).version, '9.8.7');
  assert.match(
    fs.readFileSync(path.join(tempRoot, 'src-tauri', 'Cargo.lock'), 'utf8'),
    /name = "cavalry-i18n-tauri"\nversion = "9\.8\.7"/
  );
});

test('project version check treats CRLF and LF metadata as the same content', () => {
  const tempRoot = makeVersionFixture();
  const syncResult = spawnSync(process.execPath, ['tools/sync_project_version.js'], {
    cwd: tempRoot,
    encoding: 'utf8',
  });
  assert.equal(syncResult.status, 0, syncResult.stderr || syncResult.stdout);

  for (const relativePath of [
    'CHANGELOG.md',
    'package.json',
    'package-lock.json',
    'src-tauri/Cargo.toml',
    'src-tauri/tauri.conf.json',
    'src-tauri/Cargo.lock',
  ]) {
    const filePath = path.join(tempRoot, relativePath);
    const source = fs.readFileSync(filePath, 'utf8').replace(/\r\n?/g, '\n');
    fs.writeFileSync(filePath, source.replace(/\n/g, '\r\n'));
  }

  const checkResult = spawnSync(process.execPath, ['tools/sync_project_version.js', '--check'], {
    cwd: tempRoot,
    encoding: 'utf8',
  });
  assert.equal(checkResult.status, 0, checkResult.stderr || checkResult.stdout);
});

test('tauri bundle config preserves the frozen Tauri window contract', () => {
  const config = readJson('src-tauri/tauri.conf.json');
  const localSop = readText('LOCAL_BUILD_SOP.md');
  const macConfig = readJson('src-tauri/tauri.macos.conf.json');
  const windowsConfig = readJson('src-tauri/tauri.windows.conf.json');
  const updaterArtifactsConfig = readJson('src-tauri/tauri.updater-artifacts.conf.json');
  const window = config.app.windows.find((candidate) => candidate.label === 'main');

  assert.ok(window, 'main window missing');
  assert.equal(window.url, './index.html');
  assert.equal(window.width, 400);
  assert.equal(window.height, 484);
  assert.equal(window.minWidth, 400);
  assert.equal(window.minHeight, 484);
  assert.match(localSop, /main window 逻辑本体固定 `400x484`，最小本体 `400x484`/);
  assert.match(localSop, /Windows 配置中的 `420x504` 只是在本体四边各加 10px transparent compositor 阴影画布，产品最小尺寸和所有视觉对齐均排除这层阴影/);
  assert.doesNotMatch(localSop, /main window 外框固定 `480x528`/);
  assert.equal(window.decorations, true);
  assert.equal(window.titleBarStyle, 'Overlay');
  assert.equal(window.hiddenTitle, true);
  assert.deepEqual(macConfig.bundle.targets, ['dmg', 'app']);
  assert.deepEqual(windowsConfig.bundle.targets, ['nsis']);
  assert.equal(config.bundle.createUpdaterArtifacts, undefined);
  assert.deepEqual(updaterArtifactsConfig.bundle, { createUpdaterArtifacts: true });
});

test('tauri macOS package uses ad-hoc signing while tag updater artifacts require the independent Tauri key', () => {
  const config = readJson('src-tauri/tauri.macos.conf.json');
  const workflow = readText('.github/workflows/build.yml');
  const rustToolchain = readText('rust-toolchain.toml').match(/^channel\s*=\s*"([^"]+)"/m);
  const packageJob = workflow.match(
    /\r?\n  package_macos:\r?\n([\s\S]*?)(?=\r?\n  [a-zA-Z_][a-zA-Z0-9_]*:|\s*$)/
  );

  assert.equal(config.bundle.macOS.signingIdentity, undefined);
  assert.ok(rustToolchain, 'root Rust channel missing');
  assert.ok(packageJob, 'package_macos job missing');
  const packageToolchain = packageJob[1].match(
    /^    env:\r?\n(?:      #.*\r?\n)*      RUSTUP_TOOLCHAIN:\s*['"]?([^'"\s]+)['"]?\s*$/m
  );
  assert.ok(
    packageToolchain,
    'macOS packaging must bypass rust-toolchain component reconciliation with an explicit installed toolchain'
  );
  assert.equal(packageToolchain[1], rustToolchain[1]);
  assert.doesNotMatch(packageJob[1], /APPLE_CERTIFICATE|APPLE_ID|APPLE_TEAM_ID|notarytool|stapler/);
  assert.match(packageJob[1], /TAURI_SIGNING_PRIVATE_KEY:\s*\$\{\{\s*secrets\.TAURI_SIGNING_PRIVATE_KEY\s*\}\}/);
  assert.match(packageJob[1], /--config src-tauri\/tauri\.updater-artifacts\.conf\.json/);
  assert.match(
    packageJob[1],
    /Build packaged macOS app \(tag = ad-hoc \+ signed updater\)[\s\S]*CSC_IDENTITY_AUTO_DISCOVERY:\s*false[\s\S]*APPLE_SIGNING_IDENTITY:\s*"-"[\s\S]*TAURI_SIGNING_PRIVATE_KEY:/,
    'tag packaging must pair an ad-hoc app signature with the independent updater key'
  );
  assert.match(
    packageJob[1],
    /workflow_dispatch packaging uses ad-hoc signing for build verification only/
  );
  assert.match(
    packageJob[1],
    /Verify ad-hoc app signature \(tag only\)[\s\S]*Signature=adhoc[\s\S]*Re-verify final ad-hoc app and DMG bytes/
  );
});

test('manual updater signing smoke uses protected secrets without creating a tag or Release', () => {
  const workflow = readText('.github/workflows/build.yml');
  const packageJob = workflow.match(
    /\r?\n  package_macos:\r?\n([\s\S]*?)(?=\r?\n  [a-zA-Z_][a-zA-Z0-9_]*:|\s*$)/
  );
  const releaseJob = workflow.match(
    /\r?\n  release:\r?\n([\s\S]*?)(?=\r?\n  [a-zA-Z_][a-zA-Z0-9_]*:|\s*$)/
  );

  assert.match(
    workflow,
    /workflow_dispatch:\s*\r?\n\s+inputs:\s*\r?\n\s+updater_signing_smoke:[\s\S]*?default:\s*false[\s\S]*?type:\s*boolean/
  );
  assert.ok(packageJob, 'package_macos job missing');
  assert.match(
    packageJob[1],
    /inputs\.updater_signing_smoke[\s\S]*release-production[\s\S]*Require updater signing secrets for tag or signing smoke/
  );
  assert.match(
    packageJob[1],
    /Build signed updater artifact \(workflow_dispatch smoke, no release\)[\s\S]*TAURI_SIGNING_PRIVATE_KEY:[\s\S]*TAURI_SIGNING_PRIVATE_KEY_PASSWORD:[\s\S]*--config src-tauri\/tauri\.updater-artifacts\.conf\.json/
  );
  assert.match(
    packageJob[1],
    /Verify signed updater artifact against embedded public key \(workflow_dispatch smoke\)[\s\S]*pwd -P[\s\S]*CAVALRY_I18N_UPDATER_ARTIFACT=[\s\S]*CAVALRY_I18N_UPDATER_SIGNATURE=[\s\S]*--test updater_signature_contract[\s\S]*verifies_external_updater_signature -- --ignored --exact/
  );
  assert.match(
    packageJob[1],
    /Build packaged macOS app \(workflow_dispatch = ad-hoc verification only\)[\s\S]*!inputs\.updater_signing_smoke[\s\S]*workflow_dispatch packaging uses ad-hoc signing for build verification only/
  );
  assert.ok(releaseJob, 'release job missing');
  assert.match(releaseJob[1], /^    if:\s*startsWith\(github\.ref, 'refs\/tags\/cavalry-'\)\s*$/m);
  assert.doesNotMatch(releaseJob[1], /updater_signing_smoke/);
});

test('Windows injector selects the installed Visual Studio generator and locks the proven x64 v143 toolset', () => {
  const windowsBuild = readText('injector/windows/build.ps1');
  const windowsCmake = readText('injector/windows/CMakeLists.txt');

  assert.doesNotMatch(windowsBuild, /'-G'/);
  assert.match(windowsBuild, /'-A', 'x64',\s*'-T', 'v143'/);
  assert.match(windowsCmake, /cmake_minimum_required\(VERSION 4\.2\)/);
});

test('Windows CMake bootstrap rejects low, floating, and unproven toolchains', () => {
  const pins = readJson('tools/ci_action_pins.json');
  const cmake = require('./resolve_windows_cmake.js');
  const pin = pins.cmake;

  assert.ok(pin, 'CMake must have an explicit CI pin');
  assert.equal(pin.version, '4.4.3');
  assert.match(pin.url, /^https:\/\/github\.com\/Kitware\/CMake\/releases\/download\/v4\.4\.3\/cmake-4\.4\.3-windows-x86_64\.zip$/);
  assert.match(pin.sha256, /^[a-f0-9]{64}$/);
  assert.equal(cmake.parseCmakeVersion('cmake version 4.4.3'), '4.4.3');
  assert.throws(() => cmake.validateCmakeVersion('cmake version 3.31.6'), /CMake 4\.4\.3 or newer is required/);
  assert.throws(
    () => cmake.validateCmakePin({ ...pin, url: pin.url.replace('v4.4.3', 'main') }),
    /official CMake v4\.4\.3 archive URL/
  );
  assert.throws(
    () => cmake.validateCmakePin({ ...pin, sha256: '' }),
    /SHA-256 archive digest/
  );
});

test('Windows CI runs deterministic dependencies, contracts, Rust tests, and an installed NSIS smoke', () => {
  const workflow = readText('.github/workflows/build.yml');
  const job = workflow.match(/\r?\n  windows_check:\r?\n([\s\S]*?)(?=\r?\n  [a-zA-Z_][a-zA-Z0-9_]*:|\s*$)/);
  const sourceArtifact = workflow.match(
    /- name: Stage and verify deterministic source artifact\r?\n([\s\S]*?)(?=\r?\n  windows_check:)/
  );

  assert.ok(job, 'windows_check job missing');
  assert.match(job[1], /runs-on:\s*windows-2022/);
  assert.match(job[1], /actions\/setup-python@[0-9a-f]{40}/);
  assert.match(job[1], /npm run prepare:qt-sdk:windows/);
  assert.doesNotMatch(job[1], /python -m aqt install-qt/);
  assert.match(job[1], /resolve_windows_cmake\.js --ensure --print-json/);
  assert.match(job[1], /record_windows_toolchain_evidence\.js/);
  assert.match(job[1], /toolchain-evidence-windows-x64\.json/);
  assert.match(job[1], /npm ci/);
  assert.match(job[1], /npm run test:contracts/);
  assert.match(job[1], /npm run build:injector:windows/);
  assert.match(job[1], /npm run test:tauri/);
  const prepareQtIndex = job[1].indexOf('npm run prepare:qt-sdk:windows');
  const buildInjectorIndex = job[1].indexOf('npm run build:injector:windows');
  const rustCheckIndex = job[1].indexOf('npm run check:tauri');
  assert.ok(prepareQtIndex >= 0 && prepareQtIndex < buildInjectorIndex);
  assert.ok(buildInjectorIndex < rustCheckIndex);
  assert.match(
    job[1],
    /npm run build:tauri:windows[\s\S]*npm run test:tauri:windows-nsis[\s\S]*Upload the Windows NSIS installer/
  );
  assert.match(
    job[1],
    /src-tauri\/target\/x86_64-pc-windows-msvc\/release\/bundle\/nsis\/\*\.exe/
  );
  assert.match(
    job[1],
    /src-tauri\/target\/x86_64-pc-windows-msvc\/release\/bundle\/nsis\/\*\.exe\.provenance\.json/
  );
  assert.match(
    job[1],
    /src-tauri\/target\/x86_64-pc-windows-msvc\/release\/bundle\/nsis\/\*\.exe\.sig/
  );
  assert.match(job[1], /TAURI_SIGNING_PRIVATE_KEY_PASSWORD/);
  assert.match(
    job[1],
    /npm run tauri -- build --target x86_64-pc-windows-msvc --config src-tauri\/tauri\.windows\.conf\.json --config src-tauri\/tauri\.updater-artifacts\.conf\.json/,
    'Windows tag packaging must remain one PowerShell-safe command line'
  );
  assert.match(job[1], /if-no-files-found:\s*error/);
  // Windows Authenticode is intentionally not implemented here (external issue).
  assert.doesNotMatch(job[1], /signtool|Authenticode|osslsigncode/i);
  const pkg = readJson('package.json');
  assert.match(pkg.scripts['build:tauri:windows'], /^npm run prepare:qt-sdk:windows/);
  assert.equal(
    pkg.scripts['prepare:tauri:windows-bundle'],
    'npm run build:injector:windows && node tools/windows_nsis_provenance.js --prepare'
  );
  assert.ok(sourceArtifact, 'source artifact upload step missing');
  assert.match(
    sourceArtifact[1],
    /create_source_artifact\.js[\s\S]*--commit "\$GITHUB_SHA"[\s\S]*--output "\$RUNNER_TEMP\/cavalry-i18n-source\.tar"/
  );
  assert.match(sourceArtifact[1], /path:\s*\$\{\{ runner\.temp \}\}\/cavalry-i18n-source\.tar/);
  assert.match(sourceArtifact[1], /Download source artifact for round-trip verification/);
  assert.match(
    sourceArtifact[1],
    /verify_source_artifact\.js[\s\S]*--archive "\$RUNNER_TEMP\/cavalry-i18n-source-roundtrip\/cavalry-i18n-source\.tar"[\s\S]*--commit "\$GITHUB_SHA"/
  );
});

test('PR and main CI compile and link the universal macOS injector without a vendor app', () => {
  const workflow = readText('.github/workflows/build.yml');
  const job = workflow.match(
    /\r?\n  macos_injector_check:\r?\n([\s\S]*?)(?=\r?\n  [a-zA-Z_][a-zA-Z0-9_]*:|\s*$)/
  );

  assert.ok(job, 'macos_injector_check job missing');
  assert.match(job[1], /needs:\s*release_tag_preflight/);
  assert.match(
    job[1],
    /if:\s*github\.event_name == 'pull_request' \|\| github\.ref == 'refs\/heads\/main'/
  );
  assert.match(job[1], /runs-on:\s*macos-14/);
  assert.match(
    job[1],
    /python -m venv[\s\S]*pip install[^\n]*--require-hashes[^\n]*--only-binary=:all:[^\n]*-r requirements-ci\.txt/
  );
  assert.match(
    job[1],
    /test ! -e \/Applications\/Cavalry\.app[\s\S]*npm run build:injector/,
    'the PR native gate must exercise the clean-runner Skia link-stub path'
  );
  assert.match(
    job[1],
    /lipo injector\/libCavalryTranslatorInjector\.dylib -verify_arch arm64 x86_64/
  );
  assert.match(job[1], /codesign --verify --strict/);
  assert.match(job[1], /otool -L[\s\S]*@rpath\/libskia\.dylib/);
});

test('Windows NSIS lifecycle preserves by default and restores English only through the trusted transaction', () => {
  const windowsConfig = readJson('src-tauri/tauri.windows.conf.json');
  for (const relativePath of [
    'injector/windows/build.ps1',
    'tools/capture_windows_pid_window.ps1',
    'tools/check_windows_nsis_install.ps1',
  ]) {
    const scriptBytes = fs.readFileSync(path.join(repoRoot, relativePath));
    assert.deepEqual(
      [...scriptBytes.subarray(0, 3)],
      [0xef, 0xbb, 0xbf],
      `${relativePath}: Windows PowerShell 5.1 requires a UTF-8 BOM before parsing non-ASCII comments`
    );
  }
  const script = readText('tools/check_windows_nsis_install.ps1');
  const nsisHooks = readText('src-tauri/nsis-hooks.nsh');
  const executableNsisHooks = nsisHooks
    .split(/\r?\n/)
    .map((line) => line.replace(/;.*/, '').trim())
    .filter(Boolean)
    .join('\n');

  assert.equal(windowsConfig.bundle.windows.nsis.installerHooks, 'nsis-hooks.nsh');
  assert.deepEqual(windowsConfig.bundle.windows.nsis.customLanguageFiles, {
    English: 'nsis-languages/English.nsh',
    SimpChinese: 'nsis-languages/SimpChinese.nsh',
    TradChinese: 'nsis-languages/TradChinese.nsh',
    Japanese: 'nsis-languages/Japanese.nsh',
  });
  for (const [language, expectedLine] of Object.entries({
    English: 'LangString deleteAppData ${LANG_ENGLISH} "Delete Switcher application data (Switcher settings only)"',
    SimpChinese: 'LangString deleteAppData ${LANG_SIMPCHINESE} "删除切换器应用数据（仅切换器设置）"',
    TradChinese: 'LangString deleteAppData ${LANG_TRADCHINESE} "刪除切換器應用程式資料（僅切換器設定）"',
    Japanese: 'LangString deleteAppData ${LANG_JAPANESE} "スイッチャーのアプリデータを削除（スイッチャー設定のみ）"',
  })) {
    assert.match(
      readText(`src-tauri/nsis-languages/${language}.nsh`),
      new RegExp(expectedLine.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    );
  }
  assert.match(nsisHooks, /!macro NSIS_HOOK_PREUNINSTALL/);
  assert.match(nsisHooks, /!macro NSIS_HOOK_POSTUNINSTALL/);
  for (const languageId of ['1033', '2052', '1028', '1041']) {
    for (const key of [
      'UNINSTALL_OPTIONS_TITLE',
      'UNINSTALL_OPTIONS_SUBTITLE',
      'UNINSTALL_RESTORE_CHECKBOX',
      'UNINSTALL_KEEP_DETAIL',
      'UNINSTALL_RESTORE_FAILED',
    ]) {
      assert.match(nsisHooks, new RegExp(`LangString CAVALRY_I18N_${key} ${languageId}`));
    }
  }
  assert.match(
    nsisHooks,
    /UninstPage custom un\.CavalryI18nUninstallOptions un\.CavalryI18nUninstallOptionsLeave/
  );
  assert.match(nsisHooks, /\$\{NSD_CreateCheckbox\}/);
  assert.match(
    nsisHooks,
    /\$\{NSD_SetState\} \$CavalryI18nRestoreCheckbox \$\{BST_UNCHECKED\}/
  );
  assert.doesNotMatch(nsisHooks, /MB_YESNOCANCEL/);
  const optionsFunction = nsisHooks.match(
    /Function un\.CavalryI18nUninstallOptions\b([\s\S]*?)FunctionEnd/
  );
  assert.ok(optionsFunction, 'the uninstaller must own a dedicated options page');
  for (const condition of [
    /\$\{Silent\}/,
    /\$\{GetOptions\} \$CMDLINE "\/P"/,
    /\$\{GetOptions\} \$CMDLINE "\/UPDATE"/,
  ]) {
    assert.match(
      optionsFunction[1],
      condition,
      'the early-parsed options page must mirror Tauri un.onInit command-line parsing'
    );
  }
  assert.doesNotMatch(optionsFunction[1], /\$UpdateMode|\$PassiveMode/);
  assert.doesNotMatch(
    optionsFunction[1],
    /\$\{BUNDLEID\}|IfFileExists/,
    'interactive uninstall must not hide the option behind a late-defined hook macro'
  );
  assert.doesNotMatch(optionsFunction[1], /UNINSTALL_APP_DATA_CHECKBOX/);
  const optionsLeaveFunction = nsisHooks.match(
    /Function un\.CavalryI18nUninstallOptionsLeave\b([\s\S]*?)FunctionEnd/
  );
  assert.ok(optionsLeaveFunction, 'missing uninstaller options leave callback');
  assert.doesNotMatch(nsisHooks, /CreateTimer|DecorateConfirmPage|WM_SETTEXT/);
  assert.match(nsisHooks, /\$UpdateMode = 1/);
  assert.match(nsisHooks, /\$PassiveMode = 1/);
  assert.match(nsisHooks, /\$\{Silent\}/);
  assert.match(
    executableNsisHooks,
    /ExecWait '\"\$INSTDIR\\\$\{MAINBINARYNAME\}\.exe\" \"--uninstall-restore-english\"' \$0/
  );
  assert.match(executableNsisHooks, /\$0 != 0[\s\S]*cavalry_i18n_restore_failed/);
  assert.match(
    executableNsisHooks,
    /cavalry_i18n_restore_failed:[\s\S]*MessageBox MB_OK\|MB_ICONSTOP[\s\S]*Abort/
  );
  assert.match(nsisHooks, /DeleteRegValue SHCTX "\$\{MANUPRODUCTKEY\}" ""/);
  assert.match(nsisHooks, /DeleteRegKey \/ifempty SHCTX "\$\{MANUPRODUCTKEY\}"/);
  assert.doesNotMatch(
    executableNsisHooks,
    /qwindows|cavalry-i18n-qpa|cavalry-i18n-lang|cavalryi18n\.dll/i,
    'the NSIS hook must not know concrete Cavalry runtime paths or artifacts'
  );
  assert.doesNotMatch(
    executableNsisHooks,
    /(^|\n)(Delete|RMDir|Rename|CopyFiles)\b/i,
    'the NSIS hook must delegate runtime mutation instead of manipulating files itself'
  );
  assert.match(script, /\$windowsTargetTriple = 'x86_64-pc-windows-msvc'/);
  assert.match(
    script,
    /src-tauri\\target\\\$windowsTargetTriple\\release\\bundle\\nsis/
  );
  assert.doesNotMatch(script, /src-tauri\\target\\release\\bundle\\nsis/);
  assert.match(script, /Assert-NoPreexistingState/);
  assert.match(
    script,
    /HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Cavalry Language Switcher/
  );
  assert.match(script, /HKCU:\\Software\\daftai\\Cavalry Language Switcher/);
  assert.match(script, /GetFolderPath\(\$Folder\)/);
  assert.match(script, /System\.Guid\]::NewGuid\(\)\.ToString\('N'\)/);
  assert.match(script, /Test-StrictChildPath -Path \$installRoot -Root \$tempRoot/);
  assert.match(
    script,
    /Assert-NoReparsePathChain -Path \$tempRoot -Role 'Windows package smoke TEMP root'/
  );
  assert.match(script, /-ArgumentList @\('\/S', '\/NS', "\/D=\$installRoot"\)/);
  assert.match(script, /\.WaitForExit\(\$processTimeoutMilliseconds\)/);
  assert.match(script, /Assert-NoReparsePoints -Root \$InstallRoot/);
  assert.match(script, /0x8664/);
  assert.match(script, /\$expectedLocales = @\('en', 'ja_JP', 'zh-Hans', 'zh-Hant'\)/);
  assert.match(script, /\$expectedJsonCountPerLocale = 38/);
  assert.match(script, /\$provenanceTool = Join-Path \$repoRoot 'tools\\windows_nsis_provenance\.js'/);
  assert.match(script, /function Assert-CurrentInstallerProvenance/);
  assert.match(script, /& \$node\.Source \$provenanceTool '--verify' \$Installer/);
  const provenanceCheck = script.indexOf('Assert-CurrentInstallerProvenance -Installer $resolvedInstaller');
  const smokeTemp = script.indexOf('$tempRoot = Normalize-ComparablePath');
  assert.ok(provenanceCheck >= 0 && provenanceCheck < smokeTemp, 'provenance must fail before temp install state is created');
  assert.match(script, /Get-FileHash -LiteralPath \$sourcePlugin -Algorithm SHA256/);
  assert.match(script, /\$qpaProxyRelativePath = 'injector\\windows\\qpa\\qwindows\.dll'/);
  assert.match(script, /\$sourceQpaProxy = Join-Path \$repoRoot 'injector\\windows\\qpa\\qwindows\.dll'/);
  assert.match(script, /Assert-PeX64 -Path \$installedQpaProxy/);
  assert.match(script, /Get-FileHash -LiteralPath \$sourceQpaProxy -Algorithm SHA256/);
  assert.match(script, /\$_.Extension -ieq '\.dylib' -or \$_.Name -like 'Qt6\*\.dll'/);
  assert.match(script, /Assert-InstalledRegistry/);
  assert.match(script, /\$externalSentinelRelativeFiles = @\(/);
  assert.match(script, /function New-ExternalCavalryQpaSentinel/);
  assert.match(script, /function Assert-ExternalCavalryQpaUnchanged/);
  assert.match(script, /-Role 'Windows NSIS update'/);
  assert.match(
    script,
    /-ArgumentList @\('\/S', '\/NS', '\/UPDATE', "\/D=\$installRoot"\)/
  );
  assert.match(script, /-Phase 'install'/);
  assert.match(script, /-Phase 'update'/);
  assert.match(script, /-Phase 'uninstall'/);
  assert.match(script, /\[System\.IO\.File\]::Delete\(\(Join-Path \$Root \$relativePath\)\)/);
  assert.match(
    script,
    /\[System\.IO\.Directory\]::Delete\(\(Join-Path \$Root 'cavalry-i18n-qpa'\), \$false\)/
  );
  assert.match(script, /\$sentinelCreated = \$false/);
  assert.match(script, /if \(\$sentinelVerifiedForCleanup\)/);
  assert.ok(
    script.indexOf('Assert-NoPreexistingState -ShortcutPaths $shortcutPaths') <
      script.indexOf('New-ExternalCavalryQpaSentinel -Root $externalSentinelRoot'),
    'preexisting installed-state collisions must fail before the external sentinel is created'
  );
  assert.match(script, /finally \{/);
  assert.match(script, /Wait-ForNoResidualState/);
  assert.doesNotMatch(
    script,
    /\bRemove-Item(?:Property)?\b|\breg(?:\.exe)?\s+delete\b|\brmdir\b/i,
    'installed-surface smoke must leave unexpected residue visible instead of deleting around a failed uninstaller'
  );
});

test('Windows production launch uses QPA state and preserves the caller profile/login context', () => {
  const productionRuntime = readText('src-tauri/src/windows_runtime.rs');
  const runner = readText('src-tauri/src/privilege/runner.rs');

  assert.match(productionRuntime, /CAVALRY_I18N_DIAGNOSTIC_MARKER/);
  assert.match(productionRuntime, /QpaDeploymentState::Active/);
  assert.match(productionRuntime, /assert_eq!\(environment\.len\(\), 1\)/);
  assert.match(productionRuntime, /!environment\.contains_key\("QT_PLUGIN_PATH"\)/);
  assert.match(productionRuntime, /!environment\.contains_key\("QT_QPA_GENERIC_PLUGINS"\)/);
  assert.match(productionRuntime, /!environment\.contains_key\("CAVALRY_I18N_LANG"\)/);
  assert.doesNotMatch(productionRuntime, /APPDATA|LOCALAPPDATA|USERPROFILE|Credential/i);
  assert.doesNotMatch(runner, /\.env_clear\(\)/);
});

test('Windows disposable live-clone smoke is PID-bound, reversible, and manual-review only', () => {
  const liveEntry = readText('src-tauri/tests/manual_windows_live_smoke.rs');
  const live = [
    liveEntry,
    readText('src-tauri/tests/support/windows_live_capture.inc.rs'),
    readText('src-tauri/tests/support/windows_live_adjacent.inc.rs'),
    readText('src-tauri/tests/support/windows_live_orchestration.inc.rs'),
    readText('src-tauri/tests/support/windows_live_tests.inc.rs'),
  ].join('\n');
  const guard = readText('src-tauri/tests/support/windows_disposable.rs');
  const cloneGuard = readText(
    'src-tauri/tests/support/windows_clone_guard.rs'
  );
  const helper = readText('tools/capture_windows_pid_window.ps1');
  const acceptancePlugin = readText('injector/windows/cavalry_i18n_acceptance_plugin.cpp');
  const onboardingDriver = readText('injector/windows/cavalry_i18n_runtime.cpp');
  const sop = readText('LOCAL_BUILD_SOP.md');
  const textPathSources = readText(
    'injector/windows/cavalry_i18n_extension_layer_sources.h'
  );
  const combined = `${live}\n${guard}\n${cloneGuard}\n${helper}`;

  assert.match(live, /#\[ignore = "requires explicit disposable clone\/evidence TEMP roots/);
  assert.match(live, /CAVALRY_I18N_WINDOWS_SMOKE_APP/);
  assert.match(live, /CAVALRY_I18N_WINDOWS_LIVE_EVIDENCE_DIR/);
  assert.doesNotMatch(combined, /5ccbe11380404a19a1b3c40aa3ac545a|D:\\\\cavalry/i);
  assert.match(guard, /env::temp_dir\(\)/);
  assert.match(guard, /\.cavalry-i18n-disposable-smoke/);
  assert.match(guard, /FILE_ATTRIBUTE_REPARSE_POINT/);
  assert.match(guard, /path_is_strictly_within/);
  assert.match(guard, /assert_existing_chain_has_no_reparse/);
  assert.match(guard, /pub fn assert_write_target/);
  assert.match(live, /assert_safe_write_surface/);
  assert.match(
    live,
    /require_no_cavalry_processes\(&mut runner, &helper, "startup"\)[\s\S]*create_unique_child_directory[\s\S]*verify_live_clone_completeness[\s\S]*capture_english_baseline/
  );
  assert.match(live, /profile-full-surfaces-/);
  assert.match(live, /OsString::from\("LOCALAPPDATA"\)/);
  assert.match(live, /OsString::from\("APPDATA"\)/);
  assert.match(cloneGuard, /assets\/Icons\/sign-in-bg\.png/);
  assert.match(cloneGuard, /assets\/Icons\/cavByCanva\.png/);
  assert.match(cloneGuard, /assets\/Icons\/tool_search\.png/);
  assert.match(cloneGuard, /live-clone-resources\.json/);
  assert.doesNotMatch(
    `${live}\n${cloneGuard}`,
    /capture_real_workspace|restore_real_workspace|verify_real_workspace|RealWorkspaceSnapshot|workspace\.json|windows_workspace_guard/
  );
  assert.match(live, /const EXPECTED_JSON_COUNT: usize = 38/);
  assert.match(live, /apply_language_inner/);
  assert.match(live, /RealCommandRunner/);
  assert.match(live, /require_release_runtime_sources/);
  assert.match(live, /tools\/resolve_windows_cmake\.js/);
  assert.match(
    live,
    /"tools\/resolve_windows_cmake\.js",\s*"--ensure",\s*"--print-json",\s*"--platform",\s*"windows"/
  );
  assert.match(live, /WindowsCMakeToolchainIdentity/);
  assert.match(live, /command_first_line_path\([\s\S]*verified pinned Windows CMake/);
  assert.doesNotMatch(
    live,
    /command_first_line\(\s*"cmake",\s*&\["--version"\]/
  );
  assert.match(live, /WINDOWS_GENERIC_RELATIVE_PATH: &str = "injector\/windows\/generic\/cavalryi18n\.dll"/);
  assert.match(live, /WINDOWS_QPA_RELATIVE_PATH: &str = "injector\/windows\/qpa\/qwindows\.dll"/);
  assert.match(live, /live runner .* source .* does not match final NSIS shipped bytes/);
  assert.match(live, /spawn_detached_in_with_env_and_pid/);
  assert.doesNotMatch(live, /restart_cavalry_with_environment_and_pid/);
  assert.match(live, /wait_for_ready_marker/);
  assert.match(live, /extension_layer_hook_status != "installed"/);
  assert.match(
    live,
    /\("ViewportQuality", "viewport-quality"\)[\s\S]*\("TransformHelper", "transform-helper"\)[\s\S]*\("EditShapeHelper", "edit-shape-helper"\)[\s\S]*scenarios\.push\(\("CogPitch", "cog-pitch"\)\)/
  );
  assert.match(live, /Vec::with_capacity\(scenarios\.len\(\)\)/);
  assert.match(live, /CAVALRY_I18N_WINDOWS_LIVE_COG_PITCH/);
  assert.match(live, /MANUAL_COG_PITCH_TIMEOUT_MILLISECONDS:\s*u32\s*=\s*180_000/);
  assert.doesNotMatch(
    combined,
    /render_live_scene_script|ScenePrepared|SceneScriptPath|SceneProofPath|UIAutomation|SelectionItemPattern|api\.createComp/
  );
  const staticSourceTable = textPathSources.match(
    /kStaticTextPathSources\s*\{\{([\s\S]*?)\}\};/
  );
  assert.ok(staticSourceTable, 'static text-path source table must remain parseable');
  const staticSourceNames = [
    ...staticSourceTable[1].matchAll(/^\s*(k[A-Za-z0-9_]+),\s*$/gm),
  ].map((match) => match[1]);
  assert.ok(
    staticSourceNames.length > 0 && staticSourceNames.length < 63,
    'text-path source masks require one non-empty signed-JSON-safe uint64 source table'
  );
  assert.equal(
    new Set(staticSourceNames).size,
    staticSourceNames.length,
    'text-path source constants must not occupy duplicate mask slots'
  );
  const pitchSourceIndexMatch = textPathSources.match(
    /static_assert\(kPitchRadiusSourceIndex\s*==\s*(\d+)\)/
  );
  assert.ok(
    pitchSourceIndexMatch,
    'the preserved Pitch diagnostic index must remain explicit'
  );
  const pitchSourceIndex = Number.parseInt(pitchSourceIndexMatch[1], 10);
  const maskForSources = (names) =>
    names.reduce((mask, name) => {
      const staticIndex = staticSourceNames.indexOf(name);
      assert.notEqual(
        staticIndex,
        -1,
        `${name} must remain in the static source table`
      );
      const diagnosticIndex =
        staticIndex < pitchSourceIndex ? staticIndex : staticIndex + 1;
      return mask + 2 ** diagnosticIndex;
    }, 0);
  const expectedScenarioMasks = new Map([
    ['ViewportQuality', maskForSources(['kViewportQualityHigh'])],
    [
      'EditShapeHelper',
      maskForSources([
        'kDisableSnapping',
        'kEnableBezierAngleSnapping',
        'kSplitPathCorner',
        'kSplitPathBezier',
        'kToggleTransformTool',
        'kDeleteBezierHandle',
        'kEditShapeSplitCornerPrefix',
        'kEditShapeSplitBezierPrefix',
        'kEditShapeDeleteBezierHandlePrefix',
      ]),
    ],
    [
      'TransformHelper',
      maskForSources([
        'kEnableSnapping',
        'kPan',
        'kPlayStop',
        'kDirectLayerSelection',
        'kInsertKeyframe',
        'kTransformInsertKeyframePrefix',
        'kTransformDirectSelectionPrefix',
        'kTransformPanPrefix',
      ]),
    ],
    ['CogPitch', 2 ** pitchSourceIndex],
  ]);
  const parseScenarioMask = (text, pattern, scenario, surface) => {
    const match = text.match(pattern);
    assert.ok(match, `${surface} must declare a ${scenario} source mask`);
    return Number.parseInt(match[1].replaceAll('_', '').slice(2), 16);
  };
  for (const [scenario, expectedMask] of expectedScenarioMasks) {
    const rustMask = parseScenarioMask(
      live,
      new RegExp(`"${scenario}"\\s*=>\\s*(0x[0-9a-fA-F_]+)`),
      scenario,
      'Rust live gate'
    );
    const powershellMask = parseScenarioMask(
      helper,
      new RegExp(`'${scenario}'\\s*\\{\\s*(0x[0-9a-fA-F]+)\\s*\\}`),
      scenario,
      'PowerShell capture helper'
    );
    assert.equal(
      rustMask,
      expectedMask,
      `${scenario} Rust mask must derive from the C++ source order`
    );
    assert.equal(
      powershellMask,
      expectedMask,
      `${scenario} PowerShell mask must derive from the C++ source order`
    );
  }
  assert.doesNotMatch(live, /"CogPitch" => 0x0040_0000/);
  assert.doesNotMatch(live, /"CogPitch" => 0x0400_0000/);
  assert.doesNotMatch(live, /"CogPitch" => 0x2000_0000/);
  assert.match(live, /fallback_source_mask != 0/);
  assert.match(live, /translated_source_mask & required_text_path_mask/);
  assert.match(live, /\("zh-Hans", "平滑步数"\)/);
  assert.match(live, /\("zh-Hant", "平滑步數"\)/);
  assert.match(live, /\("ja_JP", "スムージングステップ数"\)/);
  assert.match(live, /cleanup_and_restore/);
  assert.match(live, /BTreeSet<u32>/);
  assert.match(live, /outstanding_processes\.insert\(process_id\)/);
  assert.match(live, /outstanding_processes\.remove\(&process_id\)/);
  assert.match(
    live,
    /cleanup_owned_process\(runner, helper, process_id, &layout\.executable\)\?;[\s\S]*if !outstanding_processes\.remove\(&process_id\)/
  );
  assert.match(
    live,
    /match close_owned_process\(runner, helper, process_id, executable\)[\s\S]*force_stop_owned_process\(runner, helper, process_id, executable\)/
  );
  assert.doesNotMatch(live, /wait_for_adjacent_shutdown|shutdown-main-close\.json|shutdown-event-loop\.json/);
  assert.match(live, /cavalryi18n_acceptance:onboarding/);
  assert.match(live, /capture_mode != LiveCaptureMode::FullSurfaces/);
  assert.doesNotMatch(live, /created_processes/);
  assert.match(live, /catch_unwind\(AssertUnwindSafe/);
  assert.match(live, /exercise panic:/);
  const caughtExercise = live.indexOf('let exercise = catch_unwind');
  const cleanupAfterExercise = live.indexOf('let cleanup = cleanup_and_restore', caughtExercise);
  assert.ok(caughtExercise >= 0 && cleanupAfterExercise > caughtExercise);
  assert.match(live, /apply_without_elevation\(repo, state_dir, layout, "en"\)/);
  assert.match(live, /restored == \*original/);
  assert.match(live, /"final global audit"/);
  assert.match(live, /MANUAL SCREENSHOT REVIEW REQUIRED/);
  assert.match(live, /no OCR assertion was performed/);
  assert.doesNotMatch(live, /thread::sleep|std::thread|Command::new/);
  assert.match(
    sop,
    /full-surface 门必须把每次 Cavalry launch 的 `APPDATA`\/`LOCALAPPDATA` 指向 run-root 下、由 harness 自己创建的 TEMP-owned profile/
  );
  assert.match(sop, /默认生成的三类 PNG，以及 opt-in 时追加的 Cog Pitch PNG/);
  assert.match(sop, /CAVALRY_I18N_WINDOWS_LIVE_COG_PITCH=1/);
  assert.match(sop, /菜单、属性编辑器、合成\/自动编号项、所有受控下拉显示项/);
  assert.match(sop, /同一用户下的恶意并发换链仍不是被完整消除的 TOCTOU/);
  assert.match(sop, /Ctrl\+C、进程强制终止、断电或 panic=abort 无法承诺执行 finally/);

  assert.match(helper, /Get-CimInstance Win32_Process -Filter "Name='Cavalry\.exe'"/);
  assert.match(helper, /Get-CimInstance Win32_Process -Filter "ProcessId=\$Id"/);
  assert.match(helper, /function Assert-DisposableCavalryExecutable/);
  assert.match(helper, /GetFileName\(\$executable\) -ieq 'Cavalry\.exe'/);
  assert.match(helper, /Test-StrictChildPath -Path \$cloneRoot -Root \$tempRoot/);
  assert.match(
    helper,
    /Assert-NoReparseTargetChain `\s+-Root \$tempRoot `\s+-Target \$executable/
  );
  assert.match(helper, /Join-Path \$cloneRoot \$disposableSentinel/);
  const executableGuard = helper.indexOf(
    '$ExecutablePath = Assert-DisposableCavalryExecutable -Path $ExecutablePath'
  );
  const closeBranch = helper.indexOf("if ($Action -eq 'Close')");
  assert.ok(executableGuard >= 0, 'Capture/Close must invoke the disposable executable guard');
  assert.ok(
    executableGuard < closeBranch,
    'disposable executable guard must run before the Close/Capture branch split'
  );
  assert.match(helper, /ExecutablePath/);
  assert.match(helper, /GetWindowThreadProcessId/);
  assert.match(helper, /WaitForInputIdle/);
  assert.match(helper, /catch \[System\.InvalidOperationException\]/);
  assert.match(helper, /continue with the PID window oracle/);
  assert.match(helper, /WaitForChanged/);
  assert.match(helper, /WaitForSingleObject/);
  assert.match(helper, /extensionLayerHookStatus -ceq 'installed'/);
  assert.match(helper, /Wait-ForTextPathDiagnostics/);
  assert.match(helper, /fallbackSourceMask -eq 0/);
  assert.match(helper, /\[uint64\]\$RequiredSourceMask/);
  assert.match(helper, /\[uint64\]\$diagnostics\.translatedSourceMask/);
  assert.match(live, /translated_source_mask:\s*u64/);
  assert.match(live, /fallback_source_mask:\s*u64/);
  assert.doesNotMatch(helper, /'CogPitch'\s*\{\s*0x00400000\s*\}/);
  assert.doesNotMatch(helper, /'CogPitch'\s*\{\s*0x04000000\s*\}/);
  assert.doesNotMatch(helper, /'CogPitch'\s*\{\s*0x20000000\s*\}/);
  assert.match(
    helper,
    /ValidateSet\('ViewportQuality', 'TransformHelper', 'EditShapeHelper', 'CogPitch', 'Onboarding', 'Adjacent'\)/
  );
  assert.match(live, /CAVALRY_I18N_WINDOWS_ONBOARDING_ACCEPTANCE_DIR/);
  assert.match(live, /CAVALRY_I18N_WINDOWS_ADJACENT_ACCEPTANCE_DIR/);
  assert.match(
    live,
    /qt-widget-grab-exact-producer\+pid-hwnd-anchor/
  );
  assert.match(live, /terminal=step5-ack-only/);
  assert.match(live, /guide_parameter_type == "std::string"/);
  assert.match(live, /guide_parameter_type == "const std::string&"/);
  assert.match(acceptancePlugin, /QStandardPaths::setTestModeEnabled\(true\)/);
  assert.match(guard, /QT_TEST_PROFILE_SENTINEL/);
  assert.match(guard, /cavalry-i18n\.windows-qt-test-profile\/v1/);
  assert.match(guard, /prepare_qt_test_profile/);
  assert.match(guard, /cleanup_qt_test_profile/);
  assert.match(live, /prepare_qt_test_profile/);
  assert.match(live, /cleanup_qt_test_profile/);
  assert.match(onboardingDriver, /kOnboardingStartupSettleMilliseconds\s*=\s*15'000/);
  assert.match(onboardingDriver, /waiting-for-transition/);
  assert.match(onboardingDriver, /kOnboardingTransitionClickAttempts\s*=\s*3/);
  assert.match(onboardingDriver, /expectedTitleHits == 1 && expectedBodyHits == 1/);
  assert.match(onboardingDriver, /workspaceResetPromptObserved/);
  assert.match(onboardingDriver, /neither Ok nor Cancel was invoked/);
  assert.match(onboardingDriver, /forward->click\(\)/);
  assert.doesNotMatch(onboardingDriver, /acceptButton->click|cancelButton->click|showStepImmediate|AddVectoredExceptionHandler/);
  assert.match(helper, /ExpectedWindowHandle/);
  assert.match(helper, /IsExactVisibleWindow/);
  assert.match(helper, /onboarding-window=runtime-exact-hwnd/);
  assert.match(helper, /adjacent-producer=runtime-exact-hwnd/);
  assert.match(helper, /AllowManualCogPitch/);
  assert.match(helper, /manual-disposable-cogwheel-drag/);
  assert.match(helper, /BaselineDiagnostics/);
  assert.match(
    helper,
    /diagnostics\.revision\s+-gt\s+\[uint64\]\$BaselineDiagnostics\.revision/
  );
  assert.match(
    helper,
    /diagnostics\.canonicalCalls\s+-gt\s+\[uint64\]\$BaselineDiagnostics\.canonicalCalls/
  );
  assert.match(
    helper,
    /diagnostics\.whitelistCalls\s+-gt\s+\[uint64\]\$BaselineDiagnostics\.whitelistCalls/
  );
  assert.match(
    helper,
    /diagnostics\.cjkPathSuccess\s+-gt\s+\[uint64\]\$BaselineDiagnostics\.cjkPathSuccess/
  );
  assert.match(helper, /pre-set Pitch bit 28/);
  assert.doesNotMatch(helper, /pre-set Pitch bit 29/);
  assert.doesNotMatch(helper, /pre-set Pitch bit 26/);
  assert.doesNotMatch(helper, /pre-set Pitch bit 22/);
  assert.match(helper, /textPathBaselineDiagnostics\s*=\s*\$cogPitchBaseline/);
  assert.match(helper, /function Wait-ForExactForegroundWindow/);
  assert.match(helper, /function Prepare-ToolHelperEvidence/);
  assert.match(helper, /PostVirtualKey\(\s*\$Window,\s*0x41,\s*\[uint32\]\$ExpectedProcessId\s*\)/);
  assert.match(helper, /exact-hwnd-postmessage-vk-a/);
  const foregroundWait = helper.match(
    /function Wait-ForExactForegroundWindow[\s\S]*?\r?\n}\r?\n\r?\nfunction Prepare-ToolHelperEvidence/
  )[0];
  assert.equal(
    (foregroundWait.match(/RequestForegroundWindow/g) || []).length,
    1,
    'the helper should retry one foreground request at a time inside its bounded exact-HWND wait'
  );
  assert.match(foregroundWait, /\$foregroundAttempt/);
  assert.match(foregroundWait, /\$maxForegroundAttempts/);
  assert.match(foregroundWait, /\$foregroundAttempt -lt \$maxForegroundAttempts/);
  assert.match(foregroundWait, /UtcNow -lt \$Deadline/);
  assert.match(
    foregroundWait,
    /ExactForegroundWindow\([\s\S]*?\$Window,[\s\S]*?\[uint32\]\$ExpectedProcessId/
  );
  assert.match(foregroundWait, /WaitForSingleObject\(\$Process\.Handle, 100\)/);
  const toolPreparation = helper.match(
    /function Prepare-ToolHelperEvidence[\s\S]*?\r?\n}\r?\n\r?\nfunction Wait-ForExtensionLayerMarker/
  )[0];
  assert.doesNotMatch(
    toolPreparation,
    /FocusBelongsToProcess|SetForegroundWindow/,
    'exact-HWND PostMessage must use the bounded exact-window focus gate'
  );
  assert.match(toolPreparation, /Wait-ForExactForegroundWindow/);
  assert.match(
    toolPreparation,
    /Wait-ForExactForegroundWindow[\s\S]*PostVirtualKey\([\s\S]*\$Window,[\s\S]*0x41,[\s\S]*ExpectedProcessId[\s\S]*\)/
  );
  assert.doesNotMatch(
    toolPreparation,
    /Refusing Edit Shape Tool evidence because focus changed during exact-HWND key delivery/,
    'same-PID child/modal focus after key delivery is a valid Cavalry outcome'
  );
  assert.match(helper, /WM_KEYDOWN/);
  assert.match(helper, /WM_KEYUP/);
  assert.doesNotMatch(
    helper,
    /SetCursorPos|mouse_event|SendInput|GetClickablePoint|FromPoint|InvokePattern|Get-UiAutomationInventory/
  );
  assert.match(helper, /DwmFlush/);
  assert.match(helper, /PrintWindow/);
  assert.match(helper, /PostMessage/);
  assert.match(helper, /WM_CLOSE/);
  assert.match(
    helper,
    /if \(\$Action -eq 'ForceStop'\)[\s\S]*Get-ExactProcess[\s\S]*Stop-Process -Id \$TargetProcessId -Force/
  );
  assert.equal(
    (helper.match(/\bStop-Process\b/g) || []).length,
    1,
    'exact-PID ForceStop must remain the only Stop-Process call'
  );
  assert.match(helper, /RequestForegroundWindow/);
  assert.match(helper, /ExactForegroundWindow/);
  assert.match(helper, /FindProcessWindows/);
  assert.doesNotMatch(helper, /ConfirmDiscardOfDisposableScene|keybd_event/);
  assert.match(helper, /hasRenderedContent/);
  assert.match(helper, /ImageFormat\]::Png/);
  assert.doesNotMatch(
    helper,
    /\bStart-Sleep\b|\.Kill\(|TerminateProcess|\bRemove-Item\b/i
  );

  if (process.platform === 'win32') {
    const rejected = spawnSync('powershell.exe', [
      '-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
      '-File', path.join(repoRoot, 'tools', 'capture_windows_pid_window.ps1'),
      '-Action', 'Close', '-TargetProcessId', '2147483647',
      '-ExecutablePath', String.raw`D:\cavalry\Cavalry.exe`,
    ], { cwd: repoRoot, encoding: 'utf8', windowsHide: true });
    assert.notEqual(rejected.status, 0, 'standalone helper must reject D:\\cavalry');
    assert.match(
      `${rejected.stdout}\n${rejected.stderr}`,
      /clone root must be strictly below %TEMP%/,
      'D:\\cavalry must fail at the common clone guard before any PID lookup'
    );
  }
});

test('tauri development icon keeps the packaged transparency contract and About projection aligned', () => {
  const runtime = rgbaPngAlphaContract('src-tauri/icons/icon.png');
  const about = rgbaPngAlphaContract('renderer/app-icon.png');
  assert.deepEqual(runtime, {
    width: 512,
    height: 512,
    bounds: [0, 0, 512, 512],
    cornerAlpha: [0, 0, 0, 0],
  });
  assert.deepEqual(about, {
    width: 128,
    height: 128,
    bounds: [0, 0, 128, 128],
    cornerAlpha: [0, 0, 0, 0],
  });
  assert.deepEqual(
    fs.readFileSync(path.join(repoRoot, 'renderer/app-icon.png')),
    fs.readFileSync(path.join(repoRoot, 'src-tauri/icons/128x128.png'))
  );
});

test('tauri capability and SOP mention the bridge and packaged resource boundaries', () => {
  const localSop = readText('LOCAL_BUILD_SOP.md');
  const capabilities = readJson('src-tauri/capabilities/default.json');
  const aboutCapabilities = readJson('src-tauri/capabilities/about.json');

  assert.ok(capabilities.windows.includes('main'));
  assert.ok(capabilities.permissions.includes('core:default'));
  assert.ok(capabilities.permissions.includes('core:window:default'));
  assert.ok(capabilities.permissions.includes('core:window:allow-start-dragging'));
  assert.ok(capabilities.permissions.includes('core:webview:default'));
  assert.deepEqual(aboutCapabilities.windows, ['about']);
  assert.deepEqual(aboutCapabilities.permissions, [
    'core:app:allow-version',
    'core:window:allow-start-dragging',
    'core:window:allow-close',
  ]);
  assert.equal(aboutCapabilities.permissions.includes('core:window:default'), false);
  assert.equal(aboutCapabilities.permissions.includes('core:webview:default'), false);

  for (const requiredText of [
    'tauri.conf.json',
    'tauri.macos.conf.json',
    'tauri.windows.conf.json',
    'languages',
    'libCavalryTranslatorInjector.dylib',
    'build:tauri:windows',
    'provenance',
    'src-tauri/target/release/bundle',
    'DMG',
    '.app',
    'Developer ID',
    'SHA256SUMS',
    'release-asset-provenance.json',
  ]) {
    assert.match(localSop, new RegExp(requiredText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('release supply-chain pins, source completeness, and provenance schema are executable', () => {
  const pins = readJson('tools/ci_action_pins.json');
  const workflow = readText('.github/workflows/build.yml');
  const requirementsInput = readText('requirements-ci.in');
  const requirements = readText('requirements-ci.txt');
  const rustToolchain = readText('rust-toolchain.toml');

  assert.equal(pins.kind, 'CiActionPins');
  assert.match(requirementsInput, /^aqtinstall==3\.3\.0$/m);
  assert.match(requirements, /^aqtinstall==3\.3\.0/m);
  assert.match(requirements, /--hash=sha256:[a-f0-9]{64}/);
  assert.match(rustToolchain, /channel\s*=\s*"1\.98\.0"/);
  assert.match(readText('SECURITY.md'), /ad-hoc signed and not notarized/);
  assert.match(readText('SECURITY.md'), /Tauri Updater signature/);
  assert.match(readText('.github/CODEOWNERS'), /@singkia/);
  assert.doesNotMatch(readText('README.md'), /\/Users\/luo\//);
  assert.doesNotMatch(readText('LOCAL_BUILD_SOP.md'), /\/Users\/luo\//);
  assert.match(readText('README.md'), /<repository-path>/);
  assert.match(
    workflow,
    /pip install[^\n]*--require-hashes[^\n]*--only-binary=:all:[^\n]*-r requirements-ci\.txt/
  );
  assert.doesNotMatch(workflow, /pip install\s+--upgrade\s+pip/);
  assert.match(workflow, /python-version:\s*'3\.12\.6'/);
  assert.match(workflow, /concurrency:/);

  const pinCheck = spawnSync(process.execPath, ['tools/verify_ci_action_pins.js'], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  assert.equal(pinCheck.status, 0, pinCheck.stderr || pinCheck.stdout);

  const sourceCheck = spawnSync(
    process.execPath,
    ['tools/verify_source_artifact.js', '--check-repo', '--check-workflow'],
    { cwd: repoRoot, encoding: 'utf8' }
  );
  assert.equal(sourceCheck.status, 0, sourceCheck.stderr || sourceCheck.stdout);

  const provenanceSchema = spawnSync(
    process.execPath,
    ['tools/verify_release_provenance.js', '--check-schema'],
    { cwd: repoRoot, encoding: 'utf8' }
  );
  assert.equal(provenanceSchema.status, 0, provenanceSchema.stderr || provenanceSchema.stdout);
});
