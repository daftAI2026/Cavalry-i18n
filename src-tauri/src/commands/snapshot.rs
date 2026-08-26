/**
 * [INPUT]: 依赖 detect/install/patch/state、Windows QPA 只读证据、CommandRunner 与 context 的 packaged language source 定位。
 * [OUTPUT]: 提供 clean-English 证明、stale marker/runtime 分类、只读 English 状态投影、由单次采集快照 gate 返回分类的 typed reconciliationRequired 标记、显式 state-directory durability retry、legacy provenance 迁移及 apply 前快照门。
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
    context::language_source_dir,
    contract::ActionPayload,
    status::{project_state_with_bundle, read_state_for_mutation},
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

/// Resolve the platform's durable English truth. macOS has no standalone current pointer: the
/// state provenance must select one unified vendor generation containing both English JSON and
/// official runtime preimages. Windows retains the standalone immutable-generation protocol.
pub(crate) fn needs_english_snapshot(
    state_dir: &Path,
    provenance: Option<&EnglishSnapshotProvenance>,
    app_path: &Path,
    immutable_revision: &str,
) -> bool {
    #[cfg(target_os = "macos")]
    if InstallLayout::from_root(app_path).platform == InstallPlatform::Macos {
        return crate::mac_official::provenance_needs_refresh(
            state_dir,
            provenance,
            app_path,
            immutable_revision,
        );
    }
    patch::needs_english_snapshot(state_dir, provenance, app_path, immutable_revision)
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
    #[cfg(target_os = "macos")]
    if layout.platform == InstallPlatform::Macos {
        crate::mac_official::verify_clean_vendor_runtime(&layout.root)?;
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
pub(crate) fn project_legacy_snapshot_provenance(
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
    // A legacy macOS JSON generation and a separately captured runtime directory must never be
    // stitched together after the fact. Only a clean vendor install may be recaptured into the
    // unified generation protocol.
    #[cfg(target_os = "macos")]
    if InstallLayout::from_root(app_path).platform == InstallPlatform::Macos {
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
    let Ok(identity) = patch::english_snapshot_identity(state_dir, app_path, immutable_revision)
    else {
        return current;
    };

    current.english_snapshot_provenance = Some(EnglishSnapshotProvenance {
        install_root: app_path.to_string_lossy().to_string(),
        immutable_revision: immutable_revision.to_string(),
        snapshot_generation: Some(identity.generation),
        snapshot_manifest_sha256: Some(identity.manifest_sha256),
        vendor_baseline_id: None,
    });
    current.cavalry_revision = immutable_revision.to_string();
    current
}

fn capture_clean_english_snapshot<R: CommandRunner>(
    repo_root: &Path,
    state_dir: &Path,
    resource_dir: &Path,
    state: State,
    app_path: &Path,
    immutable_revision: &str,
    runner: &mut R,
) -> Result<(usize, State, Option<String>), String> {
    let ensure_clean = |repo_root: &Path, resource_dir: &Path, app_path: &Path| {
        ensure_clean_english_install(repo_root, resource_dir, app_path)
    };
    capture_clean_english_snapshot_with_check(
        repo_root,
        state_dir,
        resource_dir,
        state,
        app_path,
        immutable_revision,
        runner,
        &ensure_clean,
    )
    .map(|(count, state, warning, _disposition)| (count, state, warning))
}

fn capture_clean_english_snapshot_with_check<R, F>(
    repo_root: &Path,
    state_dir: &Path,
    resource_dir: &Path,
    state: State,
    app_path: &Path,
    immutable_revision: &str,
    runner: &mut R,
    ensure_clean: &F,
) -> Result<(usize, State, Option<String>, CleanEnglishDisposition), String>
where
    R: CommandRunner,
    F: Fn(&Path, &Path, &Path) -> Result<CleanEnglishDisposition, String>,
{
    if immutable_revision.is_empty() {
        return Err(
            "English extraction refused: Cavalry immutable revision could not be established."
                .to_string(),
        );
    }
    let disposition = ensure_clean(repo_root, resource_dir, app_path)?;
    #[cfg(target_os = "macos")]
    if InstallLayout::from_root(app_path).platform == InstallPlatform::Macos {
        let english_source = language_source_dir(repo_root, resource_dir, "en");
        let prepared = crate::mac_official::prepare_or_reuse_vendor_baseline(
            state_dir,
            &english_source,
            app_path,
            immutable_revision,
            runner,
        )?;
        let candidate = State {
            app_path: app_path.to_string_lossy().to_string(),
            cavalry_revision: immutable_revision.to_string(),
            current_lang: "en".to_string(),
            english_snapshot_provenance: Some(EnglishSnapshotProvenance {
                install_root: app_path.to_string_lossy().to_string(),
                immutable_revision: immutable_revision.to_string(),
                snapshot_generation: Some(prepared.generation),
                snapshot_manifest_sha256: Some(prepared.english_manifest_sha256),
                vendor_baseline_id: Some(prepared.vendor_baseline_id),
            }),
            ..state.clone()
        };
        let (next, warning) = commit_or_confirm_snapshot_state(state_dir, state, candidate)?;
        return Ok((prepared.english_count, next, warning, disposition));
    }

    #[cfg(not(target_os = "macos"))]
    let _ = runner;
    let capture =
        patch::extract_english_generation_with_identity(app_path, state_dir, immutable_revision)?;
    if !patch::validate_english_snapshot_manifest(state_dir, app_path)? {
        return Err("English snapshot generation did not pass its manifest gate.".to_string());
    }
    let outcome = state::write_state_outcome(
        state_dir,
        &State {
            app_path: app_path.to_string_lossy().to_string(),
            cavalry_revision: immutable_revision.to_string(),
            current_lang: "en".to_string(),
            english_snapshot_provenance: Some(EnglishSnapshotProvenance {
                install_root: app_path.to_string_lossy().to_string(),
                immutable_revision: immutable_revision.to_string(),
                snapshot_generation: Some(capture.identity.generation),
                snapshot_manifest_sha256: Some(capture.identity.manifest_sha256),
                vendor_baseline_id: None,
            }),
            ..state
        },
    )?;
    let warning = outcome.warning().map(ToString::to_string);
    Ok((capture.count, outcome.into_state(), warning, disposition))
}

fn commit_or_confirm_snapshot_state(
    state_dir: &Path,
    current: State,
    candidate: State,
) -> Result<(State, Option<String>), String> {
    commit_or_confirm_snapshot_state_with(
        state_dir,
        current,
        candidate,
        state::confirm_state_directory_durability,
    )
}

fn commit_or_confirm_snapshot_state_with<F>(
    state_dir: &Path,
    current: State,
    candidate: State,
    confirm_durability: F,
) -> Result<(State, Option<String>), String>
where
    F: FnOnce(&Path) -> Result<Option<state::StateWriteWarning>, String>,
{
    if candidate == current {
        let warning = confirm_durability(state_dir)?.map(|warning| warning.to_string());
        return Ok((current, warning));
    }
    let outcome = state::write_state_outcome(state_dir, &candidate)?;
    let warning = outcome.warning().map(ToString::to_string);
    Ok((outcome.into_state(), warning))
}

pub fn extract_english_inner(
    repo_root: &Path,
    state_dir: &Path,
    resource_dir: &Path,
    app_path: &Path,
) -> Result<usize, String> {
    let mut runner = crate::privilege::RealCommandRunner;
    extract_english_inner_with_runner(repo_root, state_dir, resource_dir, app_path, &mut runner)
        .map(|(count, _warning)| count)
}

fn extract_english_inner_with_runner<R: CommandRunner>(
    repo_root: &Path,
    state_dir: &Path,
    resource_dir: &Path,
    app_path: &Path,
    runner: &mut R,
) -> Result<(usize, Option<String>), String> {
    let ensure_clean = |repo_root: &Path, resource_dir: &Path, app_path: &Path| {
        ensure_clean_english_install(repo_root, resource_dir, app_path)
    };
    extract_english_inner_with_runner_and_check(
        repo_root,
        state_dir,
        resource_dir,
        app_path,
        runner,
        &ensure_clean,
    )
    .map(|(count, warning, _disposition)| (count, warning))
}

fn extract_english_inner_with_runner_and_check<R, F>(
    repo_root: &Path,
    state_dir: &Path,
    resource_dir: &Path,
    app_path: &Path,
    runner: &mut R,
    ensure_clean: &F,
) -> Result<(usize, Option<String>, CleanEnglishDisposition), String>
where
    R: CommandRunner,
    F: Fn(&Path, &Path, &Path) -> Result<CleanEnglishDisposition, String>,
{
    #[cfg(target_os = "macos")]
    crate::privilege::recover_macos_apply_for_selection(state_dir, app_path, runner)?;
    let app_path = detect::resolve_verified_install(app_path)
        .map_err(|error| error.to_string())?
        .root;
    let version = detect::read_bundle_version(&app_path).unwrap_or_default();
    let immutable_revision =
        detect::read_bundle_revision_for_write(&app_path).map_err(|error| error.to_string())?;
    let current_state = project_state_with_bundle(
        state_dir,
        read_state_for_mutation(state_dir)?,
        &app_path,
        &version,
        &immutable_revision,
    );
    let (count, _, warning, disposition) = capture_clean_english_snapshot_with_check(
        repo_root,
        state_dir,
        resource_dir,
        current_state,
        &app_path,
        &immutable_revision,
        runner,
        ensure_clean,
    )?;
    Ok((count, warning, disposition))
}

pub(crate) fn refresh_english_inner<R: CommandRunner>(
    repo_root: &Path,
    state_dir: &Path,
    resource_dir: &Path,
    app_path: &Path,
    runner: &mut R,
    now: &str,
) -> Result<ActionPayload, String> {
    #[cfg(target_os = "macos")]
    crate::privilege::recover_macos_apply_for_selection(state_dir, app_path, runner)?;
    let app_path = detect::resolve_verified_install(app_path)
        .map_err(|error| error.to_string())?
        .root;
    let _ = now;
    let ensure_clean = |repo_root: &Path, resource_dir: &Path, app_path: &Path| {
        ensure_clean_english_install(repo_root, resource_dir, app_path)
    };
    refresh_english_inner_with_clean_check(
        repo_root,
        state_dir,
        resource_dir,
        &app_path,
        runner,
        &ensure_clean,
    )
}

fn refresh_english_inner_with_clean_check<R, F>(
    repo_root: &Path,
    state_dir: &Path,
    resource_dir: &Path,
    app_path: &Path,
    runner: &mut R,
    ensure_clean: &F,
) -> Result<ActionPayload, String>
where
    R: CommandRunner,
    F: Fn(&Path, &Path, &Path) -> Result<CleanEnglishDisposition, String>,
{
    let (count, state_warning, disposition) = extract_english_inner_with_runner_and_check(
        repo_root,
        state_dir,
        resource_dir,
        app_path,
        runner,
        ensure_clean,
    )?;
    let mut payload = ActionPayload::ok_count(count);
    payload.warning = state_warning;
    payload.reconciliation_required =
        disposition == CleanEnglishDisposition::NeedsWindowsReconciliation;
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

pub(crate) fn extract_english_snapshot_or_throw<R: CommandRunner>(
    repo_root: &Path,
    state_dir: &Path,
    resource_dir: &Path,
    state: State,
    app_path: &Path,
    immutable_revision: &str,
    runner: &mut R,
) -> Result<State, String> {
    #[cfg(target_os = "macos")]
    if InstallLayout::from_root(app_path).platform == InstallPlatform::Macos
        && crate::mac_official::verify_clean_vendor_runtime(app_path).is_ok()
    {
        // Even an apparently current generation is compared with the fresh ExtensionLayer,
        // normalized/raw main identity, codesign identity, runtime absences and English manifest.
        let (_, state, _) = capture_clean_english_snapshot(
            repo_root,
            state_dir,
            resource_dir,
            state,
            app_path,
            immutable_revision,
            runner,
        )?;
        return Ok(state);
    }
    if !needs_english_snapshot(
        state_dir,
        state.english_snapshot_provenance.as_ref(),
        app_path,
        immutable_revision,
    ) {
        return Ok(state);
    }
    let (_, state, _) = capture_clean_english_snapshot(
        repo_root,
        state_dir,
        resource_dir,
        state,
        app_path,
        immutable_revision,
        runner,
    )?;
    Ok(state)
}

#[cfg(test)]
mod snapshot_state_tests {
    use super::*;

    #[test]
    fn unchanged_snapshot_reconfirms_directory_durability_and_surfaces_failure() {
        let temp = tempfile::tempdir().unwrap();
        let current = State {
            app_path: "/Applications/Cavalry.app".to_string(),
            cavalry_revision: "revision".to_string(),
            ..State::default()
        };
        let mut called = false;
        let (next, warning) = commit_or_confirm_snapshot_state_with(
            temp.path(),
            current.clone(),
            current.clone(),
            |path| {
                called = true;
                Ok(Some(state::StateWriteWarning::DirectorySyncAfterCommit {
                    directory: path.to_path_buf(),
                    detail: "injected retry fsync failure".to_string(),
                }))
            },
        )
        .unwrap();

        assert!(called, "no-op snapshot must execute the durability retry");
        assert_eq!(next, current);
        assert!(warning
            .as_deref()
            .is_some_and(|warning| warning.contains("injected retry fsync failure")));
        assert!(temp.path().read_dir().unwrap().next().is_none());
    }
}

#[cfg(all(test, target_os = "windows"))]
mod windows_reconciliation_tests {
    use super::*;
    use std::cell::Cell;
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
    fn refresh_returns_reconciliation_without_using_runner_or_mutating_install() {
        let temp = tempfile::tempdir().unwrap();
        let repo = temp.path().join("repo");
        let state = temp.path().join("state");
        let app = temp.path().join("Cavalry");
        write(&app.join("Cavalry.exe"), b"fixture executable");
        for (source, target) in crate::patch::CORE_MAP {
            write(
                &repo.join("languages/en").join(source),
                br#"{"value":"en"}"#,
            );
            write(&app.join("assets").join(target), br#"{"value":"en"}"#);
        }
        let marker = app.join(crate::install::LANG_MARKER_NAME);
        write(&marker, b"zh-Hant\n");
        let qwindows = app.join(crate::windows_qpa::QWINDOWS_FILE_NAME);
        let generic = app.join(crate::windows_qpa::GENERIC_PLUGIN_RELATIVE_PATH);
        let recovery_sentinel = app
            .join(crate::windows_qpa::RECOVERY_DIRECTORY_NAME)
            .join("sentinel");
        write(&qwindows, b"vendor qwindows");
        write(&generic, b"owned generic");
        write(&recovery_sentinel, b"owned recovery evidence");
        let mut install_files = vec![app.join("Cavalry.exe"), marker.clone()];
        install_files.extend(
            crate::patch::CORE_MAP
                .iter()
                .map(|(_, target)| app.join("assets").join(target)),
        );
        install_files.extend([qwindows, generic, recovery_sentinel]);
        let install_before = install_files
            .iter()
            .map(fs::read)
            .collect::<Result<Vec<_>, _>>()
            .unwrap();

        let ensure_clean = |_repo_root: &Path,
                            _resource_dir: &Path,
                            _app_path: &Path|
         -> Result<CleanEnglishDisposition, String> {
            Ok(CleanEnglishDisposition::NeedsWindowsReconciliation)
        };
        let mut runner = crate::privilege::RecordingRunner::default();
        let payload = refresh_english_inner_with_clean_check(
            &repo,
            &state,
            &repo,
            &app,
            &mut runner,
            &ensure_clean,
        )
        .unwrap();

        assert!(payload.ok);
        assert_eq!(payload.reconciliation_required, true);
        assert!(
            runner.commands.is_empty(),
            "refresh must not run system commands"
        );
        let install_after = install_files
            .iter()
            .map(fs::read)
            .collect::<Result<Vec<_>, _>>()
            .unwrap();
        assert_eq!(
            install_after, install_before,
            "refresh must not write installation/runtime files"
        );
    }

    #[test]
    fn refresh_uses_one_snapshot_gate_and_surfaces_that_disposition() {
        let temp = tempfile::tempdir().unwrap();
        let repo = temp.path().join("repo");
        let state = temp.path().join("state");
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

        let checks = Cell::new(0usize);
        let ensure_clean = |_repo_root: &Path,
                            _resource_dir: &Path,
                            _app_path: &Path|
         -> Result<CleanEnglishDisposition, String> {
            let count = checks.get();
            checks.set(count + 1);
            assert_eq!(count, 0, "refresh must use one snapshot gate");
            Ok(CleanEnglishDisposition::NeedsWindowsReconciliation)
        };
        let mut runner = crate::privilege::RecordingRunner::default();
        let payload = refresh_english_inner_with_clean_check(
            &repo,
            &state,
            &repo,
            &app,
            &mut runner,
            &ensure_clean,
        )
        .unwrap();

        assert_eq!(checks.get(), 1);
        assert!(payload.reconciliation_required);
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
