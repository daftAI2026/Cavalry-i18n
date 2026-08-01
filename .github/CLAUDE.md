# .github/
> L2 | 父级: ../CLAUDE.md

成员清单
workflows/: CI/CD 工作流目录，负责上传排除 dylib/DLL 的源码闭包、Linux 语法/合同验证、Windows Qt generic/QPA、macOS product injector 与 tracked acceptance producer 的分平台现场构建、Rust check/test、NSIS 双 DLL provenance、无 Cavalry/QPA hook 入口合同及随机 TEMP 安装/同版本更新/卸载三文件哨兵守门，并在 `cavalry-*-p*` release tag 汇合 Windows EXE 与双架构 macOS DMG 后发布；手动触发路径也可生成 macOS artifact。

依赖边界:
.github 只描述自动化执行路径；Tauri 是唯一产品构建主线，Windows 与 macOS job 必须调用各自本地同构入口并从源码现场生成原生库，中间 dylib/DLL 不得混入 source artifact 或独立冒充发布资产；macOS acceptance compile-only 只防 producer 腐烂，不得写作 live PASS；Windows artifact 上传前必须通过 NSIS hooks 无 Cavalry/QPA 写入入口合同，并在真实 install → 同版本 `/UPDATE` → uninstall 中保持独立 TEMP 三文件哨兵字节不变；发布元数据必须读取根目录 `release.config.json`。

法则: 默认路径同步·CI 与本地一致·产物路径明确

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
