<!--
[INPUT]: 依赖 Cavalry 2.7.2 Windows x64 当前实现、0.6.1 修复提交、NSIS 四语实机检查与 Codex 任务 019fbcaf-4efe-7880-b420-39f40505cf32 的决策证据
[OUTPUT]: 对外提供 Windows 英文状态对账、卸载语义、工作区隔离与安装器页面修复的工程复盘和同类问题排查顺序
[POS]: docs/audits 的 dated session handoff；记录已证实的因果、被证伪方案与证据边界，不替代代码、合同测试或实时发布状态
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
-->

# Windows 状态对账与卸载语义修复复盘

> 日期：2026-08-01
> 目标：Cavalry 2.7.2、Qt 6.6.3、Windows x64
> 内部版本：0.6.1
> Codex 任务：`019fbcaf-4efe-7880-b420-39f40505cf32`

## 文档边界

本次任务不是一个孤立报错修复。用户先后遇到并追问了五类相互关联的问题：

1. Cavalry 已被厂商安装器恢复为英文，但 Switcher 因 `zh-Hant` marker 拒绝刷新英文；
2. 卸载 Switcher 后仍能看到 marker、generic translator 与 QPA recovery，无法判断它们是泄漏还是保留翻译所必需；
3. 用户可能只想卸载 Switcher，却希望 Cavalry 保持已部署的翻译；
4. 卸载界面的选择曾被跳过、出现无效“上一步”，之后又出现跨页解释和弹窗式交互；
5. 一次真实 Cavalry 启动出现近乎空白的工作区，需要判断是翻译包、打包流程还是 Cavalry 用户状态导致。

最终形成四个代码提交：

- `04fc5ae`：安全识别厂商重装后的英文现实，并对 stale marker 做只读投影与事务收敛；
- `bd8bfa2`：收紧显式 English/卸载清理，增加卸载入口与真实 workspace 改写检测守卫；
- `289de4e`：修复卸载选项页跳过，把翻译和应用数据说明放回各自页面；
- `bfff742`：封版内部版本 0.6.1，同步 CHANGELOG、AGENTS 与五处版本元数据。

本文只记录有代码、哈希、状态机、生成安装器或实机界面支持的结论。无法证明是谁切换了 Cavalry 工作区模式时，就不把猜测写成产品根因。

## 第一性原理：marker 不是运行时真相

最初的错误是：

```text
English extraction refused: Cavalry language marker is zh-Hant.
```

用户看到的 Cavalry 却是原生英文。若把 marker 当成唯一真相，系统只有两个坏选择：继续拒绝，或删除 marker 后盲目采集。正确模型必须拆开至少五层证据：

| 层 | 它能证明什么 | 它不能单独证明什么 |
| --- | --- | --- |
| 38 份 keyed JSON | 已知翻译资产是否逐键等于 packaged English | Qt 编译界面是否仍被运行时翻译 |
| 根 `qwindows.dll` | 当前入口是精确厂商 QPA、代理或未知文件 | recovery/generic 是否仍有残留 |
| QPA manifest 与 vendor backup | recovery 是否由本项目拥有、phase 是否有效 | 当前根 DLL 是否已经被厂商更新替换 |
| generic translator | 编译/runtime 翻译代码是否仍可能被加载 | 当前 QPA 是否真的会加载它 |
| language marker | 上一次成功事务声明的目标语言 | 厂商重装后的磁盘现实 |

因此英文采集在 Windows 上要求：

1. 每个 `CORE_MAP` 文件都通过 packaged-English overlay equality；
2. QPA inspection 为 `Stock`，或为带有效 phase 的 `Recover`；
3. 当前根 `qwindows.dll` 必须等于精确 vendor hash；
4. `Active`、`Drifted`、非法/空 marker、不可读证据或无效 recovery 一律失败关闭。

通过英文证明后仍要区分两种状态：

- **Clean**：在 JSON 与精确 vendor runtime 已证明后，marker 为 `en` 或缺失、QPA 为 `Stock`，并且无 generic residue。只采集英文，缺失 marker 不会被制造。
- **NeedsWindowsReconciliation**：存在已知非英文 marker、有效 Recover 或 generic residue。先采集，再通过原有 `en` 事务统一收敛 marker、QPA、generic 与 recovery。

关键经验是：只读安装状态投影不能偷偷修改 Cavalry 安装根、marker 或 runtime；真正的收敛必须走现有事务、锁、UAC、回滚和 final-marker-last 边界。用户侧 Switcher state 的普通同步不等于安装根修复。

## 卸载的核心不是删文件，而是分开控制面与数据面

Switcher 是控制面；已经写入 Cavalry 的 JSON、generic translator、QPA delegate 和语言状态是数据面。卸载控制面不天然等于删除数据面。

本次确定的产品语义是：

