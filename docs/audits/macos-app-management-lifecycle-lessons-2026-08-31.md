<!--
[INPUT]: 依赖本机 macOS 27 SecurityPrivacyExtension 的只读本地化/符号复核、Apple SystemPolicyAppBundles 文档、公开 p5 tag、当前 renderer/Rust/AppKit 权限链与匿名参考的服务边界
[OUTPUT]: 对外提供 App Management 首次授权生命周期、首次 handoff 必须早于 Cavalry mutation 的边界、脚本入口外置签名组件的真实语义、系统/Updater/Cavalry restart 区分、fresh-session 决策及可复用调研方法
[POS]: docs/audits 的权限生命周期与签名副作用复盘；实施账本引用本文的通用结论，本文不驱动运行时，不把其他 TCC service 的行为类推为 App Management 事实，也不把精确旧残留清理扩大为通用签名修复
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
-->

# macOS App Management 生命周期经验复盘 — 2026-08-31

## 1. 最终结论

“macOS 权限”不是一种统一生命周期。不同 TCC service 的生效时机不同：

- Accessibility、Screen Recording 等参考链路可以在当前进程中查询或验证授权结果；
- Switcher 修改 `Cavalry.app` 使用的 `SystemPolicyAppBundles`（App Management）要求正在运行的 Switcher 先退出，新授权才生效。

首次启用 App Management 时，System Settings 提供：

- `Quit & Reopen`：系统提供“退出并重新打开”动作；静态证据证明动作语义，是否在当前系统上成功重开仍需 packaged live 确认；
- `Later`：当前 Switcher 继续运行，但新权限尚未对它生效。

项目采用最短路径：若系统成功重开 Switcher，它就是新会话并显示普通首屏；不恢复旧 Activity，不持久化 `pendingAction`，不自动修改 Cavalry。用户重新选择后，再执行 Switch / Restore。

## 2. 证据链

### 2.1 Service identity

本机 `SecurityPrivacyExtension` 的 `TCCServiceList.plist` 将：

```text
Privacy_AppBundles
→ kTCCServiceSystemPolicyAppBundles
→ APPLICATION_BUNDLES
```

Apple 将 `NSAppBundlesUsageDescription` 与 `SystemPolicyAppBundles` 对应，用来控制 App 更新或删除其他 App bundle。权限判断仍以真正需要的受保护写事务为 oracle，不伪造只读 Granted 状态。

### 2.2 本机系统资源与符号

复核环境：

```text
macOS 27.0 / 26A5416b
/System/Library/ExtensionKit/Extensions/
  SecurityPrivacyExtension.appex/
```

`Localizable.loctable` 的英文真相：

```text
APPLICATION_BUNDLES_QUIT_ALLOW_TITLE
  “%@” will not be able to update or delete other applications until it is quit.

QUIT_DESCRIPTION %@
  You can choose to quit “%@” now, or do it on your own later.

QUIT_APP   = Quit & Reopen
QUIT_LATER = Later
```

同一资源含简体中文、繁体中文与日文投影；可执行文件还包含：

```text
quitRunningApplicationIfNeeded(_:locNameKey:)
quitRunningApplication(with:enabled:path:locNameKey:)
runningApplicationsWithBundleIdentifier:
```

这些证据证明 App Management 会处理正在运行的被授权 App，并明确提供系统退出重开分支；它们不能单独证明按钮在所有环境中都必然成功重新启动目标 App。

### 2.3 项目与公开 Release

公开 `cavalry-2.7.2-p5` 和当前源码都没有权限驱动的 Switcher self-restart：

- 权限入口只打开 `Privacy_AppBundles`；
- renderer 的 Retry 只重放 `apply_language`；
- 唯一 `app.restart()` 位于 updater 安装成功路径；
- `restart_cavalry` 只打开 Cavalry。

所以首次重开是系统行为，不是项目主动 restart。

### 2.4 首次拒绝必须早于 Cavalry mutation

旧链路把 App Management 当作“写失败后才知道”的 oracle：用户点击 Switch 后，事务已经进入 Cavalry bundle，`codesign` 也可能先为脚本入口生成 `_CodeSignature/CodeDirectory`、`CodeSignature`、`CodeRequirements`，直到后续受保护文件操作返回 `PermissionDenied`，UI 才打开权限 handoff。于是用户视觉上仍处于“获取权限之前”，bundle 却可能已经承受了可回滚的中间签名副作用。

