/**
 * [INPUT]: 依赖语言资源目录、平台 runtime 打包源、安装根 identity 与 state 目录。
 * [OUTPUT]: 提供内容寻址 patch generation 的发布、严格加载、desired fingerprint，以及旧语言/runtime source 的受控相对路径。
 * [POS]: commands 的历史补丁证据层；只在成功 apply 之后由调用方把 receipt 写入 State，generation 自身不可覆盖且不把当前包版本当作旧 source 的加载条件。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
use crate::{
    install::{canonical_root_for_selection, InstallLayout},
    state::AppliedPatchReceipt,
};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    collections::BTreeSet,
    fs,
    path::{Component, Path, PathBuf},
};

const GENERATIONS_DIR_NAME: &str = "patch-generations";
const MANIFEST_FILE_NAME: &str = "manifest.json";
const GENERATION_SCHEMA_VERSION: u32 = 1;
const MAX_GENERATION_FILES: usize = 4096;
const MAX_FILE_BYTES: u64 = 128 * 1024 * 1024;
const MAX_TOTAL_BYTES: u64 = 256 * 1024 * 1024;

pub(crate) const LANGUAGE_PAYLOAD_ROOT: &str = "languages";
#[cfg(target_os = "macos")]
pub(crate) const MACOS_INJECTOR_PAYLOAD: &str = "injector/libCavalryTranslatorInjector.dylib";
#[cfg(target_os = "macos")]
pub(crate) const MACOS_WRAPPER_PAYLOAD: &str = "runtime/CavalryLauncher";
#[cfg(target_os = "windows")]
pub(crate) const WINDOWS_GENERIC_PAYLOAD: &str = "injector/windows/generic/cavalryi18n.dll";
#[cfg(target_os = "windows")]
pub(crate) const WINDOWS_QPA_PAYLOAD: &str = "injector/windows/qpa/qwindows.dll";

#[path = "patch_receipt_storage.rs"]
mod storage;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct GenerationManifest {
    schema_version: u32,
    language: String,
    runtime_platform: String,
    /// Switcher 包版本属于 generation 身份；补丁算法变化时不会静默复用旧 source，
    /// 但已提交回执的加载不依赖当前运行包版本。
    switcher_version: String,
    files: Vec<GenerationFile>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct GenerationFile {
    path: String,
    bytes: u64,
    sha256: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    mode: Option<u32>,
}

struct Payload {
    path: String,
    bytes: Vec<u8>,
    mode: Option<u32>,
}

/// 发布成功 apply 使用的精确非 English source 输入。
///
/// English 没有 patch receipt：它是恢复基线，不是翻译 source generation。本函数只发布不可变
/// generation；调用方必须在平台事务提交后才把返回回执写入 State。
pub(crate) fn prepare(
    repo_root: &Path,
    state_dir: &Path,
    resource_dir: &Path,
    app_path: &Path,
    revision: &str,
    language: &str,
) -> Result<Option<AppliedPatchReceipt>, String> {
    if language == "en" {
        return Ok(None);
    }
    validate_language(language)?;
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        // Linux 等 vendor-free 测试宿主没有可持久化的平台 runtime；不伪造 current receipt，
        // 让既有 apply fixture 继续使用打包 source，状态查询保持 unknown。
        let _ = (repo_root, state_dir, resource_dir, app_path, revision);
        return Ok(None);
    }
    if revision.trim().is_empty() {
        return Err(
            "cannot publish an applied patch receipt without a Cavalry revision".to_string(),
        );
    }

    let layout = layout_for_receipt(app_path)?;
    let (manifest, payloads) = build_manifest(repo_root, resource_dir, &layout, language)?;
    let generation = manifest_generation(&manifest)?;
    storage::publish_generation(state_dir, &generation, &manifest, &payloads)?;

    Ok(Some(AppliedPatchReceipt {
        install_root: layout.root.to_string_lossy().into_owned(),
        cavalry_revision: revision.to_string(),
        language: language.to_string(),
        generation,
    }))
}

/// 检查全部身份绑定与 payload 摘要后加载已提交 source generation。这里刻意不读取当前
/// Switcher 包版本：升级后的 Switcher 必须能用创建旧 postimage 的 source 完成证明。
pub(crate) fn load_source(
    state_dir: &Path,
    receipt: &AppliedPatchReceipt,
    app_path: &Path,
    revision: &str,
    language: &str,
) -> Result<PathBuf, String> {
    validate_language(language)?;
    validate_receipt_shape(receipt)?;
    if receipt.language != language {
        return Err(format!(
            "applied patch receipt language {} does not match requested language {language}",
            receipt.language
        ));
    }
    if receipt.cavalry_revision != revision {
        return Err(
            "applied patch receipt revision does not match the selected Cavalry installation"
                .to_string(),
        );
    }

    let layout = layout_for_receipt(app_path)?;
    let install_root = layout.root.to_string_lossy();
    if receipt.install_root != install_root {
        return Err(
            "applied patch receipt is bound to a different Cavalry installation root".to_string(),
        );
    }
    let generation_root = storage::generation_path(state_dir, &receipt.generation)?;
    storage::validate_generation_dir(&generation_root, &receipt.generation, language)?;
    Ok(generation_root)
}

/// 返回当前包为该安装与语言发布的内容地址。与 [`load_source`] 不同，本函数读取当前打包输入。
pub(crate) fn desired_generation(
    repo_root: &Path,
    resource_dir: &Path,
    app_path: &Path,
    language: &str,
) -> Result<String, String> {
    validate_language(language)?;
    let layout = layout_for_receipt(app_path)?;
    let (manifest, _) = build_manifest(repo_root, resource_dir, &layout, language)?;
    manifest_generation(&manifest)
}

fn validate_language(language: &str) -> Result<(), String> {
    if matches!(language, "zh-Hans" | "zh-Hant" | "ja_JP") {
        Ok(())
    } else if language == "en" {
        Err("English does not have an applied patch generation".to_string())
    } else {
        Err(format!("unsupported patch receipt language: {language}"))
    }
}

fn validate_receipt_shape(receipt: &AppliedPatchReceipt) -> Result<(), String> {
    if receipt.install_root.trim().is_empty() {
        return Err("applied patch receipt installRoot is empty".to_string());
    }
    if receipt.cavalry_revision.trim().is_empty() {
        return Err("applied patch receipt cavalryRevision is empty".to_string());
    }
    if !matches!(receipt.language.as_str(), "zh-Hans" | "zh-Hant" | "ja_JP") {
        return Err(format!(
            "applied patch receipt language is unsupported: {}",
            receipt.language
        ));
    }
    if !is_sha256(&receipt.generation) {
        return Err(
            "applied patch receipt generation must be a 64-character lowercase SHA-256".to_string(),
        );
    }
    Ok(())
}

fn layout_for_receipt(app_path: &Path) -> Result<InstallLayout, String> {
    let root = canonical_root_for_selection(app_path)?;
    let layout = InstallLayout::from_root(&root);
    let expected = compiled_platform();
    if Some(layout.platform) != expected {
        return Err(
            "selected Cavalry installation platform does not match this Switcher build".to_string(),
        );
    }
    Ok(layout)
}

fn build_manifest(
    repo_root: &Path,
    resource_dir: &Path,
    layout: &InstallLayout,
    language: &str,
) -> Result<(GenerationManifest, Vec<Payload>), String> {
    let mut payloads = Vec::new();
    let language_dir = super::context::language_source_dir(repo_root, resource_dir, language);
    collect_language_payloads(&language_dir, language, &mut payloads)?;

    #[cfg(target_os = "macos")]
    {
        let injector = crate::mac_runtime::injector_source_path(repo_root, resource_dir)?;
        payloads.push(read_payload(
            &injector,
            MACOS_INJECTOR_PAYLOAD,
            "macOS translator injector",
        )?);
        payloads.push(Payload {
            path: MACOS_WRAPPER_PAYLOAD.to_string(),
            bytes: crate::mac_runtime::build_launch_wrapper().into_bytes(),
            mode: Some(0o755),
        });
    }

    #[cfg(target_os = "windows")]
    {
        let generic = crate::windows_runtime::resolve_plugin_source(resource_dir, repo_root)?;
        let qpa = crate::windows_runtime::resolve_qpa_proxy_source(resource_dir, repo_root)?;
        payloads.push(read_payload(
            &generic,
            WINDOWS_GENERIC_PAYLOAD,
            "Windows generic translator",
        )?);
        payloads.push(read_payload(
            &qpa,
            WINDOWS_QPA_PAYLOAD,
            "Windows QPA proxy",
        )?);
    }

    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        let _ = layout;
        return Err(
            "patch receipt generations are supported only on macOS and Windows".to_string(),
        );
    }

    let _ = layout;
    payloads.sort_by(|left, right| left.path.cmp(&right.path));
    let mut seen = BTreeSet::new();
    let mut total_bytes = 0_u64;
    let files = payloads
        .iter()
        .map(|payload| {
            if !seen.insert(payload.path.clone()) {
                return Err(format!("duplicate patch generation path: {}", payload.path));
            }
            let bytes = u64::try_from(payload.bytes.len())
                .map_err(|_| "patch generation file length overflow".to_string())?;
            if bytes > MAX_FILE_BYTES {
                return Err(format!(
                    "patch generation file is too large: {}",
                    payload.path
                ));
            }
            total_bytes = total_bytes
                .checked_add(bytes)
                .ok_or_else(|| "patch generation total length overflow".to_string())?;
            Ok(GenerationFile {
                path: payload.path.clone(),
                bytes,
                sha256: sha256_hex(&payload.bytes),
                mode: payload.mode,
            })
        })
        .collect::<Result<Vec<_>, String>>()?;
    if files.len() > MAX_GENERATION_FILES {
        return Err("patch generation contains too many files".to_string());
    }
    if total_bytes > MAX_TOTAL_BYTES {
        return Err("patch generation exceeds its total size limit".to_string());
    }

    let manifest = GenerationManifest {
        schema_version: GENERATION_SCHEMA_VERSION,
        language: language.to_string(),
        runtime_platform: runtime_platform_name().to_string(),
        switcher_version: env!("CARGO_PKG_VERSION").to_string(),
        files,
    };
    storage::validate_manifest_shape(&manifest, language)?;
    Ok((manifest, payloads))
}

fn collect_language_payloads(
    source_root: &Path,
    language: &str,
    payloads: &mut Vec<Payload>,
) -> Result<(), String> {
    let metadata = fs::symlink_metadata(source_root).map_err(|error| {
        format!(
            "could not inspect packaged language source {}: {error}",
            source_root.display()
        )
    })?;
    if metadata.file_type().is_symlink() || !metadata.is_dir() {
        return Err(format!(
            "packaged language source is not a real directory: {}",
            source_root.display()
        ));
    }
    collect_directory(
        source_root,
        Path::new(LANGUAGE_PAYLOAD_ROOT).join(language),
        payloads,
    )
}

fn collect_directory(
    source_root: &Path,
    relative_root: PathBuf,
    payloads: &mut Vec<Payload>,
) -> Result<(), String> {
    let mut entries = fs::read_dir(source_root)
        .map_err(|error| {
            format!(
                "could not read source directory {}: {error}",
                source_root.display()
            )
        })?
        .map(|entry| entry.map(|entry| entry.path()))
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| {
            format!(
                "could not enumerate source directory {}: {error}",
                source_root.display()
            )
        })?;
    entries.sort();
    for path in entries {
        let name = path
            .file_name()
            .and_then(|name| name.to_str())
            .ok_or_else(|| format!("source path is not valid UTF-8: {}", path.display()))?;
        let relative = relative_root.join(name);
        let metadata = fs::symlink_metadata(&path).map_err(|error| {
            format!("could not inspect source path {}: {error}", path.display())
        })?;
        if metadata.file_type().is_symlink() {
            return Err(format!(
                "refusing symlink in patch generation source: {}",
                path.display()
            ));
        }
        if metadata.is_dir() {
            collect_directory(&path, relative, payloads)?;
        } else if metadata.is_file() {
            if payloads.len() >= MAX_GENERATION_FILES {
                return Err("patch generation contains too many language files".to_string());
            }
            let path_text = relative_path_string(&relative)?;
            payloads.push(read_payload(&path, &path_text, "language source")?);
        } else {
            return Err(format!(
                "refusing special file in patch generation source: {}",
                path.display()
            ));
        }
    }
    Ok(())
}

fn read_payload(path: &Path, relative: &str, role: &str) -> Result<Payload, String> {
    validate_relative_path(relative)?;
    let metadata = fs::symlink_metadata(path)
        .map_err(|error| format!("could not inspect {role} {}: {error}", path.display()))?;
    if metadata.file_type().is_symlink() || !metadata.is_file() {
        return Err(format!("{role} is not a regular file: {}", path.display()));
    }
    let length = metadata.len();
    if length > MAX_FILE_BYTES {
        return Err(format!("{role} is too large: {}", path.display()));
    }
    let bytes = fs::read(path)
        .map_err(|error| format!("could not read {role} {}: {error}", path.display()))?;
    if u64::try_from(bytes.len()).ok() != Some(length) {
        return Err(format!(
            "{role} changed while it was being captured: {}",
            path.display()
        ));
    }
    Ok(Payload {
        path: relative.to_string(),
        bytes,
        mode: file_mode(&metadata),
    })
}

fn manifest_generation(manifest: &GenerationManifest) -> Result<String, String> {
    let bytes = serde_json::to_vec_pretty(manifest)
        .map_err(|error| format!("could not encode patch generation identity: {error}"))?;
    Ok(sha256_hex(&bytes))
}

fn validate_relative_path(path: &str) -> Result<(), String> {
    if path.is_empty() || path.contains('\\') {
        return Err(format!("unsafe patch generation relative path: {path}"));
    }
    let path = Path::new(path);
    if path.is_absolute() {
        return Err(format!("unsafe absolute patch generation path: {path:?}"));
    }
    for component in path.components() {
        if !matches!(component, Component::Normal(_)) {
            return Err(format!("unsafe patch generation relative path: {path:?}"));
        }
    }
    Ok(())
}

fn relative_path_string(path: &Path) -> Result<String, String> {
    let mut components = Vec::new();
    for component in path.components() {
        let Component::Normal(name) = component else {
            return Err(format!("unsafe patch generation relative path: {path:?}"));
        };
        let name = name
            .to_str()
            .ok_or_else(|| format!("patch generation path is not valid UTF-8: {path:?}"))?;
        components.push(name);
    }
    let result = components.join("/");
    validate_relative_path(&result)?;
    Ok(result)
}

fn sha256_hex(bytes: &[u8]) -> String {
    let digest = Sha256::digest(bytes);
    digest.iter().map(|byte| format!("{byte:02x}")).collect()
}

fn is_sha256(value: &str) -> bool {
    value.len() == 64
        && value
            .bytes()
            .all(|byte| byte.is_ascii_digit() || matches!(byte, b'a'..=b'f'))
}

fn file_mode(metadata: &fs::Metadata) -> Option<u32> {
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        Some(metadata.permissions().mode() & 0o7777)
    }
    #[cfg(not(unix))]
    {
        let _ = metadata;
        None
    }
}

fn required_runtime_paths() -> &'static [&'static str] {
    #[cfg(target_os = "macos")]
    {
        &[MACOS_INJECTOR_PAYLOAD, MACOS_WRAPPER_PAYLOAD]
    }
    #[cfg(target_os = "windows")]
    {
        &[WINDOWS_GENERIC_PAYLOAD, WINDOWS_QPA_PAYLOAD]
    }
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        &[]
    }
}

fn runtime_platform_name() -> &'static str {
    #[cfg(target_os = "macos")]
    {
        "macos"
    }
    #[cfg(target_os = "windows")]
    {
        "windows"
    }
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        "unsupported"
    }
}

fn compiled_platform() -> Option<crate::install::InstallPlatform> {
    #[cfg(target_os = "macos")]
    {
        Some(crate::install::InstallPlatform::Macos)
    }
    #[cfg(target_os = "windows")]
    {
        Some(crate::install::InstallPlatform::Windows)
    }
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        None
    }
}

#[cfg(test)]
#[path = "patch_receipt_tests.rs"]
mod tests;