- 普通交互卸载始终先显示独立的“Cavalry 翻译”页；
- 默认不勾选：只卸载 Switcher，保留 Cavalry 当前翻译及其必要运行时；
- 明确勾选：调用严格单参数 `--uninstall-restore-english`，完整执行 English 事务并清理由 manifest 或当前包 hash 证明归属的 generic/QPA 文件；
- silent、`/P`、`/UPDATE` 不显示翻译选择并保留翻译；
- Tauri 下一页的“删除应用数据”只删除 Switcher 设置，不触碰 Cavalry JSON、marker、generic、QPA 或语言状态。

这解释了为什么“卸载后仍存在 generic/QPA/marker”不一定是泄漏：当用户选择保留翻译时，它们就是数据面的组成部分。只有用户明确选择恢复英文时，才进入清理事务。

### 缺失 Cavalry 的幂等边界

用户可能先用厂商卸载器移除 Cavalry，再卸载 Switcher。此时恢复入口只在以下条件下幂等成功：

- Switcher state 仍存在；
- `appPath` 非空并能规范化为一个安装布局；
- 该布局派生出的 `Cavalry.exe` 已不存在。

state 缺失、路径为空、存在但不可检查、Cavalry 仍在却无法证明 English、UAC 被取消或清理失败，都必须返回失败并保留 Switcher。不能把“目标不在了”扩成“任何缺证据都算成功”。

## 只删除自己拥有的文件

显式 English 与卸载清理遵守同一条所有权规则：

- durable manifest 证明属于旧 Switcher 的 runtime，可以恢复和清理；
- 当前包 hash 证明属于本构建的 generic，可以清理；
- 未知 generic、未知 recovery entry、漂移代理或厂商更新后的新 QPA，绝不删除或覆盖；
- 厂商已经用新 DLL 覆盖代理时，不能把旧 vendor backup 写回；
- 清理失败保留证据并中止，不用“尽力而为”伪装成功。

这是比文件名白名单更强的约束。路径和名字只说明“像我们的文件”，hash 与 manifest 才说明“确实由我们拥有”。

## NSIS 选项页为何消失

最初的自定义卸载页用下面的条件判断是否显示：

```nsh
IfFileExists "$APPDATA\${BUNDLEID}\state.json" ...
```

Tauri 在主模板很早的位置 include `installerHooks`，之后才定义 `${BUNDLEID}`。预处理证明确认：早期 hook 中的宏不会在未来自动补展开，生成结果仍是字面量 `${BUNDLEID}`。因此文件判断永远失败，自定义页被 `Abort` 跳过；Tauri 的确认页仍保留“上一步”，但返回目标实际不可用。

修复没有继续猜 state 路径，而是回到产品语义：普通交互卸载本来就应始终显示选择；是否有可恢复目标由可信 Rust 入口判断。静默、被动和更新模式只使用 hook 当时已经可得的命令行参数判断。

## 页面文案必须属于控件本身

第一版复选框出现后，说明文字把“下一页删除应用程序数据”的含义写在翻译页。它在逻辑上可解释，在界面上却把两种不同数据混在一起：

- 当前页决定 Cavalry 翻译数据面；
- 下一页决定 Switcher 自己的应用数据。

曾尝试从当前页 Leave callback 启动 `nsDialogs` timer，等待下一页出现后用 `WM_SETTEXT` 修改 Tauri 原生复选框。静态合同通过，但真实 UI 证明跨页改写没有生效，下一页文字保持原样；由于没有给 timer callback 加仪器，不能进一步断言失败来自 timer 销毁、时序还是 HWND 匹配。这个方案被完整删除，没有把“测试绿但实机无效”的代码留在仓库。

最终使用 Tauri 官方 `customLanguageFiles` 扩展点：维护 English、SimpChinese、TradChinese、Japanese 四份完整消息表，保持 Tauri 2.10.3 的 27-key 集合不变，只把 `deleteAppData` 收窄为“Switcher 应用数据（仅 Switcher 设置）”。第一页面则只保留翻译取舍。

经验不是“timer 不可靠”这么简单，而是：谁创建控件，谁就应拥有控件文案；跨页面寻找 HWND 是对错误职责划分的补丁。

## 空白窗口：证据不足时不制造产品根因

一次真实 Cavalry 窗口出现菜单仍在、中央内容几乎全黑、dock/panel 消失的状态。只看时间顺序，很容易归因于翻译注入或新包。

现场证据支持的是另一层事实：

- Cavalry 没有崩溃，日志仍正常写入；
- 翻译 runtime 当时是完整 ACTIVE，而不是 English restore 后的半残留；
- `%LOCALAPPDATA%\Cavalry\workspace.json` 持久化了与截图尺寸一致的精简工作区状态；
- Cavalry 官方 Focus Mode 的行为与“只剩 viewport/toolbar”吻合；
- 没有日志能证明是用户操作、快捷键、Cavalry 自身还是测试启动触发了模式切换。

