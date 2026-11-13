<!--
[INPUT]: 依赖 injector/native 候选源、Qt 6.9.2公开头与同bundle Cavalry 2.8.1 arm64/2.8 x86_64 Frameworks。
[OUTPUT]: 说明已验证ARM候选边界与独立x86_64 ABI/build路径及其验收边界。
[POS]: Cavalry 2.8.1 ARM候选源码入口；此前2.8.0制品已部署到owned测试App，2.8.1实屏验收尚未完成。
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
-->
# Cavalry 2.8.1 ARM native candidate

## Scope

This module documents the Cavalry 2.8.1 macOS arm64 candidate and the separate retained x86_64 implementation.
It does not enter the Cavalry 2.7 build or release path.
The default shipped product does not consume it.
The explicit macOS native debug preview can embed the verified artifact at build time.
Its coordinator installs that artifact into a selected Cavalry 2.8 copy.
The candidate directory itself does not sign, install, or start an app.
The candidate reuses the existing Mach-O parser and UTF-8 glyph policy.
It verifies the native getter and four direct Skia targets.
It obtains the executable path with `_NSGetExecutablePath`, then canonicalizes that path.
It resolves `libCore`, `libExtensionLayer`, `libskia`, and `libApi` from that executable's bundle.
Only the exact derived `Contents/Frameworks` paths satisfy image lookup.
Another loaded image with the same basename cannot satisfy that lookup.
Original calls use two-level target imports and retain the existing forward design.
Static fixups prove binding scope, not every prior interposer-chain outcome.
The candidate build does not measure runtime chain behavior.

The combined candidate also contains one exact Guide body projection, one Fast
Quick Add regular-expression adapter, and one source-bound help-popup layout adapter.
It uses typed Qt 6.9.2 public headers and the selected bundle's QtCore runtime.
The layout adapter also links the selected bundle's QtGui and QtWidgets runtimes.
The 2.7 translator and default release build do not consume this candidate.

The Demo reader projects approved string-literal offsets only when the exact
`populatePresetsMenu::$_1` `textFromFile` return PC (`0x6d9ab4`), canonical
Presets path, and official source SHA all match. Its 2.8.1 ABI uses the verified
`std::optional<std::string>` result slot; Core exports `textFromFile` at
`0x4b175c` and Extension imports it from `libCore`.
Unknown callers and files receive the original optional unchanged. The catalog
is build input; generated tables contain translated text and offsets, not vendor
JavaScript source. The previous 2.8.0 candidate 9c352155 was deployed to an
owned test app; that result does not establish that this 2.8.1 migration is
loaded or visually accepted.

## Runtime boundary

`activeLocale` remains the only language source.
The wrapper calls its original once, then publishes one `gLocale` snapshot for the exact Extension caller.
The wrapper does not catch or replace original getter exceptions.

GetPath accepts the FPS direct owner or the verified Core→cache→producer chain.
For 2.8.1, FPS requires Core return `+0x65a04` and Extension return
`+0x237548`. The candidate verifies the FPS `MakePathFromText` call at
Extension `+0x237544`.
This owner stays separate from the Viewport quality cache owner.
It copies at most 512 UTF-8 bytes into the existing text snapshot.
It selects one of three 75-entry fixed UI lanes from `gLocale`.
Each lane keeps the original 27 entries and four Mesh tool hints.
Each lane then appends 40 approved ToolHelp strings and four fixed-prefix composites.
The original 213 entries stay byte-for-byte unchanged.
The 93-row baseline fixture preserves the old 31-entry lane byte-for-byte.
The ToolHelp source contract checks 44 direct keys, four composites, two existing matches, and two duplicate pairs.
It emits 40 approved tuples and four derived rows per locale; `Delete` stays preserved.
The Skeleton handle-drag suffix is one composite fragment, not a standalone row.
Each composite combines an approved source fragment with a fixed vendor prefix.
It adds no translation-registry key.
The Mesh hints cover Bind positions, edge creation, and Soft Selection.
The fixed lanes also include Transform, Edit Shape, and Viewport quality text.
It replaces the font only for an exact owner and exact text match.
Unknown ABI, caller, owner, locale, text, font, or path forwards to the original.
The FPS owner accepts only the approved locale prefix and a non-empty suffix.
It does not parse or rewrite the formatted frame-rate suffix.

## Graph Editor empty state

