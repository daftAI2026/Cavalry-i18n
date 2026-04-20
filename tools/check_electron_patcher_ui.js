#!/usr/bin/env node

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');
const desktopRoot = path.join(repoRoot, 'desktop-patcher');
const launcherModulePath = path.join(desktopRoot, 'lib', 'patcher-config.js');

test('desktop patcher workspace exists', () => {
  assert.ok(fs.existsSync(path.join(repoRoot, 'package.json')), 'package.json missing');
  assert.ok(fs.existsSync(path.join(desktopRoot, 'main.js')), 'desktop-patcher/main.js missing');
  assert.ok(fs.existsSync(path.join(desktopRoot, 'preload.js')), 'desktop-patcher/preload.js missing');
  assert.ok(fs.existsSync(path.join(desktopRoot, 'renderer', 'index.html')), 'desktop-patcher/renderer/index.html missing');
  assert.ok(fs.existsSync(path.join(desktopRoot, 'renderer', 'app.js')), 'desktop-patcher/renderer/app.js missing');
  assert.ok(fs.existsSync(path.join(desktopRoot, 'renderer', 'styles.css')), 'desktop-patcher/renderer/styles.css missing');
});

test('desktop patcher discovers languages and default app path', () => {
  const { listLanguageOptions, getDefaultAppCandidates, buildPatchCommand } = require(launcherModulePath);

  const languages = listLanguageOptions(repoRoot);
  assert.ok(languages.some((item) => item.value === 'zh-Hans'), 'zh-Hans should be listed');
  assert.ok(languages.some((item) => item.value === 'zh-Hant'), 'zh-Hant should be listed');
  assert.ok(languages.some((item) => item.value === 'ja_JP'), 'ja_JP should be listed');

  const candidates = getDefaultAppCandidates();
  assert.ok(
    candidates.includes('/Applications/Cavalry.app'),
    'default candidates should include /Applications/Cavalry.app'
  );

  const command = buildPatchCommand({
    repoRoot,
    appPath: '/Applications/Cavalry.app',
    outputAppPath: '/Users/tester/Applications/Cavalry zh-Hans.app',
    language: 'zh-Hans',
    qmTarget: 'resources',
    refreshEnglish: true,
  });

  assert.equal(command.program, 'python3');
  assert.ok(
    command.args[0].endsWith(path.join('tools', 'patch_cavalry_bundle.py')),
    'first arg should point to tools/patch_cavalry_bundle.py'
  );
  assert.deepEqual(command.args.slice(1), [
    '--app',
    '/Applications/Cavalry.app',
    '--output-app',
    '/Users/tester/Applications/Cavalry zh-Hans.app',
    '--lang',
    'zh-Hans',
    '--refresh-en',
    '--qm-target',
    'resources',
  ]);
});
