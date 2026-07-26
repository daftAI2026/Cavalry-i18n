#!/usr/bin/env node
/**
 * [INPUT]: 依赖 process.env.PYTHON/LOCALAPPDATA、当前操作系统与 node:child_process 的无 shell进程启动能力
 * [OUTPUT]: 对外提供 resolvePythonCommand 与 spawnPythonSync，统一解析 PATH 或 Windows 用户级 Launcher 中的 Python 3
 * [POS]: tools 的跨平台 Python 命令边界，隔离 Codex/IDE 继承旧 PATH 与 Windows Store 假别名造成的解释器误判
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

const { spawnSync } = require('node:child_process');
const path = require('node:path');

let cachedDefaultCommand = null;

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

function resolvePythonCommand({
  env = process.env,
  platform = process.platform,
  spawn = spawnSync,
} = {}) {
  const explicitCommand = stripWrappingQuotes(env.PYTHON);
  if (explicitCommand) {
    return { command: explicitCommand, args: [] };
  }

  const candidates = [];
  if (platform === 'win32') {
    if (env.LOCALAPPDATA) {
      candidates.push({
        command: path.join(
          env.LOCALAPPDATA,
          'Programs',
          'Python',
          'Launcher',
          'py.exe'
        ),
        args: ['-3'],
      });
    }
    candidates.push(
      { command: 'py', args: ['-3'] },
      { command: 'python', args: [] }
    );
  } else {
    candidates.push({ command: 'python3', args: [] });
  }

  for (const candidate of candidates) {
    const probe = spawn(candidate.command, [...candidate.args, '-c', 'import sys'], {
      encoding: 'utf8',
      stdio: 'ignore',
      windowsHide: true,
    });
    if (probe.status === 0) {
      return candidate;
    }
  }

  const platformHint =
    platform === 'win32'
      ? '用户级 Python Launcher、py -3 或 python'
      : 'python3';
  throw new Error(`找不到 Python 3（已尝试 ${platformHint}）。请安装 Python 3，或通过 PYTHON 指定解释器路径。`);
}

function defaultPythonCommand() {
  if (!cachedDefaultCommand) {
    cachedDefaultCommand = resolvePythonCommand();
  }
  return cachedDefaultCommand;
}

function spawnPythonSync(args, options = {}) {
  const python = defaultPythonCommand();
  return spawnSync(python.command, [...python.args, ...args], {
    windowsHide: true,
    ...options,
  });
}

module.exports = {
  resolvePythonCommand,
  spawnPythonSync,
  stripWrappingQuotes,
};
