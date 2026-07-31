# macos-acceptance/
> L2 | 父级: ../CLAUDE.md

成员清单
acceptance_harness.js: macOS 定向 live matrix/v5 的唯一编排器；要求 producer 与产品来自同一 canonical repo，以 target contract/预期 executable SHA-256 绑定入口，并在每次 deep-sign stage 后把实际 executable/Qt runtime 与 21 次产品操作、48 个逻辑点、exact native-window 截图及人工 seal 逐层闭合。
artifact_identity.js: 证据身份原语；统一源码/记录/截图与 Mach-O 的 SHA-256、bytes、架构、UUID 和签名读取，保证 matrix 与 seal 不分叉计算。
build_acceptance_v2.sh: 原生 driver/helper 的无污染构建边界；compile-only 只接受 target contract 对应的 Qt 6.6.3 与仓库外空输出，live 构建另要求 `/Applications` 外且 runtime Qt 同版的 clone，两种模式都不启动 Cavalry。
check_contract.test.js: 跨平台静态合同；锁定 tracked source closure、GEB、800 行上限、真实媒体、exact-window 协议及 live 参数失败关闭，不冒充现场 PASS。
path_safety.js: 验收器的纯文件系统安全层；在写入/改权前统一拒绝 symlink 目标、真实路径越界及 repo/clone 内 session。
drivers/: 产品进程内语义 producer；主 driver 按普通 Qt 场景分片，补充 driver 处理 Onboarding 与 Transform，自身地图见 `drivers/CLAUDE.md`。
helpers/cgwindow_exact.swift: CoreGraphics 系统边界；只接受 driver 发布的 exact PID/native window number/owner，不用标题或 bounds 猜窗口。
fixtures/replace-source.png: macOS/Windows Assets Replace/Create 共用的 64×48 蓝色 identity fixture；由保留的 ffmpeg 配方再生，SHA-256 与最终 session 冻结输入一致。
fixtures/dynamic-proof-two.png: macOS/Windows Assets 动态模板共用的 64×48 红色第二 identity fixture；与 replace-source 内容、stem 均不同。
fixtures/replace-source.mp4: Tracking 场景的 64×48 H.264 真实媒体；再生 SHA-256 与最终 session 一致，只作为产品导入输入，不携带用户数据。

依赖边界
- 可复用 driver、helper、oracle、schema 与固定媒体输入进入 Git；编译产物、Cavalry clone、PID、日志、截图、人工 review 与 machine/final record 只进入仓库/clone 外的显式私有 session 目录。
- 本目录由 2026-07-29 任务日志恢复并按最终成功补丁序列重建；历史 `5bbc2099-...` PASS 仍只绑定当时冻结源码和证据，源码入库本身不产生新的 live PASS。
- 两枚 PNG fixture 从保留的 ffmpeg 配方确定性再生，并逐项匹配最终 session 的 frozen SHA-256；Windows Adjacent gate 只读复用同一最小媒体身份，双平台以后运行都重新冻结当前 Git 输入，不从已清理 Cache 借用证据。MP4 仍只服务 macOS Tracking。
- `check_contract.test.js` 进入全平台默认 CI，compile-only 进入无 Cavalry 的 PR macOS job；真实 matrix 仍要求 disposable Cavalry clone，任何 compile/static 结果都不能改写成 live PASS。

法则: 源码可交接·证据不伪造·副作用显式·运行输入可冻结

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
