# renderer/
> L2 | 父级: ../CLAUDE.md

成员清单
index.html: 跨平台静态 DOM 骨架，固定安装信息、macOS 官方/受管安装态、仅含三种目标语言的原生选择、英文恢复/英文快照按钮、独立官方还原、状态标签与 modal 权限弹窗锚点；只加载本地资源。
styles.css: 唯一样式源，定义系统字体下的窗口布局、统一按钮、英文恢复/官方还原入口、权限弹窗、状态面板、原生 select 与视觉 token。
app.js: 唯一交互源，按系统语言本土化 UI，调用冻结的 `window.cavalryI18n` 完成跨平台状态读取、安装位置选择、只读刷新 English 快照、显示 Windows typed residue warning、通过现有普通 apply `en` 事务恢复英文、English UI/翻译应用与独立官方还原确认及权限等待态；English refresh 不关闭 Cavalry、不触发 UAC、不执行 apply 或安装事务恢复；英文快照未可信存在、干净英文态或控件被阻断时禁用英文恢复，Windows 即使资产已是英文但仍有 typed runtime residue 时保留显式恢复入口；macOS `modifiedOrUnverified + needsExtract` 表示原始 English provenance 不完整，禁用 extract/apply/official restore、直接显示四语官方重装并重新选择安装位置指引；所有 warning 只消费可组合 `warningCodes` 并逐项本土化，禁止显示 raw warning prose。`stateDurabilityPending` 时仅保留 Refresh English，成功 no-op durability reconfirm 后才解锁其他 mutation controls。所有写入均经普通“应用并重启”事务，transport 拒绝以本地化状态恢复。
tauri-bridge.js: 非视觉兼容桥，在 `app.js` 前定义最小冻结 API；归一化 camelCase payload、稳定 `warningCodes`、Action/Status 的 typed `reconciliationRequired` 检测结果、平台/官方或受管安装态与权限动作，不提供独立 runtime reconcile API，丢弃 raw warning，并以固定四语/告警 code manifest 拒绝资源目录或后端原文驱动 UI。
ui-text.js: 稳定的 English/简体中文/繁体中文/日文 renderer 文案目录；作为非模块脚本在 `app.js` 前加载，保持本土化 copy 与交互状态机分离。

依赖边界:

renderer 不知道 Tauri command 或 `.app`/`.exe` 布局；它只依赖 `window.cavalryI18n` 兼容 API。Tauri bridge 与 `ui-text.js` 必须在 `app.js` 执行前注入，并只转发 renderer 真正消费的平台中立状态字段；Node VM 只验证生产源语义，packaged WebView/CSP 属于独立外部门。

法则: UI 真相源冻结·bridge 只能非视觉·DOM 锚点不漂移

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
