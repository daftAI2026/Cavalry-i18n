/**
 * [INPUT]: 依赖 privilege 的 runner/copy transaction 与 Windows Known Folder、PowerShell UAC 实现。
 * [OUTPUT]: 组织 known_folders、manifest、admin_copy 三个 Windows 权限子域。
 * [POS]: privilege 的 Windows 平台分区；UAC 信任边界只在此目录内展开。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
pub(crate) mod admin_copy;
pub(crate) mod known_folders;
pub(crate) mod manifest;
