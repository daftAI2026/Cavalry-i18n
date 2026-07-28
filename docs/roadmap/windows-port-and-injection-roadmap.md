<!--
[INPUT]: 依赖跨平台安装模型、Windows runtime/plugin/QPA/privilege 实现、语言包与 Tauri Windows 打包配置
[OUTPUT]: 对外提供 Windows 移植的真实架构、阶段状态、原生启动入口一致性、权限边界与真机验收条件
[POS]: docs/roadmap 的 Active 路线图；连接已落地的通用 plugin/安装契约与尚未完成的 Windows Cavalry 实机证据
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
-->

# Windows Port and Injection Roadmap

> Status: **Active** — 构建、合同与安装器链路已存在；真实 Windows Cavalry 的安装、切换、重启、升级和卸载验收尚未闭环。

## 目标

在不假定固定盘符或固定安装目录的前提下，让 Cavalry 2.7.2 Windows 安装可在 English、简体中文、繁體中文和日本語之间切换。方案必须保留厂商 Qt runtime 与模型数据边界，并使失败可诊断、可恢复。

## 已确立的架构

1. **发现与安装根**：优先从运行中的 `Cavalry.exe`、MSI advertised shortcut 和常见安装位置取得候选；用户也可以直接选择 `Cavalry.exe` 或其安装目录。所有后续路径均归一到选定安装根，不能把安装位置写死为 Program Files。
2. **JSON keyed overlay**：语言包继续按既有 JSON 映射覆盖到该安装根的 `assets/`；macOS DMG 与 Windows 2.7.2 安装中逐字节相同的 `nodeStrings.json` 键 `smoother.smoothingSteps` 保留在四语同构边界中，不能在跨平台补丁时丢失。
3. **Qt runtime 翻译**：非 English 时，把已验证的 `cavalryi18n.dll` 部署到所选根的 `generic/`。它是 Qt 6.6.3 x64 MSVC `QGenericPlugin`，与 macOS injector 共享 `injector/generated_translations.inc`，但不携带、替换或部署第二套 Qt DLL。
4. **原生入口汇合**：非 English Apply 在根 `qwindows.dll` 必经位置部署一个只负责委托原厂 QPA 的小代理，原厂 DLL 持久保存在同根恢复目录。代理在执行原厂代码前校验运行 Qt 6.6.3 与固定 vendor 摘要；原厂 integration 成功后，只有 strict manifest、Cavalry.exe/代理/原厂/generic 四项实际摘要、最终语言 marker、Cavalry 2.7.2 与 x64 全部吻合时才显式加载 generic translator。Cavalry.exe 漂移只关闭翻译，不阻断可信原厂窗口系统。桌面、开始菜单、任务栏固定项、直接 EXE 与 Switcher 启动均不修改入口而自然汇合；不依赖 `QT_PLUGIN_PATH`、`QT_QPA_GENERIC_PLUGINS` 或全局语言环境。
5. **持久与恢复**：普通 Cavalry 退出、Switcher 关闭、升级和卸载都不恢复 QPA，翻译状态长期有效。只有明确选择 English 才生成 hash-locked restore plan；当前 DLL 仍为本工具代理时原子换回已证明的原厂备份。厂商更新若已覆盖代理，则保留新 DLL，不得把旧备份写回。`prepared`、`restoring`、缺失或漂移状态只委托原厂 QPA 并拒绝翻译。
6. **显示层边界**：主动翻译既有和动态菜单、动作、窗口标题、严格 `N selected` QLabel 与受控显示属性；不修改输入值、item model、Time Editor 或其他模型身份数据。ExtensionLayer 只保留四条实证边界：helper、placeholder、MessageBar 与 text-path；其中 MessageBar 仅批准 history/live 两个 `QTextEdit::append` return 和单条 Pencil HTML 尾部正文，明确排除 `js_logger`；text-path 的二十九条静态 source 只走 canonical caller，覆盖 Edit/Transform/Pencil/Pen/Centre 已采证动作、三条 EditShapeTool 与四条 TransformTool 长操作前缀，纯修饰键和单字母快捷键保持英文；动态 `Pitch Radius: <int>` 只走 PrimitiveTool 首行/后续行两个 caller，并保留 canonical 32-bit 数值后缀。其他自绘或日志路径保持英文，禁止宽泛 hook。
7. **重启与诊断**：Apply 先请求目标 `Cavalry.exe` 正常退出，再改写 runtime 文件并从同一安装根启动。非 English 启动只在同 PID、语言、Qt 版本、QPA 状态与嵌入表计数都匹配的原子 marker 就绪后报告成功；超时或插件错误必须显式失败，而不是假装已翻译。
8. **权限**：当前用户可写的自定义安装根直接执行同一 QPA plan。只有目标确实位于 Windows OS-known Program Files 根时，才允许 UAC worker 消费该 plan；任何重解析点逃逸、计划摘要漂移或非 Program Files 目标都拒绝提权。

