# badges/
> L2 | 父级: /Users/luo/Desktop/ClaudeCode/web/Cavalry-i18n/docs/CLAUDE.md

成员清单
release.json: Shields endpoint badge 数据源，保存当前公开 GitHub Release tag，发布 workflow 成功创建 Release 后写回 main，README 只读取该 JSON 而不实时查询 GitHub Release API。

依赖边界:
badges 只保存 README 可见状态的静态 JSON 投影；真实发布动作仍由 `.github/workflows/build.yml` 与 `release.config.json` 决定。

法则: 发布时写入·展示时只读·不依赖 token pool

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
