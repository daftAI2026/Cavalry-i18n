#!/usr/bin/env node
/**
 * [INPUT]: 依赖应用语法清单、package.json、Node测试器与受控临时目录。
 * [OUTPUT]: 锁定短入口、原218项及顺序、追加的版本监控与关注手势项，并验证逐文件命令对语法错和缺文件失败。
 * [POS]: tools 的语法runner合同；不扫描目录，不启动应用。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { APP_SYNTAX_FILES, runAppSyntaxCheck } = require('./check_app_syntax.js');
const { cleanupTempDirs, makeTempDir } = require('./test_temp_dir.js');

test.after(cleanupTempDirs);

const REPO_ROOT = path.resolve(__dirname, '..');

test('check:app uses a short runner command and registers its focused contract', () => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf8'));

  assert.equal(packageJson.scripts['check:app'], 'node tools/check_app_syntax.js');
  assert.ok(packageJson.scripts['check:app'].length < 40);
  assert.match(packageJson.scripts['test:contracts'], /tools\/check_app_syntax\.test\.js/);
});

test('the runner retains every legacy syntax path in its original order', () => {
  const legacyFiles = APP_SYNTAX_FILES.slice(0, 218);
  const digest = crypto.createHash('sha256').update(legacyFiles.join('\n')).digest('hex');

  assert.equal(legacyFiles.length, 218);
  assert.equal(digest, '8a6e9ec5a810ba101dee99615e97b5fb7b9a24b302f4879dc561d9437bb6305f');
  assert.deepEqual(APP_SYNTAX_FILES.slice(218), [
    'tools/check_app_syntax.js',
    'tools/check_app_syntax.test.js',
    'tools/windows_native_build.js',
    'tools/windows_native_build.test.js',
    'tools/check_windows_native_nsis.test.js',
    'tools/prepare_cavalry_28_windows_ci_inputs.test.js',
    'tools/watch_cavalry_release.js',
    'tools/watch_cavalry_release.test.js',
    'renderer/support-follow-hand.js',
    'tools/support_follow_hand.test.js',
  ]);
  assert.equal(new Set(APP_SYNTAX_FILES).size, APP_SYNTAX_FILES.length);
});

test('syntax errors stop the sequence and return the Node exit code without a shell', () => {
  const fixtureRoot = makeTempDir('cavalry-i18n-test-');
  const validFile = path.join(fixtureRoot, 'valid.js');
  const invalidFile = path.join(fixtureRoot, 'invalid.js');
  const untouchedFile = path.join(fixtureRoot, 'later.js');
  fs.writeFileSync(validFile, 'const valid = true;\n');
  fs.writeFileSync(invalidFile, 'const = ;\n');
  fs.writeFileSync(untouchedFile, 'const later = true;\n');

  const calls = [];
  const result = runAppSyntaxCheck([validFile, invalidFile, untouchedFile], {
    cwd: fixtureRoot,
    spawnSync(command, args, options) {
      assert.equal(command, process.execPath);
      assert.equal(options.shell, false);
      assert.equal(options.stdio, 'inherit');
      const child = spawnSync(command, args, { ...options, encoding: 'utf8', stdio: 'pipe' });
      calls.push({ args, status: child.status, stderr: child.stderr });
      return child;
    },
  });

  assert.equal(result, 1);
  assert.deepEqual(calls.map(({ args }) => args), [
    ['--check', validFile],
    ['--check', invalidFile],
  ]);
  assert.match(calls[1].stderr, /SyntaxError/);
});

test('missing syntax inputs fail and retain Node diagnostics', () => {
  const fixtureRoot = makeTempDir('cavalry-i18n-test-');
  let stderr = '';
  const result = runAppSyntaxCheck(['missing.js'], {
    cwd: fixtureRoot,
    spawnSync(command, args, options) {
      const child = spawnSync(command, args, { ...options, encoding: 'utf8', stdio: 'pipe' });
      stderr = child.stderr;
      return child;
    },
  });

  assert.equal(result, 1);
  assert.match(stderr, /Cannot find module|ENOENT/);
});
