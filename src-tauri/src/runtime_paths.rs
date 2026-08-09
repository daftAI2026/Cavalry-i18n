/**
 * [INPUT]: 依赖编译期仓库位置、CAVALRY_I18N_STATE_DIR 覆盖、Windows APPDATA 与系统临时目录。
 * [OUTPUT]: 提供统一 repo root、state fallback 与 Windows 当前用户 state 目录解析。
 * [POS]: src-tauri/src 的运行路径真相源；GUI command 与无 WebView 启动入口不得各自推导同一 state 路径。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
use std::{
    env,
    path::{Path, PathBuf},
};

#[cfg(any(target_os = "windows", test))]
const APP_DATA_DIRECTORY: &str = "com.daftai.cavalry-i18n";

pub(crate) fn repo_root() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .unwrap_or_else(|| Path::new(env!("CARGO_MANIFEST_DIR")))
        .to_path_buf()
}

pub(crate) fn resolve_state_dir(app_data_dir: Option<PathBuf>) -> PathBuf {
    env::var_os("CAVALRY_I18N_STATE_DIR")
        .map(PathBuf::from)
        .or(app_data_dir)
        .unwrap_or_else(|| env::temp_dir().join("cavalry-i18n-tauri-state"))
}

#[cfg(target_os = "windows")]
pub(crate) fn current_windows_state_dir() -> PathBuf {
    let app_data_dir = env::var_os("APPDATA")
        .map(PathBuf::from)
        .map(|root| root.join(APP_DATA_DIRECTORY));
    resolve_state_dir(app_data_dir)
}

#[cfg(test)]
mod tests {
    use super::APP_DATA_DIRECTORY;

    #[test]
    fn windows_state_directory_matches_tauri_identifier() {
        let config: serde_json::Value =
            serde_json::from_str(include_str!("../tauri.conf.json")).unwrap();
        assert_eq!(config["identifier"], APP_DATA_DIRECTORY);
    }
}
