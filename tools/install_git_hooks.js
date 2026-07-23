#!/usr/bin/env node
/**
 * [INPUT]: 依赖当前 Git 工作树、GIT/ProgramFiles 环境与 tools/git-hooks，使用 node:child_process 无 shell 调用 Git
 * [OUTPUT]: 对外提供 installGitHooks，并把当前 Node 绝对路径与 hook 目录写入仓库级 Git 配置
 * [POS]: tools 的开发环境初始化边界，让 Git hook 不依赖每台机器不同的 Node 安装目录或继承 PATH
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

function stripWrappingQuotes(value) {
  const trimmed = String(value || '').trim();
  if (trimmed.length >= 2) {
    const first = trimmed[0];
    const last = trimmed[trimmed.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return trimmed.slice(1, -1);
    }
  }
  return trimmed;
}

function resolveGitCommand({
  env = process.env,
  platform = process.platform,
  spawn = spawnSync,
  exists = fs.existsSync,
} = {}) {
  const pathApi = platform === 'win32' ? path.win32 : path;
  const explicit = stripWrappingQuotes(env.GIT);
  const candidates = explicit ? [explicit] : ['git'];

  if (!explicit && platform === 'win32') {
    for (const root of [
      env.ProgramW6432,
      env.ProgramFiles,
      env['ProgramFiles(x86)'],
      env.LOCALAPPDATA && pathApi.join(env.LOCALAPPDATA, 'Programs'),
    ]) {
      if (root) {
        candidates.push(pathApi.join(root, 'Git', 'cmd', 'git.exe'));
      }
    }
  }

  const seen = new Set();
  for (const command of candidates) {
    const key = platform === 'win32' ? command.toLowerCase() : command;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    if (pathApi.isAbsolute(command) && !exists(command)) {
      continue;
    }
    const probe = spawn(command, ['--version'], {
      encoding: 'utf8',
      stdio: 'ignore',
      windowsHide: true,
    });
    if (probe.status === 0) {
      return command;
    }
  }

  throw new Error(
    '找不到 Git。请安装 Git、将 git 加入 PATH，或通过 GIT 指定 git 可执行文件。'
  );
}

function runGit(command, args, cwd, spawn) {
  return spawn(command, args, {
    cwd,
    encoding: 'utf8',
    windowsHide: true,
  });
}

function installGitHooks({
  cwd = process.cwd(),
  nodePath = process.execPath,
  env = process.env,
  platform = process.platform,
  exists = fs.existsSync,
  spawn = spawnSync,
} = {}) {
  let gitCommand;
  try {
    gitCommand = resolveGitCommand({ env, platform, spawn, exists });
  } catch (error) {
    return {
      installed: false,
      reason: 'git-unavailable',
      detail: error instanceof Error ? error.message : String(error),
    };
  }

  const probe = runGit(
    gitCommand,
    ['rev-parse', '--is-inside-work-tree'],
    cwd,
    spawn
  );
  if (probe.status !== 0 || String(probe.stdout || '').trim() !== 'true') {
    return { installed: false, reason: 'not-a-git-worktree' };
  }

  const configure = runGit(
    gitCommand,
    ['config', 'core.hooksPath', 'tools/git-hooks'],
    cwd,
    spawn
  );
  if (configure.status !== 0) {
    return {
      installed: false,
      reason: 'git-config-failed',
      detail: String(configure.stderr || configure.error?.message || '').trim(),
    };
  }

  const configureNode = runGit(
    gitCommand,
    ['config', 'cavalry-i18n.nodePath', nodePath],
    cwd,
    spawn
  );
  if (configureNode.status !== 0) {
    return {
      installed: false,
      reason: 'git-node-path-config-failed',
      detail: String(
        configureNode.stderr || configureNode.error?.message || ''
      ).trim(),
    };
  }

  return { installed: true, reason: 'configured' };
}

function main() {
  const result = installGitHooks();
  if (result.installed) {
    process.stdout.write('[install-git-hooks] configured tools/git-hooks\n');
    return;
  }

  const detail = result.detail ? `: ${result.detail}` : '';
  process.stderr.write(`[install-git-hooks] skipped (${result.reason})${detail}\n`);
}

if (require.main === module) {
  main();
}

module.exports = {
  installGitHooks,
  resolveGitCommand,
  stripWrappingQuotes,
};
