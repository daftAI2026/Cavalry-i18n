# Compiled TS Parity Report

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md

## Finding

现有 `languages/*` 的 16 个 JSON 文件三语字符串叶子数一致：

- en: 6708
- zh-Hans: 6708
- zh-Hant: 6708
- ja_JP: 6708

数量不一致发生在 compiled/runtime 翻译源：

| Language | TS messages | generated inc entries | unique ctx+source | contexts | QPrintDialog messages |
|---|---:|---:|---:|---:|---:|
| zh-Hans | 3605 | 3605 | 3521 | 11 | 3 |
| zh-Hant | 3479 | 3479 | 3469 | 11 | 3 |
| ja_JP | 3522 | 3522 | 3514 | 10 | 881 |

## Root Cause Signals

1. `zh-Hant` is missing 52 `MenuBarManager` source entries compared with `zh-Hans`.
2. `ja_JP` is missing 878 `MenuBarManager` entries compared with `zh-Hans`.
3. `ja_JP` has 870 extra entries under `QPrintDialog`.
4. `ja_JP.ts` has only 10 contexts while `zh-Hans.ts` and `zh-Hant.ts` have 11.
5. `QPrintDialog` should only contain the 3 Qt print strings, but `ja_JP.ts` contains 881 messages there.

## Impact

`EmbeddedTranslator::translate()` first matches by exact Qt context and source text.
If a real runtime string asks for context `MenuBarManager` but the Japanese translation is stored under `QPrintDialog`, Qt-context lookup fails.

The fallback `lookupEmbeddedTranslation()` ignores context for manual menu/widget rewriting, so some menu paths still work. But any normal `QTranslator` path that uses context will miss those Japanese entries.

## Required Fix Before Release

Before packaging the completed 38 JSON language packs:

1. Restore TS context parity:
   - `tools/zh-Hans.ts`
   - `tools/zh-Hant.ts`
   - `tools/ja_JP.ts`
2. Ensure all three languages have the same source denominator for compiled UI.
3. Move the misplaced Japanese `MenuBarManager` messages out of `QPrintDialog`.
4. Add a contract test that fails when:
   - TS message counts differ by language.
   - unique `(context, source)` sets differ.
   - `QPrintDialog` has more than the expected Qt print strings.
5. Regenerate `injector/generated_translations.inc`.

## Conclusion

The earlier “translation count mismatch” is a real blocker. It is not caused by the 38 JSON surface work. It is a separate compiled UI source parity bug and must be fixed alongside the JSON translation expansion.
