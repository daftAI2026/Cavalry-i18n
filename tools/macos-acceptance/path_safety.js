/**
 * [INPUT]: 依赖 node:fs/path 的 lstat、realpath 与相对路径语义
 * [OUTPUT]: 对外提供 regular、directory、strictChild、strictRealChild、rejectInside 与 resolveNewSession 路径边界
 * [POS]: macos-acceptance 的纯文件系统安全层；在任何 chmod、rename 或 session 创建前统一消除 symlink/containment 歧义
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

function fail(message) {
  throw new Error(message);
}

function regular(file) {
  const stat = fs.lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink()) {
    fail(`Regular non-symlink file required: ${file}`);
  }
  return stat;
}

function directory(folder, label) {
  const stat = fs.lstatSync(folder);
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    fail(`${label} must be a non-symlink directory: ${folder}`);
  }
  return stat;
}

function strictChild(parent, child, label) {
  const relative = path.relative(path.resolve(parent), path.resolve(child));
  if (!relative || relative === '..' || relative.startsWith(`..${path.sep}`) ||
      path.isAbsolute(relative)) {
    fail(`${label} escaped ${path.resolve(parent)}`);
  }
}

function strictRealChild(parent, child, label) {
  const realParent = fs.realpathSync(parent);
  const realChild = fs.realpathSync(child);
  strictChild(realParent, realChild, label);
  return realChild;
}

function rejectInside(parent, child, label) {
  const relative = path.relative(path.resolve(parent), path.resolve(child));
  if (!relative || (!relative.startsWith(`..${path.sep}`) && relative !== '..' &&
      !path.isAbsolute(relative))) {
    fail(`${label} must stay outside ${path.resolve(parent)}`);
  }
}

function resolveNewSession(input, forbiddenRoots) {
  const requested = path.resolve(input);
  if (fs.existsSync(requested)) fail(`Session must be absent: ${requested}`);
  const parent = path.dirname(requested);
  directory(parent, 'Session parent');
  const session = path.join(fs.realpathSync(parent), path.basename(requested));
  if (fs.existsSync(session)) fail(`Session must be absent: ${session}`);
  for (const root of forbiddenRoots) {
    rejectInside(fs.realpathSync(root), session, 'Session directory');
  }
  return session;
}

module.exports = {
  directory,
  regular,
  rejectInside,
  resolveNewSession,
  strictChild,
  strictRealChild,
};
