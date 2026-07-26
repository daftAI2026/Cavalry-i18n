<!--
[INPUT]: 依赖跨平台安装模型、Windows runtime/plugin/privilege 实现、语言包与 Tauri Windows 打包配置
[OUTPUT]: 对外提供 Windows 移植的真实架构、阶段状态、权限边界与真机验收条件
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
4. **子进程环境**：仅启动 Cavalry 子进程时设置 `QT_PLUGIN_PATH`、`QT_QPA_GENERIC_PLUGINS=cavalryi18n`、`CAVALRY_I18N_LANG` 与可选诊断 marker；绝不写入用户或系统全局环境。English 不加载该插件。
5. **显示层边界**：主动翻译既有和动态菜单、动作、窗口标题与受控显示属性；不修改输入值、item model、Time Editor 或其他模型身份数据。ExtensionLayer 只保留四条实证边界：helper、placeholder、MessageBar 与 text-path；其中 MessageBar 仅批准 history/live 两个 `QTextEdit::append` return 和单条 Pencil HTML 尾部正文，明确排除 `js_logger`。其他自绘或日志路径保持英文，禁止宽泛 hook。
6. **重启与诊断**：先请求目标 `Cavalry.exe` 正常退出，再在同一安装根启动。非 English 启动只在同 PID、语言、Qt 版本与嵌入表计数都匹配的原子 marker 就绪后报告成功；超时或插件错误必须显式失败，而不是假装已翻译。
7. **权限**：自定义安装目录可以使用，但必须由当前用户可写。只有目标确实位于 Windows 已知 Program Files 根时，才允许 UAC 管理员复制；任何重解析点逃逸或非 Program Files 目标都拒绝提权。

## 阶段与验收

| 阶段 | 状态 | 可验证结果 | 尚缺内容 |
| --- | --- | --- | --- |
| W1 安装根与 JSON overlay | 已实现 | 目录或 EXE 选择归一化；核心/插件 JSON 走同一复制链；保留 `smoother.smoothingSteps` | 真实非默认安装目录回归 |
| W2 generic plugin | 已实现 | Qt 6.6.3 x64 MSVC 编译、7 项 CTest、Tauri resource 与 NSIS 构建；四条 ExtensionLayer 边界均有 ABI 合同且无第二套 Qt runtime | 真实 Cavalry 的首帧、动态菜单、Pencil 警告与显示白名单截图 |
| W3 重启与权限 | 已实现 | child-only 环境、正常退出、Program Files-only UAC 防线、marker 就绪校验 | 受保护与可写自定义目录的真机对照 |
| W4 事务与溯源 | 进行中 | marker 作为 JSON 与 DLL 复制后的最后一项，避免提前声明语言生效 | 将 snapshot provenance 与 pending/完成状态统一接入用户可见恢复流程 |
| W5 发布验收 | 待开始 | Windows x64 NSIS EXE 与两个 macOS DMG 共用 release metadata | 安装、语言切换、重启、升级、卸载及恢复 English 的真实 Cavalry 闭环 |

## 非目标与防腐线

- 不做远程线程注入，不修改厂商 DLL，不扫描整个磁盘，也不设全局 Qt 环境变量。
- 不把 CI 的 plugin smoke、Rust 合同或 NSIS 构建称为 live UI 通过；它们不能替代真实 Cavalry 运行证据。
- 不为了覆盖率改写模型身份字段，也不以宽泛 IAT hook 掩盖未知 ExtensionLayer 绘制路径。
- 不为自定义路径提权；用户选择的非 Program Files 根应直接可写，否则让用户调整权限或选择其他安装目录。

## 真机验收清单

1. 在 Program Files 安装、当前用户可写的自定义安装和非默认盘符各验证一次发现/手动选址。
2. 依次应用三种非 English 语言和 English，确认 JSON overlay、`smoother.smoothingSteps`、菜单、动态动作与白名单 ExtensionLayer 文本。
3. 验证重启会等待匹配 marker；拒绝错误语言、错误 PID、错误 Qt 版本或不完整嵌入表。
4. 在安装器升级和卸载后确认不残留全局环境变量、第二套 Qt runtime 或越界文件；保留恢复 English 的 snapshot provenance 证据。