这三个文件本身不是恶意内容，也不妨碍处于 Switcher managed runtime 的翻译注入；当 `Info.plist` 将 `CFBundleExecutable` 指向脚本 launcher 时，它们是 `codesign` 为外置脚本代码生成的合法组件。真正的缺陷是边界不完整：旧 rollback/official restore 恢复 vendor `Info.plist`、原生可执行文件与 `CodeResources` 后，没有同时删除这三个只属于 managed script entry 的组件，最终被 `codesign --verify --deep --strict` 判为 `unsealed contents present in the bundle root`。

当前修正遵循两个正交原则：

1. 首次受支持安装在任何 Cavalry mutation 和业务 phase 前进入 handoff；只在 Switcher 自身 state 目录记录“已展示”，不写 Cavalry、不声称 Granted。用户从设置返回后，完整 durable transaction 仍是唯一权限 oracle。
2. 三个外置组件进入 signing side-effect journal、回滚和官方恢复；兼容旧残留只在 clean vendor runtime 且 `_CodeSignature` 精确包含 `CodeResources + 三个非空 regular 文件`、不存在任何额外成员时执行。未知签名异常仍 fail closed，禁止演变为通用 codesign 修复器。

## 3. 四种容易混淆的“重启”

| 名称 | 主体 | 生命周期 | 产品处理 |
| --- | --- | --- | --- |
| App Management `Quit & Reopen` | macOS System Settings | 首次启用/变更权限 | 若系统成功重开，则为普通新会话，不续跑旧任务；成功重开待实机确认 |
| `Later` | 当前 Switcher | 用户暂不退出 | 当前进程仍无新权限；Activity 提示重新打开，不自动或手动续跑旧任务 |
| Updater `app.restart()` | Switcher updater | 新版本安装完成 | 与权限无关，保留 |
| `restart_cavalry` | 语言事务 | 写事务完整成功 | 打开 Cavalry，与 Switcher 权限无关 |

UI、代码、测试和文档必须说明动作主体，不能只写模糊的“restart”。

## 4. 被证伪的路线

### 4.1 把其他 TCC service 的行为套到 App Management

匿名参考的 Accessibility / Screen Recording 链路存在：

```text
requestAccess → validateAuthorization → reverse/cleanup → granted
```

它证明参考动画和 coordinator 结构，不证明 `SystemPolicyAppBundles` 也能在原进程立即生效。TCC 是权限家族，不是单一协议；每个 service 都要独立验证目的键、系统提示、生效时机和进程生命周期。

### 4.2 只搜索项目 restart 调用

项目没有 `app.restart()` 不能推出 Switcher 不会重开。操作系统提供终止并重新打开 App 的动作；必须同时检查官方定义、系统本地化资源、系统符号与真实运行，且不能把按钮文案直接升级为已验证的成功重开。

### 4.3 为视觉连续性持久化旧操作

把 `pendingAction` 写入 localStorage、`state.json` 或启动参数，会引入 stale intent、安装路径/版本漂移、普通退出与系统重开的来源辨别、过期/消费/回滚和重复执行协议。这里没有足够用户价值支撑这些复杂度；fresh session 是 KISS/YAGNI 决策。

### 4.4 合成“已获得权限/继续任务”

权限开关、file-URL drop 和 handoff 动画都不是业务成功。唯一可信证明是受保护写事务成功。drop 后允许一次同进程真实 oracle；若仍拒绝，Activity 显示“重新打开语言切换器”，清理 helper，不再提供 Retry，也不插入 `resumeAfterPermission`。

## 5. 可复用调研方法

1. 锁定具体 TCC service identity，不要只说“macOS 权限”。
2. 读官方保护对象、purpose key 与设置页定义。
3. 读系统本地化资源；标题、按钮和说明直接表达用户生命周期。
4. 读系统实现符号；确认 quit、reopen、request、validate 是否存在。
5. 查项目与 Release 源码；区分系统行为和产品主动行为。
6. 参考实现只迁移同一 service 中被证明的语义；视觉参数与权限生效机制分开。
7. 静态、原型、原生 harness、packaged live 各自只声明自己的证据等级。

## 6. 当前决策与验证债务

当前决策：

- 不新增权限专用 Switcher restart command；
- 不改变 updater 的唯一 `app.restart()`；
- 不持久化权限前的 Switch / Restore 意图；
- 不在新会话恢复旧 Activity；
- 不显示“权限已验证”或“继续刚才的任务”；
- Later 分支在同进程 oracle 仍拒绝后只显示重新打开提示，不继续 Retry；
- 工作台将 Quit & Reopen 建模为 fresh-session 投影，但不冒充系统已成功重开；
- native App row drag snapshot 排除兄弟 `NSBox` 的边框与背景。

仍需 packaged live 验证：首次授权系统提示、`Quit & Reopen` 是否成功产生新 Switcher 进程、重开后的普通首屏、再次手动 Switch/Restore 成功，以及 Later 后重开提示不产生伪成功。
