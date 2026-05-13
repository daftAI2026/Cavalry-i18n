#!/usr/bin/env node

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const {
  buildCoverage,
  inferExtractionInventoryPath,
  normalizeText,
  readJson,
  shouldIgnore,
  stripAllowedFragments,
} = require('./check_runtime_ui_coverage.js');

const SUPPORTED_LANGUAGES = new Set(['ja_JP', 'zh-Hans', 'zh-Hant']);
const VALIDATOR_ALIASES = {
  'ja_JP': 'ja',
  'zh-Hans': 'zh_Hans',
  'zh-Hant': 'zh_Hant',
};
const CACHE_ROOT = path.join(process.env.HOME || '', 'Library', 'Caches', 'Cavalry-i18n');
const COMPILED_SOURCE_MAP_PATH = path.join(CACHE_ROOT, 'compiled-ui-source-map.json');

function fail(message) {
  throw new Error(message);
}

function parseArgs(argv) {
  const options = {
    language: '',
    inventory: '',
    compiledSourceMap: COMPILED_SOURCE_MAP_PATH,
    ts: '',
    allowlist: path.join(__dirname, 'runtime_ui_allowlist.json'),
    threshold: 100,
    maxReport: 80,
    extractionInventory: '',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--language') {
      options.language = argv[index + 1] || '';
      index += 1;
      continue;
    }
    if (arg === '--inventory') {
      options.inventory = argv[index + 1] || '';
      index += 1;
      continue;
    }
    if (arg === '--compiled-source-map') {
      options.compiledSourceMap = argv[index + 1] || '';
      index += 1;
      continue;
    }
    if (arg === '--ts') {
      options.ts = argv[index + 1] || '';
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

  if (!SUPPORTED_LANGUAGES.has(options.language)) {
    fail(`Unsupported --language "${options.language}". Expected one of: ${[...SUPPORTED_LANGUAGES].join(', ')}`);
  }
  if (!options.inventory) {
    fail('Missing required --inventory <path> argument.');
  }
  if (!options.ts) {
    fail('Missing required --ts <path> argument.');
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

function decodeXml(value) {
  return String(value)
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function loadTsTranslations(filePath) {
  const xml = fs.readFileSync(filePath, 'utf8');
  const translations = new Map();
  const messageRegex =
    /<message\b[\s\S]*?<source>([\s\S]*?)<\/source>[\s\S]*?<translation(?:\s+[^>]*)?>([\s\S]*?)<\/translation>[\s\S]*?<\/message>/g;

  for (const match of xml.matchAll(messageRegex)) {
    const source = normalizeText(decodeXml(match[1]));
    const translation = normalizeText(decodeXml(match[2]));
    if (!source || !translation || source === translation) {
      continue;
    }
    translations.set(source, translation);
  }

  return translations;
}

function shouldCountCompiledCandidate(text, surfaceHint, allowlist) {
  if (!text || shouldIgnore(text, allowlist)) {
    return false;
  }

  const stripped = stripAllowedFragments(text, allowlist);
  if (!/[A-Za-z]/.test(stripped)) {
    return false;
  }

  if (
    /^\d+: [A-Z][a-z]+$/.test(text) ||
    /(?:^|\s)(?:Ltd|Ltd\.|Inc|Inc\.|LLC|Corp|Corp\.|GmbH|PLC)(?:$|\s|\.)/.test(text) ||
    /^[A-Z](?:acute|grave|circumflex|dieresis|tilde|cedilla|caron|breve|ogonek|ring|macron|slash|dotaccent|hungarumlaut)+(?:small)?$/i.test(
      text
    ) ||
    /^(?:Above|Below|Post|Pre)-base (?:Forms|Mark Positioning|Substitutions)$/.test(text)
  ) {
    return false;
  }

  if (surfaceHint === 'menu-or-action-like') {
    return true;
  }

  if (/\s/.test(text)) {
    return true;
  }

  return /^[A-Z][a-z]+(?:['-][A-Za-z]+)?$/.test(text);
}

function compiledTranslationLookupKeys(candidate) {
  const normalized = normalizeText(candidate);
  const stripped = normalized.replace(/(?:\.{3}|\.)$/, '').trim();
  const keys = [normalized];
  if (stripped && stripped !== normalized) {
    keys.push(stripped);
  }
  return [...new Set(keys)];
}

function buildCompiledCoverage(sourceMap, translations, allowlist, extractionSurface = null) {
  const candidates = [];
  const sourceEntries = Array.isArray(extractionSurface?.englishLeaves) ? extractionSurface.englishLeaves : sourceMap.entries || [];

  for (const entry of sourceEntries) {
    const text = normalizeText(entry.normalizedText || entry.text || entry.value || '');
    if (!shouldCountCompiledCandidate(text, entry.surfaceHint || '', allowlist)) {
      continue;
    }
    candidates.push(text);
  }

  const uniqueCandidates = [...new Set(candidates)];
  const untranslated = uniqueCandidates.filter((candidate) => {
    const translation = normalizeText(
      compiledTranslationLookupKeys(candidate)
        .map((key) => translations.get(key) || '')
        .find(Boolean) || ''
    );
    if (!translation) {
      return true;
    }
    return /[A-Za-z]/.test(stripAllowedFragments(translation, allowlist));
  });

  const coveragePct =
    uniqueCandidates.length === 0
      ? 100
      : Number((((uniqueCandidates.length - untranslated.length) / uniqueCandidates.length) * 100).toFixed(2));

  return {
    denominatorSource: sourceEntries === (sourceMap.entries || []) ? 'source-map' : 'extraction-inventory',
    totalCandidates: uniqueCandidates.length,
    untranslatedCount: untranslated.length,
    coveragePct,
    untranslated,
  };
}

function runJsonValidator(repoRoot, language, extractionInventoryPath = '') {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'cavalry-i18n-validator-'));
  const jsonReportPath = path.join(tempRoot, 'report.json');
  const markdownPath = path.join(tempRoot, 'summary.md');
  const args = ['tools/validate_translations.py', '--root', repoRoot, '--json-report', jsonReportPath, '--markdown-summary', markdownPath];
  if (extractionInventoryPath) {
    args.push('--extraction-inventory', extractionInventoryPath);
  }
  const result = spawnSync(
    'python3',
    args,
    {
      cwd: repoRoot,
      encoding: 'utf8',
    }
  );

  if (!fs.existsSync(jsonReportPath)) {
    fail(result.stderr || result.stdout || 'validate_translations.py failed');
  }

  const report = readJson(jsonReportPath);
  const alias = VALIDATOR_ALIASES[language];
  const languageReport = report.languages?.[alias];
  if (!languageReport) {
    fail(`Could not find JSON validation results for ${language}.`);
  }

  return {
    alias,
    coveragePct: Number((Number(languageReport.coverage || 0) * 100).toFixed(2)),
    exactEnglishTranslateLeaves: languageReport.exact_english_translate_leaves || 0,
    englishResidueCount: languageReport.english_residue_count || 0,
    structureIssueCount: languageReport.structure_issue_count || 0,
    noTranslateIssueCount: languageReport.no_translate_issue_count || 0,
    placeholderIssueCount: languageReport.placeholder_issue_count || 0,
    localeSyncIssueCount: languageReport.locale_sync_issue_count || 0,
    purityIssueCount: languageReport.purity_issue_count || 0,
    forbiddenPatternIssueCount: languageReport.forbidden_pattern_issue_count || 0,
    forbiddenPatterns: languageReport.forbidden_patterns || { total: 0, by_pattern: {}, samples: [] },
    denominatorSource: extractionInventoryPath ? 'extraction-inventory' : 'repo-english-files',
    pass:
      Number((Number(languageReport.coverage || 0) * 100).toFixed(2)) === 100 &&
      (languageReport.exact_english_translate_leaves || 0) === 0 &&
      (languageReport.structure_issue_count || 0) === 0 &&
      (languageReport.no_translate_issue_count || 0) === 0 &&
      (languageReport.placeholder_issue_count || 0) === 0 &&
      (languageReport.english_residue_count || 0) === 0 &&
      (languageReport.locale_sync_issue_count || 0) === 0 &&
      (languageReport.purity_issue_count || 0) === 0 &&
      (languageReport.forbidden_pattern_issue_count || 0) === 0,
  };
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const inventory = readJson(path.resolve(options.inventory));
  const allowlist = readJson(path.resolve(options.allowlist));
  const sourceMap = readJson(path.resolve(options.compiledSourceMap));
  const translations = loadTsTranslations(path.resolve(options.ts));
  const repoRoot = path.resolve(__dirname, '..');
  const extractionInventory =
    options.extractionInventory && fs.existsSync(path.resolve(options.extractionInventory))
      ? readJson(path.resolve(options.extractionInventory))
      : null;

  const runtime = buildCoverage(
    inventory,
    allowlist,
    translations,
    extractionInventory?.surfaces?.['runtime-candidates'] || null
  );
  const compiled = buildCompiledCoverage(
    sourceMap,
    translations,
    allowlist,
    extractionInventory?.surfaces?.['compiled-source-map'] || null
  );
  const jsonValidation = runJsonValidator(repoRoot, options.language, options.extractionInventory);

  const report = {
    language: options.language,
    threshold: options.threshold,
    runtime: {
      denominatorSource: runtime.denominatorSource,
      coveragePct: runtime.coveragePct,
      totalCandidates: runtime.totalCandidates,
      observedCandidateCount: runtime.observedCandidateCount,
      untranslatedCount: runtime.untranslatedCount,
      untranslated: runtime.untranslated.slice(0, options.maxReport),
      forbiddenPatterns: runtime.forbiddenPatterns,
    },
    compiled: {
      denominatorSource: compiled.denominatorSource,
      coveragePct: compiled.coveragePct,
      totalCandidates: compiled.totalCandidates,
      untranslatedCount: compiled.untranslatedCount,
      untranslated: compiled.untranslated.slice(0, options.maxReport),
    },
    jsonValidation,
  };

  const pass =
    report.runtime.coveragePct >= options.threshold &&
    report.compiled.coveragePct >= options.threshold &&
    jsonValidation.pass;

  report.pass = pass;
  console.log(JSON.stringify(report, null, 2));

  if (!pass) {
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  buildCompiledCoverage,
  compiledTranslationLookupKeys,
  loadTsTranslations,
  parseArgs,
  runJsonValidator,
  shouldCountCompiledCandidate,
};
