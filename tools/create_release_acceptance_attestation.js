#!/usr/bin/env node
/**
 * [INPUT]: canonical committed evidence；prepare 模式只生成 repo 外 canonical payload；assemble 模式只接收 detached signature、公钥 DER 与公开 fingerprint。
 * [OUTPUT]: 私钥永不进入候选仓库进程；独立 OpenSSL/HSM signer 对 payload bytes 签名后，本工具验签并组装 canonical acceptance attestation。
 * [POS]: acceptance 独立签名边界；候选源码只能准备/验证公开数据，不能读取或接触长期离线私钥。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {
  validateEvidence,
  sha256File,
} = require('./release_acceptance_contract');
const {
  canonicalize,
  detachedSignature,
  payloadBytes,
} = require('./release_seal_signature');

const args = process.argv.slice(2);
const root = process.cwd();
function fail(message) { throw new Error(message); }
function opt(name) {
  const index = args.indexOf(name);
  if (index < 0) return null;
  const value = args[index + 1];
  if (!value || value.startsWith('--')) fail(`${name} requires a value.`);
  return value;
}
function regular(file, label) {
  const requested = path.resolve(file);
  const absolute = fs.realpathSync(requested);
  const stat = fs.lstatSync(absolute);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size < 1) {
    fail(`${label} must be a canonical regular non-empty file.`);
  }
  return { absolute, stat };
}
function evidenceInput() {
  const tag = opt('--tag');
  const evidenceValue = opt('--evidence');
  if (!tag || !evidenceValue) fail('--tag and --evidence are required.');
  const evidenceFile = regular(evidenceValue, 'Evidence');
  const evidence = validateEvidence(JSON.parse(fs.readFileSync(evidenceFile.absolute, 'utf8')));
  if (evidence.tag !== tag || path.basename(evidenceFile.absolute) !== `${tag}.evidence.json`) {
    fail('Evidence tag/name mismatch.');
  }
  return { tag, evidence, evidenceFile };
}
function derivedPayload({ tag, evidence, evidenceFile }, createdAtUtc, createdBy) {
  return {
    schemaVersion: 1,
    kind: 'ReleaseAcceptanceAttestation',
    tag,
    sourceCommitSha: evidence.sourceCommitSha,
    evidence: {
      name: path.basename(evidenceFile.absolute),
      bytes: evidenceFile.stat.size,
      sha256: sha256File(evidenceFile.absolute),
    },
    targetCavalryVersion: evidence.targetCavalryVersion,
    qtVersion: evidence.qtVersion,
    languages: evidence.languages,
    matrix: evidence.macosAcceptance.matrix,
    host: evidence.macosAcceptance.host,
    createdAtUtc,
    createdBy,
  };
}
function requireOutsideRepository(output, label) {
  const absolute = path.resolve(output);
  if (fs.existsSync(absolute)) fail(`${label} must name an absent file.`);
  const rootReal = fs.realpathSync(root);
  const parentReal = fs.realpathSync(path.dirname(absolute));
  const canonical = path.join(parentReal, path.basename(absolute));
  const relative = path.relative(rootReal, canonical);
  if (relative === '' || (relative !== '..' && !relative.startsWith(`..${path.sep}`))) {
    fail(`${label} must stay outside the candidate repository.`);
  }
  return canonical;
}
function prepare(input) {
  const output = requireOutsideRepository(opt('--prepare'), '--prepare');
  const createdAtUtc = opt('--created-at') || new Date().toISOString();
  const createdBy = opt('--created-by') || process.env.USER || 'unknown';
  if (!Number.isFinite(Date.parse(createdAtUtc)) || !createdBy) {
    fail('Prepared attestation createdAtUtc/createdBy is invalid.');
  }
  const payload = derivedPayload(input, createdAtUtc, createdBy);
  const bytes = payloadBytes(payload);
  fs.writeFileSync(output, bytes, { flag: 'wx', mode: 0o444 });
  console.log(`[prepare-release-acceptance-attestation] wrote ${output}`);
  console.log('[prepare-release-acceptance-attestation] sign these exact bytes with an external OpenSSL/HSM process that never runs candidate code.');
}
function assemble(input) {
  const payloadFile = regular(opt('--payload') || '', 'Prepared canonical payload');
  const publicKey = regular(opt('--public-key-spki-der') || '', 'Public-key SPKI DER');
  const signature = regular(opt('--signature') || '', 'Detached signature');
  const raw = fs.readFileSync(payloadFile.absolute);
  let payload;
  try { payload = JSON.parse(raw.toString('utf8')); }
  catch (error) { fail(`Prepared payload is not JSON: ${error.message}`); }
  const canonical = payloadBytes(payload);
  if (!raw.equals(canonical)) fail('Prepared payload bytes are not the exact canonical signing payload.');
  const expected = derivedPayload(input, payload.createdAtUtc, payload.createdBy);
  if (canonicalize(payload) !== canonicalize(expected)) {
    fail('Prepared payload does not exactly match the verified evidence.');
  }
  const trust = opt('--trusted-public-key-sha256') ||
    process.env.RELEASE_ACCEPTANCE_ATTESTATION_PUBLIC_KEY_SHA256;
  const attestation = {
    ...payload,
    signature: detachedSignature(
      payload,
      fs.readFileSync(publicKey.absolute),
      fs.readFileSync(signature.absolute),
      trust
    ),
  };
  const expectedOutput = path.join(root, 'release-seals', `${input.tag}.acceptance-attestation.json`);
  const output = path.resolve(opt('--output') || expectedOutput);
  if (output !== expectedOutput) fail(`Attestation output must use the canonical release-seals path: ${expectedOutput}.`);
  fs.writeFileSync(output, `${JSON.stringify(attestation, null, 2)}\n`, { flag: 'wx', mode: 0o444 });
  console.log(`[create-release-acceptance-attestation] wrote ${path.relative(root, output)}`);
}
function main() {
  if (process.env.RELEASE_ACCEPTANCE_ATTESTATION_PRIVATE_KEY) {
    fail('Do not expose RELEASE_ACCEPTANCE_ATTESTATION_PRIVATE_KEY to candidate repository code.');
  }
  const input = evidenceInput();
  const prepareValue = opt('--prepare');
  const assembleMode = args.includes('--assemble');
  if (Boolean(prepareValue) === Boolean(assembleMode)) {
    fail('Choose exactly one mode: --prepare <repo-outside-file> or --assemble.');
  }
  if (prepareValue) prepare(input);
  else assemble(input);
}
try { main(); } catch (error) {
  console.error(`[create-release-acceptance-attestation] ${error.message}`);
  process.exit(1);
}
