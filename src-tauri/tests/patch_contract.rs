/**
 * [INPUT]: 依赖 cavalry_i18n_tauri::patch 的 English 提取、插件发现、copy pair 与 staging 能力
 * [OUTPUT]: 对外提供 JSON 资产映射与 staged 文件模式保留 contract tests
 * [POS]: src-tauri/tests 的 patch 守门，确保 Tauri 复制计划与 Cavalry JSON 文件映射一致
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
use cavalry_i18n_tauri::patch::{build_copy_pairs, discover_plugins, extract_english, stage_files};
use std::{fs, os::unix::fs::PermissionsExt, path::Path};

fn write(path: &Path, value: &[u8]) {
    fs::create_dir_all(path.parent().unwrap()).unwrap();
    fs::write(path, value).unwrap();
}

#[test]
fn extract_english_copies_core_files() {
    let temp = tempfile::tempdir().unwrap();
    let app = temp.path().join("Cavalry.app");
    for (file, subdir) in cavalry_i18n_tauri::patch::CORE_MAP {
        write(&app.join("Contents/assets").join(subdir).join(file), br#"{}"#);
    }

    let out = temp.path().join("en");
    assert_eq!(extract_english(&app, &out).unwrap(), 4);
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
    for (file, subdir) in cavalry_i18n_tauri::patch::CORE_MAP {
        write(&app.join("Contents/assets").join(subdir).join(file), br#"{}"#);
        write(&source.join(file), br#"{}"#);
    }

    let pairs = build_copy_pairs(&source, &app);
    assert_eq!(pairs.len(), 4);
    assert!(pairs[0]
        .dst
        .ends_with("Contents/assets/Definitions/nodeStrings.json"));
}

#[test]
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
