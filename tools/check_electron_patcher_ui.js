#!/usr/bin/env node

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

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
    path.join(repoRoot, 'languages', 'zh-Hans', 'nodeStrings.json'),
    path.join(repoRoot, 'languages', 'zh-Hant', 'nodeStrings.json'),
    path.join(repoRoot, 'languages', 'ja_JP', 'nodeStrings.json'),
    path.join(repoRoot, 'tools', 'build_translator_injector.sh'),
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

test('desktop main process keeps injector-based launch support for translated macOS sessions', () => {
  const mainSource = fs.readFileSync(path.join(desktopRoot, 'main.js'), 'utf8');

  assert.match(
    mainSource,
    /launch_cavalry_with_injector\.sh/,
    'translated macOS launches should go through the injector launcher so compiled UI strings can change'
  );
  assert.match(
    mainSource,
    /translated-apps|translatedApp/,
    'desktop patcher should manage a writable translated app copy instead of editing the signed /Applications bundle in place'
  );
});

test('translated launcher handles crashpad_handler before re-signing the macOS app copy', () => {
  const launcherSource = fs.readFileSync(
    path.join(repoRoot, 'tools', 'launch_cavalry_with_injector.sh'),
    'utf8'
  );

  assert.match(
    launcherSource,
    /crashpad_handler/,
    'launcher should explicitly account for crashpad_handler when preparing the translated app copy'
  );
  assert.match(
    launcherSource,
    /codesign --remove-signature/,
    'launcher should strip stale nested signatures before re-signing the translated app copy'
  );
});
