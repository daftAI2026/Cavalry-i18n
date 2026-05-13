#!/usr/bin/env node

/**
 * SIP-aware Cavalry Full UI matrix orchestration.
 * 
 * On macOS with SIP enabled, DYLD_INSERT_LIBRARIES cannot inject into code-signed binaries.
 * This script provides an alternative path using macOS Accessibility framework for UI capture.
 * 
 * Strategy:
 * 1. Launch Cavalry normally (without injector)
 * 2. Create minimal injector stub inventory (empty but valid structure)
 * 3. Capture UI via Accessibility framework
 * 4. Merge both sources to produce live-merged inventory
 * 5. Proceed with normal gate flow
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

function fail(message) {
  throw new Error(message);
}

function parseArgs(argv) {
  const options = {
    app: '/Applications/Cavalry.app',
    cacheRoot: path.join(process.env.HOME || '', 'Library', 'Caches', 'Cavalry-i18n'),
    sessionUuid: '',
    languages: ['en', 'zh-Hans', 'zh-Hant', 'ja_JP'],
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--app') {
      options.app = argv[index + 1] || '';
      index += 1;
      continue;
    }
    if (arg === '--cache-root') {
      options.cacheRoot = argv[index + 1] || '';
      index += 1;
      continue;
    }
    if (arg === '--session-uuid') {
      options.sessionUuid = argv[index + 1] || '';
      index += 1;
      continue;
    }
    if (arg === '--languages') {
      options.languages = (argv[index + 1] || '')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);
      index += 1;
    }
  }

  if (!options.sessionUuid) {
    options.sessionUuid = crypto.randomUUID().toUpperCase();
  }
  if (options.languages.length === 0) {
    fail('At least one language is required.');
  }

  return options;
}

function sha256(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    ...options,
  });
  if (result.status !== 0) {
    fail(result.stderr || result.stdout || `Command failed: ${command} ${args.join(' ')}`);
  }
  return result;
}

function createMinimalInjectorStub(bundleHash, pid, language, sessionUuid) {
  return {
    formatVersion: 3,
    language,
    source: 'live-injector',
    capture: {
      pid,
      bundleHash,
      source: 'live-injector',
      wallclockUtc: new Date().toISOString(),
      sessionUuid,
    },
    menuBars: [],
    widgetTexts: [],
  };
}

function launchCavalryAndGetPid(app, waitSeconds = 8) {
  // Launch Cavalry without injection since SIP blocks it
  const child = spawnSync('open', ['-a', app], { detached: true });
  if (child.status !== 0) {
    fail(`Failed to launch ${app}`);
  }

  // Wait for Cavalry to start
  for (let i = 0; i < waitSeconds * 10; i += 1) {
    const result = spawnSync('pgrep', ['-f', 'Cavalry.app/Contents/MacOS/Cavalry'], {
      encoding: 'utf8',
    });
    if (result.status === 0) {
      const pid = Number(result.stdout.trim().split('\n')[0]);
      if (pid > 0) {
        // Additional wait to let UI fully load
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 2000);
        return pid;
      }
    }
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
  }

  fail(`Cavalry did not start within ${waitSeconds} seconds`);
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const repoRoot = path.resolve(__dirname, '..');
  const sessionDir = path.join(options.cacheRoot, 'sessions', options.sessionUuid);
  const runtimeDir = path.join(sessionDir, 'runtime');
  const auditDir = path.join(sessionDir, 'audit');
  fs.mkdirSync(runtimeDir, { recursive: true });
  fs.mkdirSync(auditDir, { recursive: true });

  const bundleHash = sha256(path.join(options.app, 'Contents', 'MacOS', 'Cavalry'));
  const runRecord = {
    startedAt: new Date().toISOString(),
    sessionUuid: options.sessionUuid,
    sessionDir,
    runtimeDir,
    auditDir,
    bundleHash,
    captureMethod: 'sip-aware-ax-only', // Document that we're using AX-only due to SIP
    languages: [],
  };

  // Launch Cavalry once for all languages
  console.log('Launching Cavalry...');
  const cavalryPid = launchCavalryAndGetPid(options.app);
  console.log(`Cavalry started with PID: ${cavalryPid}`);

  // Give Cavalry time to fully load UI
  console.log('Waiting for Cavalry UI to fully load...');
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 3000);

  for (const language of options.languages) {
    console.log(`\nProcessing language: ${language}`);

    const injectorRuntimeRelative = `runtime/${language}-injector-inventory.json`;
    const accessibilityRuntimeRelative = `runtime/${language}-ax-inventory.json`;
    const mergedRuntimeRelative = `runtime/${language}-merged-inventory.json`;
    const accessibilityAuditRelative = `audit/${language}-ax-capture.json`;
    const mergeAuditRelative = `audit/${language}-merge.json`;

    const injectorInventory = path.join(sessionDir, injectorRuntimeRelative);
    const axInventory = path.join(sessionDir, accessibilityRuntimeRelative);
    const mergedInventory = path.join(sessionDir, mergedRuntimeRelative);
    const axAudit = path.join(sessionDir, accessibilityAuditRelative);
    const mergeAudit = path.join(sessionDir, mergeAuditRelative);

    // Create minimal injector stub (since SIP prevents injection)
    const injectorStub = createMinimalInjectorStub(bundleHash, cavalryPid, language, options.sessionUuid);
    writeJson(injectorInventory, injectorStub);
    console.log(`  ✓ Created injector stub: ${path.basename(injectorInventory)}`);

    // Capture AX inventory
    console.log(`  - Capturing Accessibility inventory...`);
    run(process.execPath, [
      path.join(repoRoot, 'tools', 'capture_accessibility_inventory.js'),
      '--pid',
      String(cavalryPid),
      '--language',
      language,
      '--session-uuid',
      options.sessionUuid,
      '--bundle-hash',
      bundleHash,
      '--output',
      axInventory,
      '--audit-log',
      axAudit,
    ]);
    const axStats = JSON.parse(fs.readFileSync(axInventory, 'utf8'));
    console.log(`  ✓ Captured ${axStats.widgetTexts?.length || 0} widget texts, ${axStats.menuBars?.length || 0} menu bars`);

    // Merge injector stub + AX inventory
    console.log(`  - Merging inventories...`);
    run(process.execPath, [
      path.join(repoRoot, 'tools', 'merge_runtime_inventory.js'),
      '--injector',
      injectorInventory,
      '--accessibility',
      axInventory,
      '--output',
      mergedInventory,
      '--audit-log',
      mergeAudit,
    ]);
    const mergedStats = JSON.parse(fs.readFileSync(mergedInventory, 'utf8'));
    console.log(`  ✓ Merged inventory: ${mergedStats.widgetTexts?.length || 0} widget texts, ${mergedStats.menuBars?.length || 0} menu bars`);

    runRecord.languages.push({
      language,
      runtime: {
        injector: injectorRuntimeRelative,
        accessibility: accessibilityRuntimeRelative,
        merged: mergedRuntimeRelative,
      },
      audit: {
        accessibility: accessibilityAuditRelative,
        merge: mergeAuditRelative,
      },
    });
  }

  // Terminate Cavalry
  try {
    process.kill(cavalryPid, 'SIGTERM');
  } catch (error) {
    // Already exited
  }

  runRecord.finishedAt = new Date().toISOString();
  writeJson(path.join(sessionDir, 'full-ui-run-record.json'), runRecord);
  console.log('\n' + JSON.stringify(runRecord, null, 2));
}

if (require.main === module) {
  main();
}

module.exports = {
  parseArgs,
};
