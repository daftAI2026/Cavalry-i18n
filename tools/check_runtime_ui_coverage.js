#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const { detectForbiddenTranslationPatterns } = require('./forbidden_translation_patterns.js');

function fail(message) {
  throw new Error(message);
}

function parseArgs(argv) {
  const options = {
    inventory: '',
    allowlist: path.join(__dirname, 'runtime_ui_allowlist.json'),
    threshold: 100,
    maxReport: 80,
    extractionInventory: '',
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
      continue;
    }
    if (arg === '--extraction-inventory') {
      options.extractionInventory = argv[index + 1] || '';
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
  if (!options.extractionInventory) {
    options.extractionInventory = inferExtractionInventoryPath(options.inventory);
  }

  return options;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function inferExtractionInventoryPath(inventoryPath) {
  const resolvedInventoryPath = path.resolve(inventoryPath);
  const runtimeDir = path.dirname(resolvedInventoryPath);
  if (path.basename(runtimeDir) !== 'runtime') {
    return '';
  }

  const extractionPath = path.join(path.dirname(runtimeDir), 'extraction-inventory.json');
  return fs.existsSync(extractionPath) ? extractionPath : '';
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

function hasForbiddenTranslationPattern(value, language, sourceText = '') {
  return detectForbiddenTranslationPatterns({ language, value, sourceText }).length > 0;
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

    for (const field of ['actionTexts', 'listItems', 'treeItems', 'tableItems', 'headerTexts']) {
      if (widget && Array.isArray(widget[field])) {
        for (const value of widget[field]) {
          if (typeof value === 'string') {
            bucket.push(value);
          }
        }
      }
    }
  }
}

function buildCoverage(inventory, allowlist, translationsOrExtraction = null, extractionSurface = null) {
  const translations = translationsOrExtraction instanceof Map ? translationsOrExtraction : null;
  const resolvedExtractionSurface = translations ? extractionSurface : translationsOrExtraction;
  const collected = [];
  for (const menuBar of inventory.menuBars || []) {
    collectMenuStrings(menuBar, collected);
  }
  collectWidgetStrings(inventory.widgetTexts || [], collected);

  const uniqueCandidates = [...new Set(collected.map(normalizeText))].filter(
    (value) => !shouldIgnore(value, allowlist)
  );
  const frozenCandidates = Array.isArray(resolvedExtractionSurface?.englishLeaves)
    ? [
        ...new Set(
          resolvedExtractionSurface.englishLeaves
            .map((leaf) => normalizeText(leaf?.value || ''))
            .filter(Boolean)
            .filter((value) => !shouldIgnore(value, allowlist))
        ),
      ]
    : null;
  const denominatorCandidates = frozenCandidates && frozenCandidates.length > 0 ? frozenCandidates : uniqueCandidates;
  const forbiddenSamples = [];
  const forbiddenPatternCounts = {};
  const untranslated = denominatorCandidates.filter((value) => {
    const stripped = stripAllowedFragments(value, allowlist);
    const translation = normalizeText(translations?.get(value) || '');
    const valueToCheck = translation || value;
    const forbiddenHits = detectForbiddenTranslationPatterns({
      language: inventory.language || '',
      value: valueToCheck,
      sourceText: value,
    });
    for (const hit of forbiddenHits) {
      forbiddenPatternCounts[hit.id] = (forbiddenPatternCounts[hit.id] || 0) + 1;
    }
    if (forbiddenHits.length > 0 && forbiddenSamples.length < 20) {
      forbiddenSamples.push({
        value: valueToCheck,
        ids: forbiddenHits.map((hit) => hit.id),
      });
    }
    if (forbiddenHits.length > 0) {
      return true;
    }
    if (!/[A-Za-z]/.test(stripped)) {
      return false;
    }
    if (translations) {
      return !translation || translation === value;
    }
    return /[A-Za-z]/.test(stripped);
  });
  const coveragePct =
    denominatorCandidates.length === 0
      ? 100
      : Number(
          (
            (Math.max(0, denominatorCandidates.length - untranslated.length) / denominatorCandidates.length) *
            100
          ).toFixed(2)
        );

  return {
    language: inventory.language || '',
    formatVersion: inventory.formatVersion || 0,
    denominatorSource: denominatorCandidates === uniqueCandidates ? 'inventory' : 'extraction-inventory',
    totalCandidates: denominatorCandidates.length,
    candidates: denominatorCandidates,
    observedCandidateCount: uniqueCandidates.length,
    observedCandidates: uniqueCandidates,
    translated: uniqueCandidates.filter((value) => !untranslated.includes(value)),
    untranslatedCount: untranslated.length,
    coveragePct,
    untranslated,
    forbiddenPatterns: {
      total: Object.values(forbiddenPatternCounts).reduce((sum, count) => sum + count, 0),
      byPattern: forbiddenPatternCounts,
      samples: forbiddenSamples,
    },
  };
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const inventory = readJson(path.resolve(options.inventory));
  const allowlist = readJson(path.resolve(options.allowlist));
  const extractionInventory =
    options.extractionInventory && fs.existsSync(path.resolve(options.extractionInventory))
      ? readJson(path.resolve(options.extractionInventory))
      : null;
  const summary = buildCoverage(inventory, allowlist, extractionInventory?.surfaces?.['runtime-candidates'] || null);

  const report = {
    language: summary.language,
    formatVersion: summary.formatVersion,
    threshold: options.threshold,
    denominatorSource: summary.denominatorSource,
    coveragePct: summary.coveragePct,
    totalCandidates: summary.totalCandidates,
    observedCandidateCount: summary.observedCandidateCount,
    untranslatedCount: summary.untranslatedCount,
    untranslated: summary.untranslated.slice(0, options.maxReport),
    forbiddenPatterns: summary.forbiddenPatterns,
  };

  console.log(JSON.stringify(report, null, 2));

  if (summary.coveragePct < options.threshold) {
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  buildCoverage,
  collectMenuStrings,
  collectWidgetStrings,
  normalizeText,
  parseArgs,
  readJson,
  inferExtractionInventoryPath,
  hasForbiddenTranslationPattern,
  shouldIgnore,
  stripAllowedFragments,
};
