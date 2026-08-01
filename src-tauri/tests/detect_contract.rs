#[cfg(target_os = "macos")]
use cavalry_i18n_tauri::detect::default_app_candidates;
/**
 * [INPUT]: 依赖 cavalry_i18n_tauri::detect/install 的候选顺序、安装根规范化、展示版本、revision 与 marker 读取能力
 * [OUTPUT]: 对外提供保存路径优先、macOS 默认候选与 Windows 非 MSI 内容身份 contract tests
 * [POS]: src-tauri/tests 的探测守门，确保展示版本不伪造且快照身份随不可变二进制变化
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
use cavalry_i18n_tauri::{
    detect::{
        find_cavalry_app_from_candidates, read_bundle_revision, read_bundle_version,
        read_installed_language,
    },
    install::normalize_path,
};
#[cfg(target_os = "macos")]
use std::env;
use std::{fs, path::Path};

fn write(path: &Path, value: &str) {
    fs::create_dir_all(path.parent().unwrap()).unwrap();
    fs::write(path, value).unwrap();
}

#[test]
fn find_cavalry_app_prefers_saved_path() {
    let temp = tempfile::tempdir().unwrap();
    let app_path = temp.path().join("Saved/Cavalry.app");
    write(
        &app_path.join("Contents/Info.plist"),
        "<plist><dict><key>CFBundleShortVersionString</key><string>1.0.0</string></dict></plist>",
    );
    write(&app_path.join("Contents/MacOS/Cavalry"), "binary");
    write(
        &app_path.join("Contents/assets/Definitions/appStrings.json"),
        "{}",
    );
    write(
        &app_path.join("Contents/assets/Definitions/nodeStrings.json"),
        "{}",
    );
    assert_eq!(
        find_cavalry_app_from_candidates(&app_path.to_string_lossy(), Vec::new()),
        normalize_path(&app_path)
    );
}

#[test]
fn read_bundle_version_from_info_plist() {
    let temp = tempfile::tempdir().unwrap();
    let app_path = temp.path().join("Cavalry.app");
    write(
        &app_path.join("Contents/Info.plist"),
        "<plist><dict><key>CFBundleShortVersionString</key><string>2.3.4</string></dict></plist>",
    );
    assert_eq!(read_bundle_version(&app_path).unwrap(), "2.3.4");
    assert_eq!(
        read_bundle_revision(&app_path).unwrap(),
        "bundle-version:2.3.4"
    );
}

#[test]
#[cfg(target_os = "macos")]
fn default_candidates_include_system_and_user_applications() {
    let home = env::var("HOME").unwrap();
    let candidates = default_app_candidates();
    assert_eq!(candidates[0], Path::new("/Applications/Cavalry.app"));
    assert_eq!(
        candidates[1],
        Path::new(&home).join("Applications").join("Cavalry.app")
    );
}

#[test]
fn arbitrary_windows_install_root_is_selected_without_a_fixed_drive() {
    let temp = tempfile::tempdir().unwrap();
    let root = temp.path().join("Any Drive").join("Cavalry");
    write(&root.join("Cavalry.exe"), "binary");
    write(&root.join("assets/Definitions/appStrings.json"), "{}");
    write(&root.join("assets/Definitions/nodeStrings.json"), "{}");

    assert_eq!(
        find_cavalry_app_from_candidates("", [root.clone()]),
        normalize_path(&root)
    );
}

#[test]
fn non_msi_windows_revision_tracks_immutable_binary_changes_without_faking_version() {
    let temp = tempfile::tempdir().unwrap();
    let root = temp.path().join("Portable Cavalry");
    write(&root.join("Cavalry.exe"), "binary-v1");
    write(&root.join("CavalryFramework.dll"), "framework-v1");
    write(&root.join("CavalryUI.dll"), "ui-v1");
    write(&root.join("assets/Definitions/appStrings.json"), "{}");
    write(&root.join("assets/Definitions/nodeStrings.json"), "{}");

    assert_eq!(read_bundle_version(&root).unwrap(), "");
    let first = read_bundle_revision(&root).unwrap();
    assert!(first.contains("Cavalry.exe=sha256:"));
    assert!(first.contains("CavalryFramework.dll=sha256:"));
    assert!(first.contains("CavalryUI.dll=sha256:"));

    write(&root.join("Cavalry.exe"), "binary-v2");
    let second = read_bundle_revision(&root).unwrap();
    assert_ne!(first, second);

    write(&root.join("CavalryFramework.dll"), "framework-v2");
    let third = read_bundle_revision(&root).unwrap();
    assert_ne!(second, third);

    write(&root.join("CavalryUI.dll"), "ui-v2");
    assert_ne!(third, read_bundle_revision(&root).unwrap());
}

#[test]
fn read_installed_language_defaults_english_when_marker_is_empty() {
    let temp = tempfile::tempdir().unwrap();
    let app_path = temp.path().join("Cavalry.app");
    write(
        &app_path.join("Contents/Resources/cavalry-i18n-lang.txt"),
        "",
    );
    assert_eq!(read_installed_language(&app_path, "zh-Hans"), "en");
}
