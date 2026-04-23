#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
/**
 * [INPUT]: 依赖 cavalry_i18n_tauri::run 启动 Tauri runtime
 * [OUTPUT]: 对外提供桌面应用二进制入口
 * [POS]: src-tauri/src 的 thin main，所有业务注册留在 lib.rs
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

fn main() {
    cavalry_i18n_tauri::run();
}
