<!--
[INPUT]: 依赖 Qt 6.6.3 x64 MSVC SDK及版本化 QPA 头、CMake、generated_translations.inc、可选只读 vendor 二进制与安装根激活 manifest
[OUTPUT]: 对外提供 Windows QPA 代理 + generic runtime 的构建、目录/激活布局、受控翻译、静态 ABI 合同与诊断判定说明
[POS]: injector/windows 的操作边界文档，把原生入口委托、翻译 fail-open 与既有精确 UI hook 收束为可重复发布合同
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
-->

# Windows Qt QPA proxy + generic translation runtime

## 原生入口 QPA 代理

Windows 发布包含两个职责分离的 DLL：

- `qpa/qwindows.dll` 是 Qt `windows` 平台插件代理，只负责委托原厂 QPA 和启动翻译；
- `generic/cavalryi18n.dll` 是唯一翻译 runtime，承载 translator、显示投影与四条精确
  ExtensionLayer IAT 边界。

部署层把 Cavalry 2.7.2 原厂 `qwindows.dll` 持久化为
`cavalry-i18n-qpa/vendor-qwindows.dll`，再以代理占据安装根原入口。代理先通过绝对路径
加载原厂 DLL；原厂代码执行前必须同时通过运行时 Qt 6.6.3 与固定 vendor SHA-256
门禁。代理对两种 `QPlatformIntegrationPlugin::create` 重载完整委托且设置
`PreventUnloadHint`。只有原厂 integration 非空后才考虑翻译；此时才读取 manifest
并核对 `Cavalry.exe`。因此厂商 EXE 漂移只会禁用翻译，不会阻断已经验证的原厂窗口
系统。翻译文件、manifest、marker、generic 插件或 runtime 任一失败，原厂 integration
仍原样返回。

翻译激活只接受安装根 `cavalry-i18n-qpa/manifest.json` 的 exact schema v1：

```json
{
  "schemaVersion": 1,
  "phase": "active",
  "cavalryVersion": "2.7.2",
  "cavalryExecutableSha256": "<lowercase-sha256>",
  "qtVersion": "6.6.3",
  "architecture": "x86_64",
  "vendorQwindowsSha256": "<verified-lowercase-sha256>",
  "proxyQwindowsSha256": "<lowercase-sha256>",
  "genericPluginSha256": "<lowercase-sha256>"
}
```

未知/缺失字段、非固定版本架构、非已验证原厂 hash、Cavalry.exe/vendor/proxy/generic
四项磁盘实际 SHA-256 漂移全部只禁用翻译。`phase=prepared|restoring` 始终只走原厂
QPA；`phase=active` 后仍须严格读取根 `cavalry-i18n-lang.txt`，只有 `zh-Hans`、
`zh-Hant`、`ja_JP` 才显式调用
`QGenericPlugin::create("cavalryi18n", language)`。正式代理不调用 `qputenv`；
English 只返回原厂界面。可选绝对 `CAVALRY_I18N_DIAGNOSTIC_MARKER` 仍用于 Switcher
验收，代理 bootstrap 错误会写与 generic marker 可反序列化的 `status=error` 结构；
原生图标启动不要求也不制造 AppData/安装根诊断文件。

## CJK text-path 运行时发布门

text-path IAT 只有在已加载 `Core.dll`/`skia.dll` 同时通过 Cavalry 2.7.2 的 mapped-PE
x64、timestamp、`SizeOfImage`、全部私有导出精确 RVA，以及 `MakeScalableFont`
move/null、`SkTypeface::MakeFromName`、`SkPath` copy-constructor 关键字节后才会安装。
验证过程先取得普通模块引用；双模块全部通过后才以
`GetModuleHandleExW(FROM_ADDRESS|PIN)` 把 Core、skia 与插件固定到进程结束，再释放
普通引用。renderer 不再自行调用 `GetModuleHandle`/`GetProcAddress`，创建失败是终态拒装，
不会安装一个只能持续回退的 text-path hook。

