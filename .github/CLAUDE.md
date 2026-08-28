# .github/
> L2 | 父级: ../CLAUDE.md

成员清单
workflows/: CI/CD 工作流目录，负责无原生库源码闭包、跨平台 Qt/runtime 现场构建、Rust/合同/漏洞/acceptance 门、Windows NSIS 生命周期与 tag 双架构 macOS notarization；tag 另以独立 Tauri updater 私钥生成 macOS archive/签名和 Windows NSIS 签名，汇合 `latest.json` 后通过 schema v5 九资产 seal/private-draft exact readback 发布；普通 PR/main 与手动 ad-hoc 路径不接触 updater 私钥，显式 no-tag signing smoke 仅在受保护环境生成 macOS 候选并用客户端公钥验签。

依赖边界:
.github 只描述自动化执行路径；Tauri 是唯一产品构建主线，Windows 与 macOS job 必须从源码现场生成原生库，中间 dylib/DLL 不得混入 source artifact；Updater artifact overlay 只允许 tag 或显式 no-tag signing smoke 在受保护私钥环境产生，名称/manifest 必须读取 `release.config.json`，不得旁路上传；smoke 只能证明 updater 密钥闭包，不能冒充 live UI/安装 PASS；macOS compile-only 不冒充 live PASS，Windows 仍必须通过 NSIS hooks 与 TEMP 三文件哨兵生命周期门。

法则: 默认路径同步·CI 与本地一致·产物路径明确

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
