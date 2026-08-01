#!/usr/bin/env node
/**
 * [INPUT]: 依赖 install_git_hooks、pre_commit_gate、git-hooks/pre-commit 与 Node test，使用注入 spawn 模拟 Windows PATH/Git 状态
 * [OUTPUT]: 对外验证 stale PATH Git 解析、git-unavailable/not-worktree 区分、process.execPath 记录，以及 pre-commit 的按路径快速门禁与 partial-staged fail-closed 合同
 * [POS]: tools 的 Git 开发环境合同测试，不运行真实 UAC、Cargo 或提交，确保 Windows 上的 hook 安装与提交前 index/工作区边界可重复验证
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { installGitHooks, resolveGitCommand } = require('./install_git_hooks.js');
const {
  VERSION_FILES,
  assertGateInputsFullyStaged,
  assertVersionFilesFullyStaged,
  buildGatePlan,
  runPreCommit,
} = require('./pre_commit_gate.js');

const repoRoot = path.resolve(__dirname, '..');

function runGit(cwd, args) {
  const result = spawnSync(resolveGitCommand(), args, {
    cwd,
    encoding: 'utf8',
    windowsHide: true,
  });
  assert.equal(result.status, 0, result.stderr || result.stdout || result.error?.message);
}

function writeFixtureFile(root, relativePath, source) {
  const filePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, source);
}

function createPartialStagingRepository() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cavalry-partial-stage-'));
  runGit(root, ['init', '--quiet']);
  runGit(root, ['config', 'user.name', 'Cavalry Test']);
  runGit(root, ['config', 'user.email', 'cavalry-test@example.invalid']);

  for (const [relativePath, source] of Object.entries({
    'renderer/example.js': 'const baseline = 1;\n',
    'tools/pre_commit_gate.js': '// tracked gate baseline\n',
    'tools/install_git_hooks.js': '// tracked installer baseline\n',
    'tools/git-hooks/pre-commit': '#!/bin/sh\n',
    'tools/translation-whitelist.json': '{"baseline": true}\n',
    'languages/zh-Hans/appStrings.json': '{"baseline": true}\n',
    'src-tauri/Cargo.toml': '[package]\nname = "cavalry-hook-fixture"\nversion = "0.0.0"\n',
    'src-tauri/src/lib.rs': 'pub fn baseline() {}\n',
    'src-tauri/src/other.rs': 'pub fn other() {}\n',
  })) {
    writeFixtureFile(root, relativePath, source);
  }
  runGit(root, ['add', '--', '.']);
  runGit(root, ['-c', 'commit.gpgSign=false', 'commit', '--quiet', '--no-verify', '-m', 'baseline']);
  return root;
}

test('Windows hook installer bypasses a stale Git PATH entry for Program Files Git', () => {
  const programFiles = 'C:\\Program Files';
  const expected = path.win32.join(programFiles, 'Git', 'cmd', 'git.exe');
  const calls = [];
  const resolved = resolveGitCommand({
    env: { ProgramFiles: programFiles },
    platform: 'win32',
    exists: (candidate) => candidate === expected,
    spawn: (command, args) => {
      calls.push([command, args]);
      return { status: command === expected ? 0 : 1 };
    },
  });

  assert.equal(resolved, expected);
  assert.deepEqual(calls, [
    ['git', ['--version']],
    [expected, ['--version']],
  ]);
});

test('hook installer distinguishes missing Git from a non-worktree', () => {
  const unavailable = installGitHooks({
    env: { ProgramFiles: 'C:\\Program Files' },
    platform: 'win32',
    exists: () => false,
    spawn: () => ({ status: 1, stderr: 'not found' }),
  });
  assert.equal(unavailable.installed, false);
  assert.equal(unavailable.reason, 'git-unavailable');

  const calls = [];
  const notWorktree = installGitHooks({
    cwd: 'C:\\scratch',
    platform: 'win32',
    spawn: (command, args, options) => {
      calls.push({ command, args, cwd: options.cwd });
      if (args[0] === '--version') {
        return { status: 0, stdout: 'git version 2.50.0' };
      }
      return { status: 0, stdout: 'false\n' };
    },
  });
  assert.deepEqual(notWorktree, { installed: false, reason: 'not-a-git-worktree' });
  assert.deepEqual(calls, [
    { command: 'git', args: ['--version'], cwd: undefined },
    {
      command: 'git',
      args: ['rev-parse', '--is-inside-work-tree'],
      cwd: 'C:\\scratch',
    },
  ]);
});

test('hook installer records the running Node executable in repository-local Git config', () => {
  const calls = [];
  const result = installGitHooks({
    cwd: 'C:\\repo',
    platform: 'win32',
    spawn: (command, args, options) => {
      calls.push({ command, args, cwd: options.cwd });
      if (args[0] === '--version') {
        return { status: 0, stdout: 'git version 2.50.0' };
      }
      if (args[0] === 'rev-parse') {
        return { status: 0, stdout: 'true\n' };
      }
      return { status: 0, stdout: '' };
    },
  });

  assert.deepEqual(result, { installed: true, reason: 'configured' });
  assert.deepEqual(calls.at(-1), {
    command: 'git',
    args: ['config', 'cavalry-i18n.nodePath', process.execPath],
    cwd: 'C:\\repo',
  });
});

test('pre-commit plan runs only the fast gates implied by staged paths', () => {
  const plan = buildGatePlan([
    'src-tauri/src/privilege.rs',
    'renderer/app.js',
    'tools/pre_commit_gate.js',
    'package.json',
    'tools/zh-Hans.ts',
    'injector/generated_translations.inc',
    'languages/zh-Hans/appStrings.json',
  ]);

  assert.equal(plan.versionChanged, true);
  assert.equal(plan.rustChanged, true);
  assert.deepEqual(plan.javascriptFiles, ['renderer/app.js', 'tools/pre_commit_gate.js']);
  assert.deepEqual(plan.packageFiles, ['package.json']);
  assert.equal(plan.generatedTranslationsChanged, true);
  assert.equal(plan.languageContractsChanged, true);
});

test('version synchronization rejects partial-staged version files before it can stage projections', () => {
  assert.throws(
    () =>
      assertVersionFilesFullyStaged((args) => ({
        status: args.at(-1) === 'package.json' ? 1 : 0,
        stderr: '',
        stdout: '',
      })),
    /package\.json.*未暂存改动/
  );
  assert.equal(VERSION_FILES.includes('CHANGELOG.md'), true);
});

test('pre-commit rejects an unstaged version synchronizer before projecting metadata', () => {
  const plan = buildGatePlan(['CHANGELOG.md']);
  const calls = [];
  const git = (args) => {
    calls.push(args);
    if (args[0] === 'diff' && args.includes('--name-only')) {
      return { status: 0, stdout: 'tools/sync_project_version.js\0', stderr: '' };
    }
    if (args[0] === 'ls-files') {
      return { status: 0, stdout: '', stderr: '' };
    }
    return { status: 0, stdout: '', stderr: '' };
  };

  assert.throws(
    () => assertGateInputsFullyStaged(git, plan),
    /tools\/sync_project_version\.js/
  );
  assert.ok(calls.length >= 2);
});

test('pre-commit rejects a staged JavaScript error masked by an unstaged working-tree repair', () => {
  const root = createPartialStagingRepository();
  try {
    writeFixtureFile(root, 'renderer/example.js', 'const = stagedSyntaxError;\n');
    runGit(root, ['add', '--', 'renderer/example.js']);
    writeFixtureFile(root, 'renderer/example.js', 'const repaired = true;\n');

    assert.throws(
      () => runPreCommit({ cwd: root, nodePath: process.execPath }),
      /unstaged inputs:.*renderer[\\/]example\.js/i
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('pre-commit rejects another unstaged Rust source that cargo fmt would read', () => {
  const root = createPartialStagingRepository();
  try {
    writeFixtureFile(root, 'src-tauri/src/lib.rs', 'pub fn staged() {}\n');
    runGit(root, ['add', '--', 'src-tauri/src/lib.rs']);
    writeFixtureFile(root, 'src-tauri/src/other.rs', 'pub fn working_tree_only() {}\n');

    assert.throws(
      () => runPreCommit({ cwd: root, nodePath: process.execPath }),
      /unstaged inputs:.*src-tauri[\\/]src[\\/]other\.rs/i
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('pre-commit rejects an unstaged language input even when only its contract rule is staged', () => {
  const root = createPartialStagingRepository();
  try {
    writeFixtureFile(root, 'tools/translation-whitelist.json', '{"staged": true}\n');
    runGit(root, ['add', '--', 'tools/translation-whitelist.json']);
    writeFixtureFile(root, 'languages/zh-Hans/appStrings.json', '{"workingTreeOnly": true}\n');

    assert.throws(
      () => runPreCommit({ cwd: root, nodePath: process.execPath }),
      /unstaged inputs:.*languages[\\/]zh-Hans[\\/]appStrings\.json/i
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('pre-commit rejects an unstaged gate implementation before it can validate another staged file', () => {
  const root = createPartialStagingRepository();
  try {
    writeFixtureFile(root, 'renderer/example.js', 'const staged = true;\n');
    runGit(root, ['add', '--', 'renderer/example.js']);
    writeFixtureFile(root, 'tools/pre_commit_gate.js', '// unstaged gate override\n');

    assert.throws(
      () => runPreCommit({ cwd: root, nodePath: process.execPath }),
      /unstaged inputs:.*tools[\\/]pre_commit_gate\.js/i
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('shell bootstrap prioritizes repo-local Node and delegates all mutation policy to the Node gate', () => {
  const hook = fs.readFileSync(path.join(repoRoot, 'tools', 'git-hooks', 'pre-commit'), 'utf8');
  const gate = fs.readFileSync(path.join(repoRoot, 'tools', 'pre_commit_gate.js'), 'utf8');

  assert.match(hook, /git config --local --get cavalry-i18n\.nodePath/);
  assert.match(hook, /exec "\$NODE_BIN" tools\/pre_commit_gate\.js/);
  assert.doesNotMatch(hook, /\bgit add\b/);
  assert.match(gate, /'cargo',[\s\S]*'fmt',[\s\S]*'--check'/);
  assert.doesNotMatch(gate, /'cargo',[\s\S]*'(?:test|check)'/);
  assert.match(gate, /generate_embedded_translations\.js/);
  assert.match(gate, /--test-name-pattern=/);
  assert.doesNotMatch(gate, /\['add', '\.'\]/);
});
