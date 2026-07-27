/**
 * [INPUT]: 依赖 support/windows_disposable 路径守卫、显式 CAVALRY_I18N_WINDOWS_SMOKE_APP、repo 四语语言包与 Windows plugin
 * [OUTPUT]: 对外提供 ignored Windows 冒烟：三种非英语逐文件 apply、smoother/marker/plugin/QPA ACTIVE 验证与 English 资源及 vendor qwindows 原始字节回滚，并逐目标拒绝越界或 reparse 写入链
 * [POS]: src-tauri/tests 的人工 Windows 非 GUI 验收护栏，只写入用户明确提供且完整路径链可证的临时克隆，绝不启动 Cavalry 或触发 UAC
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#[cfg(target_os = "windows")]
#[path = "support/windows_disposable.rs"]
mod windows_disposable;

#[cfg(target_os = "windows")]
mod windows_smoke {
    use super::windows_disposable::{assert_safe_write_surface, disposable_install_layout};
    use cavalry_i18n_tauri::{
        commands::apply_language_inner,
        install::InstallLayout,
        patch::{self, CORE_MAP, PLUGIN_DEFINITION_MAP},
        privilege::RecordingRunner,
        state, windows_qpa,
    };
    use std::{
        collections::BTreeMap,
        env, fs,
        path::{Path, PathBuf},
    };

    const SMOKE_APP_ENV: &str = "CAVALRY_I18N_WINDOWS_SMOKE_APP";
    const PLUGIN_FILE_NAME: &str = "cavalryi18n.dll";

    fn require_graceful_close_only(language: &str, runner: &RecordingRunner) -> Result<(), String> {
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
                "{language} used an unexpected external/elevated command surface: {:?}",
                runner.commands
            ));
        }
        Ok(())
    }

    fn repo_root() -> PathBuf {
        Path::new(env!("CARGO_MANIFEST_DIR"))
            .parent()
            .expect("src-tauri must remain below the repository root")
            .to_path_buf()
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

    fn english_mismatch_paths(english_source: &Path, app: &Path) -> Result<Vec<PathBuf>, String> {
        patch::build_copy_pairs(english_source, app)
            .into_iter()
            .filter_map(|pair| {
                if !pair.dst.is_file() {
                    return Some(Ok(Some(pair.dst)));
                }
                let installed = fs::read(&pair.dst)
                    .map_err(|error| format!("could not read {}: {error}", pair.dst.display()))
                    .and_then(|bytes| {
                        serde_json::from_slice::<serde_json::Value>(&bytes)
                            .map_err(|error| format!("invalid {}: {error}", pair.dst.display()))
                    });
                let candidate = fs::read(&pair.src)
                    .map_err(|error| format!("could not read {}: {error}", pair.src.display()))
                    .and_then(|bytes| {
                        serde_json::from_slice::<serde_json::Value>(&bytes)
                            .map_err(|error| format!("invalid {}: {error}", pair.src.display()))
                    });
                Some(match (installed, candidate) {
                    (Ok(installed), Ok(candidate))
                        if patch::merge_translation_overlay(&installed, &candidate)
                            == installed =>
                    {
                        Ok(None)
                    }
                    (Ok(_), Ok(_)) => Ok(Some(pair.dst)),
                    (Err(error), _) | (_, Err(error)) => Err(error),
                })
            })
            .collect::<Result<Vec<_>, _>>()
            .map(|paths| paths.into_iter().flatten().collect())
    }

    fn verify_applied_language(
        repo: &Path,
        state_dir: &Path,
        layout: &InstallLayout,
        language: &str,
        smoothing_steps: &str,
        source_plugin: &[u8],
    ) -> Result<(), String> {
        let language_source = repo.join("languages").join(language);
        if !patch::install_matches_language_source(&language_source, &layout.root)? {
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
        let installed_plugin = layout.root.join("generic").join(PLUGIN_FILE_NAME);
        if fs::read(&installed_plugin).map_err(|error| {
            format!(
                "could not read installed plugin {}: {error}",
                installed_plugin.display()
            )
        })? != source_plugin
        {
            return Err(format!(
                "installed plugin differs from source for {language}"
            ));
        }
        let qpa = windows_qpa::inspect(layout)?;
        if qpa.state != windows_qpa::QpaDeploymentState::Active {
            return Err(format!(
                "{language} did not reach ACTIVE QPA state: {}",
                qpa.detail
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

    #[test]
    #[ignore = "requires an explicit disposable %TEMP% Cavalry clone; never run against a real installation"]
    fn disposable_clone_applies_three_languages_and_restores_every_english_resource() {
        let (layout, guarded_root) = disposable_install_layout(SMOKE_APP_ENV)
            .unwrap_or_else(|error| panic!("invalid {SMOKE_APP_ENV}: {error}"));
        let app = &layout.root;
        let repo = repo_root();
        let source_plugin = repo.join("injector/windows/generic").join(PLUGIN_FILE_NAME);
        let source_plugin_bytes = fs::read(&source_plugin).unwrap_or_else(|error| {
            panic!(
                "missing Windows plugin source {}: {error}",
                source_plugin.display()
            )
        });

        let state_dir = tempfile::tempdir().expect("could not create isolated smoke state");
        let now = "2026-07-24T00:00:00.000Z";
        let english_source = repo.join("languages/en");
        let english_mismatches = english_mismatch_paths(&english_source, app)
            .expect("could not verify clean English clone");
        assert!(
            english_mismatches.is_empty(),
            "disposable clone must start from packaged English resources; mismatched paths: {}",
            english_mismatches
                .iter()
                .map(|path| path.display().to_string())
                .collect::<Vec<_>>()
                .join(", ")
        );
        let baseline_pairs = patch::build_copy_pairs(&english_source, app);
        let vendor_qwindows = fs::read(app.join(windows_qpa::QWINDOWS_FILE_NAME))
            .expect("could not capture vendor qwindows.dll baseline");
        let expected_pair_count =
            CORE_MAP.len() + PLUGIN_DEFINITION_MAP.len() + patch::discover_plugins(app).len();
        assert_eq!(
            baseline_pairs.len(),
            expected_pair_count,
            "English baseline did not include every known core/plugin resource"
        );
        assert_safe_write_surface(&guarded_root, &layout, &baseline_pairs)
            .unwrap_or_else(|error| panic!("unsafe disposable write surface: {error}"));
        let baseline = baseline_pairs
            .iter()
            .map(|pair| {
                fs::read(&pair.dst)
                    .map(|bytes| (pair.dst.clone(), bytes))
                    .unwrap_or_else(|error| {
                        panic!(
                            "could not capture English baseline {}: {error}",
                            pair.dst.display()
                        )
                    })
            })
            .collect::<BTreeMap<_, _>>();

        let exercise_result = (|| -> Result<(), String> {
            for (language, smoothing_steps) in [
                ("zh-Hans", "平滑步数"),
                ("zh-Hant", "平滑步數"),
                ("ja_JP", "スムージングステップ数"),
            ] {
                let mut runner = RecordingRunner::default();
                let applied = apply_language_inner(
                    &repo,
                    state_dir.path(),
                    &repo,
                    app,
                    language,
                    &mut runner,
                    now,
                )?;
                if !applied.ok || applied.current_lang.as_deref() != Some(language) {
                    return Err(format!("{language} apply returned an invalid payload"));
                }
                require_graceful_close_only(language, &runner)?;
                verify_applied_language(
                    &repo,
                    state_dir.path(),
                    &layout,
                    language,
                    smoothing_steps,
                    &source_plugin_bytes,
                )?;
            }
            for pair in &baseline_pairs {
                let relative = pair.src.strip_prefix(&english_source).map_err(|_| {
                    format!(
                        "English pair escaped its source root: {}",
                        pair.src.display()
                    )
                })?;
                let snapshot = state_dir.path().join("en").join(relative);
                let snapshot_bytes = fs::read(&snapshot).map_err(|error| {
                    format!("could not read snapshot {}: {error}", snapshot.display())
                })?;
                if snapshot_bytes != baseline[&pair.dst] {
                    return Err(format!(
                        "English snapshot differs from original {}",
                        pair.dst.display()
                    ));
                }
            }
            Ok(())
        })();

        let mut english_runner = RecordingRunner::default();
        let restore_result = apply_language_inner(
            &repo,
            state_dir.path(),
            &repo,
            app,
            "en",
            &mut english_runner,
            now,
        );
        let restored = restore_result.unwrap_or_else(|restore_error| {
            panic!(
                "English restore failed after language exercise {:?}: {restore_error}",
                exercise_result.as_ref().err()
            )
        });
        assert!(
            exercise_result.is_ok(),
            "language exercise failed before successful English restore: {}",
            exercise_result.unwrap_err()
        );
        assert!(restored.ok);
        assert_eq!(restored.current_lang.as_deref(), Some("en"));
        require_graceful_close_only("en", &english_runner)
            .expect("the disposable clone used more than the graceful close gate");
        assert!(
            patch::install_matches_language_source(&english_source, app)
                .expect("could not verify restored English clone"),
            "restored clone does not match packaged English leaves"
        );
        assert_eq!(
            installed_smoothing_steps(&layout).expect("missing restored smoother"),
            "Smoothing Steps"
        );
        for (destination, original_english) in baseline {
            assert_eq!(
                fs::read(&destination).unwrap_or_else(|error| {
                    panic!(
                        "could not read restored resource {}: {error}",
                        destination.display()
                    )
                }),
                original_english,
                "English restore did not byte-restore {}",
                destination.display()
            );
        }
        assert_eq!(
            state::read_state(state_dir.path())
                .expect("missing smoke state after English restore")
                .current_lang,
            "en"
        );
        assert_eq!(
            fs::read(app.join(windows_qpa::QWINDOWS_FILE_NAME))
                .expect("could not read restored qwindows.dll"),
            vendor_qwindows,
            "English selection did not byte-restore vendor qwindows.dll"
        );
        let qpa = windows_qpa::inspect(&layout).expect("could not inspect restored QPA state");
        assert_eq!(qpa.state, windows_qpa::QpaDeploymentState::Stock);
        assert!(
            !windows_qpa::recovery_directory(&layout).exists(),
            "English selection left QPA recovery state behind"
        );
    }
}
