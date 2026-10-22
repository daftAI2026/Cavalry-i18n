<!--
[INPUT]: 依赖Windows唯一native wrapper与CI官方输入、冻结2.7.2默认profile及2.8.0三平台production profile、官方Qt6.9.2、同源码目标架构native runtime、production语言包和Tauri平台/release overlays
[OUTPUT]: 提供macOS双架构和Windows x64生产构建、隔离合同、资源检查及已授权tag发布闭包
[POS]: 仓库唯一桌面打包SOP；本地macOS生产包不代替公开发行验收
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
-->

# Cavalry Language Switcher 本地打包 SOP - Tauri

本文档记录唯一发布路径：Tauri。旧壳层和 fallback 打包链路已移除，不再作为本地或 CI 发布入口。

## 1. 核心依赖

- Node 依赖：`@tauri-apps/cli`、`@tauri-apps/api` 固定在 `2.10.1`。
- Rust 依赖：`tauri` 固定在 `2.10.3`，`tauri-build` 固定在 `2.5.6`；`sha2` 同时用于运行时摘要与 build script 发布资源 trust anchor。Rust **channel** 由根目录 `rust-toolchain.toml` 固定（当前 `1.98.0`）。
- Qt bootstrap：`requirements-ci.txt` 固定 `aqtinstall==3.3.0` 及其完整依赖摘要；旧 `prepare:qt-sdk` 创建 ignored 的 repo-local venv 并以 `--require-hashes` 安装，绝不信任全局 aqt。Windows CMake bootstrap 由 `tools/resolve_windows_cmake.js` 消费 `tools/ci_action_pins.json` 中官方 Kitware/CMake v4.4.3 Windows x64 zip 的固定 URL/SHA-256，重新解包，执行 `cmake --version` 并验证 CTest 同包布局；不会消费 runner PATH 中的预装版本。GitHub Actions 全量 pin 见 `tools/ci_action_pins.json`。
- 2.8.0 macOS ARM依赖：使用官方Cavalry 2.8.0 Qt `6.9.2` 与同源码已验的arm64 native runtime绝对路径。主构建直接打包该dylib，不运行旧Qt `6.6.3` 的 `build:injector`。
- 历史injector依赖：`tools/cavalry_qt_target.json` 保留版本化SDK投影。旧2.7 injector使用Qt `6.6.3`；Windows路径另按其既有配置执行。不要用旧injector替代2.8.0 native runtime。

本地dev使用 `debug = "line-tables-only"`。
test继承dev；release默认不变。
回溯保留文件与行号，不保留变量调试信息。
此配置减少新产物体积，不会删除旧缓存或限制target总量。
清理前退出测试壳并冻结成功制品。
只删除已确认可重建的本项目缓存。
保留native语言包输入；不要用 `cargo clean` 一并删除。

以下Qt SDK命令属于2.7终版历史参考，不是2.8.0执行入口。2.8.0两平台使用官方Qt6.9.2；Windows入口见8.1，不使用这些旧SDK命令。

```bash
npm run prepare:qt-sdk          # macOS
npm run prepare:qt-sdk:windows  # Windows x64
```

## 2. Agent 本地构建话术

如果开发者不想使用 GitHub Release 下载包，可以让本机 agent 按本 SOP 构建。推荐提示词：

```text
请从源码本地构建 Cavalry Language Switcher：

1. 打开仓库 <repository-path>。
2. 严格按照 LOCAL_BUILD_SOP.md 执行。
3. 运行标准 Tauri build、执行 DMG 卷宗图标盖章，并运行 SOP 里的 packaged checks。
4. 完成后告诉我最终 DMG 路径。
```

本地构建产物不是浏览器下载文件，默认不会携带 Chrome/GitHub 下载写入的 `com.apple.quarantine` 标记。

## 3. Release 版本协议

发布版本分两层，不能混用：

- Internal app version: SemVer，写在 `CHANGELOG.md`、`package.json`、`src-tauri/Cargo.toml` 与 `src-tauri/tauri.conf.json`，由 `npm run sync:version` 同步。
- Release tag：`cavalry-2.7.2-pN` 仅属历史协议；p12终版只作历史下载，停止2.7开发、更新、验收与p12复核维护。`release.config.json` 保留冻结的2.7.2 p12默认profile，供历史元数据读取与合同核验。统一 `latest.json` 更新入口，不按宿主版本拆通道；该名称和下载基础地址仍与2.8.0共用。
- 当前 Cavalry 2.8.0 使用 `release-2.8.config.json` 与 `cavalry-2.8.0-pN`。本地生产包与历史客户端共用 `latest.json` endpoint overlay；workflow按所选2.8.0 profile向tag打包命令传统一endpoint overlay。Intel的2.8.0 x86_64及Windows native本地构建入口已接通；三平台生产runtime与验收已闭合，维护者已批准2.8.0首发。Intel实机UI尚未验，不作为本地编译通过的阻断。不得给旧2.7 runtime换名称；保留三平台production构建与发布闭包。
- 历史p12三种发布资产由冻结的 `release.config.json` 命名；它们不是当前2.8.0发布资产：
  - Apple Silicon: `Cavalry.Language.Switcher_Cavalry-2.7.2-p12_aarch64.dmg`
  - Intel: `Cavalry.Language.Switcher_Cavalry-2.7.2-p12_x64.dmg`
- Windows x64 NSIS asset: `Cavalry.Language.Switcher_Cavalry-2.7.2-p12_windows-x64-setup.exe`
  `tools/release_metadata.js` 从冻结profile重建这些历史名称。当前2.8.0资产由显式 `release-2.8.config.json` profile生成，workflow不允许手写漂移；release job会下载Windows build artifact，将Tauri原始EXE名规范化后，与两个DMG一次性上传。

打标前先跑：

```bash
npm run check:version
node tools/release_metadata.js --profile release-2.8.config.json --check
npm run test:contracts
node tools/verify_ci_action_pins.js
node tools/verify_source_artifact.js --check-repo --check-workflow
```

### 3.1 Tag release runbook（最小可信闭环）

1. 只在Intel、Apple Silicon与Windows的2.8.0生产runtime和验收闭合后考虑公开tag。本地arm64包不关闭三平台guard。
2. 执行本节开头的版本、2.8.0 profile、合同、Actions pin与source artifact检查，再从 `release-2.8.config.json` 复核tag/title/资产名：

```bash
TAG='cavalry-2.8.0-pN'
node tools/release_metadata.js --profile release-2.8.config.json --tag "$TAG" --format json
git fetch origin main --tags
test "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)"
git tag -a "$TAG" -m "Cavalry Language Switcher for Cavalry 2.8.0 patch N"
git push origin "$TAG"
```

