/**
 * [INPUT]: 依赖 install::InstallLayout、serde_json 与 std fs/path，读取 Cavalry 跨平台 assets
 * [OUTPUT]: 对外提供无路径碰撞的资源映射、逐组件 lstat 的 macOS asset 安全门、hash-manifest English immutable generations/原子指针、严格复制计划与只替换字符串且保留安装元数据/版本增量的覆盖合并计划
 * [POS]: src-tauri/src 的 JSON patch 核心，以 exact asset identity、无 symlink regular-file 门、Windows 可写 durability handle、current/prev 缺失与损坏区分及 string-only keyed overlay 同时守住 clean-English 恢复材料及当前/未来 Cavalry 安装元数据
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
use std::{
    collections::{HashMap, HashSet},
    fs::{self, OpenOptions},
    io::Write,
    path::{Path, PathBuf},
    sync::atomic::{AtomicU64, Ordering},
};

#[cfg(unix)]
use std::fs::File;
#[cfg(unix)]
use std::os::unix::fs::{OpenOptionsExt, PermissionsExt};

use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};

use crate::{
    install::{validate_no_symlink_components, InstallLayout, InstallPlatform},
    state::EnglishSnapshotProvenance,
};

/// Static map of all non-plugin file pairs.
/// Each tuple: (language_relative_path, asset_relative_path)
/// relative to `languages/{lang}/` and `Contents/assets/` respectively.
pub const CORE_MAP: [(&str, &str); 14] = [
    ("appStrings.json", "Definitions/appStrings.json"),
    ("nodeStrings.json", "Definitions/nodeStrings.json"),
    ("onboarding.json", "Learn/onboarding.json"),
    ("tips.json", "Learn/tips.json"),
    (
        "Definitions/nodeDefinitions.json",
        "Definitions/nodeDefinitions.json",
    ),
    (
        "Definitions/systemPresets.json",
        "Definitions/systemPresets.json",
    ),
    ("Learn/Guides/guides.json", "Learn/Guides/guides.json"),
    ("Learn/Guides/strings.json", "Learn/Guides/strings.json"),
    (
        "MetaData/api_function_metadata.json",
        "MetaData/api_function_metadata.json",
    ),
    (
        "MetaData/core_api_function_metadata.json",
        "MetaData/core_api_function_metadata.json",
    ),
    (
        "MetaData/gui_api_function_metadata.json",
        "MetaData/gui_api_function_metadata.json",
    ),
    (
        "MetaData/widget_api_function_metadata.json",
        "MetaData/widget_api_function_metadata.json",
    ),
    ("Style/layout.json", "Style/layout.json"),
    ("Style/theme.json", "Style/theme.json"),
];

/// Static map of known plugin definition file pairs.
/// Each tuple: (language_relative_path, asset_relative_path)
pub const PLUGIN_DEFINITION_MAP: [(&str, &str); 12] = [
    (
        "plugins/bilateralBlurFilterDefinitions.json",
        "Plugins/Bilateral Blur Filter/definitions.json",
    ),
    (
        "plugins/boxBlurFilterDefinitions.json",
        "Plugins/Box Blur Filter/definitions.json",
    ),
    (
        "plugins/bulgeFilterDefinitions.json",
        "Plugins/Bulge Filter/definitions.json",
    ),
    (
        "plugins/chromaKeyFilterDefinitions.json",
        "Plugins/Chroma Key Filter/definitions.json",
    ),
    (
        "plugins/directionalBlurFilterDefinitions.json",
        "Plugins/Directional Blur Filter/definitions.json",
    ),
    (
        "plugins/erosionFilterDefinitions.json",
        "Plugins/Erosion Filter/definitions.json",
    ),
    (
        "plugins/gaussianBlurFilterDefinitions.json",
        "Plugins/Gaussian Blur Filter/definitions.json",
    ),
    (
        "plugins/grainFilterDefinitions.json",
        "Plugins/Grain Filter/definitions.json",
    ),
    (
        "plugins/lightSweepFilterDefinitions.json",
        "Plugins/Light Sweep Filter/definitions.json",
    ),
    (
        "plugins/polarCoordinatesFilterDefinitions.json",
        "Plugins/Polar Coordinates Filter/definitions.json",
    ),
    (
        "plugins/spheriseFilterDefinitions.json",
        "Plugins/Spherise Filter/definitions.json",
    ),
    (
        "plugins/zoomBlurFilterDefinitions.json",
        "Plugins/Zoom Blur Filter/definitions.json",
    ),
];

pub const ENGLISH_SNAPSHOT_MANIFEST_NAME: &str = "manifest.json";
pub const ENGLISH_SNAPSHOT_SCHEMA_VERSION: u32 = 2;
const ENGLISH_SNAPSHOT_LEGACY_SCHEMA_VERSION: u32 = 1;
const ENGLISH_GENERATIONS_DIRECTORY: &str = "english-snapshots/generations";
const ENGLISH_CURRENT_POINTER: &str = "english-snapshots/current.json";
const ENGLISH_PREVIOUS_POINTER: &str = "english-snapshots/current.json.prev";
const ENGLISH_POINTER_SCHEMA_VERSION: u32 = 1;
static SNAPSHOT_GENERATION_SEQUENCE: AtomicU64 = AtomicU64::new(0);

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PluginInfo {
    pub folder_name: String,
    pub camel_name: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CopyPair {
    pub src: PathBuf,
    pub dst: PathBuf,
}

/// Exact destination preimage evidence for the outer transaction.  The digest covers the bytes
/// that must be present immediately before mutation; `unix_mode` is populated for macOS and is
/// deliberately kept optional so Windows callers retain their historical semantic-only API.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AssetPreimageEvidence {
    pub destination: PathBuf,
    pub sha256: String,
    pub unix_mode: Option<u32>,
}

/// A snapshot identity is deliberately expressed in terms of both sides of the mapping.  The
/// language path remains the historical camel-case path for the four packaged languages, while
/// the exact Cavalry-relative asset path is recorded so it is never the sole basename/stem key.
#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
#[serde(deny_unknown_fields)]
pub struct EnglishSnapshotEntry {
    pub language_relative_path: String,
    pub asset_relative_path: String,
    pub sha256: String,
    /// Original regular-file Unix mode. Windows captures omit this field and retain the
    /// historical content/hash-only semantics; macOS restore requires it before producing a
    /// writable pair.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub unix_mode: Option<u32>,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
#[serde(deny_unknown_fields)]
pub struct EnglishSnapshotManifest {
    pub schema_version: u32,
    pub entries: Vec<EnglishSnapshotEntry>,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
#[serde(deny_unknown_fields)]
struct EnglishSnapshotPointer {
    schema_version: u32,
    generation: String,
    install_root: String,
    immutable_revision: String,
}

/// Immutable English JSON identity committed into durable state. The small current pointer is
/// only a discovery aid; mutation paths compare both fields before trusting a generation.
#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
#[serde(deny_unknown_fields)]
pub struct EnglishSnapshotIdentity {
    pub generation: String,
    pub manifest_sha256: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct EnglishSnapshotCapture {
    pub count: usize,
    pub identity: EnglishSnapshotIdentity,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct EnglishSnapshotObservation {
    pub manifest: EnglishSnapshotManifest,
    pub manifest_sha256: String,
    pub count: usize,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct SnapshotMapping {
    language_relative_path: String,
    asset_relative_path: String,
}

pub fn assets_root(app_path: &Path) -> PathBuf {
    InstallLayout::from_root(app_path).assets_root
}

/// Apply the shared macOS bundle boundary gate to an asset-relative path.  Windows deliberately
/// keeps its existing discovery semantics here; the helper is a no-op on that platform layout.
/// Missing components remain a normal "asset not present" result, while every existing
/// intermediate component is lstat-checked before a read or write decision.
fn validate_mac_asset_components(app_path: &Path, asset_relative: &Path) -> Result<(), String> {
    let layout = InstallLayout::from_root(app_path);
    if layout.platform != InstallPlatform::Macos {
        return Ok(());
    }
    let assets_relative = layout
        .assets_root
        .strip_prefix(&layout.root)
        .map_err(|_| "macOS assets root escaped the canonical bundle root".to_string())?;
    validate_no_symlink_components(&layout.root, &assets_relative.join(asset_relative))
}

pub fn to_camel_case(name: &str) -> String {
    let words = name
        .split_whitespace()
        .map(str::trim)
        .filter(|word| !word.is_empty())
        .collect::<Vec<_>>();
    if words.is_empty() {
        return String::new();
    }
    let mut output = lowercase_first(words[0]);
    for word in words.iter().skip(1) {
        output.push_str(&uppercase_first(word));
    }
    output
}

fn lowercase_first(value: &str) -> String {
    let mut chars = value.chars();
    match chars.next() {
        Some(first) => first.to_lowercase().chain(chars).collect(),
        None => String::new(),
    }
}

fn uppercase_first(value: &str) -> String {
    let mut chars = value.chars();
    match chars.next() {
        Some(first) => first.to_uppercase().chain(chars).collect(),
        None => String::new(),
    }
}

/// Strict plugin discovery.  The compatibility `discover_plugins` wrapper below intentionally
/// keeps its old `Vec` API for Windows callers, but all new snapshot/restore paths use this
/// fallible entry point so an ambiguous plugin identity fails closed.
pub fn try_discover_plugins(app_path: &Path) -> Result<Vec<PluginInfo>, String> {
    let plugins_dir = assets_root(app_path).join("Plugins");
    let strict_mac = InstallLayout::from_root(app_path).platform == InstallPlatform::Macos;
    if strict_mac {
        validate_mac_asset_components(app_path, Path::new("Plugins"))?;
    }
    let entries = match fs::read_dir(&plugins_dir) {
        Ok(entries) => entries,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(Vec::new()),
        Err(error) => {
            return Err(format!(
                "Could not enumerate Cavalry plugins at {}: {error}",
                plugins_dir.display()
            ))
        }
    };

    let mut plugins = Vec::new();
    for entry in entries {
        let entry = entry.map_err(|error| {
            format!(
                "Could not enumerate Cavalry plugins at {}: {error}",
                plugins_dir.display()
            )
        })?;
        let file_type = entry.file_type().map_err(|error| {
            format!(
                "Could not inspect plugin entry {}: {error}",
                entry.path().display()
            )
        })?;
        if file_type.is_symlink() {
            if strict_mac {
                return Err(format!(
                    "Refusing symlink macOS plugin entry {}; plugin inventory is not trusted",
                    entry.path().display()
                ));
            }
            continue;
        }
        if !file_type.is_dir() {
            continue;
        }
        let folder_name = entry.file_name().into_string().map_err(|_| {
            format!(
                "Plugin folder is not valid UTF-8: {}",
                entry.path().display()
            )
        })?;
        let strings_path = entry.path().join("strings.json");
        if strict_mac {
            let relative = Path::new("Plugins").join(&folder_name).join("strings.json");
            validate_mac_asset_components(app_path, &relative)?;
            if !is_regular_file_without_symlink(&strings_path)? {
                continue;
            }
        } else if !strings_path.is_file() {
            continue;
        }
        let camel_name = to_camel_case(&folder_name);
        if camel_name.is_empty() {
            return Err(format!(
                "Plugin folder has no canonical language identity: {}",
                entry.path().display()
            ));
        }
        plugins.push(PluginInfo {
            folder_name,
            camel_name,
        });
    }
    plugins.sort_by(|left, right| left.folder_name.cmp(&right.folder_name));

    let mut seen_camel = HashSet::new();
    for plugin in &plugins {
        if !seen_camel.insert(collision_key(&plugin.camel_name)) {
            return Err(format!(
                "Plugin language destination collision for canonical key {:?}; refusing ambiguous snapshot/restore",
                plugin.camel_name
            ));
        }
    }
    Ok(plugins)
}

/// Backwards-compatible discovery API.  Callers that cannot yet consume a typed error receive
/// an empty result on malformed/ambiguous plugin inventory, which is fail-closed for writes.
pub fn discover_plugins(app_path: &Path) -> Vec<PluginInfo> {
    try_discover_plugins(app_path).unwrap_or_default()
}

fn collision_key(value: &str) -> String {
    value.replace('\\', "/").to_lowercase()
}

fn validate_relative_identity(value: &str, label: &str) -> Result<(), String> {
    let path = Path::new(value);
    if value.is_empty() || path.is_absolute() {
        return Err(format!(
            "{label} must be a non-empty relative path: {value:?}"
        ));
    }
    if path.components().any(|component| {
        matches!(
            component,
            std::path::Component::CurDir
                | std::path::Component::ParentDir
                | std::path::Component::RootDir
                | std::path::Component::Prefix(_)
        )
    }) {
        return Err(format!(
            "{label} contains an unsafe path component: {value:?}"
        ));
    }
    Ok(())
}

fn validate_mappings(mappings: &[SnapshotMapping]) -> Result<(), String> {
    let mut source_paths = HashSet::new();
    let mut destination_paths = HashSet::new();
    for mapping in mappings {
        validate_relative_identity(
            &mapping.language_relative_path,
            "language snapshot relative path",
        )?;
        validate_relative_identity(&mapping.asset_relative_path, "Cavalry asset relative path")?;
        if !source_paths.insert(collision_key(&mapping.language_relative_path)) {
            return Err(format!(
                "Duplicate language snapshot destination {}; refusing overwrite",
                mapping.language_relative_path
            ));
        }
        if !destination_paths.insert(collision_key(&mapping.asset_relative_path)) {
            return Err(format!(
                "Duplicate Cavalry asset destination {}; refusing overwrite",
                mapping.asset_relative_path
            ));
        }
    }
    Ok(())
}

fn snapshot_mappings(app_path: &Path) -> Result<Vec<SnapshotMapping>, String> {
    let root = assets_root(app_path);
    let mut mappings = Vec::with_capacity(CORE_MAP.len() + PLUGIN_DEFINITION_MAP.len());
    for (language_relative_path, asset_relative_path) in CORE_MAP {
        validate_mac_asset_components(app_path, Path::new(asset_relative_path))?;
        mappings.push(SnapshotMapping {
            language_relative_path: language_relative_path.to_string(),
            asset_relative_path: asset_relative_path.to_string(),
        });
    }

    for (language_relative_path, asset_relative_path) in PLUGIN_DEFINITION_MAP {
        validate_mac_asset_components(app_path, Path::new(asset_relative_path))?;
        if root.join(asset_relative_path).exists() {
            mappings.push(SnapshotMapping {
                language_relative_path: language_relative_path.to_string(),
                asset_relative_path: asset_relative_path.to_string(),
            });
        }
    }

    for plugin in try_discover_plugins(app_path)? {
        let asset_relative_path = format!("Plugins/{}/strings.json", plugin.folder_name);
        validate_mac_asset_components(app_path, Path::new(&asset_relative_path))?;
        mappings.push(SnapshotMapping {
            language_relative_path: format!("plugins/{}.json", plugin.camel_name),
            asset_relative_path,
        });
    }
    mappings.sort_by(|left, right| {
        left.asset_relative_path
            .cmp(&right.asset_relative_path)
            .then_with(|| {
                left.language_relative_path
                    .cmp(&right.language_relative_path)
            })
    });
    validate_mappings(&mappings)?;
    Ok(mappings)
}

pub fn extract_english(app_path: &Path, output_dir: &Path) -> Result<usize, String> {
    let mappings = snapshot_mappings(app_path)?;
    extract_snapshot_contents(app_path, output_dir, &mappings)
}

pub fn observe_english_snapshot(app_path: &Path) -> Result<EnglishSnapshotObservation, String> {
    let mappings = snapshot_mappings(app_path)?;
    let root = assets_root(app_path);
    let manifest = EnglishSnapshotManifest {
        schema_version: ENGLISH_SNAPSHOT_SCHEMA_VERSION,
        entries: mappings
            .iter()
            .map(|mapping| {
                validate_mac_asset_components(app_path, Path::new(&mapping.asset_relative_path))?;
                let source = root.join(&mapping.asset_relative_path);
                if !is_regular_file_without_symlink(&source)? {
                    return Err(format!(
                        "English snapshot input is missing or not a file: {}",
                        source.display()
                    ));
                }
                Ok(EnglishSnapshotEntry {
                    language_relative_path: mapping.language_relative_path.clone(),
                    asset_relative_path: mapping.asset_relative_path.clone(),
                    sha256: sha256_file(&source)?,
                    unix_mode: original_unix_mode(&source)?,
                })
            })
            .collect::<Result<Vec<_>, String>>()?,
    };
    let manifest_sha256 = snapshot_manifest_sha256(&manifest)?;
    Ok(EnglishSnapshotObservation {
        count: manifest.entries.len(),
        manifest,
        manifest_sha256,
    })
}

/// Observe the exact installed English asset surface only after proving it is semantically the
/// packaged English source. This is the capture-side API used by the unified macOS vendor
/// baseline; it never publishes the standalone `english-snapshots/current.json` pointer.
pub fn observe_clean_english_assets(
    packaged_english_dir: &Path,
    app_path: &Path,
) -> Result<EnglishSnapshotObservation, String> {
    if !install_matches_language_source(packaged_english_dir, app_path)? {
        return Err(
            "English snapshot capture refused: installed JSON assets do not match the packaged English source."
                .to_string(),
        );
    }
    observe_english_snapshot(app_path)
}

/// Copy one exact English snapshot into a caller-owned staging directory and prove that the
/// copied manifest/path/hash surface is identical to the pre-copy observation. No global pointer
/// or durable state is touched.
pub fn stage_english_snapshot_exact(
    app_path: &Path,
    output_dir: &Path,
    expected: &EnglishSnapshotObservation,
) -> Result<EnglishSnapshotObservation, String> {
    let mappings = snapshot_mappings(app_path)?;
    let count = extract_snapshot_contents(app_path, output_dir, &mappings)?;
    let actual = validate_english_snapshot_at(output_dir, app_path, &expected.manifest_sha256)?;
    if count != expected.count || actual != *expected {
        return Err(
            "Installed English JSON assets changed while the immutable snapshot was staged."
                .to_string(),
        );
    }
    Ok(actual)
}

pub fn validate_english_snapshot_at(
    snapshot_dir: &Path,
    app_path: &Path,
    expected_manifest_sha256: &str,
) -> Result<EnglishSnapshotObservation, String> {
    let mappings = snapshot_mappings(app_path)?;
    if !validate_snapshot_manifest(snapshot_dir, &mappings, requires_unix_mode(app_path))? {
        return Err("English snapshot failed its exact path/hash manifest gate.".to_string());
    }
    let manifest = read_snapshot_manifest(snapshot_dir)?;
    let manifest_sha256 = sha256_file(&snapshot_dir.join(ENGLISH_SNAPSHOT_MANIFEST_NAME))?;
    if manifest_sha256 != expected_manifest_sha256 {
        return Err("English snapshot manifest SHA-256 does not match its baseline.".to_string());
    }
    Ok(EnglishSnapshotObservation {
        count: manifest.entries.len(),
        manifest,
        manifest_sha256,
    })
}

fn snapshot_manifest_sha256(manifest: &EnglishSnapshotManifest) -> Result<String, String> {
    let bytes = serde_json::to_vec_pretty(manifest)
        .map_err(|error| format!("Could not encode English snapshot manifest: {error}"))?;
    Ok(format!("{:x}", Sha256::digest(bytes)))
}

fn extract_snapshot_contents(
    app_path: &Path,
    output_dir: &Path,
    mappings: &[SnapshotMapping],
) -> Result<usize, String> {
    let root = assets_root(app_path);
    let _ = fs::remove_dir_all(output_dir);
    fs::create_dir_all(output_dir).map_err(|error| error.to_string())?;

    for mapping in mappings {
        validate_mac_asset_components(app_path, Path::new(&mapping.asset_relative_path))?;
        let src = root.join(&mapping.asset_relative_path);
        let dst = output_dir.join(&mapping.language_relative_path);
        if !is_regular_file_without_symlink(&src)? {
            return Err(format!(
                "English snapshot input is missing or not a file: {}",
                src.display()
            ));
        }
        if let Some(parent) = dst.parent() {
            fs::create_dir_all(parent).map_err(|error| error.to_string())?;
        }
        fs::copy(&src, &dst).map_err(|error| {
            format!(
                "Could not copy English snapshot input {} to {}: {error}",
                src.display(),
                dst.display()
            )
        })?;
    }

    let manifest = EnglishSnapshotManifest {
        schema_version: ENGLISH_SNAPSHOT_SCHEMA_VERSION,
        entries: mappings
            .iter()
            .map(|mapping| {
                let path = output_dir.join(&mapping.language_relative_path);
                let source = root.join(&mapping.asset_relative_path);
                Ok(EnglishSnapshotEntry {
                    language_relative_path: mapping.language_relative_path.clone(),
                    asset_relative_path: mapping.asset_relative_path.clone(),
                    sha256: sha256_file(&path)?,
                    unix_mode: original_unix_mode(&source)?,
                })
            })
            .collect::<Result<Vec<_>, String>>()?,
    };
    write_snapshot_manifest(output_dir, &manifest)?;
    if !validate_snapshot_manifest(output_dir, &mappings, requires_unix_mode(app_path))? {
        return Err("Freshly extracted English snapshot failed manifest validation".to_string());
    }
    Ok(mappings.len())
}

/// Build a complete immutable generation, verify every path/hash, and publish only its small
/// pointer with an atomic same-directory rename. The prior pointer and generation are retained so
/// a crash or malformed current pointer never destroys the last usable English snapshot.
pub fn extract_english_generation_with_identity(
    app_path: &Path,
    state_dir: &Path,
    immutable_revision: &str,
) -> Result<EnglishSnapshotCapture, String> {
    if immutable_revision.is_empty() {
        return Err(
            "Cannot create an English snapshot generation without an immutable revision."
                .to_string(),
        );
    }
    let canonical_app = fs::canonicalize(app_path).map_err(|error| {
        format!("Could not canonicalize Cavalry before English snapshot generation: {error}")
    })?;
    let install_root = canonical_app
        .to_str()
        .ok_or_else(|| "Cavalry canonical path is not valid UTF-8.".to_string())?
        .to_string();
    let mappings = snapshot_mappings(&canonical_app)?;
    let generations = state_dir.join(ENGLISH_GENERATIONS_DIRECTORY);
    create_private_directory_chain(state_dir, &generations)?;

    let nonce = format!(
        "{:x}-{:x}",
        std::process::id(),
        SNAPSHOT_GENERATION_SEQUENCE.fetch_add(1, Ordering::Relaxed)
    );
    let temporary = generations.join(format!(".generation-{nonce}.tmp"));
    reject_existing_path(&temporary, "English snapshot temporary generation")?;
    let count = match extract_snapshot_contents(&canonical_app, &temporary, &mappings) {
        Ok(count) => count,
        Err(error) => {
            let _ = fs::remove_dir_all(&temporary);
            return Err(error);
        }
    };
    if let Err(error) = protect_and_sync_snapshot_tree(&temporary) {
        let _ = fs::remove_dir_all(&temporary);
        return Err(error);
    }

    let manifest_bytes = fs::read(temporary.join(ENGLISH_SNAPSHOT_MANIFEST_NAME))
        .map_err(|error| error.to_string())?;
    let mut generation_digest = Sha256::new();
    generation_digest.update(immutable_revision.as_bytes());
    generation_digest.update(install_root.as_bytes());
    generation_digest.update(&manifest_bytes);
    let manifest_sha256 = format!("{:x}", Sha256::digest(&manifest_bytes));
    let generation = format!("{:x}", generation_digest.finalize());
    let generation_dir = generations.join(&generation);
    match fs::symlink_metadata(&generation_dir) {
        Ok(metadata) => {
            if metadata.file_type().is_symlink() || !metadata.is_dir() {
                let _ = fs::remove_dir_all(&temporary);
                return Err(format!(
                    "English snapshot generation path is not a regular directory: {}",
                    generation_dir.display()
                ));
            }
            if !validate_snapshot_manifest(
                &generation_dir,
                &mappings,
                requires_unix_mode(&canonical_app),
            )? {
                let _ = fs::remove_dir_all(&temporary);
                return Err(format!(
                    "Existing English snapshot generation failed validation: {}",
                    generation_dir.display()
                ));
            }
            fs::remove_dir_all(&temporary).map_err(|error| error.to_string())?;
        }
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            fs::rename(&temporary, &generation_dir).map_err(|error| {
                format!(
                    "Could not publish English snapshot generation {}: {error}",
                    generation_dir.display()
                )
            })?;
            sync_directory(&generations)?;
        }
        Err(error) => {
            let _ = fs::remove_dir_all(&temporary);
            return Err(format!(
                "Could not inspect English snapshot generation {}: {error}",
                generation_dir.display()
            ));
        }
    }

    let pointer = EnglishSnapshotPointer {
        schema_version: ENGLISH_POINTER_SCHEMA_VERSION,
        generation: generation.clone(),
        install_root,
        immutable_revision: immutable_revision.to_string(),
    };
    publish_snapshot_pointer(state_dir, &pointer)?;
    if !validate_english_snapshot_manifest(state_dir, &canonical_app)? {
        return Err("Published English snapshot generation failed validation.".to_string());
    }
    Ok(EnglishSnapshotCapture {
        count,
        identity: EnglishSnapshotIdentity {
            generation,
            manifest_sha256,
        },
    })
}

pub fn extract_english_generation(
    app_path: &Path,
    state_dir: &Path,
    immutable_revision: &str,
) -> Result<usize, String> {
    extract_english_generation_with_identity(app_path, state_dir, immutable_revision)
        .map(|capture| capture.count)
}

fn sha256_file(path: &Path) -> Result<String, String> {
    if !is_regular_file_without_symlink(path)? {
        return Err(format!(
            "Snapshot hash input is not a regular non-symlink file: {}",
            path.display()
        ));
    }
    let bytes = fs::read(path).map_err(|error| {
        format!(
            "Could not read snapshot hash input {}: {error}",
            path.display()
        )
    })?;
    let mut digest = Sha256::new();
    digest.update(bytes);
    Ok(format!("{:x}", digest.finalize()))
}

fn sha256_bytes(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}

fn is_regular_file_without_symlink(path: &Path) -> Result<bool, String> {
    match fs::symlink_metadata(path) {
        Ok(metadata) => Ok(!metadata.file_type().is_symlink() && metadata.is_file()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(false),
        Err(error) => Err(format!("Could not inspect {}: {error}", path.display())),
    }
}

#[cfg(unix)]
fn original_unix_mode(path: &Path) -> Result<Option<u32>, String> {
    let metadata = fs::symlink_metadata(path).map_err(|error| {
        format!(
            "Could not inspect snapshot mode source {}: {error}",
            path.display()
        )
    })?;
    if metadata.file_type().is_symlink() || !metadata.is_file() {
        return Err(format!(
            "Snapshot mode source is not a regular non-symlink file: {}",
            path.display()
        ));
    }
    Ok(Some(metadata.permissions().mode() & 0o7777))
}

#[cfg(not(unix))]
fn original_unix_mode(path: &Path) -> Result<Option<u32>, String> {
    let _ = path;
    Ok(None)
}

fn apply_original_unix_mode(path: &Path, mode: Option<u32>) -> Result<(), String> {
    #[cfg(unix)]
    if let Some(mode) = mode {
        if mode > 0o7777 {
            return Err(format!(
                "Snapshot manifest contains an unsafe Unix mode {mode:o} for {}",
                path.display()
            ));
        }
        fs::set_permissions(path, fs::Permissions::from_mode(mode)).map_err(|error| {
            format!(
                "Could not restore original Unix mode on {}: {error}",
                path.display()
            )
        })?;
    }
    #[cfg(not(unix))]
    {
        let _ = (path, mode);
    }
    Ok(())
}

fn requires_unix_mode(app_path: &Path) -> bool {
    cfg!(unix) && InstallLayout::from_root(app_path).platform == InstallPlatform::Macos
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum SnapshotPathPresence {
    Missing,
    Present,
    Symlink,
}

/// `Path::exists()` cannot distinguish a missing pointer from a dangling symlink.  Snapshot
/// recovery must make that distinction explicitly: only two genuinely absent pointers may enter
/// the legacy `state_dir/en` compatibility path; any symlink is corruption and fails closed.
fn snapshot_path_presence(path: &Path) -> Result<SnapshotPathPresence, String> {
    match fs::symlink_metadata(path) {
        Ok(metadata) if metadata.file_type().is_symlink() => Ok(SnapshotPathPresence::Symlink),
        Ok(_) => Ok(SnapshotPathPresence::Present),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            Ok(SnapshotPathPresence::Missing)
        }
        Err(error) => Err(format!(
            "Could not inspect snapshot path {}: {error}",
            path.display()
        )),
    }
}

fn write_snapshot_manifest(
    snapshot_dir: &Path,
    manifest: &EnglishSnapshotManifest,
) -> Result<(), String> {
    let bytes = serde_json::to_vec_pretty(manifest)
        .map_err(|error| format!("Could not encode English snapshot manifest: {error}"))?;
    fs::write(snapshot_dir.join(ENGLISH_SNAPSHOT_MANIFEST_NAME), bytes)
        .map_err(|error| format!("Could not write English snapshot manifest: {error}"))
}

fn read_snapshot_manifest(snapshot_dir: &Path) -> Result<EnglishSnapshotManifest, String> {
    let path = snapshot_dir.join(ENGLISH_SNAPSHOT_MANIFEST_NAME);
    match snapshot_path_presence(&path)? {
        SnapshotPathPresence::Missing => {
            return Err(format!(
                "English snapshot manifest is missing: {}",
                path.display()
            ));
        }
        SnapshotPathPresence::Symlink => {
            return Err(format!(
                "English snapshot manifest is a symlink and cannot be trusted: {}",
                path.display()
            ));
        }
        SnapshotPathPresence::Present => {}
    }
    if !is_regular_file_without_symlink(&path)? {
        return Err(format!(
            "English snapshot manifest is not a regular file: {}",
            path.display()
        ));
    }
    let bytes = fs::read(&path).map_err(|error| {
        format!(
            "Could not read English snapshot manifest {}: {error}",
            path.display()
        )
    })?;
    serde_json::from_slice(&bytes).map_err(|error| {
        format!(
            "English snapshot manifest {} is invalid: {error}",
            path.display()
        )
    })
}

fn reject_existing_path(path: &Path, label: &str) -> Result<(), String> {
    match fs::symlink_metadata(path) {
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Ok(_) => Err(format!("{label} already exists: {}", path.display())),
        Err(error) => Err(format!(
            "Could not inspect {label} {}: {error}",
            path.display()
        )),
    }
}

fn create_private_directory_chain(state_dir: &Path, target: &Path) -> Result<(), String> {
    fs::create_dir_all(target).map_err(|error| {
        format!(
            "Could not create English snapshot directory {}: {error}",
            target.display()
        )
    })?;
    for directory in [
        state_dir.to_path_buf(),
        state_dir.join("english-snapshots"),
        target.to_path_buf(),
    ] {
        let metadata = fs::symlink_metadata(&directory).map_err(|error| error.to_string())?;
        if metadata.file_type().is_symlink() || !metadata.is_dir() {
            return Err(format!(
                "English snapshot directory is a symlink or non-directory: {}",
                directory.display()
            ));
        }
        #[cfg(unix)]
        fs::set_permissions(&directory, fs::Permissions::from_mode(0o700))
            .map_err(|error| error.to_string())?;
    }
    Ok(())
}

fn protect_and_sync_snapshot_tree(path: &Path) -> Result<(), String> {
    let metadata = fs::symlink_metadata(path).map_err(|error| error.to_string())?;
    if metadata.file_type().is_symlink() {
        return Err(format!(
            "English snapshot generation contains a symlink: {}",
            path.display()
        ));
    }
    if metadata.is_file() {
        #[cfg(unix)]
        fs::set_permissions(path, fs::Permissions::from_mode(0o600)).map_err(|error| {
            format!(
                "Could not protect English snapshot {}: {error}",
                path.display()
            )
        })?;
        sync_file(path).map_err(|error| {
            format!(
                "Could not sync English snapshot {}: {error}",
                path.display()
            )
        })?;
        return Ok(());
    }
    if !metadata.is_dir() {
        return Err(format!(
            "English snapshot generation contains a special file: {}",
            path.display()
        ));
    }
    #[cfg(unix)]
    fs::set_permissions(path, fs::Permissions::from_mode(0o700)).map_err(|error| {
        format!(
            "Could not protect English snapshot directory {}: {error}",
            path.display()
        )
    })?;
    for entry in fs::read_dir(path).map_err(|error| error.to_string())? {
        protect_and_sync_snapshot_tree(&entry.map_err(|error| error.to_string())?.path())?;
    }
    sync_directory(path)
}

fn sync_directory(path: &Path) -> Result<(), String> {
    #[cfg(unix)]
    {
        File::open(path)
            .and_then(|directory| directory.sync_all())
            .map_err(|error| format!("Could not sync directory {}: {error}", path.display()))
    }
    #[cfg(not(unix))]
    {
        let _ = path;
        Ok(())
    }
}

fn sync_file(path: &Path) -> std::io::Result<()> {
    #[cfg(windows)]
    {
        OpenOptions::new().write(true).open(path)?.sync_all()
    }
    #[cfg(not(windows))]
    {
        File::open(path)?.sync_all()
    }
}

fn write_atomic_pointer(path: &Path, payload: &[u8]) -> Result<(), String> {
    let parent = path
        .parent()
        .ok_or_else(|| format!("Snapshot pointer has no parent: {}", path.display()))?;
    let nonce = SNAPSHOT_GENERATION_SEQUENCE.fetch_add(1, Ordering::Relaxed);
    let temporary = parent.join(format!(
        ".{}.{}-{nonce:x}.tmp",
        path.file_name()
            .and_then(|name| name.to_str())
            .unwrap_or("snapshot-pointer"),
        std::process::id()
    ));
    reject_existing_path(&temporary, "English snapshot pointer temporary file")?;
    let mut options = OpenOptions::new();
    options.create_new(true).write(true);
    #[cfg(unix)]
    options.mode(0o600);
    let mut file = options
        .open(&temporary)
        .map_err(|error| error.to_string())?;
    if let Err(error) = file.write_all(payload).and_then(|_| file.sync_all()) {
        let _ = fs::remove_file(&temporary);
        return Err(format!(
            "Could not sync English snapshot pointer {}: {error}",
            temporary.display()
        ));
    }
    #[cfg(windows)]
    if path.exists() {
        fs::remove_file(path).map_err(|error| error.to_string())?;
    }
    if let Err(error) = fs::rename(&temporary, path) {
        let _ = fs::remove_file(&temporary);
        return Err(format!(
            "Could not atomically publish English snapshot pointer {}: {error}",
            path.display()
        ));
    }
    sync_directory(parent)
}

fn read_snapshot_pointer(path: &Path) -> Result<EnglishSnapshotPointer, String> {
    let metadata = fs::symlink_metadata(path).map_err(|error| {
        format!(
            "Could not inspect English snapshot pointer {}: {error}",
            path.display()
        )
    })?;
    if metadata.file_type().is_symlink() || !metadata.is_file() {
        return Err(format!(
            "English snapshot pointer is a symlink or non-file: {}",
            path.display()
        ));
    }
    let pointer: EnglishSnapshotPointer = serde_json::from_slice(
        &fs::read(path).map_err(|error| error.to_string())?,
    )
    .map_err(|error| {
        format!(
            "English snapshot pointer {} is invalid: {error}",
            path.display()
        )
    })?;
    if pointer.schema_version != ENGLISH_POINTER_SCHEMA_VERSION {
        return Err(format!(
            "Unsupported English snapshot pointer schema {}; expected {}",
            pointer.schema_version, ENGLISH_POINTER_SCHEMA_VERSION
        ));
    }
    if pointer.generation.len() != 64
        || !pointer
            .generation
            .bytes()
            .all(|byte| byte.is_ascii_hexdigit() && !byte.is_ascii_uppercase())
    {
        return Err("English snapshot pointer has an unsafe generation identity.".to_string());
    }
    Ok(pointer)
}

fn publish_snapshot_pointer(
    state_dir: &Path,
    pointer: &EnglishSnapshotPointer,
) -> Result<(), String> {
    let root = state_dir.join("english-snapshots");
    create_private_directory_chain(state_dir, &root.join("generations"))?;
    let current_path = state_dir.join(ENGLISH_CURRENT_POINTER);
    let previous_path = state_dir.join(ENGLISH_PREVIOUS_POINTER);
    match fs::symlink_metadata(&current_path) {
        Ok(_) => {
            let current = read_snapshot_pointer(&current_path)?;
            let current_payload =
                serde_json::to_vec_pretty(&current).map_err(|error| error.to_string())?;
            write_atomic_pointer(&previous_path, &current_payload)?;
        }
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
        Err(error) => return Err(error.to_string()),
    }
    let mut payload = serde_json::to_vec_pretty(pointer).map_err(|error| error.to_string())?;
    payload.push(b'\n');
    write_atomic_pointer(&current_path, &payload)
}

fn snapshot_pointer_with_recovery(
    state_dir: &Path,
) -> Result<Option<EnglishSnapshotPointer>, String> {
    let current_path = state_dir.join(ENGLISH_CURRENT_POINTER);
    let previous_path = state_dir.join(ENGLISH_PREVIOUS_POINTER);
    if snapshot_path_presence(state_dir)? != SnapshotPathPresence::Missing {
        validate_no_symlink_components(state_dir, Path::new("english-snapshots/current.json"))?;
        validate_no_symlink_components(
            state_dir,
            Path::new("english-snapshots/current.json.prev"),
        )?;
    }
    let current_presence = snapshot_path_presence(&current_path)?;
    if current_presence == SnapshotPathPresence::Symlink {
        return Err(format!(
            "English snapshot current pointer is a symlink (including a dangling symlink); refusing recovery: {}",
            current_path.display()
        ));
    }
    match read_snapshot_pointer(&current_path) {
        Ok(pointer) => Ok(Some(pointer)),
        Err(current_error) => {
            if current_error.starts_with("Unsupported English snapshot pointer schema") {
                return Err(current_error);
            }
            let previous_presence = snapshot_path_presence(&previous_path)?;
            if previous_presence == SnapshotPathPresence::Symlink {
                return Err(format!(
                    "English snapshot previous pointer is a symlink (including a dangling symlink); refusing recovery: {}",
                    previous_path.display()
                ));
            }
            match read_snapshot_pointer(&previous_path) {
                Ok(pointer) => Ok(Some(pointer)),
                Err(_previous_error)
                    if current_presence == SnapshotPathPresence::Missing
                        && previous_presence == SnapshotPathPresence::Missing =>
                {
                    Ok(None)
                }
                Err(previous_error) => Err(format!(
                    "English snapshot pointer recovery failed; current: {current_error}; previous: {previous_error}"
                )),
            }
        }
    }
}

fn validate_legacy_snapshot_root(state_dir: &Path) -> Result<PathBuf, String> {
    let snapshot_dir = state_dir.join("en");
    if snapshot_path_presence(state_dir)? == SnapshotPathPresence::Missing {
        return Ok(snapshot_dir);
    }
    validate_no_symlink_components(state_dir, Path::new("en"))?;
    match snapshot_path_presence(&snapshot_dir)? {
        SnapshotPathPresence::Missing => Ok(snapshot_dir),
        SnapshotPathPresence::Symlink => Err(format!(
            "Legacy English snapshot directory is a symlink and cannot be trusted: {}",
            snapshot_dir.display()
        )),
        SnapshotPathPresence::Present => {
            let metadata = fs::symlink_metadata(&snapshot_dir).map_err(|error| {
                format!(
                    "Could not inspect legacy English snapshot directory {}: {error}",
                    snapshot_dir.display()
                )
            })?;
            if !metadata.is_dir() {
                return Err(format!(
                    "Legacy English snapshot path is not a directory: {}",
                    snapshot_dir.display()
                ));
            }
            Ok(snapshot_dir)
        }
    }
}

fn validate_legacy_snapshot_components(
    state_dir: &Path,
    mappings: &[SnapshotMapping],
) -> Result<(), String> {
    for mapping in mappings {
        let relative = Path::new("en").join(&mapping.language_relative_path);
        validate_no_symlink_components(state_dir, &relative)?;
    }
    Ok(())
}

fn validate_legacy_snapshot_structure(
    state_dir: &Path,
    snapshot_dir: &Path,
    mappings: &[SnapshotMapping],
) -> Result<bool, String> {
    validate_legacy_snapshot_root(state_dir)?;
    if snapshot_path_presence(state_dir)? == SnapshotPathPresence::Missing {
        return Ok(false);
    }
    validate_legacy_snapshot_components(state_dir, mappings)?;
    if snapshot_path_presence(snapshot_dir)? == SnapshotPathPresence::Missing {
        return Ok(false);
    }
    for mapping in mappings {
        if !is_regular_file_without_symlink(&snapshot_dir.join(&mapping.language_relative_path))? {
            return Ok(false);
        }
    }
    Ok(true)
}

fn resolve_snapshot_directory(
    state_dir: &Path,
    app_path: &Path,
    immutable_revision: Option<&str>,
) -> Result<PathBuf, String> {
    let Some(pointer) = snapshot_pointer_with_recovery(state_dir)? else {
        return validate_legacy_snapshot_root(state_dir);
    };
    let canonical_app = fs::canonicalize(app_path).map_err(|error| error.to_string())?;
    if Path::new(&pointer.install_root) != canonical_app {
        return Err(
            "English snapshot pointer belongs to a different Cavalry installation.".to_string(),
        );
    }
    if immutable_revision.is_some_and(|revision| revision != pointer.immutable_revision) {
        return Err(
            "English snapshot pointer belongs to a different Cavalry revision.".to_string(),
        );
    }
    let generations = state_dir.join(ENGLISH_GENERATIONS_DIRECTORY);
    let generation = generations.join(&pointer.generation);
    for path in [&generations, &generation] {
        let metadata = fs::symlink_metadata(path).map_err(|error| {
            format!(
                "English snapshot generation is unavailable at {}: {error}",
                path.display()
            )
        })?;
        if metadata.file_type().is_symlink() || !metadata.is_dir() {
            return Err(format!(
                "English snapshot generation path is a symlink or non-directory: {}",
                path.display()
            ));
        }
    }
    Ok(generation)
}

pub fn english_snapshot_dir(
    state_dir: &Path,
    app_path: &Path,
    immutable_revision: &str,
) -> Result<PathBuf, String> {
    resolve_snapshot_directory(state_dir, app_path, Some(immutable_revision))
}

pub fn english_snapshot_identity(
    state_dir: &Path,
    app_path: &Path,
    immutable_revision: &str,
) -> Result<EnglishSnapshotIdentity, String> {
    let pointer = snapshot_pointer_with_recovery(state_dir)?
        .ok_or_else(|| "English snapshot has no immutable generation pointer.".to_string())?;
    let snapshot_dir = resolve_snapshot_directory(state_dir, app_path, Some(immutable_revision))?;
    let expected_dir = state_dir
        .join(ENGLISH_GENERATIONS_DIRECTORY)
        .join(&pointer.generation);
    if snapshot_dir != expected_dir {
        return Err("English snapshot pointer resolved to an unexpected generation.".to_string());
    }
    if !validate_snapshot_manifest(
        &snapshot_dir,
        &snapshot_mappings(app_path)?,
        requires_unix_mode(app_path),
    )? {
        return Err("English snapshot generation failed its exact manifest gate.".to_string());
    }
    Ok(EnglishSnapshotIdentity {
        generation: pointer.generation,
        manifest_sha256: sha256_file(&snapshot_dir.join(ENGLISH_SNAPSHOT_MANIFEST_NAME))?,
    })
}

fn relative_file_key(root: &Path, path: &Path) -> Result<String, String> {
    let relative = path
        .strip_prefix(root)
        .map_err(|_| format!("Snapshot file escaped root: {}", path.display()))?;
    Ok(relative.to_string_lossy().replace('\\', "/"))
}

fn collect_snapshot_files(
    root: &Path,
    current: &Path,
    files: &mut Vec<String>,
) -> Result<(), String> {
    for entry in fs::read_dir(current).map_err(|error| {
        format!(
            "Could not enumerate English snapshot directory {}: {error}",
            current.display()
        )
    })? {
        let entry = entry.map_err(|error| error.to_string())?;
        let path = entry.path();
        let metadata = fs::symlink_metadata(&path).map_err(|error| {
            format!(
                "Could not inspect snapshot path {}: {error}",
                path.display()
            )
        })?;
        if metadata.file_type().is_symlink() {
            return Err(format!(
                "English snapshot contains a symlink and cannot be trusted: {}",
                path.display()
            ));
        }
        if metadata.is_dir() {
            collect_snapshot_files(root, &path, files)?;
        } else if metadata.is_file() {
            files.push(relative_file_key(root, &path)?);
        } else {
            return Err(format!(
                "English snapshot contains a non-file entry: {}",
                path.display()
            ));
        }
    }
    Ok(())
}

fn is_sha256_hex(value: &str) -> bool {
    value.len() == 64 && value.bytes().all(|byte| byte.is_ascii_hexdigit())
}

fn validate_snapshot_manifest(
    snapshot_dir: &Path,
    expected_mappings: &[SnapshotMapping],
    require_unix_modes: bool,
) -> Result<bool, String> {
    match snapshot_path_presence(snapshot_dir)? {
        SnapshotPathPresence::Missing => {
            return Err(format!(
                "English snapshot directory is missing: {}",
                snapshot_dir.display()
            ));
        }
        SnapshotPathPresence::Symlink => {
            return Err(format!(
                "English snapshot directory is a symlink and cannot be trusted: {}",
                snapshot_dir.display()
            ));
        }
        SnapshotPathPresence::Present => {
            let metadata = fs::symlink_metadata(snapshot_dir).map_err(|error| {
                format!(
                    "Could not inspect English snapshot directory {}: {error}",
                    snapshot_dir.display()
                )
            })?;
            if !metadata.is_dir() {
                return Err(format!(
                    "English snapshot path is not a directory: {}",
                    snapshot_dir.display()
                ));
            }
        }
    }
    let manifest = read_snapshot_manifest(snapshot_dir)?;
    if manifest.schema_version != ENGLISH_SNAPSHOT_SCHEMA_VERSION
        && !(manifest.schema_version == ENGLISH_SNAPSHOT_LEGACY_SCHEMA_VERSION
            && !require_unix_modes)
    {
        return Err(format!(
            "Unsupported English snapshot manifest schema {}; expected {}",
            manifest.schema_version, ENGLISH_SNAPSHOT_SCHEMA_VERSION
        ));
    }

    let expected = expected_mappings
        .iter()
        .map(|mapping| {
            (
                mapping.language_relative_path.clone(),
                mapping.asset_relative_path.clone(),
            )
        })
        .collect::<HashSet<_>>();
    let mut actual = HashSet::new();
    for entry in &manifest.entries {
        validate_relative_identity(
            &entry.language_relative_path,
            "English snapshot manifest language path",
        )?;
        validate_relative_identity(
            &entry.asset_relative_path,
            "English snapshot manifest asset path",
        )?;
        if !is_sha256_hex(&entry.sha256) {
            return Err(format!(
                "English snapshot manifest has invalid SHA-256 for {}",
                entry.language_relative_path
            ));
        }
        match entry.unix_mode {
            Some(mode) if mode <= 0o7777 => {}
            Some(mode) => {
                return Err(format!(
                    "English snapshot manifest has unsafe Unix mode {mode:o} for {}",
                    entry.language_relative_path
                ));
            }
            None if require_unix_modes => {
                return Err(format!(
                    "English snapshot manifest is missing the original Unix mode for {}",
                    entry.language_relative_path
                ));
            }
            None => {}
        }
        let identity = (
            entry.language_relative_path.clone(),
            entry.asset_relative_path.clone(),
        );
        if !actual.insert(identity.clone()) {
            return Err(format!(
                "English snapshot manifest repeats language/asset identity {}",
                entry.language_relative_path
            ));
        }
        if !expected.contains(&identity) {
            return Err(format!(
                "English snapshot manifest contains an unknown asset identity {} -> {}",
                entry.language_relative_path, entry.asset_relative_path
            ));
        }

        // `symlink_metadata` on the leaf alone cannot see a dangling/out-of-tree link in an
        // intermediate directory (it reports the leaf as simply missing). Walk every existing
        // component first so legacy `state_dir/en` and generation entries fail closed rather
        // than degrading to an incomplete `Ok(false)` result.
        validate_no_symlink_components(snapshot_dir, Path::new(&entry.language_relative_path))?;
        let snapshot_path = snapshot_dir.join(&entry.language_relative_path);
        match snapshot_path_presence(&snapshot_path)? {
            SnapshotPathPresence::Missing => return Ok(false),
            SnapshotPathPresence::Symlink => {
                return Err(format!(
                    "English snapshot entry is a symlink and cannot be trusted: {}",
                    snapshot_path.display()
                ));
            }
            SnapshotPathPresence::Present => {
                if !is_regular_file_without_symlink(&snapshot_path)? {
                    return Ok(false);
                }
            }
        }
        if sha256_file(&snapshot_path)? != entry.sha256.to_lowercase() {
            return Ok(false);
        }
    }
    if actual != expected {
        return Err(
            "English snapshot manifest is incomplete for the current plugin/core inventory"
                .to_string(),
        );
    }

    let mut files = Vec::new();
    collect_snapshot_files(snapshot_dir, snapshot_dir, &mut files)?;
    let mut expected_files = expected_mappings
        .iter()
        .map(|mapping| mapping.language_relative_path.clone())
        .collect::<HashSet<_>>();
    expected_files.insert(ENGLISH_SNAPSHOT_MANIFEST_NAME.to_string());
    let actual_files = files.into_iter().collect::<HashSet<_>>();
    if actual_files != expected_files {
        return Err("English snapshot contains files not covered by its manifest".to_string());
    }
    Ok(true)
}

/// Validate the English snapshot's canonical mapping, byte hashes, and (on macOS) original Unix
/// modes. A snapshot created by older releases without a manifest is accepted through a
/// structural compatibility path; old Windows schema-1 manifests remain readable, while a
/// macOS manifest without mode identity fails closed.
pub fn validate_english_snapshot(state_dir: &Path, app_path: &Path) -> Result<bool, String> {
    let snapshot_dir = resolve_snapshot_directory(state_dir, app_path, None)?;
    let mappings = snapshot_mappings(app_path)?;
    let manifest_path = snapshot_dir.join(ENGLISH_SNAPSHOT_MANIFEST_NAME);
    match snapshot_path_presence(&manifest_path)? {
        SnapshotPathPresence::Present => {
            return validate_snapshot_manifest(
                &snapshot_dir,
                &mappings,
                requires_unix_mode(app_path),
            );
        }
        SnapshotPathPresence::Symlink => {
            return Err(format!(
                "English snapshot manifest is a symlink and cannot be trusted: {}",
                manifest_path.display()
            ));
        }
        SnapshotPathPresence::Missing => {}
    }
    validate_legacy_snapshot_structure(state_dir, &snapshot_dir, &mappings)
}

pub fn validate_english_snapshot_manifest(
    state_dir: &Path,
    app_path: &Path,
) -> Result<bool, String> {
    let snapshot_dir = resolve_snapshot_directory(state_dir, app_path, None)?;
    let mappings = snapshot_mappings(app_path)?;
    let manifest_path = snapshot_dir.join(ENGLISH_SNAPSHOT_MANIFEST_NAME);
    match snapshot_path_presence(&manifest_path)? {
        SnapshotPathPresence::Missing => {
            if snapshot_path_presence(state_dir)? != SnapshotPathPresence::Missing {
                validate_legacy_snapshot_components(state_dir, &mappings)?;
            }
            return Ok(false);
        }
        SnapshotPathPresence::Symlink => {
            return Err(format!(
                "English snapshot manifest is a symlink and cannot be trusted: {}",
                manifest_path.display()
            ));
        }
        SnapshotPathPresence::Present => {}
    }
    validate_snapshot_manifest(&snapshot_dir, &mappings, requires_unix_mode(app_path))
}

/// Strict copy-pair construction used by snapshot/restore and overlay paths.  Every destination
/// is checked against the canonical relative mapping before any pair is returned.
pub fn build_copy_pairs_checked(
    source_dir: &Path,
    app_path: &Path,
) -> Result<Vec<CopyPair>, String> {
    let root = assets_root(app_path);
    let mut pairs = Vec::new();
    for mapping in snapshot_mappings(app_path)? {
        validate_mac_asset_components(app_path, Path::new(&mapping.asset_relative_path))?;
        let source_path = source_dir.join(&mapping.language_relative_path);
        if source_path.is_file() {
            pairs.push(CopyPair {
                src: source_path,
                dst: root.join(mapping.asset_relative_path),
            });
        }
    }
    Ok(pairs)
}

/// Compatibility wrapper for older command/tests.  An ambiguous inventory yields no writable
/// pairs instead of allowing a lossy basename collision to proceed.
pub fn build_copy_pairs(source_dir: &Path, app_path: &Path) -> Vec<CopyPair> {
    build_copy_pairs_checked(source_dir, app_path).unwrap_or_default()
}

pub fn build_overlay_pairs(
    source_dir: &Path,
    installed_english_dir: &Path,
    app_path: &Path,
    overlay_dir: &Path,
) -> Result<Vec<CopyPair>, String> {
    if requires_unix_mode(app_path) {
        return Err(
            "macOS overlay requires an immutable manifest digest; use build_mac_overlay_pairs_exact"
                .to_string(),
        );
    }
    build_overlay_pairs_inner(
        source_dir,
        installed_english_dir,
        app_path,
        overlay_dir,
        None,
    )
}

/// Build macOS overlay sources only after binding the snapshot's path/hash/mode manifest to the
/// caller's trusted immutable digest.  The resulting source files carry the vendor JSON mode,
/// not the snapshot store's private 0600 mode, and may then pass through `stage_files` without
/// losing that restoration property.
pub fn build_mac_overlay_pairs_exact(
    source_dir: &Path,
    installed_english_dir: &Path,
    app_path: &Path,
    overlay_dir: &Path,
    expected_manifest_sha256: &str,
) -> Result<Vec<CopyPair>, String> {
    if !requires_unix_mode(app_path) {
        return Err("build_mac_overlay_pairs_exact requires a macOS app layout".to_string());
    }
    let modes = mac_snapshot_modes(installed_english_dir, app_path, expected_manifest_sha256)?;
    build_overlay_pairs_inner(
        source_dir,
        installed_english_dir,
        app_path,
        overlay_dir,
        Some(modes),
    )
}

fn mac_snapshot_modes(
    installed_english_dir: &Path,
    app_path: &Path,
    expected_manifest_sha256: &str,
) -> Result<HashMap<String, u32>, String> {
    if expected_manifest_sha256.is_empty() {
        return Err("macOS overlay requires a non-empty English manifest digest".to_string());
    }
    let mappings = snapshot_mappings(app_path)?;
    if !validate_snapshot_manifest(installed_english_dir, &mappings, true)? {
        return Err(
            "macOS English overlay source failed its exact path/hash/mode manifest gate."
                .to_string(),
        );
    }
    let manifest_path = installed_english_dir.join(ENGLISH_SNAPSHOT_MANIFEST_NAME);
    let actual_manifest_sha256 = sha256_file(&manifest_path)?;
    if actual_manifest_sha256 != expected_manifest_sha256 {
        return Err(
            "macOS English overlay manifest digest does not match its trusted baseline".to_string(),
        );
    }
    let manifest = read_snapshot_manifest(installed_english_dir)?;
    manifest
        .entries
        .into_iter()
        .map(|entry| {
            let mode = entry.unix_mode.ok_or_else(|| {
                format!(
                    "macOS English overlay manifest has no original Unix mode for {}",
                    entry.language_relative_path
                )
            })?;
            Ok((entry.language_relative_path, mode))
        })
        .collect()
}

fn build_overlay_pairs_inner(
    source_dir: &Path,
    installed_english_dir: &Path,
    app_path: &Path,
    overlay_dir: &Path,
    mac_modes: Option<HashMap<String, u32>>,
) -> Result<Vec<CopyPair>, String> {
    let pairs = build_copy_pairs_checked(source_dir, app_path)?;
    let _ = fs::remove_dir_all(overlay_dir);
    fs::create_dir_all(overlay_dir).map_err(|error| error.to_string())?;

    pairs
        .into_iter()
        .enumerate()
        .map(|(index, pair)| {
            let relative = pair
                .src
                .strip_prefix(source_dir)
                .map_err(|_| format!("Language source escaped its root: {}", pair.src.display()))?;
            let installed_english_path = installed_english_dir.join(relative);
            if let Some(modes) = mac_modes.as_ref() {
                if !is_regular_file_without_symlink(&installed_english_path)? {
                    return Err(format!(
                        "macOS English snapshot source is missing or not a regular file: {}",
                        installed_english_path.display()
                    ));
                }
                if !modes.contains_key(&relative.to_string_lossy().replace('\\', "/")) {
                    return Err(format!(
                        "macOS English manifest has no mode for {}",
                        relative.display()
                    ));
                }
            } else if !installed_english_path.is_file() {
                return Err(format!(
                    "Installed English snapshot is missing {}",
                    installed_english_path.display()
                ));
            }

            let installed_english = read_json(&installed_english_path)?;
            let translation = read_json(&pair.src)?;
            let merged = merge_translation_overlay(&installed_english, &translation);
            // The index is intentionally the only temporary identity.  Using a source basename
            // here would reintroduce collisions for different plugin directories that happen to
            // share a file name.
            let overlay_path = overlay_dir.join(format!("{index}.json"));
            let bytes = serde_json::to_vec_pretty(&merged).map_err(|error| error.to_string())?;
            fs::write(&overlay_path, bytes).map_err(|error| {
                format!(
                    "Could not write merged translation {}: {error}",
                    overlay_path.display()
                )
            })?;
            if let Some(modes) = mac_modes.as_ref() {
                let key = relative.to_string_lossy().replace('\\', "/");
                apply_original_unix_mode(&overlay_path, Some(*modes.get(&key).unwrap()))?;
            } else {
                let permissions = fs::metadata(&installed_english_path)
                    .map_err(|error| error.to_string())?
                    .permissions();
                fs::set_permissions(&overlay_path, permissions)
                    .map_err(|error| error.to_string())?;
            }
            Ok(CopyPair {
                src: overlay_path,
                dst: pair.dst,
            })
        })
        .collect()
}

/// Construct exact macOS English restore sources from an immutable generation.  Snapshot files
/// are intentionally stored as private 0600 data; this API copies them into a caller-owned
/// staging directory and reapplies each manifest's original Unix mode before returning pairs.
/// The destination is never chmod'ed here; the outer transaction remains responsible for its
/// atomic write/rollback boundary.
pub fn build_mac_english_restore_pairs(
    installed_english_dir: &Path,
    app_path: &Path,
    staging_dir: &Path,
    expected_manifest_sha256: &str,
) -> Result<Vec<CopyPair>, String> {
    if !requires_unix_mode(app_path) {
        return Err("build_mac_english_restore_pairs requires a macOS app layout".to_string());
    }
    let modes = mac_snapshot_modes(installed_english_dir, app_path, expected_manifest_sha256)?;
    let mappings = snapshot_mappings(app_path)?;
    let manifest = read_snapshot_manifest(installed_english_dir)?;
    let _ = fs::remove_dir_all(staging_dir);
    fs::create_dir_all(staging_dir).map_err(|error| error.to_string())?;

    mappings
        .into_iter()
        .enumerate()
        .map(|(index, mapping)| {
            let source = installed_english_dir.join(&mapping.language_relative_path);
            if !is_regular_file_without_symlink(&source)? {
                return Err(format!(
                    "macOS English snapshot source is missing or not a regular file: {}",
                    source.display()
                ));
            }
            let entry = manifest
                .entries
                .iter()
                .find(|entry| {
                    entry.language_relative_path == mapping.language_relative_path
                        && entry.asset_relative_path == mapping.asset_relative_path
                })
                .ok_or_else(|| {
                    format!(
                        "macOS English manifest has no exact entry for {}",
                        mapping.asset_relative_path
                    )
                })?;
            let mode = entry.unix_mode.ok_or_else(|| {
                format!(
                    "macOS English manifest has no original Unix mode for {}",
                    mapping.language_relative_path
                )
            })?;
            if modes.get(&mapping.language_relative_path) != Some(&mode) {
                return Err(format!(
                    "macOS English manifest mode identity changed for {}",
                    mapping.language_relative_path
                ));
            }
            let staged = staging_dir.join(format!(
                "{index}-{}",
                entry.language_relative_path.replace('/', "-")
            ));
            fs::copy(&source, &staged).map_err(|error| {
                format!(
                    "Could not stage macOS English restore source {}: {error}",
                    source.display()
                )
            })?;
            apply_original_unix_mode(&staged, Some(mode))?;
            Ok(CopyPair {
                src: staged,
                dst: assets_root(app_path).join(&mapping.asset_relative_path),
            })
        })
        .collect()
}

/// Prove that every currently managed JSON destination is still the exact semantic postimage for
/// the durable language state and the verified English snapshot. This gate runs before process
/// shutdown or bundle mutation so same-version vendor/user drift cannot be silently overwritten.
pub fn verify_installed_asset_preimages(
    state_dir: &Path,
    app_path: &Path,
    immutable_revision: &str,
    current_language_source: Option<&Path>,
) -> Result<(), String> {
    let snapshot_dir = resolve_snapshot_directory(state_dir, app_path, Some(immutable_revision))?;
    if requires_unix_mode(app_path) {
        let identity = english_snapshot_identity(state_dir, app_path, immutable_revision)?;
        return verify_installed_asset_preimages_at_exact(
            &snapshot_dir,
            app_path,
            current_language_source,
            &identity.manifest_sha256,
        )
        .map(|_| ());
    }
    verify_installed_asset_preimages_at(&snapshot_dir, app_path, current_language_source)
}

/// Variant for callers that already hold a verified immutable generation. This prevents macOS
/// apply from resolving a second, independently published English pointer after it has loaded the
/// combined vendor/runtime baseline.
pub fn verify_installed_asset_preimages_at(
    snapshot_dir: &Path,
    app_path: &Path,
    current_language_source: Option<&Path>,
) -> Result<(), String> {
    if requires_unix_mode(app_path) {
        return Err(
            "macOS asset preimage verification requires a trusted manifest digest; use verify_installed_asset_preimages_at_exact"
                .to_string(),
        );
    }
    verify_windows_asset_preimages(snapshot_dir, app_path, current_language_source)
}

fn verify_windows_asset_preimages(
    snapshot_dir: &Path,
    app_path: &Path,
    current_language_source: Option<&Path>,
) -> Result<(), String> {
    let mappings = snapshot_mappings(app_path)?;
    if !validate_snapshot_manifest(&snapshot_dir, &mappings, false)? {
        return Err(
            "Installed asset identity cannot be verified because the English snapshot failed its manifest gate."
                .to_string(),
        );
    }
    if let Some(source_dir) = current_language_source {
        ensure_complete_core_source(source_dir)?;
    }

    let root = assets_root(app_path);
    for mapping in mappings {
        validate_mac_asset_components(app_path, Path::new(&mapping.asset_relative_path))?;
        let snapshot_path = snapshot_dir.join(&mapping.language_relative_path);
        let destination = root.join(&mapping.asset_relative_path);
        if !is_regular_file_without_symlink(&destination)? {
            return Err(format!(
                "Installed Cavalry asset preimage is missing, special, or symlinked: {}",
                destination.display()
            ));
        }

        let baseline = read_json(&snapshot_path)?;
        let expected = if let Some(source_dir) = current_language_source {
            let translation_path = source_dir.join(&mapping.language_relative_path);
            match fs::symlink_metadata(&translation_path) {
                Ok(metadata) if metadata.file_type().is_symlink() || !metadata.is_file() => {
                    return Err(format!(
                        "Current language source is not a regular non-symlink file: {}",
                        translation_path.display()
                    ));
                }
                Ok(_) => merge_translation_overlay(&baseline, &read_json(&translation_path)?),
                Err(error) if error.kind() == std::io::ErrorKind::NotFound => baseline,
                Err(error) => {
                    return Err(format!(
                        "Could not inspect current language source {}: {error}",
                        translation_path.display()
                    ));
                }
            }
        } else {
            baseline
        };
        let actual = read_json(&destination)?;
        if actual != expected {
            return Err(format!(
                "Cavalry asset drift detected before mutation at {}; restore the last managed language or reinstall Cavalry before retrying.",
                mapping.asset_relative_path
            ));
        }
    }
    Ok(())
}

/// Construct the exact macOS preimage evidence that a transaction can bind before it starts.
/// English uses the snapshot's raw bytes; a translated postimage uses the same keyed overlay
/// algorithm as `build_mac_overlay_pairs_exact` and canonical `serde_json::to_vec_pretty` bytes.
/// The trusted manifest digest is mandatory so a mode/hash edit in the private snapshot store is
/// rejected rather than becoming a new expected preimage.
pub fn expected_mac_asset_preimage_evidence(
    snapshot_dir: &Path,
    app_path: &Path,
    current_language_source: Option<&Path>,
    expected_manifest_sha256: &str,
) -> Result<Vec<AssetPreimageEvidence>, String> {
    if !requires_unix_mode(app_path) {
        return Err("expected_mac_asset_preimage_evidence requires a macOS app layout".to_string());
    }
    if expected_manifest_sha256.is_empty() {
        return Err("macOS asset preimage evidence requires a trusted manifest digest".to_string());
    }
    let mappings = snapshot_mappings(app_path)?;
    if !validate_snapshot_manifest(snapshot_dir, &mappings, true)? {
        return Err(
            "macOS English snapshot failed its exact path/hash/mode manifest gate".to_string(),
        );
    }
    let manifest_path = snapshot_dir.join(ENGLISH_SNAPSHOT_MANIFEST_NAME);
    let actual_manifest_sha256 = sha256_file(&manifest_path)?;
    if actual_manifest_sha256 != expected_manifest_sha256 {
        return Err(
            "macOS English snapshot manifest digest does not match its trusted baseline"
                .to_string(),
        );
    }
    if let Some(source_dir) = current_language_source {
        ensure_complete_core_source(source_dir)?;
    }
    let manifest = read_snapshot_manifest(snapshot_dir)?;
    let root = assets_root(app_path);
    let mut evidence = Vec::with_capacity(mappings.len());
    for mapping in mappings {
        let entry = manifest
            .entries
            .iter()
            .find(|entry| {
                entry.language_relative_path == mapping.language_relative_path
                    && entry.asset_relative_path == mapping.asset_relative_path
            })
            .ok_or_else(|| {
                format!(
                    "macOS English manifest has no exact preimage entry for {}",
                    mapping.asset_relative_path
                )
            })?;
        let mode = entry.unix_mode.ok_or_else(|| {
            format!(
                "macOS English manifest has no original Unix mode for {}",
                mapping.language_relative_path
            )
        })?;
        let snapshot_path = snapshot_dir.join(&mapping.language_relative_path);
        if !is_regular_file_without_symlink(&snapshot_path)? {
            return Err(format!(
                "macOS English snapshot preimage source is missing or not a regular file: {}",
                snapshot_path.display()
            ));
        }
        let baseline_bytes = fs::read(&snapshot_path).map_err(|error| {
            format!(
                "Could not read macOS English snapshot preimage {}: {error}",
                snapshot_path.display()
            )
        })?;
        let expected_bytes = if let Some(source_dir) = current_language_source {
            let relative = Path::new(&mapping.language_relative_path);
            validate_no_symlink_components(source_dir, relative)?;
            let translation_path = source_dir.join(relative);
            match fs::symlink_metadata(&translation_path) {
                Ok(metadata) if metadata.file_type().is_symlink() || !metadata.is_file() => {
                    return Err(format!(
                        "Current language source is not a regular non-symlink file: {}",
                        translation_path.display()
                    ));
                }
                Ok(_) => {
                    let baseline =
                        serde_json::from_slice::<Value>(&baseline_bytes).map_err(|error| {
                            format!(
                                "Invalid JSON in macOS English snapshot {}: {error}",
                                snapshot_path.display()
                            )
                        })?;
                    let translation = read_json(&translation_path)?;
                    let merged = merge_translation_overlay(&baseline, &translation);
                    serde_json::to_vec_pretty(&merged).map_err(|error| {
                        format!(
                            "Could not encode canonical macOS translated preimage {}: {error}",
                            mapping.asset_relative_path
                        )
                    })?
                }
                Err(error) if error.kind() == std::io::ErrorKind::NotFound => baseline_bytes,
                Err(error) => {
                    return Err(format!(
                        "Could not inspect current language source {}: {error}",
                        translation_path.display()
                    ));
                }
            }
        } else {
            baseline_bytes
        };
        evidence.push(AssetPreimageEvidence {
            destination: root.join(&mapping.asset_relative_path),
            sha256: sha256_bytes(&expected_bytes),
            unix_mode: Some(mode),
        });
    }
    Ok(evidence)
}

/// Verify a previously collected evidence vector at the transaction begin boundary.  This is
/// intentionally separate from evidence construction so the outer transaction can collect once,
/// then re-lstat/hash/mode-check immediately before its first write.
pub fn verify_asset_preimage_evidence(
    app_path: &Path,
    evidence: &[AssetPreimageEvidence],
) -> Result<(), String> {
    if evidence.is_empty() {
        return Err(
            "asset preimage evidence is empty; refusing an unbounded transaction".to_string(),
        );
    }
    let strict_mac = requires_unix_mode(app_path);
    if strict_mac {
        let root = assets_root(app_path);
        let expected_destinations = snapshot_mappings(app_path)?
            .into_iter()
            .map(|mapping| root.join(mapping.asset_relative_path))
            .collect::<HashSet<_>>();
        let actual_destinations = evidence
            .iter()
            .map(|item| item.destination.clone())
            .collect::<HashSet<_>>();
        if actual_destinations != expected_destinations
            || actual_destinations.len() != evidence.len()
        {
            return Err(
                "macOS asset preimage evidence is incomplete or contains duplicate/unknown destinations"
                    .to_string(),
            );
        }
    }

    let mut seen = HashSet::new();
    let root = assets_root(app_path);
    for item in evidence {
        if !seen.insert(item.destination.clone()) {
            return Err(format!(
                "asset preimage evidence repeats destination {}; refusing ambiguous verification",
                item.destination.display()
            ));
        }
        if strict_mac {
            let relative = item.destination.strip_prefix(&root).map_err(|_| {
                format!(
                    "macOS asset preimage destination escaped the assets root: {}",
                    item.destination.display()
                )
            })?;
            validate_mac_asset_components(app_path, relative)?;
            if item.unix_mode.is_none() {
                return Err(format!(
                    "macOS asset preimage evidence has no Unix mode: {}",
                    item.destination.display()
                ));
            }
        }
        if !is_regular_file_without_symlink(&item.destination)? {
            return Err(format!(
                "asset drift detected before mutation at {}: destination is missing, special, or symlinked",
                item.destination.display()
            ));
        }
        let actual_sha256 = sha256_file(&item.destination)?;
        if actual_sha256 != item.sha256 {
            return Err(format!(
                "asset drift detected before mutation at {}: exact bytes SHA-256 mismatch",
                item.destination.display()
            ));
        }
        let actual_mode = original_unix_mode(&item.destination)?;
        if actual_mode != item.unix_mode {
            return Err(format!(
                "asset drift detected before mutation at {}: Unix mode mismatch",
                item.destination.display()
            ));
        }
    }
    Ok(())
}

/// Exact macOS preflight/begin gate. The returned evidence is useful to an outer transaction
/// journal, while the verification itself remains available as a one-shot compatibility call.
pub fn verify_installed_asset_preimages_at_exact(
    snapshot_dir: &Path,
    app_path: &Path,
    current_language_source: Option<&Path>,
    expected_manifest_sha256: &str,
) -> Result<Vec<AssetPreimageEvidence>, String> {
    let evidence = expected_mac_asset_preimage_evidence(
        snapshot_dir,
        app_path,
        current_language_source,
        expected_manifest_sha256,
    )?;
    verify_asset_preimage_evidence(app_path, &evidence)?;
    Ok(evidence)
}

pub fn merge_translation_overlay(installed: &Value, translation: &Value) -> Value {
    match (installed, translation) {
        (Value::Object(installed), Value::Object(translation)) => {
            let mut merged = installed.clone();
            for (key, installed_value) in installed {
                if let Some(translated_value) = translation.get(key) {
                    merged.insert(
                        key.clone(),
                        merge_translation_overlay(installed_value, translated_value),
                    );
                }
            }
            Value::Object(merged)
        }
        (Value::Array(installed), Value::Array(translation)) => {
            let identities = partial_identity_map(translation);
            let positional_fallback_safe =
                identity_positions(installed) == identity_positions(translation);
            Value::Array(
                installed
                    .iter()
                    .enumerate()
                    .map(|(index, installed_value)| {
                        if let Some(identity) = item_identity(installed_value) {
                            return identities
                                .get(&identity)
                                .map(|translated| {
                                    merge_translation_overlay(installed_value, translated)
                                })
                                .unwrap_or_else(|| installed_value.clone());
                        }

                        if !positional_fallback_safe {
                            return installed_value.clone();
                        }
                        translation
                            .get(index)
                            .filter(|translated| item_identity(translated).is_none())
                            .filter(|translated| compatible_shape(installed_value, translated))
                            .map(|translated| {
                                merge_translation_overlay(installed_value, translated)
                            })
                            .unwrap_or_else(|| installed_value.clone())
                    })
                    .collect(),
            )
        }
        (Value::String(_), Value::String(_)) => translation.clone(),
        _ => installed.clone(),
    }
}

pub fn install_matches_language_source(source_dir: &Path, app_path: &Path) -> Result<bool, String> {
    ensure_complete_core_source(source_dir)?;

    let root = assets_root(app_path);
    let core_destinations = CORE_MAP
        .iter()
        .map(|(_, asset_relative)| root.join(asset_relative))
        .collect::<std::collections::HashSet<_>>();

    for pair in build_copy_pairs_checked(source_dir, app_path)? {
        if !pair.dst.is_file() {
            if core_destinations.contains(&pair.dst) {
                return Err(format!(
                    "Cavalry installation is missing required English proof input {}",
                    pair.dst.display()
                ));
            }
            continue;
        }
        let installed = read_json(&pair.dst)?;
        let candidate = read_json(&pair.src)?;
        if merge_translation_overlay(&installed, &candidate) != installed {
            return Ok(false);
        }
    }
    Ok(true)
}

pub fn snapshot_matches_language_source(
    source_dir: &Path,
    state_dir: &Path,
    app_path: &Path,
) -> Result<bool, String> {
    ensure_complete_core_source(source_dir)?;
    if !validate_english_snapshot_manifest(state_dir, app_path)? {
        return Ok(false);
    }
    let snapshot_dir = resolve_snapshot_directory(state_dir, app_path, None)?;

    for pair in build_copy_pairs_checked(source_dir, app_path)? {
        let relative = pair.src.strip_prefix(source_dir).map_err(|_| {
            format!(
                "English language source escaped its root: {}",
                pair.src.display()
            )
        })?;
        let snapshot = snapshot_dir.join(relative);
        if !snapshot.is_file() {
            if pair.dst.is_file() {
                return Ok(false);
            }
            continue;
        }
        let installed = read_json(&snapshot)?;
        let candidate = read_json(&pair.src)?;
        if merge_translation_overlay(&installed, &candidate) != installed {
            return Ok(false);
        }
    }
    Ok(true)
}

fn ensure_complete_core_source(source_dir: &Path) -> Result<(), String> {
    let missing_core = CORE_MAP
        .iter()
        .map(|(language_relative, _)| source_dir.join(language_relative))
        .filter(|path| !path.is_file())
        .collect::<Vec<_>>();
    if missing_core.is_empty() {
        return Ok(());
    }
    Err(format!(
        "English language source is incomplete; missing {}",
        missing_core
            .iter()
            .map(|path| path.display().to_string())
            .collect::<Vec<_>>()
            .join(", ")
    ))
}

fn read_json(path: &Path) -> Result<Value, String> {
    let bytes =
        fs::read(path).map_err(|error| format!("Could not read {}: {error}", path.display()))?;
    serde_json::from_slice(&bytes)
        .map_err(|error| format!("Invalid JSON in {}: {error}", path.display()))
}

fn partial_identity_map(values: &[Value]) -> HashMap<String, &Value> {
    let mut identities = HashMap::new();
    let mut duplicates = std::collections::HashSet::new();
    for value in values {
        let Some(identity) = item_identity(value) else {
            continue;
        };
        if identities.insert(identity.clone(), value).is_some() {
            duplicates.insert(identity);
        }
    }
    for duplicate in duplicates {
        identities.remove(&duplicate);
    }
    identities
}

fn identity_positions(values: &[Value]) -> Vec<(usize, String)> {
    values
        .iter()
        .enumerate()
        .filter_map(|(index, value)| item_identity(value).map(|identity| (index, identity)))
        .collect()
}

fn compatible_shape(installed: &Value, translation: &Value) -> bool {
    match (installed, translation) {
        (Value::Object(installed), Value::Object(translation)) => {
            let installed_type = installed.get("type").and_then(scalar_identity);
            let translated_type = translation.get("type").and_then(scalar_identity);
            if (installed_type.is_some() || translated_type.is_some())
                && installed_type != translated_type
            {
                return false;
            }
            translation.iter().all(|(key, translated_value)| {
                installed.get(key).is_some_and(|installed_value| {
                    same_json_kind(installed_value, translated_value)
                })
            })
        }
        (Value::Array(_), Value::Array(_))
        | (Value::String(_), Value::String(_))
        | (Value::Number(_), Value::Number(_))
        | (Value::Bool(_), Value::Bool(_))
        | (Value::Null, Value::Null) => true,
        _ => false,
    }
}

fn same_json_kind(left: &Value, right: &Value) -> bool {
    matches!(
        (left, right),
        (Value::Null, Value::Null)
            | (Value::Bool(_), Value::Bool(_))
            | (Value::Number(_), Value::Number(_))
            | (Value::String(_), Value::String(_))
            | (Value::Array(_), Value::Array(_))
            | (Value::Object(_), Value::Object(_))
    )
}

fn item_identity(value: &Value) -> Option<String> {
    let object = value.as_object()?;
    if let Some(node_type) = object
        .get("value")
        .and_then(Value::as_object)
        .and_then(|nested| nested.get("nodeType"))
        .and_then(Value::as_str)
    {
        return Some(format!("value.nodeType:{node_type}"));
    }
    if let Some(first_node_type) = object
        .get("values")
        .and_then(Value::as_array)
        .and_then(|values| values.first())
        .and_then(Value::as_object)
        .and_then(|first| first.get("nodeType"))
        .and_then(Value::as_str)
    {
        return Some(format!("values.first.nodeType:{first_node_type}"));
    }
    for key in ["nodeType", "id", "identifier", "name", "key"] {
        if let Some(identity) = object.get(key).and_then(scalar_identity) {
            return Some(format!("{key}:{identity}"));
        }
    }
    None
}

fn scalar_identity(value: &Value) -> Option<String> {
    match value {
        Value::String(value) => Some(value.clone()),
        Value::Number(value) => Some(value.to_string()),
        _ => None,
    }
}

pub fn stage_files(pairs: &[CopyPair], staging_dir: &Path) -> Result<Vec<CopyPair>, String> {
    let mut destinations = HashSet::new();
    for pair in pairs {
        let key = collision_key(&pair.dst.to_string_lossy());
        if !destinations.insert(key) {
            return Err(format!(
                "Duplicate staging destination {}; refusing overwrite",
                pair.dst.display()
            ));
        }
    }
    let _ = fs::remove_dir_all(staging_dir);
    fs::create_dir_all(staging_dir).map_err(|error| error.to_string())?;
    pairs
        .iter()
        .enumerate()
        .map(|(index, pair)| {
            if !is_regular_file_without_symlink(&pair.src)? {
                return Err(format!(
                    "Staging source is not a regular non-symlink file: {}",
                    pair.src.display()
                ));
            }
            let file_name = pair
                .src
                .file_name()
                .ok_or_else(|| format!("Missing file name: {}", pair.src.display()))?;
            let staged_path =
                staging_dir.join(format!("{}-{}", index, file_name.to_string_lossy()));
            fs::copy(&pair.src, &staged_path).map_err(|error| {
                format!(
                    "could not copy {} to {}: {error}",
                    pair.src.display(),
                    staged_path.display()
                )
            })?;
            let mode = fs::metadata(&pair.src)
                .map_err(|error| {
                    format!("could not read mode from {}: {error}", pair.src.display())
                })?
                .permissions();
            fs::set_permissions(&staged_path, mode).map_err(|error| error.to_string())?;
            Ok(CopyPair {
                src: staged_path,
                dst: pair.dst.clone(),
            })
        })
        .collect()
}

pub fn has_english_snapshot(state_dir: &Path, app_path: &Path) -> bool {
    validate_english_snapshot(state_dir, app_path).unwrap_or(false)
}

pub fn needs_english_snapshot(
    state_dir: &Path,
    provenance: Option<&EnglishSnapshotProvenance>,
    app_path: &Path,
    immutable_revision: &str,
) -> bool {
    if app_path.as_os_str().is_empty() {
        return false;
    }
    if immutable_revision.is_empty() {
        return true;
    }
    let Ok(identity) = english_snapshot_identity(state_dir, app_path, immutable_revision) else {
        return true;
    };
    provenance.is_none_or(|provenance| {
        provenance.install_root != app_path.to_string_lossy()
            || provenance.immutable_revision != immutable_revision
            || provenance.snapshot_generation.as_deref() != Some(identity.generation.as_str())
            || provenance.snapshot_manifest_sha256.as_deref()
                != Some(identity.manifest_sha256.as_str())
            || (cfg!(target_os = "macos")
                && InstallLayout::from_root(app_path).platform
                    == crate::install::InstallPlatform::Macos
                && provenance
                    .vendor_baseline_id
                    .as_deref()
                    .is_none_or(|baseline| {
                        baseline.len() != 64
                            || !baseline
                                .bytes()
                                .all(|byte| byte.is_ascii_hexdigit() && !byte.is_ascii_uppercase())
                    }))
    })
}

#[cfg(test)]
mod tests {
    use super::{build_copy_pairs, discover_plugins, extract_english, sync_file, CORE_MAP};
    use std::fs;

    fn write_json(path: &std::path::Path, value: &str) {
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::write(path, value).unwrap();
    }

    #[test]
    fn discover_plugins_to_camel_case() {
        let temp = tempfile::tempdir().unwrap();
        let app = temp.path().join("Cavalry.app");
        write_json(
            &app.join("Contents/assets/Plugins/Gaussian Blur Filter/strings.json"),
            "{}",
        );
        assert_eq!(discover_plugins(&app)[0].camel_name, "gaussianBlurFilter");
    }

    #[cfg(windows)]
    #[test]
    fn windows_snapshot_durability_uses_a_write_capable_handle() {
        let temp = tempfile::tempdir().unwrap();
        let path = temp.path().join("snapshot.json");
        fs::write(&path, b"durable").unwrap();

        sync_file(&path).expect("FlushFileBuffers requires a write-capable Windows handle");
    }

    #[test]
    fn extract_english_copies_core_files() {
        let temp = tempfile::tempdir().unwrap();
        let app = temp.path().join("Cavalry.app");
        for (_, asset_rel) in CORE_MAP {
            write_json(&app.join("Contents/assets").join(asset_rel), "{}");
        }
        let out = temp.path().join("en");
        let result = extract_english(&app, &out);
        assert!(result.is_ok());
        let count = result.unwrap();
        assert!(count >= CORE_MAP.len() as usize);
        assert!(out.join("nodeStrings.json").exists());
    }

    #[test]
    fn build_copy_pairs_matches_cavalry_assets() {
        let temp = tempfile::tempdir().unwrap();
        let app = temp.path().join("Cavalry.app");
        let source = temp.path().join("lang");
        for (lang_rel, asset_rel) in CORE_MAP {
            write_json(&app.join("Contents/assets").join(asset_rel), "{}");
            write_json(&source.join(lang_rel), "{}");
        }
        let pairs = build_copy_pairs(&source, &app);
        assert!(pairs.len() >= CORE_MAP.len());
        assert!(pairs.iter().any(|p| p
            .dst
            .ends_with("Contents/assets/Definitions/nodeStrings.json")));
    }
}
