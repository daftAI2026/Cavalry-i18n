/**
 * [INPUT]: 依赖编译期资源manifest、共享catalog冻结目标与平台宿主facade；Windows资源按实际盘符根验证reparse。
 * [OUTPUT]: 按preview/production-2.8模式验证当前2.8.1资源；固定目标及补充计数在编译期绑定。
 * [POS]: commands的资源边界；不写App、profile或状态。
 * manifest自报digest不作审批；preview与production分别绑定kind；production拒绝不完整pack；target摘要供baseline source复用。
 * status逐字绑定manifest，只核三份regular文件和长度，不读payload。
 * apply只读所选pack并验长度与SHA，不解析JSON value。
 * NativeResources完整读取仅供既有tests/smoke；状态digest不授予apply写许可。
 * host只核Info/main；catalog/schema源锁在构建期，hook ABI由加载映像门验证。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
use super::context::resource_candidates;
use serde::Deserialize;
use sha2::{Digest, Sha256};
use std::{
    collections::BTreeMap,
    fs,
    path::{Path, PathBuf},
};

const TARGET_BYTES: &[u8] = include_bytes!("../../../tools/cavalry_native_target.json");
const COMPILED_MANIFEST: &[u8] =
    include_bytes!(concat!(env!("OUT_DIR"), "/native_resource_manifest.json"));
const COMPILED_BUILD_MODE: &str = include_str!(concat!(env!("OUT_DIR"), "/native_build_mode.txt"));
pub(crate) const NATIVE_VERSION: &str = "2.8.1";
pub(crate) const PLUGIN_CAPTION_SUPPLEMENT_KEYS: usize = 1;
pub(crate) const BACKGROUND_RENDERING_GAP_KEYS: usize = 1;
const LANGUAGES: [&str; 3] = ["zh-Hans", "zh-Hant", "ja_JP"];

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Manifest {
    schema_version: u32,
    kind: String,
    cavalry_version: String,
    target_sha256: String,
    input_sha256: String,
    #[serde(rename = "approvedUIKeys")]
    approved_ui_keys: usize,
    native_keys: usize,
    supplemental_keys: usize,
    complete: bool,
    packs: BTreeMap<String, PackMetadata>,
}
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct PackMetadata {
    file: String,
    native_locale: String,
    sha256: String,
    bytes: usize,
    reviewed: usize,
    preserved: usize,
    vendor: usize,
    missing: usize,
}
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Target {
    schema_version: u32,
    qt_version: String,
    cavalry_version: String,
    bundle_id: String,
    executable: String,
    executable_sha256: String,
    native_keys: usize,
    supplemental_keys: usize,
    vendor_japanese_keys: usize,
    catalogs: Vec<CatalogLock>,
    runtime_files: Vec<RuntimeLock>,
    source_files: Vec<SourceFileLock>,
}
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CatalogLock {
    source: String,
    source_sha256: String,
    japanese: String,
    japanese_sha256: String,
}
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RuntimeLock {
    path: String,
    sha256: String,
}
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct SourceFileLock {
    path: String,
    sha256: String,
}
#[cfg(test)]
#[derive(Debug)]
pub(crate) struct NativeResources {
    pub(crate) packs: BTreeMap<String, Vec<u8>>,
}
#[derive(Debug)]
pub(crate) struct NativeResourceDigests {
    pub(crate) packs: BTreeMap<String, String>,
}
fn resource_profile(mode: &str) -> Option<(&'static str, bool)> {
    match mode.trim() {
        "debug-preview" | "release-candidate" => Some(("development-preview", false)),
        "production-2.8" => Some(("production-2.8", true)),
        _ => None,
    }
}
fn manifest_profile_matches(mode: &str, kind: &str, complete: bool) -> bool {
    resource_profile(mode).is_some_and(|(expected_kind, require_complete)| {
        kind == expected_kind && (!require_complete || complete)
    })
}

pub(crate) fn preview_enabled() -> bool {
    !COMPILED_MANIFEST.is_empty()
        && matches!(
            COMPILED_BUILD_MODE.trim(),
            "debug-preview" | "release-candidate"
        )
}

pub(crate) fn production_enabled() -> bool {
    !COMPILED_MANIFEST.is_empty() && COMPILED_BUILD_MODE.trim() == "production-2.8"
}

pub(crate) fn native_runtime_enabled() -> bool {
    preview_enabled() || production_enabled()
}
fn hash(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}
pub(crate) fn baseline_target_sha256() -> String {
    hash(TARGET_BYTES)
}

fn target() -> Result<Target, String> {
    let target: Target = serde_json::from_slice(TARGET_BYTES).map_err(|e| e.to_string())?;
    let mut paths = target
        .runtime_files
        .iter()
        .map(|lock| lock.path.as_str())
        .collect::<Vec<_>>();
    paths.sort();
    if target.schema_version != 1
        || target.qt_version != "6.9.2"
        || target.cavalry_version != NATIVE_VERSION
        || target.bundle_id != "com.scenegroup.cavalry"
        || target.executable != "Contents/MacOS/Cavalry"
        || target.native_keys != 10468
        || target.supplemental_keys != 373
        || target.source_files.len() != 1
        || target.source_files[0].path != "Definitions/nodeDefinitions.json"
        || target.source_files[0].sha256
            != "d3acdbcc8da60354d57674cc3ae0025409f06e66758646114f808a43c29321af"
        || target.vendor_japanese_keys != 390
        || target.catalogs.len() != 17
        || paths
            != [
                "Contents/Frameworks/QtCore.framework/Versions/A/QtCore",
                "Contents/Frameworks/libApi.dylib",
                "Contents/Frameworks/libCore.dylib",
            ]
    {
        return Err("native target contract differs".into());
    }
    Ok(target)
}

// -- 资源读取不跟随任何路径链symlink；manifest固定于同一编译候选 -----
fn regular_metadata(path: &Path) -> Result<fs::Metadata, String> {
    if !path.is_absolute() {
        return Err("native paths must be absolute".into());
    }
    let root = path.ancestors().last().ok_or("native path has no root")?;
    let relative = path
        .strip_prefix(root)
        .map_err(|_| "native paths must be absolute")?;
    crate::install::validate_no_symlink_components(root, relative)?;
    #[cfg(windows)]
    crate::privilege::verify_windows_path_components(root, path)?;
    let metadata = fs::symlink_metadata(path).map_err(|e| e.to_string())?;
    if !metadata.is_file() || metadata.file_type().is_symlink() {
        return Err("native resource is not a regular file".into());
    }
    Ok(metadata)
}
fn regular_bytes(path: &Path) -> Result<Vec<u8>, String> {
    regular_metadata(path)?;
    fs::read(path).map_err(|e| e.to_string())
}
fn regular_file_size(path: &Path) -> Result<u64, String> {
    Ok(regular_metadata(path)?.len())
}
fn approved_manifest_at(root: &Path, compiled: &[u8], mode: &str) -> Result<Manifest, String> {
    resource_profile(mode).ok_or("native runtime was not enabled at compile time")?;
    if compiled.is_empty() {
        return Err("native runtime was not enabled at compile time".into());
    }
    let bytes = regular_bytes(&root.join("manifest.json"))?;
    if bytes != compiled {
        return Err("native manifest differs from the compiled approval".into());
    }
    let manifest: Manifest = serde_json::from_slice(&bytes).map_err(|e| e.to_string())?;
    let target = target()?;
    if manifest.schema_version != 1
        || !manifest_profile_matches(mode, &manifest.kind, manifest.complete)
        || manifest.cavalry_version != NATIVE_VERSION
        || manifest.target_sha256 != hash(TARGET_BYTES)
        || manifest.supplemental_keys
            != target.supplemental_keys
                + PLUGIN_CAPTION_SUPPLEMENT_KEYS
                + BACKGROUND_RENDERING_GAP_KEYS
        || manifest.native_keys
            != target.native_keys
                + target.supplemental_keys
                + PLUGIN_CAPTION_SUPPLEMENT_KEYS
                + BACKGROUND_RENDERING_GAP_KEYS
        || manifest.approved_ui_keys == 0
        || manifest.approved_ui_keys > manifest.native_keys
        || manifest.input_sha256.len() != 64
        || !manifest.input_sha256.bytes().all(|b| b.is_ascii_hexdigit())
        || manifest.packs.len() != LANGUAGES.len()
    {
        return Err("native manifest target/shape differs".into());
    }
    let mut complete = true;
    for language in LANGUAGES {
        let info = manifest
            .packs
            .get(language)
            .ok_or("native manifest lacks a product language")?;
        if info.file != format!("{language}.json")
            || info.native_locale != super::user_language::native_locale_for(language)?
            || info.reviewed + info.preserved + info.vendor + info.missing != manifest.native_keys
            || info.vendor
                != if language == "ja_JP" {
                    target.vendor_japanese_keys
                } else {
                    0
                }
            || info.bytes == 0
        {
            return Err("native payload metadata differs".into());
        }
        complete &= info.missing == 0;
    }
    if complete != manifest.complete {
        return Err("native coverage claim differs".into());
    }
    Ok(manifest)
}
fn load_approved_pack_at(
    root: &Path,
    manifest: &Manifest,
    language: &str,
) -> Result<Vec<u8>, String> {
    if !LANGUAGES.contains(&language) {
        return Err("native manifest lacks a product language".into());
    }
    let info = manifest
        .packs
        .get(language)
        .ok_or("native manifest lacks a product language")?;
    let bytes = regular_bytes(&root.join(&info.file))?;
    if bytes.len() != info.bytes || hash(&bytes) != info.sha256 {
        return Err("native payload digest differs".into());
    }
    Ok(bytes)
}
fn load_status_at(
    root: &Path,
    compiled: &[u8],
    mode: &str,
) -> Result<NativeResourceDigests, String> {
    let manifest = approved_manifest_at(root, compiled, mode)?;
    let mut packs = BTreeMap::new();
    for language in LANGUAGES {
        let info = manifest
            .packs
            .get(language)
            .ok_or("native manifest lacks a product language")?;
        if regular_file_size(&root.join(&info.file))? != info.bytes as u64 {
            return Err("native payload size differs".into());
        }
        packs.insert(language.into(), info.sha256.clone());
    }
    Ok(NativeResourceDigests { packs })
}
fn load_language_at(
    root: &Path,
    compiled: &[u8],
    language: &str,
    mode: &str,
) -> Result<Vec<u8>, String> {
    let manifest = approved_manifest_at(root, compiled, mode)?;
    load_approved_pack_at(root, &manifest, language)
}
#[cfg(test)]
fn load_at_for_mode(root: &Path, compiled: &[u8], mode: &str) -> Result<NativeResources, String> {
    let manifest = approved_manifest_at(root, compiled, mode)?;
    let mut packs = BTreeMap::new();
    for language in LANGUAGES {
        packs.insert(
            language.into(),
            load_approved_pack_at(root, &manifest, language)?,
        );
    }
    Ok(NativeResources { packs })
}
#[cfg(test)]
fn validate_pack(bytes: &[u8], locale: &str, keys: usize) -> Result<(), String> {
    let value: serde_json::Value = serde_json::from_slice(bytes).map_err(|e| e.to_string())?;
    let records = value.as_array().ok_or("native pack is not an array")?;
    if records.len() != 1 {
        return Err("native pack must contain one record".into());
    }
    let record = records[0]
        .as_object()
        .ok_or("native record is not an object")?;
    if record.len() != 3
        || record.get("type").and_then(|v| v.as_str()) != Some("strings")
        || record.get("language").and_then(|v| v.as_str()) != Some(locale)
    {
        return Err("native record shape/locale differs".into());
    }
    let rows = record
        .get("value")
        .and_then(|v| v.as_object())
        .ok_or("native pack lacks values")?;
    if rows.len() != keys
        || rows.iter().any(|(key, leaf)| {
            key.is_empty()
                || leaf.as_object().is_none_or(|fields| fields.len() != 1)
                || leaf
                    .get("UI-text")
                    .and_then(|v| v.as_str())
                    .is_none_or(|text| text.trim().is_empty())
        })
    {
        return Err("native display-only values differ".into());
    }
    Ok(())
}
fn resource_root(repo: &Path, resources: &Path) -> Result<PathBuf, String> {
    let directory = "native-language-packs";
    let candidates = resource_candidates(
        repo,
        resources,
        &[
            PathBuf::from(directory),
            PathBuf::from("target").join(directory),
        ],
        &Path::new("src-tauri/target").join(directory),
    );
    candidates
        .into_iter()
        .find(|p| fs::symlink_metadata(p).is_ok())
        .ok_or_else(|| "native resource bundle is unavailable".into())
}
#[cfg(test)]
pub(crate) fn load_resources(repo: &Path, resources: &Path) -> Result<NativeResources, String> {
    load_at_for_mode(
        &resource_root(repo, resources)?,
        COMPILED_MANIFEST,
        COMPILED_BUILD_MODE,
    )
}
pub(crate) fn load_status_resources(
    repo: &Path,
    resources: &Path,
) -> Result<NativeResourceDigests, String> {
    load_status_at(
        &resource_root(repo, resources)?,
        COMPILED_MANIFEST,
        COMPILED_BUILD_MODE,
    )
}
pub(crate) fn load_language_resource(
    repo: &Path,
    resources: &Path,
    language: &str,
) -> Result<Vec<u8>, String> {
    load_language_at(
        &resource_root(repo, resources)?,
        COMPILED_MANIFEST,
        language,
        COMPILED_BUILD_MODE,
    )
}

// -- 启动只看bundle显示身份，不用2.7旧JSON布局决定2.8是否存在 -----
#[cfg(target_os = "windows")]
pub(crate) fn observe_install(selection: &Path) -> Result<(PathBuf, String), String> {
    super::native_windows::observe_install(selection)
}

#[cfg(target_os = "macos")]
pub(crate) fn observe_install(selection: &Path) -> Result<(PathBuf, String), String> {
    let app = crate::install::canonical_root_for_selection(selection)?;
    let info = plist::Value::from_reader(std::io::Cursor::new(regular_bytes(
        &app.join("Contents/Info.plist"),
    )?))
    .map_err(|e| e.to_string())?;
    let info = info
        .as_dictionary()
        .ok_or("native install lacks plist dictionary")?;
    if info
        .get("CFBundleIdentifier")
        .and_then(plist::Value::as_string)
        != Some("com.scenegroup.cavalry")
    {
        return Err("selected bundle is not Cavalry".into());
    }
    let version = info
        .get("CFBundleShortVersionString")
        .and_then(plist::Value::as_string)
        .filter(|s| !s.trim().is_empty())
        .ok_or("Cavalry lacks display version")?
        .to_string();
    let executable = info
        .get("CFBundleExecutable")
        .and_then(plist::Value::as_string)
        .ok_or("Cavalry lacks executable identity")?;
    if !matches!(executable, "Cavalry" | "CavalryLauncher") {
        return Err("Cavalry executable identity differs".into());
    }
    let executable = app.join("Contents/MacOS").join(executable);
    crate::install::validate_no_symlink_components(
        &app,
        executable
            .strip_prefix(&app)
            .map_err(|_| "Cavalry path differs")?,
    )?;
    if !fs::symlink_metadata(executable)
        .map_err(|e| e.to_string())?
        .is_file()
    {
        return Err("Cavalry executable is missing".into());
    }
    Ok((app, version))
}

// -- 写入前宿主证明：仅原厂2.8目标，拒绝旧wrapper/源漂移，不修补bundle --
#[cfg(target_os = "macos")]
pub(crate) fn verify_host(app: &Path) -> Result<(), String> {
    verify_host_with_target(app, &target()?)
}
#[cfg(target_os = "macos")]
fn verify_host_with_target(app: &Path, target: &Target) -> Result<(), String> {
    let plist_bytes = regular_bytes(&app.join("Contents/Info.plist"))?;
    let info =
        plist::Value::from_reader(std::io::Cursor::new(plist_bytes)).map_err(|e| e.to_string())?;
    let info = info
        .as_dictionary()
        .ok_or("native host lacks Info.plist dictionary")?;
    for (key, expected) in [
        ("CFBundleIdentifier", target.bundle_id.as_str()),
        (
            "CFBundleShortVersionString",
            target.cavalry_version.as_str(),
        ),
        ("CFBundleExecutable", "Cavalry"),
    ] {
        if info.get(key).and_then(plist::Value::as_string) != Some(expected) {
            return Err(format!("native host identity differs: {key}"));
        }
    }
    if hash(&regular_bytes(&app.join(&target.executable))?) != target.executable_sha256 {
        return Err("native host executable digest differs".into());
    }
    Ok(())
}

#[cfg(test)]
#[path = "native_resources_tests.rs"]
mod tests;
