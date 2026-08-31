# Security Policy

## Supported releases

Only GitHub Releases published from `cavalry-2.7.2-p*` tags on commits already contained in `origin/main` and carrying the current verification sidecars are supported distribution channels.

- **macOS tag releases are currently ad-hoc signed and not notarized.** The Tauri Updater signature authenticates updater bytes against the public key embedded in the client; it does not create Apple platform trust. Users may need to repeat the documented Gatekeeper/ad-hoc steps after installing a new app bundle.
- **Windows Authenticode** signing and RFC3161 timestamping are required for production distribution but are tracked as a separate maintainer issue; do not treat an unsigned Windows EXE as a fully hardened release.

Neither production trust anchor has been published as of 2026-08-09, so no current release qualifies as a hardened release. A hardened tag requires **two different Ed25519 keys and two independently protected fingerprints**:

1. `RELEASE_ACCEPTANCE_ATTESTATION_PUBLIC_KEY_SHA256`: the offline acceptance authority signs only the repo-external canonical payload. Its private key never enters GitHub Actions and candidate repository code is never executed while that key is accessible.
2. `RELEASE_SEAL_PUBLIC_KEY_SHA256`: the release system signs the final asset/provenance seal. Its private key is a protected Actions secret and must not be the acceptance key.

Before the first such tag, maintainers must publish both lowercase SHA-256 fingerprints through separately protected, human-reviewed channels; configure the matching protected Actions environment variables; enable repository/environment/release protections; and record the responsible independent roles. `node tools/verify_release_trust_anchors.js` must accept the pair and rejects a reused key. Embedded public keys inside an attestation or `ReleaseAcceptanceSeal.json` are not trust anchors by themselves.

Rotation and revocation are independent: publish the replacement fingerprint and effective tag range through its own protected channel before use, retain the previous public fingerprint for historical verification, and explicitly mark a compromised fingerprint revoked. Never rotate one role by copying the other role's key, and never silently rewrite the fingerprint applicable to an already-published tag.

Once both fingerprints are published, download all assets into one directory and verify the trust-anchor independence, acceptance signature, and final seal in that order. Supply the exact independently published values—never copy a fingerprint from the files being checked:

```bash
export RELEASE_ACCEPTANCE_ATTESTATION_PUBLIC_KEY_SHA256=<acceptance-fingerprint-from-protected-channel>
export RELEASE_SEAL_PUBLIC_KEY_SHA256=<release-seal-fingerprint-from-protected-channel>

node tools/verify_release_trust_anchors.js
node tools/verify_release_acceptance_attestation.js \
  --evidence ./cavalry-2.7.2-pN.evidence.json \
  --attestation ./cavalry-2.7.2-pN.acceptance-attestation.json \
  --tag cavalry-2.7.2-pN \
  --trusted-public-key-sha256 "$RELEASE_ACCEPTANCE_ATTESTATION_PUBLIC_KEY_SHA256"
node tools/verify_release_acceptance_seal.js \
  --seal ./ReleaseAcceptanceSeal.json \
  --evidence ./cavalry-2.7.2-pN.evidence.json \
  --attestation ./cavalry-2.7.2-pN.acceptance-attestation.json \
  --tag cavalry-2.7.2-pN \
  --release-commit <40-char-release-commit> \
  --assets-dir . \
  --sidecars-dir . \
  --trusted-public-key-sha256 "$RELEASE_SEAL_PUBLIC_KEY_SHA256"
```

## Reporting a vulnerability

Please open a **private** security advisory on the GitHub repository, or contact the repository maintainers listed in `.github/CODEOWNERS`.

Include:

1. Affected release tag or commit SHA
2. Platform (macOS / Windows) and exact asset name
3. Impact description and reproduction steps
4. Whether the issue involves local Cavalry bundle patching, privilege elevation, or supply chain

Do **not** attach updater/release private keys, future Apple/Windows certificate material, notarization credentials, or any Actions secret values to issues or chat logs.

## Trust boundary (summary)

- The Switcher patches a user-selected local Cavalry installation.
- macOS expects App Management permission and re-signs the local `Cavalry.app`.
- Windows elevation is restricted to OS-known Program Files roots; custom writable roots use direct copy only.
- CI secrets (Tauri updater key, release-seal key, and any future platform-signing credentials) exist only as protected GitHub Actions secrets and are never printed; the independent acceptance private key is deliberately not a CI secret.

## Supply chain controls

- GitHub Actions are pinned to full commit SHAs (`tools/ci_action_pins.json`).
- Rust channel is pinned in `rust-toolchain.toml`.
- CI Python Qt bootstrap is hash-locked in `requirements-ci.txt`; `pip-audit` itself is separately hash-locked in `requirements-audit.txt`, and its report must exactly cover the canonical CPython 3.12.6/Linux active dependency set.
- Tag releases require commit-bound live macOS acceptance evidence under `release-seals/`.
- Acceptance attestation and final release seal use distinct trust anchors; candidate code only prepares/assembles detached acceptance signatures and never handles the offline private key.
- Release republish is digest-checked and fail-closed on conflict (`tools/release_publish.js`).
