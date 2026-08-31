<!--
[INPUT]: 依赖 README.md 的 release acceptance seal 合同、source commit 9e293df 的 Windows final record、Issue #12/#13 与 Mac 发布主机
[OUTPUT]: 对外提供下一次 Cavalry 2.7.2 发布的当前阻塞项、执行顺序与完成条件
[POS]: release-seals 的临时执行清单；只维护尚未完成的发布动作，完成后将事实沉淀到审计文档并清空本清单
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
-->

# Cavalry 2.7.2 发布验收 handoff 待办

> 本文保留 source commit `9e293df` 时的 Windows/macOS acceptance 交接债务，不代表当前候选已回到该提交。当前 UI/Updater/tag 执行状态以 [`docs/roadmap/switcher-update-release-event-ledger.md`](../docs/roadmap/switcher-update-release-event-ledger.md) 为准；新候选改变 source commit 后，本文的旧证据不得直接复用。

## Handoff 时的状态

```text
source commit S            = 9e293df26191bc638e81f343033b2dbada8c8aba
Windows local acceptance   = PASS-15-OF-15
Windows Issue #16          = CLOSED
macOS acceptance for S     = PENDING-MAC-LIVE
combined release evidence  = BLOCKED-RAW-WINDOWS-SESSION
Issue #12                  = OPEN
tracking Issue #13         = OPEN
tag / GitHub Release       = NOT CREATED
```

## 1. 恢复可复验的 Windows 原始 session

- [ ] 在 source commit S 上重跑 Windows release acceptance，并保留 verifier 会重新读取的 disposable clone、installer、provenance、已安装 DLL、截图和 inventory，直到 combined evidence 完成。
- [ ] 人工复核后保留 final record；`windows-acceptance-summary-*.json` 只用于阅读，不能替代 `--windows-session-dir` 的原始输入。
- [ ] 如果不重跑，则另开代码 PR，把 Windows session 改成经过回归测试的自包含证据包；不得手改路径或伪造 PASS。

## 2. 在 Mac 上验证同一个 source commit

- [ ] 从干净 worktree 检出 S，确认 HEAD 精确匹配且没有 dirty/untracked 文件。
- [ ] 固定 Node.js 24.20.0、npm 11.19.0、Qt 6.6.3 和 Cavalry 2.7.2；使用 disposable clone，不修改真实 `/Applications/Cavalry.app`。
- [ ] 按 [`README.md`](./README.md) 和 `LOCAL_BUILD_SOP.md` 执行当前 macOS live acceptance，完成人工 review，并生成受控 final record。
- [ ] 如果候选代码或验收 oracle 发生修改，先通过独立 PR；source commit 改变后，Windows 与 Mac 证据都必须重新绑定新 commit。

## 3. 生成 evidence 与独立 attestation

- [ ] 在仍停留于 S 的干净 worktree 中，以 Mac final session 和可复验的 Windows 原始 session 生成 canonical evidence payload。
- [ ] 在仓库外使用独立 OpenSSL/HSM signer 签署 payload；私钥不得进入仓库、候选进程或 Actions secret。
- [ ] 带回 detached signature 与 public SPKI DER，完成 trust-anchor、attestation 和 evidence 校验。
- [ ] 创建 evidence commit T。T 的唯一父提交必须是 S，唯一 diff 必须是对应 tag 的 evidence 与 acceptance-attestation 两个 JSON。

## 4. 从受保护 tag 流水线完成发布

- [ ] 选择新的 `cavalry-2.7.2-pN`，不复用历史示例编号。
- [ ] 合并或推送 T 后检查 tag topology，再由受保护 GitHub environment 完成双架构 ad-hoc DMG、macOS updater archive/签名、Windows NSIS/签名、`latest.json`、SBOM、toolchain evidence、schema v4 provenance、schema v6 seal 和九项分发资产 exact readback。Apple Developer ID/notarization 与 Windows Authenticode 均不冒充当前前提。
- [ ] 发布成功后关闭 #12，再关闭总跟踪 #13。
- [ ] 发布完成后更新本次经验文档，再单独提交；该文档提交不能插入 S 与 T 之间。

## 当前禁止动作

- 不从未进入 `origin/main` 的旁支、dirty worktree 或非 evidence commit T 创建 tag；GitHub Release 只由受保护 tag workflow 发布。
- 不在 Mac live acceptance 前合并会改变 source commit S 的提交。
- 不用旧 Mac session、Windows summary、手写 PASS 或修改记录路径绕过 verifier。
- 不把 Windows `15/15` 扩写成 Windows 全表面或 repository-wide `ALL GATES PASS`。
