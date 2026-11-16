/**
 * [INPUT]: SDK原生Toast、业务通知与本地图标/token皮肤。
 * [OUTPUT]: show/close接线；SDK拥有队列、顺序、可见上限、暂停、F6/Tab、拖动与离场。
 * [POS]: 局部通知适配，不接管Activity或业务决策。
 * [PROTOCOL]: 变更时更新此头部，然后检查CLAUDE.md。
 */
(function attachToastControl(global) {
  'use strict';
  const icons = { success: 'checkCircle', info: 'infoCircle', warning: 'warningCircle', error: 'errorCircle', loading: 'spinner' };
  function createToastControl({ label = 'Notifications', closeLabel = 'Close', timeout = 5000, limit = 3 } = {}) {
    const toaster = global.cavalryUi.createToaster({ duration: timeout });
    const viewport = document.createElement('ui-toast-region');
    viewport.className = 'toast-viewport';
    viewport.setAttribute('aria-label', label); viewport.setAttribute('side', 'bottom'); viewport.setAttribute('align', 'end');
    viewport.setAttribute('max-visible', String(limit)); viewport.toaster = toaster;
    const template = document.createElement('template');
    template.innerHTML = `<ui-toast class="toast"><div class="toast-content"><span class="toast-icon" aria-hidden="true"></span><div class="toast-copy"><ui-toast-title class="toast-title"></ui-toast-title><ui-toast-description class="toast-description"></ui-toast-description></div><ui-toast-close><button type="button" class="ui-button toast-close" data-variant="ghost"></button></ui-toast-close></div></ui-toast>`;
    for (const [type, name] of Object.entries(icons)) {
      const icon = document.createElement('span'); icon.dataset.show = type; icon.append(global.cavalryIcons.create(name));
      template.content.querySelector('.toast-icon').append(icon);
    }
    const close = template.content.querySelector('.toast-close'); close.setAttribute('aria-label', closeLabel); close.append(global.cavalryIcons.create('close'));
    viewport.append(template); document.body.append(viewport);
    function show({ title, description, type = 'error', timeout: duration = timeout } = {}) {
      return toaster({ title, description, type, duration: type === 'loading' || duration <= 0 ? Infinity : duration });
    }
    return Object.freeze({ show, close: id => toaster.dismiss(id) });
  }
  global.createToastControl = createToastControl;
})(window);
