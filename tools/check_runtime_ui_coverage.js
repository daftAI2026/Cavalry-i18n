#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

function fail(message) {
  throw new Error(message);
}

function parseArgs(argv) {
  const options = {
    inventory: '',
    allowlist: path.join(__dirname, 'runtime_ui_allowlist.json'),
    threshold: 99,
    maxReport: 80,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--inventory') {
      options.inventory = argv[index + 1] || '';
      index += 1;
      continue;
    }
    if (arg === '--allowlist') {
      options.allowlist = argv[index + 1] || '';
      index += 1;
      continue;
    }
    if (arg === '--threshold') {
      options.threshold = Number(argv[index + 1] || '');
      index += 1;
      continue;
    }
    if (arg === '--max-report') {
      options.maxReport = Number(argv[index + 1] || '');
      index += 1;
    }
  }

  if (!options.inventory) {
    fail('Missing required --inventory <path> argument.');
  }
  if (!Number.isFinite(options.threshold) || options.threshold < 0 || options.threshold > 100) {
    fail('Threshold must be a number between 0 and 100.');
  }
  if (!Number.isFinite(options.maxReport) || options.maxReport < 1) {
    fail('max-report must be a positive integer.');
  }

  return options;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function normalizeText(value) {
  return String(value)
    .replace(/[&]/g, '')
    .replace(/\u2026/g, '...')
    .replace(/[\u200B-\u200F\u202A-\u202E\u2060\uFEFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function shouldIgnore(value, allowlist) {
  if (!value) {
    return true;
  }

  if (/^[\d\s.,:%()+\-/*]+$/.test(value)) {
    return true;
  }

  if ((allowlist.exact || []).includes(value)) {
    return true;
  }

  return false;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function stripAllowedFragments(value, allowlist) {
  let stripped = value;
  for (const fragment of allowlist.contains || []) {
    stripped = stripped.replace(new RegExp(escapeRegExp(fragment), 'g'), ' ');
  }
  return normalizeText(stripped);
}

function collectMenuStrings(menu, bucket) {
  if (!menu || !Array.isArray(menu.items)) {
    return;
  }

  for (const item of menu.items) {
    if (item && typeof item.text === 'string') {
      bucket.push(item.text);
    }
    if (item && item.submenu && typeof item.submenu.title === 'string') {
      bucket.push(item.submenu.title);
      collectMenuStrings(item.submenu, bucket);
    }
  }
}

function collectWidgetStrings(widgetTexts, bucket) {
  if (!Array.isArray(widgetTexts)) {
    return;
  }

  for (const widget of widgetTexts) {
    if (widget && widget.strings && typeof widget.strings === 'object') {
      for (const value of Object.values(widget.strings)) {
        if (typeof value === 'string') {
          bucket.push(value);
        }
      }
    }

    if (widget && Array.isArray(widget.tabTexts)) {
      for (const value of widget.tabTexts) {
        if (typeof value === 'string') {
          bucket.push(value);
        }
      }
    }
  }
}

function buildCoverage(inventory, allowlist) {
  const collected = [];
  for (const menuBar of inventory.menuBars || []) {
    collectMenuStrings(menuBar, collected);
  }
  collectWidgetStrings(inventory.widgetTexts || [], collected);

  const uniqueCandidates = [...new Set(collected.map(normalizeText))].filter(
    (value) => !shouldIgnore(value, allowlist)
  );
  const untranslated = uniqueCandidates.filter((value) =>
    /[A-Za-z]/.test(stripAllowedFragments(value, allowlist))
  );
  const coveragePct =
    uniqueCandidates.length === 0
      ? 100
      : Number((((uniqueCandidates.length - untranslated.length) / uniqueCandidates.length) * 100).toFixed(2));

  return {
    language: inventory.language || '',
    formatVersion: inventory.formatVersion || 0,
    totalCandidates: uniqueCandidates.length,
    untranslatedCount: untranslated.length,
    coveragePct,
    untranslated,
  };
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const inventory = readJson(path.resolve(options.inventory));
  const allowlist = readJson(path.resolve(options.allowlist));
  const summary = buildCoverage(inventory, allowlist);

  const report = {
    language: summary.language,
    formatVersion: summary.formatVersion,
    threshold: options.threshold,
    coveragePct: summary.coveragePct,
    totalCandidates: summary.totalCandidates,
    untranslatedCount: summary.untranslatedCount,
    untranslated: summary.untranslated.slice(0, options.maxReport),
  };

  console.log(JSON.stringify(report, null, 2));

  if (summary.coveragePct < options.threshold) {
    process.exitCode = 1;
  }
}

main();
