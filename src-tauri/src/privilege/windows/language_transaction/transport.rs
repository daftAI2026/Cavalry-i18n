/**
 * [INPUT]: 依赖 contract 的有界 plan/摘要校验，以及 Windows OsString 的 UTF-16 原样转换。
 * [OUTPUT]: 提供 UTF-16LE-hex 单令牌、plan/nonce/worker 摘要绑定和 fail-closed worker argv 分类。
 * [POS]: Windows 提权语言事务的无 shell 传输层；命令行只携一个 ASCII-safe token，不携复制目标或可执行脚本。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
use std::{
    ffi::OsString,
    os::windows::ffi::{OsStrExt, OsStringExt},
    path::{Path, PathBuf},
};

use super::{
    deserialize_plan, serialize_plan, sha256_bytes, validate_local_windows_path,
    validate_lower_hex, ContractError, ElevatedLanguagePlan, SerializedPlan, HASH_HEX_LEN,
    NONCE_HEX_LEN,
};

pub(crate) const MAX_TRANSPORT_TOKEN_LEN: usize = 4096;
pub(crate) const WORKER_ARGUMENT_PREFIX: &str = "--cavalry-i18n-elevated-apply=";

const WORKER_ARGUMENT_STEM: &str = "--cavalry-i18n-elevated";
const TOKEN_VERSION: &str = "v1";

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct WorkerTransport {
    pub plan_path: PathBuf,
    pub plan_sha256: String,
    pub nonce: String,
    pub expected_worker_exe_sha256: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) enum WorkerArgv {
    NotWorker,
    Apply(WorkerTransport),
    HandledError(ContractError),
}

pub(crate) fn deserialize_bound_plan(
    bytes: &[u8],
    transport: &WorkerTransport,
) -> Result<ElevatedLanguagePlan, ContractError> {
    transport.validate()?;
    if sha256_bytes(bytes) != transport.plan_sha256 {
        return Err(ContractError::InvalidPlan(
            "serialized plan hash does not match the transport",
        ));
    }
    let plan = deserialize_plan(bytes, &transport.plan_path)?;
    if plan.nonce != transport.nonce {
        return Err(ContractError::InvalidPlan(
            "plan nonce does not match the transport",
        ));
    }
    if plan.expected_worker_exe_sha256 != transport.expected_worker_exe_sha256 {
        return Err(ContractError::InvalidPlan(
            "worker executable hash does not match the transport",
        ));
    }
    Ok(plan)
}

impl WorkerTransport {
    pub(crate) fn new(
        plan_path: PathBuf,
        plan_sha256: String,
        nonce: String,
        expected_worker_exe_sha256: String,
    ) -> Result<Self, ContractError> {
        let transport = Self {
            plan_path,
            plan_sha256,
            nonce,
            expected_worker_exe_sha256,
        };
        transport.validate()?;
        Ok(transport)
    }

    pub(crate) fn for_serialized_plan(
        plan_path: PathBuf,
        plan: &ElevatedLanguagePlan,
        serialized: &SerializedPlan,
    ) -> Result<Self, ContractError> {
        let canonical = serialize_plan(plan, &plan_path)?;
        if &canonical != serialized {
            return Err(ContractError::InvalidToken(
                "serialized plan does not match the validated plan",
            ));
        }
        Self::new(
            plan_path,
            serialized.sha256.clone(),
            plan.nonce.clone(),
            plan.expected_worker_exe_sha256.clone(),
        )
    }

    pub(crate) fn encode(&self) -> Result<String, ContractError> {
        self.validate()?;
        let token = format!(
            "{TOKEN_VERSION}.{}.{}.{}.{}",
            encode_utf16le_hex(&self.plan_path)?,
            self.plan_sha256,
            self.nonce,
            self.expected_worker_exe_sha256
        );
        validate_token_ascii(&token)?;
        Ok(token)
    }

    pub(crate) fn decode(token: &str) -> Result<Self, ContractError> {
        validate_token_ascii(token)?;
        let fields = token.split('.').collect::<Vec<_>>();
        if fields.len() != 5 || fields[0] != TOKEN_VERSION {
            return Err(ContractError::InvalidToken(
                "token must contain exactly five v1 fields",
            ));
        }
        Self::new(
            decode_utf16le_hex(fields[1])?,
            fields[2].to_string(),
            fields[3].to_string(),
            fields[4].to_string(),
        )
        .map_err(|_| ContractError::InvalidToken("token fields failed validation"))
    }

    fn validate(&self) -> Result<(), ContractError> {
        validate_local_windows_path(&self.plan_path, "plan path")
            .map_err(|_| ContractError::InvalidToken("plan path is not a local absolute path"))?;
        validate_lower_hex(&self.plan_sha256, HASH_HEX_LEN, "planSha256")
            .map_err(|_| ContractError::InvalidToken("plan hash must be lowercase SHA-256"))?;
        validate_lower_hex(&self.nonce, NONCE_HEX_LEN, "nonce")
            .map_err(|_| ContractError::InvalidToken("nonce must be 32-byte lowercase hex"))?;
        validate_lower_hex(
            &self.expected_worker_exe_sha256,
            HASH_HEX_LEN,
            "expectedWorkerExeSha256",
        )
        .map_err(|_| {
            ContractError::InvalidToken("worker executable hash must be lowercase SHA-256")
        })
    }
}

pub(crate) fn parse_worker_argv(args: &[OsString]) -> WorkerArgv {
    let reserved = args.iter().any(has_reserved_worker_stem);
    if !reserved {
        return WorkerArgv::NotWorker;
    }
    if args.len() != 1 {
        return WorkerArgv::HandledError(ContractError::InvalidWorkerArguments(
            "worker mode accepts exactly one argument",
        ));
    }
    let Some(argument) = args[0].to_str() else {
        return WorkerArgv::HandledError(ContractError::InvalidWorkerArguments(
            "worker argument must be Unicode",
        ));
    };
    let Some(token) = argument.strip_prefix(WORKER_ARGUMENT_PREFIX) else {
        return WorkerArgv::HandledError(ContractError::InvalidWorkerArguments(
            "reserved worker argument has an invalid shape",
        ));
    };
    match WorkerTransport::decode(token) {
        Ok(transport) => WorkerArgv::Apply(transport),
        Err(error) => WorkerArgv::HandledError(error),
    }
}

fn has_reserved_worker_stem(argument: &OsString) -> bool {
    let mut actual = argument.encode_wide();
    WORKER_ARGUMENT_STEM
        .encode_utf16()
        .all(|expected| actual.next() == Some(expected))
}

fn validate_token_ascii(token: &str) -> Result<(), ContractError> {
    if token.is_empty()
        || token.len() > MAX_TRANSPORT_TOKEN_LEN
        || !token
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_' | b'.'))
    {
        return Err(ContractError::InvalidToken(
            "token is empty, too long, or contains unsafe characters",
        ));
    }
    Ok(())
}

fn encode_utf16le_hex(path: &Path) -> Result<String, ContractError> {
    validate_local_windows_path(path, "plan path")
        .map_err(|_| ContractError::InvalidToken("plan path is not a local absolute path"))?;
    let mut encoded = String::with_capacity(path.as_os_str().encode_wide().count() * 4);
    for unit in path.as_os_str().encode_wide() {
        encoded.push_str(&format!("{unit:04x}"));
    }
    Ok(encoded)
}

fn decode_utf16le_hex(value: &str) -> Result<PathBuf, ContractError> {
    if value.is_empty()
        || value.len() % 4 != 0
        || !value
            .bytes()
            .all(|byte| byte.is_ascii_digit() || matches!(byte, b'a'..=b'f'))
    {
        return Err(ContractError::InvalidToken(
            "UTF-16LE plan path must be lowercase hex",
        ));
    }
    let wide = value
        .as_bytes()
        .chunks_exact(4)
        .map(|chunk| {
            let digits = std::str::from_utf8(chunk).map_err(|_| {
                ContractError::InvalidToken("UTF-16LE plan path is not valid ASCII")
            })?;
            u16::from_str_radix(digits, 16)
                .map_err(|_| ContractError::InvalidToken("UTF-16LE plan path is malformed"))
        })
        .collect::<Result<Vec<_>, _>>()?;
    Ok(PathBuf::from(OsString::from_wide(&wide)))
}
