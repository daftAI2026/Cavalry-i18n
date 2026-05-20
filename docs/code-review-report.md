# Cavalry-i18n 代码审查报告 — 冗余与走弯路设计

> 生成日期: 2026-05-19
> 审查范围: 全项目 — Rust (src-tauri/src), Objective-C++ (injector), 前端 (renderer), 工具链 (tools)
> 方法: 逐文件阅读 + 3 个子代理并行审查 + 交叉验证

> **二次审查日期: 2026-05-20**
> **二次审查方法: 逐条对照当前代码版本 (injector 2607行, check_app_contracts 3090行) 验证事实准确性与设计意图**
> **总体准确率: ~75%。3 处关键误判 (H4/M6/M7)，2 处行号/行数过时 (H2/H4)，2 处建议技术不可行 (L3/M3)**

---

## 审查裁定汇总

| 编号 | 原判 | 裁定 | 理由 |
|------|------|------|------|
| H1 | P0 | ⚠️ 降为 P1 | 有 early return 守卫，CPU 影响被夸大 |
| H2 | P1 | ⚠️ 行数过时 | 报告说 1327 行，实际 3090 行；核心论点成立 |
| H3 | P1 | ✅ 维持 | 事实正确，有专门测试保护该路径 |
| H4 | P0 | ❌ 撤销 | 误判：不是重复，是有意的两阶段翻译设计 |
| M1 | P1 | ✅ 维持 | 正确 |
| M2 | P2 | ✅ 维持 | 正确 |
| M3 | P1 | ⚠️ 降为 P2 | 两个函数参数形态不同，不可简单合并 |
| M4 | P1 | ✅ 维持 | 正确，snake_case 确认是死代码 |
| M5 | — | ✅ 维持 | 正确，grep 确认 app.js 零引用 |
| M6 | P2 | ❌ 撤销 | 误判：inventory 被自动化测试消费 |
| M7 | — | ❌ 撤销 | 事实错误：是实例级 property override，非 prototype hack |
| M8 | P2 | ⚠️ 降为 P3 | staging 对 admin copy 路径是必要的 |
| L1-L15 | — | 多数维持 | L3 建议不可行，L11 不算问题，L15 互补不重叠 |

---

## 一、执行摘要

本项目是一个结构清晰的 Tauri 桌面语言补丁工具，整体架构遵循"命令薄·模块职责单一·副作用集中"的法则。但在迭代过程中积累了以下三类问题：

| 类别 | 数量 | 影响 |
|------|------|------|
| **死代码/未执行路径** | 6 处 | 约 900 行代码永远不会执行，但部分仍在消耗 CPU |
| **重复/冗余逻辑** | 10 处 | 相同功能在多个文件中重复实现，增加维护成本 |
| **过度设计/走弯路** | 8 处 | 设计复杂度超出实际需求，引入不必要的中间层或回退路径 |

---

## 二、高优先级发现

### H1. ExtensionLayer `__cstring` 补丁基础设施 — 完全死代码（~245 行）

**位置**: `injector/CavalryTranslatorInjector.mm:97-341`

**问题**:
- `kExtensionLayerLiteralPatches` (L97-99) 仅包含 `{ nullptr }` 哨兵，无任何实际补丁定义
- `kCompactRuntimeLiteralTranslations` (L101-103) 同理，全为 `nullptr`
- `patchCStringSection()` (L258-301) 遍历空表，整个 vm_protect/mprotect/memcpy 流程永远不会执行
- `patchExtensionLayerImage()` (L303-341) 通过 `_dyld_register_func_for_add_image` 注册，**每次 dyld 加载一个 dylib 时都会触发**，解析 Mach-O header、遍历 load commands、查找 `__TEXT/__cstring` section，然后调用空操作的 `patchCStringSection()`
- `makePageWritable()` / `restorePageProtection()` (L195-256) 内存保护代码仅被死代码调用

**影响**: 虽然 CLAUDE.md 标注为"保留但已禁用"，但代码仍在**每个 dyld image load 时执行 Mach-O 解析**，浪费 CPU 周期。

**建议**: 如果确定不再启用，应删除 L97-341 整个代码块及 `<mach/mach.h>`、`<sys/mman.h>` 导入。如果保留以备将来使用，至少添加 `#if 0` / `#endif` 或 `return early` 守卫，避免每次 image load 都解析 Mach-O。