3. Tag 流水线会先验证tag ancestry与三平台闭包，再运行合同、Rust/native、Windows NSIS与macOS打包检查。维护者批准首发后已移除迁移期无条件拦截；tag仍须属于main，且三平台打包、updater签名及资产回读全部成功。
4. 2.7 p12仅保留历史下载，不复验、不更新、不维护。新版Release发布新的 `latest.json`；宿主版本不匹配时复用主窗口提示与p12下载入口。只有三平台runtime与验收就绪后，才按2.8.0 profile执行publisher。新2.8.0资产仍由CI生成 `SHA256SUMS` 与 `release-asset-provenance.json`；此流程不改写p12历史资产。
5. **Apple Developer ID/notarization** 与 **Windows Authenticode** 均不在当前 SOP 的发布前提内；获得相应身份后再单独升级，不得预先写成已完成。macOS updater 仍由独立 Tauri Ed25519 签名验证，但它不创造 Apple 平台身份。当前2.8.0 macOS-only手动预验不提供 no-tag updater-signing smoke；updater私钥与签名仅在tag生产流程使用。

6. Release 正文由 workflow 中的版本更新记录与固定用户指引组成。**从 p8 开始，版本更新说明只显示中文**，不额外显示“中文 / English”语言标题。CHANGELOG 使用 Added/Changed/Fixed 等稳定英文分类键，条目写本版实际中文变化；抽取器只把分类标题映射为新增/变更/修复，不自动翻译正文，不用产品介绍代替更新条目。未来 GitHub Release 与 updater notes 共用该中文投影。已发布正文修订不替换历史 updater manifest 或安装包。固定部分保留 macOS 首次打开、Windows 首次安装、带版本链接的源码构建步骤、四语支持列表、权限/备份须知及简短英日说明；不要用维护者私有绝对路径替代通用 `<仓库路径>`。只修改已发布正文时使用 `gh release edit --notes-file`，不重打 tag、不替换资产，并回读正文及资产摘要。
7. 所选 profile 的资产完成回读且 Release 公开后，`tools/post_release_reactions.js <tag> <owner/repo> [--profile <config>]` 添加并分页回读 👍、😄、🎉、❤️、🚀、👀 六种 reactions。默认 profile 是 2.7；2.8.0 必须显式给出 2.8.0 profile。GitHub 按账号去重；CI 使用现有 job token，失败作为非阻断提示，不重新发布资产。可用同一命令为已公开版本补做，但拒绝 draft/prerelease。

### 3.2 版本更新说明模板

在对应 SemVer 的 CHANGELOG 区块填写实际中文条目。英文分类键只保存结构语义，发布抽取器将其转换为中文标题；不生成双语副本或“中文 / English”标题。历史版本原文不改，不为补正文重发二进制。

```markdown
## [x.y.z] - YYYY-MM-DD

### Fixed
- 本版本实际解决的问题及用户可感知的结果。
```

分类映射为：Added → 新增、Changed → 变更、Deprecated → 弃用、Removed → 移除、Fixed → 修复、Security → 安全。只写本版需要的分类，不留空标题。每个条目使用单行 `- 中文说明`，分类内只允许条目及空行，不放代码围栏、HTML 注释或独立说明段。门禁检查唯一受支持分类、非空条目且逐条包含中文；文案准确性仍由 review 确认。

## 4. macOS 标准打包流程

### 4.1 macOS 2.8.0 Apple Silicon ad-hoc production package

先按4.1.0生成production语言包，并指向同源码已验的arm64 native runtime绝对路径。
`build:tauri`会调用本地生产构建、DMG盖章与production packaged检查。
这条本地ARM路径不公开发行，也不替代Intel构建与Windows验收，也不替代三平台生产发布闭包。
清理过期bundle前，先冻结上次成功制品与receipt，再按已有cleanup SOP定向删除确认过期的产物。不得删除已冻结成功制品，也不要用泛化 `rm -rf .../bundle`。

```bash
export CSC_IDENTITY_AUTO_DISCOVERY=false
export APPLE_SIGNING_IDENTITY="-"
npm run build:tauri
```

#### 4.1.0 2.8.0 Apple Silicon production inputs

该入口打包2.8.0 arm64生产profile，不代表公开release。
它使用官方Cavalry 2.8.0 assets、Qt `6.9.2`与同源码已验的arm64 native runtime绝对路径。
不要调用旧Qt `6.6.3` `build:injector`。

显式从官方2.8.0 app生成完整production语言包：

```bash
npm run build:native-resources -- --assets-root "<官方Cavalry 2.8.0.app>/Contents/assets" --profile production-2.8
export CAVALRY_I18N_NATIVE_INJECTOR_FILE="<同源码已验的arm64 native runtime绝对路径>"
```

`tauri:build`是无硬编码target的2.8.0 production命令。
本地ARM alias传入 `aarch64-apple-darwin`。
本地Intel alias传入 `x86_64-apple-darwin`。
CI矩阵也只传入一次所选target。
配置依序叠加macOS、native-production-2.8与release-2.8。
生产overlay清空旧 `beforeBuildCommand`。
因此构建不运行旧Qt 6.6.3 `build:injector`。
编译器复核pack freshness、production profile与目标架构dylib。
ARM包位于 `src-tauri/target/aarch64-apple-darwin/release/bundle/`。
Intel包位于 `src-tauri/target/x86_64-apple-darwin/release/bundle/`。
两个本地alias的packaged gate都固定 `production-2.8` 与预期架构。
ad-hoc签名不构成公证或公开发行。

#### 4.1.0.1 macOS Intel x86_64 production package

此入口复用4.1.0的2.8.0 profile、Qt `6.9.2`、语言包与三个Tauri配置。
调用前将 `CAVALRY_I18N_NATIVE_INJECTOR_FILE` 指向同源码已验的x86_64 runtime。
构建与盖章沿用同一pipeline，只改变目标架构与输出目录。

```bash
export CSC_IDENTITY_AUTO_DISCOVERY=false
export APPLE_SIGNING_IDENTITY="-"
export CAVALRY_I18N_NATIVE_INJECTOR_FILE="<同源码已验的x86_64 native runtime绝对路径>"
npm run build:tauri:x86_64
```

输出位于 `src-tauri/target/x86_64-apple-darwin/release/bundle/`。
packaged gate显式要求x86_64 App与runtime切片。
gate逐字节核对架构中立manifest和三份语言包。
该结果证明构建和包内资源一致，不证明Intel实机UI行为。
Intel实机UI尚未验，不阻断此本地编译合同。

#### 4.1.0.2 GitHub macOS-only 预验

