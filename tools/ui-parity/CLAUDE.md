# tools/ui-parity/
> L2 | 父级: ../CLAUDE.md

run.js: 从指定 main commit 导出只读 renderer/审查夹具，运行同一组黑盒用例，对比像素、几何及可观察状态；产物必须写仓库外。
driver.js: 两种实现共用的浏览器输入、时钟、桥调用记录、状态与截图投影；不读取 SDK 内部实现。
cases.js: 基于 main 行为的组件、任务、权限和本地化用例及基线断言；实现不得自行放宽。

基线副本只供测试，不作为应用构建来源。浏览器通过 devDependency Playwright 驱动，不进入 App。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
