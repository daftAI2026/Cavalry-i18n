/**
 * [INPUT]: 依赖 install::LANG_MARKER_NAME、patch::CopyPair、typed plist 与 runtime staging 目录。
 * [OUTPUT]: 对外提供 wrapper、trusted bytes/path 驱动的 binary/XML Info.plist 安全改写、按 wrapper→Info 顺序生成的翻译 runtime copy pair、独立语言 marker 及 macOS 包装 injector 来源解析；final marker 可见前拒绝运行未封口 outer transaction。
 * [POS]: src-tauri/src 的 macOS runtime patch 模块；非 English 构造 wrapper/injector，并让 transaction 在 Info.plist 首次改道前先落 journal-aware launcher；普通 English 仅在已管理 runtime 上切 marker，官方还原由 mac_official 独立负责。wrapper 明确拥有 CAVALRY_I18N_LANG、仅拥有 injector 那一项 DYLD，保留并去重调用者其它 DYLD 注入。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
use std::{fs, io::Cursor, path::Path};

use crate::patch::CopyPair;

#[cfg(unix)]
use std::os::unix::fs::PermissionsExt;

pub const INJECTOR_DYLIB_NAME: &str = "libCavalryTranslatorInjector.dylib";
pub const WRAPPER_EXECUTABLE_NAME: &str = "CavalryLauncher";
pub use crate::install::LANG_MARKER_NAME;

#[cfg(target_os = "macos")]
pub(crate) fn injector_source_candidates(
    repo_root: &Path,
    resource_dir: &Path,
) -> Vec<std::path::PathBuf> {
    let suffixes = [
        std::path::PathBuf::from("injector").join(INJECTOR_DYLIB_NAME),
        std::path::PathBuf::from(INJECTOR_DYLIB_NAME),
    ];
    let mut roots = vec![resource_dir.to_path_buf(), resource_dir.join("_up_")];
    if let Some(parent) = resource_dir.parent() {
        roots.push(parent.to_path_buf());
    }
    let mut candidates = roots
        .into_iter()
        .flat_map(|root| suffixes.iter().map(move |suffix| root.join(suffix)))
        .collect::<Vec<_>>();
    candidates.push(repo_root.join("injector").join(INJECTOR_DYLIB_NAME));
    candidates.dedup();
    candidates
}

#[cfg(target_os = "macos")]
pub(crate) fn injector_source_path(
    repo_root: &Path,
    resource_dir: &Path,
) -> Result<std::path::PathBuf, String> {
    injector_source_candidates(repo_root, resource_dir)
        .into_iter()
        .find(|candidate| candidate.exists())
        .ok_or_else(|| {
            format!(
                "Packaged injector missing. Checked Resources/injector and repo injector/ for {}.",
                INJECTOR_DYLIB_NAME
            )
        })
}

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
if [ "$LANG_CODE" = "pending" ]; then
  echo "Cavalry language update is incomplete; reopen Cavalry Language Switcher to recover it." >&2
  exit 75
fi
# CAVALRY_I18N_LANG is wrapper-owned model input: never inherit the caller's value.
# DYLD_INSERT_LIBRARIES is mixed ownership: remove only this exact injector and preserve
# all external entries, de-duplicated in their original order.
strip_owned_injector() {{
  value="${{1-}}"
  result=""
  while [ -n "$value" ]; do
    case "$value" in
      *:*)
        entry="${{value%%:*}}"
        value="${{value#*:}}"
        ;;
      *)
        entry="$value"
        value=""
        ;;
    esac
    [ -n "$entry" ] || continue
    [ "$entry" = "$INJECTOR_PATH" ] && continue
    case ":$result:" in
      *":$entry:"*) continue ;;
    esac
    if [ -n "$result" ]; then
      result="$result:$entry"
    else
      result="$entry"
    fi
  done
  printf '%s' "$result"
}}
EXTERNAL_DYLD="$(strip_owned_injector "${{DYLD_INSERT_LIBRARIES-}}")"
if [ -f "$INJECTOR_PATH" ] && {{ [ "$LANG_CODE" = "zh-Hans" ] || [ "$LANG_CODE" = "zh-Hant" ] || [ "$LANG_CODE" = "ja_JP" ]; }}; then
  if [ -n "$EXTERNAL_DYLD" ]; then
    export DYLD_INSERT_LIBRARIES="$INJECTOR_PATH:$EXTERNAL_DYLD"
  else
    export DYLD_INSERT_LIBRARIES="$INJECTOR_PATH"
  fi
  export CAVALRY_I18N_LANG="$LANG_CODE"
else
  if [ -n "$EXTERNAL_DYLD" ]; then
    export DYLD_INSERT_LIBRARIES="$EXTERNAL_DYLD"
  else
  unset DYLD_INSERT_LIBRARIES
  fi
  unset CAVALRY_I18N_LANG
fi
# A final-marker commit is not visible until the outer macOS transaction journal has
# disappeared.  Always inspect the default journal, even when the caller redirects
# ordinary state to CAVALRY_I18N_STATE_DIR; the override must not bypass this run gate.
DEFAULT_STATE_DIR=""
if [ -n "${{HOME-}}" ]; then
  DEFAULT_STATE_DIR="$HOME/Library/Application Support/com.daftai.cavalry-i18n"
fi
TRANSACTION_JOURNAL_NAME="macos-apply-transaction"
transaction_journal_present() {{
  [ -e "$1" ] || [ -L "$1" ]
}}
if [ -n "$DEFAULT_STATE_DIR" ] && transaction_journal_present "$DEFAULT_STATE_DIR/$TRANSACTION_JOURNAL_NAME"; then
  echo "Cavalry language update is still in progress; reopen Cavalry Language Switcher after the macOS transaction is sealed." >&2
  exit 75
fi
if [ -n "${{CAVALRY_I18N_STATE_DIR-}}" ] && transaction_journal_present "$CAVALRY_I18N_STATE_DIR/$TRANSACTION_JOURNAL_NAME"; then
  echo "Cavalry language update is still in progress; reopen Cavalry Language Switcher after the macOS transaction is sealed." >&2
  exit 75
fi
exec "$SELF_DIR/Cavalry" "$@"
"#
    )
}

pub fn build_language_marker_pair(
    app_path: &Path,
    lang: &str,
    staging_dir: &Path,
) -> Result<CopyPair, String> {
    if !matches!(lang, "en" | "zh-Hans" | "zh-Hant" | "ja_JP") {
        return Err(format!("Unsupported macOS language marker: {lang}"));
    }
    fs::create_dir_all(staging_dir).map_err(|error| error.to_string())?;
    let marker_source = staging_dir.join(LANG_MARKER_NAME);
    fs::write(&marker_source, format!("{lang}\n")).map_err(|error| error.to_string())?;
    Ok(CopyPair {
        src: marker_source,
        dst: app_path.join("Contents/Resources").join(LANG_MARKER_NAME),
    })
}

pub fn build_wrapped_info_plist(source: &[u8]) -> Result<Vec<u8>, String> {
    let binary = source.starts_with(b"bplist00");
    let mut value = plist::Value::from_reader(Cursor::new(source))
        .map_err(|error| format!("Could not parse Info.plist: {error}"))?;
    let dictionary = value
        .as_dictionary_mut()
        .ok_or_else(|| "Info.plist root is not a dictionary.".to_string())?;
    let executable = dictionary
        .get("CFBundleExecutable")
        .and_then(plist::Value::as_string)
        .ok_or_else(|| "Info.plist CFBundleExecutable is not a string.".to_string())?;
    if executable != "Cavalry" && executable != WRAPPER_EXECUTABLE_NAME {
        return Err(format!(
            "Refusing unexpected CFBundleExecutable value: {executable}."
        ));
    }
    dictionary.insert(
        "CFBundleExecutable".to_string(),
        plist::Value::String(WRAPPER_EXECUTABLE_NAME.to_string()),
    );

    let mut output = Vec::new();
    if binary {
        plist::to_writer_binary(&mut output, &value)
            .map_err(|error| format!("Could not encode binary Info.plist: {error}"))?;
    } else {
        plist::to_writer_xml(&mut output, &value)
            .map_err(|error| format!("Could not encode XML Info.plist: {error}"))?;
    }
    Ok(output)
}

pub fn build_runtime_pairs(
    app_path: &Path,
    lang: &str,
    staging_dir: &Path,
    injector_source_path: &Path,
) -> Result<Vec<CopyPair>, String> {
    let info_plist = fs::read(app_path.join("Contents/Info.plist"))
        .map_err(|error| format!("Could not read current Info.plist: {error}"))?;
    build_runtime_pairs_from_trusted_info_plist(
        app_path,
        lang,
        staging_dir,
        injector_source_path,
        &info_plist,
    )
}

/// Build the managed translated runtime from caller-provided official Info.plist bytes.  The
/// legacy [`build_runtime_pairs`] API remains for compatibility, but unified macOS restore must
/// pass bytes from its trusted vendor baseline so a drifted live app cannot become the wrapper's
/// source identity.
pub fn build_runtime_pairs_from_trusted_info_plist(
    app_path: &Path,
    lang: &str,
    staging_dir: &Path,
    injector_source_path: &Path,
    trusted_info_plist: &[u8],
) -> Result<Vec<CopyPair>, String> {
    if lang == "en" {
        return Err(
            "build_runtime_pairs only prepares the translated macOS wrapper. English UI must reuse the verified managed runtime and update only its language marker; official restore is a separate action."
                .to_string(),
        );
    }
    let _ = fs::remove_dir_all(staging_dir);
    fs::create_dir_all(staging_dir).map_err(|error| error.to_string())?;
    let wrapper_source = staging_dir.join(WRAPPER_EXECUTABLE_NAME);
    let info_source = staging_dir.join("Info.plist");

    fs::write(&wrapper_source, build_launch_wrapper()).map_err(|error| error.to_string())?;
    #[cfg(unix)]
    fs::set_permissions(&wrapper_source, fs::Permissions::from_mode(0o755))
        .map_err(|error| error.to_string())?;
    fs::write(&info_source, build_wrapped_info_plist(trusted_info_plist)?)
        .map_err(|error| error.to_string())?;
    let marker_pair = build_language_marker_pair(app_path, lang, staging_dir)?;

    Ok(vec![
        CopyPair {
            src: wrapper_source,
            dst: app_path
                .join("Contents/MacOS")
                .join(WRAPPER_EXECUTABLE_NAME),
        },
        CopyPair {
            src: info_source,
            dst: app_path.join("Contents/Info.plist"),
        },
        CopyPair {
            src: injector_source_path.to_path_buf(),
            dst: app_path
                .join("Contents/Frameworks")
                .join(INJECTOR_DYLIB_NAME),
        },
        marker_pair,
    ])
}

/// Path form of [`build_runtime_pairs_from_trusted_info_plist`].  The trusted source itself is
/// lstat-checked so a caller cannot accidentally provide a symlink to a mutable live plist.
pub fn build_runtime_pairs_from_trusted_info_plist_path(
    app_path: &Path,
    lang: &str,
    staging_dir: &Path,
    injector_source_path: &Path,
    trusted_info_plist_path: &Path,
) -> Result<Vec<CopyPair>, String> {
    let metadata = fs::symlink_metadata(trusted_info_plist_path).map_err(|error| {
        format!(
            "Could not inspect trusted Info.plist {}: {error}",
            trusted_info_plist_path.display()
        )
    })?;
    if metadata.file_type().is_symlink() || !metadata.is_file() {
        return Err(format!(
            "Trusted Info.plist is not a regular non-symlink file: {}",
            trusted_info_plist_path.display()
        ));
    }
    let trusted_info_plist = fs::read(trusted_info_plist_path).map_err(|error| {
        format!(
            "Could not read trusted Info.plist {}: {error}",
            trusted_info_plist_path.display()
        )
    })?;
    build_runtime_pairs_from_trusted_info_plist(
        app_path,
        lang,
        staging_dir,
        injector_source_path,
        &trusted_info_plist,
    )
}

#[cfg(test)]
mod tests {
    use super::{build_launch_wrapper, build_wrapped_info_plist, LANG_MARKER_NAME};

    fn xml_info_plist() -> &'static [u8] {
        br#"<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict><key>CFBundleExecutable</key><string>Cavalry</string></dict></plist>"#
    }

    #[test]
    fn build_launch_wrapper_matches_runtime_contract() {
        let wrapper = build_launch_wrapper();
        assert!(wrapper.contains("DYLD_INSERT_LIBRARIES"));
        assert!(wrapper.contains("CAVALRY_I18N_LANG"));
        assert!(wrapper.contains(LANG_MARKER_NAME));
    }

    #[test]
    fn rewrite_info_plist_executable_to_wrapper() {
        let output = build_wrapped_info_plist(xml_info_plist()).unwrap();
        let value = plist::Value::from_reader(std::io::Cursor::new(output)).unwrap();
        assert_eq!(
            value
                .as_dictionary()
                .unwrap()
                .get("CFBundleExecutable")
                .and_then(plist::Value::as_string),
            Some("CavalryLauncher")
        );
    }

    #[test]
    fn binary_info_plist_remains_binary_after_typed_rewrite() {
        let mut dictionary = plist::Dictionary::new();
        dictionary.insert(
            "CFBundleExecutable".to_string(),
            plist::Value::String("Cavalry".to_string()),
        );
        let mut source = Vec::new();
        plist::to_writer_binary(&mut source, &plist::Value::Dictionary(dictionary)).unwrap();

        let output = build_wrapped_info_plist(&source).unwrap();
        assert!(output.starts_with(b"bplist00"));
    }

    #[test]
    fn runtime_pairs_refuse_english_translation_wrapper() {
        let temp = tempfile::tempdir().unwrap();
        let app = temp.path().join("Cavalry.app");
        std::fs::create_dir_all(app.join("Contents")).unwrap();
        std::fs::write(app.join("Contents/Info.plist"), xml_info_plist()).unwrap();
        let injector = temp.path().join("injector.dylib");
        std::fs::write(&injector, "").unwrap();
        let error = super::build_runtime_pairs(&app, "en", &temp.path().join("stage"), &injector)
            .unwrap_err();
        assert!(error.contains("English UI must reuse the verified managed runtime"));
    }

    #[test]
    fn trusted_info_plist_bytes_win_over_drifted_live_app_info() {
        let temp = tempfile::tempdir().unwrap();
        let app = temp.path().join("Cavalry.app");
        std::fs::create_dir_all(app.join("Contents")).unwrap();
        std::fs::write(
            app.join("Contents/Info.plist"),
            br#"<?xml version="1.0"?><plist version="1.0"><dict><key>CFBundleExecutable</key><string>Cavalry</string><key>CFBundleIdentifier</key><string>drifted.live</string></dict></plist>"#,
        )
        .unwrap();
        let trusted = br#"<?xml version="1.0"?><plist version="1.0"><dict><key>CFBundleExecutable</key><string>Cavalry</string><key>CFBundleIdentifier</key><string>official.baseline</string></dict></plist>"#;
        let injector = temp.path().join("injector.dylib");
        std::fs::write(&injector, "injector").unwrap();

        let pairs = super::build_runtime_pairs_from_trusted_info_plist(
            &app,
            "zh-Hans",
            &temp.path().join("stage"),
            &injector,
            trusted,
        )
        .unwrap();
        let info = pairs
            .iter()
            .find(|pair| pair.dst.ends_with("Contents/Info.plist"))
            .unwrap();
        let value =
            plist::Value::from_reader(std::io::Cursor::new(std::fs::read(&info.src).unwrap()))
                .unwrap();
        let dictionary = value.as_dictionary().unwrap();
        assert_eq!(
            dictionary
                .get("CFBundleIdentifier")
                .and_then(plist::Value::as_string),
            Some("official.baseline")
        );
        assert_eq!(
            dictionary
                .get("CFBundleExecutable")
                .and_then(plist::Value::as_string),
            Some(super::WRAPPER_EXECUTABLE_NAME)
        );
    }

    #[cfg(unix)]
    #[test]
    fn wrapper_preserves_and_deduplicates_inherited_dyld_libraries() {
        use std::{os::unix::fs::PermissionsExt, process::Command};

        let temp = tempfile::tempdir().unwrap();
        let app = temp.path().join("Cavalry.app");
        let macos = app.join("Contents/MacOS");
        let resources = app.join("Contents/Resources");
        let frameworks = app.join("Contents/Frameworks");
        std::fs::create_dir_all(&macos).unwrap();
        std::fs::create_dir_all(&resources).unwrap();
        std::fs::create_dir_all(&frameworks).unwrap();
        let wrapper_path = macos.join(super::WRAPPER_EXECUTABLE_NAME);
        // macOS SIP strips DYLD_* while it launches the /bin/sh interpreter used by
        // this fixture. Exercise the exact wrapper logic under a neutral test-only
        // variable name so inherited-value and de-duplication semantics stay observable.
        let wrapper_fixture =
            build_launch_wrapper().replace("DYLD_INSERT_LIBRARIES", "CAVALRY_TEST_DYLD");
        std::fs::write(&wrapper_path, wrapper_fixture).unwrap();
        std::fs::set_permissions(&wrapper_path, std::fs::Permissions::from_mode(0o755)).unwrap();
        let cavalry = macos.join("Cavalry");
        std::fs::write(
            &cavalry,
            "#!/bin/sh\nprintf '%s\\n%s\\n' \"${CAVALRY_TEST_DYLD-}\" \"${CAVALRY_I18N_LANG-}\"\n",
        )
        .unwrap();
        std::fs::set_permissions(&cavalry, std::fs::Permissions::from_mode(0o755)).unwrap();
        std::fs::write(resources.join(LANG_MARKER_NAME), "zh-Hans\n").unwrap();
        let injector = frameworks.join(super::INJECTOR_DYLIB_NAME);
        std::fs::write(&injector, "injector").unwrap();

        let inherited = "/external/first.dylib:/external/second.dylib";
        let output = Command::new(&wrapper_path)
            .env("HOME", temp.path())
            .env_remove("CAVALRY_I18N_STATE_DIR")
            .env("CAVALRY_TEST_DYLD", inherited)
            .output()
            .unwrap();
        assert!(output.status.success());
        let stdout = String::from_utf8(output.stdout).unwrap();
        assert_eq!(
            stdout,
            format!("{}:{}\nzh-Hans\n", injector.display(), inherited)
        );

        let output = Command::new(&wrapper_path)
            .env("HOME", temp.path())
            .env_remove("CAVALRY_I18N_STATE_DIR")
            .env(
                "CAVALRY_TEST_DYLD",
                format!("{}:{inherited}", injector.display()),
            )
            .output()
            .unwrap();
        assert!(output.status.success());
        assert_eq!(
            String::from_utf8(output.stdout).unwrap(),
            format!("{}:{inherited}\nzh-Hans\n", injector.display())
        );

        let owned_and_duplicate_external = format!(
            "{}:{inherited}:{}:/external/first.dylib",
            injector.display(),
            injector.display()
        );
        let output = Command::new(&wrapper_path)
            .env("HOME", temp.path())
            .env_remove("CAVALRY_I18N_STATE_DIR")
            .env("CAVALRY_TEST_DYLD", owned_and_duplicate_external)
            .env("CAVALRY_I18N_LANG", "caller-value")
            .output()
            .unwrap();
        assert!(output.status.success());
        assert_eq!(
            String::from_utf8(output.stdout).unwrap(),
            format!("{}:{inherited}\nzh-Hans\n", injector.display())
        );

        std::fs::remove_file(resources.join(LANG_MARKER_NAME)).unwrap();
        let output = Command::new(&wrapper_path)
            .env("HOME", temp.path())
            .env_remove("CAVALRY_I18N_STATE_DIR")
            .env("CAVALRY_TEST_DYLD", inherited)
            .env("CAVALRY_I18N_LANG", "external-value")
            .output()
            .unwrap();
        assert!(output.status.success());
        assert_eq!(
            String::from_utf8(output.stdout).unwrap(),
            format!("{inherited}\n\n")
        );

        let output = Command::new(&wrapper_path)
            .env("HOME", temp.path())
            .env_remove("CAVALRY_I18N_STATE_DIR")
            .env(
                "CAVALRY_TEST_DYLD",
                format!("{}:{inherited}:{}", injector.display(), injector.display()),
            )
            .env("CAVALRY_I18N_LANG", "caller-value")
            .output()
            .unwrap();
        assert!(output.status.success());
        assert_eq!(
            String::from_utf8(output.stdout).unwrap(),
            format!("{inherited}\n\n")
        );

        let default_journal = temp
            .path()
            .join("Library/Application Support/com.daftai.cavalry-i18n")
            .join("macos-apply-transaction");
        let override_state_dir = temp.path().join("redirected-state");
        let override_journal = override_state_dir.join("macos-apply-transaction");
        std::fs::create_dir_all(default_journal.parent().unwrap()).unwrap();
        std::fs::create_dir_all(&override_state_dir).unwrap();

        // The default journal is always authoritative; a state-dir override must not
        // let the wrapper bypass the final-marker transaction gate.
        std::fs::write(&default_journal, "pending").unwrap();
        let output = Command::new(&wrapper_path)
            .env("HOME", temp.path())
            .env("CAVALRY_I18N_STATE_DIR", &override_state_dir)
            .env("CAVALRY_TEST_DYLD", inherited)
            .output()
            .unwrap();
        assert_eq!(output.status.code(), Some(75));
        assert!(String::from_utf8_lossy(&output.stderr).contains("transaction is sealed"));

        std::fs::remove_file(&default_journal).unwrap();
        // The redirected journal is also a hard stop once the default path is clear.
        std::fs::write(&override_journal, "pending").unwrap();
        let output = Command::new(&wrapper_path)
            .env("HOME", temp.path())
            .env("CAVALRY_I18N_STATE_DIR", &override_state_dir)
            .env("CAVALRY_TEST_DYLD", inherited)
            .output()
            .unwrap();
        assert_eq!(output.status.code(), Some(75));
        assert!(String::from_utf8_lossy(&output.stderr).contains("transaction is sealed"));
    }
}
