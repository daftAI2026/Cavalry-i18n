#!/usr/bin/env node
/**
 * [INPUT]: 依赖 resolve_windows_cmake.js 产生的已验证 identity、tools/ci_action_pins.json、commit/target 与 Windows runner 的 Node/npm/Rust/Python/CMake 版本命令
 * [OUTPUT]: 对外提供单份 Windows x64 producer toolchain evidence，绑定 CMake 版本、官方 archive 来源/SHA-256、实际命令输出与其余构建宿主身份；任何空洞或漂移都 fail-closed
 * [POS]: tools 的 Windows producer 证据记录器；在双 DLL 构建成功后运行并上传，补足 release 之外可追溯的 Windows 构建来源，不实现 Authenticode
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { resolveNpmVersionCommand } = require('./npm_command.js');
const { resolvePythonCommand } = require('./python_command.js');
const {
  readCmakePin,
  validateCmakePin,
  validateCmakeVersion,
} = require('./resolve_windows_cmake.js');

const repoRoot = path.resolve(__dirname, '..');
const args = process.argv.slice(2);

function fail(message) {
  throw new Error(message);
}

function optionValue(name) {
  const index = args.indexOf(name);
  if (index === -1) return null;
  const value = args[index + 1];
  if (!value || value.startsWith('--')) fail(`${name} requires a value.`);
  return value;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, ''));
}

function sha256File(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function regularFile(filePath, label) {
  let stat;
  try {
    stat = fs.lstatSync(filePath);
  } catch (error) {
    fail(`Required ${label} is missing: ${filePath}.`);
  }
  if (!stat.isFile() || stat.isSymbolicLink()) fail(`Required ${label} must be a regular file: ${filePath}.`);
  return stat;
}

function assertExpectedPath(actualPath, expectedPath, label) {
  if (typeof actualPath !== 'string' || !actualPath.trim()) {
    fail(`Windows CMake identity is missing its ${label} path.`);
  }
  const actual = path.resolve(actualPath);
  const expected = path.resolve(expectedPath);
  const same = process.platform === 'win32'
    ? actual.toLowerCase() === expected.toLowerCase()
    : actual === expected;
  if (!same) fail(`Windows CMake identity ${label} must be the resolver cache path ${expected}.`);
  return actual;
}

function capture(label, command, commandArgs, spawnOptions = {}) {
  const result = spawnSync(command, commandArgs, {
    encoding: 'utf8',
    cwd: repoRoot,
    windowsHide: true,
    ...spawnOptions,
  });
  if (result.error || result.status !== 0) {
    const detail = result.error?.message || (result.stderr || result.stdout || '').trim() || `status ${result.status}`;
    fail(`Could not capture required ${label} toolchain identity: ${detail}`);
  }
  const stdout = (result.stdout || '').trim();
  if (!stdout) fail(`Required ${label} toolchain identity returned empty output.`);
  return {
    command: [command, ...commandArgs].join(' '),
    status: result.status,
    stdout,
    stderr: (result.stderr || '').trim(),
  };
}

function validateCmakeIdentity(identity, pin = readCmakePin()) {
  if (!identity || typeof identity !== 'object' || Array.isArray(identity)) fail('CMake identity must be an object.');
  if (identity.schemaVersion !== 1 || identity.kind !== 'WindowsCMakeToolchainIdentity') {
    fail('Unsupported Windows CMake identity schema.');
  }
  validateCmakePin(pin);
  if (identity.platform !== pin.platform || identity.architecture !== 'x86_64') {
    fail('Windows CMake identity has the wrong platform or architecture.');
  }
  if (identity.version !== pin.version || identity.minimumVersion !== pin.minimumVersion) {
    fail(`Windows CMake identity must report pinned CMake ${pin.version}.`);
  }
  if (!identity.source || typeof identity.source !== 'object' ||
      identity.source.repository !== 'Kitware/CMake' ||
      identity.source.releaseTag !== `v${pin.version}` ||
      identity.source.releaseUrl !== pin.releaseUrl ||
      identity.source.archive !== pin.archive ||
      identity.source.url !== pin.url ||
      identity.source.sha256 !== pin.sha256 ||
      identity.archiveSha256 !== pin.sha256) {
    fail('Windows CMake identity source does not match the pinned official archive.');
  }
  if (validateCmakeVersion(identity.versionOutput, pin.minimumVersion) !== identity.version) {
    fail(`Windows CMake identity output does not report pinned CMake ${pin.version}.`);
  }
  const cacheRoot = path.join(repoRoot, 'build', '.toolchain', 'cmake');
  const archivePath = assertExpectedPath(
    identity.archivePath,
    path.join(cacheRoot, 'archives', pin.archive),
    'archive'
  );
  const executablePath = assertExpectedPath(
    identity.executable,
    path.join(cacheRoot, pin.version, pin.executable),
    'executable'
  );
  const ctestPath = assertExpectedPath(
    identity.ctest,
    path.join(cacheRoot, pin.version, pin.ctest),
    'CTest executable'
  );
  regularFile(archivePath, 'pinned CMake archive');
  if (sha256File(archivePath) !== pin.sha256) {
    fail('Windows CMake identity archive no longer matches the pinned SHA-256.');
  }
  regularFile(executablePath, 'pinned CMake executable');
  regularFile(ctestPath, 'pinned CTest executable');
  return {
    ...identity,
    archivePath,
    executable: executablePath,
    ctest: ctestPath,
  };
}

function main() {
  const commitSha = (optionValue('--commit') || process.env.GITHUB_SHA || '').toLowerCase();
  if (!/^[a-f0-9]{40}$/.test(commitSha)) fail('--commit/GITHUB_SHA must be a lowercase 40-character SHA.');
  const createdAtUtc = optionValue('--created-at') || new Date().toISOString();
  if (!Number.isFinite(Date.parse(createdAtUtc))) fail('--created-at must be an ISO-compatible timestamp.');
  const target = optionValue('--target') || 'x86_64-pc-windows-msvc';
  if (target !== 'x86_64-pc-windows-msvc') fail('--target must be x86_64-pc-windows-msvc.');
  const identityPath = optionValue('--cmake-identity');
  if (!identityPath) fail('--cmake-identity is required.');
  const outputPath = path.resolve(optionValue('--output') || path.join(repoRoot, 'windows-toolchain-evidence.json'));
  const identity = validateCmakeIdentity(readJson(path.resolve(identityPath)));
  const cmake = capture('CMake', identity.executable, ['--version']);
  const cmakeVersion = validateCmakeVersion(cmake.stdout, identity.minimumVersion);
  if (cmakeVersion !== identity.version) fail(`CMake executable reported ${cmakeVersion}, expected ${identity.version}.`);

  const npmInvocation = resolveNpmVersionCommand();
  const pythonInvocation = resolvePythonCommand();
  const evidence = {
    schemaVersion: 1,
    kind: 'WindowsToolchainEvidenceRecord',
    createdAtUtc,
    commitSha,
    scope: 'windows-x64',
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
    pins: readJson(path.join(repoRoot, 'tools', 'ci_action_pins.json')),
    cmake: {
      version: cmakeVersion,
      minimumVersion: identity.minimumVersion,
      executable: identity.executable,
      ctest: identity.ctest,
      command: cmake.command,
      status: cmake.status,
      stdout: cmake.stdout,
      stderr: cmake.stderr,
      source: identity.source,
      archivePath: identity.archivePath,
      archiveSha256: identity.archiveSha256,
    },
    runtime: {
      node: capture('node', process.execPath, ['--version']),
      npm: capture('npm', npmInvocation.command, npmInvocation.args, { shell: npmInvocation.shell }),
      rustc: capture('rustc', 'rustc', ['--version']),
      cargo: capture('cargo', 'cargo', ['--version']),
      python: capture('python', pythonInvocation.command, [...pythonInvocation.args, '--version']),
    },
    source: {
      pinManifest: 'tools/ci_action_pins.json',
      cmakeRelease: identity.source.releaseUrl,
    },
  };

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`, { flag: 'wx', mode: 0o444 });
  process.stdout.write(`[record-windows-toolchain-evidence] wrote ${outputPath}\n`);
}

try {
  main();
} catch (error) {
  process.stderr.write(`[record-windows-toolchain-evidence] ${error.stack || error.message}\n`);
  process.exitCode = 1;
}

module.exports = {
  capture,
  validateCmakeIdentity,
};
