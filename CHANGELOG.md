# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Dynamic Bracketed Layer Name Translation**: Implemented bracketed and dotted numeric suffix pattern recognition in `CavalryTranslatorInjector.mm` (`translatedDynamicBracketLayerName`), allowing dynamic Attribute Editor and Scene View names like `Matches.0` or `String Generator 2 [2.Match String]` to display translated components (e.g. `匹配.0`, `String Generator 2 [2.匹配字符串]`) while retaining the correct dynamic numeric suffixes.
- **Time Editor Item View Dynamic English Restoration**: Added reverse-parsing logic (`timeEditorSafeItemText`) to translate dynamic bracket names back to English inside the Yellow-box Time Editor list and tree widgets (`shouldPreserveModelBackedItemText`). This keeps the model-backed item names strictly in English to prevent tofu character rendering (`?` block) in the Latin-only Canvas self-drawing layers.
- **Contract Verification for Dynamic Bracket Names**: Added contract assertions in `tools/check_app_contracts.js` confirming that the Apply Character Spacing parameters translate in the Qt display, while Time Editor item views correctly enforce English restoration for both normal and bracketed dynamic names.

### Changed
- **Apply Character Spacing Full Translation**: Localized `pairs` (`匹配` / `匹配` / `マッチ`), `pairs.matchString` (`匹配字符串` / `匹配字元串` / `マッチ文字列`), and `pairs.spacing` (`字符间距` / `字元間距` / `文字間隔`) directly inside the Simplified Chinese, Traditional Chinese, and Japanese language JSON packs, and removed them from `no_translate` in `tools/translation-whitelist.json` to allow full Qt-level Attribute Editor translation, offloading the Time Editor context protection entirely to the injector view boundary.
- **GEB Document Mapping Sync**: Updated L2 module maps in `injector/CLAUDE.md`, `languages/CLAUDE.md`, and `tools/CLAUDE.md` to document the new `QLineEdit` repaint interceptor and the dynamic bracketed name translation / Time Editor English restoration protocol.

## [0.4.0] - 2026-05-21

