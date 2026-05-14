#!/usr/bin/env node
/**
 * [INPUT]: 依赖 check_full_ui_coverage.js、session-dir、compiled source-map、extraction inventory 与三语 runtime inventory
 * [OUTPUT]: 对外提供三语 full-ui matrix gate 与 stable runlog
 * [POS]: tools 的 G0-G4 汇总守门器，被 npm run check:full-ui 作为最终覆盖率判定入口
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

const LANGUAGES = [
  { language: 'ja_JP', ts: 'tools/ja_JP.ts' },
  { language: 'zh-Hans', ts: 'tools/zh-Hans.ts' },
  { language: 'zh-Hant', ts: 'tools/zh-Hant.ts' },
];
const CACHE_ROOT = path.join(process.env.HOME || '', 'Library', 'Caches', 'Cavalry-i18n');
const COMPILED_SOURCE_MAP_PATH = path.join(CACHE_ROOT, 'compiled-ui-source-map.json');
const RUNTIME_ALLOWLIST_PATH = path.join('tools', 'runtime_ui_allowlist.json');
const TRANSLATION_WHITELIST_PATH = path.join('tools', 'translation-whitelist.json');

function fail(message) {
  throw new Error(message);
}

function readFileMetadata(filePath) {
  const resolvedPath = path.resolve(filePath);
  const contents = fs.readFileSync(resolvedPath);
  const stats = fs.statSync(resolvedPath);
  return {
    path: resolvedPath,
    hash: crypto.createHash('sha256').update(contents).digest('hex'),
    mtime: stats.mtime.toISOString(),
  };
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function emptyForbiddenPatterns() {
  return { total: 0, byPattern: {}, samples: [] };
}

function emptyJsonForbiddenPatterns() {
  return { total: 0, by_pattern: {}, samples: [] };
}

function buildLanguageFailure({ config, inventoryPath, inventory, threshold, blockedReason, exitCode }) {
  return {
    language: config.language,
    threshold,
    inventoryPath,
    runtime: null,
    compiled: null,
    jsonValidation: null,
    forbiddenPatterns: {
      runtime: emptyForbiddenPatterns(),
      jsonValidation: emptyJsonForbiddenPatterns(),
    },
    provenance: {
      inventoryPath,
      capture: inventory?.capture || {},
    },
    exitCode,
    pass: false,
    blockedReason,
  };
}

function parseArgs(argv) {
  const options = {
    threshold: 100,
    runlog: '',
    sessionDir: '',
    compiledSourceMap: COMPILED_SOURCE_MAP_PATH,
    extractionInventory: '',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--threshold') {
      options.threshold = Number(argv[index + 1] || '');
      index += 1;
      continue;
    }
    if (arg === '--runlog') {
      options.runlog = argv[index + 1] || '';
      index += 1;
      continue;
    }
    if (arg === '--session-dir') {
      options.sessionDir = argv[index + 1] || '';
      index += 1;
      continue;
    }
    if (arg === '--compiled-source-map') {
      options.compiledSourceMap = argv[index + 1] || '';
      index += 1;
      continue;
    }
    if (arg === '--extraction-inventory') {
      options.extractionInventory = argv[index + 1] || '';
      index += 1;
    }
  }

  if (!Number.isFinite(options.threshold) || options.threshold < 0 || options.threshold > 100) {
    fail('Threshold must be a number between 0 and 100.');
  }
  if (!options.sessionDir) {
    fail('Missing required --session-dir <path> argument.');
  }
  if (!options.compiledSourceMap) {
    fail('Missing required --compiled-source-map <path> argument.');
  }
  if (!options.runlog) {
    options.runlog = path.join(path.resolve(options.sessionDir), 'full-ui-run-record.json');
  }
  if (!options.extractionInventory) {
    options.extractionInventory = path.join(path.resolve(options.sessionDir), 'extraction-inventory.json');
  }

  return options;
}

function runLanguage(repoRoot, options, config) {
  const inventoryPath = path.join(options.sessionDir, 'runtime', `${config.language}-merged-inventory.json`);
  if (!fs.existsSync(inventoryPath)) {
    return buildLanguageFailure({
      config,
      inventoryPath,
      inventory: null,
      threshold: options.threshold,
      blockedReason: `Missing runtime inventory: ${inventoryPath}`,
      exitCode: 1,
    });
  }
  const inventory = readJson(inventoryPath);
  const args = [
    path.join(repoRoot, 'tools', 'check_full_ui_coverage.js'),
    '--language',
    config.language,
    '--inventory',
    inventoryPath,
    '--compiled-source-map',
    path.resolve(options.compiledSourceMap),
    '--ts',
    path.join(repoRoot, config.ts),
    '--allowlist',
    path.join(repoRoot, RUNTIME_ALLOWLIST_PATH),
    '--threshold',
    String(options.threshold),
    '--extraction-inventory',
    path.resolve(options.extractionInventory),
  ];
  const result = spawnSync(process.execPath, args, {
    cwd: repoRoot,
    encoding: 'utf8',
  });

  const stdout = (result.stdout || '').trim();
  if (!stdout) {
    return buildLanguageFailure({
      config,
      inventoryPath,
      inventory,
      threshold: options.threshold,
      blockedReason: `No report produced for ${config.language}. ${(result.stderr || '').trim()}`.trim(),
      exitCode: result.status ?? 1,
    });
  }

  let report;
  try {
    report = JSON.parse(stdout);
  } catch (error) {
    return buildLanguageFailure({
      config,
      inventoryPath,
      inventory,
      threshold: options.threshold,
      blockedReason: `Invalid report produced for ${config.language}: ${error.message}`,
      exitCode: result.status ?? 1,
    });
  }
  return {
    language: config.language,
    threshold: report.threshold,
    inventoryPath,
    runtime: report.runtime,
    compiled: report.compiled,
    jsonValidation: report.jsonValidation,
    forbiddenPatterns: {
      runtime: report.runtime?.forbiddenPatterns || { total: 0, byPattern: {}, samples: [] },
      jsonValidation: report.jsonValidation?.forbiddenPatterns || {
        total: 0,
        by_pattern: {},
        samples: [],
      },
    },
    provenance: {
      inventoryPath,
      capture: inventory.capture || {},
    },
    exitCode: result.status ?? 1,
    pass: result.status === 0 && report.pass === true,
    blockedReason: result.status === 0 && report.pass === true ? null : 'One or more surface gates failed.',
  };
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const repoRoot = path.resolve(__dirname, '..');
  const sessionDir = path.resolve(options.sessionDir);
  const sourceMap = readFileMetadata(options.compiledSourceMap);
  const extractionInventory = fs.existsSync(options.extractionInventory)
    ? readFileMetadata(options.extractionInventory)
    : null;
  const frozenBaselines = {
    runtimeAllowlist: readFileMetadata(path.join(repoRoot, RUNTIME_ALLOWLIST_PATH)),
    translationWhitelist: readFileMetadata(path.join(repoRoot, TRANSLATION_WHITELIST_PATH)),
  };
  const startedAt = new Date().toISOString();
  const languages = LANGUAGES.map((config) => runLanguage(repoRoot, options, config));
  const finishedAt = new Date().toISOString();
  const overallPass = languages.every((language) => language.pass);
  const runlog = {
    startedAt,
    finishedAt,
    threshold: options.threshold,
    sessionDir,
    sessionUuid: path.basename(sessionDir),
    runtimeDir: path.join(sessionDir, 'runtime'),
    sourceMap,
    extractionInventory,
    frozenBaselines,
    overallPass,
    blockedReason: overallPass ? null : 'One or more language runs failed.',
    languages,
  };

  fs.mkdirSync(path.dirname(options.runlog), { recursive: true });
  fs.writeFileSync(options.runlog, `${JSON.stringify(runlog, null, 2)}\n`);
  console.log(JSON.stringify(runlog, null, 2));

  if (!overallPass) {
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}