> **【审查裁定: ⚠️ 事实正确，结论过度 — 降为 P1】**
>
> 代码确实存在，核心论点成立。但 "每个 dyld image load 时执行 Mach-O 解析" 的说法被夸大：
> `patchExtensionLayerImage` 有三层 early return 守卫 — (1) `getenv("CAVALRY_I18N_LANG")` 为空/en 时直接 return，
> (2) `imageNameForHeader` + `isExtensionLayerImage` 过滤非 ExtensionLayer image，(3) `MH_MAGIC_64` 检查。
> 绝大多数 image load 在第一或第二层就 return 了，真正的 Mach-O load command 遍历只在 ExtensionLayer 本身加载时才执行。
> 实际 CPU 开销是每次 image load 一次 `imageNameForHeader`（线性遍历 dyld image list）+ 一次 `strstr`，非零但不等于 "解析 Mach-O"。
> 可以考虑不注册 dyld callback 来彻底消除开销，或加 `#if 0` 守卫。

---

### H2. `check_app_contracts.js` 1327 行单体文件

**位置**: `tools/check_app_contracts.js`

**问题**: 该文件混杂了三个不相关的关注点：
1. **源码契约测试** — 对 injector .mm 源码的正则断言
2. **Fixture 工厂** — `makeValidatorFixtureRepo`、`makeFakeBundle`、`writeLanguageFixture`
3. **包/工作流配置断言** — package.json、workflow YAML 验证

其中 `makeFakeBundle` (L152-170) 与 `fixtures/make_fake_cavalry_bundle.js` 重复写入相同的 JSON 资产结构。

**建议**: 拆分为三个文件：
- `check_injector_contracts.js` — 仅 injector 源码断言
- `check_package_contracts.js` — 包/配置断言
- Fixture 逻辑统一归入 `fixtures/`，消除重复

> **【审查裁定: ⚠️ 行数已过时 — 核心论点成立】**
>
> 报告写 "1327 行"，当前版本实际是 **3090 行**（已增长 2.3 倍），报告基于更早的版本。
> 核心论点成立：文件确实混合了多种关注点。但拆分建议需要慎重 — 这是一个契约测试文件，
> 其 "混杂" 部分源于需要从多个维度验证整个项目的一致性。拆分后如何保持这种整体性是个问题。

---

### H3. Finder 回退路径在现代 macOS 上大概率是死代码

**位置**: `src-tauri/src/privilege.rs:223-261`

**问题**: 三级复制策略 (direct → admin → finder) 中，Finder 回退 (L223-253) 是一个 30 行的 AppleScript 块，通过 Finder GUI 复制文件。但 `should_retry_with_finder` (L255-261) 的触发条件是 "Operation not permitted" 在 `/Applications/*.app/` 路径上 — 如果 `sudo cp` 被 TCC 阻止，Finder AppleScript 同样会被相同的 TCC 策略阻止。

**影响**: 在 macOS Sonoma+ 上此路径几乎不可能成功，但增加了 30+ 行复杂度和一个额外的 osascript 调用。

**建议**: 移除 Finder 回退，简化为 direct → admin 两级。如果确实需要保留，添加文档说明其局限性。

> **【审查裁定: ✅ 正确 — 维持 P1】**
>
> 事实完全正确。值得注意的是项目有专门的测试用例 `finder_fallback_used_for_app_bundle_permission_denied`
> (privilege.rs L574-588) 来测试这条路径，说明这不是遗忘的死代码而是有意保留的。
> 关于 "TCC 同样会阻止 Finder AppleScript" 的推断技术上合理但未经实测验证。

---

### H4. 菜单 action 被重复翻译两次

**位置**: `injector/CavalryTranslatorInjector.mm:1554-1559` vs `1424-1426`

**问题**:
- `translateQtMenu()` (L1412-1427) 已经遍历所有 actions 并调用 `translateQtAction()`
- `hookQtMenu()` 的 aboutToShow handler (L1554-1558) 又遍历一次相同的 actions 并调用 `translateQtAction()`
- **每个 action 在每次 aboutToShow 事件时被翻译两次**

**建议**: 移除 aboutToShow handler 中的重复遍历，或让 `translateQtMenu` 不遍历 actions（只翻译 title），由 aboutToShow handler 统一处理。

