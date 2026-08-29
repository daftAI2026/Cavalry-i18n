#!/usr/bin/env node
/**
 * [INPUT]: 依赖 renderer/index.html 与 renderer 下真实 CSS/JS，依赖 Node http/fs/path；仅以 localhost query 选择受控 fixture 状态。
 * [OUTPUT]: 对外提供 createUiReviewServer/renderReviewDocument，并在 CLI 模式启动 UI Review 工作台；每次请求读取真实 renderer，只在 bridge 前注入 fake API。
 * [POS]: tools 的本地 UI 审查入口；界面实现与生产完全同源，只解耦状态、事件和时序，不进入 Tauri bundle、不伪造 native/package 证据。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');
const rendererRoot = path.join(repoRoot, 'renderer');
const defaultPort = 4319;
const host = '127.0.0.1';
const mimeByExtension = Object.freeze({
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.png': 'image/png',
});

function renderReviewDocument() {
  const html = fs.readFileSync(path.join(rendererRoot, 'index.html'), 'utf8');
  const withBase = html.replace(
    '</title>',
    '</title>\n  <base href="/renderer/" />'
  );
  const bridgeTag = '<script src="./tauri-bridge.js"></script>';
  if (!withBase.includes(bridgeTag)) throw new Error('renderer bridge anchor is missing');
  return withBase.replace(
    bridgeTag,
    '<script src="/fixture.js"></script>\n  ' + bridgeTag
  );
}

function fixtureSource() {
  return String.raw`(() => {
  'use strict';
  const params = new URLSearchParams(location.search);
  const scenario = params.get('scenario') || 'translated';
  const locale = params.get('locale') || 'zh-Hans';
  const browserLocale = {
    en: 'en-US', 'zh-Hans': 'zh-CN', 'zh-Hant': 'zh-TW', ja_JP: 'ja-JP',
  }[locale] || 'en-US';
  try {
    Object.defineProperty(navigator, 'languages', { configurable: true, get: () => [browserLocale] });
    Object.defineProperty(navigator, 'language', { configurable: true, get: () => browserLocale });
  } catch (_) {}

  const languages = Object.freeze([
    Object.freeze({ value: 'en', label: 'English' }),
    Object.freeze({ value: 'zh-Hans', label: '简体中文' }),
    Object.freeze({ value: 'zh-Hant', label: '繁體中文' }),
    Object.freeze({ value: 'ja_JP', label: '日本語' }),
  ]);
  const timing = Object.freeze({
    phase: 480,
    download: 420,
    install: 720,
    readyPoll: 50,
    readyAttempts: 80,
  });
  let currentLang = ['translated', 'restore', 'reinstall'].includes(scenario) ? 'zh-Hans' : 'en';
  const wait = (duration) => new Promise((resolve) => setTimeout(resolve, duration));
  const success = () => ({
    ok: true, count: 1, currentLang, warning: null, warningCode: null,
    warningCodes: [], permissionRequired: false, reconciliationRequired: false,
    error: null, errorCode: null,
  });
  const status = () => ({
    appManagementGranted: true,
    appPath: '/Applications/Cavalry.app',
    currentLang,
    installationMode: scenario === 'reinstall'
      ? 'modifiedOrUnverified'
      : currentLang === 'en' ? 'official' : 'modifiedOrUnverified',
    startupRecoveryError: null,
    defaultAppCandidates: ['/Applications/Cavalry.app'],
    languages,
    needsExtract: scenario === 'reinstall',
    permissionAction: 'none',
    platform: 'macos',
    reconciliationRequired: false,
    version: '2.7.2',
  });

  window.cavalryI18n = Object.freeze({
    getStatus: async () => status(),
    browseApp: async () => ({ canceled: false, appPath: status().appPath, version: '2.7.2' }),
    applyLanguage: async (_appPath, language, onEvent = () => {}) => {
      const phases = ['verifyInstallation', 'ensureBaseline', 'applyTransaction', 'restartCavalry'];
      for (const phase of phases) {
        onEvent({ phase, state: 'running' });
        await wait(timing.phase);
        if (scenario === 'error' && phase === 'verifyInstallation') {
          onEvent({ phase, state: 'error' });
          return { ...success(), ok: false, errorCode: 'cavalryStillRunning' };
        }
        onEvent({ phase, state: 'completed' });
      }
      currentLang = language === 'restore-official' ? 'en' : language;
      return success();
    },
    openPrivacySecurity: async () => success(),
    openProjectLink: async () => success(),
    showAbout: async () => success(),
    getSwitcherVersion: async () => '0.7.0',
    checkUpdate: async () => scenario === 'update'
      ? { currentVersion: '0.7.0', version: '0.7.1', notes: 'UI review fixture', pubDate: null, available: true, errorCode: null }
      : { currentVersion: '0.7.0', version: null, notes: null, pubDate: null, available: false, errorCode: null },
    installUpdate: async (onEvent = () => {}) => {
      const total = 1000;
      for (const downloaded of [140, 420, 760, total]) {
        onEvent({ phase: 'downloading', downloaded, contentLength: total });
        await wait(timing.download);
      }
      onEvent({ phase: 'installing', downloaded: total, contentLength: total });
      await wait(timing.install);
      onEvent({ phase: 'restarting', downloaded: total, contentLength: total });
      return { currentVersion: '0.7.0', version: null, notes: null, pubDate: null, available: false, errorCode: null };
    },
    minimizeWindow: async () => {},
    toggleMaximizeWindow: async () => {},
    isWindowMaximized: async () => false,
    closeWindow: async () => {},
  });

  async function waitForReady(selector) {
    for (let attempt = 0; attempt < timing.readyAttempts; attempt += 1) {
      const element = document.querySelector(selector);
      if (element && !element.hidden && !element.disabled) return element;
      await wait(timing.readyPoll);
    }
    return null;
  }

  window.addEventListener('load', async () => {
    if (!['switch', 'restore', 'update', 'error'].includes(scenario)) return;
    const selector = scenario === 'restore'
      ? '#restoreButton'
      : scenario === 'update' ? '#updateButton' : '#applyButton';
    const trigger = await waitForReady(selector);
    trigger?.click();
    if (!['restore', 'update'].includes(scenario)) return;
    const confirm = await waitForReady('#modalPrimaryButton');
    confirm?.click();
  });
})();`;
}

function workspaceHtml() {
  return String.raw`<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Cavalry UI Review Workspace</title>
  <style>
    :root { color-scheme: light; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif; --space: 4px; --line: #dededb; --surface: #fff; --canvas: #f5f5f3; --text: #1d1d1f; --muted: #6e6e73; }
    * { box-sizing: border-box; }
    html, body { width: 100%; height: 100%; margin: 0; overflow: hidden; }
    body { background: var(--canvas); color: var(--text); }
    button { font: inherit; }
    .workspace { height: 100%; display: grid; grid-template-columns: 208px minmax(0, 1fr); gap: 12px; padding: 12px; }
    .sidebar, .stage { border: 1px solid var(--line); border-radius: 12px; background: var(--surface); }
    .sidebar { min-height: 0; display: flex; flex-direction: column; padding: 12px; overflow: auto; }
    .brand { padding: 8px; }
    .brand strong { display: block; font-size: 14px; font-weight: 500; line-height: 20px; }
    .brand span { display: block; margin-top: 2px; color: var(--muted); font-size: 12px; line-height: 16px; }
    .group { display: grid; gap: 4px; margin-top: 16px; }
    .group-label { padding: 0 8px 4px; color: var(--muted); font-size: 12px; line-height: 16px; }
    .scenario { height: 34px; padding: 0 10px; border: 0; border-radius: 8px; background: transparent; color: var(--muted); text-align: left; cursor: pointer; }
    .scenario:hover { background: #f3f3f1; color: var(--text); }
    .scenario[aria-pressed="true"] { background: #202020; color: #fff; }
    .locales { display: grid; grid-template-columns: repeat(4, 1fr); gap: 2px; padding: 2px; border: 1px solid var(--line); border-radius: 8px; }
    .locales button { height: 26px; padding: 0; border: 0; border-radius: 6px; background: transparent; color: var(--muted); cursor: pointer; }
    .locales button[aria-pressed="true"] { background: #202020; color: #fff; }
    .truth { margin-top: auto; padding: 12px 8px 4px; border-top: 1px solid var(--line); color: var(--muted); font-size: 12px; line-height: 16px; }
    .stage { min-width: 0; display: grid; place-items: center; overflow: hidden; }
    .window { position: relative; width: 400px; height: 484px; overflow: hidden; border: 1px solid #bcbcb9; border-radius: 18px; background: #fff; box-shadow: 0 24px 70px rgba(0,0,0,.18); }
    .window iframe { display: block; width: 400px; height: 484px; border: 0; background: #fff; }
    .lights { position: absolute; z-index: 5; top: 12px; left: 12px; display: flex; gap: 8px; pointer-events: none; }
    .lights i { width: 16px; height: 16px; border-radius: 50%; box-shadow: inset 0 0 0 1px rgba(0,0,0,.13); }
    .lights i:nth-child(1) { background: #ff5f57; } .lights i:nth-child(2) { background: #febc2e; } .lights i:nth-child(3) { background: #28c840; }
    @media (max-width: 760px) { .workspace { grid-template-columns: 64px minmax(0,1fr); padding: 8px; gap: 8px; } .brand, .group-label, .truth, .scenario span { display: none; } .scenario { padding: 0; text-align: center; } }
  </style>
</head>
<body>
  <div class="workspace">
    <aside class="sidebar">
      <div class="brand"><strong>Cavalry UI Review</strong><span>真实 renderer · fixture state</span></div>
      <div class="group">
        <div class="group-label">界面语言</div>
        <div class="locales" id="locales">
          <button data-locale="en">EN</button><button data-locale="zh-Hans">简</button><button data-locale="zh-Hant">繁</button><button data-locale="ja_JP">日</button>
        </div>
      </div>
      <div class="group" id="scenarios">
        <div class="group-label">静态状态</div>
        <button class="scenario" data-scenario="translated"><span>已翻译</span></button>
        <button class="scenario" data-scenario="official"><span>官方英文</span></button>
        <button class="scenario" data-scenario="reinstall"><span>需要重装</span></button>
        <div class="group-label">真实任务界面</div>
        <button class="scenario" data-scenario="switch"><span>Switch 四阶段</span></button>
        <button class="scenario" data-scenario="restore"><span>Restore 四阶段</span></button>
        <button class="scenario" data-scenario="update"><span>Update 三阶段</span></button>
        <button class="scenario" data-scenario="error"><span>错误打断</span></button>
      </div>
      <div class="truth">界面、组件与生产同源。<br />只有状态、事件和时序为 fixture。</div>
    </aside>
    <main class="stage">
      <div class="window">
        <div class="lights" aria-hidden="true"><i></i><i></i><i></i></div>
        <iframe id="reviewFrame" title="Cavalry 真实 renderer 审查"></iframe>
      </div>
    </main>
  </div>
  <script>
    const frame = document.querySelector('#reviewFrame');
    const scenarioButtons = [...document.querySelectorAll('[data-scenario]')];
    const localeButtons = [...document.querySelectorAll('[data-locale]')];
    let scenario = 'translated';
    let locale = localStorage.getItem('cavalry-review-locale') || 'zh-Hans';
    const revisionPollInterval = 600;
    let revision = '';
    function load() {
      frame.src = '/app?scenario=' + encodeURIComponent(scenario) + '&locale=' + encodeURIComponent(locale);
      scenarioButtons.forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.scenario === scenario)));
      localeButtons.forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.locale === locale)));
    }
    scenarioButtons.forEach((button) => button.addEventListener('click', () => { scenario = button.dataset.scenario; load(); }));
    localeButtons.forEach((button) => button.addEventListener('click', () => { locale = button.dataset.locale; localStorage.setItem('cavalry-review-locale', locale); load(); }));
    async function pollRevision() {
      try {
        const next = await fetch('/revision', { cache: 'no-store' }).then((response) => response.text());
        if (revision && next !== revision) frame.contentWindow.location.reload();
        revision = next;
      } catch (_) {}
    }
    load();
    setInterval(pollRevision, revisionPollInterval);
    pollRevision();
  </script>
</body>
</html>`;
}

function rendererRevision() {
  return fs.readdirSync(rendererRoot)
    .filter((name) => /\.(?:css|html|js)$/.test(name))
    .map((name) => fs.statSync(path.join(rendererRoot, name)).mtimeMs)
    .reduce((latest, mtime) => Math.max(latest, mtime), 0)
    .toString(36);
}

function send(response, status, type, body) {
  response.writeHead(status, {
    'Cache-Control': 'no-store',
    'Content-Type': type,
    'X-Content-Type-Options': 'nosniff',
  });
  response.end(body);
}

function serveRenderer(pathname, response) {
  let relative;
  try {
    relative = decodeURIComponent(pathname.slice('/renderer/'.length));
  } catch (_) {
    send(response, 400, 'text/plain; charset=utf-8', 'Bad path');
    return;
  }
  const target = path.resolve(rendererRoot, relative);
  if (!target.startsWith(rendererRoot + path.sep) || !fs.existsSync(target) || !fs.statSync(target).isFile()) {
    send(response, 404, 'text/plain; charset=utf-8', 'Not found');
    return;
  }
  const type = mimeByExtension[path.extname(target)] || 'application/octet-stream';
  send(response, 200, type, fs.readFileSync(target));
}

function createUiReviewServer() {
  return http.createServer((request, response) => {
    if (!['GET', 'HEAD'].includes(request.method)) {
      send(response, 405, 'text/plain; charset=utf-8', 'Method not allowed');
      return;
    }
    const url = new URL(request.url, `http://${host}`);
    if (url.pathname === '/' || url.pathname === '/index.html') {
      send(response, 200, 'text/html; charset=utf-8', workspaceHtml());
    } else if (url.pathname === '/app') {
      send(response, 200, 'text/html; charset=utf-8', renderReviewDocument());
    } else if (url.pathname === '/fixture.js') {
      send(response, 200, 'text/javascript; charset=utf-8', fixtureSource());
    } else if (url.pathname === '/revision') {
      send(response, 200, 'text/plain; charset=utf-8', rendererRevision());
    } else if (url.pathname.startsWith('/renderer/')) {
      serveRenderer(url.pathname, response);
    } else {
      send(response, 404, 'text/plain; charset=utf-8', 'Not found');
    }
  });
}

function parsePort(argv) {
  const index = argv.indexOf('--port');
  if (index === -1) return defaultPort;
  const value = Number.parseInt(argv[index + 1], 10);
  if (!Number.isInteger(value) || value < 1 || value > 65535) throw new Error('Invalid --port');
  return value;
}

if (require.main === module) {
  const port = parsePort(process.argv.slice(2));
  createUiReviewServer().listen(port, host, () => {
    process.stdout.write(`Cavalry UI Review: http://${host}:${port}/\n`);
  });
}

module.exports = Object.freeze({ createUiReviewServer, fixtureSource, renderReviewDocument, workspaceHtml });
