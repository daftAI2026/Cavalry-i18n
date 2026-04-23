/**
 * [INPUT]: 依赖 cavalry_i18n_tauri::state 的 schema、normalize 与 state.json 读写能力
 * [OUTPUT]: 对外提供 Electron 兼容 state.json shape contract tests
 * [POS]: src-tauri/tests 的状态守门，确保 saved app path、language 与时间戳 schema 稳定
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
use cavalry_i18n_tauri::state::{normalize, read_state, write_state, State};

#[test]
fn normalize_state_defaults_to_english() {
    let state = normalize(State {
        current_lang: "bad".into(),
        ..State::default()
    });
    assert_eq!(state.current_lang, "en");
}

#[test]
fn write_and_read_state_uses_electron_compatible_schema() {
    let temp = tempfile::tempdir().unwrap();
    let expected = State {
        app_path: "/Applications/Cavalry.app".into(),
        cavalry_version: "2.3.4".into(),
        current_lang: "zh-Hans".into(),
        last_patched_at: "2026-04-24T00:00:00.000Z".into(),
    };
    write_state(temp.path(), &expected).unwrap();

    let actual = read_state(temp.path()).unwrap();
    assert_eq!(actual, expected);
}