The Graph Editor empty-state message reaches the existing GetPath owner through
the verified Extension caller at `+0x57e29c`. The adapter reads that caller frame
once. It selects a separate three-locale table only for the exact
`GraphEditorEmptyState` owner and full source string. The existing 225-entry
lane remains byte-for-byte unchanged. Unknown callers, locales, and strings
retain the original path. The offline contract proves the narrow gate; it does
not prove a live Graph message or first visible frame.

## Dependency Graph node headers

The Dependency Graph node text is a separate owner. The 2.8.1 adapter accepts
only the `lina::TextView` children at NodeView child indices 1 (`NiceName`) and
2 (`NodeType`). It proves the exact Skia Measure/Draw return PCs, TextView to
NodeView parent and vtable chain, direct child vector, and complete source
string closure before reusing the shared font selector. Unknown Lina text and
the Graph Editor empty-state caller keep their existing paths. The source
contract checks the selected 2.8.1 Extension image; no live UI result is implied.

## Demo Preset reader

`tools/generate_demo_reader_tables.js` binds 297 approved source strings and
891 translations to 100 official Preset files and 489 UTF-8 literal ranges.
It checks each file's exact path, byte length, and SHA before emitting temporary
C++ tables. The generated tables contain no vendor JavaScript.

The 2.8.1 interposer admits only the `MenuBarManager::populatePresetsMenu::$_1`
caller. It checks the exact `textFromFile` return PC, `Contents/assets/Presets`
path, file SHA, source literal, and locale before projecting a string. The
verified return ABI is `std::optional<std::string>`. Unknown calls preserve the
original optional and call the original once. The candidate contract passed;
formal deployment, live menu acceptance, and first-frame acceptance remain
unverified.

Timeline, Viewport, and GetPath share the existing verified-text fallback core.
The core tests the existing CoreText-resolved font first.
Only a whole-string coverage rejection enables three fixed PostScript names.
`CTFontCreateWithName` receives `PingFangSC-Regular`, `PingFangTC-Regular`, or `HiraginoSans-W3`.
It does not receive the family names `PingFang SC`, `PingFang TC`, or `Hiragino Sans`.
Hans order is PingFangSC-Regular, PingFangTC-Regular, then HiraginoSans-W3.
Hant order is PingFangTC-Regular, PingFangSC-Regular, then HiraginoSans-W3.
Japanese order is HiraginoSans-W3, PingFangTC-Regular, then PingFangSC-Regular.
Each candidate must cover the complete UTF-8 string before selection.
Font creation, cache, style, and size failures stop the candidate search.
The core keeps its eight font slots and acquires their lock once per call.
A selected font slot is created synchronously inside the verified draw or measure call.
The original call receives that font immediately; no later repaint is scheduled.
The exact native getter is the existing `registerNodesSetup` boundary before `Gui::setupGui`.
Static startup order is `loadPlugins` → `registerAppComponents` →
`registerNodesSetup` → `activeLocale`, then `Gui::setupGui`.
`CavalryApp` calls `loadPlugins` before `setupStyle` and `Gui::setupGui`.
That static ordering is not a live first-frame acceptance result.
Decision caching stays disabled.
No source text enters diagnostics or files.

## Main window title boundary

The 2.8.1 arm64 candidate checks the `Gui::updateAppTitle` caller in the selected
`libExtensionLayer.dylib` and its two-level import of `fmt::v11::vformat` from
the same bundle's `libfmt.11.dylib` (11.2.0). The title BL at `0x12a46c` targets
the import stub at `0xd206e0`; its GOT slot is `0x10294b8`.
The check locks the caller return PC, format address and length, descriptor,
source-object copy/empty branches, fmt UUID, exported symbol, and entry bytes.
The candidate checks call and stub bytes, fmt export offset `0x1a54`, UUID, and
the loaded GOT target before enabling the title projection.

The retained x86_64 compilation path keeps its previous fmt10 import and
legacy title constants unchanged. Those constants originally describe the
2.8.0 ARM caller; preserving them does not establish an Intel title ABI.
An unmatched Intel caller remains outside this projection. The separate
x86_64 build still links `libfmt.10.dylib`; no 2.8.1 Intel support is added.

