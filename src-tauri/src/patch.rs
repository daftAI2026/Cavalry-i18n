/**
 * [INPUT]: 依赖 std fs/path，读取 Cavalry Contents/assets JSON 与插件 strings.json
 * [OUTPUT]: 对外提供 CORE_MAP、discover_plugins、extract_english、build_copy_pairs、stage_files、needs_english_snapshot
 * [POS]: src-tauri/src 的 JSON patch 映射模块，对齐 desktop-patcher/lib/patch.js
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
use std::{
    fs,
    path::{Path, PathBuf},
};

pub const CORE_MAP: [(&str, &str); 4] = [
    ("nodeStrings.json", "Definitions"),
    ("appStrings.json", "Definitions"),
    ("tips.json", "Learn"),
    ("onboarding.json", "Learn"),
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
    for (file, subdir) in CORE_MAP {
        fs::copy(root.join(subdir).join(file), output_dir.join(file))
            .map_err(|error| error.to_string())?;
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
    for (file, subdir) in CORE_MAP {
        let source_path = source_dir.join(file);
        if source_path.exists() {
            pairs.push(CopyPair {
                src: source_path,
                dst: root.join(subdir).join(file),
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
            fs::copy(&pair.src, &staged_path).map_err(|error| error.to_string())?;
            let mode = fs::metadata(&pair.src)
                .map_err(|error| error.to_string())?
                .permissions();
            fs::set_permissions(&staged_path, mode).map_err(|error| error.to_string())?;
            Ok(CopyPair {
                src: staged_path,
                dst: pair.dst.clone(),
            })
        })
        .collect()
}

pub fn has_english_snapshot(state_dir: &Path) -> bool {
    CORE_MAP
        .iter()
        .all(|(file, _)| state_dir.join("en").join(file).exists())
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
    !has_english_snapshot(state_dir)
        || state_app_path != app_path.to_string_lossy()
        || state_version != version
}

#[cfg(test)]
mod tests {
    use super::{build_copy_pairs, discover_plugins, extract_english};
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
        for (file, subdir) in super::CORE_MAP {
            write_json(&app.join("Contents/assets").join(subdir).join(file), "{}");
        }
        let out = temp.path().join("en");
        assert_eq!(extract_english(&app, &out).unwrap(), 4);
        assert!(out.join("nodeStrings.json").exists());
    }

    #[test]
    fn build_copy_pairs_matches_electron() {
        let temp = tempfile::tempdir().unwrap();
        let app = temp.path().join("Cavalry.app");
        let source = temp.path().join("lang");
        for (file, subdir) in super::CORE_MAP {
            write_json(&app.join("Contents/assets").join(subdir).join(file), "{}");
            write_json(&source.join(file), "{}");
        }
        let pairs = build_copy_pairs(&source, &app);
        assert_eq!(pairs.len(), 4);
        assert!(pairs[0]
            .dst
            .ends_with("Contents/assets/Definitions/nodeStrings.json"));
    }
}
