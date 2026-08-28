/**
 * [INPUT]: 依赖 Tauri AppHandle/IPC Channel、官方 tauri-plugin-updater 2.10.1 的 Update、Updater 单飞状态，以及安装阶段复用的 bundle operation lock。
 * [OUTPUT]: 提供 check_update/install_update 两条 renderer-facing command、只暴露 currentVersion/version/notes/pubDate/available/errorCode 的 DTO、三阶段脱敏更新事件，以及进程内 pending Update 状态。
 * [POS]: commands 的更新领域边界；检查网络不占用 Cavalry bundle 锁，检查与安装彼此单飞；安装只消费 Rust State 中最近一次签名验证通过的 Update，并以 Channel 观察下载、安装和重启边界。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
/* -------------------------------------------------------------------------- */
/* 官方 Update 实现 tauri::Resource，而 Resource 要求 Any + Send + Sync。     */
/* 因此 Mutex<Option<Update>> 可以安全交给 Tauri State，且不把插件对象出界。   */
/* -------------------------------------------------------------------------- */
use chrono::{DateTime, SecondsFormat, Utc};
use serde::{Serialize, Serializer};
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc, Mutex,
};
use tauri::{ipc::Channel, AppHandle, Manager};
use tauri_plugin_updater::{Error as UpdaterError, Update, UpdaterExt};

use crate::operation_lock;

use super::context::AppPaths;

pub(crate) const UPDATER_NOT_CONFIGURED_ERROR_CODE: &str = "updaterNotConfigured";
pub(crate) const UPDATER_UNSUPPORTED_PLATFORM_ERROR_CODE: &str = "updaterUnsupportedPlatform";
pub(crate) const UPDATE_CHECK_FAILED_ERROR_CODE: &str = "updateCheckFailed";
pub(crate) const UPDATE_INSTALL_FAILED_ERROR_CODE: &str = "updateInstallFailed";
pub(crate) const UPDATE_NOT_CHECKED_ERROR_CODE: &str = "updateNotChecked";
pub(crate) const UPDATE_BUSY_ERROR_CODE: &str = "updateBusy";
pub(crate) const UPDATE_STATE_UNAVAILABLE_ERROR_CODE: &str = "updateStateUnavailable";

pub(crate) const UPDATE_DOWNLOADING_PHASE: &str = "downloading";
pub(crate) const UPDATE_INSTALLING_PHASE: &str = "installing";
pub(crate) const UPDATE_RESTARTING_PHASE: &str = "restarting";

/* -------------------------------------------------------------------------- */
/* 只把 renderer 需要的阶段和下载计数送出；URL、签名、路径和原始响应留在 Rust。 */
/* -------------------------------------------------------------------------- */

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum UpdatePhase {
    Downloading,
    Installing,
    Restarting,
}

impl UpdatePhase {
    pub(crate) const fn as_str(self) -> &'static str {
        match self {
            Self::Downloading => UPDATE_DOWNLOADING_PHASE,
            Self::Installing => UPDATE_INSTALLING_PHASE,
            Self::Restarting => UPDATE_RESTARTING_PHASE,
        }
    }
}

impl Serialize for UpdatePhase {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        serializer.serialize_str(self.as_str())
    }
}

#[derive(Clone, Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct UpdateEvent {
    pub phase: UpdatePhase,
    pub downloaded: Option<u64>,
    pub content_length: Option<u64>,
}

impl UpdateEvent {
    pub(crate) const fn downloading(downloaded: u64, content_length: Option<u64>) -> Self {
        Self {
            phase: UpdatePhase::Downloading,
            downloaded: Some(downloaded),
            content_length,
        }
    }

    pub(crate) const fn installing() -> Self {
        Self {
            phase: UpdatePhase::Installing,
            downloaded: None,
            content_length: None,
        }
    }

    pub(crate) const fn restarting() -> Self {
        Self {
            phase: UpdatePhase::Restarting,
            downloaded: None,
            content_length: None,
        }
    }
}

/// 与传输方式无关的更新进度报告协议；更新事务不依赖 Tauri Channel 是否仍然可用。
pub(crate) trait UpdateProgressReporter: Clone + Send + Sync + 'static {
    fn report(&self, event: UpdateEvent);
}