The adapter calls the original formatter once. It then projects only the
`Project` and `Scene` labels and true empty project/scene placeholders.
It reads 24-byte libc++ source objects at `values+0xd8` and `values+0xc0`.
The caller keeps those objects alive until `Gui::updateAppTitle` returns.
The adapter accepts the short-string empty tag only with the exact borrowed
address and fallback text. Pointer identity alone does not distinguish short
user names from fallbacks. A real `None` or `Untitled` name remains byte-for-byte
unchanged. The Restricted suffix also remains unchanged.
The adapter reuses the existing `gLocale` snapshot and does not inspect or
write project, scene, profile, or model state.

The display labels reuse `colorWindow.header.project` and
`colorWindow.header.scene`. The empty project value reuses the native
`cli.log.none` equivalent; the empty scene name reuses `recovery.untitled`.
The compiled title policy is a display projection, not a new catalog consumer.
Its static tests do not prove a loaded runtime hook or a live window title.

## Save-panel captions

The selected Cavalry 2.8 Extension constructs `Save Scene` in `saveScene` and
`incrementAndSaveScene`. It constructs `Save as .cv` in `saveSceneAs` and the
encrypted Save As path. Both values use the same imported Qt
`QFileDialog::getSaveFileName` call. The exact return PC is `+0x6e4b8c`.
The runtime gate checks the Extension and QtWidgets UUIDs, Qt 6.9.2, the full
arm64 argument-setup/call window, and the exported QtWidgets symbol.

The adapter changes only those two exact source captions at that return PC.
It reuses the existing native locale snapshot and approved old-TS values.
It leaves the selected directory, filter, selected-filter pointer, options,
return value and every other caption unchanged. It does not translate the
native panel's Save/Cancel controls.

The QtCore-only contract exercises the real Qt `QString` type without loading
Cavalry or opening a dialog. It verifies the returned `QString`, const-reference
arguments, translated temporary lifetime, one original call, and exact caller
and source gates. A contract pass is not live UI evidence.

## Help description boundary

The build-time producer binds 512 reviewed descriptions to official metadata.
The main `addCompletionsToTextEdit` caller requests the four API namespaces.
The `formatForCompleter` caller adds `cavalry/ctx/def` only for the exact
`javaScriptDeformer` condition. Both paths call the same metadata loader and
the same `TextEdit::addScriptDocumentationEntry` import.
The generated tables keep 384 main roots and 17 def roots separate.
`getBoundingBox` occurs in both namespaces with different English sources.
The 111 nested class descriptions remain outside both proven root consumers.
The 384+17 roots still do not prove all 512 reviewed descriptions are consumed.

The candidate source links the same bundle's `libCavalryUI.dylib`.
It checks the Extension/UI identities, the def condition and both exact callers.
It uses the existing `gLocale`; it does not add a language getter.
Only an exact runtime key and exact English description admit a projection.
A shadow object copies each C++ member and changes description at offset zero.
The input object, keys and other fields retain their values.
The original is called once and original exceptions propagate.
The vendor return type is not proven.
The two verified callers do not consume returned registers.
Only their exact return PCs enter the C++ description dispatcher.
The dispatcher selects the main or def table by caller identity.
An arm64 veneer forwards every other caller directly to the original UI import.
It uses only x16/x17 to compare LR and retains argument/result registers,
stack/frame pointers, original LR, and the vendor return path.
The combined candidate must still pass a new live help readback for each artifact.
The generated table and hidden fixture do not prove popup consumption.

## Guide body boundary

The adapter admits only the `wireStepConnections::$_24` caller at Extension
return offset `0x4b9e48`. `overrideBodyLabel` tail-branches to QtWidgets
`QTextEdit::setText`. The constructor checks the Extension and QtWidgets UUIDs,
both caller instructions, and the exact exported setter address.
The adapter reuses `gLocale` and changes only the exact source `Keep going...`.
It projects `继续…`, `繼續…`, or `続けてください…` for the three supported locales.
Unknown callers do not read text or locale. Unknown source, locale, or ABI
forwards the original setter once, with its exceptions unchanged.
Pure contracts and ABI admission do not prove live Guide consumption.

## Magic Easing preset display boundary

The adapter admits only the reviewed `QWidget::addAction(QAction*)` call from
`cavalry::addEasingMenu` in the selected Extension image. Its constructor checks
the Extension, QtWidgets, and QtGui UUIDs, Qt 6.9.2, the caller bytes, and the
three exact exported symbol addresses.
Unknown callers, missing images, or a failed ABI check forward the original
`addAction` without reading the action text or locale.

