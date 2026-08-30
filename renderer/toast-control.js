/**
 * [INPUT]: 依赖标准 DOM/Window 事件、button.css/tokens.css/toast.css 的视觉状态与 cavalryIcons 的受控语义图标工厂。
 * [OUTPUT]: 对外提供 createToastControl；以 Base UI 1.6.0 的 5 秒/3 条默认值管理右下 Toast，悬停、键盘焦点或窗口失焦时暂停并保留剩余时间。
 * [POS]: renderer 的共享短时通知状态机；只承载不属于主任务流的局部失败，不读取 Tauri、不覆盖 Activity、不承担 AlertDialog 的决策职责。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
(function attachToastControl(global) {
  'use strict';

  const DEFAULT_TIMEOUT_MS = 5000;
  const DEFAULT_LIMIT = 3;
  const DEFAULT_EXIT_DURATION_MS = 500;
  const DEFAULT_STACK_GAP_PX = 12;
  const TYPE_ICONS = Object.freeze({
    success: 'checkCircle',
    info: 'infoCircle',
    warning: 'warningCircle',
    error: 'errorCircle',
    loading: 'spinner',
  });
  let nextToastId = 1;

  function setTimer(callback, delay) {
    const timer = globalThis.setTimeout(callback, delay);
    timer?.unref?.();
    return timer;
  }

  function readMillisecondsToken(name, fallback) {
    const styles = global.getComputedStyle?.(document.documentElement);
    const rawValue = styles?.getPropertyValue(name).trim();
    if (!rawValue) return fallback;
    const value = Number.parseFloat(rawValue);
    if (!Number.isFinite(value)) return fallback;
    if (rawValue.endsWith('ms')) return value;
    if (rawValue.endsWith('s')) return value * 1000;
    return fallback;
  }

  function createToastControl({
    label = 'Notifications',
    closeLabel = 'Close',
    timeout = DEFAULT_TIMEOUT_MS,
    limit = DEFAULT_LIMIT,
  } = {}) {
    const viewport = document.createElement('div');
    viewport.className = 'toast-viewport';
    viewport.dataset.expanded = 'false';
    viewport.setAttribute('data-slot', 'toast-viewport');
    viewport.setAttribute('role', 'region');
    viewport.setAttribute('aria-live', 'polite');
    viewport.setAttribute('aria-atomic', 'false');
    viewport.setAttribute('aria-relevant', 'additions text');
    viewport.setAttribute('aria-label', label);
    viewport.setAttribute('tabindex', '-1');
    document.body.append(viewport);

    const records = [];
    let hovering = false;
    let focused = false;
    let windowFocused = true;

    function isPaused() {
      return hovering || focused || !windowFocused;
    }

    function clearRecordTimer(record) {
      if (record.timer !== null) globalThis.clearTimeout(record.timer);
      record.timer = null;
    }

    function pauseTimers() {
      const now = Date.now();
      for (const record of records) {
        if (record.timer === null) continue;
        clearRecordTimer(record);
        record.remaining = Math.max(record.remaining - (now - record.startedAt), 0);
      }
    }

    function schedule(record) {
      if (isPaused() || record.type === 'loading' || record.remaining <= 0) return;
      record.startedAt = Date.now();
      record.timer = setTimer(() => close(record.id), record.remaining);
    }

    function resumeTimers() {
      for (const record of records) schedule(record);
    }

    function setExpanded(expanded) {
      viewport.dataset.expanded = String(expanded);
    }

    function layout() {
      let offset = 0;
      const styles = global.getComputedStyle?.(document.documentElement);
      const tokenGap = Number.parseFloat(styles?.getPropertyValue('--toast-stack-gap'));
      const stackGap = Number.isFinite(tokenGap) ? tokenGap : DEFAULT_STACK_GAP_PX;
      records.forEach((record, index) => {
        const height = record.node.getBoundingClientRect?.().height || record.node.offsetHeight || 0;
        record.node.style?.setProperty('--toast-index', String(index));
        record.node.style?.setProperty('--toast-offset-y', `${offset}px`);
        offset += height + stackGap;
      });
    }

    function finalize(record) {
      clearRecordTimer(record);
      const index = records.indexOf(record);
      if (index >= 0) records.splice(index, 1);
      record.node.remove?.();
      if (!record.node.remove) record.node.hidden = true;
      layout();
    }

    function close(id) {
      const record = records.find((candidate) => candidate.id === id);
      if (!record || record.node.dataset.state === 'ending') return;
      clearRecordTimer(record);
      record.node.dataset.state = 'ending';
      const exitDuration = readMillisecondsToken('--duration-toast-transform', DEFAULT_EXIT_DURATION_MS);
      setTimer(() => finalize(record), exitDuration);
    }

    function createNode({ id, title, description, type }) {
      const node = document.createElement('section');
      const content = document.createElement('div');
      const copy = document.createElement('div');
      const titleNode = document.createElement('div');
      const descriptionNode = document.createElement('div');
      const closeButton = document.createElement('button');

      node.className = 'toast';
      node.dataset.state = 'starting';
      node.dataset.type = type;
      node.setAttribute('data-slot', 'toast');
      node.setAttribute('role', 'dialog');
      node.setAttribute('aria-modal', 'false');
      node.setAttribute('aria-labelledby', `${id}-title`);
      node.setAttribute('aria-describedby', `${id}-description`);
      node.setAttribute('tabindex', '0');

      content.className = 'toast-content';
      content.setAttribute('data-slot', 'toast-content');
      const icon = global.cavalryIcons?.create(TYPE_ICONS[type]);
      if (icon) {
        const iconSlot = document.createElement('span');
        iconSlot.className = 'toast-icon';
        iconSlot.setAttribute('data-slot', 'toast-icon');
        iconSlot.append(icon);
        content.append(iconSlot);
      }

      copy.className = 'toast-copy';
      titleNode.id = `${id}-title`;
      titleNode.className = 'toast-title';
      titleNode.textContent = title;
      titleNode.setAttribute('data-slot', 'toast-title');
      descriptionNode.id = `${id}-description`;
      descriptionNode.className = 'toast-description';
      descriptionNode.textContent = description;
      descriptionNode.setAttribute('data-slot', 'toast-description');
      copy.append(titleNode, descriptionNode);

      closeButton.type = 'button';
      closeButton.className = 'ui-button toast-close';
      closeButton.setAttribute('data-slot', 'toast-close');
      closeButton.setAttribute('data-variant', 'ghost');
      closeButton.setAttribute('aria-label', closeLabel);
      const closeIcon = global.cavalryIcons?.create('close');
      if (closeIcon) closeButton.append(closeIcon);
      closeButton.addEventListener('click', () => close(id));
      node.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') close(id);
      });

      content.append(copy, closeButton);
      node.append(content);
      return node;
    }

    function show({ title, description, type = 'error', timeout: itemTimeout = timeout }) {
      const id = `toast-${nextToastId++}`;
      const node = createNode({ id, title, description, type });
      const record = {
        id,
        node,
        type,
        timer: null,
        startedAt: 0,
        remaining: Math.max(0, itemTimeout),
      };
      records.unshift(record);
      viewport.append(node);
      while (records.length > limit) finalize(records[records.length - 1]);
      layout();
      schedule(record);
      setTimer(() => {
        if (node.dataset.state === 'starting') node.dataset.state = 'open';
      }, 0);
      return id;
    }

    viewport.addEventListener('mouseenter', () => {
      hovering = true;
      setExpanded(true);
      pauseTimers();
    });
    viewport.addEventListener('mouseleave', () => {
      hovering = false;
      setExpanded(focused);
      if (!isPaused()) resumeTimers();
    });
    viewport.addEventListener('focusin', () => {
      focused = true;
      setExpanded(true);
      pauseTimers();
    });
    viewport.addEventListener('focusout', (event) => {
      if (viewport.contains(event.relatedTarget)) return;
      focused = false;
      setExpanded(hovering);
      if (!isPaused()) resumeTimers();
    });
    global.addEventListener('blur', () => {
      windowFocused = false;
      pauseTimers();
    });
    global.addEventListener('focus', () => {
      windowFocused = true;
      if (!isPaused()) resumeTimers();
    });
    document.addEventListener('keydown', (event) => {
      if (event.key !== 'F6' || records.length === 0) return;
      event.preventDefault?.();
      records[0].node.focus();
    });

    return Object.freeze({ show, close });
  }

  global.createToastControl = createToastControl;
})(window);
