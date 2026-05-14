# desktop-patcher/
> L2 | 父级: /Users/luo/Desktop/ClaudeCode/web/Cavalry-i18n/CLAUDE.md

成员清单
injector/: 旧桌面补丁器的 injector 产物镜像，保留 generated translations 与 universal dylib。

依赖边界:
desktop-patcher 是历史兼容产物区；当前 Tauri 主线使用根目录 `injector/` 与 `src-tauri/tauri.conf.json` 的 bundle resources。

法则: 历史隔离·不做主线真相·产物可替换

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
