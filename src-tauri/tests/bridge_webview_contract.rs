/**
 * [INPUT]: 依赖 cavalry_i18n_tauri::bridge 的实际 Rust include、src/lib.rs Builder 装配与 renderer/index.html 外部脚本顺序
 * [OUTPUT]: 执行 Builder 实际消费的 initialization script，并守住 Rust pre-page-load 注册顺序、冻结 API、camelCase payload 与 warningCodes
 * [POS]: src-tauri/tests 的 bridge host-seam 守门；不虚称启动平台 WebView 或验证 packaged CSP，后者属于显式 Tauri UI 外部门
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
use cavalry_i18n_tauri::bridge::script;
use std::{fs, path::Path, process::Command};

#[test]
fn rust_embedded_initialization_script_executes_against_tauri_internals() {
    let harness = r#"
const assert = require('node:assert/strict');
const vm = require('node:vm');
const calls = [];
const context = {
  Promise,
  console,
  window: {
    __TAURI_INTERNALS__: {
      invoke(command, payload) {
        calls.push({ command, payload });
        if (command === 'get_status') {
          return Promise.resolve({
            appPath: '/Applications/Cavalry.app',
            currentLang: 'zh-Hans',
            installationMode: 'modifiedOrUnverified',
            defaultAppCandidates: [],
            languages: [{ value: 'attacker', label: '<img>' }],
            needsExtract: false,
            permissionAction: 'none',
            platform: 'macos',
            version: '2.7.2',
          });
        }
        if (command === 'apply_language') {
          return Promise.resolve({
            ok: true,
            currentLang: 'zh-Hans',
            warning: 'private backend prose',
            warningCode: 'restartFailed',
            warningCodes: ['temporaryCleanupPending'],
          });
        }
        return Promise.resolve({ ok: true });
      },
    },
  },
};
context.globalThis = context;
vm.runInNewContext(process.env.CAVALRY_BRIDGE_INITIALIZATION_SCRIPT, context, {
  filename: 'rust-embedded-tauri-bridge.js',
});

(async () => {
  const api = context.window.cavalryI18n;
  assert.equal(Object.isFrozen(api), true);
  assert.equal(Object.hasOwn(api, 'restartCavalry'), false);
  const status = await api.getStatus();
  assert.deepEqual(JSON.parse(JSON.stringify(status.languages)), [
    { value: 'en', label: 'English' },
    { value: 'zh-Hans', label: '简体中文' },
    { value: 'zh-Hant', label: '繁體中文' },
    { value: 'ja_JP', label: '日本語' },
  ]);
  const action = await api.applyLanguage('/Applications/Cavalry.app', 'zh-Hans');
  assert.equal(action.warning, null);
  assert.equal(Object.isFrozen(action.warningCodes), true);
  assert.deepEqual(JSON.parse(JSON.stringify(action.warningCodes)), [
    'temporaryCleanupPending',
    'restartFailed',
  ]);
  assert.deepEqual(JSON.parse(JSON.stringify(calls[1])), {
    command: 'apply_language',
    payload: { appPath: '/Applications/Cavalry.app', lang: 'zh-Hans' },
  });
})().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exitCode = 1;
});
"#;

    let output = Command::new("node")
        .args(["-e", harness])
        .env("CAVALRY_BRIDGE_INITIALIZATION_SCRIPT", script())
        .output()
        .expect("Node.js is required by the repository's renderer contracts");
    assert!(
        output.status.success(),
        "Rust-embedded bridge did not execute:\nstdout:\n{}\nstderr:\n{}",
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr)
    );
}

#[test]
fn builder_and_html_keep_the_actual_initialization_order() {
    let manifest_dir = Path::new(env!("CARGO_MANIFEST_DIR"));
    let lib_rs = fs::read_to_string(manifest_dir.join("src/lib.rs")).unwrap();
    let bridge_rs = fs::read_to_string(manifest_dir.join("src/bridge.rs")).unwrap();
    let html = fs::read_to_string(manifest_dir.join("../renderer/index.html")).unwrap();

    let initialization = lib_rs
        .find(".append_invoke_initialization_script(bridge::script())")
        .expect("Builder must consume the checked Rust bridge script");
    let handler = lib_rs
        .find(".invoke_handler(tauri::generate_handler![")
        .expect("Builder must register the command handler");
    assert!(
        initialization < handler,
        "the pre-page-load bridge registration must precede the invoke handler in Builder assembly"
    );
    assert!(
        bridge_rs.contains("include_str!(\"../../renderer/tauri-bridge.js\")"),
        "bridge.rs should embed the same checked renderer source"
    );

    let fallback_bridge = html
        .find("<script src=\"./tauri-bridge.js\"></script>")
        .expect("HTML must retain the local bridge fallback");
    let app_script = html
        .find("<script src=\"./app.js\"></script>")
        .expect("HTML must load app.js");
    assert!(
        fallback_bridge < app_script,
        "HTML bridge fallback must precede app.js"
    );
}
