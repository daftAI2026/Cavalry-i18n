#!/usr/bin/env node
/**
 * [INPUT]: 依赖 clean source commit、真实 macos-acceptance PASS-48-OF-48 session、release.config 与目标 tag
 * [OUTPUT]: 写出仅绑定 source commit 与已复验 session 摘要的 evidence；拒绝手工 PASS/摘要参数和自引用 tag commit
 * [POS]: release 两提交协议的 evidence 生成器：先验 source commit，再由唯一 evidence-only commit 承载 tag
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const {
  LANGUAGES,
  validateEvidence,
  verifyAcceptanceSession,
} = require('./release_acceptance_contract');
const {
  toWindowsAcceptanceRecord,
  validateWindowsAcceptanceRecord,
  verifyWindowsAcceptanceSession,
} = require('./windows-acceptance/acceptance_contract');

const rootDir = process.cwd();
const args = process.argv.slice(2);

function fail(message) { throw new Error(message); }
function optionValue(name) {
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

function readRegularJson(file, label) {
  const absolute = path.resolve(file);
  const stat = fs.lstatSync(absolute);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size < 1) fail(`${label} must be a regular non-symlink file.`);
  return JSON.parse(fs.readFileSync(absolute, 'utf8'));
}

function main() {
  for (const forbidden of ['--confirm-live-pass', '--session-id', '--evidence-digest', '--commit']) {
    if (args.includes(forbidden)) {
      fail(`${forbidden} is not accepted; evidence is derived only from a verified live session.`);
    }
  }
  const tag = optionValue('--tag');
  const sessionDir = optionValue('--session-dir');
  if (!tag || !sessionDir) fail('--tag and --session-dir are required.');
  const releaseConfig = JSON.parse(fs.readFileSync(path.join(rootDir, 'release.config.json'), 'utf8'));
  const qtTarget = JSON.parse(fs.readFileSync(path.join(rootDir, 'tools/cavalry_qt_target.json'), 'utf8'));
  if (!new RegExp(releaseConfig.releaseTagPattern).test(tag)) fail(`Tag does not match release protocol: ${tag}.`);

  const sourceHead = git(['rev-parse', 'HEAD']).toLowerCase();
  const statusBefore = git(['status', '--short', '--untracked-files=all']);
  if (statusBefore) {
    fail('Release acceptance evidence must be generated from a clean source worktree.');
  }
  const summary = verifyAcceptanceSession(sessionDir, { repoRoot: rootDir });
  if (summary.sourceCommitSha !== sourceHead) {
    fail(`Live session source commit ${summary.sourceCommitSha} does not match current HEAD ${sourceHead}.`);
  }
  const windowsSessionDir = optionValue('--windows-session-dir');
  const windowsSummaryPath = optionValue('--windows-acceptance');
  if (windowsSessionDir && windowsSummaryPath) {
    fail('pass either --windows-session-dir or --windows-acceptance, not both.');
  }
  let windowsAcceptance;
  if (windowsSessionDir) {
    windowsAcceptance = toWindowsAcceptanceRecord(
      verifyWindowsAcceptanceSession(windowsSessionDir, { repoRoot: rootDir, expectedTag: tag })
    );
  } else if (windowsSummaryPath) {
    windowsAcceptance = validateWindowsAcceptanceRecord(readRegularJson(windowsSummaryPath, 'Windows acceptance summary'));
    if (windowsAcceptance.tag !== tag) fail(`Windows acceptance tag ${windowsAcceptance.tag} != ${tag}.`);
    if (windowsAcceptance.sourceCommitSha !== sourceHead) {
      fail(`Windows acceptance source commit ${windowsAcceptance.sourceCommitSha} does not match current HEAD ${sourceHead}.`);
    }
  }
  const evidence = validateEvidence({
    schemaVersion: 3,
    kind: 'ReleaseAcceptanceEvidence',
    tag,
    sourceCommitSha: sourceHead,
    targetCavalryVersion: releaseConfig.targetCavalryVersion,
    qtVersion: qtTarget.qtVersion,
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
    ...(windowsAcceptance ? { windowsAcceptance } : {}),
    createdAtUtc: new Date().toISOString(),
    createdBy: optionValue('--created-by') || process.env.USER || 'unknown',
  });
  const expectedOutput = path.join(rootDir, 'release-seals', `${tag}.evidence.json`);
  const output = path.resolve(optionValue('--output') || expectedOutput);
  if (output !== expectedOutput) {
    fail(`Evidence output must be the canonical release path: ${expectedOutput}.`);
  }
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, `${JSON.stringify(evidence, null, 2)}\n`, { flag: 'wx', mode: 0o444 });
  console.log(`[create-release-acceptance-evidence] wrote ${path.relative(rootDir, output)}`);
  console.log('[create-release-acceptance-evidence] next: commit only this evidence file, then tag that evidence-only commit.');
}

try { main(); } catch (error) {
  console.error(`[create-release-acceptance-evidence] ${error.message}`);
  process.exit(1);
}
