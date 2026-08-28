/**
 * [INPUT]: 依赖 serde 序列化和 privilege 的 typed post-commit warning code。
 * [OUTPUT]: 提供九命令名称、renderer 兼容 payload DTO、启动恢复显式阻断诊断、Action/Status 的 Windows residue reconciliationRequired 检测标记，以及可组合的稳定 errorCode/warningCodes 投影。
 * [POS]: commands 的外部契约层；内部 warning prose 只用于领域测试，command facade 必须在序列化前转换为 codes 并清空原文。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
use serde::Serialize;

use crate::privilege::PostCommitWarning;

const PROTECTED_TRANSACTION_WARNING: &str = "Language files were applied, but transaction recovery evidence remains in the protected Cavalry installation. Do not delete it manually.";
const TEMPORARY_CLEANUP_WARNING: &str = "Language files were applied, but temporary cleanup is still pending. Close Cavalry Language Switcher before removing temporary files.";
const INTERNAL_WARNING_CODE_PREFIX: &str = "[cavalry-i18n-warning-code:";
pub(crate) const CAVALRY_STILL_RUNNING_ERROR_CODE: &str = "cavalryStillRunning";
pub(crate) const PERMISSION_REQUIRED_ERROR_CODE: &str = "permissionRequired";
pub(crate) const RESTART_FAILED_WARNING_CODE: &str = "restartFailed";
pub(crate) const STATE_DURABILITY_PENDING_WARNING_CODE: &str = "stateDurabilityPending";
const RECOVERY_CLEANUP_PENDING_WARNING_CODE: &str = "recoveryCleanupPending";
const PROTECTED_RECOVERY_EVIDENCE_WARNING_CODE: &str = "protectedRecoveryEvidenceRetained";
const TEMPORARY_CLEANUP_PENDING_WARNING_CODE: &str = "temporaryCleanupPending";
const FINDER_FALLBACK_USED_WARNING_CODE: &str = "finderFallbackUsed";
const NON_FATAL_CLEANUP_WARNING_CODE: &str = "nonFatalCleanup";

pub const COMMAND_NAMES: [&str; 9] = [
    "get_status",
    "browse_app",
    "extract_english",
    "apply_language",
    "open_privacy_security",
    "open_project_link",
    "restart_cavalry",
    "check_update",
    "install_update",
];

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
    pub installation_mode: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub startup_recovery_error: Option<String>,
    pub default_app_candidates: Vec<String>,
    pub diagnostics: Option<BundleDiagnostics>,
    pub languages: Vec<LanguageChoice>,
    pub needs_extract: bool,
    pub permission_action: String,
    pub platform: String,
    #[serde(skip_serializing_if = "is_false")]
    pub reconciliation_required: bool,
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
    #[serde(skip_serializing_if = "Option::is_none")]
    pub warning_code: Option<String>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub warning_codes: Vec<String>,
    #[serde(skip_serializing_if = "is_false")]
    pub permission_required: bool,
    #[serde(skip_serializing_if = "is_false")]
    pub reconciliation_required: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error_code: Option<String>,
}

impl ActionPayload {
    pub(crate) fn ok() -> Self {
        Self {
            ok: true,
            count: None,
            current_lang: None,
            warning: None,
            warning_code: None,
            warning_codes: Vec::new(),
            permission_required: false,
            reconciliation_required: false,
            error: None,
            error_code: None,
        }
    }

    pub(crate) fn ok_count(count: usize) -> Self {
        Self {
            ok: true,
            count: Some(count),
            current_lang: None,
            warning: None,
            warning_code: None,
            warning_codes: Vec::new(),
            permission_required: false,
            reconciliation_required: false,
            error: None,
            error_code: None,
        }
    }

    pub(crate) fn ok_lang(lang: &str, warning: Option<String>) -> Self {
        Self {
            ok: true,
            count: None,
            current_lang: Some(lang.to_string()),
            warning,
            warning_code: None,
            warning_codes: Vec::new(),
            permission_required: false,
            reconciliation_required: false,
            error: None,
            error_code: None,
        }
    }

    pub(crate) fn error(message: &str) -> Self {
        Self {
            ok: false,
            count: None,
            current_lang: None,
            warning: None,
            warning_code: None,
            warning_codes: Vec::new(),
            permission_required: false,
            reconciliation_required: false,
            error: Some(message.to_string()),
            error_code: None,
        }
    }

    pub(crate) fn error_with_code(message: &str, code: &str) -> Self {
        Self {
            error_code: Some(code.to_string()),
            ..Self::error(message)
        }
    }

    pub(crate) fn permission_error(message: &str) -> Self {
        Self {
            permission_required: true,
            error_code: Some(PERMISSION_REQUIRED_ERROR_CODE.to_string()),
            ..Self::error(message)
        }
    }

    pub(crate) fn with_warning_code(mut self, code: &str) -> Self {
        self.warning_code = Some(code.to_string());
        if !self.warning_codes.iter().any(|existing| existing == code) {
            self.warning_codes.insert(0, code.to_string());
        }
        self
    }

    /// Convert every internal warning string into a finite renderer-owned code set. The legacy
    /// singular field remains for compatibility, but the renderer consumes only `warningCodes`.
    pub(crate) fn into_renderer_contract(mut self) -> Self {
        if let Some(code) = self.warning_code.clone() {
            push_warning_code(&mut self.warning_codes, &code);
        }
        if let Some(warning) = self.warning.take() {
            for code in renderer_warning_codes(&warning) {
                push_warning_code(&mut self.warning_codes, code);
            }
        }
        self
    }
}

fn push_warning_code(codes: &mut Vec<String>, code: &str) {
    if !codes.iter().any(|existing| existing == code) {
        codes.push(code.to_string());
    }
}

fn renderer_warning_codes(warning: &str) -> Vec<&'static str> {
    let mut codes = Vec::new();
    for code in [
        RECOVERY_CLEANUP_PENDING_WARNING_CODE,
        PROTECTED_RECOVERY_EVIDENCE_WARNING_CODE,
        TEMPORARY_CLEANUP_PENDING_WARNING_CODE,
        FINDER_FALLBACK_USED_WARNING_CODE,
        NON_FATAL_CLEANUP_WARNING_CODE,
    ] {
        if warning.contains(&format!("{INTERNAL_WARNING_CODE_PREFIX}{code}]")) {
            codes.push(code);
        }
    }
    // Legacy prose remains recognized for interrupted upgrades, direct raw staging warnings, and
    // state warnings. New typed copy warnings use the machine-only markers above.
    if warning.contains(
        "Language files were applied after recovery; temporary recovery files may still need manual cleanup.",
    ) && !codes.contains(&RECOVERY_CLEANUP_PENDING_WARNING_CODE)
    {
        codes.push(RECOVERY_CLEANUP_PENDING_WARNING_CODE);
    }
    if warning.contains(PROTECTED_TRANSACTION_WARNING)
        && !codes.contains(&PROTECTED_RECOVERY_EVIDENCE_WARNING_CODE)
    {
        codes.push(PROTECTED_RECOVERY_EVIDENCE_WARNING_CODE);
    }
    if warning.contains(TEMPORARY_CLEANUP_WARNING)
        || warning.contains("temporary staging cleanup failed")
    {
        if !codes.contains(&TEMPORARY_CLEANUP_PENDING_WARNING_CODE) {
            codes.push(TEMPORARY_CLEANUP_PENDING_WARNING_CODE);
        }
    }
    if warning.contains("macOS blocked direct shell copy, so Finder-style replacement was used.")
        && !codes.contains(&FINDER_FALLBACK_USED_WARNING_CODE)
    {
        codes.push(FINDER_FALLBACK_USED_WARNING_CODE);
    }
    if warning.contains("Language files were applied with a non-fatal cleanup warning.")
        && !codes.contains(&NON_FATAL_CLEANUP_WARNING_CODE)
    {
        codes.push(NON_FATAL_CLEANUP_WARNING_CODE);
    }
    if warning.contains("state generation is committed") && warning.contains("could not be fsynced")
    {
        codes.push(STATE_DURABILITY_PENDING_WARNING_CODE);
    }
    if codes.is_empty() {
        codes.push(NON_FATAL_CLEANUP_WARNING_CODE);
    }
    codes
}

fn is_false(value: &bool) -> bool {
    !*value
}

/// `apply.rs` 的兼容 seam 仍接收 `Option<String>`，这里将 typed warnings 编码为仅供 facade
/// 消费的 machine markers；不携带 UI prose、临时路径、OS 错误或 UAC stderr。
pub(crate) fn renderer_warning_for_copy(
    warnings: &[PostCommitWarning],
    copy_mode: &str,
) -> Option<String> {
    let mut codes = warnings
        .iter()
        .map(PostCommitWarning::stable_code)
        .collect::<Vec<_>>();
    if copy_mode == "finder" {
        codes.push("copy.finder-fallback");
    }
    codes.sort_unstable();
    codes.dedup();
    if codes.is_empty() {
        return None;
    }

    let semantic_codes = codes
        .into_iter()
        .map(|code| match code {
            "copy.direct-recovery-residual" => RECOVERY_CLEANUP_PENDING_WARNING_CODE,
            "copy.elevated-transaction-cleanup" => PROTECTED_RECOVERY_EVIDENCE_WARNING_CODE,
            "copy.transaction-backup-cleanup"
            | "copy.elevated-admin-cleanup"
            | "apply.staging-cleanup" => TEMPORARY_CLEANUP_PENDING_WARNING_CODE,
            "copy.finder-fallback" => FINDER_FALLBACK_USED_WARNING_CODE,
            _ => NON_FATAL_CLEANUP_WARNING_CODE,
        })
        .fold(Vec::new(), |mut semantic_codes, code| {
            if !semantic_codes.contains(&code) {
                semantic_codes.push(code);
            }
            semantic_codes
        });
    Some(
        semantic_codes
            .into_iter()
            .map(|code| format!("{INTERNAL_WARNING_CODE_PREFIX}{code}]"))
            .collect::<Vec<_>>()
            .join(""),
    )
}

#[cfg(test)]
mod warning_tests {
    use std::path::PathBuf;

    use crate::privilege::{PostCommitWarning, PostCommitWarningCode};

    use super::{
        renderer_warning_for_copy, ActionPayload, INTERNAL_WARNING_CODE_PREFIX,
        PERMISSION_REQUIRED_ERROR_CODE, PROTECTED_RECOVERY_EVIDENCE_WARNING_CODE,
        PROTECTED_TRANSACTION_WARNING, RESTART_FAILED_WARNING_CODE,
        STATE_DURABILITY_PENDING_WARNING_CODE, TEMPORARY_CLEANUP_PENDING_WARNING_CODE,
        TEMPORARY_CLEANUP_WARNING,
    };

    #[test]
    fn protected_transaction_and_staging_cleanup_keep_distinct_instructions() {
        let warnings = [
            PostCommitWarning::new(
                PostCommitWarningCode::ElevatedTransactionCleanup,
                [PathBuf::from(r"C:\Program Files\Cavalry")],
                Some("private worker detail".to_string()),
            ),
            PostCommitWarning::new(
                PostCommitWarningCode::StagingCleanup,
                [PathBuf::from(r"C:\Users\fixture\Temp")],
                Some("private staging detail".to_string()),
            ),
        ];

        let rendered = renderer_warning_for_copy(&warnings, "elevated").unwrap();

        assert!(rendered.contains(&format!(
            "{INTERNAL_WARNING_CODE_PREFIX}{PROTECTED_RECOVERY_EVIDENCE_WARNING_CODE}]"
        )));
        assert!(rendered.contains(&format!(
            "{INTERNAL_WARNING_CODE_PREFIX}{TEMPORARY_CLEANUP_PENDING_WARNING_CODE}]"
        )));
        assert!(!rendered.contains("Program Files"));
        assert!(!rendered.contains("private"));

        let payload = ActionPayload::ok_lang("zh-Hans", Some(rendered)).into_renderer_contract();
        assert_eq!(
            payload.warning_codes,
            [
                PROTECTED_RECOVERY_EVIDENCE_WARNING_CODE,
                TEMPORARY_CLEANUP_PENDING_WARNING_CODE,
            ]
        );
        assert_eq!(payload.warning, None);
    }

    #[test]
    fn protected_transaction_warning_never_advises_closing_the_switcher() {
        let rendered = renderer_warning_for_copy(
            &[PostCommitWarning::new(
                PostCommitWarningCode::ElevatedTransactionCleanup,
                std::iter::empty::<PathBuf>(),
                None,
            )],
            "elevated",
        )
        .unwrap();

        assert_eq!(
            rendered,
            format!("{INTERNAL_WARNING_CODE_PREFIX}{PROTECTED_RECOVERY_EVIDENCE_WARNING_CODE}]")
        );
        assert!(!rendered.contains(TEMPORARY_CLEANUP_PENDING_WARNING_CODE));
    }

    #[test]
    fn renderer_contract_composes_codes_and_removes_internal_warning_prose() {
        let payload = ActionPayload::ok_lang(
            "zh-Hans",
            Some(format!(
                "{PROTECTED_TRANSACTION_WARNING} {TEMPORARY_CLEANUP_WARNING}"
            )),
        )
        .into_renderer_contract()
        .with_warning_code(RESTART_FAILED_WARNING_CODE);

        assert_eq!(
            payload.warning_codes,
            [
                RESTART_FAILED_WARNING_CODE,
                PROTECTED_RECOVERY_EVIDENCE_WARNING_CODE,
                TEMPORARY_CLEANUP_PENDING_WARNING_CODE,
            ]
        );
        assert_eq!(
            payload.warning_code.as_deref(),
            Some(RESTART_FAILED_WARNING_CODE)
        );
        assert_eq!(payload.warning, None);
    }

    #[test]
    fn state_directory_fsync_warning_maps_to_retry_code_without_leaking_path() {
        let payload = ActionPayload::ok_count(38);
        let payload = ActionPayload {
            warning: Some(
                "state generation is committed, but the state directory /Users/private could not be fsynced: injected"
                    .to_string(),
            ),
            ..payload
        }
        .into_renderer_contract();

        assert_eq!(
            payload.warning_codes,
            [STATE_DURABILITY_PENDING_WARNING_CODE]
        );
        assert_eq!(payload.warning, None);
    }

    #[test]
    fn permission_cancellation_has_a_stable_non_destructive_error_code() {
        let payload = ActionPayload::permission_error("user canceled elevation");
        assert!(!payload.ok);
        assert!(payload.permission_required);
        assert_eq!(
            payload.error_code.as_deref(),
            Some(PERMISSION_REQUIRED_ERROR_CODE)
        );
        assert!(!payload.reconciliation_required);
    }
}
