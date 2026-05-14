#!/usr/bin/env node
/**
 * [INPUT]: 依赖 CHANGELOG.md、package.json、package-lock.json、src-tauri/Cargo.toml、src-tauri/tauri.conf.json 与 src-tauri/Cargo.lock
 * [OUTPUT]: 对外提供项目版本同步器，将 CHANGELOG 最新正式版本同步到 npm、Cargo 与 Tauri 元数据，支持 --check
 * [POS]: tools 的发布版本真相源闸门，消除桌面包版本在 JS/Rust/Tauri 三层之间的漂移
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

const fs = require('node:fs');
const path = require('node:path');

const rootDir = process.cwd();
const isCheckMode = process.argv.includes('--check');
const projectPackageName = 'cavalry-i18n-tauri';

function readText(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

function writeText(relativePath, source) {
  fs.writeFileSync(path.join(rootDir, relativePath), source);
}

function readJson(relativePath) {
  return JSON.parse(readText(relativePath));
}

function stableJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function latestChangelogVersion() {
  const match = readText('CHANGELOG.md').match(/^## \[(\d+\.\d+\.\d+)\]/m);
  if (!match) {
    throw new Error('CHANGELOG.md has no released version header (expected ## [x.x.x]).');
  }
  return match[1];
}

function syncPackageJson(version) {
  const packageJson = readJson('package.json');
  packageJson.version = version;
  return ['package.json', stableJson(packageJson)];
}

function syncPackageLock(version) {
  const packageLock = readJson('package-lock.json');
  packageLock.version = version;
  if (packageLock.packages && packageLock.packages['']) {
    packageLock.packages[''].version = version;
  }
  return ['package-lock.json', stableJson(packageLock)];
}

function replacePackageVersion(source, fileLabel, version) {
  const packageBlockPattern = /(\[package\][\s\S]*?\nversion\s*=\s*")([^"]+)(")/;
  if (!packageBlockPattern.test(source)) {
    throw new Error(`${fileLabel} has no [package] version field.`);
  }
  return source.replace(packageBlockPattern, `$1${version}$3`);
}

function syncCargoToml(version) {
  return ['src-tauri/Cargo.toml', replacePackageVersion(readText('src-tauri/Cargo.toml'), 'Cargo.toml', version)];
}

function syncTauriConfig(version) {
  const config = readJson('src-tauri/tauri.conf.json');
  config.version = version;
  return ['src-tauri/tauri.conf.json', stableJson(config)];
}

function syncCargoLock(version) {
  const source = readText('src-tauri/Cargo.lock');
  const packagePattern = new RegExp(`(\\[\\[package\\]\\]\\nname = "${projectPackageName}"\\nversion = ")([^"]+)(")`);
  if (!packagePattern.test(source)) {
    throw new Error(`Cargo.lock has no ${projectPackageName} package entry.`);
  }
  return ['src-tauri/Cargo.lock', source.replace(packagePattern, `$1${version}$3`)];
}

function buildTargets(version) {
  return [
    syncPackageJson(version),
    syncPackageLock(version),
    syncCargoToml(version),
    syncTauriConfig(version),
    syncCargoLock(version),
  ];
}

function main() {
  const version = latestChangelogVersion();
  const targets = buildTargets(version);
  const changed = targets.filter(([relativePath, nextSource]) => readText(relativePath) !== nextSource);

  if (isCheckMode) {
    if (changed.length > 0) {
      throw new Error(`Version metadata out of sync with ${version}: ${changed.map(([relativePath]) => relativePath).join(', ')}`);
    }
    console.log(`[sync-project-version] OK: metadata matches ${version}`);
    return;
  }

  for (const [relativePath, nextSource] of changed) writeText(relativePath, nextSource);
  const names = changed.map(([relativePath]) => relativePath).join(', ') || 'nothing';
  console.log(`[sync-project-version] Synced ${names} to ${version}`);
}

try {
  main();
} catch (error) {
  console.error(`[sync-project-version] ${error.message}`);
  process.exit(1);
}
