/**
 * [INPUT]: 依赖 node fs/path 与 codesign 验证命令，读取 Cavalry JSON 资产和插件目录
 * [OUTPUT]: 对外提供 CORE_MAP、extractEnglish、discoverPlugins、buildCopyPairs、stageFiles、verifyCodeSignature
 * [POS]: desktop-patcher/lib 的文件映射模块，被 Electron 与 Tauri 等价实现共同对照
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const CORE_MAP = [
  { file: 'nodeStrings.json', subdir: 'Definitions' },
  { file: 'appStrings.json', subdir: 'Definitions' },
  { file: 'tips.json', subdir: 'Learn' },
  { file: 'onboarding.json', subdir: 'Learn' },
];

function getAssetsRoot(appPath) {
  return path.join(appPath, 'Contents', 'assets');
}

function toCamelCase(name) {
  const words = name
    .split(/\s+/)
    .map((word) => word.trim())
    .filter(Boolean);

  if (words.length === 0) {
    return '';
  }

  return [
    words[0].charAt(0).toLowerCase() + words[0].slice(1),
    ...words.slice(1).map((word) => word.charAt(0).toUpperCase() + word.slice(1)),
  ].join('');
}

function discoverPlugins(appPath) {
  const pluginsDir = path.join(getAssetsRoot(appPath), 'Plugins');
  if (!fs.existsSync(pluginsDir)) {
    return [];
  }

  return fs
    .readdirSync(pluginsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .filter((entry) => fs.existsSync(path.join(pluginsDir, entry.name, 'strings.json')))
    .map((entry) => ({
      folderName: entry.name,
      camelName: toCamelCase(entry.name),
    }))
    .sort((left, right) => left.folderName.localeCompare(right.folderName));
}

function extractEnglish(appPath, outputDir) {
  const assetsRoot = getAssetsRoot(appPath);
  fs.rmSync(outputDir, { recursive: true, force: true });
  fs.mkdirSync(outputDir, { recursive: true });

  let copiedCount = 0;
  for (const { file, subdir } of CORE_MAP) {
    fs.copyFileSync(path.join(assetsRoot, subdir, file), path.join(outputDir, file));
    copiedCount += 1;
  }

  const pluginsOutputDir = path.join(outputDir, 'plugins');
  fs.mkdirSync(pluginsOutputDir, { recursive: true });

  for (const { folderName, camelName } of discoverPlugins(appPath)) {
    fs.copyFileSync(
      path.join(assetsRoot, 'Plugins', folderName, 'strings.json'),
      path.join(pluginsOutputDir, `${camelName}.json`)
    );
    copiedCount += 1;
  }

  return copiedCount;
}

function buildCopyPairs(sourceDir, appPath) {
  const assetsRoot = getAssetsRoot(appPath);
  const pairs = [];

  for (const { file, subdir } of CORE_MAP) {
    const sourcePath = path.join(sourceDir, file);
    if (fs.existsSync(sourcePath)) {
      pairs.push({
        src: sourcePath,
        dst: path.join(assetsRoot, subdir, file),
      });
    }
  }

  for (const { folderName, camelName } of discoverPlugins(appPath)) {
    const sourcePath = path.join(sourceDir, 'plugins', `${camelName}.json`);
    if (fs.existsSync(sourcePath)) {
      pairs.push({
        src: sourcePath,
        dst: path.join(assetsRoot, 'Plugins', folderName, 'strings.json'),
      });
    }
  }

  return pairs;
}

function stageFiles(pairs, stagingDir) {
  fs.rmSync(stagingDir, { recursive: true, force: true });
  fs.mkdirSync(stagingDir, { recursive: true });

  return pairs.map(({ src, dst }, index) => {
    const stagedPath = path.join(stagingDir, `${index}-${path.basename(src)}`);
    fs.copyFileSync(src, stagedPath);
    fs.chmodSync(stagedPath, fs.statSync(src).mode);
    return { src: stagedPath, dst };
  });
}

function verifyCodeSignature(appPath) {
  if (process.platform !== 'darwin') {
    return { ok: true, message: '' };
  }

  const result = spawnSync('codesign', ['--verify', '--deep', '--strict', appPath], {
    encoding: 'utf8',
  });
  if (result.status === 0) {
    return { ok: true, message: '' };
  }

  const detail = (result.stderr || result.stdout || '').trim();
  return {
    ok: false,
    message: detail
      ? `macOS code-signature verification reported a warning: ${detail}`
      : 'macOS code-signature verification reported a warning after patching.',
  };
}

module.exports = {
  CORE_MAP,
  buildCopyPairs,
  discoverPlugins,
  extractEnglish,
  stageFiles,
  toCamelCase,
  verifyCodeSignature,
};
