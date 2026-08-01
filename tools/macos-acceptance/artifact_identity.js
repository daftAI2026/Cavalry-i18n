/**
 * [INPUT]: 依赖 node:fs/crypto/child_process 与 path_safety 的 regular 文件边界，以及 macOS lipo/dwarfdump/codesign
 * [OUTPUT]: 对外提供 sha256、identity、freezeIdentity、verifyIdentity 与 binaryIdentity 不可变身份原语
 * [POS]: macos-acceptance 的证据身份层；统一源码、记录、截图和 Mach-O 的 hash/bytes/arch/signature 语义
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
'use strict';

const fs = require('node:fs');
const crypto = require('node:crypto');
const cp = require('node:child_process');
const { regular } = require('./path_safety');

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function identity(file) {
  regular(file);
  const stat = fs.statSync(file);
  return { path: file, bytes: stat.size, sha256: sha256(file), dev: stat.dev, ino: stat.ino };
}

function freezeIdentity(file) {
  regular(file);
  fs.chmodSync(file, 0o444);
  return identity(file);
}

function verifyIdentity(expected, label) {
  const current = identity(expected.path);
  if (current.sha256 !== expected.sha256 || current.bytes !== expected.bytes) {
    throw new Error(`${label} drifted: ${expected.path}`);
  }
  return current;
}

function binaryIdentity(file) {
  const base = identity(file);
  const arch = cp.spawnSync('/usr/bin/lipo', ['-archs', file], { encoding: 'utf8' });
  const uuid = cp.spawnSync('/usr/bin/dwarfdump', ['--uuid', file], { encoding: 'utf8' });
  const sign = cp.spawnSync('/usr/bin/codesign', ['-dvv', file], { encoding: 'utf8' });
  return {
    ...base,
    arch: arch.status === 0 ? arch.stdout.trim() : null,
    uuid: uuid.status === 0 ? uuid.stdout.trim() : null,
    cdHash: (sign.stderr.match(/CDHash=([^\s]+)/) || [])[1] || null,
  };
}

module.exports = { binaryIdentity, freezeIdentity, identity, sha256, verifyIdentity };
