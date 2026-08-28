/**
 * [INPUT]: 依赖 index.html 的原生 select 数据槽、combobox trigger、listbox popup 与 option 容器，依赖浏览器键盘/指针事件和 ARIA 属性。
 * [OUTPUT]: 对外提供 createSelectControl 工厂，以 Base UI 的 open/active/selected 状态边界和选中项锚定触发器的 positioner 语义实现单选菜单、方向键/Home/End/Enter/Space/Escape/typeahead 与外部点击收口。
 * [POS]: renderer 的无依赖选择器组件状态机；只管理选择交互和无障碍投影，不读取业务状态、不调用 Tauri，也不引入 React、组件库或 CDN。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
(function attachSelectControl(global) {
  'use strict';

  function createSelectControl({ root, select, trigger, value, popup, list }) {
    let open = false;
    let activeIndex = -1;
    let options = [];
    let typeahead = '';
    let typeaheadTimer = null;

    function selectedIndex() {
      return options.findIndex((option) => option.value === select.value);
    }

    function alignPopupToSelectedItem(selected) {
      const item = list.children[selected];
      if (!item || !popup.style || typeof trigger.getBoundingClientRect !== 'function' || typeof item.getBoundingClientRect !== 'function') return;

      // Base UI 默认让选中项的视觉中心与 Trigger 对齐。这里先归零，再由真实布局盒推导偏移，
      // 避免复制一组只对单一字体或语言成立的位置魔法数。
      popup.style.top = '0px';
      const triggerRect = trigger.getBoundingClientRect();
      const itemRect = item.getBoundingClientRect();
      const alignedTop = triggerRect.top + triggerRect.height / 2 - itemRect.top - itemRect.height / 2;
      popup.style.top = `${alignedTop}px`;
    }

    function renderState() {
      root.dataset.state = open ? 'open' : 'closed';
      popup.dataset.state = open ? 'open' : 'closed';
      trigger.setAttribute('aria-expanded', String(open));
      popup.hidden = !open;
      const selected = selectedIndex();
      value.textContent = selected >= 0 ? options[selected].label : '';

      for (const [index, item] of Array.from(list.children).entries()) {
        const isSelected = index === selected;
        const isActive = open && index === activeIndex;
        item.dataset.highlighted = String(isActive);
        item.setAttribute('aria-selected', String(isSelected));
      }

      if (open && activeIndex >= 0) {
        trigger.setAttribute('aria-activedescendant', list.children[activeIndex].id);
        alignPopupToSelectedItem(selected >= 0 ? selected : activeIndex);
      } else {
        trigger.removeAttribute('aria-activedescendant');
        popup.style?.removeProperty?.('top');
      }
    }

    function setOpen(nextOpen) {
      if (trigger.disabled) nextOpen = false;
      open = nextOpen;
      if (open) {
        const selected = selectedIndex();
        activeIndex = selected >= 0 ? selected : 0;
      }
      renderState();
    }

    function setActive(nextIndex) {
      if (!options.length) return;
      activeIndex = (nextIndex + options.length) % options.length;
      renderState();
      list.children[activeIndex]?.scrollIntoView?.({ block: 'nearest' });
    }

    function commit(index) {
      if (index < 0 || index >= options.length) return;
      select.value = options[index].value;
      activeIndex = index;
      setOpen(false);
      trigger.focus();
    }

    function createItem(option, index) {
      const item = document.createElement('div');
      item.id = `languageSelectOption-${index}`;
      item.className = 'select-item';
      item.dataset.value = option.value;
      item.setAttribute('role', 'option');
      item.addEventListener('pointermove', () => {
        if (activeIndex !== index) setActive(index);
      });
      item.addEventListener('pointerdown', (event) => event.preventDefault());
      item.addEventListener('click', () => commit(index));

      const label = document.createElement('span');
      label.textContent = option.label;
      item.append(label);

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
      options = nextOptions.map(({ value: optionValue, label }) => ({
        value: String(optionValue),
        label: String(label),
      }));
      select.replaceChildren();
      list.replaceChildren();
      for (const [index, option] of options.entries()) {
        const nativeOption = document.createElement('option');
        nativeOption.value = option.value;
        nativeOption.textContent = option.label;
        select.append(nativeOption);
        list.append(createItem(option, index));
      }
      if (!options.some((option) => option.value === select.value)) {
        select.value = options[0]?.value || '';
      }
      renderState();
    }

    function setValue(nextValue) {
      select.value = String(nextValue || '');
      renderState();
    }

    function setDisabled(disabled) {
      select.disabled = disabled;
      trigger.disabled = disabled;
      if (disabled) setOpen(false);
    }

    function moveTypeahead(key) {
      clearTimeout(typeaheadTimer);
      typeahead += key.toLocaleLowerCase();
      const start = activeIndex < 0 ? 0 : activeIndex + 1;
      for (let offset = 0; offset < options.length; offset += 1) {
        const index = (start + offset) % options.length;
        if (options[index].label.toLocaleLowerCase().startsWith(typeahead)) {
          setActive(index);
          break;
        }
      }
      typeaheadTimer = setTimeout(() => { typeahead = ''; }, 500);
    }

    trigger.addEventListener('click', () => setOpen(!open));
    trigger.addEventListener('keydown', (event) => {
      if (event.key === 'Tab') {
        setOpen(false);
        return;
      }
      if (event.key === 'Escape') {
        if (open) event.preventDefault();
        setOpen(false);
        return;
      }
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        if (!open) setOpen(true);
        else setActive(activeIndex + (event.key === 'ArrowDown' ? 1 : -1));
        return;
      }
      if (event.key === 'Home' || event.key === 'End') {
        event.preventDefault();
        if (!open) setOpen(true);
        setActive(event.key === 'Home' ? 0 : options.length - 1);
        return;
      }
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        if (open) commit(activeIndex);
        else setOpen(true);
        return;
      }
      if (event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
        if (!open) setOpen(true);
        moveTypeahead(event.key);
      }
    });

    document.addEventListener('pointerdown', (event) => {
      if (open && !root.contains(event.target)) setOpen(false);
    });

    renderState();
    return Object.freeze({ setOptions, setValue, setDisabled });
  }

  global.createSelectControl = createSelectControl;
})(window);
