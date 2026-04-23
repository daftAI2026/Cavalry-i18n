/**
 * [INPUT]: 依赖 patch::CopyPair 与 Info.plist/runtime staging 目录
 * [OUTPUT]: 对外提供 build_launch_wrapper、build_wrapped_info_plist、build_runtime_pairs
 * [POS]: src-tauri/src 的 macOS runtime patch 模块，集中 wrapper、marker、injector 目标路径
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
use std::{fs, path::Path};

use crate::patch::CopyPair;

pub const INJECTOR_DYLIB_NAME: &str = "libCavalryTranslatorInjector.dylib";
pub const WRAPPER_EXECUTABLE_NAME: &str = "CavalryLauncher";
pub const LANG_MARKER_NAME: &str = "cavalry-i18n-lang.txt";

pub fn build_launch_wrapper() -> String {
    format!(
        r#"#!/bin/sh
set -eu
SELF_DIR="$(CDPATH= cd -- "$(dirname "$0")" && pwd)"
APP_ROOT="$(CDPATH= cd -- "$SELF_DIR/.." && pwd)"
LANG_FILE="$APP_ROOT/Resources/{LANG_MARKER_NAME}"
INJECTOR_PATH="$APP_ROOT/Frameworks/{INJECTOR_DYLIB_NAME}"
LANG_CODE=""
if [ -f "$LANG_FILE" ]; then
  LANG_CODE="$(tr -d '\n' < "$LANG_FILE")"
fi
if [ -n "$LANG_CODE" ] && [ -f "$INJECTOR_PATH" ]; then
  export DYLD_INSERT_LIBRARIES="$INJECTOR_PATH"
  export CAVALRY_I18N_LANG="$LANG_CODE"
else
  unset DYLD_INSERT_LIBRARIES
  unset CAVALRY_I18N_LANG
fi
exec "$SELF_DIR/Cavalry" "$@"
"#
    )
}

pub fn build_wrapped_info_plist(source: &str) -> Result<String, String> {
    if source.contains(&format!("<string>{WRAPPER_EXECUTABLE_NAME}</string>")) {
        return Ok(source.to_string());
    }

    let key = "<key>CFBundleExecutable</key>";
    let key_start = source
        .find(key)
        .ok_or_else(|| "Could not update CFBundleExecutable in Info.plist.".to_string())?;
    let after_key = key_start + key.len();
    let string_open = source[after_key..]
        .find("<string>")
        .map(|index| after_key + index + "<string>".len())
        .ok_or_else(|| "Could not update CFBundleExecutable in Info.plist.".to_string())?;
    let string_close = source[string_open..]
        .find("</string>")
        .map(|index| string_open + index)
        .ok_or_else(|| "Could not update CFBundleExecutable in Info.plist.".to_string())?;
    if source[string_open..string_close].trim() != "Cavalry" {
        return Err("Could not update CFBundleExecutable in Info.plist.".to_string());
    }

    let mut next = source.to_string();
    next.replace_range(string_open..string_close, WRAPPER_EXECUTABLE_NAME);
    Ok(next)
}

pub fn build_runtime_pairs(
    app_path: &Path,
    lang: &str,
    staging_dir: &Path,
    injector_source_path: &Path,
) -> Result<Vec<CopyPair>, String> {
    let _ = fs::remove_dir_all(staging_dir);
    fs::create_dir_all(staging_dir).map_err(|error| error.to_string())?;
    let wrapper_source = staging_dir.join(WRAPPER_EXECUTABLE_NAME);
    let info_source = staging_dir.join("Info.plist");
    let marker_source = staging_dir.join(LANG_MARKER_NAME);

    let info_plist = fs::read_to_string(app_path.join("Contents/Info.plist"))
        .map_err(|error| error.to_string())?;
    fs::write(&wrapper_source, build_launch_wrapper()).map_err(|error| error.to_string())?;
    fs::write(&info_source, build_wrapped_info_plist(&info_plist)?)
        .map_err(|error| error.to_string())?;
    fs::write(
        &marker_source,
        if lang == "en" {
            String::new()
        } else {
            format!("{lang}\n")
        },
    )
    .map_err(|error| error.to_string())?;

    Ok(vec![
        CopyPair {
            src: info_source,
            dst: app_path.join("Contents/Info.plist"),
        },
        CopyPair {
            src: wrapper_source,
            dst: app_path
                .join("Contents/MacOS")
                .join(WRAPPER_EXECUTABLE_NAME),
        },
        CopyPair {
            src: injector_source_path.to_path_buf(),
            dst: app_path
                .join("Contents/Frameworks")
                .join(INJECTOR_DYLIB_NAME),
        },
        CopyPair {
            src: marker_source,
            dst: app_path.join("Contents/Resources").join(LANG_MARKER_NAME),
        },
    ])
}

#[cfg(test)]
mod tests {
    use super::{build_launch_wrapper, build_wrapped_info_plist, LANG_MARKER_NAME};

    #[test]
    fn build_launch_wrapper_matches_electron() {
        let wrapper = build_launch_wrapper();
        assert!(wrapper.contains("DYLD_INSERT_LIBRARIES"));
        assert!(wrapper.contains("CAVALRY_I18N_LANG"));
        assert!(wrapper.contains(LANG_MARKER_NAME));
    }

    #[test]
    fn rewrite_info_plist_executable_to_wrapper() {
        let source = "<key>CFBundleExecutable</key>\n  <string>Cavalry</string>".to_string();
        assert!(build_wrapped_info_plist(&source)
            .unwrap()
            .contains("<string>CavalryLauncher</string>"));
    }

    #[test]
    fn lang_marker_empty_for_english() {
        let temp = tempfile::tempdir().unwrap();
        let app = temp.path().join("Cavalry.app");
        std::fs::create_dir_all(app.join("Contents")).unwrap();
        std::fs::write(
            app.join("Contents/Info.plist"),
            "<key>CFBundleExecutable</key><string>Cavalry</string>",
        )
        .unwrap();
        let injector = temp.path().join("injector.dylib");
        std::fs::write(&injector, "").unwrap();
        let pairs =
            super::build_runtime_pairs(&app, "en", &temp.path().join("stage"), &injector).unwrap();
        let marker = pairs
            .iter()
            .find(|pair| pair.dst.ends_with(super::LANG_MARKER_NAME))
            .unwrap();
        assert_eq!(std::fs::read_to_string(&marker.src).unwrap(), "");
    }
}