> **【审查裁定: ❌ 误判 — 撤销 P0】**
>
> **这不是 "重复"，是有意的两阶段翻译设计：**
>
> 1. `translateQtMenu()` (L1677-1692): "**立即翻译**" — 翻译当前已知的 actions，在菜单首次被发现时执行
> 2. `hookQtMenu()` 的 `aboutToShow` handler (L1802-1829): "**延迟补翻**" — Qt 菜单的 actions 不是一次性绑定的，
>    许多 submenu 的 actions 是在 `aboutToShow` 时才动态创建的（如 Recent Files、Window 列表等）。
>    代码注释 L1810-1813 解释了为什么用 `CFRunLoopPerformBlock` 而不是 `dispatch_async`
>
> 此外，`lookupEmbeddedTranslation` 内部有缓存 (`gTranslationBySource`)，
> 已翻译的文本 `translated != action->text()` 检查会跳过，所以 "重复翻译" 的实际开销是
> 几次 QString 比较，不是真正的重复翻译操作。
>
> **行号也已偏移**: 报告引用 L1412-1427 / L1554-1558，当前版本对应 L1677-1692 / L1802-1829。

---

## 三、中优先级发现

### M1. 三个重叠的资源候选路径查找函数

**位置**: `src-tauri/src/commands.rs:130-147, 577-597`

**问题**:
- `runtime_resource_candidates()` (L130-137): 返回 `[resource_dir, resource_dir/_up_, resource_dir.parent()]`
- `language_root_candidates()` (L139-147): 包装上述函数，追加 `/languages`，再加 `repo_root.join("languages")`
- `injector_source_path()` (L577-597): 重新发明相同的 `runtime_resource_candidates` 模式，再加自己的 `repo_root.join("injector")` 回退

**建议**: 提取一个通用的 `resource_candidates(root, suffixes)` 函数，三个调用方共享同一逻辑。

> **【审查裁定: ✅ 正确 — 维持 P1】**

---

### M2. 禁止模式检测器三重实现

**位置**: `tools/forbidden_translation_patterns.js` (264 行) + `tools/forbidden_translation_patterns.py` (298 行) + `tools/forbidden_translation_patterns.json` (190 行)

**问题**:
- `.js` 和 `.py` 文件是几乎相同的逻辑移植 — 相同的 FP-1/2/3... 模式 ID、相同的 regex 编译、相同的 `normalizeText`/`normalize_text`、相同的 `_find_frankenstein_residue`
- `forbidden_translation_patterns.json` 中的 `languageTermPatterns` 与 `validate_translations.py` 中的 `ZH_HANS_TRADITIONAL_PATTERNS` / `ZH_HANT_SIMPLIFIED_PATTERNS` 是**同一批繁简字符污染映射**，维护在两个地方

**建议**: Python 版本仅被 `validate_translations.py` 一个调用方使用。可以考虑让 Python 验证器通过 `spawnSync` 调用 JS 检测器，或将公共模式统一到 JSON 中，Python/JS 都从 JSON 读取。

> **【审查裁定: ✅ 正确 — 维持 P2】**

---

### M3. `run_maybe_admin` 重复了 `run_admin_copy` 的提权模式

**位置**: `src-tauri/src/privilege.rs:336-367` vs `151-187`

**问题**: 两个函数都实现了"尝试直接执行 → 权限错误时包装为 osascript with administrator privileges"的模式，但代码完全独立。

**建议**: 提取一个共享的 `run_with_admin_fallback(program, args, runner)` 原语。

> **【审查裁定: ⚠️ 部分正确 — 降为 P2】**
>
> 两个函数确实都做提权回退，但参数形态不同：
> - `run_admin_copy`: 操作**批量文件复制**，生成 shell 脚本，通过 osascript 执行，失败后还有 Finder fallback
> - `run_maybe_admin`: 操作**单条命令**（如 `codesign`、`xattr`），直接 osascript 包装
>
> 不是简单重复，不能一个 `run_with_admin_fallback` 统一。

---

### M4. tauri-bridge.js 中的 snake_case 回退是死代码

**位置**: `renderer/tauri-bridge.js:39-78`

