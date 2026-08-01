/**
 * [INPUT]: 依赖 Windows ReplaceFileW/MoveFileExW、PE/版本资源与 sha2 流式摘要。
 * [OUTPUT]: 提供 QPA 部署所需的普通文件/重解析点约束、x64 与 Qt 版本证明、持久写入及同卷原子替换。
 * [POS]: windows_qpa 的唯一低层文件适配器；所有临时名固定在 Cavalry 安装卷，失败时只清理哈希已证明的自有文件。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
use std::{
    ffi::c_void,
    fs,
    io::{ErrorKind, Read, Seek, SeekFrom, Write},
    os::windows::fs::MetadataExt as WindowsMetadataExt,
    path::Path,
};

use sha2::{Digest, Sha256};
use windows::{
    core::HSTRING,
    Win32::Storage::FileSystem::{
        GetFileVersionInfoSizeW, GetFileVersionInfoW, MoveFileExW, ReplaceFileW, VerQueryValueW,
        MOVEFILE_WRITE_THROUGH, REPLACE_FILE_FLAGS, VS_FIXEDFILEINFO,
    },
};

const FILE_ATTRIBUTE_REPARSE_POINT: u32 = 0x0000_0400;
const PE_SIGNATURE: [u8; 4] = *b"PE\0\0";
const PE_MACHINE_AMD64: u16 = 0x8664;
const PE32_PLUS_MAGIC: u16 = 0x020b;
const VERSION_SIGNATURE: u32 = 0xFEEF_04BD;

pub(super) const ROOT_REPLACEMENT_TEMP: &str = ".cavalry-i18n-qwindows.tmp";
pub(super) const REPLACE_BACKUP_FILE: &str = ".replace-backup.dll";
pub(super) const MANIFEST_TEMP_FILE: &str = ".manifest.tmp";
pub(super) const MANIFEST_REPLACE_BACKUP_FILE: &str = ".manifest-replace-backup.json";
pub(super) const VENDOR_TEMP_FILE: &str = ".vendor-qwindows.tmp";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(super) struct FileVersion {
    pub(super) major: u16,
    pub(super) minor: u16,
    pub(super) patch: u16,
    pub(super) build: u16,
}

impl std::fmt::Display for FileVersion {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(
            formatter,
            "{}.{}.{}.{}",
            self.major, self.minor, self.patch, self.build
        )
    }
}

pub(super) fn sha256_file(path: &Path) -> Result<String, String> {
    ensure_regular_file(path, "hash input")?;
    let mut file = fs::File::open(path)
        .map_err(|error| format!("Could not open {}: {error}", path.display()))?;
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
    Ok(hex(digest.finalize().as_slice()))
}

pub(super) fn sha256_bytes(bytes: &[u8]) -> String {
    hex(Sha256::digest(bytes).as_slice())
}

fn hex(bytes: &[u8]) -> String {
    const DIGITS: &[u8; 16] = b"0123456789abcdef";
    let mut output = String::with_capacity(bytes.len() * 2);
    for byte in bytes {
        output.push(DIGITS[(byte >> 4) as usize] as char);
        output.push(DIGITS[(byte & 0x0f) as usize] as char);
    }
    output
}

pub(super) fn snapshot_hash(path: &Path, role: &str) -> Result<Option<String>, String> {
    match fs::symlink_metadata(path) {
        Ok(metadata) => {
            if !metadata.is_file() || metadata_is_reparse_point(&metadata) {
                return Err(format!(
                    "Refusing non-file or reparse {role}: {}",
                    path.display()
                ));
            }
            sha256_file(path).map(Some)
        }
        Err(error) if error.kind() == ErrorKind::NotFound => Ok(None),
        Err(error) => Err(format!("Could not inspect {}: {error}", path.display())),
    }
}

pub(super) fn ensure_regular_file(path: &Path, role: &str) -> Result<(), String> {
    let metadata = fs::symlink_metadata(path)
        .map_err(|error| format!("Could not inspect {}: {error}", path.display()))?;
    if !metadata.is_file() || metadata_is_reparse_point(&metadata) {
        return Err(format!(
            "Refusing non-file or reparse {role}: {}",
            path.display()
        ));
    }
    Ok(())
}

pub(super) fn ensure_regular_directory(path: &Path, role: &str) -> Result<(), String> {
    let metadata = fs::symlink_metadata(path)
        .map_err(|error| format!("Could not inspect {}: {error}", path.display()))?;
    if !metadata.is_dir() || metadata_is_reparse_point(&metadata) {
        return Err(format!(
            "Refusing non-directory or reparse {role}: {}",
            path.display()
        ));
    }
    Ok(())
}

pub(super) fn ensure_path_chain_has_no_reparse_points(path: &Path) -> Result<(), String> {
    let mut current = path;
    loop {
        let metadata = fs::symlink_metadata(current)
            .map_err(|error| format!("Could not inspect {}: {error}", current.display()))?;
        if metadata_is_reparse_point(&metadata) {
            return Err(format!(
                "Refusing path through Windows reparse point: {}",
                current.display()
            ));
        }
        let Some(parent) = current.parent() else {
            break;
        };
        if parent == current {
            break;
        }
        current = parent;
    }
    Ok(())
}

pub(super) fn create_recovery_directory(path: &Path) -> Result<(), String> {
    let parent = path
        .parent()
        .ok_or_else(|| "QPA recovery directory has no parent.".to_string())?;
    ensure_path_chain_has_no_reparse_points(parent)?;
    match fs::create_dir(path) {
        Ok(()) => {}
        Err(error) if error.kind() == ErrorKind::AlreadyExists => {}
        Err(error) => {
            return Err(format!(
                "Could not create QPA recovery directory {}: {error}",
                path.display()
            ))
        }
    }
    ensure_regular_directory(path, "QPA recovery directory")
}

pub(super) fn validate_x64_pe(path: &Path, role: &str) -> Result<(), String> {
    ensure_regular_file(path, role)?;
    let mut file = fs::File::open(path)
        .map_err(|error| format!("Could not open {}: {error}", path.display()))?;
    let mut dos = [0_u8; 64];
    file.read_exact(&mut dos)
        .map_err(|error| format!("{role} is not a complete PE image: {error}"))?;
    if &dos[..2] != b"MZ" {
        return Err(format!("{role} is not a PE image: {}", path.display()));
    }
    let pe_offset = u32::from_le_bytes(dos[60..64].try_into().unwrap()) as u64;
    if pe_offset < 64 || pe_offset > 64 * 1024 * 1024 {
        return Err(format!("{role} has an invalid PE header offset."));
    }
    file.seek(SeekFrom::Start(pe_offset))
        .and_then(|_| {
            let mut header = [0_u8; 26];
            file.read_exact(&mut header)?;
            Ok(header)
        })
        .map(|header| {
            if header[..4] != PE_SIGNATURE {
                return Err(format!("{role} has an invalid PE signature."));
            }
            let machine = u16::from_le_bytes(header[4..6].try_into().unwrap());
            let optional_magic = u16::from_le_bytes(header[24..26].try_into().unwrap());
            if machine != PE_MACHINE_AMD64 || optional_magic != PE32_PLUS_MAGIC {
                return Err(format!(
                    "{role} must be Windows x64 (machine 0x{PE_MACHINE_AMD64:04x}, PE32+)."
                ));
            }
            Ok(())
        })
        .map_err(|error| {
            format!(
                "Could not read PE identity from {}: {error}",
                path.display()
            )
        })?
}

pub(super) fn product_version(path: &Path) -> Result<FileVersion, String> {
    ensure_regular_file(path, "versioned runtime file")?;
    let path = HSTRING::from(path.to_string_lossy().to_string());
    let size = unsafe { GetFileVersionInfoSizeW(&path, None) };
    if size == 0 {
        return Err("Windows file has no readable version resource.".to_string());
    }
    let mut bytes = vec![0_u8; size as usize];
    unsafe { GetFileVersionInfoW(&path, None, size, bytes.as_mut_ptr().cast::<c_void>()) }
        .map_err(|error| format!("Could not read Windows file version resource: {error}"))?;

    let query = HSTRING::from("\\");
    let mut value = std::ptr::null_mut::<c_void>();
    let mut value_size = 0_u32;
    let queried = unsafe {
        VerQueryValueW(
            bytes.as_ptr().cast::<c_void>(),
            &query,
            &mut value,
            &mut value_size,
        )
    };
    if !queried.as_bool()
        || value.is_null()
        || value_size < std::mem::size_of::<VS_FIXEDFILEINFO>() as u32
    {
        return Err("Windows file version resource has no fixed product version.".to_string());
    }
    let info = unsafe { &*value.cast::<VS_FIXEDFILEINFO>() };
    if info.dwSignature != VERSION_SIGNATURE {
        return Err("Windows file version resource has an invalid signature.".to_string());
    }
    Ok(FileVersion {
        major: (info.dwProductVersionMS >> 16) as u16,
        minor: info.dwProductVersionMS as u16,
        patch: (info.dwProductVersionLS >> 16) as u16,
        build: info.dwProductVersionLS as u16,
    })
}

pub(super) fn copy_new_durable(source: &Path, destination: &Path) -> Result<(), String> {
    ensure_regular_file(source, "durable copy source")?;
    let mut input = fs::File::open(source)
        .map_err(|error| format!("Could not open {}: {error}", source.display()))?;
    let mut output = fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(destination)
        .map_err(|error| format!("Could not create {}: {error}", destination.display()))?;
    std::io::copy(&mut input, &mut output)
        .and_then(|_| output.sync_all())
        .map_err(|error| {
            format!(
                "Could not durably copy {} to {}: {error}",
                source.display(),
                destination.display()
            )
        })
}

pub(super) fn write_new_durable(path: &Path, bytes: &[u8]) -> Result<(), String> {
    let mut file = fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(path)
        .map_err(|error| format!("Could not create {}: {error}", path.display()))?;
    file.write_all(bytes)
        .and_then(|_| file.sync_all())
        .map_err(|error| format!("Could not durably write {}: {error}", path.display()))
}

pub(super) fn publish_without_overwrite(
    source: &Path,
    destination: &Path,
    role: &str,
) -> Result<(), String> {
    let source = HSTRING::from(source.to_string_lossy().to_string());
    let destination = HSTRING::from(destination.to_string_lossy().to_string());
    unsafe { MoveFileExW(&source, &destination, MOVEFILE_WRITE_THROUGH) }
        .map_err(|error| format!("Could not atomically publish {role}: {error}"))
}

pub(super) fn replace_existing_verified(
    target: &Path,
    source: &Path,
    recovery_dir: &Path,
    expected_before: &str,
    expected_after: &str,
) -> Result<(), String> {
    let target_parent = target
        .parent()
        .ok_or_else(|| "QPA replacement target has no parent.".to_string())?;
    let replacement = target_parent.join(ROOT_REPLACEMENT_TEMP);
    let backup = recovery_dir.join(REPLACE_BACKUP_FILE);
    ensure_absent_or_remove_owned(&replacement, expected_after, "stale QPA replacement")?;
    ensure_absent_or_remove_owned(&backup, expected_before, "stale QPA replace backup")?;

    require_hash(target, expected_before, "QPA replacement target")?;
    copy_new_durable(source, &replacement)?;
    require_hash(&replacement, expected_after, "staged QPA replacement")?;

    let target_arg = HSTRING::from(target.to_string_lossy().to_string());
    let replacement_arg = HSTRING::from(replacement.to_string_lossy().to_string());
    let backup_arg = HSTRING::from(backup.to_string_lossy().to_string());
    let call_result = unsafe {
        ReplaceFileW(
            &target_arg,
            &replacement_arg,
            &backup_arg,
            REPLACE_FILE_FLAGS(0),
            None,
            None,
        )
    };

    let target_hash = snapshot_hash(target, "QPA replacement target")?;
    let replacement_hash = snapshot_hash(&replacement, "QPA replacement temporary file")?;
    let backup_hash = snapshot_hash(&backup, "QPA replacement backup")?;
    if target_hash.as_deref() == Some(expected_after)
        && backup_hash.as_deref() == Some(expected_before)
    {
        remove_if_hash_matches(&backup, expected_before, "QPA replacement backup")?;
        if replacement_hash.as_deref() == Some(expected_after) {
            remove_if_hash_matches(
                &replacement,
                expected_after,
                "QPA replacement temporary file",
            )?;
        }
        return Ok(());
    }
    if target_hash.as_deref() == Some(expected_before)
        && replacement_hash.as_deref() == Some(expected_after)
        && backup_hash.is_none()
    {
        remove_if_hash_matches(&replacement, expected_after, "unused QPA replacement")?;
    }
    Err(format!(
        "Atomic QPA replacement did not reach a proven state; recovery files were preserved. ReplaceFileW result: {}",
        call_result
            .err()
            .map(|error| error.to_string())
            .unwrap_or_else(|| "success with unexpected post-state".to_string())
    ))
}

pub(super) fn create_missing_verified(
    target: &Path,
    source: &Path,
    expected_after: &str,
) -> Result<(), String> {
    if snapshot_hash(target, "missing QPA target")?.is_some() {
        return Err("QPA target reappeared before recovery; preserving it.".to_string());
    }
    let parent = target
        .parent()
        .ok_or_else(|| "QPA recovery target has no parent.".to_string())?;
    let replacement = parent.join(ROOT_REPLACEMENT_TEMP);
    ensure_absent_or_remove_owned(&replacement, expected_after, "stale QPA recovery file")?;
    copy_new_durable(source, &replacement)?;
    require_hash(&replacement, expected_after, "staged QPA recovery file")?;
    publish_without_overwrite(&replacement, target, "missing qwindows.dll recovery")?;
    require_hash(target, expected_after, "recovered qwindows.dll")
}

pub(super) fn write_manifest_atomic(
    recovery_dir: &Path,
    manifest_path: &Path,
    bytes: &[u8],
) -> Result<(), String> {
    let expected_after = sha256_bytes(bytes);
    let temporary = recovery_dir.join(MANIFEST_TEMP_FILE);
    ensure_absent_or_remove_owned(
        &temporary,
        &expected_after,
        "stale QPA manifest temporary file",
    )?;
    write_new_durable(&temporary, bytes)?;

    let current = snapshot_hash(manifest_path, "QPA manifest")?;
    let Some(expected_before) = current else {
        publish_without_overwrite(&temporary, manifest_path, "QPA manifest")?;
        return require_hash(manifest_path, &expected_after, "published QPA manifest");
    };

    let backup = recovery_dir.join(MANIFEST_REPLACE_BACKUP_FILE);
    ensure_absent_or_remove_owned(&backup, &expected_before, "stale QPA manifest backup")?;
    let target_arg = HSTRING::from(manifest_path.to_string_lossy().to_string());
    let replacement_arg = HSTRING::from(temporary.to_string_lossy().to_string());
    let backup_arg = HSTRING::from(backup.to_string_lossy().to_string());
    let call_result = unsafe {
        ReplaceFileW(
            &target_arg,
            &replacement_arg,
            &backup_arg,
            REPLACE_FILE_FLAGS(0),
            None,
            None,
        )
    };
    let target_hash = snapshot_hash(manifest_path, "QPA manifest")?;
    let backup_hash = snapshot_hash(&backup, "QPA manifest backup")?;
    if target_hash.as_deref() == Some(expected_after.as_str())
        && backup_hash.as_deref() == Some(expected_before.as_str())
    {
        remove_if_hash_matches(&backup, &expected_before, "QPA manifest backup")?;
        return Ok(());
    }
    Err(format!(
        "Atomic QPA manifest update did not reach a proven state; recovery files were preserved. ReplaceFileW result: {}",
        call_result
            .err()
            .map(|error| error.to_string())
            .unwrap_or_else(|| "success with unexpected post-state".to_string())
    ))
}

pub(super) fn remove_if_hash_matches(
    path: &Path,
    expected: &str,
    role: &str,
) -> Result<(), String> {
    match snapshot_hash(path, role)? {
        None => Ok(()),
        Some(actual) if actual == expected => fs::remove_file(path)
            .map_err(|error| format!("Could not remove {role} {}: {error}", path.display())),
        Some(_) => Err(format!(
            "Refusing to remove changed {role}: {}",
            path.display()
        )),
    }
}

pub(super) fn require_hash(path: &Path, expected: &str, role: &str) -> Result<(), String> {
    match snapshot_hash(path, role)? {
        Some(actual) if actual == expected => Ok(()),
        Some(actual) => Err(format!(
            "{role} hash mismatch: expected {expected}, got {actual}."
        )),
        None => Err(format!("{role} is missing: {}", path.display())),
    }
}

pub(super) fn remove_regular_file(path: &Path, role: &str) -> Result<(), String> {
    match fs::symlink_metadata(path) {
        Err(error) if error.kind() == ErrorKind::NotFound => Ok(()),
        Err(error) => Err(format!("Could not inspect {}: {error}", path.display())),
        Ok(metadata) if metadata.is_file() && !metadata_is_reparse_point(&metadata) => {
            fs::remove_file(path)
                .map_err(|error| format!("Could not remove {role} {}: {error}", path.display()))
        }
        Ok(_) => Err(format!(
            "Refusing to remove non-file or reparse {role}: {}",
            path.display()
        )),
    }
}

pub(super) fn remove_empty_directory(path: &Path) -> Result<(), String> {
    ensure_regular_directory(path, "QPA recovery directory")?;
    fs::remove_dir(path).map_err(|error| {
        format!(
            "Could not remove QPA recovery directory {}: {error}",
            path.display()
        )
    })
}

fn ensure_absent_or_remove_owned(path: &Path, expected: &str, role: &str) -> Result<(), String> {
    match snapshot_hash(path, role)? {
        None => Ok(()),
        Some(actual) if actual == expected => fs::remove_file(path)
            .map_err(|error| format!("Could not remove {role} {}: {error}", path.display())),
        Some(_) => Err(format!(
            "Refusing changed {role}; recovery is required: {}",
            path.display()
        )),
    }
}

fn metadata_is_reparse_point(metadata: &fs::Metadata) -> bool {
    metadata.file_attributes() & FILE_ATTRIBUTE_REPARSE_POINT != 0
}

#[cfg(test)]
mod tests {
    use super::{sha256_file, validate_x64_pe};
    use std::{fs, path::Path};

    pub(super) fn write_fake_x64_pe(path: &Path, payload: &[u8]) {
        let mut bytes = vec![0_u8; 0x100];
        bytes[..2].copy_from_slice(b"MZ");
        bytes[60..64].copy_from_slice(&(0x80_u32).to_le_bytes());
        bytes[0x80..0x84].copy_from_slice(b"PE\0\0");
        bytes[0x84..0x86].copy_from_slice(&0x8664_u16.to_le_bytes());
        bytes[0x98..0x9a].copy_from_slice(&0x020b_u16.to_le_bytes());
        bytes.extend_from_slice(payload);
        fs::write(path, bytes).unwrap();
    }

    #[test]
    fn pe_gate_accepts_only_amd64_pe32_plus() {
        let temp = tempfile::tempdir().unwrap();
        let image = temp.path().join("x64.dll");
        write_fake_x64_pe(&image, b"payload");
        assert!(validate_x64_pe(&image, "fixture").is_ok());

        let bytes = fs::read(&image).unwrap();
        let wrong = temp.path().join("x86.dll");
        fs::write(&wrong, bytes).unwrap();
        let mut wrong_bytes = fs::read(&wrong).unwrap();
        wrong_bytes[0x84..0x86].copy_from_slice(&0x014c_u16.to_le_bytes());
        fs::write(&wrong, wrong_bytes).unwrap();
        assert!(validate_x64_pe(&wrong, "fixture")
            .unwrap_err()
            .contains("must be Windows x64"));
    }

    #[test]
    fn file_hash_is_lowercase_and_streamed() {
        let temp = tempfile::tempdir().unwrap();
        let path = temp.path().join("data.bin");
        fs::write(&path, vec![0x5a; 130_000]).unwrap();
        let hash = sha256_file(&path).unwrap();
        assert_eq!(hash.len(), 64);
        assert!(hash
            .chars()
            .all(|character| character.is_ascii_hexdigit() && !character.is_ascii_uppercase()));
    }
}
