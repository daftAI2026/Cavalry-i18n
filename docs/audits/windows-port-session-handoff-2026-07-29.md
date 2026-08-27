<!--
[INPUT]: 依赖 Cavalry 2.7.2 Windows x64 实现、PR #3/#28/#29/#30、Issue #1/#16、Windows 合同、真机、安装器证据与发布验收修复记录
[OUTPUT]: 对外提供 Windows 移植与发布验收复盘、维护心智模型、被证伪方案、证据分级、原始 session 生命周期和 macOS 发布交接
[POS]: docs/audits 的 dated 工程审计；补充 roadmap 的状态与 SOP 的命令，不替代代码、合同或实时发布状态
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
-->

# Windows x64 适配实施复盘与维护交接

> 审计日期：2026-07-29
>
> 收尾更新：2026-08-28
>
> 目标：Cavalry 2.7.2、Qt 6.6.3、Windows x64
>
> 公开工作项：[PR #3](https://github.com/daftAI2026/Cavalry-i18n/pull/3)、[Issue #1](https://github.com/daftAI2026/Cavalry-i18n/issues/1)
>
> 内部来源：Codex 任务 `019f8f54-14c8-7022-b951-2fdd56459d48`

## 文档边界

这份记录保留 Windows 端口从环境搭建到 PR 收尾期间形成的工程经验。它回答四个问题：

- Windows 最终采用了什么架构，为什么；
- 哪些早期判断被二进制、实机或 CI 证据推翻；
- 一项测试通过时，究竟证明了什么；
- 下一位维护者接手时，哪些边界不能重新猜。

下面几份文档各自保持单一职责：

- [Windows roadmap](../roadmap/windows-port-and-injection-roadmap.md) 维护阶段状态与尚缺证据；
- [LOCAL_BUILD_SOP](../../LOCAL_BUILD_SOP.md) 维护可执行构建和打包命令；
- [full UI Runbook](../workflows/cavalry-full-ui-100/Runbook.md) 维护运行时抓取与 gate 步骤；
- [translation guidelines](../translation-guidelines.md) 维护四语文案与身份字段规则；
- 本文记录决策理由、失败路线和交接状态。

实现、测试和当前 PR 状态发生冲突时，以当前代码、合同和 GitHub 检查为准。

## 完成口径先于实现机制

macOS 已经能在原生入口下显示 English、简体中文、繁體中文和日本語。Windows 的验收口径是同样的用户结果，不要求复制 macOS 的 DYLD、AppKit、签名或 bundle 结构。

Windows 端口要同时满足：

- 安装位置不固定，自动发现失败时可以手动选择；
- JSON 资产按键覆盖，不删除安装中未知或新增的数据；
- Switcher、桌面、开始菜单、已有任务栏固定项和直接运行 `Cavalry.exe` 最终经过同一翻译入口；
- 模型身份、用户输入、快捷键物理键名和第三方文本不被误改；
- Program Files 写入只经过受限 UAC 事务；
- English 能恢复精确原厂 QPA，普通退出、更新和卸载不偷偷改变当前语言；
- 发布包来自当前源码和当前原生 DLL，不能拿旧包验新代码；
- 自动合同、原生测试、真机像素、安装器和用户手测分层记录，不互相冒充。

Windows 当前只支持 x64。Cavalry、厂商 Qt、项目 Qt SDK 和进程内插件都为 x64，x86 安装器即使能启动，也无法把 32 位 DLL 加载进 64 位 Cavalry。

## 最终架构

```text
用户选择语言
    |
    v
Tauri 命令层
    |
    +--> 解析并验证 CavalryInstall
    |       Cavalry.exe / install root / assets root
    |
    +--> pending marker
    |
    +--> keyed JSON overlay
    |
    +--> 部署 generic translator
    |
    +--> 激活或恢复 QPA 状态
    |
    +--> final language marker
    |
    v
任意 Cavalry 原生启动入口
    |
    v
qwindows.dll delegate
    |
    +--> 委托精确原厂 qwindows.dll
    |
    +--> manifest、hash、Qt、语言 marker 全部成立时
            加载 generic translator
```

非 English 语言使用两枚职责不同的 DLL：

- **generic translator** 负责 Qt 对象、动态显示值和经证明的 ExtensionLayer 文本翻译；
- **QPA delegate** 占据 Cavalry 启动时必经的 `qwindows.dll` 位置，先委托原厂 QPA，再按严格状态加载 generic translator。

QPA delegate 不实现窗口系统，也不携带第二套 Qt。启动阶段先验证运行时 Qt 版本和固定 vendor QPA 摘要，这两项失败会拒绝 QPA bootstrap；vendor integration 成功后，manifest、Cavalry、proxy、generic 或 marker 等翻译状态不一致只会关闭翻译并继续使用原厂窗口系统。

选择 English 时走显式恢复事务。当前根 DLL 仍是本项目代理并且原厂备份身份成立时，才把原厂 DLL 原子恢复；厂商更新已覆盖代理时保留厂商新文件，绝不把旧备份写回。

## 安装位置是输入，不是常量

开发机上的非默认盘符安装只证明“自定义根可工作”，不能成为默认路径。实现把 `Cavalry.exe`、安装根和 `assets` 根归一成一个经过验证的安装模型，候选来源包括：

- 最近一次已保存且仍有效的位置；
- 当前运行中的精确 `Cavalry.exe`；
- MSI advertised shortcut；
- 有限的常见安装目录；
- 用户手动选择的 EXE 或安装目录。

候选不是可信结果。路径必须规范化，EXE 和 38 个核心资源表面必须成立，后续复制、启动、QPA 和状态文件都从同一个安装模型推导。

不要恢复全盘扫描，也不要把某台机器的盘符、MSI product code、component GUID 或快捷方式位置写成产品常量。厂商是 MSI 安装包，只说明安装发现可以使用 MSI API，不代表 Switcher 也必须改成 MSI。

## JSON 资产必须覆盖已知键

最初看到 Windows 安装中的 `smoother.smoothingSteps` 不在仓库 English 基线里时，曾把它判断成 Windows 独有节点。只读展开 macOS DMG 后，macOS 与 Windows 的 `nodeStrings.json` 逐字节一致，两个平台都有这个 Cavalry 2.7.2 节点。真实问题是仓库基线过旧。

最终处理包括：

- 把 `smoother.smoothingSteps` 加回 English 基线；
- 按翻译规范补齐简中、繁中和日语；
- 继续使用 keyed overlay，保留未来安装中出现的未知节点；
- 用结构合同锁住四语同构和 installed-only 节点保留。

从这个纠偏得到的规则很直接：仓库基线与安装文件不一致时，先比较同版本厂商资产。没有平台证据前，不给差异贴“Windows 独有”或“macOS 独有”标签，也不靠删节点恢复同构。

## 翻译表面分层

同一句英文出现在 DLL、TS 或截图里，只能说明它是候选。真正授权翻译的是显示路径、对象所有者、调用点和用户可见事实。

| 表面 | 真相源 | Windows 机制 | 保护边界 |
| --- | --- | --- | --- |
| JSON 属性与固定资源 | `languages/{lang}` | keyed overlay | 未知节点、ID、API/type 字段和模型身份保留 |
| 普通 Qt 文本 | `tools/*.ts` 与真实 context | generic translator、Show/ActionAdded/aboutToShow | 不做全局 source-only fallback |
| 自动编号名称 | 已知基名加数字后缀 | scoped display projection | 用户自定义名称和 model role 不动 |
| 下拉当前显示值 | 已证词表与控件结构 | 阻断业务信号后只改显示 | 用户输入、未知枚举、EditRole 不动 |
| 居中空状态 | 固定 source 与 `textAtWidgetCentre` caller | 精确 ExtensionLayer IAT | 未知画布文字原样转发 |
| Snippet/placeholder | `CustomListWidget::setPlaceholder` | 精确 placeholder hook | 只允许已采证白名单 |
| MessageBar | 两个真实 `QTextEdit::append` caller | 只替换 Pencil HTML 尾部正文 | `js_logger`、历史未知日志和 HTML 包装不动 |
| Skia 自绘提示 | producer、canonical caller、source 和 ABI 合同 | text-path renderer | 禁止全局 `QPainter::drawText` |
| 模型与用户数据 | Cavalry model | 不翻译或显示层临时投影 | Time Editor、niceName、用户文本保持身份 |

### 语义入口比绘制入口稳定

Windows 初版曾沿 `QPainter::drawText` 重载追踪三条居中提示。旧 IAT 槽拦截的是过早的 Qt6Gui 绘制入口，`hook=installed` 无法证明目标文字经过该调用点。最终改到已经拿到完整业务文本的入口：

- 居中提示用 `ui::textAtWidgetCentre`；
- Snippet 用 `setPlaceholder`；
- Pencil 警告用 MessageBar 的两个真实 append caller；
- 工具提示用已证明的 text-path caller/source。

全局绘制 hook 会把画布内容、模型文本和用户数据一起纳入风险面。只有发现新的固定 UI 表面，并能同时证明 producer、caller、source、ABI 和真实界面，才扩展 ExtensionLayer 白名单。

### `hook=installed` 不等于翻译成功

早期真机运行已经出现过这种组合：

- marker 表示 hook 已安装；
- 日语快捷提示仍是英文；
- `Viewport Quality` 出现方框；
- 简繁对应位置为空白。

原因不是词条缺失，而是 Cavalry 自绘路径使用不含 CJK 字形的 Lato。最终 text-path renderer 选择具备完整字形覆盖的 Windows CJK 字体，把文字转换为 Skia path；私有 Core/skia ABI 在调用前锁定 PE 身份、导出 RVA 和关键机器码，任何异常都回退原英文。

真机验收同时看 source mask、CJK path 成功数、fallback mask、renderer failure 和截图。单独一个 installed marker 不构成可见结果。

### 精确 source 包含空格和分行

工具栏整行、MessageBar HTML、动态前缀和 `Pitch Radius: <int>` 都不能靠近似匹配：

- 冒号和尾随空格属于 source identity；
- Transform、Edit Shape 等提示可能把快捷键前缀与动作拆成多个 text path；
- `Pitch Radius` 只批准 PrimitiveTool 的两个 caller 和 canonical 32-bit 数值后缀；
- orphan TS message 直接由生成器拒绝，不能用没有 owner/context 的词条填覆盖率；
- `N selected`、离线登录倒计时等动态文本必须限制在已证明的 QLabel/owner 结构。

物理键 token 保持厂商写法。`Space`、`Shift`、Control、Alt 和单字母键不翻译；click、double click、drag 等动作按语言本地化。空状态和 Snippet 的三语短提示不加句号，完整通知仍按句子处理。

## 所有原生入口要自然汇合

只靠进程环境加载 QGenericPlugin 时，从 Switcher 启动可以翻译，桌面图标、开始菜单、任务栏固定项和直接 EXE 仍可能是英文。用户期待的是“语言已经应用到 Cavalry”，不是“只能从另一个程序启动 Cavalry”。

最终没有创建第二个本地化快捷方式，也没有替换、备份或重写厂商快捷方式。QPA 是 Cavalry 原生启动必经点，现有入口保持原图标、参数和 AppUserModel 身份，翻译状态在安装根内汇合。

没有桌面快捷方式的用户不会被额外创建一个；已有任务栏固定项也不需要改写。当前机器没有可复用的既有任务栏 pin，因此“任务栏固定项真机实证”仍属于待补证据，不能用架构推理冒充实跑。

## QPA 恢复是用户动作

普通 Cavalry 退出、Switcher 关闭、Switcher 更新和卸载都保留当前语言。每次退出恢复原厂 DLL 会让原生图标重新变成英文，也会把关闭应用变成一次高风险写事务。

只有用户明确选择 English 才恢复原厂 QPA。厂商重装或升级也可能自然覆盖代理，这时以厂商新文件为准。恢复逻辑必须满足：

- 当前根 DLL 是本项目拥有的代理；
- durable backup 与 manifest 身份一致；
- 目标仍是同一个受支持安装；
- 恢复使用同卷原子替换；
- 任何漂移都停止恢复，不覆盖未知新文件。

## Program Files 只有一条提权路径

自定义可写安装根直接执行与普通路径相同的事务。只有 Windows known-folder API 证明目标位于 Program Files 或 Program Files (x86) 时，才允许 UAC。

提权实现使用当前 Switcher EXE 作为一次 headless worker，不依赖第二个管理员程序，也不回退旧 PowerShell 复制链。worker 会重新推导和验证：

- OS 认可的 Program Files 根；
- 目标链没有 reparse point 逃逸；
- 输入 plan 与 source provenance；
- Cavalry、Qt、vendor QPA、generic 和 proxy 的精确身份；
- 所有目标仍位于同一个受支持安装根；
- final language marker 最后提交。

UAC consent 是 Windows 的安全界面，不能隐藏。需要静默的是辅助 PowerShell 或命令进程的控制台窗口。

## 语言写入是事务

应用语言时，状态顺序也是协议的一部分：

1. 写入 pending marker；
2. 保存每个目标的精确 preimage；
3. 写 keyed JSON 和 generic runtime；
4. 提交 QPA activation 或 restoration；
5. 最后写 final language marker；
6. 任一步失败都逆序恢复已写目标。

普通状态同步不能制造 English snapshot provenance。只有当前安装中全部 38 个映射 JSON 表面通过 packaged-English overlay equality，才允许捕获 English；translated、pending、invalid 或 Windows 空 marker 都 fail closed。

安装器、更新器和卸载器也不能把 Cavalry 根当自己的清理目录。外部三文件 sentinel 用于证明 NSIS 生命周期不会改动 QPA 持久状态。

## 运行中的 Cavalry 必须在写入前解决

“仍在运行”和“事务失败并已回滚”是两种用户结果。语言应用在任何写入前处理目标进程：

- 当前 Windows 登录会话；
- 精确 EXE 路径；
- 绑定的 `Process` 与 `SafeProcessHandle`；
- 精确 PID 的可见窗口 oracle；
- 可验证的 session 和 `MainModule.FileName`；
- 正常关闭优先；
- 超时后只对同一个已绑定且两次确认无可见窗口的进程调用 scoped `Kill()`。

枚举、路径、session、窗口或 handle 无法复核时都失败，不把“无法确认”当成“目标不存在”。这条边界避免宽泛 `taskkill`、进程树终止或 PID 复用误伤。

## 黑框与 PowerShell 宿主是两件事

发布版是 GUI 子系统。它启动 Console 子系统的辅助进程时，如果没有 `CREATE_NO_WINDOW` 或对应隐藏参数，Windows 会显示黑框。产品运行时已经统一隐藏安装探测、关闭重启和内部复制辅助进程，UAC consent 与 Cavalry 主窗口不在隐藏范围。

开发脚本支持 PowerShell 5.1+，不要求所有开发机统一安装 5.1 或 7：

- 有 `pwsh.exe` 时使用当前 PowerShell；
- 只有 `pwsh.exe` 不存在时才回退 `powershell.exe`；
- 5.1 fallback 清除从 PowerShell 7 继承的各种大小写 `PSModulePath`；
- 脚本返回非零、signal 或 EACCES 时原样失败，不能换壳再跑一次；
- Node launcher 使用 `shell: false` 和 `windowsHide: true`；
- 含非 ASCII 的 Windows PowerShell 脚本保留 UTF-8 BOM。

GitHub 的实际故障发生在 DLL 构建和 CTest 已成功之后：外层 pwsh 重新启动 Windows PowerShell 5.1，错误继承的模块路径让 `Get-FileHash` 消失。修复宿主边界比换掉哈希实现更接近根因。

## 构建依赖分成下限和精确锁

| 项目 | 合同 | 原因 |
| --- | --- | --- |
| Windows | 10 x64+ | 当前开发和产品支持下限 |
| Node.js | 24+ | 开发机使用 Node 24 LTS；CI 与漏洞证据精确固定 24.20.0 / npm 11.19.0 |
| Python | 3 | 翻译验证与 Qt SDK 准备 |
| PowerShell | 5.1+ | Windows 开发脚本 |
| Visual Studio | 2022+ | 需要 x64 MSVC v143 workload |
| CMake | 4.2+ | 支持当前和 VS 2026 generator |
| Rust | stable、edition 2021 | Tauri 后端 |
| Qt | 精确 6.6.3 | 必须匹配 Cavalry runtime ABI |
| Cavalry | 精确 2.7.2 | QPA、PE、caller 和资源目标身份 |

工具版本使用可向前兼容的最低值，目标 ABI 和厂商版本使用精确值。CMake 选择机器上已安装的 Visual Studio generator，只锁 `-A x64 -T v143`，不把项目绑死到某个 runner 年份或 IDE 标签。

发布 NSIS 用户不需要 Node、Python、Rust、Qt SDK、Visual Studio、CMake 或 PowerShell 7。

### 开发机重建时的实际经验

- Windows 不保证存在 `python3` 命令。项目的 Python launcher 按 `PYTHON`、`py -3`、`python` 解析；
- `npm.ps1` 被执行策略拦截时使用 `npm.cmd`，不需要放宽系统策略；
- rustup 显示 stable-msvc 已安装，不代表 `link.exe` 和 Windows SDK 已经存在，VS C++ workload 仍需单独验证；
- 后台启动 Cargo 时必须保留 toolchain PATH，只有 `cargo.exe` 没有同目录 `rustc.exe` 会让 build script 误报编译器缺失；
- 某台开发机的 Cargo HTTP/2 网络挂起属于环境事件，不应变成仓库默认网络配置；
- Git commit 作者身份与 GitHub 登录分离。`git config user.name/user.email` 管提交作者，`gh auth login/status` 管远端授权；文档、日志和提交中都不记录 token 或个人凭据。

## 原生产物由对应平台构建

预编译 dylib 或 DLL 不应充当跨平台源码。最终协议是：

- Git 保存 C++/Objective-C++ 源码、生成翻译表和构建合同；
- macOS runner 构建 macOS injector；
- Windows runner 构建 generic translator 与 QPA delegate；
- Tauri dev/build 在启动或打包前先调用对应平台 injector 构建；
- 包内 provenance 绑定当前 renderer、语言包、Rust 输入、NSIS hook 和两枚 Windows DLL；
- 发布包不携带另一套 Qt runtime，也不混入另一平台原生库。

这避免了“在 Mac 编完 dylib，再到 Windows 处理无法同步”的状态。具体 DLL 哈希属于某次构建证据，不写成长期常量；长期合同锁定哈希之间的来源关系和目标身份。

## Git hook 只验证将要提交的内容

Windows 端口期间，pre-commit 暴露过三类问题：

- hook 在 stale PATH 下找不到 Node；
- hook 无条件暂存并行工作中的文件，破坏逻辑提交边界；
- partial-staged 时验证工作区，而不是 Git index。

当前规则是：

- 安装 hook 时把 Node 的绝对路径写入 repo-local 配置；
- gate 根据 staged paths 选择验证范围；
- 输入闭包存在未暂存漂移时 fail closed；
- 版本同步只显式暂存已知版本投影；
- 禁止 `git add .`；
- 提交前验证的是 index 中将进入 commit 的字节。

逻辑提交保留了每个修复的因果边界。Windows 端口的主要里程碑包括：

| 里程碑 | 提交 |
| --- | --- |
| `smoother` 与 Snippet 真相源 | `0f58a6a` |
| Windows Qt generic plugin | `f7f760a` |
| ExtensionLayer 语义边界 | `b22fbb2` |
| x64 runtime、事务与 NSIS 基线 | `a64bfca` |
| 隐藏运行时 PowerShell 黑框 | `750a95d` |
| 原生 Cavalry 启动路径 | `dd2b60e` |
| 持久 QPA delegate | `74da916` |
| Program Files 单次 UAC 事务 | `6f9cb58` |
| 各平台 runner 现场构建 injector | `22d0a2b` |
| 运行中 Cavalry 写前保护 | `b270f56` |
| Visual Studio generator 前向兼容 | `385a53b` |
| Tauri dev 启动前构建 injector | `671e091` |
| PowerShell edition 边界 | `0635275` |

## Windows 发布协议

Windows 只发布 x64 NSIS。完整发行资产是：

- macOS Apple Silicon DMG；
- macOS Intel x64 DMG；
- Windows x64 NSIS EXE。

资产名和 release title 来自 `release.config.json`，不手写某次本地 Tauri 文件名。NSIS 安装界面跟随 Windows UI 语言，支持 English、简中、繁中和日语，其他语言回退 English；图标复用项目品牌资产。

构建、smoke 和 CI 上传必须指向 `target/x86_64-pc-windows-msvc/...`。旧 `target/release/...` 中残留的 EXE 不能作为 fallback，否则会出现“拿旧包验证新源码”的假绿。

provenance sidecar 绑定安装器字节与当前打包输入，不依赖 Git HEAD 或 mtime。隔离 gate 执行真实 install、same-version update 和 uninstall，并在测试前拒绝：

- 目标目录、注册表或快捷方式碰撞；
- 预期输出之外的外来 EXE；
- orphan provenance sidecar；
- 安装器与当前源码输入不一致；
- 包内出现第二套 Qt 或错误平台原生库。

卸载只清 Switcher 自己的文件和精确安装位置元数据，不删除用户选择保留的应用数据，也不恢复 Cavalry 当前语言。

## 证据分级

| 证据 | 能证明 | 不能证明 |
| --- | --- | --- |
| Node/Rust 合同 | 配置、状态机、边界和回归反例 | 真实 Cavalry 像素 |
| Windows CTest 与 vendor PE 合同 | Qt ABI、IAT/caller/source、QPA 委托和生命周期 | 最终用户看到的文案 |
| CI | 干净 runner 可构建、测试和打包 | live Cavalry UI |
| disposable clone | 不碰真实安装的运行时链、语言恢复和截图 | Program Files ACL、现有任务栏 pin |
| marker/source mask | 指定 hook 和来源真正命中、是否 fallback | 字体最终是否可读 |
| 人工截图审阅 | 文字、字形、布局和残余英文 | 未打开的 UI 表面 |
| NSIS install/update/uninstall | 包内容、安装生命周期和零越界 | 跨版本升级与真实用户配置组合 |
| 用户手测 | 实际机器的主要语言切换路径 | 全量表面和其他机器环境 |

2026-08-28 的 Windows 发布候选以 `9e293df26191bc638e81f343033b2dbada8c8aba` 为 source commit。PR #28、#29、#30 已合并，最终 PR CI 和 Codex review 通过；本机完成 NSIS 安装、同版本更新、Switcher 可见窗口启动、三语 Onboarding `15/15`、English 恢复和零 Cavalry PID。具体安装器、provenance、generic/QPA 和截图摘要保存在该轮 acceptance 记录中，不把一次构建的哈希抄成长期常量。

## 被证伪或放弃的方向

| 早期方向 | 结论 | 重新考虑的条件 |
| --- | --- | --- |
| 把某个非默认盘符写成默认路径 | 拒绝，安装根必须发现或手选 | 无 |
| 把 `smoother` 当 Windows 独有或删除 | 已由同版本 DMG/Windows 字节事实推翻 | 新 Cavalry 版本资产再次分叉 |
| 复制 macOS DYLD 方案 | Windows 采用 Qt plugin 与 QPA 必经点 | 平台机制发生根本变化 |
| remote thread `LoadLibraryW` 作为生产注入 | 只适合作为早期可达性 probe，生产未采用 | 没有更窄的受支持启动边界 |
| generic plugin 足以覆盖所有入口 | 只能覆盖带环境的子进程，已由原生入口失败推翻 | Cavalry 官方提供持久 plugin 配置 |
| 新建或替换本地化 Cavalry 快捷方式 | 拒绝，QPA 让现有入口自然汇合 | 厂商入口不再经过 QPA |
| Cavalry 是 MSI，所以 Switcher 也应改 MSI | 两者无因果关系，保留 Tauri NSIS | NSIS 无法满足新的产品要求 |
| 同时发 x86 和 x64 | x86 无法加载进 x64 Cavalry | 厂商发布 32 位 Cavalry 与 Qt ABI |
| 拦截全局 `drawText` | 范围过宽，改用语义入口和 caller/source 白名单 | 有完整 producer/caller/UI 证据的新表面 |
| marker 显示 installed 就算通过 | 已被英文残留和 CJK 方框反例推翻 | 无 |
| 关闭 Cavalry 或卸载时恢复原厂 QPA | 会破坏原生入口持久语言，只允许显式 English | 产品语义明确改变 |
| 要求固定 VS 2022 runner | 只锁 x64/v143，generator 由 CMake 选择 | Qt ABI 要求新的 toolset |
| 强制所有开发者用 PowerShell 5.1 或 7 | 支持 5.1+，按当前机器选择宿主 | 脚本采用明确的 7-only 能力 |
| 跟踪预编译原生库 | runner 现场构建并绑定 provenance | 无可用平台 runner 且发布协议重设 |
| CI green 等于 full UI pass | CI 无真实 Cavalry，永远不能替代 live gate | CI runner 获得合法 live Cavalry 环境 |

## 2026-08-27 至 2026-08-28 发布验收收尾

Windows 发布验收最后关闭了 npm 工具链身份、临时插件目录所有权和人工 seal 三类问题。

PR #28 让 English 恢复使用 immutable snapshot 的原始字节，非 English 仍走 canonical overlay。PR #29 修复 live machine record 的 npm 身份采集：优先让当前 Node 执行 `npm_execpath`，Windows 仅在缺少该入口时使用受控 shell fallback。不能把 PowerShell 里可运行的 `npm` 想当然地当作 `spawn` 可执行文件，也不能只测字符串拼装而不执行真实入口。

PR #30 来自合并后真实重跑。干净 English clone 没有根 `generic/` 是合法状态，acceptance runner 却在缺少父目录时直接创建临时 DLL。修复遵守三个所有权条件：只在 sentinel 保护的 disposable clone 内创建；目录创建成功的瞬间记录本轮所有权，后续任何 `?` 失败都能清理；只删除本轮创建且仍为空的目录，已有 vendor 目录永不删除。资源所有权若等到最后一步才登记，失败路径就已经失去清理依据。

完整 live runner 以 `MACHINE-COMPLETE-MANUAL-PENDING` 结束是设计行为。机器记录先证明进程、窗口、截图、installer、DLL、English restore 和清理，人工 review 再把已有 15 张截图封成 `PASS-15-OF-15`。不能把“需要人工复核”误报成产品失败，也不能跳过人工记录直接把机器完成写成 PASS。

PR 流程只在候选发生变化时重跑必要检查。先用定向红测证明 npm 入口和缺失 `generic/`，修复后跑对应 Rust/Node 合同；最终候选只跑一次完整 CI。Codex 对失败路径所有权的 P2 意见修复后重新复核并解决 thread，合并后的重复 main CI 被取消，避免用过期 run 消耗时间。

### 原始 session 的生命周期

Windows acceptance summary 是便于阅读的派生产物，不是 release evidence 输入。`create_release_acceptance_evidence.js --windows-session-dir` 会重新读取原始 session，并复核 disposable clone、installer、provenance、已安装 DLL、截图和 inventory。只复制 summary，或先清理 clone，再把 session 带到另一台机器，都无法通过当前 fail-closed verifier。

本轮在生成 summary 后按临时目录清理要求删除了 disposable clone。因此现存 final record 仍能证明当次 Windows `15/15`，却不能直接参与后续 combined evidence 生成。macOS 发布前必须二选一：在最终 source commit 上重建完整 Windows 原始 session，并保留所有 verifier 依赖直到 evidence 生成；或先通过有回归测试的 PR 把双平台 session 改成可搬移的自包含证据包。不得修改 JSON 路径或拿 summary 冒充原始 session。

文档提交同样会改变 commit identity。当前 Windows session 绑定 source commit `9e293df26191bc638e81f343033b2dbada8c8aba`，所以本次经验文档 PR 不能在 macOS acceptance 和 release evidence 之前合并。若 source commit 改变，Windows 与 macOS live evidence 都必须重新绑定新 commit。

当前远端只剩 [Issue #12](https://github.com/daftAI2026/Cavalry-i18n/issues/12) 和总跟踪 [Issue #13](https://github.com/daftAI2026/Cavalry-i18n/issues/13)。Windows [Issue #16](https://github.com/daftAI2026/Cavalry-i18n/issues/16) 已关闭；Mac 验证、combined evidence、外部 attestation、tag 和公开发布统一由 [`release-seals/TODO.md`](../../release-seals/TODO.md) 维护。

## 证据卫生

长期文档可以记录机制、合同、PR、Issue 和稳定的里程碑提交。不要提交：

- 用户名、邮箱、token、账号或登录状态；
- 本机绝对用户目录；
- 临时 GUID、PID、HWND、UAC 测试目录或注册表备份路径；
- 实际 Cavalry 安装包、厂商 DLL、用户缓存或 live session；
- 某次构建的原生哈希作为永久常量；
- 只在聊天中出现、尚未被代码或实机证明的根因。

经验只有在代码、合同、二进制、实机或 CI 中至少有一处可复核证据时，才进入这份交接。
