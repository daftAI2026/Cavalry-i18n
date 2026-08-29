<!--
[INPUT]: 依赖 Tauri 平台配置、renderer 静态资源装载方式、release.config、Qt injector/QPA 构建入口、共享 translation policy、编译期 Windows 资源 trust-anchor catalog、固定官方 CMake 4.2.0 archive 与 SHA-256、NSIS provenance/安装态守门、release-seals acceptance evidence、pinned toolchain、disposable live-clone 截图门与打包检查脚本
[OUTPUT]: 对外提供 renderer 新鲜度受控的本地视觉验证、本地 ad-hoc 开发包、macOS tag 级 Developer ID+公证 fail-closed 发布合同、commit 绑定 live acceptance evidence、候选代码不可接触私钥的 detached acceptance signer、独立双 trust anchor/asset seal、source artifact 完整性、幂等 release、可追溯 Windows producer toolchain evidence、Windows disposable release acceptance producer 与 Windows NSIS 构建/安装态边界说明（Authenticode 另跟踪）
[POS]: 仓库唯一桌面打包与 release runbook 操作合同；区分开发机 ad-hoc 验证、CI PR 编译门与 tag 可发布产物
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
-->

# Cavalry Language Switcher 本地打包 SOP - Tauri

本文档记录唯一发布路径：Tauri。旧壳层和 fallback 打包链路已移除，不再作为本地或 CI 发布入口。

## 1. 核心依赖

- Node 依赖：`@tauri-apps/cli`、`@tauri-apps/api` 固定在 `2.10.1`。
- Rust 依赖：`tauri` 固定在 `2.10.3`，`tauri-build` 固定在 `2.5.6`；`sha2` 同时用于运行时摘要与 build script 发布资源 trust anchor。Rust **channel** 由根目录 `rust-toolchain.toml` 固定（当前 `1.97.1`）。
- Qt bootstrap：`requirements-ci.txt` 固定 `aqtinstall==3.3.0` 及其完整依赖摘要；`prepare:qt-sdk` 创建 ignored 的 repo-local venv 并以 `--require-hashes` 安装，绝不信任全局 aqt。Windows CMake bootstrap 由 `tools/resolve_windows_cmake.js` 消费 `tools/ci_action_pins.json` 中官方 Kitware/CMake v4.2.0 Windows x64 zip 的固定 URL/SHA-256，重新解包，执行 `cmake --version` 并验证 CTest 同包布局；不会消费 runner PATH 中的预装版本。GitHub Actions 全量 pin 见 `tools/ci_action_pins.json`。
- Injector 依赖：当前发布目标与 macOS/Windows SDK 投影统一写在 `tools/cavalry_qt_target.json`；本机有 Cavalry.app 时校验其 Qt 版本，clean CI 按同一份配置分别准备 Qt `6.6.3` `clang_64` 或 `msvc2019_64` SDK。macOS 还会验证整个 SDK tree 的 canonical SHA-256（文件内容、目录和 symlink target）；任一下载或安装漂移都 fail-closed。

准备 Qt SDK；原命令在 macOS 保持兼容，Windows 构建使用显式平台入口：

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
- Release tag: `cavalry-2.7.2-pN`，表示“面向 Cavalry 2.7.2 的第 N 个补丁发布”，触发 GitHub Windows/macOS runner 打包与 GitHub Release。
- 三种发布资产：
  - Apple Silicon: `Cavalry.Language.Switcher_Cavalry-2.7.2-pN_aarch64.dmg`
  - Intel: `Cavalry.Language.Switcher_Cavalry-2.7.2-pN_x64.dmg`
- Windows x64 NSIS asset: `Cavalry.Language.Switcher_Cavalry-2.7.2-pN_windows-x64-setup.exe`
  三种发布资产名都由 `tools/release_metadata.js` 从 `release.config.json` 生成，workflow 不允许手写漂移；release job 会下载 Windows build artifact，将 Tauri 原始 EXE 名规范化后，与两个 DMG 一次性上传。

打标前先跑：

```bash
npm run check:version
npm run check:release
npm run test:contracts
node tools/verify_ci_action_pins.js
node tools/verify_source_artifact.js --check-repo --check-workflow
```

### 3.1 Tag release runbook（fail-closed）

1. 在干净的 **source commit S** 上完成 macOS live `21-run/48-point` acceptance，并执行人工 review seal，得到同一 session 下的 `matrix-final-record.json`。该 session 必须由 `tools/macos-acceptance` 产生；不得手写 PASS、session id 或摘要。
2. 仍停留在 source commit S，用真实 session 生成 evidence：

