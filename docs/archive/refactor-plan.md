# Cavalry-i18n 精简改造方案

> **核心思路**：砍掉一切无效的 QM / DYLD 注入链路，只保留「JSON 文件替换」这条唯一生效的翻译路径。Electron 桌面端作为唯一入口，简洁、有审美、一键完成。

---

## 一、当前项目问题

```
当前项目有 4 条并行路径，只有 1 条真正生效：

✅ JSON 覆盖（16 个文件）        ← 唯一有效
❌ Qt .qm 编译 + 安装             ← Cavalry 不加载，无效
❌ DYLD 注入器 (ObjC dylib)       ← 需要 re-sign，用户门槛极高
❌ LanguageSwitcher.js (Script UI) ← 受限于 Cavalry 沙箱权限
```

---

## 二、改造后的目标架构

```
Cavalry-i18n/
├── desktop-patcher/              # Electron 桌面程序（唯一入口）
│   ├── main.js                   # 主进程：IPC 调度
│   ├── preload.js                # 桥接层
│   ├── lib/
│   │   ├── detect.js             # Cavalry 检测 + 版本读取（纯读取，零副作用）
│   │   ├── patch.js              # 提取 + 覆盖逻辑（生成 pairs，不直接执行提权）
│   │   └── sudo.js               # 跨平台提权执行（唯一的 platform fork 点）
│   └── renderer/
│       ├── index.html            # 简洁 UI
│       ├── styles.css
│       └── app.js
├── languages/                    # 翻译资源（从 LanguageSwitcher_assets/languages 移过来）
│   │                             # ⚠️ en/ 不 git track，运行时从 bundle 提取到 state dir
│   ├── zh-Hans/                  # 简体中文
│   ├── zh-Hant/                  # 繁体中文
│   └── ja_JP/                    # 日语
├── docs/                          # 保留有价值的文档
│   ├── cavalry-glossary.md
│   ├── translation-guidelines.md
│   └── translation-whitelist.json
├── package.json
└── README.md
```

### 为什么拆成三个文件而不是一个 `patcher.js`？

- `detect.js` — 纯读取，零副作用，可独立测试
- `patch.js` — 文件复制逻辑，生成 copy pairs 但不执行提权
- `sudo.js` — 唯一的 platform-specific 代码，`process.platform` 分支隔离在此

这样 Windows 适配（P2 阶段）只需要改 `sudo.js` 一个文件。

---

## 三、状态持久化（state.json）

### 位置

```
macOS:   ~/Library/Application Support/cavalry-i18n/state.json
Windows: %APPDATA%/cavalry-i18n/state.json
```

使用 Electron 的 `app.getPath('userData')` 获取。

### Schema

```jsonc
{
  "appPath": "/Applications/Cavalry.app",   // 上次使用的 Cavalry 路径
  "cavalryVersion": "2.7.0",                // 上次提取/patch 时的 Cavalry 版本
  "currentLang": "zh-Hans",                 // 当前已应用的语言（"en" = 未翻译）
  "lastPatchedAt": "2026-04-21T08:00:00Z"   // 上次 patch 的时间戳
}
```

### 生命周期

| 事件 | 操作 |
|------|------|
| 首次启动，state.json 不存在 | 自动检测 Cavalry 路径，创建 state.json，`currentLang: "en"` |
| 用户 Apply 语言 | 更新 `currentLang` + `lastPatchedAt` + `cavalryVersion` |
| 打开时发现 `cavalryVersion` ≠ bundle 实际版本 | 标记 `needsExtract: true`，UI 提示用户重新应用 |
| 用户 Browse 选了新路径 | 更新 `appPath`，重新检测版本 |

---

## 四、Electron 功能清单（4 个核心动作）

### 动作 1：检测 Cavalry 安装

```
自动探测：
  1. state.json 中记录的上次路径
  2. /Applications/Cavalry.app
  3. ~/Applications/Cavalry.app
  4. 用户手动 Browse 选择

检测到后展示：
  - Cavalry 版本号（从 Info.plist 读取）
  - 安装路径
  - 当前语言状态（从 state.json 读取）
```

**现有可复用**：`patcher-config.js` → `getExistingDefaultAppPath()` / `readBundleVersion()` / `inspectBundle()`（砍掉 QM 相关字段）

### 动作 2：提取英文原版 JSON（首次 / Cavalry 更新后）

