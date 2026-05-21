<!--
[INPUT]: 依赖 injector/CavalryTranslatorInjector.mm 的 QMenu aboutToShow/ActionAdded/Show 翻译链路、runtime-ui-live-capture-workflow.md 的真实软件抓取流程、英文 dump-only Qt inventory、英文 AX 菜单打开后采样，以及用户对 Composition 菜单闪烁的截图反馈
[OUTPUT]: 对外提供 Composition 菜单 lazy QAction 闪烁问题的经验复盘、证据表、误判修正、已落地修法与后续 guard 建议
[POS]: docs/audits 的 dated runtime 菜单审计记录，沉淀动态菜单项与普通菜单项启动链条不同这一现场经验
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
-->

# Composition Menu Lazy QAction Flicker - 2026-05-21

## 结论

Composition 菜单里的若干项不是普通静态菜单项。它们在菜单打开前只是 Cavalry 预创建的 QAction，占位 title 和 enabled 状态不等于最终显示状态；真正的 title / enabled 会在菜单打开链路里由 Cavalry 临场更新。

因此这些项不能完全依赖“启动后扫描菜单并提前翻译”的普通菜单链路。正确策略是把它们视为动态菜单项：在 `QMenu::aboutToShow`、`ActionAdded`、`Show` 这类菜单打开路径中同步翻译，必要时继续追 `QAction::changed`。

本次已修正一处关键延迟：`aboutToShow` 不再把翻译丢给下一轮 run loop 的 `CFRunLoopPerformBlock`，而是在菜单首次绘制前同步调用 `translateMenuBeforeFirstPaint(...)`。这能消除或显著压低“英文 > 中文”的可见闪烁。

## 现场现象

用户反馈打开 `Composition/合成` 菜单时，以下项会短暂显示英文，然后变成中文：

- `Set Playback Range to Composition`
- `Solo Selection in Viewport`

同一区域还有若干项会短暂像可点击，随后变灰，例如：

- `Pre-Compose`
- `Pre-Compose Based on Selection Bounds`
- `Solo Selection in Viewport`
- `Clear Quicklist`
- `Enable Time Remapping`

英文原版看不出这种闪烁。关键不是“Cavalry 英文版也闪”，而是英文版没有额外翻译层，Cavalry 的内部菜单更新在首次绘制前完成；中文注入如果晚一轮执行，就会把原本不可见的中间态暴露出来。

## 真实软件证据

这次不能只看截图，也不能只看源码。按 `docs/runtime-ui-live-capture-workflow.md` 的分层思路，分别采集了：

1. 英文 dump-only Qt inventory：菜单打开前的 Qt QAction 模型状态。
2. 英文真实菜单打开后 AX 采样：用户实际看到的 native menu 状态。

对比结果：

| 项 | 菜单打开前 Qt inventory | 英文真实菜单打开后 AX |
| --- | --- | --- |
| 普通项 | `&New Composition`, enabled=true | `New Composition`, enabled=true |
| 普通项 | `Go to Playback Start`, enabled=true | `Go to Playback Start`, enabled=true |
| 状态延迟项 | `&Pre-Compose`, enabled=true | `Pre-Compose`, enabled=false |
| 红框 1 | `&Set Playback Area to Selection`, enabled=true | `Set Playback Range to Composition`, enabled=true |
| 红框 2 | `&Solo Selection in Viewport`, enabled=true | `Solo Selection in Viewport`, enabled=false |
| 其它延迟项 | `&Clear Quicklist`, enabled=true | `Clear Quicklist`, enabled=false |
| 其它延迟项 | `Enable Time Remapping`, enabled=true | `Enable Time Remapping`, enabled=false |

这里有两个事实：

1. `Set Playback Range to Composition` 打开前甚至不是同一个英文 source。打开前是 `Set Playback Area to Selection`，打开菜单时 Cavalry 才改成最终 title。
2. `Solo Selection in Viewport` 的文本 source 基本稳定，但 enabled 状态从打开前 true 变成打开后 false。

所以红框项和部分置灰项的根因一致：它们在原版 Cavalry 里就是 show-time 才收敛的动态 QAction。

## 误判修正

初始说法是“Cavalry 在 `aboutToShow` 阶段重置部分 QAction 英文文本”。这不够精确。

更准确的表述是：

