#!/usr/bin/env node
/**
 * [INPUT]: 依赖 renderer/index.html/about.html 与 renderer 下真实 CSS/JS，依赖 ui_review_workspace/handoff/catalogs 审查模块，以及 Node http/fs/path/os；仅以 localhost query 选择受控 fixture 状态，并从系统临时目录或 CAVALRY_UI_REVIEW_REFERENCE_ROOT 指定目录只读展示本机参考截图。
 * [OUTPUT]: 对外提供 createUiReviewServer/renderReviewDocument，并在 CLI 模式启动包含主界面、About、反馈/图标/徽章目录、权限 handoff 原型及安装/版本兼容/成功/阻塞/警告/失败状态矩阵的 UI Review；每次请求重读 renderer 并失效审查模块缓存，revision 同时覆盖两类源码，只在 bridge 前注入 fake API；两个固定 local-reference 路由缺图即 404，浏览器默认 favicon 请求静默返回空响应。
 * [POS]: tools 的本地 UI 审查编排入口；生产界面与组件资产保持同源，/handoff 只提供真实 renderer iframe、匿名 native mock、运行时 DOM clone 与不入库的本机视觉参考，不进入 Tauri bundle、不伪造 native/package 证据。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');
const rendererRoot = path.join(repoRoot, 'renderer');
const reviewModuleRequests = Object.freeze([
  './ui_review_permission_handoff_runtime',
  './ui_review_permission_handoff',
  './ui_review_workspace',
  './ui_review_catalogs',
]);
const reviewSourcePaths = Object.freeze(reviewModuleRequests.map((request) => require.resolve(request)));
const defaultPort = 4319;
const host = '127.0.0.1';
const localReferenceRoot = path.resolve(
  process.env.CAVALRY_UI_REVIEW_REFERENCE_ROOT
    || path.join(os.tmpdir(), 'cavalry-i18n-ui-review')
);
const localReferenceAssets = Object.freeze({
  '/local-reference/hint-arrow.png': path.join(localReferenceRoot, 'hint-arrow.png'),
  '/local-reference/system-settings.png': path.join(localReferenceRoot, 'system-settings.png'),
});
const mimeByExtension = Object.freeze({
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.png': 'image/png',
});

function loadReviewModules() {
  for (const request of reviewModuleRequests) delete require.cache[require.resolve(request)];
  return Object.freeze({
    ...require('./ui_review_workspace'),
    ...require('./ui_review_catalogs'),
  });
}

function workspaceHtml(...args) {
  return loadReviewModules().workspaceHtml(...args);
}

function permissionHandoffHtml(...args) {
  return loadReviewModules().permissionHandoffHtml(...args);
}

function badgeCatalogHtml(...args) {
  return loadReviewModules().badgeCatalogHtml(...args);
}

function feedbackCatalogHtml(...args) {
  return loadReviewModules().feedbackCatalogHtml(...args);
}

function iconCatalogHtml(...args) {
  return loadReviewModules().iconCatalogHtml(...args);
}

function renderReviewDocument(documentName = 'index.html') {
  if (!['index.html', 'about.html'].includes(documentName)) throw new Error('unsupported review document');
  const html = fs.readFileSync(path.join(rendererRoot, documentName), 'utf8');
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
  const windowsScenario = ['windowsClean', 'permissionWindows', 'aboutOpenToast'].includes(scenario);
  const permissionScenario = ['permissionMac', 'permissionWindows'].includes(scenario);
  const permissionReviewMessage = 'cavalry-ui-review:permission-retry';
  const permissionReviewSettledMessage = 'cavalry-ui-review:permission-retry-settled';
  let permissionReviewOutcome = null;
  let currentLang = ['translated', 'managedLegacy', 'restore', 'restoreConfirm', 'reinstall'].includes(scenario) ? 'zh-Hans' : 'en';
  const wait = (duration) => new Promise((resolve) => setTimeout(resolve, duration));
  const success = () => ({
    ok: true, count: 1, currentLang, warning: null, warningCode: null,
    warningCodes: [], permissionRequired: false, reconciliationRequired: false,
    error: null, errorCode: null,
  });
  const status = () => ({
    appManagementGranted: scenario === 'notFound' ? null : permissionScenario ? false : true,
    appPath: scenario === 'notFound'
      ? ''
      : windowsScenario ? 'C:\\Program Files\\Cavalry\\Cavalry.exe' : '/Applications/Cavalry.app',
    currentLang,
    installationMode: windowsScenario
      ? 'unknown'
      : scenario === 'startupRecovery'
        ? 'recoveryRequired'
        : scenario === 'reinstall'
          ? 'modifiedOrUnverified'
          : scenario === 'managedLegacy'
            ? 'managedLegacy'
          : currentLang === 'en' ? 'official' : 'modifiedOrUnverified',
    officialRecoveryAvailable: scenario !== 'managedLegacy',
    startupRecoveryError: scenario === 'startupRecovery' ? 'fixture-private-error' : null,
    defaultAppCandidates: ['/Applications/Cavalry.app'],
    languages,
    needsExtract: scenario === 'reinstall',
    permissionAction: scenario === 'permissionWindows' ? 'requestElevation' : scenario === 'permissionMac' ? 'openPrivacy' : 'none',
    platform: windowsScenario ? 'windows' : 'macos',
    reconciliationRequired: false,
    supportedVersion: '2.7.2',
    version: scenario === 'olderVersion' ? '2.7.1' : scenario === 'newerVersion' ? '2.7.3' : '2.7.2',
    versionCompatibility: scenario === 'olderVersion'
      ? 'olderUnsupported'
      : scenario === 'newerVersion' ? 'newerUnsupported' : 'supported',
  });

  window.cavalryI18n = Object.freeze({
    getStatus: async () => status(),
    browseApp: async () => ({ canceled: false, appPath: status().appPath, version: '2.7.2' }),
    applyLanguage: async (_appPath, language, onEvent = () => {}) => {
      const reviewOutcome = permissionReviewOutcome;
      permissionReviewOutcome = null;
      const phases = ['verifyInstallation', 'ensureBaseline', 'applyTransaction', 'restartCavalry'];
      for (const phase of phases) {
        onEvent({ phase, state: 'running' });
        await wait(timing.phase);
        if (permissionScenario && reviewOutcome === 'error' && phase === 'verifyInstallation') {
          onEvent({ phase, state: 'error' });
          window.parent.postMessage({ type: permissionReviewSettledMessage, result: 'error' }, location.origin);
          return { ...success(), ok: false, errorCode: 'cavalryStillRunning' };
        }
        if (permissionScenario && reviewOutcome !== 'success' && phase === 'applyTransaction') {
          onEvent({ phase, state: 'error' });
          if (reviewOutcome === 'denied') {
            window.parent.postMessage({ type: permissionReviewSettledMessage, result: 'denied' }, location.origin);
          }
          return { ...success(), ok: false, permissionRequired: true, errorCode: 'permissionRequired' };
        }
        if (scenario === 'error' && phase === 'verifyInstallation') {
          onEvent({ phase, state: 'error' });
          return { ...success(), ok: false, errorCode: 'cavalryStillRunning' };
        }
        onEvent({ phase, state: 'completed' });
      }
      currentLang = language === 'restore-official' ? 'en' : language;
      if (permissionScenario && reviewOutcome === 'success') {
        window.parent.postMessage({ type: permissionReviewSettledMessage, result: 'success' }, location.origin);
      }
      return scenario === 'warning'
        ? { ...success(), warningCode: 'restartFailed', warningCodes: ['restartFailed'] }
        : success();
    },
    openPrivacySecurity: async () => success(),
    openProjectLink: async () => scenario === 'aboutLinkToast' ? { ...success(), ok: false } : success(),
    showAbout: async () => scenario === 'aboutOpenToast' ? { ...success(), ok: false } : success(),
    getSwitcherVersion: async () => {
      if (scenario === 'aboutVersionFailure') throw new Error('fixture version failure');
      return '0.7.0';
    },
    checkUpdate: async () => ['updateAvailable', 'updateConfirm', 'update', 'updateFailure'].includes(scenario)
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
      if (scenario === 'updateFailure') {
        return { currentVersion: '0.7.0', version: '0.7.1', notes: null, pubDate: null, available: true, errorCode: 'updateInstallFailed' };
      }
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

  window.addEventListener('message', async (event) => {
    if (event.origin !== location.origin || event.source !== window.parent) return;
    if (scenario !== 'permissionMac' || event.data?.type !== permissionReviewMessage) return;
    if (!['success', 'denied', 'error'].includes(event.data.result)) return;
    permissionReviewOutcome = event.data.result;
    document.querySelector('#modalBackdrop')?.close();
    (await waitForReady('#applyButton'))?.click();
  });

  window.addEventListener('load', async () => {
    if (scenario === 'aboutLinkToast') {
      (await waitForReady('#aboutRepositoryLink'))?.click();
      return;
    }
    const actionSelectors = Object.freeze({
      switch: '#applyButton', warning: '#applyButton', error: '#applyButton',
      restore: '#restoreButton', restoreConfirm: '#restoreButton',
      update: '#updateButton', updateConfirm: '#updateButton', updateFailure: '#updateButton',
      permissionMac: '#applyButton', permissionWindows: '#applyButton',
      aboutOpenToast: '#aboutButton',
    });
    const selector = actionSelectors[scenario];
    if (!selector) return;
    if (selector === '#applyButton') {
      (await waitForReady('#languageSelectTrigger'))?.click();
      (await waitForReady('#languageSelectOption-0'))?.click();
    }
    const trigger = await waitForReady(selector);
    trigger?.click();
    if (!['restore', 'update', 'updateFailure'].includes(scenario)) return;
    const confirm = await waitForReady('#modalPrimaryButton');
    confirm?.click();
  });
})();`;
}

function reviewRevision() {
  const rendererSources = fs.readdirSync(rendererRoot)
    .filter((name) => /\.(?:css|html|js)$/.test(name))
    .map((name) => path.join(rendererRoot, name));
  return [...rendererSources, ...reviewSourcePaths]
    .map((source) => fs.statSync(source).mtimeMs)
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

function serveLocalReference(pathname, response) {
  const target = localReferenceAssets[pathname];
  if (!target || !fs.existsSync(target) || !fs.statSync(target).isFile()) {
    send(response, 404, 'text/plain; charset=utf-8', 'Local reference unavailable');
    return;
  }
  send(response, 200, 'image/png', fs.readFileSync(target));
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
    } else if (url.pathname === '/handoff') {
      send(response, 200, 'text/html; charset=utf-8', permissionHandoffHtml());
    } else if (url.pathname === '/app') {
      send(response, 200, 'text/html; charset=utf-8', renderReviewDocument());
    } else if (url.pathname === '/about') {
      send(response, 200, 'text/html; charset=utf-8', renderReviewDocument('about.html'));
    } else if (url.pathname === '/catalog/feedback') {
      send(response, 200, 'text/html; charset=utf-8', feedbackCatalogHtml());
    } else if (url.pathname === '/catalog/icons') {
      send(response, 200, 'text/html; charset=utf-8', iconCatalogHtml());
    } else if (url.pathname === '/catalog/badges') {
      send(response, 200, 'text/html; charset=utf-8', badgeCatalogHtml());
    } else if (url.pathname === '/fixture.js') {
      send(response, 200, 'text/javascript; charset=utf-8', fixtureSource());
    } else if (url.pathname === '/revision') {
      send(response, 200, 'text/plain; charset=utf-8', reviewRevision());
    } else if (url.pathname === '/favicon.ico') {
      send(response, 204, 'image/x-icon', '');
    } else if (url.pathname.startsWith('/local-reference/')) {
      serveLocalReference(url.pathname, response);
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

module.exports = Object.freeze({ createUiReviewServer, fixtureSource, permissionHandoffHtml, renderReviewDocument, workspaceHtml });
