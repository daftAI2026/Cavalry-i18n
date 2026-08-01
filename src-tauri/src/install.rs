/**
 * [INPUT]: 依赖 std fs/path 解析用户选择的 Cavalry.app、Cavalry.exe 或安装目录
 * [OUTPUT]: 对外提供 InstallLayout、InstallPlatform、LANG_MARKER_NAME 与安装结构校验、规范化路径能力
 * [POS]: src-tauri/src 的跨平台安装模型，向 detect/patch/commands 隐藏 macOS bundle 与 Windows 平铺目录差异
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
use std::{
    fs,
    path::{Component, Path, PathBuf},
};

pub const LANG_MARKER_NAME: &str = "cavalry-i18n-lang.txt";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum InstallPlatform {
    Macos,
    Windows,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct InstallLayout {
    pub platform: InstallPlatform,
    pub root: PathBuf,
    pub executable: PathBuf,
    pub assets_root: PathBuf,
    pub language_marker: PathBuf,
}

impl InstallLayout {
    pub fn from_selection(selection: &Path) -> Result<Self, String> {
        if selection.as_os_str().is_empty() {
            return Err("Cavalry installation path is empty.".to_string());
        }

        let root = selected_root(selection);
        Ok(Self::from_root(&root))
    }

    pub fn from_root(root: &Path) -> Self {
        let root = normalize_path(root);
        if is_macos_bundle(&root) {
            let contents = root.join("Contents");
            Self {
                platform: InstallPlatform::Macos,
                executable: contents.join("MacOS").join("Cavalry"),
                assets_root: contents.join("assets"),
                language_marker: contents.join("Resources").join(LANG_MARKER_NAME),
                root,
            }
        } else {
            Self {
                platform: InstallPlatform::Windows,
                executable: root.join("Cavalry.exe"),
                assets_root: root.join("assets"),
                language_marker: root.join(LANG_MARKER_NAME),
                root,
            }
        }
    }

    pub fn validate(&self) -> Result<(), String> {
        if !self.root.is_dir() {
            return Err(format!(
                "Cavalry installation directory does not exist: {}",
                self.root.display()
            ));
        }
        if !self.executable.is_file() {
            return Err(format!(
                "Cavalry executable was not found: {}",
                self.executable.display()
            ));
        }

        for required in [
            self.assets_root.join("Definitions").join("appStrings.json"),
            self.assets_root
                .join("Definitions")
                .join("nodeStrings.json"),
        ] {
            if !required.is_file() {
                return Err(format!(
                    "Selected directory is not a supported Cavalry installation; missing {}",
                    required.display()
                ));
            }
        }
        Ok(())
    }

    pub fn is_valid(&self) -> bool {
        self.validate().is_ok()
    }
}

fn selected_root(selection: &Path) -> PathBuf {
    if is_macos_bundle(selection) {
        return selection.to_path_buf();
    }

    let is_cavalry_exe = selection
        .file_name()
        .and_then(|name| name.to_str())
        .is_some_and(|name| name.eq_ignore_ascii_case("Cavalry.exe"));
    if is_cavalry_exe {
        return selection
            .parent()
            .unwrap_or_else(|| Path::new("."))
            .to_path_buf();
    }
    selection.to_path_buf()
}

fn is_macos_bundle(path: &Path) -> bool {
    path.extension()
        .and_then(|extension| extension.to_str())
        .is_some_and(|extension| extension.eq_ignore_ascii_case("app"))
        || path.join("Contents").join("Info.plist").is_file()
}

pub fn normalize_path(path: &Path) -> PathBuf {
    let absolute = if path.is_absolute() {
        path.to_path_buf()
    } else {
        std::env::current_dir()
            .unwrap_or_else(|_| PathBuf::from("."))
            .join(path)
    };
    let canonical = fs::canonicalize(&absolute).unwrap_or(absolute);
    strip_verbatim_prefix(lexically_normalize(&canonical))
}

fn lexically_normalize(path: &Path) -> PathBuf {
    let mut normalized = PathBuf::new();
    for component in path.components() {
        match component {
            Component::CurDir => {}
            Component::ParentDir => {
                let _ = normalized.pop();
            }
            other => normalized.push(other.as_os_str()),
        }
    }
    normalized
}

#[cfg(windows)]
fn strip_verbatim_prefix(path: PathBuf) -> PathBuf {
    let value = path.to_string_lossy();
    if let Some(rest) = value.strip_prefix(r"\\?\UNC\") {
        return PathBuf::from(format!(r"\\{rest}"));
    }
    value
        .strip_prefix(r"\\?\")
        .map(PathBuf::from)
        .unwrap_or(path)
}

#[cfg(not(windows))]
fn strip_verbatim_prefix(path: PathBuf) -> PathBuf {
    path
}

#[cfg(test)]
mod tests {
    use super::{InstallLayout, InstallPlatform};
    use std::fs;

    fn write(path: &std::path::Path) {
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::write(path, b"{}").unwrap();
    }

    #[test]
    fn windows_executable_and_directory_resolve_to_same_root() {
        let temp = tempfile::tempdir().unwrap();
        let root = temp.path().join("Custom Cavalry");
        write(&root.join("Cavalry.exe"));
        write(&root.join("assets/Definitions/appStrings.json"));
        write(&root.join("assets/Definitions/nodeStrings.json"));

        let from_root = InstallLayout::from_selection(&root).unwrap();
        let from_exe = InstallLayout::from_selection(&root.join("Cavalry.exe")).unwrap();

        assert_eq!(from_root, from_exe);
        assert_eq!(from_root.platform, InstallPlatform::Windows);
        assert!(from_root.validate().is_ok());
    }

    #[test]
    fn mac_bundle_layout_remains_available_on_every_test_host() {
        let temp = tempfile::tempdir().unwrap();
        let root = temp.path().join("Cavalry.app");
        write(&root.join("Contents/MacOS/Cavalry"));
        write(&root.join("Contents/assets/Definitions/appStrings.json"));
        write(&root.join("Contents/assets/Definitions/nodeStrings.json"));

        let layout = InstallLayout::from_selection(&root).unwrap();

        assert_eq!(layout.platform, InstallPlatform::Macos);
        assert!(layout.assets_root.ends_with("Contents/assets"));
        assert!(layout.validate().is_ok());
    }
}
