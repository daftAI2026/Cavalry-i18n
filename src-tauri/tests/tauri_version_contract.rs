/**
 * [INPUT]: 依赖 package.json 与 src-tauri/Cargo.toml 的版本声明
 * [OUTPUT]: 对外提供 Tauri v2 minor pinning contract test
 * [POS]: src-tauri/tests 的版本守门，阻止 npm 与 Rust Tauri 依赖漂移
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
use serde_json::Value;
use std::{fs, path::Path};

fn dependency_version(cargo_toml: &str, name: &str) -> String {
    let prefix = format!("{name} = ");
    let line = cargo_toml
        .lines()
        .map(str::trim)
        .find(|line| line.starts_with(&prefix))
        .unwrap_or_else(|| panic!("{name} dependency missing"));
    let declaration = line.trim_start_matches(&prefix).trim();
    if let Some(version) = declaration
        .strip_prefix('"')
        .and_then(|rest| rest.split('"').next())
    {
        return version.to_string();
    }
    let version_key = declaration
        .find("version")
        .unwrap_or_else(|| panic!("{name} version field missing"));
    declaration[version_key..]
        .split('"')
        .nth(1)
        .unwrap_or_else(|| panic!("{name} version value missing"))
        .to_string()
}

#[test]
fn tauri_versions_are_pinned_to_one_v2_minor() {
    let manifest_dir = Path::new(env!("CARGO_MANIFEST_DIR"));
    let repo_root = manifest_dir.parent().unwrap();
    let package_json: Value =
        serde_json::from_str(&fs::read_to_string(repo_root.join("package.json")).unwrap()).unwrap();
    let cargo_toml = fs::read_to_string(manifest_dir.join("Cargo.toml")).unwrap();

    let deps = package_json["dependencies"].as_object().unwrap();
    let dev_deps = package_json["devDependencies"].as_object().unwrap();
    assert_eq!(deps["@tauri-apps/api"], "2.10.1");
    assert_eq!(dev_deps["@tauri-apps/cli"], "2.10.1");
    assert_eq!(dependency_version(&cargo_toml, "tauri"), "=2.10.3");
    assert_eq!(dependency_version(&cargo_toml, "tauri-build"), "=2.5.6");
    assert!(!dependency_version(&cargo_toml, "tauri").starts_with('^'));
    assert!(!dependency_version(&cargo_toml, "tauri-build").starts_with('^'));
}
