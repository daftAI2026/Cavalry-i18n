#!/usr/bin/env node
/**
 * [INPUT]: 依赖 Node.js fs/os/path 与调用方提供的有限测试前缀
 * [OUTPUT]: 对外提供严格注册的测试临时目录创建与进程内清理能力
 * [POS]: tools 合同测试的 fixture 生命周期边界；只拥有本进程创建、直接位于 os.tmpdir 且前缀受控的目录
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const TEMP_ROOT = fs.realpathSync.native(os.tmpdir());
const ALLOWED_PREFIXES = Object.freeze([
  'cavalry-i18n-test-',
  'cavalry-version-sync-',
  'cavalry-windows-nsis-provenance-',
  'cavalry-hook-install-',
  'cavalry-release-changelog-',
]);
const ownedDirectories = new Map();

function isAllowedPrefix(prefix) {
  return ALLOWED_PREFIXES.includes(prefix);
}

function comparablePath(value) {
  const resolved = path.resolve(value);
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

function assertDirectTempChild(directory, prefix) {
  if (!isAllowedPrefix(prefix)) {
    throw new Error(`Unsupported test temporary directory prefix: ${prefix}`);
  }

  const resolved = path.resolve(directory);
  const relative = path.relative(TEMP_ROOT, resolved);
  if (
    !relative ||
    path.isAbsolute(relative) ||
    relative.includes(path.sep) ||
    relative.includes('/') ||
    relative.includes('\\') ||
    comparablePath(path.dirname(resolved)) !== comparablePath(TEMP_ROOT) ||
    !path.basename(resolved).startsWith(prefix)
  ) {
    throw new Error(`Test temporary directory escaped its owned TEMP child boundary: ${directory}`);
  }
}

function assertNoReparseTree(directory) {
  const pending = [directory];
  while (pending.length > 0) {
    const current = pending.pop();
    const stat = fs.lstatSync(current);
    if (stat.isSymbolicLink()) {
      throw new Error(`Refusing to clean a symlink/reparse test fixture: ${current}`);
    }

    const real = fs.realpathSync.native(current);
    if (comparablePath(real) !== comparablePath(current)) {
      throw new Error(`Refusing to clean a redirected test fixture: ${current}`);
    }

    if (stat.isDirectory()) {
      for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
        pending.push(path.join(current, entry.name));
      }
    }
  }
}

function makeTempDir(prefix = 'cavalry-i18n-test-') {
  if (!isAllowedPrefix(prefix)) {
    throw new Error(`Unsupported test temporary directory prefix: ${prefix}`);
  }

  const directory = fs.mkdtempSync(path.join(TEMP_ROOT, prefix));
  try {
    assertDirectTempChild(directory, prefix);
    const stat = fs.lstatSync(directory);
    if (!stat.isDirectory() || stat.isSymbolicLink()) {
      throw new Error(`Created test temporary path is not a regular directory: ${directory}`);
    }
    if (comparablePath(fs.realpathSync.native(directory)) !== comparablePath(directory)) {
      throw new Error(`Created test temporary directory is redirected: ${directory}`);
    }
    ownedDirectories.set(directory, prefix);
    return directory;
  } catch (error) {
    // The path was created by this process, but safety validation failed; clean only that exact path.
    try {
      assertDirectTempChild(directory, prefix);
      const stat = fs.lstatSync(directory);
      if (
        !stat.isSymbolicLink() &&
        stat.isDirectory() &&
        comparablePath(fs.realpathSync.native(directory)) === comparablePath(directory)
      ) {
        fs.rmSync(directory, { recursive: true, force: true });
      }
    } catch {
      // Preserve the original validation error; never broaden cleanup to a directory scan.
    }
    throw error;
  }
}

function cleanupTempDirs() {
  for (const [directory, prefix] of [...ownedDirectories].reverse()) {
    ownedDirectories.delete(directory);
    try {
      assertDirectTempChild(directory, prefix);
      assertNoReparseTree(directory);
      fs.rmSync(directory, { recursive: true, force: true });
    } catch (error) {
      if (error.code === 'ENOENT') continue;
      process.emitWarning(`Skipped unsafe test temporary directory cleanup: ${directory} (${error.message})`);
    }
  }
}

module.exports = { ALLOWED_PREFIXES, cleanupTempDirs, makeTempDir };
