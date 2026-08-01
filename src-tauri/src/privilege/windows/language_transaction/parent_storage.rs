/**
 * [INPUT]: 依赖 contract 派生 payload 路径、Windows 独占文件句柄、SHA-256 与 reparse 元数据。
 * [OUTPUT]: 提供父进程 payload staging/哈希、目标 preimage 快照和仅删除固定 plan.json/数字 payload 的保守清理。
 * [POS]: language_transaction parent 的本地存储子层；UAC 等待后拒绝递归删除被替换、重解析或含未知成员的目录。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
use std::{
    fs::{self, File, OpenOptions},
    io::{self, Read, Write},
    os::windows::fs::OpenOptionsExt,
    path::{Path, PathBuf},
};

use sha2::{Digest, Sha256};

use crate::privilege::windows::known_folders::metadata_is_reparse_point;

use super::super::contract::{
    payload_source_path, PayloadKind, PayloadRecord, MAX_PAYLOAD_RECORDS,
};
use super::PLAN_FILE_NAME;

const FILE_SHARE_NONE: u32 = 0;
const PLAN_DIRECTORY_PREFIX: &str = "elevated-language-";

#[derive(Debug, Clone)]
pub(super) struct StagedPayload {
    pub(super) record: PayloadRecord,
    pub(super) destination: Option<PathBuf>,
}

pub(super) fn stage_file_payload(
    plan_path: &Path,
    payloads: &mut Vec<StagedPayload>,
    id: &str,
    kind: PayloadKind,
    source: &Path,
    destination: Option<PathBuf>,
    expected_destination_sha256: Option<String>,
) -> Result<PathBuf, String> {
    let staged =
        payload_source_path(plan_path, payloads.len()).map_err(|error| error.to_string())?;
    let source_sha256 = copy_exclusive_and_hash(source, &staged)?;
    payloads.push(StagedPayload {
        record: PayloadRecord {
            id: id.to_string(),
            kind,
            source_sha256,
            expected_destination_sha256,
        },
        destination,
    });
    Ok(staged)
}

pub(super) fn stage_bytes_payload(
    plan_path: &Path,
    payloads: &mut Vec<StagedPayload>,
    id: &str,
    kind: PayloadKind,
    bytes: &[u8],
    destination: Option<PathBuf>,
    expected_destination_sha256: Option<String>,
) -> Result<PathBuf, String> {
    let staged =
        payload_source_path(plan_path, payloads.len()).map_err(|error| error.to_string())?;
    write_new_file(&staged, bytes)?;
    payloads.push(StagedPayload {
        record: PayloadRecord {
            id: id.to_string(),
            kind,
            source_sha256: hex_digest(bytes),
            expected_destination_sha256,
        },
        destination,
    });
    Ok(staged)
}

pub(super) fn copy_exclusive_and_hash(source: &Path, destination: &Path) -> Result<String, String> {
    let metadata = fs::symlink_metadata(source).map_err(|error| {
        format!(
            "Could not inspect elevated payload source {}: {error}",
            source.display()
        )
    })?;
    if !metadata.is_file() || metadata_is_reparse_point(&metadata) {
        return Err(format!(
            "Elevated payload source must be an ordinary non-reparse file: {}",
            source.display()
        ));
    }
    let mut input = OpenOptions::new()
        .read(true)
        .share_mode(FILE_SHARE_NONE)
        .open(source)
        .map_err(|error| {
            format!(
                "Could not lock payload source {}: {error}",
                source.display()
            )
        })?;
    let mut output = OpenOptions::new()
        .write(true)
        .create_new(true)
        .share_mode(FILE_SHARE_NONE)
        .open(destination)
        .map_err(|error| {
            format!(
                "Could not create staged payload {}: {error}",
                destination.display()
            )
        })?;
    let mut digest = Sha256::new();
    let mut buffer = [0u8; 64 * 1024];
    loop {
        let read = input.read(&mut buffer).map_err(|error| {
            format!(
                "Could not read payload source {}: {error}",
                source.display()
            )
        })?;
        if read == 0 {
            break;
        }
        digest.update(&buffer[..read]);
        output.write_all(&buffer[..read]).map_err(|error| {
            format!(
                "Could not write staged payload {}: {error}",
                destination.display()
            )
        })?;
    }
    output.sync_all().map_err(|error| {
        format!(
            "Could not flush staged payload {}: {error}",
            destination.display()
        )
    })?;
    fs::set_permissions(destination, metadata.permissions()).map_err(|error| {
        format!(
            "Could not preserve staged payload permissions at {}: {error}",
            destination.display()
        )
    })?;
    Ok(format!("{:x}", digest.finalize()))
}

pub(super) fn write_new_file(path: &Path, bytes: &[u8]) -> Result<(), String> {
    let mut file = OpenOptions::new()
        .write(true)
        .create_new(true)
        .share_mode(FILE_SHARE_NONE)
        .open(path)
        .map_err(|error| format!("Could not create {}: {error}", path.display()))?;
    file.write_all(bytes)
        .and_then(|_| file.sync_all())
        .map_err(|error| format!("Could not persist {}: {error}", path.display()))
}

pub(super) fn snapshot_hash(path: &Path) -> Result<Option<String>, String> {
    match fs::symlink_metadata(path) {
        Ok(metadata) if metadata.is_file() && !metadata_is_reparse_point(&metadata) => {
            sha256_file(path).map(Some)
        }
        Ok(_) => Err(format!(
            "Expected an ordinary non-reparse destination file: {}",
            path.display()
        )),
        Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(None),
        Err(error) => Err(format!(
            "Could not inspect destination preimage {}: {error}",
            path.display()
        )),
    }
}

pub(super) fn sha256_file(path: &Path) -> Result<String, String> {
    let mut file =
        File::open(path).map_err(|error| format!("Could not open {}: {error}", path.display()))?;
    let mut digest = Sha256::new();
    let mut buffer = [0u8; 64 * 1024];
    loop {
        let read = file
            .read(&mut buffer)
            .map_err(|error| format!("Could not hash {}: {error}", path.display()))?;
        if read == 0 {
            break;
        }
        digest.update(&buffer[..read]);
    }
    Ok(format!("{:x}", digest.finalize()))
}

pub(super) fn hex_digest(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}

pub(super) fn cleanup_directory(staging_root: &Path, directory: &Path) -> Result<(), String> {
    validate_cleanup_root(staging_root, directory)?;
    let payloads = directory.join("payloads");
    let plan = directory.join(PLAN_FILE_NAME);

    let mut plan_present = false;
    let mut payload_directory_present = false;
    for entry in fs::read_dir(directory).map_err(|error| cleanup_error(directory, error))? {
        let entry = entry.map_err(|error| cleanup_error(directory, error))?;
        let path = entry.path();
        let metadata = fs::symlink_metadata(&path).map_err(|error| cleanup_error(&path, error))?;
        if metadata_is_reparse_point(&metadata) {
            return Err(format!(
                "Refusing staging cleanup through a reparse point: {}",
                path.display()
            ));
        }
        if path == plan && metadata.is_file() {
            plan_present = true;
        } else if path == payloads && metadata.is_dir() {
            payload_directory_present = true;
        } else {
            return Err(format!(
                "Refusing staging cleanup because an unknown member is present: {}",
                path.display()
            ));
        }
    }

    let mut payload_files = Vec::new();
    if payload_directory_present {
        for entry in fs::read_dir(&payloads).map_err(|error| cleanup_error(&payloads, error))? {
            let entry = entry.map_err(|error| cleanup_error(&payloads, error))?;
            let path = entry.path();
            let metadata =
                fs::symlink_metadata(&path).map_err(|error| cleanup_error(&path, error))?;
            if !metadata.is_file()
                || metadata_is_reparse_point(&metadata)
                || !is_bounded_payload_name(entry.file_name().to_string_lossy().as_ref())
            {
                return Err(format!(
                    "Refusing staging cleanup because payload member is not a fixed numeric file: {}",
                    path.display()
                ));
            }
            payload_files.push(path);
        }
    }

    for path in payload_files {
        fs::remove_file(&path).map_err(|error| cleanup_error(&path, error))?;
    }
    if payload_directory_present {
        fs::remove_dir(&payloads).map_err(|error| cleanup_error(&payloads, error))?;
    }
    if plan_present {
        fs::remove_file(&plan).map_err(|error| cleanup_error(&plan, error))?;
    }
    fs::remove_dir(directory).map_err(|error| cleanup_error(directory, error))
}

pub(super) fn cleanup_outer_staging(
    staging_root: &Path,
    overlay_sources: &[PathBuf],
    language: &str,
) -> Result<(), String> {
    let root_metadata =
        fs::symlink_metadata(staging_root).map_err(|error| cleanup_error(staging_root, error))?;
    if !root_metadata.is_dir() || metadata_is_reparse_point(&root_metadata) {
        return Err(format!(
            "Refusing cleanup because staging root is not an ordinary directory: {}",
            staging_root.display()
        ));
    }
    let overlay_root = staging_root.join("overlay");
    validate_owned_overlay_sources(&overlay_root, overlay_sources)?;
    for source in overlay_sources {
        if source.parent() != Some(overlay_root.as_path()) {
            continue;
        }
        remove_known_regular_file(source)?;
    }
    remove_known_empty_directory(&overlay_root)?;

    let runtime_marker_root = staging_root.join("runtime-marker");
    let runtime_marker = runtime_marker_root.join(crate::install::LANG_MARKER_NAME);
    match fs::symlink_metadata(&runtime_marker) {
        Ok(metadata) if metadata.is_file() && !metadata_is_reparse_point(&metadata) => {
            let expected = format!("{language}\n");
            if fs::read(&runtime_marker).map_err(|error| cleanup_error(&runtime_marker, error))?
                != expected.as_bytes()
            {
                return Err(format!(
                    "Refusing cleanup because runtime marker content is unknown: {}",
                    runtime_marker.display()
                ));
            }
            fs::remove_file(&runtime_marker)
                .map_err(|error| cleanup_error(&runtime_marker, error))?;
        }
        Ok(_) => {
            return Err(format!(
                "Refusing cleanup because runtime marker is not an ordinary file: {}",
                runtime_marker.display()
            ))
        }
        Err(error) if error.kind() == io::ErrorKind::NotFound => {}
        Err(error) => return Err(cleanup_error(&runtime_marker, error)),
    }
    remove_known_empty_directory(&runtime_marker_root)?;

    fs::remove_dir(staging_root).map_err(|error| cleanup_error(staging_root, error))
}

fn validate_owned_overlay_sources(
    overlay_root: &Path,
    overlay_sources: &[PathBuf],
) -> Result<(), String> {
    for source in overlay_sources {
        if !source.starts_with(overlay_root) {
            continue;
        }
        if source.parent() != Some(overlay_root) || source.file_name().is_none() {
            return Err(format!(
                "Refusing cleanup of a nested or malformed overlay source: {}",
                source.display()
            ));
        }
    }
    Ok(())
}

fn remove_known_regular_file(path: &Path) -> Result<(), String> {
    match fs::symlink_metadata(path) {
        Ok(metadata) if metadata.is_file() && !metadata_is_reparse_point(&metadata) => {
            fs::remove_file(path).map_err(|error| cleanup_error(path, error))
        }
        Ok(_) => Err(format!(
            "Refusing cleanup because known staging source is not an ordinary file: {}",
            path.display()
        )),
        Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(cleanup_error(path, error)),
    }
}

fn remove_known_empty_directory(path: &Path) -> Result<(), String> {
    match fs::symlink_metadata(path) {
        Ok(metadata) if metadata.is_dir() && !metadata_is_reparse_point(&metadata) => {
            fs::remove_dir(path).map_err(|error| cleanup_error(path, error))
        }
        Ok(_) => Err(format!(
            "Refusing cleanup because known staging directory is not ordinary: {}",
            path.display()
        )),
        Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(cleanup_error(path, error)),
    }
}

fn validate_cleanup_root(staging_root: &Path, directory: &Path) -> Result<(), String> {
    let staging_metadata =
        fs::symlink_metadata(staging_root).map_err(|error| cleanup_error(staging_root, error))?;
    if !staging_metadata.is_dir() || metadata_is_reparse_point(&staging_metadata) {
        return Err(format!(
            "Refusing cleanup because staging root is not an ordinary directory: {}",
            staging_root.display()
        ));
    }
    if directory.parent() != Some(staging_root) {
        return Err(format!(
            "Refusing cleanup outside the exact staging root: {}",
            directory.display()
        ));
    }
    let name = directory
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or_else(|| "Refusing cleanup of a non-Unicode plan directory.".to_string())?;
    let nonce = name.strip_prefix(PLAN_DIRECTORY_PREFIX).ok_or_else(|| {
        format!(
            "Refusing cleanup of an unexpected plan directory: {}",
            directory.display()
        )
    })?;
    if nonce.len() != 64
        || !nonce
            .bytes()
            .all(|byte| byte.is_ascii_digit() || matches!(byte, b'a'..=b'f'))
    {
        return Err(format!(
            "Refusing cleanup of a plan directory without a bound nonce: {}",
            directory.display()
        ));
    }
    let metadata =
        fs::symlink_metadata(directory).map_err(|error| cleanup_error(directory, error))?;
    if !metadata.is_dir() || metadata_is_reparse_point(&metadata) {
        return Err(format!(
            "Refusing cleanup because plan directory is not ordinary: {}",
            directory.display()
        ));
    }
    Ok(())
}

fn is_bounded_payload_name(name: &str) -> bool {
    let Some(stem) = name.strip_suffix(".bin") else {
        return false;
    };
    !stem.is_empty()
        && stem.bytes().all(|byte| byte.is_ascii_digit())
        && stem
            .parse::<usize>()
            .is_ok_and(|index| index < MAX_PAYLOAD_RECORDS)
}

fn cleanup_error(path: &Path, error: impl std::fmt::Display) -> String {
    format!(
        "Could not safely clean staging path {}: {error}",
        path.display()
    )
}
