/**
 * [INPUT]: 依赖 serde_json 与 state 目录，读取/写入 Electron 兼容 state.json
 * [OUTPUT]: 对外提供 State、normalize、read_state、write_state
 * [POS]: src-tauri/src 的状态模块，与 detect/commands 共享单一状态 schema
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
use serde::{Deserialize, Serialize};
use std::{fs, path::Path};

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct State {
    pub app_path: String,
    pub cavalry_version: String,
    pub current_lang: String,
    pub last_patched_at: String,
}

impl Default for State {
    fn default() -> Self {
        Self {
            app_path: String::new(),
            cavalry_version: String::new(),
            current_lang: "en".to_string(),
            last_patched_at: String::new(),
        }
    }
}

pub fn normalize(mut state: State) -> State {
    if !matches!(
        state.current_lang.as_str(),
        "en" | "zh-Hans" | "zh-Hant" | "ja_JP"
    ) {
        state.current_lang = "en".to_string();
    }
    state
}

pub fn read_state(state_dir: &Path) -> Option<State> {
    let state_path = state_dir.join("state.json");
    let bytes = fs::read(state_path).ok()?;
    let state = serde_json::from_slice::<State>(&bytes).ok()?;
    Some(normalize(state))
}

pub fn write_state(state_dir: &Path, state: &State) -> Result<State, String> {
    let state = normalize(state.clone());
    fs::create_dir_all(state_dir).map_err(|error| error.to_string())?;
    let payload = serde_json::to_string_pretty(&state).map_err(|error| error.to_string())?;
    fs::write(state_dir.join("state.json"), format!("{payload}\n"))
        .map_err(|error| error.to_string())?;
    Ok(state)
}

#[cfg(test)]
mod tests {
    use super::{normalize, State};

    #[test]
    fn normalize_state_defaults_to_english() {
        let state = normalize(State {
            current_lang: "bad".into(),
            ..State::default()
        });
        assert_eq!(state.current_lang, "en");
    }
}
