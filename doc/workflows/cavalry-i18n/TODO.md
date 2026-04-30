<!--
[INPUT]: 依赖 Project.md 的执行协议、Acceptance.md 的验收闸门
[OUTPUT]: 对外提供 cavalry-i18n 工作流任务队列
[POS]: cavalry-i18n 工作流的任务索引
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
-->

# TODO — cavalry-i18n 任务队列

## Active Milestones

- [x] M1: Content Ready ✅ PASS（全仓审查后重跑 T2/T3/final gate，validator exit 0）
- [x] M2: Switcher Ready ✅ PASS
- [x] M3: Release Ready ✅ PASS
- [ ] M_manual: In-App Verification

默认执行目标是 M1+M2+M3。M_manual 与 M3 并行。
当前对外状态应表述为：**DELIVERY COMPLETE / M_manual PENDING**。

---

## M1: Content Ready

- [x] T0: 术语表扩展 ✅ PASS
  - [x] 读取 cavalry-glossary-en-zh.md
  - [x] 参考 Microsoft 风格指南 + AE/Blender 各语言版
  - [x] 添加 zh-Hant 列
  - [x] 添加 ja_JP 列
  - [x] 验证简繁差异对
  - [x] 验证不翻译项
  - [x] 按 glossary-contract.md 全部通过
  - [x] 写 run log