```
功能：
  从 Cavalry.app/Contents/assets/ 提取 JSON 到 state dir 的 en/ 子目录

触发时机：
  - state dir 中 en/ 目录不存在（首次使用）
  - state.json 中 cavalryVersion ≠ bundle 实际版本（Cavalry 升级了）
  - 用户手动触发

提取映射：
  Contents/assets/Definitions/nodeStrings.json → {stateDir}/en/nodeStrings.json
  Contents/assets/Definitions/appStrings.json  → {stateDir}/en/appStrings.json
  Contents/assets/Learn/tips.json              → {stateDir}/en/tips.json
  Contents/assets/Learn/onboarding.json        → {stateDir}/en/onboarding.json
  Contents/assets/Plugins/{Name}/strings.json  → {stateDir}/en/plugins/{camelName}.json
```

**关键设计**：`en/` 快照存放在用户 state 目录（不 git track），恢复英文时直接从 bundle 原始文件恢复，不依赖旧快照。这样即使 Cavalry 更新了字符串，恢复操作也总是写回当前版本的正确英文。

**现有可复用**：`extract_strings.py` 的逻辑，用 Node.js `fs` 重写，不再依赖 Python。

### 动作 3：应用翻译（JSON 覆盖 + sudo）

```
功能：
  把 languages/{lang}/ 下的 JSON 写回 Cavalry.app

覆盖映射（逆向）：
  languages/{lang}/nodeStrings.json            → Contents/assets/Definitions/nodeStrings.json
  languages/{lang}/appStrings.json             → Contents/assets/Definitions/appStrings.json
  languages/{lang}/tips.json                   → Contents/assets/Learn/tips.json
  languages/{lang}/onboarding.json             → Contents/assets/Learn/onboarding.json
  languages/{lang}/plugins/{camelName}.json    → Contents/assets/Plugins/{Folder Name}/strings.json

覆盖流程（原子性保证）：
  1. 先把所有翻译文件 cp 到 /tmp/cavalry-patch-staging/（用户态，无需权限）
  2. 用 sudo 一次性把 staging 目录的文件 mv/cp 到 bundle 内
  3. 成功后更新 state.json
  4. 如果 sudo 失败或被用户取消，staging 目录清理，bundle 不受影响
```

**现有可复用**：`patch_cavalry_bundle.py` → `patch_json_assets()` 逻辑，Node.js 重写。

### 动作 4：恢复英文 / 重启 Cavalry

```
恢复：选 English 时，从当前 bundle 重新提取英文原版写回（确保是当前版本的原始字符串）
重启：
  macOS: spawn('open', ['-n', appPath]) 然后 kill 旧进程
  Windows: spawn('cmd', ['/c', 'start', '', 'Cavalry.exe']) 然后 taskkill
```

---

## 五、Electron UI 设计（简洁版）

现有 UI 太复杂（QM target、output-app、diagnostics grid、stdout log 全暴露了）。

### 新 UI 只需要一屏：

```
┌─────────────────────────────────────────────┐
│                                             │
│   🌐 Cavalry Language Switcher             │
│                                             │
│   ┌─────────────────────────────────────┐   │
│   │  Cavalry 2.7.0                      │   │
│   │  /Applications/Cavalry.app     [📁] │   │
│   └─────────────────────────────────────┘   │
│                                             │
│   Current: English                          │
│                                             │
│   ┌──────────────────────────┐              │
│   │  简体中文            ▾   │              │
│   └──────────────────────────┘              │
│                                             │
│   ┌──────────────────────────┐              │
│   │  ✨ Apply & Restart      │              │
│   └──────────────────────────┘              │
│                                             │
│   ┌─────────────────────────────────────┐   │
│   │  ⓘ Status area                     │   │
│   │  Ready / Applying... / Done ✓       │   │
│   └─────────────────────────────────────┘   │
│                                             │
└─────────────────────────────────────────────┘
```

### UI 要素：

| 元素 | 说明 |
|------|------|
| Cavalry 信息卡片 | 版本号 + 路径 + 小文件夹按钮可重选 |
| 当前语言 | 从 `state.json` 读取并显示 |
| 语言选择器 | DropDown，列出 languages/ 下的目录 + English |
| Apply & Restart 按钮 | 主按钮，执行覆盖 + 弹 sudo + 重启 |
| 状态区 | 一行文字，显示进度/结果/错误，不需要完整 stdout log |

### 砍掉的 UI 元素：

- ❌ Output app path（不再需要 clone bundle）
- ❌ QM target 选择器
- ❌ Refresh English checkbox（自动检测版本变化时触发）
- ❌ Inspect 按钮 + diagnostics grid（检测在后台自动完成）
- ❌ Patch output log（用一行状态替代）