`workflow_dispatch`默认`package_scope=none`，不打包产品。
维护者显式选择`macos-2.8-preflight`后，GitHub在macos-26 ARM与macos-26-intel矩阵各构建一份2.8.0 ad-hoc App/DMG。
该选择器跳过Windows job，不读取updater私钥、不生成updater签名，也不创建GitHub Release。
该预验跳过全量依赖漏洞扫描；PR/main/tag/schedule扫描规则不变。
同一SHA的源码合同只在Ubuntu执行一次。
两个macOS包任务等待该源码门成功，不重复源码合同。
各架构保留Rust测试、production构建、包内资源与DMG检查。
Rust检查与测试命令单独设置`TAURI_CONFIG='{"bundle":{"resources":[]}}'`。
`tauri-build`先合并平台配置，再用此JSON覆盖`bundle.resources`为空数组。
该覆盖只作用于Rust检查和测试，不作用于production构建或打包检查。
测试使用`--no-fail-fast`收齐独立失败，再按影响范围修复复验。
生产App仍使用macOS、native-production-2.8与release-2.8三份CLI配置。
自有native候选的绑定表由LLVM读取；不以旧dyld_info错位输出裁决。
公开2.8.0 tag复用三平台production构建、updater签名及publisher回读闭包。
旧2.7 p12只作历史下载；所有旧2.7 tag都拒绝重打包。
Windows 2.8.0的窄运行时构建入口见下节；macOS预验不能替代Windows实机验收。

#### 4.1.0-W Windows 2.8.0默认生产构建

Windows默认安装包只构建2.8.0 native runtime。唯一入口是`npm run build:tauri:windows`，完整参数见8.1。
它生成production三语包，编译同版generic/QPA并运行CTest，再准备provenance、构建NSIS和记录指纹。
包装器固定Windows、native-production、native-windows和release-2.8四份配置。
只有Tauri Release子进程设置`CAVALRY_I18N_NATIVE_BUILD_PROFILE=production-2.8`。
Debug Rust检查不继承生产模式。生产配置关闭旧beforeBuild钩子；不编译2.7 translator。

Windows本机2.8.0功能证据按PR54复核复用。新默认构建和CI结果单独记录，不据脚本或静态合同宣称线上包通过。
runtime-only事务、用户profile、Program Files授权、恢复与marker提交顺序均不变。发布仍需另行授权。

帮助表由既有producer核官方四份MetaData SHA后在系统临时构建目录生成384/17说明及401根排版数据；同目录由既有producer生成20项缓动显示表，不读取私人文档。各平台共用说明、Guide、Easing、Fast及Qt四行布局策略，Windows单独绑定对象和调用ABI。`native-desktop`布局合同以不显示的Qt fixture使用本机Windows QPA字体及屏幕；offscreen虚拟平台不代Windows布局，未接桌面的环境不得冒称该项通过。

Demo producer从同一官方assets的Presets读取100文件。Windows显式CRLF模式先还原完整批准LF长度/SHA，再映射489位置并锁实际源摘要，原文件不改写；运行时只为动态canonical Presets根及唯一读取caller投影。Welcome复用共享裸句/两精确后缀策略，Windows独立核同根spdlog、消息布局及启动调用链，未知消息单次原样转发。它们的隔离合同和完整源位置核对不能代替实际菜单/MessageBar证据。

Windows临时源码目录的原生C++构建使用`--clean-first`，确保共享头文件及仓外生成表全部进入新DLL/合同EXE；不能仅凭增量构建退出0推断头文件已重编译。此清理只作用于选定CMake构建目录，不清用户安装、profile或Rust/Qt SDK缓存。

#### 4.1.1 macOS App Management 用途说明资源闭环（本地验证）

Tauri CLI `2.10.1` 的 macOS schema 将 `bundle.macOS.infoPlist` 定义为可选覆盖路径，并且会自动发现与 `tauri.macos.conf.json` 同目录的 `Info.plist`。本项目采用后者：`src-tauri/Info.plist` 只提供默认英文 `NSAppBundlesUsageDescription`，不把权限逻辑或运行时状态写进 plist。

`InfoPlist.strings` 不能只留在源码目录；Tauri 的 `bundle.macOS.files` 是相对于 `Contents` 的目标映射。因此 `tauri.macos.conf.json` 将四个源文件明确写入：

```text
src-tauri/en.lproj/InfoPlist.strings       -> Contents/Resources/en.lproj/InfoPlist.strings
src-tauri/zh-Hans.lproj/InfoPlist.strings  -> Contents/Resources/zh-Hans.lproj/InfoPlist.strings
src-tauri/zh-Hant.lproj/InfoPlist.strings  -> Contents/Resources/zh-Hant.lproj/InfoPlist.strings
src-tauri/ja.lproj/InfoPlist.strings       -> Contents/Resources/ja.lproj/InfoPlist.strings
```

这是打包资源路径的构建合同，不代表任何公开发布或签名状态。完成本地 `.app` 构建后，用 Node 24 对**同一个最终 bundle**做 readback：

```bash
APP_BUNDLE="$PWD/src-tauri/target/aarch64-apple-darwin/release/bundle/macos/Cavalry Language Switcher.app"
CAVALRY_I18N_TAURI_APP_BUNDLE="$APP_BUNDLE" \
  node --test tools/check_tauri_build_sop.js

/usr/libexec/PlistBuddy -c 'Print :NSAppBundlesUsageDescription' \
  "$APP_BUNDLE/Contents/Info.plist"
for locale in en zh-Hans zh-Hant ja; do
  test -f "$APP_BUNDLE/Contents/Resources/$locale.lproj/InfoPlist.strings"
done
```

readback 必须同时证明默认 plist 键存在，以及四个 `Contents/Resources/*.lproj/InfoPlist.strings` 都是本轮源码内容；缺任一文件即失败。该命令只读验证本地构建产物，不上传、不打 tag、不创建 GitHub Release。

#### 原生窗口几何验收

改动 macOS 窗口装饰、Tauri/AppKit 依赖或构建 SDK 后，必须对最终 `.app` 运行：

```bash
CAVALRY_I18N_TAURI_APP_BUNDLE="<最终候选.app的绝对路径>" npm run test:tauri:ui
```

该门先临时启动同名对照进程，再绑定自己启动的验收 PID，避免 System Events 按同名重解析对象引用；退出时只关闭这两个自有进程。检查主窗口首屏、resize 后和 About 的原生交通灯中心距窗口顶部为 20pt（40pt 标题栏中线，容差 1pt），水平左缘相对窗口为 12/35/58pt（容差 1pt），并保留既有窗口尺寸/内容截图检查。没有 AX 权限的 SKIP 不等于验收通过。它只操作 Switcher 的窗口装饰，不执行 Cavalry 语言动作。

原生控件可能因可执行文件的链接 SDK 使用不同兼容布局；不能只检查本机 SDK 构建。发布前应在支持的 macOS 主机上对实际发布候选包运行同一门。CI 的编译/资源校验、浏览器预览和开发态截图均不能替代此项原生几何验收。

#### 4.1.2 renderer 视觉验收必须使用新进程

