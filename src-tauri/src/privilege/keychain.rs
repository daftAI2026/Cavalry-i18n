/**
 * [INPUT]: 依赖 keychain_patch 的 owned bytes patch、CopyPair 与 privilege copy transaction。
 * [OUTPUT]: 提供 KeychainPatchReport re-export、只生成 staged CopyPair 的事务接口及兼容回写入口。
 * [POS]: 与平台无关的 Mach-O bytes patch 适配层；macOS apply 把 staged pair 纳入唯一 bundle 事务。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
use std::{
    fs,
    path::{Path, PathBuf},
};

use crate::{keychain_patch, patch::CopyPair};

use super::{copy_transaction::copy_with_privilege, CommandRunner};

pub use keychain_patch::KeychainPatchReport;

pub fn patch_keychain_query_attributes(app_path: &Path) -> Result<KeychainPatchReport, String> {
    keychain_patch::patch_keychain_query_attributes(app_path)
}

pub fn patch_keychain_query_attributes_with_privilege<R: CommandRunner>(
    app_path: &Path,
    staging_dir: &Path,
    runner: &mut R,
) -> Result<KeychainPatchReport, String> {
    let (pair, report) = stage_keychain_query_attributes_patch(app_path, staging_dir)?;
    if let Some(pair) = pair {
        copy_with_privilege(&[pair], runner)?;
    }
    Ok(report)
}

pub(crate) fn stage_keychain_query_attributes_patch(
    app_path: &Path,
    staging_dir: &Path,
) -> Result<(Option<CopyPair>, KeychainPatchReport), String> {
    let target = keychain_target_path(app_path);
    if !target.exists() {
        return Err(format!(
            "libExtensionLayer.dylib not found at {}",
            target.display()
        ));
    }

    let bytes = fs::read(&target).map_err(|error| error.to_string())?;
    let (patched, report) = keychain_patch::patch_keychain_query_attributes_owned(bytes)?;
    if report.patched_callsites == 0 {
        return Ok((None, report));
    }

    fs::create_dir_all(staging_dir).map_err(|error| error.to_string())?;
    let staged = staging_dir.join("libExtensionLayer.dylib");
    fs::write(&staged, patched).map_err(|error| error.to_string())?;
    let permissions = fs::metadata(&target)
        .map_err(|error| error.to_string())?
        .permissions();
    fs::set_permissions(&staged, permissions).map_err(|error| error.to_string())?;

    Ok((
        Some(CopyPair {
            src: staged,
            dst: target,
        }),
        report,
    ))
}

fn keychain_target_path(app_path: &Path) -> PathBuf {
    app_path
        .join("Contents")
        .join("Frameworks")
        .join("libExtensionLayer.dylib")
}
