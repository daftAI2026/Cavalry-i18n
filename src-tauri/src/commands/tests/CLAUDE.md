# commands/tests/
> L2 | 父级: ../CLAUDE.md

成员清单
runtime.rs: 验证 Resources 与 `_up_` 候选顺序、macOS injector 定位、Windows generic plugin 的 child-only 环境，以及 apply/restart 在失败前不 spawn 的边界。

法则: 测试通过父级最小 fixture 和 fake runner 观察行为；不得访问真实 Cavalry 安装、GUI 或 UAC。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
