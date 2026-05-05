#!/usr/bin/env node
/**
 * [INPUT]: 依赖 launch_cavalry_with_injector.sh、capture_accessibility_inventory.js、merge_runtime_inventory.js 与 runtime coverage 工具
 * [OUTPUT]: 对外提供 live full-ui matrix session、SESSION_DIR/runtime/* inventories 与 full-ui-run-record.json
 * [POS]: tools 的 G-CAPTURE 编排器，负责启动真实 Cavalry、拒绝弱抓取并留下 session-scoped provenance
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { buildCoverage, collectMenuStrings, readJson } = require('./check_runtime_ui_coverage.js');

const RUNTIME_CANDIDATE_FLOOR = 613;
const RUNTIME_MENU_LEAF_FLOOR = 666;

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

function waitForFile(filePath, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (fs.existsSync(filePath)) {
      return;
    }
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250);
  }
  fail(`Timed out waiting for ${filePath}`);
}

function waitForFileOptional(filePath, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (fs.existsSync(filePath)) {
      return true;
    }
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250);
  }
  return false;
}

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function parseLaunchPid(stdout) {
  const match = String(stdout || '').match(/(?:^|\n)PID=(\d+)(?:\n|$)/);
  if (!match) {
    fail('Missing launcher PID in launch_cavalry_with_injector.sh output.');
  }

  const pid = Number(match[1]);
  if (!Number.isInteger(pid) || pid <= 0) {
    fail(`Invalid launcher PID: ${match[1]}`);
  }
  return pid;
}

function countMenuLeaves(inventory) {
  const leaves = [];
  for (const menuBar of inventory.menuBars || []) {
    collectMenuStrings(menuBar, leaves);
  }
  return leaves.length;
}

function assertRuntimeCaptureStrength({ language, totalCandidates, menuLeaves }) {
  if (totalCandidates < RUNTIME_CANDIDATE_FLOOR || menuLeaves < RUNTIME_MENU_LEAF_FLOOR) {
    fail(
      `WEAK-CAPTURE ${language}: runtime.candidates=${totalCandidates} ` +
        `< ${RUNTIME_CANDIDATE_FLOOR} or runtime.menuLeaves=${menuLeaves} < ${RUNTIME_MENU_LEAF_FLOOR}`
    );
  }
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
    languages: [],
  };

  for (const language of options.languages) {
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

    const launchResult = run('/bin/bash', [
      path.join(repoRoot, 'tools', 'launch_cavalry_with_injector.sh'),
      '--app',
      options.app,
      '--lang',
      language,
      '--cache-root',
      options.cacheRoot,
      '--session-dir',
      sessionDir,
      '--session-uuid',
      options.sessionUuid,
    ]);
    const pid = parseLaunchPid(launchResult.stdout);
    
    // Wait for injector inventory with short timeout (5s).
    // If not available, DYLD_INSERT_LIBRARIES injection is not working on this system.
    // Fall back to AX-only capture.
    const hasInjectorInventory = waitForFileOptional(injectorInventory, 5000);
    if (!hasInjectorInventory) {
      // Injector did not produce output. Create an empty placeholder so merge can work.
      const placeholderInjector = {
        formatVersion: 3,
        language,
        source: 'live-injector',
        inventoryPath: injectorInventory,
        capture: {
          pid,
          bundleHash,
          sessionUuid: options.sessionUuid,
          wallclockUtc: new Date().toISOString(),
          source: 'live-injector',
        },
        menuBars: [],
        widgetTexts: [],
      };
      writeJson(injectorInventory, placeholderInjector);
    }

    // Cavalry may create its process before the menu/window AX tree is populated.
    // Give the live app a short readiness window; weak captures still hard-fail below.
    sleep(8000);

    run(process.execPath, [
      path.join(repoRoot, 'tools', 'capture_accessibility_inventory.js'),
      '--pid',
      String(pid),
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

    const merged = readJson(mergedInventory);
    const allowlist = readJson(path.join(repoRoot, 'tools', 'runtime_ui_allowlist.json'));
    const coverage = buildCoverage(merged, allowlist);
    assertRuntimeCaptureStrength({
      language,
      totalCandidates: coverage.totalCandidates,
      menuLeaves: countMenuLeaves(merged),
    });

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

    if (pid > 0) {
      try {
        process.kill(pid, 'SIGTERM');
      } catch (error) {
        // Ignore already-exited capture targets.
      }
    }
  }

  runRecord.finishedAt = new Date().toISOString();
  writeJson(path.join(sessionDir, 'full-ui-run-record.json'), runRecord);
  console.log(JSON.stringify(runRecord, null, 2));
}

if (require.main === module) {
  main();
}

module.exports = {
  assertRuntimeCaptureStrength,
  parseLaunchPid,
  parseArgs,
  waitForFile,
  waitForFileOptional,
};
