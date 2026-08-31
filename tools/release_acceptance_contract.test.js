#!/usr/bin/env node
/**
 * [INPUT]: release_acceptance_contract、evidence/seal/updater manifest CLI 与临时 21-run/48-point session fixture
 * [OUTPUT]: 覆盖真实 session 关系复验、Windows 原始 session 入口、证据附加字段/篡改拒绝，以及 seal 对人工安装/updater 字节与显式 macOS ad-hoc 状态的绑定
 * [POS]: release-bound live acceptance 的对抗回归测试；不启动 Cavalry、不制造可发布 PASS
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const zlib = require('node:zlib');
const { sha256: sha256Buffer } = require('./release_seal_signature');
const { GUIDE_FILES } = require('./macos-acceptance/source_contract');
const { spawnSync } = require('node:child_process');
const { loadConfig, metadataForTag } = require('./release_metadata');
const {
  LANGUAGES,
  assertEvidenceMatchesSession,
  validateEvidence,
  verifyAcceptanceSession,
} = require('./release_acceptance_contract');

const repoRoot = path.resolve(__dirname, '..');
const SOURCE_COMMIT = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const RELEASE_COMMIT = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
const TAG = 'cavalry-2.7.2-p999';
const SCENARIOS = {
  search: ['add-layer-tooltip', 'statistics-compute-time', 'statistics-draw-time', 'statistics-total-nodes'],
  'add-tag': ['tag-add', 'tag-assign'],
  save: ['save'],
  replace: ['replace', 'create'],
  tracking: ['tracking'],
  onboarding: ['onboarding-step-1', 'onboarding-step-2', 'onboarding-step-3', 'onboarding-step-4', 'onboarding-step-5'],
  transform: ['transform-tool-help'],
};

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}
function identity(file) {
  const stat = fs.statSync(file);
  return { path: file, bytes: stat.size, sha256: sha256(file), dev: stat.dev, ino: stat.ino };
}
function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function pngChunk(type, payload) {
  const name = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(payload.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([name, payload])));
  return Buffer.concat([length, name, payload, checksum]);
}
function tinyPng(firstRed = 255) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(2, 0);
  ihdr.writeUInt32BE(2, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const pixels = Buffer.from([
    0, firstRed, 0, 0, 255, 0, 255, 0, 255,
    0, 0, 0, 255, 255, 255, 255, 255, 255,
  ]);
  return Buffer.concat([
    Buffer.from('89504e470d0a1a0a', 'hex'),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(pixels)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}
function binaryIdentity(file) {
  return { ...identity(file), arch: 'arm64', uuid: 'UUID ARM64 FIXTURE', cdHash: 'fixture-cdhash' };
}
function writePng(file) {
  writeFile(file, tinyPng());
  return { ...identity(file), width: 2, height: 2 };
}
function writeFile(file, content = 'fixture\n') {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
  return identity(file);
}
function writeJson(file, value) {
  return writeFile(file, `${JSON.stringify(value, null, 2)}\n`);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function refreshFinalRecord(session) {
  const machinePath = path.join(session, 'matrix-machine-record.json');
  const reviewPath = path.join(session, 'manual-review.json');
  const finalPath = path.join(session, 'matrix-final-record.json');
  const finalRecord = readJson(finalPath);
  finalRecord.machine = identity(machinePath);
  finalRecord.review = identity(reviewPath);
  writeJson(finalPath, finalRecord);
}

function rewriteFirstRun(fixture, mutate) {
  const machinePath = path.join(fixture.session, 'matrix-machine-record.json');
  const machine = readJson(machinePath);
  const run = machine.runs[0];
  const manifest = readJson(run.manifest.path);
  const oldManifestPath = run.manifest.path;
  mutate(manifest, machine);
  const rewrittenManifest = writeJson(oldManifestPath, manifest);
  run.manifest = rewrittenManifest;
  for (const point of machine.points.filter((item) => item.runManifest.path === oldManifestPath)) {
    point.runManifest = rewrittenManifest;
  }
  writeJson(machinePath, machine);
  refreshFinalRecord(fixture.session);
}

function makeSession() {
  const temp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cavalry-release-session-')));
  const session = path.join(temp, 'SESSION_001');
  const external = path.join(temp, 'external');
  const appPath = path.join(external, 'Cavalry.app');
  fs.mkdirSync(session);
  fs.mkdirSync(appPath, { recursive: true });
  const externalFile = (name, content = `${name}\n`) => writeFile(path.join(external, name), content);
  const targetFile = externalFile('cavalry_qt_target.json');
  const qtSdkFile = path.join(external, 'QtCore-sdk');
  const qtRuntimeFile = path.join(external, 'QtCore-runtime');
  const executableFile = path.join(appPath, 'Cavalry');
  externalFile('QtCore-sdk');
  externalFile('QtCore-runtime');
  writeFile(executableFile, 'Cavalry executable\n');
  const qtSdk = binaryIdentity(qtSdkFile);
  const qtRuntime = binaryIdentity(qtRuntimeFile);
  const executable = binaryIdentity(executableFile);
  const sourceFile = path.join(external, 'source.mm');
  writeFile(sourceFile, 'tracked source fixture\n');
  const frozenSourcePath = path.join(session, 'source-snapshot/repo/injector/source.mm');
  writeFile(frozenSourcePath, fs.readFileSync(sourceFile));
  const tools = {
    injector: binaryIdentity(externalFileInSession('bin/injector.dylib')),
    main: binaryIdentity(externalFileInSession('bin/main.dylib')),
    supplemental: binaryIdentity(externalFileInSession('bin/supplemental.dylib')),
    exactWindow: binaryIdentity(externalFileInSession('bin/cgwindow_exact')),
  };
  function externalFileInSession(relative, content = `${relative}\n`) {
    const file = path.join(session, relative);
    writeFile(file, content);
    return file;
  }
  const buildEvidence = {
    acceptanceScript: identity(externalFileInSession('source-snapshot/acceptance/build.sh')),
    productScript: identity(externalFileInSession('build-source/tools/build.sh')),
    regeneratedTable: identity(externalFileInSession('build-source/injector/generated.inc')),
  };
  const frozenFixtureRoot = path.join(session, 'source-snapshot', 'acceptance', 'fixtures');
  const liveFixtureRoot = path.join(session, 'fixtures');
  const frozenFixtureFiles = [
    ['replace-source.png', tinyPng()],
    ['dynamic-proof-two.png', tinyPng()],
    ['replace-source.mp4', Buffer.from('000000186674797069736f6d0000000069736f6d6d703432', 'hex')],
  ].map(([name, content]) => {
    const frozen = path.join(frozenFixtureRoot, name);
    const live = path.join(liveFixtureRoot, name);
    writeFile(frozen, content);
    writeFile(live, content);
    return { name, frozen, live };
  });
  const fixtureEvidence = [
    { ...identity(frozenFixtureFiles[0].live), width: 2, height: 2 },
    { ...identity(frozenFixtureFiles[1].live), width: 2, height: 2 },
    { ...identity(frozenFixtureFiles[2].live), duration: 1.25 },
  ];
  const stageRecords = new Map();
  const stages = LANGUAGES.map((language) => {
    const files = GUIDE_FILES.map(([sourceRelative, destinationRelative], index) => {
      const content = `${language}-guide-${index}\n`;
      const source = externalFileInSession(
        `source-snapshot/repo/languages/${language}/${sourceRelative}`,
        content
      );
      const destination = path.join(appPath, 'Contents', 'assets', destinationRelative);
      writeFile(destination, content);
      return { source: identity(source), destination: identity(destination) };
    });
    const record = {
      language,
      files,
      executable: binaryIdentity(executableFile),
      runtimeQtCore: binaryIdentity(qtRuntimeFile),
    };
    const stageIdentity = writeJson(path.join(session, 'language-stage', `${language}.json`), record);
    stageRecords.set(language, record);
    return stageIdentity;
  });
  const runs = [];
  const points = [];
  for (const [languageIndex, language] of LANGUAGES.entries()) {
    for (const [scenario, surfaces] of Object.entries(SCENARIOS)) {
      const runUuid = `${language}-${scenario}-uuid`;
      const pid = 1000 + languageIndex * 100 + Object.keys(SCENARIOS).indexOf(scenario);
      const runDir = path.join(session, 'runs', language, scenario);
      const captures = [];
      const surfaceResults = [];
      const pointEvidence = [];
      let sequence = 0;
      for (const surface of surfaces) {
        const variants = [];
        const evidence = [];
        const variantCount = scenario === 'replace' ? 2 : 1;
        for (let variantIndex = 0; variantIndex < variantCount; variantIndex += 1) {
          sequence += 1;
          const visibleSurface = variantCount === 1
            ? surface
            : `${surface}-variant-${variantIndex + 1}`;
          const prefix = `${String(sequence).padStart(2, '0')}-${visibleSurface}`;
          const readyPath = path.join(runDir, 'captures', `${prefix}.ready.json`);
          const screenshotPath = path.join(runDir, 'captures', `${prefix}-window-os.png`);
          const target = {
            widgetClass: 'QWidget',
            objectName: `${surface}-object`,
            childBounds: { x: 10, y: 20, width: 120, height: 60 },
            windowBounds: { x: 0, y: 0, width: 640, height: 480 },
            nativeWindowNumber: 5000 + sequence,
            childIsTopLevel: false,
            windowTitle: 'Cavalry',
          };
          const result = {
            surface: visibleSurface,
            text: `${language} ${surface} ${variantIndex}`,
            sequence,
            target,
            readyPath,
            ownerClass: 'FixtureOwner',
          };
          if (variantCount > 1) result.logicalSurface = surface;
          if (['search', 'add-tag', 'save', 'replace', 'tracking'].includes(scenario)) {
            result.ownerExternalUnchanged = true;
          }
          if (scenario === 'onboarding') {
            result.catalogSlot = 'en';
            result.body = 'Fixture onboarding body';
            result.buttons = ['Next'];
          }
          if (scenario === 'transform') {
            result.callerBoundaryVerified = true;
            result.expectedTranslations = ['a', 'b', 'c', 'd', 'e'];
          }
          const ready = {
            schema: 'cavalry-i18n.acceptance-v2.capture-ready/v1',
            runUuid,
            language,
            scenario,
            pid,
            sequence,
            surface: visibleSurface,
            target,
            result,
          };
          const readyIdentity = writeJson(readyPath, ready);
          const screenshot = writePng(screenshotPath);
          const mapped = {
            window: target.nativeWindowNumber,
            pid,
            owner: 'Cavalry',
            title: 'Cavalry',
            layer: 0,
            surface: visibleSurface,
            bounds: target.windowBounds,
          };
          const ack = writeJson(path.join(runDir, 'captures', `${prefix}.ack.json`), {
            schema: 'cavalry-i18n.acceptance-v2.capture-ack/v1',
            status: 'CAPTURED',
            runUuid,
            pid,
            sequence,
            surface: visibleSurface,
            ready: readyIdentity,
            mapped,
            osPng: screenshot,
          });
          captures.push({ ready, readyIdentity, ack, mapped, osPng: screenshot });
          variants.push(result);
          evidence.push({ surface: visibleSurface, sequence, screenshot });
        }
        const surfaceResult = variantCount > 1
          ? {
              surface,
              text: `${language} ${surface}`,
              target: variants.at(-1).target,
              variants,
            }
          : variants[0];
        surfaceResults.push(surfaceResult);
        pointEvidence.push({ surface, evidence });
      }
      const terminal = surfaceResults.at(-1);
      const done = writeJson(path.join(runDir, 'done.json'), {
        schema: 'cavalry-i18n.acceptance-v2.done/v2',
        status: 'OK',
        runUuid,
        language,
        scenario,
        pid,
        surface: terminal.surface,
        surfaceResults,
        reason: 'OK fixture semantic validation',
        target: terminal.target,
      });
      const stageRecord = stageRecords.get(language);
      const initial = {
        pid,
        startToken: `fixture-start-${pid}`,
        executable: stageRecord.executable,
      };
      const manifest = {
        schema: 'cavalry-i18n.acceptance-v2.run/v4',
        uuid: runUuid,
        language,
        scenario,
        stage: stages[languageIndex],
        initial,
        injectorLoaded: tools.injector,
        driverLoaded: ['search', 'add-tag', 'save', 'replace', 'tracking'].includes(scenario)
          ? tools.main
          : tools.supplemental,
        runtimeQtLoaded: stageRecord.runtimeQtCore,
        done,
        driverLog: identity(externalFileInSession(`runs/${language}/${scenario}/driver.log`)),
        processLog: identity(externalFileInSession(`runs/${language}/${scenario}/process.log`)),
        captures,
        logicalSurfaces: surfaceResults,
        pointEvidence,
        cleanup: { beforeTerminate: initial, exactChildCleaned: true },
      };
      const manifestIdentity = writeJson(path.join(runDir, 'manifest.json'), manifest);
      runs.push({ language, scenario, manifest: manifestIdentity });
      for (const item of pointEvidence) {
        points.push({
          key: `${language}/${item.surface}`,
          language,
          surface: item.surface,
          runManifest: manifestIdentity,
          evidence: item.evidence,
        });
      }
    }
  }
  const machine = {
    schema: 'cavalry-i18n.acceptance-v2.matrix/v6',
    status: 'MACHINE-COMPLETE-MANUAL-PENDING',
    createdAtUtc: '2026-08-09T00:00:00.000Z',
    host: { productVersion: '15.6', buildVersion: '24G84' },
    repository: { root: repoRoot, head: SOURCE_COMMIT, worktreeStatus: [] },
    target: { file: targetFile, cavalryVersion: '2.7.2', qtVersion: '6.6.3' },
    qt: {
      expectedVersion: '6.6.3',
      sdk: { prefix: external, version: '6.6.3', core: qtSdk },
      runtime: { version: '6.6.3', core: qtRuntime },
      finalRuntimeCore: qtRuntime,
    },
    clone: {
      appPath,
      version: '2.7.2',
      expectedExecutableSha256: executable.sha256,
      originalExecutable: executable,
      finalExecutable: executable,
    },
    productInjector: tools.injector,
    tools,
    buildEvidence,
    sources: [
      { source: identity(sourceFile), frozen: identity(frozenSourcePath) },
      ...frozenFixtureFiles.map(({ name, frozen }) => {
        const source = path.join(external, `source-${name}`);
        writeFile(source, fs.readFileSync(frozen));
        return { source: identity(source), frozen: identity(frozen) };
      }),
    ],
    fixtureEvidence,
    stages,
    runs,
    points,
  };
  const machineIdentity = writeJson(path.join(session, 'matrix-machine-record.json'), machine);
  const reviewIdentity = writeJson(path.join(session, 'manual-review.json'), {
    schema: 'cavalry-i18n.acceptance-v2.manual-review/v1',
    points: points.map((point) => ({
      key: point.key,
      status: 'APPROVED',
      screenshots: point.evidence.map((item) => item.screenshot),
    })),
  });
  writeJson(path.join(session, 'matrix-final-record.json'), {
    schema: 'cavalry-i18n.acceptance-v2.final/v1',
    status: 'PASS-48-OF-48',
    sealedAtUtc: '2026-08-09T01:00:00.000Z',
    machine: machineIdentity,
    review: reviewIdentity,
    points: points.map((point) => point.key).sort(),
  });
  return { temp, session, firstScreenshot: points[0].evidence[0].screenshot.path };
}

function evidenceFrom(summary) {
  return {
    schemaVersion: 3,
    kind: 'ReleaseAcceptanceEvidence',
    tag: TAG,
    sourceCommitSha: SOURCE_COMMIT,
    targetCavalryVersion: '2.7.2',
    qtVersion: '6.6.3',
    languages: [...LANGUAGES],
    macosAcceptance: {
      result: 'PASS-48-OF-48',
      matrix: '21-run/48-point',
      producer: 'tools/macos-acceptance',
      sessionId: summary.sessionId,
      finalRecord: summary.finalRecord,
      machineRecord: summary.machineRecord,
      manualReview: summary.manualReview,
      sessionManifestSha256: summary.sessionManifestSha256,
      host: summary.host,
    },
    createdAtUtc: '2026-08-09T00:00:00.000Z',
    createdBy: 'test',
  };
}

test('real session verifier replays all 21 runs, 48 points, and screenshot identities', () => {
  const fixture = makeSession();
  try {
    const machine = readJson(path.join(fixture.session, 'matrix-machine-record.json'));
    const historicalStage = readJson(machine.stages[0].path);
    assert.notEqual(
      historicalStage.files[0].destination.sha256,
      sha256(historicalStage.files[0].destination.path),
      'the fixture must model a historical stage whose shared destination was later overwritten'
    );
    const summary = verifyAcceptanceSession(fixture.session);
    const evidence = validateEvidence(evidenceFrom(summary));
    assert.doesNotThrow(() => assertEvidenceMatchesSession(evidence, summary));
    fs.writeFileSync(fixture.firstScreenshot, 'tampered');
    assert.throws(() => verifyAcceptanceSession(fixture.session), /byte length drifted|SHA-256 drifted/);
  } finally {
    fs.rmSync(fixture.temp, { recursive: true, force: true });
  }
});

test('valid-looking substitute media cannot replace the exact frozen committed fixtures', () => {
  const fixture = makeSession();
  try {
    const machinePath = path.join(fixture.session, 'matrix-machine-record.json');
    const machine = readJson(machinePath);
    const substitutePath = machine.fixtureEvidence[0].path;
    writeFile(substitutePath, tinyPng(1));
    machine.fixtureEvidence[0] = { ...identity(substitutePath), width: 2, height: 2 };
    writeJson(machinePath, machine);
    refreshFinalRecord(fixture.session);
    assert.throws(
      () => verifyAcceptanceSession(fixture.session),
      /not the exact frozen producer fixture/
    );
  } finally {
    fs.rmSync(fixture.temp, { recursive: true, force: true });
  }
});

test('session verifier binds every run to its language stage and every point to its logical surface', () => {
  const stageFixture = makeSession();
  try {
    const machinePath = path.join(stageFixture.session, 'matrix-machine-record.json');
    const machine = readJson(machinePath);
    const run = machine.runs.find((item) => item.language === 'zh-Hans' && item.scenario === 'search');
    const manifest = readJson(run.manifest.path);
    manifest.stage = machine.stages[1];
    const rewrittenManifest = writeJson(run.manifest.path, manifest);
    run.manifest = rewrittenManifest;
    for (const point of machine.points.filter((item) =>
      item.language === 'zh-Hans' && SCENARIOS.search.includes(item.surface))) {
      point.runManifest = rewrittenManifest;
    }
    writeJson(machinePath, machine);
    refreshFinalRecord(stageFixture.session);
    assert.throws(
      () => verifyAcceptanceSession(stageFixture.session),
      /not bound to its exact language stage/
    );
  } finally {
    fs.rmSync(stageFixture.temp, { recursive: true, force: true });
  }

  const surfaceFixture = makeSession();
  try {
    const machinePath = path.join(surfaceFixture.session, 'matrix-machine-record.json');
    const reviewPath = path.join(surfaceFixture.session, 'manual-review.json');
    const machine = readJson(machinePath);
    const review = readJson(reviewPath);
    const left = machine.points.find((point) => point.key === 'zh-Hans/add-layer-tooltip');
    const right = machine.points.find((point) => point.key === 'zh-Hans/statistics-compute-time');
    [left.evidence, right.evidence] = [right.evidence, left.evidence];
    for (const point of [left, right]) {
      review.points.find((item) => item.key === point.key).screenshots =
        point.evidence.map((item) => item.screenshot);
    }
    writeJson(machinePath, machine);
    writeJson(reviewPath, review);
    refreshFinalRecord(surfaceFixture.session);
    assert.throws(
      () => verifyAcceptanceSession(surfaceFixture.session),
      /screenshot semantic binding mismatch/
    );
  } finally {
    fs.rmSync(surfaceFixture.temp, { recursive: true, force: true });
  }
});

test('manual review rejects a duplicated screenshot identity that omits required machine evidence', () => {
  const fixture = makeSession();
  try {
    const reviewPath = path.join(fixture.session, 'manual-review.json');
    const review = readJson(reviewPath);
    const replace = review.points.find((point) => point.key === 'zh-Hans/replace');
    assert.equal(replace.screenshots.length, 2);
    replace.screenshots[1] = { ...replace.screenshots[0] };
    writeJson(reviewPath, review);
    refreshFinalRecord(fixture.session);
    assert.throws(
      () => verifyAcceptanceSession(fixture.session),
      /not bound to machine evidence|does not cover the exact machine evidence set/
    );
  } finally {
    fs.rmSync(fixture.temp, { recursive: true, force: true });
  }
});

test('release verifier requires the producer process/runtime/driver/cleanup closure', () => {
  const cases = [
    {
      mutate(manifest) { delete manifest.injectorLoaded; },
      expected: /run\.manifest keys mismatch/,
    },
    {
      mutate(manifest, machine) { manifest.driverLoaded = machine.tools.supplemental; },
      expected: /executable\/runtime\/injector\/driver binding mismatch/,
    },
    {
      mutate(manifest, machine) { manifest.runtimeQtLoaded = machine.tools.injector; },
      expected: /run\.runtimeQtLoaded\.path must be|executable\/runtime\/injector\/driver binding mismatch/,
    },
    {
      mutate(manifest, machine) {
        manifest.initial.executable = machine.tools.injector;
        manifest.cleanup.beforeTerminate.executable = machine.tools.injector;
      },
      expected: /run\.initial\.executable\.path must be|executable\/runtime\/injector\/driver binding mismatch/,
    },
    {
      mutate(manifest) { delete manifest.cleanup; },
      expected: /run\.manifest keys mismatch/,
    },
  ];
  for (const fixtureCase of cases) {
    const fixture = makeSession();
    try {
      rewriteFirstRun(fixture, fixtureCase.mutate);
      assert.throws(() => verifyAcceptanceSession(fixture.session), fixtureCase.expected);
    } finally {
      fs.rmSync(fixture.temp, { recursive: true, force: true });
    }
  }
});

test('evidence schema is exact and cannot add a hand-written PASS note', () => {
  const fixture = makeSession();
  try {
    const evidence = evidenceFrom(verifyAcceptanceSession(fixture.session));
    evidence.macosAcceptance.notes = 'trust me';
    assert.throws(() => validateEvidence(evidence), /keys mismatch/);
  } finally {
    fs.rmSync(fixture.temp, { recursive: true, force: true });
  }
});

test('Windows acceptance stays optional for ordinary evidence but is mandatory for a Windows release check', () => {
  const fixture = makeSession();
  try {
    const evidence = evidenceFrom(verifyAcceptanceSession(fixture.session));
    assert.doesNotThrow(() => validateEvidence(evidence));
    assert.throws(
      () => validateEvidence(evidence, { requireWindows: true }),
      /Windows acceptance is required when the release declares a Windows artifact/
    );
  } finally {
    fs.rmSync(fixture.temp, { recursive: true, force: true });
  }
});

test('release evidence CLIs reject portable Windows summary inputs', () => {
  for (const script of [
    'tools/create_release_acceptance_evidence.js',
    'tools/verify_release_acceptance_evidence.js',
  ]) {
    const source = fs.readFileSync(path.join(repoRoot, script), 'utf8');
    assert.match(
      source,
      /args\.find\(\(arg\) => arg\.startsWith\(`\$\{name\}=`\)\)/,
      `${script} must parse --windows-session-dir=<path> instead of silently skipping it`
    );
    for (const option of ['--windows-acceptance', '--windows-acceptance=summary.json']) {
      const argv = option.includes('=') ? [option] : [option, 'summary.json'];
      const result = spawnSync(
        process.execPath,
        [path.join(repoRoot, script), ...argv],
        { cwd: repoRoot, encoding: 'utf8' }
      );
      assert.notEqual(result.status, 0, `${script} must reject summary input`);
      assert.match(
        `${result.stderr}\n${result.stdout}`,
        /--windows-acceptance is not accepted; pass --windows-session-dir for raw Windows session verification\./,
        `${script} must direct callers to raw session verification`
      );
    }
  }
});

test('seal creator consumes evidence, declared macOS signing, and exact asset bytes', () => {
  const fixture = makeSession();
  try {
    const summary = verifyAcceptanceSession(fixture.session);
    const evidencePath = path.join(fixture.temp, `${TAG}.evidence.json`);
    const metadata = metadataForTag(loadConfig(), TAG);
    const assets = [
      metadata.RELEASE_ASSET_NAME_AARCH64,
      metadata.RELEASE_ASSET_NAME_X64,
      metadata.RELEASE_ASSET_NAME_WINDOWS_X64,
    ].map((name) => path.join(fixture.temp, name));
    assets.forEach((file, index) => fs.writeFileSync(file, `asset-${index}`));
    const updater = {
      manifest: path.join(fixture.temp, metadata.RELEASE_UPDATER_MANIFEST_NAME),
      arm: path.join(fixture.temp, metadata.RELEASE_UPDATER_ASSET_NAME_AARCH64),
      intel: path.join(fixture.temp, metadata.RELEASE_UPDATER_ASSET_NAME_X64),
      windows: assets[2],
    };
    fs.writeFileSync(updater.arm, 'updater-arm');
    fs.writeFileSync(updater.intel, 'updater-intel');
    const updaterSignatures = {
      arm: `${updater.arm}.sig`,
      intel: `${updater.intel}.sig`,
      windows: `${updater.windows}.sig`,
    };
    for (const [key, file] of Object.entries(updaterSignatures)) {
      fs.writeFileSync(file, `${Buffer.from(`signature-${key}`).toString('base64')}\n`);
    }
    const updaterNotes = path.join(fixture.temp, 'updater-notes.md');
    fs.writeFileSync(updaterNotes, 'Updater acceptance fixture\n');
    const createManifest = spawnSync(process.execPath, [
      path.join(repoRoot, 'tools/create_updater_manifest.js'),
      '--tag', TAG,
      '--output', updater.manifest,
      '--notes', updaterNotes,
      '--pub-date', '2026-08-09T00:00:00Z',
      '--darwin-aarch64', updater.arm,
      '--darwin-aarch64-signature', updaterSignatures.arm,
      '--darwin-x86_64', updater.intel,
      '--darwin-x86_64-signature', updaterSignatures.intel,
      '--windows-x86_64', updater.windows,
      '--windows-x86_64-signature', updaterSignatures.windows,
    ], { cwd: repoRoot, encoding: 'utf8' });
    assert.equal(createManifest.status, 0, createManifest.stderr || createManifest.stdout);
    const windowsAcceptance = {
      schemaVersion: 1,
      kind: 'WindowsReleaseAcceptance',
      tag: TAG,
      result: 'PASS-24-OF-24',
      matrix: '24-screenshot/24-point',
      profile: 'windows-onboarding-adjacent-v1',
      producer: 'tools/windows-acceptance',
      sessionId: 'WINDOWS_SESSION_001',
      sourceCommitSha: SOURCE_COMMIT,
      targetCavalryVersion: '2.7.2',
      qtVersion: '6.6.3',
      architecture: 'x86_64',
      finalRecord: { bytes: 1, sha256: '1'.repeat(64) },
      machineRecord: { bytes: 1, sha256: '2'.repeat(64) },
      manualReview: { bytes: 1, sha256: '3'.repeat(64) },
      sessionSentinel: { bytes: 1, sha256: '4'.repeat(64) },
      sessionManifestSha256: '5'.repeat(64),
      installer: { fileName: metadata.RELEASE_ASSET_NAME_WINDOWS_X64, bytes: fs.statSync(assets[2]).size, sha256: sha256(assets[2]) },
      provenance: { fileName: `${metadata.RELEASE_ASSET_NAME_WINDOWS_X64}.provenance.json`, bytes: 1, sha256: '6'.repeat(64) },
      shippedDlls: {
        generic: { relativePath: 'injector/windows/generic/cavalryi18n.dll', bytes: 1, sha256: '7'.repeat(64) },
        qpa: { relativePath: 'injector/windows/qpa/qwindows.dll', bytes: 1, sha256: '8'.repeat(64) },
      },
      runner: {
        os: 'win32', arch: 'x64', runnerOs: 'Windows Server 2022', runnerArch: 'X64', imageOs: 'win22', imageVersion: '20260801.1',
        node: 'v22.14.0', npm: '10.9.2', rustc: 'rustc 1.98.0', cargo: 'cargo 1.98.0', cmake: '4.2.0', powershell: '5.1.19041.6456',
      },
    };
    const evidence = evidenceFrom(summary);
    evidence.windowsAcceptance = windowsAcceptance;
    fs.writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);
    const sealPath = path.join(fixture.temp, 'ReleaseAcceptanceSeal.json');
    const attestationPath = path.join(fixture.temp, `${TAG}.acceptance-attestation.json`);
    const sbomPath = path.join(fixture.temp, 'CycloneDX.json');
    const toolchainPath = path.join(fixture.temp, 'toolchain-evidence.json');
    fs.writeFileSync(attestationPath, '{\"kind\":\"ReleaseAcceptanceAttestation\"}\n');
    fs.writeFileSync(sbomPath, '{\"bomFormat\":\"CycloneDX\"}\n');
    fs.writeFileSync(toolchainPath, '{\"kind\":\"ToolchainEvidence\"}\n');
    const keyPair = crypto.generateKeyPairSync('ed25519');
    const privateKey = keyPair.privateKey.export({ type: 'pkcs8', format: 'pem' });
    const publicDer = keyPair.publicKey.export({ type: 'spki', format: 'der' });
    const trust = sha256Buffer(publicDer);
    const create = spawnSync(process.execPath, [
      path.join(repoRoot, 'tools/create_release_acceptance_seal.js'),
      '--tag', TAG,
      '--release-commit', RELEASE_COMMIT,
      '--evidence', evidencePath,
      '--aarch64', assets[0], '--x64', assets[1], '--windows-x64', assets[2],
      '--updater-manifest', updater.manifest,
      '--updater-aarch64', updater.arm,
      '--updater-aarch64-signature', updaterSignatures.arm,
      '--updater-x64', updater.intel,
      '--updater-x64-signature', updaterSignatures.intel,
      '--updater-windows-x64-signature', updaterSignatures.windows,
      '--acceptance-attestation', attestationPath, '--sbom', sbomPath, '--toolchain-evidence', toolchainPath,
      '--trusted-public-key-sha256', trust,
      '--macos-signing', 'ad-hoc', '--created-at', '2026-08-09T00:00:00Z',
      '--output', sealPath,
    ], { cwd: repoRoot, encoding: 'utf8', env: { ...process.env, RELEASE_SEAL_PRIVATE_KEY: privateKey } });
    assert.equal(create.status, 0, create.stderr || create.stdout);
    const verify = spawnSync(process.execPath, [
      path.join(repoRoot, 'tools/verify_release_acceptance_seal.js'),
      '--seal', sealPath, '--evidence', evidencePath, '--attestation', attestationPath, '--tag', TAG,
      '--release-commit', RELEASE_COMMIT, '--assets-dir', fixture.temp, '--sidecars-dir', fixture.temp,
      '--trusted-public-key-sha256', trust,
    ], { cwd: repoRoot, encoding: 'utf8' });
    assert.equal(verify.status, 0, verify.stderr || verify.stdout);
    const originalSeal = fs.readFileSync(sealPath, 'utf8');
    fs.chmodSync(sealPath, 0o644);
    const alteredSeal = JSON.parse(originalSeal);
    alteredSeal.createdBy = 'attacker';
    fs.writeFileSync(sealPath, `${JSON.stringify(alteredSeal, null, 2)}\n`);
    const altered = spawnSync(process.execPath, [
      path.join(repoRoot, 'tools/verify_release_acceptance_seal.js'),
      '--seal', sealPath, '--evidence', evidencePath, '--attestation', attestationPath, '--tag', TAG,
      '--release-commit', RELEASE_COMMIT, '--assets-dir', fixture.temp, '--sidecars-dir', fixture.temp,
      '--trusted-public-key-sha256', trust,
    ], { cwd: repoRoot, encoding: 'utf8' });
    assert.notEqual(altered.status, 0);
    assert.match(altered.stderr, /canonical payload digest|signature verification/);
    fs.writeFileSync(sealPath, originalSeal);
    fs.chmodSync(sealPath, 0o444);
    fs.writeFileSync(assets[0], 'tampered');
    const tampered = spawnSync(process.execPath, [
      path.join(repoRoot, 'tools/verify_release_acceptance_seal.js'),
      '--seal', sealPath, '--evidence', evidencePath, '--attestation', attestationPath, '--tag', TAG,
      '--release-commit', RELEASE_COMMIT, '--assets-dir', fixture.temp, '--sidecars-dir', fixture.temp,
      '--trusted-public-key-sha256', trust,
    ], { cwd: repoRoot, encoding: 'utf8' });
    assert.notEqual(tampered.status, 0);
    assert.match(tampered.stderr, /byte mismatch|SHA-256 mismatch/);
  } finally {
    fs.rmSync(fixture.temp, { recursive: true, force: true });
  }
});

test('manual confirmation flags are rejected instead of minting evidence', () => {
  const result = spawnSync(process.execPath, [
    path.join(repoRoot, 'tools/create_release_acceptance_evidence.js'),
    '--tag', TAG, '--session-dir', '/tmp/not-used', '--confirm-live-pass',
  ], { cwd: repoRoot, encoding: 'utf8' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /not accepted|derived only from a verified live session/);
});

test('tag verifier accepts one evidence-only child commit and rejects any extra change', () => {
  const temp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cavalry-release-topology-')));
  const git = (gitArgs) => {
    const result = spawnSync('git', gitArgs, { cwd: temp, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    return result.stdout.trim();
  };
  try {
    git(['init', '-q']);
    git(['config', 'user.name', 'Test']);
    git(['config', 'user.email', 'test@example.invalid']);
    fs.writeFileSync(path.join(temp, 'source.txt'), 'source\n');
    git(['add', 'source.txt']);
    git(['commit', '-qm', 'source']);
    const sourceCommit = git(['rev-parse', 'HEAD']);
    const summary = {
      sourceCommitSha: sourceCommit,
      sessionId: 'SESSION_001',
      finalRecord: { bytes: 1, sha256: '1'.repeat(64) },
      machineRecord: { bytes: 1, sha256: '2'.repeat(64) },
      manualReview: { bytes: 1, sha256: '3'.repeat(64) },
      sessionManifestSha256: '4'.repeat(64),
      host: { productVersion: '15.6', buildVersion: '24G84' },
    };
    const evidence = evidenceFrom(summary);
    evidence.sourceCommitSha = sourceCommit;
    const evidenceDir = path.join(temp, 'release-seals');
    fs.mkdirSync(evidenceDir);
    const evidencePath = path.join(evidenceDir, `${TAG}.evidence.json`);
    fs.writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);
    const attestationPath = path.join(evidenceDir, `${TAG}.acceptance-attestation.json`);
    fs.writeFileSync(attestationPath, '{"fixture":"attestation"}\n');
    git(['add', path.relative(temp, evidencePath), path.relative(temp, attestationPath)]);
    git(['commit', '-qm', 'release evidence']);
    const releaseCommit = git(['rev-parse', 'HEAD']);
    const verifyArgs = [
      path.join(repoRoot, 'tools/verify_release_acceptance_evidence.js'),
      '--evidence', evidencePath, '--tag', TAG,
      '--release-commit', releaseCommit, '--check-tag-topology',
    ];
    const accepted = spawnSync(process.execPath, verifyArgs, { cwd: temp, encoding: 'utf8' });
    assert.equal(accepted.status, 0, accepted.stderr || accepted.stdout);

    git(['reset', '--soft', sourceCommit]);
    fs.writeFileSync(path.join(temp, 'unexpected.txt'), 'not evidence-only\n');
    git(['add', 'unexpected.txt', path.relative(temp, evidencePath), path.relative(temp, attestationPath)]);
    git(['commit', '-qm', 'invalid release evidence']);
    const invalidCommit = git(['rev-parse', 'HEAD']);
    const rejected = spawnSync(process.execPath, [
      ...verifyArgs.slice(0, -3),
      '--release-commit', invalidCommit, '--check-tag-topology',
    ], { cwd: temp, encoding: 'utf8' });
    assert.notEqual(rejected.status, 0);
    assert.match(rejected.stderr, /must change only/);
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});
