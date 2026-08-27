/**
 * [INPUT]: 依赖 Windows live disposable clone/evidence 的路径守卫，以及安装布局中的关键登录窗口资源
 * [OUTPUT]: 提供 disposable clone 关键资源完整性证明和资源字节哈希 evidence；不读取或写入真实用户 profile
 * [POS]: Windows live smoke 的 clone 资源安全边界；FullSurfaces、Onboarding、Adjacent 共用，真实 Cavalry 用户目录不在职责范围内
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
use super::windows_disposable::GuardedTempRoot;
use cavalry_i18n_tauri::install::InstallLayout;
use sha2::{Digest, Sha256};
use std::{
    fs::{self, OpenOptions},
    io::Write,
    path::Path,
};

const CLONE_RESOURCE_GUARD_FILE: &str = "live-clone-resources.json";
const REQUIRED_LIVE_CLONE_RESOURCES: [&str; 3] = [
    "assets/Icons/sign-in-bg.png",
    "assets/Icons/cavByCanva.png",
    "assets/Icons/tool_search.png",
];

fn write_new_json(path: &Path, value: &serde_json::Value, label: &str) -> Result<(), String> {
    let payload = serde_json::to_vec_pretty(value)
        .map_err(|error| format!("could not serialize {label}: {error}"))?;
    let mut file = OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(path)
        .map_err(|error| format!("could not create {label} {}: {error}", path.display()))?;
    file.write_all(&payload)
        .and_then(|_| file.write_all(b"\n"))
        .and_then(|_| file.sync_all())
        .map_err(|error| format!("could not flush {label} {}: {error}", path.display()))
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
        if !metadata.file_type().is_file()
            || metadata.file_type().is_symlink()
            || metadata.len() == 0
        {
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
