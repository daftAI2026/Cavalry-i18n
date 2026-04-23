/**
 * [INPUT]: 依赖 cavalry_i18n_tauri::mac_runtime 的 wrapper、Info.plist 改写与 runtime pair 能力
 * [OUTPUT]: 对外提供 launcher、marker 与 injector 目标路径 contract tests
 * [POS]: src-tauri/tests 的 runtime 守门，确保 macOS 补丁副作用路径与 Electron 一致
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
use cavalry_i18n_tauri::mac_runtime::{
    build_launch_wrapper, build_runtime_pairs, build_wrapped_info_plist, INJECTOR_DYLIB_NAME,
    LANG_MARKER_NAME, WRAPPER_EXECUTABLE_NAME,
};
use std::{fs, path::Path};

#[cfg(unix)]
use std::os::unix::fs::PermissionsExt;

fn write(path: &Path, value: &str) {
    fs::create_dir_all(path.parent().unwrap()).unwrap();
    fs::write(path, value).unwrap();
}

#[test]
fn build_launch_wrapper_matches_electron() {
    let wrapper = build_launch_wrapper();
    assert!(wrapper.contains("DYLD_INSERT_LIBRARIES"));
    assert!(wrapper.contains("CAVALRY_I18N_LANG"));
    assert!(wrapper.contains(LANG_MARKER_NAME));
    assert!(wrapper.contains(INJECTOR_DYLIB_NAME));
}

#[test]
fn rewrite_info_plist_executable_to_wrapper() {
    let source = "<key>CFBundleExecutable</key><string>Cavalry</string>";
    let next = build_wrapped_info_plist(source).unwrap();
    assert!(next.contains("<string>CavalryLauncher</string>"));
}

#[test]
fn runtime_pairs_include_plist_wrapper_injector_marker() {
    let temp = tempfile::tempdir().unwrap();
    let app = temp.path().join("Cavalry.app");
    let staging = temp.path().join("stage");
    let injector = temp.path().join("injector/libCavalryTranslatorInjector.dylib");
    write(
        &app.join("Contents/Info.plist"),
        "<key>CFBundleExecutable</key><string>Cavalry</string>",
    );
    write(&injector, "injector");

    let pairs = build_runtime_pairs(&app, "zh-Hans", &staging, &injector).unwrap();
    assert_eq!(pairs.len(), 4);
    assert!(pairs
        .iter()
        .any(|pair| pair.dst.ends_with(Path::new("Contents/Info.plist"))));
    assert!(pairs.iter().any(|pair| pair
        .dst
        .ends_with(Path::new("Contents/MacOS").join(WRAPPER_EXECUTABLE_NAME))));
    assert!(pairs.iter().any(|pair| pair
        .dst
        .ends_with(Path::new("Contents/Frameworks").join(INJECTOR_DYLIB_NAME))));
    assert!(pairs
        .iter()
        .any(|pair| pair.dst.ends_with(Path::new("Contents/Resources").join(LANG_MARKER_NAME))));
    let wrapper = pairs
        .iter()
        .find(|pair| pair
            .dst
            .ends_with(Path::new("Contents/MacOS").join(WRAPPER_EXECUTABLE_NAME)))
        .unwrap();
    #[cfg(unix)]
    assert_eq!(
        fs::metadata(&wrapper.src).unwrap().permissions().mode() & 0o777,
        0o755
    );
}