```bash
SOURCE_COMMIT="$(git rev-parse HEAD)"
# Windows evidence 只接受并重新验证本轮原始 session；summary 由 verifier 派生，不能作为输入。
WINDOWS_SESSION_DIR='<outside-session Windows acceptance directory>'
node tools/create_release_acceptance_evidence.js \
  --tag cavalry-2.7.2-pN \
  --session-dir "$SESSION_DIR" \
  --windows-session-dir "$WINDOWS_SESSION_DIR"

# 候选仓库进程只准备 repo 外的 canonical payload；它不得看见或读取私钥。
unset RELEASE_ACCEPTANCE_ATTESTATION_PRIVATE_KEY
ATTESTATION_WORKDIR="$(mktemp -d "${TMPDIR:-/tmp}/cavalry-acceptance-signing.XXXXXX")"
ATTESTATION_PAYLOAD="$ATTESTATION_WORKDIR/payload.json"
node tools/create_release_acceptance_attestation.js \
  --tag cavalry-2.7.2-pN \
  --evidence release-seals/cavalry-2.7.2-pN.evidence.json \
  --prepare "$ATTESTATION_PAYLOAD"
shasum -a 256 "$ATTESTATION_PAYLOAD"
```

把该只读 payload 的**精确字节**交给另一套离线 OpenSSL/HSM signer；签名机不 checkout、加载或执行候选仓库代码。以下命令只在独立 signer 上运行，`acceptance-private.pem` 永不返回候选环境：

```bash
openssl pkeyutl -sign -rawin \
  -inkey acceptance-private.pem \
  -in "$ATTESTATION_PAYLOAD" \
  -out acceptance-signature.bin
openssl pkey -in acceptance-private.pem -pubout -outform DER \
  -out acceptance-public-key.spki.der
```

只把 detached signature 与公开 SPKI DER 带回候选环境，再由无私钥的 assemble 模式验签并生成 canonical attestation：

```bash
node tools/create_release_acceptance_attestation.js \
  --tag cavalry-2.7.2-pN \
  --evidence release-seals/cavalry-2.7.2-pN.evidence.json \
  --assemble \
  --payload "$ATTESTATION_PAYLOAD" \
  --signature ./acceptance-signature.bin \
  --public-key-spki-der ./acceptance-public-key.spki.der \
  --trusted-public-key-sha256 "$RELEASE_ACCEPTANCE_ATTESTATION_PUBLIC_KEY_SHA256"
node tools/verify_release_trust_anchors.js
node tools/verify_release_acceptance_attestation.js \
  --tag cavalry-2.7.2-pN \
  --trusted-public-key-sha256 "$RELEASE_ACCEPTANCE_ATTESTATION_PUBLIC_KEY_SHA256"
git add release-seals/cavalry-2.7.2-pN.evidence.json release-seals/cavalry-2.7.2-pN.acceptance-attestation.json
test "$(git diff --cached --name-only | wc -l | tr -d ' ')" = 2
git commit -m "release: seal cavalry-2.7.2-pN acceptance"
RELEASE_COMMIT="$(git rev-parse HEAD)"
test "$(git rev-parse HEAD^)" = "$SOURCE_COMMIT"
node tools/verify_release_acceptance_evidence.js \
  --tag cavalry-2.7.2-pN \
  --release-commit "$RELEASE_COMMIT" \
  --check-tag-topology
```

这形成刻意的两提交协议：S 是被 live-tested 的源码；其唯一子提交 T **只新增 evidence 与其独立的受保护 Ed25519 attestation**，tag 指向 T。这样 evidence 能记录 S，而不需要在文件内自引用尚未生成的 T。CI 会以外部固定 fingerprint 验证 attestation，并拒绝 merge commit、额外文件、无签名/错误签名或错误父提交。

