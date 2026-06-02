# prompts/
> L2 | 父级: /Users/luo/Desktop/ClaudeCode/web/Cavalry-i18n/docs/archive/workflows-cavalry-i18n/CLAUDE.md

成员清单
00-bootstrap-context.md: 早期冷启动上下文入口。
01-expand-glossary.md: 扩展 Cavalry 术语表执行 prompt。
02-extract-english-strings.md: 抽取英文字符串执行 prompt。
03-define-translation-whitelist.md: 定义翻译 whitelist 执行 prompt。
04-translate-all-languages.md: 三语翻译执行 prompt。
05-compile-qm.md: 编译 QM 翻译资源执行 prompt。
06-write-language-switcher.md: 编写语言切换器执行 prompt。
07-build-ci.md: 建立 CI 执行 prompt。
08-write-readme.md: README 写作执行 prompt。
09-final-gate.md: 早期最终 gate 执行 prompt。

依赖边界:
prompt 是历史执行切片；当前 full-ui 任务不得绕过 `cavalry-full-ui-100/` 的 EXECUTE 与 Runbook。

法则: 编号即路径·历史不放权·执行看当前

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