### Added
- **Canva Brand Protection Contract**: Added contract assertions in `tools/check_app_contracts.js` (`Canva authentication copy preserves brand names across runtime translations`) to strictly verify that Canva login-related runtime translations preserve both "Canva" and "Cavalry" brand names and accurately map localized strings across Simplified Chinese, Traditional Chinese, and Japanese.
- **Synchronous aboutToShow QMenu Translation Contract**: Added contract assertions in `tools/check_app_contracts.js` to strictly verify that `QMenu::aboutToShow` triggers synchronous pre-paint translation via `translateMenuBeforeFirstPaint` and does *not* utilize `CFRunLoopPerformBlock` deferral, preventing visible English-to-localized text flicker on dynamic menus.
- **Offline Re-authentication Countdown Translation**: Implemented `offlineAuthPattern` regex matching in the injector (`CavalryTranslatorInjector.mm`) to dynamically translate Cavalry's offline re-authentication countdown status messages (`"Cavalry is offline. You will need to re-authenticate in less than <n> days."`) across Simplified Chinese, Traditional Chinese, and Japanese, dynamically preserving the remaining days placeholder.
- **Traditional Chinese and Japanese Tips Translation**: Added exact translations for the HTML-tagged `<i>Click to see next message</i>` source in Traditional Chinese (`tools/zh-Hant.ts`) and Japanese (`tools/ja_JP.ts`) language catalogs to prevent fallback issues.
- **Offline Re-auth and Tips Contract Verification**: Added contract assertions in `tools/check_app_contracts.js` to strictly verify the regex-based dynamic offline authentication countdown matching and check the exact HTML-tagged Tips translations in the Traditional Chinese and Japanese compiled resources.
- **Lazy QMenu Synchronous Translation**: Implemented `translateMenuBeforeFirstPaint` in the injector (`CavalryTranslatorInjector.mm`) to intercept QMenu `ActionAdded` and `Show` events. This translates lazy-loaded submenus synchronously *before* they are painted on screen, bypassing debounce-delayed refresh and eliminating the visual flash of English menu texts.
- **Contract Verification for Lazy Menus**: Added contract assertions in `tools/check_app_contracts.js` to strictly enforce synchronous translation on QMenu pre-paint events.
- **Roadmap Search Interface Classification**: Added a dedicated "Search Interface Classification" section to `docs/roadmap/localized-search-index.md` classifying search boxes (QuickAdd, Assets, Layer list, Attribute Editor) and establishing constraints to isolate user-facing dynamic fields from system search mappings.
- **Add Layer Localized Search Audit**: Added `docs/audits/add-layer-localized-search-2026-05-21.md` documenting the disconnect between user display translation and search filter indexes, outlining a proposed scoped query bridge architecture to map localized search queries back to their English source keys.
- **Composition Menu Lazy QAction Flicker Audit**: Added [composition-menu-lazy-action-flicker-2026-05-21.md](file:///Users/luo/Desktop/ClaudeCode/web/Cavalry-i18n/docs/audits/composition-menu-lazy-action-flicker-2026-05-21.md) documenting the dynamic QAction show-time resolution behavior in Cavalry's Composition menu, comparing Qt inventory state with AppKit native menu AX sampling, correcting the "delay-translation" design flaw, and detailing the synchronous `aboutToShow` pre-paint translation fix.
- **Runtime Refresh Performance Audit**: Added `docs/audits/runtime-refresh-performance-2026-05-21.md` identifying interaction repaint/flash issues as excessive global refresh scanning and proposing local dirty-object queue focus, session-scoped inventory gates, and frame-budget processing.
- **Future Engineering Roadmap**: Created `docs/roadmap/` directory with L2 mapping `CLAUDE.md`, a total index `README.md`, and two dedicated proposed roadmap tracks:
  - `localized-search-index.md`: Formulated a multi-stage roadmap (R1-R5) for localized search indexing covering live capture, reverse lookup tables, scoped query bridges, and regression verification.
  - `runtime-refresh-performance.md`: Formulated a multi-stage roadmap (R1-R5) for performance optimization covering event field decoupling, inventory gates, repeat-write avoidance, and validation.
- **Qt ABI Guarding in Contract Tests**: Added new test assertions in `tools/check_app_contracts.js` using `nm -u` on macOS to inspect the checked-in injector dylib, ensuring it does not import `QWidget::accessibleName()` or `QWidget::accessibleDescription()` symbols which are missing from Cavalry's Qt 6.6.3 runtime.
- **Audited Generated Shape Label Translations**: Added three-language coverage for 9 additional runtime-generated Shape labels (such as *Capsule Shape*, *Arrow Shape*, *Cogwheel Shape*, *Super Ellipse Shape*, *Arc Shape*, *Star Shape*, *Polygon Shape*, *Ellipse Shape*, *Rectangle Shape*) as well as shader settings (*Third Shaders*, *No Third Shaders*) in Japanese (`tools/ja_JP.ts`), Simplified Chinese (`tools/zh-Hans.ts`), and Traditional Chinese (`tools/zh-Hant.ts`) catalogs.
- **Dynamic Derived Shape Translation**: Implemented dynamic layer name translation logic (`translatedGeneratedLayerName`) inside the injector to automatically derive localized shape names (e.g. *Capsule Shape*) from base term translations and "Shape" to keep the compiled translation catalog clean.
- **Comprehensive No-Prefix Fallback Normalization**: Upgraded the dynamic No-prefix lookup algorithm in `translatedMixedNoPrefixText` to systematically resolve any prefixed fallback terms against vetted translation dictionary entries instead of hardcoding fallback strings.
- **Audited Attribute Editor Label Translations (Batch 5)**: Added three-language coverage for 3 additional attribute editor labels: *Override Mass* (`覆盖质量` / `覆蓋質量` / `質量を上書き`), *Direction Type* (`方向类型` / `方向類型` / `方向タイプ`), and *Cycles* (`周期数` / `週期數` / `サイクル数`) in Japanese (`tools/ja_JP.ts`), Simplified Chinese (`tools/zh-Hans.ts`), and Traditional Chinese (`tools/zh-Hant.ts`) catalogs.
- **Embedded Mixed No-Prefix Translation Normalization**: Added dynamic runtime translation support for mixed No-prefix labels (e.g. *No Mask* translations such as `No 蒙版` / `No 遮罩`) in `CavalryTranslatorInjector.mm` by checking stripped/fallback combinations to avoid redundant compile-time dictionary lookups.
- **Lottie Translation Refining (Simplified Chinese)**: Corrected translations for *Lottie Author* (`Lottie 作者`, was `乐天作者`) and *Lottie is a Pro Feature* (`Lottie 是 Pro 功能`, was `洛蒂是个特质`).
- **Codex Thread Handoff Audit**: Added `docs/audits/codex-thread-handoff-runtime-i18n-2026-05-20.md` containing a comprehensive compressed summary of the runtime i18n audit, root-cause diagnostics, completed translations (including over 100 runtime-generated Attribute Editor labels, Voronoi loop length, Tips, dynamic status bar count patterns), and handoff recommendations for MacOS sync validation.
- **Audited Generated Attribute Label Translations**: Added comprehensive localization support for over 100 runtime-generated Attribute Editor labels (e.g., *Color Mode*, *Blend Mode*, *Gradient Mode*, *Capture Force*, *No Mask*) in Japanese (`tools/ja_JP.ts`), Simplified Chinese (`tools/zh-Hans.ts`), and Traditional Chinese (`tools/zh-Hant.ts`) language catalogs.
- **Contract Verification for Attribute Labels**: Introduced a comprehensive contract suite in `tools/check_app_contracts.js` that checks for exact translations of all 100+ newly added generated Attribute Editor labels across targeted languages.
- **Audited Attribute Editor Label Translations (Batch 4)**: Expanded localization coverage for 9 additional runtime-generated Attribute Editor labels (e.g., *Controllers*, *Gradient*, *Dash, Gap*, *Particles Per Pixel*, *Use Emitter Velocity*, *Emitter Velocity*, *Speed Limit*, *Blind Color*, and index entry placeholders) in Japanese (`tools/ja_JP.ts`), Simplified Chinese (`tools/zh-Hans.ts`), and Traditional Chinese (`tools/zh-Hant.ts`) catalogs.
- **Contract Assertion Updates**: Extended contract tests in `tools/check_app_contracts.js` to strictly enforce translation accuracy for the fourth batch of 9 attribute labels.

### Changed
- **GEB Document Mapping for Workspace Workflows and UI Assets**: Updated file entries mapping `translation-backlog-template.csv` in `docs/workflows/cavalry-full-ui-100/CLAUDE.md`, and added entries for high-definition Japanese/Traditional Chinese UI screenshots (`ui-ja_JP-cls.png`, `ui-ja_JP.png`, `ui-zh-Hant.png`) in `docs/img/CLAUDE.md`.
- **Canva Authentication Translations**: Corrected and refined translation entries for Canva authentication and usage data sharing screens in Simplified Chinese (`tools/zh-Hans.ts`), Traditional Chinese (`tools/zh-Hant.ts`), and Japanese (`tools/ja_JP.ts`), ensuring brand words (Canva/Cavalry) are preserved intact and cleaning up previous Sign-in/Signing out mistranslations.
- **Embedded Translation Table Synchronizer**: Updated compiled injector tables `injector/generated_translations.inc` and recompiled dynamic library `injector/libCavalryTranslatorInjector.dylib` to embed the newly refined Canva authentication translations.
- **GEB Document Mapping for Canva Copy**: Updated L2 module map `tools/CLAUDE.md` and `check_app_contracts.js` L3 header to register the Canva authentication copy contract.
- **Synchronous QMenu aboutToShow Translation Interceptor**: Refactored the `QMenu::aboutToShow` interceptor in the C++ injector (`CavalryTranslatorInjector.mm`) to run synchronous, pre-paint menu translation directly instead of deferring via `CFRunLoopPerformBlock`. This converges all menu hooks into a single synchronous pre-paint pipeline.
- **GEB Document Mapping for aboutToShow Hook**: Synchronized L2 module maps `injector/CLAUDE.md` and `tools/CLAUDE.md`, and L3 file headers in both `CavalryTranslatorInjector.mm` and `check_app_contracts.js` to reflect the converged pre-paint menu translation contract under the GEB fractal document protocol.
- **Recompiled Injector Dylib**: Rebuilt the universal precompiled library `injector/libCavalryTranslatorInjector.dylib` to embed the synchronous QMenu aboutToShow translation engine.
- **GEB Document Sync & L2 Logging for Re-auth**: Synchronized L2 maps `tools/CLAUDE.md` and `injector/CLAUDE.md` as well as the L3 header inside `CavalryTranslatorInjector.mm` to reflect the newly integrated dynamic offline countdown translation logic and HTML-tagged Tips translations.
- **Recompiled Injector Dylib & Generated Tables**: Updated compiler table `injector/generated_translations.inc` and recompiled the dynamic library `injector/libCavalryTranslatorInjector.dylib` to embed the dynamic offline countdown translation and correct the compiled static assets.
- **GEB Document Sync & L2 Logging**: Synchronized L2 maps in `tools/CLAUDE.md` and `injector/CLAUDE.md` to record the lazy QMenu translation hooks, contract assertions, and compiled dylib updates.
- **Precompiled Injector Dylib**: Rebuilt and updated the universal binary `injector/libCavalryTranslatorInjector.dylib` with the new synchronous QMenu event translation hooks.
- **Updated UI Localized Screenshots**: Updated high-definition localized interface screenshots (`docs/img/ui-zh-Hans.png` and `docs/img/ui-zh-Hant.png`).
- **macOS-Only Runtime & Dynamic Normalization in Documentation**: Revised public READMEs (`README.md`, `README.zh-Hans.md`, `README.zh-Hant.md`, `README.ja_JP.md`) to explicitly highlight the macOS-only runtime environment, dynamically inserted libraries (`DYLD_INSERT_LIBRARIES`) injection path, and runtime UI dynamic normalization behavior (such as derived shape layer names, Attribute Editor labels, colon-suffixed labels).
- **GEB Document Mapping & Metadata Sync**: Synchronized L1 `docs/CLAUDE.md` and L2 `docs/audits/CLAUDE.md` to reflect the newly introduced `roadmap/` folder, audit files, and standard L3 protocol headers.
- **ABI-Safe Accessibility Check in Injector**: Modified `isTimeEditorItemWidget` in `injector/CavalryTranslatorInjector.mm` to read accessibility strings through QObject properties (`widget->property("accessibleName")`/`accessibleDescription`) instead of calling the missing QWidget accessors directly, maintaining strict Qt 6.6.3 ABI compatibility.
- **Scoped Time Editor Item Protection**: Refined timeline-unsafe write-back protection by checking the concrete widget context (`isTimeEditorItemWidget`) instead of a blanket string matching check, preventing Scene View layer lists on the left-side tree from being incorrectly treated as Time Editor elements and left untranslated.
- **Synchronized Embedded Translation Table & Precompiled Injector**: Updated compiled static translation lookup tables in `injector/generated_translations.inc` and rebuilt the dynamic library `libCavalryTranslatorInjector.dylib`.
- **Physics and Wave Terminology Corrections**:
  - Aligned *Force Velocity* translation to `力矢量` in Simplified Chinese (was `力速度`), `力向量` in Traditional Chinese (was `力速度`), and `力ベクトル` in Japanese (was `力の速度`) across language JSON nodeStrings (`languages/*/nodeStrings.json`), tools catalogs, and contract tests.
  - Aligned *Adaptive Wave Counts* translation to `自适应波数` in Simplified Chinese (was `自适应波形数量`), `自適應波數` in Traditional Chinese (was `自適應波形數量`).
  - Aligned *No Mask* in Traditional Chinese to `無遮罩` (was `無蒙版`).
- **Synchronized Embedded Translation Table**: Updated compiled injector tables `injector/generated_translations.inc` and recompiled dynamic library `libCavalryTranslatorInjector.dylib` to embed the newly audited translations and compile-time static lookup entries.
- **Allowed Excel Brand Combinations**: Whitelisted "Excel" as a protected brand name in `tools/forbidden_translation_patterns.json`, `docs/cavalry-glossary.md`, and `docs/translation-guidelines.md` to permit term glossary integrations like `Excel 工作表` and `Excel シート` while guarding it from generic translation.
- **Consolidated Packaged Resource Path Lookup**: Introduced a unified `resource_candidates` helper in `src-tauri/src/commands.rs` to merge duplicate path construction logic for language packs and injector source dylib candidates, eliminating redundant candidates calculation and ensuring a single source of truth for resolution order (`resource_dir` → `resource_dir/_up_` → `resource_dir.parent()` → `repo_root`).
- **CamelCase-Only Tauri Bridge Integration**: Refactored `tauri-bridge.js` to drop obsolete `snake_case` fallbacks and unconsumed fields (`repoRoot`, `diagnostics`), ensuring it only processes `camelCase` properties and only forwards the precise properties required by the renderer.
- **Removed ExtensionLayer Mach-O Patching Infrastructure**: Completely removed dormant patch tables, compact literal fallback structures, vm/mprotect memory write permissions logic, and dyld image callback registrations from the injector (`CavalryTranslatorInjector.mm`). Standardized the ExtensionLayer self-painted interface to remain in English because its renderer doesn't support CJK font rendering.
- **GEB Document Mapping & Metadata Sync**: Synchronized the L2 map in `docs/audits/CLAUDE.md`, `src-tauri/src/CLAUDE.md`, `injector/CLAUDE.md`, `renderer/CLAUDE.md`, `tools/CLAUDE.md`, and their corresponding L3 headers to reflect the pruned ExtensionLayer patcher paths, consolidated resource candidate architecture, the new dated codex thread handoff audit report, and refined bridge interfaces. Updated `docs/code-review-report.md` to document the second batch of resource path cleanups.

### Fixed
- **Contract Enforcement and Testing**:
  - Added a contract test `'embedded injector normalizes mixed No-prefix widget labels'` and updated Batch 5 label contract assertions in `tools/check_app_contracts.js` to ensure the exact translations exist.
  - Added a unit test suite `resource_candidates_use_one_packaged_root_order_before_repo_fallback` in `src-tauri/src/commands.rs` to lock down priority and order in unified resource path resolving.
  - Updated `tools/check_app_contracts.js` to ensure the injector doesn't contain references to dormant dyld registration or patch functions (`patchExtensionLayerImage`, etc.).
  - Added a new runtime contract test in `tools/check_tauri_bridge_runtime.js` to lock down the camelCase-only property filtering behavior.
  - Updated `tools/check_renderer_contract.js` with the fresh SHA-256 hash of `tauri-bridge.js`.

## [0.3.0] - 2026-05-20

### Added
- **Voronoi Shader Loop Length Translation**: Added `loopLength` (Loop Length / 循环长度 / 循環長度 / ループ長) attribute translation to `voronoiShader` node strings in English, Simplified Chinese, Traditional Chinese, and Japanese language catalogs.
- **Contract Verification for Voronoi Loop Length**: Added a contract test `Voronoi Shader nodeStrings include runtime loop length label` in `tools/check_app_contracts.js` to ensure the exact `loopLength` attribute translations are consistently present across all language packs.
- **Tips QLabel Text Translation**: Added `Click to see next message` source translation in Japanese, Simplified Chinese, and Traditional Chinese to cover raw label rendering in the Tips panel.
- **Contract Verification for Tips Text**: Added contract tests in `tools/check_app_contracts.js` to ensure the exact translation of `Click to see next message` is present across all languages.
- **Colon-Suffixed Label Translation**: Implemented dynamic colon-suffixed label fallback inside the C++ injector to automatically translate labels like `Looping:` by stripping the colon and looking up `Looping`.
- **Contract Verification for Colon Labels**: Added contract tests in `tools/check_app_contracts.js` to ensure the dynamic colon-suffix logic is preserved and properly regression-tested.
- **Add Layers Empty Cards Audit**: Added `docs/audits/add-layers-runtime-model-capture-2026-05-20.md` documenting empty title rows in `QuickAddWindow`, `DisplayRole`/`EditRole` analysis, and token triage boundary definitions.
- **Qt Item Model Capture Workflow**: Documented the item model dump procedure, role analysis checklist, and file classification guidelines inside `docs/runtime-ui-live-capture-workflow.md`.
- **Qt Item Model Serialization**: Added `serializeItemViewModel` and `serializeModelRows` to serialize and capture Qt item model structures in the runtime inventory for downstream coverage auditing.
- **Debounced Dynamic Translation Refresh**: Implemented GCD-based coalescing (`scheduleInteractiveRefresh`) to debounce and schedule translation refreshes for dynamic widgets and late-loaded layouts during event-filter callbacks.
- **Quick-Add Empty Rows Pruning**: Implemented `pruneQuickAddEmptyItems` in the injector to clean up empty list rows inside `QuickAddWindow`, preventing blank card residues in the Add Layer dialog.
- **Add Layer UI & Attribute Translations**: Completed missing translation entries for the Add Layer dialog and dynamic attribute panels in both Simplified and Traditional Chinese, and Japanese translation files.
- **Forge Dynamics Attribute Translations**: Added localization support for *Ground Friction*, *Ground Bounce*, *Velocity Iterations*, *Position Iterations*, *Fields*, and *Un-Parent* in the translation catalogs and `forgeDynamicsShape` node properties.
- **Dynamic Status Bar Selection Translation**: Implemented regex-based status bar selection count localization (e.g. `([0-9]+) selected`) in the C++ injector to translate selection status displays dynamically across all locales.
- **Runtime Noise Quarantine**: Added `tools/runtime-noise-quarantine.json` containing 20 audited short tokens (e.g. `Rhu`) that lack translation provenance.
- **Contract Verification for Quarantine**: Added a contract test in `tools/check_app_contracts.js` to assert that quarantined noise tokens are filtered and do not enter compile-time tables.
- **Cavalry-i18n Code Review Report**: Added `docs/code-review-report.md` performing a thorough audit of dead code, redundant logic, and architecture detours.
- **Runtime Translation Noise Triage Audit**: Added `docs/audits/runtime-translation-noise-triage-2026-05-19.md` listing triage logs and evidence checkouts for 21 candidate tokens.
- **Runtime Translation Noise Triage Protocol**: Added `docs/runtime-translation-noise-triage.md` outlining the triage steps, evidence levels, and quarantine rules for runtime translation short tokens (e.g., `Rhu`), and linked it in `docs/CLAUDE.md`.
- **Dynamic Frame Keyframe Translation**: Implemented regex-based interceptor in `CavalryTranslatorInjector.mm` to localize Time Editor's "Add Keyframe on frame <n>" context-menu actions dynamically across all supported locales.
- **Animation and Timing Translations**: Added Japanese, Simplified Chinese, and Traditional Chinese translation support for animation/timing variables including *Copy Animated Attribute*, *Clip(s)*, *Start Frame*, *Seed*, *Lifespan*, *Emitters*, *Turbulence*, *Gravity*, *Drag Force*, *Mass*, *Timing Mode*, *Group By Parent*, *Parent Timing Mode*, and *Reverse Parent Order*.
- **Contract Verification for Animation Terms**: Added corresponding test assertions in `tools/check_app_contracts.js` to verify these newly added parameters and dynamic menu translation schemas exist in all language assets.
- **Ellipsis Menu Variant Generation**: Dynamically derive ellipsis (`...`) variants for `ModelDisplay` translation entries during compile-time header generation to cover context-menu actions while keeping NiceNames in English.

### Changed
- **Unsaved Scene Translation Cleanup**: Refined the localization of `You are working in an unsaved scene.` in `tools/zh-Hans.ts` to `你正在未保存的场景中工作。`, synchronizing it to `injector/generated_translations.inc`.
- **GEB Document Mapping**: Aligned L1 and L2 maps in `docs/CLAUDE.md` and `docs/audits/CLAUDE.md` with the new dated audit reports and folder boundary conventions.
- **Definition Tag Token Restoration**: Reverted localized tags back to standard English source tokens (e.g., `Distribution`, `Spiral`, `Bezier`) in Simplified Chinese, Traditional Chinese, and Japanese language packs to keep tag chips matching Cavalry's native tags rendering.
- **Smoother Node Elimination**: Purged obsolete, undefined `smoother` node definitions from JSON assets and translation lists to prevent orphan blank cards in the Add Layer dialog.
- **Directory Renaming & Path Migration**: Renamed the `doc` directory to `docs` to align with standard conventions, migrating all path references, contract tests (`check_app_contracts.js`), translation sources (`ja_JP.ts`, `zh-Hans.ts`, `zh-Hant.ts`), and configuration files (`translation-whitelist.json`).
- **Embedded Translation Filtering**: Updated `tools/generate_embedded_translations.js` to load the noise quarantine list and filter out unproven tokens, preventing bulk translation pollution (e.g., `Rhu -> 鲁/ログイン`) in `injector/generated_translations.inc`.
- **GEB Document Synchronization**: Updated L2 and L3 headers in `tools/CLAUDE.md` and `tools/check_app_contracts.js` to document the new quarantine config and test verification structures.

### Fixed
- **Retina Resolution Screenshot Regression**: Patched `check_tauri_window_regression.js` to normalize the captured screenshot content size using the backing scale factor (2x/3x on Retina/High-DPI displays), resolving window regression check failures on high-DPI Mac displays.
- **Model niceName Preservation**: Reverted `niceName` fields to English across all translation files to prevent Time Editor rendering issues and model key serialization errors in Cavalry.
- **Widget Mutation Boundary Protection**: Refactored the timeline-unsafe protection to intercept `QListWidgetItem` and `QTreeWidgetItem` values at the mutation boundary via `shouldPreserveModelBackedItemText` instead of using the global QTranslator.
- **Contract Enforcement**: Updated contract tests to verify that `niceName` values stay English in `nodeStrings.json` and all plugin translation files across Simplified Chinese, Traditional Chinese, and Japanese.
- **Whitelist Enforcement**: Configured `translation-whitelist.json` to move `niceName` from `translate` to `no_translate` to prevent future localization regressions.

### Changed
- **Localization Enhancements**: Unified and corrected terminology translations across Simplified Chinese, Traditional Chinese, and Japanese.
  - Refined *Duplicator* translation in Japanese to "デュプリケーター" (previously "複製器") and *Grid Layout* in Traditional Chinese to "網格佈局".
  - Synchronized *Schedule Stagger* translation to "错开排程" / "錯開排程" / "スケジュールスタッガー" across all languages.
  - Aligned node display translations in `tools/model_display_translations.json` for *Align*, *Animation Control*, *Cel Animation Shape*, *Rubber Hose Limb*, *Shape Skew*, *Text Shape*, and *Vertical/Horizontal Layout Groups*.
  - Added missing translations for *Notes...* ("备注..." / "備註...") and other standard node items.

## [0.2.0] - 2026-05-17

### Added
- **ExtensionLayer Mach-O Patching**: Implemented direct `__cstring` patching for `ExtensionLayer.dylib` to translate hardcoded UI strings (e.g., "Empty State" prompts) that are inaccessible via standard Qt property hooks.
- **Compound Widget Translation**: Added line-by-line translation support for multiline widgets and tooltips, ensuring partial matches succeed when exact full-string matches fail.
- **Expanded UI Coverage**: Implemented QLineEdit value translation (e.g., default "Keyframe Layer" names) and added missing translations for 11 critical UI sources.
- **Live Capture Orchestrator**: Added `--help` support and refined coverage allowlists (regex-based noise filtering) for the automated UI capture workflow.

### Fixed
- **Menu Translation Reliability**: Improved `aboutToShow` menu interception using `CFRunLoopPerformBlock` with `kCFRunLoopCommonModes` to ensure translations apply reliably during active menu tracking.
- **Shortcuts & Symbols**: Corrected semantic errors in shortcut key tokens and fixed exact-source matching for specialized symbols.

### Documentation & Tooling
- **Architecture Cleanup**: Archived 5 completed implementation plans, merged multi-language glossaries, and synchronized localized README previews.
- **Contract Enforcement**: Updated `check_app_contracts.js` to lock down new Mach-O patching and compound translation architectural requirements.

## [0.1.11] - 2026-05-15

### Fixed
- Fixed packaged GitHub builds so Tauri runtime resource resolution finds bundled `languages` and `injector` assets when `resource_dir()` points at either `Contents/Resources` or its `_up_` resource base.

## [0.1.10] - 2026-05-15

### Documentation
- Added macOS first-launch quarantine guidance and local agent build prompts to public READMEs, GitHub Release notes, and the local build SOP.

### Fixed
- Fixed packaged GitHub builds so `get_status` and language application read bundled `Contents/Resources/languages` instead of the compile-time repository path.

## [0.1.9] - 2026-05-15

### Fixed
- **macOS Quarantine Launch**: Added explicit Tauri ad-hoc bundle signing with `bundle.macOS.signingIdentity = "-"` and `APPLE_SIGNING_IDENTITY="-"`, then gated the packaged `.app`, DMG-contained `.app`, and installed-copy `.app` with `codesign --verify --deep --strict` to prevent browser-downloaded builds from opening as damaged.

## [0.1.8] - 2026-05-15

### Fixed
- **DMG Volume Icon Persistence**: `tools/stamp_dmg_icon.sh` now writes `src-tauri/icons/icon.icns` into the DMG filesystem as `.VolumeIcon.icns`, sets the mounted volume custom-icon bit, and recompresses the direct `.dmg` so GitHub Release downloads preserve the mounted volume icon without zip wrapping.
- **DMG Layout Gate**: `tools/check_dmg_layout.sh` now verifies the mounted volume custom-icon bit in addition to `.DS_Store`, background image, Applications link, and the app bundle.

## [0.1.7] - 2026-05-15

### Fixed
- **GitHub DMG Finder Layout**: The macOS packaging step now unsets `CI` before `npm run tauri:build`, allowing Tauri/create-dmg to run Finder layout automation for DMG background, window sizing, and icon placement.
- **DMG Layout Gate**: Added `tools/check_dmg_layout.sh` and `npm run test:tauri:dmg-layout` to mount the real DMG and verify `.DS_Store`, `.background/background.png`, `.VolumeIcon.icns`, the Applications link, and the packaged app before upload.
- **GitHub Release Notes**: Release automation now writes a product-named title and explicit macOS Apple Silicon download notes instead of publishing only an auto-generated changelog link.

## [0.1.5] - 2026-05-15

### Changed
- **GitHub Release Asset Shape**: GitHub tag releases now publish the macOS Apple Silicon installer directly as a `.dmg` asset, matching the common desktop-app release structure instead of adding an extra `.dmg.zip` wrapper.

## [0.1.4] - 2026-05-14

### Added
- **Project Version Synchronizer**: Added `tools/sync_project_version.js` to use the latest formal `CHANGELOG.md` release as the single source of truth and propagate it to `package.json`, `package-lock.json`, `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json`, and `src-tauri/Cargo.lock`.
- **Git Version Hook**: Added `tools/git-hooks/pre-commit` and npm hook installation commands so local commits automatically restage synchronized npm, Cargo, and Tauri version metadata.
- **GitHub Manual Packaging**: Added `workflow_dispatch` to the GitHub Actions Tauri workflow so macOS packaging can be started manually from GitHub.

### Changed
- **CI Version Gate**: Added `npm run check:version` to both the Linux validation job and macOS packaging job, preventing drifted version metadata from entering CI artifacts or GitHub Releases.
- **macOS Qt SDK Bootstrap**: Updated the GitHub macOS packaging job to install `aqtinstall` in an isolated Python venv, pass that interpreter to the Qt SDK resolver, and mirror `LOCAL_BUILD_SOP.md` with explicit `npm run tauri:build`, DMG stamping, and all non-local SOP verification gates.
- **GEB Documentation Sync**: Updated `tools/CLAUDE.md`, `tools/git-hooks/CLAUDE.md`, and `.github/workflows/CLAUDE.md` so the document map mirrors the new version and packaging automation.

## [0.1.3] - 2026-05-14

### Fixed
- **Translation Quality (zh-Hans/zh-Hant/ja_JP)**: Batch terminology and quality corrections across 3 languages.
  - Reverted `pivot` translation back to `锚点`/`錨點` per glossary (was incorrectly changed to `轴心`/`軸心`).
  - Fixed zh-Hant `spheriseFilter.json`: restored English-leaked tabs back to Chinese, corrected `Back` → `背面`.
  - Fixed zh-Hant `zoomBlurFilter.json`: restored `origin` → `原點`.
  - Unified zh-Hant terminology: `質量` → `品質`, `圖像` → `影像`, `屏幕` → `螢幕`, `控製` → `控制`.
  - Fixed ja_JP Chinese-Japanese mixed-language strings in lattice deformers, fluid dynamics, and path operations.
  - Expanded `forbidden_translation_patterns.json` allowlist with `Forge`, `Dynamics`, `Shift`, `Ctrl` etc.
  - **Added `niceName` coverage**: Populated `niceName` fields for basic shapes (Rectangle, Ellipse, Polygon), lines (Bezier, Spiral, Straight), and background shapes in `nodeStrings.json` across all languages.

### Added

- **Qt Widget Translation & Periodic UI Refresh**:
  - Implemented automatic translation for non-menu QWidgets including `QLabel`, `QAbstractButton`, `QGroupBox`, `QLineEdit`, and `QTabBar` in `CavalryTranslatorInjector.mm`.
  - Added delayed periodic refresh attempts (`scheduleRefreshAttempts`) to capture dynamically spawned UI widgets after initial app launch.
  - Added comprehensive test assertions in `tools/check_app_contracts.js` validating widget translation coverage and scheduler actions.
- **Qt Translator Injector**: Introduced `injector/` module (Objective-C++) for runtime Qt menu interception.
  - Implemented `EmbeddedTranslator` (QTranslator subclass) for high-performance string replacement.
  - Added support for "English dump-only" mode to capture runtime UI inventories.
  - Integrated GEB Fractal Documentation System (L1/L2/L3) for architectural integrity.
- **Tauri Native Bridge**: Enhanced Rust-to-JS bridge with better error handling and permission pre-checks.
- **Build Infrastructure**:
  - Corrected `LOCAL_BUILD_SOP.md` path in `check_tauri_build_sop.js` after file relocation.
  - Stabilized AppleScript-based window detection in `window_contract_lib.js` by using safer process iteration and error handling.

### Changed
- **Tauri Transition**: Formally promoted Tauri as the exclusive runtime, completing the migration from Electron.
- **Test Infrastructure**: Refactored all contract tests to target the Tauri-only architecture.
  - Updated `check_app_contracts.js` to orchestrate full-stack validation.
  - Standardized on `~/Library/Caches/Cavalry-i18n/` for runtime session and inventory storage.

### Removed
- **Electron Deprecation**: Purged all legacy Electron artifacts and dependencies.
  - Removed `electron-builder`, `electron-rebuild`, and related development scripts.
  - Deleted legacy Electron testing harness (`electron_harness.js`, `capture_electron_contract.js`, etc.).
  - Purged Electron-specific UI snapshots and fixtures.


## [0.1.2] - 2026-04-25

### Added
- **Tauri v2**: Primary distribution shell with Rust business logic, replacing Electron as the default build path.
  - `commands.rs`: 6 Tauri IPC commands (`get_status`, `browse_app`, `extract_english`, `apply_language`, `restart_cavalry`, `open_privacy_security`).
  - `detect.rs` / `patch.rs` / `mac_runtime.rs` / `state.rs`: Rust ports of Electron patcher modules.
  - `keychain_patch.rs`: Mach-O binary patching for Keychain login persistence — NOP-patches `kSecAttrAccessGroup` and `kSecAttrSynchronizable` attribute writes in `libExtensionLayer.dylib` to prevent credential loss after patching. Supports arm64 and x86_64. Returns granular per-function `KeychainPatchDetail` reports.
  - `privilege.rs`: `CommandRunner` trait abstracting system calls (copy, resign, quarantine clear, restart) with `RecordingRunner` for test isolation.
  - `bridge.rs`: Pre-page-load JS bridge injection (`tauri-bridge.js` compiled via `include_str!`).
  - 10 Rust contract tests covering commands, detection, patch mapping, Mac runtime, privileges, state, Tauri config, bridge, and window regression.
- **Renderer**: Full i18n support with runtime locale detection (English, zh-Hans, zh-Hant, ja_JP). Modal interaction system for confirmations and permission guidance. "App Management" permission status feedback with retry flow.
- **UI text workflow**: Compiled Qt/UI translation surface with generated cache `compiled-ui-source-map.json`, runtime `menu-inventory.json`, and `runtime_ui_allowlist.json`. Coverage gate at ≥99%.
- **Tooling**: `stamp_dmg_icon.sh` for DMG volume icon embedding. `check_full_ui_coverage.js` and `check_full_ui_matrix.js` for per-language gate runs. `resolve_cavalry_qt_sdk.js` with `cavalry_qt_target.json` for centralized Cavalry/Qt SDK resolution.
- **CI/CD**: 3-job GitHub Actions pipeline (ubuntu contract validation, macos packaging, tag-triggered release). Translation quality gates in CI with markdown summary.

### Changed
- **Build system**: `npm run build` now defaults to `npm run tauri:build`. `npm run build:electron` is the explicit Electron fallback.
- **Window size**: Tauri window is 480×528 (vs Electron's 480×500 content area) to compensate for macOS titlebar height.
- **Renderer**: Refactored `app.js` into state-driven localization and modal architecture. `tauri-bridge.js` normalizes Tauri snake_case responses to camelCase for `app.js` compatibility.
- **Dependencies**: Pinned `tauri` to 2.10.3, `@tauri-apps/api` and `@tauri-apps/cli` to 2.10.1, `tauri-build` to 2.5.6.
- **CI**: macOS packaging uses `npm run prepare:qt-sdk` instead of inline Qt version in workflow YAML.

### Fixed
- Race condition during "Apply & Restart" — permission check-ins now occur before file operations.
- Incorrect symbol offset calculations for ARM64/x86_64 fat binaries in `keychain_patch.rs`.
- Added support for patching the `valueExists` Keychain symbol in `libExtensionLayer.dylib`.

### Removed
- Electron as default build target (retained as explicit fallback via `build:electron` / `desktop`).

---

## [0.1.0] - 2026-04-23

### Added
- Initial release: Electron-based desktop patcher for Cavalry i18n.
- JSON language pack patching for `nodeStrings`, `appStrings`, `tips`, `onboarding`, and plugin files.
- macOS runtime injection via `libCavalryTranslatorInjector.dylib` loaded through `DYLD_INSERT_LIBRARIES`.
- Launcher wrapper + `CFBundleExecutable` patching for transparent translated launches.
- Bundle re-signing and Gatekeeper quarantine clearing.
- Finder fallback for privileged copy operations.
- 4-language support: English, Simplified Chinese, Traditional Chinese, Japanese.
- Translation validation pipeline with `validate_translations.py`.
- Electron-builder DMG packaging with custom icon.
