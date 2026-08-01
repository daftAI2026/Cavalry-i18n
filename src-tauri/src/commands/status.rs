/**
 * [INPUT]: 依赖 context 路径/语言源、detect/install/state/patch 与 snapshot provenance 迁移。
 * [OUTPUT]: 提供状态解析、安装选择、权限探测、renderer StatusPayload/BrowsePayload。
 * [POS]: commands 的只读状态层；显示版本不参与 English snapshot 身份判定。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
use chrono::Utc;
use std::{
    fs,
    io::ErrorKind,
    path::{Path, PathBuf},
    process,
};

use crate::{
    detect,
    install::InstallLayout,
    patch, privilege,
    state::{self, State},
};

use super::{
    context::{
        language_choices_from_roots, language_root_candidates, next_staging_nonce, AppPaths,
    },
    contract::{BrowsePayload, BundleDiagnostics, StatusPayload},
    snapshot::migrate_legacy_snapshot_provenance,
};

fn platform_name() -> &'static str {
    #[cfg(target_os = "windows")]
    {
        return "windows";
    }
    #[cfg(target_os = "macos")]
    {
        return "macos";
    }
    #[allow(unreachable_code)]
    "unknown"
}

pub(crate) fn permission_action(app_path: &Path, granted: Option<bool>) -> &'static str {
    #[cfg(target_os = "macos")]
    {
        let _ = app_path;
        return if granted == Some(false) {
            "openPrivacy"
        } else {
            "none"
        };
    }
    #[cfg(target_os = "windows")]
    {
        return if granted == Some(false)
            && privilege::windows_elevation_supported_for_install(app_path)
        {
            "requestElevation"
        } else {
            "none"
        };
    }
    #[allow(unreachable_code)]
    {
        let _ = app_path;
        "none"
    }
}

pub(crate) fn sync_state_with_bundle(
    state_dir: &Path,
    state: State,
    app_path: &Path,
    version: &str,
    immutable_revision: &str,
) -> State {
    if app_path.as_os_str().is_empty() {
        return state;
    }
    let app_path = InstallLayout::from_selection(app_path)
        .map(|layout| layout.root)
        .unwrap_or_else(|_| app_path.to_path_buf());
    let app_path_text = app_path.to_string_lossy().to_string();
    let same_app = state.app_path == app_path_text;
    let same_revision = same_app
        && !immutable_revision.is_empty()
        && !state.cavalry_revision.is_empty()
        && state.cavalry_revision == immutable_revision;
    let legacy_same_version = same_app
        && state.cavalry_revision.is_empty()
        && !version.is_empty()
        && state.cavalry_version == version;
    let default_lang = if same_revision || legacy_same_version {
        state.current_lang.as_str()
    } else {
        "en"
    };
    let preserve_unproven_snapshot_revision =
        state.english_snapshot_provenance.is_none() && state_dir.join("en").is_dir();
    let next = state::normalize(State {
        app_path: app_path_text,
        cavalry_version: version.to_string(),
        cavalry_revision: if immutable_revision.is_empty() || preserve_unproven_snapshot_revision {
            state.cavalry_revision.clone()
        } else {
            immutable_revision.to_string()
        },
        current_lang: detect::read_installed_language(&app_path, default_lang),
        last_patched_at: state.last_patched_at.clone(),
        english_snapshot_provenance: state.english_snapshot_provenance.clone(),
    });
    if next == state {
        state
    } else if preserve_unproven_snapshot_revision {
        // 旧快照尚无 provenance 时，磁盘 app/version/revision 是唯一迁移证据；内容证明前不写入伪 provenance。
        next
    } else {
        state::write_state(state_dir, &next).unwrap_or(next)
    }
}

pub(crate) fn resolved_state(
    repo_root: &Path,
    state_dir: &Path,
    resource_dir: &Path,
    candidates: impl IntoIterator<Item = PathBuf>,
) -> (PathBuf, State, String, String) {
    let existing_state = state::read_state(state_dir).unwrap_or_default();
    let app_path = detect::find_cavalry_app_from_candidates(&existing_state.app_path, candidates);
    let version = detect::read_bundle_version(&app_path).unwrap_or_default();
    let immutable_revision = detect::read_bundle_revision(&app_path).unwrap_or_default();
    let state = sync_state_with_bundle(
        state_dir,
        existing_state.clone(),
        &app_path,
        &version,
        &immutable_revision,
    );
    let state = migrate_legacy_snapshot_provenance(
        repo_root,
        state_dir,
        resource_dir,
        &existing_state,
        state,
        &app_path,
        &version,
        &immutable_revision,
    );
    (app_path, state, version, immutable_revision)
}

pub(crate) fn status_for_paths(
    repo_root: &Path,
    state_dir: &Path,
    resource_dir: &Path,
    candidates: Vec<PathBuf>,
) -> StatusPayload {
    let language_roots = language_root_candidates(repo_root, resource_dir);
    let (app_path, state, version, immutable_revision) = resolved_state(
        repo_root,
        state_dir,
        resource_dir,
        candidates.iter().cloned(),
    );
    let diagnostics = if app_path.as_os_str().is_empty() {
        None
    } else {
        let info = detect::inspect_bundle(&app_path);
        Some(BundleDiagnostics {
            exists: info.exists,
            app_path: info.app_path,
            version: info.version,
            has_assets_root: info.has_assets_root,
            has_definitions: info.has_definitions,
            has_learn: info.has_learn,
            has_plugins: info.has_plugins,
        })
    };

    let permission_granted = probe_app_management_permission(&app_path);
    StatusPayload {
        app_management_granted: permission_granted,
        app_path: app_path.to_string_lossy().to_string(),
        current_lang: state.current_lang.clone(),
        default_app_candidates: candidates
            .into_iter()
            .map(|candidate| candidate.to_string_lossy().to_string())
            .collect(),
        diagnostics,
        languages: language_choices_from_roots(&language_roots),
        needs_extract: !app_path.as_os_str().is_empty()
            && patch::needs_english_snapshot(
                state_dir,
                state.english_snapshot_provenance.as_ref(),
                &app_path,
                &immutable_revision,
            ),
        permission_action: permission_action(&app_path, permission_granted).to_string(),
        platform: platform_name().to_string(),
        repo_root: repo_root.to_string_lossy().to_string(),
        version,
    }
}

pub(crate) fn get_status_for_app(app: &tauri::AppHandle) -> StatusPayload {
    let paths = AppPaths::for_app(app);
    status_for_paths(
        &paths.repo_root,
        &paths.state_dir,
        &paths.resource_dir,
        detect::default_app_candidates(),
    )
}

pub(crate) fn browse_for_app(app: &tauri::AppHandle) -> BrowsePayload {
    let Some(selection) = pick_cavalry_install() else {
        return canceled_browse();
    };
    let layout = match detect::resolve_install(&selection) {
        Ok(layout) => layout,
        Err(_) => return canceled_browse(),
    };
    let path = layout.root;
    let version = detect::read_bundle_version(&path).unwrap_or_default();
    let immutable_revision = detect::read_bundle_revision(&path).unwrap_or_default();
    let state_dir = super::context::state_dir_for_app(app);
    let previous = state::read_state(&state_dir).unwrap_or_default();
    let _ = sync_state_with_bundle(&state_dir, previous, &path, &version, &immutable_revision);
    BrowsePayload {
        canceled: false,
        app_path: path.to_string_lossy().to_string(),
        version,
    }
}

fn canceled_browse() -> BrowsePayload {
    BrowsePayload {
        canceled: true,
        app_path: String::new(),
        version: String::new(),
    }
}

fn pick_cavalry_install() -> Option<PathBuf> {
    #[cfg(target_os = "macos")]
    {
        return rfd::FileDialog::new()
            .set_title("Select Cavalry.app")
            .set_directory("/Applications")
            .add_filter("Applications", &["app"])
            .pick_file();
    }
    #[cfg(target_os = "windows")]
    {
        let initial_directory = detect::default_app_candidates()
            .into_iter()
            .find(|candidate| candidate.exists())
            .unwrap_or_else(|| {
                std::env::var_os("ProgramW6432")
                    .map(PathBuf::from)
                    .unwrap_or_default()
            });
        return rfd::FileDialog::new()
            .set_title("Select Cavalry.exe")
            .set_directory(initial_directory)
            .add_filter("Cavalry executable", &["exe"])
            .pick_file();
    }
    #[allow(unreachable_code)]
    None
}

pub(crate) fn is_app_management_error(error: &str) -> bool {
    let lower = error.to_ascii_lowercase();
    if lower.contains("outside windows known program files roots")
        || lower.contains("administrator retry is available only for installations under the os-known program files folders")
    {
        return false;
    }
    lower.contains("not authorized to send apple events")
        || lower.contains("app management")
        || lower.contains("administrator copy failed")
        || lower.contains("operation was canceled by the user")
        || lower.contains("operation was cancelled by the user")
        || lower.contains("error 1223")
        || ((lower.contains("operation not permitted") || lower.contains("privacy"))
            && (error.contains(".app") || error.contains("/Applications/")))
}

fn probe_app_management_permission(app_path: &Path) -> Option<bool> {
    if app_path.as_os_str().is_empty() {
        return None;
    }
    let layout = InstallLayout::from_selection(app_path).ok()?;
    #[cfg(target_os = "macos")]
    let probe_dir = layout
        .language_marker
        .parent()
        .map(Path::to_path_buf)
        .unwrap_or_else(|| layout.root.clone());
    #[cfg(target_os = "windows")]
    let probe_dir = layout.assets_root;
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    let probe_dir = layout.root;
    if !probe_dir.is_dir() {
        return None;
    }

    let probe_path = probe_dir.join(format!(
        ".cavalry-i18n-probe-{}-{}-{}",
        process::id(),
        Utc::now().timestamp_millis(),
        next_staging_nonce()
    ));
    let granted = match fs::write(&probe_path, []) {
        Ok(()) => Some(true),
        Err(error) if error.kind() == ErrorKind::PermissionDenied => Some(false),
        Err(_) => None,
    };
    let _ = fs::remove_file(&probe_path);
    granted
}
