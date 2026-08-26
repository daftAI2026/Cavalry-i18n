/**
 * [INPUT]: 依赖 durable journal 的原始文件 entry、事务新建目录集合与统一目录/reparse 准入。
 * [OUTPUT]: 在文件回滚前重建由原始 preimage 证明曾存在的父目录，并逐层同步父目录元数据。
 * [POS]: language_transaction/storage 的目录 preimage 恢复层；只恢复原本承载真实文件的目录，不认领事务新建目录。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
use std::{
    fs,
    path::{Path, PathBuf},
};

use super::{sync_directory, JournalEntry};
use crate::privilege::windows::known_folders::metadata_is_reparse_point;
use crate::privilege::windows::language_transaction::path_validation::{
    validate_directory_destination, windows_paths_equal,
};

pub(super) fn restore_original_parent_directories(
    install_root: &Path,
    entries: &[JournalEntry],
    transaction_created: &[PathBuf],
) -> Result<(), (PathBuf, String)> {
    let mut missing = Vec::<PathBuf>::new();
    for entry in entries
        .iter()
        .filter(|entry| entry.original_sha256.is_some())
    {
        let Some(mut cursor) = entry.destination.parent() else {
            return Err((
                entry.destination.clone(),
                "Original transaction file has no parent directory.".to_string(),
            ));
        };
        while !cursor.exists() {
            if transaction_created
                .iter()
                .any(|created| windows_paths_equal(created, cursor))
            {
                return Err((
                    cursor.to_path_buf(),
                    "Original file parent conflicts with a transaction-created directory."
                        .to_string(),
                ));
            }
            validate_directory_destination(install_root, cursor)
                .map_err(|error| (cursor.to_path_buf(), error.message))?;
            if !missing
                .iter()
                .any(|candidate| windows_paths_equal(candidate, cursor))
            {
                missing.push(cursor.to_path_buf());
            }
            cursor = cursor.parent().ok_or_else(|| {
                (
                    cursor.to_path_buf(),
                    "Original file parent has no existing ancestor.".to_string(),
                )
            })?;
        }
    }
    missing.sort_by_key(|path| path.components().count());
    for directory in missing {
        match fs::create_dir(&directory) {
            Ok(()) => {}
            Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => {
                let metadata = fs::symlink_metadata(&directory)
                    .map_err(|inspect| (directory.clone(), inspect.to_string()))?;
                if !metadata.is_dir() || metadata_is_reparse_point(&metadata) {
                    return Err((
                        directory,
                        "Concurrent parent creation was not an ordinary directory.".to_string(),
                    ));
                }
            }
            Err(error) => return Err((directory, error.to_string())),
        }
        if let Some(parent) = directory.parent() {
            sync_directory(parent).map_err(|error| (parent.to_path_buf(), error))?;
        }
    }
    Ok(())
}
