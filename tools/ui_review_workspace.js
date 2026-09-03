/**
 * [INPUT]: 依赖 UI Review server 暴露的真实主窗口/About 页面、安装/版本兼容/成功/阻塞/警告/失败 fixture 矩阵、feedback/icons/badges 目录，以及 ui_review_permission_handoff 的独立权限审查页；依赖 localhost query 传递 locale/scenario。
 * [OUTPUT]: 对外提供 workspaceHtml，并兼容转发 permissionHandoffHtml；以单一侧栏切换生产界面、320×308 且 Chrome 覆盖完整画布的无重复视觉标题 About、审查总览和占满可用 stage 的独立 macOS 权限交接原型，revision 变化时重载整个工作台而非只刷新 iframe。
 * [POS]: tools UI Review 的纯导航壳；只拥有页面选择、fixture/locale 路由与主/About 审查窗口外框，权限页不再套用会压缩原型的假窗口，动画状态机由兄弟模块独立承担。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

const { permissionHandoffHtml } = require('./ui_review_permission_handoff');


function workspaceHtml() {
  return String.raw`<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <link rel="icon" href="data:," />
  <title>Cavalry UI Review Workspace</title>
  <style>
    :root { color-scheme: light; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif; --line: #dededb; --surface: #fff; --canvas: #f5f5f3; --text: #1d1d1f; --muted: #6e6e73; }
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
    .window[data-surface="about"] { width: 320px; height: 308px; border-radius: 12px; }
    .window[data-surface="about"] iframe { height: 100%; margin-top: 0; }
    .window[data-surface="about"]::before { content: ""; position: absolute; z-index: 4; inset: 0 0 auto; height: 40px; pointer-events: none; }
    .window[data-surface="about"] .lights { top: 8px; left: 8px; gap: 6px; }
    .window[data-surface="about"] .lights i { width: 12px; height: 12px; }
    .window[data-surface="handoff"] { width: 100%; height: 100%; border: 0; border-radius: 12px; box-shadow: none; }
    .window[data-surface="handoff"] iframe { height: 100%; }
    .window[data-surface="handoff"] .lights { display: none; }
    .stage[data-kind="handoff"] { display: block; padding: 0; }
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
        if (revision && next !== revision) location.reload();
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


module.exports = Object.freeze({ workspaceHtml, permissionHandoffHtml });
