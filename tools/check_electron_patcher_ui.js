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
    path.join(repoRoot, 'languages', 'zh-Hans', 'nodeStrings.json'),
    path.join(repoRoot, 'languages', 'zh-Hant', 'nodeStrings.json'),
    path.join(repoRoot, 'languages', 'ja_JP', 'nodeStrings.json'),
  ];

  for (const filePath of expectedFiles) {
    assert.ok(fs.existsSync(filePath), `${path.relative(repoRoot, filePath)} missing`);
  }

  const removedPaths = [
    path.join(repoRoot, 'LanguageSwitcher.js'),
    path.join(repoRoot, 'LanguageSwitcher_assets'),
    path.join(desktopRoot, 'injector'),
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
