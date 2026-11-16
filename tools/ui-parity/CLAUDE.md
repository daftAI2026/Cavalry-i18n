# tools/ui-parity/
> L2 | 父级: ../CLAUDE.md

run.js: sdk-default运行当前SDK默认组件/业务接线合同；legacy导出指定main做历史像素/状态对照，模式与证据明确分开，产物写仓库外。
driver.js: 两种实现共用的浏览器输入、时钟、桥调用记录、状态与截图投影；不读取 SDK 内部实现。
cases.js: 历史main控件行为对照与仍有效的任务、权限、窗口、手势业务断言。
sdk-default-cases.js: 当前原生SDK的选择/确认/队列/日志/Agent公开API接线验收，含Windows 2.8.1连续切换后清空、禁用期数据同步与进入busy关闭菜单；更新说明覆盖四语、长文轮滚/PageDown、关闭回焦、缺说明/日期、文本安全及单次安装；原生滚动需等待compositor，不能只推进暂停的JS时钟；复用未变业务用例，不再断言旧控件状态机。
benchmark.js: 固定前后Git renderer、同桥/CSP与真实时钟，AB/BA采样启动/交互；独立记录DOM工作量、CDP回收后保留资源与源码体积，不把暂停时钟的像素门当性能数据。
native-benchmark.js: 对两份显式测试App按AB/BA测真实macOS启动与host PID物理内存；要求同后端/工具链和同探针，隔离状态且只读，不覆盖正式App；WKWebView子进程内存不计入host指标。

基线副本只供测试，不作为应用构建来源。浏览器通过 devDependency Playwright 驱动，不进入 App。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
