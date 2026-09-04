#!/usr/bin/env node
/**
 * [INPUT]: Windows TEMP acceptance session（machine/review/final）、当前 source worktree
 * [OUTPUT]: 写出仅由已复验现场派生的 WindowsReleaseAcceptance 摘要，绑定最终 NSIS 与 shipped DLL
 * [POS]: 可选 Windows 维护者验收的唯一摘要入口；不启动 Cavalry、不接受手工 PASS、不覆盖已有输出，也不参与常规 tag 发布
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {
  toWindowsAcceptanceRecord,
  verifyWindowsAcceptanceSession,
} = require('./acceptance_contract');

const args = process.argv.slice(2);

function fail(message) {
  throw new Error(`record-windows-acceptance: ${message}`);
}

function optionValue(name) {
  const index = args.indexOf(name);
  if (index < 0) return null;
  const value = args[index + 1];
  if (!value || value.startsWith('--')) fail(`${name} requires a value.`);
  return value;
}

function isWithin(candidate, root) {
  const relative = path.relative(path.resolve(root), path.resolve(candidate));
  return relative === '' || relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

function assertOutput(output, sessionDir, repoRoot) {
  const absolute = path.resolve(output);
  if (fs.existsSync(absolute)) fail(`output must not already exist: ${absolute}`);
  const session = path.resolve(sessionDir);
  if (isWithin(absolute, session)) fail('output must stay outside the acceptance session.');
  if (repoRoot) {
    const root = path.resolve(repoRoot);
    if (isWithin(absolute, root)) fail('output must stay outside the candidate repository.');
  }
  const parent = path.dirname(absolute);
  fs.mkdirSync(parent, { recursive: true });
  const parentStat = fs.lstatSync(parent);
  if (!parentStat.isDirectory() || parentStat.isSymbolicLink()) fail(`output parent must be a regular directory: ${parent}`);
  let cursor = parent;
  for (;;) {
    const stat = fs.lstatSync(cursor);
    if (stat.isSymbolicLink()) fail(`output path crosses a symlink/junction: ${cursor}`);
    const next = path.dirname(cursor);
    if (next === cursor) break;
    cursor = next;
  }
  return absolute;
}

function main() {
  if (args.includes('--help') || args.includes('-h')) {
    process.stdout.write(
      'Usage: node tools/windows-acceptance/record_windows_acceptance.js ' +
      '--tag <cavalry-2.7.2-pN> --session-dir <TEMP-session> --output <outside-session-json> [--repo-root <repo>]\n'
    );
    return;
  }
  if (process.platform !== 'win32' || process.arch !== 'x64') {
    fail('the release producer must run on a Windows x64 runner.');
  }
  for (const forbidden of ['--confirm-live-pass', '--status', '--result', '--session-id']) {
    if (args.includes(forbidden)) fail(`${forbidden} is not accepted; result is derived from verified session files.`);
  }
  const tag = optionValue('--tag');
  const sessionDir = optionValue('--session-dir');
  const repoRoot = path.resolve(optionValue('--repo-root') || process.cwd());
  const output = optionValue('--output');
  if (!tag || !sessionDir || !output) fail('--tag, --session-dir and --output are required.');
  const summary = verifyWindowsAcceptanceSession(sessionDir, { repoRoot, expectedTag: tag });
  const record = toWindowsAcceptanceRecord(summary);
  const destination = assertOutput(output, sessionDir, repoRoot);
  fs.writeFileSync(destination, `${JSON.stringify(record, null, 2)}\n`, { flag: 'wx', mode: 0o444 });
  process.stdout.write(`[record-windows-acceptance] wrote ${destination}\n`);
}

try {
  main();
} catch (error) {
  process.stderr.write(`[record-windows-acceptance] ${error.stack || error.message}\n`);
  process.exitCode = 1;
}