本项目的 renderer 是本地静态 `frontendDist`，不把浏览器 HMR 当作 Tauri WebView 的新鲜度合同。修改 `renderer/*.html`、`renderer/*.css` 或 `renderer/*.js` 后，仅刷新、抢前台或继续观察已有窗口都可能看到旧资源；任何视觉结论和截图前都必须完整结束本项目的 Tauri CLI 与 app 进程，再重新启动：

```bash
pkill -f 'target/debug/cavalry-i18n-tauri' || true
pkill -f '/Cavalry-i18n/node_modules/.bin/tauri dev' || true
npm run tauri:dev
```

必须看到旧窗口关闭、新进程重新编译并重新打开。截图前用 `pgrep -fal 'cavalry-i18n-tauri|/Cavalry-i18n/node_modules/.bin/tauri dev'` 记录当前进程，并确认其启动发生在本轮 renderer 修改之后。无法证明该顺序时，截图只能标记为 `STALE-RESOURCE-UNVERIFIED`，不得用于 UI 裁决或 packaged/release 证据。

Tauri 配置按“公共合同 + 平台覆盖”拆分：

- `src-tauri/tauri.conf.json` 保存产品标识、版本、renderer、窗口与 capability 等跨平台公共合同。
- `src-tauri/tauri.macos.conf.json` 保留平台资源映射与旧injector hook。2.8.0 native-production overlay清空该hook，改用production native runtime与release-2.8 endpoint。
- `src-tauri/tauri.windows.conf.json` 先执行 `npm run build:injector:windows`，再声明 NSIS、`icon.ico`、`languages` 与 `injector/windows/generic/cavalryi18n.dll`；它不继承 macOS injector、签名或 DMG 行为。此Windows链路仅作2.7终版历史参考，不是2.8.0执行入口。
- macOS dylib 与 Windows generic/QPA DLL 都是对应平台现场生成的中间产物，不纳入 Git 或 source artifact；macOS build artifact 只交付已嵌入 dylib 的 `.app`/DMG，Windows 只交付已嵌入双 DLL 的 NSIS EXE。
- `app.withGlobalTauri = false`；vanilla bridge 只暴露冻结后的 `window.cavalryI18n`，页面业务代码不能访问全局 Tauri API。
- main window 逻辑本体固定 `400x504`，最小本体 `400x504`；40px titlebar、434px内容轨道和30px无分割线footer分轨。内容内部404px布局保持，只有底padding从20px减至10px。footer文字与图标整组居中，正文14px/20px、关注文案Medium500。上方和下方只消费同一个固定10px spacing token；上方归content底padding，footer不重复加top padding。20px行+10px底padding推导30px高度。16px图标与32px命中区沿正文行垂直居中；命中区及焦点框不裁切。缩放不改padding，不在生产页混入对照快捷键。GitHub四语提示和无障碍名称保留Star支持语义。Retina 2x的10pt对应20px布局间距，字形墨迹不等于盒边缘。Windows 配置中的 `420x524` 只是在400×504本体四边各加10px transparent compositor 阴影画布，产品最小尺寸和视觉对齐均排除阴影。内容宽 360px、四边保留 20px；Windows 右侧 About/Minimize/Maximize/Close 统一使用 16px Phosphor Regular，Close 的 32px 点击区保持 4px 右边距，其可见 X 路径距本体右边约 15px，标题左缘据此使用 15px 光学边距。主任务流通常使用 20px 间距，`Switch to` 与其 Select 作为同一字段使用 8px 紧密关系间距，`Switch` / `Restore` 在 360px 内容轨道内以 `170 + 20 + 170` 等宽分配。Switch 不经确认直接进入 fail-before-mutation 事务；Restore、Updater、权限和危险操作使用独立 AlertDialog。主内容结果区是有界 Activity Log，由 `operation-log.css/js` 负责并在自身范围内滚动；主窗口禁止横向与纵向滚动；macOS Overlay 原生标题栏覆盖在同一内容坐标系中，不额外增加 WebView 内容高度，16px 交通灯在 40px 标题栏内上下各留 12px，内容左缘继续与红灯中心线对齐。排印只使用 16/14/13px、400/450/500 和系统字体，间距以 4px token 为默认节奏。AppKit/WindowServer 的 AX/CGWindow 外框可能比逻辑高度多报告 1pt，不能据此改写 Tauri 配置。
- `tauri.macos.conf.json` **不硬编码** signing identity；本地、`workflow_dispatch` 与当前 tag 均显式传入 `APPLE_SIGNING_IDENTITY="-"`，避免误用 runner 钥匙串身份。
- **GitHub tag release** 仍要求独立 Tauri updater 私钥，为 `.app.tar.gz`/NSIS 生成客户端可验证的 Ed25519 sidecar；该签名不等于 Apple Developer ID，也不提供 notarization。最终 provenance 必须如实声明 macOS `ad-hoc`，禁止把 updater 签名冒充系统可信分发。

### 4.2 Tag release 信任边界

| 触发 | 签名 | 公证 | 可否作为 GitHub Release |
| --- | --- | --- | --- |
| 本地 `npm run tauri:build` | ad-hoc `-` | 否 | 否 |
| PR / main CI | 不打包 DMG / 仅 injector compile | 否 | 否 |
| `workflow_dispatch` package | ad-hoc 验证 | 否 | 否 |
| `cavalry-*-p*` tag | ad-hoc `-`；Updater 另用 Ed25519 | 否 | 是（Release 明示未公证） |

## 5. Windows NSIS 安装包

> 本节记录Windows 2.8.0生产构建与NSIS安装态检查入口，使用Qt 6.9.2、三份native语言包及两份DLL。不得用Qt 6.6.3或2.7 injector打包2.8.0；后文明确标记的2.7.2命令仅供历史参考。

Windows CI 和本地开发使用同一个显式平台构建入口：

```powershell
npm run build:tauri:windows
npm run test:tauri:windows-nsis
npm run test:acceptance:windows:contract
```

第一条命令通过`tools/windows_native_build.js`执行第8.1节的2.8.0生产链。
它只使用Qt6.9.2 `msvc2022_64`和现有CMake4.4.3 resolver，生成native packs及两份DLL。
资源输出是`target/native-language-packs`；不再打包旧四语38文件JSON树。
NSIS仍写入显式`x86_64-pc-windows-msvc` target目录。
provenance三阶段共用同一生产配置列表，绑定三语manifest/payload、DLL、renderer、Rust、原生源码、译文输入与四份配置。
已配置的NSIS hooks和四份安装器语言表同样进入指纹。任何实际输入改动都会撤销旧记录。

