/**
 * [INPUT]: release seal unsigned JSON plus an Ed25519 private/public key pair.
 * [OUTPUT]: deterministic canonical payload digest, detached Ed25519 signature, and fail-closed verification helpers.
 * [POS]: release seal cryptographic boundary; no caller may sign mutable artifact metadata outside this payload.
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
'use strict';
const crypto = require('node:crypto');

function fail(message) { throw new Error(message); }
function canonicalize(value) {
  if (value === null || typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  if (!value || typeof value !== 'object') fail('Seal payload contains an unsupported value.');
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(',')}}`;
}
function payloadBytes(seal) {
  const copy = { ...seal };
  delete copy.signature;
  return Buffer.from(canonicalize(copy), 'utf8');
}
function sha256(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function publicKeyInfo(key) {
  const publicKey = crypto.createPublicKey(key);
  if (publicKey.asymmetricKeyType !== 'ed25519') fail('Release seal key must be Ed25519.');
  const der = publicKey.export({ type: 'spki', format: 'der' });
  return { der, sha256: sha256(der), base64: der.toString('base64') };
}
function signSeal(seal, privateKeyPem, trustedFingerprint) {
  if (!privateKeyPem) fail('RELEASE_SEAL_PRIVATE_KEY is required to sign the release seal.');
  const privateKey = crypto.createPrivateKey(privateKeyPem);
  if (privateKey.asymmetricKeyType !== 'ed25519') fail('RELEASE_SEAL_PRIVATE_KEY must be an Ed25519 private key.');
  const publicInfo = publicKeyInfo(privateKey);
  if (!/^[a-f0-9]{64}$/.test(trustedFingerprint || '')) {
    fail('A lowercase RELEASE_SEAL_PUBLIC_KEY_SHA256 trust anchor is required.');
  }
  if (publicInfo.sha256 !== trustedFingerprint) fail('Signing key does not match RELEASE_SEAL_PUBLIC_KEY_SHA256.');
  const payload = payloadBytes(seal);
  return {
    algorithm: 'ed25519',
    payloadSha256: sha256(payload),
    publicKeySpkiBase64: publicInfo.base64,
    publicKeySha256: publicInfo.sha256,
    signatureBase64: crypto.sign(null, payload, privateKey).toString('base64'),
  };
}
function detachedSignature(seal, publicKeyDer, signatureBytes, trustedFingerprint) {
  if (!Buffer.isBuffer(publicKeyDer) || publicKeyDer.length === 0) {
    fail('Detached signature requires a non-empty Ed25519 SPKI DER public key.');
  }
  if (!Buffer.isBuffer(signatureBytes) || signatureBytes.length === 0) {
    fail('Detached signature bytes are required.');
  }
  if (!/^[a-f0-9]{64}$/.test(trustedFingerprint || '')) {
    fail('A lowercase trusted public-key SHA-256 fingerprint is required.');
  }
  let publicKey;
  try {
    publicKey = crypto.createPublicKey({ key: publicKeyDer, type: 'spki', format: 'der' });
  } catch (error) {
    fail(`Detached Ed25519 public key is invalid: ${error.message}`);
  }
  if (publicKey.asymmetricKeyType !== 'ed25519') fail('Detached public key must be Ed25519.');
  const fingerprint = sha256(publicKeyDer);
  if (fingerprint !== trustedFingerprint) {
    fail('Detached signing key does not match the protected public-key fingerprint.');
  }
  const payload = payloadBytes(seal);
  if (!crypto.verify(null, payload, publicKey, signatureBytes)) {
    fail('Detached Ed25519 signature does not verify over the canonical payload.');
  }
  return {
    algorithm: 'ed25519',
    payloadSha256: sha256(payload),
    publicKeySpkiBase64: publicKeyDer.toString('base64'),
    publicKeySha256: fingerprint,
    signatureBase64: signatureBytes.toString('base64'),
  };
}
function verifySealSignature(seal, trustedFingerprint) {
  if (!/^[a-f0-9]{64}$/.test(trustedFingerprint || '')) fail('A lowercase trusted public-key SHA-256 fingerprint is required to verify the release seal.');
  const signature = seal.signature;
  if (!signature || typeof signature !== 'object') fail('Seal cryptographic signature is missing.');
  if (signature.algorithm !== 'ed25519') fail('Seal signature algorithm must be ed25519.');
  if (!/^[a-f0-9]{64}$/.test(signature.payloadSha256 || '') || !/^[a-f0-9]{64}$/.test(signature.publicKeySha256 || '')) {
    fail('Seal signature digests are invalid.');
  }
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(signature.publicKeySpkiBase64 || '') || !/^[A-Za-z0-9+/]+={0,2}$/.test(signature.signatureBase64 || '')) {
    fail('Seal signature encoding is invalid.');
  }
  if (signature.publicKeySha256 !== trustedFingerprint) {
    fail('Seal public key does not match the required trust anchor.');
  }
  const der = Buffer.from(signature.publicKeySpkiBase64, 'base64');
  if (sha256(der) !== signature.publicKeySha256) fail('Seal embedded public key fingerprint mismatch.');
  let publicKey;
  try { publicKey = crypto.createPublicKey({ key: der, type: 'spki', format: 'der' }); } catch (error) { fail(`Seal public key is invalid: ${error.message}`); }
  if (publicKey.asymmetricKeyType !== 'ed25519') fail('Seal embedded key must be Ed25519.');
  const payload = payloadBytes(seal);
  if (sha256(payload) !== signature.payloadSha256) fail('Seal canonical payload digest mismatch.');
  if (!crypto.verify(null, payload, publicKey, Buffer.from(signature.signatureBase64, 'base64'))) {
    fail('Seal Ed25519 signature verification failed.');
  }
}
module.exports = {
  canonicalize,
  detachedSignature,
  payloadBytes,
  sha256,
  signSeal,
  verifySealSignature,
};
