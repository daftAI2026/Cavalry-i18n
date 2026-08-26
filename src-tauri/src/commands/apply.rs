/**
 * [INPUT]: 依赖 snapshot/status、English-baseline JSON overlay、Program Files typed parent transaction、platform_runtime direct preflight、privilege copy completion 与 Unix PermissionsExt 模式比较。
 * [OUTPUT]: 提供 apply_language_inner、仅对无 pending journal 的精确 Clean English 允许的 no-op、长度/只读位/Unix mode/内容感知的增量 pair 筛选、Windows 四语言 canonical pretty overlay/单次 UAC/typed cleanup warning 与全安装根 Cavalry-still-running error code、自定义根 fallback，以及 macOS English UI/官方还原、首装 launcher gate、全量 JSON observe-only postcondition、durable transaction、签名和 Gatekeeper 提交门。
 * [POS]: commands 的语言写入编排；Windows 为 source provenance 统一规范化 English/翻译 payload，macOS 把 files_match 未改资产仍绑定到同一认证 generation，并在 state/transaction 提交前完成 runtime、签名与 quarantine，任一失败均回滚精确 bundle/state preimage。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
use chrono::Utc;
#[cfg(target_os = "macos")]
use std::collections::HashSet;
#[cfg(unix)]
use std::os::unix::fs::PermissionsExt;
use std::{
    fs,
    path::{Path, PathBuf},
};

use crate::{
    detect,
    install::InstallLayout,
    patch, platform_runtime,
    privilege::{self, CommandRunner, PostCommitWarning, PostCommitWarningCode},
    state::{self, State},
};

use super::{
    context::{language_source_dir, next_staging_nonce, RESTORE_OFFICIAL_ACTION},
    contract::{renderer_warning_for_copy, ActionPayload, CAVALRY_STILL_RUNNING_ERROR_CODE},
    snapshot::{extract_english_snapshot_or_throw, CleanEnglishDisposition},
    status::{project_state_with_bundle, read_state_for_mutation},
};

enum CleanEnglishFastPath {
    Noop,
    Continue(State),
}

#[cfg(target_os = "macos")]
fn verify_macos_prewrite_trust(
    repo_root: &Path,
    state_dir: &Path,
    resource_dir: &Path,
    app_path: &Path,
    immutable_revision: &str,
    previous_state: &State,
    signature: &privilege::BundleSignatureEvidence,
) -> Result<(), String> {
    if crate::mac_official::verify_clean_vendor_runtime(app_path).is_ok() {
        return signature
            .is_supported_cavalry_vendor_identity()
            .then_some(())
            .ok_or_else(|| {
                "Selected Cavalry has a clean-looking runtime but its Team ID or designated requirement is not the supported vendor identity; no files were written."
                    .to_string()
            });
    }
    if !signature.is_managed_ad_hoc_identity() {
        return Err(
            "Modified Cavalry is not signed with the expected managed ad-hoc identity; no files were written. Reinstall Cavalry before retrying."
                .to_string(),
        );
    }
    let provenance = previous_state
        .english_snapshot_provenance
        .as_ref()
        .ok_or_else(|| {
            "Modified Cavalry has no complete official preimage provenance. Reinstall Cavalry before retrying."
                .to_string()
        })?;
    if Path::new(&previous_state.app_path) != app_path
        || Path::new(&provenance.install_root) != app_path
        || previous_state.cavalry_revision != immutable_revision
        || provenance.immutable_revision != immutable_revision
    {
        return Err(
            "Modified Cavalry state/provenance does not match the selected immutable installation identity; no files were written. Reinstall Cavalry before retrying."
            .to_string(),
        );
    }
    if provenance.snapshot_generation.is_none()
        || provenance.snapshot_manifest_sha256.is_none()
        || provenance.vendor_baseline_id.is_none()
    {
        return Err(
            "Modified Cavalry's durable state is not bound to one complete unified vendor generation; no files were written."
                .to_string(),
        );
    }
    let baseline = crate::mac_official::load_vendor_baseline(
        state_dir,
        app_path,
        immutable_revision,
        provenance,
    )?;
    let injector = crate::mac_runtime::injector_source_path(repo_root, resource_dir)?;
    baseline.verify_managed_runtime(app_path, &injector)
}

fn prepare_clean_english_fast_path<C, I>(
    current_state: State,
    needs_snapshot: bool,
    has_pending_transaction: bool,
    capture_snapshot: C,
    inspect_clean_english: I,
) -> Result<CleanEnglishFastPath, String>
where
    C: FnOnce(State) -> Result<State, String>,
    I: FnOnce() -> Result<CleanEnglishDisposition, String>,
{
    if has_pending_transaction {
        return Ok(CleanEnglishFastPath::Continue(current_state));
    }
    let current_state = if needs_snapshot {
        capture_snapshot(current_state)?
    } else {
        current_state
    };
    if matches!(inspect_clean_english(), Ok(CleanEnglishDisposition::Clean)) {
        Ok(CleanEnglishFastPath::Noop)
    } else {
        Ok(CleanEnglishFastPath::Continue(current_state))
    }
}

fn unique_staging_root() -> PathBuf {
    std::env::temp_dir().join(format!(
        "cavalry-i18n-tauri-staging-{}-{}-{}",
        std::process::id(),
        Utc::now().timestamp_millis(),
        next_staging_nonce()
    ))
}

fn files_match(source: &Path, destination: &Path) -> bool {
    let (Ok(source_meta), Ok(destination_meta)) = (fs::metadata(source), fs::metadata(destination))
    else {
        return false;
    };
    if source_meta.len() != destination_meta.len()
        || source_meta.permissions().readonly() != destination_meta.permissions().readonly()
    {
        return false;
    }
    #[cfg(unix)]
    if source_meta.permissions().mode() & 0o777 != destination_meta.permissions().mode() & 0o777 {
        return false;
    }

    match (fs::read(source), fs::read(destination)) {
        (Ok(source_bytes), Ok(destination_bytes)) => source_bytes == destination_bytes,
        _ => false,
    }
}

#[cfg(target_os = "macos")]
fn partition_macos_launch_gate_pairs(
    app_path: &Path,
    staged_pairs: &[patch::CopyPair],
) -> (Vec<patch::CopyPair>, Vec<patch::CopyPair>) {
    let wrapper = app_path.join("Contents/MacOS/CavalryLauncher");
    let info = app_path.join("Contents/Info.plist");
    let mut launch_gate = Vec::with_capacity(2);
    if let Some(pair) = staged_pairs.iter().find(|pair| pair.dst == wrapper) {
        launch_gate.push(pair.clone());
    }
    if let Some(pair) = staged_pairs.iter().find(|pair| pair.dst == info) {
        launch_gate.push(pair.clone());
    }
    let payload = staged_pairs
        .iter()
        .filter(|pair| pair.dst != wrapper && pair.dst != info)
        .cloned()
        .collect();
    (launch_gate, payload)
}

fn build_pending_language_marker_pair(
    layout: &InstallLayout,
    staging_dir: &Path,
) -> Result<patch::CopyPair, String> {
    fs::create_dir_all(staging_dir).map_err(|error| {
        format!(
            "Could not create pending language marker staging directory {}: {error}",
            staging_dir.display()
        )
    })?;
    let source = staging_dir.join("pending-language-marker.txt");
    fs::write(&source, "pending\n").map_err(|error| {
        format!(
            "Could not stage pending language marker {}: {error}",
            source.display()
        )
    })?;
    Ok(patch::CopyPair {
        src: source,
        dst: layout.language_marker.clone(),
    })
}

#[cfg_attr(target_os = "macos", allow(dead_code))]
pub(crate) fn marker_guarded_transaction_pairs(
    layout: &InstallLayout,
    staging_dir: &Path,
    changed_pairs: Vec<patch::CopyPair>,
    final_marker: Option<&patch::CopyPair>,
    defer_final_marker: bool,
) -> Result<Vec<patch::CopyPair>, String> {
    let Some(final_marker) = final_marker else {
        return Ok(changed_pairs);
    };
    let mut transaction = Vec::with_capacity(changed_pairs.len() + 2);
    transaction.push(build_pending_language_marker_pair(layout, staging_dir)?);
    transaction.extend(changed_pairs);
    if !defer_final_marker {
        transaction.push(final_marker.clone());
    }
    Ok(transaction)
}

pub fn apply_language_inner<R: CommandRunner>(
    repo_root: &Path,
    state_dir: &Path,
    resource_dir: &Path,
    app_path: &Path,
    lang: &str,
    runner: &mut R,
    now: &str,
) -> Result<ActionPayload, String> {
    #[cfg(target_os = "macos")]
    privilege::recover_macos_apply_for_selection(state_dir, app_path, runner)?;
    let verified_layout =
        detect::resolve_verified_install(app_path).map_err(|error| error.to_string())?;
    let app_platform = verified_layout.platform;
    let app_path = verified_layout.root;
    if !matches!(
        lang,
        "en" | "zh-Hans" | "zh-Hant" | "ja_JP" | RESTORE_OFFICIAL_ACTION
    ) {
        return Err(format!("Unsupported language: {lang}"));
    }
    let restore_official = lang == RESTORE_OFFICIAL_ACTION;
    if restore_official && app_platform != crate::install::InstallPlatform::Macos {
        return Err(
            "Official Cavalry restore is currently available only for macOS bundles.".to_string(),
        );
    }
    let effective_lang = if restore_official { "en" } else { lang };

    let version = detect::read_bundle_version(&app_path).unwrap_or_default();
    #[cfg(target_os = "macos")]
    let prewrite_identity = (app_platform == crate::install::InstallPlatform::Macos)
        .then(|| detect::require_supported_mac_identity(&app_path))
        .transpose()
        .map_err(|error| error.to_string())?;
    #[cfg(target_os = "macos")]
    let prewrite_signature = if app_platform == crate::install::InstallPlatform::Macos {
        Some(privilege::inspect_bundle_signature(&app_path, runner)?)
    } else {
        None
    };
    let immutable_revision =
        detect::read_bundle_revision_for_write(&app_path).map_err(|error| error.to_string())?;
    let previous_state = read_state_for_mutation(state_dir)?;
    #[cfg(target_os = "macos")]
    if let Some(prewrite_signature) = prewrite_signature.as_ref() {
        verify_macos_prewrite_trust(
            repo_root,
            state_dir,
            resource_dir,
            &app_path,
            &immutable_revision,
            &previous_state,
            prewrite_signature,
        )?;
    }
    let mut current_state = project_state_with_bundle(
        state_dir,
        previous_state.clone(),
        &app_path,
        &version,
        &immutable_revision,
    );
    current_state = super::snapshot::project_legacy_snapshot_provenance(
        repo_root,
        state_dir,
        resource_dir,
        &previous_state,
        current_state,
        &app_path,
        &version,
        &immutable_revision,
    );

    if lang == "en"
        && current_state.current_lang == "en"
        && platform_runtime::english_runtime_is_stock(&app_path)
    {
        #[cfg(target_os = "windows")]
        let has_pending_transaction =
            privilege::has_pending_windows_language_transaction(&app_path)?;
        #[cfg(not(target_os = "windows"))]
        let has_pending_transaction = false;
        let needs_snapshot = super::snapshot::needs_english_snapshot(
            state_dir,
            current_state.english_snapshot_provenance.as_ref(),
            &app_path,
            &immutable_revision,
        );
        match prepare_clean_english_fast_path(
            current_state,
            needs_snapshot,
            has_pending_transaction,
            |state| {
                extract_english_snapshot_or_throw(
                    repo_root,
                    state_dir,
                    resource_dir,
                    state,
                    &app_path,
                    &immutable_revision,
                    runner,
                )
            },
            || super::snapshot::ensure_clean_english_install(repo_root, resource_dir, &app_path),
        )? {
            CleanEnglishFastPath::Noop => {
                return Ok(ActionPayload::ok_lang("en", None));
            }
            CleanEnglishFastPath::Continue(state) => current_state = state,
        }
    }

    if effective_lang != "en" {
        current_state = extract_english_snapshot_or_throw(
            repo_root,
            state_dir,
            resource_dir,
            current_state,
            &app_path,
            &immutable_revision,
            runner,
        )?;
    } else if super::snapshot::needs_english_snapshot(
        state_dir,
        current_state.english_snapshot_provenance.as_ref(),
        &app_path,
        &immutable_revision,
    ) {
        return Err(
            "English snapshot is missing or stale for this Cavalry revision. Restore a clean English install and refresh English before applying it."
                .to_string(),
        );
    }

    #[cfg(target_os = "macos")]
    let mac_baseline = if app_platform == crate::install::InstallPlatform::Macos {
        let provenance = current_state
            .english_snapshot_provenance
            .as_ref()
            .ok_or_else(|| {
                "macOS apply requires a unified vendor/English baseline provenance.".to_string()
            })?;
        Some(crate::mac_official::load_vendor_baseline(
            state_dir,
            &app_path,
            &immutable_revision,
            provenance,
        )?)
    } else {
        None
    };
    #[cfg(target_os = "macos")]
    let english_snapshot_dir = if let Some(baseline) = mac_baseline.as_ref() {
        baseline.english_dir().to_path_buf()
    } else {
        patch::english_snapshot_dir(state_dir, &app_path, &immutable_revision)?
    };
    #[cfg(not(target_os = "macos"))]
    let english_snapshot_dir =
        patch::english_snapshot_dir(state_dir, &app_path, &immutable_revision)?;
    let source_dir = if effective_lang == "en" {
        english_snapshot_dir.clone()
    } else {
        language_source_dir(repo_root, resource_dir, effective_lang)
    };
    if !source_dir.exists() {
        return if effective_lang == "en" {
            Err("English snapshot not found. Point the app picker to a clean Cavalry.app and refresh English first.".to_string())
        } else {
            Err(format!("Language files not found for {effective_lang}."))
        };
    }

    let current_language_source = (current_state.current_lang != "en")
        .then(|| language_source_dir(repo_root, resource_dir, current_state.current_lang.as_str()));
    #[cfg(target_os = "macos")]
    let mac_asset_preimages = {
        let baseline = mac_baseline.as_ref().ok_or_else(|| {
            "macOS asset verification lost its verified unified vendor generation.".to_string()
        })?;
        patch::verify_installed_asset_preimages_at_exact(
            baseline.english_dir(),
            &app_path,
            current_language_source.as_deref(),
            baseline.english_manifest_sha256(),
        )?
    };
    #[cfg(not(target_os = "macos"))]
    patch::verify_installed_asset_preimages(
        state_dir,
        &app_path,
        &immutable_revision,
        current_language_source.as_deref(),
    )?;

    let staging_root = unique_staging_root();
    #[cfg(target_os = "macos")]
    let pairs = {
        let baseline = mac_baseline.as_ref().ok_or_else(|| {
            "macOS JSON apply lost its verified unified vendor generation.".to_string()
        })?;
        if effective_lang == "en" {
            patch::build_mac_english_restore_pairs(
                &english_snapshot_dir,
                &app_path,
                &staging_root.join("english-restore"),
                baseline.english_manifest_sha256(),
            )?
        } else {
            patch::build_mac_overlay_pairs_exact(
                &source_dir,
                &english_snapshot_dir,
                &app_path,
                &staging_root.join("overlay"),
                baseline.english_manifest_sha256(),
            )?
        }
    };
    #[cfg(target_os = "windows")]
    let pairs = patch::build_overlay_pairs(
        &source_dir,
        &english_snapshot_dir,
        &app_path,
        &staging_root.join("overlay"),
    )?;
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    let pairs = if effective_lang == "en" {
        patch::build_copy_pairs_checked(&source_dir, &app_path)?
    } else {
        patch::build_overlay_pairs(
            &source_dir,
            &english_snapshot_dir,
            &app_path,
            &staging_root.join("overlay"),
        )?
    };
    if pairs.is_empty() {
        return Err(format!("No JSON assets found for {effective_lang}."));
    }

    #[cfg(target_os = "windows")]
    {
        let layout = InstallLayout::from_root(&app_path);
        let program_files_result =
            privilege::apply_windows_program_files_language(privilege::ParentApplyRequest {
                repo_root,
                resource_dir,
                state_dir,
                layout: &layout,
                language: effective_lang,
                cavalry_version: &version,
                staging_root: &staging_root,
                overlay_pairs: &pairs,
            });
        if let Some(payload) = finish_program_files_result(
            program_files_result,
            state_dir,
            &current_state,
            &app_path,
            &version,
            &immutable_revision,
            effective_lang,
            now,
        )? {
            return Ok(payload);
        }
    }

    #[cfg(target_os = "macos")]
    let trusted_macos_info_plist = mac_baseline
        .as_ref()
        .map(|baseline| baseline.official_info_plist_path())
        .transpose()?;
    #[cfg(target_os = "macos")]
    let trusted_macos_info_mode = mac_baseline
        .as_ref()
        .map(|baseline| baseline.official_info_plist_mode())
        .transpose()?;
    #[cfg(not(target_os = "macos"))]
    let trusted_macos_info_plist: Option<PathBuf> = None;
    #[cfg(not(target_os = "macos"))]
    let trusted_macos_info_mode: Option<u32> = None;
    let plan = platform_runtime::prepare_apply(
        repo_root,
        resource_dir,
        &app_path,
        lang,
        &version,
        &staging_root,
        trusted_macos_info_plist.as_deref(),
        trusted_macos_info_mode,
    )?;
    if let Some(payload) =
        finish_direct_preflight_result(platform_runtime::preflight_apply(&app_path, lang, runner))?
    {
        return Ok(payload);
    }
    let mut pairs = pairs;
    pairs.extend(plan.runtime_pairs.iter().cloned());
    #[cfg(target_os = "macos")]
    let (macos_deferred_removals, macos_deferred_info) = if restore_official {
        let baseline = mac_baseline
            .as_ref()
            .ok_or_else(|| {
                "Official restore requires a combined vendor runtime/English baseline. Refresh English from a clean vendor install first."
                    .to_string()
            })?;
        let mut restore =
            baseline.build_restore_plan(&app_path, &staging_root.join("official-restore"))?;
        let official_info_destination = app_path.join("Contents/Info.plist");
        let official_info_index = restore
            .pairs
            .iter()
            .position(|pair| pair.dst == official_info_destination)
            .ok_or_else(|| {
                "Official restore plan has no commit-gated vendor Info.plist.".to_string()
            })?;
        let official_info = restore.pairs.remove(official_info_index);
        pairs.extend(restore.pairs);
        (restore.removals, Some(official_info))
    } else {
        (Vec::new(), None)
    };
    #[cfg(not(target_os = "macos"))]
    let layout = InstallLayout::from_root(&app_path);
    let changed_pairs = pairs
        .iter()
        .filter(|pair| !files_match(&pair.src, &pair.dst))
        .cloned()
        .collect::<Vec<_>>();
    #[cfg(target_os = "macos")]
    let transaction_pairs = {
        // The final marker is journaled below but intentionally excluded from the payload phase.
        // It is atomically published only after nested code is signed and immediately before the
        // final app seal; durable state remains the transaction commit bit.
        changed_pairs
    };
    #[cfg(not(target_os = "macos"))]
    let transaction_pairs = marker_guarded_transaction_pairs(
        &layout,
        &staging_root.join("pending-marker"),
        changed_pairs,
        plan.final_language_marker.as_ref(),
        plan.defer_final_language_marker,
    )?;
    // final marker 必须强制写入，不能因开始前内容相同而被 files_match 过滤。
    let staged_pairs = patch::stage_files(&transaction_pairs, &staging_root.join("staged"))
        .map_err(|error| format!("Could not stage patch files: {error}"))?;
    #[cfg(target_os = "macos")]
    let staged_final_marker = plan
        .final_language_marker
        .as_ref()
        .map(|marker| {
            patch::stage_files(
                std::slice::from_ref(marker),
                &staging_root.join("staged-final-marker"),
            )
            .and_then(|mut pairs| {
                pairs
                    .pop()
                    .ok_or_else(|| "Final macOS language marker did not stage.".to_string())
            })
        })
        .transpose()
        .map_err(|error| format!("Could not stage final macOS language marker: {error}"))?;
    #[cfg(target_os = "macos")]
    let staged_official_info = macos_deferred_info
        .as_ref()
        .map(|info| {
            patch::stage_files(
                std::slice::from_ref(info),
                &staging_root.join("staged-official-info"),
            )
            .and_then(|mut pairs| {
                pairs
                    .pop()
                    .ok_or_else(|| "Official Info.plist did not stage.".to_string())
            })
        })
        .transpose()
        .map_err(|error| format!("Could not stage official Info.plist: {error}"))?;
    #[cfg(target_os = "macos")]
    let staged_pending_marker = if staged_final_marker.is_some() {
        let pending = build_pending_language_marker_pair(
            &InstallLayout::from_root(&app_path),
            &staging_root.join("pending-marker"),
        )?;
        Some(
            patch::stage_files(
                std::slice::from_ref(&pending),
                &staging_root.join("staged-pending-marker"),
            )
            .map_err(|error| format!("Could not stage pending macOS marker: {error}"))?
            .pop()
            .ok_or_else(|| "Pending macOS language marker did not stage.".to_string())?,
        )
    } else {
        None
    };

    #[cfg(target_os = "macos")]
    {
        if let Some(prewrite_identity) = prewrite_identity.as_ref() {
            detect::verify_mac_bundle_identity(&app_path, prewrite_identity)
                .map_err(|error| format!("Cavalry changed during apply preflight: {error}"))?;
        }
        if let Some(prewrite_signature) = prewrite_signature.as_ref() {
            let current_signature = privilege::inspect_bundle_signature(&app_path, runner)?;
            if &current_signature != prewrite_signature {
                return Err(
                    "Cavalry signature identity changed during apply preflight; no files were written."
                        .to_string(),
                );
            }
        }
        return finish_macos_apply_transaction(
            state_dir,
            current_state,
            &app_path,
            version,
            immutable_revision,
            lang,
            effective_lang,
            now,
            &staging_root,
            &plan,
            &staged_pairs,
            staged_pending_marker.as_ref(),
            staged_final_marker.as_ref(),
            staged_official_info.as_ref(),
            &macos_deferred_removals,
            &mac_asset_preimages,
            mac_baseline.as_ref(),
            runner,
        );
    }

    #[cfg(not(target_os = "macos"))]
    let copy_mode = (|| {
        let mut completion = privilege::copy_with_privilege_detailed(&staged_pairs, runner)
            .map_err(|error| {
                format!(
                    "Could not copy patch files into Cavalry: {}",
                    error.display()
                )
            })?;
        platform_runtime::after_copy(&plan, &app_path, lang, &staging_root, &staged_pairs, runner)?;
        if plan.defer_final_language_marker {
            if let Some(final_marker) = plan.final_language_marker.as_ref() {
                let staged_final = patch::stage_files(
                    std::slice::from_ref(final_marker),
                    &staging_root.join("staged-final-marker"),
                )
                .map_err(|error| format!("Could not stage final language marker: {error}"))?;
                let final_completion =
                    privilege::copy_with_privilege_detailed(&staged_final, runner).map_err(
                        |error| {
                            format!(
                        "Could not commit final language marker after Windows QPA transition: {}",
                        error.display()
                    )
                        },
                    )?;
                if completion.mode == "noop" {
                    completion.mode = final_completion.mode;
                }
                completion.warnings.extend(final_completion.warnings);
            }
        }
        Ok::<_, String>(completion)
    })();

    #[cfg(not(target_os = "macos"))]
    let staging_cleanup = fs::remove_dir_all(&staging_root);
    #[cfg(not(target_os = "macos"))]
    let mut copy_completion = match copy_mode {
        Ok(completion) => completion,
        Err(error) => {
            return match staging_cleanup {
                Ok(()) => Err(error),
                Err(cleanup_error) => Err(format!(
                    "{error} Cleanup residual remains at {}: {cleanup_error}",
                    staging_root.display()
                )),
            };
        }
    };
    #[cfg(not(target_os = "macos"))]
    if let Err(error) = staging_cleanup {
        copy_completion.warnings.push(PostCommitWarning::new(
            PostCommitWarningCode::StagingCleanup,
            [staging_root],
            Some(error.to_string()),
        ));
    }

    #[cfg(not(target_os = "macos"))]
    finish_apply_state(
        state_dir,
        current_state,
        &app_path,
        version,
        immutable_revision,
        effective_lang,
        now,
        renderer_warning_for_copy(&copy_completion.warnings, &copy_completion.mode),
    )
}

#[cfg(target_os = "macos")]
#[allow(clippy::too_many_arguments)]
fn finish_macos_apply_transaction<R: CommandRunner>(
    state_dir: &Path,
    current_state: State,
    app_path: &Path,
    version: String,
    immutable_revision: String,
    action_lang: &str,
    effective_lang: &str,
    now: &str,
    staging_root: &Path,
    plan: &platform_runtime::ApplyPlan,
    staged_pairs: &[patch::CopyPair],
    staged_pending_marker: Option<&patch::CopyPair>,
    staged_final_marker: Option<&patch::CopyPair>,
    staged_official_info: Option<&patch::CopyPair>,
    deferred_removals: &[PathBuf],
    asset_preimages: &[patch::AssetPreimageEvidence],
    mac_baseline: Option<&crate::mac_official::VerifiedVendorBaseline>,
    runner: &mut R,
) -> Result<ActionPayload, String> {
    let signing_side_effects = if action_lang == RESTORE_OFFICIAL_ACTION {
        Vec::new()
    } else {
        vec![
            app_path.join("Contents/_CodeSignature/CodeResources"),
            app_path.join("Contents/MacOS/Cavalry"),
            app_path.join("Contents/MacOS/CavalryLauncher"),
            app_path.join("Contents/Frameworks/libCavalryTranslatorInjector.dylib"),
            app_path.join("Contents/Frameworks/libExtensionLayer.dylib"),
        ]
    };
    let deferred_pairs = [staged_final_marker, staged_official_info]
        .into_iter()
        .flatten()
        .cloned()
        .collect::<Vec<_>>();
    let intermediate_pairs = staged_pending_marker
        .map(std::slice::from_ref)
        .unwrap_or_default();
    let (launch_gate_pairs, payload_pairs) =
        partition_macos_launch_gate_pairs(app_path, staged_pairs);
    let planned_destinations = intermediate_pairs
        .iter()
        .chain(staged_pairs)
        .chain(&deferred_pairs)
        .map(|pair| pair.dst.clone())
        .chain(deferred_removals.iter().cloned())
        .chain(signing_side_effects.iter().cloned())
        .collect::<HashSet<_>>();
    let asset_root = app_path.join("Contents/assets");
    for destination in planned_destinations
        .iter()
        .filter(|destination| destination.starts_with(&asset_root))
    {
        if !asset_preimages
            .iter()
            .any(|evidence| evidence.destination.as_path() == destination.as_path())
        {
            return Err(with_staging_cleanup(
                format!(
                    "macOS transaction has no verified JSON preimage for {}.",
                    destination.display()
                ),
                staging_root,
            ));
        }
    }
    let asset_destinations = asset_preimages
        .iter()
        .map(|evidence| evidence.destination.clone())
        .collect::<HashSet<_>>();
    let mut other_destinations = planned_destinations
        .into_iter()
        .filter(|destination| !asset_destinations.contains(destination))
        .collect::<Vec<_>>();
    other_destinations.sort();
    other_destinations.dedup();
    let mut preimages =
        privilege::MacApplyTransaction::capture_preimages(app_path, &other_destinations)?;
    // Every verified JSON asset participates in the authenticated generation. Changed assets are
    // mutation entries; files_match-filtered assets become observe-only preconditions and are
    // rechecked before the first write and before bundle/state commit.
    preimages.extend(asset_preimages.iter().map(|evidence| {
        privilege::MacBundlePreimageConstraint::existing(
            evidence.destination.clone(),
            evidence.sha256.clone(),
            evidence
                .unix_mode
                .expect("macOS exact asset evidence always carries a Unix mode"),
        )
    }));

    let mut transaction =
        match privilege::MacApplyTransaction::begin_with_deferred_pairs_and_removals_guarded(
            state_dir,
            app_path,
            intermediate_pairs,
            &launch_gate_pairs,
            &payload_pairs,
            &deferred_pairs,
            &[],
            deferred_removals,
            &signing_side_effects,
            &preimages,
        ) {
            Ok(transaction) => transaction,
            Err(privilege::MacApplyBeginError::CavalryStillRunning { .. }) => {
                // The third exact-PID scan runs after a first-install launcher gate is published.
                // Its byte-exact rollback leaves a Restored journal until the independent
                // signature gate confirms cleanup; finish that verification before reporting the
                // stable no-change renderer result.
                privilege::recover_macos_apply_transaction(state_dir, app_path, runner).map_err(
                    |error| {
                        with_staging_cleanup(
                            format!(
                                "Cavalry relaunched during the protected launch-gate handoff, and exact rollback could not be finalized: {error}"
                            ),
                            staging_root,
                        )
                    },
                )?;
                let mut payload = cavalry_still_running_payload();
                if let Err(error) = fs::remove_dir_all(staging_root) {
                    payload.warning = Some(format!(
                        "Cavalry was not changed, but temporary staging cleanup failed: {error}"
                    ));
                }
                return Ok(payload);
            }
            Err(error) => {
                return Err(with_staging_cleanup(
                    format!(
                        "Could not begin the protected Cavalry transaction: {}",
                        error.display()
                    ),
                    staging_root,
                ));
            }
        };
    let transaction_operation_id = transaction.operation_id().to_string();

    if let Err(error) = transaction.begin_signing() {
        let error = rollback_macos_apply(
            transaction,
            format!("Could not enter the macOS signing phase: {error}"),
            state_dir,
            app_path,
            runner,
        );
        return Err(with_staging_cleanup(error, staging_root));
    }

    if let Err(error) = platform_runtime::after_copy(
        plan,
        app_path,
        action_lang,
        staging_root,
        staged_pairs,
        runner,
    ) {
        let error = rollback_macos_apply(transaction, error, state_dir, app_path, runner);
        return Err(with_staging_cleanup(error, staging_root));
    }
    if action_lang != RESTORE_OFFICIAL_ACTION {
        if let Err(error) = transaction.verify_and_record_signing_postimages(|pinned_app| {
            platform_runtime::verify_after_copy(plan, pinned_app, action_lang, staged_pairs, runner)
        }) {
            let error = rollback_macos_apply(
                transaction,
                format!("Nested signing postimages did not verify: {error}"),
                state_dir,
                app_path,
                runner,
            );
            return Err(with_staging_cleanup(error, staging_root));
        }
    }
    if let Err(error) = transaction.authorize_deferred_commit() {
        let error = rollback_macos_apply(
            transaction,
            format!("Could not authorize the final macOS commit gate: {error}"),
            state_dir,
            app_path,
            runner,
        );
        return Err(with_staging_cleanup(error, staging_root));
    }
    if action_lang == RESTORE_OFFICIAL_ACTION {
        let official_info = match staged_official_info {
            Some(official_info) => official_info,
            None => {
                let error = rollback_macos_apply(
                    transaction,
                    "Official restore lost its commit-gated vendor Info.plist.",
                    state_dir,
                    app_path,
                    runner,
                );
                return Err(with_staging_cleanup(error, staging_root));
            }
        };
        if let Err(error) = transaction.apply_deferred_pair(official_info) {
            let error = rollback_macos_apply(
                transaction,
                format!("Could not publish the commit-gated vendor Info.plist: {error}"),
                state_dir,
                app_path,
                runner,
            );
            return Err(with_staging_cleanup(error, staging_root));
        }
        if let Err(error) = transaction.apply_deferred_removals() {
            let error = rollback_macos_apply(
                transaction,
                format!("Could not publish the commit-gated official removals: {error}"),
                state_dir,
                app_path,
                runner,
            );
            return Err(with_staging_cleanup(error, staging_root));
        }
    } else if let Some(final_marker) = staged_final_marker {
        if let Err(error) = transaction.apply_deferred_pair(final_marker) {
            let error = rollback_macos_apply(
                transaction,
                format!("Could not publish the final macOS language marker: {error}"),
                state_dir,
                app_path,
                runner,
            );
            return Err(with_staging_cleanup(error, staging_root));
        }
    }
    if let Err(error) = platform_runtime::after_final_language_marker(app_path, action_lang, runner)
    {
        let error = rollback_macos_apply(transaction, error, state_dir, app_path, runner);
        return Err(with_staging_cleanup(error, staging_root));
    }
    let signing_postcondition = transaction.verify_and_record_signing_postimages(|pinned_app| {
        if action_lang == RESTORE_OFFICIAL_ACTION {
            let baseline = mac_baseline.as_ref().ok_or_else(|| {
                "Official restore lost its combined vendor baseline before postimage verification."
                    .to_string()
            })?;
            baseline.verify_restored_bundle(pinned_app, &immutable_revision, runner)
        } else {
            privilege::ensure_bundle_signature(pinned_app, runner)
        }
    });
    if let Err(error) = signing_postcondition {
        let error = rollback_macos_apply(
            transaction,
            format!("Final macOS signing postimages did not verify: {error}"),
            state_dir,
            app_path,
            runner,
        );
        return Err(with_staging_cleanup(error, staging_root));
    }
    if let Err(error) = transaction.checkpoint_verified_bundle() {
        let error = rollback_macos_apply(
            transaction,
            format!("macOS bundle postconditions did not verify: {error}"),
            state_dir,
            app_path,
            runner,
        );
        return Err(with_staging_cleanup(error, staging_root));
    }
    if let Err(error) = privilege::clear_gatekeeper_quarantine(app_path, runner) {
        let error = rollback_macos_apply(
            transaction,
            format!("Could not clear Gatekeeper quarantine before commit: {error}"),
            state_dir,
            app_path,
            runner,
        );
        return Err(with_staging_cleanup(error, staging_root));
    }

    if let Err(error) = transaction.begin_state_commit() {
        let error = rollback_macos_apply(
            transaction,
            format!("Could not enter the durable state commit phase: {error}"),
            state_dir,
            app_path,
            runner,
        );
        return Err(with_staging_cleanup(error, staging_root));
    }

    let mut payload = match finish_apply_state_with_operation(
        state_dir,
        current_state,
        app_path,
        version,
        immutable_revision,
        effective_lang,
        now,
        None,
        Some(&transaction_operation_id),
    ) {
        Ok(payload) => payload,
        Err(error) => {
            let error = rollback_macos_apply(
                transaction,
                format!("Could not commit language state: {error}"),
                state_dir,
                app_path,
                runner,
            );
            return Err(with_staging_cleanup(error, staging_root));
        }
    };
    if let Err(error) = transaction.checkpoint_state_commit() {
        let error = rollback_macos_apply(
            transaction,
            format!("Could not checkpoint committed language state: {error}"),
            state_dir,
            app_path,
            runner,
        );
        return Err(with_staging_cleanup(error, staging_root));
    }

    let mut completion = match transaction.commit() {
        Ok(completion) => completion,
        Err(error) => {
            let mut error = error;
            if let Err(verify_error) = privilege::ensure_bundle_signature(app_path, runner) {
                error.push_str(&format!(
                    " Exact restored signature state did not verify after commit rollback: {verify_error}"
                ));
            }
            return Err(with_staging_cleanup(error, staging_root));
        }
    };
    if let Err(error) = fs::remove_dir_all(staging_root) {
        completion.warnings.push(PostCommitWarning::new(
            PostCommitWarningCode::StagingCleanup,
            [staging_root.to_path_buf()],
            Some(error.to_string()),
        ));
    }
    payload.warning = renderer_warning_for_copy(&completion.warnings, &completion.mode);
    Ok(payload)
}

#[cfg(target_os = "macos")]
fn rollback_macos_apply<R: CommandRunner>(
    transaction: privilege::MacApplyTransaction,
    cause: impl Into<String>,
    state_dir: &Path,
    app_path: &Path,
    runner: &mut R,
) -> String {
    let mut error = transaction.rollback_with_cause(cause);
    if let Err(verify_error) = privilege::ensure_bundle_signature(app_path, runner) {
        error.push_str(&format!(
            " Exact restored signature state did not verify after rollback: {verify_error}"
        ));
    } else if let Err(finalize_error) =
        privilege::finalize_verified_macos_apply_recovery(state_dir, app_path)
    {
        error.push_str(&format!(
            " Restored preimages verified, but their recovery journal was retained: {finalize_error}"
        ));
    }
    error
}

#[cfg(target_os = "macos")]
fn with_staging_cleanup(error: String, staging_root: &Path) -> String {
    match fs::remove_dir_all(staging_root) {
        Ok(()) => error,
        Err(cleanup_error) => format!(
            "{error} Cleanup residual remains at {}: {cleanup_error}",
            staging_root.display()
        ),
    }
}

#[cfg(not(target_os = "macos"))]
fn finish_apply_state(
    state_dir: &Path,
    current_state: State,
    app_path: &Path,
    version: String,
    immutable_revision: String,
    lang: &str,
    now: &str,
    warning: Option<String>,
) -> Result<ActionPayload, String> {
    finish_apply_state_with_operation(
        state_dir,
        current_state,
        app_path,
        version,
        immutable_revision,
        lang,
        now,
        warning,
        None,
    )
}

#[allow(clippy::too_many_arguments)]
fn finish_apply_state_with_operation(
    state_dir: &Path,
    current_state: State,
    app_path: &Path,
    version: String,
    immutable_revision: String,
    lang: &str,
    now: &str,
    warning: Option<String>,
    operation_id: Option<&str>,
) -> Result<ActionPayload, String> {
    let next = State {
        app_path: app_path.to_string_lossy().to_string(),
        cavalry_version: version,
        cavalry_revision: immutable_revision,
        current_lang: lang.to_string(),
        last_patched_at: now.to_string(),
        ..current_state
    };
    let outcome = if let Some(operation_id) = operation_id {
        state::write_state_with_operation_outcome(state_dir, &next, operation_id)
    } else {
        state::write_state_outcome(state_dir, &next)
    }?;
    let state_warning = outcome.warning().map(ToString::to_string);
    if operation_id.is_some() {
        if let Some(state_warning) = state_warning.as_deref() {
            return Err(format!(
                "The language state rename became visible, but directory durability was not confirmed: {state_warning}"
            ));
        }
    }
    let warning = match (warning, state_warning) {
        (Some(existing), Some(state_warning)) => Some(format!("{existing} {state_warning}")),
        (Some(existing), None) => Some(existing),
        (None, Some(state_warning)) => Some(state_warning),
        (None, None) => None,
    };
    Ok(ActionPayload::ok_lang(
        &outcome.state().current_lang,
        warning,
    ))
}

fn cavalry_still_running_payload() -> ActionPayload {
    ActionPayload::error_with_code(
        "Cavalry is still running. Save your work, close Cavalry, and try again. The Cavalry installation was not changed.",
        CAVALRY_STILL_RUNNING_ERROR_CODE,
    )
}

fn finish_direct_preflight_result(
    result: Result<(), platform_runtime::ApplyPreflightError>,
) -> Result<Option<ActionPayload>, String> {
    match result {
        Ok(()) => Ok(None),
        Err(platform_runtime::ApplyPreflightError::CavalryStillRunning) => {
            Ok(Some(cavalry_still_running_payload()))
        }
        Err(platform_runtime::ApplyPreflightError::Other(detail)) => Err(detail),
    }
}

#[cfg(test)]
mod direct_preflight_result_tests {
    use super::*;

    #[test]
    fn every_platform_projects_a_running_cavalry_to_the_stable_renderer_code() {
        let payload = finish_direct_preflight_result(Err(
            platform_runtime::ApplyPreflightError::CavalryStillRunning,
        ))
        .unwrap()
        .unwrap();

        assert!(!payload.ok);
        assert_eq!(
            payload.error_code.as_deref(),
            Some(CAVALRY_STILL_RUNNING_ERROR_CODE)
        );
    }
}

#[cfg(all(test, target_os = "macos"))]
mod macos_launch_gate_tests {
    use super::*;

    #[test]
    fn first_install_gate_orders_wrapper_before_info_and_leaves_assets_for_payload() {
        let app = PathBuf::from("/Applications/Cavalry.app");
        let wrapper = patch::CopyPair {
            src: PathBuf::from("/tmp/wrapper"),
            dst: app.join("Contents/MacOS/CavalryLauncher"),
        };
        let info = patch::CopyPair {
            src: PathBuf::from("/tmp/info"),
            dst: app.join("Contents/Info.plist"),
        };
        let asset = patch::CopyPair {
            src: PathBuf::from("/tmp/asset"),
            dst: app.join("Contents/assets/appStrings.json"),
        };

        let (gate, payload) = partition_macos_launch_gate_pairs(
            &app,
            &[asset.clone(), info.clone(), wrapper.clone()],
        );

        assert_eq!(gate, vec![wrapper, info]);
        assert_eq!(payload, vec![asset]);
    }
}

#[cfg(target_os = "windows")]
#[allow(clippy::too_many_arguments)]
fn finish_program_files_result(
    result: Result<privilege::ParentApplyOutcome, privilege::ParentApplyError>,
    state_dir: &Path,
    current_state: &State,
    app_path: &Path,
    version: &str,
    immutable_revision: &str,
    lang: &str,
    now: &str,
) -> Result<Option<ActionPayload>, String> {
    match result {
        Ok(privilege::ParentApplyOutcome::NotApplicable) => Ok(None),
        Ok(privilege::ParentApplyOutcome::Applied {
            worker_cleanup_residual,
            staging_cleanup_warning,
        }) => {
            let mut warnings = Vec::with_capacity(2);
            if worker_cleanup_residual {
                warnings.push(PostCommitWarning::new(
                    PostCommitWarningCode::ElevatedTransactionCleanup,
                    [app_path.to_path_buf()],
                    Some(
                        "The elevated worker committed but retained its bounded transaction journal."
                            .to_string(),
                    ),
                ));
            }
            if let Some(detail) = staging_cleanup_warning {
                warnings.push(PostCommitWarning::new(
                    PostCommitWarningCode::StagingCleanup,
                    std::iter::empty::<PathBuf>(),
                    Some(detail),
                ));
            }
            let warning = renderer_warning_for_copy(&warnings, "elevated");
            finish_apply_state(
                state_dir,
                current_state.clone(),
                app_path,
                version.to_string(),
                immutable_revision.to_string(),
                lang,
                now,
                warning,
            )
            .map(Some)
        }
        Err(privilege::ParentApplyError::PermissionRequired {
            staging_cleanup_warning,
            ..
        }) => {
            let message = if staging_cleanup_warning.is_some() {
                "Windows administrator consent is required to update this Program Files installation. Temporary cleanup is still pending."
            } else {
                "Windows administrator consent is required to update this Program Files installation."
            };
            Ok(Some(ActionPayload::permission_error(message)))
        }
        Err(privilege::ParentApplyError::CavalryStillRunning { .. }) => {
            Ok(Some(cavalry_still_running_payload()))
        }
        Err(error) => Err(error.to_string()),
    }
}

#[cfg(all(test, target_os = "windows"))]
mod program_files_result_tests {
    use super::*;

    fn write(path: &Path, bytes: &[u8]) {
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::write(path, bytes).unwrap();
    }

    #[test]
    fn stale_marker_after_snapshot_capture_reaches_the_final_english_marker() {
        let temp = tempfile::tempdir().unwrap();
        let app = temp.path().join("Cavalry");
        let layout = InstallLayout::from_root(&app);
        let state = State {
            current_lang: "zh-Hant".to_string(),
            ..State::default()
        };

        let state = match prepare_clean_english_fast_path(
            state,
            true,
            false,
            |mut state| {
                state.current_lang = "en".to_string();
                Ok(state)
            },
            || Ok(CleanEnglishDisposition::NeedsWindowsReconciliation),
        )
        .unwrap()
        {
            CleanEnglishFastPath::Continue(state) => state,
            CleanEnglishFastPath::Noop => {
                panic!("stale marker was incorrectly accepted as a clean-English no-op")
            }
        };
        assert_eq!(state.current_lang, "en");

        let final_source = temp.path().join("final-marker.txt");
        write(&final_source, b"en\n");
        write(&layout.language_marker, b"zh-Hant\n");
        let final_marker = patch::CopyPair {
            src: final_source,
            dst: layout.language_marker.clone(),
        };
        let transaction = marker_guarded_transaction_pairs(
            &layout,
            &temp.path().join("pending-marker"),
            Vec::new(),
            Some(&final_marker),
            true,
        )
        .unwrap();
        let staged = patch::stage_files(&transaction, &temp.path().join("staged")).unwrap();
        let mut runner = crate::privilege::RecordingRunner::default();
        privilege::copy_with_privilege_detailed(&staged, &mut runner).unwrap();
        assert_eq!(
            fs::read_to_string(&layout.language_marker).unwrap(),
            "pending\n"
        );

        let staged_final = patch::stage_files(
            std::slice::from_ref(&final_marker),
            &temp.path().join("staged-final-marker"),
        )
        .unwrap();
        privilege::copy_with_privilege_detailed(&staged_final, &mut runner).unwrap();

        assert_eq!(fs::read_to_string(layout.language_marker).unwrap(), "en\n");
    }

    #[test]
    fn stale_marker_with_existing_snapshot_also_bypasses_the_english_noop() {
        let state = State {
            current_lang: "en".to_string(),
            ..State::default()
        };

        let outcome = prepare_clean_english_fast_path(
            state,
            false,
            false,
            |_| panic!("an existing snapshot must not be captured again"),
            || Ok(CleanEnglishDisposition::NeedsWindowsReconciliation),
        )
        .unwrap();

        assert!(matches!(outcome, CleanEnglishFastPath::Continue(_)));
        assert!(matches!(
            prepare_clean_english_fast_path(State::default(), false, false, Ok, || Ok(
                CleanEnglishDisposition::Clean
            ),)
            .unwrap(),
            CleanEnglishFastPath::Noop
        ));
        assert!(matches!(
            prepare_clean_english_fast_path(State::default(), false, false, Ok, || Err(
                "unproven runtime".to_string()
            ),)
            .unwrap(),
            CleanEnglishFastPath::Continue(_)
        ));
        assert!(matches!(
            prepare_clean_english_fast_path(
                State::default(),
                true,
                true,
                |_| panic!("pending journal must bypass English snapshot capture"),
                || panic!("pending journal must bypass clean-English inspection"),
            )
            .unwrap(),
            CleanEnglishFastPath::Continue(_)
        ));
    }

    fn context() -> (tempfile::TempDir, PathBuf, PathBuf, State) {
        let temp = tempfile::tempdir().unwrap();
        let state_dir = temp.path().join("state");
        let app_path = temp.path().join("Cavalry");
        (
            temp,
            state_dir,
            app_path,
            State {
                current_lang: "en".to_string(),
                ..State::default()
            },
        )
    }

    #[test]
    fn not_applicable_preserves_state_for_the_direct_path() {
        let (_temp, state_dir, app_path, state) = context();
        let result = finish_program_files_result(
            Ok(privilege::ParentApplyOutcome::NotApplicable),
            &state_dir,
            &state,
            &app_path,
            "2.7.2",
            "revision",
            "zh-Hans",
            "now",
        )
        .unwrap();

        assert_eq!(result, None);
        assert!(!state_dir.exists());
    }

    #[test]
    fn committed_result_is_the_only_path_that_writes_next_state() {
        let (_temp, state_dir, app_path, state) = context();
        let payload = finish_program_files_result(
            Ok(privilege::ParentApplyOutcome::Applied {
                worker_cleanup_residual: true,
                staging_cleanup_warning: None,
            }),
            &state_dir,
            &state,
            &app_path,
            "2.7.2",
            "revision",
            "zh-Hans",
            "now",
        )
        .unwrap()
        .unwrap();

        assert!(payload.ok);
        let expected = renderer_warning_for_copy(
            &[PostCommitWarning::new(
                PostCommitWarningCode::ElevatedTransactionCleanup,
                [app_path.clone()],
                Some("fixture".to_string()),
            )],
            "elevated",
        );
        assert_eq!(payload.warning, expected);
        assert_eq!(
            state::read_state(&state_dir).unwrap().current_lang,
            "zh-Hans"
        );
    }

    #[test]
    fn staging_residual_uses_the_shared_post_commit_warning_contract() {
        let (_temp, state_dir, app_path, state) = context();
        let payload = finish_program_files_result(
            Ok(privilege::ParentApplyOutcome::Applied {
                worker_cleanup_residual: false,
                staging_cleanup_warning: Some("fixture staging residual".to_string()),
            }),
            &state_dir,
            &state,
            &app_path,
            "2.7.2",
            "revision",
            "zh-Hans",
            "now",
        )
        .unwrap()
        .unwrap();

        let expected = renderer_warning_for_copy(
            &[PostCommitWarning::new(
                PostCommitWarningCode::StagingCleanup,
                std::iter::empty::<PathBuf>(),
                Some("fixture".to_string()),
            )],
            "elevated",
        );
        assert_eq!(payload.warning, expected);
    }

    #[test]
    fn cancellation_is_permission_required_without_state_write() {
        let (_temp, state_dir, app_path, state) = context();
        let payload = finish_program_files_result(
            Err(privilege::ParentApplyError::PermissionRequired {
                code: 1223,
                staging_cleanup_warning: None,
            }),
            &state_dir,
            &state,
            &app_path,
            "2.7.2",
            "revision",
            "zh-Hans",
            "now",
        )
        .unwrap()
        .unwrap();

        assert!(!payload.ok);
        assert!(payload.permission_required);
        assert!(!state_dir.exists());
    }

    #[test]
    fn running_cavalry_is_a_localizable_retry_without_state_write() {
        let (_temp, state_dir, app_path, state) = context();
        let payload = finish_program_files_result(
            Err(privilege::ParentApplyError::CavalryStillRunning {
                staging_cleanup_warning: None,
            }),
            &state_dir,
            &state,
            &app_path,
            "2.7.2",
            "revision",
            "zh-Hans",
            "now",
        )
        .unwrap()
        .unwrap();

        assert!(!payload.ok);
        assert!(!payload.permission_required);
        assert_eq!(
            payload.error_code.as_deref(),
            Some(CAVALRY_STILL_RUNNING_ERROR_CODE)
        );
        assert!(!state_dir.exists());
    }

    #[test]
    fn direct_root_running_cavalry_uses_the_same_localizable_retry() {
        let payload = finish_direct_preflight_result(Err(
            platform_runtime::ApplyPreflightError::CavalryStillRunning,
        ))
        .unwrap()
        .unwrap();

        assert!(!payload.ok);
        assert!(!payload.permission_required);
        assert_eq!(
            payload.error_code.as_deref(),
            Some(CAVALRY_STILL_RUNNING_ERROR_CODE)
        );
    }

    #[test]
    fn direct_root_preflight_preserves_success_and_unrelated_failures() {
        assert!(finish_direct_preflight_result(Ok(())).unwrap().is_none());
        assert_eq!(
            finish_direct_preflight_result(Err(platform_runtime::ApplyPreflightError::Other(
                "fixture failure".to_string(),
            )))
            .unwrap_err(),
            "fixture failure"
        );
    }

    #[test]
    fn rollback_and_uncertain_results_never_write_state() {
        for error in [
            privilege::ParentApplyError::WorkerRolledBack {
                staging_cleanup_warning: None,
            },
            privilege::ParentApplyError::WorkerStateUncertain {
                staging_cleanup_warning: None,
            },
        ] {
            let (_temp, state_dir, app_path, state) = context();
            assert!(finish_program_files_result(
                Err(error),
                &state_dir,
                &state,
                &app_path,
                "2.7.2",
                "revision",
                "zh-Hans",
                "now",
            )
            .is_err());
            assert!(!state_dir.exists());
        }
    }
}