CI先运行`prepare_cavalry_28_windows_ci_inputs.ps1`。
它用现有target摘要核官方2.8.0 MSI，行政提取到RUNNER_TEMP，不安装Cavalry。
Qt由hash-locked aqt准备6.9.2 `win64_msvc2022_64`的qtbase。
随后运行`prepare:tauri:windows-bundle`，生成production语言包与native DLL并执行CTest。
Debug Rust仍验证共享合同。`--package-only`复用本轮DLL打包，不再次编译injector。
工具链记录继续使用现有CMake identity；上传EXE和sidecar的路径不变。
安装烟测核对production-2.8 manifest仅列zh-Hans、zh-Hant、ja_JP，并逐份比对native pack与生成源的字节长度和SHA-256；随后完成安装、同版本更新和卸载。
它不启动Cavalry，不抵扣实屏翻译验收。

NSIS 内置 English、SimpChinese、TradChinese 与 Japanese 四套安装/卸载界面，默认直接跟随 Windows UI 语言；系统语言不在这四种内时回退 English，不额外弹出语言选择器。这四套本地化属于安装器界面，与production-2.8三份native语言包分开。安装器复用 `src-tauri/icons/icon.ico` 品牌图标。当前不配置 `headerImage` 或 `sidebarImage`：这两项只负责装饰，现有 DMG 背景图的尺寸与格式不匹配，不能冒充 Windows 品牌资产。

安装器不创建、替换或重写任何 Cavalry 入口。NSIS install/update/uninstall hooks 本身不包含可执行的 `Cavalry.exe`、`qwindows.dll` 或 QPA 写入入口；修改所选 Cavalry 安装根只属于 Switcher 运行后由用户明确触发的 Apply 事务。桌面、开始菜单、任务栏固定项与用户直接运行的 `Cavalry.exe` 均继续保留厂商原始目标、图标和 AppUserModel 身份；非 English Apply 把 hash-locked QPA delegate 安装到所选 Cavalry 根的原生 `qwindows.dll` 必经位置，并把原厂 DLL 持久保存到同根恢复目录，因此所有入口自然汇合到同一翻译运行时。普通关闭 Cavalry 不恢复原厂 DLL；唯一主动恢复入口是用户明确选择 English。若 Cavalry 更新已用另一份 DLL 覆盖代理，则保留厂商新文件，绝不把旧备份写回，同时拒绝把未知 QPA 状态报告为成功 English，需先恢复受支持的 Cavalry 安装。

Switcher 的同版本 `/UPDATE` 重入、Switcher 卸载、普通 Cavalry 退出和 Switcher 窗口关闭都不隐式改写 Cavalry。希望恢复原厂 English 的用户应先在 Switcher 中明确选择 English，再卸载；厂商重装或升级产生的新文件同样优先于旧备份。卸载器只删除 Switcher 自身，不能在用户未选择语言时暗中改变 Cavalry。这里的同版本 `/UPDATE` 合同只证明同一安装器对现有安装的更新路径，不等于两个不同发布版本之间的升级兼容已经验收。

第二条命令先用同一工具重新计算 sidecar；任何安装器字节、版本、target 或当前打包输入漂移都会在创建 `%TEMP%` 安装目录前失败。通过 provenance 后，`tools/check_windows_nsis_install.ps1` 只消费该唯一安装器：若当前用户已经存在固定卸载键、厂商产品键、桌面/开始菜单快捷方式或自启动项则立即拒绝，不覆盖任何预存安装。随后它在 Switcher 安装根之外创建独立的随机 `%TEMP%` 三文件 QPA 形状哨兵，精确写入并记录根 `qwindows.dll`、`cavalry-i18n-qpa/vendor-qwindows.dll` 与 `cavalry-i18n-qpa/manifest.json` 的长度和 SHA-256；再以 `/S /NS` 安装，验证主程序与 plugin 均为 x64、native manifest与三份pack和当前生成源一致、安装态 plugin 与仓库源 hash 相同、包内没有 dylib 或第二套 `Qt6*.dll`，并核对 HKCU 卸载元数据。安装后还会用同一安装器执行 `/S /NS /UPDATE`（`/D` 保持最后一个参数）并重新验证安装态，最后只通过包内 `uninstall.exe /S` 卸载。安装、同版本更新、卸载三阶段后都要求该三文件哨兵字节指纹不变；只有最终仍一致时才精确删除这三个哨兵文件和已空目录，任何漂移都会失败并保留证据路径。脚本禁止用递归删除掩盖卸载失败，也不得回退读取 `src-tauri/target/release/bundle/nsis`，因为显式 target 构建不会写入该目录，旧文件会造成假绿。

该 gate 会真实安装、同版本更新并卸载 **Cavalry Language Switcher 自身**，但不会启动或写入真实 Cavalry；三文件哨兵只是一份独立的临时字节合同，不代表任意用户 Cavalry 安装根都已经实测。它适合 GitHub 临时 Windows 用户；本地运行必须先确保没有已安装的 Cavalry Language Switcher。静态 hooks 无 Cavalry/QPA 写入入口与这次真实 install → 同版本 `/UPDATE` → uninstall 哨兵不变证据共同守住安装器边界，但不能替代真实 Cavalry GUI、Program Files/UAC、任意安装路径或跨版本升级验收。macOS 对应的 `npm run tauri:build` 也显式加载 `tauri.macos.conf.json`，两个平台不会依赖调用机器的隐式配置选择。

Windows开发机使用Windows 10 x64、Node.js 24+、PowerShell 5.1+、Python 3、stable MSVC Rust、带x64 MSVC v143的Visual Studio 2022+及固定CMake 4.4.3。Qt 6.6.3 `msvc2019_64`仅属于2.7.2历史injector链路；当前2.8.0构建使用Qt 6.9.2 `msvc2022_64`，见§8.1。CI与漏洞证据精确固定Node.js 24.22.1 / npm 12.2.1；本地使用`.node-version`固定Node 24.22.1，`packageManager`固定npm 12.2.1。CI在每个Node setup后显式安装并核验npm。PowerShell 脚本由 `tools/powershell_command.js` 优先交给现有 `pwsh`，不存在时自动回退到系统自带的 Windows PowerShell；不会在脚本真实失败后换壳重跑。Python 命令由 `tools/python_command.js` 按 `PYTHON`、`py -3`、`python` 顺序解析，不要求额外创建 `python3` 别名。最终用户只运行 Windows x64 NSIS 安装器，无需这些开发依赖。

## 6. DMG 增强修饰（卷标与卷宗图标）

