#!/usr/bin/env node
/**
 * [INPUT]: 依赖 macOS osascript/screencapture 与 packaged Tauri binary
 * [OUTPUT]: 对外提供用直接 tell 保持精确 PID 绑定的 AX 窗口枚举/操作、交通灯几何读取、About 菜单回归与 400×484 内容截图辅助函数
 * [POS]: tools 的 Tauri 窗口回归公共层
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');

const repoRoot = path.resolve(__dirname, '..');
const expectedContentSize = { width: 400, height: 484 };

function fail(message) {
  throw new Error(message);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    cwd: repoRoot,
    ...options,
  });
  if (result.status === 0) {
    return result.stdout || '';
  }
  fail((result.stderr || result.stdout || '').trim() || `${command} failed`);
}

function runAppleScript(source) {
  return run('osascript', ['-e', source]).trim();
}

function appleScriptString(value) {
  return `"${String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function normalizePid(pid) {
  if (pid === undefined || pid === null) {
    return null;
  }
  const normalized = Number(pid);
  if (!Number.isInteger(normalized) || normalized <= 0) {
    fail(`Invalid process PID: ${pid}`);
  }
  return normalized;
}

function positiveInteger(value, label) {
  const normalized = Number(value);
  if (!Number.isInteger(normalized) || normalized <= 0) {
    fail(`${label} must be a positive integer: ${value}`);
  }
  return normalized;
}

// System Events 会把对象变量按名称重新解析；同名 App 必须用 PID 的直接 tell，
// 窗口/按钮也按索引直接读取，只把字符串、坐标等值传回 JavaScript。
function listVisibleWindows({ pid } = {}) {
  const expectedPid = normalizePid(pid);
  const processIds = expectedPid === null
    ? 'unix id of every process whose background only is false'
    : `{${expectedPid}}`;
  const output = runAppleScript(`
tell application "System Events"
  set outputLines to {}
  set processIds to ${processIds}
  repeat with targetPid in processIds
    try
      tell (first process whose unix id is (targetPid as integer))
        set procName to name
        set procPid to unix id
        repeat with windowIndex from 1 to count windows
          set winTitle to name of window windowIndex
          set winPos to position of window windowIndex
          set winSize to size of window windowIndex
          set end of outputLines to procName & "|" & (procPid as text) & "|" & winTitle & "|" & ((item 1 of winPos) as text) & "|" & ((item 2 of winPos) as text) & "|" & ((item 1 of winSize) as text) & "|" & ((item 2 of winSize) as text)
        end repeat
      end tell
    end try
  end repeat
  set AppleScript's text item delimiters to linefeed
  return outputLines as text
end tell
  `);
  return output.split('\n').filter(Boolean).map((line) => {
    const [processName, pidText, title, x, y, width, height] = line.split('|');
    return { processName, pid: Number(pidText), title, x: Number(x), y: Number(y),
      width: Number(width), height: Number(height) };
  });
}

function windowMatches(candidate, { title, processName = '', pid, width, height }) {
  const expectedPid = normalizePid(pid);
  return candidate.title === title && (!processName || candidate.processName === processName) &&
    (expectedPid === null || candidate.pid === expectedPid) &&
    (width === undefined || Math.abs(candidate.width - Number(width)) <= 1) &&
    (height === undefined || Math.abs(candidate.height - Number(height)) <= 1);
}

async function waitForWindow({ timeoutMs = 30000, ...selector }) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const match = listVisibleWindows({ pid: selector.pid }).find((candidate) => windowMatches(candidate, selector));
    if (match) return match;
    await delay(250);
  }
  fail(`Timed out waiting for window "${selector.title}" [pid ${selector.pid}].`);
}

function exactProcessScript({ pid, processName = '' }, body) {
  const expectedPid = normalizePid(pid);
  if (expectedPid === null) fail('Native window operations require an exact process PID.');
  return `tell application "System Events"
    tell (first process whose unix id is ${expectedPid})
      ${processName ? `if name is not ${appleScriptString(processName)} then error "Process name mismatch"` : ''}
      ${body}
    end tell
  end tell`;
}

function windowScript(selector, body, focus = false) {
  return exactProcessScript(selector, `
    ${focus ? 'set frontmost to true' : ''}
    tell window ${appleScriptString(selector.title)}
      ${body}
    end tell`);
}

function focusWindow(selector) {
  // 保持旧调用者的 name/title 入口；解析后所有操作仍绑定同一个 PID。
  const bound = normalizePid(selector.pid) === null
    ? listVisibleWindows().find((candidate) => windowMatches(candidate, selector))
    : selector;
  if (!bound) fail(`Could not find window "${selector.title}".`);
  runAppleScript(windowScript(bound, 'perform action "AXRaise"', true));
}

function resizeWindow(selector) {
  const width = positiveInteger(selector.width, 'Window width');
  const height = positiveInteger(selector.height, 'Window height');
  runAppleScript(windowScript(selector, `set size to {${width}, ${height}}`));
}

function openAboutMenu({ menuTitle, ...selector }) {
  runAppleScript(exactProcessScript(selector, `
    set frontmost to true
    repeat with menuIndex from 1 to count menu bar items of menu bar 1
      if exists menu item ${appleScriptString(menuTitle)} of menu 1 of menu bar item menuIndex of menu bar 1 then
        click menu item ${appleScriptString(menuTitle)} of menu 1 of menu bar item menuIndex of menu bar 1
        return "ok"
      end if
    end repeat
    error "About menu item was not found"`));
}

function closeWindow(selector) {
  runAppleScript(windowScript(selector, 'perform action "AXPress" of (first button whose subrole is "AXCloseButton")'));
}

async function waitForWindowGone({ timeoutMs = 10000, ...selector }) {
  if (normalizePid(selector.pid) === null) fail('Waiting for window closure requires an exact PID.');
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!listVisibleWindows({ pid: selector.pid }).some((candidate) => windowMatches(candidate, selector))) return;
    await delay(250);
  }
  fail(`Timed out waiting for window "${selector.title}" to close [pid ${selector.pid}].`);
}

function readTrafficLightGeometry(selector) {
  const output = runAppleScript(windowScript(selector, `
    set winPos to position
    set winSize to size
    if (count buttons) is not 3 then error "Expected exactly three native window buttons"
    set outputLines to {}
    repeat with buttonIndex from 1 to count buttons
      set buttonPos to position of button buttonIndex
      set buttonSize to size of button buttonIndex
      set end of outputLines to ((item 1 of winPos) as text) & "|" & ((item 2 of winPos) as text) & "|" & ((item 1 of winSize) as text) & "|" & ((item 2 of winSize) as text) & "|" & ((item 1 of buttonPos) as text) & "|" & ((item 2 of buttonPos) as text) & "|" & ((item 1 of buttonSize) as text) & "|" & ((item 2 of buttonSize) as text)
    end repeat
    set AppleScript's text item delimiters to linefeed
    return outputLines as text`));
  const lines = output.split('\n').filter(Boolean);
  if (lines.length !== 3) fail(`Expected three traffic-light geometry rows, received ${lines.length}.`);
  const parsed = lines.map((line) => {
    const values = line.split('|').map(Number);
    if (values.length !== 8 || values.some((value) => !Number.isFinite(value))) fail(`Invalid traffic-light geometry row: ${line}`);
    const [windowX, windowY, windowWidth, windowHeight, x, y, width, height] = values;
    return { x, y, width, height, centerDistanceFromTop: y + height / 2 - windowY,
      window: { x: windowX, y: windowY, width: windowWidth, height: windowHeight } };
  });
  return { pid: normalizePid(selector.pid), title: selector.title, processName: selector.processName,
    window: parsed[0].window, buttons: parsed.map(({ window: _window, ...button }) => button) };
}

function captureRect(bounds, outputPath) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  run('screencapture', [
    '-x',
    '-R',
    `${bounds.x},${bounds.y},${bounds.width},${bounds.height}`,
    outputPath,
  ]);
}

function readImageSize(imagePath) {
  const metadata = run('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', imagePath]);
  const width = Number(metadata.match(/pixelWidth:\s*(\d+)/)?.[1]);
  const height = Number(metadata.match(/pixelHeight:\s*(\d+)/)?.[1]);
  if (!Number.isFinite(width) || !Number.isFinite(height)) {
    fail(`Could not read screenshot dimensions from ${imagePath}.`);
  }
  return { width, height };
}

function captureContentRegion(bounds, outputPath) {
  const chromeHeight = bounds.height - expectedContentSize.height;
  if (chromeHeight < 0) {
    fail(`Window height ${bounds.height} is smaller than content height ${expectedContentSize.height}.`);
  }
  const contentBounds = {
    x: bounds.x,
    y: bounds.y + chromeHeight,
    width: bounds.width,
    height: expectedContentSize.height,
  };
  captureRect(contentBounds, outputPath);
  const imageSize = readImageSize(outputPath);
  return {
    bounds,
    chromeHeight,
    contentBounds,
    imageSize,
  };
}

function tauriBundleBinary() {
  const bundlePath = process.env.CAVALRY_I18N_TAURI_APP_BUNDLE
    ? path.resolve(process.env.CAVALRY_I18N_TAURI_APP_BUNDLE)
    : path.join(
        repoRoot,
        'src-tauri',
        'target',
        'release',
        'bundle',
        'macos',
        'Cavalry Language Switcher.app'
      );
  const appPath = path.join(bundlePath, 'Contents', 'MacOS', 'cavalry-i18n-tauri');
  if (!fs.existsSync(appPath)) {
    fail(`Packaged Tauri binary missing at ${appPath}. Run npm run tauri:build first.`);
  }
  return appPath;
}

function launchTauri(stateDir) {
  return spawn(tauriBundleBinary(), [], {
    cwd: repoRoot,
    env: {
      ...process.env,
      CAVALRY_I18N_STATE_DIR: stateDir,
    },
    stdio: 'ignore',
  });
}

function stopChild(child) {
  if (!child || child.killed) {
    return;
  }
  child.kill('SIGTERM');
}

function makeTempDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

let _assistiveAccess;
function hasAssistiveAccess() {
  if (_assistiveAccess === undefined) {
    const result = spawnSync(
      'osascript',
      [
        '-e',
        `
tell application "System Events"
  if UI elements enabled is false then error "Accessibility UI scripting is disabled"
  set finderProcess to first process whose name is "Finder"
  return count windows of finderProcess
end tell
        `,
      ],
      {
        encoding: 'utf8',
        timeout: 5000,
      }
    );
    // 只用查询是否成功判断 AX 权限；Finder 可以合法地没有打开任何窗口。
    _assistiveAccess = result.status === 0;
  }
  return _assistiveAccess;
}

module.exports = {
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
  repoRoot,
  stopChild,
  tauriBundleBinary,
  waitForWindow,
  waitForWindowGone,
};
