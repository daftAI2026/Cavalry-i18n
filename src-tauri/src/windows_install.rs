/**
 * [INPUT]: 依赖 Windows PowerShell 5.1 进程查询、MSI advertised shortcut API 与标准环境目录
 * [OUTPUT]: 对外提供运行中进程、MSI 快捷方式、常见安装目录候选以及 MSI ProductVersion 查询
 * [POS]: src-tauri/src 的 Windows 只读发现边界，为 detect 提供任意安装位置线索且禁止全盘扫描
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#[cfg(windows)]
mod implementation {
    use std::{
        env,
        ffi::{OsStr, OsString},
        fs,
        os::windows::ffi::{OsStrExt, OsStringExt},
        path::{Path, PathBuf},
        process::Command,
    };

    const ERROR_SUCCESS: u32 = 0;
    const INSTALLSTATE_LOCAL: i32 = 3;
    const INSTALLSTATE_SOURCE: i32 = 4;
    const INSTALLSTATE_DEFAULT: i32 = 5;
    const MSI_GUID_CAPACITY: usize = 39;
    const MSI_FEATURE_CAPACITY: usize = 64;
    const LONG_PATH_CAPACITY: usize = 32_768;

    #[link(name = "msi")]
    extern "system" {
        fn MsiGetShortcutTargetW(
            shortcut_target: *const u16,
            product_code: *mut u16,
            feature_id: *mut u16,
            component_code: *mut u16,
        ) -> u32;
        fn MsiGetComponentPathW(
            product_code: *const u16,
            component_code: *const u16,
            path_buffer: *mut u16,
            path_buffer_chars: *mut u32,
        ) -> i32;
        fn MsiGetProductInfoW(
            product_code: *const u16,
            property: *const u16,
            value_buffer: *mut u16,
            value_buffer_chars: *mut u32,
        ) -> u32;
    }

    #[derive(Debug, Clone, PartialEq, Eq)]
    struct MsiCandidate {
        executable: PathBuf,
        product_code: Vec<u16>,
    }

    pub fn running_process_candidates() -> Vec<PathBuf> {
        let script = concat!(
            "Get-CimInstance Win32_Process -Filter \"Name='Cavalry.exe'\" ",
            "-ErrorAction SilentlyContinue | ForEach-Object { $_.ExecutablePath }"
        );
        let output = match Command::new("powershell.exe")
            .args([
                "-NoLogo",
                "-NoProfile",
                "-NonInteractive",
                "-Command",
                script,
            ])
            .output()
        {
            Ok(output) if output.status.success() => output.stdout,
            _ => return Vec::new(),
        };
        String::from_utf8_lossy(&output)
            .lines()
            .map(str::trim)
            .filter(|line| !line.is_empty())
            .map(PathBuf::from)
            .collect()
    }

    pub fn msi_shortcut_candidates() -> Vec<PathBuf> {
        msi_candidates()
            .into_iter()
            .map(|candidate| candidate.executable)
            .collect()
    }

    pub fn common_install_candidates() -> Vec<PathBuf> {
        let mut values = ["ProgramW6432", "ProgramFiles", "ProgramFiles(x86)"]
            .iter()
            .filter_map(env::var_os)
            .map(PathBuf::from)
            .map(|root| root.join("Cavalry"))
            .collect::<Vec<_>>();
        if let Some(local_app_data) = env::var_os("LOCALAPPDATA") {
            values.push(
                PathBuf::from(local_app_data)
                    .join("Programs")
                    .join("Cavalry"),
            );
        }
        dedupe(values)
    }

    pub fn product_version_for_executable(executable: &Path) -> Option<String> {
        let expected = normalize_for_compare(executable);
        msi_candidates().into_iter().find_map(|candidate| {
            if normalize_for_compare(&candidate.executable) != expected {
                return None;
            }
            msi_property(&candidate.product_code, "VersionString")
        })
    }

    fn msi_candidates() -> Vec<MsiCandidate> {
        let mut shortcuts = Vec::new();
        for start_menu in start_menu_roots() {
            collect_cavalry_shortcuts(&start_menu, &mut shortcuts);
        }
        let mut candidates = shortcuts
            .into_iter()
            .filter_map(|shortcut| resolve_msi_shortcut(&shortcut))
            .collect::<Vec<_>>();
        candidates.sort_by(|left, right| left.executable.cmp(&right.executable));
        candidates.dedup_by(|left, right| {
            normalize_for_compare(&left.executable) == normalize_for_compare(&right.executable)
        });
        candidates
    }

    fn start_menu_roots() -> Vec<PathBuf> {
        let mut roots = Vec::new();
        if let Some(program_data) = env::var_os("PROGRAMDATA") {
            roots.push(
                PathBuf::from(program_data)
                    .join("Microsoft")
                    .join("Windows")
                    .join("Start Menu")
                    .join("Programs"),
            );
        }
        if let Some(app_data) = env::var_os("APPDATA") {
            roots.push(
                PathBuf::from(app_data)
                    .join("Microsoft")
                    .join("Windows")
                    .join("Start Menu")
                    .join("Programs"),
            );
        }
        roots
    }

    fn collect_cavalry_shortcuts(root: &Path, output: &mut Vec<PathBuf>) {
        let entries = match fs::read_dir(root) {
            Ok(entries) => entries,
            Err(_) => return,
        };
        for entry in entries.flatten() {
            let path = entry.path();
            let kind = match entry.file_type() {
                Ok(kind) => kind,
                Err(_) => continue,
            };
            if kind.is_dir() {
                collect_cavalry_shortcuts(&path, output);
                continue;
            }
            let is_link = path
                .extension()
                .and_then(|extension| extension.to_str())
                .is_some_and(|extension| extension.eq_ignore_ascii_case("lnk"));
            let mentions_cavalry = path
                .file_stem()
                .and_then(|name| name.to_str())
                .is_some_and(|name| name.to_ascii_lowercase().contains("cavalry"));
            if is_link && mentions_cavalry {
                output.push(path);
            }
        }
    }

    fn resolve_msi_shortcut(shortcut: &Path) -> Option<MsiCandidate> {
        let shortcut = wide(shortcut.as_os_str());
        let mut product = vec![0u16; MSI_GUID_CAPACITY];
        let mut feature = vec![0u16; MSI_FEATURE_CAPACITY];
        let mut component = vec![0u16; MSI_GUID_CAPACITY];
        let result = unsafe {
            MsiGetShortcutTargetW(
                shortcut.as_ptr(),
                product.as_mut_ptr(),
                feature.as_mut_ptr(),
                component.as_mut_ptr(),
            )
        };
        if result != ERROR_SUCCESS {
            return None;
        }

        let mut path = vec![0u16; LONG_PATH_CAPACITY];
        let mut chars = path.len() as u32;
        let state = unsafe {
            MsiGetComponentPathW(
                product.as_ptr(),
                component.as_ptr(),
                path.as_mut_ptr(),
                &mut chars,
            )
        };
        if !matches!(
            state,
            INSTALLSTATE_LOCAL | INSTALLSTATE_SOURCE | INSTALLSTATE_DEFAULT
        ) || chars == 0
        {
            return None;
        }
        path.truncate(chars as usize);
        Some(MsiCandidate {
            executable: PathBuf::from(OsString::from_wide(&path)),
            product_code: product,
        })
    }

    fn msi_property(product_code: &[u16], property: &str) -> Option<String> {
        let property = wide(OsStr::new(property));
        let mut value = vec![0u16; 256];
        let mut chars = value.len() as u32;
        let result = unsafe {
            MsiGetProductInfoW(
                product_code.as_ptr(),
                property.as_ptr(),
                value.as_mut_ptr(),
                &mut chars,
            )
        };
        if result != ERROR_SUCCESS || chars == 0 {
            return None;
        }
        value.truncate(chars as usize);
        Some(OsString::from_wide(&value).to_string_lossy().to_string())
    }

    fn wide(value: &OsStr) -> Vec<u16> {
        value.encode_wide().chain(std::iter::once(0)).collect()
    }

    fn normalize_for_compare(path: &Path) -> String {
        path.to_string_lossy()
            .trim_start_matches(r"\\?\")
            .replace('/', "\\")
            .trim_end_matches('\\')
            .to_ascii_lowercase()
    }

    fn dedupe(values: Vec<PathBuf>) -> Vec<PathBuf> {
        let mut output = Vec::new();
        let mut seen = std::collections::HashSet::new();
        for value in values {
            if seen.insert(normalize_for_compare(&value)) {
                output.push(value);
            }
        }
        output
    }
}

#[cfg(windows)]
pub use implementation::{
    common_install_candidates, msi_shortcut_candidates, product_version_for_executable,
    running_process_candidates,
};

#[cfg(not(windows))]
pub fn running_process_candidates() -> Vec<std::path::PathBuf> {
    Vec::new()
}

#[cfg(not(windows))]
pub fn msi_shortcut_candidates() -> Vec<std::path::PathBuf> {
    Vec::new()
}

#[cfg(not(windows))]
pub fn common_install_candidates() -> Vec<std::path::PathBuf> {
    Vec::new()
}

#[cfg(not(windows))]
pub fn product_version_for_executable(_executable: &std::path::Path) -> Option<String> {
    None
}
