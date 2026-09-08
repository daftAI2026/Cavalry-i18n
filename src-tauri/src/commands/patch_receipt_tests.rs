/**
 * [INPUT]: 依赖 patch_receipt 的 generation API、临时目录与 macOS fixture。
 * [OUTPUT]: 验证 English 无 receipt、receipt 形状拒绝，以及 macOS 内容寻址 generation 的复用边界。
 * [POS]: patch_receipt 的隔离合同；只证明 immutable source 发布/加载，不替代 apply/status 事务测试。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
use super::{desired_generation, load_source, prepare};
use crate::state::AppliedPatchReceipt;
use std::{fs, path::Path};

#[test]
fn english_has_no_generation_and_does_not_touch_state() {
    let temp = tempfile::tempdir().unwrap();
    assert_eq!(
        prepare(
            temp.path(),
            &temp.path().join("state"),
            temp.path(),
            &temp.path().join("Cavalry.app"),
            "revision",
            "en",
        )
        .unwrap(),
        None
    );
    assert!(!temp.path().join("state").exists());
}

#[test]
fn malformed_receipt_is_rejected_before_path_access() {
    let temp = tempfile::tempdir().unwrap();
    let receipt = AppliedPatchReceipt {
        install_root: "/not-used".to_string(),
        cavalry_revision: "revision".to_string(),
        language: "zh-Hans".to_string(),
        generation: "../escape".to_string(),
    };
    let error = load_source(
        &temp.path().join("state"),
        &receipt,
        &temp.path().join("Cavalry.app"),
        "revision",
        "zh-Hans",
    )
    .unwrap_err();
    assert!(error.contains("64-character lowercase SHA-256"), "{error}");
}

#[cfg(any(target_os = "macos", target_os = "windows"))]
#[test]
fn missing_generation_is_read_only() {
    let temp = tempfile::tempdir().unwrap();
    let app = temp.path().join("Cavalry.app");
    let state = temp.path().join("state");
    fs::create_dir_all(&app).unwrap();
    let receipt = AppliedPatchReceipt {
        install_root: fs::canonicalize(&app)
            .unwrap()
            .to_string_lossy()
            .into_owned(),
        cavalry_revision: "revision".to_string(),
        language: "zh-Hans".to_string(),
        generation: "a".repeat(64),
    };
    assert!(load_source(&state, &receipt, &app, "revision", "zh-Hans").is_err());
    assert!(
        !state.exists(),
        "status/load must not create state directories"
    );
}

#[cfg(all(unix, any(target_os = "macos", target_os = "windows")))]
#[test]
fn symlinked_generation_parent_is_rejected() {
    use std::os::unix::fs::symlink;

    let temp = tempfile::tempdir().unwrap();
    let app = temp.path().join("Cavalry.app");
    let state = temp.path().join("state");
    let outside = temp.path().join("outside");
    fs::create_dir_all(&app).unwrap();
    fs::create_dir_all(&state).unwrap();
    fs::create_dir_all(&outside).unwrap();
    symlink(&outside, state.join("patch-generations")).unwrap();
    let receipt = AppliedPatchReceipt {
        install_root: fs::canonicalize(&app)
            .unwrap()
            .to_string_lossy()
            .into_owned(),
        cavalry_revision: "revision".to_string(),
        language: "zh-Hans".to_string(),
        generation: "a".repeat(64),
    };
    assert!(load_source(&state, &receipt, &app, "revision", "zh-Hans").is_err());
    assert!(fs::read_dir(&outside).unwrap().next().is_none());
}

#[cfg(target_os = "macos")]
#[test]
fn mac_generation_round_trip_is_content_addressed_and_reusable_after_upgrade() {
    let temp = tempfile::tempdir().unwrap();
    let repo = temp.path().join("repo");
    let state = temp.path().join("state");
    let app = temp.path().join("Cavalry.app");
    fs::create_dir_all(repo.join("languages/zh-Hans")).unwrap();
    fs::create_dir_all(repo.join("injector")).unwrap();
    fs::write(
        repo.join("languages/zh-Hans/app.json"),
        b"{\"hello\":\"\xE4\xBD\xA0\xE5\xA5\xBD\"}",
    )
    .unwrap();
    let injector = repo.join("injector/libCavalryTranslatorInjector.dylib");
    fs::write(&injector, b"injector-v1").unwrap();
    use std::os::unix::fs::PermissionsExt;
    fs::set_permissions(&injector, fs::Permissions::from_mode(0o755)).unwrap();
    fs::create_dir_all(&app).unwrap();

    let receipt = prepare(&repo, &state, &repo, &app, "revision-1", "zh-Hans")
        .unwrap()
        .unwrap();
    assert_eq!(
        desired_generation(&repo, &repo, &app, "zh-Hans").unwrap(),
        receipt.generation
    );
    let source = load_source(&state, &receipt, &app, "revision-1", "zh-Hans").unwrap();
    let original_payload = fs::read(source.join("languages/zh-Hans/app.json")).unwrap();
    assert_eq!(
        &original_payload,
        b"{\"hello\":\"\xE4\xBD\xA0\xE5\xA5\xBD\"}"
    );
    fs::write(source.join("languages/zh-Hans/app.json"), b"tampered").unwrap();
    assert!(load_source(&state, &receipt, &app, "revision-1", "zh-Hans").is_err());
    fs::write(source.join("languages/zh-Hans/app.json"), &original_payload).unwrap();
    fs::write(source.join("extra.txt"), b"unmanifested").unwrap();
    assert!(load_source(&state, &receipt, &app, "revision-1", "zh-Hans").is_err());
    fs::remove_file(source.join("extra.txt")).unwrap();

    // 当前包 source 改变会改变 desired 身份，但旧回执仍解析不可变 source，不读取新包版本。
    fs::write(repo.join("languages/zh-Hans/app.json"), b"new-source").unwrap();
    assert_ne!(
        desired_generation(&repo, &repo, &app, "zh-Hans").unwrap(),
        receipt.generation
    );
    assert!(load_source(&state, &receipt, &app, "revision-1", "zh-Hans").is_ok());

    let second = prepare(&repo, &state, &repo, &app, "revision-1", "zh-Hans")
        .unwrap()
        .unwrap();
    assert_ne!(second.generation, receipt.generation);
    assert!(Path::new(&second.install_root).is_dir());
}
