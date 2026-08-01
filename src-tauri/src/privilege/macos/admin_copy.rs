/**
 * [INPUT]: 依赖 CopyPair、CommandRunner 与 shell_quote/is_permission_error。
 * [OUTPUT]: 提供 macOS administrator shell copy 与受限 Finder fallback。
 * [POS]: macOS 权限复制适配器；仅在 direct copy 明确权限失败后由事务层调用。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
use std::{fs, io::Write, path::Path};

use crate::patch::CopyPair;

use super::super::{
    copy_transaction::{CopyCompletion, CopyFailure},
    runner::{is_permission_error, shell_quote},
    CommandRunner,
};

pub(crate) fn run_admin_copy<R: CommandRunner>(
    pairs: &[CopyPair],
    runner: &mut R,
) -> Result<CopyCompletion, CopyFailure> {
    let script_path = std::env::temp_dir().join(format!(
        "cavalry-i18n-copy-{}-{}.sh",
        std::process::id(),
        chrono::Utc::now().timestamp_millis()
    ));
    write_copy_script(pairs, &script_path).map_err(CopyFailure::other)?;
    let apple_script = [
        "on run argv",
        "  set scriptPath to item 1 of argv",
        "  do shell script \"sh \" & quoted form of scriptPath with administrator privileges",
        "end run",
    ]
    .join("\n");
    let result = runner.run(
        "osascript",
        &[
            "-e".to_string(),
            apple_script,
            script_path.to_string_lossy().to_string(),
        ],
    );
    let _ = fs::remove_file(&script_path);

    match result {
        Ok(()) => Ok(CopyCompletion::new("shell")),
        Err(error) if should_retry_with_finder(&error, pairs) => {
            run_finder_fallback(pairs, runner).map_err(CopyFailure::other)?;
            Ok(CopyCompletion::new("finder"))
        }
        Err(error) => Err(CopyFailure::other(if error.is_empty() {
            "Administrator copy failed.".to_string()
        } else {
            error
        })),
    }
}

fn write_copy_script(pairs: &[CopyPair], script_path: &Path) -> Result<(), String> {
    let mut file = fs::File::create(script_path).map_err(|error| error.to_string())?;
    writeln!(file, "#!/bin/sh").map_err(|error| error.to_string())?;
    writeln!(file, "set -eu").map_err(|error| error.to_string())?;
    for pair in pairs {
        writeln!(
            file,
            "mkdir -p {}",
            shell_quote(
                pair.dst
                    .parent()
                    .unwrap_or_else(|| Path::new("/"))
                    .display()
            )
        )
        .map_err(|error| error.to_string())?;
        writeln!(
            file,
            "cp {} {}",
            shell_quote(pair.src.display()),
            shell_quote(pair.dst.display())
        )
        .map_err(|error| error.to_string())?;
        writeln!(
            file,
            "chmod \"$(stat -f %Lp {})\" {}",
            shell_quote(pair.src.display()),
            shell_quote(pair.dst.display())
        )
        .map_err(|error| error.to_string())?;
    }
    Ok(())
}

fn run_finder_fallback<R: CommandRunner>(pairs: &[CopyPair], runner: &mut R) -> Result<(), String> {
    let apple_script = [
        "on run argv",
        "  tell application \"Finder\"",
        "    set argCount to count of argv",
        "    repeat with i from 1 to argCount by 2",
        "      set srcPath to item i of argv",
        "      set dstPath to item (i + 1) of argv",
        "      set dstFolderPath to do shell script \"dirname \" & quoted form of dstPath",
        "      set dstFileName to do shell script \"basename \" & quoted form of dstPath",
        "      set destinationFolder to POSIX file dstFolderPath as alias",
        "      if exists file dstFileName of destinationFolder then",
        "        delete file dstFileName of destinationFolder",
        "      end if",
        "      set duplicatedItem to duplicate (POSIX file srcPath as alias) to destinationFolder",
        "      if class of duplicatedItem is list then",
        "        set duplicatedItem to item 1 of duplicatedItem",
        "      end if",
        "      set name of duplicatedItem to dstFileName",
        "    end repeat",
        "  end tell",
        "end run",
    ]
    .join("\n");
    let mut args = vec!["-e".to_string(), apple_script];
    for pair in pairs {
        args.push(pair.src.to_string_lossy().to_string());
        args.push(pair.dst.to_string_lossy().to_string());
    }
    runner.run("osascript", &args)
}

fn should_retry_with_finder(detail: &str, pairs: &[CopyPair]) -> bool {
    is_permission_error(detail)
        && pairs.iter().any(|pair| {
            let dst = pair.dst.to_string_lossy();
            dst.starts_with("/Applications/") && dst.contains(".app/")
        })
}
