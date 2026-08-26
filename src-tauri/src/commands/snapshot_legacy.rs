/**
 * [INPUT]: 依赖 snapshot 的 packaged English source 定位、patch 的 legacy/immutable snapshot gate、install identity 与 Windows QPA 只读证据。
 * [OUTPUT]: 提供 legacy provenance 完整性判定、只读旧快照可信识别，以及 apply 阶段的 immutable generation 迁移。
 * [POS]: commands 的兼容迁移子模块；status 只消费纯证明，apply/restore 才接管 generation 发布与 provenance 落盘，绝不从当前翻译安装反向生成英文备份。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
use std::path::Path;

use crate::{
    install::{InstallLayout, InstallPlatform},
    patch,
    state::{EnglishSnapshotProvenance, State},
};

use super::super::context::language_source_dir;

pub(crate) fn has_complete_snapshot_identity(provenance: &EnglishSnapshotProvenance) -> bool {
    provenance.snapshot_generation.is_some() && provenance.snapshot_manifest_sha256.is_some()
}

fn legacy_state_matches_install(
    current: &State,
    app_path: &Path,
    immutable_revision: &str,
) -> bool {
    if current.app_path != app_path.to_string_lossy().as_ref()
        || current.cavalry_revision != immutable_revision
    {
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
            || provenance.immutable_revision == immutable_revision)
}

/// Read-only proof used by status projection. It accepts only a legacy state/snapshot that still
/// names this exact install and revision, matches the packaged English keyed overlay, and has a
/// hash-locked Windows runtime with a durable vendor backup. No generation or state file is
/// published here; apply owns that mutation.
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
                return qpa_inspection_proves_vendor_backup(&inspection);
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
    if app_path.as_os_str().is_empty()
        || immutable_revision.is_empty()
        || !legacy_state_matches_install(current, app_path, immutable_revision)
    {
        return false;
    }
    #[cfg(target_os = "macos")]
    if InstallLayout::from_root(app_path).platform == InstallPlatform::Macos {
        return false;
    }

    let english_source = language_source_dir(repo_root, resource_dir, "en");
    if !matches!(
        patch::legacy_snapshot_matches_language_source(&english_source, state_dir, app_path),
        Ok(true)
    ) {
        return false;
    }
    runtime_is_proven(app_path)
}

#[cfg(target_os = "windows")]
fn qpa_inspection_proves_vendor_backup(inspection: &crate::windows_qpa::QpaInspection) -> bool {
    matches!(
        inspection.state,
        crate::windows_qpa::QpaDeploymentState::Active
            | crate::windows_qpa::QpaDeploymentState::Recover
    ) && (inspection.state != crate::windows_qpa::QpaDeploymentState::Recover
        || inspection.phase.is_some())
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
            inspect_qpa(&layout)
                .ok()
                .is_some_and(|inspection| qpa_inspection_proves_vendor_backup(&inspection))
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
    let english_source = language_source_dir(repo_root, resource_dir, "en");
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
