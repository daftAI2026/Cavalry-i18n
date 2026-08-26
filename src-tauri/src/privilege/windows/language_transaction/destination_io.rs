/*
 * [INPUT]: 依赖 Windows FileShare.None、FILE_FLAG_OPEN_REPARSE_POINT、SetFileInformationByHandle 与普通文件句柄；接收已由事务层完成路径授权的目标文件。
 * [OUTPUT]: 提供普通源文件的 no-share/reparse-safe 打开，以及目标文件单句柄 CAS、覆盖、权限恢复后 fsync、复核与 delete-on-close；文件从校验到消费期间不会重新按路径打开。
 * [POS]: language_transaction/storage 的 handle-bound I/O 原语；正向写入与回滚共用，消除校验后重开路径或跟随重解析点造成的竞态窗口。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
/**
 * [INPUT]: 已验证的普通源文件、目标 CAS 句柄、事务 journal 固定临时路径，以及 Windows 原子发布 API。
 * [OUTPUT]: 提供 no-share/reparse-safe 打开、完整写入并 fsync 的 staged overwrite、ReplaceFileW/MoveFileExW 发布、postcondition 复核和 handle-bound 删除。
 * [POS]: language_transaction/storage 的文件 I/O 边界；目标句柄保护 CAS，临时文件在发布前完成哈希与目录持久化，发布后立即重新取得独占句柄。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
use std::{
    fs,
    io::{Read, Seek, SeekFrom},
    os::windows::{fs::OpenOptionsExt, io::AsRawHandle},
    path::{Path, PathBuf},
};

use sha2::{Digest, Sha256};
use windows::core::HSTRING;
use windows::Win32::{
    Foundation::{GENERIC_READ, HANDLE},
    Storage::FileSystem::{
        FileDispositionInfo, MoveFileExW, ReplaceFileW, SetFileInformationByHandle, DELETE,
        FILE_DISPOSITION_INFO, FILE_FLAG_OPEN_REPARSE_POINT, MOVEFILE_WRITE_THROUGH,
        REPLACE_FILE_FLAGS,
    },
};

use super::super::super::known_folders::{metadata_is_reparse_point, path_is_within};
use super::super::journal_manifest::sync_directory;

pub(super) fn open_exclusive_ordinary_file(path: &Path, role: &str) -> Result<fs::File, String> {
    let file = fs::OpenOptions::new()
        .read(true)
        .share_mode(0)
        .custom_flags(FILE_FLAG_OPEN_REPARSE_POINT.0)
        .open(path)
        .map_err(|error| {
            format!(
                "Could not exclusively open {role} {}: {error}",
                path.display()
            )
        })?;
    let metadata = file.metadata().map_err(|error| {
        format!(
            "Could not inspect opened {role} {}: {error}",
            path.display()
        )
    })?;
    if !metadata.is_file() || metadata_is_reparse_point(&metadata) {
        return Err(format!(
            "Refusing non-file or reparse {role}: {}",
            path.display()
        ));
    }
    Ok(file)
}

#[derive(Debug)]
pub(super) struct MutationResult {
    pub(super) observed_sha256: Option<String>,
    pub(super) error: Option<String>,
}

pub(super) struct LockedDestination {
    file: Option<fs::File>,
    path: PathBuf,
    preimage_sha256: Option<String>,
}

impl LockedDestination {
    pub(super) fn open_for_write(path: &Path, expected_exists: bool) -> Result<Self, String> {
        if expected_exists {
            let mut file = open_locked_existing(path, "transaction destination")?;
            let preimage_sha256 = Some(hash_open_file(&mut file, path)?);
            Ok(Self {
                file: Some(file),
                path: path.to_path_buf(),
                preimage_sha256,
            })
        } else {
            Ok(Self {
                file: None,
                path: path.to_path_buf(),
                preimage_sha256: None,
            })
        }
    }

    pub(super) fn open_existing_for_delete(path: &Path) -> Result<Option<Self>, String> {
        match fs::symlink_metadata(path) {
            Ok(metadata) => {
                if !metadata.is_file() || metadata_is_reparse_point(&metadata) {
                    return Err(format!(
                        "Refusing non-file or reparse rollback target: {}",
                        path.display()
                    ));
                }
            }
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(None),
            Err(error) => {
                return Err(format!(
                    "Could not inspect rollback target {}: {error}",
                    path.display()
                ))
            }
        }

        let mut file = fs::OpenOptions::new()
            .access_mode(GENERIC_READ.0 | DELETE.0)
            .share_mode(0)
            .custom_flags(FILE_FLAG_OPEN_REPARSE_POINT.0)
            .open(path)
            .map_err(|error| {
                format!(
                    "Could not exclusively open rollback target {}: {error}",
                    path.display()
                )
            })?;
        let metadata = file.metadata().map_err(|error| {
            format!(
                "Could not inspect opened rollback target {}: {error}",
                path.display()
            )
        })?;
        if !metadata.is_file() || metadata_is_reparse_point(&metadata) {
            return Err(format!(
                "Refusing non-file or reparse rollback target: {}",
                path.display()
            ));
        }
        let preimage_sha256 = Some(hash_open_file(&mut file, path)?);
        Ok(Some(Self {
            file: Some(file),
            path: path.to_path_buf(),
            preimage_sha256,
        }))
    }

    pub(super) fn preimage_sha256(&self) -> Option<&str> {
        self.preimage_sha256.as_deref()
    }

    pub(super) fn overwrite_from(
        &mut self,
        source: &mut fs::File,
        permissions: &fs::Permissions,
        replacement: &Path,
        expected_after: &str,
    ) -> MutationResult {
        self.overwrite_from_inner(
            source,
            permissions,
            replacement,
            Some(expected_after),
            |source, destination| {
                std::io::copy(source, destination)
                    .map(|_| ())
                    .map_err(|error| error.to_string())
            },
        )
    }

    #[cfg(test)]
    pub(super) fn overwrite_from_with_copy<F>(
        &mut self,
        source: &mut fs::File,
        permissions: &fs::Permissions,
        replacement: &Path,
        copy: F,
    ) -> MutationResult
    where
        F: FnOnce(&mut fs::File, &mut fs::File) -> Result<(), String>,
    {
        self.overwrite_from_inner(source, permissions, replacement, None, copy)
    }

    fn overwrite_from_inner<F>(
        &mut self,
        source: &mut fs::File,
        permissions: &fs::Permissions,
        replacement: &Path,
        expected_after: Option<&str>,
        copy: F,
    ) -> MutationResult
    where
        F: FnOnce(&mut fs::File, &mut fs::File) -> Result<(), String>,
    {
        let mutation = (|| -> Result<(), String> {
            let parent = self
                .path
                .parent()
                .ok_or_else(|| "Transaction destination has no parent.".to_string())?;
            if replacement == self.path || !authorized_replacement_path(&self.path, replacement) {
                return Err(format!(
                    "Refusing transaction replacement outside the destination directory: {}",
                    replacement.display()
                ));
            }
            if let Some(file) = self.file.as_mut() {
                let observed = hash_open_file(file, &self.path)?;
                if Some(observed.as_str()) != self.preimage_sha256.as_deref() {
                    return Err(format!(
                        "Transaction destination changed before atomic publication: {}",
                        self.path.display()
                    ));
                }
            } else if let Ok(metadata) = fs::symlink_metadata(&self.path) {
                return Err(format!(
                    "Missing transaction destination reappeared before atomic publication: {} ({metadata:?})",
                    self.path.display()
                ));
            }

            source.seek(SeekFrom::Start(0)).map_err(|error| {
                format!(
                    "Could not rewind source before staging {}: {error}",
                    self.path.display()
                )
            })?;
            let mut staged = fs::OpenOptions::new()
                .read(true)
                .write(true)
                .create_new(true)
                .share_mode(0)
                .custom_flags(FILE_FLAG_OPEN_REPARSE_POINT.0)
                .open(replacement)
                .map_err(|error| {
                    format!(
                        "Could not create transaction replacement {}: {error}",
                        replacement.display()
                    )
                })?;
            let staged_result = (|| -> Result<(), String> {
                let metadata = staged.metadata().map_err(|error| {
                    format!("Could not inspect transaction replacement: {error}")
                })?;
                if !metadata.is_file() || metadata_is_reparse_point(&metadata) {
                    return Err(format!(
                        "Refusing non-file or reparse transaction replacement: {}",
                        replacement.display()
                    ));
                }
                copy(source, &mut staged).map_err(|error| {
                    format!(
                        "Could not stage source for {}: {error}",
                        self.path.display()
                    )
                })?;
                staged
                    .set_permissions(permissions.clone())
                    .map_err(|error| {
                        format!("Could not preserve permissions on staged replacement: {error}")
                    })?;
                staged
                    .sync_all()
                    .map_err(|error| format!("Could not persist staged replacement: {error}"))?;
                if let Some(expected) = expected_after {
                    let actual = hash_open_file(&mut staged, replacement)?;
                    if actual != expected {
                        return Err(format!(
                            "Staged replacement hash did not match expected postimage: {}",
                            replacement.display()
                        ));
                    }
                }
                Ok(())
            })();
            drop(staged);
            if let Err(error) = staged_result {
                return Err(with_temp_cleanup(error, replacement));
            }
            if let Err(error) = sync_directory(replacement.parent().unwrap_or(parent)) {
                return Err(with_temp_cleanup(error, replacement));
            }
            sync_directory(parent)?;

            let had_target = self.file.is_some();
            drop(self.file.take());
            let target_arg = HSTRING::from(self.path.to_string_lossy().to_string());
            let replacement_arg = HSTRING::from(replacement.to_string_lossy().to_string());
            let publish_result = if had_target {
                unsafe {
                    ReplaceFileW(
                        &target_arg,
                        &replacement_arg,
                        None,
                        REPLACE_FILE_FLAGS(0),
                        None,
                        None,
                    )
                }
                .map_err(|error| {
                    format!("Could not atomically replace transaction destination: {error}")
                })
            } else {
                unsafe { MoveFileExW(&replacement_arg, &target_arg, MOVEFILE_WRITE_THROUGH) }
                    .map_err(|error| {
                        format!("Could not atomically publish transaction destination: {error}")
                    })
            };
            if let Err(error) = publish_result {
                return Err(with_temp_cleanup(error, replacement));
            }
            sync_directory(parent)?;
            if let Some(replacement_parent) = replacement.parent() {
                sync_directory(replacement_parent)?;
            }

            let mut reopened =
                open_locked_existing(&self.path, "published transaction destination")?;
            let observed = hash_open_file(&mut reopened, &self.path)?;
            if let Some(expected) = expected_after {
                if observed != expected {
                    return Err(format!(
                        "Atomic transaction publication produced an unexpected hash: {}",
                        self.path.display()
                    ));
                }
            }
            reopened
                .set_permissions(permissions.clone())
                .map_err(|error| {
                    format!(
                        "Could not preserve permissions on {}: {error}",
                        self.path.display()
                    )
                })?;
            reopened.sync_all().map_err(|error| {
                format!(
                    "Could not persist permissions on {}: {error}",
                    self.path.display()
                )
            })?;
            sync_directory(parent)?;
            self.preimage_sha256 = Some(observed);
            self.file = Some(reopened);
            Ok(())
        })();
        let observed = self
            .file
            .as_mut()
            .and_then(|file| hash_open_file(file, &self.path).ok());
        match (mutation, observed) {
            (Ok(()), Some(hash)) => MutationResult {
                observed_sha256: Some(hash),
                error: None,
            },
            (Err(error), Some(hash)) => MutationResult {
                observed_sha256: Some(hash),
                error: Some(error),
            },
            (Ok(()), None) => MutationResult {
                observed_sha256: None,
                error: Some(
                    "Destination write completed but its same-handle postcondition failed."
                        .to_string(),
                ),
            },
            (Err(mutation_error), None) => MutationResult {
                observed_sha256: None,
                error: Some(format!(
                    "{mutation_error}; same-handle postcondition also failed."
                )),
            },
        }
    }

    pub(super) fn delete_on_close(self) -> Result<(), String> {
        let file = self
            .file
            .ok_or_else(|| "Cannot delete a destination that was never published.".to_string())?;
        let disposition = FILE_DISPOSITION_INFO { DeleteFile: true };
        unsafe {
            SetFileInformationByHandle(
                HANDLE(file.as_raw_handle()),
                FileDispositionInfo,
                std::ptr::from_ref(&disposition).cast(),
                std::mem::size_of::<FILE_DISPOSITION_INFO>() as u32,
            )
        }
        .map_err(|error| {
            format!(
                "Could not mark rollback target {} for handle-bound deletion: {error}",
                self.path.display()
            )
        })?;
        let path = self.path.clone();
        drop(file);
        match fs::symlink_metadata(&path) {
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
            Ok(_) => Err(format!(
                "Handle-bound rollback deletion did not remove {}.",
                path.display()
            )),
            Err(error) => Err(format!(
                "Could not verify handle-bound rollback deletion {}: {error}",
                path.display()
            )),
        }
    }
}

fn open_locked_existing(path: &Path, role: &str) -> Result<fs::File, String> {
    ensure_ordinary_existing_file(path)?;
    let file = fs::OpenOptions::new()
        .read(true)
        .write(true)
        .share_mode(0)
        .custom_flags(FILE_FLAG_OPEN_REPARSE_POINT.0)
        .open(path)
        .map_err(|error| {
            format!(
                "Could not exclusively open {role} {}: {error}",
                path.display()
            )
        })?;
    let metadata = file.metadata().map_err(|error| {
        format!(
            "Could not inspect opened {role} {}: {error}",
            path.display()
        )
    })?;
    if !metadata.is_file() || metadata_is_reparse_point(&metadata) {
        return Err(format!(
            "Refusing non-file or reparse {role}: {}",
            path.display()
        ));
    }
    Ok(file)
}

fn with_temp_cleanup(error: String, replacement: &Path) -> String {
    match fs::symlink_metadata(replacement) {
        Err(io_error) if io_error.kind() == std::io::ErrorKind::NotFound => error,
        Err(io_error) => format!("{error}; could not inspect owned replacement: {io_error}"),
        Ok(metadata) if !metadata.is_file() || metadata_is_reparse_point(&metadata) => {
            format!("{error}; refusing to remove non-file or reparse replacement")
        }
        Ok(_) => match fs::remove_file(replacement) {
            Ok(()) => match replacement.parent().map(sync_directory) {
                Some(Ok(())) => error,
                Some(Err(sync_error)) => {
                    format!("{error}; replacement cleanup was not durable: {sync_error}")
                }
                None => format!("{error}; replacement parent is missing"),
            },
            Err(remove_error) => {
                format!("{error}; could not remove owned replacement: {remove_error}")
            }
        },
    }
}

fn authorized_replacement_path(destination: &Path, replacement: &Path) -> bool {
    let Some(destination_parent) = destination.parent() else {
        return false;
    };
    let Some(replacement_parent) = replacement.parent() else {
        return false;
    };
    if replacement_parent == destination_parent {
        return replacement.file_name().is_some();
    }
    let Some(journal_name) = replacement_parent
        .file_name()
        .and_then(|name| name.to_str())
    else {
        return false;
    };
    let Some(nonce) = journal_name.strip_prefix(".cavalry-i18n-transaction-") else {
        return false;
    };
    let Some(install_root) = replacement_parent.parent() else {
        return false;
    };
    nonce.len() == 64
        && nonce
            .bytes()
            .all(|byte| byte.is_ascii_hexdigit() && !byte.is_ascii_uppercase())
        && path_is_within(destination, install_root)
        && path_is_within(replacement_parent, install_root)
        && replacement_parent.parent() == Some(install_root)
        && replacement
            .file_name()
            .and_then(|name| name.to_str())
            .is_some_and(|name| {
                (name.starts_with(".payload-apply-") || name.starts_with(".payload-rollback-"))
                    && name.ends_with(".tmp")
            })
}

pub(super) fn journal_replacement_path(
    journal_root: &Path,
    destination: &Path,
    entry_index: usize,
    phase: &str,
) -> Result<PathBuf, String> {
    if !matches!(phase, "apply" | "rollback") {
        return Err("Transaction replacement phase is not fixed.".to_string());
    }
    if !journal_root.is_absolute() || destination.is_relative() {
        return Err("Transaction replacement path inputs are not absolute.".to_string());
    }
    Ok(journal_root.join(format!(".payload-{phase}-{entry_index}.tmp")))
}

fn ensure_ordinary_existing_file(path: &Path) -> Result<(), String> {
    let metadata = fs::symlink_metadata(path).map_err(|error| {
        format!(
            "Could not inspect transaction destination {}: {error}",
            path.display()
        )
    })?;
    if !metadata.is_file() || metadata_is_reparse_point(&metadata) {
        return Err(format!(
            "Refusing non-file or reparse transaction destination: {}",
            path.display()
        ));
    }
    Ok(())
}

pub(super) fn hash_open_file(file: &mut fs::File, path: &Path) -> Result<String, String> {
    file.seek(SeekFrom::Start(0))
        .map_err(|error| format!("Could not rewind {} for hashing: {error}", path.display()))?;
    let mut digest = Sha256::new();
    let mut buffer = [0_u8; 64 * 1024];
    loop {
        let read = file
            .read(&mut buffer)
            .map_err(|error| format!("Could not hash {}: {error}", path.display()))?;
        if read == 0 {
            break;
        }
        digest.update(&buffer[..read]);
    }
    Ok(lower_hex(&digest.finalize()))
}

pub(super) fn lower_hex(bytes: &[u8]) -> String {
    const DIGITS: &[u8; 16] = b"0123456789abcdef";
    let mut output = String::with_capacity(bytes.len() * 2);
    for byte in bytes {
        output.push(DIGITS[(byte >> 4) as usize] as char);
        output.push(DIGITS[(byte & 0x0f) as usize] as char);
    }
    output
}
