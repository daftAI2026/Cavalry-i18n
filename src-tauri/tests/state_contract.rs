/**
 * [INPUT]: 依赖 cavalry_i18n_tauri::state 的 schema、快照 provenance、normalize 与 state.json 读写能力
 * [OUTPUT]: 对外提供 Tauri state.json shape 与旧 schema 默认迁移 contract tests
 * [POS]: src-tauri/tests 的状态守门，确保当前 revision 与 English 快照身份互不覆盖
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
use cavalry_i18n_tauri::state::{
    normalize, read_state, write_state, EnglishSnapshotProvenance, State,
};

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
