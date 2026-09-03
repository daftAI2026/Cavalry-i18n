/**
 * [INPUT]: 依赖 InstallLayout、libproc、固定 JXA terminate 请求与 CommandRunner。
 * [OUTPUT]: 提供按 canonical executable/PID 的只读运行探针、显式重启场景下的 graceful close、transaction 内复核，并将 vanished PID 与不可检查错误显式区分。
 * [POS]: macOS 进程边界；普通 Switch/Restore 只读探测并要求用户自行保存退出，只有显式 restart 路径可请求 graceful terminate；proc_pidpath/路径解析错误 fail closed，仅 typed vanished PID 可忽略，不按应用名猜测、不强杀可见/未保存进程、不接受动态脚本。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
use std::{
    ffi::{c_int, c_void, CStr, OsString},
    fs,
    os::unix::ffi::OsStringExt,
    path::{Path, PathBuf},
    ptr, thread,
    time::{Duration, Instant},
};

use crate::install::InstallLayout;

use super::super::{restart::CloseCavalryError, CommandRunner};

const PROC_ALL_PIDS: u32 = 1;
const PROC_PIDPATHINFO_MAXSIZE: usize = 4096;
const CLOSE_TIMEOUT: Duration = Duration::from_secs(15);
const CLOSE_POLL_INTERVAL: Duration = Duration::from_millis(100);

const TERMINATE_EXACT_PROCESS_JXA: &str = r#"
function run(argv) {
  if (argv.length !== 2 || !/^\d+$/.test(argv[0]) || argv[1].length === 0) {
    throw new Error("Expected one decimal process id and one executable path.");
  }
  const pid = Number(argv[0]);
  if (!Number.isSafeInteger(pid) || pid <= 0) {
    throw new Error("Invalid process id.");
  }
  ObjC.import("AppKit");
  const app = $.NSRunningApplication.runningApplicationWithProcessIdentifier(pid);
  if (!app || app.terminated) {
    return "already-exited";
  }
  const executableUrl = app.executableURL;
  if (!executableUrl) {
    return "already-exited";
  }
  const actualPath = ObjC.unwrap(executableUrl.URLByResolvingSymlinksInPath.path);
  if (actualPath !== argv[1]) {
    throw new Error("Process identity changed before termination.");
  }
  const requested = app.terminate;
  if (!requested) {
    throw new Error("Cavalry refused the graceful termination request.");
  }
  return "requested";
}
"#;

#[link(name = "proc")]
extern "C" {
    fn proc_listpids(
        process_type: u32,
        type_info: u32,
        buffer: *mut c_void,
        buffer_size: c_int,
    ) -> c_int;
    fn proc_pidpath(pid: c_int, buffer: *mut c_void, buffer_size: u32) -> c_int;
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) enum ExactProcessGuardError {
    StillRunning { pids: Vec<u32> },
    Inspection(String),
}

impl std::fmt::Display for ExactProcessGuardError {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::StillRunning { pids } => write!(
                formatter,
                "Selected Cavalry is still running with exact process ID(s): {}",
                pids.iter()
                    .map(u32::to_string)
                    .collect::<Vec<_>>()
                    .join(", ")
            ),
            Self::Inspection(detail) => formatter.write_str(detail),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
enum ProcessPathProbe {
    Exited,
    Path(PathBuf),
}

/// Re-check used from inside the durable transaction immediately before any mutation. Unlike the
/// graceful-close entry point this never sends a signal: a matching PID is a typed fail-closed
/// result, and an uninspectable live PID is an inspection error rather than a false "not running".
pub(crate) fn guard_exact_cavalry_not_running(
    exact_executable: &Path,
) -> Result<(), ExactProcessGuardError> {
    let pids = matching_pids(exact_executable).map_err(ExactProcessGuardError::Inspection)?;
    if pids.is_empty() {
        Ok(())
    } else {
        Err(ExactProcessGuardError::StillRunning { pids })
    }
}

/// Switch/Restore 的共同 admission：只判断所选 Cavalry 是否仍在运行，不替用户关闭
/// 创作软件。真正写事务还会在首个 mutation 前再次执行 exact-PID guard，封闭 TOCTOU。
pub(crate) fn ensure_cavalry_not_running(app_path: &Path) -> Result<(), CloseCavalryError> {
    let layout = InstallLayout::from_root(app_path);
    let target = fs::canonicalize(&layout.executable).map_err(|error| {
        CloseCavalryError::Command(format!(
            "Could not resolve the selected Cavalry executable {} before the running-process check: {error}",
            layout.executable.display()
        ))
    })?;
    match guard_exact_cavalry_not_running(&target) {
        Ok(()) => Ok(()),
        Err(ExactProcessGuardError::StillRunning { .. }) => Err(CloseCavalryError::StillRunning),
        Err(ExactProcessGuardError::Inspection(detail)) => Err(CloseCavalryError::Command(detail)),
    }
}

pub(crate) fn close_exact_cavalry<R: CommandRunner>(
    app_path: &Path,
    runner: &mut R,
) -> Result<(), CloseCavalryError> {
    let layout = InstallLayout::from_root(app_path);
    let target = fs::canonicalize(&layout.executable).map_err(|error| {
        CloseCavalryError::Command(format!(
            "Could not resolve the selected Cavalry executable {} before shutdown: {error}",
            layout.executable.display()
        ))
    })?;

    let deadline = Instant::now() + CLOSE_TIMEOUT;
    close_exact_cavalry_with(
        &target,
        || matching_pids(&target),
        |pid, executable| {
            let command = termination_command(pid, executable);
            runner
                .run(&command.program, &command.args)
                .map_err(|error| {
                    format!(
                        "Could not request graceful shutdown for Cavalry process {pid}: {error}"
                    )
                })
        },
        || thread::sleep(CLOSE_POLL_INTERVAL),
        || Instant::now() >= deadline,
    )
}

fn close_exact_cavalry_with<M, T, S, E>(
    target: &Path,
    mut matching: M,
    mut terminate: T,
    mut sleep: S,
    mut expired: E,
) -> Result<(), CloseCavalryError>
where
    M: FnMut() -> Result<Vec<u32>, String>,
    T: FnMut(u32, &Path) -> Result<(), String>,
    S: FnMut(),
    E: FnMut() -> bool,
{
    let initial = matching().map_err(CloseCavalryError::Command)?;
    if initial.is_empty() {
        return Ok(());
    }
    for pid in initial {
        terminate(pid, target).map_err(CloseCavalryError::Command)?;
    }
    loop {
        let remaining = matching().map_err(CloseCavalryError::Command)?;
        if remaining.is_empty() {
            return Ok(());
        }
        if expired() {
            return Err(CloseCavalryError::StillRunning);
        }
        sleep();
    }
}

fn termination_command(pid: u32, target: &Path) -> crate::privilege::RecordedCommand {
    crate::privilege::RecordedCommand {
        program: "osascript".to_string(),
        args: vec![
            "-l".to_string(),
            "JavaScript".to_string(),
            "-e".to_string(),
            TERMINATE_EXACT_PROCESS_JXA.to_string(),
            pid.to_string(),
            target.to_string_lossy().to_string(),
        ],
    }
}

fn matching_pids(target: &Path) -> Result<Vec<u32>, String> {
    matching_pids_from(target, all_pids()?, process_path)
}

fn matching_pids_from<I, F>(
    target: &Path,
    pids: I,
    mut process_path_for: F,
) -> Result<Vec<u32>, String>
where
    I: IntoIterator<Item = u32>,
    F: FnMut(u32) -> Result<ProcessPathProbe, String>,
{
    let mut output = Vec::new();
    for pid in pids {
        let raw_path = match process_path_for(pid)? {
            ProcessPathProbe::Exited => continue,
            ProcessPathProbe::Path(path) => path,
        };
        let canonical = match fs::canonicalize(&raw_path) {
            Ok(path) => path,
            Err(error) => match process_path_for(pid)? {
                ProcessPathProbe::Exited => continue,
                ProcessPathProbe::Path(current_path) => {
                    return Err(format!(
                        "Could not resolve executable path {} for live process {pid}: {error}. Current proc_pidpath is {}.",
                        raw_path.display(),
                        current_path.display()
                    ));
                }
            },
        };
        if canonical == target {
            output.push(pid);
        }
    }
    output.sort_unstable();
    output.dedup();
    Ok(output)
}

fn all_pids() -> Result<Vec<u32>, String> {
    // libproc reports required bytes when called with a null buffer. Processes may
    // appear between calls, so reserve slack and retry boundedly on a full buffer.
    for _ in 0..4 {
        unsafe { *libc::__error() = 0 };
        let required = unsafe { proc_listpids(PROC_ALL_PIDS, 0, ptr::null_mut(), 0) };
        if required <= 0 {
            return Err(format!(
                "Could not size the macOS process inventory with libproc: {}",
                std::io::Error::last_os_error()
            ));
        }
        let slots = (required as usize / std::mem::size_of::<c_int>()).saturating_add(64);
        let mut pids = vec![0_i32; slots.max(64)];
        let buffer_size = pids
            .len()
            .checked_mul(std::mem::size_of::<c_int>())
            .and_then(|size| c_int::try_from(size).ok())
            .ok_or_else(|| "macOS process list is too large.".to_string())?;
        unsafe { *libc::__error() = 0 };
        let bytes = unsafe {
            proc_listpids(
                PROC_ALL_PIDS,
                0,
                pids.as_mut_ptr().cast::<c_void>(),
                buffer_size,
            )
        };
        if bytes <= 0 {
            return Err(format!(
                "Could not enumerate macOS processes with libproc: {}",
                std::io::Error::last_os_error()
            ));
        }
        if bytes < buffer_size {
            if bytes as usize % std::mem::size_of::<c_int>() != 0 {
                return Err("libproc returned a truncated macOS process inventory.".to_string());
            }
            let count = bytes as usize / std::mem::size_of::<c_int>();
            return Ok(pids
                .into_iter()
                .take(count)
                .filter_map(|pid| u32::try_from(pid).ok())
                .filter(|pid| *pid > 0)
                .collect());
        }
    }
    Err("macOS process list changed continuously during enumeration.".to_string())
}

fn process_path(pid: u32) -> Result<ProcessPathProbe, String> {
    let native_pid = c_int::try_from(pid)
        .map_err(|_| format!("macOS process ID is outside c_int range: {pid}"))?;
    let mut buffer = [0_u8; PROC_PIDPATHINFO_MAXSIZE];
    // SAFETY: macOS exposes thread-local errno through `__error`; clearing it lets a zero
    // proc_pidpath result distinguish ENOENT/ESRCH from permission/inspection failures.
    unsafe { *libc::__error() = 0 };
    let length = unsafe {
        proc_pidpath(
            native_pid,
            buffer.as_mut_ptr().cast::<c_void>(),
            buffer.len() as u32,
        )
    };
    if length <= 0 {
        let errno = unsafe { *libc::__error() };
        if proc_pidpath_errno_is_vanished(errno) || process_has_exited(native_pid) {
            return Ok(ProcessPathProbe::Exited);
        }
        return Err(format!(
            "Could not inspect executable path for live process {pid} with proc_pidpath: {} [errno={errno}]",
            std::io::Error::from_raw_os_error(errno)
        ));
    }
    let value = CStr::from_bytes_until_nul(&buffer).map_err(|error| {
        format!("proc_pidpath returned an unterminated path for process {pid}: {error}")
    })?;
    Ok(ProcessPathProbe::Path(PathBuf::from(OsString::from_vec(
        value.to_bytes().to_vec(),
    ))))
}

fn proc_pidpath_errno_is_vanished(errno: i32) -> bool {
    matches!(errno, libc::ENOENT | libc::ESRCH)
}

fn process_has_exited(pid: c_int) -> bool {
    // `kill(pid, 0)` performs no mutation. ESRCH is the only state accepted as a vanished process;
    // EPERM and every other error remain live/unknown and therefore fail closed above.
    if unsafe { libc::kill(pid, 0) } == 0 {
        return false;
    }
    std::io::Error::last_os_error().raw_os_error() == Some(libc::ESRCH)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn jxa_accepts_only_a_decimal_pid_and_uses_ns_running_application() {
        assert!(TERMINATE_EXACT_PROCESS_JXA.contains("/^\\d+$/"));
        assert!(TERMINATE_EXACT_PROCESS_JXA.contains("runningApplicationWithProcessIdentifier"));
        assert!(TERMINATE_EXACT_PROCESS_JXA.contains("URLByResolvingSymlinksInPath"));
        assert!(TERMINATE_EXACT_PROCESS_JXA.contains("actualPath !== argv[1]"));
        assert!(!TERMINATE_EXACT_PROCESS_JXA.contains("tell application"));
        assert!(!TERMINATE_EXACT_PROCESS_JXA.contains("do shell script"));
    }

    #[test]
    fn current_process_path_is_available_through_libproc() {
        let ProcessPathProbe::Path(path) =
            process_path(std::process::id()).expect("current process path")
        else {
            panic!("current process unexpectedly disappeared")
        };
        assert!(path.is_absolute());
    }

    #[test]
    fn multiple_cavalry_copies_match_only_the_selected_canonical_executable() {
        let temp = tempfile::tempdir().unwrap();
        let selected = temp
            .path()
            .join("Selected Cavalry.app/Contents/MacOS/Cavalry");
        let other = temp.path().join("Other Cavalry.app/Contents/MacOS/Cavalry");
        fs::create_dir_all(selected.parent().unwrap()).unwrap();
        fs::create_dir_all(other.parent().unwrap()).unwrap();
        fs::write(&selected, b"selected").unwrap();
        fs::write(&other, b"other").unwrap();
        let selected = fs::canonicalize(selected).unwrap();

        let matching = matching_pids_from(&selected, [41, 42, 43], |pid| {
            Ok(match pid {
                41 | 43 => ProcessPathProbe::Path(selected.clone()),
                42 => ProcessPathProbe::Path(other.clone()),
                _ => ProcessPathProbe::Exited,
            })
        })
        .unwrap();

        assert_eq!(matching, vec![41, 43]);
    }

    #[test]
    fn vanished_process_is_ignored_but_probe_error_fails_closed() {
        let target = Path::new("/Applications/Cavalry.app/Contents/MacOS/Cavalry");
        assert!(
            matching_pids_from(target, [41], |_| Ok(ProcessPathProbe::Exited))
                .unwrap()
                .is_empty()
        );

        let error = matching_pids_from(target, [42], |_| {
            Err("proc_pidpath denied live process 42".to_string())
        })
        .unwrap_err();
        assert!(error.contains("denied live process 42"), "{error}");
    }

    #[test]
    fn proc_pidpath_vanished_errno_is_typed_exit_but_access_errors_fail_closed() {
        assert!(proc_pidpath_errno_is_vanished(libc::ENOENT));
        assert!(proc_pidpath_errno_is_vanished(libc::ESRCH));
        assert!(!proc_pidpath_errno_is_vanished(libc::EPERM));
        assert!(!proc_pidpath_errno_is_vanished(libc::EACCES));
        assert!(!proc_pidpath_errno_is_vanished(libc::EIO));
    }

    #[test]
    fn canonicalize_error_is_ignored_only_after_typed_exit() {
        let target = Path::new("/Applications/Cavalry.app/Contents/MacOS/Cavalry");
        let missing = PathBuf::from("/definitely/missing/cavalry-process");
        let mut probes = vec![
            ProcessPathProbe::Path(missing.clone()),
            ProcessPathProbe::Path(missing),
        ]
        .into_iter();
        let error = matching_pids_from(target, [51], |_| Ok(probes.next().unwrap())).unwrap_err();
        assert!(error.contains("live process 51"), "{error}");

        let mut probes = vec![
            ProcessPathProbe::Path(PathBuf::from("/definitely/missing/cavalry-process")),
            ProcessPathProbe::Exited,
        ]
        .into_iter();
        assert!(
            matching_pids_from(target, [52], |_| Ok(probes.next().unwrap()))
                .unwrap()
                .is_empty()
        );
    }

    #[test]
    fn delayed_exit_waits_until_every_selected_pid_is_gone() {
        let target = Path::new("/Applications/Cavalry.app/Contents/MacOS/Cavalry");
        let mut inventories = vec![vec![101, 102], vec![102], Vec::new()].into_iter();
        let mut terminated = Vec::new();
        let mut sleeps = 0;

        close_exact_cavalry_with(
            target,
            || Ok(inventories.next().unwrap_or_default()),
            |pid, _| {
                terminated.push(pid);
                Ok(())
            },
            || sleeps += 1,
            || false,
        )
        .unwrap();

        assert_eq!(terminated, vec![101, 102]);
        assert_eq!(sleeps, 1);
    }

    #[test]
    fn save_dialog_timeout_returns_still_running_without_forcing_termination() {
        let target = Path::new("/Applications/Cavalry.app/Contents/MacOS/Cavalry");
        let mut termination_requests = 0;
        let error = close_exact_cavalry_with(
            target,
            || Ok(vec![77]),
            |_, _| {
                termination_requests += 1;
                Ok(())
            },
            || panic!("expired wait must not sleep again"),
            || true,
        )
        .unwrap_err();

        assert!(matches!(error, CloseCavalryError::StillRunning));
        assert_eq!(termination_requests, 1);
    }

    #[test]
    fn unsafe_bundle_characters_are_data_arguments_not_script_source() {
        let target =
            Path::new("/Applications/Cavalry \"copy\"; do shell script.app/Contents/MacOS/Cavalry");
        let command = termination_command(123, target);

        assert_eq!(command.program, "osascript");
        assert_eq!(command.args[3], TERMINATE_EXACT_PROCESS_JXA);
        assert_eq!(command.args[4], "123");
        assert_eq!(command.args[5], target.to_string_lossy());
        assert!(!command.args[3].contains(&target.to_string_lossy().to_string()));
    }
}
