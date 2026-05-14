# workflows/
> L2 | 父级: /Users/luo/Desktop/ClaudeCode/web/Cavalry-i18n/doc/CLAUDE.md

成员清单
cavalry-full-ui-100/: 当前 full-ui 100% 覆盖 workflow，约束 G-P、§P5、G-CAPTURE、G-X 与 G0-G4 gate。
cavalry-i18n/: 早期 Cavalry-i18n workflow，记录 glossary、extraction、whitelist、translation、QM、switcher、CI 与 final gate 的原始执行链。

依赖边界:
workflows 是过程语义层；当前执行优先读取 `cavalry-full-ui-100/`，早期 workflow 只能作为历史路线与设计来源。

法则: 当前优先·历史可查·执行口径单一

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
