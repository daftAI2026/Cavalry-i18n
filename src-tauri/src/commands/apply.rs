/**
 * [INPUT]: 依赖 snapshot/status、English-baseline JSON overlay、Program Files typed parent transaction、platform_runtime direct preflight 与 privilege copy completion。
 * [OUTPUT]: 提供 apply_language_inner、Windows 四语言 canonical pretty overlay/单次 UAC/typed cleanup warning、自定义根 fallback，以及 macOS 原始 English snapshot 与 marker→签名顺序。
 * [POS]: commands 的语言写入编排；Windows 为 source provenance 统一规范化 English/翻译 payload，Program Files 仅在 worker 0/42 后写 state，macOS 保持已验收快照行为。
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
    let pairs = if lang == "en" {
        #[cfg(target_os = "windows")]
        {
            patch::build_overlay_pairs(
                &source_dir,
                &state_dir.join("en"),
                &app_path,
                &staging_root.join("overlay"),
            )?
        }
        #[cfg(not(target_os = "windows"))]
        {
            patch::build_copy_pairs(&source_dir, &app_path)
        }
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

    #[cfg(target_os = "windows")]
    {
        let layout = InstallLayout::from_root(&app_path);
        let program_files_result =
            privilege::apply_windows_program_files_language(privilege::ParentApplyRequest {
                repo_root,
                resource_dir,
                state_dir,
                layout: &layout,
                language: lang,
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
            lang,
            now,
        )? {
            return Ok(payload);
        }
    }

    let plan = platform_runtime::prepare_apply(
        repo_root,
        resource_dir,
        &app_path,
        lang,
        &version,
        &staging_root,
    )?;
    platform_runtime::preflight_apply(&app_path, lang, runner)?;
    let mut pairs = pairs;
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

    finish_apply_state(
        state_dir,
        current_state,
        &app_path,
        version,
        immutable_revision,
        lang,
        now,
        renderer_warning_for_copy(&copy_completion.warnings, &copy_completion.mode),
    )
}

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
    Ok(ActionPayload::ok_lang(&next_state.current_lang, warning))
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
        Err(error) => Err(error.to_string()),
    }
}

#[cfg(all(test, target_os = "windows"))]
mod program_files_result_tests {
    use super::*;

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