#[derive(Clone)]
pub(crate) struct TauriUpdateProgressReporter {
    channel: Channel<UpdateEvent>,
}

impl TauriUpdateProgressReporter {
    pub(crate) fn new(channel: Channel<UpdateEvent>) -> Self {
        Self { channel }
    }
}

impl UpdateProgressReporter for TauriUpdateProgressReporter {
    fn report(&self, event: UpdateEvent) {
        // Channel 是观察面；关闭或拒收只丢弃进度，不改变下载、验证、安装或重启结果。
        let _ = self.channel.send(event);
    }
}

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
struct DownloadProgress {
    downloaded: u64,
    content_length: Option<u64>,
}

impl DownloadProgress {
    fn started_event(self) -> UpdateEvent {
        UpdateEvent::downloading(self.downloaded, self.content_length)
    }

    fn chunk_event(&mut self, chunk_length: usize, content_length: Option<u64>) -> UpdateEvent {
        let chunk_length = u64::try_from(chunk_length).unwrap_or(u64::MAX);
        self.downloaded = self.downloaded.saturating_add(chunk_length);
        if content_length.is_some() {
            self.content_length = content_length;
        }
        UpdateEvent::downloading(self.downloaded, self.content_length)
    }
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct UpdatePayload {
    pub current_version: String,
    pub version: Option<String>,
    pub notes: Option<String>,
    pub pub_date: Option<String>,
    pub available: bool,
    pub error_code: Option<String>,
}

#[derive(Default)]
pub(crate) struct UpdaterState {
    pending: Mutex<Option<Update>>,
    operation_active: AtomicBool,
}

struct UpdaterOperationGuard<'a> {
    active: &'a AtomicBool,
}

impl Drop for UpdaterOperationGuard<'_> {
    fn drop(&mut self) {
        self.active.store(false, Ordering::Release);
    }
}

impl UpdaterState {
    fn try_begin_operation(&self) -> Result<UpdaterOperationGuard<'_>, ()> {
        self.operation_active
            .compare_exchange(false, true, Ordering::AcqRel, Ordering::Acquire)
            .map(|_| UpdaterOperationGuard {
                active: &self.operation_active,
            })
            .map_err(|_| ())
    }

    fn replace_pending(&self, update: Option<Update>) -> Result<(), ()> {
        self.pending
            .lock()
            .map(|mut pending| {
                *pending = update;
            })
            .map_err(|_| ())
    }

    fn pending_update(&self) -> Result<Option<Update>, ()> {
        self.pending
            .lock()
            .map(|pending| pending.clone())
            .map_err(|_| ())
    }
}

impl UpdatePayload {
    fn current(current_version: String) -> Self {
        Self {
            current_version,
            version: None,
            notes: None,
            pub_date: None,
            available: false,
            error_code: None,
        }
    }

    fn error(current_version: String, error_code: &'static str) -> Self {
        Self {
            error_code: Some(error_code.to_string()),
            ..Self::current(current_version)
        }
    }

    fn from_update(update: &Update, error_code: Option<&'static str>) -> Self {
        Self {
            current_version: update.current_version.clone(),
            version: Some(update.version.clone()),
            notes: update.body.clone(),
            pub_date: update.date.and_then(|date| {
                DateTime::<Utc>::from_timestamp(date.unix_timestamp(), date.nanosecond())
                    .map(|date| date.to_rfc3339_opts(SecondsFormat::Millis, true))
            }),
            available: true,
            error_code: error_code.map(str::to_string),
        }
    }
}

fn current_version(app: &AppHandle) -> String {
    app.package_info().version.to_string()
}

fn check_error_code(error: &UpdaterError) -> &'static str {
    match error {
        UpdaterError::EmptyEndpoints | UpdaterError::InsecureTransportProtocol => {
            UPDATER_NOT_CONFIGURED_ERROR_CODE
        }
        UpdaterError::UnsupportedArch | UpdaterError::UnsupportedOs => {
            UPDATER_UNSUPPORTED_PLATFORM_ERROR_CODE
        }
        _ => UPDATE_CHECK_FAILED_ERROR_CODE,
    }
}

