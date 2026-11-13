<!--
[INPUT]: 依赖历史驱动索引、当前候选和平台验收计划。
[OUTPUT]: 提供驱动复用边界、生命周期入口与采集顺序。
[POS]: 验收驱动路线图；不声明所有历史脚本已自动串接。
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
-->
# 历史驱动接续

本表是脚本复用路由，不是“所有驱动已经自动串接”的声明。
私人脚本原件索引放 `local/`，不进入公开构建依赖。
复制原件时保留来源和摘要；固定旧候选的脚本不得直接跑新候选。

## 复用范围

保留成功脚本的动作；仅替换本轮必需的输入绑定。
候选指待测 App 与运行库，不指新增平台。
绑定候选是防止测错 App，不要求无变更时重验已过项。
固定坐标是旧驱动的使用条件，不是跨显示器验收门。
只在本轮屏幕布局确实改变时校准所需动作。
不增加全显示器矩阵，也不预先泛化全部历史脚本。
产品变更或确证回归时，只重开受影响子项。

| 场景 | 已验入口 | 接续边界 |
| --- | --- | --- |
| Twist枚举/提示 | run-combined-language.root.py | 同面板接node tooltip；替换旧输入绑定后才能执行 |
| 插件节点说明 | run-node-tooltip.root.py | 复用动作，不重复跨语言switch wrapper |
| 其他插件 | approved-plugin-targets.json + request.py | 标签、枚举、条件提示及nodeInfo同面板完成 |
| 六名五态 | run_six_name_matrix.py | keep-alive接run_quality_toolhelp.py；helper不算正常首帧 |
| 已存工程 | run_loaded_fixture.py | resume-pid要求兼容helper；自动Quit必须放批末 |
| Dependency Graph六名 | dependency_graph_fixture.py + 外部F2只读host/client | 自有CV由skill原生asset确定性派生；共享六case；计划动作待各平台绑定 |
| 普通首帧 | f4_normal_capture.py | 启动前采集；同PID继续菜单，不先刷新 |
| 菜单计时 | run_menu_pair.py | 旧入口仅en/Hant且固定路径；不可假称三语通用 |
| Guide | 已成功完整Animation/Connection/Behaviour入口 | 每语完整路径；不用before/diagnostic失败入口 |
| 根帮助 | run-main-root-batch.py | 同编辑器384根；17 Def单独实验启动条件 |
| 官方示例 | 成功AX菜单路径 | 不使用失败的Qt menu探针；100菜单与两示例实跑分账 |
| 包生命周期 | run-g4-lifecycle-batch.py | 已完成阶段跳过；production owner不得借preview回执 |
| 离线显示审查 | 项目skill/scripts/verify_visible_text.py | 已有OCR输入，不重新启动产品 |

## 整批生命周期入口

声明`profileHandback`的计划必须经平台生命周期入口实跑。
macOS同语helper入口为`local/adapters/run_owned_flow.py`，命令见README。
入口在启动前快照偏好与独立workspace，批末关闭本轮exact PID。
退出未证实时不回交配置、不标记整批完成。
普通语言事务通过产品Apply/Restore回交，不复制owner或偏好原字节。
通用`run_flow.py`只编排命令，不自动承担平台配置回交。

## Windows接手边界

Windows接手包见`local/handoff_windows/README.md`。
Windows夹具只供`run_flow.py --check`验证计划结构。
当前文档中的历史Mac入口只作来源参考，不是Windows动作。
Windows动作缺失时，必须由Windows驱动实现或人工执行。
不可把Mac路径、AppleScript或Swift可执行文件接为Windows命令。

## 每次操作的读取与采集时机

