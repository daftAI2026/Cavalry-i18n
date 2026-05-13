# prompts/
> L2 | 父级: doc/workflows/cavalry-full-ui-100/CLAUDE.md

成员清单
- 00-bootstrap-context.md: 冷启动阅读入口，建立反绕过、artifact contract 与 gate 顺序认知
- 01-audit-and-gate-hardening.md: W-AUDIT 执行协议，把弱阈值、缺 preflight、漏 target 变成 RED/GREEN
- 02-extraction-inventory-freeze.md: G-X 执行协议，在 capture/provenance 已可信后冻结 JSON、compiled、runtime 完整英文分母
- 03-provenance-gate.md: G-P 执行协议，固定 session-dir、live capture provenance 与合法输入边界
- 04-forbidden-translation-detector.md: §P5 执行协议，统一占位标记、全角拉丁、错位填词、简繁串味、合成 source、伪 context 与 Frankenstein 检测
- 05-measurement-integrity.md: G0 执行协议，固定阈值、reader、run record 与 CI 接线
- 06-compiled-owner-map.md: G2 执行协议，保证 compiled source map 来自 raw extraction 并覆盖 libExtensionLayer
- 07-runtime-capture-toolchain.md: G-CAPTURE/G3 执行协议，先建立 live injector、AX capture 与 merged inventory 链路，再供 G-X 冻结分母
- 08-translate-zh-hans.md: W5 简中翻译协议，只在 frozen denominator 存在后处理三 surface
- 09-translate-zh-hant.md: W6 繁中翻译协议，独立翻译并拒绝简体污染
- 10-translate-ja-jp.md: W7 日文翻译协议，执行日语 UI 术语与片假名规范
- 11-compile-qm-and-final-matrix.md: W8 终局协议，编译 .qm 并运行同一 session 的三语 matrix

设计规则
- prompt 是执行切片，不是规范真相源；与 Acceptance.md 冲突时以 Acceptance.md 为准。
- 任何翻译 prompt 都必须先验证 `SESSION_DIR/extraction-inventory.json`。
- 编号是阅读索引，不再等于执行顺序；执行顺序以 EXECUTE.md / Runbook.md 为准。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
