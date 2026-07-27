/**
 * [INPUT]: 依赖 install 布局、mac_runtime/windows_runtime/windows_qpa、privilege graceful close 与 state。
 * [OUTPUT]: 提供 prepare_apply、fail-before-mutation preflight、after_copy、English 早退判定与 restart 跨平台编排入口。
 * [POS]: commands 与平台差异之间的私有 facade；Windows 先拒绝漂移/需提升 QPA，再精确关闭进程，把直接写 QPA 激活/English 恢复置于 pending 资源复制和 final marker 之间。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
use std::path::{Path, PathBuf};

use crate::{
    install::{InstallLayout, InstallPlatform},
    patch::CopyPair,
    privilege::{self, CommandRunner},
    state::State,
};

#[derive(Debug, Default)]
pub(crate) struct ApplyPlan {
    pub(crate) runtime_pairs: Vec<CopyPair>,
    pub(crate) final_language_marker: Option<CopyPair>,
    pub(crate) defer_final_language_marker: bool,
    #[cfg(target_os = "macos")]
    injector_target: Option<PathBuf>,
    #[cfg(target_os = "windows")]
    qpa_proxy_source: Option<PathBuf>,
    #[cfg(target_os = "windows")]
    cavalry_version: String,
}

pub(crate) fn prepare_apply(
    repo_root: &Path,
    resource_dir: &Path,
    app_path: &Path,
    lang: &str,
    cavalry_version: &str,
    staging_root: &Path,
) -> Result<ApplyPlan, String> {
    let layout = InstallLayout::from_root(app_path);
    let mut plan = ApplyPlan::default();

    #[cfg(target_os = "windows")]
    {
        if layout.platform == InstallPlatform::Windows {
            let qpa_state = crate::windows_qpa::inspect(&layout)?.state;
            if lang != "en" {
                plan.runtime_pairs
                    .push(crate::windows_runtime::build_plugin_copy_pair(
                        resource_dir,
                        repo_root,
                        &layout,
                    )?);
            }
            if lang != "en" || qpa_state != crate::windows_qpa::QpaDeploymentState::Stock {
                plan.qpa_proxy_source = Some(crate::windows_runtime::resolve_qpa_proxy_source(
                    resource_dir,
                    repo_root,
                )?);
            }
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
        let injector_source = crate::mac_runtime::injector_source_path(repo_root, resource_dir)?;
        let injector_target = app_path
            .join("Contents")
            .join("Frameworks")
            .join(crate::mac_runtime::INJECTOR_DYLIB_NAME);
        for pair in crate::mac_runtime::build_runtime_pairs(
            app_path,
            lang,
            &staging_root.join("runtime"),
            &injector_source,
        )
        .map_err(|error| format!("Could not build macOS runtime patch files: {error}"))?
        {
            if pair.dst == layout.language_marker {
                plan.final_language_marker = Some(pair);
            } else {
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

    Ok(plan)
}

pub(crate) fn preflight_apply<R: CommandRunner>(
    app_path: &Path,
    lang: &str,
    runner: &mut R,
) -> Result<(), String> {
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
    #[cfg(not(target_os = "windows"))]
    {
        let _ = (app_path, lang, runner);
    }
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
) -> Result<(), String>
where
    R: CommandRunner,
    I: Fn(&InstallLayout) -> Result<crate::windows_qpa::QpaInspection, String>,
    E: Fn(&InstallLayout) -> bool,
    W: Fn(&InstallLayout) -> Result<(), String>,
{
    let inspection = inspect_qpa(layout)?;
    if lang != "en" && inspection.state == crate::windows_qpa::QpaDeploymentState::Drifted {
        return Err(format!(
            "Refusing translated apply because qwindows.dll is drifted. {}",
            inspection.detail
        ));
    }
    let requires_qpa_transition =
        lang != "en" || inspection.state != crate::windows_qpa::QpaDeploymentState::Stock;
    if requires_qpa_transition && requires_elevated_worker(layout) {
        return Err(
            "Windows QPA changes under Program Files require the dedicated elevated QPA worker, which is not available in this build. Cavalry was not closed and no files were changed."
                .to_string(),
        );
    }
    privilege::close_cavalry_before_modification(&layout.root, runner).map_err(|error| {
        format!("Could not close Cavalry before applying language files: {error}")
    })?;
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
                .map(|inspection| inspection.state == crate::windows_qpa::QpaDeploymentState::Stock)
                .unwrap_or(false);
        }
    }
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
        let injector_target = plan
            .injector_target
            .as_ref()
            .expect("macOS ApplyPlan must retain its injector target");
        let mut modified_nested_code = staged_pairs
            .iter()
            .filter(|pair| pair.dst == *injector_target)
            .map(|pair| pair.dst.clone())
            .collect::<Vec<_>>();
        let mut bundle_changed = !staged_pairs.is_empty();
        if lang != "en" {
            let keychain_report = privilege::patch_keychain_query_attributes_with_privilege(
                app_path,
                &staging_root.join("keychain"),
                runner,
            )
            .map_err(|error| format!("Could not patch Keychain query attributes: {error}"))?;
            if keychain_report.patched_callsites > 0 {
                bundle_changed = true;
                modified_nested_code.push(
                    app_path
                        .join("Contents")
                        .join("Frameworks")
                        .join("libExtensionLayer.dylib"),
                );
            }
        }
        if bundle_changed {
            privilege::resign_patched_bundle(app_path, &modified_nested_code, runner)
                .map_err(|error| format!("Could not re-sign patched Cavalry.app: {error}"))?;
        } else {
            privilege::ensure_bundle_signature(app_path, runner).map_err(|error| {
                format!("Could not verify or repair Cavalry.app signature: {error}")
            })?;
        }
        privilege::clear_gatekeeper_quarantine(app_path, runner)
            .map_err(|error| format!("Could not clear Gatekeeper quarantine: {error}"))?;
    }

    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        let _ = (plan, app_path, lang, staging_root, staged_pairs, runner);
    }

    #[cfg(target_os = "windows")]
    let _ = (staging_root, staged_pairs, runner);

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
    use super::preflight_windows_apply_with;
    use crate::{
        install::InstallLayout,
        privilege::RecordingRunner,
        windows_qpa::{QpaDeploymentState, QpaInspection, QpaManifestPhase},
    };
    use std::fs;

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

        assert!(error.contains("drifted"), "{error}");
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

        assert!(error.contains("not available in this build"), "{error}");
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

        assert!(error.contains("not writable"), "{error}");
        assert_eq!(runner.commands.len(), 1);
        assert_eq!(runner.commands[0].program, "powershell.exe");
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
}
