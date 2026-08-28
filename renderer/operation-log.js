/**
 * [INPUT]: 依赖标准 DOM 的列表/SVG/文本节点能力，消费 app.js 提供的稳定本地化事件标题、说明、状态与可选语义图标
 * [OUTPUT]: 对外提供 createOperationLog；按 shadcn Marker/MarkerIcon/MarkerContent 组合投影有序记录，运行态使用真实 Spinner 图标并由 CSS shimmer 扫过标题，静态图标仅表达事件语义
 * [POS]: renderer 的无依赖操作记录投影器；位于业务状态映射与 operation-log.css 之间，不读取 Tauri、语言包或 Cavalry 安装状态，也不自行推进操作阶段
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
(() => {
  const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';
  const DEFAULT_ICON_BY_STATE = Object.freeze({
    running: 'spinner',
    completed: 'check',
    warning: 'warning',
    error: 'error',
    neutral: '',
  });
  const ICONS = Object.freeze({
    spinner: {
      viewBox: '0 0 256 256',
      fill: true,
      paths: ['M136,32V64a8,8,0,0,1-16,0V32a8,8,0,0,1,16,0Zm37.25,58.75a8,8,0,0,0,5.66-2.35l22.63-22.62a8,8,0,0,0-11.32-11.32L167.6,77.09a8,8,0,0,0,5.65,13.66ZM224,120H192a8,8,0,0,0,0,16h32a8,8,0,0,0,0-16Zm-45.09,47.6a8,8,0,0,0-11.31,11.31l22.62,22.63a8,8,0,0,0,11.32-11.32ZM128,184a8,8,0,0,0-8,8v32a8,8,0,0,0,16,0V192A8,8,0,0,0,128,184ZM77.09,167.6,54.46,190.22a8,8,0,0,0,11.32,11.32L88.4,178.91A8,8,0,0,0,77.09,167.6ZM72,128a8,8,0,0,0-8-8H32a8,8,0,0,0,0,16H64A8,8,0,0,0,72,128ZM65.78,54.46A8,8,0,0,0,54.46,65.78L77.09,88.4A8,8,0,0,0,88.4,77.09Z'],
    },
    check: {
      viewBox: '0 0 256 256',
      fill: true,
      paths: ['M229.66,77.66l-128,128a8,8,0,0,1-11.32,0l-56-56a8,8,0,0,1,11.32-11.32L96,188.69,218.34,66.34a8,8,0,0,1,11.32,11.32Z'],
    },
    warning: {
      viewBox: '0 0 256 256',
      fill: true,
      paths: ['M236.8,188.09,149.35,36.22h0a24.76,24.76,0,0,0-42.7,0L19.2,188.09a23.51,23.51,0,0,0,0,23.72A24.35,24.35,0,0,0,40.55,224h174.9a24.35,24.35,0,0,0,21.33-12.19A23.51,23.51,0,0,0,236.8,188.09ZM222.93,203.8a8.5,8.5,0,0,1-7.48,4.2H40.55a8.5,8.5,0,0,1-7.48-4.2,7.59,7.59,0,0,1,0-7.72L120.52,44.21a8.75,8.75,0,0,1,15,0l87.45,151.87A7.59,7.59,0,0,1,222.93,203.8ZM120,144V104a8,8,0,0,1,16,0v40a8,8,0,0,1-16,0Zm20,36a12,12,0,1,1-12-12A12,12,0,0,1,140,180Z'],
    },
    error: {
      viewBox: '0 0 256 256',
      fill: true,
      paths: ['M165.66,101.66,139.31,128l26.35,26.34a8,8,0,0,1-11.32,11.32L128,139.31l-26.34,26.35a8,8,0,0,1-11.32-11.32L116.69,128,90.34,101.66a8,8,0,0,1,11.32-11.32L128,116.69l26.34-26.35a8,8,0,0,1,11.32,11.32ZM232,128A104,104,0,1,1,128,24,104.11,104.11,0,0,1,232,128Zm-16,0a88,88,0,1,0-88,88A88.1,88.1,0,0,0,216,128Z'],
    },
    inspect: {
      viewBox: '0 0 256 256',
      fill: true,
      paths: ['M229.66,218.34l-50.07-50.06a88.11,88.11,0,1,0-11.31,11.31l50.06,50.07a8,8,0,0,0,11.32-11.32ZM40,112a72,72,0,1,1,72,72A72.08,72.08,0,0,1,40,112Z'],
    },
    archive: {
      viewBox: '0 0 256 256',
      fill: true,
      paths: ['M224,48H32A16,16,0,0,0,16,64V88a16,16,0,0,0,16,16v88a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V104a16,16,0,0,0,16-16V64A16,16,0,0,0,224,48ZM208,192H48V104H208ZM224,88H32V64H224V88ZM96,136a8,8,0,0,1,8-8h48a8,8,0,0,1,0,16H104A8,8,0,0,1,96,136Z'],
    },
    translate: {
      viewBox: '0 0 256 256',
      fill: true,
      paths: ['M247.15,212.42l-56-112a8,8,0,0,0-14.31,0l-21.71,43.43A88,88,0,0,1,108,126.93,103.65,103.65,0,0,0,135.69,64H160a8,8,0,0,0,0-16H104V32a8,8,0,0,0-16,0V48H32a8,8,0,0,0,0,16h87.63A87.76,87.76,0,0,1,96,116.35a87.74,87.74,0,0,1-19-31,8,8,0,1,0-15.08,5.34A103.63,103.63,0,0,0,84,127a87.55,87.55,0,0,1-52,17,8,8,0,0,0,0,16,103.46,103.46,0,0,0,64-22.08,104.18,104.18,0,0,0,51.44,21.31l-26.6,53.19a8,8,0,0,0,14.31,7.16L148.94,192h70.11l13.79,27.58A8,8,0,0,0,240,224a8,8,0,0,0,7.15-11.58ZM156.94,176,184,121.89,211.05,176Z'],
    },
    restart: {
      viewBox: '0 0 256 256',
      fill: true,
      paths: ['M240,56v48a8,8,0,0,1-8,8H184a8,8,0,0,1,0-16H211.4L184.81,71.64l-.25-.24a80,80,0,1,0-1.67,114.78,8,8,0,0,1,11,11.63A95.44,95.44,0,0,1,128,224h-1.32A96,96,0,1,1,195.75,60L224,85.8V56a8,8,0,1,1,16,0Z'],
    },
    update: {
      viewBox: '0 0 256 256',
      fill: true,
      paths: ['M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216Zm37.66-101.66a8,8,0,0,1-11.32,11.32L136,107.31V168a8,8,0,0,1-16,0V107.31l-18.34,18.35a8,8,0,0,1-11.32-11.32l32-32a8,8,0,0,1,11.32,0Z'],
    },
  });

  function createIcon(name) {
    const definition = ICONS[name];
    if (!definition) return null;
    const icon = document.createElementNS(SVG_NAMESPACE, 'svg');
    icon.setAttribute('viewBox', definition.viewBox);
    icon.setAttribute('aria-hidden', 'true');
    icon.setAttribute('focusable', 'false');
    if (definition.fill) {
      icon.setAttribute('fill', 'currentColor');
    } else {
      icon.setAttribute('fill', 'none');
      icon.setAttribute('stroke', 'currentColor');
      icon.setAttribute('stroke-width', '2');
      icon.setAttribute('stroke-linecap', 'round');
      icon.setAttribute('stroke-linejoin', 'round');
    }
    for (const pathData of definition.paths) {
      const path = document.createElementNS(SVG_NAMESPACE, 'path');
      path.setAttribute('d', pathData);
      icon.append(path);
    }
    return icon;
  }

  function createOperationLog({ root, list }) {
    const entries = new Map();

    function scrollToLatest() {
      list.scrollTop = list.scrollHeight;
    }

    function createEntry(id) {
      const row = document.createElement('li');
      row.className = 'operation-event';
      row.dataset.eventId = id;

      const marker = document.createElement('span');
      marker.className = 'operation-event-marker';
      marker.setAttribute('aria-hidden', 'true');

      const copy = document.createElement('span');
      copy.className = 'operation-event-copy';

      const title = document.createElement('span');
      title.className = 'operation-event-title';

      const description = document.createElement('span');
      description.className = 'operation-event-description';

      copy.append(title);
      copy.append(description);
      row.append(marker);
      row.append(copy);
      list.append(row);

      const entry = { row, marker, title, description };
      entries.set(id, entry);
      return entry;
    }

    function setMarker(entry, iconName) {
      const icon = createIcon(iconName);
      entry.marker.dataset.icon = iconName;
      entry.marker.hidden = !icon;
      entry.marker.replaceChildren(...(icon ? [icon] : []));
    }

    function upsert({ id, title, description = '', state = 'neutral', icon }) {
      if (!id || !title) return;
      const entry = entries.get(id) || createEntry(id);
      const iconName = icon === undefined ? DEFAULT_ICON_BY_STATE[state] || '' : icon;
      entry.row.dataset.state = state;
      entry.row.dataset.hasDescription = description ? 'true' : 'false';
      entry.title.textContent = title;
      entry.description.textContent = description;
      entry.description.hidden = !description;
      setMarker(entry, iconName);
      root.dataset.state = state;
      scrollToLatest();
    }

    function clear() {
      entries.clear();
      list.replaceChildren();
      root.dataset.state = 'neutral';
    }

    function replace(event) {
      clear();
      upsert(event);
    }

    function finishRunning(state = 'error') {
      for (const entry of entries.values()) {
        if (entry.row.dataset.state !== 'running') continue;
        entry.row.dataset.state = state;
        setMarker(entry, DEFAULT_ICON_BY_STATE[state] || '');
      }
      root.dataset.state = state;
    }

    return Object.freeze({ clear, replace, upsert, finishRunning });
  }

  window.createOperationLog = createOperationLog;
})();
