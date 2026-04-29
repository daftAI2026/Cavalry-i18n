#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { buildCoverage, collectMenuStrings, normalizeText, readJson } = require('./check_runtime_ui_coverage.js');

const JSON_SURFACES = [
  { key: 'languages/en/appStrings.json', group: 'appStrings' },
  { key: 'languages/en/nodeStrings.json', group: 'nodeStrings' },
  { key: 'languages/en/onboarding.json', group: 'onboarding' },
  { key: 'languages/en/tips.json', group: 'tips' },
];

function fail(message) {
  throw new Error(message);
}

function parseArgs(argv) {
  const options = {
    repoRoot: path.resolve(__dirname, '..'),
    sessionDir: '',
    compiledSourceMap: path.join(
      process.env.HOME || '',
      'Library',
      'Caches',
      'Cavalry-i18n',
      'compiled-ui-source-map.json'
    ),
    runtimeInventory: '',
    output: '',
    runRecord: '',
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
    if (arg === '--runtime-inventory') {
      options.runtimeInventory = path.resolve(argv[index + 1] || '');
      index += 1;
      continue;
    }
    if (arg === '--output') {
      options.output = path.resolve(argv[index + 1] || '');
      index += 1;
      continue;
    }
    if (arg === '--run-record') {
      options.runRecord = path.resolve(argv[index + 1] || '');
      index += 1;
    }
  }

  if (!options.sessionDir) {
    fail('Missing required --session-dir <path> argument.');
  }
  if (!options.runtimeInventory) {
    options.runtimeInventory = path.join(options.sessionDir, 'runtime', 'en-merged-inventory.json');
  }
  if (!options.output) {
    options.output = path.join(options.sessionDir, 'extraction-inventory.json');
  }
  if (!options.runRecord) {
    options.runRecord = path.join(options.sessionDir, 'full-ui-run-record.json');
  }

  return options;
}

function sha256Text(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function sha256File(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function fileMetadata(filePath) {
  const resolvedPath = path.resolve(filePath);
  const stats = fs.statSync(resolvedPath);
  return {
    path: resolvedPath,
    sha256: sha256File(resolvedPath),
    mtime: stats.mtime.toISOString(),
  };
}

function aggregateMetadata(filePaths, aggregatePath) {
  const resolvedPaths = filePaths.map((filePath) => path.resolve(filePath));
  const stats = resolvedPaths.map((filePath) => fs.statSync(filePath));
  const combinedHash = sha256Text(resolvedPaths.map((filePath) => sha256File(filePath)).join('\n'));
  const latestMtime = stats
    .map((stat) => stat.mtime.toISOString())
    .sort()
    .at(-1);

  return {
    path: path.resolve(aggregatePath),
    sha256: combinedHash,
    mtime: latestMtime,
  };
}

function readPackageVersion(repoRoot) {
  const packagePath = path.join(repoRoot, 'package.json');
  const packageJson = readJson(packagePath);
  return String(packageJson.version || '0');
}

function collectJsonLeaves(value, jsonPath = '$') {
  const leaves = [];
  if (Array.isArray(value)) {
    value.forEach((child, index) => {
      leaves.push(...collectJsonLeaves(child, `${jsonPath}[${index}]`));
    });
    return leaves;
  }

  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      leaves.push(...collectJsonLeaves(child, `${jsonPath}.${key}`));
    }
    return leaves;
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    leaves.push({
      path: jsonPath,
      value,
      valueType: typeof value,
    });
  }

  return leaves;
}

function buildSurfaceRecord({ source, surface, count, englishLeaves, extractor, frozenAtUtc, extra = {} }) {
  return {
    source,
    surface,
    count,
    englishLeaves,
    extractor,
    frozenAtUtc,
    ...extra,
  };
}

function buildJsonSurfaces(repoRoot, extractor, frozenAtUtc) {
  const surfaces = {};
  const aggregatedLeaves = [];
  const filePaths = [];

  for (const config of JSON_SURFACES) {
    const sourcePath = path.join(repoRoot, config.key);
    const leaves = collectJsonLeaves(readJson(sourcePath)).map((leaf) => ({
      path: leaf.path,
      value: leaf.value,
      valueType: leaf.valueType,
    }));
    filePaths.push(sourcePath);
    aggregatedLeaves.push(
      ...leaves.map((leaf) => ({
        surface: config.key,
        ...leaf,
      }))
    );
    surfaces[config.key] = buildSurfaceRecord({
      source: fileMetadata(sourcePath),
      surface: 'json',
      count: leaves.length,
      englishLeaves: leaves,
      extractor,
      frozenAtUtc,
    });
  }

  surfaces['json-total'] = buildSurfaceRecord({
    source: aggregateMetadata(filePaths, path.join(repoRoot, 'languages', 'en')),
    surface: 'json',
    count: aggregatedLeaves.length,
    englishLeaves: aggregatedLeaves,
    extractor,
    frozenAtUtc,
  });

  return surfaces;
}

