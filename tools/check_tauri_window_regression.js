#!/usr/bin/env node
/**
 * [INPUT]: 依赖 Electron window baseline fixture、packaged Tauri binary 与 macOS 截图/窗口探测能力
 * [OUTPUT]: 对外提供 Tauri 主窗口回归测试，比较窗口尺寸与内容截图差异
 * [POS]: tools 的 Phase 6 UI 回归守门，阻止 Tauri 在真实 WebView 上偏离 Electron baseline
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  captureContentRegion,
  delay,
  diffImages,
  focusWindow,
  launchTauri,
  makeTempDir,
  repoRoot,
  stopChild,
  tauriBundleBinary,
  waitForWindow,
} = require('./window_contract_lib');

const fixtureDir = path.join(repoRoot, 'tools', 'fixtures');
const fixtureJsonPath = path.join(fixtureDir, 'electron_window_baseline.json');
const fixturePngPath = path.join(fixtureDir, 'electron_window_baseline.png');

function readBaseline() {
  assert.ok(fs.existsSync(fixtureJsonPath), `Missing ${fixtureJsonPath}. Run npm run capture:electron:window-baseline.`);
  assert.ok(fs.existsSync(fixturePngPath), `Missing ${fixturePngPath}. Run npm run capture:electron:window-baseline.`);
  return JSON.parse(fs.readFileSync(fixtureJsonPath, 'utf8'));
}

test('tauri window regression stays within the frozen Electron baseline', async () => {
  tauriBundleBinary();
  const baseline = readBaseline();
  const stateDir = makeTempDir('cavalry-i18n-tauri-window-state-');
  const outputDir = makeTempDir('cavalry-i18n-tauri-window-shot-');
  const actualPngPath = path.join(outputDir, 'tauri-window.png');
  const child = launchTauri(stateDir);

  try {
    const windowInfo = await waitForWindow({
      title: baseline.title,
      processName: 'cavalry-i18n-tauri',
    });
    focusWindow(windowInfo);
    assert.equal(windowInfo.width, baseline.outerBounds.width, 'window width drifted from Electron baseline');
    assert.ok(
      Math.abs(windowInfo.height - baseline.outerBounds.height) <= 1,
      `window height drifted from Electron baseline: ${windowInfo.height} !== ${baseline.outerBounds.height}`
    );
    let capture = null;
    let diff = null;
    for (let attempt = 0; attempt < 10; attempt += 1) {
      await delay(1000);
      capture = captureContentRegion(windowInfo, actualPngPath);
      assert.ok(
        Math.abs(capture.chromeHeight - baseline.chromeHeight) <= 1,
        `title bar/content offset drifted from Electron baseline: ${capture.chromeHeight} !== ${baseline.chromeHeight}`
      );
      diff = diffImages(fixturePngPath, actualPngPath);
      if (diff.meanDiff <= 5) {
        break;
      }
    }
    assert.ok(
      diff && diff.meanDiff <= 5,
      `Tauri content screenshot meanDiff=${diff && diff.meanDiff} is above tolerance`
    );
  } finally {
    stopChild(child);
  }
});