| 操作组 | 就绪依据 | 一次读取 | 采集后继续 |
| --- | --- | --- | --- |
| 切语/启动 | 事务终态、实际新PID和目标locale | Activity、回执、实际资源与运行库 | 首帧采集预先开始；不先刷新或开菜单 |
| 菜单/枚举 | 本次目标菜单或popup实际可见 | owner、完整选项、选前值；选择后读实际值 | popup可见即截图；选后读回即截图；组末恢复 |
| 字段/节点提示 | 本次hover对应popup及全文已返回 | 完整文字、字段/节点归属、popup边界 | 立即截原图，然后移到下一目标；OCR后置 |
| 插件面板 | 正确插件与同一面板父链 | 标签、值、可用状态和条件字段 | 同面板连续枚举/提示/说明，最后恢复字段 |
| Guide | 本步标题/正文与目标控件实际出现 | 标题、正文、按钮、动作前后状态 | 本页立即截图，按教学动作进入下一页 |
| 六名/质量/工具 | 工程行结构及本次视图或设置已生效 | 名称、质量/AA值、enabled、工具文字 | 每态原图共用；不为字形再重开工程 |
| 搜索/创建 | 当前查询与结果模型对应；创建后行数改变 | 查询、可见结果、选中项与实际type | 清空前截图；原文输入不改写 |
| 保存/重开 | 实际保存面板或重开工程已出现 | 标题、文件路径、重开后的六名与身份 | Cancel不算Save；借真实保存链完成持久化检查 |
| Switcher窗口 | 目标窗口与真实后端状态就绪 | 文案、控件状态、尺寸与窗口坐标 | 连续拖动过程采集，不用两个端点截图替代 |
| 恢复/故障 | 实际错误或恢复事务终态 | 原始失败、资源/locale/owner终态及保全情况 | 先封存再恢复；不得盲目重发已提交事务 |
| 性能 | 已开始外部采样且目标进程就绪 | 同源时钟、可见帧、CPU/RSS/IO | 保留原观察时长；录像离线分析，不重复播放 |

同步读取完成即可继续，不添加固定截图延迟。
异步控件按明确后态短轮询；超时记录实际未就绪对象。
只有为判定所需的读取进入动作热路径。
OCR、全文比较、摘要汇总在采集批次后执行。

## 场景顺序

1. 离线身份、批准源、合同、可复用证据一次准备。
2. 正式包首次Apply前检查stock状态。
3. 当前目标语言正常Apply、首显、首次菜单、正常性能段。
4. 同语六名、保存重开及其余兼容正常场景。
5. 必须helper的场景集中在同语兼容批，不混入性能段。
6. 完成该语后换下一语，不按插件来回切三语。
7. Def实验偏好、故障恢复与窗口壳四语分别按前提合批。
8. 包移除保留、重装、English恢复及stock对照。
9. 回交、一次归档、限域清理，再检查整表并收口。

表单分组是检查索引，不是可以盲目顺序执行的命令。
共用动作不共用结论，每个细项必须有自己的判定。
成功脚本有输入假设；缺适配时记录缺口，不重新发明成功链路。

## Dependency Graph字体补验

固定fixture、expected和六个case由外部工具生成；不使用Cavalry内部Script菜单或JavaScript API生成、重命名或保存场景：

```sh
python3 tools/acceptance/dependency_graph_fixture.py --out '<新run目录绝对路径>' --locale zh-Hans
```

工具只从项目skill的`timeline-six-names.cv`复制固定节点结构，并改写六个自有`niceName`和composition名称。
输出包括`fixture/dependency-graph-six-names.cv`、`expected.json`与`plan.template.json`。
fixture保留六个固定`javaScriptShape#1`至`#6`节点、默认椭圆表达式和连接；名称及机器type分开记录，外部资源与引用保持为空。
源asset有固定SHA；变更后须审阅并更新绑定，不能改用来历不明的CV附件。

一语一份输出；三语共用同一CV结构和六个case，只按locale给出类型行预期及截图文件名。
步骤为初始两行文字、ASCII对照、长名省略、同节点原生改名、标准Save/重开持久性、Timeline/Viewport同名回归。
每个case单独记录读回目标、像素预期、采集目标和PNG名；输入清单只说明预期，不自动给PASS。

`plan.template.json`沿用`run_flow.py`的step字段和命令映射。
macOS与Windows的`action`、`capture`命令数组故意为空；未绑定时`run_flow.py --check`应失败，不能填虚构可执行路径。
绑定真实平台动作后，仍须经声明`profileHandback`的实际平台生命周期入口运行。
外部runner应正常打开本轮CV副本，通过真实菜单/Qt动作显示Dependency Graph，并使用外部Qt host完成界面库存与F2只读全文回读；不要读DisplayRole冒充像素。
重命名、Save和重开走Cavalry标准界面；截图按exact PID/窗口单图采集，再离线审图和记录。

macOS可复用外部F2的`inventory`与`readFixtureRow`协议，但本模块不捆绑runner、host二进制或私有会话路径。
Windows目前只有共享fixture与case定义，尚无Windows动作驱动；Windows实跑前必须绑定并验证其自身host、窗口采集及生命周期入口。
未绑定的菜单动作、读回或清理保留为待办，不把macOS驱动映射成Windows PASS。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
