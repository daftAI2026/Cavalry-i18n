/**
 * [INPUT]: 依赖 live smoke 公共常量、exact-PID PowerShell helper、acceptance-only Onboarding state 与受守卫证据根
 * [OUTPUT]: 在父测试模块内提供进程盘点、先 WM_CLOSE 后 exact-PID 强制兜底的清理、主窗截图、Onboarding 五步 state/原子 ACK 与共享证据数据结构
 * [POS]: src-tauri/tests/support 的现场捕获分片；只编入 ignored Windows live gate，不单独启动进程或写未守卫路径
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
    const SMOKE_APP_ENV: &str = "CAVALRY_I18N_WINDOWS_SMOKE_APP";
    const EVIDENCE_ROOT_ENV: &str = "CAVALRY_I18N_WINDOWS_LIVE_EVIDENCE_DIR";
    const LANGUAGE_FILTER_ENV: &str = "CAVALRY_I18N_WINDOWS_LIVE_LANGUAGE";
    const MANUAL_COG_PITCH_ENV: &str = "CAVALRY_I18N_WINDOWS_LIVE_COG_PITCH";
    const ONBOARDING_ACCEPTANCE_ENV: &str = "CAVALRY_I18N_WINDOWS_ONBOARDING_ACCEPTANCE_DIR";
    const ADJACENT_ACCEPTANCE_ENV: &str = "CAVALRY_I18N_WINDOWS_ADJACENT_ACCEPTANCE_DIR";
    const ADJACENT_REPLACE_FIXTURE_ENV: &str = "CAVALRY_I18N_WINDOWS_ADJACENT_REPLACE_FIXTURE";
    const ADJACENT_DYNAMIC_FIXTURE_ENV: &str = "CAVALRY_I18N_WINDOWS_ADJACENT_DYNAMIC_FIXTURE";
    const ACCEPTANCE_LANGUAGE_ENV: &str = "CAVALRY_I18N_WINDOWS_ACCEPTANCE_LANGUAGE";
    const EXPECTED_JSON_COUNT: usize = 38;
    const PROCESS_TIMEOUT_MILLISECONDS: u32 = 45_000;
    const CLEANUP_CLOSE_TIMEOUT_MILLISECONDS: u32 = 5_000;
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
        capture_method: String,
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
        translated_source_mask: u64,
        fallback_source_mask: u64,
    }

    #[derive(Debug, Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct CloseResult {
        process_id: u32,
        status: String,
    }

    #[derive(Debug, Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct OnboardingAcceptanceMarker {
        enabled: bool,
        status: String,
        message: String,
        step: usize,
        total_steps: usize,
        guide_id: String,
        action_object_name: String,
        action_identity: String,
        action_was_enabled: bool,
        action_temporarily_enabled: bool,
        choice_class: String,
        choice_producer_class: String,
        guide_parameter_type: String,
        guide_class: String,
        window_handle: String,
        title: String,
        body: String,
        title_matches: bool,
        body_matches: bool,
        manager_temporarily_enabled: bool,
        manager_enable_bypass_used: bool,
        manager_disabled_state_restored: bool,
        workspace_reset_prompt_observed: bool,
        workspace_reset_avoided: bool,
        startup_settled: bool,
        observed_actions: Vec<String>,
        observed_texts: Vec<String>,
    }

    #[derive(Debug, Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct OnboardingAcceptanceState {
        language: String,
        process_id: String,
        onboarding_acceptance: OnboardingAcceptanceMarker,
    }

    #[derive(Debug, Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct AdjacentCaptureTarget {
        widget_class: String,
        window_handle: String,
        capture_path: String,
        capture_method: String,
    }

    #[derive(Debug, Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct AdjacentCaptureReady {
        schema: String,
        language: String,
        pid: u32,
        sequence: usize,
        surface: String,
        target: AdjacentCaptureTarget,
        result: serde_json::Value,
    }

    #[derive(Debug, Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct AdjacentDone {
        schema: String,
        status: String,
        reason: String,
        language: String,
        pid: u32,
        logical_result_count: usize,
        capture_count: usize,
        logical_results: Vec<serde_json::Value>,
        captures: Vec<serde_json::Value>,
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

    #[derive(Clone, Copy, Debug, Eq, PartialEq)]
    enum LiveCaptureMode {
        FullSurfaces,
        Onboarding,
        Adjacent,
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
                CLEANUP_CLOSE_TIMEOUT_MILLISECONDS.to_string(),
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

    fn force_stop_owned_process(
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
                "ForceStop".to_string(),
                "-TargetProcessId".to_string(),
                process_id.to_string(),
                "-ExecutablePath".to_string(),
                executable.to_string_lossy().to_string(),
                "-TimeoutMilliseconds".to_string(),
                CLEANUP_CLOSE_TIMEOUT_MILLISECONDS.to_string(),
            ],
        )?;
        let result = serde_json::from_str::<CloseResult>(&output)
            .map_err(|error| format!("invalid force-stop JSON: {error}: {output}"))?;
        if result.process_id != process_id
            || !matches!(
                result.status.as_str(),
                "force-stopped" | "already-exited"
            )
        {
            return Err(format!(
                "unexpected force-stop result for pid {process_id}: {output}"
            ));
        }
        Ok(())
    }

    fn cleanup_owned_process(
        runner: &mut RealCommandRunner,
        helper: &Path,
        process_id: u32,
        executable: &Path,
    ) -> Result<(), String> {
        match close_owned_process(runner, helper, process_id, executable) {
            Ok(()) => Ok(()),
            Err(graceful_error) => {
                force_stop_owned_process(runner, helper, process_id, executable).map_err(
                    |force_error| {
                        format!(
                            "could not clean exact test pid {process_id}: graceful={graceful_error}; force={force_error}"
                        )
                    },
                )
            }
        }
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
        expected_window_handle: Option<&str>,
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
        if let Some(window_handle) = expected_window_handle {
            arguments.push("-ExpectedWindowHandle".to_string());
            arguments.push(window_handle.to_string());
        }
        let payload = invoke_helper(runner, helper, &arguments)?;
        let result = serde_json::from_str::<CaptureResult>(&payload)
            .map_err(|error| format!("invalid window-capture JSON: {error}: {payload}"))?;
        let required_text_path_mask = match capture_scenario {
            "ViewportQuality" => 0x0001,
            "TransformHelper" => 0x01c0_7c00,
            "EditShapeHelper" => 0x0e00_03f0,
            "CogPitch" => 0x1000_0000,
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
                    && baseline.translated_source_mask & 0x1000_0000 == 0
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
            || !matches!(
                result.capture_method.as_str(),
                "print-window" | "screen-copy-exact-hwnd-bounds"
            )
            || (result.capture_method == "screen-copy-exact-hwnd-bounds"
                && capture_scenario != "Adjacent")
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

    fn wait_for_onboarding_state(
        marker: &Path,
        language: &str,
        process_id: u32,
        expected_status: &str,
        expected_step: usize,
    ) -> Result<OnboardingAcceptanceMarker, String> {
        let deadline = Instant::now() + Duration::from_millis(PROCESS_TIMEOUT_MILLISECONDS.into());
        let (_wait_sender, wait_receiver) = mpsc::channel::<()>();
        let mut last_payload = String::new();
        while Instant::now() < deadline {
            if let Ok(payload) = fs::read_to_string(marker) {
                last_payload = payload.clone();
                if let Ok(runtime) = serde_json::from_str::<OnboardingAcceptanceState>(&payload) {
                    let onboarding = runtime.onboarding_acceptance;
                    if runtime.language != language
                        || runtime.process_id.parse::<u32>().ok() != Some(process_id)
                    {
                        return Err(format!("Onboarding marker identity mismatch: {payload}"));
                    }
                    if onboarding.status == "error" {
                        return Err(format!(
                            "Onboarding runtime rejected the live gate: {} observed={:?}",
                            onboarding.message, onboarding.observed_texts
                        ));
                    }
                    if onboarding.status == expected_status && onboarding.step == expected_step {
                        let choice_trigger =
                            matches!(
                                onboarding.action_identity.as_str(),
                                "objectName:showGuides"
                                    | "data:showGuides"
                                    | "context-source:MenuBarManager/Getting Started Guides"
                            )
                            && onboarding.choice_class
                                == "onboarding::OnboardingChoiceView"
                            && onboarding.choice_producer_class
                                == "onboarding::OnboardingChoiceView"
                            && onboarding.guide_parameter_type == "std::string";
                        let manager_trigger = onboarding.action_identity
                            == "manager-export:ExtensionLayer.dll/OnboardingManager::showGuide"
                            && onboarding.choice_producer_class
                                == "onboarding::OnboardingManager"
                            && onboarding.guide_parameter_type == "const std::string&";
                        if !onboarding.enabled
                            || onboarding.total_steps != 5
                            || onboarding.guide_id != "firstLaunch"
                            || (!choice_trigger && !manager_trigger)
                            || (onboarding.action_identity == "objectName:showGuides"
                                && onboarding.action_object_name != "showGuides")
                            || onboarding.guide_class != "onboarding::OnboardingGuideView"
                            || onboarding.workspace_reset_prompt_observed
                            || !onboarding.workspace_reset_avoided
                            || !onboarding.startup_settled
                            || (choice_trigger
                                && onboarding.action_was_enabled
                                    == onboarding.action_temporarily_enabled)
                            || (onboarding.manager_enable_bypass_used
                                && !onboarding.manager_temporarily_enabled
                                && expected_status != "complete")
                            || (expected_status == "complete"
                                && !onboarding.manager_disabled_state_restored)
                        {
                            return Err(format!(
                                "Onboarding marker reached {expected_status} step {expected_step} without the exact semantic identity contract: {payload}; observedActions={:?}",
                                onboarding.observed_actions
                            ));
                        }
                        if expected_status == "ready"
                            && (!onboarding.title_matches
                                || !onboarding.body_matches
                                || onboarding.title.trim().is_empty()
                                || onboarding.body.trim().is_empty()
                                || onboarding.title == onboarding.body
                                || !onboarding
                                    .observed_texts
                                    .iter()
                                    .any(|value| value == &onboarding.title)
                                || !onboarding
                                    .observed_texts
                                    .iter()
                                    .any(|value| value == &onboarding.body)
                                || onboarding.window_handle == "0"
                                || onboarding
                                    .window_handle
                                    .parse::<u64>()
                                    .ok()
                                    .filter(|value| *value != 0)
                                    .is_none())
                        {
                            return Err(format!(
                                "Onboarding marker reached ready step {expected_step} without the exact title/body contract: {payload}"
                            ));
                        }
                        return Ok(onboarding);
                    }
                }
            }
            let _ = wait_receiver.recv_timeout(Duration::from_millis(50));
        }
        Err(format!(
            "timed out waiting for Onboarding {expected_status} step {expected_step}: {last_payload}"
        ))
    }

    fn write_atomic_new_ack(
        evidence_root: &GuardedTempRoot,
        acknowledgement: &Path,
        payload: &[u8],
    ) -> Result<(), String> {
        evidence_root.assert_write_target(acknowledgement)?;
        if acknowledgement.exists() {
            return Err(format!(
                "refusing to overwrite acknowledgement {}",
                acknowledgement.display()
            ));
        }
        let file_name = acknowledgement
            .file_name()
            .and_then(|value| value.to_str())
            .ok_or_else(|| {
                format!(
                    "acknowledgement has no UTF-8 file name: {}",
                    acknowledgement.display()
                )
            })?;
        let temporary = acknowledgement.with_file_name(format!(
            ".{file_name}.{}.tmp",
            std::process::id()
        ));
        evidence_root.assert_write_target(&temporary)?;
        let mut file = OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&temporary)
            .map_err(|error| {
                format!(
                    "could not create temporary acknowledgement {}: {error}",
                    temporary.display()
                )
            })?;
        let write_result = file
            .write_all(payload)
            .and_then(|()| file.sync_all())
            .map_err(|error| {
                format!(
                    "could not publish temporary acknowledgement {}: {error}",
                    temporary.display()
                )
            });
        drop(file);
        if let Err(error) = write_result {
            let _ = fs::remove_file(&temporary);
            return Err(error);
        }
        fs::rename(&temporary, acknowledgement).map_err(|error| {
            let _ = fs::remove_file(&temporary);
            format!(
                "could not atomically publish acknowledgement {} -> {}: {error}",
                temporary.display(),
                acknowledgement.display()
            )
        })
    }

    fn acknowledge_onboarding_screenshot(
        evidence_root: &GuardedTempRoot,
        acceptance_directory: &Path,
        step: usize,
    ) -> Result<(), String> {
        let acknowledgement = acceptance_directory.join(format!("step-{step}.ack.json"));
        write_atomic_new_ack(
            evidence_root,
            &acknowledgement,
            format!("{{\"step\":{step}}}\n").as_bytes(),
        )
    }

    #[allow(clippy::too_many_arguments)]
    fn capture_onboarding_steps(
        runner: &mut RealCommandRunner,
        helper: &Path,
        evidence_root: &GuardedTempRoot,
        run_root: &Path,
        process_id: u32,
        executable: &Path,
        product_marker: &Path,
        onboarding_state: &Path,
        acceptance_directory: &Path,
        language: &str,
    ) -> Result<Vec<ScreenshotEvidence>, String> {
        let mut evidence = Vec::with_capacity(5);
        for step in 1..=5 {
            let onboarding =
                wait_for_onboarding_state(onboarding_state, language, process_id, "ready", step)?;
            let output = run_root.join(format!("{language}-onboarding-step-{step}.png"));
            let mut screenshot = capture_main_window(
                runner,
                helper,
                evidence_root,
                process_id,
                executable,
                product_marker,
                language,
                "Onboarding",
                Some(&onboarding.window_handle),
                &output,
            )?;
            screenshot.scenario = format!("OnboardingStep{step}");
            screenshot.interaction_evidence = format!(
                "guide=firstLaunch;step={step}/5;title={};body={};qt-semantics=showGuides/guideSelected/nextClicked(steps1-4);terminal=step5-ack-only;path-pixels=manual-review-required",
                onboarding.title, onboarding.body
            );
            evidence.push(screenshot);
            acknowledge_onboarding_screenshot(evidence_root, acceptance_directory, step)?;
        }
        let completed =
            wait_for_onboarding_state(onboarding_state, language, process_id, "complete", 5)?;
        if completed.message != "All five firstLaunch steps were acknowledged." {
            return Err(format!(
                "Onboarding completed with an unexpected terminal message: {}",
                completed.message
            ));
        }
        Ok(evidence)
    }
