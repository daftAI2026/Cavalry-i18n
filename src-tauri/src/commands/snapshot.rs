/**
 * [INPUT]: 依赖 detect/install/patch/state、Windows QPA 只读证据、CommandRunner 与 context 的 packaged language source 定位。
 * [OUTPUT]: 提供 clean-English 证明、stale marker/runtime 分类、只读 English 状态投影、采集后收敛、legacy provenance 迁移及 apply 前快照门。
 * [POS]: commands 的 English 安装真相层；JSON 与原厂 QPA 共同证明现实，marker 仅可被判为待修元数据，任何未知/ACTIVE 运行时仍 fail closed。
 * [FAIL-CLOSED]: Windows 仅接受 Stock，或带有有效 manifest phase 的 Recover；vendor hash 不能单独证明英文运行时，非法/缺失 manifest 必须在 snapshot 前拒绝。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
use std::{fs, io::ErrorKind, path::Path};

use crate::{
    detect,
    install::{InstallLayout, InstallPlatform},
    patch,
    privilege::CommandRunner,
    state::{self, EnglishSnapshotProvenance, State},
};

use super::{
    context::language_source_dir, contract::ActionPayload, status::sync_state_with_bundle,
};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum CleanEnglishDisposition {
    Clean,
    NeedsWindowsReconciliation,
}

pub(crate) fn ensure_clean_english_install(
    repo_root: &Path,
    resource_dir: &Path,
    app_path: &Path,
) -> Result<CleanEnglishDisposition, String> {
    #[cfg(target_os = "windows")]
    {
        let layout = InstallLayout::from_selection(app_path)?;
        if layout.platform == InstallPlatform::Windows {
            return ensure_clean_english_install_with_qpa_inspector(
                repo_root,
                resource_dir,
                app_path,
                crate::windows_qpa::inspect,
            );
        }
    }
    ensure_clean_english_install_for_platform(repo_root, resource_dir, app_path)
}

fn ensure_clean_english_install_for_platform(
    repo_root: &Path,
    resource_dir: &Path,
    app_path: &Path,
) -> Result<CleanEnglishDisposition, String> {
    let layout = InstallLayout::from_selection(app_path)?;
    match fs::read_to_string(&layout.language_marker) {
        Ok(marker)
            if marker.trim() == "en"
                || (layout.platform == InstallPlatform::Macos && marker.trim().is_empty()) => {}
        Ok(marker) => {
            let marker = marker.trim();
            return Err(format!(
                "English extraction refused: Cavalry language marker is {}.",
                if marker.is_empty() { "invalid" } else { marker }
            ));
        }
        Err(error) if error.kind() == ErrorKind::NotFound => {}
        Err(error) => {
            return Err(format!(
                "English extraction refused: could not verify language marker {}: {error}",
                layout.language_marker.display()
            ));
        }
    }

    let english_source = language_source_dir(repo_root, resource_dir, "en");
    if !patch::install_matches_language_source(&english_source, &layout.root)? {
        return Err(
            "English extraction refused: installed Cavalry JSON assets do not match the packaged English source."
                .to_string(),
        );
    }
    Ok(CleanEnglishDisposition::Clean)
}

#[cfg(target_os = "windows")]
fn ensure_clean_english_install_with_qpa_inspector<F>(
    repo_root: &Path,
    resource_dir: &Path,
    app_path: &Path,
    inspect_qpa: F,
) -> Result<CleanEnglishDisposition, String>
where
    F: Fn(&InstallLayout) -> Result<crate::windows_qpa::QpaInspection, String>,
{
    let layout = InstallLayout::from_selection(app_path)?;
    let english_source = language_source_dir(repo_root, resource_dir, "en");
    if !patch::install_matches_language_source(&english_source, &layout.root)? {
        return Err(
            "English extraction refused: installed Cavalry JSON assets do not match the packaged English source."
                .to_string(),
        );
    }

    let marker = match fs::read_to_string(&layout.language_marker) {
        Ok(marker) => {
            let marker = marker.trim();
            if !matches!(marker, "en" | "zh-Hans" | "zh-Hant" | "ja_JP") {
                return Err(format!(
                    "English extraction refused: Cavalry language marker is {}.",
                    if marker.is_empty() { "invalid" } else { marker }
                ));
            }
            Some(marker.to_string())
        }
        Err(error) if error.kind() == ErrorKind::NotFound => None,
        Err(error) => {
            return Err(format!(
                "English extraction refused: could not verify language marker {}: {error}",
                layout.language_marker.display()
            ));
        }
    };
    let inspection = inspect_qpa(&layout).map_err(|error| {
        format!("English extraction refused: could not verify the Windows QPA runtime: {error}")
    })?;
    let proven_stock_state = match inspection.state {
        crate::windows_qpa::QpaDeploymentState::Stock => true,
        crate::windows_qpa::QpaDeploymentState::Recover => inspection.phase.is_some(),
        crate::windows_qpa::QpaDeploymentState::Active
        | crate::windows_qpa::QpaDeploymentState::Drifted => false,
    };
    let vendor_runtime = proven_stock_state
        && inspection.current_qwindows_sha256.as_deref()
            == Some(crate::windows_qpa::VENDOR_QWINDOWS_SHA256);
    if !vendor_runtime {
        return Err(format!(
            "English extraction refused: the Windows runtime is not proven stock. {}",
            inspection.detail
        ));
    }

    let generic_exists = layout
        .root
        .join(crate::windows_qpa::GENERIC_PLUGIN_RELATIVE_PATH)
        .exists();
    if marker.as_deref().is_some_and(|marker| marker != "en")
        || inspection.state == crate::windows_qpa::QpaDeploymentState::Recover
        || generic_exists
    {
        Ok(CleanEnglishDisposition::NeedsWindowsReconciliation)
    } else {
        Ok(CleanEnglishDisposition::Clean)
    }
}

#[allow(clippy::too_many_arguments)]
pub(crate) fn migrate_legacy_snapshot_provenance(
    repo_root: &Path,
    state_dir: &Path,
    resource_dir: &Path,
    previous: &State,
    mut current: State,
    app_path: &Path,
    version: &str,
    immutable_revision: &str,
) -> State {
    if current.english_snapshot_provenance.is_some()
        || app_path.as_os_str().is_empty()
        || immutable_revision.is_empty()
    {
        return current;
    }
    let previous_root = InstallLayout::from_selection(Path::new(&previous.app_path))
        .map(|layout| layout.root)
        .unwrap_or_default();
    if previous_root != app_path {
        return current;
    }
    let identity_matches = (!previous.cavalry_revision.is_empty()
        && previous.cavalry_revision == immutable_revision)
        || (previous.cavalry_revision.is_empty()
            && !version.is_empty()
            && previous.cavalry_version == version);
    if !identity_matches {
        return current;
    }

    let english_source = language_source_dir(repo_root, resource_dir, "en");
    if !matches!(
        patch::snapshot_matches_language_source(&english_source, state_dir, app_path),
        Ok(true)
    ) {
        return current;
    }

    current.english_snapshot_provenance = Some(EnglishSnapshotProvenance {
        install_root: app_path.to_string_lossy().to_string(),
        immutable_revision: immutable_revision.to_string(),
    });
    current.cavalry_revision = immutable_revision.to_string();
    state::write_state(state_dir, &current).unwrap_or(current)
}

fn capture_clean_english_snapshot(
    repo_root: &Path,
    state_dir: &Path,
    resource_dir: &Path,
    state: State,
    app_path: &Path,
    immutable_revision: &str,
) -> Result<(usize, State), String> {
    if immutable_revision.is_empty() {
        return Err(
            "English extraction refused: Cavalry immutable revision could not be established."
                .to_string(),
        );
    }
    ensure_clean_english_install(repo_root, resource_dir, app_path)?;
    let count = patch::extract_english(app_path, &state_dir.join("en"))?;
    let next = state::write_state(
        state_dir,
        &State {
            app_path: app_path.to_string_lossy().to_string(),
            cavalry_revision: immutable_revision.to_string(),
            current_lang: "en".to_string(),
            english_snapshot_provenance: Some(EnglishSnapshotProvenance {
                install_root: app_path.to_string_lossy().to_string(),
                immutable_revision: immutable_revision.to_string(),
            }),
            ..state
        },
    )?;
    Ok((count, next))
}

pub fn extract_english_inner(
    repo_root: &Path,
    state_dir: &Path,
    resource_dir: &Path,
    app_path: &Path,
) -> Result<usize, String> {
    let app_path = detect::resolve_install(app_path)?.root;
    let version = detect::read_bundle_version(&app_path).unwrap_or_default();
    let immutable_revision = detect::read_bundle_revision(&app_path)?;
    let current_state = sync_state_with_bundle(
        state_dir,
        state::read_state(state_dir).unwrap_or_default(),
        &app_path,
        &version,
        &immutable_revision,
    );
    let (count, _) = capture_clean_english_snapshot(
        repo_root,
        state_dir,
        resource_dir,
        current_state,
        &app_path,
        &immutable_revision,
    )?;
    Ok(count)
}

pub(crate) fn refresh_english_inner<R: CommandRunner>(
    repo_root: &Path,
    state_dir: &Path,
    resource_dir: &Path,
    app_path: &Path,
    runner: &mut R,
    now: &str,
) -> Result<ActionPayload, String> {
    let app_path = detect::resolve_install(app_path)?.root;
    let disposition = ensure_clean_english_install(repo_root, resource_dir, &app_path)?;
    let count = extract_english_inner(repo_root, state_dir, resource_dir, &app_path)?;
    if disposition != CleanEnglishDisposition::NeedsWindowsReconciliation {
        return Ok(ActionPayload::ok_count(count));
    }

    let mut payload = super::apply::apply_language_inner(
        repo_root,
        state_dir,
        resource_dir,
        &app_path,
        "en",
        runner,
        now,
    )?;
    if payload.ok {
        payload.count = Some(count);
    }
    Ok(payload)
}

pub(crate) fn project_proven_english_state(
    repo_root: &Path,
    resource_dir: &Path,
    app_path: &Path,
    mut state: State,
) -> State {
    if ensure_clean_english_install(repo_root, resource_dir, app_path).is_ok() {
        state.current_lang = "en".to_string();
    }
    state
}

#[cfg(all(target_os = "windows", test))]
fn project_proven_english_state_with_qpa_inspector<F>(
    repo_root: &Path,
    resource_dir: &Path,
    app_path: &Path,
    mut state: State,
    inspect_qpa: F,
) -> State
where
    F: Fn(&InstallLayout) -> Result<crate::windows_qpa::QpaInspection, String>,
{
    if ensure_clean_english_install_with_qpa_inspector(
        repo_root,
        resource_dir,
        app_path,
        inspect_qpa,
    )
    .is_ok()
    {
        state.current_lang = "en".to_string();
    }
    state
}

pub(crate) fn extract_english_snapshot_or_throw(
    repo_root: &Path,
    state_dir: &Path,
    resource_dir: &Path,
    state: State,
    app_path: &Path,
    immutable_revision: &str,
) -> Result<State, String> {
    if !patch::needs_english_snapshot(
        state_dir,
        state.english_snapshot_provenance.as_ref(),
        app_path,
        immutable_revision,
    ) {
        return Ok(state);
    }
    let (_, state) = capture_clean_english_snapshot(
        repo_root,
        state_dir,
        resource_dir,
        state,
        app_path,
        immutable_revision,
    )?;
    Ok(state)
}

#[cfg(all(test, target_os = "windows"))]
mod windows_reconciliation_tests {
    use super::*;
    use std::path::Path;

    fn write(path: &Path, bytes: &[u8]) {
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::write(path, bytes).unwrap();
    }

    fn vendor_reinstall_recovery(
        _layout: &InstallLayout,
    ) -> Result<crate::windows_qpa::QpaInspection, String> {
        Ok(crate::windows_qpa::QpaInspection {
            state: crate::windows_qpa::QpaDeploymentState::Recover,
            phase: Some(crate::windows_qpa::QpaManifestPhase::Active),
            current_qwindows_sha256: Some(crate::windows_qpa::VENDOR_QWINDOWS_SHA256.to_string()),
            detail: "vendor reinstall left owned recovery metadata".to_string(),
        })
    }

    fn invalid_manifest_recovery(
        _layout: &InstallLayout,
    ) -> Result<crate::windows_qpa::QpaInspection, String> {
        Ok(crate::windows_qpa::QpaInspection {
            state: crate::windows_qpa::QpaDeploymentState::Recover,
            phase: None,
            current_qwindows_sha256: Some(crate::windows_qpa::VENDOR_QWINDOWS_SHA256.to_string()),
            detail: "the durable QPA manifest is invalid".to_string(),
        })
    }

    #[test]
    fn proven_english_with_stale_translated_marker_requires_reconciliation() {
        let temp = tempfile::tempdir().unwrap();
        let repo = temp.path().join("repo");
        let app = temp.path().join("Cavalry");
        write(&app.join("Cavalry.exe"), b"fixture executable");
        for (source, target) in crate::patch::CORE_MAP {
            write(
                &repo.join("languages/en").join(source),
                br#"{"value":"en"}"#,
            );
            write(&app.join("assets").join(target), br#"{"value":"en"}"#);
        }
        write(&app.join(crate::install::LANG_MARKER_NAME), b"zh-Hant\n");

        let disposition = ensure_clean_english_install_with_qpa_inspector(
            &repo,
            &repo,
            &app,
            vendor_reinstall_recovery,
        )
        .unwrap();

        assert_eq!(
            disposition,
            CleanEnglishDisposition::NeedsWindowsReconciliation
        );

        let projected = project_proven_english_state_with_qpa_inspector(
            &repo,
            &repo,
            &app,
            State {
                current_lang: "zh-Hant".to_string(),
                ..State::default()
            },
            vendor_reinstall_recovery,
        );
        assert_eq!(projected.current_lang, "en");
        assert_eq!(
            fs::read_to_string(app.join(crate::install::LANG_MARKER_NAME)).unwrap(),
            "zh-Hant\n",
            "read-only status projection must not mutate Program Files"
        );
    }

    #[test]
    fn invalid_manifest_recovery_is_rejected_before_english_snapshot_capture() {
        let temp = tempfile::tempdir().unwrap();
        let repo = temp.path().join("repo");
        let app = temp.path().join("Cavalry");
        write(&app.join("Cavalry.exe"), b"fixture executable");
        for (source, target) in crate::patch::CORE_MAP {
            write(
                &repo.join("languages/en").join(source),
                br#"{"value":"en"}"#,
            );
            write(&app.join("assets").join(target), br#"{"value":"en"}"#);
        }
        write(&app.join(crate::install::LANG_MARKER_NAME), b"en\n");

        let error = ensure_clean_english_install_with_qpa_inspector(
            &repo,
            &repo,
            &app,
            invalid_manifest_recovery,
        )
        .unwrap_err();

        assert!(error.contains("not proven stock"), "{error}");
    }
}
