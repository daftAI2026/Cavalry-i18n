/**
 * [INPUT]: 依赖 detect/install/patch/state 和 context 的 packaged language source 定位。
 * [OUTPUT]: 提供 clean-English 证明、legacy provenance 迁移、快照提取及 apply 前快照门。
 * [POS]: commands 的 English snapshot 身份层；只在 packaged-English 内容证明后写入 provenance。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
use std::{fs, io::ErrorKind, path::Path};

use crate::{
    detect,
    install::{InstallLayout, InstallPlatform},
    patch,
    state::{self, EnglishSnapshotProvenance, State},
};

use super::{context::language_source_dir, status::sync_state_with_bundle};

pub(crate) fn ensure_clean_english_install(
    repo_root: &Path,
    resource_dir: &Path,
    app_path: &Path,
) -> Result<(), String> {
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
    Ok(())
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
