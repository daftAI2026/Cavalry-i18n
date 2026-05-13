# Cavalry 多语言切换器 — 完整方案（v3）

---

## 一、项目目标

为 Cavalry（Qt 6.6.3，Canva 旗下免费 2D 动画软件）实现第三方多语言切换，纯 Cavalry 原生脚本，用户零依赖、下载即用。

---

## 二、技术验证结果

| 验证项 | 结果 |
|--------|------|
| `api.writeToFile()` 写入 app bundle | ✅ **已确认可行** |
| `api.readFromFile()` 读取 app bundle | ✅ 可行（API 文档明确支持） |
| `api.copyFilePath()` 复制文件 | ✅ 可行（API 文档明确支持） |
| `api.getAppAssetsPath()` 获取 assets 路径 | ✅ 可行 |
| `api.runDetachedProcess()` 重启 | ✅ 可行 |
| `api.getCavalryVersion()` 获取版本号 | ✅ 可行（API 文档明确支持） |
| Cavalry app bundle 内无 `translations/` 目录 | ✅ **已确认**（.qm 写入不会误伤官方文件） |
| JSON 替换后生效 | 🔶 开发阶段验证 |
| Qt .qm 翻译加载 | 🔶 开发阶段验证 |

---

## 三、初版支持语言

| 语言 | 代码 | 说明 |
|------|------|------|
| English | `en` | 从 Cavalry 原文件提取，作为语言包之一 |
| 简体中文 | `zh-Hans` | 翻译 |
| 繁體中文 | `zh-Hant` | 翻译 |
| 日本語 | `ja_JP` | 翻译 |

---

## 四、翻译覆盖范围

| 层级 | 内容 | 方式 | 覆盖率 |
|:---:|------|------|:---:|
| **第一层** | 节点名（Basic Shape、Duplicator…） | JSON 替换 | ✅ 高 |
| **第一层** | 属性名（Position、Rotation、Scale…） | JSON 替换 | ✅ 高 |
| **第一层** | 属性描述 / Tooltip | JSON 替换 | ✅ 高 |
| **第一层** | 插件名称和描述 | JSON 替换 | ✅ 高 |
| **第一层** | 引导提示 / Tips / Onboarding | JSON 替换 | ✅ 高 |
| **第二层** | 菜单栏（File / Edit / View…） | Qt .qm 注入 | ✅ 高* |
| **第二层** | 右键菜单 / 对话框文本 | Qt .qm 注入 | ✅ 高* |
| **第二层** | 标准按钮（OK / Cancel / Yes / No…） | Qt 官方 qtbase.qm | ✅ 高* |

*\*第二层在开发阶段验证 .qm 加载机制，若不生效则寻找替代方案*

---

## 五、项目结构

```
cavalry-i18n/
├── README.md
├── LICENSE
│
├── LanguageSwitcher.js                ← 用户安装的唯一脚本
│
├── languages/
│   ├── en/                            ← 英文（从 Cavalry 提取）
│   │   ├── nodeStrings.json
│   │   ├── appStrings.json
│   │   ├── tips.json
│   │   ├── onboarding.json
│   │   └── plugins/
│   │       ├── gaussianBlurFilter.json
│   │       └── ...（13 个）
│   │
│   ├── zh-Hans/                         ← 简体中文
│   │   ├── nodeStrings.json
│   │   ├── appStrings.json
│   │   ├── tips.json
│   │   ├── onboarding.json
│   │   ├── plugins/
│   │   ├── cavalry_zh-Hans.qm
│   │   └── qtbase_zh-Hans.qm
│   │
│   ├── zh-Hant/                         ← 繁體中文
│   │   ├── ...（同上结构）
│   │
│   └── ja_JP/                         ← 日本語
│       ├── ...（同上结构）
│
├── tools/                             ← 开发者工具（用户不需要）
│   ├── extract_strings.py             ← 从 Cavalry 提取英文原文
│   ├── build_qm.py                    ← 编译 .ts → .qm
│   ├── zh-Hans.ts                       ← Qt 翻译源文件
│   ├── zh-Hant.ts
│   └── ja_JP.ts
│
└── .github/
    └── workflows/
        └── build.yml                  ← CI 自动编译 .qm
```

