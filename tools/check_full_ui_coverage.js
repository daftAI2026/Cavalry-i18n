#!/usr/bin/env node

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const {
  buildCoverage,
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

function fail(message) {
  throw new Error(message);
}

function parseArgs(argv) {
  const options = {
    language: '',
    inventory: '',
    compiledSourceMap: path.join(__dirname, '..', 'doc', 'compiled-ui-source-map.json'),
    ts: '',
    allowlist: path.join(__dirname, 'runtime_ui_allowlist.json'),
    threshold: 99,
    maxReport: 80,
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

  if (surfaceHint === 'menu-or-action-like') {
    return true;
  }

  if (/\s/.test(text)) {
    return true;
  }

  return /^[A-Z][a-z]+(?:['-][A-Za-z]+)?$/.test(text);
}

function buildCompiledCoverage(sourceMap, translations, allowlist) {
  const candidates = [];

  for (const entry of sourceMap.entries || []) {
    const text = normalizeText(entry.normalizedText || entry.text || '');
    if (!shouldCountCompiledCandidate(text, entry.surfaceHint || '', allowlist)) {
      continue;
    }
    candidates.push(text);
  }

  const uniqueCandidates = [...new Set(candidates)];
  const untranslated = uniqueCandidates.filter((candidate) => {
    const translation = normalizeText(translations.get(candidate) || '');
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
    totalCandidates: uniqueCandidates.length,
    untranslatedCount: untranslated.length,
    coveragePct,
    untranslated,
  };
}

function runJsonValidator(repoRoot, language) {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'cavalry-i18n-validator-'));
  const jsonReportPath = path.join(tempRoot, 'report.json');
  const markdownPath = path.join(tempRoot, 'summary.md');
  const result = spawnSync(
    'python3',
    ['tools/validate_translations.py', '--root', repoRoot, '--json-report', jsonReportPath, '--markdown-summary', markdownPath],
    {
      cwd: repoRoot,
      encoding: 'utf8',
    }
  );

  if (result.status !== 0) {
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
    englishResidueCount: languageReport.english_residue_count || 0,
    structureIssueCount: languageReport.structure_issue_count || 0,
    noTranslateIssueCount: languageReport.no_translate_issue_count || 0,
    placeholderIssueCount: languageReport.placeholder_issue_count || 0,
    localeSyncIssueCount: languageReport.locale_sync_issue_count || 0,
    purityIssueCount: languageReport.purity_issue_count || 0,
    pass:
      (languageReport.structure_issue_count || 0) === 0 &&
      (languageReport.no_translate_issue_count || 0) === 0 &&
      (languageReport.placeholder_issue_count || 0) === 0 &&
      (languageReport.english_residue_count || 0) === 0 &&
      (languageReport.locale_sync_issue_count || 0) === 0 &&
      (languageReport.purity_issue_count || 0) === 0,
  };
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const inventory = readJson(path.resolve(options.inventory));
  const allowlist = readJson(path.resolve(options.allowlist));
  const sourceMap = readJson(path.resolve(options.compiledSourceMap));
  const translations = loadTsTranslations(path.resolve(options.ts));
  const repoRoot = path.resolve(__dirname, '..');

  const runtime = buildCoverage(inventory, allowlist);
  const compiled = buildCompiledCoverage(sourceMap, translations, allowlist);
  const jsonValidation = runJsonValidator(repoRoot, options.language);

  const report = {
    language: options.language,
    threshold: options.threshold,
    runtime: {
      coveragePct: runtime.coveragePct,
      totalCandidates: runtime.totalCandidates,
      untranslatedCount: runtime.untranslatedCount,
      untranslated: runtime.untranslated.slice(0, options.maxReport),
    },
    compiled: {
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
  loadTsTranslations,
  parseArgs,
  runJsonValidator,
  shouldCountCompiledCandidate,
};