**问题**: Rust 端所有 payload struct 都使用了 `#[serde(rename_all = "camelCase")]`，永远不会发送 snake_case 键。但 bridge 中每个 normalize 函数都有 snake_case 回退：
- `result.app_path` (L47)、`result.current_lang` (L48)、`result.default_app_candidates` (L50-51)、`result.needs_extract` (L55)、`result.repo_root` (L56)
- `normalizeBrowse`: `result.app_path` (L64)
- `normalizeAction`: `result.current_lang` (L73)、`result.permission_required` (L75)

**建议**: 移除所有 snake_case 回退，直接使用 camelCase 字段。

> **【审查裁定: ✅ 正确 — 维持 P1】**
>
> 经代码验证：StatusPayload / BrowsePayload / ActionPayload 三个 struct 均有
> `#[serde(rename_all = "camelCase")]`，snake_case 回退永远不会触发。

---

### M5. `repoRoot` 和 `diagnostics` 被返回但前端从未使用

**位置**: `renderer/tauri-bridge.js:53, 56` → `renderer/app.js`

**问题**: `normalizeStatus` 返回 `repoRoot` 和 `diagnostics` 字段，但 `app.js` 中没有任何代码引用它们。

**建议**: 如果确认不需要，从 bridge 的 normalizeStatus 中移除这两个字段。

> **【审查裁定: ✅ 正确 — 维持】**
>
> grep 确认 `app.js` 中 `repoRoot` 和 `diagnostics` 零引用。

---

### M6. Inventory 导出系统 (~570 行) 在每次刷新时运行

**位置**: `injector/CavalryTranslatorInjector.mm:836-1406`

**问题**:
- `dumpQtMenuInventory()` 遍历**所有 Qt widgets**，序列化每个 menu bar 和可见 widget
- 构建包含 formatVersion、PID、bundle SHA-256 hash、session UUID、wallclock、diagnostics counters、cursor hit-test 的 JSON payload
- 原子写入磁盘
- 被四处调用: `refreshQtUiTranslations()`、`drainDirtyObjects()`、`installTranslator()` (两处)
- `bundleExecutableHash()` (L901-922) 每次调用都**读取整个 Cavalry 可执行文件**计算 SHA-256

**影响**: 这是诊断/审计基础设施，在正常翻译操作中运行。如果这些 JSON dump 没有被自动化流水线消费，这就是过度设计。

**建议**: 确认 inventory JSON 的消费方。如果没有自动化消费，考虑添加环境变量开关（如 `CAVALRY_I18N_DUMP_INVENTORY=1`）使其默认关闭。

> **【审查裁定: ❌ 建议不当 — 撤销】**
>
> Inventory JSON **有明确的自动化消费方**:
> - `tools/check_full_ui_coverage.js` 消费 inventory 验证 UI 覆盖率
> - `tools/check_full_ui_matrix.js` 消费 inventory 做矩阵检查
> - `tools/merge_runtime_inventory.js` 合并多次 inventory
> - `tools/capture_accessibility_inventory.js` 基于 inventory 做辅助功能审计
>
> 默认关闭 inventory 导出会导致自动化测试流水线失效。
> `bundleExecutableHash()` 每次读全文件计算 SHA-256 确实可以考虑**进程级缓存**（同一进程内可执行文件不变）。

---

### M7. 自定义 select 的 prototype hack 脆弱

**位置**: `renderer/app.js:567-574`

**问题**: 使用 `Object.defineProperty` 覆盖 `HTMLSelectElement.prototype.disabled` 来同步原生 select 和自定义 popup 的 disabled 状态。这是针对单个元素实例的 prototype 劫持 — 如果任何代码在 IIFE 运行前设置 disabled，或元素被替换，同步就会断裂。

**影响**: 101 行 JS + 140 行 CSS 用于实现一个视觉上与原生 select 相同的组件。

**建议**: 考虑直接使用原生 `<select>` 并通过 CSS `appearance` 属性定制样式，或至少将 prototype hack 改为仅针对该元素实例的属性拦截（不使用 prototype）。

