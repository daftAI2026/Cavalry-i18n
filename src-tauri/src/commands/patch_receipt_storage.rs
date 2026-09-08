/**
 * [INPUT]: 依赖 patch_receipt 的 manifest/payload 类型、路径安全 helper 与 state generation 常量。
 * [OUTPUT]: 提供 generation 的原子发布、完整校验、目录 durability 与 symlink 边界。
 * [POS]: patch_receipt 的持久化子域；不可覆盖已发布目录，任何失败都不能制造 State receipt。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
use super::{
    file_mode, is_sha256, relative_path_string, required_runtime_paths, runtime_platform_name,
    sha256_hex, validate_relative_path, GenerationManifest, Payload, GENERATIONS_DIR_NAME,
    GENERATION_SCHEMA_VERSION, LANGUAGE_PAYLOAD_ROOT, MANIFEST_FILE_NAME, MAX_FILE_BYTES,
    MAX_GENERATION_FILES, MAX_TOTAL_BYTES,
};
use std::{
    collections::BTreeSet,
    fs::{self, File, OpenOptions},
    io::Write,
    path::{Component, Path, PathBuf},
    sync::atomic::{AtomicU64, Ordering},
    time::{SystemTime, UNIX_EPOCH},
};

static TEMP_COUNTER: AtomicU64 = AtomicU64::new(0);

fn validate_generation_name(generation: &str) -> Result<(), String> {
    if is_sha256(generation) {
        Ok(())
    } else {
        Err("patch generation name must be a 64-character lowercase SHA-256".to_string())
    }
}

pub(super) fn publish_generation(
    state_dir: &Path,
    generation: &str,
    manifest: &GenerationManifest,
    payloads: &[Payload],
) -> Result<(), String> {
    validate_generation_name(generation)?;
    ensure_directory(state_dir, "state")?;
    crate::install::validate_no_symlink_components(state_dir, Path::new(GENERATIONS_DIR_NAME))?;
    let generations_dir = state_dir.join(GENERATIONS_DIR_NAME);
    ensure_directory(&generations_dir, "patch generation")?;
    let final_dir = generations_dir.join(generation);

    match fs::symlink_metadata(&final_dir) {
        Ok(metadata) if metadata.file_type().is_symlink() || !metadata.is_dir() => {
            return Err(format!(
                "refusing non-directory patch generation: {}",
                final_dir.display()
            ));
        }
        Ok(_) => {
            validate_generation_dir(&final_dir, generation, &manifest.language)?;
            return Ok(());
        }
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
        Err(error) => {
            return Err(format!(
                "could not inspect patch generation {}: {error}",
                final_dir.display()
            ))
        }
    }

    let nonce = TEMP_COUNTER.fetch_add(1, Ordering::Relaxed);
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_nanos())
        .unwrap_or_default();
    let temporary = generations_dir.join(format!(".{generation}.{timestamp}.{nonce}.tmp"));
    fs::create_dir(&temporary)
        .map_err(|error| format!("could not create patch generation staging directory: {error}"))?;
    set_private_directory(&temporary)?;

    for payload in payloads {
        write_payload(&temporary, payload)?;
    }
    let manifest_bytes = serde_json::to_vec_pretty(manifest)
        .map_err(|error| format!("could not encode patch generation manifest: {error}"))?;
    write_new_file(&temporary, MANIFEST_FILE_NAME, &manifest_bytes, None)?;
    sync_directory(&temporary)?;

    match fs::rename(&temporary, &final_dir) {
        Ok(()) => {
            sync_directory(&generations_dir)?;
            Ok(())
        }
        Err(error) => {
            // 另一事务可能已经发布同一个不可变 generation；绝不替换目录，只在完整验证通过后接受。
            match fs::symlink_metadata(&final_dir) {
                Ok(metadata) if metadata.file_type().is_symlink() || !metadata.is_dir() => {
                    Err(format!(
                        "refusing conflicting patch generation {}: {error}",
                        final_dir.display()
                    ))
                }
                Ok(_) => validate_generation_dir(&final_dir, generation, &manifest.language),
                Err(_) => Err(format!(
                    "could not publish patch generation {}: {error}",
                    final_dir.display()
                )),
            }
        }
    }
}

fn write_payload(root: &Path, payload: &Payload) -> Result<(), String> {
    let parent = Path::new(&payload.path)
        .parent()
        .unwrap_or_else(|| Path::new("."));
    validate_relative_path(parent.to_string_lossy().as_ref())?;
    ensure_relative_directory(root, parent)?;
    write_new_file(root, &payload.path, &payload.bytes, payload.mode)
}

fn write_new_file(
    root: &Path,
    relative: &str,
    bytes: &[u8],
    mode: Option<u32>,
) -> Result<(), String> {
    validate_relative_path(relative)?;
    let path = root.join(relative);
    let mut file = OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&path)
        .map_err(|error| {
            format!(
                "could not create patch generation file {}: {error}",
                path.display()
            )
        })?;
    file.write_all(bytes).map_err(|error| {
        format!(
            "could not write patch generation file {}: {error}",
            path.display()
        )
    })?;
    file.sync_all().map_err(|error| {
        format!(
            "could not fsync patch generation file {}: {error}",
            path.display()
        )
    })?;
    #[cfg(unix)]
    if let Some(mode) = mode {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(&path, fs::Permissions::from_mode(mode & 0o7777)).map_err(|error| {
            format!(
                "could not preserve patch generation mode {}: {error}",
                path.display()
            )
        })?;
    }
    Ok(())
}

fn ensure_relative_directory(root: &Path, relative: &Path) -> Result<(), String> {
    let mut current = root.to_path_buf();
    for component in relative.components() {
        let Component::Normal(name) = component else {
            return Err(format!(
                "unsafe patch generation relative path: {}",
                relative.display()
            ));
        };
        current.push(name);
        match fs::create_dir(&current) {
            Ok(()) => set_private_directory(&current)?,
            Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => {
                let metadata = fs::symlink_metadata(&current).map_err(|inspect| {
                    format!(
                        "could not inspect patch generation directory {}: {inspect}",
                        current.display()
                    )
                })?;
                if metadata.file_type().is_symlink() || !metadata.is_dir() {
                    return Err(format!(
                        "refusing unsafe patch generation directory: {}",
                        current.display()
                    ));
                }
            }
            Err(error) => {
                return Err(format!(
                    "could not create patch generation directory {}: {error}",
                    current.display()
                ))
            }
        }
    }
    Ok(())
}

pub(super) fn validate_generation_dir(
    root: &Path,
    expected_generation: &str,
    language: &str,
) -> Result<(), String> {
    validate_generation_name(expected_generation)?;
    let metadata = fs::symlink_metadata(root).map_err(|error| {
        format!(
            "could not inspect patch generation {}: {error}",
            root.display()
        )
    })?;
    if metadata.file_type().is_symlink() || !metadata.is_dir() {
        return Err(format!(
            "patch generation is not a real directory: {}",
            root.display()
        ));
    }
    let manifest_path = root.join(MANIFEST_FILE_NAME);
    let manifest_metadata = fs::symlink_metadata(&manifest_path)
        .map_err(|error| format!("patch generation manifest is missing: {error}"))?;
    if manifest_metadata.file_type().is_symlink() || !manifest_metadata.is_file() {
        return Err("patch generation manifest is not a regular file".to_string());
    }
    let manifest_bytes = fs::read(&manifest_path)
        .map_err(|error| format!("could not read patch generation manifest: {error}"))?;
    if sha256_hex(&manifest_bytes) != expected_generation {
        return Err("patch generation manifest hash does not match its receipt".to_string());
    }
    let manifest: GenerationManifest = serde_json::from_slice(&manifest_bytes)
        .map_err(|error| format!("patch generation manifest is invalid: {error}"))?;
    validate_manifest_shape(&manifest, language)?;

    let mut listed = BTreeSet::new();
    let mut total_bytes = 0_u64;
    for file in &manifest.files {
        if !listed.insert(file.path.clone()) {
            return Err(format!("patch generation manifest repeats {}", file.path));
        }
        crate::install::validate_no_symlink_components(root, Path::new(&file.path))?;
        let path = root.join(&file.path);
        let metadata = fs::symlink_metadata(&path).map_err(|error| {
            format!("patch generation payload {} is missing: {error}", file.path)
        })?;
        if metadata.file_type().is_symlink() || !metadata.is_file() {
            return Err(format!(
                "patch generation payload is not a regular file: {}",
                file.path
            ));
        }
        let bytes = fs::read(&path).map_err(|error| {
            format!(
                "could not read patch generation payload {}: {error}",
                file.path
            )
        })?;
        if u64::try_from(bytes.len()).ok() != Some(file.bytes) || sha256_hex(&bytes) != file.sha256
        {
            return Err(format!(
                "patch generation payload digest mismatch: {}",
                file.path
            ));
        }
        total_bytes = total_bytes
            .checked_add(file.bytes)
            .ok_or_else(|| "patch generation total length overflow".to_string())?;
        if let Some(expected_mode) = file.mode {
            if file_mode(&metadata) != Some(expected_mode) {
                return Err(format!("patch generation mode mismatch: {}", file.path));
            }
        }
    }
    if total_bytes > MAX_TOTAL_BYTES {
        return Err("patch generation exceeds its total size limit".to_string());
    }

    let mut actual = BTreeSet::new();
    collect_generation_files(root, Path::new(""), &mut actual)?;
    if actual != listed {
        return Err("patch generation contains an unmanifested or missing payload".to_string());
    }
    Ok(())
}

fn collect_generation_files(
    root: &Path,
    relative_root: &Path,
    files: &mut BTreeSet<String>,
) -> Result<(), String> {
    let mut entries = fs::read_dir(root)
        .map_err(|error| {
            format!(
                "could not enumerate patch generation {}: {error}",
                root.display()
            )
        })?
        .map(|entry| entry.map(|entry| entry.path()))
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| {
            format!(
                "could not enumerate patch generation {}: {error}",
                root.display()
            )
        })?;
    entries.sort();
    for path in entries {
        let name = path
            .file_name()
            .and_then(|name| name.to_str())
            .ok_or_else(|| {
                format!(
                    "patch generation path is not valid UTF-8: {}",
                    path.display()
                )
            })?;
        if relative_root.as_os_str().is_empty() && name == MANIFEST_FILE_NAME {
            continue;
        }
        let relative = relative_root.join(name);
        let metadata = fs::symlink_metadata(&path).map_err(|error| {
            format!(
                "could not inspect patch generation path {}: {error}",
                path.display()
            )
        })?;
        if metadata.file_type().is_symlink() {
            return Err(format!(
                "refusing symlink in patch generation: {}",
                path.display()
            ));
        }
        if metadata.is_dir() {
            collect_generation_files(&path, &relative, files)?;
        } else if metadata.is_file() {
            files.insert(relative_path_string(&relative)?);
        } else {
            return Err(format!(
                "refusing special file in patch generation: {}",
                path.display()
            ));
        }
    }
    Ok(())
}

pub(super) fn validate_manifest_shape(
    manifest: &GenerationManifest,
    language: &str,
) -> Result<(), String> {
    if manifest.schema_version != GENERATION_SCHEMA_VERSION {
        return Err(format!(
            "unsupported patch generation schema: {}",
            manifest.schema_version
        ));
    }
    if manifest.language != language {
        return Err("patch generation language does not match its receipt".to_string());
    }
    if manifest.runtime_platform != runtime_platform_name() {
        return Err("patch generation platform does not match this Switcher build".to_string());
    }
    if manifest.switcher_version.trim().is_empty() {
        return Err("patch generation switcher version is empty".to_string());
    }
    if manifest.files.is_empty() || manifest.files.len() > MAX_GENERATION_FILES {
        return Err("patch generation manifest has an invalid file count".to_string());
    }
    let language_prefix = format!("{LANGUAGE_PAYLOAD_ROOT}/{language}/");
    let required = required_runtime_paths();
    let mut has_language = false;
    for file in &manifest.files {
        validate_relative_path(&file.path)?;
        if file.path.starts_with(&language_prefix) {
            has_language = true;
        } else if !required.iter().any(|path| *path == file.path) {
            return Err(format!(
                "patch generation contains an unexpected path: {}",
                file.path
            ));
        }
        if file.bytes > MAX_FILE_BYTES || !is_sha256(&file.sha256) {
            return Err(format!(
                "patch generation file identity is invalid: {}",
                file.path
            ));
        }
    }
    if !has_language
        || required
            .iter()
            .any(|path| !manifest.files.iter().any(|file| file.path == *path))
    {
        return Err("patch generation is missing a language or runtime payload".to_string());
    }
    Ok(())
}

pub(super) fn generation_path(state_dir: &Path, generation: &str) -> Result<PathBuf, String> {
    validate_generation_name(generation)?;
    require_directory(state_dir, "state")?;
    crate::install::validate_no_symlink_components(state_dir, Path::new(GENERATIONS_DIR_NAME))?;
    let generations_dir = state_dir.join(GENERATIONS_DIR_NAME);
    require_directory(&generations_dir, "patch generation")?;
    let generation_path = generations_dir.join(generation);
    match fs::symlink_metadata(&generation_path) {
        Ok(metadata) if metadata.file_type().is_symlink() || !metadata.is_dir() => Err(format!(
            "refusing unsafe patch generation directory: {}",
            generation_path.display()
        )),
        Ok(_) => Ok(generation_path),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Err(format!(
            "patch generation is unavailable: {}",
            generation_path.display()
        )),
        Err(error) => Err(format!(
            "could not inspect patch generation {}: {error}",
            generation_path.display()
        )),
    }
}

fn require_directory(path: &Path, role: &str) -> Result<(), String> {
    let metadata = fs::symlink_metadata(path).map_err(|error| {
        format!(
            "could not inspect {role} directory {}: {error}",
            path.display()
        )
    })?;
    if metadata.file_type().is_symlink() || !metadata.is_dir() {
        return Err(format!(
            "refusing unsafe {role} directory: {}",
            path.display()
        ));
    }
    Ok(())
}

fn ensure_directory(path: &Path, role: &str) -> Result<(), String> {
    match fs::symlink_metadata(path) {
        Ok(metadata) if metadata.file_type().is_symlink() || !metadata.is_dir() => Err(format!(
            "refusing unsafe {role} directory: {}",
            path.display()
        )),
        Ok(_) => Ok(()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            fs::create_dir_all(path).map_err(|error| {
                format!(
                    "could not create {role} directory {}: {error}",
                    path.display()
                )
            })?;
            let metadata = fs::symlink_metadata(path).map_err(|error| error.to_string())?;
            if metadata.file_type().is_symlink() || !metadata.is_dir() {
                return Err(format!(
                    "refusing unsafe {role} directory: {}",
                    path.display()
                ));
            }
            set_private_directory(path)
        }
        Err(error) => Err(format!(
            "could not inspect {role} directory {}: {error}",
            path.display()
        )),
    }
}

fn set_private_directory(path: &Path) -> Result<(), String> {
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(path, fs::Permissions::from_mode(0o700)).map_err(|error| {
            format!(
                "could not restrict patch generation directory {}: {error}",
                path.display()
            )
        })?;
    }
    Ok(())
}

fn sync_directory(path: &Path) -> Result<(), String> {
    #[cfg(unix)]
    {
        File::open(path)
            .and_then(|file| file.sync_all())
            .map_err(|error| {
                format!(
                    "could not fsync patch generation directory {}: {error}",
                    path.display()
                )
            })?;
    }
    Ok(())
}