Tauri 原生 DMG 配置（`tauri.macos.conf.json > bundle > macOS > dmg`）已处理背景图、窗口尺寸、窗口原点与图标坐标，无需手动干预。Finder 的 `.DS_Store` 只保存绝对点坐标，不支持 `50% 50%` 或在挂载时读取用户屏幕；当前 800×476 安装窗采用 `(400, 655)`。这里的数值是 create-dmg 生成期传给 Finder AppleScript 的左上角输入，不是最终屏幕 bounds。成熟参考盘的 `.DS_Store` 将 AppKit `WindowBounds` 保存为 `{{400, -24}, {356, 552}}`；同一 Tauri/create-dmg 脚本在本机输入 `(400, 655)` 后，本项目 `.DS_Store` 同样得到 `{{400, -24}, {800, 476}}`，首次打开再由 Finder 约束为 `(400, 631, 1200, 1107)`。因此它复刻的是“左边界 400、底边贴住当前可见屏幕”的行为，不篡改既有安装窗尺寸与图标布局。它只决定首次打开位置，不阻止用户随后拖动，也不能被描述为每台 Mac 动态居中。若未来必须实现真实逐屏居中，只能改成拥有运行时代码的安装器，而不是继续给纯 DMG 增加脚本副作用。

`src-tauri/icons/icon.png` 是 Tauri 开发态 runtime 与图标生成器共享的源图 contract，必须保持 `512x512`、8-bit、RGBA 和透明圆角；正式 macOS `.app` 读取 `icon.icns`，开发态裸二进制读取 `icon.png`，两者的 512px 解码像素必须同构。此前 `icon.png` 被孤立替换成四角不透明的 1024px 图，导致开发态 Dock 图标显大，但已安装 `.app` 的 `icon.icns` 一直正确；禁止再根据开发态异常重缩放整套正式发布图标。

需要重生成全平台投影时使用：

```bash
npx tauri icon src-tauri/icons/icon.png --output src-tauri/icons
cp src-tauri/icons/128x128.png renderer/app-icon.png
```

第二条命令让 About 精确复用打包图标而非维护另一张品牌资产。`tools/check_tauri_build_sop.js` 验证开发态 `icon.png` 的透明圆角，并要求 About 与 tracked `128x128.png` 字节同源；若失败，应恢复平台投影，不得修改 gate 迁就漂移。

盖章脚本补充 Tauri 未提供的 **发布卷标身份** 与不稳定覆盖的 **卷宗图标嵌入**：

```bash
bash tools/stamp_dmg_icon.sh src-tauri/target/aarch64-apple-darwin/release/bundle/dmg
```

该脚本会先由 `tools/dmg_volume_identity.js` 从 `package.json` 读取 Switcher SemVer，并从 Tauri DMG 文件名的 `_aarch64` / `_x64` 后缀解析架构。挂载卷标固定为 `Cavalry Switcher <SemVer> <arch>`，例如 `Cavalry Switcher 0.7.0 arm64`；DMG 已经是 macOS 专属容器，因此卷标不重复写 `macOS`，Cavalry 兼容目标仍只属于 Release 标题和发布资产文件名。解析不到受支持架构时必须失败，不能发布身份模糊的镜像。

随后脚本把 DMG 转为临时可写镜像，复制 `src-tauri/icons/icon.icns` 为卷宗根目录 `.VolumeIcon.icns`，对挂载卷宗执行 `SetFile -a C`，再压回发布用 UDZO 镜像。卷标和图标都写进 DMG 内部文件系统，裸 `.dmg` 经 GitHub Release 下载后仍可在挂载时生效。本地 `npm run build:tauri` 与 GitHub Actions macOS producer 调用同一脚本；本地入口固定处理arm64输出。

脚本最后仍会 best-effort 对本机 DMG 文件自身写入 Rez/SetFile resource fork。该外壳图标只对当前 macOS 文件系统可靠，GitHub 上传/下载链路会丢弃 `com.apple.ResourceFork`，不作为发布阻塞项。

## 7. 产物验证

`PACKAGED_NATIVE_PROFILE=production-2.8`用于当前2.8.0本地包。Windows构建与NSIS安装态入口见§5；整轮表与平台证据规则见[验收工具入口](tools/acceptance/README.md)和[验收SOP](docs/acceptance-workflow.md)。下文明确标记的2.7.2 manual smoke和live-clone命令仅作历史参考，不是当前验收入口。

```bash
npm run check:app
npm run test:contracts
TAURI_CONFIG='{"bundle":{"resources":[]}}' npm run check:tauri
TAURI_CONFIG='{"bundle":{"resources":[]}}' npm run test:tauri -- --no-fail-fast
PACKAGED_NATIVE_PROFILE=production-2.8 npm run test:tauri:packaged
npm run test:tauri:dmg-layout
npm run test:tauri:ui
```

以下 macOS ignored smoke 是2.7终版历史流程，不是2.8.0执行入口。其优先输入是只读挂载的官方 Cavalry 2.7.2 DMG，而不是当前可能已经翻译或 ad-hoc 重签的 `/Applications/Cavalry.app`：

```bash
hdiutil attach /path/to/Cavalry.dmg -nobrowse -readonly -noverify -noautoopen
CAVALRY_I18N_MACOS_SMOKE_APP="/Volumes/Cavalry/Cavalry.app" \
  npm run test:tauri:manual-smoke
hdiutil detach "/Volumes/Cavalry"
```

`CAVALRY_I18N_MACOS_SMOKE_APP` 必须是绝对 `Cavalry.app` 路径。harness 在任何 mutation 前重验官方版本、English 资产与 bundle identity，把全部写入限制在临时副本，并在三语 live injector capture 后逐字节复核源 bundle 的关键文件未变化；未设置该变量时才兼容回退 `/Applications/Cavalry.app`。任一 Cavalry 进程已存在时拒绝启动，避免把真实用户会话混入证据。

以下Windows真机与disposable live-clone验收命令属于2.7.2历史流程，不是2.8.0执行入口。当前2.8.0构建见§5及§8.1；当前Windows验收结果须绑定对应整轮表与原始证据，不能由这些历史命令代替。

2.7.2历史Windows基线命令（仅留档；不得作为2.8.0构建顺序）：
该历史组合含旧Qt与injector步骤。当前Windows构建和NSIS入口只按§5执行。

```powershell
npm run check:version
npm run check:release
npm run check:app
npm run test:contracts
node tools/resolve_windows_cmake.js --ensure --print-json --platform windows
npm run prepare:qt-sdk:windows
npm run build:injector:windows
npm run check:tauri
npm run test:tauri
npm run build:tauri:windows
npm run test:tauri:windows-nsis
```

Windows 真机冒烟（不由上述构建命令替代）：在真实 Cavalry 2.7.2 上，以自动发现、当前用户可写的自定义目录和实际 Program Files 目录分别验证安装选择、语言切换、正常重启、English 恢复、跨版本安装器升级与卸载。自定义目录不得依赖 UAC；自动 UAC 只可覆盖实际 Program Files 目标。

