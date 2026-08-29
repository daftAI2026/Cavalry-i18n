/**
 * [INPUT]: 依赖标准 DOM 的文本/滚动节点与 icons.js 的冻结语义 SVG 工厂，消费 app.js 提供的本地化任务引言、整体结果、阶段说明、状态与可选图标名
 * [OUTPUT]: 对外提供 createOperationLog；idle 以完整面板双轴居中，running 固定首尾 Message 并只让中段 Marker 视窗滚动，首尾按词组 text delta 非阻塞更新同一节点且每次布局变化重算中段溢出与起止边缘，真实阶段按稳定 id 串行投影并让错误立即抢占
 * [POS]: renderer 的任务反馈状态机；位于业务语义映射与 operation-log.css 之间，不读取 Tauri、语言包或 Cavalry 安装状态，不阻塞后端事务，只把已到达的机器事件按可读节奏投影
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

  function splitTextDeltas(text) {
    return String(text || '').match(/\S+\s*/g) || [];
  }

  function createOperationLog({ root, idleMessage, intro, viewport, list, outcome }) {
    const entries = new Map();
    const messageTokens = { intro: 0, outcome: 0 };
    const visualQueue = [];
    let followLiveEdge = true;
    let visualGeneration = 0;
    let visualQueueRunning = false;
    let activeVisualItem = null;
    let pendingTimer = null;
    let releasePendingTimer = null;
    let lastVisualChangeAt = 0;

    function cssNumber(name) {
      return Math.max(0, Number.parseFloat(getComputedStyle(root).getPropertyValue(name)) || 0);
    }

    function motionDuration(name) {
      if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return 0;
      return cssNumber(name);
    }

    function now() {
      return Date.now();
    }

    function waitForVisualDelay(delay, generation) {
      if (delay <= 0 || generation !== visualGeneration) return Promise.resolve();
      return new Promise((resolve) => {
        releasePendingTimer = resolve;
        pendingTimer = setTimeout(() => {
          pendingTimer = null;
          releasePendingTimer = null;
          resolve();
        }, delay);
      });
    }

    function cancelVisualQueue({ flushEvents = false } = {}) {
      const pendingItems = [activeVisualItem, ...visualQueue].filter(Boolean);
      visualGeneration += 1;
      visualQueue.length = 0;
      visualQueueRunning = false;
      activeVisualItem = null;
      if (pendingTimer !== null) clearTimeout(pendingTimer);
      pendingTimer = null;
      const release = releasePendingTimer;
      releasePendingTimer = null;
      if (release) release();
      lastVisualChangeAt = 0;
      if (flushEvents) {
        for (const item of pendingItems) {
          if (item.kind === 'event') renderEvent(item.event);
        }
      }
    }

    function cancelMessage(slot, target) {
      messageTokens[slot] += 1;
      target.textContent = '';
      target.hidden = true;
      if (slot === 'outcome') root.dataset.hasOutcome = 'false';
    }

    function streamMessage(slot, target, text, onLayoutChange) {
      const deltas = splitTextDeltas(text);
      const token = ++messageTokens[slot];
      target.textContent = '';
      target.hidden = deltas.length === 0;
      onLayoutChange?.();
      const interval = motionDuration('--duration-message-delta');
      if (interval === 0) {
        target.textContent = deltas.join('');
        onLayoutChange?.();
        return;
      }
      let index = 0;
      function writeNextDelta() {
        if (token !== messageTokens[slot] || index >= deltas.length) return;
        target.textContent = `${target.textContent}${deltas[index]}`;
        onLayoutChange?.();
        index += 1;
        if (index < deltas.length) setTimeout(writeNextDelta, interval);
      }
      writeNextDelta();
    }

    function clearMessages() {
      cancelMessage('intro', intro);
      cancelMessage('outcome', outcome);
    }

    function clearEntries() {
      cancelVisualQueue();
      entries.clear();
      list.replaceChildren();
      viewport.dataset.overflowing = 'false';
      viewport.dataset.atStart = 'true';
      viewport.dataset.atEnd = 'true';
      viewport.scrollTop = 0;
      followLiveEdge = true;
    }

    function setMode(mode) {
      root.dataset.mode = mode;
      if (mode !== 'running') root.dataset.hasOutcome = 'false';
      idleMessage.hidden = mode !== 'idle';
      viewport.hidden = mode === 'idle';
    }

    function syncScrollFade() {
      const maxScroll = Math.max(0, viewport.scrollHeight - viewport.clientHeight);
      const edgeTolerance = cssNumber('--operation-scroll-edge-tolerance');
      const overflowing = maxScroll > edgeTolerance;
      viewport.dataset.overflowing = overflowing ? 'true' : 'false';
      viewport.dataset.atStart = String(!overflowing || viewport.scrollTop <= edgeTolerance);
      viewport.dataset.atEnd = String(!overflowing || viewport.scrollTop >= maxScroll - edgeTolerance);
      return overflowing;
    }

    function scrollToLatest() {
      const overflowing = syncScrollFade();
      if (!overflowing) {
        viewport.scrollTop = 0;
        followLiveEdge = true;
      } else if (followLiveEdge) {
        viewport.scrollTop = viewport.scrollHeight;
        syncScrollFade();
      }
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
      copy.append(title, description);
      row.append(marker, copy);
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

    function renderEvent({ id, title, description = '', state = 'neutral', icon }) {
      if (!id || !title) return;
      if (root.dataset.mode === 'idle') setMode('events');
      const entry = entries.get(id) || createEntry(id);
      const iconName = icon === undefined ? DEFAULT_ICON_BY_STATE[state] || '' : icon;
      entry.row.dataset.state = state;
      entry.row.dataset.hasDescription = description ? 'true' : 'false';
      entry.title.textContent = title;
      entry.description.textContent = description;
      entry.description.hidden = !description;
      setMarker(entry, iconName);
      entry.lastStateAt = now();
      root.dataset.state = state;
      lastVisualChangeAt = entry.lastStateAt;
      scrollToLatest();
    }

    function visualDelayFor(event) {
      const entry = entries.get(event.id);
      if (entry?.row.dataset.state === 'running' && event.state !== 'running') {
        const elapsed = now() - entry.lastStateAt;
        return Math.max(0, motionDuration('--duration-operation-running-min') - elapsed);
      }
      if (!entry && entries.size > 0) {
        const elapsed = now() - lastVisualChangeAt;
        return Math.max(0, motionDuration('--duration-operation-step-gap') - elapsed);
      }
      return 0;
    }

    async function drainVisualQueue(generation) {
      while (generation === visualGeneration && visualQueue.length > 0) {
        const item = visualQueue.shift();
        activeVisualItem = item;
        const delay = item.kind === 'event'
          ? visualDelayFor(item.event)
          : motionDuration('--duration-operation-step-gap');
        if (delay > 0) await waitForVisualDelay(delay, generation);
        if (generation !== visualGeneration) return;
        if (item.kind === 'event') renderEvent(item.event);
        else if (!['warning', 'error'].includes(root.dataset.state)) {
          root.dataset.hasOutcome = 'true';
          streamMessage('outcome', outcome, item.message, scrollToLatest);
        }
        activeVisualItem = null;
      }
      if (generation === visualGeneration) visualQueueRunning = false;
    }

    function enqueueVisual(item) {
      visualQueue.push(item);
      if (visualQueueRunning) return;
      visualQueueRunning = true;
      void drainVisualQueue(visualGeneration);
    }

    function upsert(event) {
      if (!event?.id || !event.title) return;
      if (root.dataset.mode !== 'running') {
        renderEvent(event);
        return;
      }
      if (event.state === 'error') {
        cancelVisualQueue({ flushEvents: true });
        renderEvent(event);
        return;
      }
      enqueueVisual({ kind: 'event', event });
    }

    function clear() {
      clearEntries();
      clearMessages();
      root.dataset.state = 'neutral';
      setMode('idle');
    }

    function replace(event) {
      clearEntries();
      clearMessages();
      setMode('events');
      upsert(event);
    }

    function idle() {
      clear();
    }

    function setIdleMessage(text) {
      idleMessage.textContent = text;
    }

    function start({ intro: message }) {
      clearEntries();
      clearMessages();
      root.dataset.state = 'running';
      setMode('running');
      streamMessage('intro', intro, message, scrollToLatest);
    }

    function complete(message) {
      if (root.dataset.mode !== 'running' || ['warning', 'error'].includes(root.dataset.state)) return;
      enqueueVisual({ kind: 'outcome', message });
    }

    function finishRunning(state = 'error') {
      cancelVisualQueue();
      cancelMessage('outcome', outcome);
      for (const entry of entries.values()) {
        if (entry.row.dataset.state !== 'running') continue;
        entry.row.dataset.state = state;
        setMarker(entry, DEFAULT_ICON_BY_STATE[state] || '');
      }
      root.dataset.state = state;
    }

    viewport.addEventListener('scroll', () => {
      const remaining = viewport.scrollHeight - viewport.clientHeight - viewport.scrollTop;
      followLiveEdge = remaining <= cssNumber('--operation-live-edge-tolerance');
      syncScrollFade();
    });
    setMode('idle');

    return Object.freeze({ clear, idle, setIdleMessage, start, complete, replace, upsert, finishRunning });
  }

  window.createOperationLog = createOperationLog;
})();
