/**
 * [INPUT]: 依赖 windows_qpa 内部 policy seam、临时 x64 PE fixture 与真实 ReplaceFileW 文件语义。
 * [OUTPUT]: 证明激活持久化、显式 English 恢复、普通关闭不恢复、未知厂商漂移保留后 fail-closed、纯文件 rollback 表面、直接写 preflight、崩溃阶段识别及计划 CAS/hash 锁。
 * [POS]: windows_qpa 的 Windows 单元合同；只写 tempfile 安装根，不读取或修改真实 Cavalry。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
use std::{fs, path::Path};

use super::storage::{
    MANIFEST_REPLACE_BACKUP_FILE, MANIFEST_TEMP_FILE, REPLACE_BACKUP_FILE, ROOT_REPLACEMENT_TEMP,
    VENDOR_TEMP_FILE,
};
use super::transition::{build_english_transition_with_policy, execute_writable_noop_with_policy};
use super::{
    build_activation_plan_with_policy, build_restore_plan_with_policy,
    execute_writable_activation_with_policy, execute_writable_restore_with_policy,
    inspect_with_policy, manifest_path, preflight_direct_writable, read_manifest,
    recovery_directory, rollback_file_surface, sha256_file, write_manifest, ActivationOutcome,
    ActivationRequest, Policy, PreparedRestore, QpaDeploymentState, QpaManifestPhase, QpaNoopPlan,
    QpaNoopReason, QpaTransitionPlan, RestoreOutcome, RestoreReason, RestoreRequest,
    MANIFEST_FILE_NAME, PLAN_SCHEMA_VERSION, QWINDOWS_FILE_NAME, VENDOR_QWINDOWS_FILE_NAME,
};
use crate::install::InstallLayout;

struct Fixture {
    _temp: tempfile::TempDir,
    layout: InstallLayout,
    proxy: std::path::PathBuf,
    policy: Policy,
    vendor_bytes: Vec<u8>,
    proxy_bytes: Vec<u8>,
}

impl Fixture {
    fn new() -> Self {
        let temp = tempfile::tempdir().unwrap();
        let root = temp.path().join("Cavalry 2.7.2");
        fs::create_dir_all(root.join("assets/Definitions")).unwrap();
        fs::create_dir_all(root.join("generic")).unwrap();
        fs::write(root.join("assets/Definitions/appStrings.json"), b"{}").unwrap();
        fs::write(root.join("assets/Definitions/nodeStrings.json"), b"{}").unwrap();

        let vendor_bytes = fake_x64_pe(b"vendor-qwindows");
        let proxy_bytes = fake_x64_pe(b"owned-qpa-proxy");
        fs::write(root.join("Cavalry.exe"), fake_x64_pe(b"cavalry")).unwrap();
        fs::write(root.join("Qt6Core.dll"), fake_x64_pe(b"qt-core")).unwrap();
        fs::write(root.join("qwindows.dll"), &vendor_bytes).unwrap();
        fs::write(
            root.join("generic/cavalryi18n.dll"),
            fake_x64_pe(b"generic-plugin"),
        )
        .unwrap();
        let proxy = temp.path().join("packaged-qwindows.dll");
        fs::write(&proxy, &proxy_bytes).unwrap();
        let vendor_hash = sha256_file(&root.join("qwindows.dll")).unwrap();
        Self {
            layout: InstallLayout::from_root(&root),
            proxy,
            policy: Policy {
                cavalry_version: "2.7.2".to_string(),
                qt_version: "6.6.3".to_string(),
                architecture: "x86_64".to_string(),
                vendor_hash,
            },
            _temp: temp,
            vendor_bytes,
            proxy_bytes,
        }
    }

    fn activation_request(&self) -> ActivationRequest<'_> {
        ActivationRequest {
            layout: &self.layout,
            cavalry_version: "2.7.2",
            proxy_source: &self.proxy,
        }
    }

    fn restore_request(&self, reason: RestoreReason) -> RestoreRequest<'_> {
        RestoreRequest {
            layout: &self.layout,
            proxy_source: &self.proxy,
            reason,
        }
    }

    fn activate(&self) -> ActivationOutcome {
        let plan =
            build_activation_plan_with_policy(self.activation_request(), &self.policy, false)
                .unwrap();
        execute_writable_activation_with_policy(&plan, &self.policy, false).unwrap()
    }
}

#[test]
fn stock_english_transition_is_a_verified_noop_without_file_mutation() {
    let fixture = Fixture::new();
    let before_qwindows = fs::read(fixture.layout.root.join("qwindows.dll")).unwrap();
    let transition = build_english_transition_with_policy(
        fixture.restore_request(RestoreReason::EnglishSelection),
        &fixture.policy,
    )
    .unwrap();
    let QpaTransitionPlan::Noop(plan) = transition else {
        panic!("stock English selection must produce a hash-locked no-op");
    };

    assert_eq!(plan.reason, QpaNoopReason::AlreadyStock);
    execute_writable_noop_with_policy(&plan, &fixture.policy, false).unwrap();
    assert_eq!(
        fs::read(fixture.layout.root.join("qwindows.dll")).unwrap(),
        before_qwindows
    );
    assert!(!recovery_directory(&fixture.layout).exists());
}

#[test]
fn activation_persists_until_explicit_english_restore() {
    let fixture = Fixture::new();
    assert_eq!(fixture.activate(), ActivationOutcome::Activated);
    assert_eq!(
        fs::read(fixture.layout.root.join("qwindows.dll")).unwrap(),
        fixture.proxy_bytes
    );
    assert_eq!(
        fs::read(recovery_directory(&fixture.layout).join(VENDOR_QWINDOWS_FILE_NAME)).unwrap(),
        fixture.vendor_bytes
    );
    assert_eq!(
        inspect_with_policy(&fixture.layout, &fixture.policy)
            .unwrap()
            .state,
        QpaDeploymentState::Active
    );

    // 关闭/重新检查没有任何恢复入口；代理仍持久存在。
    assert_eq!(
        inspect_with_policy(&fixture.layout, &fixture.policy)
            .unwrap()
            .state,
        QpaDeploymentState::Active
    );
    assert_eq!(
        fs::read(fixture.layout.root.join("qwindows.dll")).unwrap(),
        fixture.proxy_bytes
    );

    let prepared = build_restore_plan_with_policy(
        fixture.restore_request(RestoreReason::EnglishSelection),
        &fixture.policy,
    )
    .unwrap();
    let PreparedRestore::Execute(plan) = prepared else {
        panic!("English selection must produce an explicit restore plan");
    };
    assert_eq!(
        execute_writable_restore_with_policy(&plan, &fixture.policy, false).unwrap(),
        RestoreOutcome::Restored
    );
    assert_eq!(
        fs::read(fixture.layout.root.join("qwindows.dll")).unwrap(),
        fixture.vendor_bytes
    );
    assert!(!recovery_directory(&fixture.layout).exists());
}

#[test]
fn vendor_update_drift_is_never_overwritten_by_the_old_backup() {
    let fixture = Fixture::new();
    fixture.activate();
    let vendor_update = fake_x64_pe(b"future-vendor-qwindows");
    fs::write(fixture.layout.root.join("qwindows.dll"), &vendor_update).unwrap();

    let inspection = inspect_with_policy(&fixture.layout, &fixture.policy).unwrap();
    assert_eq!(inspection.state, QpaDeploymentState::Drifted);
    assert!(inspection.detail.contains("will not overwrite"));
    assert_eq!(
        build_restore_plan_with_policy(
            fixture.restore_request(RestoreReason::EnglishSelection),
            &fixture.policy
        )
        .unwrap(),
        PreparedRestore::Complete(RestoreOutcome::VendorUpdatePreserved)
    );
    assert_eq!(
        fs::read(fixture.layout.root.join("qwindows.dll")).unwrap(),
        vendor_update
    );
    assert!(recovery_directory(&fixture.layout).exists());
    let error = build_english_transition_with_policy(
        fixture.restore_request(RestoreReason::EnglishSelection),
        &fixture.policy,
    )
    .unwrap_err();
    assert!(error.contains("unrecognized vendor file"));
}

#[test]
fn prepared_manifest_is_recover_not_active() {
    let fixture = Fixture::new();
    fixture.activate();
    let mut manifest = read_manifest(&fixture.layout, &fixture.policy)
        .unwrap()
        .unwrap();
    manifest.phase = QpaManifestPhase::Prepared;
    write_manifest(&fixture.layout, &manifest, &fixture.policy).unwrap();

    let inspection = inspect_with_policy(&fixture.layout, &fixture.policy).unwrap();
    assert_eq!(inspection.state, QpaDeploymentState::Recover);
    assert_eq!(inspection.phase, Some(QpaManifestPhase::Prepared));
}

#[test]
fn vendor_update_preserved_noop_always_fails_closed() {
    let fixture = Fixture::new();
    fixture.activate();
    let mut manifest = read_manifest(&fixture.layout, &fixture.policy)
        .unwrap()
        .unwrap();
    manifest.phase = QpaManifestPhase::Prepared;
    write_manifest(&fixture.layout, &manifest, &fixture.policy).unwrap();
    let vendor_update = fake_x64_pe(b"future-vendor-qwindows");
    fs::write(fixture.layout.root.join(QWINDOWS_FILE_NAME), &vendor_update).unwrap();

    let inspection = inspect_with_policy(&fixture.layout, &fixture.policy).unwrap();
    assert!(matches!(
        inspection.state,
        QpaDeploymentState::Drifted | QpaDeploymentState::Recover
    ));
    assert!(inspection.current_qwindows_sha256.is_some());

    let plan = QpaNoopPlan {
        schema_version: PLAN_SCHEMA_VERSION,
        install_root: fixture.layout.root.to_string_lossy().to_string(),
        reason: QpaNoopReason::VendorUpdatePreserved,
        cavalry_version: fixture.policy.cavalry_version.clone(),
        cavalry_executable_sha256: sha256_file(&fixture.layout.executable).unwrap(),
        qt_version: fixture.policy.qt_version.clone(),
        architecture: fixture.policy.architecture.clone(),
        expected_current_qwindows_sha256: inspection.current_qwindows_sha256,
    };
    let error = execute_writable_noop_with_policy(&plan, &fixture.policy, false).unwrap_err();
    assert!(error.contains("unrecognized vendor file"));
    assert_eq!(
        fs::read(fixture.layout.root.join(QWINDOWS_FILE_NAME)).unwrap(),
        vendor_update
    );
}

#[test]
fn stale_hash_locked_plan_cannot_replace_a_changed_target() {
    let fixture = Fixture::new();
    let plan =
        build_activation_plan_with_policy(fixture.activation_request(), &fixture.policy, false)
            .unwrap();
    let drift = fake_x64_pe(b"changed-after-plan");
    fs::write(fixture.layout.root.join("qwindows.dll"), &drift).unwrap();

    let error = execute_writable_activation_with_policy(&plan, &fixture.policy, false).unwrap_err();
    assert!(error.contains("changed after the activation plan"));
    assert_eq!(
        fs::read(fixture.layout.root.join("qwindows.dll")).unwrap(),
        drift
    );
    assert!(!recovery_directory(&fixture.layout).exists());
}

#[test]
fn activation_plan_rejects_a_changed_cavalry_executable_before_qpa_writes() {
    let fixture = Fixture::new();
    let plan =
        build_activation_plan_with_policy(fixture.activation_request(), &fixture.policy, false)
            .unwrap();
    fs::write(
        &fixture.layout.executable,
        fake_x64_pe(b"changed-cavalry-after-plan"),
    )
    .unwrap();

    let error = execute_writable_activation_with_policy(&plan, &fixture.policy, false).unwrap_err();

    assert!(error.contains("hash-locked Cavalry executable"), "{error}");
    assert!(!recovery_directory(&fixture.layout).exists());
    assert_eq!(
        fs::read(fixture.layout.root.join("qwindows.dll")).unwrap(),
        fixture.vendor_bytes
    );
}

#[test]
fn active_qpa_becomes_drifted_when_cavalry_executable_changes() {
    let fixture = Fixture::new();
    fixture.activate();
    fs::write(
        &fixture.layout.executable,
        fake_x64_pe(b"future-cavalry-executable"),
    )
    .unwrap();

    let inspection = inspect_with_policy(&fixture.layout, &fixture.policy).unwrap();

    assert_eq!(inspection.state, QpaDeploymentState::Drifted);
    assert!(inspection.detail.contains("Cavalry.exe changed"));
    assert_eq!(
        fs::read(fixture.layout.root.join("qwindows.dll")).unwrap(),
        fixture.proxy_bytes
    );
}

#[test]
fn english_restore_never_writes_an_old_vendor_backup_over_a_new_executable() {
    let fixture = Fixture::new();
    fixture.activate();
    fs::write(
        &fixture.layout.executable,
        fake_x64_pe(b"future-cavalry-executable"),
    )
    .unwrap();

    let prepared = build_restore_plan_with_policy(
        fixture.restore_request(RestoreReason::EnglishSelection),
        &fixture.policy,
    )
    .unwrap();

    assert_eq!(
        prepared,
        PreparedRestore::Complete(RestoreOutcome::VendorUpdatePreserved)
    );
    assert_eq!(
        fs::read(fixture.layout.root.join("qwindows.dll")).unwrap(),
        fixture.proxy_bytes
    );
    assert!(recovery_directory(&fixture.layout).exists());
}

#[test]
fn cavalry_version_gate_rejects_every_other_release() {
    let fixture = Fixture::new();
    let request = ActivationRequest {
        layout: &fixture.layout,
        cavalry_version: "2.8.0",
        proxy_source: &fixture.proxy,
    };
    let error = build_activation_plan_with_policy(request, &fixture.policy, false).unwrap_err();
    assert!(error.contains("supports Cavalry 2.7.2 only"));
}

#[test]
fn manifest_denies_unknown_fields() {
    let fixture = Fixture::new();
    fixture.activate();
    let mut value: serde_json::Value =
        serde_json::from_slice(&fs::read(manifest_path(&fixture.layout)).unwrap()).unwrap();
    value["surprise"] = serde_json::Value::Bool(true);
    fs::write(
        manifest_path(&fixture.layout),
        serde_json::to_vec(&value).unwrap(),
    )
    .unwrap();

    assert_eq!(
        inspect_with_policy(&fixture.layout, &fixture.policy)
            .unwrap()
            .state,
        QpaDeploymentState::Recover
    );
}

#[test]
fn missing_root_dll_can_be_restored_from_the_durable_backup() {
    let fixture = Fixture::new();
    fixture.activate();
    fs::remove_file(fixture.layout.root.join("qwindows.dll")).unwrap();
    let PreparedRestore::Execute(plan) = build_restore_plan_with_policy(
        fixture.restore_request(RestoreReason::EnglishSelection),
        &fixture.policy,
    )
    .unwrap() else {
        panic!("missing owned root DLL must produce a recovery plan");
    };
    assert_eq!(
        execute_writable_restore_with_policy(&plan, &fixture.policy, false).unwrap(),
        RestoreOutcome::Restored
    );
    assert_eq!(
        fs::read(fixture.layout.root.join("qwindows.dll")).unwrap(),
        fixture.vendor_bytes
    );
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

#[test]
fn fixture_paths_are_confined_to_temp() {
    let fixture = Fixture::new();
    let expected_root = fs::canonicalize(fixture._temp.path().join("Cavalry 2.7.2")).unwrap();
    let actual_root = fs::canonicalize(&fixture.layout.root).unwrap();
    assert_eq!(
        actual_root.to_string_lossy().to_ascii_lowercase(),
        expected_root.to_string_lossy().to_ascii_lowercase()
    );
    assert!(Path::new(&fixture.proxy).is_file());
}

#[test]
fn rollback_file_surface_contains_only_the_fixed_qpa_files() {
    let fixture = Fixture::new();
    let recovery = recovery_directory(&fixture.layout);

    let surface = rollback_file_surface(&fixture.layout);

    assert_eq!(
        surface,
        vec![
            fixture.layout.root.join(QWINDOWS_FILE_NAME),
            fixture.layout.root.join(ROOT_REPLACEMENT_TEMP),
            recovery.join(VENDOR_QWINDOWS_FILE_NAME),
            recovery.join(MANIFEST_FILE_NAME),
            recovery.join(VENDOR_TEMP_FILE),
            recovery.join(REPLACE_BACKUP_FILE),
            recovery.join(MANIFEST_TEMP_FILE),
            recovery.join(MANIFEST_REPLACE_BACKUP_FILE),
        ]
    );
    assert!(!surface.contains(&fixture.layout.root));
    assert!(!surface.contains(&recovery));
    assert!(!surface
        .iter()
        .any(|path| path.to_string_lossy().contains("write-probe")));
}

#[test]
fn direct_write_preflight_is_non_destructive_for_active_qpa_state() {
    let fixture = Fixture::new();
    fixture.activate();
    let root_qwindows = fs::read(fixture.layout.root.join("qwindows.dll")).unwrap();
    let manifest = fs::read(manifest_path(&fixture.layout)).unwrap();
    let backup =
        fs::read(recovery_directory(&fixture.layout).join(VENDOR_QWINDOWS_FILE_NAME)).unwrap();

    preflight_direct_writable(&fixture.layout).unwrap();

    assert_eq!(
        fs::read(fixture.layout.root.join("qwindows.dll")).unwrap(),
        root_qwindows
    );
    assert_eq!(fs::read(manifest_path(&fixture.layout)).unwrap(), manifest);
    assert_eq!(
        fs::read(recovery_directory(&fixture.layout).join(VENDOR_QWINDOWS_FILE_NAME)).unwrap(),
        backup
    );
    assert!(!fixture
        .layout
        .root
        .join(".cavalry-i18n-qpa-write-probe")
        .exists());
    assert!(!recovery_directory(&fixture.layout)
        .join(".cavalry-i18n-qpa-write-probe")
        .exists());
}

#[test]
fn direct_write_preflight_rejects_program_files_before_creating_a_probe() {
    let program_files =
        std::env::var_os("ProgramFiles").expect("Windows tests require ProgramFiles");
    let layout = InstallLayout::from_root(
        &std::path::PathBuf::from(program_files).join("Cavalry QPA Contract Fixture"),
    );

    let error = preflight_direct_writable(&layout).unwrap_err();

    assert!(error.contains("elevated QPA worker"), "{error}");
    assert!(!layout.root.join(".cavalry-i18n-qpa-write-probe").exists());
}
