/**
 * [INPUT]: 依赖 serde/serde_json、SHA-256 与 windows_qpa 的封闭 QPA transition schema。
 * [OUTPUT]: 提供 Windows 提权语言事务 plan v1、固定 payload 记录、受 plan 路径约束的 QPA 源、单令牌编解码与 fail-closed worker argv 分类。
 * [POS]: privilege/windows/language_transaction 的纯数据边界；父进程和同一 EXE 的提权 worker 只交换摘要与固定记录，不接受任意复制目标。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
use std::{
    collections::HashSet,
    fmt,
    os::windows::ffi::OsStrExt,
    path::{Path, PathBuf},
};

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

use crate::windows_qpa::QpaTransitionPlan;

#[path = "transport.rs"]
mod transport;
pub(crate) use transport::{
    deserialize_bound_plan, parse_worker_argv, WorkerArgv, WorkerTransport,
    MAX_TRANSPORT_TOKEN_LEN, WORKER_ARGUMENT_PREFIX,
};

#[cfg(test)]
#[path = "contract_tests.rs"]
mod tests;

pub(crate) const PLAN_SCHEMA_VERSION: u32 = 1;
pub(crate) const MAX_PLAN_BYTES: usize = 1024 * 1024;
pub(crate) const MAX_PAYLOAD_RECORDS: usize = 4096;

pub(crate) const WORKER_EXIT_COMMITTED_CLEAN: u32 = 0;
pub(crate) const WORKER_EXIT_COMMITTED_WITH_CLEANUP_RESIDUAL: u32 = 42;
pub(crate) const WORKER_EXIT_ROLLED_BACK_OR_ZERO_MUTATION_CLEAN: u32 = 43;
pub(crate) const WORKER_EXIT_STATE_OR_CLEANUP_UNCERTAIN: u32 = 44;

pub(crate) const PENDING_MARKER_ID: &str = "@pending-marker";
pub(crate) const FINAL_MARKER_ID: &str = "@final-marker";
pub(crate) const GENERIC_PLUGIN_ID: &str = "@generic-plugin";
pub(crate) const QPA_PROXY_SOURCE_ID: &str = "@qpa-proxy-source";

pub(super) const HASH_HEX_LEN: usize = 64;
pub(super) const NONCE_HEX_LEN: usize = 64;
const MAX_RELATIVE_ID_BYTES: usize = 512;
const MAX_WINDOWS_PATH_UNITS: usize = 2048;

#[derive(Debug, Clone, Copy, Deserialize, Serialize, PartialEq, Eq)]
pub(crate) enum Language {
    #[serde(rename = "en")]
    English,
    #[serde(rename = "zh-Hans")]
    SimplifiedChinese,
    #[serde(rename = "zh-Hant")]
    TraditionalChinese,
    #[serde(rename = "ja_JP")]
    Japanese,
}

impl Language {
    pub(crate) fn as_str(self) -> &'static str {
        match self {
            Self::English => "en",
            Self::SimplifiedChinese => "zh-Hans",
            Self::TraditionalChinese => "zh-Hant",
            Self::Japanese => "ja_JP",
        }
    }

    fn is_english(self) -> bool {
        self == Self::English
    }
}

#[derive(Debug, Clone, Copy, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) enum PayloadKind {
    PendingMarker,
    CoreAsset,
    KnownPluginDefinition,
    DiscoveredPluginStrings,
    GenericPlugin,
    QpaProxySource,
    FinalMarker,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub(crate) struct PayloadRecord {
    pub id: String,
    pub kind: PayloadKind,
    pub source_sha256: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub expected_destination_sha256: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub(crate) struct ElevatedLanguagePlan {
    pub schema_version: u32,
    pub install_root: String,
    pub language: Language,
    pub nonce: String,
    pub expected_worker_exe_sha256: String,
    pub payloads: Vec<PayloadRecord>,
    pub qpa_transition: QpaTransitionPlan,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct SerializedPlan {
    pub bytes: Vec<u8>,
    pub sha256: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) enum ContractError {
    InvalidPlan(&'static str),
    InvalidToken(&'static str),
    InvalidWorkerArguments(&'static str),
}

impl fmt::Display for ContractError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::InvalidPlan(reason) => {
                write!(formatter, "Invalid elevated language plan: {reason}")
            }
            Self::InvalidToken(reason) => {
                write!(
                    formatter,
                    "Invalid elevated worker transport token: {reason}"
                )
            }
            Self::InvalidWorkerArguments(reason) => {
                write!(formatter, "Invalid elevated worker arguments: {reason}")
            }
        }
    }
}

impl std::error::Error for ContractError {}

pub(crate) fn payload_source_path(
    plan_path: &Path,
    record_index: usize,
) -> Result<PathBuf, ContractError> {
    validate_local_windows_path(plan_path, "plan path")?;
    if record_index >= MAX_PAYLOAD_RECORDS {
        return Err(ContractError::InvalidPlan(
            "payload record index exceeds the schema bound",
        ));
    }
    let plan_directory = plan_path.parent().ok_or(ContractError::InvalidPlan(
        "plan path has no parent directory",
    ))?;
    Ok(plan_directory
        .join("payloads")
        .join(format!("{record_index}.bin")))
}

pub(crate) fn validate_plan(
    plan: &ElevatedLanguagePlan,
    plan_path: &Path,
) -> Result<(), ContractError> {
    if plan.schema_version != PLAN_SCHEMA_VERSION {
        return Err(ContractError::InvalidPlan(
            "schemaVersion must be exactly 1",
        ));
    }
    validate_local_windows_path(Path::new(&plan.install_root), "installRoot")?;
    validate_local_windows_path(plan_path, "plan path")?;
    validate_lower_hex(&plan.nonce, NONCE_HEX_LEN, "nonce")?;
    validate_lower_hex(
        &plan.expected_worker_exe_sha256,
        HASH_HEX_LEN,
        "expectedWorkerExeSha256",
    )?;
    if plan.payloads.is_empty() || plan.payloads.len() > MAX_PAYLOAD_RECORDS {
        return Err(ContractError::InvalidPlan(
            "payload record count is outside the schema bound",
        ));
    }

    let mut ids = HashSet::with_capacity(plan.payloads.len());
    let mut pending_record = None;
    let mut final_record = None;
    let mut generic_record = None;
    let mut qpa_proxy_record = None;
    for (index, record) in plan.payloads.iter().enumerate() {
        validate_payload_record(record)?;
        let folded_id = record.id.to_lowercase();
        if !ids.insert(folded_id) {
            return Err(ContractError::InvalidPlan(
                "payload IDs must be unique under Windows case folding",
            ));
        }
        match record.kind {
            PayloadKind::PendingMarker => {
                if pending_record.replace(record).is_some() {
                    return Err(ContractError::InvalidPlan(
                        "exactly one pending marker is required",
                    ));
                }
            }
            PayloadKind::FinalMarker => {
                if final_record.replace(record).is_some() {
                    return Err(ContractError::InvalidPlan(
                        "exactly one final marker is required",
                    ));
                }
            }
            PayloadKind::GenericPlugin => generic_record = Some((index, record)),
            PayloadKind::QpaProxySource => qpa_proxy_record = Some((index, record)),
            PayloadKind::CoreAsset
            | PayloadKind::KnownPluginDefinition
            | PayloadKind::DiscoveredPluginStrings => {}
        }
    }
    let pending_record = pending_record.ok_or(ContractError::InvalidPlan(
        "exactly one pending marker is required",
    ))?;
    let final_record = final_record.ok_or(ContractError::InvalidPlan(
        "exactly one final marker is required",
    ))?;
    if final_record.expected_destination_sha256.as_deref()
        != Some(pending_record.source_sha256.as_str())
    {
        return Err(ContractError::InvalidPlan(
            "final marker preimage must be the pending marker hash",
        ));
    }

    validate_language_payloads(plan.language, generic_record, qpa_proxy_record)?;
    validate_qpa_transition(plan, plan_path, generic_record, qpa_proxy_record)
}

pub(crate) fn serialize_plan(
    plan: &ElevatedLanguagePlan,
    plan_path: &Path,
) -> Result<SerializedPlan, ContractError> {
    validate_plan(plan, plan_path)?;
    let bytes = serde_json::to_vec(plan)
        .map_err(|_| ContractError::InvalidPlan("plan could not be serialized"))?;
    if bytes.len() > MAX_PLAN_BYTES {
        return Err(ContractError::InvalidPlan(
            "serialized plan exceeds the byte bound",
        ));
    }
    Ok(SerializedPlan {
        sha256: sha256_bytes(&bytes),
        bytes,
    })
}

pub(crate) fn deserialize_plan(
    bytes: &[u8],
    plan_path: &Path,
) -> Result<ElevatedLanguagePlan, ContractError> {
    if bytes.is_empty() || bytes.len() > MAX_PLAN_BYTES {
        return Err(ContractError::InvalidPlan(
            "serialized plan size is outside the byte bound",
        ));
    }
    let plan = serde_json::from_slice::<ElevatedLanguagePlan>(bytes)
        .map_err(|_| ContractError::InvalidPlan("plan JSON does not match schema v1"))?;
    validate_plan(&plan, plan_path)?;
    Ok(plan)
}

fn validate_payload_record(record: &PayloadRecord) -> Result<(), ContractError> {
    validate_lower_hex(&record.source_sha256, HASH_HEX_LEN, "sourceSha256")?;
    if let Some(hash) = record.expected_destination_sha256.as_deref() {
        validate_lower_hex(hash, HASH_HEX_LEN, "expectedDestinationSha256")?;
    }
    match record.kind {
        PayloadKind::PendingMarker if record.id != PENDING_MARKER_ID => {
            return Err(ContractError::InvalidPlan(
                "pending marker must use its fixed logical ID",
            ));
        }
        PayloadKind::FinalMarker if record.id != FINAL_MARKER_ID => {
            return Err(ContractError::InvalidPlan(
                "final marker must use its fixed logical ID",
            ));
        }
        PayloadKind::GenericPlugin if record.id != GENERIC_PLUGIN_ID => {
            return Err(ContractError::InvalidPlan(
                "generic plugin must use its fixed logical ID",
            ));
        }
        PayloadKind::QpaProxySource if record.id != QPA_PROXY_SOURCE_ID => {
            return Err(ContractError::InvalidPlan(
                "QPA proxy source must use its fixed logical ID",
            ));
        }
        PayloadKind::QpaProxySource if record.expected_destination_sha256.is_some() => {
            return Err(ContractError::InvalidPlan(
                "QPA proxy payload is a staged source and has no destination expectation",
            ));
        }
        PayloadKind::CoreAsset
        | PayloadKind::KnownPluginDefinition
        | PayloadKind::DiscoveredPluginStrings => validate_relative_id(&record.id)?,
        PayloadKind::PendingMarker
        | PayloadKind::GenericPlugin
        | PayloadKind::QpaProxySource
        | PayloadKind::FinalMarker => {}
    }
    Ok(())
}

fn validate_language_payloads(
    language: Language,
    generic: Option<(usize, &PayloadRecord)>,
    qpa_proxy: Option<(usize, &PayloadRecord)>,
) -> Result<(), ContractError> {
    match (language.is_english(), generic, qpa_proxy) {
        (true, None, None) | (false, Some(_), Some(_)) => Ok(()),
        (true, _, _) => Err(ContractError::InvalidPlan(
            "English plans must not carry generic or QPA proxy payloads",
        )),
        (false, _, _) => Err(ContractError::InvalidPlan(
            "non-English plans require one generic and one QPA proxy payload",
        )),
    }
}

fn validate_qpa_transition(
    plan: &ElevatedLanguagePlan,
    plan_path: &Path,
    generic: Option<(usize, &PayloadRecord)>,
    qpa_proxy: Option<(usize, &PayloadRecord)>,
) -> Result<(), ContractError> {
    let qpa_root = match &plan.qpa_transition {
        QpaTransitionPlan::Activate(activation) => {
            if plan.language.is_english() {
                return Err(ContractError::InvalidPlan(
                    "English language cannot activate the QPA proxy",
                ));
            }
            let (_, generic) = generic.ok_or(ContractError::InvalidPlan(
                "QPA activation is missing the generic payload",
            ))?;
            let (proxy_index, proxy) = qpa_proxy.ok_or(ContractError::InvalidPlan(
                "QPA activation is missing the proxy payload",
            ))?;
            if activation.generic_plugin_sha256 != generic.source_sha256
                || activation.proxy_qwindows_sha256 != proxy.source_sha256
            {
                return Err(ContractError::InvalidPlan(
                    "QPA activation hashes do not match their staged payloads",
                ));
            }
            let expected_proxy_source = payload_source_path(plan_path, proxy_index)?;
            if !windows_paths_equal(
                Path::new(&activation.proxy_source_path),
                &expected_proxy_source,
            )? {
                return Err(ContractError::InvalidPlan(
                    "QPA proxySourcePath is not the derived staged payload path",
                ));
            }
            activation.install_root.as_str()
        }
        QpaTransitionPlan::EnglishRestore(restore) => {
            if !plan.language.is_english() {
                return Err(ContractError::InvalidPlan(
                    "non-English language cannot restore the vendor QPA",
                ));
            }
            restore.install_root.as_str()
        }
        QpaTransitionPlan::Noop(noop) => {
            if !plan.language.is_english() {
                return Err(ContractError::InvalidPlan(
                    "non-English language cannot use an English QPA no-op",
                ));
            }
            noop.install_root.as_str()
        }
    };
    if !windows_paths_equal(Path::new(qpa_root), Path::new(&plan.install_root))? {
        return Err(ContractError::InvalidPlan(
            "QPA transition install root does not match installRoot",
        ));
    }
    Ok(())
}

fn validate_relative_id(value: &str) -> Result<(), ContractError> {
    if value.is_empty()
        || value.len() > MAX_RELATIVE_ID_BYTES
        || value.starts_with('/')
        || value.starts_with('\\')
        || value.contains('\\')
        || value.contains(':')
        || value.chars().any(char::is_control)
    {
        return Err(ContractError::InvalidPlan(
            "asset/plugin ID is not a normalized relative ID",
        ));
    }
    for component in value.split('/') {
        if component.is_empty()
            || matches!(component, "." | "..")
            || component.ends_with(' ')
            || component.ends_with('.')
            || is_reserved_windows_component(component)
        {
            return Err(ContractError::InvalidPlan(
                "asset/plugin ID contains an unsafe path component",
            ));
        }
    }
    Ok(())
}

fn validate_local_windows_path(path: &Path, field: &'static str) -> Result<(), ContractError> {
    let value = path
        .to_str()
        .ok_or(ContractError::InvalidPlan("Windows path must be Unicode"))?;
    let units = path.as_os_str().encode_wide().count();
    let bytes = value.as_bytes();
    if units == 0
        || units > MAX_WINDOWS_PATH_UNITS
        || bytes.len() < 3
        || !bytes[0].is_ascii_alphabetic()
        || bytes[1] != b':'
        || !matches!(bytes[2], b'\\' | b'/')
        || value.starts_with("\\\\")
        || value.starts_with("//")
        || value.chars().any(char::is_control)
        || value[2..].contains(':')
    {
        return Err(ContractError::InvalidPlan(field));
    }
    let suffix = &value[3..];
    if suffix.is_empty() {
        return Ok(());
    }
    for component in suffix.split(['\\', '/']) {
        if component.is_empty()
            || matches!(component, "." | "..")
            || component.ends_with(' ')
            || component.ends_with('.')
            || is_reserved_windows_component(component)
        {
            return Err(ContractError::InvalidPlan(field));
        }
    }
    Ok(())
}

fn windows_paths_equal(left: &Path, right: &Path) -> Result<bool, ContractError> {
    validate_local_windows_path(left, "QPA path")?;
    validate_local_windows_path(right, "derived payload path")?;
    let normalize = |path: &Path| {
        path.to_string_lossy()
            .replace('/', "\\")
            .trim_end_matches('\\')
            .to_lowercase()
    };
    Ok(normalize(left) == normalize(right))
}

fn is_reserved_windows_component(component: &str) -> bool {
    let stem = component.split('.').next().unwrap_or(component);
    let folded = stem.to_ascii_lowercase();
    matches!(folded.as_str(), "con" | "prn" | "aux" | "nul")
        || folded.strip_prefix("com").is_some_and(|suffix| {
            matches!(suffix, "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9")
        })
        || folded.strip_prefix("lpt").is_some_and(|suffix| {
            matches!(suffix, "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9")
        })
}

fn validate_lower_hex(
    value: &str,
    expected_len: usize,
    field: &'static str,
) -> Result<(), ContractError> {
    if value.len() != expected_len
        || !value
            .bytes()
            .all(|byte| byte.is_ascii_digit() || matches!(byte, b'a'..=b'f'))
    {
        return Err(ContractError::InvalidPlan(field));
    }
    Ok(())
}

pub(super) fn sha256_bytes(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}
