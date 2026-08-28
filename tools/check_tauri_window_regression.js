#!/usr/bin/env node
/**
 * [INPUT]: 依赖 packaged Tauri binary 与 macOS 截图/窗口探测能力
 * [OUTPUT]: 对外提供 Tauri 主窗口回归测试，验证坐标稳定后的冻结窗口尺寸、完整内容区截图与 backing scale
 * [POS]: tools 的 Phase 6 UI 回归守门；截图前后复核同一窗口坐标，拒绝把启动居中移动造成的裁切画面误判为真实 WebView
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const {
  captureContentRegion,
  delay,
  expectedContentSize,
  focusWindow,
  hasAssistiveAccess,
  launchTauri,
  listVisibleWindows,
  makeTempDir,
  stopChild,
  tauriBundleBinary,
  waitForWindow,
} = require('./window_contract_lib');

const FROZEN_WINDOW = {
  title: 'Cavalry Language Switcher',
  processName: 'cavalry-i18n-tauri',
  outerWidth: 460,
  outerHeight: 428,
  chromeHeight: 0,
};

test('tauri window regression stays within the frozen Tauri contract', async (t) => {
  if (!hasAssistiveAccess()) {
    t.skip('Skipping tauri window regression: osascript cannot query AX window properties');
    return;
  }
  tauriBundleBinary();
  const stateDir = makeTempDir('cavalry-i18n-tauri-window-state-');
  const outputDir = makeTempDir('cavalry-i18n-tauri-window-shot-');
  const actualPngPath = path.join(outputDir, 'tauri-window.png');
  const child = launchTauri(stateDir);

  try {
    const initialWindow = await waitForWindow({
      title: FROZEN_WINDOW.title,
      processName: FROZEN_WINDOW.processName,
    });
    focusWindow(initialWindow);
    let capture = null;
    let stableWindow = null;
    let scale = 1;
    for (let attempt = 0; attempt < 10; attempt += 1) {
      await delay(1000);
      const beforeCapture = listVisibleWindows().find(
        ({ title, processName }) =>
          title === FROZEN_WINDOW.title && processName === FROZEN_WINDOW.processName
      );
      if (!beforeCapture) continue;
      capture = captureContentRegion(beforeCapture, actualPngPath);
      const afterCapture = listVisibleWindows().find(
        ({ title, processName }) =>
          title === FROZEN_WINDOW.title && processName === FROZEN_WINDOW.processName
      );
      if (!afterCapture || JSON.stringify(afterCapture) !== JSON.stringify(beforeCapture)) continue;
      stableWindow = afterCapture;
      assert.ok(
        Math.abs(capture.chromeHeight - FROZEN_WINDOW.chromeHeight) <= 1,
        `title bar/content offset drifted from frozen Tauri contract: ${capture.chromeHeight} !== ${FROZEN_WINDOW.chromeHeight}`
      );
      scale = capture.imageSize.width / expectedContentSize.width;
      if (
        (scale === 1 || scale === 2 || scale === 3) &&
        capture.imageSize.height === expectedContentSize.height * scale
      ) {
        break;
      }
    }
    assert.ok(stableWindow, 'window bounds did not remain stable across screenshot capture');
    assert.equal(stableWindow.width, FROZEN_WINDOW.outerWidth, 'window width drifted from frozen Tauri contract');
    assert.ok(
      Math.abs(stableWindow.height - FROZEN_WINDOW.outerHeight) <= 1,
      `window height drifted from frozen Tauri contract: ${stableWindow.height} !== ${FROZEN_WINDOW.outerHeight}`
    );
    assert.ok(
      scale === 1 || scale === 2 || scale === 3,
      `invalid backing scale factor: ${scale}`
    );
    assert.deepEqual(
      capture.imageSize,
      { width: expectedContentSize.width * scale, height: expectedContentSize.height * scale },
      'content screenshot size drifted from normalized expected content size'
    );
  } finally {
    stopChild(child);
  }
});
