/**
 * [INPUT]: 依赖安装布局、语言 apply、English baseline、Qt 测试 profile、acceptance-only plugin 字节、tools/macos-acceptance/fixtures 的双平台 Assets 媒体与 exact-PID/HWND 清理
 * [OUTPUT]: 在父测试模块内提供语言安装/验证、现场启动、验收插件临时部署、三语编排、WM_CLOSE/ForceStop 清理及失败后 English 恢复
 * [POS]: src-tauri/tests/support 的 live-clone 事务编排分片；所有写入均经过 disposable TEMP 根与 reparse 守卫
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
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
        let Some(command) = runner.commands.as_slice().first() else {
            return Err(format!(
                "{language} did not run the exact-path graceful close gate"
            ));
        };
        if runner.commands.len() != 1
            || command.program != "powershell.exe"
            || command.args.len() != 5
            || command.args[..4]
                != [
                    "-NoLogo",
                    "-NoProfile",
                    "-NonInteractive",
                    "-EncodedCommand",
                ]
        {
            return Err(format!(
                "{language} disposable clone used an unexpected external/elevated command surface: {:?}",
                runner.commands
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
        language: &str,
        capture_mode: LiveCaptureMode,
        runner: &mut RealCommandRunner,
        outstanding_processes: &mut BTreeSet<u32>,
    ) -> Result<Vec<ScreenshotEvidence>, String> {
        let expected_marker = windows_runtime::diagnostic_marker_path(state_dir);
        evidence_root.assert_write_target(&expected_marker)?;
        let current_state = state::read_state(state_dir)
            .ok_or_else(|| format!("state is missing before launching {language}"))?;
        let mut launch =
            windows_runtime::prepare_launch(layout, state_dir, &current_state, repo, repo)?;
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
        let onboarding_acceptance_directory = if capture_mode == LiveCaptureMode::Onboarding {
            let marker_parent = marker
                .parent()
                .ok_or_else(|| format!("diagnostic marker has no parent: {}", marker.display()))?;
            let directory = marker_parent.join(format!("onboarding-{language}"));
            evidence_root.assert_write_target(&directory)?;
            fs::create_dir(&directory).map_err(|error| {
                format!(
                    "could not create Onboarding acceptance directory {}: {error}",
                    directory.display()
                )
            })?;
            launch.environment.extend([
                (
                    OsString::from(ONBOARDING_ACCEPTANCE_ENV),
                    directory.as_os_str().to_os_string(),
                ),
                (
                    OsString::from(ACCEPTANCE_LANGUAGE_ENV),
                    OsString::from(language),
                ),
                (
                    OsString::from("QT_QPA_GENERIC_PLUGINS"),
                    OsString::from("cavalryi18n_acceptance:onboarding"),
                ),
            ]);
            Some(directory)
        } else {
            None
        };
        let adjacent_acceptance_directory = if capture_mode == LiveCaptureMode::Adjacent {
            let marker_parent = marker
                .parent()
                .ok_or_else(|| format!("diagnostic marker has no parent: {}", marker.display()))?;
            let directory = marker_parent.join(format!("adjacent-{language}"));
            evidence_root.assert_write_target(&directory)?;
            fs::create_dir(&directory).map_err(|error| {
                format!(
                    "could not create Adjacent acceptance directory {}: {error}",
                    directory.display()
                )
            })?;
            let fixture_source = repo.join("tools/macos-acceptance/fixtures");
            let fixture_nonce = format!(
                "{:x}",
                Sha256::digest(
                    format!("{}:{language}", run_root.to_string_lossy()).as_bytes()
                )
            );
            let fixture_nonce = &fixture_nonce[..10];
            let replace_fixture = directory.join(format!("replace-source-{fixture_nonce}.png"));
            let dynamic_fixture = directory.join(format!("dynamic-proof-two-{fixture_nonce}.png"));
            for (source, destination) in [
                (
                    fixture_source.join("replace-source.png"),
                    replace_fixture.as_path(),
                ),
                (
                    fixture_source.join("dynamic-proof-two.png"),
                    dynamic_fixture.as_path(),
                ),
            ] {
                if !source.is_file() {
                    return Err(format!(
                        "tracked Adjacent fixture does not exist: {}",
                        source.display()
                    ));
                }
                evidence_root.assert_write_target(destination)?;
                let fixture_bytes = fs::read(&source).map_err(|error| {
                    format!(
                        "could not read tracked Adjacent fixture {}: {error}",
                        source.display()
                    )
                })?;
                let mut fixture_file = OpenOptions::new()
                    .write(true)
                    .create_new(true)
                    .open(destination)
                    .map_err(|error| {
                        format!(
                            "could not create frozen Adjacent fixture {}: {error}",
                            destination.display()
                        )
                    })?;
                fixture_file.write_all(&fixture_bytes).map_err(|error| {
                    format!(
                        "could not freeze Adjacent fixture bytes {} -> {}: {error}",
                        source.display(),
                        destination.display()
                    )
                })?;
                fixture_file.sync_all().map_err(|error| {
                    format!(
                        "could not flush frozen Adjacent fixture {}: {error}",
                        destination.display()
                    )
                })?;
            }
            launch.environment.extend([
                (
                    OsString::from(ADJACENT_ACCEPTANCE_ENV),
                    directory.as_os_str().to_os_string(),
                ),
                (
                    OsString::from(ADJACENT_REPLACE_FIXTURE_ENV),
                    replace_fixture.as_os_str().to_os_string(),
                ),
                (
                    OsString::from(ADJACENT_DYNAMIC_FIXTURE_ENV),
                    dynamic_fixture.as_os_str().to_os_string(),
                ),
                (
                    OsString::from(ACCEPTANCE_LANGUAGE_ENV),
                    OsString::from(language),
                ),
                (
                    OsString::from("QT_QPA_GENERIC_PLUGINS"),
                    OsString::from("cavalryi18n_acceptance:adjacent"),
                ),
            ]);
            Some(directory)
        } else {
            None
        };
        if capture_mode == LiveCaptureMode::FullSurfaces {
            let profile_root = run_root.join(format!("profile-full-surfaces-{language}"));
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
        } else {
            prepare_qt_test_profile(&format!(
                "run={}\nlanguage={language}\nmode={capture_mode:?}",
                run_root.display()
            ))?;
        }
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

        let mut evidence = Vec::new();
        if let Some(onboarding_directory) = onboarding_acceptance_directory.as_deref() {
            let onboarding_state = onboarding_directory.join("onboarding-state.json");
            evidence_root.assert_write_target(&onboarding_state)?;
            evidence.extend(capture_onboarding_steps(
                runner,
                helper,
                evidence_root,
                run_root,
                process_id,
                &layout.executable,
                &marker,
                &onboarding_state,
                onboarding_directory,
                language,
            )?);
        } else if let Some(adjacent_directory) = adjacent_acceptance_directory.as_deref() {
            evidence.extend(capture_adjacent_producers(
                evidence_root,
                run_root,
                process_id,
                adjacent_directory,
                language,
            )?);
        } else {
            let mut scenarios = vec![
                ("ViewportQuality", "viewport-quality"),
                ("TransformHelper", "transform-helper"),
                ("EditShapeHelper", "edit-shape-helper"),
            ];
            if env::var(MANUAL_COG_PITCH_ENV).as_deref() == Ok("1") {
                scenarios.push(("CogPitch", "cog-pitch"));
            }
            let mut full_surface_evidence = Vec::with_capacity(scenarios.len());
            for (capture_scenario, artifact) in scenarios {
                let output = run_root.join(format!("{language}-{artifact}.png"));
                full_surface_evidence.push(capture_main_window(
                    runner,
                    helper,
                    evidence_root,
                    process_id,
                    &layout.executable,
                    &marker,
                    language,
                    capture_scenario,
                    None,
                    &output,
                )?);
            }
            evidence.extend(full_surface_evidence);
        }
        cleanup_owned_process(runner, helper, process_id, &layout.executable)?;
        if !outstanding_processes.remove(&process_id) {
            return Err(format!(
                "closed Cavalry pid {process_id} was not outstanding"
            ));
        }
        require_no_cavalry_processes(runner, helper, &format!("after {language} close"))?;
        if capture_mode != LiveCaptureMode::FullSurfaces {
            cleanup_qt_test_profile()?;
        }
        Ok(evidence)
    }

    fn install_acceptance_plugin(
        repo: &Path,
        layout: &InstallLayout,
        guarded_clone: &GuardedTempRoot,
    ) -> Result<PathBuf, String> {
        let source = repo.join(
            "build/windows-injector/acceptance/generic/cavalryi18n_acceptance.dll",
        );
        if !source.is_file() {
            return Err(format!(
                "Windows acceptance-only plugin is missing; run npm run build:injector:windows first: {}",
                source.display()
            ));
        }
        let destination = layout.root.join("generic/cavalryi18n_acceptance.dll");
        guarded_clone.assert_write_target(&destination)?;
        let bytes = fs::read(&source).map_err(|error| {
            format!(
                "could not read Windows acceptance-only plugin {}: {error}",
                source.display()
            )
        })?;
        if destination.exists() {
            let metadata = fs::symlink_metadata(&destination).map_err(|error| {
                format!(
                    "could not inspect stale Windows acceptance-only plugin {}: {error}",
                    destination.display()
                )
            })?;
            if !metadata.file_type().is_file() {
                return Err(format!(
                    "refusing non-file stale Windows acceptance cleanup target {}",
                    destination.display()
                ));
            }
            fs::remove_file(&destination).map_err(|error| {
                format!(
                    "could not remove stale Windows acceptance-only plugin {}: {error}",
                    destination.display()
                )
            })?;
        }
        let temporary = destination.with_file_name(format!(
            ".cavalryi18n_acceptance.dll.{}.tmp",
            std::process::id()
        ));
        guarded_clone.assert_write_target(&temporary)?;
        if temporary.exists() {
            return Err(format!(
                "refusing stale acceptance plugin temporary file {}",
                temporary.display()
            ));
        }
        let mut file = OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&temporary)
            .map_err(|error| {
                format!(
                    "could not create temporary acceptance-only plugin {}: {error}",
                    temporary.display()
                )
            })?;
        let write_result = file
            .write_all(&bytes)
            .and_then(|()| file.sync_all())
            .map_err(|error| {
                format!(
                    "could not publish temporary acceptance-only plugin {}: {error}",
                    temporary.display()
                )
            });
        drop(file);
        if let Err(error) = write_result {
            let _ = fs::remove_file(&temporary);
            return Err(error);
        }
        if let Err(error) = fs::rename(&temporary, &destination) {
            let _ = fs::remove_file(&temporary);
            return Err(format!(
                "could not atomically install acceptance-only plugin {} -> {}: {error}",
                temporary.display(),
                destination.display()
            ));
        }
        Ok(destination)
    }

    fn remove_acceptance_plugin(
        guarded_clone: &GuardedTempRoot,
        path: &Path,
    ) -> Result<(), String> {
        guarded_clone.assert_write_target(path)?;
        if !path.exists() {
            return Ok(());
        }
        let metadata = fs::symlink_metadata(path).map_err(|error| {
            format!(
                "could not inspect Windows acceptance-only plugin {}: {error}",
                path.display()
            )
        })?;
        if !metadata.file_type().is_file() {
            return Err(format!(
                "refusing non-file Windows acceptance cleanup target {}",
                path.display()
            ));
        }
        fs::remove_file(path).map_err(|error| {
            format!(
                "could not remove Windows acceptance-only plugin {}: {error}",
                path.display()
            )
        })
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
        baseline_pairs: &[CopyPair],
        capture_mode: LiveCaptureMode,
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
                language,
                capture_mode,
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
            match cleanup_owned_process(runner, helper, process_id, &layout.executable) {
                Ok(()) => {
                    outstanding_processes.remove(&process_id);
                }
                Err(error) => {
                    failures.push(error);
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
            match cleanup_owned_process(runner, helper, process_id, &layout.executable) {
                Ok(()) => {
                    outstanding_processes.remove(&process_id);
                }
                Err(error) => {
                    failures.push(format!("final {error}"));
                }
            }
        }
        if let Err(error) = require_no_cavalry_processes(runner, helper, "final global audit") {
            failures.push(error);
        }
        if let Err(error) = cleanup_qt_test_profile() {
            failures.push(format!("Qt test profile cleanup failed: {error}"));
        }
        if failures.is_empty() {
            Ok(())
        } else {
            Err(failures.join(" | "))
        }
    }