At the one admitted caller, the adapter reads the exact source label and maps
it through the frozen 20-row display table. It changes only `QAction::text`
before calling the original `addAction` once. It does not change action data,
connections, or the captured easing enum. The vendor callback captures that enum
separately from the display label.
Each normal branch forwards once. Projection exceptions propagate before the
original call; original-call exceptions propagate without retry.
The adapter reuses the existing `gLocale`; English, unknown locales, and labels
outside the table pass through unchanged.
The pure contract checks matching and forwarding semantics. Static ABI checks
do not prove a loaded hook or live menu consumption.

## Help popup layout boundary

The same metadata producer emits a second compile-time table with all 401 root
API names, kinds, parameter rows, and return rows. This table contains no help
body, translation, user input, or runtime file path.

The adapter interposes `QLayout::activate` but changes a layout only when its
return address equals the reviewed `DocumentationPopup::setContent` call site.
The constructor binds the original QtWidgets export from the selected bundle
and checks the CavalryUI call bytes, import stub, UUIDs, and Qt version.
An unknown call invokes the original `activate` exactly once.

The first approved popup measures the 401 metadata rows with hidden QLabel
probes that inherit the current popup's font, text format, style, padding, and
alignment. The process retains one integer width. The adapter performs no
catalog scan, locale lookup, or file I/O after that measurement.

The shared catalog width is an upper bound, not a fixed width. Each description
keeps its natural width when it fits. A wider description wraps inside the
remaining row width. The title aligns with the first body line. The adapter
does not set a fixed height, font, style sheet, hard line break, padding, or
line height. It activates only parameter and return row layouts whose wrapper
widgets are not explicitly hidden. The vendor root activation and `adjustSize`
remain in their original order and each runs once. No event loop is pumped.

The hidden Qt fixture exercises the 401-row table and source-bound long/short
help examples in Hans, Hant, and Japanese. It checks the width ceiling, the
host minimum-width property, full visible-label geometry, no early wrapping,
stable wrapping and natural heights across content changes, and one cached
width per locale. It compares fresh and reused geometry for
`getBoundingBox` → `getChildren` and `addDynamic` → `addPreCompOverride`,
and checks hidden-row restoration. These assertions do not guarantee
pixel-identical rendering.
The fixture uses the Qt-host test font, not Cavalry's rendered font; it does
not replace live three-language or font-matrix acceptance.

## Fast Quick Add boundary

The adapter admits only the fixed arm64 `libExtensionLayer.dylib` UUID and
the reviewed options instruction, C1 call, and import stub.
It changes options from zero to `UseUnicodePropertiesOption` only at the exact
Fast return PC and only for the exact pattern `[\\s\\-_\\W]`.
It checks the caller, original options, and admission before comparing the
pattern, so unrelated C1 calls take the shortest pass-through path.
Unknown callers, nonzero options, and failed admission call the original C1.
The original constructor runs once, and its exceptions propagate.
The adapter does not rewrite plugin names, model data, or search results.

The explicit build requires a public-header prefix with QtCore, QtGui, and
QtWidgets headers from Qt 6.9.2. It links the selected App's QtCore, QtGui, and
QtWidgets framework binaries.
The candidate uses versioned `@rpath` framework install names, with
`@loader_path` and `@executable_path/../Frameworks` runpaths.
The static contract requires one two-level import from each selected 6.9.2
QtCore, QtGui, and QtWidgets framework. It rejects an absolute build path and a
flat namespace. No second Qt runtime is bundled.
The C1 policy test checks only the option gate, single original call, and
exception propagation. The Easing policy test uses a synthetic table and does
not verify the generated display table or live menu consumption. Neither test
is evidence of a loaded hook or live UI result.

## Welcome producer boundary

The candidate interposes the exact `spdlog::logger::log_it_` import.
The reviewed 2.8.1 arm64 Extension UUID is
`AF1367BD-2D7E-3EC0-A111-935E4881C655`; the `libspdlog.1.15.dylib` UUID is
`43FC7DAB-6695-3EF6-B50B-B8189E170B09`.
The selected `log_it_` export resolves to offset `0x6f10`. The Welcome import
stub is at `0xd21520`, GOT at `0x1029488`, and caller return at `0x18f118`
(call at `0x18f114`).
The runtime publishes that PC only when the exact bundle images and the
Extension GOT target match the candidate veneer.

