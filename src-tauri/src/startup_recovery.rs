#[cfg(target_os = "macos")]
use std::time::Duration;
/**
 * [INPUT]: 依赖 macOS durable apply journal、Windows privilege recovery facade、只读 state generation、严格安装身份与 CommandRunner。
 * [OUTPUT]: 提供 Tauri 启动期一次性恢复门：无 pending 时走无锁快路，确定事务完成恢复与清理，不确定状态返回可供 renderer 消费的 typed 阻断诊断，transient-busy 不进入永久错误 latch。
 * [POS]: lib.rs 装配与平台 privilege transaction 之间的跨平台启动协调层；不发现任意安装根，也不直接修改事务文件，真实 pending journal 继续由动态 status/apply 门阻断。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
use std::{path::Path, sync::Mutex};

use crate::privilege::CommandRunner;

#[derive(Default)]
pub struct StartupRecoveryStatus {
    error: Mutex<Option<String>>,
}

impl StartupRecoveryStatus {
    pub(crate) fn record(&self, result: Result<(), String>) {
        let mut error = self
            .error
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        *error = result.err();
    }

    pub(crate) fn error(&self) -> Option<String> {
        self.error
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
            .clone()
    }
}

pub(crate) fn recover_at_startup<R: CommandRunner>(
    state_dir: &Path,
    runner: &mut R,
) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        recover_at_startup_with_timeout(state_dir, runner, Duration::from_secs(15))
    }

    #[cfg(target_os = "windows")]
    {
        crate::privilege::recover_windows_language_transactions(state_dir, runner)
    }

    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        let _ = (state_dir, runner);
        Ok(())
    }
}

#[cfg(target_os = "macos")]
fn recover_at_startup_with_timeout<R: CommandRunner>(
    state_dir: &Path,
    runner: &mut R,
    timeout: Duration,
) -> Result<(), String> {
    // Most secondary launches have no recovery work. Do not wait behind an unrelated active
    // apply merely to prove an absent journal, and never turn that transient lock ownership into
    // StartupRecoveryStatus's process-lifetime error latch.
    if crate::privilege::pending_macos_apply_install_root(state_dir)?.is_none() {
        return Ok(());
    }
    let _operation_guard =
        match crate::operation_lock::wait_begin_bundle_operation(state_dir, timeout) {
            Ok(guard) => guard,
            Err(error) if error == crate::operation_lock::BUSY_ERROR => return Ok(()),
            Err(error) => return Err(error),
        };
    // The owning process may have committed, rolled back, and atomically retired the journal while
    // this process waited. Re-read under the acquired single-flight lock rather than recovering a
    // stale root captured before the wait.
    let Some(pending_root) = crate::privilege::pending_macos_apply_install_root(state_dir)? else {
        return Ok(());
    };

    if let Ok(report) = crate::state::read_state_with_recovery(state_dir) {
        let selected = report.document.state.app_path;
        if !selected.is_empty() {
            let selected = crate::install::InstallLayout::from_verified_selection(Path::new(
                &selected,
            ))
            .map_err(|error| {
                format!(
                    "Pending macOS recovery is bound to {}, but durable state points to an invalid installation: {error}",
                    pending_root.display()
                )
            })?;
            if selected.root != pending_root {
                return Err(format!(
                    "Pending macOS recovery belongs to {}, but durable state points to {}.",
                    pending_root.display(),
                    selected.root.display()
                ));
            }
        }
    }

    // The interrupted bundle may contain a partially rewritten Mach-O or plist. Recovery is
    // structurally validated and path-bound by the journal first; strict installation identity is a
    // postcondition, not a prerequisite that can strand the only usable preimages.
    crate::privilege::recover_macos_apply_transaction(state_dir, &pending_root, runner)?;
    if crate::privilege::pending_macos_apply_install_root(state_dir)?.is_some() {
        return Err("Pending macOS apply journal still exists after startup recovery.".to_string());
    }
    let verified = crate::detect::resolve_verified_install(&pending_root)
        .map_err(|error| format!("Recovered macOS installation identity failed: {error}"))?;
    if verified.root != pending_root {
        return Err(
            "Recovered macOS installation resolved to a different canonical root.".to_string(),
        );
    }
    Ok(())
}

#[cfg(all(test, target_os = "macos"))]
mod tests {
    use super::*;
    use crate::{patch::CopyPair, privilege::RecordingRunner, state::State};
    use std::{fs, path::Path};

    fn write(path: &Path, bytes: impl AsRef<[u8]>) {
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::write(path, bytes).unwrap();
    }

    fn macho_arm64() -> Vec<u8> {
        let mut bytes = vec![0_u8; 32];
        bytes[0..4].copy_from_slice(&0xfeedfacf_u32.to_le_bytes());
        bytes[4..8].copy_from_slice(&0x0100_000c_u32.to_le_bytes());
        bytes
    }

    #[test]
    fn app_startup_recovers_a_pending_bundle_and_state_transaction() {
        let temp = tempfile::tempdir().unwrap();
        let root = fs::canonicalize(temp.path()).unwrap();
        let app = root.join("Cavalry.app");
        let state_dir = root.join("state");
        write(
            &app.join("Contents/Info.plist"),
            br#"<plist><dict>
<key>CFBundleExecutable</key><string>Cavalry</string>
<key>CFBundleIdentifier</key><string>com.scenegroup.cavalry</string>
<key>CFBundleShortVersionString</key><string>2.7.2</string>
<key>CFBundleVersion</key><string>2.7.2</string>
</dict></plist>"#,
        );
        write(&app.join("Contents/MacOS/Cavalry"), macho_arm64());
        write(
            &app.join("Contents/Frameworks/libExtensionLayer.dylib"),
            macho_arm64(),
        );
        for (_, asset_relative) in crate::patch::CORE_MAP {
            write(
                &app.join("Contents/assets").join(asset_relative),
                b"official",
            );
        }
        let destination = app.join("Contents/assets/Definitions/appStrings.json");
        let source = root.join("translated.json");
        write(&destination, b"official");
        write(&source, b"translated");
        crate::state::write_state_with_operation(
            &state_dir,
            &State {
                app_path: app.to_string_lossy().to_string(),
                current_lang: "en".to_string(),
                ..State::default()
            },
            "before-crash",
        )
        .unwrap();

        let transaction = crate::privilege::MacApplyTransaction::begin(
            &state_dir,
            &app,
            &[CopyPair {
                src: source,
                dst: destination.clone(),
            }],
        )
        .unwrap();
        assert_eq!(fs::read(&destination).unwrap(), b"translated");
        std::mem::forget(transaction);

        recover_at_startup(&state_dir, &mut RecordingRunner::default()).unwrap();

        assert_eq!(fs::read(destination).unwrap(), b"official");
        assert!(
            crate::privilege::pending_macos_apply_install_root(&state_dir)
                .unwrap()
                .is_none()
        );
        assert_eq!(
            crate::state::read_state_strict(&state_dir)
                .unwrap()
                .current_lang,
            "en"
        );
    }

    #[test]
    fn no_pending_journal_never_waits_on_another_bundle_operation_or_latches_busy() {
        let temp = tempfile::tempdir().unwrap();
        let state_dir = temp.path().join("state");
        let _owner =
            crate::operation_lock::wait_begin_bundle_operation(&state_dir, Duration::from_secs(2))
                .unwrap();
        let status = StartupRecoveryStatus::default();

        status.record(recover_at_startup_with_timeout(
            &state_dir,
            &mut RecordingRunner::default(),
            Duration::from_millis(1),
        ));

        assert_eq!(status.error(), None);
    }

    #[test]
    fn pending_journal_with_transient_busy_lock_is_not_a_process_lifetime_error() {
        let temp = tempfile::tempdir().unwrap();
        let root = fs::canonicalize(temp.path()).unwrap();
        let app = root.join("Cavalry.app");
        let state_dir = root.join("state");
        let executable = app.join("Contents/MacOS/Cavalry");
        let destination = app.join("Contents/assets/Definitions/appStrings.json");
        let source = root.join("translated.json");
        write(&executable, macho_arm64());
        write(&destination, b"official");
        write(&source, b"translated");
        let transaction = crate::privilege::MacApplyTransaction::begin(
            &state_dir,
            &app,
            &[CopyPair {
                src: source,
                dst: destination.clone(),
            }],
        )
        .unwrap();
        std::mem::forget(transaction);
        let owner =
            crate::operation_lock::wait_begin_bundle_operation(&state_dir, Duration::from_secs(2))
                .unwrap();
        let status = StartupRecoveryStatus::default();

        status.record(recover_at_startup_with_timeout(
            &state_dir,
            &mut RecordingRunner::default(),
            Duration::from_millis(1),
        ));

        assert_eq!(status.error(), None);
        assert!(
            crate::privilege::pending_macos_apply_install_root(&state_dir)
                .unwrap()
                .is_some()
        );
        assert_eq!(fs::read(&destination).unwrap(), b"translated");

        drop(owner);
        crate::privilege::recover_macos_apply_transaction(
            &state_dir,
            &app,
            &mut RecordingRunner::default(),
        )
        .unwrap();
        assert!(
            crate::privilege::pending_macos_apply_install_root(&state_dir)
                .unwrap()
                .is_none()
        );
        assert_eq!(fs::read(destination).unwrap(), b"official");
    }
}
