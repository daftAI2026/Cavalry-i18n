/**
 * [INPUT]: 依赖调用方提供的绝对 current_exe 与不含路径的 ASCII transport token，依赖 Win32 Shell/Threading API。
 * [OUTPUT]: 提供 same-EXE RunAs 启动、UAC 取消结构化识别、启动前/启动后失败分型与 elevated worker 原始退出码回传。
 * [POS]: Windows language transaction 的唯一提权启动边界；只构造固定单参数，不解释 plan，也不拼接安装路径。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
use std::{ffi::OsStr, fmt, os::windows::ffi::OsStrExt, path::Path};

use windows::{
    core::{Owned, HRESULT, PCWSTR},
    Win32::{
        Foundation::{GetLastError, ERROR_CANCELLED, HANDLE, WAIT_FAILED, WAIT_OBJECT_0},
        System::Threading::{GetExitCodeProcess, WaitForSingleObject, INFINITE},
        UI::{
            Shell::{
                ShellExecuteExW, SEE_MASK_FLAG_NO_UI, SEE_MASK_NOASYNC, SEE_MASK_NOCLOSEPROCESS,
                SHELLEXECUTEINFOW,
            },
            WindowsAndMessaging::SW_HIDE,
        },
    },
};

use super::contract::{MAX_TRANSPORT_TOKEN_LEN, WORKER_ARGUMENT_PREFIX};

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) enum LaunchError {
    InvalidExecutable(&'static str),
    InvalidTransport(&'static str),
    Cancelled(u32),
    ShellExecute { hresult: i32, message: String },
    MissingProcessHandle,
    WaitFailed(u32),
    UnexpectedWaitStatus(u32),
    ExitCodeRead { hresult: i32, message: String },
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum LaunchFailurePhase {
    PreLaunch,
    PostLaunchUncertain,
}

impl LaunchError {
    pub(crate) fn failure_phase(&self) -> LaunchFailurePhase {
        match self {
            Self::InvalidExecutable(_)
            | Self::InvalidTransport(_)
            | Self::Cancelled(_)
            | Self::ShellExecute { .. } => LaunchFailurePhase::PreLaunch,
            Self::MissingProcessHandle
            | Self::WaitFailed(_)
            | Self::UnexpectedWaitStatus(_)
            | Self::ExitCodeRead { .. } => LaunchFailurePhase::PostLaunchUncertain,
        }
    }
}

impl fmt::Display for LaunchError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::InvalidExecutable(reason) => {
                write!(formatter, "Invalid elevated worker executable: {reason}")
            }
            Self::InvalidTransport(reason) => {
                write!(
                    formatter,
                    "Invalid elevated worker transport token: {reason}"
                )
            }
            Self::Cancelled(code) => {
                write!(
                    formatter,
                    "Windows administrator consent was cancelled ({code})"
                )
            }
            Self::ShellExecute { hresult, message } => write!(
                formatter,
                "Could not start the elevated worker (HRESULT 0x{:08X}): {message}",
                *hresult as u32
            ),
            Self::MissingProcessHandle => {
                formatter.write_str("Windows did not return an elevated worker process handle")
            }
            Self::WaitFailed(code) => write!(
                formatter,
                "Could not wait for the elevated worker (Win32 error {code})"
            ),
            Self::UnexpectedWaitStatus(status) => write!(
                formatter,
                "Elevated worker wait returned unexpected status 0x{status:08X}"
            ),
            Self::ExitCodeRead { hresult, message } => write!(
                formatter,
                "Could not read the elevated worker exit code (HRESULT 0x{:08X}): {message}",
                *hresult as u32
            ),
        }
    }
}

impl std::error::Error for LaunchError {}

pub(crate) fn launch_elevated_worker(exe: &Path, transport: &str) -> Result<u32, LaunchError> {
    validate_executable(exe)?;
    let parameters = worker_argument(transport)?;

    let exe_wide = nul_terminated_wide(exe.as_os_str());
    let directory_wide = nul_terminated_wide(
        exe.parent()
            .ok_or(LaunchError::InvalidExecutable(
                "current_exe must have an absolute parent directory",
            ))?
            .as_os_str(),
    );
    let parameters_wide = nul_terminated_wide(OsStr::new(&parameters));
    let runas_wide = nul_terminated_wide(OsStr::new("runas"));
    let mut execute_info = SHELLEXECUTEINFOW {
        cbSize: std::mem::size_of::<SHELLEXECUTEINFOW>() as u32,
        fMask: SEE_MASK_NOCLOSEPROCESS | SEE_MASK_NOASYNC | SEE_MASK_FLAG_NO_UI,
        lpVerb: PCWSTR(runas_wide.as_ptr()),
        lpFile: PCWSTR(exe_wide.as_ptr()),
        lpParameters: PCWSTR(parameters_wide.as_ptr()),
        lpDirectory: PCWSTR(directory_wide.as_ptr()),
        nShow: SW_HIDE.0,
        ..Default::default()
    };

    // SAFETY: all PCWSTR buffers remain alive and NUL-terminated through the call;
    // the structure size and mask match SHELLEXECUTEINFOW. On success hProcess is
    // uniquely transferred into Owned<HANDLE> and closed exactly once.
    unsafe { ShellExecuteExW(&mut execute_info) }.map_err(map_shell_execute_error)?;
    if execute_info.hProcess.is_invalid() {
        return Err(LaunchError::MissingProcessHandle);
    }
    let process: Owned<HANDLE> = unsafe { Owned::new(execute_info.hProcess) };

    // SAFETY: process owns a valid process handle returned by ShellExecuteExW and
    // stays alive until both wait and exit-code retrieval complete.
    let wait_status = unsafe { WaitForSingleObject(*process, INFINITE) };
    if wait_status == WAIT_FAILED {
        // SAFETY: GetLastError is read immediately after the failing Win32 call.
        return Err(LaunchError::WaitFailed(unsafe { GetLastError() }.0));
    }
    if wait_status != WAIT_OBJECT_0 {
        return Err(LaunchError::UnexpectedWaitStatus(wait_status.0));
    }

    let mut exit_code = 0u32;
    // SAFETY: process still owns a valid, signaled process handle and exit_code
    // points to writable storage for the duration of the call.
    unsafe { GetExitCodeProcess(*process, &mut exit_code) }.map_err(|error| {
        LaunchError::ExitCodeRead {
            hresult: error.code().0,
            message: error.message(),
        }
    })?;
    Ok(exit_code)
}

fn validate_executable(exe: &Path) -> Result<(), LaunchError> {
    if !exe.is_absolute() {
        return Err(LaunchError::InvalidExecutable(
            "current_exe must be an absolute path",
        ));
    }
    if exe.as_os_str().encode_wide().any(|unit| unit == 0) {
        return Err(LaunchError::InvalidExecutable(
            "current_exe contains an embedded NUL",
        ));
    }
    Ok(())
}

fn worker_argument(transport: &str) -> Result<String, LaunchError> {
    validate_transport(transport)?;
    Ok(format!("{WORKER_ARGUMENT_PREFIX}{transport}"))
}

fn validate_transport(transport: &str) -> Result<(), LaunchError> {
    if transport.is_empty() {
        return Err(LaunchError::InvalidTransport("token must not be empty"));
    }
    if transport.len() > MAX_TRANSPORT_TOKEN_LEN {
        return Err(LaunchError::InvalidTransport("token is too long"));
    }
    if !transport
        .bytes()
        .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_' | b'.'))
    {
        return Err(LaunchError::InvalidTransport(
            "token must contain only ASCII alphanumeric characters, '-', '_', or '.'",
        ));
    }
    Ok(())
}

fn nul_terminated_wide(value: &std::ffi::OsStr) -> Vec<u16> {
    value.encode_wide().chain(std::iter::once(0)).collect()
}

fn map_shell_execute_error(error: windows::core::Error) -> LaunchError {
    if error.code() == HRESULT::from_win32(ERROR_CANCELLED.0) {
        return LaunchError::Cancelled(ERROR_CANCELLED.0);
    }
    LaunchError::ShellExecute {
        hresult: error.code().0,
        message: error.message(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn worker_argument_is_exactly_one_fixed_ascii_parameter() {
        assert_eq!(
            worker_argument("abc-DEF_012.345").unwrap(),
            "--cavalry-i18n-elevated-apply=abc-DEF_012.345"
        );
    }

    #[test]
    fn transport_rejects_empty_unsafe_unicode_and_path_shaped_tokens() {
        for token in [
            "",
            "two words",
            "quoted\"token",
            "token=value",
            "C:\\temp\\plan",
            "../plan",
            "简体中文",
        ] {
            assert!(
                matches!(
                    worker_argument(token),
                    Err(LaunchError::InvalidTransport(_))
                ),
                "unexpectedly accepted {token:?}"
            );
        }
    }

    #[test]
    fn transport_rejects_unbounded_input() {
        let token = "a".repeat(MAX_TRANSPORT_TOKEN_LEN + 1);
        assert!(matches!(
            worker_argument(&token),
            Err(LaunchError::InvalidTransport("token is too long"))
        ));
    }

    #[test]
    fn executable_must_be_absolute() {
        assert_eq!(
            validate_executable(Path::new("Cavalry Language Switcher.exe")),
            Err(LaunchError::InvalidExecutable(
                "current_exe must be an absolute path"
            ))
        );
    }

    #[test]
    fn shell_cancel_maps_to_structured_win32_code() {
        let error = windows::core::Error::from_hresult(HRESULT::from_win32(ERROR_CANCELLED.0));
        assert_eq!(map_shell_execute_error(error), LaunchError::Cancelled(1223));
    }

    #[test]
    fn failure_phase_never_treats_a_successful_shell_launch_as_prelaunch() {
        for error in [
            LaunchError::MissingProcessHandle,
            LaunchError::WaitFailed(5),
            LaunchError::UnexpectedWaitStatus(0x102),
            LaunchError::ExitCodeRead {
                hresult: -1,
                message: "fixture".to_string(),
            },
        ] {
            assert_eq!(
                error.failure_phase(),
                LaunchFailurePhase::PostLaunchUncertain
            );
        }
        for error in [
            LaunchError::InvalidExecutable("fixture"),
            LaunchError::InvalidTransport("fixture"),
            LaunchError::Cancelled(1223),
            LaunchError::ShellExecute {
                hresult: -1,
                message: "fixture".to_string(),
            },
        ] {
            assert_eq!(error.failure_phase(), LaunchFailurePhase::PreLaunch);
        }
    }
}
