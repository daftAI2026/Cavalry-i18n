/**
 * [INPUT-TOOLCHAIN]: 依赖 tools/resolve_windows_cmake.js --ensure --print-json --platform windows 提供已验证的 Windows x64 CMake executable/version，并通过 Node Windows 安装约定的 npm.cmd 记录 npm 版本；release evidence 不读取 PATH 中的裸 cmake。
 * [INPUT]: 依赖 live support 分片、clone guard、PowerShell/helper 源码与显式 disposable clone/evidence 环境；release 模式还依赖最终 NSIS/provenance 与双 DLL 字节
 * [OUTPUT]: 在父测试模块内提供静态安全合同和 full-surface/Onboarding/Adjacent 三个 ignored 人工复核门；FullSurfaces 只在 TEMP-owned profile 与关键 clone 资源已证明完整后启动；release machine record 只接受 live runner 源 DLL 与最终 shipped DLL 完全一致
 * [POS]: src-tauri/tests/support 的门入口分片；任何 live clone 资源不完整、FullSurfaces 未绑定 TEMP-owned profile 或使用不同于最终 NSIS 的 runtime DLL 都先于人工截图结论硬失败
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

    const WINDOWS_RELEASE_TAG_ENV: &str = "CAVALRY_I18N_WINDOWS_RELEASE_TAG";
    const WINDOWS_RELEASE_INSTALLER_ENV: &str = "CAVALRY_I18N_WINDOWS_RELEASE_INSTALLER";
    const WINDOWS_RELEASE_PROVENANCE_ENV: &str = "CAVALRY_I18N_WINDOWS_RELEASE_PROVENANCE";
    const WINDOWS_RELEASE_GENERIC_ENV: &str = "CAVALRY_I18N_WINDOWS_RELEASE_GENERIC_DLL";
    const WINDOWS_RELEASE_QPA_ENV: &str = "CAVALRY_I18N_WINDOWS_RELEASE_QPA_DLL";
    const WINDOWS_GENERIC_RELATIVE_PATH: &str = "injector/windows/generic/cavalryi18n.dll";
    const WINDOWS_QPA_RELATIVE_PATH: &str = "injector/windows/qpa/qwindows.dll";
    const WINDOWS_RELEASE_SESSION_MAGIC: &str = "cavalry-i18n.windows-release-acceptance/v1";
    fn release_file_identity(path: &Path, label: &str) -> Result<serde_json::Value, String> {
        let metadata = fs::symlink_metadata(path)
            .map_err(|error| format!("could not inspect {label} {}: {error}", path.display()))?;
        if !metadata.file_type().is_file() || metadata.file_type().is_symlink() {
            return Err(format!("{label} must be a regular non-symlink file: {}", path.display()));
        }
        let bytes = fs::read(path)
            .map_err(|error| format!("could not read {label} {}: {error}", path.display()))?;
        Ok(serde_json::json!({
            "path": path.to_string_lossy().to_string(),
            "bytes": bytes.len(),
            "sha256": format!("{:x}", Sha256::digest(bytes)),
        }))
    }

    fn write_new_release_json(path: &Path, value: &serde_json::Value) -> Result<(), String> {
        let mut file = OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(path)
            .map_err(|error| format!("could not create release machine record {}: {error}", path.display()))?;
        let payload = serde_json::to_vec_pretty(value)
            .map_err(|error| format!("could not serialize release machine record: {error}"))?;
        file.write_all(&payload)
            .and_then(|_| file.write_all(b"\n"))
            .and_then(|_| file.sync_all())
            .map_err(|error| format!("could not flush release machine record {}: {error}", path.display()))
    }

    fn command_first_line_path(program: &Path, arguments: &[&str], label: &str) -> Result<String, String> {
        let output = ProcessBuilder::new(program)
            .args(arguments)
            .output()
            .map_err(|error| format!("could not execute {label}: {error}"))?;
        if !output.status.success() {
            return Err(format!(
                "{label} failed with {:?}: {}",
                output.status.code(),
                String::from_utf8_lossy(&output.stderr).trim()
            ));
        }
        String::from_utf8_lossy(&output.stdout)
            .lines()
            .find(|line| !line.trim().is_empty())
            .map(|line| line.trim().to_string())
            .ok_or_else(|| format!("{label} returned no version output"))
    }

    fn command_first_line(program: &str, arguments: &[&str], label: &str) -> Result<String, String> {
        command_first_line_path(Path::new(program), arguments, label)
    }

    fn npm_program() -> &'static str {
        "npm.cmd"
    }

    #[derive(Debug, Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct WindowsCMakeToolchainIdentity {
        schema_version: u8,
        kind: String,
        platform: String,
        architecture: String,
        version: String,
        executable: PathBuf,
    }

    fn resolve_pinned_cmake_version(repo: &Path) -> Result<String, String> {
        let output = ProcessBuilder::new("node")
            .args([
                "tools/resolve_windows_cmake.js",
                "--ensure",
                "--print-json",
                "--platform",
                "windows",
            ])
            .current_dir(repo)
            .output()
            .map_err(|error| format!("could not execute pinned Windows CMake resolver: {error}"))?;
        if !output.status.success() {
            return Err(format!(
                "pinned Windows CMake resolver failed with {:?}: {}",
                output.status.code(),
                String::from_utf8_lossy(&output.stderr).trim()
            ));
        }
        let identity: WindowsCMakeToolchainIdentity = serde_json::from_slice(&output.stdout)
            .map_err(|error| format!("pinned Windows CMake resolver returned invalid identity JSON: {error}"))?;
        if identity.schema_version != 1
            || identity.kind != "WindowsCMakeToolchainIdentity"
            || identity.platform != "windows-x86_64"
            || identity.architecture != "x86_64"
            || identity.executable.as_os_str().is_empty()
            || identity.version.is_empty()
        {
            return Err("pinned Windows CMake resolver returned an invalid x64 identity".to_string());
        }
        let cmake_line = command_first_line_path(
            &identity.executable,
            &["--version"],
            "verified pinned Windows CMake",
        )?;
        let observed_version = cmake_version(&cmake_line)?;
        if observed_version != identity.version {
            return Err(format!(
                "verified pinned Windows CMake reported {observed_version}, resolver identity reported {}",
                identity.version
            ));
        }
        Ok(identity.version)
    }

    fn cmake_version(output: &str) -> Result<String, String> {
        output
            .split_whitespace()
            .find(|token| {
                let mut parts = token.split('.');
                parts.clone().count() == 3 && parts.all(|part| !part.is_empty() && part.chars().all(|ch| ch.is_ascii_digit()))
            })
            .map(ToOwned::to_owned)
            .ok_or_else(|| format!("could not parse concrete CMake version from {output}"))
    }

    fn require_release_runtime_sources(
        repo: &Path,
        artifacts: &BTreeMap<&str, serde_json::Value>,
    ) -> Result<(), String> {
        for (relative_path, environment, label) in [
            (
                WINDOWS_GENERIC_RELATIVE_PATH,
                WINDOWS_RELEASE_GENERIC_ENV,
                "generic translator DLL",
            ),
            (
                WINDOWS_QPA_RELATIVE_PATH,
                WINDOWS_RELEASE_QPA_ENV,
                "QPA delegate DLL",
            ),
        ] {
            let source = repo.join(relative_path);
            let source_identity = release_file_identity(&source, &format!("live runner {label} source"))?;
            let shipped_identity = artifacts
                .get(environment)
                .ok_or_else(|| format!("release artifact identity missing for {environment}"))?;
            if source_identity["bytes"] != shipped_identity["bytes"]
                || source_identity["sha256"] != shipped_identity["sha256"]
            {
                return Err(format!(
                    "refusing Windows release evidence: live runner {label} source {} does not match final NSIS shipped bytes {}",
                    source.display(),
                    shipped_identity["path"].as_str().unwrap_or("<unknown>")
                ));
            }
        }
        Ok(())
    }

    fn write_windows_release_machine_record(
        capture_mode: LiveCaptureMode,
        repo: &Path,
        run_root: &Path,
        evidence_root: &GuardedTempRoot,
        layout: &InstallLayout,
        guarded_clone: &GuardedTempRoot,
        screenshots: &[ScreenshotEvidence],
        zero_owned_processes: bool,
    ) -> Result<bool, String> {
        let Some(release_tag) = env::var_os(WINDOWS_RELEASE_TAG_ENV).map(|value| value.to_string_lossy().to_string()) else {
            return Ok(false);
        };
        if capture_mode == LiveCaptureMode::FullSurfaces {
            return Err(format!(
                "{WINDOWS_RELEASE_TAG_ENV} is only supported by the Onboarding or Adjacent release acceptance profiles"
            ));
        }
        if !zero_owned_processes {
            return Err("refusing to write Windows release machine evidence before cleanup process guard passes".to_string());
        }
        let required = [
            (WINDOWS_RELEASE_INSTALLER_ENV, "final Windows NSIS installer"),
            (WINDOWS_RELEASE_PROVENANCE_ENV, "Windows NSIS provenance sidecar"),
            (WINDOWS_RELEASE_GENERIC_ENV, "shipped generic translator DLL"),
            (WINDOWS_RELEASE_QPA_ENV, "shipped QPA delegate DLL"),
        ];
        let mut artifacts = BTreeMap::new();
        for (variable, label) in required {
            let value = env::var_os(variable)
                .map(PathBuf::from)
                .ok_or_else(|| format!("{variable} must identify the {label}"))?;
            artifacts.insert(variable, release_file_identity(&value, label)?);
        }
        // apply_language_inner resolves both runtime sources from this clean checkout.  Bind
        // those exact bytes to the final NSIS inputs before publishing any machine evidence.
        require_release_runtime_sources(repo, &artifacts)?;
        let clone_sentinel_path = guarded_clone.root().join(".cavalry-i18n-disposable-smoke");
        let clone_sentinel = release_file_identity(&clone_sentinel_path, "disposable clone sentinel")?;
        let executable = release_file_identity(&layout.executable, "disposable Cavalry executable")?;
        let installer_path = PathBuf::from(artifacts[WINDOWS_RELEASE_INSTALLER_ENV]["path"].as_str().unwrap());
        let inventory_dir = run_root.join("inventory");
        evidence_root.assert_write_target(&inventory_dir)?;
        fs::create_dir(&inventory_dir)
            .map_err(|error| format!("could not create Windows live inventory directory {}: {error}", inventory_dir.display()))?;
        let scenario = match capture_mode {
            LiveCaptureMode::Onboarding => "onboarding",
            LiveCaptureMode::Adjacent => "adjacent",
            LiveCaptureMode::FullSurfaces => unreachable!(),
        };
        let mut ordinals = BTreeMap::<String, usize>::new();
        let mut points = Vec::with_capacity(screenshots.len());
        for screenshot in screenshots {
            let ordinal = ordinals.entry(screenshot.language.clone()).and_modify(|value| *value += 1).or_insert(1);
            let inventory_path = inventory_dir.join(format!(
                "{}-{scenario}-{ordinal}.json",
                screenshot.language
            ));
            evidence_root.assert_write_target(&inventory_path)?;
            let inventory = serde_json::json!({
                "schema": "cavalry-i18n.windows-live-inventory/v1",
                "language": &screenshot.language,
                "scenario": scenario,
                "ordinal": *ordinal,
                "pid": screenshot.process_id,
                "windowHandle": &screenshot.window_handle,
                "executableSha256": executable["sha256"].clone(),
                "genericPluginSha256": artifacts[WINDOWS_RELEASE_GENERIC_ENV]["sha256"].clone(),
                "qpaProxySha256": artifacts[WINDOWS_RELEASE_QPA_ENV]["sha256"].clone(),
                "translationSource": "packaged-nsis",
            });
            write_new_release_json(&inventory_path, &inventory)?;
            let inventory_identity = release_file_identity(&inventory_path, "live inventory")?;
            let screenshot_bytes = fs::metadata(&screenshot.path)
                .map_err(|error| format!("could not stat screenshot {}: {error}", screenshot.path.display()))?
                .len();
            points.push(serde_json::json!({
                "key": format!("{}/{scenario}/{}", screenshot.language, *ordinal),
                "language": &screenshot.language,
                "scenario": scenario,
                "ordinal": *ordinal,
                "screenshot": {
                    "path": screenshot.path.to_string_lossy(),
                    "bytes": screenshot_bytes,
                    "sha256": &screenshot.sha256,
                },
                "inventory": inventory_identity,
                "pid": screenshot.process_id,
                "startToken": format!("windows-live-pid-{}-{}-{}", screenshot.process_id, screenshot.language, *ordinal),
                "executableSha256": executable["sha256"].clone(),
                "genericPluginSha256": artifacts[WINDOWS_RELEASE_GENERIC_ENV]["sha256"].clone(),
                "qpaProxySha256": artifacts[WINDOWS_RELEASE_QPA_ENV]["sha256"].clone(),
                "interactionEvidence": format!("exact-pid={};hwnd={};{}", screenshot.process_id, screenshot.window_handle, screenshot.interaction_evidence),
            }));
        }
        if points.is_empty() {
            return Err("Windows release machine evidence requires at least one captured screenshot point".to_string());
        }
        let repo_string = repo.to_string_lossy().to_string();
        let git_head = command_first_line("git", &["-C", repo_string.as_str(), "rev-parse", "HEAD"], "git HEAD")?;
        let status_output = ProcessBuilder::new("git")
            .args(["-C", repo_string.as_str(), "status", "--short", "--untracked-files=all"])
            .output()
            .map_err(|error| format!("could not inspect source worktree: {error}"))?;
        if !status_output.status.success() {
            return Err(format!("git status failed: {}", String::from_utf8_lossy(&status_output.stderr).trim()));
        }
        let worktree_status = String::from_utf8_lossy(&status_output.stdout)
            .lines()
            .filter(|line| !line.trim().is_empty())
            .map(ToOwned::to_owned)
            .collect::<Vec<_>>();
        if !worktree_status.is_empty() {
            return Err(format!(
                "refusing to write Windows release machine evidence from a dirty source worktree: {}",
                worktree_status.join(" | ")
            ));
        }
        let cmake_version = resolve_pinned_cmake_version(repo)?;
        let powershell_version = command_first_line(
            "powershell.exe",
            &["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", "$PSVersionTable.PSVersion.ToString()"],
            "PowerShell version",
        )?;
        let runner = serde_json::json!({
            "os": "win32",
            "arch": "x64",
            "runnerOs": env::var("RUNNER_OS").unwrap_or_else(|_| "Windows".to_string()),
            "runnerArch": env::var("RUNNER_ARCH").unwrap_or_else(|_| "X64".to_string()),
            "imageOs": env::var("ImageOS").unwrap_or_else(|_| "Windows Server 2022".to_string()),
            "imageVersion": env::var("ImageVersion").unwrap_or_else(|_| "local-disposable-runner".to_string()),
            "node": command_first_line("node", &["--version"], "Node version")?,
            "npm": command_first_line(npm_program(), &["--version"], "npm version")?,
            "rustc": command_first_line("rustc", &["--version"], "rustc version")?,
            "cargo": command_first_line("cargo", &["--version"], "cargo version")?,
            "cmake": cmake_version,
            "powershell": powershell_version,
        });
        let profile = match capture_mode {
            LiveCaptureMode::Onboarding => "windows-onboarding-v1",
            LiveCaptureMode::Adjacent => "windows-adjacent-v1",
            LiveCaptureMode::FullSurfaces => unreachable!(),
        };
        let machine = serde_json::json!({
            "schema": "cavalry-i18n.windows-release.machine/v1",
            "status": "MACHINE-COMPLETE-MANUAL-PENDING",
            "createdAtUtc": Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Millis, true),
            "sessionId": run_root.file_name().and_then(|value| value.to_str()).ok_or_else(|| "release session has no safe basename".to_string())?,
            "releaseTag": release_tag.clone(),
            "repository": { "head": git_head.to_ascii_lowercase(), "worktreeStatus": worktree_status },
            "target": {
                "cavalryVersion": "2.7.2",
                "qtVersion": "6.6.3",
                "architecture": "x86_64",
                "clonePath": guarded_clone.root(),
                "cloneSentinel": clone_sentinel,
                "executable": executable,
                "restoredEnglish": true,
                "zeroOwnedProcesses": zero_owned_processes,
            },
            "installer": { "fileName": installer_path.file_name().and_then(|value| value.to_str()).ok_or_else(|| "installer filename is not valid UTF-8".to_string())?, "artifact": artifacts[WINDOWS_RELEASE_INSTALLER_ENV] },
            "provenance": { "artifact": artifacts[WINDOWS_RELEASE_PROVENANCE_ENV] },
            "shippedDlls": {
                "generic": { "relativePath": WINDOWS_GENERIC_RELATIVE_PATH, "artifact": artifacts[WINDOWS_RELEASE_GENERIC_ENV] },
                "qpa": { "relativePath": WINDOWS_QPA_RELATIVE_PATH, "artifact": artifacts[WINDOWS_RELEASE_QPA_ENV] },
            },
            "runner": runner,
            "matrix": {
                "profile": profile,
                "languages": ["zh-Hans", "zh-Hant", "ja_JP"],
                "scenarios": if capture_mode == LiveCaptureMode::Onboarding { serde_json::json!(["onboarding"]) } else { serde_json::json!(["adjacent"]) },
                "points": points,
            },
        });
        let sentinel_path = run_root.join(".cavalry-i18n-windows-release-acceptance");
        evidence_root.assert_write_target(&sentinel_path)?;
        let machine_path = run_root.join("windows-machine-record.json");
        evidence_root.assert_write_target(&machine_path)?;
        let mut sentinel = OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&sentinel_path)
            .map_err(|error| format!("could not create release session sentinel {}: {error}", sentinel_path.display()))?;
        sentinel
            .write_all(format!("{WINDOWS_RELEASE_SESSION_MAGIC}\nreleaseTag={release_tag}\n").as_bytes())
            .and_then(|_| sentinel.sync_all())
            .map_err(|error| format!("could not flush release session sentinel {}: {error}", sentinel_path.display()))?;
        write_new_release_json(&machine_path, &machine)?;
        Ok(true)
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
            "foregroundAttempt",
            "maxForegroundAttempts",
            "ShowWindow",
            "BringWindowToTop",
            "SetActiveWindow",
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
    fn full_surface_uses_owned_profile_and_complete_clone() {
        let repo = repo_root();
        let guard = fs::read_to_string(repo.join("src-tauri/tests/support/windows_clone_guard.rs"))
            .expect("clone guard must remain readable");
        let orchestration = fs::read_to_string(
            repo.join("src-tauri/tests/support/windows_live_orchestration.inc.rs"),
        )
        .expect("Windows live orchestration must remain readable");
        let live = fs::read_to_string(repo.join("src-tauri/tests/support/windows_live_tests.inc.rs"))
            .expect("Windows live test entry must remain readable");
        for required in [
            "assets/Icons/sign-in-bg.png",
            "assets/Icons/cavByCanva.png",
            "assets/Icons/tool_search.png",
            "live-clone-resources.json",
        ] {
            assert!(guard.contains(required), "clone guard must retain {required}");
        }
        assert!(orchestration.contains("profile-full-surfaces-"));
        assert!(orchestration.contains("OsString::from(\"LOCALAPPDATA\")"));
        assert!(orchestration.contains("OsString::from(\"APPDATA\")"));
        assert!(orchestration.contains("if capture_mode == LiveCaptureMode::FullSurfaces"));
        assert!(live.contains("verify_live_clone_completeness"));
    }

    #[test]
    fn release_machine_toolchain_resolves_windows_npm_entrypoint() {
        let version = command_first_line(npm_program(), &["--version"], "npm version")
            .expect("Windows release evidence must resolve the npm command entrypoint");
        assert!(
            !version.trim().is_empty(),
            "Windows release evidence must record a concrete npm version"
        );
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
        let run_root = evidence_root
            .create_unique_child_directory("windows-live")
            .unwrap_or_else(|error| panic!("{error}"));
        verify_live_clone_completeness(&evidence_root, &run_root, &layout, &guarded_clone)
            .unwrap_or_else(|error| panic!("{error}"));
        let (baseline_pairs, baseline) = capture_english_baseline(&repo, &layout, &guarded_clone)
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
            capture_mode,
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
        let release_machine_record = write_windows_release_machine_record(
            capture_mode,
            &repo,
            &run_root,
            &evidence_root,
            &layout,
            &guarded_clone,
            &screenshots,
            outstanding_processes.is_empty(),
        )
        .unwrap_or_else(|error| panic!("Windows live-clone release machine record failed: {error}; evidence_root={}", run_root.display()));
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
        if release_machine_record {
            panic!(
                "WINDOWS MACHINE RECORD READY: automated checks and cleanup passed; review only the existing PNGs, then run `node tools/windows-acceptance/review_windows_acceptance.js --tag <tag> --session-dir \"{}\" --reviewer <name> --repo-root <clean-repo>` to derive review/final records. No PASS was written by Rust.",
                run_root.display()
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
