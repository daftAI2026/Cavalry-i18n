# .github/
> L2 | 父级: ../CLAUDE.md

成员清单
workflows/: CI/CD 工作流目录，负责 Linux 语法/合同验证、Windows Qt runtime/Rust check/test/NSIS 构建及随机 TEMP 安装卸载，并在 `cavalry-*-p*` release tag 汇合 Windows EXE 与双架构 macOS DMG 后发布；手动触发路径也可生成 macOS artifact。

依赖边界:
.github 只描述自动化执行路径；Tauri 是唯一构建主线，Windows 与 macOS job 必须调用各自本地同构入口，Windows artifact 上传前必须通过仓库安装态守门，发布元数据必须读取根目录 `release.config.json`。

法则: 默认路径同步·CI 与本地一致·产物路径明确

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
