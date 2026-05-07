#!/usr/bin/env node
/**
 * [INPUT]: 依赖 node:test 与仓库源码文件，读取 Electron patcher、语言资源、工具脚本和 package 脚本契约
 * [OUTPUT]: 对外提供 npm run test:desktop 的 Node 测试集合，冻结桌面补丁器行为与迁移前置条件
 * [POS]: tools 的 Electron baseline 守门测试，被 Tauri 迁移 Phase -1 作为旧世界可信度检查
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const repoRoot = path.resolve(__dirname, '..');
const desktopRoot = path.join(repoRoot, 'desktop-patcher');
const detectModulePath = path.join(desktopRoot, 'lib', 'detect.js');
const patchModulePath = path.join(desktopRoot, 'lib', 'patch.js');

function readDesktopBackendSource() {
  return [
    fs.readFileSync(path.join(desktopRoot, 'main.js'), 'utf8'),
    fs.readFileSync(path.join(desktopRoot, 'i18n-handlers.js'), 'utf8'),
  ].join('\n');
}

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'cavalry-i18n-test-'));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function sha256(filePath) {
  return require('node:crypto').createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function sha256JsonWithoutHash(value) {
  const copy = JSON.parse(JSON.stringify(value));
  delete copy.hash;
  return require('node:crypto').createHash('sha256').update(JSON.stringify(copy)).digest('hex');
}

function copyTool(tempRoot, toolName) {
  const sourcePath = path.join(repoRoot, 'tools', toolName);
  const targetPath = path.join(tempRoot, 'tools', toolName);
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.copyFileSync(sourcePath, targetPath);
}

function writeLanguageFixture(rootDir, languageCode, values) {
  const languageRoot = path.join(rootDir, 'languages', languageCode);
  writeJson(path.join(languageRoot, 'appStrings.json'), [{ value: { label: values.appLabel } }]);
  writeJson(path.join(languageRoot, 'nodeStrings.json'), [{ value: { label: values.nodeLabel } }]);
  writeJson(path.join(languageRoot, 'onboarding.json'), [{ value: { label: values.onboardingLabel } }]);
  writeJson(path.join(languageRoot, 'tips.json'), [{ value: { label: values.tipLabel } }]);
}

function writeFrozenExtractionInventory(rootDir, extractionPath) {
  writeJson(extractionPath, {
    surfaces: {
      'languages/en/appStrings.json': {
        englishLeaves: [{ path: '$[0].value.label', value: 'Frozen App Label', valueType: 'string' }],
      },
      'languages/en/nodeStrings.json': {
        englishLeaves: [{ path: '$[0].value.label', value: 'Frozen Node Label', valueType: 'string' }],
      },
      'languages/en/onboarding.json': {
        englishLeaves: [{ path: '$[0].value.label', value: 'Frozen Onboarding Label', valueType: 'string' }],
      },
      'languages/en/tips.json': {
        englishLeaves: [{ path: '$[0].value.label', value: 'Frozen Tip Label', valueType: 'string' }],
      },
    },
  });
}

function makeValidatorFixtureRepo() {
  const tempRoot = makeTempDir();
  copyTool(tempRoot, 'validate_translations.py');
  copyTool(tempRoot, 'forbidden_translation_patterns.py');
  copyTool(tempRoot, 'forbidden_translation_patterns.json');

  writeJson(path.join(tempRoot, 'tools', 'translation-whitelist.json'), {
    appStrings: { translate: ['label'], no_translate: [], locale_sync: [] },
    nodeStrings: { translate: ['label'], no_translate: [], locale_sync: [] },
    onboarding: { translate: ['label'], no_translate: [], locale_sync: [] },
    tips: { translate: ['label'], no_translate: [], locale_sync: [] },
    plugins: { translate: ['label'], no_translate: [], locale_sync: [] },
  });

  writeJson(path.join(tempRoot, 'languages', 'en', 'appStrings.json'), [
    { value: { label: 'Current App Label', extra: 'Current Extra Leaf' } },
  ]);
  writeJson(path.join(tempRoot, 'languages', 'en', 'nodeStrings.json'), [{ value: { label: 'Current Node Label' } }]);
  writeJson(path.join(tempRoot, 'languages', 'en', 'onboarding.json'), [
    { value: { label: 'Current Onboarding Label' } },
  ]);
  writeJson(path.join(tempRoot, 'languages', 'en', 'tips.json'), [{ value: { label: 'Current Tip Label' } }]);

  writeLanguageFixture(tempRoot, 'zh-Hans', {
    appLabel: 'Current App Label',
    nodeLabel: '节点标签',
    onboardingLabel: '欢迎',
    tipLabel: '提示',
  });
  writeLanguageFixture(tempRoot, 'zh-Hant', {
    appLabel: '目前的應用標籤',
    nodeLabel: '節點標籤',
    onboardingLabel: '歡迎',
    tipLabel: '提示',
  });
  writeLanguageFixture(tempRoot, 'ja_JP', {
    appLabel: '現在のアプリラベル',
    nodeLabel: 'ノードラベル',
    onboardingLabel: 'ようこそ',
    tipLabel: 'ヒント',
  });

  const extractionPath = path.join(tempRoot, 'session', 'extraction-inventory.json');
  writeFrozenExtractionInventory(tempRoot, extractionPath);
  return { tempRoot, extractionPath };
}

function makeFakeBundle(rootDir) {
  const appPath = path.join(rootDir, 'Cavalry.app');
  const assetsRoot = path.join(appPath, 'Contents', 'assets');

  writeJson(path.join(assetsRoot, 'Definitions', 'nodeStrings.json'), { value: 'EN node' });
  writeJson(path.join(assetsRoot, 'Definitions', 'appStrings.json'), { value: 'EN app' });
  writeJson(path.join(assetsRoot, 'Learn', 'tips.json'), { title: 'EN tip', text: 'EN text' });
  writeJson(path.join(assetsRoot, 'Learn', 'onboarding.json'), { title: 'EN onboarding' });
  writeJson(path.join(assetsRoot, 'Plugins', 'Gaussian Blur Filter', 'strings.json'), {
    niceName: 'Gaussian Blur Filter',
    language: 'en',
  });
  writeJson(path.join(assetsRoot, 'Plugins', 'Bulge Filter', 'strings.json'), {
    niceName: 'Bulge Filter',
    language: 'en',
  });

  return appPath;
}

test('desktop patcher workspace includes the compiled UI workflow files', () => {
  const expectedFiles = [
    path.join(repoRoot, 'package.json'),
    path.join(desktopRoot, 'main.js'),
    path.join(desktopRoot, 'i18n-handlers.js'),
    path.join(desktopRoot, 'preload.js'),
    path.join(desktopRoot, 'renderer', 'index.html'),
    path.join(desktopRoot, 'renderer', 'app.js'),
    path.join(desktopRoot, 'renderer', 'styles.css'),
    path.join(desktopRoot, 'lib', 'detect.js'),
    path.join(desktopRoot, 'lib', 'patch.js'),
    path.join(desktopRoot, 'lib', 'sudo.js'),
    path.join(desktopRoot, 'injector', 'CavalryTranslatorInjector.mm'),
    path.join(desktopRoot, 'injector', 'generated_translations.inc'),
    path.join(repoRoot, 'languages', 'zh-Hans', 'nodeStrings.json'),
    path.join(repoRoot, 'languages', 'zh-Hant', 'nodeStrings.json'),
    path.join(repoRoot, 'languages', 'ja_JP', 'nodeStrings.json'),
    path.join(repoRoot, 'tools', 'build_translator_injector.sh'),
    path.join(repoRoot, 'tools', 'extract_compiled_ui_strings.js'),
    path.join(repoRoot, 'tools', 'generate_embedded_translations.js'),
    path.join(repoRoot, 'tools', 'launch_cavalry_with_injector.sh'),
    path.join(repoRoot, 'tools', 'zh-Hans.ts'),
    path.join(repoRoot, 'tools', 'zh-Hant.ts'),
    path.join(repoRoot, 'tools', 'ja_JP.ts'),
    path.join(repoRoot, 'tools', 'translation-whitelist.json'),
  ];

  for (const filePath of expectedFiles) {
    assert.ok(fs.existsSync(filePath), `${path.relative(repoRoot, filePath)} missing`);
  }

  const removedPaths = [
    path.join(repoRoot, 'LanguageSwitcher.js'),
    path.join(repoRoot, 'LanguageSwitcher_assets'),
    path.join(desktopRoot, 'lib', 'patcher-config.js'),
    path.join(repoRoot, 'tools', 'patch_cavalry_bundle.py'),
    path.join(repoRoot, 'tools', 'check_language_switcher_runtime.js'),
  ];

  for (const removedPath of removedPaths) {
    assert.equal(
      fs.existsSync(removedPath),
      false,
      `${path.relative(repoRoot, removedPath)} should have been removed`
    );
  }
});

test('detect helpers ignore the English baseline and prefer a saved app path', () => {
  const { findCavalryApp, listLanguageOptions } = require(detectModulePath);
  const tempRoot = makeTempDir();
  const languagesDir = path.join(tempRoot, 'languages');

  fs.mkdirSync(path.join(languagesDir, 'en'), { recursive: true });
  fs.mkdirSync(path.join(languagesDir, 'zh-Hans'), { recursive: true });
  fs.mkdirSync(path.join(languagesDir, 'ja_JP'), { recursive: true });
  fs.writeFileSync(path.join(languagesDir, 'README.txt'), 'ignore me');

  const savedAppPath = path.join(tempRoot, 'Saved', 'Cavalry.app');
  fs.mkdirSync(savedAppPath, { recursive: true });

  assert.deepEqual(listLanguageOptions(languagesDir), ['ja_JP', 'zh-Hans']);
  assert.equal(findCavalryApp(savedAppPath), savedAppPath);
});

test('patch helpers extract English files, discover plugins, and stage copy pairs', () => {
  const { buildCopyPairs, discoverPlugins, extractEnglish, stageFiles } = require(patchModulePath);
  const tempRoot = makeTempDir();
  const appPath = makeFakeBundle(tempRoot);
  const englishDir = path.join(tempRoot, 'state', 'en');
  const langDir = path.join(tempRoot, 'languages', 'zh-Hans');
  const stagingDir = path.join(tempRoot, 'staging');

  writeJson(path.join(langDir, 'nodeStrings.json'), { value: 'ZH node' });
  writeJson(path.join(langDir, 'appStrings.json'), { value: 'ZH app' });
  writeJson(path.join(langDir, 'tips.json'), { title: 'ZH tip', text: 'ZH text' });
  writeJson(path.join(langDir, 'onboarding.json'), { title: 'ZH onboarding' });
  writeJson(path.join(langDir, 'plugins', 'gaussianBlurFilter.json'), {
    niceName: 'Gaussian Blur Filter',
    language: 'zh-Hans',
  });

  assert.deepEqual(discoverPlugins(appPath), [
    { folderName: 'Bulge Filter', camelName: 'bulgeFilter' },
    { folderName: 'Gaussian Blur Filter', camelName: 'gaussianBlurFilter' },
  ]);

  extractEnglish(appPath, englishDir);
  assert.deepEqual(readJson(path.join(englishDir, 'nodeStrings.json')), { value: 'EN node' });
  assert.deepEqual(readJson(path.join(englishDir, 'plugins', 'gaussianBlurFilter.json')), {
    niceName: 'Gaussian Blur Filter',
    language: 'en',
  });

  const pairs = buildCopyPairs(langDir, appPath);
  assert.deepEqual(
    pairs.map(({ src, dst }) => ({
      src: path.relative(langDir, src),
      dst: dst.replace(appPath, '<app>'),
    })),
    [
      { src: 'nodeStrings.json', dst: '<app>/Contents/assets/Definitions/nodeStrings.json' },
      { src: 'appStrings.json', dst: '<app>/Contents/assets/Definitions/appStrings.json' },
      { src: 'tips.json', dst: '<app>/Contents/assets/Learn/tips.json' },
      { src: 'onboarding.json', dst: '<app>/Contents/assets/Learn/onboarding.json' },
      {
        src: path.join('plugins', 'gaussianBlurFilter.json'),
        dst: '<app>/Contents/assets/Plugins/Gaussian Blur Filter/strings.json',
      },
    ]
  );

  const stagedPairs = stageFiles(pairs, stagingDir);
  assert.equal(stagedPairs.length, 5);
  for (const pair of stagedPairs) {
    assert.ok(pair.src.startsWith(stagingDir), 'staged file should live in staging dir');
    assert.ok(fs.existsSync(pair.src), 'staged file should exist');
  }
});

test('renderer and preload expose the simplified JSON-only desktop flow', () => {
  const preload = fs.readFileSync(path.join(desktopRoot, 'preload.js'), 'utf8');
  const html = fs.readFileSync(path.join(desktopRoot, 'renderer', 'index.html'), 'utf8');

  assert.match(preload, /getStatus/);
  assert.match(preload, /browseApp/);
  assert.match(preload, /extractEnglish/);
  assert.match(preload, /applyLanguage/);
  assert.match(preload, /restartCavalry/);

  assert.match(html, /id="currentLabel">Current<\/span>\s+—/);
  assert.match(html, /Apply &amp; Restart|Apply & Restart/);
  assert.match(html, /id="statusText"/);
  assert.doesNotMatch(
    html,
    /Editing files inside Cavalry\.app may change how macOS code-signature verification reports this install\./,
    'desktop UI should not show a stale always-on code-signature warning when no warning was reported'
  );
  assert.doesNotMatch(html, /id="outputAppPath"/);
  assert.doesNotMatch(html, /id="qmTarget"/);
  assert.doesNotMatch(html, /id="inspectButton"/);
  assert.doesNotMatch(html, /id="diagnosticsGrid"/);
});

test('renderer only switches status to warning when the patch flow reports a real warning', () => {
  const rendererSource = fs.readFileSync(path.join(desktopRoot, 'renderer', 'app.js'), 'utf8');

  assert.match(
    rendererSource,
    /result\.warning/,
    'renderer should branch on applyLanguage warnings instead of showing a permanent warning note'
  );
  assert.match(
    rendererSource,
    /result\.warning\s*\?\s*'warning'\s*:\s*'success'/,
    'renderer should downgrade the status tone only when applyLanguage returns a warning'
  );
});

test('macOS copy helper does not perform blanket xattr cleanup during file replacement', () => {
  const sudoSource = fs.readFileSync(path.join(desktopRoot, 'lib', 'sudo.js'), 'utf8');

  assert.doesNotMatch(
    sudoSource,
    /xattr\s+-cr/,
    'file-copy escalation should not silently run blanket xattr cleanup; targeted quarantine removal is handled separately in the main macOS patch flow'
  );
});

test('macOS patch helper can fall back to Finder-style replacement without re-signing the whole app bundle', () => {
  const sudoSource = fs.readFileSync(path.join(desktopRoot, 'lib', 'sudo.js'), 'utf8');

  assert.match(
    sudoSource,
    /tell application "Finder"/,
    'macOS helper should include a Finder fallback when shell copy is denied'
  );
  assert.match(
    sudoSource,
    /duplicate .* to /,
    'Finder fallback should duplicate the staged JSON into the target folder'
  );
  assert.match(
    sudoSource,
    /set name of .* to /,
    'Finder fallback should rename the staged file to the exact destination filename'
  );
  assert.doesNotMatch(
    sudoSource,
    /set destinationItem to POSIX file dstPath/,
    'Finder fallback should not directly resolve the destination POSIX file object before checking existence'
  );
  assert.doesNotMatch(
    sudoSource,
    /codesign --force --deep --sign -/,
    'automatic JSON patching should not re-sign the entire Cavalry.app bundle after replacing language files'
  );
});

test('desktop main process patches the original macOS app for direct translated launches', () => {
  const mainSource = readDesktopBackendSource();

  assert.match(
    mainSource,
    /Cavalry\.i18n-original|cavalry-i18n-lang\.txt|libCavalryTranslatorInjector\.dylib/,
    'translated macOS installs should patch the original app bundle so it can launch directly in the target language'
  );
  assert.doesNotMatch(
    mainSource,
    /translated-apps|translatedApp|launch_cavalry_with_injector\.sh/,
    'desktop patcher should not depend on translated app copies or an external launcher for normal macOS usage'
  );
});

test('desktop main process can recover current language from the patched app bundle itself', () => {
  const mainSource = readDesktopBackendSource();

  assert.match(
    mainSource,
    /readFileSync\(getLangMarkerPath\(appPath\)/,
    'desktop patcher should prefer the bundle-local language marker over stale state.json when detecting the current macOS language'
  );
});

test('packaged desktop app prefers a bundled injector resource over rebuilding from source at runtime', () => {
  const mainSource = readDesktopBackendSource();

  assert.match(
    mainSource,
    /process\.resourcesPath/,
    'packaged Electron app should look for a prebuilt injector under process.resourcesPath'
  );
  assert.match(
    mainSource,
    /resources.*injector|path\.join\(process\.resourcesPath, 'injector'/,
    'packaged Electron app should read the injector from a packaged resource directory'
  );
  assert.match(
    mainSource,
    /buildInjectorFromSource\(appPath, buildScriptPath, getInjectorBuildCachePath\(\)\)/,
    'local desktop runs should rebuild the injector from source instead of blindly trusting a checked-in dylib that may target the wrong Qt branch'
  );
});

test('embedded injector does not depend on runtime qm files', () => {
  const injectorSource = fs.readFileSync(
    path.join(desktopRoot, 'injector', 'CavalryTranslatorInjector.mm'),
    'utf8'
  );

  assert.match(
    injectorSource,
    /translate\s*\(/,
    'injector should provide in-memory translation logic for compiled UI strings'
  );
  assert.doesNotMatch(
    injectorSource,
    /qtbase_|cavalry_.*\.qm|CAVALRY_I18N_QM_DIR/,
    'release translation path should not require runtime qm files or user-installed Qt tools'
  );
});

test('embedded injector refreshes the native macOS menu bar after installing translations', () => {
  const injectorSource = fs.readFileSync(
    path.join(desktopRoot, 'injector', 'CavalryTranslatorInjector.mm'),
    'utf8'
  );

  assert.match(
    injectorSource,
    /\[NSApp mainMenu\]|\[NSApplication sharedApplication\]/,
    'injector should touch the native AppKit menu bar because late-installed Qt translators do not automatically retranslate existing macOS menus'
  );
  assert.match(
    injectorSource,
    /NSMenuItem|submenu/,
    'injector should walk native menu items recursively to refresh existing menu labels after launch'
  );
});

test('embedded injector translates Qt-owned menus before AppKit sync can overwrite them', () => {
  const injectorSource = fs.readFileSync(
    path.join(desktopRoot, 'injector', 'CavalryTranslatorInjector.mm'),
    'utf8'
  );

  assert.match(
    injectorSource,
    /qapplication\.h|QApplication/,
    'injector should use QApplication so it can modify the Qt-owned menu state instead of relying only on NSMenuItem titles'
  );
  assert.match(
    injectorSource,
    /qmenubar\.h|QMenuBar/,
    'injector should look for QMenuBar instances because Qt owns the menu bar model'
  );
  assert.match(
    injectorSource,
    /qmenu\.h|QMenu/,
    'injector should traverse QMenu objects so submenu titles stay translated'
  );
  assert.match(
    injectorSource,
    /qaction\.h|QAction/,
    'injector should update QAction text because Qt syncs native menu labels from action text'
  );
  assert.match(
    injectorSource,
    /menu->setTitle|action->setText/,
    'injector should write translated menu text back through Qt APIs before refreshing the native menu'
  );
});

test('embedded injector keeps retrying until a Qt menu surface exists', () => {
  const injectorSource = fs.readFileSync(
    path.join(desktopRoot, 'injector', 'CavalryTranslatorInjector.mm'),
    'utf8'
  );

  assert.match(
    injectorSource,
    /translateQtMenuBar/,
    'injector should separate Qt menu translation from translator installation so menu readiness can be retried'
  );
  assert.match(
    injectorSource,
    /if\s*\(\s*gTranslator\s*==\s*nullptr\s*\)|if\s*\(\s*!gTranslator\s*\)/,
    'injector should install the translator only once while continuing to retry menu translation'
  );
  assert.match(
    injectorSource,
    /if\s*\(\s*!translateQtMenuBar\(lang\)\s*\)\s*\{\s*return false;\s*\}/,
    'injector should keep retrying until a Qt menu bar exists instead of stopping as soon as QCoreApplication appears'
  );
  assert.match(
    injectorSource,
    /actions\(\)|isEmpty\(\)/,
    'injector should treat an empty QMenuBar as not-ready so retries continue until menu actions exist'
  );
});

test('manual debug launcher follows the embedded-injector flow', () => {
  const launcherSource = fs.readFileSync(
    path.join(repoRoot, 'tools', 'launch_cavalry_with_injector.sh'),
    'utf8'
  );

  assert.doesNotMatch(
    launcherSource,
    /lrelease|CAVALRY_I18N_QM_DIR|qtbase_.*\.qm|cavalry_.*\.qm/,
    'manual launcher should match the embedded-injector runtime and not rebuild qm files'
  );
  assert.match(
    launcherSource,
    /CAVALRY_I18N_LANG/,
    'manual launcher should pass the selected language directly to the embedded injector'
  );
});

test('macOS signing path handles crashpad_handler before re-signing the original app bundle', () => {
  const mainSource = readDesktopBackendSource();

  assert.match(
    mainSource,
    /crashpad_handler/,
    'macOS signing path should explicitly account for crashpad_handler'
  );
  assert.match(
    mainSource,
    /remove-signature/,
    'macOS signing path should strip stale crashpad signatures before re-signing the app bundle'
  );
  assert.match(
    mainSource,
    /collectNestedCodePaths|isMachOBinary/,
    'macOS signing path should enumerate nested Mach-O code objects instead of relying on outer bundle signing alone'
  );
});

test('macOS patch flow clears Gatekeeper quarantine from the patched app bundle', () => {
  const mainSource = readDesktopBackendSource();

  assert.match(
    mainSource,
    /xattr', \['-dr', 'com\.apple\.quarantine', appPath\]/,
    'patched macOS apps should remove the quarantine attribute so Gatekeeper does not block the modified bundle on relaunch'
  );
  assert.match(
    mainSource,
    /sudo xattr -dr com\.apple\.quarantine/,
    'failure guidance should include the exact terminal fallback command for clearing quarantine manually'
  );
});

test('code-signature diagnostics use deep verification for patched app bundles', () => {
  const patchSource = fs.readFileSync(path.join(desktopRoot, 'lib', 'patch.js'), 'utf8');

  assert.match(
    patchSource,
    /codesign', \['--verify', '--deep', '--strict', appPath\]/,
    'signature diagnostics should verify the whole patched bundle tree, not only the top-level app node'
  );
});

test('injector build script can fall back to Qt frameworks when Cavalry app frameworks are unavailable', () => {
  const packageJson = fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8');
  const buildScript = fs.readFileSync(path.join(repoRoot, 'tools', 'build_translator_injector.sh'), 'utf8');
  const resolverPath = path.join(repoRoot, 'tools', 'resolve_cavalry_qt_sdk.js');
  const targetPath = path.join(repoRoot, 'tools', 'cavalry_qt_target.json');
  const target = JSON.parse(fs.readFileSync(targetPath, 'utf8'));
  const resolver = fs.readFileSync(resolverPath, 'utf8');

  assert.match(
    packageJson,
    /"prepare:qt-sdk": "node tools\/resolve_cavalry_qt_sdk\.js --ensure"/,
    'package.json should expose an explicit SDK preparation command for CI and clean machines'
  );
  assert.match(
    JSON.parse(packageJson).scripts['build:injector'] || '',
    /resolve_cavalry_qt_sdk\.js --print-env --ensure.*build_translator_injector\.sh/,
    'default injector builds should resolve the target SDK from the project contract instead of scattering 6.6.3 inline'
  );
  assert.equal(target.qtVersion, '6.6.3');
  assert.equal(target.cavalryVersion, '2.7.1');
  assert.equal(target.sdkPath, 'qt_sdk/6.6.3/macos');
  assert.match(
    resolver,
    /install-qt[\s\S]*target\.aqt\.host[\s\S]*target\.aqt\.target[\s\S]*target\.qtVersion[\s\S]*target\.aqt\.arch/,
    'resolver should be able to download exactly the target Qt SDK for CI'
  );
  assert.match(
    resolver,
    /QtCore\.framework[\s\S]*Resources[\s\S]*Info\.plist/,
    'resolver should probe an installed Cavalry.app when present before selecting the SDK'
  );
  assert.match(
    buildScript,
    /QT_FRAMEWORKS\/QtCore\.framework\/Versions\/A\/QtCore/,
    'injector build should support linking against a standalone Qt install for CI prebuilds'
  );
  assert.match(
    buildScript,
    /QtGui QtWidgets/,
    'injector build should keep the same QtGui/QtWidgets link surface as the historical working injector where available'
  );
  assert.match(
    buildScript,
    /CAVALRY_QT_VERSION|CFBundleVersion/,
    'injector build should verify that the build-time Qt version matches the target Cavalry Qt runtime branch'
  );
  assert.doesNotMatch(
    buildScript,
    /Version check bypassed|Proceeding with building injecting/,
    'injector build should not silently bypass the Qt branch compatibility check'
  );
  assert.match(
    buildScript,
    /major_minor_version "\$BUILD_QT_VERSION".*major_minor_version "\$TARGET_QT_VERSION"[\s\S]*exit 1/,
    'injector build should fail fast when the build-time Qt branch does not match the target Cavalry Qt branch'
  );
});

test('embedded injector source is generated from ts translation files', () => {
  const injectorSource = fs.readFileSync(
    path.join(desktopRoot, 'injector', 'CavalryTranslatorInjector.mm'),
    'utf8'
  );

  assert.match(
    injectorSource,
    /generated_translations\.inc/,
    'injector source should include generated translation tables rather than hand-maintained copies'
  );
  assert.match(
    injectorSource,
    /qVersion|QT_VERSION_STR/,
    'injector should verify the runtime Qt version before installing translations'
  );
});

test('embedded injector normalizes real runtime menu text before lookup', () => {
  const injectorSource = fs.readFileSync(
    path.join(desktopRoot, 'injector', 'CavalryTranslatorInjector.mm'),
    'utf8'
  );
  const generated = fs.readFileSync(
    path.join(desktopRoot, 'injector', 'generated_translations.inc'),
    'utf8'
  );

  assert.match(
    injectorSource,
    /normalizeMenuText/,
    'injector should normalize live menu text before matching embedded translations'
  );
  assert.match(
    injectorSource,
    /QChar::Other_Format|category\(\)\s*==\s*QChar::Other_Format/,
    'normalization should strip zero-width or format characters that appear in the real runtime menu inventory'
  );
  assert.match(
    injectorSource,
    /replace\(QChar\('&'\)/,
    'normalization should ignore Qt mnemonic markers so runtime menu text can match ts source strings'
  );
  assert.match(
    generated,
    /"MenuBarManager", "Set Project", ".*"/,
    'embedded translations should include the real Set Project menu label captured from the runtime inventory'
  );
});

test('active full-ui scripts reject the legacy 99% threshold', () => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
  const scripts = packageJson.scripts || {};
  const runtimeChecker = fs.readFileSync(
    path.join(repoRoot, 'tools', 'check_runtime_ui_coverage.js'),
    'utf8'
  );
  const fullUiChecker = fs.readFileSync(path.join(repoRoot, 'tools', 'check_full_ui_coverage.js'), 'utf8');
  const matrixChecker = fs.readFileSync(path.join(repoRoot, 'tools', 'check_full_ui_matrix.js'), 'utf8');

  assert.match(
    scripts['check:ui-coverage'] || '',
    /tools\/check_runtime_ui_coverage\.js/,
    'package.json should expose a dedicated runtime UI coverage checker instead of relying on ad hoc screenshot inspection'
  );
  assert.match(
    scripts['check:ui-coverage'] || '',
    /--threshold 100/,
    'runtime UI localization should use a hard 100% completion gate, with any retained English terms handled through an explicit allowlist'
  );

  for (const language of ['ja_JP', 'zh-Hans', 'zh-Hant']) {
    assert.match(
      scripts[`check:full-ui:${language}`] || '',
      /--threshold 100/,
      `package.json should gate ${language} against a hard 100% full-ui threshold`
    );
  }

  assert.doesNotMatch(runtimeChecker, /threshold:\s*99/);
  assert.doesNotMatch(fullUiChecker, /threshold:\s*99/);
  assert.doesNotMatch(matrixChecker, /threshold:\s*99/);
});

test('package.json exposes a compiled UI extraction workflow for non-JSON text', () => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
  const scripts = packageJson.scripts || {};

  assert.match(
    scripts['extract:compiled-ui'] || '',
    /tools\/extract_compiled_ui_strings\.js/,
    'package.json should expose a compiled UI extractor script instead of relying only on handwritten menu entries'
  );
  assert.match(
    scripts['extract:compiled-ui'] || '',
    /Library\/Caches\/Cavalry-i18n\/compiled-ui-source-map\.json/,
    'compiled UI extraction should write to a generated cache source map JSON file'
  );
});

test('package.json exposes per-language full UI blocker scripts', () => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
  const scripts = packageJson.scripts || {};

  for (const language of ['ja_JP', 'zh-Hans', 'zh-Hant']) {
    assert.match(
      scripts[`check:full-ui:${language}`] || '',
      /tools\/check_full_ui_coverage\.js/,
      `package.json should expose a full-UI coverage blocker for ${language}`
    );
  }
});

test('package.json exposes a matrix full UI blocker script with a runlog path', () => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
  const scripts = packageJson.scripts || {};

  assert.match(
    scripts['check:full-ui'] || '',
    /tools\/check_full_ui_matrix\.js/,
    'package.json should expose one matrix full-UI blocker script instead of requiring manual per-language command assembly'
  );
  assert.match(
    scripts['check:full-ui'] || '',
    /verify_gate_inputs\.js/,
    'matrix full-UI blocker should run a gate-input preflight before the matrix so known bypass inputs fail fast'
  );
  assert.match(
    scripts['check:full-ui'] || '',
    /full-ui-run-record\.json/,
    'matrix full-UI blocker should write the run record under SESSION_DIR so progress is tied to the live capture session'
  );
});

test('verify gate inputs fails on known bypass artifacts before matrix execution', () => {
  const tempRoot = makeTempDir();
  const preflightPath = path.join(repoRoot, 'tools', 'verify_gate_inputs.js');

  writeJson(path.join(tempRoot, 'package.json'), {
    scripts: {
      'prepare:full-ui-gate': 'node tools/prepare_full_ui_gate_inputs.js',
    },
  });
  fs.mkdirSync(path.join(tempRoot, 'tools', 'full_ui_inventory_fixtures'), { recursive: true });
  fs.mkdirSync(path.join(tempRoot, 'doc'), { recursive: true });
  fs.writeFileSync(path.join(tempRoot, 'doc', 'libExtensionLayer-curated-ui.txt'), 'curated\n');

  const result = spawnSync(process.execPath, [preflightPath, '--repo-root', tempRoot], {
    encoding: 'utf8',
  });

  assert.equal(result.status, 1, 'preflight should fail when known bypass artifacts are present');
  assert.match(`${result.stdout}\n${result.stderr}`, /prepare:full-ui-gate/);
  assert.match(`${result.stdout}\n${result.stderr}`, /full_ui_inventory_fixtures/);
  assert.match(`${result.stdout}\n${result.stderr}`, /libExtensionLayer-curated-ui\.txt/);
});

test('verify gate inputs rejects curated source maps and non-whitelisted live capture sources', () => {
  const tempRoot = makeTempDir();
  const preflightPath = path.join(repoRoot, 'tools', 'verify_gate_inputs.js');
  const cacheRoot = path.join(tempRoot, 'cache');
  const sessionDir = path.join(cacheRoot, 'sessions', 'ABC123');
  const runtimeDir = path.join(sessionDir, 'runtime');
  const sourceMapPath = path.join(cacheRoot, 'compiled-ui-source-map.json');

  writeJson(path.join(tempRoot, 'package.json'), { scripts: {} });
  fs.mkdirSync(runtimeDir, { recursive: true });
  writeJson(path.join(runtimeDir, 'zh-Hans-merged-inventory.json'), {
    capture: {
      pid: 123,
      bundleHash: 'abc',
      sessionUuid: 'ABC123',
      wallclockUtc: '2026-04-29T12:00:00.000Z',
      source: 'live-dump',
    },
  });
  writeJson(sourceMapPath, {
    kind: 'curated',
    entries: [],
  });

  const result = spawnSync(
    process.execPath,
    [
      preflightPath,
      '--repo-root',
      tempRoot,
      '--cache-root',
      cacheRoot,
      '--session-dir',
      sessionDir,
      '--compiled-source-map',
      sourceMapPath,
    ],
    {
      encoding: 'utf8',
    }
  );

  assert.equal(result.status, 1, 'preflight should fail when source-map/runtime provenance is not live');
  assert.match(`${result.stdout}\n${result.stderr}`, /compiled source map kind/i);
  assert.match(`${result.stdout}\n${result.stderr}`, /live-dump/);
});

test('verify gate inputs rejects runtime inventories outside SESSION_DIR/runtime', () => {
  const tempRoot = makeTempDir();
  const preflightPath = path.join(repoRoot, 'tools', 'verify_gate_inputs.js');
  const cacheRoot = path.join(tempRoot, 'cache');
  const sessionDir = path.join(cacheRoot, 'sessions', 'ABC123');

  writeJson(path.join(tempRoot, 'package.json'), { scripts: {} });
  fs.mkdirSync(sessionDir, { recursive: true });
  writeJson(path.join(cacheRoot, 'compiled-ui-source-map.json'), {
    kind: 'generated',
    entries: [],
  });
  writeJson(path.join(sessionDir, 'zh-Hans-merged-inventory.json'), {
    capture: {
      pid: 123,
      bundleHash: 'abc',
      sessionUuid: 'ABC123',
      wallclockUtc: '2026-04-29T12:00:00.000Z',
      source: 'live-merged',
    },
  });

  const result = spawnSync(
    process.execPath,
    [
      preflightPath,
      '--repo-root',
      tempRoot,
      '--cache-root',
      cacheRoot,
      '--session-dir',
      sessionDir,
    ],
    {
      encoding: 'utf8',
    }
  );

  assert.equal(result.status, 1, 'preflight should fail when runtime inventory escapes SESSION_DIR/runtime');
  assert.match(`${result.stdout}\n${result.stderr}`, /SESSION_DIR\/runtime|runtime artifact outside/i);
});

test('compiled UI source map is generated in the local cache, not tracked under doc', () => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
  const scripts = packageJson.scripts || {};

  assert.equal(
    fs.existsSync(path.join(repoRoot, 'doc', 'compiled-ui-source-map.json')),
    false,
    'compiled UI source map should be regenerated from the local Cavalry.app instead of tracked under doc/'
  );
  assert.match(
    scripts['extract:compiled-ui'] || '',
    /--app \/Applications\/Cavalry\.app/,
    'compiled UI extraction should bind to the local Cavalry.app owner binary'
  );
  assert.match(
    scripts['extract:compiled-ui'] || '',
    /\$HOME\/Library\/Caches\/Cavalry-i18n\/compiled-ui-source-map\.json/,
    'compiled UI extraction should write the generated source map to the local cache'
  );
});

test('compiled UI extractor inventories strings from Cavalry binaries and frameworks', () => {
  const extractorSource = fs.readFileSync(
    path.join(repoRoot, 'tools', 'extract_compiled_ui_strings.js'),
    'utf8'
  );

  assert.match(
    extractorSource,
    /spawnSync/,
    'compiled UI extractor should invoke platform tools to inventory bundled binary strings'
  );
  assert.match(
    extractorSource,
    /\/usr\/bin\/strings|strings'/,
    'compiled UI extractor should use the macOS strings tool to inspect compiled UI binaries'
  );
  assert.match(
    extractorSource,
    /Contents', 'MacOS', 'Cavalry'|Contents\/MacOS\/Cavalry/,
    'compiled UI extractor should inspect the main Cavalry executable'
  );
  assert.match(
    extractorSource,
    /libCavalryUI\.dylib/,
    'compiled UI extractor should inspect the Cavalry UI framework where menu/action text likely lives'
  );
  assert.match(
    extractorSource,
    /libExtensionLayer\.dylib/,
    'compiled UI extractor should include libExtensionLayer.dylib so Extension Layer UI strings enter the owner map'
  );
  assert.match(
    extractorSource,
    /Could not find compiled UI targets/,
    'compiled UI extractor should fail loudly instead of emitting an empty source map when the target binaries are missing'
  );
  assert.match(
    extractorSource,
    /JSON\.stringify|writeFileSync/,
    'compiled UI extractor should emit a deterministic JSON inventory that can become the repo source of truth'
  );
});

test('full UI coverage checker composes runtime, compiled, and JSON-backed validation', () => {
  const checkerSource = fs.readFileSync(
    path.join(repoRoot, 'tools', 'check_full_ui_coverage.js'),
    'utf8'
  );

  assert.match(
    checkerSource,
    /check_runtime_ui_coverage|buildCoverage/,
    'full UI checker should reuse the runtime UI coverage logic instead of inventing a second incompatible runtime gate'
  );
  assert.match(
    checkerSource,
    /compiled-ui-source-map|compiledSourceMap|buildCompiledCoverage/,
    'full UI checker should include compiled UI inventory coverage instead of only the currently visible runtime surface'
  );
  assert.match(
    checkerSource,
    /validate_translations\.py|python3/,
    'full UI checker should incorporate the existing JSON translation validator so JSON-backed surfaces stay inside the blocker'
  );
  assert.match(
    checkerSource,
    /ja_JP|zh-Hans|zh-Hant/,
    'full UI checker should support all three target languages under the same workflow'
  );
});

test('runtime UI coverage can lock its denominator to frozen extraction candidates', () => {
  const checkerPath = path.join(repoRoot, 'tools', 'check_runtime_ui_coverage.js');
  const { buildCoverage } = require(checkerPath);

  // Create a Map of English to Japanese translations
  const translations = new Map([
    ['Edit', '編集'],  // Edit in Japanese
  ]);

  const report = buildCoverage(
    {
      language: 'ja_JP',
      menuBars: [
        {
          items: [
            { text: '編集', separator: false },
            { text: 'Scene Window', separator: false },
          ],
        },
      ],
      widgetTexts: [],
    },
    { exact: [], contains: [] },
    translations,  // Pass translations as third parameter
    {
      englishLeaves: [{ value: 'File' }, { value: 'Edit' }, { value: 'Scene Window' }],
    }  // Pass extraction surface as fourth parameter
  );

  assert.equal(
    report.totalCandidates,
    3,
    'runtime coverage should use the frozen extraction candidate count instead of shrinking the denominator to the current translated inventory'
  );
  assert.equal(report.denominatorSource, 'extraction-inventory');
  assert.equal(report.untranslatedCount, 2);  // File and Scene Window are untranslated
  assert.equal(report.coveragePct, 33.33);  // Only Edit is translated (1/3 = 33.33%)
});

test('compiled coverage can lock its denominator to frozen extraction entries', () => {
  const checkerPath = path.join(repoRoot, 'tools', 'check_full_ui_coverage.js');
  const { buildCompiledCoverage } = require(checkerPath);

  const report = buildCompiledCoverage(
    {
      entries: [{ normalizedText: 'Scene Window', surfaceHint: 'menu-or-action-like' }],
    },
    new Map([['Scene Window', 'シーンウィンドウ']]),
    { exact: [], contains: [] },
    {
      englishLeaves: [
        { value: 'Scene Window', surfaceHint: 'menu-or-action-like' },
        { value: 'Render Queue', surfaceHint: 'menu-or-action-like' },
      ],
    }
  );

  assert.equal(
    report.totalCandidates,
    2,
    'compiled coverage should use the frozen extraction entry set instead of shrinking the denominator to the current source-map subset'
  );
  assert.equal(report.denominatorSource, 'extraction-inventory');
  assert.deepEqual(report.untranslated, ['Render Queue']);
  assert.equal(report.coveragePct, 50);
});

test('compiled coverage reuses punctuation-normalized TS translations for aliased source-map entries', () => {
  const checkerPath = path.join(repoRoot, 'tools', 'check_full_ui_coverage.js');
  const { buildCompiledCoverage } = require(checkerPath);

  const report = buildCompiledCoverage(
    {
      entries: [
        { normalizedText: 'Action not allowed. Adding composition would create a cycle.', surfaceHint: 'sentence-like' },
      ],
    },
    new Map([['Action not allowed. Adding composition would create a cycle', '不允许此操作。添加该合成会形成循环。']]),
    { exact: [], contains: [] },
    {
      englishLeaves: [
        {
          value: 'Action not allowed. Adding composition would create a cycle.',
          surfaceHint: 'sentence-like',
        },
      ],
    }
  );

  assert.equal(
    report.untranslatedCount,
    0,
    'compiled coverage should honor punctuation-normalized aliases instead of requiring duplicate TS entries for every dotted variant'
  );
  assert.equal(report.coveragePct, 100);
});

test('compiled coverage filter rejects debug labels, copyright strings, glyph names, and shaping-engine internals', () => {
  const checkerPath = path.join(repoRoot, 'tools', 'check_full_ui_coverage.js');
  const { shouldCountCompiledCandidate } = require(checkerPath);
  const allowlist = { exact: [], contains: [] };

  assert.equal(shouldCountCompiledCandidate('0: Root', 'label-like', allowlist), false);
  assert.equal(shouldCountCompiledCandidate('2026 Scene Group Ltd', 'label-like', allowlist), false);
  assert.equal(shouldCountCompiledCandidate('2026 Scene Group Ltd.', 'label-like', allowlist), false);
  assert.equal(shouldCountCompiledCandidate('Aacute', 'menu-or-action-like', allowlist), false);
  assert.equal(shouldCountCompiledCandidate('Acircumflexsmall', 'menu-or-action-like', allowlist), false);
  assert.equal(shouldCountCompiledCandidate('Above-base Forms', 'label-like', allowlist), false);
  assert.equal(shouldCountCompiledCandidate('Above-base Mark Positioning', 'label-like', allowlist), false);
  assert.equal(shouldCountCompiledCandidate('Above-base Substitutions', 'label-like', allowlist), false);
  assert.equal(shouldCountCompiledCandidate('About Cavalry', 'menu-or-action-like', allowlist), true);
  assert.equal(shouldCountCompiledCandidate('Access All Alternates', 'label-like', allowlist), true);
});

test('JSON validator can read frozen extraction leaves and still return structured blocker data on failure', () => {
  const checkerPath = path.join(repoRoot, 'tools', 'check_full_ui_coverage.js');
  const { runJsonValidator } = require(checkerPath);
  const { tempRoot, extractionPath } = makeValidatorFixtureRepo();
  const zhHansAppPath = path.join(tempRoot, 'languages', 'zh-Hans', 'appStrings.json');
  const zhHansApp = readJson(zhHansAppPath);
  zhHansApp.push({ value: { label: '冻结后新增的目标叶' } });
  writeJson(zhHansAppPath, zhHansApp);

  const report = runJsonValidator(tempRoot, 'zh-Hans', extractionPath);

  assert.equal(
    report.structureIssueCount,
    0,
    'validator should trust the frozen extraction leaf set instead of failing on new English leaves that were added after freeze'
  );
  assert.equal(
    report.coveragePct,
    100,
    'validator should measure translated-leaf coverage against the frozen extraction source values'
  );
  assert.equal(report.englishResidueCount, 1);
  assert.equal(
    report.pass,
    false,
    'validator should still return a structured failing report when the language contains blockers'
  );
});

test('JSON validator falls back to live English plugin files when extraction only freezes core JSON surfaces', () => {
  const checkerPath = path.join(repoRoot, 'tools', 'check_full_ui_coverage.js');
  const { runJsonValidator } = require(checkerPath);
  const { tempRoot, extractionPath } = makeValidatorFixtureRepo();

  writeJson(path.join(tempRoot, 'languages', 'en', 'plugins', 'testPlugin.json'), {
    label: 'English Plugin Label',
  });
  writeJson(path.join(tempRoot, 'languages', 'zh-Hans', 'plugins', 'testPlugin.json'), {
    label: '中文插件标签',
  });
  writeJson(path.join(tempRoot, 'languages', 'zh-Hant', 'plugins', 'testPlugin.json'), {
    label: '中文外掛標籤',
  });
  writeJson(path.join(tempRoot, 'languages', 'ja_JP', 'plugins', 'testPlugin.json'), {
    label: 'プラグインラベル',
  });

  const report = runJsonValidator(tempRoot, 'zh-Hant', extractionPath);

  assert.equal(
    report.structureIssueCount,
    0,
    'plugin validation should keep using the live English source files instead of crashing on missing plugin surfaces in extraction'
  );
  assert.equal(report.pass, true);
});

test('JSON validator allows exact-English translate leaves when they are pure allowlisted technical tokens', () => {
  const checkerPath = path.join(repoRoot, 'tools', 'check_full_ui_coverage.js');
  const { runJsonValidator } = require(checkerPath);
  const { tempRoot, extractionPath } = makeValidatorFixtureRepo();

  const extraction = readJson(extractionPath);
  extraction.surfaces['languages/en/appStrings.json'].englishLeaves[0].value = 'CPU';
  writeJson(extractionPath, extraction);
  writeJson(path.join(tempRoot, 'languages', 'zh-Hant', 'appStrings.json'), [{ value: { label: 'CPU' } }]);

  const report = runJsonValidator(tempRoot, 'zh-Hant', extractionPath);

  assert.equal(report.coveragePct, 100);
  assert.equal(
    report.pass,
    true,
    'G1 should not fail when a translate leaf remains exactly equal to the frozen English source if that value is a pure allowlisted technical token'
  );
});

test('JSON validator allows exact translate leaves when they are numeric or empty technical values', () => {
  const checkerPath = path.join(repoRoot, 'tools', 'check_full_ui_coverage.js');
  const { runJsonValidator } = require(checkerPath);
  const { tempRoot, extractionPath } = makeValidatorFixtureRepo();

  const extraction = readJson(extractionPath);
  extraction.surfaces['languages/en/appStrings.json'].englishLeaves[0].value = '3:1';
  writeJson(extractionPath, extraction);
  writeJson(path.join(tempRoot, 'languages', 'zh-Hant', 'appStrings.json'), [{ value: { label: '3:1' } }]);

  const report = runJsonValidator(tempRoot, 'zh-Hant', extractionPath);

  assert.equal(report.coveragePct, 100);
  assert.equal(
    report.pass,
    true,
    'G1 should not fail when a translate leaf remains exactly equal to the frozen English source if that value is purely numeric or symbolic'
  );
});

test('JSON validator hard-fails when frozen translate leaves stay equal to untranslated English copy', () => {
  const checkerPath = path.join(repoRoot, 'tools', 'check_full_ui_coverage.js');
  const { runJsonValidator } = require(checkerPath);
  const { tempRoot, extractionPath } = makeValidatorFixtureRepo();

  const extraction = readJson(extractionPath);
  extraction.surfaces['languages/en/appStrings.json'].englishLeaves[0].value = 'English Label';
  writeJson(extractionPath, extraction);
  writeJson(path.join(tempRoot, 'languages', 'zh-Hant', 'appStrings.json'), [{ value: { label: 'English Label' } }]);

  const report = runJsonValidator(tempRoot, 'zh-Hant', extractionPath);

  assert.equal(report.coveragePct, 75);
  assert.equal(
    report.pass,
    false,
    'G1 should still fail when a translate leaf remains exactly equal to natural-language English source text'
  );
});

test('translation validator rejects the legacy 0.90 coverage threshold', () => {
  const validatorSource = fs.readFileSync(
    path.join(repoRoot, 'tools', 'validate_translations.py'),
    'utf8'
  );

  assert.doesNotMatch(
    validatorSource,
    /0\.90/,
    'translation validator should not retain the legacy 0.90 weak-threshold gate'
  );
  assert.match(
    validatorSource,
    /1\.00/,
    'translation validator should record a strict 1.00 coverage threshold'
  );
});

test('full UI matrix checker runs all languages and writes a structured runlog', () => {
  const checkerSource = fs.readFileSync(
    path.join(repoRoot, 'tools', 'check_full_ui_matrix.js'),
    'utf8'
  );

  assert.match(
    checkerSource,
    /ja_JP[\s\S]*zh-Hans[\s\S]*zh-Hant|zh-Hans[\s\S]*zh-Hant[\s\S]*ja_JP/,
    'matrix full-UI checker should run all three target languages in one pass'
  );
  assert.match(
    checkerSource,
    /full-ui-runlog\.json|runlog/,
    'matrix full-UI checker should persist a runlog so the latest blocker state is not lost between iterations'
  );
  assert.match(
    checkerSource,
    /startedAt|finishedAt/,
    'matrix full-UI checker should timestamp the runlog'
  );
  assert.match(
    checkerSource,
    /runtime[\s\S]*compiled[\s\S]*jsonValidation|jsonValidation[\s\S]*runtime[\s\S]*compiled/,
    'matrix full-UI checker runlog should retain the runtime, compiled, and JSON blocker details for each language'
  );
  assert.match(
    checkerSource,
    /forbiddenPatterns/,
    'matrix full-UI checker run record should preserve per-language forbidden-pattern summaries'
  );
  assert.match(
    checkerSource,
    /provenance/,
    'matrix full-UI checker run record should preserve per-language provenance details'
  );
  assert.match(
    checkerSource,
    /sessionUuid/,
    'matrix full-UI checker run record should bind the current session UUID'
  );
  assert.match(
    checkerSource,
    /runtimeDir/,
    'matrix full-UI checker run record should record the current runtime directory'
  );
  assert.match(
    checkerSource,
    /--session-dir|sessionDir/,
    'matrix full-UI checker should require an explicit session dir instead of discovering runtime inputs from cache root'
  );
  assert.match(
    checkerSource,
    /runtime[\s\S]*-merged-inventory\.json|-merged-inventory\.json[\s\S]*runtime/,
    'matrix full-UI checker should read merged runtime artifacts from SESSION_DIR/runtime'
  );
  assert.match(
    checkerSource,
    /sourceMap[\s\S]*hash|hash[\s\S]*sourceMap/,
    'matrix full-UI checker run record should preserve source-map hash provenance'
  );
  assert.match(
    checkerSource,
    /sourceMap[\s\S]*mtime|mtime[\s\S]*sourceMap/,
    'matrix full-UI checker run record should preserve source-map mtime provenance'
  );
  assert.match(
    checkerSource,
    /extractionInventory/,
    'matrix full-UI checker run record should preserve frozen extraction inventory provenance'
  );
  assert.match(
    checkerSource,
    /frozenBaselines/,
    'matrix full-UI checker run record should preserve the whitelist and allowlist provenance used for the gate run'
  );
  assert.match(
    checkerSource,
    /blockedReason/,
    'matrix full-UI checker should keep a structured blocked reason in the run record when a language run crashes or produces no report'
  );
  assert.doesNotMatch(
    checkerSource,
    /inventoryPath\s*=\s*path\.join\(CACHE_ROOT,/,
    'matrix full-UI checker should not hardcode root-cache runtime inventory discovery'
  );
  assert.match(
    checkerSource,
    /process\.exitCode\s*=\s*1|process\.exit\(1\)/,
    'matrix full-UI checker should fail the run when any language stays below the hard gate'
  );
});

test('compiled UI extractor filters obvious binary noise while keeping UI labels', () => {
  const extractorPath = path.join(repoRoot, 'tools', 'extract_compiled_ui_strings.js');
  const { extractEntriesFromLines } = require(extractorPath);

  assert.equal(
    typeof extractEntriesFromLines,
    'function',
    'compiled UI extractor should expose a reusable line-filtering helper so tests can lock the noise filter down'
  );

  const entries = extractEntriesFromLines('/tmp/Cavalry', [
    'Group',
    'Window',
    'Open Scene...',
    '_16VisualDesignDark',
    '--cpp-httplib-multipart-data-',
    '", nonce="',
    '; border-radius: 4px;}QPushButton:disabled { border-color:',
    '#NSt3__120__shared_ptr_emplaceIN6spdlog5sinks21ansicolor_stdout_sinkINS1_7details13console_mutexEEENS_9allocatorIS6_EEEE',
  ]);

  assert.deepEqual(
    entries.map((entry) => entry.text),
    ['Group', 'Window', 'Open Scene...'],
    'compiled UI extractor should keep reviewable UI copy and drop obvious binary junk before the full-UI blocker consumes the inventory'
  );
});

test('compiled UI extractor rejects HTTP and exception strings that are not UI copy', () => {
  const extractorPath = path.join(repoRoot, 'tools', 'extract_compiled_ui_strings.js');
  const { extractEntriesFromLines } = require(extractorPath);

  const entries = extractEntriesFromLines('/tmp/Cavalry', [
    'Accept',
    'Accepted',
    'Bad Gateway',
    'Content-Type',
    'Auth has no pending auth flow',
    'Close Others',
    'Delete Script Tab?',
  ]);

  assert.deepEqual(
    entries.map((entry) => entry.text),
    ['Close Others', 'Delete Script Tab?'],
    'compiled UI extractor should reject protocol and exception text so the hard gate only blocks real UI strings'
  );
});

test('compiled UI extractor rejects HTTP status labels and debug errors that are not product UI', () => {
  const extractorPath = path.join(repoRoot, 'tools', 'extract_compiled_ui_strings.js');
  const { extractEntriesFromLines } = require(extractorPath);

  const entries = extractEntriesFromLines('/tmp/Cavalry', [
    'Already Reported',
    'Forbidden',
    'Gateway Timeout',
    "I'm a teapot",
    'Internal Server Error',
    'Keep-Alive',
    'Concurrent task failed with unknown exception',
    'cannot create object from initializer list',
    'Install Plugin?',
    'Close Others',
  ]);

  assert.deepEqual(
    entries.map((entry) => entry.text),
    ['Install Plugin?', 'Close Others'],
    'compiled UI extractor should drop HTTP status labels and debug-only failure strings before they reach the full-UI blocker'
  );
});

test('compiled UI extractor emits punctuation-normalized label aliases for raw UI strings', () => {
  const extractorPath = path.join(repoRoot, 'tools', 'extract_compiled_ui_strings.js');
  const { extractEntriesFromLines } = require(extractorPath);

  const entries = extractEntriesFromLines('/tmp/Cavalry', ['No Project Set.', 'No Project Set...']);
  const texts = entries.map((entry) => entry.text);

  assert.ok(texts.includes('No Project Set.'), 'extractor should keep the raw compiled string');
  assert.ok(texts.includes('No Project Set...'), 'extractor should keep ellipsis variants from raw extraction');
  assert.ok(
    texts.includes('No Project Set'),
    'extractor should also emit the punctuation-normalized label form for downstream denominator checks'
  );
});

test('embedded injector exports the real runtime menu tree from Cavalry itself', () => {
  const injectorSource = fs.readFileSync(
    path.join(desktopRoot, 'injector', 'CavalryTranslatorInjector.mm'),
    'utf8'
  );

  assert.match(
    injectorSource,
    /NSJSONSerialization|writeToFile/,
    'injector should serialize the real runtime menu tree to JSON instead of relying only on handwritten menu entries'
  );
  assert.match(
    injectorSource,
    /Library\/Caches\/Cavalry-i18n|menu-inventory\.json/,
    'injector should write the runtime menu inventory to a stable cache path that can be inspected after launch'
  );
  assert.match(
    injectorSource,
    /dumpQtMenuInventory|serializeQtMenu|serializeQtAction/,
    'injector should walk the Qt-owned menu model and export its exact runtime structure'
  );
  assert.match(
    injectorSource,
    /failed to serialize runtime menu inventory|failed to write runtime menu inventory|menu inventory export deferred/,
    'injector should log why runtime menu inventory export failed so real-app verification does not stall on silent errors'
  );
  assert.match(
    injectorSource,
    /windowTitle|placeholderText|toolTip|widgetTexts|serializeWidget/,
    'runtime inventory should cover broader visible UI text beyond menus so completion can be measured across the real app surface'
  );
});

test('injector supports English dump-only and session-scoped runtime inventory output', () => {
  const injectorSource = fs.readFileSync(
    path.join(desktopRoot, 'injector', 'CavalryTranslatorInjector.mm'),
    'utf8'
  );

  assert.match(
    injectorSource,
    /CAVALRY_I18N_LANG/,
    'injector should continue to read the target language from the environment'
  );
  assert.match(
    injectorSource,
    /lang\s*==\s*QStringLiteral\("en"\)|dump-only|english/i,
    'injector should special-case English dump-only capture instead of rejecting en as an unsupported language'
  );
  assert.match(
    injectorSource,
    /sessionUuid|bundleHash|wallclockUtc|source/,
    'injector runtime inventory should write full provenance metadata for G-CAPTURE and G-P'
  );
  assert.match(
    injectorSource,
    /runtime\/.*-injector-inventory\.json|-injector-inventory\.json/,
    'injector should write session-scoped injector inventories instead of cache-root menu-inventory.json'
  );
});

test('launcher passes session-scoped capture environment into the injector process', () => {
  const launcherSource = fs.readFileSync(path.join(repoRoot, 'tools', 'launch_cavalry_with_injector.sh'), 'utf8');

  assert.match(
    launcherSource,
    /--session-dir|SESSION_DIR|CAVALRY_I18N_SESSION_DIR/,
    'launcher should accept and forward the session dir for runtime capture artifacts'
  );
  assert.match(
    launcherSource,
    /--session-uuid|SESSION_UUID|CAVALRY_I18N_SESSION_UUID/,
    'launcher should accept and forward the session UUID for provenance'
  );
  assert.match(
    launcherSource,
    /--cache-root|CACHE_ROOT|CAVALRY_I18N_CACHE_ROOT/,
    'launcher should accept and forward the cache root for shared toolchain inputs'
  );
});

test('runtime merge tool preserves live provenance and rejects non-live inputs', () => {
  const mergePath = path.join(repoRoot, 'tools', 'merge_runtime_inventory.js');
  const { mergeRuntimeInventories } = require(mergePath);

  const merged = mergeRuntimeInventories({
    language: 'zh-Hans',
    injectorInventory: {
      language: 'zh-Hans',
      capture: {
        pid: 101,
        bundleHash: 'bundle-hash',
        sessionUuid: 'ABC123',
        wallclockUtc: '2026-04-29T12:00:00.000Z',
        source: 'live-injector',
      },
      menuBars: [{ items: [{ text: 'File' }] }],
      widgetTexts: [],
    },
    accessibilityInventory: {
      language: 'zh-Hans',
      capture: {
        pid: 101,
        bundleHash: 'bundle-hash',
        sessionUuid: 'ABC123',
        wallclockUtc: '2026-04-29T12:00:01.000Z',
        source: 'live-accessibility',
      },
      menuBars: [],
      widgetTexts: [{ className: 'AXWindow', strings: { windowTitle: 'Library' } }],
    },
  });

  assert.equal(merged.capture.source, 'live-merged');
  assert.equal(merged.capture.sessionUuid, 'ABC123');
  assert.equal(merged.capture.bundleHash, 'bundle-hash');
  assert.equal(merged.menuBars.length, 1);
  assert.equal(merged.widgetTexts.length, 1);
  assert.throws(
    () =>
      mergeRuntimeInventories({
        language: 'zh-Hans',
        injectorInventory: {
          language: 'zh-Hans',
          capture: { source: 'repo-fixture' },
          menuBars: [],
          widgetTexts: [],
        },
        accessibilityInventory: {
          language: 'zh-Hans',
          capture: { source: 'live-accessibility' },
          menuBars: [],
          widgetTexts: [],
        },
      }),
    /live-injector|live-accessibility/,
    'merge tool should reject fixture or curated runtime inputs'
  );
});

test('live full UI matrix orchestrator owns session runtime and audit artifacts', () => {
  const orchestratorSource = fs.readFileSync(
    path.join(repoRoot, 'tools', 'run_live_full_ui_matrix.js'),
    'utf8'
  );

  assert.match(
    orchestratorSource,
    /full-ui-run-record\.json/,
    'live matrix orchestrator should own the session run record'
  );
  assert.match(
    orchestratorSource,
    /runtime\/.*-injector-inventory\.json|runtime\/.*-ax-inventory\.json|runtime\/.*-merged-inventory\.json/,
    'live matrix orchestrator should write injector, accessibility, and merged runtime artifacts under SESSION_DIR/runtime'
  );
  assert.match(
    orchestratorSource,
    /audit\/.*-injector-capture\.json|audit\/.*-ax-capture\.json|audit\/.*-merge\.json/,
    'live matrix orchestrator should write capture audit artifacts under SESSION_DIR/audit'
  );
  assert.match(
    orchestratorSource,
    /launch_cavalry_with_injector|capture_accessibility_inventory|merge_runtime_inventory/,
    'live matrix orchestrator should explicitly chain launcher, AX capture, and merge steps'
  );
});

test('live full UI matrix orchestrator parses launcher PID and rejects missing PID output', () => {
  const { assertRuntimeCaptureStrength, parseLaunchPid } = require(
    path.join(repoRoot, 'tools', 'run_live_full_ui_matrix.js')
  );

  assert.equal(
    parseLaunchPid('Launching /Applications/Cavalry.app with embedded translator for ja_JP\nPID=12345\n'),
    12345
  );
  assert.throws(
    () => parseLaunchPid('Launching /Applications/Cavalry.app with embedded translator for ja_JP\n'),
    /launcher PID/,
    'orchestrator must not continue into AX capture with pid NaN/0'
  );
  assert.throws(
    () => assertRuntimeCaptureStrength({ language: 'en', totalCandidates: 0, menuLeaves: 0 }),
    /WEAK-CAPTURE/,
    'orchestrator must reject live artifacts that miss runtime lower bounds'
  );
});

test('measurement integrity workflow advertises BLOCKED-NO-LIVE-CAVALRY and packages with build:tauri', () => {
  const workflowSource = fs.readFileSync(path.join(repoRoot, '.github', 'workflows', 'build.yml'), 'utf8');

  assert.match(
    workflowSource,
    /BLOCKED-NO-LIVE-CAVALRY/,
    'CI workflow should emit BLOCKED-NO-LIVE-CAVALRY when no live Cavalry session can run full-ui gates'
  );
  assert.match(
    workflowSource,
    /run: npm run build:tauri/,
    'macOS packaging workflow should use npm run build:tauri'
  );
  assert.doesNotMatch(
    workflowSource,
    /run: npm run build$|doc\/compiled-ui-source-map\.json|doc\/translation-whitelist\.json/,
    'workflow should not keep the legacy build command or doc-scoped gate artifacts'
  );
});

test('check:full-ui binds SESSION_DIR and frozen compiled source map explicitly', () => {
  const packageJson = readJson(path.join(repoRoot, 'package.json'));
  const script = packageJson.scripts['check:full-ui'] || '';

  assert.match(script, /SESSION_DIR|session-dir/, 'check:full-ui should bind the current SESSION_DIR explicitly');
  assert.match(
    script,
    /compiled-ui-source-map\.json/,
    'check:full-ui should bind the authoritative compiled source map explicitly'
  );
  assert.match(
    script,
    /--cache-root/,
    'check:full-ui should make root-cache pollution checks part of the default preflight path'
  );
  assert.doesNotMatch(script, /full-ui-runlog\.json/, 'check:full-ui should stop writing runlogs outside SESSION_DIR');
});

test('package full-ui scripts do not read root-cache runtime inventories', () => {
  const packageJson = readJson(path.join(repoRoot, 'package.json'));
  const scripts = packageJson.scripts || {};
  const runtimeScripts = [
    'check:ui-coverage',
    'check:full-ui:ja_JP',
    'check:full-ui:zh-Hans',
    'check:full-ui:zh-Hant',
    'check:full-ui',
  ];

  for (const name of runtimeScripts) {
    const script = scripts[name] || '';
    assert.doesNotMatch(
      script,
      /Cavalry-i18n\/(?:menu|ja_JP|zh-Hans|zh-Hant)-inventory\.json/,
      `${name} must not read root-cache runtime inventory artifacts`
    );
  }
});

test('accessibility capture uses menu scripting that can see real submenu items', () => {
  const captureSource = fs.readFileSync(
    path.join(repoRoot, 'tools', 'capture_accessibility_inventory.js'),
    'utf8'
  );

  assert.match(
    captureSource,
    /menu 1 of menu bar item|tell application \"System Events\"|menu bar item \"/,
    'AX capture should use a submenu traversal strategy that can see real menu items, not only top-level menu bar labels'
  );
});

test('accessibility capture activates and opens menus before enumerating submenu items', () => {
  const captureSource = fs.readFileSync(
    path.join(repoRoot, 'tools', 'capture_accessibility_inventory.js'),
    'utf8'
  );

  assert.match(
    captureSource,
    /click menu bar item|perform action \"AXPress\"/,
    'AX capture should explicitly open a menu before reading its submenu contents'
  );
  assert.match(
    captureSource,
    /activate|frontmost/,
    'AX capture should bring the target app to the foreground before walking the menu tree'
  );
});

test('accessibility capture returns submenu paths from recursive AppleScript traversal', () => {
  const captureSource = fs.readFileSync(
    path.join(repoRoot, 'tools', 'capture_accessibility_inventory.js'),
    'utf8'
  );

  assert.match(
    captureSource,
    /return nestedLines|set outputLines to outputLines & my collectMenuItems/,
    'AX capture should return submenu path lines from recursive handlers instead of relying on pass-by-value list mutation'
  );
});

test('accessibility capture runs recursive submenu enumeration inside System Events context', () => {
  const captureSource = fs.readFileSync(
    path.join(repoRoot, 'tools', 'capture_accessibility_inventory.js'),
    'utf8'
  );

  assert.match(
    captureSource,
    /on collectMenuItems[\s\S]*tell application \"System Events\"/,
    'AX capture should keep recursive menu enumeration inside System Events so submenu references stay live'
  );
});

test('freeze extraction inventory writes frozen denominator surfaces and run-record provenance', () => {
  const tempRoot = makeTempDir();
  const sessionDir = path.join(tempRoot, 'session');
  const runtimeDir = path.join(sessionDir, 'runtime');
  const runRecordPath = path.join(sessionDir, 'full-ui-run-record.json');
  const extractionPath = path.join(sessionDir, 'extraction-inventory.json');
  const sourceMapPath = path.join(tempRoot, 'compiled-ui-source-map.json');
  const freezePath = path.join(repoRoot, 'tools', 'freeze_extraction_inventory.js');

  writeJson(path.join(tempRoot, 'package.json'), { version: '0.1.2' });
  writeJson(path.join(tempRoot, 'tools', 'translation-whitelist.json'), {
    nodeStrings: { translate: ['title', 'description'], no_translate: [], locale_sync: [] },
    appStrings: { translate: ['title', 'cta'], no_translate: [], locale_sync: [] },
    tips: { translate: ['title'], no_translate: [], locale_sync: [] },
    onboarding: { translate: ['title'], no_translate: [], locale_sync: [] },
  });
  writeJson(path.join(tempRoot, 'tools', 'runtime_ui_allowlist.json'), {
    exact: [],
    contains: [],
  });
  writeJson(path.join(tempRoot, 'languages', 'en', 'nodeStrings.json'), {
    title: 'Node Title',
    description: 'Node Description',
  });
  writeJson(path.join(tempRoot, 'languages', 'en', 'appStrings.json'), {
    title: 'App Title',
    cta: 'Open Scene',
  });
  writeJson(path.join(tempRoot, 'languages', 'en', 'tips.json'), { title: 'Tip Title' });
  writeJson(path.join(tempRoot, 'languages', 'en', 'onboarding.json'), { title: 'Welcome' });
  writeJson(sourceMapPath, {
    entries: [
      { text: 'Scene Window', normalizedText: 'Scene Window', surfaceHint: 'menu-or-action-like' },
      { text: 'Render Queue', normalizedText: 'Render Queue', surfaceHint: 'menu-or-action-like' },
    ],
  });
  writeJson(path.join(runtimeDir, 'en-merged-inventory.json'), {
    formatVersion: 3,
    language: 'en',
    capture: {
      pid: 123,
      bundleHash: 'bundle-hash',
      sessionUuid: path.basename(sessionDir),
      wallclockUtc: '2026-04-29T00:00:00.000Z',
      source: 'live-merged',
    },
    menuBars: [
      {
        items: [
          { text: 'File', submenu: { title: 'File', items: [{ text: 'Open...' }, { text: 'Render Queue' }] } },
        ],
      },
    ],
    widgetTexts: [{ className: 'AXWindow', strings: { windowTitle: 'Scene Window' } }],
  });
  writeJson(runRecordPath, {
    sessionUuid: path.basename(sessionDir),
    sessionDir,
  });

  const result = spawnSync(
    process.execPath,
    [freezePath, '--repo-root', tempRoot, '--session-dir', sessionDir, '--compiled-source-map', sourceMapPath],
    { encoding: 'utf8' }
  );

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const extraction = readJson(extractionPath);
  assert.deepEqual(
    Object.keys(extraction.surfaces).sort(),
    [
      'compiled-source-map',
      'json-total',
      'languages/en/appStrings.json',
      'languages/en/nodeStrings.json',
      'languages/en/onboarding.json',
      'languages/en/tips.json',
      'runtime-candidates',
      'runtime-menuLeaves',
    ].sort()
  );
  assert.equal(extraction.surfaces['languages/en/nodeStrings.json'].count, 2);
  assert.equal(extraction.surfaces['json-total'].count, 6);
  assert.equal(extraction.surfaces['compiled-source-map'].count, 2);
  assert.equal(extraction.surfaces['runtime-candidates'].count, 4);
  assert.equal(extraction.surfaces['runtime-menuLeaves'].count, 4);
  assert.ok(Array.isArray(extraction.englishLeaves['compiled-source-map']));
  assert.equal(extraction.englishLeaves['compiled-source-map'].length, 2);
  assert.equal(extraction.hash, sha256JsonWithoutHash(extraction));

  const runRecord = readJson(runRecordPath);
  assert.equal(runRecord.extractionInventory.path, extractionPath);
  assert.equal(runRecord.extractionInventory.hash, extraction.hash);
  assert.ok(runRecord.extractionInventory.mtime);
});

test('verify gate inputs accepts extraction inventory runtime candidates and menuLeaves bounds', () => {
  const tempRoot = makeTempDir();
  const sessionDir = path.join(tempRoot, 'session');
  const sourceMapPath = path.join(tempRoot, 'compiled-ui-source-map.json');
  const extractionPath = path.join(sessionDir, 'extraction-inventory.json');
  const verifierPath = path.join(repoRoot, 'tools', 'verify_gate_inputs.js');

  fs.mkdirSync(sessionDir, { recursive: true });
  writeJson(path.join(tempRoot, 'package.json'), { scripts: {} });
  writeJson(sourceMapPath, {
    entries: new Array(5195).fill({ normalizedText: 'Scene Window' }),
  });
  writeJson(extractionPath, {
    surfaces: {
      'languages/en/appStrings.json': { count: 10 },
      'languages/en/nodeStrings.json': { count: 6197 },
      'languages/en/onboarding.json': { count: 34 },
      'languages/en/tips.json': { count: 51 },
      'json-total': { count: 6292 },
      'compiled-source-map': { count: 3190 },
      'runtime-candidates': { count: 619 },
      'runtime-menuLeaves': { count: 733 },
    },
  });

  const result = spawnSync(
    process.execPath,
    [
      verifierPath,
      '--repo-root',
      tempRoot,
      '--session-dir',
      sessionDir,
      '--compiled-source-map',
      sourceMapPath,
      '--extraction-inventory',
      extractionPath,
    ],
    { encoding: 'utf8' }
  );

  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test('runtime UI coverage tool enforces thresholded untranslated-string reporting', () => {
  const tempRoot = makeTempDir();
  const inventoryPath = path.join(tempRoot, 'runtime-ui-inventory.json');
  const allowlistPath = path.join(tempRoot, 'allowlist.json');
  const checkerPath = path.join(repoRoot, 'tools', 'check_runtime_ui_coverage.js');

  writeJson(inventoryPath, {
    formatVersion: 2,
    language: 'ja_JP',
    menuBars: [
      {
        items: [
          { text: '編集', separator: false },
          { text: 'Show Guides', separator: false },
          { text: 'SVG', separator: false },
          { text: 'Google スプレッドシートを読み込み...', separator: false },
          { text: 'Copy as SVG', separator: false },
        ],
      },
    ],
    widgetTexts: [
      { className: 'QLabel', strings: { text: '保存' } },
      { className: 'QLabel', strings: { text: 'Scene Window' } },
    ],
  });
  writeJson(allowlistPath, {
    exact: ['SVG'],
    contains: ['Google', 'SVG'],
  });

  const failing = spawnSync(
    process.execPath,
    [checkerPath, '--inventory', inventoryPath, '--allowlist', allowlistPath, '--threshold', '99'],
    { encoding: 'utf8' }
  );
  assert.equal(
    failing.status,
    1,
    'coverage checker should fail when untranslated runtime UI strings exceed the threshold'
  );
  assert.match(
    `${failing.stdout}\n${failing.stderr}`,
    /Copy as SVG/,
    'coverage checker should keep blocking strings that still contain untranslated English after stripping allowlisted retained terms'
  );
  assert.match(
    `${failing.stdout}\n${failing.stderr}`,
    /Show Guides|Scene Window/,
    'coverage checker should report the real untranslated runtime strings that block completion'
  );
  assert.doesNotMatch(
    `${failing.stdout}\n${failing.stderr}`,
    /Google スプレッドシートを読み込み/,
    'coverage checker should not flag strings that are translated except for explicitly allowlisted retained terms'
  );
  assert.match(
    `${failing.stdout}\n${failing.stderr}`,
    /99/,
    'coverage checker output should include the configured completion threshold'
  );

  const passing = spawnSync(
    process.execPath,
    [checkerPath, '--inventory', inventoryPath, '--allowlist', allowlistPath, '--threshold', '40'],
    { encoding: 'utf8' }
  );
  assert.equal(
    passing.status,
    0,
    passing.stderr || passing.stdout || 'coverage checker should pass when the runtime inventory clears the threshold'
  );
});

test('runtime UI coverage tool fails forbidden translation patterns even without ASCII residue', () => {
  const tempRoot = makeTempDir();
  const inventoryPath = path.join(tempRoot, 'runtime-ui-inventory.json');
  const allowlistPath = path.join(tempRoot, 'allowlist.json');
  const checkerPath = path.join(repoRoot, 'tools', 'check_runtime_ui_coverage.js');

  writeJson(inventoryPath, {
    formatVersion: 2,
    language: 'ja_JP',
    menuBars: [
      {
        items: [
          { text: '保存（訳）', separator: false },
          { text: 'Ａｌｐｈａ', separator: false },
          { text: 'ページ:1', separator: false },
        ],
      },
    ],
    widgetTexts: [],
  });
  writeJson(allowlistPath, {
    exact: [],
    contains: [],
  });

  const result = spawnSync(
    process.execPath,
    [checkerPath, '--inventory', inventoryPath, '--allowlist', allowlistPath, '--threshold', '100'],
    { encoding: 'utf8' }
  );

  assert.equal(result.status, 1, 'coverage checker should fail on forbidden pseudo-translations');
  assert.match(`${result.stdout}\n${result.stderr}`, /保存（訳）/);
  assert.match(`${result.stdout}\n${result.stderr}`, /Ａｌｐｈａ/);
  assert.match(`${result.stdout}\n${result.stderr}`, /ページ:1/);
});

test('runtime allowlist keeps glossary-preserved brands and acronyms out of blocker counts', () => {
  const allowlist = readJson(path.join(repoRoot, 'tools', 'runtime_ui_allowlist.json'));

  assert.ok(
    allowlist.contains.includes('Canva'),
    'compiled/runtime coverage should allow the Canva brand name inside otherwise translated strings'
  );
  assert.ok(
    allowlist.contains.includes('IK'),
    'compiled/runtime coverage should allow the IK rigging acronym inside otherwise translated strings'
  );
});

test('shared forbidden translation detector covers the current FP set without legacy FP-6', () => {
  const detectorPath = path.join(repoRoot, 'tools', 'forbidden_translation_patterns.js');
  const { detectForbiddenTranslationPatterns } = require(detectorPath);

  assert.deepEqual(
    detectForbiddenTranslationPatterns({ language: 'zh-Hans', value: '上传预设管理器（译）' }).map((hit) => hit.id),
    ['FP-1']
  );
  assert.deepEqual(
    detectForbiddenTranslationPatterns({ language: 'zh-Hans', value: 'ＲＧＢ' }).map((hit) => hit.id),
    ['FP-2']
  );
  assert.deepEqual(
    detectForbiddenTranslationPatterns({ language: 'ja_JP', value: 'ページ3' }).map((hit) => hit.id),
    ['FP-3']
  );
  assert.deepEqual(
    detectForbiddenTranslationPatterns({ language: 'zh-Hant', value: '图层' }).map((hit) => hit.id),
    ['FP-4']
  );
  assert.deepEqual(
    detectForbiddenTranslationPatterns({ language: 'zh-Hans', value: '圖層' }).map((hit) => hit.id),
    ['FP-5']
  );
  const placeholderHits = detectForbiddenTranslationPatterns({
    language: 'zh-Hans',
    sourceText: 'Upload Preset Manager',
    value: 'Upload Preset Manager（译）',
  }).map((hit) => hit.id);
  assert.ok(placeholderHits.includes('FP-1'));
  assert.ok(placeholderHits.includes('FP-9'));
  assert.equal(placeholderHits.includes('FP-6'), false, 'legacy FP-6 must not be emitted');
});

test('shared forbidden translation detector rejects transliteration and pangram fabrication', () => {
  const detectorPath = path.join(repoRoot, 'tools', 'forbidden_translation_patterns.js');
  const { detectForbiddenTranslationPatterns } = require(detectorPath);

  assert.deepEqual(
    detectForbiddenTranslationPatterns({
      language: 'zh-Hans',
      sourceText: 'Acce',
      value: '重音符',
    }).map((hit) => hit.id),
    ['FP-10']
  );
  assert.deepEqual(
    detectForbiddenTranslationPatterns({
      language: 'ja_JP',
      sourceText: 'Arial',
      value: 'アリアル',
    }).map((hit) => hit.id),
    ['FP-10']
  );
  assert.deepEqual(
    detectForbiddenTranslationPatterns({
      language: 'zh-Hans',
      sourceText: 'ahk ISK bhk DBX khk GNM nhk',
      value: '阿赫克 伊斯克 贝赫克 德贝克斯 卡赫克 吉恩姆 恩赫克',
    }).map((hit) => hit.id),
    ['FP-11']
  );
  assert.deepEqual(
    detectForbiddenTranslationPatterns({
      language: 'zh-Hans',
      sourceText: 'Acce',
      value: 'Acce',
    }),
    []
  );
});

test('translation whitelist registers FP-10 FP-11 FP-12 contracts', () => {
  const whitelist = readJson(path.join(repoRoot, 'tools', 'translation-whitelist.json'));
  const contracts = whitelist._forbidden_patterns;

  assert.equal(contracts.transliteration_ban.id, 'FP-10');
  assert.equal(contracts.pangram_skip.id, 'FP-11');
  assert.equal(contracts.translation_reuse_cap.id, 'FP-12');
});

test('translation validator preserves TS and generated table context for FP-8', () => {
  const { tempRoot, extractionPath } = makeValidatorFixtureRepo();
  const validatorPath = path.join(tempRoot, 'tools', 'validate_translations.py');
  const reportPath = path.join(tempRoot, 'p5-report.json');
  const summaryPath = path.join(tempRoot, 'p5-summary.md');
  const tsPath = path.join(tempRoot, 'tools', 'zh-Hans.ts');
  const generatedPath = path.join(tempRoot, 'desktop-patcher', 'injector', 'generated_translations.inc');

  fs.writeFileSync(
    tsPath,
    [
      '<?xml version="1.0" encoding="utf-8"?>',
      '<TS version="2.1" language="zh-Hans">',
      '<context>',
      '<name>Cavalry-Compiled-UI-Glossary</name>',
      '<message><source>Open</source><translation>打开</translation></message>',
      '</context>',
      '</TS>',
    ].join('\n')
  );
  fs.mkdirSync(path.dirname(generatedPath), { recursive: true });
  fs.writeFileSync(
    generatedPath,
    [
      'const TranslationEntry kZhHansEntries[] = {',
      '  {"Foo-Synthetic", "Close", "关闭"},',
      '};',
      'const TranslationEntry kZhHantEntries[] = {',
      '};',
      'const TranslationEntry kJaEntries[] = {',
      '};',
    ].join('\n')
  );

  const result = spawnSync(
    'python3',
    [
      validatorPath,
      '--root',
      tempRoot,
      '--extraction-inventory',
      extractionPath,
      '--json-report',
      reportPath,
      '--markdown-summary',
      summaryPath,
    ],
    { encoding: 'utf8' }
  );
  const report = readJson(reportPath);

  assert.equal(result.status, 1, 'validator should hard-fail fake Qt contexts');
  assert.equal(report.gates.B13.status, 'FAIL');
  assert.equal(report.languages.zh_Hans.forbidden_patterns.by_pattern['FP-8'], 2);
});

test('translation validator rejects generic translation reuse across unrelated sources', () => {
  const { tempRoot, extractionPath } = makeValidatorFixtureRepo();
  const validatorPath = path.join(tempRoot, 'tools', 'validate_translations.py');
  const reportPath = path.join(tempRoot, 'p5-report.json');
  const summaryPath = path.join(tempRoot, 'p5-summary.md');
  const tsPath = path.join(tempRoot, 'tools', 'ja_JP.ts');

  fs.writeFileSync(
    tsPath,
    [
      '<?xml version="1.0" encoding="utf-8"?>',
      '<TS version="2.1" language="ja_JP">',
      '<context>',
      '<name>MenuBarManager</name>',
      '<message><source>Enable Onion Skin</source><translation>文字列形式が正しくありません</translation></message>',
      '<message><source>Export Movie</source><translation>文字列形式が正しくありません</translation></message>',
      '<message><source>Reset Workspace</source><translation>文字列形式が正しくありません</translation></message>',
      '</context>',
      '</TS>',
    ].join('\n')
  );

  const result = spawnSync(
    'python3',
    [
      validatorPath,
      '--root',
      tempRoot,
      '--extraction-inventory',
      extractionPath,
      '--json-report',
      reportPath,
      '--markdown-summary',
      summaryPath,
    ],
    { encoding: 'utf8' }
  );
  const report = readJson(reportPath);

  assert.equal(result.status, 1, 'validator should hard-fail generic placeholder reuse');
  assert.equal(report.gates.B13.status, 'FAIL');
  assert.equal(report.languages.ja.forbidden_patterns.by_pattern['FP-12'], 1);
});

test('runtime and JSON validators import the shared forbidden translation detector', () => {
  const runtimeSource = fs.readFileSync(
    path.join(repoRoot, 'tools', 'check_runtime_ui_coverage.js'),
    'utf8'
  );
  const validatorSource = fs.readFileSync(path.join(repoRoot, 'tools', 'validate_translations.py'), 'utf8');

  assert.match(
    runtimeSource,
    /forbidden_translation_patterns/,
    'runtime detector should call the shared forbidden-translation module instead of keeping a private regex copy'
  );
  assert.match(
    validatorSource,
    /forbidden_translation_patterns/,
    'JSON validator should call the shared forbidden-translation module instead of keeping purity rules private'
  );
});

test('checked-in generated translation table matches the ts sources', () => {
  const tempRoot = makeTempDir();
  const generatedPath = path.join(tempRoot, 'generated_translations.inc');
  const generatorPath = path.join(repoRoot, 'tools', 'generate_embedded_translations.js');
  const checkedInPath = path.join(desktopRoot, 'injector', 'generated_translations.inc');

  const result = spawnSync(process.execPath, [generatorPath, generatedPath], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout || 'generator should exit cleanly');

  const generated = fs.readFileSync(generatedPath, 'utf8');
  const checkedIn = fs.readFileSync(checkedInPath, 'utf8');
  assert.equal(
    generated,
    checkedIn,
    'generated_translations.inc should be regenerated from tools/*.ts whenever translation sources change'
  );
});

test('release workflow prebuilds the injector and publishes Tauri macOS artifacts', () => {
  const workflow = fs.readFileSync(path.join(repoRoot, '.github', 'workflows', 'build.yml'), 'utf8');

  assert.match(
    workflow,
    /runs-on:\s*macos-latest/,
    'release pipeline should build the injector on macOS so end users do not need Qt locally'
  );
  assert.match(
    workflow,
    /npm run prepare:qt-sdk/,
    'release pipeline should prepare the Qt SDK through the same project target resolver used by local builds'
  );
  assert.match(
    workflow,
    /tools\/cavalry_qt_target\.json/,
    'release pipeline should upload the single Cavalry/Qt target contract with the source artifact'
  );
  assert.match(
    workflow,
    /build_translator_injector\.sh/,
    'release pipeline should invoke the injector build script'
  );
  assert.match(
    workflow,
    /libCavalryTranslatorInjector\.dylib/,
    'release packaging should include the prebuilt injector dylib'
  );
  assert.match(
    workflow,
    /npm run build/,
    'release pipeline should build the packaged macOS patcher app through the default Tauri path'
  );
  assert.match(
    workflow,
    /src-tauri\/target\/release\/bundle\/dmg\/\*\.dmg|src-tauri\/target\/release\/bundle\/macos/,
    'release pipeline should publish Tauri macOS artifacts for end users'
  );
});

test('local macOS packaging defaults to Tauri while keeping the Electron fallback explicit', () => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
  const scripts = packageJson.scripts || {};
  const buildConfig = packageJson.build || {};

  assert.equal(
    scripts.build,
    'npm run tauri:build',
    'local packaging should default to the Tauri release path'
  );
  assert.match(
    scripts['build:electron'] || '',
    /build:injector/,
    'Electron fallback packaging should still prebuild the injector before running electron-builder'
  );
  assert.match(
    scripts['build:electron:dir'] || '',
    /build:injector/,
    'Electron fallback directory packaging should also prebuild the injector before running electron-builder'
  );
  assert.ok(
    Array.isArray(buildConfig.extraResources) &&
      buildConfig.extraResources.some((entry) =>
        JSON.stringify(entry).includes('libCavalryTranslatorInjector.dylib')
      ),
    'Electron fallback config should still copy the prebuilt injector dylib into packaged app resources'
  );
  assert.match(
    scripts['build:injector'] || '',
    /resolve_cavalry_qt_sdk\.js --print-env --ensure/,
    'local injector prebuild should resolve and prepare the current target Cavalry Qt SDK even when a local app bundle is unavailable'
  );
});
