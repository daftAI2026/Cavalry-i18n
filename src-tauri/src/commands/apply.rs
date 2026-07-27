/**
 * [INPUT]: 依赖 snapshot/status、patch transaction、platform_runtime preflight/ApplyPlan 与 privilege typed copy completion。
 * [OUTPUT]: 提供 apply_language_inner、Windows pending→QPA→final marker 顺序、macOS marker→签名顺序及 staging warning。
 * [POS]: commands 的语言写入编排；Windows final marker 可延后到 QPA ACTIVE/English 恢复之后，macOS 保持 marker 入事务后统一重签。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
use chrono::Utc;
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
    context::{language_source_dir, next_staging_nonce},
    contract::{renderer_warning_for_copy, ActionPayload},
    snapshot::extract_english_snapshot_or_throw,
    status::sync_state_with_bundle,
};

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
    let app_path = detect::resolve_install(app_path)?.root;
    if !matches!(lang, "en" | "zh-Hans" | "zh-Hant" | "ja_JP") {
        return Err(format!("Unsupported language: {lang}"));
    }

    let version = detect::read_bundle_version(&app_path).unwrap_or_default();
    let immutable_revision = detect::read_bundle_revision(&app_path)?;
    let previous_state = state::read_state(state_dir).unwrap_or_default();
    let mut current_state = sync_state_with_bundle(
        state_dir,
        previous_state.clone(),
        &app_path,
        &version,
        &immutable_revision,
    );
    current_state = super::snapshot::migrate_legacy_snapshot_provenance(
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
        let needs_snapshot = patch::needs_english_snapshot(
            state_dir,
            current_state.english_snapshot_provenance.as_ref(),
            &app_path,
            &immutable_revision,
        );
        if needs_snapshot {
            let _ = extract_english_snapshot_or_throw(
                repo_root,
                state_dir,
                resource_dir,
                current_state,
                &app_path,
                &immutable_revision,
            )?;
            return Ok(ActionPayload::ok_lang("en", None));
        }
        if super::snapshot::ensure_clean_english_install(repo_root, resource_dir, &app_path).is_ok()
        {
            return Ok(ActionPayload::ok_lang("en", None));
        }
    }

    if lang != "en" {
        current_state = extract_english_snapshot_or_throw(
            repo_root,
            state_dir,
            resource_dir,
            current_state,
            &app_path,
            &immutable_revision,
        )?;
    } else if patch::needs_english_snapshot(
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

    let source_dir = if lang == "en" {
        state_dir.join("en")
    } else {
        language_source_dir(repo_root, resource_dir, lang)
    };
    if !source_dir.exists() {
        return if lang == "en" {
            Err("English snapshot not found. Point the app picker to a clean Cavalry.app and refresh English first.".to_string())
        } else {
            Err(format!("Language files not found for {lang}."))
        };
    }

    let staging_root = unique_staging_root();
    let plan = platform_runtime::prepare_apply(
        repo_root,
        resource_dir,
        &app_path,
        lang,
        &version,
        &staging_root,
    )?;
    platform_runtime::preflight_apply(&app_path, lang, runner)?;
    let mut pairs = if lang == "en" {
        patch::build_copy_pairs(&source_dir, &app_path)
    } else {
        patch::build_overlay_pairs(
            &source_dir,
            &state_dir.join("en"),
            &app_path,
            &staging_root.join("overlay"),
        )?
    };
    if pairs.is_empty() {
        return Err(format!("No JSON assets found for {lang}."));
    }
    pairs.extend(plan.runtime_pairs.iter().cloned());
    let layout = InstallLayout::from_root(&app_path);

    let copy_mode = (|| {
        let changed_pairs = pairs
            .iter()
            .filter(|pair| !files_match(&pair.src, &pair.dst))
            .cloned()
            .collect::<Vec<_>>();
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

    let staging_cleanup = fs::remove_dir_all(&staging_root);
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
    if let Err(error) = staging_cleanup {
        copy_completion.warnings.push(PostCommitWarning::new(
            PostCommitWarningCode::StagingCleanup,
            [staging_root],
            Some(error.to_string()),
        ));
    }

    let next_state = state::write_state(
        state_dir,
        &State {
            app_path: app_path.to_string_lossy().to_string(),
            cavalry_version: version,
            cavalry_revision: immutable_revision,
            current_lang: lang.to_string(),
            last_patched_at: now.to_string(),
            ..current_state
        },
    )?;
    Ok(ActionPayload::ok_lang(
        &next_state.current_lang,
        renderer_warning_for_copy(&copy_completion.warnings, &copy_completion.mode),
    ))
}
