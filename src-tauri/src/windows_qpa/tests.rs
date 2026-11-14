/**
 * [INPUT]: 依赖 windows_qpa 内部 policy seam、临时 x64 PE fixture 与真实 ReplaceFileW 文件语义。
 * [OUTPUT]: 证明激活持久化、English清理自有generic/recovery、只读观察句柄阻断qwindows替换并在释放后安全重试、编译profile身份正反例、native 2.8.1 EXE SHA回退/漂移拒绝及manifest/rollback边界。
 * [POS]: windows_qpa 的 Windows 单元合同；只写 tempfile 安装根，不读取或修改真实 Cavalry。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
use std::{
    cell::Cell,
    fs, io,
    os::windows::fs::OpenOptionsExt,
    path::Path,
    time::{Duration, Instant},
};

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
use windows::Win32::Storage::FileSystem::FILE_SHARE_READ;

struct Fixture {
    _temp: tempfile::TempDir,
    layout: InstallLayout,
    proxy: std::path::PathBuf,
    generic: std::path::PathBuf,
    policy: Policy,
    vendor_bytes: Vec<u8>,
    proxy_bytes: Vec<u8>,
}

impl Fixture {
    fn new() -> Self {
        let temp = tempfile::tempdir().unwrap();
        let root = temp
            .path()
            .join(format!("Cavalry {}", super::SUPPORTED_CAVALRY_VERSION));
        fs::create_dir_all(root.join("assets/Definitions")).unwrap();
        fs::create_dir_all(root.join("generic")).unwrap();
        fs::write(root.join("assets/Definitions/appStrings.json"), b"{}").unwrap();
        fs::write(root.join("assets/Definitions/nodeStrings.json"), b"{}").unwrap();

        let vendor_bytes = fake_x64_pe(b"vendor-qwindows");
        let proxy_bytes = fake_x64_pe(b"owned-qpa-proxy");
        fs::write(root.join("Cavalry.exe"), fake_x64_pe(b"cavalry")).unwrap();
        fs::write(root.join("Qt6Core.dll"), fake_x64_pe(b"qt-core")).unwrap();
        fs::write(root.join("qwindows.dll"), &vendor_bytes).unwrap();
        let generic_bytes = fake_x64_pe(b"generic-plugin");
        fs::write(root.join("generic/cavalryi18n.dll"), &generic_bytes).unwrap();
        let proxy = temp.path().join("packaged-qwindows.dll");
        fs::write(&proxy, &proxy_bytes).unwrap();
        let generic = temp.path().join("packaged-cavalryi18n.dll");
        fs::write(&generic, &generic_bytes).unwrap();
        let vendor_hash = sha256_file(&root.join("qwindows.dll")).unwrap();
        Self {
            layout: InstallLayout::from_root(&root),
            proxy,
            generic,
            policy: Policy {
                cavalry_version: super::SUPPORTED_CAVALRY_VERSION.to_string(),
                qt_version: super::SUPPORTED_QT_VERSION.to_string(),
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
            cavalry_version: super::SUPPORTED_CAVALRY_VERSION,
            proxy_source: &self.proxy,
        }
    }

    fn restore_request(&self, reason: RestoreReason) -> RestoreRequest<'_> {
        RestoreRequest {
            layout: &self.layout,
            proxy_source: &self.proxy,
            generic_source: &self.generic,
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
    fs::remove_file(
        fixture
            .layout
            .root
            .join(super::GENERIC_PLUGIN_RELATIVE_PATH),
    )
    .unwrap();
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
fn stock_qpa_with_hash_owned_generic_builds_cleanup_transition() {
    let fixture = Fixture::new();
    let qwindows_before = fs::read(fixture.layout.root.join(QWINDOWS_FILE_NAME)).unwrap();

    let transition = build_english_transition_with_policy(
        fixture.restore_request(RestoreReason::EnglishSelection),
        &fixture.policy,
    )
    .unwrap();
    let QpaTransitionPlan::EnglishRestore(plan) = transition else {
        panic!("a hash-owned generic residual must not be classified as a clean no-op");
    };
    assert_eq!(plan.action, super::RestoreAction::CleanupOnly);
    assert_eq!(
        execute_writable_restore_with_policy(&plan, &fixture.policy, false).unwrap(),
        RestoreOutcome::AlreadyStock
    );

    assert_eq!(
        fs::read(fixture.layout.root.join(QWINDOWS_FILE_NAME)).unwrap(),
        qwindows_before
    );
    assert!(!fixture
        .layout
        .root
        .join(super::GENERIC_PLUGIN_RELATIVE_PATH)
        .exists());
    assert!(!recovery_directory(&fixture.layout).exists());
}

#[test]
fn read_only_qwindows_observer_blocks_english_restore_until_released() {
    let fixture = Fixture::new();
    fixture.activate();

    let transition = build_english_transition_with_policy(
        fixture.restore_request(RestoreReason::EnglishSelection),
        &fixture.policy,
    )
    .unwrap();
    let QpaTransitionPlan::EnglishRestore(plan) = transition else {
        panic!("an active owned QPA must produce an English restore plan");
    };
    assert_eq!(plan.action, super::RestoreAction::ReplaceProxy);

    let qwindows = fixture.layout.root.join(QWINDOWS_FILE_NAME);
    let generic = fixture
        .layout
        .root
        .join(super::GENERIC_PLUGIN_RELATIVE_PATH);
    let foreign = generic.parent().unwrap().join("foreign.keep");
    let vendor = recovery_directory(&fixture.layout).join(VENDOR_QWINDOWS_FILE_NAME);
    let generic_before = fs::read(&generic).unwrap();
    let vendor_before = fs::read(&vendor).unwrap();
    fs::write(&foreign, b"test-only unknown sibling").unwrap();

    // 仿照 PowerShell/.NET 的 FileShare.Read：允许读取，但不允许 ReplaceFileW 删除或替换。
    let observer = fs::OpenOptions::new()
        .read(true)
        .share_mode(FILE_SHARE_READ.0)
        .open(&qwindows)
        .unwrap();
    let error = execute_writable_restore_with_policy(&plan, &fixture.policy, false).unwrap_err();
    println!("ReplaceFileW read-share rejection: {error}");
    assert!(
        error.contains("0x80070020")
            || error.to_ascii_lowercase().contains("sharing violation")
            || error
                .to_ascii_lowercase()
                .contains("used by another process"),
        "expected a Windows sharing violation from ReplaceFileW, got: {error}"
    );
    assert_eq!(fs::read(&qwindows).unwrap(), fixture.proxy_bytes);
    assert_eq!(fs::read(&generic).unwrap(), generic_before);
    assert_eq!(fs::read(&vendor).unwrap(), vendor_before);
    assert_eq!(
        read_manifest(&fixture.layout, &fixture.policy)
            .unwrap()
            .unwrap()
            .phase,
        QpaManifestPhase::Restoring,
        "the retryable restore state must remain recognizable"
    );
    assert_eq!(fs::read(&foreign).unwrap(), b"test-only unknown sibling");

    drop(observer);
    assert_eq!(
        execute_writable_restore_with_policy(&plan, &fixture.policy, false).unwrap(),
        RestoreOutcome::Restored
    );
    assert_eq!(fs::read(&qwindows).unwrap(), fixture.vendor_bytes);
    assert!(!generic.exists());
    assert_eq!(fs::read(&foreign).unwrap(), b"test-only unknown sibling");
    assert!(!recovery_directory(&fixture.layout).exists());
}

#[test]
fn corrupt_manifest_with_stock_qpa_fails_closed_without_cleanup() {
    let fixture = Fixture::new();
    fixture.activate();

    let qwindows = fixture.layout.root.join(QWINDOWS_FILE_NAME);
    let generic = fixture
        .layout
        .root
        .join(super::GENERIC_PLUGIN_RELATIVE_PATH);
    let recovery = recovery_directory(&fixture.layout);
    let manifest = manifest_path(&fixture.layout);
    let vendor_backup = recovery.join(VENDOR_QWINDOWS_FILE_NAME);
    let corrupt_manifest = b"{ definitely not valid JSON";

    fs::write(&qwindows, &fixture.vendor_bytes).unwrap();
    fs::write(&manifest, corrupt_manifest).unwrap();
    let generic_before = fs::read(&generic).unwrap();
    let vendor_backup_before = fs::read(&vendor_backup).unwrap();

    let error = build_restore_plan_with_policy(
        fixture.restore_request(RestoreReason::EnglishSelection),
        &fixture.policy,
    )
    .unwrap_err();
    assert!(error.contains("QPA manifest JSON is invalid"), "{error}");

    assert_eq!(fs::read(&qwindows).unwrap(), fixture.vendor_bytes);
    assert_eq!(fs::read(&generic).unwrap(), generic_before);
    assert_eq!(fs::read(&manifest).unwrap(), corrupt_manifest);
    assert_eq!(fs::read(&vendor_backup).unwrap(), vendor_backup_before);
    assert!(recovery.exists());
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
    assert!(
        !fixture
            .layout
            .root
            .join(super::GENERIC_PLUGIN_RELATIVE_PATH)
            .exists(),
        "explicit English restore must remove the hash-owned generic translator"
    );
    assert!(!recovery_directory(&fixture.layout).exists());
}

#[test]
fn english_restore_refuses_and_preserves_an_unknown_generic_plugin() {
    let fixture = Fixture::new();
    fixture.activate();
    let unknown_generic = fake_x64_pe(b"unknown-third-party-generic-plugin");
    let generic_path = fixture
        .layout
        .root
        .join(super::GENERIC_PLUGIN_RELATIVE_PATH);
    fs::write(&generic_path, &unknown_generic).unwrap();
    let proxy_before = fs::read(fixture.layout.root.join(QWINDOWS_FILE_NAME)).unwrap();

    let error = build_restore_plan_with_policy(
        fixture.restore_request(RestoreReason::EnglishSelection),
        &fixture.policy,
    )
    .unwrap_err();

    assert!(error.contains("generic"), "{error}");
    assert_eq!(fs::read(&generic_path).unwrap(), unknown_generic);
    assert_eq!(
        fs::read(fixture.layout.root.join(QWINDOWS_FILE_NAME)).unwrap(),
        proxy_before,
        "unknown generic ownership must fail while the restore plan is still read-only"
    );
    assert!(recovery_directory(&fixture.layout).exists());
}

#[test]
fn durable_manifest_allows_a_new_switcher_to_remove_an_older_owned_generic() {
    let fixture = Fixture::new();
    fixture.activate();
    let installed_generic = fixture
        .layout
        .root
        .join(super::GENERIC_PLUGIN_RELATIVE_PATH);
    let old_hash = sha256_file(&installed_generic).unwrap();
    fs::write(&fixture.generic, fake_x64_pe(b"new-switcher-generic-build")).unwrap();
    assert_ne!(sha256_file(&fixture.generic).unwrap(), old_hash);

    let prepared = build_restore_plan_with_policy(
        fixture.restore_request(RestoreReason::EnglishSelection),
        &fixture.policy,
    )
    .unwrap();
    let PreparedRestore::Execute(plan) = prepared else {
        panic!("manifest-owned older runtime must remain explicitly restorable");
    };
    assert_eq!(plan.generic_plugin_sha256, old_hash);
    execute_writable_restore_with_policy(&plan, &fixture.policy, false).unwrap();

    assert!(!installed_generic.exists());
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
fn activation_plan_accepts_the_compiled_cavalry_and_qt_identity() {
    let fixture = Fixture::new();
    let mut policy = fixture.policy.clone();
    policy.cavalry_version = super::SUPPORTED_CAVALRY_VERSION.to_string();
    policy.qt_version = super::SUPPORTED_QT_VERSION.to_string();
    let request = ActivationRequest {
        layout: &fixture.layout,
        cavalry_version: super::SUPPORTED_CAVALRY_VERSION,
        proxy_source: &fixture.proxy,
    };

    let plan = build_activation_plan_with_policy(request, &policy, false).unwrap();

    assert_eq!(plan.cavalry_version, super::SUPPORTED_CAVALRY_VERSION);
    assert_eq!(plan.qt_version, super::SUPPORTED_QT_VERSION);
}

#[test]
fn production_policy_uses_the_approved_windows_identity_for_its_build_profile() {
    let policy = Policy::production();
    #[cfg(cavalry_native_windows)]
    {
        assert_eq!(policy.cavalry_version, "2.8.1");
        assert_eq!(policy.qt_version, "6.9.2");
        assert_eq!(
            policy.vendor_hash,
            "0673d9050ee2f04c108f7673abdbee57c5bbb5bf84fab39e4a82eb96b1bcc8e8"
        );
    }
    #[cfg(not(cavalry_native_windows))]
    {
        assert_eq!(policy.cavalry_version, "2.7.2");
        assert_eq!(policy.qt_version, "6.6.3");
        assert_eq!(
            policy.vendor_hash,
            "e039d39a6b99a26a358a85660147941112a4c9df3a62b5e19a8ae9ed75be3f01"
        );
    }
}

#[test]
fn cavalry_version_gate_rejects_the_previous_release_for_the_native_profile() {
    let fixture = Fixture::new();
    let mut policy = fixture.policy.clone();
    policy.cavalry_version = super::SUPPORTED_CAVALRY_VERSION.to_string();
    let previous_version = if super::SUPPORTED_CAVALRY_VERSION == "2.8.1" {
        "2.8.0"
    } else {
        "2.8.1"
    };
    let request = ActivationRequest {
        layout: &fixture.layout,
        cavalry_version: previous_version,
        proxy_source: &fixture.proxy,
    };

    let error = build_activation_plan_with_policy(request, &policy, false).unwrap_err();

    assert!(
        error.contains(&format!("supports Cavalry {} only", policy.cavalry_version)),
        "{error}"
    );
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
    let expected_root = fs::canonicalize(
        fixture
            ._temp
            .path()
            .join(format!("Cavalry {}", super::SUPPORTED_CAVALRY_VERSION)),
    )
    .unwrap();
    let actual_root = fs::canonicalize(&fixture.layout.root).unwrap();
    assert_eq!(
        actual_root.to_string_lossy().to_ascii_lowercase(),
        expected_root.to_string_lossy().to_ascii_lowercase()
    );
    assert!(Path::new(&fixture.proxy).is_file());
}

#[test]
fn rollback_file_surface_contains_only_the_owned_qpa_runtime_files() {
    let fixture = Fixture::new();
    let recovery = recovery_directory(&fixture.layout);

    let surface = rollback_file_surface(&fixture.layout);

    assert_eq!(
        surface,
        vec![
            fixture.layout.root.join(QWINDOWS_FILE_NAME),
            fixture.layout.root.join(ROOT_REPLACEMENT_TEMP),
            fixture
                .layout
                .root
                .join(super::GENERIC_PLUGIN_RELATIVE_PATH),
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
fn existing_file_write_preflight_retries_one_sharing_violation_then_succeeds() {
    let start = Instant::now();
    let elapsed = Cell::new(Duration::ZERO);
    let mut attempts = 0;

    let result = super::preflight::verify_existing_file_writable_with(
        Path::new("qwindows.dll"),
        "installed qwindows.dll",
        |_path| {
            attempts += 1;
            if attempts == 1 {
                Err(io::Error::from_raw_os_error(32))
            } else {
                Ok(())
            }
        },
        |duration| elapsed.set(elapsed.get() + duration),
        || start + elapsed.get(),
        Duration::from_millis(250),
    );

    assert!(result.is_ok(), "{result:?}");
    assert_eq!(attempts, 2);
    assert_eq!(elapsed.get(), Duration::from_millis(100));
}

#[test]
fn existing_file_write_preflight_stops_after_a_sharing_violation_deadline() {
    let start = Instant::now();
    let elapsed = Cell::new(Duration::ZERO);
    let mut attempts = 0;

    let result = super::preflight::verify_existing_file_writable_with(
        Path::new("qwindows.dll"),
        "installed qwindows.dll",
        |_path| {
            attempts += 1;
            Err(io::Error::from_raw_os_error(32))
        },
        |duration| elapsed.set(elapsed.get() + duration),
        || start + elapsed.get(),
        Duration::from_millis(250),
    );

    let error = result.unwrap_err();
    assert!(error.contains("installed qwindows.dll"), "{error}");
    assert!(error.contains("os error 32"), "{error}");
    assert_eq!(attempts, 4);
    assert_eq!(elapsed.get(), Duration::from_millis(250));
}

#[test]
fn existing_file_write_preflight_returns_other_errors_without_retrying() {
    let start = Instant::now();
    let elapsed = Cell::new(Duration::ZERO);
    let mut attempts = 0;

    let result = super::preflight::verify_existing_file_writable_with(
        Path::new("qwindows.dll"),
        "installed qwindows.dll",
        |_path| {
            attempts += 1;
            Err(io::Error::from_raw_os_error(5))
        },
        |_duration| panic!("permission errors must not be retried"),
        || start + elapsed.get(),
        Duration::from_millis(250),
    );

    let error = result.unwrap_err();
    assert!(error.contains("installed qwindows.dll"), "{error}");
    assert!(error.contains("os error 5"), "{error}");
    assert_eq!(attempts, 1);
    assert_eq!(elapsed.get(), Duration::ZERO);
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
