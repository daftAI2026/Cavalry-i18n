# 06 — Write LanguageSwitcher.js（T4）

## Must Read

- `REPO/docs/plan-v3.md`（第七节切换逻辑、第八节更新检测、第九节写入失败、第十节自动重启、第十一节平台兼容）

## Must Follow

- `tests/tdd-master-contract.md`
- `tests/switcher-contract.md`

## Allowed Files

- `REPO/LanguageSwitcher.js`

## 前置 Gate

T1（02-extract-english-strings）PASS

## Task

编写 `LanguageSwitcher.js`，Cavalry 原生脚本，用户安装的唯一文件。

### 功能清单

1. **UI** — 下拉菜单选择语言 + Apply & Restart 按钮，显示当前语言
2. **第一层覆写** — 通过 `api.writeToFile()` 将选中语言的 JSON 写入 Cavalry app bundle
   - `nodeStrings.json` → `app/assets/Definitions/`
   - `appStrings.json` → `app/assets/Definitions/`
   - `plugins/*.json` → `app/assets/Plugins/*/`
   - `tips.json` → `app/assets/Learn/`
   - `onboarding.json` → `app/assets/Learn/`
3. **第二层覆写** — 写入 `.qm` 文件到 `app/translations/`；切回英文时删除 `.qm`
4. **配置读写** — `cavalry-i18n.json` 存储在 `api.getAppDataFolder()`，记录 language + cavalryVersion
5. **版本检测** — 脚本启动时对比 `cavalryVersion` 与 `api.getCavalryVersion()`，版本不一致则提示重新应用
6. **自动重启** — macOS: `open -n` + `osascript quit`；Windows: `start` + `taskkill`
7. **错误处理** — `writeToFile` 返回 false 时停止并弹窗提示
8. **覆写完整性** — 覆写文件列表必须与 `languages/en/` 文件列表一致

## TDD Behaviors

| # | RED | GREEN |
|---|-----|-------|
| 1 | `LanguageSwitcher.js` 不存在 | 创建脚本骨架 |
| 2 | 缺 UI（下拉 + 按钮） | 实现语言选择下拉和 Apply & Restart 按钮 |
| 3 | 缺 JSON 覆写 | 实现第一层 JSON 文件写入 |
| 4 | 缺 `.qm` 写入 | 实现第二层 .qm 文件写入 |
| 5 | 缺配置读写 | 实现 `cavalry-i18n.json` 读取和写入 |
| 6 | 缺版本检测 | 实现 cavalryVersion 对比和更新提示 |
| 7 | 缺自动重启 | 实现 macOS + Windows 重启逻辑 |
| 8 | 缺错误处理 | 实现 `writeToFile` 失败时停止并弹窗 |
| 9 | 覆写列表不完整 | 确保覆写文件列表与 `languages/en/` 一致 |

## Gate Check

按 `tests/switcher-contract.md` 中的验证命令全部通过。

## Run Log

写到 `runs/YYYY-MM-DD-T4-write-language-switcher.md`
