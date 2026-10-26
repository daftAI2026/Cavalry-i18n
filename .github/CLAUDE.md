# .github/
> L2 | 父级: ../CLAUDE.md

成员清单
ISSUE_TEMPLATE/: GitHub Issue Forms 用户报告入口；模板字段由子级地图维护，Issue 不自动收集或上传本地诊断数据。
workflows/: 唯一 CI/CD 工作流目录；定时仅做依赖巡检，不进入build或ci_gate；PR/main仍由可测试路径分类器选择必需检查；手动默认`none`，只有显式`macos-2.8-preflight`才跳过依赖漏洞扫描、等待同SHA源码门通过后在macos-26 ARM与macos-26-intel矩阵打包2.8.0，不跑Windows、不签updater、不创建Release；漏洞扫描失败仍阻断打包；2.7 p12 tag只作历史下载并拒绝重打包；2.8.0公开tag进入三平台runtime与Release发布闭包。

依赖边界:
.github 管理 GitHub 自动化与 Issue 报告入口；CI 路径分类由 `tools/classify_ci_changes.js` 统一决定，禁止 workflow 自造第二套 glob，也禁止用 `paths-ignore` 让必需检查悬空。Tauri 是唯一产品构建主线，Windows 与 macOS job 必须从源码现场生成原生库，中间 dylib/DLL 不得混入 source artifact；Updater artifact overlay 只允许 tag 生产流程读取受保护私钥；2.8.0 macOS-only预验不提供 no-tag updater-signing smoke，不能据此宣称密钥签名闭环。默认与2.8.0 production共用`latest.json`，不兼容宿主沿已有版本提示和p12下载入口；2.8.0公开tag由三平台runtime guard与发布闭包验证；名称/manifest读取所选profile，不旁路上传；Windows仍必须通过NSIS hooks与TEMP三文件哨兵生命周期门。

法则: 默认路径同步·CI 与本地一致·产物路径明确

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md

手动macOS预验的profile验证消费已checkout源码与固定Node；不依赖其他job工作目录。
