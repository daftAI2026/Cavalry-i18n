/**
 * [INPUT]: 依赖 staged CopyPair、调用方精确/observe-only preimage、transaction 内 exact-process guard、显式 signing verifier、macOS bundle/state 路径、quarantine xattr、serde/sha2、目录 fd 与 renameatx_np 原子交换。
 * [OUTPUT]: 提供 crash-recoverable MacApplyTransaction、首装 journal-aware launcher gate、无需 Keychain 的结构化 journal 校验、fd-relative nofollow 备份/发布/恢复与 quarantine 遍历、hardlink 边界拒绝、保留 errno 权限类别的 compare-and-swap 写入、显式 payload→signing-proof→deferred-marker-gate→state-durability phase、drift 拒绝，以及 committed journal 原子退役后清理。
 * [POS]: macOS apply 的 durable transaction owner；首个 mutation 前在 pinned root 核对调用方 sha256+mode preimage，首装最早发布 wrapper/Info gate 后第三次复核 exact Cavalry PID，journal 覆盖 CopyPair/observe-only 资产/延迟 marker/移除/有界签名副作用/quarantine/state；bundle create/rename 的 typed permission denial 在安全回滚补充上下文后仍可由 command 判定，Signing phase 本身是 codesign mutation authorization，state 目录耐久性确认后才进入 durable commit。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
#[cfg(test)]
use std::cell::{Cell, RefCell};
use std::{
    collections::HashSet,
    ffi::{CStr, CString, OsString},
    fs::{self, File},
    io::{ErrorKind, Read, Seek, Write},
    os::fd::{AsRawFd, FromRawFd, OwnedFd, RawFd},
    os::unix::{
        ffi::{OsStrExt, OsStringExt},
        fs::PermissionsExt,
    },
    path::{Component, Path, PathBuf},
    sync::atomic::{AtomicU64, Ordering},
};

use crate::{patch::CopyPair, state};

use super::super::copy_transaction::{
    CopyCompletion, CopyFailure, PostCommitWarning, PostCommitWarningCode,
};
use super::process::{guard_exact_cavalry_not_running, ExactProcessGuardError};

const JOURNAL_DIRECTORY: &str = "macos-apply-transaction";
const CLEANUP_TOMBSTONE_PREFIX: &str = ".macos-apply-transaction.cleanup-";
const MANIFEST_NAME: &str = "manifest.json";
const MANIFEST_SCHEMA: u32 = 6;
const QUARANTINE_XATTR: &str = "com.apple.quarantine";
const MAX_QUARANTINE_VALUE_BYTES: usize = 1024 * 1024;
static TEMP_SEQUENCE: AtomicU64 = AtomicU64::new(0);

#[cfg(test)]
thread_local! {
    /// Fault injection is thread-local so parallel Rust tests cannot consume one another's
    /// durability failpoints.
    static FAIL_NEXT_MANIFEST_WRITE: Cell<bool> = const { Cell::new(false) };
    static FAIL_BEFORE_JOURNAL_PUBLISH: Cell<bool> = const { Cell::new(false) };
    /// Runs after the destination parent and replacement temporary have been opened, but before
    /// the atomic rename. Tests use this deterministic boundary to prove that ancestor/leaf swaps
    /// cannot redirect writes outside the pinned directory descriptor.
    static BEFORE_ATOMIC_REPLACE: RefCell<Option<Box<dyn FnOnce()>>> = const { RefCell::new(None) };
    /// Runs after the destination fingerprint comparison but immediately before renameatx_np.
    /// This simulates the narrow leaf-name race and exercises exchange-and-verify rollback.
    static AFTER_DESTINATION_COMPARE: RefCell<Option<Box<dyn FnOnce()>>> = const { RefCell::new(None) };
    /// Runs after a quarantine child directory is opened but before descending through its fd.
    /// Tests swap the visible ancestor to a symlink and prove xattr operations stay fd-bound.
    static BEFORE_QUARANTINE_DESCEND: RefCell<Option<Box<dyn FnOnce()>>> = const { RefCell::new(None) };
    /// Runs after `openat(O_NOFOLLOW)` pins a removal leaf and before the name is revalidated.
    static BEFORE_UNLINK_REVALIDATE: RefCell<Option<Box<dyn FnOnce()>>> = const { RefCell::new(None) };
    /// Runs after the selected root directory fd is open and before F_GETPATH resolves its identity.
    static AFTER_ROOT_DIRECTORY_OPEN: RefCell<Option<Box<dyn FnOnce()>>> = const { RefCell::new(None) };
    /// Fails the explicit state-directory durability confirmation while leaving the journal in
    /// StateCommitting so rollback/reopen behavior can be exercised deterministically.
    static FAIL_NEXT_STATE_DURABILITY_SYNC: Cell<bool> = const { Cell::new(false) };
    /// Runs after the first entry of an atomically retired journal has been removed. A child can
    /// exit here to prove partial recursive cleanup can never recreate a canonical pending root.
    static AFTER_RETIRED_CLEANUP_ENTRY: RefCell<Option<Box<dyn FnOnce()>>> = const { RefCell::new(None) };
}

/// A directory descriptor pins the object that was validated. Every transaction descendant is
/// resolved one component at a time with `openat(O_NOFOLLOW)`, so renaming an ancestor or replacing
/// it with a symlink cannot redirect a later read/write into an attacker-controlled tree.
#[derive(Debug)]
struct SecureDirectory {
    fd: OwnedFd,
    path: PathBuf,
}

#[derive(Debug)]
struct SecureRegularFile {
    file: File,
    mode: u32,
}

#[derive(Debug)]
struct SecureNode {
    fd: OwnedFd,
    path: PathBuf,
    mode: u32,
}

impl SecureNode {
    fn is_directory(&self) -> bool {
        (self.mode as libc::mode_t & libc::S_IFMT) == libc::S_IFDIR
    }
}

#[derive(Clone, Copy)]
struct TransactionRoots<'a> {
    bundle: &'a SecureDirectory,
    state: &'a SecureDirectory,
}

impl<'a> TransactionRoots<'a> {
    fn for_scope(self, scope: EntryScope) -> &'a SecureDirectory {
        match scope {
            EntryScope::Bundle => self.bundle,
            EntryScope::State => self.state,
        }
    }

    fn current_fingerprint(self, entry: &JournalEntry) -> Result<Option<FileFingerprint>, String> {
        current_fingerprint_at(self.for_scope(entry.scope), Path::new(&entry.destination))
    }
}

impl SecureDirectory {
    fn open(path: &Path) -> Result<Self, String> {
        validate_absolute_canonical_path(path)?;
        let path_c = c_path(path)?;
        let raw = unsafe {
            libc::open(
                path_c.as_ptr(),
                libc::O_RDONLY | libc::O_DIRECTORY | libc::O_CLOEXEC | libc::O_NOFOLLOW,
            )
        };
        if raw < 0 {
            let error = std::io::Error::last_os_error();
            return Err(format!(
                "Could not securely open directory {}: {error} [errno={}]",
                path.display(),
                error.raw_os_error().unwrap_or(-1)
            ));
        }
        // SAFETY: `open` returned a new owned descriptor.
        let fd = unsafe { OwnedFd::from_raw_fd(raw) };
        require_directory_fd(fd.as_raw_fd(), path)?;
        Ok(Self {
            fd,
            path: path.to_path_buf(),
        })
    }

    /// Opens the selected root exactly once, then asks the kernel for the path of that held
    /// descriptor. Returning the same descriptor closes the resolver-to-consumer reopen window:
    /// a concurrent visible-leaf swap can change the name, but not the transaction root object.
    fn open_resolved(path: &Path, label: &str) -> Result<Self, String> {
        validate_absolute_canonical_path(path)?;
        let path_c = c_path(path)?;
        let raw = unsafe {
            libc::open(
                path_c.as_ptr(),
                libc::O_RDONLY | libc::O_DIRECTORY | libc::O_CLOEXEC | libc::O_NOFOLLOW,
            )
        };
        if raw < 0 {
            return Err(format!(
                "Refusing symlink or non-directory {label} {}: {}",
                path.display(),
                std::io::Error::last_os_error()
            ));
        }
        // SAFETY: `open` returned a new owned descriptor.
        let fd = unsafe { OwnedFd::from_raw_fd(raw) };
        require_directory_fd(fd.as_raw_fd(), path)?;
        #[cfg(test)]
        run_after_root_directory_open_hook();
        let mut buffer = [0 as libc::c_char; libc::PATH_MAX as usize];
        if unsafe { libc::fcntl(fd.as_raw_fd(), libc::F_GETPATH, buffer.as_mut_ptr()) } < 0 {
            return Err(format!(
                "Could not resolve opened {label} {}: {}",
                path.display(),
                std::io::Error::last_os_error()
            ));
        }
        let bytes = unsafe { CStr::from_ptr(buffer.as_ptr()) }.to_bytes();
        let resolved = PathBuf::from(OsString::from_vec(bytes.to_vec()));
        validate_absolute_canonical_path(&resolved)?;
        Ok(Self { fd, path: resolved })
    }

    fn duplicate(&self) -> Result<Self, String> {
        let raw = unsafe { libc::fcntl(self.fd.as_raw_fd(), libc::F_DUPFD_CLOEXEC, 0) };
        if raw < 0 {
            return Err(format!(
                "Could not duplicate secure directory {}: {}",
                self.path.display(),
                std::io::Error::last_os_error()
            ));
        }
        // SAFETY: `fcntl(F_DUPFD_CLOEXEC)` returned a new owned descriptor.
        Ok(Self {
            fd: unsafe { OwnedFd::from_raw_fd(raw) },
            path: self.path.clone(),
        })
    }

    fn relative_path(&self, path: &Path, allow_root: bool) -> Result<PathBuf, String> {
        let relative = path.strip_prefix(&self.path).map_err(|_| {
            format!(
                "Secure path {} escapes pinned root {}",
                path.display(),
                self.path.display()
            )
        })?;
        validate_relative_path(relative, allow_root)?;
        Ok(relative.to_path_buf())
    }

    fn open_dir_path(&self, path: &Path, create: bool) -> Result<Self, String> {
        let relative = self.relative_path(path, true)?;
        self.open_dir_relative(&relative, create)
    }

    fn open_dir_relative(&self, relative: &Path, create: bool) -> Result<Self, String> {
        validate_relative_path(relative, true)?;
        let mut current = self.duplicate()?;
        for component in relative.components() {
            let Component::Normal(name) = component else {
                return Err(format!(
                    "Refusing non-canonical relative directory {}",
                    relative.display()
                ));
            };
            let name_c = c_component(name)?;
            let mut raw = unsafe {
                libc::openat(
                    current.fd.as_raw_fd(),
                    name_c.as_ptr(),
                    libc::O_RDONLY | libc::O_DIRECTORY | libc::O_CLOEXEC | libc::O_NOFOLLOW,
                )
            };
            if raw < 0 {
                let error = std::io::Error::last_os_error();
                if create && error.raw_os_error() == Some(libc::ENOENT) {
                    if unsafe { libc::mkdirat(current.fd.as_raw_fd(), name_c.as_ptr(), 0o700) } != 0
                    {
                        let mkdir_error = std::io::Error::last_os_error();
                        if mkdir_error.raw_os_error() != Some(libc::EEXIST) {
                            return Err(format!(
                                "Could not securely create directory {}: {mkdir_error} [errno={}]",
                                self.path.join(relative).display(),
                                mkdir_error.raw_os_error().unwrap_or(-1)
                            ));
                        }
                    }
                    raw = unsafe {
                        libc::openat(
                            current.fd.as_raw_fd(),
                            name_c.as_ptr(),
                            libc::O_RDONLY | libc::O_DIRECTORY | libc::O_CLOEXEC | libc::O_NOFOLLOW,
                        )
                    };
                }
            }
            if raw < 0 {
                let error = std::io::Error::last_os_error();
                return Err(format!(
                    "Could not securely traverse directory {}: {error} [errno={}]",
                    self.path.join(relative).display(),
                    error.raw_os_error().unwrap_or(-1)
                ));
            }
            // SAFETY: `openat` returned a new owned descriptor.
            let fd = unsafe { OwnedFd::from_raw_fd(raw) };
            require_directory_fd(fd.as_raw_fd(), &self.path.join(relative))?;
            current = Self {
                fd,
                path: current.path.join(name),
            };
        }
        Ok(current)
    }

    fn open_parent_path(&self, path: &Path, create: bool) -> Result<(Self, CString), String> {
        let relative = self.relative_path(path, false)?;
        let leaf = relative
            .file_name()
            .ok_or_else(|| format!("Secure path has no leaf: {}", path.display()))?;
        let parent = relative.parent().unwrap_or_else(|| Path::new(""));
        Ok((self.open_dir_relative(parent, create)?, c_component(leaf)?))
    }

    fn open_regular_path(&self, path: &Path) -> Result<Option<SecureRegularFile>, String> {
        let (parent, leaf) = match self.open_parent_path(path, false) {
            Ok(value) => value,
            Err(error) if secure_error_is_not_found(&error) => return Ok(None),
            Err(error) => return Err(error),
        };
        parent.open_regular_leaf(&leaf, path)
    }

    fn open_regular_relative(&self, relative: &Path) -> Result<Option<SecureRegularFile>, String> {
        let path = self.path.join(relative);
        self.open_regular_path(&path)
    }

    fn open_regular_leaf(
        &self,
        leaf: &CString,
        display: &Path,
    ) -> Result<Option<SecureRegularFile>, String> {
        let raw = unsafe {
            libc::openat(
                self.fd.as_raw_fd(),
                leaf.as_ptr(),
                libc::O_RDONLY | libc::O_CLOEXEC | libc::O_NOFOLLOW,
            )
        };
        if raw < 0 {
            let error = std::io::Error::last_os_error();
            if error.raw_os_error() == Some(libc::ENOENT) {
                return Ok(None);
            }
            return Err(format!(
                "Could not securely open regular file {}: {error}",
                display.display()
            ));
        }
        // SAFETY: `openat` returned a new owned descriptor, transferred to `File`.
        let file = unsafe { File::from_raw_fd(raw) };
        let mode = require_regular_fd(file.as_raw_fd(), display)?;
        Ok(Some(SecureRegularFile { file, mode }))
    }

    fn open_node_path(&self, path: &Path) -> Result<SecureNode, String> {
        let relative = self.relative_path(path, true)?;
        if relative.as_os_str().is_empty() {
            let duplicate = self.duplicate()?;
            let stat = fstat_fd(duplicate.fd.as_raw_fd(), path)?;
            return Ok(SecureNode {
                fd: duplicate.fd,
                path: path.to_path_buf(),
                mode: stat.st_mode as u32,
            });
        }
        let (parent, leaf) = self.open_parent_path(path, false)?;
        parent
            .open_node_leaf(&leaf, path)?
            .ok_or_else(|| format!("Secure bundle node disappeared: {}", path.display()))
    }

    fn open_node_leaf(&self, leaf: &CString, display: &Path) -> Result<Option<SecureNode>, String> {
        let raw = unsafe {
            libc::openat(
                self.fd.as_raw_fd(),
                leaf.as_ptr(),
                libc::O_RDONLY | libc::O_CLOEXEC | libc::O_NOFOLLOW,
            )
        };
        if raw < 0 {
            let error = std::io::Error::last_os_error();
            if error.raw_os_error() == Some(libc::ENOENT) {
                return Ok(None);
            }
            return Err(format!(
                "Could not securely open bundle node {}: {error}",
                display.display()
            ));
        }
        // SAFETY: `openat` returned a new owned descriptor.
        let fd = unsafe { OwnedFd::from_raw_fd(raw) };
        let stat = fstat_fd(fd.as_raw_fd(), display)?;
        let kind = stat.st_mode & libc::S_IFMT;
        if kind != libc::S_IFREG && kind != libc::S_IFDIR {
            return Err(format!(
                "Refusing symlink or non-regular/non-directory bundle node {}",
                display.display()
            ));
        }
        // Xattrs mutate the inode rather than the directory entry. A hard-linked regular file can
        // therefore cross the selected bundle boundary even though no symlink is followed.
        if kind == libc::S_IFREG && stat.st_nlink > 1 {
            return Err(format!(
                "Refusing hard-linked bundle file during quarantine handling: {}",
                display.display()
            ));
        }
        Ok(Some(SecureNode {
            fd,
            path: display.to_path_buf(),
            mode: stat.st_mode as u32,
        }))
    }

    fn create_regular_leaf(
        &self,
        leaf: &CString,
        display: &Path,
        mode: u32,
    ) -> Result<File, CopyFailure> {
        let raw = unsafe {
            libc::openat(
                self.fd.as_raw_fd(),
                leaf.as_ptr(),
                libc::O_WRONLY | libc::O_CREAT | libc::O_EXCL | libc::O_CLOEXEC | libc::O_NOFOLLOW,
                mode as libc::mode_t as libc::c_uint,
            )
        };
        if raw < 0 {
            let error = std::io::Error::last_os_error();
            return Err(CopyFailure::from_io(
                format!(
                    "Could not securely create regular file {}",
                    display.display()
                ),
                &error,
            ));
        }
        // SAFETY: `openat` returned a new owned descriptor, transferred to `File`.
        let file = unsafe { File::from_raw_fd(raw) };
        require_regular_fd(file.as_raw_fd(), display).map_err(CopyFailure::other)?;
        Ok(file)
    }

    fn inspect_regular_or_absent(
        &self,
        leaf: &CString,
        display: &Path,
    ) -> Result<Option<FileFingerprint>, String> {
        let Some(mut opened) = self.open_regular_leaf(leaf, display)? else {
            return Ok(None);
        };
        Ok(Some(fingerprint_open_file(&mut opened.file, opened.mode)?))
    }

    fn unlink_regular_or_absent(&self, path: &Path) -> Result<(), String> {
        let (parent, leaf) = match self.open_parent_path(path, false) {
            Ok(value) => value,
            Err(error) if secure_error_is_not_found(&error) => return Ok(()),
            Err(error) => return Err(error),
        };
        let Some(opened) = parent.open_regular_leaf(&leaf, path)? else {
            return Ok(());
        };
        let opened_identity = fd_identity(opened.file.as_raw_fd())?;

        #[cfg(test)]
        run_before_unlink_revalidate_hook();

        let Some(current) = fstatat_nofollow(parent.fd.as_raw_fd(), &leaf, &parent.path)? else {
            return Ok(());
        };
        if (current.st_mode & libc::S_IFMT) != libc::S_IFREG
            || (current.st_dev as u64, current.st_ino as u64) != opened_identity
        {
            return Err(format!(
                "Removal leaf changed after secure open; refusing unlink: {}",
                path.display()
            ));
        }
        if unsafe { libc::unlinkat(parent.fd.as_raw_fd(), leaf.as_ptr(), 0) } != 0 {
            let error = std::io::Error::last_os_error();
            if error.raw_os_error() == Some(libc::ENOENT) {
                return Ok(());
            }
            return Err(format!(
                "Could not securely remove {}: {error}",
                path.display()
            ));
        }
        parent.sync()
    }

    fn remove_empty_dir_path(&self, path: &Path) -> Result<(), String> {
        let (parent, leaf) = match self.open_parent_path(path, false) {
            Ok(value) => value,
            Err(error) if secure_error_is_not_found(&error) => return Ok(()),
            Err(error) => return Err(error),
        };
        if unsafe { libc::unlinkat(parent.fd.as_raw_fd(), leaf.as_ptr(), libc::AT_REMOVEDIR) } == 0
        {
            return parent.sync();
        }
        let error = std::io::Error::last_os_error();
        if error.raw_os_error() == Some(libc::ENOENT)
            || error.raw_os_error() == Some(libc::ENOTEMPTY)
        {
            Ok(())
        } else {
            Err(format!(
                "Could not securely remove directory {}: {error}",
                path.display()
            ))
        }
    }

    fn sync(&self) -> Result<(), String> {
        if unsafe { libc::fsync(self.fd.as_raw_fd()) } == 0 {
            Ok(())
        } else {
            Err(format!(
                "Could not sync directory {}: {}",
                self.path.display(),
                std::io::Error::last_os_error()
            ))
        }
    }

    fn same_object_as(&self, other: &Self) -> Result<bool, String> {
        Ok(fd_identity(self.fd.as_raw_fd())? == fd_identity(other.fd.as_raw_fd())?)
    }
}

#[cfg(test)]
fn run_before_unlink_revalidate_hook() {
    BEFORE_UNLINK_REVALIDATE.with(|slot| {
        if let Some(hook) = slot.borrow_mut().take() {
            hook();
        }
    });
}

fn validate_absolute_canonical_path(path: &Path) -> Result<(), String> {
    if !path.is_absolute()
        || path
            .components()
            .any(|component| matches!(component, Component::CurDir | Component::ParentDir))
    {
        return Err(format!(
            "Refusing non-canonical absolute secure path {}",
            path.display()
        ));
    }
    Ok(())
}

fn validate_relative_path(path: &Path, allow_empty: bool) -> Result<(), String> {
    if (!allow_empty && path.as_os_str().is_empty())
        || path
            .components()
            .any(|component| !matches!(component, Component::Normal(_)))
    {
        return Err(format!(
            "Refusing absolute, parent-relative, or non-canonical secure path {}",
            path.display()
        ));
    }
    Ok(())
}

fn c_component(component: &std::ffi::OsStr) -> Result<CString, String> {
    CString::new(component.as_bytes())
        .map_err(|_| format!("Path component contains an embedded NUL: {component:?}"))
}

fn require_directory_fd(fd: RawFd, display: &Path) -> Result<(), String> {
    let stat = fstat_fd(fd, display)?;
    if (stat.st_mode & libc::S_IFMT) == libc::S_IFDIR {
        Ok(())
    } else {
        Err(format!(
            "Secure path is not a directory: {}",
            display.display()
        ))
    }
}

fn require_regular_fd(fd: RawFd, display: &Path) -> Result<u32, String> {
    let stat = fstat_fd(fd, display)?;
    if (stat.st_mode & libc::S_IFMT) == libc::S_IFREG {
        Ok(stat.st_mode as u32)
    } else {
        Err(format!(
            "Secure path is not a regular file (symlink or non-file refused): {}",
            display.display()
        ))
    }
}

fn fstat_fd(fd: RawFd, display: &Path) -> Result<libc::stat, String> {
    // SAFETY: zero is a valid initial byte representation for `stat`; `fstat` initializes it.
    let mut stat = unsafe { std::mem::zeroed::<libc::stat>() };
    if unsafe { libc::fstat(fd, &mut stat) } == 0 {
        Ok(stat)
    } else {
        Err(format!(
            "Could not inspect secure descriptor for {}: {}",
            display.display(),
            std::io::Error::last_os_error()
        ))
    }
}

fn fd_identity(fd: RawFd) -> Result<(u64, u64), String> {
    let stat = fstat_fd(fd, Path::new("<directory-fd>"))?;
    Ok((stat.st_dev as u64, stat.st_ino as u64))
}

fn resolved_fd_path(fd: RawFd, display: &Path) -> Result<PathBuf, String> {
    let mut buffer = [0 as libc::c_char; libc::PATH_MAX as usize];
    if unsafe { libc::fcntl(fd, libc::F_GETPATH, buffer.as_mut_ptr()) } < 0 {
        return Err(format!(
            "Could not resolve opened descriptor {}: {}",
            display.display(),
            std::io::Error::last_os_error()
        ));
    }
    let bytes = unsafe { CStr::from_ptr(buffer.as_ptr()) }.to_bytes();
    let resolved = PathBuf::from(OsString::from_vec(bytes.to_vec()));
    validate_absolute_canonical_path(&resolved)?;
    Ok(resolved)
}

fn secure_error_is_not_found(error: &str) -> bool {
    // `openat` errors are formatted only at this boundary. Preserve the errno marker so optional
    // paths can distinguish absence without silently accepting ELOOP/ENOTDIR.
    error.contains(&format!("[errno={}]", libc::ENOENT))
}

fn remove_secure_child_tree(
    parent: &SecureDirectory,
    child_name: &std::ffi::OsStr,
    display: &Path,
) -> Result<(), String> {
    let child_relative = Path::new(child_name);
    validate_relative_path(child_relative, false)?;
    let child = match parent.open_dir_relative(child_relative, false) {
        Ok(child) => child,
        Err(error) if secure_error_is_not_found(&error) => return Ok(()),
        Err(error) => {
            return Err(format!(
                "Refusing non-directory or symlink secure cleanup root {}: {error}",
                display.display()
            ));
        }
    };
    remove_secure_directory_contents(&child)?;
    let child_c = c_component(child_name)?;
    if unsafe { libc::unlinkat(parent.fd.as_raw_fd(), child_c.as_ptr(), libc::AT_REMOVEDIR) } != 0 {
        let error = std::io::Error::last_os_error();
        if error.raw_os_error() == Some(libc::ENOENT) {
            return Ok(());
        }
        return Err(format!(
            "Could not remove secure transaction directory {}: {error}",
            display.display()
        ));
    }
    parent.sync()
}

fn remove_secure_directory_contents(directory: &SecureDirectory) -> Result<(), String> {
    for name in secure_directory_entries(directory)? {
        let name_c = c_component(&name)?;
        // SAFETY: zero is a valid initial byte representation for `stat`; `fstatat` initializes it.
        let mut stat = unsafe { std::mem::zeroed::<libc::stat>() };
        if unsafe {
            libc::fstatat(
                directory.fd.as_raw_fd(),
                name_c.as_ptr(),
                &mut stat,
                libc::AT_SYMLINK_NOFOLLOW,
            )
        } != 0
        {
            let error = std::io::Error::last_os_error();
            if error.raw_os_error() == Some(libc::ENOENT) {
                continue;
            }
            return Err(format!(
                "Could not inspect secure cleanup entry {name:?}: {error}"
            ));
        }
        if (stat.st_mode & libc::S_IFMT) == libc::S_IFDIR {
            let child = directory.open_dir_relative(Path::new(&name), false)?;
            remove_secure_directory_contents(&child)?;
            if unsafe {
                libc::unlinkat(
                    directory.fd.as_raw_fd(),
                    name_c.as_ptr(),
                    libc::AT_REMOVEDIR,
                )
            } != 0
            {
                return Err(format!(
                    "Could not remove secure cleanup directory {name:?}: {}",
                    std::io::Error::last_os_error()
                ));
            }
            #[cfg(test)]
            run_after_retired_cleanup_entry_hook();
        } else if unsafe { libc::unlinkat(directory.fd.as_raw_fd(), name_c.as_ptr(), 0) } != 0 {
            let error = std::io::Error::last_os_error();
            if error.raw_os_error() != Some(libc::ENOENT) {
                return Err(format!(
                    "Could not remove secure cleanup entry {name:?}: {error}"
                ));
            }
        } else {
            #[cfg(test)]
            run_after_retired_cleanup_entry_hook();
        }
    }
    directory.sync()
}

fn secure_directory_entries(directory: &SecureDirectory) -> Result<Vec<OsString>, String> {
    let duplicate = unsafe { libc::fcntl(directory.fd.as_raw_fd(), libc::F_DUPFD_CLOEXEC, 0) };
    if duplicate < 0 {
        return Err(format!(
            "Could not duplicate secure cleanup directory {}: {}",
            directory.path.display(),
            std::io::Error::last_os_error()
        ));
    }
    let stream = unsafe { libc::fdopendir(duplicate) };
    if stream.is_null() {
        let error = std::io::Error::last_os_error();
        unsafe { libc::close(duplicate) };
        return Err(format!(
            "Could not enumerate secure cleanup directory {}: {error}",
            directory.path.display()
        ));
    }
    let mut entries = Vec::new();
    loop {
        unsafe { *libc::__error() = 0 };
        let entry = unsafe { libc::readdir(stream) };
        if entry.is_null() {
            let errno = unsafe { *libc::__error() };
            unsafe { libc::closedir(stream) };
            return if errno == 0 {
                Ok(entries)
            } else {
                Err(format!(
                    "Could not enumerate secure cleanup directory {}: {}",
                    directory.path.display(),
                    std::io::Error::from_raw_os_error(errno)
                ))
            };
        }
        let bytes = unsafe { CStr::from_ptr((*entry).d_name.as_ptr()) }.to_bytes();
        if bytes == b"." || bytes == b".." {
            continue;
        }
        entries.push(OsString::from_vec(bytes.to_vec()));
    }
}

#[derive(Debug, Clone, Copy, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
enum JournalPhase {
    Prepared,
    Applying,
    Signing,
    BundleVerified,
    StateCommitting,
    StateCommitted,
    Committed,
    Restored,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
#[serde(deny_unknown_fields)]
struct FileFingerprint {
    sha256: String,
    mode: u32,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
#[serde(deny_unknown_fields)]
struct ExpectedFileState {
    /// `None` is an exact absent-file constraint, not an unspecified value.
    fingerprint: Option<FileFingerprint>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct MacBundlePreimageConstraint {
    destination: PathBuf,
    expected: ExpectedFileState,
}

impl MacBundlePreimageConstraint {
    pub(crate) fn existing(destination: PathBuf, sha256: impl Into<String>, mode: u32) -> Self {
        let mode = if (mode as libc::mode_t & libc::S_IFMT) == 0 {
            (mode & 0o7777) | libc::S_IFREG as u32
        } else {
            mode
        };
        Self {
            destination,
            expected: ExpectedFileState {
                fingerprint: Some(FileFingerprint {
                    sha256: sha256.into(),
                    mode,
                }),
            },
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) enum MacApplyBeginError {
    CavalryStillRunning { pids: Vec<u32> },
    ProcessInspection(String),
    Transaction(CopyFailure),
}

impl MacApplyBeginError {
    pub(crate) fn display(&self) -> String {
        match self {
            Self::CavalryStillRunning { pids } => format!(
                "Selected Cavalry is still running with exact process ID(s): {}",
                pids.iter()
                    .map(u32::to_string)
                    .collect::<Vec<_>>()
                    .join(", ")
            ),
            Self::ProcessInspection(detail) => detail.clone(),
            Self::Transaction(error) => error.display(),
        }
    }

    pub(crate) fn is_permission_denied(&self) -> bool {
        matches!(self, Self::Transaction(error) if error.allows_administrator_retry())
    }

    #[cfg(test)]
    fn into_copy_failure(self) -> CopyFailure {
        match self {
            Self::Transaction(error) => error,
            other => CopyFailure::other(other.display()),
        }
    }
}

impl From<CopyFailure> for MacApplyBeginError {
    fn from(error: CopyFailure) -> Self {
        Self::Transaction(error)
    }
}

impl From<ExactProcessGuardError> for MacApplyBeginError {
    fn from(error: ExactProcessGuardError) -> Self {
        match error {
            ExactProcessGuardError::StillRunning { pids } => Self::CavalryStillRunning { pids },
            ExactProcessGuardError::Inspection(detail) => Self::ProcessInspection(detail),
        }
    }
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
#[serde(deny_unknown_fields)]
struct JournalEntry {
    destination: String,
    backup_name: Option<String>,
    original_mode: Option<u32>,
    original_sha256: Option<String>,
    scope: EntryScope,
    intermediate_copies: Vec<FileFingerprint>,
    expected_copy: Option<FileFingerprint>,
    expected_absent: bool,
    signing_side_effect: bool,
    required_preimage: Option<ExpectedFileState>,
    signing_preimage: Option<ExpectedFileState>,
    signing_postimage: Option<ExpectedFileState>,
    verified_post: Option<FileFingerprint>,
    verified_post_absent: bool,
}

/// Exact bundle inputs that this transaction intentionally does not mutate. They are validated
/// with the journal and rechecked before the first mutation and before bundle verification, so an
/// asset filtered as unchanged cannot drift into a successfully committed language generation.
#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
#[serde(deny_unknown_fields)]
struct ObservedBundlePreimage {
    destination: String,
    expected: ExpectedFileState,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
#[serde(deny_unknown_fields)]
struct QuarantinePreimage {
    relative_path: String,
    value_hex: String,
}

#[derive(Debug, Clone, Copy, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
enum EntryScope {
    Bundle,
    State,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
#[serde(deny_unknown_fields)]
struct JournalManifest {
    schema_version: u32,
    operation_id: String,
    phase: JournalPhase,
    install_root: String,
    state_path: String,
    entries: Vec<JournalEntry>,
    observed_bundle_preimages: Vec<ObservedBundlePreimage>,
    created_parent_directories: Vec<String>,
    pair_destinations: Vec<String>,
    deferred_destinations: Vec<String>,
    deferred_removals: Vec<String>,
    deferred_publish_authorized: bool,
    deferred_published: bool,
    temporary_paths: Vec<String>,
    state_temporary_paths: Vec<String>,
    quarantine_preimages: Vec<QuarantinePreimage>,
    // schema 6 的旧版 manifest 带有 Keychain HMAC。继续接受该字段，保证已中断事务
    // 可以恢复；新写入不再序列化它，避免 ad-hoc 更新后触发系统密码框。
    #[serde(default, rename = "authenticationTag", skip_serializing)]
    _legacy_authentication_tag: String,
}

struct JournalPreparationGuard {
    root: PathBuf,
    state_root: SecureDirectory,
    preserved: bool,
}

impl JournalPreparationGuard {
    fn new(root: PathBuf, state_root: &SecureDirectory) -> Result<Self, String> {
        Ok(Self {
            root,
            state_root: state_root.duplicate()?,
            preserved: false,
        })
    }

    fn preserve(&mut self) {
        self.preserved = true;
    }

    fn published_at(&mut self, root: PathBuf) {
        self.root = root;
    }
}

impl Drop for JournalPreparationGuard {
    fn drop(&mut self) {
        if !self.preserved {
            if let Some(name) = self.root.file_name() {
                let _ = remove_secure_child_tree(&self.state_root, name, &self.root);
            }
        }
    }
}

#[derive(Debug)]
pub(crate) struct MacApplyTransaction {
    journal_root: PathBuf,
    journal_dir: SecureDirectory,
    bundle_root: SecureDirectory,
    state_root: SecureDirectory,
    manifest: JournalManifest,
    deferred_pair_destinations: HashSet<PathBuf>,
    deferred_removal_destinations: HashSet<PathBuf>,
    active: bool,
}

type ExactMutationGuard<'a> = Box<dyn FnMut(&Path) -> Result<(), ExactProcessGuardError> + 'a>;

impl MacApplyTransaction {
    /// Captures caller-owned exact preimage constraints. The guarded begin API re-reads all of
    /// them through its own pinned root and requires the set to cover every planned bundle
    /// destination, so this preflight helper cannot itself authorize a stale transaction.
    pub(crate) fn capture_preimages(
        app_path: &Path,
        destinations: &[PathBuf],
    ) -> Result<Vec<MacBundlePreimageConstraint>, String> {
        let bundle_root = SecureDirectory::open_resolved(app_path, "selected Cavalry bundle")?;
        let mut seen = HashSet::new();
        let mut constraints = Vec::with_capacity(destinations.len());
        for destination in destinations {
            validate_destination(
                destination,
                EntryScope::Bundle,
                &bundle_root.path,
                Path::new(""),
            )?;
            if !seen.insert(destination.clone()) {
                return Err(format!(
                    "Refusing duplicate macOS preimage destination {}",
                    destination.display()
                ));
            }
            let expected = ExpectedFileState {
                fingerprint: current_fingerprint_at(&bundle_root, destination)?,
            };
            constraints.push(MacBundlePreimageConstraint {
                destination: destination.clone(),
                expected,
            });
        }
        Ok(constraints)
    }

    /// Test-only compatibility entry for exercising recovery without the production process and
    /// caller-preimage gates. Production callers must use the guarded constructor below.
    #[cfg(test)]
    pub(crate) fn begin(
        state_dir: &Path,
        app_path: &Path,
        pairs: &[CopyPair],
    ) -> Result<Self, CopyFailure> {
        Self::begin_with_removals(state_dir, app_path, pairs, &[])
    }

    #[cfg(test)]
    pub(crate) fn begin_with_removals(
        state_dir: &Path,
        app_path: &Path,
        pairs: &[CopyPair],
        removals: &[PathBuf],
    ) -> Result<Self, CopyFailure> {
        Self::begin_with_removals_and_side_effects(state_dir, app_path, pairs, removals, &[])
    }

    #[cfg(test)]
    pub(crate) fn begin_with_removals_and_side_effects(
        state_dir: &Path,
        app_path: &Path,
        pairs: &[CopyPair],
        removals: &[PathBuf],
        side_effect_paths: &[PathBuf],
    ) -> Result<Self, CopyFailure> {
        Self::begin_internal(
            state_dir,
            app_path,
            &[],
            &[],
            pairs,
            &[],
            removals,
            &[],
            side_effect_paths,
            None,
            None,
        )
        .map_err(MacApplyBeginError::into_copy_failure)
    }

    #[cfg(test)]
    pub(crate) fn begin_with_deferred_pairs(
        state_dir: &Path,
        app_path: &Path,
        intermediate_pairs: &[CopyPair],
        payload_pairs: &[CopyPair],
        deferred_pairs: &[CopyPair],
        removals: &[PathBuf],
        side_effect_paths: &[PathBuf],
    ) -> Result<Self, CopyFailure> {
        Self::begin_internal(
            state_dir,
            app_path,
            intermediate_pairs,
            &[],
            payload_pairs,
            deferred_pairs,
            removals,
            &[],
            side_effect_paths,
            None,
            None,
        )
        .map_err(MacApplyBeginError::into_copy_failure)
    }

    /// Strict production entry: exact caller preimages are checked through the pinned bundle fd;
    /// the exact executable is scanned before preparation and publication, then once more after a
    /// first-install wrapper/Info launch gate is live but before ordinary payload mutation.
    /// Official restore keeps the managed launcher and marker in place until the vendor Info.plist
    /// deferred pair and deferred runtime removals cross the same structurally validated commit gate.
    /// Nothing in `deferred_removals` is deleted by begin.
    #[allow(clippy::too_many_arguments)]
    pub(crate) fn begin_with_deferred_pairs_and_removals_guarded(
        state_dir: &Path,
        app_path: &Path,
        intermediate_pairs: &[CopyPair],
        launch_gate_pairs: &[CopyPair],
        payload_pairs: &[CopyPair],
        deferred_pairs: &[CopyPair],
        removals: &[PathBuf],
        deferred_removals: &[PathBuf],
        side_effect_paths: &[PathBuf],
        preimages: &[MacBundlePreimageConstraint],
    ) -> Result<Self, MacApplyBeginError> {
        Self::begin_with_deferred_pairs_and_removals_guarded_by(
            state_dir,
            app_path,
            intermediate_pairs,
            launch_gate_pairs,
            payload_pairs,
            deferred_pairs,
            removals,
            deferred_removals,
            side_effect_paths,
            preimages,
            guard_exact_cavalry_not_running,
        )
    }

    /// Deterministic test seam for the exact-process guard used by the strict constructor.
    #[cfg(test)]
    #[allow(clippy::too_many_arguments)]
    pub(crate) fn begin_with_deferred_pairs_guarded_by<'a, G>(
        state_dir: &Path,
        app_path: &Path,
        intermediate_pairs: &[CopyPair],
        payload_pairs: &[CopyPair],
        deferred_pairs: &[CopyPair],
        removals: &[PathBuf],
        side_effect_paths: &[PathBuf],
        preimages: &[MacBundlePreimageConstraint],
        process_guard: G,
    ) -> Result<Self, MacApplyBeginError>
    where
        G: FnMut(&Path) -> Result<(), ExactProcessGuardError> + 'a,
    {
        Self::begin_with_deferred_pairs_and_removals_guarded_by(
            state_dir,
            app_path,
            intermediate_pairs,
            &[],
            payload_pairs,
            deferred_pairs,
            removals,
            &[],
            side_effect_paths,
            preimages,
            process_guard,
        )
    }

    #[allow(clippy::too_many_arguments)]
    pub(crate) fn begin_with_deferred_pairs_and_removals_guarded_by<'a, G>(
        state_dir: &Path,
        app_path: &Path,
        intermediate_pairs: &[CopyPair],
        launch_gate_pairs: &[CopyPair],
        payload_pairs: &[CopyPair],
        deferred_pairs: &[CopyPair],
        removals: &[PathBuf],
        deferred_removals: &[PathBuf],
        side_effect_paths: &[PathBuf],
        preimages: &[MacBundlePreimageConstraint],
        process_guard: G,
    ) -> Result<Self, MacApplyBeginError>
    where
        G: FnMut(&Path) -> Result<(), ExactProcessGuardError> + 'a,
    {
        Self::begin_internal(
            state_dir,
            app_path,
            intermediate_pairs,
            launch_gate_pairs,
            payload_pairs,
            deferred_pairs,
            removals,
            deferred_removals,
            side_effect_paths,
            Some(preimages),
            Some(Box::new(process_guard)),
        )
    }

    #[allow(clippy::too_many_arguments)]
    fn begin_internal<'a>(
        state_dir: &Path,
        app_path: &Path,
        intermediate_pairs: &[CopyPair],
        launch_gate_pairs: &[CopyPair],
        payload_pairs: &[CopyPair],
        deferred_pairs: &[CopyPair],
        removals: &[PathBuf],
        deferred_removals: &[PathBuf],
        side_effect_paths: &[PathBuf],
        required_preimages: Option<&[MacBundlePreimageConstraint]>,
        mut process_guard: Option<ExactMutationGuard<'a>>,
    ) -> Result<Self, MacApplyBeginError> {
        let bundle_root = SecureDirectory::open_resolved(app_path, "selected Cavalry bundle")
            .map_err(CopyFailure::other)?;
        let canonical_app = bundle_root.path.clone();
        validate_launch_gate_pairs(launch_gate_pairs, &bundle_root).map_err(CopyFailure::other)?;
        let all_pairs = launch_gate_pairs
            .iter()
            .chain(payload_pairs.iter())
            .chain(deferred_pairs.iter())
            .cloned()
            .collect::<Vec<_>>();
        let mut all_removals = removals.to_vec();
        all_removals.extend_from_slice(deferred_removals);
        let mut destination_plans =
            build_destination_plans(&all_pairs, &all_removals, side_effect_paths, &canonical_app)?;
        attach_intermediate_copy_plans(&mut destination_plans, intermediate_pairs, deferred_pairs)?;
        let created_parent_directories =
            missing_bundle_parent_directories(&all_pairs, &canonical_app)?;

        let observed_bundle_preimages = if let Some(required) = required_preimages {
            validate_required_preimage_set(&destination_plans, required, &bundle_root)?
        } else {
            Vec::new()
        };
        let exact_executable = if process_guard.is_some() {
            let executable = bundle_root
                .open_regular_relative(Path::new("Contents/MacOS/Cavalry"))
                .map_err(CopyFailure::other)?
                .ok_or_else(|| {
                    CopyFailure::other(
                        "Selected Cavalry bundle has no regular Contents/MacOS/Cavalry executable.",
                    )
                })?;
            let exact_executable = resolved_fd_path(executable.file.as_raw_fd(), &bundle_root.path)
                .map_err(CopyFailure::other)?;
            process_guard.as_mut().expect("guard presence checked")(&exact_executable)?;
            Some(exact_executable)
        } else {
            None
        };

        // Everything above is read-only. The process guard therefore runs inside begin and before
        // even the state journal is created, while later exact-preimage checks/CAS close the
        // remaining journal-preparation-to-bundle-publication window.
        let journal_root = journal_root(state_dir);
        ensure_state_directory(state_dir)?;
        let state_root = SecureDirectory::open(state_dir).map_err(CopyFailure::other)?;
        cleanup_retired_journals_best_effort(state_dir);
        if fs::symlink_metadata(&journal_root).is_ok() {
            return Err(CopyFailure::other(format!(
                "A previous macOS apply journal still exists at {}. Recover it before starting another apply.",
                journal_root.display()
            )).into());
        }
        let state_path = state_dir.join("state.json");
        let state_paths = state::state_transaction_paths(state_dir);
        let operation_id = state::new_operation_id();
        let preparation_root =
            state_dir.join(format!(".{JOURNAL_DIRECTORY}.preparing-{operation_id}"));
        if fs::symlink_metadata(&preparation_root).is_ok() {
            return Err(CopyFailure::other(format!(
                "Refusing an existing macOS transaction preparation root {}",
                preparation_root.display()
            ))
            .into());
        }

        let preparation_name = preparation_root.file_name().ok_or_else(|| {
            CopyFailure::other("macOS apply journal preparation has no directory name.")
        })?;
        let preparation_name_c = c_component(preparation_name).map_err(CopyFailure::other)?;
        if unsafe {
            libc::mkdirat(
                state_root.fd.as_raw_fd(),
                preparation_name_c.as_ptr(),
                0o700,
            )
        } != 0
        {
            let error = std::io::Error::last_os_error();
            return Err(CopyFailure::from_io(
                format!(
                    "Could not securely create macOS apply journal preparation {}",
                    preparation_root.display()
                ),
                &error,
            )
            .into());
        }
        let mut preparation_guard =
            JournalPreparationGuard::new(preparation_root.clone(), &state_root)
                .map_err(CopyFailure::other)?;
        let preparation_dir = state_root
            .open_dir_path(&preparation_root, false)
            .map_err(CopyFailure::other)?;
        let backups = preparation_root.join("backups");
        let backups_name = CString::new("backups").expect("static backup directory name");
        if unsafe { libc::mkdirat(preparation_dir.fd.as_raw_fd(), backups_name.as_ptr(), 0o700) }
            != 0
        {
            let error = std::io::Error::last_os_error();
            return Err(CopyFailure::from_io(
                format!(
                    "Could not securely create macOS recovery backups {}",
                    backups.display()
                ),
                &error,
            )
            .into());
        }
        let backups_dir = preparation_dir
            .open_dir_relative(Path::new("backups"), false)
            .map_err(CopyFailure::other)?;
        // Persist the journal and backup directory entries before any bundle
        // mutation. Syncing files alone is insufficient after a power loss.
        backups_dir.sync().map_err(CopyFailure::other)?;
        preparation_dir.sync().map_err(CopyFailure::other)?;
        state_root.sync().map_err(CopyFailure::other)?;

        let quarantine_preimages =
            collect_quarantine_preimages(&bundle_root).map_err(CopyFailure::other)?;

        let roots = TransactionRoots {
            bundle: &bundle_root,
            state: &state_root,
        };
        let mut entries = Vec::with_capacity(destination_plans.len() + state_paths.len());
        for plan in destination_plans {
            let mut entry = backup_entry(
                &plan.destination,
                EntryScope::Bundle,
                &canonical_app,
                &state_path,
                &backups_dir,
                &roots,
                entries.len(),
            )?;
            entry.expected_copy = plan.expected_copy;
            entry.intermediate_copies = plan.intermediate_copies;
            entry.expected_absent = plan.expected_absent;
            entry.signing_side_effect = plan.signing_side_effect;
            entry.required_preimage = required_preimages.and_then(|constraints| {
                constraints
                    .iter()
                    .find(|constraint| constraint.destination == plan.destination)
                    .map(|constraint| constraint.expected.clone())
            });
            if let Some(required) = &entry.required_preimage {
                let captured = ExpectedFileState {
                    fingerprint: original_fingerprint(&entry).map_err(CopyFailure::other)?,
                };
                if &captured != required {
                    return Err(CopyFailure::other(format!(
                        "Pinned macOS preimage changed while journaling {}",
                        plan.destination.display()
                    ))
                    .into());
                }
            }
            entries.push(entry);
        }
        for state_destination in &state_paths {
            entries.push(backup_entry(
                state_destination,
                EntryScope::State,
                &canonical_app,
                &state_path,
                &backups_dir,
                &roots,
                entries.len(),
            )?);
        }
        backups_dir.sync().map_err(CopyFailure::other)?;

        let mut manifest = JournalManifest {
            schema_version: MANIFEST_SCHEMA,
            operation_id: operation_id.clone(),
            phase: JournalPhase::Prepared,
            install_root: path_string(&canonical_app).map_err(CopyFailure::other)?,
            state_path: path_string(&state_path).map_err(CopyFailure::other)?,
            entries,
            observed_bundle_preimages,
            created_parent_directories: created_parent_directories
                .iter()
                .map(|path| path_string(path).map_err(CopyFailure::other))
                .collect::<Result<Vec<_>, _>>()?,
            pair_destinations: all_pairs
                .iter()
                .map(|pair| path_string(&pair.dst).map_err(CopyFailure::other))
                .collect::<Result<Vec<_>, _>>()?,
            deferred_destinations: deferred_pairs
                .iter()
                .map(|pair| path_string(&pair.dst).map_err(CopyFailure::other))
                .collect::<Result<Vec<_>, _>>()?,
            deferred_removals: deferred_removals
                .iter()
                .map(|path| path_string(path).map_err(CopyFailure::other))
                .collect::<Result<Vec<_>, _>>()?,
            deferred_publish_authorized: deferred_pairs.is_empty() && deferred_removals.is_empty(),
            deferred_published: deferred_pairs.is_empty() && deferred_removals.is_empty(),
            temporary_paths: all_pairs
                .iter()
                .enumerate()
                .map(|(index, pair)| path_string(&temporary_path_for_pair(pair, index)))
                .collect::<Result<Vec<_>, _>>()
                .map_err(CopyFailure::other)?,
            state_temporary_paths: state::state_transaction_temporary_paths(
                state_dir,
                &operation_id,
            )
            .iter()
            .map(|path| path_string(path).map_err(CopyFailure::other))
            .collect::<Result<Vec<_>, _>>()?,
            quarantine_preimages,
            _legacy_authentication_tag: String::new(),
        };
        write_manifest(&preparation_dir, &manifest).map_err(CopyFailure::other)?;
        preparation_dir.sync().map_err(CopyFailure::other)?;
        // The first scan keeps a running Cavalry from creating any state-side effects. Repeat the
        // exact executable scan after potentially expensive backup/quarantine capture and as close
        // as possible to journal publication + the first bundle mutation. A process that launched
        // during preparation therefore fails closed while the unpublished preparation guard can
        // still remove the journal without touching bundle preimages.
        if let (Some(process_guard), Some(exact_executable)) =
            (process_guard.as_mut(), exact_executable.as_ref())
        {
            process_guard(exact_executable)?;
        }
        #[cfg(test)]
        if take_test_failpoint(&FAIL_BEFORE_JOURNAL_PUBLISH) {
            return Err(CopyFailure::other(
                "simulated interruption before macOS journal publication",
            )
            .into());
        }
        let journal_name = CString::new(JOURNAL_DIRECTORY).expect("static journal directory name");
        if unsafe {
            libc::renameatx_np(
                state_root.fd.as_raw_fd(),
                preparation_name_c.as_ptr(),
                state_root.fd.as_raw_fd(),
                journal_name.as_ptr(),
                libc::RENAME_EXCL,
            )
        } != 0
        {
            let error = std::io::Error::last_os_error();
            return Err(CopyFailure::from_io(
                format!(
                    "Could not atomically publish macOS apply journal {}",
                    journal_root.display()
                ),
                &error,
            )
            .into());
        }
        preparation_guard.published_at(journal_root.clone());
        state_root.sync().map_err(CopyFailure::other)?;
        let journal_dir = SecureDirectory {
            fd: preparation_dir.fd,
            path: journal_root.clone(),
        };
        manifest.phase = JournalPhase::Applying;
        write_manifest(&journal_dir, &manifest).map_err(CopyFailure::other)?;

        let mut transaction = Self {
            journal_root,
            journal_dir,
            bundle_root,
            state_root,
            manifest,
            deferred_pair_destinations: deferred_pairs
                .iter()
                .map(|pair| pair.dst.clone())
                .collect(),
            deferred_removal_destinations: deferred_removals.iter().cloned().collect(),
            active: true,
        };
        preparation_guard.preserve();
        if let Err(error) = transaction.verify_required_preimages() {
            let rolled_back = transaction.rollback_with_cause(format!(
                "Pinned macOS preimage changed before the first bundle mutation: {error}"
            ));
            return Err(CopyFailure::other(rolled_back).into());
        }
        for pair in intermediate_pairs {
            if let Err(error) = transaction.apply_intermediate_pair(pair) {
                let cause = format!(
                    "Could not publish pending macOS language marker at {}: {error}",
                    pair.dst.display()
                );
                let rolled_back = transaction.rollback_with_cause(cause);
                return Err(error.with_message(rolled_back).into());
            }
        }
        for pair in launch_gate_pairs {
            if let Err(error) = transaction.apply_journaled_pair(pair, false) {
                let cause = format!(
                    "Could not publish the journal-aware macOS launch gate at {}: {error}",
                    pair.dst.display()
                );
                let rolled_back = transaction.rollback_with_cause(cause);
                return Err(error.with_message(rolled_back).into());
            }
        }
        // On the first managed install the original Info.plist launched Cavalry directly. The
        // durable journal is therefore not a launch exclusion until CavalryLauncher exists and
        // Info.plist routes Finder through it. Publish that minimal pair first, then scan the exact
        // vendor executable a third time before any JSON/runtime payload is touched.
        if let (Some(process_guard), Some(exact_executable)) =
            (process_guard.as_mut(), exact_executable.as_ref())
        {
            if let Err(guard_error) = process_guard(exact_executable) {
                let rollback = restore_manifest_with_roots(
                    &transaction.journal_dir,
                    TransactionRoots {
                        bundle: &transaction.bundle_root,
                        state: &transaction.state_root,
                    },
                    &transaction.manifest,
                );
                transaction.active = false;
                if let Err(rollback_error) = rollback {
                    return Err(CopyFailure::other(format!(
                        "{} The early launch gate could not be rolled back; recovery journal was retained at {}: {rollback_error}",
                        guard_error,
                        transaction.journal_root.display()
                    ))
                    .into());
                }
                return Err(guard_error.into());
            }
        }
        for pair in payload_pairs {
            if let Err(error) = transaction.apply_journaled_pair(pair, false) {
                let cause = format!("Copy transaction failed at {}: {error}", pair.dst.display());
                let rolled_back = transaction.rollback_with_cause(cause);
                return Err(error.with_message(rolled_back).into());
            }
        }
        for destination in removals {
            let entry = transaction
                .entry_for_destination(destination)
                .ok_or_else(|| {
                    CopyFailure::other(format!(
                        "macOS transaction journal omitted removal destination {}",
                        destination.display()
                    ))
                })?;
            let roots = TransactionRoots {
                bundle: &transaction.bundle_root,
                state: &transaction.state_root,
            };
            if let Err(error) = verify_current_matches_preimage(entry, roots) {
                let cause = format!(
                    "Copy transaction detected destination drift before removing {}: {error}",
                    destination.display()
                );
                let rolled_back = transaction.rollback_with_cause(cause);
                return Err(CopyFailure::other(rolled_back).into());
            }
            if let Err(error) = remove_path_safely(destination, &transaction.bundle_root) {
                let cause = format!(
                    "Copy transaction could not remove managed runtime {}: {error}",
                    destination.display()
                );
                let rolled_back = transaction.rollback_with_cause(cause);
                return Err(CopyFailure::other(rolled_back).into());
            }
        }
        Ok(transaction)
    }

    pub(crate) fn apply_deferred_pair(&mut self, pair: &CopyPair) -> Result<(), CopyFailure> {
        if self.manifest.phase != JournalPhase::Signing {
            return Err(CopyFailure::other(
                "Final macOS language marker may only be published during the signing phase.",
            ));
        }
        if !self.manifest.deferred_publish_authorized {
            return Err(CopyFailure::other(
                "Final macOS language marker is not authorized by the pre-marker bundle gate.",
            ));
        }
        if !self.deferred_pair_destinations.contains(&pair.dst) {
            return Err(CopyFailure::other(format!(
                "Refusing unjournaled or repeated deferred destination {}",
                pair.dst.display()
            )));
        }
        self.apply_journaled_pair(pair, true)?;
        self.deferred_pair_destinations.remove(&pair.dst);
        self.persist_deferred_publication_state()
            .map_err(CopyFailure::other)
    }

    /// Applies commit-gated removals only after the non-deferred payload/signing proof gate. This
    /// is the official-restore seam that keeps the managed launcher and pending-journal guard
    /// executable until the vendor Info.plist and all other vendor preimages are ready.
    pub(crate) fn apply_deferred_removals(&mut self) -> Result<(), String> {
        if self.manifest.phase != JournalPhase::Signing {
            return Err(
                "Deferred macOS removals may only be published during Signing.".to_string(),
            );
        }
        if !self.manifest.deferred_publish_authorized {
            return Err(
                "Deferred macOS removals are not authorized by the commit gate.".to_string(),
            );
        }
        if !self.deferred_pair_destinations.is_empty() {
            return Err(
                "Deferred macOS replacements must be published before managed runtime removals."
                    .to_string(),
            );
        }
        let mut destinations = self
            .deferred_removal_destinations
            .iter()
            .cloned()
            .collect::<Vec<_>>();
        destinations.sort();
        for destination in destinations {
            let entry = self.entry_for_destination(&destination).ok_or_else(|| {
                format!(
                    "macOS transaction journal omitted deferred removal {}",
                    destination.display()
                )
            })?;
            let roots = TransactionRoots {
                bundle: &self.bundle_root,
                state: &self.state_root,
            };
            verify_current_matches_preimage(entry, roots)?;
            remove_path_safely(&destination, &self.bundle_root)?;
            self.deferred_removal_destinations.remove(&destination);
            self.persist_deferred_publication_state()?;
        }
        Ok(())
    }

    fn persist_deferred_publication_state(&mut self) -> Result<(), String> {
        self.manifest.deferred_published = self.deferred_pair_destinations.is_empty()
            && self.deferred_removal_destinations.is_empty();
        write_manifest(&self.journal_dir, &self.manifest)
    }

    pub(crate) fn begin_signing(&mut self) -> Result<(), String> {
        if self.manifest.phase != JournalPhase::Applying {
            return Err("macOS transaction is not ready to enter signing.".to_string());
        }
        self.verify_observed_bundle_preimages()?;
        let roots = TransactionRoots {
            bundle: &self.bundle_root,
            state: &self.state_root,
        };
        for entry in self
            .manifest
            .entries
            .iter_mut()
            .filter(|entry| entry.scope == EntryScope::Bundle && entry.signing_side_effect)
        {
            if entry.expected_absent {
                require_absent(entry, roots)?;
            } else if entry.expected_copy.is_some() {
                verify_current_matches_expected_copy(entry, roots)?;
            } else {
                verify_current_matches_preimage(entry, roots)?;
            }
            entry.signing_preimage = Some(ExpectedFileState {
                fingerprint: roots.current_fingerprint(entry)?,
            });
            entry.signing_postimage = None;
        }
        self.manifest.phase = JournalPhase::Signing;
        write_manifest(&self.journal_dir, &self.manifest)
    }

    /// Runs caller-supplied signature verification against the current kernel-resolved path of
    /// the pinned bundle, then records exact fd-relative postimages for every bounded signing side
    /// effect in the durable journal. An unrecorded bounded Signing-phase mutation is
    /// authorized only as a CAS rollback input; it can never satisfy a verification/commit gate.
    pub(crate) fn verify_and_record_signing_postimages<F>(
        &mut self,
        verifier: F,
    ) -> Result<(), String>
    where
        F: FnOnce(&Path) -> Result<(), String>,
    {
        if self.manifest.phase != JournalPhase::Signing {
            return Err("macOS transaction is not in its signing phase.".to_string());
        }
        let current_root =
            resolved_fd_path(self.bundle_root.fd.as_raw_fd(), &self.bundle_root.path)?;
        let roots = TransactionRoots {
            bundle: &self.bundle_root,
            state: &self.state_root,
        };
        let candidates = self
            .manifest
            .entries
            .iter()
            .enumerate()
            .filter(|(_, entry)| entry.scope == EntryScope::Bundle && entry.signing_side_effect)
            .map(|(index, entry)| {
                Ok((
                    index,
                    ExpectedFileState {
                        fingerprint: roots.current_fingerprint(entry)?,
                    },
                ))
            })
            .collect::<Result<Vec<_>, String>>()?;

        // A verifier is read-only. Capture its candidate bytes first, then verify and re-read the
        // same pinned vnode set. This prevents a change in the verifier→fingerprint window from
        // being journaled as though the verifier had approved it.
        verifier(&current_root)?;
        let visible_root = SecureDirectory::open_resolved(
            &current_root,
            "Cavalry bundle after signing verification",
        )?;
        if !self.bundle_root.same_object_as(&visible_root)? {
            return Err(
                "Selected Cavalry bundle identity changed during signing verification.".to_string(),
            );
        }
        for (index, candidate) in &candidates {
            let entry = &self.manifest.entries[*index];
            let current = roots.current_fingerprint(entry)?;
            if candidate.fingerprint != current {
                return Err(format!(
                    "Signing side effect changed during explicit verification at {}",
                    entry.destination
                ));
            }
        }
        for (index, candidate) in candidates {
            self.manifest.entries[index].signing_postimage = Some(candidate);
        }
        write_manifest(&self.journal_dir, &self.manifest)
    }

    /// Authorizes the committed-looking final marker only after every non-deferred payload and
    /// every explicitly verified signing postimage still matches on pinned descriptors.
    pub(crate) fn authorize_deferred_commit(&mut self) -> Result<(), String> {
        self.authorize_deferred_pair_publish()
    }

    /// Compatibility spelling retained while callers migrate to `authorize_deferred_commit`;
    /// the gate covers deferred pairs and deferred removals together.
    pub(crate) fn authorize_deferred_pair_publish(&mut self) -> Result<(), String> {
        if self.manifest.phase != JournalPhase::Signing {
            return Err("macOS transaction is not in its signing phase.".to_string());
        }
        self.verify_observed_bundle_preimages()?;
        if self.deferred_pair_destinations.is_empty()
            && self.deferred_removal_destinations.is_empty()
        {
            self.manifest.deferred_publish_authorized = true;
            self.manifest.deferred_published = true;
            return write_manifest(&self.journal_dir, &self.manifest);
        }
        let deferred_pairs = &self.deferred_pair_destinations;
        let deferred_removals = &self.deferred_removal_destinations;
        let roots = TransactionRoots {
            bundle: &self.bundle_root,
            state: &self.state_root,
        };
        for entry in self
            .manifest
            .entries
            .iter()
            .filter(|entry| entry.scope == EntryScope::Bundle)
        {
            if deferred_pairs.contains(Path::new(&entry.destination))
                || deferred_removals.contains(Path::new(&entry.destination))
            {
                continue;
            }
            if entry.signing_side_effect {
                let current = roots.current_fingerprint(entry)?;
                if !matches_expected_file_state(&entry.signing_postimage, &current) {
                    return Err(format!(
                        "Signing postimage was not explicitly verified for {}",
                        entry.destination
                    ));
                }
            } else if entry.expected_absent {
                require_absent(entry, roots)?;
            } else if entry.expected_copy.is_some() {
                verify_current_matches_expected_copy(entry, roots)?;
            }
        }
        self.manifest.deferred_publish_authorized = true;
        if let Err(error) = write_manifest(&self.journal_dir, &self.manifest) {
            self.manifest.deferred_publish_authorized = false;
            return Err(error);
        }
        Ok(())
    }

    pub(crate) fn checkpoint_verified_bundle(&mut self) -> Result<(), String> {
        if self.manifest.phase != JournalPhase::Signing {
            return Err("macOS transaction is not in its signing phase.".to_string());
        }
        self.verify_observed_bundle_preimages()?;
        if !self.deferred_pair_destinations.is_empty() {
            return Err("Final macOS language marker was not published.".to_string());
        }
        if !self.deferred_removal_destinations.is_empty() {
            return Err("Commit-gated macOS removals were not published.".to_string());
        }
        if !self.manifest.deferred_publish_authorized || !self.manifest.deferred_published {
            return Err(
                "Final macOS language marker did not cross its durable commit gate.".to_string(),
            );
        }
        let roots = TransactionRoots {
            bundle: &self.bundle_root,
            state: &self.state_root,
        };
        for entry in self
            .manifest
            .entries
            .iter_mut()
            .filter(|entry| entry.scope == EntryScope::Bundle)
        {
            if entry.signing_side_effect {
                let current = roots.current_fingerprint(entry)?;
                if !matches_expected_file_state(&entry.signing_postimage, &current) {
                    return Err(format!(
                        "Signing side effect lacks a verified exact postimage at {}",
                        entry.destination
                    ));
                }
            } else {
                if entry.expected_absent {
                    require_absent(entry, roots)?;
                } else if entry.expected_copy.is_some() {
                    verify_current_matches_expected_copy(entry, roots)?;
                }
            }
            snapshot_verified_postimage(entry, roots)?;
        }
        self.manifest.phase = JournalPhase::BundleVerified;
        write_manifest(&self.journal_dir, &self.manifest)
    }

    pub(crate) fn begin_state_commit(&mut self) -> Result<(), String> {
        if self.manifest.phase != JournalPhase::BundleVerified {
            return Err("macOS bundle postconditions have not been checkpointed.".to_string());
        }
        self.verify_observed_bundle_preimages()?;
        self.manifest.phase = JournalPhase::StateCommitting;
        write_manifest(&self.journal_dir, &self.manifest)
    }

    pub(crate) fn checkpoint_state_commit(&mut self) -> Result<(), String> {
        if self.manifest.phase != JournalPhase::StateCommitting {
            return Err("macOS transaction is not committing state.".to_string());
        }
        self.verify_observed_bundle_preimages()?;
        let state_dir = resolved_fd_path(self.state_root.fd.as_raw_fd(), &self.state_root.path)?;
        let document = state::read_state_document(&state_dir).map_err(|error| error.to_string())?;
        if document.operation_id != self.manifest.operation_id {
            return Err(
                "Committed state operation ID does not match the macOS transaction journal."
                    .to_string(),
            );
        }
        #[cfg(test)]
        if take_test_failpoint(&FAIL_NEXT_STATE_DURABILITY_SYNC) {
            return Err("simulated uncertain state durability before StateCommitted".to_string());
        }
        // A state writer may report that rename succeeded while its directory fsync was
        // uncertain. Re-fsync the pinned directory here; failure leaves the durable journal
        // in StateCommitting, where exact CAS rollback remains permitted.
        self.state_root.sync().map_err(|error| {
            format!("State durability is still uncertain; refusing StateCommitted: {error}")
        })?;
        let roots = TransactionRoots {
            bundle: &self.bundle_root,
            state: &self.state_root,
        };
        for entry in self
            .manifest
            .entries
            .iter_mut()
            .filter(|entry| entry.scope == EntryScope::State)
        {
            snapshot_verified_postimage(entry, roots)?;
        }
        self.manifest.phase = JournalPhase::StateCommitted;
        write_manifest(&self.journal_dir, &self.manifest)
    }

    fn apply_intermediate_pair(&mut self, pair: &CopyPair) -> Result<(), CopyFailure> {
        if self.manifest.phase != JournalPhase::Applying {
            return Err(CopyFailure::other(
                "macOS transaction is not applying its pending marker.",
            ));
        }
        if !self.deferred_pair_destinations.contains(&pair.dst) {
            return Err(CopyFailure::other(format!(
                "Refusing intermediate copy without a deferred final destination: {}",
                pair.dst.display()
            )));
        }
        let entry = self.entry_for_destination(&pair.dst).ok_or_else(|| {
            CopyFailure::other("Intermediate transaction destination metadata is missing.")
        })?;
        let fingerprint = fingerprint_regular_file(&pair.src).map_err(CopyFailure::other)?;
        if !entry.intermediate_copies.contains(&fingerprint) {
            return Err(CopyFailure::other(format!(
                "Intermediate transaction source was not journaled for {}",
                pair.dst.display()
            )));
        }
        let roots = TransactionRoots {
            bundle: &self.bundle_root,
            state: &self.state_root,
        };
        verify_current_matches_preimage(entry, roots).map_err(CopyFailure::other)?;
        let accepted = [original_fingerprint(entry).map_err(CopyFailure::other)?];
        let pair_index = self
            .manifest
            .pair_destinations
            .iter()
            .position(|destination| Path::new(destination) == pair.dst)
            .ok_or_else(|| {
                CopyFailure::other("Deferred transaction destination index is missing.")
            })?;
        let temporary = PathBuf::from(&self.manifest.temporary_paths[pair_index]);
        write_pair_atomically(pair, &temporary, &self.bundle_root, &fingerprint, &accepted)
    }

    fn apply_journaled_pair(
        &mut self,
        pair: &CopyPair,
        allow_intermediate_preimage: bool,
    ) -> Result<(), CopyFailure> {
        let pair_index = self
            .manifest
            .pair_destinations
            .iter()
            .position(|destination| Path::new(destination) == pair.dst)
            .ok_or_else(|| {
                CopyFailure::other(format!(
                    "macOS transaction journal omitted copy destination {}",
                    pair.dst.display()
                ))
            })?;
        let entry = self.entry_for_destination(&pair.dst).ok_or_else(|| {
            CopyFailure::other("macOS transaction destination metadata is missing.")
        })?;
        if allow_intermediate_preimage {
            let roots = TransactionRoots {
                bundle: &self.bundle_root,
                state: &self.state_root,
            };
            let current = roots
                .current_fingerprint(entry)
                .map_err(CopyFailure::other)?;
            if !matches_preimage(entry, &current).map_err(CopyFailure::other)?
                && !entry
                    .intermediate_copies
                    .iter()
                    .any(|expected| current.as_ref() == Some(expected))
            {
                return Err(CopyFailure::other(format!(
                    "{} no longer matches its pending marker postimage",
                    entry.destination
                )));
            }
        } else {
            let roots = TransactionRoots {
                bundle: &self.bundle_root,
                state: &self.state_root,
            };
            verify_current_matches_preimage(entry, roots).map_err(CopyFailure::other)?;
        }
        let mut accepted = vec![original_fingerprint(entry).map_err(CopyFailure::other)?];
        if allow_intermediate_preimage {
            accepted.extend(entry.intermediate_copies.iter().cloned().map(Some));
        }
        let expected_copy = entry
            .expected_copy
            .clone()
            .ok_or_else(|| CopyFailure::other("Transaction copy postimage is missing."))?;
        let temporary = PathBuf::from(&self.manifest.temporary_paths[pair_index]);
        write_pair_atomically(
            pair,
            &temporary,
            &self.bundle_root,
            &expected_copy,
            &accepted,
        )?;
        if current_fingerprint_at(&self.bundle_root, &pair.dst)
            .map_err(CopyFailure::other)?
            .as_ref()
            != Some(&expected_copy)
        {
            return Err(CopyFailure::other(format!(
                "Atomic copy postimage did not verify at {}",
                pair.dst.display()
            )));
        }
        Ok(())
    }

    fn entry_for_destination(&self, destination: &Path) -> Option<&JournalEntry> {
        self.manifest
            .entries
            .iter()
            .find(|entry| Path::new(&entry.destination) == destination)
    }

    fn verify_required_preimages(&self) -> Result<(), String> {
        let roots = TransactionRoots {
            bundle: &self.bundle_root,
            state: &self.state_root,
        };
        for entry in self
            .manifest
            .entries
            .iter()
            .filter(|entry| entry.scope == EntryScope::Bundle)
        {
            let Some(required) = &entry.required_preimage else {
                continue;
            };
            let current = ExpectedFileState {
                fingerprint: roots.current_fingerprint(entry)?,
            };
            if &current != required {
                return Err(format!(
                    "required preimage mismatch at {}",
                    entry.destination
                ));
            }
        }
        self.verify_observed_bundle_preimages()
    }

    fn verify_observed_bundle_preimages(&self) -> Result<(), String> {
        for observed in &self.manifest.observed_bundle_preimages {
            let current = ExpectedFileState {
                fingerprint: current_fingerprint_at(
                    &self.bundle_root,
                    Path::new(&observed.destination),
                )?,
            };
            if current != observed.expected {
                return Err(format!(
                    "observe-only macOS preimage drifted at {}",
                    observed.destination
                ));
            }
        }
        Ok(())
    }

    pub(crate) fn commit(mut self) -> Result<CopyCompletion, String> {
        if self.manifest.phase != JournalPhase::StateCommitted {
            return Err(self.rollback_with_cause(
                "Refusing to commit a macOS transaction before durable state postconditions.",
            ));
        }
        self.manifest.phase = JournalPhase::Committed;
        if let Err(error) = write_manifest(&self.journal_dir, &self.manifest) {
            self.active = false;
            return Ok(CopyCompletion::new("direct").with_warning(PostCommitWarning::new(
                PostCommitWarningCode::TransactionBackupCleanup,
                [self.journal_root.clone()],
                Some(format!(
                    "State and bundle committed, but the cleanup phase could not be persisted: {error}"
                )),
            )));
        }
        self.active = false;
        match retire_and_cleanup_journal(
            &self.state_root,
            &self.manifest.operation_id,
            &self.journal_root,
        ) {
            Ok(()) => Ok(CopyCompletion::new("direct")),
            Err((residual, error)) => Ok(CopyCompletion::new("direct").with_warning(
                PostCommitWarning::new(
                    PostCommitWarningCode::TransactionBackupCleanup,
                    [residual],
                    Some(error),
                ),
            )),
        }
    }

    pub(crate) fn operation_id(&self) -> &str {
        &self.manifest.operation_id
    }

    pub(crate) fn rollback_with_cause(mut self, cause: impl Into<String>) -> String {
        let cause = cause.into();
        let rollback = restore_manifest_with_roots(
            &self.journal_dir,
            TransactionRoots {
                bundle: &self.bundle_root,
                state: &self.state_root,
            },
            &self.manifest,
        );
        self.active = false;
        match rollback {
            Ok(()) => format!("{cause} Exact bundle and state preimages were restored."),
            Err(error) => format!(
                "{cause} Rollback also failed; recovery journal was retained at {}: {error}",
                self.journal_root.display()
            ),
        }
    }
}

impl Drop for MacApplyTransaction {
    fn drop(&mut self) {
        if self.active {
            let _ = restore_manifest_with_roots(
                &self.journal_dir,
                TransactionRoots {
                    bundle: &self.bundle_root,
                    state: &self.state_root,
                },
                &self.manifest,
            );
            self.active = false;
        }
    }
}

/// Returns true when an interrupted transaction was restored. A state-committed or committed
/// journal only needs cleanup and returns false. Production recovery repeats the exact executable
/// guard inside the validated restore, after all CAS inputs have been captured and immediately
/// before the first recovery mutation.
pub(crate) fn recover_pending_guarded(state_dir: &Path, app_path: &Path) -> Result<bool, String> {
    let mut guard =
        |exact: &Path| guard_exact_cavalry_not_running(exact).map_err(|error| error.to_string());
    recover_pending_internal(state_dir, app_path, Some(&mut guard))
}

#[cfg(test)]
fn recover_pending(state_dir: &Path, app_path: &Path) -> Result<bool, String> {
    recover_pending_internal(state_dir, app_path, None)
}

fn recover_pending_internal(
    state_dir: &Path,
    app_path: &Path,
    process_guard: Option<&mut dyn FnMut(&Path) -> Result<(), String>>,
) -> Result<bool, String> {
    cleanup_retired_journals_best_effort(state_dir);
    let root = journal_root(state_dir);
    match fs::symlink_metadata(&root) {
        Err(error) if error.kind() == ErrorKind::NotFound => return Ok(false),
        Err(error) => return Err(error.to_string()),
        Ok(metadata) if metadata.file_type().is_symlink() || !metadata.is_dir() => {
            return Err(format!(
                "Pending macOS journal root is not a regular directory: {}",
                root.display()
            ));
        }
        Ok(_) => {}
    }
    let journal_dir = SecureDirectory::open(&root)?;
    let manifest = read_manifest(&journal_dir)?;
    let bundle_root = validate_manifest(&journal_dir, &manifest, state_dir, app_path)?;
    let state_root = SecureDirectory::open(state_dir)?;
    let roots = TransactionRoots {
        bundle: &bundle_root,
        state: &state_root,
    };
    if matches!(
        manifest.phase,
        JournalPhase::StateCommitted | JournalPhase::Committed
    ) {
        verify_committed_postimages(&manifest, roots)?;
        // Keep validated backups until the caller independently verifies the bundle's code
        // signature.  A valid hash checkpoint is not a substitute for a valid executable seal.
        return Ok(false);
    }
    if manifest.phase == JournalPhase::Restored {
        verify_all_preimages(&manifest, roots)?;
        return Ok(true);
    }
    verify_recovery_current_state(&manifest, roots)?;
    let mut process_guard = process_guard;
    let has_process_guard = process_guard.is_some();
    let mut before_mutation = || {
        let executable = bundle_root
            .open_regular_relative(Path::new("Contents/MacOS/Cavalry"))?
            .ok_or_else(|| {
                "Pending Cavalry recovery has no regular Contents/MacOS/Cavalry executable."
                    .to_string()
            })?;
        let exact_executable = resolved_fd_path(executable.file.as_raw_fd(), &bundle_root.path)?;
        process_guard
            .as_mut()
            .expect("guarded recovery installs a process guard")(&exact_executable)
    };
    let before_mutation =
        has_process_guard.then_some(&mut before_mutation as &mut dyn FnMut() -> Result<(), String>);
    restore_manifest_with_roots_guarded(&journal_dir, roots, &manifest, before_mutation)?;
    Ok(true)
}

pub(crate) fn finalize_recovered(state_dir: &Path, app_path: &Path) -> Result<(), String> {
    let root = journal_root(state_dir);
    let journal_dir = SecureDirectory::open(&root)?;
    let manifest = read_manifest(&journal_dir)?;
    let bundle_root = validate_manifest(&journal_dir, &manifest, state_dir, app_path)?;
    let state_root = SecureDirectory::open(state_dir)?;
    let roots = TransactionRoots {
        bundle: &bundle_root,
        state: &state_root,
    };
    match manifest.phase {
        JournalPhase::Restored => verify_all_preimages(&manifest, roots)?,
        JournalPhase::StateCommitted | JournalPhase::Committed => {
            verify_committed_postimages(&manifest, roots)?
        }
        _ => return Err("macOS recovery journal is not awaiting final verification.".to_string()),
    }
    retire_and_cleanup_journal(&state_root, &manifest.operation_id, &root)
        .map_err(|(_, error)| error)
}

fn journal_root(state_dir: &Path) -> PathBuf {
    state_dir.join(JOURNAL_DIRECTORY)
}

fn cleanup_tombstone_name(operation_id: &str) -> OsString {
    OsString::from(format!("{CLEANUP_TOMBSTONE_PREFIX}{operation_id}"))
}

/// Removes the canonical launch-blocking name in one atomic step. Recursive deletion happens only
/// after the state directory rename is durable, so interruption can leave at most an inert
/// tombstone rather than a half-deleted journal that the wrapper mistakes for pending work.
fn retire_and_cleanup_journal(
    state_root: &SecureDirectory,
    operation_id: &str,
    canonical_root: &Path,
) -> Result<(), (PathBuf, String)> {
    let canonical_name = CString::new(JOURNAL_DIRECTORY).expect("static journal directory name");
    let tombstone_name = cleanup_tombstone_name(operation_id);
    let tombstone_name_c =
        c_component(&tombstone_name).map_err(|error| (canonical_root.to_path_buf(), error))?;
    let tombstone = state_root.path.join(&tombstone_name);
    if unsafe {
        libc::renameatx_np(
            state_root.fd.as_raw_fd(),
            canonical_name.as_ptr(),
            state_root.fd.as_raw_fd(),
            tombstone_name_c.as_ptr(),
            libc::RENAME_EXCL,
        )
    } != 0
    {
        return Err((
            canonical_root.to_path_buf(),
            format!(
                "Could not atomically retire verified macOS journal {}: {}",
                canonical_root.display(),
                std::io::Error::last_os_error()
            ),
        ));
    }
    if let Err(error) = state_root.sync() {
        return Err((
            tombstone,
            format!(
                "Verified macOS journal was retired from its launch-blocking name, but state-directory durability is uncertain: {error}"
            ),
        ));
    }
    remove_secure_child_tree(state_root, &tombstone_name, &tombstone)
        .map_err(|error| (tombstone, error))
}

fn is_cleanup_tombstone_name(name: &std::ffi::OsStr) -> bool {
    let Some(name) = name.to_str() else {
        return false;
    };
    let Some(operation_id) = name.strip_prefix(CLEANUP_TOMBSTONE_PREFIX) else {
        return false;
    };
    !operation_id.is_empty()
        && operation_id.len() <= 128
        && operation_id
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_' | b'.'))
}

fn cleanup_retired_journals_best_effort(state_dir: &Path) {
    let Ok(state_root) = SecureDirectory::open(state_dir) else {
        return;
    };
    let Ok(names) = secure_directory_entries(&state_root) else {
        return;
    };
    for name in names
        .into_iter()
        .filter(|name| is_cleanup_tombstone_name(name))
    {
        let tombstone = state_root.path.join(&name);
        let _ = remove_secure_child_tree(&state_root, &name, &tombstone);
    }
}

pub(crate) fn has_pending(state_dir: &Path) -> bool {
    fs::symlink_metadata(journal_root(state_dir)).is_ok()
}

pub(crate) fn pending_requires_bundle_restore(
    state_dir: &Path,
    app_path: &Path,
) -> Result<bool, String> {
    let root = journal_root(state_dir);
    let journal_dir = SecureDirectory::open(&root)?;
    let manifest = read_manifest(&journal_dir)?;
    validate_manifest(&journal_dir, &manifest, state_dir, app_path)?;
    Ok(!matches!(
        manifest.phase,
        JournalPhase::StateCommitted | JournalPhase::Committed | JournalPhase::Restored
    ))
}

pub(crate) fn pending_install_root(state_dir: &Path) -> Result<Option<PathBuf>, String> {
    cleanup_retired_journals_best_effort(state_dir);
    let root = journal_root(state_dir);
    match fs::symlink_metadata(&root) {
        Err(error) if error.kind() == ErrorKind::NotFound => return Ok(None),
        Err(error) => return Err(error.to_string()),
        Ok(metadata) if metadata.file_type().is_symlink() || !metadata.is_dir() => {
            return Err(format!(
                "Pending macOS journal root is not a regular directory: {}",
                root.display()
            ));
        }
        Ok(_) => {}
    }
    let journal_dir = SecureDirectory::open(&root)?;
    let manifest = read_manifest(&journal_dir)?;
    let app_path = PathBuf::from(&manifest.install_root);
    if !app_path.is_absolute() {
        return Err("Pending macOS journal install root is not absolute.".to_string());
    }
    let bundle_root = validate_manifest(&journal_dir, &manifest, state_dir, &app_path)?;
    Ok(Some(bundle_root.path))
}

#[derive(Debug)]
struct DestinationPlan {
    destination: PathBuf,
    intermediate_copies: Vec<FileFingerprint>,
    expected_copy: Option<FileFingerprint>,
    expected_absent: bool,
    signing_side_effect: bool,
}

fn validate_required_preimage_set(
    plans: &[DestinationPlan],
    constraints: &[MacBundlePreimageConstraint],
    bundle_root: &SecureDirectory,
) -> Result<Vec<ObservedBundlePreimage>, CopyFailure> {
    if constraints.len() < plans.len() {
        return Err(CopyFailure::other(format!(
            "Strict macOS transaction requires one exact preimage for every bundle mutation ({} plans, {} constraints).",
            plans.len(),
            constraints.len()
        )));
    }
    let mut seen = HashSet::new();
    let mut observed = Vec::with_capacity(constraints.len().saturating_sub(plans.len()));
    for constraint in constraints {
        validate_destination(
            &constraint.destination,
            EntryScope::Bundle,
            &bundle_root.path,
            Path::new(""),
        )
        .map_err(CopyFailure::other)?;
        if !seen.insert(constraint.destination.clone()) {
            return Err(CopyFailure::other(format!(
                "Strict macOS transaction repeats preimage constraint {}",
                constraint.destination.display()
            )));
        }
        if let Some(expected) = &constraint.expected.fingerprint {
            if !is_sha256_hex(&expected.sha256) || !is_regular_file_mode(expected.mode) {
                return Err(CopyFailure::other(format!(
                    "Strict macOS transaction has an invalid sha256+mode preimage for {}",
                    constraint.destination.display()
                )));
            }
        }
        let current = ExpectedFileState {
            fingerprint: current_fingerprint_at(bundle_root, &constraint.destination)
                .map_err(CopyFailure::other)?,
        };
        if current != constraint.expected {
            return Err(CopyFailure::other(format!(
                "Strict macOS transaction preimage already drifted at {}",
                constraint.destination.display()
            )));
        }
        if !plans
            .iter()
            .any(|plan| plan.destination == constraint.destination)
        {
            observed.push(ObservedBundlePreimage {
                destination: path_string(&constraint.destination).map_err(CopyFailure::other)?,
                expected: constraint.expected.clone(),
            });
        }
    }
    for plan in plans {
        if !seen.contains(&plan.destination) {
            return Err(CopyFailure::other(format!(
                "Strict macOS transaction omitted preimage constraint {}",
                plan.destination.display()
            )));
        }
    }
    Ok(observed)
}

/// The first managed install has no wrapper capable of honoring the pending journal. Only these
/// two files may be published before the post-publication process scan, and the executable must be
/// present before Info.plist starts routing Finder launches through it.
fn validate_launch_gate_pairs(
    pairs: &[CopyPair],
    bundle_root: &SecureDirectory,
) -> Result<(), String> {
    let wrapper = bundle_root.path.join("Contents/MacOS/CavalryLauncher");
    let info = bundle_root.path.join("Contents/Info.plist");
    if pairs.len() > 2 {
        return Err("macOS launch gate may contain only the wrapper and Info.plist.".to_string());
    }
    let mut seen = HashSet::new();
    let mut previous_rank = None;
    for pair in pairs {
        let rank = if pair.dst == wrapper {
            0
        } else if pair.dst == info {
            1
        } else {
            return Err(format!(
                "Refusing non-launch macOS payload in the early launch gate: {}",
                pair.dst.display()
            ));
        };
        if !seen.insert(pair.dst.clone()) {
            return Err(format!(
                "macOS launch gate repeats destination {}",
                pair.dst.display()
            ));
        }
        if previous_rank.is_some_and(|previous| previous > rank) {
            return Err(
                "macOS launch gate must publish CavalryLauncher before Info.plist.".to_string(),
            );
        }
        previous_rank = Some(rank);
    }
    if seen.contains(&info)
        && !seen.contains(&wrapper)
        && bundle_root
            .open_regular_relative(Path::new("Contents/MacOS/CavalryLauncher"))?
            .is_none()
    {
        return Err(
            "Refusing to route Info.plist through a missing journal-aware CavalryLauncher."
                .to_string(),
        );
    }
    Ok(())
}

fn build_destination_plans(
    pairs: &[CopyPair],
    removals: &[PathBuf],
    side_effect_paths: &[PathBuf],
    canonical_app: &Path,
) -> Result<Vec<DestinationPlan>, CopyFailure> {
    let mut plans = Vec::<DestinationPlan>::new();
    for pair in pairs {
        if plans.iter().any(|plan| plan.destination == pair.dst) {
            return Err(CopyFailure::other(format!(
                "macOS transaction repeats copy destination {}",
                pair.dst.display()
            )));
        }
        plans.push(DestinationPlan {
            destination: pair.dst.clone(),
            intermediate_copies: Vec::new(),
            expected_copy: Some(fingerprint_regular_file(&pair.src).map_err(CopyFailure::other)?),
            expected_absent: false,
            signing_side_effect: false,
        });
    }
    for destination in removals {
        if plans.iter().any(|plan| plan.destination == *destination) {
            return Err(CopyFailure::other(format!(
                "macOS transaction cannot both copy and remove {}",
                destination.display()
            )));
        }
        plans.push(DestinationPlan {
            destination: destination.clone(),
            intermediate_copies: Vec::new(),
            expected_copy: None,
            expected_absent: true,
            signing_side_effect: false,
        });
    }
    for destination in side_effect_paths {
        if !is_allowed_signing_side_effect(canonical_app, destination) {
            return Err(CopyFailure::other(format!(
                "Refusing unbounded macOS signing side effect {}",
                destination.display()
            )));
        }
        if let Some(plan) = plans
            .iter_mut()
            .find(|plan| plan.destination == *destination)
        {
            plan.signing_side_effect = true;
        } else {
            plans.push(DestinationPlan {
                destination: destination.clone(),
                intermediate_copies: Vec::new(),
                expected_copy: None,
                expected_absent: false,
                signing_side_effect: true,
            });
        }
    }
    Ok(plans)
}

fn attach_intermediate_copy_plans(
    plans: &mut [DestinationPlan],
    intermediate_pairs: &[CopyPair],
    deferred_pairs: &[CopyPair],
) -> Result<(), CopyFailure> {
    let mut seen = HashSet::new();
    for pair in intermediate_pairs {
        if !seen.insert(pair.dst.clone()) {
            return Err(CopyFailure::other(format!(
                "macOS transaction repeats intermediate destination {}",
                pair.dst.display()
            )));
        }
        if !deferred_pairs
            .iter()
            .any(|deferred| deferred.dst == pair.dst)
        {
            return Err(CopyFailure::other(format!(
                "Intermediate macOS destination has no deferred final postimage: {}",
                pair.dst.display()
            )));
        }
        let plan = plans
            .iter_mut()
            .find(|plan| plan.destination == pair.dst)
            .ok_or_else(|| {
                CopyFailure::other(format!(
                    "Intermediate macOS destination was not journaled: {}",
                    pair.dst.display()
                ))
            })?;
        plan.intermediate_copies
            .push(fingerprint_regular_file(&pair.src).map_err(CopyFailure::other)?);
    }
    Ok(())
}

fn is_allowed_signing_side_effect(canonical_app: &Path, destination: &Path) -> bool {
    let fixed = [
        "Contents/_CodeSignature/CodeResources",
        "Contents/MacOS/Cavalry",
        "Contents/MacOS/CavalryLauncher",
        "Contents/Frameworks/libCavalryTranslatorInjector.dylib",
        "Contents/Frameworks/libExtensionLayer.dylib",
    ];
    fixed
        .iter()
        .chain(super::bundle::EXTERNAL_SIGNATURE_COMPONENTS.iter())
        .any(|relative| destination == canonical_app.join(relative))
}

fn collect_quarantine_preimages(
    bundle_root: &SecureDirectory,
) -> Result<Vec<QuarantinePreimage>, String> {
    let mut preimages = Vec::new();
    visit_quarantine_tree(bundle_root, &mut |node, relative| {
        if let Some(value) = read_quarantine_xattr_fd(node.fd.as_raw_fd(), &node.path)? {
            preimages.push(QuarantinePreimage {
                relative_path: if relative.as_os_str().is_empty() {
                    ".".to_string()
                } else {
                    path_string(relative)?
                },
                value_hex: encode_hex(&value),
            });
        }
        Ok(())
    })?;
    preimages.sort_by(|left, right| left.relative_path.cmp(&right.relative_path));
    Ok(preimages)
}

fn visit_quarantine_tree<F>(bundle_root: &SecureDirectory, visitor: &mut F) -> Result<(), String>
where
    F: FnMut(&SecureNode, &Path) -> Result<(), String>,
{
    let root = bundle_root.open_node_path(&bundle_root.path)?;
    visitor(&root, Path::new(""))?;
    visit_quarantine_directory(
        SecureDirectory {
            fd: root.fd,
            path: root.path,
        },
        Path::new(""),
        visitor,
    )
}

fn visit_quarantine_directory<F>(
    directory: SecureDirectory,
    relative_directory: &Path,
    visitor: &mut F,
) -> Result<(), String>
where
    F: FnMut(&SecureNode, &Path) -> Result<(), String>,
{
    let mut names = secure_directory_entries(&directory)?;
    names.sort();
    for name in names {
        let name_c = c_component(&name)?;
        // Legitimate framework symlinks stay inside the bundle inventory but are never followed.
        let Some(stat) = fstatat_nofollow(directory.fd.as_raw_fd(), &name_c, &directory.path)?
        else {
            continue;
        };
        if (stat.st_mode & libc::S_IFMT) == libc::S_IFLNK {
            continue;
        }
        let path = directory.path.join(&name);
        let relative = relative_directory.join(&name);
        let node = directory.open_node_leaf(&name_c, &path)?.ok_or_else(|| {
            format!(
                "Bundle node disappeared during quarantine walk: {}",
                path.display()
            )
        })?;
        let is_directory = node.is_directory();
        visitor(&node, &relative)?;
        if is_directory {
            #[cfg(test)]
            run_before_quarantine_descend_hook();
            visit_quarantine_directory(
                SecureDirectory {
                    fd: node.fd,
                    path: node.path,
                },
                &relative,
                visitor,
            )?;
        }
    }
    Ok(())
}

#[cfg(test)]
fn run_before_quarantine_descend_hook() {
    BEFORE_QUARANTINE_DESCEND.with(|slot| {
        if let Some(hook) = slot.borrow_mut().take() {
            hook();
        }
    });
}

fn fstatat_nofollow(
    parent_fd: RawFd,
    leaf: &CString,
    parent_display: &Path,
) -> Result<Option<libc::stat>, String> {
    // SAFETY: zero is a valid initial byte representation for `stat`; `fstatat` initializes it.
    let mut stat = unsafe { std::mem::zeroed::<libc::stat>() };
    if unsafe {
        libc::fstatat(
            parent_fd,
            leaf.as_ptr(),
            &mut stat,
            libc::AT_SYMLINK_NOFOLLOW,
        )
    } == 0
    {
        return Ok(Some(stat));
    }
    let error = std::io::Error::last_os_error();
    if error.raw_os_error() == Some(libc::ENOENT) {
        Ok(None)
    } else {
        Err(format!(
            "Could not inspect child of {} without following symlinks: {error}",
            parent_display.display()
        ))
    }
}

fn read_quarantine_xattr_fd(fd: RawFd, display: &Path) -> Result<Option<Vec<u8>>, String> {
    require_xattr_safe_fd(fd, display)?;
    let name = CString::new(QUARANTINE_XATTR).expect("static xattr name");
    for _ in 0..3 {
        let length = unsafe { libc::fgetxattr(fd, name.as_ptr(), std::ptr::null_mut(), 0, 0, 0) };
        if length < 0 {
            let error = std::io::Error::last_os_error();
            if error.raw_os_error() == Some(libc::ENOATTR) {
                return Ok(None);
            }
            return Err(format!(
                "Could not inspect Gatekeeper quarantine on {}: {error}",
                display.display()
            ));
        }
        let length = usize::try_from(length)
            .map_err(|_| "Gatekeeper quarantine length is invalid.".to_string())?;
        if length > MAX_QUARANTINE_VALUE_BYTES {
            return Err(format!(
                "Gatekeeper quarantine value exceeds {} bytes.",
                MAX_QUARANTINE_VALUE_BYTES
            ));
        }
        let mut value = vec![0_u8; length];
        let read = unsafe {
            libc::fgetxattr(
                fd,
                name.as_ptr(),
                value.as_mut_ptr().cast(),
                value.len(),
                0,
                0,
            )
        };
        if read >= 0 {
            value.truncate(
                usize::try_from(read)
                    .map_err(|_| "Gatekeeper quarantine read length is invalid.".to_string())?,
            );
            return Ok(Some(value));
        }
        let error = std::io::Error::last_os_error();
        if error.raw_os_error() == Some(libc::ENOATTR) {
            return Ok(None);
        }
        if error.raw_os_error() != Some(libc::ERANGE) {
            return Err(format!("Could not read Gatekeeper quarantine: {error}"));
        }
    }
    Err("Gatekeeper quarantine changed continuously during capture.".to_string())
}

fn restore_quarantine_xattr_fd(fd: RawFd, display: &Path, value: &[u8]) -> Result<(), String> {
    if read_quarantine_xattr_fd(fd, display)?.as_deref() == Some(value) {
        return Ok(());
    }
    require_xattr_safe_fd(fd, display)?;
    let name = CString::new(QUARANTINE_XATTR).expect("static xattr name");
    let result =
        unsafe { libc::fsetxattr(fd, name.as_ptr(), value.as_ptr().cast(), value.len(), 0, 0) };
    if result == 0 {
        Ok(())
    } else {
        Err(format!(
            "Could not restore Gatekeeper quarantine on {}: {}",
            display.display(),
            std::io::Error::last_os_error()
        ))
    }
}

fn remove_quarantine_xattr_fd(fd: RawFd, display: &Path) -> Result<(), String> {
    require_xattr_safe_fd(fd, display)?;
    let name = CString::new(QUARANTINE_XATTR).expect("static xattr name");
    let result = unsafe { libc::fremovexattr(fd, name.as_ptr(), 0) };
    if result == 0 {
        Ok(())
    } else {
        let error = std::io::Error::last_os_error();
        if error.raw_os_error() == Some(libc::ENOATTR) {
            return Ok(());
        }
        Err(format!(
            "Could not remove Gatekeeper quarantine from {}: {}",
            display.display(),
            error
        ))
    }
}

fn require_xattr_safe_fd(fd: RawFd, display: &Path) -> Result<(), String> {
    let stat = fstat_fd(fd, display)?;
    let kind = stat.st_mode & libc::S_IFMT;
    if kind != libc::S_IFREG && kind != libc::S_IFDIR {
        return Err(format!(
            "Refusing quarantine operation on non-regular/non-directory node {}",
            display.display()
        ));
    }
    if kind == libc::S_IFREG && stat.st_nlink > 1 {
        return Err(format!(
            "Refusing quarantine operation on hard-linked bundle file {}",
            display.display()
        ));
    }
    Ok(())
}

pub(crate) fn clear_quarantine_tree(app_path: &Path) -> Result<(), String> {
    let bundle_root = SecureDirectory::open_resolved(app_path, "Cavalry quarantine root")?;
    visit_quarantine_tree(&bundle_root, &mut |node, _relative| {
        remove_quarantine_xattr_fd(node.fd.as_raw_fd(), &node.path)
    })
}

#[cfg(test)]
fn open_test_quarantine_node(path: &Path) -> Result<SecureNode, String> {
    validate_absolute_canonical_path(path)?;
    let path_c = c_path(path)?;
    let raw = unsafe {
        libc::open(
            path_c.as_ptr(),
            libc::O_RDONLY | libc::O_CLOEXEC | libc::O_NOFOLLOW,
        )
    };
    if raw < 0 {
        return Err(format!(
            "Could not open test quarantine node {}: {}",
            path.display(),
            std::io::Error::last_os_error()
        ));
    }
    // SAFETY: `open` returned a new owned descriptor.
    let fd = unsafe { OwnedFd::from_raw_fd(raw) };
    let stat = fstat_fd(fd.as_raw_fd(), path)?;
    Ok(SecureNode {
        fd,
        path: path.to_path_buf(),
        mode: stat.st_mode as u32,
    })
}

#[cfg(test)]
fn read_quarantine_xattr(path: &Path) -> Result<Option<Vec<u8>>, String> {
    let node = open_test_quarantine_node(path)?;
    read_quarantine_xattr_fd(node.fd.as_raw_fd(), path)
}

#[cfg(test)]
fn restore_quarantine_xattr(path: &Path, value: &[u8]) -> Result<(), String> {
    let node = open_test_quarantine_node(path)?;
    restore_quarantine_xattr_fd(node.fd.as_raw_fd(), path, value)
}

#[cfg(test)]
fn remove_quarantine_xattr(path: &Path) -> Result<(), String> {
    let node = open_test_quarantine_node(path)?;
    remove_quarantine_xattr_fd(node.fd.as_raw_fd(), path)
}

fn c_path(path: &Path) -> Result<CString, String> {
    CString::new(path.as_os_str().as_bytes())
        .map_err(|_| format!("Path contains an embedded NUL: {}", path.display()))
}

fn encode_hex(bytes: &[u8]) -> String {
    const HEX: &[u8; 16] = b"0123456789abcdef";
    let mut output = String::with_capacity(bytes.len() * 2);
    for byte in bytes {
        output.push(HEX[(byte >> 4) as usize] as char);
        output.push(HEX[(byte & 0x0f) as usize] as char);
    }
    output
}

fn decode_hex(value: &str) -> Result<Vec<u8>, String> {
    if value.len() % 2 != 0 || value.len() > MAX_QUARANTINE_VALUE_BYTES * 2 {
        return Err("Pending macOS journal has an invalid quarantine value length.".to_string());
    }
    value
        .as_bytes()
        .chunks_exact(2)
        .map(|pair| {
            let high = hex_nibble(pair[0])?;
            let low = hex_nibble(pair[1])?;
            Ok((high << 4) | low)
        })
        .collect()
}

fn hex_nibble(value: u8) -> Result<u8, String> {
    match value {
        b'0'..=b'9' => Ok(value - b'0'),
        b'a'..=b'f' => Ok(value - b'a' + 10),
        _ => Err("Pending macOS journal quarantine value is not lowercase hex.".to_string()),
    }
}

fn quarantine_path(canonical_app: &Path, relative: &str) -> Result<PathBuf, String> {
    if relative == "." {
        return Ok(canonical_app.to_path_buf());
    }
    let relative = Path::new(relative);
    if relative.as_os_str().is_empty()
        || relative
            .components()
            .any(|component| !matches!(component, Component::Normal(_)))
    {
        return Err(format!(
            "Pending macOS journal has an invalid quarantine path: {}",
            relative.display()
        ));
    }
    let path = canonical_app.join(relative);
    reject_symlink_components(canonical_app, &path)?;
    Ok(path)
}

fn remove_path_safely(destination: &Path, bundle_root: &SecureDirectory) -> Result<(), String> {
    validate_destination(
        destination,
        EntryScope::Bundle,
        &bundle_root.path,
        Path::new(""),
    )?;
    bundle_root.unlink_regular_or_absent(destination)
}

fn backup_entry(
    destination: &Path,
    scope: EntryScope,
    canonical_app: &Path,
    state_path: &Path,
    backups: &SecureDirectory,
    roots: &TransactionRoots<'_>,
    index: usize,
) -> Result<JournalEntry, CopyFailure> {
    validate_destination(destination, scope, canonical_app, state_path)
        .map_err(CopyFailure::other)?;
    match roots
        .for_scope(scope)
        .open_regular_path(destination)
        .map_err(CopyFailure::other)?
    {
        Some(mut source) => {
            let backup_name = format!("{index}.preimage");
            let backup = backups.path.join(&backup_name);
            let backup_name_c =
                c_component(std::ffi::OsStr::new(&backup_name)).map_err(CopyFailure::other)?;
            let mut backup_file = backups.create_regular_leaf(&backup_name_c, &backup, 0o600)?;
            let original_hash =
                copy_and_hash(&mut source.file, &mut backup_file).map_err(CopyFailure::other)?;
            backup_file.sync_all().map_err(|error| {
                CopyFailure::from_io(
                    format!("Could not sync backup {}", backup.display()),
                    &error,
                )
            })?;
            Ok(JournalEntry {
                destination: path_string(destination).map_err(CopyFailure::other)?,
                backup_name: Some(backup_name),
                original_mode: Some(source.mode),
                original_sha256: Some(original_hash),
                scope,
                intermediate_copies: Vec::new(),
                expected_copy: None,
                expected_absent: false,
                signing_side_effect: false,
                required_preimage: None,
                signing_preimage: None,
                signing_postimage: None,
                verified_post: None,
                verified_post_absent: false,
            })
        }
        None => Ok(JournalEntry {
            destination: path_string(destination).map_err(CopyFailure::other)?,
            backup_name: None,
            original_mode: None,
            original_sha256: None,
            scope,
            intermediate_copies: Vec::new(),
            expected_copy: None,
            expected_absent: false,
            signing_side_effect: false,
            required_preimage: None,
            signing_preimage: None,
            signing_postimage: None,
            verified_post: None,
            verified_post_absent: false,
        }),
    }
}

fn fingerprint_regular_file(path: &Path) -> Result<FileFingerprint, String> {
    let mut opened = open_regular_nofollow(path)?.ok_or_else(|| {
        format!(
            "Expected a regular file at {}, but it does not exist.",
            path.display()
        )
    })?;
    fingerprint_open_file(&mut opened.file, opened.mode)
}

fn current_fingerprint_at(
    root: &SecureDirectory,
    path: &Path,
) -> Result<Option<FileFingerprint>, String> {
    let Some(mut opened) = root.open_regular_path(path)? else {
        return Ok(None);
    };
    Ok(Some(fingerprint_open_file(&mut opened.file, opened.mode)?))
}

fn open_regular_nofollow(path: &Path) -> Result<Option<SecureRegularFile>, String> {
    validate_absolute_canonical_path(path)?;
    let path_c = c_path(path)?;
    let raw = unsafe {
        libc::open(
            path_c.as_ptr(),
            libc::O_RDONLY | libc::O_CLOEXEC | libc::O_NOFOLLOW,
        )
    };
    if raw < 0 {
        let error = std::io::Error::last_os_error();
        if error.raw_os_error() == Some(libc::ENOENT) {
            return Ok(None);
        }
        return Err(format!(
            "Could not securely open regular file {}: {error}",
            path.display()
        ));
    }
    // SAFETY: `open` returned a new owned descriptor, transferred to `File`.
    let file = unsafe { File::from_raw_fd(raw) };
    let mode = require_regular_fd(file.as_raw_fd(), path)?;
    Ok(Some(SecureRegularFile { file, mode }))
}

fn original_fingerprint(entry: &JournalEntry) -> Result<Option<FileFingerprint>, String> {
    match (entry.original_sha256.as_ref(), entry.original_mode) {
        (Some(sha256), Some(mode)) => Ok(Some(FileFingerprint {
            sha256: sha256.clone(),
            mode,
        })),
        (None, None) => Ok(None),
        _ => Err(format!(
            "Incomplete original fingerprint for {}",
            entry.destination
        )),
    }
}

fn verify_current_matches_preimage(
    entry: &JournalEntry,
    roots: TransactionRoots<'_>,
) -> Result<(), String> {
    let current = roots.current_fingerprint(entry)?;
    let expected = original_fingerprint(entry)?;
    if current == expected {
        Ok(())
    } else {
        Err(format!(
            "{} no longer matches its journaled preimage",
            entry.destination
        ))
    }
}

fn verify_current_matches_expected_copy(
    entry: &JournalEntry,
    roots: TransactionRoots<'_>,
) -> Result<(), String> {
    let expected = entry.expected_copy.as_ref().ok_or_else(|| {
        format!(
            "Transaction entry has no intended copy postimage: {}",
            entry.destination
        )
    })?;
    if roots.current_fingerprint(entry)?.as_ref() == Some(expected) {
        Ok(())
    } else {
        Err(format!(
            "{} does not match its intended copy postimage",
            entry.destination
        ))
    }
}

fn require_absent(entry: &JournalEntry, roots: TransactionRoots<'_>) -> Result<(), String> {
    if roots.current_fingerprint(entry)?.is_none() {
        Ok(())
    } else {
        Err(format!(
            "Expected transaction removal at {}",
            entry.destination
        ))
    }
}

fn snapshot_verified_postimage(
    entry: &mut JournalEntry,
    roots: TransactionRoots<'_>,
) -> Result<(), String> {
    match roots.current_fingerprint(entry)? {
        Some(fingerprint) => {
            entry.verified_post = Some(fingerprint);
            entry.verified_post_absent = false;
        }
        None => {
            entry.verified_post = None;
            entry.verified_post_absent = true;
        }
    }
    Ok(())
}

fn matches_preimage(
    entry: &JournalEntry,
    current: &Option<FileFingerprint>,
) -> Result<bool, String> {
    Ok(current == &original_fingerprint(entry)?)
}

fn matches_expected_file_state(
    expected: &Option<ExpectedFileState>,
    current: &Option<FileFingerprint>,
) -> bool {
    expected
        .as_ref()
        .is_some_and(|expected| &expected.fingerprint == current)
}

fn matches_intended_postimage(entry: &JournalEntry, current: &Option<FileFingerprint>) -> bool {
    entry
        .intermediate_copies
        .iter()
        .any(|expected| current.as_ref() == Some(expected))
        || entry
            .expected_copy
            .as_ref()
            .is_some_and(|expected| current.as_ref() == Some(expected))
        || (entry.expected_absent && current.is_none())
}

fn matches_verified_postimage(entry: &JournalEntry, current: &Option<FileFingerprint>) -> bool {
    entry
        .verified_post
        .as_ref()
        .is_some_and(|expected| current.as_ref() == Some(expected))
        || (entry.verified_post_absent && current.is_none())
}

fn verify_recovery_current_state(
    manifest: &JournalManifest,
    roots: TransactionRoots<'_>,
) -> Result<(), String> {
    if matches!(
        manifest.phase,
        JournalPhase::StateCommitted | JournalPhase::Committed
    ) {
        return Err(
            "Refusing to roll back a state-committed macOS transaction; only cleanup is allowed."
                .to_string(),
        );
    }
    let state_preimages = manifest
        .entries
        .iter()
        .filter(|entry| entry.scope == EntryScope::State)
        .map(original_fingerprint)
        .collect::<Result<Vec<_>, _>>()?;

    for entry in &manifest.entries {
        let path = Path::new(&entry.destination);
        let current = roots.current_fingerprint(entry)?;
        let accepted = match (manifest.phase, entry.scope) {
            (JournalPhase::Prepared, _) => matches_preimage(entry, &current)?,
            (JournalPhase::Applying, EntryScope::Bundle) => {
                matches_preimage(entry, &current)? || matches_intended_postimage(entry, &current)
            }
            (JournalPhase::Applying, EntryScope::State)
            | (JournalPhase::Signing, EntryScope::State)
            | (JournalPhase::BundleVerified, EntryScope::State) => {
                matches_preimage(entry, &current)?
            }
            (JournalPhase::Signing, EntryScope::Bundle) => {
                if entry.signing_side_effect {
                    // `begin_signing` durably authorizes codesign to rewrite only the strict
                    // whitelist represented by signing_side_effect entries. A crash or verifier
                    // failure can occur after codesign mutates bytes but before an exact postimage
                    // is journaled. `current_fingerprint_at` already rejects symlink/non-regular
                    // drift; accept the exact current file/absence as the CAS input solely in this
                    // validated phase, then restore the backed-up preimage.
                    true
                } else {
                    matches_preimage(entry, &current)?
                        || matches_intended_postimage(entry, &current)
                        || matches_expected_file_state(&entry.signing_preimage, &current)
                        || matches_expected_file_state(&entry.signing_postimage, &current)
                }
            }
            (JournalPhase::BundleVerified, EntryScope::Bundle)
            | (JournalPhase::StateCommitting, EntryScope::Bundle) => {
                matches_verified_postimage(entry, &current)
            }
            (JournalPhase::StateCommitting, EntryScope::State) => {
                matches_preimage(entry, &current)?
                    || state_preimages.iter().any(|known| known == &current)
                    || state_document_has_operation(roots.state, path, &manifest.operation_id)
            }
            (
                JournalPhase::StateCommitted | JournalPhase::Committed | JournalPhase::Restored,
                _,
            ) => false,
        };
        if !accepted {
            return Err(format!(
                "Pending macOS recovery detected unknown destination drift at {}; no preimage was overwritten.",
                path.display()
            ));
        }
    }

    let canonical_app = Path::new(&manifest.install_root);
    for preimage in &manifest.quarantine_preimages {
        let path = quarantine_path(canonical_app, &preimage.relative_path)?;
        let expected = decode_hex(&preimage.value_hex)?;
        let node = roots.bundle.open_node_path(&path)?;
        let current = read_quarantine_xattr_fd(node.fd.as_raw_fd(), &path)?;
        if current.as_deref() != Some(expected.as_slice()) && current.is_some() {
            return Err(format!(
                "Pending macOS recovery detected unknown quarantine drift at {}; no xattr was overwritten.",
                path.display()
            ));
        }
    }
    Ok(())
}

fn state_document_has_operation(
    state_root: &SecureDirectory,
    path: &Path,
    operation_id: &str,
) -> bool {
    path.file_name().is_some_and(|name| name == "state.json")
        && resolved_fd_path(state_root.fd.as_raw_fd(), &state_root.path)
            .ok()
            .and_then(|state_dir| state::read_state_document(&state_dir).ok())
            .is_some_and(|document| document.operation_id == operation_id)
}

fn verify_committed_postimages(
    manifest: &JournalManifest,
    roots: TransactionRoots<'_>,
) -> Result<(), String> {
    for entry in &manifest.entries {
        let current = roots.current_fingerprint(entry)?;
        if !matches_verified_postimage(entry, &current) {
            return Err(format!(
                "Committed macOS transaction postimage drifted at {}; journal cleanup was refused.",
                entry.destination
            ));
        }
    }
    let state_dir = resolved_fd_path(roots.state.fd.as_raw_fd(), &roots.state.path)?;
    let document = state::read_state_document(&state_dir).map_err(|error| error.to_string())?;
    if document.operation_id != manifest.operation_id {
        return Err(
            "Committed macOS transaction state operation ID does not match its journal."
                .to_string(),
        );
    }
    Ok(())
}

fn verify_all_preimages(
    manifest: &JournalManifest,
    roots: TransactionRoots<'_>,
) -> Result<(), String> {
    for entry in &manifest.entries {
        verify_current_matches_preimage(entry, roots)?;
    }
    let canonical_app = Path::new(&manifest.install_root);
    for preimage in &manifest.quarantine_preimages {
        let path = quarantine_path(canonical_app, &preimage.relative_path)?;
        let expected = decode_hex(&preimage.value_hex)?;
        let node = roots.bundle.open_node_path(&path)?;
        if read_quarantine_xattr_fd(node.fd.as_raw_fd(), &path)?.as_deref()
            != Some(expected.as_slice())
        {
            return Err(format!(
                "Recovered quarantine preimage did not verify at {}",
                path.display()
            ));
        }
    }
    Ok(())
}

fn validate_manifest(
    journal_dir: &SecureDirectory,
    manifest: &JournalManifest,
    state_dir: &Path,
    app_path: &Path,
) -> Result<SecureDirectory, String> {
    if manifest.schema_version != MANIFEST_SCHEMA {
        return Err(format!(
            "Unsupported macOS apply journal schema {} at {}.",
            manifest.schema_version,
            journal_dir.path.display()
        ));
    }
    if manifest.operation_id.is_empty()
        || manifest.operation_id.len() > 128
        || !manifest
            .operation_id
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_' | b'.'))
    {
        return Err("Pending macOS journal has an invalid operation ID.".to_string());
    }
    let bundle_root = SecureDirectory::open_resolved(app_path, "pending Cavalry bundle")?;
    let canonical_app = &bundle_root.path;
    if Path::new(&manifest.install_root) != canonical_app {
        return Err(format!(
            "Pending macOS journal belongs to {}, not the selected {}.",
            manifest.install_root,
            canonical_app.display()
        ));
    }
    let state_path = state_dir.join("state.json");
    if Path::new(&manifest.state_path) != state_path {
        return Err(
            "Pending macOS journal state path does not match this application state directory."
                .to_string(),
        );
    }
    let mut destinations = HashSet::new();
    for (index, entry) in manifest.entries.iter().enumerate() {
        let destination = Path::new(&entry.destination);
        validate_destination(destination, entry.scope, &canonical_app, &state_path)?;
        if !destinations.insert(destination.to_path_buf()) {
            return Err(format!(
                "Pending macOS journal repeats destination {}.",
                destination.display()
            ));
        }
        match (
            &entry.backup_name,
            entry.original_mode,
            &entry.original_sha256,
        ) {
            (Some(name), Some(mode), Some(expected_hash)) => {
                if !is_sha256_hex(expected_hash) || !is_regular_file_mode(mode) {
                    return Err(
                        "Pending macOS journal contains an invalid regular-file preimage."
                            .to_string(),
                    );
                }
                if name != &format!("{index}.preimage") {
                    return Err(
                        "Pending macOS journal contains an invalid backup name.".to_string()
                    );
                }
                let backup = Path::new("backups").join(name);
                if sha256_regular_file_at(journal_dir, &backup)? != *expected_hash {
                    return Err(format!(
                        "Pending macOS recovery backup failed hash verification: {}",
                        journal_dir.path.join(&backup).display()
                    ));
                }
            }
            (None, None, None) => {}
            _ => {
                return Err(format!(
                    "Pending macOS journal has incomplete metadata for {}.",
                    destination.display()
                ));
            }
        }
        validate_entry_plan(entry, &canonical_app)?;
        if let Some(required) = &entry.required_preimage {
            if required.fingerprint != original_fingerprint(entry)? {
                return Err(format!(
                    "Pending macOS journal required preimage does not match its backup at {}.",
                    entry.destination
                ));
            }
        }
    }
    let mut observed_destinations = HashSet::new();
    for observed in &manifest.observed_bundle_preimages {
        let destination = Path::new(&observed.destination);
        validate_destination(destination, EntryScope::Bundle, &canonical_app, &state_path)?;
        if destinations.contains(destination)
            || !observed_destinations.insert(destination.to_path_buf())
        {
            return Err(format!(
                "Pending macOS journal repeats observe-only destination {}.",
                destination.display()
            ));
        }
        if let Some(fingerprint) = &observed.expected.fingerprint {
            if !is_sha256_hex(&fingerprint.sha256) || !is_regular_file_mode(fingerprint.mode) {
                return Err(format!(
                    "Pending macOS journal has an invalid observe-only fingerprint for {}.",
                    destination.display()
                ));
            }
        }
    }
    let has_verified_post =
        |entry: &JournalEntry| entry.verified_post.is_some() || entry.verified_post_absent;
    match manifest.phase {
        JournalPhase::Prepared
        | JournalPhase::Applying
        | JournalPhase::Signing
        | JournalPhase::Restored => {
            if manifest.entries.iter().any(has_verified_post) {
                return Err(
                    "Pending macOS journal records verified postimages before verification."
                        .to_string(),
                );
            }
        }
        JournalPhase::BundleVerified | JournalPhase::StateCommitting => {
            if manifest
                .entries
                .iter()
                .filter(|entry| entry.scope == EntryScope::Bundle)
                .any(|entry| !has_verified_post(entry))
                || manifest
                    .entries
                    .iter()
                    .filter(|entry| entry.scope == EntryScope::State)
                    .any(has_verified_post)
            {
                return Err(
                    "Pending macOS journal has incomplete bundle verification phase metadata."
                        .to_string(),
                );
            }
        }
        JournalPhase::StateCommitted | JournalPhase::Committed => {
            if manifest
                .entries
                .iter()
                .any(|entry| !has_verified_post(entry))
            {
                return Err(
                    "Committed macOS journal has incomplete verified postimages.".to_string(),
                );
            }
        }
    }
    let signing_entries = manifest
        .entries
        .iter()
        .filter(|entry| entry.scope == EntryScope::Bundle && entry.signing_side_effect)
        .collect::<Vec<_>>();
    match manifest.phase {
        JournalPhase::Prepared | JournalPhase::Applying => {
            if signing_entries
                .iter()
                .any(|entry| entry.signing_preimage.is_some() || entry.signing_postimage.is_some())
            {
                return Err(
                    "Pending macOS journal records signing evidence before Signing.".to_string(),
                );
            }
        }
        JournalPhase::Signing => {
            if signing_entries
                .iter()
                .any(|entry| entry.signing_preimage.is_none())
            {
                return Err("Signing journal is missing an exact signing preimage.".to_string());
            }
        }
        JournalPhase::BundleVerified
        | JournalPhase::StateCommitting
        | JournalPhase::StateCommitted
        | JournalPhase::Committed => {
            if signing_entries
                .iter()
                .any(|entry| entry.signing_preimage.is_none() || entry.signing_postimage.is_none())
            {
                return Err(
                    "Verified macOS journal is missing exact signing pre/postimages.".to_string(),
                );
            }
        }
        JournalPhase::Restored => {}
    }
    let mut quarantine_paths = HashSet::new();
    for preimage in &manifest.quarantine_preimages {
        let path = quarantine_path(&canonical_app, &preimage.relative_path)?;
        if !quarantine_paths.insert(path.clone()) {
            return Err(format!(
                "Pending macOS journal repeats quarantine path {}.",
                path.display()
            ));
        }
        decode_hex(&preimage.value_hex)?;
    }
    if manifest.pair_destinations.len() != manifest.temporary_paths.len() {
        return Err("Pending macOS journal has mismatched pair/temporary paths.".to_string());
    }
    let mut pair_destinations = HashSet::new();
    for (destination, temporary) in manifest
        .pair_destinations
        .iter()
        .zip(manifest.temporary_paths.iter())
    {
        let destination = Path::new(destination);
        if !pair_destinations.insert(destination.to_path_buf()) {
            return Err(format!(
                "Pending macOS journal repeats copy destination {}.",
                destination.display()
            ));
        }
        let entry = manifest
            .entries
            .iter()
            .find(|entry| Path::new(&entry.destination) == destination)
            .ok_or_else(|| {
                format!(
                    "Pending macOS journal copy destination has no entry: {}",
                    destination.display()
                )
            })?;
        if entry.scope != EntryScope::Bundle || entry.expected_copy.is_none() {
            return Err(format!(
                "Pending macOS journal copy destination is not a bundle copy: {}",
                destination.display()
            ));
        }
        validate_temporary_path(Path::new(temporary), &canonical_app)?;
    }
    if manifest.entries.iter().any(|entry| {
        entry.expected_copy.is_some() && !pair_destinations.contains(Path::new(&entry.destination))
    }) {
        return Err("Pending macOS journal omitted a copy destination index.".to_string());
    }
    let mut deferred_destinations = HashSet::new();
    for destination in &manifest.deferred_destinations {
        let destination = Path::new(destination);
        if !deferred_destinations.insert(destination.to_path_buf())
            || !pair_destinations.contains(destination)
        {
            return Err(format!(
                "Pending macOS journal has an invalid deferred destination {}.",
                destination.display()
            ));
        }
    }
    let mut deferred_removals = HashSet::new();
    for destination in &manifest.deferred_removals {
        let destination = Path::new(destination);
        let entry = manifest
            .entries
            .iter()
            .find(|entry| Path::new(&entry.destination) == destination);
        if !deferred_removals.insert(destination.to_path_buf())
            || pair_destinations.contains(destination)
            || !matches!(
                entry,
                Some(entry)
                    if entry.scope == EntryScope::Bundle
                        && entry.expected_absent
                        && entry.expected_copy.is_none()
            )
        {
            return Err(format!(
                "Pending macOS journal has an invalid deferred removal {}.",
                destination.display()
            ));
        }
    }
    let has_deferred =
        !manifest.deferred_destinations.is_empty() || !manifest.deferred_removals.is_empty();
    if manifest.deferred_published && !manifest.deferred_publish_authorized {
        return Err(
            "Pending macOS journal publishes a deferred marker without authorization.".to_string(),
        );
    }
    if !has_deferred && (!manifest.deferred_publish_authorized || !manifest.deferred_published) {
        return Err(
            "Pending macOS journal has a false deferred gate without deferred destinations."
                .to_string(),
        );
    }
    if has_deferred
        && matches!(
            manifest.phase,
            JournalPhase::Prepared | JournalPhase::Applying
        )
        && (manifest.deferred_publish_authorized || manifest.deferred_published)
    {
        return Err(
            "Pending macOS journal authorizes a deferred marker before Signing.".to_string(),
        );
    }
    if matches!(
        manifest.phase,
        JournalPhase::BundleVerified
            | JournalPhase::StateCommitting
            | JournalPhase::StateCommitted
            | JournalPhase::Committed
    ) && (!manifest.deferred_publish_authorized || !manifest.deferred_published)
    {
        return Err(
            "Verified macOS journal did not durably publish its deferred marker.".to_string(),
        );
    }
    let expected_state_temporaries =
        state::state_transaction_temporary_paths(state_dir, &manifest.operation_id);
    if manifest.state_temporary_paths.len() != expected_state_temporaries.len()
        || manifest
            .state_temporary_paths
            .iter()
            .zip(expected_state_temporaries.iter())
            .any(|(actual, expected)| Path::new(actual) != expected)
    {
        return Err("Pending macOS journal has invalid state temporary paths.".to_string());
    }
    for directory in &manifest.created_parent_directories {
        let directory = Path::new(directory);
        if !directory.starts_with(&canonical_app) || directory == canonical_app {
            return Err(format!(
                "Pending macOS journal contains an invalid created directory: {}",
                directory.display()
            ));
        }
        reject_symlink_components(&canonical_app, directory)?;
    }
    Ok(bundle_root)
}

fn validate_entry_plan(entry: &JournalEntry, canonical_app: &Path) -> Result<(), String> {
    if entry.expected_copy.is_some() && entry.expected_absent {
        return Err(format!(
            "Pending macOS journal has conflicting postconditions for {}.",
            entry.destination
        ));
    }
    if entry.scope == EntryScope::State
        && (!entry.intermediate_copies.is_empty()
            || entry.expected_copy.is_some()
            || entry.expected_absent
            || entry.signing_side_effect
            || entry.required_preimage.is_some()
            || entry.signing_preimage.is_some()
            || entry.signing_postimage.is_some())
    {
        return Err("Pending macOS journal gives bundle semantics to a state entry.".to_string());
    }
    if entry.scope == EntryScope::Bundle
        && entry.expected_copy.is_none()
        && !entry.expected_absent
        && !entry.signing_side_effect
    {
        return Err(format!(
            "Pending macOS journal bundle entry has no bounded mutation: {}",
            entry.destination
        ));
    }
    if entry.signing_side_effect
        && !is_allowed_signing_side_effect(canonical_app, Path::new(&entry.destination))
    {
        return Err(format!(
            "Pending macOS journal has an unbounded signing side effect: {}",
            entry.destination
        ));
    }
    if !entry.signing_side_effect
        && (entry.signing_preimage.is_some() || entry.signing_postimage.is_some())
    {
        return Err(format!(
            "Pending macOS journal gives signing evidence to a non-signing entry: {}",
            entry.destination
        ));
    }
    for fingerprint in entry
        .intermediate_copies
        .iter()
        .chain(entry.expected_copy.iter())
        .chain(entry.verified_post.iter())
        .chain(
            entry
                .required_preimage
                .iter()
                .filter_map(|state| state.fingerprint.as_ref()),
        )
        .chain(
            entry
                .signing_preimage
                .iter()
                .filter_map(|state| state.fingerprint.as_ref()),
        )
        .chain(
            entry
                .signing_postimage
                .iter()
                .filter_map(|state| state.fingerprint.as_ref()),
        )
    {
        if !is_sha256_hex(&fingerprint.sha256) || !is_regular_file_mode(fingerprint.mode) {
            return Err(format!(
                "Pending macOS journal has an invalid regular-file fingerprint for {}.",
                entry.destination
            ));
        }
    }
    if entry.verified_post.is_some() && entry.verified_post_absent {
        return Err(format!(
            "Pending macOS journal has conflicting verified postimages for {}.",
            entry.destination
        ));
    }
    Ok(())
}

fn is_sha256_hex(value: &str) -> bool {
    value.len() == 64
        && value
            .bytes()
            .all(|byte| byte.is_ascii_digit() || matches!(byte, b'a'..=b'f'))
}

fn is_regular_file_mode(mode: u32) -> bool {
    (mode as libc::mode_t & libc::S_IFMT) == libc::S_IFREG
}

fn validate_temporary_path(path: &Path, canonical_app: &Path) -> Result<(), String> {
    if !is_strict_descendant(canonical_app, path)
        || !path
            .file_name()
            .and_then(|name| name.to_str())
            .is_some_and(|name| name.starts_with(".cavalry-i18n-next-"))
    {
        return Err(format!(
            "Pending macOS journal contains an invalid temporary path: {}",
            path.display()
        ));
    }
    reject_symlink_components(canonical_app, path)
}

fn validate_destination(
    destination: &Path,
    scope: EntryScope,
    canonical_app: &Path,
    state_path: &Path,
) -> Result<(), String> {
    match scope {
        EntryScope::Bundle => {
            if !destination.is_absolute() || !is_strict_descendant(canonical_app, destination) {
                return Err(format!(
                    "Refusing transaction destination outside selected Cavalry bundle: {}",
                    destination.display()
                ));
            }
            reject_symlink_components(canonical_app, destination)?;
        }
        EntryScope::State => {
            let previous_path = state_path.with_file_name("state.json.prev");
            if destination != state_path && destination != previous_path {
                return Err(format!(
                    "Refusing unexpected state transaction destination {}",
                    destination.display()
                ));
            }
            if fs::symlink_metadata(destination)
                .map(|metadata| metadata.file_type().is_symlink())
                .unwrap_or(false)
            {
                return Err(format!(
                    "Refusing symlink state destination {}",
                    destination.display()
                ));
            }
        }
    }
    Ok(())
}

fn reject_symlink_components(root: &Path, destination: &Path) -> Result<(), String> {
    let relative = destination.strip_prefix(root).map_err(|_| {
        format!(
            "Transaction destination escapes selected bundle: {}",
            destination.display()
        )
    })?;
    if relative.as_os_str().is_empty()
        || relative
            .components()
            .any(|component| !matches!(component, Component::Normal(_)))
    {
        return Err(format!(
            "Transaction destination is not a canonical bundle descendant: {}",
            destination.display()
        ));
    }
    let mut current = root.to_path_buf();
    for component in relative.components() {
        current.push(component.as_os_str());
        match fs::symlink_metadata(&current) {
            Ok(metadata) if metadata.file_type().is_symlink() => {
                return Err(format!(
                    "Refusing symlink in transaction destination chain: {}",
                    current.display()
                ));
            }
            Ok(_) => {}
            Err(error) if error.kind() == ErrorKind::NotFound => break,
            Err(error) => {
                return Err(format!(
                    "Could not inspect transaction destination {}: {error}",
                    current.display()
                ));
            }
        }
    }
    Ok(())
}

fn is_strict_descendant(root: &Path, destination: &Path) -> bool {
    destination
        .strip_prefix(root)
        .ok()
        .filter(|relative| !relative.as_os_str().is_empty())
        .is_some_and(|relative| {
            relative
                .components()
                .all(|component| matches!(component, Component::Normal(_)))
        })
}

fn missing_bundle_parent_directories(
    pairs: &[CopyPair],
    canonical_app: &Path,
) -> Result<Vec<PathBuf>, CopyFailure> {
    let mut missing = HashSet::new();
    for pair in pairs {
        validate_destination(&pair.dst, EntryScope::Bundle, canonical_app, Path::new(""))
            .map_err(CopyFailure::other)?;
        let mut candidate = pair.dst.parent().ok_or_else(|| {
            CopyFailure::other(format!("Missing parent for {}", pair.dst.display()))
        })?;
        while !candidate.exists() {
            missing.insert(candidate.to_path_buf());
            candidate = candidate.parent().ok_or_else(|| {
                CopyFailure::other(format!(
                    "Could not find existing ancestor for {}",
                    pair.dst.display()
                ))
            })?;
        }
    }
    let mut directories = missing.into_iter().collect::<Vec<_>>();
    directories.sort_by(|left, right| {
        right
            .components()
            .count()
            .cmp(&left.components().count())
            .then_with(|| right.cmp(left))
    });
    Ok(directories)
}

fn temporary_path_for_pair(pair: &CopyPair, index: usize) -> PathBuf {
    pair.dst
        .parent()
        .unwrap_or_else(|| Path::new(""))
        .join(format!(
            ".cavalry-i18n-next-{}-{index}-{}",
            std::process::id(),
            TEMP_SEQUENCE.fetch_add(1, Ordering::Relaxed)
        ))
}

fn write_pair_atomically(
    pair: &CopyPair,
    temporary: &Path,
    bundle_root: &SecureDirectory,
    expected_copy: &FileFingerprint,
    accepted_current: &[Option<FileFingerprint>],
) -> Result<(), CopyFailure> {
    validate_destination(
        &pair.dst,
        EntryScope::Bundle,
        &bundle_root.path,
        Path::new(""),
    )
    .map_err(CopyFailure::other)?;
    let mut source = open_regular_nofollow(&pair.src)
        .map_err(CopyFailure::other)?
        .ok_or_else(|| {
            CopyFailure::other(format!(
                "Staged source does not exist: {}",
                pair.src.display()
            ))
        })?;
    let parent = pair.dst.parent().ok_or_else(|| {
        CopyFailure::other(format!(
            "Missing destination parent for {}",
            pair.dst.display()
        ))
    })?;
    let parent_dir = bundle_root
        .open_dir_path(parent, true)
        .map_err(CopyFailure::other)?;

    validate_temporary_path(temporary, &bundle_root.path).map_err(CopyFailure::other)?;
    if temporary.parent() != Some(parent) {
        return Err(CopyFailure::other(format!(
            "Transaction temporary path does not share destination directory: {}",
            temporary.display()
        )));
    }
    let temporary_leaf = c_component(
        temporary
            .file_name()
            .ok_or_else(|| CopyFailure::other("Transaction temporary path has no leaf."))?,
    )
    .map_err(CopyFailure::other)?;
    let destination_leaf = c_component(
        pair.dst
            .file_name()
            .ok_or_else(|| CopyFailure::other("Transaction destination has no leaf."))?,
    )
    .map_err(CopyFailure::other)?;
    let result = (|| {
        let mut staged = parent_dir.create_regular_leaf(&temporary_leaf, temporary, 0o600)?;
        let staged_hash =
            copy_and_hash(&mut source.file, &mut staged).map_err(CopyFailure::other)?;
        set_fd_mode(staged.as_raw_fd(), expected_copy.mode, temporary)
            .map_err(CopyFailure::other)?;
        staged.sync_all().map_err(|error| {
            CopyFailure::other(format!(
                "Could not sync staged destination {}: {error}",
                temporary.display()
            ))
        })?;
        let staged_mode =
            require_regular_fd(staged.as_raw_fd(), temporary).map_err(CopyFailure::other)?;
        let staged_fingerprint = FileFingerprint {
            sha256: staged_hash,
            mode: staged_mode,
        };
        if &staged_fingerprint != expected_copy {
            return Err(CopyFailure::other(format!(
                "Staged source changed or its mode drifted before publish: {}",
                pair.src.display()
            )));
        }
        drop(staged);

        #[cfg(test)]
        run_before_atomic_replace_hook();

        // Re-open the parent through the pinned bundle root. A path-chain swap is reported before
        // publication; even a swap in the final nanoseconds cannot redirect `renameatx_np`, which
        // remains anchored to `parent_dir`.
        let revalidated_parent = bundle_root
            .open_dir_path(parent, false)
            .map_err(CopyFailure::other)?;
        if !parent_dir
            .same_object_as(&revalidated_parent)
            .map_err(CopyFailure::other)?
        {
            return Err(CopyFailure::other(format!(
                "Destination ancestor changed during atomic copy: {}",
                parent.display()
            )));
        }
        publish_temp_with_compare_and_swap(
            &parent_dir,
            &temporary_leaf,
            temporary,
            &destination_leaf,
            &pair.dst,
            accepted_current,
        )
    })();
    if result.is_err() {
        let _ = unsafe { libc::unlinkat(parent_dir.fd.as_raw_fd(), temporary_leaf.as_ptr(), 0) };
    }
    result
}

fn publish_temp_with_compare_and_swap(
    parent: &SecureDirectory,
    temporary_leaf: &CString,
    temporary: &Path,
    destination_leaf: &CString,
    destination: &Path,
    accepted_current: &[Option<FileFingerprint>],
) -> Result<(), CopyFailure> {
    let current = parent
        .inspect_regular_or_absent(destination_leaf, destination)
        .map_err(CopyFailure::other)?;
    if !accepted_current.contains(&current) {
        return Err(CopyFailure::other(format!(
            "Destination drifted before atomic replacement: {}",
            destination.display()
        )));
    }

    #[cfg(test)]
    run_after_destination_compare_hook();

    if current.is_none() {
        if unsafe {
            libc::renameatx_np(
                parent.fd.as_raw_fd(),
                temporary_leaf.as_ptr(),
                parent.fd.as_raw_fd(),
                destination_leaf.as_ptr(),
                libc::RENAME_EXCL,
            )
        } != 0
        {
            let error = std::io::Error::last_os_error();
            return Err(CopyFailure::from_io(
                format!(
                    "Could not atomically create {} without replacement",
                    destination.display()
                ),
                &error,
            ));
        }
        return parent.sync().map_err(CopyFailure::other);
    }

    if unsafe {
        libc::renameatx_np(
            parent.fd.as_raw_fd(),
            temporary_leaf.as_ptr(),
            parent.fd.as_raw_fd(),
            destination_leaf.as_ptr(),
            libc::RENAME_SWAP,
        )
    } != 0
    {
        let error = std::io::Error::last_os_error();
        return Err(CopyFailure::from_io(
            format!("Could not atomically exchange {}", destination.display()),
            &error,
        ));
    }

    let displaced = parent.inspect_regular_or_absent(temporary_leaf, temporary);
    if !matches!(&displaced, Ok(value) if accepted_current.contains(value)) {
        let swap_back = unsafe {
            libc::renameatx_np(
                parent.fd.as_raw_fd(),
                temporary_leaf.as_ptr(),
                parent.fd.as_raw_fd(),
                destination_leaf.as_ptr(),
                libc::RENAME_SWAP,
            )
        };
        return if swap_back == 0 {
            Err(CopyFailure::other(format!(
                "Destination changed at the atomic replacement boundary; publication was reversed: {}",
                destination.display()
            )))
        } else {
            let error = std::io::Error::last_os_error();
            Err(CopyFailure::from_io(
                format!("Destination changed at the atomic replacement boundary and the safety swap-back failed for {}", destination.display()),
                &error,
            ))
        };
    }
    if unsafe { libc::unlinkat(parent.fd.as_raw_fd(), temporary_leaf.as_ptr(), 0) } != 0 {
        let error = std::io::Error::last_os_error();
        return Err(CopyFailure::from_io(
            format!(
                "Could not remove displaced preimage temporary {}",
                temporary.display()
            ),
            &error,
        ));
    }
    parent.sync().map_err(CopyFailure::other)
}

#[cfg(test)]
fn run_before_atomic_replace_hook() {
    BEFORE_ATOMIC_REPLACE.with(|slot| {
        if let Some(hook) = slot.borrow_mut().take() {
            hook();
        }
    });
}

#[cfg(test)]
fn run_after_destination_compare_hook() {
    AFTER_DESTINATION_COMPARE.with(|slot| {
        if let Some(hook) = slot.borrow_mut().take() {
            hook();
        }
    });
}

fn restore_manifest_with_roots(
    journal_dir: &SecureDirectory,
    roots: TransactionRoots<'_>,
    manifest: &JournalManifest,
) -> Result<(), String> {
    restore_manifest_with_roots_guarded(journal_dir, roots, manifest, None)
}

fn restore_manifest_with_roots_guarded(
    journal_dir: &SecureDirectory,
    roots: TransactionRoots<'_>,
    manifest: &JournalManifest,
    before_mutation: Option<&mut dyn FnMut() -> Result<(), String>>,
) -> Result<(), String> {
    // Never let recovery overwrite a destination that is neither the journaled preimage nor a
    // phase-appropriate postimage produced by this operation.
    verify_recovery_current_state(manifest, roots)?;
    let accepted_currents = manifest
        .entries
        .iter()
        .map(|entry| roots.current_fingerprint(entry))
        .collect::<Result<Vec<_>, _>>()?;
    if let Some(before_mutation) = before_mutation {
        before_mutation()?;
    }
    let canonical_app = Path::new(&manifest.install_root);
    let state_path = Path::new(&manifest.state_path);
    let mut errors = Vec::new();
    for temporary in &manifest.temporary_paths {
        let temporary = Path::new(temporary);
        match validate_temporary_path(temporary, canonical_app) {
            Ok(()) => {
                if let Err(error) = roots.bundle.unlink_regular_or_absent(temporary) {
                    errors.push(format!(
                        "Could not remove interrupted transaction temporary {}: {error}",
                        temporary.display()
                    ));
                }
            }
            Err(error) => errors.push(error),
        }
    }
    for temporary in &manifest.state_temporary_paths {
        let temporary = Path::new(temporary);
        if let Err(error) = roots.state.unlink_regular_or_absent(temporary) {
            errors.push(format!(
                "Could not remove interrupted state temporary {}: {error}",
                temporary.display()
            ));
        }
    }
    for (index, entry) in manifest.entries.iter().enumerate().rev() {
        let destination = Path::new(&entry.destination);
        if let Err(error) =
            validate_destination(destination, entry.scope, canonical_app, state_path)
        {
            errors.push(error);
            continue;
        }
        // The whole phase image was validated before the first mutation. Make the exact observed
        // fingerprint for this entry the atomic compare-and-swap precondition; drift introduced
        // after validation is exchanged out, detected on the pinned fd, and swapped back.
        let accepted_current = [accepted_currents[index].clone()];
        if accepted_current[0] == original_fingerprint(entry)? {
            // In particular, a third-scan launch race has mutated only the early wrapper/Info
            // gate. Do not rewrite untouched JSON, state, or executable signing entries while
            // reporting the running-process result.
            continue;
        }
        let result = match (
            &entry.backup_name,
            entry.original_mode,
            &entry.original_sha256,
        ) {
            (Some(name), Some(mode), Some(expected_hash)) => {
                if name != &format!("{index}.preimage") {
                    Err("invalid recovery backup name".to_string())
                } else {
                    let backup = Path::new("backups").join(name);
                    match sha256_regular_file_at(journal_dir, &backup) {
                        Ok(actual_hash) if actual_hash == *expected_hash => {
                            restore_file_atomically(
                                journal_dir,
                                &backup,
                                roots.for_scope(entry.scope),
                                destination,
                                mode,
                                expected_hash,
                                &accepted_current,
                            )
                        }
                        Ok(_) => Err(format!(
                            "Recovery backup hash mismatch for {}",
                            journal_dir.path.join(&backup).display()
                        )),
                        Err(error) => Err(error),
                    }
                }
            }
            (None, None, None) => roots
                .for_scope(entry.scope)
                .unlink_regular_or_absent(destination),
            _ => Err(format!(
                "Incomplete recovery metadata for {}",
                destination.display()
            )),
        };
        if let Err(error) = result {
            errors.push(error);
        }
    }

    for preimage in &manifest.quarantine_preimages {
        let result = quarantine_path(canonical_app, &preimage.relative_path)
            .and_then(|path| decode_hex(&preimage.value_hex).map(|value| (path, value)))
            .and_then(|(path, value)| {
                let node = roots.bundle.open_node_path(&path)?;
                restore_quarantine_xattr_fd(node.fd.as_raw_fd(), &path, &value)
            });
        if let Err(error) = result {
            errors.push(error);
        }
    }

    for directory in &manifest.created_parent_directories {
        let path = Path::new(directory);
        if !path.starts_with(canonical_app) || path == canonical_app {
            errors.push(format!(
                "Refusing invalid recovery directory {}",
                path.display()
            ));
            continue;
        }
        if let Err(error) = roots.bundle.remove_empty_dir_path(path) {
            errors.push(error);
        }
    }
    if !errors.is_empty() {
        return Err(errors.join(" | "));
    }
    let mut restored = manifest.clone();
    restored.phase = JournalPhase::Restored;
    for entry in &mut restored.entries {
        entry.verified_post = None;
        entry.verified_post_absent = false;
    }
    write_manifest(journal_dir, &restored)?;
    verify_all_preimages(&restored, roots)
}

fn restore_file_atomically(
    journal_dir: &SecureDirectory,
    source_relative: &Path,
    destination_root: &SecureDirectory,
    destination: &Path,
    mode: u32,
    expected_hash: &str,
    accepted_current: &[Option<FileFingerprint>],
) -> Result<(), String> {
    let mut source = journal_dir
        .open_regular_relative(source_relative)?
        .ok_or_else(|| {
            format!(
                "Recovery backup is missing: {}",
                journal_dir.path.join(source_relative).display()
            )
        })?;
    let parent = destination.parent().ok_or_else(|| {
        format!(
            "Missing recovery destination parent for {}",
            destination.display()
        )
    })?;
    let parent_dir = destination_root.open_dir_path(parent, true)?;
    let temporary = parent.join(format!(
        ".cavalry-i18n-restore-{}-{}",
        std::process::id(),
        TEMP_SEQUENCE.fetch_add(1, Ordering::Relaxed)
    ));
    let temporary_leaf = c_component(
        temporary
            .file_name()
            .ok_or_else(|| "Recovery temporary has no leaf.".to_string())?,
    )?;
    let destination_leaf = c_component(
        destination
            .file_name()
            .ok_or_else(|| "Recovery destination has no leaf.".to_string())?,
    )?;
    let result = (|| {
        let mut staged = parent_dir
            .create_regular_leaf(&temporary_leaf, &temporary, 0o600)
            .map_err(|error| error.display())?;
        let actual_hash = copy_and_hash(&mut source.file, &mut staged)?;
        if actual_hash != expected_hash {
            return Err(format!(
                "Recovery backup changed while copying: {}",
                journal_dir.path.join(source_relative).display()
            ));
        }
        set_fd_mode(staged.as_raw_fd(), mode, &temporary)?;
        staged.sync_all().map_err(|error| error.to_string())?;
        drop(staged);
        let revalidated_parent = destination_root.open_dir_path(parent, false)?;
        if !parent_dir.same_object_as(&revalidated_parent)? {
            return Err(format!(
                "Recovery destination ancestor changed: {}",
                parent.display()
            ));
        }
        publish_temp_with_compare_and_swap(
            &parent_dir,
            &temporary_leaf,
            &temporary,
            &destination_leaf,
            destination,
            accepted_current,
        )
        .map_err(|error| error.display())
    })();
    if result.is_err() {
        let _ = unsafe { libc::unlinkat(parent_dir.fd.as_raw_fd(), temporary_leaf.as_ptr(), 0) };
    }
    result
}

fn write_manifest(root: &SecureDirectory, manifest: &JournalManifest) -> Result<(), String> {
    #[cfg(test)]
    if take_test_failpoint(&FAIL_NEXT_MANIFEST_WRITE) {
        return Err("simulated durable manifest write failure".to_string());
    }
    let payload = serde_json::to_vec_pretty(manifest).map_err(|error| error.to_string())?;
    let path = root.path.join(MANIFEST_NAME);
    let temporary_name = format!(
        ".{MANIFEST_NAME}.{}-{}",
        std::process::id(),
        TEMP_SEQUENCE.fetch_add(1, Ordering::Relaxed)
    );
    let temporary = root.path.join(&temporary_name);
    let temporary_leaf = c_component(std::ffi::OsStr::new(&temporary_name))?;
    let manifest_leaf = CString::new(MANIFEST_NAME).expect("static manifest name");
    let result = (|| {
        let existing = root.inspect_regular_or_absent(&manifest_leaf, &path)?;
        let mut file = root
            .create_regular_leaf(&temporary_leaf, &temporary, 0o600)
            .map_err(|error| error.display())?;
        file.write_all(&payload)
            .map_err(|error| error.to_string())?;
        file.write_all(b"\n").map_err(|error| error.to_string())?;
        file.sync_all().map_err(|error| error.to_string())?;
        drop(file);
        let rename = if existing.is_some() {
            unsafe {
                libc::renameat(
                    root.fd.as_raw_fd(),
                    temporary_leaf.as_ptr(),
                    root.fd.as_raw_fd(),
                    manifest_leaf.as_ptr(),
                )
            }
        } else {
            unsafe {
                libc::renameatx_np(
                    root.fd.as_raw_fd(),
                    temporary_leaf.as_ptr(),
                    root.fd.as_raw_fd(),
                    manifest_leaf.as_ptr(),
                    libc::RENAME_EXCL,
                )
            }
        };
        if rename != 0 {
            return Err(format!(
                "Could not atomically publish manifest {}: {}",
                path.display(),
                std::io::Error::last_os_error()
            ));
        }
        root.sync()
    })();
    if result.is_err() {
        let _ = unsafe { libc::unlinkat(root.fd.as_raw_fd(), temporary_leaf.as_ptr(), 0) };
    }
    result
}

#[cfg(test)]
fn take_test_failpoint(key: &'static std::thread::LocalKey<Cell<bool>>) -> bool {
    key.with(|flag| flag.replace(false))
}

fn read_manifest(root: &SecureDirectory) -> Result<JournalManifest, String> {
    root.open_dir_relative(Path::new("backups"), false)
        .map_err(|error| {
            format!(
                "Pending macOS recovery backups are not a regular directory at {}: {error}",
                root.path.join("backups").display()
            )
        })?;
    let path = root.path.join(MANIFEST_NAME);
    let mut file = root
        .open_regular_relative(Path::new(MANIFEST_NAME))?
        .ok_or_else(|| format!("Pending macOS journal is missing at {}", path.display()))?
        .file;
    let mut bytes = Vec::new();
    file.read_to_end(&mut bytes).map_err(|error| {
        format!(
            "Could not read pending macOS journal {}: {error}",
            path.display()
        )
    })?;
    serde_json::from_slice(&bytes).map_err(|error| {
        format!(
            "Pending macOS journal is invalid at {}: {error}",
            path.display()
        )
    })
}

fn fingerprint_open_file(file: &mut File, mode: u32) -> Result<FileFingerprint, String> {
    Ok(FileFingerprint {
        sha256: sha256_open_file(file)?,
        mode,
    })
}

fn sha256_open_file(file: &mut File) -> Result<String, String> {
    file.rewind()
        .map_err(|error| format!("Could not rewind secure file for hashing: {error}"))?;
    let mut hasher = Sha256::new();
    let mut buffer = [0_u8; 64 * 1024];
    loop {
        let count = file
            .read(&mut buffer)
            .map_err(|error| format!("Could not hash secure file descriptor: {error}"))?;
        if count == 0 {
            break;
        }
        hasher.update(&buffer[..count]);
    }
    Ok(format!("{:x}", hasher.finalize()))
}

fn sha256_regular_file_at(root: &SecureDirectory, relative: &Path) -> Result<String, String> {
    let display = root.path.join(relative);
    let mut opened = root
        .open_regular_relative(relative)
        .map_err(|error| format!("Recovery backup is not a regular file: {display:?}: {error}"))?
        .ok_or_else(|| format!("Recovery backup is missing: {}", display.display()))?;
    sha256_open_file(&mut opened.file)
}

fn copy_and_hash(source: &mut File, destination: &mut File) -> Result<String, String> {
    source
        .rewind()
        .map_err(|error| format!("Could not rewind secure source: {error}"))?;
    let mut hasher = Sha256::new();
    let mut buffer = [0_u8; 64 * 1024];
    loop {
        let count = source
            .read(&mut buffer)
            .map_err(|error| format!("Could not read secure source: {error}"))?;
        if count == 0 {
            break;
        }
        destination
            .write_all(&buffer[..count])
            .map_err(|error| format!("Could not write secure destination: {error}"))?;
        hasher.update(&buffer[..count]);
    }
    Ok(format!("{:x}", hasher.finalize()))
}

fn set_fd_mode(fd: RawFd, mode: u32, display: &Path) -> Result<(), String> {
    if unsafe { libc::fchmod(fd, (mode & 0o7777) as libc::mode_t) } == 0 {
        Ok(())
    } else {
        Err(format!(
            "Could not set secure file mode for {}: {}",
            display.display(),
            std::io::Error::last_os_error()
        ))
    }
}

fn ensure_state_directory(state_dir: &Path) -> Result<(), CopyFailure> {
    fs::create_dir_all(state_dir).map_err(|error| {
        CopyFailure::from_io(
            format!("Could not create state directory {}", state_dir.display()),
            &error,
        )
    })?;
    let metadata = fs::symlink_metadata(state_dir).map_err(|error| {
        CopyFailure::from_io(
            format!("Could not inspect state directory {}", state_dir.display()),
            &error,
        )
    })?;
    if metadata.file_type().is_symlink() || !metadata.is_dir() {
        return Err(CopyFailure::other(format!(
            "Refusing symlink or non-directory state root {}",
            state_dir.display()
        )));
    }
    fs::set_permissions(state_dir, fs::Permissions::from_mode(0o700)).map_err(|error| {
        CopyFailure::from_io(
            format!("Could not protect state directory {}", state_dir.display()),
            &error,
        )
    })
}

#[cfg(test)]
fn run_after_root_directory_open_hook() {
    AFTER_ROOT_DIRECTORY_OPEN.with(|slot| {
        if let Some(hook) = slot.borrow_mut().take() {
            hook();
        }
    });
}

#[cfg(test)]
fn run_after_retired_cleanup_entry_hook() {
    AFTER_RETIRED_CLEANUP_ENTRY.with(|slot| {
        if let Some(hook) = slot.borrow_mut().take() {
            hook();
        }
    });
}

fn path_string(path: &Path) -> Result<String, String> {
    path.to_str()
        .map(str::to_string)
        .ok_or_else(|| format!("Transaction path is not valid UTF-8: {}", path.display()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn protected_bundle_create_keeps_typed_permission_after_context_rewrite() {
        let temp = tempfile::tempdir().unwrap();
        let app = temp.path().join("Cavalry.app");
        let assets = app.join("Contents/assets");
        let source = temp.path().join("translated.json");
        let destination = assets.join("appStrings.json");
        let temporary = assets.join(".cavalry-i18n-next-test");
        write(&source, b"translated");
        write(&destination, b"official");
        let root = SecureDirectory::open(&app).unwrap();
        let expected = fingerprint_regular_file(&source).unwrap();
        let accepted = [fingerprint_regular_file(&destination).ok()];
        fs::set_permissions(&assets, fs::Permissions::from_mode(0o555)).unwrap();

        let failure = write_pair_atomically(
            &CopyPair {
                src: source,
                dst: destination,
            },
            &temporary,
            &root,
            &expected,
            &accepted,
        )
        .unwrap_err()
        .with_message("transaction rollback preserved the original denial");

        fs::set_permissions(&assets, fs::Permissions::from_mode(0o755)).unwrap();
        assert!(failure.allows_administrator_retry());
        assert_eq!(
            failure.display(),
            "transaction rollback preserved the original denial"
        );
    }

    const PHASE_CHILD_ROOT_ENV: &str = "CAVALRY_I18N_PHASE_CHILD_ROOT";
    const PHASE_CHILD_CASE_ENV: &str = "CAVALRY_I18N_PHASE_CHILD_CASE";
    const PHASE_CHILD_EXIT: i32 = 86;

    fn write(path: &Path, bytes: &[u8]) {
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::write(path, bytes).unwrap();
    }

    fn advance_to_bundle_verified(transaction: &mut MacApplyTransaction) {
        transaction.begin_signing().unwrap();
        transaction
            .verify_and_record_signing_postimages(|_| Ok(()))
            .unwrap();
        transaction.checkpoint_verified_bundle().unwrap();
    }

    fn write_child_state(transaction: &MacApplyTransaction, state_dir: &Path) {
        crate::state::write_state_with_operation(
            state_dir,
            &crate::state::State {
                current_lang: "zh-Hans".to_string(),
                ..crate::state::State::default()
            },
            transaction.operation_id(),
        )
        .unwrap();
    }

    #[test]
    fn phase_fault_child() {
        let Ok(root) = std::env::var(PHASE_CHILD_ROOT_ENV) else {
            return;
        };
        let phase = std::env::var(PHASE_CHILD_CASE_ENV).unwrap();
        let root = PathBuf::from(root);
        fs::create_dir_all(&root).unwrap();
        let app = root.join("Cavalry.app");
        let state = root.join("state");
        let source = root.join("translated.json");
        let destination = app.join("Contents/assets/appStrings.json");
        let code_resources = app.join("Contents/_CodeSignature/CodeResources");
        write(&destination, b"official");
        write(&source, b"translated");
        write(&code_resources, b"vendor-seal");
        let mut transaction = MacApplyTransaction::begin_with_removals_and_side_effects(
            &state,
            &app,
            &[CopyPair {
                src: source,
                dst: destination.clone(),
            }],
            &[],
            std::slice::from_ref(&code_resources),
        )
        .unwrap();

        match phase.as_str() {
            "prepared" => {
                write(&destination, b"official");
                transaction.manifest.phase = JournalPhase::Prepared;
                write_manifest(&transaction.journal_dir, &transaction.manifest).unwrap();
            }
            "applying" => {}
            "signing" => {
                transaction.begin_signing().unwrap();
                // Simulate codesign replacing a bounded output and the process dying before
                // verifier success/postimage persistence.
                write(&code_resources, b"unrecorded-codesign-output");
            }
            "bundle-verified" => advance_to_bundle_verified(&mut transaction),
            "state-committing" => {
                advance_to_bundle_verified(&mut transaction);
                transaction.begin_state_commit().unwrap();
            }
            "state-rename-before-dir-fsync" => {
                advance_to_bundle_verified(&mut transaction);
                transaction.begin_state_commit().unwrap();
                let next_state = crate::state::State {
                    current_lang: "zh-Hans".to_string(),
                    ..crate::state::State::default()
                };
                let document = crate::state::StateDocument {
                    schema_version: crate::state::STATE_SCHEMA_VERSION,
                    generation: 1,
                    operation_id: transaction.operation_id().to_string(),
                    state: next_state.clone(),
                    last_known_good: Some(crate::state::LastKnownGoodState {
                        generation: 1,
                        operation_id: transaction.operation_id().to_string(),
                        state: next_state,
                    }),
                };
                let temporary = state.join("manual-state-before-fsync.tmp");
                let mut file = File::create(&temporary).unwrap();
                file.write_all(&serde_json::to_vec_pretty(&document).unwrap())
                    .unwrap();
                file.sync_all().unwrap();
                fs::rename(temporary, state.join("state.json")).unwrap();
                // Intentionally no directory fsync: the child exits at the rename/fsync boundary.
            }
            "state-after-dir-fsync" => {
                advance_to_bundle_verified(&mut transaction);
                transaction.begin_state_commit().unwrap();
                write_child_state(&transaction, &state);
            }
            "state-committed" => {
                advance_to_bundle_verified(&mut transaction);
                transaction.begin_state_commit().unwrap();
                write_child_state(&transaction, &state);
                transaction.checkpoint_state_commit().unwrap();
            }
            "restored" => {
                let message = transaction.rollback_with_cause("phase child rollback");
                assert!(message.contains("Exact bundle and state preimages were restored"));
                unsafe { libc::_exit(PHASE_CHILD_EXIT) };
            }
            "restored-cleanup" => {
                let message = transaction.rollback_with_cause("phase child rollback");
                assert!(message.contains("Exact bundle and state preimages were restored"));
                AFTER_RETIRED_CLEANUP_ENTRY.with(|slot| {
                    *slot.borrow_mut() =
                        Some(Box::new(|| unsafe { libc::_exit(PHASE_CHILD_EXIT) }));
                });
                let _ = finalize_recovered(&state, &app);
                panic!("restored cleanup hook did not terminate child");
            }
            "cleanup" => {
                advance_to_bundle_verified(&mut transaction);
                transaction.begin_state_commit().unwrap();
                write_child_state(&transaction, &state);
                transaction.checkpoint_state_commit().unwrap();
                AFTER_RETIRED_CLEANUP_ENTRY.with(|slot| {
                    *slot.borrow_mut() =
                        Some(Box::new(|| unsafe { libc::_exit(PHASE_CHILD_EXIT) }));
                });
                let _ = transaction.commit();
                panic!("cleanup hook did not terminate child");
            }
            other => panic!("unknown phase child case {other}"),
        }

        transaction.active = false;
        std::mem::forget(transaction);
        unsafe { libc::_exit(PHASE_CHILD_EXIT) };
    }

    #[test]
    fn real_subprocess_phase_kill_and_reopen_matrix() {
        let cases = [
            ("prepared", false, false),
            ("applying", false, false),
            ("signing", false, false),
            ("bundle-verified", false, false),
            ("state-committing", false, false),
            ("state-rename-before-dir-fsync", false, false),
            ("state-after-dir-fsync", false, false),
            ("state-committed", true, false),
            ("restored", false, false),
            ("restored-cleanup", false, true),
            ("cleanup", true, true),
        ];
        for (phase, committed, retired) in cases {
            let temp = tempfile::tempdir().unwrap();
            let root = fs::canonicalize(temp.path()).unwrap().join(phase);
            let output = std::process::Command::new(std::env::current_exe().unwrap())
                .arg("privilege::macos::apply_transaction::tests::phase_fault_child")
                .arg("--exact")
                .arg("--nocapture")
                .env(PHASE_CHILD_ROOT_ENV, &root)
                .env(PHASE_CHILD_CASE_ENV, phase)
                .output()
                .unwrap();
            assert_eq!(
                output.status.code(),
                Some(PHASE_CHILD_EXIT),
                "phase {phase} child failed:\nstdout={}\nstderr={}",
                String::from_utf8_lossy(&output.stdout),
                String::from_utf8_lossy(&output.stderr)
            );
            let app = root.join("Cavalry.app");
            let state = root.join("state");
            let destination = app.join("Contents/assets/appStrings.json");
            let code_resources = app.join("Contents/_CodeSignature/CodeResources");
            assert_eq!(
                journal_root(&state).exists(),
                !retired,
                "phase {phase} canonical journal state"
            );
            if retired {
                assert!(
                    fs::read_dir(&state)
                        .unwrap()
                        .any(|entry| { is_cleanup_tombstone_name(&entry.unwrap().file_name()) }),
                    "phase {phase} must leave only a non-blocking cleanup tombstone"
                );
            }

            let restored = recover_pending(&state, &app)
                .unwrap_or_else(|error| panic!("phase {phase} failed reopen recovery: {error}"));
            assert_eq!(restored, !committed && !retired, "phase {phase}");
            if committed {
                assert_eq!(fs::read(&destination).unwrap(), b"translated", "{phase}");
                assert_eq!(
                    crate::state::read_state_document(&state)
                        .unwrap()
                        .state
                        .current_lang,
                    "zh-Hans",
                    "{phase}"
                );
            } else {
                assert_eq!(fs::read(&destination).unwrap(), b"official", "{phase}");
            }
            assert_eq!(
                fs::read(&code_resources).unwrap(),
                b"vendor-seal",
                "{phase}"
            );
            if retired {
                assert!(pending_install_root(&state).unwrap().is_none(), "{phase}");
            } else {
                finalize_recovered(&state, &app).unwrap();
            }
            assert!(!journal_root(&state).exists(), "phase {phase}");
        }
    }

    #[test]
    fn guarded_recovery_rechecks_exact_process_before_restore_mutation() {
        let temp = tempfile::tempdir().unwrap();
        let root = fs::canonicalize(temp.path()).unwrap();
        let app = root.join("Cavalry.app");
        let state = root.join("state");
        let executable = app.join("Contents/MacOS/Cavalry");
        let source = root.join("translated.json");
        let destination = app.join("Contents/assets/appStrings.json");
        write(&executable, b"cavalry");
        write(&destination, b"official");
        write(&source, b"translated");
        let transaction = MacApplyTransaction::begin(
            &state,
            &app,
            &[CopyPair {
                src: source,
                dst: destination.clone(),
            }],
        )
        .unwrap();
        std::mem::forget(transaction);
        let mut guard_calls = 0;
        let mut guard = |exact: &Path| {
            guard_calls += 1;
            assert_eq!(exact, executable);
            Err("selected Cavalry relaunched before recovery".to_string())
        };

        let error = recover_pending_internal(&state, &app, Some(&mut guard)).unwrap_err();
        assert!(error.contains("relaunched before recovery"), "{error}");
        assert_eq!(guard_calls, 1);
        assert_eq!(fs::read(&destination).unwrap(), b"translated");
        assert!(journal_root(&state).exists());

        assert!(recover_pending(&state, &app).unwrap());
        assert_eq!(fs::read(destination).unwrap(), b"official");
        finalize_recovered(&state, &app).unwrap();
    }

    fn advance_to_state_committed(
        mut transaction: MacApplyTransaction,
        state_dir: &Path,
        lang: &str,
    ) -> MacApplyTransaction {
        transaction.begin_signing().unwrap();
        transaction.checkpoint_verified_bundle().unwrap();
        transaction.begin_state_commit().unwrap();
        crate::state::write_state_with_operation(
            state_dir,
            &crate::state::State {
                current_lang: lang.to_string(),
                ..crate::state::State::default()
            },
            transaction.operation_id(),
        )
        .unwrap();
        transaction.checkpoint_state_commit().unwrap();
        transaction
    }

    #[test]
    fn interrupted_transaction_restores_bundle_and_state_preimages() {
        let temp = tempfile::tempdir().unwrap();
        let root = fs::canonicalize(temp.path()).unwrap();
        let app = root.join("Cavalry.app");
        let state = root.join("state");
        let source = root.join("translated.json");
        let destination = app.join("Contents/assets/appStrings.json");
        write(&destination, b"official");
        write(&source, b"translated");
        crate::state::write_state_with_operation(
            &state,
            &crate::state::State {
                current_lang: "en".to_string(),
                ..crate::state::State::default()
            },
            "preimage-one",
        )
        .unwrap();
        crate::state::write_state_with_operation(
            &state,
            &crate::state::State {
                current_lang: "zh-Hant".to_string(),
                ..crate::state::State::default()
            },
            "preimage-two",
        )
        .unwrap();
        let original_state = fs::read(state.join("state.json")).unwrap();
        let original_previous = fs::read(state.join("state.json.prev")).unwrap();

        let mut transaction = MacApplyTransaction::begin(
            &state,
            &app,
            &[CopyPair {
                src: source,
                dst: destination.clone(),
            }],
        )
        .unwrap();
        let operation_id = transaction.operation_id().to_string();
        transaction.begin_signing().unwrap();
        transaction.checkpoint_verified_bundle().unwrap();
        transaction.begin_state_commit().unwrap();
        crate::state::write_state_with_operation(
            &state,
            &crate::state::State {
                current_lang: "ja_JP".to_string(),
                ..crate::state::State::default()
            },
            &operation_id,
        )
        .unwrap();
        assert_eq!(fs::read(&destination).unwrap(), b"translated");
        std::mem::forget(transaction);

        assert!(recover_pending(&state, &app).unwrap());
        assert!(journal_root(&state).exists());
        assert_eq!(fs::read(destination).unwrap(), b"official");
        assert_eq!(fs::read(state.join("state.json")).unwrap(), original_state);
        assert_eq!(
            fs::read(state.join("state.json.prev")).unwrap(),
            original_previous
        );
        finalize_recovered(&state, &app).unwrap();
        assert!(!journal_root(&state).exists());
    }

    #[test]
    fn committed_journal_is_only_cleaned_and_never_rolled_back() {
        let temp = tempfile::tempdir().unwrap();
        let root = fs::canonicalize(temp.path()).unwrap();
        let app = root.join("Cavalry.app");
        let state = root.join("state");
        let source = root.join("translated.json");
        let destination = app.join("Contents/assets/appStrings.json");
        write(&destination, b"official");
        write(&source, b"translated");
        let transaction = MacApplyTransaction::begin(
            &state,
            &app,
            &[CopyPair {
                src: source,
                dst: destination.clone(),
            }],
        )
        .unwrap();
        let mut transaction = advance_to_state_committed(transaction, &state, "zh-Hans");
        transaction.manifest.phase = JournalPhase::Committed;
        write_manifest(&transaction.journal_dir, &transaction.manifest).unwrap();
        transaction.active = false;
        std::mem::forget(transaction);

        assert!(!recover_pending(&state, &app).unwrap());
        assert_eq!(fs::read(destination).unwrap(), b"translated");
        assert!(journal_root(&state).exists());
        finalize_recovered(&state, &app).unwrap();
        assert!(!journal_root(&state).exists());
    }

    #[test]
    fn prepared_phase_journal_is_rolled_back_on_next_action() {
        let temp = tempfile::tempdir().unwrap();
        let root = fs::canonicalize(temp.path()).unwrap();
        let app = root.join("Cavalry.app");
        let state = root.join("state");
        let source = root.join("translated.json");
        let destination = app.join("Contents/assets/appStrings.json");
        write(&destination, b"official");
        write(&source, b"translated");
        let mut transaction = MacApplyTransaction::begin(
            &state,
            &app,
            &[CopyPair {
                src: source,
                dst: destination.clone(),
            }],
        )
        .unwrap();
        // `begin` has already entered Applying for normal callers. Recreate the only valid
        // published-Prepared crash image: every destination still equals its preimage.
        write(&destination, b"official");
        transaction.manifest.phase = JournalPhase::Prepared;
        write_manifest(&transaction.journal_dir, &transaction.manifest).unwrap();
        transaction.active = false;
        std::mem::forget(transaction);

        assert!(recover_pending(&state, &app).unwrap());
        assert_eq!(fs::read(destination).unwrap(), b"official");
        finalize_recovered(&state, &app).unwrap();
    }

    #[test]
    fn state_commit_validation_failure_rolls_back_bundle_and_state() {
        let temp = tempfile::tempdir().unwrap();
        let root = fs::canonicalize(temp.path()).unwrap();
        let app = root.join("Cavalry.app");
        let state_dir = root.join("state");
        let source = root.join("translated.json");
        let destination = app.join("Contents/assets/appStrings.json");
        write(&destination, b"official");
        write(&source, b"translated");
        fs::create_dir_all(&state_dir).unwrap();
        fs::write(
            state_dir.join("state.json"),
            br#"{"schemaVersion":999,"generation":1,"operationId":"future"}"#,
        )
        .unwrap();
        let state_before = fs::read(state_dir.join("state.json")).unwrap();
        let mut transaction = MacApplyTransaction::begin(
            &state_dir,
            &app,
            &[CopyPair {
                src: source,
                dst: destination.clone(),
            }],
        )
        .unwrap();
        transaction.begin_signing().unwrap();
        transaction.checkpoint_verified_bundle().unwrap();
        transaction.begin_state_commit().unwrap();

        let state_error = crate::state::write_state_with_operation(
            &state_dir,
            &crate::state::State {
                current_lang: "zh-Hans".to_string(),
                ..crate::state::State::default()
            },
            transaction.operation_id(),
        )
        .unwrap_err();
        assert!(
            state_error.contains("damaged state document"),
            "{state_error}"
        );
        let result = transaction.rollback_with_cause(state_error);

        assert!(result.contains("Exact bundle and state preimages were restored"));
        assert_eq!(fs::read(destination).unwrap(), b"official");
        assert_eq!(
            fs::read(state_dir.join("state.json")).unwrap(),
            state_before
        );
        finalize_recovered(&state_dir, &app).unwrap();
    }

    #[test]
    fn durable_commit_phase_write_failure_keeps_new_reality_and_recoverable_journal() {
        let temp = tempfile::tempdir().unwrap();
        let root = fs::canonicalize(temp.path()).unwrap();
        let app = root.join("Cavalry.app");
        let state = root.join("state");
        let source = root.join("translated.json");
        let destination = app.join("Contents/assets/appStrings.json");
        write(&destination, b"official");
        write(&source, b"translated");
        let transaction = MacApplyTransaction::begin(
            &state,
            &app,
            &[CopyPair {
                src: source,
                dst: destination.clone(),
            }],
        )
        .unwrap();
        let transaction = advance_to_state_committed(transaction, &state, "zh-Hant");
        FAIL_NEXT_MANIFEST_WRITE.with(|flag| flag.set(true));

        let completion = transaction.commit().unwrap();

        assert_eq!(completion.warnings.len(), 1);
        assert_eq!(fs::read(&destination).unwrap(), b"translated");
        assert!(journal_root(&state).exists());
        assert!(!recover_pending(&state, &app).unwrap());
        assert_eq!(fs::read(destination).unwrap(), b"translated");
        finalize_recovered(&state, &app).unwrap();
        assert!(!journal_root(&state).exists());
    }

    #[test]
    fn symlink_destination_is_rejected_before_journal_mutation() {
        use std::os::unix::fs::symlink;

        let temp = tempfile::tempdir().unwrap();
        let root = fs::canonicalize(temp.path()).unwrap();
        let app = root.join("Cavalry.app");
        let state = root.join("state");
        let outside = root.join("outside.json");
        let source = root.join("translated.json");
        let destination = app.join("Contents/assets/appStrings.json");
        write(&outside, b"outside");
        write(&source, b"translated");
        fs::create_dir_all(destination.parent().unwrap()).unwrap();
        symlink(&outside, &destination).unwrap();

        let error = MacApplyTransaction::begin(
            &state,
            &app,
            &[CopyPair {
                src: source,
                dst: destination,
            }],
        )
        .unwrap_err();
        assert!(error.display().contains("symlink"));
        assert_eq!(fs::read(outside).unwrap(), b"outside");
        assert!(!journal_root(&state).exists());
    }

    #[test]
    fn parent_traversal_destination_is_rejected_before_journal_mutation() {
        let temp = tempfile::tempdir().unwrap();
        let root = fs::canonicalize(temp.path()).unwrap();
        let app = root.join("Cavalry.app");
        let state = root.join("state");
        let source = root.join("translated.json");
        let outside = root.join("outside.json");
        let traversal = app
            .join("Contents")
            .join("..")
            .join("..")
            .join("outside.json");
        write(&app.join("Contents/.keep"), b"keep");
        write(&source, b"translated");
        write(&outside, b"outside");

        let error = MacApplyTransaction::begin(
            &state,
            &app,
            &[CopyPair {
                src: source,
                dst: traversal,
            }],
        )
        .unwrap_err();

        assert!(error.display().contains("outside selected Cavalry bundle"));
        assert_eq!(fs::read(outside).unwrap(), b"outside");
        assert!(!journal_root(&state).exists());
    }

    #[test]
    fn preparation_failure_never_publishes_a_canonical_journal() {
        let temp = tempfile::tempdir().unwrap();
        let root = fs::canonicalize(temp.path()).unwrap();
        let app = root.join("Cavalry.app");
        let state = root.join("state");
        let source = root.join("translated.json");
        let destination = app.join("Contents/assets/appStrings.json");
        write(&destination, b"official");
        write(&source, b"translated");
        FAIL_BEFORE_JOURNAL_PUBLISH.with(|flag| flag.set(true));

        let error = MacApplyTransaction::begin(
            &state,
            &app,
            &[CopyPair {
                src: source,
                dst: destination.clone(),
            }],
        )
        .unwrap_err();

        assert!(error.display().contains("before macOS journal publication"));
        assert_eq!(fs::read(destination).unwrap(), b"official");
        assert!(!journal_root(&state).exists());
        assert!(fs::read_dir(&state).unwrap().all(|entry| {
            !entry
                .unwrap()
                .file_name()
                .to_string_lossy()
                .contains(".preparing-")
        }));
    }

    #[test]
    fn structurally_invalid_manifest_phase_is_rejected_before_recovery() {
        let temp = tempfile::tempdir().unwrap();
        let root = fs::canonicalize(temp.path()).unwrap();
        let app = root.join("Cavalry.app");
        let state = root.join("state");
        let source = root.join("translated.json");
        let destination = app.join("Contents/assets/appStrings.json");
        write(&destination, b"official");
        write(&source, b"translated");
        let transaction = MacApplyTransaction::begin(
            &state,
            &app,
            &[CopyPair {
                src: source,
                dst: destination.clone(),
            }],
        )
        .unwrap();
        let manifest_path = transaction.journal_root.join(MANIFEST_NAME);
        let mut value: serde_json::Value =
            serde_json::from_slice(&fs::read(&manifest_path).unwrap()).unwrap();
        value["phase"] = serde_json::Value::String("committed".to_string());
        fs::write(&manifest_path, serde_json::to_vec_pretty(&value).unwrap()).unwrap();
        std::mem::forget(transaction);

        let error = recover_pending(&state, &app).unwrap_err();
        assert!(error.contains("incomplete verified postimages"), "{error}");
        assert_eq!(fs::read(destination).unwrap(), b"translated");
        assert!(journal_root(&state).exists());
    }

    #[test]
    fn legacy_schema_six_authentication_tag_is_accepted_but_not_rewritten() {
        let temp = tempfile::tempdir().unwrap();
        let root = fs::canonicalize(temp.path()).unwrap();
        let app = root.join("Cavalry.app");
        let state = root.join("state");
        let source = root.join("translated.json");
        let destination = app.join("Contents/assets/appStrings.json");
        write(&destination, b"official");
        write(&source, b"translated");
        let transaction = MacApplyTransaction::begin(
            &state,
            &app,
            &[CopyPair {
                src: source,
                dst: destination.clone(),
            }],
        )
        .unwrap();
        let manifest_path = transaction.journal_root.join(MANIFEST_NAME);
        let mut value: serde_json::Value =
            serde_json::from_slice(&fs::read(&manifest_path).unwrap()).unwrap();
        assert!(
            value.get("authenticationTag").is_none(),
            "new journals must not depend on Keychain authentication"
        );
        value["authenticationTag"] = serde_json::Value::String("legacy-tag".to_string());
        fs::write(&manifest_path, serde_json::to_vec_pretty(&value).unwrap()).unwrap();
        std::mem::forget(transaction);

        assert!(recover_pending(&state, &app).unwrap());
        assert_eq!(fs::read(destination).unwrap(), b"official");
    }

    #[test]
    fn manifest_rejects_non_regular_fingerprint_modes() {
        let temp = tempfile::tempdir().unwrap();
        let root = fs::canonicalize(temp.path()).unwrap();
        let app = root.join("Cavalry.app");
        let state = root.join("state");
        let source = root.join("translated.json");
        let destination = app.join("Contents/assets/appStrings.json");
        write(&destination, b"official");
        write(&source, b"translated");
        let mut transaction = MacApplyTransaction::begin(
            &state,
            &app,
            &[CopyPair {
                src: source,
                dst: destination.clone(),
            }],
        )
        .unwrap();
        transaction.manifest.entries[0]
            .expected_copy
            .as_mut()
            .unwrap()
            .mode = libc::S_IFDIR as u32 | 0o755;
        write_manifest(&transaction.journal_dir, &transaction.manifest).unwrap();
        transaction.active = false;
        std::mem::forget(transaction);

        let error = recover_pending(&state, &app).unwrap_err();
        assert!(
            error.contains("invalid regular-file fingerprint"),
            "{error}"
        );
        assert_eq!(fs::read(destination).unwrap(), b"translated");
        assert!(journal_root(&state).exists());
    }

    #[test]
    fn unknown_recovery_drift_is_never_overwritten() {
        let temp = tempfile::tempdir().unwrap();
        let root = fs::canonicalize(temp.path()).unwrap();
        let app = root.join("Cavalry.app");
        let state = root.join("state");
        let source = root.join("translated.json");
        let destination = app.join("Contents/assets/appStrings.json");
        write(&destination, b"official");
        write(&source, b"translated");
        let transaction = MacApplyTransaction::begin(
            &state,
            &app,
            &[CopyPair {
                src: source,
                dst: destination.clone(),
            }],
        )
        .unwrap();
        write(&destination, b"external-drift");
        std::mem::forget(transaction);

        let error = recover_pending(&state, &app).unwrap_err();
        assert!(error.contains("unknown destination drift"), "{error}");
        assert_eq!(fs::read(destination).unwrap(), b"external-drift");
        assert!(journal_root(&state).exists());
    }

    #[test]
    fn interrupted_managed_removal_restores_the_original_file() {
        let temp = tempfile::tempdir().unwrap();
        let root = fs::canonicalize(temp.path()).unwrap();
        let app = root.join("Cavalry.app");
        let state = root.join("state");
        let managed = app.join("Contents/MacOS/CavalryLauncher");
        write(&managed, b"managed-wrapper");

        let transaction =
            MacApplyTransaction::begin_with_removals(&state, &app, &[], &[managed.clone()])
                .unwrap();
        assert!(!managed.exists());
        std::mem::forget(transaction);

        assert!(recover_pending(&state, &app).unwrap());
        assert_eq!(fs::read(managed).unwrap(), b"managed-wrapper");
        finalize_recovered(&state, &app).unwrap();
    }

    #[test]
    fn signing_side_effect_preimages_are_restored_even_without_a_copy_pair() {
        let temp = tempfile::tempdir().unwrap();
        let root = fs::canonicalize(temp.path()).unwrap();
        let app = root.join("Cavalry.app");
        let state = root.join("state");
        let code_resources = app.join("Contents/_CodeSignature/CodeResources");
        let newly_created_signature =
            app.join("Contents/Frameworks/libCavalryTranslatorInjector.dylib");
        write(&code_resources, b"vendor-seal");
        fs::create_dir_all(newly_created_signature.parent().unwrap()).unwrap();

        let mut transaction = MacApplyTransaction::begin_with_removals_and_side_effects(
            &state,
            &app,
            &[],
            &[],
            &[code_resources.clone(), newly_created_signature.clone()],
        )
        .unwrap();
        transaction.begin_signing().unwrap();
        write(&code_resources, b"ad-hoc-seal");
        write(&newly_created_signature, b"new-side-effect");
        transaction
            .verify_and_record_signing_postimages(|_| Ok(()))
            .unwrap();
        let message = transaction.rollback_with_cause("simulated signing failure");

        assert!(
            message.contains("Exact bundle and state preimages were restored"),
            "{message}"
        );
        assert_eq!(fs::read(code_resources).unwrap(), b"vendor-seal");
        assert!(!newly_created_signature.exists());
    }

    #[test]
    fn external_script_signature_components_are_bounded_and_rolled_back() {
        let temp = tempfile::tempdir().unwrap();
        let root = fs::canonicalize(temp.path()).unwrap();
        let app = root.join("Cavalry.app");
        let state = root.join("state");
        let components = crate::privilege::macos::bundle::external_signature_component_paths(&app);
        fs::create_dir_all(app.join("Contents/_CodeSignature")).unwrap();

        let mut transaction = MacApplyTransaction::begin_with_removals_and_side_effects(
            &state,
            &app,
            &[],
            &[],
            &components,
        )
        .unwrap();
        transaction.begin_signing().unwrap();
        for component in &components {
            write(component, b"managed external signature component");
        }
        transaction
            .verify_and_record_signing_postimages(|_| Ok(()))
            .unwrap();
        let message = transaction.rollback_with_cause("simulated interrupted app seal");

        assert!(
            message.contains("Exact bundle and state preimages were restored"),
            "{message}"
        );
        for component in components {
            assert!(
                !component.exists(),
                "{} survived rollback",
                component.display()
            );
        }
    }

    #[test]
    fn unrecorded_bounded_signing_side_effect_is_restored_from_signing_phase() {
        let temp = tempfile::tempdir().unwrap();
        let root = fs::canonicalize(temp.path()).unwrap();
        let app = root.join("Cavalry.app");
        let state = root.join("state");
        let code_resources = app.join("Contents/_CodeSignature/CodeResources");
        write(&code_resources, b"vendor-seal");

        let mut transaction = MacApplyTransaction::begin_with_removals_and_side_effects(
            &state,
            &app,
            &[],
            &[],
            std::slice::from_ref(&code_resources),
        )
        .unwrap();
        transaction.begin_signing().unwrap();
        write(&code_resources, b"unverified-signing-output");

        let message = transaction.rollback_with_cause("simulated interrupted codesign");

        assert!(
            message.contains("Exact bundle and state preimages were restored"),
            "{message}"
        );
        assert_eq!(fs::read(code_resources).unwrap(), b"vendor-seal");
        assert!(journal_root(&state).exists());
    }

    #[test]
    fn signing_postimage_requires_explicit_successful_verifier() {
        let temp = tempfile::tempdir().unwrap();
        let root = fs::canonicalize(temp.path()).unwrap();
        let app = root.join("Cavalry.app");
        let state = root.join("state");
        let code_resources = app.join("Contents/_CodeSignature/CodeResources");
        write(&code_resources, b"vendor-seal");

        let mut transaction = MacApplyTransaction::begin_with_removals_and_side_effects(
            &state,
            &app,
            &[],
            &[],
            std::slice::from_ref(&code_resources),
        )
        .unwrap();
        transaction.begin_signing().unwrap();
        write(&code_resources, b"ad-hoc-seal");

        let error = transaction
            .verify_and_record_signing_postimages(|_| Err("signature invalid".to_string()))
            .unwrap_err();
        assert_eq!(error, "signature invalid");
        assert!(transaction.checkpoint_verified_bundle().is_err());

        let raced_side_effect = code_resources.clone();
        let error = transaction
            .verify_and_record_signing_postimages(move |_| {
                write(&raced_side_effect, b"changed-after-candidate-capture");
                Ok(())
            })
            .unwrap_err();
        assert!(
            error.contains("changed during explicit verification"),
            "{error}"
        );
        assert!(transaction.checkpoint_verified_bundle().is_err());
        write(&code_resources, b"ad-hoc-seal");

        transaction
            .verify_and_record_signing_postimages(|resolved_root| {
                assert_eq!(resolved_root, app);
                Ok(())
            })
            .unwrap();
        transaction.checkpoint_verified_bundle().unwrap();
    }

    #[test]
    fn signing_verifier_cannot_authorize_a_replacement_bundle_root() {
        let temp = tempfile::tempdir().unwrap();
        let root = fs::canonicalize(temp.path()).unwrap();
        let app = root.join("Cavalry.app");
        let moved_app = root.join("Cavalry-original.app");
        let state = root.join("state");
        let code_resources = app.join("Contents/_CodeSignature/CodeResources");
        write(&code_resources, b"vendor-seal");

        let mut transaction = MacApplyTransaction::begin_with_removals_and_side_effects(
            &state,
            &app,
            &[],
            &[],
            std::slice::from_ref(&code_resources),
        )
        .unwrap();
        transaction.begin_signing().unwrap();
        write(&code_resources, b"ad-hoc-seal");
        let replacement_root = app.clone();
        let original_root = moved_app.clone();

        let error = transaction
            .verify_and_record_signing_postimages(move |resolved_root| {
                assert_eq!(resolved_root, replacement_root);
                fs::rename(&replacement_root, &original_root).unwrap();
                write(
                    &replacement_root.join("Contents/_CodeSignature/CodeResources"),
                    b"different-valid-looking-bundle",
                );
                Ok(())
            })
            .unwrap_err();
        assert!(error.contains("identity changed"), "{error}");

        fs::remove_dir_all(&app).unwrap();
        fs::rename(&moved_app, &app).unwrap();
        // The refused candidate remains deliberately unrecorded. Put the fixture back on its
        // already-authorized preimage before exercising ordinary rollback cleanup.
        write(&code_resources, b"vendor-seal");
        let message = transaction.rollback_with_cause("replacement bundle verifier refused");
        assert!(
            message.contains("Exact bundle and state preimages were restored"),
            "{message}"
        );
        assert_eq!(fs::read(code_resources).unwrap(), b"vendor-seal");
    }

    #[test]
    fn deferred_final_marker_requires_durable_pre_marker_gate() {
        let temp = tempfile::tempdir().unwrap();
        let root = fs::canonicalize(temp.path()).unwrap();
        let app = root.join("Cavalry.app");
        let state = root.join("state");
        let marker = app.join("Contents/Resources/.cavalry-i18n-language");
        let pending_source = root.join("pending-marker");
        let final_source = root.join("final-marker");
        write(&marker, b"en\n");
        write(&pending_source, b"pending\n");
        write(&final_source, b"zh-Hans\n");
        let pending = CopyPair {
            src: pending_source,
            dst: marker.clone(),
        };
        let final_pair = CopyPair {
            src: final_source,
            dst: marker.clone(),
        };

        let mut transaction = MacApplyTransaction::begin_with_deferred_pairs(
            &state,
            &app,
            std::slice::from_ref(&pending),
            &[],
            std::slice::from_ref(&final_pair),
            &[],
            &[],
        )
        .unwrap();
        assert_eq!(fs::read(&marker).unwrap(), b"pending\n");
        transaction.begin_signing().unwrap();

        let error = transaction.apply_deferred_pair(&final_pair).unwrap_err();
        assert!(error.display().contains("not authorized"), "{error}");
        assert_eq!(fs::read(&marker).unwrap(), b"pending\n");

        transaction.authorize_deferred_commit().unwrap();
        transaction.apply_deferred_pair(&final_pair).unwrap();
        assert_eq!(fs::read(&marker).unwrap(), b"zh-Hans\n");
        assert!(transaction.manifest.deferred_published);
        transaction.checkpoint_verified_bundle().unwrap();
    }

    #[test]
    fn official_restore_keeps_managed_launcher_until_deferred_info_and_removals_gate() {
        let temp = tempfile::tempdir().unwrap();
        let root = fs::canonicalize(temp.path()).unwrap();
        let app = root.join("Cavalry.app");
        let state = root.join("state");
        let executable = app.join("Contents/MacOS/Cavalry");
        let launcher = app.join("Contents/MacOS/CavalryLauncher");
        let marker = app.join("Contents/Resources/.cavalry-i18n-language");
        let info = app.join("Contents/Info.plist");
        let asset = app.join("Contents/assets/appStrings.json");
        let vendor_info = root.join("vendor-Info.plist");
        let vendor_asset = root.join("vendor-appStrings.json");
        write(&executable, b"vendor-main");
        write(&launcher, b"managed-journal-aware-launcher");
        write(&marker, b"zh-Hans\n");
        write(&info, b"managed-launcher-info");
        write(&asset, b"translated");
        write(&vendor_info, b"vendor-main-info");
        write(&vendor_asset, b"vendor-English");
        let payload = CopyPair {
            src: vendor_asset,
            dst: asset.clone(),
        };
        let deferred_info = CopyPair {
            src: vendor_info,
            dst: info.clone(),
        };
        let mutation_destinations = vec![
            asset.clone(),
            info.clone(),
            launcher.clone(),
            marker.clone(),
        ];
        let preimages =
            MacApplyTransaction::capture_preimages(&app, &mutation_destinations).unwrap();

        let mut transaction =
            MacApplyTransaction::begin_with_deferred_pairs_and_removals_guarded_by(
                &state,
                &app,
                &[],
                &[],
                std::slice::from_ref(&payload),
                std::slice::from_ref(&deferred_info),
                &[],
                &[launcher.clone(), marker.clone()],
                &[],
                &preimages,
                |_| Ok(()),
            )
            .unwrap();

        assert_eq!(fs::read(&asset).unwrap(), b"vendor-English");
        assert_eq!(fs::read(&info).unwrap(), b"managed-launcher-info");
        assert_eq!(
            fs::read(&launcher).unwrap(),
            b"managed-journal-aware-launcher"
        );
        assert!(marker.exists());

        transaction.begin_signing().unwrap();
        transaction.authorize_deferred_commit().unwrap();
        let error = transaction.apply_deferred_removals().unwrap_err();
        assert!(error.contains("replacements must be published"), "{error}");
        assert_eq!(fs::read(&info).unwrap(), b"managed-launcher-info");
        assert!(launcher.exists());
        assert!(marker.exists());
        transaction.apply_deferred_pair(&deferred_info).unwrap();
        assert!(
            launcher.exists(),
            "Info publication must not implicitly remove launcher"
        );
        transaction.apply_deferred_removals().unwrap();

        assert_eq!(fs::read(&info).unwrap(), b"vendor-main-info");
        assert!(!launcher.exists());
        assert!(!marker.exists());
        assert!(transaction.manifest.deferred_published);
        transaction.checkpoint_verified_bundle().unwrap();
    }

    #[test]
    fn guarded_begin_checks_process_before_state_mutation_and_preserves_typed_running_result() {
        let temp = tempfile::tempdir().unwrap();
        let root = fs::canonicalize(temp.path()).unwrap();
        let app = root.join("Cavalry.app");
        let state = root.join("state");
        let executable = app.join("Contents/MacOS/Cavalry");
        let destination = app.join("Contents/assets/appStrings.json");
        let source = root.join("translated.json");
        write(&executable, b"cavalry");
        write(&destination, b"official");
        write(&source, b"translated");
        let pair = CopyPair {
            src: source,
            dst: destination.clone(),
        };
        let preimages =
            MacApplyTransaction::capture_preimages(&app, std::slice::from_ref(&destination))
                .unwrap();

        let error = MacApplyTransaction::begin_with_deferred_pairs_guarded_by(
            &state,
            &app,
            &[],
            std::slice::from_ref(&pair),
            &[],
            &[],
            &[],
            &preimages,
            |exact| {
                assert_eq!(exact, executable);
                assert!(!state.exists(), "guard must run before state mutation");
                Err(ExactProcessGuardError::StillRunning { pids: vec![77] })
            },
        )
        .unwrap_err();

        assert!(matches!(
            error,
            MacApplyBeginError::CavalryStillRunning { pids } if pids == vec![77]
        ));
        assert_eq!(fs::read(destination).unwrap(), b"official");
        assert!(!state.exists());
    }

    #[test]
    fn guarded_begin_rejects_preimage_drift_during_process_guard_before_bundle_write() {
        let temp = tempfile::tempdir().unwrap();
        let root = fs::canonicalize(temp.path()).unwrap();
        let app = root.join("Cavalry.app");
        let state = root.join("state");
        let executable = app.join("Contents/MacOS/Cavalry");
        let destination = app.join("Contents/assets/appStrings.json");
        let source = root.join("translated.json");
        write(&executable, b"cavalry");
        write(&destination, b"official");
        write(&source, b"translated");
        let pair = CopyPair {
            src: source,
            dst: destination.clone(),
        };
        let preimages =
            MacApplyTransaction::capture_preimages(&app, std::slice::from_ref(&destination))
                .unwrap();
        let raced = destination.clone();

        let error = MacApplyTransaction::begin_with_deferred_pairs_guarded_by(
            &state,
            &app,
            &[],
            std::slice::from_ref(&pair),
            &[],
            &[],
            &[],
            &preimages,
            move |_| {
                write(&raced, b"external-drift");
                Ok(())
            },
        )
        .unwrap_err();

        assert!(
            error.display().contains("changed while journaling"),
            "{}",
            error.display()
        );
        assert_eq!(fs::read(destination).unwrap(), b"external-drift");
        assert!(!journal_root(&state).exists());
    }

    #[test]
    fn guarded_begin_rechecks_process_after_backup_capture_before_bundle_write() {
        let temp = tempfile::tempdir().unwrap();
        let root = fs::canonicalize(temp.path()).unwrap();
        let app = root.join("Cavalry.app");
        let state = root.join("state");
        let executable = app.join("Contents/MacOS/Cavalry");
        let destination = app.join("Contents/assets/appStrings.json");
        let source = root.join("translated.json");
        write(&executable, b"cavalry");
        write(&destination, b"official");
        write(&source, b"translated");
        let pair = CopyPair {
            src: source,
            dst: destination.clone(),
        };
        let preimages =
            MacApplyTransaction::capture_preimages(&app, std::slice::from_ref(&destination))
                .unwrap();
        let mut scans = 0;

        let error = MacApplyTransaction::begin_with_deferred_pairs_guarded_by(
            &state,
            &app,
            &[],
            std::slice::from_ref(&pair),
            &[],
            &[],
            &[],
            &preimages,
            |exact| {
                assert_eq!(exact, executable);
                scans += 1;
                if scans == 1 {
                    assert!(!state.exists(), "first guard precedes state mutation");
                    Ok(())
                } else {
                    assert!(
                        state.exists(),
                        "second guard follows durable backup capture"
                    );
                    assert!(
                        !journal_root(&state).exists(),
                        "second guard precedes journal publication"
                    );
                    Err(ExactProcessGuardError::StillRunning { pids: vec![88] })
                }
            },
        )
        .unwrap_err();

        assert_eq!(scans, 2);
        assert!(matches!(
            error,
            MacApplyBeginError::CavalryStillRunning { pids } if pids == vec![88]
        ));
        assert_eq!(fs::read(destination).unwrap(), b"official");
        assert!(!journal_root(&state).exists());
        assert!(fs::read_dir(&state).unwrap().all(|entry| {
            !entry
                .unwrap()
                .file_name()
                .to_string_lossy()
                .contains(".preparing-")
        }));
    }

    #[test]
    fn first_install_launch_gate_is_published_before_third_process_scan_and_rolled_back() {
        use std::os::unix::fs::MetadataExt;

        let temp = tempfile::tempdir().unwrap();
        let root = fs::canonicalize(temp.path()).unwrap();
        let app = root.join("Cavalry.app");
        let state = root.join("state");
        let executable = app.join("Contents/MacOS/Cavalry");
        let wrapper = app.join("Contents/MacOS/CavalryLauncher");
        let info = app.join("Contents/Info.plist");
        let asset = app.join("Contents/assets/appStrings.json");
        let wrapper_source = root.join("CavalryLauncher");
        let info_source = root.join("managed-Info.plist");
        let asset_source = root.join("translated.json");
        write(&executable, b"cavalry");
        write(&info, b"vendor-info");
        write(&asset, b"official");
        write(&wrapper_source, b"journal-aware-wrapper");
        write(&info_source, b"managed-wrapper-info");
        write(&asset_source, b"translated");
        let executable_inode = fs::metadata(&executable).unwrap().ino();
        let asset_inode = fs::metadata(&asset).unwrap().ino();
        let launch_gate = vec![
            CopyPair {
                src: wrapper_source,
                dst: wrapper.clone(),
            },
            CopyPair {
                src: info_source,
                dst: info.clone(),
            },
        ];
        let payload = CopyPair {
            src: asset_source,
            dst: asset.clone(),
        };
        let preimages = MacApplyTransaction::capture_preimages(
            &app,
            &[wrapper.clone(), info.clone(), asset.clone()],
        )
        .unwrap();
        let mut scans = 0;

        let error = MacApplyTransaction::begin_with_deferred_pairs_and_removals_guarded_by(
            &state,
            &app,
            &[],
            &launch_gate,
            std::slice::from_ref(&payload),
            &[],
            &[],
            &[],
            &[],
            &preimages,
            |exact| {
                scans += 1;
                assert_eq!(exact, executable);
                if scans == 3 {
                    assert!(journal_root(&state).exists());
                    assert_eq!(fs::read(&wrapper).unwrap(), b"journal-aware-wrapper");
                    assert_eq!(fs::read(&info).unwrap(), b"managed-wrapper-info");
                    assert_eq!(fs::read(&asset).unwrap(), b"official");
                    Err(ExactProcessGuardError::StillRunning { pids: vec![99] })
                } else {
                    Ok(())
                }
            },
        )
        .unwrap_err();

        assert_eq!(scans, 3);
        assert!(matches!(
            error,
            MacApplyBeginError::CavalryStillRunning { pids } if pids == vec![99]
        ));
        assert!(!wrapper.exists());
        assert_eq!(fs::read(&info).unwrap(), b"vendor-info");
        assert_eq!(fs::read(&asset).unwrap(), b"official");
        assert_eq!(fs::metadata(&executable).unwrap().ino(), executable_inode);
        assert_eq!(fs::metadata(&asset).unwrap().ino(), asset_inode);
        assert!(journal_root(&state).exists());
        finalize_recovered(&state, &app).unwrap();
    }

    #[test]
    fn observe_only_asset_drift_blocks_bundle_checkpoint_without_overwriting_external_bytes() {
        let temp = tempfile::tempdir().unwrap();
        let root = fs::canonicalize(temp.path()).unwrap();
        let app = root.join("Cavalry.app");
        let state = root.join("state");
        let executable = app.join("Contents/MacOS/Cavalry");
        let changed = app.join("Contents/assets/changed.json");
        let unchanged = app.join("Contents/assets/unchanged.json");
        let source = root.join("translated.json");
        write(&executable, b"cavalry");
        write(&changed, b"official-changed");
        write(&unchanged, b"official-unchanged");
        write(&source, b"translated");
        let payload = CopyPair {
            src: source,
            dst: changed.clone(),
        };
        let preimages =
            MacApplyTransaction::capture_preimages(&app, &[changed.clone(), unchanged.clone()])
                .unwrap();
        let mut transaction = MacApplyTransaction::begin_with_deferred_pairs_guarded_by(
            &state,
            &app,
            &[],
            std::slice::from_ref(&payload),
            &[],
            &[],
            &[],
            &preimages,
            |_| Ok(()),
        )
        .unwrap();
        assert_eq!(transaction.manifest.observed_bundle_preimages.len(), 1);
        transaction.begin_signing().unwrap();
        write(&unchanged, b"external-update");

        let error = transaction.checkpoint_verified_bundle().unwrap_err();
        assert!(
            error.contains("observe-only macOS preimage drifted"),
            "{error}"
        );
        let rollback = transaction.rollback_with_cause("observe-only drift");
        assert!(
            rollback.contains("Exact bundle and state preimages were restored"),
            "{rollback}"
        );
        assert_eq!(fs::read(changed).unwrap(), b"official-changed");
        assert_eq!(fs::read(unchanged).unwrap(), b"external-update");
        finalize_recovered(&state, &app).unwrap();
    }

    #[test]
    fn uncertain_state_durability_never_advances_state_committed_and_rolls_back() {
        let temp = tempfile::tempdir().unwrap();
        let root = fs::canonicalize(temp.path()).unwrap();
        let app = root.join("Cavalry.app");
        let state = root.join("state");
        let destination = app.join("Contents/assets/appStrings.json");
        let source = root.join("translated.json");
        write(&destination, b"official");
        write(&source, b"translated");
        let mut transaction = MacApplyTransaction::begin(
            &state,
            &app,
            &[CopyPair {
                src: source,
                dst: destination.clone(),
            }],
        )
        .unwrap();
        transaction.begin_signing().unwrap();
        transaction.checkpoint_verified_bundle().unwrap();
        transaction.begin_state_commit().unwrap();
        crate::state::write_state_with_operation(
            &state,
            &crate::state::State {
                current_lang: "zh-Hans".to_string(),
                ..crate::state::State::default()
            },
            transaction.operation_id(),
        )
        .unwrap();
        FAIL_NEXT_STATE_DURABILITY_SYNC.with(|flag| flag.set(true));

        let error = transaction.checkpoint_state_commit().unwrap_err();
        assert!(error.contains("uncertain state durability"), "{error}");
        assert_eq!(transaction.manifest.phase, JournalPhase::StateCommitting);
        let result = transaction.rollback_with_cause(error);

        assert!(result.contains("Exact bundle and state preimages were restored"));
        assert_eq!(fs::read(destination).unwrap(), b"official");
        finalize_recovered(&state, &app).unwrap();
    }

    #[test]
    fn interrupted_transaction_restores_recursive_quarantine_preimages() {
        let temp = tempfile::tempdir().unwrap();
        let root = fs::canonicalize(temp.path()).unwrap();
        let app = root.join("Cavalry.app");
        let state = root.join("state");
        let source = root.join("translated.json");
        let destination = app.join("Contents/assets/appStrings.json");
        write(&destination, b"official");
        write(&source, b"translated");
        restore_quarantine_xattr(&app, b"root-quarantine").unwrap();
        restore_quarantine_xattr(&destination, b"file-quarantine").unwrap();

        let transaction = MacApplyTransaction::begin(
            &state,
            &app,
            &[CopyPair {
                src: source,
                dst: destination.clone(),
            }],
        )
        .unwrap();
        remove_quarantine_xattr(&app).unwrap();
        assert_eq!(read_quarantine_xattr(&destination).unwrap(), None);
        std::mem::forget(transaction);

        assert!(recover_pending(&state, &app).unwrap());
        assert_eq!(
            read_quarantine_xattr(&app).unwrap(),
            Some(b"root-quarantine".to_vec())
        );
        assert_eq!(
            read_quarantine_xattr(&destination).unwrap(),
            Some(b"file-quarantine".to_vec())
        );
        finalize_recovered(&state, &app).unwrap();
    }

    #[test]
    fn interrupted_state_temporaries_are_removed_during_recovery() {
        let temp = tempfile::tempdir().unwrap();
        let root = fs::canonicalize(temp.path()).unwrap();
        let app = root.join("Cavalry.app");
        let state = root.join("state");
        let source = root.join("translated.json");
        let destination = app.join("Contents/assets/appStrings.json");
        write(&destination, b"official");
        write(&source, b"translated");
        let transaction = MacApplyTransaction::begin(
            &state,
            &app,
            &[CopyPair {
                src: source,
                dst: destination,
            }],
        )
        .unwrap();
        let state_temporaries = transaction
            .manifest
            .state_temporary_paths
            .iter()
            .map(PathBuf::from)
            .collect::<Vec<_>>();
        for temporary in &state_temporaries {
            write(temporary, b"partial-state");
        }
        std::mem::forget(transaction);

        assert!(recover_pending(&state, &app).unwrap());
        assert!(state_temporaries.iter().all(|path| !path.exists()));
        finalize_recovered(&state, &app).unwrap();
    }

    #[cfg(unix)]
    #[test]
    fn pending_recovery_rejects_symlinked_backup_preimages() {
        use std::os::unix::fs::symlink;

        let temp = tempfile::tempdir().unwrap();
        let root = fs::canonicalize(temp.path()).unwrap();
        let app = root.join("Cavalry.app");
        let state = root.join("state");
        let source = root.join("translated.json");
        let destination = app.join("Contents/assets/appStrings.json");
        let outside = root.join("outside.preimage");
        write(&destination, b"official");
        write(&source, b"translated");
        write(&outside, b"official");
        let transaction = MacApplyTransaction::begin(
            &state,
            &app,
            &[CopyPair {
                src: source,
                dst: destination.clone(),
            }],
        )
        .unwrap();
        let backup = transaction.journal_root.join("backups/0.preimage");
        fs::remove_file(&backup).unwrap();
        symlink(&outside, &backup).unwrap();
        std::mem::forget(transaction);

        let error = recover_pending(&state, &app).unwrap_err();
        assert!(error.contains("not a regular file"), "{error}");
        assert_eq!(fs::read(destination).unwrap(), b"translated");
    }

    #[test]
    fn pinned_parent_rejects_ancestor_symlink_swap_without_redirecting_copy() {
        use std::os::unix::fs::symlink;

        let temp = tempfile::tempdir().unwrap();
        let root = fs::canonicalize(temp.path()).unwrap();
        let app = root.join("Cavalry.app");
        let source = root.join("translated.json");
        let destination = app.join("Contents/assets/appStrings.json");
        let assets = destination.parent().unwrap().to_path_buf();
        let pinned_assets = app.join("Contents/assets-pinned");
        let outside = root.join("outside-assets");
        let outside_destination = outside.join("appStrings.json");
        write(&destination, b"official");
        write(&source, b"translated");
        write(&outside_destination, b"outside");
        let bundle_root = SecureDirectory::open(&app).unwrap();
        let pair = CopyPair {
            src: source.clone(),
            dst: destination.clone(),
        };
        let expected = fingerprint_regular_file(&source).unwrap();
        let accepted = [current_fingerprint_at(&bundle_root, &destination).unwrap()];
        let temporary = temporary_path_for_pair(&pair, 0);
        BEFORE_ATOMIC_REPLACE.with(|slot| {
            *slot.borrow_mut() = Some(Box::new(move || {
                fs::rename(&assets, &pinned_assets).unwrap();
                symlink(&outside, &assets).unwrap();
            }));
        });

        let error = write_pair_atomically(&pair, &temporary, &bundle_root, &expected, &accepted)
            .unwrap_err();

        assert!(
            error.display().contains("securely traverse")
                || error.display().contains("ancestor changed"),
            "{error}"
        );
        assert_eq!(fs::read(outside_destination).unwrap(), b"outside");
        assert_eq!(
            fs::read(app.join("Contents/assets-pinned/appStrings.json")).unwrap(),
            b"official"
        );
    }

    #[test]
    fn atomic_exchange_reverses_leaf_symlink_race_without_touching_target() {
        use std::os::unix::fs::symlink;

        let temp = tempfile::tempdir().unwrap();
        let root = fs::canonicalize(temp.path()).unwrap();
        let app = root.join("Cavalry.app");
        let source = root.join("translated.json");
        let destination = app.join("Contents/assets/appStrings.json");
        let displaced = app.join("Contents/assets/appStrings.raced.json");
        let outside = root.join("outside.json");
        write(&destination, b"official");
        write(&source, b"translated");
        write(&outside, b"outside");
        let bundle_root = SecureDirectory::open(&app).unwrap();
        let pair = CopyPair {
            src: source.clone(),
            dst: destination.clone(),
        };
        let expected = fingerprint_regular_file(&source).unwrap();
        let accepted = [current_fingerprint_at(&bundle_root, &destination).unwrap()];
        let temporary = temporary_path_for_pair(&pair, 0);
        let destination_for_hook = destination.clone();
        let outside_for_hook = outside.clone();
        let displaced_for_hook = displaced.clone();
        AFTER_DESTINATION_COMPARE.with(|slot| {
            *slot.borrow_mut() = Some(Box::new(move || {
                fs::rename(&destination_for_hook, &displaced_for_hook).unwrap();
                symlink(&outside_for_hook, &destination_for_hook).unwrap();
            }));
        });

        let error = write_pair_atomically(&pair, &temporary, &bundle_root, &expected, &accepted)
            .unwrap_err();

        assert!(
            error.display().contains("atomic replacement boundary"),
            "{error}"
        );
        assert_eq!(fs::read(outside).unwrap(), b"outside");
        assert!(fs::symlink_metadata(destination)
            .unwrap()
            .file_type()
            .is_symlink());
        assert_eq!(fs::read(displaced).unwrap(), b"official");
    }

    #[test]
    fn pending_recovery_rejects_symlinked_backup_directory() {
        use std::os::unix::fs::symlink;

        let temp = tempfile::tempdir().unwrap();
        let root = fs::canonicalize(temp.path()).unwrap();
        let app = root.join("Cavalry.app");
        let state = root.join("state");
        let source = root.join("translated.json");
        let destination = app.join("Contents/assets/appStrings.json");
        let outside = root.join("outside-backups");
        write(&destination, b"official");
        write(&source, b"translated");
        fs::create_dir_all(&outside).unwrap();
        let transaction = MacApplyTransaction::begin(
            &state,
            &app,
            &[CopyPair {
                src: source,
                dst: destination.clone(),
            }],
        )
        .unwrap();
        let backups = transaction.journal_root.join("backups");
        fs::rename(&backups, transaction.journal_root.join("backups.real")).unwrap();
        symlink(&outside, &backups).unwrap();
        std::mem::forget(transaction);

        let error = recover_pending(&state, &app).unwrap_err();
        assert!(error.contains("not a regular directory"), "{error}");
        assert_eq!(fs::read(destination).unwrap(), b"translated");
        assert!(fs::read_dir(outside).unwrap().next().is_none());
    }

    #[test]
    fn pending_recovery_rejects_symlinked_manifest_leaf() {
        use std::os::unix::fs::symlink;

        let temp = tempfile::tempdir().unwrap();
        let root = fs::canonicalize(temp.path()).unwrap();
        let app = root.join("Cavalry.app");
        let state = root.join("state");
        let source = root.join("translated.json");
        let destination = app.join("Contents/assets/appStrings.json");
        let outside = root.join("outside-manifest.json");
        write(&destination, b"official");
        write(&source, b"translated");
        write(&outside, b"outside");
        let transaction = MacApplyTransaction::begin(
            &state,
            &app,
            &[CopyPair {
                src: source,
                dst: destination.clone(),
            }],
        )
        .unwrap();
        let manifest = transaction.journal_root.join(MANIFEST_NAME);
        fs::remove_file(&manifest).unwrap();
        symlink(&outside, &manifest).unwrap();
        std::mem::forget(transaction);

        let error = recover_pending(&state, &app).unwrap_err();
        assert!(error.contains("securely open regular file"), "{error}");
        assert_eq!(fs::read(outside).unwrap(), b"outside");
        assert_eq!(fs::read(destination).unwrap(), b"translated");
    }

    #[test]
    fn quarantine_walk_stays_on_open_directory_after_ancestor_symlink_swap() {
        use std::os::unix::fs::symlink;

        let temp = tempfile::tempdir().unwrap();
        let root = fs::canonicalize(temp.path()).unwrap();
        let app = root.join("Cavalry.app");
        let contents = app.join("Contents");
        let pinned_contents = app.join("Contents-pinned");
        let inside = contents.join("inside");
        let outside = root.join("outside");
        let outside_inside = outside.join("inside");
        write(&inside, b"inside");
        write(&outside_inside, b"outside");
        restore_quarantine_xattr(&inside, b"inside-quarantine").unwrap();
        restore_quarantine_xattr(&outside_inside, b"outside-quarantine").unwrap();
        BEFORE_QUARANTINE_DESCEND.with(|slot| {
            *slot.borrow_mut() = Some(Box::new(move || {
                fs::rename(&contents, &pinned_contents).unwrap();
                symlink(&outside, &contents).unwrap();
            }));
        });

        clear_quarantine_tree(&app).unwrap();

        assert_eq!(
            read_quarantine_xattr(&app.join("Contents-pinned/inside")).unwrap(),
            None
        );
        assert_eq!(
            read_quarantine_xattr(&outside_inside).unwrap(),
            Some(b"outside-quarantine".to_vec())
        );
    }

    #[test]
    fn quarantine_walk_rejects_hardlink_crossing_bundle_boundary() {
        let temp = tempfile::tempdir().unwrap();
        let root = fs::canonicalize(temp.path()).unwrap();
        let app = root.join("Cavalry.app");
        let outside = root.join("outside");
        let inside = app.join("Contents/inside-hardlink");
        write(&outside, b"outside");
        restore_quarantine_xattr(&outside, b"outside-quarantine").unwrap();
        fs::create_dir_all(inside.parent().unwrap()).unwrap();
        fs::hard_link(&outside, &inside).unwrap();

        let error = clear_quarantine_tree(&app).unwrap_err();

        assert!(error.contains("hard-linked bundle file"), "{error}");
        let outside_node = open_test_quarantine_node(&outside).unwrap();
        assert_eq!(
            // Read directly for this assertion: the production helper intentionally refuses any
            // hard-linked regular fd before xattr access.
            unsafe {
                let name = CString::new(QUARANTINE_XATTR).unwrap();
                let mut value = vec![0_u8; 64];
                let length = libc::fgetxattr(
                    outside_node.fd.as_raw_fd(),
                    name.as_ptr(),
                    value.as_mut_ptr().cast(),
                    value.len(),
                    0,
                    0,
                );
                assert!(length >= 0);
                value.truncate(length as usize);
                value
            },
            b"outside-quarantine"
        );
    }

    #[test]
    fn secure_unlink_rejects_leaf_replacement_before_name_removal() {
        use std::os::unix::fs::symlink;

        let temp = tempfile::tempdir().unwrap();
        let root = fs::canonicalize(temp.path()).unwrap();
        let app = root.join("Cavalry.app");
        let destination = app.join("Contents/managed-runtime");
        let displaced = app.join("Contents/managed-runtime.raced");
        let outside = root.join("outside");
        write(&destination, b"managed");
        write(&outside, b"outside");
        let bundle_root = SecureDirectory::open(&app).unwrap();
        let destination_for_hook = destination.clone();
        let displaced_for_hook = displaced.clone();
        let outside_for_hook = outside.clone();
        BEFORE_UNLINK_REVALIDATE.with(|slot| {
            *slot.borrow_mut() = Some(Box::new(move || {
                fs::rename(&destination_for_hook, &displaced_for_hook).unwrap();
                symlink(&outside_for_hook, &destination_for_hook).unwrap();
            }));
        });

        let error = bundle_root
            .unlink_regular_or_absent(&destination)
            .unwrap_err();

        assert!(error.contains("Removal leaf changed"), "{error}");
        assert_eq!(fs::read(&outside).unwrap(), b"outside");
        assert_eq!(fs::read(displaced).unwrap(), b"managed");
        assert!(fs::symlink_metadata(destination)
            .unwrap()
            .file_type()
            .is_symlink());
    }

    #[test]
    fn transaction_rejects_symlinked_bundle_root_leaf() {
        use std::os::unix::fs::symlink;

        let temp = tempfile::tempdir().unwrap();
        let root = fs::canonicalize(temp.path()).unwrap();
        let real_app = root.join("Real-Cavalry.app");
        let selected_app = root.join("Cavalry.app");
        let state = root.join("state");
        let source = root.join("translated.json");
        let destination = selected_app.join("Contents/assets/appStrings.json");
        write(
            &real_app.join("Contents/assets/appStrings.json"),
            b"official",
        );
        write(&source, b"translated");
        symlink(&real_app, &selected_app).unwrap();

        let error = MacApplyTransaction::begin(
            &state,
            &selected_app,
            &[CopyPair {
                src: source,
                dst: destination,
            }],
        )
        .unwrap_err();

        assert!(error.display().contains("symlink"), "{}", error.display());
        assert_eq!(
            fs::read(real_app.join("Contents/assets/appStrings.json")).unwrap(),
            b"official"
        );
        assert!(!journal_root(&state).exists());
    }

    #[test]
    fn root_resolution_tracks_open_fd_across_visible_leaf_swap() {
        use std::os::unix::fs::symlink;

        let temp = tempfile::tempdir().unwrap();
        let root = fs::canonicalize(temp.path()).unwrap();
        let selected = root.join("Cavalry.app");
        let pinned = root.join("Cavalry-pinned.app");
        let outside = root.join("Outside.app");
        fs::create_dir_all(&selected).unwrap();
        fs::create_dir_all(&outside).unwrap();
        let selected_for_hook = selected.clone();
        let pinned_for_hook = pinned.clone();
        let outside_for_hook = outside.clone();
        AFTER_ROOT_DIRECTORY_OPEN.with(|slot| {
            *slot.borrow_mut() = Some(Box::new(move || {
                fs::rename(&selected_for_hook, &pinned_for_hook).unwrap();
                symlink(&outside_for_hook, &selected_for_hook).unwrap();
            }));
        });

        let resolved = SecureDirectory::open_resolved(&selected, "test root").unwrap();

        assert_eq!(resolved.path, pinned);
        assert_ne!(resolved.path, outside);
        assert_eq!(
            fd_identity(resolved.fd.as_raw_fd()).unwrap(),
            fd_identity(SecureDirectory::open(&pinned).unwrap().fd.as_raw_fd()).unwrap()
        );
    }
}
