/**
 * [INPUT]: 依赖标题栏 Tooltip 的 root/trigger/popup DOM 与标准 pointer/focus/keyboard 事件
 * [OUTPUT]: 对外提供 createTooltipControl 工厂，以共享单开状态投影 hover/focus/click/Escape，并禁用触摸悬浮提示
 * [POS]: renderer 的无依赖 Tooltip 状态机；复刻 shadcn Base UI 的视觉标签行为，不读取业务、文案或 Tauri 状态
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
(function attachTooltipControl(global) {
  'use strict';

  let activeTooltip = null;

  function createTooltipControl({ root, trigger, popup, descriptionId }) {
    let api;

    function cssPixels(token) {
      if (typeof global.getComputedStyle !== 'function') return 0;
      return Number.parseFloat(
        global.getComputedStyle(document.documentElement).getPropertyValue(token)
      ) || 0;
    }

    function position() {
      if (
        !popup.style ||
        typeof root.getBoundingClientRect !== 'function' ||
        typeof popup.getBoundingClientRect !== 'function'
      ) return;

      const anchor = root.getBoundingClientRect();
      const layer = popup.getBoundingClientRect();
      const sideOffset = cssPixels('--tooltip-side-offset');
      const collisionPadding = cssPixels('--tooltip-collision-padding');
      const viewportWidth = global.innerWidth;
      const viewportHeight = global.innerHeight;
      if (!viewportWidth || !viewportHeight) return;

      const bottom = anchor.bottom + sideOffset;
      const top = anchor.top - sideOffset - layer.height;
      const side = bottom + layer.height + collisionPadding <= viewportHeight || top < collisionPadding
        ? 'bottom'
        : 'top';
      const idealLeft = anchor.left + (anchor.width - layer.width) / 2;
      const left = Math.min(
        Math.max(idealLeft, collisionPadding),
        viewportWidth - collisionPadding - layer.width
      );

      popup.dataset.side = side;
      popup.dataset.align = 'center';
      popup.style.left = `${left}px`;
      popup.style.top = `${side === 'bottom' ? bottom : top}px`;
      popup.style.setProperty('--tooltip-arrow-inline', `${anchor.left + anchor.width / 2 - left}px`);
    }

    function setOpen(open, reason = 'programmatic') {
      if (open && activeTooltip && activeTooltip !== api) activeTooltip.close();

      root.dataset.tooltipState = open ? 'open' : 'closed';
      root.dataset.tooltipReason = open ? reason : 'none';
      popup.dataset.state = open ? 'open' : 'closed';
      popup.dataset.reason = open ? reason : 'none';
      popup.setAttribute('aria-hidden', open ? 'false' : 'true');
      if (open) {
        trigger.setAttribute('data-popup-open', '');
        trigger.setAttribute('aria-describedby', descriptionId);
        activeTooltip = api;
        position();
      } else {
        trigger.removeAttribute('data-popup-open');
        trigger.removeAttribute('aria-describedby');
        if (activeTooltip === api) activeTooltip = null;
      }
    }

    function open(reason) {
      if (!root.hidden && !trigger.disabled) setOpen(true, reason);
    }

    function close() {
      setOpen(false);
    }

    root.addEventListener('pointerenter', (event) => {
      if (event.pointerType !== 'touch') open('hover');
    });
    root.addEventListener('pointerleave', close);
    root.addEventListener('focusin', () => open('focus'));
    root.addEventListener('focusout', (event) => {
      if (!event.relatedTarget || !root.contains(event.relatedTarget)) close();
    });
    trigger.addEventListener('click', close);
    trigger.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') close();
    });
    global.addEventListener('resize', () => {
      if (root.dataset.tooltipState === 'open') position();
    });

    api = Object.freeze({ open, close });
    document.body.append(popup);
    close();
    return api;
  }

  global.createTooltipControl = createTooltipControl;
})(window);
