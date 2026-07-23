<!--
[INPUT]: 依赖 Qt 6.6.3 x64 MSVC SDK、CMake、generated_translations.inc 与启动器提供的进程级环境
[OUTPUT]: 对外提供 Windows generic plugin 的构建、目录布局、启动契约和诊断判定说明
[POS]: injector/windows 的操作边界文档，把源码 POC 约束为可重复且不污染系统/厂商安装的验证流程
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
-->

# Windows Qt generic plugin POC

该 POC 使用 Qt 官方 `QGenericPlugin` 扩展点。它只生成
`generic/cavalryi18n.dll`，运行时链接 Cavalry 已加载的 Qt 6.6.3，不复制
Qt DLL、不修改 Cavalry 文件，也不做远程进程注入。

插件安装嵌入式 `QTranslator` 后，会主动翻译 Cavalry 已存在和动态创建的
菜单/动作，以及窗口标题、标签、按钮、分组框、输入框 placeholder、标签页、
tooltip 和 statusTip。刷新严格停留在显示层：不修改 `QLineEdit::text()`、
item model、Time Editor 模型值或其他厂商业务数据。

## 依赖

- Visual Studio 2022 Build Tools，启用 x64 MSVC C++ 工具链
- CMake 3.21+
- Qt 6.6.3 `win64_msvc2019_64` SDK

缺少 Qt SDK 时可安装到仓库忽略目录：

```powershell
python -m pip install --user aqtinstall
python -m aqt install-qt windows desktop 6.6.3 win64_msvc2019_64 --outputdir qt_sdk
```

## 构建

推荐从仓库根目录运行唯一入口：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File injector/windows/build.ps1
```

脚本优先读取 `CAVALRY_QT_PREFIX`，未设置时使用
`qt_sdk/6.6.3/msvc2019_64`；它会依次 configure、Release build、运行两个
CTest，并把已验证 DLL 发布到：

```text
injector/windows/
└── generic/
    └── cavalryi18n.dll
```

需要单独调试 CMake 时可运行：

```powershell
cmake -S injector/windows -B build/windows-injector `
  -G "Visual Studio 17 2022" -A x64 `
  -DCMAKE_PREFIX_PATH="$PWD/qt_sdk/6.6.3/msvc2019_64"
cmake --build build/windows-injector --config Release
```

中间产物为：

```text
build/windows-injector/
└── generic/
    └── cavalryi18n.dll
```

构建系统不会调用 `windeployqt`。发布时也只能携带本插件，禁止捆绑第二套
`Qt6Core.dll`、`Qt6Gui.dll` 或 `Qt6Widgets.dll`。

## 运行契约

启动器只给 Cavalry 子进程设置以下环境，不修改用户或系统环境：

| 变量 | 契约 |
| --- | --- |
| `QT_PLUGIN_PATH` | 包含 `generic/` 子目录的插件根目录 |
| `QT_QPA_GENERIC_PLUGINS` | 固定为 `cavalryi18n` |
| `CAVALRY_I18N_LANG` | `en`、`zh-Hans`、`zh-Hant`、`ja_JP` 之一 |
| `CAVALRY_I18N_DIAGNOSTIC_MARKER` | 可选；父目录已存在的绝对 JSON 文件路径 |

三种非英语翻译直接编译自仓库共享的
`injector/generated_translations.inc`，运行时不读取 `.qm`，也没有外部语言目录猜测。

示意验证只使用占位路径：

```powershell
$env:QT_PLUGIN_PATH = "C:\Path\To\PluginRoot"
$env:QT_QPA_GENERIC_PLUGINS = "cavalryi18n"
$env:CAVALRY_I18N_LANG = "zh-Hans"
$env:CAVALRY_I18N_DIAGNOSTIC_MARKER = "C:\Path\To\State\runtime.json"
& "C:\Path\To\Cavalry.exe"
```

marker 的 `status` 为 `ready` 且 `translatorInstalled` 为 `true`，只能证明
插件已被目标 Qt 加载并安装嵌入表；`embeddedEntryCount`、`exactKeyCount` 与
`sourceFallbackCount` 必须大于零。构建 smoke 会额外验证十二个顶层菜单、
既有/动态动作、受控显示属性和输入/model 隔离；真实 Cavalry 的完整覆盖仍需
live UI gate 与截图验证。
