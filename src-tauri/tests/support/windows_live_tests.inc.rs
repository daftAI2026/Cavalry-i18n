/**
 * [INPUT]: 依赖四个 live support 分片、PowerShell/helper 源码与显式 disposable clone/evidence 环境
 * [OUTPUT]: 在父测试模块内提供静态安全合同和 full-surface/Onboarding/Adjacent 三个 ignored 人工复核门
 * [POS]: src-tauri/tests/support 的门入口分片；成功现场门故意以 MANUAL SCREENSHOT REVIEW REQUIRED 结束
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
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
            "Assert-ExactForegroundWindow",
            "Assert-ForegroundProcess",
            "ConfirmDiscardOfDisposableScene",
            "keybd_event",
        ] {
            assert!(
                !helper.contains(forbidden),
                "live helper must not contain retired scene/UIA/coordinate path {forbidden}"
            );
        }
        for required in [
            "PostVirtualKey",
            "Wait-ForExactForegroundWindow",
            "WM_KEYDOWN",
            "WM_KEYUP",
            "0x41",
            "exact-hwnd-postmessage-vk-a",
            "path-pixels=manual-review-required",
            "Wait-ForTextPathDiagnostics",
            "BaselineDiagnostics",
            "canonicalCalls",
            "whitelistCalls",
            "cjkPathSuccess",
            "fallbackSourceMask",
            "rendererFailure",
            "CogPitch",
            "0x10000000",
            "AllowManualCogPitch",
            "manual-disposable-cogwheel-drag",
            "pre-set Pitch bit 28",
            "Adjacent",
            "WaitForExit",
            "ForceStop",
            "Stop-Process -Id $TargetProcessId -Force",
            "adjacent-producer=runtime-exact-hwnd",
            "@('Onboarding', 'Adjacent') -notcontains",
            "screen-copy-exact-hwnd-bounds",
            "AllowScreenCopyFallback",
            "CopyFromScreen",
        ] {
            assert!(
                helper.contains(required),
                "live helper must retain fail-closed evidence token {required}"
            );
        }
    }

    #[test]
    fn adjacent_driver_keeps_real_producer_and_write_once_contracts() {
        let repo = repo_root();
        let mut driver = String::new();
        for relative in [
            "injector/windows/cavalry_i18n_adjacent_acceptance.cpp",
            "injector/windows/cavalry_i18n_adjacent_acceptance_lifecycle.inc",
            "injector/windows/cavalry_i18n_adjacent_acceptance_assets.inc",
            "injector/windows/cavalry_i18n_adjacent_acceptance_evidence.inc",
            "injector/windows/cavalry_i18n_acceptance_plugin.cpp",
        ] {
            driver.push_str(
                &fs::read_to_string(repo.join(relative))
                    .unwrap_or_else(|error| panic!("Adjacent driver fragment {relative} must remain readable: {error}")),
            );
        }
        for required in [
            "cavalry::TagHeader",
            "PopOverView",
            "Assign Tag to Selection: ",
            "assets::Window",
            "SimpleTreeWidget",
            "EditableNodeName",
            "QDragEnterEvent",
            "QDropEvent",
            "QContextMenuEvent",
            "Create Composition based on %1",
            "QIODevice::NewOnly",
            "capture-ready/v1",
            "capture-ack/v1",
            "ownerExternalUnchanged",
            "qt-widget-grab-exact-producer+pid-hwnd-anchor",
            "SignInDialog",
            "cavalryi18n_acceptance",
        ] {
            assert!(
                driver.contains(required),
                "Adjacent driver must retain semantic evidence token {required}"
            );
        }
        for forbidden in [
            "SetCursorPos",
            "mouse_event",
            "keybd_event",
            "TerminateProcess",
            "ExitProcess",
            "QCoreApplication::exit",
            "QThread::msleep",
            "Sleep(",
        ] {
            assert!(
                !driver.contains(forbidden),
                "Adjacent driver must not contain blind/force/timing fallback {forbidden}"
            );
        }
    }

    #[test]
    fn onboarding_driver_isolates_qt_profile_and_confirms_real_transitions() {
        let repo = repo_root();
        let plugin =
            fs::read_to_string(repo.join("injector/windows/cavalry_i18n_acceptance_plugin.cpp"))
                .expect("acceptance plugin must remain readable");
        let driver = fs::read_to_string(repo.join("injector/windows/cavalry_i18n_runtime.cpp"))
            .expect("Onboarding acceptance partition must remain readable");
        let guard =
            fs::read_to_string(repo.join("src-tauri/tests/support/windows_disposable.rs"))
                .expect("Windows disposable guard must remain readable");
        let orchestration = fs::read_to_string(
            repo.join("src-tauri/tests/support/windows_live_orchestration.inc.rs"),
        )
        .expect("Windows live orchestration must remain readable");
        assert!(plugin.contains("QStandardPaths::setTestModeEnabled(true)"));
        for required in [
            "waiting-for-transition",
            "kOnboardingTransitionClickAttempts",
            "expectedTitleHits == 1 && expectedBodyHits == 1",
            "workspaceResetPromptObserved",
            "neither Ok nor Cancel was invoked",
            "kOnboardingStartupSettleMilliseconds",
            "MainDock",
            "forward->click()",
        ] {
            assert!(
                driver.contains(required),
                "Onboarding driver must retain isolated transition contract {required}"
            );
        }
        for forbidden in [
            "acceptButton->click",
            "cancelButton->click",
            "showStepImmediate",
            "AddVectoredExceptionHandler",
        ] {
            assert!(
                !driver.contains(forbidden),
                "Onboarding driver must not regain unsafe bypass {forbidden}"
            );
        }
        for required in [
            "QT_TEST_PROFILE_SENTINEL",
            "cavalry-i18n.windows-qt-test-profile/v1",
            "assert_absolute_existing_chain_has_no_reparse",
            "prepare_qt_test_profile",
            "cleanup_qt_test_profile",
        ] {
            assert!(
                guard.contains(required),
                "Qt test profile guard must retain ownership token {required}"
            );
        }
        assert!(orchestration.contains("prepare_qt_test_profile"));
        assert!(orchestration.contains("cleanup_qt_test_profile"));
    }

    #[test]
    fn acceptance_drivers_remain_outside_the_product_plugin_and_packages() {
        let repo = repo_root();
        let cmake = fs::read_to_string(repo.join("injector/windows/CMakeLists.txt"))
            .expect("Windows injector CMake must remain readable");
        let product_start = cmake
            .find("target_sources(cavalryi18n\n")
            .expect("product source section must exist");
        let acceptance_start = cmake
            .find("qt_add_plugin(cavalryi18n_acceptance")
            .expect("acceptance target must exist");
        let product_sources = &cmake[product_start..acceptance_start];
        assert!(
            !product_sources.contains("_acceptance"),
            "product plugin source closure must not compile acceptance drivers"
        );
        let acceptance_sources = &cmake[acceptance_start..];
        for required in [
            "cavalry_i18n_onboarding_acceptance.cpp",
            "cavalry_i18n_adjacent_acceptance.cpp",
        ] {
            assert!(
                acceptance_sources.contains(required),
                "acceptance target must own {required}"
            );
        }
        let product_header =
            fs::read_to_string(repo.join("injector/windows/cavalry_i18n_runtime.h"))
                .expect("product runtime header must remain readable");
        for forbidden in [
            "OnboardingAcceptance",
            "ONBOARDING_ACCEPTANCE",
            "guideSelected",
            "nextClicked",
        ] {
            assert!(
                !product_header.contains(forbidden),
                "product runtime header leaked acceptance token {forbidden}"
            );
        }
        for package_surface in [
            "src-tauri/tauri.conf.json",
            "src-tauri/tauri.windows.conf.json",
            "injector/windows/build.ps1",
        ] {
            let source = fs::read_to_string(repo.join(package_surface))
                .unwrap_or_else(|error| {
                    panic!("package surface {package_surface} must remain readable: {error}")
                });
            assert!(
                !source.contains("cavalryi18n_acceptance.dll"),
                "release package surface {package_surface} must exclude acceptance DLL"
            );
        }
    }

    fn run_disposable_clone_gate(capture_mode: LiveCaptureMode) {
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
        let english_source = repo.join("languages/en");
        let state_dir =
            prepare_state_surface(&evidence_root, &run_root, &baseline_pairs, &english_source)
                .unwrap_or_else(|error| panic!("{error}"));
        let acceptance_plugin = if matches!(
            capture_mode,
            LiveCaptureMode::Onboarding | LiveCaptureMode::Adjacent
        ) {
            Some(layout.root.join("generic/cavalryi18n_acceptance.dll"))
        } else {
            None
        };

        let mut outstanding_processes = BTreeSet::new();
        let exercise = catch_unwind(AssertUnwindSafe(|| {
            if acceptance_plugin.is_some() {
                let installed = install_acceptance_plugin(&repo, &layout, &guarded_clone)?;
                if acceptance_plugin.as_deref() != Some(installed.as_path()) {
                    return Err(format!(
                        "acceptance plugin destination mismatch: {}",
                        installed.display()
                    ));
                }
            }
            exercise_languages(
                &repo,
                &helper,
                &state_dir,
                &layout,
                &guarded_clone,
                &evidence_root,
                &run_root,
                &baseline_pairs,
                capture_mode,
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
        if let Some(path) = acceptance_plugin.as_deref() {
            if let Err(error) = remove_acceptance_plugin(&guarded_clone, path) {
                failures.push(format!("acceptance plugin cleanup error: {error}"));
            }
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
        match capture_mode {
            LiveCaptureMode::FullSurfaces => panic!(
                "MANUAL SCREENSHOT REVIEW REQUIRED: automated PID/Qt/table/lang/ExtensionLayer/window checks passed and English was restored, but no OCR assertion was performed. Each language has Viewport Quality/Transform/Edit Shape evidence below {}. When CAVALRY_I18N_WINDOWS_LIVE_COG_PITCH=1, Cog Pitch retains its strict delta gate. Manually verify the visible localized text before accepting Windows GUI translation.",
                run_root.display()
            ),
            LiveCaptureMode::Onboarding => panic!(
                "MANUAL SCREENSHOT REVIEW REQUIRED: automated PID/Qt/table/lang/ExtensionLayer/window checks passed and English was restored, but no OCR assertion was performed. Each language has five exact-PID firstLaunch PNGs whose product Qt tree independently exposed the exact installed title and body below {}. Manually verify the five Onboarding images before accepting Windows Onboarding translation.",
                run_root.display()
            ),
            LiveCaptureMode::Adjacent => panic!(
                "MANUAL SCREENSHOT REVIEW REQUIRED: automated PID/Qt/table/lang/ExtensionLayer/exact-HWND checks passed and English was restored. Each language completed TagHeader→PopOverView plus dual-stem Assets Drop→ContextMenu as two logical producer points with three PNGs below {}. Manually verify the visible Tag and Assets menu pixels before accepting Windows adjacent producer translation.",
                run_root.display()
            ),
        }
    }

    #[test]
    #[ignore = "requires explicit disposable clone/evidence TEMP roots and produces PNGs that require human review; never run against a real installation"]
    fn disposable_clone_captures_three_languages_for_required_manual_review() {
        run_disposable_clone_gate(LiveCaptureMode::FullSurfaces);
    }

    #[test]
    #[ignore = "requires explicit disposable clone/evidence TEMP roots and produces five firstLaunch PNGs per language for human review; never run against a real installation"]
    fn disposable_clone_captures_onboarding_for_required_manual_review() {
        run_disposable_clone_gate(LiveCaptureMode::Onboarding);
    }

    #[test]
    #[ignore = "requires explicit disposable clone/evidence TEMP roots and produces Tag plus dual-stem Assets exact-HWND PNGs per language for human review; never run against a real installation"]
    fn disposable_clone_captures_adjacent_producers_for_required_manual_review() {
        run_disposable_clone_gate(LiveCaptureMode::Adjacent);
    }