- [x] T1: 提取英文原文 ✅ PASS
  - [x] 编写 tools/extract_strings.py
  - [x] 从 Cavalry app bundle 提取 nodeStrings.json
  - [x] 提取 appStrings.json
  - [x] 提取 tips.json
  - [x] 提取 onboarding.json
  - [x] 提取 plugins/*.json
  - [x] 按 extraction-contract.md 全部通过
  - [x] 写 run log

- [x] T1.1: 翻译字段白名单 ✅ PASS (re-verified)
  - [x] ~~分析 en/ 下所有 JSON 的实际结构~~
  - [x] ~~创建 doc/translation-whitelist.json~~
  - [x] whitelist 已升级：新增 `locale_sync` 类别、`enums` 加入 translate
  - [x] 按 whitelist-contract.md 全部通过（B2/B3 已适配 `_schema` 和 `locale_sync`）
  - [x] 写 run log

- [x] T2: 翻译全部语言 ✅ PASS（validator exit 0, B2-B12+TS 全部通过）
  - [x] 历史上已做过一次翻译产物交付
  - [x] 按最新 contract 重新验证三种语言的 `nodeStrings.json`
  - [x] 重新处理整段英文 Help / Tooltip、半翻译标签、zh-Hant 简繁混杂
  - [x] 补做 B12（各语言纯度：zh-Hans / zh-Hant / ja_JP）— 全部 0 issue
  - [x] 写新的 T2 run log

- [x] T3: 编译 .qm ✅ PASS
  - [x] 历史上已完成一次 `.qm` 编译
  - [x] 新的 T2 产物稳定后重新编译（62 translations per lang, 0 unfinished）
  - [x] 写新的 T3 run log

---

## M2: Switcher Ready

- [x] T4: 编写 LanguageSwitcher.js ✅ PASS
  - [x] UI（下拉+Apply&Restart）
  - [x] JSON 覆写（第一层）
  - [x] .qm 写入/清理（第二层）
  - [x] 配置读写（cavalry-i18n.json）
  - [x] 版本检测
  - [x] 自动重启（macOS + Windows）
  - [x] 错误处理
  - [x] 按 switcher-contract.md 全部通过
  - [x] 写 run log

---

## M3: Release Ready

- [x] T8: GitHub CI ✅ PASS
  - [x] 创建 .github/workflows/build.yml
  - [x] 按 ci-contract.md 全部通过
  - [x] 写 run log

- [x] T9: README + Release ✅ PASS
  - [x] 创建 README.md
  - [x] 创建 LICENSE
  - [x] 按 readme-contract.md 全部通过
  - [x] 写 run log

---

## M_manual: In-App Verification（与 M3 并行）

- [ ] M5: JSON 替换验证
- [ ] M6: .qm 加载验证（不通过则降级）
- [ ] M7: 全流程测试（6 项矩阵）

---

## Post-Audit Follow-ups

- [ ] 收紧 B9：禁止带空格的半翻译英文残留（如 `Export if 可见`、`Poly メッシュ`）。
- [ ] 重写 B10：按 `translate` 分支下的**叶子字符串**统计覆盖率，不再按 `attributes/enums` 容器对象统计。
- [ ] 新增 B12：三种语言纯度检查，阻止 `zh-Hans` 繁体污染、`zh-Hant` 简体污染、`ja_JP` 中文 UI 词污染。
- [ ] 分类 `tools/` 下过程文件并清理无用残留；删除前确认不是构建输入、发布产物或证据文件。
- [ ] 对外汇报统一使用 **M1-M3 PASS / M_manual PENDING** 语义，禁止把手测待办说成 “All gates PASS”。

---

## Full Audit Snapshot

本轮全仓审查结论：

- 问题**不局限于 `zh-Hant/nodeStrings.json`**，三种语言的 `nodeStrings.json` 都存在系统性问题。
- 当前自动化扫描中，`nodeStrings.json` 的 **exact-English translate leaves**：
  - `zh-Hans`: 4157
  - `zh-Hant`: 4158
  - `ja_JP`: 4159
- 当前自动化扫描中，`nodeStrings.json` 的 **英文残留/半翻译**：
  - `zh-Hans`: 152
  - `zh-Hant`: 156
  - `ja_JP`: 176
- `zh-Hant` 另外检出 **147** 处简体污染嫌疑。
- `appStrings` / `tips` / `onboarding` / `plugins` 目前未呈现同等级热点；主战场是 `nodeStrings.json`。
- `no_translate` 字段审查目前为 **0 issue**。
- `tools/*.ts` 未见 `unfinished`，但不代表 JSON 质量通过。

优先修复顺序：

1. `nodeStrings` 的 Help / Tooltip 整段英文
2. `nodeStrings` 的半翻译标签（`Always 匯出` / `Poly 网格` / `Clipping 模式`）
3. `zh-Hant` 的简繁混杂
4. 再处理过程文件清理与产物归类

---

## Re-run Plan

重新执行时的入口和顺序：

```
1. 读 Runbook.md（执行纪律不变）
2. 跳过 prompt 00-02（T0/T1 的 PASS 仍有效）
3. 从 prompt 03 开始 → T1.1 验证新 whitelist
4. prompt 04 → T2 完全重新翻译（核心任务）
5. prompt 05 → T3 重新编译 .qm
6. prompt 09 → final gate（M1 + M2 + M3）
```

---

## Known Issues

- ~~术语表目前只有 en→zh-Hans，缺 zh-Hant 和 ja_JP 列~~ ✅ 已解决
- ~~需要 Cavalry app bundle 路径才能执行 T1~~ ✅ 已解决
- 当前历史 run log 曾宣称 `B9 = 0`，但最新全仓审查已发现三种语言仍有英文残留/半翻译，旧结论作废。
- 当前历史 run log 曾宣称 `B10 = 99% coverage`，但计算口径是容器级，不是叶子级；旧结论作废。
- 当前历史 run log 未覆盖新的 `B12` 口径，三种语言的纯度问题仍未被 contract 正式拦截。

---

## Workflow Interface

prompt 顺序：

```
00-bootstrap-context
01-expand-glossary
02-extract-english-strings
03-define-translation-whitelist    ← 从这里开始重跑
04-translate-all-languages         ← 核心重做
05-compile-qm                      ← 跟随重做
06-write-language-switcher         ← 已完成，跳过
07-build-ci                        ← 已完成，跳过
08-write-readme                    ← 已完成，跳过
09-final-gate                      ← 最终重新验证
```
