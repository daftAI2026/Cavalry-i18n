/**
 * [INPUT]: SDK原生Select、业务选项/徽章及保留的原生值镜像。
 * [OUTPUT]: 四方法接线；业务锁定时关闭展开菜单，程序同步在同一任务内临时解除SDK禁用并立即恢复，保证锁定期也能清空；SDK拥有搜索、焦点、选择和ARIA，公开side-offset维持展开外观。
 * [POS]: 只做数据/展示映射，不复刻组件状态机。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
(function attachSelectControl(global) {
  'use strict';
  function createSelectControl({ root, select, trigger, value, badge, popup, popupPlaceholder, list, onValueChange = () => {} }) {
    function syncValue(nextValue = root.value) {
      select.value = nextValue || '';
      popupPlaceholder.hidden = Boolean(nextValue);
      if (nextValue) popup.removeAttribute('side-offset');
      else popup.setAttribute('side-offset', String(-parseFloat(getComputedStyle(trigger).height)));
      const status = root.items?.find(item => item.value === nextValue)?.badge;
      badge.hidden = !status;
      badge.textContent = typeof status === 'string' ? status : status?.label || status?.text || '';
      badge.dataset.kind = status?.kind || status?.tone || status?.variant || '';
      if (status) trigger.setAttribute('aria-describedby', badge.id);
      else trigger.removeAttribute('aria-describedby');
      onValueChange(select.value);
    }
    function setOptions(options) {
      const previous = root.value;
      const items = options.map(option => ({ ...option, value: String(option.value), label: String(option.label), disabled: Boolean(option.disabled) }));
      select.replaceChildren();
      list.replaceChildren();
      for (const item of items) {
        const native = document.createElement('option');
        native.value = item.value; native.textContent = item.label; native.disabled = item.disabled;
        select.append(native);
        const option = document.createElement('ui-select-item');
        option.className = 'select-item'; option.setAttribute('value', item.value); option.setAttribute('label', item.label);
        if (item.ariaLabel) option.setAttribute('aria-label', item.ariaLabel);
        if (item.disabled) option.setAttribute('disabled', '');
        const copy = document.createElement('span'); copy.className = 'select-item-copy';
        const label = document.createElement('span'); label.className = 'select-item-label'; label.textContent = item.label; copy.append(label);
        if (item.badge) {
          const badge = document.createElement('span'); badge.className = 'badge select-item-badge'; badge.setAttribute('aria-hidden', 'true');
          badge.textContent = typeof item.badge === 'string' ? item.badge : item.badge.label || item.badge.text || '';
          badge.dataset.kind = item.badge.kind || item.badge.tone || item.badge.variant || ''; copy.append(badge);
        }
        const indicator = document.createElement('ui-select-item-indicator'); indicator.className = 'select-item-indicator';
        const check = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); check.setAttribute('viewBox', '0 0 24 24'); check.setAttribute('fill', 'none'); check.setAttribute('stroke', 'currentColor'); check.setAttribute('stroke-width', '2');
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path'); path.setAttribute('d', 'm20 6-11 11-5-5'); check.append(path); indicator.append(check);
        option.append(copy, indicator); list.append(option);
      }
      root.items = items;
      setValue(items.some(item => item.value === previous) ? previous : null);
    }
    function setValue(nextValue) {
      const disabled = root.disabled;
      // SDK将value赋值视为交互：程序同步须在同一JS任务内解除并恢复禁用，回调前归还业务锁。
      try {
        if (disabled) root.disabled = false;
        root.value = nextValue || null;
      } finally {
        if (disabled) root.disabled = true;
      }
      syncValue();
    }
    function setPlaceholder(text) { root.placeholder = String(text || ''); value.placeholder = root.placeholder; popupPlaceholder.textContent = root.placeholder; }
    function setDisabled(disabled) {
      if (disabled) root.open = false;
      root.disabled = Boolean(disabled);
      select.disabled = Boolean(disabled);
    }
    root.addEventListener('valuechange', event => syncValue(event.detail.value));
    return Object.freeze({ setOptions, setValue, setPlaceholder, setDisabled });
  }
  global.createSelectControl = createSelectControl;
})(window);
