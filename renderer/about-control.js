/**
 * [INPUT]: 依赖主窗口 index.html 的 About 入口、共享 createTooltipControl、冻结 bridge 的 showAbout 调用与四语 text 函数。
 * [OUTPUT]: 对外提供 createAboutControl 工厂；仅在 Windows 显示标题栏入口，并把 macOS 菜单与 Windows 入口统一交给 Rust About window owner。
 * [POS]: renderer 的低频 About 入口状态机；Tooltip 行为委托共享状态机，自身不持有 About 内容、窗口 URL、版本或项目链接状态。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
(function attachAboutControl(global) {
  'use strict';

  function createAboutControl({ api, text, onError }) {
    const control = document.querySelector('#aboutControl');
    const button = document.querySelector('#aboutButton');
    const tooltip = document.querySelector('#aboutTooltip');
    const tooltipText = document.querySelector('#aboutTooltipText');
    const tooltipControl = global.createTooltipControl({
      root: control,
      trigger: button,
      popup: tooltip,
      descriptionId: 'aboutTooltip',
    });

    function localize() {
      button.setAttribute('aria-label', text('aboutButtonAria'));
      tooltipText.textContent = text('aboutTooltip');
    }

    function setPlatform(platform) {
      tooltipControl.close();
      control.hidden = platform !== 'windows';
    }

    async function show() {
      tooltipControl.close();
      try {
        const result = await api.showAbout();
        if (!result?.ok) onError();
      } catch (_) {
        onError();
      }
    }

    button.addEventListener('click', () => { void show(); });

    return Object.freeze({ localize, setPlatform });
  }

  global.createAboutControl = createAboutControl;
})(window);
