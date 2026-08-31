#!/usr/bin/env node
/**
 * [INPUT]: 依赖精确 packaged Switcher/Cavalry app、显式仓库外 session、人工阶段名、window_probe.swift 与 macOS codesign/screencapture。
 * [OUTPUT]: 对外提供 initialize/checkpoint/seal 三动作；冻结 bundle/host 身份，记录 WindowServer point/backing-scale，并只封存 Switcher 自有窗口 PNG。
 * [POS]: packaged App Management handoff 的只读证据 producer；不操作 System Settings、不读写 TCC、不把 drop 或截图伪装成权限成功。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
'use strict';

const fs = require('node:fs');
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
const CAVALRY_RUNTIME_EXECUTABLE = 'Cavalry';
const PHASES = Object.freeze(new Set([
  'baseline',
  'permission-blocked',
  'helper-presented',
  'drag-cancelled',
  'drop-accepted',
  'retry-still-denied',
  'retry-verified',
  'reverse-complete',
  'existing-row',
  'target-lost',
  'reduced-motion-helper',
  'reduced-motion-complete',
]));

function fail(message) { throw new Error(message); }
function parseArgs(argv) {
  const result = {};
  for (let index = 2; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) fail(`Unexpected argument: ${token}`);
    const key = token.slice(2);
    if (['initialize', 'seal', 'verify'].includes(key)) result[key] = true;
    else result[key] = argv[++index];
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
function plistValue(appPath, key) {
  return exec('/usr/libexec/PlistBuddy', ['-c', `Print :${key}`, path.join(appPath, 'Contents', 'Info.plist')]);
}
function appIdentity(appPath, expectedKind, runtimeExecutableName = null) {
  const resolved = path.resolve(appPath);
  directory(resolved, expectedKind);
  if (path.extname(resolved) !== '.app' || fs.realpathSync(resolved) !== resolved) {
    fail(`${expectedKind} must be a canonical non-symlink .app: ${resolved}`);
  }
  const executable = path.join(resolved, 'Contents', 'MacOS', plistValue(resolved, 'CFBundleExecutable'));
  regular(executable);
  strictChild(resolved, executable, `${expectedKind} executable`);
  const verify = cp.spawnSync('/usr/bin/codesign', ['--verify', '--deep', '--strict', resolved], {
    encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (verify.status !== 0) fail(`${expectedKind} strict codesign failed: ${verify.stderr.trim()}`);
  const result = {
    path: resolved,
    bundleIdentifier: plistValue(resolved, 'CFBundleIdentifier'),
    version: plistValue(resolved, 'CFBundleShortVersionString'),
    infoPlist: identity(path.join(resolved, 'Contents', 'Info.plist')),
    executable: binaryIdentity(executable),
  };
  if (runtimeExecutableName) {
    const runtimeExecutable = path.join(resolved, 'Contents', 'MacOS', runtimeExecutableName);
    regular(runtimeExecutable);
    strictChild(resolved, runtimeExecutable, `${expectedKind} runtime executable`);
    result.runtimeExecutable = binaryIdentity(runtimeExecutable);
  }
  return result;
}
function initialize(args) {
  if (!args['session-dir'] || !args['switcher-app'] || !args['cavalry-app']) {
    fail('--initialize requires --session-dir, --switcher-app and --cavalry-app');
  }
  const switcher = appIdentity(args['switcher-app'], 'Switcher app');
  const cavalry = appIdentity(args['cavalry-app'], 'Cavalry app', CAVALRY_RUNTIME_EXECUTABLE);
  if (cavalry.version !== '2.7.2') fail(`Cavalry 2.7.2 required, got ${cavalry.version}`);
  const session = resolveNewSession(args['session-dir'], [ROOT, switcher.path, cavalry.path]);
  fs.mkdirSync(session, { mode: 0o700 });
  const manifest = {
    schema: 1,
    createdAt: new Date().toISOString(),
    repository: {
      root: ROOT,
      head: exec('/usr/bin/git', ['-C', ROOT, 'rev-parse', 'HEAD']),
      status: exec('/usr/bin/git', ['-C', ROOT, 'status', '--short', '--untracked-files=all'])
        .split('\n').filter(Boolean),
    },
    host: collectMacHostIdentity(),
    switcher,
    cavalry,
  };
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
  verifyIdentity(manifest.switcher.executable, 'Switcher executable');
  verifyIdentity(manifest.cavalry.executable, 'Cavalry executable');
  verifyIdentity(manifest.cavalry.runtimeExecutable, 'Cavalry runtime executable');
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
    const record = {
      schema: 1,
      phase,
      manifest: identity(path.join(session, MANIFEST)),
      probe,
      captures,
      assertion: 'Window metadata and images are observations only; permission truth remains the real Switch/Restore result.',
    };
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
  const entries = fs.readdirSync(session).filter((name) => name.startsWith('checkpoint-')).sort();
  if (entries.length === 0) fail('At least one checkpoint is required before seal');
  const checkpoints = entries.map((name) => {
    const folder = path.join(session, name);
    directory(folder, 'Checkpoint');
    return {
      name,
      record: identity(path.join(folder, 'checkpoint.json')),
      captures: fs.readdirSync(folder).filter((file) => file.endsWith('.png')).sort()
        .map((file) => identity(path.join(folder, file))),
    };
  });
  return writeExclusive(path.join(session, SEAL), {
    schema: 1,
    sealedAt: new Date().toISOString(),
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
  verifyIdentity(sealRecord.manifest, 'Sealed manifest');
  for (const checkpointRecord of sealRecord.checkpoints) {
    verifyIdentity(checkpointRecord.record, `${checkpointRecord.name} record`);
    const checkpointPayload = readJson(checkpointRecord.record.path);
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
module.exports = { PHASES, appIdentity, checkpoint, initialize, main, parseArgs, seal, verify };
