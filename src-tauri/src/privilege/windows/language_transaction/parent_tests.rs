/**
 * [INPUT]: 依赖 parent 的可注入 QPA/launcher/postcondition seam 与 tempfile Windows fixture。
 * [OUTPUT]: 覆盖 Program Files 早分流、严格目标映射、仅在无 journal 时成立的 AlreadyStock 零 UAC、pending journal 强制 worker、单次 UAC、取消零目标写入、source provenance E2E 及 0/42/43/44/45/未知退出语义。
 * [POS]: language_transaction parent 的隔离合同测试；不调用真实 UAC、不写真实 Program Files，并挂接真实 patch→stage→verifier 子合同。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
use std::{
    cell::Cell,
    fs,
    path::{Path, PathBuf},
};

use super::*;
use crate::install::LANG_MARKER_NAME;
use crate::patch::CORE_MAP;
use crate::windows_qpa::{
    QpaActivationPlan, QpaNoopPlan, QpaNoopReason, QpaTransitionPlan, SUPPORTED_ARCHITECTURE,
    SUPPORTED_CAVALRY_VERSION, SUPPORTED_QT_VERSION,
};

struct Fixture {
    _temp: tempfile::TempDir,
    program_files: PathBuf,
    layout: InstallLayout,
    state: PathBuf,
    staging: PathBuf,
    worker_exe: PathBuf,
    proxy: PathBuf,
    generic: PathBuf,
    pairs: Vec<CopyPair>,
}

impl Fixture {
    fn new() -> Self {
        let temp = tempfile::tempdir().unwrap();
        let program_files = temp.path().join("Program Files");
        let root = program_files.join("Cavalry");
        let layout = InstallLayout::from_root(&root);
        fs::create_dir_all(&layout.assets_root).unwrap();
        fs::create_dir_all(layout.assets_root.join("Plugins")).unwrap();
        fs::write(&layout.executable, b"fixture-exe").unwrap();
        fs::write(root.join("Qt6Core.dll"), b"fixture-qt").unwrap();
        fs::write(root.join("qwindows.dll"), fake_x64_pe(b"fixture-vendor")).unwrap();

        let state = temp.path().join("state");
        let staging = state.join("staging");
        let overlay = staging.join("overlay");
        fs::create_dir_all(&overlay).unwrap();
        let mut pairs = Vec::new();
        for (index, (_, asset_relative)) in CORE_MAP.into_iter().enumerate() {
            let destination = layout.assets_root.join(asset_relative);
            fs::create_dir_all(destination.parent().unwrap()).unwrap();
            fs::write(&destination, format!("old-{index}")).unwrap();
            let source = overlay.join(format!("{index}.json"));
            fs::write(&source, format!("new-{index}")).unwrap();
            pairs.push(CopyPair {
                src: source,
                dst: destination,
            });
        }

        let worker_exe = temp.path().join("switcher.exe");
        fs::write(&worker_exe, b"switcher").unwrap();
        let proxy = temp.path().join("proxy.dll");
        let generic = temp.path().join("generic.dll");
        fs::write(&proxy, b"proxy").unwrap();
        fs::write(&generic, b"generic").unwrap();
        Self {
            _temp: temp,
            program_files,
            layout,
            state,
            staging,
            worker_exe,
            proxy,
            generic,
            pairs,
        }
    }

    fn request(&self, language: &'static str) -> ParentApplyRequest<'_> {
        ParentApplyRequest {
            repo_root: self._temp.path(),
            resource_dir: self._temp.path(),
            state_dir: &self.state,
            layout: &self.layout,
            language,
            cavalry_version: "2.7.2",
            staging_root: &self.staging,
            overlay_pairs: &self.pairs,
        }
    }

    fn runtime_sources(&self, _language: Language) -> RuntimeSources {
        RuntimeSources {
            generic: self.generic.clone(),
            proxy: self.proxy.clone(),
        }
    }
}

fn synthetic_transition(
    language: Language,
    layout: &InstallLayout,
    _version: &str,
    proxy: &Path,
    generic: Option<&Path>,
) -> Result<QpaTransitionPlan, String> {
    if language == Language::English {
        return Ok(QpaTransitionPlan::Noop(QpaNoopPlan {
            schema_version: 1,
            install_root: layout.root.to_string_lossy().to_string(),
            reason: QpaNoopReason::AlreadyStock,
            cavalry_version: SUPPORTED_CAVALRY_VERSION.to_string(),
            cavalry_executable_sha256: sha256_file(&layout.executable)?,
            qt_version: SUPPORTED_QT_VERSION.to_string(),
            architecture: SUPPORTED_ARCHITECTURE.to_string(),
            expected_current_qwindows_sha256: snapshot_hash(&layout.root.join("qwindows.dll"))?,
        }));
    }
    let generic = generic.ok_or("missing generic")?;
    Ok(QpaTransitionPlan::Activate(QpaActivationPlan {
        schema_version: 1,
        install_root: layout.root.to_string_lossy().to_string(),
        proxy_source_path: proxy.to_string_lossy().to_string(),
        cavalry_version: SUPPORTED_CAVALRY_VERSION.to_string(),
        cavalry_executable_sha256: sha256_file(&layout.executable)?,
        qt_version: SUPPORTED_QT_VERSION.to_string(),
        architecture: SUPPORTED_ARCHITECTURE.to_string(),
        expected_current_qwindows_sha256: snapshot_hash(&layout.root.join("qwindows.dll"))?,
        vendor_qwindows_sha256: sha256_file(&layout.root.join("qwindows.dll"))?,
        proxy_qwindows_sha256: sha256_file(proxy)?,
        generic_plugin_sha256: sha256_file(generic)?,
    }))
}

fn vendor_preserved_transition(
    language: Language,
    layout: &InstallLayout,
    _version: &str,
    _proxy: &Path,
    _generic: Option<&Path>,
) -> Result<QpaTransitionPlan, String> {
    if language != Language::English {
        return Err("vendor-preserved fixture is English-only".to_string());
    }
    Ok(QpaTransitionPlan::Noop(QpaNoopPlan {
        schema_version: 1,
        install_root: layout.root.to_string_lossy().to_string(),
        reason: QpaNoopReason::VendorUpdatePreserved,
        cavalry_version: SUPPORTED_CAVALRY_VERSION.to_string(),
        cavalry_executable_sha256: sha256_file(&layout.executable)?,
        qt_version: SUPPORTED_QT_VERSION.to_string(),
        architecture: SUPPORTED_ARCHITECTURE.to_string(),
        expected_current_qwindows_sha256: snapshot_hash(&layout.root.join("qwindows.dll"))?,
    }))
}

fn simulate_worker(token: &str, exit: u32) -> Result<u32, LaunchError> {
    if !matches!(
        exit,
        WORKER_EXIT_COMMITTED_CLEAN | WORKER_EXIT_COMMITTED_WITH_CLEANUP_RESIDUAL
    ) {
        return Ok(exit);
    }
    let transport = WorkerTransport::decode(token).unwrap();
    let bytes = fs::read(&transport.plan_path).unwrap();
    let plan = super::super::contract::deserialize_bound_plan(&bytes, &transport).unwrap();
    let pending = plan
        .payloads
        .iter()
        .position(|record| record.kind == PayloadKind::PendingMarker)
        .unwrap();
    apply_record(&plan, &transport.plan_path, pending);
    for (index, record) in plan.payloads.iter().enumerate() {
        if matches!(
            record.kind,
            PayloadKind::PendingMarker | PayloadKind::FinalMarker | PayloadKind::QpaProxySource
        ) {
            continue;
        }
        apply_record(&plan, &transport.plan_path, index);
    }
    let final_marker = plan
        .payloads
        .iter()
        .position(|record| record.kind == PayloadKind::FinalMarker)
        .unwrap();
    apply_record(&plan, &transport.plan_path, final_marker);
    Ok(exit)
}

fn fake_x64_pe(payload: &[u8]) -> Vec<u8> {
    let mut bytes = vec![0_u8; 0x100];
    bytes[..2].copy_from_slice(b"MZ");
    bytes[60..64].copy_from_slice(&(0x80_u32).to_le_bytes());
    bytes[0x80..0x84].copy_from_slice(b"PE\0\0");
    bytes[0x84..0x86].copy_from_slice(&0x8664_u16.to_le_bytes());
    bytes[0x98..0x9a].copy_from_slice(&0x020b_u16.to_le_bytes());
    bytes.extend_from_slice(payload);
    bytes
}

fn apply_record(plan: &ElevatedLanguagePlan, plan_path: &Path, index: usize) {
    let record = &plan.payloads[index];
    let source = super::super::contract::payload_source_path(plan_path, index).unwrap();
    let destination = match record.kind {
        PayloadKind::PendingMarker | PayloadKind::FinalMarker => {
            PathBuf::from(&plan.install_root).join(LANG_MARKER_NAME)
        }
        PayloadKind::GenericPlugin => {
            PathBuf::from(&plan.install_root).join(GENERIC_PLUGIN_RELATIVE_PATH)
        }
        PayloadKind::CoreAsset
        | PayloadKind::KnownPluginDefinition
        | PayloadKind::DiscoveredPluginStrings => PathBuf::from(&plan.install_root)
            .join("assets")
            .join(record.id.replace('/', "\\")),
        PayloadKind::QpaProxySource => return,
    };
    fs::create_dir_all(destination.parent().unwrap()).unwrap();
    fs::copy(source, destination).unwrap();
}

fn apply_fixture(
    fixture: &Fixture,
    language: Language,
    exit: u32,
    launches: &Cell<usize>,
) -> Result<ParentApplyOutcome, ParentApplyError> {
    apply_with_dependencies(
        fixture.request(language.as_str()),
        language,
        std::slice::from_ref(&fixture.program_files),
        &fixture.worker_exe,
        fixture.runtime_sources(language),
        synthetic_transition,
        |_exe, token| {
            launches.set(launches.get() + 1);
            simulate_worker(token, exit)
        },
        |_layout, _language, _transition| Ok(()),
    )
}

fn prepared_plan_directories(staging: &Path) -> Vec<PathBuf> {
    fs::read_dir(staging)
        .unwrap()
        .filter_map(Result::ok)
        .map(|entry| entry.path())
        .filter(|path| {
            path.file_name()
                .and_then(|name| name.to_str())
                .is_some_and(|name| name.starts_with("elevated-language-"))
        })
        .collect()
}

#[test]
fn committed_worker_launches_once_and_verifies_all_postimages() {
    let fixture = Fixture::new();
    let launches = Cell::new(0);
    let outcome = apply_fixture(
        &fixture,
        Language::English,
        WORKER_EXIT_COMMITTED_CLEAN,
        &launches,
    )
    .unwrap();

    assert_eq!(launches.get(), 1);
    assert_eq!(
        outcome,
        ParentApplyOutcome::Applied {
            worker_cleanup_residual: false,
            staging_cleanup_warning: None
        }
    );
    assert_eq!(
        fs::read_to_string(&fixture.layout.language_marker).unwrap(),
        "en\n"
    );
    assert!(fixture
        .pairs
        .iter()
        .all(|pair| fs::read(&pair.src).unwrap() == fs::read(&pair.dst).unwrap()));
}

#[test]
fn worker_cleanup_residual_is_success_with_a_structured_warning_bit() {
    let fixture = Fixture::new();
    let launches = Cell::new(0);
    let outcome = apply_fixture(
        &fixture,
        Language::English,
        WORKER_EXIT_COMMITTED_WITH_CLEANUP_RESIDUAL,
        &launches,
    )
    .unwrap();

    assert_eq!(launches.get(), 1);
    assert!(matches!(
        outcome,
        ParentApplyOutcome::Applied {
            worker_cleanup_residual: true,
            ..
        }
    ));
}

#[test]
fn uac_cancel_is_structured_and_does_not_touch_install_targets() {
    let fixture = Fixture::new();
    let before = fixture
        .pairs
        .iter()
        .map(|pair| fs::read(&pair.dst).unwrap())
        .collect::<Vec<_>>();
    let launches = Cell::new(0);
    let result = apply_with_dependencies(
        fixture.request("en"),
        Language::English,
        std::slice::from_ref(&fixture.program_files),
        &fixture.worker_exe,
        fixture.runtime_sources(Language::English),
        synthetic_transition,
        |_exe, _token| {
            launches.set(launches.get() + 1);
            Err(LaunchError::Cancelled(1223))
        },
        |_layout, _language, _transition| Ok(()),
    );

    assert_eq!(
        result,
        Err(ParentApplyError::PermissionRequired {
            code: 1223,
            staging_cleanup_warning: None
        })
    );
    assert_eq!(launches.get(), 1);
    assert!(!fixture.layout.language_marker.exists());
    assert_eq!(
        before,
        fixture
            .pairs
            .iter()
            .map(|pair| fs::read(&pair.dst).unwrap())
            .collect::<Vec<_>>()
    );
}

#[test]
fn postlaunch_result_loss_is_uncertain_and_preserves_bound_staging() {
    for launch_error in [
        LaunchError::MissingProcessHandle,
        LaunchError::WaitFailed(5),
        LaunchError::UnexpectedWaitStatus(0x102),
        LaunchError::ExitCodeRead {
            hresult: -1,
            message: "fixture".to_string(),
        },
    ] {
        let fixture = Fixture::new();
        let result = apply_with_dependencies(
            fixture.request("en"),
            Language::English,
            std::slice::from_ref(&fixture.program_files),
            &fixture.worker_exe,
            fixture.runtime_sources(Language::English),
            synthetic_transition,
            |_exe, _token| Err(launch_error.clone()),
            |_layout, _language, _transition| Ok(()),
        );

        let Err(ParentApplyError::WorkerStateUncertain {
            staging_cleanup_warning: Some(warning),
        }) = result
        else {
            panic!("postlaunch failure must be state-uncertain");
        };
        assert!(warning.contains("retained"));
        let directories = prepared_plan_directories(&fixture.staging);
        assert_eq!(directories.len(), 1);
        assert!(directories[0].join("plan.json").is_file());
        assert!(directories[0].join("payloads").is_dir());
    }
}

#[test]
fn prelaunch_failures_are_rejected_and_clean_the_prepared_plan() {
    for launch_error in [
        LaunchError::InvalidExecutable("fixture"),
        LaunchError::InvalidTransport("fixture"),
        LaunchError::ShellExecute {
            hresult: -1,
            message: "fixture".to_string(),
        },
    ] {
        let fixture = Fixture::new();
        let result = apply_with_dependencies(
            fixture.request("en"),
            Language::English,
            std::slice::from_ref(&fixture.program_files),
            &fixture.worker_exe,
            fixture.runtime_sources(Language::English),
            synthetic_transition,
            |_exe, _token| Err(launch_error.clone()),
            |_layout, _language, _transition| Ok(()),
        );

        assert!(matches!(result, Err(ParentApplyError::Rejected(_))));
        assert!(prepared_plan_directories(&fixture.staging).is_empty());
    }
}

#[test]
fn fully_english_unknown_vendor_qpa_is_rejected_without_uac() {
    let fixture = Fixture::new();
    for pair in &fixture.pairs {
        fs::copy(&pair.src, &pair.dst).unwrap();
    }
    fs::write(&fixture.layout.language_marker, b"en\n").unwrap();
    let launches = Cell::new(0);
    let verifications = Cell::new(0);
    let result = apply_with_dependencies(
        fixture.request("en"),
        Language::English,
        std::slice::from_ref(&fixture.program_files),
        &fixture.worker_exe,
        fixture.runtime_sources(Language::English),
        vendor_preserved_transition,
        |_exe, _token| {
            launches.set(launches.get() + 1);
            Ok(WORKER_EXIT_COMMITTED_CLEAN)
        },
        |_layout, language, transition| {
            assert_eq!(language, Language::English);
            assert!(matches!(
                transition,
                QpaTransitionPlan::Noop(QpaNoopPlan {
                    reason: QpaNoopReason::VendorUpdatePreserved,
                    ..
                })
            ));
            verifications.set(verifications.get() + 1);
            verify_qpa_postcondition(_layout, language, transition)
        },
    );

    assert_eq!(launches.get(), 0);
    assert_eq!(verifications.get(), 1);
    assert!(matches!(result, Err(ParentApplyError::Rejected(_))));
    assert!(prepared_plan_directories(&fixture.staging).is_empty());
}

#[test]
fn fully_applied_english_already_stock_is_success_without_uac() {
    let fixture = Fixture::new();
    for pair in &fixture.pairs {
        fs::copy(&pair.src, &pair.dst).unwrap();
    }
    fs::write(&fixture.layout.language_marker, b"en\n").unwrap();
    let launches = Cell::new(0);
    let verifications = Cell::new(0);
    let outcome = apply_with_dependencies(
        fixture.request("en"),
        Language::English,
        std::slice::from_ref(&fixture.program_files),
        &fixture.worker_exe,
        fixture.runtime_sources(Language::English),
        synthetic_transition,
        |_exe, _token| {
            launches.set(launches.get() + 1);
            Ok(WORKER_EXIT_COMMITTED_CLEAN)
        },
        |_layout, language, transition| {
            assert_eq!(language, Language::English);
            assert!(matches!(
                transition,
                QpaTransitionPlan::Noop(QpaNoopPlan {
                    reason: QpaNoopReason::AlreadyStock,
                    ..
                })
            ));
            verifications.set(verifications.get() + 1);
            Ok(())
        },
    )
    .unwrap();

    assert_eq!(
        outcome,
        ParentApplyOutcome::Applied {
            worker_cleanup_residual: false,
            staging_cleanup_warning: None,
        }
    );
    assert_eq!(launches.get(), 0);
    assert_eq!(verifications.get(), 1);
    assert!(prepared_plan_directories(&fixture.staging).is_empty());
}

#[test]
fn pending_journal_forces_worker_instead_of_english_noop() {
    let fixture = Fixture::new();
    for pair in &fixture.pairs {
        fs::copy(&pair.src, &pair.dst).unwrap();
    }
    fs::write(&fixture.layout.language_marker, b"en\n").unwrap();
    fs::create_dir(fixture.layout.root.join(format!(
        "{}{}",
        super::super::storage::JOURNAL_PREFIX,
        "a".repeat(64)
    )))
    .unwrap();
    let launches = Cell::new(0);

    let result = apply_with_dependencies(
        fixture.request("en"),
        Language::English,
        std::slice::from_ref(&fixture.program_files),
        &fixture.worker_exe,
        fixture.runtime_sources(Language::English),
        synthetic_transition,
        |_exe, _token| {
            launches.set(launches.get() + 1);
            Ok(WORKER_EXIT_ROLLED_BACK_OR_ZERO_MUTATION_CLEAN)
        },
        |_layout, _language, _transition| Ok(()),
    );

    assert_eq!(launches.get(), 1);
    assert!(matches!(
        result,
        Err(ParentApplyError::WorkerRolledBack { .. })
    ));
}

#[test]
fn missing_root_qwindows_rejects_vendor_preserved_noop_without_uac() {
    let fixture = Fixture::new();
    for pair in &fixture.pairs {
        fs::copy(&pair.src, &pair.dst).unwrap();
    }
    fs::write(&fixture.layout.language_marker, b"en\n").unwrap();
    fs::remove_file(fixture.layout.root.join("qwindows.dll")).unwrap();
    let launches = Cell::new(0);
    let result = apply_with_dependencies(
        fixture.request("en"),
        Language::English,
        std::slice::from_ref(&fixture.program_files),
        &fixture.worker_exe,
        fixture.runtime_sources(Language::English),
        vendor_preserved_transition,
        |_exe, _token| {
            launches.set(launches.get() + 1);
            Ok(WORKER_EXIT_COMMITTED_CLEAN)
        },
        verify_qpa_postcondition,
    );

    assert!(matches!(result, Err(ParentApplyError::Rejected(_))));
    assert_eq!(launches.get(), 0);
    assert!(prepared_plan_directories(&fixture.staging).is_empty());
}

#[test]
fn retryable_rolled_back_uncertain_and_unknown_exit_codes_never_report_success() {
    for (exit, expected) in [
        (
            WORKER_EXIT_ROLLED_BACK_OR_ZERO_MUTATION_CLEAN,
            ParentApplyError::WorkerRolledBack {
                staging_cleanup_warning: None,
            },
        ),
        (
            WORKER_EXIT_CAVALRY_STILL_RUNNING,
            ParentApplyError::CavalryStillRunning {
                staging_cleanup_warning: None,
            },
        ),
        (
            WORKER_EXIT_STATE_OR_CLEANUP_UNCERTAIN,
            ParentApplyError::WorkerStateUncertain {
                staging_cleanup_warning: None,
            },
        ),
        (
            77,
            ParentApplyError::UnexpectedWorkerExit {
                code: 77,
                staging_cleanup_warning: None,
            },
        ),
    ] {
        let fixture = Fixture::new();
        let launches = Cell::new(0);
        assert_eq!(
            apply_fixture(&fixture, Language::English, exit, &launches),
            Err(expected)
        );
        assert_eq!(launches.get(), 1);
        assert!(!fixture.layout.language_marker.exists());
    }
}

#[test]
fn unrecognized_destination_is_rejected_before_launcher_or_target_write() {
    let mut fixture = Fixture::new();
    let outside = fixture.layout.root.join("evil.json");
    fixture.pairs[0].dst = outside.clone();
    let launches = Cell::new(0);
    let result = apply_fixture(
        &fixture,
        Language::English,
        WORKER_EXIT_COMMITTED_CLEAN,
        &launches,
    );

    assert!(matches!(result, Err(ParentApplyError::Rejected(_))));
    assert_eq!(launches.get(), 0);
    assert!(!outside.exists());
}

#[test]
fn custom_install_is_not_applicable_and_does_not_prepare_or_launch() {
    let fixture = Fixture::new();
    let custom_root = fixture._temp.path().join("CustomRoot");
    let custom_layout = InstallLayout::from_root(&custom_root);
    let request = ParentApplyRequest {
        layout: &custom_layout,
        ..fixture.request("en")
    };
    let launches = Cell::new(0);
    let outcome = apply_with_dependencies(
        request,
        Language::English,
        std::slice::from_ref(&fixture.program_files),
        &fixture.worker_exe,
        fixture.runtime_sources(Language::English),
        |_language, _layout, _version, _proxy, _generic| {
            panic!("custom install must not build a QPA plan")
        },
        |_exe, _token| {
            launches.set(launches.get() + 1);
            Ok(0)
        },
        |_layout, _language, _transition| Ok(()),
    )
    .unwrap();

    assert_eq!(outcome, ParentApplyOutcome::NotApplicable);
    assert_eq!(launches.get(), 0);
}

#[test]
fn translated_plan_binds_generic_and_qpa_payload_sources() {
    let fixture = Fixture::new();
    let launches = Cell::new(0);
    let outcome = apply_fixture(
        &fixture,
        Language::SimplifiedChinese,
        WORKER_EXIT_COMMITTED_CLEAN,
        &launches,
    )
    .unwrap();

    assert!(matches!(outcome, ParentApplyOutcome::Applied { .. }));
    assert_eq!(launches.get(), 1);
    assert_eq!(
        fs::read(fixture.layout.root.join(GENERIC_PLUGIN_RELATIVE_PATH)).unwrap(),
        b"generic"
    );
}

#[test]
fn pending_and_final_marker_bind_the_two_consecutive_preimages() {
    let fixture = Fixture::new();
    fs::write(&fixture.layout.language_marker, b"en\n").unwrap();
    let result = apply_with_dependencies(
        fixture.request("zh-Hans"),
        Language::SimplifiedChinese,
        std::slice::from_ref(&fixture.program_files),
        &fixture.worker_exe,
        fixture.runtime_sources(Language::SimplifiedChinese),
        synthetic_transition,
        |_exe, token| {
            let transport = WorkerTransport::decode(token).unwrap();
            let bytes = fs::read(&transport.plan_path).unwrap();
            let plan = super::super::contract::deserialize_bound_plan(&bytes, &transport).unwrap();
            let pending = plan
                .payloads
                .iter()
                .find(|record| record.kind == PayloadKind::PendingMarker)
                .unwrap();
            let final_marker = plan
                .payloads
                .iter()
                .find(|record| record.kind == PayloadKind::FinalMarker)
                .unwrap();
            assert_eq!(
                pending.expected_destination_sha256.as_deref(),
                Some(hex_digest(b"en\n").as_str())
            );
            assert_eq!(
                final_marker.expected_destination_sha256.as_deref(),
                Some(hex_digest(PENDING_MARKER_BYTES).as_str())
            );
            Err(LaunchError::Cancelled(1223))
        },
        |_layout, _language, _transition| Ok(()),
    );

    assert!(matches!(
        result,
        Err(ParentApplyError::PermissionRequired {
            code: 1223,
            staging_cleanup_warning: None
        })
    ));
    assert_eq!(fs::read(&fixture.layout.language_marker).unwrap(), b"en\n");
}

#[test]
fn conservative_cleanup_preserves_a_directory_with_unknown_members() {
    let temp = tempfile::tempdir().unwrap();
    let staging = temp.path().join("staging");
    let plan = staging.join(format!("elevated-language-{}", "a".repeat(64)));
    fs::create_dir_all(plan.join("payloads")).unwrap();
    let unknown = plan.join("unexpected.txt");
    fs::write(&unknown, b"do-not-delete").unwrap();

    let error = cleanup_directory(&staging, &plan).unwrap_err();
    assert!(error.contains("unknown member"));
    assert_eq!(fs::read(&unknown).unwrap(), b"do-not-delete");
}

#[test]
fn parent_finalizer_deletes_only_bound_overlay_sources_and_known_empty_directories() {
    let fixture = Fixture::new();
    let launches = Cell::new(0);
    let result = apply_fixture(
        &fixture,
        Language::English,
        WORKER_EXIT_COMMITTED_CLEAN,
        &launches,
    );
    let request = fixture.request("en");
    let outcome = finalize_outer_cleanup(result, &request).unwrap();

    assert_eq!(
        outcome,
        ParentApplyOutcome::Applied {
            worker_cleanup_residual: false,
            staging_cleanup_warning: None
        }
    );
    assert!(!fixture.staging.exists());
}

#[test]
fn parent_finalizer_preserves_unknown_outer_staging_members_as_a_warning() {
    let fixture = Fixture::new();
    let unknown = fixture.staging.join("unknown.bin");
    fs::write(&unknown, b"preserve").unwrap();
    let launches = Cell::new(0);
    let result = apply_fixture(
        &fixture,
        Language::English,
        WORKER_EXIT_COMMITTED_CLEAN,
        &launches,
    );
    let request = fixture.request("en");
    let outcome = finalize_outer_cleanup(result, &request).unwrap();

    assert!(matches!(
        outcome,
        ParentApplyOutcome::Applied {
            staging_cleanup_warning: Some(_),
            ..
        }
    ));
    assert_eq!(fs::read(&unknown).unwrap(), b"preserve");
}

#[path = "source_provenance_parent_tests.rs"]
mod source_provenance_contract;
