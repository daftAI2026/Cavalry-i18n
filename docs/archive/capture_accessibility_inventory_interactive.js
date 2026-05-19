#!/usr/bin/env node

/**
 * Interactive Accessibility Capture with Panel Expansion
 * 
 * Strategy:
 * 1. Launch Cavalry
 * 2. Open all major panels via AppleScript commands
 * 3. Interact with UI elements (click, expand, etc)
 * 4. Perform comprehensive AX traversal (depth > 20)
 * 5. Collect all menuLeaves and candidate strings
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

function fail(message) {
  throw new Error(message);
}

function normalizeText(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function safeCall(fn, fallback) {
  try { return fn(); } catch (error) { return fallback; }
}

function runAppleScript(script) {
  const result = spawnSync('osascript', ['-l', 'JavaScript'], {
    input: script,
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    console.error('AppleScript error:', result.stderr);
    // Don't fail on AppleScript errors - UI may already be in desired state
  }
  return result.stdout || '';
}

function expandCavalryUI(pid) {
  const script = `
const config = { pid: ${pid} };

function safeCall(fn, fallback) {
  try { return fn(); } catch (error) { return fallback; }
}

function findCavalryProcess(systemEvents) {
  if (config.pid) {
    const matches = systemEvents.processes.whose({ unixId: Number(config.pid) })();
    if (matches.length > 0) return matches[0];
  }
  return systemEvents.processes.byName('Cavalry');
}

// Main execution
try {
  const se = Application('System Events');
  const proc = findCavalryProcess(se);
  
  // Activate app
  safeCall(() => proc.frontmost = true);
  
  // Try to open panels via keyboard shortcuts or menu
  // Library panel (Cmd+1 or Cmd+L)
  safeCall(() => {
    se.keystroke('1', { using: { command: true } });
    delay(0.5);
  });
  
  // Inspector panel (Cmd+2 or Cmd+I)
  safeCall(() => {
    se.keystroke('2', { using: { command: true } });
    delay(0.5);
  });
  
  // Timeline panel (Cmd+3 or Cmd+T)
  safeCall(() => {
    se.keystroke('3', { using: { command: true } });
    delay(0.5);
  });
  
  // Try opening View menu to access other panels
  safeCall(() => {
    se.keystroke('v', { using: { alt: true } });
    delay(0.3);
  });
  
} catch (e) {
  // Continue even if panel opening fails
}

"done"
`;
  runAppleScript(script);
}

function collectTextNodesDeep(element, bucket, depth, visited = new Set()) {
  if (!element || depth > 25 || visited.has(element)) return;
  
  // Track visited elements to avoid infinite loops
  try {
    const elementId = safeCall(() => element.id?.(), null);
    if (elementId && visited.has(elementId)) return;
    if (elementId) visited.add(elementId);
  } catch (e) {
    // Continue if can't get ID
  }
  
  const node = {
    role: normalizeText(safeCall(() => element.role(), '')),
    name: normalizeText(safeCall(() => element.name(), '')),
    value: normalizeText(safeCall(() => element.value(), '')),
    title: normalizeText(safeCall(() => element.title(), '')),
    description: normalizeText(safeCall(() => element.description(), '')),
  };
  
  if (node.name || node.value || node.title || node.description) {
    bucket.push(node);
  }
  
  const children = safeCall(() => element.uiElements(), []);
  if (Array.isArray(children)) {
    for (const child of children) {
      collectTextNodesDeep(child, bucket, depth + 1, visited);
    }
  }
}

function runCapture(options) {
  const script = `
const config = ${JSON.stringify({
    appName: options.appName,
    pid: options.pid || '',
    sessionUuid: options.sessionUuid || '',
    bundleHash: options.bundleHash || '',
})};

function safeCall(fn, fallback) {
  try { return fn(); } catch (error) { return fallback; }
}

function normalizeText(value) {
  return String(value || '').replace(/\\s+/g, ' ').trim();
}

function collectTextNodes(element, bucket, depth, visited) {
  if (!element || depth > 25 || !visited) return;
  
  const node = {
    role: normalizeText(safeCall(() => element.role(), '')),
    name: normalizeText(safeCall(() => element.name(), '')),
    value: normalizeText(safeCall(() => element.value(), '')),
    title: normalizeText(safeCall(() => element.title(), '')),
    description: normalizeText(safeCall(() => element.description(), '')),
  };
  
  if (node.name || node.value || node.title || node.description) {
    bucket.push(node);
  }
  
  const children = safeCall(() => element.uiElements(), []);
  if (Array.isArray(children)) {
    for (const child of children) {
      collectTextNodes(child, bucket, depth + 1, visited);
    }
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
  
  // Collect all windows
  const windows = safeCall(() => process.windows(), []).map((window) => {
    const textNodes = [];
    collectTextNodes(window, textNodes, 0, {});
    return {
      role: normalizeText(safeCall(() => window.role(), 'AXWindow')),
      title: normalizeText(safeCall(() => window.title(), safeCall(() => window.name(), ''))),
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
    fail(result.stderr || result.stdout || 'Interactive capture failed.');
  }

  try {
    return JSON.parse(result.stdout || '{}');
  } catch (e) {
    fail(`Failed to parse capture output: ${e.message}`);
  }
}

// Main
const repoRoot = path.resolve(__dirname, '..');
const pid = Number(process.argv[2] || '');
const sessionUuid = process.argv[3] || '';
const bundleHash = process.argv[4] || '';

if (!pid) fail('Usage: capture_accessibility_inventory_interactive.js <pid> <sessionUuid> <bundleHash>');

console.log('Expanding Cavalry UI panels...');
expandCavalryUI(pid);

// Wait for UI to stabilize
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
delay(2000).then(() => {
  console.log('Performing comprehensive AX traversal...');
  const capture = runCapture({
    appName: 'Cavalry',
    pid,
    sessionUuid,
    bundleHash,
  });
  
  console.log(JSON.stringify(capture, null, 2));
});
