/**
 * [INPUT]: 依赖显式 smoke 环境变量、系统 `%TEMP%` 与 AppData、disposable/Qt-profile sentinel、InstallLayout、CopyPair 与 Windows QPA 固定写入表面
 * [OUTPUT]: 提供 GuardedTempRoot、disposable_install_layout、Qt test profile 的排他准备/清理、兼容 verbatim/8.3 拼写的规范路径身份校验、逐级 reparse 拒绝、QPA 目标守卫及安全 evidence 子目录创建
 * [POS]: Windows ignored integration smoke 的共享路径信任边界；只操作有固定 magic sentinel 的临时克隆、证据根和 qttest/Cavalry 档案，不启动进程或执行产品操作
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
use cavalry_i18n_tauri::{
    install::{normalize_path, InstallLayout},
    patch::CopyPair,
    windows_qpa,
};
use std::{
    env, fs,
    io::{ErrorKind, Write},
    os::windows::fs::MetadataExt,
    path::{Path, PathBuf},
    process,
    time::{SystemTime, UNIX_EPOCH},
};

pub const DISPOSABLE_SENTINEL: &str = ".cavalry-i18n-disposable-smoke";
pub const QT_TEST_PROFILE_SENTINEL: &str = ".cavalry-i18n-acceptance-profile";
const QT_TEST_PROFILE_SENTINEL_MAGIC: &str = "cavalry-i18n.windows-qt-test-profile/v1";
const PLUGIN_FILE_NAME: &str = "cavalryi18n.dll";
const FILE_ATTRIBUTE_REPARSE_POINT: u32 = 0x0400;

#[derive(Debug, Clone)]
pub struct GuardedTempRoot {
    root: PathBuf,
}

impl GuardedTempRoot {
    pub fn from_env(variable: &str) -> Result<Self, String> {
        let selected = env::var_os(variable)
            .map(PathBuf::from)
            .ok_or_else(|| {
                format!(
                    "{variable} must point to an existing disposable directory below %TEMP% with {DISPOSABLE_SENTINEL}"
                )
            })?;
        if !selected.is_absolute() || !selected.is_dir() {
            return Err(format!(
                "{variable} must be an existing absolute directory, got {}",
                selected.display()
            ));
        }

        let raw_temp_root = env::temp_dir();
        assert_absolute_existing_chain_has_no_reparse(&selected)?;
        let temp_root = normalize_path(&raw_temp_root);
        let root = normalize_path(&selected);
        if !path_is_strictly_within(&root, &temp_root) {
            return Err(format!(
                "refusing canonical disposable path {} outside temp root {}",
                root.display(),
                temp_root.display()
            ));
        }
        assert_existing_chain_has_no_reparse(&temp_root, &root)?;

        let guarded = Self { root };
        let sentinel = guarded.root.join(DISPOSABLE_SENTINEL);
        if !sentinel.is_file() {
            return Err(format!(
                "refusing {} without {}",
                guarded.root.display(),
                DISPOSABLE_SENTINEL
            ));
        }
        guarded.assert_write_target(&sentinel)?;
        Ok(guarded)
    }

    pub fn root(&self) -> &Path {
        &self.root
    }

    pub fn assert_write_target(&self, target: &Path) -> Result<(), String> {
        let (normalized_root, normalized_target, relative) =
            normalized_descendant(&self.root, target)?;
        assert_existing_chain_has_no_reparse(&normalized_root, &normalized_target)?;

        let mut cursor = normalized_root.clone();
        for component in relative.components() {
            cursor.push(component.as_os_str());
            if !cursor.exists() {
                break;
            }
            let resolved = normalize_path(&cursor);
            if !path_is_same(&resolved, &normalized_root)
                && !path_is_strictly_within(&resolved, &normalized_root)
            {
                return Err(format!(
                    "{} resolves outside disposable root {}",
                    cursor.display(),
                    normalized_root.display()
                ));
            }
        }
        Ok(())
    }

    #[allow(dead_code)] // 两个独立 integration test 只在 live 变体中需要唯一证据子目录。
    pub fn create_unique_child_directory(&self, prefix: &str) -> Result<PathBuf, String> {
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map_err(|error| format!("system clock is before UNIX_EPOCH: {error}"))?
            .as_nanos();
        for attempt in 0..32_u8 {
            let candidate = self
                .root
                .join(format!("{prefix}-{}-{timestamp}-{attempt}", process::id()));
            self.assert_write_target(&candidate)?;
            match fs::create_dir(&candidate) {
                Ok(()) => {
                    self.assert_write_target(&candidate)?;
                    return Ok(candidate);
                }
                Err(error) if error.kind() == ErrorKind::AlreadyExists => {}
                Err(error) => {
                    return Err(format!(
                        "could not create evidence directory {}: {error}",
                        candidate.display()
                    ))
                }
            }
        }
        Err(format!(
            "could not allocate a unique evidence directory below {}",
            self.root.display()
        ))
    }
}

pub fn disposable_install_layout(
    variable: &str,
) -> Result<(InstallLayout, GuardedTempRoot), String> {
    let guarded = GuardedTempRoot::from_env(variable)?;
    let layout = InstallLayout::from_selection(guarded.root())?;
    layout.validate()?;
    if !path_is_same(&layout.root, guarded.root()) {
        return Err(format!(
            "validated clone root changed after canonicalization: {} -> {}",
            guarded.root().display(),
            layout.root.display()
        ));
    }
    Ok((layout, guarded))
}

pub fn assert_safe_write_surface(
    guarded: &GuardedTempRoot,
    layout: &InstallLayout,
    pairs: &[CopyPair],
) -> Result<(), String> {
    if !path_is_same(guarded.root(), &layout.root) {
        return Err(format!(
            "install layout {} differs from guarded disposable root {}",
            layout.root.display(),
            guarded.root().display()
        ));
    }
    let installed_plugin = layout.root.join("generic").join(PLUGIN_FILE_NAME);
    let qpa_targets = windows_qpa::managed_write_surface(layout);
    for target in pairs
        .iter()
        .map(|pair| pair.dst.as_path())
        .chain([installed_plugin.as_path(), layout.language_marker.as_path()])
        .chain(qpa_targets.iter().map(PathBuf::as_path))
    {
        guarded.assert_write_target(target)?;
    }
    Ok(())
}

pub fn path_is_same(path: &Path, other: &Path) -> bool {
    comparable_path(path) == comparable_path(other)
}

pub fn path_is_strictly_within(path: &Path, root: &Path) -> bool {
    let path = comparable_path(path);
    let root = comparable_path(root);
    path != root
        && path
            .strip_prefix(&root)
            .is_some_and(|remainder| remainder.starts_with('\\'))
}

fn qt_test_profile_directories() -> Result<[PathBuf; 2], String> {
    let local = env::var_os("LOCALAPPDATA")
        .map(PathBuf::from)
        .ok_or_else(|| "LOCALAPPDATA is unavailable for the Qt test profile".to_string())?;
    let roaming = env::var_os("APPDATA")
        .map(PathBuf::from)
        .ok_or_else(|| "APPDATA is unavailable for the Qt test profile".to_string())?;
    for root in [&local, &roaming] {
        if !root.is_absolute() || !root.is_dir() {
            return Err(format!(
                "Qt test profile root must be an existing absolute directory: {}",
                root.display()
            ));
        }
        assert_absolute_existing_chain_has_no_reparse(root)?;
    }
    Ok([
        local.join("qttest").join("Cavalry"),
        roaming.join("qttest").join("Cavalry"),
    ])
}

fn assert_tree_has_no_reparse(root: &Path) -> Result<(), String> {
    let mut pending = vec![root.to_path_buf()];
    while let Some(path) = pending.pop() {
        reject_reparse(&path)?;
        if path.is_dir() {
            for entry in fs::read_dir(&path)
                .map_err(|error| format!("could not enumerate {}: {error}", path.display()))?
            {
                pending.push(
                    entry
                        .map_err(|error| {
                            format!("could not inspect child of {}: {error}", path.display())
                        })?
                        .path(),
                );
            }
        }
    }
    Ok(())
}

pub fn cleanup_qt_test_profile() -> Result<(), String> {
    for directory in qt_test_profile_directories()? {
        if !directory.exists() {
            continue;
        }
        assert_absolute_existing_chain_has_no_reparse(&directory)?;
        let sentinel = directory.join(QT_TEST_PROFILE_SENTINEL);
        let metadata = fs::symlink_metadata(&sentinel).map_err(|error| {
            format!(
                "refusing existing Qt test profile without owned sentinel {}: {error}",
                sentinel.display()
            )
        })?;
        if !metadata.file_type().is_file()
            || metadata.file_attributes() & FILE_ATTRIBUTE_REPARSE_POINT != 0
        {
            return Err(format!(
                "refusing non-file Qt test profile sentinel {}",
                sentinel.display()
            ));
        }
        let identity = fs::read_to_string(&sentinel).map_err(|error| {
            format!(
                "could not read Qt test profile sentinel {}: {error}",
                sentinel.display()
            )
        })?;
        if identity.lines().next() != Some(QT_TEST_PROFILE_SENTINEL_MAGIC) {
            return Err(format!(
                "refusing foreign Qt test profile {}",
                directory.display()
            ));
        }
        assert_tree_has_no_reparse(&directory)?;
        fs::remove_dir_all(&directory).map_err(|error| {
            format!(
                "could not remove owned Qt test profile {}: {error}",
                directory.display()
            )
        })?;
    }
    Ok(())
}

pub fn prepare_qt_test_profile(identity: &str) -> Result<(), String> {
    cleanup_qt_test_profile()?;
    let directories = qt_test_profile_directories()?;
    for directory in &directories {
        fs::create_dir_all(directory).map_err(|error| {
            format!(
                "could not create Qt test profile {}: {error}",
                directory.display()
            )
        })?;
        assert_absolute_existing_chain_has_no_reparse(directory)?;
        let sentinel = directory.join(QT_TEST_PROFILE_SENTINEL);
        let mut file = fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&sentinel)
            .map_err(|error| {
                format!(
                    "could not create Qt test profile sentinel {}: {error}",
                    sentinel.display()
                )
            })?;
        writeln!(file, "{QT_TEST_PROFILE_SENTINEL_MAGIC}\n{identity}").map_err(|error| {
            format!(
                "could not write Qt test profile sentinel {}: {error}",
                sentinel.display()
            )
        })?;
        file.sync_all().map_err(|error| {
            format!(
                "could not flush Qt test profile sentinel {}: {error}",
                sentinel.display()
            )
        })?;
    }
    Ok(())
}

fn comparable_path(value: &Path) -> String {
    value
        .to_string_lossy()
        .trim_start_matches(r"\\?\")
        .replace('/', "\\")
        .trim_end_matches('\\')
        .to_ascii_lowercase()
}

fn reject_reparse(path: &Path) -> Result<(), String> {
    let metadata = fs::symlink_metadata(path)
        .map_err(|error| format!("could not inspect {}: {error}", path.display()))?;
    if metadata.file_attributes() & FILE_ATTRIBUTE_REPARSE_POINT != 0 {
        return Err(format!("{} is a reparse point", path.display()));
    }
    Ok(())
}

fn assert_absolute_existing_chain_has_no_reparse(target: &Path) -> Result<(), String> {
    if !target.is_absolute() {
        return Err(format!(
            "{} must be absolute before checking its reparse chain",
            target.display()
        ));
    }
    let mut cursor = PathBuf::new();
    for component in target.components() {
        cursor.push(component.as_os_str());
        match fs::symlink_metadata(&cursor) {
            Ok(_) => reject_reparse(&cursor)?,
            Err(error) if error.kind() == ErrorKind::NotFound => break,
            Err(error) => return Err(format!("could not inspect {}: {error}", cursor.display())),
        }
    }
    Ok(())
}

fn assert_existing_chain_has_no_reparse(root: &Path, target: &Path) -> Result<(), String> {
    let (normalized_root, _, relative) = normalized_descendant(root, target)?;
    reject_reparse(&normalized_root)?;
    let mut cursor = normalized_root;
    for component in relative.components() {
        cursor.push(component.as_os_str());
        match fs::symlink_metadata(&cursor) {
            Ok(_) => reject_reparse(&cursor)?,
            Err(error) if error.kind() == ErrorKind::NotFound => break,
            Err(error) => return Err(format!("could not inspect {}: {error}", cursor.display())),
        }
    }
    Ok(())
}

fn normalized_descendant(
    root: &Path,
    target: &Path,
) -> Result<(PathBuf, PathBuf, PathBuf), String> {
    let normalized_root = normalize_path(root);
    let normalized_target = normalize_path(target);
    if !path_is_strictly_within(&normalized_target, &normalized_root) {
        return Err(format!(
            "{} is not strictly below guarded root {}",
            target.display(),
            root.display()
        ));
    }

    // Windows can return the same path as C:\..., \\?\C:\..., or an 8.3 alias.
    // Identity was established above after normalization; derive the suffix by
    // component depth so a harmless spelling difference cannot bypass or block it.
    let root_depth = normalized_root.components().count();
    let relative = normalized_target
        .components()
        .skip(root_depth)
        .collect::<PathBuf>();
    if relative.as_os_str().is_empty() {
        return Err(format!(
            "{} did not produce a descendant suffix below {}",
            normalized_target.display(),
            normalized_root.display()
        ));
    }
    Ok((normalized_root, normalized_target, relative))
}

#[cfg(test)]
mod tests {
    use super::normalized_descendant;
    use std::path::Path;

    #[test]
    fn verbatim_and_drive_path_spellings_share_one_descendant_identity() {
        let (_, normalized_target, relative) = normalized_descendant(
            Path::new(r"C:\Temp\cavalry-smoke"),
            Path::new(r"\\?\C:\Temp\cavalry-smoke\state\runtime\marker.json"),
        )
        .expect("verbatim target should stay inside the same guarded root");

        assert_eq!(
            normalized_target,
            Path::new(r"C:\Temp\cavalry-smoke\state\runtime\marker.json")
        );
        assert_eq!(relative, Path::new(r"state\runtime\marker.json"));
    }

    #[test]
    fn normalized_parent_escape_is_not_a_descendant() {
        let result = normalized_descendant(
            Path::new(r"C:\Temp\cavalry-smoke"),
            Path::new(r"C:\Temp\cavalry-smoke\..\outside.txt"),
        );

        assert!(result.is_err());
    }
}