3. 将 evidence-only 提交 T 合入并推送 `main`，再配置受保护 GitHub environment 的变量与 secrets（**只存 secrets，永不打印值**）：
   - `RELEASE_ACCEPTANCE_ATTESTATION_PUBLIC_KEY_SHA256` 仅作为 GitHub environment variable 保存并与公开 trust policy 一致；对应私钥必须始终留在离线/独立受保护 signer，**不得**保存为 Actions secret、不得暴露给任何候选仓库进程。
   - `RELEASE_SEAL_PUBLIC_KEY_SHA256` 作为另一项 GitHub environment variable 保存，并先通过 `SECURITY.md` 所述独立受保护渠道公开；`RELEASE_SEAL_PRIVATE_KEY` 才是 Actions secret。
   - 两个 fingerprint 必须来自不同 Ed25519 密钥、不同授权角色，并由 `node tools/verify_release_trust_anchors.js` 拒绝缺失或复用；任一密钥轮换/撤销都必须独立发布、复核和更新，不能静默联动。
   - `APPLE_CERTIFICATE`（base64 PKCS#12）
   - `APPLE_CERTIFICATE_PASSWORD`
   - `APPLE_SIGNING_IDENTITY`（`Developer ID Application: ...`，禁止 `-`）
   - `APPLE_ID`
   - `APPLE_APP_SPECIFIC_PASSWORD`
   - `APPLE_TEAM_ID`
4. 在 evidence-only 提交 T 上创建并推送 tag（T 必须已在 `origin/main`）：

```bash
git tag -a cavalry-2.7.2-p12 -m "Cavalry Language Switcher for Cavalry 2.7.2 patch 12"
git push origin cavalry-2.7.2-p12
```

5. Tag 流水线会：复核 T 只有一个父提交 S 且只新增 canonical evidence+attestation 并验签 → 双架构 Developer ID 构建 → 卷宗图标写入后对**最终 DMG 字节**重新 notarize/staple/assess → 生成 `ReleaseAcceptanceSeal.json` / `SHA256SUMS` / provenance → 对 GitHub Release 元数据与全部 sidecar 做幂等摘要复验 → 以 PR 更新 README badge（不直接 push `main`）。
6. **Windows Authenticode** 不在本 SOP 实现范围内，由维护者单独建 issue。

## 4. macOS 标准打包流程

### 4.1 本地 / 开发验证（ad-hoc only）

```bash
export CSC_IDENTITY_AUTO_DISCOVERY=false
export APPLE_SIGNING_IDENTITY="-"

rm -rf src-tauri/target/release/bundle
npm run tauri:build
```

#### 4.1.1 renderer 视觉验收必须使用新进程

本项目的 renderer 是本地静态 `frontendDist`，不把浏览器 HMR 当作 Tauri WebView 的新鲜度合同。修改 `renderer/*.html`、`renderer/*.css` 或 `renderer/*.js` 后，仅刷新、抢前台或继续观察已有窗口都可能看到旧资源；任何视觉结论和截图前都必须完整结束本项目的 Tauri CLI 与 app 进程，再重新启动：

```bash
pkill -f 'target/debug/cavalry-i18n-tauri' || true
pkill -f '/Cavalry-i18n/node_modules/.bin/tauri dev' || true
npm run tauri:dev
```

必须看到旧窗口关闭、新进程重新编译并重新打开。截图前用 `pgrep -fal 'cavalry-i18n-tauri|/Cavalry-i18n/node_modules/.bin/tauri dev'` 记录当前进程，并确认其启动发生在本轮 renderer 修改之后。无法证明该顺序时，截图只能标记为 `STALE-RESOURCE-UNVERIFIED`，不得用于 UI 裁决或 packaged/release 证据。

Tauri 配置按“公共合同 + 平台覆盖”拆分：

