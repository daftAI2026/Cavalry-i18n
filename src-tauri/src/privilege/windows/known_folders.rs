/**
 * [INPUT]: 依赖 SHGetKnownFolderPath、文件属性与 install::normalize_path，接收 UAC copy pair 目标。
 * [OUTPUT]: 提供 OS-known Program Files 根解析、绝对路径边界与无 reparse point 校验。
 * [POS]: Windows UAC 的授权根；绝不从进程环境变量推导提升允许路径。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
use std::{
    ffi::{c_void, OsString},
    fs,
    os::windows::{ffi::OsStringExt, fs::MetadataExt as WindowsMetadataExt},
    path::{Component, Path, PathBuf},
    ptr,
};

use crate::{install::normalize_path, patch::CopyPair};

#[repr(C)]
struct KnownFolderId {
    data1: u32,
    data2: u16,
    data3: u16,
    data4: [u8; 8],
}

const FOLDER_ID_PROGRAM_FILES: KnownFolderId = KnownFolderId {
    data1: 0x905e_63b6,
    data2: 0xc1bf,
    data3: 0x494e,
    data4: [0xb2, 0x9c, 0x65, 0xb7, 0x32, 0xd3, 0xd2, 0x1a],
};

const FOLDER_ID_PROGRAM_FILES_X86: KnownFolderId = KnownFolderId {
    data1: 0x7c5a_40ef,
    data2: 0xa0fb,
    data3: 0x4bfc,
    data4: [0x87, 0x4a, 0xc0, 0xf2, 0xe0, 0xb9, 0xfa, 0x8e],
};

const FILE_ATTRIBUTE_REPARSE_POINT: u32 = 0x0000_0400;

#[link(name = "shell32")]
unsafe extern "system" {
    fn SHGetKnownFolderPath(
        folder_id: *const KnownFolderId,
        flags: u32,
        token: *mut c_void,
        path: *mut *mut u16,
    ) -> i32;
}

#[link(name = "ole32")]
unsafe extern "system" {
    fn CoTaskMemFree(memory: *mut c_void);
}

struct CoTaskMemWide(*mut u16);

impl Drop for CoTaskMemWide {
    fn drop(&mut self) {
        if !self.0.is_null() {
            // SAFETY: SHGetKnownFolderPath 使用 COM task allocator 分配此缓冲区。
            unsafe { CoTaskMemFree(self.0.cast()) };
        }
    }
}

pub(crate) fn windows_elevation_supported_for_install(install_root: &Path) -> bool {
    let Ok(trusted_roots) = windows_trusted_program_files_roots() else {
        return false;
    };
    windows_elevation_supported_for_install_with_roots(install_root, &trusted_roots)
}

pub(crate) fn windows_elevation_supported_for_install_with_roots(
    install_root: &Path,
    trusted_roots: &[PathBuf],
) -> bool {
    let Ok(lexical_root) = lexically_absolute_windows_path(install_root) else {
        return false;
    };
    trusted_root_for_destination(&lexical_root, trusted_roots).is_some()
}

pub(crate) fn windows_elevation_supported_for_copy_pairs(pairs: &[CopyPair]) -> bool {
    let Ok(trusted_roots) = windows_trusted_program_files_roots() else {
        return false;
    };
    pairs
        .iter()
        .all(|pair| windows_elevation_supported_for_install_with_roots(&pair.dst, &trusted_roots))
}

pub(crate) fn validate_windows_control_free_path(value: &str, field: &str) -> Result<(), String> {
    if value
        .chars()
        .any(|character| matches!(character, '\r' | '\n' | '\0' | '\t'))
    {
        return Err(format!("Unsafe control character in {field}: {value:?}"));
    }
    Ok(())
}

fn query_known_folder_path(name: &str, folder_id: &KnownFolderId) -> Result<PathBuf, String> {
    let mut memory = CoTaskMemWide(ptr::null_mut());
    // SAFETY: folder_id 是静态有效 GUID，token 按契约为 null，memory 在 Drop 前独占 COM 分配。
    let result = unsafe {
        SHGetKnownFolderPath(
            folder_id,
            0,
            ptr::null_mut(),
            &mut memory.0 as *mut *mut u16,
        )
    };
    if result < 0 {
        return Err(format!(
            "Could not resolve Windows known folder {name} (HRESULT 0x{:08X}).",
            result as u32
        ));
    }
    if memory.0.is_null() {
        return Err(format!(
            "Windows known folder {name} returned an empty path allocation."
        ));
    }

    let mut length = 0usize;
    // SAFETY: 成功的 SHGetKnownFolderPath 返回 NUL 终止 UTF-16 缓冲区。
    unsafe {
        while *memory.0.add(length) != 0 {
            length += 1;
        }
    }
    // SAFETY: length 在上方同一终止缓冲区中测得。
    let wide = unsafe { std::slice::from_raw_parts(memory.0, length) };
    let path = PathBuf::from(OsString::from_wide(wide));
    if path.as_os_str().is_empty() {
        return Err(format!(
            "Windows known folder {name} returned an empty path."
        ));
    }
    Ok(path)
}

pub(crate) fn windows_attributes_include_reparse_point(attributes: u32) -> bool {
    attributes & FILE_ATTRIBUTE_REPARSE_POINT != 0
}

pub(crate) fn metadata_is_reparse_point(metadata: &fs::Metadata) -> bool {
    windows_attributes_include_reparse_point(metadata.file_attributes())
}

pub(crate) fn windows_trusted_program_files_roots() -> Result<Vec<PathBuf>, String> {
    let mut roots = Vec::<PathBuf>::new();
    for (name, folder_id) in [
        ("FOLDERID_ProgramFiles", &FOLDER_ID_PROGRAM_FILES),
        ("FOLDERID_ProgramFilesX86", &FOLDER_ID_PROGRAM_FILES_X86),
    ] {
        let reported = query_known_folder_path(name, folder_id)?;
        let metadata = fs::symlink_metadata(&reported).map_err(|error| {
            format!(
                "Could not inspect Windows known folder {} at {}: {error}",
                name,
                reported.display()
            )
        })?;
        if !metadata.is_dir() {
            return Err(format!(
                "Windows known folder {} is not a directory: {}",
                name,
                reported.display()
            ));
        }
        if metadata_is_reparse_point(&metadata) {
            return Err(format!(
                "Refusing administrator copy because Windows known folder {} is a reparse point: {}",
                name,
                reported.display()
            ));
        }
        let canonical = fs::canonicalize(&reported).map_err(|error| {
            format!(
                "Could not canonicalize Windows known folder {} at {}: {error}",
                name,
                reported.display()
            )
        })?;
        let canonical = normalize_path(&canonical);
        if !roots.iter().any(|root| paths_equal(root, &canonical)) {
            roots.push(canonical);
        }
    }
    if roots.is_empty() {
        return Err("Windows returned no trusted Program Files known folders.".to_string());
    }
    Ok(roots)
}

pub(crate) fn lexically_absolute_windows_path(path: &Path) -> Result<PathBuf, String> {
    let absolute = if path.is_absolute() {
        path.to_path_buf()
    } else {
        std::env::current_dir()
            .map_err(|error| error.to_string())?
            .join(path)
    };
    let mut normalized = PathBuf::new();
    for component in absolute.components() {
        match component {
            Component::CurDir => {}
            Component::ParentDir => {
                let _ = normalized.pop();
            }
            Component::Prefix(prefix) => normalized.push(prefix.as_os_str()),
            Component::RootDir => normalized.push(component.as_os_str()),
            Component::Normal(segment) => normalized.push(segment),
        }
    }
    if !normalized.is_absolute() {
        return Err(format!(
            "Could not resolve an absolute Windows destination path: {}",
            path.display()
        ));
    }
    Ok(normalized)
}

pub(crate) fn trusted_root_for_destination<'a>(
    destination: &Path,
    trusted_roots: &'a [PathBuf],
) -> Option<&'a PathBuf> {
    trusted_roots
        .iter()
        .find(|root| path_is_within(destination, root))
}

fn relative_components_case_insensitive(path: &Path, root: &Path) -> Option<Vec<OsString>> {
    let path_components = path.components().collect::<Vec<_>>();
    let root_components = root.components().collect::<Vec<_>>();
    if path_components.len() < root_components.len()
        || !path_components
            .iter()
            .zip(&root_components)
            .all(|(left, right)| {
                left.as_os_str()
                    .to_string_lossy()
                    .eq_ignore_ascii_case(&right.as_os_str().to_string_lossy())
            })
    {
        return None;
    }
    Some(
        path_components[root_components.len()..]
            .iter()
            .map(|component| component.as_os_str().to_os_string())
            .collect(),
    )
}

pub(crate) fn ensure_no_reparse_points(root: &Path, destination: &Path) -> Result<(), String> {
    let relative = relative_components_case_insensitive(destination, root).ok_or_else(|| {
        format!(
            "Destination {} is not under trusted root {}.",
            destination.display(),
            root.display()
        )
    })?;
    let mut current = root.to_path_buf();
    for segment in std::iter::once(None).chain(relative.iter().map(Some)) {
        if let Some(segment) = segment {
            current.push(segment);
        }
        match fs::symlink_metadata(&current) {
            Ok(metadata) if metadata_is_reparse_point(&metadata) => {
                return Err(format!(
                    "Refusing administrator copy through a Windows reparse point: {}",
                    current.display()
                ));
            }
            Ok(_) => {}
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => break,
            Err(error) => {
                return Err(format!(
                    "Could not inspect destination component {} before elevation: {error}",
                    current.display()
                ));
            }
        }
    }
    Ok(())
}

fn canonical_destination_path(destination: &Path) -> Result<PathBuf, String> {
    let mut existing = destination.to_path_buf();
    let mut missing = Vec::<OsString>::new();
    loop {
        match fs::symlink_metadata(&existing) {
            Ok(_) => {
                let mut resolved =
                    normalize_path(&fs::canonicalize(&existing).map_err(|error| {
                        format!(
                            "Could not canonicalize destination component {}: {error}",
                            existing.display()
                        )
                    })?);
                for segment in missing.iter().rev() {
                    resolved.push(segment);
                }
                return Ok(resolved);
            }
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
                let file_name = existing.file_name().ok_or_else(|| {
                    format!(
                        "Could not find an existing destination ancestor for {}",
                        destination.display()
                    )
                })?;
                missing.push(file_name.to_os_string());
                existing = existing
                    .parent()
                    .ok_or_else(|| {
                        format!(
                            "Could not find an existing destination ancestor for {}",
                            destination.display()
                        )
                    })?
                    .to_path_buf();
            }
            Err(error) => {
                return Err(format!(
                    "Could not inspect destination {} before elevation: {error}",
                    existing.display()
                ));
            }
        }
    }
}

pub(crate) fn paths_equal(left: &Path, right: &Path) -> bool {
    path_is_within(left, right) && path_is_within(right, left)
}

pub(crate) fn validate_windows_copy_pair(
    pair: &CopyPair,
    trusted_roots: &[PathBuf],
) -> Result<(), String> {
    for path in [&pair.src, &pair.dst] {
        validate_windows_control_free_path(&path.to_string_lossy(), "copy path")?;
    }
    if !pair.src.is_file() {
        return Err(format!(
            "Staged source does not exist: {}",
            pair.src.display()
        ));
    }
    if pair.dst.file_name().is_none() {
        return Err(format!(
            "Destination is not a file path: {}",
            pair.dst.display()
        ));
    }

    let source = normalize_path(&pair.src);
    let temp_root = normalize_path(&std::env::temp_dir());
    if !path_is_within(&source, &temp_root) {
        return Err(format!(
            "Refusing to elevate a source outside the staging directory: {}",
            pair.src.display()
        ));
    }

    let lexical_destination = lexically_absolute_windows_path(&pair.dst)?;
    let trusted_root = trusted_root_for_destination(&lexical_destination, trusted_roots).ok_or_else(|| {
        format!(
            "Refusing administrator elevation for a destination outside Windows known Program Files roots: {}",
            pair.dst.display()
        )
    })?;
    ensure_no_reparse_points(trusted_root, &lexical_destination)?;
    let resolved_destination = canonical_destination_path(&lexical_destination)?;
    if !path_is_within(&resolved_destination, trusted_root) {
        return Err(format!(
            "Refusing administrator elevation because the canonical destination escapes Windows known Program Files root {}: {} resolved to {}",
            trusted_root.display(),
            pair.dst.display(),
            resolved_destination.display()
        ));
    }
    Ok(())
}

pub(crate) fn path_is_within(path: &Path, root: &Path) -> bool {
    let path = path
        .to_string_lossy()
        .trim_start_matches(r"\\?\")
        .replace('/', "\\")
        .trim_end_matches('\\')
        .to_ascii_lowercase();
    let root = root
        .to_string_lossy()
        .trim_start_matches(r"\\?\")
        .replace('/', "\\")
        .trim_end_matches('\\')
        .to_ascii_lowercase();
    path == root
        || path
            .strip_prefix(&root)
            .is_some_and(|rest| rest.starts_with('\\'))
}
