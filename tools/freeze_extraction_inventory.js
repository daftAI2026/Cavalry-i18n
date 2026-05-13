#!/usr/bin/env node
/**
 * [INPUT]: 依赖 languages/en JSON、compiled source-map、live runtime inventory、cavalry_qt_target.json、translation-whitelist.json 与 runtime allowlist
 * [OUTPUT]: 对外提供 SESSION_DIR/extraction-inventory.json，并把 frozen denominator provenance 写回 RUN_RECORD
 * [POS]: tools 的 G-X freeze 器，统一 JSON/compiled/runtime 英文分母供 G1/G2/G3/G4 只读消费
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

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

const EXTRACTION_FILTER_KEY = '_extraction_filters';

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

function loadTranslationWhitelist(repoRoot) {
  const whitelistPath = path.join(repoRoot, 'tools', 'translation-whitelist.json');
  if (!fs.existsSync(whitelistPath)) {
    return {};
  }
  return readJson(whitelistPath);
}

function loadExtractionFilters(whitelist) {
  const config = whitelist[EXTRACTION_FILTER_KEY] || {};
  const hasRules =
    (Array.isArray(config.exact_values) && config.exact_values.length > 0) ||
    (Array.isArray(config.regexes) && config.regexes.length > 0);
  if (hasRules && !config.glossary_source) {
    fail(`${EXTRACTION_FILTER_KEY}.glossary_source is required for denominator filters.`);
  }

  return {
    glossarySource: String(config.glossary_source || ''),
    exactValues: new Set((config.exact_values || []).map((value) => normalizeText(value))),
    regexes: (config.regexes || []).map((regex) => new RegExp(regex)),
  };
}

function buildJsonRuleSet(whitelist, group) {
  const rules = whitelist[group] || {};
  return {
    translate: new Set(rules.translate || []),
    noTranslate: new Set(rules.no_translate || []),
    localeSync: new Set(rules.locale_sync || []),
    hasRules:
      Boolean(rules.translate?.length) ||
      Boolean(rules.no_translate?.length) ||
      Boolean(rules.locale_sync?.length),
  };
}

function nextJsonMode(key, currentMode, rules) {
  if (rules.translate.has(key)) {
    return 'translate';
  }
  if (rules.noTranslate.has(key)) {
    return 'no_translate';
  }
  if (rules.localeSync.has(key)) {
    return 'locale_sync';
  }
  return currentMode;
}

function modeForJsonPath(jsonPath, rules) {
  if (!rules.hasRules) {
    return 'raw';
  }
  let mode = null;
  for (const match of jsonPath.matchAll(/\.([^.\\[]+)/g)) {
    mode = nextJsonMode(match[1], mode, rules);
  }
  return mode;
}

function shouldExcludeValue(value, filters) {
  if (typeof value !== 'string') {
    return false;
  }
  const normalized = normalizeText(value);
  if (!normalized) {
    return false;
  }
  if (filters.exactValues.has(normalized)) {
    return true;
  }
  return filters.regexes.some((regex) => regex.test(normalized));
}

function filterEnglishLeaves(leaves, filters) {
  const englishLeaves = [];
  const excludedLeaves = [];
  for (const leaf of leaves) {
    if (shouldExcludeValue(leaf.value, filters)) {
      excludedLeaves.push(leaf);
      continue;
    }
    englishLeaves.push(leaf);
  }
  return {
    englishLeaves,
    excludedLeaves,
  };
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

function buildJsonSurfaces(repoRoot, extractor, frozenAtUtc, filters, whitelist = {}) {
  const surfaces = {};
  const aggregatedLeaves = [];
  const filePaths = [];

  for (const config of JSON_SURFACES) {
    const sourcePath = path.join(repoRoot, config.key);
    const rules = buildJsonRuleSet(whitelist, config.group);
    const rawLeaves = collectJsonLeaves(readJson(sourcePath)).map((leaf) => ({
      path: leaf.path,
      value: leaf.value,
      valueType: leaf.valueType,
      mode: modeForJsonPath(leaf.path, rules),
    })).filter((leaf) => leaf.mode);
    const { englishLeaves: leaves, excludedLeaves } = filterEnglishLeaves(rawLeaves, filters);
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
      extra: {
        excludedCount: excludedLeaves.length,
        exclusionSource: filters.glossarySource,
      },
    });
  }

  const { englishLeaves: totalLeaves, excludedLeaves: totalExcludedLeaves } = filterEnglishLeaves(
    aggregatedLeaves,
    filters
  );
  surfaces['json-total'] = buildSurfaceRecord({
    source: aggregateMetadata(filePaths, path.join(repoRoot, 'languages', 'en')),
    surface: 'json',
    count: totalLeaves.length,
    englishLeaves: totalLeaves,
    extractor,
    frozenAtUtc,
    extra: {
      excludedCount: totalExcludedLeaves.length,
      exclusionSource: filters.glossarySource,
    },
  });

  return surfaces;
}

function buildCompiledSurface(compiledSourceMapPath, extractor, frozenAtUtc, filters) {
  const sourceMap = readJson(compiledSourceMapPath);
  const rawLeaves = (sourceMap.entries || [])
    .map((entry) => ({
      value: normalizeText(entry.normalizedText || entry.text || ''),
      sourcePath: entry.sourcePath || entry.path || '',
      surfaceHint: entry.surfaceHint || '',
    }))
    .filter((entry) => entry.value);
  const { englishLeaves, excludedLeaves } = filterEnglishLeaves(rawLeaves, filters);

  return buildSurfaceRecord({
    source: fileMetadata(compiledSourceMapPath),
    surface: 'compiled',
    count: englishLeaves.length,
    englishLeaves,
    extractor,
    frozenAtUtc,
    extra: {
      kind: sourceMap.kind || '',
      bundleVersion: sourceMap.bundleVersion || '',
      notes: sourceMap.notes || [],
      rawCount: rawLeaves.length,
      excludedCount: excludedLeaves.length,
      exclusionSource: filters.glossarySource,
    },
  });
}

function buildRuntimeSurfaces(runtimeInventoryPath, allowlistPath, extractor, frozenAtUtc, filters) {
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
  const { englishLeaves: runtimeCandidates, excludedLeaves: excludedRuntimeCandidates } = filterEnglishLeaves(
    coverage.candidates.map((value) => ({ value })),
    filters
  );
  const { englishLeaves: runtimeMenuLeaves, excludedLeaves: excludedRuntimeMenuLeaves } = filterEnglishLeaves(
    normalizedMenuLeaves,
    filters
  );

  const metadata = fileMetadata(runtimeInventoryPath);
  return {
    'runtime-candidates': buildSurfaceRecord({
      source: metadata,
      surface: 'runtime',
      count: runtimeCandidates.length,
      englishLeaves: runtimeCandidates,
      extractor,
      frozenAtUtc,
      extra: {
        capture: inventory.capture || {},
        rawCount: coverage.totalCandidates,
        excludedCount: excludedRuntimeCandidates.length,
        exclusionSource: filters.glossarySource,
      },
    }),
    'runtime-menuLeaves': buildSurfaceRecord({
      source: metadata,
      surface: 'runtime',
      count: runtimeMenuLeaves.length,
      englishLeaves: runtimeMenuLeaves,
      extractor,
      frozenAtUtc,
      extra: {
        capture: inventory.capture || {},
        rawCount: normalizedMenuLeaves.length,
        excludedCount: excludedRuntimeMenuLeaves.length,
        exclusionSource: filters.glossarySource,
      },
    }),
  };
}

function inferAppPathFromSourceMap(sourceMap) {
  const candidates = [
    ...(sourceMap.compiledUiTargets || []),
    ...(sourceMap.entries || []).map((entry) => entry.source || entry.sourcePath || ''),
  ];

  for (const candidate of candidates) {
    const marker = '.app';
    const markerIndex = String(candidate).indexOf(marker);
    if (markerIndex === -1) {
      continue;
    }
    return String(candidate).slice(0, markerIndex + marker.length);
  }

  return '';
}

function buildTargetIdentity({ repoRoot, compiledSourceMapPath, runtimeInventoryPath }) {
  const sourceMap = readJson(compiledSourceMapPath);
  const runtimeInventory = readJson(runtimeInventoryPath);
  const targetConfigPath = path.join(repoRoot, 'tools', 'cavalry_qt_target.json');
  const targetConfig = fs.existsSync(targetConfigPath) ? readJson(targetConfigPath) : {};
  const sourceTarget = sourceMap.target || {};
  const capture = runtimeInventory.capture || {};

  return {
    cavalryVersion:
      String(sourceTarget.cavalryVersion || sourceMap.bundleVersion || targetConfig.cavalryVersion || ''),
    qtVersion: String(sourceTarget.qtVersion || targetConfig.qtVersion || ''),
    bundleHash: String(sourceTarget.bundleHash || capture.bundleHash || ''),
    appPath: String(sourceTarget.appPath || inferAppPathFromSourceMap(sourceMap)),
  };
}

function buildExtractionInventory(options) {
  const frozenAtUtc = new Date().toISOString();
  const extractor = {
    name: 'tools/freeze_extraction_inventory.js',
    version: readPackageVersion(options.repoRoot),
  };
  const whitelist = loadTranslationWhitelist(options.repoRoot);
  const extractionFilters = loadExtractionFilters(whitelist);
  const surfaces = {
    ...buildJsonSurfaces(options.repoRoot, extractor, frozenAtUtc, extractionFilters, whitelist),
    'compiled-source-map': buildCompiledSurface(options.compiledSourceMap, extractor, frozenAtUtc, extractionFilters),
    ...buildRuntimeSurfaces(
      options.runtimeInventory,
      path.join(options.repoRoot, 'tools', 'runtime_ui_allowlist.json'),
      extractor,
      frozenAtUtc,
      extractionFilters
    ),
  };
  const target = buildTargetIdentity({
    repoRoot: options.repoRoot,
    compiledSourceMapPath: options.compiledSourceMap,
    runtimeInventoryPath: options.runtimeInventory,
  });

  const extraction = {
    formatVersion: 1,
    sessionUuid: path.basename(options.sessionDir),
    target,
    frozenAtUtc,
    extractor,
    extractionFilters: {
      glossarySource: extractionFilters.glossarySource,
      exactCount: extractionFilters.exactValues.size,
      regexCount: extractionFilters.regexes.length,
    },
    surfaces,
    englishLeaves: Object.fromEntries(
      Object.entries(surfaces).map(([surfaceKey, surface]) => [surfaceKey, surface.englishLeaves])
    ),
  };
  extraction.hash = sha256Text(JSON.stringify(extraction));
  return extraction;
}

function updateRunRecord(runRecordPath, extractionPath, extractionHash, target) {
  const runRecord = fs.existsSync(runRecordPath) ? readJson(runRecordPath) : {};
  runRecord.target = target;
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
  updateRunRecord(path.resolve(options.runRecord), path.resolve(options.output), extraction.hash, extraction.target);
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
