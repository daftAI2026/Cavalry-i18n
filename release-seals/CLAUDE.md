# release-seals/
> L2 | 父级: ../CLAUDE.md

成员清单
README.md: release tag 前置 acceptance evidence/attestation 与最终资产 seal 的操作合同；说明 source commit、evidence-only commit、外部 detached signer、双 trust anchor 及 tag/release 的 fail-closed 顺序。
TODO.md: 下一次 Cavalry 2.7.2 发布的临时执行清单；集中维护 Mac live、可复验 Windows 原始 session、双平台 evidence、外部 attestation、tag 和发布状态。

依赖边界:
- 本目录只跟踪流程合同和发布待办，不保存 live session、截图、私钥或最终发布资产。
- `cavalry-2.7.2-pN.evidence.json` 与对应 acceptance attestation 只有在真实 macOS Cavalry 2.7.2 21-run/48-point session 完成后，才可按 README 的 evidence-only 两提交协议生成并提交。
- `ReleaseAcceptanceSeal.json` 是最终资产、SBOM、toolchain evidence 与签名的发布产物，不是本目录的运行时真相源。

法则: 证据来自现场·私钥在库外·tag 绑定提交·缺证据即失败关闭

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
