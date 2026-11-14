/**
 * [INPUT]: 关注文案/完成消息DOM、本地x-hands素材、窗口焦点与一次性展示标记。
 * [OUTPUT]: 完整成功结果落稳且窗口前台后的一次性手臂引导；输入、忙碌和Reduce Motion收起。
 * [POS]: 独立装饰动画生命周期，不读取Tauri或事务，不改变布局、焦点及关注链接。
 * [PROTOCOL]: 变更时检查renderer/CLAUDE.md。
 */
(function attachSupportFollowHand(global) {
  'use strict';

  const SEEN_KEY = 'cavalry-i18n:follow-hand-seen';

  function createSupportFollowHand({ targets, activity, outcome, hand, image }) {
    const document = targets[0].element.ownerDocument;
    const reducedMotion = global.matchMedia?.('(prefers-reduced-motion: reduce)');
    let seen = false;
    // WebView storage may be unavailable; the current session still shows at most once.
    try { seen = global.localStorage.getItem(SEEN_KEY) === '1'; } catch (_) {}
    let expectedOutcome = '';
    let busy = false;
    let timer = null;
    let animation = null;
    let observer = null;

    function cancel() {
      clearTimeout(timer);
      timer = null;
      animation?.cancel();
      animation = null;
      hand.hidden = true;
    }

    function remember() {
      seen = true;
      expectedOutcome = '';
      observer?.disconnect();
      try { global.localStorage.setItem(SEEN_KEY, '1'); } catch (_) {}
    }

    function eligible() {
      return !seen && expectedOutcome && !busy && !reducedMotion?.matches
        && document.visibilityState === 'visible' && document.hasFocus()
        && !document.querySelector('dialog[open], [role="combobox"][aria-expanded="true"]')
        && activity.dataset.hasOutcome === 'true' && !outcome.hidden
        && outcome.textContent === expectedOutcome && image.complete && image.naturalWidth > 0;
    }

    function play() {
      timer = null;
      if (!eligible()) return;
      const target = targets[Math.floor(Math.random() * targets.length)];
      const rect = target.element.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top - 7;
      // Original x-hands tip (1490,18), sleeve base (0,850).
      // Reach down-right from beyond the upper-left window edge.
      const angle = Math.PI / 3;
      const edge = Number.parseFloat(getComputedStyle(hand).getPropertyValue('--support-follow-hand-overhang'));
      const length = Math.min((x + edge) / Math.cos(angle), (y + edge) / Math.sin(angle));
      const scale = length / Math.hypot(1490, 832);
      const rotation = 60 - Math.atan2(-832, 1490) * 180 / Math.PI;
      image.style.width = `${1494 * scale}px`;
      image.style.left = `${-1490 * scale}px`;
      image.style.top = `${-18 * scale}px`;
      hand.dataset.target = target.id;
      const at = (dx = 0, dy = 0) => `translate(${x + dx}px, ${y + dy}px) rotate(${rotation}deg)`;
      const away = at(-Math.cos(angle) * length * 1.12, -Math.sin(angle) * length * 1.12);
      const duration = Number.parseFloat(getComputedStyle(hand).getPropertyValue('--duration-follow-hand'));
      hand.hidden = false;
      remember();
      animation = hand.animate([
        { transform: away, opacity: 0, offset: 0, easing: 'cubic-bezier(.23,1,.32,1)' },
        { transform: at(5, 8), opacity: 1, offset: 0.32 },
        { transform: at(), opacity: 1, offset: 0.44 },
        { transform: at(2, 4), opacity: 1, offset: 0.56 },
        { transform: at(), opacity: 1, offset: 0.68 },
        { transform: at(), opacity: 1, offset: 0.82, easing: 'cubic-bezier(.23,1,.32,1)' },
        { transform: away, opacity: 0, offset: 1 },
      ], { duration, fill: 'both' });
      animation.onfinish = cancel;
    }

    function schedule() {
      clearTimeout(timer);
      timer = null;
      if (!eligible()) return;
      const delay = Number.parseFloat(getComputedStyle(hand).getPropertyValue('--duration-follow-hand-delay'));
      timer = setTimeout(play, delay);
    }

    function dismiss() {
      expectedOutcome = '';
      cancel();
    }

    global.addEventListener('focus', schedule);
    global.addEventListener('blur', cancel);
    global.addEventListener('resize', cancel);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') schedule();
      else cancel();
    });
    document.addEventListener('pointerdown', dismiss);
    document.addEventListener('keydown', dismiss);
    reducedMotion?.addEventListener('change', () => {
      if (reducedMotion.matches) dismiss();
    });
    image.addEventListener('load', schedule);

    return {
      offerAfterSuccess(messageText) {
        if (seen || reducedMotion?.matches) return;
        expectedOutcome = messageText;
        if (!observer) {
          observer = new global.MutationObserver(schedule);
          observer.observe(activity, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['hidden', 'data-has-outcome'] });
        }
        schedule();
      },
      setBusy(value) {
        busy = value;
        if (busy) dismiss();
        else schedule();
      },
      followed() { remember(); cancel(); },
    };
  }

  global.createSupportFollowHand = createSupportFollowHand;
})(window);
