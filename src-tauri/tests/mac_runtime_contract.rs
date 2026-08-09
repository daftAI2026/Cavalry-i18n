/**
 * [INPUT]: 依赖 cavalry_i18n_tauri::mac_runtime 的 wrapper、Info.plist 改写与 runtime pair 能力
 * [OUTPUT]: 对外提供 launcher、wrapper-before-Info 首装 gate、marker、injector 目标路径、trusted Info.plist 与 mixed-environment ownership contract tests
 * [POS]: src-tauri/tests 的 runtime 守门，确保 macOS runtime 补丁副作用路径/安全发布顺序稳定且漂移的 live plist/调用者环境不能污染受控模型
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
use cavalry_i18n_tauri::mac_runtime::{
    build_launch_wrapper, build_runtime_pairs, build_runtime_pairs_from_trusted_info_plist,
    build_wrapped_info_plist, INJECTOR_DYLIB_NAME, LANG_MARKER_NAME, WRAPPER_EXECUTABLE_NAME,
};
use std::{fs, path::Path};

#[cfg(unix)]
use std::os::unix::fs::PermissionsExt;

fn write(path: &Path, value: &str) {
    fs::create_dir_all(path.parent().unwrap()).unwrap();
    fs::write(path, value).unwrap();
}

#[test]
fn build_launch_wrapper_matches_runtime_contract() {
    let wrapper = build_launch_wrapper();
    assert!(wrapper.contains("DYLD_INSERT_LIBRARIES"));
    assert!(wrapper.contains("CAVALRY_I18N_LANG"));
    assert!(wrapper.contains(LANG_MARKER_NAME));
    assert!(wrapper.contains(INJECTOR_DYLIB_NAME));
    assert!(wrapper.contains("strip_owned_injector"));
    assert!(wrapper.contains("unset CAVALRY_I18N_LANG"));
    assert!(wrapper.contains("macos-apply-transaction"));
    assert!(wrapper.contains("CAVALRY_I18N_STATE_DIR"));
    assert!(wrapper.contains("transaction is sealed"));
}

#[test]
fn rewrite_info_plist_executable_to_wrapper() {
    let source = br#"<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict><key>CFBundleExecutable</key><string>Cavalry</string></dict></plist>"#;
    let next = build_wrapped_info_plist(source).unwrap();
    let value = plist::Value::from_reader(std::io::Cursor::new(next)).unwrap();
    assert_eq!(
        value
            .as_dictionary()
            .unwrap()
            .get("CFBundleExecutable")
            .and_then(plist::Value::as_string),
        Some("CavalryLauncher")
    );
}

#[test]
fn runtime_pairs_include_plist_wrapper_injector_marker() {
    let temp = tempfile::tempdir().unwrap();
    let app = temp.path().join("Cavalry.app");
    let staging = temp.path().join("stage");
    let injector = temp
        .path()
        .join("injector/libCavalryTranslatorInjector.dylib");
    write(
        &app.join("Contents/Info.plist"),
        "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<plist version=\"1.0\"><dict><key>CFBundleExecutable</key><string>Cavalry</string></dict></plist>",
    );
    write(&injector, "injector");

    let pairs = build_runtime_pairs(&app, "zh-Hans", &staging, &injector).unwrap();
    assert_eq!(pairs.len(), 4);
    assert!(pairs[0]
        .dst
        .ends_with(Path::new("Contents/MacOS").join(WRAPPER_EXECUTABLE_NAME)));
    assert!(pairs[1].dst.ends_with(Path::new("Contents/Info.plist")));
    assert!(pairs
        .iter()
        .any(|pair| pair.dst.ends_with(Path::new("Contents/Info.plist"))));
    assert!(pairs.iter().any(|pair| pair
        .dst
        .ends_with(Path::new("Contents/MacOS").join(WRAPPER_EXECUTABLE_NAME))));
    assert!(pairs.iter().any(|pair| pair
        .dst
        .ends_with(Path::new("Contents/Frameworks").join(INJECTOR_DYLIB_NAME))));
    assert!(pairs.iter().any(|pair| pair
        .dst
        .ends_with(Path::new("Contents/Resources").join(LANG_MARKER_NAME))));
    let wrapper = pairs
        .iter()
        .find(|pair| {
            pair.dst
                .ends_with(Path::new("Contents/MacOS").join(WRAPPER_EXECUTABLE_NAME))
        })
        .unwrap();
    #[cfg(unix)]
    assert_eq!(
        fs::metadata(&wrapper.src).unwrap().permissions().mode() & 0o777,
        0o755
    );
}

#[test]
fn trusted_info_plist_bytes_are_the_only_source_for_managed_runtime_pairs() {
    let temp = tempfile::tempdir().unwrap();
    let app = temp.path().join("Cavalry.app");
    let staging = temp.path().join("stage");
    let injector = temp
        .path()
        .join("injector/libCavalryTranslatorInjector.dylib");
    write(
        &app.join("Contents/Info.plist"),
        "<?xml version=\"1.0\"?><plist version=\"1.0\"><dict><key>CFBundleExecutable</key><string>Cavalry</string><key>CFBundleIdentifier</key><string>drifted.live</string></dict></plist>",
    );
    write(&injector, "injector");
    let trusted = br#"<?xml version="1.0"?><plist version="1.0"><dict><key>CFBundleExecutable</key><string>Cavalry</string><key>CFBundleIdentifier</key><string>official.baseline</string></dict></plist>"#;

    let pairs =
        build_runtime_pairs_from_trusted_info_plist(&app, "zh-Hans", &staging, &injector, trusted)
            .unwrap();
    let info = pairs
        .iter()
        .find(|pair| pair.dst.ends_with(Path::new("Contents/Info.plist")))
        .unwrap();
    let value =
        plist::Value::from_reader(std::io::Cursor::new(fs::read(&info.src).unwrap())).unwrap();
    assert_eq!(
        value
            .as_dictionary()
            .unwrap()
            .get("CFBundleIdentifier")
            .and_then(plist::Value::as_string),
        Some("official.baseline")
    );
}