卸载先禁用译文并把 process-lifetime 原子槽替换为仅保留原函数、无 renderer/SkTypeface
的 forward-only 墓碑，然后恢复 IAT；因此迟到 callback 仍安全转发，外部对象会在普通线程
释放，进程终止时不依赖全局 `shared_ptr` 静态析构。显式绝对 diagnostic marker 存在时，
Qt 线程每 75ms 检查一次 revision，只有计数变化才落盘；无 marker 时不创建该计时器。

generic runtime 使用 Qt 官方 `QGenericPlugin` 扩展点；QPA 代理显式锁定 Qt 6.6.3
版本化私有平台插件 ABI。两个 DLL 都链接 Cavalry 已加载的同版 Qt，不复制 Qt DLL，
不做远程进程注入。安装根原子替换、持久化原厂备份与恢复由 Tauri 部署层负责，本目录
runtime 不执行写安装根操作。

插件安装嵌入式 `QTranslator` 后，会主动翻译 Cavalry 已存在和动态创建的
菜单/动作，以及窗口标题、标签、按钮、分组框、输入框 placeholder、标签页、
tooltip 和 statusTip。刷新严格停留在显示层：`QLineEdit::text()` 仅在共享词表
命中时以信号阻断方式投影译文，未知/用户输入保持原样；`QTreeWidget` 仅写递归
可见 `DisplayRole`。`UserRole`、Time Editor 模型身份和其他厂商业务数据均不修改。

对 ExtensionLayer 的自绘/空状态文本，插件只在该模块已加载后安装四条已采证、可逆的
IAT 边界：

- `CavalryUI.dll!ui::textAtWidgetCentre(QWidget*, const QString&, const QColor&, const QPixmap*)`
  的唯一正常导入槽，仅处理九条已采证的静态 helper source；
- `CustomListWidget::setPlaceholder(QString const&)` 的导出 thunk → canonical setter →
  `QString::operator=(QString const&)` 尾跳槽。这条槽不在标准 import descriptor 的
  枚举范围内，运行时必须从已验证 setter 的 RIP-relative 尾跳解码，且只接受直接
  `E8` 调用该导出 thunk 的返回地址；若槽仍为 canonical import-by-name RVA，则先等待
  loader 解析为 Qt6Core 导出，绝不抢写；
- `Qt6Widgets.dll!QTextEdit::append(QString const&)` 的唯一导入槽，只批准 MessageBar
  history/live 两个固定 return；仅替换最后一个 `<br>` 后精确等于 Pencil 警告的正文，
  HTML 与首尾空白不变，命名 `js_logger`、无 `<br>` 与未知日志全部透传；
- `Core.dll!cavalry::MakePathFromText(std::string const&, double) -> Path` 的唯一导入槽
  （MSVC x64 调用时包含隐藏的 Path 返回存储参数）。
  静态文本必须在每次 callback 命中 `GraphicsViewportBase::getOrCreateTextPath` 内已采证的 canonical
  return RVA、完整 preamble/call 字节包络与二十六条 exact UTF-8 source；CogTool 动态文本必须命中
  `PrimitiveToolBase` 首行/后续行两处已采证 return，且严格等于
  `Pitch Radius: ` 加 MSVC `int` 产生的 canonical 32-bit 十进制文本，并以精确 `CogTool`
  context 查询翻译，才会进入受控 CJK Path 分支；该词条不进入普通 source fallback。

四条边界都必须同时命中 `cavalry_i18n_extension_layer_sources.h` 的精确 source 合同和
三语嵌入表才会换成译文；未知 source、以及表内但不在白名单的 source 都原样透传。helper
只允许九条 source；placeholder 只允许十三条已采证 source（其中包括
`Drag some JavaScript here to make a Snippet.`）；MessageBar 只允许一条 Pencil 正文。
text-path 只允许四条 viewport quality、六条 EditShapeTool action、五条
TransformTool action、七条 Pencil/Pen/Centre action、四条已有三语译文的
TransformTool 长操作前缀与一条 CogTool 动态 Pitch；动态数值后缀逐字保留，
`Shift`、`Control` 与单字母等纯快捷键 prefix 保持英文。

