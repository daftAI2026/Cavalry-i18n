#!/usr/bin/env node

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

test('desktop patcher workspace matches the JSON-only refactor layout', () => {
  const expectedFiles = [
    path.join(repoRoot, 'package.json'),
    path.join(desktopRoot, 'main.js'),
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
    path.join(repoRoot, 'tools', 'generate_embedded_translations.js'),
    path.join(repoRoot, 'tools', 'launch_cavalry_with_injector.sh'),
    path.join(repoRoot, 'tools', 'zh-Hans.ts'),
    path.join(repoRoot, 'tools', 'zh-Hant.ts'),
    path.join(repoRoot, 'tools', 'ja_JP.ts'),
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

  assert.match(html, /Current:/);
  assert.match(html, /Apply &amp; Restart|Apply & Restart/);
  assert.match(html, /id="statusText"/);
  assert.doesNotMatch(html, /id="outputAppPath"/);
  assert.doesNotMatch(html, /id="qmTarget"/);
  assert.doesNotMatch(html, /id="inspectButton"/);
  assert.doesNotMatch(html, /id="diagnosticsGrid"/);
});

test('macOS sudo script does not recursively clear xattrs on the whole app bundle', () => {
  const sudoSource = fs.readFileSync(path.join(desktopRoot, 'lib', 'sudo.js'), 'utf8');

  assert.doesNotMatch(
    sudoSource,
    /xattr\s+-cr/,
    'automatic JSON patching should not run recursive xattr cleanup on the entire .app bundle'
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
  const mainSource = fs.readFileSync(path.join(desktopRoot, 'main.js'), 'utf8');

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
  const mainSource = fs.readFileSync(path.join(desktopRoot, 'main.js'), 'utf8');

  assert.match(
    mainSource,
    /readFileSync\(getLangMarkerPath\(appPath\)/,
    'desktop patcher should prefer the bundle-local language marker over stale state.json when detecting the current macOS language'
  );
});

test('packaged desktop app prefers a bundled injector resource over rebuilding from source at runtime', () => {
  const mainSource = fs.readFileSync(path.join(desktopRoot, 'main.js'), 'utf8');

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
  const mainSource = fs.readFileSync(path.join(desktopRoot, 'main.js'), 'utf8');

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

test('code-signature diagnostics use deep verification for patched app bundles', () => {
  const patchSource = fs.readFileSync(path.join(desktopRoot, 'lib', 'patch.js'), 'utf8');

  assert.match(
    patchSource,
    /codesign', \['--verify', '--deep', '--strict', appPath\]/,
    'signature diagnostics should verify the whole patched bundle tree, not only the top-level app node'
  );
});

test('injector build script can fall back to Qt frameworks when Cavalry app frameworks are unavailable', () => {
  const buildScript = fs.readFileSync(path.join(repoRoot, 'tools', 'build_translator_injector.sh'), 'utf8');

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

test('release workflow prebuilds and packages the injector dylib on macOS', () => {
  const workflow = fs.readFileSync(path.join(repoRoot, '.github', 'workflows', 'build.yml'), 'utf8');

  assert.match(
    workflow,
    /runs-on:\s*macos-latest/,
    'release pipeline should build the injector on macOS so end users do not need Qt locally'
  );
  assert.match(
    workflow,
    /install-qt-action@v4/,
    'release pipeline should install a pinned Qt runtime instead of whichever Homebrew Qt happens to be latest'
  );
  assert.match(
    workflow,
    /version:\s*['"]6\.6\.3['"]/,
    'release pipeline should pin Qt 6.6.3 to match the current Cavalry runtime frameworks'
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
    'release pipeline should build the packaged macOS patcher app, not just zip the source tree'
  );
  assert.match(
    workflow,
    /dist\/\*\.dmg|dist\/\*\.zip/,
    'release pipeline should publish electron-builder macOS artifacts for end users'
  );
});

test('local macOS packaging prebuilds and bundles the injector dylib', () => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
  const scripts = packageJson.scripts || {};
  const buildConfig = packageJson.build || {};

  assert.match(
    scripts.build || '',
    /build:injector/,
    'local packaging should prebuild the injector before running electron-builder'
  );
  assert.match(
    scripts['build:dir'] || '',
    /build:injector/,
    'directory packaging should also prebuild the injector before running electron-builder'
  );
  assert.ok(
    Array.isArray(buildConfig.extraResources) &&
      buildConfig.extraResources.some((entry) =>
        JSON.stringify(entry).includes('libCavalryTranslatorInjector.dylib')
      ),
    'electron-builder config should copy the prebuilt injector dylib into packaged app resources'
  );
  assert.match(
    scripts['build:injector'] || '',
    /CAVALRY_QT_VERSION=6\.6\.3/,
    'local injector prebuild should pin the current target Cavalry Qt branch even when a local app bundle is unavailable'
  );
});
