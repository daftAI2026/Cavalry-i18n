/**
 * [INPUT]: 依赖 tauri.conf.json、两份平台配置、capabilities/default.json 与 Windows generic/QPA 资源映射
 * [OUTPUT]: 提供公共窗口、macOS injector、Windows NSIS 双 DLL/生成命令/四语卸载双语义 hook/系统语言与品牌图标合同
 * [POS]: src-tauri/tests 的宿主无关配置守门，冻结 Windows generic runtime + QPA delegate 声明并阻止 DYLD/第二套 Qt 混入；派生 DLL 字节由平台构建与 provenance 测试证明
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
    let nsis = &config["bundle"]["windows"]["nsis"];

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