text-path 命中后不会改写厂商代码或安装全局 Skia hook。`CavalrySkiaTextPathRenderer` 只调用
经只读 vendor 合同锁定的 Core/skia 导出，以已验证全量 glyph 覆盖的语言定向系统字体重建
该单个白名单 CJK `Path`，并复现 Core 的 UTF-8、`GetPath` 与 Y 轴翻转几何步骤。字体、字形、
ABI 或空轮廓任一检查失败时，callback 直接交回原 `MakePathFromText` 生成英文，绝不输出 tofu
或猜测布局。任一 ABI、模块名、导出、槽目标或三处批准 caller 不匹配时同样 fail closed；
不写厂商 `.text`、不拦截 Skia/libc/QPainter，也不修改厂商文件。

helper、placeholder 与 MessageBar 三条 Qt callback 在安装时把原函数、精确译文与 caller 元数据复制进不可变 snapshot，
运行时原子读取，不保存 hook 或 translator 指针，也不在生命周期锁内调用 Cavalry/Qt
原函数。IAT 写入使用 compare-exchange：槽已被第三方改动时不覆盖；终态安装失败会在
同一聚合生命周期内回滚已装槽，waiting 状态才允许保留 partial install。卸载时每个槽
只有恢复成功才独立清理其 global original；失败槽禁用翻译但保留 forward-only snapshot
与完整聚合诊断，避免在途 callback 解引用已销毁 owner。

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
`qt_sdk/6.6.3/msvc2019_64`；它会依次 configure、Release build、运行 CTest，
并把已验证 DLL 发布到：

```text
injector/windows/
├── generic/
│   └── cavalryi18n.dll
└── qpa/
    └── qwindows.dll
```

需要单独调试 CMake 时可运行：

```powershell
cmake -S injector/windows -B build/windows-injector `
  -G "Visual Studio 17 2022" -A x64 `
  -DCMAKE_PREFIX_PATH="$PWD/qt_sdk/6.6.3/msvc2019_64"
cmake --build build/windows-injector --config Release
```

### 可选 vendor ABI/import 合同

`build.ps1` 不猜测盘符或安装目录。需要把某个已选择的 Cavalry 安装纳入只读
静态合同时，显式指定它的安装根：

```powershell
$env:CAVALRY_VENDOR_ROOT = "E:\Apps\Cavalry"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File injector/windows/build.ps1
```

该测试只读映射四个 PE 文件到测试进程内存，验证 `ExtensionLayer.dll` 唯一正常导入的
`ui::textAtWidgetCentre` decorated symbol、预期 IAT RVA 与 `CavalryUI.dll` 对应导出；
还验证 `CustomListWidget::setPlaceholder` 的导出 thunk、canonical setter、尾跳解析出的
QString 赋值槽 RVA、其初始 import-by-name RVA、二十个直接调用与 Snippet 的直接调用点。
它还逐一验证十三条 placeholder source literal；锁定 `QTextEdit::append` 唯一槽、三处调用、
history/live 两个批准 return、`js_logger` 排除项、HTML 模板与 Pencil 原文；并验证 Core MakePath 唯一槽、证明
RCX hidden-sret/RDX string-ref/XMM2 double 参数搬运的十字节 preamble、canonical
return、viewport enum 表、EditShapeTool、TransformTool、Pencil、Pen 与 Centre 的 prefix/action 双 Path 数据流及二十六条静态 source；
并验证 CogTool 两处分支生成 `Pitch Radius: `、写入 optional vector、PrimitiveToolBase
读取该成员，以及首行/后续行两处 MakePath caller 的参数 preamble 与同一 IAT 槽；
并验证 Core 固定 Lato 路径、CJK renderer 所需的 Core/skia 导出、Path 几何步骤与 typeface
引用计数析构约定。测试不会加载、执行、复制或修改厂商 DLL。未设置变量时，常规跨机器构建仍会编译
MessageBar/text-path/Core-Skia 合同代码并运行其余九项测试，只是不执行 machine-specific 映像断言。

