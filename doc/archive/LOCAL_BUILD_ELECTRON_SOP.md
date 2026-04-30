# Cavalry Language Switcher 打包指南 - electron

本文档记录了如何在本地 macOS 环境下，产出与官方版本高度一致、且符合 6.6.3 Qt 运行时的 Electron Release 产物。

## 1. 核心依赖
项目打包依赖 `Qt 6.6.3` SDK。若本地环境版本不符，必须通过 `aqtinstall` 工具空投精准版本：

```bash
# 安装 aqt (建议使用 Python 3.9 环境)
python3 -m pip install aqtinstall

# 空投 6.6.3 核心 SDK
python3 -m aqt install-qt mac desktop 6.6.3 clang_64 --outputdir qt_sdk --archives qtbase
```

## 2. Electron 打包流程
执行以下指令链，可实现自动寻径、编译注入器、并产出 DMG。

```bash
# 1. 声明 SDK 路径 (假设 SDK 位于当前目录的 qt_sdk)
export CAVALRY_QT_PREFIX=$(pwd)/qt_sdk/6.6.3/macos

# 2. 绕过 Apple 证书签名弹窗 (采用 Ad-hoc 签名)
export CSC_IDENTITY_AUTO_DISCOVERY=false

# 3. 清理并构建 (自动完成注入器编译与 DMG 盖章)
rm -rf dist
npm run build
```

## 3. 注意事项
- **图标资源**：项目已统一使用 `desktop-patcher/resources/icon.icns` 作为真值来源。
- **自动盖章**：`npm run build` 结束后会自动运行 `tools/stamp_dmg_icon.sh`，强制将图标资源注入 DMG 的 Resource Fork 中。
- **Qt 版本**：必须锁定 `6.6.3`。使用 `6.11.x` 编译的注入器在低版本宿主环境下可能崩溃。
- **Python 环境**：macOS 系统自带的 `python3` (3.9.x) 通常比 Homebrew 的 3.12 更稳定，且 `aqt` 兼容性更好。
- **清理垃圾**：构建完成后，可安全删除 `qt_sdk` 目录，它不参与运行，仅用于编译阶段的符号链接。
