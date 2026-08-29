/**
 * [INPUT]: 依赖标准 DOM 的视窗/列表/文本节点能力与 icons.js 的冻结语义 SVG 工厂，消费 app.js 提供的稳定本地化任务标题、事件说明、状态与可选图标名
 * [OUTPUT]: 对外提供 createOperationLog；事件从容器内边距后的顶部起排，内容触底后新增事件才推动旧记录向上；按 shadcn Marker/MarkerIcon/MarkerContent 有序 upsert，运行态使用 SpinnerGap 与 shimmer，完成态原位换成单色 Phosphor 业务图标
 * [POS]: renderer 的任务事件投影器；位于业务语义映射与 operation-log.css 之间，不读取 Tauri、语言包或 Cavalry 安装状态，也不虚构或自行推进业务阶段
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
(() => {
  const createIcon = window.cavalryIcons.create;
  const DEFAULT_ICON_BY_STATE = Object.freeze({
    running: 'spinner',
    completed: 'checkCircle',
    warning: 'warningCircle',
    error: 'errorCircle',
    neutral: '',
  });

  function createOperationLog({ root, viewport, list }) {
    const entries = new Map();

    function scrollToLatest() {
      const overflowing = viewport.scrollHeight > viewport.clientHeight;
      viewport.dataset.overflowing = overflowing ? 'true' : 'false';
      viewport.scrollTop = overflowing ? viewport.scrollHeight : 0;
    }

    function createEntry(id, variant = 'default') {
      const row = document.createElement('li');
      row.className = 'operation-event';
      row.dataset.eventId = id;
      row.dataset.variant = variant;

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

    function upsert({ id, title, description = '', state = 'neutral', icon, variant = 'default' }) {
      if (!id || (!title && variant !== 'separator')) return;
      const entry = entries.get(id) || createEntry(id, variant);
      const iconName = icon === undefined ? DEFAULT_ICON_BY_STATE[state] || '' : icon;
      entry.row.dataset.variant = variant;
      entry.row.dataset.state = state;
      entry.row.dataset.hasDescription = description ? 'true' : 'false';
      entry.row.dataset.empty = title ? 'false' : 'true';
      entry.title.textContent = title;
      entry.description.textContent = description;
      entry.description.hidden = !description;
      setMarker(entry, iconName);
      root.dataset.state = state;
      root.dataset.mode = 'events';
      scrollToLatest();
    }

    function clear() {
      entries.clear();
      list.replaceChildren();
      root.dataset.state = 'neutral';
      root.dataset.mode = 'idle';
      viewport.dataset.overflowing = 'false';
      viewport.scrollTop = 0;
    }

    function replace(event) {
      clear();
      upsert(event);
    }

    function idle() {
      clear();
      const entry = createEntry('idle', 'separator');
      entry.row.dataset.state = 'neutral';
      entry.row.dataset.empty = 'true';
      entry.row.setAttribute('aria-hidden', 'true');
      setMarker(entry, '');
      root.dataset.mode = 'idle';
    }

    function start({ id = 'operation', title }) {
      clear();
      upsert({ id, title, variant: 'separator', state: 'neutral', icon: '' });
    }

    function finishRunning(state = 'error') {
      for (const entry of entries.values()) {
        if (entry.row.dataset.state !== 'running') continue;
        entry.row.dataset.state = state;
        setMarker(entry, DEFAULT_ICON_BY_STATE[state] || '');
      }
      root.dataset.state = state;
    }

    return Object.freeze({ clear, idle, start, replace, upsert, finishRunning });
  }

  window.createOperationLog = createOperationLog;
})();