---

## 六、用户使用流程

```
1. 下载项目（GitHub Release 或 clone）
2. 将 LanguageSwitcher.js + languages/ 复制到 Cavalry Scripts 目录
   （Cavalry 菜单 → Show Scripts Folder）
3. Cavalry 中打开 Window → Scripts → LanguageSwitcher
4. 选择语言 → 点击 Apply
5. 自动保存 → 自动重启 → 完成
```

全程在 Cavalry 内完成，不需要终端、不需要权限、不需要任何外部工具。

---

## 七、切换逻辑

```
┌───────────────────────────────────┐
│  🌐 Cavalry Language Switcher     │
│                                   │
│  当前语言 / Current: English       │
│  Language: [ 简体中文 ▼ ]          │
│                                   │
│             [ Apply & Restart ]   │
└───────────────────────────────────┘
```

**核心原则：所有语言（包括英文）都是语言包，切换任何语言都是同一个操作。**

```
用户点击 Apply & Restart
        │
        ▼
  读取选择的语言（如 zh-Hans）
        │
        ├──→ 第一层：JSON 覆写（通过 api.writeToFile）
        │     ├─ nodeStrings.json   → app/assets/Definitions/
        │     ├─ appStrings.json    → app/assets/Definitions/
        │     ├─ plugins/*.json     → app/assets/Plugins/*/
        │     ├─ tips.json          → app/assets/Learn/
        │     └─ onboarding.json    → app/assets/Learn/
        │
        ├──→ 第二层：Qt .qm 写入
        │     ├─ 如果 en → 删除 translations/ 下所有 .qm
        │     └─ 否则 → 写入 cavalry_xx.qm + qtbase_xx.qm → app/translations/
        │
        ├──→ 保存当前语言配置
        │     └─ cavalry-i18n.json → api.getAppDataFolder()
        │         ├─ language: "zh-Hans"
        │         └─ cavalryVersion: api.getCavalryVersion()
        │
        └──→ 自动重启
              ├─ 保存未保存的场景
              ├─ 弹窗确认「语言已切换，立即重启？」
              ├─ 启动新实例（api.runDetachedProcess）
              └─ 退出当前实例
```

---

## 八、Cavalry 更新后自动检测

Cavalry 更新会整个替换 app bundle，我们写入的翻译文件会被覆盖还原为英文。但语言包和脚本存放在用户的 Scripts 目录，不受影响。

**检测时机**：用户打开 LanguageSwitcher 脚本时自动执行。

```
脚本启动
    │
    ▼
读取 cavalry-i18n.json（用户数据目录，不受更新影响）
    │
    ├─ 不存在 → 首次使用，正常显示语言选择界面
    │
    └─ 存在 → 对比 cavalryVersion 与 api.getCavalryVersion()
          │
          ├─ 版本一致 → 翻译仍然生效，正常显示
          │
          └─ 版本不一致 → Cavalry 已更新，翻译被重置
                │
                ▼
          弹窗提示：
          「检测到 Cavalry 已从 {旧版本} 更新至 {新版本}，
            您之前选择的语言（简体中文）已被重置。
            点击「重新应用」将简体中文语言包重新写入 Cavalry。」
                │
                ▼
          [ 重新应用 ]  [ 稍后 ]
                │
                ▼
          ① 先备份：将 Cavalry 新版本的英文原文件覆盖到 languages/en/
            （确保 en 语言包始终与当前 Cavalry 版本同步，
              切回英文时恢复的是当前版本的原文，而非旧版快照）
                │
                ▼
          ② 再覆写：执行与 Apply 完全相同的翻译覆写流程
                │
                ▼
          ③ 更新 cavalry-i18n.json 中的 cavalryVersion
```

**设计要点**：
- 不需要 hook、后台进程或文件 diff——纯版本号比对，成本为零
- 语言包始终在 Scripts 目录，Cavalry 更新不影响
- 重新应用 = 重新覆写同一套语言包文件，操作幂等

