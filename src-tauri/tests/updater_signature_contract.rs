/**
 * [INPUT]: 依赖 tauri.conf.json 内嵌 updater 公钥，以及显式环境变量指向的 Tauri updater 产物与外层 Base64 `.sig`
 * [OUTPUT]: 提供默认公钥可解析合同与 ignored 的真实产物流式 minisign 验签门，证明构建私钥和客户端信任锚属于同一密钥对
 * [POS]: src-tauri/tests 的发布密码学守门；只读候选文件、不接触私钥，供无 tag signing smoke 与发布工作流复用
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
use base64::{engine::general_purpose::STANDARD, Engine as _};
use minisign_verify::{PublicKey, Signature};
use serde_json::Value;
use std::{
    env,
    fs::{self, File},
    io::Read,
    path::{Path, PathBuf},
};

const ARTIFACT_ENV: &str = "CAVALRY_I18N_UPDATER_ARTIFACT";
const SIGNATURE_ENV: &str = "CAVALRY_I18N_UPDATER_SIGNATURE";
const MAX_SIGNATURE_BYTES: u64 = 64 * 1024;

fn embedded_public_key() -> Result<PublicKey, String> {
    let manifest_dir = Path::new(env!("CARGO_MANIFEST_DIR"));
    let config: Value = serde_json::from_str(
        &fs::read_to_string(manifest_dir.join("tauri.conf.json"))
            .map_err(|error| format!("read tauri.conf.json: {error}"))?,
    )
    .map_err(|error| format!("parse tauri.conf.json: {error}"))?;
    let encoded = config["plugins"]["updater"]["pubkey"]
        .as_str()
        .ok_or_else(|| "plugins.updater.pubkey must be a string".to_string())?;
    let decoded = STANDARD
        .decode(encoded.trim())
        .map_err(|error| format!("decode updater public key outer Base64: {error}"))?;
    let text = String::from_utf8(decoded)
        .map_err(|error| format!("updater public key must decode as UTF-8: {error}"))?;
    PublicKey::decode(&text).map_err(|error| format!("decode minisign public key: {error}"))
}

fn required_regular_file(variable: &str) -> Result<PathBuf, String> {
    let path = PathBuf::from(
        env::var_os(variable).ok_or_else(|| format!("{variable} must name a candidate file"))?,
    );
    let metadata = fs::symlink_metadata(&path)
        .map_err(|error| format!("inspect {}: {error}", path.display()))?;
    if metadata.file_type().is_symlink() || !metadata.is_file() {
        return Err(format!(
            "{} must be a regular non-symlink file",
            path.display()
        ));
    }
    Ok(path)
}

fn read_signature(path: &Path) -> Result<Signature, String> {
    let metadata = fs::metadata(path)
        .map_err(|error| format!("inspect updater signature {}: {error}", path.display()))?;
    if metadata.len() == 0 || metadata.len() > MAX_SIGNATURE_BYTES {
        return Err(format!(
            "updater signature {} must contain 1..={MAX_SIGNATURE_BYTES} bytes",
            path.display()
        ));
    }
    let encoded = fs::read_to_string(path)
        .map_err(|error| format!("read updater signature {}: {error}", path.display()))?;
    let decoded = STANDARD
        .decode(encoded.trim())
        .map_err(|error| format!("decode updater signature outer Base64: {error}"))?;
    let text = String::from_utf8(decoded)
        .map_err(|error| format!("updater signature must decode as UTF-8: {error}"))?;
    Signature::decode(&text).map_err(|error| format!("decode minisign signature: {error}"))
}

fn stream_verify(
    path: &Path,
    public_key: &PublicKey,
    signature: &Signature,
) -> Result<u64, String> {
    let mut file = File::open(path)
        .map_err(|error| format!("open updater artifact {}: {error}", path.display()))?;
    let mut verifier = public_key
        .verify_stream(signature)
        .map_err(|error| format!("initialize updater signature verifier: {error}"))?;
    let mut buffer = [0_u8; 1024 * 1024];
    let mut verified_bytes = 0_u64;
    loop {
        let read = file
            .read(&mut buffer)
            .map_err(|error| format!("read updater artifact {}: {error}", path.display()))?;
        if read == 0 {
            break;
        }
        verifier.update(&buffer[..read]);
        verified_bytes += read as u64;
    }
    if verified_bytes == 0 {
        return Err("updater artifact must not be empty".to_string());
    }
    verifier
        .finalize()
        .map_err(|error| format!("verify updater artifact signature: {error}"))?;
    Ok(verified_bytes)
}

#[test]
fn embedded_updater_public_key_is_valid_minisign_material() {
    embedded_public_key().expect("embedded updater public key must remain decodable");
}

#[test]
#[ignore = "requires a signed Tauri updater artifact produced by an explicit release smoke"]
fn verifies_external_updater_signature() {
    let artifact = required_regular_file(ARTIFACT_ENV).expect("candidate artifact contract failed");
    let signature_path =
        required_regular_file(SIGNATURE_ENV).expect("candidate signature contract failed");
    let public_key = embedded_public_key().expect("embedded updater public key contract failed");
    let signature = read_signature(&signature_path).expect("candidate signature decode failed");
    let bytes = stream_verify(&artifact, &public_key, &signature)
        .expect("candidate updater artifact signature verification failed");
    println!(
        "verified updater artifact {} ({} bytes) with embedded public key via {}",
        artifact.display(),
        bytes,
        signature_path.display()
    );
}
