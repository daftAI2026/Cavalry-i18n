/**
 * [INPUT]: 依赖共享 runtime_paths/operation_lock、保存的 State、Cavalry 安装布局、Windows runtime ready marker 与 CommandRunner。
 * [OUTPUT]: 提供 --launch-cavalry 无 WebView 分流，以及带 revision/语言 marker/QPA ACTIVE/plugin/PID 就绪门的可测试启动编排。
 * [POS]: src-tauri/src 的 Windows 原生启动入口；复用 Switcher 二进制读取当前选择，仅给 Cavalry 子进程注入诊断 marker，不修改 vendor EXE 或全局环境。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
use std::{
    env,
    ffi::{OsStr, OsString},
    path::Path,
};

use crate::{
    detect, operation_lock,
    privilege::{CommandRunner, RealCommandRunner},
    runtime_paths, state, windows_runtime,
};

pub const LAUNCH_ARGUMENT: &str = "--launch-cavalry";

pub fn dispatch_current_process() -> bool {
    let args = env::args_os().collect::<Vec<_>>();
    if !launch_requested(&args) {
        return false;
    }

    if let Err(error) = launch_current_saved_cavalry() {
        let _ = rfd::MessageDialog::new()
            .set_title("Cavalry Language Switcher")
            .set_description(&error)
            .set_level(rfd::MessageLevel::Error)
            .set_buttons(rfd::MessageButtons::Ok)
            .show();
    }
    true
}

fn launch_requested(args: &[OsString]) -> bool {
    args.len() == 2 && args[1] == OsStr::new(LAUNCH_ARGUMENT)
}

fn launch_current_saved_cavalry() -> Result<(), String> {
    let current_exe = env::current_exe()
        .map_err(|error| format!("Could not locate Cavalry Language Switcher: {error}"))?;
    let resource_dir = current_exe.parent().ok_or_else(|| {
        format!(
            "Could not resolve the installed Switcher directory from {}.",
            current_exe.display()
        )
    })?;
    let state_dir = runtime_paths::current_windows_state_dir();
    let repo_root = runtime_paths::repo_root();
    let mut runner = RealCommandRunner;
    launch_from_paths(&repo_root, &state_dir, resource_dir, &mut runner)
}

fn launch_from_paths<R: CommandRunner>(
    repo_root: &Path,
    state_dir: &Path,
    resource_dir: &Path,
    runner: &mut R,
) -> Result<(), String> {
    launch_from_paths_with_qpa_inspector(
        repo_root,
        state_dir,
        resource_dir,
        runner,
        crate::windows_qpa::inspect,
    )
}

fn launch_from_paths_with_qpa_inspector<R, F>(
    repo_root: &Path,
    state_dir: &Path,
    resource_dir: &Path,
    runner: &mut R,
    inspect_qpa: F,
) -> Result<(), String>
where
    R: CommandRunner,
    F: Fn(&crate::install::InstallLayout) -> Result<crate::windows_qpa::QpaInspection, String>,
{
    let _operation_guard = operation_lock::try_begin_bundle_operation(state_dir)?;
    let saved = state::read_state(state_dir).ok_or_else(|| {
        "Open Cavalry Language Switcher and apply a language before using this shortcut."
            .to_string()
    })?;
    if saved.app_path.trim().is_empty() {
        return Err(
            "Open Cavalry Language Switcher and select a Cavalry installation first.".to_string(),
        );
    }

    let layout = detect::resolve_install(Path::new(&saved.app_path))?;
    let current_revision = detect::read_bundle_revision(&layout.root)?;
    if saved.cavalry_revision.is_empty() || saved.cavalry_revision != current_revision {
        return Err(
            "This Cavalry installation changed. Open Cavalry Language Switcher and reapply the selected language before launching."
                .to_string(),
        );
    }

    let installed_language = detect::read_installed_language(&layout.root, "");
    if installed_language != saved.current_lang {
        return Err(format!(
            "The installed Cavalry language does not match the saved selection (installed: {}, saved: {}). Open Cavalry Language Switcher and reapply it.",
            if installed_language.is_empty() {
                "unknown"
            } else {
                &installed_language
            },
            saved.current_lang
        ));
    }

    let launch = windows_runtime::prepare_launch_with_qpa_inspector(
        &layout,
        state_dir,
        &saved,
        resource_dir,
        repo_root,
        inspect_qpa,
    )?;
    let process_id = runner
        .spawn_detached_in_with_env_and_pid(
            &layout.executable.to_string_lossy(),
            &[],
            &layout.root,
            &launch.environment,
        )?
        .ok_or_else(|| {
            "Windows launcher did not report the spawned Cavalry process id.".to_string()
        })?;
    if let Some(marker_path) = launch.diagnostic_marker.as_deref() {
        windows_runtime::wait_for_ready_marker(marker_path, &saved.current_lang, process_id)?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{launch_from_paths_with_qpa_inspector, launch_requested, LAUNCH_ARGUMENT};
    use crate::{
        detect,
        install::{InstallLayout, LANG_MARKER_NAME},
        operation_lock,
        privilege::CommandRunner,
        state::{self, State},
        windows_runtime::PLUGIN_FILE_NAME,
    };
    use std::{
        ffi::OsString,
        fs,
        path::{Path, PathBuf},
        sync::Mutex,
    };

    static LAUNCH_TEST_LOCK: Mutex<()> = Mutex::new(());

    #[derive(Default)]
    struct LaunchRecorder {
        program: Option<String>,
        args: Vec<String>,
        working_directory: Option<PathBuf>,
        environment: Vec<(OsString, OsString)>,
        reported_pid: Option<u32>,
        marker_process_id: Option<u32>,
    }

    impl LaunchRecorder {
        fn ready(process_id: u32) -> Self {
            Self {
                reported_pid: Some(process_id),
                marker_process_id: Some(process_id),
                ..Self::default()
            }
        }
    }

    impl CommandRunner for LaunchRecorder {
        fn run(&mut self, _program: &str, _args: &[String]) -> Result<(), String> {
            unreachable!("headless launch must not run a blocking helper")
        }

        fn spawn_detached_in_with_env_and_pid(
            &mut self,
            program: &str,
            args: &[String],
            working_directory: &Path,
            environment: &[(OsString, OsString)],
        ) -> Result<Option<u32>, String> {
            self.program = Some(program.to_string());
            self.args = args.to_vec();
            self.working_directory = Some(working_directory.to_path_buf());
            self.environment = environment.to_vec();
            if let Some(marker_process_id) = self.marker_process_id {
                let marker_path = environment
                    .iter()
                    .find(|(key, _)| key == "CAVALRY_I18N_DIAGNOSTIC_MARKER")
                    .map(|(_, value)| PathBuf::from(value));
                let language = fs::read_to_string(working_directory.join(LANG_MARKER_NAME))
                    .ok()
                    .map(|value| value.trim().to_string());
                if let (Some(marker_path), Some(language)) = (marker_path, language) {
                    let payload = format!(
                        r#"{{"plugin":"cavalryi18n","status":"ready","message":"installed","language":"{language}","translationSource":"embedded-generated-table","embeddedEntryCount":4,"exactKeyCount":3,"sourceFallbackCount":1,"translatorInstalled":true,"extensionLayerHookStatus":"waiting-for-extension-layer","extensionLayerHookDetail":"ExtensionLayer.dll has not loaded yet.","qtVersion":"6.6.3","processId":"{marker_process_id}"}}"#
                    );
                    fs::write(marker_path, payload).unwrap();
                }
            }
            Ok(self.reported_pid)
        }
    }

    fn write(path: &Path, bytes: &[u8]) {
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::write(path, bytes).unwrap();
    }

    fn fixture(temp: &tempfile::TempDir, lang: &str) -> (PathBuf, PathBuf, PathBuf) {
        let app = temp.path().join("Custom Cavalry");
        let resources = temp.path().join("resources");
        let state_dir = temp.path().join("state");
        write(&app.join("Cavalry.exe"), b"cavalry-binary");
        write(&app.join("assets/Definitions/appStrings.json"), br#"{}"#);
        write(&app.join("assets/Definitions/nodeStrings.json"), br#"{}"#);
        write(&app.join(LANG_MARKER_NAME), format!("{lang}\n").as_bytes());

        if lang != "en" {
            write(
                &resources
                    .join("injector/windows/generic")
                    .join(PLUGIN_FILE_NAME),
                b"trusted-plugin",
            );
            write(
                &app.join("generic").join(PLUGIN_FILE_NAME),
                b"trusted-plugin",
            );
        }

        let revision = detect::read_bundle_revision(&app).unwrap();
        state::write_state(
            &state_dir,
            &State {
                app_path: app.to_string_lossy().to_string(),
                cavalry_version: "2.7.2".to_string(),
                cavalry_revision: revision,
                current_lang: lang.to_string(),
                last_patched_at: String::new(),
                english_snapshot_provenance: None,
            },
        )
        .unwrap();
        (app, resources, state_dir)
    }

    fn active_qpa(_layout: &InstallLayout) -> Result<crate::windows_qpa::QpaInspection, String> {
        Ok(crate::windows_qpa::QpaInspection {
            state: crate::windows_qpa::QpaDeploymentState::Active,
            phase: Some(crate::windows_qpa::QpaManifestPhase::Active),
            current_qwindows_sha256: Some("a".repeat(64)),
            detail: "test-owned ACTIVE inspection".to_string(),
        })
    }

    #[test]
    fn headless_mode_requires_the_exact_single_argument() {
        assert!(launch_requested(&[
            OsString::from("switcher.exe"),
            OsString::from(LAUNCH_ARGUMENT),
        ]));
        assert!(!launch_requested(&[OsString::from("switcher.exe")]));
        assert!(!launch_requested(&[
            OsString::from("switcher.exe"),
            OsString::from(LAUNCH_ARGUMENT),
            OsString::from("extra"),
        ]));
    }

    #[test]
    fn translated_launch_uses_saved_arbitrary_root_and_child_only_environment() {
        let _serial = LAUNCH_TEST_LOCK.lock().unwrap();
        let temp = tempfile::tempdir().unwrap();
        let (app, resources, state_dir) = fixture(&temp, "zh-Hans");
        let mut runner = LaunchRecorder::ready(4242);

        launch_from_paths_with_qpa_inspector(
            temp.path(),
            &state_dir,
            &resources,
            &mut runner,
            active_qpa,
        )
        .unwrap();

        let layout = InstallLayout::from_root(&app);
        assert_eq!(
            Path::new(runner.program.as_deref().unwrap()),
            layout.executable
        );
        assert!(runner.args.is_empty());
        assert_eq!(
            runner.working_directory.as_deref(),
            Some(layout.root.as_path())
        );
        let environment = runner
            .environment
            .iter()
            .map(|(key, value)| {
                (
                    key.to_string_lossy().to_string(),
                    value.to_string_lossy().to_string(),
                )
            })
            .collect::<std::collections::HashMap<_, _>>();
        assert_eq!(environment.len(), 1);
        assert!(Path::new(&environment["CAVALRY_I18N_DIAGNOSTIC_MARKER"]).is_absolute());
        assert!(!environment.contains_key("QT_PLUGIN_PATH"));
        assert!(!environment.contains_key("QT_QPA_GENERIC_PLUGINS"));
        assert!(!environment.contains_key("CAVALRY_I18N_LANG"));
    }

    #[test]
    fn english_launch_has_no_translation_environment_or_plugin_dependency() {
        let _serial = LAUNCH_TEST_LOCK.lock().unwrap();
        let temp = tempfile::tempdir().unwrap();
        let (_app, resources, state_dir) = fixture(&temp, "en");
        let mut runner = LaunchRecorder::ready(4242);

        launch_from_paths_with_qpa_inspector(
            temp.path(),
            &state_dir,
            &resources,
            &mut runner,
            active_qpa,
        )
        .unwrap();

        assert!(runner.environment.is_empty());
        assert!(runner.args.is_empty());
    }

    #[test]
    fn translated_launch_requires_pid_bound_ready_marker() {
        let _serial = LAUNCH_TEST_LOCK.lock().unwrap();
        let temp = tempfile::tempdir().unwrap();
        let (_app, resources, state_dir) = fixture(&temp, "ja_JP");
        let mut wrong_marker = LaunchRecorder {
            reported_pid: Some(4242),
            marker_process_id: Some(4243),
            ..LaunchRecorder::default()
        };

        let marker_error = launch_from_paths_with_qpa_inspector(
            temp.path(),
            &state_dir,
            &resources,
            &mut wrong_marker,
            active_qpa,
        )
        .unwrap_err();
        assert!(
            marker_error.contains("processId mismatch"),
            "{marker_error}"
        );

        let mut missing_pid = LaunchRecorder {
            marker_process_id: Some(4242),
            ..LaunchRecorder::default()
        };
        let pid_error = launch_from_paths_with_qpa_inspector(
            temp.path(),
            &state_dir,
            &resources,
            &mut missing_pid,
            active_qpa,
        )
        .unwrap_err();
        assert!(pid_error.contains("did not report"), "{pid_error}");
    }

    #[test]
    fn active_language_transaction_blocks_headless_spawn() {
        let _serial = LAUNCH_TEST_LOCK.lock().unwrap();
        let temp = tempfile::tempdir().unwrap();
        let (_app, resources, state_dir) = fixture(&temp, "zh-Hans");
        let guard = operation_lock::try_begin_bundle_operation(&state_dir).unwrap();
        let mut runner = LaunchRecorder::ready(4242);

        let error = launch_from_paths_with_qpa_inspector(
            temp.path(),
            &state_dir,
            &resources,
            &mut runner,
            active_qpa,
        )
        .unwrap_err();

        assert_eq!(error, operation_lock::BUSY_ERROR);
        assert!(runner.program.is_none());
        drop(guard);
    }

    #[test]
    fn stale_marker_or_changed_binary_fails_before_spawn() {
        let _serial = LAUNCH_TEST_LOCK.lock().unwrap();
        let temp = tempfile::tempdir().unwrap();
        let (app, resources, state_dir) = fixture(&temp, "zh-Hant");
        fs::write(app.join(LANG_MARKER_NAME), b"en\n").unwrap();
        let mut runner = LaunchRecorder::ready(4242);

        let marker_error = launch_from_paths_with_qpa_inspector(
            temp.path(),
            &state_dir,
            &resources,
            &mut runner,
            active_qpa,
        )
        .unwrap_err();
        assert!(marker_error.contains("does not match"), "{marker_error}");
        assert!(runner.program.is_none());

        fs::write(app.join(LANG_MARKER_NAME), b"zh-Hant\n").unwrap();
        fs::write(app.join("Cavalry.exe"), b"changed-binary").unwrap();
        let revision_error = launch_from_paths_with_qpa_inspector(
            temp.path(),
            &state_dir,
            &resources,
            &mut runner,
            active_qpa,
        )
        .unwrap_err();
        assert!(
            revision_error.contains("installation changed"),
            "{revision_error}"
        );
        assert!(runner.program.is_none());
    }
}
