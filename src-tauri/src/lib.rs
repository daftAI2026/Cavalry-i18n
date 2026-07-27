/**
 * [INPUT]: 依赖 tauri Builder、bridge 初始化脚本、稳定 commands facade、Windows headless launch/QPA 持久部署、共享 operation_lock/runtime_paths 与私有 platform_runtime。
 * [OUTPUT]: 对外提供 run 函数、Windows 原生启动与 QPA 部署分流、稳定的六命令注册表与后端公共纯模块。
 * [POS]: src-tauri/src 的应用装配层；组合命令 facade、共享运行基础与平台启动边界，但不承载具体写入或系统命令业务。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
pub mod bridge;
pub mod commands;
pub mod detect;
#[cfg(target_os = "windows")]
pub mod headless_launch;
pub mod install;
pub mod keychain_patch;
pub mod mac_runtime;
mod operation_lock;
pub mod patch;
mod platform_runtime;
pub mod privilege;
mod runtime_paths;
pub mod state;
pub mod windows_install;
#[cfg(target_os = "windows")]
pub mod windows_qpa;
pub mod windows_runtime;

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
