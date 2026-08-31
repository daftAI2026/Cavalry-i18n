#!/usr/bin/env node
/**
 * [INPUT]: 依赖 session_contract 的数据合同、精确 packaged Switcher/Cavalry app、显式仓库外 session、window_probe.swift 与 macOS codesign/screencapture。
 * [OUTPUT]: 对外提供 initialize/checkpoint/seal/verify 四动作；冻结 clean detached source、bundle/host/场景顺序，并记录真正空安装、WindowServer point/backing-scale 与仅 Switcher 自有窗口 PNG。
 * [POS]: packaged App Management handoff 的现场证据 producer；initialize 先证明当前用户 state.json、语言 marker 与 injector 均不存在，随后才允许人工权限链；不操作 System Settings、不读写 TCC。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const cp = require('node:child_process');
const {
  directory, regular, rejectInside, resolveNewSession, strictChild,
} = require('../macos-acceptance/path_safety');
const {
  binaryIdentity, freezeIdentity, identity, verifyIdentity,
} = require('../macos-acceptance/artifact_identity');
const {
  collectMacHostIdentity,
} = require('../macos-acceptance/host_identity');

const ROOT = path.resolve(__dirname, '..', '..');
const PROBE = path.join(__dirname, 'window_probe.swift');
const MANIFEST = 'manifest.json';
const SEAL = 'seal.json';
const {
  APP_DATA_DIRECTORY,
  BOOLEAN_ARGUMENTS,
  CAVALRY_INJECTOR,
  CAVALRY_LANGUAGE_MARKER,
  CAVALRY_RUNTIME_EXECUTABLE,
  CHECKPOINT_SCHEMA,
  EXPECTED_FIELDS,
  MANIFEST_SCHEMA,
  OBSERVATION_CONTRACT,
  PERMISSION_BLOCKED_ASSERTION,
  PHASES,
  READ_ONLY_SCENARIO,
  RETRY_VERIFICATION_SCHEMA,
  SCENARIOS,
  SEAL_SCHEMA,
  SUPPORTED_LANGUAGES,
  VALUE_ARGUMENTS,
  expectedContractFromArgs,
  isReadOnlyScenario,
  manifestSequence,
  scenarioPhases,
  validateCheckpointRecord,
  validateExpectedContract,
  validateFreshInstallationProof,
  validateLowerHex,
  validateManifestContract,
  validateRetryVerification,
  validateStatePayload,
} = require('./session_contract');

function fail(message) { throw new Error(message); }

function parseArgs(argv) {
  const result = {};
  for (let index = 2; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) fail(`Unexpected argument: ${token}`);
    const key = token.slice(2);
    if (Object.prototype.hasOwnProperty.call(result, key)) fail(`Duplicate argument: --${key}`);
    if (BOOLEAN_ARGUMENTS.has(key)) {
      result[key] = true;
      continue;
    }
    if (!VALUE_ARGUMENTS.has(key)) fail(`Unknown argument: ${token}`);
    const value = argv[index + 1];
    if (value === undefined || value.startsWith('--')) fail(`${token} requires a value`);
    result[key] = value;
    index += 1;
  }
  return result;
}
function exec(file, args) {
  const result = cp.spawnSync(file, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  if (result.status !== 0) fail(`${path.basename(file)} failed: ${(result.stderr || result.stdout).trim()}`);
  return result.stdout.trim();
}
function writeExclusive(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx', mode: 0o444 });
  return identity(file);
}
function readJson(file) {
  regular(file);
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function currentUserIdentity() {
  if (typeof process.getuid !== 'function') fail('macOS UID inspection is unavailable');
  const uid = process.getuid();
  const home = path.resolve(os.homedir());
  if (!Number.isInteger(uid) || uid < 0 || !home || !path.isAbsolute(home)) {
    fail('Current macOS user identity is invalid');
  }
  directory(home, 'Current user home');
  if (fs.realpathSync(home) !== home) fail(`Current user home must be canonical: ${home}`);
  const homeOwnerUid = ownerUid(home, 'Current user home');
  if (homeOwnerUid !== uid) fail(`Current user home is not owned by UID ${uid}: ${home}`);
  return { uid, home };
}

function ownerUid(file, label) {
  const stat = fs.lstatSync(file);
  if (stat.isSymbolicLink()) fail(`${label} must not be a symlink: ${file}`);
  if (!Number.isInteger(stat.uid)) fail(`${label} has no POSIX owner UID: ${file}`);
  return stat.uid;
}

function userCavalryPath(user) {
  return path.join(user.home, 'Applications', 'Cavalry.app');
}

function assertUserCavalryPath(appPath, user) {
  const expected = userCavalryPath(user);
  const resolved = path.resolve(appPath);
  if (resolved !== expected) {
    fail(`Cavalry app must be exactly ${expected}, got ${resolved}`);
  }
  directory(resolved, 'Cavalry app');
  if (fs.realpathSync(resolved) !== expected) {
    fail(`Cavalry app must be a canonical user-domain bundle: ${expected}`);
  }
  return expected;
}

function assertOwnedPaths(paths, uid, label) {
  const ownership = {};
  for (const [name, file] of Object.entries(paths)) {
    const actualUid = ownerUid(file, `${label} ${name}`);
    if (actualUid !== uid) fail(`${label} ${name} must be owned by current UID ${uid}: ${file}`);
    ownership[`${name}Uid`] = actualUid;
  }
  return ownership;
}

function applicationSupportStatePath(user) {
  if (process.env.CAVALRY_I18N_STATE_DIR) {
    fail('R5 must use the current user Application Support state.json; state override is forbidden');
  }
  return path.join(user.home, 'Library', 'Application Support', APP_DATA_DIRECTORY, 'state.json');
}

function assertAbsent(file, label) {
  try {
    fs.lstatSync(file);
  } catch (error) {
    if (error && error.code === 'ENOENT') return;
    throw error;
  }
  fail(`${label} must be absent before initialization: ${file}`);
}

function assertFreshInstallation(cavalry, statePath) {
  const markerPath = path.join(cavalry.path, 'Contents', 'Resources', CAVALRY_LANGUAGE_MARKER);
  const injectorPath = path.join(cavalry.path, 'Contents', 'Frameworks', CAVALRY_INJECTOR);
  assertAbsent(statePath, 'Current-user state.json');
  assertAbsent(markerPath, 'Cavalry language marker');
  assertAbsent(injectorPath, 'Cavalry translator injector');
  return {
    state: { path: statePath, absent: true },
    marker: { path: markerPath, absent: true },
    injector: { path: injectorPath, absent: true },
    vendor: {
      codesign: cavalry.codesign,
      teamId: cavalry.vendorTeamId,
      executableSha256: cavalry.executable.sha256,
      runtimeSha256: cavalry.runtimeExecutable.sha256,
    },
  };
}

function gitSymbolicHead() {
  const result = cp.spawnSync('/usr/bin/git', ['-C', ROOT, 'symbolic-ref', '--quiet', '--short', 'HEAD'], {
    encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.status === 0) fail(`Source tree must be detached, got branch ${result.stdout.trim()}`);
  if (result.status !== 1) fail(`Could not prove detached source tree: ${(result.stderr || '').trim()}`);
}

function repositoryIdentity(expectedHead = null) {
  const root = fs.realpathSync(ROOT);
  directory(root, 'Source tree');
  const gitRoot = fs.realpathSync(exec('/usr/bin/git', ['-C', ROOT, 'rev-parse', '--show-toplevel']));
  if (gitRoot !== root) fail(`Git source root drifted: expected ${root}, got ${gitRoot}`);
  const status = exec('/usr/bin/git', ['-C', ROOT, 'status', '--porcelain=v1', '--untracked-files=all']);
  if (status) fail(`Source tree must be clean; found: ${status}`);
  gitSymbolicHead();
  const head = exec('/usr/bin/git', ['-C', ROOT, 'rev-parse', '--verify', 'HEAD^{commit}']);
  validateLowerHex(head, 40, 'source commit');
  if (expectedHead !== null && head !== expectedHead) {
    fail(`Source commit drifted: expected ${expectedHead}, got ${head}`);
  }
  return {
    root,
    head,
    expectedHead,
    clean: true,
    detached: true,
    sourceTreeOwnerUid: ownerUid(root, 'Source tree'),
    status: [],
  };
}

function verifyRepositoryLock(repository, user = null) {
  if (!repository || repository.clean !== true || repository.detached !== true ||
      !Array.isArray(repository.status) || repository.status.length !== 0) {
    fail('Manifest does not contain a clean detached source lock');
  }
  const current = repositoryIdentity(repository.head);
  if (current.root !== repository.root || current.sourceTreeOwnerUid !== repository.sourceTreeOwnerUid) {
    fail('Source tree identity drifted');
  }
  if (repository.expectedHead !== null && repository.expectedHead !== repository.head) {
    fail('Manifest exact source commit contract drifted');
  }
  if (user && current.sourceTreeOwnerUid === user.uid) {
    fail(`Source tree owner must differ from current UID ${user.uid}`);
  }
  return current;
}
function recordedPhases(session, sequence) {
  const prefix = [];
  let gap = false;
  for (const phase of sequence) {
    const exists = fs.existsSync(path.join(session, `checkpoint-${phase}`));
    if (exists && gap) fail(`Scenario checkpoint order is invalid at ${phase}`);
    if (exists) prefix.push(phase);
    else gap = true;
  }
  const allowed = new Set(sequence.map((phase) => `checkpoint-${phase}`));
  const unknown = fs.readdirSync(session).filter((name) =>
    (name.startsWith('checkpoint-') && !allowed.has(name)) || name.startsWith('.checkpoint-'));
  if (unknown.length > 0) fail(`Unexpected checkpoint directories: ${unknown.join(', ')}`);
  return prefix;
}
function plistValue(appPath, key) {
  return exec('/usr/libexec/PlistBuddy', ['-c', `Print :${key}`, path.join(appPath, 'Contents', 'Info.plist')]);
}

function strictCodesign(appPath, expectedKind) {
  const result = cp.spawnSync('/usr/bin/codesign', ['--verify', '--deep', '--strict', appPath], {
    encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.status !== 0) fail(`${expectedKind} strict codesign failed: ${(result.stderr || result.stdout).trim()}`);
  return { path: appPath, strict: true };
}

function readTeamIdentifier(appPath, expectedKind, required) {
  const result = cp.spawnSync('/usr/bin/codesign', ['--display', '--verbose=4', appPath], {
    encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.status !== 0) {
    if (required) fail(`${expectedKind} Team ID read failed: ${(result.stderr || result.stdout).trim()}`);
    return null;
  }
  const output = `${result.stderr || ''}\n${result.stdout || ''}`;
  const value = (output.match(/^TeamIdentifier=([^\s]+)$/m) || [])[1] || null;
  if (!value || value === 'not') {
    if (required) fail(`${expectedKind} has no concrete vendor Team ID`);
    return null;
  }
  return value;
}

function appIdentity(appPath, expectedKind, runtimeExecutableName = null, options = {}) {
  const resolved = path.resolve(appPath);
  directory(resolved, expectedKind);
  if (path.extname(resolved) !== '.app' || fs.realpathSync(resolved) !== resolved) {
    fail(`${expectedKind} must be a canonical non-symlink .app: ${resolved}`);
  }
  const executable = path.join(resolved, 'Contents', 'MacOS', plistValue(resolved, 'CFBundleExecutable'));
  regular(executable);
  strictChild(resolved, executable, `${expectedKind} executable`);
  const codesign = strictCodesign(resolved, expectedKind);
  const result = {
    path: resolved,
    executableName: path.basename(executable),
    bundleIdentifier: plistValue(resolved, 'CFBundleIdentifier'),
    version: plistValue(resolved, 'CFBundleShortVersionString'),
    infoPlist: identity(path.join(resolved, 'Contents', 'Info.plist')),
    executable: binaryIdentity(executable),
    codesign,
  };
  if (runtimeExecutableName) {
    const runtimeExecutable = path.join(resolved, 'Contents', 'MacOS', runtimeExecutableName);
    regular(runtimeExecutable);
    strictChild(resolved, runtimeExecutable, `${expectedKind} runtime executable`);
    result.runtimeExecutable = binaryIdentity(runtimeExecutable);
    result.vendorTeamId = readTeamIdentifier(
      resolved,
      expectedKind,
      options.requireVendorTeamId === true,
    );
  }
  return result;
}

function assertExpectedIdentities(switcher, cavalry, expected) {
  if (expected.switcherExecutableSha256 !== null &&
      switcher.executable.sha256 !== expected.switcherExecutableSha256) {
    fail(`Switcher executable does not match --expected-switcher-executable-sha256: ${switcher.executable.path}`);
  }
  if (expected.cavalryExecutableSha256 !== null &&
      cavalry.executable.sha256 !== expected.cavalryExecutableSha256) {
    fail(`Cavalry executable does not match --expected-cavalry-executable-sha256: ${cavalry.executable.path}`);
  }
  if (expected.cavalryRuntimeSha256 !== null &&
      cavalry.runtimeExecutable.sha256 !== expected.cavalryRuntimeSha256) {
    fail(`Cavalry runtime does not match --expected-cavalry-runtime-sha256: ${cavalry.runtimeExecutable.path}`);
  }
  if (expected.vendorTeamId !== null && cavalry.vendorTeamId !== expected.vendorTeamId) {
    fail(`Cavalry vendor Team ID does not match --expected-vendor-team-id: ${cavalry.vendorTeamId || '<missing>'}`);
  }
}

function verifyCurrentUserManifest(manifest) {
  const user = currentUserIdentity();
  if (user.uid !== manifest.user.uid || user.home !== manifest.user.home) {
    fail('Current user identity drifted from the manifest');
  }
  return user;
}

function verifyUserCavalry(manifest, user) {
  assertUserCavalryPath(manifest.cavalry.path, user);
  return assertOwnedPaths({
    bundle: manifest.cavalry.path,
    executable: manifest.cavalry.executable.path,
    runtimeExecutable: manifest.cavalry.runtimeExecutable.path,
  }, user.uid, 'Cavalry');
}

function verifyRetryOutcome(manifest) {
  const user = verifyCurrentUserManifest(manifest);
  const expected = manifest.expected;
  const ownership = verifyUserCavalry(manifest, user);
  const markerPath = path.join(manifest.cavalry.path, 'Contents', 'Resources', CAVALRY_LANGUAGE_MARKER);
  regular(markerPath);
  const marker = fs.readFileSync(markerPath, 'utf8');
  if (marker !== `${expected.language}\n`) {
    fail(`Cavalry language marker does not match expected language: ${marker.trim()}`);
  }
  const codesign = strictCodesign(manifest.cavalry.path, 'Cavalry app');
  const statePath = applicationSupportStatePath(user);
  if (statePath !== manifest.user.applicationSupportStatePath) {
    fail('Current user Application Support state path drifted from the manifest');
  }
  const stateFileOwnerUid = ownerUid(statePath, 'state.json');
  if (stateFileOwnerUid !== user.uid) fail(`state.json must be owned by current UID ${user.uid}`);
  const state = validateStatePayload(readJson(statePath), manifest.user.cavalryAppPath, expected.language);
  return {
    schema: RETRY_VERIFICATION_SCHEMA,
    expectedLanguage: expected.language,
    ownership,
    marker: { path: markerPath, language: expected.language, identity: identity(markerPath) },
    codesign,
    state: { path: statePath, ownerUid: stateFileOwnerUid, ...state },
  };
}

function initialize(args) {
  if (!args['session-dir'] || !args['switcher-app'] || !args['cavalry-app'] || !args.scenario) {
    fail('--initialize requires --session-dir, --switcher-app, --cavalry-app and --scenario');
  }
  const scenario = args.scenario;
  const sequence = scenarioPhases(scenario);
  const readOnly = isReadOnlyScenario(scenario);
  const expected = expectedContractFromArgs(args, scenario);
  const user = readOnly ? null : currentUserIdentity();
  const repository = repositoryIdentity(expected.sourceCommit);
  if (!readOnly && repository.sourceTreeOwnerUid === user.uid) {
    fail(`Source tree owner must differ from current UID ${user.uid}`);
  }
  if (!readOnly) assertUserCavalryPath(args['cavalry-app'], user);
  const switcher = appIdentity(args['switcher-app'], 'Switcher app');
  const cavalry = appIdentity(
    args['cavalry-app'],
    'Cavalry app',
    CAVALRY_RUNTIME_EXECUTABLE,
    { requireVendorTeamId: expected.vendorTeamId !== null },
  );
  if (cavalry.version !== '2.7.2') fail(`Cavalry 2.7.2 required, got ${cavalry.version}`);
  if (!readOnly && cavalry.executableName !== CAVALRY_RUNTIME_EXECUTABLE) {
    fail(`Cavalry source executable must be ${CAVALRY_RUNTIME_EXECUTABLE}, got ${cavalry.executableName}`);
  }
  if (!readOnly) {
    cavalry.ownership = assertOwnedPaths({
      bundle: cavalry.path,
      executable: cavalry.executable.path,
      runtimeExecutable: cavalry.runtimeExecutable.path,
    }, user.uid, 'Cavalry');
  }
  assertExpectedIdentities(switcher, cavalry, expected);
  const applicationStatePath = user ? applicationSupportStatePath(user) : null;
  const freshInstallation = readOnly ? null : assertFreshInstallation(cavalry, applicationStatePath);
  const session = resolveNewSession(args['session-dir'], [ROOT, switcher.path, cavalry.path]);
  fs.mkdirSync(session, { mode: 0o700 });
  const manifest = {
    schema: MANIFEST_SCHEMA,
    createdAt: new Date().toISOString(),
    scenario,
    sequence,
    expected,
    repository,
    user: user ? {
      uid: user.uid,
      home: user.home,
      cavalryAppPath: cavalry.path,
      applicationSupportStatePath: applicationStatePath,
    } : null,
    freshInstallation,
    host: collectMacHostIdentity(),
    switcher,
    cavalry,
  };
  validateManifestContract(manifest);
  writeExclusive(path.join(session, MANIFEST), manifest);
  return session;
}
function exactRunningPID(executablePath) {
  const lines = exec('/bin/ps', ['-axo', 'pid=,command=']).split('\n');
  const hits = lines.flatMap((line) => {
    const match = line.trim().match(/^(\d+)\s+(.+)$/);
    return match && match[2] === executablePath ? [Number(match[1])] : [];
  });
  if (hits.length !== 1) fail(`Exactly one packaged Switcher process required, got ${hits.length}`);
  return hits[0];
}
function captureWindow(windowID, destination) {
  const result = cp.spawnSync('/usr/sbin/screencapture', ['-x', '-l', String(windowID), destination], {
    encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.status !== 0 || !fs.existsSync(destination)) {
    fail(`Switcher window screenshot failed (${windowID}): ${(result.stderr || result.stdout).trim()}`);
  }
}
function checkpoint(args) {
  const phase = args.checkpoint;
  if (!args['session-dir'] || !PHASES.has(phase)) {
    fail(`--checkpoint requires --session-dir and one fixed phase: ${[...PHASES].join(', ')}`);
  }
  const session = fs.realpathSync(args['session-dir']);
  directory(session, 'Session');
  rejectInside(ROOT, session, 'Session directory');
  if (fs.existsSync(path.join(session, SEAL))) fail('Session is sealed');
  const manifest = readJson(path.join(session, MANIFEST));
  const sequence = manifestSequence(manifest);
  const readOnly = isReadOnlyScenario(manifest.scenario);
  if (readOnly) verifyRepositoryLock(manifest.repository);
  else {
    const user = verifyCurrentUserManifest(manifest);
    verifyRepositoryLock(manifest.repository, user);
    verifyUserCavalry(manifest, user);
  }
  const completed = recordedPhases(session, sequence);
  const expectedPhase = sequence[completed.length];
  if (phase !== expectedPhase) {
    fail(`Scenario ${manifest.scenario} expects ${expectedPhase || '<complete>'}, got ${phase}`);
  }
  verifyIdentity(manifest.switcher.executable, 'Switcher executable');
  verifyIdentity(manifest.cavalry.executable, 'Cavalry executable');
  verifyIdentity(manifest.cavalry.runtimeExecutable, 'Cavalry runtime executable');
  assertExpectedIdentities(
    manifest.switcher,
    manifest.cavalry,
    manifest.expected,
  );
  const verification = phase === 'retry-verified' ? verifyRetryOutcome(manifest) : null;
  const pid = exactRunningPID(manifest.switcher.executable.path);
  const probe = JSON.parse(exec('/usr/bin/swift', [PROBE, String(pid)]));
  const staging = path.join(session, `.checkpoint-${phase}-${crypto.randomUUID()}`);
  const destination = path.join(session, `checkpoint-${phase}`);
  if (fs.existsSync(destination)) fail(`Checkpoint already exists: ${phase}`);
  fs.mkdirSync(staging, { mode: 0o700 });
  try {
    const captures = [];
    for (const window of probe.windows.filter((item) => item.ownerKind === 'switcher')) {
      const file = path.join(staging, `switcher-window-${window.window}.png`);
      captureWindow(window.window, file);
      const captured = freezeIdentity(file);
      captures.push({ ...captured, path: path.join(destination, path.basename(file)) });
    }
    if (captures.length === 0) fail('No real Switcher window was observed');
    const record = {
      schema: CHECKPOINT_SCHEMA,
      phase,
      manifest: identity(path.join(session, MANIFEST)),
      probe,
      captures,
      observation: OBSERVATION_CONTRACT,
      verification,
      assertion: phase === 'permission-blocked'
        ? PERMISSION_BLOCKED_ASSERTION
        : 'Window metadata and images are observations only; permission truth remains the real Switch/Restore result.',
    };
    validateCheckpointRecord(record, phase, path.join(session, MANIFEST), manifest);
    writeExclusive(path.join(staging, 'checkpoint.json'), record);
    fs.renameSync(staging, destination);
  } catch (error) {
    fs.rmSync(staging, { recursive: true, force: true });
    throw error;
  }
  return destination;
}
function seal(args) {
  if (!args['session-dir']) fail('--seal requires --session-dir');
  const session = fs.realpathSync(args['session-dir']);
  directory(session, 'Session');
  rejectInside(ROOT, session, 'Session directory');
  if (fs.existsSync(path.join(session, SEAL))) fail('Session is already sealed');
  const manifestPayload = readJson(path.join(session, MANIFEST));
  const sequence = manifestSequence(manifestPayload);
  const completed = recordedPhases(session, sequence);
  if (completed.length !== sequence.length) {
    fail(`Scenario ${manifestPayload.scenario} is incomplete; next phase is ${sequence[completed.length]}`);
  }
  const entries = sequence.map((phase) => `checkpoint-${phase}`);
  const checkpoints = entries.map((name) => {
    const folder = path.join(session, name);
    directory(folder, 'Checkpoint');
    const phase = name.slice('checkpoint-'.length);
    const recordPath = path.join(folder, 'checkpoint.json');
    const recordPayload = readJson(recordPath);
    validateCheckpointRecord(recordPayload, phase, path.join(session, MANIFEST), manifestPayload);
    return {
      name,
      record: identity(recordPath),
      captures: fs.readdirSync(folder).filter((file) => file.endsWith('.png')).sort()
        .map((file) => identity(path.join(folder, file))),
    };
  });
  return writeExclusive(path.join(session, SEAL), {
    schema: SEAL_SCHEMA,
    sealedAt: new Date().toISOString(),
    scenario: manifestPayload.scenario,
    sequence,
    manifest: identity(path.join(session, MANIFEST)),
    checkpoints,
  });
}
function verify(args) {
  if (!args['session-dir']) fail('--verify requires --session-dir');
  const session = fs.realpathSync(args['session-dir']);
  directory(session, 'Session');
  rejectInside(ROOT, session, 'Session directory');
  const sealRecord = readJson(path.join(session, SEAL));
  if (sealRecord.schema !== SEAL_SCHEMA) fail(`Seal schema ${SEAL_SCHEMA} required`);
  verifyIdentity(sealRecord.manifest, 'Sealed manifest');
  const manifestPayload = readJson(sealRecord.manifest.path);
  const sequence = manifestSequence(manifestPayload);
  if (sealRecord.scenario !== manifestPayload.scenario ||
      JSON.stringify(sealRecord.sequence) !== JSON.stringify(sequence)) {
    fail('Sealed scenario contract drifted');
  }
  const sealedNames = sealRecord.checkpoints.map(({ name }) => name);
  const expectedNames = sequence.map((phase) => `checkpoint-${phase}`);
  if (JSON.stringify(sealedNames) !== JSON.stringify(expectedNames)) {
    fail('Sealed checkpoint order drifted');
  }
  for (const checkpointRecord of sealRecord.checkpoints) {
    verifyIdentity(checkpointRecord.record, `${checkpointRecord.name} record`);
    const checkpointPayload = readJson(checkpointRecord.record.path);
    const phase = checkpointRecord.name.slice('checkpoint-'.length);
    validateCheckpointRecord(checkpointPayload, phase, sealRecord.manifest.path, manifestPayload);
    verifyIdentity(checkpointPayload.manifest, `${checkpointRecord.name} manifest link`);
    for (const capture of checkpointRecord.captures) {
      verifyIdentity(capture, `${checkpointRecord.name} capture`);
    }
    if (checkpointPayload.captures.length !== checkpointRecord.captures.length) {
      fail(`${checkpointRecord.name} capture count drifted`);
    }
    for (let index = 0; index < checkpointPayload.captures.length; index += 1) {
      const expected = checkpointPayload.captures[index];
      const sealed = checkpointRecord.captures[index];
      if (expected.path !== sealed.path || expected.sha256 !== sealed.sha256 || expected.bytes !== sealed.bytes) {
        fail(`${checkpointRecord.name} capture identity drifted`);
      }
    }
  }
  return { ok: true, checkpoints: sealRecord.checkpoints.map(({ name }) => name) };
}

function main(argv = process.argv) {
  const args = parseArgs(argv);
  const actions = [args.initialize, args.checkpoint, args.seal, args.verify].filter(Boolean).length;
  if (actions !== 1) fail('Choose exactly one action: --initialize, --checkpoint <phase>, --seal, or --verify');
  const result = args.initialize ? initialize(args) : args.checkpoint ? checkpoint(args) : args.seal ? seal(args) : verify(args);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (require.main === module) main();
module.exports = {
  CAVALRY_INJECTOR,
  CAVALRY_LANGUAGE_MARKER,
  CHECKPOINT_SCHEMA,
  MANIFEST_SCHEMA,
  PHASES,
  READ_ONLY_SCENARIO,
  SCENARIOS,
  SEAL_SCHEMA,
  SUPPORTED_LANGUAGES,
  appIdentity,
  applicationSupportStatePath,
  assertFreshInstallation,
  checkpoint,
  currentUserIdentity,
  expectedContractFromArgs,
  initialize,
  main,
  manifestSequence,
  parseArgs,
  recordedPhases,
  scenarioPhases,
  seal,
  validateCheckpointRecord,
  validateExpectedContract,
  validateFreshInstallationProof,
  validateManifestContract,
  validateRetryVerification,
  validateStatePayload,
  verify,
};
