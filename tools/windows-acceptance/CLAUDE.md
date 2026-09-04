# tools/windows-acceptance/
> L2 | parent: ../CLAUDE.md

Member map

- `acceptance_contract.js`: fail-closed verifier for a Windows x64 Cavalry 2.7.2 release session; consumes the shared NSIS provenance structure while independently recomputing installer/signature/fingerprint/shipped DLL identities, then binds TEMP sentinels, process/runtime inventory, screenshots, release tag/source commit/session, and manual review to one declared onboarding/adjacent matrix profile.
- `record_windows_acceptance.js`: optional Windows x64 maintainer-review CLI; derives a portable `WindowsReleaseAcceptance` summary from a verified session and refuses hand-written PASS flags or existing output.
- `review_windows_acceptance.js`: interactive review boundary; presents only machine-record screenshot paths, derives approved review/final records after each existing image is confirmed, and never accepts a user-supplied PASS/result/point set.
- `check_contract.test.js`: fixture-only producer→verifier round-trip and mutation tests; provenance fixtures come from the production document constructor so a producer schema change cannot leave the acceptance test on an obsolete hand-written shape; never launches Cavalry or touches Program Files.

The session producer is intentionally separate from the acceptance-only Qt plugin. Rust writes machine evidence only; the reviewer creates review/final records; the portable producer verifies the result. A valid summary is a derived maintainer-review artifact, not a tag or publish prerequisite. The formal release closure independently binds the CI-built NSIS, updater signature, checksums, SBOM, toolchain evidence, and public provenance.

法则: 现场证据必须来自 disposable `%TEMP%`；路径、字节、版本和矩阵均 fail-closed。
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
