/**
 * [INPUT]: 依赖 Windows transaction root、source/destination 路径、摘要与 known-folder reparse 检查。
 * [OUTPUT]: 为 live storage 与持久化 recovery manifest 提供同一 fail-closed 校验，拒绝 root/self、dot traversal、重解析点及格式错误的 lowercase SHA-256。
 * [POS]: language_transaction 的无写入路径与摘要边界；只把外部路径、metadata 与摘要收敛为可安全消费的合同。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
use std::{
    fs,
    path::{Component, Path, PathBuf},
};

use super::super::known_folders::{
    ensure_no_reparse_points, metadata_is_reparse_point, path_is_within,
};
use super::storage::{StorageError, NONCE_HEX_LENGTH};

pub(super) fn validate_install_root(root: &Path) -> Result<PathBuf, StorageError> {
    if !root.is_absolute() {
        return Err(StorageError::new(
            "Transaction install root must be absolute.",
        ));
    }
    let metadata = fs::symlink_metadata(root).map_err(|error| {
        StorageError::new(format!(
            "Could not inspect transaction install root {}: {error}",
            root.display()
        ))
    })?;
    if !metadata.is_dir() || metadata_is_reparse_point(&metadata) {
        return Err(StorageError::new(
            "Transaction install root must be an ordinary directory.",
        ));
    }
    fs::canonicalize(root).map_err(|error| {
        StorageError::new(format!(
            "Could not canonicalize transaction install root {}: {error}",
            root.display()
        ))
    })?;
    // worker 已由 OS Known Folder 证明并规范化 root；这里保持同一词法形态，防止别名误判越界。
    Ok(root.to_path_buf())
}

pub(super) fn validate_source(source: &Path) -> Result<(), StorageError> {
    if !source.is_absolute() {
        return Err(StorageError::new("Payload source must be absolute."));
    }
    let metadata = fs::symlink_metadata(source).map_err(|error| {
        StorageError::new(format!(
            "Could not inspect payload source {}: {error}",
            source.display()
        ))
    })?;
    if !metadata.is_file() || metadata_is_reparse_point(&metadata) {
        return Err(StorageError::new(
            "Payload source must be an ordinary file.",
        ));
    }
    Ok(())
}

pub(super) fn validate_destination(root: &Path, destination: &Path) -> Result<(), StorageError> {
    if !destination.is_absolute()
        || !path_is_within(destination, root)
        || windows_paths_equal(destination, root)
        || destination
            .components()
            .any(|component| matches!(component, Component::CurDir | Component::ParentDir))
    {
        return Err(StorageError::new(format!(
            "Transaction destination escaped the install root: {}",
            destination.display()
        )));
    }
    ensure_no_reparse_points(root, destination).map_err(StorageError::new)
}

pub(super) fn validate_directory_destination(
    root: &Path,
    directory: &Path,
) -> Result<(), StorageError> {
    if !directory.is_absolute()
        || !path_is_within(directory, root)
        || windows_paths_equal(directory, root)
        || directory
            .components()
            .any(|component| matches!(component, Component::CurDir | Component::ParentDir))
    {
        return Err(StorageError::new(format!(
            "Transaction directory escaped the install root: {}",
            directory.display()
        )));
    }
    ensure_no_reparse_points(root, directory).map_err(StorageError::new)?;
    match fs::symlink_metadata(directory) {
        Ok(metadata) if metadata.is_dir() && !metadata_is_reparse_point(&metadata) => Ok(()),
        Ok(_) => Err(StorageError::new(format!(
            "Transaction directory is not an ordinary directory: {}",
            directory.display()
        ))),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(StorageError::new(format!(
            "Could not inspect transaction directory {}: {error}",
            directory.display()
        ))),
    }
}

pub(super) fn validate_optional_hash(value: Option<&str>, role: &str) -> Result<(), StorageError> {
    value.map_or(Ok(()), |value| validate_lower_hash(value, role))
}

pub(super) fn validate_lower_hash(value: &str, role: &str) -> Result<(), StorageError> {
    if value.len() != NONCE_HEX_LENGTH
        || !value
            .bytes()
            .all(|byte| byte.is_ascii_hexdigit() && !byte.is_ascii_uppercase())
    {
        return Err(StorageError::new(format!(
            "{role} must be exactly 64 lowercase hexadecimal characters."
        )));
    }
    Ok(())
}

pub(super) fn windows_paths_equal(left: &Path, right: &Path) -> bool {
    path_is_within(left, right) && path_is_within(right, left)
}
