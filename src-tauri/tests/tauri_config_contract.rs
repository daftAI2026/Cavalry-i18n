/**
 * [INPUT]: 依赖 src-tauri/tauri.conf.json 与 capabilities/default.json
 * [OUTPUT]: 对外提供 Tauri 窗口、renderer、resources、capabilities 配置 contract tests
 * [POS]: src-tauri/tests 的配置守门，确保 vanilla renderer bridge 和打包资源不漂移
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
use serde_json::Value;
use std::{fs, path::Path};

fn read_json(path: &Path) -> Value {
    serde_json::from_str(&fs::read_to_string(path).unwrap()).unwrap()
}

#[test]
fn tauri_config_enables_global_api_for_vanilla_bridge() {
    let manifest_dir = Path::new(env!("CARGO_MANIFEST_DIR"));
    let config = read_json(&manifest_dir.join("tauri.conf.json"));
    assert_eq!(config["app"]["withGlobalTauri"], true);
    assert_eq!(
        config["build"]["frontendDist"],
        "../desktop-patcher/renderer"
    );
}

#[test]
fn tauri_window_size_matches_electron() {
    let manifest_dir = Path::new(env!("CARGO_MANIFEST_DIR"));
    let config = read_json(&manifest_dir.join("tauri.conf.json"));
    let window = &config["app"]["windows"][0];
    assert_eq!(window["width"], 480);
    assert_eq!(window["height"], 500);
    assert_eq!(window["minWidth"], 420);
    assert_eq!(window["minHeight"], 500);
    assert_eq!(window["url"], "index.html");
}

#[test]
fn tauri_config_declares_capabilities_and_resource_access() {
    let manifest_dir = Path::new(env!("CARGO_MANIFEST_DIR"));
    let config = read_json(&manifest_dir.join("tauri.conf.json"));
    let resources = config["bundle"]["resources"].as_object().unwrap();
    assert_eq!(resources["../languages"], "languages");
    assert_eq!(
        resources["../desktop-patcher/injector/libCavalryTranslatorInjector.dylib"],
        "injector/libCavalryTranslatorInjector.dylib"
    );

    let capabilities = read_json(&manifest_dir.join("capabilities/default.json"));
    assert!(capabilities["windows"]
        .as_array()
        .unwrap()
        .iter()
        .any(|value| value == "main"));
    assert!(capabilities["permissions"]
        .as_array()
        .unwrap()
        .iter()
        .any(|value| value == "core:default"));
}
