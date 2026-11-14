/**
 * [INPUT]: 依赖主窗footer/完成消息DOM、共享图标、四语UI_TEXT、固定外链回调及独立关注手势控制器。
 * [OUTPUT]: 同步关注入口；将成功结果与忙碌状态转交独立关注手势模块。
 * [POS]: 主窗口独立 footer 控制器；只把已知链接 ID 交给 app.js，不接受或拼接 URL。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
(function attachSupportFooter(global) {
  'use strict';

  const LINKS = Object.freeze([
    { element: 'github', icon: 'githubLogo', target: 'repository', label: 'supportFooterGithubAria' },
    { element: 'twitter', icon: 'xLogo', target: 'twitter', label: 'supportFooterTwitterAria' },
    { element: 'xiaohongshu', icon: 'xiaohongshuLogo', target: 'xiaohongshu', label: 'supportFooterXiaohongshuAria' },
  ]);

  function createSupportFooterControl({ document, icons, text, openProjectLink }) {
    const query = (id) => document.querySelector(`#${id}`);
    const message = query('supportFooterMessage');
    const nav = query('supportFooterLinks');
    const activity = query('statusPanel');
    const outcome = query('statusOutcome');
    const hand = query('supportFollowHand');
    const image = query('supportFollowHandImage');
    const links = {
      github: query('supportGithubLink'), githubIcon: query('supportGithubIcon'),
      twitter: query('supportTwitterLink'), twitterIcon: query('supportTwitterIcon'),
      xiaohongshu: query('supportXiaohongshuLink'), xiaohongshuIcon: query('supportXiaohongshuIcon'),
    };
    const followHand = global.createSupportFollowHand({ targets: LINKS.map((entry) => ({ id: entry.target, element: links[`${entry.element}Icon`] })), activity, outcome, hand, image });
    for (const entry of LINKS) {
      const link = links[entry.element];
      links[`${entry.element}Icon`].append(icons.create(entry.icon));
      link.addEventListener('click', (event) => {
        event.preventDefault();
        followHand.followed();
        void openProjectLink(entry.target);
      });
    }

    function localize() {
      message.textContent = text('supportFooterMessage');
      nav.setAttribute('aria-label', text('supportFooterLinksAria'));
      for (const entry of LINKS) {
        const label = text(entry.label);
        links[entry.element].setAttribute('aria-label', label);
        links[entry.element].setAttribute('title', label);
      }
    }

    localize();
    return Object.freeze({ localize, offerAfterSuccess: followHand.offerAfterSuccess, setBusy: followHand.setBusy });
  }

  global.createSupportFooterControl = createSupportFooterControl;
})(window);
