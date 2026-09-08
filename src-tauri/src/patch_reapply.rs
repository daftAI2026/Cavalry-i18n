/**
 * [INPUT]: 依赖 English immutable snapshot、当前安装的映射 JSON 与既有 asset path/hash/mode gate
 * [OUTPUT]: 对外提供不依赖历史翻译 catalog 的 managed asset preimage 证明
 * [POS]: patch 的重应用安全边界；只证明结构/身份/原字节，不生成或修改任何输出文件
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
use std::{collections::HashSet, fs, path::Path};

use serde_json::Value;

use super::{
    assets_root, is_regular_file_without_symlink, item_identity, original_unix_mode, read_json,
    read_snapshot_manifest, requires_unix_mode, sha256_bytes, sha256_file, snapshot_mappings,
    validate_mac_asset_components, validate_snapshot_manifest, AssetPreimageEvidence,
    ENGLISH_SNAPSHOT_MANIFEST_NAME,
};

// name/niceName 可表示显示名，attributes.key 可表示界面文案，不能仅按键名认作机器身份。
// 数组记录继续由 item_identity 锁定；以下字段则固定表达机器类型或标识。
const PROTECTED_KEYS: [&str; 5] = ["type", "nodeType", "layerType", "id", "identifier"];

/// Verify a managed translated postimage against the immutable English shape and return the
/// exact bytes that the outer transaction must re-check immediately before its first write.
///
/// String leaves are the only intentionally variable values. Identity fields, JSON structure,
/// array identities, numeric values, booleans, nulls, file modes and snapshot paths remain fixed.
pub(crate) fn verify_managed_asset_preimages(
    snapshot_dir: &Path,
    app_path: &Path,
    expected_manifest_sha256: Option<&str>,
) -> Result<Vec<AssetPreimageEvidence>, String> {
    let mappings = snapshot_mappings(app_path)?;
    let require_modes = requires_unix_mode(app_path);
    if require_modes && expected_manifest_sha256.is_none() {
        return Err(
            "managed macOS asset verification requires a trusted snapshot manifest digest"
                .to_string(),
        );
    }
    if !validate_snapshot_manifest(snapshot_dir, &mappings, require_modes)? {
        return Err("managed English snapshot failed its exact manifest gate".to_string());
    }
    if let Some(expected) = expected_manifest_sha256 {
        let actual = sha256_file(&snapshot_dir.join(ENGLISH_SNAPSHOT_MANIFEST_NAME))?;
        if actual != expected {
            return Err(
                "managed English snapshot manifest digest does not match its provenance"
                    .to_string(),
            );
        }
    }
    let manifest = read_snapshot_manifest(snapshot_dir)?;
    let root = assets_root(app_path);
    let mut evidence = Vec::with_capacity(mappings.len());
    let mut destinations = HashSet::new();
    for mapping in mappings {
        validate_mac_asset_components(app_path, Path::new(&mapping.asset_relative_path))?;
        let entry = manifest
            .entries
            .iter()
            .find(|entry| {
                entry.language_relative_path == mapping.language_relative_path
                    && entry.asset_relative_path == mapping.asset_relative_path
            })
            .ok_or_else(|| {
                format!(
                    "managed English snapshot has no exact entry for {}",
                    mapping.asset_relative_path
                )
            })?;
        let snapshot = snapshot_dir.join(&mapping.language_relative_path);
        let destination = root.join(&mapping.asset_relative_path);
        if !is_regular_file_without_symlink(&snapshot)? {
            return Err(format!(
                "managed snapshot source is not a regular file: {}",
                snapshot.display()
            ));
        }
        if !is_regular_file_without_symlink(&destination)? {
            return Err(format!(
                "managed asset is not a regular file: {}",
                destination.display()
            ));
        }
        let baseline = read_json(&snapshot)?;
        let actual_bytes = fs::read(&destination).map_err(|error| {
            format!(
                "Could not read managed asset {}: {error}",
                destination.display()
            )
        })?;
        let actual: Value = serde_json::from_slice(&actual_bytes).map_err(|error| {
            format!(
                "Invalid JSON in managed asset {}: {error}",
                destination.display()
            )
        })?;
        same_managed_shape(&baseline, &actual, "$", None)?;
        let expected_mode = entry.unix_mode;
        if require_modes && original_unix_mode(&destination)? != expected_mode {
            return Err(format!(
                "managed asset mode drift detected at {}",
                mapping.asset_relative_path
            ));
        }
        if !destinations.insert(destination.clone()) {
            return Err(format!(
                "managed asset mapping repeats {}",
                destination.display()
            ));
        }
        evidence.push(AssetPreimageEvidence {
            destination,
            sha256: sha256_bytes(&actual_bytes),
            unix_mode: expected_mode,
        });
    }
    Ok(evidence)
}

fn same_managed_shape(
    baseline: &Value,
    actual: &Value,
    path: &str,
    object_key: Option<&str>,
) -> Result<(), String> {
    match (baseline, actual) {
        (Value::String(_), Value::String(_)) if !is_protected_key(object_key) => Ok(()),
        (Value::String(left), Value::String(right)) if left == right => Ok(()),
        (Value::String(_), Value::String(_)) => Err(identity_drift(path)),
        (Value::Number(left), Value::Number(right)) if left == right => Ok(()),
        (Value::Bool(left), Value::Bool(right)) if left == right => Ok(()),
        (Value::Null, Value::Null) => Ok(()),
        (Value::Object(left), Value::Object(right)) => {
            if left.len() != right.len() || left.keys().any(|key| !right.contains_key(key)) {
                return Err(format!("managed asset object shape drift at {path}"));
            }
            for (key, expected) in left {
                same_managed_shape(
                    expected,
                    right.get(key).expect("object key checked above"),
                    &format!("{path}.{key}"),
                    Some(key),
                )?;
            }
            Ok(())
        }
        (Value::Array(left), Value::Array(right)) => {
            if left.len() != right.len() {
                return Err(format!("managed asset array shape drift at {path}"));
            }
            for (index, (expected, observed)) in left.iter().zip(right).enumerate() {
                if item_identity(expected) != item_identity(observed) {
                    return Err(format!(
                        "managed asset array identity drift at {path}[{index}]"
                    ));
                }
                same_managed_shape(expected, observed, &format!("{path}[{index}]"), None)?;
            }
            Ok(())
        }
        _ => Err(format!("managed asset value kind drift at {path}")),
    }
}

fn is_protected_key(key: Option<&str>) -> bool {
    key.is_some_and(|key| PROTECTED_KEYS.contains(&key))
}

fn identity_drift(path: &str) -> String {
    format!("managed asset protected identity drift at {path}")
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn write(path: &Path, bytes: impl AsRef<[u8]>) {
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::write(path, bytes).unwrap();
    }

    fn fixture() -> (
        tempfile::TempDir,
        std::path::PathBuf,
        std::path::PathBuf,
        String,
    ) {
        let temp = tempfile::tempdir().unwrap();
        let app = if cfg!(target_os = "macos") {
            temp.path().join("Cavalry.app")
        } else {
            temp.path().join("Cavalry")
        };
        let snapshot = temp.path().join("snapshot");
        let baseline = br#"[{"type":"strings","name":"Stable","value":{"text":"English","amount":1},"enabled":true}]"#;
        let mut entries = Vec::new();
        for (language_relative_path, asset_relative_path) in super::super::CORE_MAP {
            let asset = assets_root(&app).join(asset_relative_path);
            let source = snapshot.join(language_relative_path);
            write(&asset, baseline);
            write(&source, baseline);
            entries.push(super::super::EnglishSnapshotEntry {
                language_relative_path: language_relative_path.to_string(),
                asset_relative_path: asset_relative_path.to_string(),
                sha256: sha256_bytes(baseline),
                unix_mode: super::super::original_unix_mode(&asset).unwrap(),
            });
        }
        entries.sort_by(|left, right| {
            left.language_relative_path
                .cmp(&right.language_relative_path)
        });
        let manifest = super::super::EnglishSnapshotManifest {
            schema_version: super::super::ENGLISH_SNAPSHOT_SCHEMA_VERSION,
            entries,
        };
        write(
            &snapshot.join(ENGLISH_SNAPSHOT_MANIFEST_NAME),
            serde_json::to_vec_pretty(&manifest).unwrap(),
        );
        let digest = sha256_file(&snapshot.join(ENGLISH_SNAPSHOT_MANIFEST_NAME)).unwrap();
        (temp, app, snapshot, digest)
    }

    fn first_asset(app: &Path) -> std::path::PathBuf {
        assets_root(app).join(super::super::CORE_MAP[0].1)
    }

    #[test]
    fn accepts_every_current_language_overlay_without_comparing_sparse_array_positions() {
        let repo = Path::new(env!("CARGO_MANIFEST_DIR")).parent().unwrap();
        for language in ["zh-Hans", "zh-Hant", "ja_JP"] {
            for (relative, _) in super::super::CORE_MAP {
                let baseline = read_json(&repo.join("languages/en").join(relative)).unwrap();
                let source =
                    read_json(&repo.join("languages").join(language).join(relative)).unwrap();
                let installed = super::super::merge_translation_overlay(&baseline, &source);
                same_managed_shape(&baseline, &installed, "$", None)
                    .unwrap_or_else(|error| panic!("{language}/{relative}: {error}"));
            }
        }
    }

    #[test]
    fn accepts_old_translation_and_returns_the_exact_installed_preimage() {
        let (_temp, app, snapshot, digest) = fixture();
        let path = first_asset(&app);
        let translated = r#"[{"type":"strings","name":"Stable","value":{"text":"旧翻译","amount":1},"enabled":true}]"#;
        write(&path, translated);
        let evidence = verify_managed_asset_preimages(&snapshot, &app, Some(&digest)).unwrap();
        let item = evidence
            .iter()
            .find(|item| item.destination == path)
            .unwrap();
        assert_eq!(item.sha256, sha256_bytes(translated.as_bytes()));
    }

    #[test]
    fn rejects_protected_identity_drift() {
        let (_temp, app, snapshot, digest) = fixture();
        write(
            &first_asset(&app),
            r#"[{"type":"strings","name":"Changed","value":{"text":"旧翻译","amount":1},"enabled":true}]"#,
        );
        assert!(verify_managed_asset_preimages(&snapshot, &app, Some(&digest)).is_err());
    }

    #[test]
    fn rejects_non_string_and_structural_drift() {
        let (_temp, app, snapshot, digest) = fixture();
        write(
            &first_asset(&app),
            r#"[{"type":"strings","name":"Stable","value":{"text":"旧翻译","amount":2},"enabled":true}]"#,
        );
        assert!(verify_managed_asset_preimages(&snapshot, &app, Some(&digest)).is_err());
    }

    #[cfg(unix)]
    #[test]
    fn rejects_symlinked_managed_asset() {
        use std::os::unix::fs::symlink;

        let (temp, app, snapshot, digest) = fixture();
        let path = first_asset(&app);
        let target = temp.path().join("outside.json");
        write(&target, br#"[{"type":"strings"}]"#);
        fs::remove_file(&path).unwrap();
        symlink(&target, &path).unwrap();
        assert!(verify_managed_asset_preimages(&snapshot, &app, Some(&digest)).is_err());
    }
}
