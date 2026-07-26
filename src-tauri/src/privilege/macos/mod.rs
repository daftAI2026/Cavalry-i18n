/**
 * [INPUT]: 依赖 runner、CopyPair、macOS codesign/xattr/AppleScript 系统边界。
 * [OUTPUT]: 组织管理员复制与 bundle 签名/隔离属性两个 macOS 子域。
 * [POS]: privilege 的 macOS 平台分区；不把 AppleScript 或代码签名细节泄漏给命令编排。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
pub(crate) mod admin_copy;
pub(crate) mod bundle;
