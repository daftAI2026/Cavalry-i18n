#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const LANGUAGES = [
  { language: 'ja_JP', inventory: 'ja_JP-inventory.json', ts: 'tools/ja_JP.ts' },
  { language: 'zh-Hans', inventory: 'zh-Hans-inventory.json', ts: 'tools/zh-Hans.ts' },
  { language: 'zh-Hant', inventory: 'zh-Hant-inventory.json', ts: 'tools/zh-Hant.ts' },
];
const CACHE_ROOT = path.join(process.env.HOME || '', 'Library', 'Caches', 'Cavalry-i18n');
const COMPILED_SOURCE_MAP_PATH = path.join(CACHE_ROOT, 'compiled-ui-source-map.json');

function fail(message) {
  throw new Error(message);
}

function parseArgs(argv) {
  const options = {
    threshold: 99,
    runlog: path.join(process.env.HOME || '', 'Library', 'Caches', 'Cavalry-i18n', 'full-ui-runlog.json'),
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
    }
  }

  if (!Number.isFinite(options.threshold) || options.threshold < 0 || options.threshold > 100) {
    fail('Threshold must be a number between 0 and 100.');
  }
  if (!options.runlog) {
    fail('Missing required --runlog <path> argument.');
  }

  return options;
}

function runLanguage(repoRoot, threshold, config) {
  const inventoryPath = path.join(CACHE_ROOT, config.inventory);
  const args = [
    path.join(repoRoot, 'tools', 'check_full_ui_coverage.js'),
    '--language',
    config.language,
    '--inventory',
    inventoryPath,
    '--compiled-source-map',
    COMPILED_SOURCE_MAP_PATH,
    '--ts',
    path.join(repoRoot, config.ts),
    '--allowlist',
    path.join(repoRoot, 'tools', 'runtime_ui_allowlist.json'),
    '--threshold',
    String(threshold),
  ];
  const result = spawnSync(process.execPath, args, {
    cwd: repoRoot,
    encoding: 'utf8',
  });

  const stdout = (result.stdout || '').trim();
  if (!stdout) {
    fail(`No report produced for ${config.language}. ${result.stderr || ''}`.trim());
  }

  const report = JSON.parse(stdout);
  return {
    language: config.language,
    threshold: report.threshold,
    runtime: report.runtime,
    compiled: report.compiled,
    jsonValidation: report.jsonValidation,
    exitCode: result.status ?? 1,
    pass: result.status === 0 && report.pass === true,
  };
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const repoRoot = path.resolve(__dirname, '..');
  const startedAt = new Date().toISOString();
  const languages = LANGUAGES.map((config) => runLanguage(repoRoot, options.threshold, config));
  const finishedAt = new Date().toISOString();
  const overallPass = languages.every((language) => language.pass);
  const runlog = {
    startedAt,
    finishedAt,
    threshold: options.threshold,
    overallPass,
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
