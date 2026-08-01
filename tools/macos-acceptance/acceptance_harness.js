#!/usr/bin/env node
/**
 * [INPUT]: 冻结同一 canonical repo 的产品/验收源码、target contract、预期 executable SHA-256、fresh disposable Cavalry 2.7.2 clone 与 Qt 6.6.3 SDK/runtime。
 * [OUTPUT]: 从冻结源码构建 product injector 后，生成逐语言绑定 executable/Qt runtime stage 的 21 次产品操作、48 个逻辑表面及 exact-window OS 截图只读 session。
 * [POS]: acceptance-v2 的最小编排器；只做定向 Guide staging、单次同源构建、ready→截图→ack、身份和清理。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const cp = require('node:child_process');
const { isDeepStrictEqual } = require('node:util');
const {
  directory, regular, resolveNewSession, strictChild, strictRealChild,
} = require('./path_safety');
const {
  binaryIdentity, freezeIdentity, identity, sha256, verifyIdentity,
} = require('./artifact_identity');

const ROOT = __dirname;
const LANGUAGES = Object.freeze(['zh-Hans', 'zh-Hant', 'ja_JP']);
const SCENARIOS = Object.freeze([
  'search', 'add-tag', 'save', 'replace', 'tracking', 'onboarding', 'transform',
]);
const MAIN_SCENARIOS = new Set(['search', 'add-tag', 'save', 'replace', 'tracking']);
const EXPECTED_SURFACES = Object.freeze({
  search: ['add-layer-tooltip', 'statistics-compute-time', 'statistics-draw-time', 'statistics-total-nodes'],
  'add-tag': ['tag-add', 'tag-assign'],
  save: ['save'],
  replace: ['replace', 'create'],
  tracking: ['tracking'],
  onboarding: ['onboarding-step-1', 'onboarding-step-2', 'onboarding-step-3', 'onboarding-step-4', 'onboarding-step-5'],
  transform: ['transform-tool-help'],
});
const EXPECTED_CAPTURES = Object.freeze({
  search: 4, 'add-tag': 2, save: 1, replace: 4, tracking: 1, onboarding: 5, transform: 1,
});
const GUIDE_FILES = Object.freeze([
  ['onboarding.json', 'Learn/onboarding.json'],
  ['Learn/Guides/guides.json', 'Learn/Guides/guides.json'],
  ['Learn/Guides/strings.json', 'Learn/Guides/strings.json'],
]);

function parseArgs() {
  const result = {};
  for (let index = 2; index < process.argv.length; index += 1) {
    const value = process.argv[index];
    if (!value.startsWith('--')) throw new Error(`Unexpected argument: ${value}`);
    const key = value.slice(2);
    result[key] = process.argv[index + 1]?.startsWith('--') ? true : (process.argv[++index] ?? true);
  }
  return result;
}

const ARGS = parseArgs();
function fail(message) { throw new Error(message); }
function requirePath(name) {
  const value = ARGS[name];
  if (!value || value === true) fail(`--${name} is required`);
  return path.resolve(value);
}
function requireSha256(name) {
  const value = ARGS[name];
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value)) {
    fail(`--${name} must be a lowercase SHA-256`);
  }
  return value;
}
function sleep(milliseconds) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);
}
function exec(file, args, options = {}) {
  return cp.execFileSync(file, args, {
    encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...options,
  }).trim();
}
function captureExactWindow(windowID, outputPath) {
  let lastError = '';
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const result = cp.spawnSync(
      '/usr/sbin/screencapture',
      ['-x', '-l', String(windowID), outputPath],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
    );
    if (result.status === 0) return;
    if (fs.existsSync(outputPath)) {
      fail(`Failed screencapture left a partial output: ${outputPath}`);
    }
    lastError = String(result.stderr || result.stdout || '').trim();
    sleep(25);
  }
  fail(`Exact window screenshot failed window=${windowID}: ${lastError || 'unknown error'}`);
}
function readJsonComplete(file, label) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const text = fs.readFileSync(file, 'utf8');
      if (text.endsWith('\n')) return JSON.parse(text);
    } catch {}
    sleep(10);
  }
  fail(`${label} never became complete JSON: ${file}`);
}
function writeExclusive(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx', mode: 0o444 });
  return identity(file);
}
function copyExclusive(source, destination, mode = 0o444) {
  regular(source);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination, fs.constants.COPYFILE_EXCL);
  fs.chmodSync(destination, mode);
  return identity(destination);
}

function validatePng(file) {
  const data = fs.readFileSync(file);
  if (data.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') fail(`Invalid PNG: ${file}`);
  const output = exec('/usr/bin/sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', file]);
  const width = Number(output.match(/pixelWidth:\s*(\d+)/)?.[1]);
  const height = Number(output.match(/pixelHeight:\s*(\d+)/)?.[1]);
  if (!(width > 1) || !(height > 1)) fail(`Undecodable/empty PNG: ${file}`);
  return { ...identity(file), width, height };
}
function resolveFfprobe() {
  for (const candidate of ['/opt/homebrew/bin/ffprobe', '/usr/local/bin/ffprobe']) {
    if (fs.existsSync(candidate)) return candidate;
  }
  const candidate = cp.spawnSync('/usr/bin/which', ['ffprobe'], { encoding: 'utf8' }).stdout?.trim();
  if (candidate && fs.existsSync(candidate)) return candidate;
  fail('ffprobe is required for the real tracking fixture');
}
function validateMp4(file) {
  const payload = JSON.parse(exec(resolveFfprobe(), [
    '-v', 'error', '-show_entries', 'format=format_name,duration', '-of', 'json', file,
  ]));
  if (!String(payload.format?.format_name).includes('mp4') || !(Number(payload.format?.duration) > 0)) {
    fail(`Undecodable MP4: ${file}`);
  }
  return { ...identity(file), duration: Number(payload.format.duration) };
}
function sourceEntries(repo) {
  const acceptance = [
    'acceptance_harness.js', 'artifact_identity.js', 'build_acceptance_v2.sh', 'path_safety.js',
    ...fs.readdirSync(path.join(ROOT, 'drivers')).filter((name) => /\.(mm|inc)$/.test(name)).sort().map((name) => `drivers/${name}`),
    ...fs.readdirSync(path.join(ROOT, 'helpers')).filter((name) => name.endsWith('.swift')).sort().map((name) => `helpers/${name}`),
    'fixtures/replace-source.png', 'fixtures/replace-source.mp4', 'fixtures/dynamic-proof-two.png',
  ].map((relative) => ({ source: path.join(ROOT, relative), destination: path.join('acceptance', relative) }));
  const product = [
    'injector/CavalryTranslatorInjector.mm',
    'injector/cavalry_i18n_translation_policy.h',
    'injector/cavalry_i18n_macos_tool_help_text_path.h',
    'injector/cavalry_i18n_macos_tool_help_text_path.cpp',
    'injector/generated_translations.inc',
    'tools/build_translator_injector.sh',
    'tools/generate_embedded_translations.js',
    'tools/cavalry_qt_target.json',
    'tools/model_display_translations.json',
    'tools/runtime-noise-quarantine.json',
    'tools/zh-Hans.ts', 'tools/zh-Hant.ts', 'tools/ja_JP.ts',
  ].map((relative) => ({ source: path.join(repo, relative), destination: path.join('repo', relative) }));
  for (const language of LANGUAGES) {
    for (const [source] of GUIDE_FILES) {
      product.push({
        source: path.join(repo, 'languages', language, source),
        destination: path.join('repo', 'languages', language, source),
      });
    }
  }
  return [...acceptance, ...product];
}
function freezeSources(repo, session) {
  const root = path.join(session, 'source-snapshot');
  return sourceEntries(repo).map(({ source, destination }) => ({
    source: identity(source), frozen: copyExclusive(source, path.join(root, destination)),
  }));
}
function assertSourcesUnchanged(records) {
  for (const record of records) {
    const current = identity(record.source.path);
    if (current.sha256 !== record.source.sha256 || current.bytes !== record.source.bytes) {
      fail(`Source changed during acceptance: ${record.source.path}`);
    }
  }
}

function targetContract(repo) {
  const file = path.join(repo, 'tools', 'cavalry_qt_target.json');
  regular(file);
  const target = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (target.cavalryVersion !== '2.7.2' || target.qtVersion !== '6.6.3') {
    fail(`Acceptance target must remain Cavalry 2.7.2 / Qt 6.6.3: ${file}`);
  }
  return { file: identity(file), cavalryVersion: target.cavalryVersion, qtVersion: target.qtVersion };
}
function plistValue(file, key) {
  regular(file);
  return exec('/usr/libexec/PlistBuddy', ['-c', `Print :${key}`, file]);
}
function qtIdentity(qtPrefix, clone, expectedVersion) {
  directory(qtPrefix, 'Qt prefix');
  const prefix = fs.realpathSync(qtPrefix);
  const sdkFramework = path.join(prefix, 'lib', 'QtCore.framework');
  const runtimeFramework = path.join(clone.appPath, 'Contents', 'Frameworks', 'QtCore.framework');
  const sdkVersion = plistValue(path.join(sdkFramework, 'Resources', 'Info.plist'), 'CFBundleVersion');
  const runtimeVersion = plistValue(path.join(runtimeFramework, 'Resources', 'Info.plist'), 'CFBundleVersion');
  if (sdkVersion !== expectedVersion || runtimeVersion !== expectedVersion) {
    fail(`Qt ${expectedVersion} required, got SDK ${sdkVersion || '<missing>'} / runtime ${runtimeVersion || '<missing>'}`);
  }
  return {
    expectedVersion,
    sdk: {
      prefix,
      version: sdkVersion,
      core: binaryIdentity(path.join(sdkFramework, 'Versions', 'A', 'QtCore')),
    },
    runtime: {
      version: runtimeVersion,
      core: binaryIdentity(path.join(runtimeFramework, 'Versions', 'A', 'QtCore')),
    },
  };
}
function repositoryIdentity(repo) {
  const expectedRoot = path.join(repo, 'tools', 'macos-acceptance');
  directory(expectedRoot, 'Repository acceptance module');
  if (fs.realpathSync(expectedRoot) !== fs.realpathSync(ROOT)) {
    fail(`--repo must own this acceptance producer: ${repo}`);
  }
  return {
    root: repo,
    head: exec('/usr/bin/git', ['-C', repo, 'rev-parse', 'HEAD']),
    worktreeStatus: exec('/usr/bin/git', [
      '-C', repo, 'status', '--short', '--untracked-files=all',
    ]).split('\n').filter(Boolean),
  };
}
function resolveClone(input, expectedVersion, expectedExecutableSha256) {
  const appPath = path.resolve(input);
  const stat = fs.lstatSync(appPath);
  if (!stat.isDirectory() || stat.isSymbolicLink() || path.extname(appPath) !== '.app' ||
      fs.realpathSync(appPath) !== appPath || appPath === '/Applications/Cavalry.app' ||
      appPath.startsWith('/Applications/')) {
    fail(`Fresh non-symlink disposable .app outside /Applications required: ${appPath}`);
  }
  const sentinel = path.join(path.dirname(appPath), '.cavalry-i18n-disposable-live-target');
  regular(sentinel);
  const executable = path.join(appPath, 'Contents', 'MacOS', 'Cavalry');
  regular(executable);
  fs.accessSync(executable, fs.constants.X_OK);
  strictChild(appPath, fs.realpathSync(executable), 'Clone executable');
  const version = exec('/usr/libexec/PlistBuddy', [
    '-c', 'Print :CFBundleShortVersionString', path.join(appPath, 'Contents', 'Info.plist'),
  ]);
  if (version !== expectedVersion) fail(`Cavalry ${expectedVersion} required, got ${version}`);
  const executableIdentity = binaryIdentity(executable);
  if (executableIdentity.sha256 !== expectedExecutableSha256) {
    fail(`Disposable clone executable does not match --expected-executable-sha256: ${executable}`);
  }
  return { appPath, executable, executableIdentity, sentinel, version };
}
function claimClone(clone, token) {
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(token)) fail('Unsafe session token');
  const lock = path.join(path.dirname(clone.appPath), '.acceptance-v2-lock');
  fs.mkdirSync(lock);
  const marker = path.join(lock, 'owner.json');
  writeExclusive(marker, { token, pid: process.pid, appPath: clone.appPath });
  return () => {
    fs.unlinkSync(marker);
    fs.rmdirSync(lock);
  };
}
function atomicStage(source, destination, cloneRoot) {
  regular(destination);
  const canonicalDestination = strictRealChild(cloneRoot, destination, 'Guide destination');
  const destinationStat = regular(canonicalDestination);
  const temporary = `${canonicalDestination}.acceptance-v2-${process.pid}-${crypto.randomUUID()}`;
  fs.copyFileSync(source, temporary, fs.constants.COPYFILE_EXCL);
  fs.chmodSync(temporary, destinationStat.mode & 0o777);
  fs.renameSync(temporary, canonicalDestination);
  const staged = identity(canonicalDestination);
  const sourceIdentity = identity(source);
  if (staged.sha256 !== sourceIdentity.sha256 || staged.bytes !== sourceIdentity.bytes) {
    fail(`Guide staging drifted: ${canonicalDestination}`);
  }
  return staged;
}
function stageGuideAssets({ session, clone, language, runtimeQtCore }) {
  const files = GUIDE_FILES.map(([sourceRelative, destinationRelative]) => {
    const source = path.join(session, 'source-snapshot', 'repo', 'languages', language, sourceRelative);
    const destination = path.join(clone.appPath, 'Contents', 'assets', destinationRelative);
    return { source: identity(source), destination: atomicStage(source, destination, clone.appPath) };
  });
  exec('/usr/bin/codesign', ['--force', '--deep', '--sign', '-', clone.appPath]);
  exec('/usr/bin/codesign', ['--verify', '--deep', '--strict', clone.appPath]);
  return {
    language, files,
    executable: binaryIdentity(clone.executable),
    runtimeQtCore: binaryIdentity(runtimeQtCore),
  };
}

function prepareTools({ session, clone, qtPrefix }) {
  const bin = path.join(session, 'bin');
  fs.mkdirSync(bin);
  const frozenBuild = path.join(session, 'source-snapshot', 'acceptance', 'build_acceptance_v2.sh');
  const frozenRepo = path.join(session, 'source-snapshot', 'repo');
  const buildRepo = path.join(session, 'build-source');
  fs.cpSync(frozenRepo, buildRepo, { recursive: true, errorOnExist: true });
  const paths = {
    injector: path.join(bin, 'libCavalryTranslatorInjector.dylib'),
    main: path.join(bin, 'macos_main_acceptance_driver.dylib'),
    supplemental: path.join(bin, 'macos_supplemental_acceptance_driver.dylib'),
    exactWindow: path.join(bin, 'cgwindow_exact'),
  };
  exec('/bin/zsh', [
    frozenBuild, '--repo-root', frozenRepo,
    '--clone', clone.appPath, '--qt-prefix', qtPrefix, '--out', bin,
  ]);
  const productBuild = path.join(buildRepo, 'tools', 'build_translator_injector.sh');
  const regenerated = path.join(buildRepo, 'injector', 'generated_translations.inc');
  fs.chmodSync(regenerated, 0o644);
  exec('/bin/bash', [
    productBuild, paths.injector, path.join(clone.appPath, 'Contents', 'Frameworks'),
  ], { env: { ...process.env, CAVALRY_QT_PREFIX: qtPrefix } });
  const frozenGenerated = path.join(frozenRepo, 'injector', 'generated_translations.inc');
  if (sha256(regenerated) !== sha256(frozenGenerated)) {
    fail('Frozen TS projection does not match the checked-in generated translation table');
  }
  return {
    ...paths,
    identities: Object.fromEntries(Object.entries(paths).map(([key, value]) => [key, binaryIdentity(value)])),
    buildEvidence: {
      acceptanceScript: identity(frozenBuild),
      productScript: identity(productBuild),
      regeneratedTable: freezeIdentity(regenerated),
    },
  };
}

function processAlive(pid) {
  const result = cp.spawnSync('/bin/ps', ['-p', String(pid), '-o', 'state='], { encoding: 'utf8' });
  return result.status === 0 && result.stdout.trim() && !result.stdout.trim().startsWith('Z');
}
function processIdentity(pid, executable) {
  const start = exec('/bin/ps', ['-p', String(pid), '-o', 'lstart=']);
  const names = exec('/usr/sbin/lsof', ['-a', '-p', String(pid), '-d', 'txt', '-Fn'])
    .split('\n').filter((line) => line.startsWith('n')).map((line) => line.slice(1));
  const expected = fs.realpathSync(executable);
  if (!names.some((name) => fs.existsSync(name) && fs.realpathSync(name) === expected)) {
    fail(`Exact child executable mismatch pid=${pid}`);
  }
  return { pid, startToken: start.trim(), executable: binaryIdentity(executable) };
}
function sameArtifact(actual, expected) {
  return Boolean(actual && expected && actual.sha256 === expected.sha256 && actual.bytes === expected.bytes);
}
function sameProcess(actual, expected) {
  return Boolean(
    actual && expected &&
    actual.pid === expected.pid &&
    actual.startToken === expected.startToken &&
    sameArtifact(actual.executable, expected.executable)
  );
}
function loadedImage(pid, expected) {
  const real = fs.realpathSync(expected);
  const names = exec('/usr/sbin/lsof', ['-a', '-p', String(pid), '-Fn'])
    .split('\n').filter((line) => line.startsWith('n')).map((line) => line.slice(1));
  if (!names.some((name) => fs.existsSync(name) && fs.realpathSync(name) === real)) {
    fail(`Expected image not loaded by pid=${pid}: ${real}`);
  }
  return binaryIdentity(expected);
}
function terminateExact(pid, executable, expected) {
  const before = processIdentity(pid, executable);
  if (!sameProcess(before, expected)) fail(`Exact child ownership drifted pid=${pid}`);
  process.kill(pid, 'SIGTERM');
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (!processAlive(pid)) return { beforeTerminate: before, exactChildCleaned: true };
    try {
      if (!sameProcess(processIdentity(pid, executable), expected)) {
        return { beforeTerminate: before, exactChildCleaned: true, pidOwnershipLost: true };
      }
    } catch {
      if (!processAlive(pid)) return { beforeTerminate: before, exactChildCleaned: true };
    }
    sleep(50);
  }
  const final = processIdentity(pid, executable);
  if (!sameProcess(final, expected)) {
    return { beforeTerminate: before, exactChildCleaned: true, pidOwnershipLost: true };
  }
  process.kill(pid, 'SIGKILL');
  fail(`Exact child ignored SIGTERM pid=${pid}`);
}

function validateBounds(bounds, label) {
  if (!bounds || !['x', 'y', 'width', 'height'].every((key) => Number.isInteger(bounds[key])) ||
      bounds.width < 1 || bounds.height < 1) fail(`Invalid ${label} bounds`);
}
function captureReady({ readyFile, run, helper, owner }) {
  const ready = readJsonComplete(readyFile, 'Capture ready');
  if (ready.schema !== 'cavalry-i18n.acceptance-v2.capture-ready/v1' ||
      ready.runUuid !== run.uuid || ready.language !== run.language ||
      ready.scenario !== run.scenario || ready.pid !== run.pid ||
      !Number.isInteger(ready.sequence) || !ready.surface || !ready.result) {
    fail(`Capture-ready identity mismatch: ${readyFile}`);
  }
  if (!isDeepStrictEqual(ready.target, ready.result.target)) {
    fail(`Ready target/result mismatch: ${ready.surface}`);
  }
  validateBounds(ready.target?.childBounds, 'child');
  validateBounds(ready.target?.windowBounds, 'window');
  if (!Number.isInteger(ready.target.nativeWindowNumber) || ready.target.nativeWindowNumber <= 0) {
    fail(`Missing native window identity: ${ready.surface}`);
  }
  const prefix = path.basename(readyFile, '.ready.json');
  const expectedReady = path.join(run.captureDir, `${prefix}.ready.json`);
  if (readyFile !== expectedReady || ready.result.readyPath !== readyFile) {
    fail(`Ready path escaped capture directory: ${ready.surface}`);
  }
  const transientTooltip =
    ready.surface === 'add-layer-tooltip' &&
    ready.target.widgetClass === 'QTipLabel' &&
    ready.target.objectName === 'qtooltip_label' &&
    ready.target.childIsTopLevel === true &&
    ready.target.windowTitle === '';
  const mapped = transientTooltip
    ? {
        window: ready.target.nativeWindowNumber,
        pid: run.pid,
        owner,
        surface: ready.surface,
        bounds: ready.target.windowBounds,
        mapping: 'driver-native-transient',
      }
    : JSON.parse(exec(helper, [
        String(run.pid), owner, ready.surface, String(ready.target.nativeWindowNumber),
      ]));
  if (mapped.window !== ready.target.nativeWindowNumber || mapped.pid !== run.pid || mapped.owner !== owner) {
    fail(`Native window mapping drifted: ${ready.surface}`);
  }
  const osPngPath = path.join(run.captureDir, `${prefix}-window-os.png`);
  captureExactWindow(mapped.window, osPngPath);
  fs.chmodSync(osPngPath, 0o444);
  const osPng = validatePng(osPngPath);
  const readyIdentity = freezeIdentity(readyFile);
  const ackPath = path.join(run.captureDir, `${prefix}.ack.json`);
  const ack = writeExclusive(ackPath, {
    schema: 'cavalry-i18n.acceptance-v2.capture-ack/v1',
    status: 'CAPTURED', runUuid: run.uuid, pid: run.pid,
    sequence: ready.sequence, surface: ready.surface, ready: readyIdentity, mapped, osPng,
  });
  return { ready, readyIdentity, ack, mapped, osPng };
}
function assertDone(done, run) {
  if (done.schema !== 'cavalry-i18n.acceptance-v2.done/v2' || done.status !== 'OK' ||
      done.runUuid !== run.uuid || done.language !== run.language ||
      done.scenario !== run.scenario || done.pid !== run.pid || !Array.isArray(done.surfaceResults)) {
    fail(`Done identity/status mismatch ${run.language}/${run.scenario}`);
  }
  const surfaces = done.surfaceResults.map((item) => item.surface);
  if (!isDeepStrictEqual(surfaces, EXPECTED_SURFACES[run.scenario])) {
    fail(`Logical surface mismatch ${run.language}/${run.scenario}`);
  }
  for (const result of done.surfaceResults) {
    validateBounds(result.target?.childBounds, `${result.surface} child`);
    validateBounds(result.target?.windowBounds, `${result.surface} window`);
    const variants = result.variants || [];
    if ((run.scenario === 'replace' && variants.length !== 2) ||
        (run.scenario !== 'replace' && variants.length)) fail(`Invalid variant count: ${result.surface}`);
    const witnessed = variants.length ? variants : [result];
    for (const item of witnessed) {
      if (!item.text || !item.ownerClass || !Number.isInteger(item.target?.nativeWindowNumber)) {
        fail(`Incomplete semantic witness: ${run.language}/${result.surface}`);
      }
      if (MAIN_SCENARIOS.has(run.scenario) && item.ownerExternalUnchanged !== true) {
        fail(`Missing owner-external negative: ${run.language}/${result.surface}`);
      }
    }
    if (run.scenario === 'onboarding' &&
        (result.catalogSlot !== 'en' || !result.body || !Array.isArray(result.buttons))) {
      fail(`Incomplete onboarding oracle: ${result.surface}`);
    }
    if (run.scenario === 'transform' &&
        (result.callerBoundaryVerified !== true || result.expectedTranslations?.length !== 5)) {
      fail('Incomplete Transform oracle/boundary');
    }
  }
  return done;
}
function linkLogicalCaptures(surfaceResults, captures, run) {
  const bySequence = new Map(captures.map((capture) => [capture.ready.sequence, capture]));
  const used = new Set();
  return surfaceResults.map((result) => {
    const variants = result.variants?.length ? result.variants : [result];
    const evidence = variants.map((variant) => {
      const capture = bySequence.get(variant.sequence);
      const logicalSurface = variant.logicalSurface || variant.surface;
      if (!capture || used.has(variant.sequence) || logicalSurface !== result.surface ||
          capture.ready.surface !== variant.surface || !isDeepStrictEqual(capture.ready.result, variant)) {
        fail(`Logical/capture semantic mismatch ${run.language}/${result.surface}`);
      }
      used.add(variant.sequence);
      return { surface: capture.ready.surface, sequence: variant.sequence, screenshot: capture.osPng };
    });
    return { surface: result.surface, evidence };
  });
}

function runScenario(context) {
  const { language, scenario, session, executable, injector, runtimeQtCore, tools, owner, stage } = context;
  const runDir = path.join(session, 'runs', language, scenario);
  const captureDir = path.join(runDir, 'captures');
  const home = path.join(runDir, 'home');
  const temporary = path.join(home, 'tmp');
  fs.mkdirSync(captureDir, { recursive: true });
  fs.mkdirSync(temporary, { recursive: true });
  const donePath = path.join(runDir, 'done.json');
  const driverLog = path.join(runDir, 'driver.log');
  const processLog = path.join(runDir, 'process.log');
  const stageRecord = JSON.parse(fs.readFileSync(stage.path, 'utf8'));
  const uuid = crypto.randomUUID();
  const driver = MAIN_SCENARIOS.has(scenario) ? tools.main : tools.supplemental;
  const env = {
    ...process.env,
    HOME: home, TMPDIR: temporary, CAVALRY_I18N_PROFILE_DIR: home,
    CAVALRY_I18N_RUN_UUID: uuid, CAVALRY_I18N_LANG: language,
    CAVALRY_I18N_ACCEPTANCE_SCENARIO: scenario,
    CAVALRY_I18N_SUPPLEMENTAL_SCENARIO: scenario,
    CAVALRY_I18N_ACCEPTANCE_DONE: donePath,
    CAVALRY_I18N_SUPPLEMENTAL_DONE: donePath,
    CAVALRY_I18N_ACCEPTANCE_LOG: driverLog,
    CAVALRY_I18N_SUPPLEMENTAL_LOG: driverLog,
    CAVALRY_I18N_CAPTURE_DIR: captureDir,
    CAVALRY_I18N_FIXTURE_REPLACE: context.fixtures.replacePng,
    CAVALRY_I18N_FIXTURE_DYNAMIC: context.fixtures.dynamicPng,
    CAVALRY_I18N_TRACKING_FIXTURE: context.fixtures.trackingMp4,
    DYLD_INSERT_LIBRARIES: `${injector}:${driver}`,
  };
  const logFd = fs.openSync(processLog, 'wx', 0o600);
  const child = cp.spawn(executable, [], { env, stdio: ['ignore', logFd, logFd] });
  fs.closeSync(logFd);
  const run = { uuid, language, scenario, pid: child.pid, captureDir };
  let initial;
  const captures = [];
  const seen = new Set();
  let done;
  try {
    for (let attempt = 0; attempt < 1200; attempt += 1) {
      if (!initial && processAlive(child.pid)) {
        try {
          initial = processIdentity(child.pid, executable);
        } catch (error) {
          if (attempt > 100) throw error;
        }
      }
      for (const name of fs.readdirSync(captureDir).filter((item) => item.endsWith('.ready.json')).sort()) {
        if (seen.has(name)) continue;
        captures.push(captureReady({
          readyFile: path.join(captureDir, name), run, helper: tools.exactWindow, owner,
        }));
        seen.add(name);
      }
      if (fs.existsSync(donePath) && fs.statSync(donePath).size > 0) {
        done = assertDone(readJsonComplete(donePath, 'Scenario done'), run);
        break;
      }
      if (!processAlive(child.pid)) fail(`Child exited before done: ${language}/${scenario}`);
      sleep(50);
    }
    if (!initial || !done) fail(`Bounded scenario timeout: ${language}/${scenario}`);
    if (!sameArtifact(initial.executable, stageRecord.executable)) {
      fail(`Launched executable drifted from language stage: ${language}/${scenario}`);
    }
    if (captures.length !== EXPECTED_CAPTURES[scenario]) {
      fail(`Capture count mismatch ${language}/${scenario}: ${captures.length}`);
    }
    const pointEvidence = linkLogicalCaptures(done.surfaceResults, captures, run);
    if (pointEvidence.flatMap((point) => point.evidence).length !== captures.length) {
      fail(`Unbound capture evidence ${language}/${scenario}`);
    }
    const injectorLoaded = loadedImage(child.pid, injector);
    const driverLoaded = loadedImage(child.pid, driver);
    const runtimeQtLoaded = loadedImage(child.pid, runtimeQtCore);
    if (!sameArtifact(runtimeQtLoaded, stageRecord.runtimeQtCore)) {
      fail(`Loaded Qt runtime drifted from language stage: ${language}/${scenario}`);
    }
    const cleanup = terminateExact(child.pid, executable, initial);
    const manifest = {
      schema: 'cavalry-i18n.acceptance-v2.run/v4',
      uuid, language, scenario, stage, initial, injectorLoaded, driverLoaded, runtimeQtLoaded,
      done: freezeIdentity(donePath),
      driverLog: freezeIdentity(driverLog),
      processLog: freezeIdentity(processLog),
      captures, logicalSurfaces: done.surfaceResults, pointEvidence, cleanup,
    };
    const manifestPath = path.join(runDir, 'manifest.json');
    const manifestIdentity = writeExclusive(manifestPath, manifest);
    return { manifestPath, manifest: manifestIdentity, language, scenario, logicalSurfaces: done.surfaceResults, pointEvidence };
  } catch (error) {
    try {
      if (initial && processAlive(child.pid) &&
          sameProcess(processIdentity(child.pid, executable), initial)) {
        process.kill(child.pid, 'SIGKILL');
      }
    } catch {}
    throw error;
  }
}

function verifyRunManifest(manifestIdentity) {
  verifyIdentity(manifestIdentity, 'Run manifest');
  const manifest = JSON.parse(fs.readFileSync(manifestIdentity.path, 'utf8'));
  verifyIdentity(manifest.done, 'Run done');
  verifyIdentity(manifest.driverLog, 'Driver log');
  verifyIdentity(manifest.processLog, 'Process log');
  verifyIdentity(manifest.stage, 'Language stage');
  const stage = JSON.parse(fs.readFileSync(manifest.stage.path, 'utf8'));
  if (!sameArtifact(manifest.initial?.executable, stage.executable) ||
      !sameArtifact(manifest.runtimeQtLoaded, stage.runtimeQtCore)) {
    fail(`Run/stage executable or Qt identity mismatch: ${manifest.language}/${manifest.scenario}`);
  }
  for (const capture of manifest.captures) {
    verifyIdentity(capture.readyIdentity, 'Capture ready');
    verifyIdentity(capture.ack, 'Capture ack');
    verifyIdentity(capture.osPng, 'OS screenshot');
  }
}

function runMatrix() {
  const repoInput = requirePath('repo');
  directory(repoInput, 'Repository');
  const repo = fs.realpathSync(repoInput);
  const repository = repositoryIdentity(repo);
  const target = targetContract(repo);
  const expectedExecutableSha256 = requireSha256('expected-executable-sha256');
  const clone = resolveClone(
    requirePath('clone'), target.cavalryVersion, expectedExecutableSha256,
  );
  const qtPrefix = fs.realpathSync(requirePath('qt-prefix'));
  const qt = qtIdentity(qtPrefix, clone, target.qtVersion);
  const session = resolveNewSession(requirePath('session-dir'), [repo, clone.appPath]);
  const owner = ARGS.owner && ARGS.owner !== true ? String(ARGS.owner) : 'Cavalry';
  fs.mkdirSync(session, { recursive: false, mode: 0o700 });
  const release = claimClone(clone, path.basename(session));
  try {
    const originalCloneExecutable = clone.executableIdentity;
    const sources = freezeSources(repo, session);
    const tools = prepareTools({ session, clone, qtPrefix });
    verifyIdentity(qt.sdk.core, 'Qt SDK core');
    verifyIdentity(qt.runtime.core, 'Initial Qt runtime core');
    assertSourcesUnchanged(sources);
    const fixturesDir = path.join(session, 'fixtures');
    const fixtures = {
      replacePng: path.join(fixturesDir, 'replace-source.png'),
      dynamicPng: path.join(fixturesDir, 'dynamic-proof-two.png'),
      trackingMp4: path.join(fixturesDir, 'replace-source.mp4'),
    };
    copyExclusive(path.join(ROOT, 'fixtures', 'replace-source.png'), fixtures.replacePng);
    copyExclusive(path.join(ROOT, 'fixtures', 'dynamic-proof-two.png'), fixtures.dynamicPng);
    copyExclusive(path.join(ROOT, 'fixtures', 'replace-source.mp4'), fixtures.trackingMp4);
    const fixtureEvidence = [
      validatePng(fixtures.replacePng), validatePng(fixtures.dynamicPng), validateMp4(fixtures.trackingMp4),
    ];
    const runs = [];
    const stages = [];
    const runtimeQtCore = qt.runtime.core.path;
    for (const language of LANGUAGES) {
      const stage = stageGuideAssets({ session, clone, language, runtimeQtCore });
      const stagePath = path.join(session, 'language-stage', `${language}.json`);
      const stageIdentity = writeExclusive(stagePath, stage);
      stages.push(stageIdentity);
      for (const scenario of SCENARIOS) {
        runs.push(runScenario({
          language, scenario, session, executable: clone.executable,
          injector: tools.injector, runtimeQtCore, tools, owner, fixtures, stage: stageIdentity,
        }));
      }
    }
    assertSourcesUnchanged(sources);
    const points = runs.flatMap((run) => run.logicalSurfaces.map((surface) => ({
      key: `${run.language}/${surface.surface}`,
      language: run.language, surface: surface.surface, runManifest: run.manifest,
      target: surface.target, variants: surface.variants || [],
      evidence: run.pointEvidence.find((item) => item.surface === surface.surface)?.evidence || [],
    })));
    const keys = points.map((point) => point.key);
    if (points.length !== 48 || new Set(keys).size !== 48) fail(`48 unique logical points required, got ${points.length}`);
    verifyIdentity(qt.sdk.core, 'Qt SDK core');
    const finalExecutable = binaryIdentity(clone.executable);
    const finalRuntimeCore = binaryIdentity(runtimeQtCore);
    const finalStage = JSON.parse(fs.readFileSync(stages.at(-1).path, 'utf8'));
    if (!sameArtifact(finalExecutable, finalStage.executable) ||
        !sameArtifact(finalRuntimeCore, finalStage.runtimeQtCore)) fail('Final clone identity drifted');
    const record = {
      schema: 'cavalry-i18n.acceptance-v2.matrix/v5',
      status: 'MACHINE-COMPLETE-MANUAL-PENDING', createdAtUtc: new Date().toISOString(),
      repository, target, qt: { ...qt, finalRuntimeCore },
      clone: {
        appPath: clone.appPath, version: clone.version,
        expectedExecutableSha256, originalExecutable: originalCloneExecutable,
        finalExecutable,
      },
      productInjector: tools.identities.injector, tools: tools.identities,
      buildEvidence: tools.buildEvidence, sources, fixtureEvidence, stages,
      runs: runs.map(({ logicalSurfaces, pointEvidence, ...run }) => run), points,
    };
    const recordPath = path.join(session, 'matrix-machine-record.json');
    const recordIdentity = writeExclusive(recordPath, record);
    console.log(JSON.stringify({ status: record.status, record: recordIdentity, points: points.length }, null, 2));
  } finally {
    release();
  }
}

function sealReview() {
  const sessionInput = requirePath('session-dir');
  directory(sessionInput, 'Session');
  const session = fs.realpathSync(sessionInput);
  const reviewInput = requirePath('review');
  regular(reviewInput);
  const reviewPath = strictRealChild(session, reviewInput, 'Manual review');
  const machineInput = path.join(session, 'matrix-machine-record.json');
  regular(machineInput);
  const machinePath = strictRealChild(session, machineInput, 'Machine record');
  const machine = JSON.parse(fs.readFileSync(machinePath, 'utf8'));
  const review = JSON.parse(fs.readFileSync(reviewPath, 'utf8'));
  if (machine.schema !== 'cavalry-i18n.acceptance-v2.matrix/v5' ||
      machine.status !== 'MACHINE-COMPLETE-MANUAL-PENDING' ||
      review.schema !== 'cavalry-i18n.acceptance-v2.manual-review/v1' || !Array.isArray(review.points)) {
    fail('Machine/manual review schema mismatch');
  }
  for (const source of machine.sources) verifyIdentity(source.frozen, 'Frozen source');
  for (const tool of Object.values(machine.tools)) verifyIdentity(tool, 'Built tool');
  for (const evidence of Object.values(machine.buildEvidence)) verifyIdentity(evidence, 'Build evidence');
  verifyIdentity(machine.qt.sdk.core, 'Qt SDK core');
  verifyIdentity(machine.qt.finalRuntimeCore, 'Final Qt runtime core');
  verifyIdentity(machine.clone.finalExecutable, 'Final clone executable');
  for (const stage of machine.stages) verifyIdentity(stage, 'Language stage');
  for (const run of machine.runs) verifyRunManifest(run.manifest);
  const expected = new Map(machine.points.map((point) => [point.key, point]));
  const seen = new Set();
  for (const point of review.points) {
    if (!expected.has(point.key) || seen.has(point.key) || point.status !== 'APPROVED' || !Array.isArray(point.screenshots)) {
      fail(`Invalid manual review point: ${point.key || '<missing>'}`);
    }
    const expectedScreenshots = expected.get(point.key).evidence.map((item) => item.screenshot);
    const expectedByPath = new Map(expectedScreenshots.map((item) => [item.path, item]));
    if (point.screenshots.length !== expectedScreenshots.length ||
        new Set(point.screenshots.map((item) => item.path)).size !== expectedScreenshots.length) {
      fail(`Manual review must bind every OS capture for: ${point.key}`);
    }
    for (const screenshot of point.screenshots) {
      const frozen = expectedByPath.get(screenshot.path);
      const current = identity(screenshot.path);
      if (!frozen || current.sha256 !== frozen.sha256 || current.bytes !== frozen.bytes ||
          current.sha256 !== screenshot.sha256 || current.bytes !== screenshot.bytes) {
        fail(`Reviewed screenshot drifted: ${screenshot.path}`);
      }
    }
    seen.add(point.key);
  }
  if (seen.size !== 48) fail(`Manual review requires 48 approved points, got ${seen.size}`);
  const reviewIdentity = freezeIdentity(reviewPath);
  const finalPath = path.join(session, 'matrix-final-record.json');
  const finalIdentity = writeExclusive(finalPath, {
    schema: 'cavalry-i18n.acceptance-v2.final/v1', status: 'PASS-48-OF-48',
    sealedAtUtc: new Date().toISOString(), machine: identity(machinePath),
    review: reviewIdentity, points: [...seen].sort(),
  });
  console.log(JSON.stringify({ status: 'PASS-48-OF-48', record: finalIdentity }, null, 2));
}

try {
  if (ARGS.matrix) runMatrix();
  else if (ARGS['seal-review']) sealReview();
  else {
    const fixtures = [
      validatePng(path.join(ROOT, 'fixtures', 'replace-source.png')),
      validatePng(path.join(ROOT, 'fixtures', 'dynamic-proof-two.png')),
      validateMp4(path.join(ROOT, 'fixtures', 'replace-source.mp4')),
    ];
    console.log(JSON.stringify({ status: 'STATIC-INPUTS-OK', fixtures }, null, 2));
  }
} catch (error) {
  console.error(`ACCEPTANCE-V2-FAIL: ${error.stack || error}`);
  process.exitCode = 1;
}