- `src-tauri/tauri.conf.json` 保存产品标识、版本、renderer、窗口与 capability 等跨平台公共合同。
- `src-tauri/tauri.macos.conf.json` 执行 `npm run build:injector`，声明 DMG/`.app`、`languages`、macOS injector 与 DMG 布局。
- `src-tauri/tauri.windows.conf.json` 先执行 `npm run build:injector:windows`，再声明 NSIS、`icon.ico`、`languages` 与 `injector/windows/generic/cavalryi18n.dll`；它不继承 macOS injector、签名或 DMG 行为。
- macOS dylib 与 Windows generic/QPA DLL 都是对应平台现场生成的中间产物，不纳入 Git 或 source artifact；macOS build artifact 只交付已嵌入 dylib 的 `.app`/DMG，Windows 只交付已嵌入双 DLL 的 NSIS EXE。
- `app.withGlobalTauri = false`；vanilla bridge 只暴露冻结后的 `window.cavalryI18n`，页面业务代码不能访问全局 Tauri API。
- main window 逻辑尺寸固定 `400x480`，最小 `400x480`；内容宽 360px、四边保留 20px，主任务流通常使用 20px 间距，`Switch to` 与其 Select 作为同一字段使用 8px 紧密关系间距，两枚动作在 360px 内容轨道内以 `170 + 20 + 170` 等宽分配。主内容结果区是有界 Activity Log，由 `operation-log.css/js` 负责并在自身范围内滚动；必要确认、权限和危险操作使用独立 AlertDialog。主窗口禁止横向与纵向滚动；macOS Overlay 原生标题栏覆盖在同一内容坐标系中，不额外增加 WebView 内容高度，16px 交通灯在 40px 标题栏内上下各留 12px，内容左缘继续与红灯中心线对齐。排印只使用 16/14/13px、400/450/500 和系统字体，间距以 4px token 为默认节奏。AppKit/WindowServer 的 AX/CGWindow 外框可能比逻辑高度多报告 1pt，不能据此改写 Tauri 配置。
- `tauri.macos.conf.json` **不硬编码** signing identity；本地/`workflow_dispatch` 显式传入 `APPLE_SIGNING_IDENTITY="-"` 生成 ad-hoc 开发包。
- **GitHub tag release** 显式传入 Developer ID Application secret，不能被配置文件里的 `-` 覆盖。DMG 卷宗图标脚本会重写容器，因此 tag job 必须在该步骤之后重新提交最终 DMG 给 notary service、staple 并用 `stapler`/`spctl` 双重验证；缺任一 secret、仍为 ad-hoc 或最终 ticket 无效都会 fail-closed。

### 4.2 Tag release 签名/公证边界

| 触发 | 签名 | 公证 | 可否作为 GitHub Release |
| --- | --- | --- | --- |
| 本地 `npm run tauri:build` | ad-hoc `-` | 否 | 否 |
| PR / main CI | 不打包 DMG / 仅 injector compile | 否 | 否 |
| `workflow_dispatch` package | ad-hoc 验证 | 否 | 否 |
| `cavalry-*-p*` tag | Developer ID（secrets） | 是（staple 校验） | 是（另需 acceptance evidence） |

## 5. Windows NSIS 安装包

Windows CI 和本地开发使用同一个显式平台构建入口：

```powershell
npm run build:tauri:windows
npm run test:tauri:windows-nsis
npm run test:acceptance:windows:contract
```

第一条命令是唯一 Windows 用户入口：先解析/准备 Qt 6.6.3 `msvc2019_64`，再由 `tauri.windows.conf.json` 的 build hook 通过 `injector/windows/build.ps1` 从当前翻译源重生成共享 C++ 表；build 脚本经 `tools/resolve_windows_cmake.js` 使用官方 CMake 4.2.0 pin，不读取 runner PATH，并完成 plugin configure/build/ctest，随后在真正 bundle 前执行 provenance prepare。CI 还会在双 DLL 构建成功后由 `tools/record_windows_toolchain_evidence.js` 记录 CMake 版本、release URL、archive SHA-256 和实际版本输出。prepare 只删除当前 `package.json` 版本推导出的预期 EXE、同名 sidecar 和受控 intent；任意其他 EXE 或 `.exe.provenance.json` 残留都会失败，不会泛删。随后按固定 `x86_64-pc-windows-msvc` target 生成 `src-tauri/target/x86_64-pc-windows-msvc/release/bundle/nsis/*.exe`，并立即写入同名 `.exe.provenance.json`：它绑定安装器 SHA-256/长度与当前 renderer、languages、Windows Tauri/Rust/config/Cargo/build 输入、package manifests、Windows native 源码、共享 `cavalry_i18n_translation_policy.h`、生成翻译表及已打包 generic/QPA 双 DLL 的内容 fingerprint，不取 Git HEAD 或 mtime 代替输入事实；安装包记录后单独修改共享 policy 也必须使 verify 失败。

Windows Cargo build 还会由 `src-tauri/build.rs` 枚举四个 `languages/<lang>` 的全部 JSON，并读取已构建的 `cavalryi18n.dll` 与 QPA `qwindows.dll`，把 SHA-256 catalog 编译进 worker。release profile 缺任一 runtime DLL 立即失败；debug 可以编译，但缺失的 runtime 锚会让真实提权 worker fail closed。提权事务先验证近邻包内文件与编译期摘要，再从当前 Cavalry JSON 经 anchored English 和目标语言重建 exact pretty payload，不能信任 plan/staging 自报摘要。因此 CI 在任何 Windows Rust check/test 前必须先运行 `tools/resolve_windows_cmake.js --ensure --print-json`、`prepare:qt-sdk:windows` 与 `build:injector:windows`，并上传 `toolchain-evidence-windows-x64` 作为该 producer 的工具链来源记录。