fn busy_payload(app: &AppHandle) -> UpdatePayload {
    UpdatePayload::error(current_version(app), UPDATE_BUSY_ERROR_CODE)
}

fn state_error_payload(app: &AppHandle) -> UpdatePayload {
    UpdatePayload::error(current_version(app), UPDATE_STATE_UNAVAILABLE_ERROR_CODE)
}

fn updater_is_configured(app: &AppHandle) -> bool {
    app.config().plugins.0.contains_key("updater")
}

pub(crate) async fn check_update_inner(app: AppHandle) -> UpdatePayload {
    if !updater_is_configured(&app) {
        return UpdatePayload::error(current_version(&app), UPDATER_NOT_CONFIGURED_ERROR_CODE);
    }
    let updater_state = app.state::<UpdaterState>();
    let _updater_guard = match updater_state.try_begin_operation() {
        Ok(guard) => guard,
        Err(_) => return busy_payload(&app),
    };

    if updater_state.replace_pending(None).is_err() {
        return state_error_payload(&app);
    }

    let result = match app.updater() {
        Ok(updater) => updater.check().await,
        Err(error) => Err(error),
    };

    match result {
        Ok(Some(update)) => {
            let payload = UpdatePayload::from_update(&update, None);
            if updater_state.replace_pending(Some(update)).is_err() {
                return state_error_payload(&app);
            }
            payload
        }
        Ok(None) => UpdatePayload::current(current_version(&app)),
        Err(error) => UpdatePayload::error(current_version(&app), check_error_code(&error)),
    }
}

