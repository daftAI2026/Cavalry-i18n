/**
 * [INPUT]: 依赖 install 的跨平台布局、state 保存路径与 windows_install 的只读发现线索
 * [OUTPUT]: 对外提供保存路径优先、macOS 用户域先于系统域的候选发现、安装根解析、展示版本、macOS 2.7.2 typed identity/official baseline fingerprint、仅归一 LC_CODE_SIGNATURE 与签名末端所证明 __LINKEDIT extent 的 Mach-O code identity、不可变 revision、语言选项与安装诊断
 * [POS]: src-tauri/src 的安装探测模块；严格写入入口分离 canonical root、bundle/version/architecture 与不可变文件身份，不能只凭 bundle-version 接受伪造 Cavalry.app
 * [FAIL-CLOSED]: read_mac_bundle_identity/require_supported_mac_identity 缺少完整 Info.plist、主 executable、libExtensionLayer 或 Mach-O 架构时失败；Team ID/designated requirement 明确标为 unavailable，需 privilege runner 提供签名证据后才可升级为 verified
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#[cfg(target_os = "windows")]
use std::collections::HashSet;
use std::{
    fs,
    io::Read,
    path::{Path, PathBuf},
};

#[cfg(not(windows))]
use std::{
    collections::HashMap,
    sync::{Mutex, OnceLock},
    time::UNIX_EPOCH,
};

use plist::Value as PlistValue;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

#[cfg(target_os = "macos")]
use std::env;

#[cfg(target_os = "windows")]
use crate::install::normalize_path;
use crate::{
    install::{InstallLayout, InstallPlatform},
    windows_install,
};

#[derive(Debug, PartialEq, Eq)]
pub struct BundleInfo {
    pub exists: bool,
    pub app_path: String,
    pub version: String,
    pub has_assets_root: bool,
    pub has_definitions: bool,
    pub has_learn: bool,
    pub has_plugins: bool,
}

pub const SUPPORTED_CAVALRY_VERSION: &str = "2.7.2";
pub const SUPPORTED_CAVALRY_BUNDLE_ID: &str = "com.scenegroup.cavalry";
pub const SUPPORTED_CAVALRY_TEAM_ID: &str = "TB4YVNQHVC";
pub const MACOS_MAIN_EXECUTABLE_RELATIVE_PATH: &str = "Contents/MacOS/Cavalry";
pub const MACOS_EXTENSION_LAYER_RELATIVE_PATH: &str = "Contents/Frameworks/libExtensionLayer.dylib";

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum MacBundleCompatibility {
    Cavalry272,
    Unsupported { reason: String },
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum MacSignatureVerification {
    Unavailable { reason: String },
    Verified,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct MacSignatureIdentity {
    pub team_id: Option<String>,
    pub designated_requirement: Option<String>,
    pub verification: MacSignatureVerification,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct MacBundleIdentity {
    pub canonical_root: String,
    pub bundle_id: String,
    pub short_version: String,
    pub build_version: String,
    pub compatibility: MacBundleCompatibility,
    pub architectures: Vec<String>,
    pub main_executable: String,
    /// Exact bytes for the within-operation TOCTOU gate, including the current code signature.
    pub main_executable_sha256: String,
    /// Mach-O code identity with LC_CODE_SIGNATURE payload/size normalized so a controlled
    /// vendor-to-ad-hoc re-sign does not invent a new Cavalry revision.
    pub main_executable_code_sha256: String,
    pub extension_layer_sha256: String,
    pub official_baseline_fingerprint: String,
    pub signature: MacSignatureIdentity,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum MacIdentityError {
    Read(String),
    Mismatch {
        field: String,
        expected: String,
        actual: String,
    },
    Unsupported(String),
    SignatureUnavailable(String),
}

impl std::fmt::Display for MacIdentityError {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Read(detail) => write!(formatter, "could not read Cavalry identity: {detail}"),
            Self::Mismatch {
                field,
                expected,
                actual,
            } => write!(
                formatter,
                "Cavalry identity mismatch for {field}: expected {expected:?}, got {actual:?}"
            ),
            Self::Unsupported(detail) => {
                write!(formatter, "unsupported Cavalry installation: {detail}")
            }
            Self::SignatureUnavailable(detail) => {
                write!(
                    formatter,
                    "Cavalry signature identity is unavailable: {detail}"
                )
            }
        }
    }
}

impl std::error::Error for MacIdentityError {}

pub fn default_app_candidates() -> Vec<PathBuf> {
    #[cfg(target_os = "macos")]
    {
        let mut candidates = Vec::with_capacity(2);
        if let Some(home) = env::var_os("HOME") {
            candidates.push(PathBuf::from(home).join("Applications").join("Cavalry.app"));
        }
        candidates.push(PathBuf::from("/Applications/Cavalry.app"));
        return candidates;
    }

    #[cfg(target_os = "windows")]
    {
        let candidates = windows_install::running_process_candidates()
            .into_iter()
            .chain(windows_install::msi_shortcut_candidates())
            .chain(windows_install::common_install_candidates())
            .filter_map(|candidate| InstallLayout::from_selection(&candidate).ok())
            .map(|layout| layout.root)
            .collect::<Vec<_>>();
        return dedupe_paths(candidates);
    }

    #[allow(unreachable_code)]
    Vec::new()
}

pub fn find_cavalry_app(state_app_path: &str) -> PathBuf {
    find_cavalry_app_from_candidates(state_app_path, default_app_candidates())
}

pub fn find_cavalry_app_from_candidates(
    state_app_path: &str,
    candidates: impl IntoIterator<Item = PathBuf>,
) -> PathBuf {
    let saved = (!state_app_path.trim().is_empty()).then(|| PathBuf::from(state_app_path));
    saved
        .into_iter()
        .chain(candidates)
        .filter_map(|candidate| InstallLayout::from_selection(&candidate).ok())
        .find(|layout| layout.is_valid())
        .map(|layout| layout.root)
        .unwrap_or_default()
}

pub fn find_verified_cavalry_app_from_candidates(
    state_app_path: &str,
    candidates: impl IntoIterator<Item = PathBuf>,
) -> Result<PathBuf, MacIdentityError> {
    let saved = (!state_app_path.trim().is_empty()).then(|| PathBuf::from(state_app_path));
    let candidate = saved
        .into_iter()
        .chain(candidates)
        .find_map(|candidate| {
            InstallLayout::from_verified_selection(&candidate)
                .ok()
                .map(|layout| layout.root)
        })
        .ok_or_else(|| {
            MacIdentityError::Unsupported(
                "no canonical, structurally valid Cavalry installation candidate".to_string(),
            )
        })?;
    let layout = resolve_verified_install(&candidate)?;
    Ok(layout.root)
}

pub fn resolve_install(selection: &Path) -> Result<InstallLayout, String> {
    let layout = InstallLayout::from_selection(selection)?;
    layout.validate()?;
    Ok(layout)
}

/// Strict macOS installation resolver for staging/write callers. It is intentionally separate
/// from resolve_install so old discovery fixtures and Windows paths keep their compatibility
/// behavior until the root transaction wires this gate into its privilege boundary.
pub fn resolve_verified_install(selection: &Path) -> Result<InstallLayout, MacIdentityError> {
    let layout =
        InstallLayout::from_verified_selection(selection).map_err(MacIdentityError::Read)?;
    match layout.platform {
        InstallPlatform::Macos => {
            require_supported_mac_identity(&layout.root)?;
            Ok(layout)
        }
        InstallPlatform::Windows => Ok(layout),
    }
}

pub fn read_mac_bundle_identity(app_path: &Path) -> Result<MacBundleIdentity, MacIdentityError> {
    let layout =
        InstallLayout::from_verified_selection(app_path).map_err(MacIdentityError::Read)?;
    if layout.platform != InstallPlatform::Macos {
        return Err(MacIdentityError::Unsupported(
            "macOS bundle identity was requested for a Windows installation".to_string(),
        ));
    }

    let info_path = layout.root.join("Contents").join("Info.plist");
    let info = read_info_plist(&info_path).map_err(MacIdentityError::Read)?;
    let bundle_id = read_plist_string(&info, "CFBundleIdentifier").ok_or_else(|| {
        MacIdentityError::Read("Info.plist has no CFBundleIdentifier".to_string())
    })?;
    let short_version =
        read_plist_string(&info, "CFBundleShortVersionString").ok_or_else(|| {
            MacIdentityError::Read("Info.plist has no CFBundleShortVersionString".to_string())
        })?;
    let build_version = read_plist_string(&info, "CFBundleVersion")
        .ok_or_else(|| MacIdentityError::Read("Info.plist has no CFBundleVersion".to_string()))?;
    let bundle_executable = read_plist_string(&info, "CFBundleExecutable").ok_or_else(|| {
        MacIdentityError::Read("Info.plist has no CFBundleExecutable".to_string())
    })?;
    if !matches!(bundle_executable.as_str(), "Cavalry" | "CavalryLauncher") {
        return Err(MacIdentityError::Mismatch {
            field: "CFBundleExecutable".to_string(),
            expected: "Cavalry or CavalryLauncher".to_string(),
            actual: bundle_executable,
        });
    }

    let main_path = layout.root.join(MACOS_MAIN_EXECUTABLE_RELATIVE_PATH);
    let extension_path = layout.root.join(MACOS_EXTENSION_LAYER_RELATIVE_PATH);
    reject_symlink_file(&main_path)?;
    reject_symlink_file(&extension_path)?;
    let main_bytes = fs::read(&main_path).map_err(|error| {
        MacIdentityError::Read(format!("could not read {}: {error}", main_path.display()))
    })?;
    let extension_bytes = fs::read(&extension_path).map_err(|error| {
        MacIdentityError::Read(format!(
            "could not read {}: {error}",
            extension_path.display()
        ))
    })?;
    let architectures = macho_architectures(&main_bytes).map_err(MacIdentityError::Read)?;
    let extension_architectures =
        macho_architectures(&extension_bytes).map_err(MacIdentityError::Read)?;
    if architectures != extension_architectures {
        return Err(MacIdentityError::Mismatch {
            field: "architectures".to_string(),
            expected: format!("{architectures:?}"),
            actual: format!("{extension_architectures:?} in libExtensionLayer.dylib"),
        });
    }
    if architectures.is_empty() {
        return Err(MacIdentityError::Read(
            "Cavalry executable has no supported Mach-O architecture".to_string(),
        ));
    }

    let main_executable_sha256 = sha256_bytes(&main_bytes);
    let main_executable_code_sha256 =
        macho_code_identity_sha256(&main_bytes).map_err(MacIdentityError::Read)?;
    let extension_layer_sha256 = sha256_bytes(&extension_bytes);
    let official_baseline_fingerprint = official_baseline_fingerprint(
        &bundle_id,
        &short_version,
        &build_version,
        &architectures,
        &main_executable_code_sha256,
    );
    let compatibility = if bundle_id == SUPPORTED_CAVALRY_BUNDLE_ID
        && short_version == SUPPORTED_CAVALRY_VERSION
        && build_version == SUPPORTED_CAVALRY_VERSION
        && architectures
            .iter()
            .all(|architecture| matches!(architecture.as_str(), "arm64" | "x86_64"))
    {
        MacBundleCompatibility::Cavalry272
    } else {
        MacBundleCompatibility::Unsupported {
            reason: format!(
                "expected {SUPPORTED_CAVALRY_BUNDLE_ID} / {SUPPORTED_CAVALRY_VERSION} with arm64 or x86_64"
            ),
        }
    };

    Ok(MacBundleIdentity {
        canonical_root: layout.root.to_string_lossy().to_string(),
        bundle_id,
        short_version,
        build_version,
        compatibility,
        architectures,
        main_executable: MACOS_MAIN_EXECUTABLE_RELATIVE_PATH.to_string(),
        main_executable_sha256,
        main_executable_code_sha256,
        extension_layer_sha256,
        official_baseline_fingerprint,
        signature: MacSignatureIdentity {
            team_id: None,
            designated_requirement: None,
            verification: MacSignatureVerification::Unavailable {
                reason:
                    "pure file-layer inspection cannot establish codesign Team ID or designated requirement"
                        .to_string(),
            },
        },
    })
}

pub fn require_supported_mac_identity(
    app_path: &Path,
) -> Result<MacBundleIdentity, MacIdentityError> {
    let identity = read_mac_bundle_identity(app_path)?;
    if identity.bundle_id != SUPPORTED_CAVALRY_BUNDLE_ID {
        return Err(MacIdentityError::Mismatch {
            field: "bundleId".to_string(),
            expected: SUPPORTED_CAVALRY_BUNDLE_ID.to_string(),
            actual: identity.bundle_id.clone(),
        });
    }
    if identity.short_version != SUPPORTED_CAVALRY_VERSION {
        return Err(MacIdentityError::Mismatch {
            field: "shortVersion".to_string(),
            expected: SUPPORTED_CAVALRY_VERSION.to_string(),
            actual: identity.short_version.clone(),
        });
    }
    if identity.build_version != SUPPORTED_CAVALRY_VERSION {
        return Err(MacIdentityError::Mismatch {
            field: "buildVersion".to_string(),
            expected: SUPPORTED_CAVALRY_VERSION.to_string(),
            actual: identity.build_version.clone(),
        });
    }
    if identity.architectures.is_empty()
        || identity
            .architectures
            .iter()
            .any(|architecture| !matches!(architecture.as_str(), "arm64" | "x86_64"))
    {
        return Err(MacIdentityError::Unsupported(format!(
            "unsupported Mach-O architecture set {:?}",
            identity.architectures
        )));
    }
    if !matches!(identity.compatibility, MacBundleCompatibility::Cavalry272) {
        return Err(MacIdentityError::Unsupported(
            "bundle is not the supported Cavalry 2.7.2 identity".to_string(),
        ));
    }
    Ok(identity)
}

/// Compare a fresh read against the trusted pre-write identity. The canonical root and all
/// immutable content fields are checked; a changed executable or ExtensionLayer cannot pass by
/// retaining the old bundle version.
pub fn verify_mac_bundle_identity(
    app_path: &Path,
    expected: &MacBundleIdentity,
) -> Result<MacBundleIdentity, MacIdentityError> {
    let actual = read_mac_bundle_identity(app_path)?;
    for (field, expected_value, actual_value) in [
        (
            "canonicalRoot",
            expected.canonical_root.clone(),
            actual.canonical_root.clone(),
        ),
        (
            "bundleId",
            expected.bundle_id.clone(),
            actual.bundle_id.clone(),
        ),
        (
            "shortVersion",
            expected.short_version.clone(),
            actual.short_version.clone(),
        ),
        (
            "buildVersion",
            expected.build_version.clone(),
            actual.build_version.clone(),
        ),
        (
            "mainExecutable",
            expected.main_executable.clone(),
            actual.main_executable.clone(),
        ),
        (
            "mainExecutableSha256",
            expected.main_executable_sha256.clone(),
            actual.main_executable_sha256.clone(),
        ),
        (
            "mainExecutableCodeSha256",
            expected.main_executable_code_sha256.clone(),
            actual.main_executable_code_sha256.clone(),
        ),
        (
            "extensionLayerSha256",
            expected.extension_layer_sha256.clone(),
            actual.extension_layer_sha256.clone(),
        ),
        (
            "officialBaselineFingerprint",
            expected.official_baseline_fingerprint.clone(),
            actual.official_baseline_fingerprint.clone(),
        ),
    ] {
        if expected_value != actual_value {
            return Err(MacIdentityError::Mismatch {
                field: field.to_string(),
                expected: expected_value,
                actual: actual_value,
            });
        }
    }
    if expected.architectures != actual.architectures {
        return Err(MacIdentityError::Mismatch {
            field: "architectures".to_string(),
            expected: format!("{:?}", expected.architectures),
            actual: format!("{:?}", actual.architectures),
        });
    }
    Ok(actual)
}

/// Signature verification is intentionally a separate typed gate. A pure filesystem identity
/// must not pretend that an ad-hoc or vendor signature has a Team ID/designated requirement.
pub fn require_signature_verification(
    identity: &MacBundleIdentity,
) -> Result<(), MacIdentityError> {
    match identity.signature.verification {
        MacSignatureVerification::Verified => Ok(()),
        MacSignatureVerification::Unavailable { ref reason } => {
            Err(MacIdentityError::SignatureUnavailable(reason.clone()))
        }
    }
}

pub fn read_bundle_version(app_path: &Path) -> Result<String, String> {
    if app_path.as_os_str().is_empty() {
        return Ok(String::new());
    }
    let layout = InstallLayout::from_selection(app_path)?;
    match layout.platform {
        InstallPlatform::Macos => {
            let info_plist = layout.root.join("Contents").join("Info.plist");
            let value = read_info_plist(&info_plist)?;
            Ok(read_plist_string(&value, "CFBundleShortVersionString").unwrap_or_default())
        }
        InstallPlatform::Windows => Ok(windows_install::product_version_for_executable(
            &layout.executable,
        )
        .unwrap_or_default()),
    }
}

/// Read-only status revision. Windows always streams the fixed binary set because NTFS metadata
/// can collide across rapid same-size rewrites; non-Windows hosts may reuse metadata-keyed hashes.
/// Write callers use `read_bundle_revision_for_write`, which always bypasses the cache.
pub fn read_bundle_revision(app_path: &Path) -> Result<String, String> {
    if app_path.as_os_str().is_empty() {
        return Ok(String::new());
    }
    let layout = InstallLayout::from_selection(app_path)?;
    match layout.platform {
        InstallPlatform::Macos => {
            let info_path = layout.root.join("Contents").join("Info.plist");
            let info = read_info_plist(&info_path)?;
            let complete_identity_hint = read_plist_string(&info, "CFBundleIdentifier").is_some();
            if complete_identity_hint {
                let identity = require_supported_mac_identity(&layout.root)
                    .map_err(|error| error.to_string())?;
                return Ok(format!(
                    "macos-identity:{}",
                    identity.official_baseline_fingerprint
                ));
            }
            let version = read_bundle_version(&layout.root)?;
            if version.is_empty() {
                return Err(format!(
                    "Could not read Cavalry bundle version from {}",
                    layout.root.display()
                ));
            }
            // Compatibility fixtures from before the identity gate may contain only a short
            // version. They remain readable, but strict write callers must use
            // read_bundle_revision_for_write below.
            Ok(format!("bundle-version:{version}"))
        }
        InstallPlatform::Windows => read_windows_bundle_revision(&layout.root, true),
    }
}

fn read_windows_bundle_revision(root: &Path, use_cache: bool) -> Result<String, String> {
    let mut entries = Vec::new();
    for (relative_path, required) in [
        ("Cavalry.exe", true),
        ("CavalryFramework.dll", false),
        ("CavalryUI.dll", false),
    ] {
        let path = root.join(relative_path);
        if !path.is_file() {
            if required {
                return Err(format!(
                    "Cavalry revision input is missing: {}",
                    path.display()
                ));
            }
            continue;
        }
        let sha256 = if use_cache {
            sha256_file_cached(&path)?
        } else {
            sha256_file_uncached(&path)?
        };
        entries.push(format!("{relative_path}=sha256:{sha256}"));
    }
    Ok(entries.join(";"))
}

pub fn read_bundle_revision_for_write(app_path: &Path) -> Result<String, MacIdentityError> {
    let layout =
        InstallLayout::from_verified_selection(app_path).map_err(MacIdentityError::Read)?;
    match layout.platform {
        InstallPlatform::Macos => {
            let identity = require_supported_mac_identity(&layout.root)?;
            Ok(format!(
                "macos-identity:{}",
                identity.official_baseline_fingerprint
            ))
        }
        InstallPlatform::Windows => {
            read_windows_bundle_revision(&layout.root, false).map_err(MacIdentityError::Read)
        }
    }
}

fn sha256_file_uncached(path: &Path) -> Result<String, String> {
    #[cfg(test)]
    {
        let counts = REVISION_UNCACHED_HASHES.get_or_init(|| Mutex::new(HashMap::new()));
        *counts
            .lock()
            .unwrap()
            .entry(path.to_path_buf())
            .or_default() += 1;
    }
    let mut file = fs::File::open(path)
        .map_err(|error| format!("Could not open revision input {}: {error}", path.display()))?;
    let mut digest = Sha256::new();
    let mut buffer = [0_u8; 64 * 1024];
    loop {
        let read = file.read(&mut buffer).map_err(|error| {
            format!("Could not hash revision input {}: {error}", path.display())
        })?;
        if read == 0 {
            break;
        }
        digest.update(&buffer[..read]);
    }
    Ok(format!("{:x}", digest.finalize()))
}

#[cfg(not(windows))]
#[derive(Debug, Clone, PartialEq, Eq)]
struct RevisionFileMetadata {
    size: u64,
    modified_nanos: u128,
    file_id: u128,
    change_stamp: u128,
}

#[cfg(not(windows))]
#[derive(Debug, Clone)]
struct CachedRevisionHash {
    metadata: RevisionFileMetadata,
    sha256: String,
}

#[cfg(not(windows))]
static REVISION_HASH_CACHE: OnceLock<Mutex<HashMap<PathBuf, CachedRevisionHash>>> = OnceLock::new();

#[cfg(test)]
static REVISION_UNCACHED_HASHES: OnceLock<Mutex<HashMap<PathBuf, usize>>> = OnceLock::new();

#[cfg(not(windows))]
fn revision_hash_cache() -> &'static Mutex<HashMap<PathBuf, CachedRevisionHash>> {
    REVISION_HASH_CACHE.get_or_init(|| Mutex::new(HashMap::new()))
}

#[cfg(not(windows))]
fn revision_file_metadata(path: &Path) -> Result<RevisionFileMetadata, String> {
    let file = fs::File::open(path)
        .map_err(|error| format!("Could not open revision input {}: {error}", path.display()))?;
    let metadata = file.metadata().map_err(|error| {
        format!(
            "Could not inspect revision input {}: {error}",
            path.display()
        )
    })?;
    let modified_nanos = metadata
        .modified()
        .map_err(|error| {
            format!(
                "Could not read mtime for revision input {}: {error}",
                path.display()
            )
        })?
        .duration_since(UNIX_EPOCH)
        .map_err(|error| {
            format!(
                "Revision input {} has an invalid mtime: {error}",
                path.display()
            )
        })?
        .as_nanos();
    Ok(RevisionFileMetadata {
        size: metadata.len(),
        modified_nanos,
        file_id: revision_file_id(&file, &metadata)?,
        change_stamp: revision_file_change_stamp(&file, &metadata)?,
    })
}

#[cfg(unix)]
fn revision_file_id(_file: &fs::File, metadata: &fs::Metadata) -> Result<u128, String> {
    use std::os::unix::fs::MetadataExt;
    Ok((u128::from(metadata.dev()) << 64) | u128::from(metadata.ino()))
}

#[cfg(not(any(unix, windows)))]
fn revision_file_id(_file: &fs::File, _metadata: &fs::Metadata) -> Result<u128, String> {
    Ok(0)
}

#[cfg(unix)]
fn revision_file_change_stamp(_file: &fs::File, metadata: &fs::Metadata) -> Result<u128, String> {
    use std::os::unix::fs::MetadataExt;
    Ok((u128::from(metadata.ctime() as u64) << 64) | u128::from(metadata.ctime_nsec() as u64))
}

#[cfg(not(any(unix, windows)))]
fn revision_file_change_stamp(_file: &fs::File, _metadata: &fs::Metadata) -> Result<u128, String> {
    Ok(0)
}

#[cfg(windows)]
fn sha256_file_cached(path: &Path) -> Result<String, String> {
    // NTFS metadata timestamps can collide across rapid same-size rewrites. Windows
    // revision reads therefore use the content identity directly; write gates already
    // use the same uncached path and never trust metadata as a content substitute.
    sha256_file_uncached(path)
}

#[cfg(not(windows))]
fn sha256_file_cached(path: &Path) -> Result<String, String> {
    let metadata = revision_file_metadata(path)?;
    let cache = revision_hash_cache();
    if let Some(cached) = cache
        .lock()
        .map_err(|_| "Revision hash cache lock is poisoned".to_string())?
        .get(path)
        .filter(|cached| cached.metadata == metadata)
    {
        return Ok(cached.sha256.clone());
    }

    let sha256 = sha256_file_uncached(path)?;
    cache
        .lock()
        .map_err(|_| "Revision hash cache lock is poisoned".to_string())?
        .insert(
            path.to_path_buf(),
            CachedRevisionHash {
                metadata,
                sha256: sha256.clone(),
            },
        );
    Ok(sha256)
}

#[cfg(test)]
fn clear_revision_hash_cache_for_tests() {
    #[cfg(not(windows))]
    {
        if let Some(cache) = REVISION_HASH_CACHE.get() {
            cache.lock().unwrap().clear();
        }
    }
    if let Some(counts) = REVISION_UNCACHED_HASHES.get() {
        counts.lock().unwrap().clear();
    }
}

#[cfg(test)]
fn revision_uncached_hash_count_for_tests(root: &Path) -> usize {
    let normalized_root = crate::install::normalize_path(root);
    REVISION_UNCACHED_HASHES
        .get()
        .map(|counts| {
            counts
                .lock()
                .unwrap()
                .iter()
                .filter(|(path, _)| path.starts_with(root) || path.starts_with(&normalized_root))
                .map(|(_, count)| count)
                .sum()
        })
        .unwrap_or_default()
}

fn sha256_bytes(bytes: &[u8]) -> String {
    let mut digest = Sha256::new();
    digest.update(bytes);
    format!("{:x}", digest.finalize())
}

#[derive(Clone, Copy)]
enum MachEndian {
    Big,
    Little,
}

const LC_SEGMENT: u32 = 0x1;
const LC_SEGMENT_64: u32 = 0x19;
const LC_CODE_SIGNATURE: u32 = 0x1d;
const LINKEDIT_SEGMENT_NAME: &[u8; 16] = b"__LINKEDIT\0\0\0\0\0\0";

#[derive(Clone, Copy)]
struct LinkeditSegment {
    vmsize_offset: usize,
    filesize_offset: usize,
    field_width: usize,
    fileoff: u64,
    filesize: u64,
    vmsize: u64,
}

/// Hash the executable contents of a Mach-O while deliberately excluding only the
/// `LC_CODE_SIGNATURE` command fields, its signature payload, and the signature-dependent
/// `__LINKEDIT` extent. Callers use this to prove that an allowed re-sign changed signature
/// material rather than executable code.
pub(crate) fn macho_code_identity_sha256(bytes: &[u8]) -> Result<String, String> {
    if bytes.len() < 8 {
        return Err("Mach-O input is too small to identify signed code bytes".to_string());
    }
    let magic_be = u32::from_be_bytes(bytes[0..4].try_into().unwrap());
    let magic_le = u32::from_le_bytes(bytes[0..4].try_into().unwrap());
    let slices = match (magic_be, magic_le) {
        (0xcafebabe, _) => fat_slices(bytes, MachEndian::Big, false)?,
        (0xcafebabf, _) => fat_slices(bytes, MachEndian::Big, true)?,
        (_, 0xcafebabe) => fat_slices(bytes, MachEndian::Little, false)?,
        (_, 0xcafebabf) => fat_slices(bytes, MachEndian::Little, true)?,
        _ => vec![(read_u32(bytes, 4, thin_endian_and_header(bytes)?.0)?, bytes)],
    };

    let mut identities = slices
        .into_iter()
        .map(|(cpu_type, slice)| {
            Ok((
                cpu_type,
                normalized_macho_slice_sha256(slice).map_err(|error| {
                    format!("Could not normalize Mach-O CPU type 0x{cpu_type:x}: {error}")
                })?,
            ))
        })
        .collect::<Result<Vec<_>, String>>()?;
    identities.sort_by_key(|(cpu_type, _)| *cpu_type);
    if identities.windows(2).any(|pair| pair[0].0 == pair[1].0) {
        return Err("Mach-O contains duplicate CPU slices".to_string());
    }
    let mut digest = Sha256::new();
    digest.update(b"cavalry-i18n-macho-code-v1\0");
    for (cpu_type, identity) in identities {
        digest.update(cpu_type.to_be_bytes());
        digest.update(identity.as_bytes());
        digest.update([0]);
    }
    Ok(format!("{:x}", digest.finalize()))
}

fn fat_slices<'a>(
    bytes: &'a [u8],
    endian: MachEndian,
    is_64: bool,
) -> Result<Vec<(u32, &'a [u8])>, String> {
    let count = usize::try_from(read_u32(bytes, 4, endian)?)
        .map_err(|_| "Mach-O fat slice count is invalid".to_string())?;
    if count == 0 || count > 64 {
        return Err(format!("Mach-O fat slice count is invalid: {count}"));
    }
    let entry_size = if is_64 { 32 } else { 20 };
    let table_end = 8_usize
        .checked_add(
            count
                .checked_mul(entry_size)
                .ok_or_else(|| "Mach-O fat table overflows".to_string())?,
        )
        .ok_or_else(|| "Mach-O fat table overflows".to_string())?;
    if table_end > bytes.len() {
        return Err("Mach-O fat table is truncated".to_string());
    }

    let mut ranges = Vec::with_capacity(count);
    for index in 0..count {
        let entry = 8 + index * entry_size;
        let cpu_type = read_u32(bytes, entry, endian)?;
        let (offset, size) = if is_64 {
            (
                usize::try_from(read_u64(bytes, entry + 8, endian)?)
                    .map_err(|_| "Mach-O fat slice offset is too large".to_string())?,
                usize::try_from(read_u64(bytes, entry + 16, endian)?)
                    .map_err(|_| "Mach-O fat slice size is too large".to_string())?,
            )
        } else {
            (
                usize::try_from(read_u32(bytes, entry + 8, endian)?)
                    .map_err(|_| "Mach-O fat slice offset is too large".to_string())?,
                usize::try_from(read_u32(bytes, entry + 12, endian)?)
                    .map_err(|_| "Mach-O fat slice size is too large".to_string())?,
            )
        };
        let end = offset
            .checked_add(size)
            .ok_or_else(|| "Mach-O fat slice range overflows".to_string())?;
        if offset < table_end || size == 0 || end > bytes.len() {
            return Err("Mach-O fat slice range is invalid".to_string());
        }
        ranges.push((offset, end, cpu_type));
    }
    let mut ordered_ranges = ranges
        .iter()
        .map(|(start, end, _)| (*start, *end))
        .collect::<Vec<_>>();
    ordered_ranges.sort_unstable();
    if ordered_ranges.windows(2).any(|pair| pair[0].1 > pair[1].0) {
        return Err("Mach-O fat slices overlap".to_string());
    }
    Ok(ranges
        .into_iter()
        .map(|(start, end, cpu_type)| (cpu_type, &bytes[start..end]))
        .collect())
}

fn normalized_macho_slice_sha256(slice: &[u8]) -> Result<String, String> {
    let (endian, header_size) = thin_endian_and_header(slice)?;
    let commands = usize::try_from(read_u32(slice, 16, endian)?)
        .map_err(|_| "Mach-O load-command count is invalid".to_string())?;
    let commands_size = usize::try_from(read_u32(slice, 20, endian)?)
        .map_err(|_| "Mach-O load-command size is invalid".to_string())?;
    let commands_end = header_size
        .checked_add(commands_size)
        .ok_or_else(|| "Mach-O load commands overflow".to_string())?;
    if commands_end > slice.len() || commands > commands_size / 8 {
        return Err("Mach-O load commands are truncated or inconsistent".to_string());
    }

    let mut cursor = header_size;
    let mut code_signature = None;
    let mut linkedit = None;
    for _ in 0..commands {
        let command = read_u32(slice, cursor, endian)?;
        let command_size = usize::try_from(read_u32(slice, cursor + 4, endian)?)
            .map_err(|_| "Mach-O load-command size is invalid".to_string())?;
        let command_end = cursor
            .checked_add(command_size)
            .ok_or_else(|| "Mach-O load command overflows".to_string())?;
        if command_size < 8 || command_end > commands_end {
            return Err("Mach-O load command is truncated".to_string());
        }
        if matches!(command, LC_SEGMENT | LC_SEGMENT_64) {
            let segment_command_size = if command == LC_SEGMENT_64 { 72 } else { 56 };
            if command_size < segment_command_size {
                return Err("Mach-O segment command is truncated".to_string());
            }
            let segment_name = slice
                .get(cursor + 8..cursor + 24)
                .ok_or_else(|| "Mach-O segment name is truncated".to_string())?;
            if segment_name == LINKEDIT_SEGMENT_NAME {
                if linkedit.is_some() {
                    return Err("Mach-O contains repeated __LINKEDIT segments".to_string());
                }
                let (vmsize_offset, filesize_offset, field_width, vmsize, fileoff, filesize) =
                    if command == LC_SEGMENT_64 {
                        (
                            cursor + 32,
                            cursor + 48,
                            8,
                            read_u64(slice, cursor + 32, endian)?,
                            read_u64(slice, cursor + 40, endian)?,
                            read_u64(slice, cursor + 48, endian)?,
                        )
                    } else {
                        (
                            cursor + 28,
                            cursor + 36,
                            4,
                            u64::from(read_u32(slice, cursor + 28, endian)?),
                            u64::from(read_u32(slice, cursor + 32, endian)?),
                            u64::from(read_u32(slice, cursor + 36, endian)?),
                        )
                    };
                linkedit = Some(LinkeditSegment {
                    vmsize_offset,
                    filesize_offset,
                    field_width,
                    fileoff,
                    filesize,
                    vmsize,
                });
            }
        }
        if command == LC_CODE_SIGNATURE {
            if command_size < 16 || code_signature.is_some() {
                return Err("Mach-O LC_CODE_SIGNATURE is malformed or repeated".to_string());
            }
            let offset = usize::try_from(read_u32(slice, cursor + 8, endian)?)
                .map_err(|_| "Mach-O code-signature offset is invalid".to_string())?;
            let size = usize::try_from(read_u32(slice, cursor + 12, endian)?)
                .map_err(|_| "Mach-O code-signature size is invalid".to_string())?;
            let end = offset
                .checked_add(size)
                .ok_or_else(|| "Mach-O code-signature range overflows".to_string())?;
            if offset < commands_end || end > slice.len() {
                return Err("Mach-O code-signature range is invalid".to_string());
            }
            code_signature = Some((cursor, offset, end));
        }
        cursor = command_end;
    }
    if cursor != commands_end {
        return Err("Mach-O load-command size does not match its command table".to_string());
    }

    // codesign shrinks or grows __LINKEDIT to the end of the newly written signature. Only
    // canonicalize this extent when it is demonstrably derived from the signature range at the
    // end of the slice; unrelated segment metadata remains part of the code identity.
    let normalized_linkedit = match (linkedit, code_signature) {
        (Some(linkedit), Some((_, signature_offset, signature_end)))
            if signature_end == slice.len()
                && linkedit.fileoff.checked_add(linkedit.filesize)
                    == u64::try_from(signature_end).ok()
                && linkedit.vmsize >= linkedit.filesize =>
        {
            usize::try_from(linkedit.fileoff)
                .ok()
                .and_then(|fileoff| signature_offset.checked_sub(fileoff))
                .map(|canonical_size| (linkedit, canonical_size))
        }
        _ => None,
    };

    let mut digest = Sha256::new();
    digest.update(b"macho-slice-code-v1\0");
    if let Some((command_offset, signature_offset, signature_end)) = code_signature {
        let mut prefix = slice[..signature_offset].to_vec();
        prefix[command_offset + 8..command_offset + 16].fill(0);
        if let Some((linkedit, canonical_size)) = normalized_linkedit {
            write_macho_integer(
                &mut prefix,
                linkedit.vmsize_offset,
                linkedit.field_width,
                canonical_size,
                endian,
            )?;
            write_macho_integer(
                &mut prefix,
                linkedit.filesize_offset,
                linkedit.field_width,
                canonical_size,
                endian,
            )?;
        }
        digest.update(prefix);
        digest.update(b"\0signature-payload-omitted\0");
        digest.update(&slice[signature_end..]);
    } else {
        digest.update(slice);
    }
    Ok(format!("{:x}", digest.finalize()))
}

fn write_macho_integer(
    bytes: &mut [u8],
    offset: usize,
    width: usize,
    value: usize,
    endian: MachEndian,
) -> Result<(), String> {
    match width {
        4 => {
            let value = u32::try_from(value)
                .map_err(|_| "Mach-O 32-bit field cannot hold canonical size".to_string())?;
            let encoded = match endian {
                MachEndian::Big => value.to_be_bytes(),
                MachEndian::Little => value.to_le_bytes(),
            };
            bytes
                .get_mut(offset..offset + 4)
                .ok_or_else(|| "Mach-O canonical field is truncated".to_string())?
                .copy_from_slice(&encoded);
        }
        8 => {
            let value = u64::try_from(value)
                .map_err(|_| "Mach-O 64-bit field cannot hold canonical size".to_string())?;
            let encoded = match endian {
                MachEndian::Big => value.to_be_bytes(),
                MachEndian::Little => value.to_le_bytes(),
            };
            bytes
                .get_mut(offset..offset + 8)
                .ok_or_else(|| "Mach-O canonical field is truncated".to_string())?
                .copy_from_slice(&encoded);
        }
        _ => return Err("Mach-O canonical field has an unsupported width".to_string()),
    }
    Ok(())
}

fn thin_endian_and_header(bytes: &[u8]) -> Result<(MachEndian, usize), String> {
    if bytes.len() < 28 {
        return Err("Mach-O slice is smaller than its header".to_string());
    }
    let magic_be = u32::from_be_bytes(bytes[0..4].try_into().unwrap());
    let magic_le = u32::from_le_bytes(bytes[0..4].try_into().unwrap());
    match (magic_be, magic_le) {
        (0xfeedface, _) => Ok((MachEndian::Big, 28)),
        (0xfeedfacf, _) => {
            if bytes.len() < 32 {
                Err("64-bit Mach-O slice is smaller than its header".to_string())
            } else {
                Ok((MachEndian::Big, 32))
            }
        }
        (_, 0xfeedface) => Ok((MachEndian::Little, 28)),
        (_, 0xfeedfacf) => {
            if bytes.len() < 32 {
                Err("64-bit Mach-O slice is smaller than its header".to_string())
            } else {
                Ok((MachEndian::Little, 32))
            }
        }
        _ => Err("unsupported or invalid Mach-O slice magic".to_string()),
    }
}

fn read_u32(bytes: &[u8], offset: usize, endian: MachEndian) -> Result<u32, String> {
    let value = bytes
        .get(offset..offset + 4)
        .ok_or_else(|| "Mach-O integer is truncated".to_string())?
        .try_into()
        .unwrap();
    Ok(match endian {
        MachEndian::Big => u32::from_be_bytes(value),
        MachEndian::Little => u32::from_le_bytes(value),
    })
}

fn read_u64(bytes: &[u8], offset: usize, endian: MachEndian) -> Result<u64, String> {
    let value = bytes
        .get(offset..offset + 8)
        .ok_or_else(|| "Mach-O integer is truncated".to_string())?
        .try_into()
        .unwrap();
    Ok(match endian {
        MachEndian::Big => u64::from_be_bytes(value),
        MachEndian::Little => u64::from_le_bytes(value),
    })
}

fn official_baseline_fingerprint(
    bundle_id: &str,
    short_version: &str,
    build_version: &str,
    architectures: &[String],
    main_executable_code_sha256: &str,
) -> String {
    // libExtensionLayer is the controlled Keychain-patch surface.  Its current hash remains in
    // MacBundleIdentity for a separate write/TOCTOU gate, but must not invalidate the immutable
    // revision used to select the official snapshot before versus after that patch.
    let material = format!(
        "bundle-id:{bundle_id}\nshort-version:{short_version}\nbuild-version:{build_version}\narchitectures:{}\nmain-executable-code:{main_executable_code_sha256}\n",
        architectures.join(",")
    );
    sha256_bytes(material.as_bytes())
}

fn reject_symlink_file(path: &Path) -> Result<(), MacIdentityError> {
    let metadata = fs::symlink_metadata(path).map_err(|error| {
        MacIdentityError::Read(format!("could not inspect {}: {error}", path.display()))
    })?;
    if metadata.file_type().is_symlink() {
        return Err(MacIdentityError::Read(format!(
            "refusing symlink identity input {}",
            path.display()
        )));
    }
    if !metadata.file_type().is_file() {
        return Err(MacIdentityError::Read(format!(
            "identity input is not a regular file: {}",
            path.display()
        )));
    }
    Ok(())
}

fn read_info_plist(path: &Path) -> Result<PlistValue, String> {
    let file = fs::File::open(path)
        .map_err(|error| format!("Could not open Info.plist {}: {error}", path.display()))?;
    PlistValue::from_reader(file).map_err(|error| {
        format!(
            "Could not parse typed Info.plist {}: {error}",
            path.display()
        )
    })
}

fn read_plist_string(value: &PlistValue, key: &str) -> Option<String> {
    value
        .as_dictionary()
        .and_then(|dictionary| dictionary.get(key))
        .and_then(PlistValue::as_string)
        .map(ToOwned::to_owned)
}

fn macho_architectures(bytes: &[u8]) -> Result<Vec<String>, String> {
    if bytes.len() < 8 {
        return Err("Mach-O input is too small to identify its architecture".to_string());
    }
    let magic_be = u32::from_be_bytes(bytes[0..4].try_into().unwrap());
    let magic_le = u32::from_le_bytes(bytes[0..4].try_into().unwrap());
    let mut cputypes = Vec::new();
    match (magic_be, magic_le) {
        (0xcafebabe, _) | (0xcafebabf, _) => {
            let count = u32::from_be_bytes(bytes[4..8].try_into().unwrap()) as usize;
            let entry_size = if magic_be == 0xcafebabf { 32 } else { 20 };
            let table_end = 8_usize
                .checked_add(
                    count
                        .checked_mul(entry_size)
                        .ok_or_else(|| "Mach-O fat architecture table overflows".to_string())?,
                )
                .ok_or_else(|| "Mach-O fat architecture table overflows".to_string())?;
            if table_end > bytes.len() {
                return Err("Mach-O fat architecture table is truncated".to_string());
            }
            for index in 0..count {
                let offset = 8 + index * entry_size;
                cputypes.push(u32::from_be_bytes(
                    bytes[offset..offset + 4].try_into().unwrap(),
                ));
            }
        }
        (0xfeedface, _) | (0xfeedfacf, _) => {
            cputypes.push(u32::from_be_bytes(bytes[4..8].try_into().unwrap()));
        }
        (_, 0xfeedface) | (_, 0xfeedfacf) => {
            cputypes.push(u32::from_le_bytes(bytes[4..8].try_into().unwrap()));
        }
        _ => return Err("unsupported or invalid Mach-O magic".to_string()),
    }
    let mut architectures = cputypes
        .into_iter()
        .map(|cputype| match cputype {
            7 => Ok("i386".to_string()),
            0x0100_0007 => Ok("x86_64".to_string()),
            12 => Ok("arm".to_string()),
            0x0100_000c => Ok("arm64".to_string()),
            other => Err(format!("unsupported Mach-O CPU type 0x{other:x}")),
        })
        .collect::<Result<Vec<_>, _>>()?;
    architectures.sort();
    architectures.dedup();
    Ok(architectures)
}

pub fn list_language_options(languages_dir: &Path) -> Vec<String> {
    let mut values = match fs::read_dir(languages_dir) {
        Ok(entries) => entries
            .flatten()
            .filter(|entry| entry.file_type().map(|kind| kind.is_dir()).unwrap_or(false))
            .filter_map(|entry| entry.file_name().into_string().ok())
            .filter(|name| name != "en" && !name.starts_with('.'))
            .collect::<Vec<_>>(),
        Err(_) => Vec::new(),
    };
    values.sort();
    values
}

pub fn inspect_bundle(app_path: &Path) -> BundleInfo {
    let layout = InstallLayout::from_selection(app_path)
        .unwrap_or_else(|_| InstallLayout::from_root(app_path));
    BundleInfo {
        exists: !layout.root.as_os_str().is_empty() && layout.root.exists(),
        app_path: layout.root.to_string_lossy().to_string(),
        version: read_bundle_version(&layout.root).unwrap_or_default(),
        has_assets_root: layout.assets_root.exists(),
        has_definitions: layout.assets_root.join("Definitions").exists(),
        has_learn: layout.assets_root.join("Learn").exists(),
        has_plugins: layout.assets_root.join("Plugins").exists(),
    }
}

pub fn read_installed_language(app_path: &Path, fallback: &str) -> String {
    if app_path.as_os_str().is_empty() {
        return fallback.to_string();
    }
    let layout = match InstallLayout::from_selection(app_path) {
        Ok(layout) => layout,
        Err(_) => return fallback.to_string(),
    };
    let value = match fs::read_to_string(layout.language_marker) {
        Ok(value) => value.trim().to_string(),
        Err(_) => return fallback.to_string(),
    };
    if value.is_empty() {
        return "en".to_string();
    }
    if matches!(value.as_str(), "en" | "zh-Hans" | "zh-Hant" | "ja_JP") {
        value
    } else {
        fallback.to_string()
    }
}

#[cfg(target_os = "windows")]
fn dedupe_paths(paths: Vec<PathBuf>) -> Vec<PathBuf> {
    let mut seen = HashSet::new();
    let mut output = Vec::new();
    for path in paths {
        let normalized = normalize_path(&path);
        #[cfg(windows)]
        let key = normalized.to_string_lossy().to_ascii_lowercase();
        #[cfg(not(windows))]
        let key = normalized.to_string_lossy().to_string();
        if seen.insert(key) {
            output.push(normalized);
        }
    }
    output
}

#[cfg(test)]
mod tests {
    use super::{
        clear_revision_hash_cache_for_tests, find_cavalry_app_from_candidates,
        macho_code_identity_sha256, read_bundle_revision, read_bundle_revision_for_write,
        read_bundle_version, revision_uncached_hash_count_for_tests, LC_CODE_SIGNATURE,
        LC_SEGMENT_64, LINKEDIT_SEGMENT_NAME,
    };
    use std::fs;

    fn write(path: &std::path::Path, value: &[u8]) {
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::write(path, value).unwrap();
    }

    #[test]
    fn read_bundle_version_from_info_plist() {
        let temp = tempfile::tempdir().unwrap();
        let app = temp.path().join("Cavalry.app");
        write(&app.join("Contents/MacOS/Cavalry"), b"binary");
        write(
            &app.join("Contents/assets/Definitions/appStrings.json"),
            b"{}",
        );
        write(
            &app.join("Contents/assets/Definitions/nodeStrings.json"),
            b"{}",
        );
        write(
            &app.join("Contents/Info.plist"),
            b"<plist><dict><key>CFBundleShortVersionString</key><string>2.3.4</string></dict></plist>",
        );

        assert_eq!(read_bundle_version(&app).unwrap(), "2.3.4");
    }

    #[test]
    fn saved_valid_install_wins_over_discovered_candidates() {
        let temp = tempfile::tempdir().unwrap();
        let saved = temp.path().join("Saved");
        let discovered = temp.path().join("Discovered");
        for root in [&saved, &discovered] {
            write(&root.join("Cavalry.exe"), b"binary");
            write(&root.join("assets/Definitions/appStrings.json"), b"{}");
            write(&root.join("assets/Definitions/nodeStrings.json"), b"{}");
        }

        assert_eq!(
            find_cavalry_app_from_candidates(
                &saved.to_string_lossy(),
                [discovered.clone()].into_iter()
            ),
            crate::install::normalize_path(&saved)
        );
    }

    #[test]
    fn revision_cache_reuses_stable_inputs_and_write_revision_bypasses_cache() {
        clear_revision_hash_cache_for_tests();
        let temp = tempfile::tempdir().unwrap();
        let root = temp.path().join("Portable Cavalry");
        write(&root.join("Cavalry.exe"), b"binary-v1");
        write(&root.join("CavalryFramework.dll"), b"framework-v1");
        write(&root.join("CavalryUI.dll"), b"ui-v1");
        write(&root.join("assets/Definitions/appStrings.json"), b"{}");
        write(&root.join("assets/Definitions/nodeStrings.json"), b"{}");

        let first = read_bundle_revision(&root).unwrap();
        let hashes_after_first = revision_uncached_hash_count_for_tests(&root);
        let second = read_bundle_revision(&root).unwrap();
        assert_eq!(first, second);
        #[cfg(not(windows))]
        assert_eq!(
            hashes_after_first,
            revision_uncached_hash_count_for_tests(&root)
        );
        #[cfg(windows)]
        assert!(
            revision_uncached_hash_count_for_tests(&root) > hashes_after_first,
            "Windows revision reads must not substitute mutable metadata for content identity"
        );

        write(&root.join("Cavalry.exe"), b"binary-v2");
        let changed = read_bundle_revision(&root).unwrap();
        assert_ne!(first, changed);
        let hashes_before_write = revision_uncached_hash_count_for_tests(&root);
        assert_eq!(
            read_bundle_revision_for_write(&root).unwrap(),
            changed,
            "the write gate must preserve the public revision format"
        );
        assert!(
            revision_uncached_hash_count_for_tests(&root) > hashes_before_write,
            "write revision must hash inputs without using the read-only cache"
        );

        fs::remove_file(root.join("CavalryFramework.dll")).unwrap();
        assert_ne!(changed, read_bundle_revision(&root).unwrap());
    }

    fn synthetic_signed_macho(
        signature_len: usize,
        linkedit_filesize_override: Option<u64>,
    ) -> Vec<u8> {
        const HEADER_SIZE: usize = 32;
        const SEGMENT_COMMAND_SIZE: usize = 72;
        const CODE_SIGNATURE_COMMAND_SIZE: usize = 16;
        const COMMANDS_SIZE: usize = SEGMENT_COMMAND_SIZE + CODE_SIGNATURE_COMMAND_SIZE;
        const LINKEDIT_FILE_OFFSET: usize = 0x1000;
        const CODE_SIGNATURE_OFFSET: usize = 0x1100;

        let signature_end = CODE_SIGNATURE_OFFSET + signature_len;
        let actual_linkedit_filesize = (signature_end - LINKEDIT_FILE_OFFSET) as u64;
        let linkedit_filesize = linkedit_filesize_override.unwrap_or(actual_linkedit_filesize);
        let linkedit_vmsize = (linkedit_filesize + 0xfff) & !0xfff;
        let mut bytes = vec![0_u8; signature_end];
        for (index, byte) in bytes.iter_mut().enumerate() {
            *byte = (index as u8).wrapping_mul(31).wrapping_add(7);
        }

        bytes[0..4].copy_from_slice(&0xfeed_facfu32.to_le_bytes());
        bytes[4..8].copy_from_slice(&0x0100_000cu32.to_le_bytes());
        bytes[8..12].copy_from_slice(&0_u32.to_le_bytes());
        bytes[12..16].copy_from_slice(&2_u32.to_le_bytes());
        bytes[16..20].copy_from_slice(&2_u32.to_le_bytes());
        bytes[20..24].copy_from_slice(&(COMMANDS_SIZE as u32).to_le_bytes());

        let segment = HEADER_SIZE;
        bytes[segment..segment + 4].copy_from_slice(&LC_SEGMENT_64.to_le_bytes());
        bytes[segment + 4..segment + 8]
            .copy_from_slice(&(SEGMENT_COMMAND_SIZE as u32).to_le_bytes());
        bytes[segment + 8..segment + 24].copy_from_slice(LINKEDIT_SEGMENT_NAME);
        bytes[segment + 32..segment + 40].copy_from_slice(&linkedit_vmsize.to_le_bytes());
        bytes[segment + 40..segment + 48]
            .copy_from_slice(&(LINKEDIT_FILE_OFFSET as u64).to_le_bytes());
        bytes[segment + 48..segment + 56].copy_from_slice(&linkedit_filesize.to_le_bytes());

        let signature = segment + SEGMENT_COMMAND_SIZE;
        bytes[signature..signature + 4].copy_from_slice(&LC_CODE_SIGNATURE.to_le_bytes());
        bytes[signature + 4..signature + 8]
            .copy_from_slice(&(CODE_SIGNATURE_COMMAND_SIZE as u32).to_le_bytes());
        bytes[signature + 8..signature + 12]
            .copy_from_slice(&(CODE_SIGNATURE_OFFSET as u32).to_le_bytes());
        bytes[signature + 12..signature + 16]
            .copy_from_slice(&(signature_len as u32).to_le_bytes());
        for (index, byte) in bytes[CODE_SIGNATURE_OFFSET..].iter_mut().enumerate() {
            *byte = (index as u8).wrapping_mul(17).wrapping_add(0xa5);
        }
        bytes
    }

    #[test]
    fn macho_code_identity_ignores_codesign_linkedit_extent_but_not_code_bytes() {
        let vendor = synthetic_signed_macho(0x2300, None);
        let managed = synthetic_signed_macho(0x100, None);

        assert_eq!(
            macho_code_identity_sha256(&vendor).unwrap(),
            macho_code_identity_sha256(&managed).unwrap(),
            "a codesign-only signature resize must not create a new executable identity"
        );

        let mut code_changed = managed;
        code_changed[0x500] ^= 0x01;
        assert_ne!(
            macho_code_identity_sha256(&vendor).unwrap(),
            macho_code_identity_sha256(&code_changed).unwrap(),
            "bytes outside the signature payload must remain identity material"
        );
    }

    #[test]
    fn macho_code_identity_does_not_normalize_unrelated_linkedit_extent() {
        let vendor = synthetic_signed_macho(0x2300, None);
        let actual_linkedit_filesize = (0x1100_u64 + 0x2300) - 0x1000;
        let unrelated_extent = synthetic_signed_macho(0x2300, Some(actual_linkedit_filesize - 1));

        assert_ne!(
            macho_code_identity_sha256(&vendor).unwrap(),
            macho_code_identity_sha256(&unrelated_extent).unwrap(),
            "a segment extent not ending at the signature must not be treated as a re-sign delta"
        );
    }
}