NSIS 内置 English、SimpChinese、TradChinese 与 Japanese 四套安装/卸载界面，默认直接跟随 Windows UI 语言；系统语言不在这四种内时回退 English，不额外弹出语言选择器。安装器复用 `src-tauri/icons/icon.ico` 品牌图标。当前不配置 `headerImage` 或 `sidebarImage`：这两项只负责装饰，现有 DMG 背景图的尺寸与格式不匹配，不能冒充 Windows 品牌资产。

安装器不创建、替换或重写任何 Cavalry 入口。NSIS install/update/uninstall hooks 本身不包含可执行的 `Cavalry.exe`、`qwindows.dll` 或 QPA 写入入口；修改所选 Cavalry 安装根只属于 Switcher 运行后由用户明确触发的 Apply 事务。桌面、开始菜单、任务栏固定项与用户直接运行的 `Cavalry.exe` 均继续保留厂商原始目标、图标和 AppUserModel 身份；非 English Apply 把 hash-locked QPA delegate 安装到所选 Cavalry 根的原生 `qwindows.dll` 必经位置，并把原厂 DLL 持久保存到同根恢复目录，因此所有入口自然汇合到同一翻译运行时。普通关闭 Cavalry 不恢复原厂 DLL；唯一主动恢复入口是用户明确选择 English。若 Cavalry 更新已用另一份 DLL 覆盖代理，则保留厂商新文件，绝不把旧备份写回，同时拒绝把未知 QPA 状态报告为成功 English，需先恢复受支持的 Cavalry 安装。

Switcher 的同版本 `/UPDATE` 重入、Switcher 卸载、普通 Cavalry 退出和 Switcher 窗口关闭都不隐式改写 Cavalry。希望恢复原厂 English 的用户应先在 Switcher 中明确选择 English，再卸载；厂商重装或升级产生的新文件同样优先于旧备份。卸载器只删除 Switcher 自身，不能在用户未选择语言时暗中改变 Cavalry。这里的同版本 `/UPDATE` 合同只证明同一安装器对现有安装的更新路径，不等于两个不同发布版本之间的升级兼容已经验收。

第二条命令先用同一工具重新计算 sidecar；任何安装器字节、版本、target 或当前打包输入漂移都会在创建 `%TEMP%` 安装目录前失败。通过 provenance 后，`tools/check_windows_nsis_install.ps1` 只消费该唯一安装器：若当前用户已经存在固定卸载键、厂商产品键、桌面/开始菜单快捷方式或自启动项则立即拒绝，不覆盖任何预存安装。随后它在 Switcher 安装根之外创建独立的随机 `%TEMP%` 三文件 QPA 形状哨兵，精确写入并记录根 `qwindows.dll`、`cavalry-i18n-qpa/vendor-qwindows.dll` 与 `cavalry-i18n-qpa/manifest.json` 的长度和 SHA-256；再以 `/S /NS` 安装，验证主程序与 plugin 均为 x64、四个语言目录各含 38 个 JSON、安装态 plugin 与仓库源 hash 相同、包内没有 dylib 或第二套 `Qt6*.dll`，并核对 HKCU 卸载元数据。安装后还会用同一安装器执行 `/S /NS /UPDATE`（`/D` 保持最后一个参数）并重新验证安装态，最后只通过包内 `uninstall.exe /S` 卸载。安装、同版本更新、卸载三阶段后都要求该三文件哨兵字节指纹不变；只有最终仍一致时才精确删除这三个哨兵文件和已空目录，任何漂移都会失败并保留证据路径。脚本禁止用递归删除掩盖卸载失败，也不得回退读取 `src-tauri/target/release/bundle/nsis`，因为显式 target 构建不会写入该目录，旧文件会造成假绿。

该 gate 会真实安装、同版本更新并卸载 **Cavalry Language Switcher 自身**，但不会启动或写入真实 Cavalry；三文件哨兵只是一份独立的临时字节合同，不代表任意用户 Cavalry 安装根都已经实测。它适合 GitHub 临时 Windows 用户；本地运行必须先确保没有已安装的 Cavalry Language Switcher。静态 hooks 无 Cavalry/QPA 写入入口与这次真实 install → 同版本 `/UPDATE` → uninstall 哨兵不变证据共同守住安装器边界，但不能替代真实 Cavalry GUI、Program Files/UAC、任意安装路径或跨版本升级验收。macOS 对应的 `npm run tauri:build` 也显式加载 `tauri.macos.conf.json`，两个平台不会依赖调用机器的隐式配置选择。

