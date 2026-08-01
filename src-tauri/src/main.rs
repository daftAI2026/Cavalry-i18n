#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
/**
 * [INPUT]: 依赖 Windows 提升 worker、卸载 English 恢复、headless launch 分流与 cavalry_i18n_tauri::run。
 * [OUTPUT]: 提供桌面二进制入口，以及不创建 WebView 的提升事务、`--uninstall-restore-english` 和 `--launch-cavalry` 精确路径。
 * [POS]: 进程入口；按提升 worker→卸载恢复→原生启动→Tauri UI 顺序消费保留参数，禁止失败后落入 WebView。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

fn main() {
    #[cfg(target_os = "windows")]
    if let Some(exit_code) = cavalry_i18n_tauri::dispatch_elevated_language_worker_current_process()
    {
        std::process::exit(exit_code as i32);
    }
    #[cfg(target_os = "windows")]
    if let Some(exit_code) = cavalry_i18n_tauri::dispatch_uninstall_restore_current_process() {
        std::process::exit(exit_code);
    }
    #[cfg(target_os = "windows")]
    if cavalry_i18n_tauri::headless_launch::dispatch_current_process() {
        return;
    }
    cavalry_i18n_tauri::run();
}
