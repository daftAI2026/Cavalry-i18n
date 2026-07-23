#!/usr/bin/env node
/**
 * [INPUT]: 依赖 Git 暂存区、install_git_hooks 的 Git 解析、Node/Cargo 与翻译生成器，接收 bootstrap 已确认的 Node 绝对路径
 * [OUTPUT]: 对外提供可测试的 pre-commit 门禁计划与执行器；先拒绝输入闭包的工作区漂移，只显式暂存版本投影，再按暂存路径运行 Rust 格式、JS 语法和语言/生成表合同
 * [POS]: tools 的提交前执行层，被 git-hooks/pre-commit 调用；将跨平台路径和 partial-staged 风险收敛在 Node，绝不扩大用户暂存范围或用工作区内容为旧 index 背书
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { resolveGitCommand } = require('./install_git_hooks.js');

const VERSION_FILES = Object.freeze([
  'CHANGELOG.md',
  'package.json',
  'package-lock.json',
  'src-tauri/Cargo.toml',
  'src-tauri/tauri.conf.json',
  'src-tauri/Cargo.lock',
]);

const VERSION_PROJECTION_FILES = Object.freeze([
  'package.json',
  'package-lock.json',
  'src-tauri/Cargo.toml',
  'src-tauri/tauri.conf.json',
  'src-tauri/Cargo.lock',
]);

const GENERATED_TRANSLATION_INPUTS = new Set([
  'tools/generate_embedded_translations.js',
  'tools/zh-Hans.ts',
  'tools/zh-Hant.ts',
  'tools/ja_JP.ts',
  'tools/model_display_translations.json',
  'tools/runtime-noise-quarantine.json',
  'injector/generated_translations.inc',
]);

const LANGUAGE_CONTRACT_FILES = new Set([
  'tools/translation-whitelist.json',
  'tools/forbidden_translation_patterns.js',
  'tools/forbidden_translation_patterns.py',
  'tools/forbidden_translation_patterns.json',
  'tools/validate_translations.py',
]);

const GATE_SELF_FILES = new Set([
  'tools/pre_commit_gate.js',
  'tools/install_git_hooks.js',
  'tools/git-hooks/pre-commit',
]);

const VERSION_GATE_INPUTS = new Set([
  ...VERSION_FILES,
  'tools/sync_project_version.js',
]);

const LANGUAGE_CONTRACT_INPUTS = new Set([
  ...GENERATED_TRANSLATION_INPUTS,
  ...LANGUAGE_CONTRACT_FILES,
  'tools/check_app_contracts.js',
  'tools/python_command.js',
]);

const LANGUAGE_TEST_PATTERN =
  'English language package is the 38-file JSON surface source truth|checked-in 38-file JSON language packages pass the translation validator';

function normalizeNewlines(value) {
  return value.replace(/\r\n?/g, '\n');
}

function commandDetail(result) {
  return String(result.stderr || result.stdout || result.error?.message || '').trim();
}

function requireSuccess(result, label) {
  if (result.error) {
    throw new Error(`${label} could not start: ${result.error.message}`);
  }
  if (result.status !== 0) {
    const detail = commandDetail(result);
    throw new Error(detail ? `${label} failed: ${detail}` : `${label} failed.`);
  }
  return result;
}

function createGitRunner({ cwd, spawn = spawnSync, gitCommand }) {
  const command = gitCommand || resolveGitCommand({ spawn });
  return (args) =>
    spawn(command, args, {
      cwd,
      encoding: 'utf8',
      windowsHide: true,
    });
}

function gitText(git, args, label) {
  return String(requireSuccess(git(args), label).stdout || '');
}

function stagedFiles(git) {
  return gitText(git, ['diff', '--cached', '--name-only', '-z', '--'], 'Git staged-file query')
    .split('\0')
    .filter(Boolean);
}

function unstagedFiles(git) {
  return gitText(git, ['diff', '--name-only', '-z', '--'], 'Git unstaged-file query')
    .split('\0')
    .filter(Boolean);
}

function untrackedFiles(git) {
  return gitText(
    git,
    ['ls-files', '--others', '--exclude-standard', '-z', '--'],
    'Git untracked-file query'
  )
    .split('\0')
    .filter(Boolean);
}

function buildGatePlan(files) {
  const javascriptFiles = files.filter(
    (file) =>
      file.endsWith('.js') && (file.startsWith('renderer/') || file.startsWith('tools/'))
  );
  const packageFiles = files.filter(
    (file) => file === 'package.json' || file === 'package-lock.json'
  );

  return {
    versionChanged: files.some((file) => VERSION_FILES.includes(file)),
    rustChanged: files.some(
      (file) => file.startsWith('src-tauri/') && file.endsWith('.rs')
    ),
    javascriptFiles,
    packageFiles,
    generatedTranslationsChanged: files.some((file) => GENERATED_TRANSLATION_INPUTS.has(file)),
    languageContractsChanged: files.some(
      (file) => file.startsWith('languages/') || LANGUAGE_CONTRACT_FILES.has(file)
    ),
  };
}

function isRustSource(file) {
  return file.startsWith('src-tauri/') && file.endsWith('.rs');
}

function isRustFormatInput(file) {
  return file === 'src-tauri/Cargo.toml' || isRustSource(file);
}

function isLanguageContractInput(file) {
  return file.startsWith('languages/') || LANGUAGE_CONTRACT_INPUTS.has(file);
}

function isGateInputForPlan(file, plan) {
  if (GATE_SELF_FILES.has(file)) {
    return true;
  }
  if (plan.versionChanged && VERSION_GATE_INPUTS.has(file)) {
    return true;
  }
  if (plan.rustChanged && isRustFormatInput(file)) {
    return true;
  }
  if (
    (plan.javascriptFiles.length > 0 || plan.packageFiles.length > 0) &&
    (plan.javascriptFiles.includes(file) || plan.packageFiles.includes(file))
  ) {
    return true;
  }
  if (plan.generatedTranslationsChanged && GENERATED_TRANSLATION_INPUTS.has(file)) {
    return true;
  }
  if (plan.languageContractsChanged && isLanguageContractInput(file)) {
    return true;
  }
  return false;
}

function assertGateInputsFullyStaged(git, plan) {
  const changed = [...unstagedFiles(git), ...untrackedFiles(git)];
  const offenders = [...new Set(changed.filter((file) => isGateInputForPlan(file, plan)))].sort();
  if (offenders.length === 0) {
    return;
  }

  throw new Error(
    `The pre-commit gate would read unstaged inputs: ${offenders.join(', ')}. ` +
      'Stage or split those files before committing so the gate validates the index content.'
  );
}

function assertVersionFilesFullyStaged(git) {
  for (const file of VERSION_FILES) {
    const result = git(['diff', '--quiet', '--', file]);
    if (result.error) {
      throw new Error(`Could not inspect unstaged version changes for ${file}: ${result.error.message}`);
    }
    if (result.status === 1) {
      throw new Error(
        `${file} 同时存在未暂存改动；请先明确暂存或拆分后再提交。`
      );
    }
    if (result.status !== 0) {
      throw new Error(`Could not inspect unstaged version changes for ${file}: ${commandDetail(result)}`);
    }
  }
}

function runChecked(spawn, command, args, cwd, label) {
  return requireSuccess(
    spawn(command, args, {
      cwd,
      stdio: 'inherit',
      windowsHide: true,
    }),
    label
  );
}

function checkStagedJavaScript({ root, plan, nodePath, spawn, fsApi }) {
  for (const file of plan.javascriptFiles) {
    if (!fsApi.existsSync(path.join(root, file))) {
      continue;
    }
    runChecked(spawn, nodePath, ['--check', file], root, `JavaScript syntax check for ${file}`);
  }

  for (const file of plan.packageFiles) {
    const filePath = path.join(root, file);
    if (!fsApi.existsSync(filePath)) {
      throw new Error(`Package metadata file is missing: ${file}`);
    }
    try {
      JSON.parse(fsApi.readFileSync(filePath, 'utf8'));
    } catch (error) {
      throw new Error(`Invalid JSON in ${file}: ${error.message}`);
    }
  }
}

function checkGeneratedTranslations({ root, nodePath, spawn, fsApi, osApi }) {
  const tempRoot = fsApi.mkdtempSync(path.join(osApi.tmpdir(), 'cavalry-i18n-pre-commit-'));
  const generatedPath = path.join(tempRoot, 'generated_translations.inc');
  const generatorPath = path.join(root, 'tools', 'generate_embedded_translations.js');
  const checkedInPath = path.join(root, 'injector', 'generated_translations.inc');

  try {
    runChecked(
      spawn,
      nodePath,
      [generatorPath, generatedPath],
      root,
      'Embedded translation table generation'
    );
    const generated = normalizeNewlines(fsApi.readFileSync(generatedPath, 'utf8'));
    const checkedIn = normalizeNewlines(fsApi.readFileSync(checkedInPath, 'utf8'));
    if (generated !== checkedIn) {
      throw new Error(
        'injector/generated_translations.inc 与 tools 翻译源不一致；请运行 node tools/generate_embedded_translations.js。'
      );
    }
  } finally {
    fsApi.rmSync(tempRoot, { recursive: true, force: true });
  }
}

function runLanguageContracts({ root, nodePath, spawn }) {
  runChecked(
    spawn,
    nodePath,
    ['--test', `--test-name-pattern=${LANGUAGE_TEST_PATTERN}`, 'tools/check_app_contracts.js'],
    root,
    'Language asset contract'
  );
}

function runPreCommit({
  cwd = process.cwd(),
  spawn = spawnSync,
  fsApi = fs,
  osApi = os,
  nodePath = process.execPath,
  gitCommand,
} = {}) {
  const resolvedGitCommand = gitCommand || resolveGitCommand({ spawn });
  const bootstrapGit = createGitRunner({
    cwd,
    spawn,
    gitCommand: resolvedGitCommand,
  });
  const root = path.resolve(
    gitText(bootstrapGit, ['rev-parse', '--show-toplevel'], 'Git worktree discovery').trim()
  );
  const git = createGitRunner({
    cwd: root,
    spawn,
    gitCommand: resolvedGitCommand,
  });
  let plan = buildGatePlan(stagedFiles(git));

  // 子进程 gate 读取工作区路径；拒绝 partial-staged 输入，避免修正后的工作区为旧 index 背书。
  assertGateInputsFullyStaged(git, plan);

  if (plan.versionChanged) {
    assertVersionFilesFullyStaged(git);
    runChecked(spawn, nodePath, ['tools/sync_project_version.js'], root, 'Version synchronization');
    requireSuccess(git(['add', ...VERSION_PROJECTION_FILES]), 'Version projection staging');
    plan = buildGatePlan(stagedFiles(git));
  }

  if (plan.rustChanged) {
    runChecked(
      spawn,
      'cargo',
      ['fmt', '--manifest-path', 'src-tauri/Cargo.toml', '--check'],
      root,
      'Rust formatting check'
    );
  }
  if (plan.javascriptFiles.length > 0 || plan.packageFiles.length > 0) {
    checkStagedJavaScript({ root, plan, nodePath, spawn, fsApi });
  }
  if (plan.generatedTranslationsChanged) {
    checkGeneratedTranslations({ root, nodePath, spawn, fsApi, osApi });
  }
  if (plan.languageContractsChanged) {
    runLanguageContracts({ root, nodePath, spawn });
  }

  return plan;
}

function main() {
  try {
    runPreCommit();
  } catch (error) {
    process.stderr.write(`pre-commit: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  GENERATED_TRANSLATION_INPUTS,
  LANGUAGE_CONTRACT_FILES,
  VERSION_FILES,
  VERSION_PROJECTION_FILES,
  assertGateInputsFullyStaged,
  assertVersionFilesFullyStaged,
  buildGatePlan,
  checkGeneratedTranslations,
  runPreCommit,
};
