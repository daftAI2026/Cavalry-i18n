<!--
[INPUT]: 官方Docs稳定版本、native target和独立监控工作流。
[OUTPUT]: 可重复监控用法、去重与失败处理边界。
[POS]: 维护SOP；不作为新版兼容或发布证明。
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
-->
# 官方版本监控

`Watch Cavalry Releases` 在默认分支每天 02:23 UTC（北京时间10:23）运行，也可在 Actions 页面手动运行。GitHub 定时任务可能延迟；工作流需要先合入默认分支并启用 Actions。它不下载安装包，不构建或发布产品。

监控读取 <https://cavalry.studio/docs/> 的唯一 `Latest version`，只接受稳定的三段数字版本；以 `tools/cavalry_native_target.json` 的 `cavalryVersion` 为比较基线。新版本必须有同站、同版本标题的官方发行说明，才生成兼容性评估 issue。

Action创建的issue正文带本次GitHub Actions运行链接，可核对发现来源。

每版使用隐藏标记 `cavalry-upstream-release:<version>`。创建前直接分页读取全部 issue（含关闭项），按标记或标准标题去重；不依赖搜索索引，也不会因为关闭 issue 而重开。同一监控工作流串行执行。不要同时删除已有 issue 的版本标记和标准标题。

无需凭据的本地预览：

```sh
GITHUB_REPOSITORY=daftAI2026/Cavalry-i18n node tools/watch_cavalry_release.js
```

明确写入时追加 `--write`，并为 `gh` 提供具有 Issues 写权限的 `GH_TOKEN`。Action 使用仓库自带的 `GITHUB_TOKEN`，仅需 `contents: read` 与 `issues: write`，无需额外 secret。

官网不可用、HTML结构变化、发行说明缺失或GitHub请求失败均使任务失败；维护者应查看 Actions 失败记录并修复解析/网络问题。失败不会写兼容结论或修改支持版本。相同版本发行说明的正文修订不单独开 issue。

兼容性评估应沿用历史迁移方法：稳定键与英文源一致才复用译文；二进制调用点、字体测量与绘制、首次可见帧及安装恢复分别验证。发现新版不代表已支持新版。
