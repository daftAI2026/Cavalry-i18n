/**
 * [INPUT]: 依赖 node fs/path，在临时目录中写入最小 Cavalry.app 文件树
 * [OUTPUT]: 对外提供 makeFakeCavalryBundle，用于 Tauri contract tests 生成无副作用 fixture
 * [POS]: tools/fixtures 的测试数据工厂，被 handler snapshot 与后续迁移测试复用
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
const fs = require('node:fs');
const path = require('node:path');

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function writeText(filePath, value, options = {}) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, value, options);
}

function writeMachO(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, Buffer.from([0xcf, 0xfa, 0xed, 0xfe, 0x00, 0x00, 0x00, 0x0c]));
  fs.chmodSync(filePath, 0o755);
}

function makeInfoPlist(version) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleExecutable</key>
  <string>Cavalry</string>
  <key>CFBundleIdentifier</key>
  <string>co.scenegroup.cavalry</string>
  <key>CFBundleShortVersionString</key>
  <string>${version}</string>
</dict>
</plist>
`;
}

function makeFakeCavalryBundle(rootDir, options = {}) {
  const version = options.version || '2.3.4';
  const appPath = path.join(rootDir, 'Cavalry.app');
  const contents = path.join(appPath, 'Contents');
  const assetsRoot = path.join(contents, 'assets');

  writeText(path.join(contents, 'Info.plist'), makeInfoPlist(version));
  writeJson(path.join(assetsRoot, 'Definitions', 'nodeStrings.json'), { value: 'EN node' });
  writeJson(path.join(assetsRoot, 'Definitions', 'appStrings.json'), { value: 'EN app' });
  writeJson(path.join(assetsRoot, 'Learn', 'tips.json'), { title: 'EN tip', text: 'EN text' });
  writeJson(path.join(assetsRoot, 'Learn', 'onboarding.json'), { title: 'EN onboarding' });
  writeJson(path.join(assetsRoot, 'Plugins', 'Gaussian Blur Filter', 'strings.json'), {
    niceName: 'Gaussian Blur Filter',
    language: 'en',
  });
  writeJson(path.join(assetsRoot, 'Plugins', 'Bulge Filter', 'strings.json'), {
    niceName: 'Bulge Filter',
    language: 'en',
  });

  writeMachO(path.join(contents, 'MacOS', 'Cavalry'));
  writeMachO(path.join(contents, 'MacOS', 'crashpad_handler'));
  writeMachO(path.join(contents, 'Frameworks', 'libCavalryFramework.dylib'));
  fs.mkdirSync(path.join(contents, 'Resources'), { recursive: true });

  return {
    appPath,
    assetsRoot,
    version,
  };
}

module.exports = {
  makeFakeCavalryBundle,
};
