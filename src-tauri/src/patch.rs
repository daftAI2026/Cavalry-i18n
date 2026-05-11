/**
 * [INPUT]: 依赖 std fs/path，读取 Cavalry Contents/assets JSON 与插件 strings.json
 * [OUTPUT]: 对外提供 CORE_MAP、discover_plugins、extract_english、build_copy_pairs、stage_files、has_english_snapshot、needs_english_snapshot
 * [POS]: src-tauri/src 的 JSON patch 映射模块，对齐 Cavalry JSON 资产映射需求
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
use std::{
    fs,
    path::{Path, PathBuf},
};

/// Static map of all non-plugin file pairs.
/// Each tuple: (language_relative_path, asset_relative_path)
/// relative to `languages/{lang}/` and `Contents/assets/` respectively.
pub const CORE_MAP: [(&str, &str); 14] = [
    ("appStrings.json", "Definitions/appStrings.json"),
    ("nodeStrings.json", "Definitions/nodeStrings.json"),
    ("onboarding.json", "Learn/onboarding.json"),
    ("tips.json", "Learn/tips.json"),
    ("Definitions/nodeDefinitions.json", "Definitions/nodeDefinitions.json"),
    ("Definitions/systemPresets.json", "Definitions/systemPresets.json"),
    ("Learn/Guides/guides.json", "Learn/Guides/guides.json"),
    ("Learn/Guides/strings.json", "Learn/Guides/strings.json"),
    ("MetaData/api_function_metadata.json", "MetaData/api_function_metadata.json"),
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
    app_path.join("Contents").join("assets")
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
    let has_plugin_strings = discover_plugins(app_path)
        .iter()
        .all(|plugin| snapshot_dir.join("plugins").join(format!("{}.json", plugin.camel_name)).exists());

    has_core && has_plugin_definitions && has_plugin_strings
}

pub fn needs_english_snapshot(
    state_dir: &Path,
    state_app_path: &str,
    state_version: &str,
    app_path: &Path,
    version: &str,
) -> bool {
    if app_path.as_os_str().is_empty() {
        return false;
    }
    !has_english_snapshot(state_dir, app_path)
        || state_app_path != app_path.to_string_lossy()
        || state_version != version
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
