#!/usr/bin/env node
/**
 * [INPUT]: release seal 与 independent acceptance attestation 的两个受保护 Ed25519 SPKI SHA-256 fingerprints。
 * [OUTPUT]: 要求二者均为 lowercase SHA-256 且互不相同；任何缺失/复用同一 signer 都 fail-closed。
 * [POS]: release-production 双人/双密钥独立性机器合同。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
'use strict';
const args = process.argv.slice(2);
function opt(name) {
  const index = args.indexOf(name);
  if (index < 0) return null;
  const value = args[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`${name} requires a value.`);
  return value;
}
try {
  const release = opt('--release-seal-public-key-sha256') || process.env.RELEASE_SEAL_PUBLIC_KEY_SHA256;
  const acceptance = opt('--acceptance-public-key-sha256') ||
    process.env.RELEASE_ACCEPTANCE_ATTESTATION_PUBLIC_KEY_SHA256;
  if (!/^[a-f0-9]{64}$/.test(release || '')) {
    throw new Error('RELEASE_SEAL_PUBLIC_KEY_SHA256 must be a lowercase SHA-256 fingerprint.');
  }
  if (!/^[a-f0-9]{64}$/.test(acceptance || '')) {
    throw new Error('RELEASE_ACCEPTANCE_ATTESTATION_PUBLIC_KEY_SHA256 must be a lowercase SHA-256 fingerprint.');
  }
  if (release === acceptance) {
    throw new Error('Release seal and acceptance attestation must use independent public keys.');
  }
  console.log('[verify-release-trust-anchors] OK: independent release and acceptance trust anchors');
} catch (error) {
  console.error(`[verify-release-trust-anchors] ${error.message}`);
  process.exit(1);
}
