#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

function fail(message) {
  throw new Error(message);
}

function parseArgs(argv) {
  const options = {
    appName: 'Cavalry',
    language: '',
    output: '',
    auditLog: '',
    pid: '',
    sessionUuid: '',
    bundleHash: '',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--app-name') {
      options.appName = argv[index + 1] || '';
      index += 1;
      continue;
    }
    if (arg === '--language') {
      options.language = argv[index + 1] || '';
      index += 1;
      continue;
    }
    if (arg === '--output') {
      options.output = argv[index + 1] || '';
      index += 1;
      continue;
    }
    if (arg === '--audit-log') {
      options.auditLog = argv[index + 1] || '';
      index += 1;
      continue;
    }
    if (arg === '--pid') {
      options.pid = argv[index + 1] || '';
      index += 1;
      continue;
    }
    if (arg === '--session-uuid') {
      options.sessionUuid = argv[index + 1] || '';
      index += 1;
      continue;
    }
    if (arg === '--bundle-hash') {
      options.bundleHash = argv[index + 1] || '';
      index += 1;
    }
  }

  if (!options.language) {
    fail('Missing required --language <code> argument.');
  }
  if (!options.output) {
    fail('Missing required --output <path> argument.');
  }

  return options;
}

function normalizeText(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildMenuItem(rawItem) {
  if (!rawItem || typeof rawItem !== 'object') {
    return null;
  }

  const text = normalizeText(rawItem.text || rawItem.title || '');
  const payload = {};
  if (text) {
    payload.text = text;
  }

  if (rawItem.submenu && typeof rawItem.submenu === 'object') {
    const submenuTitle = normalizeText(rawItem.submenu.title || text);
    payload.submenu = {
      title: submenuTitle,
      items: (rawItem.submenu.items || []).map(buildMenuItem).filter(Boolean),
    };
  }

  if (!payload.text && !payload.submenu) {
    return null;
  }

  return payload;
}

function insertMenuPath(items, segments) {
  if (!Array.isArray(segments) || segments.length === 0) {
    return;
  }

  const [head, ...rest] = segments.map((value) => normalizeText(value)).filter(Boolean);
  if (!head) {
    return;
  }

  let item = items.find((candidate) => candidate.text === head);
  if (!item) {
    item = { text: head };
    items.push(item);
  }

  if (rest.length === 0) {
    return;
  }

  if (!item.submenu) {
    item.submenu = {
      title: head,
      items: [],
    };
  }
  insertMenuPath(item.submenu.items, rest);
}

function buildMenuItemsFromLines(lines) {
  const items = [];
  for (const line of lines || []) {
    const segments = String(line || '')
      .split('\t')
      .map((value) => normalizeText(value))
      .filter(Boolean);
    insertMenuPath(items, segments);
  }
  return items;
}

function buildWidgetTexts(windows) {
  const widgetTexts = [];
  for (const window of windows || []) {
    const windowTitle = normalizeText(window?.title || window?.name || '');
    if (windowTitle) {
      widgetTexts.push({
        className: normalizeText(window?.role || 'AXWindow'),
        strings: {
          windowTitle,
        },
      });
    }

    for (const textNode of window?.textNodes || []) {
      const strings = {};
      for (const key of ['name', 'value', 'title', 'description']) {
        const value = normalizeText(textNode?.[key] || '');
        if (value) {
          strings[key] = value;
        }
      }
      if (Object.keys(strings).length === 0) {
        continue;
      }
      widgetTexts.push({
        className: normalizeText(textNode?.role || 'AXUIElement'),
        strings,
      });
    }
  }

  return widgetTexts;
}

function buildAccessibilityInventory({ language, capture }) {
  return {
    formatVersion: 3,
    language,
    source: 'live-accessibility',
    capture: {
      pid: Number(capture?.pid || 0),
      bundleHash: capture?.bundleHash || '',
      source: 'live-accessibility',
      wallclockUtc: capture?.wallclockUtc || new Date().toISOString(),
      sessionUuid: capture?.sessionUuid || '',
    },
    menuBars: [
      {
        items: (capture?.menuBarItems || []).map(buildMenuItem).filter(Boolean),
      },
    ],
    widgetTexts: buildWidgetTexts(capture?.windows || []),
  };
}

function runMenuCapture(options) {
  const targetClause = options.pid
    ? `first process whose unix id is ${Number(options.pid)}`
    : `process "${String(options.appName || '').replace(/"/g, '\\"')}"`;
  const escapedAppName = String(options.appName || '').replace(/"/g, '\\"');
  const script = `
on normalizeText(valueText)
  if valueText is missing value then return ""
  return valueText as text
end normalizeText

on collectMenuItems(targetMenu, prefixList)
  set nestedLines to {}
  tell application "System Events"
    repeat with menuItemRef in every menu item of targetMenu
      try
        set itemName to my normalizeText(name of menuItemRef)
      on error
        set itemName to ""
      end try
      if itemName is not "" then
        set end of nestedLines to (prefixList & {itemName}) as text
      end if
      try
        set nestedLines to nestedLines & my collectMenuItems(menu 1 of menuItemRef, prefixList & {itemName})
      end try
    end repeat
  end tell
  return nestedLines
end collectMenuItems

set AppleScript's text item delimiters to tab
set outputLines to {}
tell application "${escapedAppName}" to activate
tell application "System Events"
  set targetProcess to ${targetClause}
  tell targetProcess
    set appMenuName to my normalizeText(name)
    try
      set frontmost to true
    end try
    repeat with menuBarItemRef in every menu bar item of menu bar 1
      try
        set menuBarName to my normalizeText(name of menuBarItemRef)
      on error
        set menuBarName to ""
      end try
      if menuBarName is not "" and menuBarName is not "Apple" and menuBarName is not appMenuName then
        try
          set frontmost to true
        end try
        try
          click menuBarItemRef
        on error
          try
            perform action "AXPress" of menuBarItemRef
          end try
        end try
        delay 0.15
        set end of outputLines to menuBarName
        try
          set outputLines to outputLines & my collectMenuItems(menu 1 of menuBarItemRef, {menuBarName})
        end try
        try
          click menuBarItemRef
        end try
      end if
    end repeat
  end tell
end tell
set AppleScript's text item delimiters to linefeed
return outputLines as text
`;

  const result = spawnSync('osascript', {
    input: script,
    encoding: 'utf8',
  });

  if (result.status !== 0) {
    fail(result.stderr || result.stdout || 'Accessibility menu capture failed.');
  }

  return buildMenuItemsFromLines(
    String(result.stdout || '')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
  );
}

function runWindowCapture(options) {
  const jxaPayload = JSON.stringify({
    appName: options.appName,
    pid: options.pid || '',
    sessionUuid: options.sessionUuid || '',
    bundleHash: options.bundleHash || '',
  });

  const script = `
const config = ${jxaPayload};

function safeCall(fn, fallback) {
  try { return fn(); } catch (error) { return fallback; }
}

function normalize(value) {
  return String(value || '').replace(/\\s+/g, ' ').trim();
}

function readMenuItem(item) {
  const text = normalize(safeCall(() => item.name(), ''));
  const submenu = safeCall(() => item.menu(), null);
  const payload = {};
  if (text) payload.text = text;
  if (submenu) {
    payload.submenu = {
      title: normalize(safeCall(() => submenu.title(), text)),
      items: safeCall(() => submenu.menuItems(), []).map(readMenuItem).filter(Boolean),
    };
  }
  return Object.keys(payload).length ? payload : null;
}

function collectTextNodes(element, bucket, depth) {
  if (!element || depth > 25) return;
  const node = {
    role: normalize(safeCall(() => element.role(), '')),
    name: normalize(safeCall(() => element.name(), '')),
    value: normalize(safeCall(() => element.value(), '')),
    title: normalize(safeCall(() => element.title(), '')),
    description: normalize(safeCall(() => element.description(), '')),
  };
  if (node.name || node.value || node.title || node.description) {
    bucket.push(node);
  }
  const children = safeCall(() => element.uiElements(), []);
  if (Array.isArray(children)) {
    children.forEach((child) => collectTextNodes(child, bucket, depth + 1));
  }
}

function resolveProcess(systemEvents) {
  if (config.pid) {
    const matches = systemEvents.processes.whose({ unixId: Number(config.pid) })();
    if (matches.length > 0) return matches[0];
  }
  return systemEvents.processes.byName(config.appName);
}

function run() {
  const systemEvents = Application('System Events');
  const process = resolveProcess(systemEvents);
  const windows = safeCall(() => process.windows(), []).map((window) => {
    const textNodes = [];
    collectTextNodes(window, textNodes, 0);
    return {
      role: normalize(safeCall(() => window.role(), 'AXWindow')),
      title: normalize(safeCall(() => window.title(), safeCall(() => window.name(), ''))),
      textNodes,
    };
  });

  return JSON.stringify({
    pid: config.pid || 0,
    sessionUuid: config.sessionUuid || '',
    bundleHash: config.bundleHash || '',
    wallclockUtc: new Date().toISOString(),
    windows,
  });
}
`;

  const result = spawnSync('osascript', ['-l', 'JavaScript'], {
    input: script,
    encoding: 'utf8',
  });

  if (result.status !== 0) {
    fail(result.stderr || result.stdout || 'Accessibility capture failed.');
  }

  return JSON.parse(result.stdout || '{}');
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function sha256(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const capture = runWindowCapture(options);
  capture.menuBarItems = runMenuCapture(options);
  const inventory = buildAccessibilityInventory({
    language: options.language,
    capture,
  });
  const outputPath = path.resolve(options.output);
  writeJson(outputPath, inventory);
  if (options.auditLog) {
    writeJson(path.resolve(options.auditLog), {
      output: outputPath,
      outputHash: sha256(outputPath),
      capture,
      summary: {
        menuBars: inventory.menuBars.length,
        widgetTexts: inventory.widgetTexts.length,
      },
    });
  }
  console.log(
    JSON.stringify(
      {
        output: outputPath,
        language: inventory.language,
        menuBars: inventory.menuBars.length,
        widgetTexts: inventory.widgetTexts.length,
        capture: inventory.capture,
      },
      null,
      2
    )
  );
}

if (require.main === module) {
  main();
}

module.exports = {
  buildAccessibilityInventory,
  buildMenuItem,
  buildWidgetTexts,
  normalizeText,
  parseArgs,
  runMenuCapture,
  runWindowCapture,
  writeJson,
};
