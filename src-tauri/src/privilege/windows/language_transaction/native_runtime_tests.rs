/*
 * [INPUT]: 显式只读官方Cavalry 2.8.1根、当前编译锚定的native DLL、隔离temp安装/state及真实Windows journal。
 * [OUTPUT]: 证明native激活/候选源更新状态/未知DLL拒删/English恢复/外来文件保全；不启动宿主，不触碰用户profile。
 * [POS]: Windows2.8.1 runtime-only集成合同；默认ignored，必须显式给官方vendor输入。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
use super::{apply_native_runtime, ParentApplyOutcome, ParentApplyRequest};
use crate::{install::InstallLayout, windows_qpa};
use sha2::{Digest, Sha256};
use std::{fs, path::PathBuf};

#[test]
#[ignore = "Requires explicit official Windows 2.8.1 vendor root and current native DLLs"]
fn native_runtime_transaction_preserves_unknown_and_restores_vendor() {
    let vendor = PathBuf::from(
        std::env::var_os("CAVALRY_I18N_TEST_WINDOWS_VENDOR")
            .expect("Explicit read-only official Windows 2.8.1 root required"),
    );
    let temporary = tempfile::tempdir().unwrap();
    let root = temporary.path().join(format!(
        "Cavalry {} custom root",
        windows_qpa::SUPPORTED_CAVALRY_VERSION
    ));
    let state = temporary.path().join("state");
    fs::create_dir(&root).unwrap();
    fs::create_dir(&state).unwrap();
    for name in ["Cavalry.exe", "Qt6Core.dll", "qwindows.dll"] {
        fs::copy(vendor.join(name), root.join(name)).unwrap();
    }
    let layout = InstallLayout::from_root(&root);
    let repo = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .unwrap()
        .to_path_buf();
    let digest = |p: &std::path::Path| format!("{:x}", Sha256::digest(fs::read(p).unwrap()));
    let vendor_bytes = fs::read(root.join("qwindows.dll")).unwrap();
    assert_eq!(
        format!("{:x}", Sha256::digest(&vendor_bytes)),
        windows_qpa::VENDOR_QWINDOWS_SHA256
    );
    let (candidate_generic, candidate_proxy) =
        crate::privilege::native_runtime_source_hashes().unwrap();
    let runtime_matches = || {
        windows_qpa::native_runtime_source_matches(
            &layout,
            "zh-Hans",
            candidate_generic,
            candidate_proxy,
        )
    };
    assert!(
        !runtime_matches().unwrap(),
        "Stock runtime needs installation"
    );
    let invoke = |language: &str, sequence: u32| {
        let stage = state.join(format!("runtime-stage-{sequence}"));
        apply_native_runtime(ParentApplyRequest {
            repo_root: &repo,
            resource_dir: &repo,
            state_dir: &state,
            layout: &layout,
            language,
            cavalry_version: windows_qpa::SUPPORTED_CAVALRY_VERSION,
            staging_root: &stage,
            overlay_pairs: &[],
            english_snapshot_manifest: None,
        })
    };
    assert!(matches!(
        invoke("zh-Hans", 1).unwrap(),
        ParentApplyOutcome::Applied {
            worker_cleanup_residual: false,
            staging_cleanup_warning: None
        }
    ));
    assert_eq!(
        fs::read(windows_qpa::vendor_qwindows_backup(&layout)).unwrap(),
        vendor_bytes
    );
    assert_eq!(
        windows_qpa::inspect(&layout).unwrap().state,
        windows_qpa::QpaDeploymentState::Active
    );
    assert_eq!(fs::read(&layout.language_marker).unwrap(), b"zh-Hans\n");
    assert!(runtime_matches().unwrap());
    assert!(
        !windows_qpa::native_runtime_source_matches(
            &layout,
            "zh-Hans",
            &"0".repeat(64),
            candidate_proxy,
        )
        .unwrap(),
        "An older owned runtime must offer Update"
    );
    assert!(
        !windows_qpa::native_runtime_source_matches(
            &layout,
            "zh-Hant",
            candidate_generic,
            candidate_proxy,
        )
        .unwrap(),
        "Shared profile language must agree with the selected root marker"
    );
    assert!(
        !layout.assets_root.exists(),
        "Native runtime must not create legacy assets"
    );
    let generic = root.join(windows_qpa::GENERIC_PLUGIN_RELATIVE_PATH);
    let owned = fs::read(&generic).unwrap();
    let foreign = generic.parent().unwrap().join("foreign.keep");
    fs::write(&foreign, b"owned-test-canary: preserve unknown sibling").unwrap();
    let mut drifted = owned.clone();
    drifted.push(b' ');
    fs::write(&generic, &drifted).unwrap();
    assert!(
        runtime_matches().is_err(),
        "Drift cannot be displayed as current"
    );
    let proxy_hash = digest(&root.join("qwindows.dll"));
    assert!(
        invoke("en", 2).is_err(),
        "Unknown generic must not be removed"
    );
    assert_eq!(fs::read(&generic).unwrap(), drifted);
    assert_eq!(digest(&root.join("qwindows.dll")), proxy_hash);
    fs::write(&generic, &owned).unwrap();
    assert!(matches!(
        invoke("en", 3).unwrap(),
        ParentApplyOutcome::Applied {
            worker_cleanup_residual: false,
            staging_cleanup_warning: None
        }
    ));
    assert_eq!(fs::read(root.join("qwindows.dll")).unwrap(), vendor_bytes);
    assert!(!generic.exists());
    assert!(!windows_qpa::manifest_path(&layout).exists());
    assert_eq!(
        fs::read(&foreign).unwrap(),
        b"owned-test-canary: preserve unknown sibling"
    );
    assert_eq!(
        windows_qpa::inspect(&layout).unwrap().state,
        windows_qpa::QpaDeploymentState::Stock
    );
    println!("native runtime-only actual Windows journal: activate, unknown DLL preserve, normal English vendor restore; no user profile or host launch");
}