中间产物为：

```text
build/windows-injector/
├── generic/
│   └── cavalryi18n.dll
└── qpa/
    └── qwindows.dll
```

构建系统不会调用 `windeployqt`。发布时也只能携带本插件，禁止捆绑第二套
`Qt6Core.dll`、`Qt6Gui.dll` 或 `Qt6Widgets.dll`。

## 运行契约

正式发布的正常路径不依赖启动入口环境：QPA 代理从同一安装根的 active manifest 与
语言 marker 取得语言，并以 strict specification 交给 generic 工厂。因此桌面、开始菜单、
既有任务栏固定项和直接运行 `Cavalry.exe` 汇合到同一加载点，同时原有快捷方式字节、
图标、AppUserModelID 与 Toast 属性保持不动。

generic 工厂只接受 QPA 明确传入的非空语言。即使父进程或用户环境遗留
`QT_PLUGIN_PATH`、`QT_QPA_GENERIC_PLUGINS`、`CAVALRY_I18N_LANG`，Qt 自动发现产生的
空 specification 也会被拒绝，不能越过 active manifest。Switcher 启动 Cavalry 时只可
为本轮验收附加以下诊断变量，不修改用户或系统环境：

| 变量 | 契约 |
| --- | --- |
| `CAVALRY_I18N_DIAGNOSTIC_MARKER` | 可选；父目录已存在的绝对 JSON 文件路径 |

三种非英语翻译直接编译自仓库共享的
`injector/generated_translations.inc`，运行时不读取 `.qm`，也没有外部语言目录猜测。

插件的 process-lifetime PIN 是所有 aggregate IAT 安装写入的前置资格：
`ensureInstalled` 必须先固定 `cavalryi18n.dll`，PIN 失败时 helper、placeholder 与 MessageBar
三个 Qt 槽均保持原值。Core text-path 在完成私有 ABI 验证后仍执行自己的插件/Core/skia
PIN，作为独立防线；不能用其中一路的延迟加载假设替代另一路的驻留保证。

显式 generic 入口由构建合同直接验证：

```powershell
npm.cmd run build:injector:windows
ctest --test-dir build\windows-injector -C Release -R cavalryi18n_plugin_explicit_specification --output-on-failure
```

marker 的 `status` 为 `ready` 且 `translatorInstalled` 为 `true`，只能证明
插件已被目标 Qt 加载并安装嵌入表；`embeddedEntryCount`、`exactKeyCount` 与
`sourceFallbackCount` 必须大于零。还必须读取 `extensionLayerHookStatus`：只有
`installed` 才说明 helper、placeholder、MessageBar 与 Core text-path 四条精确 IAT 边界已全部安装，
`extensionLayerTextPathDiagnostics` 还会给出 `revision`、`canonicalCalls`、
`whitelistCalls`、`cjkPathSuccess`、`originalFallback`、`noTranslation`、
`rendererFailure`、`translatedSourceMask` 与 `fallbackSourceMask`。三十二位 mask 按
`cavalry_i18n_extension_layer_sources.h` 固定顺序对应 4 条 viewport quality、6 条
EditShapeTool action、5 条 TransformTool action、7 条 Pencil/Pen/Centre action、
bits 22–25 的四条 TransformTool 长操作前缀与 bit 26 的动态 Pitch；live 截图验收应同时
检查目标类别位确实进入 `translatedSourceMask`，不能只看总计数。
但它仍不能替代真实 Cavalry 的截图与 live UI gate。构建 smoke 会额外验证十二个顶层
菜单、完整 Bézier UTF-8 生成表样本、既有/动态动作、受控显示属性和输入/model 隔离。
