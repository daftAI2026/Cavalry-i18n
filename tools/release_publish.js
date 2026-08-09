#!/usr/bin/env node
/**
 * [INPUT]: 依赖 gh CLI、release metadata 环境、最终三资产及全部强制 sidecar
 * [OUTPUT]: 先创建/恢复 private draft、上传并逐字节回读完整资产后才公开；既有 public release 只读复验，冲突/缺件/非 404 查询错误 fail-closed
 * [POS]: GitHub Release 幂等发布边界；公开面绝不出现脚本制造的半成品，也不覆盖远端资产或把网络/鉴权失败误判为“不存在”
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
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
function requireEnv(name) {
  const value = process.env[name];
  if (!value) fail(`Missing required environment variable ${name}.`);
  return value;
}
function sha256File(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}
function run(command, commandArgs, allowFailure = false) {
  const result = spawnSync(command, commandArgs, {
    cwd: rootDir,
    env: process.env,
    encoding: 'utf8',
  });
  if (!allowFailure && result.status !== 0) {
    fail(`${command} ${commandArgs.join(' ')} failed: ${(result.stderr || result.stdout || '').trim()}`);
  }
  return result;
}
function runGh(commandArgs, allowFailure = false) {
  const testScript = process.env.CAVALRY_I18N_TEST_GH_SCRIPT;
  if (testScript) {
    if (process.env.NODE_ENV !== 'test') fail('CAVALRY_I18N_TEST_GH_SCRIPT is forbidden outside test mode.');
    return run(process.execPath, [testScript, ...commandArgs], allowFailure);
  }
  return run('gh', commandArgs, allowFailure);
}
function git(gitArgs) { return run('git', gitArgs).stdout.trim(); }
function resolveTagCommit(tag) {
  const testCommit = process.env.CAVALRY_I18N_TEST_TAG_COMMIT_SHA;
  if (testCommit) {
    if (process.env.NODE_ENV !== 'test' || !process.env.CAVALRY_I18N_TEST_GH_SCRIPT) {
      fail('CAVALRY_I18N_TEST_TAG_COMMIT_SHA is forbidden outside the isolated fake-gh test seam.');
    }
    if (!/^[a-f0-9]{40}$/.test(testCommit)) fail('CAVALRY_I18N_TEST_TAG_COMMIT_SHA must be a lowercase 40-character SHA.');
    return testCommit;
  }
  return git(['rev-parse', `${tag}^{commit}`]).toLowerCase();
}
function verifyRemoteAnnotatedTag(tag, commitSha) {
  if (process.env.CAVALRY_I18N_TEST_TAG_COMMIT_SHA) return;
  const output = git(['ls-remote', 'origin', `refs/tags/${tag}`, `refs/tags/${tag}^{}`]);
  const refs = new Map(output.split(/\r?\n/).filter(Boolean).map((line) => {
    const [sha, ref] = line.trim().split(/\s+/, 2);
    return [ref, sha?.toLowerCase()];
  }));
  if (!refs.has(`refs/tags/${tag}`) || refs.get(`refs/tags/${tag}^{}`) !== commitSha) {
    fail(`Remote annotated tag ${tag} is missing, lightweight, or does not peel to ${commitSha}.`);
  }
}

function localAssets(distDir, names) {
  const seen = new Set();
  return names.map((name) => {
    if (!name || path.basename(name) !== name || seen.has(name)) fail(`Invalid/duplicate release asset name: ${name}.`);
    seen.add(name);
    const file = path.join(distDir, name);
    const stat = fs.lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size < 1) fail(`Release asset is invalid: ${file}.`);
    return { name, path: file, bytes: stat.size, sha256: sha256File(file) };
  });
}

function writeChecksums(primary, output) {
  fs.writeFileSync(output, `${primary.map((item) => `${item.sha256}  ${item.name}`).join('\n')}\n`);
}

function writeProvenance(primary, output, meta) {
  const identity = (file) => {
    const stat = fs.lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size < 1) fail(`Invalid provenance input: ${file}.`);
    return { name: path.basename(file), bytes: stat.size, sha256: sha256File(file) };
  };
  fs.writeFileSync(output, `${JSON.stringify({
    schemaVersion: 3,
    kind: 'ReleaseAssetProvenance',
    tag: meta.tag,
    releaseCommitSha: meta.commitSha,
    sourceCommitSha: meta.sourceCommitSha,
    createdAtUtc: meta.createdAtUtc,
    assets: primary.map(({ name, bytes, sha256 }) => ({ name, bytes, sha256 })),
    signedSeal: identity(meta.sealPath),
    acceptanceAttestation: identity(meta.attestationPath),
    supplyChain: { sbom: identity(meta.sbomPath), toolchainEvidence: identity(meta.toolchainPath) },
    signing: {
      macos: 'developer-id-notarized',
      windows: 'authenticode-required-but-tracked-as-issue',
    },
  }, null, 2)}\n`);
}

function confirmNotFound(tag, originalError) {
  const api = runGh(['api', '--include', `repos/{owner}/{repo}/releases/tags/${tag}`], true);
  const combined = `${api.stdout || ''}\n${api.stderr || ''}`;
  if (api.status !== 0 && /(?:HTTP\/\S+\s+404|404\s+Not Found)/i.test(combined)) return;
  fail(
    `Unable to query existing release ${tag}; refusing to treat the error as absence. ` +
      `release view: ${originalError.trim() || '<empty>'}; API: ${combined.trim() || '<empty>'}`
  );
}

function remoteRelease(tag) {
  const result = runGh([
    'release', 'view', tag, '--json',
    'assets,isDraft,isPrerelease,name,tagName,targetCommitish,body',
  ], true);
  if (result.status !== 0) {
    confirmNotFound(tag, result.stderr || result.stdout || '');
    return null;
  }
  let release;
  try { release = JSON.parse(result.stdout); } catch (error) { fail(`Invalid gh release JSON: ${error.message}`); }
  return release;
}

function downloadDigest(tag, asset, tempDir) {
  const before = new Set(fs.readdirSync(tempDir));
  const result = runGh([
    'release', 'download', tag, '--pattern', asset.name, '--dir', tempDir, '--clobber',
  ], true);
  const target = path.join(tempDir, asset.name);
  if (result.status !== 0 || !fs.existsSync(target)) {
    fail(`Unable to download existing release asset ${asset.name}: ${(result.stderr || result.stdout).trim()}`);
  }
  const stat = fs.lstatSync(target);
  if (!stat.isFile() || stat.isSymbolicLink()) fail(`Downloaded release asset is invalid: ${asset.name}.`);
  const digest = sha256File(target);
  fs.unlinkSync(target);
  for (const unexpected of fs.readdirSync(tempDir).filter((name) => !before.has(name))) {
    fail(`gh downloaded an unexpected asset while checking ${asset.name}: ${unexpected}.`);
  }
  return { bytes: stat.size, sha256: digest };
}

function verifyRemoteMetadata(remote, expected, draft) {
  if (
    remote.tagName !== expected.tag ||
    remote.name !== expected.title || String(remote.body || '').replace(/\r\n/g, '\n').trimEnd() !== expected.notes.trimEnd() ||
    remote.isDraft !== draft || remote.isPrerelease !== false
  ) {
    fail('Existing release metadata (tag/target/title/body/draft state) conflicts with the requested release.');
  }
}

function verifyRemoteAssets(remote, local, meta) {
  const remoteMap = new Map();
  for (const asset of remote.assets || []) {
    if (remoteMap.has(asset.name)) fail(`Existing release has duplicate asset name: ${asset.name}.`);
    remoteMap.set(asset.name, asset);
  }
  const expected = new Set(local.map((asset) => asset.name));
  const extra = [...remoteMap.keys()].filter((name) => !expected.has(name));
  if (extra.length) fail(`Existing release has unexpected assets: ${extra.join(', ')}.`);
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'cavalry-release-verify-'));
  try {
    for (const asset of local) {
      if (!remoteMap.has(asset.name)) continue;
      const remoteDigest = downloadDigest(meta.tag, asset, temp);
      if (remoteDigest.bytes !== asset.bytes || remoteDigest.sha256 !== asset.sha256) {
        fail(`Existing release asset conflicts with local bytes: ${asset.name}.`);
      }
    }
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
  return local.filter((asset) => !remoteMap.has(asset.name));
}

function completeDraftRelease(remote, local, meta) {
  verifyRemoteMetadata(remote, meta, true);
  const missing = verifyRemoteAssets(remote, local, meta);
  if (missing.length) {
    runGh(['release', 'upload', meta.tag, ...missing.map((asset) => asset.path)]);
  }
  const uploaded = remoteRelease(meta.tag);
  if (!uploaded) fail(`Draft release ${meta.tag} disappeared after asset upload.`);
  verifyRemoteMetadata(uploaded, meta, true);
  const stillMissing = verifyRemoteAssets(uploaded, local, meta);
  if (stillMissing.length) fail(`Draft release is still missing assets after upload: ${stillMissing.map((item) => item.name).join(', ')}.`);
  runGh(['release', 'edit', meta.tag, '--draft=false']);
  const published = remoteRelease(meta.tag);
  if (!published) fail(`Release ${meta.tag} disappeared after publication.`);
  verifyRemoteMetadata(published, meta, false);
  const publishedMissing = verifyRemoteAssets(published, local, meta);
  if (publishedMissing.length) fail(`Published release is missing assets: ${publishedMissing.map((item) => item.name).join(', ')}.`);
  console.log(`[release-publish] OK: published ${meta.tag} after read-back verification of ${local.length} assets.`);
}

function verifyPublishedRelease(remote, local, meta) {
  verifyRemoteMetadata(remote, meta, false);
  const missing = verifyRemoteAssets(remote, local, meta);
  if (missing.length) {
    fail(`Existing public release is incomplete and will not be mutated: ${missing.map((item) => item.name).join(', ')}.`);
  }
  console.log(`[release-publish] OK: ${meta.tag} already exists with matching metadata and all asset bytes.`);
}

function main() {
  const tag = optionValue('--tag') || requireEnv('GITHUB_REF_NAME');
  const releaseConfig = JSON.parse(fs.readFileSync(path.join(rootDir, 'release.config.json'), 'utf8'));
  const tagPattern = new RegExp(releaseConfig.releaseTagPattern);
  if (!tagPattern.test(tag)) fail(`Release tag does not match ${releaseConfig.releaseTagPattern}: ${tag}.`);
  const commitSha = (optionValue('--release-commit') || optionValue('--commit') || process.env.GITHUB_SHA || '').toLowerCase();
  if (!/^[a-f0-9]{40}$/.test(commitSha)) fail('--release-commit/GITHUB_SHA must be a 40-character SHA.');
  const tagCommitSha = resolveTagCommit(tag);
  if (tagCommitSha !== commitSha) fail(`Tag ${tag} resolves to ${tagCommitSha}, not requested release commit ${commitSha}.`);
  verifyRemoteAnnotatedTag(tag, commitSha);
  const title = optionValue('--title') || process.env.RELEASE_TITLE;
  const distDir = path.resolve(optionValue('--dist') || path.join(rootDir, 'dist'));
  const notesFile = path.resolve(optionValue('--notes') || path.join(rootDir, 'release-notes.md'));
  if (!title || !fs.existsSync(notesFile)) fail('Release title and notes file are required.');
  const notes = fs.readFileSync(notesFile, 'utf8').replace(/\r\n/g, '\n');
  const primaryNames = [
    requireEnv('RELEASE_ASSET_NAME_AARCH64'),
    requireEnv('RELEASE_ASSET_NAME_X64'),
    requireEnv('RELEASE_ASSET_NAME_WINDOWS_X64'),
  ];
  const evidenceName = `${tag}.evidence.json`;
  const attestationName = `${tag}.acceptance-attestation.json`;
  const mandatorySidecars = [
    'SHA256SUMS',
    'release-asset-provenance.json',
    evidenceName,
    attestationName,
    'ReleaseAcceptanceSeal.json',
    'toolchain-evidence.json',
    'CycloneDX.json',
  ];
  const primary = localAssets(distDir, primaryNames);
  writeChecksums(primary, path.join(distDir, 'SHA256SUMS'));
  const seal = JSON.parse(fs.readFileSync(path.join(distDir, 'ReleaseAcceptanceSeal.json'), 'utf8'));
  if (seal.tag !== tag || seal.releaseCommitSha !== commitSha) fail('Release seal does not bind the requested tag/commit.');
  const createdAtUtc = git(['show', '-s', '--format=%cI', commitSha]);
  writeProvenance(primary, path.join(distDir, 'release-asset-provenance.json'), {
    tag,
    commitSha,
    sourceCommitSha: seal.sourceCommitSha,
    createdAtUtc,
    sealPath: path.join(distDir, 'ReleaseAcceptanceSeal.json'),
    attestationPath: path.join(distDir, attestationName),
    sbomPath: path.join(distDir, 'CycloneDX.json'),
    toolchainPath: path.join(distDir, 'toolchain-evidence.json'),
  });
  run(process.execPath, [
    path.join(rootDir, 'tools/verify_release_provenance.js'), '--dist', distDir,
    ...primaryNames.flatMap((name) => ['--primary', name]),
  ]);
  const local = localAssets(distDir, [...primaryNames, ...mandatorySidecars]);
  const meta = { tag, commitSha, title, notes };
  const remote = remoteRelease(tag);
  if (remote) {
    if (remote.isDraft === true) completeDraftRelease(remote, local, meta);
    else verifyPublishedRelease(remote, local, meta);
    return;
  }
  runGh([
    'release', 'create', tag, '--draft',
    '--verify-tag', '--title', title, '--notes-file', notesFile, '--target', commitSha,
  ]);
  const draft = remoteRelease(tag);
  if (!draft) fail(`Draft release ${tag} was not visible after creation.`);
  completeDraftRelease(draft, local, meta);
}

try { main(); } catch (error) {
  console.error(`[release-publish] ${error.message}`);
  process.exit(1);
}