Windows **开发机**下限为 Windows 10 x64、Node.js 24+、PowerShell 5.1+、Python 3、stable MSVC Rust、带 x64 MSVC v143 的 Visual Studio 2022+、由 `tools/resolve_windows_cmake.js` 下载/验证的固定 CMake 4.2.0 与精确 Qt 6.6.3 `msvc2019_64` SDK。CI 与漏洞证据精确固定 Node.js 24.20.0 / npm 11.19.0；本地开发机允许同一 Node 24 LTS 主线的新补丁版。PowerShell 脚本由 `tools/powershell_command.js` 优先交给现有 `pwsh`，不存在时自动回退到系统自带的 Windows PowerShell；不会在脚本真实失败后换壳重跑。Python 命令由 `tools/python_command.js` 按 `PYTHON`、`py -3`、`python` 顺序解析，不要求额外创建 `python3` 别名。最终用户只运行 Windows x64 NSIS 安装器，无需这些开发依赖。

## 6. DMG 增强修饰 (卷宗图标盖章)

Tauri 原生 DMG 配置（`tauri.macos.conf.json > bundle > macOS > dmg`）已处理背景图、窗口尺寸与图标坐标，无需手动干预。

`src-tauri/icons/icon.png` 是 Tauri 开发态 runtime 与图标生成器共享的源图 contract，必须保持 `512x512`、8-bit、RGBA 和透明圆角；正式 macOS `.app` 读取 `icon.icns`，开发态裸二进制读取 `icon.png`，两者的 512px 解码像素必须同构。此前 `icon.png` 被孤立替换成四角不透明的 1024px 图，导致开发态 Dock 图标显大，但已安装 `.app` 的 `icon.icns` 一直正确；禁止再根据开发态异常重缩放整套正式发布图标。

需要重生成全平台投影时使用：

```bash
npx tauri icon src-tauri/icons/icon.png --output src-tauri/icons
cp src-tauri/icons/128x128.png renderer/app-icon.png
```

第二条命令让 About 精确复用打包图标而非维护另一张品牌资产。`tools/check_tauri_build_sop.js` 验证开发态 `icon.png` 的透明圆角，并要求 About 与 tracked `128x128.png` 字节同源；若失败，应恢复平台投影，不得修改 gate 迁就漂移。

盖章脚本补充 Tauri 不稳定覆盖的 **卷宗图标嵌入**：

```bash
bash tools/stamp_dmg_icon.sh src-tauri/target/release/bundle/dmg
```

该脚本会把 DMG 转为临时可写镜像，挂载后复制 `src-tauri/icons/icon.icns` 为卷宗根目录 `.VolumeIcon.icns`，对挂载卷宗执行 `SetFile -a C`，再压回发布用 UDZO 镜像。这个图标写进 DMG 内部文件系统，裸 `.dmg` 经 GitHub Release 下载后仍可在挂载时生效。

脚本最后仍会 best-effort 对本机 DMG 文件自身写入 Rez/SetFile resource fork。该外壳图标只对当前 macOS 文件系统可靠，GitHub 上传/下载链路会丢弃 `com.apple.ResourceFork`，不作为发布阻塞项。

## 7. 产物验证

```bash
npm run check:app
npm run test:contracts
npm run check:tauri
npm run test:tauri
npm run test:tauri:packaged
npm run test:tauri:dmg-layout
npm run test:tauri:ui
npm run test:tauri:manual-smoke
```

macOS ignored smoke 的优先输入是只读挂载的官方 Cavalry 2.7.2 DMG，而不是当前可能已经翻译或 ad-hoc 重签的 `/Applications/Cavalry.app`：

```bash
hdiutil attach /path/to/Cavalry.dmg -nobrowse -readonly -noverify -noautoopen
CAVALRY_I18N_MACOS_SMOKE_APP="/Volumes/Cavalry/Cavalry.app" \
  npm run test:tauri:manual-smoke
hdiutil detach "/Volumes/Cavalry"
```

`CAVALRY_I18N_MACOS_SMOKE_APP` 必须是绝对 `Cavalry.app` 路径。harness 在任何 mutation 前重验官方版本、English 资产与 bundle identity，把全部写入限制在临时副本，并在三语 live injector capture 后逐字节复核源 bundle 的关键文件未变化；未设置该变量时才兼容回退 `/Applications/Cavalry.app`。任一 Cavalry 进程已存在时拒绝启动，避免把真实用户会话混入证据。

