/**
 * [INPUT]: 依赖 serde 序列化和 privilege 的 typed post-commit warning code。
 * [OUTPUT]: 提供六命令名称、renderer 兼容 payload DTO 与稳定 warning code 到 UI 文案的映射。
 * [POS]: commands 的外部契约层；任何基础设施路径或英文诊断不得穿透为最终 warning 文案。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
use serde::Serialize;

use crate::privilege::PostCommitWarning;

const PROTECTED_TRANSACTION_WARNING: &str = "Language files were applied, but transaction recovery evidence remains in the protected Cavalry installation. Do not delete it manually.";
const TEMPORARY_CLEANUP_WARNING: &str = "Language files were applied, but temporary cleanup is still pending. Close Cavalry Language Switcher before removing temporary files.";

pub const COMMAND_NAMES: [&str; 6] = [
    "get_status",
    "browse_app",
    "extract_english",
    "apply_language",
    "open_privacy_security",
    "restart_cavalry",
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
    pub default_app_candidates: Vec<String>,
    pub diagnostics: Option<BundleDiagnostics>,
    pub languages: Vec<LanguageChoice>,
    pub needs_extract: bool,
    pub permission_action: String,
    pub platform: String,
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

impl ActionPayload {
    pub(crate) fn ok() -> Self {
        Self {
            ok: true,
            count: None,
            current_lang: None,
            warning: None,
            permission_required: false,
            error: None,
        }
    }

    pub(crate) fn ok_count(count: usize) -> Self {
        Self {
            ok: true,
            count: Some(count),
            current_lang: None,
            warning: None,
            permission_required: false,
            error: None,
        }
    }

    pub(crate) fn ok_lang(lang: &str, warning: Option<String>) -> Self {
        Self {
            ok: true,
            count: None,
            current_lang: Some(lang.to_string()),
            warning,
            permission_required: false,
            error: None,
        }
    }

    pub(crate) fn error(message: &str) -> Self {
        Self {
            ok: false,
            count: None,
            current_lang: None,
            warning: None,
            permission_required: false,
            error: Some(message.to_string()),
        }
    }

    pub(crate) fn permission_error(message: &str) -> Self {
        Self {
            permission_required: true,
            ..Self::error(message)
        }
    }
}

fn is_false(value: &bool) -> bool {
    !*value
}

/// 保持旧 warning 字段，但只输出稳定 code 对应的 UI 文案，不泄露临时路径、OS 错误或 UAC stderr。
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

    let messages = codes
        .into_iter()
        .map(|code| match code {
            "copy.direct-recovery-residual" => {
                "Language files were applied after recovery; temporary recovery files may still need manual cleanup."
            }
            "copy.elevated-transaction-cleanup" => PROTECTED_TRANSACTION_WARNING,
            "copy.transaction-backup-cleanup"
            | "copy.elevated-admin-cleanup"
            | "apply.staging-cleanup" => TEMPORARY_CLEANUP_WARNING,
            "copy.finder-fallback" => {
                "macOS blocked direct shell copy, so Finder-style replacement was used."
            }
            _ => "Language files were applied with a non-fatal cleanup warning.",
        })
        .fold(Vec::new(), |mut messages, message| {
            if !messages.contains(&message) {
                messages.push(message);
            }
            messages
        });
    Some(messages.join(" "))
}

#[cfg(test)]
mod warning_tests {
    use std::path::PathBuf;

    use crate::privilege::{PostCommitWarning, PostCommitWarningCode};

    use super::{
        renderer_warning_for_copy, PROTECTED_TRANSACTION_WARNING, TEMPORARY_CLEANUP_WARNING,
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

        assert!(rendered.contains(PROTECTED_TRANSACTION_WARNING));
        assert!(rendered.contains(TEMPORARY_CLEANUP_WARNING));
        assert!(!rendered.contains("Program Files"));
        assert!(!rendered.contains("private"));
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

        assert_eq!(rendered, PROTECTED_TRANSACTION_WARNING);
        assert!(!rendered.contains("Close Cavalry Language Switcher"));
    }
}
