# .github/
> L2 | 父级: /Users/luo/Desktop/ClaudeCode/web/Cavalry-i18n/CLAUDE.md

成员清单
workflows/: CI/CD 工作流目录，负责语法/合同验证、macOS 打包与 release 上传。

依赖边界:
.github 只描述自动化执行路径；默认构建切到 Tauri 后，workflow 也必须同步，不允许继续假装 Electron 是主线。

法则: 默认路径同步·CI 与本地一致·产物路径明确

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
