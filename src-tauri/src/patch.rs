/**
 * [INPUT]: 依赖 install::InstallLayout、serde_json 与 std fs/path，读取 Cavalry 跨平台 assets
 * [OUTPUT]: 对外提供资源映射、English 内容证明/快照、直接复制计划与只替换字符串且保留安装元数据/版本增量的覆盖合并计划
 * [POS]: src-tauri/src 的 JSON patch 核心，以 string-only keyed overlay 同时守住当前/未来 Cavalry 安装元数据与 clean-English 采集边界
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
use std::{
    collections::HashMap,
    fs,
    path::{Path, PathBuf},
};

use serde_json::Value;

use crate::{install::InstallLayout, state::EnglishSnapshotProvenance};

/// Static map of all non-plugin file pairs.
/// Each tuple: (language_relative_path, asset_relative_path)
/// relative to `languages/{lang}/` and `Contents/assets/` respectively.
pub const CORE_MAP: [(&str, &str); 14] = [
    ("appStrings.json", "Definitions/appStrings.json"),
    ("nodeStrings.json", "Definitions/nodeStrings.json"),
    ("onboarding.json", "Learn/onboarding.json"),
    ("tips.json", "Learn/tips.json"),
    (
        "Definitions/nodeDefinitions.json",
        "Definitions/nodeDefinitions.json",
    ),
    (
        "Definitions/systemPresets.json",
        "Definitions/systemPresets.json",
    ),
    ("Learn/Guides/guides.json", "Learn/Guides/guides.json"),
    ("Learn/Guides/strings.json", "Learn/Guides/strings.json"),
    (
        "MetaData/api_function_metadata.json",
        "MetaData/api_function_metadata.json",
    ),
    (
        "MetaData/core_api_function_metadata.json",
        "MetaData/core_api_function_metadata.json",
    ),
    (
        "MetaData/gui_api_function_metadata.json",
        "MetaData/gui_api_function_metadata.json",
    ),
    (
        "MetaData/widget_api_function_metadata.json",
        "MetaData/widget_api_function_metadata.json",
    ),
    ("Style/layout.json", "Style/layout.json"),
    ("Style/theme.json", "Style/theme.json"),
];

/// Static map of known plugin definition file pairs.
/// Each tuple: (language_relative_path, asset_relative_path)
pub const PLUGIN_DEFINITION_MAP: [(&str, &str); 12] = [
    (
        "plugins/bilateralBlurFilterDefinitions.json",
        "Plugins/Bilateral Blur Filter/definitions.json",
    ),
    (
        "plugins/boxBlurFilterDefinitions.json",
        "Plugins/Box Blur Filter/definitions.json",
    ),
    (
        "plugins/bulgeFilterDefinitions.json",
        "Plugins/Bulge Filter/definitions.json",
    ),
    (
        "plugins/chromaKeyFilterDefinitions.json",
        "Plugins/Chroma Key Filter/definitions.json",
    ),
    (
        "plugins/directionalBlurFilterDefinitions.json",
        "Plugins/Directional Blur Filter/definitions.json",
    ),
    (
        "plugins/erosionFilterDefinitions.json",
        "Plugins/Erosion Filter/definitions.json",
    ),
    (
        "plugins/gaussianBlurFilterDefinitions.json",
        "Plugins/Gaussian Blur Filter/definitions.json",
    ),
    (
        "plugins/grainFilterDefinitions.json",
        "Plugins/Grain Filter/definitions.json",
    ),
    (
        "plugins/lightSweepFilterDefinitions.json",
        "Plugins/Light Sweep Filter/definitions.json",
    ),
    (
        "plugins/polarCoordinatesFilterDefinitions.json",
        "Plugins/Polar Coordinates Filter/definitions.json",
    ),
    (
        "plugins/spheriseFilterDefinitions.json",
        "Plugins/Spherise Filter/definitions.json",
    ),
    (
        "plugins/zoomBlurFilterDefinitions.json",
        "Plugins/Zoom Blur Filter/definitions.json",
    ),
];

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PluginInfo {
    pub folder_name: String,
    pub camel_name: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CopyPair {
    pub src: PathBuf,
    pub dst: PathBuf,
}

pub fn assets_root(app_path: &Path) -> PathBuf {
    InstallLayout::from_root(app_path).assets_root
}

pub fn to_camel_case(name: &str) -> String {
    let words = name
        .split_whitespace()
        .map(str::trim)
        .filter(|word| !word.is_empty())
        .collect::<Vec<_>>();
    if words.is_empty() {
        return String::new();
    }
    let mut output = lowercase_first(words[0]);
    for word in words.iter().skip(1) {
        output.push_str(&uppercase_first(word));
    }
    output
}

fn lowercase_first(value: &str) -> String {
    let mut chars = value.chars();
    match chars.next() {
        Some(first) => first.to_lowercase().chain(chars).collect(),
        None => String::new(),
    }
}

fn uppercase_first(value: &str) -> String {
    let mut chars = value.chars();
    match chars.next() {
        Some(first) => first.to_uppercase().chain(chars).collect(),
        None => String::new(),
    }
}

pub fn discover_plugins(app_path: &Path) -> Vec<PluginInfo> {
    let plugins_dir = assets_root(app_path).join("Plugins");
    let mut plugins = match fs::read_dir(&plugins_dir) {
        Ok(entries) => entries
            .flatten()
            .filter(|entry| entry.file_type().map(|kind| kind.is_dir()).unwrap_or(false))
            .filter_map(|entry| entry.file_name().into_string().ok())
            .filter(|folder_name| plugins_dir.join(folder_name).join("strings.json").exists())
            .map(|folder_name| PluginInfo {
                camel_name: to_camel_case(&folder_name),
                folder_name,
            })
            .collect::<Vec<_>>(),
        Err(_) => Vec::new(),
    };
    plugins.sort_by(|left, right| left.folder_name.cmp(&right.folder_name));
    plugins
}

pub fn extract_english(app_path: &Path, output_dir: &Path) -> Result<usize, String> {
    let root = assets_root(app_path);
    let _ = fs::remove_dir_all(output_dir);
    fs::create_dir_all(output_dir).map_err(|error| error.to_string())?;

    let mut count = 0;
    for (lang_rel, asset_rel) in CORE_MAP {
        let src = root.join(asset_rel);
        let dst = output_dir.join(lang_rel);
        if let Some(parent) = dst.parent() {
            fs::create_dir_all(parent).map_err(|error| error.to_string())?;
        }
        fs::copy(&src, &dst).map_err(|error| error.to_string())?;
        count += 1;
    }

    for (lang_rel, asset_rel) in PLUGIN_DEFINITION_MAP {
        let src = root.join(asset_rel);
        let dst = output_dir.join(lang_rel);
        if !src.exists() {
            continue;
        }
        if let Some(parent) = dst.parent() {
            fs::create_dir_all(parent).map_err(|error| error.to_string())?;
        }
        fs::copy(&src, &dst).map_err(|error| error.to_string())?;
        count += 1;
    }

    let plugins_output_dir = output_dir.join("plugins");
    fs::create_dir_all(&plugins_output_dir).map_err(|error| error.to_string())?;
    for plugin in discover_plugins(app_path) {
        fs::copy(
            root.join("Plugins")
                .join(&plugin.folder_name)
                .join("strings.json"),
            plugins_output_dir.join(format!("{}.json", plugin.camel_name)),
        )
        .map_err(|error| error.to_string())?;
        count += 1;
    }
    Ok(count)
}

pub fn build_copy_pairs(source_dir: &Path, app_path: &Path) -> Vec<CopyPair> {
    let root = assets_root(app_path);
    let mut pairs = Vec::new();

    for (lang_rel, asset_rel) in CORE_MAP {
        let source_path = source_dir.join(lang_rel);
        if source_path.exists() {
            pairs.push(CopyPair {
                src: source_path,
                dst: root.join(asset_rel),
            });
        }
    }

    for (lang_rel, asset_rel) in PLUGIN_DEFINITION_MAP {
        let source_path = source_dir.join(lang_rel);
        if source_path.exists() {
            pairs.push(CopyPair {
                src: source_path,
                dst: root.join(asset_rel),
            });
        }
    }

    for plugin in discover_plugins(app_path) {
        let source_path = source_dir
            .join("plugins")
            .join(format!("{}.json", plugin.camel_name));
        if source_path.exists() {
            pairs.push(CopyPair {
                src: source_path,
                dst: root
                    .join("Plugins")
                    .join(plugin.folder_name)
                    .join("strings.json"),
            });
        }
    }
    pairs
}

pub fn build_overlay_pairs(
    source_dir: &Path,
    installed_english_dir: &Path,
    app_path: &Path,
    overlay_dir: &Path,
) -> Result<Vec<CopyPair>, String> {
    let pairs = build_copy_pairs(source_dir, app_path);
    let _ = fs::remove_dir_all(overlay_dir);
    fs::create_dir_all(overlay_dir).map_err(|error| error.to_string())?;

    pairs
        .into_iter()
        .enumerate()
        .map(|(index, pair)| {
            let relative = pair
                .src
                .strip_prefix(source_dir)
                .map_err(|_| format!("Language source escaped its root: {}", pair.src.display()))?;
            let installed_english_path = installed_english_dir.join(relative);
            if !installed_english_path.is_file() {
                return Err(format!(
                    "Installed English snapshot is missing {}",
                    installed_english_path.display()
                ));
            }

            let installed_english = read_json(&installed_english_path)?;
            let translation = read_json(&pair.src)?;
            let merged = merge_translation_overlay(&installed_english, &translation);
            let file_name = pair
                .src
                .file_name()
                .ok_or_else(|| format!("Missing file name: {}", pair.src.display()))?;
            let overlay_path = overlay_dir.join(format!("{index}-{}", file_name.to_string_lossy()));
            let bytes = serde_json::to_vec_pretty(&merged).map_err(|error| error.to_string())?;
            fs::write(&overlay_path, bytes).map_err(|error| {
                format!(
                    "Could not write merged translation {}: {error}",
                    overlay_path.display()
                )
            })?;
            let permissions = fs::metadata(&installed_english_path)
                .map_err(|error| error.to_string())?
                .permissions();
            fs::set_permissions(&overlay_path, permissions).map_err(|error| error.to_string())?;
            Ok(CopyPair {
                src: overlay_path,
                dst: pair.dst,
            })
        })
        .collect()
}

pub fn merge_translation_overlay(installed: &Value, translation: &Value) -> Value {
    match (installed, translation) {
        (Value::Object(installed), Value::Object(translation)) => {
            let mut merged = installed.clone();
            for (key, installed_value) in installed {
                if let Some(translated_value) = translation.get(key) {
                    merged.insert(
                        key.clone(),
                        merge_translation_overlay(installed_value, translated_value),
                    );
                }
            }
            Value::Object(merged)
        }
        (Value::Array(installed), Value::Array(translation)) => {
            let identities = partial_identity_map(translation);
            let positional_fallback_safe =
                identity_positions(installed) == identity_positions(translation);
            Value::Array(
                installed
                    .iter()
                    .enumerate()
                    .map(|(index, installed_value)| {
                        if let Some(identity) = item_identity(installed_value) {
                            return identities
                                .get(&identity)
                                .map(|translated| {
                                    merge_translation_overlay(installed_value, translated)
                                })
                                .unwrap_or_else(|| installed_value.clone());
                        }

                        if !positional_fallback_safe {
                            return installed_value.clone();
                        }
                        translation
                            .get(index)
                            .filter(|translated| item_identity(translated).is_none())
                            .filter(|translated| compatible_shape(installed_value, translated))
                            .map(|translated| {
                                merge_translation_overlay(installed_value, translated)
                            })
                            .unwrap_or_else(|| installed_value.clone())
                    })
                    .collect(),
            )
        }
        (Value::String(_), Value::String(_)) => translation.clone(),
        _ => installed.clone(),
    }
}

pub fn install_matches_language_source(source_dir: &Path, app_path: &Path) -> Result<bool, String> {
    ensure_complete_core_source(source_dir)?;

    let root = assets_root(app_path);
    let core_destinations = CORE_MAP
        .iter()
        .map(|(_, asset_relative)| root.join(asset_relative))
        .collect::<std::collections::HashSet<_>>();

    for pair in build_copy_pairs(source_dir, app_path) {
        if !pair.dst.is_file() {
            if core_destinations.contains(&pair.dst) {
                return Err(format!(
                    "Cavalry installation is missing required English proof input {}",
                    pair.dst.display()
                ));
            }
            continue;
        }
        let installed = read_json(&pair.dst)?;
        let candidate = read_json(&pair.src)?;
        if merge_translation_overlay(&installed, &candidate) != installed {
            return Ok(false);
        }
    }
    Ok(true)
}

pub fn snapshot_matches_language_source(
    source_dir: &Path,
    state_dir: &Path,
    app_path: &Path,
) -> Result<bool, String> {
    ensure_complete_core_source(source_dir)?;
    if !has_english_snapshot(state_dir, app_path) {
        return Ok(false);
    }
    let snapshot_dir = state_dir.join("en");

    for pair in build_copy_pairs(source_dir, app_path) {
        let relative = pair.src.strip_prefix(source_dir).map_err(|_| {
            format!(
                "English language source escaped its root: {}",
                pair.src.display()
            )
        })?;
        let snapshot = snapshot_dir.join(relative);
        if !snapshot.is_file() {
            if pair.dst.is_file() {
                return Ok(false);
            }
            continue;
        }
        let installed = read_json(&snapshot)?;
        let candidate = read_json(&pair.src)?;
        if merge_translation_overlay(&installed, &candidate) != installed {
            return Ok(false);
        }
    }
    Ok(true)
}

fn ensure_complete_core_source(source_dir: &Path) -> Result<(), String> {
    let missing_core = CORE_MAP
        .iter()
        .map(|(language_relative, _)| source_dir.join(language_relative))
        .filter(|path| !path.is_file())
        .collect::<Vec<_>>();
    if missing_core.is_empty() {
        return Ok(());
    }
    Err(format!(
        "English language source is incomplete; missing {}",
        missing_core
            .iter()
            .map(|path| path.display().to_string())
            .collect::<Vec<_>>()
            .join(", ")
    ))
}

fn read_json(path: &Path) -> Result<Value, String> {
    let bytes =
        fs::read(path).map_err(|error| format!("Could not read {}: {error}", path.display()))?;
    serde_json::from_slice(&bytes)
        .map_err(|error| format!("Invalid JSON in {}: {error}", path.display()))
}

fn partial_identity_map(values: &[Value]) -> HashMap<String, &Value> {
    let mut identities = HashMap::new();
    let mut duplicates = std::collections::HashSet::new();
    for value in values {
        let Some(identity) = item_identity(value) else {
            continue;
        };
        if identities.insert(identity.clone(), value).is_some() {
            duplicates.insert(identity);
        }
    }
    for duplicate in duplicates {
        identities.remove(&duplicate);
    }
    identities
}

fn identity_positions(values: &[Value]) -> Vec<(usize, String)> {
    values
        .iter()
        .enumerate()
        .filter_map(|(index, value)| item_identity(value).map(|identity| (index, identity)))
        .collect()
}

fn compatible_shape(installed: &Value, translation: &Value) -> bool {
    match (installed, translation) {
        (Value::Object(installed), Value::Object(translation)) => {
            let installed_type = installed.get("type").and_then(scalar_identity);
            let translated_type = translation.get("type").and_then(scalar_identity);
            if (installed_type.is_some() || translated_type.is_some())
                && installed_type != translated_type
            {
                return false;
            }
            translation.iter().all(|(key, translated_value)| {
                installed.get(key).is_some_and(|installed_value| {
                    same_json_kind(installed_value, translated_value)
                })
            })
        }
        (Value::Array(_), Value::Array(_))
        | (Value::String(_), Value::String(_))
        | (Value::Number(_), Value::Number(_))
        | (Value::Bool(_), Value::Bool(_))
        | (Value::Null, Value::Null) => true,
        _ => false,
    }
}

fn same_json_kind(left: &Value, right: &Value) -> bool {
    matches!(
        (left, right),
        (Value::Null, Value::Null)
            | (Value::Bool(_), Value::Bool(_))
            | (Value::Number(_), Value::Number(_))
            | (Value::String(_), Value::String(_))
            | (Value::Array(_), Value::Array(_))
            | (Value::Object(_), Value::Object(_))
    )
}

fn item_identity(value: &Value) -> Option<String> {
    let object = value.as_object()?;
    if let Some(node_type) = object
        .get("value")
        .and_then(Value::as_object)
        .and_then(|nested| nested.get("nodeType"))
        .and_then(Value::as_str)
    {
        return Some(format!("value.nodeType:{node_type}"));
    }
    if let Some(first_node_type) = object
        .get("values")
        .and_then(Value::as_array)
        .and_then(|values| values.first())
        .and_then(Value::as_object)
        .and_then(|first| first.get("nodeType"))
        .and_then(Value::as_str)
    {
        return Some(format!("values.first.nodeType:{first_node_type}"));
    }
    for key in ["nodeType", "id", "identifier", "name", "key"] {
        if let Some(identity) = object.get(key).and_then(scalar_identity) {
            return Some(format!("{key}:{identity}"));
        }
    }
    None
}

fn scalar_identity(value: &Value) -> Option<String> {
    match value {
        Value::String(value) => Some(value.clone()),
        Value::Number(value) => Some(value.to_string()),
        _ => None,
    }
}

pub fn stage_files(pairs: &[CopyPair], staging_dir: &Path) -> Result<Vec<CopyPair>, String> {
    let _ = fs::remove_dir_all(staging_dir);
    fs::create_dir_all(staging_dir).map_err(|error| error.to_string())?;
    pairs
        .iter()
        .enumerate()
        .map(|(index, pair)| {
            let file_name = pair
                .src
                .file_name()
                .ok_or_else(|| format!("Missing file name: {}", pair.src.display()))?;
            let staged_path =
                staging_dir.join(format!("{}-{}", index, file_name.to_string_lossy()));
            fs::copy(&pair.src, &staged_path).map_err(|error| {
                format!(
                    "could not copy {} to {}: {error}",
                    pair.src.display(),
                    staged_path.display()
                )
            })?;
            let mode = fs::metadata(&pair.src)
                .map_err(|error| {
                    format!("could not read mode from {}: {error}", pair.src.display())
                })?
                .permissions();
            fs::set_permissions(&staged_path, mode).map_err(|error| error.to_string())?;
            Ok(CopyPair {
                src: staged_path,
                dst: pair.dst.clone(),
            })
        })
        .collect()
}

pub fn has_english_snapshot(state_dir: &Path, app_path: &Path) -> bool {
    let snapshot_dir = state_dir.join("en");
    let root = assets_root(app_path);

    let has_core = CORE_MAP
        .iter()
        .all(|(lang_rel, _)| snapshot_dir.join(lang_rel).exists());
    let has_plugin_definitions = PLUGIN_DEFINITION_MAP.iter().all(|(lang_rel, asset_rel)| {
        !root.join(asset_rel).exists() || snapshot_dir.join(lang_rel).exists()
    });
    let has_plugin_strings = discover_plugins(app_path).iter().all(|plugin| {
        snapshot_dir
            .join("plugins")
            .join(format!("{}.json", plugin.camel_name))
            .exists()
    });

    has_core && has_plugin_definitions && has_plugin_strings
}

pub fn needs_english_snapshot(
    state_dir: &Path,
    provenance: Option<&EnglishSnapshotProvenance>,
    app_path: &Path,
    immutable_revision: &str,
) -> bool {
    if app_path.as_os_str().is_empty() {
        return false;
    }
    if immutable_revision.is_empty() || !has_english_snapshot(state_dir, app_path) {
        return true;
    }
    provenance.is_none_or(|provenance| {
        provenance.install_root != app_path.to_string_lossy()
            || provenance.immutable_revision != immutable_revision
    })
}

#[cfg(test)]
mod tests {
    use super::{build_copy_pairs, discover_plugins, extract_english, CORE_MAP};
    use std::fs;

    fn write_json(path: &std::path::Path, value: &str) {
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::write(path, value).unwrap();
    }

    #[test]
    fn discover_plugins_to_camel_case() {
        let temp = tempfile::tempdir().unwrap();
        let app = temp.path().join("Cavalry.app");
        write_json(
            &app.join("Contents/assets/Plugins/Gaussian Blur Filter/strings.json"),
            "{}",
        );
        assert_eq!(discover_plugins(&app)[0].camel_name, "gaussianBlurFilter");
    }

    #[test]
    fn extract_english_copies_core_files() {
        let temp = tempfile::tempdir().unwrap();
        let app = temp.path().join("Cavalry.app");
        for (_, asset_rel) in CORE_MAP {
            write_json(&app.join("Contents/assets").join(asset_rel), "{}");
        }
        let out = temp.path().join("en");
        let result = extract_english(&app, &out);
        assert!(result.is_ok());
        let count = result.unwrap();
        assert!(count >= CORE_MAP.len() as usize);
        assert!(out.join("nodeStrings.json").exists());
    }

    #[test]
    fn build_copy_pairs_matches_cavalry_assets() {
        let temp = tempfile::tempdir().unwrap();
        let app = temp.path().join("Cavalry.app");
        let source = temp.path().join("lang");
        for (lang_rel, asset_rel) in CORE_MAP {
            write_json(&app.join("Contents/assets").join(asset_rel), "{}");
            write_json(&source.join(lang_rel), "{}");
        }
        let pairs = build_copy_pairs(&source, &app);
        assert!(pairs.len() >= CORE_MAP.len());
        assert!(pairs.iter().any(|p| p
            .dst
            .ends_with("Contents/assets/Definitions/nodeStrings.json")));
    }
}
