#!/usr/bin/env node
/**
 * [INPUT]: Windows live runner 已写入的 TEMP session machine record 与现有 PNG/inventory 文件
 * [OUTPUT]: 通过逐张确认已有截图生成 manual-review/final record；不接受手工填写 PASS、点集或文件摘要
 * [POS]: tools/windows-acceptance 的人工观察边界；机器证据先由 Rust runner 产生，release producer 只消费最终封存记录
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline/promises');
const {
  prepareWindowsAcceptanceSession,
  verifyWindowsAcceptanceSession,
} = require('./acceptance_contract');

const args = process.argv.slice(2);

function fail(message) {
  throw new Error(`review-windows-acceptance: ${message}`);
}

function optionValue(name) {
  const index = args.indexOf(name);
  if (index < 0) return null;
  const value = args[index + 1];
  if (!value || value.startsWith('--')) fail(`${name} requires a value.`);
  return value;
}

function writeNewJson(file, value, label) {
  if (fs.existsSync(file)) fail(`${label} already exists: ${file}`);
  const payload = `${JSON.stringify(value, null, 2)}\n`;
  let handle;
  try {
    handle = fs.openSync(file, 'wx', 0o444);
    fs.writeFileSync(handle, payload, 'utf8');
    fs.fsyncSync(handle);
  } catch (error) {
    throw new Error(`could not create ${label}: ${error.message}`);
  } finally {
    if (handle !== undefined) fs.closeSync(handle);
  }
}

async function main() {
  if (args.includes('--help') || args.includes('-h')) {
    process.stdout.write(
      'Usage: node tools/windows-acceptance/review_windows_acceptance.js ' +
      '--tag <cavalry-2.7.2-pN> --session-dir <TEMP-session> --reviewer <name> [--repo-root <repo>]\n' +
      'The command asks for confirmation of each existing screenshot and derives review/final records.\n'
    );
    return;
  }
  for (const forbidden of ['--status', '--result', '--pass', '--points', '--confirm-live-pass']) {
    if (args.includes(forbidden)) fail(`${forbidden} is not accepted; review status and point set are derived.`);
  }
  if (!process.stdin.isTTY || !process.stdout.isTTY) fail('manual screenshot review requires an interactive terminal.');
  const tag = optionValue('--tag');
  const sessionDir = optionValue('--session-dir');
  const reviewer = optionValue('--reviewer');
  const repoRoot = path.resolve(optionValue('--repo-root') || process.cwd());
  if (!tag || !sessionDir || !reviewer) fail('--tag, --session-dir and --reviewer are required.');
  if (!reviewer.trim()) fail('--reviewer must not be empty.');

  const prepared = prepareWindowsAcceptanceSession(sessionDir, { repoRoot, expectedTag: tag });
  const reviewPath = path.join(prepared.session.root, 'windows-manual-review.json');
  const finalPath = path.join(prepared.session.root, 'windows-final-record.json');
  if (fs.existsSync(reviewPath) || fs.existsSync(finalPath)) {
    fail('review/final record already exists; refusing to overwrite an acceptance session.');
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const approved = [];
  try {
    for (const point of prepared.matrix.points) {
      process.stdout.write(`\n${point.key}\n  screenshot: ${point.screenshot.path}\n  inventory:  ${point.inventory.path}\n`);
      const answer = (await rl.question('  Screenshot visibly matches the requested translated surface? [y/N] ')).trim().toLowerCase();
      if (answer !== 'y' && answer !== 'yes') fail(`review stopped at ${point.key}; no PASS was produced.`);
      approved.push({
        key: point.key,
        status: 'APPROVED',
        screenshot: point.screenshot,
        inventory: point.inventory,
      });
    }
  } finally {
    rl.close();
  }

  const reviewedAtUtc = new Date().toISOString();
  const review = {
    schema: 'cavalry-i18n.windows-release.manual-review/v1',
    status: 'APPROVED',
    reviewedAtUtc,
    reviewer: reviewer.trim(),
    points: approved,
  };
  writeNewJson(reviewPath, review, 'manual review record');
  const reviewStat = fs.statSync(reviewPath);
  const reviewIdentity = {
    path: reviewPath,
    bytes: reviewStat.size,
    sha256: require('node:crypto').createHash('sha256').update(fs.readFileSync(reviewPath)).digest('hex'),
  };
  const final = {
    schema: 'cavalry-i18n.windows-release.final/v1',
    status: `PASS-${approved.length}-OF-${approved.length}`,
    sealedAtUtc: new Date().toISOString(),
    machine: prepared.machineIdentity,
    review: reviewIdentity,
    points: approved.map((point) => point.key),
  };
  writeNewJson(finalPath, final, 'final record');
  const summary = verifyWindowsAcceptanceSession(sessionDir, { repoRoot, expectedTag: tag });
  process.stdout.write(
    `[review-windows-acceptance] sealed ${summary.result} for ${tag}; ` +
    `session=${summary.sessionId} source=${summary.sourceCommitSha}\n`
  );
}

main().catch((error) => {
  process.stderr.write(`[review-windows-acceptance] ${error.stack || error.message}\n`);
  process.exitCode = 1;
});
