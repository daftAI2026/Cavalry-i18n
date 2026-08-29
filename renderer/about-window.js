/**
 * [INPUT]: 依赖 about.html 信息节点、四语文案、共享 Toast 状态机与冻结 bridge 的 getSwitcherVersion/openProjectLink 能力。
 * [OUTPUT]: 对外提供 About 本地化、真实版本、固定 repository/license 点击分发及默认浏览器失败 Toast；不暴露 URL。
 * [POS]: 独立 About WebviewWindow 页面控制器；外链失败留在本窗口的短时反馈，不污染主任务 Activity 或 AlertDialog。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
(function attachAboutWindow(global) {
  'use strict';

  const SUPPORTED_LOCALES = Object.freeze(['en', 'zh-Hans', 'zh-Hant', 'ja_JP']);

  function normalizeLocale(language) {
    const value = String(language || '').replace('_', '-').toLowerCase();
    if (!value) return '';
    if (value === 'zh-hans' || value === 'zh-cn' || value === 'zh-sg') return 'zh-Hans';
    if (value === 'zh-hant' || value === 'zh-tw' || value === 'zh-hk' || value === 'zh-mo') return 'zh-Hant';
    if (value === 'ja' || value === 'ja-jp') return 'ja_JP';
    if (value === 'en' || value === 'en-us' || value === 'en-gb') return 'en';
    return '';
  }

  function detectLocale() {
    const languages = global.navigator?.languages?.length
      ? global.navigator.languages
      : [global.navigator?.language];
    return languages.map(normalizeLocale).find((locale) => SUPPORTED_LOCALES.includes(locale)) || 'en';
  }

  function text(locale, key, params = {}) {
    const source = UI_TEXT[locale] || UI_TEXT.en;
    const template = source[key] ?? UI_TEXT.en[key] ?? '';
    return String(template).replace(/\{([a-zA-Z0-9_]+)\}/g, (_, name) => String(params[name] ?? ''));
  }

  function localize(locale) {
    const title = document.querySelector('#aboutTitle');
    const version = document.querySelector('#aboutVersion');
    const links = document.querySelector('#aboutLinks');
    const license = document.querySelector('#aboutLicenseLabel');

    document.documentElement.lang = locale;
    document.title = text(locale, 'aboutButtonAria');
    title.textContent = text(locale, 'appTitle');
    version.textContent = '';
    links.setAttribute('aria-label', text(locale, 'aboutProjectLinks'));
    license.textContent = text(locale, 'aboutLicense');
  }

  async function loadVersion(locale) {
    try {
      const version = await global.cavalryI18n.getSwitcherVersion();
      if (version) {
        document.querySelector('#aboutVersion').textContent = text(locale, 'aboutVersion', { version });
      }
    } catch (_) {
      // 版本读取失败时保持空白，不把 bridge 或插件错误暴露给用户。
    }
  }

  function wireProjectLink(selector, link, onError) {
    const element = document.querySelector(selector);
    element.addEventListener('click', async (event) => {
      event.preventDefault();
      try {
        const result = await global.cavalryI18n.openProjectLink(link);
        if (!result?.ok) onError();
      } catch (_) {
        onError();
      }
    });
  }

  const locale = detectLocale();
  localize(locale);
  const toast = global.createToastControl({
    label: text(locale, 'notifications'),
    closeLabel: text(locale, 'close'),
  });
  const showProjectLinkError = () => toast.show({
    type: 'error',
    title: text(locale, 'projectLinkFailedTitle'),
    description: text(locale, 'openProjectLinkFailed'),
  });
  wireProjectLink('#aboutRepositoryLink', 'repository', showProjectLinkError);
  wireProjectLink('#aboutLicenseLink', 'license', showProjectLinkError);
  void loadVersion(locale);
})(window);
