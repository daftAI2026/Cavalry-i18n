/**
 * [INPUT]: 依赖SDK createStickToBottom/Progress和标准DOM；只拥有任务文字/渐隐，跟随状态由SDK按既有4px边界管理
 * [OUTPUT]: 对外提供 createOperationLog；idle 双轴居中，running 固定首尾并只让中段滚动；DOM文字和阶段立即更新，同帧尺寸/渐隐/live edge集中在绘制前一次测量，保留可读队列、紧急抢占及阻断项落位后的共享停顿
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
    const follow = window.cavalryUi.createStickToBottom({ threshold: cssNumber('--operation-live-edge-tolerance') });
    const disconnect = follow.connect(viewport);
    window.addEventListener('pagehide', disconnect, { once: true });
    const entries = new Map();
    const messageTokens = { intro: 0, outcome: 0 };
    const visualQueue = [];
    let visualGeneration = 0;
    let visualQueueRunning = false;
    let activeVisualItem = null;
    let pendingTimer = null;
    let releasePendingTimer = null;
    let lastVisualChangeAt = 0;
    let layoutFrame = null;

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
      viewport.dataset.fadeAtStart = 'true';
      viewport.dataset.fadeAtEnd = 'true';
      viewport.scrollTop = 0;
      follow.scrollToBottom({behavior:'instant'});
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
      viewport.dataset.fadeAtStart = String(!overflowing || viewport.scrollTop <= edgeTolerance);
      viewport.dataset.fadeAtEnd = String(!overflowing || viewport.scrollTop >= maxScroll - edgeTolerance);
      return overflowing;
    }

    function scrollToLatest() {
      const overflowing = syncScrollFade();
      if (!overflowing) {
        viewport.scrollTop = 0;
        follow.scrollToBottom({behavior:'instant'});
      } else if (follow.get().following) {
        follow.scrollToBottom({behavior:'instant'});
        syncScrollFade();
      }
    }

    function syncAfterLayout() {
      if (layoutFrame !== null || typeof window.requestAnimationFrame !== 'function') return;
      layoutFrame = window.requestAnimationFrame(() => {
        layoutFrame = null;
        scrollToLatest();
      });
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
      const entry = { row, marker, title, description, copy, progress: null };
      entries.set(id, entry);
      return entry;
    }

    function setMarker(entry, iconName) {
      const icon = createIcon(iconName);
      entry.marker.dataset.icon = iconName;
      entry.marker.hidden = !icon;
      entry.marker.replaceChildren(...(icon ? [icon] : []));
    }

    function renderEvent({ id, title, description = '', state = 'neutral', icon, progress }) {
      if (!id || !title) return;
      if (root.dataset.mode === 'idle') setMode('events');
      const entry = entries.get(id) || createEntry(id);
      const iconName = icon === undefined ? DEFAULT_ICON_BY_STATE[state] || '' : icon;
      entry.row.dataset.state = state;
      entry.row.dataset.hasDescription = description ? 'true' : 'false';
      entry.title.textContent = title;
      if (Number.isFinite(progress)) {
        if (!entry.progress) {
          entry.progress = document.createElement('ui-progress');
          entry.progress.className = 'operation-event-progress';
          entry.copy.append(entry.progress);
          entry.progress.append(entry.description);
        }
        entry.progress.setAttribute('value', String(progress));
        entry.progress.setAttribute('aria-label', title);
      }
      entry.description.textContent = description;
      entry.description.hidden = !description;
      setMarker(entry, iconName);
      entry.lastStateAt = now();
      root.dataset.state = state;
      lastVisualChangeAt = entry.lastStateAt;
      syncAfterLayout();
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
          streamMessage('outcome', outcome, item.message, syncAfterLayout);
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
      if (event.state === 'error' || event.urgent === true) {
        cancelVisualQueue({ flushEvents: true });
        renderEvent(event);
        return;
      }
      enqueueVisual({ kind: 'event', event });
    }

    async function presentBlocking(event) {
      upsert({ ...event, urgent: true });
      const dwell = cssNumber('--duration-operation-blocking-dwell');
      if (dwell > 0) await new Promise((resolve) => setTimeout(resolve, dwell));
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
      streamMessage('intro', intro, message, syncAfterLayout);
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
      syncScrollFade();
    });
    setMode('idle');

    return Object.freeze({ clear, idle, setIdleMessage, start, complete, replace, upsert, presentBlocking, remeasure: syncAfterLayout, finishRunning });
  }

  window.createOperationLog = createOperationLog;
})();
