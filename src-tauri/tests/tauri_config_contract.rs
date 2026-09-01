/**
 * [INPUT]: 依赖 tauri.conf.json、release.config.json、两份平台配置、主窗/About capability 与 Windows generic/QPA 资源映射
 * [OUTPUT]: 提供公共 400×484 可读窗口、主窗口/About 共享的 macOS 交通灯 Overlay 与标题栏拖动权限、Windows 无系统 caption + DWM shadow、显式 renderer 入口、本地 CSP/预注入 bridge、updater 信任根、平台资源与 NSIS 合同
 * [POS]: src-tauri/tests 的宿主无关配置守门，冻结 Windows generic runtime + QPA delegate 声明并阻止 DYLD/第二套 Qt 混入；派生 DLL 字节由平台构建与 provenance 测试证明
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
use serde_json::Value;
use std::{fs, path::Path};

fn read_json(path: &Path) -> Value {
    serde_json::from_str(&fs::read_to_string(path).unwrap()).unwrap()
}

#[test]
fn tauri_config_disables_global_api_for_the_preloaded_bridge() {
    let manifest_dir = Path::new(env!("CARGO_MANIFEST_DIR"));
    let config = read_json(&manifest_dir.join("tauri.conf.json"));
    assert_eq!(config["app"]["withGlobalTauri"], false);
    assert_eq!(config["build"]["frontendDist"], "../renderer");
    assert!(config["app"]["security"]["csp"]
        .as_str()
        .unwrap()
        .contains("default-src 'self'"));
}

#[test]
fn tauri_window_size_matches_frozen_contract() {
    let manifest_dir = Path::new(env!("CARGO_MANIFEST_DIR"));
    let config = read_json(&manifest_dir.join("tauri.conf.json"));
    let window = &config["app"]["windows"][0];
    assert_eq!(window["width"], 400);
    assert_eq!(window["height"], 484);
    assert_eq!(window["minWidth"], 400);
    assert_eq!(window["minHeight"], 484);
    assert_eq!(window["decorations"], true);
    assert_eq!(window["titleBarStyle"], "Overlay");
    assert_eq!(window["hiddenTitle"], true);
    assert_eq!(window["url"], "./index.html");
}

#[test]
fn tauri_updater_uses_the_final_public_key_and_release_manifest_endpoint() {
    let manifest_dir = Path::new(env!("CARGO_MANIFEST_DIR"));
    let config = read_json(&manifest_dir.join("tauri.conf.json"));
    let release_config = read_json(&manifest_dir.join("../release.config.json"));
    let updater = &config["plugins"]["updater"];
    let expected_endpoint = format!(
        "{}/{}",
        release_config["updater"]["downloadBaseUrl"]
            .as_str()
            .unwrap()
            .trim_end_matches('/'),
        release_config["updater"]["manifestAssetName"]
            .as_str()
            .unwrap()
    );

    assert_eq!(
        updater["pubkey"],
        "dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmlzaWduIHB1YmxpYyBrZXk6IEVDRDdFNUIyRTIzQjk1QzQKUldURWxUdmlzdVhYN05HcFozNDdLeE1mMlAyakdZRWtrRktLNFk1SmpqSmptNDN6U0JmNFJSQ0wK"
    );
    assert_eq!(updater["endpoints"].as_array().unwrap().len(), 1);
    assert_eq!(updater["endpoints"][0], expected_endpoint);
    assert!(expected_endpoint.starts_with("https://"));
}

#[test]
fn tauri_config_declares_capabilities() {
    let manifest_dir = Path::new(env!("CARGO_MANIFEST_DIR"));
    let config = read_json(&manifest_dir.join("tauri.conf.json"));
    let capabilities = read_json(&manifest_dir.join("capabilities/default.json"));
    let about = read_json(&manifest_dir.join("capabilities/about.json"));
    assert_eq!(
        config["app"]["security"]["capabilities"],
        serde_json::json!(["default", "about"])
    );
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
    assert!(capabilities["permissions"]
        .as_array()
        .unwrap()
        .iter()
        .any(|value| value == "core:window:allow-start-dragging"));
    for permission in [
        "core:window:allow-minimize",
        "core:window:allow-toggle-maximize",
        "core:window:allow-close",
    ] {
        assert!(capabilities["permissions"]
            .as_array()
            .unwrap()
            .iter()
            .any(|value| value == permission));
    }
    assert_eq!(about["windows"], serde_json::json!(["about"]));
    assert_eq!(
        about["permissions"],
        serde_json::json!(["core:app:allow-version", "core:window:allow-start-dragging"])
    );
    assert!(!about["permissions"]
        .as_array()
        .unwrap()
        .iter()
        .any(|value| value == "core:window:default" || value == "core:webview:default"));
}

#[test]
fn macos_native_titlebar_alignment_and_resize_reapply_are_frozen() {
    let lib_source = include_str!("../src/lib.rs");
    let chrome_source = include_str!("../src/window_chrome.rs");
    assert!(chrome_source.contains("pub(crate) const TITLEBAR_HEIGHT: f64 = 40.0;"));
    assert!(chrome_source.contains("const MACOS_TRAFFIC_LIGHT_X: f64 = 13.0;"));
    assert!(chrome_source.contains("const MACOS_TRAFFIC_LIGHT_Y: f64 = 22.0;"));
    assert!(
        lib_source.contains("window_chrome::install_macos_traffic_light_alignment(&main_window)?;")
    );
    assert!(chrome_source.contains("tauri::WindowEvent::Resized(_)"));
    assert!(chrome_source.contains("tauri::WindowEvent::ScaleFactorChanged { .. }"));
}

#[test]
fn macos_config_owns_injector_resources_without_overriding_release_signing() {
    let manifest_dir = Path::new(env!("CARGO_MANIFEST_DIR"));
    let config = read_json(&manifest_dir.join("tauri.macos.conf.json"));
    let resources = config["bundle"]["resources"].as_object().unwrap();
    let dmg = &config["bundle"]["macOS"]["dmg"];

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
    assert_eq!(dmg["windowPosition"]["x"], 200);
    assert_eq!(dmg["windowPosition"]["y"], 120);
    assert_eq!(dmg["windowSize"]["width"], 800);
    assert_eq!(dmg["windowSize"]["height"], 476);
    assert!(config["bundle"]["macOS"]
        .as_object()
        .unwrap()
        .get("signingIdentity")
        .is_none());
}

#[test]
fn windows_config_uses_nsis_icon_languages_and_windows_runtime_only() {
    let manifest_dir = Path::new(env!("CARGO_MANIFEST_DIR"));
    let shared_config = read_json(&manifest_dir.join("tauri.conf.json"));
    let config = read_json(&manifest_dir.join("tauri.windows.conf.json"));
    let resources = config["bundle"]["resources"].as_object().unwrap();
    let nsis = &config["bundle"]["windows"]["nsis"];
    let window = &config["app"]["windows"][0];
    let shared_window = &shared_config["app"]["windows"][0];

    assert_eq!(
        config["build"]["beforeBuildCommand"],
        "npm run prepare:tauri:windows-bundle"
    );
    for key in [
        "label",
        "title",
        "url",
        "useHttpsScheme",
        "width",
        "height",
        "minWidth",
        "minHeight",
        "resizable",
        "center",
    ] {
        assert_eq!(window[key], shared_window[key], "Windows {key} drifted");
    }
    assert_eq!(window["decorations"], false);
    assert_eq!(window["shadow"], true);
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
    assert_eq!(
        resources["../injector/windows/qpa/qwindows.dll"],
        "injector/windows/qpa/qwindows.dll"
    );
    assert_eq!(nsis["installerHooks"], "nsis-hooks.nsh");
    let custom_languages = nsis["customLanguageFiles"].as_object().unwrap();
    for (language, relative_path) in [
        ("English", "nsis-languages/English.nsh"),
        ("SimpChinese", "nsis-languages/SimpChinese.nsh"),
        ("TradChinese", "nsis-languages/TradChinese.nsh"),
        ("Japanese", "nsis-languages/Japanese.nsh"),
    ] {
        assert_eq!(custom_languages[language], relative_path);
        assert!(manifest_dir.join(relative_path).is_file());
    }
    assert_eq!(
        nsis["languages"],
        serde_json::json!(["English", "SimpChinese", "TradChinese", "Japanese"])
    );
    assert_eq!(nsis["displayLanguageSelector"], false);
    assert_eq!(nsis["installerIcon"], "icons/icon.ico");
    assert!(manifest_dir.join("icons/icon.ico").is_file());
    assert!(nsis.get("headerImage").is_none());
    assert!(nsis.get("sidebarImage").is_none());
    assert!(resources.keys().all(|key| !key.ends_with(".dylib")));
    assert!(resources
        .iter()
        .all(|(source, destination)| !source.contains("Qt6")
            && !destination.as_str().unwrap_or("").contains("Qt6")));
    // generic/QPA 都是 beforeBuildCommand 在 Windows 生成的忽略产物；
    // 宿主无关配置合同只锁定映射与生成命令，provenance/安装态 smoke
    // 才在构建后证明真实字节、架构和摘要。
}

#[test]
fn windows_uninstaller_separates_control_plane_removal_from_translation_cleanup() {
    let manifest_dir = Path::new(env!("CARGO_MANIFEST_DIR"));
    let hooks = fs::read_to_string(manifest_dir.join("nsis-hooks.nsh")).unwrap();

    assert!(hooks.contains("NSIS_HOOK_PREUNINSTALL"));
    assert!(hooks.contains("UninstPage custom"));
    assert!(hooks.contains("NSD_CreateCheckbox"));
    assert!(hooks.contains("BST_UNCHECKED"));
    assert!(!hooks.contains("MB_YESNOCANCEL"));
    assert!(hooks.contains("--uninstall-restore-english"));
    assert!(hooks.contains("$UpdateMode = 1"));
    assert!(hooks.contains("$PassiveMode = 1"));
    assert!(hooks.contains("${Silent}"));
    assert!(hooks.contains("ExecWait"));
    assert!(hooks.contains("Abort"));
    let options_function = hooks
        .split_once("Function un.CavalryI18nUninstallOptions")
        .and_then(|(_, tail)| tail.split_once("FunctionEnd"))
        .map(|(body, _)| body)
        .expect("missing uninstaller options function");
    assert!(options_function.contains("${Silent}"));
    assert!(options_function.contains("${GetOptions} $CMDLINE \"/P\""));
    assert!(options_function.contains("${GetOptions} $CMDLINE \"/UPDATE\""));
    assert!(!options_function.contains("$UpdateMode"));
    assert!(!options_function.contains("$PassiveMode"));
    assert!(!options_function.contains("${BUNDLEID}"));
    assert!(!options_function.contains("IfFileExists"));
    assert!(!options_function.contains("UNINSTALL_APP_DATA_CHECKBOX"));
    assert!(!hooks.contains("CreateTimer"));
    assert!(!hooks.contains("DecorateConfirmPage"));
    assert!(!hooks.contains("WM_SETTEXT"));
    for (relative_path, expected) in [
        (
            "nsis-languages/English.nsh",
            "LangString deleteAppData ${LANG_ENGLISH} \"Delete Switcher application data (Switcher settings only)\"",
        ),
        (
            "nsis-languages/SimpChinese.nsh",
            "LangString deleteAppData ${LANG_SIMPCHINESE} \"删除切换器应用数据（仅切换器设置）\"",
        ),
        (
            "nsis-languages/TradChinese.nsh",
            "LangString deleteAppData ${LANG_TRADCHINESE} \"刪除切換器應用程式資料（僅切換器設定）\"",
        ),
        (
            "nsis-languages/Japanese.nsh",
            "LangString deleteAppData ${LANG_JAPANESE} \"スイッチャーのアプリデータを削除（スイッチャー設定のみ）\"",
        ),
    ] {
        assert!(
            fs::read_to_string(manifest_dir.join(relative_path))
                .unwrap()
                .contains(expected),
            "missing localized app-data checkbox copy in {relative_path}"
        );
    }
    for language_id in ["1033", "2052", "1028", "1041"] {
        assert!(
            hooks.contains(language_id),
            "missing uninstall copy for LCID {language_id}"
        );
    }
}
