/**
 * [INPUT]: 依赖 Windows live disposable clone/evidence 的路径守卫、真实用户 LOCALAPPDATA 与关键登录窗资源
 * [OUTPUT]: 提供 live clone 关键资源完整性证明，以及真实 Cavalry workspace.json 的持久预镜像、精确恢复和最终字节校验
 * [POS]: Windows live smoke 的用户档案安全边界；FullSurfaces 继承登录 profile，只触碰一个可回滚的 workspace 文件，不隔离或复制整个 profile
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
use super::windows_disposable::{assert_absolute_existing_chain_has_no_reparse, GuardedTempRoot};
use cavalry_i18n_tauri::install::InstallLayout;
use sha2::{Digest, Sha256};
use std::{
    env,
    fs::{self, OpenOptions},
    io::Write,
    path::{Path, PathBuf},
};

const REAL_WORKSPACE_BACKUP_FILE: &str = "real-workspace.before";
const REAL_WORKSPACE_GUARD_FILE: &str = "real-workspace-guard.json";
const CLONE_RESOURCE_GUARD_FILE: &str = "live-clone-resources.json";
const REQUIRED_LIVE_CLONE_RESOURCES: [&str; 3] = [
    "assets/Icons/sign-in-bg.png",
    "assets/Icons/cavByCanva.png",
    "assets/Icons/tool_search.png",
];

#[derive(Debug, Clone)]
pub struct RealWorkspaceSnapshot {
    path: PathBuf,
    bytes: Option<Vec<u8>>,
    read_only: Option<bool>,
}

fn write_new_bytes(path: &Path, bytes: &[u8], label: &str) -> Result<(), String> {
    let mut file = OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(path)
        .map_err(|error| format!("could not create {label} {}: {error}", path.display()))?;
    file.write_all(bytes)
        .and_then(|_| file.sync_all())
        .map_err(|error| format!("could not flush {label} {}: {error}", path.display()))
}

fn write_new_json(path: &Path, value: &serde_json::Value, label: &str) -> Result<(), String> {
    let payload = serde_json::to_vec_pretty(value)
        .map_err(|error| format!("could not serialize {label}: {error}"))?;
    let mut bytes = payload;
    bytes.push(b'\n');
    write_new_bytes(path, &bytes, label)
}

fn set_read_only(path: &Path, read_only: bool) -> Result<(), std::io::Error> {
    let mut permissions = fs::metadata(path)?.permissions();
    permissions.set_readonly(read_only);
    fs::set_permissions(path, permissions)
}

pub fn verify_live_clone_completeness(
    evidence_root: &GuardedTempRoot,
    run_root: &Path,
    layout: &InstallLayout,
    guarded_clone: &GuardedTempRoot,
) -> Result<(), String> {
    let mut resources = Vec::with_capacity(REQUIRED_LIVE_CLONE_RESOURCES.len());
    for relative in REQUIRED_LIVE_CLONE_RESOURCES {
        let resource = layout.root.join(relative);
        guarded_clone.assert_write_target(&resource)?;
        let metadata = fs::symlink_metadata(&resource).map_err(|error| {
            format!(
                "disposable live clone is incomplete: required resource {} is missing or unreadable: {error}",
                resource.display()
            )
        })?;
        if !metadata.file_type().is_file() || metadata.len() == 0 {
            return Err(format!(
                "disposable live clone is incomplete: required resource {} must be a non-empty regular file",
                resource.display()
            ));
        }
        let bytes = fs::read(&resource).map_err(|error| {
            format!(
                "could not hash required live clone resource {}: {error}",
                resource.display()
            )
        })?;
        resources.push(serde_json::json!({
            "relativePath": relative,
            "bytes": bytes.len(),
            "sha256": format!("{:x}", Sha256::digest(&bytes)),
        }));
    }

    let manifest_path = run_root.join(CLONE_RESOURCE_GUARD_FILE);
    evidence_root.assert_write_target(&manifest_path)?;
    write_new_json(
        &manifest_path,
        &serde_json::json!({
            "schema": "cavalry-i18n.windows-live.clone-resources/v1",
            "cloneRoot": layout.root,
            "resources": resources,
        }),
        "live clone resource guard",
    )
}

pub fn capture_real_workspace(
    evidence_root: &GuardedTempRoot,
    run_root: &Path,
) -> Result<RealWorkspaceSnapshot, String> {
    let local_app_data = env::var_os("LOCALAPPDATA")
        .map(PathBuf::from)
        .ok_or_else(|| "LOCALAPPDATA is unavailable for the real workspace guard".to_string())?;
    if !local_app_data.is_absolute() || !local_app_data.is_dir() {
        return Err(format!(
            "LOCALAPPDATA must be an existing absolute directory for the real workspace guard: {}",
            local_app_data.display()
        ));
    }
    assert_absolute_existing_chain_has_no_reparse(&local_app_data)?;
    let workspace = local_app_data.join("Cavalry").join("workspace.json");
    assert_absolute_existing_chain_has_no_reparse(&workspace)?;
    let (bytes, read_only) = match fs::symlink_metadata(&workspace) {
        Ok(metadata) => {
            if !metadata.file_type().is_file() {
                return Err(format!(
                    "real Cavalry workspace must be a regular file: {}",
                    workspace.display()
                ));
            }
            let bytes = fs::read(&workspace).map_err(|error| {
                format!(
                    "could not snapshot real Cavalry workspace {}: {error}",
                    workspace.display()
                )
            })?;
            (Some(bytes), Some(metadata.permissions().readonly()))
        }
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => (None, None),
        Err(error) => {
            return Err(format!(
                "could not inspect real Cavalry workspace {}: {error}",
                workspace.display()
            ))
        }
    };

    let backup_path = run_root.join(REAL_WORKSPACE_BACKUP_FILE);
    evidence_root.assert_write_target(&backup_path)?;
    if let Some(bytes) = bytes.as_deref() {
        write_new_bytes(&backup_path, bytes, "real workspace preimage")?;
    }
    let guard_path = run_root.join(REAL_WORKSPACE_GUARD_FILE);
    evidence_root.assert_write_target(&guard_path)?;
    write_new_json(
        &guard_path,
        &serde_json::json!({
            "schema": "cavalry-i18n.windows-live.workspace-guard/v1",
            "path": workspace,
            "present": bytes.is_some(),
            "bytes": bytes.as_ref().map_or(0, Vec::len),
            "sha256": bytes.as_ref().map(|value| format!("{:x}", Sha256::digest(value))),
            "readOnly": read_only,
            "restore": "exact-preimage-after-owned-process-cleanup",
        }),
        "real workspace guard",
    )?;
    Ok(RealWorkspaceSnapshot {
        path: workspace,
        bytes,
        read_only,
    })
}

pub fn restore_real_workspace(snapshot: &RealWorkspaceSnapshot) -> Result<(), String> {
    assert_absolute_existing_chain_has_no_reparse(&snapshot.path)?;
    let current = fs::symlink_metadata(&snapshot.path);
    if let Ok(metadata) = &current {
        if !metadata.file_type().is_file() {
            return Err(format!(
                "refusing to restore non-file real Cavalry workspace {}",
                snapshot.path.display()
            ));
        }
    } else if let Err(error) = &current {
        if error.kind() != std::io::ErrorKind::NotFound {
            return Err(format!(
                "could not inspect real Cavalry workspace before restore {}: {error}",
                snapshot.path.display()
            ));
        }
    }

    match snapshot.bytes.as_deref() {
        Some(bytes) => {
            let target_read_only = current
                .as_ref()
                .ok()
                .map(|metadata| metadata.permissions().readonly());
            let parent = snapshot.path.parent().ok_or_else(|| {
                format!(
                    "real Cavalry workspace has no restore parent: {}",
                    snapshot.path.display()
                )
            })?;
            let temporary = parent.join(format!(
                ".workspace.json.cavalry-i18n-restore-{}.tmp",
                std::process::id()
            ));
            assert_absolute_existing_chain_has_no_reparse(&temporary)?;
            if fs::symlink_metadata(&temporary).is_ok() {
                return Err(format!(
                    "refusing to overwrite stale real workspace restore temporary {}",
                    temporary.display()
                ));
            }
            let mut file = match OpenOptions::new()
                .write(true)
                .create_new(true)
                .open(&temporary)
            {
                Ok(file) => file,
                Err(error) => {
                    return Err(format!(
                        "could not create real workspace restore temporary {}: {error}",
                        temporary.display()
                    ))
                }
            };
            let write_result = file.write_all(bytes).and_then(|_| file.sync_all());
            drop(file);
            if let Err(error) = write_result {
                let _ = fs::remove_file(&temporary);
                return Err(format!(
                    "could not flush real workspace restore temporary {}: {error}",
                    temporary.display()
                ));
            }
            if target_read_only == Some(true) {
                if let Err(error) = set_read_only(&snapshot.path, false) {
                    let _ = fs::remove_file(&temporary);
                    return Err(format!(
                        "could not make real workspace writable for atomic restore {}: {error}",
                        snapshot.path.display()
                    ));
                }
            }
            if let Err(error) = fs::rename(&temporary, &snapshot.path) {
                let _ = fs::remove_file(&temporary);
                if target_read_only == Some(true) {
                    let _ = set_read_only(&snapshot.path, true);
                }
                return Err(format!(
                    "could not atomically restore real Cavalry workspace {}: {error}",
                    snapshot.path.display()
                ));
            }
            let restored = fs::read(&snapshot.path).map_err(|error| {
                format!(
                    "could not verify restored real Cavalry workspace {}: {error}",
                    snapshot.path.display()
                )
            })?;
            if restored != bytes {
                return Err(format!(
                    "real Cavalry workspace restore did not match its preimage: {}",
                    snapshot.path.display()
                ));
            }
            if let Some(read_only) = snapshot.read_only {
                set_read_only(&snapshot.path, read_only).map_err(|error| {
                    format!(
                        "could not restore real Cavalry workspace permissions {}: {error}",
                        snapshot.path.display()
                    )
                })?;
            }
        }
        None => match current {
            Ok(_) => fs::remove_file(&snapshot.path).map_err(|error| {
                format!(
                    "could not remove test-created real Cavalry workspace {}: {error}",
                    snapshot.path.display()
                )
            })?,
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
            Err(error) => {
                return Err(format!(
                    "could not verify absent real Cavalry workspace {}: {error}",
                    snapshot.path.display()
                ))
            }
        },
    }
    Ok(())
}

pub fn verify_real_workspace_unchanged(snapshot: &RealWorkspaceSnapshot) -> Result<(), String> {
    assert_absolute_existing_chain_has_no_reparse(&snapshot.path)?;
    let metadata = fs::symlink_metadata(&snapshot.path);
    match (snapshot.bytes.as_deref(), metadata) {
        (Some(expected), Ok(metadata)) => {
            if !metadata.file_type().is_file() {
                return Err(format!(
                    "real Cavalry workspace is no longer a regular file: {}",
                    snapshot.path.display()
                ));
            }
            let actual = fs::read(&snapshot.path).map_err(|error| {
                format!(
                    "could not verify real Cavalry workspace {}: {error}",
                    snapshot.path.display()
                )
            })?;
            if actual != expected || snapshot.read_only != Some(metadata.permissions().readonly()) {
                return Err(format!(
                    "disposable Windows live gate changed the real Cavalry Active Workspace: {}",
                    snapshot.path.display()
                ));
            }
        }
        (Some(_), Err(error)) if error.kind() == std::io::ErrorKind::NotFound => {
            return Err(format!(
                "disposable Windows live gate removed the real Cavalry Active Workspace: {}",
                snapshot.path.display()
            ));
        }
        (Some(_), Err(error)) => {
            return Err(format!(
                "could not verify real Cavalry workspace {}: {error}",
                snapshot.path.display()
            ));
        }
        (None, Ok(_)) => {
            return Err(format!(
                "disposable Windows live gate created the real Cavalry Active Workspace: {}",
                snapshot.path.display()
            ));
        }
        (None, Err(error)) if error.kind() == std::io::ErrorKind::NotFound => {}
        (None, Err(error)) => {
            return Err(format!(
                "could not verify absent real Cavalry workspace {}: {error}",
                snapshot.path.display()
            ));
        }
    }
    Ok(())
}
