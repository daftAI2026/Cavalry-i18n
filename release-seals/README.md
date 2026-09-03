<!--
[INPUT]: 依赖 tools/macos-acceptance 的真实 final session、Windows 发布所需原始 acceptance session、完整人工安装/updater 分发闭包与 evidence-only tag commit 协议
[OUTPUT]: 说明 source commit S、evidence commit T、外部 detached acceptance signer、独立双 trust anchor、ad-hoc macOS tag 与 schema v6 CI asset seal 的不可自引用绑定
[POS]: release-seals 目录操作合同；这里只提交 pre-tag evidence，最终资产 seal 随 GitHub Release 发布
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
-->

# Release acceptance seals

Tag releases are **fail-closed** without commit-bound live macOS acceptance evidence.

## Required before tagging

1. On a clean source commit **S**, run and manually seal the live macOS 21-run / 48-point gate (`tools/macos-acceptance`).
2. Derive evidence from that real final session (never pass a hand-written result, id, or digest):

```bash
node tools/create_release_acceptance_evidence.js \
  --tag cavalry-2.7.2-pN \
  --session-dir "$SESSION_DIR"
```

3. Ask candidate code to prepare the canonical signing payload **outside the repository**. Sign those exact bytes in an offline OpenSSL/HSM process that never checks out or executes candidate code; only the detached signature and public SPKI DER return for verified assembly. The acceptance private key must never be an Actions secret or candidate-process environment variable. Follow the exact commands in `LOCAL_BUILD_SOP.md`.
4. Verify that the acceptance-authority fingerprint and final release-seal fingerprint are both externally published and different (`node tools/verify_release_trust_anchors.js`), then create commit **T** whose only diff from S is exactly these two canonical files:
   - `release-seals/cavalry-2.7.2-pN.evidence.json`
   - `release-seals/cavalry-2.7.2-pN.acceptance-attestation.json`
5. Merge/push T to `main`, verify it with `--check-tag-topology`, then tag T.

The split is intentional: evidence records S, while T carries that evidence. Requiring the evidence file to contain T would be a cryptographic self-reference and can never be satisfied.

## What CI does on the tag

1. Verifies T has exactly one parent S, changes only the canonical evidence and independent attestation files, rejects missing/equal trust anchors, validates the attestation against the protected external acceptance fingerprint, and proves the evidence binds S / tag / Cavalry 2.7.2 / Qt 6.6.3 / the verified session digests.
2. Builds both macOS DMGs with an explicit ad-hoc app signature, builds the independently Ed25519-signed Tauri updater archives, and verifies the final app seal and updater signatures. Apple Developer ID and notarization credentials are not current tag prerequisites and are not claimed.
3. Computes asset digests, consumes the committed evidence and attestation to mint the separately keyed schema v6 `ReleaseAcceptanceSeal.json` plus schema v4 provenance, records `macos: ad-hoc`, verifies both signatures again, and keeps the GitHub Release private until evidence, attestation, SBOM, toolchain evidence, provenance, seal, hashes, three manual installers, and six updater manifest/archive/signature assets have been uploaded and read back exactly.

## Windows

Windows Authenticode signing is **not** claimed by these seals. Track it as a separate maintainer issue.
