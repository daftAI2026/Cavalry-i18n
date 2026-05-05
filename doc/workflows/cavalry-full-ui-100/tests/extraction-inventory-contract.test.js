/**
 * [INPUT]: 依赖 tools/verify_gate_inputs.js 的 CLI preflight 与临时 extraction inventory fixture
 * [OUTPUT]: 对外提供 G-X 缺分母、弱 runtime denominator 的契约测试
 * [POS]: full-ui-100 tests 的 extraction freeze 红绿契约，防止弱抓取被当作 PASS
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const repoRoot = path.resolve(__dirname, '..', '..', '..', '..');
const verifyGateInputsPath = path.join(repoRoot, 'tools', 'verify_gate_inputs.js');
const { buildExtractionInventory } = require(path.join(repoRoot, 'tools', 'freeze_extraction_inventory.js'));

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'cavalry-i18n-gx-'));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
}

function writeMinimalLanguageTree(root) {
  for (const lang of ['en']) {
    const langDir = path.join(root, 'languages', lang);
    writeJson(path.join(langDir, 'appStrings.json'), [{ value: 'App Label', type: 'label' }]);
    writeJson(path.join(langDir, 'nodeStrings.json'), [
      { value: { niceName: 'Node Label', type: 'node', language: 'en' } },
    ]);
    writeJson(path.join(langDir, 'onboarding.json'), [{ title: 'Welcome' }]);
    writeJson(path.join(langDir, 'tips.json'), [{ title: 'Tip', text: 'Use the tool', images: [] }]);
  }
}

test('G-X preflight fails when extraction inventory is missing', () => {
  const tempRoot = makeTempDir();
  const sessionDir = path.join(tempRoot, 'session');
  const sourceMapPath = path.join(tempRoot, 'compiled-ui-source-map.json');

  fs.mkdirSync(sessionDir, { recursive: true });
  writeJson(path.join(tempRoot, 'package.json'), { scripts: {} });
  writeJson(sourceMapPath, {
    entries: new Array(4743).fill({ normalizedText: 'Scene Window' }),
  });

  const result = spawnSync(
    process.execPath,
    [
      verifyGateInputsPath,
      '--repo-root',
      tempRoot,
      '--session-dir',
      sessionDir,
      '--compiled-source-map',
      sourceMapPath,
      '--extraction-inventory',
      path.join(sessionDir, 'extraction-inventory.json'),
    ],
    { encoding: 'utf8' }
  );

  assert.equal(result.status, 1, 'preflight should fail when extraction inventory is absent');
  assert.match(`${result.stdout}\n${result.stderr}`, /extraction-inventory\.json/);
});

test('G-X preflight emits WEAK-CAPTURE when runtime counts miss frozen lower bounds', () => {
  const tempRoot = makeTempDir();
  const sessionDir = path.join(tempRoot, 'session');
  const sourceMapPath = path.join(tempRoot, 'compiled-ui-source-map.json');
  const extractionPath = path.join(sessionDir, 'extraction-inventory.json');

  fs.mkdirSync(sessionDir, { recursive: true });
  writeJson(path.join(tempRoot, 'package.json'), { scripts: {} });
  writeJson(sourceMapPath, {
    entries: new Array(4743).fill({ normalizedText: 'Scene Window' }),
  });
  writeJson(extractionPath, {
    surfaces: {
      'languages/en/appStrings.json': { count: 10 },
      'languages/en/nodeStrings.json': { count: 6320 },
      'languages/en/onboarding.json': { count: 34 },
      'languages/en/tips.json': { count: 51 },
      'json-total': { count: 6415 },
      'compiled-source-map': { count: 4743 },
      'runtime-candidates': { count: 612 },
      'runtime-menuLeaves': { count: 665 },
    },
  });

  const result = spawnSync(
    process.execPath,
    [
      verifyGateInputsPath,
      '--repo-root',
      tempRoot,
      '--session-dir',
      sessionDir,
      '--compiled-source-map',
      sourceMapPath,
      '--extraction-inventory',
      extractionPath,
    ],
    { encoding: 'utf8' }
  );

  assert.equal(result.status, 1, 'preflight should fail when runtime capture misses lower bounds');
  assert.match(`${result.stdout}\n${result.stderr}`, /WEAK-CAPTURE/);
  assert.match(`${result.stdout}\n${result.stderr}`, /runtime-candidates/);
  assert.match(`${result.stdout}\n${result.stderr}`, /runtime-menuLeaves/);
});

test('G-X preflight rejects Cavalry 2.7.1 compiled source maps below 5195 entries', () => {
  const tempRoot = makeTempDir();
  const sessionDir = path.join(tempRoot, 'session');
  const sourceMapPath = path.join(tempRoot, 'compiled-ui-source-map.json');
  const extractionPath = path.join(sessionDir, 'extraction-inventory.json');

  fs.mkdirSync(sessionDir, { recursive: true });
  writeJson(path.join(tempRoot, 'package.json'), { scripts: {} });
  writeJson(sourceMapPath, {
    entries: new Array(5194).fill({ normalizedText: 'Scene Window' }),
  });
  writeJson(extractionPath, {
    surfaces: {
      'languages/en/appStrings.json': { count: 10 },
      'languages/en/nodeStrings.json': { count: 6320 },
      'languages/en/onboarding.json': { count: 34 },
      'languages/en/tips.json': { count: 51 },
      'json-total': { count: 6415 },
      'compiled-source-map': { count: 5194 },
      'runtime-candidates': { count: 613 },
      'runtime-menuLeaves': { count: 666 },
    },
  });

  const result = spawnSync(
    process.execPath,
    [
      verifyGateInputsPath,
      '--repo-root',
      tempRoot,
      '--session-dir',
      sessionDir,
      '--compiled-source-map',
      sourceMapPath,
      '--extraction-inventory',
      extractionPath,
    ],
    { encoding: 'utf8' }
  );

  assert.equal(result.status, 1, 'preflight should fail below the Cavalry 2.7.1 compiled lower bound');
  assert.match(`${result.stdout}\n${result.stderr}`, /compiled-source-map/);
  assert.match(`${result.stdout}\n${result.stderr}`, /5194 < 5195/);
});

test('freeze extraction inventory writes a top-level target identity', () => {
  const tempRoot = makeTempDir();
  const sessionDir = path.join(tempRoot, 'sessions', 'TARGET-SESSION');
  const runtimeInventory = path.join(sessionDir, 'runtime', 'en-merged-inventory.json');
  const sourceMapPath = path.join(tempRoot, 'compiled-ui-source-map.json');

  writeMinimalLanguageTree(tempRoot);
  writeJson(path.join(tempRoot, 'package.json'), { version: '0.1.2' });
  writeJson(path.join(tempRoot, 'tools', 'runtime_ui_allowlist.json'), {});
  writeJson(path.join(tempRoot, 'tools', 'cavalry_qt_target.json'), {
    cavalryVersion: '2.7.1',
    qtVersion: '6.6.3',
  });
  writeJson(sourceMapPath, {
    bundleVersion: '2.7.1',
    compiledUiTargets: [
      '/Applications/Cavalry.app/Contents/MacOS/Cavalry',
      '/Applications/Cavalry.app/Contents/Frameworks/libCavalryUI.dylib',
    ],
    entries: [{ normalizedText: 'Scene Window', source: '/Applications/Cavalry.app/Contents/MacOS/Cavalry' }],
  });
  writeJson(runtimeInventory, {
    language: 'en',
    capture: {
      pid: 1234,
      bundleHash: 'bundle-hash',
      sessionUuid: 'TARGET-SESSION',
      wallclockUtc: '2026-05-05T00:00:00.000Z',
      source: 'live-merged',
    },
    menuBars: [],
    widgetTexts: [{ text: 'Scene Window' }],
  });

  const extraction = buildExtractionInventory({
    repoRoot: tempRoot,
    sessionDir,
    compiledSourceMap: sourceMapPath,
    runtimeInventory,
  });

  assert.deepEqual(extraction.target, {
    cavalryVersion: '2.7.1',
    qtVersion: '6.6.3',
    bundleHash: 'bundle-hash',
    appPath: '/Applications/Cavalry.app',
  });
});
