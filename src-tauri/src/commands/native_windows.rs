/*
 * [INPUT]: 依赖现有安装发现、冻结Windows 2.8.1宿主摘要、共享资源loader/profile事务和Windows系统适配器。
 * [OUTPUT]: 原生profile/runtime事务先以精确2.8.1身份确认宿主并持久化已验安装选择，再执行既有事务；卸载先解析必要目标，再恢复profile及runtime；复用现有State/QPA/journal。
 * [POS]: Windows 2.8.1窄facade；共享翻译/事务仍由Mac主干承担，Windows只绑定宿主、OS路径与写者准入。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
use super::{
    contract::{ActionPayload, OperationPhase, OperationPhaseGuard, OperationReporter},
    native_resources, native_user,
    user_language_files::UserLanguagePaths,
};
use crate::{
    install::InstallLayout,
    operation_lock::BundleOperationGuard,
    privilege::{self, CommandRunner},
};
use serde::Deserialize;
use sha2::{Digest, Sha256};
use std::{
    collections::BTreeMap,
    fs,
    io::Read,
    path::{Path, PathBuf},
};

const NATIVE_CAVALRY_VERSION: &str = "2.8.1";

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Target {
    schema_version: u32,
    cavalry_version: String,
    qt_version: String,
    architecture: String,
    msi_sha256: String,
    files: BTreeMap<String, String>,
}
fn target() -> Result<Target, String> {
    let target: Target = serde_json::from_slice(include_bytes!(
        "../../../tools/cavalry_native_windows_target.json"
    ))
    .map_err(|e| e.to_string())?;
    validate_target(&target)?;
    Ok(target)
}

fn validate_target(target: &Target) -> Result<(), String> {
    if target.schema_version != 1
        || target.cavalry_version != NATIVE_CAVALRY_VERSION
        || target.qt_version != "6.9.2"
        || target.architecture != "x86_64"
        || !is_sha256(&target.msi_sha256)
    {
        return Err("Windows native target identity differs".into());
    }
    const EXPECTED_FILES: [&str; 5] = [
        "Cavalry.exe",
        "Api.dll",
        "Core.dll",
        "Qt6Core.dll",
        "qwindows.dll",
    ];
    if target.files.len() != EXPECTED_FILES.len()
        || EXPECTED_FILES
            .iter()
            .any(|name| !target.files.get(*name).is_some_and(|hash| is_sha256(hash)))
    {
        return Err("Windows native target file identity set differs".into());
    }
    Ok(())
}

fn is_sha256(value: &str) -> bool {
    value.len() == 64
        && value
            .bytes()
            .all(|byte| byte.is_ascii_hexdigit() && !byte.is_ascii_uppercase())
}
fn digest_file(path: &Path) -> Result<String, String> {
    privilege::verify_windows_path_components(
        path.ancestors().last().ok_or("host path has no root")?,
        path,
    )?;
    use std::os::windows::fs::MetadataExt;
    use windows::Win32::Storage::FileSystem::FILE_ATTRIBUTE_REPARSE_POINT;
    let metadata = fs::symlink_metadata(path).map_err(|e| e.to_string())?;
    if !metadata.is_file() || metadata.file_attributes() & FILE_ATTRIBUTE_REPARSE_POINT.0 != 0 {
        return Err("Windows native host file is not ordinary".into());
    }
    let mut file = fs::File::open(path).map_err(|e| e.to_string())?;
    let mut hash = Sha256::new();
    let mut buffer = [0; 65536];
    loop {
        let count = file.read(&mut buffer).map_err(|e| e.to_string())?;
        if count == 0 {
            break;
        }
        hash.update(&buffer[..count]);
    }
    Ok(format!("{:x}", hash.finalize()))
}
pub(super) fn observe_install(selection: &Path) -> Result<(PathBuf, String), String> {
    let layout = native_layout(selection)?;
    let target = target()?;
    let version = crate::windows_install::product_version_for_executable(&layout.executable)
        .or_else(|| {
            (digest_file(&layout.executable).ok().as_ref() == target.files.get("Cavalry.exe"))
                .then(|| target.cavalry_version.clone())
        })
        .unwrap_or_default();
    Ok((layout.root, version))
}
pub(super) fn vendor_origin(selection: &Path) -> &'static str {
    // 冻结目标来自已核验的官方MSI；发现/版本本身不能授予Official。
    // profile层仍要求内置语言且无Switcher覆盖，实际写入另行重验。
    if verify_host(selection).is_ok() {
        "official"
    } else {
        "unknown"
    }
}
fn verify_host(selection: &Path) -> Result<PathBuf, String> {
    let layout = native_layout(selection)?;
    for (relative, expected) in target()?.files {
        if relative == "qwindows.dll" && digest_file(&layout.root.join(&relative))? != expected {
            let inspection = crate::windows_qpa::inspect(&layout)?;
            if matches!(
                inspection.state,
                crate::windows_qpa::QpaDeploymentState::Active
                    | crate::windows_qpa::QpaDeploymentState::Recover
            ) && digest_file(&crate::windows_qpa::vendor_qwindows_backup(&layout))? == expected
            {
                continue;
            }
            return Err("Windows native QPA ownership differs".into());
        }
        if digest_file(&layout.root.join(relative))? != expected {
            return Err(
                "Windows native host differs from the approved 2.8.1 runtime; no profile written"
                    .into(),
            );
        }
    }
    Ok(layout.root)
}

pub(super) fn runtime_patch_status(
    selection: &Path,
    language: &str,
) -> Result<&'static str, String> {
    let layout = native_layout(selection)?;
    let (generic, proxy) = privilege::native_runtime_source_hashes()
        .ok_or("Native runtime candidate source is unavailable")?;
    Ok(
        if crate::windows_qpa::native_runtime_source_matches(&layout, language, generic, proxy)? {
            "current"
        } else {
            "updateAvailable"
        },
    )
}

fn native_layout(selection: &Path) -> Result<InstallLayout, String> {
    let root = crate::install::canonical_root_for_selection(selection)?;
    privilege::verify_windows_path_components(
        root.ancestors().last().ok_or("install has no root")?,
        &root,
    )?;
    let layout = InstallLayout::from_root(&root);
    let executable = fs::symlink_metadata(&layout.executable).map_err(|e| e.to_string())?;
    if !executable.is_file() {
        return Err("Cavalry executable is unavailable".into());
    }
    Ok(layout)
}
pub(super) fn profile_paths(state_dir: &Path, writable: bool) -> Result<UserLanguagePaths, String> {
    let (local, roaming) = privilege::windows_native_user_roots()?;
    let state = if writable {
        fs::canonicalize(state_dir).map_err(|e| e.to_string())?
    } else {
        canonical_state_plan(state_dir)?
    };
    UserLanguagePaths::for_windows_dirs(&local, &roaming, &state, writable)
}

fn canonical_state_plan(path: &Path) -> Result<PathBuf, String> {
    if !path.is_absolute() {
        return Err("Native state path must be absolute".into());
    }
    privilege::verify_windows_path_components(
        path.ancestors().last().ok_or("state has no root")?,
        path,
    )?;
    let mut existing = path;
    let mut missing = Vec::new();
    loop {
        match fs::canonicalize(existing) {
            Ok(mut resolved) => {
                for name in missing.into_iter().rev() {
                    resolved.push(name);
                }
                return Ok(resolved);
            }
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
                missing.push(
                    existing
                        .file_name()
                        .ok_or("state has no parent")?
                        .to_os_string(),
                );
                existing = existing.parent().ok_or("state has no ancestor")?;
            }
            Err(error) => return Err(error.to_string()),
        }
    }
}

pub(super) fn apply<R: OperationReporter, C: CommandRunner>(
    operation: &BundleOperationGuard,
    repo: &Path,
    state: &Path,
    resources: &Path,
    app: &Path,
    language: &str,
    reporter: &R,
    runner: &mut C,
) -> ActionPayload {
    let mut verify = OperationPhaseGuard::start(reporter, OperationPhase::VerifyInstallation);
    if let Err(error) = operation.require_state_dir(state) {
        return native_user::transaction_error(&error);
    }
    let paths = match profile_paths(state, true) {
        Ok(paths) => paths,
        Err(error) => return native_user::transaction_error(&error),
    };
    let mut closed_writer = || privilege::guard_windows_native_writers(runner);
    let verified_host = verify_host(app);
    if let Ok(root) = &verified_host {
        if let Err(error) =
            super::status::persist_native_selection(state, root, native_resources::NATIVE_VERSION)
        {
            return native_user::transaction_error(&error);
        }
    }
    if language == "en" {
        let payload = native_user::apply_english_with_host_probe(
            &paths,
            || verified_host.map(|_| ()),
            &mut closed_writer,
            reporter,
            &mut verify,
        );
        if payload.ok && !payload.reconciliation_required && !payload.native_restore_only {
            if let Err(error) = runtime_transaction(repo, resources, state, app, "en") {
                let mut failure = native_user::transaction_error(&error);
                failure.current_lang = Some("en".into());
                failure.reconciliation_required = true;
                return failure;
            }
        }
        return payload;
    }
    if let Err(error) = verified_host {
        return ActionPayload::error_with_code(&error, "installationVerificationFailed");
    }
    let pack = match native_resources::load_language_resource(repo, resources, language) {
        Ok(bytes) => bytes,
        Err(_) => {
            return ActionPayload::error_with_code(
                "Native resource bundle is unavailable.",
                "nativeResourceUnavailable",
            )
        }
    };
    // 与Mac同序：profile恢复/漂移准入→runtime事务→profile事务；中间失败不启动。
    match super::user_language_files::recover_with_writer_guard(&paths, &mut closed_writer) {
        Ok(
            super::user_language_files::RecoveryOutcome::NothingPending
            | super::user_language_files::RecoveryOutcome::Completed,
        ) => {}
        Ok(_) => {
            return native_user::transaction_error(
                "Native profile recovery durability remains unproven",
            )
        }
        Err(error) => return native_user::transaction_error(&error),
    }
    if let Err(error) = native_user::restart_profile_admission(&paths).and_then(|_| closed_writer())
    {
        return native_user::transaction_error(&error);
    }
    if let Err(error) = runtime_transaction(repo, resources, state, app, language) {
        return native_user::transaction_error(&error);
    }
    verify.completed();
    let mut payload =
        native_user::apply_profile(&paths, language, Some(&pack), &mut closed_writer, reporter);
    if !payload.ok {
        payload.reconciliation_required = true;
    }
    payload
}

fn runtime_transaction(
    repo: &Path,
    resources: &Path,
    state: &Path,
    app: &Path,
    language: &str,
) -> Result<(), String> {
    let layout = native_layout(app)?;
    let staging = state.join(format!(
        "windows-native-runtime-{}-{}",
        std::process::id(),
        super::context::next_staging_nonce()
    ));
    match privilege::apply_windows_native_runtime(privilege::ParentApplyRequest {
        repo_root: repo,
        resource_dir: resources,
        state_dir: state,
        layout: &layout,
        language,
        cavalry_version: NATIVE_CAVALRY_VERSION,
        staging_root: &staging,
        overlay_pairs: &[],
        english_snapshot_manifest: None,
    })
    .map_err(|e| e.to_string())?
    {
        privilege::ParentApplyOutcome::Applied {
            worker_cleanup_residual: false,
            staging_cleanup_warning: None,
        } => Ok(()),
        _ => Err("Native runtime transaction requires reconciliation before launch".into()),
    }
}

pub(super) fn restart<C: CommandRunner>(
    app: &Path,
    state: &Path,
    runner: &mut C,
) -> Result<(), String> {
    native_user::restart_profile_admission(&profile_paths(state, false)?)?;
    let root = verify_host(app)?;
    privilege::launch_windows_native_host(&root, runner)
}

pub(crate) fn enabled() -> bool {
    native_resources::native_runtime_enabled()
}

pub(crate) fn restore_for_uninstall() -> Result<(), String> {
    let state = super::context::windows_state_dir();
    let _guard = crate::operation_lock::try_begin_bundle_operation(&state)?;
    let mut runner = privilege::RealCommandRunner;
    restore_from_saved_state(
        &state,
        || restore_profile_for_uninstall(&state),
        |root| {
            privilege::guard_windows_native_writers(&mut runner)?;
            let executable = std::env::current_exe().map_err(|e| e.to_string())?;
            let resources = executable
                .parent()
                .ok_or("Switcher directory unavailable")?;
            runtime_transaction(
                &crate::runtime_paths::repo_root(),
                resources,
                &state,
                root,
                "en",
            )
        },
    )
}

fn restore_from_saved_state(
    state: &Path,
    restore_profile: impl FnOnce() -> Result<(), String>,
    restore_runtime: impl FnOnce(&Path) -> Result<(), String>,
) -> Result<(), String> {
    // -- 缺少必需目标时零profile写入；已移除宿主仍恢复自有profile -----
    let saved = crate::state::read_state_strict(&state).map_err(|e| e.to_string())?;
    if saved.app_path.trim().is_empty() {
        return Err("No saved native Cavalry installation".into());
    }
    let root = Path::new(&saved.app_path);
    let host_present = match fs::symlink_metadata(root.join("Cavalry.exe")) {
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => false,
        Err(e) => return Err(e.to_string()),
        Ok(_) => true,
    };
    restore_profile()?;
    if host_present {
        restore_runtime(root)
    } else {
        Ok(())
    }
}

fn restore_profile_for_uninstall(state: &Path) -> Result<(), String> {
    use super::user_language_files::{self, ReceiptObservation, RestoreOutcome};
    let paths = profile_paths(state, true)?;
    let profile = user_language_files::read_profile_projection(&paths)?;
    if matches!(profile.ownership, ReceiptObservation::None) && !paths.strings().exists() {
        return Ok(());
    }
    let mut runner = privilege::RealCommandRunner;
    match user_language_files::restore_owned_english_with_writer_guard(&paths, &mut || {
        privilege::guard_windows_native_writers(&mut runner)
    })? {
        RestoreOutcome::Restored | RestoreOutcome::NothingToRestore => Ok(()),
        RestoreOutcome::RestoredWithWarning(_) => {
            Err("Native English restore durability is unproven".into())
        }
    }
}

#[cfg(test)]
#[path = "tests/native_windows_paths.rs"]
mod tests;

#[cfg(test)]
mod target_tests {
    use super::*;

    #[test]
    fn frozen_windows_target_accepts_281_and_rejects_old_or_drifted_identity() {
        let approved = target().unwrap();
        assert_eq!(approved.cavalry_version, NATIVE_CAVALRY_VERSION);
        assert_eq!(NATIVE_CAVALRY_VERSION, "2.8.1");
        assert_eq!(
            approved.msi_sha256,
            "b79d08290b6f1320154b9fec46cee1b4bba81a9670af636611f4c53e8057420a"
        );
        assert_eq!(
            approved.files.get("Cavalry.exe").map(String::as_str),
            Some("87689d8e7a37b2e2341cbf5c6327fd960afc65b8385ac35b170d71671961d9ad")
        );

        let mut previous = approved.clone();
        previous.cavalry_version = "2.8.0".into();
        assert!(validate_target(&previous).is_err());

        let mut drifted = approved;
        drifted.files.insert("Cavalry.exe".into(), "g".repeat(64));
        assert!(validate_target(&drifted).is_err());
    }
}
