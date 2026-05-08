<!--
[INPUT]: 依赖 Acceptance.md 的 gate 定义、Anti-Patterns.md 的绕过证据
[OUTPUT]: 对外提供 full-ui-100 的执行纪律、循环规则、run note 规范
[POS]: full-ui-100 工作流运行手册
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
-->

# Runbook — Cavalry Full UI 100% 运行手册

---

## Default Target

默认目标不是“把翻译率抬高”，而是：

```text
W-AUDIT + G-P + §P5 + G-CAPTURE + G-X + G0 + G2 + G3 + G1 + G4 = PASS
```

当前默认结论不是 PASS，而是：

```text
NOT COMPLETE
```

## Build / Shell Boundary

构建、发布、CI 修复必须以 `doc/LOCAL_BUILD_SOP.md` 为准：

- Tauri 是默认发布壳。
- `npm run build:tauri` 是标准打包入口。
- Tauri 是唯一发布壳；旧壳层发布流程不再作为 fallback。
- 不恢复旧壳层测试、harness、builder 配置；仍有价值的断言必须留在 Tauri / full-ui gate。

本 workflow 可以改 `renderer/` 与 `injector/`，因为它们仍被 Tauri 发布路径消费；这不是继续维护旧壳层。

---

## Spec / Truth Separation Rule

执行时必须同时记住两件事：

1. `Acceptance.md` 写的是 **目标规范**
2. `Project.md` / `TODO.md` 写的是 **当前代码真相与实现缺口**

不允许把：

- “当前代码还没做到”误写成规范放宽
- “本机 cache 恰好有某个产物”误写成当前真相源
- README / 普通说明文案里的旧数字误当成本阶段 blocker

README / 普通说明文案在最终收尾统一更新；当前阶段只修 active full-ui / Tauri gate、脚本和实际 CI 执行入口。

---

## Progress Tracking Rule

执行中必须同时维护四个面：

1. `Acceptance.md`：通过条件一旦成立，立即打钩；失效则取消打钩
2. `Project.md`：同步更新当前代码真相 / implementation gap
3. `TODO.md`：同步更新任务状态、已完成项与剩余 blocker
4. 当轮 run note：记录本次状态变化、证据路径与为什么能打钩/为什么回退；涉及 machine-readable 字段时同步更新 `RUN_RECORD`

禁止：

- 只改 `Project.md` / `TODO.md` / run note，不改 `Acceptance.md`
- 只在 `Acceptance.md` 打钩，不回填当前状态与 run note / `RUN_RECORD`
- 让复选框状态和当前分支真实状态脱节

---

## Anti-Bypass Rule

执行中任何时候触发以下任一项，立即停止本轮并写 `INVALIDATED` 或 `BLOCKED`：

1. 创建 / 修改 / 引用 `tools/full_ui_inventory_fixtures/`
2. 创建 / 修改 / 引用 `doc/libExtensionLayer-curated-ui.txt`
3. 把仓库 JSON 拷进 cache 充当 runtime input（`prepare:full-ui-gate` 模式）
4. 放宽阈值到 `< 100` 或 `< 1.00`
5. 修改 detector 以放过 §P5 命中
6. 继续使用 cache 根目录 runtime inventory / merged inventory / session run record
7. 使用任何本地词表 / 全角化 / 占位标记 / 自我递归来伪造翻译
8. 在 `extraction-inventory.json` 缺失或未冻结时启动翻译

缺真机时唯一允许的行为：

- 输出 `BLOCKED-NO-LIVE-CAVALRY`
- 记录 blocked reason
- 不造 fixture

---

## Non-Stop Rule

以下状态都不能宣称完成：

1. runtime 到 100
2. compiled 有明显提升
3. JSON 接近 100
4. 单语通过
5. 某个 gate 被 blocked
6. “只剩一个明显 blocker”

---

## Execution Order

顺序固定：

1. `W-AUDIT`
2. `G-P`
3. `§P5`
4. `G-CAPTURE`
5. `G-X`
6. `G0`
7. `G2`
8. `G3`
9. `G1`
10. `zh-Hans`
11. `zh-Hant`
12. `ja_JP`
13. `G4`

说明：

