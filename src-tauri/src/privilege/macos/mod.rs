/**
 * [INPUT]: 依赖 runner、CopyPair、macOS fd/renameatx_np、codesign/xattr/AppleScript 系统边界。
 * [OUTPUT]: 组织结构/路径/CAS 校验的 apply transaction、bundle 签名/隔离属性与 exact-PID 进程控制三个 macOS 子域。
 * [POS]: privilege 的 macOS 平台分区；不把 fd-bound recovery、JXA 或代码签名细节泄漏给命令编排。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
pub(crate) mod apply_transaction;
pub(crate) mod bundle;
pub(crate) mod process;
