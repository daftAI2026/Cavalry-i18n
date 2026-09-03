/**
 * [INPUT]: 依赖受支持 macOS bundle 结构、当前可恢复 seal、packaged English、state generation root 与精确 runtime/JSON 文件。
 * [OUTPUT]: 提供 English JSON + stock runtime 单一 immutable recovery generation 的准备/验证、typed VerifiedVendorBaseline、baseline-derived managed runtime 证明、同步撤销脚本入口外置签名组件的 English 恢复计划及完整 postimage/签名复核。
 * [POS]: macOS recovery baseline 真相层；Team ID 只保留为 Official 展示证据，不充当翻译许可证；generation rename 只发布不可变候选，state.json provenance 是唯一 current commit bit。
 * [FAIL-CLOSED]: capture 必须满足 before == staged == after；managed Mach-O 仅允许签名区变化；任一由本工具拥有的 manifest/hash/path/mode/recovery-seal 漂移或 symlink 均拒绝。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    collections::HashSet,
    fs::{self, File},
    io::{Read, Write},
    os::unix::fs::{OpenOptionsExt, PermissionsExt},
    path::{Component, Path, PathBuf},
    sync::atomic::{AtomicU64, Ordering},
};

use crate::{
    detect::{self, MacBundleIdentity},
    keychain_patch,
    patch::{self, CopyPair, EnglishSnapshotObservation},
    privilege::{self, BundleSignatureEvidence, CommandRunner},
    state::EnglishSnapshotProvenance,
};

const SNAPSHOT_ROOT: &str = "official-macos";
const GENERATIONS_DIRECTORY: &str = "generations";
const MANIFEST_NAME: &str = "baseline.json";
const ENGLISH_DIRECTORY: &str = "english";
const RUNTIME_DIRECTORY: &str = "runtime";
const SCHEMA_VERSION: u32 = 4;
const BASELINE_SCHEMA_VERSION: u32 = 1;
const GENERATION_SCHEMA_VERSION: u32 = 1;
const INFO_PLIST: &str = "Contents/Info.plist";
const MAIN_EXECUTABLE: &str = "Contents/MacOS/Cavalry";
const CODE_RESOURCES: &str = "Contents/_CodeSignature/CodeResources";
const KEYCHAIN_DYLIB: &str = "Contents/Frameworks/libExtensionLayer.dylib";
const WRAPPER: &str = "Contents/MacOS/CavalryLauncher";
const INJECTOR: &str = "Contents/Frameworks/libCavalryTranslatorInjector.dylib";
const MARKER: &str = "Contents/Resources/cavalry-i18n-lang.txt";
const TRACKED_PATHS: [&str; 7] = [
    INFO_PLIST,
    MAIN_EXECUTABLE,
    CODE_RESOURCES,
    KEYCHAIN_DYLIB,
    WRAPPER,
    INJECTOR,
    MARKER,
];
const REQUIRED_PRESENT_COUNT: usize = 4;

static SNAPSHOT_SEQUENCE: AtomicU64 = AtomicU64::new(0);

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
#[serde(deny_unknown_fields)]
struct SnapshotEntry {
    relative_path: String,
    backup_name: Option<String>,
    original_mode: Option<u32>,
    sha256: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
#[serde(deny_unknown_fields)]
struct SnapshotSignature {
    team_id: Option<String>,
    designated_requirement: String,
    cdhash: String,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
#[serde(deny_unknown_fields)]
struct VendorCodeFileIdentity {
    relative_path: String,
    raw_sha256: String,
    code_sha256: String,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
#[serde(deny_unknown_fields)]
struct VendorFileIdentity {
    relative_path: String,
    raw_sha256: String,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
#[serde(deny_unknown_fields)]
struct VendorBundleIdentity {
    bundle_id: String,
    short_version: String,
    build_version: String,
    architectures: Vec<String>,
    main_executable: VendorCodeFileIdentity,
    extension_layer: VendorFileIdentity,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
#[serde(deny_unknown_fields)]
struct EnglishSection {
    relative_directory: String,
    manifest_sha256: String,
    entry_count: usize,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
#[serde(deny_unknown_fields)]
struct SnapshotManifest {
    schema_version: u32,
    generation: String,
    vendor_baseline_id: String,
    install_root: String,
    immutable_revision: String,
    bundle: VendorBundleIdentity,
    signature: SnapshotSignature,
    english: EnglishSection,
    entries: Vec<SnapshotEntry>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct VendorBaselineMaterial<'a> {
    schema_version: u32,
    immutable_revision: &'a str,
    bundle: &'a VendorBundleIdentity,
    signature: &'a SnapshotSignature,
    english: &'a EnglishSection,
    entries: &'a [SnapshotEntry],
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct GenerationMaterial<'a> {
    schema_version: u32,
    install_root: &'a str,
    vendor_baseline_id: &'a str,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct CleanVendorObservation {
    install_root: String,
    immutable_revision: String,
    bundle: VendorBundleIdentity,
    signature: SnapshotSignature,
    english: EnglishSnapshotObservation,
    entries: Vec<SnapshotEntry>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct PreparedVendorBaseline {
    pub(crate) generation: String,
    pub(crate) vendor_baseline_id: String,
    pub(crate) english_manifest_sha256: String,
    pub(crate) english_count: usize,
}

#[derive(Debug, Clone)]
pub(crate) struct VerifiedVendorBaseline {
    generation_dir: PathBuf,
    english_dir: PathBuf,
    manifest: SnapshotManifest,
}

#[derive(Debug)]
pub(crate) struct RestorePlan {
    pub(crate) pairs: Vec<CopyPair>,
    pub(crate) removals: Vec<PathBuf>,
}

impl SnapshotSignature {
    fn from_evidence(value: BundleSignatureEvidence) -> Result<Self, String> {
        if !value.is_recoverable_identity() {
            return Err(
                "Cannot capture a macOS recovery baseline because the current seal has no stable designated requirement or CDHash."
                    .to_string(),
            );
        }
        Ok(Self {
            team_id: value.team_id,
            designated_requirement: value
                .designated_requirement
                .expect("supported identity has designated requirement"),
            cdhash: value.cdhash.expect("supported identity has CDHash"),
        })
    }

    fn is_recoverable(&self) -> bool {
        !self.cdhash.trim().is_empty() && !self.designated_requirement.trim().is_empty()
    }
}

impl VendorBundleIdentity {
    fn from_detected(identity: &MacBundleIdentity) -> Self {
        Self {
            bundle_id: identity.bundle_id.clone(),
            short_version: identity.short_version.clone(),
            build_version: identity.build_version.clone(),
            architectures: identity.architectures.clone(),
            main_executable: VendorCodeFileIdentity {
                relative_path: MAIN_EXECUTABLE.to_string(),
                raw_sha256: identity.main_executable_sha256.clone(),
                code_sha256: identity.main_executable_code_sha256.clone(),
            },
            extension_layer: VendorFileIdentity {
                relative_path: KEYCHAIN_DYLIB.to_string(),
                raw_sha256: identity.extension_layer_sha256.clone(),
            },
        }
    }
}

pub(crate) fn verify_clean_vendor_runtime(app_path: &Path) -> Result<(), String> {
    let info = plist::Value::from_file(app_path.join(INFO_PLIST))
        .map_err(|error| format!("Could not parse official Info.plist: {error}"))?;
    let executable = info
        .as_dictionary()
        .and_then(|dictionary| dictionary.get("CFBundleExecutable"))
        .and_then(plist::Value::as_string)
        .ok_or_else(|| "Official Info.plist has no string CFBundleExecutable.".to_string())?;
    if executable != "Cavalry" {
        return Err(format!(
            "English extraction refused: CFBundleExecutable is {executable}, so this is not an unmodified Cavalry runtime."
        ));
    }

    for relative in [MAIN_EXECUTABLE, CODE_RESOURCES, KEYCHAIN_DYLIB] {
        require_regular_file(&app_path.join(relative), "official signature preimage")?;
    }
    for relative in [WRAPPER, INJECTOR, MARKER] {
        match fs::symlink_metadata(app_path.join(relative)) {
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
            Ok(_) => {
                return Err(format!(
                    "English extraction refused: managed runtime residue exists at {relative}. Restore from the captured official snapshot or reinstall Cavalry first."
                ))
            }
            Err(error) => return Err(error.to_string()),
        }
    }

    let keychain_path = app_path.join(KEYCHAIN_DYLIB);
    let bytes = fs::read(&keychain_path).map_err(|error| {
        format!(
            "English extraction refused: could not read {}: {error}",
            keychain_path.display()
        )
    })?;
    let (_, report) = keychain_patch::patch_keychain_query_attributes_owned(bytes)?;
    if report.already_patched_callsites > 0 || report.patched_callsites == 0 {
        return Err(
            "English extraction refused: libExtensionLayer.dylib is not the proven unpatched vendor preimage. Reinstall Cavalry before refreshing the official snapshot."
                .to_string(),
        );
    }
    Ok(())
}

fn observe_clean_vendor(
    packaged_english_dir: &Path,
    app_path: &Path,
    immutable_revision: &str,
    signature: BundleSignatureEvidence,
) -> Result<CleanVendorObservation, String> {
    if immutable_revision.is_empty() {
        return Err("Cannot identify a vendor baseline without an immutable revision.".to_string());
    }
    verify_clean_vendor_runtime(app_path)?;
    let identity =
        detect::require_supported_mac_identity(app_path).map_err(|error| error.to_string())?;
    let expected_revision = format!("macos-identity:{}", identity.official_baseline_fingerprint);
    if immutable_revision != expected_revision {
        return Err(
            "The requested immutable revision does not match the fresh typed Cavalry bundle identity."
                .to_string(),
        );
    }
    let canonical_app = fs::canonicalize(app_path).map_err(|error| error.to_string())?;
    let install_root = path_string(&canonical_app)?;
    let entries = observe_runtime_entries(&canonical_app)?;
    let bundle = VendorBundleIdentity::from_detected(&identity);
    validate_bundle_runtime_cross_links(&bundle, &entries)?;
    let english = patch::observe_clean_english_assets(packaged_english_dir, &canonical_app)?;
    Ok(CleanVendorObservation {
        install_root,
        immutable_revision: immutable_revision.to_string(),
        bundle,
        signature: SnapshotSignature::from_evidence(signature)?,
        english,
        entries,
    })
}

fn observe_runtime_entries(app_path: &Path) -> Result<Vec<SnapshotEntry>, String> {
    TRACKED_PATHS
        .iter()
        .enumerate()
        .map(|(index, relative)| {
            validate_relative_path(relative)?;
            let path = app_path.join(relative);
            match fs::symlink_metadata(&path) {
                Ok(metadata) if metadata.file_type().is_symlink() || !metadata.is_file() => {
                    Err(format!(
                        "Vendor baseline path is not a regular file: {}",
                        path.display()
                    ))
                }
                Ok(metadata) => Ok(SnapshotEntry {
                    relative_path: (*relative).to_string(),
                    backup_name: Some(format!("{index}.official")),
                    original_mode: Some(metadata.permissions().mode()),
                    sha256: Some(sha256_file(&path)?),
                }),
                Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(SnapshotEntry {
                    relative_path: (*relative).to_string(),
                    backup_name: None,
                    original_mode: None,
                    sha256: None,
                }),
                Err(error) => Err(error.to_string()),
            }
        })
        .collect()
}

fn english_section(observation: &EnglishSnapshotObservation) -> EnglishSection {
    EnglishSection {
        relative_directory: ENGLISH_DIRECTORY.to_string(),
        manifest_sha256: observation.manifest_sha256.clone(),
        entry_count: observation.count,
    }
}

fn compute_vendor_baseline_id_from_parts(
    immutable_revision: &str,
    bundle: &VendorBundleIdentity,
    signature: &SnapshotSignature,
    english: &EnglishSection,
    entries: &[SnapshotEntry],
) -> Result<String, String> {
    let payload = serde_json::to_vec(&VendorBaselineMaterial {
        schema_version: BASELINE_SCHEMA_VERSION,
        immutable_revision,
        bundle,
        signature,
        english,
        entries,
    })
    .map_err(|error| error.to_string())?;
    let mut digest = Sha256::new();
    digest.update(b"cavalry-i18n-vendor-baseline-v1\0");
    digest.update(payload);
    Ok(format!("{:x}", digest.finalize()))
}

fn compute_vendor_baseline_id(observation: &CleanVendorObservation) -> Result<String, String> {
    compute_vendor_baseline_id_from_parts(
        &observation.immutable_revision,
        &observation.bundle,
        &observation.signature,
        &english_section(&observation.english),
        &observation.entries,
    )
}

fn compute_generation(install_root: &str, vendor_baseline_id: &str) -> Result<String, String> {
    let payload = serde_json::to_vec(&GenerationMaterial {
        schema_version: GENERATION_SCHEMA_VERSION,
        install_root,
        vendor_baseline_id,
    })
    .map_err(|error| error.to_string())?;
    let mut digest = Sha256::new();
    digest.update(b"cavalry-i18n-vendor-generation-v1\0");
    digest.update(payload);
    Ok(format!("{:x}", digest.finalize()))
}

pub(crate) fn prepare_or_reuse_vendor_baseline<R: CommandRunner>(
    state_dir: &Path,
    packaged_english_dir: &Path,
    app_path: &Path,
    immutable_revision: &str,
    runner: &mut R,
) -> Result<PreparedVendorBaseline, String> {
    let before_signature = privilege::inspect_bundle_signature(app_path, runner)?;
    let before = observe_clean_vendor(
        packaged_english_dir,
        app_path,
        immutable_revision,
        before_signature,
    )?;
    let vendor_baseline_id = compute_vendor_baseline_id(&before)?;
    let generation = compute_generation(&before.install_root, &vendor_baseline_id)?;
    let prepared = PreparedVendorBaseline {
        generation: generation.clone(),
        vendor_baseline_id: vendor_baseline_id.clone(),
        english_manifest_sha256: before.english.manifest_sha256.clone(),
        english_count: before.english.count,
    };
    let provenance = EnglishSnapshotProvenance {
        install_root: before.install_root.clone(),
        immutable_revision: immutable_revision.to_string(),
        snapshot_generation: Some(generation.clone()),
        snapshot_manifest_sha256: Some(before.english.manifest_sha256.clone()),
        vendor_baseline_id: Some(vendor_baseline_id.clone()),
    };

    let generation_dir = generation_path(state_dir, &generation)?;
    match fs::symlink_metadata(&generation_dir) {
        Ok(metadata) => {
            if metadata.file_type().is_symlink() || !metadata.is_dir() {
                return Err(format!(
                    "Official macOS generation path is a symlink or non-directory: {}",
                    generation_dir.display()
                ));
            }
            let verified =
                load_vendor_baseline(state_dir, app_path, immutable_revision, &provenance)?;
            if !verified.matches_observation(&before)? {
                return Err(
                    "Existing official macOS generation does not match the current clean vendor bytes, signature, and English manifest."
                        .to_string(),
                );
            }
            let after_signature = privilege::inspect_bundle_signature(app_path, runner)?;
            let after = observe_clean_vendor(
                packaged_english_dir,
                app_path,
                immutable_revision,
                after_signature,
            )?;
            if after != before {
                return Err(
                    "Cavalry vendor bytes/signature/English assets changed while the existing baseline was being verified."
                        .to_string(),
                );
            }
            return Ok(prepared);
        }
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
        Err(error) => return Err(error.to_string()),
    }

    let generations = generations_root(state_dir);
    create_private_generations_root(state_dir)?;
    let temporary = generations.join(format!(
        ".generation-{}-{}.tmp",
        std::process::id(),
        SNAPSHOT_SEQUENCE.fetch_add(1, Ordering::Relaxed)
    ));
    reject_existing_path(&temporary, "official macOS temporary generation")?;
    fs::create_dir(&temporary).map_err(|error| error.to_string())?;
    fs::set_permissions(&temporary, fs::Permissions::from_mode(0o700))
        .map_err(|error| error.to_string())?;

    let result = (|| {
        let runtime_dir = temporary.join(RUNTIME_DIRECTORY);
        let english_dir = temporary.join(ENGLISH_DIRECTORY);
        fs::create_dir(&runtime_dir).map_err(|error| error.to_string())?;
        fs::set_permissions(&runtime_dir, fs::Permissions::from_mode(0o700))
            .map_err(|error| error.to_string())?;

        stage_runtime_exact(
            Path::new(&before.install_root),
            &runtime_dir,
            &before.entries,
        )?;
        let staged_english =
            patch::stage_english_snapshot_exact(app_path, &english_dir, &before.english)?;
        if staged_english != before.english {
            return Err(
                "Staged English snapshot does not match the before observation.".to_string(),
            );
        }

        let after_signature = privilege::inspect_bundle_signature(app_path, runner)?;
        let after = observe_clean_vendor(
            packaged_english_dir,
            app_path,
            immutable_revision,
            after_signature,
        )?;
        if after != before {
            return Err(
                "Cavalry vendor bytes/signature/English assets changed during unified baseline capture; no durable provenance was committed."
                    .to_string(),
            );
        }

        let manifest = SnapshotManifest {
            schema_version: SCHEMA_VERSION,
            generation: generation.clone(),
            vendor_baseline_id: vendor_baseline_id.clone(),
            install_root: before.install_root.clone(),
            immutable_revision: immutable_revision.to_string(),
            bundle: before.bundle.clone(),
            signature: before.signature.clone(),
            english: english_section(&before.english),
            entries: before.entries.clone(),
        };
        validate_manifest_self_identity(&manifest)?;
        write_manifest(&temporary, &manifest)?;
        protect_and_sync_tree(&temporary)?;

        match fs::rename(&temporary, &generation_dir) {
            Ok(()) => sync_directory(&generations),
            Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => {
                let verified =
                    load_vendor_baseline(state_dir, app_path, immutable_revision, &provenance)?;
                if !verified.matches_observation(&before)? {
                    return Err(
                        "Concurrent official generation publication did not match the observed vendor baseline."
                            .to_string(),
                    );
                }
                Ok(())
            }
            Err(error) => Err(format!(
                "Could not atomically publish official macOS generation {}: {error}",
                generation_dir.display()
            )),
        }
    })();
    if result.is_err() || temporary.exists() {
        let _ = fs::remove_dir_all(&temporary);
    }
    result?;

    let verified = load_vendor_baseline(state_dir, app_path, immutable_revision, &provenance)?;
    if !verified.matches_observation(&before)? {
        return Err("Published official macOS generation failed its final self-check.".to_string());
    }
    Ok(prepared)
}

impl VerifiedVendorBaseline {
    pub(crate) fn english_dir(&self) -> &Path {
        &self.english_dir
    }

    pub(crate) fn english_manifest_sha256(&self) -> &str {
        &self.manifest.english.manifest_sha256
    }

    pub(crate) fn official_info_plist_path(&self) -> Result<PathBuf, String> {
        self.runtime_preimage_path(INFO_PLIST)
    }

    pub(crate) fn official_info_plist_mode(&self) -> Result<u32, String> {
        self.original_mode(INFO_PLIST)
    }

    /// Return one authenticated vendor runtime preimage from this generation.  The generation
    /// loader already validated the manifest, exact directory shape, file hash and private store;
    /// this helper deliberately rechecks the selected file so callers never consume an unchecked
    /// path after retaining the handle.
    pub(crate) fn runtime_preimage_path(&self, relative_path: &str) -> Result<PathBuf, String> {
        let entry = self
            .manifest
            .entries
            .iter()
            .find(|entry| entry.relative_path == relative_path)
            .ok_or_else(|| {
                format!("Official macOS baseline has no runtime entry for {relative_path}.")
            })?;
        let name = entry
            .backup_name
            .as_deref()
            .ok_or_else(|| format!("Official macOS baseline records {relative_path} as absent."))?;
        let expected_hash = entry
            .sha256
            .as_deref()
            .ok_or_else(|| format!("Official macOS baseline has no hash for {relative_path}."))?;
        let path = self.generation_dir.join(RUNTIME_DIRECTORY).join(name);
        require_regular_file(&path, "runtime preimage")?;
        if sha256_regular_file(&path)? != expected_hash {
            return Err(format!(
                "Official macOS runtime preimage changed after verification: {relative_path}."
            ));
        }
        Ok(path)
    }

    fn original_mode(&self, relative_path: &str) -> Result<u32, String> {
        self.manifest
            .entries
            .iter()
            .find(|entry| entry.relative_path == relative_path)
            .and_then(|entry| entry.original_mode)
            .ok_or_else(|| {
                format!("Official macOS baseline has no original mode for {relative_path}.")
            })
    }

    fn matches_observation(&self, observation: &CleanVendorObservation) -> Result<bool, String> {
        Ok(self.manifest.install_root == observation.install_root
            && self.manifest.immutable_revision == observation.immutable_revision
            && self.manifest.bundle == observation.bundle
            && self.manifest.signature == observation.signature
            && self.manifest.english == english_section(&observation.english)
            && self.manifest.entries == observation.entries
            && patch::validate_english_snapshot_at(
                &self.english_dir,
                Path::new(&observation.install_root),
                &observation.english.manifest_sha256,
            )? == observation.english)
    }

    fn matches_current_clean_files(
        &self,
        app_path: &Path,
        immutable_revision: &str,
    ) -> Result<bool, String> {
        let identity =
            detect::require_supported_mac_identity(app_path).map_err(|error| error.to_string())?;
        if format!("macos-identity:{}", identity.official_baseline_fingerprint)
            != immutable_revision
        {
            return Ok(false);
        }
        let canonical_app = fs::canonicalize(app_path).map_err(|error| error.to_string())?;
        let entries = observe_runtime_entries(&canonical_app)?;
        let english = patch::observe_english_snapshot(&canonical_app)?;
        Ok(self.manifest.install_root == path_string(&canonical_app)?
            && self.manifest.immutable_revision == immutable_revision
            && self.manifest.bundle == VendorBundleIdentity::from_detected(&identity)
            && self.manifest.entries == entries
            && self.manifest.english == english_section(&english)
            && patch::validate_english_snapshot_at(
                &self.english_dir,
                &canonical_app,
                &english.manifest_sha256,
            )? == english)
    }

    pub(crate) fn build_restore_plan(
        &self,
        app_path: &Path,
        staging_dir: &Path,
    ) -> Result<RestorePlan, String> {
        let canonical_app = fs::canonicalize(app_path).map_err(|error| error.to_string())?;
        if Path::new(&self.manifest.install_root) != canonical_app {
            return Err(
                "Official restore handle belongs to a different Cavalry installation.".to_string(),
            );
        }
        reject_existing_path(staging_dir, "official restore staging directory")?;
        fs::create_dir_all(staging_dir).map_err(|error| error.to_string())?;
        fs::set_permissions(staging_dir, fs::Permissions::from_mode(0o700))
            .map_err(|error| error.to_string())?;
        let runtime = self.generation_dir.join(RUNTIME_DIRECTORY);
        let mut pairs = Vec::new();
        let mut removals = Vec::new();
        for (index, entry) in self.manifest.entries.iter().enumerate() {
            let destination = canonical_app.join(&entry.relative_path);
            match (&entry.backup_name, entry.original_mode, &entry.sha256) {
                (Some(name), Some(mode), Some(expected_hash)) => {
                    if name != &format!("{index}.official") {
                        return Err("Official snapshot backup name is not canonical.".to_string());
                    }
                    let source = runtime.join(name);
                    let staged = staging_dir.join(name);
                    copy_regular_file_exact(&source, &staged, Some(mode))?;
                    if sha256_regular_file(&staged)? != *expected_hash {
                        return Err(format!(
                            "Official snapshot staged copy failed hash verification: {}",
                            staged.display()
                        ));
                    }
                    pairs.push(CopyPair {
                        src: staged,
                        dst: destination,
                    });
                }
                (None, None, None) => removals.push(destination),
                _ => return Err("Official snapshot entry metadata is incomplete.".to_string()),
            }
        }
        // 外置组件是受管脚本入口的签名副作用，不属于 vendor baseline；显式撤销但不扩张
        // TRACKED_PATHS，以免让既有可信 generation 因 schema 外兼容清理而失效。
        removals.extend(privilege::external_signature_component_paths(
            &canonical_app,
        ));
        Ok(RestorePlan { pairs, removals })
    }

    pub(crate) fn verify_restored_signature<R: CommandRunner>(
        &self,
        app_path: &Path,
        runner: &mut R,
    ) -> Result<(), String> {
        let canonical_app = fs::canonicalize(app_path).map_err(|error| error.to_string())?;
        if Path::new(&self.manifest.install_root) != canonical_app {
            return Err(
                "Restored signature verification used a different Cavalry installation."
                    .to_string(),
            );
        }
        let actual = privilege::inspect_bundle_signature(&canonical_app, runner)?;
        for (field, expected, actual) in [
            (
                "TeamIdentifier",
                self.manifest.signature.team_id.as_deref(),
                actual.team_id.as_deref(),
            ),
            (
                "designated requirement",
                Some(self.manifest.signature.designated_requirement.as_str()),
                actual.designated_requirement.as_deref(),
            ),
            (
                "CDHash",
                Some(self.manifest.signature.cdhash.as_str()),
                actual.cdhash.as_deref(),
            ),
        ] {
            if expected != actual {
                return Err(format!(
                    "Restored Cavalry signature {field} does not match the captured recovery preimage."
                ));
            }
        }
        Ok(())
    }

    /// Prove the complete official postimage, not merely a valid-looking signature.  The typed
    /// bundle identity, exact runtime bytes/modes, exact English asset manifest and captured
    /// captured recovery seal must all agree with the same immutable generation.
    pub(crate) fn verify_restored_bundle<R: CommandRunner>(
        &self,
        app_path: &Path,
        immutable_revision: &str,
        runner: &mut R,
    ) -> Result<(), String> {
        if !self.matches_current_clean_files(app_path, immutable_revision)? {
            return Err(
                "Restored Cavalry bytes, modes, typed identity, or English assets do not match the captured official generation."
                    .to_string(),
            );
        }
        self.verify_restored_signature(app_path, runner)
    }

    /// Verify that a managed bundle is exactly derivable from this vendor generation, allowing
    /// only code-signature material to differ on Mach-O files that Cavalry-i18n re-signs.
    pub(crate) fn verify_managed_runtime(
        &self,
        app_path: &Path,
        expected_injector: &Path,
    ) -> Result<(), String> {
        let canonical_app = fs::canonicalize(app_path).map_err(|error| error.to_string())?;
        if Path::new(&self.manifest.install_root) != canonical_app {
            return Err(
                "Managed runtime verification used a different Cavalry installation.".to_string(),
            );
        }

        let official_info =
            fs::read(self.runtime_preimage_path(INFO_PLIST)?).map_err(|error| error.to_string())?;
        let expected_info = crate::mac_runtime::build_wrapped_info_plist(&official_info)?;
        require_exact_managed_file(
            &canonical_app.join(INFO_PLIST),
            &expected_info,
            Some(self.original_mode(INFO_PLIST)?),
            "Info.plist",
        )?;

        let main =
            fs::read(canonical_app.join(MAIN_EXECUTABLE)).map_err(|error| error.to_string())?;
        if detect::macho_code_identity_sha256(&main)?
            != self.manifest.bundle.main_executable.code_sha256
        {
            return Err(
                "Managed Cavalry main executable changed outside its code-signature material."
                    .to_string(),
            );
        }
        require_mode(
            &canonical_app.join(MAIN_EXECUTABLE),
            self.original_mode(MAIN_EXECUTABLE)?,
            "main executable",
        )?;

        let original_extension = fs::read(self.runtime_preimage_path(KEYCHAIN_DYLIB)?)
            .map_err(|error| error.to_string())?;
        let (expected_extension, expected_report) =
            keychain_patch::patch_keychain_query_attributes_owned(original_extension)?;
        if expected_report.patched_callsites == 0
            || expected_report.already_patched_callsites != 0
            || expected_report.details.iter().any(|detail| {
                detail.patched_callsites == 0 || detail.already_patched_callsites != 0
            })
        {
            return Err(
                "Official ExtensionLayer preimage cannot derive one controlled managed postimage."
                    .to_string(),
            );
        }
        let current_extension =
            fs::read(canonical_app.join(KEYCHAIN_DYLIB)).map_err(|error| error.to_string())?;
        if detect::macho_code_identity_sha256(&current_extension)?
            != detect::macho_code_identity_sha256(&expected_extension)?
        {
            return Err(
                "Managed Cavalry ExtensionLayer changed outside its code-signature material."
                    .to_string(),
            );
        }
        let (_, current_report) =
            keychain_patch::patch_keychain_query_attributes_owned(current_extension)?;
        if current_report.patched_callsites != 0
            || current_report.already_patched_callsites == 0
            || current_report.details.iter().any(|detail| {
                detail.patched_callsites != 0 || detail.already_patched_callsites == 0
            })
        {
            return Err(
                "Managed Cavalry Keychain patch postimage is incomplete or drifted.".to_string(),
            );
        }
        require_mode(
            &canonical_app.join(KEYCHAIN_DYLIB),
            self.original_mode(KEYCHAIN_DYLIB)?,
            "ExtensionLayer",
        )?;

        require_exact_managed_file(
            &canonical_app.join(WRAPPER),
            crate::mac_runtime::build_launch_wrapper().as_bytes(),
            Some(0o755),
            "launcher wrapper",
        )?;
        require_regular_file(expected_injector, "packaged managed injector")?;
        let expected_injector_bytes = fs::read(expected_injector).map_err(|error| {
            format!(
                "Could not read packaged managed injector {}: {error}",
                expected_injector.display()
            )
        })?;
        let expected_injector_mode = fs::metadata(expected_injector)
            .map_err(|error| error.to_string())?
            .permissions()
            .mode();
        require_exact_managed_file(
            &canonical_app.join(INJECTOR),
            &expected_injector_bytes,
            Some(expected_injector_mode),
            "translator injector",
        )?;

        let marker = fs::read(canonical_app.join(MARKER)).map_err(|error| error.to_string())?;
        if ![b"en\n".as_slice(), b"zh-Hans\n", b"zh-Hant\n", b"ja_JP\n"]
            .contains(&marker.as_slice())
        {
            return Err("Managed Cavalry language marker is not canonical.".to_string());
        }
        require_regular_file(&canonical_app.join(CODE_RESOURCES), "managed CodeResources")?;
        Ok(())
    }
}

pub(crate) fn load_vendor_baseline(
    state_dir: &Path,
    app_path: &Path,
    immutable_revision: &str,
    provenance: &EnglishSnapshotProvenance,
) -> Result<VerifiedVendorBaseline, String> {
    let generation = provenance
        .snapshot_generation
        .as_deref()
        .ok_or_else(|| "macOS vendor baseline provenance has no unified generation.".to_string())?;
    let manifest_sha256 = provenance
        .snapshot_manifest_sha256
        .as_deref()
        .ok_or_else(|| {
            "macOS vendor baseline provenance has no English manifest hash.".to_string()
        })?;
    let vendor_baseline_id = provenance.vendor_baseline_id.as_deref().ok_or_else(|| {
        "macOS vendor baseline provenance has no vendor baseline identity.".to_string()
    })?;
    validate_sha256(generation, "official generation")?;
    validate_sha256(manifest_sha256, "English manifest")?;
    validate_sha256(vendor_baseline_id, "vendor baseline")?;

    let canonical_app = fs::canonicalize(app_path).map_err(|error| error.to_string())?;
    if Path::new(&provenance.install_root) != canonical_app
        || provenance.immutable_revision != immutable_revision
    {
        return Err(
            "Official macOS provenance belongs to a different installation or revision."
                .to_string(),
        );
    }

    let root = state_dir.join(SNAPSHOT_ROOT);
    let generations = generations_root(state_dir);
    let generation_dir = generation_path(state_dir, generation)?;
    for (path, label) in [
        (&root, "root"),
        (&generations, "generations directory"),
        (&generation_dir, "generation"),
    ] {
        require_regular_directory(path, label)?;
    }
    require_exact_directory_entries(
        &generation_dir,
        &[MANIFEST_NAME, ENGLISH_DIRECTORY, RUNTIME_DIRECTORY],
        "generation",
    )?;
    let english_dir = generation_dir.join(ENGLISH_DIRECTORY);
    let runtime_dir = generation_dir.join(RUNTIME_DIRECTORY);
    require_regular_directory(&english_dir, "English directory")?;
    require_regular_directory(&runtime_dir, "runtime directory")?;

    let manifest_path = generation_dir.join(MANIFEST_NAME);
    require_regular_file(&manifest_path, "baseline manifest")?;
    let manifest: SnapshotManifest =
        serde_json::from_slice(&fs::read(&manifest_path).map_err(|error| error.to_string())?)
            .map_err(|error| format!("Official macOS baseline manifest is invalid: {error}"))?;
    if manifest.schema_version != SCHEMA_VERSION
        || manifest.generation != generation
        || manifest.vendor_baseline_id != vendor_baseline_id
        || manifest.install_root != provenance.install_root
        || manifest.immutable_revision != immutable_revision
    {
        return Err(
            "Official macOS baseline manifest does not match durable state provenance.".to_string(),
        );
    }
    validate_manifest_self_identity(&manifest)?;
    if manifest.english.relative_directory != ENGLISH_DIRECTORY
        || manifest.english.manifest_sha256 != manifest_sha256
    {
        return Err(
            "Official macOS baseline English section does not match durable state provenance."
                .to_string(),
        );
    }
    let english =
        patch::validate_english_snapshot_at(&english_dir, &canonical_app, manifest_sha256)?;
    if english.count != manifest.english.entry_count {
        return Err("Official macOS baseline English entry count is invalid.".to_string());
    }
    validate_runtime_store(&runtime_dir, &manifest.entries)?;

    Ok(VerifiedVendorBaseline {
        generation_dir,
        english_dir,
        manifest,
    })
}

pub(crate) fn provenance_needs_refresh(
    state_dir: &Path,
    provenance: Option<&EnglishSnapshotProvenance>,
    app_path: &Path,
    immutable_revision: &str,
) -> bool {
    let Some(provenance) = provenance else {
        return true;
    };
    let Ok(baseline) = load_vendor_baseline(state_dir, app_path, immutable_revision, provenance)
    else {
        return true;
    };
    verify_clean_vendor_runtime(app_path).is_ok()
        && !matches!(
            baseline.matches_current_clean_files(app_path, immutable_revision),
            Ok(true)
        )
}

fn validate_manifest_self_identity(manifest: &SnapshotManifest) -> Result<(), String> {
    validate_sha256(&manifest.generation, "official generation")?;
    validate_sha256(&manifest.vendor_baseline_id, "vendor baseline")?;
    validate_sha256(&manifest.english.manifest_sha256, "English manifest")?;
    if !manifest.signature.is_recoverable() {
        return Err("macOS recovery baseline has incomplete signature provenance.".to_string());
    }
    validate_runtime_entries(&manifest.entries)?;
    validate_bundle_runtime_cross_links(&manifest.bundle, &manifest.entries)?;
    let expected_baseline = compute_vendor_baseline_id_from_parts(
        &manifest.immutable_revision,
        &manifest.bundle,
        &manifest.signature,
        &manifest.english,
        &manifest.entries,
    )?;
    if expected_baseline != manifest.vendor_baseline_id {
        return Err("Official macOS vendor baseline digest is invalid.".to_string());
    }
    let expected_generation =
        compute_generation(&manifest.install_root, &manifest.vendor_baseline_id)?;
    if expected_generation != manifest.generation {
        return Err("Official macOS generation digest is invalid.".to_string());
    }
    Ok(())
}

fn validate_runtime_entries(entries: &[SnapshotEntry]) -> Result<(), String> {
    if entries.len() != TRACKED_PATHS.len() {
        return Err("Official macOS baseline has an incomplete runtime surface.".to_string());
    }
    let mut seen = HashSet::new();
    for (index, entry) in entries.iter().enumerate() {
        validate_relative_path(&entry.relative_path)?;
        if entry.relative_path != TRACKED_PATHS[index] || !seen.insert(&entry.relative_path) {
            return Err("Official macOS runtime surface is not canonical.".to_string());
        }
        match (&entry.backup_name, entry.original_mode, &entry.sha256) {
            (Some(name), Some(_), Some(hash)) if index < REQUIRED_PRESENT_COUNT => {
                if name != &format!("{index}.official") {
                    return Err("Official macOS backup name is not canonical.".to_string());
                }
                validate_sha256(hash, "runtime preimage")?;
            }
            (None, None, None) if index >= REQUIRED_PRESENT_COUNT => {}
            _ => {
                return Err(
                    "Official macOS baseline present/absent runtime shape is invalid.".to_string(),
                )
            }
        }
    }
    Ok(())
}

fn validate_bundle_runtime_cross_links(
    bundle: &VendorBundleIdentity,
    entries: &[SnapshotEntry],
) -> Result<(), String> {
    if bundle.bundle_id != detect::SUPPORTED_CAVALRY_BUNDLE_ID
        || bundle.short_version != detect::SUPPORTED_CAVALRY_VERSION
        || bundle.build_version != detect::SUPPORTED_CAVALRY_VERSION
        || bundle.architectures.is_empty()
        || bundle
            .architectures
            .iter()
            .any(|arch| !matches!(arch.as_str(), "arm64" | "x86_64"))
        || bundle.main_executable.relative_path != MAIN_EXECUTABLE
        || bundle.extension_layer.relative_path != KEYCHAIN_DYLIB
    {
        return Err("Official macOS typed bundle identity is unsupported.".to_string());
    }
    for value in [
        bundle.main_executable.raw_sha256.as_str(),
        bundle.main_executable.code_sha256.as_str(),
        bundle.extension_layer.raw_sha256.as_str(),
    ] {
        validate_sha256(value, "typed bundle identity")?;
    }
    let main_hash = entries
        .get(1)
        .and_then(|entry| entry.sha256.as_deref())
        .ok_or_else(|| "Official main executable preimage is missing.".to_string())?;
    let extension_hash = entries
        .get(3)
        .and_then(|entry| entry.sha256.as_deref())
        .ok_or_else(|| "Official ExtensionLayer preimage is missing.".to_string())?;
    if main_hash != bundle.main_executable.raw_sha256
        || extension_hash != bundle.extension_layer.raw_sha256
    {
        return Err(
            "Official runtime preimages do not match the typed bundle file identity.".to_string(),
        );
    }
    Ok(())
}

fn stage_runtime_exact(
    app_path: &Path,
    runtime_dir: &Path,
    entries: &[SnapshotEntry],
) -> Result<(), String> {
    validate_runtime_entries(entries)?;
    for (index, entry) in entries.iter().enumerate() {
        match (&entry.backup_name, entry.original_mode, &entry.sha256) {
            (Some(name), Some(mode), Some(expected_hash)) => {
                let source = app_path.join(&entry.relative_path);
                let destination = runtime_dir.join(name);
                copy_regular_file_exact(&source, &destination, None)?;
                fs::set_permissions(&destination, fs::Permissions::from_mode(0o600))
                    .map_err(|error| error.to_string())?;
                let source_mode = fs::metadata(&source)
                    .map_err(|error| error.to_string())?
                    .permissions()
                    .mode();
                if source_mode != mode || sha256_regular_file(&destination)? != *expected_hash {
                    return Err(format!(
                        "Vendor runtime changed while staging official preimage {}.",
                        entry.relative_path
                    ));
                }
                if name != &format!("{index}.official") {
                    return Err("Official runtime backup name is not canonical.".to_string());
                }
            }
            (None, None, None) => match fs::symlink_metadata(app_path.join(&entry.relative_path)) {
                Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
                Ok(_) => {
                    return Err(format!(
                        "Vendor runtime absence changed while staging {}.",
                        entry.relative_path
                    ))
                }
                Err(error) => return Err(error.to_string()),
            },
            _ => return Err("Official runtime entry metadata is incomplete.".to_string()),
        }
    }
    require_exact_directory_entries(
        runtime_dir,
        &["0.official", "1.official", "2.official", "3.official"],
        "staged runtime",
    )?;
    sync_directory(runtime_dir)
}

fn validate_runtime_store(runtime_dir: &Path, entries: &[SnapshotEntry]) -> Result<(), String> {
    validate_runtime_entries(entries)?;
    let expected_names = entries
        .iter()
        .filter_map(|entry| entry.backup_name.as_deref())
        .collect::<Vec<_>>();
    require_exact_directory_entries(runtime_dir, &expected_names, "runtime store")?;
    for entry in entries {
        if let (Some(name), Some(expected_hash)) = (&entry.backup_name, &entry.sha256) {
            if sha256_regular_file(&runtime_dir.join(name))? != *expected_hash {
                return Err(format!(
                    "Official runtime backup failed hash verification: {}",
                    runtime_dir.join(name).display()
                ));
            }
        }
    }
    Ok(())
}

fn generations_root(state_dir: &Path) -> PathBuf {
    state_dir.join(SNAPSHOT_ROOT).join(GENERATIONS_DIRECTORY)
}

fn generation_path(state_dir: &Path, generation: &str) -> Result<PathBuf, String> {
    validate_sha256(generation, "official generation")?;
    Ok(generations_root(state_dir).join(generation))
}

fn create_private_generations_root(state_dir: &Path) -> Result<(), String> {
    let root = state_dir.join(SNAPSHOT_ROOT);
    let generations = generations_root(state_dir);
    fs::create_dir_all(&generations).map_err(|error| error.to_string())?;
    for (path, label) in [
        (state_dir, "state root"),
        (root.as_path(), "official root"),
        (generations.as_path(), "official generations root"),
    ] {
        require_regular_directory(path, label)?;
        fs::set_permissions(path, fs::Permissions::from_mode(0o700))
            .map_err(|error| error.to_string())?;
    }
    Ok(())
}

fn validate_relative_path(value: &str) -> Result<(), String> {
    let path = Path::new(value);
    if value.is_empty()
        || path.is_absolute()
        || path
            .components()
            .any(|component| !matches!(component, Component::Normal(_)))
    {
        return Err(format!("Invalid official snapshot relative path: {value}"));
    }
    Ok(())
}

fn validate_sha256(value: &str, label: &str) -> Result<(), String> {
    if value.len() == 64
        && value
            .bytes()
            .all(|byte| byte.is_ascii_hexdigit() && !byte.is_ascii_uppercase())
    {
        Ok(())
    } else {
        Err(format!("Official macOS {label} is not lowercase SHA-256."))
    }
}

fn write_manifest(directory: &Path, manifest: &SnapshotManifest) -> Result<(), String> {
    let payload = serde_json::to_vec_pretty(manifest).map_err(|error| error.to_string())?;
    let path = directory.join(MANIFEST_NAME);
    let mut file = fs::OpenOptions::new()
        .create_new(true)
        .write(true)
        .mode(0o600)
        .open(&path)
        .map_err(|error| error.to_string())?;
    file.write_all(&payload)
        .map_err(|error| error.to_string())?;
    file.write_all(b"\n").map_err(|error| error.to_string())?;
    file.sync_all().map_err(|error| error.to_string())
}

fn copy_regular_file_exact(
    source: &Path,
    destination: &Path,
    mode: Option<u32>,
) -> Result<(), String> {
    require_regular_file(source, "copy source")?;
    reject_existing_path(destination, "copy destination")?;
    fs::copy(source, destination).map_err(|error| {
        format!(
            "Could not copy {} to {}: {error}",
            source.display(),
            destination.display()
        )
    })?;
    if let Some(mode) = mode {
        fs::set_permissions(destination, fs::Permissions::from_mode(mode))
            .map_err(|error| error.to_string())?;
    }
    File::open(destination)
        .and_then(|file| file.sync_all())
        .map_err(|error| error.to_string())
}

fn require_exact_directory_entries(
    directory: &Path,
    expected: &[&str],
    label: &str,
) -> Result<(), String> {
    require_regular_directory(directory, label)?;
    let mut actual = fs::read_dir(directory)
        .map_err(|error| error.to_string())?
        .map(|entry| {
            entry
                .map_err(|error| error.to_string())?
                .file_name()
                .into_string()
                .map_err(|_| format!("Official macOS {label} contains a non-UTF-8 name."))
        })
        .collect::<Result<Vec<_>, String>>()?;
    actual.sort();
    let mut expected = expected
        .iter()
        .map(|value| (*value).to_string())
        .collect::<Vec<_>>();
    expected.sort();
    if actual != expected {
        return Err(format!(
            "Official macOS {label} has unexpected entries: expected {expected:?}, got {actual:?}."
        ));
    }
    Ok(())
}

fn reject_existing_path(path: &Path, label: &str) -> Result<(), String> {
    match fs::symlink_metadata(path) {
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Ok(_) => Err(format!("{label} already exists: {}", path.display())),
        Err(error) => Err(error.to_string()),
    }
}

fn protect_and_sync_tree(path: &Path) -> Result<(), String> {
    let metadata = fs::symlink_metadata(path).map_err(|error| error.to_string())?;
    if metadata.file_type().is_symlink() {
        return Err(format!(
            "Official macOS generation contains a symlink: {}",
            path.display()
        ));
    }
    if metadata.is_file() {
        fs::set_permissions(path, fs::Permissions::from_mode(0o600))
            .map_err(|error| error.to_string())?;
        return File::open(path)
            .and_then(|file| file.sync_all())
            .map_err(|error| error.to_string());
    }
    if !metadata.is_dir() {
        return Err(format!(
            "Official macOS generation contains a special file: {}",
            path.display()
        ));
    }
    fs::set_permissions(path, fs::Permissions::from_mode(0o700))
        .map_err(|error| error.to_string())?;
    for entry in fs::read_dir(path).map_err(|error| error.to_string())? {
        protect_and_sync_tree(&entry.map_err(|error| error.to_string())?.path())?;
    }
    sync_directory(path)
}

fn sha256_file(path: &Path) -> Result<String, String> {
    let mut file = File::open(path).map_err(|error| error.to_string())?;
    let mut hasher = Sha256::new();
    let mut buffer = [0_u8; 64 * 1024];
    loop {
        let count = file.read(&mut buffer).map_err(|error| error.to_string())?;
        if count == 0 {
            break;
        }
        hasher.update(&buffer[..count]);
    }
    Ok(format!("{:x}", hasher.finalize()))
}

fn sha256_regular_file(path: &Path) -> Result<String, String> {
    require_regular_file(path, "hash input")?;
    sha256_file(path)
}

fn require_mode(path: &Path, expected_mode: u32, label: &str) -> Result<(), String> {
    require_regular_file(path, label)?;
    let actual_mode = fs::metadata(path)
        .map_err(|error| error.to_string())?
        .permissions()
        .mode()
        & 0o7777;
    let expected_mode = expected_mode & 0o7777;
    if actual_mode != expected_mode {
        return Err(format!(
            "Managed Cavalry {label} mode drifted: expected {expected_mode:#o}, got {actual_mode:#o}."
        ));
    }
    Ok(())
}

fn require_exact_managed_file(
    path: &Path,
    expected: &[u8],
    expected_mode: Option<u32>,
    label: &str,
) -> Result<(), String> {
    require_regular_file(path, label)?;
    let actual = fs::read(path).map_err(|error| error.to_string())?;
    if actual != expected {
        return Err(format!(
            "Managed Cavalry {label} has drifted: bytes differ from the verified baseline-derived postimage."
        ));
    }
    if let Some(expected_mode) = expected_mode {
        require_mode(path, expected_mode, label)?;
    }
    Ok(())
}

fn require_regular_file(path: &Path, label: &str) -> Result<(), String> {
    let metadata = fs::symlink_metadata(path).map_err(|error| {
        format!(
            "Official macOS {label} is missing at {}: {error}",
            path.display()
        )
    })?;
    if metadata.file_type().is_symlink() || !metadata.is_file() {
        return Err(format!(
            "Official macOS {label} is not a regular non-symlink file: {}",
            path.display()
        ));
    }
    Ok(())
}

fn require_regular_directory(path: &Path, label: &str) -> Result<(), String> {
    let metadata = fs::symlink_metadata(path).map_err(|error| {
        format!(
            "Official macOS {label} is missing at {}: {error}",
            path.display()
        )
    })?;
    if metadata.file_type().is_symlink() || !metadata.is_dir() {
        return Err(format!(
            "Official macOS {label} is not a regular non-symlink directory: {}",
            path.display()
        ));
    }
    Ok(())
}

fn path_string(path: &Path) -> Result<String, String> {
    path.to_str()
        .map(str::to_string)
        .ok_or_else(|| format!("Snapshot path is not valid UTF-8: {}", path.display()))
}

fn sync_directory(path: &Path) -> Result<(), String> {
    File::open(path)
        .and_then(|directory| directory.sync_all())
        .map_err(|error| format!("Could not sync {}: {error}", path.display()))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::privilege::CommandStatus;

    fn write(path: &Path, bytes: &[u8]) {
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::write(path, bytes).unwrap();
    }

    fn macho_arm64() -> Vec<u8> {
        let mut bytes = vec![0_u8; 32];
        bytes[0..4].copy_from_slice(&0xfeedfacf_u32.to_le_bytes());
        bytes[4..8].copy_from_slice(&0x0100_000c_u32.to_le_bytes());
        bytes
    }

    fn clean_bundle(root: &Path) -> (PathBuf, PathBuf) {
        let app = root.join("Cavalry.app");
        let packaged = root.join("packaged-en");
        let mut info = plist::Dictionary::new();
        for (key, value) in [
            ("CFBundleIdentifier", "com.scenegroup.cavalry"),
            ("CFBundleShortVersionString", "2.7.2"),
            ("CFBundleVersion", "2.7.2"),
            ("CFBundleExecutable", "Cavalry"),
        ] {
            info.insert(key.to_string(), plist::Value::String(value.to_string()));
        }
        fs::create_dir_all(app.join("Contents")).unwrap();
        plist::Value::Dictionary(info)
            .to_file_xml(app.join(INFO_PLIST))
            .unwrap();
        write(&app.join(MAIN_EXECUTABLE), &macho_arm64());
        write(
            &app.join(KEYCHAIN_DYLIB),
            &keychain_patch::build_synthetic_keychain_dylib(Some("arm64"), false),
        );
        write(&app.join(CODE_RESOURCES), b"vendor code resources");
        for (language_relative, asset_relative) in patch::CORE_MAP {
            let bytes = format!("{{\"path\":{asset_relative:?}}}");
            write(
                &app.join("Contents/assets").join(asset_relative),
                bytes.as_bytes(),
            );
            write(&packaged.join(language_relative), bytes.as_bytes());
        }
        (app, packaged)
    }

    #[derive(Clone)]
    struct SignatureRunner {
        cdhash: String,
        calls: usize,
        mutate_on_call: Option<(usize, PathBuf)>,
    }

    impl SignatureRunner {
        fn vendor() -> Self {
            Self {
                cdhash: "0123456789abcdef".to_string(),
                calls: 0,
                mutate_on_call: None,
            }
        }
    }

    impl CommandRunner for SignatureRunner {
        fn run(&mut self, _program: &str, _args: &[String]) -> Result<(), String> {
            Ok(())
        }

        fn run_captured(
            &mut self,
            _program: &str,
            args: &[String],
        ) -> Result<CommandStatus, String> {
            self.calls += 1;
            if self
                .mutate_on_call
                .as_ref()
                .is_some_and(|(call, _)| *call == self.calls)
            {
                let (_, path) = self.mutate_on_call.take().unwrap();
                let mut bytes = fs::read(&path).unwrap();
                bytes.push(0x7f);
                fs::write(path, bytes).unwrap();
            }
            if args.iter().any(|arg| arg == "-dv") {
                return Ok(CommandStatus {
                    exit_code: Some(0),
                    stdout: String::new(),
                    stderr: format!(
                        "TeamIdentifier={}\nCDHash={}\n",
                        detect::SUPPORTED_CAVALRY_TEAM_ID,
                        self.cdhash
                    ),
                });
            }
            if args.iter().any(|arg| arg == "-dr") {
                return Ok(CommandStatus {
                    exit_code: Some(0),
                    stdout: String::new(),
                    stderr: format!(
                        "designated => anchor apple generic and identifier \"{}\" and certificate leaf[subject.OU] = {}\n",
                        detect::SUPPORTED_CAVALRY_BUNDLE_ID,
                        detect::SUPPORTED_CAVALRY_TEAM_ID
                    ),
                });
            }
            Ok(CommandStatus {
                exit_code: Some(0),
                stdout: String::new(),
                stderr: String::new(),
            })
        }
    }

    fn revision(app: &Path) -> String {
        detect::read_bundle_revision_for_write(app).unwrap()
    }

    fn provenance(
        app: &Path,
        revision: &str,
        prepared: &PreparedVendorBaseline,
    ) -> EnglishSnapshotProvenance {
        EnglishSnapshotProvenance {
            install_root: fs::canonicalize(app).unwrap().to_string_lossy().to_string(),
            immutable_revision: revision.to_string(),
            snapshot_generation: Some(prepared.generation.clone()),
            snapshot_manifest_sha256: Some(prepared.english_manifest_sha256.clone()),
            vendor_baseline_id: Some(prepared.vendor_baseline_id.clone()),
        }
    }

    #[test]
    fn unified_capture_has_one_generation_and_no_standalone_current_pointer() {
        let temp = tempfile::tempdir().unwrap();
        let root = fs::canonicalize(temp.path()).unwrap();
        let (app, packaged) = clean_bundle(&root);
        let state = root.join("state");
        let immutable_revision = revision(&app);
        let mut runner = SignatureRunner::vendor();

        let prepared = prepare_or_reuse_vendor_baseline(
            &state,
            &packaged,
            &app,
            &immutable_revision,
            &mut runner,
        )
        .unwrap();
        let handle = load_vendor_baseline(
            &state,
            &app,
            &immutable_revision,
            &provenance(&app, &immutable_revision, &prepared),
        )
        .unwrap();

        assert_eq!(prepared.english_count, patch::CORE_MAP.len());
        assert!(handle
            .english_dir()
            .join(patch::ENGLISH_SNAPSHOT_MANIFEST_NAME)
            .is_file());
        assert!(!state.join("english-snapshots/current.json").exists());
        assert!(generation_path(&state, &prepared.generation)
            .unwrap()
            .is_dir());
    }

    #[test]
    fn exact_existing_generation_is_reused_only_after_current_vendor_comparison() {
        let temp = tempfile::tempdir().unwrap();
        let root = fs::canonicalize(temp.path()).unwrap();
        let (app, packaged) = clean_bundle(&root);
        let state = root.join("state");
        let immutable_revision = revision(&app);
        let mut runner = SignatureRunner::vendor();
        let first = prepare_or_reuse_vendor_baseline(
            &state,
            &packaged,
            &app,
            &immutable_revision,
            &mut runner,
        )
        .unwrap();
        let second = prepare_or_reuse_vendor_baseline(
            &state,
            &packaged,
            &app,
            &immutable_revision,
            &mut runner,
        )
        .unwrap();
        assert_eq!(first, second);
        assert!(
            runner.calls >= 12,
            "both before/after signature observations must run"
        );
    }

    #[test]
    fn extension_or_signature_change_creates_a_different_baseline_even_when_revision_is_stable() {
        let temp = tempfile::tempdir().unwrap();
        let root = fs::canonicalize(temp.path()).unwrap();
        let (app, packaged) = clean_bundle(&root);
        let state = root.join("state");
        let immutable_revision = revision(&app);
        let mut runner = SignatureRunner::vendor();
        let first = prepare_or_reuse_vendor_baseline(
            &state,
            &packaged,
            &app,
            &immutable_revision,
            &mut runner,
        )
        .unwrap();

        let extension = app.join(KEYCHAIN_DYLIB);
        let mut extension_bytes = fs::read(&extension).unwrap();
        extension_bytes.push(0x42);
        fs::write(&extension, extension_bytes).unwrap();
        assert_eq!(
            revision(&app),
            immutable_revision,
            "compatibility revision intentionally excludes ExtensionLayer bytes"
        );
        let second = prepare_or_reuse_vendor_baseline(
            &state,
            &packaged,
            &app,
            &immutable_revision,
            &mut runner,
        )
        .unwrap();
        assert_ne!(first.vendor_baseline_id, second.vendor_baseline_id);
        assert_ne!(first.generation, second.generation);

        runner.cdhash = "fedcba9876543210".to_string();
        let third = prepare_or_reuse_vendor_baseline(
            &state,
            &packaged,
            &app,
            &immutable_revision,
            &mut runner,
        )
        .unwrap();
        assert_ne!(second.vendor_baseline_id, third.vendor_baseline_id);
    }

    #[test]
    fn mutation_between_staging_and_second_signature_leaves_no_current_commit() {
        let temp = tempfile::tempdir().unwrap();
        let root = fs::canonicalize(temp.path()).unwrap();
        let (app, packaged) = clean_bundle(&root);
        let state = root.join("state");
        let revision = revision(&app);
        let mut runner = SignatureRunner::vendor();
        runner.mutate_on_call = Some((4, app.join(KEYCHAIN_DYLIB)));

        let error =
            prepare_or_reuse_vendor_baseline(&state, &packaged, &app, &revision, &mut runner)
                .unwrap_err();
        assert!(
            error.contains("changed during unified baseline capture"),
            "{error}"
        );
        assert!(!state.join("state.json").exists());
        assert!(!state.join("english-snapshots/current.json").exists());
    }

    #[test]
    fn tampered_english_runtime_or_manifest_invalidates_the_whole_handle() {
        let temp = tempfile::tempdir().unwrap();
        let root = fs::canonicalize(temp.path()).unwrap();
        let (app, packaged) = clean_bundle(&root);
        let revision = revision(&app);
        for target in ["english", "runtime", "manifest"] {
            let state = root.join(format!("state-{target}"));
            let mut runner = SignatureRunner::vendor();
            let prepared =
                prepare_or_reuse_vendor_baseline(&state, &packaged, &app, &revision, &mut runner)
                    .unwrap();
            let generation = generation_path(&state, &prepared.generation).unwrap();
            match target {
                "english" => fs::write(generation.join("english/appStrings.json"), b"{}").unwrap(),
                "runtime" => fs::write(generation.join("runtime/1.official"), b"tamper").unwrap(),
                "manifest" => {
                    let path = generation.join(MANIFEST_NAME);
                    let mut value: serde_json::Value =
                        serde_json::from_slice(&fs::read(&path).unwrap()).unwrap();
                    value["signature"]["cdhash"] = serde_json::Value::String("bad".to_string());
                    fs::write(path, serde_json::to_vec_pretty(&value).unwrap()).unwrap();
                }
                _ => unreachable!(),
            }
            assert!(load_vendor_baseline(
                &state,
                &app,
                &revision,
                &provenance(&app, &revision, &prepared),
            )
            .is_err());
        }
    }

    #[cfg(unix)]
    #[test]
    fn symlinked_generation_child_is_rejected() {
        use std::os::unix::fs::symlink;

        let temp = tempfile::tempdir().unwrap();
        let root = fs::canonicalize(temp.path()).unwrap();
        let (app, packaged) = clean_bundle(&root);
        let state = root.join("state");
        let revision = revision(&app);
        let mut runner = SignatureRunner::vendor();
        let prepared =
            prepare_or_reuse_vendor_baseline(&state, &packaged, &app, &revision, &mut runner)
                .unwrap();
        let generation = generation_path(&state, &prepared.generation).unwrap();
        let backup = generation.join("runtime/0.official");
        let outside = root.join("outside");
        fs::write(&outside, fs::read(&backup).unwrap()).unwrap();
        fs::remove_file(&backup).unwrap();
        symlink(&outside, &backup).unwrap();

        let error = load_vendor_baseline(
            &state,
            &app,
            &revision,
            &provenance(&app, &revision, &prepared),
        )
        .unwrap_err();
        assert!(error.contains("non-symlink file"), "{error}");
    }

    #[test]
    fn one_verified_handle_supplies_english_and_official_runtime_restore() {
        let temp = tempfile::tempdir().unwrap();
        let root = fs::canonicalize(temp.path()).unwrap();
        let (app, packaged) = clean_bundle(&root);
        let state = root.join("state");
        let revision = revision(&app);
        let original_main = fs::read(app.join(MAIN_EXECUTABLE)).unwrap();
        let mut runner = SignatureRunner::vendor();
        let prepared =
            prepare_or_reuse_vendor_baseline(&state, &packaged, &app, &revision, &mut runner)
                .unwrap();
        let handle = load_vendor_baseline(
            &state,
            &app,
            &revision,
            &provenance(&app, &revision, &prepared),
        )
        .unwrap();

        write(&app.join(WRAPPER), b"wrapper");
        write(&app.join(INJECTOR), b"injector");
        write(&app.join(MARKER), b"zh-Hans\n");
        let plan = handle
            .build_restore_plan(&app, &root.join("restore-stage"))
            .unwrap();
        assert_eq!(plan.pairs.len(), 4);
        assert_eq!(plan.removals.len(), 6);
        for component in privilege::external_signature_component_paths(&app) {
            assert!(plan.removals.contains(&component));
        }
        let main = plan
            .pairs
            .iter()
            .find(|pair| pair.dst == app.join(MAIN_EXECUTABLE))
            .unwrap();
        assert_eq!(fs::read(&main.src).unwrap(), original_main);
        assert!(handle.english_dir().join("appStrings.json").is_file());
    }

    #[test]
    fn managed_extension_must_equal_the_baseline_derived_code_postimage() {
        let temp = tempfile::tempdir().unwrap();
        let root = fs::canonicalize(temp.path()).unwrap();
        let (app, packaged) = clean_bundle(&root);
        let state = root.join("state");
        let revision = revision(&app);
        let mut runner = SignatureRunner::vendor();
        let prepared =
            prepare_or_reuse_vendor_baseline(&state, &packaged, &app, &revision, &mut runner)
                .unwrap();
        let handle = load_vendor_baseline(
            &state,
            &app,
            &revision,
            &provenance(&app, &revision, &prepared),
        )
        .unwrap();

        let official_info = fs::read(handle.runtime_preimage_path(INFO_PLIST).unwrap()).unwrap();
        fs::write(
            app.join(INFO_PLIST),
            crate::mac_runtime::build_wrapped_info_plist(&official_info).unwrap(),
        )
        .unwrap();
        fs::write(
            app.join(WRAPPER),
            crate::mac_runtime::build_launch_wrapper(),
        )
        .unwrap();
        fs::set_permissions(app.join(WRAPPER), fs::Permissions::from_mode(0o755)).unwrap();
        let packaged_injector = root.join("packaged-injector.dylib");
        fs::write(&packaged_injector, b"controlled injector").unwrap();
        fs::write(app.join(INJECTOR), fs::read(&packaged_injector).unwrap()).unwrap();
        fs::create_dir_all(app.join("Contents/Resources")).unwrap();
        fs::write(app.join(MARKER), b"zh-Hans\n").unwrap();
        let original_extension =
            fs::read(handle.runtime_preimage_path(KEYCHAIN_DYLIB).unwrap()).unwrap();
        let (patched_extension, _) =
            keychain_patch::patch_keychain_query_attributes_owned(original_extension).unwrap();
        fs::write(app.join(KEYCHAIN_DYLIB), &patched_extension).unwrap();

        handle
            .verify_managed_runtime(&app, &packaged_injector)
            .unwrap();

        let mut drifted = patched_extension;
        drifted.push(0x7f);
        fs::write(app.join(KEYCHAIN_DYLIB), drifted).unwrap();
        let error = handle
            .verify_managed_runtime(&app, &packaged_injector)
            .unwrap_err();
        assert!(
            error.contains("outside its code-signature material"),
            "{error}"
        );
    }

    #[test]
    fn official_restore_postcondition_rechecks_typed_bytes_and_assets() {
        let temp = tempfile::tempdir().unwrap();
        let root = fs::canonicalize(temp.path()).unwrap();
        let (app, packaged) = clean_bundle(&root);
        let state = root.join("state");
        let revision = revision(&app);
        let mut runner = SignatureRunner::vendor();
        let prepared =
            prepare_or_reuse_vendor_baseline(&state, &packaged, &app, &revision, &mut runner)
                .unwrap();
        let handle = load_vendor_baseline(
            &state,
            &app,
            &revision,
            &provenance(&app, &revision, &prepared),
        )
        .unwrap();

        handle
            .verify_restored_bundle(&app, &revision, &mut runner)
            .unwrap();
        fs::write(
            app.join("Contents/assets/Definitions/appStrings.json"),
            b"{\"drift\":true}",
        )
        .unwrap();
        let error = handle
            .verify_restored_bundle(&app, &revision, &mut runner)
            .unwrap_err();
        assert!(error.contains("do not match"), "{error}");
    }
}
