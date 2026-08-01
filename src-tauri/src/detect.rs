/**
 * [INPUT]: 依赖 install 的跨平台布局、state 保存路径以及 windows_install 的只读发现线索
 * [OUTPUT]: 对外提供候选发现、安装根解析、展示版本、不可变二进制 revision、语言选项与安装诊断
 * [POS]: src-tauri/src 的安装探测模块，分离 MSI/Info.plist 展示版本与 English 快照失效所需的稳定内容身份
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
use std::{
    collections::HashSet,
    fs,
    io::Read,
    path::{Path, PathBuf},
};

use sha2::{Digest, Sha256};

#[cfg(target_os = "macos")]
use std::env;

use crate::{
    install::{normalize_path, InstallLayout, InstallPlatform},
    windows_install,
};

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
    #[cfg(target_os = "macos")]
    {
        let mut candidates = vec![PathBuf::from("/Applications/Cavalry.app")];
        if let Some(home) = env::var_os("HOME") {
            candidates.push(PathBuf::from(home).join("Applications").join("Cavalry.app"));
        }
        return candidates;
    }

    #[cfg(target_os = "windows")]
    {
        let candidates = windows_install::running_process_candidates()
            .into_iter()
            .chain(windows_install::msi_shortcut_candidates())
            .chain(windows_install::common_install_candidates())
            .filter_map(|candidate| InstallLayout::from_selection(&candidate).ok())
            .map(|layout| layout.root)
            .collect::<Vec<_>>();
        return dedupe_paths(candidates);
    }

    #[allow(unreachable_code)]
    Vec::new()
}

pub fn find_cavalry_app(state_app_path: &str) -> PathBuf {
    find_cavalry_app_from_candidates(state_app_path, default_app_candidates())
}

pub fn find_cavalry_app_from_candidates(
    state_app_path: &str,
    candidates: impl IntoIterator<Item = PathBuf>,
) -> PathBuf {
    let saved = (!state_app_path.trim().is_empty()).then(|| PathBuf::from(state_app_path));
    saved
        .into_iter()
        .chain(candidates)
        .filter_map(|candidate| InstallLayout::from_selection(&candidate).ok())
        .find(|layout| layout.is_valid())
        .map(|layout| layout.root)
        .unwrap_or_default()
}

pub fn resolve_install(selection: &Path) -> Result<InstallLayout, String> {
    let layout = InstallLayout::from_selection(selection)?;
    layout.validate()?;
    Ok(layout)
}

pub fn read_bundle_version(app_path: &Path) -> Result<String, String> {
    if app_path.as_os_str().is_empty() {
        return Ok(String::new());
    }
    let layout = InstallLayout::from_selection(app_path)?;
    match layout.platform {
        InstallPlatform::Macos => {
            let info_plist = layout.root.join("Contents").join("Info.plist");
            let source = fs::read_to_string(info_plist).map_err(|error| error.to_string())?;
            Ok(read_plist_string(&source, "CFBundleShortVersionString").unwrap_or_default())
        }
        InstallPlatform::Windows => Ok(windows_install::product_version_for_executable(
            &layout.executable,
        )
        .unwrap_or_default()),
    }
}

pub fn read_bundle_revision(app_path: &Path) -> Result<String, String> {
    if app_path.as_os_str().is_empty() {
        return Ok(String::new());
    }
    let layout = InstallLayout::from_selection(app_path)?;
    match layout.platform {
        InstallPlatform::Macos => {
            let version = read_bundle_version(&layout.root)?;
            if version.is_empty() {
                return Err(format!(
                    "Could not read Cavalry bundle version from {}",
                    layout.root.display()
                ));
            }
            Ok(format!("bundle-version:{version}"))
        }
        InstallPlatform::Windows => {
            let mut entries = Vec::new();
            for (relative_path, required) in [
                ("Cavalry.exe", true),
                ("CavalryFramework.dll", false),
                ("CavalryUI.dll", false),
            ] {
                let path = layout.root.join(relative_path);
                if !path.is_file() {
                    if required {
                        return Err(format!(
                            "Cavalry revision input is missing: {}",
                            path.display()
                        ));
                    }
                    continue;
                }
                entries.push(format!("{relative_path}=sha256:{}", sha256_file(&path)?));
            }
            Ok(entries.join(";"))
        }
    }
}

fn sha256_file(path: &Path) -> Result<String, String> {
    let mut file = fs::File::open(path)
        .map_err(|error| format!("Could not open revision input {}: {error}", path.display()))?;
    let mut digest = Sha256::new();
    let mut buffer = [0_u8; 64 * 1024];
    loop {
        let read = file.read(&mut buffer).map_err(|error| {
            format!("Could not hash revision input {}: {error}", path.display())
        })?;
        if read == 0 {
            break;
        }
        digest.update(&buffer[..read]);
    }
    Ok(format!("{:x}", digest.finalize()))
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
    let layout = InstallLayout::from_selection(app_path)
        .unwrap_or_else(|_| InstallLayout::from_root(app_path));
    BundleInfo {
        exists: !layout.root.as_os_str().is_empty() && layout.root.exists(),
        app_path: layout.root.to_string_lossy().to_string(),
        version: read_bundle_version(&layout.root).unwrap_or_default(),
        has_assets_root: layout.assets_root.exists(),
        has_definitions: layout.assets_root.join("Definitions").exists(),
        has_learn: layout.assets_root.join("Learn").exists(),
        has_plugins: layout.assets_root.join("Plugins").exists(),
    }
}

pub fn read_installed_language(app_path: &Path, fallback: &str) -> String {
    if app_path.as_os_str().is_empty() {
        return fallback.to_string();
    }
    let layout = match InstallLayout::from_selection(app_path) {
        Ok(layout) => layout,
        Err(_) => return fallback.to_string(),
    };
    let value = match fs::read_to_string(layout.language_marker) {
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

fn dedupe_paths(paths: Vec<PathBuf>) -> Vec<PathBuf> {
    let mut seen = HashSet::new();
    let mut output = Vec::new();
    for path in paths {
        let normalized = normalize_path(&path);
        #[cfg(windows)]
        let key = normalized.to_string_lossy().to_ascii_lowercase();
        #[cfg(not(windows))]
        let key = normalized.to_string_lossy().to_string();
        if seen.insert(key) {
            output.push(normalized);
        }
    }
    output
}

#[cfg(test)]
mod tests {
    use super::{find_cavalry_app_from_candidates, read_bundle_version};
    use std::fs;

    fn write(path: &std::path::Path, value: &[u8]) {
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::write(path, value).unwrap();
    }

    #[test]
    fn read_bundle_version_from_info_plist() {
        let temp = tempfile::tempdir().unwrap();
        let app = temp.path().join("Cavalry.app");
        write(&app.join("Contents/MacOS/Cavalry"), b"binary");
        write(
            &app.join("Contents/assets/Definitions/appStrings.json"),
            b"{}",
        );
        write(
            &app.join("Contents/assets/Definitions/nodeStrings.json"),
            b"{}",
        );
        write(
            &app.join("Contents/Info.plist"),
            b"<plist><dict><key>CFBundleShortVersionString</key><string>2.3.4</string></dict></plist>",
        );

        assert_eq!(read_bundle_version(&app).unwrap(), "2.3.4");
    }

    #[test]
    fn saved_valid_install_wins_over_discovered_candidates() {
        let temp = tempfile::tempdir().unwrap();
        let saved = temp.path().join("Saved");
        let discovered = temp.path().join("Discovered");
        for root in [&saved, &discovered] {
            write(&root.join("Cavalry.exe"), b"binary");
            write(&root.join("assets/Definitions/appStrings.json"), b"{}");
            write(&root.join("assets/Definitions/nodeStrings.json"), b"{}");
        }

        assert_eq!(
            find_cavalry_app_from_candidates(
                &saved.to_string_lossy(),
                [discovered.clone()].into_iter()
            ),
            crate::install::normalize_path(&saved)
        );
    }
}
