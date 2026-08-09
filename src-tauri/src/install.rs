/**
 * [INPUT]: 依赖 std fs/path 解析用户选择的 Cavalry.app、Cavalry.exe 或安装目录
 * [OUTPUT]: 对外提供 InstallLayout、InstallPlatform、LANG_MARKER_NAME、规范化路径与拒绝 symlink 的 verified 安装根入口，以及逐组件 lstat 的相对路径安全门
 * [POS]: src-tauri/src 的跨平台安装模型；兼容发现路径保持宽松，写入/身份验证调用方消费 canonical verified layout 与 component-boundary helper，避免伪造 app、symlink 目标或中间目录外逃进入后续事务
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

    /// Resolve a user-selected installation to a canonical root before any identity or write
    /// decision. The selected bundle itself and the critical macOS bundle entries are required
    /// to be real filesystem objects rather than symlinks.
    pub fn from_verified_selection(selection: &Path) -> Result<Self, String> {
        let root = canonical_root_for_selection(selection)?;
        let layout = Self::from_root(&root);
        layout.validate_verified()?;
        Ok(layout)
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

    pub fn validate_verified(&self) -> Result<(), String> {
        self.validate()?;
        if self.platform != InstallPlatform::Macos {
            return Ok(());
        }

        // Do not rely on Path::is_file()/is_dir() here: those calls follow every parent
        // symlink.  The strict gate is intentionally expressed relative to the canonical app
        // root so mac_official and patch callers can reuse the same component-by-component lstat
        // contract for every critical bundle/asset path.
        for relative in [
            "Contents",
            "Contents/MacOS",
            "Contents/Frameworks",
            "Contents/Resources",
            "Contents/assets",
            "Contents/assets/Definitions",
            "Contents/assets/Plugins",
        ] {
            validate_no_symlink_directory_components(&self.root, Path::new(relative))?;
        }
        for relative in [
            "Contents/Info.plist",
            "Contents/MacOS/Cavalry",
            "Contents/Frameworks/libExtensionLayer.dylib",
        ] {
            validate_no_symlink_components(&self.root, Path::new(relative))?;
        }
        Ok(())
    }
}

/// Verify a path relative to `root` without following any symlink component.
///
/// Existing components must be lstat-clean.  An absent component is allowed so callers can use
/// this helper before checking an optional asset; callers that require a file or directory must
/// still perform their normal existence/type check afterwards.  This distinction lets snapshot
/// discovery report an incomplete installation as missing while still failing closed on an
/// attempted symlink/path escape.
pub fn validate_no_symlink_components(root: &Path, relative: &Path) -> Result<(), String> {
    let root_metadata = fs::symlink_metadata(root).map_err(|error| {
        format!(
            "could not inspect path-security root {}: {error}",
            root.display()
        )
    })?;
    if root_metadata.file_type().is_symlink() {
        return Err(format!(
            "refusing symlink path-security root {}; choose the real installation root",
            root.display()
        ));
    }
    if !root_metadata.is_dir() {
        return Err(format!(
            "path-security root is not a directory: {}",
            root.display()
        ));
    }
    if relative.is_absolute() {
        return Err(format!(
            "refusing absolute path outside root {}: {}",
            root.display(),
            relative.display()
        ));
    }

    let components = relative.components().collect::<Vec<_>>();
    let mut current = root.to_path_buf();
    for (index, component) in components.iter().enumerate() {
        let Component::Normal(name) = component else {
            return Err(format!(
                "refusing unsafe relative path component in {}",
                relative.display()
            ));
        };
        current.push(name);
        match fs::symlink_metadata(&current) {
            Ok(metadata) if metadata.file_type().is_symlink() => {
                return Err(format!(
                    "refusing symlink path component {}; relative path {} escapes its root",
                    current.display(),
                    relative.display()
                ));
            }
            Ok(metadata) if index + 1 < components.len() && !metadata.is_dir() => {
                return Err(format!(
                    "refusing non-directory path component {}; relative path {} cannot be resolved safely",
                    current.display(),
                    relative.display()
                ));
            }
            Ok(_) => {}
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(()),
            Err(error) => {
                return Err(format!(
                    "could not inspect path component {}: {error}",
                    current.display()
                ));
            }
        }
    }
    Ok(())
}

/// Directory-specialized form of [`validate_no_symlink_components`].  It retains the helper's
/// missing-component behavior, but when the final component exists it must also be a directory;
/// this is used for bundle directories such as Contents/Frameworks and Contents/assets.
pub fn validate_no_symlink_directory_components(
    root: &Path,
    relative: &Path,
) -> Result<(), String> {
    validate_no_symlink_components(root, relative)?;
    let target = root.join(relative);
    match fs::symlink_metadata(&target) {
        Ok(metadata) if metadata.file_type().is_symlink() => Err(format!(
            "refusing symlink directory component {}; relative path {} escapes its root",
            target.display(),
            relative.display()
        )),
        Ok(metadata) if !metadata.is_dir() => Err(format!(
            "refusing non-directory final component {}; relative path {} requires a directory",
            target.display(),
            relative.display()
        )),
        Ok(_) => Ok(()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(format!(
            "could not inspect directory component {}: {error}",
            target.display()
        )),
    }
}

/// Return the canonical installation root without silently following a symlink at the selected
/// app/root itself. Parent symlinks are canonicalized (for example macOS /tmp) but are not
/// treated as ownership of the app bundle.
pub fn canonical_root_for_selection(selection: &Path) -> Result<PathBuf, String> {
    if selection.as_os_str().is_empty() {
        return Err("Cavalry installation path is empty.".to_string());
    }
    let selected = selected_root(selection);
    reject_symlink(&selected)?;
    let canonical = fs::canonicalize(&selected).map_err(|error| {
        format!(
            "could not canonicalize Cavalry installation root {}: {error}",
            selected.display()
        )
    })?;
    if !canonical.is_dir() {
        return Err(format!(
            "Cavalry installation root is not a directory: {}",
            canonical.display()
        ));
    }
    Ok(strip_verbatim_prefix(lexically_normalize(&canonical)))
}

fn reject_symlink(path: &Path) -> Result<(), String> {
    let metadata = fs::symlink_metadata(path).map_err(|error| {
        format!(
            "could not inspect installation path {}: {error}",
            path.display()
        )
    })?;
    if metadata.file_type().is_symlink() {
        return Err(format!(
            "refusing symlink installation path {}; choose the real Cavalry installation",
            path.display()
        ));
    }
    Ok(())
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
    use super::{
        canonical_root_for_selection, validate_no_symlink_components, InstallLayout,
        InstallPlatform,
    };
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

    #[test]
    fn verified_mac_selection_returns_canonical_real_bundle_root() {
        let temp = tempfile::tempdir().unwrap();
        let root = temp.path().join("Cavalry.app");
        write(&root.join("Contents/MacOS/Cavalry"));
        write(&root.join("Contents/Info.plist"));
        write(&root.join("Contents/assets/Definitions/appStrings.json"));
        write(&root.join("Contents/assets/Definitions/nodeStrings.json"));

        let selected = root.join(".");
        let layout = InstallLayout::from_verified_selection(&selected).unwrap();
        assert_eq!(layout.root, canonical_root_for_selection(&root).unwrap());
        assert!(layout.validate_verified().is_ok());
    }

    #[cfg(unix)]
    #[test]
    fn verified_selection_rejects_a_symlinked_app_root() {
        use std::os::unix::fs::symlink;

        let temp = tempfile::tempdir().unwrap();
        let real_root = temp.path().join("Real Cavalry.app");
        write(&real_root.join("Contents/MacOS/Cavalry"));
        write(&real_root.join("Contents/Info.plist"));
        write(&real_root.join("Contents/assets/Definitions/appStrings.json"));
        write(&real_root.join("Contents/assets/Definitions/nodeStrings.json"));
        let link = temp.path().join("Cavalry.app");
        symlink(&real_root, &link).unwrap();

        let error = InstallLayout::from_verified_selection(&link).unwrap_err();
        assert!(error.contains("refusing symlink"), "{error}");
    }

    #[cfg(unix)]
    #[test]
    fn component_security_gate_rejects_intermediate_bundle_symlinks() {
        use std::os::unix::fs::symlink;

        for relative in [
            "Contents/MacOS/Cavalry",
            "Contents/Frameworks/libExtensionLayer.dylib",
            "Contents/assets/Definitions/appStrings.json",
            "Contents/assets/Plugins/Example/strings.json",
        ] {
            let temp = tempfile::tempdir().unwrap();
            let root = temp.path().join("Cavalry.app");
            let outside = temp.path().join("outside");
            fs::create_dir_all(&outside).unwrap();
            let components = std::path::Path::new(relative)
                .components()
                .collect::<Vec<_>>();
            let link_relative = components[..components.len() - 1].iter().fold(
                std::path::PathBuf::new(),
                |mut path, component| {
                    path.push(component.as_os_str());
                    path
                },
            );
            fs::create_dir_all(
                root.join(link_relative.parent().unwrap_or(std::path::Path::new(""))),
            )
            .unwrap();
            let link = root.join(&link_relative);
            symlink(&outside, &link).unwrap();

            let error =
                validate_no_symlink_components(&root, std::path::Path::new(relative)).unwrap_err();
            assert!(
                error.contains("symlink path component"),
                "{relative}: {error}"
            );
        }
    }

    #[test]
    fn directory_security_gate_rejects_existing_non_directory_final_component() {
        let temp = tempfile::tempdir().unwrap();
        let root = temp.path().join("Cavalry.app");
        fs::create_dir_all(root.join("Contents")).unwrap();
        fs::write(root.join("Contents/Frameworks"), b"not-a-directory").unwrap();

        let error = super::validate_no_symlink_directory_components(
            &root,
            std::path::Path::new("Contents/Frameworks"),
        )
        .unwrap_err();
        assert!(error.contains("non-directory"), "{error}");
    }
}