---

## 六、要删除的文件清单

### 整个删除的目录/文件：

```
# QM / 注入器相关（无效路径）
desktop-patcher/injector/                      # ObjC DYLD 注入器源码
tools/build_translator_injector.sh             # 编译注入器
tools/launch_cavalry_with_injector.sh          # 注入器启动脚本
tools/check_translator_injector.py             # 注入器合约测试
tools/check_translated_launcher.py             # 启动器合约测试
tools/check_compiled_menu_contexts.py          # compiled menu 合约测试
docs/compiled-menu-contexts.json                # compiled menu 字符串清单
docs/cavalry-menu-localization-feasibility.md   # QM 可行性研究

# Qt Linguist 源文件（不再编译 .qm）
tools/zh-Hans.ts
tools/zh-Hant.ts
tools/ja_JP.ts

# 各语言目录下的 .qm 文件
LanguageSwitcher_assets/languages/zh-Hans/cavalry_zh-Hans.qm
LanguageSwitcher_assets/languages/zh-Hans/qtbase_zh-Hans.qm
LanguageSwitcher_assets/languages/zh-Hant/cavalry_zh-Hant.qm
LanguageSwitcher_assets/languages/zh-Hant/qtbase_zh-Hant.qm
LanguageSwitcher_assets/languages/ja_JP/cavalry_ja_JP.qm
LanguageSwitcher_assets/languages/ja_JP/qtbase_ja_JP.qm

# Python 工具（逻辑迁移到 Node.js 后删除）
tools/patch_cavalry_bundle.py
tools/check_patch_cavalry_bundle.py
tools/extract_strings.py

# 翻译批处理脚本（一次性用过的）
tools/trans_batch_*.py
tools/translate_nodeStrings.py
tools/apply_translations.py
tools/strings_*.json
tools/all_strings.json
tools/dict_*.json

# Cavalry Script UI 版本（删除，不再维护两套入口）
LanguageSwitcher.js
tools/check_language_switcher_runtime.js

# Python 缓存
tools/__pycache__/
```

### 保留：

| 文件 | 理由 |
|------|------|
| `tools/validate_translations.py` | 翻译质量校验，CI 仍可用 |
| `tools/check_electron_patcher_ui.js` | Electron 合约测试，改造后需更新 |
| `docs/cavalry-scripting-*` | 逆向工程参考文档，留着有价值 |
| `docs/plan-v3.md` | 历史记录，可归档 |

---

## 七、核心逻辑伪代码

### lib/detect.js — Cavalry 检测

```javascript
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');

function getDefaultAppCandidates() {
  return [
    '/Applications/Cavalry.app',
    path.join(os.homedir(), 'Applications', 'Cavalry.app'),
  ];
}

function findCavalryApp(stateAppPath) {
  // 优先使用 state 中记录的路径
  const candidates = stateAppPath
    ? [stateAppPath, ...getDefaultAppCandidates()]
    : getDefaultAppCandidates();
  return candidates.find((c) => fs.existsSync(c)) || '';
}

function readBundleVersion(appPath) {
  const infoPlist = path.join(appPath, 'Contents', 'Info.plist');
  if (!fs.existsSync(infoPlist)) return '';
  try {
    return execFileSync(
      '/usr/libexec/PlistBuddy',
      ['-c', 'Print :CFBundleShortVersionString', infoPlist],
      { encoding: 'utf-8' }
    ).trim();
  } catch {
    return '';
  }
}

function listLanguageOptions(languagesDir) {
  return fs
    .readdirSync(languagesDir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && e.name !== 'en')
    .map((e) => e.name)
    .sort();
}
```

### lib/patch.js — 提取 + 覆盖逻辑

