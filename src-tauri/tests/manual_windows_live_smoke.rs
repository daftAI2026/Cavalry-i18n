/**
 * [INPUT]: 依赖显式 disposable clone/evidence 环境变量、共享 Windows 路径守卫、apply_language_inner、RealCommandRunner、runtime marker 与 PowerShell PID 窗口证据 helper
 * [OUTPUT]: 对外提供 ignored Windows live-clone 冒烟：可选单语或默认三语真实启动、隔离 AppData、三类自动 PNG、带零位图基线与严格计数增量的人工 Cog Pitch PNG、PID 清理及 English 38 文件恢复
 * [POS]: src-tauri/tests 的 Windows GUI 现场证据门；自动路径只向 exact HWND 投递 A 键，Cog Pitch 仅在 opt-in 后记录前后诊断并等待用户操作 sentinel clone，不创建场景、不运行脚本、不依赖 Qt UIA
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#[cfg(target_os = "windows")]
#[path = "support/windows_disposable.rs"]
mod windows_disposable;

#[cfg(target_os = "windows")]
mod windows_live_smoke {
    use super::windows_disposable::{
        assert_safe_write_surface, disposable_install_layout, path_is_same, GuardedTempRoot,
    };
    use cavalry_i18n_tauri::{
        commands::apply_language_inner,
        install::InstallLayout,
        patch::{self, CopyPair},
        privilege::{CommandRunner, RealCommandRunner, RecordingRunner},
        state, windows_runtime,
    };
    use serde::Deserialize;
    use sha2::{Digest, Sha256};
    use std::{
        collections::{BTreeMap, BTreeSet},
        env,
        ffi::OsString,
        fs,
        panic::{catch_unwind, AssertUnwindSafe},
        path::{Path, PathBuf},
    };

    const SMOKE_APP_ENV: &str = "CAVALRY_I18N_WINDOWS_SMOKE_APP";
    const EVIDENCE_ROOT_ENV: &str = "CAVALRY_I18N_WINDOWS_LIVE_EVIDENCE_DIR";
    const LANGUAGE_FILTER_ENV: &str = "CAVALRY_I18N_WINDOWS_LIVE_LANGUAGE";
    const MANUAL_COG_PITCH_ENV: &str = "CAVALRY_I18N_WINDOWS_LIVE_COG_PITCH";
    const EXPECTED_JSON_COUNT: usize = 38;
    const PROCESS_TIMEOUT_MILLISECONDS: u32 = 45_000;
    const MANUAL_COG_PITCH_TIMEOUT_MILLISECONDS: u32 = 180_000;
    const NOW: &str = "2026-07-24T00:00:00.000Z";
    const PNG_SIGNATURE: &[u8; 8] = b"\x89PNG\r\n\x1a\n";

    #[derive(Debug, Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct CavalryProcess {
        process_id: u32,
        executable_path: String,
    }

    #[derive(Debug, Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct CaptureResult {
        process_id: u32,
        executable_path: String,
        language: String,
        qt_version: String,
        translation_source: String,
        embedded_entry_count: usize,
        exact_key_count: usize,
        source_fallback_count: usize,
        extension_layer_hook_status: String,
        extension_layer_text_path_diagnostics: TextPathDiagnostics,
        text_path_baseline_diagnostics: Option<TextPathDiagnostics>,
        window_handle: String,
        width: u32,
        height: u32,
        output_path: String,
        capture_scenario: String,
        interaction_evidence: String,
    }

    #[derive(Debug, Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct TextPathDiagnostics {
        revision: u64,
        canonical_calls: u64,
        whitelist_calls: u64,
        cjk_path_success: u64,
        original_fallback: u64,
        no_translation: u64,
        renderer_failure: u64,
        translated_source_mask: u16,
        fallback_source_mask: u16,
    }

    #[derive(Debug, Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct CloseResult {
        process_id: u32,
        status: String,
    }

    #[derive(Debug)]
    struct ScreenshotEvidence {
        language: String,
        scenario: String,
        path: PathBuf,
        sha256: String,
        width: u32,
        height: u32,
        interaction_evidence: String,
    }

    fn repo_root() -> PathBuf {
        Path::new(env!("CARGO_MANIFEST_DIR"))
            .parent()
            .expect("src-tauri must remain below the repository root")
            .to_path_buf()
    }

    fn helper_path(repo: &Path) -> Result<PathBuf, String> {
        let helper = repo.join("tools/capture_windows_pid_window.ps1");
        if !helper.is_file() {
            return Err(format!(
                "Windows live-smoke helper does not exist: {}",
                helper.display()
            ));
        }
        Ok(helper)
    }

    fn invoke_helper(
        runner: &mut RealCommandRunner,
        helper: &Path,
        arguments: &[String],
    ) -> Result<String, String> {
        let mut args = vec![
            "-NoLogo".to_string(),
            "-NoProfile".to_string(),
            "-NonInteractive".to_string(),
            "-ExecutionPolicy".to_string(),
            "Bypass".to_string(),
            "-File".to_string(),
            helper.to_string_lossy().to_string(),
        ];
        args.extend(arguments.iter().cloned());
        let status = runner.run_captured("powershell.exe", &args)?;
        if status.exit_code != Some(0) {
            return Err(format!(
                "Windows live-smoke helper failed with {:?}. stdout={} stderr={}",
                status.exit_code,
                status.stdout.trim(),
                status.stderr.trim()
            ));
        }
        let output = status.stdout.trim();
        if output.is_empty() {
            return Err("Windows live-smoke helper returned empty output.".to_string());
        }
        Ok(output.to_string())
    }

    fn cavalry_inventory(
        runner: &mut RealCommandRunner,
        helper: &Path,
    ) -> Result<Vec<CavalryProcess>, String> {
        let output = invoke_helper(
            runner,
            helper,
            &["-Action".to_string(), "Inventory".to_string()],
        )?;
        serde_json::from_str(&output)
            .map_err(|error| format!("invalid Cavalry process inventory JSON: {error}: {output}"))
    }

    fn require_no_cavalry_processes(
        runner: &mut RealCommandRunner,
        helper: &Path,
        phase: &str,
    ) -> Result<(), String> {
        let processes = cavalry_inventory(runner, helper)?;
        if processes.is_empty() {
            return Ok(());
        }
        let detail = processes
            .iter()
            .map(|process| {
                format!(
                    "pid={} executable={}",
                    process.process_id,
                    if process.executable_path.is_empty() {
                        "<unavailable>"
                    } else {
                        process.executable_path.as_str()
                    }
                )
            })
            .collect::<Vec<_>>()
            .join(", ");
        Err(format!(
            "refusing Windows live smoke because Cavalry.exe exists during {phase}: {detail}"
        ))
    }

    fn close_owned_process(
        runner: &mut RealCommandRunner,
        helper: &Path,
        process_id: u32,
        executable: &Path,
    ) -> Result<(), String> {
        let output = invoke_helper(
            runner,
            helper,
            &[
                "-Action".to_string(),
                "Close".to_string(),
                "-TargetProcessId".to_string(),
                process_id.to_string(),
                "-ExecutablePath".to_string(),
                executable.to_string_lossy().to_string(),
                "-TimeoutMilliseconds".to_string(),
                PROCESS_TIMEOUT_MILLISECONDS.to_string(),
            ],
        )?;
        let result = serde_json::from_str::<CloseResult>(&output)
            .map_err(|error| format!("invalid graceful-close JSON: {error}: {output}"))?;
        if result.process_id != process_id
            || !matches!(result.status.as_str(), "closed" | "already-exited")
        {
            return Err(format!(
                "unexpected graceful-close result for pid {process_id}: {output}"
            ));
        }
        Ok(())
    }

    fn capture_main_window(
        runner: &mut RealCommandRunner,
        helper: &Path,
        evidence_root: &GuardedTempRoot,
        process_id: u32,
        executable: &Path,
        marker: &Path,
        language: &str,
        capture_scenario: &str,
        output: &Path,
    ) -> Result<ScreenshotEvidence, String> {
        evidence_root.assert_write_target(marker)?;
        evidence_root.assert_write_target(output)?;
        if output.exists() {
            return Err(format!(
                "refusing to overwrite screenshot evidence {}",
                output.display()
            ));
        }
        let timeout_milliseconds = if capture_scenario == "CogPitch" {
            MANUAL_COG_PITCH_TIMEOUT_MILLISECONDS
        } else {
            PROCESS_TIMEOUT_MILLISECONDS
        };
        let mut arguments = vec![
            "-Action".to_string(),
            "Capture".to_string(),
            "-TargetProcessId".to_string(),
            process_id.to_string(),
            "-ExecutablePath".to_string(),
            executable.to_string_lossy().to_string(),
            "-MarkerPath".to_string(),
            marker.to_string_lossy().to_string(),
            "-Language".to_string(),
            language.to_string(),
            "-CaptureScenario".to_string(),
            capture_scenario.to_string(),
            "-EvidenceRoot".to_string(),
            evidence_root.root().to_string_lossy().to_string(),
            "-OutputPath".to_string(),
            output.to_string_lossy().to_string(),
            "-TimeoutMilliseconds".to_string(),
            timeout_milliseconds.to_string(),
        ];
        if capture_scenario == "CogPitch" {
            arguments.push("-AllowManualCogPitch".to_string());
        }
        let payload = invoke_helper(runner, helper, &arguments)?;
        let result = serde_json::from_str::<CaptureResult>(&payload)
            .map_err(|error| format!("invalid window-capture JSON: {error}: {payload}"))?;
        let required_text_path_mask = match capture_scenario {
            "ViewportQuality" => 0x0001,
            "TransformHelper" => 0x7c00,
            "EditShapeHelper" => 0x03f0,
            "CogPitch" => 0x8000,
            _ => 0,
        };
        let diagnostics = &result.extension_layer_text_path_diagnostics;
        let cog_pitch_delta_is_valid = match (
            capture_scenario,
            result.text_path_baseline_diagnostics.as_ref(),
        ) {
            ("CogPitch", Some(baseline)) => {
                baseline.renderer_failure == 0
                    && baseline.fallback_source_mask == 0
                    && baseline.translated_source_mask & 0x8000 == 0
                    && diagnostics.revision > baseline.revision
                    && diagnostics.canonical_calls > baseline.canonical_calls
                    && diagnostics.whitelist_calls > baseline.whitelist_calls
                    && diagnostics.cjk_path_success > baseline.cjk_path_success
            }
            ("CogPitch", None) => false,
            (_, None) => true,
            (_, Some(_)) => false,
        };
        if result.process_id != process_id
            || !path_is_same(Path::new(&result.executable_path), executable)
            || result.language != language
            || result.qt_version != windows_runtime::EXPECTED_QT_VERSION
            || result.translation_source != windows_runtime::EXPECTED_TRANSLATION_SOURCE
            || result.embedded_entry_count == 0
            || result.exact_key_count == 0
            || result.source_fallback_count == 0
            || result.extension_layer_hook_status != "installed"
            || diagnostics.renderer_failure != 0
            || diagnostics.fallback_source_mask != 0
            || diagnostics.canonical_calls < diagnostics.whitelist_calls
            || diagnostics.whitelist_calls < diagnostics.cjk_path_success
            || diagnostics.original_fallback < diagnostics.no_translation
            || diagnostics.translated_source_mask & required_text_path_mask
                != required_text_path_mask
            || (required_text_path_mask != 0
                && (diagnostics.revision == 0 || diagnostics.cjk_path_success == 0))
            || result.window_handle.is_empty()
            || result.window_handle == "0"
            || result.width == 0
            || result.height == 0
            || !path_is_same(Path::new(&result.output_path), output)
            || result.capture_scenario != capture_scenario
            || result.interaction_evidence.is_empty()
            || !cog_pitch_delta_is_valid
        {
            return Err(format!(
                "window capture did not satisfy PID/Qt/table/lang/ExtensionLayer/window contract: {payload}"
            ));
        }
        evidence_root.assert_write_target(output)?;
        let png = fs::read(output)
            .map_err(|error| format!("could not read screenshot {}: {error}", output.display()))?;
        if !png.starts_with(PNG_SIGNATURE) {
            return Err(format!(
                "window evidence is not a PNG: {}",
                output.display()
            ));
        }
        let sha256 = format!("{:x}", Sha256::digest(&png));
        Ok(ScreenshotEvidence {
            language: language.to_string(),
            scenario: capture_scenario.to_string(),
            path: output.to_path_buf(),
            sha256,
            width: result.width,
            height: result.height,
            interaction_evidence: result.interaction_evidence,
        })
    }

    fn find_node_type<'a>(
        value: &'a serde_json::Value,
        node_type: &str,
    ) -> Option<&'a serde_json::Value> {
        match value {
            serde_json::Value::Object(object) => {
                if object.get("nodeType").and_then(serde_json::Value::as_str) == Some(node_type) {
                    return Some(value);
                }
                object
                    .values()
                    .find_map(|child| find_node_type(child, node_type))
            }
            serde_json::Value::Array(values) => values
                .iter()
                .find_map(|child| find_node_type(child, node_type)),
            _ => None,
        }
    }

    fn installed_smoothing_steps(layout: &InstallLayout) -> Result<String, String> {
        let node_strings = layout.assets_root.join("Definitions/nodeStrings.json");
        let catalog: serde_json::Value = serde_json::from_slice(
            &fs::read(&node_strings)
                .map_err(|error| format!("could not read {}: {error}", node_strings.display()))?,
        )
        .map_err(|error| format!("invalid {}: {error}", node_strings.display()))?;
        find_node_type(&catalog, "smoother")
            .and_then(|node| node["attributes"]["smoothingSteps"].as_str())
            .map(str::to_string)
            .ok_or_else(|| {
                format!(
                    "{} does not contain smoother.attributes.smoothingSteps",
                    node_strings.display()
                )
            })
    }

    fn capture_english_baseline(
        repo: &Path,
        layout: &InstallLayout,
        guarded_clone: &GuardedTempRoot,
    ) -> Result<(Vec<CopyPair>, BTreeMap<PathBuf, Vec<u8>>), String> {
        let english_source = repo.join("languages/en");
        if !patch::install_matches_language_source(&english_source, &layout.root)? {
            return Err(
                "disposable live clone must start from packaged English resources".to_string(),
            );
        }
        let pairs = patch::build_copy_pairs(&english_source, &layout.root);
        if pairs.len() != EXPECTED_JSON_COUNT {
            return Err(format!(
                "English live-clone baseline requires exactly {EXPECTED_JSON_COUNT} JSON files, found {}",
                pairs.len()
            ));
        }
        assert_safe_write_surface(guarded_clone, layout, &pairs)?;
        let baseline = pairs
            .iter()
            .map(|pair| {
                fs::read(&pair.dst)
                    .map(|bytes| (pair.dst.clone(), bytes))
                    .map_err(|error| {
                        format!(
                            "could not capture English baseline {}: {error}",
                            pair.dst.display()
                        )
                    })
            })
            .collect::<Result<BTreeMap<_, _>, _>>()?;
        Ok((pairs, baseline))
    }

    fn prepare_state_surface(
        evidence_root: &GuardedTempRoot,
        run_root: &Path,
        baseline_pairs: &[CopyPair],
        english_source: &Path,
    ) -> Result<PathBuf, String> {
        let state_dir = run_root.join("state");
        evidence_root.assert_write_target(&state_dir)?;
        fs::create_dir(&state_dir).map_err(|error| {
            format!(
                "could not create live-smoke state directory {}: {error}",
                state_dir.display()
            )
        })?;
        evidence_root.assert_write_target(&state_dir)?;
        evidence_root.assert_write_target(&state_dir.join("state.json"))?;
        evidence_root.assert_write_target(&state_dir.join("runtime"))?;
        evidence_root.assert_write_target(&windows_runtime::diagnostic_marker_path(&state_dir))?;
        for pair in baseline_pairs {
            let relative = pair.src.strip_prefix(english_source).map_err(|_| {
                format!(
                    "English baseline source escaped {}: {}",
                    english_source.display(),
                    pair.src.display()
                )
            })?;
            evidence_root.assert_write_target(&state_dir.join("en").join(relative))?;
        }
        Ok(state_dir)
    }

    fn verify_applied_language(
        repo: &Path,
        state_dir: &Path,
        layout: &InstallLayout,
        guarded_clone: &GuardedTempRoot,
        baseline_pairs: &[CopyPair],
        language: &str,
        smoothing_steps: &str,
    ) -> Result<(), String> {
        assert_safe_write_surface(guarded_clone, layout, baseline_pairs)?;
        if !patch::install_matches_language_source(
            &repo.join("languages").join(language),
            &layout.root,
        )? {
            return Err(format!(
                "{language} did not apply every known core/plugin JSON leaf"
            ));
        }
        if installed_smoothing_steps(layout)? != smoothing_steps {
            return Err(format!(
                "{language} did not apply smoother.attributes.smoothingSteps"
            ));
        }
        let marker = fs::read_to_string(&layout.language_marker).map_err(|error| {
            format!(
                "could not read language marker {}: {error}",
                layout.language_marker.display()
            )
        })?;
        if marker.trim() != language {
            return Err(format!(
                "language marker expected {language}, got {}",
                marker.trim()
            ));
        }
        let current_state = state::read_state(state_dir)
            .ok_or_else(|| format!("state is missing after applying {language}"))?;
        if current_state.current_lang != language {
            return Err(format!(
                "state expected {language}, got {}",
                current_state.current_lang
            ));
        }
        Ok(())
    }

    fn apply_without_elevation(
        repo: &Path,
        state_dir: &Path,
        layout: &InstallLayout,
        language: &str,
    ) -> Result<(), String> {
        let mut runner = RecordingRunner::default();
        let applied = apply_language_inner(
            repo,
            state_dir,
            repo,
            &layout.root,
            language,
            &mut runner,
            NOW,
        )?;
        if !applied.ok || applied.current_lang.as_deref() != Some(language) {
            return Err(format!("{language} apply returned an invalid payload"));
        }
        if !runner.commands.is_empty() {
            return Err(format!(
                "{language} disposable clone unexpectedly required an external/elevated command"
            ));
        }
        Ok(())
    }

    #[allow(clippy::too_many_arguments)]
    fn launch_capture_and_close(
        repo: &Path,
        helper: &Path,
        state_dir: &Path,
        layout: &InstallLayout,
        evidence_root: &GuardedTempRoot,
        run_root: &Path,
        profile_root: &Path,
        language: &str,
        runner: &mut RealCommandRunner,
        outstanding_processes: &mut BTreeSet<u32>,
    ) -> Result<Vec<ScreenshotEvidence>, String> {
        let expected_marker = windows_runtime::diagnostic_marker_path(state_dir);
        evidence_root.assert_write_target(&expected_marker)?;
        let current_state = state::read_state(state_dir)
            .ok_or_else(|| format!("state is missing before launching {language}"))?;
        let mut launch =
            windows_runtime::prepare_launch(layout, state_dir, &current_state, repo, repo)?;
        let local_app_data = profile_root.join("Local");
        let roaming_app_data = profile_root.join("Roaming");
        evidence_root.assert_write_target(&local_app_data)?;
        evidence_root.assert_write_target(&roaming_app_data)?;
        fs::create_dir_all(&local_app_data).map_err(|error| {
            format!(
                "could not create isolated LOCALAPPDATA {}: {error}",
                local_app_data.display()
            )
        })?;
        fs::create_dir_all(&roaming_app_data).map_err(|error| {
            format!(
                "could not create isolated APPDATA {}: {error}",
                roaming_app_data.display()
            )
        })?;
        launch.environment.push((
            OsString::from("LOCALAPPDATA"),
            local_app_data.as_os_str().to_os_string(),
        ));
        launch.environment.push((
            OsString::from("APPDATA"),
            roaming_app_data.as_os_str().to_os_string(),
        ));
        let marker = launch
            .diagnostic_marker
            .ok_or_else(|| format!("{language} launch did not request a diagnostic marker"))?;
        if !path_is_same(&marker, &expected_marker) {
            return Err(format!(
                "{language} diagnostic marker escaped guarded state: {}",
                marker.display()
            ));
        }
        evidence_root.assert_write_target(&marker)?;
        let launch_arguments = Vec::new();
        let process_id = runner
            .spawn_detached_in_with_env_and_pid(
                &layout.executable.to_string_lossy(),
                &launch_arguments,
                &layout.root,
                &launch.environment,
            )?
            .ok_or_else(|| {
                "Windows live-smoke runner did not report the launched Cavalry process id."
                    .to_string()
            })?;
        if !outstanding_processes.insert(process_id) {
            return Err(format!(
                "spawned Cavalry pid {process_id} is already outstanding"
            ));
        }
        windows_runtime::wait_for_ready_marker(&marker, language, process_id)?;

        let mut scenarios = vec![
            ("ViewportQuality", "viewport-quality"),
            ("TransformHelper", "transform-helper"),
            ("EditShapeHelper", "edit-shape-helper"),
        ];
        if env::var(MANUAL_COG_PITCH_ENV).as_deref() == Ok("1") {
            scenarios.push(("CogPitch", "cog-pitch"));
        }
        let mut evidence = Vec::with_capacity(scenarios.len());
        for (capture_scenario, artifact) in scenarios {
            let output = run_root.join(format!("{language}-{artifact}.png"));
            evidence.push(capture_main_window(
                runner,
                helper,
                evidence_root,
                process_id,
                &layout.executable,
                &marker,
                language,
                capture_scenario,
                &output,
            )?);
        }
        close_owned_process(runner, helper, process_id, &layout.executable)?;
        if !outstanding_processes.remove(&process_id) {
            return Err(format!(
                "closed Cavalry pid {process_id} was not outstanding"
            ));
        }
        require_no_cavalry_processes(runner, helper, &format!("after {language} close"))?;
        Ok(evidence)
    }

    #[allow(clippy::too_many_arguments)]
    fn exercise_languages(
        repo: &Path,
        helper: &Path,
        state_dir: &Path,
        layout: &InstallLayout,
        guarded_clone: &GuardedTempRoot,
        evidence_root: &GuardedTempRoot,
        run_root: &Path,
        profile_root: &Path,
        baseline_pairs: &[CopyPair],
        runner: &mut RealCommandRunner,
        outstanding_processes: &mut BTreeSet<u32>,
    ) -> Result<Vec<ScreenshotEvidence>, String> {
        let mut evidence = Vec::new();
        let requested_language = env::var(LANGUAGE_FILTER_ENV).ok();
        if let Some(language) = requested_language.as_deref() {
            if !matches!(language, "zh-Hans" | "zh-Hant" | "ja_JP") {
                return Err(format!(
                    "{LANGUAGE_FILTER_ENV} must be zh-Hans, zh-Hant, or ja_JP"
                ));
            }
        }
        for (language, smoothing_steps) in [
            ("zh-Hans", "平滑步数"),
            ("zh-Hant", "平滑步數"),
            ("ja_JP", "スムージングステップ数"),
        ] {
            if requested_language
                .as_deref()
                .is_some_and(|value| value != language)
            {
                continue;
            }
            require_no_cavalry_processes(runner, helper, &format!("before {language} apply"))?;
            apply_without_elevation(repo, state_dir, layout, language)?;
            verify_applied_language(
                repo,
                state_dir,
                layout,
                guarded_clone,
                baseline_pairs,
                language,
                smoothing_steps,
            )?;
            evidence.extend(launch_capture_and_close(
                repo,
                helper,
                state_dir,
                layout,
                evidence_root,
                run_root,
                profile_root,
                language,
                runner,
                outstanding_processes,
            )?);
        }
        Ok(evidence)
    }

    #[allow(clippy::too_many_arguments)]
    fn cleanup_and_restore(
        repo: &Path,
        helper: &Path,
        state_dir: &Path,
        layout: &InstallLayout,
        guarded_clone: &GuardedTempRoot,
        baseline_pairs: &[CopyPair],
        baseline: &BTreeMap<PathBuf, Vec<u8>>,
        runner: &mut RealCommandRunner,
        outstanding_processes: &mut BTreeSet<u32>,
    ) -> Result<(), String> {
        let mut failures = Vec::new();
        for process_id in outstanding_processes
            .iter()
            .rev()
            .copied()
            .collect::<Vec<_>>()
        {
            match close_owned_process(runner, helper, process_id, &layout.executable) {
                Ok(()) => {
                    outstanding_processes.remove(&process_id);
                }
                Err(error) => {
                    failures.push(format!(
                        "could not gracefully close outstanding test pid {process_id}: {error}"
                    ));
                }
            }
        }

        if let Err(error) = apply_without_elevation(repo, state_dir, layout, "en") {
            failures.push(format!("English restore failed: {error}"));
        } else {
            if let Err(error) = assert_safe_write_surface(guarded_clone, layout, baseline_pairs) {
                failures.push(format!("restored write surface became unsafe: {error}"));
            }
            match patch::install_matches_language_source(&repo.join("languages/en"), &layout.root) {
                Ok(true) => {}
                Ok(false) => failures
                    .push("restored clone does not match packaged English leaves.".to_string()),
                Err(error) => failures.push(format!(
                    "could not verify restored English resources: {error}"
                )),
            }
            match installed_smoothing_steps(layout) {
                Ok(value) if value == "Smoothing Steps" => {}
                Ok(value) => failures.push(format!(
                    "English restore kept unexpected smoother text: {value}"
                )),
                Err(error) => {
                    failures.push(format!("could not verify restored smoother text: {error}"))
                }
            }
            if baseline.len() != EXPECTED_JSON_COUNT {
                failures.push(format!(
                    "English baseline changed from {EXPECTED_JSON_COUNT} files to {}",
                    baseline.len()
                ));
            }
            for (destination, original) in baseline {
                match fs::read(destination) {
                    Ok(restored) if restored == *original => {}
                    Ok(_) => failures.push(format!(
                        "English restore did not byte-restore {}",
                        destination.display()
                    )),
                    Err(error) => failures.push(format!(
                        "could not read restored {}: {error}",
                        destination.display()
                    )),
                }
            }
        }

        for process_id in outstanding_processes
            .iter()
            .rev()
            .copied()
            .collect::<Vec<_>>()
        {
            match close_owned_process(runner, helper, process_id, &layout.executable) {
                Ok(()) => {
                    outstanding_processes.remove(&process_id);
                }
                Err(error) => {
                    failures.push(format!(
                        "final graceful close failed for outstanding test pid {process_id}: {error}"
                    ));
                }
            }
        }
        if let Err(error) = require_no_cavalry_processes(runner, helper, "final global audit") {
            failures.push(error);
        }
        if failures.is_empty() {
            Ok(())
        } else {
            Err(failures.join(" | "))
        }
    }

    fn describe_panic(payload: &(dyn std::any::Any + Send)) -> String {
        if let Some(message) = payload.downcast_ref::<String>() {
            message.clone()
        } else if let Some(message) = payload.downcast_ref::<&str>() {
            (*message).to_string()
        } else {
            "non-string Rust panic payload".to_string()
        }
    }

    #[test]
    fn live_helper_uses_exact_hwnd_key_and_forbids_scene_automation() {
        let repo = repo_root();
        let helper = fs::read_to_string(repo.join("tools/capture_windows_pid_window.ps1"))
            .expect("live helper must remain readable");
        for forbidden in [
            "ClickScreenPoint",
            "SetCursorPos",
            "mouse_event",
            "ViewportSettingsPoint",
            "Viewport Settings",
        ] {
            assert!(
                !helper.contains(forbidden),
                "live helper must not contain retired scene/UIA/coordinate path {forbidden}"
            );
        }
        for required in [
            "PostVirtualKey",
            "WM_KEYDOWN",
            "WM_KEYUP",
            "0x41",
            "exact-hwnd-postmessage-vk-a",
            "path-pixels=manual-review-required",
            "Assert-ExactForegroundWindow",
            "Assert-ForegroundProcess",
            "Wait-ForTextPathDiagnostics",
            "BaselineDiagnostics",
            "canonicalCalls",
            "whitelistCalls",
            "cjkPathSuccess",
            "fallbackSourceMask",
            "rendererFailure",
            "CogPitch",
            "0x8000",
            "AllowManualCogPitch",
            "manual-disposable-cogwheel-drag",
            "pre-set Pitch bit 15",
        ] {
            assert!(
                helper.contains(required),
                "live helper must retain fail-closed evidence token {required}"
            );
        }
    }

    #[test]
    #[ignore = "requires explicit disposable clone/evidence TEMP roots and produces PNGs that require human review; never run against a real installation"]
    fn disposable_clone_captures_three_languages_for_required_manual_review() {
        let repo = repo_root();
        let helper = helper_path(&repo).unwrap_or_else(|error| panic!("{error}"));
        let (layout, guarded_clone) = disposable_install_layout(SMOKE_APP_ENV)
            .unwrap_or_else(|error| panic!("invalid {SMOKE_APP_ENV}: {error}"));
        let evidence_root = GuardedTempRoot::from_env(EVIDENCE_ROOT_ENV)
            .unwrap_or_else(|error| panic!("invalid {EVIDENCE_ROOT_ENV}: {error}"));
        let mut runner = RealCommandRunner;

        require_no_cavalry_processes(&mut runner, &helper, "startup")
            .unwrap_or_else(|error| panic!("{error}"));
        let (baseline_pairs, baseline) = capture_english_baseline(&repo, &layout, &guarded_clone)
            .unwrap_or_else(|error| panic!("{error}"));
        let run_root = evidence_root
            .create_unique_child_directory("windows-live")
            .unwrap_or_else(|error| panic!("{error}"));
        let profile_root = run_root.join("profile");
        evidence_root
            .assert_write_target(&profile_root)
            .unwrap_or_else(|error| panic!("{error}"));
        let english_source = repo.join("languages/en");
        let state_dir =
            prepare_state_surface(&evidence_root, &run_root, &baseline_pairs, &english_source)
                .unwrap_or_else(|error| panic!("{error}"));

        let mut outstanding_processes = BTreeSet::new();
        let exercise = catch_unwind(AssertUnwindSafe(|| {
            exercise_languages(
                &repo,
                &helper,
                &state_dir,
                &layout,
                &guarded_clone,
                &evidence_root,
                &run_root,
                &profile_root,
                &baseline_pairs,
                &mut runner,
                &mut outstanding_processes,
            )
        }));
        let cleanup = cleanup_and_restore(
            &repo,
            &helper,
            &state_dir,
            &layout,
            &guarded_clone,
            &baseline_pairs,
            &baseline,
            &mut runner,
            &mut outstanding_processes,
        );

        let mut failures = Vec::new();
        let screenshots = match exercise {
            Ok(Ok(screenshots)) => Some(screenshots),
            Ok(Err(error)) => {
                failures.push(format!("exercise error: {error}"));
                None
            }
            Err(payload) => {
                failures.push(format!(
                    "exercise panic: {}",
                    describe_panic(payload.as_ref())
                ));
                None
            }
        };
        if let Err(error) = cleanup {
            failures.push(format!("cleanup error: {error}"));
        }
        if !failures.is_empty() {
            panic!(
                "Windows live-clone automated evidence failed: {}; evidence_root={}",
                failures.join(" | "),
                run_root.display()
            );
        }
        let screenshots = screenshots.expect("successful exercise did not return screenshots");
        for screenshot in &screenshots {
            eprintln!(
                "MANUAL SCREENSHOT: language={} scenario={} png={} sha256={} dimensions={}x{} interaction={}",
                screenshot.language,
                screenshot.scenario,
                screenshot.path.display(),
                screenshot.sha256,
                screenshot.width,
                screenshot.height,
                screenshot.interaction_evidence
            );
        }
        panic!(
            "MANUAL SCREENSHOT REVIEW REQUIRED: automated PID/Qt/table/lang/ExtensionLayer/window checks passed and English was restored, but no OCR assertion was performed. Each language has exact-PID Viewport Quality and Transform PNGs from the initial empty scene plus an Edit Shape PNG staged only by exact-HWND PostMessage VK_A below {}. When CAVALRY_I18N_WINDOWS_LIVE_COG_PITCH=1, it also has a manually triggered Cogwheel Pitch PNG whose recorded baseline has bit 15 clear and whose final revision/canonical/whitelist/CJK-success counters all strictly increase with zero fallback. Manually verify their visible localized text and explicitly append screenshots for menus, dropdowns, four empty states, and Snippet before accepting Windows GUI translation.",
            run_root.display()
        );
    }
}
