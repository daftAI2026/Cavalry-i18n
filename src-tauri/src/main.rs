#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
/**
 * [INPUT]: 依赖 Windows headless launch 分流与 cavalry_i18n_tauri::run Tauri runtime。
 * [OUTPUT]: 对外提供桌面应用二进制入口，以及不创建 WebView 的 --launch-cavalry 快速路径。
 * [POS]: src-tauri/src 的进程入口；先消费受控原生启动参数，其余调用保持进入 lib.rs 的 Tauri 装配层。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

fn main() {
    #[cfg(target_os = "windows")]
    if cavalry_i18n_tauri::headless_launch::dispatch_current_process() {
        return;
    }
    cavalry_i18n_tauri::run();
}
