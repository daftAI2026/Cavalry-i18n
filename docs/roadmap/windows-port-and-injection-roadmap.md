<!--
[INPUT]: 依赖跨平台安装模型、Windows runtime/plugin/QPA/privilege 实现、语言包与 Tauri Windows 打包配置
[OUTPUT]: 对外提供 Windows 移植的真实架构、阶段状态、原生启动入口一致性、控制面卸载双语义、权限边界、真机验收条件与跨平台验证债
[POS]: docs/roadmap 的 Active 路线图；连接已落地的通用 plugin/安装契约与尚未完成的 Windows Cavalry 实机证据
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
-->

# Windows Port and Injection Roadmap

> Status: **Active** — 构建、合同、安装器与 `D:\cavalry` 可写自定义根的实机链路已经成立；Program Files UAC、既有任务栏固定项、跨版本升级、卸载和最终三语 UI 验收尚未闭环。

## 目标

在不假定固定盘符或固定安装目录的前提下，让 Cavalry 2.7.2 Windows 安装可在 English、简体中文、繁體中文和日本語之间切换。方案必须保留厂商 Qt runtime 与模型数据边界，并使失败可诊断、可恢复。

## 已确立的架构

1. **发现与安装根**：优先从运行中的 `Cavalry.exe`、MSI advertised shortcut 和常见安装位置取得候选；用户也可以直接选择 `Cavalry.exe` 或其安装目录。所有后续路径均归一到选定安装根，不能把安装位置写死为 Program Files。
2. **JSON keyed overlay**：语言包继续按既有 JSON 映射覆盖到该安装根的 `assets/`；macOS DMG 与 Windows 2.7.2 安装中逐字节相同的 `nodeStrings.json` 键 `smoother.smoothingSteps` 保留在四语同构边界中，不能在跨平台补丁时丢失。
3. **Qt runtime 翻译**：非 English 时，把已验证的 `cavalryi18n.dll` 部署到所选根的 `generic/`。它是 Qt 6.6.3 x64 MSVC `QGenericPlugin`，与 macOS injector 共享 `injector/generated_translations.inc`，但不携带、替换或部署第二套 Qt DLL。
4. **原生入口汇合**：非 English Apply 在根 `qwindows.dll` 必经位置部署一个只负责委托原厂 QPA 的小代理，原厂 DLL 持久保存在同根恢复目录。代理在执行原厂代码前校验运行 Qt 6.6.3 与固定 vendor 摘要；原厂 integration 成功后，只有 strict manifest、Cavalry.exe/代理/原厂/generic 四项实际摘要、最终语言 marker、Cavalry 2.7.2 与 x64 全部吻合时才显式加载 generic translator。Cavalry.exe 漂移只关闭翻译，不阻断可信原厂窗口系统。桌面、开始菜单、任务栏固定项、直接 EXE 与 Switcher 启动均不修改入口而自然汇合；不依赖 `QT_PLUGIN_PATH`、`QT_QPA_GENERIC_PLUGINS` 或全局语言环境。
5. **持久与恢复**：普通 Cavalry 退出、Switcher 关闭、同版本更新以及 silent/passive/update uninstall 都保留翻译数据面。交互卸载明确询问：可只移除 Switcher 并保留翻译，也可将“恢复 English”作为一次显式用户选择，复用同一 hash-locked language transaction 恢复原厂 QPA 并删除 manifest/hash 证明自有的 generic/recovery；失败即中止卸载，未知 DLL 不删除。厂商更新若已覆盖代理，则保留新 DLL，不得把旧备份写回。`prepared`、`restoring`、缺失或漂移状态只委托原厂 QPA 并拒绝翻译。
6. **显示层边界**：主动翻译既有和动态菜单、动作、窗口标题、严格 `N selected` QLabel 与受控显示属性；不修改输入值、item model、Time Editor 或其他模型身份数据。Search Bar、Tag Header、Color Window、Assets Window、Scene Statistics 与 Tracking 的 8 条普通 Qt 文本在两个平台都禁止 source-only fallback，只允许真实 context 或已采证的 owner/控件结构回补。Windows 的 Scene Statistics 还要求 `ProjectStatisticsWindow` 父系；Tracking 必须是 CavalryUI `gMainWindow` 直属的原生 `QDialog`，设置 `WA_DeleteOnClose`，并仅含一个直属 `Qt::WindowModal` 进度条和一个直属 Cancel 按钮。macOS 使用对应的 exact-context/owner-aware 回补，实际 QObject 拓扑另由 Mac 真机清单验证。ExtensionLayer 只保留四条实证边界：helper、placeholder、MessageBar 与 text-path；其中 MessageBar 仅批准 history/live 两个 `QTextEdit::append` return 和单条 Pencil HTML 尾部正文，明确排除 `js_logger`；text-path 的三十六条静态 source 只走 canonical caller，覆盖 Edit/Transform/Pencil/Pen/Centre 动作、EditShapeTool/TransformTool 长操作前缀与 SkeletonTool Bone Tool 四组提示；`Space`、纯修饰键和单字母快捷键保持英文。动态 `Pitch Radius: <int>` 只走 PrimitiveTool 首行/后续行两个 caller，并保留 canonical 32-bit 数值后缀；64 位命中掩码保持 Pitch bit 28，Bone 使用 bits 29–36。其他自绘或日志路径保持英文，禁止宽泛 hook。
7. **重启与诊断**：Apply 先请求目标 `Cavalry.exe` 正常退出，再改写 runtime 文件并从同一安装根启动。非 English 启动只在同 PID、语言、Qt 版本、QPA 状态与嵌入表计数都匹配的原子 marker 就绪后报告成功；超时或插件错误必须显式失败，而不是假装已翻译。
8. **权限**：当前用户可写的自定义安装根直接执行同一 QPA plan。只有目标确实位于 Windows OS-known Program Files 根时，才允许 UAC worker 消费该 plan；任何重解析点逃逸、计划摘要漂移或非 Program Files 目标都拒绝提权。

