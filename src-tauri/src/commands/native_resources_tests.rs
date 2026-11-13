/**
 * [INPUT]: 依赖 native_resources 的模式化manifest/payload准入与临时文件夹。
 * [OUTPUT]: 覆盖共享preview/production/2.8.1候选资源准入；夹具数量与版本绑定当前编译目标。
 * [POS]: native_resources 的隔离合同；测试显式选择编译profile，不绕过资源摘要校验。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
use super::*;
#[cfg(unix)]
use std::os::unix::fs::symlink;

const PREVIEW_BUILD_MODE: &str = "debug-preview";

fn fixture_native_keys() -> usize {
    target().unwrap().native_keys + 375
}

fn load_preview_at(root: &Path, compiled: &[u8]) -> Result<NativeResources, String> {
    load_at_for_mode(root, compiled, PREVIEW_BUILD_MODE)
}

fn load_production_at(root: &Path, compiled: &[u8]) -> Result<NativeResources, String> {
    load_at_for_mode(root, compiled, "production-2.8")
}
#[test]
fn runtime_without_compile_time_approval_never_loads() {
    let root = tempfile::tempdir().unwrap();
    assert!(load_at_for_mode(root.path(), &[], "disabled").is_err());
}
#[test]
fn compile_mode_selects_manifest_kind_and_production_requires_complete_resources() {
    assert_eq!(resource_profile("disabled"), None);
    assert_eq!(
        resource_profile("debug-preview"),
        Some(("development-preview", false))
    );
    assert_eq!(
        resource_profile("release-candidate"),
        Some(("development-preview", false))
    );
    assert_eq!(
        resource_profile("production-2.8"),
        Some(("production-2.8", true))
    );
    assert_eq!(
        resource_profile("development-2.8.1"),
        Some(("development-preview", true))
    );
    assert!(!manifest_profile_matches(
        "development-2.8.1",
        "development-preview",
        false
    ));
    assert!(manifest_profile_matches(
        "production-2.8",
        "production-2.8",
        true
    ));
    assert!(!manifest_profile_matches(
        "production-2.8",
        "production-2.8",
        false
    ));
    assert!(!manifest_profile_matches(
        "production-2.8",
        "development-preview",
        true
    ));
    assert!(manifest_profile_matches(
        "debug-preview",
        "development-preview",
        false
    ));
    assert!(manifest_profile_matches(
        "release-candidate",
        "development-preview",
        false
    ));
    assert!(!manifest_profile_matches(
        "disabled",
        "production-2.8",
        true
    ));
}
#[test]
fn runtime_manifest_cannot_approve_itself_or_change_language_paths() {
    let root = tempfile::tempdir().unwrap();
    fs::write(root.path().join("manifest.json"), b"{}").unwrap();
    assert!(
        load_preview_at(&root.path().canonicalize().unwrap(), b"different")
            .unwrap_err()
            .contains("compiled approval")
    );
    assert!(load_preview_at(root.path(), b"{}").is_err());
}
#[test]
fn display_pack_rejects_metadata_wrong_locale_and_foreign_fields() {
    let valid =
        br#"[{"type":"strings","language":"ja","value":{"key":{"UI-text":"\u5b8c\u4e86"}}}]"#;
    assert!(validate_pack(valid, "ja", 1).is_ok());
    assert!(validate_pack(valid, "zh-Hans", 1).is_err());
    assert!(validate_pack(valid, "ja", 2).is_err());
    let foreign =
        br#"[{"type":"strings","language":"ja","value":{"key":{"UI-text":"ok","id":"model"}}}]"#;
    assert!(validate_pack(foreign, "ja", 1).is_err());
}
#[test]
#[cfg(unix)]
fn manifest_and_payload_symlinks_are_not_native_resources() {
    let root = tempfile::tempdir().unwrap();
    fs::write(root.path().join("real.json"), b"{}").unwrap();
    symlink(
        root.path().join("real.json"),
        root.path().join("manifest.json"),
    )
    .unwrap();
    assert!(load_preview_at(root.path(), b"{}").is_err());
}
fn approved_fixture_for(kind: &str, complete: bool) -> (tempfile::TempDir, Vec<u8>) {
    use serde_json::json;
    let temp = tempfile::tempdir().unwrap();
    let root = temp.path().canonicalize().unwrap();
    let total = fixture_native_keys();
    let mut manifest = json!({"schemaVersion":1,"kind":kind,"cavalryVersion":NATIVE_VERSION,
            "targetSha256":hash(TARGET_BYTES),"inputSha256":"a".repeat(64),"approvedUIKeys":1,
            "nativeKeys":total,"supplementalKeys":375,"complete":complete,"packs":{}});
    for language in LANGUAGES {
        let vendor = if language == "ja_JP" { 390 } else { 0 };
        let values = (0..1 + vendor)
            .map(|i| (format!("fixture.{i}"), json!({"UI-text":"fixture"})))
            .collect::<serde_json::Map<_, _>>();
        let locale = super::super::user_language::native_locale_for(language).unwrap();
        let bytes =
            serde_json::to_vec(&json!([{"type":"strings","language":locale,"value":values}]))
                .unwrap();
        fs::write(root.join(format!("{language}.json")), &bytes).unwrap();
        manifest["packs"][language] = json!({"file":format!("{language}.json"),"nativeLocale":locale,
                "sha256":hash(&bytes),"bytes":bytes.len(),"reviewed":1,
                "preserved":if complete { total-1-vendor } else { 0 },"vendor":vendor,
                "missing":if complete { 0 } else { total-1-vendor }});
    }
    let bytes = serde_json::to_vec(&manifest).unwrap();
    fs::write(root.join("manifest.json"), &bytes).unwrap();
    (temp, bytes)
}
fn approved_fixture() -> (tempfile::TempDir, Vec<u8>) {
    approved_fixture_for("development-preview", false)
}
#[test]
fn approved_three_language_payloads_load_and_any_payload_change_fails_closed() {
    let (temp, compiled) = approved_fixture();
    let root = temp.path().canonicalize().unwrap();
    assert_eq!(load_preview_at(&root, &compiled).unwrap().packs.len(), 3);
    fs::write(root.join("zh-Hans.json"), b"changed").unwrap();
    assert!(load_preview_at(&root, &compiled)
        .unwrap_err()
        .contains("digest"));
}
#[test]
fn production_manifest_requires_production_kind_and_complete_payloads() {
    let (temp, compiled) = approved_fixture_for("production-2.8", true);
    let root = temp.path().canonicalize().unwrap();
    assert_eq!(load_production_at(&root, &compiled).unwrap().packs.len(), 3);

    let (temp, wrong_kind) = approved_fixture_for("development-preview", true);
    assert!(load_production_at(&temp.path().canonicalize().unwrap(), &wrong_kind).is_err());

    let (temp, incomplete) = approved_fixture_for("production-2.8", false);
    assert!(load_production_at(&temp.path().canonicalize().unwrap(), &incomplete).is_err());
}
#[test]
fn status_readiness_does_not_hash_an_unselected_same_size_payload() {
    let (temp, compiled) = approved_fixture();
    let root = temp.path().canonicalize().unwrap();
    let path = root.join("zh-Hans.json");
    let mut bytes = fs::read(&path).unwrap();
    bytes[0] = if bytes[0] == b' ' { b'!' } else { b' ' };
    fs::write(path, bytes).unwrap();
    let status = load_status_at(&root, &compiled, PREVIEW_BUILD_MODE).unwrap();
    let approved: serde_json::Value = serde_json::from_slice(&compiled).unwrap();
    assert_eq!(
        status.packs["zh-Hans"],
        approved["packs"]["zh-Hans"]["sha256"].as_str().unwrap()
    );
}
#[test]
fn status_metadata_requires_three_regular_files_with_approved_sizes() {
    #[cfg(unix)]
    let failures = &["missing", "wrong-size", "symlink"][..];
    #[cfg(windows)]
    let failures = &["missing", "wrong-size"][..];
    for &failure in failures {
        let (temp, compiled) = approved_fixture();
        let root = temp.path().canonicalize().unwrap();
        let path = root.join("zh-Hans.json");
        match failure {
            "missing" => fs::remove_file(&path).unwrap(),
            "wrong-size" => {
                let mut bytes = fs::read(&path).unwrap();
                bytes.push(b' ');
                fs::write(&path, bytes).unwrap();
            }
            "symlink" => {
                fs::remove_file(&path).unwrap();
                #[cfg(unix)]
                symlink(root.join("ja_JP.json"), &path).unwrap();
                #[cfg(windows)]
                unreachable!("Windows reparse coverage uses a privilege-free directory junction");
            }
            _ => unreachable!(),
        }
        assert!(
            load_status_at(&root, &compiled, PREVIEW_BUILD_MODE).is_err(),
            "status metadata must reject {failure} packs"
        );
    }
}

#[test]
#[cfg(windows)]
fn windows_parent_junction_cannot_supply_approved_resources() {
    let (actual, compiled) = approved_fixture();
    let alias = tempfile::tempdir().unwrap();
    let junction = alias.path().join("linked-packs");
    let output = std::process::Command::new("cmd.exe")
        .args(["/d", "/c", "mklink", "/J"])
        .arg(&junction)
        .arg(actual.path())
        .output()
        .unwrap();
    assert!(output.status.success(), "junction fixture creation failed");
    assert!(load_preview_at(&junction, &compiled).is_err());
    assert!(load_status_at(&junction, &compiled, PREVIEW_BUILD_MODE).is_err());
}
#[test]
fn selected_language_load_does_not_require_an_unselected_pack() {
    let (temp, compiled) = approved_fixture();
    let root = temp.path().canonicalize().unwrap();
    fs::remove_file(root.join("zh-Hans.json")).unwrap();
    let selected = load_language_at(&root, &compiled, "ja_JP", PREVIEW_BUILD_MODE).unwrap();
    let approved: serde_json::Value = serde_json::from_slice(&compiled).unwrap();
    assert_eq!(
        hash(&selected),
        approved["packs"]["ja_JP"]["sha256"].as_str().unwrap()
    );
}
#[test]
fn selected_language_load_rejects_its_own_digest_drift() {
    let (temp, compiled) = approved_fixture();
    let root = temp.path().canonicalize().unwrap();
    let path = root.join("ja_JP.json");
    let mut bytes = fs::read(&path).unwrap();
    bytes[0] = if bytes[0] == b' ' { b'!' } else { b' ' };
    fs::write(path, bytes).unwrap();
    assert!(
        load_language_at(&root, &compiled, "ja_JP", PREVIEW_BUILD_MODE)
            .unwrap_err()
            .contains("digest")
    );
}
#[test]
fn rejected_selected_payload_never_reaches_profile_write() {
    let (resources, compiled) = approved_fixture();
    let resource_root = resources.path().canonicalize().unwrap();
    let path = resource_root.join("ja_JP.json");
    let mut bytes = fs::read(&path).unwrap();
    bytes[0] = if bytes[0] == b' ' { b'!' } else { b' ' };
    fs::write(path, bytes).unwrap();
    let selected = load_language_at(&resource_root, &compiled, "ja_JP", PREVIEW_BUILD_MODE).ok();

    let profile = tempfile::tempdir().unwrap();
    let root = profile.path().canonicalize().unwrap();
    let home = root.join("home");
    let state = root.join("state");
    fs::create_dir_all(home.join("Library/Preferences/Cavalry")).unwrap();
    fs::create_dir_all(&state).unwrap();
    let preferences = home.join("Library/Preferences/Cavalry/preferences.json");
    let before = br#"{"locale":{"varType":"string","value":"en-GB"}}"#;
    fs::write(&preferences, before).unwrap();
    let paths =
        super::super::user_language_files::UserLanguagePaths::for_user_dirs(&home, &state).unwrap();

    let action = super::super::native_user::apply_profile(
        &paths,
        "ja_JP",
        selected.as_deref(),
        &mut || Ok(()),
        &super::super::contract::NoopReporter,
    );
    assert_eq!(
        action.error_code.as_deref(),
        Some("nativeResourceUnavailable")
    );
    assert_eq!(fs::read(preferences).unwrap(), before);
    assert!(!paths.strings().exists());
    assert!(!paths.receipt().exists());
}
#[test]
fn one_pending_caption_keeps_an_honest_partial_pack_available() {
    let (temp, compiled) = approved_fixture();
    let root = temp.path().canonicalize().unwrap();
    let mut manifest: serde_json::Value = serde_json::from_slice(&compiled).unwrap();
    let total = fixture_native_keys();
    manifest["approvedUIKeys"] = serde_json::json!(total - 196);
    for language in LANGUAGES {
        let vendor = if language == "ja_JP" { 390 } else { 0 };
        let values = (0..total - 1)
            .map(|i| {
                (
                    format!("fixture.{i}"),
                    serde_json::json!({"UI-text":"caption"}),
                )
            })
            .collect::<serde_json::Map<_, _>>();
        let locale = super::super::user_language::native_locale_for(language).unwrap();
        let bytes = serde_json::to_vec(&serde_json::json!([
            {"type":"strings","language":locale,"value":values}
        ]))
        .unwrap();
        fs::write(root.join(format!("{language}.json")), &bytes).unwrap();
        let info = &mut manifest["packs"][language];
        info["sha256"] = serde_json::json!(hash(&bytes));
        info["bytes"] = serde_json::json!(bytes.len());
        info["reviewed"] = serde_json::json!(total - 196 - vendor);
        info["preserved"] = serde_json::json!(195);
        info["missing"] = serde_json::json!(1);
    }
    let partial = serde_json::to_vec(&manifest).unwrap();
    fs::write(root.join("manifest.json"), &partial).unwrap();
    assert_eq!(load_preview_at(&root, &partial).unwrap().packs.len(), 3);
    manifest["complete"] = serde_json::json!(true);
    let false_claim = serde_json::to_vec(&manifest).unwrap();
    fs::write(root.join("manifest.json"), &false_claim).unwrap();
    assert!(load_preview_at(&root, &false_claim)
        .unwrap_err()
        .contains("coverage"));
}
#[test]
fn schema_supplement_count_is_explicit_and_cannot_masquerade_as_official_catalog() {
    let (temp, compiled) = approved_fixture();
    let root = temp.path().canonicalize().unwrap();
    let mut manifest: serde_json::Value = serde_json::from_slice(&compiled).unwrap();
    // -- 补充仍缺译的合成包：只改变来源分账，不伪造已显示或已审批 -----
    manifest["supplementalKeys"] = serde_json::json!(375);
    manifest["nativeKeys"] = serde_json::json!(fixture_native_keys());
    let bytes = serde_json::to_vec(&manifest).unwrap();
    fs::write(root.join("manifest.json"), &bytes).unwrap();
    assert!(
        load_preview_at(&root, &bytes).is_ok(),
        "a source-bound supplement must have its own count"
    );
    for (field, value) in [
        ("supplementalKeys", 0),
        ("supplementalKeys", 9),
        ("supplementalKeys", 373),
        ("supplementalKeys", 374),
        ("nativeKeys", target().unwrap().native_keys),
        ("nativeKeys", fixture_native_keys() - 1),
    ] {
        let mut drift = manifest.clone();
        drift[field] = serde_json::json!(value);
        let bytes = serde_json::to_vec(&drift).unwrap();
        fs::write(root.join("manifest.json"), &bytes).unwrap();
        assert!(
            load_preview_at(&root, &bytes).is_err(),
            "source counts must not drift"
        );
    }
}
#[test]
fn complete_claim_and_target_approval_cannot_drift_even_with_matching_manifest_bytes() {
    for field in ["complete", "targetSha256", "inputSha256"] {
        let (temp, compiled) = approved_fixture();
        let root = temp.path().canonicalize().unwrap();
        let mut value: serde_json::Value = serde_json::from_slice(&compiled).unwrap();
        value[field] = if field == "complete" {
            serde_json::json!(true)
        } else {
            serde_json::json!("wrong")
        };
        let changed = serde_json::to_vec(&value).unwrap();
        fs::write(root.join("manifest.json"), &changed).unwrap();
        assert!(load_preview_at(&root, &changed).is_err());
    }
}
#[cfg(target_os = "macos")]
fn host_identity_fixture() -> (tempfile::TempDir, PathBuf, Target) {
    let temp = tempfile::tempdir().unwrap();
    let root = temp.path().canonicalize().unwrap();
    let mut lock = target().unwrap();
    fs::create_dir_all(root.join("Contents/MacOS")).unwrap();
    let info = format!(
        r#"<?xml version="1.0"?><plist version="1.0"><dict><key>CFBundleIdentifier</key><string>{}</string><key>CFBundleShortVersionString</key><string>{}</string><key>CFBundleExecutable</key><string>Cavalry</string></dict></plist>"#,
        lock.bundle_id, NATIVE_VERSION
    );
    fs::write(root.join("Contents/Info.plist"), info).unwrap();
    fs::write(root.join(&lock.executable), b"main").unwrap();
    lock.executable_sha256 = hash(b"main");
    (temp, root, lock)
}

#[test]
#[cfg(target_os = "macos")]
fn native_host_identity_does_not_read_build_catalogs_or_runtime_libraries() {
    let (_temp, root, lock) = host_identity_fixture();
    // 未创建库或catalog。构建锁不要求在每次动作重读这些文件。
    verify_host_with_target(&root, &lock).unwrap();
    assert!(!root.join("Contents/Frameworks").exists());
    assert!(!root.join("Contents/assets").exists());
}

#[test]
#[cfg(target_os = "macos")]
fn native_host_identity_still_rejects_a_changed_main_executable() {
    let (_temp, root, lock) = host_identity_fixture();
    verify_host_with_target(&root, &lock).unwrap();
    fs::write(root.join(&lock.executable), b"foreign main").unwrap();
    assert!(verify_host_with_target(&root, &lock)
        .unwrap_err()
        .contains("executable digest"));
}
#[test]
fn explicit_compile_approval_loads_the_generated_runtime_packs() {
    if COMPILED_MANIFEST.is_empty() {
        assert!(!native_runtime_enabled());
        return;
    }
    let repo = Path::new(env!("CARGO_MANIFEST_DIR")).parent().unwrap();
    let temp = tempfile::tempdir().unwrap();
    let resource = temp.path().canonicalize().unwrap();
    assert_eq!(load_resources(repo, &resource).unwrap().packs.len(), 3);
}
#[test]
#[cfg(target_os = "macos")]
fn native_discovery_reads_version_without_requiring_legacy_json_assets() {
    let temp = tempfile::tempdir().unwrap();
    let app = temp.path().canonicalize().unwrap().join("Cavalry.app");
    fs::create_dir_all(app.join("Contents/MacOS")).unwrap();
    fs::write(app.join("Contents/MacOS/Cavalry"), b"fixture").unwrap();
    for version in ["2.8.0", "2.7.2"] {
        fs::write(app.join("Contents/Info.plist"),format!(r#"<plist version="1.0"><dict><key>CFBundleIdentifier</key><string>com.scenegroup.cavalry</string><key>CFBundleShortVersionString</key><string>{version}</string><key>CFBundleExecutable</key><string>Cavalry</string></dict></plist>"#)).unwrap();
        assert_eq!(
            observe_install(&app).unwrap(),
            (app.clone(), version.into())
        );
        assert!(!app
            .join("Contents/assets/Definitions/appStrings.json")
            .exists());
    }
    fs::write(app.join("Contents/Info.plist"), b"invalid plist").unwrap();
    assert!(observe_install(&app).is_err());
}