The arm64 veneer compares `x30` with the exact return PC.
The gate starts at zero and remains closed before complete ABI admission.
An unknown caller tail-branches to the same image's two-level spdlog import.
It preserves its arguments and LR. It never reads `log_msg` or payload.
Apple dyld's `InterposeTupleSpecific.onlyImage` excludes that import from
its own replacement, which allows the interposer to call the prior function.
The source contract is `DyldRuntimeState.h` lines 2344-2353.
The independent dyld fixture must verify the host's actual call-through.

Only the exact `0x18f118` return PC enters the dispatcher.
The dispatcher calls the same direct import for the original function.
It copies the reviewed `0x60`-byte message view and changes only payload
pointer and byte length. The original runs once; exceptions propagate.
No constructor-published original pointer gates unknown calls.

The projected payload buffer lives through the original `log_it_` call.
This scope is pinned to the reviewed spdlog 1.15 runtime ABI.
Its synchronous path consumes the message inside `log_it_`.
Its async and backtrace paths copy the payload into `log_msg_buffer`.
Do not reuse this lifetime proof for another spdlog version.
Sources: [logger-inl.h](https://github.com/gabime/spdlog/blob/v1.15.0/include/spdlog/logger-inl.h#L743-L760), [thread_pool.h](https://github.com/gabime/spdlog/blob/v1.15.0/include/spdlog/details/thread_pool.h#L441-L492), [log_msg_buffer-inl.h](https://github.com/gabime/spdlog/blob/v1.15.0/include/spdlog/details/log_msg_buffer-inl.h#L293-L303), [backtracer-inl.h](https://github.com/gabime/spdlog/blob/v1.15.0/include/spdlog/details/backtracer-inl.h#L363-L369).

The policy accepts only `Welcome to Cavalry.`, that source plus the exact
` Happy New Year!` suffix, or that source plus ` Happy Holidays!`.
It retains each approved suffix byte-for-byte.
It uses the existing `gLocale` snapshot. It adds no locale getter or timer.
The source translations are the approved rows in `tools/zh-Hans.ts:6300`,
`tools/zh-Hant.ts:6549`, and `tools/ja_JP.ts:7774`.
No MessageBar consumer or RolloverLabel prefix hook participates.

The pure policy test checks three locales, all three complete payloads,
unknown and same-prefix callers, unapproved suffixes, one original call, and
exception propagation. The arm64 veneer fixture checks unknown-caller tail
transparency and exact-LR dispatch.
The separate dyld fixture loads a fake spdlog and an early-caller dependency.
Its dependency constructor logs before the inserted interposer constructor.
The closed gate must tail-call the old import once with an unreadable message,
original registers, return PC, and `errno` intact. The dispatcher stays unused.
Run the fixture with the frozen unsafe veneer in `red` mode, then the candidate
veneer in `green` mode. Neither run loads Qt or Cavalry.
A passing fixture does not prove a live product hook or Welcome display.

## Migration regression rule

Freeze the successful source and artifact before moving this code.
Reuse its verified adapters instead of replacing them by assumed equivalence.
For each new artifact, check Simplified Chinese, Traditional Chinese, and Japanese across Timeline list names/time-bar names (including measurement and drawing), Viewport names/quality text, and fixed tool hints.
Recheck one approved visible Fast search label in each locale, its exact result, and same-owner clear restoration.
The JA canary result does not transfer to the merged candidate.
A merged candidate has since passed one visible Twist-name query and same-owner clear in each target locale.
That bounded readback does not complete the font matrix, title/help regression, hidden plug-ins, English aliases, or first paint.
A hidden plug-in counts only when the same owner proves its query result.
A compile or static ABI pass does not replace these live checks.
A failed artifact cannot inherit a successful predecessor's acceptance.
Record stable display and first visible paint separately.
Delivery requires correct glyphs on the first visible paint after injection.
A later repaint, a test helper, or a different app process does not satisfy that requirement.
Do not add a timer or post-window resource rewrite to hide an initial glyph failure.

## Candidate build

Run the explicit arm64-only candidate gate with a read-only Cavalry 2.8 Frameworks directory and explicit Qt 6.9.2 public-header prefix:

```sh
CAVALRY_QT_PREFIX=/path/to/qt-6.9.2-header-prefix \
  bash injector/native/build_candidate.sh /path/to/Cavalry.app/Contents/Frameworks
```

The prefix must contain `include/QtCore/qconfig.h`; the build verifies its
6.9.2 macros. It never links QtCore from that prefix.

The build creates a fresh temporary dylib.
It checks vendor arm64 identities, required exports, two-level Api/Skia/fmt/UI/QtCore fixups, and the exact three-instruction GetPath veneer.
It also checks the Extension/spdlog UUID, `log_it_` export and import/fixup
before linking the selected bundle's spdlog library.
It generates separate 384-main and 17-def help tables plus a 401-root layout
table from official MetaData.
It generates the 20-label Easing display table outside the repository.
It compiles and runs the pure getter/GOT/FPS-owner, Guide body, Easing,
Save Scene caption, Welcome,
Fast C1 policy, help shadow, and hidden Qt layout tests.
It also runs the vendor-free dyld constructor-order fixture against the new veneer.
It links the real help veneer to a vendor-free register probe.
That probe checks unknown-caller argument, return and indirect-result transparency,
plus exact main/def LR dispatch.
The fixup gate separately checks the real UI import binding.
It compiles a target-arm64 `fmt::v11::vformat` ABI probe and records its assembly
with the exact caller and fmt entry bytes in `title-format-abi-proof.json`.
It rejects a UUID that belongs to another FAT slice, using the actual checker.
It never loads the candidate or starts Cavalry.

The arm64 command above remains arm64-specific. The x86_64 ABI, source build, and production package path are documented in the architecture section below. Keep the 2.7 release path separate.

## x86_64 architecture addition

The arm64 candidate details above remain the verified Apple Silicon record.
The x86_64 path adds architecture-specific ABI contracts and does not replace
the arm64 source or its acceptance evidence.

The x86_64 candidate verifies the official Core, Extension, Skia, API, and Qt
slices. It binds the locale getter, Skia factories, GetPath owners, Timeline
observers, Viewport TextBlob, and popup layout through x86-specific contracts.
Unknown callers retain the original call path. The font gate requires both the
x86 locale contract and every font-lane contract.

Before x86 ABI checks, the builder snapshots the native source closure into
its new output directory. The closure covers `injector/`, `languages/native/`,
the four locale metadata directories, and the transitive native table
producers. The Timeline checker consumes this generated manifest explicitly;
it does not require private `evidence/` files. A vendor-free fixture verifies
source additions, deletions, byte changes, and mode changes are rejected.

M61 run21 compiled and linked the complete x86_64 native source set. M61
run03 built the production-2.8 Tauri x86_64 App and DMG. M61 run04 passed the
packaged-app gate. These receipts prove build and packaging, not Intel live
display. No Intel hardware runtime or display matrix has been accepted.

Build the native x86_64 artifact with the official Cavalry 2.8 Frameworks
directory and Qt 6.9.2 public headers:

```sh
CAVALRY_QT_PREFIX=/path/to/qt-6.9.2-header-prefix \
  bash injector/native/build_x86_64_candidate.sh \
  /path/to/Cavalry.app/Contents/Frameworks /path/to/new-output
```

This command builds the native dylib only. The existing production-2.8 Tauri
pipeline selects the matching architecture and packages its resource. It does
not launch Cavalry or prove live font admission. Keep the arm64 and x86_64
results bound to their own source and artifact identities.

## Acceptance boundary

The candidate source and temporary build alone do not prove product consumption.
The retained 5009 artifact predates the FPS owner source and remains unchanged.
The FPS owner candidate has passed a fresh build and static contracts.
The same candidate now shows readable FPS labels and changing numbers in all three languages.
Each language run also records advancing playback time and the enabled display setting.
Japanese OCR recognizes the ASCII colon as a fullwidth colon; exact punctuation remains unverified.
These scoped stable-display results do not prove first paint or the combined font matrix.
Earlier results remain bound to their recorded source and artifact.
They do not transfer to this merged candidate.
Each combined title/help/Guide/Easing/layout/Fast artifact requires its own build and
three-language acceptance. Bind results to the exact artifact.
Current scoped live results and unverified surfaces are recorded in the
project migration ledger; they do not transfer to another artifact.
The coordinator uses a disposable fixed-layout profile and does not start Cavalry.
Normal bundle loading, GUI behavior, app lifecycle, and whole-UI first paint require separate live acceptance.
The current 2.7 translator remains the only shipped injector.

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
