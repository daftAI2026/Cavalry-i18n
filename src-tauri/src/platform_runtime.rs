/**
 * [INPUT]: 依赖 install 布局、mac_runtime/windows_runtime、privilege 受控系统边界与 state。
 * [OUTPUT]: 提供 prepare_apply、after_copy、restart 三个跨平台运行时编排入口及 ApplyPlan。
 * [POS]: commands 与平台差异之间的私有 facade；apply/restart 编排不再散落 macOS/Windows cfg 分支。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
use std::path::Path;

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
    #[cfg(target_os = "macos")]
    injector_target: Option<PathBuf>,
}

pub(crate) fn prepare_apply(
    repo_root: &Path,
    resource_dir: &Path,
    app_path: &Path,
    lang: &str,
    staging_root: &Path,
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
        let _ = (repo_root, resource_dir, lang, staging_root, layout);
    }

    Ok(plan)
}

pub(crate) fn after_copy<R: CommandRunner>(
    plan: &ApplyPlan,
    app_path: &Path,
    lang: &str,
    staging_root: &Path,
    staged_pairs: &[CopyPair],
    runner: &mut R,
) -> Result<(), String> {
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

    #[cfg(not(target_os = "macos"))]
    {
        let _ = (plan, app_path, lang, staging_root, staged_pairs, runner);
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
        let layout = InstallLayout::from_root(app_path);
        let launch = crate::windows_runtime::prepare_launch(
            &layout,
            state_dir,
            state,
            resource_dir,
            repo_root,
        )?;
        let process_id = privilege::restart_cavalry_with_environment_and_pid(
            app_path,
            &launch.environment,
            runner,
        )?;
        if let Some(marker_path) = launch.diagnostic_marker.as_deref() {
            crate::windows_runtime::wait_for_ready_marker(
                marker_path,
                &state.current_lang,
                process_id,
            )?;
        }
        return Ok(());
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = (repo_root, state_dir, resource_dir, state);
        privilege::restart_cavalry(app_path, runner)
    }
}
