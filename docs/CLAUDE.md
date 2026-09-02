# docs/
> L2 | 父级: ../CLAUDE.md

成员清单
cavalry-glossary.md: Cavalry 四语术语表（en/zh-Hans/zh-Hant/ja_JP），含注释列标注禁用词、Forge Dynamics 显示层例外、Cavalry 版本增量与行业对齐来源。
runtime-ui-live-capture-workflow.md: Runtime UI live 抓取流程，区分调试/安装包启动路径、Cavalry 窗口截图证据、`widgetAt(cursor)` 坐标反查、Qt item model dump、JSON 数据层复用、ModalDialog 诊断、闪烁根因分类、注入后中文 session、英文 dump-only 基线与 ExtensionLayer 平台精确边界，并规定全量复抓、增量修复、coverage 对比路径。
runtime-translation-noise-triage.md: Runtime 翻译噪声分诊协议，定义短 token provenance 证据等级、quarantine 决策、live capture 对准步骤与 Time Editor niceName 保护线。
translation-guidelines.md: 翻译规范，约束语言风格、保留词、快捷键身份原文/操作本地化例外、Forge Dynamics 显示层/模型层分流与界面一致性。
component-source-adaptation-protocol.md: 开源组件源码适配知识基线，定义 Design token、组件行为与业务三层所有权；锁定 shadcn Button/Marker/Select/Tooltip/AlertDialog/Toast commit、Base UI 1.6.0 Toast、shadcn 4.19.0 utility 与 Phosphor commit，并规定 Button/业务 variant 分层、Select combobox 隔离、平台外壳与 UI Review fixture 同步、视觉/静态/真机证据边界及 GEB 回环。
img/: 静态资源库，存放 README 截图与文档示意图。
badges/: README badge endpoint 数据源目录，保存发布 workflow 写回的 Shields JSON 投影。

依赖边界:
docs 只保存公开项目必须依赖的稳定规范、可重复 SOP 与发布资产，不承载内部事件簿、阶段审计、实跑记录或历史方案。任何架构变更必须先让代码成立，再让这里的地图同构。

分类口径:
规范与可重复 SOP 留在公开 `docs/`；README 图片进 `img/`，发布 Badge 数据进 `badges/`。研究、路线、事件簿、实跑证据、事故复盘和历史方案进入同级私有知识库，并按工作链组织；公开构建、测试和发布不得依赖私有内容。

UI 知识归属:
可迁移的组件源码适配、所有权和证据规则归 `component-source-adaptation-protocol.md`；当前 UI 几何由 `renderer/tokens.css` 与组件实现自证。阶段审查和下一动作属于私有维护链，不在公开文档中复制。

法则: 面向项目·稳定公开·过程内收·限制不粉饰

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
