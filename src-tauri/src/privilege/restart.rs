/**
 * [INPUT]: 依赖 InstallLayout、CommandRunner、平台运行环境以及 Windows hash-safe PowerShell 编码。
 * [OUTPUT]: 提供 restart_commands、写入前 graceful close、带 cwd/env/PID 的 Cavalry 重启。
 * [POS]: privilege 的跨平台重启适配器；Windows 只关闭精确 executable path 的主窗口，绝不强杀。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
use std::{ffi::OsString, path::Path};

#[cfg(target_os = "windows")]
use super::windows::manifest::encode_powershell_command;
use super::{CommandRunner, RecordedCommand};
use crate::install::InstallLayout;

pub fn restart_commands(app_path: &Path) -> Vec<RecordedCommand> {
    #[cfg(target_os = "macos")]
    {
        let app_name = app_path
            .file_stem()
            .map(|value| value.to_string_lossy().to_string())
            .unwrap_or_else(|| "Cavalry".to_string());
        return vec![
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
        ];
    }

    #[cfg(target_os = "windows")]
    {
        let layout = InstallLayout::from_root(app_path);
        return vec![
            windows_close_command(&layout.executable),
            RecordedCommand {
                program: layout.executable.to_string_lossy().to_string(),
                args: Vec::new(),
            },
        ];
    }

    #[allow(unreachable_code)]
    Vec::new()
}

#[cfg(target_os = "windows")]
const WINDOWS_GRACEFUL_CLOSE_TIMEOUT_SECONDS: u64 = 15;

#[cfg(target_os = "windows")]
fn windows_graceful_close_script(executable: &Path) -> String {
    // 将路径编码为 UTF-16 Base64 数据，避免安装路径进入 PowerShell 语法。
    let encoded_target = encode_powershell_command(&executable.to_string_lossy());
    format!(
        r#"
$target = [System.Text.Encoding]::Unicode.GetString([System.Convert]::FromBase64String('{encoded_target}'))
try {{
  $target = [System.IO.Path]::GetFullPath($target)
}} catch {{
  [Console]::Error.WriteLine("Could not normalize the selected Cavalry executable path.")
  exit 1
}}
$matchingProcesses = @(
  Get-CimInstance Win32_Process -Filter "Name='Cavalry.exe'" -ErrorAction SilentlyContinue |
    Where-Object {{
      try {{
        $_.ExecutablePath -and [System.String]::Equals(
          [System.IO.Path]::GetFullPath([string]$_.ExecutablePath),
          $target,
          [System.StringComparison]::OrdinalIgnoreCase
        )
      }} catch {{
        $false
      }}
    }}
)
if ($matchingProcesses.Count -eq 0) {{
  exit 0
}}

$closedProcessIds = New-Object 'System.Collections.Generic.List[int]'
foreach ($candidate in $matchingProcesses) {{
  try {{
    $process = Get-Process -Id ([int]$candidate.ProcessId) -ErrorAction Stop
  }} catch {{
    [Console]::Error.WriteLine("Could not obtain the selected Cavalry process $($candidate.ProcessId) for a graceful close: $($_.Exception.Message)")
    exit 1
  }}
  if (-not $process.CloseMainWindow()) {{
    [Console]::Error.WriteLine("Cavalry process $($process.Id) did not accept a graceful window-close request. Close it manually and try again.")
    exit 1
  }}
  [void]$closedProcessIds.Add([int]$process.Id)
}}

$deadline = [DateTime]::UtcNow.AddSeconds({WINDOWS_GRACEFUL_CLOSE_TIMEOUT_SECONDS})
while ($true) {{
  $remaining = @(
    foreach ($processId in $closedProcessIds) {{
      Get-Process -Id $processId -ErrorAction SilentlyContinue
    }}
  )
  if ($remaining.Count -eq 0) {{
    exit 0
  }}
  if ([DateTime]::UtcNow -ge $deadline) {{
    [Console]::Error.WriteLine("Cavalry did not exit gracefully within {WINDOWS_GRACEFUL_CLOSE_TIMEOUT_SECONDS} seconds. Close it manually and try again.")
    exit 1
  }}
  Start-Sleep -Milliseconds 100
}}
"#
    )
}

#[cfg(target_os = "windows")]
fn windows_close_command(executable: &Path) -> RecordedCommand {
    let script = windows_graceful_close_script(executable);
    RecordedCommand {
        program: "powershell.exe".to_string(),
        args: vec![
            "-NoLogo".to_string(),
            "-NoProfile".to_string(),
            "-NonInteractive".to_string(),
            "-EncodedCommand".to_string(),
            encode_powershell_command(&script),
        ],
    }
}

pub fn open_privacy_security<R: CommandRunner>(runner: &mut R) -> Result<(), String> {
    #[cfg(not(target_os = "macos"))]
    {
        let _ = runner;
        return Ok(());
    }
    #[cfg(target_os = "macos")]
    {
        runner.spawn_detached(
            "open",
            &[
                "x-apple.systempreferences:com.apple.preference.security?Privacy_AppBundles"
                    .to_string(),
            ],
        )
    }
}

pub fn restart_cavalry<R: CommandRunner>(app_path: &Path, runner: &mut R) -> Result<(), String> {
    restart_cavalry_with_environment(app_path, &[], runner)
}

/// Windows 在修改 qwindows/JSON 前只关闭所选安装根的 Cavalry，并等待其自然退出；普通关闭不会恢复任何 DLL。
pub fn close_cavalry_before_modification<R: CommandRunner>(
    app_path: &Path,
    runner: &mut R,
) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let layout = InstallLayout::from_root(app_path);
        if layout.platform == crate::install::InstallPlatform::Windows {
            let command = windows_close_command(&layout.executable);
            return runner.run(&command.program, &command.args);
        }
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = (app_path, runner);
    }
    Ok(())
}

pub fn restart_cavalry_with_environment<R: CommandRunner>(
    app_path: &Path,
    environment: &[(OsString, OsString)],
    runner: &mut R,
) -> Result<(), String> {
    restart_cavalry_with_environment_inner(app_path, environment, runner).map(|_| ())
}

pub fn restart_cavalry_with_environment_and_pid<R: CommandRunner>(
    app_path: &Path,
    environment: &[(OsString, OsString)],
    runner: &mut R,
) -> Result<u32, String> {
    restart_cavalry_with_environment_inner(app_path, environment, runner)?.ok_or_else(|| {
        "Windows restart runner did not report the spawned Cavalry process id.".to_string()
    })
}

fn restart_cavalry_with_environment_inner<R: CommandRunner>(
    app_path: &Path,
    environment: &[(OsString, OsString)],
    runner: &mut R,
) -> Result<Option<u32>, String> {
    let commands = restart_commands(app_path);
    #[cfg(target_os = "macos")]
    {
        let _ = environment;
        runner.run(&commands[0].program, &commands[0].args)?;
        runner.spawn_detached(&commands[1].program, &commands[1].args)?;
        return Ok(None);
    }
    #[cfg(target_os = "windows")]
    {
        let layout = InstallLayout::from_root(app_path);
        runner.run(&commands[0].program, &commands[0].args)?;
        return runner.spawn_detached_in_with_env_and_pid(
            &commands[1].program,
            &commands[1].args,
            &layout.root,
            environment,
        );
    }
    #[allow(unreachable_code)]
    {
        let _ = environment;
        Err("Restart is not supported on this platform.".to_string())
    }
}
