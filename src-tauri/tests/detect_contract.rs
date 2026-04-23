/**
 * [INPUT]: 依赖 cavalry_i18n_tauri::detect 的路径探测、版本读取与 marker 读取能力
 * [OUTPUT]: 对外提供默认路径、版本读取与已安装语言恢复 contract tests
 * [POS]: src-tauri/tests 的探测守门，确保 get_status 与状态恢复语义贴合 Electron
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
use cavalry_i18n_tauri::detect::{
    default_app_candidates, find_cavalry_app, read_bundle_version, read_installed_language,
};
use std::{env, fs, path::Path};

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
    assert_eq!(find_cavalry_app(&app_path.to_string_lossy()), app_path);
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
}

#[test]
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
fn read_installed_language_defaults_english_when_marker_is_empty() {
    let temp = tempfile::tempdir().unwrap();
    let app_path = temp.path().join("Cavalry.app");
    write(
        &app_path
            .join("Contents/Resources/cavalry-i18n-lang.txt"),
        "",
    );
    assert_eq!(read_installed_language(&app_path, "zh-Hans"), "en");
}
