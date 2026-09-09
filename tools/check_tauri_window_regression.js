#!/usr/bin/env node
/**
 * [INPUT]: 依赖 packaged Tauri binary 与 macOS 截图/窗口探测能力
 * [OUTPUT]: 对外提供 Tauri 主窗口回归测试，验证精确子进程的原生交通灯几何、resize/restore、About 窗口、冻结尺寸、内容区截图与 backing scale
 * [POS]: tools 的 Phase 6 UI 回归守门；所有 AX 查询、截图和关闭动作绑定 launchTauri 子进程，拒绝同名已安装 App 污染证据
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const {
  captureContentRegion,
  closeWindow,
  delay,
  expectedContentSize,
  focusWindow,
  hasAssistiveAccess,
  launchTauri,
  listVisibleWindows,
  makeTempDir,
  openAboutMenu,
  readTrafficLightGeometry,
  resizeWindow,
  stopChild,
  tauriBundleBinary,
  waitForWindow,
  waitForWindowGone,
} = require('./window_contract_lib');

const FROZEN_WINDOW = {
  title: 'Cavalry Language Switcher',
  processName: 'cavalry-i18n-tauri',
  outerWidth: 400,
  outerHeight: 484,
  chromeHeight: 0,
};
const ABOUT_WINDOW = {
  title: 'About Cavalry Language Switcher',
  processName: FROZEN_WINDOW.processName,
};
const TITLEBAR_HEIGHT = 40;
const TRAFFIC_LIGHT_CENTER_TOLERANCE = 1;
const RESIZED_WINDOW = { width: 420, height: 504 };

function assertTrafficLightGeometry(selector, label, t) {
  const geometry = readTrafficLightGeometry(selector);
  assert.equal(geometry.buttons.length, 3, `${label}: expected three native traffic lights`);
  const expectedCenter = TITLEBAR_HEIGHT / 2;
  for (const [index, button] of geometry.buttons.entries()) {
    assert.ok(
      Math.abs(button.centerDistanceFromTop - expectedCenter) <= TRAFFIC_LIGHT_CENTER_TOLERANCE,
      `${label}: native button ${index + 1} center is ${button.centerDistanceFromTop}, expected ${expectedCenter} ± ${TRAFFIC_LIGHT_CENTER_TOLERANCE}`
    );
  }
  t?.diagnostic(
    `${label}: pid=${geometry.pid}, centers=${geometry.buttons
      .map((button) => button.centerDistanceFromTop)
      .join(',')}`
  );
  return geometry;
}

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
  const mainSelector = {
    title: FROZEN_WINDOW.title,
    processName: FROZEN_WINDOW.processName,
    pid: child.pid,
  };

  try {
    assert.ok(Number.isInteger(child.pid) && child.pid > 0, 'launched Tauri child has no usable PID');
    t.diagnostic(`launched child pid=${child.pid}; screenshots=${outputDir}`);
    const initialWindow = await waitForWindow(mainSelector);
    focusWindow(mainSelector);
    assertTrafficLightGeometry(mainSelector, 'first display', t);

    resizeWindow({ ...mainSelector, ...RESIZED_WINDOW });
    await waitForWindow({ ...mainSelector, ...RESIZED_WINDOW, timeoutMs: 10000 });
    assertTrafficLightGeometry(mainSelector, 'after resize', t);

    resizeWindow({
      ...mainSelector,
      width: FROZEN_WINDOW.outerWidth,
      height: FROZEN_WINDOW.outerHeight,
    });
    await waitForWindow({
      ...mainSelector,
      width: FROZEN_WINDOW.outerWidth,
      height: FROZEN_WINDOW.outerHeight,
      timeoutMs: 10000,
    });
    assertTrafficLightGeometry(mainSelector, 'after restore', t);

    openAboutMenu({
      processName: ABOUT_WINDOW.processName,
      pid: child.pid,
      menuTitle: ABOUT_WINDOW.title,
    });
    const aboutSelector = { ...ABOUT_WINDOW, pid: child.pid };
    await waitForWindow(aboutSelector);
    focusWindow(aboutSelector);
    assertTrafficLightGeometry(aboutSelector, 'About', t);
    closeWindow(aboutSelector);
    await waitForWindowGone(aboutSelector);
    focusWindow(mainSelector);
    assertTrafficLightGeometry(mainSelector, 'after About close', t);

    let capture = null;
    let stableWindow = null;
    let scale = 1;
    for (let attempt = 0; attempt < 10; attempt += 1) {
      await delay(1000);
      const beforeCapture = listVisibleWindows({ pid: child.pid }).find(
        ({ title, processName, pid }) =>
          title === FROZEN_WINDOW.title &&
          processName === FROZEN_WINDOW.processName &&
          pid === child.pid
      );
      if (!beforeCapture) continue;
      capture = captureContentRegion(beforeCapture, actualPngPath);
      const afterCapture = listVisibleWindows({ pid: child.pid }).find(
        ({ title, processName, pid }) =>
          title === FROZEN_WINDOW.title &&
          processName === FROZEN_WINDOW.processName &&
          pid === child.pid
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
