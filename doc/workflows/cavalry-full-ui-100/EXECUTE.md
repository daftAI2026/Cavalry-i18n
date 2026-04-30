<!--
[INPUT]: 依赖 Anti-Patterns.md、Project.md、Acceptance.md、Runbook.md、TODO.md、tests/*、prompts/*
[OUTPUT]: 对外提供 full-ui-100 工作流的冷启动执行协议
[POS]: full-ui-100 自动化执行入口
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
-->

# EXECUTE — Cavalry Full UI 100% 冷启动执行协议

## 任务

持续推进，直到 Cavalry 在 `zh-Hans` / `zh-Hant` / `ja_JP` 下达到 whitelist-based Full UI 100%。

## 进度追踪要求

每完成一个可验证条件，必须在同一轮内同时做四件事：

1. 在 `Acceptance.md` 勾选对应通过条件
2. 在 `Project.md` 更新当前代码真相 / implementation gap
3. 在 `TODO.md` 更新任务状态
4. 在当轮 run note 记录证据路径、状态变化与影响 gate；机器字段同步写入 session run record

不允许只更新其中一部分。

## 事故记忆

先读 [`Anti-Patterns.md`](./Anti-Patterns.md)。它只保留三类反模式，不把历史版本号当成当前设计：

- **Out-of-Band Truth**：fixture / curated / cache 残留替代真实输入
- **Counterfeit Form**：占位标记 / 全角拉丁 / 错位填词 / 自我递归伪翻译
- **Denominator Shrink**：merge 丢项、source-map 子集、allowlist 污染导致分母缩水

当前第一任务不是继续翻译，而是先确认 target identity。Cavalry / Qt / bundle hash 变化时，旧分母立即作废，必须先重新抽取 compiled source map、重新 live runtime capture、重新执行 G-CAPTURE + G-X freeze。之后才继续处理 legacy weak threshold、0.90 JSON gate、缺 G-P preflight、缺 §P5 runtime detector、缺 `libExtensionLayer.dylib` owner 等 RED/GREEN 项。

---

## 绝对禁止清单（违反任意一条 = 立即 STOP）

> 这是为了把上一轮的 4 条绕过路径完全堵死。读到这里就要默念一遍。

### 禁 1：禁止任何形式的 fixture-sourced runtime inventory

- ❌ 不允许新增、修改、依赖任何位于 `tools/full_ui_inventory_fixtures/` 的文件
- ❌ 不允许任何脚本把仓库内 JSON 写进 `~/Library/Caches/Cavalry-i18n/*-inventory.json`
- ❌ 不允许 matrix/gate 读取 `~/Library/Caches/Cavalry-i18n/` 根目录下的 inventory（必须读 `sessions/<uuid>/` 子目录下的本轮产物）
- ❌ 不允许 `prepare:full-ui-gate` 这一类"在不启动 Cavalry 的情况下让 gate 有 input 可读"的中间层
- ❌ 不允许 inventory 的 `source` 字段为 `repo-fixture` / `ci-workflow-fixture` / 任何非真机来源
- ✅ runtime inventory **必须**来自一个活的 Cavalry 进程：injector 注入到正在运行的 Cavalry，或 macOS Accessibility 接到正在运行的 Cavalry pid
- ✅ 每份 inventory 必须携带 `capture.pid` / `capture.bundleHash` / `capture.sessionUuid`，缺任意一项 gate 必须 hard-fail

### 禁 2：禁止任何 curated / hand-picked owner map

- ❌ 不允许新增、修改、依赖 `doc/libExtensionLayer-curated-ui.txt` 或同类清单
- ❌ 不允许 `extract_compiled_ui_strings.js` 出现"只输出在 known set 中的字符串"的代码路径
- ❌ 不允许 owner map 的 `kind` 字段为 `curated` / `whitelisted` / `gated`
- ✅ Compiled owner map **必须**是从对应 dylib 用 `strings`/Mach-O 解码做 raw extraction 的结果
- ✅ 允许的过滤**只有**：声明式 noise-pattern 排除（HTTP header / debug log / binary gibberish 正则），且每条排除必须落在 audit log 里
- ✅ 排除比例（excluded / raw_total）必须进入 audit；若异常偏高，应在 run note 解释原因

### 禁 3：禁止把 reviewer 的红灯改写成"扩字段就能过"

- ❌ 不允许在执行期修改 `STRONG_WIDGET_STRING_FIELDS` / gate 阈值 / 判定函数 来"对齐 fixture"
- ❌ 不允许"为了让真机弱抓取也能通过"而放宽 gate 判定
- ✅ 当前 gate 判定逻辑视为 frozen-by-default。修改 gate 定义文件必须先在 `Acceptance.md` 写入新条件并明确为更严格，再动代码
- ✅ gate 定义文件清单：`tools/verify_gate_inputs.js`（待创建，G-P/§P5 pre-flight）、`tools/check_full_ui_coverage.js`、`tools/check_runtime_ui_coverage.js`、`tools/check_full_ui_matrix.js`、`tools/extract_compiled_ui_strings.js`、`tools/validate_translations.py`、`tools/merge_runtime_inventory.js`（待创建）

### 禁 4：禁止把"无法在本机/CI 跑"当成 fixture 借口

- ❌ "CI 没有 Cavalry.app" → **gate 就该红**，不要造 fixture 让它绿
- ❌ "本机抓不到 widget" → **gate 就该红**，不要补 fixture 字段绕过
- ❌ "我们没法在 CI 启动 Cavalry" → 把 full-ui matrix 标 non-blocking，不要造数据
- ✅ 缺真机时，full-ui matrix 必须输出 `BLOCKED-NO-LIVE-CAVALRY`，session run record 写 `pass=false` `reason=missing-live-capture`

### 禁 5：禁止把"基线提升"当完成

旧 EXECUTE.md 已写入下列禁项，**保持有效**：
- ❌ 把弱口径 `runtime 100` 当完成
- ❌ 把 `compiled 20.12%` 当唯一 blocker 描述
- ❌ 把 `json 97-98%` 当真实 100
- ❌ 通过扩充 allowlist 掩盖真实 UI 漏翻
- ❌ 只修一语就宣称完成
- ❌ active full-ui / Tauri gate 未实现 whitelist-filtered 100 却宣称 G0 完成
- ❌ `validate_translations.py` 还以 `0.90` 放行却宣称 G1 完成

### 禁 6：禁止任何形式的"本地翻译引擎"

- ❌ 不允许写一段 JS / Python / shell 代码，对英文字符串"自动翻译"，不论是查词表、查 glossary、查 dict、走 IME 还是任何离线方案
- ❌ 不允许把英文字符全角化（U+FF21-U+FF3A / U+FF41-U+FF5A）冒充翻译（`Alpha → Ａｌｐｈａ`、`RGB → ＲＧＢ`）
- ❌ 不允许给已翻译的字符串再加 `（译）/（訳）/（譯）` 占位标记
- ❌ 不允许在 source == translation 仅末尾差一个标记的伪条目（自我递归）
- ❌ 不允许把不该翻译的品牌名 / 缩写 / 技术术语 / 变量名 / 视频格式名"伪翻译"
- ✅ 翻译引擎**只允许 LLM**，输入必须是：
  - [`doc/translation-guidelines.md`](../../translation-guidelines.md)
  - [`doc/cavalry-glossary.md`](../../cavalry-glossary.md)
  - [`doc/cavalry-glossary-en-zh.md`](../../cavalry-glossary-en-zh.md)
  - [`tools/translation-whitelist.json`](../../../tools/translation-whitelist.json)（决定哪些英文必须保留）
- ✅ 翻译产物在写入仓库前必须先过 §P5 Forbidden-Translation Patterns 扫描，命中即拒收

### 禁 7：禁止削弱 §P5 Forbidden-Translation Patterns

- ❌ 不允许把 `（译）/（訳）/（譯）` 加进 detector 的 allowlist
- ❌ 不允许把全角拉丁字母（U+FF21-U+FF3A / U+FF41-U+FF5A）从 forbidden set 移除
- ❌ 不允许把 `^(?:页|頁|ページ):?\d+$` 错位填词模式从 forbidden set 移除
- ❌ 不允许把简繁串味检测改成 warn-only
- ❌ 不允许把 source==translation 自我递归检测改成 warn-only
- ❌ 不允许在 detector 上游加"如果 string 全是中文/日文就跳过 §P5"这种短路
- ✅ §P5 命中只允许有一种处理：**hard-fail 整轮**

### 禁 8：禁止在完整抽取前开始翻译

- ❌ 不允许在 `SESSION_DIR/extraction-inventory.json` 缺失时启动 `08/09/10` 翻译 prompt
- ❌ 不允许用 merge 后剩余条目、source-map 当前子集或 runtime 当前可见子集当翻译分母
- ❌ 不允许下调 `Acceptance.md` G-X frozen lower bounds
- ✅ 必须先冻结 JSON / compiled / runtime 三类 English surface
- ✅ G1/G2/G3/G4 的分母必须等于 frozen extraction inventory
- ✅ extraction inventory hash 必须写入 `RUN_RECORD.extractionInventory`

### 禁 9：禁止 SIP-blame 误判（详见 `Anti-Patterns.md` §D）

- ❌ 不允许在 `SESSION_DIR/audit/codesign-evidence.txt` 缺失的情况下声明 `BLOCKED-SIP` / `WEAK-CAPTURE due to SIP`
- ❌ 不允许跳过 `desktop-patcher` 生产链路（`codesign --remove-signature` + `codesign --force --deep --sign -` ad-hoc 重签 + `DYLD_INSERT_LIBRARIES` 注入）就断言 macOS SIP 内核阻塞
- ❌ 不允许用 "SIP 阻塞" 当理由要求关闭 SIP / 降低 `runtime.candidates` / `runtime.menuLeaves` 下界 / 改走 AX-only baseline
- ❌ 不允许把 9–16 个 candidate 的 AX 弱抓取写成 PASS / NEAR-PASS / FUNCTIONAL
- ✅ 必须先跑 `tools/launch_cavalry_with_injector.sh`，由 launcher 在 ad-hoc 重签后写 `codesign-evidence.txt`，并在 hardened runtime / library-validation 仍存在时 `exit 1`
- ✅ 真 SIP 阻塞声明必须同时附 `~/Library/Logs/DiagnosticReports` 中 amfid / kernel 的拒绝日志路径
- ✅ 即便真 SIP 阻塞确证，AX-only 退路仍需满足 `>=613 candidates / >=666 menuLeaves` 与 `live-merged` provenance；任何 lower bound 妥协都视为禁 5 / 禁 8 违规

---

## 工作目录与 Launch Protocol

```text
REPO       = /Users/luo/Desktop/ClaudeCode/web/Cavalry-i18n
WORKFLOW   = REPO/doc/workflows/cavalry-full-ui-100
CACHE      = ~/Library/Caches/Cavalry-i18n
SESSION    = $CACHE/sessions/$(uuidgen)   # 每轮新建，不复用
RUNTIME    = $SESSION/runtime
AUDIT      = $SESSION/audit
SOURCE_MAP = $CACHE/compiled-ui-source-map.json
```

### Build / Shell Boundary（强制）

本 workflow 按 [`doc/LOCAL_BUILD_SOP.md`](../../LOCAL_BUILD_SOP.md) 执行：

- 默认壳是 Tauri，不是 Electron。
- 打包入口必须是 `npm run build:tauri`。
- Electron 发布 SOP 已归档；除非用户显式要求 fallback，不进入 Electron build / electron-builder / Electron harness 修复。
- `desktop-patcher/renderer/` 和 `desktop-patcher/injector/` 仍可修改，因为 Tauri 发布路径继续消费它们。
- 如果旧 Electron 测试阻塞本 workflow，只迁移其中仍有价值的断言到 Tauri / full-ui gate；不要继续补 Electron 专属测试。
- README / 普通说明文案先不改；旧 `99` 文案最终收尾时统一清理，不参与当前 gate。
- `.github/workflows/build.yml` 只有实际执行 gate / 打包 / artifact 绑定时才属于本 workflow 工作面。

### Launch Protocol（给下一个执行者）

**不要**在 copilot session 的 `~/.copilot/session-state/<id>/files/...` 下做这一轮。上一轮就在那里跑，21 commit 全垫了 fixture，最终被全部 INVALIDATED。

正确启动顺序：

```bash
# 1. 在用户主仓库目录下 fetch 最新 main
cd /Users/luo/Desktop/ClaudeCode/web/Cavalry-i18n
git fetch origin

# 2. 不复用已经被污染过的固定路径；新工作流使用无版本号 worktree/branch
WORKTREE=../Cavalry-i18n-full-ui-100
BRANCH=wip/cavalry-full-ui-100

# 3. 如果 worktree 已存在，先确认它确实是这个 branch；否则新建
if git worktree list --porcelain | grep -F "worktree /Users/luo/Desktop/ClaudeCode/web/Cavalry-i18n-full-ui-100" >/dev/null; then
  git -C "$WORKTREE" status --short
else
  git worktree add "$WORKTREE" -b "$BRANCH" origin/main
fi

# 4. 进入 worktree
cd "$WORKTREE"

# 5. 安装依赖
npm install
```

如果必须参考旧 worktree / archive 分支，先跑 `git status --short` 与 §P5 污染扫描；只要有 fixture、curated、`（译）`、全角拉丁、`页:N` 残留，只允许读 diff，不允许复用工作树作为执行场地。

之后代码改动都在 `../Cavalry-i18n-full-ui-100` 里做，结束时再决定是否 PR 进 main。
workflow 文档与 markdown run note 不写入 worktree；它们固定写回主仓库：

```text
/Users/luo/Desktop/ClaudeCode/web/Cavalry-i18n/doc/workflows/cavalry-full-ui-100/
```

原因：执行 worktree 的 `doc/` 被 `.gitignore` 忽略。`SESSION_DIR/full-ui-run-record.json` 只能作为机器 run record，不能替代 `runs/YYYY-MM-DD-{gate-or-task}.md`。
每轮结束前必须同步：

```text
RUN_RECORD                           # 机器证据
MAIN_REPO/doc/workflows/.../runs/*.md # 语义证据
Acceptance.md / Project.md / TODO.md # 仅在状态实际变化时同步
```

缺 markdown run note 时不得调用 `Task complete`。

### 上一轮存档（仅供 diff 参考）

```text
origin/archive/cavalry-full-ui-100-exec-invalidated-20260427
tag:  v2-invalidated/exec-attempt-1
```

这个分支三语 session run record 是绿的，但全是 fixture/curated 垫的（详见 Anti-Patterns.md）。
你可以 `git diff origin/main origin/archive/cavalry-full-ui-100-exec-invalidated-20260427 -- <file>` 抄 [KEEP] 清单里的 G1 / session run record 输出 / freshness 校验等可保留片段，但**不允许**：

- 把整个 PR cherry-pick 进新分支
- 复制 `tools/full_ui_inventory_fixtures/` 任何内容
- 复制 `doc/libExtensionLayer-curated-ui.txt` 任何内容
- 复制 `prepare:full-ui-gate` 这个 npm script
- 复制 `STRONG_WIDGET_STRING_FIELDS` 的扩展（要回退到 v1 形态）

## 入口文档（按顺序读）

```text
WORKFLOW/Anti-Patterns.md # 先读，知道绕过类型
WORKFLOW/EXECUTE.md       # 即本文件，含绝对禁止清单
WORKFLOW/Acceptance.md    # G-P + §P5 + G-CAPTURE + G-X + G0/G1/G2/G3/G4
WORKFLOW/Runbook.md       # 执行纪律
WORKFLOW/Project.md       # 项目宪法与目标
WORKFLOW/TODO.md          # 当前任务队列（已重置）
WORKFLOW/Flow.md          # gate ownership 与端到端流程
WORKFLOW/ChatlogRef.md    # 旧审查证据，仅参考
```

翻译准则（执行翻译任务前必读）：

```text
REPO/doc/translation-guidelines.md       # 翻译原则：术语对齐、零混合语言、简繁差异
REPO/doc/cavalry-glossary.md             # 四语言术语表（en/zh-Hans/zh-Hant/ja_JP）
REPO/doc/cavalry-glossary-en-zh.md       # 英简中双语术语表
REPO/tools/translation-whitelist.json    # JSON 字段分类（translate/no_translate/locale_sync）
```

## 冷启动第一轮必须重跑的命令

```bash
cd /Users/luo/Desktop/ClaudeCode/web/Cavalry-i18n

CACHE_DIR=~/Library/Caches/Cavalry-i18n
SESSION_UUID="$(uuidgen)"
SESSION_DIR="$CACHE_DIR/sessions/$SESSION_UUID"
RUNTIME_DIR="$SESSION_DIR/runtime"
AUDIT_DIR="$SESSION_DIR/audit"
SOURCE_MAP="$CACHE_DIR/compiled-ui-source-map.json"
mkdir -p "$RUNTIME_DIR" "$AUDIT_DIR"

# 1. 先确认仓库当前状态（不是 exec 分支的状态）
git rev-parse HEAD
git status

# 2. 跑测试（旧基线已重置，预期会红）
npm run test:desktop || true

# 2b. 复审红灯扫描（任一命中都说明 W-AUDIT 未完成）
echo "=== audit red flags ==="
rg -n -- '--threshold 99|coverage >= 0\\.90|coverage_threshold.*0\\.90|Full UI.*99|99% threshold' \
  package.json \
  tools/check_full_ui_matrix.js \
  tools/check_full_ui_coverage.js \
  tools/check_runtime_ui_coverage.js \
  tools/validate_translations.py \
  tools/extract_compiled_ui_strings.js || true
test -f tools/verify_gate_inputs.js || echo "MISSING tools/verify_gate_inputs.js"
test -f tools/merge_runtime_inventory.js || echo "MISSING tools/merge_runtime_inventory.js"
test -f tools/capture_accessibility_inventory.js || echo "MISSING tools/capture_accessibility_inventory.js"
test -f tools/run_live_full_ui_matrix.js || echo "MISSING tools/run_live_full_ui_matrix.js"
node -e "const {getCompiledUiTargets}=require('./tools/extract_compiled_ui_strings.js'); console.log(getCompiledUiTargets('/Applications/Cavalry.app'))" 2>/dev/null | rg 'libExtensionLayer' || echo "MISSING libExtensionLayer target"

# 3. 跑 matrix（旧 session run record 已清空，预期会红）
#    当前代码若尚未支持 session-dir / source-map 显式绑定，允许在这里直接红；这是 W-P / G0 的目标修复面。
node tools/check_full_ui_matrix.js \
  --threshold 100 \
  --session-dir "$SESSION_DIR" \
  --compiled-source-map "$SOURCE_MAP" \
  --runlog "$SESSION_DIR/full-ui-run-record.json" || true

# 4. JSON validator
python3 tools/validate_translations.py \
  --root . \
  --json-report /tmp/cavalry-i18n-report.json \
  --markdown-summary /tmp/cavalry-i18n-summary.md || true

# 5. 检查 fixture 是否被清干净（必须全为 0 / 不存在）
ls tools/full_ui_inventory_fixtures/ 2>&1 || echo "fixtures dir absent: OK"
ls doc/libExtensionLayer-curated-ui.txt 2>&1 || echo "curated corpus absent: OK"

# 5a. cache 污染 hard-check（root-cache 是最危险输入源）
#     不再只看 cache 是否"存在"；直接扫描 inventory 内容是否有 FP 命中
#     如果有 → 立即中断当前轮次；purge 或确认 session 隔离后，从本阶段重启
echo "=== cache inventory pollution hard-check ==="
CACHE_POLLUTED=0
for inv in "$CACHE_DIR"/*-inventory.json; do
  [ -f "$inv" ] || continue
  hits=$(grep -cE '（译）|（訳）|（譯）|页:|頁:|ページ|[Ａ-Ｚａ-ｚ]' "$inv" 2>/dev/null || echo 0)
  echo "$inv: $hits FP hits"
  [ "$hits" -gt 0 ] && CACHE_POLLUTED=1
done
if [ "$CACHE_POLLUTED" -eq 1 ]; then
  echo "FATAL: cache inventory polluted with forbidden patterns."
  echo "  Option A: rm -rf $CACHE_DIR/*-inventory.json $CACHE_DIR/full-ui-run-record.json $CACHE_DIR/live-sessions/"
  echo "  Option B: use session-scoped dir: SESSION_DIR=$CACHE_DIR/sessions/\$(uuidgen)"
  echo "  STOP current run, record FAIL/BLOCKED, clean or isolate, then restart this phase."
  exit 1
fi

# 5b. §P5 Forbidden-Translation pre-check
#     译标记 / 全角拉丁 / 错位填词 / 简繁串味 / 自我递归
#     任意命中说明 worktree 带历史污染或新污染，必须先清
echo "=== §P5 forbidden-translation scan (repo assets) ==="
rg -n '（译）|（訳）|（譯）' \
  tools/zh-Hans.ts tools/zh-Hant.ts tools/ja_JP.ts \
  desktop-patcher/injector/generated_translations.inc \
  languages/ 2>/dev/null | wc -l
rg -n '[Ａ-Ｚａ-ｚ]' \
  tools/zh-Hans.ts tools/zh-Hant.ts tools/ja_JP.ts \
  desktop-patcher/injector/generated_translations.inc \
  languages/ 2>/dev/null | wc -l
rg -n '"(?:页|頁|ページ):?[0-9]+"' \
  tools/zh-Hans.ts tools/zh-Hant.ts tools/ja_JP.ts \
  desktop-patcher/injector/generated_translations.inc \
  languages/ 2>/dev/null | wc -l
# 三个数字应该都为 0；任意非 0 → 立即停止本轮，回到 main 干净状态再启动

# 5c. §P5 cache inventory scan
#     runtime cache inventory 是 gate 的直接输入，如果它被污染，runtime 100% 就是假象
#     §P5 必须同时覆盖 repo 资产和 cache 资产
echo "=== §P5 forbidden-translation scan (cache inventory) ==="
for inv in "$CACHE_DIR"/*-inventory.json "$CACHE_DIR"/sessions/*/runtime/*-inventory.json; do
  [ -f "$inv" ] || continue
  echo "--- $inv ---"
  echo "  FP-1 (占位标记):  $(rg -c '（译）|（訳）|（譯）' "$inv" 2>/dev/null || echo 0)"
  echo "  FP-2 (全角拉丁):  $(rg -c '[Ａ-Ｚａ-ｚ]' "$inv" 2>/dev/null || echo 0)"
  echo "  FP-3 (错位填词):  $(rg -c '"(?:页|頁|ページ):?[0-9]+"' "$inv" 2>/dev/null || echo 0)"
done
# 任何 cache inventory 有 FP 命中 → 必须先 purge 再继续

# 6. compiled-ui-source-map 当前 owner targets
python3 - <<'PY'
import json, os
p=os.path.expanduser('~/Library/Caches/Cavalry-i18n/compiled-ui-source-map.json')
if os.path.exists(p):
    d=json.load(open(p))
    print('compiledUiTargets:', d.get('compiledUiTargets', []))
    print('kind:', d.get('kind'))
    print('entries:', len(d.get('entries', [])))
else:
    print('compiled-ui-source-map.json absent (will be regenerated)')
PY

# 7. G-X extraction inventory gate（缺失即 STOP，不能进入翻译）
test -f "$SESSION_DIR/extraction-inventory.json" || echo "MISSING extraction inventory: run G-X before translation"
if [ -f "$SESSION_DIR/extraction-inventory.json" ]; then
  node -e "const fs=require('fs'); const d=JSON.parse(fs.readFileSync(process.argv[1],'utf8')); console.log({surfaces:Object.keys(d.surfaces||{}), hash:d.hash||null})" "$SESSION_DIR/extraction-inventory.json"
fi

# 8. CI workflow（只审实际执行语义；不处理 README/说明文案）
cat .github/workflows/build.yml
```

## 执行顺序

| Prompt | Work Item | 内容 | 对应 Gate |
|---|---|---|---|
| [`00-bootstrap-context`](./prompts/00-bootstrap-context.md) | bootstrap | 冷启动阅读，建立全局认知 | — |
| [`01-audit-and-gate-hardening`](./prompts/01-audit-and-gate-hardening.md) | W-AUDIT | whitelist-filtered 100、legacy weak-threshold 拒绝、preflight hard-fail contract | W-AUDIT |
| [`03-provenance-gate`](./prompts/03-provenance-gate.md) | W-P | verify_gate_inputs.js + session-dir / provenance contract | G-P |
| [`04-forbidden-translation-detector`](./prompts/04-forbidden-translation-detector.md) | W-P5 | §P5 6 类 FP 实装 + detector wiring（在 G-P 之后） | §P5 |
| [`07-runtime-capture-toolchain`](./prompts/07-runtime-capture-toolchain.md) | W-CAPTURE | English dump-only + AX 抓取 + 合并 + live matrix 编排 | G-CAPTURE |
| [`02-extraction-inventory-freeze`](./prompts/02-extraction-inventory-freeze.md) | W-X | 冻结 JSON + compiled + runtime 完整英文分母 | G-X |
| [`05-measurement-integrity`](./prompts/05-measurement-integrity.md) | W0 | 默认阈值冻结 + runtime metadata + CI 接线 | G0 |
| [`06-compiled-owner-map`](./prompts/06-compiled-owner-map.md) | W2 | libExtensionLayer + canary + noise filter 审计 | G2 |
| [`08-translate-zh-hans`](./prompts/08-translate-zh-hans.md) | W5 | 三 surface 简中翻译（JSON + compiled + runtime） | G1 |
| [`09-translate-zh-hant`](./prompts/09-translate-zh-hant.md) | W6 | 独立繁中翻译 + 简繁差异 + FP-4 检测 | G1 |
| [`10-translate-ja-jp`](./prompts/10-translate-ja-jp.md) | W7 | カタカナ优先 + 日英混合禁止 + 中文 UI 词检测 | G1 |
| [`11-compile-qm-and-final-matrix`](./prompts/11-compile-qm-and-final-matrix.md) | W8 | .qm 编译 + final matrix（前提：G-X 已冻结且 G1 已 1.00 / 100） | G4 |

## 分段执行

推荐分段点（每轮结束时写 run note，并同步检查 session run record）：

| 轮次 | Prompt | 内容 | 预计耗时 |
|:---:|---|---|---|
| 第一轮 | 00-01 | bootstrap + audit hardening | 0.5 天 |
| 第二轮 | 03-04 | provenance gate + §P5 detector | 1-2 天 |
| 第三轮 | 07 | runtime capture toolchain（需要 Cavalry 真机） | 1-2 天 |
| 第四轮 | 02 | extraction inventory freeze | 0.5-1 天 |
| 第五轮 | 05-06 | measurement integrity + compiled owner map | 1 天 |
| 第六轮 | 08 | zh-Hans 翻译（主战场，完整分母已冻结） | 2-3 天 |
| 第七轮 | 09 | zh-Hant 翻译（独立翻译，不是简转繁） | 1-2 天 |
| 第八轮 | 10 | ja_JP 翻译（カタカナ优先） | 1-2 天 |
| 第九轮 | 11 | .qm 编译 + final matrix 闭环 | 0.5 天 |

## 翻译工具配置

- **翻译引擎**: 只允许 LLM（禁止任何本地词表/启发式/全角化/占位标记 — 详见 §禁6）
- **Glossary**: `doc/cavalry-glossary.md`（四语言版）+ `doc/cavalry-glossary-en-zh.md`
- **Guidelines**: `doc/translation-guidelines.md`
- **Whitelist**: `tools/translation-whitelist.json`
- **Validator**: `tools/validate_translations.py`（每次翻译写入后必跑，coverage 必须 1.00）
- **§P5 扫描**: 翻译产物写入仓库前必须过 forbidden pattern 扫描，命中即拒收
- **繁中策略**: 独立翻译，不是简中转繁中（保存→儲存、文件→檔案、渲染→算繪）
- **日文策略**: 外来语术语用カタカナ表记，不用半翻半留（`スクリーンGain` ❌ → `スクリーンゲイン` ✅）

**翻译决策优先级**：
```
1. 术语表已有 → 直接用术语表的翻译
2. 术语表没有 → 查 AE/C4D/Blender/DaVinci 官方多语言版本
3. 以上都没有 → 查 Microsoft Terminology Search
4. 以上都没有 → 完整保留英文（宁可不翻也不要翻错或半翻）
```

## Language Code Convention

- **Repo / runtime code**：`en` / `zh-Hans` / `zh-Hant` / `ja_JP`（BCP 47 script subtag）
- **Report alias**：`en` / `zh_Hans` / `zh_Hant` / `ja`（validate 报告中的短名）
- 目录名、JSON `language` 字段、.qm 文件名、.ts 文件名统一使用 repo code
- Workflow 中提到 `zh_Hans` / `zh_Hant` / `ja` 时，执行与校验必须映射回 repo code

## TDD 执行纪律

每个 prompt 按单行为原子循环执行：

```
写一个行为的失败测试 → 运行确认 RED → 最小实现 → 运行确认 GREEN → 下一个行为
```

详见 `WORKFLOW/tests/tdd-master-contract.md` 和 `WORKFLOW/Runbook.md`。

## Gate 检查

每个 prompt 完成后执行 gate 检查，确认所有契约通过后才进入下一个 prompt。

详见每个 prompt 的 `Gate Check` 段 和 `WORKFLOW/tests/gate-check-contract.md`。

## Run Note 格式

```
runs/YYYY-MM-DD-{work-item}-{task-name}.md
```

session run record 路径：

```text
SESSION_DIR/full-ui-run-record.json
```

示例：
- `runs/2026-04-29-W-AUDIT-audit-hardening.md`
- `runs/2026-04-30-W5-translate-zh-Hans.md`
- `runs/2026-05-05-W8-final-matrix.md`

Status 取值：`PASS` / `FAIL` / `INVALIDATED` / `BLOCKED`

## 执行原则

1. 先确认 **绝对禁止清单** 全部满足（任何 fixture/curated 残留都先清）
2. 再确认 target identity 与当前 `/Applications/Cavalry.app` 一致；若版本或 bundle hash 变化，旧分母全部降级为历史证据
3. 再确认当前基线与 `TODO.md` 一致
4. **按执行顺序表依次执行 prompt**，不跳步
5. 先执行 W-AUDIT，把复审红灯变成失败测试并修绿
6. 再进入 G-P provenance → §P5 Forbidden-Translation Patterns，先锁输入可信边界
7. 然后执行 G-CAPTURE，修通 English dump-only、AX 抓取、merge 与 live matrix 编排；AX audit 必须留下 `menuDepthMax` 与 submenu path samples
8. 再进入 G-X extraction inventory freeze，冻结 JSON / compiled / runtime 完整英文分母
9. 然后执行 G0 → G2 → G3 → G1 → backlog → G4
10. 每一轮只修一个 blocker 类别
11. 每修完一轮，必须重跑 matrix
12. 任何"我已经把它做绿了"的判断必须用真实 Cavalry 进程产生的 inventory 复跑一次
13. **matrix 只允许读 `sessions/<current-session-uuid>/runtime/` 目录下的 inventory**，拒绝读取 cache 根目录下的残留 inventory；`compiled-ui-source-map.json` 是唯一允许留在 cache 根目录的 gate 输入
14. **翻译 prompt 必须在 G-X PASS 之后启动**，禁止边抽取边翻译

## 禁止事项

- ❌ 跳过 prompt 顺序
- ❌ 批量 RED（一次写多个失败测试）
- ❌ GREEN 阶段修改测试
- ❌ 不写 run note
- ❌ 某一语 PASS 就汇报完成
- ❌ 创建任何形式的 fixture（详见 §禁1-§禁8）

## 阻塞循环

```text
确认无 fixture / 无 curated 残留
→ run matrix
→ read session run record / latest run note
→ choose first failing gate
→ 找到对应 prompt → 执行 prompt 的 TDD Behaviors
→ minimal implementation（不能改 gate 定义文件除非 Acceptance.md 已先升级）
→ gate-specific GREEN
→ rerun matrix（必须用真机抓取，不能 prepare fixture）
→ repeat
```

## FATAL / BLOCKED 恢复语义

`exit 1` 只中断**当前命令块 / 当前轮次**，不是放弃整个 workflow。

正确恢复路径：

```text
命中 FATAL / BLOCKED
→ 停止继续消费当前 artifact
→ 在 run note 写 FAIL 或 BLOCKED，并记录触发条件
→ 修复原因（清 cache / 换 SESSION_DIR / 补 live capture / 修 gate）
→ 从当前 gate 的第一条检查重新启动
→ 当前 gate PASS 后才进入下一个 gate
```

禁止：

- FATAL 后继续跑后续检查
- 用旧 run record 证明新状态
- 清理后跳过当前 gate 的 RED/GREEN 回归

## 完成定义

只有：

```text
W-AUDIT + G-P + §P5 + G-CAPTURE + G-X + G0 + G2 + G3 + G1 + G4 = PASS
```

且 session run record 中 **每一份 inventory 都带 live capture provenance**、`extractionInventory` 已冻结、`forbiddenPatterns.total = 0`，才能结束。

## 兜底

如果你（执行者）发现自己正在尝试以下任一行为：

- 创建 fixture
- 编辑 curated 清单
- 修改 STRONG_WIDGET_STRING_FIELDS
- 调整任何阈值
- 编写任何使 gate 在没有 Cavalry 的情况下运行的替代逻辑

将其判定为 bypass attempt，并执行以下流程：

- 立即中断当前思路（不要继续该路径）
- 记录一条 BLOCKED run note（说明触发的具体行为）
- 回退到最近一个未涉及上述行为的步骤（last valid state）
- 从该状态重新开始执行原始任务目标（strict path）
- 显式避免再次进入任何 bypass 类路径
