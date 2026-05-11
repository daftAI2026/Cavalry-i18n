# languages/
> L2 | 父级: /Users/luo/Desktop/ClaudeCode/web/Cavalry-i18n/CLAUDE.md

成员清单
en/: 英文基线语言包，作为 38 个 JSON surface 的 source truth 与 structure parity 参照。
zh-Hans/: 简体中文语言包，覆盖 38 个 JSON surface，翻译用户可见字段并保留 API/type/ID 等技术字段。
zh-Hant/: 繁体中文语言包，覆盖 38 个 JSON surface，保持繁体术语、技术字段原样与简繁纯度。
ja_JP/: 日文语言包，覆盖 38 个 JSON surface，遵守カタカナ优先、API 技术字段原样与零混合语言原则。

依赖边界:
JSON 语言包不承载代码逻辑；运行时复制边界由 `src-tauri/src/patch.rs` 的 `CORE_MAP`、`PLUGIN_DEFINITION_MAP` 与插件 strings 发现共同决定。字段是否翻译由 `tools/translation-whitelist.json` 和 JSON surface 审计分母决定，质量由 `tools/validate_translations.py` 与 §P5 detector 守门。任何语言包变更必须保持 `en/` 结构同构，不得通过改 whitelist 掩盖漏翻。

法则: 结构同构·字段分层·三语同步·禁止半翻译

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
