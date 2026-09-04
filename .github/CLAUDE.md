# .github/
> L2 | 父级: ../CLAUDE.md

成员清单
workflows/: 唯一 CI/CD 工作流目录；普通 PR/main 先由可测试路径分类器选择文档、合同、依赖、Windows 与 macOS injector 证据，再由稳定 `ci_gate` 汇总所有选中/跳过结果；未知路径 fail-closed，必需检查始终结算；依赖变更即时审计并每周复审，tag/workflow_dispatch 无条件执行完整平台闭环；tag 生成双架构 ad-hoc macOS 包，以独立 Tauri updater 私钥生成三平台更新签名，并将三项安装包、两个 macOS archive、`latest.json`、`SHA256SUMS` 七项用户资产 exact readback 后发布。

依赖边界:
.github 只描述自动化执行路径；路径分类由 `tools/classify_ci_changes.js` 统一决定，禁止 workflow 自造第二套 glob，也禁止用 `paths-ignore` 让必需检查悬空。Tauri 是唯一产品构建主线，Windows 与 macOS job 必须从源码现场生成原生库，中间 dylib/DLL 不得混入 source artifact；Updater artifact overlay 只允许 tag 或显式 no-tag signing smoke 在受保护私钥环境产生，名称/manifest 必须读取 `release.config.json`，不得旁路上传；smoke 只能证明 updater 密钥闭包，不能冒充 live UI/安装 PASS；macOS compile-only 不冒充 live PASS，Windows 仍必须通过 NSIS hooks 与 TEMP 三文件哨兵生命周期门。

法则: 默认路径同步·CI 与本地一致·产物路径明确

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
