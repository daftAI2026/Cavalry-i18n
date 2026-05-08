/**
 * [INPUT]: 依赖 std fs/env/path 读取 Cavalry.app 候选位置和 Info.plist 文本
 * [OUTPUT]: 对外提供 default_app_candidates、find_cavalry_app、read_bundle_version、list_language_options、inspect_bundle
 * [POS]: src-tauri/src 的应用探测模块，对齐 Tauri command 状态需求
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
use std::{
    env, fs,
    path::{Path, PathBuf},
};

use crate::mac_runtime::LANG_MARKER_NAME;

#[derive(Debug, PartialEq, Eq)]
pub struct BundleInfo {
    pub exists: bool,
    pub app_path: String,
    pub version: String,
    pub has_assets_root: bool,
    pub has_definitions: bool,
    pub has_learn: bool,
    pub has_plugins: bool,
}

pub fn default_app_candidates() -> Vec<PathBuf> {
    let mut candidates = vec![PathBuf::from("/Applications/Cavalry.app")];
    if let Some(home) = env::var_os("HOME") {
        candidates.push(PathBuf::from(home).join("Applications").join("Cavalry.app"));
    }
    candidates
}

pub fn find_cavalry_app(state_app_path: &str) -> PathBuf {
    let mut candidates = Vec::new();
    if !state_app_path.is_empty() {
        candidates.push(PathBuf::from(state_app_path));
    }
    candidates.extend(default_app_candidates());
    candidates
        .into_iter()
        .find(|candidate| candidate.exists())
        .unwrap_or_default()
}

pub fn read_bundle_version(app_path: &Path) -> Result<String, String> {
    if app_path.as_os_str().is_empty() {
        return Ok(String::new());
    }
    let info_plist = app_path.join("Contents").join("Info.plist");
    let source = fs::read_to_string(info_plist).map_err(|error| error.to_string())?;
    Ok(read_plist_string(&source, "CFBundleShortVersionString").unwrap_or_default())
}

fn read_plist_string(source: &str, key: &str) -> Option<String> {
    let key_marker = format!("<key>{key}</key>");
    let after_key = source.split_once(&key_marker)?.1;
    let after_open = after_key.split_once("<string>")?.1;
    let value = after_open.split_once("</string>")?.0;
    Some(value.trim().to_string())
}

pub fn list_language_options(languages_dir: &Path) -> Vec<String> {
    let mut values = match fs::read_dir(languages_dir) {
        Ok(entries) => entries
            .flatten()
            .filter(|entry| entry.file_type().map(|kind| kind.is_dir()).unwrap_or(false))
            .filter_map(|entry| entry.file_name().into_string().ok())
            .filter(|name| name != "en" && !name.starts_with('.'))
            .collect::<Vec<_>>(),
        Err(_) => Vec::new(),
    };
    values.sort();
    values
}

pub fn inspect_bundle(app_path: &Path) -> BundleInfo {
    let contents = app_path.join("Contents");
    let assets_root = contents.join("assets");
    BundleInfo {
        exists: !app_path.as_os_str().is_empty() && app_path.exists(),
        app_path: app_path.to_string_lossy().to_string(),
        version: read_bundle_version(app_path).unwrap_or_default(),
        has_assets_root: assets_root.exists(),
        has_definitions: assets_root.join("Definitions").exists(),
        has_learn: assets_root.join("Learn").exists(),
        has_plugins: assets_root.join("Plugins").exists(),
    }
}

pub fn read_installed_language(app_path: &Path, fallback: &str) -> String {
    if app_path.as_os_str().is_empty() {
        return fallback.to_string();
    }
    let marker_path = app_path
        .join("Contents")
        .join("Resources")
        .join(LANG_MARKER_NAME);
    let value = match fs::read_to_string(marker_path) {
        Ok(value) => value.trim().to_string(),
        Err(_) => return fallback.to_string(),
    };
    if value.is_empty() {
        return "en".to_string();
    }
    if matches!(value.as_str(), "en" | "zh-Hans" | "zh-Hant" | "ja_JP") {
        value
    } else {
        fallback.to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::read_bundle_version;
    use std::fs;

    #[test]
    fn read_bundle_version_from_info_plist() {
        let temp = tempfile::tempdir().unwrap();
        let plist = temp.path().join("Cavalry.app/Contents/Info.plist");
        fs::create_dir_all(plist.parent().unwrap()).unwrap();
        fs::write(
            &plist,
            "<plist><dict><key>CFBundleShortVersionString</key><string>2.3.4</string></dict></plist>",
        )
        .unwrap();

        assert_eq!(
            read_bundle_version(&temp.path().join("Cavalry.app")).unwrap(),
            "2.3.4"
        );
    }
}