- 先修假绿入口，再修实现
- 先锁输入 provenance，再信任 coverage
- 先修 live capture 工具链，再冻结完整英文分母
- 先冻结完整英文分母，再允许翻译
- 先修 measurement，再做翻译 backlog

---

## Artifact Hygiene Rule

### 合法输入

- `SESSION_DIR/runtime/*`
- 显式绑定的 `~/Library/Caches/Cavalry-i18n/compiled-ui-source-map.json`

### 非法输入

- `CACHE_ROOT/*-inventory.json`
- `CACHE_ROOT/*-merged*.json`
- `CACHE_ROOT/full-ui-run-record.json`
- 任何“自动扫描 cache 然后挑一个最新文件”的 reader

---

## Target Version Drift Rule

当前目标由 active worktree 的 `tools/cavalry_qt_target.json` 与 `/Applications/Cavalry.app/Contents/Info.plist` 共同确定。
任何 Cavalry 版本、Qt 版本或 app bundle hash 变化，都不是普通翻译增量，而是 denominator drift。

触发 denominator drift 后：

1. 当前 workflow 状态立即回到 `NOT COMPLETE`
2. 旧 `SOURCE_MAP`、`EXTRACTION`、runtime capture、`RUN_RECORD` 只能作为历史 run note 证据
3. 禁止用旧版本的 JSON 100 / compiled coverage / runtime coverage 证明当前版本
4. 禁止启动 `08/09/10` 翻译 prompt，直到新目标完成 `G-CAPTURE + G-X`
5. 第一轮必须重新抽取 compiled source-map、重新 live capture runtime、重新冻结 `SESSION_DIR/extraction-inventory.json`
6. 新 `RUN_RECORD` 必须记录 target version、Qt version、bundle hash 与 artifact provenance

当前目标若为 Cavalry `2.7.1` / Qt `6.6.3`，任何 Cavalry `2.7.0` 的分母与 gate 结果都只能写作历史，不得写作 current PASS。

---

## Loop Rule

```text
读最新 run note 与 `RUN_RECORD`
→ 选第一个失败 gate
→ 写 RED / 更新契约
→ 做最小实现
→ 回归更大范围检测
→ 更新 run note / `RUN_RECORD`
→ 重跑 matrix
```

禁止把分析结论当成修复完成。

---

## Stop Conditions

允许停止的情况只有三种：

1. 全部 gate PASS
2. 遇到真实外部 blocker，并写 `BLOCKED`
3. 用户明确要求停止

---

## Run Note Format

markdown run note 路径：

```text
MAIN_REPO/doc/workflows/cavalry-full-ui-100/runs/YYYY-MM-DD-{gate-or-task}.md
```

`MAIN_REPO` 固定为：

```text
/Users/luo/Desktop/ClaudeCode/web/Cavalry-i18n
```

执行代码的 worktree 可以是：

```text
/Users/luo/Desktop/ClaudeCode/web/Cavalry-i18n-full-ui-100
```

但该 worktree 的 `doc/` 按仓库策略被 `.gitignore` 忽略，不是 workflow 文档写入点。
所有 markdown run note 必须写回 `MAIN_REPO` 的 workflow runs 目录；只写 Copilot `plan.md`、session events 或 `RUN_RECORD` 不算完成 run note。

状态只允许：

- `PASS`
- `FAIL`
- `INVALIDATED`
- `BLOCKED`

JSON session run record 路径：

```text
SESSION_DIR/full-ui-run-record.json
```

`RUN_RECORD` 是机器证据；markdown run note 是 workflow 语义证据。两者必须同时存在并互相引用。
若 `npm run check:full-ui` exit 非 0 或 `RUN_RECORD.overallPass !== true`，当轮 markdown run note 状态必须写 `FAIL` 或 `BLOCKED`，最终措辞只能是 `NOT COMPLETE`。

最终 run note 必须包含：

1. gate 总表
2. 三语 matrix 结果
3. 当前 `SESSION_DIR`
4. runtime artifact 路径
5. source-map provenance（可引用 `RUN_RECORD` 字段）
6. 剩余 blocker 或 blocked reason

---

## Final Wording

- 任意 gate 未通过：`NOT COMPLETE`
- 所有 gate 通过且 artifact provenance 完整：`ALL GATES PASS`

本 workflow 没有 “差不多完成”“manual pending” 语义。
