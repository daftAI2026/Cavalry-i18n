/**
 * [INPUT]: 依赖显式 disposable clone/evidence 环境变量、共享 Windows 路径守卫、owned clone profile、apply_language_inner、RealCommandRunner、runtime marker、Onboarding/Adjacent ready/ack 状态机、release toolchain 解析与 PowerShell exact-HWND helper
 * [OUTPUT]: 对外提供三个 ignored Windows live-clone 门：FullSurfaces 使用 TEMP-owned profile 产生自绘 PNG，Onboarding 使用 Qt 测试档案验证无重置框的 firstLaunch 五步，Adjacent 验证每语言唯一测试档案下 Tag/Assets 双 producer 三张 QWidget PNG 与 PID/HWND 锚点；全部按 exact PID/HWND 清理并恢复 English
 * [POS]: src-tauri/tests 的 Windows GUI 现场证据门；薄入口把捕获、clone guard、Adjacent、编排、release toolchain 与测试拆入 support include，三类门共享安全安装/恢复骨架但独立启动；FullSurfaces 显式绑定 run-root 下 TEMP-owned APPDATA/LOCALAPPDATA，Onboarding/Adjacent 使用 sentinel-owned Qt test profile，不继承真实 profile 写入 FullSurfaces；三门冻结双 stem fixture 并走真实 Drop/ContextMenu，证据完成后采用 WM_CLOSE 加同 PID/EXE ForceStop 兜底，不依赖 Qt UIA、坐标脚本或 Cancel
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
// Release acceptance output is machine-derived; the Rust runner never writes a PASS result.
#[cfg(target_os = "windows")]
#[path = "support/windows_disposable.rs"]
mod windows_disposable;

#[cfg(target_os = "windows")]
#[path = "support/windows_clone_guard.rs"]
mod windows_clone_guard;

#[cfg(target_os = "windows")]
mod windows_live_smoke {
    use super::windows_clone_guard::verify_live_clone_completeness;
    use super::windows_disposable::{
        assert_safe_write_surface, cleanup_qt_test_profile, disposable_install_layout,
        path_is_same, prepare_qt_test_profile, GuardedTempRoot,
    };
    use cavalry_i18n_tauri::{
        commands::apply_language_inner,
        install::InstallLayout,
        patch::{self, CopyPair},
        privilege::{CommandRunner, RealCommandRunner, RecordingRunner},
        state, windows_runtime,
    };
    use chrono::Utc;
    use serde::Deserialize;
    use sha2::{Digest, Sha256};
    use std::{
        collections::{BTreeMap, BTreeSet},
        env,
        ffi::OsString,
        fs::{self, OpenOptions},
        io::Write,
        panic::{catch_unwind, AssertUnwindSafe},
        path::{Path, PathBuf},
        process::Command as ProcessBuilder,
        sync::mpsc,
        time::{Duration, Instant},
    };

    include!("support/windows_live_capture.inc.rs");
    include!("support/windows_live_adjacent.inc.rs");
    include!("support/windows_live_orchestration.inc.rs");
    include!("support/windows_live_toolchain.inc.rs");
    include!("support/windows_live_tests.inc.rs");
}
