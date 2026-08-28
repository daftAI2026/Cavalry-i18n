/**
 * [INPUT]: 依赖安装路径 root/prefix/leaf DOM 与 macOS app bundle、Windows executable 的绝对路径字符串
 * [OUTPUT]: 对外提供 createPathDisplay 工厂；Windows 去掉末尾 executable，路径超过 36 字符时按层级保留根与安装目录，并投影为可收缩前缀 + 固定末段
 * [POS]: renderer 安装摘要的无依赖文本投影器；只生成安装位置摘要与完整可访问名称，不规范化或改变后端选择的真实路径
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
(function attachPathDisplay(global) {
  'use strict';

  const MAX_DISPLAY_CHARACTERS = 36;
  const ELLIPSIS = '…';

  function characterLength(value) {
    return Array.from(value).length;
  }

  function takeCharacters(value, count) {
    return Array.from(value).slice(0, Math.max(0, count)).join('');
  }

  function displayLocation(path) {
    const slash = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
    const leaf = slash >= 0 ? path.slice(slash + 1) : path;
    return /\.exe$/i.test(leaf) && slash > 0 ? path.slice(0, slash) : path;
  }

  function pathRoot(path) {
    const drive = path.match(/^[A-Za-z]:[\\/]/)?.[0];
    if (drive) return drive;
    const unc = path.match(/^\\\\[^\\]+\\[^\\]+\\?/i)?.[0];
    if (unc) return unc;
    return path.startsWith('/') ? '/' : '';
  }

  function truncatePath(path) {
    if (characterLength(path) <= MAX_DISPLAY_CHARACTERS) return path;

    const separatorIndex = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
    if (separatorIndex < 0) {
      return `${takeCharacters(path, MAX_DISPLAY_CHARACTERS - 1)}${ELLIPSIS}`;
    }

    const separator = path[separatorIndex];
    const root = pathRoot(path);
    const remainder = path.slice(root.length);
    const segments = remainder.split(/[\\/]+/).filter(Boolean);
    const leaf = segments.pop() || '';
    const leading = [];

    function compose(parts, finalLeaf = leaf) {
      const head = `${root}${parts.length ? `${parts.join(separator)}${separator}` : ''}`;
      return `${head}${ELLIPSIS}${separator}${finalLeaf}`;
    }

    let candidate = compose(leading);
    for (const segment of segments) {
      const next = compose([...leading, segment]);
      if (characterLength(next) > MAX_DISPLAY_CHARACTERS) break;
      leading.push(segment);
      candidate = next;
    }

    if (characterLength(candidate) <= MAX_DISPLAY_CHARACTERS) return candidate;

    const fixedLength = characterLength(`${root}${ELLIPSIS}${separator}${ELLIPSIS}`);
    const leafBudget = MAX_DISPLAY_CHARACTERS - fixedLength;
    return compose(leading, `${takeCharacters(leaf, leafBudget)}${ELLIPSIS}`);
  }

  function splitPath(path) {
    const slash = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
    if (slash <= 0 || slash === path.length - 1) return { prefix: path, leaf: '' };
    return {
      prefix: path.slice(0, slash),
      leaf: path.slice(slash),
    };
  }

  function createPathDisplay({ root, prefix, leaf }) {
    function setText(value, kind) {
      const text = String(value || '');
      const accessibleText = kind === 'path' ? displayLocation(text) : text;
      const displayText = kind === 'path' ? truncatePath(accessibleText) : text;
      const parts = kind === 'path' ? splitPath(displayText) : { prefix: displayText, leaf: '' };
      root.dataset.display = kind;
      prefix.textContent = parts.prefix;
      leaf.textContent = parts.leaf;
      root.setAttribute('aria-label', accessibleText);
      // 原生 title 会制造一套不可控的 WebView Tooltip；完整文本仅交给可访问名称。
      root.removeAttribute('title');
    }

    return Object.freeze({
      setPath(path) { setText(path, 'path'); },
      setMessage(message) { setText(message, 'message'); },
    });
  }

  global.createPathDisplay = createPathDisplay;
})(window);
