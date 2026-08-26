/**
 * [INPUT]: 依赖事务派生的 install root、nonce journal root、entry count、固定 preimage/staged replacement 名称，以及 Windows containment/reparse 检查。
 * [OUTPUT]: 有界枚举并 handle-bound 清理 state、preimage、displaced 与 staged 成员及隐藏 preparation root；readonly 仅在精确自有句柄上清除并持久化，未知成员、目录、重解析点或越界路径 fail-closed。
 * [POS]: language_transaction/storage 的最小 journal 清理边界；与 staged publication 共享固定成员协议，不参与 payload 写入或回滚决策。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
use std::{
    collections::HashSet,
    ffi::{OsStr, OsString},
    fs,
    path::{Path, PathBuf},
};

use super::destination_io::LockedDestination;
use super::{
    sync_directory, JOURNAL_PREFIX, JOURNAL_PREPARATION_PREFIX, JOURNAL_STATE_FILE,
    JOURNAL_STATE_TEMP_FILE,
};
use crate::privilege::windows::known_folders::{metadata_is_reparse_point, path_is_within};

const MAX_JOURNAL_ENTRIES: usize = 8192;

pub(crate) fn inspect_journal_root(
    install_root: &Path,
    journal_root: &Path,
    entry_count: usize,
) -> Result<Vec<PathBuf>, String> {
    validate_journal_root_shape(install_root, journal_root)?;
    if entry_count > MAX_JOURNAL_ENTRIES {
        return Err("Journal entry count exceeds the cleanup bound.".to_string());
    }

    let metadata = match fs::symlink_metadata(journal_root) {
        Ok(metadata) => metadata,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(Vec::new()),
        Err(error) => {
            return Err(format!(
                "Could not inspect journal directory before cleanup: {error}"
            ))
        }
    };
    if !metadata.is_dir() || metadata_is_reparse_point(&metadata) {
        return Err("Journal cleanup target is not an ordinary directory.".to_string());
    }

    let mut allowed = HashSet::<OsString>::with_capacity(entry_count + 2);
    allowed.insert(OsString::from(JOURNAL_STATE_FILE));
    allowed.insert(OsString::from(JOURNAL_STATE_TEMP_FILE));
    for index in 0..entry_count {
        allowed.insert(OsString::from(format!("{index}.preimage")));
        allowed.insert(OsString::from(format!(".payload-apply-{index}.tmp")));
        allowed.insert(OsString::from(format!(".payload-rollback-{index}.tmp")));
        allowed.insert(OsString::from(format!(".payload-displaced-{index}.tmp")));
    }

    let mut members = Vec::new();
    let entries = fs::read_dir(journal_root)
        .map_err(|error| format!("Could not enumerate journal before cleanup: {error}"))?;
    for entry in entries {
        let entry =
            entry.map_err(|error| format!("Could not enumerate journal member: {error}"))?;
        let name = entry.file_name();
        if !allowed.contains(&name) {
            return Err(format!(
                "Journal contains an unknown member; cleanup was refused: {}",
                entry.path().display()
            ));
        }
        let member = entry.path();
        let metadata = fs::symlink_metadata(&member)
            .map_err(|error| format!("Could not inspect journal member: {error}"))?;
        if !metadata.is_file() || metadata_is_reparse_point(&metadata) {
            return Err(format!(
                "Journal member is not an ordinary owned file: {}",
                member.display()
            ));
        }
        members.push(member);
    }
    members.sort();
    Ok(members)
}

pub(crate) fn remove_journal_root(
    install_root: &Path,
    journal_root: &Path,
    entry_count: usize,
) -> Result<(), String> {
    let members = inspect_journal_root(install_root, journal_root, entry_count)?;
    if !ordinary_journal_root_exists(install_root, journal_root)? {
        return Ok(());
    }
    for member in members {
        if !ordinary_journal_root_exists(install_root, journal_root)? {
            return Err("Journal disappeared while owned members were being removed.".to_string());
        }
        let Some(locked) = LockedDestination::open_existing_for_delete(&member)? else {
            continue;
        };
        let mut locked = locked;
        locked.clear_readonly_for_delete()?;
        locked.delete_on_close()?;
        sync_directory(journal_root)?;
    }
    if !ordinary_journal_root_exists(install_root, journal_root)? {
        return Err("Journal disappeared before its final directory removal.".to_string());
    }
    fs::remove_dir(journal_root)
        .map_err(|error| format!("Could not remove empty durable journal: {error}"))?;
    sync_directory(install_root)
}

pub(crate) fn remove_preparation_root(
    install_root: &Path,
    preparation_root: &Path,
    entry_count: usize,
) -> Result<(), String> {
    validate_preparation_root_shape(install_root, preparation_root)?;
    if entry_count > MAX_JOURNAL_ENTRIES {
        return Err("Preparation entry count exceeds the cleanup bound.".to_string());
    }
    let metadata = match fs::symlink_metadata(preparation_root) {
        Ok(metadata) => metadata,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(()),
        Err(error) => return Err(format!("Could not inspect preparation directory: {error}")),
    };
    if !metadata.is_dir() || metadata_is_reparse_point(&metadata) {
        return Err("Preparation cleanup target is not an ordinary directory.".to_string());
    }

    let mut allowed = HashSet::<OsString>::with_capacity(entry_count + 2);
    allowed.insert(OsString::from(JOURNAL_STATE_FILE));
    allowed.insert(OsString::from(JOURNAL_STATE_TEMP_FILE));
    for index in 0..entry_count {
        allowed.insert(OsString::from(format!("{index}.preimage")));
    }
    let mut members = Vec::new();
    for entry in fs::read_dir(preparation_root)
        .map_err(|error| format!("Could not enumerate preparation members: {error}"))?
    {
        let entry =
            entry.map_err(|error| format!("Could not enumerate preparation member: {error}"))?;
        let name = entry.file_name();
        if !allowed.contains(&name) {
            return Err(format!(
                "Preparation contains an unknown member; cleanup was refused: {}",
                entry.path().display()
            ));
        }
        let member = entry.path();
        let metadata = fs::symlink_metadata(&member)
            .map_err(|error| format!("Could not inspect preparation member: {error}"))?;
        if !metadata.is_file() || metadata_is_reparse_point(&metadata) {
            return Err(format!(
                "Preparation member is not an ordinary owned file: {}",
                member.display()
            ));
        }
        members.push(member);
    }
    members.sort();
    for member in members {
        let Some(mut locked) = LockedDestination::open_existing_for_delete(&member)? else {
            continue;
        };
        locked.clear_readonly_for_delete()?;
        locked.delete_on_close()?;
        sync_directory(preparation_root)?;
    }
    fs::remove_dir(preparation_root)
        .map_err(|error| format!("Could not remove incomplete preparation directory: {error}"))?;
    sync_directory(install_root)
}

fn ordinary_journal_root_exists(install_root: &Path, journal_root: &Path) -> Result<bool, String> {
    validate_journal_root_shape(install_root, journal_root)?;
    match fs::symlink_metadata(journal_root) {
        Ok(metadata) if metadata.is_dir() && !metadata_is_reparse_point(&metadata) => Ok(true),
        Ok(_) => Err("Journal cleanup target changed from an ordinary directory.".to_string()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(false),
        Err(error) => Err(format!("Could not re-inspect journal directory: {error}")),
    }
}

fn validate_journal_root_shape(install_root: &Path, journal_root: &Path) -> Result<(), String> {
    if !journal_root.is_absolute() || !path_is_within(journal_root, install_root) {
        return Err("Journal cleanup path escaped the install root.".to_string());
    }
    let parent = journal_root
        .parent()
        .ok_or_else(|| "Journal cleanup path has no parent.".to_string())?;
    if !paths_equal(parent, install_root) {
        return Err("Journal cleanup target must be a direct install-root child.".to_string());
    }
    let name = journal_root
        .file_name()
        .and_then(OsStr::to_str)
        .ok_or_else(|| "Journal cleanup target has an invalid name.".to_string())?;
    let nonce = name
        .strip_prefix(JOURNAL_PREFIX)
        .ok_or_else(|| "Journal cleanup target lacks the fixed prefix.".to_string())?;
    if nonce.len() != 64
        || !nonce
            .bytes()
            .all(|byte| byte.is_ascii_hexdigit() && !byte.is_ascii_uppercase())
    {
        return Err("Journal cleanup target has an invalid nonce.".to_string());
    }
    Ok(())
}

fn validate_preparation_root_shape(
    install_root: &Path,
    preparation_root: &Path,
) -> Result<(), String> {
    if !preparation_root.is_absolute() || !path_is_within(preparation_root, install_root) {
        return Err("Preparation path escaped the install root.".to_string());
    }
    let parent = preparation_root
        .parent()
        .ok_or_else(|| "Preparation path has no parent.".to_string())?;
    if !paths_equal(parent, install_root) {
        return Err("Preparation must be a direct install-root child.".to_string());
    }
    let name = preparation_root
        .file_name()
        .and_then(OsStr::to_str)
        .ok_or_else(|| "Preparation has an invalid name.".to_string())?;
    let nonce = name
        .strip_prefix(JOURNAL_PREPARATION_PREFIX)
        .ok_or_else(|| "Preparation lacks the fixed prefix.".to_string())?;
    if nonce.len() != 64
        || !nonce
            .bytes()
            .all(|byte| byte.is_ascii_hexdigit() && !byte.is_ascii_uppercase())
    {
        return Err("Preparation nonce is not 64 lowercase hexadecimal characters.".to_string());
    }
    Ok(())
}

fn paths_equal(left: &Path, right: &Path) -> bool {
    path_is_within(left, right) && path_is_within(right, left)
}
