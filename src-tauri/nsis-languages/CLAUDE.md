# nsis-languages/
> L2 | 父级: ../CLAUDE.md

成员清单
English.nsh: Tauri NSIS 英语消息表；保持上游键集合，仅把确认页应用数据复选框明确限定为 Switcher 设置。
SimpChinese.nsh: Tauri NSIS 简体中文消息表；保持上游键集合，仅把确认页应用数据复选框明确限定为切换器设置。
TradChinese.nsh: Tauri NSIS 繁体中文消息表；保持上游键集合，仅把确认页应用数据复选框明确限定为切换器设置。
Japanese.nsh: Tauri NSIS 日语消息表；保持上游键集合，仅把确认页应用数据复选框明确限定为切换器设置。

依赖边界: `tauri.windows.conf.json` 通过 `customLanguageFiles` 替换 Tauri 默认消息表；四个文件必须与 `languages` 列表同构，不能承载卸载事务逻辑。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
