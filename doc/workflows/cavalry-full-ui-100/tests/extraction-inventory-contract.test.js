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
      'languages/en/nodeStrings.json': { count: 6199 },
      'languages/en/onboarding.json': { count: 34 },
      'languages/en/tips.json': { count: 51 },
      'json-total': { count: 6294 },
      'compiled-source-map': { count: 3274 },
      'runtime-candidates': { count: 618 },
      'runtime-menuLeaves': { count: 732 },
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

test('G-X preflight rejects Cavalry 2.7.1 compiled source maps below 3274 entries', () => {
  const tempRoot = makeTempDir();
  const sessionDir = path.join(tempRoot, 'session');
  const sourceMapPath = path.join(tempRoot, 'compiled-ui-source-map.json');
  const extractionPath = path.join(sessionDir, 'extraction-inventory.json');

  fs.mkdirSync(sessionDir, { recursive: true });
  writeJson(path.join(tempRoot, 'package.json'), { scripts: {} });
  writeJson(sourceMapPath, {
    entries: new Array(3273).fill({ normalizedText: 'Scene Window' }),
  });
  writeJson(extractionPath, {
    surfaces: {
      'languages/en/appStrings.json': { count: 10 },
      'languages/en/nodeStrings.json': { count: 6199 },
      'languages/en/onboarding.json': { count: 34 },
      'languages/en/tips.json': { count: 51 },
      'json-total': { count: 6294 },
      'compiled-source-map': { count: 3273 },
      'runtime-candidates': { count: 619 },
      'runtime-menuLeaves': { count: 733 },
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
  assert.match(`${result.stdout}\n${result.stderr}`, /3273 < 3274/);
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

test('freeze extraction inventory removes no-UI font glyph, color, script, and pangram denominator noise', () => {
  const tempRoot = makeTempDir();
  const sessionDir = path.join(tempRoot, 'sessions', 'FILTER-SESSION');
  const runtimeInventory = path.join(sessionDir, 'runtime', 'en-merged-inventory.json');
  const sourceMapPath = path.join(tempRoot, 'compiled-ui-source-map.json');

  writeJson(path.join(tempRoot, 'package.json'), { version: '0.1.2' });
  writeJson(path.join(tempRoot, 'tools', 'runtime_ui_allowlist.json'), {});
  writeJson(path.join(tempRoot, 'tools', 'translation-whitelist.json'), {
    _extraction_filters: {
      glossary_source: 'doc/workflows/cavalry-full-ui-100/Anti-Patterns.md §F',
      exact_values: ['Acce', 'Arial', 'Apple Color Emoji', 'Battleship Gray', 'Bassa Vah'],
      regexes: [
        '^(?:[a-z]{2,4}\\s+[A-Z]{2,4}\\s+){2,}',
        "^(?:[A-Z][A-Za-z\\'()-]+|[a-z]+)(?: (?:[A-Z][A-Za-z\\'()-]+|[a-z]+)){0,3} (?:Black|Blue|Brown|Cyan|Gray|Grey|Green|Indigo|Ivory|Khaki|Lavender|Lime|Magenta|Maroon|Olive|Orange|Pink|Purple|Red|Rose|Salmon|Tan|Teal|Turquoise|Violet|White|Yellow)$",
      ],
    },
  });
  writeJson(path.join(tempRoot, 'tools', 'cavalry_qt_target.json'), {
    cavalryVersion: '2.7.1',
    qtVersion: '6.6.3',
  });
  writeJson(path.join(tempRoot, 'languages', 'en', 'appStrings.json'), {
    title: 'App Label',
    glyph: 'Acce',
    color: 'Battleship Gray',
    colorPhrase: 'Algae Green',
  });
  writeJson(path.join(tempRoot, 'languages', 'en', 'nodeStrings.json'), {
    title: 'Node Label',
    font: 'Arial',
    script: 'Bassa Vah',
  });
  writeJson(path.join(tempRoot, 'languages', 'en', 'tips.json'), {
    title: 'Tip Title',
    sample: 'ahk ISK bhk DBX khk GNM nhk',
  });
  writeJson(path.join(tempRoot, 'languages', 'en', 'onboarding.json'), {
    title: 'Welcome',
    emojiFont: 'Apple Color Emoji',
  });
  writeJson(sourceMapPath, {
    bundleVersion: '2.7.1',
    entries: [
      { normalizedText: 'Scene Window' },
      { normalizedText: 'Arial' },
      { normalizedText: 'Battleship Gray' },
      { normalizedText: 'Algae Green' },
      { normalizedText: 'Bassa Vah' },
      { normalizedText: 'ahk ISK bhk DBX khk GNM nhk' },
      { normalizedText: 'Render Queue' },
    ],
  });
  writeJson(runtimeInventory, {
    language: 'en',
    capture: {
      pid: 1234,
      bundleHash: 'bundle-hash',
      sessionUuid: 'FILTER-SESSION',
      wallclockUtc: '2026-05-07T00:00:00.000Z',
      source: 'live-merged',
    },
    menuBars: [{ items: [{ text: 'File' }, { text: 'Arial' }, { text: 'Battleship Gray' }, { text: 'Render Queue' }] }],
    widgetTexts: [
      { strings: { windowTitle: 'Scene Window', sample: 'ahk ISK bhk DBX khk GNM nhk' } },
    ],
  });

  const extraction = buildExtractionInventory({
    repoRoot: tempRoot,
    sessionDir,
    compiledSourceMap: sourceMapPath,
    runtimeInventory,
  });
  const values = Object.values(extraction.englishLeaves)
    .flat()
    .map((leaf) => leaf.value);

  assert.equal(values.includes('Acce'), false);
  assert.equal(values.includes('Arial'), false);
  assert.equal(values.includes('Apple Color Emoji'), false);
  assert.equal(values.includes('Battleship Gray'), false);
  assert.equal(values.includes('Algae Green'), false);
  assert.equal(values.includes('Bassa Vah'), false);
  assert.equal(values.includes('ahk ISK bhk DBX khk GNM nhk'), false);
  assert.deepEqual(
    extraction.englishLeaves['compiled-source-map'].map((leaf) => leaf.value),
    ['Scene Window', 'Render Queue']
  );
  assert.deepEqual(
    extraction.englishLeaves['runtime-candidates'].map((leaf) => leaf.value).sort(),
    ['File', 'Render Queue', 'Scene Window'].sort()
  );
});

test('freeze extraction inventory rejects denominator filters without glossary source', () => {
  const tempRoot = makeTempDir();
  const sessionDir = path.join(tempRoot, 'sessions', 'BAD-FILTER-SESSION');
  const runtimeInventory = path.join(sessionDir, 'runtime', 'en-merged-inventory.json');
  const sourceMapPath = path.join(tempRoot, 'compiled-ui-source-map.json');

  writeMinimalLanguageTree(tempRoot);
  writeJson(path.join(tempRoot, 'package.json'), { version: '0.1.2' });
  writeJson(path.join(tempRoot, 'tools', 'runtime_ui_allowlist.json'), {});
  writeJson(path.join(tempRoot, 'tools', 'translation-whitelist.json'), {
    _extraction_filters: {
      exact_values: ['Arial'],
    },
  });
  writeJson(sourceMapPath, { entries: [{ normalizedText: 'Scene Window' }] });
  writeJson(runtimeInventory, {
    language: 'en',
    capture: { sessionUuid: 'BAD-FILTER-SESSION' },
    menuBars: [],
    widgetTexts: [{ strings: { windowTitle: 'Scene Window' } }],
  });

  assert.throws(
    () =>
      buildExtractionInventory({
        repoRoot: tempRoot,
        sessionDir,
        compiledSourceMap: sourceMapPath,
        runtimeInventory,
      }),
    /glossary_source/
  );
});
