const fs = require('node:fs');
const path = require('node:path');

const PATTERN_CONFIG = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'forbidden_translation_patterns.json'), 'utf8')
);

const REGEX_PATTERNS = PATTERN_CONFIG.regexPatterns.map((pattern) => ({
  ...pattern,
  expression: new RegExp(pattern.regex),
}));

function normalizeText(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripRecursiveSuffixes(value) {
  let normalized = normalizeText(value);
  for (const suffix of PATTERN_CONFIG.recursiveSuffixes || []) {
    if (normalized.endsWith(suffix)) {
      normalized = normalizeText(normalized.slice(0, -suffix.length));
    }
  }
  return normalized;
}

function detectForbiddenTranslationPatterns({ language = '', value = '', sourceText = '' } = {}) {
  const hits = [];
  const normalizedValue = normalizeText(value);
  if (!normalizedValue) {
    return hits;
  }

  for (const pattern of REGEX_PATTERNS) {
    if (!pattern.expression.test(normalizedValue)) {
      continue;
    }
    hits.push({
      id: pattern.id,
      detail: pattern.description,
      value: normalizedValue,
    });
  }

  const languagePattern = PATTERN_CONFIG.languageTermPatterns?.[language];
  if (languagePattern) {
    for (const [term, hint] of Object.entries(languagePattern.terms || {})) {
      if (!normalizedValue.includes(term)) {
        continue;
      }
      hits.push({
        id: languagePattern.id,
        detail: `${languagePattern.description}: ${term} -> ${hint}`,
        value: normalizedValue,
      });
      break;
    }
  }

  const normalizedSource = normalizeText(sourceText);
  const strippedRecursiveValue = stripRecursiveSuffixes(normalizedValue);
  if (
    normalizedSource &&
    strippedRecursiveValue !== normalizedValue &&
    strippedRecursiveValue === normalizedSource
  ) {
    hits.push({
      id: 'FP-6',
      detail: 'source-recursive pseudo translation',
      value: normalizedValue,
    });
  }

  return hits;
}

module.exports = {
  PATTERN_CONFIG,
  detectForbiddenTranslationPatterns,
  normalizeText,
  stripRecursiveSuffixes,
};
