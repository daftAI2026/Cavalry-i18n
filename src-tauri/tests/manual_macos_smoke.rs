/**
 * [INPUT]: 依赖显式 CAVALRY_I18N_MACOS_SMOKE_APP 或默认 /Applications/Cavalry.app、repo injector/四语资源与真实 commands/codesign/runtime capture
 * [OUTPUT]: 对外提供显式触发的 macOS 冒烟测试：只写副本执行三语 apply/重复 apply/English 恢复，源 Cavalry 仅外加载当前 injector，并逐一校验菜单哨兵、日志/session inventory provenance 与证据哈希
 * [POS]: src-tauri/tests 的 Phase 7 现场守门，优先消费只读挂载的官方 2.7.2 输入并把 bundle 写入隔离在 APFS 临时副本，同时证明真实 vendor 进程可加载 injector 且菜单完成三语翻译
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
use cavalry_i18n_tauri::{
    commands::apply_language_inner, detect::read_installed_language, privilege::RealCommandRunner,
};
use serde_json::Value;
use std::{
    env,
    fs::{self, File},
    path::{Path, PathBuf},
    process::{Child, Command, Stdio},
    thread,
    time::{Duration, Instant},
};

const SOURCE_APP_ENV: &str = "CAVALRY_I18N_MACOS_SMOKE_APP";

fn source_app() -> PathBuf {
    let requested = env::var_os(SOURCE_APP_ENV)
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from("/Applications/Cavalry.app"));
    assert!(
        requested.is_absolute(),
        "{SOURCE_APP_ENV} must be an absolute Cavalry.app path"
    );
    assert_eq!(
        requested.file_name().and_then(|name| name.to_str()),
        Some("Cavalry.app"),
        "{SOURCE_APP_ENV} must name Cavalry.app"
    );
    fs::canonicalize(&requested).unwrap_or_else(|error| {
        panic!(
            "could not resolve macOS smoke source {}: {error}",
            requested.display()
        )
    })
}

fn repo_root() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .unwrap()
        .to_path_buf()
}

fn clone_path(source: &Path, destination: &Path) {
    let _ = fs::remove_dir_all(destination);
    let status = Command::new("cp")
        .args(["-cR"])
        .arg(source)
        .arg(destination)
        .status()
        .unwrap();
    assert!(
        status.success(),
        "failed to APFS-clone {} to {}",
        source.display(),
        destination.display()
    );
}

fn cavalry_is_running() -> bool {
    Command::new("pgrep")
        .args(["-x", "Cavalry"])
        .status()
        .map(|status| status.success())
        .unwrap_or(false)
}

fn verify_bundle_signature(app: &Path) {
    let output = Command::new("codesign")
        .args(["--verify", "--deep", "--strict", "--verbose=4"])
        .arg(app)
        .output()
        .unwrap();
    assert!(
        output.status.success(),
        "bundle signature verification failed:\n{}",
        String::from_utf8_lossy(&output.stderr)
    );
}

fn file_sha256(path: &Path) -> String {
    let output = Command::new("shasum")
        .args(["-a", "256"])
        .arg(path)
        .output()
        .unwrap();
    assert!(
        output.status.success(),
        "could not hash {}: {}",
        path.display(),
        String::from_utf8_lossy(&output.stderr)
    );
    String::from_utf8_lossy(&output.stdout)
        .split_whitespace()
        .next()
        .unwrap_or_default()
        .to_string()
}

fn critical_source_snapshot(app: &Path) -> Vec<(PathBuf, Option<Vec<u8>>)> {
    [
        "Contents/Info.plist",
        "Contents/MacOS/Cavalry",
        "Contents/MacOS/CavalryLauncher",
        "Contents/Frameworks/libCavalryTranslatorInjector.dylib",
        "Contents/Frameworks/libExtensionLayer.dylib",
        "Contents/Resources/cavalry-i18n-lang.txt",
    ]
    .into_iter()
    .map(|relative| {
        let path = app.join(relative);
        let bytes = fs::read(&path).ok();
        (path, bytes)
    })
    .collect()
}

fn wait_for_live_capture(
    child: &mut Child,
    inventory_path: &Path,
    log_path: &Path,
    lang: &str,
    expected: &[&str],
) -> Result<(Value, String), String> {
    let deadline = Instant::now() + Duration::from_secs(30);
    while Instant::now() < deadline {
        if let Some(status) = child.try_wait().map_err(|error| error.to_string())? {
            let log = fs::read_to_string(log_path).unwrap_or_default();
            return Err(format!(
                "Cavalry exited before live capture for {lang}: {status}\n{log}"
            ));
        }

        let log = fs::read_to_string(log_path).unwrap_or_default();
        if log.contains(&format!("embedded translator installed lang={lang}"))
            && inventory_path.exists()
        {
            let inventory: Value = serde_json::from_slice(
                &fs::read(inventory_path).map_err(|error| error.to_string())?,
            )
            .map_err(|error| error.to_string())?;
            let serialized =
                serde_json::to_string(&inventory).map_err(|error| error.to_string())?;
            if expected.iter().all(|needle| serialized.contains(needle)) {
                return Ok((inventory, log));
            }
        }
        thread::sleep(Duration::from_millis(250));
    }

    Err(format!(
        "timed out waiting for real injector capture for {lang}\n{}",
        fs::read_to_string(log_path).unwrap_or_default()
    ))
}

fn run_real_injector_capture(source_app: &Path, injector: &Path, root: &Path, lang: &str) {
    let expected: &[&str] = match lang {
        "zh-Hans" => &["文件", "编辑", "合成"],
        "zh-Hant" => &["檔案", "編輯", "合成"],
        "ja_JP" => &["ファイル", "編集", "コンポジション"],
        _ => panic!("unsupported live smoke language: {lang}"),
    };
    let session_dir = root.join(lang);
    let runtime_dir = session_dir.join("runtime");
    let audit_dir = session_dir.join("audit");
    fs::create_dir_all(&runtime_dir).unwrap();
    fs::create_dir_all(&audit_dir).unwrap();
    let inventory_path = runtime_dir.join(format!("{lang}-injector-inventory.json"));
    let log_path = audit_dir.join(format!("{lang}-injector.log"));
    let log_file = File::create(&log_path).unwrap();

    let mut child = Command::new(source_app.join("Contents/MacOS/Cavalry"))
        .env("DYLD_INSERT_LIBRARIES", injector)
        .env("CAVALRY_I18N_LANG", lang)
        .env("CAVALRY_I18N_CACHE_ROOT", root)
        .env("CAVALRY_I18N_SESSION_DIR", &session_dir)
        .env("CAVALRY_I18N_SESSION_UUID", format!("REAL-{lang}"))
        .stdout(Stdio::from(log_file.try_clone().unwrap()))
        .stderr(Stdio::from(log_file))
        .spawn()
        .unwrap();

    let capture = wait_for_live_capture(&mut child, &inventory_path, &log_path, lang, expected);
    if capture.is_err() {
        let _ = child.kill();
        let _ = child.wait();
    }
    let (inventory, log) = capture.unwrap();
    assert_eq!(inventory["formatVersion"], 3);
    assert_eq!(inventory["language"], lang);
    assert_eq!(inventory["source"], "live-injector");
    assert_eq!(
        inventory["capture"]["pid"].as_u64(),
        Some(child.id() as u64)
    );
    assert_eq!(
        inventory["capture"]["sessionUuid"].as_str(),
        Some(format!("REAL-{lang}").as_str())
    );
    assert!(inventory["capture"]["bundleHash"]
        .as_str()
        .is_some_and(|hash| !hash.is_empty()));
    let visible_count = inventory["menuBars"].as_array().map_or(0, Vec::len)
        + inventory["widgetTexts"].as_array().map_or(0, Vec::len);
    assert!(
        visible_count > 0,
        "live injector inventory was empty for {lang}"
    );
    assert!(
        !log.contains("implemented in both"),
        "duplicate Qt runtime loaded:\n{log}"
    );
    assert!(
        !log.contains("mysterious crashes"),
        "duplicate Qt runtime loaded:\n{log}"
    );
    thread::sleep(Duration::from_secs(2));
    assert!(
        child.try_wait().unwrap().is_none(),
        "Cavalry did not remain alive after capture for {lang}"
    );
    child.kill().unwrap();
    let _ = child.wait();
    println!(
        "live capture {lang}: pid={} session={} bundleHash={} inventorySha256={} logSha256={} sentinels={}",
        inventory["capture"]["pid"].as_u64().unwrap_or_default(),
        inventory["capture"]["sessionUuid"]
            .as_str()
            .unwrap_or_default(),
        inventory["capture"]["bundleHash"]
            .as_str()
            .unwrap_or_default(),
        file_sha256(&inventory_path),
        file_sha256(&log_path),
        expected.join("|")
    );
}

#[cfg(target_os = "macos")]
#[test]
#[ignore = "requires an explicit official Cavalry.app source and opens the real binary with the candidate injector"]
fn real_macos_clone_apply_and_live_injector_matrix() {
    let source = source_app();
    assert!(
        !cavalry_is_running(),
        "close every Cavalry process before running the isolated live smoke"
    );
    let source_before = critical_source_snapshot(&source);

    let temp = tempfile::tempdir().unwrap();
    let app = temp.path().join("Cavalry.app");
    let state_dir = temp.path().join("state");
    let live_dir = temp.path().join("live");
    let repo = repo_root();
    let injector = repo.join("injector/libCavalryTranslatorInjector.dylib");
    let now = "2026-07-13T00:00:00.000Z";

    clone_path(&source, &app);

    for lang in ["zh-Hans", "zh-Hant", "ja_JP"] {
        let started = Instant::now();
        let mut runner = RealCommandRunner;
        let result =
            apply_language_inner(&repo, &state_dir, &repo, &app, lang, &mut runner, now).unwrap();
        println!("apply {lang}: {:?}", started.elapsed());
        assert!(result.ok, "apply_language failed for {lang}");
        assert_eq!(read_installed_language(&app, "en"), lang);
        assert_eq!(
            fs::read(app.join("Contents/Frameworks/libCavalryTranslatorInjector.dylib")).unwrap(),
            fs::read(&injector).unwrap(),
            "candidate injector was not installed byte-for-byte for {lang}"
        );
        verify_bundle_signature(&app);

        if lang == "zh-Hans" {
            let repeated_started = Instant::now();
            let mut runner = RealCommandRunner;
            let repeated =
                apply_language_inner(&repo, &state_dir, &repo, &app, lang, &mut runner, now)
                    .unwrap();
            println!("repeat apply {lang}: {:?}", repeated_started.elapsed());
            assert!(repeated.ok);
            verify_bundle_signature(&app);
        }
    }

    for lang in ["zh-Hans", "zh-Hant", "ja_JP"] {
        run_real_injector_capture(&source, &injector, &live_dir, lang);
    }

    let mut runner = RealCommandRunner;
    let result =
        apply_language_inner(&repo, &state_dir, &repo, &app, "en", &mut runner, now).unwrap();
    assert!(result.ok, "restore English failed");
    assert_eq!(read_installed_language(&app, "zh-Hans"), "en");
    verify_bundle_signature(&app);

    assert_eq!(
        critical_source_snapshot(&source),
        source_before,
        "live smoke modified its source Cavalry.app"
    );
}
