<!--
[INPUT]: 依赖当前 GitHub Release 资产、tag workflow、Tauri updater 信任边界与平台签名现状
[OUTPUT]: 对外提供受支持分发渠道、漏洞上报方式、下载校验方法与当前未具备的平台信任声明
[POS]: 根目录安全政策；描述公开资产的真实信任能力，不替代 LOCAL_BUILD_SOP 的发布操作步骤
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
-->

# Security Policy

## Supported releases

GitHub Releases is the only supported binary distribution channel. A release is covered by the current updater/sidecar closure only when its `cavalry-2.7.2-p*` tag commit is already contained in `origin/main` and the protected workflow has produced and exactly read back the current verification sidecars and nine distribution assets. Older releases that contain only the three manual installers predate this closure and must not be interpreted as updater-enabled or hardened by the newer workflow.

- **macOS tag releases are currently ad-hoc signed and not notarized.** The Tauri Updater signature authenticates updater bytes against the public key embedded in the client; it does not create Apple platform trust. Users may need to repeat the documented Gatekeeper/ad-hoc steps after installing a new app bundle.
- **Windows tag installers are currently not Authenticode signed.** Authenticode and RFC3161 timestamping remain a separate future capability, not a current tag prerequisite; do not treat the unsigned EXE as Windows platform-trusted.

Each updater-enabled release uses one dedicated Tauri Updater Ed25519 key. The public key is embedded in the client; the protected private key is available only to tag packaging jobs. This signature authenticates updater archives and the Windows updater installer. Manual downloads remain verifiable through the published `SHA256SUMS` and `release-asset-provenance.json`, which also bind the SBOM and producer toolchain record.

After downloading all required assets into one directory, verify the checksum file with the platform SHA-256 tool. The provenance file records the same byte identities and explicitly states the current platform-signing limits:

```bash
shasum -a 256 -c SHA256SUMS
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
- macOS attempts the durable write transaction directly and re-signs the local `Cavalry.app`; App Management guidance appears only if the real transaction returns a typed permission denial.
- Windows elevation is restricted to OS-known Program Files roots; custom writable roots use direct copy only.
- CI secrets (the Tauri updater key and any future platform-signing credentials) exist only as protected GitHub Actions secrets and are never printed.

## Supply chain controls

- GitHub Actions are pinned to full commit SHAs (`tools/ci_action_pins.json`).
- Rust channel is pinned in `rust-toolchain.toml`.
- CI Python Qt bootstrap is hash-locked in `requirements-ci.txt`; `pip-audit` itself is separately hash-locked in `requirements-audit.txt`, and its report must exactly cover the canonical CPython 3.12.6/Linux active dependency set.
- Tag releases must point to a commit already contained in `origin/main`; fixed-label platform jobs rebuild the artifacts and verify the updater closure.
- Release publication uses a private draft, uploads all expected assets, downloads every asset for byte comparison, and only then makes the Release public (`tools/release_publish.js`).
- Existing public releases are immutable under the publisher: missing, extra, or conflicting assets fail closed instead of being overwritten.