## 阶段与验收

| 阶段 | 状态 | 可验证结果 | 尚缺内容 |
| --- | --- | --- | --- |
| W1 安装根与 JSON overlay | 已实现 | 目录或 EXE 选择归一化；核心/插件 JSON 走同一复制链；保留 `smoother.smoothingSteps` | 真实非默认安装目录回归 |
| W2 generic plugin | 已实现 | Qt 6.6.3 x64 MSVC 编译与正式 CTest、Tauri resource 与 NSIS 构建；四条 ExtensionLayer 边界均有 ABI 合同，Edit/Transform/Pencil/Pen/Centre 动作与长操作前缀、selected QLabel、动态 Pitch 生产/消费链均有真实 vendor 合同，且无第二套 Qt runtime | 真实 Cavalry 的三语首帧、动态菜单、Edit/Transform/Pencil/Pen/Centre 整行、Pencil 警告、Pitch bit 29 与显示白名单截图 |
| W3 QPA 原生入口 | 进行中 | vendor delegate、strict Cavalry/Qt/四文件 hash、durable backup、同卷原子替换、显式 English 恢复状态机已有单元证据 | 接通 Program Files，并验证五类原生入口不变且同语 |
| W4 重启与权限 | 进行中 | 正常退出、QPA readiness、Program Files-only UAC 防线与同 plan worker | 受保护与可写自定义目录的真机对照 |
| W5 事务与溯源 | 进行中 | pending → JSON/generic → QPA → final marker，禁止提前声明语言生效 | 将 snapshot provenance 与 interrupted/recovery 状态统一接入用户可见恢复流程 |
| W6 发布验收 | 待开始 | Windows x64 NSIS EXE 与两个 macOS DMG 共用 release metadata | 安装、语言切换、五类原生入口、重启、升级、卸载，以及卸载前显式恢复 English 的真实 Cavalry 闭环 |

## 非目标与防腐线

- 不做远程线程注入，不修改厂商 DLL，不扫描整个磁盘，也不设全局 Qt 环境变量。
- 不创建第二个 Cavalry 快捷方式，也不修改 Desktop、Public Desktop、开始菜单、任务栏或厂商 AppUserModel 身份。
- 不把 CI 的 plugin smoke、Rust 合同或 NSIS 构建称为 live UI 通过；它们不能替代真实 Cavalry 运行证据。
- 不为了覆盖率改写模型身份字段，也不以宽泛 IAT hook 掩盖未知 ExtensionLayer 绘制路径。
- 不为自定义路径提权；用户选择的非 Program Files 根应直接可写，否则让用户调整权限或选择其他安装目录。

## 真机验收清单

1. 在 Program Files 安装、当前用户可写的自定义安装和非默认盘符各验证一次发现/手动选址。
2. 依次应用三种非 English 语言和 English，确认 JSON overlay、`smoother.smoothingSteps`、菜单、动态动作与白名单 ExtensionLayer 文本。
3. 验证重启会等待匹配 marker；拒绝错误语言、错误 PID、错误 Qt 版本或不完整嵌入表。
4. 记录桌面/开始菜单链接字节与 AppUserModel 身份；Apply 与重复 Apply 后必须保持不变，并从桌面、开始菜单、已有任务栏固定项、直接 EXE、Switcher 五条路径确认同一语言。
5. 关闭、升级与卸载都不隐式恢复；明确 English 才恢复原厂 QPA；厂商更新覆盖代理后不得回写旧备份。
6. 确认卸载后不残留全局环境变量、第二套 Qt runtime 或 Switcher 安装目录越界文件；Cavalry 根的持久本地化只由显式 English 或厂商重装/升级改变。
