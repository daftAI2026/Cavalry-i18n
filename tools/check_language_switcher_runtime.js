#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const repoRoot = path.resolve(__dirname, '..');
const scriptPath = path.join(repoRoot, 'LanguageSwitcher.js');
const runtimeRoot = path.join(repoRoot, 'LanguageSwitcher_assets');
const runtimeLanguagesRoot = path.join(runtimeRoot, 'languages');

function expectExists(relativePath) {
  const fullPath = path.join(repoRoot, relativePath);
  assert.ok(fs.existsSync(fullPath), `Expected ${relativePath} to exist`);
}

const scriptSource = fs.readFileSync(scriptPath, 'utf8');

expectExists('LanguageSwitcher.js');
expectExists('README.md');
expectExists('tools/check_language_switcher_runtime.js');

assert.ok(
  fs.existsSync(runtimeRoot),
  'Expected hidden Script UI asset root LanguageSwitcher_assets/ to exist'
);

assert.ok(
  fs.existsSync(runtimeLanguagesRoot),
  'Expected runtime language assets at LanguageSwitcher_assets/languages/'
);

expectExists('LanguageSwitcher_assets/languages/en/nodeStrings.json');
expectExists('LanguageSwitcher_assets/languages/en/appStrings.json');
expectExists('LanguageSwitcher_assets/languages/en/tips.json');
expectExists('LanguageSwitcher_assets/languages/en/onboarding.json');

assert.ok(
  !fs.existsSync(path.join(repoRoot, 'languages')),
  'Legacy top-level languages/ should be moved under LanguageSwitcher_assets/'
);

assert.ok(
  !scriptSource.includes('api.UIWidget'),
  'LanguageSwitcher.js must use the documented ui module instead of api.UIWidget'
);

assert.ok(
  /new\s+ui\.DropDown\s*\(/.test(scriptSource),
  'LanguageSwitcher.js should create the selector with ui.DropDown'
);

assert.ok(
  scriptSource.includes('ui.scriptLocation'),
  'LanguageSwitcher.js should resolve runtime assets from ui.scriptLocation'
);

assert.ok(
  !/getScriptsFolder\s*\(/.test(scriptSource),
  'LanguageSwitcher.js should not assume a fixed global Scripts folder path'
);

console.log('PASS: language switcher runtime layout and Script UI contract');
