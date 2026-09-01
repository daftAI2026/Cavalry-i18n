/**
 * [INPUT]: 依赖 CommandRunner、macOS bundle 路径、直接 codesign 命令与不跟随 symlink 的 native xattr 清理。
 * [OUTPUT]: 提供仅限显式修改代码对象与 app seal 的有界签名、vendor/ad-hoc requirement 证据解析、脚本入口外置签名组件清单与旧版已知残留识别、nested/app 独立只读签名复核、Gatekeeper quarantine 清理。
 * [POS]: macOS apply 的 bundle 收口；外置签名组件是旧 Switcher 脚本入口可能留下的已知副作用，只按自身路径识别并交由事务清理，不把整个 `_CodeSignature` 目录当作翻译准入证据；quarantine 不跟随 bundle 内 symlink。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
use std::{
    collections::HashSet,
    fs,
    os::unix::fs::MetadataExt,
    path::{Path, PathBuf},
};

use super::super::CommandRunner;

pub(crate) const EXTERNAL_SIGNATURE_COMPONENTS: [&str; 3] = [
    "Contents/_CodeSignature/CodeDirectory",
    "Contents/_CodeSignature/CodeSignature",
    "Contents/_CodeSignature/CodeRequirements",
];

pub(crate) fn external_signature_component_paths(app_path: &Path) -> Vec<PathBuf> {
    EXTERNAL_SIGNATURE_COMPONENTS
        .iter()
        .map(|relative| app_path.join(relative))
        .collect()
}

/// 识别旧 Switcher 可能留下的已知外置签名组件。
///
/// 这些路径是否存在与翻译兼容性无关；调用方只在已证明 stock runtime 时把它们交给
/// exact-preimage 事务删除。目录里存在其他成员不应阻止清理我们自己拥有的路径。
pub(crate) fn has_known_external_signature_residue(app_path: &Path) -> bool {
    external_signature_component_paths(app_path)
        .into_iter()
        .any(|path| {
            fs::symlink_metadata(path).is_ok_and(|metadata| {
                metadata.file_type().is_file()
                    && !metadata.file_type().is_symlink()
                    && metadata.len() > 0
            })
        })
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct BundleSignatureEvidence {
    pub(crate) team_id: Option<String>,
    pub(crate) designated_requirement: Option<String>,
    pub(crate) cdhash: Option<String>,
}

impl BundleSignatureEvidence {
    /// 当前 seal 可读且拥有稳定 requirement/CDHash 即足以作为可恢复 preimage。
    /// Team ID 只决定是否展示“官方”，不决定第三方翻译工具能否工作。
    pub(crate) fn is_recoverable_identity(&self) -> bool {
        self.designated_requirement
            .as_deref()
            .is_some_and(|value| !value.trim().is_empty())
            && self
                .cdhash
                .as_deref()
                .is_some_and(|value| !value.trim().is_empty())
    }

    pub(crate) fn is_complete_vendor_identity(&self) -> bool {
        self.team_id
            .as_deref()
            .is_some_and(|value| !value.trim().is_empty())
            && self.is_recoverable_identity()
    }

    pub(crate) fn is_supported_cavalry_vendor_identity(&self) -> bool {
        self.is_complete_vendor_identity()
            && self.team_id.as_deref() == Some(crate::detect::SUPPORTED_CAVALRY_TEAM_ID)
            && self
                .designated_requirement
                .as_deref()
                .is_some_and(|requirement| {
                    requirement.contains("anchor apple generic")
                        && requirement.contains("identifier \"com.scenegroup.cavalry\"")
                })
    }

    pub(crate) fn is_managed_ad_hoc_identity(&self) -> bool {
        self.team_id.is_none()
            && self
                .designated_requirement
                .as_deref()
                .is_some_and(|value| !value.trim().is_empty())
            && self
                .cdhash
                .as_deref()
                .is_some_and(|value| !value.trim().is_empty())
    }
}

pub(crate) fn inspect_bundle_signature<R: CommandRunner>(
    app_path: &Path,
    runner: &mut R,
) -> Result<BundleSignatureEvidence, String> {
    if cfg!(not(target_os = "macos")) {
        return Ok(BundleSignatureEvidence {
            team_id: None,
            designated_requirement: None,
            cdhash: None,
        });
    }
    let path = app_path.to_string_lossy().to_string();
    let verification = runner.run_captured(
        "codesign",
        &[
            "--verify".to_string(),
            "--deep".to_string(),
            "--strict".to_string(),
            path.clone(),
        ],
    )?;
    if verification.exit_code != Some(0) {
        return Err(format!(
            "Cavalry bundle signature verification failed. {}",
            verification.diagnostic_summary()
        ));
    }
    let details = runner.run_captured(
        "codesign",
        &["-dv".to_string(), "--verbose=4".to_string(), path.clone()],
    )?;
    if details.exit_code != Some(0) {
        return Err(format!(
            "Could not inspect Cavalry signature identity. {}",
            details.diagnostic_summary()
        ));
    }
    let requirement =
        runner.run_captured("codesign", &["-dr".to_string(), "-".to_string(), path])?;
    if requirement.exit_code != Some(0) {
        return Err(format!(
            "Could not inspect Cavalry designated requirement. {}",
            requirement.diagnostic_summary()
        ));
    }
    let detail_text = format!("{}\n{}", details.stdout, details.stderr);
    let requirement_text = format!("{}\n{}", requirement.stdout, requirement.stderr);
    Ok(BundleSignatureEvidence {
        team_id: signature_field(&detail_text, "TeamIdentifier").filter(|value| value != "not set"),
        designated_requirement: requirement_text
            .lines()
            .find_map(designated_requirement)
            .filter(|value| !value.trim().is_empty())
            .map(str::to_string),
        cdhash: signature_field(&detail_text, "CDHash"),
    })
}

fn designated_requirement(line: &str) -> Option<&str> {
    let line = line.trim();
    let line = line.strip_prefix("# ").unwrap_or(line);
    line.strip_prefix("designated => ")
}

fn signature_field(contents: &str, field: &str) -> Option<String> {
    let prefix = format!("{field}=");
    contents
        .lines()
        .find_map(|line| line.trim().strip_prefix(&prefix))
        .filter(|value| !value.trim().is_empty())
        .map(str::to_string)
}

pub(crate) fn resign_patched_bundle<R: CommandRunner>(
    app_path: &Path,
    modified_nested_code: &[PathBuf],
    runner: &mut R,
) -> Result<(), String> {
    if cfg!(not(target_os = "macos")) {
        return Ok(());
    }

    sign_modified_nested_code(app_path, modified_nested_code, runner)?;
    seal_patched_bundle(app_path, runner)
}

pub(crate) fn sign_modified_nested_code<R: CommandRunner>(
    app_path: &Path,
    modified_nested_code: &[PathBuf],
    runner: &mut R,
) -> Result<(), String> {
    if cfg!(not(target_os = "macos")) {
        return Ok(());
    }
    for code_path in dedupe_code_paths(app_path, modified_nested_code)? {
        sign_code_object(&code_path, runner)?;
        verify_code_object(&code_path, runner)?;
    }
    Ok(())
}

pub(crate) fn verify_modified_nested_code<R: CommandRunner>(
    app_path: &Path,
    modified_nested_code: &[PathBuf],
    runner: &mut R,
) -> Result<(), String> {
    if cfg!(not(target_os = "macos")) {
        return Ok(());
    }
    for code_path in dedupe_code_paths(app_path, modified_nested_code)? {
        verify_code_object(&code_path, runner)?;
    }
    Ok(())
}

pub(crate) fn seal_patched_bundle<R: CommandRunner>(
    app_path: &Path,
    runner: &mut R,
) -> Result<(), String> {
    if cfg!(not(target_os = "macos")) {
        return Ok(());
    }
    sign_code_object(app_path, runner)?;
    verify_signed_bundle(app_path, runner)
}

pub(crate) fn ensure_bundle_signature<R: CommandRunner>(
    app_path: &Path,
    runner: &mut R,
) -> Result<(), String> {
    if cfg!(not(target_os = "macos")) {
        return Ok(());
    }
    verify_signed_bundle(app_path, runner)
}

fn sign_code_object<R: CommandRunner>(target_path: &Path, runner: &mut R) -> Result<(), String> {
    run_direct_bundle_command(
        runner,
        "codesign",
        &[
            "--force".to_string(),
            "--sign".to_string(),
            "-".to_string(),
            target_path.to_string_lossy().to_string(),
        ],
    )
}

fn verify_signed_bundle<R: CommandRunner>(app_path: &Path, runner: &mut R) -> Result<(), String> {
    runner.run(
        "codesign",
        &[
            "--verify".to_string(),
            "--deep".to_string(),
            "--strict".to_string(),
            app_path.to_string_lossy().to_string(),
        ],
    )
}

fn verify_code_object<R: CommandRunner>(path: &Path, runner: &mut R) -> Result<(), String> {
    runner.run(
        "codesign",
        &[
            "--verify".to_string(),
            "--strict".to_string(),
            path.to_string_lossy().to_string(),
        ],
    )
}

fn dedupe_code_paths(app_path: &Path, candidates: &[PathBuf]) -> Result<Vec<PathBuf>, String> {
    let canonical_app = fs::canonicalize(app_path).map_err(|error| {
        format!(
            "Could not resolve app bundle {} before signing: {error}",
            app_path.display()
        )
    })?;
    let mut canonical_seen = HashSet::new();
    #[cfg(unix)]
    let mut inode_seen = HashSet::new();
    let mut paths = Vec::new();
    let mut candidates = candidates.to_vec();
    candidates.sort();

    for candidate in &candidates {
        let canonical = fs::canonicalize(candidate).map_err(|error| {
            format!(
                "Could not resolve modified code object {}: {error}",
                candidate.display()
            )
        })?;
        if !canonical.starts_with(&canonical_app) {
            return Err(format!(
                "Refusing to sign code object outside {}: {}",
                app_path.display(),
                candidate.display()
            ));
        }
        if !canonical_seen.insert(canonical.clone()) {
            continue;
        }
        #[cfg(unix)]
        {
            let metadata = fs::metadata(&canonical).map_err(|error| error.to_string())?;
            if !inode_seen.insert((metadata.dev(), metadata.ino())) {
                continue;
            }
        }
        paths.push(canonical);
    }

    paths.sort_by(code_sign_order);
    Ok(paths)
}

fn code_sign_order(left: &PathBuf, right: &PathBuf) -> std::cmp::Ordering {
    let left_crashpad = left
        .file_name()
        .is_some_and(|name| name == "crashpad_handler");
    let right_crashpad = right
        .file_name()
        .is_some_and(|name| name == "crashpad_handler");
    if left_crashpad != right_crashpad {
        return right_crashpad.cmp(&left_crashpad);
    }
    right
        .to_string_lossy()
        .len()
        .cmp(&left.to_string_lossy().len())
}

fn run_direct_bundle_command<R: CommandRunner>(
    runner: &mut R,
    program: &str,
    args: &[String],
) -> Result<(), String> {
    runner.run(program, args)
}

#[cfg(test)]
mod tests {
    use super::{
        designated_requirement, has_known_external_signature_residue, EXTERNAL_SIGNATURE_COMPONENTS,
    };
    use std::fs;

    fn write(path: &std::path::Path, bytes: &[u8]) {
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::write(path, bytes).unwrap();
    }

    #[test]
    fn designated_requirement_accepts_vendor_and_codesign_ad_hoc_output() {
        assert_eq!(
            designated_requirement(
                "designated => anchor apple generic and identifier \"com.scenegroup.cavalry\""
            ),
            Some("anchor apple generic and identifier \"com.scenegroup.cavalry\"")
        );
        assert_eq!(
            designated_requirement("# designated => cdhash H\"0123456789abcdef\""),
            Some("cdhash H\"0123456789abcdef\"")
        );
        assert_eq!(designated_requirement("Executable=/tmp/Cavalry"), None);
    }

    #[test]
    fn legacy_external_signature_residue_is_owned_path_based_not_directory_wide() {
        let temp = tempfile::tempdir().unwrap();
        let app = temp.path().join("Cavalry.app");
        write(
            &app.join("Contents/_CodeSignature/CodeResources"),
            b"vendor resources",
        );
        for relative in EXTERNAL_SIGNATURE_COMPONENTS {
            write(&app.join(relative), b"external component");
        }
        assert!(has_known_external_signature_residue(&app));

        write(&app.join("Contents/_CodeSignature/Unexpected"), b"unknown");
        assert!(has_known_external_signature_residue(&app));

        for component in EXTERNAL_SIGNATURE_COMPONENTS {
            fs::remove_file(app.join(component)).unwrap();
        }
        assert!(!has_known_external_signature_residue(&app));
    }
}

pub(crate) fn clear_gatekeeper_quarantine<R: CommandRunner>(
    app_path: &Path,
    _runner: &mut R,
) -> Result<(), String> {
    super::apply_transaction::clear_quarantine_tree(app_path)
}
