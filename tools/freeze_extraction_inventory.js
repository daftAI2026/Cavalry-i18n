#!/usr/bin/env node

/**
 * freeze_extraction_inventory.js
 * Freezes the complete English denominator for full-ui-100 workflow.
 * Extracts from:
 * - JSON: /Applications/Cavalry.app/Contents/assets
 * - Compiled: Source map from live extraction
 * - Runtime: Merged inventory from capture
 */

const { readFileSync, writeFileSync, existsSync, statSync } = require('node:fs');
const { execSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const { join } = require('node:path');
const { homedir } = require('node:os');

const OPTIONS = parseArgs();
const REPO_ROOT = join(__dirname, '..');
const CACHE_ROOT = join(homedir(), 'Library', 'Caches', 'Cavalry-i18n');
const CAVALRY_APP_PATH = '/Applications/Cavalry.app';

function parseArgs() {
  const opts = { sessionDir: '', lang: 'en' };
  for (let i = 0; i < process.argv.length; i++) {
    if (process.argv[i] === '--session-dir') opts.sessionDir = process.argv[++i];
    if (process.argv[i] === '--lang') opts.lang = process.argv[++i];
  }
  if (!opts.sessionDir) {
    console.error('Usage: freeze_extraction_inventory.js --session-dir <path>');
    process.exit(1);
  }
  return opts;
}

function hashFile(path) {
  if (!existsSync(path)) return '';
  try {
    const content = readFileSync(path, 'utf8');
    return createHash('sha256').update(content).digest('hex');
  } catch (err) {
    console.warn(`Warning: Could not hash ${path}: ${err.message}`);
    return '';
  }
}

function getFileStats(path) {
  if (!existsSync(path)) return null;
  try {
    const stats = statSync(path);
    return {
      path: path,
      sha256: hashFile(path),
      mtime: stats.mtime.toISOString(),
      size: stats.size,
    };
  } catch (err) {
    console.warn(`Warning: Could not stat ${path}: ${err.message}`);
    return null;
  }
}

function extractJsonSurface() {
  const surfaces = {};

  ['appStrings', 'nodeStrings', 'onboarding', 'tips'].forEach((surface) => {
    const appAssetPath = join(CAVALRY_APP_PATH, 'Contents', 'assets', `${surface}.json`);
    const repoPath = join(REPO_ROOT, 'languages', 'en', `${surface}.json`);

    const leaves = [];
    let source = null;

    // Try app assets first (2.7.1 preferred)
    if (existsSync(appAssetPath)) {
      try {
        const content = JSON.parse(readFileSync(appAssetPath, 'utf8'));
        if (Array.isArray(content)) {
          content.forEach((item) => {
            if (item.source) leaves.push(item.source);
          });
        }
        source = appAssetPath;
      } catch (err) {
        console.warn(`Warning: Could not parse app assets ${appAssetPath}`);
      }
    }

    // Fallback to repo
    if (!source && existsSync(repoPath)) {
      try {
        const content = JSON.parse(readFileSync(repoPath, 'utf8'));
        if (Array.isArray(content)) {
          content.forEach((item) => {
            if (item.source) leaves.push(item.source);
          });
        }
        source = repoPath;
      } catch (err) {
        console.warn(`Warning: Could not parse repo ${repoPath}`);
      }
    }

    if (source) {
      const stats = getFileStats(source);
      surfaces[surface] = {
        source: stats,
        count: leaves.length,
        englishLeaves: leaves,
        extractor: { name: 'freeze_extraction_inventory.js', version: '1.0' },
      };
    }
  });

  return surfaces;
}

function extractCompiledSurface() {
  const sourceMapPath = join(CACHE_ROOT, 'compiled-ui-source-map.json');

  if (!existsSync(sourceMapPath)) {
    console.warn('Warning: compiled-ui-source-map.json not found, skipping compiled surface');
    return {
      compiled: {
        source: null,
        count: 0,
        englishLeaves: [],
        extractor: { name: 'extract_compiled_ui_strings.js', version: '1.0' },
      },
    };
  }

  try {
    const content = JSON.parse(readFileSync(sourceMapPath, 'utf8'));
    const leaves = [];

    if (Array.isArray(content.entries)) {
      content.entries.forEach((entry) => {
        if (entry.string) leaves.push(entry.string);
      });
    } else if (content.entries) {
      Object.values(content.entries).forEach((entry) => {
        if (entry.string) leaves.push(entry.string);
      });
    }

    const stats = getFileStats(sourceMapPath);
    return {
      compiled: {
        source: stats,
        count: leaves.length,
        englishLeaves: leaves,
        extractor: { name: 'extract_compiled_ui_strings.js', version: '1.0' },
      },
    };
  } catch (err) {
    console.warn(`Warning: Could not parse source map: ${err.message}`);
    return {
      compiled: {
        source: null,
        count: 0,
        englishLeaves: [],
        extractor: { name: 'extract_compiled_ui_strings.js', version: '1.0' },
      },
    };
  }
}

function extractRuntimeSurface() {
  const runtimeDir = join(OPTIONS.sessionDir, 'runtime');
  const mergedPath = join(runtimeDir, 'en-merged-inventory.json');

  if (!existsSync(mergedPath)) {
    console.warn('Warning: Runtime merged inventory not found');
    return {
      runtime: {
        source: null,
        count: 0,
        englishLeaves: [],
        candidates: 0,
        menuLeaves: 0,
        extractor: { name: 'merge_runtime_inventory.js', version: '1.0' },
      },
    };
  }

  try {
    const content = JSON.parse(readFileSync(mergedPath, 'utf8'));
    const leaves = [];

    // Collect all visible text from widgets and menus
    if (Array.isArray(content.widgetTexts)) {
      content.widgetTexts.forEach((item) => {
        if (typeof item === 'string') leaves.push(item);
        else if (item.text) leaves.push(item.text);
      });
    }

    const stats = getFileStats(mergedPath);
    return {
      runtime: {
        source: stats,
        count: leaves.length,
        englishLeaves: leaves,
        candidates: content.candidates || 0,
        menuLeaves: content.menuLeaves || 0,
        extractor: { name: 'merge_runtime_inventory.js', version: '1.0' },
      },
    };
  } catch (err) {
    console.warn(`Warning: Could not parse runtime inventory: ${err.message}`);
    return {
      runtime: {
        source: null,
        count: 0,
        englishLeaves: [],
        candidates: 0,
        menuLeaves: 0,
        extractor: { name: 'merge_runtime_inventory.js', version: '1.0' },
      },
    };
  }
}

function getTargetIdentity() {
  try {
    const plistPath = join(CAVALRY_APP_PATH, 'Contents', 'Info.plist');
    const versionOutput = execSync(`defaults read "${plistPath}" CFBundleShortVersionString`, {
      encoding: 'utf8',
    }).trim();

    const hashOutput = execSync(
      `md5 "${join(CAVALRY_APP_PATH, 'Contents', 'MacOS', 'Cavalry')}"`,
      { encoding: 'utf8' }
    ).trim();
    const bundleHash = hashOutput.split('=').pop().trim();

    return {
      appPath: CAVALRY_APP_PATH,
      cavalryVersion: versionOutput,
      qtVersion: '6.6.3',
      bundleHash: bundleHash,
    };
  } catch (err) {
    console.warn(`Warning: Could not get target identity: ${err.message}`);
    return {
      appPath: CAVALRY_APP_PATH,
      cavalryVersion: 'unknown',
      qtVersion: 'unknown',
      bundleHash: '',
    };
  }
}

async function freezeInventory() {
  console.log('🔒 Freezing extraction inventory...\n');

  const target = getTargetIdentity();
  console.log(`Target: Cavalry ${target.cavalryVersion} / Qt ${target.qtVersion}`);

  const json = extractJsonSurface();
  const compiled = extractCompiledSurface();
  const runtime = extractRuntimeSurface();

  // Calculate totals
  const jsonTotal = Object.values(json).reduce((sum, s) => sum + (s.count || 0), 0);
  const compiledTotal = compiled.compiled.count || 0;
  const runtimeTotal = runtime.runtime.count || 0;

  console.log(`\n📊 Extraction Summary:`);
  console.log(`  JSON total: ${jsonTotal} leaves`);
  console.log(`  Compiled: ${compiledTotal} entries`);
  console.log(`  Runtime: ${runtimeTotal} candidates, ${runtime.runtime.menuLeaves} menu leaves`);

  // Build extraction inventory
  const extraction = {
    formatVersion: 1,
    frozenAtUtc: new Date().toISOString(),
    target: target,
    sources: {
      json: json,
      compiled: compiled.compiled,
      runtime: runtime.runtime,
    },
    totals: {
      json: jsonTotal,
      compiled: compiledTotal,
      runtime: runtimeTotal,
    },
    lowerBounds: {
      json_appStrings: 10,
      json_nodeStrings: 6320,
      json_onboarding: 34,
      json_tips: 51,
      json_total: 6415,
      compiled: 4743,
      runtime_candidates: 613,
      runtime_menuLeaves: 666,
    },
  };

  // Validate against lower bounds
  let passValidation = true;
  const fails = [];

  if ((json.appStrings?.count || 0) < 10) fails.push(`appStrings ${json.appStrings?.count || 0} < 10`);
  if ((json.nodeStrings?.count || 0) < 6320) fails.push(`nodeStrings ${json.nodeStrings?.count || 0} < 6320`);
  if ((json.onboarding?.count || 0) < 34) fails.push(`onboarding ${json.onboarding?.count || 0} < 34`);
  if ((json.tips?.count || 0) < 51) fails.push(`tips ${json.tips?.count || 0} < 51`);
  if (jsonTotal < 6415) fails.push(`JSON total ${jsonTotal} < 6415`);
  if (compiledTotal < 4743) fails.push(`compiled ${compiledTotal} < 4743`);
  if ((runtime.runtime.candidates || 0) < 613) fails.push(`runtime.candidates ${runtime.runtime.candidates || 0} < 613`);
  if ((runtime.runtime.menuLeaves || 0) < 666) fails.push(`runtime.menuLeaves ${runtime.runtime.menuLeaves || 0} < 666`);

  if (fails.length > 0) {
    console.log(`\n⚠️  Lower bound violations:`);
    fails.forEach(f => console.log(`  ${f}`));
    passValidation = false;
  }

  extraction.passValidation = passValidation;

  // Write to file
  const extractionPath = join(OPTIONS.sessionDir, 'extraction-inventory.json');
  writeFileSync(extractionPath, JSON.stringify(extraction, null, 2));
  console.log(`\n✓ Extraction inventory frozen: ${extractionPath}`);

  return extraction;
}

async function main() {
  try {
    await freezeInventory();
  } catch (err) {
    console.error(`✗ Freeze failed: ${err.message}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(`Fatal: ${err.message}`);
  process.exit(1);
});
