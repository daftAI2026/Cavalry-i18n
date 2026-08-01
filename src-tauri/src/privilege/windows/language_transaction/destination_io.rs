/**
 * [INPUT]: 依赖 Windows FileShare.None、FILE_FLAG_OPEN_REPARSE_POINT、SetFileInformationByHandle 与普通文件句柄；接收已由事务层完成路径授权的目标文件。
 * [OUTPUT]: 提供目标文件单句柄 CAS、覆盖、复核与 delete-on-close；目标从校验到变更期间不会重新按路径打开。
 * [POS]: language_transaction/storage 的目标 I/O 原语；正向写入与回滚共用，消除校验后重开路径造成的并发替换窗口。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
use std::{
    fs,
    io::{Read, Seek, SeekFrom},
    os::windows::{fs::OpenOptionsExt, io::AsRawHandle},
    path::{Path, PathBuf},
};

use sha2::{Digest, Sha256};
use windows::Win32::{
    Foundation::{GENERIC_READ, HANDLE},
    Storage::FileSystem::{
        FileDispositionInfo, SetFileInformationByHandle, DELETE, FILE_DISPOSITION_INFO,
        FILE_FLAG_OPEN_REPARSE_POINT,
    },
};

use super::super::super::known_folders::metadata_is_reparse_point;

#[derive(Debug)]
pub(super) struct MutationResult {
    pub(super) observed_sha256: Option<String>,
    pub(super) error: Option<String>,
}

pub(super) struct LockedDestination {
    file: fs::File,
    path: PathBuf,
    preimage_sha256: Option<String>,
}

impl LockedDestination {
    pub(super) fn open_for_write(path: &Path, expected_exists: bool) -> Result<Self, String> {
        if expected_exists {
            ensure_ordinary_existing_file(path)?;
            let mut file = fs::OpenOptions::new()
                .read(true)
                .write(true)
                .share_mode(0)
                .custom_flags(FILE_FLAG_OPEN_REPARSE_POINT.0)
                .open(path)
                .map_err(|error| {
                    format!(
                        "Could not exclusively open transaction destination {}: {error}",
                        path.display()
                    )
                })?;
            let metadata = file.metadata().map_err(|error| {
                format!(
                    "Could not inspect opened transaction destination {}: {error}",
                    path.display()
                )
            })?;
            if !metadata.is_file() || metadata_is_reparse_point(&metadata) {
                return Err(format!(
                    "Refusing non-file or reparse transaction destination: {}",
                    path.display()
                ));
            }
            let preimage_sha256 = Some(hash_open_file(&mut file, path)?);
            Ok(Self {
                file,
                path: path.to_path_buf(),
                preimage_sha256,
            })
        } else {
            let file = fs::OpenOptions::new()
                .read(true)
                .write(true)
                .create_new(true)
                .share_mode(0)
                .custom_flags(FILE_FLAG_OPEN_REPARSE_POINT.0)
                .open(path)
                .map_err(|error| {
                    format!(
                        "Could not exclusively create transaction destination {}: {error}",
                        path.display()
                    )
                })?;
            Ok(Self {
                file,
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
            file,
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
    ) -> MutationResult {
        let mutation = (|| -> Result<(), String> {
            self.file.set_len(0).map_err(|error| {
                format!(
                    "Could not truncate transaction destination {}: {error}",
                    self.path.display()
                )
            })?;
            self.file.seek(SeekFrom::Start(0)).map_err(|error| {
                format!(
                    "Could not rewind transaction destination {}: {error}",
                    self.path.display()
                )
            })?;
            std::io::copy(source, &mut self.file)
                .and_then(|_| self.file.sync_all())
                .map_err(|error| {
                    format!(
                        "Could not copy locked source to {}: {error}",
                        self.path.display()
                    )
                })?;
            self.file
                .set_permissions(permissions.clone())
                .map_err(|error| {
                    format!(
                        "Could not preserve permissions on {}: {error}",
                        self.path.display()
                    )
                })
        })();
        let observed = hash_open_file(&mut self.file, &self.path);
        match (mutation, observed) {
            (Ok(()), Ok(hash)) => MutationResult {
                observed_sha256: Some(hash),
                error: None,
            },
            (Err(error), Ok(hash)) => MutationResult {
                observed_sha256: Some(hash),
                error: Some(error),
            },
            (Ok(()), Err(error)) => MutationResult {
                observed_sha256: None,
                error: Some(format!(
                    "Destination write completed but its same-handle postcondition failed: {error}"
                )),
            },
            (Err(mutation_error), Err(hash_error)) => MutationResult {
                observed_sha256: None,
                error: Some(format!(
                    "{mutation_error}; same-handle postcondition also failed: {hash_error}"
                )),
            },
        }
    }

    pub(super) fn delete_on_close(self) -> Result<(), String> {
        let disposition = FILE_DISPOSITION_INFO { DeleteFile: true };
        unsafe {
            SetFileInformationByHandle(
                HANDLE(self.file.as_raw_handle()),
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
        drop(self);
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
