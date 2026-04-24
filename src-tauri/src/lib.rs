/**
 * [INPUT]: 依赖 tauri Builder、bridge 初始化脚本与 commands 模块
 * [OUTPUT]: 对外提供 run 函数和 Tauri command 注册表
 * [POS]: src-tauri/src 的应用装配层，替代 Electron main 的 command 注册职责
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
pub mod bridge;
pub mod commands;
pub mod detect;
pub mod keychain_patch;
pub mod mac_runtime;
pub mod patch;
pub mod privilege;
pub mod state;

pub fn run() {
    tauri::Builder::default()
        .append_invoke_initialization_script(bridge::script())
        .invoke_handler(tauri::generate_handler![
            commands::get_status,
            commands::browse_app,
            commands::extract_english,
            commands::apply_language,
            commands::open_privacy_security,
            commands::restart_cavalry
        ])
        .run(tauri::generate_context!())
        .expect("failed to run Cavalry-i18n Tauri app");
}
