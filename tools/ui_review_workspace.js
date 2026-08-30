/**
 * [INPUT]: 依赖 UI Review server 暴露的真实主窗口/About 页面、安装/版本兼容/成功/阻塞/警告/失败 fixture 矩阵、feedback/icons/badges 目录与权限 handoff 页面，依赖 renderer 的 tokens/Button/语义图标/应用标识，依赖 localhost query 传递 locale/scenario。
 * [OUTPUT]: 对外提供 workspaceHtml 与 permissionHandoffHtml；以单一侧栏在生产界面、三类审查总览和 macOS 权限交接原型间切换，生产源仍通过真实 renderer iframe 读取，原型到达目标后只提示用户继续授权而不伪造 Granted 状态。
 * [POS]: tools UI Review 的工作台与 clean-room 动画舞台；handoff 只模拟系统设置目标，proxy 在正反向开始时捕获真实权限动作与目标 row、递归复制 computed style，并以 duration/response 0.72、临界阻尼、距离比例 lift 和 Reduce Motion 保持可审计边界，不维护静态源图或第二套设计 token。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

function workspaceHtml() {
  return String.raw`<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <link rel="icon" href="data:," />
  <title>Cavalry UI Review Workspace</title>
  <style>
    :root { color-scheme: light; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif; --line: #dededb; --surface: #fff; --canvas: #f5f5f3; --text: #1d1d1f; --muted: #6e6e73; --review-handoff-window-width: 1120px; --review-handoff-window-height: 840px; --review-handoff-window-radius: 18px; }
    * { box-sizing: border-box; }
    html, body { width: 100%; height: 100%; margin: 0; overflow: hidden; }
    body { background: var(--canvas); color: var(--text); }
    button { font: inherit; }
    .workspace { height: 100%; display: grid; grid-template-columns: 220px minmax(0, 1fr); gap: 12px; padding: 12px; }
    .sidebar, .stage { border: 1px solid var(--line); border-radius: 12px; background: var(--surface); }
    .sidebar { min-height: 0; display: flex; flex-direction: column; padding: 12px; overflow: auto; }
    .brand { padding: 8px; }
    .brand strong { display: block; font-size: 14px; font-weight: 500; line-height: 20px; }
    .brand span { display: block; margin-top: 2px; color: var(--muted); font-size: 12px; line-height: 16px; }
    .group { display: grid; gap: 4px; margin-top: 16px; }
    .group[hidden] { display: none; }
    .group-label { padding: 0 8px 4px; color: var(--muted); font-size: 12px; line-height: 16px; }
    .review-tab, .scenario { min-height: 34px; padding: 0 10px; border: 0; border-radius: 8px; background: transparent; color: var(--muted); text-align: left; cursor: pointer; }
    .review-tab:hover, .scenario:hover { background: #f3f3f1; color: var(--text); }
    .review-tab[aria-selected="true"], .scenario[aria-pressed="true"] { background: #202020; color: #fff; }
    .locales { display: grid; grid-template-columns: repeat(4, 1fr); gap: 2px; padding: 2px; border: 1px solid var(--line); border-radius: 8px; }
    .locales button { height: 26px; padding: 0; border: 0; border-radius: 6px; background: transparent; color: var(--muted); cursor: pointer; }
    .locales button[aria-pressed="true"] { background: #202020; color: #fff; }
    .truth { margin-top: auto; padding: 12px 8px 4px; border-top: 1px solid var(--line); color: var(--muted); font-size: 12px; line-height: 16px; }
    .stage { min-width: 0; display: grid; place-items: center; overflow: hidden; }
    .window { position: relative; width: 400px; height: 484px; overflow: hidden; border: 1px solid #bcbcb9; border-radius: 18px; background: #fff; box-shadow: 0 24px 70px rgba(0,0,0,.18); transition: width 160ms ease, height 160ms ease, border-radius 160ms ease; }
    .window iframe { display: block; width: 100%; height: 100%; border: 0; background: #fff; }
    .lights { position: absolute; z-index: 5; top: 12px; left: 12px; display: flex; gap: 8px; pointer-events: none; }
    .lights i { width: 16px; height: 16px; border-radius: 50%; box-shadow: inset 0 0 0 1px rgba(0,0,0,.13); }
    .lights i:nth-child(1) { background: #ff5f57; } .lights i:nth-child(2) { background: #febc2e; } .lights i:nth-child(3) { background: #28c840; }
    .window[data-surface="about"] { width: 320px; height: 328px; border-radius: 12px; }
    .window[data-surface="about"] iframe { height: 300px; margin-top: 28px; }
    .window[data-surface="about"]::before { content: "About Cavalry Language Switcher"; position: absolute; z-index: 4; inset: 0 0 auto; height: 28px; display: grid; place-items: center; border-bottom: 1px solid var(--line); background: #f7f7f7; font-size: 11px; line-height: 16px; }
    .window[data-surface="about"] .lights { top: 8px; left: 8px; gap: 6px; }
    .window[data-surface="about"] .lights i { width: 12px; height: 12px; }
    .window[data-surface="handoff"] { width: min(var(--review-handoff-window-width), 100%); height: min(var(--review-handoff-window-height), 100%); border-radius: var(--review-handoff-window-radius); }
    .window[data-surface="handoff"] iframe { height: 100%; }
    .window[data-surface="handoff"] .lights { display: none; }
    .window[data-platform="windows"] { border-radius: 8px; }
    .window[data-platform="windows"] .lights { display: none; }
    .stage[data-kind="catalog"] { display: block; padding: 0; }
    .stage[data-kind="catalog"] .window { width: 100%; height: 100%; border: 0; border-radius: 12px; box-shadow: none; }
    .stage[data-kind="catalog"] .lights { display: none; }
    @media (max-width: 760px) { .workspace { grid-template-columns: 64px minmax(0,1fr); padding: 8px; gap: 8px; } .brand, .group-label, .truth, .review-tab span, .scenario span { display: none; } .review-tab, .scenario { padding: 0; text-align: center; } }
  </style>
</head>
<body>
  <div class="workspace">
    <aside class="sidebar">
      <div class="brand"><strong>Cavalry UI Review</strong><span>生产源码 · fixture 状态 · 集中审查</span></div>
      <div class="group">
        <div class="group-label">界面语言</div>
        <div class="locales" id="locales">
          <button data-locale="en">EN</button><button data-locale="zh-Hans">简</button><button data-locale="zh-Hant">繁</button><button data-locale="ja_JP">日</button>
        </div>
      </div>
      <nav class="group" id="reviewTabs" aria-label="审查页面">
        <div class="group-label">审查页面</div>
        <button class="review-tab" data-view="app"><span>实时界面</span></button>
        <button class="review-tab" data-view="handoff"><span>权限 handoff</span></button>
        <button class="review-tab" data-view="feedback"><span>反馈语义与四语</span></button>
        <button class="review-tab" data-view="icons"><span>语义图标</span></button>
        <button class="review-tab" data-view="badges"><span>徽章状态</span></button>
      </nav>
      <div class="group" id="scenarios">
        <div class="group-label">安装与入口</div>
        <button class="scenario" data-scenario="notFound"><span>未找到 Cavalry</span></button>
        <button class="scenario" data-scenario="translated"><span>已翻译</span></button>
        <button class="scenario" data-scenario="official"><span>官方英文</span></button>
        <button class="scenario" data-scenario="managedLegacy"><span>旧版受管安装</span></button>
        <button class="scenario" data-scenario="olderVersion"><span>旧版 Cavalry</span></button>
        <button class="scenario" data-scenario="newerVersion"><span>新版 Cavalry</span></button>
        <button class="scenario" data-scenario="windowsClean"><span>Windows clean</span></button>
        <button class="scenario" data-scenario="reinstall"><span>需要重装</span></button>
        <button class="scenario" data-scenario="startupRecovery"><span>启动恢复失败</span></button>
        <button class="scenario" data-scenario="updateAvailable"><span>更新可用 · Tooltip</span></button>
        <div class="group-label">AlertDialog / Toast</div>
        <button class="scenario" data-scenario="restoreConfirm"><span>Restore English 确认</span></button>
        <button class="scenario" data-scenario="updateConfirm"><span>Update 确认</span></button>
        <button class="scenario" data-scenario="permissionMac"><span>macOS 权限确认</span></button>
        <button class="scenario" data-scenario="permissionWindows"><span>Windows 管理员确认</span></button>
        <button class="scenario" data-scenario="aboutOpenToast"><span>主窗口 About Toast</span></button>
        <div class="group-label">真实任务界面</div>
        <button class="scenario" data-scenario="switch"><span>Switch 四阶段</span></button>
        <button class="scenario" data-scenario="restore"><span>Restore English 四阶段</span></button>
        <button class="scenario" data-scenario="update"><span>Update 三阶段</span></button>
        <button class="scenario" data-scenario="updateFailure"><span>Update 安装失败</span></button>
        <button class="scenario" data-scenario="warning"><span>完成但需处理</span></button>
        <button class="scenario" data-scenario="error"><span>错误立即打断</span></button>
        <div class="group-label">独立 About 页面</div>
        <button class="scenario" data-scenario="aboutPage"><span>About</span></button>
        <button class="scenario" data-scenario="aboutVersionFailure"><span>About 版本读取失败</span></button>
        <button class="scenario" data-scenario="aboutLinkToast"><span>About 外链 Toast</span></button>
      </div>
      <div class="truth">产品 DOM/CSS/文案/图标均从当前 renderer 读取。<br />工作台只拥有导航、fixture 与审查目录布局。</div>
    </aside>
    <main class="stage" id="stage" data-kind="app">
      <div class="window" id="window" data-surface="main">
        <div class="lights" aria-hidden="true"><i></i><i></i><i></i></div>
        <iframe id="reviewFrame" title="Cavalry 当前生产界面审查"></iframe>
      </div>
    </main>
  </div>
  <script>
    const frame = document.querySelector('#reviewFrame');
    const stage = document.querySelector('#stage');
    const windowFrame = document.querySelector('#window');
    const scenarios = document.querySelector('#scenarios');
    const viewButtons = [...document.querySelectorAll('[data-view]')];
    const scenarioButtons = [...document.querySelectorAll('[data-scenario]')];
    const localeButtons = [...document.querySelectorAll('[data-locale]')];
    const catalogs = Object.freeze({ feedback: '/catalog/feedback', icons: '/catalog/icons', badges: '/catalog/badges' });
    const reviewPages = Object.freeze({ handoff: '/handoff' });
    const aboutScenarios = new Set(['aboutPage', 'aboutVersionFailure', 'aboutLinkToast']);
    const windowsScenarios = new Set(['windowsClean', 'permissionWindows']);
    let view = 'app';
    let scenario = 'translated';
    let locale = localStorage.getItem('cavalry-review-locale') || 'zh-Hans';
    let revision = '';

    function load() {
      const catalog = catalogs[view];
      const reviewPage = reviewPages[view];
      const isHandoff = Boolean(reviewPage);
      const surface = aboutScenarios.has(scenario) ? 'about' : 'main';
      stage.dataset.kind = isHandoff ? 'handoff' : catalog ? 'catalog' : 'app';
      windowFrame.dataset.surface = isHandoff ? 'handoff' : catalog ? 'catalog' : surface;
      windowFrame.dataset.platform = windowsScenarios.has(scenario) ? 'windows' : 'macos';
      if (isHandoff) windowFrame.dataset.platform = 'macos';
      scenarios.hidden = Boolean(catalog || isHandoff);
      frame.src = reviewPage
        ? reviewPage + '?locale=' + encodeURIComponent(locale)
        : catalog
        ? catalog + '?locale=' + encodeURIComponent(locale)
        : (surface === 'about' ? '/about' : '/app') + '?scenario=' + encodeURIComponent(scenario) + '&locale=' + encodeURIComponent(locale);
      viewButtons.forEach((button) => button.setAttribute('aria-selected', String(button.dataset.view === view)));
      scenarioButtons.forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.scenario === scenario)));
      localeButtons.forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.locale === locale)));
      history.replaceState(null, '', '#' + (view === 'app' ? 'app/' + scenario : view));
    }

    viewButtons.forEach((button) => button.addEventListener('click', () => { view = button.dataset.view; load(); }));
    scenarioButtons.forEach((button) => button.addEventListener('click', () => { view = 'app'; scenario = button.dataset.scenario; load(); }));
    localeButtons.forEach((button) => button.addEventListener('click', () => { locale = button.dataset.locale; localStorage.setItem('cavalry-review-locale', locale); load(); }));
    async function pollRevision() {
      try {
        const next = await fetch('/revision', { cache: 'no-store' }).then((response) => response.text());
        if (revision && next !== revision) frame.contentWindow.location.reload();
        revision = next;
      } catch (_) {}
    }
    const requested = location.hash.slice(1);
    if (requested.startsWith('app/')) scenario = requested.slice(4) || scenario;
    else if (catalogs[requested] || reviewPages[requested]) view = requested;
    load();
    setInterval(pollRevision, 600);
    pollRevision();
  </script>
</body>
</html>`;
}

function permissionHandoffHtml() {
  return String.raw`<!doctype html>
<html class="handoff-document" lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <link rel="icon" href="data:," />
  <link rel="stylesheet" href="/renderer/tokens.css" />
  <link rel="stylesheet" href="/renderer/button.css" />
  <link rel="stylesheet" href="/renderer/styles.css" />
  <script src="/renderer/icons.js"></script>
  <title>macOS 权限 handoff UI Review</title>
  <style>
    :root {
      color-scheme: light;
      font-family: var(--font-sans);
      --handoff-stage-gap: var(--space-6);
      --handoff-stage-min-height: 540px;
      --handoff-source-viewport-width: 400px;
      --handoff-source-viewport-height: 484px;
      --handoff-target-viewport-width: 360px;
      --handoff-target-viewport-height: 484px;
    }
    *, *::before, *::after { box-sizing: border-box; }
    html, body { min-width: 100%; min-height: 100%; margin: 0; }
    body { overflow: auto; background: var(--surface); color: var(--text); }
    button, input { font: inherit; }
    button { cursor: pointer; }
    button:disabled { cursor: default; }
    .handoff-shell { min-height: 100%; display: grid; grid-template-rows: auto minmax(0, 1fr) auto auto auto; gap: var(--space-4); padding: var(--space-6); }
    .handoff-header { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--space-6); }
    .handoff-eyebrow { margin: 0 0 var(--space-1); color: var(--tone-update); font-size: var(--type-label); font-weight: var(--weight-medium); }
    h1 { margin: 0; font-size: var(--type-heading); font-weight: var(--weight-heading); line-height: var(--line-height-heading); }
    .handoff-lede { max-width: 720px; margin: var(--space-2) 0 0; color: var(--text-secondary); font-size: var(--type-compact); line-height: var(--line-height-compact); }
    .handoff-phase { flex: 0 0 auto; min-height: var(--control-height); padding: 0 var(--padding-control-inline); display: inline-flex; align-items: center; border: var(--stroke-hairline) solid var(--border-strong); border-radius: var(--radius-pill); color: var(--text-secondary); font-size: var(--type-label); font-weight: var(--weight-medium); white-space: nowrap; }
    .handoff-phase[data-phase="presented"] { border-color: var(--tone-update); background: var(--tone-update-surface); color: var(--tone-update); }
    .handoff-phase[data-phase="preparing"], .handoff-phase[data-phase="presenting"], .handoff-phase[data-phase="reversing"] { border-color: var(--border-control-hover); color: var(--text-secondary); }
    .handoff-stage { position: relative; min-height: var(--handoff-stage-min-height); display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: var(--handoff-stage-gap); }
    .handoff-pane { min-width: 0; display: flex; flex-direction: column; gap: var(--space-2); }
    .handoff-pane-heading { display: flex; align-items: center; justify-content: space-between; gap: var(--space-2); min-height: var(--line-height-label); }
    .handoff-pane-title { color: var(--text-secondary); font-size: var(--type-label); font-weight: var(--weight-medium); }
    .handoff-source-note, .handoff-native-note { color: var(--text-secondary); font-size: var(--type-label); line-height: var(--line-height-label); }
    .handoff-native-note { color: var(--tone-update); }
    .handoff-source-frame-wrap, .handoff-settings-window { min-width: 0; min-height: 0; border: var(--stroke-hairline) solid var(--border); border-radius: var(--radius-lg); background: var(--surface-raised); box-shadow: var(--shadow-dialog); }
    .handoff-source-frame-wrap { position: relative; flex: 1 1 auto; display: grid; place-items: center; padding: var(--padding-dialog); overflow: hidden; }
    #sourceFrame { display: block; inline-size: min(100%, var(--handoff-source-viewport-width)); block-size: min(100%, var(--handoff-source-viewport-height)); border: var(--stroke-hairline) solid var(--border-strong); border-radius: var(--radius-dialog); background: var(--window); box-shadow: var(--shadow-control); }
    .handoff-settings-window { inline-size: min(100%, var(--handoff-target-viewport-width)); block-size: min(100%, var(--handoff-target-viewport-height)); align-self: center; overflow: hidden; }
    .handoff-settings-titlebar { min-height: var(--control-height); display: flex; align-items: center; gap: var(--gap-inline); padding: 0 var(--padding-dialog); border-bottom: var(--stroke-hairline) solid var(--border); background: var(--surface); font-size: var(--type-label); font-weight: var(--weight-medium); }
    .handoff-settings-dot { inline-size: var(--space-2); block-size: var(--space-2); border-radius: var(--radius-circle); background: var(--border-strong); }
    .handoff-settings-content { display: flex; flex-direction: column; gap: var(--gap-section); padding: var(--space-6); }
    .handoff-settings-kicker { margin: 0; color: var(--text-secondary); font-size: var(--type-label); line-height: var(--line-height-label); }
    .handoff-settings-heading { margin: 0; font-size: var(--type-heading); font-weight: var(--weight-heading); line-height: var(--line-height-heading); }
    .handoff-target-row { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: var(--gap-inline); min-height: calc(var(--control-height) + var(--space-6)); padding: var(--padding-panel); border: var(--stroke-hairline) solid var(--border); border-radius: var(--radius-md); background: var(--surface-raised); transition: border-color var(--duration-feedback) ease, background-color var(--duration-feedback) ease; }
    .handoff-target-row[data-reached="true"] { border-color: var(--border-control-focus); background: var(--surface-hover); }
    .handoff-target-app-icon { inline-size: var(--space-6); block-size: var(--space-6); display: block; object-fit: contain; }
    .handoff-target-copy { min-width: 0; display: flex; flex-direction: column; gap: var(--gap-meta-stack); font-size: var(--type-compact); line-height: var(--line-height-compact); }
    .handoff-target-copy strong { font-weight: var(--weight-medium); }
    .handoff-target-copy span { color: var(--text-secondary); font-size: var(--type-label); line-height: var(--line-height-label); }
    .handoff-target-switch { inline-size: var(--space-8); block-size: var(--badge-height); border-radius: var(--radius-pill); background: var(--border-strong); }
    .handoff-accessory { display: flex; align-items: center; gap: var(--gap-inline); padding: var(--padding-panel); border: var(--stroke-hairline) solid var(--border-strong); border-radius: var(--radius-lg); background: var(--surface-raised); }
    .handoff-accessory-mark { inline-size: var(--space-6); block-size: var(--space-6); display: grid; place-items: center; color: var(--text-secondary); }
    .handoff-accessory-mark svg { inline-size: var(--space-4); block-size: var(--space-4); display: block; }
    .handoff-accessory-copy { min-width: 0; flex: 1 1 auto; display: flex; flex-direction: column; gap: var(--gap-meta-stack); font-size: var(--type-compact); line-height: var(--line-height-compact); }
    .handoff-accessory-copy strong { font-weight: var(--weight-medium); }
    .handoff-accessory-copy span { color: var(--text-secondary); font-size: var(--type-label); line-height: var(--line-height-label); }
    .handoff-proxy-layer { position: absolute; inset: 0; z-index: var(--z-toast); pointer-events: none; overflow: hidden; }
    .handoff-proxy { position: absolute; inset: 0 auto auto 0; overflow: hidden; border-radius: inherit; box-shadow: var(--shadow-control); transform-origin: center; will-change: transform, width, height; }
    .handoff-proxy-slot { position: absolute; inset: 0; overflow: hidden; border-radius: inherit; transform-origin: center; will-change: opacity, transform; }
    .handoff-proxy[data-motion="reduced"] { transition: opacity var(--duration-feedback) ease; }
    .handoff-controls { display: flex; align-items: center; gap: var(--gap-control); }
    .handoff-control-button { min-inline-size: max-content; }
    .handoff-motion-control { min-width: 0; margin-inline-start: auto; display: flex; align-items: center; justify-content: flex-end; gap: var(--gap-inline); color: var(--text-secondary); font-size: var(--type-label); }
    .handoff-motion-control label { display: inline-flex; align-items: center; gap: var(--space-1); white-space: nowrap; }
    .handoff-inspector { display: flex; flex-wrap: wrap; justify-content: space-between; gap: var(--space-2) var(--space-6); min-height: var(--line-height-label); color: var(--text-secondary); font-size: var(--type-label); line-height: var(--line-height-label); }
    .handoff-footer { display: flex; justify-content: space-between; gap: var(--space-4); color: var(--text-secondary); font-size: var(--type-label); line-height: var(--line-height-label); }
    .handoff-footer strong { color: var(--text); font-weight: var(--weight-medium); }
    @media (max-width: 900px) {
      .handoff-shell { padding: var(--space-4); }
      .handoff-stage { grid-template-columns: 1fr; min-height: 0; }
      .handoff-source-frame-wrap { min-height: var(--handoff-source-viewport-height); }
      .handoff-settings-window { min-height: var(--handoff-target-viewport-height); }
      .handoff-proxy-layer { display: none; }
      .handoff-controls { flex-wrap: wrap; }
      .handoff-motion-control { inline-size: 100%; margin-inline-start: 0; justify-content: flex-start; }
    }
  </style>
</head>
<body>
  <main class="handoff-shell">
    <header class="handoff-header">
      <div>
        <p class="handoff-eyebrow">权限交接原型 · clean-room UI Review</p>
        <h1>macOS App Management 权限交接动画</h1>
        <p class="handoff-lede">左侧是实时生产 renderer iframe；右侧只模拟系统设置目标。中间 proxy 只表达源/目标几何与视觉层 morph，不复制生产权限 Dialog。</p>
      </div>
      <output id="phaseLabel" class="handoff-phase" data-phase="idle" aria-live="polite">待命</output>
    </header>

    <section id="handoffStage" class="handoff-stage" aria-label="权限交接动画舞台">
      <article class="handoff-pane">
        <div class="handoff-pane-heading">
          <span class="handoff-pane-title">Live source · production renderer</span>
          <span id="sourceState" class="handoff-source-note">等待真实源布局</span>
        </div>
        <div class="handoff-source-frame-wrap">
          <iframe id="sourceFrame" title="真实生产 renderer 权限场景"></iframe>
        </div>
      </article>

      <article class="handoff-pane">
        <div class="handoff-pane-heading">
          <span class="handoff-pane-title">Destination · system settings</span>
          <span class="handoff-native-note">native mock</span>
        </div>
        <div class="handoff-settings-window">
          <div class="handoff-settings-titlebar"><span class="handoff-settings-dot" aria-hidden="true"></span><span>System Settings</span></div>
          <div class="handoff-settings-content">
            <p class="handoff-settings-kicker">Privacy &amp; Security</p>
            <h2 class="handoff-settings-heading">App Management</h2>
            <div id="destinationAnchor" class="handoff-target-row" data-reached="false">
              <img class="handoff-target-app-icon" src="/renderer/app-icon.png" alt="" />
              <span class="handoff-target-copy"><strong>Language Switcher</strong><span>Allow changes to the selected app.</span></span>
              <span class="handoff-target-switch" aria-hidden="true"></span>
            </div>
            <p class="handoff-settings-kicker">The real authorization remains owned by macOS. This panel is only a visual target for review.</p>
          </div>
        </div>
        <section id="accessory" class="handoff-accessory" hidden aria-live="polite">
          <span id="accessoryMark" class="handoff-accessory-mark" aria-hidden="true"></span>
          <span class="handoff-accessory-copy"><strong>System Settings ready</strong><span>Complete App Management there, then return to retry.</span></span>
          <button id="reverseFromAccessory" class="ui-button button button-outline handoff-control-button" type="button">完成并返回</button>
        </section>
      </article>

      <div class="handoff-proxy-layer" aria-hidden="true">
        <div id="proxy" class="handoff-proxy" data-phase="idle" data-motion="full" hidden>
          <div id="proxySource" class="handoff-proxy-slot" data-layer="source"></div>
          <div id="proxyDestination" class="handoff-proxy-slot" data-layer="destination"></div>
        </div>
      </div>
    </section>

    <section class="handoff-controls" aria-label="动画控制">
      <button class="ui-button button button-primary handoff-control-button" data-action="forward" type="button">开始交接</button>
      <button class="ui-button button button-outline handoff-control-button" data-action="reverse" type="button">反向返回</button>
      <button class="ui-button button button-outline handoff-control-button" data-action="reset" type="button">重置</button>
      <div class="handoff-motion-control">
        <label><input id="reduceMotion" type="checkbox" /> 减少动效（snap / crossfade）</label>
      </div>
    </section>
    <div class="handoff-inspector"><span id="geometryText">源 / 目标几何：等待真实权限动作</span><span id="motionText">duration 0.72 · response 0.72 · critical damping 1.0 · RAF</span></div>
    <footer class="handoff-footer"><span><strong>边界：</strong>native mock，不打开真实系统设置，不宣称 native/package evidence。</span><span>proxy：运行时 computed style clone · clean-room</span></footer>
  </main>
  <script>
    (() => {
      'use strict';
      const MOTION = Object.freeze({
        durationSeconds: 0.72,
        responseSeconds: 0.72,
        initialAlpha: 0.9,
        minimumLaunchScale: 0.58,
        liftRatio: 0.18,
        liftMinimumPx: 44,
        liftMaximumPx: 140,
      });
      const REVIEW = Object.freeze({
        sourceScenario: 'permissionMac',
        sourceActionSelectors: Object.freeze(['#modalPrimaryButton', '#permissionButton']),
        defaultLocale: 'zh-Hans',
        reducedMotionMedia: '(prefers-reduced-motion: reduce)',
      });
      const sourceFrame = document.querySelector('#sourceFrame');
      const sourceState = document.querySelector('#sourceState');
      const stage = document.querySelector('#handoffStage');
      const destinationAnchor = document.querySelector('#destinationAnchor');
      const proxy = document.querySelector('#proxy');
      const proxySource = document.querySelector('#proxySource');
      const proxyDestination = document.querySelector('#proxyDestination');
      const accessory = document.querySelector('#accessory');
      const accessoryMark = document.querySelector('#accessoryMark');
      const reverseFromAccessory = document.querySelector('#reverseFromAccessory');
      const phaseLabel = document.querySelector('#phaseLabel');
      const geometryText = document.querySelector('#geometryText');
      const motionText = document.querySelector('#motionText');
      const reduceMotion = document.querySelector('#reduceMotion');
      const actionButtons = Object.freeze({
        forward: document.querySelector('[data-action="forward"]'),
        reverse: document.querySelector('[data-action="reverse"]'),
        reset: document.querySelector('[data-action="reset"]'),
      });
      const phaseLabels = Object.freeze({
        idle: '待命', preparing: '准备交接', presenting: '正向动画', presented: '目标接管', reversing: '反向动画',
      });
      const locale = new URLSearchParams(location.search).get('locale') || REVIEW.defaultLocale;
      let phase = 'idle';
      let progress = 0;
      let captures = null;
      let animationGeneration = 0;
      let geometryFrame = 0;
      let sourceObserver = null;

      accessoryMark.replaceChildren(window.cavalryIcons.create('infoCircle'));

      function clamp(value, minimum, maximum) {
        return Math.min(Math.max(value, minimum), maximum);
      }

      function lerp(start, end, amount) {
        return start + (end - start) * amount;
      }

      function localRect(rect, stageRect) {
        return { left: rect.left - stageRect.left, top: rect.top - stageRect.top, width: rect.width, height: rect.height };
      }

      function center(rect) {
        return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      }

      function findSourceElement() {
        const sourceDocument = sourceFrame.contentDocument;
        const sourceWindow = sourceFrame.contentWindow;
        if (!sourceDocument || !sourceWindow) return null;
        for (const selector of REVIEW.sourceActionSelectors) {
          const candidate = sourceDocument.querySelector(selector);
          if (!candidate || candidate.hidden) continue;
          const style = sourceWindow.getComputedStyle(candidate);
          const rect = candidate.getBoundingClientRect();
          if (style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0' && rect.width > 0 && rect.height > 0) return { candidate, selector };
        }
        return null;
      }

      function copyComputedSubtree(sourceElement) {
        const sourceWindow = sourceElement.ownerDocument.defaultView;
        const clone = document.importNode(sourceElement, true);
        const sourceNodes = [sourceElement, ...sourceElement.querySelectorAll('*')];
        const cloneNodes = [clone, ...clone.querySelectorAll('*')];
        sourceNodes.forEach((sourceNode, index) => {
          const cloneNode = cloneNodes[index];
          const computed = sourceWindow.getComputedStyle(sourceNode);
          for (let propertyIndex = 0; propertyIndex < computed.length; propertyIndex += 1) {
            const property = computed[propertyIndex];
            cloneNode.style.setProperty(property, computed.getPropertyValue(property), computed.getPropertyPriority(property));
          }
          cloneNode.removeAttribute('id');
          cloneNode.removeAttribute('tabindex');
          cloneNode.setAttribute('aria-hidden', 'true');
        });
        clone.style.setProperty('position', 'absolute');
        clone.style.setProperty('inset', '0');
        clone.style.setProperty('width', '100%');
        clone.style.setProperty('height', '100%');
        clone.style.setProperty('max-width', 'none');
        clone.style.setProperty('max-height', 'none');
        clone.style.setProperty('margin', '0');
        clone.style.setProperty('transform', 'none');
        clone.style.setProperty('transition', 'none');
        clone.style.setProperty('animation', 'none');
        clone.style.setProperty('pointer-events', 'none');
        return clone;
      }

      function replaceClone(slot, sourceElement) {
        slot.replaceChildren(copyComputedSubtree(sourceElement));
      }

      function sourceCapture(stageRect) {
        const found = findSourceElement();
        if (!found) {
          sourceState.textContent = '等待真实权限动作';
          return null;
        }
        const iframeRect = sourceFrame.getBoundingClientRect();
        const iframeStyle = getComputedStyle(sourceFrame);
        const borderLeft = Number.parseFloat(iframeStyle.borderLeftWidth) || 0;
        const borderRight = Number.parseFloat(iframeStyle.borderRightWidth) || 0;
        const borderTop = Number.parseFloat(iframeStyle.borderTopWidth) || 0;
        const borderBottom = Number.parseFloat(iframeStyle.borderBottomWidth) || 0;
        const contentWidth = sourceFrame.clientWidth || iframeRect.width;
        const contentHeight = sourceFrame.clientHeight || iframeRect.height;
        const scaleX = (iframeRect.width - borderLeft - borderRight) / contentWidth;
        const scaleY = (iframeRect.height - borderTop - borderBottom) / contentHeight;
        const sourceRect = found.candidate.getBoundingClientRect();
        const pageRect = {
          left: iframeRect.left + borderLeft + sourceRect.left * scaleX,
          top: iframeRect.top + borderTop + sourceRect.top * scaleY,
          width: sourceRect.width * scaleX,
          height: sourceRect.height * scaleY,
        };
        const style = found.candidate.ownerDocument.defaultView.getComputedStyle(found.candidate);
        sourceState.textContent = '真实源：' + found.selector;
        return {
          rect: localRect(pageRect, stageRect),
          radius: Number.parseFloat(style.borderTopLeftRadius) || 0,
          selector: found.selector,
          element: found.candidate,
        };
      }

      function targetCapture(stageRect) {
        const style = getComputedStyle(destinationAnchor);
        return {
          rect: localRect(destinationAnchor.getBoundingClientRect(), stageRect),
          radius: Number.parseFloat(style.borderTopLeftRadius) || 0,
          selector: '#destinationAnchor',
          element: destinationAnchor,
        };
      }

      function captureGeometry() {
        const stageRect = stage.getBoundingClientRect();
        const source = sourceCapture(stageRect);
        if (!source) {
          captures = null;
          proxy.hidden = true;
          geometryText.textContent = '源 / 目标几何：等待真实权限动作';
          setActionAvailability();
          return null;
        }
        const target = targetCapture(stageRect);
        replaceClone(proxySource, source.element);
        replaceClone(proxyDestination, target.element);
        captures = { source, target };
        geometryText.textContent = '源 ' + Math.round(source.rect.width) + '×' + Math.round(source.rect.height) + ' → 目标 ' + Math.round(target.rect.width) + '×' + Math.round(target.rect.height) + ' · ' + source.selector + ' → ' + target.selector;
        renderProxy();
        setActionAvailability();
        return captures;
      }

      function scheduleGeometryCapture() {
        if (geometryFrame || ['preparing', 'presenting', 'reversing'].includes(phase)) return;
        geometryFrame = requestAnimationFrame(() => {
          geometryFrame = 0;
          captureGeometry();
        });
      }

      function watchSourceDocument() {
        sourceObserver?.disconnect();
        const sourceDocument = sourceFrame.contentDocument;
        if (!sourceDocument?.documentElement || !window.MutationObserver) return;
        sourceObserver = new MutationObserver(scheduleGeometryCapture);
        sourceObserver.observe(sourceDocument.documentElement, {
          attributes: true,
          childList: true,
          characterData: true,
          subtree: true,
        });
      }

      function criticalDampingProgress(seconds) {
        const omega = (2 * Math.PI) / MOTION.responseSeconds;
        return 1 - Math.exp(-omega * seconds) * (1 + omega * seconds);
      }

      function motionLift(sourceRect, targetRect) {
        const sourceCenter = center(sourceRect);
        const targetCenter = center(targetRect);
        const distance = Math.hypot(targetCenter.x - sourceCenter.x, targetCenter.y - sourceCenter.y);
        return clamp(distance * MOTION.liftRatio, MOTION.liftMinimumPx, MOTION.liftMaximumPx);
      }

      function renderProxy() {
        if (!captures) return;
        const source = captures.source.rect;
        const target = captures.target.rect;
        const sourceCenter = center(source);
        const targetCenter = center(target);
        const lift = motionLift(source, target);
        const middle = { x: (sourceCenter.x + targetCenter.x) / 2, y: (sourceCenter.y + targetCenter.y) / 2 - lift };
        const oneMinus = 1 - progress;
        const point = {
          x: oneMinus * oneMinus * sourceCenter.x + 2 * oneMinus * progress * middle.x + progress * progress * targetCenter.x,
          y: oneMinus * oneMinus * sourceCenter.y + 2 * oneMinus * progress * middle.y + progress * progress * targetCenter.y,
        };
        const width = lerp(source.width, target.width, progress);
        const height = lerp(source.height, target.height, progress);
        const radius = lerp(captures.source.radius, captures.target.radius, progress);
        const launchScale = lerp(MOTION.minimumLaunchScale, 1, progress);
        proxy.hidden = phase === 'idle' && progress === 0;
        proxy.dataset.phase = phase;
        proxy.style.width = Math.max(width, 1) + 'px';
        proxy.style.height = Math.max(height, 1) + 'px';
        proxy.style.borderRadius = Math.max(radius, 0) + 'px';
        proxy.style.transform = 'translate3d(' + (point.x - width / 2) + 'px, ' + (point.y - height / 2) + 'px, 0)';
        proxy.style.opacity = '1';
        proxySource.style.opacity = String(MOTION.initialAlpha * oneMinus);
        proxySource.style.transform = 'scale(' + launchScale + ')';
        proxyDestination.style.opacity = String(progress);
        proxyDestination.style.transform = 'scale(' + launchScale + ')';
        motionText.textContent = 'duration 0.72 · response 0.72 · critical damping 1.0 · lift ' + Math.round(lift) + 'px · RAF · progress ' + progress.toFixed(2);
      }

      function setActionAvailability() {
        actionButtons.forward.disabled = !captures || ['preparing', 'presenting', 'presented', 'reversing'].includes(phase);
        actionButtons.reverse.disabled = phase !== 'presented';
        actionButtons.reset.disabled = ['preparing', 'presenting', 'reversing'].includes(phase);
        reverseFromAccessory.disabled = phase !== 'presented';
      }

      function setPhase(nextPhase) {
        phase = nextPhase;
        phaseLabel.dataset.phase = phase;
        phaseLabel.textContent = phaseLabels[phase] || phase;
        accessory.hidden = phase !== 'presented';
        destinationAnchor.dataset.reached = String(phase === 'presented');
        setActionAvailability();
        renderProxy();
      }

      function finish(target) {
        progress = target;
        proxy.style.opacity = '1';
        proxy.dataset.motion = 'full';
        setPhase(target === 1 ? 'presented' : 'idle');
        renderProxy();
        proxy.hidden = true;
      }

      function animateReduced(target) {
        const generation = ++animationGeneration;
        proxy.dataset.motion = 'reduced';
        proxy.style.opacity = '0';
        requestAnimationFrame(() => {
          if (generation !== animationGeneration) return;
          progress = target;
          renderProxy();
          proxy.style.opacity = '1';
          requestAnimationFrame(() => {
            if (generation !== animationGeneration) return;
            finish(target);
          });
        });
      }

      function animateSpring(target) {
        const generation = ++animationGeneration;
        const start = progress;
        const startedAt = performance.now();
        function frame(now) {
          if (generation !== animationGeneration) return;
          const elapsed = Math.min(Math.max(0, (now - startedAt) / 1000), MOTION.durationSeconds);
          const eased = clamp(criticalDampingProgress(elapsed), 0, 1);
          progress = start + (target - start) * eased;
          renderProxy();
          if (elapsed >= MOTION.durationSeconds) {
            finish(target);
            return;
          }
          requestAnimationFrame(frame);
        }
        requestAnimationFrame(frame);
      }

      function animateTo(target) {
        if (target === progress) {
          finish(target);
          return;
        }
        if (reduceMotion.checked || window.matchMedia?.(REVIEW.reducedMotionMedia).matches) animateReduced(target);
        else animateSpring(target);
      }

      function startForward() {
        if (phase !== 'idle' || !captureGeometry()) return;
        setPhase('preparing');
        requestAnimationFrame(() => {
          if (phase !== 'preparing') return;
          setPhase('presenting');
          animateTo(1);
        });
      }

      function startReverse() {
        if (phase !== 'presented' || !captureGeometry()) return;
        setPhase('reversing');
        animateTo(0);
      }

      function reset() {
        ++animationGeneration;
        progress = 0;
        captureGeometry();
        setPhase('idle');
        renderProxy();
      }

      actionButtons.forward.addEventListener('click', startForward);
      actionButtons.reverse.addEventListener('click', startReverse);
      actionButtons.reset.addEventListener('click', reset);
      reverseFromAccessory.addEventListener('click', startReverse);
      reduceMotion.checked = window.matchMedia?.(REVIEW.reducedMotionMedia).matches === true;
      sourceFrame.addEventListener('load', () => {
        watchSourceDocument();
        scheduleGeometryCapture();
      });
      window.addEventListener('resize', scheduleGeometryCapture);
      if (window.ResizeObserver) new ResizeObserver(scheduleGeometryCapture).observe(stage);
      sourceFrame.src = '/app?scenario=' + REVIEW.sourceScenario + '&locale=' + encodeURIComponent(locale);
      setPhase('idle');
      captureGeometry();
    })();
  </script>
</body>
</html>`;
}

module.exports = Object.freeze({ workspaceHtml, permissionHandoffHtml });