---

## 九、写入失败处理

`api.writeToFile()` 在大多数用户环境下可正常写入 app bundle，但企业管控或特殊安装方式下可能失败。

```
写入文件
    │
    ├─ 成功 → 继续下一个文件
    │
    └─ 失败（返回 false）
          │
          ▼
    停止写入，弹窗提示：
    「写入失败：{文件路径}
      可能原因：Cavalry 安装目录没有写入权限。
      请尝试以管理员身份运行，或将 Cavalry 安装到用户目录。」
```

---

## 十、自动重启实现

```javascript
if (api.getPlatform() === "macOS") {
    api.runDetachedProcess("open", ["-n", "/Applications/Cavalry.app"]);
    api.runProcess("osascript", ["-e", 'tell application "Cavalry" to quit']);
} else {
    // Windows
    api.runDetachedProcess("cmd.exe", ["/c", "start", "", "Cavalry.exe"]);
    api.runProcess("cmd.exe", ["/c", "taskkill", "/im", "Cavalry.exe"]);
}
```

---

## 十一、平台兼容

| | macOS | Windows |
|---|---|---|
| JSON 路径 | `api.getAppAssetsPath()` | 同左 |
| .qm 路径 | `getAppAssetsPath()/../MacOS/translations/` | `getAppAssetsPath()/../translations/` |
| 重启 | `open -n` + `osascript quit` | `start` + `taskkill` |
| 判断 | `api.getPlatform() === "macOS"` | `=== "Windows"` |

---

## 十二、开发步骤

| 阶段 | 任务 | 产出 |
|:---:|------|------|
| **1** | 提取所有英文字符串，建立 `en/` 语言包 | `languages/en/*` |
| **2** | 翻译全部语言的 JSON + .ts 源文件（简中 → 繁中 → 日语，大模型批量完成） | `languages/zh-Hans/*`、`languages/zh-Hant/*`、`languages/ja_JP/*`、`tools/*.ts` |
| **3** | 编译 .ts → .qm | `.qm` 文件（CI 或本地 `lrelease`） |
| **4** | 编写 `LanguageSwitcher.js`（UI + 读写 + 版本检测 + 重启） | 可运行的切换脚本 |
| **5** | 验证 JSON 替换后重启生效 | ✅ 或调整方案 |
| **6** | 验证 Qt .qm 加载（放入 .qm → 重启 → 看菜单是否变中文） | ✅ → 发布完整版；❌ → 发布 JSON-only 版本 |
| **7** | 全流程测试（切中文 → 切日语 → 切回英文 → 模拟更新后重新应用） | 验证通过 |
| **8** | 搭建 GitHub CI | `.github/workflows/build.yml` |
| **9** | 编写 README + 发布 Release | 开源发布 |

---

## 十三、风险与应对

| 风险 | 应对 |
|------|------|
| Qt .qm 不自动加载 | v1 先发布 JSON-only 版本（覆盖节点/属性/插件/提示，约 70-80%），菜单翻译作为 v2 目标。开发阶段 5 验证，不通过则降级，已有完整降级路径 |
| Cavalry 更新覆盖翻译 | Cavalry 更新会替换整个 app bundle，翻译文件被还原为英文。脚本打开时通过 `api.getCavalryVersion()` 对比配置文件中记录的版本号，版本不一致则提示用户重新应用当前语言包（见第八节） |
| Cavalry 版本间 JSON 结构变化 | `extract_strings.py` 适配新版本，重新提取英文包并更新翻译。语言包按 Cavalry 大版本维护 |
| 写入 app bundle 失败 | 企业管控或特殊安装方式下可能无权写入。写入失败时立即停止并弹窗提示具体原因和解决方案（见第九节） |
| .qm 清理误伤官方文件 | 已验证 Cavalry app bundle 内不存在 `translations/` 目录和 `.qm` 文件，该目录完全由本工具创建，清理无风险 |
| Windows 路径差异 | `api.getPlatform()` 判断 + `api.toNativeFilePath()` 转换 |
