#!/usr/bin/env node
/**
 * [INPUT]: 依赖 macOS osascript/screencapture 与 packaged Tauri binary
 * [OUTPUT]: 对外提供 AX 窗口权限探测、窗口枚举、截图与内容区域尺寸校验辅助函数
 * [POS]: tools 的 Tauri 窗口回归公共层
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');

const repoRoot = path.resolve(__dirname, '..');
const expectedContentSize = { width: 460, height: 404 };

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

function listVisibleWindows() {
  const output = runAppleScript(`
tell application "System Events"
  set outputLines to {}
  try
    set allProcs to (every process whose background only is false)
    repeat with proc in allProcs
      try
        set procName to name of proc
        repeat with win in windows of proc
          try
            set winPos to position of win
            set winSize to size of win
            set end of outputLines to procName & "|" & (name of win) & "|" & ((item 1 of winPos) as text) & "|" & ((item 2 of winPos) as text) & "|" & ((item 1 of winSize) as text) & "|" & ((item 2 of winSize) as text)
          end try
        end repeat
      end try
    end repeat
  end try
  set AppleScript's text item delimiters to linefeed
  return outputLines as text
end tell
  `);
  return output
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [processName, title, x, y, width, height] = line.split('|');
      return {
        processName,
        title,
        x: Number(x),
        y: Number(y),
        width: Number(width),
        height: Number(height),
      };
    });
}

async function waitForWindow({ title, processName = '', timeoutMs = 30000 }) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const match = listVisibleWindows().find((candidate) => {
      return (
        candidate.title === title &&
        (!processName || candidate.processName === processName)
      );
    });
    if (match) {
      return match;
    }
    await delay(250);
  }
  fail(`Timed out waiting for window "${title}"${processName ? ` (${processName})` : ''}.`);
}

function focusWindow({ title, processName = '' }) {
  const processFilter = processName ? `and procName is equal to "${processName}"` : '';
  runAppleScript(`
tell application "System Events"
  repeat with proc in (every process whose background only is false)
    set procName to name of proc
    try
      repeat with win in windows of proc
        if (name of win) is equal to "${title}" ${processFilter} then
          set frontmost of proc to true
          perform action "AXRaise" of win
          return "ok"
        end if
      end repeat
    end try
  end repeat
end tell
  `);
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
  const appPath = path.join(
    repoRoot,
    'src-tauri',
    'target',
    'release',
    'bundle',
    'macos',
    'Cavalry Language Switcher.app',
    'Contents',
    'MacOS',
    'cavalry-i18n-tauri'
  );
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
  delay,
  expectedContentSize,
  focusWindow,
  hasAssistiveAccess,
  launchTauri,
  listVisibleWindows,
  makeTempDir,
  repoRoot,
  stopChild,
  tauriBundleBinary,
  waitForWindow,
};
