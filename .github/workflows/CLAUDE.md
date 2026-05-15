# workflows/
> L2 | 父级: /Users/luo/Desktop/ClaudeCode/web/Cavalry-i18n/.github/CLAUDE.md

成员清单
build.yml: 主 CI/CD 工作流，支持手动触发、main/PR/tag 自动触发；main/PR 只跑版本元数据、Node/Rust 合同与翻译质量验证；`v*` tag 与手动触发才在 macOS 上构建 Tauri DMG 与 `.app` artifact；`v*` tag 以产品名标题和产品介绍型 release notes 发布 DMG 到 GitHub Releases。

依赖边界:
workflow 只调用仓库里已经存在的脚本与构建入口；默认 build 变更时这里必须同构更新。

法则: 脚本唯一·产物可追踪·release 不漂移

变更日志
2026-05-14: `build.yml` 增加 `workflow_dispatch` 与 `npm run check:version`，让 GitHub 可手动自助打包，同时阻止版本漂移进入 CI 产物。
2026-05-14: macOS packaging 增加本地 `aqt-venv` 并通过 `PYTHON` 传入 resolver，避开 GitHub macOS 系统 Python 的 PEP 668 管理限制；构建步骤按 `LOCAL_BUILD_SOP.md` 显式执行 `CSC_IDENTITY_AUTO_DISCOVERY=false`、`APPLE_SIGNING_IDENTITY="-"`、`npm run tauri:build`、DMG 盖章，以及除 `manual-smoke`/GUI window regression 外的 SOP 验证门；GitHub clean checkout 不执行本地 stale bundle 清理。
2026-05-15: packaging artifact 与 tag Release 回归直接发布 `*.dmg`，对齐常见 GitHub 桌面应用 Release 结构。
2026-05-15: release job 改为 `Cavalry Language Switcher vX.Y.Z` 标题和手写 release notes，避免只输出自动 changelog 链接；macOS packaging 在 Tauri build 前 `unset CI`，避免 create-dmg 跳过 Finder 美化，并新增 DMG 布局挂载验证。
2026-05-15: release notes 模板改为第一次发布可读的产品说明，中文为主并补充日文短说明与英文独立工具声明，包含用途、支持语言、权限提醒和下载入口，不在用户侧 Release 说明中展示内部 SOP 构建验证细节。
2026-05-15: macOS packaging job 限制为 `v*` tag 与手动触发，main/PR push 不再自动生成 macOS DMG artifact；Release 继续只由 `v*` tag 创建。
2026-05-15: macOS packaging 显式设置 `APPLE_SIGNING_IDENTITY="-"`，让 GitHub runner 走与本地一致的 Tauri ad-hoc bundle signing，避免 release DMG 安装后缺少 `CodeResources` 被 Gatekeeper 判定 damaged。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
