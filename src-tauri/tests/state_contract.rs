/**
 * [INPUT]: 依赖 cavalry_i18n_tauri::state 的 schema、快照 provenance、normalize 与 state.json 读写能力
 * [OUTPUT]: 对外提供 Tauri state.json shape、typed control recovery diagnostic/commit outcome、显式目录 durability retry 与旧 schema 默认迁移 contract tests
 * [POS]: src-tauri/tests 的状态守门，确保当前 revision 与 English 快照身份互不覆盖，且 current/prev 损坏不会静默 default
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
use cavalry_i18n_tauri::state::{
    confirm_state_directory_durability, normalize, read_state, read_state_document,
    read_state_for_control, read_state_for_control_report, read_state_strict,
    read_state_with_recovery, write_state, write_state_outcome, write_state_with_operation,
    EnglishSnapshotProvenance, State, StateCommitOutcome, StateControlSource, StateReadSource,
    StateWriteOutcome, STATE_SCHEMA_VERSION,
};

fn snapshot_provenance(
    generation: Option<String>,
    manifest: Option<String>,
    vendor_baseline: Option<String>,
) -> EnglishSnapshotProvenance {
    EnglishSnapshotProvenance {
        install_root: "/Applications/Cavalry.app".into(),
        immutable_revision: "macos-identity:fixture".into(),
        snapshot_generation: generation,
        snapshot_manifest_sha256: manifest,
        vendor_baseline_id: vendor_baseline,
    }
}

fn state_with_provenance(provenance: EnglishSnapshotProvenance) -> State {
    State {
        app_path: "/Applications/Cavalry.app".into(),
        cavalry_revision: "macos-identity:fixture".into(),
        english_snapshot_provenance: Some(provenance),
        ..State::default()
    }
}

#[test]
fn normalize_state_defaults_to_english() {
    let state = normalize(State {
        current_lang: "bad".into(),
        ..State::default()
    });
    assert_eq!(state.current_lang, "en");
}

#[test]
fn write_and_read_state_uses_tauri_schema() {
    let temp = tempfile::tempdir().unwrap();
    let expected = State {
        app_path: "/Applications/Cavalry.app".into(),
        cavalry_version: "2.3.4".into(),
        cavalry_revision: "bundle-version:2.3.4".into(),
        current_lang: "zh-Hans".into(),
        last_patched_at: "2026-04-24T00:00:00.000Z".into(),
        english_snapshot_provenance: Some(EnglishSnapshotProvenance {
            install_root: "/Applications/Cavalry.app".into(),
            immutable_revision: "bundle-version:2.3.4".into(),
            snapshot_generation: Some("a".repeat(64)),
            snapshot_manifest_sha256: Some("b".repeat(64)),
            vendor_baseline_id: Some("c".repeat(64)),
        }),
    };
    write_state(temp.path(), &expected).unwrap();

    let actual = read_state(temp.path()).unwrap();
    assert_eq!(actual, expected);
}

#[test]
fn old_state_deserializes_with_empty_revision_and_no_snapshot_provenance() {
    let temp = tempfile::tempdir().unwrap();
    std::fs::write(
        temp.path().join("state.json"),
        r#"{
  "appPath": "/Applications/Cavalry.app",
  "cavalryVersion": "2.3.4",
  "currentLang": "zh-Hans",
  "lastPatchedAt": "old"
}
"#,
    )
    .unwrap();

    let state = read_state(temp.path()).unwrap();
    assert_eq!(state.current_lang, "zh-Hans");
    assert!(state.cavalry_revision.is_empty());
    assert!(state.english_snapshot_provenance.is_none());
}

#[test]
fn snapshot_provenance_accepts_only_legacy_windows_and_macos_identity_shapes() {
    let temp = tempfile::tempdir().unwrap();
    let digest_a = "a".repeat(64);
    let digest_b = "b".repeat(64);
    let digest_c = "c".repeat(64);
    let accepted = [
        snapshot_provenance(None, None, None),
        snapshot_provenance(Some(digest_a.clone()), Some(digest_b.clone()), None),
        snapshot_provenance(Some(digest_a), Some(digest_b), Some(digest_c)),
    ];

    for (index, provenance) in accepted.into_iter().enumerate() {
        let state_dir = temp.path().join(format!("accepted-{index}"));
        let expected = state_with_provenance(provenance);
        write_state(&state_dir, &expected).unwrap();
        assert_eq!(read_state_strict(&state_dir).unwrap(), expected);
    }
}

#[test]
fn snapshot_provenance_partial_identity_shapes_are_rejected_before_write() {
    let temp = tempfile::tempdir().unwrap();
    let generation = "a".repeat(64);
    let manifest = "b".repeat(64);
    let vendor = "c".repeat(64);
    let rejected = [
        snapshot_provenance(Some(generation.clone()), None, None),
        snapshot_provenance(None, Some(manifest.clone()), None),
        snapshot_provenance(None, None, Some(vendor.clone())),
        snapshot_provenance(Some(generation.clone()), None, Some(vendor.clone())),
        snapshot_provenance(None, Some(manifest.clone()), Some(vendor)),
    ];

    for (index, provenance) in rejected.into_iter().enumerate() {
        let state_dir = temp.path().join(format!("rejected-{index}"));
        let error = write_state(&state_dir, &state_with_provenance(provenance)).unwrap_err();
        assert!(error.contains("identity fields"), "{error}");
        assert!(
            !state_dir.join("state.json").exists(),
            "invalid provenance must be rejected before publication"
        );
    }
}

#[test]
fn snapshot_provenance_requires_lowercase_sha256_for_every_present_identity() {
    let temp = tempfile::tempdir().unwrap();
    let valid = snapshot_provenance(
        Some("a".repeat(64)),
        Some("b".repeat(64)),
        Some("c".repeat(64)),
    );
    let mut invalid = Vec::new();

    let mut uppercase_generation = valid.clone();
    uppercase_generation.snapshot_generation = Some("A".repeat(64));
    invalid.push(("snapshotGeneration", uppercase_generation));

    let mut short_manifest = valid.clone();
    short_manifest.snapshot_manifest_sha256 = Some("b".repeat(63));
    invalid.push(("snapshotManifestSha256", short_manifest));

    let mut non_hex_vendor = valid;
    non_hex_vendor.vendor_baseline_id = Some("g".repeat(64));
    invalid.push(("vendorBaselineId", non_hex_vendor));

    for (index, (field, provenance)) in invalid.into_iter().enumerate() {
        let state_dir = temp.path().join(format!("invalid-hash-{index}"));
        let error = write_state(&state_dir, &state_with_provenance(provenance)).unwrap_err();
        assert!(error.contains(field), "{error}");
        assert!(error.contains("lowercase SHA-256"), "{error}");
    }
}

#[test]
fn generation_bound_provenance_requires_install_root_and_immutable_revision_before_write() {
    let temp = tempfile::tempdir().unwrap();
    let valid = snapshot_provenance(Some("a".repeat(64)), Some("b".repeat(64)), None);
    let mut invalid = Vec::new();

    let mut missing_root = valid.clone();
    missing_root.install_root.clear();
    invalid.push(("installRoot", missing_root));

    let mut missing_revision = valid;
    missing_revision.immutable_revision = "   ".into();
    invalid.push(("immutableRevision", missing_revision));

    for (index, (field, provenance)) in invalid.into_iter().enumerate() {
        let state_dir = temp.path().join(format!("missing-binding-{index}"));
        let error = write_state(&state_dir, &state_with_provenance(provenance)).unwrap_err();
        assert!(error.contains(field), "{error}");
        assert!(error.contains("generation identity"), "{error}");
        assert!(
            !state_dir.join("state.json").exists(),
            "an unbound generation must be rejected before publication"
        );
    }
}

#[test]
fn legacy_provenance_with_all_new_identity_fields_absent_still_deserializes() {
    let temp = tempfile::tempdir().unwrap();
    std::fs::write(
        temp.path().join("state.json"),
        r#"{
  "appPath": "/Applications/Cavalry.app",
  "cavalryVersion": "2.7.2",
  "cavalryRevision": "legacy-revision",
  "currentLang": "en",
  "lastPatchedAt": "old",
  "englishSnapshotProvenance": {
    "installRoot": "/Applications/Cavalry.app",
    "immutableRevision": "legacy-revision"
  }
}"#,
    )
    .unwrap();

    let state = read_state_strict(temp.path()).unwrap();
    let provenance = state.english_snapshot_provenance.unwrap();
    assert!(provenance.snapshot_generation.is_none());
    assert!(provenance.snapshot_manifest_sha256.is_none());
    assert!(provenance.vendor_baseline_id.is_none());
}

#[test]
fn strict_read_rejects_partial_current_snapshot_provenance() {
    let temp = tempfile::tempdir().unwrap();
    let valid = state_with_provenance(snapshot_provenance(
        Some("a".repeat(64)),
        Some("b".repeat(64)),
        Some("c".repeat(64)),
    ));
    write_state(temp.path(), &valid).unwrap();
    let path = temp.path().join("state.json");
    let mut document: serde_json::Value =
        serde_json::from_slice(&std::fs::read(&path).unwrap()).unwrap();
    document["englishSnapshotProvenance"]["snapshotManifestSha256"] = serde_json::Value::Null;
    std::fs::write(&path, serde_json::to_vec_pretty(&document).unwrap()).unwrap();

    let error = read_state_strict(temp.path()).unwrap_err();
    assert!(error.to_string().contains("identity fields"), "{error}");
}

#[test]
fn strict_read_rejects_generation_bound_current_state_without_install_root() {
    let temp = tempfile::tempdir().unwrap();
    let valid = state_with_provenance(snapshot_provenance(
        Some("a".repeat(64)),
        Some("b".repeat(64)),
        None,
    ));
    write_state(temp.path(), &valid).unwrap();
    let path = temp.path().join("state.json");
    let mut document: serde_json::Value =
        serde_json::from_slice(&std::fs::read(&path).unwrap()).unwrap();
    document["englishSnapshotProvenance"]["installRoot"] = serde_json::json!("");
    std::fs::write(&path, serde_json::to_vec_pretty(&document).unwrap()).unwrap();

    let error = read_state_strict(temp.path()).unwrap_err();
    assert!(error.to_string().contains("installRoot"), "{error}");
    assert!(error.to_string().contains("generation identity"), "{error}");
}

#[test]
fn strict_read_and_followup_write_reject_invalid_last_known_good_provenance() {
    let temp = tempfile::tempdir().unwrap();
    let first = state_with_provenance(snapshot_provenance(
        Some("a".repeat(64)),
        Some("b".repeat(64)),
        Some("c".repeat(64)),
    ));
    write_state_with_operation(temp.path(), &first, "valid-baseline").unwrap();
    write_state_with_operation(temp.path(), &State::default(), "valid-current").unwrap();

    let path = temp.path().join("state.json");
    let mut document: serde_json::Value =
        serde_json::from_slice(&std::fs::read(&path).unwrap()).unwrap();
    document["lastKnownGood"]["englishSnapshotProvenance"]["snapshotManifestSha256"] =
        serde_json::Value::Null;
    std::fs::write(&path, serde_json::to_vec_pretty(&document).unwrap()).unwrap();

    let error = read_state_strict(temp.path()).unwrap_err();
    assert!(
        error
            .to_string()
            .contains("lastKnownGood snapshot provenance"),
        "{error}"
    );
    let write_error = write_state(temp.path(), &State::default()).unwrap_err();
    assert!(
        write_error.contains("damaged state document"),
        "{write_error}"
    );
}

#[test]
fn strict_read_rejects_generation_bound_last_known_good_without_revision() {
    let temp = tempfile::tempdir().unwrap();
    let first = state_with_provenance(snapshot_provenance(
        Some("a".repeat(64)),
        Some("b".repeat(64)),
        Some("c".repeat(64)),
    ));
    write_state_with_operation(temp.path(), &first, "bound-baseline").unwrap();
    write_state_with_operation(temp.path(), &State::default(), "bound-current").unwrap();

    let path = temp.path().join("state.json");
    let mut document: serde_json::Value =
        serde_json::from_slice(&std::fs::read(&path).unwrap()).unwrap();
    document["lastKnownGood"]["englishSnapshotProvenance"]["immutableRevision"] =
        serde_json::json!(" ");
    std::fs::write(&path, serde_json::to_vec_pretty(&document).unwrap()).unwrap();

    let error = read_state_strict(temp.path()).unwrap_err();
    assert!(
        error
            .to_string()
            .contains("lastKnownGood snapshot provenance"),
        "{error}"
    );
    assert!(error.to_string().contains("immutableRevision"), "{error}");
}

#[test]
fn typed_write_outcome_reports_the_normal_committed_path() {
    let temp = tempfile::tempdir().unwrap();
    let expected = State {
        current_lang: "ja_JP".into(),
        ..State::default()
    };

    let outcome = write_state_outcome(temp.path(), &expected).unwrap();
    let _: StateCommitOutcome = outcome.clone();
    assert!(matches!(
        outcome,
        StateWriteOutcome::Committed { ref state } if state == &expected
    ));
    assert!(outcome.warning().is_none());
    assert_eq!(outcome.state(), &expected);
}

#[test]
fn state_document_has_schema_generation_operation_and_previous_generation() {
    let temp = tempfile::tempdir().unwrap();
    let first = State {
        app_path: "/Applications/Cavalry.app".into(),
        ..State::default()
    };
    write_state_with_operation(temp.path(), &first, "operation-one").unwrap();
    let first_document = read_state_document(temp.path()).unwrap();
    assert_eq!(first_document.schema_version, STATE_SCHEMA_VERSION);
    assert_eq!(first_document.generation, 1);
    assert_eq!(first_document.operation_id, "operation-one");
    assert_eq!(
        first_document
            .last_known_good
            .as_ref()
            .unwrap()
            .operation_id,
        "operation-one"
    );

    let second = State {
        current_lang: "zh-Hans".into(),
        ..first
    };
    write_state_with_operation(temp.path(), &second, "operation-two").unwrap();
    let second_document = read_state_document(temp.path()).unwrap();
    assert_eq!(second_document.generation, 2);
    assert_eq!(second_document.operation_id, "operation-two");
    assert_eq!(
        second_document
            .last_known_good
            .as_ref()
            .unwrap()
            .operation_id,
        "operation-one"
    );
    assert!(
        temp.path().join("state.json.prev").is_file(),
        "the last committed generation must remain available as prev"
    );
    assert_eq!(
        read_state_strict(temp.path()).unwrap().current_lang,
        "zh-Hans"
    );
}

#[test]
fn damaged_current_state_reports_and_recovers_only_from_valid_prev() {
    let temp = tempfile::tempdir().unwrap();
    let first = State {
        current_lang: "zh-Hant".into(),
        ..State::default()
    };
    write_state_with_operation(temp.path(), &first, "good-one").unwrap();
    write_state_with_operation(
        temp.path(),
        &State {
            current_lang: "ja_JP".into(),
            ..first.clone()
        },
        "good-two",
    )
    .unwrap();
    std::fs::write(temp.path().join("state.json"), b"{not-json").unwrap();

    let strict_error = read_state_strict(temp.path()).unwrap_err();
    assert!(strict_error.to_string().contains("state.json"));
    let recovered = read_state_with_recovery(temp.path()).unwrap();
    assert_eq!(recovered.source, StateReadSource::Previous);
    assert_eq!(recovered.document.state.current_lang, "zh-Hant");
    assert!(recovered
        .recovery_diagnostic
        .as_deref()
        .is_some_and(|detail| detail.contains("corrupt")));

    let write_error = write_state(temp.path(), &State::default()).unwrap_err();
    assert!(write_error.contains("damaged state document"));
}

#[test]
fn control_read_atomically_promotes_valid_previous_generation() {
    let temp = tempfile::tempdir().unwrap();
    write_state_with_operation(
        temp.path(),
        &State {
            current_lang: "zh-Hant".into(),
            ..State::default()
        },
        "first-good",
    )
    .unwrap();
    write_state_with_operation(
        temp.path(),
        &State {
            current_lang: "ja_JP".into(),
            ..State::default()
        },
        "second-good",
    )
    .unwrap();
    std::fs::write(temp.path().join("state.json"), b"truncated").unwrap();

    let recovered = read_state_for_control(temp.path()).unwrap();
    assert_eq!(recovered.current_lang, "zh-Hant");
    assert_eq!(read_state_strict(temp.path()).unwrap(), recovered);
    write_state_with_operation(
        temp.path(),
        &State {
            current_lang: "en".into(),
            ..recovered
        },
        "after-recovery",
    )
    .unwrap();
}

#[test]
fn typed_control_report_preserves_recovery_diagnostic_and_commit_identity() {
    let temp = tempfile::tempdir().unwrap();
    write_state_with_operation(
        temp.path(),
        &State {
            current_lang: "zh-Hant".into(),
            ..State::default()
        },
        "first-good",
    )
    .unwrap();
    write_state_with_operation(
        temp.path(),
        &State {
            current_lang: "ja_JP".into(),
            ..State::default()
        },
        "second-good",
    )
    .unwrap();
    std::fs::write(temp.path().join("state.json"), b"{truncated").unwrap();

    let report = read_state_for_control_report(temp.path()).unwrap();
    assert_eq!(report.source, StateControlSource::Previous);
    assert_eq!(report.state.current_lang, "zh-Hant");
    assert!(report
        .recovery_diagnostic
        .as_deref()
        .is_some_and(|detail| detail.contains("corrupt")));
    let commit = report
        .recovery_commit
        .as_ref()
        .expect("previous state recovery must expose its promotion outcome");
    assert_eq!(commit.state().current_lang, "zh-Hant");
    assert!(commit.warning().is_none());
    assert!(report.recovery_warning().is_none());
}

#[test]
fn typed_control_report_keeps_first_run_default_distinct_from_recovery() {
    let temp = tempfile::tempdir().unwrap();
    let report = read_state_for_control_report(temp.path()).unwrap();
    assert_eq!(report.source, StateControlSource::Default);
    assert!(report.recovery_diagnostic.is_none());
    assert!(report.recovery_commit.is_none());
}

#[test]
fn typed_control_report_fails_closed_when_current_and_prev_are_both_corrupt() {
    let temp = tempfile::tempdir().unwrap();
    std::fs::write(temp.path().join("state.json"), b"{bad-current").unwrap();
    std::fs::write(temp.path().join("state.json.prev"), b"{bad-prev").unwrap();

    let error = read_state_for_control_report(temp.path()).unwrap_err();
    let rendered = error.to_string();
    assert!(rendered.contains("state recovery failed"), "{rendered}");
    assert!(rendered.contains("state.json.prev"), "{rendered}");
}

#[test]
fn future_schema_never_falls_back_to_an_older_previous_generation() {
    let temp = tempfile::tempdir().unwrap();
    write_state_with_operation(temp.path(), &State::default(), "known-schema").unwrap();
    write_state_with_operation(temp.path(), &State::default(), "newer-known-schema").unwrap();
    let mut value: serde_json::Value =
        serde_json::from_slice(&std::fs::read(temp.path().join("state.json")).unwrap()).unwrap();
    value["schemaVersion"] = serde_json::json!(STATE_SCHEMA_VERSION + 1);
    std::fs::write(
        temp.path().join("state.json"),
        serde_json::to_vec_pretty(&value).unwrap(),
    )
    .unwrap();

    let error = read_state_for_control(temp.path()).unwrap_err();
    assert!(error.contains("unsupported schema"), "{error}");
}

#[test]
fn corrupt_previous_generation_is_not_silently_replaced_on_first_publish() {
    let temp = tempfile::tempdir().unwrap();
    std::fs::write(temp.path().join("state.json.prev"), b"corrupt").unwrap();

    let error = write_state(temp.path(), &State::default()).unwrap_err();
    assert!(error.contains("damaged previous state document"), "{error}");
}

#[test]
fn explicit_durability_retry_does_not_publish_an_extra_state_generation() {
    let temp = tempfile::tempdir().unwrap();
    write_state_with_operation(temp.path(), &State::default(), "durability-baseline").unwrap();
    let before = std::fs::read(temp.path().join("state.json")).unwrap();

    assert_eq!(
        confirm_state_directory_durability(temp.path()).unwrap(),
        None
    );
    assert_eq!(
        std::fs::read(temp.path().join("state.json")).unwrap(),
        before
    );
}

#[cfg(unix)]
#[test]
fn state_reads_refuse_symlink_documents() {
    use std::os::unix::fs::symlink;

    let temp = tempfile::tempdir().unwrap();
    let outside = temp.path().join("outside.json");
    std::fs::write(
        &outside,
        br#"{"appPath":"","cavalryVersion":"","cavalryRevision":"","currentLang":"en","lastPatchedAt":""}"#,
    )
    .unwrap();
    symlink(&outside, temp.path().join("state.json")).unwrap();

    let error = read_state_strict(temp.path()).unwrap_err();
    assert!(error.to_string().contains("symlink"), "{error}");
}
