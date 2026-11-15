/**
 * [INPUT]: UI SDK 独立 Toast 队列、真实图标工厂与既有 Toast 样式。
 * [OUTPUT]: 保持createToastControl/show/close及main的五秒/三条丢弃最旧/loading常驻；SDK管理队列、堆叠与暂停，公开组合保留main的F6/原生Tab顺序、进入/500ms退出和移除时回焦。
 * [POS]: 局部通知展示适配，不读取 Tauri、不覆盖 Activity、不接管业务决策。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
(function attachToastControl(global) {
  'use strict';
  const DEFAULT_TIMEOUT_MS = 5000;
  const DEFAULT_LIMIT = 3;
  const TYPE_ICONS = Object.freeze({ success: 'checkCircle', info: 'infoCircle', warning: 'warningCircle', error: 'errorCircle', loading: 'spinner' });
  function createToastControl({ label = 'Notifications', closeLabel = 'Close', timeout = DEFAULT_TIMEOUT_MS, limit = DEFAULT_LIMIT } = {}) {
    const toaster = global.cavalryUi.createToaster({ duration: timeout });
    const viewport = document.createElement('ui-toast-region');
    viewport.className = 'toast-viewport';
    viewport.setAttribute('aria-label', label);
    viewport.setAttribute('side', 'bottom');
    viewport.setAttribute('align', 'end');
    viewport.setAttribute('max-visible', String(limit));
    viewport.setAttribute('shortcut', '');
    // 保留main普通文档层级；允许原生dialog盖住通知，不提升到top layer。
    viewport.addEventListener('beforetoggle',event=>{if(event.newState==='open')event.preventDefault();});
    viewport.toaster = toaster;
    const template = document.createElement('template');
    const part = document.createElement('ui-toast');
    part.setAttribute('as-child', '');
    const node = document.createElement('section');
    node.className = 'toast';
    node.setAttribute('role', 'dialog');
    node.setAttribute('aria-modal', 'false');
    const content = document.createElement('div');
    content.className = 'toast-content';
    const icon = document.createElement('span');
    icon.className = 'toast-icon';
    icon.setAttribute('aria-hidden', 'true');
    const copy = document.createElement('div');
    copy.className = 'toast-copy';
    const title = document.createElement('ui-toast-title');
    title.className = 'toast-title';
    const description = document.createElement('ui-toast-description');
    description.className = 'toast-description';
    copy.append(title, description);
    const closePart = document.createElement('ui-toast-close');
    const closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.className = 'ui-button toast-close';
    closeButton.setAttribute('data-variant', 'ghost');
    closeButton.setAttribute('aria-label', closeLabel);
    closeButton.append(global.cavalryIcons.create('close'));
    closePart.append(closeButton);
    content.append(icon, copy, closePart);
    node.append(content);
    part.append(node);
    template.content.append(part);
    viewport.append(template);
    viewport.renderToast = (toast, wrapper) => {
      const element = wrapper.querySelector('.toast');
      if (!element.dataset.toastId) {
        element.dataset.state = toast.data.ending ? 'ending' : 'starting';
        if (!toast.data.ending) {
          element.setAttribute('data-starting-style', '');
          setTimeout(() => { if (element.dataset.state === 'starting') element.dataset.state = 'open'; element.removeAttribute('data-starting-style'); }, 0);
        }
      }
      if (!element.dataset.toastId) {
        // 保留main的原生文字拖选，不让SDK把pointerdown当作滑动关闭。
        // 在SDK绑定前截获根节点冒泡：目标按钮press与默认选字仍可运行。
        element.addEventListener('pointerdown', event => event.stopImmediatePropagation());
      }
      element.dataset.toastId = toast.id;
      element.querySelector('.toast-icon').replaceChildren(global.cavalryIcons.create(TYPE_ICONS[toast.type] || 'errorCircle'));
    };
    document.body.append(viewport);
    // SDK默认F6会切回原控件；main每次聚焦最新项，Tab保持原生文档顺序。
    document.addEventListener('keydown', event => {
      if (event.key !== 'F6') return;
      const latest = toaster.toasts()[0];
      const element = [...viewport.querySelectorAll('.toast')].find(node => node.dataset.toastId === latest?.id);
      if (element) { event.preventDefault(); element.focus(); }
    });
    function show({ title, description, type = 'error', timeout: duration = timeout }) {
      // main 的 limit 是丢弃最旧项，不能让SDK的 max-visible 变成隐藏队列。
      for (const previous of toaster.toasts().slice(Math.max(0, limit - 1))) {
        const element = [...viewport.querySelectorAll('.toast')].find(node => node.dataset.toastId === previous.id);
        if (element) { element.hidden = true; element.setAttribute('aria-hidden', 'true'); }
        previous.data.immediate = true;
        clearTimeout(previous.data.exitTimer);
        toaster.dismiss(previous.id);
      }
      const data = { immediate: false, exitTimer: null, ending: false };
      let id;
      id = toaster({ title, description, type, duration: type === 'loading' || duration <= 0 ? Infinity : duration, priority: 'polite', data,
        onDismiss(details) {
          if (data.immediate) return;
          details.cancel();
          if (data.ending) return;
          data.ending = true;
          const element = [...viewport.querySelectorAll('.toast')].find(node => node.dataset.toastId === id);
          if (element) element.dataset.state = 'ending';
          const raw = getComputedStyle(document.documentElement).getPropertyValue('--duration-toast-transform').trim();
          const ms = Number.parseFloat(raw) * (raw.endsWith('ms') ? 1 : 1000);
          // main保留500ms退出阶段和当前焦点，到移除时才回到document。
          data.exitTimer = setTimeout(() => {
            data.immediate = true;
            const leaving = [...viewport.querySelectorAll('.toast')].find(node => node.dataset.toastId === id);
            // 与main一样移除实际节点，让浏览器处理焦点；不先blur或转焦下一条。
            leaving?.remove();
            toaster.dismiss(id);
          }, Number.isFinite(ms) ? ms : 500);
        },
      });
      return id;
    }
    function close(id) { toaster.dismiss(id); }
    return Object.freeze({ show, close });
  }
  global.createToastControl = createToastControl;
})(window);
