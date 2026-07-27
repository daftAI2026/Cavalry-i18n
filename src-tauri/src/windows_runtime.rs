/**
 * [INPUT]: 依赖 InstallLayout、windows_qpa ACTIVE 状态、generic/QPA 打包资源、state 与 SHA-256。
 * [OUTPUT]: 提供 generic/QPA 可信源解析、语言 marker staging、ACTIVE 启动门与仅含可选诊断 marker 的子进程环境。
 * [POS]: Windows Qt 运行时装配器；原生入口由根 qwindows 代理自举翻译，不再依赖 QT_PLUGIN_PATH、QT_QPA_GENERIC_PLUGINS 或 CAVALRY_I18N_LANG。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
use std::{
    ffi::OsString,
    fs,
    io::{ErrorKind, Read},
    path::{Path, PathBuf},
    thread,
    time::{Duration, Instant},
};

use serde::Deserialize;
use sha2::{Digest, Sha256};

use crate::{
    install::{InstallLayout, InstallPlatform},
    patch::CopyPair,
    state::State,
};

pub const PLUGIN_FILE_NAME: &str = "cavalryi18n.dll";
pub const QPA_PROXY_FILE_NAME: &str = "qwindows.dll";
pub const DIAGNOSTIC_MARKER_FILE_NAME: &str = "cavalryi18n.json";
pub const EXPECTED_QT_VERSION: &str = "6.6.3";
pub const EXPECTED_TRANSLATION_SOURCE: &str = "embedded-generated-table";
pub const MARKER_WAIT_TIMEOUT: Duration = Duration::from_secs(25);

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct WindowsRuntimeLaunch {
    /// 仅传给即将启动的 Cavalry 子进程；绝不写入用户或系统环境。
    pub environment: Vec<(OsString, OsString)>,
    pub diagnostic_marker: Option<PathBuf>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct DiagnosticMarker {
    plugin: String,
    status: String,
    message: String,
    language: String,
    translation_source: String,
    translator_installed: bool,
    qt_version: String,
    process_id: String,
    embedded_entry_count: usize,
    exact_key_count: usize,
    source_fallback_count: usize,
    extension_layer_hook_status: String,
    extension_layer_hook_detail: String,
}

impl WindowsRuntimeLaunch {
    fn english() -> Self {
        Self {
            environment: Vec::new(),
            diagnostic_marker: None,
        }
    }
}

/// 资源目录优先，兼容 Tauri 在部分 bundle 结构中使用的 `_up_`/父级资源根；最后才回退开发仓库。
pub fn plugin_source_candidates(resource_dir: &Path, repo_root: &Path) -> Vec<PathBuf> {
    let suffix = Path::new("injector")
        .join("windows")
        .join("generic")
        .join(PLUGIN_FILE_NAME);
    let resource_dir = absolute_path(resource_dir);
    let mut roots = vec![resource_dir.clone(), resource_dir.join("_up_")];
    if let Some(parent) = resource_dir.parent() {
        roots.push(parent.to_path_buf());
    }

    let mut candidates = roots
        .into_iter()
        .map(|root| root.join(&suffix))
        .collect::<Vec<_>>();
    candidates.push(absolute_path(repo_root).join(suffix));
    candidates.dedup();
    candidates
}

pub fn resolve_plugin_source(resource_dir: &Path, repo_root: &Path) -> Result<PathBuf, String> {
    let candidates = plugin_source_candidates(resource_dir, repo_root);
    let plugin_path = candidates
        .iter()
        .find(|candidate| candidate.is_file())
        .ok_or_else(|| {
            let checked = candidates
                .iter()
                .map(|candidate| candidate.display().to_string())
                .collect::<Vec<_>>()
                .join(", ");
            format!(
                "Windows Qt translation plugin {PLUGIN_FILE_NAME} was not found. Reinstall Cavalry Language Switcher or build the Windows injector. Checked: {checked}"
            )
        })?;
    Ok(plugin_path.to_path_buf())
}

pub fn qpa_proxy_source_candidates(resource_dir: &Path, repo_root: &Path) -> Vec<PathBuf> {
    let suffix = Path::new("injector")
        .join("windows")
        .join("qpa")
        .join(QPA_PROXY_FILE_NAME);
    let resource_dir = absolute_path(resource_dir);
    let mut roots = vec![resource_dir.clone(), resource_dir.join("_up_")];
    if let Some(parent) = resource_dir.parent() {
        roots.push(parent.to_path_buf());
    }
    let mut candidates = roots
        .into_iter()
        .map(|root| root.join(&suffix))
        .collect::<Vec<_>>();
    candidates.push(absolute_path(repo_root).join(suffix));
    candidates.dedup();
    candidates
}

pub fn resolve_qpa_proxy_source(resource_dir: &Path, repo_root: &Path) -> Result<PathBuf, String> {
    let candidates = qpa_proxy_source_candidates(resource_dir, repo_root);
    candidates
        .iter()
        .find(|candidate| candidate.is_file())
        .cloned()
        .ok_or_else(|| {
            let checked = candidates
                .iter()
                .map(|candidate| candidate.display().to_string())
                .collect::<Vec<_>>()
                .join(", ");
            format!(
                "Windows QPA proxy {QPA_PROXY_FILE_NAME} was not found. Reinstall Cavalry Language Switcher or build the Windows injector. Checked: {checked}"
            )
        })
}

/// 只把已验证的打包/开发 DLL 交给现有 staging + 权限复制链；绝不直接写入 Cavalry。
pub fn build_plugin_copy_pair(
    resource_dir: &Path,
    repo_root: &Path,
    layout: &InstallLayout,
) -> Result<CopyPair, String> {
    let source = resolve_plugin_source(resource_dir, repo_root)?;
    Ok(CopyPair {
        src: source,
        dst: installed_plugin_path(layout)?,
    })
}

/// 把语言真相标记放进与 JSON/runtime DLL 相同的受控复制事务。
/// 调用方必须把该 pair 放在列表末尾，避免资源尚未复制完成时先宣称切换成功。
pub fn build_language_marker_copy_pair(
    layout: &InstallLayout,
    lang: &str,
    staging_dir: &Path,
) -> Result<CopyPair, String> {
    if layout.platform != InstallPlatform::Windows {
        return Err(format!(
            "Windows language marker requires a Windows Cavalry installation, got {}",
            layout.root.display()
        ));
    }
    if !matches!(lang, "en" | "zh-Hans" | "zh-Hant" | "ja_JP") {
        return Err(format!("Unsupported Windows marker language: {lang}"));
    }

    fs::create_dir_all(staging_dir).map_err(|error| {
        format!(
            "Could not create Windows language marker staging directory {}: {error}",
            staging_dir.display()
        )
    })?;
    let source = staging_dir.join(crate::install::LANG_MARKER_NAME);
    fs::write(&source, format!("{lang}\n")).map_err(|error| {
        format!(
            "Could not stage Windows language marker {}: {error}",
            source.display()
        )
    })?;
    Ok(CopyPair {
        src: source,
        dst: layout.language_marker.clone(),
    })
}

pub fn installed_plugin_path(layout: &InstallLayout) -> Result<PathBuf, String> {
    if layout.platform != InstallPlatform::Windows {
        return Err(format!(
            "Windows Qt runtime requires a Windows Cavalry installation, got {}",
            layout.root.display()
        ));
    }
    Ok(layout.root.join("generic").join(PLUGIN_FILE_NAME))
}

pub fn diagnostic_marker_path(state_dir: &Path) -> PathBuf {
    absolute_path(state_dir)
        .join("runtime")
        .join(DIAGNOSTIC_MARKER_FILE_NAME)
}

/// 为一次 Windows Cavalry 启动建立环境描述。该函数只准备数据和 marker，不触碰全局环境。
pub fn prepare_launch(
    layout: &InstallLayout,
    state_dir: &Path,
    state: &State,
    resource_dir: &Path,
    repo_root: &Path,
) -> Result<WindowsRuntimeLaunch, String> {
    prepare_launch_with_qpa_inspector(
        layout,
        state_dir,
        state,
        resource_dir,
        repo_root,
        crate::windows_qpa::inspect,
    )
}

pub(crate) fn prepare_launch_with_qpa_inspector<F>(
    layout: &InstallLayout,
    state_dir: &Path,
    state: &State,
    resource_dir: &Path,
    repo_root: &Path,
    inspect_qpa: F,
) -> Result<WindowsRuntimeLaunch, String>
where
    F: Fn(&InstallLayout) -> Result<crate::windows_qpa::QpaInspection, String>,
{
    let marker = diagnostic_marker_path(state_dir);
    if state.current_lang == "en" {
        // 英语不依赖插件；清理失败也不能阻断原生 English 启动。
        let _ = remove_marker(&marker);
        return Ok(WindowsRuntimeLaunch::english());
    }
    if !matches!(state.current_lang.as_str(), "zh-Hans" | "zh-Hant" | "ja_JP") {
        return Err(format!(
            "Unsupported Windows runtime language: {}",
            state.current_lang
        ));
    }

    let installed_plugin = installed_plugin_path(layout)?;
    if !installed_plugin.is_file() {
        return Err(format!(
            "Windows Qt translation plugin is not installed for this Cavalry copy: {}. Reapply the selected language before restarting.",
            installed_plugin.display()
        ));
    }
    let trusted_plugin = resolve_plugin_source(resource_dir, repo_root).map_err(|error| {
        format!(
            "Could not verify the installed Windows Qt translation plugin before restarting. {error} Reapply the selected language before restarting."
        )
    })?;
    verify_installed_plugin_integrity(&trusted_plugin, &installed_plugin)?;
    let qpa = inspect_qpa(layout)?;
    if qpa.state != crate::windows_qpa::QpaDeploymentState::Active {
        return Err(format!(
            "Windows QPA is not ACTIVE for this Cavalry copy. Reapply the selected language before restarting. {}",
            qpa.detail
        ));
    }
    let installed_language = fs::read_to_string(&layout.language_marker).map_err(|error| {
        format!(
            "Could not read Windows language marker {} before restarting: {error}",
            layout.language_marker.display()
        )
    })?;
    if installed_language.trim() != state.current_lang {
        return Err(format!(
            "Windows language marker mismatch before restarting: expected {}, got {}. Reapply the selected language.",
            state.current_lang,
            installed_language.trim()
        ));
    }
    let marker = prepare_marker(state_dir)?;
    let environment = vec![(
        OsString::from("CAVALRY_I18N_DIAGNOSTIC_MARKER"),
        marker.as_os_str().to_os_string(),
    )];

    Ok(WindowsRuntimeLaunch {
        environment,
        diagnostic_marker: Some(marker),
    })
}

/// 在 spawn 前以固定大小缓冲流式比对可信包源与所选安装根中的插件。
/// 这不是签名验证；调用方仍应把检查与 spawn 视为存在不可消除 TOCTOU 的两个系统操作。
fn verify_installed_plugin_integrity(
    trusted_plugin: &Path,
    installed_plugin: &Path,
) -> Result<(), String> {
    let trusted_hash = stream_sha256(trusted_plugin, "trusted Windows Qt plugin source")?;
    let installed_hash = stream_sha256(installed_plugin, "installed Windows Qt plugin")?;
    if trusted_hash == installed_hash {
        return Ok(());
    }

    Err(format!(
        "Windows Qt translation plugin integrity check failed: installed plugin {} does not match trusted source {}. Reapply the selected language before restarting.",
        installed_plugin.display(),
        trusted_plugin.display()
    ))
}

fn stream_sha256(path: &Path, role: &str) -> Result<[u8; 32], String> {
    let mut file = fs::File::open(path)
        .map_err(|error| format!("Could not open {role} {}: {error}", path.display()))?;
    let mut digest = Sha256::new();
    let mut buffer = [0_u8; 64 * 1024];
    loop {
        let read = file
            .read(&mut buffer)
            .map_err(|error| format!("Could not hash {role} {}: {error}", path.display()))?;
        if read == 0 {
            break;
        }
        digest.update(&buffer[..read]);
    }

    let mut output = [0_u8; 32];
    output.copy_from_slice(&digest.finalize());
    Ok(output)
}

/// 校验 Qt 插件用 QSaveFile 原子写入的 marker；`Ok(false)` 仅表示尚未 ready，其余异常均应立即向调用者暴露。
pub fn marker_is_ready(
    payload: &str,
    expected_language: &str,
    expected_process_id: u32,
) -> Result<bool, String> {
    let marker = serde_json::from_str::<DiagnosticMarker>(payload)
        .map_err(|error| format!("Invalid Windows runtime diagnostic marker JSON: {error}"))?;
    if marker.plugin != "cavalryi18n" {
        return Err(format!(
            "Windows runtime diagnostic marker belongs to an unexpected plugin: {}",
            marker.plugin
        ));
    }
    if marker.status == "error" {
        return Err(format!(
            "Windows Qt plugin reported an error: {} (extensionLayerHookStatus={}, extensionLayerHookDetail={})",
            marker.message,
            marker.extension_layer_hook_status,
            marker.extension_layer_hook_detail
        ));
    }
    if marker.status != "ready" {
        return Ok(false);
    }
    if !marker.translator_installed {
        return Err(
            "Windows Qt plugin reached ready without installing its translator.".to_string(),
        );
    }
    if marker.language != expected_language {
        return Err(format!(
            "Windows runtime diagnostic marker language mismatch: expected {expected_language}, got {}",
            marker.language
        ));
    }
    let process_id = marker.process_id.parse::<u32>().map_err(|error| {
        format!(
            "Windows runtime diagnostic marker has an invalid processId {:?}: {error}",
            marker.process_id
        )
    })?;
    if process_id != expected_process_id {
        return Err(format!(
            "Windows runtime diagnostic marker processId mismatch: expected {expected_process_id}, got {process_id}"
        ));
    }
    if marker.qt_version != EXPECTED_QT_VERSION {
        return Err(format!(
            "Windows runtime diagnostic marker Qt version mismatch: expected {EXPECTED_QT_VERSION}, got {}",
            marker.qt_version
        ));
    }
    if marker.translation_source != EXPECTED_TRANSLATION_SOURCE {
        return Err(format!(
            "Windows runtime diagnostic marker translation source mismatch: expected {EXPECTED_TRANSLATION_SOURCE}, got {}",
            marker.translation_source
        ));
    }
    if marker.embedded_entry_count == 0
        || marker.exact_key_count == 0
        || marker.source_fallback_count == 0
    {
        return Err(format!(
            "Windows Qt plugin reported an incomplete embedded translation table (entries={}, exactKeys={}, sourceFallbacks={}).",
            marker.embedded_entry_count, marker.exact_key_count, marker.source_fallback_count
        ));
    }
    Ok(true)
}

/// 只在非 English 重启后调用；以 marker 的状态变化而不是固定 sleep 判定插件是否真的启动。
pub fn wait_for_ready_marker(
    marker_path: &Path,
    expected_language: &str,
    expected_process_id: u32,
) -> Result<(), String> {
    wait_for_ready_marker_with_timeout(
        marker_path,
        expected_language,
        expected_process_id,
        MARKER_WAIT_TIMEOUT,
    )
}

fn wait_for_ready_marker_with_timeout(
    marker_path: &Path,
    expected_language: &str,
    expected_process_id: u32,
    timeout: Duration,
) -> Result<(), String> {
    let deadline = Instant::now() + timeout;
    let mut last_extension_layer_hook_report = None;
    loop {
        match fs::read_to_string(marker_path) {
            Ok(payload) => {
                last_extension_layer_hook_report = marker_extension_layer_hook_report(&payload);
                if marker_is_ready(&payload, expected_language, expected_process_id)? {
                    return Ok(());
                }
            }
            Err(error) if error.kind() == ErrorKind::NotFound => {}
            Err(error) => {
                return Err(format!(
                    "Could not read Windows runtime diagnostic marker {}: {error}",
                    marker_path.display()
                ));
            }
        }

        if Instant::now() >= deadline {
            let hook_report = last_extension_layer_hook_report
                .as_deref()
                .map(|report| format!(" Last diagnostic marker: {report}."))
                .unwrap_or_default();
            return Err(format!(
                "Timed out after {} seconds waiting for Windows Qt plugin readiness marker {} for {} (pid {}).{hook_report}",
                timeout.as_secs(),
                marker_path.display(),
                expected_language,
                expected_process_id
            ));
        }
        thread::sleep(
            Duration::from_millis(100).min(deadline.saturating_duration_since(Instant::now())),
        );
    }
}

/// ExtensionLayer hook 仅作为运行时诊断事实记录；当前启动就绪仍以插件、翻译器、语言、PID、Qt 与嵌入表契约为准。
fn marker_extension_layer_hook_report(payload: &str) -> Option<String> {
    let marker = serde_json::from_str::<DiagnosticMarker>(payload).ok()?;
    Some(format!(
        "extensionLayerHookStatus={}, extensionLayerHookDetail={}",
        marker.extension_layer_hook_status, marker.extension_layer_hook_detail
    ))
}

fn prepare_marker(state_dir: &Path) -> Result<PathBuf, String> {
    let runtime_dir = absolute_path(state_dir).join("runtime");
    fs::create_dir_all(&runtime_dir).map_err(|error| {
        format!(
            "Could not create Windows runtime diagnostic directory {}: {error}",
            runtime_dir.display()
        )
    })?;
    let runtime_dir = fs::canonicalize(&runtime_dir).map_err(|error| {
        format!(
            "Could not resolve Windows runtime diagnostic directory {}: {error}",
            runtime_dir.display()
        )
    })?;
    let marker = runtime_dir.join(DIAGNOSTIC_MARKER_FILE_NAME);
    remove_marker(&marker)?;
    Ok(marker)
}

fn remove_marker(marker: &Path) -> Result<(), String> {
    match fs::remove_file(marker) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == ErrorKind::NotFound => Ok(()),
        Err(error) => Err(format!(
            "Could not clear stale Windows runtime diagnostic marker {}: {error}",
            marker.display()
        )),
    }
}

fn absolute_path(path: &Path) -> PathBuf {
    if path.is_absolute() {
        return path.to_path_buf();
    }
    std::env::current_dir()
        .unwrap_or_else(|_| PathBuf::from("."))
        .join(path)
}

#[cfg(test)]
mod tests {
    use super::{
        build_language_marker_copy_pair, build_plugin_copy_pair, diagnostic_marker_path,
        marker_is_ready, plugin_source_candidates, prepare_launch,
        prepare_launch_with_qpa_inspector, qpa_proxy_source_candidates, resolve_plugin_source,
        resolve_qpa_proxy_source, wait_for_ready_marker_with_timeout, DIAGNOSTIC_MARKER_FILE_NAME,
        PLUGIN_FILE_NAME, QPA_PROXY_FILE_NAME,
    };
    use crate::{install::InstallLayout, state::State};
    use std::{collections::BTreeMap, ffi::OsString, fs, path::Path, time::Duration};

    fn write_source_plugin(root: &Path) {
        let plugin = root
            .join("injector")
            .join("windows")
            .join("generic")
            .join(PLUGIN_FILE_NAME);
        fs::create_dir_all(plugin.parent().unwrap()).unwrap();
        fs::write(plugin, b"plugin").unwrap();
    }

    #[test]
    fn language_marker_pair_records_every_supported_language_at_install_root() {
        let temp = tempfile::tempdir().unwrap();
        let app = temp.path().join("Cavalry");
        let layout = InstallLayout::from_root(&app);

        for lang in ["en", "zh-Hans", "zh-Hant", "ja_JP"] {
            let staging = temp.path().join("staging").join(lang);
            let pair = build_language_marker_copy_pair(&layout, lang, &staging).unwrap();
            assert_eq!(
                pair.dst,
                app.join(crate::install::LANG_MARKER_NAME),
                "{lang}"
            );
            assert_eq!(fs::read_to_string(pair.src).unwrap(), format!("{lang}\n"));
        }
    }

    fn write_installed_plugin(root: &Path) {
        let plugin = root.join("generic").join(PLUGIN_FILE_NAME);
        fs::create_dir_all(plugin.parent().unwrap()).unwrap();
        fs::write(plugin, b"plugin").unwrap();
    }

    fn active_qpa(_layout: &InstallLayout) -> Result<crate::windows_qpa::QpaInspection, String> {
        Ok(crate::windows_qpa::QpaInspection {
            state: crate::windows_qpa::QpaDeploymentState::Active,
            phase: Some(crate::windows_qpa::QpaManifestPhase::Active),
            current_qwindows_sha256: Some("a".repeat(64)),
            detail: "test-owned ACTIVE inspection".to_string(),
        })
    }

    fn state(lang: &str) -> State {
        State {
            current_lang: lang.to_string(),
            ..State::default()
        }
    }

    fn environment(variables: &[(OsString, OsString)]) -> BTreeMap<String, String> {
        variables
            .iter()
            .map(|(key, value)| {
                (
                    key.to_string_lossy().to_string(),
                    value.to_string_lossy().to_string(),
                )
            })
            .collect()
    }

    fn ready_marker(language: &str, process_id: u32, qt_version: &str) -> String {
        format!(
            r#"{{"plugin":"cavalryi18n","status":"ready","message":"installed","language":"{language}","translationSource":"embedded-generated-table","embeddedEntryCount":4,"exactKeyCount":3,"sourceFallbackCount":1,"translatorInstalled":true,"extensionLayerHookStatus":"waiting-for-extension-layer","extensionLayerHookDetail":"ExtensionLayer.dll has not loaded yet.","qtVersion":"{qt_version}","processId":"{process_id}"}}"#
        )
    }

    #[test]
    fn packaged_plugin_source_wins_before_development_fallback() {
        let temp = tempfile::tempdir().unwrap();
        let resources = temp.path().join("resources");
        let repo = temp.path().join("repo");
        let app = temp.path().join("Cavalry");
        write_source_plugin(&resources);
        write_source_plugin(&repo);

        let pair =
            build_plugin_copy_pair(&resources, &repo, &InstallLayout::from_root(&app)).unwrap();
        assert_eq!(
            pair.src,
            resources
                .join("injector/windows/generic")
                .join(PLUGIN_FILE_NAME)
        );
        assert_eq!(pair.dst, app.join("generic").join(PLUGIN_FILE_NAME));
    }

    #[test]
    fn development_plugin_source_is_used_only_after_packaged_candidates() {
        let temp = tempfile::tempdir().unwrap();
        let resources = temp.path().join("resources");
        let repo = temp.path().join("repo");
        write_source_plugin(&repo);

        let candidates = plugin_source_candidates(&resources, &repo);
        assert_eq!(
            candidates.last(),
            Some(&repo.join("injector/windows/generic").join(PLUGIN_FILE_NAME))
        );
        assert_eq!(
            resolve_plugin_source(&resources, &repo).unwrap(),
            repo.join("injector/windows/generic").join(PLUGIN_FILE_NAME)
        );
    }

    #[test]
    fn installed_plugin_drives_non_english_launch_and_clears_marker() {
        let temp = tempfile::tempdir().unwrap();
        let app = temp.path().join("Cavalry");
        let state_dir = temp.path().join("state");
        let resources = temp.path().join("resources");
        let repo = temp.path().join("repo");
        let layout = InstallLayout::from_root(&app);
        write_source_plugin(&resources);
        write_installed_plugin(&app);
        fs::write(app.join(crate::install::LANG_MARKER_NAME), b"zh-Hans\n").unwrap();
        let stale_marker = diagnostic_marker_path(&state_dir);
        fs::create_dir_all(stale_marker.parent().unwrap()).unwrap();
        fs::write(&stale_marker, br#"{\"status\":\"ready\"}"#).unwrap();

        let launch = prepare_launch_with_qpa_inspector(
            &layout,
            &state_dir,
            &state("zh-Hans"),
            &resources,
            &repo,
            active_qpa,
        )
        .unwrap();
        let marker = launch.diagnostic_marker.as_ref().unwrap();
        let environment = environment(&launch.environment);

        assert_eq!(environment.len(), 1);
        assert!(!environment.contains_key("QT_PLUGIN_PATH"));
        assert!(!environment.contains_key("QT_QPA_GENERIC_PLUGINS"));
        assert!(!environment.contains_key("CAVALRY_I18N_LANG"));
        assert_eq!(
            environment["CAVALRY_I18N_DIAGNOSTIC_MARKER"],
            marker.to_string_lossy()
        );
        assert!(marker.is_absolute());
        assert!(marker.ends_with(DIAGNOSTIC_MARKER_FILE_NAME));
        assert!(!marker.exists());
    }

    #[test]
    fn non_english_runtime_requires_installed_plugin_but_english_does_not() {
        let temp = tempfile::tempdir().unwrap();
        let layout = InstallLayout::from_root(&temp.path().join("Cavalry"));
        let resources = temp.path().join("resources");
        let repo = temp.path().join("repo");
        let error =
            prepare_launch(&layout, temp.path(), &state("zh-Hant"), &resources, &repo).unwrap_err();
        assert!(error.contains(PLUGIN_FILE_NAME), "{error}");

        let english =
            prepare_launch(&layout, temp.path(), &state("en"), &resources, &repo).unwrap();
        assert!(english.environment.is_empty());
        assert!(english.diagnostic_marker.is_none());

        let error =
            resolve_plugin_source(&temp.path().join("resources"), &temp.path().join("repo"))
                .unwrap_err();
        assert!(error.contains(PLUGIN_FILE_NAME), "{error}");
    }

    #[test]
    fn non_english_runtime_rejects_a_tampered_installed_plugin_before_marker_creation() {
        let temp = tempfile::tempdir().unwrap();
        let resources = temp.path().join("resources");
        let repo = temp.path().join("repo");
        let app = temp.path().join("Cavalry");
        let state_dir = temp.path().join("state");
        let layout = InstallLayout::from_root(&app);
        write_source_plugin(&resources);
        write_installed_plugin(&app);
        fs::write(app.join(crate::install::LANG_MARKER_NAME), b"zh-Hans\n").unwrap();
        fs::write(app.join("generic").join(PLUGIN_FILE_NAME), b"tampered").unwrap();

        let error = prepare_launch_with_qpa_inspector(
            &layout,
            &state_dir,
            &state("zh-Hans"),
            &resources,
            &repo,
            active_qpa,
        )
        .unwrap_err();

        assert!(error.contains("integrity check failed"), "{error}");
        assert!(error.contains("Reapply the selected language"), "{error}");
        assert!(!state_dir.join("runtime").exists());
    }

    #[test]
    fn non_english_runtime_rejects_a_missing_trusted_source_before_marker_creation() {
        let temp = tempfile::tempdir().unwrap();
        let resources = temp.path().join("resources");
        let repo = temp.path().join("repo");
        let app = temp.path().join("Cavalry");
        let state_dir = temp.path().join("state");
        let layout = InstallLayout::from_root(&app);
        write_installed_plugin(&app);
        fs::write(app.join(crate::install::LANG_MARKER_NAME), b"ja_JP\n").unwrap();

        let error = prepare_launch_with_qpa_inspector(
            &layout,
            &state_dir,
            &state("ja_JP"),
            &resources,
            &repo,
            active_qpa,
        )
        .unwrap_err();

        assert!(error.contains("Could not verify"), "{error}");
        assert!(error.contains("Reapply the selected language"), "{error}");
        assert!(!state_dir.join("runtime").exists());
    }

    #[test]
    fn qpa_proxy_resolver_uses_packaged_layout_before_repo_fallback() {
        let temp = tempfile::tempdir().unwrap();
        let resources = temp.path().join("resources");
        let repo = temp.path().join("repo");
        let packaged = resources
            .join("injector/windows/qpa")
            .join(QPA_PROXY_FILE_NAME);
        let development = repo.join("injector/windows/qpa").join(QPA_PROXY_FILE_NAME);
        fs::create_dir_all(packaged.parent().unwrap()).unwrap();
        fs::create_dir_all(development.parent().unwrap()).unwrap();
        fs::write(&packaged, b"packaged").unwrap();
        fs::write(&development, b"development").unwrap();

        assert_eq!(
            resolve_qpa_proxy_source(&resources, &repo).unwrap(),
            packaged
        );
        assert_eq!(
            qpa_proxy_source_candidates(&resources, &repo).last(),
            Some(&development)
        );
    }

    #[test]
    fn non_english_launch_requires_qpa_active_before_spawn_environment() {
        let temp = tempfile::tempdir().unwrap();
        let resources = temp.path().join("resources");
        let repo = temp.path().join("repo");
        let app = temp.path().join("Cavalry");
        let state_dir = temp.path().join("state");
        let layout = InstallLayout::from_root(&app);
        write_source_plugin(&resources);
        write_installed_plugin(&app);
        fs::write(app.join(crate::install::LANG_MARKER_NAME), b"zh-Hans\n").unwrap();

        let error =
            prepare_launch(&layout, &state_dir, &state("zh-Hans"), &resources, &repo).unwrap_err();

        assert!(error.contains("QPA is not ACTIVE"), "{error}");
        assert!(!state_dir.join("runtime").exists());
    }

    #[test]
    fn ready_marker_requires_the_expected_plugin_process_qt_and_translation_counts() {
        let marker = ready_marker("zh-Hans", 4242, "6.6.3");

        // ExtensionLayer 在真实绘制路径独立证实前仅作诊断，不参与启动成功判定。
        assert!(marker_is_ready(&marker, "zh-Hans", 4242).unwrap());

        let process_error = marker_is_ready(&marker, "zh-Hans", 4243).unwrap_err();
        assert!(
            process_error.contains("processId mismatch"),
            "{process_error}"
        );

        let qt_error =
            marker_is_ready(&ready_marker("zh-Hans", 4242, "6.6.2"), "zh-Hans", 4242).unwrap_err();
        assert!(qt_error.contains("Qt version mismatch"), "{qt_error}");

        let source_error = marker_is_ready(
            &marker.replace("embedded-generated-table", "external-qm"),
            "zh-Hans",
            4242,
        )
        .unwrap_err();
        assert!(
            source_error.contains("translation source mismatch"),
            "{source_error}"
        );
    }

    #[test]
    fn malformed_marker_fails_instead_of_being_accepted_as_ready() {
        let error = marker_is_ready("{not-json", "zh-Hans", 4242).unwrap_err();

        assert!(error.contains("Invalid Windows runtime diagnostic marker JSON"));
    }

    #[test]
    fn error_marker_is_reported_immediately() {
        let marker = r#"{"plugin":"cavalryi18n","status":"error","message":"Qt rejected plugin","language":"zh-Hans","translationSource":"embedded-generated-table","translatorInstalled":false,"extensionLayerHookStatus":"unsupported","extensionLayerHookDetail":"target module mismatch","qtVersion":"6.6.3","processId":"4242","embeddedEntryCount":0,"exactKeyCount":0,"sourceFallbackCount":0}"#;
        let error = marker_is_ready(marker, "zh-Hans", 4242).unwrap_err();

        assert!(error.contains("Qt rejected plugin"), "{error}");
        assert!(
            error.contains("extensionLayerHookStatus=unsupported"),
            "{error}"
        );
    }

    #[test]
    fn missing_extension_layer_diagnostic_fields_fail_marker_deserialization() {
        let marker = ready_marker("zh-Hans", 4242, "6.6.3").replace(
            r#","extensionLayerHookStatus":"waiting-for-extension-layer","extensionLayerHookDetail":"ExtensionLayer.dll has not loaded yet.""#,
            "",
        );

        let error = marker_is_ready(&marker, "zh-Hans", 4242).unwrap_err();

        assert!(
            error.contains("Invalid Windows runtime diagnostic marker JSON"),
            "{error}"
        );
    }

    #[test]
    fn stale_language_marker_cannot_complete_a_new_restart() {
        let error =
            marker_is_ready(&ready_marker("ja_JP", 4242, "6.6.3"), "zh-Hans", 4242).unwrap_err();

        assert!(error.contains("language mismatch"), "{error}");
    }

    #[test]
    fn readiness_wait_has_a_deadline_when_the_plugin_never_writes_a_marker() {
        let temp = tempfile::tempdir().unwrap();
        let marker_path = temp.path().join(DIAGNOSTIC_MARKER_FILE_NAME);
        let error =
            wait_for_ready_marker_with_timeout(&marker_path, "zh-Hans", 4242, Duration::ZERO)
                .unwrap_err();

        assert!(error.contains("Timed out"), "{error}");
    }

    #[test]
    fn readiness_timeout_reports_the_last_extension_layer_diagnostic_without_gating_on_it() {
        let temp = tempfile::tempdir().unwrap();
        let marker_path = temp.path().join(DIAGNOSTIC_MARKER_FILE_NAME);
        let marker = ready_marker("zh-Hans", 4242, "6.6.3")
            .replace(r#""status":"ready""#, r#""status":"starting""#)
            .replace(r#""waiting-for-extension-layer""#, r#""unsupported""#)
            .replace(
                "ExtensionLayer.dll has not loaded yet.",
                "target module did not match the verified ABI",
            );
        fs::write(&marker_path, marker).unwrap();

        let error =
            wait_for_ready_marker_with_timeout(&marker_path, "zh-Hans", 4242, Duration::ZERO)
                .unwrap_err();

        assert!(error.contains("Timed out"), "{error}");
        assert!(
            error.contains("extensionLayerHookStatus=unsupported"),
            "{error}"
        );
        assert!(
            error.contains("target module did not match the verified ABI"),
            "{error}"
        );
    }
}
