# output/
> L2 | 父级: /Users/luo/Desktop/ClaudeCode/web/Cavalry-i18n/CLAUDE.md

成员清单
playwright/: 前端截图输出目录，保存各语言 UI 回归截图。
json-surfaces/: Cavalry 38 个 JSON asset 的抓取分母、英文基线、三语 draft、翻译缺口报告与接手话术。

依赖边界:
output 只保存派生审计产物，不作为运行时 source truth；可由工具重建，正式语言包仍以 languages/ 为准。

法则: 派生产物·可重建·不驱动运行时

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
