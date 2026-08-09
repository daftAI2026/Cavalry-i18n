/**
 * [INPUT]: 依赖 macos-acceptance session 的 final/machine/manual JSON 与其引用的只读证据文件
 * [OUTPUT]: 对外提供真实 21-run/48-point session 的 fail-closed 复验、无本机路径摘要与 evidence 结构校验
 * [POS]: release evidence 的共享信任边界；生成器与 tag/release 校验器不得各自发明 PASS 语义
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const zlib = require('node:zlib');
const { spawnSync } = require('node:child_process');
const { isDeepStrictEqual } = require('node:util');
const { GUIDE_FILES, sourceEntries } = require('./macos-acceptance/source_contract');

const LANGUAGES = Object.freeze(['zh-Hans', 'zh-Hant', 'ja_JP']);
const SCENARIOS = Object.freeze([
  'search', 'add-tag', 'save', 'replace', 'tracking', 'onboarding', 'transform',
]);
const SURFACES_BY_SCENARIO = Object.freeze({
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
const MAIN_SCENARIOS = new Set(['search', 'add-tag', 'save', 'replace', 'tracking']);
const SURFACES = Object.freeze(Object.values(SURFACES_BY_SCENARIO).flat());
const EXPECTED_KEYS = Object.freeze(
  LANGUAGES.flatMap((language) => SURFACES.map((surface) => `${language}/${surface}`)).sort()
);

function fail(message) {
  throw new Error(message);
}

function sha256Buffer(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function sha256File(file) {
  return sha256Buffer(fs.readFileSync(file));
}

function assertHex(value, field, length) {
  const pattern = new RegExp(`^[a-f0-9]{${length}}$`);
  if (typeof value !== 'string' || !pattern.test(value)) {
    fail(`${field} must be a lowercase ${length}-character hex value.`);
  }
}

function assertString(value, field) {
  if (typeof value !== 'string' || value.length === 0) {
    fail(`${field} must be a non-empty string.`);
  }
}

function assertExactKeys(value, expected, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail(`${field} must be an object.`);
  }
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (JSON.stringify(actual) !== JSON.stringify(wanted)) {
    fail(`${field} keys mismatch: expected ${wanted.join(', ')}, got ${actual.join(', ')}.`);
  }
}

function regularNoSymlink(file, root, label) {
  const absolute = path.resolve(file);
  const stat = fs.lstatSync(absolute);
  if (!stat.isFile() || stat.isSymbolicLink()) {
    fail(`${label} must be a regular non-symlink file: ${absolute}`);
  }
  const real = fs.realpathSync(absolute);
  if (real !== absolute) {
    fail(`${label} path must not traverse symlinks: ${absolute}`);
  }
  if (root) {
    const relative = path.relative(root, real);
    if (!relative || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
      fail(`${label} must stay inside the acceptance session: ${absolute}`);
    }
  }
  return stat;
}

function resolveSession(sessionInput) {
  const absolute = path.resolve(sessionInput);
  const stat = fs.lstatSync(absolute);
  if (!stat.isDirectory() || stat.isSymbolicLink() || fs.realpathSync(absolute) !== absolute) {
    fail(`Acceptance session must be a canonical non-symlink directory: ${absolute}`);
  }
  const sessionId = path.basename(absolute);
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(sessionId)) {
    fail(`Acceptance session id is unsafe: ${sessionId}`);
  }
  return { root: absolute, sessionId };
}

function parseJson(file, root, label) {
  regularNoSymlink(file, root, label);
  let value;
  try {
    value = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    fail(`${label} is not valid JSON: ${error.message}`);
  }
  return value;
}

function assertIdentityShape(record, field) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    fail(`${field} must be an identity object.`);
  }
  assertString(record.path, `${field}.path`);
  if (!Number.isInteger(record.bytes) || record.bytes < 1) {
    fail(`${field}.bytes must be a positive integer.`);
  }
  assertHex(record.sha256, `${field}.sha256`, 64);
}

function verifyIdentity(record, sessionRoot, field, expectedPath = null) {
  assertIdentityShape(record, field);
  const resolved = path.resolve(record.path);
  if (expectedPath && resolved !== path.resolve(expectedPath)) {
    fail(`${field}.path must be ${path.resolve(expectedPath)}, got ${resolved}.`);
  }
  const stat = regularNoSymlink(resolved, sessionRoot, field);
  if (stat.size !== record.bytes) {
    fail(`${field} byte length drifted: expected ${record.bytes}, got ${stat.size}.`);
  }
  const digest = sha256File(resolved);
  if (digest !== record.sha256) {
    fail(`${field} SHA-256 drifted: expected ${record.sha256}, got ${digest}.`);
  }
  return { path: resolved, bytes: stat.size, sha256: digest };
}

function sameIdentity(left, right) {
  return Boolean(
    left && right && path.resolve(left.path) === path.resolve(right.path) &&
      left.bytes === right.bytes && left.sha256 === right.sha256
  );
}

function sameArtifactBytes(left, right) {
  return Boolean(
    left && right && left.bytes === right.bytes && left.sha256 === right.sha256
  );
}

function sameProcess(left, right) {
  return Boolean(
    left && right && left.pid === right.pid && left.startToken === right.startToken &&
      sameIdentity(left.executable, right.executable)
  );
}

function recordedIdentityAtPath(record, expectedPath, field) {
  assertIdentityShape(record, field);
  const resolved = path.resolve(record.path);
  if (resolved !== path.resolve(expectedPath)) {
    fail(`${field}.path must be ${path.resolve(expectedPath)}, got ${resolved}.`);
  }
  return { path: resolved, bytes: record.bytes, sha256: record.sha256 };
}

function validateBounds(bounds, field) {
  if (
    !bounds || !['x', 'y', 'width', 'height'].every((key) => Number.isInteger(bounds[key])) ||
    bounds.width < 1 || bounds.height < 1
  ) {
    fail(`${field} must contain positive integer window bounds.`);
  }
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

function decodePng(file, field) {
  const data = fs.readFileSync(file);
  if (data.length < 45 || data.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') {
    fail(`${field} is not a PNG image.`);
  }
  let offset = 8;
  let ihdr = null;
  let sawIend = false;
  const idat = [];
  while (offset + 12 <= data.length) {
    const length = data.readUInt32BE(offset);
    const end = offset + 12 + length;
    if (end > data.length) fail(`${field} has a truncated PNG chunk.`);
    const type = data.subarray(offset + 4, offset + 8).toString('ascii');
    const payload = data.subarray(offset + 8, offset + 8 + length);
    const expectedCrc = data.readUInt32BE(offset + 8 + length);
    const actualCrc = crc32(data.subarray(offset + 4, offset + 8 + length));
    if (actualCrc !== expectedCrc) fail(`${field} has an invalid PNG chunk checksum.`);
    if (type === 'IHDR') {
      if (ihdr || length !== 13) fail(`${field} has an invalid PNG IHDR.`);
      ihdr = {
        width: payload.readUInt32BE(0),
        height: payload.readUInt32BE(4),
        bitDepth: payload[8],
        colorType: payload[9],
        compression: payload[10],
        filter: payload[11],
        interlace: payload[12],
      };
    } else if (type === 'IDAT') {
      idat.push(payload);
    } else if (type === 'IEND') {
      if (length !== 0) fail(`${field} has an invalid PNG IEND.`);
      sawIend = true;
      offset = end;
      break;
    }
    offset = end;
  }
  if (!ihdr || !sawIend || offset !== data.length || idat.length === 0) {
    fail(`${field} is not a complete PNG image.`);
  }
  if (
    ihdr.width < 2 || ihdr.height < 2 || ihdr.compression !== 0 || ihdr.filter !== 0 ||
    ihdr.interlace !== 0
  ) {
    fail(`${field} has unsupported or empty PNG geometry/encoding.`);
  }
  const channels = new Map([[0, 1], [2, 3], [3, 1], [4, 2], [6, 4]]).get(ihdr.colorType);
  if (!channels || ![1, 2, 4, 8, 16].includes(ihdr.bitDepth)) {
    fail(`${field} has an unsupported PNG pixel format.`);
  }
  let pixels;
  try {
    pixels = zlib.inflateSync(Buffer.concat(idat));
  } catch (error) {
    fail(`${field} PNG pixel stream is not decodable: ${error.message}`);
  }
  const rowBytes = Math.ceil((ihdr.width * channels * ihdr.bitDepth) / 8);
  if (pixels.length !== ihdr.height * (rowBytes + 1)) {
    fail(`${field} PNG pixel stream length is inconsistent with IHDR.`);
  }
  for (let row = 0; row < ihdr.height; row += 1) {
    if (pixels[row * (rowBytes + 1)] > 4) fail(`${field} PNG contains an invalid row filter.`);
  }
  return { width: ihdr.width, height: ihdr.height };
}

function verifyPngIdentity(record, sessionRoot, field) {
  const verified = verifyIdentity(record, sessionRoot, field);
  const dimensions = decodePng(verified.path, field);
  if (record.width !== dimensions.width || record.height !== dimensions.height) {
    fail(`${field} recorded PNG dimensions do not match the decoded image.`);
  }
  return { ...verified, ...dimensions };
}

function verifyMp4Identity(record, sessionRoot, field) {
  const verified = verifyIdentity(record, sessionRoot, field);
  const data = fs.readFileSync(verified.path);
  if (
    data.length < 16 || data.subarray(4, 8).toString('ascii') !== 'ftyp' ||
    typeof record.duration !== 'number' || !(record.duration > 0)
  ) {
    fail(`${field} is not a non-empty recorded MP4 fixture.`);
  }
  return verified;
}

function gitFileAtCommit(repoRoot, commit, relativePath) {
  const result = spawnSync(
    'git', ['-C', repoRoot, 'show', `${commit}:${relativePath.split(path.sep).join('/')}`],
    { encoding: null, maxBuffer: 64 * 1024 * 1024 }
  );
  if (result.status !== 0) {
    fail(
      `Acceptance source is not a tracked blob at ${commit}: ${relativePath} ` +
      `(${String(result.stderr || '').trim() || 'git show failed'}).`
    );
  }
  return result.stdout;
}

function validateDoneRecord(done, manifest) {
  assertExactKeys(
    done,
    ['schema', 'status', 'runUuid', 'language', 'scenario', 'pid', 'surface', 'surfaceResults', 'reason', 'target'],
    'run.done'
  );
  if (
    done.schema !== 'cavalry-i18n.acceptance-v2.done/v2' || done.status !== 'OK' ||
    done.runUuid !== manifest.uuid || done.language !== manifest.language ||
    done.scenario !== manifest.scenario || done.pid !== manifest.initial?.pid ||
    typeof done.reason !== 'string' || !done.reason.startsWith('OK ') ||
    !Array.isArray(done.surfaceResults) ||
    !isDeepStrictEqual(
      done.surfaceResults.map((item) => item.surface),
      SURFACES_BY_SCENARIO[manifest.scenario]
    )
  ) {
    fail(`Run done record mismatch: ${manifest.language}/${manifest.scenario}.`);
  }
  const witnesses = new Map();
  for (const result of done.surfaceResults) {
    validateBounds(result.target?.childBounds, `${result.surface}.target.childBounds`);
    validateBounds(result.target?.windowBounds, `${result.surface}.target.windowBounds`);
    const variants = Array.isArray(result.variants) ? result.variants : [];
    if (
      (manifest.scenario === 'replace' && variants.length !== 2) ||
      (manifest.scenario !== 'replace' && variants.length !== 0)
    ) {
      fail(`Run done variant count mismatch: ${manifest.language}/${result.surface}.`);
    }
    const witnessed = variants.length > 0 ? variants : [result];
    for (const item of witnessed) {
      const logicalSurface = item.logicalSurface || item.surface;
      if (
        logicalSurface !== result.surface || typeof item.surface !== 'string' ||
        typeof item.text !== 'string' || item.text.length === 0 ||
        typeof item.ownerClass !== 'string' || item.ownerClass.length === 0 ||
        !Number.isInteger(item.sequence) || witnesses.has(item.sequence)
      ) {
        fail(`Incomplete or duplicate semantic witness: ${manifest.language}/${result.surface}.`);
      }
      validateBounds(item.target?.childBounds, `${item.surface}.target.childBounds`);
      validateBounds(item.target?.windowBounds, `${item.surface}.target.windowBounds`);
      if (!Number.isInteger(item.target.nativeWindowNumber) || item.target.nativeWindowNumber <= 0) {
        fail(`Semantic witness lacks a native window identity: ${item.surface}.`);
      }
      if (MAIN_SCENARIOS.has(manifest.scenario) && item.ownerExternalUnchanged !== true) {
        fail(`Semantic witness lacks the owner-external negative invariant: ${item.surface}.`);
      }
      witnesses.set(item.sequence, { item, logicalSurface: result.surface });
    }
    if (
      manifest.scenario === 'onboarding' &&
      (result.catalogSlot !== 'en' || typeof result.body !== 'string' || result.body.length === 0 ||
        !Array.isArray(result.buttons))
    ) {
      fail(`Onboarding semantic oracle is incomplete: ${result.surface}.`);
    }
    if (
      manifest.scenario === 'transform' &&
      (result.callerBoundaryVerified !== true || result.expectedTranslations?.length !== 5)
    ) {
      fail('Transform semantic caller-boundary oracle is incomplete.');
    }
  }
  const last = done.surfaceResults.at(-1);
  if (done.surface !== last.surface || !isDeepStrictEqual(done.target, last.target)) {
    fail(`Run done terminal surface/target mismatch: ${manifest.language}/${manifest.scenario}.`);
  }
  return witnesses;
}

function verifyRunManifest(run, sessionRoot, stagesByLanguage, machine) {
  const manifestIdentity = verifyIdentity(run.manifest, sessionRoot, 'run.manifest');
  const manifest = parseJson(manifestIdentity.path, sessionRoot, 'Run manifest');
  assertExactKeys(
    manifest,
    [
      'schema', 'uuid', 'language', 'scenario', 'stage', 'initial', 'injectorLoaded',
      'driverLoaded', 'runtimeQtLoaded', 'done', 'driverLog', 'processLog', 'captures',
      'logicalSurfaces', 'pointEvidence', 'cleanup',
    ],
    'run.manifest'
  );
  if (manifest.schema !== 'cavalry-i18n.acceptance-v2.run/v4') {
    fail(`Unexpected run manifest schema: ${manifest.schema}`);
  }
  if (!LANGUAGES.includes(manifest.language) || !SCENARIOS.includes(manifest.scenario)) {
    fail(`Unexpected run identity: ${manifest.language}/${manifest.scenario}`);
  }
  if (run.language !== manifest.language || run.scenario !== manifest.scenario) {
    fail(`Matrix/run manifest identity mismatch: ${run.language}/${run.scenario}.`);
  }
  if (
    typeof manifest.uuid !== 'string' || manifest.uuid.length < 1 ||
    !Number.isInteger(manifest.initial?.pid) || manifest.initial.pid <= 0 ||
    typeof manifest.initial?.startToken !== 'string' || manifest.initial.startToken.length < 1
  ) {
    fail(`Run process identity is incomplete: ${run.language}/${run.scenario}.`);
  }
  const expectedStage = stagesByLanguage.get(manifest.language);
  if (!expectedStage || !sameIdentity(expectedStage.identity, manifest.stage)) {
    fail(`Run is not bound to its exact language stage: ${run.language}/${run.scenario}.`);
  }
  const doneIdentity = verifyIdentity(manifest.done, sessionRoot, 'run.done');
  for (const [field, identity] of [
    ['driverLog', manifest.driverLog],
    ['processLog', manifest.processLog],
    ['stage', manifest.stage],
  ]) {
    verifyIdentity(identity, sessionRoot, `run.${field}`);
  }
  verifyIdentity(manifest.injectorLoaded, sessionRoot, 'run.injectorLoaded');
  verifyIdentity(manifest.driverLoaded, sessionRoot, 'run.driverLoaded');
  recordedIdentityAtPath(
    manifest.initial.executable,
    expectedStage.record.executable.path,
    'run.initial.executable'
  );
  recordedIdentityAtPath(
    manifest.runtimeQtLoaded,
    expectedStage.record.runtimeQtCore.path,
    'run.runtimeQtLoaded'
  );
  const expectedDriver = MAIN_SCENARIOS.has(manifest.scenario)
    ? machine.tools.main
    : machine.tools.supplemental;
  if (
    !sameIdentity(manifest.initial.executable, expectedStage.record.executable) ||
    !sameIdentity(manifest.injectorLoaded, machine.productInjector) ||
    !sameIdentity(manifest.driverLoaded, expectedDriver) ||
    !sameIdentity(manifest.runtimeQtLoaded, expectedStage.record.runtimeQtCore)
  ) {
    fail(`Run executable/runtime/injector/driver binding mismatch: ${run.language}/${run.scenario}.`);
  }
  if (
    !manifest.cleanup || manifest.cleanup.exactChildCleaned !== true ||
    !sameProcess(manifest.cleanup.beforeTerminate, manifest.initial) ||
    (Object.hasOwn(manifest.cleanup, 'pidOwnershipLost') && manifest.cleanup.pidOwnershipLost !== true) ||
    Object.keys(manifest.cleanup).some((key) =>
      !['beforeTerminate', 'exactChildCleaned', 'pidOwnershipLost'].includes(key)
    )
  ) {
    fail(`Run cleanup is not bound to the exact child process: ${run.language}/${run.scenario}.`);
  }
  const done = parseJson(doneIdentity.path, sessionRoot, 'Run done record');
  const witnesses = validateDoneRecord(done, manifest);
  if (!isDeepStrictEqual(manifest.logicalSurfaces, done.surfaceResults)) {
    fail(`Run logicalSurfaces does not match the validated done record: ${run.language}/${run.scenario}.`);
  }
  if (!Array.isArray(manifest.captures) || manifest.captures.length !== EXPECTED_CAPTURES[manifest.scenario]) {
    fail(`Run capture count mismatch: ${run.language}/${run.scenario}.`);
  }
  const screenshots = new Map();
  const capturesBySequence = new Map();
  for (const [index, capture] of manifest.captures.entries()) {
    assertExactKeys(capture, ['ready', 'readyIdentity', 'ack', 'mapped', 'osPng'], `run.captures[${index}]`);
    const readyIdentity = verifyIdentity(
      capture.readyIdentity, sessionRoot, `run.captures[${index}].readyIdentity`
    );
    const ackIdentity = verifyIdentity(capture.ack, sessionRoot, `run.captures[${index}].ack`);
    const screenshot = verifyPngIdentity(
      capture.osPng, sessionRoot, `run.captures[${index}].osPng`
    );
    const ready = parseJson(readyIdentity.path, sessionRoot, 'Capture ready record');
    const ack = parseJson(ackIdentity.path, sessionRoot, 'Capture ack record');
    assertExactKeys(
      ready,
      ['schema', 'runUuid', 'language', 'scenario', 'pid', 'sequence', 'surface', 'target', 'result'],
      `run.captures[${index}].ready`
    );
    assertExactKeys(
      ack,
      ['schema', 'status', 'runUuid', 'pid', 'sequence', 'surface', 'ready', 'mapped', 'osPng'],
      `run.captures[${index}].ack`
    );
    const witness = witnesses.get(ready.sequence);
    if (
      ready.schema !== 'cavalry-i18n.acceptance-v2.capture-ready/v1' ||
      ready.runUuid !== manifest.uuid || ready.language !== manifest.language ||
      ready.scenario !== manifest.scenario || ready.pid !== manifest.initial?.pid ||
      !Number.isInteger(ready.sequence) || !witness ||
      ready.surface !== witness.item.surface || !isDeepStrictEqual(ready.result, witness.item) ||
      !isDeepStrictEqual(ready.target, ready.result.target) ||
      !isDeepStrictEqual(ready, capture.ready)
    ) {
      fail(`Capture ready relationship mismatch: ${run.language}/${run.scenario}/${index}.`);
    }
    validateBounds(ready.target?.childBounds, `run.captures[${index}].ready.target.childBounds`);
    validateBounds(ready.target?.windowBounds, `run.captures[${index}].ready.target.windowBounds`);
    if (
      !Number.isInteger(ready.target.nativeWindowNumber) || ready.target.nativeWindowNumber <= 0 ||
      ready.result.readyPath !== readyIdentity.path
    ) {
      fail(`Capture ready native-window/path binding mismatch: ${run.language}/${run.scenario}/${index}.`);
    }
    validateBounds(capture.mapped?.bounds, `run.captures[${index}].mapped.bounds`);
    if (
      capture.mapped.window !== ready.target.nativeWindowNumber ||
      capture.mapped.pid !== manifest.initial.pid ||
      typeof capture.mapped.owner !== 'string' || capture.mapped.owner.length === 0 ||
      capture.mapped.surface !== ready.surface
    ) {
      fail(`Capture native-window mapping mismatch: ${run.language}/${run.scenario}/${index}.`);
    }
    if (
      ack.schema !== 'cavalry-i18n.acceptance-v2.capture-ack/v1' || ack.status !== 'CAPTURED' ||
      ack.runUuid !== manifest.uuid || ack.pid !== manifest.initial?.pid ||
      ack.sequence !== ready.sequence || ack.surface !== ready.surface ||
      !sameIdentity(ack.ready, capture.readyIdentity) || !sameIdentity(ack.osPng, capture.osPng) ||
      !isDeepStrictEqual(ack.mapped, capture.mapped)
    ) {
      fail(`Capture ack relationship mismatch: ${run.language}/${run.scenario}/${index}.`);
    }
    const prefix = path.basename(readyIdentity.path, '.ready.json');
    const captureDir = path.dirname(readyIdentity.path);
    if (
      path.dirname(ackIdentity.path) !== captureDir || path.basename(ackIdentity.path) !== `${prefix}.ack.json` ||
      path.dirname(screenshot.path) !== captureDir || path.basename(screenshot.path) !== `${prefix}-window-os.png`
    ) {
      fail(`Capture files do not share the producer's exact prefix: ${run.language}/${run.scenario}/${index}.`);
    }
    if (capturesBySequence.has(ready.sequence)) {
      fail(`Duplicate run capture sequence: ${ready.sequence}.`);
    }
    capturesBySequence.set(ready.sequence, { capture, ready, screenshot, witness });
    if (screenshots.has(screenshot.path)) fail(`Duplicate run screenshot: ${screenshot.path}.`);
    screenshots.set(screenshot.path, {
      ...screenshot,
      logicalSurface: witness.logicalSurface,
      surface: ready.surface,
      sequence: ready.sequence,
    });
  }
  if (capturesBySequence.size !== witnesses.size) {
    fail(`Run does not bind every semantic witness to one capture: ${run.language}/${run.scenario}.`);
  }
  const expectedPointEvidence = done.surfaceResults.map((result) => {
    const variants = result.variants?.length ? result.variants : [result];
    return {
      surface: result.surface,
      evidence: variants.map((variant) => {
        const linked = capturesBySequence.get(variant.sequence);
        if (!linked || linked.witness.item !== variant) {
          fail(`Run logical/capture sequence mismatch: ${run.language}/${result.surface}.`);
        }
        return {
          surface: linked.ready.surface,
          sequence: variant.sequence,
          screenshot: linked.capture.osPng,
        };
      }),
    };
  });
  if (!isDeepStrictEqual(manifest.pointEvidence, expectedPointEvidence)) {
    fail(`Run pointEvidence is not the exact logical/capture projection: ${run.language}/${run.scenario}.`);
  }
  return { manifest, screenshots, identity: run.manifest };
}

function expectedPointMap(machine, sessionRoot, runs) {
  if (!Array.isArray(machine.points) || machine.points.length !== EXPECTED_KEYS.length) {
    fail(`Machine record must contain exactly ${EXPECTED_KEYS.length} logical points.`);
  }
  const actualKeys = machine.points.map((point) => point.key).sort();
  if (JSON.stringify(actualKeys) !== JSON.stringify(EXPECTED_KEYS)) {
    fail('Machine record logical point set does not match the frozen 48-point contract.');
  }
  const map = new Map();
  for (const point of machine.points) {
    if (!Array.isArray(point.evidence) || point.evidence.length < 1) {
      fail(`Machine point has no screenshot evidence: ${point.key}.`);
    }
    const [language, ...surfaceParts] = point.key.split('/');
    const surface = surfaceParts.join('/');
    const scenario = Object.entries(SURFACES_BY_SCENARIO)
      .find(([, values]) => values.includes(surface))?.[0];
    const run = runs.get(`${language}/${scenario}`);
    if (!run || !sameIdentity(point.runManifest, run.identity)) {
      fail(`Machine point is not bound to its run manifest: ${point.key}.`);
    }
    const screenshots = point.evidence.map((item, index) => {
      const screenshot = verifyIdentity(
        item.screenshot,
        sessionRoot,
        `machine.points.${point.key}.evidence[${index}]`
      );
      const frozen = run.screenshots.get(screenshot.path);
      if (
        !frozen || frozen.bytes !== screenshot.bytes || frozen.sha256 !== screenshot.sha256 ||
        frozen.logicalSurface !== surface || frozen.surface !== item.surface ||
        frozen.sequence !== item.sequence
      ) {
        fail(`Machine point screenshot semantic binding mismatch: ${point.key}.`);
      }
      run.screenshots.delete(screenshot.path);
      return screenshot;
    });
    const expectedCount = scenario === 'replace' ? 2 : 1;
    if (screenshots.length !== expectedCount) {
      fail(`Machine point screenshot count mismatch: ${point.key}.`);
    }
    map.set(point.key, screenshots);
  }
  for (const [runKey, run] of runs) {
    if (run.screenshots.size !== 0) fail(`Run contains unbound screenshots: ${runKey}.`);
  }
  return map;
}

function verifyManualReview(review, pointMap, sessionRoot) {
  if (review.schema !== 'cavalry-i18n.acceptance-v2.manual-review/v1' || !Array.isArray(review.points)) {
    fail('Manual review schema mismatch.');
  }
  if (review.points.length !== EXPECTED_KEYS.length) {
    fail(`Manual review must contain exactly ${EXPECTED_KEYS.length} points.`);
  }
  const seen = new Set();
  for (const point of review.points) {
    if (!pointMap.has(point.key) || seen.has(point.key) || point.status !== 'APPROVED') {
      fail(`Invalid or duplicate manual review point: ${point.key || '<missing>'}.`);
    }
    if (!Array.isArray(point.screenshots)) {
      fail(`Manual review screenshots missing: ${point.key}.`);
    }
    const expected = pointMap.get(point.key);
    if (point.screenshots.length !== expected.length) {
      fail(`Manual review screenshot count mismatch: ${point.key}.`);
    }
    const expectedByPath = new Map(expected.map((identity) => [identity.path, identity]));
    for (const [index, screenshot] of point.screenshots.entries()) {
      const actual = verifyIdentity(
        screenshot,
        sessionRoot,
        `manualReview.${point.key}.screenshots[${index}]`
      );
      const frozen = expectedByPath.get(actual.path);
      if (!frozen || frozen.bytes !== actual.bytes || frozen.sha256 !== actual.sha256) {
        fail(`Manual review screenshot is not bound to machine evidence: ${point.key}.`);
      }
      expectedByPath.delete(actual.path);
    }
    if (expectedByPath.size !== 0) {
      fail(`Manual review does not cover the exact machine evidence set: ${point.key}.`);
    }
    seen.add(point.key);
  }
}

function verifyAcceptanceSession(sessionInput, options = {}) {
  const session = resolveSession(sessionInput);
  const finalPath = path.join(session.root, 'matrix-final-record.json');
  const machinePath = path.join(session.root, 'matrix-machine-record.json');
  const finalRecord = parseJson(finalPath, session.root, 'Final acceptance record');
  assertExactKeys(
    finalRecord,
    ['schema', 'status', 'sealedAtUtc', 'machine', 'review', 'points'],
    'finalRecord'
  );
  if (
    finalRecord.schema !== 'cavalry-i18n.acceptance-v2.final/v1' ||
    finalRecord.status !== 'PASS-48-OF-48' || !Number.isFinite(Date.parse(finalRecord.sealedAtUtc))
  ) {
    fail('Final acceptance record is not PASS-48-OF-48.');
  }
  const machineIdentity = verifyIdentity(
    finalRecord.machine,
    session.root,
    'final.machine',
    machinePath
  );
  const reviewIdentity = verifyIdentity(finalRecord.review, session.root, 'final.review');
  const machine = parseJson(machineIdentity.path, session.root, 'Machine acceptance record');
  const review = parseJson(reviewIdentity.path, session.root, 'Manual review record');
  assertExactKeys(
    machine,
    [
      'schema', 'status', 'createdAtUtc', 'host', 'repository', 'target', 'qt', 'clone',
      'productInjector', 'tools', 'buildEvidence', 'sources', 'fixtureEvidence', 'stages',
      'runs', 'points',
    ],
    'machine'
  );
  if (
    machine.schema !== 'cavalry-i18n.acceptance-v2.matrix/v6' ||
    machine.status !== 'MACHINE-COMPLETE-MANUAL-PENDING' ||
    !Number.isFinite(Date.parse(machine.createdAtUtc))
  ) {
    fail('Machine acceptance record schema/status mismatch.');
  }
  assertExactKeys(machine.repository, ['root', 'head', 'worktreeStatus'], 'machine.repository');
  assertHex(machine.repository?.head, 'machine.repository.head', 40);
  if (!Array.isArray(machine.repository?.worktreeStatus) || machine.repository.worktreeStatus.length !== 0) {
    fail('Release acceptance must originate from a clean source worktree.');
  }
  let expectedRepo = null;
  if (options.repoRoot) {
    expectedRepo = fs.realpathSync(path.resolve(options.repoRoot));
    if (fs.realpathSync(path.resolve(machine.repository?.root || '')) !== expectedRepo) {
      fail('Live acceptance repository root does not match the evidence-generating repository.');
    }
    const currentHead = spawnSync('git', ['-C', expectedRepo, 'rev-parse', 'HEAD'], { encoding: 'utf8' });
    if (currentHead.status !== 0 || currentHead.stdout.trim() !== machine.repository.head) {
      fail('Live acceptance repository HEAD no longer matches the machine source commit.');
    }
  }
  assertExactKeys(machine.target, ['file', 'cavalryVersion', 'qtVersion'], 'machine.target');
  if (machine.target?.cavalryVersion !== '2.7.2' || machine.target?.qtVersion !== '6.6.3') {
    fail('Acceptance target must be Cavalry 2.7.2 / Qt 6.6.3.');
  }
  assertExactKeys(machine.host, ['productVersion', 'buildVersion'], 'machine.host');
  if (
    typeof machine.host.productVersion !== 'string' || !/^\d+(?:\.\d+){1,2}$/.test(machine.host.productVersion) ||
    typeof machine.host.buildVersion !== 'string' || !/^\d{2}[A-Z][0-9A-Za-z]{1,15}$/.test(machine.host.buildVersion)
  ) {
    fail('Acceptance host must contain a valid macOS productVersion/buildVersion.');
  }
  verifyIdentity(machine.target?.file, null, 'machine.target.file');
  assertExactKeys(machine.qt, ['expectedVersion', 'sdk', 'runtime', 'finalRuntimeCore'], 'machine.qt');
  assertExactKeys(machine.qt.sdk, ['prefix', 'version', 'core'], 'machine.qt.sdk');
  assertExactKeys(machine.qt.runtime, ['version', 'core'], 'machine.qt.runtime');
  if (
    machine.qt.expectedVersion !== '6.6.3' || machine.qt.sdk.version !== '6.6.3' ||
    machine.qt.runtime.version !== '6.6.3'
  ) {
    fail('Acceptance Qt SDK/runtime records must all identify Qt 6.6.3.');
  }
  verifyIdentity(machine.qt.sdk.core, null, 'machine.qt.sdk.core');
  verifyIdentity(machine.qt.finalRuntimeCore, null, 'machine.qt.finalRuntimeCore');
  recordedIdentityAtPath(
    machine.qt.runtime.core,
    machine.qt.finalRuntimeCore.path,
    'machine.qt.runtime.core'
  );
  assertExactKeys(
    machine.clone,
    ['appPath', 'version', 'expectedExecutableSha256', 'originalExecutable', 'finalExecutable'],
    'machine.clone'
  );
  if (
    machine.clone.version !== '2.7.2' ||
    machine.clone.expectedExecutableSha256 !== machine.clone.originalExecutable?.sha256
  ) {
    fail('Acceptance clone version/original executable contract mismatch.');
  }
  const cloneStat = fs.lstatSync(path.resolve(machine.clone.appPath));
  if (
    !cloneStat.isDirectory() || cloneStat.isSymbolicLink() ||
    fs.realpathSync(path.resolve(machine.clone.appPath)) !== path.resolve(machine.clone.appPath)
  ) {
    fail('Acceptance clone appPath must remain a canonical non-symlink directory.');
  }
  verifyIdentity(machine.clone.finalExecutable, null, 'machine.clone.finalExecutable');
  recordedIdentityAtPath(
    machine.clone.originalExecutable,
    machine.clone.finalExecutable.path,
    'machine.clone.originalExecutable'
  );
  if (!Array.isArray(machine.sources) || machine.sources.length < 1) {
    fail('Machine record has no frozen source closure.');
  }
  const expectedSources = expectedRepo
    ? sourceEntries(expectedRepo).map((entry) => ({
        source: fs.realpathSync(entry.source),
        frozen: path.join(session.root, 'source-snapshot', entry.destination),
      }))
    : null;
  if (expectedSources && machine.sources.length !== expectedSources.length) {
    fail(`Machine source closure size mismatch: expected ${expectedSources.length}, got ${machine.sources.length}.`);
  }
  const seenSourcePaths = new Set();
  const frozenSourceByPath = new Map();
  for (const [index, source] of machine.sources.entries()) {
    assertExactKeys(source, ['source', 'frozen'], `machine.sources[${index}]`);
    const current = verifyIdentity(source.source, null, `machine.sources[${index}].source`);
    const frozen = verifyIdentity(source.frozen, session.root, `machine.sources[${index}].frozen`);
    if (!sameArtifactBytes(current, frozen) || seenSourcePaths.has(current.path)) {
      fail(`Frozen source is duplicate or differs from its canonical input: ${current.path}.`);
    }
    seenSourcePaths.add(current.path);
    frozenSourceByPath.set(frozen.path, frozen);
    if (expectedSources) {
      const expected = expectedSources[index];
      if (current.path !== expected.source || frozen.path !== expected.frozen) {
        fail(`Machine source closure ordering/path mismatch at index ${index}.`);
      }
      const relative = path.relative(expectedRepo, current.path);
      const committed = gitFileAtCommit(expectedRepo, machine.repository.head, relative);
      if (!committed.equals(fs.readFileSync(current.path)) || !committed.equals(fs.readFileSync(frozen.path))) {
        fail(`Frozen source is not the exact blob from source commit: ${relative}.`);
      }
    }
  }
  assertExactKeys(machine.tools, ['injector', 'main', 'supplemental', 'exactWindow'], 'machine.tools');
  for (const [name, identity] of Object.entries(machine.tools)) {
    verifyIdentity(identity, session.root, `machine.tools.${name}`);
  }
  if (!sameIdentity(machine.productInjector, machine.tools.injector)) {
    fail('Machine product injector is not the injector used by the acceptance runs.');
  }
  assertExactKeys(
    machine.buildEvidence,
    ['acceptanceScript', 'productScript', 'regeneratedTable'],
    'machine.buildEvidence'
  );
  for (const [name, identity] of Object.entries(machine.buildEvidence)) {
    verifyIdentity(identity, session.root, `machine.buildEvidence.${name}`);
  }
  if (!Array.isArray(machine.fixtureEvidence) || machine.fixtureEvidence.length !== 3) {
    fail('Machine fixture evidence must contain exactly three real media fixtures.');
  }
  const fixtureContracts = [
    ['replace-source.png', verifyPngIdentity],
    ['dynamic-proof-two.png', verifyPngIdentity],
    ['replace-source.mp4', verifyMp4Identity],
  ];
  for (const [index, [name, verifier]] of fixtureContracts.entries()) {
    const expectedLivePath = path.join(session.root, 'fixtures', name);
    const expectedFrozenPath = path.join(
      session.root, 'source-snapshot', 'acceptance', 'fixtures', name
    );
    const verified = verifier(machine.fixtureEvidence[index], session.root, `machine.fixtureEvidence[${index}]`);
    const frozen = frozenSourceByPath.get(expectedFrozenPath);
    if (verified.path !== expectedLivePath || !frozen || !sameArtifactBytes(verified, frozen)) {
      fail(`Acceptance media fixture is not the exact frozen producer fixture: ${name}.`);
    }
  }
  if (!Array.isArray(machine.stages) || machine.stages.length !== LANGUAGES.length) {
    fail('Machine record must contain exactly three language stages.');
  }
  const stagesByLanguage = new Map();
  for (const [index, identity] of machine.stages.entries()) {
    const verified = verifyIdentity(identity, session.root, `machine.stages[${index}]`);
    const stage = parseJson(verified.path, session.root, `Language stage ${index}`);
    assertExactKeys(stage, ['language', 'files', 'executable', 'runtimeQtCore'], `machine.stage.${index}`);
    if (!LANGUAGES.includes(stage.language) || stagesByLanguage.has(stage.language)) {
      fail(`Language stages must contain one unique record per supported language: ${stage.language || '<missing>'}.`);
    }
    if (!Array.isArray(stage.files) || stage.files.length !== 3) {
      fail(`Language stage must contain exactly three Guide files: ${stage.language}.`);
    }
    for (const [fileIndex, file] of stage.files.entries()) {
      assertExactKeys(file, ['source', 'destination'], `machine.stage.${stage.language}.files[${fileIndex}]`);
      const expectedSource = path.join(
        session.root,
        'source-snapshot',
        'repo',
        'languages',
        stage.language,
        GUIDE_FILES[fileIndex][0]
      );
      const expectedDestination = path.join(
        path.resolve(machine.clone.appPath),
        'Contents',
        'assets',
        GUIDE_FILES[fileIndex][1]
      );
      const source = verifyIdentity(
        file.source,
        session.root,
        `machine.stage.${stage.language}.files[${fileIndex}].source`,
        expectedSource
      );
      const destination = recordedIdentityAtPath(
        file.destination,
        expectedDestination,
        `machine.stage.${stage.language}.files[${fileIndex}].destination`
      );
      if (!sameArtifactBytes(source, destination)) {
        fail(`Language stage Guide file drifted while staging: ${stage.language}/${fileIndex}.`);
      }
      if (stage.language === LANGUAGES.at(-1)) {
        const currentDestination = verifyIdentity(
          file.destination,
          null,
          `machine.stage.${stage.language}.files[${fileIndex}].finalDestination`,
          expectedDestination
        );
        if (!sameArtifactBytes(source, currentDestination)) {
          fail(`Final language stage Guide destination drifted: ${stage.language}/${fileIndex}.`);
        }
      }
    }
    recordedIdentityAtPath(
      stage.executable,
      machine.clone.finalExecutable.path,
      `machine.stage.${stage.language}.executable`
    );
    recordedIdentityAtPath(
      stage.runtimeQtCore,
      machine.qt.finalRuntimeCore.path,
      `machine.stage.${stage.language}.runtimeQtCore`
    );
    stagesByLanguage.set(stage.language, { identity, record: stage });
  }
  if (LANGUAGES.some((language) => !stagesByLanguage.has(language))) {
    fail('Language stage set is incomplete.');
  }
  if (!Array.isArray(machine.runs) || machine.runs.length !== LANGUAGES.length * SCENARIOS.length) {
    fail('Machine record must contain exactly 21 runs.');
  }
  const runKeys = new Set();
  const verifiedRuns = new Map();
  for (const run of machine.runs) {
    const key = `${run.language}/${run.scenario}`;
    if (runKeys.has(key)) fail(`Duplicate acceptance run: ${key}.`);
    runKeys.add(key);
    verifiedRuns.set(key, verifyRunManifest(run, session.root, stagesByLanguage, machine));
  }
  const expectedRunKeys = LANGUAGES.flatMap((language) =>
    SCENARIOS.map((scenario) => `${language}/${scenario}`)
  );
  if (expectedRunKeys.some((key) => !runKeys.has(key))) {
    fail('Acceptance run matrix is incomplete.');
  }
  const finalStage = stagesByLanguage.get(LANGUAGES.at(-1));
  if (!finalStage || !sameIdentity(finalStage.record.executable, machine.clone.finalExecutable)) {
    fail('Final clone executable is not the executable from the final language stage.');
  }
  const pointMap = expectedPointMap(machine, session.root, verifiedRuns);
  verifyManualReview(review, pointMap, session.root);
  if (!Array.isArray(finalRecord.points) || JSON.stringify([...finalRecord.points].sort()) !== JSON.stringify(EXPECTED_KEYS)) {
    fail('Final record does not seal the frozen 48-point key set.');
  }
  const finalStat = regularNoSymlink(finalPath, session.root, 'Final acceptance record');
  const summary = {
    sourceCommitSha: machine.repository.head,
    sessionId: session.sessionId,
    finalRecord: { bytes: finalStat.size, sha256: sha256File(finalPath) },
    machineRecord: { bytes: machineIdentity.bytes, sha256: machineIdentity.sha256 },
    manualReview: { bytes: reviewIdentity.bytes, sha256: reviewIdentity.sha256 },
    host: { productVersion: machine.host.productVersion, buildVersion: machine.host.buildVersion },
  };
  summary.sessionManifestSha256 = sha256Buffer(Buffer.from(JSON.stringify(summary)));
  return summary;
}

function validateEvidence(evidence) {
  assertExactKeys(
    evidence,
    [
      'schemaVersion',
      'kind',
      'tag',
      'sourceCommitSha',
      'targetCavalryVersion',
      'qtVersion',
      'languages',
      'macosAcceptance',
      'createdAtUtc',
      'createdBy',
    ],
    'evidence'
  );
  if (evidence.schemaVersion !== 3 || evidence.kind !== 'ReleaseAcceptanceEvidence') {
    fail('Release acceptance evidence schema/kind mismatch.');
  }
  if (!/^cavalry-2\.7\.2-p[0-9]+$/.test(evidence.tag)) fail('Evidence tag is invalid.');
  assertHex(evidence.sourceCommitSha, 'sourceCommitSha', 40);
  if (evidence.targetCavalryVersion !== '2.7.2' || evidence.qtVersion !== '6.6.3') {
    fail('Evidence target must be Cavalry 2.7.2 / Qt 6.6.3.');
  }
  if (JSON.stringify(evidence.languages) !== JSON.stringify(LANGUAGES)) {
    fail('Evidence languages must be exactly zh-Hans, zh-Hant, ja_JP in canonical order.');
  }
  const acceptance = evidence.macosAcceptance;
  assertExactKeys(
    acceptance,
    [
      'result',
      'matrix',
      'producer',
      'sessionId',
      'finalRecord',
      'machineRecord',
      'manualReview',
      'sessionManifestSha256',
      'host',
    ],
    'macosAcceptance'
  );
  if (
    acceptance.result !== 'PASS-48-OF-48' ||
    acceptance.matrix !== '21-run/48-point' ||
    acceptance.producer !== 'tools/macos-acceptance'
  ) {
    fail('Evidence macOS acceptance result/matrix/producer mismatch.');
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(acceptance.sessionId)) {
    fail('Evidence sessionId is invalid.');
  }
  for (const field of ['finalRecord', 'machineRecord', 'manualReview']) {
    const identity = acceptance[field];
    if (!identity || !Number.isInteger(identity.bytes) || identity.bytes < 1) {
      fail(`macosAcceptance.${field}.bytes must be positive.`);
    }
    assertHex(identity.sha256, `macosAcceptance.${field}.sha256`, 64);
  }
  assertHex(acceptance.sessionManifestSha256, 'macosAcceptance.sessionManifestSha256', 64);
  assertExactKeys(acceptance.host, ['productVersion', 'buildVersion'], 'macosAcceptance.host');
  if (
    typeof acceptance.host.productVersion !== 'string' || !/^\d+(?:\.\d+){1,2}$/.test(acceptance.host.productVersion) ||
    typeof acceptance.host.buildVersion !== 'string' || !/^\d{2}[A-Z][0-9A-Za-z]{1,15}$/.test(acceptance.host.buildVersion)
  ) fail('macosAcceptance.host is invalid.');
  const created = Date.parse(evidence.createdAtUtc);
  if (!Number.isFinite(created)) fail('createdAtUtc must be a valid timestamp.');
  assertString(evidence.createdBy, 'createdBy');
  return evidence;
}

function assertEvidenceMatchesSession(evidence, summary) {
  if (evidence.sourceCommitSha !== summary.sourceCommitSha) {
    fail('Evidence source commit does not match the verified live session.');
  }
  const acceptance = evidence.macosAcceptance;
  for (const field of [
    'sessionId',
    'sessionManifestSha256',
  ]) {
    if (acceptance[field] !== summary[field]) {
      fail(`Evidence ${field} does not match the verified live session.`);
    }
  }
  for (const field of ['finalRecord', 'machineRecord', 'manualReview']) {
    if (
      acceptance[field].bytes !== summary[field].bytes ||
      acceptance[field].sha256 !== summary[field].sha256
    ) {
      fail(`Evidence ${field} does not match the verified live session.`);
    }
  }
  if (acceptance.host.productVersion !== summary.host.productVersion || acceptance.host.buildVersion !== summary.host.buildVersion) {
    fail('Evidence host does not match the verified live session.');
  }
}

module.exports = {
  LANGUAGES,
  assertEvidenceMatchesSession,
  assertHex,
  sha256File,
  validateEvidence,
  verifyAcceptanceSession,
};
