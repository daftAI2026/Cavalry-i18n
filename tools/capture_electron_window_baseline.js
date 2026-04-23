#!/usr/bin/env node
/**
 * [INPUT]: 依赖 Electron dev app、window_contract_lib 与真实 /Applications/Cavalry.app 探测路径
 * [OUTPUT]: 对外提供 Electron 主窗口 baseline 捕获，写出 fixtures/electron_window_baseline.{json,png}
 * [POS]: tools 的 Phase 0 UI 基线播种器，冻结旧世界窗口尺寸与内容截图
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
const fs = require('node:fs');
const path = require('node:path');
const {
  captureContentRegion,
  delay,
  focusWindow,
  launchElectron,
  makeTempDir,
  repoRoot,
  stopChild,
  waitForWindow,
} = require('./window_contract_lib');

const fixtureDir = path.join(repoRoot, 'tools', 'fixtures');
const fixtureJsonPath = path.join(fixtureDir, 'electron_window_baseline.json');
const fixturePngPath = path.join(fixtureDir, 'electron_window_baseline.png');

async function captureElectronWindowBaseline() {
  const stateDir = makeTempDir('cavalry-i18n-window-state-');
  const child = launchElectron(stateDir);
  try {
    const windowInfo = await waitForWindow({
      title: 'Cavalry Language Switcher',
      processName: 'Electron',
    });
    focusWindow(windowInfo);
    await delay(500);
    const capture = captureContentRegion(windowInfo, fixturePngPath);
    const payload = {
      title: windowInfo.title,
      processName: windowInfo.processName,
      outerBounds: {
        width: windowInfo.width,
        height: windowInfo.height,
      },
      chromeHeight: capture.chromeHeight,
      contentBounds: capture.contentBounds,
      imageSize: capture.imageSize,
      capturedAt: new Date().toISOString(),
    };
    fs.mkdirSync(fixtureDir, { recursive: true });
    fs.writeFileSync(fixtureJsonPath, `${JSON.stringify(payload, null, 2)}\n`);
    return payload;
  } finally {
    stopChild(child);
  }
}

if (require.main === module) {
  captureElectronWindowBaseline()
    .then((result) => {
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    })
    .catch((error) => {
      process.stderr.write(`${error.stack || error.message}\n`);
      process.exitCode = 1;
    });
}

module.exports = {
  captureElectronWindowBaseline,
};
