#!/usr/bin/env node
/**
 * [INPUT]: 依赖 SESSION_DIR runtime/extraction artifacts、compiled source-map、package scripts 与当前 Cavalry 2.7.1 JSON 下界
 * [OUTPUT]: 对外提供 full-ui gate 输入验证，拒绝旧分母、root-cache runtime、弱 lower bound 与伪翻译输入
 * [POS]: tools 的 G-P/G-X 前置守门器，被 package.json check:full-ui 在 matrix 前调用
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

const fs = require('node:fs');
const path = require('node:path');
const { collectMenuStrings, collectWidgetStrings } = require('./check_runtime_ui_coverage.js');
const { detectForbiddenTranslationPatterns } = require('./forbidden_translation_patterns.js');

const EXTRACTION_LOWER_BOUNDS = {
  'languages/en/appStrings.json': 10,
  'languages/en/nodeStrings.json': 6320,
  'languages/en/onboarding.json': 34,
  'languages/en/tips.json': 51,
  'json-total': 6415,
  'compiled-source-map': 4743,
  'runtime-candidates': 613,
  'runtime-menuLeaves': 666,
};
const ALLOWED_CAPTURE_SOURCES = new Set(['live-injector', 'live-accessibility', 'live-merged']);
const FORBIDDEN_SOURCE_MAP_KINDS = new Set(['curated', 'whitelisted', 'gated']);

function fail(message) {
  throw new Error(message);
}

function parseArgs(argv) {
  const options = {
    repoRoot: path.resolve(__dirname, '..'),
    cacheRoot: '',
    sessionDir: '',
    compiledSourceMap: '',
    extractionInventory: '',
    section: '',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--repo-root') {
      options.repoRoot = path.resolve(argv[index + 1] || '');
      index += 1;
      continue;
    }
    if (arg === '--cache-root') {
      options.cacheRoot = path.resolve(argv[index + 1] || '');
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
      continue;
    }
    if (arg === '--section') {
      options.section = argv[index + 1] || '';
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

function collectRootCacheViolations(cacheRoot) {
  const violations = [];
  if (!cacheRoot || !fs.existsSync(cacheRoot)) {
    return violations;
  }

  const illegalRootCacheEntries = fs
    .readdirSync(cacheRoot)
    .filter((entry) => /(?:-inventory\.json|-merged.*\.json|^full-ui-run-record\.json$)/.test(entry));

  for (const entry of illegalRootCacheEntries) {
    violations.push(`Illegal root-cache runtime artifact present: ${path.join(cacheRoot, entry)}`);
  }

  return violations;
}

function collectSessionRuntimeViolations(sessionDir) {
  const violations = [];
  if (!sessionDir) {
    return violations;
  }

  const runtimeDir = path.join(sessionDir, 'runtime');
  if (!fs.existsSync(runtimeDir)) {
    return violations;
  }

  const expectedSessionUuid = path.basename(sessionDir);
  const runtimeArtifacts = fs.readdirSync(runtimeDir).filter((entry) => entry.endsWith('.json'));

  for (const artifact of runtimeArtifacts) {
    const artifactPath = path.join(runtimeDir, artifact);
    const inventory = readJson(artifactPath);
    const capture = inventory?.capture || {};

    for (const field of ['pid', 'bundleHash', 'sessionUuid', 'wallclockUtc', 'source']) {
      if (capture[field] === undefined || capture[field] === null || capture[field] === '') {
        violations.push(`Runtime artifact missing capture.${field}: ${artifactPath}`);
      }
    }

    if (capture.source && !ALLOWED_CAPTURE_SOURCES.has(String(capture.source))) {
      violations.push(
        `Runtime artifact has illegal capture.source=${capture.source}; expected one of ${[...ALLOWED_CAPTURE_SOURCES].join(', ')} (${artifactPath})`
      );
    }

    if (capture.sessionUuid && capture.sessionUuid !== expectedSessionUuid) {
      violations.push(
        `Runtime artifact sessionUuid mismatch: expected ${expectedSessionUuid}, received ${capture.sessionUuid} (${artifactPath})`
      );
    }
  }

  return violations;
}

function collectSessionLayoutViolations(sessionDir) {
  const violations = [];
  if (!sessionDir || !fs.existsSync(sessionDir)) {
    return violations;
  }

  const stack = [sessionDir];
  const runtimeDir = path.join(sessionDir, 'runtime');
  const auditDir = path.join(sessionDir, 'audit');
  while (stack.length > 0) {
    const currentDir = stack.pop();
    for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
      const entryPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        if (entryPath === runtimeDir || entryPath === auditDir) {
          continue;
        }
        stack.push(entryPath);
        continue;
      }

      const isRuntimeLikeArtifact =
        /(?:-inventory\.json|-merged.*\.json)$/.test(entry.name) && entry.name !== 'extraction-inventory.json';
      if (isRuntimeLikeArtifact) {
        violations.push(`Runtime artifact outside SESSION_DIR/runtime: ${entryPath}`);
      }
    }
  }

  return violations;
}

function resolveCompiledSourceMapPath(options) {
  if (options.compiledSourceMap) {
    return options.compiledSourceMap;
  }
  if (options.cacheRoot) {
    return path.join(options.cacheRoot, 'compiled-ui-source-map.json');
  }
  return '';
}

function collectCompiledSourceMapViolations(options) {
  const violations = [];
  const compiledSourceMapPath = resolveCompiledSourceMapPath(options);
  if (!compiledSourceMapPath) {
    return violations;
  }
  if (!fs.existsSync(compiledSourceMapPath)) {
    violations.push(`Missing compiled source map: ${compiledSourceMapPath}`);
    return violations;
  }

  const compiledSourceMap = readJson(compiledSourceMapPath);
  if (FORBIDDEN_SOURCE_MAP_KINDS.has(String(compiledSourceMap.kind || ''))) {
    violations.push(
      `Forbidden compiled source map kind=${compiledSourceMap.kind} at ${compiledSourceMapPath}`
    );
  }

  return violations;
}

function collectForbiddenPatternViolations(options) {
  const violations = [];
  if (options.section !== 'P5' && options.section !== 'p5') {
    return violations;
  }

  if (options.sessionDir) {
    const runtimeDir = path.join(options.sessionDir, 'runtime');
    if (fs.existsSync(runtimeDir)) {
      for (const artifact of fs.readdirSync(runtimeDir).filter((entry) => entry.endsWith('.json'))) {
        const artifactPath = path.join(runtimeDir, artifact);
        const inventory = readJson(artifactPath);
        const collected = [];
        for (const menuBar of inventory.menuBars || []) {
          collectMenuStrings(menuBar, collected);
        }
        collectWidgetStrings(inventory.widgetTexts || [], collected);

        for (const value of collected) {
          const hits = detectForbiddenTranslationPatterns({
            language: inventory.language || '',
            value,
          });
          if (hits.length === 0) {
            continue;
          }
          violations.push(
            `Forbidden runtime pattern ${hits.map((hit) => hit.id).join(',')} in ${artifactPath}: ${value}`
          );
          break;
        }
      }
    }
  }

  const compiledSourceMapPath = resolveCompiledSourceMapPath(options);
  if (compiledSourceMapPath && fs.existsSync(compiledSourceMapPath)) {
    const compiledSourceMap = readJson(compiledSourceMapPath);
    for (const entry of compiledSourceMap.entries || []) {
      const value = String(entry.normalizedText || entry.text || '').trim();
      if (!value) {
        continue;
      }
      const hits = detectForbiddenTranslationPatterns({ value });
      if (hits.length === 0) {
        continue;
      }
      violations.push(
        `Forbidden compiled pattern ${hits.map((hit) => hit.id).join(',')} in ${compiledSourceMapPath}: ${value}`
      );
      break;
    }
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

    const prefix = surfaceKey.startsWith('runtime-') ? 'WEAK-CAPTURE' : 'G-X';
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
    ...collectRootCacheViolations(options.cacheRoot),
    ...collectSessionLayoutViolations(options.sessionDir),
    ...collectSessionRuntimeViolations(options.sessionDir),
    ...collectCompiledSourceMapViolations(options),
    ...collectForbiddenPatternViolations(options),
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
  collectForbiddenPatternViolations,
  collectCompiledSourceMapViolations,
  collectRootCacheViolations,
  collectSessionLayoutViolations,
  collectSessionRuntimeViolations,
  parseArgs,
};
