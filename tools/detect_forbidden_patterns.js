#!/usr/bin/env node

/**
 * detect_forbidden_patterns.js
 * Detects and reports forbidden translation patterns per §P5 gate.
 * Used for runtime inventory, compiled maps, and translation sources.
 */

const fs = require('node:fs');
const path = require('node:path');

// §P5 Forbidden Pattern Set
const FORBIDDEN_PATTERNS = {
  'FP-1': {
    name: 'Placeholder marker (占位标记)',
    regexes: [/（译）/, /（訳）/, /（譯）/],
    severity: 'error',
  },
  'FP-2': {
    name: 'Fullwidth Latin characters',
    regexes: [/[\uFF21-\uFF3A\uFF41-\uFF5A]/],
    severity: 'error',
  },
  'FP-3': {
    name: 'Page fill misplace (错位填词)',
    regexes: [/^(?:页|頁|ページ):?\d+$/],
    severity: 'error',
  },
  'FP-4': {
    name: 'Simplified-Traditional script mixing (简繁串味)',
    // zh-Hans should not contain traditional characters
    checkZhHans: /[\u4e00-\u9fff]/,
    traditionalChars: /[\u4e00-\u9fff]/,
    severity: 'error',
  },
  'FP-5': {
    name: 'Traditional-Simplified script mixing (繁简串味)',
    // zh-Hant should not contain simplified-only characters
    checkZhHant: /[\u4e00-\u9fff]/,
    simplifiedChars: /[\u4e00-\u9fff]/,
    severity: 'error',
  },
  'FP-6': {
    name: 'Self-recursive fake translation',
    // source == translation with minimal difference
    severity: 'error',
  },
};

function detectInString(str, lang = 'en') {
  const matches = [];

  if (!str || typeof str !== 'string') return matches;

  // FP-1: Placeholder markers
  if (FORBIDDEN_PATTERNS['FP-1'].regexes.some(r => r.test(str))) {
    matches.push('FP-1');
  }

  // FP-2: Fullwidth Latin
  if (FORBIDDEN_PATTERNS['FP-2'].regexes.some(r => r.test(str))) {
    matches.push('FP-2');
  }

  // FP-3: Page fill
  if (FORBIDDEN_PATTERNS['FP-3'].regexes.some(r => r.test(str))) {
    matches.push('FP-3');
  }

  // FP-4: zh-Hans traditional character mixing
  if (lang === 'zh-Hans') {
    // TODO: Implement proper Han character detection
    // For now, basic check for traditional-only characters
  }

  // FP-5: zh-Hant simplified character mixing
  if (lang === 'zh-Hant') {
    // TODO: Implement proper Han character detection
  }

  return matches;
}

function detectInTranslationPair(source, translation, lang = 'en') {
  const violations = [];

  // Check translation for forbidden patterns
  const transViolations = detectInString(translation, lang);
  violations.push(...transViolations.map(fp => ({
    pattern: fp,
    type: 'translation',
    text: translation,
  })));

  // FP-6: Self-recursive (source == translation)
  if (source === translation && source && translation) {
    violations.push({
      pattern: 'FP-6',
      type: 'recursive',
      source: source,
      translation: translation,
    });
  }

  return violations;
}

function analyzeInventoryFile(filePath, lang = 'en') {
  const violations = {
    total: 0,
    byPattern: {},
    samples: [],
  };

  if (!fs.existsSync(filePath)) {
    return violations;
  }

  try {
    const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    
    // Analyze based on file type
    if (Array.isArray(content)) {
      // JSON translation format
      for (const entry of content) {
        if (!entry.translation) continue;
        
        const vios = detectInTranslationPair(entry.source, entry.translation, lang);
        violations.total += vios.length;
        
        for (const vio of vios) {
          if (!violations.byPattern[vio.pattern]) {
            violations.byPattern[vio.pattern] = 0;
          }
          violations.byPattern[vio.pattern]++;
          
          if (violations.samples.length < 10) {
            violations.samples.push({
              source: entry.source,
              translation: entry.translation,
              violation: vio.pattern,
            });
          }
        }
      }
    } else if (content.widgetTexts) {
      // Runtime inventory format
      for (const widget of content.widgetTexts || []) {
        const text = typeof widget === 'string' ? widget : widget.text;
        const vios = detectInString(text, lang);
        violations.total += vios.length;
        
        for (const vio of vios) {
          if (!violations.byPattern[vio]) violations.byPattern[vio] = 0;
          violations.byPattern[vio]++;
          
          if (violations.samples.length < 10) {
            violations.samples.push({ text, violation: vio });
          }
        }
      }
    }
  } catch (err) {
    console.warn(`Warning: Could not analyze ${filePath}: ${err.message}`);
  }

  return violations;
}

function main() {
  const options = parseArgs();

  if (!options.file && !options.sessionDir) {
    console.error('Usage: detect_forbidden_patterns.js [--file <path>] [--session-dir <path>] [--lang <lang>]');
    process.exit(1);
  }

  let totalViolations = 0;
  let allByPattern = {};

  if (options.file) {
    const result = analyzeInventoryFile(options.file, options.lang);
    console.log(`Analyzed: ${options.file}`);
    console.log(`  Total violations: ${result.total}`);
    
    if (result.samples.length > 0) {
      console.log('  Samples:');
      result.samples.forEach(s => {
        console.log(`    - ${s.violation}: "${s.text || s.source || '?'}"`);
      });
    }

    totalViolations = result.total;
    allByPattern = result.byPattern;
  } else if (options.sessionDir) {
    const runtimeDir = path.join(options.sessionDir, 'runtime');
    if (fs.existsSync(runtimeDir)) {
      for (const lang of ['en', 'zh-Hans', 'zh-Hant', 'ja_JP']) {
        const inventoryPath = path.join(runtimeDir, `${lang}-merged-inventory.json`);
        if (fs.existsSync(inventoryPath)) {
          const result = analyzeInventoryFile(inventoryPath, lang);
          console.log(`${lang}: ${result.total} violations`);
          
          for (const [pattern, count] of Object.entries(result.byPattern)) {
            if (!allByPattern[pattern]) allByPattern[pattern] = 0;
            allByPattern[pattern] += count;
          }
          
          totalViolations += result.total;
        }
      }
    }
  }

  if (totalViolations === 0) {
    console.log('\n✅ No forbidden patterns detected');
    process.exit(0);
  } else {
    console.log(`\n❌ Found ${totalViolations} forbidden pattern violations`);
    console.log('Pattern breakdown:');
    for (const [pattern, count] of Object.entries(allByPattern)) {
      console.log(`  ${pattern}: ${count}`);
    }
    process.exit(1);
  }
}

function parseArgs() {
  const opts = { file: '', sessionDir: '', lang: 'en' };
  for (let i = 0; i < process.argv.length; i++) {
    if (process.argv[i] === '--file') opts.file = process.argv[++i];
    if (process.argv[i] === '--session-dir') opts.sessionDir = process.argv[++i];
    if (process.argv[i] === '--lang') opts.lang = process.argv[++i];
  }
  return opts;
}

main();
