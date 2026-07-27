/**
 * [INPUT]: 依赖 InstallLayout、打包 QPA 代理、安装根 generic plugin 与 windows_qpa/storage 的原子文件能力。
 * [OUTPUT]: 提供严格 Cavalry 2.7.2/Qt 6.6.3/x64 QPA 激活计划、直接写入 preflight、STOCK/ACTIVE/DRIFTED/RECOVER 检查，以及仅供明确 English 选择调用的原厂恢复。
 * [POS]: src-tauri/src 的 Windows QPA 持久部署边界；原厂 DLL 长期留在安装根恢复目录，普通 Cavalry 关闭不触发恢复，厂商覆盖代理时绝不回写旧备份。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
use std::{fs, io::ErrorKind, path::Path};

use crate::install::{InstallLayout, InstallPlatform};

#[path = "windows_qpa/contract.rs"]
mod contract;
#[path = "windows_qpa/preflight.rs"]
mod preflight;
#[path = "windows_qpa/storage.rs"]
mod storage;

use contract::{
    inspection, manifest_from_activation_plan, validate_activation_plan, validate_manifest,
    validate_restore_plan, Policy, MANIFEST_SCHEMA_VERSION, PLAN_SCHEMA_VERSION,
};
pub use contract::{
    ActivationOutcome, ActivationRequest, PreparedRestore, QpaActivationPlan, QpaDeploymentState,
    QpaInspection, QpaManifest, QpaManifestPhase, QpaRestorePlan, RestoreAction, RestoreOutcome,
    RestoreReason, RestoreRequest, GENERIC_PLUGIN_RELATIVE_PATH, MANIFEST_FILE_NAME,
    QT_CORE_FILE_NAME, QWINDOWS_FILE_NAME, RECOVERY_DIRECTORY_NAME, SUPPORTED_ARCHITECTURE,
    SUPPORTED_CAVALRY_VERSION, SUPPORTED_QT_VERSION, VENDOR_QWINDOWS_FILE_NAME,
    VENDOR_QWINDOWS_SHA256,
};
pub use preflight::{
    direct_write_requires_elevated_worker, managed_write_surface, manifest_path,
    preflight_direct_writable, recovery_directory, vendor_qwindows_backup,
};
use storage::{
    copy_new_durable, create_missing_verified, create_recovery_directory,
    ensure_path_chain_has_no_reparse_points, ensure_regular_directory, ensure_regular_file,
    product_version, publish_without_overwrite, remove_empty_directory, remove_if_hash_matches,
    remove_regular_file, replace_existing_verified, require_hash, sha256_file, snapshot_hash,
    validate_x64_pe, write_manifest_atomic, FileVersion, MANIFEST_REPLACE_BACKUP_FILE,
    MANIFEST_TEMP_FILE, REPLACE_BACKUP_FILE, VENDOR_TEMP_FILE,
};

pub fn inspect(layout: &InstallLayout) -> Result<QpaInspection, String> {
    inspect_with_policy(layout, &Policy::production())
}

pub fn build_activation_plan(request: ActivationRequest<'_>) -> Result<QpaActivationPlan, String> {
    build_activation_plan_with_policy(request, &Policy::production(), true)
}

/// 普通可写安装根直接执行；Program Files 调用方应序列化同一份 hash-locked plan，
/// 在受限提升 worker 中调用 execute_writable_activation，不能退回 CopyPair 截断覆盖。
pub fn execute_writable_activation(plan: &QpaActivationPlan) -> Result<ActivationOutcome, String> {
    execute_writable_activation_with_policy(plan, &Policy::production(), true)
}

pub fn activate_writable(request: ActivationRequest<'_>) -> Result<ActivationOutcome, String> {
    let plan = build_activation_plan(request)?;
    execute_writable_activation(&plan)
}

pub fn build_restore_plan(request: RestoreRequest<'_>) -> Result<PreparedRestore, String> {
    build_restore_plan_with_policy(request, &Policy::production())
}

pub fn execute_writable_restore(plan: &QpaRestorePlan) -> Result<RestoreOutcome, String> {
    execute_writable_restore_with_policy(plan, &Policy::production())
}

pub fn restore_writable(request: RestoreRequest<'_>) -> Result<RestoreOutcome, String> {
    match build_restore_plan(request)? {
        PreparedRestore::Execute(plan) => execute_writable_restore(&plan),
        PreparedRestore::Complete(outcome) => Ok(outcome),
    }
}

fn inspect_with_policy(layout: &InstallLayout, policy: &Policy) -> Result<QpaInspection, String> {
    require_windows_layout(layout)?;
    ensure_path_chain_has_no_reparse_points(&layout.root)?;
    let qwindows = layout.root.join(QWINDOWS_FILE_NAME);
    let current = snapshot_hash(&qwindows, "installed qwindows.dll")?;
    let recovery = recovery_directory(layout);
    if !recovery.exists() {
        return Ok(match current {
            Some(hash) if hash == policy.vendor_hash => inspection(
                QpaDeploymentState::Stock,
                None,
                Some(hash),
                "The supported vendor qwindows.dll is active and no recovery state exists.",
            ),
            Some(hash) => inspection(
                QpaDeploymentState::Drifted,
                None,
                Some(hash),
                "qwindows.dll is neither the supported vendor DLL nor owned by a recovery manifest.",
            ),
            None => inspection(
                QpaDeploymentState::Recover,
                None,
                None,
                "qwindows.dll is missing and there is no durable vendor backup.",
            ),
        });
    }
    ensure_regular_directory(&recovery, "QPA recovery directory")?;
    let backup_hash = snapshot_hash(
        &vendor_qwindows_backup(layout),
        "durable vendor qwindows.dll backup",
    )?;
    if backup_hash.as_deref() != Some(policy.vendor_hash.as_str()) {
        return Ok(inspection(
            QpaDeploymentState::Recover,
            None,
            current,
            "The QPA recovery directory does not contain the exact supported vendor backup.",
        ));
    }
    let manifest = match read_manifest(layout, policy) {
        Ok(manifest) => manifest,
        Err(error) => {
            return Ok(inspection(
                QpaDeploymentState::Recover,
                None,
                current,
                format!("The durable QPA manifest requires recovery: {error}"),
            ))
        }
    };
    let Some(manifest) = manifest else {
        return Ok(inspection(
            QpaDeploymentState::Recover,
            None,
            current,
            "The durable vendor backup exists but its QPA manifest is missing.",
        ));
    };
    let executable_hash = snapshot_hash(&layout.executable, "Cavalry executable")?;
    if manifest.phase == QpaManifestPhase::Active
        && executable_hash.as_deref() != Some(manifest.cavalry_executable_sha256.as_str())
    {
        return Ok(inspection(
            QpaDeploymentState::Drifted,
            Some(manifest.phase),
            current,
            "Cavalry.exe changed after QPA activation; the proxy remains preserved but cannot be treated as ACTIVE for this executable.",
        ));
    }

    if current
        .as_deref()
        .is_some_and(|hash| hash != policy.vendor_hash && hash != manifest.proxy_qwindows_sha256)
    {
        return Ok(inspection(
            QpaDeploymentState::Drifted,
            Some(manifest.phase),
            current,
            "A different qwindows.dll replaced the owned proxy; the old vendor backup will not overwrite it.",
        ));
    }
    let generic_hash = snapshot_hash(
        &layout.root.join(GENERIC_PLUGIN_RELATIVE_PATH),
        "installed generic translation plugin",
    )?;
    if manifest.phase == QpaManifestPhase::Active
        && current.as_deref() == Some(manifest.proxy_qwindows_sha256.as_str())
        && generic_hash.as_deref() == Some(manifest.generic_plugin_sha256.as_str())
    {
        return Ok(inspection(
            QpaDeploymentState::Active,
            Some(manifest.phase),
            current,
            "The proxy, vendor backup, manifest, and generic plugin form one active hash-locked set.",
        ));
    }
    Ok(inspection(
        QpaDeploymentState::Recover,
        Some(manifest.phase),
        current,
        "The QPA transaction is known but not fully active; resume activation or explicitly restore.",
    ))
}

fn build_activation_plan_with_policy(
    request: ActivationRequest<'_>,
    policy: &Policy,
    verify_versions: bool,
) -> Result<QpaActivationPlan, String> {
    require_windows_layout(request.layout)?;
    if request.cavalry_version != policy.cavalry_version {
        return Err(format!(
            "Windows QPA supports Cavalry {} only; discovered {}.",
            policy.cavalry_version, request.cavalry_version
        ));
    }
    request.layout.validate()?;
    verify_target_files(
        request.layout,
        request.proxy_source,
        policy,
        verify_versions,
    )?;
    let generic = request.layout.root.join(GENERIC_PLUGIN_RELATIVE_PATH);
    let cavalry_executable_hash = sha256_file(&request.layout.executable)?;
    let proxy_hash = sha256_file(request.proxy_source)?;
    let generic_hash = sha256_file(&generic)?;
    let qwindows = request.layout.root.join(QWINDOWS_FILE_NAME);
    let current = snapshot_hash(&qwindows, "installed qwindows.dll")?;
    let inspection = inspect_with_policy(request.layout, policy)?;

    match inspection.state {
        QpaDeploymentState::Drifted => {
            return Err(format!(
                "Refusing to replace a drifted qwindows.dll. {}",
                inspection.detail
            ))
        }
        QpaDeploymentState::Recover => {
            validate_resumable_recovery(request.layout, current.as_deref(), &proxy_hash, policy)?;
        }
        QpaDeploymentState::Stock | QpaDeploymentState::Active => {}
    }

    Ok(QpaActivationPlan {
        schema_version: PLAN_SCHEMA_VERSION,
        install_root: request.layout.root.to_string_lossy().to_string(),
        proxy_source_path: request.proxy_source.to_string_lossy().to_string(),
        cavalry_version: policy.cavalry_version.clone(),
        cavalry_executable_sha256: cavalry_executable_hash,
        qt_version: policy.qt_version.clone(),
        architecture: policy.architecture.clone(),
        expected_current_qwindows_sha256: current,
        vendor_qwindows_sha256: policy.vendor_hash.clone(),
        proxy_qwindows_sha256: proxy_hash,
        generic_plugin_sha256: generic_hash,
    })
}

fn execute_writable_activation_with_policy(
    plan: &QpaActivationPlan,
    policy: &Policy,
    verify_versions: bool,
) -> Result<ActivationOutcome, String> {
    validate_activation_plan(plan, policy)?;
    let layout = InstallLayout::from_root(Path::new(&plan.install_root));
    let proxy_source = Path::new(&plan.proxy_source_path);
    verify_target_files(&layout, proxy_source, policy, verify_versions)?;
    require_hash(
        &layout.executable,
        &plan.cavalry_executable_sha256,
        "hash-locked Cavalry executable",
    )?;
    require_hash(
        proxy_source,
        &plan.proxy_qwindows_sha256,
        "hash-locked QPA proxy source",
    )?;
    require_hash(
        &layout.root.join(GENERIC_PLUGIN_RELATIVE_PATH),
        &plan.generic_plugin_sha256,
        "hash-locked installed generic plugin",
    )?;
    let qwindows = layout.root.join(QWINDOWS_FILE_NAME);
    let current = snapshot_hash(&qwindows, "installed qwindows.dll")?;
    if current != plan.expected_current_qwindows_sha256 {
        return Err(
            "qwindows.dll changed after the activation plan was built; refusing a stale write."
                .to_string(),
        );
    }
    let before = inspect_with_policy(&layout, policy)?;
    if before.state == QpaDeploymentState::Drifted {
        return Err(before.detail);
    }
    if before.state == QpaDeploymentState::Active
        && current.as_deref() == Some(plan.proxy_qwindows_sha256.as_str())
    {
        let manifest = read_manifest(&layout, policy)?
            .ok_or_else(|| "Active QPA state lost its manifest.".to_string())?;
        if manifest.generic_plugin_sha256 == plan.generic_plugin_sha256 {
            return Ok(ActivationOutcome::AlreadyActive);
        }
    }

    prepare_vendor_backup(&layout, current.as_deref(), policy)?;
    let prepared = manifest_from_activation_plan(plan, QpaManifestPhase::Prepared);
    write_manifest(&layout, &prepared, policy)?;

    let current = snapshot_hash(&qwindows, "installed qwindows.dll")?;
    if current.is_none() {
        create_missing_verified(
            &qwindows,
            &vendor_qwindows_backup(&layout),
            &policy.vendor_hash,
        )?;
    }
    let current = sha256_file(&qwindows)?;
    if current != plan.proxy_qwindows_sha256 {
        replace_existing_verified(
            &qwindows,
            proxy_source,
            &recovery_directory(&layout),
            &current,
            &plan.proxy_qwindows_sha256,
        )?;
    }
    clear_completed_replace_artifacts(&layout, plan, policy)?;
    let active = manifest_from_activation_plan(plan, QpaManifestPhase::Active);
    write_manifest(&layout, &active, policy)?;
    let verified = inspect_with_policy(&layout, policy)?;
    if verified.state != QpaDeploymentState::Active {
        return Err(format!(
            "QPA activation finished without a proven ACTIVE state: {}",
            verified.detail
        ));
    }
    Ok(if before.state == QpaDeploymentState::Recover {
        ActivationOutcome::Recovered
    } else {
        ActivationOutcome::Activated
    })
}

fn build_restore_plan_with_policy(
    request: RestoreRequest<'_>,
    policy: &Policy,
) -> Result<PreparedRestore, String> {
    require_windows_layout(request.layout)?;
    ensure_path_chain_has_no_reparse_points(&request.layout.root)?;
    validate_x64_pe(request.proxy_source, "packaged QPA proxy")?;
    let packaged_proxy_hash = sha256_file(request.proxy_source)?;
    let qwindows = request.layout.root.join(QWINDOWS_FILE_NAME);
    let current = snapshot_hash(&qwindows, "installed qwindows.dll")?;
    let recovery = recovery_directory(request.layout);
    if !recovery.exists() {
        return Ok(match current {
            Some(hash) if hash == policy.vendor_hash => {
                PreparedRestore::Complete(RestoreOutcome::AlreadyStock)
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
    let manifest = read_manifest(request.layout, policy).ok().flatten();
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
        .or_else(|| {
            snapshot_hash(
                &request.layout.root.join(GENERIC_PLUGIN_RELATIVE_PATH),
                "installed generic translation plugin",
            )
            .ok()
            .flatten()
        })
        .unwrap_or_else(|| "0".repeat(64));
    Ok(PreparedRestore::Execute(QpaRestorePlan {
        schema_version: PLAN_SCHEMA_VERSION,
        install_root: request.layout.root.to_string_lossy().to_string(),
        reason: request.reason,
        action,
        expected_current_qwindows_sha256: current,
        proxy_qwindows_sha256: manifest_proxy_hash.unwrap_or(packaged_proxy_hash),
        vendor_qwindows_sha256: policy.vendor_hash.clone(),
        generic_plugin_sha256: generic_hash,
    }))
}

fn execute_writable_restore_with_policy(
    plan: &QpaRestorePlan,
    policy: &Policy,
) -> Result<RestoreOutcome, String> {
    validate_restore_plan(plan, policy)?;
    let layout = InstallLayout::from_root(Path::new(&plan.install_root));
    require_windows_layout(&layout)?;
    ensure_path_chain_has_no_reparse_points(&layout.root)?;
    require_hash(
        &vendor_qwindows_backup(&layout),
        &policy.vendor_hash,
        "durable vendor qwindows.dll backup",
    )?;
    let qwindows = layout.root.join(QWINDOWS_FILE_NAME);
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
    cleanup_recovery(&layout, policy)?;
    Ok(if plan.action == RestoreAction::CleanupOnly {
        RestoreOutcome::AlreadyStock
    } else {
        RestoreOutcome::Restored
    })
}

fn verify_target_files(
    layout: &InstallLayout,
    proxy_source: &Path,
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
    validate_x64_pe(
        &layout.root.join(GENERIC_PLUGIN_RELATIVE_PATH),
        "generic translation plugin",
    )?;
    if let Some(current) = snapshot_hash(
        &layout.root.join(QWINDOWS_FILE_NAME),
        "installed qwindows.dll",
    )? {
        let _ = current;
        validate_x64_pe(
            &layout.root.join(QWINDOWS_FILE_NAME),
            "installed qwindows.dll",
        )?;
    }
    if verify_versions {
        let actual_cavalry =
            crate::windows_install::product_version_for_executable(&layout.executable)
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
    }
    Ok(())
}

fn prepare_vendor_backup(
    layout: &InstallLayout,
    current_hash: Option<&str>,
    policy: &Policy,
) -> Result<(), String> {
    let recovery = recovery_directory(layout);
    create_recovery_directory(&recovery)?;
    let backup = vendor_qwindows_backup(layout);
    if backup.exists() {
        return require_hash(
            &backup,
            &policy.vendor_hash,
            "durable vendor qwindows.dll backup",
        );
    }
    if current_hash != Some(policy.vendor_hash.as_str()) {
        return Err(
            "Cannot create the durable vendor backup from a non-vendor qwindows.dll.".to_string(),
        );
    }
    let temporary = recovery.join(VENDOR_TEMP_FILE);
    remove_if_hash_matches(
        &temporary,
        &policy.vendor_hash,
        "stale vendor qwindows.dll temporary backup",
    )?;
    copy_new_durable(&layout.root.join(QWINDOWS_FILE_NAME), &temporary)?;
    require_hash(
        &temporary,
        &policy.vendor_hash,
        "staged vendor qwindows.dll backup",
    )?;
    publish_without_overwrite(&temporary, &backup, "durable vendor qwindows.dll backup")?;
    require_hash(
        &backup,
        &policy.vendor_hash,
        "durable vendor qwindows.dll backup",
    )
}

fn validate_resumable_recovery(
    layout: &InstallLayout,
    current_hash: Option<&str>,
    expected_proxy_hash: &str,
    policy: &Policy,
) -> Result<(), String> {
    let recovery = recovery_directory(layout);
    if !recovery.exists() {
        return if current_hash.is_none() {
            Err("qwindows.dll is missing and no recovery directory exists.".to_string())
        } else {
            Ok(())
        };
    }
    let backup = snapshot_hash(
        &vendor_qwindows_backup(layout),
        "durable vendor qwindows.dll backup",
    )?;
    if backup
        .as_deref()
        .is_some_and(|hash| hash != policy.vendor_hash)
    {
        return Err("The durable vendor qwindows.dll backup has changed.".to_string());
    }
    if backup.is_none() && current_hash != Some(policy.vendor_hash.as_str()) {
        return Err(
            "QPA recovery has no proven vendor backup and root qwindows.dll is not stock."
                .to_string(),
        );
    }
    let manifest = read_manifest(layout, policy)?;
    let manifest_proxy = manifest
        .as_ref()
        .map(|manifest| manifest.proxy_qwindows_sha256.as_str());
    if current_hash.is_some_and(|hash| {
        hash != policy.vendor_hash && Some(hash) != manifest_proxy && hash != expected_proxy_hash
    }) {
        return Err(
            "QPA recovery found a different qwindows.dll and will not overwrite it.".to_string(),
        );
    }
    Ok(())
}

fn read_manifest(layout: &InstallLayout, policy: &Policy) -> Result<Option<QpaManifest>, String> {
    let path = manifest_path(layout);
    match fs::symlink_metadata(&path) {
        Err(error) if error.kind() == ErrorKind::NotFound => return Ok(None),
        Err(error) => {
            return Err(format!(
                "Could not inspect QPA manifest {}: {error}",
                path.display()
            ))
        }
        Ok(_) => ensure_regular_file(&path, "QPA manifest")?,
    }
    let bytes = fs::read(&path)
        .map_err(|error| format!("Could not read QPA manifest {}: {error}", path.display()))?;
    let manifest: QpaManifest = serde_json::from_slice(&bytes)
        .map_err(|error| format!("QPA manifest JSON is invalid: {error}"))?;
    validate_manifest(&manifest, policy)?;
    Ok(Some(manifest))
}

fn write_manifest(
    layout: &InstallLayout,
    manifest: &QpaManifest,
    policy: &Policy,
) -> Result<(), String> {
    validate_manifest(manifest, policy)?;
    clear_stale_manifest_artifacts(layout, policy)?;
    let bytes = serde_json::to_vec_pretty(manifest)
        .map_err(|error| format!("Could not serialize QPA manifest: {error}"))?;
    write_manifest_atomic(&recovery_directory(layout), &manifest_path(layout), &bytes)
}

fn clear_stale_manifest_artifacts(layout: &InstallLayout, policy: &Policy) -> Result<(), String> {
    let recovery = recovery_directory(layout);
    for name in [MANIFEST_TEMP_FILE, MANIFEST_REPLACE_BACKUP_FILE] {
        let path = recovery.join(name);
        match fs::symlink_metadata(&path) {
            Err(error) if error.kind() == ErrorKind::NotFound => continue,
            Err(error) => {
                return Err(format!(
                    "Could not inspect stale QPA manifest artifact {}: {error}",
                    path.display()
                ))
            }
            Ok(_) => ensure_regular_file(&path, "stale QPA manifest artifact")?,
        }
        let bytes = fs::read(&path).map_err(|error| {
            format!(
                "Could not read stale QPA manifest artifact {}: {error}",
                path.display()
            )
        })?;
        let stale: QpaManifest = serde_json::from_slice(&bytes).map_err(|_| {
            format!(
                "Refusing an unrecognized QPA manifest artifact: {}",
                path.display()
            )
        })?;
        validate_manifest(&stale, policy)?;
        remove_regular_file(&path, "validated stale QPA manifest artifact")?;
    }
    Ok(())
}

fn clear_completed_replace_artifacts(
    layout: &InstallLayout,
    plan: &QpaActivationPlan,
    policy: &Policy,
) -> Result<(), String> {
    let backup = recovery_directory(layout).join(REPLACE_BACKUP_FILE);
    if let Some(hash) = snapshot_hash(&backup, "completed QPA replace backup")? {
        let owned = hash == policy.vendor_hash
            || hash == plan.proxy_qwindows_sha256
            || plan.expected_current_qwindows_sha256.as_deref() == Some(hash.as_str());
        if !owned {
            return Err(format!(
                "Refusing changed QPA replace backup: {}",
                backup.display()
            ));
        }
        remove_if_hash_matches(&backup, &hash, "completed QPA replace backup")?;
    }
    let temporary = layout.root.join(storage::ROOT_REPLACEMENT_TEMP);
    if let Some(hash) = snapshot_hash(&temporary, "completed QPA root temporary file")? {
        if hash != plan.proxy_qwindows_sha256 {
            return Err(format!(
                "Refusing changed QPA root temporary file: {}",
                temporary.display()
            ));
        }
        remove_if_hash_matches(&temporary, &hash, "completed QPA root temporary file")?;
    }
    Ok(())
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

fn require_windows_layout(layout: &InstallLayout) -> Result<(), String> {
    if layout.platform != InstallPlatform::Windows {
        return Err("Windows QPA deployment requires a Windows Cavalry installation.".to_string());
    }
    Ok(())
}

#[cfg(test)]
#[path = "windows_qpa/tests.rs"]
mod tests;
