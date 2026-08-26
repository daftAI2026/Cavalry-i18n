/**
 * [INPUT]: 依赖 Windows no-share/reparse-safe 文件句柄、已验证的普通源文件与目标 CAS、事务 journal 固定临时路径，以及 ReplaceFileW/MoveFileExW 原子发布能力。
 * [OUTPUT]: 提供 no-share/reparse-safe 打开、完整写入并 fsync 的 staged overwrite；既有目标经 ReplaceFileW 捕获 journal-owned displaced 前像并复核 postcondition，删除保持 handle-bound。
 * [POS]: language_transaction/storage 的 I/O 原语；正向写入与回滚共用，目标句柄负责初始 CAS，发布间隙由 displaced 前像证明并保全外部更新。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
use std::{
    fs,
    io::{Read, Seek, SeekFrom},
    os::windows::{fs::OpenOptionsExt, io::AsRawHandle},
    path::{Path, PathBuf},
};

use sha2::{Digest, Sha256};
use windows::core::{HSTRING, PCWSTR};
use windows::Win32::{
    Foundation::{GENERIC_READ, HANDLE},
    Storage::FileSystem::{
        FileDispositionInfo, MoveFileExW, ReplaceFileW, SetFileInformationByHandle, DELETE,
        FILE_DISPOSITION_INFO, FILE_FLAG_OPEN_REPARSE_POINT, FILE_WRITE_ATTRIBUTES,
        MOVEFILE_WRITE_THROUGH, REPLACE_FILE_FLAGS,
    },
};

use super::super::super::known_folders::{metadata_is_reparse_point, path_is_within};
use super::super::journal_manifest::sync_directory;
use super::snapshot_hash;

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
            .access_mode(GENERIC_READ.0 | DELETE.0 | FILE_WRITE_ATTRIBUTES.0)
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

    pub(super) fn clear_readonly_for_delete(&mut self) -> Result<(), String> {
        let file = self.file.as_mut().ok_or_else(|| {
            "Cannot change permissions on an unpublished destination.".to_string()
        })?;
        let mut permissions = file
            .metadata()
            .map_err(|error| format!("Could not inspect journal member permissions: {error}"))?
            .permissions();
        if permissions.readonly() {
            permissions.set_readonly(false);
            file.set_permissions(permissions).map_err(|error| {
                format!("Could not clear journal member readonly flag: {error}")
            })?;
        }
        Ok(())
    }

    pub(super) fn overwrite_from(
        &mut self,
        source: &mut fs::File,
        permissions: &fs::Permissions,
        replacement: &Path,
        displaced: Option<&Path>,
        expected_after: &str,
    ) -> MutationResult {
        self.overwrite_from_with_before_publish(
            source,
            permissions,
            replacement,
            displaced,
            None,
            expected_after,
        )
    }

    pub(super) fn overwrite_from_with_before_publish(
        &mut self,
        source: &mut fs::File,
        permissions: &fs::Permissions,
        replacement: &Path,
        displaced: Option<&Path>,
        before_publish: Option<Box<dyn FnOnce() -> Result<(), String>>>,
        expected_after: &str,
    ) -> MutationResult {
        self.overwrite_from_inner(
            source,
            permissions,
            replacement,
            displaced,
            before_publish,
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
        self.overwrite_from_inner(source, permissions, replacement, None, None, None, copy)
    }

    #[cfg(test)]
    pub(super) fn overwrite_from_with_publish_race<F>(
        &mut self,
        source: &mut fs::File,
        permissions: &fs::Permissions,
        replacement: &Path,
        displaced: Option<&Path>,
        expected_after: &str,
        race: impl FnOnce() -> Result<(), String> + 'static,
        copy: F,
    ) -> MutationResult
    where
        F: FnOnce(&mut fs::File, &mut fs::File) -> Result<(), String>,
    {
        self.overwrite_from_inner(
            source,
            permissions,
            replacement,
            displaced,
            Some(Box::new(race)),
            Some(expected_after),
            copy,
        )
    }

    fn overwrite_from_inner<F>(
        &mut self,
        source: &mut fs::File,
        permissions: &fs::Permissions,
        replacement: &Path,
        displaced: Option<&Path>,
        before_publish: Option<Box<dyn FnOnce() -> Result<(), String>>>,
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
            if let Some(displaced) = displaced {
                if !authorized_displaced_path(&self.path, displaced) {
                    return Err(format!(
                        "Refusing an unauthorized displaced preimage path: {}",
                        displaced.display()
                    ));
                }
                match fs::symlink_metadata(displaced) {
                    Ok(_) => {
                        return Err(format!(
                            "Refusing an occupied displaced preimage path: {}",
                            displaced.display()
                        ))
                    }
                    Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
                    Err(error) => {
                        return Err(format!(
                            "Could not inspect displaced preimage path {}: {error}",
                            displaced.display()
                        ))
                    }
                }
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
            if let Some(before_publish) = before_publish {
                before_publish()?;
            }
            let target_arg = HSTRING::from(self.path.to_string_lossy().to_string());
            let replacement_arg = HSTRING::from(replacement.to_string_lossy().to_string());
            let publish_result = if had_target {
                let displaced_arg =
                    displaced.map(|path| HSTRING::from(path.to_string_lossy().to_string()));
                let backup = displaced_arg
                    .as_ref()
                    .map_or_else(PCWSTR::null, |path| PCWSTR(path.as_ptr()));
                unsafe {
                    ReplaceFileW(
                        &target_arg,
                        &replacement_arg,
                        backup,
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
            if had_target {
                if let Some(displaced) = displaced {
                    let expected_before = self.preimage_sha256.as_deref().ok_or_else(|| {
                        "Atomic replacement lost its recorded destination preimage.".to_string()
                    })?;
                    let displaced_hash = snapshot_hash(displaced).map_err(|error| error.message)?;
                    if displaced_hash.as_deref() != Some(expected_before) {
                        let displaced_arg = HSTRING::from(displaced.to_string_lossy().to_string());
                        let staged_arg = HSTRING::from(replacement.to_string_lossy().to_string());
                        let restore = unsafe {
                            ReplaceFileW(
                                &target_arg,
                                &displaced_arg,
                                PCWSTR(staged_arg.as_ptr()),
                                REPLACE_FILE_FLAGS(0),
                                None,
                                None,
                            )
                        };
                        if restore.is_err() {
                            return Err(format!(
                                "Destination changed before atomic replacement; displaced preimage was retained at {}.",
                                displaced.display()
                            ));
                        }
                        sync_directory(parent)?;
                        if let Some(replacement_parent) = replacement.parent() {
                            sync_directory(replacement_parent)?;
                        }
                        let mut reopened =
                            open_locked_existing(&self.path, "restored concurrent destination")?;
                        let restored = hash_open_file(&mut reopened, &self.path)?;
                        self.preimage_sha256 = Some(restored);
                        self.file = Some(reopened);
                        return Err(format!(
                            "Destination changed before atomic replacement; preserved concurrent update at {}.",
                            self.path.display()
                        ));
                    }
                    if let Some(mut displaced_file) =
                        LockedDestination::open_existing_for_delete(displaced)?
                    {
                        displaced_file.clear_readonly_for_delete()?;
                        displaced_file.delete_on_close()?;
                        if let Some(displaced_parent) = displaced.parent() {
                            sync_directory(displaced_parent)?;
                        }
                    }
                }
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
                (name.starts_with(".payload-apply-")
                    || name.starts_with(".payload-rollback-")
                    || name.starts_with(".payload-displaced-"))
                    && name.ends_with(".tmp")
            })
}

pub(super) fn journal_replacement_path(
    journal_root: &Path,
    destination: &Path,
    entry_index: usize,
    phase: &str,
) -> Result<PathBuf, String> {
    if !matches!(phase, "apply" | "rollback" | "displaced") {
        return Err("Transaction replacement phase is not fixed.".to_string());
    }
    if !journal_root.is_absolute() || destination.is_relative() {
        return Err("Transaction replacement path inputs are not absolute.".to_string());
    }
    Ok(journal_root.join(format!(".payload-{phase}-{entry_index}.tmp")))
}

fn authorized_displaced_path(destination: &Path, displaced: &Path) -> bool {
    authorized_replacement_path(destination, displaced)
        && displaced
            .file_name()
            .and_then(|name| name.to_str())
            .is_some_and(|name| name.starts_with(".payload-displaced-"))
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
