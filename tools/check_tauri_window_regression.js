#!/usr/bin/env node
/**
 * [INPUT]: 依赖 packaged Tauri binary 与 macOS 截图/窗口探测能力
 * [OUTPUT]: 对外提供 Tauri 主窗口回归测试，验证冻结窗口尺寸与内容区大小
 * [POS]: tools 的 Phase 6 UI 回归守门，阻止 Tauri 真实 WebView 偏离冻结窗口契约
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
  makeTempDir,
  stopChild,
  tauriBundleBinary,
  waitForWindow,
} = require('./window_contract_lib');

const FROZEN_WINDOW = {
  title: 'Cavalry Language Switcher',
  processName: 'cavalry-i18n-tauri',
  outerWidth: 480,
  outerHeight: 528,
  chromeHeight: 28,
};

test('tauri window regression stays within the frozen Tauri contract', async (t) => {
  if (!hasAssistiveAccess()) {
    t.skip('Skipping tauri window regression: osascript lacks assistive access permissions');
    return;
  }
  tauriBundleBinary();
  const stateDir = makeTempDir('cavalry-i18n-tauri-window-state-');
  const outputDir = makeTempDir('cavalry-i18n-tauri-window-shot-');
  const actualPngPath = path.join(outputDir, 'tauri-window.png');
  const child = launchTauri(stateDir);

  try {
    const windowInfo = await waitForWindow({
      title: FROZEN_WINDOW.title,
      processName: FROZEN_WINDOW.processName,
    });
    focusWindow(windowInfo);
    assert.equal(windowInfo.width, FROZEN_WINDOW.outerWidth, 'window width drifted from frozen Tauri contract');
    assert.ok(
      Math.abs(windowInfo.height - FROZEN_WINDOW.outerHeight) <= 1,
      `window height drifted from frozen Tauri contract: ${windowInfo.height} !== ${FROZEN_WINDOW.outerHeight}`
    );
    let capture = null;
    for (let attempt = 0; attempt < 10; attempt += 1) {
      await delay(1000);
      capture = captureContentRegion(windowInfo, actualPngPath);
      assert.ok(
        Math.abs(capture.chromeHeight - FROZEN_WINDOW.chromeHeight) <= 1,
        `title bar/content offset drifted from frozen Tauri contract: ${capture.chromeHeight} !== ${FROZEN_WINDOW.chromeHeight}`
      );
      if (
        capture.imageSize.width === expectedContentSize.width &&
        capture.imageSize.height === expectedContentSize.height
      ) {
        break;
      }
    }
    assert.deepEqual(capture.imageSize, expectedContentSize, 'content screenshot size drifted');
  } finally {
    stopChild(child);
  }
});