## 阶段与验收

| 阶段 | 状态 | 可验证结果 | 尚缺内容 |
| --- | --- | --- | --- |
| W1 安装根与 JSON overlay | 已实机证明（可写自定义根） | 目录或 EXE 选择归一化；核心/插件 JSON 走同一复制链；保留 `smoother.smoothingSteps`；`D:\cavalry` 非默认盘符已完成真实 Apply 与重启 | Program Files 的发现/手动选址回归 |
| W2 generic plugin | 已实现；最近一次已截图构建三语首帧已实机 | Qt 6.6.3 x64 MSVC 编译与正式 CTest、Tauri resource 与 NSIS 构建；四条 ExtensionLayer 边界均有 ABI 合同，普通 Qt 搜索/标签/颜色/素材动作、性能标签与 Tracking 标题，Edit/Transform/Pencil/Pen/Centre/Bone 动作与长操作前缀、selected QLabel、动态 Pitch 生产/消费链均有真实 vendor 合同，且无第二套 Qt runtime；最近一次已截图构建的 generic `86F27CFE…F67`、QPA proxy `A2790FCE…971` 与 vendor QPA `E039D39A…F01` 已抓取简中、繁中、日语首帧及快捷操作列 | 当前源码构建的动态菜单、普通 Qt 新增项、Edit/Transform/Pencil/Pen/Centre/Bone 整行、Pencil 警告、Pitch bit 28 与其余显示白名单截图 |
| W3 QPA 原生入口 | 已实现；可写自定义根四入口实机 | vendor delegate、strict Cavalry/Qt/四文件 hash、durable backup、同卷原子替换、显式 English 恢复状态机已有单元证据；current-HEAD 简中下，直接 EXE、厂商桌面 advertised shortcut、厂商开始菜单 advertised shortcut 与 installed Switcher `--launch-cavalry` 均落到 `D:\cavalry\Cavalry.exe`，加载同一 current-HEAD QPA/generic 并取得精确 PID 可见截图；两份厂商快捷方式 bytes/hash 保持不变 | Program Files 真机链路；一台确实已有任务栏固定项的机器（当前机器没有可复用 pin） |
| W4 重启与权限 | 已实现；可写根实机 | 正常退出、QPA readiness、Program Files-only UAC 防线与同 plan worker；`D:\cavalry` 可写自定义根已完成真实应用与重启 | Program Files 受保护根的真实 UAC 对照 |
| W5 事务与溯源 | 进行中 | pending → JSON/generic → QPA → final marker，禁止提前声明语言生效；English snapshot 已绑定安装根与 immutable revision provenance | 将 pending、QPA `prepared`/`restoring`/`drifted` 与 retained journal 暴露为用户可见、可执行恢复状态，并完成中断真机回归 |
| W6 发布验收 | 进行中 | Windows x64 NSIS EXE 与两个 macOS DMG 共用 release metadata；current-HEAD NSIS provenance 已复算通过，当前 profile 已完成显式 `/UPDATE`，安装态 generic/QPA 与当前构建逐字节一致，更新阶段的 `D:\cavalry` runtime 与厂商桌面/开始菜单快捷方式保持不变；正式 `/UPDATE` → uninstall 的隔离安装态合同 gate 已实现，但不冒充当前 profile 的真实卸载；当前机器现有四类入口已完成 current-HEAD 简中截图；显式 English 已令 marker=`en`、恢复原厂 QPA 并移除 active backup/manifest，随后简中再次重建 active 状态并激活同一 current-HEAD proxy/generic | 干净 profile 安装、跨版本升级、真实卸载后持久状态、Program Files、已有任务栏固定项的机器，以及最终三语 UI 全表面截图闭环 |

