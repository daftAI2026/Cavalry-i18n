/**
 * [INPUT]: 依赖 forbidden_translation_patterns.json 与 runtime_ui_allowlist.json 的 §P5 规则配置
 * [OUTPUT]: 对外提供 detectForbiddenTranslationPatterns，检测 FP-1/2/3/4/5/7/8/9/10/11 单条翻译反模式
 * [POS]: tools 的 Node 共享 forbidden-pattern detector，被 runtime/full-ui gate 与契约测试复用；FP-12 由 validator 聚合检测
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

const fs = require('node:fs');
const path = require('node:path');

const PATTERN_CONFIG = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'forbidden_translation_patterns.json'), 'utf8')
);

const REGEX_PATTERNS = (PATTERN_CONFIG.regexPatterns || []).map((pattern) => ({
  ...pattern,
  expression: new RegExp(pattern.regex),
}));
const SOURCE_PATTERNS = (PATTERN_CONFIG.sourcePatterns || []).map((pattern) => ({
  ...pattern,
  expression: new RegExp(pattern.regex),
}));
const CONTEXT_PATTERNS = (PATTERN_CONFIG.contextPatterns || []).map((pattern) => ({
  ...pattern,
  expression: new RegExp(pattern.regex),
}));

function loadAllowlistTokens(relPath) {
  if (!relPath) return [];
  const resolved = path.join(__dirname, '..', relPath);
  if (!fs.existsSync(resolved)) return [];
  let data;
  try {
    data = JSON.parse(fs.readFileSync(resolved, 'utf8'));
  } catch {
    return [];
  }
  const tokens = [];
  if (Array.isArray(data)) {
    for (const v of data) if (typeof v === 'string') tokens.push(v);
  } else if (data && typeof data === 'object') {
    for (const v of Object.values(data)) {
      if (Array.isArray(v)) {
        for (const x of v) if (typeof x === 'string') tokens.push(x);
      }
    }
  }
  return tokens;
}

const LATIN_RESIDUE_CFG = PATTERN_CONFIG.latinResidue || {};
const LATIN_RESERVED = new Set([
  ...(LATIN_RESIDUE_CFG.reservedTokens || []),
  ...loadAllowlistTokens(LATIN_RESIDUE_CFG.extraReservedFromAllowlist),
]);
const LATIN_RESERVED_LOWER = new Set([...LATIN_RESERVED].map((t) => t.toLowerCase()));
const LATIN_TOKEN_RE = /[A-Za-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u017F]+/g;
const CJK_RE = /[\u4e00-\u9fff\u3040-\u30ff]/;
const TRANSLITERATION_CFG = PATTERN_CONFIG.transliterationBan || {};
const TRANSLITERATION_SOURCE_DENYLIST = new Set(TRANSLITERATION_CFG.sourceDenylist || []);
const PANGRAM_CFG = PATTERN_CONFIG.pangramNoise || {};
const PANGRAM_PATTERNS = (PANGRAM_CFG.sourcePatterns || []).map((pattern) => ({
  ...pattern,
  expression: new RegExp(pattern.regex),
}));

function normalizeText(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function findFrankensteinResidue(language, value) {
  const cfg = LATIN_RESIDUE_CFG;
  if (!cfg || !cfg.appliesToLanguages) return null;
  if (!cfg.appliesToLanguages.includes(language)) return null;
  if (!CJK_RE.test(value)) return null;
  const minLen = Number(cfg.minTokenLength || 2);
  const ignoreAcronyms = cfg.ignoreAllUppercaseAcronyms !== false;
  const ignoreSingle = cfg.ignoreSingleLetters !== false;
  let match;
  LATIN_TOKEN_RE.lastIndex = 0;
  while ((match = LATIN_TOKEN_RE.exec(value)) !== null) {
    const token = match[0];
    if (ignoreSingle && token.length <= 1) continue;
    if (token.length < minLen) continue;
    if (LATIN_RESERVED.has(token) || LATIN_RESERVED_LOWER.has(token.toLowerCase())) continue;
    if (ignoreAcronyms && token === token.toUpperCase() && token.length >= 2) continue;
    return token;
  }
  return null;
}

function isTransliterationFabrication(source, value) {
  if (!source || !value || source === value) return false;
  if (!CJK_RE.test(value)) return false;
  return TRANSLITERATION_SOURCE_DENYLIST.has(source);
}

function isPangramNoiseFabrication(source, value) {
  if (!source || !value || source === value) return false;
  return PANGRAM_PATTERNS.some((pattern) => pattern.expression.test(source));
}

function detectForbiddenTranslationPatterns({
  language = '',
  value = '',
  sourceText = '',
  context = '',
} = {}) {
  const hits = [];
  const normalizedValue = normalizeText(value);
  const normalizedSource = normalizeText(sourceText);
  const normalizedContext = normalizeText(context);

  // FP-1/2/3: translation regex
  if (normalizedValue) {
    for (const pattern of REGEX_PATTERNS) {
      if (!pattern.expression.test(normalizedValue)) continue;
      hits.push({
        id: pattern.id,
        detail: pattern.description,
        value: normalizedValue,
      });
    }

    const languagePattern = PATTERN_CONFIG.languageTermPatterns?.[language];
    if (languagePattern) {
      for (const [term, hint] of Object.entries(languagePattern.terms || {})) {
        if (!normalizedValue.includes(term)) continue;
        hits.push({
          id: languagePattern.id,
          detail: `${languagePattern.description}: ${term} -> ${hint}`,
          value: normalizedValue,
        });
        break;
      }
    }
  }

  // FP-7: synthetic source id
  if (normalizedSource) {
    for (const pattern of SOURCE_PATTERNS) {
      if (!pattern.expression.test(normalizedSource)) continue;
      hits.push({
        id: pattern.id,
        detail: pattern.description,
        value: normalizedSource,
      });
    }
  }

  // FP-8: fake Qt context
  if (normalizedContext) {
    for (const pattern of CONTEXT_PATTERNS) {
      if (!pattern.expression.test(normalizedContext)) continue;
      hits.push({
        id: pattern.id,
        detail: pattern.description,
        value: normalizedContext,
      });
    }
  }

  // FP-10: transliteration of meaningless/font/glyph source strings
  if (isTransliterationFabrication(normalizedSource, normalizedValue)) {
    hits.push({
      id: TRANSLITERATION_CFG.id || 'FP-10',
      detail: TRANSLITERATION_CFG.description || 'transliteration of no-translate source string',
      value: normalizedSource,
    });
  }

  // FP-11: font sample/pangram noise translated as UI copy
  if (isPangramNoiseFabrication(normalizedSource, normalizedValue)) {
    hits.push({
      id: PANGRAM_CFG.id || 'FP-11',
      detail: PANGRAM_CFG.description || 'font sample pangram translated as UI copy',
      value: normalizedSource,
    });
  }

  // FP-9: Frankenstein Latin residue
  if (normalizedValue) {
    const residue = findFrankensteinResidue(language, normalizedValue);
    if (residue) {
      hits.push({
        id: LATIN_RESIDUE_CFG.id || 'FP-9',
        detail: `${LATIN_RESIDUE_CFG.description || 'Frankenstein residue'}: unreserved Latin token '${residue}'`,
        value: normalizedValue,
      });
    }
  }

  return hits;
}

module.exports = {
  PATTERN_CONFIG,
  detectForbiddenTranslationPatterns,
  normalizeText,
};
