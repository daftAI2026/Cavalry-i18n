#[cfg(target_os = "macos")]
use std::os::unix::fs::PermissionsExt;
/**
 * [INPUT]: 依赖 install 布局、verified vendor Info.plist、mac_runtime/windows_runtime/windows_qpa、privilege typed graceful close 与 state。
 * [OUTPUT]: 提供 prepare_apply（macOS runtime 只从 trusted Info.plist 生成并含 Keychain staged pair）、typed fail-before-mutation preflight、payload 后 nested-code 签名、final marker 后 app seal、无 generic 残留的 English 早退判定与 restart 跨平台编排入口。
 * [POS]: commands 与平台差异之间的私有 facade；Windows English/翻译态都解析同一可信双 DLL 源，自定义根与 Program Files 共享 QPA 所有权语义。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
use std::{
    fmt,
    path::{Path, PathBuf},
};

#[cfg(target_os = "windows")]
use crate::install::InstallPlatform;
use crate::{
    install::InstallLayout,
    patch::CopyPair,
    privilege::{self, CommandRunner},
    state::State,
};

#[derive(Debug, Default)]
pub(crate) struct ApplyPlan {
    pub(crate) runtime_pairs: Vec<CopyPair>,
    pub(crate) final_language_marker: Option<CopyPair>,
    #[cfg_attr(target_os = "macos", allow(dead_code))]
    pub(crate) defer_final_language_marker: bool,
    #[cfg(target_os = "macos")]
    injector_target: Option<PathBuf>,
    #[cfg(target_os = "windows")]
    qpa_proxy_source: Option<PathBuf>,
    #[cfg(target_os = "windows")]
    qpa_generic_source: Option<PathBuf>,
    #[cfg(target_os = "windows")]
    cavalry_version: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) enum ApplyPreflightError {
    CavalryStillRunning,
    Other(String),
}

impl fmt::Display for ApplyPreflightError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::CavalryStillRunning => formatter.write_str(
                "Cavalry is still running. Save your work, close Cavalry, and try again. The Cavalry installation was not changed.",
            ),
            Self::Other(detail) => formatter.write_str(detail),
        }
    }
}

impl std::error::Error for ApplyPreflightError {}

impl From<String> for ApplyPreflightError {
    fn from(detail: String) -> Self {
        Self::Other(detail)
    }
}

pub(crate) fn prepare_apply(
    repo_root: &Path,
    resource_dir: &Path,
    app_path: &Path,
    lang: &str,
    cavalry_version: &str,
    staging_root: &Path,
    trusted_macos_info_plist: Option<&Path>,
    trusted_macos_info_mode: Option<u32>,
) -> Result<ApplyPlan, String> {
    let layout = InstallLayout::from_root(app_path);
    let mut plan = ApplyPlan::default();

    #[cfg(target_os = "windows")]
    {
        if layout.platform == InstallPlatform::Windows {
            if lang != "en" {
                plan.runtime_pairs
                    .push(crate::windows_runtime::build_plugin_copy_pair(
                        resource_dir,
                        repo_root,
                        &layout,
                    )?);
            }
            plan.qpa_proxy_source = Some(crate::windows_runtime::resolve_qpa_proxy_source(
                resource_dir,
                repo_root,
            )?);
            plan.qpa_generic_source = Some(crate::windows_runtime::resolve_plugin_source(
                resource_dir,
                repo_root,
            )?);
            plan.cavalry_version = cavalry_version.to_string();
            plan.defer_final_language_marker = true;
            plan.final_language_marker =
                Some(crate::windows_runtime::build_language_marker_copy_pair(
                    &layout,
                    lang,
                    &staging_root.join("runtime-marker"),
                )?);
        }
    }

    #[cfg(target_os = "macos")]
    {
        let injector_target = app_path
            .join("Contents")
            .join("Frameworks")
            .join(crate::mac_runtime::INJECTOR_DYLIB_NAME);
        if lang == "en" {
            plan.final_language_marker = Some(crate::mac_runtime::build_language_marker_pair(
                app_path,
                "en",
                &staging_root.join("runtime-marker"),
            )?);
        } else if lang != crate::commands::RESTORE_OFFICIAL_ACTION {
            let injector_source =
                crate::mac_runtime::injector_source_path(repo_root, resource_dir)?;
            let trusted_info = trusted_macos_info_plist.ok_or_else(|| {
                "macOS translated runtime requires the verified vendor Info.plist preimage."
                    .to_string()
            })?;
            let trusted_info_mode = trusted_macos_info_mode.ok_or_else(|| {
                "macOS translated runtime requires the vendor Info.plist mode.".to_string()
            })?;
            for pair in crate::mac_runtime::build_runtime_pairs_from_trusted_info_plist_path(
                app_path,
                lang,
                &staging_root.join("runtime"),
                &injector_source,
                trusted_info,
            )
            .map_err(|error| format!("Could not build macOS runtime patch files: {error}"))?
            {
                if pair.dst == app_path.join("Contents/Info.plist") {
                    std::fs::set_permissions(
                        &pair.src,
                        std::fs::Permissions::from_mode(trusted_info_mode),
                    )
                    .map_err(|error| {
                        format!(
                            "Could not restore vendor Info.plist mode on staged managed runtime: {error}"
                        )
                    })?;
                }
                if pair.dst == layout.language_marker {
                    plan.final_language_marker = Some(pair);
                } else {
                    plan.runtime_pairs.push(pair);
                }
            }
            let (keychain_pair, _) = privilege::stage_keychain_query_attributes_patch(
                app_path,
                &staging_root.join("keychain"),
            )
            .map_err(|error| format!("Could not stage Keychain query patch: {error}"))?;
            if let Some(pair) = keychain_pair {
                plan.runtime_pairs.push(pair);
            }
        }
        plan.injector_target = Some(injector_target);
    }

    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        let _ = (
            repo_root,
            resource_dir,
            lang,
            cavalry_version,
            staging_root,
            layout,
        );
    }

    #[cfg(target_os = "macos")]
    let _ = cavalry_version;
    #[cfg(not(target_os = "macos"))]
    let _ = (trusted_macos_info_plist, trusted_macos_info_mode);

    Ok(plan)
}

pub(crate) fn preflight_apply<R: CommandRunner>(
    app_path: &Path,
    lang: &str,
    runner: &mut R,
) -> Result<(), ApplyPreflightError> {
    #[cfg(target_os = "windows")]
    {
        let layout = InstallLayout::from_root(app_path);
        if layout.platform == InstallPlatform::Windows {
            return preflight_windows_apply_with(
                &layout,
                lang,
                runner,
                crate::windows_qpa::inspect,
                crate::windows_qpa::direct_write_requires_elevated_worker,
                crate::windows_qpa::preflight_direct_writable,
            );
        }
    }
    #[cfg(target_os = "macos")]
    {
        let _ = lang;
        return match privilege::close_cavalry_before_modification(app_path, runner) {
            Ok(()) => Ok(()),
            Err(privilege::CloseCavalryError::StillRunning) => {
                Err(ApplyPreflightError::CavalryStillRunning)
            }
            Err(privilege::CloseCavalryError::Command(detail)) => {
                Err(ApplyPreflightError::Other(format!(
                    "Could not close the selected Cavalry before applying language files: {detail}"
                )))
            }
        };
    }
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        let _ = (app_path, lang, runner);
    }
    #[allow(unreachable_code)]
    Ok(())
}

#[cfg(target_os = "windows")]
fn preflight_windows_apply_with<R, I, E, W>(
    layout: &InstallLayout,
    lang: &str,
    runner: &mut R,
    inspect_qpa: I,
    requires_elevated_worker: E,
    verify_direct_writable: W,
) -> Result<(), ApplyPreflightError>
where
    R: CommandRunner,
    I: Fn(&InstallLayout) -> Result<crate::windows_qpa::QpaInspection, String>,
    E: Fn(&InstallLayout) -> bool,
    W: Fn(&InstallLayout) -> Result<(), String>,
{
    let inspection = inspect_qpa(layout)?;
    if lang != "en" && inspection.state == crate::windows_qpa::QpaDeploymentState::Drifted {
        return Err(ApplyPreflightError::Other(format!(
            "Refusing translated apply because qwindows.dll is drifted. {}",
            inspection.detail
        )));
    }
    let generic_cleanup_required = lang == "en"
        && layout
            .root
            .join(crate::windows_qpa::GENERIC_PLUGIN_RELATIVE_PATH)
            .exists();
    let requires_qpa_transition = lang != "en"
        || inspection.state != crate::windows_qpa::QpaDeploymentState::Stock
        || generic_cleanup_required;
    if requires_qpa_transition && requires_elevated_worker(layout) {
        return Err(ApplyPreflightError::Other(
            "Windows Program Files QPA changes must be routed through the dedicated elevated language transaction before direct preflight. Cavalry was not closed and no files were changed."
                .to_string(),
        ));
    }
    match privilege::close_cavalry_before_modification(&layout.root, runner) {
        Ok(()) => {}
        Err(privilege::CloseCavalryError::StillRunning) => {
            return Err(ApplyPreflightError::CavalryStillRunning);
        }
        Err(privilege::CloseCavalryError::Command(detail)) => {
            return Err(ApplyPreflightError::Other(format!(
                "Could not close Cavalry before applying language files: {detail}"
            )));
        }
    }
    if requires_qpa_transition {
        verify_direct_writable(layout)?;
    }
    Ok(())
}

pub(crate) fn english_runtime_is_stock(app_path: &Path) -> bool {
    #[cfg(target_os = "windows")]
    {
        let layout = InstallLayout::from_root(app_path);
        if layout.platform == InstallPlatform::Windows {
            return crate::windows_qpa::inspect(&layout)
                .map(|inspection| {
                    inspection.state == crate::windows_qpa::QpaDeploymentState::Stock
                        && !layout
                            .root
                            .join(crate::windows_qpa::GENERIC_PLUGIN_RELATIVE_PATH)
                            .exists()
                })
                .unwrap_or(false);
        }
    }
    #[cfg(not(target_os = "windows"))]
    let _ = app_path;
    true
}

pub(crate) fn after_copy<R: CommandRunner>(
    plan: &ApplyPlan,
    app_path: &Path,
    lang: &str,
    staging_root: &Path,
    staged_pairs: &[CopyPair],
    runner: &mut R,
) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let layout = InstallLayout::from_root(app_path);
        if layout.platform == InstallPlatform::Windows {
            if lang == "en" {
                if let Some(proxy_source) = plan.qpa_proxy_source.as_deref() {
                    crate::windows_qpa::restore_writable(crate::windows_qpa::RestoreRequest {
                        layout: &layout,
                        proxy_source,
                        generic_source: plan.qpa_generic_source.as_deref().ok_or_else(|| {
                            "Windows English apply has no trusted generic plugin source."
                                .to_string()
                        })?,
                        reason: crate::windows_qpa::RestoreReason::EnglishSelection,
                    })?;
                } else if crate::windows_qpa::inspect(&layout)?.state
                    != crate::windows_qpa::QpaDeploymentState::Stock
                {
                    return Err(
                        "Windows English apply requires QPA recovery, but no trusted proxy source was resolved."
                            .to_string(),
                    );
                }
            } else {
                let proxy_source = plan.qpa_proxy_source.as_deref().ok_or_else(|| {
                    "Windows translated apply has no trusted QPA proxy source.".to_string()
                })?;
                crate::windows_qpa::activate_writable(crate::windows_qpa::ActivationRequest {
                    layout: &layout,
                    cavalry_version: &plan.cavalry_version,
                    proxy_source,
                })?;
                let inspection = crate::windows_qpa::inspect(&layout)?;
                if inspection.state != crate::windows_qpa::QpaDeploymentState::Active {
                    return Err(format!(
                        "Windows QPA did not reach ACTIVE before the final language marker: {}",
                        inspection.detail
                    ));
                }
            }
        }
    }

    #[cfg(target_os = "macos")]
    {
        if lang == crate::commands::RESTORE_OFFICIAL_ACTION {
            // English official restore copies the captured vendor executable, nested dylib,
            // Info.plist and CodeResources preimages. Re-signing here would immediately replace
            // that restored signature with a new ad-hoc identity; the command transaction verifies
            // the captured signature evidence before committing instead.
            return Ok(());
        }
        let modified_nested_code = macos_modified_nested_code(plan, app_path, staged_pairs);
        privilege::sign_modified_nested_code(app_path, &modified_nested_code, runner)
            .map_err(|error| format!("Could not sign patched Cavalry nested code: {error}"))?;
    }

    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        let _ = (plan, app_path, lang, staging_root, staged_pairs, runner);
    }

    #[cfg(target_os = "windows")]
    let _ = (staging_root, staged_pairs, runner);

    #[cfg(target_os = "macos")]
    let _ = staging_root;

    Ok(())
}

#[cfg(target_os = "macos")]
fn macos_modified_nested_code(
    plan: &ApplyPlan,
    app_path: &Path,
    staged_pairs: &[CopyPair],
) -> Vec<PathBuf> {
    let main_executable = app_path.join("Contents/MacOS/Cavalry");
    let injector_target = plan
        .injector_target
        .as_ref()
        .expect("macOS ApplyPlan must retain its injector target");
    let keychain_target = app_path
        .join("Contents")
        .join("Frameworks")
        .join("libExtensionLayer.dylib");
    // 首装会把 CFBundleExecutable 切到 CavalryLauncher；原厂 Cavalry 签名绑定旧
    // Info.plist，必须在外层 bundle seal 前进入同一有界 nested-code 重签计划。
    std::iter::once(main_executable)
        .chain(
            staged_pairs
                .iter()
                .filter(|pair| pair.dst == *injector_target || pair.dst == keychain_target)
                .map(|pair| pair.dst.clone()),
        )
        .collect()
}

/// Re-run the bounded nested-code verification without signing again.  The macOS transaction
/// uses this as its pre-marker proof before it records exact signing postimages.
#[cfg(target_os = "macos")]
pub(crate) fn verify_after_copy<R: CommandRunner>(
    plan: &ApplyPlan,
    app_path: &Path,
    lang: &str,
    staged_pairs: &[CopyPair],
    runner: &mut R,
) -> Result<(), String> {
    if lang == crate::commands::RESTORE_OFFICIAL_ACTION {
        return Ok(());
    }
    let modified_nested_code = macos_modified_nested_code(plan, app_path, staged_pairs);
    privilege::verify_modified_nested_code(app_path, &modified_nested_code, runner)
        .map_err(|error| format!("Patched Cavalry nested-code verification failed: {error}"))
}

pub(crate) fn after_final_language_marker<R: CommandRunner>(
    app_path: &Path,
    lang: &str,
    runner: &mut R,
) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        if lang == crate::commands::RESTORE_OFFICIAL_ACTION {
            return Ok(());
        }
        privilege::seal_patched_bundle(app_path, runner)
            .map_err(|error| format!("Could not seal patched Cavalry.app: {error}"))?;
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = (app_path, lang, runner);
    }
    Ok(())
}

pub(crate) fn restart<R: CommandRunner>(
    repo_root: &Path,
    state_dir: &Path,
    resource_dir: &Path,
    app_path: &Path,
    state: &State,
    runner: &mut R,
) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        return restart_windows_with_qpa_inspector(
            repo_root,
            state_dir,
            resource_dir,
            app_path,
            state,
            runner,
            crate::windows_qpa::inspect,
        );
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = (repo_root, state_dir, resource_dir, state);
        privilege::restart_cavalry(app_path, runner)
    }
}

#[cfg(target_os = "windows")]
fn restart_windows_with_qpa_inspector<R, F>(
    repo_root: &Path,
    state_dir: &Path,
    resource_dir: &Path,
    app_path: &Path,
    state: &State,
    runner: &mut R,
    inspect_qpa: F,
) -> Result<(), String>
where
    R: CommandRunner,
    F: Fn(&InstallLayout) -> Result<crate::windows_qpa::QpaInspection, String>,
{
    let layout = InstallLayout::from_root(app_path);
    let launch = crate::windows_runtime::prepare_launch_with_qpa_inspector(
        &layout,
        state_dir,
        state,
        resource_dir,
        repo_root,
        inspect_qpa,
    )?;
    let process_id =
        privilege::restart_cavalry_with_environment_and_pid(app_path, &launch.environment, runner)?;
    if let Some(marker_path) = launch.diagnostic_marker.as_deref() {
        crate::windows_runtime::wait_for_ready_marker(
            marker_path,
            &state.current_lang,
            process_id,
        )?;
    }
    Ok(())
}

#[cfg(all(test, target_os = "windows"))]
pub(crate) fn restart_with_qpa_inspector<R, F>(
    repo_root: &Path,
    state_dir: &Path,
    resource_dir: &Path,
    app_path: &Path,
    state: &State,
    runner: &mut R,
    inspect_qpa: F,
) -> Result<(), String>
where
    R: CommandRunner,
    F: Fn(&InstallLayout) -> Result<crate::windows_qpa::QpaInspection, String>,
{
    restart_windows_with_qpa_inspector(
        repo_root,
        state_dir,
        resource_dir,
        app_path,
        state,
        runner,
        inspect_qpa,
    )
}

#[cfg(all(test, target_os = "windows"))]
mod tests {
    use super::{preflight_windows_apply_with, ApplyPreflightError};
    use crate::{
        install::InstallLayout,
        privilege::{CommandRunner, CommandStatus, RecordingRunner},
        windows_qpa::{QpaDeploymentState, QpaInspection, QpaManifestPhase},
    };
    use std::fs;

    struct CloseStatusRunner(CommandStatus);

    impl CommandRunner for CloseStatusRunner {
        fn run(&mut self, _program: &str, _args: &[String]) -> Result<(), String> {
            panic!("typed close preflight must inspect the captured exit code")
        }

        fn run_captured(
            &mut self,
            _program: &str,
            _args: &[String],
        ) -> Result<CommandStatus, String> {
            Ok(self.0.clone())
        }
    }

    fn inspection(state: QpaDeploymentState) -> Result<QpaInspection, String> {
        Ok(QpaInspection {
            state,
            phase: (state == QpaDeploymentState::Active).then_some(QpaManifestPhase::Active),
            current_qwindows_sha256: Some("a".repeat(64)),
            detail: format!("fixture state: {state:?}"),
        })
    }

    fn immutable_fixture() -> (
        tempfile::TempDir,
        InstallLayout,
        Vec<(std::path::PathBuf, Vec<u8>)>,
    ) {
        let temp = tempfile::tempdir().unwrap();
        let root = temp.path().join("Cavalry");
        fs::create_dir_all(root.join("assets/Definitions")).unwrap();
        let files = [
            (root.join("Cavalry.exe"), b"exe".as_slice()),
            (
                root.join("assets/Definitions/appStrings.json"),
                br#"{"menu":"English"}"#.as_slice(),
            ),
            (
                root.join(crate::install::LANG_MARKER_NAME),
                b"en\n".as_slice(),
            ),
            (root.join("qwindows.dll"), b"vendor-qwindows".as_slice()),
        ];
        for (path, bytes) in files {
            fs::write(&path, bytes).unwrap();
        }
        let layout = InstallLayout::from_root(&root);
        let snapshots = [
            layout.root.join("assets/Definitions/appStrings.json"),
            layout.language_marker.clone(),
            layout.root.join("qwindows.dll"),
        ]
        .into_iter()
        .map(|path| {
            let bytes = fs::read(&path).unwrap();
            (path, bytes)
        })
        .collect();
        (temp, layout, snapshots)
    }

    fn assert_unchanged(snapshots: &[(std::path::PathBuf, Vec<u8>)]) {
        for (path, bytes) in snapshots {
            assert_eq!(&fs::read(path).unwrap(), bytes, "{}", path.display());
        }
    }

    #[test]
    fn drifted_qpa_rejects_translated_apply_before_close_or_mutation() {
        let (_temp, layout, snapshots) = immutable_fixture();
        let mut runner = RecordingRunner::default();

        let error = preflight_windows_apply_with(
            &layout,
            "zh-Hans",
            &mut runner,
            |_| inspection(QpaDeploymentState::Drifted),
            |_| false,
            |_| panic!("drift must reject before a write probe"),
        )
        .unwrap_err();

        assert!(
            matches!(&error, ApplyPreflightError::Other(detail) if detail.contains("drifted")),
            "{error}"
        );
        assert!(runner.commands.is_empty());
        assert_unchanged(&snapshots);
    }

    #[test]
    fn elevated_qpa_requirement_rejects_before_close_or_mutation() {
        let (_temp, layout, snapshots) = immutable_fixture();
        let mut runner = RecordingRunner::default();

        let error = preflight_windows_apply_with(
            &layout,
            "ja_JP",
            &mut runner,
            |_| inspection(QpaDeploymentState::Stock),
            |_| true,
            |_| panic!("Program Files must reject before a direct-write probe"),
        )
        .unwrap_err();

        assert!(
            matches!(
                &error,
                ApplyPreflightError::Other(detail)
                    if detail.contains("must be routed through the dedicated elevated language transaction")
            ),
            "{error}"
        );
        assert!(runner.commands.is_empty());
        assert_unchanged(&snapshots);
    }

    #[test]
    fn failed_direct_write_probe_closes_only_and_never_mutates_payload() {
        let (_temp, layout, snapshots) = immutable_fixture();
        let mut runner = RecordingRunner::default();

        let error = preflight_windows_apply_with(
            &layout,
            "zh-Hant",
            &mut runner,
            |_| inspection(QpaDeploymentState::Active),
            |_| false,
            |_| Err("recovery directory is not writable".to_string()),
        )
        .unwrap_err();

        assert!(
            matches!(&error, ApplyPreflightError::Other(detail) if detail.contains("not writable")),
            "{error}"
        );
        assert_eq!(runner.commands.len(), 1);
        assert_eq!(runner.commands[0].program, "powershell.exe");
        assert_unchanged(&snapshots);
    }

    #[test]
    fn english_stock_qpa_with_generic_residual_requires_write_preflight() {
        let (_temp, layout, snapshots) = immutable_fixture();
        let generic = layout
            .root
            .join(crate::windows_qpa::GENERIC_PLUGIN_RELATIVE_PATH);
        fs::create_dir_all(generic.parent().unwrap()).unwrap();
        fs::write(&generic, b"owned generic residual").unwrap();
        let mut runner = RecordingRunner::default();

        let error = preflight_windows_apply_with(
            &layout,
            "en",
            &mut runner,
            |_| inspection(QpaDeploymentState::Stock),
            |_| false,
            |_| Err("generic cleanup is not writable".to_string()),
        )
        .unwrap_err();

        assert!(
            matches!(&error, ApplyPreflightError::Other(detail) if detail.contains("generic cleanup is not writable")),
            "{error}"
        );
        assert_eq!(runner.commands.len(), 1);
        assert_eq!(fs::read(&generic).unwrap(), b"owned generic residual");
        assert_unchanged(&snapshots);
    }

    #[test]
    fn graceful_close_preflight_never_restores_or_changes_qpa_files() {
        let (_temp, layout, snapshots) = immutable_fixture();
        let mut runner = RecordingRunner::default();

        preflight_windows_apply_with(
            &layout,
            "zh-Hans",
            &mut runner,
            |_| inspection(QpaDeploymentState::Active),
            |_| false,
            |_| Ok(()),
        )
        .unwrap();

        assert_eq!(runner.commands.len(), 1);
        assert_eq!(runner.commands[0].program, "powershell.exe");
        assert_unchanged(&snapshots);
    }

    #[test]
    fn running_cavalry_remains_typed_across_direct_root_preflight() {
        let (_temp, layout, snapshots) = immutable_fixture();
        let mut runner = CloseStatusRunner(CommandStatus {
            exit_code: Some(45),
            stdout: String::new(),
            stderr: "Cavalry still owns a visible window.".to_string(),
        });

        let error = preflight_windows_apply_with(
            &layout,
            "zh-Hans",
            &mut runner,
            |_| inspection(QpaDeploymentState::Active),
            |_| false,
            |_| panic!("a blocked close must reject before the write probe"),
        )
        .unwrap_err();

        assert_eq!(error, ApplyPreflightError::CavalryStillRunning);
        assert_unchanged(&snapshots);
    }
}

#[cfg(all(test, target_os = "macos"))]
mod macos_tests {
    use super::{macos_modified_nested_code, ApplyPlan};
    use crate::patch::CopyPair;
    use std::path::PathBuf;

    #[test]
    fn first_install_resigns_the_vendor_main_binary_before_outer_bundle_seal() {
        let app = PathBuf::from("/tmp/Cavalry.app");
        let injector = app.join("Contents/Frameworks/libCavalryTranslatorInjector.dylib");
        let extension = app.join("Contents/Frameworks/libExtensionLayer.dylib");
        let mut plan = ApplyPlan::default();
        plan.injector_target = Some(injector.clone());
        let pairs = [
            CopyPair {
                src: PathBuf::from("/tmp/injector"),
                dst: injector.clone(),
            },
            CopyPair {
                src: PathBuf::from("/tmp/extension"),
                dst: extension.clone(),
            },
        ];

        assert_eq!(
            macos_modified_nested_code(&plan, &app, &pairs),
            [app.join("Contents/MacOS/Cavalry"), injector, extension,]
        );
    }
}
