/**
 * [INPUT]: 依赖 detect/state/patch/mac_runtime/privilege 模块、chrono/serde 与原子计数 staging id
 * [OUTPUT]: 对外提供 get_status、browse_app、extract_english、apply_language、open_privacy_security、restart_cavalry 6 个 Tauri command
 * [POS]: src-tauri/src 的 renderer API 等价层，返回 renderer 兼容 JSON shape
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
use chrono::{SecondsFormat, Utc};
use serde::Serialize;
use std::{
    fs,
    io::ErrorKind,
    path::{Path, PathBuf},
    process,
    sync::atomic::{AtomicU64, Ordering},
};
use tauri::Manager;

use crate::{
    detect, mac_runtime, patch,
    privilege::{self, CommandRunner, RealCommandRunner},
    state::{self, State},
};

pub const COMMAND_NAMES: [&str; 6] = [
    "get_status",
    "browse_app",
    "extract_english",
    "apply_language",
    "open_privacy_security",
    "restart_cavalry",
];
static STAGING_COUNTER: AtomicU64 = AtomicU64::new(0);

#[derive(Debug, Serialize, PartialEq, Eq)]
pub struct LanguageChoice {
    pub value: String,
    pub label: String,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct BundleDiagnostics {
    pub exists: bool,
    pub app_path: String,
    pub version: String,
    pub has_assets_root: bool,
    pub has_definitions: bool,
    pub has_learn: bool,
    pub has_plugins: bool,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct StatusPayload {
    pub app_management_granted: Option<bool>,
    pub app_path: String,
    pub current_lang: String,
    pub default_app_candidates: Vec<String>,
    pub diagnostics: Option<BundleDiagnostics>,
    pub languages: Vec<LanguageChoice>,
    pub needs_extract: bool,
    pub repo_root: String,
    pub version: String,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct BrowsePayload {
    pub canceled: bool,
    #[serde(skip_serializing_if = "String::is_empty")]
    pub app_path: String,
    #[serde(skip_serializing_if = "String::is_empty")]
    pub version: String,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ActionPayload {
    pub ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub count: Option<usize>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub current_lang: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub warning: Option<String>,
    #[serde(skip_serializing_if = "is_false")]
    pub permission_required: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

pub fn registered_command_names() -> &'static [&'static str] {
    &COMMAND_NAMES
}

fn repo_root() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .unwrap_or_else(|| Path::new(env!("CARGO_MANIFEST_DIR")))
        .to_path_buf()
}

fn fallback_state_dir() -> PathBuf {
    std::env::var_os("CAVALRY_I18N_STATE_DIR")
        .map(PathBuf::from)
        .unwrap_or_else(|| std::env::temp_dir().join("cavalry-i18n-tauri-state"))
}

fn state_dir_for_app(app: &tauri::AppHandle) -> PathBuf {
    std::env::var_os("CAVALRY_I18N_STATE_DIR")
        .map(PathBuf::from)
        .or_else(|| app.path().app_data_dir().ok())
        .unwrap_or_else(fallback_state_dir)
}

fn resource_dir_for_app(app: &tauri::AppHandle) -> PathBuf {
    app.path().resource_dir().unwrap_or_else(|_| repo_root())
}

fn labels(code: &str) -> &str {
    match code {
        "en" => "English",
        "zh-Hans" => "简体中文",
        "zh-Hant" => "繁体中文",
        "ja_JP" => "日本語",
        _ => code,
    }
}

fn language_choices(languages_dir: &Path) -> Vec<LanguageChoice> {
    let mut choices = vec![LanguageChoice {
        value: "en".to_string(),
        label: labels("en").to_string(),
    }];
    choices.extend(
        detect::list_language_options(languages_dir)
            .into_iter()
            .map(|value| LanguageChoice {
                label: labels(&value).to_string(),
                value,
            }),
    );
    choices
}

fn sync_state_with_bundle(state_dir: &Path, state: State, app_path: &Path, version: &str) -> State {
    if app_path.as_os_str().is_empty() {
        return state;
    }
    let app_path_text = app_path.to_string_lossy().to_string();
    let default_lang = if state.app_path == app_path_text && state.cavalry_version == version {
        state.current_lang.as_str()
    } else {
        "en"
    };
    let next = state::normalize(State {
        app_path: app_path_text,
        cavalry_version: version.to_string(),
        current_lang: detect::read_installed_language(app_path, default_lang),
        last_patched_at: state.last_patched_at.clone(),
    });
    if next == state {
        state
    } else {
        state::write_state(state_dir, &next).unwrap_or(next)
    }
}

fn resolved_state(state_dir: &Path) -> (PathBuf, State, String) {
    let existing_state = state::read_state(state_dir).unwrap_or_default();
    let app_path = detect::find_cavalry_app(&existing_state.app_path);
    let version = detect::read_bundle_version(&app_path).unwrap_or_default();
    let state = sync_state_with_bundle(state_dir, existing_state, &app_path, &version);
    (app_path, state, version)
}

fn status_for_paths(repo_root: &Path, state_dir: &Path) -> StatusPayload {
    let languages_dir = repo_root.join("languages");
    let (app_path, state, version) = resolved_state(state_dir);
    let current_lang = state.current_lang.clone();
    let diagnostics = if app_path.as_os_str().is_empty() {
        None
    } else {
        let info = detect::inspect_bundle(&app_path);
        Some(BundleDiagnostics {
            exists: info.exists,
            app_path: info.app_path,
            version: info.version,
            has_assets_root: info.has_assets_root,
            has_definitions: info.has_definitions,
            has_learn: info.has_learn,
            has_plugins: info.has_plugins,
        })
    };

    StatusPayload {
        app_management_granted: probe_app_management_permission(&app_path),
        app_path: app_path.to_string_lossy().to_string(),
        current_lang,
        default_app_candidates: detect::default_app_candidates()
            .into_iter()
            .map(|candidate| candidate.to_string_lossy().to_string())
            .collect(),
        diagnostics,
        languages: language_choices(&languages_dir),
        needs_extract: !app_path.as_os_str().is_empty()
            && patch::needs_english_snapshot(
                state_dir,
                &state.app_path,
                &state.cavalry_version,
                &app_path,
                &version,
            ),
        repo_root: repo_root.to_string_lossy().to_string(),
        version,
    }
}

#[tauri::command]
pub fn get_status(app: tauri::AppHandle) -> StatusPayload {
    status_for_paths(&repo_root(), &state_dir_for_app(&app))
}

#[tauri::command]
pub fn browse_app(app: tauri::AppHandle) -> BrowsePayload {
    let Some(path) = rfd::FileDialog::new()
        .set_title("Select Cavalry.app")
        .set_directory("/Applications")
        .add_filter("Applications", &["app"])
        .pick_file()
    else {
        return BrowsePayload {
            canceled: true,
            app_path: String::new(),
            version: String::new(),
        };
    };
    let version = detect::read_bundle_version(&path).unwrap_or_default();
    let state_dir = state_dir_for_app(&app);
    let previous = state::read_state(&state_dir).unwrap_or_default();
    let _ = sync_state_with_bundle(
        &state_dir,
        State {
            app_path: path.to_string_lossy().to_string(),
            cavalry_version: version.clone(),
            ..previous
        },
        &path,
        &version,
    );
    BrowsePayload {
        canceled: false,
        app_path: path.to_string_lossy().to_string(),
        version,
    }
}

#[tauri::command(rename_all = "camelCase")]
pub fn extract_english(app: tauri::AppHandle, app_path: String) -> ActionPayload {
    let app_path = PathBuf::from(app_path);
    if app_path.as_os_str().is_empty() {
        return ActionPayload::error("Select a Cavalry.app first.");
    }

    match extract_english_inner(&app_path, &state_dir_for_app(&app)) {
        Ok(count) => ActionPayload::ok_count(count),
        Err(error) => ActionPayload::error(&error),
    }
}

#[tauri::command(rename_all = "camelCase")]
pub fn apply_language(app: tauri::AppHandle, app_path: String, lang: String) -> ActionPayload {
    let mut runner = RealCommandRunner;
    match apply_language_inner(
        &repo_root(),
        &state_dir_for_app(&app),
        &resource_dir_for_app(&app),
        &PathBuf::from(app_path),
        &lang,
        &mut runner,
        &now_iso(),
    ) {
        Ok(payload) => payload,
        Err(error) if is_app_management_error(&error) => ActionPayload::permission_error(&error),
        Err(error) => ActionPayload::error(&error),
    }
}

#[tauri::command]
pub fn open_privacy_security() -> ActionPayload {
    let mut runner = RealCommandRunner;
    match privilege::open_privacy_security(&mut runner) {
        Ok(()) => ActionPayload::ok(),
        Err(error) => ActionPayload::error(&error),
    }
}

#[tauri::command(rename_all = "camelCase")]
pub fn restart_cavalry(app: tauri::AppHandle, app_path: String) -> ActionPayload {
    if app_path.is_empty() {
        return ActionPayload::error("Select a Cavalry.app first.");
    }
    let mut runner = RealCommandRunner;
    match restart_cavalry_inner(
        &state_dir_for_app(&app),
        &PathBuf::from(app_path),
        &mut runner,
    ) {
        Ok(()) => ActionPayload::ok(),
        Err(error) => ActionPayload::error(&error),
    }
}

fn now_iso() -> String {
    Utc::now().to_rfc3339_opts(SecondsFormat::Millis, true)
}

fn is_false(value: &bool) -> bool {
    !*value
}

fn is_app_management_error(error: &str) -> bool {
    let lower = error.to_ascii_lowercase();
    lower.contains("not authorized to send apple events")
        || lower.contains("app management")
        || ((lower.contains("operation not permitted") || lower.contains("privacy"))
            && (error.contains(".app") || error.contains("/Applications/")))
}

fn probe_app_management_permission(app_path: &Path) -> Option<bool> {
    if !cfg!(target_os = "macos") || app_path.as_os_str().is_empty() {
        return None;
    }
    let probe_dir = app_path.join("Contents").join("Resources");
    if !probe_dir.is_dir() {
        return None;
    }

    let probe_path = probe_dir.join(format!(
        ".cavalry-i18n-probe-{}-{}-{}",
        process::id(),
        Utc::now().timestamp_millis(),
        STAGING_COUNTER.fetch_add(1, Ordering::Relaxed)
    ));
    let granted = match fs::write(&probe_path, []) {
        Ok(()) => Some(true),
        Err(error) if error.kind() == ErrorKind::PermissionDenied => Some(false),
        Err(_) => None,
    };
    let _ = fs::remove_file(&probe_path);
    granted
}

fn unique_staging_root() -> PathBuf {
    std::env::temp_dir().join(format!(
        "cavalry-i18n-tauri-staging-{}-{}-{}",
        std::process::id(),
        Utc::now().timestamp_millis(),
        STAGING_COUNTER.fetch_add(1, Ordering::Relaxed)
    ))
}

pub fn extract_english_inner(app_path: &Path, state_dir: &Path) -> Result<usize, String> {
    let version = detect::read_bundle_version(app_path).unwrap_or_default();
    let current_state = sync_state_with_bundle(
        state_dir,
        state::read_state(state_dir).unwrap_or_default(),
        app_path,
        &version,
    );
    let count = patch::extract_english(app_path, &state_dir.join("en"))?;
    let _ = state::write_state(
        state_dir,
        &State {
            app_path: app_path.to_string_lossy().to_string(),
            cavalry_version: version,
            current_lang: if current_state.app_path == app_path.to_string_lossy().as_ref() {
                current_state.current_lang
            } else {
                "en".to_string()
            },
            last_patched_at: current_state.last_patched_at,
        },
    )?;
    Ok(count)
}

pub fn apply_language_inner<R: CommandRunner>(
    repo_root: &Path,
    state_dir: &Path,
    resource_dir: &Path,
    app_path: &Path,
    lang: &str,
    runner: &mut R,
    now: &str,
) -> Result<ActionPayload, String> {
    if app_path.as_os_str().is_empty() {
        return Err("Select a Cavalry.app first.".to_string());
    }
    if !matches!(lang, "en" | "zh-Hans" | "zh-Hant" | "ja_JP") {
        return Err(format!("Unsupported language: {lang}"));
    }

    let version = detect::read_bundle_version(app_path).unwrap_or_default();
    let current_state = sync_state_with_bundle(
        state_dir,
        state::read_state(state_dir).unwrap_or_default(),
        app_path,
        &version,
    );

    if lang == "en" && current_state.current_lang == "en" {
        return Ok(ActionPayload::ok_lang("en", ""));
    }

    if lang != "en" {
        extract_english_snapshot_or_throw(state_dir, current_state, app_path, &version)?;
    }
    let source_dir = if lang == "en" {
        state_dir.join("en")
    } else {
        repo_root.join("languages").join(lang)
    };

    if !source_dir.exists() {
        return if lang == "en" {
            Err("English snapshot not found. Point the app picker to a clean Cavalry.app and refresh English first.".to_string())
        } else {
            Err(format!("Language files not found for {lang}."))
        };
    }

    let mut pairs = patch::build_copy_pairs(&source_dir, app_path);
    if pairs.is_empty() {
        return Err(format!("No JSON assets found for {lang}."));
    }

    let staging_root = unique_staging_root();
    let copy_mode = (|| {
        if cfg!(target_os = "macos") {
            pairs.extend(
                mac_runtime::build_runtime_pairs(
                    app_path,
                    lang,
                    &staging_root.join("runtime"),
                    &injector_source_path(repo_root, resource_dir)?,
                )
                .map_err(|error| format!("Could not build macOS runtime patch files: {error}"))?,
            );
        }
        let staged_pairs = patch::stage_files(&pairs, &staging_root.join("staged"))
            .map_err(|error| format!("Could not stage patch files: {error}"))?;
        let mode = privilege::copy_with_privilege(&staged_pairs, runner)
            .map_err(|error| format!("Could not copy patch files into Cavalry.app: {error}"))?;
        if cfg!(target_os = "macos") {
            if lang != "en" {
                privilege::patch_keychain_query_attributes_with_privilege(
                    app_path,
                    &staging_root.join("keychain"),
                    runner,
                )
                .map_err(|error| format!("Could not patch Keychain query attributes: {error}"))?;
            }
            privilege::resign_patched_bundle(app_path, runner)
                .map_err(|error| format!("Could not re-sign patched Cavalry.app: {error}"))?;
            privilege::clear_gatekeeper_quarantine(app_path, runner)
                .map_err(|error| format!("Could not clear Gatekeeper quarantine: {error}"))?;
        }
        Ok::<String, String>(mode)
    })();
    let _ = std::fs::remove_dir_all(&staging_root);
    let copy_mode = copy_mode?;

    let next_state = state::write_state(
        state_dir,
        &State {
            app_path: app_path.to_string_lossy().to_string(),
            cavalry_version: version,
            current_lang: lang.to_string(),
            last_patched_at: now.to_string(),
        },
    )?;

    let warning = if copy_mode == "finder" {
        "macOS blocked direct shell copy, so Finder-style replacement was used."
    } else {
        ""
    };
    Ok(ActionPayload::ok_lang(&next_state.current_lang, warning))
}

pub fn restart_cavalry_inner<R: CommandRunner>(
    state_dir: &Path,
    app_path: &Path,
    runner: &mut R,
) -> Result<(), String> {
    if app_path.as_os_str().is_empty() {
        return Err("Select a Cavalry.app first.".to_string());
    }
    let version = detect::read_bundle_version(app_path).unwrap_or_default();
    let _ = sync_state_with_bundle(
        state_dir,
        state::read_state(state_dir).unwrap_or_default(),
        app_path,
        &version,
    );
    privilege::restart_cavalry(app_path, runner)
}

fn extract_english_snapshot_or_throw(
    state_dir: &Path,
    state: State,
    app_path: &Path,
    version: &str,
) -> Result<State, String> {
    if !patch::needs_english_snapshot(
        state_dir,
        &state.app_path,
        &state.cavalry_version,
        app_path,
        version,
    ) {
        return Ok(state);
    }

    let can_refresh = state.current_lang == "en"
        || state.app_path != app_path.to_string_lossy().as_ref()
        || state.cavalry_version != version;
    if !can_refresh {
        return Err("The English snapshot is missing for a translated install. Point the app picker to a clean Cavalry.app and refresh English first.".to_string());
    }
    patch::extract_english(app_path, &state_dir.join("en"))?;
    state::write_state(
        state_dir,
        &State {
            app_path: app_path.to_string_lossy().to_string(),
            cavalry_version: version.to_string(),
            ..state
        },
    )
}

fn injector_source_path(repo_root: &Path, resource_dir: &Path) -> Result<PathBuf, String> {
    let candidates = [
        resource_dir
            .join("injector")
            .join(mac_runtime::INJECTOR_DYLIB_NAME),
        resource_dir.join(mac_runtime::INJECTOR_DYLIB_NAME),
        repo_root.join("injector").join(mac_runtime::INJECTOR_DYLIB_NAME),
    ];
    candidates
        .into_iter()
        .find(|candidate| candidate.exists())
        .ok_or_else(|| {
            format!(
                "Packaged injector missing. Checked Resources/injector and repo injector/ for {}.",
                mac_runtime::INJECTOR_DYLIB_NAME
            )
        })
}

impl ActionPayload {
    fn ok() -> Self {
        Self {
            ok: true,
            count: None,
            current_lang: None,
            warning: None,
            permission_required: false,
            error: None,
        }
    }

    fn ok_count(count: usize) -> Self {
        Self {
            ok: true,
            count: Some(count),
            current_lang: None,
            warning: None,
            permission_required: false,
            error: None,
        }
    }

    fn ok_lang(lang: &str, warning: &str) -> Self {
        Self {
            ok: true,
            count: None,
            current_lang: Some(lang.to_string()),
            warning: Some(warning.to_string()),
            permission_required: false,
            error: None,
        }
    }

    fn error(message: &str) -> Self {
        Self {
            ok: false,
            count: None,
            current_lang: None,
            warning: None,
            permission_required: false,
            error: Some(message.to_string()),
        }
    }

    fn permission_error(message: &str) -> Self {
        Self {
            ok: false,
            count: None,
            current_lang: None,
            warning: None,
            permission_required: true,
            error: Some(message.to_string()),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{
        apply_language_inner, registered_command_names, restart_cavalry_inner, COMMAND_NAMES,
    };
    use crate::privilege::RecordingRunner;
    use std::{fs, path::Path};

    #[test]
    fn registers_six_commands() {
        assert_eq!(
            registered_command_names(),
            &[
                "get_status",
                "browse_app",
                "extract_english",
                "apply_language",
                "open_privacy_security",
                "restart_cavalry"
            ]
        );
        assert_eq!(COMMAND_NAMES.len(), 6);
    }

    fn write(path: &Path, value: impl AsRef<[u8]>) {
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::write(path, value).unwrap();
    }

    fn write_keychain_dylib(app: &Path) {
        let bytes = crate::keychain_patch::build_synthetic_keychain_dylib(Some("arm64"), false);
        write(
            &app.join("Contents/Frameworks/libExtensionLayer.dylib"),
            bytes,
        );
    }

    fn make_bundle(root: &Path) -> std::path::PathBuf {
        let app = root.join("Cavalry.app");
        write(
            &app.join("Contents/Info.plist"),
            r#"<plist><dict>
  <key>CFBundleExecutable</key>
  <string>Cavalry</string>
  <key>CFBundleShortVersionString</key>
  <string>2.3.4</string>
</dict></plist>"#,
        );
        for (_, asset_rel) in crate::patch::CORE_MAP {
            write(
                &app.join("Contents/assets").join(asset_rel),
                br#"{"value":"en"}"#,
            );
        }
        write(
            &app.join("Contents/assets/Plugins/Gaussian Blur Filter/strings.json"),
            br#"{"value":"en plugin"}"#,
        );
        write(
            &app.join("Contents/MacOS/Cavalry"),
            [0xcf, 0xfa, 0xed, 0xfe],
        );
        write(
            &app.join("Contents/MacOS/crashpad_handler"),
            [0xcf, 0xfa, 0xed, 0xfe],
        );
        write(
            &app.join("Contents/Frameworks/libCavalryFramework.dylib"),
            [0xcf, 0xfa, 0xed, 0xfe],
        );
        write_keychain_dylib(&app);
        fs::create_dir_all(app.join("Contents/Resources")).unwrap();
        app
    }

    fn make_language(root: &Path, lang: &str) {
        let base = root.join("languages").join(lang);
        for (lang_rel, _) in crate::patch::CORE_MAP {
            write(&base.join(lang_rel), br#"{"value":"translated"}"#);
        }
        write(
            &base.join("plugins/gaussianBlurFilter.json"),
            br#"{"value":"translated plugin"}"#,
        );
    }

    fn make_english_snapshot(state: &Path) {
        let base = state.join("en");
        for (lang_rel, _) in crate::patch::CORE_MAP {
            write(&base.join(lang_rel), br#"{"value":"en"}"#);
        }
        write(
            &base.join("plugins/gaussianBlurFilter.json"),
            br#"{"value":"en plugin"}"#,
        );
    }

    #[test]
    fn apply_language_patches_fake_bundle_and_records_macos_commands() {
        let temp = tempfile::tempdir().unwrap();
        let repo = temp.path().join("repo");
        let state = temp.path().join("state");
        let resources = temp.path().join("resources");
        let app = make_bundle(temp.path());
        make_language(&repo, "zh-Hans");
        write(
            &resources.join("injector/libCavalryTranslatorInjector.dylib"),
            b"injector",
        );

        let mut runner = RecordingRunner::default();
        let result = apply_language_inner(
            &repo,
            &state,
            &resources,
            &app,
            "zh-Hans",
            &mut runner,
            "2026-04-23T00:00:00.000Z",
        )
        .unwrap();

        assert!(result.ok);
        assert_eq!(result.current_lang.as_deref(), Some("zh-Hans"));
        assert_eq!(
            fs::read_to_string(app.join("Contents/Resources/cavalry-i18n-lang.txt")).unwrap(),
            "zh-Hans\n"
        );
        assert!(fs::read_to_string(app.join("Contents/Info.plist"))
            .unwrap()
            .contains("<string>CavalryLauncher</string>"));
        let (_, keychain_report) = crate::keychain_patch::patch_keychain_query_attributes_bytes(
            &fs::read(app.join("Contents/Frameworks/libExtensionLayer.dylib")).unwrap(),
        )
        .unwrap();
        assert_eq!(keychain_report.already_patched_callsites, 10);
        if cfg!(target_os = "macos") {
            assert!(runner
                .commands
                .iter()
                .any(|command| command.program == "codesign"));
            assert!(runner
                .commands
                .iter()
                .any(|command| command.program == "xattr"));
        }
    }

    #[test]
    fn apply_language_english_skips_keychain_patch() {
        let temp = tempfile::tempdir().unwrap();
        let repo = temp.path().join("repo");
        let state = temp.path().join("state");
        let resources = temp.path().join("resources");
        let app = make_bundle(temp.path());
        make_language(&repo, "zh-Hans");
        make_english_snapshot(&state);
        write(
            &resources.join("injector/libCavalryTranslatorInjector.dylib"),
            b"injector",
        );
        fs::create_dir_all(&state).unwrap();
        fs::write(
            state.join("state.json"),
            format!(
                "{{\"appPath\":\"{}\",\"cavalryVersion\":\"2.3.4\",\"currentLang\":\"zh-Hans\",\"lastPatchedAt\":\"old\"}}\n",
                app.to_string_lossy()
            ),
        )
        .unwrap();
        fs::remove_file(app.join("Contents/Frameworks/libExtensionLayer.dylib")).unwrap();

        let mut runner = RecordingRunner::default();
        let result = apply_language_inner(
            &repo,
            &state,
            &resources,
            &app,
            "en",
            &mut runner,
            "2026-04-23T00:00:00.000Z",
        )
        .unwrap();

        assert!(result.ok);
        assert_eq!(result.current_lang.as_deref(), Some("en"));
    }

    #[test]
    fn apply_language_patch_failure_aborts_resign() {
        let temp = tempfile::tempdir().unwrap();
        let repo = temp.path().join("repo");
        let state = temp.path().join("state");
        let resources = temp.path().join("resources");
        let app = make_bundle(temp.path());
        make_language(&repo, "zh-Hans");
        write(
            &resources.join("injector/libCavalryTranslatorInjector.dylib"),
            b"injector",
        );
        fs::remove_file(app.join("Contents/Frameworks/libExtensionLayer.dylib")).unwrap();

        let mut runner = RecordingRunner::default();
        let error = apply_language_inner(
            &repo,
            &state,
            &resources,
            &app,
            "zh-Hans",
            &mut runner,
            "2026-04-23T00:00:00.000Z",
        )
        .unwrap_err();

        assert!(
            error.contains("libExtensionLayer.dylib not found"),
            "{error}"
        );
        assert!(!runner
            .commands
            .iter()
            .any(|command| command.program == "codesign"));
    }

    #[test]
    fn restart_cavalry_inner_uses_runner() {
        let temp = tempfile::tempdir().unwrap();
        let app = make_bundle(temp.path());
        let mut runner = RecordingRunner::default();
        restart_cavalry_inner(&temp.path().join("state"), &app, &mut runner).unwrap();
        assert_eq!(runner.commands[0].program, "osascript");
        assert_eq!(runner.commands[1].program, "open");
    }
}
