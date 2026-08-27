#!/usr/bin/env node
/**
 * [INPUT]: 依赖 schema v3 evidence、可选真实 macOS/Windows 原始 session，以及 tag commit 的单父提交拓扑
 * [OUTPUT]: 校验 source commit/session 摘要；tag 模式只接受“source commit + evidence + protected attestation”的两提交协议
 * [POS]: tag preflight 的 release-bound live acceptance 守门器，消除 commit SHA 自引用与自报 PASS
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const {
  assertEvidenceMatchesSession,
  assertWindowsEvidenceMatchesSession,
  assertHex,
  validateEvidence,
  verifyAcceptanceSession,
} = require('./release_acceptance_contract');
const {
  verifyWindowsAcceptanceSession,
} = require('./windows-acceptance/acceptance_contract');

const rootDir = process.cwd();
const args = process.argv.slice(2);
function fail(message) { throw new Error(message); }
function hasOption(name) {
  return args.some((arg) => arg === name || arg.startsWith(`${name}=`));
}
function optionValue(name) {
  const inline = args.find((arg) => arg.startsWith(`${name}=`));
  if (inline) {
    const value = inline.slice(name.length + 1);
    if (!value) fail(`${name} requires a value.`);
    return value;
  }
  const index = args.indexOf(name);
  if (index === -1) return null;
  const value = args[index + 1];
  if (!value || value.startsWith('--')) fail(`${name} requires a value.`);
  return value;
}
function git(gitArgs) {
  const result = spawnSync('git', gitArgs, { cwd: rootDir, encoding: 'utf8' });
  if (result.status !== 0) fail(`git ${gitArgs.join(' ')} failed: ${(result.stderr || result.stdout).trim()}`);
  return result.stdout.trim();
}
function readJson(file) {
  const stat = fs.lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink()) fail(`Evidence must be a regular non-symlink file: ${file}.`);
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function verifyTagTopology(evidence, evidencePath, releaseCommit) {
  assertHex(releaseCommit, 'releaseCommitSha', 40);
  const parents = git(['rev-list', '--parents', '-n', '1', releaseCommit]).split(/\s+/);
  if (parents.length !== 2 || parents[0] !== releaseCommit) {
    fail('Release tag commit must have exactly one parent (the live-tested source commit).');
  }
  const sourceCommit = parents[1];
  if (evidence.sourceCommitSha !== sourceCommit) {
    fail(`Evidence sourceCommitSha ${evidence.sourceCommitSha} != tag parent ${sourceCommit}.`);
  }
  const expectedRelative = `release-seals/${evidence.tag}.evidence.json`;
  const expectedAttestation = `release-seals/${evidence.tag}.acceptance-attestation.json`;
  const relative = path.relative(rootDir, evidencePath).split(path.sep).join('/');
  if (relative !== expectedRelative) {
    fail(`Evidence path must be ${expectedRelative}, got ${relative}.`);
  }
  const changed = git(['diff-tree', '--no-commit-id', '--name-only', '-r', releaseCommit])
    .split('\n')
    .filter(Boolean);
  if (JSON.stringify(changed.sort()) !== JSON.stringify([expectedRelative, expectedAttestation].sort())) {
    fail(`Tag commit must change only protected evidence/attestation files; changed: ${changed.join(', ') || '<none>'}.`);
  }
  const committed = git(['show', `${releaseCommit}:${expectedRelative}`]);
  const current = fs.readFileSync(evidencePath, 'utf8').replace(/\r\n/g, '\n').trimEnd();
  if (committed.replace(/\r\n/g, '\n').trimEnd() !== current) {
    fail('Working-tree evidence differs from the evidence stored in the release commit.');
  }
  return sourceCommit;
}

function main() {
  if (hasOption('--windows-acceptance')) {
    fail('--windows-acceptance is not accepted; pass --windows-session-dir for raw Windows session verification.');
  }
  if (args.includes('--check-schema')) {
    const schema = readJson(path.join(rootDir, 'tools/schemas/release_acceptance_evidence.schema.json'));
    if (schema.title !== 'ReleaseAcceptanceEvidence' || schema.properties?.schemaVersion?.const !== 3) {
      fail('ReleaseAcceptanceEvidence schema v3 is required.');
    }
    console.log('[verify-release-acceptance-evidence] OK: schema v3 present');
    return;
  }
  const tag = optionValue('--tag') || process.env.GITHUB_REF_NAME;
  const evidencePath = path.resolve(
    optionValue('--evidence') || (tag ? path.join(rootDir, 'release-seals', `${tag}.evidence.json`) : '')
  );
  if (!tag || !evidencePath || !fs.existsSync(evidencePath)) {
    fail('Pass --tag and a present canonical release evidence file.');
  }
  const requireWindows = args.includes('--require-windows');
  const evidence = validateEvidence(readJson(evidencePath), { requireWindows });
  if (evidence.tag !== tag) fail(`Evidence tag ${evidence.tag} != required ${tag}.`);
  const sourceCommit = optionValue('--source-commit');
  if (sourceCommit) {
    assertHex(sourceCommit.toLowerCase(), 'sourceCommitSha', 40);
    if (evidence.sourceCommitSha !== sourceCommit.toLowerCase()) {
      fail(`Evidence sourceCommitSha ${evidence.sourceCommitSha} != required ${sourceCommit}.`);
    }
  }
  const sessionDir = optionValue('--session-dir');
  if (sessionDir) {
    assertEvidenceMatchesSession(evidence, verifyAcceptanceSession(sessionDir, { repoRoot: rootDir }));
  }
  const windowsSessionDir = optionValue('--windows-session-dir');
  if (windowsSessionDir) {
    assertWindowsEvidenceMatchesSession(
      evidence,
      verifyWindowsAcceptanceSession(windowsSessionDir, { repoRoot: rootDir, expectedTag: tag })
    );
  }

  const releaseCommit = (optionValue('--release-commit') || process.env.GITHUB_SHA || '').toLowerCase();
  if (args.includes('--check-tag-topology')) {
    if (!releaseCommit) fail('--check-tag-topology requires --release-commit or GITHUB_SHA.');
    verifyTagTopology(evidence, evidencePath, releaseCommit);
  } else if (releaseCommit) {
    assertHex(releaseCommit, 'releaseCommitSha', 40);
  }
  console.log(
    `[verify-release-acceptance-evidence] OK: ${path.relative(rootDir, evidencePath)} binds source ${evidence.sourceCommitSha}`
  );
}

try { main(); } catch (error) {
  console.error(`[verify-release-acceptance-evidence] ${error.message}`);
  process.exit(1);
}