```javascript
const fs = require('node:fs');
const path = require('node:path');

// 4 个核心文件的映射
const CORE_MAP = [
  { file: 'nodeStrings.json',  subdir: 'Definitions' },
  { file: 'appStrings.json',   subdir: 'Definitions' },
  { file: 'tips.json',         subdir: 'Learn' },
  { file: 'onboarding.json',   subdir: 'Learn' },
];

/**
 * 动态扫描插件目录，返回 { folderName, camelName } 列表。
 * 不再硬编码 PLUGIN_MAP，自动发现所有含 strings.json 的插件。
 */
function discoverPlugins(appPath) {
  const pluginsDir = path.join(appPath, 'Contents', 'assets', 'Plugins');
  if (!fs.existsSync(pluginsDir)) return [];

  return fs.readdirSync(pluginsDir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .filter((e) => fs.existsSync(path.join(pluginsDir, e.name, 'strings.json')))
    .map((e) => ({
      folderName: e.name,
      camelName: toCamelCase(e.name),
    }));
}

function toCamelCase(name) {
  const words = name.split(/\s+/);
  return words[0].toLowerCase() + words.slice(1).map((w) => w[0].toUpperCase() + w.slice(1)).join('');
}

/**
 * 提取英文原版 JSON 到 state 目录
 */
function extractEnglish(appPath, enDir) {
  const assets = path.join(appPath, 'Contents', 'assets');
  fs.mkdirSync(enDir, { recursive: true });

  for (const { file, subdir } of CORE_MAP) {
    fs.copyFileSync(path.join(assets, subdir, file), path.join(enDir, file));
  }

  const pluginsOut = path.join(enDir, 'plugins');
  fs.mkdirSync(pluginsOut, { recursive: true });
  for (const { folderName, camelName } of discoverPlugins(appPath)) {
    const src = path.join(assets, 'Plugins', folderName, 'strings.json');
    fs.copyFileSync(src, path.join(pluginsOut, `${camelName}.json`));
  }
}

/**
 * 生成 { src, dst } 配对列表（不执行写入）
 */
function buildCopyPairs(langDir, appPath) {
  const assets = path.join(appPath, 'Contents', 'assets');
  const pairs = [];

  for (const { file, subdir } of CORE_MAP) {
    const src = path.join(langDir, file);
    if (fs.existsSync(src)) {
      pairs.push({ src, dst: path.join(assets, subdir, file) });
    }
  }

  for (const { folderName, camelName } of discoverPlugins(appPath)) {
    const src = path.join(langDir, 'plugins', `${camelName}.json`);
    if (fs.existsSync(src)) {
      pairs.push({ src, dst: path.join(assets, 'Plugins', folderName, 'strings.json') });
    }
  }

  return pairs;
}

/**
 * 将 pairs 写入 staging 目录，返回 staging 内的新 pairs
 * 保证原子性：先全部 cp 到 staging，再由 sudo 一次性写入 bundle
 */
function stageFiles(pairs, stagingDir) {
  fs.mkdirSync(stagingDir, { recursive: true });
  return pairs.map(({ src, dst }, i) => {
    const staged = path.join(stagingDir, `${i}_${path.basename(src)}`);
    fs.copyFileSync(src, staged);
    return { src: staged, dst };
  });
}
```

### lib/sudo.js — 跨平台提权

```javascript
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execSync } = require('node:child_process');

/**
 * macOS: 写临时 shell 脚本，用 osascript 提权执行。
 * 避免拼接字符串导致的 shell 注入风险。
 */
function sudoCopyMac(pairs) {
  const scriptPath = path.join(os.tmpdir(), `cavalry-patch-${Date.now()}.sh`);
  const lines = ['#!/bin/sh', 'set -e'];
  for (const { src, dst } of pairs) {
    // 用 printf %s 避免路径中特殊字符被 shell 展开
    lines.push(`cp "${src.replace(/"/g, '\\"')}" "${dst.replace(/"/g, '\\"')}"`);
  }
  fs.writeFileSync(scriptPath, lines.join('\n'), { mode: 0o755 });

  try {
    execSync(
      `osascript -e 'do shell script "sh ${scriptPath.replace(/"/g, '\\"')}" with administrator privileges'`
    );
  } finally {
    fs.unlinkSync(scriptPath);
  }
}

/**
 * Windows: 写临时 .ps1 脚本，用 Start-Process -Verb RunAs 提权执行。
 */
function sudoCopyWindows(pairs) {
  const scriptPath = path.join(os.tmpdir(), `cavalry-patch-${Date.now()}.ps1`);
  const lines = pairs.map(
    ({ src, dst }) => `Copy-Item -LiteralPath '${src}' -Destination '${dst}' -Force`
  );
  fs.writeFileSync(scriptPath, lines.join('\r\n'));

  try {
    execSync(
      `powershell -Command "Start-Process powershell -ArgumentList '-ExecutionPolicy','Bypass','-File','${scriptPath}' -Verb RunAs -Wait"`
    );
  } finally {
    fs.unlinkSync(scriptPath);
  }
}

