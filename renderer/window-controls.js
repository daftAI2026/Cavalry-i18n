/**
 * [INPUT]: 依赖 index.html 的 Windows caption Button、冻结 cavalryI18n 窗口 API、Phosphor 图标注册表与 app.js 提供的本地化函数
 * [OUTPUT]: 对外提供 createWindowControls；仅在 Windows 显示右侧最小化、最大化/还原、关闭，装配共享语义图标，并把最大化状态同步给按钮语义与透明外壳几何
 * [POS]: renderer 的平台窗口状态机；把标题栏动作映射到系统窗口 API，并驱动 normal/maximized 两态表面投影，macOS 保持 AppKit 原生交通灯路径
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
(() => {
  function createWindowControls({ api, text, icons }) {
    const root = document.querySelector('#windowsWindowControls');
    const minimizeButton = document.querySelector('#windowMinimizeButton');
    const maximizeButton = document.querySelector('#windowMaximizeButton');
    const closeButton = document.querySelector('#windowCloseButton');
    let isWindows = false;
    let resizeTimer = null;

    function appendIcon(button, name, className = '') {
      const icon = icons?.create(name);
      if (!icon) return;
      if (className) icon.setAttribute('class', className);
      button.append(icon);
    }

    appendIcon(minimizeButton, 'minimizeWindow');
    appendIcon(maximizeButton, 'maximizeWindow', 'window-icon-maximize');
    appendIcon(maximizeButton, 'restoreWindow', 'window-icon-restore');
    appendIcon(closeButton, 'close');

    function localize() {
      const maximized = root.dataset.maximized === 'true';
      const maximizeLabel = text(maximized ? 'restoreWindow' : 'maximizeWindow');
      minimizeButton.setAttribute('aria-label', text('minimizeWindow'));
      minimizeButton.title = text('minimizeWindow');
      maximizeButton.setAttribute('aria-label', maximizeLabel);
      maximizeButton.title = maximizeLabel;
      closeButton.setAttribute('aria-label', text('closeWindow'));
      closeButton.title = text('closeWindow');
    }

    async function syncMaximized() {
      if (!isWindows) return;
      try {
        const maximized = String(await api.isWindowMaximized());
        root.dataset.maximized = maximized;
        document.body.dataset.maximized = maximized;
        localize();
      } catch (_) {
        // 窗口仍可操作；查询失败时保留上次已知图标，不伪造状态。
      }
    }

    function run(action, syncAfter = false) {
      if (!isWindows) return;
      void Promise.resolve()
        .then(action)
        .then(() => (syncAfter ? syncMaximized() : undefined))
        .catch(() => {
          // 原生 caption 操作失败时不污染业务 Alert，也不暴露 transport 文本。
        });
    }

    minimizeButton.addEventListener('click', () => run(api.minimizeWindow));
    maximizeButton.addEventListener('click', () => run(api.toggleMaximizeWindow, true));
    closeButton.addEventListener('click', () => run(api.closeWindow));
    window.addEventListener?.('resize', () => {
      if (!isWindows) return;
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(syncMaximized, 120);
    });

    localize();
    return Object.freeze({
      localize,
      setPlatform(platform) {
        isWindows = platform === 'windows';
        root.hidden = !isWindows;
        if (isWindows) void syncMaximized();
      },
    });
  }

  window.createWindowControls = createWindowControls;
})();