跨平台后续债：上述 8 条已具有跨平台 exact-only 与 owner-aware 源码边界，但 macOS 的实际 QObject 拓扑及启动前/启动后两种时序尚待 Mac 真机复验，状态固定为 `PENDING-MAC-LIVE`；执行入口与证据字段见 `docs/workflows/cavalry-full-ui-100/Runbook.md`。它不冒充 Windows blocker，也不得在跨平台 full-ui parity 或发布前被省略。

## 非目标与防腐线

- 不做远程线程注入，不修改厂商 DLL，不扫描整个磁盘，也不设全局 Qt 环境变量。
- 不创建第二个 Cavalry 快捷方式，也不修改 Desktop、Public Desktop、开始菜单、任务栏或厂商 AppUserModel 身份。
- 不把 CI 的 plugin smoke、Rust 合同或 NSIS 构建称为 live UI 通过；它们不能替代真实 Cavalry 运行证据。
- 不为了覆盖率改写模型身份字段，也不以宽泛 IAT hook 掩盖未知 ExtensionLayer 绘制路径。
- 不为自定义路径提权；用户选择的非 Program Files 根应直接可写，否则让用户调整权限或选择其他安装目录。

## 真机验收清单

1. `D:\cavalry` 已覆盖“可写自定义安装 + 非默认盘符”；另在 Program Files 验证一次发现/手动选址与 UAC，避免把可写根样本误当成受保护根证明。
2. current-HEAD 已依次应用简中、繁中、日语与 English，并在 English 后重新激活简中；继续补齐 JSON overlay、`smoother.smoothingSteps`、动态菜单、动态动作与全部白名单 ExtensionLayer 文本的逐类截图。
3. 验证重启会等待匹配 marker；拒绝错误语言、错误 PID、错误 Qt 版本或不完整嵌入表。
4. current-HEAD 简中已经从桌面、开始菜单、直接 EXE 与 Switcher `--launch-cavalry` 四条现有入口取得同路径、同模块、同语截图；另在一台确实已有任务栏固定项的机器复验。当前机器没有既有 pin，不能伪造该项已通过。
5. 当前 profile 已完成 current-HEAD NSIS 显式 `/UPDATE`，且只有后续用户 Apply 才更新 `D:\cavalry`；显式 English 恢复原厂 QPA 与再次激活简中也已实跑。继续验证跨版本升级和真实交互卸载的两个选择。关闭、升级以及 silent/passive/update uninstall 不得隐式恢复；交互卸载只有用户选择恢复 English 才可进入同一事务，厂商更新覆盖代理后不得回写旧备份。
6. 确认卸载后不残留全局环境变量、第二套 Qt runtime 或 Switcher 安装目录越界文件；选择保留时 Cavalry 根必须继续本地化，选择恢复时只能删除 hash/manifest 证明自有的 runtime，未知文件必须保留并使卸载失败。
