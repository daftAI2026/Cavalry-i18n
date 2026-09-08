/**
 * [INPUT]: 依赖固定发布目录中的 P7 sparse JSON catalog、manifest 摘要、patch 的 CORE_MAP 与应用资源候选路径。
 * [OUTPUT]: 对外提供已发布 Cavalry 2.7.2-p7 语言源的严格解析；只有固定 manifest、文件集合与逐文件 SHA-256 全部吻合时才返回历史源目录。
 * [POS]: commands 的旧安装补丁源适配层；apply 在无成功回执的旧安装上先用该历史源做只读 preimage 证明，证明失败仍回到当前包并由最终 gate fail closed，绝不把当前包伪装成历史版本。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
use std::{
    collections::{HashMap, HashSet},
    fs,
    path::{Component, Path, PathBuf},
};

use serde::Deserialize;
use serde_json::Value;
use sha2::{Digest, Sha256};

use crate::patch::CORE_MAP;

pub(crate) const P7_RELEASE_TAG: &str = "cavalry-2.7.2-p7";
pub(crate) const P7_SOURCE_COMMIT: &str = "013638bf82422b1af810f38cf8ce7c241dbb93dd";
pub(crate) const P7_TARGET_CAVALRY_VERSION: &str = "2.7.2";

const P7_RELATIVE_ROOT: &str = "legacy-patches/cavalry-2.7.2-p7";
const P7_MANIFEST_SHA256: &str = "778375ae94b99ac5b3bbb95b4b32492a18c3ec499254da7581813219783252fb";
const P7_LANGUAGES: [&str; 3] = ["zh-Hans", "zh-Hant", "ja_JP"];

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct CatalogManifest {
    #[serde(rename = "schemaVersion")]
    schema_version: u32,
    #[serde(rename = "releaseTag")]
    release_tag: String,
    #[serde(rename = "sourceCommit")]
    source_commit: String,
    #[serde(rename = "targetCavalryVersion")]
    target_cavalry_version: String,
    languages: Vec<String>,
    files: Vec<CatalogFile>,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct CatalogFile {
    path: String,
    sha256: String,
    bytes: u64,
}

/// Resolve a historical source only when the complete, tracked P7 catalog is present.
///
/// A missing catalog is allowed for source checkouts and old test fixtures.  Once a candidate
/// directory exists, however, every part of its manifest and file tree is checked; malformed or
/// partially copied release material is an error rather than a reason to silently use current
/// translations as a historical preimage.
pub(crate) fn p7_language_source_dir(
    repo_root: &Path,
    resource_dir: &Path,
    language: &str,
) -> Result<Option<PathBuf>, String> {
    if !P7_LANGUAGES.contains(&language) {
        return Ok(None);
    }

    for root in catalog_candidates(repo_root, resource_dir) {
        match fs::symlink_metadata(&root) {
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => continue,
            Err(error) => {
                return Err(format!(
                    "Could not inspect historical P7 catalog {}: {error}",
                    root.display()
                ));
            }
            Ok(metadata) if metadata.file_type().is_symlink() => {
                return Err(format!(
                    "Historical P7 catalog root is a symlink: {}",
                    root.display()
                ));
            }
            Ok(_) => {
                validate_catalog(&root)?;
                return Ok(Some(root.join("languages").join(language)));
            }
        }
    }
    Ok(None)
}

fn catalog_candidates(repo_root: &Path, resource_dir: &Path) -> Vec<PathBuf> {
    let mut candidates = vec![resource_dir.join(P7_RELATIVE_ROOT)];
    candidates.push(resource_dir.join("_up_").join(P7_RELATIVE_ROOT));
    if let Some(parent) = resource_dir.parent() {
        candidates.push(parent.join(P7_RELATIVE_ROOT));
    }
    candidates.push(repo_root.join(P7_RELATIVE_ROOT));
    candidates.push(repo_root.join("src-tauri").join(P7_RELATIVE_ROOT));
    candidates.dedup();
    candidates
}

fn validate_catalog(root: &Path) -> Result<(), String> {
    ensure_regular_file(&root.join("manifest.json"), "P7 catalog manifest")?;
    ensure_directory_without_symlink(root, "P7 catalog root")?;
    let manifest_bytes = fs::read(root.join("manifest.json"))
        .map_err(|error| format!("Could not read P7 catalog manifest: {error}"))?;
    if sha256_hex(&manifest_bytes) != P7_MANIFEST_SHA256 {
        return Err(format!(
            "P7 catalog manifest hash does not match the released source: {}",
            root.display()
        ));
    }
    let manifest: CatalogManifest = serde_json::from_slice(&manifest_bytes)
        .map_err(|error| format!("P7 catalog manifest is invalid JSON: {error}"))?;
    if manifest.schema_version != 1
        || manifest.release_tag != P7_RELEASE_TAG
        || manifest.source_commit != P7_SOURCE_COMMIT
        || manifest.target_cavalry_version != P7_TARGET_CAVALRY_VERSION
        || manifest.languages
            != P7_LANGUAGES
                .iter()
                .map(|language| (*language).to_string())
                .collect::<Vec<_>>()
    {
        return Err(format!(
            "P7 catalog manifest identity is not the recognized {} release",
            P7_RELEASE_TAG
        ));
    }

    validate_catalog_shape(root, &manifest)?;
    let mut listed = HashMap::with_capacity(manifest.files.len());
    for entry in &manifest.files {
        let (language, relative) = validate_catalog_path(&entry.path)?;
        if !manifest.languages.iter().any(|item| item == language) {
            return Err(format!(
                "P7 catalog entry uses an unsupported language: {}",
                entry.path
            ));
        }
        if !is_sha256_hex(&entry.sha256) {
            return Err(format!(
                "P7 catalog entry has an invalid SHA-256: {}",
                entry.path
            ));
        }
        if listed
            .insert(entry.path.clone(), (entry.sha256.as_str(), entry.bytes))
            .is_some()
        {
            return Err(format!("P7 catalog repeats file entry: {}", entry.path));
        }

        let file = root.join(&entry.path);
        ensure_relative_components(root, Path::new(&entry.path), "P7 catalog file")?;
        ensure_regular_file(&file, "P7 catalog JSON")?;
        let bytes = fs::read(&file).map_err(|error| {
            format!("Could not read P7 catalog file {}: {error}", file.display())
        })?;
        if bytes.len() as u64 != entry.bytes || sha256_hex(&bytes) != entry.sha256 {
            return Err(format!("P7 catalog file digest mismatch: {}", entry.path));
        }
        serde_json::from_slice::<Value>(&bytes).map_err(|error| {
            format!(
                "P7 catalog file is not valid JSON ({}): {error}",
                entry.path
            )
        })?;
        let _ = relative;
    }

    let actual = collect_catalog_files(&root.join("languages"))?;
    let actual_set = actual.iter().cloned().collect::<HashSet<_>>();
    let listed_set = listed.keys().cloned().collect::<HashSet<_>>();
    if actual_set != listed_set {
        let missing = listed_set
            .difference(&actual_set)
            .cloned()
            .collect::<Vec<_>>();
        let extra = actual_set
            .difference(&listed_set)
            .cloned()
            .collect::<Vec<_>>();
        return Err(format!(
            "P7 catalog file set mismatch (missing: {}; extra: {})",
            missing.join(", "),
            extra.join(", ")
        ));
    }

    for (language_relative, _) in CORE_MAP {
        for language in P7_LANGUAGES {
            let path = format!("languages/{language}/{language_relative}");
            if !listed.contains_key(&path) {
                return Err(format!("P7 catalog is missing required core file: {path}"));
            }
        }
    }
    Ok(())
}

fn validate_catalog_shape(root: &Path, manifest: &CatalogManifest) -> Result<(), String> {
    let mut top_level = fs::read_dir(root)
        .map_err(|error| format!("Could not inspect P7 catalog root: {error}"))?
        .map(|entry| {
            let entry = entry.map_err(|error| error.to_string())?;
            let name = entry.file_name().to_string_lossy().to_string();
            let metadata = fs::symlink_metadata(entry.path()).map_err(|error| error.to_string())?;
            if metadata.file_type().is_symlink() {
                return Err(format!(
                    "P7 catalog contains a symlink: {}",
                    entry.path().display()
                ));
            }
            Ok((name, metadata.file_type().is_dir()))
        })
        .collect::<Result<Vec<_>, String>>()?;
    top_level.sort();
    if top_level
        != [
            ("languages".to_string(), true),
            ("manifest.json".to_string(), false),
        ]
    {
        return Err("P7 catalog root must contain only manifest.json and languages/".to_string());
    }

    let languages_root = root.join("languages");
    ensure_directory_without_symlink(&languages_root, "P7 catalog languages root")?;
    let mut actual_languages = fs::read_dir(&languages_root)
        .map_err(|error| format!("Could not inspect P7 catalog languages: {error}"))?
        .map(|entry| {
            let entry = entry.map_err(|error| error.to_string())?;
            let name = entry.file_name().to_string_lossy().to_string();
            let metadata = fs::symlink_metadata(entry.path()).map_err(|error| error.to_string())?;
            if metadata.file_type().is_symlink() {
                return Err(format!(
                    "P7 catalog language is a symlink: {}",
                    entry.path().display()
                ));
            }
            if !metadata.is_dir() {
                return Err(format!(
                    "P7 catalog language is not a directory: {}",
                    entry.path().display()
                ));
            }
            Ok(name)
        })
        .collect::<Result<Vec<_>, String>>()?;
    actual_languages.sort();
    let mut expected_languages = manifest.languages.clone();
    expected_languages.sort();
    if actual_languages != expected_languages {
        return Err("P7 catalog language directories do not match manifest".to_string());
    }
    Ok(())
}

fn validate_catalog_path(path: &str) -> Result<(&str, PathBuf), String> {
    if path.contains('\\') || path.starts_with('/') {
        return Err(format!(
            "P7 catalog path is not a portable relative path: {path}"
        ));
    }
    let mut components = Path::new(path).components();
    if components.next() != Some(Component::Normal("languages".as_ref())) {
        return Err(format!(
            "P7 catalog path must begin with languages/: {path}"
        ));
    }
    let language = match components.next() {
        Some(Component::Normal(language)) => language
            .to_str()
            .ok_or_else(|| format!("P7 catalog path has a non-UTF-8 language component: {path}"))?,
        _ => return Err(format!("P7 catalog path has no language component: {path}")),
    };
    if components.clone().next().is_none()
        || components.any(|component| !matches!(component, Component::Normal(_)))
        || !path.ends_with(".json")
    {
        return Err(format!("P7 catalog path is not a JSON file path: {path}"));
    }
    Ok((language, PathBuf::from(path)))
}

fn ensure_relative_components(root: &Path, relative: &Path, role: &str) -> Result<(), String> {
    if relative.is_absolute()
        || relative
            .components()
            .any(|component| !matches!(component, Component::Normal(_)))
    {
        return Err(format!(
            "{role} path escapes its catalog root: {}",
            relative.display()
        ));
    }
    let mut current = root.to_path_buf();
    for component in relative.components() {
        let Component::Normal(name) = component else {
            return Err(format!("{role} path is not normal: {}", relative.display()));
        };
        current.push(name);
        let metadata = fs::symlink_metadata(&current).map_err(|error| {
            format!(
                "Could not inspect {role} component {}: {error}",
                current.display()
            )
        })?;
        if metadata.file_type().is_symlink() {
            return Err(format!("{role} contains a symlink: {}", current.display()));
        }
    }
    Ok(())
}

fn ensure_directory_without_symlink(path: &Path, role: &str) -> Result<(), String> {
    let metadata = fs::symlink_metadata(path)
        .map_err(|error| format!("Could not inspect {role} {}: {error}", path.display()))?;
    if metadata.file_type().is_symlink() || !metadata.is_dir() {
        return Err(format!(
            "{role} is not a real directory: {}",
            path.display()
        ));
    }
    Ok(())
}

fn ensure_regular_file(path: &Path, role: &str) -> Result<(), String> {
    let metadata = fs::symlink_metadata(path)
        .map_err(|error| format!("Could not inspect {role} {}: {error}", path.display()))?;
    if metadata.file_type().is_symlink() || !metadata.is_file() {
        return Err(format!("{role} is not a real file: {}", path.display()));
    }
    Ok(())
}

fn collect_catalog_files(root: &Path) -> Result<Vec<String>, String> {
    ensure_directory_without_symlink(root, "P7 catalog languages root")?;
    let mut files = Vec::new();
    collect_catalog_files_from(root, root, &mut files)?;
    files.sort();
    Ok(files)
}

fn collect_catalog_files_from(
    root: &Path,
    directory: &Path,
    files: &mut Vec<String>,
) -> Result<(), String> {
    let mut entries = fs::read_dir(directory)
        .map_err(|error| format!("Could not inspect P7 catalog directory: {error}"))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())?;
    entries.sort_by_key(|entry| entry.file_name());
    for entry in entries {
        let path = entry.path();
        let metadata = fs::symlink_metadata(&path).map_err(|error| error.to_string())?;
        if metadata.file_type().is_symlink() {
            return Err(format!("P7 catalog contains a symlink: {}", path.display()));
        }
        if metadata.is_dir() {
            collect_catalog_files_from(root, &path, files)?;
        } else if metadata.is_file() {
            let relative = path
                .strip_prefix(
                    root.parent()
                        .ok_or_else(|| "invalid catalog root".to_string())?,
                )
                .map_err(|error| error.to_string())?
                .to_string_lossy()
                .replace(std::path::MAIN_SEPARATOR, "/");
            files.push(relative);
        } else {
            return Err(format!(
                "P7 catalog contains unsupported entry: {}",
                path.display()
            ));
        }
    }
    Ok(())
}

fn sha256_hex(bytes: &[u8]) -> String {
    let mut digest = Sha256::new();
    digest.update(bytes);
    format!("{:x}", digest.finalize())
}

fn is_sha256_hex(value: &str) -> bool {
    value.len() == 64 && value.bytes().all(|byte| byte.is_ascii_hexdigit())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn recognized_p7_catalog_is_not_current_language_source() {
        let repo_root = Path::new(env!("CARGO_MANIFEST_DIR"))
            .parent()
            .expect("src-tauri must remain below repository root");
        let source = p7_language_source_dir(repo_root, repo_root, "zh-Hans")
            .expect("P7 catalog must validate")
            .expect("P7 catalog must be available in source checkout");
        assert!(source.ends_with("legacy-patches/cavalry-2.7.2-p7/languages/zh-Hans"));
        assert_ne!(source, repo_root.join("languages/zh-Hans"));
        assert_eq!(
            sha256_hex(
                &fs::read(
                    source
                        .parent()
                        .unwrap()
                        .parent()
                        .unwrap()
                        .join("manifest.json")
                )
                .unwrap()
            ),
            P7_MANIFEST_SHA256
        );
    }

    #[test]
    fn p7_sparse_source_reconstructs_the_released_overlay_before_current_source_changes() {
        let repo_root = Path::new(env!("CARGO_MANIFEST_DIR"))
            .parent()
            .expect("src-tauri must remain below repository root");
        let historical = p7_language_source_dir(repo_root, repo_root, "zh-Hans")
            .unwrap()
            .unwrap();
        let relative = "appStrings.json";
        let english: Value = serde_json::from_slice(
            &fs::read(repo_root.join("languages/en").join(relative)).unwrap(),
        )
        .unwrap();
        let old_source: Value =
            serde_json::from_slice(&fs::read(historical.join(relative)).unwrap()).unwrap();
        let installed = crate::patch::merge_translation_overlay(&english, &old_source);

        let mut current_source: Value = serde_json::from_slice(
            &fs::read(repo_root.join("languages/zh-Hans").join(relative)).unwrap(),
        )
        .unwrap();
        assert!(replace_first_string(
            &mut current_source,
            "P8 changed translation"
        ));
        let current_overlay = crate::patch::merge_translation_overlay(&english, &current_source);
        assert_ne!(installed, current_overlay);
        assert_eq!(
            installed,
            crate::patch::merge_translation_overlay(&english, &old_source),
            "the immutable P7 source must reproduce the prior installed overlay"
        );
    }

    #[test]
    fn malformed_catalog_is_rejected_instead_of_falling_back_to_current_source() {
        let temp = tempfile::tempdir().unwrap();
        let root = temp.path().join(P7_RELATIVE_ROOT).join("languages");
        fs::create_dir_all(&root).unwrap();
        fs::write(
            root.parent().unwrap().join("manifest.json"),
            br#"{"schemaVersion":1}"#,
        )
        .unwrap();
        let error = p7_language_source_dir(temp.path(), temp.path(), "zh-Hans").unwrap_err();
        assert!(error.contains("manifest"), "{error}");
    }

    #[cfg(unix)]
    #[test]
    fn symlinked_catalog_root_is_rejected_even_when_the_target_is_missing() {
        use std::os::unix::fs::symlink;

        let temp = tempfile::tempdir().unwrap();
        let root = temp.path().join(P7_RELATIVE_ROOT);
        fs::create_dir_all(root.parent().unwrap()).unwrap();
        symlink(temp.path().join("missing-p7"), &root).unwrap();

        let error = p7_language_source_dir(temp.path(), temp.path(), "zh-Hans").unwrap_err();
        assert!(error.contains("symlink"), "{error}");
    }

    fn replace_first_string(value: &mut Value, replacement: &str) -> bool {
        match value {
            Value::String(string) => {
                *string = replacement.to_string();
                true
            }
            Value::Array(values) => values
                .iter_mut()
                .any(|value| replace_first_string(value, replacement)),
            Value::Object(values) => values
                .values_mut()
                .any(|value| replace_first_string(value, replacement)),
            _ => false,
        }
    }
}
