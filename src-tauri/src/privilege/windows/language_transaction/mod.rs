/**
 * [INPUT]: 依赖本目录的封闭 plan/transport、same-EXE launcher、父进程 staging、编译期 source provenance、durable journal 与 elevated worker。
 * [OUTPUT]: 向 Windows privilege 边界暴露一次 UAC 的语言事务模块，并保持父进程、worker 与固定发布资源共用同一合同。
 * [POS]: privilege/windows/language_transaction 的模块根；只组织事务与来源证明职责，不承载任意复制路径或平台入口逻辑。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
pub(crate) mod contract;
pub(crate) mod launcher;
pub(crate) mod parent;
pub(crate) mod source_provenance;
pub(crate) mod storage;
pub(crate) mod worker;
