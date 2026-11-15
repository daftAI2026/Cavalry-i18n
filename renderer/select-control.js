/**
 * [INPUT]: 依赖 UI SDK 0.1.0-beta.2 的本地 Web Components 与既有 Select DOM、样式和业务 options。
 * [OUTPUT]: 保持 createSelectControl 四方法接口；只投影标签、徽章、原生值和业务回调，选择、键盘、焦点及弹层由 UI SDK 管理。
 * [POS]: Select 的展示适配层；不访问 Tauri、不预选语言，不保留第二套交互状态机；离线 SDK 由 build_ui_sdk.js 生成。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
(function attachSelectControl(global) {
  'use strict';

  function createSelectControl({ root, select, trigger, value, popup, popupPlaceholder, list, onValueChange = () => {} }) {
    let options = [];
    let placeholder = '';

    function normalizeBadge(badge) {
      if (typeof badge === 'string') return { label: badge, kind: '', ariaLabel: badge };
      if (!badge || typeof badge !== 'object' || !badge.label && !badge.text) return null;
      return {
        label: String(badge.label || badge.text),
        kind: badge.kind || badge.tone || badge.variant || '',
        ariaLabel: badge.ariaLabel || badge.label || badge.text,
      };
    }

    function renderValue() {
      const option = options.find((item) => item.value === select.value);
      const hasSelection = Boolean(option);
      root.dataset.placeholder = String(!hasSelection);
      value.dataset.placeholder = String(!hasSelection);
      value.replaceChildren();
      if (option) {
        value.append(createOptionCopy(option));
        value.setAttribute('aria-label', optionAccessibleLabel(option));
      } else {
        value.textContent = placeholder;
        value.removeAttribute('aria-label');
      }
      popupPlaceholder.textContent = placeholder;
      popupPlaceholder.hidden = hasSelection;
    }

    function optionAccessibleLabel(option) {
      return option.ariaLabel || [option.label, option.badge?.ariaLabel].filter(Boolean).join(', ');
    }

    function createOptionCopy(option) {
      const copy = document.createElement('span');
      copy.className = 'select-item-copy';
      const label = document.createElement('span');
      label.className = 'select-item-label';
      label.textContent = option.label;
      copy.append(label);

      if (option.badge) {
        const badge = document.createElement('cv-badge');
        badge.className = 'badge select-item-badge';
        if (option.badge.kind) badge.dataset.kind = option.badge.kind;
        badge.textContent = option.badge.label;
        badge.setAttribute('aria-hidden', 'true');
        copy.append(badge);
      }
      return copy;
    }

    function createItem(option, index) {
      const item = document.createElement('cv-select-item');
      item.id = `languageSelectOption-${index}`;
      item.className = 'select-item';
      item.setAttribute('value', option.value);
      item.setAttribute('label', option.label);
      if (option.disabled) item.setAttribute('disabled', '');
      item.setAttribute('aria-label', optionAccessibleLabel(option));
      item.append(createOptionCopy(option));
      const indicator = document.createElement('span');
      indicator.className = 'select-item-indicator';
      indicator.setAttribute('aria-hidden', 'true');
      const check = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      check.setAttribute('viewBox', '0 0 24 24');
      check.setAttribute('fill', 'none');
      check.setAttribute('stroke', 'currentColor');
      check.setAttribute('stroke-width', '2');
      check.setAttribute('stroke-linecap', 'round');
      check.setAttribute('stroke-linejoin', 'round');
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', 'm20 6-11 11-5-5');
      check.append(path);
      indicator.append(check);
      item.append(indicator);
      return item;
    }

    function setOptions(nextOptions) {
      const previousValue = select.value;
      options = nextOptions.map((option) => ({
        value: String(option.value), label: String(option.label),
        disabled: Boolean(option.disabled), badge: normalizeBadge(option.badge),
        ariaLabel: typeof option.ariaLabel === 'string' ? option.ariaLabel : '',
      }));
      select.replaceChildren();
      list.replaceChildren();
      for (const [index, option] of options.entries()) {
        const nativeOption = document.createElement('option');
        nativeOption.value = option.value;
        nativeOption.textContent = option.label;
        nativeOption.disabled = option.disabled;
        select.append(nativeOption);
        list.append(createItem(option, index));
      }
      select.value = options.some((option) => option.value === previousValue) ? previousValue : '';
      syncSdkValue();
      renderValue();
    }

    function syncSdkValue() {
      // main允许后端刷新在禁用期同步值，Core primitive保持这一程序接口。
      root.value = select.value || null;
    }

    function setValue(nextValue) {
      select.value = String(nextValue || '');
      syncSdkValue();
      renderValue();
      onValueChange(select.value);
    }

    function setPlaceholder(nextPlaceholder) {
      placeholder = String(nextPlaceholder || '');
      renderValue();
    }

    function setDisabled(disabled) {
      select.disabled = disabled;
      if (disabled) root.open = false;
      root.api.setDisabled(disabled);
      root.toggleAttribute('disabled',disabled);
      trigger.disabled = disabled;
    }

    root.addEventListener('valuechange', (event) => {
      select.value = event.detail.value || '';
      renderValue();
      onValueChange(select.value);
    });
    root.addEventListener('openchange', (event) => {
      root.dataset.state = event.detail.value ? 'open' : 'closed';
      popup.dataset.state = root.dataset.state;
      renderValue();
    });
    renderValue();
    return Object.freeze({ setOptions, setValue, setPlaceholder, setDisabled });
  }

  global.createSelectControl = createSelectControl;
})(window);
