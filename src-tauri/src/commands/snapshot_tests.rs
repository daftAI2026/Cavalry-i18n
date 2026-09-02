/**
 * [INPUT]: 依赖 snapshot.rs 的 English gate、state durability helper、refresh gate 与 Windows QPA 只读证据 seam。
 * [OUTPUT]: 提供 snapshot 状态耐久性、Managed Legacy 基线复用、refresh 零写入、Windows residue/recovery fail-closed 的单元合同。
 * [POS]: commands/snapshot.rs 的测试投影；与生产快照逻辑分离，保持领域文件低于 800 行且不扩大运行时 API。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
use super::*;

#[test]
fn only_complete_json_only_managed_legacy_provenance_is_reusable() {
    let managed = EnglishSnapshotProvenance {
        install_root: "/Applications/Cavalry.app".to_string(),
        immutable_revision: "macos-identity:fixture".to_string(),
        snapshot_generation: Some("generation".to_string()),
        snapshot_manifest_sha256: Some("manifest".to_string()),
        vendor_baseline_id: None,
    };
    assert!(managed_legacy_baseline_is_usable(Some(&managed), true));
    assert!(!managed_legacy_baseline_is_usable(Some(&managed), false));

    let official = EnglishSnapshotProvenance {
        vendor_baseline_id: Some("official-generation".to_string()),
        ..managed.clone()
    };
    assert!(!managed_legacy_baseline_is_usable(Some(&official), true));

    let incomplete = EnglishSnapshotProvenance {
        snapshot_manifest_sha256: None,
        ..managed
    };
    assert!(!managed_legacy_baseline_is_usable(Some(&incomplete), true));
    assert!(!managed_legacy_baseline_is_usable(None, true));
}

#[test]
fn unchanged_snapshot_reconfirms_directory_durability_and_surfaces_failure() {
    let temp = tempfile::tempdir().unwrap();
    let current = State {
        app_path: "/Applications/Cavalry.app".to_string(),
        cavalry_revision: "revision".to_string(),
        ..State::default()
    };
    let mut called = false;
    let (next, warning) = commit_or_confirm_snapshot_state_with(
        temp.path(),
        current.clone(),
        current.clone(),
        |path| {
            called = true;
            Ok(Some(state::StateWriteWarning::DirectorySyncAfterCommit {
                directory: path.to_path_buf(),
                detail: "injected retry fsync failure".to_string(),
            }))
        },
    )
    .unwrap();

    assert!(called, "no-op snapshot must execute the durability retry");
    assert_eq!(next, current);
    assert!(warning
        .as_deref()
        .is_some_and(|warning| warning.contains("injected retry fsync failure")));
    assert!(temp.path().read_dir().unwrap().next().is_none());
}

#[test]
fn only_user_language_actions_own_pending_recovery() {
    let snapshot_source = include_str!("snapshot.rs");
    let apply_source = include_str!("apply.rs");
    let status_source = include_str!("status.rs");
    let restart_source = include_str!("restart.rs");
    let lib_source = include_str!("../lib.rs");
    let startup_status_source = status_source
        .split("pub(crate) fn get_status_for_app")
        .nth(1)
        .expect("status must expose the Tauri startup projection")
        .split("fn record_status_diagnostics")
        .next()
        .expect("startup status projection must precede diagnostics");
    let snapshot_production = snapshot_source
        .split("#[cfg(test)]")
        .next()
        .expect("snapshot production source should precede its test module");

    assert!(
        !snapshot_production.contains("recover_macos_apply_for_selection"),
        "refresh/extract must not recover pending macOS transactions"
    );
    assert!(
        apply_source.contains("recover_macos_apply_for_selection"),
        "apply must retain pending macOS recovery before mutation"
    );
    assert!(
        apply_source.contains("recover_windows_language_transaction_for_selection"),
        "apply must retain pending Windows recovery before mutation"
    );
    for (owner, source) in [
        ("status", startup_status_source),
        ("restart", restart_source),
        ("startup", lib_source),
    ] {
        assert!(
            !source.contains("pending_macos_apply_install_root")
                && !source.contains("recover_macos_apply_for_selection"),
            "{owner} must not inspect or recover pending language transactions"
        );
    }
}

#[cfg(target_os = "windows")]
mod windows_reconciliation_tests {
    use super::*;
    use std::cell::Cell;
    use std::path::Path;

    fn write(path: &Path, bytes: &[u8]) {
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::write(path, bytes).unwrap();
    }

    fn vendor_reinstall_recovery(
        _layout: &InstallLayout,
    ) -> Result<crate::windows_qpa::QpaInspection, String> {
        Ok(crate::windows_qpa::QpaInspection {
            state: crate::windows_qpa::QpaDeploymentState::Recover,
            phase: Some(crate::windows_qpa::QpaManifestPhase::Active),
            current_qwindows_sha256: Some(crate::windows_qpa::VENDOR_QWINDOWS_SHA256.to_string()),
            detail: "vendor reinstall left owned recovery metadata".to_string(),
        })
    }

    fn invalid_manifest_recovery(
        _layout: &InstallLayout,
    ) -> Result<crate::windows_qpa::QpaInspection, String> {
        Ok(crate::windows_qpa::QpaInspection {
            state: crate::windows_qpa::QpaDeploymentState::Recover,
            phase: None,
            current_qwindows_sha256: Some(crate::windows_qpa::VENDOR_QWINDOWS_SHA256.to_string()),
            detail: "the durable QPA manifest is invalid".to_string(),
        })
    }

    #[test]
    fn proven_english_with_stale_translated_marker_requires_reconciliation() {
        let temp = tempfile::tempdir().unwrap();
        let repo = temp.path().join("repo");
        let app = temp.path().join("Cavalry");
        write(&app.join("Cavalry.exe"), b"fixture executable");
        for (source, target) in crate::patch::CORE_MAP {
            write(
                &repo.join("languages/en").join(source),
                br#"{"value":"en"}"#,
            );
            write(&app.join("assets").join(target), br#"{"value":"en"}"#);
        }
        write(&app.join(crate::install::LANG_MARKER_NAME), b"zh-Hant\n");

        let disposition = ensure_clean_english_install_with_qpa_inspector(
            &repo,
            &repo,
            &app,
            vendor_reinstall_recovery,
        )
        .unwrap();

        assert_eq!(
            disposition,
            CleanEnglishDisposition::NeedsWindowsReconciliation
        );

        let projected = project_proven_english_state_with_qpa_inspector(
            &repo,
            &repo,
            &app,
            State {
                current_lang: "zh-Hant".to_string(),
                ..State::default()
            },
            vendor_reinstall_recovery,
        );
        assert_eq!(projected.current_lang, "en");
        assert_eq!(
            fs::read_to_string(app.join(crate::install::LANG_MARKER_NAME)).unwrap(),
            "zh-Hant\n",
            "read-only status projection must not mutate Program Files"
        );
    }

    #[test]
    fn refresh_returns_reconciliation_without_using_runner_or_mutating_install() {
        let temp = tempfile::tempdir().unwrap();
        let repo = temp.path().join("repo");
        let state = temp.path().join("state");
        let app = temp.path().join("Cavalry");
        write(&app.join("Cavalry.exe"), b"fixture executable");
        for (source, target) in crate::patch::CORE_MAP {
            write(
                &repo.join("languages/en").join(source),
                br#"{"value":"en"}"#,
            );
            write(&app.join("assets").join(target), br#"{"value":"en"}"#);
        }
        let marker = app.join(crate::install::LANG_MARKER_NAME);
        write(&marker, b"zh-Hant\n");
        let qwindows = app.join(crate::windows_qpa::QWINDOWS_FILE_NAME);
        let generic = app.join(crate::windows_qpa::GENERIC_PLUGIN_RELATIVE_PATH);
        let recovery_sentinel = app
            .join(crate::windows_qpa::RECOVERY_DIRECTORY_NAME)
            .join("sentinel");
        write(&qwindows, b"vendor qwindows");
        write(&generic, b"owned generic");
        write(&recovery_sentinel, b"owned recovery evidence");
        let mut install_files = vec![app.join("Cavalry.exe"), marker.clone()];
        install_files.extend(
            crate::patch::CORE_MAP
                .iter()
                .map(|(_, target)| app.join("assets").join(target)),
        );
        install_files.extend([qwindows, generic, recovery_sentinel]);
        let install_before = install_files
            .iter()
            .map(fs::read)
            .collect::<Result<Vec<_>, _>>()
            .unwrap();

        let ensure_clean = |_repo_root: &Path,
                            _resource_dir: &Path,
                            _app_path: &Path|
         -> Result<CleanEnglishDisposition, String> {
            Ok(CleanEnglishDisposition::NeedsWindowsReconciliation)
        };
        let mut runner = crate::privilege::RecordingRunner::default();
        let payload = refresh_english_inner_with_clean_check(
            &repo,
            &state,
            &repo,
            &app,
            &mut runner,
            &ensure_clean,
        )
        .unwrap();

        assert!(payload.ok);
        assert_eq!(payload.reconciliation_required, true);
        assert!(
            runner.commands.is_empty(),
            "refresh must not run system commands"
        );
        let install_after = install_files
            .iter()
            .map(fs::read)
            .collect::<Result<Vec<_>, _>>()
            .unwrap();
        assert_eq!(
            install_after, install_before,
            "refresh must not write installation/runtime files"
        );
    }

    #[test]
    fn refresh_uses_one_snapshot_gate_and_surfaces_that_disposition() {
        let temp = tempfile::tempdir().unwrap();
        let repo = temp.path().join("repo");
        let state = temp.path().join("state");
        let app = temp.path().join("Cavalry");
        write(&app.join("Cavalry.exe"), b"fixture executable");
        for (source, target) in crate::patch::CORE_MAP {
            write(
                &repo.join("languages/en").join(source),
                br#"{"value":"en"}"#,
            );
            write(&app.join("assets").join(target), br#"{"value":"en"}"#);
        }
        write(&app.join(crate::install::LANG_MARKER_NAME), b"zh-Hant\n");

        let checks = Cell::new(0usize);
        let ensure_clean = |_repo_root: &Path,
                            _resource_dir: &Path,
                            _app_path: &Path|
         -> Result<CleanEnglishDisposition, String> {
            let count = checks.get();
            checks.set(count + 1);
            assert_eq!(count, 0, "refresh must use one snapshot gate");
            Ok(CleanEnglishDisposition::NeedsWindowsReconciliation)
        };
        let mut runner = crate::privilege::RecordingRunner::default();
        let payload = refresh_english_inner_with_clean_check(
            &repo,
            &state,
            &repo,
            &app,
            &mut runner,
            &ensure_clean,
        )
        .unwrap();

        assert_eq!(checks.get(), 1);
        assert!(payload.reconciliation_required);
    }

    #[test]
    fn invalid_manifest_recovery_is_rejected_before_english_snapshot_capture() {
        let temp = tempfile::tempdir().unwrap();
        let repo = temp.path().join("repo");
        let app = temp.path().join("Cavalry");
        write(&app.join("Cavalry.exe"), b"fixture executable");
        for (source, target) in crate::patch::CORE_MAP {
            write(
                &repo.join("languages/en").join(source),
                br#"{"value":"en"}"#,
            );
            write(&app.join("assets").join(target), br#"{"value":"en"}"#);
        }
        write(&app.join(crate::install::LANG_MARKER_NAME), b"en\n");

        let error = ensure_clean_english_install_with_qpa_inspector(
            &repo,
            &repo,
            &app,
            invalid_manifest_recovery,
        )
        .unwrap_err();

        assert!(error.contains("not proven stock"), "{error}");
    }
}
