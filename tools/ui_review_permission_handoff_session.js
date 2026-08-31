/**
 * [INPUT]: 依赖权限 handoff runtime 注入作用域中的 session generation、视觉层、真实 renderer iframe、事件记录与状态更新函数。
 * [OUTPUT]: 对外提供 permissionHandoffSessionScript；生成 UI Review 专用的系统 Quit & Reopen fresh-session 投影与显式 reset 生命周期函数。
 * [POS]: tools UI Review 权限原型的 session 生命周期片段；从几何/拖拽 runtime 分离跨文档重载与重置，不宣称 macOS 已真实退出或重开进程。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

function permissionHandoffSessionScript() {
  return String.raw`
      function simulateSystemQuitAndReopen() {
        if (!['awaitingUser', 'retrying', 'stillDenied'].includes(workflowState)) return;
        ++handoffSessionGeneration;
        ++animationGeneration;
        stopArrowLoop();
        appendWorkflowEvent('systemQuitAndReopen');
        progress = 0;
        dragOutcome = 'idle';
        settledWorkflowState = null;
        proxy.hidden = true;
        accessoryWrap.dataset.visible = 'false';
        accessoryWrap.setAttribute('aria-hidden', 'true');
        accessoryWrap.inert = true;
        setTransitionPhase('idle');
        setWorkflowState('freshSession');
        sourceReloadPending = true;
        sourceReloadDocument = null;
        sourceFrame.src = freshSessionUrl;
        appendWorkflowEvent('freshSessionStarted');
      }

      function reset({ reloadSource = false } = {}) {
        ++handoffSessionGeneration;
        ++animationGeneration;
        stopArrowLoop();
        progress = 0;
        dragOutcome = 'idle';
        settledWorkflowState = null;
        requestedSourceRect = null;
        arrowHovering = false;
        proxy.dataset.motion = prefersReducedMotion() ? 'reduced' : 'full';
        draggableAppRow.dataset.dragging = 'false';
        destinationDropZone.dataset.dragOver = 'false';
        existingRowSwitch.setAttribute('aria-checked', 'false');
        occurredWorkflowEvents = ['transactionDenied'];
        captureGeometry();
        setTransitionPhase('idle');
        setWorkflowState('denied');
        renderWorkflowEvents();
        renderProxy();
        if (reloadSource) {
          sourceReloadPending = true;
          sourceReloadDocument = null;
          setActionAvailability();
          sourceFrame.src = sourceScenarioUrl;
        }
      }
`;
}

module.exports = Object.freeze({ permissionHandoffSessionScript });
