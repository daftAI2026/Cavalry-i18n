/**
 * [INPUT]: 依赖 source_provenance 的私有验证 seam、tempfile 与 Windows junction/reparse 语义。
 * [OUTPUT]: 覆盖自洽恶意 DLL、篡改 overlay、精确 marker、正确重建以及缺失/重解析 package root 的 fail-closed 合同。
 * [POS]: language_transaction source provenance 的对抗测试；证明 worker 信任编译期发布事实而非 plan/staging 自报摘要。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
use std::{collections::BTreeMap, fs, path::PathBuf, process::Command};

use tempfile::TempDir;

use super::*;

#[derive(Default)]
struct TestCatalog {
    language: BTreeMap<String, String>,
    generic: Option<String>,
    qpa: Option<String>,
}

impl SourceDigestCatalog for TestCatalog {
    fn language_digest(&self, relative_path: &str) -> Option<&str> {
        self.language.get(relative_path).map(String::as_str)
    }

    fn generic_digest(&self) -> Option<&str> {
        self.generic.as_deref()
    }

    fn qpa_digest(&self) -> Option<&str> {
        self.qpa.as_deref()
    }
}

#[test]
fn arbitrary_self_consistent_x64_dll_is_rejected() {
    let fixture = TempDir::new().unwrap();
    let package = x64_pe(0x11);
    let attacker = x64_pe(0x22);
    let source = fixture.path().join("0.bin");
    fs::write(&source, &attacker).unwrap();
    let record = payload_record(PayloadKind::GenericPlugin, "@generic-plugin", &attacker);

    let result = verify_runtime_payload(
        &record,
        &source,
        fixture.path(),
        &package,
        &sha256_bytes(&package),
        "test generic plugin",
    );

    assert!(result.is_err());
}

#[test]
fn tampered_translated_string_is_rejected_even_with_matching_plan_hash() {
    let fixture = JsonFixture::new();
    let tampered = serde_json::to_vec_pretty(&serde_json::json!({
        "label": "伪造",
        "keep": 7
    }))
    .unwrap();
    fs::write(&fixture.staged, &tampered).unwrap();
    let record = payload_record(
        PayloadKind::CoreAsset,
        "Definitions/appStrings.json",
        &tampered,
    );

    let result = fixture.verify(&record);

    assert!(result.is_err());
}

#[test]
fn exact_overlay_rebuilt_from_current_and_anchored_translation_is_accepted() {
    let fixture = JsonFixture::new();
    let installed = serde_json::json!({"label": "Old", "keep": 7});
    let translation = serde_json::json!({"label": "正确"});
    let merged = merge_translation_overlay(&installed, &translation);
    let staged = serde_json::to_vec_pretty(&merged).unwrap();
    fs::write(&fixture.staged, &staged).unwrap();
    let record = payload_record(
        PayloadKind::CoreAsset,
        "Definitions/appStrings.json",
        &staged,
    );

    fixture.verify(&record).unwrap();
}

#[test]
fn self_consistent_but_wrong_marker_bytes_are_rejected() {
    let fixture = TempDir::new().unwrap();
    let source = fixture.path().join("0.bin");
    let wrong = b"zh-Hans.\n";
    fs::write(&source, wrong).unwrap();
    let record = payload_record(PayloadKind::FinalMarker, "@final-marker", wrong);

    let result = verify_marker_payload(
        &record,
        &source,
        fixture.path(),
        Language::SimplifiedChinese,
    );

    assert!(result.is_err());
}

#[test]
fn missing_package_root_is_rejected_within_bounded_search() {
    let fixture = TempDir::new().unwrap();
    let worker = fixture.path().join("bin").join("switcher.exe");
    fs::create_dir_all(worker.parent().unwrap()).unwrap();

    assert!(derive_package_root(&worker, Language::SimplifiedChinese).is_err());
}

#[test]
fn reparse_package_language_root_is_rejected() {
    let fixture = TempDir::new().unwrap();
    let package = fixture.path().join("package");
    let actual_language = fixture.path().join("actual-language");
    fs::create_dir_all(package.join("languages")).unwrap();
    fs::create_dir_all(&actual_language).unwrap();
    let language_link = package.join("languages").join("zh-Hans");
    let output = Command::new("cmd.exe")
        .args(["/d", "/c", "mklink", "/J"])
        .arg(&language_link)
        .arg(&actual_language)
        .output()
        .unwrap();
    assert!(
        output.status.success(),
        "junction creation failed: {}",
        String::from_utf8_lossy(&output.stderr)
    );
    let worker = package.join("switcher.exe");

    assert!(derive_package_root(&worker, Language::SimplifiedChinese).is_err());
}

#[test]
fn compiled_catalog_contains_release_language_and_runtime_anchors() {
    let catalog = EmbeddedCatalog;

    for language in ["en", "zh-Hans", "zh-Hant", "ja_JP"] {
        assert!(
            catalog
                .language_digest(&format!("languages/{language}/appStrings.json"))
                .is_some(),
            "missing compiled digest for {language}"
        );
    }
    assert!(catalog.generic_digest().is_some());
    assert!(catalog.qpa_digest().is_some());
}

fn payload_record(kind: PayloadKind, id: &str, bytes: &[u8]) -> PayloadRecord {
    PayloadRecord {
        id: id.to_string(),
        kind,
        source_sha256: sha256_bytes(bytes),
        expected_destination_sha256: None,
    }
}

fn x64_pe(marker: u8) -> Vec<u8> {
    let mut bytes = vec![0_u8; 0x80];
    bytes[0..2].copy_from_slice(b"MZ");
    bytes[0x3c..0x40].copy_from_slice(&(0x40_u32).to_le_bytes());
    bytes[0x40..0x44].copy_from_slice(b"PE\0\0");
    bytes[0x44..0x46].copy_from_slice(&IMAGE_FILE_MACHINE_AMD64.to_le_bytes());
    bytes[0x58..0x5a].copy_from_slice(&PE32_PLUS_MAGIC.to_le_bytes());
    bytes[0x70] = marker;
    bytes
}

struct JsonFixture {
    _temp: TempDir,
    layout: InstallLayout,
    package_root: PathBuf,
    staging_root: PathBuf,
    staged: PathBuf,
    catalog: TestCatalog,
}

impl JsonFixture {
    fn new() -> Self {
        let temp = TempDir::new().unwrap();
        let install_root = temp.path().join("Cavalry");
        let package_root = temp.path().join("package");
        let staging_root = temp.path().join("staging");
        let destination = install_root
            .join("assets")
            .join("Definitions")
            .join("appStrings.json");
        let translation_path = package_root
            .join("languages")
            .join("zh-Hans")
            .join("appStrings.json");
        let english_path = package_root
            .join("languages")
            .join("en")
            .join("appStrings.json");
        fs::create_dir_all(destination.parent().unwrap()).unwrap();
        fs::create_dir_all(translation_path.parent().unwrap()).unwrap();
        fs::create_dir_all(english_path.parent().unwrap()).unwrap();
        fs::create_dir_all(&staging_root).unwrap();
        let installed = serde_json::to_vec_pretty(&serde_json::json!({
            "label": "Old",
            "keep": 7
        }))
        .unwrap();
        let translation = serde_json::to_vec_pretty(&serde_json::json!({"label": "正确"})).unwrap();
        let english = serde_json::to_vec_pretty(&serde_json::json!({"label": "Old"})).unwrap();
        fs::write(&destination, installed).unwrap();
        fs::write(&translation_path, &translation).unwrap();
        fs::write(&english_path, &english).unwrap();
        let staged = staging_root.join("0.bin");
        let mut catalog = TestCatalog::default();
        catalog.language.insert(
            "languages/zh-Hans/appStrings.json".to_string(),
            sha256_bytes(&translation),
        );
        catalog.language.insert(
            "languages/en/appStrings.json".to_string(),
            sha256_bytes(&english),
        );
        Self {
            _temp: temp,
            layout: InstallLayout::from_root(&install_root),
            package_root,
            staging_root,
            staged,
            catalog,
        }
    }

    fn verify(&self, record: &PayloadRecord) -> Result<(), String> {
        verify_json_payload(
            record,
            &self.staged,
            &self.staging_root,
            Language::SimplifiedChinese,
            &self.layout,
            &self.package_root,
            &self.catalog,
        )
    }
}
