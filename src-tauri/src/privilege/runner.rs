/**
 * [INPUT]: 依赖 std::process::Command、路径与环境变量类型；被权限复制、签名和重启边界注入执行器。
 * [OUTPUT]: 提供 CommandRunner、RealCommandRunner、RecordingRunner、CommandStatus 与 RecordedCommand。
 * [POS]: privilege 的进程执行适配器；业务事务只依赖此抽象，不直接构造子进程。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
use std::{ffi::OsString, path::Path, process::Command};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RecordedCommand {
    pub program: String,
    pub args: Vec<String>,
}

/// 告诉调用方已等待进程的结构化结果；非零 exit code 保留 stdout/stderr，避免把未捕获的终端输出误作诊断。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CommandStatus {
    pub exit_code: Option<i32>,
    pub stdout: String,
    pub stderr: String,
}

impl CommandStatus {
    pub(crate) fn success() -> Self {
        Self {
            exit_code: Some(0),
            stdout: String::new(),
            stderr: String::new(),
        }
    }

    pub(crate) fn diagnostic_summary(&self) -> String {
        format!(
            "Captured stdout: {} | Captured stderr: {}",
            if self.stdout.trim().is_empty() {
                "<empty>"
            } else {
                self.stdout.trim()
            },
            if self.stderr.trim().is_empty() {
                "<empty>"
            } else {
                self.stderr.trim()
            }
        )
    }
}

pub trait CommandRunner {
    fn run(&mut self, program: &str, args: &[String]) -> Result<(), String>;

    fn run_captured(&mut self, program: &str, args: &[String]) -> Result<CommandStatus, String> {
        self.run(program, args)?;
        Ok(CommandStatus::success())
    }

    fn spawn_detached(&mut self, program: &str, args: &[String]) -> Result<(), String> {
        self.run(program, args)
    }

    fn spawn_detached_in(
        &mut self,
        program: &str,
        args: &[String],
        _working_directory: &Path,
    ) -> Result<(), String> {
        self.spawn_detached(program, args)
    }

    fn spawn_detached_in_with_env(
        &mut self,
        program: &str,
        args: &[String],
        working_directory: &Path,
        environment: &[(OsString, OsString)],
    ) -> Result<(), String> {
        let _ = environment;
        self.spawn_detached_in(program, args, working_directory)
    }

    fn spawn_detached_in_with_env_and_pid(
        &mut self,
        program: &str,
        args: &[String],
        working_directory: &Path,
        environment: &[(OsString, OsString)],
    ) -> Result<Option<u32>, String> {
        self.spawn_detached_in_with_env(program, args, working_directory, environment)?;
        Ok(None)
    }
}

#[derive(Default)]
pub struct RealCommandRunner;

impl CommandRunner for RealCommandRunner {
    fn run(&mut self, program: &str, args: &[String]) -> Result<(), String> {
        let status = self.run_captured(program, args)?;
        if status.exit_code == Some(0) {
            return Ok(());
        }
        let diagnostic = if status.stderr.trim().is_empty() {
            status.stdout.trim()
        } else {
            status.stderr.trim()
        };
        if diagnostic.is_empty() {
            Err(format!(
                "{program} ended without a successful exit code: {:?}",
                status.exit_code
            ))
        } else {
            Err(diagnostic.to_string())
        }
    }

    fn run_captured(&mut self, program: &str, args: &[String]) -> Result<CommandStatus, String> {
        let output = Command::new(program)
            .args(args)
            .output()
            .map_err(|error| error.to_string())?;
        Ok(CommandStatus {
            exit_code: output.status.code(),
            stdout: String::from_utf8_lossy(&output.stdout).to_string(),
            stderr: String::from_utf8_lossy(&output.stderr).to_string(),
        })
    }

    fn spawn_detached(&mut self, program: &str, args: &[String]) -> Result<(), String> {
        Command::new(program)
            .args(args)
            .spawn()
            .map(|_| ())
            .map_err(|error| error.to_string())
    }

    fn spawn_detached_in(
        &mut self,
        program: &str,
        args: &[String],
        working_directory: &Path,
    ) -> Result<(), String> {
        Command::new(program)
            .args(args)
            .current_dir(working_directory)
            .spawn()
            .map(|_| ())
            .map_err(|error| error.to_string())
    }

    fn spawn_detached_in_with_env(
        &mut self,
        program: &str,
        args: &[String],
        working_directory: &Path,
        environment: &[(OsString, OsString)],
    ) -> Result<(), String> {
        Command::new(program)
            .args(args)
            .current_dir(working_directory)
            .envs(environment.iter().map(|(key, value)| (key, value)))
            .spawn()
            .map(|_| ())
            .map_err(|error| error.to_string())
    }

    fn spawn_detached_in_with_env_and_pid(
        &mut self,
        program: &str,
        args: &[String],
        working_directory: &Path,
        environment: &[(OsString, OsString)],
    ) -> Result<Option<u32>, String> {
        Command::new(program)
            .args(args)
            .current_dir(working_directory)
            .envs(environment.iter().map(|(key, value)| (key, value)))
            .spawn()
            .map(|child| Some(child.id()))
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

pub(crate) fn is_permission_error(detail: &str) -> bool {
    let lower = detail.to_ascii_lowercase();
    lower.contains("operation not permitted")
        || lower.contains("permission denied")
        || lower.contains("access is denied")
        || lower.contains("os error 5")
        || lower.contains("eacces")
        || lower.contains("eperm")
}

#[cfg(target_os = "macos")]
pub(crate) fn shell_quote<T: std::fmt::Display>(value: T) -> String {
    format!("'{}'", value.to_string().replace('\'', "'\\''"))
}
