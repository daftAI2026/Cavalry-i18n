/**
 * [INPUT]: 依赖固定 cavalryI18n.openPrivacySecurity bridge、真实触发元素的 CSS viewport rect，以及业务层提供的 retry/error 回调。
 * [OUTPUT]: 对外提供 createPermissionHandoffController；同步冻结有限非负 source rect 与 CSS viewport，等待 native 确认 source 已捕获后再关闭原控件，并把 session Channel 的 retryRequested/dismissed/error 投影回原操作，且不把设置打开或 drop 接收误判为授权成功。
 * [POS]: renderer 的 macOS 权限交接边界；生产与 UI Review 共用同一请求/结果合同，工作台只能替换 bridge 结果，不能复制业务状态机。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
(function initializePermissionHandoff(global) {
  'use strict';

  const OUTCOMES = new Set(['retryRequested', 'dismissed', 'error']);

  function captureSourceRect(element) {
    if (!element || typeof element.getBoundingClientRect !== 'function') return null;
    const rect = element.getBoundingClientRect();
    const values = [rect.x, rect.y, rect.width, rect.height];
    if (!values.every(Number.isFinite) || rect.x < 0 || rect.y < 0 || rect.width <= 0 || rect.height <= 0) return null;
    const viewportWidth = Number(global.innerWidth);
    const viewportHeight = Number(global.innerHeight);
    if (Number.isFinite(viewportWidth) && Number.isFinite(viewportHeight)
      && (rect.x >= viewportWidth || rect.y >= viewportHeight)) return null;
    return Object.freeze({ x: rect.x, y: rect.y, width: rect.width, height: rect.height });
  }

  function captureViewport() {
    const width = Number(global.innerWidth);
    const height = Number(global.innerHeight);
    if (![width, height].every(Number.isFinite) || width <= 0 || height <= 0) return null;
    return Object.freeze({ width, height });
  }

  function createPermissionHandoffController({ api, onRetry, onError }) {
    if (!api || typeof api.openPrivacySecurity !== 'function') throw new TypeError('Permission handoff bridge is unavailable.');
    if (typeof onRetry !== 'function' || typeof onError !== 'function') throw new TypeError('Permission handoff callbacks are required.');

    async function open(sourceElement, afterStart = () => {}) {
      const sourceRect = captureSourceRect(sourceElement);
      const viewportCss = captureViewport();
      let result;
      try {
        result = await api.openPrivacySecurity({ sourceRect, viewportCss }, (event) => {
          if (!OUTCOMES.has(event?.outcome)) return;
          if (event.outcome === 'retryRequested') void Promise.resolve(onRetry()).catch(onError);
          if (event.outcome === 'error') onError();
        });
      } catch (_) {
        afterStart();
        onError();
        return;
      }
      afterStart();
      if (!result?.ok) {
        onError();
      }
    }

    return Object.freeze({ open, captureSourceRect });
  }

  global.createPermissionHandoffController = createPermissionHandoffController;
})(window);
