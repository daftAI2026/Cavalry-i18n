# commands/
> L2 | 父级: ../CLAUDE.md

成员清单
native_windows.rs: Windows2.8宿主/OS根/写者准入；Apply写入前共用State持久化已验选择。卸载先解析目标，再恢复profile及原厂QPA；缺状态零profile写入，宿主已移除仍幂等恢复profile。
native_resources.rs: 显式2.8.1候选在编译期选独立target/10843键资源；按编译期BuildMode绑定manifest kind；production-2.8要求三语完整10848键。status核文件长度，apply只校验所选payload摘要；不扫描定义或写profile。
native_resources_tests.rs: 显式模式的资源读取合同；生产完整包正例、错误kind/缺译反例与原preview合同共用真实loader，不依赖测试二进制的编译模式。
native_runtime.rs: 显式native动作协调runtime与profile；NRT恢复先于路由，profile错误code不变；非English同源候选先读bounded owner hint与approved SHA，再用observe_install核canonical 2.8.0身份；匹配时只走canonical profile事务，不读baseline/槽/签名、不写App、不授App写恢复权；同源路由由native_user报告receipt恢复检查并在新receipt写前启动Apply；English、缺hint、坏hint、源不匹配与非2.8候选保留原完整owner准入；独立restart不变。
native_runtime_profile_route_tests.rs: 用临时2.8 bundle/owner/profile证明同源hint只准profile快路；精确断言成功Verify→Ensure→Apply，坏receipt或漂移在Ensure以error结束；故意缺vendor baseline与Extension以证明未调用整包owner；覆盖English、未知/坏owner、源漂移/缺失、错误版本和NRT失败；取得bundle guard的用例使用共享test-only串行器；不接真实App/profile。
native_runtime_source.rs: 只读build.rs嵌入的当前目标native runtime；preview与production按当前Rust目标校验thin dylib，运行时不接受环境或路径，不载旧2.7 dylib。
native_official.rs: 固定Developer-ID requirement、canonical bundle/可显示版本/原厂executable的5秒OS验签只证明vendor_origin；最终Official显示还需native_user证明内置locale与无Switcher覆盖，不授予恢复或写入许可。另提供独立typed baseline源桥，要求canonical root、2.8 target与固定OS验签共同通过；不改变Official显示门。内置policy id与target摘要给baseline loader独立复核，不从manifest自报。
native_user.rs: 共享typed profile状态与apply/English事务；Current-owned非英语同时比较runtime源，Windows English复用marker/QPA残留检查保留协调入口并拒Official，不授hostless许可；Mac保留owner/NRT。
patch_receipt.rs: 已应用补丁的历史源身份；随包语言、平台 runtime、wrapper 与 Switcher 版本构成内容地址，严格绑定安装根/宿主 revision/语言，版本比较只读，不写成功状态。
patch_receipt_storage.rs: 私有补丁 generation 存储；按规范相对路径逐文件验证摘要/模式及闭合集合，拒绝 symlink 与内容漂移，发布新目录而不覆盖旧历史源。
patch_receipt_tests.rs: generation 发布/旧版本重读与源变化合同；与 status/真实 clone 升级测试分层，不将孤立 generation 当作成功回执。
apply.rs: 语言写入事务编排；macOS 受管态先判定是否存在完整 vendor/English baseline，旧 JSON-only provenance 即使沿用历史 revision 格式也返回稳定 `reinstallRequired`；只有基线完整时才比较 state/path/revision 与 marker，绑定、受管 runtime postimage 或 marker drift 均安全拒绝而不误报重装；旧 wrapper/injector 仅作为普通 0755 安全替换槽，不要求历史版本身份，非 English 每次从当前 package 重建 runtime，Official Restore 从 baseline 精确还原/删除；Windows legacy provenance 迁移不受该 macOS 门影响；候选源冻结后才写安装，成功完成时才原子提交补丁回执，原厂恢复清除回执；保持 `apply_language_inner` 公开测试 seam；Switch/Restore 在共享 operation lock 内按当前选择静默收敛本工具 journal，再执行完整身份、English 基线与写入证明；macOS 共用只读 exact-PID admission，不替用户关闭 Cavalry，并在首个 mutation 前复核；Windows 生产/测试共用 pair 构造，Program Files 恢复继续走 same-EXE RunAs；stock runtime 外置签名组件按自有路径进入 durable cleanup；已由 official baseline 验证的 managed vendor postimage 即使 strict codesign 漂移也可进入正常事务重签；App Management 只由事务层 typed PermissionDenied 进入 renderer。
context.rs: 统一repo/state/resource；Windows GUI/CLI/卸载同用编译模式与无AppHandle路径投影，production/preview状态域分离，宿主profile独立解析。
contract.rs: 含languageScope/nativeResourceAvailable、可选nativeLocaleState三态、receipt证明的nativeEnglishRestoreAvailable与patchStatus版本状态的renderer DTO、九命令及operation event合同；installationMode在legacy默认unknown，显式macOS预览须固定厂商requirement验签及内置语言/无Switcher覆盖同时成立才标`official`且不代表版本/资源/应用许可；内部签名凭据/baseline/journal不进入renderer；集中camelCase JSON、稳定错误码、App Management handoff与Channel post-commit语义。
restart.rs: 按BuildMode选择原生或legacy；Windows native核profile及2.8宿主，Mac保留NRT/owner准入。
user_language.rs: 产品语言码到 Cavalry native locale 的纯投影；生产文件事务复用同一映射并保留 typed locale 元数据，纯 JSON apply helper 协作；CAS rollback 与 English helper 仅 cfg(test)，不触及文件、安装 marker、baseline、QPA 或 IPC。
user_language_files.rs: macOS 2.8 native-first user profile 文件事务 owner；apply复用首次验证且无pending的receipt，仅pending恢复后读回磁盘；新pending回执另行显式验证；guarded apply在校验、writer admission后且首次receipt写前触发一次无IO ready闭包；apply写单条strings pack并最后提交typed locale，en-GB restore使用独立恢复事务；hostless restore以解析时bytes+mode作预发布期望；乐观比较不宣称OS CAS，生产writer admission由facade提供。
user_language_files_paths.rs: 固定路径身份；Mac绑定home，Windows独立Local偏好根和Roaming资源根；拒绝symlink/reparse和逃逸。
user_language_files_receipt.rs: 受限 receipt 与 profile 语义验证；初装 pending apply 可无 active，但 active/pending 双空状态拒绝；约束合法产品语言、pending/active locale-postimage 与单语言 UI-text resource 关系，比较当前 locale 和 strings 完整 bytes/mode，projection 只暴露产品码/所有权和 active resource SHA-256，不把未知 locale 当 English。
user_language_files_storage.rs: 固定布局stage、完整前像比较及原子发布；Windows共用windows_fs目录同步，失败保留pending。
snapshot.rs: English 安装真相与快照/provenance 闸门；macOS 只从 clean vendor identity/signature 捕获包含 JSON 与原厂 runtime preimage 的 unified baseline，不从旧 JSON-only snapshot 推断管理权；所有 snapshot/runtime 证明只在用户语言动作内执行；state durability warning 锁定 renderer mutation，内部显式 refresh seam 即使 snapshot state no-op 也重新 fsync state 目录，成功后才解除；Windows 以 38 份 JSON + 精确原厂 QPA 识别厂商重装造成的 stale marker/runtime；renderer 不直接调用 snapshot mutation。
snapshot_legacy.rs: Windows legacy JSON/QPA 安装的只读可信识别与 apply-only immutable English generation 迁移；macOS 不编译该兼容子模块，不接受 JSON-only backup、历史 wrapper/injector pair 或旧回执代替完整 official vendor baseline；Windows 继续要求 QPA/vendor 证据。
snapshot_tests.rs: snapshot.rs 的隔离测试合同；覆盖 state durability、macOS official baseline capture、refresh 零写入、Windows residue/recovery fail-closed 与 pending recovery 所有权；源码合同锁定Tauri async状态包装必须委托spawn_blocking的同步status owner且两层都不恢复pending事务，不进入生产command surface。
status.rs: 启动只读观察与安装选择owner；Tauri command把只读工作卸载至blocking worker；native发现用独立2.8 bundle观察、不经过2.7旧JSON布局，native预览独立读取vendor来源，再与native_user内置语言/无Switcher覆盖合成Official显示门，五秒原厂验签失败只留unknown、不改变版本兼容/资源/profile；tempfile组合门保持Absent的`en+unset`、Known的explicit、资源可用性与补丁状态不变，自有三语/未知/漂移仅隐藏Official；locale键Absent按锁定原厂fallback投影`en+unset`且不读取系统语言，未知/损坏/读取失败仍为`unknown+unrecognized`，默认2.7不变；non-English安装按回执/root/revision/源摘要投影current/updateAvailable/unknown；仅强Current-owned完整postimage投影nativeEnglishRestoreAvailable；English marker与Windows runtime residue各按自身边界保留Restore入口；启动不探测journal、英文snapshot、进程或写权限，事务授权仍由用户动作裁决。
tests.rs: commands 基础契约 owner tests；验证缺少补丁回执的旧安装不被误判最新，覆盖 macOS P4/P5 形态的 JSON-only provenance 优先重装分类与完整基线绑定漂移拒绝、DTO、锁、marker、Windows pending marker/English runtime residue 只读投影、snapshot、四阶段真实 apply/clean-English no-op 边界、稳定 manifest、RAII 未完成阶段收口与 Tauri Channel rejection 隔离，并挂载运行时领域子模块。
tests/runtime.rs: macOS apply fixture 与 Windows DLL/语言资源解析分开验证，覆盖打包资源、语言 apply、macOS直接调用内部legacy helper的fixture runner与Windows restart边界回归；native profile准入由独立fixture合同覆盖；Windows 断言 QPA ACTIVE 且子进程环境只含诊断 marker，复用父级 fixture，不在磁盘写魔法 ACTIVE sentinel。
tests/native_user_official_independence.rs: tempfile双门合同；只有可信vendor+无Switcher覆盖的内置en/ja可声明Official，自有三语/旧pack/缺资源/漂移/pending/坏证据隐藏徽章；另测Current-owned非英语的runtime source失配、一致、缺失与不可读投影；不改变语言、资源或owned English恢复能力。
tests/native_status_readonly_smoke.rs: status人工ignored组合烟测；真实原厂签名/编译包/OS默认profile经同一次生产native status owner投影，不启动GUI或创建模拟首次运行的state，细节由tests地图约束。
update.rs: Switcher自更新；preview禁用，production仅允许正式identifier与唯一latest.json。安装只消费Rust持有的已检查Update，复用operation lock与三阶段Channel；不另设旧feed。

法则: facade 只保留稳定命令与兼容 seam；领域逻辑按状态、快照、写入、平台运行时单向下沉。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
