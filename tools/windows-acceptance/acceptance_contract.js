/**
 * [INPUT]: Windows disposable TEMP session、最终 x64 NSIS/sidecar、安装后 generic/QPA DLL、Cavalry 2.7.2 clone 与三语 live matrix
 * [OUTPUT]: 对外提供 Windows release acceptance session 的 fail-closed 验证与可发布摘要，绑定截图、inventory、进程、安装器和 shipped DLL 字节身份
 * [POS]: tools/windows-acceptance 的共享信任边界；live runner 只能写入 session，release producer 只能从已验证记录派生 PASS，不接受命令行手工 PASS
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const LANGUAGES = Object.freeze(['zh-Hans', 'zh-Hant', 'ja_JP']);
const SCENARIOS = Object.freeze(['onboarding', 'adjacent']);
const EXPECTED_POINTS = Object.freeze(
  LANGUAGES.flatMap((language) => [
    ...Array.from({ length: 5 }, (_, index) => ({
      key: `${language}/onboarding/${index + 1}`,
      language,
      scenario: 'onboarding',
      ordinal: index + 1,
    })),
    ...Array.from({ length: 3 }, (_, index) => ({
      key: `${language}/adjacent/${index + 1}`,
      language,
      scenario: 'adjacent',
      ordinal: index + 1,
    })),
  ])
);
const EXPECTED_POINT_KEYS = Object.freeze(EXPECTED_POINTS.map(({ key }) => key));
const MATRIX_PROFILES = Object.freeze({
  'windows-onboarding-v1': Object.freeze({
    scenarios: Object.freeze(['onboarding']),
    points: Object.freeze(EXPECTED_POINTS.filter((point) => point.scenario === 'onboarding')),
  }),
  'windows-adjacent-v1': Object.freeze({
    scenarios: Object.freeze(['adjacent']),
    points: Object.freeze(EXPECTED_POINTS.filter((point) => point.scenario === 'adjacent')),
  }),
  'windows-onboarding-adjacent-v1': Object.freeze({
    scenarios: Object.freeze(['onboarding', 'adjacent']),
    points: EXPECTED_POINTS,
  }),
});
const SESSION_SENTINEL = '.cavalry-i18n-windows-release-acceptance';
const SESSION_SENTINEL_MAGIC = 'cavalry-i18n.windows-release-acceptance/v1';
const CLONE_SENTINEL = '.cavalry-i18n-disposable-smoke';
const NSIS_TARGET = 'x86_64-pc-windows-msvc';
const MACHINE_SCHEMA = 'cavalry-i18n.windows-release.machine/v1';
const REVIEW_SCHEMA = 'cavalry-i18n.windows-release.manual-review/v1';
const FINAL_SCHEMA = 'cavalry-i18n.windows-release.final/v1';
const SUMMARY_SCHEMA_VERSION = 1;
const GENERIC_RELATIVE_PATH = 'injector/windows/generic/cavalryi18n.dll';
const QPA_RELATIVE_PATH = 'injector/windows/qpa/qwindows.dll';

function fail(message) {
  throw new Error(`Windows release acceptance: ${message}`);
}

function samePath(left, right) {
  const a = path.resolve(left);
  const b = path.resolve(right);
  return process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b;
}

function isStrictChild(candidate, root) {
  const relative = path.relative(path.resolve(root), path.resolve(candidate));
  return Boolean(relative) && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

function assertHex(value, field, length) {
  if (typeof value !== 'string' || !new RegExp(`^[a-f0-9]{${length}}$`).test(value)) {
    fail(`${field} must be lowercase ${length}-character hex.`);
  }
}

function assertString(value, field) {
  if (typeof value !== 'string' || value.length === 0) fail(`${field} must be a non-empty string.`);
}

function assertExactKeys(value, expected, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${field} must be an object.`);
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (JSON.stringify(actual) !== JSON.stringify(wanted)) {
    fail(`${field} keys mismatch: expected ${wanted.join(', ')}, got ${actual.join(', ')}.`);
  }
}

function assertNoReparseChain(candidate, field) {
  let current = path.resolve(candidate);
  for (;;) {
    let stat;
    try {
      stat = fs.lstatSync(current);
    } catch (error) {
      if (error.code === 'ENOENT') {
        current = path.dirname(current);
        if (current === path.dirname(current)) break;
        continue;
      }
      fail(`could not inspect ${field} path ${current}: ${error.message}`);
    }
    if (stat.isSymbolicLink()) fail(`${field} path crosses a symlink/junction: ${current}`);
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
}

function regularFile(filePath, field, root = null) {
  const absolute = path.resolve(filePath);
  let stat;
  try {
    stat = fs.lstatSync(absolute);
  } catch (error) {
    fail(`${field} is missing: ${absolute} (${error.message})`);
  }
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size < 1) {
    fail(`${field} must be a non-empty regular file: ${absolute}`);
  }
  assertNoReparseChain(absolute, field);
  const real = fs.realpathSync.native(absolute);
  if (!samePath(real, absolute)) fail(`${field} is not a canonical file: ${absolute}`);
  if (root && !isStrictChild(absolute, root)) fail(`${field} must stay inside ${root}: ${absolute}`);
  return { absolute, stat };
}

function directory(directoryPath, field) {
  const absolute = path.resolve(directoryPath);
  let stat;
  try {
    stat = fs.lstatSync(absolute);
  } catch (error) {
    fail(`${field} is missing: ${absolute} (${error.message})`);
  }
  if (!stat.isDirectory() || stat.isSymbolicLink()) fail(`${field} must be a regular directory: ${absolute}`);
  assertNoReparseChain(absolute, field);
  if (!samePath(fs.realpathSync.native(absolute), absolute)) fail(`${field} is not canonical: ${absolute}`);
  return absolute;
}

function sha256File(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function identityShape(value, field) {
  assertExactKeys(value, ['path', 'bytes', 'sha256'], field);
  assertString(value.path, `${field}.path`);
  if (!Number.isInteger(value.bytes) || value.bytes < 1) fail(`${field}.bytes must be a positive integer.`);
  assertHex(value.sha256, `${field}.sha256`, 64);
}

function verifyIdentity(value, field, root = null, expectedPath = null) {
  identityShape(value, field);
  const candidate = path.resolve(value.path);
  if (expectedPath && !samePath(candidate, expectedPath)) {
    fail(`${field}.path must be ${path.resolve(expectedPath)}, got ${candidate}.`);
  }
  const file = regularFile(candidate, field, root);
  if (file.stat.size !== value.bytes) fail(`${field}.bytes drifted: expected ${value.bytes}, got ${file.stat.size}.`);
  const digest = sha256File(candidate);
  if (digest !== value.sha256) fail(`${field}.sha256 drifted: expected ${value.sha256}, got ${digest}.`);
  return { path: candidate, bytes: file.stat.size, sha256: digest };
}

function sameIdentity(left, right) {
  return Boolean(
    left && right && samePath(left.path, right.path) && left.bytes === right.bytes && left.sha256 === right.sha256
  );
}

function readJson(filePath, field, root = null) {
  const verified = regularFile(filePath, field, root);
  let value;
  try {
    value = JSON.parse(fs.readFileSync(verified.absolute, 'utf8').replace(/^\uFEFF/, ''));
  } catch (error) {
    fail(`${field} is not valid JSON: ${error.message}`);
  }
  return value;
}

function verifyJsonIdentity(value, field, root) {
  const identity = verifyIdentity(value, field, root);
  const parsed = readJson(identity.path, field, root);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || Object.keys(parsed).length === 0) {
    fail(`${field} must contain a non-empty JSON object.`);
  }
  return { identity, value: parsed };
}

function verifyPngIdentity(value, field, root) {
  const identity = verifyIdentity(value, field, root);
  const bytes = fs.readFileSync(identity.path);
  if (bytes.length < 45 || bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') {
    fail(`${field} is not a non-empty PNG.`);
  }
  if (bytes.subarray(12, 16).toString('ascii') !== 'IHDR' || bytes.readUInt32BE(8) !== 13) {
    fail(`${field} does not contain a valid PNG IHDR.`);
  }
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  if (width < 2 || height < 2) fail(`${field} has empty PNG geometry.`);
  return { ...identity, width, height };
}

function resolveSession(input) {
  const root = directory(input, 'Windows acceptance session');
  const tempRoot = directory(os.tmpdir(), 'Windows TEMP root');
  if (!isStrictChild(root, tempRoot)) fail(`session must be strictly below TEMP: ${root}`);
  const sessionId = path.basename(root);
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(sessionId)) fail(`unsafe session id: ${sessionId}`);
  const sentinelPath = path.join(root, SESSION_SENTINEL);
  const sentinel = regularFile(sentinelPath, 'Windows acceptance session sentinel', root);
  const firstLine = fs.readFileSync(sentinel.absolute, 'utf8').split(/\r?\n/, 1)[0];
  if (firstLine !== SESSION_SENTINEL_MAGIC) fail(`session sentinel has the wrong magic: ${sentinelPath}`);
  return { root, sessionId, sentinel: { path: sentinel.absolute, bytes: sentinel.stat.size, sha256: sha256File(sentinel.absolute) } };
}

function assertTimestamp(value, field) {
  assertString(value, field);
  if (!Number.isFinite(Date.parse(value))) fail(`${field} must be an ISO timestamp.`);
}

function verifyRepository(repository, options) {
  assertExactKeys(repository, ['head', 'worktreeStatus'], 'machine.repository');
  assertHex(repository.head, 'machine.repository.head', 40);
  if (!Array.isArray(repository.worktreeStatus) || repository.worktreeStatus.length !== 0) {
    fail('Windows acceptance must originate from a clean source worktree.');
  }
  if (!options.repoRoot) return repository.head;
  const repoRoot = path.resolve(options.repoRoot);
  directory(repoRoot, 'acceptance repository');
  const head = spawnSync('git', ['-C', repoRoot, 'rev-parse', 'HEAD'], { encoding: 'utf8' });
  if (head.status !== 0 || head.stdout.trim().toLowerCase() !== repository.head) {
    fail(`current repository HEAD does not match machine.repository.head ${repository.head}.`);
  }
  const status = spawnSync('git', ['-C', repoRoot, 'status', '--short', '--untracked-files=all'], { encoding: 'utf8' });
  if (status.status !== 0 || status.stdout.trim() !== '') fail('current source worktree is not clean.');
  return repository.head;
}

function verifyTarget(target, session) {
  assertExactKeys(
    target,
    [
      'cavalryVersion', 'qtVersion', 'architecture', 'clonePath', 'cloneSentinel', 'executable',
      'restoredEnglish', 'zeroOwnedProcesses',
    ],
    'machine.target'
  );
  if (target.cavalryVersion !== '2.7.2' || target.qtVersion !== '6.6.3' || target.architecture !== 'x86_64') {
    fail('acceptance target must be Cavalry 2.7.2 / Qt 6.6.3 / x86_64.');
  }
  if (target.restoredEnglish !== true || target.zeroOwnedProcesses !== true) {
    fail('Cavalry clone must finish restored to English with no owned process.');
  }
  const clone = directory(target.clonePath, 'disposable Cavalry clone');
  const tempRoot = directory(os.tmpdir(), 'Windows TEMP root');
  if (!isStrictChild(clone, tempRoot)) fail(`disposable Cavalry clone must be below TEMP: ${clone}`);
  const sentinelPath = path.join(clone, CLONE_SENTINEL);
  const sentinel = verifyIdentity(target.cloneSentinel, 'machine.target.cloneSentinel', null, sentinelPath);
  if (sentinel.bytes < CLONE_SENTINEL.length) fail('disposable clone sentinel is empty.');
  const executable = verifyIdentity(target.executable, 'machine.target.executable');
  if (!isStrictChild(executable.path, clone)) fail('Cavalry executable must be inside disposable clone.');
  return { clonePath: clone, sentinel, executable };
}

function verifyInstaller(installer) {
  assertExactKeys(installer, ['fileName', 'artifact'], 'machine.installer');
  assertString(installer.fileName, 'machine.installer.fileName');
  if (path.basename(installer.fileName) !== installer.fileName || !/\.exe$/i.test(installer.fileName) || !/x64-setup\.exe$/i.test(installer.fileName)) {
    fail(`installer filename is not the Windows x64 NSIS asset: ${installer.fileName}`);
  }
  const artifact = verifyIdentity(installer.artifact, 'machine.installer.artifact');
  if (path.basename(artifact.path) !== installer.fileName) fail('installer artifact filename does not match machine.installer.fileName.');
  return { fileName: installer.fileName, artifact };
}

function verifyShippedDlls(shippedDlls) {
  assertExactKeys(shippedDlls, ['generic', 'qpa'], 'machine.shippedDlls');
  const expected = [
    ['generic', GENERIC_RELATIVE_PATH],
    ['qpa', QPA_RELATIVE_PATH],
  ];
  const result = {};
  for (const [name, relativePath] of expected) {
    assertExactKeys(shippedDlls[name], ['relativePath', 'artifact'], `machine.shippedDlls.${name}`);
    if (shippedDlls[name].relativePath !== relativePath) fail(`machine.shippedDlls.${name}.relativePath is wrong.`);
    result[name] = {
      relativePath,
      artifact: verifyIdentity(shippedDlls[name].artifact, `machine.shippedDlls.${name}.artifact`),
    };
  }
  return result;
}

function computeFingerprint(files) {
  const serialized = files
    .map((entry) => `${entry.path}\t${entry.bytes}\t${entry.sha256}\n`)
    .join('');
  return crypto.createHash('sha256').update(serialized, 'utf8').digest('hex');
}

function verifyProvenance(provenance, installer, shipped) {
  assertExactKeys(provenance, ['artifact'], 'machine.provenance');
  const artifact = verifyIdentity(provenance.artifact, 'machine.provenance.artifact');
  if (!samePath(artifact.path, `${installer.artifact.path}.provenance.json`)) {
    fail('NSIS provenance sidecar must be adjacent to the final installer.');
  }
  const sidecar = readJson(artifact.path, 'Windows NSIS provenance sidecar');
  assertExactKeys(sidecar, ['schemaVersion', 'target', 'productName', 'version', 'installer', 'inputFingerprint'], 'provenance');
  if (sidecar.schemaVersion !== 1 || sidecar.target !== NSIS_TARGET) fail('NSIS provenance target/schema mismatch.');
  assertString(sidecar.productName, 'provenance.productName');
  assertString(sidecar.version, 'provenance.version');
  assertExactKeys(sidecar.installer, ['fileName', 'bytes', 'sha256'], 'provenance.installer');
  if (
    sidecar.installer.fileName !== installer.fileName || sidecar.installer.bytes !== installer.artifact.bytes ||
    sidecar.installer.sha256 !== installer.artifact.sha256
  ) fail('NSIS provenance installer identity does not match the final installer.');
  assertExactKeys(sidecar.inputFingerprint, ['algorithm', 'value', 'files'], 'provenance.inputFingerprint');
  if (sidecar.inputFingerprint.algorithm !== 'sha256' || !Array.isArray(sidecar.inputFingerprint.files) || sidecar.inputFingerprint.files.length < 1) {
    fail('NSIS provenance input fingerprint is incomplete.');
  }
  assertHex(sidecar.inputFingerprint.value, 'provenance.inputFingerprint.value', 64);
  const seen = new Set();
  const files = sidecar.inputFingerprint.files.map((entry, index) => {
    assertExactKeys(entry, ['path', 'bytes', 'sha256'], `provenance.inputFingerprint.files[${index}]`);
    assertString(entry.path, `provenance.inputFingerprint.files[${index}].path`);
    if (seen.has(entry.path)) fail(`provenance input fingerprint contains duplicate ${entry.path}.`);
    seen.add(entry.path);
    if (!Number.isInteger(entry.bytes) || entry.bytes < 1) fail(`provenance input ${entry.path} has invalid bytes.`);
    assertHex(entry.sha256, `provenance input ${entry.path}.sha256`, 64);
    return entry;
  }).sort((left, right) => left.path.localeCompare(right.path, 'en'));
  if (computeFingerprint(files) !== sidecar.inputFingerprint.value) fail('NSIS input fingerprint digest is malformed.');
  const byPath = new Map(files.map((entry) => [entry.path.replaceAll('\\', '/'), entry]));
  for (const [name, relativePath] of [['generic', GENERIC_RELATIVE_PATH], ['qpa', QPA_RELATIVE_PATH]]) {
    const entry = byPath.get(relativePath);
    if (!entry || entry.bytes !== shipped[name].artifact.bytes || entry.sha256 !== shipped[name].artifact.sha256) {
      fail(`NSIS provenance does not bind shipped ${name} DLL bytes.`);
    }
  }
  return { artifact, sidecar };
}

function verifyRunner(runner) {
  assertExactKeys(runner, ['os', 'arch', 'runnerOs', 'runnerArch', 'imageOs', 'imageVersion', 'node', 'npm', 'rustc', 'cargo', 'cmake', 'powershell'], 'machine.runner');
  if (runner.os !== 'win32' || runner.arch !== 'x64') fail('acceptance runner must be Windows x64.');
  for (const field of ['runnerOs', 'runnerArch', 'imageOs', 'imageVersion', 'node', 'npm', 'rustc', 'cargo', 'cmake', 'powershell']) {
    assertString(runner[field], `machine.runner.${field}`);
  }
  if (!/^\d+\.\d+\.\d+$/.test(runner.cmake)) fail('machine.runner.cmake must be a concrete version.');
  return { ...runner };
}

function verifyInventory(value, point, executable, shipped, root) {
  const { value: inventory } = verifyJsonIdentity(value.inventory, `matrix.${point.key}.inventory`, root);
  assertExactKeys(
    inventory,
    ['schema', 'language', 'scenario', 'ordinal', 'pid', 'windowHandle', 'executableSha256', 'genericPluginSha256', 'qpaProxySha256', 'translationSource'],
    `matrix.${point.key}.inventory`
  );
  if (
    inventory.schema !== 'cavalry-i18n.windows-live-inventory/v1' || inventory.language !== point.language ||
    inventory.scenario !== point.scenario || inventory.ordinal !== point.ordinal || inventory.pid !== point.pid ||
    !/^[1-9]\d*$/.test(String(inventory.windowHandle)) || inventory.executableSha256 !== executable.sha256 ||
    inventory.genericPluginSha256 !== shipped.generic.artifact.sha256 || inventory.qpaProxySha256 !== shipped.qpa.artifact.sha256 ||
    inventory.translationSource !== 'packaged-nsis'
  ) {
    fail(`live inventory does not bind the exact ${point.key} process/runtime.`);
  }
  return inventory;
}

function verifyMatrix(matrix, target, shipped, session) {
  assertExactKeys(matrix, ['profile', 'languages', 'scenarios', 'points'], 'machine.matrix');
  const profile = MATRIX_PROFILES[matrix.profile];
  if (!profile || JSON.stringify(matrix.languages) !== JSON.stringify(LANGUAGES) || JSON.stringify(matrix.scenarios) !== JSON.stringify(profile.scenarios)) {
    fail('Windows acceptance matrix profile/languages/scenarios mismatch.');
  }
  const expectedPoints = profile.points;
  if (!Array.isArray(matrix.points) || matrix.points.length !== expectedPoints.length) fail(`Windows acceptance requires exactly ${expectedPoints.length} screenshot points for ${matrix.profile}.`);
  const byKey = new Map(expectedPoints.map((point) => [point.key, point]));
  const seen = new Set();
  const points = [];
  for (const [index, point] of matrix.points.entries()) {
    assertExactKeys(point, ['key', 'language', 'scenario', 'ordinal', 'screenshot', 'inventory', 'pid', 'startToken', 'executableSha256', 'genericPluginSha256', 'qpaProxySha256', 'interactionEvidence'], `machine.matrix.points[${index}]`);
    const expected = byKey.get(point.key);
    if (!expected || seen.has(point.key) || point.language !== expected.language || point.scenario !== expected.scenario || point.ordinal !== expected.ordinal) {
      fail(`Windows acceptance matrix point ${point.key || '<missing>'} is duplicate or unexpected.`);
    }
    seen.add(point.key);
    if (!Number.isInteger(point.pid) || point.pid < 1 || !/^[^\s]+$/.test(point.startToken)) fail(`matrix.${point.key} lacks a concrete process identity.`);
    if (point.executableSha256 !== target.executable.sha256 || point.genericPluginSha256 !== shipped.generic.artifact.sha256 || point.qpaProxySha256 !== shipped.qpa.artifact.sha256) {
      fail(`matrix.${point.key} does not bind the final executable/DLL identities.`);
    }
    assertString(point.interactionEvidence, `matrix.${point.key}.interactionEvidence`);
    if (!/exact[- ]pid/i.test(point.interactionEvidence) || !/hwnd/i.test(point.interactionEvidence)) fail(`matrix.${point.key} lacks exact PID/HWND interaction evidence.`);
    verifyPngIdentity(point.screenshot, `matrix.${point.key}.screenshot`, session.root);
    verifyInventory(point, point, target.executable, shipped, session.root);
    points.push({ ...point, screenshot: verifyIdentity(point.screenshot, `matrix.${point.key}.screenshot`, session.root), inventory: verifyIdentity(point.inventory, `matrix.${point.key}.inventory`, session.root) });
  }
  if (seen.size !== expectedPoints.length) fail('Windows acceptance matrix is incomplete.');
  return { profile: matrix.profile, points, pointKeys: expectedPoints.map((point) => point.key) };
}

function verifyManualReview(review, matrixPoints, session) {
  assertExactKeys(review, ['schema', 'status', 'reviewedAtUtc', 'reviewer', 'points'], 'manualReview');
  if (review.schema !== REVIEW_SCHEMA || review.status !== 'APPROVED') fail('Windows manual review is not APPROVED.');
  assertTimestamp(review.reviewedAtUtc, 'manualReview.reviewedAtUtc');
  assertString(review.reviewer, 'manualReview.reviewer');
  if (!Array.isArray(review.points) || review.points.length !== matrixPoints.length) fail('Windows manual review point count is incomplete.');
  const expected = new Map(matrixPoints.map((point) => [point.key, point]));
  const seen = new Set();
  for (const [index, point] of review.points.entries()) {
    assertExactKeys(point, ['key', 'status', 'screenshot', 'inventory'], `manualReview.points[${index}]`);
    const source = expected.get(point.key);
    if (!source || seen.has(point.key) || point.status !== 'APPROVED') fail(`manual review point ${point.key || '<missing>'} is not bound/approved.`);
    seen.add(point.key);
    const screenshot = verifyIdentity(point.screenshot, `manualReview.${point.key}.screenshot`, session.root);
    const inventory = verifyIdentity(point.inventory, `manualReview.${point.key}.inventory`, session.root);
    if (!sameIdentity(screenshot, source.screenshot) || !sameIdentity(inventory, source.inventory)) fail(`manual review ${point.key} does not cover exact machine evidence.`);
  }
  if (seen.size !== matrixPoints.length) fail('manual review does not cover every Windows matrix point.');
}

function verifyFinal(finalRecord, session, machineIdentity, reviewIdentity, pointKeys) {
  assertExactKeys(finalRecord, ['schema', 'status', 'sealedAtUtc', 'machine', 'review', 'points'], 'finalRecord');
  const expectedStatus = `PASS-${pointKeys.length}-OF-${pointKeys.length}`;
  if (finalRecord.schema !== FINAL_SCHEMA || finalRecord.status !== expectedStatus) fail(`Windows final record is not ${expectedStatus}.`);
  assertTimestamp(finalRecord.sealedAtUtc, 'finalRecord.sealedAtUtc');
  const machine = verifyIdentity(finalRecord.machine, 'finalRecord.machine', session.root, machineIdentity.path);
  const review = verifyIdentity(finalRecord.review, 'finalRecord.review', session.root, reviewIdentity.path);
  if (!sameIdentity(machine, machineIdentity) || !sameIdentity(review, reviewIdentity)) fail('Windows final record references drifted machine/review records.');
  if (!Array.isArray(finalRecord.points) || JSON.stringify([...finalRecord.points].sort()) !== JSON.stringify([...pointKeys].sort())) fail('Windows final record point set is incomplete.');
}

function prepareWindowsAcceptanceSession(sessionInput, options = {}) {
  const session = resolveSession(sessionInput);
  const machinePath = path.join(session.root, 'windows-machine-record.json');
  const machineFile = regularFile(machinePath, 'machine record', session.root);
  const machineIdentity = verifyIdentity({ path: machinePath, bytes: machineFile.stat.size, sha256: sha256File(machinePath) }, 'machine record', session.root);
  const machine = readJson(machinePath, 'machine record', session.root);
  assertExactKeys(machine, ['schema', 'status', 'createdAtUtc', 'sessionId', 'releaseTag', 'repository', 'target', 'installer', 'provenance', 'shippedDlls', 'runner', 'matrix'], 'machine');
  if (machine.schema !== MACHINE_SCHEMA || machine.status !== 'MACHINE-COMPLETE-MANUAL-PENDING' || machine.sessionId !== session.sessionId) fail('Windows machine record schema/status/session mismatch.');
  assertTimestamp(machine.createdAtUtc, 'machine.createdAtUtc');
  if (!/^cavalry-2\.7\.2-p[0-9]+$/.test(machine.releaseTag)) fail('Windows machine record releaseTag is invalid.');
  if (options.expectedTag && machine.releaseTag !== options.expectedTag) fail(`Windows machine record releaseTag ${machine.releaseTag} != ${options.expectedTag}.`);
  const sourceCommitSha = verifyRepository(machine.repository, options);
  const target = verifyTarget(machine.target, session);
  const installer = verifyInstaller(machine.installer);
  const shippedDlls = verifyShippedDlls(machine.shippedDlls);
  const provenance = verifyProvenance(machine.provenance, installer, shippedDlls);
  const runner = verifyRunner(machine.runner);
  const matrix = verifyMatrix(machine.matrix, target, shippedDlls, session);
  return {
    session,
    machinePath,
    machineIdentity,
    machine,
    sourceCommitSha,
    target,
    installer,
    shippedDlls,
    provenance,
    runner,
    matrix,
  };
}

function verifyWindowsAcceptanceSession(sessionInput, options = {}) {
  const prepared = prepareWindowsAcceptanceSession(sessionInput, options);
  const {
    session,
    machineIdentity,
    machine,
    sourceCommitSha,
    target,
    installer,
    shippedDlls,
    provenance,
    runner,
    matrix,
  } = prepared;
  const reviewPath = path.join(session.root, 'windows-manual-review.json');
  const finalPath = path.join(session.root, 'windows-final-record.json');
  const reviewFile = regularFile(reviewPath, 'manual review record', session.root);
  const finalFile = regularFile(finalPath, 'final record', session.root);
  const reviewIdentity = verifyIdentity({ path: reviewPath, bytes: reviewFile.stat.size, sha256: sha256File(reviewPath) }, 'manual review record', session.root);
  const finalIdentity = verifyIdentity({ path: finalPath, bytes: finalFile.stat.size, sha256: sha256File(finalPath) }, 'final record', session.root);
  const review = readJson(reviewPath, 'manual review record', session.root);
  const finalRecord = readJson(finalPath, 'final record', session.root);
  const matrixPoints = matrix.points;
  verifyManualReview(review, matrixPoints, session);
  verifyFinal(finalRecord, session, machineIdentity, reviewIdentity, matrix.pointKeys);
  const canonicalSession = {
    sessionId: session.sessionId,
    releaseTag: machine.releaseTag,
    sourceCommitSha,
    target: { cavalryVersion: machine.target.cavalryVersion, qtVersion: machine.target.qtVersion, architecture: machine.target.architecture },
    finalRecord,
    machineRecord: machineIdentity,
    manualReview: reviewIdentity,
    installer: installer.artifact,
    provenance: provenance.artifact,
    shippedDlls: {
      generic: { relativePath: shippedDlls.generic.relativePath, ...shippedDlls.generic.artifact },
      qpa: { relativePath: shippedDlls.qpa.relativePath, ...shippedDlls.qpa.artifact },
    },
    runner,
    sessionSentinel: session.sentinel,
  };
  return {
    sessionId: session.sessionId,
    releaseTag: machine.releaseTag,
    sourceCommitSha,
    target: canonicalSession.target,
    result: `PASS-${matrixPoints.length}-OF-${matrixPoints.length}`,
    matrix: `${matrixPoints.length}-screenshot/${matrixPoints.length}-point`,
    profile: matrix.profile,
    finalRecord: finalIdentity,
    machineRecord: machineIdentity,
    manualReview: reviewIdentity,
    sessionSentinel: session.sentinel,
    installer: installer,
    provenance,
    shippedDlls,
    runner,
    clone: target,
    sessionManifestSha256: crypto.createHash('sha256').update(JSON.stringify(canonicalSession), 'utf8').digest('hex'),
  };
}

function validateWindowsAcceptanceRecord(record) {
  assertExactKeys(record, ['schemaVersion', 'kind', 'tag', 'result', 'matrix', 'profile', 'producer', 'sessionId', 'sourceCommitSha', 'targetCavalryVersion', 'qtVersion', 'architecture', 'finalRecord', 'machineRecord', 'manualReview', 'sessionSentinel', 'sessionManifestSha256', 'installer', 'provenance', 'shippedDlls', 'runner'], 'windowsAcceptance');
  const profile = MATRIX_PROFILES[record.profile];
  const expectedResult = profile ? `PASS-${profile.points.length}-OF-${profile.points.length}` : null;
  const expectedMatrix = profile ? `${profile.points.length}-screenshot/${profile.points.length}-point` : null;
  if (record.schemaVersion !== SUMMARY_SCHEMA_VERSION || record.kind !== 'WindowsReleaseAcceptance' || record.producer !== 'tools/windows-acceptance' || !profile || record.result !== expectedResult || record.matrix !== expectedMatrix) fail('Windows acceptance summary schema/result mismatch.');
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(record.sessionId)) fail('Windows acceptance summary sessionId is invalid.');
  if (!/^cavalry-2\.7\.2-p[0-9]+$/.test(record.tag)) fail('Windows acceptance summary tag is invalid.');
  assertHex(record.sourceCommitSha, 'windowsAcceptance.sourceCommitSha', 40);
  if (record.targetCavalryVersion !== '2.7.2' || record.qtVersion !== '6.6.3' || record.architecture !== 'x86_64') fail('Windows acceptance summary target mismatch.');
  for (const field of ['finalRecord', 'machineRecord', 'manualReview', 'sessionSentinel']) {
    assertExactKeys(record[field], ['bytes', 'sha256'], `windowsAcceptance.${field}`);
    if (!Number.isInteger(record[field].bytes) || record[field].bytes < 1) fail(`windowsAcceptance.${field}.bytes is invalid.`);
    assertHex(record[field].sha256, `windowsAcceptance.${field}.sha256`, 64);
  }
  assertHex(record.sessionManifestSha256, 'windowsAcceptance.sessionManifestSha256', 64);
  for (const field of ['installer', 'provenance']) {
    assertExactKeys(record[field], ['fileName', 'bytes', 'sha256'], `windowsAcceptance.${field}`);
    assertString(record[field].fileName, `windowsAcceptance.${field}.fileName`);
    if (!Number.isInteger(record[field].bytes) || record[field].bytes < 1) fail(`windowsAcceptance.${field}.bytes is invalid.`);
    assertHex(record[field].sha256, `windowsAcceptance.${field}.sha256`, 64);
  }
  if (!/x64-setup\.exe$/i.test(record.installer.fileName) || record.provenance.fileName !== `${record.installer.fileName}.provenance.json`) {
    fail('windowsAcceptance installer/provenance filenames are not adjacent NSIS outputs.');
  }
  assertExactKeys(record.shippedDlls, ['generic', 'qpa'], 'windowsAcceptance.shippedDlls');
  for (const [name, relativePath] of [['generic', GENERIC_RELATIVE_PATH], ['qpa', QPA_RELATIVE_PATH]]) {
    assertExactKeys(record.shippedDlls[name], ['relativePath', 'bytes', 'sha256'], `windowsAcceptance.shippedDlls.${name}`);
    if (record.shippedDlls[name].relativePath !== relativePath) fail(`windowsAcceptance.shippedDlls.${name}.relativePath mismatch.`);
    if (!Number.isInteger(record.shippedDlls[name].bytes) || record.shippedDlls[name].bytes < 1) fail(`windowsAcceptance.shippedDlls.${name}.bytes is invalid.`);
    assertHex(record.shippedDlls[name].sha256, `windowsAcceptance.shippedDlls.${name}.sha256`, 64);
  }
  verifyRunner(record.runner);
  return record;
}

function toWindowsAcceptanceRecord(summary) {
  const record = {
    schemaVersion: SUMMARY_SCHEMA_VERSION,
    kind: 'WindowsReleaseAcceptance',
    tag: summary.releaseTag,
    result: summary.result,
    matrix: summary.matrix,
    profile: summary.profile,
    producer: 'tools/windows-acceptance',
    sessionId: summary.sessionId,
    sourceCommitSha: summary.sourceCommitSha,
    targetCavalryVersion: summary.target.cavalryVersion,
    qtVersion: summary.target.qtVersion,
    architecture: summary.target.architecture,
    finalRecord: { bytes: summary.finalRecord.bytes, sha256: summary.finalRecord.sha256 },
    machineRecord: { bytes: summary.machineRecord.bytes, sha256: summary.machineRecord.sha256 },
    manualReview: { bytes: summary.manualReview.bytes, sha256: summary.manualReview.sha256 },
    sessionSentinel: { bytes: summary.sessionSentinel.bytes, sha256: summary.sessionSentinel.sha256 },
    sessionManifestSha256: summary.sessionManifestSha256,
    installer: { fileName: summary.installer.fileName, bytes: summary.installer.artifact.bytes, sha256: summary.installer.artifact.sha256 },
    provenance: { fileName: path.basename(summary.provenance.artifact.path), bytes: summary.provenance.artifact.bytes, sha256: summary.provenance.artifact.sha256 },
    shippedDlls: {
      generic: { relativePath: summary.shippedDlls.generic.relativePath, bytes: summary.shippedDlls.generic.artifact.bytes, sha256: summary.shippedDlls.generic.artifact.sha256 },
      qpa: { relativePath: summary.shippedDlls.qpa.relativePath, bytes: summary.shippedDlls.qpa.artifact.bytes, sha256: summary.shippedDlls.qpa.artifact.sha256 },
    },
    runner: summary.runner,
  };
  return validateWindowsAcceptanceRecord(record);
}

module.exports = {
  CLONE_SENTINEL,
  EXPECTED_POINTS,
  EXPECTED_POINT_KEYS,
  GENERIC_RELATIVE_PATH,
  LANGUAGES,
  MATRIX_PROFILES,
  NSIS_TARGET,
  QPA_RELATIVE_PATH,
  SCENARIOS,
  SESSION_SENTINEL,
  SESSION_SENTINEL_MAGIC,
  toWindowsAcceptanceRecord,
  prepareWindowsAcceptanceSession,
  validateWindowsAcceptanceRecord,
  verifyWindowsAcceptanceSession,
};
