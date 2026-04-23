# fixtures/
> L2 | 父级: /Users/luo/Desktop/ClaudeCode/web/Cavalry-i18n/tools/CLAUDE.md

成员清单
make_fake_cavalry_bundle.js: fake Cavalry.app 工厂，写入 Info.plist、JSON 资产、插件 strings、Mach-O 头与 Resources 目录。
electron_contract_snapshot.json: 规范化 Electron 5 IPC 行为基准，路径替换为 `<fixture>` 与 `<repo>`，用于 Tauri 等价比较。
electron_window_baseline.json: Electron 主窗口 baseline 元数据，冻结外框尺寸、标题栏偏移与内容截图尺寸。
electron_window_baseline.png: Electron 主窗口内容区截图 baseline，供 Tauri regression 做像素级比较。

依赖边界:
fixtures 只描述测试世界；不得包含真实 Cavalry.app、大二进制或用户机器绝对路径。

法则: 临时生成·路径归一·无真实副作用

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
