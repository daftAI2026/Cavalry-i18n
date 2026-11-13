# acceptance/
> L2 | 父级: ../CLAUDE.md

成员清单
plugin-actions.json: 12插件字段、条件、枚举源索引与共享字段位置；补既有文本目标动作，不扩静态库存为实屏矩阵。
plugin-acceptance-scope.json: 按主账裁决列出69个插件实屏源键；全部324键保留库存；未批准的255键不构成实屏case。
run_flow.py: Python双平台编排；以run占位符绑定跨步骤回执；即时采集、分段计时与收尾；要求回交的计划拒绝直接实跑。
test_run_flow.py: 编排离线自测；验证即时采集、异常收尾与回交门，按本机Path身份核路径、显式UTF-8读证据。
DRIVERS.md: 成功入口、原厂Graph MIME/选择接线及平台生命周期路由；不新增跨显示器验收门。
README.md: 整轮单表、平台回交入口及存放规则；明确工具与实屏验收边界。
masters.js: 固定44主项ID与平台归属；G-2保留历史下载，G-3核统一更新入口，不复制动态完成状态。
scenarios.js: 可观察行为与场景顺序；Cavalry三语事务与Switcher四语分开，同语共享动作，故障及实验启动单列。
catalog.js: 分离源库存、场景观察索引与实屏case；保留冻结v1及旧schema2视图。
checklist.js: 按路径段区分仓内副本与Windows跨卷仓外输出；生成schema2副本、记账并核验三段scope身份链，不启动产品。
migration.js: 验证冻结v1与ToolHelp父链；归档原件与逐项crosswalk。
scene-scope.js: 显式修订195个未填展开项；保留观察索引，以15个父场景核Timeline。
scene-scope.test.js: 临时表核父链、原件与全部历史；拒绝已填结果转库存。
checklist.test.js: path.win32覆盖跨卷及runs边界；临时目录验证库存、scope链、FAIL拒绝与归档篡改，不执行GUI。
dependency_graph_fixture.py: 从skill六名称原生CV asset确定性派生自有DG fixture、六个共享case/expected与run_flow未绑定模板；不运行Cavalry。
test_dependency_graph_fixture.py: 临时目录核六名称/ID/结构、无外部asset、源文件不变、输出确定及平台命令待绑定。
local/handoff_windows/: Windows接手包、D-6/G-5/G-3/G-6任务单与源SHA打包器；只含安全文本差异、公开工具和离线平台夹具，不含Mac私档。

本地忽略目录：runs/保存填写副本与证据；local/保存私人方案与驱动索引。

依赖方向：表单工具读取正式源；产品与构建不依赖验收副本。
历史GUI驱动由验收人绑定；表单生成不代表这些驱动已自动串接。

## schema2 插件库存与验收范围

`session.json`保存完整插件与ToolHelp source-key inventory。
插件inventory保留324个源键与工具文本；ToolHelp inventory保留66键×3语种。
两类inventory保留源指纹和稳定ID，且不带结果、证据或勾选状态。
`plugin-acceptance-scope.json`只批准69个插件源键进入实屏case。
批准规则来自C-3代表字段、名称、有限插件和条件帮助范围。
Group、Null和继承字段仍沿独立case路线。
插件面板场景、帮助和Guide范围不变。
Timeline原六名五态双表面范围不变。
180个细格只作15张整窗图的观察索引。
屏外不授字形信用；裁切不越界。
身份、全文与Measure/Draw沿原锚点核验。
Null原范围是Shape页签与继承Opacity。
误加的属性、说明与枚举15行只保留源库存。
ToolHelp只由Select、Edit Shape、Mesh与Pivot四个现有动作各三语验收。
93条库存行只引用所属动作；105条没有已批准消费者观察。
源键inventory不复制组case结果，也不扩成逐键实屏case。

schema1整轮表不会由`check`或`record`静默改写。
审阅新范围后，执行一次显式迁移：

```sh
node tools/acceptance/checklist.js migrate --out '<已有schema1整轮目录>'
```

迁移只接受冻结v1源指纹和完整历史。
迁移把原`session.json`、`CHECKLIST.md`和`attempts.jsonl`字节归档到`scope-migration-v2/original/`。
`crosswalk.json`把旧case逐项映射到schema2 case或inventory。
迁移不新增case，不改写失败结果，不自动勾选。
未知源、损坏记录、既有交接账或非冻结v1版本都会拒绝迁移。
迁移命令只应在审阅后的目标副本执行。
当前正式整轮目录不得用作测试目标。

冻结schema1全平台目录含3786项。
macOS选中3773项，另13项属于Windows与发布平台。
ToolHelp修订前全平台schema2有3021个case。
ToolHelp修订前macOS schema2有3008个case。
修订后全平台schema2保留2823个case。
修订后macOS schema2保留2810个case。
765个插件细项与198个ToolHelp行转入inventory和crosswalk。
迁移保留两类原ID、状态、证据、attempt索引和旧表字节。

冻结schema1迁移直接生成新scope。
现有旧schema2目录使用`amend-toolhelp`显式迁移。
新归档独立于`scope-migration-v2/`，不改写旧链。
验证旧链时，先读scope amendment归档的父session字节。
父scopeMigration摘要、crosswalk、新输出SHA必须一致。
ToolHelp失败历史未修复时，迁移拒绝且保留原表。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md

## 父场景范围修订

当前全平台schema2为2643个case，macOS为2630。
195个原ID保留在sceneInventory，不带结果。
新轮直接生成15个Timeline父场景。
旧轮先完成原迁移，再显式执行：

```sh
node tools/acceptance/checklist.js amend-scenes --out '<已有schema2目录>'
```

修订归档三原件与crosswalk，不覆盖旧归档。
转出项必须PENDING，且没有attempt。
15个父场景初始仍PENDING，不继承父组PASS。
保留的case状态与全部attempt字节不变。
检查器递归核原schema1与ToolHelp父链。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
