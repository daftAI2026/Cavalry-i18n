/**
 * [INPUT]: 依赖 node fs/os/path 与 PlistBuddy 读取 Cavalry.app 候选路径和版本信息
 * [OUTPUT]: 对外提供 findCavalryApp、getDefaultAppCandidates、inspectBundle、listLanguageOptions、readBundleVersion
 * [POS]: desktop-patcher/lib 的探测模块，被 i18n-handlers 用于状态解析和界面诊断
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

function getDefaultAppCandidates() {
  return [
    '/Applications/Cavalry.app',
    path.join(os.homedir(), 'Applications', 'Cavalry.app'),
  ];
}

function findCavalryApp(stateAppPath) {
  const candidates = stateAppPath
    ? [stateAppPath, ...getDefaultAppCandidates()]
    : getDefaultAppCandidates();

  return candidates.find((candidate) => fs.existsSync(candidate)) || '';
}

function readBundleVersion(appPath) {
  if (!appPath || process.platform !== 'darwin') {
    return '';
  }

  const plistBuddy = '/usr/libexec/PlistBuddy';
  const infoPlist = path.join(appPath, 'Contents', 'Info.plist');
  if (!fs.existsSync(plistBuddy) || !fs.existsSync(infoPlist)) {
    return '';
  }

  const result = spawnSync(
    plistBuddy,
    ['-c', 'Print :CFBundleShortVersionString', infoPlist],
    { encoding: 'utf8' }
  );

  return result.status === 0 ? result.stdout.trim() : '';
}

function listLanguageOptions(languagesDir) {
  if (!fs.existsSync(languagesDir)) {
    return [];
  }

  return fs
    .readdirSync(languagesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name !== 'en' && !entry.name.startsWith('.'))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));
}

function inspectBundle(appPath) {
  const contents = path.join(appPath, 'Contents');
  const assetsRoot = path.join(contents, 'assets');

  return {
    exists: Boolean(appPath) && fs.existsSync(appPath),
    appPath,
    version: readBundleVersion(appPath),
    hasAssetsRoot: fs.existsSync(assetsRoot),
    hasDefinitions: fs.existsSync(path.join(assetsRoot, 'Definitions')),
    hasLearn: fs.existsSync(path.join(assetsRoot, 'Learn')),
    hasPlugins: fs.existsSync(path.join(assetsRoot, 'Plugins')),
  };
}

module.exports = {
  findCavalryApp,
  getDefaultAppCandidates,
  inspectBundle,
  listLanguageOptions,
  readBundleVersion,
};
