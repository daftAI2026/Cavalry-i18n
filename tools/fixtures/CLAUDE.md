# fixtures/
> L2 | 父级: /Users/luo/Desktop/ClaudeCode/web/Cavalry-i18n/tools/CLAUDE.md

成员清单
make_fake_cavalry_bundle.js: fake Cavalry.app 工厂，写入 Info.plist、JSON 资产、插件 strings、Mach-O 头与 Resources 目录。

依赖边界:
fixtures 只描述测试世界；不得包含真实 Cavalry.app、大二进制或用户机器绝对路径。

法则: 临时生成·路径归一·无真实副作用

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
