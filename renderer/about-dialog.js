/**
 * [INPUT]: 依赖 index.html 的 About button/tooltip/dialog/link 锚点、注入的冻结 bridge API 与四语 text 函数。
 * [OUTPUT]: 对外提供 createAboutDialog 工厂和只读 cavalryI18nShowAbout 入口，管理平台入口显隐、Tooltip、Dialog 焦点归还、Switcher 版本读取及 repository/license 固定链接分发。
 * [POS]: renderer 的低频 About 组件状态机；macOS 由系统应用菜单唤起，Windows 才显示标题栏入口；不接收或打开任意 URL，外部副作用只交给 bridge 的固定 link id。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
(function attachAboutDialog(global) {
  'use strict';

  const REPOSITORY_URL = 'https://github.com/daftAI2026/Cavalry-i18n';

  function createAboutDialog({ api, text, onError }) {
    const control = document.querySelector('#aboutControl');
    const button = document.querySelector('#aboutButton');
    const tooltip = document.querySelector('#aboutTooltip');
    const dialog = document.querySelector('#aboutDialog');
    const title = document.querySelector('#aboutTitle');
    const version = document.querySelector('#aboutVersion');
    const links = dialog.querySelector?.('.about-links') || document.querySelector('.about-links');
    const repository = document.querySelector('#aboutRepositoryLink');
    const repositoryLabel = document.querySelector('#aboutRepositoryLabel');
    const license = document.querySelector('#aboutLicenseLink');
    const licenseLabel = document.querySelector('#aboutLicenseLabel');
    const close = document.querySelector('#aboutCloseButton');
    let returnFocus = null;

    function setTooltipOpen(open) {
      control.dataset.tooltipState = open ? 'open' : 'closed';
    }

    function localize() {
      button.setAttribute('aria-label', text('aboutButtonAria'));
      tooltip.textContent = text('aboutTooltip');
      title.textContent = text('appTitle');
      links?.setAttribute?.('aria-label', text('aboutProjectLinks'));
      repositoryLabel.textContent = REPOSITORY_URL;
      licenseLabel.textContent = text('aboutLicense');
      close.setAttribute('aria-label', text('close'));
    }

    function setPlatform(platform) {
      control.hidden = platform !== 'windows';
    }

    async function show() {
      if (dialog.open || typeof dialog.showModal !== 'function') return;
      setTooltipOpen(false);
      returnFocus = document.activeElement && typeof document.activeElement.focus === 'function'
        ? document.activeElement
        : button;
      let currentVersion = '';
      try {
        currentVersion = await api.getSwitcherVersion();
      } catch (_) {
        currentVersion = '';
      }
      version.textContent = currentVersion ? text('aboutVersion', { version: currentVersion }) : '';
      dialog.showModal();
      close.focus();
    }

    function hide() {
      if (dialog.open) dialog.close();
    }

    async function openLink(link) {
      const result = await api.openProjectLink(link);
      if (!result.ok) onError();
    }

    button.addEventListener('click', () => { void show(); });
    control.addEventListener('mouseenter', () => setTooltipOpen(true));
    control.addEventListener('mouseleave', () => setTooltipOpen(false));
    control.addEventListener('focusin', () => setTooltipOpen(true));
    control.addEventListener('focusout', () => setTooltipOpen(false));
    button.addEventListener('keydown', (event) => { if (event.key === 'Escape') setTooltipOpen(false); });
    repository.addEventListener('click', (event) => { event.preventDefault(); void openLink('repository').catch(onError); });
    license.addEventListener('click', (event) => { event.preventDefault(); void openLink('license').catch(onError); });
    close.addEventListener('click', hide);
    dialog.addEventListener('close', () => {
      const target = returnFocus;
      returnFocus = null;
      if (target?.isConnected !== false) target?.focus?.();
    });
    dialog.addEventListener('click', (event) => {
      if (!event.defaultPrevented && (typeof event.button !== 'number' || event.button === 0) && event.target === dialog) hide();
    });

    Object.defineProperty(global, 'cavalryI18nShowAbout', {
      value: () => { void show(); },
      configurable: false,
      enumerable: false,
      writable: false,
    });

    return Object.freeze({ localize, setPlatform });
  }

  global.createAboutDialog = createAboutDialog;
})(window);
