/**
 * [INPUT]: 依赖 cavalry_i18n_tauri::patch 的 English 内容证明/提取、snapshot provenance、overlay/staging 能力与仓库四语语言包
 * [OUTPUT]: 对外提供 clean-English 逐叶证明、revision 失效、已安装版本增量保留与 smoother 四语同构 contract tests
 * [POS]: src-tauri/tests 的 patch 守门，确保未知安装内容不能污染 English 快照
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#[cfg(unix)]
use cavalry_i18n_tauri::patch::stage_files;
use cavalry_i18n_tauri::patch::{
    build_copy_pairs, build_overlay_pairs, discover_plugins, extract_english, has_english_snapshot,
    install_matches_language_source, merge_translation_overlay, needs_english_snapshot,
    snapshot_matches_language_source,
};
use cavalry_i18n_tauri::state::EnglishSnapshotProvenance;
use std::{fs, path::Path};

#[cfg(unix)]
use std::os::unix::fs::PermissionsExt;

fn write(path: &Path, value: &[u8]) {
    fs::create_dir_all(path.parent().unwrap()).unwrap();
    fs::write(path, value).unwrap();
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
    let snapshot = state_dir.join("en");
    let source = temp.path().join("languages/en");
    for (language_relative, asset_relative) in cavalry_i18n_tauri::patch::CORE_MAP {
        write(&source.join(language_relative), br#"{"label":"English"}"#);
        write(
            &snapshot.join(language_relative),
            br#"{"label":"English","vendorOnly":true}"#,
        );
        write(
            &app.join("assets").join(asset_relative),
            br#"{"label":"Translated"}"#,
        );
    }
    let provenance = EnglishSnapshotProvenance {
        install_root: app.to_string_lossy().to_string(),
        immutable_revision: "revision-1".into(),
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
