#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const EXTRACTION_LOWER_BOUNDS = {
  'languages/en/appStrings.json': 4,
  'languages/en/nodeStrings.json': 6320,
  'languages/en/onboarding.json': 34,
  'languages/en/tips.json': 51,
  'json-total': 6409,
  'compiled-source-map': 4743,
  'runtime-ax-menuBars': 500,
  'runtime-ax-widgetTexts': 200,
};

function fail(message) {
  throw new Error(message);
}

function parseArgs(argv) {
  const options = {
    repoRoot: path.resolve(__dirname, '..'),
    sessionDir: '',
    compiledSourceMap: '',
    extractionInventory: '',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--repo-root') {
      options.repoRoot = path.resolve(argv[index + 1] || '');
      index += 1;
      continue;
    }
    if (arg === '--session-dir') {
      options.sessionDir = path.resolve(argv[index + 1] || '');
      index += 1;
      continue;
    }
    if (arg === '--compiled-source-map') {
      options.compiledSourceMap = path.resolve(argv[index + 1] || '');
      index += 1;
      continue;
    }
    if (arg === '--extraction-inventory') {
      options.extractionInventory = path.resolve(argv[index + 1] || '');
      index += 1;
    }
  }

  if (!options.repoRoot) {
    fail('Missing required repo root.');
  }

  return options;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function collectViolations(repoRoot) {
  const violations = [];
  const fixturesDir = path.join(repoRoot, 'tools', 'full_ui_inventory_fixtures');
  if (fs.existsSync(fixturesDir)) {
    violations.push(`tools/full_ui_inventory_fixtures present at ${fixturesDir}`);
  }

  const curatedCorpus = path.join(repoRoot, 'doc', 'libExtensionLayer-curated-ui.txt');
  if (fs.existsSync(curatedCorpus)) {
    violations.push(`doc/libExtensionLayer-curated-ui.txt present at ${curatedCorpus}`);
  }

  const packagePath = path.join(repoRoot, 'package.json');
  if (!fs.existsSync(packagePath)) {
    violations.push(`package.json missing at ${packagePath}`);
    return violations;
  }

  const packageJson = readJson(packagePath);
  if (packageJson.scripts?.['prepare:full-ui-gate']) {
    violations.push('package.json contains forbidden script prepare:full-ui-gate');
  }

  return violations;
}

function readSurfaceCount(extractionInventory, key) {
  return Number(extractionInventory?.surfaces?.[key]?.count || 0);
}

function collectExtractionViolations(options) {
  const violations = [];

  if (!options.extractionInventory) {
    return violations;
  }

  if (!fs.existsSync(options.extractionInventory)) {
    violations.push(`Missing extraction inventory: ${options.extractionInventory}`);
    return violations;
  }

  const extractionInventory = readJson(options.extractionInventory);
  for (const [surfaceKey, lowerBound] of Object.entries(EXTRACTION_LOWER_BOUNDS)) {
    const count = readSurfaceCount(extractionInventory, surfaceKey);
    if (count >= lowerBound) {
      continue;
    }

    const prefix = surfaceKey.startsWith('runtime-ax-') ? 'WEAK-CAPTURE' : 'G-X';
    violations.push(`${prefix} ${surfaceKey} below frozen lower bound: ${count} < ${lowerBound}`);
  }

  if (options.compiledSourceMap) {
    if (!fs.existsSync(options.compiledSourceMap)) {
      violations.push(`Missing compiled source map: ${options.compiledSourceMap}`);
    } else {
      const compiledSourceMap = readJson(options.compiledSourceMap);
      const compiledCount = Array.isArray(compiledSourceMap.entries) ? compiledSourceMap.entries.length : 0;
      if (compiledCount < EXTRACTION_LOWER_BOUNDS['compiled-source-map']) {
        violations.push(
          `G-X compiled-source-map below frozen lower bound: ${compiledCount} < ${EXTRACTION_LOWER_BOUNDS['compiled-source-map']}`
        );
      }
    }
  }

  return violations;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const violations = [
    ...collectViolations(options.repoRoot),
    ...collectExtractionViolations(options),
  ];
  if (violations.length > 0) {
    console.error('verify_gate_inputs failed:');
    for (const violation of violations) {
      console.error(`- ${violation}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log(
    JSON.stringify(
      {
        pass: true,
        repoRoot: options.repoRoot,
        violations: [],
      },
      null,
      2
    )
  );
}

if (require.main === module) {
  main();
}

module.exports = {
  collectViolations,
  collectExtractionViolations,
  parseArgs,
};
