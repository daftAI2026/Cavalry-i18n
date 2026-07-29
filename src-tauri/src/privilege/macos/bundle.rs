/**
 * [INPUT]: 依赖 CommandRunner、macOS bundle 路径、codesign/xattr 与可回退的 administrator command。
 * [OUTPUT]: 提供嵌套代码签名、签名修复、Gatekeeper quarantine 清理。
 * [POS]: macOS apply 的提交后 bundle 收口；只接受 app bundle 内的代码对象。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
use std::{
    collections::HashSet,
    fs,
    io::Read,
    os::unix::fs::MetadataExt,
    path::{Path, PathBuf},
};

use super::super::{
    runner::{is_permission_error, shell_quote},
    CommandRunner,
};

pub(crate) fn resign_patched_bundle<R: CommandRunner>(
    app_path: &Path,
    modified_nested_code: &[PathBuf],
    runner: &mut R,
) -> Result<(), String> {
    if cfg!(not(target_os = "macos")) {
        return Ok(());
    }

    let modified_nested_code = dedupe_code_paths(app_path, modified_nested_code, false)?;
    let fast_result = (|| {
        for code_path in modified_nested_code {
            sign_code_object(&code_path, runner)?;
        }
        sign_code_object(app_path, runner)?;
        verify_signed_bundle(app_path, runner)
    })();

    if let Err(fast_error) = fast_result {
        repair_bundle_signatures(app_path, runner).map_err(|repair_error| {
            format!(
                "incremental signing or verification failed ({fast_error}); full signature repair failed: {repair_error}"
            )
        })?;
        verify_signed_bundle(app_path, runner).map_err(|repair_verify_error| {
            format!(
                "incremental signing or verification failed ({fast_error}); full signature repair did not verify: {repair_verify_error}"
            )
        })?;
    }
    Ok(())
}

pub(crate) fn ensure_bundle_signature<R: CommandRunner>(
    app_path: &Path,
    runner: &mut R,
) -> Result<(), String> {
    if cfg!(not(target_os = "macos")) {
        return Ok(());
    }
    if let Err(verify_error) = verify_signed_bundle(app_path, runner) {
        repair_bundle_signatures(app_path, runner).map_err(|repair_error| {
            format!(
                "bundle signature verification failed ({verify_error}); full signature repair failed: {repair_error}"
            )
        })?;
        verify_signed_bundle(app_path, runner).map_err(|repair_verify_error| {
            format!(
                "bundle signature verification failed ({verify_error}); full signature repair did not verify: {repair_verify_error}"
            )
        })?;
    }
    Ok(())
}

fn sign_code_object<R: CommandRunner>(target_path: &Path, runner: &mut R) -> Result<(), String> {
    run_maybe_admin(
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

fn repair_bundle_signatures<R: CommandRunner>(
    app_path: &Path,
    runner: &mut R,
) -> Result<(), String> {
    for code_path in collect_nested_code_paths(app_path)? {
        sign_code_object(&code_path, runner)?;
    }
    run_maybe_admin(
        runner,
        "codesign",
        &[
            "--force".to_string(),
            "--deep".to_string(),
            "--sign".to_string(),
            "-".to_string(),
            app_path.to_string_lossy().to_string(),
        ],
    )
}

fn dedupe_code_paths(
    app_path: &Path,
    candidates: &[PathBuf],
    macho_only: bool,
) -> Result<Vec<PathBuf>, String> {
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
        if macho_only && !is_macho_binary(&canonical) {
            continue;
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

fn collect_nested_code_paths(app_path: &Path) -> Result<Vec<PathBuf>, String> {
    let roots = [
        app_path.join("Contents").join("MacOS"),
        app_path.join("Contents").join("Frameworks"),
    ];
    let candidates = roots
        .iter()
        .flat_map(|root| walk_files(root))
        .collect::<Vec<_>>();
    dedupe_code_paths(app_path, &candidates, true)
}

fn run_maybe_admin<R: CommandRunner>(
    runner: &mut R,
    program: &str,
    args: &[String],
) -> Result<(), String> {
    match runner.run(program, args) {
        Ok(()) => Ok(()),
        Err(error) if is_permission_error(&error) && cfg!(target_os = "macos") => {
            let resolved = if program.contains('/') {
                program.to_string()
            } else {
                format!("/usr/bin/{program}")
            };
            let shell_command = std::iter::once(resolved)
                .chain(args.iter().cloned())
                .map(shell_quote)
                .collect::<Vec<_>>()
                .join(" ");
            let apple_script = [
                "on run argv",
                "  do shell script (item 1 of argv) with administrator privileges",
                "end run",
            ]
            .join("\n");
            runner.run(
                "osascript",
                &["-e".to_string(), apple_script, shell_command],
            )
        }
        Err(error) => Err(error),
    }
}

pub(crate) fn clear_gatekeeper_quarantine<R: CommandRunner>(
    app_path: &Path,
    runner: &mut R,
) -> Result<(), String> {
    if cfg!(not(target_os = "macos")) {
        return Ok(());
    }
    match run_maybe_admin(
        runner,
        "xattr",
        &[
            "-dr".to_string(),
            "com.apple.quarantine".to_string(),
            app_path.to_string_lossy().to_string(),
        ],
    ) {
        Ok(()) => Ok(()),
        Err(error)
            if error.contains("no such xattr")
                || error.contains("does not have an attribute named com.apple.quarantine") =>
        {
            Ok(())
        }
        Err(error) => Err(format!(
            "{} Run this in Terminal and try again: sudo xattr -dr com.apple.quarantine {}",
            if error.is_empty() {
                "Could not remove the macOS quarantine attribute from the patched app bundle."
            } else {
                &error
            },
            shell_quote(app_path.display())
        )),
    }
}

fn walk_files(root: &Path) -> Vec<PathBuf> {
    if !root.exists() {
        return Vec::new();
    }
    if root.is_file() {
        return vec![root.to_path_buf()];
    }
    let mut paths = Vec::new();
    let entries = match fs::read_dir(root) {
        Ok(entries) => entries,
        Err(_) => return paths,
    };
    for entry in entries.flatten() {
        let name = entry.file_name();
        if name.to_string_lossy().starts_with('.') {
            continue;
        }
        let path = entry.path();
        let kind = match entry.file_type() {
            Ok(kind) => kind,
            Err(_) => continue,
        };
        if kind.is_dir() {
            paths.extend(walk_files(&path));
        } else if kind.is_file() || (kind.is_symlink() && path.is_file()) {
            paths.push(path);
        }
    }
    paths
}

fn is_macho_binary(path: &Path) -> bool {
    if !path.is_file() {
        return false;
    }
    let mut file = match fs::File::open(path) {
        Ok(file) => file,
        Err(_) => return false,
    };
    let mut header = [0u8; 4];
    if file.read_exact(&mut header).is_err() {
        return false;
    }
    let be = u32::from_be_bytes(header);
    let le = u32::from_le_bytes(header);
    const MACHO_MAGICS: [u32; 8] = [
        0xfeedface, 0xfeedfacf, 0xcefaedfe, 0xcffaedfe, 0xcafebabe, 0xbebafeca, 0xcafebabf,
        0xbfbafeca,
    ];
    MACHO_MAGICS.contains(&be) || MACHO_MAGICS.contains(&le)
}
