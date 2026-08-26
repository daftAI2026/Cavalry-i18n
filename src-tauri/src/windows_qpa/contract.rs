/**
 * [INPUT]: 依赖 InstallLayout、serde 与绝对 Windows 路径/小写 SHA-256 约束。
 * [OUTPUT]: 定义 QPA manifest、由 activate/restore plan 唯一导出的 manifest 字节、hash-locked Activate/EnglishRestore、四态检查与安全无操作计划。
 * [POS]: windows_qpa 的稳定数据合同；Rust 普通写入与受限提升 worker 共用同一 transition schema，C++ 代理只消费其中同构 manifest。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
use std::path::Path;

use serde::{Deserialize, Serialize};

use crate::install::InstallLayout;

pub const RECOVERY_DIRECTORY_NAME: &str = "cavalry-i18n-qpa";
pub const MANIFEST_FILE_NAME: &str = "manifest.json";
pub const VENDOR_QWINDOWS_FILE_NAME: &str = "vendor-qwindows.dll";
pub const QWINDOWS_FILE_NAME: &str = "qwindows.dll";
pub const QT_CORE_FILE_NAME: &str = "Qt6Core.dll";
pub const GENERIC_PLUGIN_RELATIVE_PATH: &str = "generic/cavalryi18n.dll";
pub const SUPPORTED_CAVALRY_VERSION: &str = "2.7.2";
pub const SUPPORTED_QT_VERSION: &str = "6.6.3";
pub const SUPPORTED_ARCHITECTURE: &str = "x86_64";
pub const VENDOR_QWINDOWS_SHA256: &str =
    "e039d39a6b99a26a358a85660147941112a4c9df3a62b5e19a8ae9ed75be3f01";

pub(super) const PLAN_SCHEMA_VERSION: u32 = 1;
pub(super) const MANIFEST_SCHEMA_VERSION: u32 = 1;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum QpaDeploymentState {
    Stock,
    Active,
    Drifted,
    Recover,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct QpaInspection {
    pub state: QpaDeploymentState,
    pub phase: Option<QpaManifestPhase>,
    pub current_qwindows_sha256: Option<String>,
    pub detail: String,
}

pub(super) fn inspection(
    state: QpaDeploymentState,
    phase: Option<QpaManifestPhase>,
    current_qwindows_sha256: Option<String>,
    detail: impl Into<String>,
) -> QpaInspection {
    QpaInspection {
        state,
        phase,
        current_qwindows_sha256,
        detail: detail.into(),
    }
}

pub(super) fn manifest_from_activation_plan(
    plan: &QpaActivationPlan,
    phase: QpaManifestPhase,
) -> QpaManifest {
    QpaManifest {
        schema_version: MANIFEST_SCHEMA_VERSION,
        phase,
        cavalry_version: plan.cavalry_version.clone(),
        cavalry_executable_sha256: plan.cavalry_executable_sha256.clone(),
        qt_version: plan.qt_version.clone(),
        architecture: plan.architecture.clone(),
        vendor_qwindows_sha256: plan.vendor_qwindows_sha256.clone(),
        proxy_qwindows_sha256: plan.proxy_qwindows_sha256.clone(),
        generic_plugin_sha256: plan.generic_plugin_sha256.clone(),
    }
}

pub(super) fn manifest_from_restore_plan(plan: &QpaRestorePlan) -> QpaManifest {
    QpaManifest {
        schema_version: MANIFEST_SCHEMA_VERSION,
        phase: QpaManifestPhase::Restoring,
        cavalry_version: plan.cavalry_version.clone(),
        cavalry_executable_sha256: plan.cavalry_executable_sha256.clone(),
        qt_version: plan.qt_version.clone(),
        architecture: plan.architecture.clone(),
        vendor_qwindows_sha256: plan.vendor_qwindows_sha256.clone(),
        proxy_qwindows_sha256: plan.proxy_qwindows_sha256.clone(),
        generic_plugin_sha256: plan.generic_plugin_sha256.clone(),
    }
}

#[derive(Debug, Clone, Copy, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum QpaManifestPhase {
    Prepared,
    Active,
    Restoring,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub struct QpaManifest {
    pub schema_version: u32,
    pub phase: QpaManifestPhase,
    pub cavalry_version: String,
    pub cavalry_executable_sha256: String,
    pub qt_version: String,
    pub architecture: String,
    pub vendor_qwindows_sha256: String,
    pub proxy_qwindows_sha256: String,
    pub generic_plugin_sha256: String,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub struct QpaActivationPlan {
    pub schema_version: u32,
    pub install_root: String,
    pub proxy_source_path: String,
    pub cavalry_version: String,
    pub cavalry_executable_sha256: String,
    pub qt_version: String,
    pub architecture: String,
    pub expected_current_qwindows_sha256: Option<String>,
    pub vendor_qwindows_sha256: String,
    pub proxy_qwindows_sha256: String,
    pub generic_plugin_sha256: String,
}

#[derive(Debug, Clone, Copy, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum RestoreReason {
    EnglishSelection,
}

#[derive(Debug, Clone, Copy, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum RestoreAction {
    ReplaceProxy,
    CreateMissing,
    CleanupOnly,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub struct QpaRestorePlan {
    pub schema_version: u32,
    pub install_root: String,
    pub reason: RestoreReason,
    pub action: RestoreAction,
    pub cavalry_version: String,
    pub cavalry_executable_sha256: String,
    pub qt_version: String,
    pub architecture: String,
    pub expected_current_qwindows_sha256: Option<String>,
    pub proxy_qwindows_sha256: String,
    pub vendor_qwindows_sha256: String,
    pub generic_plugin_sha256: String,
}

#[derive(Debug, Clone, Copy, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum QpaNoopReason {
    AlreadyStock,
    VendorUpdatePreserved,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub struct QpaNoopPlan {
    pub schema_version: u32,
    pub install_root: String,
    pub reason: QpaNoopReason,
    pub cavalry_version: String,
    pub cavalry_executable_sha256: String,
    pub qt_version: String,
    pub architecture: String,
    pub expected_current_qwindows_sha256: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(
    deny_unknown_fields,
    rename_all = "camelCase",
    tag = "operation",
    content = "plan"
)]
pub enum QpaTransitionPlan {
    Activate(QpaActivationPlan),
    EnglishRestore(QpaRestorePlan),
    Noop(QpaNoopPlan),
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ActivationOutcome {
    Activated,
    AlreadyActive,
    Recovered,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RestoreOutcome {
    Restored,
    AlreadyStock,
    VendorUpdatePreserved,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum PreparedRestore {
    Execute(QpaRestorePlan),
    Complete(RestoreOutcome),
}

pub struct ActivationRequest<'a> {
    pub layout: &'a InstallLayout,
    /// 该值必须来自现有 Windows 安装发现证据；QPA 层拒绝除 2.7.2 外的任何值。
    pub cavalry_version: &'a str,
    pub proxy_source: &'a Path,
}

pub struct RestoreRequest<'a> {
    pub layout: &'a InstallLayout,
    /// manifest 可能受损；当前打包代理的哈希是证明“根 DLL 仍属于我们”的第二证据。
    pub proxy_source: &'a Path,
    /// 当前 Switcher 打包的 generic DLL 只提供所有权哈希，不作为 English payload 写入安装根。
    pub generic_source: &'a Path,
    pub reason: RestoreReason,
}

#[derive(Debug, Clone)]
pub(super) struct Policy {
    pub(super) cavalry_version: String,
    pub(super) qt_version: String,
    pub(super) architecture: String,
    pub(super) vendor_hash: String,
}

impl Policy {
    pub(super) fn production() -> Self {
        Self {
            cavalry_version: SUPPORTED_CAVALRY_VERSION.to_string(),
            qt_version: SUPPORTED_QT_VERSION.to_string(),
            architecture: SUPPORTED_ARCHITECTURE.to_string(),
            vendor_hash: VENDOR_QWINDOWS_SHA256.to_string(),
        }
    }
}

pub(super) fn validate_manifest(manifest: &QpaManifest, policy: &Policy) -> Result<(), String> {
    if manifest.schema_version != MANIFEST_SCHEMA_VERSION
        || manifest.cavalry_version != policy.cavalry_version
        || manifest.qt_version != policy.qt_version
        || manifest.architecture != policy.architecture
        || manifest.vendor_qwindows_sha256 != policy.vendor_hash
    {
        return Err("QPA manifest target identity is unsupported.".to_string());
    }
    validate_hash(
        &manifest.cavalry_executable_sha256,
        "cavalryExecutableSha256",
    )?;
    validate_hash(&manifest.proxy_qwindows_sha256, "proxyQwindowsSha256")?;
    validate_hash(&manifest.generic_plugin_sha256, "genericPluginSha256")
}

pub(super) fn validate_activation_plan(
    plan: &QpaActivationPlan,
    policy: &Policy,
) -> Result<(), String> {
    if plan.schema_version != PLAN_SCHEMA_VERSION
        || plan.cavalry_version != policy.cavalry_version
        || plan.qt_version != policy.qt_version
        || plan.architecture != policy.architecture
        || plan.vendor_qwindows_sha256 != policy.vendor_hash
    {
        return Err("QPA activation plan target identity is unsupported.".to_string());
    }
    validate_absolute_path(&plan.install_root, "installRoot")?;
    validate_absolute_path(&plan.proxy_source_path, "proxySourcePath")?;
    validate_optional_hash(
        plan.expected_current_qwindows_sha256.as_deref(),
        "expectedCurrentQwindowsSha256",
    )?;
    validate_hash(&plan.cavalry_executable_sha256, "cavalryExecutableSha256")?;
    validate_hash(&plan.proxy_qwindows_sha256, "proxyQwindowsSha256")?;
    validate_hash(&plan.generic_plugin_sha256, "genericPluginSha256")
}

pub(super) fn validate_restore_plan(plan: &QpaRestorePlan, policy: &Policy) -> Result<(), String> {
    if plan.schema_version != PLAN_SCHEMA_VERSION
        || plan.cavalry_version != policy.cavalry_version
        || plan.qt_version != policy.qt_version
        || plan.architecture != policy.architecture
        || plan.vendor_qwindows_sha256 != policy.vendor_hash
    {
        return Err("QPA restore plan target identity is unsupported.".to_string());
    }
    validate_absolute_path(&plan.install_root, "installRoot")?;
    validate_optional_hash(
        plan.expected_current_qwindows_sha256.as_deref(),
        "expectedCurrentQwindowsSha256",
    )?;
    validate_hash(&plan.cavalry_executable_sha256, "cavalryExecutableSha256")?;
    validate_hash(&plan.proxy_qwindows_sha256, "proxyQwindowsSha256")?;
    validate_hash(&plan.generic_plugin_sha256, "genericPluginSha256")
}

pub(super) fn validate_noop_plan(plan: &QpaNoopPlan, policy: &Policy) -> Result<(), String> {
    if plan.schema_version != PLAN_SCHEMA_VERSION
        || plan.cavalry_version != policy.cavalry_version
        || plan.qt_version != policy.qt_version
        || plan.architecture != policy.architecture
    {
        return Err("QPA no-op plan target identity is unsupported.".to_string());
    }
    validate_absolute_path(&plan.install_root, "installRoot")?;
    validate_hash(&plan.cavalry_executable_sha256, "cavalryExecutableSha256")?;
    validate_optional_hash(
        plan.expected_current_qwindows_sha256.as_deref(),
        "expectedCurrentQwindowsSha256",
    )
}

fn validate_absolute_path(value: &str, field: &str) -> Result<(), String> {
    if value.is_empty()
        || !Path::new(value).is_absolute()
        || value
            .chars()
            .any(|character| matches!(character, '\0' | '\r' | '\n' | '\t'))
    {
        return Err(format!("QPA plan has an invalid {field}."));
    }
    Ok(())
}

fn validate_optional_hash(value: Option<&str>, field: &str) -> Result<(), String> {
    value.map_or(Ok(()), |value| validate_hash(value, field))
}

fn validate_hash(value: &str, field: &str) -> Result<(), String> {
    if value.len() != 64
        || !value
            .chars()
            .all(|character| character.is_ascii_hexdigit() && !character.is_ascii_uppercase())
    {
        return Err(format!("QPA contract has an invalid {field}."));
    }
    Ok(())
}
