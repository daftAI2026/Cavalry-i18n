/**
 * [INPUT]: 依赖固定的更新 Dialog/Scroll Area DOM、四语 text 函数与共享 SVG 图标工厂；更新数据来自 bridge 已验证的检查结果
 * [OUTPUT]: 对外提供 createUpdateDialog，以安全文本节点显示更新说明，并仅在 SDK Dialog 以 install 返回值关闭时回调一次快照
 * [POS]: renderer 的更新说明展示适配器；SDK 拥有弹层、焦点、关闭和滚动交互，本模块只投影数据与文案
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
(() => {
  function createUpdateDialog({ root, text, onInstall = () => {}, icons }) {
    const title = root.querySelector('#updateDialogTitle');
    const version = root.querySelector('#updateDialogVersion');
    const date = root.querySelector('#updateDialogDate');
    const notes = root.querySelector('#updateDialogNotes');
    const scroll = root.querySelector('#updateDialogScroll');
    const viewport = scroll.querySelector('ui-scroll-area-viewport');
    const closeButton = root.querySelector('#updateDialogClose');
    const laterButton = root.querySelector('#updateDialogLater');
    const installButton = root.querySelector('#updateDialogInstall');
    let activeUpdate = null;

    const closeIcon = icons?.create('close');
    if (closeIcon) closeButton.append(closeIcon);

    function formatDate(value) {
      if (typeof value !== 'string' || !value.trim()) return '';
      const parsed = new Date(value);
      if (!Number.isFinite(parsed.getTime())) return '';
      const locale = document.documentElement.lang || undefined;
      return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(parsed);
    }

    function renderNotes(source) {
      notes.replaceChildren();
      if (typeof source !== 'string' || !source.trim()) {
        const empty = document.createElement('p');
        empty.className = 'update-notes-empty';
        empty.textContent = text('updateNotesEmpty');
        notes.append(empty);
        return;
      }

      const normalized = source.replace(/\r\n?/g, '\n');
      const lines = normalized.split('\n');
      const headingPattern = /^###\s+\S/;
      const bulletPattern = /^\s*-\s+\S/;
      if (!lines.some((line) => headingPattern.test(line) || bulletPattern.test(line))) {
        notes.textContent = source;
        return;
      }

      let paragraph = [];
      let list = null;
      function flushParagraph() {
        if (!paragraph.length) return;
        const element = document.createElement('p');
        element.textContent = paragraph.join('\n');
        notes.append(element);
        paragraph = [];
      }

      for (const line of lines) {
        const heading = line.match(/^###\s+(.+?)\s*$/);
        const bullet = line.match(/^\s*-\s+(.+?)\s*$/);
        if (!line.trim()) {
          flushParagraph();
          list = null;
        } else if (heading) {
          flushParagraph();
          list = null;
          const element = document.createElement('h3');
          element.textContent = heading[1];
          notes.append(element);
        } else if (bullet) {
          flushParagraph();
          if (!list) {
            list = document.createElement('ul');
            notes.append(list);
          }
          const item = document.createElement('li');
          item.textContent = bullet[1];
          list.append(item);
        } else {
          list = null;
          paragraph.push(line);
        }
      }
      flushParagraph();
    }

    function show(update) {
      const snapshot = Object.freeze({ ...update });
      activeUpdate = snapshot;
      const titleText = text('updateNotesTitle');
      title.textContent = titleText;
      closeButton.setAttribute('aria-label', text('close'));
      closeButton.title = text('close');
      laterButton.textContent = text('updateLater');
      installButton.textContent = text('installUpdate');
      version.textContent = typeof snapshot.version === 'string' ? snapshot.version : '';
      viewport.setAttribute('role', 'region');
      viewport.setAttribute('aria-label', titleText);
      renderNotes(snapshot.notes);

      const formattedDate = formatDate(snapshot.pubDate);
      date.hidden = !formattedDate;
      date.textContent = formattedDate;
      if (formattedDate) date.dateTime = snapshot.pubDate;
      else date.removeAttribute('datetime');

      viewport.scrollTop = 0;
      root.open = true;
    }

    function close() {
      activeUpdate = null;
      root.open = false;
    }

    root.addEventListener('openchange', (event) => {
      if (event.detail.value) return;
      const update = activeUpdate;
      activeUpdate = null;
      if (event.detail.returnValue === 'install' && update) onInstall(update);
    });

    return Object.freeze({ show, close });
  }

  window.createUpdateDialog = createUpdateDialog;
})();