pub(crate) async fn install_update_inner<R>(app: AppHandle, reporter: R) -> UpdatePayload
where
    R: UpdateProgressReporter,
{
    if !updater_is_configured(&app) {
        return UpdatePayload::error(current_version(&app), UPDATER_NOT_CONFIGURED_ERROR_CODE);
    }
    let updater_state = app.state::<UpdaterState>();
    let _updater_guard = match updater_state.try_begin_operation() {
        Ok(guard) => guard,
        Err(_) => return busy_payload(&app),
    };
    let paths = AppPaths::for_app(&app);
    let _operation_guard = match operation_lock::try_begin_bundle_operation(&paths.state_dir) {
        Ok(guard) => guard,
        Err(_) => return busy_payload(&app),
    };

    let update = match updater_state.pending_update() {
        Ok(Some(update)) => update,
        Ok(None) => {
            return UpdatePayload::error(current_version(&app), UPDATE_NOT_CHECKED_ERROR_CODE)
        }
        Err(()) => return state_error_payload(&app),
    };

    let progress = Arc::new(Mutex::new(DownloadProgress::default()));
    reporter.report(
        progress
            .lock()
            .map(|progress| progress.started_event())
            .unwrap_or_else(|_| DownloadProgress::default().started_event()),
    );

    let chunk_progress = Arc::clone(&progress);
    let chunk_reporter = reporter.clone();
    let finish_reporter = reporter.clone();
    match update
        .download_and_install(
            move |chunk_length, content_length| {
                let event = {
                    let Ok(mut progress) = chunk_progress.lock() else {
                        return;
                    };
                    progress.chunk_event(chunk_length, content_length)
                };
                chunk_reporter.report(event);
            },
            move || {
                // 官方回调在签名验证前触发；此阶段同时覆盖验证与随后安装，不伪造 verified。
                finish_reporter.report(UpdateEvent::installing());
            },
        )
        .await
    {
        Ok(()) => {
            // download_and_install 已完成签名验证和安装；restart 通常不再返回成功 DTO。
            reporter.report(UpdateEvent::restarting());
            app.restart()
        }
        Err(_) => UpdatePayload::from_update(&update, Some(UPDATE_INSTALL_FAILED_ERROR_CODE)),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::{Arc, Mutex};

    #[derive(Clone, Default)]
    struct RecordingUpdateProgressReporter {
        events: Arc<Mutex<Vec<UpdateEvent>>>,
    }

    impl UpdateProgressReporter for RecordingUpdateProgressReporter {
        fn report(&self, event: UpdateEvent) {
            self.events.lock().unwrap().push(event);
        }
    }

    #[test]
    fn update_resource_meets_managed_state_bounds() {
        fn assert_managed_state_bounds<T: Send + Sync + 'static>() {}

        assert_managed_state_bounds::<Update>();
    }

    #[test]
    fn pending_state_starts_empty_and_clear_is_idempotent() {
        let state = UpdaterState::default();

        assert!(state.pending_update().unwrap().is_none());
        state.replace_pending(None).unwrap();
        assert!(state.pending_update().unwrap().is_none());
    }

    #[test]
    fn updater_operations_are_single_flight_without_holding_the_bundle_lock_for_checks() {
        let state = UpdaterState::default();
        let first = state.try_begin_operation().unwrap();

        assert!(state.try_begin_operation().is_err());
        drop(first);
        assert!(state.try_begin_operation().is_ok());
    }

    #[test]
    fn error_mapping_is_stable_and_does_not_require_backend_text() {
        assert_eq!(
            check_error_code(&UpdaterError::EmptyEndpoints),
            UPDATER_NOT_CONFIGURED_ERROR_CODE
        );
        assert_eq!(
            check_error_code(&UpdaterError::UnsupportedOs),
            UPDATER_UNSUPPORTED_PLATFORM_ERROR_CODE
        );
        assert_eq!(
            check_error_code(&UpdaterError::ReleaseNotFound),
            UPDATE_CHECK_FAILED_ERROR_CODE
        );
    }

    #[test]
    fn unavailable_payload_has_only_the_renderer_contract_fields() {
        let value = serde_json::to_value(UpdatePayload::error(
            "0.7.0".to_string(),
            UPDATE_CHECK_FAILED_ERROR_CODE,
        ))
        .unwrap();

        assert_eq!(
            value,
            serde_json::json!({
                "currentVersion": "0.7.0",
                "version": null,
                "notes": null,
                "pubDate": null,
                "available": false,
                "errorCode": "updateCheckFailed"
            })
        );
        assert!(value.get("url").is_none());
        assert!(value.get("signature").is_none());
        assert!(value.get("rawJson").is_none());
    }

    #[test]
    fn update_event_contract_is_camel_case_and_contains_no_updater_details() {
        let downloading =
            serde_json::to_value(UpdateEvent::downloading(4096, Some(16384))).unwrap();
        assert_eq!(
            downloading,
            serde_json::json!({
                "phase": "downloading",
                "downloaded": 4096,
                "contentLength": 16384
            })
        );

        let installing = serde_json::to_value(UpdateEvent::installing()).unwrap();
        assert_eq!(
            installing,
            serde_json::json!({
                "phase": "installing",
                "downloaded": null,
                "contentLength": null
            })
        );
        assert!(installing.get("url").is_none());
        assert!(installing.get("signature").is_none());
        assert!(installing.get("path").is_none());
        assert!(installing.get("rawJson").is_none());
        assert_eq!(UpdatePhase::Restarting.as_str(), "restarting");
    }

    #[test]
    fn download_progress_seam_accumulates_bytes_and_keeps_real_phase_order() {
        let reporter = RecordingUpdateProgressReporter::default();
        let mut progress = DownloadProgress::default();

        reporter.report(progress.started_event());
        reporter.report(progress.chunk_event(4, None));
        reporter.report(progress.chunk_event(6, Some(100)));
        reporter.report(UpdateEvent::installing());
        reporter.report(UpdateEvent::restarting());

        assert_eq!(
            *reporter.events.lock().unwrap(),
            [
                UpdateEvent::downloading(0, None),
                UpdateEvent::downloading(4, None),
                UpdateEvent::downloading(10, Some(100)),
                UpdateEvent::installing(),
                UpdateEvent::restarting(),
            ]
        );
    }

    #[test]
    fn tauri_channel_rejection_does_not_escape_the_progress_reporter() {
        let channel = Channel::<UpdateEvent>::new(|_| Err(tauri::Error::FailedToReceiveMessage));
        TauriUpdateProgressReporter::new(channel).report(UpdateEvent::installing());
    }
}
