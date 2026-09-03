/**
 * [INPUT]: 依赖 chrono/serde_json、运行时 state 目录与进程环境中的 HOME/临时目录。
 * [OUTPUT]: 提供 best-effort record/sanitize_message 与 diagnostics.jsonl 路径；以两代 512 KiB JSONL 记录轻量启动观察、用户触发的语言事务和权限设置边界，自动脱敏用户目录且永不改变业务结果。
 * [POS]: src-tauri/src 的本地诊断事实层；只记录阶段、无路径 reason code、结果和有限错误文本，不记录语言包内容、密钥、文件哈希或系统权限数据库，供真实机器复现后人工回读。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
use std::{
    env, fs,
    io::Write,
    path::{Path, PathBuf},
    sync::{Mutex, OnceLock},
};

use chrono::{SecondsFormat, Utc};
use serde_json::{json, Value};

const LOG_FILE: &str = "diagnostics.jsonl";
const PREVIOUS_LOG_FILE: &str = "diagnostics.previous.jsonl";
const MAX_LOG_BYTES: u64 = 512 * 1024;
const MAX_MESSAGE_CHARS: usize = 4096;

static LOG_LOCK: OnceLock<Mutex<()>> = OnceLock::new();

pub(crate) fn log_path(state_dir: &Path) -> PathBuf {
    state_dir.join(LOG_FILE)
}

pub(crate) fn sanitize_message(message: &str, state_dir: &Path) -> String {
    let mut sanitized = message.replace(&state_dir.to_string_lossy().to_string(), "<stateDir>");
    sanitized = sanitized.replace(&env::temp_dir().to_string_lossy().to_string(), "<temp>");
    for variable in ["HOME", "USERPROFILE"] {
        if let Some(home) = env::var_os(variable) {
            sanitized = sanitized.replace(&PathBuf::from(home).to_string_lossy().to_string(), "~");
        }
    }
    redact_hashes(&sanitized)
        .chars()
        .take(MAX_MESSAGE_CHARS)
        .collect()
}

fn redact_hashes(message: &str) -> String {
    const SHA256_HEX_CHARS: usize = 64;
    let mut output = String::with_capacity(message.len());
    let mut run = String::new();
    let flush = |run: &mut String, output: &mut String| {
        if run.len() >= SHA256_HEX_CHARS {
            output.push_str("<hash>");
        } else {
            output.push_str(run);
        }
        run.clear();
    };

    for character in message.chars() {
        if character.is_ascii_hexdigit() {
            run.push(character);
        } else {
            flush(&mut run, &mut output);
            output.push(character);
        }
    }
    flush(&mut run, &mut output);
    output
}

pub(crate) fn record(state_dir: &Path, event: &str, details: Value) {
    let lock = LOG_LOCK.get_or_init(|| Mutex::new(()));
    let _guard = lock.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
    let _ = record_inner(state_dir, event, details);
}

fn record_inner(state_dir: &Path, event: &str, details: Value) -> Result<(), String> {
    fs::create_dir_all(state_dir).map_err(|error| error.to_string())?;
    let path = log_path(state_dir);
    rotate_if_needed(state_dir, &path)?;
    let record = json!({
        "timestamp": Utc::now().to_rfc3339_opts(SecondsFormat::Millis, true),
        "version": env!("CARGO_PKG_VERSION"),
        "pid": std::process::id(),
        "event": event,
        "details": details,
    });
    let mut bytes = serde_json::to_vec(&record).map_err(|error| error.to_string())?;
    bytes.push(b'\n');
    let mut options = fs::OpenOptions::new();
    options.create(true).append(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options
            .mode(0o600)
            .custom_flags(libc::O_CLOEXEC | libc::O_NOFOLLOW);
    }
    let mut file = options.open(path).map_err(|error| error.to_string())?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        file.set_permissions(fs::Permissions::from_mode(0o600))
            .map_err(|error| error.to_string())?;
    }
    file.write_all(&bytes).map_err(|error| error.to_string())
}

fn rotate_if_needed(state_dir: &Path, path: &Path) -> Result<(), String> {
    let Ok(metadata) = fs::symlink_metadata(path) else {
        return Ok(());
    };
    if !metadata.file_type().is_file() {
        return Err(format!(
            "Diagnostic log path is not a regular file: {}",
            path.display()
        ));
    }
    if metadata.len() < MAX_LOG_BYTES {
        return Ok(());
    }
    let previous = state_dir.join(PREVIOUS_LOG_FILE);
    match fs::remove_file(&previous) {
        Ok(()) => {}
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
        Err(error) => return Err(error.to_string()),
    }
    fs::rename(path, previous).map_err(|error| error.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn diagnostics_are_jsonl_and_redact_local_roots() {
        let temp = tempfile::tempdir().unwrap();
        let state_dir = temp.path().join("state");
        let message = format!(
            "failed at {} and {} with digest {}",
            state_dir.join("macos-apply-transaction").display(),
            env::temp_dir().join("private-stage").display(),
            "a".repeat(64)
        );

        record(
            &state_dir,
            "languageTransactionFinished",
            json!({ "error": sanitize_message(&message, &state_dir) }),
        );

        let line = fs::read_to_string(log_path(&state_dir)).unwrap();
        let value: Value = serde_json::from_str(line.trim()).unwrap();
        assert_eq!(value["event"], "languageTransactionFinished");
        assert_eq!(value["version"], env!("CARGO_PKG_VERSION"));
        assert!(value["details"]["error"]
            .as_str()
            .unwrap()
            .contains("<stateDir>"));
        assert!(value["details"]["error"]
            .as_str()
            .unwrap()
            .contains("<temp>"));
        assert!(value["details"]["error"]
            .as_str()
            .unwrap()
            .contains("<hash>"));
        assert!(!line.contains(&state_dir.to_string_lossy().to_string()));
        assert!(!line.contains(&"a".repeat(64)));
    }

    #[cfg(unix)]
    #[test]
    fn diagnostics_refuse_a_symlink_log_leaf() {
        use std::os::unix::fs::symlink;

        let temp = tempfile::tempdir().unwrap();
        let state_dir = temp.path().join("state");
        let outside = temp.path().join("outside.txt");
        fs::create_dir_all(&state_dir).unwrap();
        fs::write(&outside, "untouched").unwrap();
        symlink(&outside, log_path(&state_dir)).unwrap();

        record(&state_dir, "mustNotEscape", json!({}));

        assert_eq!(fs::read_to_string(outside).unwrap(), "untouched");
    }
}
