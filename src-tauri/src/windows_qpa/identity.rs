/**
 * [INPUT]: 依赖 InstallLayout、QPA Policy 与 storage 的普通文件、PE、版本资源检查。
 * [OUTPUT]: 提供 Cavalry 2.7.2/Qt 6.6.3/x64 运行身份验证，以及代理/generic/qwindows 固定文件预检。
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
    let actual_cavalry = crate::windows_install::product_version_for_executable(&layout.executable)
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
        minor: 6,
        patch: 3,
        build: 0,
    };
    let actual = product_version(&qt_core)?;
    if actual != expected || policy.qt_version != "6.6.3" {
        return Err(format!(
            "Windows QPA requires Qt {} (file version {expected}); found {actual}.",
            policy.qt_version
        ));
    }
    Ok(())
}
