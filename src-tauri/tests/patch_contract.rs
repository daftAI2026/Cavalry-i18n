/**
 * [INPUT]: 依赖 cavalry_i18n_tauri::patch 的 English 内容证明/immutable generation、snapshot provenance、overlay/staging 能力与仓库四语语言包
 * [OUTPUT]: 对外提供 clean-English 逐叶证明、世代指针 crash recovery/revision 失效、无 symlink/component-boundary staging、原始 Unix mode 恢复、已安装版本增量保留与 smoother 四语同构 contract tests
 * [POS]: src-tauri/tests 的 patch 守门，确保未知安装内容、部分 generation、路径替换或 0600 snapshot store mode 不能污染/切换 English 快照
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#[cfg(unix)]
use cavalry_i18n_tauri::patch::stage_files;
use cavalry_i18n_tauri::patch::{
    build_copy_pairs, build_copy_pairs_checked, build_mac_english_restore_pairs,
    build_mac_overlay_pairs_exact, build_overlay_pairs, discover_plugins, english_snapshot_dir,
    english_snapshot_identity, extract_english, extract_english_generation, has_english_snapshot,
    install_matches_language_source, merge_translation_overlay, needs_english_snapshot,
    observe_clean_english_assets, snapshot_matches_language_source, stage_english_snapshot_exact,
    try_discover_plugins, validate_english_snapshot, validate_english_snapshot_at,
    validate_english_snapshot_manifest, verify_installed_asset_preimages, EnglishSnapshotManifest,
};
use cavalry_i18n_tauri::state::EnglishSnapshotProvenance;
use std::{fs, path::Path};

#[cfg(unix)]
use std::os::unix::fs::PermissionsExt;

fn write(path: &Path, value: &[u8]) {
    fs::create_dir_all(path.parent().unwrap()).unwrap();
    fs::write(path, value).unwrap();
}

fn make_complete_asset_app(root: &Path) -> std::path::PathBuf {
    let app = root.join("Cavalry.app");
    for (_, asset_relative) in cavalry_i18n_tauri::patch::CORE_MAP {
        write(
            &app.join("Contents/assets").join(asset_relative),
            br#"{"value":"English"}"#,
        );
    }
    app
}

fn find_node_type<'a>(
    value: &'a serde_json::Value,
    node_type: &str,
) -> Option<&'a serde_json::Value> {
    match value {
        serde_json::Value::Object(object) => {
            if object.get("nodeType").and_then(serde_json::Value::as_str) == Some(node_type) {
                return Some(value);
            }
            object
                .values()
                .find_map(|child| find_node_type(child, node_type))
        }
        serde_json::Value::Array(values) => values
            .iter()
            .find_map(|child| find_node_type(child, node_type)),
        _ => None,
    }
}

#[test]
fn packaged_languages_translate_cross_platform_smoother_attribute() {
    let repo_root = Path::new(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .expect("src-tauri must remain below the repository root");
    let expected = [
        ("en", "Smoothing Steps"),
        ("zh-Hans", "平滑步数"),
        ("zh-Hant", "平滑步數"),
        ("ja_JP", "スムージングステップ数"),
    ];

    for (language, smoothing_steps) in expected {
        let path = repo_root
            .join("languages")
            .join(language)
            .join("nodeStrings.json");
        let catalog: serde_json::Value =
            serde_json::from_slice(&fs::read(&path).expect("could not read nodeStrings catalog"))
                .expect("nodeStrings catalog must remain valid JSON");
        let smoother = find_node_type(&catalog, "smoother")
            .unwrap_or_else(|| panic!("{language} must contain the Cavalry 2.7.2 smoother node"));
        assert_eq!(
            smoother["attributes"]["smoothingSteps"], smoothing_steps,
            "{language} smoother.attributes.smoothingSteps"
        );
    }
}

#[test]
fn extract_english_copies_core_files() {
    let temp = tempfile::tempdir().unwrap();
    let app = temp.path().join("Cavalry.app");
    for (_, asset_rel) in cavalry_i18n_tauri::patch::CORE_MAP {
        write(&app.join("Contents/assets").join(asset_rel), br#"{}"#);
    }

    let out = temp.path().join("en");
    let count = extract_english(&app, &out).unwrap();
    assert!(count >= cavalry_i18n_tauri::patch::CORE_MAP.len());
    assert!(out.join("nodeStrings.json").exists());
}

#[test]
fn caller_owned_exact_snapshot_staging_never_publishes_a_standalone_pointer() {
    let temp = tempfile::tempdir().unwrap();
    let app = make_complete_asset_app(temp.path());
    let packaged = temp.path().join("packaged-en");
    for (language_relative, _) in cavalry_i18n_tauri::patch::CORE_MAP {
        write(&packaged.join(language_relative), br#"{"value":"English"}"#);
    }
    let observation = observe_clean_english_assets(&packaged, &app).unwrap();
    let staged = temp.path().join("unified-generation/english");

    assert_eq!(
        stage_english_snapshot_exact(&app, &staged, &observation).unwrap(),
        observation
    );
    assert_eq!(
        validate_english_snapshot_at(&staged, &app, &observation.manifest_sha256).unwrap(),
        observation
    );
    assert!(!temp
        .path()
        .join("unified-generation/english-snapshots/current.json")
        .exists());

    write(
        &app.join("Contents/assets/Definitions/appStrings.json"),
        br#"{"value":"drift"}"#,
    );
    assert!(
        stage_english_snapshot_exact(&app, &temp.path().join("drifted-stage"), &observation,)
            .is_err()
    );
}

#[test]
fn discover_plugins_to_camel_case() {
    let temp = tempfile::tempdir().unwrap();
    let app = temp.path().join("Cavalry.app");
    write(
        &app.join("Contents/assets/Plugins/Gaussian Blur Filter/strings.json"),
        br#"{}"#,
    );

    let plugins = discover_plugins(&app);
    assert_eq!(plugins[0].camel_name, "gaussianBlurFilter");
}

#[test]
fn plugin_canonical_identity_collision_fails_closed_before_snapshot_or_restore() {
    let temp = tempfile::tempdir().unwrap();
    let app = temp.path().join("Cavalry.app");
    write(
        &app.join("Contents/assets/Plugins/Gaussian Blur Filter/strings.json"),
        br#"{}"#,
    );
    write(
        &app.join("Contents/assets/Plugins/Gaussian  Blur Filter/strings.json"),
        br#"{}"#,
    );
    let source = temp.path().join("languages/zh-Hans");
    write(&source.join("plugins/gaussianBlurFilter.json"), br#"{}"#);

    let error = try_discover_plugins(&app).unwrap_err();
    assert!(error.contains("collision"));
    assert!(build_copy_pairs_checked(&source, &app).is_err());
    assert!(
        build_copy_pairs(&source, &app).is_empty(),
        "legacy Vec API must fail closed rather than choose one plugin"
    );
    assert!(extract_english(&app, &temp.path().join("state/en")).is_err());
}

#[test]
fn english_snapshot_manifest_keeps_exact_plugin_path_and_hashes_content() {
    let temp = tempfile::tempdir().unwrap();
    let app = temp.path().join("Cavalry.app");
    for (_, asset_rel) in cavalry_i18n_tauri::patch::CORE_MAP {
        write(&app.join("Contents/assets").join(asset_rel), br#"{}"#);
    }
    write(
        &app.join("Contents/assets/Plugins/Example Filter/strings.json"),
        br#"{"label":"English"}"#,
    );

    let state_dir = temp.path().join("state");
    extract_english(&app, &state_dir.join("en")).unwrap();
    let manifest: EnglishSnapshotManifest =
        serde_json::from_slice(&fs::read(state_dir.join("en/manifest.json")).unwrap()).unwrap();
    let plugin_entry = manifest
        .entries
        .iter()
        .find(|entry| entry.asset_relative_path == "Plugins/Example Filter/strings.json")
        .unwrap();
    assert_eq!(
        plugin_entry.language_relative_path,
        "plugins/exampleFilter.json"
    );
    assert!(!plugin_entry.sha256.is_empty());
    assert!(validate_english_snapshot(&state_dir, &app).unwrap());

    write(
        &state_dir.join("en/plugins/exampleFilter.json"),
        br#"{"label":"tampered"}"#,
    );
    assert!(!validate_english_snapshot(&state_dir, &app).unwrap());
}

#[test]
fn immutable_generations_publish_atomically_and_recover_the_previous_pointer() {
    let temp = tempfile::tempdir().unwrap();
    let app = make_complete_asset_app(temp.path());
    let state = temp.path().join("state");

    extract_english_generation(&app, &state, "revision-1").unwrap();
    let current_path = state.join("english-snapshots/current.json");
    let first: serde_json::Value =
        serde_json::from_slice(&fs::read(&current_path).unwrap()).unwrap();
    let first_generation = first["generation"].as_str().unwrap().to_string();
    assert_eq!(first["schemaVersion"], 1);
    assert_eq!(first["immutableRevision"], "revision-1");
    assert!(validate_english_snapshot_manifest(&state, &app).unwrap());

    extract_english_generation(&app, &state, "revision-2").unwrap();
    let second: serde_json::Value =
        serde_json::from_slice(&fs::read(&current_path).unwrap()).unwrap();
    assert_ne!(second["generation"], first_generation);
    assert_eq!(second["immutableRevision"], "revision-2");
    let previous: serde_json::Value = serde_json::from_slice(
        &fs::read(state.join("english-snapshots/current.json.prev")).unwrap(),
    )
    .unwrap();
    assert_eq!(previous["generation"], first_generation);
    assert_eq!(previous["immutableRevision"], "revision-1");

    fs::write(&current_path, b"{interrupted").unwrap();
    let recovered = english_snapshot_dir(&state, &app, "revision-1").unwrap();
    assert_eq!(
        recovered.file_name().unwrap().to_string_lossy(),
        first_generation
    );
    assert!(validate_english_snapshot_manifest(&state, &app).unwrap());

    fs::write(
        &current_path,
        serde_json::to_vec(&serde_json::json!({
            "schemaVersion": 99,
            "generation": first_generation,
            "installRoot": fs::canonicalize(&app).unwrap().to_string_lossy(),
            "immutableRevision": "revision-1"
        }))
        .unwrap(),
    )
    .unwrap();
    let error = english_snapshot_dir(&state, &app, "revision-1").unwrap_err();
    assert!(error.contains("Unsupported English snapshot pointer schema"));
}

#[test]
fn failed_or_tampered_generation_never_becomes_a_usable_snapshot() {
    let temp = tempfile::tempdir().unwrap();
    let app = make_complete_asset_app(temp.path());
    let state = temp.path().join("state");
    extract_english_generation(&app, &state, "revision-1").unwrap();
    let identity = english_snapshot_identity(&state, &app, "revision-1").unwrap();
    let current_path = state.join("english-snapshots/current.json");
    let current_before = fs::read(&current_path).unwrap();

    fs::remove_file(app.join("Contents/assets/Definitions/appStrings.json")).unwrap();
    assert!(extract_english_generation(&app, &state, "revision-2").is_err());
    assert_eq!(fs::read(&current_path).unwrap(), current_before);

    write(
        &state.join("english-snapshots/generations/.generation-crashed.tmp/partial.json"),
        br#"{}"#,
    );
    let current = english_snapshot_dir(&state, &app, "revision-1").unwrap();
    let tampered = current.join("nodeStrings.json");
    write(&tampered, br#"{"value":"tampered"}"#);
    let provenance = EnglishSnapshotProvenance {
        install_root: app.to_string_lossy().to_string(),
        immutable_revision: "revision-1".to_string(),
        snapshot_generation: Some(identity.generation),
        snapshot_manifest_sha256: Some(identity.manifest_sha256),
        vendor_baseline_id: None,
    };
    assert!(needs_english_snapshot(
        &state,
        Some(&provenance),
        &app,
        "revision-1"
    ));
}

#[test]
#[cfg(unix)]
fn mac_snapshot_store_is_private_but_exact_pairs_restore_vendor_mode() {
    let temp = tempfile::tempdir().unwrap();
    let app = make_complete_asset_app(temp.path());
    for (_, asset_relative) in cavalry_i18n_tauri::patch::CORE_MAP {
        fs::set_permissions(
            app.join("Contents/assets").join(asset_relative),
            fs::Permissions::from_mode(0o644),
        )
        .unwrap();
    }
    let source = temp.path().join("languages/zh-Hans");
    for (language_relative, _) in cavalry_i18n_tauri::patch::CORE_MAP {
        write(
            &source.join(language_relative),
            br#"{"value":"translated"}"#,
        );
    }

    let state = temp.path().join("state");
    extract_english_generation(&app, &state, "revision-1").unwrap();
    let identity = english_snapshot_identity(&state, &app, "revision-1").unwrap();
    let snapshot = english_snapshot_dir(&state, &app, "revision-1").unwrap();
    let manifest: EnglishSnapshotManifest =
        serde_json::from_slice(&fs::read(snapshot.join("manifest.json")).unwrap()).unwrap();
    assert_eq!(
        manifest
            .entries
            .iter()
            .find(|entry| entry.language_relative_path == "appStrings.json")
            .and_then(|entry| entry.unix_mode),
        Some(0o644),
        "capture must bind the vendor mode into the manifest"
    );
    assert_eq!(
        fs::metadata(snapshot.join("appStrings.json"))
            .unwrap()
            .permissions()
            .mode()
            & 0o777,
        0o600,
        "snapshot store remains private"
    );

    let restore_pairs = build_mac_english_restore_pairs(
        &snapshot,
        &app,
        &temp.path().join("restore-stage"),
        &identity.manifest_sha256,
    )
    .unwrap();
    assert_eq!(
        fs::metadata(&restore_pairs[0].src)
            .unwrap()
            .permissions()
            .mode()
            & 0o777,
        0o644,
        "restore source mode comes from the manifest, not 0600 snapshot storage"
    );

    let overlay_pairs = build_mac_overlay_pairs_exact(
        &source,
        &snapshot,
        &app,
        &temp.path().join("overlay"),
        &identity.manifest_sha256,
    )
    .unwrap();
    assert_eq!(
        fs::metadata(&overlay_pairs[0].src)
            .unwrap()
            .permissions()
            .mode()
            & 0o777,
        0o644,
        "overlay source mode comes from the manifest, not 0600 snapshot storage"
    );

    let manifest_path = snapshot.join("manifest.json");
    let mut manifest: serde_json::Value =
        serde_json::from_slice(&fs::read(&manifest_path).unwrap()).unwrap();
    manifest["entries"][0]["unixMode"] = serde_json::json!(0o600);
    fs::write(
        &manifest_path,
        serde_json::to_vec_pretty(&manifest).unwrap(),
    )
    .unwrap();
    assert!(build_mac_english_restore_pairs(
        &snapshot,
        &app,
        &temp.path().join("tampered-restore-stage"),
        &identity.manifest_sha256,
    )
    .unwrap_err()
    .contains("manifest digest"));
    assert!(build_mac_overlay_pairs_exact(
        &source,
        &snapshot,
        &app,
        &temp.path().join("tampered-overlay"),
        &identity.manifest_sha256,
    )
    .unwrap_err()
    .contains("manifest digest"));
}

#[test]
#[cfg(unix)]
fn snapshot_pointer_and_legacy_tree_symlinks_fail_closed_instead_of_falling_back() {
    use std::os::unix::fs::symlink;

    let temp = tempfile::tempdir().unwrap();
    let app = make_complete_asset_app(temp.path());
    let state = temp.path().join("state");
    extract_english_generation(&app, &state, "revision-1").unwrap();
    let current = state.join("english-snapshots/current.json");
    fs::remove_file(&current).unwrap();
    symlink("missing-pointer-target", &current).unwrap();
    let error = english_snapshot_dir(&state, &app, "revision-1").unwrap_err();
    assert!(error.contains("symlink"), "{error}");

    let legacy_state = temp.path().join("legacy-state");
    fs::create_dir_all(&legacy_state).unwrap();
    symlink(temp.path().join("outside-legacy"), legacy_state.join("en")).unwrap();
    let error = validate_english_snapshot(&legacy_state, &app).unwrap_err();
    assert!(error.contains("symlink"), "{error}");
}

#[test]
#[cfg(unix)]
fn legacy_snapshot_intermediate_asset_symlink_and_manifest_symlink_are_rejected() {
    use std::os::unix::fs::symlink;

    let temp = tempfile::tempdir().unwrap();
    let app = make_complete_asset_app(temp.path());
    let legacy_state = temp.path().join("legacy-state");
    extract_english(&app, &legacy_state.join("en")).unwrap();
    let outside = temp.path().join("outside");
    fs::create_dir_all(&outside).unwrap();
    fs::remove_dir_all(legacy_state.join("en/Definitions")).unwrap();
    symlink(&outside, legacy_state.join("en/Definitions")).unwrap();
    let error = validate_english_snapshot(&legacy_state, &app).unwrap_err();
    assert!(error.contains("symlink"), "{error}");

    let generation_state = temp.path().join("generation-state");
    extract_english_generation(&app, &generation_state, "revision-1").unwrap();
    let snapshot = english_snapshot_dir(&generation_state, &app, "revision-1").unwrap();
    let manifest = snapshot.join("manifest.json");
    let manifest_target = temp.path().join("manifest-target.json");
    fs::write(&manifest_target, fs::read(&manifest).unwrap()).unwrap();
    fs::remove_file(&manifest).unwrap();
    symlink(&manifest_target, &manifest).unwrap();
    let error = validate_english_snapshot_manifest(&generation_state, &app).unwrap_err();
    assert!(error.contains("symlink"), "{error}");
}

#[test]
#[cfg(unix)]
fn mac_asset_snapshot_paths_reject_definitions_and_plugins_intermediate_symlinks() {
    use std::os::unix::fs::symlink;

    for component in ["Definitions", "Plugins"] {
        let temp = tempfile::tempdir().unwrap();
        let app = make_complete_asset_app(temp.path());
        let assets = app.join("Contents/assets");
        let outside = temp.path().join(format!("outside-{component}"));
        fs::create_dir_all(&outside).unwrap();
        if component == "Plugins" {
            write(
                &outside.join("Example Filter/strings.json"),
                br#"{"label":"English"}"#,
            );
        }
        let target = assets.join(component);
        if target.exists() {
            fs::remove_dir_all(&target).unwrap();
        }
        symlink(&outside, &target).unwrap();

        let error = cavalry_i18n_tauri::patch::observe_english_snapshot(&app).unwrap_err();
        assert!(error.contains("symlink"), "{component}: {error}");
    }
}

#[test]
fn build_copy_pairs_matches_cavalry_assets() {
    let temp = tempfile::tempdir().unwrap();
    let app = temp.path().join("Cavalry.app");
    let source = temp.path().join("lang");
    for (lang_rel, asset_rel) in cavalry_i18n_tauri::patch::CORE_MAP {
        write(&app.join("Contents/assets").join(asset_rel), br#"{}"#);
        write(&source.join(lang_rel), br#"{}"#);
    }

    let pairs = build_copy_pairs(&source, &app);
    assert!(pairs.len() >= cavalry_i18n_tauri::patch::CORE_MAP.len());
    assert!(pairs.iter().any(|p| p
        .dst
        .ends_with("Contents/assets/Definitions/nodeStrings.json")));
}

#[test]
fn clean_english_proof_allows_vendor_keys_but_rejects_changed_known_leaves() {
    let temp = tempfile::tempdir().unwrap();
    let app = temp.path().join("Cavalry");
    let source = temp.path().join("languages/en");
    for (language_relative, asset_relative) in cavalry_i18n_tauri::patch::CORE_MAP {
        write(&source.join(language_relative), br#"{"label":"English"}"#);
        write(
            &app.join("assets").join(asset_relative),
            br#"{"label":"English","vendorOnly":true}"#,
        );
    }

    assert!(install_matches_language_source(&source, &app).unwrap());

    write(
        &app.join("assets/Definitions/appStrings.json"),
        br#"{"label":"Translated","vendorOnly":true}"#,
    );
    assert!(!install_matches_language_source(&source, &app).unwrap());
}

#[test]
fn snapshot_provenance_invalidates_on_revision_change_and_can_be_content_verified() {
    let temp = tempfile::tempdir().unwrap();
    let app = temp.path().join("Cavalry");
    let state_dir = temp.path().join("state");
    let source = temp.path().join("languages/en");
    for (language_relative, asset_relative) in cavalry_i18n_tauri::patch::CORE_MAP {
        write(&source.join(language_relative), br#"{"label":"English"}"#);
        write(
            &app.join("assets").join(asset_relative),
            br#"{"label":"English","vendorOnly":true}"#,
        );
    }
    extract_english_generation(&app, &state_dir, "revision-1").unwrap();
    let identity = english_snapshot_identity(&state_dir, &app, "revision-1").unwrap();
    for (_, asset_relative) in cavalry_i18n_tauri::patch::CORE_MAP {
        write(
            &app.join("assets").join(asset_relative),
            br#"{"label":"Translated"}"#,
        );
    }
    let provenance = EnglishSnapshotProvenance {
        install_root: app.to_string_lossy().to_string(),
        immutable_revision: "revision-1".into(),
        snapshot_generation: Some(identity.generation),
        snapshot_manifest_sha256: Some(identity.manifest_sha256),
        vendor_baseline_id: None,
    };

    assert!(snapshot_matches_language_source(&source, &state_dir, &app).unwrap());
    assert!(!needs_english_snapshot(
        &state_dir,
        Some(&provenance),
        &app,
        "revision-1"
    ));
    assert!(needs_english_snapshot(
        &state_dir,
        Some(&provenance),
        &app,
        "revision-2"
    ));
}

#[test]
fn current_language_asset_preimages_fail_closed_on_same_revision_drift() {
    let temp = tempfile::tempdir().unwrap();
    let app = make_complete_asset_app(temp.path());
    let state_dir = temp.path().join("state");
    let translated = temp.path().join("languages/zh-Hans");
    extract_english_generation(&app, &state_dir, "revision-1").unwrap();

    for (language_relative, asset_relative) in cavalry_i18n_tauri::patch::CORE_MAP {
        let translated_value = serde_json::json!({"value": "Translated"});
        write(
            &translated.join(language_relative),
            &serde_json::to_vec(&translated_value).unwrap(),
        );
        write(
            &app.join("Contents/assets").join(asset_relative),
            &serde_json::to_vec_pretty(&translated_value).unwrap(),
        );
    }
    verify_installed_asset_preimages(&state_dir, &app, "revision-1", Some(&translated)).unwrap();

    write(
        &app.join("Contents/assets/Definitions/appStrings.json"),
        br#"{"value":"locally drifted"}"#,
    );
    let error = verify_installed_asset_preimages(&state_dir, &app, "revision-1", Some(&translated))
        .unwrap_err();
    assert!(error.contains("asset drift detected"), "{error}");
}

#[test]
#[cfg(unix)]
fn mac_exact_preimage_evidence_binds_bytes_mode_and_manifest_identity() {
    use std::os::unix::fs::PermissionsExt;

    let temp = tempfile::tempdir().unwrap();
    let app = make_complete_asset_app(temp.path());
    write(
        &app.join("Contents/assets/Definitions/appStrings.json"),
        br#"{"a":"English","b":"English"}"#,
    );
    for (_, asset_relative) in cavalry_i18n_tauri::patch::CORE_MAP {
        fs::set_permissions(
            app.join("Contents/assets").join(asset_relative),
            fs::Permissions::from_mode(0o644),
        )
        .unwrap();
    }
    let state = temp.path().join("state");
    extract_english_generation(&app, &state, "revision-1").unwrap();
    let identity = english_snapshot_identity(&state, &app, "revision-1").unwrap();
    let snapshot = english_snapshot_dir(&state, &app, "revision-1").unwrap();

    let english_evidence = cavalry_i18n_tauri::patch::expected_mac_asset_preimage_evidence(
        &snapshot,
        &app,
        None,
        &identity.manifest_sha256,
    )
    .unwrap();
    cavalry_i18n_tauri::patch::verify_asset_preimage_evidence(&app, &english_evidence).unwrap();

    write(
        &app.join("Contents/assets/Definitions/appStrings.json"),
        br#"{
  "b": "English",
  "a": "English"
}"#,
    );
    let error = cavalry_i18n_tauri::patch::verify_asset_preimage_evidence(&app, &english_evidence)
        .unwrap_err();
    assert!(error.contains("exact bytes SHA-256 mismatch"), "{error}");

    fs::copy(
        snapshot.join("appStrings.json"),
        app.join("Contents/assets/Definitions/appStrings.json"),
    )
    .unwrap();
    fs::set_permissions(
        app.join("Contents/assets/Definitions/appStrings.json"),
        fs::Permissions::from_mode(0o600),
    )
    .unwrap();
    let error = cavalry_i18n_tauri::patch::verify_asset_preimage_evidence(&app, &english_evidence)
        .unwrap_err();
    assert!(error.contains("Unix mode mismatch"), "{error}");

    let translated = temp.path().join("languages/zh-Hans");
    for (language_relative, _) in cavalry_i18n_tauri::patch::CORE_MAP {
        let value = if language_relative == "appStrings.json" {
            serde_json::json!({"b": "翻译", "a": "翻译"})
        } else {
            serde_json::json!({"value": "翻译"})
        };
        write(
            &translated.join(language_relative),
            &serde_json::to_vec(&value).unwrap(),
        );
    }
    let overlay_pairs = build_mac_overlay_pairs_exact(
        &translated,
        &snapshot,
        &app,
        &temp.path().join("overlay-preimage"),
        &identity.manifest_sha256,
    )
    .unwrap();
    for pair in &overlay_pairs {
        fs::copy(&pair.src, &pair.dst).unwrap();
        fs::set_permissions(&pair.dst, fs::Permissions::from_mode(0o644)).unwrap();
    }
    let translated_evidence = cavalry_i18n_tauri::patch::expected_mac_asset_preimage_evidence(
        &snapshot,
        &app,
        Some(&translated),
        &identity.manifest_sha256,
    )
    .unwrap();
    cavalry_i18n_tauri::patch::verify_asset_preimage_evidence(&app, &translated_evidence).unwrap();
    write(
        &app.join("Contents/assets/Definitions/appStrings.json"),
        r#"{
  "b": "翻译",
  "a": "翻译"
}"#
        .as_bytes(),
    );
    let error =
        cavalry_i18n_tauri::patch::verify_asset_preimage_evidence(&app, &translated_evidence)
            .unwrap_err();
    assert!(error.contains("exact bytes SHA-256 mismatch"), "{error}");

    let manifest_path = snapshot.join("manifest.json");
    let mut manifest: serde_json::Value =
        serde_json::from_slice(&fs::read(&manifest_path).unwrap()).unwrap();
    manifest["entries"][0]["unixMode"] = serde_json::json!(0o600);
    fs::write(
        &manifest_path,
        serde_json::to_vec_pretty(&manifest).unwrap(),
    )
    .unwrap();
    let error = cavalry_i18n_tauri::patch::expected_mac_asset_preimage_evidence(
        &snapshot,
        &app,
        None,
        &identity.manifest_sha256,
    )
    .unwrap_err();
    assert!(error.contains("manifest digest"), "{error}");
}

#[test]
fn english_snapshot_requires_plugin_definitions_and_plugin_strings() {
    let temp = tempfile::tempdir().unwrap();
    let app = temp.path().join("Cavalry.app");
    let state_dir = temp.path().join("state");
    let snapshot = state_dir.join("en");

    for (lang_rel, asset_rel) in cavalry_i18n_tauri::patch::CORE_MAP {
        write(&app.join("Contents/assets").join(asset_rel), br#"{}"#);
        write(&snapshot.join(lang_rel), br#"{}"#);
    }
    write(
        &app.join("Contents/assets/Plugins/Gaussian Blur Filter/definitions.json"),
        br#"{}"#,
    );
    write(
        &app.join("Contents/assets/Plugins/Gaussian Blur Filter/strings.json"),
        br#"{}"#,
    );

    assert!(!has_english_snapshot(&state_dir, &app));

    write(
        &snapshot.join("plugins/gaussianBlurFilterDefinitions.json"),
        br#"{}"#,
    );
    write(&snapshot.join("plugins/gaussianBlurFilter.json"), br#"{}"#);

    assert!(has_english_snapshot(&state_dir, &app));
}

#[test]
#[cfg(unix)]
fn stage_files_preserves_mode() {
    let temp = tempfile::tempdir().unwrap();
    let source = temp.path().join("appStrings.json");
    write(&source, br#"{}"#);
    fs::set_permissions(&source, fs::Permissions::from_mode(0o640)).unwrap();

    let staged = stage_files(
        &[cavalry_i18n_tauri::patch::CopyPair {
            src: source.clone(),
            dst: temp.path().join("dst/appStrings.json"),
        }],
        &temp.path().join("stage"),
    )
    .unwrap();

    let staged_mode = fs::metadata(&staged[0].src).unwrap().permissions().mode() & 0o777;
    assert_eq!(staged_mode, 0o640);
}

#[test]
fn stage_files_rejects_duplicate_destinations() {
    let temp = tempfile::tempdir().unwrap();
    let first = temp.path().join("first.json");
    let second = temp.path().join("second.json");
    write(&first, br#"{}"#);
    write(&second, br#"{}"#);
    let destination = temp.path().join("assets/Plugins/Example/strings.json");

    let error = cavalry_i18n_tauri::patch::stage_files(
        &[
            cavalry_i18n_tauri::patch::CopyPair {
                src: first,
                dst: destination.clone(),
            },
            cavalry_i18n_tauri::patch::CopyPair {
                src: second,
                dst: destination,
            },
        ],
        &temp.path().join("stage"),
    )
    .unwrap_err();
    assert!(error.contains("Duplicate staging destination"));
}

#[test]
#[cfg(unix)]
fn stage_files_rejects_a_symlink_source_before_copying_bytes() {
    use std::os::unix::fs::symlink;

    let temp = tempfile::tempdir().unwrap();
    let outside = temp.path().join("outside.json");
    let source = temp.path().join("source.json");
    write(&outside, br#"{"secret":true}"#);
    symlink(&outside, &source).unwrap();

    let error = stage_files(
        &[cavalry_i18n_tauri::patch::CopyPair {
            src: source,
            dst: temp
                .path()
                .join("Cavalry.app/Contents/assets/appStrings.json"),
        }],
        &temp.path().join("stage"),
    )
    .unwrap_err();

    assert!(error.contains("non-symlink"), "{error}");
    assert!(!temp.path().join("stage/0-source.json").exists());
}

#[test]
fn overlay_preserves_installed_smoother_and_future_nodes() {
    let temp = tempfile::tempdir().unwrap();
    let app = temp.path().join("Custom Install");
    let source = temp.path().join("languages/zh-Hans");
    let snapshot = temp.path().join("state/en");
    let destination = app.join("assets/Definitions/nodeStrings.json");
    let installed = serde_json::json!([
        {
            "type": "nodeStrings",
            "values": [
                {
                    "nodeType": "element",
                    "niceName": "Element",
                    "attributes": {"hidden": "Hidden"}
                },
                {
                    "nodeType": "smoother",
                    "niceName": "Smoother",
                    "attributes": {"smoothingSteps": "Smoothing Steps"}
                },
                {
                    "nodeType": "futureVersionNode",
                    "niceName": "Future Version Node",
                    "attributes": {"futureLabel": "Future Label"}
                }
            ]
        }
    ]);
    let translated = serde_json::json!([
        {
            "type": "nodeStrings",
            "values": [
                {
                    "nodeType": "element",
                    "niceName": "Element",
                    "attributes": {"hidden": "隐藏"}
                }
            ]
        }
    ]);
    write(
        &destination,
        serde_json::to_vec(&installed).unwrap().as_slice(),
    );
    write(
        &snapshot.join("nodeStrings.json"),
        serde_json::to_vec(&installed).unwrap().as_slice(),
    );
    write(
        &source.join("nodeStrings.json"),
        serde_json::to_vec(&translated).unwrap().as_slice(),
    );

    let pairs =
        build_overlay_pairs(&source, &snapshot, &app, &temp.path().join("overlay")).unwrap();
    let merged: serde_json::Value =
        serde_json::from_slice(&fs::read(&pairs[0].src).unwrap()).unwrap();

    assert_eq!(merged[0]["values"][0]["attributes"]["hidden"], "隐藏");
    assert_eq!(merged[0]["values"][1]["nodeType"], "smoother");
    assert_eq!(
        merged[0]["values"][1]["attributes"]["smoothingSteps"],
        "Smoothing Steps"
    );
    assert_eq!(
        merged[0]["values"][2]["attributes"]["futureLabel"],
        "Future Label"
    );
}

#[test]
fn overlay_does_not_shift_unidentified_top_level_items_after_unknown_insertion() {
    let installed = serde_json::json!([
        {
            "type": "nodeStrings",
            "value": {"nodeType": "first", "attributes": {"label": "First"}}
        },
        {
            "type": "windowsOnly",
            "value": {"label": "Windows only"}
        },
        {
            "type": "strings",
            "value": {"title": "Installed title"}
        },
        {
            "type": "nodeStrings",
            "value": {"nodeType": "last", "attributes": {"label": "Last"}}
        }
    ]);
    let translation = serde_json::json!([
        {
            "type": "nodeStrings",
            "value": {"nodeType": "first", "attributes": {"label": "第一个"}}
        },
        {
            "type": "strings",
            "value": {"title": "翻译标题"}
        },
        {
            "type": "nodeStrings",
            "value": {"nodeType": "last", "attributes": {"label": "最后一个"}}
        }
    ]);

    let merged = merge_translation_overlay(&installed, &translation);

    assert_eq!(merged[0]["value"]["attributes"]["label"], "第一个");
    assert_eq!(merged[1]["value"]["label"], "Windows only");
    assert_eq!(merged[2]["value"]["title"], "Installed title");
    assert_eq!(merged[3]["value"]["attributes"]["label"], "最后一个");
}

#[test]
fn overlay_translates_only_strings_and_preserves_vendor_scalar_metadata() {
    let installed = serde_json::json!({
        "label": "Label",
        "version": 1.0,
        "enabled": true,
        "optional": null,
        "nested": {
            "description": "Description",
            "threshold": 2.5
        }
    });
    let translation = serde_json::json!({
        "label": "标签",
        "version": 1,
        "enabled": false,
        "optional": "not metadata",
        "nested": {
            "description": "说明",
            "threshold": 99
        }
    });

    let merged = merge_translation_overlay(&installed, &translation);

    assert_eq!(merged["label"], "标签");
    assert_eq!(merged["nested"]["description"], "说明");
    assert_eq!(merged["version"], installed["version"]);
    assert_eq!(merged["enabled"], installed["enabled"]);
    assert_eq!(merged["optional"], installed["optional"]);
    assert_eq!(
        merged["nested"]["threshold"],
        installed["nested"]["threshold"]
    );
}
