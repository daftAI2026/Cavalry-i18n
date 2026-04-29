#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

function fail(message) {
  throw new Error(message);
}

function parseArgs(argv) {
  const options = {
    appName: 'Cavalry',
    language: '',
    output: '',
    pid: '',
    sessionUuid: '',
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
    if (arg === '--pid') {
      options.pid = argv[index + 1] || '';
      index += 1;
      continue;
    }
    if (arg === '--session-uuid') {
      options.sessionUuid = argv[index + 1] || '';
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

function runJxaCapture(options) {
  const jxaPayload = JSON.stringify({
    appName: options.appName,
    pid: options.pid || '',
    sessionUuid: options.sessionUuid || '',
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
  if (!element || depth > 8) return;
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
  const menuBarItems = safeCall(() => process.menuBars[0].menuBarItems(), []).map(readMenuItem).filter(Boolean);
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
    wallclockUtc: new Date().toISOString(),
    menuBarItems,
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

function main() {
  const options = parseArgs(process.argv.slice(2));
  const capture = runJxaCapture(options);
  const inventory = buildAccessibilityInventory({
    language: options.language,
    capture,
  });
  const outputPath = path.resolve(options.output);
  writeJson(outputPath, inventory);
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
  runJxaCapture,
  writeJson,
};
