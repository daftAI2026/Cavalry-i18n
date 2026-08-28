/**
 * [INPUT]: 依赖 cavalry_i18n_tauri::bridge 的实际 Rust include、src/lib.rs Builder 装配与 renderer/index.html 外部脚本顺序
 * [OUTPUT]: 执行 Builder 实际消费的 initialization script，并守住 Rust pre-page-load 注册顺序、冻结 API、camelCase payload、有序 verify/baseline/apply/restart Channel、Windows residue 检测与 warningCodes
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
const callbacks = new Map();
let nextCallbackId = 1;
const context = {
  Promise,
  console,
  window: {
    __TAURI_INTERNALS__: {
      transformCallback(callback) {
        const id = nextCallbackId++;
        callbacks.set(id, callback);
        return id;
      },
      unregisterCallback(id) {
        callbacks.delete(id);
      },
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
          const callback = callbacks.get(payload.onEvent.id);
          callback({ index: 1, message: { phase: 'verifyInstallation', state: 'completed' } });
          callback({ index: 0, message: { phase: 'verifyInstallation', state: 'running' } });
          callback({ index: 3, message: { phase: 'ensureBaseline', state: 'completed' } });
          callback({ index: 2, message: { phase: 'ensureBaseline', state: 'running' } });
          callback({ index: 4, message: { phase: 'applyTransaction', state: 'running' } });
          callback({ index: 5, message: { phase: 'applyTransaction', state: 'warning' } });
          callback({ index: 6, message: { phase: 'restartCavalry', state: 'running' } });
          callback({ index: 7, message: { phase: 'restartCavalry', state: 'warning' } });
          callback({ index: 8, end: true });
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
  const events = [];
  const action = await api.applyLanguage('/Applications/Cavalry.app', 'zh-Hans', (event) => events.push(event));
  assert.equal(action.warning, null);
  assert.equal(Object.isFrozen(action.warningCodes), true);
  assert.deepEqual(JSON.parse(JSON.stringify(action.warningCodes)), [
    'temporaryCleanupPending',
    'restartFailed',
  ]);
  assert.deepEqual(JSON.parse(JSON.stringify(events)), [
    { phase: 'verifyInstallation', state: 'running' },
    { phase: 'verifyInstallation', state: 'completed' },
    { phase: 'ensureBaseline', state: 'running' },
    { phase: 'ensureBaseline', state: 'completed' },
    { phase: 'applyTransaction', state: 'running' },
    { phase: 'applyTransaction', state: 'warning' },
    { phase: 'restartCavalry', state: 'running' },
    { phase: 'restartCavalry', state: 'warning' },
  ]);
  assert.deepEqual(JSON.parse(JSON.stringify(calls[1])), {
    command: 'apply_language',
    payload: { appPath: '/Applications/Cavalry.app', lang: 'zh-Hans', onEvent: '__CHANNEL__:1' },
  });
  assert.equal(Object.hasOwn(api, 'showAbout'), true);
  const about = await api.showAbout();
  assert.equal(about.ok, true);
  assert.deepEqual(calls[2], { command: 'show_about', payload: undefined });
  assert.equal(Object.hasOwn(api, 'reconcileEnglish'), false);
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
    let text_script = html
        .find("<script src=\"./ui-text.js\"></script>")
        .expect("HTML must load ui-text.js");
    let operation_script = html
        .find("<script src=\"./operation-log.js\"></script>")
        .expect("HTML must load operation-log.js");
    let app_script = html
        .find("<script src=\"./app.js\"></script>")
        .expect("HTML must load app.js");
    assert!(
        fallback_bridge < text_script
            && text_script < operation_script
            && operation_script < app_script,
        "HTML bridge, ui-text, and operation-log scripts must precede app.js"
    );
}
