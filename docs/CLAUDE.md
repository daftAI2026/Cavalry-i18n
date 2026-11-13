# docs/
> L2 | 父级: ../CLAUDE.md

成员清单
upstream-version-monitor.md: 官方稳定版本每日监控SOP；native target基线、全状态issue去重、dry-run/写入及失败处理；不授新版兼容信用。
acceptance-workflow.md: 整轮单表、库存与实屏范围、显式迁移、失败复验及Windows源SHA交接、未接驱动和平台独立规则。
cavalry-glossary.md: Cavalry四语术语表，按数值/图像区分Add与Multiply、HSV/普通Value、文本Line/几何端部/描边Round/Flat/Projecting（Adobe分产品的合法同義詞不机械判错）、布局Wrap/数值倍率/Oklab及物理Still/Fixture/Body；Knot采用起始方向并记录原notes歧义，不接永久先画段提案；Transform日文/繁中與Extrude的成熟软件合法替代词与项目首选标签分开归因，地区译名与项目选择分开归因，原厂说明冲突沿sourceCorrections复核，字体/品牌/模型/API身份不改。 Combine/Merge现代詞形與並字合法释义分界、Stepped Next下一关键帧功能证据防止词典式误判。 Row/Column地区轴词与日文minutes分数合法用法分界，繁中Stroke筆畫的台湾成熟软件用法与项目描邊首选不混为功能错误；Scale倍率不套几何禁词，Fade/Fill All/With/通道映射按数值与对象角色限定。
runtime-ui-live-capture-workflow.md: 同时区分时间轴用户名称字体覆盖与界面翻译、两平台独立 ABI 和无逐帧诊断落盘； Runtime UI live 抓取流程，Windows 启动状态 marker 与显式绘制计数采样分离，区分调试/安装包启动路径、Cavalry 窗口截图证据、`widgetAt(cursor)` 坐标反查、Qt item model dump、JSON 数据层复用、ModalDialog 诊断、闪烁根因分类、注入后中文 session、英文 dump-only 基线与 ExtensionLayer 平台精确边界（QLineEdit 只翻译 `placeholderText`；实际名称/查询值含只读、parentless/重挂接保持原文；未经采证的 model DisplayRole 风险仍独立处理），并规定全量复抓、增量修复、coverage 对比路径。
runtime-translation-noise-triage.md: Runtime 翻译噪声分诊协议，定义短 token provenance 证据等级、quarantine 决策、live capture 对准步骤与 Time Editor niceName 保护线。
translation-guidelines.md: 图形/动效语境规范；明确空区域短提示简繁日不加末尾句号、英文source不动，排除文本输入框、tooltip、帮助、错误与多句说明；有限合同锁真实producer，不做运行时裁剪；保留日语来源纠错、100个demo DNT显示例外、身份保护与caption证据边界。
component-source-adaptation-protocol.md: 语言补丁更新徽章的绿色语义、菜单/选中值共享投影及 active/selected 状态边界； 开源组件源码适配知识基线，定义 Design token、组件行为与业务三层所有权；锁定 shadcn Button/Marker/Select/Tooltip/AlertDialog/Toast commit、Base UI 1.6.0 Toast、shadcn 4.19.0 utility 与 Phosphor commit，并规定 Button/业务 variant 分层、Windows transparent-compositor 外壳、四枚 caption、平台 UI Review 同步、DPI 与视觉/静态/真机证据边界及 GEB 回环。
img/: 静态资源库，存放 README 截图与文档示意图。

依赖边界:
docs 只保存公开项目必须依赖的稳定规范、可重复 SOP 与发布资产，不承载内部事件簿、阶段审计、实跑记录或历史方案。任何架构变更必须先让代码成立，再让这里的地图同构。

分类口径:
规范与可重复 SOP 留在公开 `docs/`；README 图片进 `img/`；发布徽章直接读取 GitHub 最新正式 Release，不保存本地版本副本。研究、路线、事件簿、实跑证据、事故复盘和历史方案进入同级私有知识库，并按工作链组织；公开构建、测试和发布不得依赖私有内容。

UI 知识归属:
可迁移的组件源码适配、所有权和证据规则归 `component-source-adaptation-protocol.md`；当前 UI 几何由 `renderer/tokens.css` 与组件实现自证。阶段审查和下一动作属于私有维护链，不在公开文档中复制。

法则: 面向项目·稳定公开·过程内收·限制不粉饰

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
