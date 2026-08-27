/**
 * [INPUT]: 依赖 build.rs 编译期嵌入的四语/Windows runtime SHA-256、固定 payload schema、JSON keyed overlay 语义与 QPA transition planner。
 * [OUTPUT]: 提供 worker 写前 provenance 证明；非 English payload 必须等于当前发布的 canonical merge，English payload 保留快照原字节但其解析值必须等于 anchored English postimage，删除计划则从 ACL 保护的 live manifest 精确重建以兼容旧发行残留。
 * [POS]: language_transaction 的只读信任边界；区分“当前包可写字节”与“历史 manifest 可删所有权”，在关闭 Cavalry 与安装根写入前 fail closed。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
use std::{
    fs,
    fs::OpenOptions,
    io::{Read, Take},
    os::windows::fs::OpenOptionsExt,
    path::{Path, PathBuf},
};

use serde_json::Value;
use sha2::{Digest, Sha256};

use super::contract::{
    payload_source_path, ElevatedLanguagePlan, Language, PayloadKind, PayloadRecord,
};
use crate::{
    install::InstallLayout,
    patch::{merge_translation_overlay, to_camel_case, CORE_MAP, PLUGIN_DEFINITION_MAP},
    privilege::windows::known_folders::{
        ensure_no_reparse_points, metadata_is_reparse_point, path_is_within,
    },
    windows_qpa::{
        ActivationRequest, QpaTransitionPlan, RestoreReason, RestoreRequest,
        SUPPORTED_CAVALRY_VERSION,
    },
};

include!(concat!(env!("OUT_DIR"), "/source_provenance_catalog.rs"));

const MAX_PACKAGE_ANCESTORS: usize = 7;
const MAX_JSON_BYTES: usize = 8 * 1024 * 1024;
const MAX_RUNTIME_BYTES: usize = 16 * 1024 * 1024;
const MAX_MARKER_BYTES: usize = 64;
const FILE_FLAG_OPEN_REPARSE_POINT: u32 = 0x0020_0000;
const IMAGE_FILE_MACHINE_AMD64: u16 = 0x8664;
const PE32_PLUS_MAGIC: u16 = 0x020b;
const GENERIC_SOURCE_RELATIVE_PATH: &str = "injector/windows/generic/cavalryi18n.dll";
const QPA_SOURCE_RELATIVE_PATH: &str = "injector/windows/qpa/qwindows.dll";

trait SourceDigestCatalog {
    fn language_digest(&self, relative_path: &str) -> Option<&str>;
    fn generic_digest(&self) -> Option<&str>;
    fn qpa_digest(&self) -> Option<&str>;
}

struct EmbeddedCatalog;

impl SourceDigestCatalog for EmbeddedCatalog {
    fn language_digest(&self, relative_path: &str) -> Option<&str> {
        EMBEDDED_LANGUAGE_SOURCE_SHA256
            .iter()
            .find_map(|(path, digest)| (*path == relative_path).then_some(*digest))
    }

    fn generic_digest(&self) -> Option<&str> {
        EMBEDDED_GENERIC_SHA256
    }

    fn qpa_digest(&self) -> Option<&str> {
        EMBEDDED_QPA_SHA256
    }
}

struct TrustedRuntime {
    generic_path: PathBuf,
    qpa_path: PathBuf,
    generic_bytes: Vec<u8>,
    qpa_bytes: Vec<u8>,
    generic_digest: String,
    qpa_digest: String,
}

pub(crate) fn verify_staged_source_provenance(
    plan: &ElevatedLanguagePlan,
    plan_path: &Path,
    layout: &InstallLayout,
) -> Result<(), String> {
    let worker_executable = std::env::current_exe()
        .map_err(|error| format!("Could not resolve elevated worker executable: {error}"))?;
    verify_with_catalog(
        plan,
        plan_path,
        layout,
        &worker_executable,
        &EmbeddedCatalog,
    )
}

fn verify_with_catalog(
    plan: &ElevatedLanguagePlan,
    plan_path: &Path,
    layout: &InstallLayout,
    worker_executable: &Path,
    catalog: &dyn SourceDigestCatalog,
) -> Result<(), String> {
    let package_root = derive_package_root(worker_executable, plan.language)?;
    let runtime = verify_packaged_runtime(&package_root, catalog)?;
    verify_payload_records(plan, plan_path, layout, &package_root, &runtime, catalog)?;
    verify_qpa_transition(plan, layout, &runtime)
}

fn derive_package_root(worker_executable: &Path, language: Language) -> Result<PathBuf, String> {
    let mut candidate = worker_executable
        .parent()
        .ok_or_else(|| "Elevated worker executable has no package directory.".to_string())?;
    for _ in 0..MAX_PACKAGE_ANCESTORS {
        let language_root = candidate.join("languages").join(language.as_str());
        match fs::symlink_metadata(&language_root) {
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
            Err(error) => {
                return Err(format!(
                    "Could not inspect candidate package language root {}: {error}",
                    language_root.display()
                ))
            }
            Ok(_) => {
                require_ordinary_directory(candidate, candidate, "package root")?;
                require_ordinary_directory(candidate, &language_root, "package language root")?;
                for relative in [GENERIC_SOURCE_RELATIVE_PATH, QPA_SOURCE_RELATIVE_PATH] {
                    let path = candidate.join(relative);
                    require_ordinary_file(candidate, &path, "packaged Windows runtime")?;
                }
                return Ok(candidate.to_path_buf());
            }
        }
        candidate = candidate.parent().ok_or_else(|| {
            "Could not find a package root beside the elevated worker executable.".to_string()
        })?;
    }
    Err("Could not find a bounded package root beside the elevated worker executable.".to_string())
}

fn verify_packaged_runtime(
    package_root: &Path,
    catalog: &dyn SourceDigestCatalog,
) -> Result<TrustedRuntime, String> {
    let generic_digest = catalog
        .generic_digest()
        .ok_or_else(|| "This worker has no compiled generic plugin trust anchor.".to_string())?;
    let qpa_digest = catalog
        .qpa_digest()
        .ok_or_else(|| "This worker has no compiled QPA proxy trust anchor.".to_string())?;
    let generic_path = package_root.join(GENERIC_SOURCE_RELATIVE_PATH);
    let qpa_path = package_root.join(QPA_SOURCE_RELATIVE_PATH);
    let generic_bytes = read_locked_bounded(
        package_root,
        &generic_path,
        MAX_RUNTIME_BYTES,
        "packaged generic plugin",
    )?;
    let qpa_bytes = read_locked_bounded(
        package_root,
        &qpa_path,
        MAX_RUNTIME_BYTES,
        "packaged QPA proxy",
    )?;
    verify_anchored_bytes(&generic_bytes, generic_digest, "packaged generic plugin")?;
    verify_anchored_bytes(&qpa_bytes, qpa_digest, "packaged QPA proxy")?;
    validate_x64_pe_bytes(&generic_bytes, "packaged generic plugin")?;
    validate_x64_pe_bytes(&qpa_bytes, "packaged QPA proxy")?;
    Ok(TrustedRuntime {
        generic_path,
        qpa_path,
        generic_bytes,
        qpa_bytes,
        generic_digest: generic_digest.to_string(),
        qpa_digest: qpa_digest.to_string(),
    })
}

fn verify_payload_records(
    plan: &ElevatedLanguagePlan,
    plan_path: &Path,
    layout: &InstallLayout,
    package_root: &Path,
    runtime: &TrustedRuntime,
    catalog: &dyn SourceDigestCatalog,
) -> Result<(), String> {
    let staging_root = plan_path
        .parent()
        .ok_or_else(|| "Elevated plan path has no staging root.".to_string())?;
    require_ordinary_directory(staging_root, staging_root, "staging root")?;
    for (index, record) in plan.payloads.iter().enumerate() {
        let source = payload_source_path(plan_path, index).map_err(|error| error.to_string())?;
        match record.kind {
            PayloadKind::PendingMarker | PayloadKind::FinalMarker => {
                verify_marker_payload(record, &source, staging_root, plan.language)?;
            }
            PayloadKind::CoreAsset
            | PayloadKind::KnownPluginDefinition
            | PayloadKind::DiscoveredPluginStrings => verify_json_payload(
                record,
                &source,
                staging_root,
                plan.language,
                layout,
                package_root,
                catalog,
            )?,
            PayloadKind::GenericPlugin => verify_runtime_payload(
                record,
                &source,
                staging_root,
                &runtime.generic_bytes,
                &runtime.generic_digest,
                "staged generic plugin",
            )?,
            PayloadKind::QpaProxySource => verify_runtime_payload(
                record,
                &source,
                staging_root,
                &runtime.qpa_bytes,
                &runtime.qpa_digest,
                "staged QPA proxy",
            )?,
        }
    }
    Ok(())
}

fn verify_marker_payload(
    record: &PayloadRecord,
    source: &Path,
    staging_root: &Path,
    language: Language,
) -> Result<(), String> {
    let bytes = read_locked_bounded(staging_root, source, MAX_MARKER_BYTES, "staged marker")?;
    let expected = match record.kind {
        PayloadKind::PendingMarker => b"pending\n".to_vec(),
        PayloadKind::FinalMarker => format!("{}\n", language.as_str()).into_bytes(),
        _ => return Err("Non-marker payload reached marker verification.".to_string()),
    };
    if bytes != expected || sha256_bytes(&bytes) != record.source_sha256 {
        return Err(
            "Staged marker does not match the fixed language transaction bytes.".to_string(),
        );
    }
    Ok(())
}

fn verify_runtime_payload(
    record: &PayloadRecord,
    source: &Path,
    staging_root: &Path,
    packaged_bytes: &[u8],
    embedded_digest: &str,
    label: &str,
) -> Result<(), String> {
    let staged = read_locked_bounded(staging_root, source, MAX_RUNTIME_BYTES, label)?;
    validate_x64_pe_bytes(&staged, label)?;
    if staged != packaged_bytes
        || sha256_bytes(&staged) != embedded_digest
        || record.source_sha256 != embedded_digest
    {
        return Err(format!(
            "{label} does not match the compiled package trust anchor."
        ));
    }
    Ok(())
}

#[allow(clippy::too_many_arguments)]
fn verify_json_payload(
    record: &PayloadRecord,
    source: &Path,
    staging_root: &Path,
    language: Language,
    layout: &InstallLayout,
    package_root: &Path,
    catalog: &dyn SourceDigestCatalog,
) -> Result<(), String> {
    let translation_relative = translation_relative_path(record)?;
    let english_bytes = read_anchored_language_json(
        package_root,
        Language::English,
        &translation_relative,
        catalog,
    )?;
    let translation_bytes =
        read_anchored_language_json(package_root, language, &translation_relative, catalog)?;
    let destination = layout.assets_root.join(Path::new(&record.id));
    let installed_bytes = read_locked_bounded(
        &layout.root,
        &destination,
        MAX_JSON_BYTES,
        "current Cavalry JSON",
    )?;
    let installed: Value = serde_json::from_slice(&installed_bytes)
        .map_err(|error| format!("Current Cavalry JSON is invalid: {error}"))?;
    let english: Value = serde_json::from_slice(&english_bytes)
        .map_err(|error| format!("Packaged English JSON is invalid: {error}"))?;
    let translation: Value = serde_json::from_slice(&translation_bytes)
        .map_err(|error| format!("Packaged language JSON is invalid: {error}"))?;
    let english_baseline = merge_translation_overlay(&installed, &english);
    let staged = read_locked_bounded(
        staging_root,
        source,
        MAX_JSON_BYTES,
        "staged language overlay",
    )?;
    let trusted = if language == Language::English {
        serde_json::from_slice::<Value>(&staged)
            .map_err(|error| format!("Staged English snapshot JSON is invalid: {error}"))?
            == english_baseline
    } else {
        let rebuilt =
            serde_json::to_vec_pretty(&merge_translation_overlay(&english_baseline, &translation))
                .map_err(|error| format!("Could not rebuild trusted language overlay: {error}"))?;
        staged == rebuilt
    };
    if !trusted || sha256_bytes(&staged) != record.source_sha256 {
        return Err(format!(
            "Staged language payload {} is not the trusted target result.",
            record.id
        ));
    }
    Ok(())
}

fn read_anchored_language_json(
    package_root: &Path,
    language: Language,
    relative: &str,
    catalog: &dyn SourceDigestCatalog,
) -> Result<Vec<u8>, String> {
    let catalog_key = format!(
        "languages/{}/{}",
        language.as_str(),
        relative.replace('\\', "/")
    );
    let embedded_digest = catalog.language_digest(&catalog_key).ok_or_else(|| {
        format!("No compiled language source trust anchor exists for {catalog_key}.")
    })?;
    let path = package_root
        .join("languages")
        .join(language.as_str())
        .join(relative);
    let bytes = read_locked_bounded(
        package_root,
        &path,
        MAX_JSON_BYTES,
        "packaged language JSON",
    )?;
    verify_anchored_bytes(&bytes, embedded_digest, "packaged language JSON")?;
    Ok(bytes)
}

fn translation_relative_path(record: &PayloadRecord) -> Result<String, String> {
    match record.kind {
        PayloadKind::CoreAsset => CORE_MAP
            .iter()
            .find_map(|(source, target)| (*target == record.id).then_some((*source).to_string()))
            .ok_or_else(|| format!("Unknown core asset mapping: {}", record.id)),
        PayloadKind::KnownPluginDefinition => PLUGIN_DEFINITION_MAP
            .iter()
            .find_map(|(source, target)| (*target == record.id).then_some((*source).to_string()))
            .ok_or_else(|| format!("Unknown known plugin mapping: {}", record.id)),
        PayloadKind::DiscoveredPluginStrings => {
            let folder = record
                .id
                .strip_prefix("Plugins/")
                .and_then(|value| value.strip_suffix("/strings.json"))
                .filter(|value| !value.is_empty() && !value.contains('/') && !value.contains('\\'))
                .ok_or_else(|| format!("Unknown discovered plugin mapping: {}", record.id))?;
            let camel = to_camel_case(folder);
            if camel.is_empty() {
                return Err(format!("Unknown discovered plugin mapping: {}", record.id));
            }
            Ok(format!("plugins/{camel}.json"))
        }
        _ => Err("Non-JSON payload reached JSON source mapping.".to_string()),
    }
}

fn verify_qpa_transition(
    plan: &ElevatedLanguagePlan,
    layout: &InstallLayout,
    runtime: &TrustedRuntime,
) -> Result<(), String> {
    match (&plan.language, &plan.qpa_transition) {
        (Language::English, QpaTransitionPlan::EnglishRestore(_)) => {
            // English 清理的所有权来自 Program Files ACL 内的 durable manifest；更新后的
            // Switcher 必须能移除旧发行版留下的精确哈希，不能把“当前包哈希”误当成“历史所有权”。
            verify_rebuilt_english_transition(plan, layout, runtime)
        }
        (Language::English, QpaTransitionPlan::Noop(_)) => {
            verify_rebuilt_english_transition(plan, layout, runtime)
        }
        (Language::English, QpaTransitionPlan::Activate(_)) => {
            Err("English source provenance cannot authorize QPA activation.".to_string())
        }
        (_, QpaTransitionPlan::Activate(activation)) => {
            if activation.proxy_qwindows_sha256 != runtime.qpa_digest
                || activation.generic_plugin_sha256 != runtime.generic_digest
            {
                return Err(
                    "QPA activation hashes do not match the compiled runtime trust anchors."
                        .to_string(),
                );
            }
            let mut expected = crate::windows_qpa::build_activation_plan_with_generic_source(
                ActivationRequest {
                    layout,
                    cavalry_version: SUPPORTED_CAVALRY_VERSION,
                    proxy_source: &runtime.qpa_path,
                },
                &runtime.generic_path,
            )?;
            expected.proxy_source_path = activation.proxy_source_path.clone();
            if &expected != activation {
                return Err(
                    "QPA activation plan was not rebuilt from the trusted package runtime."
                        .to_string(),
                );
            }
            Ok(())
        }
        (_, _) => Err("Translated source provenance requires QPA activation.".to_string()),
    }
}

fn verify_rebuilt_english_transition(
    plan: &ElevatedLanguagePlan,
    layout: &InstallLayout,
    runtime: &TrustedRuntime,
) -> Result<(), String> {
    let expected = crate::windows_qpa::build_english_transition(RestoreRequest {
        layout,
        proxy_source: &runtime.qpa_path,
        generic_source: &runtime.generic_path,
        reason: RestoreReason::EnglishSelection,
    })?;
    if expected != plan.qpa_transition {
        return Err(
            "English QPA action was not rebuilt from the trusted package runtime.".to_string(),
        );
    }
    Ok(())
}

fn verify_anchored_bytes(bytes: &[u8], expected: &str, label: &str) -> Result<(), String> {
    if sha256_bytes(bytes) != expected {
        return Err(format!(
            "{label} does not match the digest compiled into this worker."
        ));
    }
    Ok(())
}

fn read_locked_bounded(
    root: &Path,
    path: &Path,
    limit: usize,
    label: &str,
) -> Result<Vec<u8>, String> {
    require_ordinary_file(root, path, label)?;
    let mut file = OpenOptions::new()
        .read(true)
        .share_mode(0)
        .custom_flags(FILE_FLAG_OPEN_REPARSE_POINT)
        .open(path)
        .map_err(|error| format!("Could not open {label} {}: {error}", path.display()))?;
    let metadata = file
        .metadata()
        .map_err(|error| format!("Could not inspect open {label} {}: {error}", path.display()))?;
    if !metadata.is_file() || metadata_is_reparse_point(&metadata) || metadata.len() > limit as u64
    {
        return Err(format!(
            "{label} is not an ordinary bounded file: {}",
            path.display()
        ));
    }
    ensure_no_reparse_points(root, path)?;
    let mut bytes = Vec::with_capacity(metadata.len() as usize);
    read_to_bound(&mut (&mut file).take(limit as u64 + 1), &mut bytes, label)?;
    if bytes.len() > limit || bytes.len() as u64 != metadata.len() {
        return Err(format!("{label} changed or exceeded its byte bound."));
    }
    Ok(bytes)
}

fn read_to_bound(
    reader: &mut Take<&mut fs::File>,
    output: &mut Vec<u8>,
    label: &str,
) -> Result<(), String> {
    reader
        .read_to_end(output)
        .map_err(|error| format!("Could not read {label}: {error}"))?;
    Ok(())
}

fn require_ordinary_directory(root: &Path, path: &Path, label: &str) -> Result<(), String> {
    if !path_is_within(path, root) {
        return Err(format!("{label} escaped its trusted root."));
    }
    ensure_no_reparse_points(root, path)?;
    let metadata = fs::symlink_metadata(path)
        .map_err(|error| format!("Could not inspect {label} {}: {error}", path.display()))?;
    if !metadata.is_dir() || metadata_is_reparse_point(&metadata) {
        return Err(format!("{label} is not an ordinary directory."));
    }
    Ok(())
}

fn require_ordinary_file(root: &Path, path: &Path, label: &str) -> Result<(), String> {
    if !path_is_within(path, root) {
        return Err(format!("{label} escaped its trusted root."));
    }
    ensure_no_reparse_points(root, path)?;
    let metadata = fs::symlink_metadata(path)
        .map_err(|error| format!("Could not inspect {label} {}: {error}", path.display()))?;
    if !metadata.is_file() || metadata_is_reparse_point(&metadata) {
        return Err(format!("{label} is not an ordinary file."));
    }
    Ok(())
}

fn validate_x64_pe_bytes(bytes: &[u8], label: &str) -> Result<(), String> {
    if bytes.len() < 0x40 || &bytes[..2] != b"MZ" {
        return Err(format!("{label} is not a PE image."));
    }
    let pe_offset = read_u32(bytes, 0x3c)? as usize;
    if pe_offset
        .checked_add(26)
        .is_none_or(|minimum| minimum > bytes.len())
        || &bytes[pe_offset..pe_offset + 4] != b"PE\0\0"
        || read_u16(bytes, pe_offset + 4)? != IMAGE_FILE_MACHINE_AMD64
        || read_u16(bytes, pe_offset + 24)? != PE32_PLUS_MAGIC
    {
        return Err(format!("{label} is not an x64 PE32+ image."));
    }
    Ok(())
}

fn read_u16(bytes: &[u8], offset: usize) -> Result<u16, String> {
    let value = bytes
        .get(offset..offset + 2)
        .ok_or_else(|| "PE field is outside the bounded image.".to_string())?;
    Ok(u16::from_le_bytes([value[0], value[1]]))
}

fn read_u32(bytes: &[u8], offset: usize) -> Result<u32, String> {
    let value = bytes
        .get(offset..offset + 4)
        .ok_or_else(|| "PE field is outside the bounded image.".to_string())?;
    Ok(u32::from_le_bytes([value[0], value[1], value[2], value[3]]))
}

fn sha256_bytes(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}

#[cfg(test)]
pub(crate) fn verify_payload_records_for_test(
    plan: &ElevatedLanguagePlan,
    plan_path: &Path,
    layout: &InstallLayout,
    package_root: &Path,
) -> Result<(), String> {
    let runtime = verify_packaged_runtime(package_root, &EmbeddedCatalog)?;
    verify_payload_records(
        plan,
        plan_path,
        layout,
        package_root,
        &runtime,
        &EmbeddedCatalog,
    )
}

#[cfg(test)]
#[path = "source_provenance_tests.rs"]
mod tests;
