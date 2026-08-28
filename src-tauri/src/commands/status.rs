/**
 * [INPUT]: 依赖 context 路径/语言源、detect/install/state/patch、startup recovery 诊断与 snapshot 安装真相/provenance 迁移。
 * [OUTPUT]: 提供状态解析、pending macOS recovery 的零写入阻断 payload、stale Windows marker 的只读 English 投影与每次 status 重算的 reconciliationRequired、安装选择、Windows 权限探测与 renderer payload。
 * [POS]: commands 的状态层；pending recovery 时禁止普通同步写入，macOS 轮询始终只读且不以探针文件破坏 bundle seal，Windows typed reconciliation 不依赖一次会话内存。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#[cfg(not(target_os = "macos"))]
use chrono::Utc;
#[cfg(not(target_os = "macos"))]
use std::fs;
use std::path::{Path, PathBuf};
#[cfg(not(target_os = "macos"))]
use std::{io::ErrorKind, process};

use crate::{
    detect,
    install::InstallLayout,
    privilege,
    state::{self, State},
};

use super::{
    context::{language_choices_from_roots, language_root_candidates, AppPaths},
    contract::{BrowsePayload, BundleDiagnostics, StatusPayload},
    snapshot::{
        ensure_clean_english_install, project_legacy_snapshot_provenance, CleanEnglishDisposition,
    },
};

#[cfg(not(target_os = "macos"))]
use super::context::next_staging_nonce;

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

fn installation_mode(app_path: &Path) -> &'static str {
    if app_path.as_os_str().is_empty() {
        return "unknown";
    }
    #[cfg(target_os = "macos")]
    {
        let mut runner = privilege::RealCommandRunner;
        return installation_mode_with_runner(app_path, &mut runner);
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = app_path;
        "unknown"
    }
}

#[cfg(target_os = "macos")]
fn installation_mode_with_runner<R: privilege::CommandRunner>(
    app_path: &Path,
    runner: &mut R,
) -> &'static str {
    if detect::require_supported_mac_identity(app_path).is_err()
        || crate::mac_official::verify_clean_vendor_runtime(app_path).is_err()
    {
        return "modifiedOrUnverified";
    }
    match privilege::inspect_bundle_signature(app_path, runner) {
        Ok(signature) if signature.is_supported_cavalry_vendor_identity() => "official",
        _ => "modifiedOrUnverified",
    }
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
) -> Result<State, String> {
    let next = project_state_with_bundle(
        state_dir,
        state.clone(),
        app_path,
        version,
        immutable_revision,
    );
    if next == state {
        Ok(state)
    } else {
        let outcome = state::write_state_outcome(state_dir, &next)?;
        if let Some(warning) = outcome.warning() {
            return Err(format!(
                "Application state changed, but its directory durability could not be confirmed: {warning}. Retry before continuing."
            ));
        }
        Ok(outcome.into_state())
    }
}

/// Mutation callers must not silently continue after control-state recovery.  The typed state
/// layer has already promoted the last-known-good generation when this returns a diagnostic; we
/// surface that fact and require one retry so no bundle mutation shares a turn with state repair
/// or a post-rename durability warning.
pub(crate) fn read_state_for_mutation(state_dir: &Path) -> Result<State, String> {
    let report =
        state::read_state_for_control_report(state_dir).map_err(|error| error.to_string())?;
    if let Some(diagnostic) = report.recovery_diagnostic.as_deref() {
        let durability = report
            .recovery_warning()
            .map(|warning| format!(" Durability warning: {warning}"))
            .unwrap_or_default();
        return Err(format!(
            "Durable application state was recovered before this operation: {diagnostic}.{durability} Retry the operation after reviewing the recovered selection."
        ));
    }
    Ok(report.state)
}

pub(crate) fn project_state_with_bundle(
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
    next
}

pub(crate) fn resolved_state(
    repo_root: &Path,
    state_dir: &Path,
    resource_dir: &Path,
    candidates: impl IntoIterator<Item = PathBuf>,
) -> Result<
    (
        PathBuf,
        State,
        String,
        String,
        Option<CleanEnglishDisposition>,
    ),
    String,
> {
    let existing_state = read_state_projection(state_dir)?;
    let discovered = detect::find_cavalry_app_from_candidates(&existing_state.app_path, candidates);
    let app_path = if discovered.as_os_str().is_empty() {
        discovered
    } else {
        detect::resolve_verified_install(&discovered)
            .map_err(|error| format!("Selected Cavalry identity is not supported: {error}"))?
            .root
    };
    let version = detect::read_bundle_version(&app_path)
        .map_err(|error| format!("Could not read selected Cavalry display version: {error}"))?;
    let immutable_revision = detect::read_bundle_revision(&app_path)
        .map_err(|error| format!("Could not establish selected Cavalry identity: {error}"))?;
    let state = project_state_with_bundle(
        state_dir,
        existing_state.clone(),
        &app_path,
        &version,
        &immutable_revision,
    );
    let mut state = project_legacy_snapshot_provenance(
        repo_root,
        state_dir,
        resource_dir,
        &existing_state,
        state,
        &app_path,
        &version,
        &immutable_revision,
    );
    let clean_disposition = ensure_clean_english_install(repo_root, resource_dir, &app_path).ok();
    if clean_disposition.is_some() {
        state.current_lang = "en".to_string();
    }
    Ok((
        app_path,
        state,
        version,
        immutable_revision,
        clean_disposition,
    ))
}

fn read_state_projection(state_dir: &Path) -> Result<State, String> {
    match state::read_state_with_recovery(state_dir) {
        Ok(report) => Ok(report.document.state),
        Err(state::StateReadError::RecoveryFailed { current, previous })
            if matches!(*current, state::StateReadError::Missing { .. })
                && matches!(*previous, state::StateReadError::Missing { .. }) =>
        {
            Ok(State::default())
        }
        Err(error) => Err(format!(
            "could not project durable application state: {error}"
        )),
    }
}

pub(crate) fn status_for_paths(
    repo_root: &Path,
    state_dir: &Path,
    resource_dir: &Path,
    candidates: Vec<PathBuf>,
) -> Result<StatusPayload, String> {
    let language_roots = language_root_candidates(repo_root, resource_dir);
    let (app_path, state, version, immutable_revision, clean_disposition) = resolved_state(
        repo_root,
        state_dir,
        resource_dir,
        candidates.iter().cloned(),
    )?;
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
    #[cfg(not(target_os = "windows"))]
    let _ = clean_disposition;
    let reconciliation_required = {
        #[cfg(target_os = "windows")]
        {
            matches!(
                clean_disposition,
                Some(CleanEnglishDisposition::NeedsWindowsReconciliation)
            )
        }
        #[cfg(not(target_os = "windows"))]
        {
            false
        }
    };
    let needs_extract = !app_path.as_os_str().is_empty()
        && super::snapshot::needs_english_snapshot(
            state_dir,
            state.english_snapshot_provenance.as_ref(),
            &app_path,
            &immutable_revision,
        )
        && !super::snapshot::legacy_snapshot_is_proven(
            repo_root,
            state_dir,
            resource_dir,
            &state,
            &app_path,
            &immutable_revision,
        );
    Ok(StatusPayload {
        app_management_granted: permission_granted,
        app_path: app_path.to_string_lossy().to_string(),
        current_lang: state.current_lang.clone(),
        installation_mode: installation_mode(&app_path).to_string(),
        startup_recovery_error: None,
        default_app_candidates: candidates
            .into_iter()
            .map(|candidate| candidate.to_string_lossy().to_string())
            .collect(),
        diagnostics,
        languages: language_choices_from_roots(&language_roots),
        needs_extract,
        permission_action: permission_action(&app_path, permission_granted).to_string(),
        platform: platform_name().to_string(),
        reconciliation_required,
        repo_root: repo_root.to_string_lossy().to_string(),
        version,
    })
}

pub(crate) fn get_status_for_app(
    app: &tauri::AppHandle,
    startup_recovery_error: Option<String>,
) -> Result<StatusPayload, String> {
    let paths = AppPaths::for_app(app);
    let candidates = detect::default_app_candidates();
    if let Some(error) = startup_recovery_error {
        return Ok(startup_recovery_blocked_status(&paths, candidates, error));
    }
    #[cfg(target_os = "macos")]
    match privilege::pending_macos_apply_install_root(&paths.state_dir) {
        Ok(Some(root)) => {
            return Ok(startup_recovery_blocked_status(
                &paths,
                candidates,
                format!(
                    "A pending macOS language transaction for {} must be recovered before continuing.",
                    root.display()
                ),
            ));
        }
        Err(error) => {
            return Ok(startup_recovery_blocked_status(&paths, candidates, error));
        }
        Ok(None) => {}
    }
    status_for_paths(
        &paths.repo_root,
        &paths.state_dir,
        &paths.resource_dir,
        candidates,
    )
}

fn startup_recovery_blocked_status(
    paths: &AppPaths,
    candidates: Vec<PathBuf>,
    error: String,
) -> StatusPayload {
    let durable_state = state::read_state_strict(&paths.state_dir).ok();
    #[cfg(target_os = "macos")]
    let pending_root = privilege::pending_macos_apply_install_root(&paths.state_dir)
        .ok()
        .flatten();
    #[cfg(not(target_os = "macos"))]
    let pending_root: Option<PathBuf> = None;
    let app_path = pending_root.unwrap_or_else(|| {
        durable_state
            .as_ref()
            .map(|state| PathBuf::from(&state.app_path))
            .unwrap_or_default()
    });
    let current_lang = durable_state
        .as_ref()
        .map(|state| state.current_lang.clone())
        .unwrap_or_else(|| "en".to_string());
    let version = detect::read_bundle_version(&app_path).unwrap_or_default();
    let language_roots = language_root_candidates(&paths.repo_root, &paths.resource_dir);
    StatusPayload {
        app_management_granted: None,
        app_path: app_path.to_string_lossy().to_string(),
        current_lang,
        installation_mode: "recoveryRequired".to_string(),
        startup_recovery_error: Some(error),
        default_app_candidates: candidates
            .into_iter()
            .map(|candidate| candidate.to_string_lossy().to_string())
            .collect(),
        diagnostics: None,
        languages: language_choices_from_roots(&language_roots),
        needs_extract: true,
        permission_action: "none".to_string(),
        platform: platform_name().to_string(),
        reconciliation_required: false,
        repo_root: paths.repo_root.to_string_lossy().to_string(),
        version,
    }
}

pub(crate) fn browse_for_app(app: &tauri::AppHandle) -> Result<BrowsePayload, String> {
    let Some(selection) = pick_cavalry_install() else {
        return Ok(canceled_browse());
    };
    let state_dir = super::context::state_dir_for_app(app);
    let _guard = crate::operation_lock::try_begin_bundle_operation(&state_dir)?;
    #[cfg(target_os = "macos")]
    if privilege::pending_macos_apply_install_root(&state_dir)?.is_some() {
        return Err(
            "A pending macOS language transaction must be recovered before changing the selected installation."
                .to_string(),
        );
    }
    let layout = detect::resolve_verified_install(&selection).map_err(|error| error.to_string())?;
    let path = layout.root;
    let version = detect::read_bundle_version(&path).unwrap_or_default();
    let immutable_revision =
        detect::read_bundle_revision_for_write(&path).map_err(|error| error.to_string())?;
    let previous = read_state_for_mutation(&state_dir)?;
    sync_state_with_bundle(&state_dir, previous, &path, &version, &immutable_revision)?;
    Ok(BrowsePayload {
        canceled: false,
        app_path: path.to_string_lossy().to_string(),
        version,
    })
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

    // A status read must never write inside a signed macOS app bundle. The real
    // apply transaction reports App Management denial through its typed error
    // path, after all identity and recovery preconditions have passed.
    #[cfg(target_os = "macos")]
    {
        let _ = app_path;
        return None;
    }

    #[cfg(not(target_os = "macos"))]
    {
        let layout = InstallLayout::from_selection(app_path).ok()?;
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
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[cfg(target_os = "macos")]
    fn write_clean_bundle(app: &Path) {
        use crate::keychain_patch;

        let mut info = plist::Dictionary::new();
        for (key, value) in [
            ("CFBundleIdentifier", "com.scenegroup.cavalry"),
            ("CFBundleShortVersionString", "2.7.2"),
            ("CFBundleVersion", "2.7.2"),
            ("CFBundleExecutable", "Cavalry"),
        ] {
            info.insert(key.to_string(), plist::Value::String(value.to_string()));
        }
        fs::create_dir_all(app.join("Contents/MacOS")).unwrap();
        fs::create_dir_all(app.join("Contents/Frameworks")).unwrap();
        fs::create_dir_all(app.join("Contents/Resources")).unwrap();
        fs::create_dir_all(app.join("Contents/_CodeSignature")).unwrap();
        fs::create_dir_all(app.join("Contents/assets/Definitions")).unwrap();
        fs::create_dir_all(app.join("Contents/assets/Plugins")).unwrap();
        plist::Value::Dictionary(info)
            .to_file_xml(app.join("Contents/Info.plist"))
            .unwrap();
        let mut main = vec![0_u8; 32];
        main[0..4].copy_from_slice(&0xfeedfacf_u32.to_le_bytes());
        main[4..8].copy_from_slice(&0x0100_000c_u32.to_le_bytes());
        fs::write(app.join("Contents/MacOS/Cavalry"), main).unwrap();
        fs::write(
            app.join("Contents/Frameworks/libExtensionLayer.dylib"),
            keychain_patch::build_synthetic_keychain_dylib(Some("arm64"), false),
        )
        .unwrap();
        fs::write(
            app.join("Contents/_CodeSignature/CodeResources"),
            b"vendor code resources",
        )
        .unwrap();
        fs::write(
            app.join("Contents/assets/Definitions/appStrings.json"),
            br#"{"value":"en"}"#,
        )
        .unwrap();
        fs::write(
            app.join("Contents/assets/Definitions/nodeStrings.json"),
            br#"{"value":"en"}"#,
        )
        .unwrap();
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn macos_status_permission_probe_is_read_only() {
        let temp = tempfile::tempdir().unwrap();
        let app = temp.path().join("Cavalry.app");
        let resources = app.join("Contents/Resources");
        fs::create_dir_all(&resources).unwrap();

        assert_eq!(probe_app_management_permission(&app), None);
        assert_eq!(fs::read_dir(resources).unwrap().count(), 0);
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn installation_mode_requires_clean_runtime_and_supported_vendor_signature() {
        let temp = tempfile::tempdir().unwrap();
        let app = temp.path().join("Cavalry.app");
        write_clean_bundle(&app);

        let mut supported = privilege::RecordingRunner::default();
        detect::require_supported_mac_identity(&app).unwrap();
        crate::mac_official::verify_clean_vendor_runtime(&app).unwrap();
        assert!(privilege::inspect_bundle_signature(&app, &mut supported)
            .unwrap()
            .is_supported_cavalry_vendor_identity());
        assert_eq!(
            installation_mode_with_runner(&app, &mut supported),
            "official"
        );

        struct IncompleteSignatureRunner;
        impl privilege::CommandRunner for IncompleteSignatureRunner {
            fn run(&mut self, _program: &str, _args: &[String]) -> Result<(), String> {
                Ok(())
            }
        }
        let mut incomplete = IncompleteSignatureRunner;
        assert_eq!(
            installation_mode_with_runner(&app, &mut incomplete),
            "modifiedOrUnverified"
        );

        fs::write(app.join("Contents/MacOS/CavalryLauncher"), b"managed").unwrap();
        let mut supported = privilege::RecordingRunner::default();
        assert_eq!(
            installation_mode_with_runner(&app, &mut supported),
            "modifiedOrUnverified"
        );
    }
}
