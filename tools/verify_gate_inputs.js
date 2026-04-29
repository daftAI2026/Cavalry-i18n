#!/usr/bin/env node

/**
 * verify_gate_inputs.js
 * Pre-flight validation for full-ui gate inputs.
 * Ensures inputs come from live capture, not fixtures or curated sources.
 */

const { existsSync, readdirSync } = require('node:fs');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { homedir } = require('node:os');

const REPO_ROOT = join(__dirname, '..');
const CACHE_ROOT = join(homedir(), 'Library', 'Caches', 'Cavalry-i18n');
const SESSION_DIR = process.env.CAVALRY_I18N_SESSION_DIR || '';

const ERRORS = [];
const WARNINGS = [];

function fail(msg) {
  ERRORS.push(msg);
}

function warn(msg) {
  WARNINGS.push(msg);
}

function checkFixtures() {
  const fixtureDir = join(REPO_ROOT, 'tools', 'full_ui_inventory_fixtures');
  if (existsSync(fixtureDir)) {
    fail(`✗ FORBIDDEN: tools/full_ui_inventory_fixtures directory exists`);
  }
}

function checkCuratedFiles() {
  const curatedFile = join(REPO_ROOT, 'doc', 'libExtensionLayer-curated-ui.txt');
  if (existsSync(curatedFile)) {
    fail(`✗ FORBIDDEN: doc/libExtensionLayer-curated-ui.txt exists`);
  }
}

function checkPackageJson() {
  const packagePath = join(REPO_ROOT, 'package.json');
  if (existsSync(packagePath)) {
    try {
      const pkg = JSON.parse(readFileSync(packagePath, 'utf8'));
      if (pkg.scripts && pkg.scripts['prepare:full-ui-gate']) {
        fail(`✗ FORBIDDEN: package.json contains prepare:full-ui-gate`);
      }
    } catch {
      warn(`⚠ Could not parse package.json`);
    }
  }
}

function checkRuntimeInputs() {
  // Check that no root-cache inventories are being read
  const cacheRuntimeFiles = join(CACHE_ROOT, '*-inventory.json');
  const cacheFiles = readdirSync(CACHE_ROOT).filter(f => f.endsWith('-inventory.json'));
  
  if (cacheFiles.length > 0) {
    warn(`⚠ Root cache contains legacy runtime inventories: ${cacheFiles.join(', ')}`);
    warn(`   Ensure matrix reads from SESSION_DIR only, not from root cache`);
  }

  // Check for session-scoped runtime directory
  if (SESSION_DIR && existsSync(SESSION_DIR)) {
    const runtimeDir = join(SESSION_DIR, 'runtime');
    if (existsSync(runtimeDir)) {
      console.log(`✓ SESSION_DIR runtime directory exists: ${runtimeDir}`);
    } else {
      warn(`⚠ No runtime directory in SESSION_DIR yet`);
    }
  } else if (!SESSION_DIR) {
    warn(`⚠ CAVALRY_I18N_SESSION_DIR not set - session scoping may not work`);
  }
}

function checkSourceMapProvenance() {
  const sourceMapPath = join(CACHE_ROOT, 'compiled-ui-source-map.json');
  if (existsSync(sourceMapPath)) {
    try {
      const sourceMap = JSON.parse(readFileSync(sourceMapPath, 'utf8'));
      
      if (sourceMap.kind === 'curated' || sourceMap.kind === 'whitelisted' || sourceMap.kind === 'gated') {
        fail(`✗ SOURCE_MAP kind is "${sourceMap.kind}", must be raw extraction`);
      }
      
      if (!sourceMap.entries) {
        warn(`⚠ SOURCE_MAP missing entries field`);
      } else {
        console.log(`✓ SOURCE_MAP entries count: ${sourceMap.entries.length}`);
      }
    } catch (err) {
      warn(`⚠ Could not parse SOURCE_MAP: ${err.message}`);
    }
  } else {
    warn(`⚠ SOURCE_MAP not found at ${sourceMapPath}`);
  }
}

function checkRuntimeInventoryProvenance() {
  if (!SESSION_DIR || !existsSync(SESSION_DIR)) {
    return;
  }

  const runtimeDir = join(SESSION_DIR, 'runtime');
  if (!existsSync(runtimeDir)) {
    return;
  }

  const inventories = readdirSync(runtimeDir)
    .filter(f => f.endsWith('-inventory.json'))
    .map(f => join(runtimeDir, f));

  for (const inventoryPath of inventories) {
    try {
      const inventory = JSON.parse(readFileSync(inventoryPath, 'utf8'));
      
      // Check capture metadata
      if (!inventory.capture) {
        fail(`✗ ${inventoryPath}: missing capture metadata`);
      } else {
        const { pid, bundleHash, sessionUuid, source } = inventory.capture;
        
        if (!source || !['live-injector', 'live-accessibility', 'live-merged'].includes(source)) {
          fail(`✗ ${inventoryPath}: capture.source must be live-* not "${source}"`);
        }
        
        if (!bundleHash) {
          warn(`⚠ ${inventoryPath}: capture.bundleHash not set`);
        }
        
        if (!sessionUuid) {
          warn(`⚠ ${inventoryPath}: capture.sessionUuid not set`);
        }
      }

      console.log(`✓ ${require('path').basename(inventoryPath)}: provenance OK`);
    } catch (err) {
      warn(`⚠ Could not parse ${inventoryPath}: ${err.message}`);
    }
  }
}

async function main() {
  console.log('🔍 Verifying gate inputs...\n');

  checkFixtures();
  checkCuratedFiles();
  checkPackageJson();
  checkRuntimeInputs();
  checkSourceMapProvenance();
  checkRuntimeInventoryProvenance();

  if (WARNINGS.length > 0) {
    console.log('\n⚠️  Warnings:');
    WARNINGS.forEach(w => console.log(`  ${w}`));
  }

  if (ERRORS.length > 0) {
    console.error('\n❌ Gate input verification FAILED:');
    ERRORS.forEach(e => console.error(`  ${e}`));
    process.exit(1);
  }

  console.log('\n✅ Gate input verification PASSED');
  process.exit(0);
}

main().catch((err) => {
  console.error(`Fatal: ${err.message}`);
  process.exit(1);
});
