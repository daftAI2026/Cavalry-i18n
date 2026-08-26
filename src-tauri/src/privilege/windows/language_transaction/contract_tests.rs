/**
 * [INPUT]: 依赖 language_transaction/contract 与 windows_qpa 的纯数据类型。
 * [OUTPUT]: 验证 plan v1、payload 封闭性、QPA 绑定、UTF-16LE transport 与 fail-closed argv 分类。
 * [POS]: Windows 提权语言事务合同的纯单元测试面，不执行文件系统写入或 UAC。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
use std::{
    ffi::OsString,
    os::windows::ffi::OsStringExt,
    path::{Path, PathBuf},
};

use super::*;
use crate::windows_qpa::{
    QpaActivationPlan, QpaNoopPlan, QpaNoopReason, SUPPORTED_ARCHITECTURE,
    SUPPORTED_CAVALRY_VERSION, SUPPORTED_QT_VERSION, VENDOR_QWINDOWS_SHA256,
};

const PLAN_PATH: &str = r"C:\Users\Tester\AppData\Local\Cavalry-i18n\txn\plan.json";
const INSTALL_ROOT: &str = r"C:\Program Files\Cavalry";

fn hash(character: char) -> String {
    std::iter::repeat_n(character, HASH_HEX_LEN).collect()
}

fn payload(id: &str, kind: PayloadKind, source: char) -> PayloadRecord {
    PayloadRecord {
        id: id.to_string(),
        kind,
        source_sha256: hash(source),
        expected_destination_sha256: None,
    }
}

fn final_marker(source: char, pending_source: char) -> PayloadRecord {
    let mut record = payload(FINAL_MARKER_ID, PayloadKind::FinalMarker, source);
    record.expected_destination_sha256 = Some(hash(pending_source));
    record
}

fn translated_plan(language: Language) -> ElevatedLanguagePlan {
    let plan_path = Path::new(PLAN_PATH);
    let payloads = vec![
        payload(PENDING_MARKER_ID, PayloadKind::PendingMarker, '1'),
        payload("Resources/nodeStrings.json", PayloadKind::CoreAsset, '2'),
        payload(GENERIC_PLUGIN_ID, PayloadKind::GenericPlugin, '3'),
        payload(QPA_PROXY_SOURCE_ID, PayloadKind::QpaProxySource, '4'),
        final_marker('5', '1'),
    ];
    let proxy_source_path = payload_source_path(plan_path, 3)
        .unwrap()
        .to_string_lossy()
        .to_string();
    ElevatedLanguagePlan {
        schema_version: PLAN_SCHEMA_VERSION,
        install_root: INSTALL_ROOT.to_string(),
        language,
        nonce: hash('a'),
        expected_worker_exe_sha256: hash('b'),
        payloads,
        qpa_transition: QpaTransitionPlan::Activate(QpaActivationPlan {
            schema_version: 1,
            install_root: INSTALL_ROOT.to_string(),
            proxy_source_path,
            cavalry_version: SUPPORTED_CAVALRY_VERSION.to_string(),
            cavalry_executable_sha256: hash('c'),
            qt_version: SUPPORTED_QT_VERSION.to_string(),
            architecture: SUPPORTED_ARCHITECTURE.to_string(),
            expected_current_qwindows_sha256: Some(VENDOR_QWINDOWS_SHA256.to_string()),
            vendor_qwindows_sha256: VENDOR_QWINDOWS_SHA256.to_string(),
            proxy_qwindows_sha256: hash('4'),
            generic_plugin_sha256: hash('3'),
        }),
    }
}

fn english_plan() -> ElevatedLanguagePlan {
    ElevatedLanguagePlan {
        schema_version: PLAN_SCHEMA_VERSION,
        install_root: INSTALL_ROOT.to_string(),
        language: Language::English,
        nonce: hash('a'),
        expected_worker_exe_sha256: hash('b'),
        payloads: vec![
            payload(PENDING_MARKER_ID, PayloadKind::PendingMarker, '1'),
            payload("Resources/nodeStrings.json", PayloadKind::CoreAsset, '2'),
            final_marker('5', '1'),
        ],
        qpa_transition: QpaTransitionPlan::Noop(QpaNoopPlan {
            schema_version: 1,
            install_root: INSTALL_ROOT.to_string(),
            reason: QpaNoopReason::AlreadyStock,
            cavalry_version: SUPPORTED_CAVALRY_VERSION.to_string(),
            cavalry_executable_sha256: hash('c'),
            qt_version: SUPPORTED_QT_VERSION.to_string(),
            architecture: SUPPORTED_ARCHITECTURE.to_string(),
            expected_current_qwindows_sha256: Some(VENDOR_QWINDOWS_SHA256.to_string()),
        }),
    }
}

#[test]
fn schema_v1_round_trips_all_four_languages() {
    for language in [
        Language::SimplifiedChinese,
        Language::TraditionalChinese,
        Language::Japanese,
    ] {
        let plan = translated_plan(language);
        let serialized = serialize_plan(&plan, Path::new(PLAN_PATH)).unwrap();
        assert_eq!(
            deserialize_plan(&serialized.bytes, Path::new(PLAN_PATH)).unwrap(),
            plan
        );
    }
    let plan = english_plan();
    let serialized = serialize_plan(&plan, Path::new(PLAN_PATH)).unwrap();
    assert_eq!(
        deserialize_plan(&serialized.bytes, Path::new(PLAN_PATH)).unwrap(),
        plan
    );
}

#[test]
fn schema_rejects_unknown_fields_and_unbounded_input() {
    let plan = english_plan();
    let mut value = serde_json::to_value(plan).unwrap();
    value["destination"] = serde_json::json!(r"C:\Windows\System32");
    let bytes = serde_json::to_vec(&value).unwrap();
    assert!(deserialize_plan(&bytes, Path::new(PLAN_PATH)).is_err());
    assert!(deserialize_plan(&vec![b' '; MAX_PLAN_BYTES + 1], Path::new(PLAN_PATH)).is_err());
}

#[test]
fn relative_ids_reject_absolute_parent_ads_unc_device_and_non_normal_forms() {
    for id in [
        r"C:/Windows/System32/a.dll",
        "../outside",
        "folder/../outside",
        "folder/name:stream",
        r"\\server\share",
        r"\\?\C:\device",
        "folder\\child",
        "folder//child",
        "folder/./child",
        "folder/NUL.txt",
        "folder/trailing.",
        "folder/trailing ",
        "folder/\nchild",
    ] {
        assert!(
            validate_relative_id(id).is_err(),
            "unexpectedly accepted {id:?}"
        );
    }
}

#[test]
fn payloads_require_unique_ids_and_both_markers() {
    let mut duplicate = english_plan();
    duplicate.payloads.insert(
        2,
        payload("resources/NODESTRINGS.JSON", PayloadKind::CoreAsset, '7'),
    );
    assert!(validate_plan(&duplicate, Path::new(PLAN_PATH)).is_err());

    let mut missing = english_plan();
    missing
        .payloads
        .retain(|record| record.kind != PayloadKind::FinalMarker);
    assert!(validate_plan(&missing, Path::new(PLAN_PATH)).is_err());

    let mut wrong_marker_transition = english_plan();
    wrong_marker_transition
        .payloads
        .iter_mut()
        .find(|record| record.kind == PayloadKind::FinalMarker)
        .unwrap()
        .expected_destination_sha256 = Some(hash('9'));
    assert!(validate_plan(&wrong_marker_transition, Path::new(PLAN_PATH)).is_err());
}

#[test]
fn generic_and_qpa_payloads_are_language_locked() {
    let mut english = english_plan();
    english.payloads.insert(
        2,
        payload(GENERIC_PLUGIN_ID, PayloadKind::GenericPlugin, '3'),
    );
    assert!(validate_plan(&english, Path::new(PLAN_PATH)).is_err());

    let mut translated = translated_plan(Language::SimplifiedChinese);
    translated
        .payloads
        .retain(|record| record.kind != PayloadKind::GenericPlugin);
    assert!(validate_plan(&translated, Path::new(PLAN_PATH)).is_err());
}

#[test]
fn qpa_root_language_hashes_and_derived_proxy_source_are_locked() {
    let mut wrong_root = translated_plan(Language::SimplifiedChinese);
    if let QpaTransitionPlan::Activate(activation) = &mut wrong_root.qpa_transition {
        activation.install_root = r"D:\Other".to_string();
    }
    assert!(validate_plan(&wrong_root, Path::new(PLAN_PATH)).is_err());

    let mut wrong_language = translated_plan(Language::SimplifiedChinese);
    wrong_language.language = Language::English;
    assert!(validate_plan(&wrong_language, Path::new(PLAN_PATH)).is_err());

    let mut wrong_source = translated_plan(Language::Japanese);
    if let QpaTransitionPlan::Activate(activation) = &mut wrong_source.qpa_transition {
        activation.proxy_source_path =
            r"C:\Users\Tester\AppData\Local\Temp\attacker.dll".to_string();
    }
    assert!(validate_plan(&wrong_source, Path::new(PLAN_PATH)).is_err());

    let mut wrong_hash = translated_plan(Language::TraditionalChinese);
    if let QpaTransitionPlan::Activate(activation) = &mut wrong_hash.qpa_transition {
        activation.generic_plugin_sha256 = hash('9');
    }
    assert!(validate_plan(&wrong_hash, Path::new(PLAN_PATH)).is_err());
}

#[test]
fn transport_round_trips_utf16le_plan_path_and_binds_plan() {
    let plan_path = PathBuf::from(r"C:\Users\测试者\AppData\Local\Cavalry-i18n\事务\plan.json");
    let mut plan = translated_plan(Language::Japanese);
    if let QpaTransitionPlan::Activate(activation) = &mut plan.qpa_transition {
        activation.proxy_source_path = payload_source_path(&plan_path, 3)
            .unwrap()
            .to_string_lossy()
            .to_string();
    }
    let serialized = serialize_plan(&plan, &plan_path).unwrap();
    let transport = WorkerTransport::for_serialized_plan(plan_path, &plan, &serialized).unwrap();
    let token = transport.encode().unwrap();
    assert!(token.is_ascii());
    assert!(token.len() <= MAX_TRANSPORT_TOKEN_LEN);
    let decoded = WorkerTransport::decode(&token).unwrap();
    assert_eq!(decoded, transport);
    assert_eq!(
        deserialize_bound_plan(&serialized.bytes, &decoded).unwrap(),
        plan
    );
}

#[test]
fn bound_plan_rejects_hash_nonce_and_worker_identity_drift() {
    let plan = english_plan();
    let serialized = serialize_plan(&plan, Path::new(PLAN_PATH)).unwrap();
    let mut other_plan = plan.clone();
    other_plan.nonce = hash('d');
    let other_serialized = serialize_plan(&other_plan, Path::new(PLAN_PATH)).unwrap();
    assert!(WorkerTransport::for_serialized_plan(
        PathBuf::from(PLAN_PATH),
        &plan,
        &other_serialized
    )
    .is_err());
    let transport =
        WorkerTransport::for_serialized_plan(PathBuf::from(PLAN_PATH), &plan, &serialized).unwrap();

    let mut tampered = serialized.bytes.clone();
    tampered.push(b' ');
    assert!(deserialize_bound_plan(&tampered, &transport).is_err());

    let mut wrong_nonce = transport.clone();
    wrong_nonce.nonce = hash('d');
    assert!(deserialize_bound_plan(&serialized.bytes, &wrong_nonce).is_err());

    let mut wrong_worker = transport.clone();
    wrong_worker.expected_worker_exe_sha256 = hash('e');
    assert!(deserialize_bound_plan(&serialized.bytes, &wrong_worker).is_err());
}

#[test]
fn token_rejects_bad_shape_alphabet_and_bounds() {
    for token in [
        "",
        "v1.path.hash.nonce",
        "v1.path.hash.nonce.worker.extra",
        "v1.pa=th.hash.nonce.worker",
        "v2.path.hash.nonce.worker",
    ] {
        assert!(WorkerTransport::decode(token).is_err());
    }
    assert!(WorkerTransport::decode(&"a".repeat(MAX_TRANSPORT_TOKEN_LEN + 1)).is_err());
}

#[test]
fn worker_argv_is_exact_and_reserved_failures_never_fall_back_to_ui() {
    assert_eq!(parse_worker_argv(&[]), WorkerArgv::NotWorker);
    assert_eq!(
        parse_worker_argv(&[OsString::from("--ordinary-ui-argument")]),
        WorkerArgv::NotWorker
    );

    let plan = english_plan();
    let serialized = serialize_plan(&plan, Path::new(PLAN_PATH)).unwrap();
    let transport =
        WorkerTransport::for_serialized_plan(PathBuf::from(PLAN_PATH), &plan, &serialized).unwrap();
    let argument = OsString::from(format!(
        "{WORKER_ARGUMENT_PREFIX}{}",
        transport.encode().unwrap()
    ));
    assert!(matches!(
        parse_worker_argv(&[argument.clone()]),
        WorkerArgv::Apply(_)
    ));
    assert!(matches!(
        parse_worker_argv(&[argument, OsString::from("--extra")]),
        WorkerArgv::HandledError(_)
    ));
    assert!(matches!(
        parse_worker_argv(&[OsString::from("--cavalry-i18n-elevated-apply")]),
        WorkerArgv::HandledError(_)
    ));
    assert!(matches!(
        parse_worker_argv(&[OsString::from("--cavalry-i18n-elevated")]),
        WorkerArgv::HandledError(_)
    ));
    assert!(matches!(
        parse_worker_argv(&[OsString::from("--cavalry-i18n-elevated-apply=bad token")]),
        WorkerArgv::HandledError(_)
    ));
    let mut invalid_utf16 = "--cavalry-i18n-elevated-apply="
        .encode_utf16()
        .collect::<Vec<_>>();
    invalid_utf16.push(0xd800);
    assert!(matches!(
        parse_worker_argv(&[OsString::from_wide(&invalid_utf16)]),
        WorkerArgv::HandledError(_)
    ));
}

#[test]
fn recovery_worker_argv_is_single_token_and_never_falls_back_to_ui() {
    let transport = RecoveryTransport::new(PathBuf::from(INSTALL_ROOT), hash('e')).unwrap();
    let argument = OsString::from(format!(
        "{RECOVERY_ARGUMENT_PREFIX}{}",
        transport.encode().unwrap()
    ));

    assert!(matches!(
        parse_worker_argv(&[argument.clone()]),
        WorkerArgv::Recover(decoded) if decoded == transport
    ));
    assert!(matches!(
        parse_worker_argv(&[argument, OsString::from("--extra")]),
        WorkerArgv::HandledError(_)
    ));
}

#[test]
fn language_wire_values_are_exact() {
    for (language, expected) in [
        (Language::English, "\"en\""),
        (Language::SimplifiedChinese, "\"zh-Hans\""),
        (Language::TraditionalChinese, "\"zh-Hant\""),
        (Language::Japanese, "\"ja_JP\""),
    ] {
        assert_eq!(serde_json::to_string(&language).unwrap(), expected);
        assert_eq!(language.as_str(), expected.trim_matches('"'));
    }
}