原生入口必须单独验收：应用前记录桌面与开始菜单链接的目标、参数、图标、原始 bytes/hash，以及开始菜单的 AppUserModel ID/Toast CLSID；应用后这些值必须逐字节保持不变。随后分别从桌面、开始菜单、已有任务栏固定项、直接 `Cavalry.exe` 与 Switcher 启动，五条路径都必须显示本次语言并命中同一 QPA/generic 摘要。关闭再重开仍保持翻译；明确切回 English 后五条路径均为英文且根 `qwindows.dll` 恢复原厂摘要。用户没有桌面链接时不额外创建，用户删除或移动链接也不影响运行时正确性。

安装态还必须直接运行 `cavalry-i18n-tauri.exe --launch-cavalry`：English 应以空翻译环境启动；简中、繁中、日语应从保存的任意安装根以空参数启动，并以同 PID ready marker 证明插件就绪。正在 apply/restart 时该入口必须报告 busy 且不 spawn；state、revision、语言 marker 或可信 plugin 缺失/漂移时必须失败关闭。此验收继承当前 Windows 登录 profile，不要求测试账号或清空登录态。

Windows disposable live-clone 截图门只允许显式临时副本，不接受自动发现或真实安装。准备两个已经存在、严格位于 `%TEMP%` 下且各自包含 `.cavalry-i18n-disposable-smoke` sentinel 的目录：clone 根必须是完整、干净 English Cavalry 2.7.2 副本；evidence 根只保存本轮 state 与 PNG。路径通过环境变量传入，代码与 npm script 不固化盘符或安装位置：

```powershell
$env:CAVALRY_I18N_WINDOWS_SMOKE_APP = '<absolute disposable %TEMP% Cavalry clone>'
$env:CAVALRY_I18N_WINDOWS_LIVE_EVIDENCE_DIR = '<absolute disposable %TEMP% evidence root>'
$env:CAVALRY_I18N_WINDOWS_LIVE_COG_PITCH = '1'
npm run test:tauri:manual-windows-live-smoke
```

要把 Windows live 结果用于 release acceptance，Onboarding 或 Adjacent ignored runner 还必须显式设置 `CAVALRY_I18N_WINDOWS_RELEASE_TAG`、`CAVALRY_I18N_WINDOWS_RELEASE_INSTALLER`、`CAVALRY_I18N_WINDOWS_RELEASE_PROVENANCE`、`CAVALRY_I18N_WINDOWS_RELEASE_GENERIC_DLL` 与 `CAVALRY_I18N_WINDOWS_RELEASE_QPA_DLL`。其中最后两个路径必须指向本次最终 NSIS 使用的已发布 DLL；runner 在开始写证据前会把它们与当前 clean checkout 中 `injector/windows/{generic,qpa}` 的实际运行时 source 逐字节比对，任何漂移都 fail-closed。清理成功且 owned process 为零后，Rust runner 才会在该 TEMP 子目录写入 session sentinel、`windows-machine-record.json` 和每张 PNG 的 PID/HWND inventory；它不会写 review 或 PASS。随后逐张查看已有 PNG 并运行：

```powershell
node tools/windows-acceptance/review_windows_acceptance.js --tag cavalry-2.7.2-pN --session-dir '<TEMP live session>' --reviewer '<name>' --repo-root '<clean source checkout>'
node tools/windows-acceptance/record_windows_acceptance.js --tag cavalry-2.7.2-pN --session-dir '<TEMP live session>' --repo-root '<clean source checkout>' --output '<outside session summary.json>'
```

reviewer 命令只确认已有截图，自动派生 `manual-review`/`final` 记录；producer 再复核 installer、provenance、generic/QPA digest、tag/source/session 和目标版本。live runner 通过 source Rust apply 路径启动同一份 Cavalry 2.7.2 disposable clone，但只在 source DLL 与最终 NSIS shipped DLL 完全一致时将 inventory 标为 `packaged-nsis`；这证明了最终包内 runtime 字节与现场运行时相同，不把人工或另一份构建的截图冒充发布证据。Windows summary 仅是 `record_windows_acceptance.js` 从原始 session 派生的维护者验收产物，不能由手写 PASS 代替。它用于审查真实 Windows 行为，但不再被包装成第二套发布签名或 tag 拓扑；正式发布资产仍由同次 CI 的 NSIS provenance、Updater Ed25519 签名、SHA-256 与 private-draft 回读闭合。

Windows live acceptance 是高风险注入器改动后的可选维护者验收，不是常规 tag 前置条件。需要留档时，`review_windows_acceptance.js` 只确认既有截图，`record_windows_acceptance.js` 再从 TEMP session 派生可复验摘要；摘要不得手写，也不进入正式 Release 资产闭环。

`CAVALRY_I18N_WINDOWS_LIVE_COG_PITCH=1` 是明确的人工交互开关：每种语言的 Cavalry 窗口获得前台焦点后，helper 先记录同一 PID 的诊断基线并要求 `translatedSourceMask` bit 28 尚未置位；验收者再从“工具”菜单选择“齿轮”，在视口拖拽一次。helper 不猜快捷键、不发送鼠标坐标，也不使用 UIA；它只在真实 vendor 路径令 bit 28 置位，且 `revision`、`canonicalCalls`、`whitelistCalls`、`cjkPathSuccess` 均相对基线严格增长、`fallbackSourceMask=0`、`rendererFailure=0` 后截取 Cog Pitch PNG，并把基线与最终诊断一同写入证据 JSON。未设置该开关时仍只跑三类自动场景，不能据此声称 Pitch 已通过真机验收。

该 ignored harness 启动前发现任意 `Cavalry.exe` 即拒绝运行。它记录 38 个 English JSON 原始字节，逐轮应用简中/繁中/日语，以 `RealCommandRunner` 启动 clone，要求 runtime marker 的 PID、Qt 6.6.3、嵌入表、语言以及 `extensionLayerHookStatus=installed` 全部命中，再以 input-idle 作为可选延迟提示、以精确 PID 顶层窗口和非空像素成帧作为强制 oracle，并在 `DwmFlush` 后写 PNG。Transform 截图不要求前台；Edit Shape 的 exact-HWND `A` 键和人工 Cog Pitch 在 `ShowWindow`/`BringWindowToTop`/`SetForegroundWindow` 提示后的有界重试中获取前台，且 `PostVirtualKey` 自身在投递前复核同一 HWND/PID；按键后 Cavalry 合法切换到同 PID 子窗/模态窗不被误判。每轮证据完成后，仅向仍由本轮持有、且 executable path 已再次证明为 `%TEMP%` sentinel clone 内 `Cavalry.exe` 的全部顶层窗口发送标准 `WM_CLOSE`；若厂商 closeEvent 在 5 秒内未令同 PID 退出，helper 会再次复核 exact executable/PID，再执行唯一受限 `ForceStop`。该兜底只清理 disposable child，不创建 ready/ack/done，也不参与翻译 PASS。普通 Rust `Result` 错误或 unwind panic 都会进入相同 cleanup，恢复 English、逐一比较 38 文件原始字节并要求全局 Cavalry PID 为 0；Ctrl+C、进程强制终止、断电或 panic=abort 无法承诺执行 finally。

