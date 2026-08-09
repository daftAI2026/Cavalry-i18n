#!/usr/bin/env node
/**
 * [INPUT]: 依赖 release commit、producer scope/target、tools/ci_action_pins.json、rust-toolchain.toml、requirements-ci.in/txt、npm_command.js 与当前 producer 工具输出版本
 * [OUTPUT]: fail-closed 写出单 producer ToolchainEvidenceRecord；任一版本命令失败/空输出即拒绝，且不记录任何 secret 值
 * [POS]: tools 的 CI/本地 producer toolchain 证据记录器；release 聚合由 create_toolchain_evidence_bundle.js 负责
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { resolveNpmVersionCommand } = require('./npm_command.js');

const rootDir = process.cwd();
const args = process.argv.slice(2);

function optionValue(name) {
  const index = args.indexOf(name);
  if (index === -1) return null;
  const value = args[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`${name} requires a value.`);
  }
  return value;
}

function readText(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

function readJson(relativePath) {
  return JSON.parse(readText(relativePath));
}

function capture(label, command, commandArgs, spawnOptions = {}) {
  const result = spawnSync(command, commandArgs, {
    encoding: 'utf8',
    cwd: rootDir,
    env: process.env,
    windowsHide: true,
    ...spawnOptions,
  });
  if (result.error || result.status !== 0) {
    const detail = result.error?.message || (result.stderr || result.stdout || '').trim() || `status ${result.status}`;
    throw new Error(`Could not capture required ${label} toolchain identity: ${detail}`);
  }
  const stdout = (result.stdout || '').trim();
  if (!stdout) {
    throw new Error(`Required ${label} toolchain identity returned empty output.`);
  }
  return {
    command: [command, ...commandArgs].join(' '),
    status: result.status,
    stdout,
    stderr: (result.stderr || '').trim(),
  };
}

function main() {
  const pins = readJson('tools/ci_action_pins.json');
  const rustToolchain = readText('rust-toolchain.toml');
  const requirementsInput = readText('requirements-ci.in');
  const requirements = readText('requirements-ci.txt');
  const outPath = path.resolve(
    optionValue('--output') || path.join(rootDir, 'toolchain-evidence.json')
  );
  const commitSha = optionValue('--commit') || process.env.GITHUB_SHA || '';
  if (!/^[a-f0-9]{40}$/.test(commitSha)) {
    throw new Error('--commit/GITHUB_SHA must be a lowercase 40-character SHA.');
  }
  const scope = optionValue('--scope');
  const target = optionValue('--target');
  if (!scope || !/^[a-z0-9][a-z0-9-]{0,63}$/.test(scope)) throw new Error('--scope is required and must be a stable lowercase identifier.');
  if (!target || !/^[A-Za-z0-9_.-]{1,128}$/.test(target)) throw new Error('--target is required and must be a stable target identifier.');
  const createdAtUtc = optionValue('--created-at') || new Date().toISOString();
  if (!Number.isFinite(Date.parse(createdAtUtc))) {
    throw new Error('--created-at must be an ISO-compatible timestamp.');
  }

  const npmInvocation = resolveNpmVersionCommand();
  const evidence = {
    schemaVersion: 1,
    kind: 'ToolchainEvidenceRecord',
    createdAtUtc,
    commitSha,
    scope,
    target,
    runner: {
      os: process.platform,
      arch: process.arch,
      runnerOs: process.env.RUNNER_OS || null,
      runnerArch: process.env.RUNNER_ARCH || null,
      imageOs: process.env.ImageOS || null,
      imageVersion: process.env.ImageVersion || null,
      githubJob: process.env.GITHUB_JOB || null,
    },
    pins,
    files: {
      'rust-toolchain.toml': rustToolchain.trim(),
      'requirements-ci.in': requirementsInput.trim(),
      'requirements-ci.txt': requirements
        .split(/\r?\n/)
        .filter((line) => line && !line.startsWith('#'))
        .join('\n'),
    },
    runtime: {
      node: capture('node', process.execPath, ['--version']),
      npm: capture('npm', npmInvocation.command, npmInvocation.args, { shell: npmInvocation.shell }),
      rustc: capture('rustc', 'rustc', ['--version']),
      cargo: capture('cargo', 'cargo', ['--version']),
      python: capture('python', process.env.PYTHON || 'python3', ['--version']),
    },
    envRefs: {
      // Names only — never values. Secrets must stay in Actions secrets.
      appleSigningSecretNames: [
        'APPLE_CERTIFICATE',
        'APPLE_CERTIFICATE_PASSWORD',
        'APPLE_SIGNING_IDENTITY',
        'APPLE_ID',
        'APPLE_APP_SPECIFIC_PASSWORD',
        'APPLE_TEAM_ID',
      ],
    },
  };

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(evidence, null, 2)}\n`, { flag: 'wx', mode: 0o444 });
  console.log(`[record-toolchain-evidence] wrote ${outPath}`);
}

try {
  main();
} catch (error) {
  console.error(`[record-toolchain-evidence] ${error.message}`);
  process.exit(1);
}
