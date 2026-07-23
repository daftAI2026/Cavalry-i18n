# windows/
> L2 | 父级: ../CLAUDE.md

成员清单

CMakeLists.txt: Qt 6.6.3 x64 MSVC + Windows Psapi generic plugin 构建边界，严格拒绝错误平台、编译器、位数和 ABI，并编译 translator、PE/IAT、ExtensionLayer hook 与 plugin smoke 合同测试；发布产物只含 `generic/cavalryi18n.dll`。
build.ps1: Windows 唯一可重复构建入口，解析显式或仓库默认 Qt SDK，串联 configure/build/ctest 并把已验证 DLL 发布到稳定资源路径。
cavalry_i18n_plugin.h: `QGenericPlugin` metadata 与工厂接口，只暴露大小写不敏感的 `cavalryi18n` key。
cavalry_i18n_plugin.cpp: Qt generic factory 路由，把受支持 key 映射到独立的运行时生命周期对象。
cavalry_i18n_display.h: 主动显示翻译接口与对象生命周期状态，明确 QWidget/QAction 白名单和 source fallback 依赖方向。
cavalry_i18n_display.cpp: 幂等翻译菜单、动作、标题和受控文本属性，通过 `aboutToShow`/`changed` 接住首帧与动态英文写回，并禁止改动输入值或 item model。
cavalry_i18n_extension_layer_hook.h: ExtensionLayer 绘制 hook 的极窄接口，声明四条 exact source 查询、模块延迟安装与可诊断状态，不暴露广泛文本替换能力。
cavalry_i18n_extension_layer_hook.cpp: 只替换 `ExtensionLayer.dll → Qt6Gui.dll → QPainter::drawText(PointF, QString)` 的唯一 IAT 槽；四条精确自绘提示按共享 translator 映射，未知调用原绘制回退，并以 CJK fallback 与宽度补偿保持中心/基线。
cavalry_i18n_pe_iat.h: PE 导入表解析与精确 IAT slot 发现接口，隔离 Windows 二进制边界检查。
cavalry_i18n_pe_iat.cpp: 解析 PE import directory 并仅定位白名单 DLL/符号的 IAT 项，拒绝越界或格式异常映像。
cavalry_i18n_pe_iat_test.cpp: PE/IAT 解析合同测试，覆盖有效映像、白名单命中与拒绝损坏/非目标输入。
cavalry_i18n_extension_layer_hook_test.cpp: 无厂商模块的 Qt 合同测试，锁定四条 exact source 的三语结果、大小写拒绝与缺少 ExtensionLayer 时的无副作用延迟回退。
cavalry_i18n_runtime.h: 翻译加载、主动显示刷新、目标模块延迟 IAT 安装、事件观察和诊断 marker 的运行时边界声明。
cavalry_i18n_runtime.cpp: 读取显式语言环境并安装嵌入式 `QTranslator`，把 Show/ActionAdded/局部 Paint 事件路由到显示翻译器，并在目标模块出现的首帧前尝试精确 hook，同时原子记录条目与 hook 状态。
cavalry_i18n_translator.h: 嵌入式 translator 查询接口与统计边界，隔离生成表表示和运行时生命周期。
cavalry_i18n_translator.cpp: 复用共享 `generated_translations.inc`，构建精确 `(context, source)` 首条优先哈希与遵循现有显示层语义的末条覆盖 source fallback。
cavalry_i18n_translator_test.cpp: 三语言非空表、四条 ExtensionLayer 精确自绘提示、精确查询、source fallback、未知语言和未知文本合同测试。
cavalry_i18n_plugin_smoke_test.cpp: 由最小 `QApplication` 走真实 generic plugin 自动发现，验证十二个顶层菜单、四条 ExtensionLayer 精确自绘提示的 source fallback、动态动作、显示白名单、数据隔离与当前进程 marker。
cavalryi18n.json: Qt plugin metadata，声明唯一自动加载 key `cavalryi18n`。
README.md: Windows 插件依赖、构建目录、子进程环境契约、禁止携带 Qt runtime 与 live gate 边界。
generic/: 由 build.ps1 生成的 Tauri resource 稳定目录，只允许 `cavalryi18n.dll`，禁止复制 Qt runtime。

依赖边界:

本模块只依赖 Qt 6.6.3 Core/Gui/Widgets 公共 ABI、Windows Psapi 与本地 PE/IAT 解析，并从父级共享生成表取得翻译真相；启动器负责把插件根、语言和可选 marker 作为子进程环境传入。模块不读取 Cavalry 安装注册表、不修改厂商 DLL、不执行远程注入、不创建全局环境变量，也不携带第二套 Qt runtime。

运行数据流:

`generated_translations.inc` → `CavalryEmbeddedTranslator` 精确/兜底哈希；`QT_QPA_GENERIC_PLUGINS=cavalryi18n` → Qt generic factory → `CavalryI18nRuntime` → 校验 `CAVALRY_I18N_LANG` → 安装嵌入 translator → `CavalryDisplayTranslator` 主动翻译既有树与 Show/ActionAdded/aboutToShow/局部 Paint 增量；同一 Show/Paint 首帧若 `ExtensionLayer.dll` 已加载，则用 PE 事实验证唯一 Qt6Gui drawText IAT 槽并安装四条 exact-source hook → 可选原子 marker。

法则: Qt 6.6.3 ABI 锁定·x64 MSVC·共享生成表真相·精确键首条优先·source fallback 末条覆盖·显示属性白名单·输入值/item model 不变·Paint 禁止树遍历·ExtensionLayer 仅允许四条精确 source + 单一 IAT 槽且失败回退原绘制·进程级环境·无 vendor 修改·无远程线程·无第二套 Qt runtime·marker 仅在显式绝对路径启用

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