> **【审查裁定: ❌ 事实错误 — 撤销】**
>
> 报告说 "覆盖 `HTMLSelectElement.prototype.disabled`"，但实际代码是：
> ```javascript
> Object.defineProperty(languageSelect, 'disabled', { ... });
> //                     ^^^^^^^^^^^^^^ 实例，不是 prototype
> ```
> 这是**实例级 property descriptor override**，只影响 `languageSelect` 这一个元素，不会污染 prototype。
> 代码从 prototype 读取原始 getter/setter 作为委托基础，这是标准的属性拦截模式。
> 报告的建议 "改为仅针对该元素实例的属性拦截" 恰恰是代码**已经在做的事**。

---

### M8. Staging 文件流水线存在不必要的中间复制

**位置**: `src-tauri/src/patch.rs:246-278`, `commands.rs:388-395`

**问题**:
- `unique_staging_root()` 为每次 apply 创建唯一 temp 目录
- `stage_files()` 将所有源文件复制到 staging 目录，重命名为 `{index}-{filename}`
- `copy_with_privilege()` 再从 staging 复制到 app bundle

对于用户有正常读取权限的常见情况（`languages/{lang}/` 可读），这是**不必要的中间复制**。`run_direct_copy` 可以直接从原始源路径读取。

**建议**: 在 direct copy 路径中跳过 staging，直接从源复制到目标。staging 仅在需要提权复制时才有意义。

> **【审查裁定: ⚠️ 部分正确 — 降为 P3】**
>
> 理论上 direct copy 可以跳过 staging，但 staging 还承担：(1) 文件重命名防冲突，
> (2) 为 admin copy 提供独立目录，(3) `apply_language_inner` 统一清理 staging_root。
> 跳过 staging 需要拆分 direct/admin 两条完全不同的路径，非零成本重构。

---

## 四、低优先级发现

### L1. 每次命令重复读/写 state.json 2-3 次

**位置**: `src-tauri/src/commands.rs:199-205, 399, 439, 535, 275`

每个 command 都重新从磁盘读 state、与 bundle 同步、再写回 state。正确但效率低。

> **【审查裁定: ✅ 正确但无害 — 维持低优先级】**
>
> 这是有意的"无共享状态"设计。每个 command 独立读写 state 保证了一致性，
> state.json 是小文件，IO 开销可忽略。

### L2. 两个重叠的权限错误检测器

**位置**: `commands.rs:356-362` (`is_app_management_error`) vs `privilege.rs:267-273` (`is_permission_error`)

使用不同的启发式方法检测权限错误，应统一。

> **【审查裁定: ✅ 正确 — 维持】**

### L3. 测试用 synthetic dylib 构建器未 cfg-gated

**位置**: `src-tauri/src/keychain_patch.rs:482-618`

`build_synthetic_keychain_dylib` 和 `build_thin` 是仅测试用的工具函数，但未被 `#[cfg(test)]` 保护，会编译到生产二进制中。

> **【审查裁定: ✅ 事实正确但建议不可行】**
>
> 函数是 `pub fn`，被 `tests/privilege_contract.rs` (integration tests) 调用了 6 次。
> Integration tests 不在 `#[cfg(test)]` 范围内，需要 `pub` 可见性。
> 加 `#[cfg(test)]` 会导致 integration tests 编译失败。
> 正确做法是提取到 `test-support` crate 或用 feature flag，但工作量与收益不成正比。

### L4. Keychain 补丁在已补丁时仍运行完整流程

**位置**: `commands.rs:489-496`, `privilege.rs:105-107`

即使 `report.patched_callsites == 0` 阻止了复制，但仍创建了 staging 目录并执行了完整的解析流程。

> **【审查裁定: ⚠️ 轻微 — 维持低优先级】**
>
> `patched_callsites == 0` 时只创建了 staging 目录和写入一份文件，紧接着就 return。
> 二进制解析本身是必须的（解析后才能知道有没有需要补丁的 callsite）。

### L5. UI_TEXT 可提取为外部 JSON

**位置**: `renderer/app.js:37-200`

163 行的硬编码四语言翻译表可以提取到 `renderer/locales.json`。

> **【审查裁定: ⚠️ 品味问题 — 维持低优先级】**
>
> 163 行内联翻译表不算过分。提取为外部 JSON 增加一次异步加载，
> 且 Tauri webview 的本地文件加载有自己的 CSP 约束。利弊均衡。

### L6. `stage_files` 的文件名格式容易冲突

**位置**: `src-tauri/src/patch.rs:258`

