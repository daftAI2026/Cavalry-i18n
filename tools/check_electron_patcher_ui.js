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
    path.join(repoRoot, 'doc', 'compiled-ui-source-map.json'),
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

  assert.match(html, /Current\s+—/);
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
  assert.equal(target.cavalryVersion, '2.7.0');
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

test('package.json exposes a runtime UI coverage gate with a 99% threshold', () => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
  const scripts = packageJson.scripts || {};

  assert.match(
    scripts['check:ui-coverage'] || '',
    /tools\/check_runtime_ui_coverage\.js/,
    'package.json should expose a dedicated runtime UI coverage checker instead of relying on ad hoc screenshot inspection'
  );
  assert.match(
    scripts['check:ui-coverage'] || '',
    /--threshold 99/,
    'runtime UI localization should use a hard 99% completion gate, with any retained English terms handled through an explicit allowlist'
  );
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
    /doc\/compiled-ui-source-map\.json/,
    'compiled UI extraction should write to a checked-in source map JSON file'
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
    /full-ui-runlog\.json/,
    'matrix full-UI blocker should write a stable runlog file so progress can be measured across repeated real-app runs'
  );
});

test('repo tracks a compiled UI source map alongside JSON-backed translation assets', () => {
  const sourceMapPath = path.join(repoRoot, 'doc', 'compiled-ui-source-map.json');
  assert.ok(fs.existsSync(sourceMapPath), 'compiled UI source map should be checked into doc/');

  const sourceMap = JSON.parse(fs.readFileSync(sourceMapPath, 'utf8'));
  assert.equal(sourceMap.kind, 'ownership-map');
  assert.equal(sourceMap.bundleVersion, '2.7.0');
  assert.match(sourceMap.bundleId || '', /com\.scenegroup\.cavalry/);
  assert.match(
    sourceMap.authoritativeRuntimeInventory || '',
    /menu-inventory\.json$/,
    'source map should point to the authoritative runtime menu inventory path'
  );
  assert.ok(
    Array.isArray(sourceMap.jsonAssetRoots) &&
      sourceMap.jsonAssetRoots.some((entry) => entry.includes('languages')) &&
      sourceMap.jsonAssetRoots.some((entry) => entry.includes('Contents/assets/Definitions')),
    'source map should document the existing JSON asset pipeline'
  );
  assert.ok(
    Array.isArray(sourceMap.compiledUiTargets) &&
      sourceMap.compiledUiTargets.some((entry) => entry.endsWith('Contents/MacOS/Cavalry')) &&
      sourceMap.compiledUiTargets.some((entry) => entry.endsWith('Frameworks/libCavalryUI.dylib')),
    'source map should document the compiled UI binaries that own menu/action text'
  );
  assert.ok(
    Array.isArray(sourceMap.surfaces) &&
      sourceMap.surfaces.some((entry) => entry.id === 'json-assets') &&
      sourceMap.surfaces.some((entry) => entry.id === 'compiled-ui') &&
      sourceMap.surfaces.some((entry) => entry.id === 'qt-builtins'),
    'source map should classify UI text ownership into JSON assets, compiled UI code, and Qt built-ins'
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
