#!/usr/bin/env node
/**
 * [INPUT]: 依赖 GitHub runner 注入的 ImageOS/ImageVersion、固定 workflow runs-on label，tag 时依赖 protected environment allowlist
 * [OUTPUT]: 记录 canonical runner-image identity；enforce 模式只接受允许的 SHA-256 fingerprint，缺失环境变量或 image 元数据均 fail-closed
 * [POS]: tools 的 runner image 漂移门（P2.8）；普通 PR 仅记录，release/tag 使用不可由 PR 改写的环境变量强制比对
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
'use strict';
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

function fail(message) { throw new Error(message); }
function optionValue(args, name, required = false) {
  const index = args.indexOf(name);
  if (index === -1) { if (required) fail(`${name} is required.`); return null; }
  const value = args[index + 1];
  if (!value || value.startsWith('--')) fail(`${name} requires a value.`);
  return value;
}
function identity(label) {
  return {
    schemaVersion: 1,
    kind: 'GitHubHostedRunnerImage',
    runnerLabel: label,
    runnerOs: process.env.RUNNER_OS || '',
    runnerArch: process.env.RUNNER_ARCH || '',
    imageOs: process.env.ImageOS || '',
    imageVersion: process.env.ImageVersion || '',
  };
}
function fingerprint(value) {
  return crypto.createHash('sha256').update(`${JSON.stringify(value)}\n`).digest('hex');
}
function main() {
  const args = process.argv.slice(2);
  const mode = optionValue(args, '--mode', true);
  if (!['record', 'enforce'].includes(mode)) fail('--mode must be record or enforce.');
  const runnerLabel = optionValue(args, '--runner-label', true);
  const output = optionValue(args, '--output');
  const result = identity(runnerLabel);
  const sha256 = fingerprint(result);
  const evidence = { ...result, fingerprintSha256: sha256 };
  if (output) fs.writeFileSync(path.resolve(output), `${JSON.stringify(evidence, null, 2)}\n`);
  if (mode === 'enforce') {
    if (process.env.GITHUB_ACTIONS !== 'true' || !result.imageOs || !result.imageVersion || !result.runnerOs || !result.runnerArch) {
      fail('Tag runner gate requires GitHub-hosted ImageOS/ImageVersion/RUNNER_OS/RUNNER_ARCH evidence.');
    }
    const allowed = optionValue(args, '--allowed-fingerprints', true)
      .split(/[\s,]+/).filter(Boolean);
    if (allowed.length === 0 || allowed.some((entry) => !/^[a-f0-9]{64}$/i.test(entry))) {
      fail('Runner image allowlist must contain one or more SHA-256 fingerprints.');
    }
    if (!allowed.includes(sha256)) {
      fail(`Runner image fingerprint ${sha256} is not in the protected allowlist.`);
    }
  }
  process.stdout.write(`${JSON.stringify(evidence)}\n`);
}
try { main(); } catch (error) { console.error(`[verify-runner-image] ${error.message}`); process.exit(1); }
