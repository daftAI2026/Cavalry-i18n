#!/usr/bin/env node
/**
 * [INPUT]: 依赖 macOS osascript/screencapture 与 packaged Tauri binary
 * [OUTPUT]: 对外提供窗口枚举、截图、内容区域裁剪与图像 diff 辅助函数
 * [POS]: tools 的 Tauri 窗口回归公共层
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');

const repoRoot = path.resolve(__dirname, '..');
const expectedContentSize = { width: 480, height: 500 };

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
  return JSON.parse(
    run('python3', [
      '-c',
      [
        'from PIL import Image',
        'import json, sys',
        'image = Image.open(sys.argv[1])',
        'print(json.dumps({"width": image.width, "height": image.height}))',
      ].join(';'),
      imagePath,
    ])
  );
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

function diffImages(leftPath, rightPath) {
  return JSON.parse(
    run('python3', [
      '-c',
      [
        'from PIL import Image, ImageChops',
        'import json, sys',
        'left = Image.open(sys.argv[1]).convert("RGBA")',
        'right = Image.open(sys.argv[2]).convert("RGBA")',
        'if left.size != right.size:',
        '    raise SystemExit(json.dumps({"error": "size-mismatch", "left": left.size, "right": right.size}))',
        'diff = ImageChops.difference(left, right).convert("L")',
        'hist = diff.histogram()',
        'pixels = diff.width * diff.height',
        'changed = sum(hist[1:])',
        'weighted = sum(index * count for index, count in enumerate(hist))',
        'max_diff = max((index for index, count in enumerate(hist) if count), default=0)',
        'print(json.dumps({',
        '    "width": diff.width,',
        '    "height": diff.height,',
        '    "changedRatio": changed / pixels,',
        '    "meanDiff": weighted / pixels,',
        '    "maxDiff": max_diff,',
        '}))',
      ].join('\n'),
      leftPath,
      rightPath,
    ])
  );
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

module.exports = {
  captureContentRegion,
  delay,
  diffImages,
  expectedContentSize,
  focusWindow,
  launchTauri,
  listVisibleWindows,
  makeTempDir,
  repoRoot,
  stopChild,
  tauriBundleBinary,
  waitForWindow,
};