Windows 基线验证：

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

reviewer 命令只确认已有截图，自动派生 `manual-review`/`final` 记录；producer 再复核 installer、provenance、generic/QPA digest、tag/source/session 和目标版本。live runner 通过 source Rust apply 路径启动同一份 Cavalry 2.7.2 disposable clone，但只在 source DLL 与最终 NSIS shipped DLL 完全一致时将 inventory 标为 `packaged-nsis`；这证明了最终包内 runtime 字节与现场运行时相同，不把人工或另一份构建的截图冒充发布证据。Windows summary 仅是 `record_windows_acceptance.js` 从原始 session 派生的产物；`create_release_acceptance_evidence.js` 只接受 `--windows-session-dir` 并从复验后的原始 session 派生 summary，`verify_release_acceptance_evidence.js` 在提供该参数时重新验证并比较 summary，tag/publish 阶段则由独立 Ed25519 acceptance attestation 绑定 evidence 精确字节，再由 release seal 绑定实际 Windows installer。两者均拒绝 summary 文件作为输入。带 Windows x64 artifact 的 release 必须同时通过 `--require-windows` 与 protected attestation/seal，否则 fail-closed。

Windows release acceptance producer：上述 ignored live gate 结束后，Windows runner 必须把本轮输出整理为带 `SESSION_SENTINEL_MAGIC` 的 session，并由 `tools/windows-acceptance/review_windows_acceptance.js` 从已有截图派生 review/final，再由 `tools/windows-acceptance/record_windows_acceptance.js` 复验 `windows-machine-record.json`、`windows-manual-review.json`、`windows-final-record.json`。合同支持三语 Onboarding 五点、Adjacent 三点或两者合并；每个点都绑定 exact PID/HWND inventory、最终安装后 generic/QPA SHA-256；同时复验最终 x64 NSIS、相邻 provenance sidecar 与 Cavalry 2.7.2 disposable clone。命令只接受 Windows x64、干净 source worktree 和已存在的输出以外路径，不接受 `--confirm-live-pass`、手写结果或复用缺少 TEMP sentinel 的会话。summary 只能作为该 session verifier 的派生产物；普通 evidence 若携带 Windows 结果，必须在创建时通过 `--windows-session-dir` 重新验证原始 session，release 一旦声明 Windows artifact 就必须存在，并由 evidence/seal 绑定同一 tag、source commit、session、installer 和 DLL digest。

`CAVALRY_I18N_WINDOWS_LIVE_COG_PITCH=1` 是明确的人工交互开关：每种语言的 Cavalry 窗口获得前台焦点后，helper 先记录同一 PID 的诊断基线并要求 `translatedSourceMask` bit 28 尚未置位；验收者再从“工具”菜单选择“齿轮”，在视口拖拽一次。helper 不猜快捷键、不发送鼠标坐标，也不使用 UIA；它只在真实 vendor 路径令 bit 28 置位，且 `revision`、`canonicalCalls`、`whitelistCalls`、`cjkPathSuccess` 均相对基线严格增长、`fallbackSourceMask=0`、`rendererFailure=0` 后截取 Cog Pitch PNG，并把基线与最终诊断一同写入证据 JSON。未设置该开关时仍只跑三类自动场景，不能据此声称 Pitch 已通过真机验收。

该 ignored harness 启动前发现任意 `Cavalry.exe` 即拒绝运行。它记录 38 个 English JSON 原始字节，逐轮应用简中/繁中/日语，以 `RealCommandRunner` 启动 clone，要求 runtime marker 的 PID、Qt 6.6.3、嵌入表、语言以及 `extensionLayerHookStatus=installed` 全部命中，再以 input-idle 作为可选延迟提示、以精确 PID 顶层窗口和非空像素成帧作为强制 oracle，并在 `DwmFlush` 后写 PNG。Transform 截图不要求前台；Edit Shape 的 exact-HWND `A` 键和人工 Cog Pitch 在 `ShowWindow`/`BringWindowToTop`/`SetForegroundWindow` 提示后的有界重试中获取前台，且 `PostVirtualKey` 自身在投递前复核同一 HWND/PID；按键后 Cavalry 合法切换到同 PID 子窗/模态窗不被误判。每轮证据完成后，仅向仍由本轮持有、且 executable path 已再次证明为 `%TEMP%` sentinel clone 内 `Cavalry.exe` 的全部顶层窗口发送标准 `WM_CLOSE`；若厂商 closeEvent 在 5 秒内未令同 PID 退出，helper 会再次复核 exact executable/PID，再执行唯一受限 `ForceStop`。该兜底只清理 disposable child，不创建 ready/ack/done，也不参与翻译 PASS。普通 Rust `Result` 错误或 unwind panic 都会进入相同 cleanup，恢复 English、逐一比较 38 文件原始字节并要求全局 Cavalry PID 为 0；Ctrl+C、进程强制终止、断电或 panic=abort 无法承诺执行 finally。

