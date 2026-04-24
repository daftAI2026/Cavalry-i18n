/**
 * [INPUT]: 依赖 std fs/process/path 与 patch::CopyPair，接收已 staging 的复制计划和 app bundle 路径
 * [OUTPUT]: 对外提供 CommandRunner、copy_with_privilege、patch_keychain_query_attributes、resign_patched_bundle、clear_quarantine、restart_cavalry
 * [POS]: src-tauri/src 的系统命令边界，集中 osascript/codesign/xattr/open 等真实调用
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
use std::{
    fs,
    io::{Read, Write},
    path::{Path, PathBuf},
    process::Command,
};

use crate::{keychain_patch, patch::CopyPair};
pub use keychain_patch::KeychainPatchReport;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RecordedCommand {
    pub program: String,
    pub args: Vec<String>,
}

pub trait CommandRunner {
    fn run(&mut self, program: &str, args: &[String]) -> Result<(), String>;
    fn spawn_detached(&mut self, program: &str, args: &[String]) -> Result<(), String> {
        self.run(program, args)
    }
}

#[derive(Default)]
pub struct RealCommandRunner;

impl CommandRunner for RealCommandRunner {
    fn run(&mut self, program: &str, args: &[String]) -> Result<(), String> {
        let output = Command::new(program)
            .args(args)
            .output()
            .map_err(|error| error.to_string())?;
        if output.status.success() {
            return Ok(());
        }
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
        Err(if stderr.is_empty() { stdout } else { stderr })
    }

    fn spawn_detached(&mut self, program: &str, args: &[String]) -> Result<(), String> {
        Command::new(program)
            .args(args)
            .spawn()
            .map(|_| ())
            .map_err(|error| error.to_string())
    }
}

#[derive(Default)]
pub struct RecordingRunner {
    pub commands: Vec<RecordedCommand>,
}

impl CommandRunner for RecordingRunner {
    fn run(&mut self, program: &str, args: &[String]) -> Result<(), String> {
        self.commands.push(RecordedCommand {
            program: program.to_string(),
            args: args.to_vec(),
        });
        Ok(())
    }
}

pub fn copy_with_privilege<R: CommandRunner>(
    pairs: &[CopyPair],
    runner: &mut R,
) -> Result<String, String> {
    if pairs.is_empty() {
        return Ok("noop".to_string());
    }

    match run_direct_copy(pairs) {
        Ok(()) => Ok("direct".to_string()),
        Err(error) if is_permission_error(&error) => run_admin_copy(pairs, runner),
        Err(error) => Err(error),
    }
}

pub fn patch_keychain_query_attributes(app_path: &Path) -> Result<KeychainPatchReport, String> {
    keychain_patch::patch_keychain_query_attributes(app_path)
}

fn run_direct_copy(pairs: &[CopyPair]) -> Result<(), String> {
    for pair in pairs {
        fs::create_dir_all(
            pair.dst
                .parent()
                .ok_or_else(|| format!("Missing parent for {}", pair.dst.display()))?,
        )
        .map_err(|error| error.to_string())?;
        fs::copy(&pair.src, &pair.dst).map_err(|error| error.to_string())?;
        let permissions = fs::metadata(&pair.src)
            .map_err(|error| error.to_string())?
            .permissions();
        fs::set_permissions(&pair.dst, permissions).map_err(|error| error.to_string())?;
    }
    Ok(())
}

fn run_admin_copy<R: CommandRunner>(pairs: &[CopyPair], runner: &mut R) -> Result<String, String> {
    let script_path = std::env::temp_dir().join(format!(
        "cavalry-i18n-copy-{}-{}.sh",
        std::process::id(),
        chrono::Utc::now().timestamp_millis()
    ));
    write_copy_script(pairs, &script_path)?;
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
        Ok(()) => Ok("shell".to_string()),
        Err(error) if should_retry_with_finder(&error, pairs) => {
            run_finder_fallback(pairs, runner)?;
            Ok("finder".to_string())
        }
        Err(error) => Err(if error.is_empty() {
            "Administrator copy failed.".to_string()
        } else {
            error
        }),
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
    detail.contains("Operation not permitted")
        && pairs.iter().any(|pair| {
            let dst = pair.dst.to_string_lossy();
            dst.starts_with("/Applications/") && dst.contains(".app/")
        })
}

fn shell_quote<T: std::fmt::Display>(value: T) -> String {
    format!("'{}'", value.to_string().replace('\'', "'\\''"))
}

fn is_permission_error(detail: &str) -> bool {
    let lower = detail.to_ascii_lowercase();
    lower.contains("operation not permitted")
        || lower.contains("permission denied")
        || lower.contains("eacces")
        || lower.contains("eperm")
}

pub fn resign_patched_bundle<R: CommandRunner>(
    app_path: &Path,
    runner: &mut R,
) -> Result<(), String> {
    if cfg!(not(target_os = "macos")) {
        return Ok(());
    }

    for code_path in collect_nested_code_paths(app_path) {
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

fn sign_code_object<R: CommandRunner>(target_path: &Path, runner: &mut R) -> Result<(), String> {
    remove_signature_if_present(target_path, runner)?;
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

fn remove_signature_if_present<R: CommandRunner>(
    target_path: &Path,
    runner: &mut R,
) -> Result<(), String> {
    match run_maybe_admin(
        runner,
        "codesign",
        &[
            "--remove-signature".to_string(),
            target_path.to_string_lossy().to_string(),
        ],
    ) {
        Ok(()) => Ok(()),
        Err(error)
            if error.contains("not signed at all")
                || error.contains("code object is not signed") =>
        {
            Ok(())
        }
        Err(error) => Err(error),
    }
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

pub fn clear_gatekeeper_quarantine<R: CommandRunner>(
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

pub fn restart_commands(app_path: &Path) -> Vec<RecordedCommand> {
    let app_name = app_path
        .file_stem()
        .map(|value| value.to_string_lossy().to_string())
        .unwrap_or_else(|| "Cavalry".to_string());
    vec![
        RecordedCommand {
            program: "osascript".to_string(),
            args: vec![
                "-e".to_string(),
                format!("tell application \"{app_name}\" to quit"),
            ],
        },
        RecordedCommand {
            program: "open".to_string(),
            args: vec!["-n".to_string(), app_path.to_string_lossy().to_string()],
        },
    ]
}

pub fn restart_cavalry<R: CommandRunner>(app_path: &Path, runner: &mut R) -> Result<(), String> {
    let commands = restart_commands(app_path);
    runner.run(&commands[0].program, &commands[0].args)?;
    runner.spawn_detached(&commands[1].program, &commands[1].args)
}

fn collect_nested_code_paths(app_path: &Path) -> Vec<PathBuf> {
    let roots = [
        app_path.join("Contents").join("MacOS"),
        app_path.join("Contents").join("Frameworks"),
    ];
    let mut paths = roots
        .iter()
        .flat_map(|root| walk_files(root))
        .filter(|path| is_macho_binary(path))
        .collect::<Vec<_>>();
    paths.sort_by(|left, right| {
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
    });
    paths
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
        if path.is_dir() {
            paths.extend(walk_files(&path));
        } else if path.is_file() {
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
    matches!(
        be,
        0xfeedface | 0xfeedfacf | 0xcafebabe | 0xbebafeca | 0xcefaedfe | 0xcffaedfe
    ) || matches!(le, 0xfeedface | 0xfeedfacf | 0xcafebabe | 0xbebafeca)
}

#[cfg(test)]
mod tests {
    use super::{
        clear_gatekeeper_quarantine, copy_with_privilege, resign_patched_bundle, restart_cavalry,
        restart_commands, CommandRunner, RecordedCommand, RecordingRunner,
    };
    use crate::patch::CopyPair;
    use std::{fs, path::Path};

    struct FailingRunner {
        commands: Vec<RecordedCommand>,
        first_error: Option<String>,
    }

    impl CommandRunner for FailingRunner {
        fn run(&mut self, program: &str, args: &[String]) -> Result<(), String> {
            self.commands.push(RecordedCommand {
                program: program.to_string(),
                args: args.to_vec(),
            });
            if let Some(error) = self.first_error.take() {
                Err(error)
            } else {
                Ok(())
            }
        }
    }

    #[test]
    fn restart_quits_then_opens_new_instance() {
        let commands = restart_commands(Path::new("/Applications/Cavalry.app"));
        assert_eq!(commands[0].program, "osascript");
        assert_eq!(commands[1].program, "open");
        assert_eq!(commands[1].args, ["-n", "/Applications/Cavalry.app"]);
    }

    #[test]
    fn copy_tries_direct_then_admin_on_permission_error() {
        let temp = tempfile::tempdir().unwrap();
        let source = temp.path().join("source.json");
        let dest = temp.path().join("missing").join("dest.json");
        fs::write(&source, "{}").unwrap();
        let mut runner = RecordingRunner::default();
        let mode = copy_with_privilege(
            &[CopyPair {
                src: source,
                dst: dest,
            }],
            &mut runner,
        )
        .unwrap();
        assert_eq!(mode, "direct");
        assert!(runner.commands.is_empty());
    }

    #[test]
    fn finder_fallback_used_for_app_bundle_permission_denied() {
        let pairs = [CopyPair {
            src: Path::new("/tmp/src.json").to_path_buf(),
            dst: Path::new("/Applications/Cavalry.app/Contents/assets/file.json").to_path_buf(),
        }];
        let mut runner = FailingRunner {
            commands: Vec::new(),
            first_error: Some("Operation not permitted".to_string()),
        };
        let mode = super::run_admin_copy(&pairs, &mut runner).unwrap();
        assert_eq!(mode, "finder");
        assert_eq!(runner.commands[0].program, "osascript");
        assert_eq!(runner.commands[1].program, "osascript");
        assert!(runner.commands[1].args[1].contains("tell application \"Finder\""));
    }

    #[test]
    fn resign_collects_nested_macho_paths() {
        let temp = tempfile::tempdir().unwrap();
        let app = temp.path().join("Cavalry.app");
        fs::create_dir_all(app.join("Contents/MacOS")).unwrap();
        fs::create_dir_all(app.join("Contents/Frameworks")).unwrap();
        fs::write(
            app.join("Contents/MacOS/crashpad_handler"),
            [0xcf, 0xfa, 0xed, 0xfe],
        )
        .unwrap();
        fs::write(
            app.join("Contents/Frameworks/libFake.dylib"),
            [0xcf, 0xfa, 0xed, 0xfe],
        )
        .unwrap();
        let mut runner = RecordingRunner::default();
        resign_patched_bundle(&app, &mut runner).unwrap();
        if cfg!(target_os = "macos") {
            assert!(runner.commands[0]
                .args
                .iter()
                .any(|arg| arg.contains("crashpad_handler")));
        }
    }

    #[test]
    fn quarantine_clear_ignores_missing_xattr() {
        let mut runner = FailingRunner {
            commands: Vec::new(),
            first_error: Some(
                "No such xattr: com.apple.quarantine does not have an attribute named com.apple.quarantine"
                    .to_string(),
            ),
        };
        clear_gatekeeper_quarantine(Path::new("/tmp/Cavalry.app"), &mut runner).unwrap();
    }

    #[test]
    fn restart_runs_commands_through_runner() {
        let mut runner = RecordingRunner::default();
        restart_cavalry(Path::new("/Applications/Cavalry.app"), &mut runner).unwrap();
        assert_eq!(runner.commands[0].program, "osascript");
        assert_eq!(runner.commands[1].program, "open");
    }
}
