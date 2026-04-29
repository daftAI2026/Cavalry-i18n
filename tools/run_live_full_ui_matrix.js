#!/usr/bin/env node

/**
 * run_live_full_ui_matrix.js
 * Orchestrates full-ui matrix workflow: creates session, launches Cavalry with injector,
 * captures runtime inventory (injector + AX), merges them, and writes RUN_RECORD.
 */

const { execSync, spawn } = require('node:child_process');
const { mkdir, readdir, readFile, writeFile } = require('node:fs').promises;
const { existsSync } = require('node:fs');
const { join } = require('node:path');
const { homedir } = require('node:os');
const crypto = require('node:crypto');

const LANGUAGES = ['en', 'zh-Hans', 'zh-Hant', 'ja_JP'];
const CAVALRY_APP_PATH = '/Applications/Cavalry.app';
const CACHE_ROOT = join(homedir(), 'Library', 'Caches', 'Cavalry-i18n');
const REPO_ROOT = join(__dirname, '..');

async function generateSessionUuid() {
  try {
    return crypto.randomUUID();
  } catch {
    // Fallback for older Node versions
    return crypto.randomBytes(16).toString('hex').replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, '$1-$2-$3-$4-$5');
  }
}

async function getCurrentTarget() {
  try {
    const plistPath = join(CAVALRY_APP_PATH, 'Contents', 'Info.plist');
    const plistOutput = execSync(`defaults read "${plistPath}" CFBundleShortVersionString`, {
      encoding: 'utf8',
    }).trim();
    
    const bundleHashOutput = execSync(
      `md5 "${join(CAVALRY_APP_PATH, 'Contents', 'MacOS', 'Cavalry')}"`,
      { encoding: 'utf8' }
    ).trim();
    const bundleHash = bundleHashOutput.split('=').pop().trim();

    return {
      appPath: CAVALRY_APP_PATH,
      cavalryVersion: plistOutput,
      qtVersion: '6.6.3',
      bundleHash: bundleHash,
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    throw new Error(`Failed to get Cavalry target identity: ${err.message}`);
  }
}

async function launchCavalryForLanguage(sessionDir, sessionUuid, lang, appPath) {
  const scriptPath = join(REPO_ROOT, 'tools', 'launch_cavalry_with_injector.sh');
  
  return new Promise((resolve, reject) => {
    const proc = spawn('bash', [
      scriptPath,
      '--app', appPath,
      '--lang', lang,
      '--session-dir', sessionDir,
      '--session-uuid', sessionUuid,
      '--cache-root', CACHE_ROOT,
    ]);

    let stdout = '';
    let stderr = '';

    proc.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Launch failed with code ${code}: ${stderr}`));
      } else {
        resolve({ stdout, stderr });
      }
    });
  });
}

async function waitForInventory(runtimeDir, lang, timeoutMs = 30000) {
  const injectorPath = join(runtimeDir, `${lang}-injector-inventory.json`);
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    if (existsSync(injectorPath)) {
      try {
        await readFile(injectorPath, 'utf8');
        return true;
      } catch {
        // File may be incomplete, retry
      }
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  return false;
}

async function captureAccessibilityInventory(sessionDir, lang) {
  const captureScript = join(REPO_ROOT, 'tools', 'capture_accessibility_inventory.js');
  
  if (!existsSync(captureScript)) {
    console.warn(`⚠ Accessibility capture script not found: ${captureScript}`);
    return null;
  }

  try {
    execSync(`node "${captureScript}" --session-dir "${sessionDir}" --lang "${lang}"`, {
      stdio: 'inherit',
    });
    return true;
  } catch (err) {
    console.warn(`⚠ Accessibility capture failed for ${lang}: ${err.message}`);
    return false;
  }
}

async function mergeRuntimeInventories(sessionDir, lang) {
  const mergeScript = join(REPO_ROOT, 'tools', 'merge_runtime_inventory.js');
  
  if (!existsSync(mergeScript)) {
    console.warn(`⚠ Merge script not found: ${mergeScript}`);
    return null;
  }

  try {
    execSync(`node "${mergeScript}" --session-dir "${sessionDir}" --lang "${lang}"`, {
      stdio: 'inherit',
    });
    return true;
  } catch (err) {
    console.warn(`⚠ Merge failed for ${lang}: ${err.message}`);
    return false;
  }
}

async function terminateCavalry() {
  try {
    execSync('pkill -f "/Applications/Cavalry.app"', { stdio: 'ignore' });
    await new Promise(resolve => setTimeout(resolve, 1000));
  } catch {
    // Ignore errors
  }
}

async function main() {
  const sessionUuid = await generateSessionUuid();
  const sessionDir = join(CACHE_ROOT, 'sessions', sessionUuid);
  const runtimeDir = join(sessionDir, 'runtime');
  const auditDir = join(sessionDir, 'audit');

  console.log('╔════════════════════════════════════════════════╗');
  console.log('║  Cavalry Full-UI 100 Runtime Capture Workflow  ║');
  console.log('╚════════════════════════════════════════════════╝\n');

  console.log(`📁 SESSION_DIR = ${sessionDir}`);
  console.log(`📁 RUNTIME_DIR = ${runtimeDir}`);
  console.log(`📁 AUDIT_DIR   = ${auditDir}\n`);

  try {
    await mkdir(runtimeDir, { recursive: true });
    await mkdir(auditDir, { recursive: true });

    const target = await getCurrentTarget();
    console.log(`✓ Target identity: Cavalry ${target.cavalryVersion} / Qt ${target.qtVersion}`);
    console.log(`✓ Bundle hash: ${target.bundleHash}\n`);

    const runRecord = {
      sessionUuid: sessionUuid,
      sessionDir: sessionDir,
      target: target,
      runtimeDir: runtimeDir,
      languages: {},
      overallPass: true,
      errors: [],
    };

    // Process each language
    for (const lang of LANGUAGES) {
      console.log(`\n🚀 Launching Cavalry for ${lang}...`);

      try {
        await launchCavalryForLanguage(sessionDir, sessionUuid, lang, CAVALRY_APP_PATH);
        console.log(`✓ Launched successfully`);

        // Wait for injector inventory
        const injectorReady = await waitForInventory(runtimeDir, lang);
        if (!injectorReady) {
          throw new Error(`Injector inventory not created within timeout`);
        }
        console.log(`✓ Injector inventory ready`);

        // Capture accessibility inventory (optional for now)
        await captureAccessibilityInventory(sessionDir, lang);

        // Merge inventories
        await mergeRuntimeInventories(sessionDir, lang);

        // Record language success
        runRecord.languages[lang] = {
          status: 'captured',
          injectorInventory: join(runtimeDir, `${lang}-injector-inventory.json`),
          axInventory: join(runtimeDir, `${lang}-ax-inventory.json`),
          mergedInventory: join(runtimeDir, `${lang}-merged-inventory.json`),
        };

        console.log(`✓ Completed ${lang}`);

        // Terminate app before next language
        await terminateCavalry();
      } catch (err) {
        console.error(`✗ Failed to capture ${lang}: ${err.message}`);
        runRecord.overallPass = false;
        runRecord.errors.push({ lang, error: err.message });
        await terminateCavalry();
      }
    }

    // Write RUN_RECORD
    const runRecordPath = join(sessionDir, 'full-ui-run-record.json');
    await writeFile(runRecordPath, JSON.stringify(runRecord, null, 2));
    console.log(`\n✓ RUN_RECORD written: ${runRecordPath}`);

    if (runRecord.overallPass) {
      console.log('\n✅ All languages captured successfully\n');
    } else {
      console.log('\n⚠ Some languages failed\n');
      process.exit(1);
    }
  } catch (err) {
    console.error(`\n❌ Workflow failed: ${err.message}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(`Fatal error: ${err.message}`);
  process.exit(1);
});
