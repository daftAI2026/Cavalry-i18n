/**
 * [INPUT]: 依赖 InstallLayout、QPA Policy 与 storage 的普通文件、PE、版本资源检查。
 * [OUTPUT]: 按编译profile提供Cavalry/Qt/x64身份与固定文件预检；native绑定Cavalry 2.8.1官方EXE精确SHA与无版本资源回退、Qt6.9.2及无重解析路径。
 * [POS]: windows_qpa 的只读身份域；计划构建与执行共用同一套目标证明，绝不写入安装根。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
use std::path::Path;

use crate::install::InstallLayout;

use super::{
    storage::{
        ensure_path_chain_has_no_reparse_points, product_version, snapshot_hash, validate_x64_pe,
        FileVersion,
    },
    Policy, QT_CORE_FILE_NAME, QWINDOWS_FILE_NAME,
};

const NATIVE_CAVALRY_VERSION: &str = "2.8.1";
const NATIVE_CAVALRY_EXECUTABLE_SHA256: &str =
    "87689d8e7a37b2e2341cbf5c6327fd960afc65b8385ac35b170d71671961d9ad";

pub(super) fn verify_target_files_with_generic(
    layout: &InstallLayout,
    proxy_source: &Path,
    generic_source: &Path,
    policy: &Policy,
    verify_versions: bool,
) -> Result<(), String> {
    ensure_path_chain_has_no_reparse_points(&layout.root)?;
    let proxy_parent = proxy_source
        .parent()
        .ok_or_else(|| "QPA proxy source has no parent.".to_string())?;
    ensure_path_chain_has_no_reparse_points(proxy_parent)?;
    validate_x64_pe(&layout.executable, "Cavalry.exe")?;
    let qt_core = layout.root.join(QT_CORE_FILE_NAME);
    validate_x64_pe(&qt_core, "Qt6Core.dll")?;
    validate_x64_pe(proxy_source, "QPA proxy source")?;
    validate_x64_pe(generic_source, "generic translation plugin")?;
    if snapshot_hash(
        &layout.root.join(QWINDOWS_FILE_NAME),
        "installed qwindows.dll",
    )?
    .is_some()
    {
        validate_x64_pe(
            &layout.root.join(QWINDOWS_FILE_NAME),
            "installed qwindows.dll",
        )?;
    }
    if verify_versions {
        verify_runtime_identity(layout, policy)?;
    }
    Ok(())
}

pub(super) fn verify_runtime_identity(
    layout: &InstallLayout,
    policy: &Policy,
) -> Result<(), String> {
    validate_x64_pe(&layout.executable, "Cavalry.exe")?;
    let qt_core = layout.root.join(QT_CORE_FILE_NAME);
    validate_x64_pe(&qt_core, "Qt6Core.dll")?;
    let cavalry_executable_sha256 = snapshot_hash(&layout.executable, "native Cavalry executable")?;
    verify_native_executable_sha256(
        cavalry_executable_sha256.as_deref(),
        cfg!(cavalry_native_windows),
    )?;
    let actual_cavalry = crate::windows_install::product_version_for_executable(&layout.executable)
        .or_else(|| {
            native_version_fallback(
                cavalry_executable_sha256.as_deref(),
                cfg!(cavalry_native_windows),
            )
            .map(str::to_string)
        })
        .unwrap_or_default();
    if actual_cavalry != policy.cavalry_version {
        return Err(format!(
            "Windows QPA requires Cavalry {}; the selected executable proves {}.",
            policy.cavalry_version,
            if actual_cavalry.is_empty() {
                "no supported release"
            } else {
                actual_cavalry.as_str()
            }
        ));
    }
    let expected = FileVersion {
        major: 6,
        minor: if cfg!(cavalry_native_windows) { 9 } else { 6 },
        patch: if cfg!(cavalry_native_windows) { 2 } else { 3 },
        build: 0,
    };
    let actual = product_version(&qt_core)?;
    if actual != expected || policy.qt_version != super::SUPPORTED_QT_VERSION {
        return Err(format!(
            "Windows QPA requires Qt {} (file version {expected}); found {actual}.",
            policy.qt_version
        ));
    }
    Ok(())
}

fn verify_native_executable_sha256(
    actual_sha256: Option<&str>,
    native_profile: bool,
) -> Result<(), String> {
    if native_profile && actual_sha256 != Some(NATIVE_CAVALRY_EXECUTABLE_SHA256) {
        return Err(format!(
            "Native Cavalry executable differs from the approved {NATIVE_CAVALRY_VERSION} binary"
        ));
    }
    Ok(())
}

fn native_version_fallback(
    actual_sha256: Option<&str>,
    native_profile: bool,
) -> Option<&'static str> {
    (native_profile && actual_sha256 == Some(NATIVE_CAVALRY_EXECUTABLE_SHA256))
        .then_some(NATIVE_CAVALRY_VERSION)
}

#[cfg(test)]
mod identity_tests {
    use super::*;

    #[test]
    fn official_281_executable_uses_exact_hash_when_version_resource_is_absent() {
        let target: serde_json::Value = serde_json::from_slice(include_bytes!(
            "../../../tools/cavalry_native_windows_target.json"
        ))
        .unwrap();
        let target_sha256 = target["files"]["Cavalry.exe"].as_str().unwrap();

        assert_eq!(target["cavalryVersion"], NATIVE_CAVALRY_VERSION);
        assert_eq!(target_sha256, NATIVE_CAVALRY_EXECUTABLE_SHA256);
        // The official EXE has no version resource; the exact approved SHA supplies its version.
        assert_eq!(
            native_version_fallback(Some(target_sha256), true),
            Some("2.8.1")
        );
        assert!(verify_native_executable_sha256(Some(target_sha256), true).is_ok());
    }

    #[cfg(cavalry_native_windows)]
    #[test]
    fn drifted_existing_executable_is_rejected_before_qt_version_read() {
        let temp = tempfile::tempdir().unwrap();
        let root = temp.path().join("Cavalry 2.8.1 drift fixture");
        std::fs::create_dir_all(&root).unwrap();
        std::fs::write(root.join("Cavalry.exe"), fake_x64_pe(b"drifted-cavalry")).unwrap();
        std::fs::write(root.join("Qt6Core.dll"), fake_x64_pe(b"fixture-qt-core")).unwrap();
        let layout = InstallLayout::from_root(&root);

        let error = verify_runtime_identity(&layout, &Policy::production()).unwrap_err();

        assert!(
            error.contains("differs from the approved 2.8.1 binary"),
            "the valid on-disk PE must reach the SHA identity gate first: {error}"
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
    fn previous_280_and_drifted_executables_fail_closed() {
        for sha256 in [
            "bad89abf30c67b2d2fb3c9d0a26c3cfda9b738164e11bca050ac54ad0e2783a1",
            "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        ] {
            assert!(verify_native_executable_sha256(Some(sha256), true).is_err());
            assert_eq!(native_version_fallback(Some(sha256), true), None);
        }
        assert!(verify_native_executable_sha256(None, true).is_err());
        assert_eq!(
            native_version_fallback(Some(NATIVE_CAVALRY_EXECUTABLE_SHA256), false),
            None
        );
        assert!(verify_native_executable_sha256(Some("not-native"), false).is_ok());
    }
}
