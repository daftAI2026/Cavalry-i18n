/**
 * [INPUT]: 依赖本机 /Applications/Cavalry.app、副本工作目录与真实 commands/apply/restart 流程
 * [OUTPUT]: 对外提供手动触发的真实 macOS 冒烟测试，覆盖三语 apply/restart 与 English 恢复
 * [POS]: src-tauri/tests 的 Phase 7 守门，只在显式运行 ignored tests 时触发真实 GUI 与 codesign 副作用
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
use cavalry_i18n_tauri::{
    commands::{apply_language_inner, extract_english_inner, restart_cavalry_inner},
    detect::read_installed_language,
    privilege::RealCommandRunner,
};
use std::{
    path::{Path, PathBuf},
    process::Command,
    thread,
    time::Duration,
};

fn repo_root() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .unwrap()
        .to_path_buf()
}

fn clone_app_bundle(source: &Path, dest: &Path) {
    let status = Command::new("ditto").arg(source).arg(dest).status().unwrap();
    assert!(status.success(), "failed to clone {:?} to {:?}", source, dest);
}

fn quit_cavalry() {
    let _ = Command::new("osascript")
        .args(["-e", "tell application \"Cavalry\" to quit"])
        .status();
}

fn wait_for_cavalry_launch(timeout: Duration) -> bool {
    let deadline = std::time::Instant::now() + timeout;
    while std::time::Instant::now() < deadline {
        if Command::new("pgrep")
            .args(["-x", "Cavalry"])
            .status()
            .map(|status| status.success())
            .unwrap_or(false)
        {
            return true;
        }
        thread::sleep(Duration::from_millis(500));
    }
    false
}

#[cfg(target_os = "macos")]
#[test]
#[ignore = "requires a local Cavalry.app install and opens the app"]
fn real_macos_apply_restart_and_restore_english() {
    let source = Path::new("/Applications/Cavalry.app");
    assert!(source.exists(), "missing /Applications/Cavalry.app");

    let temp = tempfile::tempdir().unwrap();
    let app = temp.path().join("Cavalry.app");
    let state_dir = temp.path().join("state");
    let repo = repo_root();
    let now = "2026-04-24T00:00:00.000Z";

    quit_cavalry();
    clone_app_bundle(source, &app);
    extract_english_inner(&app, &state_dir).unwrap();

    for lang in ["zh-Hans", "zh-Hant", "ja_JP"] {
        let mut runner = RealCommandRunner;
        let result =
            apply_language_inner(&repo, &state_dir, &repo, &app, lang, &mut runner, now).unwrap();
        assert!(result.ok, "apply_language failed for {lang}");
        assert_eq!(read_installed_language(&app, "en"), lang);

        let mut runner = RealCommandRunner;
        restart_cavalry_inner(&state_dir, &app, &mut runner).unwrap();
        assert!(
            wait_for_cavalry_launch(Duration::from_secs(8)),
            "Cavalry did not launch after restart for {lang}"
        );
        quit_cavalry();
        thread::sleep(Duration::from_secs(1));
    }

    let mut runner = RealCommandRunner;
    let result = apply_language_inner(&repo, &state_dir, &repo, &app, "en", &mut runner, now)
        .unwrap();
    assert!(result.ok, "restore English failed");
    assert_eq!(read_installed_language(&app, "zh-Hans"), "en");

    let mut runner = RealCommandRunner;
    restart_cavalry_inner(&state_dir, &app, &mut runner).unwrap();
    assert!(
        wait_for_cavalry_launch(Duration::from_secs(8)),
        "Cavalry did not launch after restoring English"
    );
    quit_cavalry();
}