function sudoCopy(pairs) {
  if (process.platform === 'darwin') {
    sudoCopyMac(pairs);
  } else if (process.platform === 'win32') {
    sudoCopyWindows(pairs);
  } else {
    throw new Error(`Unsupported platform: ${process.platform}`);
  }
}
```

---

## 八、IPC 通道定义（preload 桥接）

```
旧通道（砍掉标记 ❌）              新通道
─────────────────────────────     ──────────────────────────────
desktop-patcher:get-bootstrap     → i18n:get-status
desktop-patcher:choose-app        → i18n:browse-app
desktop-patcher:inspect-app  ❌   （合并进 get-status）
desktop-patcher:run-patch    ❌   → i18n:apply-language
                                  → i18n:extract-english（新增）
                                  → i18n:restart-cavalry（新增）
```

### 新 IPC 定义：

| 通道 | 输入 | 输出 |
|------|------|------|
| `i18n:get-status` | — | `{ appPath, version, currentLang, languages[], needsExtract }` |
| `i18n:browse-app` | — | `{ canceled, appPath, version }` |
| `i18n:extract-english` | `{ appPath }` | `{ ok, count, error? }` |
| `i18n:apply-language` | `{ appPath, lang }` | `{ ok, error? }` |
| `i18n:restart-cavalry` | `{ appPath }` | `{ ok }` |

---

## 九、目录迁移步骤

```bash
# 0. 删除 LanguageSwitcher.js（不再维护两套入口）
rm LanguageSwitcher.js
rm tools/check_language_switcher_runtime.js

# 1. 移动翻译资源到顶层（不含 en/，en 由运行时提取）
mkdir -p languages
mv LanguageSwitcher_assets/languages/zh-Hans languages/zh-Hans
mv LanguageSwitcher_assets/languages/zh-Hant languages/zh-Hant
mv LanguageSwitcher_assets/languages/ja_JP languages/ja_JP

# 2. 删除空壳和 en/ 快照（运行时从 bundle 提取，不 git track）
rm -rf LanguageSwitcher_assets

# 3. 删除 QM 文件
find languages -name "*.qm" -delete

# 4. 删除注入器
rm -rf desktop-patcher/injector

# 5. 删除无效工具
rm tools/build_translator_injector.sh
rm tools/launch_cavalry_with_injector.sh
rm tools/check_translator_injector.py
rm tools/check_translated_launcher.py
rm tools/check_compiled_menu_contexts.py
rm tools/zh-Hans.ts tools/zh-Hant.ts tools/ja_JP.ts
rm tools/patch_cavalry_bundle.py
rm tools/check_patch_cavalry_bundle.py
rm tools/extract_strings.py
rm tools/trans_batch_*.py
rm tools/translate_nodeStrings.py
rm tools/apply_translations.py
rm tools/strings_*.json tools/all_strings.json tools/dict_*.json
rm -rf tools/__pycache__
rm docs/compiled-menu-contexts.json
rm docs/cavalry-menu-localization-feasibility.md

# 6. 更新 package.json（移除 Python 依赖的 script）
```

---

## 十、实施优先级

| 阶段 | 任务 | 说明 |
|------|------|------|
| **P0** | 删除无效文件 | 按第九节清单执行，先清理再建设 |
| **P0** | 定义 state.json schema + 位置 | 按第三节实现，UI 和 patch 都依赖它 |
| **P0** | `lib/detect.js` + `patch.js` + `sudo.js` | Node.js 重写，三文件职责隔离 |
| **P0** | 新 IPC 通道 + main.js 改造 | 接入三个 lib 模块，砍掉 Python 调用 |
| **P0** | 新 UI（index.html + styles.css + app.js）| 一屏简洁界面 |
| **P1** | 版本检测 + 自动提取 | Cavalry 更新后自动提示重新应用 |
| **P2** | README 重写 | 只保留 Electron 使用说明 |
| **P2** | CI 更新 | .github/workflows 适配新结构 |
| **P2** | Windows 适配 | 改 `sudo.js` 一个文件即可 |

---

## 十一、已知风险与文档告知

### macOS 代码签名

修改 `.app` 内部文件会使 macOS 代码签名失效。JSON assets 目前不在 code seal 覆盖范围内，所以能用。但如果 Cavalry 未来启用更严格的 Hardened Runtime 校验或 macOS Gatekeeper 策略变更，这条路径可能失效。

**措施**：
1. README 和 UI 状态区明确告知此风险
2. `apply-language` 流程完成后执行 `codesign --verify`，如果签名损坏则弹出警告（不阻塞，让用户知情）
