/**
 * [INPUT]: 依赖 state 目录、原子标志与 macOS flock/Windows exclusive file handle。
 * [OUTPUT]: 提供 try_begin_bundle_operation、BundleOperationGuard 与稳定 busy 错误。
 * [POS]: src-tauri/src 的 bundle operation 单飞边界；GUI extract/apply/restart 与 Windows headless launch 共享同一跨进程锁语义。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
use std::{
    fs,
    path::Path,
    sync::atomic::{AtomicBool, Ordering},
};

#[cfg(target_os = "macos")]
use std::os::fd::AsRawFd;
#[cfg(target_os = "windows")]
use std::os::windows::fs::OpenOptionsExt;

static BUNDLE_OPERATION_IN_PROGRESS: AtomicBool = AtomicBool::new(false);
pub(crate) const BUSY_ERROR: &str =
    "Another Cavalry language operation is already running. Wait for it to finish and try again.";
const BUNDLE_LOCK_FILE_NAME: &str = ".cavalry-i18n-bundle.lock";

pub(crate) struct BundleOperationGuard {
    #[cfg(any(target_os = "macos", target_os = "windows"))]
    lock_file: Option<fs::File>,
}

impl Drop for BundleOperationGuard {
    fn drop(&mut self) {
        #[cfg(target_os = "macos")]
        if let Some(file) = &self.lock_file {
            // SAFETY: fd 属于 guard 持有且仍存活的 File。
            unsafe {
                libc::flock(file.as_raw_fd(), libc::LOCK_UN);
            }
        }
        #[cfg(target_os = "windows")]
        {
            let _ = self.lock_file.take();
        }
        BUNDLE_OPERATION_IN_PROGRESS.store(false, Ordering::Release);
    }
}

#[cfg(target_os = "macos")]
pub(crate) fn acquire_bundle_file_lock(state_dir: &Path) -> Result<fs::File, String> {
    fs::create_dir_all(state_dir).map_err(|error| {
        format!(
            "Could not create bundle operation lock directory {}: {error}",
            state_dir.display()
        )
    })?;
    let lock_path = state_dir.join(BUNDLE_LOCK_FILE_NAME);
    // 锁文件必须持久保留；删除它会让两个进程锁住不同 inode，破坏单飞语义。
    let file = fs::OpenOptions::new()
        .read(true)
        .write(true)
        .create(true)
        .open(&lock_path)
        .map_err(|error| format!("Could not open bundle operation lock: {error}"))?;
    // SAFETY: flock 只读取 file 拥有的有效描述符。
    if unsafe { libc::flock(file.as_raw_fd(), libc::LOCK_EX | libc::LOCK_NB) } == 0 {
        return Ok(file);
    }
    let error = std::io::Error::last_os_error();
    if error.raw_os_error() == Some(libc::EWOULDBLOCK) {
        Err(BUSY_ERROR.to_string())
    } else {
        Err(format!(
            "Could not acquire bundle operation lock {}: {error}",
            lock_path.display()
        ))
    }
}

#[cfg(target_os = "windows")]
pub(crate) fn acquire_bundle_file_lock(state_dir: &Path) -> Result<fs::File, String> {
    fs::create_dir_all(state_dir).map_err(|error| {
        format!(
            "Could not create bundle operation lock directory {}: {error}",
            state_dir.display()
        )
    })?;
    let lock_path = state_dir.join(BUNDLE_LOCK_FILE_NAME);
    fs::OpenOptions::new()
        .read(true)
        .write(true)
        .create(true)
        .share_mode(0)
        .open(&lock_path)
        .map_err(|error| {
            if matches!(error.raw_os_error(), Some(32) | Some(33)) {
                BUSY_ERROR.to_string()
            } else {
                format!(
                    "Could not acquire bundle operation lock {}: {error}",
                    lock_path.display()
                )
            }
        })
}

pub(crate) fn try_begin_bundle_operation(state_dir: &Path) -> Result<BundleOperationGuard, String> {
    BUNDLE_OPERATION_IN_PROGRESS
        .compare_exchange(false, true, Ordering::Acquire, Ordering::Relaxed)
        .map_err(|_| BUSY_ERROR.to_string())?;
    let guard = BundleOperationGuard {
        #[cfg(any(target_os = "macos", target_os = "windows"))]
        lock_file: None,
    };
    #[cfg(any(target_os = "macos", target_os = "windows"))]
    {
        let mut guard = guard;
        guard.lock_file = Some(acquire_bundle_file_lock(state_dir)?);
        return Ok(guard);
    }
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        let _ = state_dir;
        Ok(guard)
    }
}