full-surface 门必须把每次 Cavalry launch 的 `APPDATA`/`LOCALAPPDATA` 指向 run-root 下、由 harness 自己创建的 TEMP-owned profile，不继承当前用户登录 profile，也不读取、备份或恢复真实档案；启动前要求 disposable clone 的 `assets/Icons/sign-in-bg.png`、`cavByCanva.png`、`tool_search.png` 为非空普通文件，并把其字节哈希写入 evidence。这样完整 clone 的关键登录窗资源仍有哈希 preflight，GUI 运行时写入只会落在 disposable profile。Onboarding 与 Adjacent 则由 acceptance-only plugin 在任何 driver 创建前调用 `QStandardPaths::setTestModeEnabled(true)`，每语重建 `%LOCALAPPDATA%\qttest\Cavalry` 和 `%APPDATA%\qttest\Cavalry`。Rust 只创建、清理带 `.cavalry-i18n-acceptance-profile` 固定 magic sentinel 的目录，拒绝既有外来目录和任何 reparse 链。此路径不复制或伪造登录态；Onboarding 等真实 `MainDock` 稳定 15 秒后才触发，精确工作区重置框一旦出现即失败，绝不点 `OK`/`Cancel`，前四步 Next 也必须由下一页唯一标题/正文确认后才推进。生产 `--launch-cavalry` 验收仍使用正常启动链并继承当前用户登录 profile，不能与 acceptance test profile 混写。每轮 apply 前后都会重验 containment/reparse 链，但同一用户下的恶意并发换链仍不是被完整消除的 TOCTOU；这里保持 fail-closed 的重复校验，不为理论攻击引入复杂的 handle-relative NT 文件架构。

当前环境没有可靠的 Cavalry UI OCR oracle，因此 harness 默认生成的三类 PNG，以及 opt-in 时追加的 Cog Pitch PNG，都只是基础证据，并会明确以 `MANUAL SCREENSHOT REVIEW REQUIRED` 结束，而不是返回虚假的 GUI 翻译绿灯。人工验收还必须逐类显式展开并追加截图：菜单、属性编辑器、合成/自动编号项、所有受控下拉显示项、四条 ExtensionLayer 空状态、Snippet 提示、Viewport Quality 与左下快捷提示（helper）；只有这些表面逐类可见后才能通过。`--no-run` 编译、marker PASS 或主窗截图都不能替代这一步。

打包后检查：

- `.app` 位于 `src-tauri/target/release/bundle/macos/`。
- DMG 内 `.app` 与从 DMG 拷贝出的安装态 `.app` 都必须包含 `Contents/_CodeSignature/CodeResources`，并通过 `codesign --verify --deep --strict`。
- DMG 位于 `src-tauri/target/release/bundle/dmg/`。
- DMG 挂载后必须包含 `.DS_Store`、`.background/background.png`、`.VolumeIcon.icns`、卷宗 custom-icon 标记、`Applications` 链接与 `.app`。
- `.app/Contents/Resources/` 内包含 `languages` 与 `libCavalryTranslatorInjector.dylib`。
- 主窗口截图、字体加载状态、核心控件 bounding box、按钮顺序与状态文本必须满足冻结的 Tauri window contract。

## 8. 当前边界

Tauri 是唯一默认壳与唯一发布路径；macOS 的 bridge、平台配置、资源声明、Rust contract tests、packaged 资源检查、窗口回归和真实三语冒烟都已具备可重跑守门。Windows 当前具备独立配置、Qt generic translator/QPA delegate、原子部署与显式 English 恢复状态机、Node/Rust 合同、NSIS 构建、随机 TEMP 安装/同版本更新/卸载及外部 QPA 哨兵 gate，以及只写显式 disposable clone/evidence 根的三语 PID 窗口截图门；原生入口五路径、Program Files/UAC、跨版本安装器升级与最终三语 GUI 仍需闭环后才能公开发布。旧壳层脚本、handler、harness、builder 配置与 fallback 打包入口不得恢复。
