#!/usr/bin/env node
/**
 * [INPUT]: 依赖 git commit、source_artifact_manifest.sourceArchivePaths 与一个尚不存在的 repo 外 `.tar` 输出文件。
 * [OUTPUT]: 用 git archive 生成 tracked-only、保留 executable mode 的 source tar，内嵌 commit marker，并调用独立 verifier 精确比对 commit tree。
 * [POS]: CI source artifact 的唯一 producer；上传 tar 而非会丢 mode 的裸目录。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

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
function run(command, commandArgs) {
  const result = spawnSync(command, commandArgs, { cwd: rootDir, encoding: 'utf8' });
  if (result.status !== 0) {
    fail(`${command} ${commandArgs.join(' ')} failed: ${(result.stderr || result.stdout).trim()}`);
  }
  return result.stdout.trim();
}
function main() {
  const commit = (optionValue('--commit') || '').toLowerCase();
  const outputValue = optionValue('--output');
  if (!/^[a-f0-9]{40}$/.test(commit)) fail('--commit must be a lowercase 40-character SHA.');
  if (!outputValue) fail('--output is required.');
  const output = path.resolve(outputValue);
  if (path.extname(output) !== '.tar' || fs.existsSync(output)) {
    fail('--output must name an absent .tar file.');
  }
  const rootReal = fs.realpathSync(rootDir);
  const parentReal = fs.realpathSync(path.dirname(output));
  const canonicalOutput = path.join(parentReal, path.basename(output));
  const relative = path.relative(rootReal, canonicalOutput);
  if (relative === '' || (relative !== '..' && !relative.startsWith(`..${path.sep}`))) {
    fail('Source artifact output must stay outside the repository.');
  }
  const resolved = run('git', ['rev-parse', `${commit}^{commit}`]);
  if (resolved !== commit) fail(`--commit does not resolve exactly: ${commit}.`);
  const manifest = JSON.parse(
    fs.readFileSync(path.join(rootDir, 'tools/source_artifact_manifest.json'), 'utf8')
  );
  if (!Array.isArray(manifest.sourceArchivePaths) || manifest.sourceArchivePaths.length < 1) {
    fail('sourceArchivePaths is missing from source_artifact_manifest.json.');
  }
  const marker = `${JSON.stringify({
    schemaVersion: manifest.artifactIdentity.schemaVersion,
    kind: manifest.artifactIdentity.kind,
    commitSha: commit,
  })}\n`;
  try {
    run('git', [
      'archive', '--format=tar', `--output=${canonicalOutput}`,
      `--add-virtual-file=${manifest.artifactIdentity.markerPath}:${marker}`,
      commit, '--', ...manifest.sourceArchivePaths,
    ]);
    run(process.execPath, [
      path.join(rootDir, 'tools/verify_source_artifact.js'),
      '--archive', canonicalOutput,
      '--commit', commit,
    ]);
    console.log(`[create-source-artifact] staged and verified ${canonicalOutput} @ ${commit}`);
  } catch (error) {
    fs.rmSync(canonicalOutput, { force: true });
    throw error;
  }
}
try { main(); } catch (error) {
  console.error(`[create-source-artifact] ${error.message}`);
  process.exit(1);
}
