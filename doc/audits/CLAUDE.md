# audits/
> L2 | 父级: /Users/luo/Desktop/ClaudeCode/web/Cavalry-i18n/doc/CLAUDE.md

成员清单
audit_report.md: Runtime UI Tail Cleanup 深度代码审查，覆盖 TS 数据层验证、injector 根因分析与 aboutToShow 竞态修复路径。
runtime-translation-noise-triage-2026-05-19.md: 2026-05-19 运行时翻译噪声分诊审计报告，覆盖 21 个可疑 token（如 Rhu、Rfr）的排查结论与证据链。
runtime-ui-tail-cleanup-run-2026-05-16.md: Runtime UI 收尾清理实跑记录，记录 zh-Hans live capture、FIX1/FIX2 对比、根因修复与残留分类。状态 BLOCKED。

依赖边界:
audits 保存阶段性检查结果与实跑记录；不驱动运行时，不决定 gate 通过。

法则: 事实即记录·状态不粉饰·阻塞不隐瞒

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
