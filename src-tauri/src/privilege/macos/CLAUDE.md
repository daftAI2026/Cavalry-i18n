# privilege/macos/
> L2 | 父级: ../CLAUDE.md

成员清单
mod.rs: macOS privilege 子模块边界；向上提供 bundle 系统操作、selected/all-Cavalry 进程准入与当前 OS 用户 home 解析。
apply_transaction.rs: macOS bundle transaction owner；2.7 StateBound仍用schema 6；NRT schema 7持久化source SHA和旧owner bytes/mode；另导出status与同源profile判路共用的只读owner hint；begin_signing与bundle checkpoint复用相邻当前指纹；cfg(test)读取计数器仅观察线程内指定bundle固定槽；live签名proof只绑定当前operation、bundle和journal postimage，签发前要求deferred App写入清空；commit复核固定槽，Committed后再核槽并发布owner；NRT恢复用同份manifest验intent，四个有效App回滚phase在当前像复核后执行profile callback；通用StateBound与Drop不调用callback；普通commit拒绝原厂恢复意图；owner发布比较旧像后rename，不声称OS CAS；不扫描vendor资源。
native_runtime_fingerprint_reuse_tests.rs: apply_transaction生产phase回归；真实调用begin_signing与bundle checkpoint，按CodeResources固定槽统计单读，核对指纹留存与校验错误；用NRT临时fixture替换FnOnce-only helper弱合同；不访问真实App/profile。
native_runtime_transaction_tests.rs: apply_transaction隔离合同；验证CodeResources准入、schema 6/7互斥、验签失败、验源一次、deferred App写未完成时拒发proof、proof跨事务拒绝、Committed后固定槽漂移保留journal、payload drift、owner/source intent校验与crash recovery；提供NRT临时fixture供phase回归复用。
native_runtime_terminal.rs: NRT来源终结器；live commit消费同事务最终postimage proof与固定槽检查；恢复入口不预读manifest，内核校验同份manifest的kind/schema/intent；只在四个有效App回滚phase消费profile callback；旧owner→新owner更新只接受精确旧像或同事务新像；Restored验证旧owner，第三态保留journal；原厂restore回滚复核旧归属。
native_runtime_owner.rs: v1/v2八槽owner仍可读取与原厂恢复；v3记录source SHA并将Extension纳入九槽；hint只读owned/source摘要，供status与同源profile判路；不读journal、App槽或签名，不授权App写或恢复；完整准入复核owner版本对应槽、baseline与签名；语言切换和启动不读整树摘要；终态原子写owner后退役journal，同新owner重放幂等；旧像比较不是OS CAS；原厂恢复撤销匹配归属。
native_runtime_terminal_tests.rs: NRT终结器的owner/source/原厂恢复fixture合同；fake宿主沿当前native目标版本抵达真实验源门，避免旧版本提前拒绝掩盖目标测试；以父模块私有fixture供preflight子模块复用，不访问真实App/profile。
native_runtime_preflight_tests.rs: 复用父测试fixture的恢复回调时序合同；四有效phase只调一次，终态/坏journal不调，读错不写App；隔离schema 6兼容，不证明厂商。
native_runtime_finalizer_sentinel_tests.rs: generic finalizer 的独立隔离合同；验证 NRT Restored、RuntimeCommitted、Committed 均被拒绝，canonical journal 与备份保持；只使用临时 bundle。
bundle.rs: Cavalry.app签名与quarantine操作；legacy helper保留逐对象写后验；NRT专用端口只签明确nested名单与app seal，transaction再验最终postimage；直接命令拒绝管理员shell fallback；status-only 5秒runner只向Apple验证精确Developer-ID requirement；外置签名组件只按自有regular-file路径识别兼容残留。
process.rs: 通过 libproc 读取原始 executable 路径；exact guard 仍按选中 canonical executable 限定，新增共享 profile guard 检查所有 `Cavalry`/旧 `CavalryLauncher` 候选的 canonical `*.app/Contents/MacOS` 与 `com.scenegroup.cavalry`，覆盖重命名/多版本副本、忽略可证实的不同 bundle ID、候选无法检查时 fail closed；只忽略 typed vanished PID，普通写入 admission 不发送 terminate。它是进程快照而非 OS launch lock。
user_profile.rs: 以 `getpwuid_r` 解析当前 real/effective uid 的 OS home，不信任 `HOME`、拒绝 uid 不一致与非空 `CFFIXED_USER_HOME`；只提供路径推导的受限基础，不声称证明 Qt TestMode 或 Cavalry 自身 profile 与其一致，也不直接读写用户文件。

法则: macOS JXA/系统调用只能存在于此目录；调用方只依赖 typed command runner 与结果；禁止临时 shell 提权。

变更日志
- 2026-08-09: 消除 codesign mutation→postimage 的恢复空窗；首次安装先发布 wrapper/Info gate 再第三次 exact-PID 扫描；filtered JSON 作为 observe-only generation postcondition；Committed/Restored canonical journal 原子退役后才清理，startup busy 不再永久 latch。
- 2026-08-09: strict apply 增加 exact preimage、双重进程扫描、显式签名 postimage、deferred replacement-before-removal 顺序、state 目录 fsync 门与真实子进程 phase matrix；候选 PID 不可检查、签名白名单外 drift、非 regular mode 与不确定 durability 均 fail closed。
- 2026-08-09: 登记 single-open root、fd-relative/CAS apply transaction、当时使用 HMAC 的 journal、quarantine preimage 与启动恢复职责；补齐 symlink/hardlink/TOCTOU fail-closed 边界。2026-09-02 因 ad-hoc 更新身份会触发 Keychain 密码框，保留 durable journal 与结构/CAS 校验，移除 HMAC/Keychain 依赖。
- 2026-10-07: 增加显式 NativeRuntimeOnly journal kind；schema 7 要求 CodeResources 签名 postimage，并在 bundle terminal/backup 退役前复核 postimage；state-bound schema 6 保持旧序列化兼容。
- 2026-10-07: 通用恢复终结器拒绝 NRT 所有终态并保留 journal/备份；本批补NRT持久来源意图与专用终结器；显式native command已消费，现场启动验收另账。
- 2026-10-08: live NRT验签签发只在内存流转的operation/bundle proof；提交复用proof与固定槽检查，独立recovery仍重新验源；legacy签名helper语义不变。
- 2026-10-08: NRT恢复以同份manifest校验来源；profile callback仅在四个有效App回滚phase的当前像复核后执行，StateBound、终态和非法state phase不消费。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
