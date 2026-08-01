/**
 * [INPUT]: 依赖 src/main.rs 的 Windows 保留参数分流与普通 Tauri WebView 入口。
 * [OUTPUT]: 断言提升 worker、卸载 English 恢复、headless Cavalry 启动和 WebView 的固定消费顺序。
 * [POS]: src-tauri/tests 的进程装配合同；防止保留参数失败后落入错误的原生启动或 GUI 路径。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#[cfg(target_os = "windows")]
use std::{fs, path::Path};

#[test]
#[cfg(target_os = "windows")]
fn reserved_windows_workers_precede_headless_launch_and_webview_runtime() {
    let main =
        fs::read_to_string(Path::new(env!("CARGO_MANIFEST_DIR")).join("src/main.rs")).unwrap();
    let worker = main
        .find("dispatch_elevated_language_worker_current_process()")
        .expect("main must dispatch the reserved elevated worker");
    let uninstall_restore = main
        .find("dispatch_uninstall_restore_current_process()")
        .expect("main must dispatch the exact uninstall restore mode");
    let headless = main
        .find("headless_launch::dispatch_current_process()")
        .expect("main must retain the native Cavalry launch path");
    let webview = main
        .find("cavalry_i18n_tauri::run();")
        .expect("main must retain the ordinary Tauri runtime");

    assert!(
        worker < uninstall_restore && uninstall_restore < headless && headless < webview,
        "reserved worker argv must be consumed before any native launch or WebView"
    );
}
