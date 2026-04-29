#!/usr/bin/env node

/**
 * merge_runtime_inventory.js
 * Merges injector inventory and AX inventory into a single merged inventory.
 */

const { readFile, writeFile, mkdir } = require('node:fs').promises;
const { existsSync } = require('node:fs');
const { join } = require('node:path');

const OPTIONS = parseArgs();

function parseArgs() {
  const opts = { sessionDir: '', lang: '' };
  for (let i = 0; i < process.argv.length; i++) {
    if (process.argv[i] === '--session-dir') opts.sessionDir = process.argv[++i];
    if (process.argv[i] === '--lang') opts.lang = process.argv[++i];
  }
  if (!opts.sessionDir || !opts.lang) {
    console.error('Usage: merge_runtime_inventory.js --session-dir <path> --lang <code>');
    process.exit(1);
  }
  return opts;
}

async function readInventory(path) {
  if (!existsSync(path)) {
    return null;
  }
  try {
    const content = await readFile(path, 'utf8');
    return JSON.parse(content);
  } catch (err) {
    console.warn(`⚠ Failed to read inventory from ${path}: ${err.message}`);
    return null;
  }
}

async function mergeInventories() {
  const runtimeDir = join(OPTIONS.sessionDir, 'runtime');
  await mkdir(runtimeDir, { recursive: true });

  const injectorPath = join(runtimeDir, `${OPTIONS.lang}-injector-inventory.json`);
  const axPath = join(runtimeDir, `${OPTIONS.lang}-ax-inventory.json`);

  const injectorInv = await readInventory(injectorPath);
  const axInv = await readInventory(axPath);

  if (!injectorInv) {
    console.warn(`⚠ No injector inventory found at ${injectorPath}`);
  }

  // Build merged inventory
  const merged = {
    formatVersion: 3,
    language: OPTIONS.lang,
    source: 'live-merged',
    capture: {
      pid: injectorInv?.capture?.pid || axInv?.capture?.pid || 0,
      bundleHash: injectorInv?.capture?.bundleHash || axInv?.capture?.bundleHash || '',
      sessionUuid: injectorInv?.capture?.sessionUuid || axInv?.capture?.sessionUuid || '',
      wallclockUtc: new Date().toISOString(),
      source: 'live-merged',
      menuDepthMax: axInv?.capture?.menuDepthMax || 0,
      menuPathSamples: axInv?.capture?.menuPathSamples || [],
    },
    candidates: 0,
    menuLeaves: 0,
    menuBars: [],
    panels: [],
    widgetTexts: [],
    submenuPaths: [],
    merge: {
      injectorUsed: !!injectorInv,
      axUsed: !!axInv,
      injectorWidgets: injectorInv?.widgetTexts?.length || 0,
      axWidgets: axInv?.widgetTexts?.length || 0,
    },
  };

  // Merge widget texts from injector (primary source)
  if (injectorInv?.widgetTexts) {
    merged.widgetTexts.push(...injectorInv.widgetTexts);
  }

  // Add AX widget texts if not already in merged
  if (axInv?.widgetTexts) {
    const existingTexts = new Set(merged.widgetTexts.map(w => JSON.stringify(w)));
    for (const widget of axInv.widgetTexts) {
      if (!existingTexts.has(JSON.stringify(widget))) {
        merged.widgetTexts.push(widget);
      }
    }
  }

  // Merge menu bars from injector
  if (injectorInv?.menuBars) {
    merged.menuBars.push(...injectorInv.menuBars);
  }

  // Merge submenu paths from AX
  if (axInv?.capture?.menuPathSamples) {
    merged.submenuPaths.push(...axInv.capture.menuPathSamples);
  }

  // Count candidates and menu leaves
  merged.candidates = merged.widgetTexts.length;
  merged.menuLeaves = (merged.menuBars || []).reduce((sum, bar) => {
    const countItems = (items) => {
      if (!Array.isArray(items)) return 0;
      return items.reduce((acc, item) => {
        acc += 1;
        if (item.submenu) {
          acc += countItems(item.submenu.items);
        }
        return acc;
      }, 0);
    };
    return sum + countItems(bar.items);
  }, 0);

  // Add panel and tab texts
  if (injectorInv?.panels) {
    merged.panels.push(...injectorInv.panels);
  }

  console.log(`  Candidates: ${merged.candidates}`);
  console.log(`  Menu leaves: ${merged.menuLeaves}`);
  console.log(`  Menu depth max: ${merged.capture.menuDepthMax}`);

  const mergedPath = join(runtimeDir, `${OPTIONS.lang}-merged-inventory.json`);
  await writeFile(mergedPath, JSON.stringify(merged, null, 2));
  console.log(`✓ Merged inventory written: ${mergedPath}`);

  return mergedPath;
}

async function main() {
  try {
    console.log(`🔗 Merging runtime inventories for ${OPTIONS.lang}...`);
    await mergeInventories();
  } catch (err) {
    console.error(`✗ Merge failed: ${err.message}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(`Fatal: ${err.message}`);
  process.exit(1);
});
