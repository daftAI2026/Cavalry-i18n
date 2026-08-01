/**
 * [INPUT]: 依赖 hash-locked RestoreRequest/QpaRestorePlan、安装根 durable manifest、当前打包 proxy/generic 所有权锚与 storage 原子文件能力。
 * [OUTPUT]: 提供 English 恢复计划构建与可写执行；恢复原厂 qwindows，删除精确归属的 generic/recovery，并对未知文件和厂商更新 fail closed。
 * [POS]: windows_qpa 的显式 English 收敛域；将历史 manifest 所有权与当前包 fallback 分开，父级状态机和提升 worker 共用这一实现。
 * [FAIL-CLOSED]: manifest.json 仅在真实缺失时走无 manifest fallback；存在但解析或校验失败必须在任何写入前返回错误。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
use std::{fs, path::Path};

use crate::install::InstallLayout;

use super::{
    contract::{validate_restore_plan, Policy, MANIFEST_SCHEMA_VERSION, PLAN_SCHEMA_VERSION},
    identity::verify_runtime_identity,
    manifest_path, read_manifest, recovery_directory, require_windows_layout,
    storage::{
        create_missing_verified, ensure_path_chain_has_no_reparse_points, ensure_regular_directory,
        ensure_regular_file, remove_empty_directory, remove_if_hash_matches, remove_regular_file,
        replace_existing_verified, require_hash, sha256_file, snapshot_hash, validate_x64_pe,
        MANIFEST_REPLACE_BACKUP_FILE, MANIFEST_TEMP_FILE, REPLACE_BACKUP_FILE, VENDOR_TEMP_FILE,
    },
    vendor_qwindows_backup, write_manifest, PreparedRestore, QpaManifest, QpaManifestPhase,
    QpaRestorePlan, RestoreAction, RestoreOutcome, RestoreRequest, GENERIC_PLUGIN_RELATIVE_PATH,
    MANIFEST_FILE_NAME, QT_CORE_FILE_NAME, QWINDOWS_FILE_NAME, VENDOR_QWINDOWS_FILE_NAME,
};

pub(super) fn build_restore_plan_with_policy(
    request: RestoreRequest<'_>,
    policy: &Policy,
) -> Result<PreparedRestore, String> {
    require_windows_layout(request.layout)?;
    ensure_path_chain_has_no_reparse_points(&request.layout.root)?;
    validate_x64_pe(request.proxy_source, "packaged QPA proxy")?;
    validate_x64_pe(
        request.generic_source,
        "packaged generic translation plugin",
    )?;
    let packaged_proxy_hash = sha256_file(request.proxy_source)?;
    let packaged_generic_hash = sha256_file(request.generic_source)?;
    let qwindows = request.layout.root.join(QWINDOWS_FILE_NAME);
    let current = snapshot_hash(&qwindows, "installed qwindows.dll")?;
    let current_generic = snapshot_hash(
        &request.layout.root.join(GENERIC_PLUGIN_RELATIVE_PATH),
        "installed generic translation plugin",
    )?;
    let recovery = recovery_directory(request.layout);
    if !recovery.exists() {
        return Ok(match current.as_deref() {
            Some(hash) if hash == policy.vendor_hash && current_generic.is_none() => {
                PreparedRestore::Complete(RestoreOutcome::AlreadyStock)
            }
            Some(hash)
                if hash == policy.vendor_hash
                    && current_generic.as_deref() == Some(packaged_generic_hash.as_str()) =>
            {
                PreparedRestore::Execute(QpaRestorePlan {
                    schema_version: PLAN_SCHEMA_VERSION,
                    install_root: request.layout.root.to_string_lossy().to_string(),
                    reason: request.reason,
                    action: RestoreAction::CleanupOnly,
                    cavalry_version: policy.cavalry_version.clone(),
                    cavalry_executable_sha256: sha256_file(&request.layout.executable)?,
                    qt_version: policy.qt_version.clone(),
                    architecture: policy.architecture.clone(),
                    expected_current_qwindows_sha256: current,
                    proxy_qwindows_sha256: packaged_proxy_hash,
                    vendor_qwindows_sha256: policy.vendor_hash.clone(),
                    generic_plugin_sha256: packaged_generic_hash,
                })
            }
            Some(hash) if hash == policy.vendor_hash => {
                return Err(
                    "Refusing to remove an unknown generic translation plugin from a stock QPA installation."
                        .to_string(),
                )
            }
            Some(hash) if hash == packaged_proxy_hash => {
                return Err(
                    "The QPA proxy is active but its durable vendor backup is missing.".to_string(),
                )
            }
            None => {
                return Err(
                    "qwindows.dll is missing and there is no durable vendor backup to restore."
                        .to_string(),
                )
            }
            _ => PreparedRestore::Complete(RestoreOutcome::VendorUpdatePreserved),
        });
    }
    ensure_regular_directory(&recovery, "QPA recovery directory")?;
    require_hash(
        &vendor_qwindows_backup(request.layout),
        &policy.vendor_hash,
        "durable vendor qwindows.dll backup",
    )?;
    let manifest = read_manifest(request.layout, policy)?;
    if let Some(manifest) = manifest.as_ref() {
        let executable_hash = snapshot_hash(
            &request.layout.executable,
            "Cavalry executable during English restore",
        )?;
        if executable_hash.as_deref() != Some(manifest.cavalry_executable_sha256.as_str()) {
            return Ok(PreparedRestore::Complete(
                RestoreOutcome::VendorUpdatePreserved,
            ));
        }
    }
    let manifest_proxy_hash = manifest
        .as_ref()
        .map(|manifest| manifest.proxy_qwindows_sha256.clone());
    let owned_proxy = manifest_proxy_hash
        .as_deref()
        .is_some_and(|hash| current.as_deref() == Some(hash))
        || current.as_deref() == Some(packaged_proxy_hash.as_str());
    if current
        .as_deref()
        .is_some_and(|hash| hash != policy.vendor_hash && !owned_proxy)
    {
        return Ok(PreparedRestore::Complete(
            RestoreOutcome::VendorUpdatePreserved,
        ));
    }
    let action = match current.as_deref() {
        None => RestoreAction::CreateMissing,
        Some(hash) if hash == policy.vendor_hash => RestoreAction::CleanupOnly,
        Some(_) if owned_proxy => RestoreAction::ReplaceProxy,
        Some(_) => {
            return Ok(PreparedRestore::Complete(
                RestoreOutcome::VendorUpdatePreserved,
            ))
        }
    };
    let generic_hash = manifest
        .as_ref()
        .map(|manifest| manifest.generic_plugin_sha256.clone())
        .unwrap_or(packaged_generic_hash);
    if current_generic
        .as_deref()
        .is_some_and(|hash| hash != generic_hash)
    {
        return Err(
            "Refusing to remove an unknown generic translation plugin from the owned QPA recovery set."
                .to_string(),
        );
    }
    Ok(PreparedRestore::Execute(QpaRestorePlan {
        schema_version: PLAN_SCHEMA_VERSION,
        install_root: request.layout.root.to_string_lossy().to_string(),
        reason: request.reason,
        action,
        cavalry_version: policy.cavalry_version.clone(),
        cavalry_executable_sha256: sha256_file(&request.layout.executable)?,
        qt_version: policy.qt_version.clone(),
        architecture: policy.architecture.clone(),
        expected_current_qwindows_sha256: current,
        proxy_qwindows_sha256: manifest_proxy_hash.unwrap_or(packaged_proxy_hash),
        vendor_qwindows_sha256: policy.vendor_hash.clone(),
        generic_plugin_sha256: generic_hash,
    }))
}

pub(super) fn execute_writable_restore_with_policy(
    plan: &QpaRestorePlan,
    policy: &Policy,
    verify_versions: bool,
) -> Result<RestoreOutcome, String> {
    validate_restore_plan(plan, policy)?;
    let layout = InstallLayout::from_root(Path::new(&plan.install_root));
    require_windows_layout(&layout)?;
    ensure_path_chain_has_no_reparse_points(&layout.root)?;
    if verify_versions {
        verify_runtime_identity(&layout, policy)?;
    } else {
        validate_x64_pe(&layout.executable, "Cavalry.exe")?;
        validate_x64_pe(&layout.root.join(QT_CORE_FILE_NAME), "Qt6Core.dll")?;
    }
    require_hash(
        &layout.executable,
        &plan.cavalry_executable_sha256,
        "hash-locked Cavalry executable",
    )?;
    let recovery_exists = recovery_directory(&layout).exists();
    if recovery_exists {
        require_hash(
            &vendor_qwindows_backup(&layout),
            &policy.vendor_hash,
            "durable vendor qwindows.dll backup",
        )?;
    } else if plan.action != RestoreAction::CleanupOnly {
        return Err("QPA restore plan lost its durable vendor backup.".to_string());
    }
    let qwindows = layout.root.join(QWINDOWS_FILE_NAME);
    let generic = layout.root.join(GENERIC_PLUGIN_RELATIVE_PATH);
    let current = snapshot_hash(&qwindows, "installed qwindows.dll")?;
    if current != plan.expected_current_qwindows_sha256 {
        if current
            .as_deref()
            .is_some_and(|hash| hash != policy.vendor_hash && hash != plan.proxy_qwindows_sha256)
        {
            return Ok(RestoreOutcome::VendorUpdatePreserved);
        }
        return Err(
            "qwindows.dll changed after the restore plan was built; refusing a stale write."
                .to_string(),
        );
    }
    match snapshot_hash(&generic, "installed generic translation plugin")? {
        Some(hash) if hash != plan.generic_plugin_sha256 => {
            return Err(format!(
                "Refusing to remove an unknown generic translation plugin: {}",
                generic.display()
            ));
        }
        _ => {}
    }

    if plan.action != RestoreAction::CleanupOnly {
        let restoring = QpaManifest {
            schema_version: MANIFEST_SCHEMA_VERSION,
            phase: QpaManifestPhase::Restoring,
            cavalry_version: policy.cavalry_version.clone(),
            cavalry_executable_sha256: snapshot_hash(
                &layout.executable,
                "Cavalry executable during English restore",
            )?
            .unwrap_or_else(|| "0".repeat(64)),
            qt_version: policy.qt_version.clone(),
            architecture: policy.architecture.clone(),
            vendor_qwindows_sha256: policy.vendor_hash.clone(),
            proxy_qwindows_sha256: plan.proxy_qwindows_sha256.clone(),
            generic_plugin_sha256: plan.generic_plugin_sha256.clone(),
        };
        write_manifest(&layout, &restoring, policy)?;
    }

    match plan.action {
        RestoreAction::ReplaceProxy => replace_existing_verified(
            &qwindows,
            &vendor_qwindows_backup(&layout),
            &recovery_directory(&layout),
            &plan.proxy_qwindows_sha256,
            &policy.vendor_hash,
        )?,
        RestoreAction::CreateMissing => create_missing_verified(
            &qwindows,
            &vendor_qwindows_backup(&layout),
            &policy.vendor_hash,
        )?,
        RestoreAction::CleanupOnly => require_hash(
            &qwindows,
            &policy.vendor_hash,
            "stock qwindows.dll before cleanup",
        )?,
    }
    require_hash(
        &qwindows,
        &policy.vendor_hash,
        "restored vendor qwindows.dll",
    )?;
    remove_if_hash_matches(
        &generic,
        &plan.generic_plugin_sha256,
        "hash-owned generic translation plugin",
    )?;
    if recovery_exists {
        cleanup_recovery(&layout, policy)?;
    }
    Ok(if plan.action == RestoreAction::CleanupOnly {
        RestoreOutcome::AlreadyStock
    } else {
        RestoreOutcome::Restored
    })
}

fn cleanup_recovery(layout: &InstallLayout, policy: &Policy) -> Result<(), String> {
    let recovery = recovery_directory(layout);
    ensure_regular_directory(&recovery, "QPA recovery directory")?;
    let allowed = [
        MANIFEST_FILE_NAME,
        VENDOR_QWINDOWS_FILE_NAME,
        MANIFEST_TEMP_FILE,
        MANIFEST_REPLACE_BACKUP_FILE,
        VENDOR_TEMP_FILE,
        REPLACE_BACKUP_FILE,
    ];
    for entry in fs::read_dir(&recovery)
        .map_err(|error| format!("Could not enumerate {}: {error}", recovery.display()))?
    {
        let entry = entry.map_err(|error| {
            format!("Could not inspect entry in {}: {error}", recovery.display())
        })?;
        let name = entry.file_name();
        if !allowed.iter().any(|allowed| name == *allowed) {
            return Err(format!(
                "Refusing to clean QPA recovery directory with unknown entry: {}",
                entry.path().display()
            ));
        }
        ensure_regular_file(&entry.path(), "QPA recovery artifact")?;
    }
    remove_regular_file(&manifest_path(layout), "QPA manifest")?;
    remove_if_hash_matches(
        &vendor_qwindows_backup(layout),
        &policy.vendor_hash,
        "durable vendor qwindows.dll backup",
    )?;
    for name in [
        MANIFEST_TEMP_FILE,
        MANIFEST_REPLACE_BACKUP_FILE,
        VENDOR_TEMP_FILE,
        REPLACE_BACKUP_FILE,
    ] {
        remove_regular_file(&recovery.join(name), "known QPA recovery temporary file")?;
    }
    remove_empty_directory(&recovery)
}
