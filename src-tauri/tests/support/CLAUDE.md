# support/
> L2 | 父级: ../CLAUDE.md

成员清单
windows_disposable.rs: Windows ignored smoke 的共享路径安全边界；只接受显式环境变量指向的 `%TEMP%` 严格子目录和 disposable sentinel，把 drive/verbatim/8.3 拼写统一为规范路径身份，并对安装根、证据根、JSON/plugin/marker 及 QPA root/recovery/固定临时目标执行 canonical containment 与逐级 reparse 拒绝。

依赖边界:
support 只服务 ignored integration smoke；它可以依赖公开的 `InstallLayout`/`CopyPair` 数据结构，但不得调用产品 command、启动进程或自行删除用户路径。

法则: 显式目标·双重证明·逐目标守卫·无破坏性 fallback

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
