/**
 * [INPUT]: 依赖 keychain_patch 的 owned bytes patch、CopyPair 与 privilege copy transaction。
 * [OUTPUT]: 提供 KeychainPatchReport re-export 及带权限回写的 Keychain query patch。
 * [POS]: 与平台无关的 Mach-O bytes patch 适配层；macOS apply 仅在非 English 时消费它。
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
        return Ok(report);
    }

    fs::create_dir_all(staging_dir).map_err(|error| error.to_string())?;
    let staged = staging_dir.join("libExtensionLayer.dylib");
    fs::write(&staged, patched).map_err(|error| error.to_string())?;
    let permissions = fs::metadata(&target)
        .map_err(|error| error.to_string())?
        .permissions();
    fs::set_permissions(&staged, permissions).map_err(|error| error.to_string())?;

    copy_with_privilege(
        &[CopyPair {
            src: staged,
            dst: target,
        }],
        runner,
    )?;
    Ok(report)
}

fn keychain_target_path(app_path: &Path) -> PathBuf {
    app_path
        .join("Contents")
        .join("Frameworks")
        .join("libExtensionLayer.dylib")
}
