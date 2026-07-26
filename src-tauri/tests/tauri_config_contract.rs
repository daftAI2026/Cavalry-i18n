/**
 * [INPUT]: 依赖 tauri.conf.json、tauri.macos.conf.json、tauri.windows.conf.json 与 capabilities/default.json
 * [OUTPUT]: 对外提供公共窗口契约、macOS injector bundle 与 Windows NSIS 资源隔离/provenance hook contract tests
 * [POS]: src-tauri/tests 的配置守门，确保 Tauri 平台合并配置不会把 DYLD 构建链带入 Windows，并冻结 Windows bundle 前置入口
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
    assert_eq!(config["build"]["frontendDist"], "../renderer");
}

#[test]
fn tauri_window_size_matches_frozen_contract() {
    let manifest_dir = Path::new(env!("CARGO_MANIFEST_DIR"));
    let config = read_json(&manifest_dir.join("tauri.conf.json"));
    let window = &config["app"]["windows"][0];
    assert_eq!(window["width"], 480);
    assert_eq!(window["height"], 528);
    assert_eq!(window["minWidth"], 420);
    assert_eq!(window["minHeight"], 528);
    assert_eq!(window["url"], "index.html");
}

#[test]
fn tauri_config_declares_capabilities() {
    let manifest_dir = Path::new(env!("CARGO_MANIFEST_DIR"));
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

#[test]
fn macos_config_owns_injector_build_resources_and_signing() {
    let manifest_dir = Path::new(env!("CARGO_MANIFEST_DIR"));
    let config = read_json(&manifest_dir.join("tauri.macos.conf.json"));
    let resources = config["bundle"]["resources"].as_object().unwrap();

    assert_eq!(
        config["build"]["beforeBuildCommand"],
        "npm run build:injector"
    );
    assert!(config["bundle"]["targets"]
        .as_array()
        .unwrap()
        .iter()
        .any(|value| value == "dmg"));
    assert_eq!(resources["../languages"], "languages");
    assert_eq!(
        resources["../injector/libCavalryTranslatorInjector.dylib"],
        "injector/libCavalryTranslatorInjector.dylib"
    );
    assert_eq!(config["bundle"]["macOS"]["signingIdentity"], "-");
}

#[test]
fn windows_config_uses_nsis_icon_languages_and_windows_runtime_only() {
    let manifest_dir = Path::new(env!("CARGO_MANIFEST_DIR"));
    let config = read_json(&manifest_dir.join("tauri.windows.conf.json"));
    let resources = config["bundle"]["resources"].as_object().unwrap();

    assert_eq!(
        config["build"]["beforeBuildCommand"],
        "npm run prepare:tauri:windows-bundle"
    );
    assert!(config["bundle"]["targets"]
        .as_array()
        .unwrap()
        .iter()
        .any(|value| value == "nsis"));
    assert!(config["bundle"]["icon"]
        .as_array()
        .unwrap()
        .iter()
        .any(|value| value == "icons/icon.ico"));
    assert_eq!(resources["../languages"], "languages");
    assert_eq!(
        resources["../injector/windows/generic/cavalryi18n.dll"],
        "injector/windows/generic/cavalryi18n.dll"
    );
    assert!(resources.keys().all(|key| !key.ends_with(".dylib")));
}