因此本次没有声称“翻译 DLL 导致空白窗口”，也没有为一个未证明的因果修改产品 injector。真正落地的是检测边界：Windows disposable live 检查在运行前、运行结束和 cleanup 后逐字节比较真实用户的 `workspace.json`，测试使用隔离的 Qt profile，并在发现改写时失败并保留证据。该守卫不阻断实时写入，也不自动恢复用户文件；它保证污染不会静默通过，发生差异时仍需人工恢复。

## 被拒绝的路线

| 路线 | 为什么拒绝 |
| --- | --- |
| 让用户手工删/改名 marker 后刷新英文 | 可临时解锁单机，但绕过产品状态机，不能成为开源项目修复 |
| marker 与视觉冲突时直接相信视觉 | 视觉不能证明 38 份 JSON、QPA、generic 与 recovery 的完整状态 |
| 卸载时无条件删除 generic/QPA | 破坏“卸载 Switcher 但保留翻译”，也可能删除未知或厂商更新文件 |
| 用旧 vendor backup 覆盖当前 QPA | 厂商更新后可能把旧 2.7.2 文件写回新安装，属于不可接受的降级 |
| 卸载开始后弹 Yes/No/Cancel | 决策出现太晚，语义与向导页面割裂，也使静默/更新路径更难推理 |
| 在翻译页解释下一页 app-data | 用户必须跨页记忆含义，两个数据域被混成一个选择 |
| 用 page timer 跨页改原生控件 | 真实 NSIS 生命周期已证明不生效，且依赖脆弱的 HWND 查找 |
| 真实 Cavalry 验收复用用户 workspace | 即使功能通过，也可能留下不可见的持久化副作用 |

## 验证证据

本次修复使用分层证据，任何一层都不冒充另一层：

- 状态机与所有权：Rust 单元/集成合同覆盖 stale marker、Recover/Stock、unknown generic/QPA、旧 manifest、缺失安装和 rollback；
- 打包合同：Node 合同锁住早期宏不可引用、四语 `customLanguageFiles`、silent/passive/update 与精确单参数入口；
- 生成物：真实 NSIS 构建通过，生成的四份语言文件都包含收窄后的 `deleteAppData`；
- 实机 UI：English、简体中文、繁体中文、日语四种 installer language 均打开卸载器并验证第二页复选框文本；没有点击“卸载”；
- 页面视觉：第一页只出现翻译复选框和保留说明，第二页只解释 Switcher 应用数据；行距与单行容纳经截图检查；
- 用户状态：安装器仅以 `/UPDATE /P` 更新用于手测，未删除 Cavalry；测试后恢复 installer language，并确认没有遗留测试卸载器进程；
- 发布合同：0.6.1 已同步到 npm、Cargo、Tauri 和两份 lockfile，版本/发布元数据检查通过；
- 自动测试：Windows 可执行的 165 项 Node 合同全通过，完整 Rust 测试通过。完整跨平台 Node 聚合在本机唯一失败是 Windows 无权创建 macOS acceptance 使用的符号链接（`EPERM`），尚未进入被测逻辑，需由 macOS CI 验证。

## 同类问题的排查顺序

遇到“界面语言和 Switcher 状态不一致”时，按下面顺序取证，不要先删文件：

1. 固定 Cavalry 安装根和 `Cavalry.exe` 身份；
2. 检查 38 份 JSON 是否逐键匹配 packaged English 或目标语言；
3. 读取 marker，只把它当作事务声明；
4. 对根 QPA、vendor backup、proxy、generic 和 manifest 做 hash/phase inspection；
5. 区分 `Stock`、`Recover`、`Active`、`Drifted`，不要只看根 DLL 文件名；
6. 判断是只读状态投影、需要 reconciliation，还是必须 fail closed；
7. 所有写入走正常事务，不单独“修 marker”；
8. 另行检查 Cavalry workspace、登录态和用户配置，避免把用户状态问题混入语言状态机；
9. 自动合同通过后仍打开真实生成安装器或 Cavalry 表面，验证生命周期与布局。

## 长期维护结论

- 声明不是现实：marker、state、manifest 都必须由磁盘内容和 hash 反证。
- 保留是功能：卸载控制面后保留用户选择的数据面，不应被误判为清理失败。
- 清理需要所有权：无法证明是自己的文件，就不能删。
- 状态查询不做修复：只读投影与事务收敛必须分开。
- UI 文案跟随控件：不要用跨页提示或 HWND 补丁掩盖职责错位。
- 实机证据高于静态猜测：静态合同无法证明 NSIS page lifetime，也无法证明 Cavalry workspace 没有副作用。
- 不知道就写不知道：未知因果应转化为隔离守卫和下一次可取证入口，而不是仓促修改无辜模块。

若 0.6.1 后续发布为公开 Cavalry 补丁包，按现有协议使用下一序号 `cavalry-2.7.2-p5`；内部 SemVer 与公开 Cavalry patch tag 继续保持分离。
