/**
 * [INPUT]: 依赖 CommandRunner、macOS bundle 路径、直接 codesign 命令与不跟随 symlink 的 native xattr 清理。
 * [OUTPUT]: 提供仅限显式修改代码对象与 app seal 的有界签名、vendor/ad-hoc requirement 证据解析、nested/app 独立只读签名复核、Gatekeeper quarantine 清理。
 * [POS]: macOS apply 的 bundle 收口；禁止 `--deep` 重签任意 vendor nested code，quarantine 不跟随 bundle 内 symlink，任一失败交由外层 exact-preimage 事务回滚。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
use std::{
    collections::HashSet,
    fs,
    os::unix::fs::MetadataExt,
    path::{Path, PathBuf},
};

use super::super::CommandRunner;

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct BundleSignatureEvidence {
    pub(crate) team_id: Option<String>,
    pub(crate) designated_requirement: Option<String>,
    pub(crate) cdhash: Option<String>,
}

impl BundleSignatureEvidence {
    pub(crate) fn is_complete_vendor_identity(&self) -> bool {
        [
            self.team_id.as_deref(),
            self.designated_requirement.as_deref(),
            self.cdhash.as_deref(),
        ]
        .into_iter()
        .all(|value| value.is_some_and(|value| !value.trim().is_empty()))
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
    use super::designated_requirement;

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
}

pub(crate) fn clear_gatekeeper_quarantine<R: CommandRunner>(
    app_path: &Path,
    _runner: &mut R,
) -> Result<(), String> {
    super::apply_transaction::clear_quarantine_tree(app_path)
}