```text
Composition 菜单里有一批 QAction 在菜单打开前只是预创建占位状态；
真正的 title 和 enabled 状态在菜单打开链路里才被 Cavalry 更新。
这些项和普通菜单项不是同一条稳定启动链条。
```

这个修正很重要。若把它理解成“缺翻译”或“某两个英文词条漏了”，就会继续补词表，无法解决闪烁。词条已经存在，问题在时机。

## 已落地修正

修改点在 `injector/CavalryTranslatorInjector.mm` 的 `hookQtMenu(...)`。

旧链路：

```text
QMenu::aboutToShow
  -> CFRunLoopPerformBlock(kCFRunLoopCommonModes)
  -> 下一轮 run loop 翻译当前菜单
```

这条链路可靠但晚。菜单已经有机会先绘制英文或中间 enabled 状态。

新链路：

```text
QMenu::aboutToShow
  -> translateMenuBeforeFirstPaint(menu, lang, true)
  -> 同步翻译当前菜单树并刷新 AppKit native menu
```

`ActionAdded` 和 `Show` 原本已经走 `translateMenuBeforeFirstPaint(...)`，本次把 `aboutToShow` 收敛到同一条 pre-paint 链路，避免同一类菜单生命周期有两种注入时机。

对应合同已写入 `tools/check_app_contracts.js`：

- 要求 `aboutToShow` 内出现 `translateMenuBeforeFirstPaint(...)`。
- 禁止 `aboutToShow` 范围内继续使用 `CFRunLoopPerformBlock` 延迟翻译。

构建与测试结果：

```text
npm run build:injector
npm run test:contracts
```

合同测试全绿后，`injector/libCavalryTranslatorInjector.dylib` 已重新生成。

## 仍需注意

如果用户实际双击 `/Applications/Cavalry.app` 仍闪，先不要立即否定源码修复。必须先检查安装态是否真的加载了新 injector：

```bash
plutil -extract CFBundleExecutable raw \
  /Applications/Cavalry.app/Contents/Info.plist

cat /Applications/Cavalry.app/Contents/Resources/cavalry-i18n-lang.txt

shasum -a 256 \
  injector/libCavalryTranslatorInjector.dylib \
  /Applications/Cavalry.app/Contents/Frameworks/libCavalryTranslatorInjector.dylib
```

正确安装态应满足：

```text
CFBundleExecutable == CavalryLauncher
lang marker == 当前目标语言
repo injector hash == app injector hash
```

若 `CFBundleExecutable == Cavalry` 且没有 app 内 injector，用户打开的是英文原版链路；源码修复不会生效。

## 后续 guard

当前合同锁住了“文本不要延迟翻译”，但还没有把“Composition 菜单 show-time enabled 状态会变化”写入 live/debug contract。

建议新增一个菜单链路 canary：

1. 英文 dump-only inventory 记录 Composition 打开前 QAction 状态。
2. 英文 AX 打开后采样记录真实 native menu 状态。
3. 固定断言以下动态项不是普通静态项：
   - `Set Playback Area to Selection -> Set Playback Range to Composition`
   - `Pre-Compose enabled true -> false`
   - `Solo Selection in Viewport enabled true -> false`
   - `Clear Quicklist enabled true -> false`
4. 中文注入版断言首次可见菜单不出现上述英文项。

如果同步 `aboutToShow` 后仍有轻微闪烁，下一刀不是加延迟，而是追 Cavalry 后续修改 QAction 的瞬间：

```text
QAction::changed
  -> translateQtAction(action, lang)
  -> refreshNativeMenuBar(lang)
```

或在 event filter 中覆盖 `QEvent::ActionChanged`，只翻译当前 action / 当前 menu，避免回到全局刷新。

## 设计经验

普通菜单可以启动时翻译，因为 source 和 enabled 状态稳定。动态菜单不能假装自己是普通菜单；占位状态不是事实，只是菜单系统的中间缓存。

好的注入不是“扫得更频繁”，而是“贴近真相源变化的瞬间”。能同步在首次绘制前完成，就不要下一轮 run loop；能只处理当前 QAction，就不要刷新整个应用。

这次暴露的坏味道是调试路径和安装路径容易分叉：repo 构建的 dylib 已修好，不代表 `/Applications/Cavalry.app` 已加载它。以后任何菜单现场验证都必须同时报告启动路径、lang marker 和 injector hash，否则结论不完整。
