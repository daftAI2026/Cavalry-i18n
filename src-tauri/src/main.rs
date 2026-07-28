#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
/**
 * [INPUT]: 依赖 Windows 提升 worker/headless launch 分流与 cavalry_i18n_tauri::run Tauri runtime。
 * [OUTPUT]: 对外提供桌面应用二进制入口，以及不创建 WebView 的提升事务和 --launch-cavalry 快速路径。
 * [POS]: src-tauri/src 的进程入口；先消费保留的提升参数，再消费受控原生启动参数，其余调用进入 lib.rs 的 Tauri 装配层。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

fn main() {
    #[cfg(target_os = "windows")]
    if let Some(exit_code) = cavalry_i18n_tauri::dispatch_elevated_language_worker_current_process()
    {
        std::process::exit(exit_code as i32);
    }
    #[cfg(target_os = "windows")]
    if cavalry_i18n_tauri::headless_launch::dispatch_current_process() {
        return;
    }
    cavalry_i18n_tauri::run();
}
