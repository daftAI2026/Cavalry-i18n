# json-surfaces/
> L2 | 父级: ../CLAUDE.md

成员清单
asset-map.json: 38 个 Cavalry JSON asset 到语言包路径的映射表，标记当前覆盖与缺口。
translation-report.json: 38 个 JSON 的字符串叶子、自动预填数量与未翻译英文残留统计。
translation-gap-report.md: JSON surface 翻译缺口报告，记录 draft 与上线语言包之间的剩余差异。
compiled-ts-parity-report.md: compiled/runtime `.ts` 三语 message/context 数量差异与日文 QPrintDialog context 错位报告。
ts-parity-fix-report.md: compiled/runtime `.ts` parity 修复结果报告，记录上下文错位与数量对齐后的证据。
translation-plan.md: JSON surface 翻译流水线，定义先翻译后接入 patch 的顺序。
translation-handoff-prompt.md: 给下一位翻译执行者的完整接手话术。
en/: 38 个 JSON 的英文基线，来自当前 Cavalry.app 与已有 languages/en。
draft/: 三语草稿目录，使用现有翻译表预填，未命中处保留英文作为待翻译证据。

依赖边界:
本目录是翻译审计与草稿工作区，不直接参与 Tauri 打包；只有人工/工具审校完成后，内容才可复制进 languages/ 并接入 patch.rs。

法则: 先定分母·再翻译·后打包·禁止英文草稿上线

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