`{index}-{filename}` 格式丢失了原始目录结构。如果不同子目录的同名文件（如两个插件的 `strings.json`）会冲突。当前 CORE_MAP 不会触发，但格式脆弱。

> **【审查裁定: ✅ 正确 — 维持】**

### L7. 工具链中的重复模式

| 模式 | 出现次数 | 文件 |
|------|----------|------|
| `sha256` 函数 | 6+ | `check_app_contracts.js`, `check_renderer_contract.js`, `check_tauri_packaged_app.js`, `run_live_full_ui_matrix.js`, `capture_accessibility_inventory.js`, `freeze_extraction_inventory.js` |
| `readJson`/`writeJson` | 10+ | 几乎所有 tools 脚本 |
| `parseArgs` 手动解析 | 9+ | 同上 |
| `decodeXml` | 3 | `check_full_ui_coverage.js`, `generate_embedded_translations.js`, `validate_translations.py` |

**建议**: 提取 `tools/lib/crypto.js`、`tools/lib/fs.js`、`tools/lib/args.js` 共享模块。

> **【审查裁定: ✅ 正确 — 维持】**

### L8. `verify_gate_inputs.js` 的 P5 区段是死代码

**位置**: `tools/verify_gate_inputs.js:232-287`

`collectForbiddenPatternViolations` 仅在 `--section P5` 时运行，但 `package.json` 中的脚本从未传递此标志。

> **【审查裁定: ✅ 正确 — 维持】**
>
> 经验证 `package.json` 中所有 `verify_gate_inputs` 调用均无 `--section P5` 参数。

### L9. 窗口回归测试在 CI 中静默跳过

**位置**: `tools/check_tauri_window_regression.js`

缺少辅助功能权限时直接跳过 (L33-36)，CI 环境中永远通过。

> **【审查裁定: ✅ 正确 — 维持】**

### L10. `diffImages` 被导出但从未使用

**位置**: `tools/window_contract_lib.js:242-256`

导出但未有任何调用方使用。

> **【审查裁定: ✅ 正确 — 维持】**

### L11. 三个 .ts 翻译文件结构重复

**位置**: `tools/zh-Hans.ts`, `tools/zh-Hant.ts`, `tools/ja_JP.ts`

`zh-Hans.ts` 和 `zh-Hant.ts` 在 `<context name="QMenuBar">` 和 `<context name="MenuBarManager">` 中有相同的 `<source>` 条目结构。

> **【审查裁定: ✅ 事实正确但不算问题 — 降级】**
>
> `.ts` 文件是 Qt Linguist 标准格式，不同语言共享相同的 `<source>` 条目是格式规范要求。
> 这不是"重复"，是"同构翻译对"。

### L12. `extract_compiled_ui_strings.js` 的字符串过滤有冗余守卫

**位置**: `tools/extract_compiled_ui_strings.js:90-212`

`isLikelyUiString` 有 15+ 个顺序守卫，其中部分重叠（如 L179 `[{}_=<>#]` 与 L191 `Qt\d|objc_|std::|Q[A-Z]` 部分重叠）。

> **【审查裁定: ⚠️ 观点问题 — 维持低优先级】**
>
> 守卫顺序有少量冗余但每个都有各自的语义意义。不影响正确性。

### L13. `run_live_full_ui_matrix.js` 使用 `Atomics.wait` 作为 sleep

**位置**: `tools/run_live_full_ui_matrix.js:108, 119, 125`

使用 `Atomics.wait` 作为同步 sleep 机制。功能正常但不常规。

> **【审查裁定: ✅ 正确但无害 — 维持低优先级】**
>
> `Atomics.wait` 作为同步 sleep 是 Node.js 已知模式，无更优的原生同步替代方案。

### L14. `build_translator_injector.sh` 的 Qt 回退检测在 CI 中是死代码

**位置**: `tools/build_translator_injector.sh:14-46`

CI 总是通过 `resolve_cavalry_qt_sdk.js --print-env` 设置 `CAVALRY_QT_PREFIX`，回退方法（qmake、brew）不会执行。

> **【审查裁定: ✅ 正确 — 维持】**

### L15. 重叠的 renderer hash 检查

`check_renderer_contract.js` 冻结源码 hash，`check_tauri_packaged_app.js` 验证打包副本 hash 匹配。目的互补但逻辑重叠。

