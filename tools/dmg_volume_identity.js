#!/usr/bin/env node
/**
 * [INPUT]: 依赖 package.json 的 Switcher SemVer 与 Tauri 生成的 macOS DMG 文件名架构后缀
 * [OUTPUT]: 对外提供 createDmgVolumeName/readProjectVersion/resolveDmgArchitecture，并以 CLI 输出唯一挂载卷标
 * [POS]: tools 的 DMG 身份真相源，由卷标 producer 与真实挂载 verifier 共同消费，隔离发布文件名和临时卷宗标题
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');
const PRODUCT_VOLUME_NAME = 'Cavalry Switcher';
const ARCHITECTURE_LABELS = Object.freeze({
  aarch64: 'arm64',
  arm64: 'arm64',
  x86_64: 'x64',
  x64: 'x64',
});

function readProjectVersion(packagePath = path.join(repoRoot, 'package.json')) {
  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  const version = packageJson.version;
  if (typeof version !== 'string' || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
    throw new Error(`Invalid Switcher version in ${packagePath}`);
  }
  return version;
}

function resolveDmgArchitecture(dmgPath) {
  const fileName = path.basename(dmgPath);
  const match = fileName.match(/(?:^|[_-])(aarch64|arm64|x86_64|x64)\.dmg$/i);
  if (!match) {
    throw new Error(`DMG filename does not end in a supported macOS architecture: ${fileName}`);
  }
  return ARCHITECTURE_LABELS[match[1].toLowerCase()];
}

function createDmgVolumeName(dmgPath, options = {}) {
  const version = options.version || readProjectVersion(options.packagePath);
  const architecture = options.architecture || resolveDmgArchitecture(dmgPath);
  return `${PRODUCT_VOLUME_NAME} ${version} ${architecture}`;
}

function parseDmgArgument(argv) {
  const index = argv.indexOf('--dmg');
  if (index === -1 || !argv[index + 1] || argv[index + 1].startsWith('--')) {
    throw new Error('Usage: node tools/dmg_volume_identity.js --dmg <path>');
  }
  return argv[index + 1];
}

if (require.main === module) {
  try {
    process.stdout.write(`${createDmgVolumeName(parseDmgArgument(process.argv.slice(2)))}\n`);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  createDmgVolumeName,
  readProjectVersion,
  resolveDmgArchitecture,
};
