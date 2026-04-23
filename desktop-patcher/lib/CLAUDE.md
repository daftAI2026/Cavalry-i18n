# lib/
> L2 | 父级: /Users/luo/Desktop/ClaudeCode/web/Cavalry-i18n/desktop-patcher/CLAUDE.md

成员清单
detect.js: Cavalry.app 探测模块，读取默认候选路径、语言目录、Info.plist 版本与 bundle 诊断字段。
patch.js: JSON 资产映射模块，定义核心文件映射、插件 camelCase 发现、英文提取、复制对构建、staging 与 codesign 验证。
sudo.js: 提权复制模块，先直接复制，权限失败后走 macOS osascript/Finder 或 Windows PowerShell。

依赖边界:
lib/* 不创建窗口、不读 renderer、不持有 Electron 对象；系统命令只出现在边界函数中，供上层 handler 通过依赖替换隔离。

法则: 文件映射稳定·副作用集中·测试替换真实系统

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