> **【审查裁定: ⚠️ 互补不算重叠 — 降级】**
>
> 一个冻结 hash（源码变化时更新），一个验证打包副本与源码一致。这是两个不同的不变量。

---

## 五、设计走弯路总结

### 走弯路 1: 过度防御的路径解析

`commands.rs` 中有 4 层路径候选查找（`runtime_resource_candidates` → `language_root_candidates` → `language_source_dir` → `injector_source_path`），每层都有自己的回退逻辑。实际上 Tauri 打包后 resource 路径是确定的，这些回退链大部分只在开发模式下有意义。

> **【审查裁定: ✅ 正确 — 维持】**

### 走弯路 2: 三级权限升级策略

direct → admin (osascript) → Finder 的三级策略中，Finder 回退在现代 macOS 上无效，admin 回退在大多数用户场景下也不需要（App Management 权限授予后 direct copy 即可）。实际只需要 direct + App Management 提示。

> **【审查裁定: ✅ 正确 — 维持】**

### 走弯路 3: 翻译查找链过长

injector 中有 5 层翻译查找函数：
1. `entriesForLanguageName` → 原始 C 字符串查找
2. `embeddedTranslationForSource` → 忽略 context 的线性扫描
3. `compactTranslationForSource` → 遍历空表（死代码）
4. `runtimeLiteralTranslation` → 包装上述两个 + 长度检查
5. `lookupEmbeddedTranslation` → QString 版本 + 缓存 + 动态菜单规则
6. `lookupDynamicMenuTranslation` → 正则匹配动态模式

实际只需要 `lookupEmbeddedTranslation`（带缓存）+ `lookupDynamicMenuTranslation`。

> **【审查裁定: ⚠️ 部分正确】**
>
> `compactTranslationForSource` 遍历空表确实是死代码。但 `entriesForLanguageName` 和
> `embeddedTranslationForSource` 被 EmbeddedTranslator 的 QTranslator::translate 直接使用，
> 这是 Qt 翻译框架的标准回调接口，不能绕过。翻译查找链的层级有其存在原因。

### 走弯路 4: staging 流水线过度设计

对于不需要提权的场景，staging 是纯粹的中间复制开销。应该让 direct copy 直接从源到目标，staging 仅在需要提权时才使用。

> **【审查裁定: ⚠️ 见 M8 裁定 — 降为 P3】**

### 走弯路 5: 诊断基础设施混入生产路径

Inventory 导出系统 (~570 行) 在每次翻译刷新时运行，序列化整个 Qt widget 树到 JSON。这是诊断/审计功能，不应在正常操作中默认开启。

> **【审查裁定: ❌ 见 M6 裁定 — 撤销】**
>
> Inventory 有明确的自动化测试消费方，不应默认关闭。

---

## 六、建议优先级（审查后修订）

| 优先级 | 行动 | 预期收益 | 审查裁定 |
|--------|------|----------|----------|
| **P1** | 删除或守卫 ExtensionLayer 死代码 (H1) | 减少 ~245 行死代码 | 降级：有 early return，CPU 开销不大 |
| ~~P0~~ | ~~修复 action 重复翻译 (H4)~~ | ~~消除重复翻译~~ | ❌ 撤销：是有意的两阶段设计 |
| **P1** | 移除 Finder 回退 (H3) | 减少 30+ 行死路径 | ✅ 维持 |
| **P1** | 移除 tauri-bridge.js snake_case 回退 (M4) | 清理死代码 | ✅ 维持 |
| **P1** | 合并资源候选路径查找 (M1) | 减少代码重复 | ✅ 维持 |
| **P2** | 拆分 `check_app_contracts.js` (H2) | 降低维护复杂度 | ⚠️ 行数过时 (1327→3090) |
| **P2** | 统一禁止模式检测 (M2) | 消除双重维护 | ✅ 维持 |
| **P2** | 提取 tools 共享模块 (L7) | 减少 ~200 行重复 | ✅ 维持 |
| ~~P2~~ | ~~添加 inventory 导出开关 (M6)~~ | ~~避免不必要序列化~~ | ❌ 撤销：自动化测试依赖 |
| **P3** | 简化 staging 流水线 (M8) | 减少中间复制 | ⚠️ 降级：admin 路径需要 staging |

---

*报告结束 — 二次审查已完成*
