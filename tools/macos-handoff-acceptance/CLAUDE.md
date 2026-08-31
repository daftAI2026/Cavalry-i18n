# macos-handoff-acceptance/
> L2 | 父级: ../CLAUDE.md

成员清单
record_checkpoint.js: packaged App Management handoff 的只读证据记录器；同时冻结 Switcher、Cavalry 当前 launcher 与真实 Mach-O runtime 身份，在仓库外 session 按 baseline→阻断→helper→人工分支→真实结果→收口的固定场景顺序记录 WindowServer 几何与仅 Switcher 自有窗口截图，并以 seal/verify 闭合所有身份，不触碰 TCC 或代替人工拖放。
window_probe.swift: AppKit/CoreGraphics 现场探针；输出单调时钟、Reduce Motion/Transparency、显示器 point/backing-scale、前台 bundle 与 Switcher/System Settings 可见窗口几何，不读取权限行内容或截取系统设置像素。
check_contract.test.js: 记录器静态安全合同；锁定阶段枚举、仓库外 session、只截 Switcher PID、无 TCC/AX/输入合成及 GEB 契约。

依赖边界
- 复用 `macos-acceptance/path_safety.js` 与 `artifact_identity.js` 的路径和身份原语，不另造第二套证据哈希规则。
- session、PNG、checkpoint 与 seal 只能写到仓库和两个 app bundle 之外；仓库只保存 producer、合同和运行说明。
- System Settings 只记录无标题窗口元数据；真实权限开关、拖放、拒绝和返回必须由独立测试用户手工完成。

法则: 人工授权·只读取证·身份闭合·不拍系统隐私内容

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