full-surface 门必须把每次 Cavalry launch 的 `APPDATA`/`LOCALAPPDATA` 指向 run-root 下、由 harness 自己创建的 TEMP-owned profile，不继承当前用户登录 profile，也不读取、备份或恢复真实档案；启动前要求 disposable clone 的 `assets/Icons/sign-in-bg.png`、`cavByCanva.png`、`tool_search.png` 为非空普通文件，并把其字节哈希写入 evidence。这样完整 clone 的关键登录窗资源仍有哈希 preflight，GUI 运行时写入只会落在 disposable profile。Onboarding 与 Adjacent 则由 acceptance-only plugin 在任何 driver 创建前调用 `QStandardPaths::setTestModeEnabled(true)`，每语重建 `%LOCALAPPDATA%\qttest\Cavalry` 和 `%APPDATA%\qttest\Cavalry`。Rust 只创建、清理带 `.cavalry-i18n-acceptance-profile` 固定 magic sentinel 的目录，拒绝既有外来目录和任何 reparse 链。此路径不复制或伪造登录态；Onboarding 等真实 `MainDock` 稳定 15 秒后才触发，精确工作区重置框一旦出现即失败，绝不点 `OK`/`Cancel`，前四步 Next 也必须由下一页唯一标题/正文确认后才推进。生产 `--launch-cavalry` 验收仍使用正常启动链并继承当前用户登录 profile，不能与 acceptance test profile 混写。每轮 apply 前后都会重验 containment/reparse 链，但同一用户下的恶意并发换链仍不是被完整消除的 TOCTOU；这里保持 fail-closed 的重复校验，不为理论攻击引入复杂的 handle-relative NT 文件架构。

历史事故约束：2026-07-31 的旧 Onboarding runner 只设置 acceptance 开关却继承真实用户 profile，留下过仅 507 字节、没有任何 `windowType` 树的折叠 `workspace.json`；该文件以 `workspace.cavalry-i18n-collapsed-20260801-213341.json` 保存后，又在 2026-08-27 被测试操作复制回真实 profile，最终表现为 Cavalry 菜单仍在而工作区纯黑。此状态不是当前 generic/QPA 注入器的渲染故障。禁止把任何 `workspace.cavalry-i18n-collapsed-*` 当作 known-good fixture 或写回真实 profile；若人工环境命中同一症状，只能通过 Cavalry 的 Window → Reset to Default Workspace 恢复，正常退出后再核验新 workspace 含完整窗口树。上述 profile 隔离和 sentinel 约束是对此事故的永久修复。

当前环境没有可靠的 Cavalry UI OCR oracle，因此 harness 默认生成的三类 PNG，以及 opt-in 时追加的 Cog Pitch PNG，都只是基础证据，并会明确以 `MANUAL SCREENSHOT REVIEW REQUIRED` 结束，而不是返回虚假的 GUI 翻译绿灯。人工验收还必须逐类显式展开并追加截图：菜单、属性编辑器、合成/自动编号项、所有受控下拉显示项、四条 ExtensionLayer 空状态、Snippet 提示、Viewport Quality 与左下快捷提示（helper）；只有这些表面逐类可见后才能通过。`--no-run` 编译、marker PASS 或主窗截图都不能替代这一步。

打包后检查：

- `.app` 位于 `src-tauri/target/aarch64-apple-darwin/release/bundle/macos/`。
- DMG 内 `.app` 与从 DMG 拷贝出的安装态 `.app` 都必须包含 `Contents/_CodeSignature/CodeResources`，并通过 `codesign --verify --deep --strict`。
- DMG 位于 `src-tauri/target/aarch64-apple-darwin/release/bundle/dmg/`。
- DMG 挂载后卷标必须精确等于 `Cavalry Switcher <SemVer> <arch>`，并包含 `.DS_Store`、`.background/background.png`、`.VolumeIcon.icns`、卷宗 custom-icon 标记、`Applications` 链接与 `.app`。
- packaged check以 `PACKAGED_NATIVE_PROFILE=production-2.8` 验证生产资源profile与approved runtime；旧injector文件存在与否不能替代此项。
- 主窗口截图、字体加载状态、核心控件 bounding box、按钮顺序与状态文本必须满足冻结的 Tauri window contract。

## 8. 当前边界

Tauri 是唯一默认壳与唯一发布路径；macOS 的 bridge、平台配置、资源声明、Rust contract tests、packaged 资源检查、窗口回归和真实三语冒烟都已具备可重跑守门。Windows 当前具备独立配置、Qt generic translator/QPA delegate、原子部署与显式 English 恢复状态机、Node/Rust 合同、NSIS 构建、随机 TEMP 安装/同版本更新/卸载及外部 QPA 哨兵 gate、只写显式 disposable clone/evidence 根的三语 PID 窗口截图门，以及真实 Program Files/UAC 下由安装版完成的简中、繁中、日文和 English 恢复主工作区闭环。尚未闭环的是两个不同公开 updater-enabled 版本之间的真实跨版本升级；首个 updater-enabled 版本必须先作为人工安装 bootstrap 发布，因此该证据从下一版本开始补齐，不阻塞本次 bootstrap。旧壳层脚本、handler、harness、builder 配置与 fallback 打包入口不得恢复。

### 8.1 Windows 2.8.0默认本地构建

构建机需要Node/npm、Rust、MSVC2022 x64及Qt6.9.2 `msvc2022_64`。
已核官方2.8.0 MSI提取目录必须包含`assets/MetaData`和`assets/Presets`。
安装包用户不需要这些开发工具。不要把旧2.7 SDK或构建命令作为前置。

```powershell
$env:CAVALRY_NATIVE_ASSETS_ROOT = '<官方2.8.0提取根>\assets'
$env:CAVALRY_QT_PREFIX = '<Qt SDK根>\6.9.2\msvc2022_64'
npm run build:tauri:windows
npm run test:tauri:windows-nsis
```

包装器按次序完成生产资源、native CMake/CTest、DLL发布、provenance prepare、Tauri生产构建和provenance record。
产物在`src-tauri/target/x86_64-pc-windows-msvc/release/bundle/nsis/`。
两阶段CI调用`--prepare-only`和`--package-only`共用同一包装器，不复制构建命令。
`--updater`只供tag阶段生成签名附件；不会自行创建tag或Release。
固定release overlay启用统一`latest.json`；旧宿主沿主窗口提示与p12下载入口。

本地编译、NSIS烟测与Cavalry实屏验收分账。整轮填写表及配置原像保持私有。
默认构建切到2.8.0不等于公开发行；公开发行仍须走三平台production构建及签名回读闭包。
