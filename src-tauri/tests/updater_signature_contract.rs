/**
 * [INPUT]: 依赖 tauri.conf.json 内嵌 updater 公钥，以及显式环境变量指向的 Tauri updater 产物与外层 Base64 `.sig`
 * [OUTPUT]: 提供默认公钥、规范Ed25519签名和真实插件下载/版本绑定合同，以及ignored的真实产物流式验签门；拒绝篡改、版本调包和旧无版本签名
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
    if !path.is_absolute() {
        return Err(format!("{variable} must use an absolute candidate path"));
    }
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

// Official public `test` vectors from minisign-verify and tauri-plugin-updater;
// these are throwaway fixture keys, unrelated to the release trust anchor.
const FIXTURE_KEY: &str = "untrusted comment: minisign public key: A49EF4746FA6E6D7\nRWTX5qZvdPSepDGWg2bz8n6ArQnBMwgQK1geVosorcbLzcunD+KJ+cYe";
const VERSIONED_SIGNATURE: &str = "untrusted comment: signature from tauri secret key\nRUTX5qZvdPSepPF2zsjvP/L/TQtBLRnWRvaq+4omK1UEugtQp/USrGiI1v762sDy3id3aor7bRC9ETyeot6lMHHrWoZ5hjUM1Qc=\ntrusted comment: timestamp:1791649051\tfile:payload\tversion:2.0.0\nDDq2CLOEl5cQmC2eJRHlnZPVViOZsu1CjpPKQoei4A/XBfkDqGO0B+QMrcrHgEQ5qV3mne75tdFWhJpqUXh9AA==";
const LEGACY_KEY: &str = "untrusted comment: minisign public key E7620F1842B4E81F\nRWQf6LRCGA9i53mlYecO4IzT51TGPpvWucNSCh1CBM0QTaLn73Y7GFO3";
const LEGACY_SIGNATURE: &str = "untrusted comment: signature from minisign secret key\nRUQf6LRCGA9i559r3g7V1qNyJDApGip8MfqcadIgT9CuhV3EMhHoN1mGTkUidF/z7SrlQgXdy8ofjb7bNJJylDOocrCo8KLzZwo=\ntrusted comment: timestamp:1633700835\tfile:test\tprehashed\nwLMDjy9FLAuxZ3q4NlEvkgtyhrr0gtTu6KC4KBJdITbbOeAi1zBIYo0v4iTgt8jJpIidRJnp94ABQkJAgAooBQ==";

#[test]
fn signature_rejects_noncanonical_s_while_valid_and_tampered_cases_are_distinguished() {
    let key = PublicKey::decode(LEGACY_KEY).unwrap();
    let signature = Signature::decode(LEGACY_SIGNATURE).unwrap();
    key.verify(b"test", &signature, false).unwrap();
    assert!(key.verify(b"tampered", &signature, false).is_err());
    let mut lines: Vec<String> = LEGACY_SIGNATURE.lines().map(str::to_owned).collect();
    let mut global_signature = STANDARD.decode(&lines[3]).unwrap();
    // Add the Ed25519 group order to S. It describes the same group element,
    // but its non-canonical encoding must be rejected by both verification paths.
    let order = [
        0xed_u8, 0xd3, 0xf5, 0x5c, 0x1a, 0x63, 0x12, 0x58, 0xd6, 0x9c, 0xf7, 0xa2, 0xde, 0xf9,
        0xde, 0x14, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0x10,
    ];
    let mut carry = 0_u16;
    for (byte, add) in global_signature[32..].iter_mut().zip(order) {
        let sum = u16::from(*byte) + u16::from(add) + carry;
        *byte = sum as u8;
        carry = sum >> 8;
    }
    assert_eq!(carry, 0);
    lines[3] = STANDARD.encode(global_signature);
    let noncanonical = Signature::decode(&lines.join("\n")).unwrap();
    assert!(key.verify(b"test", &noncanonical, false).is_err());
    match key.verify_stream(&noncanonical) {
        Err(_) => {}
        Ok(mut verifier) => {
            verifier.update(b"test");
            assert!(verifier.finalize().is_err());
        }
    }
}

#[test]
fn official_updater_download_preserves_progress_and_rejects_version_substitution() {
    use std::{
        io::{Read, Write},
        net::TcpListener,
        thread,
        time::Duration,
    };
    use tauri_plugin_updater::UpdaterExt;
    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    let origin = format!("http://{}", listener.local_addr().unwrap());
    let response_origin = origin.clone();
    let server = thread::spawn(move || {
        for _ in 0..6 {
            let (mut stream, _) = listener.accept().unwrap();
            stream
                .set_read_timeout(Some(Duration::from_secs(5)))
                .unwrap();
            let mut request = Vec::new();
            loop {
                let mut byte = [0];
                stream.read_exact(&mut byte).unwrap();
                request.push(byte[0]);
                if request.ends_with(b"\r\n\r\n") {
                    break;
                }
            }
            let path = std::str::from_utf8(&request)
                .unwrap()
                .split_whitespace()
                .nth(1)
                .unwrap();
            let body = if path.starts_with("/manifest-") {
                let version = if path == "/manifest-swapped" {
                    "3.0.0"
                } else {
                    "2.0.0"
                };
                let signature = if path == "/manifest-legacy" {
                    LEGACY_SIGNATURE
                } else {
                    VERSIONED_SIGNATURE
                };
                serde_json::to_vec(&serde_json::json!({"version":version,"notes":"Fixture update",
                    "platforms":{"test-target":{"url":format!("{response_origin}/package"),"signature":STANDARD.encode(signature)}}})).unwrap()
            } else {
                assert_eq!(path, "/package");
                b"test".to_vec()
            };
            write!(
                stream,
                "HTTP/1.1 200 OK\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
                body.len()
            )
            .unwrap();
            stream.write_all(&body).unwrap();
        }
    });
    for (scenario, key) in [
        ("valid", FIXTURE_KEY),
        ("swapped", FIXTURE_KEY),
        ("legacy", LEGACY_KEY),
    ] {
        let mut context = tauri::test::mock_context(tauri::test::noop_assets());
        // Only this loopback fixture permits HTTP; production remains HTTPS-only.
        context.config_mut().plugins.0.insert("updater".into(), serde_json::json!({
            "pubkey":STANDARD.encode(key),"requireSignedVersion":true,"dangerousInsecureTransportProtocol":true}));
        let app = tauri::test::mock_builder()
            .plugin(tauri_plugin_updater::Builder::new().build())
            .build(context)
            .unwrap();
        let updater = app
            .updater_builder()
            .target("test-target")
            .timeout(Duration::from_secs(5))
            .no_proxy()
            .endpoints(vec![format!("{origin}/manifest-{scenario}")
                .parse()
                .unwrap()])
            .unwrap()
            .build()
            .unwrap();
        tauri::async_runtime::block_on(async {
            let update = updater
                .check()
                .await
                .unwrap()
                .expect("newer fixture release");
            assert_eq!(update.body.as_deref(), Some("Fixture update"));
            let mut downloaded = 0;
            let mut finished = false;
            let result = update
                .download(
                    |bytes, total| {
                        downloaded += bytes;
                        assert_eq!(total, Some(4));
                    },
                    || finished = true,
                )
                .await;
            assert_eq!(downloaded, 4);
            assert!(finished);
            if scenario == "valid" {
                assert_eq!(result.unwrap(), b"test");
                assert!(update.verify(b"tampered").is_err());
            } else {
                assert!(result.is_err(), "must reject {scenario} signature");
            }
        });
    }
    server.join().unwrap();
}

#[cfg(target_os = "macos")]
#[test]
#[ignore = "requires two explicitly signed disposable fixture archives; never targets a real App"]
fn macos_updater_installs_into_owned_copy_and_preserves_it_on_bad_archive() {
    use tauri_plugin_updater::UpdaterExt;
    let public_key =
        fs::read_to_string(required_regular_file("CAVALRY_I18N_UPDATER_SMOKE_PUBLIC_KEY").unwrap())
            .unwrap();
    let owner = tempfile::tempdir().unwrap();
    let app_root = owner.path().join("Updater Fixture.app");
    let executable = app_root.join("Contents/MacOS/fixture-switcher");
    fs::create_dir_all(executable.parent().unwrap()).unwrap();
    fs::write(&executable, b"original-switcher-fixture").unwrap();
    let mut context = tauri::test::mock_context(tauri::test::noop_assets());
    context.config_mut().plugins.0.insert(
        "updater".into(),
        serde_json::json!({"requireSignedVersion":true,"pubkey":public_key}),
    );
    let app = tauri::test::mock_builder()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .build(context)
        .unwrap();
    let updater = app
        .updater_builder()
        .executable_path(&executable)
        .no_proxy()
        .endpoints(vec!["https://example.invalid/fixture".parse().unwrap()])
        .unwrap()
        .build()
        .unwrap();
    for (prefix, succeeds) in [
        ("CAVALRY_I18N_UPDATER_SMOKE_BAD", false),
        ("CAVALRY_I18N_UPDATER_SMOKE_GOOD", true),
    ] {
        let artifact = required_regular_file(&format!("{prefix}_ARTIFACT")).unwrap();
        let signature =
            fs::read_to_string(required_regular_file(&format!("{prefix}_SIGNATURE")).unwrap())
                .unwrap();
        let update = updater
            .restore_update(serde_json::json!({"version":"2.0.0",
            "url":"https://example.invalid/fixture", "signature":signature.trim()}))
            .unwrap()
            .unwrap();
        let result = update.install(fs::read(artifact).unwrap());
        if succeeds {
            result.unwrap();
            assert_eq!(fs::read(&executable).unwrap(), b"updated-switcher-fixture");
        } else {
            assert!(result.is_err());
            assert_eq!(fs::read(&executable).unwrap(), b"original-switcher-fixture");
        }
    }
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
    assert!(
        signature
            .trusted_comment()
            .split('\t')
            .any(|part| part == format!("version:{}", env!("CARGO_PKG_VERSION"))),
        "updater artifact signature must bind the exact published app version"
    );
    println!(
        "verified updater artifact {} ({} bytes) with embedded public key via {}",
        artifact.display(),
        bytes,
        signature_path.display()
    );
}