function buildCompiledSurface(compiledSourceMapPath, extractor, frozenAtUtc) {
  const sourceMap = readJson(compiledSourceMapPath);
  const englishLeaves = (sourceMap.entries || [])
    .map((entry) => ({
      value: normalizeText(entry.normalizedText || entry.text || ''),
      sourcePath: entry.sourcePath || entry.path || '',
      surfaceHint: entry.surfaceHint || '',
    }))
    .filter((entry) => entry.value);

  return buildSurfaceRecord({
    source: fileMetadata(compiledSourceMapPath),
    surface: 'compiled',
    count: Array.isArray(sourceMap.entries) ? sourceMap.entries.length : 0,
    englishLeaves,
    extractor,
    frozenAtUtc,
    extra: {
      kind: sourceMap.kind || '',
      bundleVersion: sourceMap.bundleVersion || '',
      notes: sourceMap.notes || [],
    },
  });
}

function buildRuntimeSurfaces(runtimeInventoryPath, allowlistPath, extractor, frozenAtUtc) {
  const inventory = readJson(runtimeInventoryPath);
  const allowlist = readJson(allowlistPath);
  const coverage = buildCoverage(inventory, allowlist);
  const menuLeaves = [];

  for (const menuBar of inventory.menuBars || []) {
    collectMenuStrings(menuBar, menuLeaves);
  }

  const normalizedMenuLeaves = menuLeaves
    .map((value) => normalizeText(value))
    .filter(Boolean)
    .map((value) => ({ value }));

  const metadata = fileMetadata(runtimeInventoryPath);
  return {
    'runtime-candidates': buildSurfaceRecord({
      source: metadata,
      surface: 'runtime',
      count: coverage.totalCandidates,
      englishLeaves: coverage.candidates.map((value) => ({ value })),
      extractor,
      frozenAtUtc,
      extra: {
        capture: inventory.capture || {},
      },
    }),
    'runtime-menuLeaves': buildSurfaceRecord({
      source: metadata,
      surface: 'runtime',
      count: normalizedMenuLeaves.length,
      englishLeaves: normalizedMenuLeaves,
      extractor,
      frozenAtUtc,
      extra: {
        capture: inventory.capture || {},
      },
    }),
  };
}

function buildExtractionInventory(options) {
  const frozenAtUtc = new Date().toISOString();
  const extractor = {
    name: 'tools/freeze_extraction_inventory.js',
    version: readPackageVersion(options.repoRoot),
  };
  const surfaces = {
    ...buildJsonSurfaces(options.repoRoot, extractor, frozenAtUtc),
    'compiled-source-map': buildCompiledSurface(options.compiledSourceMap, extractor, frozenAtUtc),
    ...buildRuntimeSurfaces(
      options.runtimeInventory,
      path.join(options.repoRoot, 'tools', 'runtime_ui_allowlist.json'),
      extractor,
      frozenAtUtc
    ),
  };

  const extraction = {
    formatVersion: 1,
    sessionUuid: path.basename(options.sessionDir),
    frozenAtUtc,
    extractor,
    surfaces,
    englishLeaves: Object.fromEntries(
      Object.entries(surfaces).map(([surfaceKey, surface]) => [surfaceKey, surface.englishLeaves])
    ),
  };
  extraction.hash = sha256Text(JSON.stringify(extraction));
  return extraction;
}

function updateRunRecord(runRecordPath, extractionPath, extractionHash) {
  const runRecord = fs.existsSync(runRecordPath) ? readJson(runRecordPath) : {};
  runRecord.extractionInventory = {
    path: extractionPath,
    hash: extractionHash,
    mtime: fs.statSync(extractionPath).mtime.toISOString(),
  };
  fs.mkdirSync(path.dirname(runRecordPath), { recursive: true });
  fs.writeFileSync(runRecordPath, `${JSON.stringify(runRecord, null, 2)}\n`);
  return runRecord;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const extraction = buildExtractionInventory(options);
  fs.mkdirSync(path.dirname(options.output), { recursive: true });
  fs.writeFileSync(options.output, `${JSON.stringify(extraction, null, 2)}\n`);
  updateRunRecord(path.resolve(options.runRecord), path.resolve(options.output), extraction.hash);
  console.log(
    JSON.stringify(
      {
        output: path.resolve(options.output),
        hash: extraction.hash,
        surfaces: Object.keys(extraction.surfaces),
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
  buildExtractionInventory,
  buildJsonSurfaces,
  buildRuntimeSurfaces,
  collectJsonLeaves,
  parseArgs,
  updateRunRecord,
};
