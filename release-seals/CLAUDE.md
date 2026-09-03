# release-seals/
> L2 | 父级: ../CLAUDE.md

成员清单
README.md: release tag 前置 acceptance evidence/attestation 与 schema v6 最终资产 seal 的操作合同；说明 source/evidence-only commit、外部 detached signer、双 trust anchor、macOS ad-hoc 声明，以及人工安装/updater 九项分发资产进入 private-draft exact readback 的 fail-closed 顺序。

依赖边界:
- 本目录只跟踪稳定流程合同，不保存内部发布待办、live session、截图、私钥或最终发布资产。
- `cavalry-2.7.2-pN.evidence.json` 与对应 acceptance attestation 只有在真实 macOS Cavalry 2.7.2 21-run/48-point session 完成后，才可按 README 的 evidence-only 两提交协议生成并提交。
- `ReleaseAcceptanceSeal.json` 是最终资产、SBOM、toolchain evidence 与签名的发布产物，不是本目录的运行时真相源。

法则: 证据来自现场·私钥在库外·tag 绑定提交·缺证据即失败关闭

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
