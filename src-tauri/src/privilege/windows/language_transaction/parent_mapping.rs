/**
 * [INPUT]: 依赖固定 CORE_MAP/PLUGIN_DEFINITION_MAP、实时插件目录与 Windows reparse 元数据。
 * [OUTPUT]: 提供 CopyPair 到目标 assets-relative PayloadKind/ID 的严格一一映射与完整 core 集合证明。
 * [POS]: language_transaction parent 的目标授权子层；只承认已知映射或当前存在的普通 plugin strings，不信任调用方 destination。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
use std::{
    collections::{HashMap, HashSet},
    fs, io,
    path::PathBuf,
};

use crate::{
    install::InstallLayout,
    patch::{CopyPair, CORE_MAP, PLUGIN_DEFINITION_MAP},
    privilege::windows::known_folders::metadata_is_reparse_point,
};

use super::{rejected, ParentApplyError, PayloadKind};

#[derive(Debug, Clone)]
pub(super) struct ClassifiedPair {
    pub(super) source: PathBuf,
    pub(super) destination: PathBuf,
    pub(super) id: String,
    pub(super) kind: PayloadKind,
}

pub(super) fn classify_overlay_pairs(
    layout: &InstallLayout,
    pairs: &[CopyPair],
) -> Result<Vec<ClassifiedPair>, ParentApplyError> {
    let mut allowed = HashMap::<String, (String, PayloadKind)>::new();
    let mut required_core = HashSet::<String>::new();
    for (_, asset_relative) in CORE_MAP {
        let destination = layout.assets_root.join(asset_relative);
        require_existing_regular_non_reparse(&destination, "core asset destination")?;
        let key = path_key(&destination);
        allowed.insert(
            key.clone(),
            (slash_normalized(asset_relative), PayloadKind::CoreAsset),
        );
        required_core.insert(key);
    }
    for (_, asset_relative) in PLUGIN_DEFINITION_MAP {
        let destination = layout.assets_root.join(asset_relative);
        if path_is_existing_regular_non_reparse(&destination)? {
            allowed.insert(
                path_key(&destination),
                (
                    slash_normalized(asset_relative),
                    PayloadKind::KnownPluginDefinition,
                ),
            );
        }
    }
    add_discovered_plugin_targets(layout, &mut allowed)?;

    let mut seen = HashSet::new();
    let mut output = Vec::with_capacity(pairs.len());
    for pair in pairs {
        require_existing_regular_non_reparse(&pair.src, "overlay source")?;
        let key = path_key(&pair.dst);
        let (id, kind) = allowed.get(&key).ok_or_else(|| {
            rejected(format!(
                "Refusing elevated language payload with an unrecognized destination: {}",
                pair.dst.display()
            ))
        })?;
        if !seen.insert(key.clone()) {
            return Err(rejected(format!(
                "Refusing duplicate elevated language destination: {}",
                pair.dst.display()
            )));
        }
        output.push(ClassifiedPair {
            source: pair.src.clone(),
            destination: pair.dst.clone(),
            id: id.clone(),
            kind: *kind,
        });
    }
    if let Some(missing) = required_core.difference(&seen).next() {
        return Err(rejected(format!(
            "Elevated language payload is missing required core asset: {missing}"
        )));
    }
    output.sort_by(|left, right| {
        payload_kind_order(left.kind)
            .cmp(&payload_kind_order(right.kind))
            .then_with(|| left.id.to_lowercase().cmp(&right.id.to_lowercase()))
    });
    Ok(output)
}

fn add_discovered_plugin_targets(
    layout: &InstallLayout,
    allowed: &mut HashMap<String, (String, PayloadKind)>,
) -> Result<(), ParentApplyError> {
    let plugins_root = layout.assets_root.join("Plugins");
    let entries = fs::read_dir(&plugins_root).map_err(|error| {
        rejected(format!(
            "Could not enumerate Cavalry plugin strings at {}: {error}",
            plugins_root.display()
        ))
    })?;
    for entry in entries {
        let entry = entry.map_err(|error| rejected(error.to_string()))?;
        let directory = entry.path();
        let metadata = fs::symlink_metadata(&directory).map_err(|error| {
            rejected(format!(
                "Could not inspect plugin directory {}: {error}",
                directory.display()
            ))
        })?;
        if !metadata.is_dir() || metadata_is_reparse_point(&metadata) {
            continue;
        }
        let strings = directory.join("strings.json");
        if !path_is_existing_regular_non_reparse(&strings)? {
            continue;
        }
        let folder = entry.file_name().into_string().map_err(|_| {
            rejected(format!(
                "Plugin directory is not Unicode: {}",
                directory.display()
            ))
        })?;
        allowed.insert(
            path_key(&strings),
            (
                format!("Plugins/{folder}/strings.json"),
                PayloadKind::DiscoveredPluginStrings,
            ),
        );
    }
    Ok(())
}

fn path_is_existing_regular_non_reparse(path: &std::path::Path) -> Result<bool, ParentApplyError> {
    match fs::symlink_metadata(path) {
        Ok(metadata) => Ok(metadata.is_file() && !metadata_is_reparse_point(&metadata)),
        Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(false),
        Err(error) => Err(rejected(format!(
            "Could not inspect {}: {error}",
            path.display()
        ))),
    }
}

fn require_existing_regular_non_reparse(
    path: &std::path::Path,
    role: &str,
) -> Result<(), ParentApplyError> {
    if path_is_existing_regular_non_reparse(path)? {
        return Ok(());
    }
    Err(rejected(format!(
        "{role} must be an existing ordinary non-reparse file: {}",
        path.display()
    )))
}

fn payload_kind_order(kind: PayloadKind) -> u8 {
    match kind {
        PayloadKind::CoreAsset => 0,
        PayloadKind::KnownPluginDefinition => 1,
        PayloadKind::DiscoveredPluginStrings => 2,
        PayloadKind::PendingMarker
        | PayloadKind::GenericPlugin
        | PayloadKind::QpaProxySource
        | PayloadKind::FinalMarker => 3,
    }
}

fn slash_normalized(value: &str) -> String {
    value.replace('\\', "/")
}

fn path_key(path: &std::path::Path) -> String {
    path.to_string_lossy()
        .trim_start_matches(r"\\?\")
        .replace('/', "\\")
        .trim_end_matches('\\')
        .to_lowercase()
}
