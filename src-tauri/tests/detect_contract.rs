#[cfg(target_os = "macos")]
use cavalry_i18n_tauri::detect::default_app_candidates;
#[cfg(target_os = "macos")]
use cavalry_i18n_tauri::detect::{
    read_mac_bundle_identity, require_signature_verification, require_supported_mac_identity,
    verify_mac_bundle_identity, MacIdentityError, MacSignatureVerification,
    SUPPORTED_CAVALRY_BUNDLE_ID,
};
/**
 * [INPUT]: 依赖 cavalry_i18n_tauri::detect/install 的候选顺序、安装根规范化、展示版本、revision 与 marker 读取能力
 * [OUTPUT]: 对外提供保存路径优先、macOS 默认候选与 Windows 非 MSI 内容身份 contract tests
 * [POS]: src-tauri/tests 的探测守门，确保展示版本不伪造且快照身份随不可变二进制变化
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
use cavalry_i18n_tauri::{
    detect::{
        find_cavalry_app_from_candidates, read_bundle_revision, read_bundle_version,
        read_installed_language,
    },
    install::normalize_path,
};
#[cfg(target_os = "macos")]
use std::env;
use std::{fs, path::Path};

fn write(path: &Path, value: &str) {
    fs::create_dir_all(path.parent().unwrap()).unwrap();
    fs::write(path, value).unwrap();
}

#[cfg(target_os = "macos")]
fn write_bytes(path: &Path, value: &[u8]) {
    fs::create_dir_all(path.parent().unwrap()).unwrap();
    fs::write(path, value).unwrap();
}

#[test]
fn find_cavalry_app_prefers_saved_path() {
    let temp = tempfile::tempdir().unwrap();
    let app_path = temp.path().join("Saved/Cavalry.app");
    write(
        &app_path.join("Contents/Info.plist"),
        "<plist><dict><key>CFBundleShortVersionString</key><string>1.0.0</string></dict></plist>",
    );
    write(&app_path.join("Contents/MacOS/Cavalry"), "binary");
    write(
        &app_path.join("Contents/assets/Definitions/appStrings.json"),
        "{}",
    );
    write(
        &app_path.join("Contents/assets/Definitions/nodeStrings.json"),
        "{}",
    );
    assert_eq!(
        find_cavalry_app_from_candidates(&app_path.to_string_lossy(), Vec::new()),
        normalize_path(&app_path)
    );
}

#[test]
fn read_bundle_version_from_info_plist() {
    let temp = tempfile::tempdir().unwrap();
    let app_path = temp.path().join("Cavalry.app");
    write(
        &app_path.join("Contents/Info.plist"),
        "<plist><dict><key>CFBundleShortVersionString</key><string>2.3.4</string></dict></plist>",
    );
    assert_eq!(read_bundle_version(&app_path).unwrap(), "2.3.4");
    assert_eq!(
        read_bundle_revision(&app_path).unwrap(),
        "bundle-version:2.3.4"
    );
}

#[test]
#[cfg(target_os = "macos")]
fn default_candidates_include_system_and_user_applications() {
    let home = env::var("HOME").unwrap();
    let candidates = default_app_candidates();
    assert_eq!(candidates[0], Path::new("/Applications/Cavalry.app"));
    assert_eq!(
        candidates[1],
        Path::new(&home).join("Applications").join("Cavalry.app")
    );
}

#[test]
fn arbitrary_windows_install_root_is_selected_without_a_fixed_drive() {
    let temp = tempfile::tempdir().unwrap();
    let root = temp.path().join("Any Drive").join("Cavalry");
    write(&root.join("Cavalry.exe"), "binary");
    write(&root.join("assets/Definitions/appStrings.json"), "{}");
    write(&root.join("assets/Definitions/nodeStrings.json"), "{}");

    assert_eq!(
        find_cavalry_app_from_candidates("", [root.clone()]),
        normalize_path(&root)
    );
}

#[test]
fn non_msi_windows_revision_tracks_immutable_binary_changes_without_faking_version() {
    let temp = tempfile::tempdir().unwrap();
    let root = temp.path().join("Portable Cavalry");
    write(&root.join("Cavalry.exe"), "binary-v1");
    write(&root.join("CavalryFramework.dll"), "framework-v1");
    write(&root.join("CavalryUI.dll"), "ui-v1");
    write(&root.join("assets/Definitions/appStrings.json"), "{}");
    write(&root.join("assets/Definitions/nodeStrings.json"), "{}");

    assert_eq!(read_bundle_version(&root).unwrap(), "");
    let first = read_bundle_revision(&root).unwrap();
    assert!(first.contains("Cavalry.exe=sha256:"));
    assert!(first.contains("CavalryFramework.dll=sha256:"));
    assert!(first.contains("CavalryUI.dll=sha256:"));

    write(&root.join("Cavalry.exe"), "binary-v2");
    let second = read_bundle_revision(&root).unwrap();
    assert_ne!(first, second);

    write(&root.join("CavalryFramework.dll"), "framework-v2");
    let third = read_bundle_revision(&root).unwrap();
    assert_ne!(second, third);

    write(&root.join("CavalryUI.dll"), "ui-v2");
    assert_ne!(third, read_bundle_revision(&root).unwrap());
}

#[test]
fn read_installed_language_defaults_english_when_marker_is_empty() {
    let temp = tempfile::tempdir().unwrap();
    let app_path = temp.path().join("Cavalry.app");
    write(
        &app_path.join("Contents/Resources/cavalry-i18n-lang.txt"),
        "",
    );
    assert_eq!(read_installed_language(&app_path, "zh-Hans"), "en");
}

#[cfg(target_os = "macos")]
fn macho_arm64() -> Vec<u8> {
    let mut bytes = vec![0_u8; 32];
    bytes[0..4].copy_from_slice(&0xfeedfacf_u32.to_le_bytes());
    bytes[4..8].copy_from_slice(&0x0100_000c_u32.to_le_bytes());
    bytes
}

#[cfg(target_os = "macos")]
fn signed_macho_arm64(code_marker: u8, signature: &[u8]) -> Vec<u8> {
    let mut bytes = vec![0_u8; 64];
    bytes[0..4].copy_from_slice(&0xfeedfacf_u32.to_le_bytes());
    bytes[4..8].copy_from_slice(&0x0100_000c_u32.to_le_bytes());
    bytes[16..20].copy_from_slice(&1_u32.to_le_bytes());
    bytes[20..24].copy_from_slice(&16_u32.to_le_bytes());
    bytes[32..36].copy_from_slice(&0x1d_u32.to_le_bytes());
    bytes[36..40].copy_from_slice(&16_u32.to_le_bytes());
    bytes[40..44].copy_from_slice(&64_u32.to_le_bytes());
    bytes[44..48].copy_from_slice(&(signature.len() as u32).to_le_bytes());
    bytes[60] = code_marker;
    bytes.extend_from_slice(signature);
    bytes
}

#[cfg(target_os = "macos")]
fn write_complete_macos_bundle(root: &Path, bundle_id: &str) {
    write(
        &root.join("Contents/Info.plist"),
        &format!(
            "<plist><dict>\
             <key>CFBundleIdentifier</key><string>{bundle_id}</string>\
             <key>CFBundleShortVersionString</key><string>2.7.2</string>\
             <key>CFBundleVersion</key><string>2.7.2</string>\
             <key>CFBundleExecutable</key><string>Cavalry</string>\
             </dict></plist>"
        ),
    );
    write(
        &root.join("Contents/assets/Definitions/appStrings.json"),
        "{}",
    );
    write(
        &root.join("Contents/assets/Definitions/nodeStrings.json"),
        "{}",
    );
    fs::create_dir_all(root.join("Contents/MacOS")).unwrap();
    fs::write(root.join("Contents/MacOS/Cavalry"), macho_arm64()).unwrap();
    fs::create_dir_all(root.join("Contents/Frameworks")).unwrap();
    fs::write(
        root.join("Contents/Frameworks/libExtensionLayer.dylib"),
        macho_arm64(),
    )
    .unwrap();
}

#[cfg(target_os = "macos")]
#[test]
fn typed_info_plist_reader_accepts_binary_plist() {
    let temp = tempfile::tempdir().unwrap();
    let app = temp.path().join("Cavalry.app");
    let mut dictionary = plist::Dictionary::new();
    dictionary.insert(
        "CFBundleShortVersionString".to_string(),
        plist::Value::String("2.7.2".to_string()),
    );
    let mut bytes = Vec::new();
    plist::to_writer_binary(&mut bytes, &plist::Value::Dictionary(dictionary)).unwrap();
    write_bytes(&app.join("Contents/Info.plist"), &bytes);

    assert_eq!(read_bundle_version(&app).unwrap(), "2.7.2");
}

#[cfg(target_os = "macos")]
#[test]
fn macos_identity_requires_2_7_2_and_hashes_immutable_official_inputs() {
    let temp = tempfile::tempdir().unwrap();
    let app = temp.path().join("Cavalry.app");
    write_complete_macos_bundle(&app, SUPPORTED_CAVALRY_BUNDLE_ID);

    let identity = read_mac_bundle_identity(&app).unwrap();
    assert_eq!(identity.bundle_id, SUPPORTED_CAVALRY_BUNDLE_ID);
    assert_eq!(identity.short_version, "2.7.2");
    assert_eq!(identity.build_version, "2.7.2");
    assert_eq!(identity.architectures, vec!["arm64"]);
    assert!(!identity.main_executable_sha256.is_empty());
    assert!(!identity.main_executable_code_sha256.is_empty());
    assert!(!identity.extension_layer_sha256.is_empty());
    assert!(!identity.official_baseline_fingerprint.is_empty());
    assert!(matches!(
        identity.signature.verification,
        MacSignatureVerification::Unavailable { .. }
    ));
    assert!(require_supported_mac_identity(&app).is_ok());
    assert!(matches!(
        require_signature_verification(&identity),
        Err(MacIdentityError::SignatureUnavailable(_))
    ));
    assert!(read_bundle_revision(&app)
        .unwrap()
        .starts_with("macos-identity:"));

    let initial_revision = read_bundle_revision(&app).unwrap();
    let mut patched_extension = macho_arm64();
    patched_extension[31] ^= 0x44;
    fs::write(
        app.join("Contents/Frameworks/libExtensionLayer.dylib"),
        patched_extension,
    )
    .unwrap();
    let after_extension_patch = read_mac_bundle_identity(&app).unwrap();
    assert_ne!(
        identity.extension_layer_sha256,
        after_extension_patch.extension_layer_sha256
    );
    assert_eq!(
        identity.official_baseline_fingerprint, after_extension_patch.official_baseline_fingerprint,
        "controlled ExtensionLayer patch must not alter the immutable revision fingerprint"
    );
    assert_eq!(initial_revision, read_bundle_revision(&app).unwrap());
    assert!(verify_mac_bundle_identity(&app, &identity).is_err());

    let mut changed = macho_arm64();
    changed[31] ^= 0x55;
    fs::write(app.join("Contents/MacOS/Cavalry"), changed).unwrap();
    assert_ne!(initial_revision, read_bundle_revision(&app).unwrap());
    let error = verify_mac_bundle_identity(&app, &identity).unwrap_err();
    assert!(matches!(
        error,
        MacIdentityError::Mismatch { field, .. } if field == "mainExecutableSha256"
    ));
}

#[cfg(target_os = "macos")]
#[test]
fn macos_revision_ignores_only_the_controlled_code_signature_blob() {
    let temp = tempfile::tempdir().unwrap();
    let app = temp.path().join("Cavalry.app");
    write_complete_macos_bundle(&app, SUPPORTED_CAVALRY_BUNDLE_ID);
    fs::write(
        app.join("Contents/MacOS/Cavalry"),
        signed_macho_arm64(0x41, b"vendor-signature"),
    )
    .unwrap();
    let vendor = read_mac_bundle_identity(&app).unwrap();
    let vendor_revision = read_bundle_revision(&app).unwrap();

    fs::write(
        app.join("Contents/MacOS/Cavalry"),
        signed_macho_arm64(0x41, b"different-sized-managed-ad-hoc-signature"),
    )
    .unwrap();
    let managed = read_mac_bundle_identity(&app).unwrap();
    assert_ne!(
        vendor.main_executable_sha256,
        managed.main_executable_sha256
    );
    assert_eq!(
        vendor.main_executable_code_sha256,
        managed.main_executable_code_sha256
    );
    assert_eq!(
        vendor.official_baseline_fingerprint,
        managed.official_baseline_fingerprint
    );
    assert_eq!(vendor_revision, read_bundle_revision(&app).unwrap());
    assert!(verify_mac_bundle_identity(&app, &vendor).is_err());

    fs::write(
        app.join("Contents/MacOS/Cavalry"),
        signed_macho_arm64(0x42, b"different-sized-managed-ad-hoc-signature"),
    )
    .unwrap();
    assert_ne!(vendor_revision, read_bundle_revision(&app).unwrap());
}

#[cfg(target_os = "macos")]
#[test]
fn macos_identity_rejects_wrong_bundle_id_before_strict_resolution() {
    let temp = tempfile::tempdir().unwrap();
    let app = temp.path().join("Cavalry.app");
    write_complete_macos_bundle(&app, "com.example.fake-cavalry");

    let error = require_supported_mac_identity(&app).unwrap_err();
    assert!(matches!(
        error,
        MacIdentityError::Mismatch { field, .. } if field == "bundleId"
    ));
}
