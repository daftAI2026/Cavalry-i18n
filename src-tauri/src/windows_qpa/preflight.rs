/**
 * [INPUT]: 依赖 InstallLayout、Windows known-folder 提升判定、QPA 固定路径与 storage 重解析/普通文件守卫。
 * [OUTPUT]: 提供 QPA durable 路径、完整固定写入表面、Program Files 静态判定与无残留直接写 preflight。
 * [POS]: windows_qpa 的写前能力边界；只验证目标安装根和 recovery 权限，不激活、恢复或改变任何 Cavalry 资源。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
use std::{
    fs,
    io::{ErrorKind, Write},
    path::{Path, PathBuf},
};

use crate::install::InstallLayout;

use super::{
    require_windows_layout,
    storage::{
        ensure_path_chain_has_no_reparse_points, ensure_regular_directory, ensure_regular_file,
        MANIFEST_REPLACE_BACKUP_FILE, MANIFEST_TEMP_FILE, REPLACE_BACKUP_FILE,
        ROOT_REPLACEMENT_TEMP, VENDOR_TEMP_FILE,
    },
    MANIFEST_FILE_NAME, QWINDOWS_FILE_NAME, RECOVERY_DIRECTORY_NAME, VENDOR_QWINDOWS_FILE_NAME,
};

pub fn recovery_directory(layout: &InstallLayout) -> PathBuf {
    layout.root.join(RECOVERY_DIRECTORY_NAME)
}

pub fn vendor_qwindows_backup(layout: &InstallLayout) -> PathBuf {
    recovery_directory(layout).join(VENDOR_QWINDOWS_FILE_NAME)
}

pub fn manifest_path(layout: &InstallLayout) -> PathBuf {
    recovery_directory(layout).join(MANIFEST_FILE_NAME)
}

pub fn managed_write_surface(layout: &InstallLayout) -> Vec<PathBuf> {
    let recovery = recovery_directory(layout);
    let root_probe = layout.root.join(".cavalry-i18n-qpa-write-probe");
    let recovery_probe = recovery.join(".cavalry-i18n-qpa-write-probe");
    vec![
        layout.root.join(QWINDOWS_FILE_NAME),
        layout.root.join(ROOT_REPLACEMENT_TEMP),
        root_probe.join("probe"),
        root_probe,
        vendor_qwindows_backup(layout),
        manifest_path(layout),
        recovery.join(VENDOR_TEMP_FILE),
        recovery.join(REPLACE_BACKUP_FILE),
        recovery.join(MANIFEST_TEMP_FILE),
        recovery.join(MANIFEST_REPLACE_BACKUP_FILE),
        recovery_probe.join("probe"),
        recovery_probe,
        recovery,
    ]
}

pub fn direct_write_requires_elevated_worker(layout: &InstallLayout) -> bool {
    crate::privilege::windows_elevation_supported_for_install(&layout.root)
}

pub fn preflight_direct_writable(layout: &InstallLayout) -> Result<(), String> {
    require_windows_layout(layout)?;
    if direct_write_requires_elevated_worker(layout) {
        return Err(
            "Windows QPA changes under Program Files require the dedicated elevated QPA worker, which is not available in this build. No Cavalry files were changed."
                .to_string(),
        );
    }
    ensure_path_chain_has_no_reparse_points(&layout.root)?;
    probe_transaction_directory(&layout.root, "Cavalry install root")?;

    let qwindows = layout.root.join(QWINDOWS_FILE_NAME);
    if qwindows.is_file() {
        verify_existing_file_writable(&qwindows, "installed qwindows.dll")?;
    }

    let recovery = recovery_directory(layout);
    if recovery.exists() {
        ensure_regular_directory(&recovery, "QPA recovery directory")?;
        probe_transaction_directory(&recovery, "QPA recovery directory")?;
        for (path, role) in [
            (manifest_path(layout), "QPA manifest"),
            (
                vendor_qwindows_backup(layout),
                "durable vendor qwindows.dll backup",
            ),
        ] {
            if path.exists() {
                ensure_regular_file(&path, role)?;
                verify_existing_file_writable(&path, role)?;
            }
        }
    }
    Ok(())
}

fn probe_transaction_directory(directory: &Path, role: &str) -> Result<(), String> {
    let probe_directory = directory.join(".cavalry-i18n-qpa-write-probe");
    fs::create_dir(&probe_directory).map_err(|error| {
        format!(
            "{role} is not directly writable for the Windows QPA transaction: {} ({error}). No Cavalry files were changed.",
            directory.display()
        )
    })?;
    let probe_file = probe_directory.join("probe");
    let probe_result = (|| {
        let mut handle = fs::OpenOptions::new()
            .create_new(true)
            .write(true)
            .open(&probe_file)?;
        handle.write_all(b"qpa-direct-write-preflight\n")?;
        handle.sync_all()
    })();
    let file_cleanup = match fs::remove_file(&probe_file) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == ErrorKind::NotFound => Ok(()),
        Err(error) => Err(error),
    };
    let directory_cleanup = fs::remove_dir(&probe_directory);
    probe_result.map_err(|error| {
        format!(
            "Could not verify direct Windows QPA writes in {role} {}: {error}",
            directory.display()
        )
    })?;
    file_cleanup.map_err(|error| {
        format!(
            "Could not remove Windows QPA write probe {}: {error}",
            probe_file.display()
        )
    })?;
    directory_cleanup.map_err(|error| {
        format!(
            "Could not remove Windows QPA write probe directory {}: {error}",
            probe_directory.display()
        )
    })
}

fn verify_existing_file_writable(path: &Path, role: &str) -> Result<(), String> {
    fs::OpenOptions::new()
        .write(true)
        .open(path)
        .map(|_| ())
        .map_err(|error| {
            format!(
                "{role} is not directly writable for the Windows QPA transaction: {} ({error}). No language files were changed.",
                path.display()
            )
        })
}
