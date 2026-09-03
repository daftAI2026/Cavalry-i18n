/**
 * [INPUT]: 依赖 snapshot 的 packaged English source 定位、patch 的 legacy/immutable snapshot gate、install identity、macOS p1-p5 已发布 wrapper/injector/Keychain postimage 与 Windows QPA 只读证据；Stock 旧状态通过只读 restore plan 同时证明 vendor qwindows 和 generic 所有权。
 * [OUTPUT]: 提供 legacy provenance 完整性判定、macOS Managed Legacy/Windows 旧快照的只读可信识别、macOS 快照/runtime 首个失败门诊断，以及 apply 阶段的 immutable English generation 迁移；若 generation 已发布而语言事务尚未提交 provenance，则严格复证后直接关联同一 generation。
 * [POS]: commands 的兼容迁移子模块；status 只消费严格 postimage 证明，apply/restore 才接管 generation 发布与 provenance 关联，绝不从未知修改或当前翻译安装反向生成英文备份，也不因上次权限阻断留下的已验证 generation 重复迁移。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
use std::{fs, path::Path};

use crate::{
    install::{InstallLayout, InstallPlatform},
    patch,
    state::{EnglishSnapshotProvenance, State},
};

use super::super::context::language_source_dir;

#[cfg(target_os = "macos")]
const RELEASED_MACOS_INJECTOR_CODE_IDENTITIES: [&str; 3] = [
    "cb2af0df05c7db23fbce3d80494c3c34b5f37372aab3fb1e04ea951499306d3e",
    "81d352b386275f1ec4b2f96d6de5eaad5fc701379d48ed3a30df1831d636b2d3",
    "a84ab7d7978015c14d7ba9bb6cdce2981a53ad5a6daaf68c3374d81ef2927b47",
];

#[cfg(target_os = "macos")]
const RELEASED_MACOS_WRAPPER_V1: &[u8] = br#"#!/bin/sh
set -eu
SELF_DIR="$(CDPATH= cd -- "$(dirname "$0")" && pwd)"
APP_ROOT="$(CDPATH= cd -- "$SELF_DIR/.." && pwd)"
LANG_FILE="$APP_ROOT/Resources/cavalry-i18n-lang.txt"
INJECTOR_PATH="$APP_ROOT/Frameworks/libCavalryTranslatorInjector.dylib"
LANG_CODE=""
if [ -f "$LANG_FILE" ]; then
  LANG_CODE="$(tr -d '\n' < "$LANG_FILE")"
fi
if [ -n "$LANG_CODE" ] && [ -f "$INJECTOR_PATH" ]; then
  export DYLD_INSERT_LIBRARIES="$INJECTOR_PATH"
  export CAVALRY_I18N_LANG="$LANG_CODE"
else
  unset DYLD_INSERT_LIBRARIES
  unset CAVALRY_I18N_LANG
fi
exec "$SELF_DIR/Cavalry" "$@"
"#;

#[cfg(target_os = "macos")]
fn is_regular_file(path: &Path) -> bool {
    fs::symlink_metadata(path)
        .is_ok_and(|metadata| metadata.file_type().is_file() && !metadata.file_type().is_symlink())
}

#[cfg(target_os = "macos")]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) struct MacosManagedLegacyProofDiagnostics {
    pub(crate) proven: bool,
    pub(crate) snapshot_proven: bool,
    pub(crate) runtime_proven: bool,
    pub(crate) snapshot_reason: &'static str,
    pub(crate) runtime_reason: &'static str,
}

#[cfg(target_os = "macos")]
fn macos_managed_legacy_runtime_reason_with_identities(
    current: &State,
    app_path: &Path,
    released_injector_identities: &[&str],
) -> &'static str {
    if current.current_lang == "pending"
        || !matches!(
            current.current_lang.as_str(),
            "en" | "zh-Hans" | "zh-Hant" | "ja_JP"
        )
    {
        return "invalidCurrentLanguage";
    }
    let wrapper = app_path.join("Contents/MacOS/CavalryLauncher");
    let injector = app_path.join("Contents/Frameworks/libCavalryTranslatorInjector.dylib");
    let extension = app_path.join("Contents/Frameworks/libExtensionLayer.dylib");
    let marker = app_path.join("Contents/Resources/cavalry-i18n-lang.txt");
    if !is_regular_file(&wrapper) {
        return "wrapperMissingOrUnsafe";
    }
    if !is_regular_file(&injector) {
        return "injectorMissingOrUnsafe";
    }
    if !is_regular_file(&extension) {
        return "extensionMissingOrUnsafe";
    }
    if !is_regular_file(&marker) {
        return "markerMissingOrUnsafe";
    }
    if !matches!(fs::read(&wrapper), Ok(bytes) if bytes == RELEASED_MACOS_WRAPPER_V1) {
        return "wrapperMismatch";
    }
    let marker_value = match fs::read_to_string(&marker) {
        Ok(value) => value.trim().to_string(),
        Err(_) => return "markerUnreadable",
    };
    if marker_value != current.current_lang {
        return "markerStateMismatch";
    }
    let injector_identity = match fs::read(&injector) {
        Ok(bytes) => match crate::detect::macho_code_identity_sha256(&bytes) {
            Ok(identity) => identity,
            Err(_) => return "injectorIdentityUnreadable",
        },
        Err(_) => return "injectorUnreadable",
    };
    if !released_injector_identities.contains(&injector_identity.as_str()) {
        return "injectorIdentityUnknown";
    }
    let extension_bytes = match fs::read(&extension) {
        Ok(bytes) => bytes,
        Err(_) => return "extensionUnreadable",
    };
    let Ok((_, report)) =
        crate::keychain_patch::patch_keychain_query_attributes_owned(extension_bytes)
    else {
        return "extensionPatchUnrecognized";
    };
    if report.patched_callsites == 0
        && report.already_patched_callsites > 0
        && report
            .details
            .iter()
            .all(|detail| detail.patched_callsites == 0 && detail.already_patched_callsites > 0)
    {
        "proven"
    } else {
        "extensionPatchUnrecognized"
    }
}

#[cfg(all(test, target_os = "macos"))]
fn macos_managed_legacy_runtime_is_proven_with_identities(
    current: &State,
    app_path: &Path,
    released_injector_identities: &[&str],
) -> bool {
    macos_managed_legacy_runtime_reason_with_identities(
        current,
        app_path,
        released_injector_identities,
    ) == "proven"
}

#[cfg(all(test, target_os = "macos"))]
mod macos_tests {
    use super::*;

    fn write(path: &Path, bytes: impl AsRef<[u8]>) {
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::write(path, bytes).unwrap();
    }

    fn signed_macho_arm64(signature: &[u8]) -> Vec<u8> {
        let mut bytes = vec![0_u8; 64];
        bytes[0..4].copy_from_slice(&0xfeedfacf_u32.to_le_bytes());
        bytes[4..8].copy_from_slice(&0x0100_000c_u32.to_le_bytes());
        bytes[16..20].copy_from_slice(&1_u32.to_le_bytes());
        bytes[20..24].copy_from_slice(&16_u32.to_le_bytes());
        bytes[32..36].copy_from_slice(&0x1d_u32.to_le_bytes());
        bytes[36..40].copy_from_slice(&16_u32.to_le_bytes());
        bytes[40..44].copy_from_slice(&64_u32.to_le_bytes());
        bytes[44..48].copy_from_slice(&(signature.len() as u32).to_le_bytes());
        bytes[60] = 0x41;
        bytes.extend_from_slice(signature);
        bytes
    }

    #[test]
    fn managed_legacy_runtime_requires_exact_released_postimage_evidence() {
        let temp = tempfile::tempdir().unwrap();
        let app = temp.path().join("Cavalry.app");
        let injector = signed_macho_arm64(b"released-injector-fixture");
        let injector_identity = crate::detect::macho_code_identity_sha256(&injector).unwrap();
        let extension = crate::keychain_patch::build_synthetic_keychain_dylib(Some("arm64"), false);
        let (patched_extension, report) =
            crate::keychain_patch::patch_keychain_query_attributes_owned(extension).unwrap();
        assert!(report.patched_callsites > 0);

        write(
            &app.join("Contents/MacOS/CavalryLauncher"),
            RELEASED_MACOS_WRAPPER_V1,
        );
        write(
            &app.join("Contents/Frameworks/libCavalryTranslatorInjector.dylib"),
            injector,
        );
        write(
            &app.join("Contents/Frameworks/libExtensionLayer.dylib"),
            patched_extension,
        );
        write(
            &app.join("Contents/Resources/cavalry-i18n-lang.txt"),
            b"zh-Hans\n",
        );
        let state = State {
            current_lang: "zh-Hans".to_string(),
            ..State::default()
        };

        assert!(macos_managed_legacy_runtime_is_proven_with_identities(
            &state,
            &app,
            &[injector_identity.as_str()],
        ));
        assert!(!macos_managed_legacy_runtime_is_proven_with_identities(
            &state,
            &app,
            &["unreleased-identity"],
        ));
        assert_eq!(
            macos_managed_legacy_runtime_reason_with_identities(
                &state,
                &app,
                &["unreleased-identity"],
            ),
            "injectorIdentityUnknown"
        );

        write(
            &app.join("Contents/Resources/cavalry-i18n-lang.txt"),
            b"ja_JP\n",
        );
        assert!(!macos_managed_legacy_runtime_is_proven_with_identities(
            &state,
            &app,
            &[injector_identity.as_str()],
        ));
        assert_eq!(
            macos_managed_legacy_runtime_reason_with_identities(
                &state,
                &app,
                &[injector_identity.as_str()],
            ),
            "markerStateMismatch"
        );
    }

    #[test]
    fn migrated_managed_legacy_generation_remains_proven_without_vendor_baseline() {
        let temp = tempfile::tempdir().unwrap();
        let repo = temp.path().join("repo");
        let state_dir = temp.path().join("state");
        let app = temp.path().join("Cavalry.app");
        for (language_relative, asset_relative) in patch::CORE_MAP {
            write(
                &repo.join("languages/en").join(language_relative),
                br#"{"value":"English"}"#,
            );
            write(
                &state_dir.join("en").join(language_relative),
                br#"{"value":"English"}"#,
            );
            write(
                &app.join("Contents/assets").join(asset_relative),
                br#"{"value":"English"}"#,
            );
        }
        let injector = signed_macho_arm64(b"released-generation-fixture");
        let injector_identity = crate::detect::macho_code_identity_sha256(&injector).unwrap();
        let extension = crate::keychain_patch::build_synthetic_keychain_dylib(Some("arm64"), false);
        let (patched_extension, _) =
            crate::keychain_patch::patch_keychain_query_attributes_owned(extension).unwrap();
        write(
            &app.join("Contents/MacOS/CavalryLauncher"),
            RELEASED_MACOS_WRAPPER_V1,
        );
        write(
            &app.join("Contents/Frameworks/libCavalryTranslatorInjector.dylib"),
            injector,
        );
        write(
            &app.join("Contents/Frameworks/libExtensionLayer.dylib"),
            patched_extension,
        );
        write(
            &app.join("Contents/Resources/cavalry-i18n-lang.txt"),
            b"zh-Hans\n",
        );
        let app = fs::canonicalize(&app).unwrap();
        let immutable_revision = "macos-identity:managed-legacy-fixture";
        let legacy = State {
            app_path: app.to_string_lossy().to_string(),
            cavalry_version: crate::detect::SUPPORTED_CAVALRY_VERSION.to_string(),
            cavalry_revision: "bundle-version:2.7.2".to_string(),
            current_lang: "zh-Hans".to_string(),
            ..State::default()
        };
        assert!(macos_managed_snapshot_is_proven_with_identities(
            &repo.join("languages/en"),
            &state_dir,
            &legacy,
            &app,
            immutable_revision,
            &[injector_identity.as_str()],
        ));

        let capture = patch::migrate_legacy_english_generation_with_identity(
            &repo.join("languages/en"),
            &state_dir,
            &app,
            immutable_revision,
        )
        .unwrap();
        assert!(macos_managed_snapshot_is_proven_with_identities(
            &repo.join("languages/en"),
            &state_dir,
            &legacy,
            &app,
            immutable_revision,
            &[injector_identity.as_str()],
        ));
        let migrated = adopt_published_macos_snapshot_with_identities(
            &repo.join("languages/en"),
            &state_dir,
            legacy,
            &app,
            immutable_revision,
            &[injector_identity.as_str()],
        )
        .expect("a published generation must be adopted after an interrupted language write");
        let provenance = migrated.english_snapshot_provenance.as_ref().unwrap();
        assert_eq!(
            provenance.snapshot_generation.as_deref(),
            Some(capture.identity.generation.as_str())
        );
        assert_eq!(
            provenance.snapshot_manifest_sha256.as_deref(),
            Some(capture.identity.manifest_sha256.as_str())
        );
        assert!(macos_managed_snapshot_is_proven_with_identities(
            &repo.join("languages/en"),
            &state_dir,
            &migrated,
            &app,
            immutable_revision,
            &[injector_identity.as_str()],
        ));
        for target in ["zh-Hant", "en"] {
            let staging = state_dir.join(format!("plan-{target}"));
            let plan = crate::platform_runtime::prepare_apply(
                &repo,
                &repo,
                &app,
                target,
                crate::detect::SUPPORTED_CAVALRY_VERSION,
                &staging,
                None,
                None,
                true,
            )
            .unwrap();
            assert!(plan.runtime_pairs.is_empty());
            let marker = plan.final_language_marker.unwrap();
            assert_eq!(
                marker.dst,
                app.join("Contents/Resources/cavalry-i18n-lang.txt")
            );
            assert_eq!(
                fs::read_to_string(marker.src).unwrap(),
                format!("{target}\n")
            );
        }

        let snapshot = patch::english_snapshot_dir(&state_dir, &app, immutable_revision).unwrap();
        write(
            &snapshot.join(patch::CORE_MAP[0].0),
            br#"{"value":"tampered"}"#,
        );
        assert!(!macos_managed_snapshot_is_proven_with_identities(
            &repo.join("languages/en"),
            &state_dir,
            &migrated,
            &app,
            immutable_revision,
            &[injector_identity.as_str()],
        ));
    }
}

pub(crate) fn has_complete_snapshot_identity(provenance: &EnglishSnapshotProvenance) -> bool {
    provenance.snapshot_generation.is_some() && provenance.snapshot_manifest_sha256.is_some()
}

fn legacy_state_matches_install(
    current: &State,
    app_path: &Path,
    immutable_revision: &str,
) -> bool {
    let historical_bundle_revision = format!("bundle-version:{}", current.cavalry_version);
    let revision_matches = current.cavalry_revision == immutable_revision
        || (current.cavalry_version == crate::detect::SUPPORTED_CAVALRY_VERSION
            && current.cavalry_revision == historical_bundle_revision);
    if current.app_path != app_path.to_string_lossy().as_ref() || !revision_matches {
        return false;
    }
    let Some(provenance) = current.english_snapshot_provenance.as_ref() else {
        return true;
    };
    if has_complete_snapshot_identity(provenance) {
        return false;
    }
    let provenance_root = InstallLayout::from_selection(Path::new(&provenance.install_root))
        .map(|layout| layout.root)
        .unwrap_or_default();
    (provenance.install_root.is_empty() || provenance_root == app_path)
        && (provenance.immutable_revision.is_empty()
            || provenance.immutable_revision == immutable_revision
            || provenance.immutable_revision == historical_bundle_revision)
}

#[cfg(target_os = "macos")]
fn migrated_macos_snapshot_matches_install(
    english_source: &Path,
    state_dir: &Path,
    current: &State,
    app_path: &Path,
    immutable_revision: &str,
) -> bool {
    if current.cavalry_version != crate::detect::SUPPORTED_CAVALRY_VERSION
        || current.cavalry_revision != immutable_revision
        || current.app_path != app_path.to_string_lossy().as_ref()
    {
        return false;
    }
    let Some(provenance) = current.english_snapshot_provenance.as_ref() else {
        return false;
    };
    if !has_complete_snapshot_identity(provenance)
        || provenance.vendor_baseline_id.is_some()
        || provenance.immutable_revision != immutable_revision
    {
        return false;
    }
    let provenance_root = InstallLayout::from_selection(Path::new(&provenance.install_root))
        .map(|layout| layout.root)
        .unwrap_or_default();
    if provenance_root != app_path {
        return false;
    }
    let Ok(identity) = patch::english_snapshot_identity(state_dir, app_path, immutable_revision)
    else {
        return false;
    };
    if provenance.snapshot_generation.as_deref() != Some(identity.generation.as_str())
        || provenance.snapshot_manifest_sha256.as_deref() != Some(identity.manifest_sha256.as_str())
    {
        return false;
    }
    matches!(
        patch::snapshot_matches_language_source(english_source, state_dir, app_path),
        Ok(true)
    )
}

#[cfg(target_os = "macos")]
fn published_macos_snapshot_matches_legacy_state(
    english_source: &Path,
    state_dir: &Path,
    current: &State,
    app_path: &Path,
    immutable_revision: &str,
) -> bool {
    if !legacy_state_matches_install(current, app_path, immutable_revision) {
        return false;
    }
    if patch::english_snapshot_identity(state_dir, app_path, immutable_revision).is_err() {
        return false;
    }
    matches!(
        patch::snapshot_matches_language_source(english_source, state_dir, app_path),
        Ok(true)
    )
}

#[cfg(target_os = "macos")]
fn adopt_published_macos_snapshot_with_identities(
    english_source: &Path,
    state_dir: &Path,
    current: State,
    app_path: &Path,
    immutable_revision: &str,
    released_injector_identities: &[&str],
) -> Option<State> {
    if current
        .english_snapshot_provenance
        .as_ref()
        .is_some_and(has_complete_snapshot_identity)
        || !published_macos_snapshot_matches_legacy_state(
            english_source,
            state_dir,
            &current,
            app_path,
            immutable_revision,
        )
    {
        return None;
    }
    let identity =
        patch::english_snapshot_identity(state_dir, app_path, immutable_revision).ok()?;
    let candidate = State {
        app_path: app_path.to_string_lossy().to_string(),
        cavalry_revision: immutable_revision.to_string(),
        english_snapshot_provenance: Some(EnglishSnapshotProvenance {
            install_root: app_path.to_string_lossy().to_string(),
            immutable_revision: immutable_revision.to_string(),
            snapshot_generation: Some(identity.generation),
            snapshot_manifest_sha256: Some(identity.manifest_sha256),
            vendor_baseline_id: None,
        }),
        ..current
    };
    macos_managed_snapshot_is_proven_with_identities(
        english_source,
        state_dir,
        &candidate,
        app_path,
        immutable_revision,
        released_injector_identities,
    )
    .then_some(candidate)
}

#[cfg(target_os = "macos")]
#[allow(clippy::too_many_arguments)]
fn macos_managed_snapshot_proof_diagnostics_with_identities(
    english_source: &Path,
    state_dir: &Path,
    current: &State,
    app_path: &Path,
    immutable_revision: &str,
    released_injector_identities: &[&str],
) -> MacosManagedLegacyProofDiagnostics {
    let (snapshot_is_proven, snapshot_reason) = if current
        .english_snapshot_provenance
        .as_ref()
        .is_some_and(has_complete_snapshot_identity)
    {
        let proven = migrated_macos_snapshot_matches_install(
            english_source,
            state_dir,
            current,
            app_path,
            immutable_revision,
        );
        (
            proven,
            if proven {
                "provenGeneration"
            } else {
                "generationMismatch"
            },
        )
    } else if patch::english_snapshot_identity(state_dir, app_path, immutable_revision).is_ok() {
        let proven = published_macos_snapshot_matches_legacy_state(
            english_source,
            state_dir,
            current,
            app_path,
            immutable_revision,
        );
        (
            proven,
            if proven {
                "provenPublishedGeneration"
            } else {
                "publishedGenerationMismatch"
            },
        )
    } else {
        let state_matches = legacy_state_matches_install(current, app_path, immutable_revision);
        let snapshot_matches = matches!(
            patch::legacy_snapshot_matches_language_source(english_source, state_dir, app_path,),
            Ok(true)
        );
        let reason = if !state_matches {
            "legacyStateMismatch"
        } else if !snapshot_matches {
            "legacySnapshotMismatch"
        } else {
            "provenLegacySnapshot"
        };
        (state_matches && snapshot_matches, reason)
    };
    let runtime_reason = macos_managed_legacy_runtime_reason_with_identities(
        current,
        app_path,
        released_injector_identities,
    );
    let runtime_proven = runtime_reason == "proven";
    MacosManagedLegacyProofDiagnostics {
        proven: snapshot_is_proven && runtime_proven,
        snapshot_proven: snapshot_is_proven,
        runtime_proven,
        snapshot_reason,
        runtime_reason,
    }
}

#[cfg(target_os = "macos")]
#[allow(clippy::too_many_arguments)]
fn macos_managed_snapshot_is_proven_with_identities(
    english_source: &Path,
    state_dir: &Path,
    current: &State,
    app_path: &Path,
    immutable_revision: &str,
    released_injector_identities: &[&str],
) -> bool {
    macos_managed_snapshot_proof_diagnostics_with_identities(
        english_source,
        state_dir,
        current,
        app_path,
        immutable_revision,
        released_injector_identities,
    )
    .proven
}

/// Read-only proof used by status projection. It accepts only a legacy state/snapshot that still
/// names this exact install and revision, matches the packaged English keyed overlay, and has a
/// hash-locked Windows runtime: Active/Recover retain the durable vendor backup, while Stock
/// must yield a CleanupOnly restore plan proving vendor qwindows and packaged generic ownership.
/// No generation or state file is published here; apply owns that mutation.
#[allow(clippy::too_many_arguments)]
pub(crate) fn legacy_snapshot_is_proven(
    repo_root: &Path,
    state_dir: &Path,
    resource_dir: &Path,
    current: &State,
    app_path: &Path,
    immutable_revision: &str,
) -> bool {
    legacy_snapshot_is_proven_with_runtime_check(
        repo_root,
        state_dir,
        resource_dir,
        current,
        app_path,
        immutable_revision,
        |app_path| {
            #[cfg(target_os = "windows")]
            {
                let Ok(layout) = InstallLayout::from_selection(app_path) else {
                    return false;
                };
                if layout.platform != InstallPlatform::Windows {
                    return false;
                }
                let Ok(inspection) = crate::windows_qpa::inspect(&layout) else {
                    return false;
                };
                let stock_cleanup_is_proven = inspection.state
                    == crate::windows_qpa::QpaDeploymentState::Stock
                    && stock_cleanup_plan_is_proven(repo_root, resource_dir, &layout);
                return qpa_inspection_proves_runtime(&inspection, stock_cleanup_is_proven);
            }
            #[cfg(not(target_os = "windows"))]
            {
                let _ = app_path;
                true
            }
        },
    )
}

fn legacy_snapshot_is_proven_with_runtime_check<F>(
    repo_root: &Path,
    state_dir: &Path,
    resource_dir: &Path,
    current: &State,
    app_path: &Path,
    immutable_revision: &str,
    runtime_is_proven: F,
) -> bool
where
    F: Fn(&Path) -> bool,
{
    if app_path.as_os_str().is_empty() || immutable_revision.is_empty() {
        return false;
    }
    let english_source = language_source_dir(repo_root, resource_dir, "en");
    #[cfg(target_os = "macos")]
    if InstallLayout::from_root(app_path).platform == InstallPlatform::Macos {
        return macos_managed_snapshot_is_proven_with_identities(
            &english_source,
            state_dir,
            current,
            app_path,
            immutable_revision,
            &RELEASED_MACOS_INJECTOR_CODE_IDENTITIES,
        );
    }
    if !legacy_state_matches_install(current, app_path, immutable_revision) {
        return false;
    }
    if !matches!(
        patch::legacy_snapshot_matches_language_source(&english_source, state_dir, app_path),
        Ok(true)
    ) {
        return false;
    }
    runtime_is_proven(app_path)
}

#[cfg(target_os = "windows")]
fn stock_cleanup_plan_is_proven(
    repo_root: &Path,
    resource_dir: &Path,
    layout: &InstallLayout,
) -> bool {
    let Ok(proxy_source) =
        crate::windows_runtime::resolve_qpa_proxy_source(resource_dir, repo_root)
    else {
        return false;
    };
    let Ok(generic_source) = crate::windows_runtime::resolve_plugin_source(resource_dir, repo_root)
    else {
        return false;
    };
    matches!(
        crate::windows_qpa::build_restore_plan(crate::windows_qpa::RestoreRequest {
            layout,
            proxy_source: &proxy_source,
            generic_source: &generic_source,
            reason: crate::windows_qpa::RestoreReason::EnglishSelection,
        }),
        Ok(crate::windows_qpa::PreparedRestore::Execute(plan))
            if plan.action == crate::windows_qpa::RestoreAction::CleanupOnly
    )
}

#[cfg(target_os = "windows")]
fn qpa_inspection_proves_runtime(
    inspection: &crate::windows_qpa::QpaInspection,
    stock_cleanup_is_proven: bool,
) -> bool {
    match inspection.state {
        crate::windows_qpa::QpaDeploymentState::Stock => {
            stock_cleanup_is_proven
                && inspection.current_qwindows_sha256.as_deref()
                    == Some(crate::windows_qpa::VENDOR_QWINDOWS_SHA256)
        }
        crate::windows_qpa::QpaDeploymentState::Active => true,
        crate::windows_qpa::QpaDeploymentState::Recover => inspection.phase.is_some(),
        crate::windows_qpa::QpaDeploymentState::Drifted => false,
    }
}

#[cfg(all(test, target_os = "windows"))]
pub(crate) fn legacy_snapshot_is_proven_with_qpa_inspector<F>(
    repo_root: &Path,
    state_dir: &Path,
    resource_dir: &Path,
    current: &State,
    app_path: &Path,
    immutable_revision: &str,
    inspect_qpa: F,
    stock_cleanup_is_proven: bool,
) -> bool
where
    F: Fn(&InstallLayout) -> Result<crate::windows_qpa::QpaInspection, String>,
{
    legacy_snapshot_is_proven_with_runtime_check(
        repo_root,
        state_dir,
        resource_dir,
        current,
        app_path,
        immutable_revision,
        |app_path| {
            let Ok(layout) = InstallLayout::from_selection(app_path) else {
                return false;
            };
            inspect_qpa(&layout).ok().is_some_and(|inspection| {
                qpa_inspection_proves_runtime(&inspection, stock_cleanup_is_proven)
            })
        },
    )
}

/// Apply-only compatibility migration. The immutable generation is published first and the
/// returned provenance is committed by the surrounding ordinary language transaction; status
/// and refresh therefore remain read-only with respect to this legacy path.
#[allow(clippy::too_many_arguments)]
pub(crate) fn migrate_legacy_snapshot_if_proven(
    repo_root: &Path,
    state_dir: &Path,
    resource_dir: &Path,
    current: State,
    app_path: &Path,
    immutable_revision: &str,
) -> Result<State, String> {
    let english_source = language_source_dir(repo_root, resource_dir, "en");
    #[cfg(target_os = "macos")]
    if InstallLayout::from_root(app_path).platform == InstallPlatform::Macos {
        if let Some(adopted) = adopt_published_macos_snapshot_with_identities(
            &english_source,
            state_dir,
            current.clone(),
            app_path,
            immutable_revision,
            &RELEASED_MACOS_INJECTOR_CODE_IDENTITIES,
        ) {
            return Ok(adopted);
        }
    }
    if !legacy_snapshot_is_proven(
        repo_root,
        state_dir,
        resource_dir,
        &current,
        app_path,
        immutable_revision,
    ) {
        return Ok(current);
    }
    if current
        .english_snapshot_provenance
        .as_ref()
        .is_some_and(has_complete_snapshot_identity)
    {
        return Ok(current);
    }
    let capture = patch::migrate_legacy_english_generation_with_identity(
        &english_source,
        state_dir,
        app_path,
        immutable_revision,
    )?;
    Ok(State {
        app_path: app_path.to_string_lossy().to_string(),
        cavalry_revision: immutable_revision.to_string(),
        english_snapshot_provenance: Some(EnglishSnapshotProvenance {
            install_root: app_path.to_string_lossy().to_string(),
            immutable_revision: immutable_revision.to_string(),
            snapshot_generation: Some(capture.identity.generation),
            snapshot_manifest_sha256: Some(capture.identity.manifest_sha256),
            vendor_baseline_id: None,
        }),
        ..current
    })
}
