/**
 * [INPUT]: 依赖权限 handoff 审查页的固定 DOM anchors、生产图标工厂、本机参考图节点与浏览器 RAF/Drag and Drop/Reduced Motion API，并以锁定研究证据约束转场数学、箭头提示节奏和用户操作语义边界。
 * [OUTPUT]: 对外提供 permissionHandoffRuntimeScript；返回只供 localhost UI Review 注入的权限工作流、冻结 source/可刷新 target 的 DOM 视觉状态机、source 缺失/减少动效静态 fallback、file URL 受限 HTML drag 审查、fixture 经真实 renderer 的重试握手、本机参考可用性与项目自绘箭头脚本。
 * [POS]: tools UI Review 权限原型的行为层；生产 renderer 同时承担 source 与任务反馈真相，只有 fixture 的业务结果才能驱动成功 reverse；本机参考、HTML drop、单屏 CSS 几何或动画完成都不冒充 NSDraggingSession、跨屏 backing-scale 或原生授权证据。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

function permissionHandoffRuntimeScript() {
  return String.raw`    (() => {
      'use strict';
      const MOTION = Object.freeze({
        responseSeconds: 0.72,
        dampingFraction: 1,
        arcHeightCssPx: 50,
        maxBlurPx: 12,
        strokeMaxOpacity: 0.15,
        completionEpsilon: 0.001,
        arrowInitialDelayMs: 500,
        arrowStretchMs: 250,
        arrowIdleMs: 4000,
        arrowScaleX: 1.15,
        arrowScaleY: 1.6,
        arrowMass: 1,
        arrowStiffness: 200,
        arrowDamping: 11,
        arrowOffsetYPx: -10,
        arrowCompletionEpsilon: 0.002,
        arrowMaximumSettleMs: 1400,
      });
      const REVIEW = Object.freeze({
        sourceScenario: 'permissionMac',
        sourceActionSelectors: Object.freeze(['#modalPrimaryButton', '#permissionButton']),
        defaultLocale: 'zh-Hans',
        reducedMotionMedia: '(prefers-reduced-motion: reduce)',
        appBundleFileUrl: 'file:///Applications/Cavalry%20Language%20Switcher.app',
        retryMessage: 'cavalry-ui-review:permission-retry',
        settledMessage: 'cavalry-ui-review:permission-retry-settled',
      });
      const sourceFrame = document.querySelector('#sourceFrame');
      const sourceState = document.querySelector('#sourceState');
      const stage = document.querySelector('#handoffStage');
      const destinationDropZone = document.querySelector('#destinationDropZone');
      const existingRowSwitch = document.querySelector('#existingRowSwitch');
      const proxy = document.querySelector('#proxy');
      const proxySource = document.querySelector('#proxySource');
      const proxyDestination = document.querySelector('#proxyDestination');
      const proxyDestinationShadow = document.querySelector('#proxyDestinationShadow');
      const proxyStroke = document.querySelector('#proxyStroke');
      const accessoryWrap = document.querySelector('#accessoryWrap');
      const accessory = document.querySelector('#accessory');
      const draggableAppRow = document.querySelector('#draggableAppRow');
      const hintArrow = document.querySelector('#hintArrow');
      const referenceProjectArrow = document.querySelector('#referenceProjectArrow');
      const reverseFromAccessory = document.querySelector('#reverseFromAccessory');
      const workflowLabel = document.querySelector('#workflowLabel');
      const transitionLabel = document.querySelector('#transitionLabel');
      const workflowEvents = document.querySelector('#workflowEvents');
      const geometryText = document.querySelector('#geometryText');
      const motionText = document.querySelector('#motionText');
      const reduceMotion = document.querySelector('#reduceMotion');
      const actionButtons = Object.freeze({
        openSettings: document.querySelector('[data-action="open-settings"]'),
        retry: document.querySelector('[data-action="retry"]'),
        resultSuccess: document.querySelector('[data-action="result-success"]'),
        resultDenied: document.querySelector('[data-action="result-denied"]'),
        resultError: document.querySelector('[data-action="result-error"]'),
        reset: document.querySelector('[data-action="reset"]'),
      });
      const transitionLabels = Object.freeze({
        idle: '待命', preparing: '准备交接', presenting: '正向动画', presented: '辅助面板接管', reversing: '反向动画',
      });
      const workflowLabels = Object.freeze({
        denied: '等待打开设置',
        openingSettings: '原型：正在打开系统设置',
        locatingSettings: '原型：正在定位系统设置',
        awaitingUser: '原型：等待用户完成设置',
        returning: '正在返回',
        retrying: '原型：正在用原操作验证',
        verified: '原型：事务成功',
        stillDenied: '仍需 App Management',
        typedError: '原型：写事务返回其他错误',
      });
      const workflowEventDefinitions = Object.freeze({
        transactionDenied: Object.freeze({ icon: 'warningCircle', tone: 'warning', text: 'fixture 写事务返回 permissionRequired' }),
        sourceCaptured: Object.freeze({ icon: 'verify', tone: 'neutral', text: '捕获真实权限动作' }),
        sourceUnavailable: Object.freeze({ icon: 'infoCircle', tone: 'neutral', text: '源动作不可用，改用静态辅助面板' }),
        settingsRequested: Object.freeze({ icon: 'infoCircle', tone: 'neutral', text: '原型请求打开 App Management' }),
        settingsLocated: Object.freeze({ icon: 'verify', tone: 'neutral', text: '原型定位系统设置目标' }),
        destinationCaptured: Object.freeze({ icon: 'verify', tone: 'neutral', text: '原型捕获目标窗口布局' }),
        handoffPresented: Object.freeze({ icon: 'infoCircle', tone: 'neutral', text: '视觉交接完成，等待用户操作' }),
        appDragStarted: Object.freeze({ icon: 'dragUp', tone: 'neutral', text: '原型开始 HTML App 拖入' }),
        appDropAccepted: Object.freeze({ icon: 'verify', tone: 'neutral', text: '原型模拟 copy drop；权限尚未验证' }),
        appDropRejected: Object.freeze({ icon: 'warningCircle', tone: 'warning', text: '原型拒绝未知拖拽源' }),
        dragCancelled: Object.freeze({ icon: 'infoCircle', tone: 'neutral', text: '拖入取消，恢复 App 行' }),
        existingRowEnabled: Object.freeze({ icon: 'verify', tone: 'neutral', text: '用户模拟开启已有 App 行，尚未验证权限' }),
        handoffDismissed: Object.freeze({ icon: 'infoCircle', tone: 'neutral', text: '反向转场完成并清理视觉层' }),
        retryRequested: Object.freeze({ icon: 'spinner', tone: 'neutral', text: '原型返回并重试写事务' }),
        operationVerified: Object.freeze({ icon: 'checkCircle', tone: 'success', text: 'fixture 写事务成功；原型进入 verified' }),
        permissionStillMissing: Object.freeze({ icon: 'warningCircle', tone: 'warning', text: 'fixture 重试仍返回 permissionRequired' }),
        typedError: Object.freeze({ icon: 'errorCircle', tone: 'warning', text: 'fixture 重试返回其他错误，退出权限链路' }),
      });
      const reducedMotionQuery = window.matchMedia?.(REVIEW.reducedMotionMedia) || null;
      const locale = new URLSearchParams(location.search).get('locale') || REVIEW.defaultLocale;
      let transitionPhase = 'idle';
      let workflowState = 'denied';
      let occurredWorkflowEvents = [];
      let progress = 0;
      let captures = null;
      let animationGeneration = 0;
      let geometryFrame = 0;
      let sourceObserver = null;
      let sourceActionDocument = null;
      let handoffSessionGeneration = 0;
      let arrowTimer = 0;
      let arrowHoverTimer = 0;
      let arrowAnimationGeneration = 0;
      let arrowStretch = 0;
      let arrowHovering = false;
      let dragOutcome = 'idle';
      let settledWorkflowState = null;

      hintArrow.replaceChildren(window.cavalryIcons.create('handoffArrow'));
      referenceProjectArrow.replaceChildren(window.cavalryIcons.create('handoffArrow'));
      for (const image of document.querySelectorAll('[data-local-reference]')) {
        const card = image.closest('[data-local-reference-card]');
        const updateAvailability = (available) => { card.dataset.available = String(available); };
        image.addEventListener('load', () => updateAvailability(true));
        image.addEventListener('error', () => updateAvailability(false));
        if (image.complete) updateAvailability(image.naturalWidth > 0);
      }

      function clamp(value, minimum, maximum) {
        return Math.min(Math.max(value, minimum), maximum);
      }

      function lerp(start, end, amount) {
        return start + (end - start) * amount;
      }

      function localRect(rect, stageRect) {
        return { left: rect.left - stageRect.left, top: rect.top - stageRect.top, width: rect.width, height: rect.height };
      }

      function center(rect) {
        return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      }

      function findSourceElement() {
        const sourceDocument = sourceFrame.contentDocument;
        const sourceWindow = sourceFrame.contentWindow;
        if (!sourceDocument || !sourceWindow) return null;
        for (const selector of REVIEW.sourceActionSelectors) {
          const candidate = sourceDocument.querySelector(selector);
          if (!candidate || candidate.hidden) continue;
          const style = sourceWindow.getComputedStyle(candidate);
          const rect = candidate.getBoundingClientRect();
          if (style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0' && rect.width > 0 && rect.height > 0) return { candidate, selector };
        }
        return null;
      }

      function copyComputedSubtree(sourceElement) {
        const sourceWindow = sourceElement.ownerDocument.defaultView;
        const clone = document.importNode(sourceElement, true);
        const sourceNodes = [sourceElement, ...sourceElement.querySelectorAll('*')];
        const cloneNodes = [clone, ...clone.querySelectorAll('*')];
        sourceNodes.forEach((sourceNode, index) => {
          const cloneNode = cloneNodes[index];
          const computed = sourceWindow.getComputedStyle(sourceNode);
          for (let propertyIndex = 0; propertyIndex < computed.length; propertyIndex += 1) {
            const property = computed[propertyIndex];
            cloneNode.style.setProperty(property, computed.getPropertyValue(property), computed.getPropertyPriority(property));
          }
          cloneNode.removeAttribute('id');
          cloneNode.removeAttribute('tabindex');
          cloneNode.setAttribute('aria-hidden', 'true');
        });
        clone.style.setProperty('position', 'absolute');
        clone.style.setProperty('inset', '0');
        clone.style.setProperty('width', '100%');
        clone.style.setProperty('height', '100%');
        clone.style.setProperty('max-width', 'none');
        clone.style.setProperty('max-height', 'none');
        clone.style.setProperty('margin', '0');
        clone.style.setProperty('transform', 'none');
        clone.style.setProperty('transition', 'none');
        clone.style.setProperty('animation', 'none');
        clone.style.setProperty('pointer-events', 'none');
        return clone;
      }

      function replaceClone(slot, sourceElement) {
        slot.replaceChildren(copyComputedSubtree(sourceElement));
      }

      function sourceCapture(stageRect) {
        const found = findSourceElement();
        if (!found) {
          sourceState.textContent = '等待真实权限动作';
          return null;
        }
        const iframeRect = sourceFrame.getBoundingClientRect();
        const iframeStyle = getComputedStyle(sourceFrame);
        const borderLeft = Number.parseFloat(iframeStyle.borderLeftWidth) || 0;
        const borderRight = Number.parseFloat(iframeStyle.borderRightWidth) || 0;
        const borderTop = Number.parseFloat(iframeStyle.borderTopWidth) || 0;
        const borderBottom = Number.parseFloat(iframeStyle.borderBottomWidth) || 0;
        const contentWidth = sourceFrame.clientWidth || iframeRect.width;
        const contentHeight = sourceFrame.clientHeight || iframeRect.height;
        const scaleX = (iframeRect.width - borderLeft - borderRight) / contentWidth;
        const scaleY = (iframeRect.height - borderTop - borderBottom) / contentHeight;
        const sourceRect = found.candidate.getBoundingClientRect();
        const pageRect = {
          left: iframeRect.left + borderLeft + sourceRect.left * scaleX,
          top: iframeRect.top + borderTop + sourceRect.top * scaleY,
          width: sourceRect.width * scaleX,
          height: sourceRect.height * scaleY,
        };
        const style = found.candidate.ownerDocument.defaultView.getComputedStyle(found.candidate);
        sourceState.textContent = '真实源：' + found.selector;
        return {
          rect: localRect(pageRect, stageRect),
          radius: Number.parseFloat(style.borderTopLeftRadius) || 0,
          selector: found.selector,
          element: found.candidate,
        };
      }

      function targetCapture(stageRect) {
        const style = getComputedStyle(draggableAppRow);
        return {
          rect: localRect(draggableAppRow.getBoundingClientRect(), stageRect),
          radius: Number.parseFloat(style.borderTopLeftRadius) || 0,
          selector: '#draggableAppRow',
          element: draggableAppRow,
        };
      }

      function captureSourceGeometry() {
        const stageRect = stage.getBoundingClientRect();
        const source = sourceCapture(stageRect);
        if (!source) {
          captures = null;
          proxy.hidden = true;
          sourceState.textContent = '源动作不可用';
          geometryText.textContent = '源 / 目标几何：等待真实权限动作';
          setActionAvailability();
          return null;
        }
        replaceClone(proxySource, source.element);
        captures = { source, target: null };
        return { source, stageRect };
      }

      function captureTargetGeometry(sourceGeometry) {
        const { source, stageRect } = sourceGeometry;
        const target = targetCapture(stageRect);
        replaceClone(proxyDestination, target.element);
        captures = { source, target };
        geometryText.textContent = '源 ' + Math.round(source.rect.width) + '×' + Math.round(source.rect.height) + ' → 目标 ' + Math.round(target.rect.width) + '×' + Math.round(target.rect.height) + ' · ' + source.selector + ' → ' + target.selector;
        renderProxy();
        setActionAvailability();
        return captures;
      }

      function captureGeometry() {
        const sourceGeometry = captureSourceGeometry();
        return sourceGeometry ? captureTargetGeometry(sourceGeometry) : null;
      }

      function scheduleGeometryCapture() {
        if (geometryFrame || ['preparing', 'presenting', 'reversing'].includes(transitionPhase)) return;
        geometryFrame = requestAnimationFrame(() => {
          geometryFrame = 0;
          if (transitionPhase === 'presented' && captures?.source) {
            captureTargetGeometry({ source: captures.source, stageRect: stage.getBoundingClientRect() });
            return;
          }
          if (transitionPhase === 'idle') captureGeometry();
        });
      }

      function watchSourceDocument() {
        sourceObserver?.disconnect();
        sourceActionDocument?.removeEventListener('click', handleSourceActionClick, true);
        const sourceDocument = sourceFrame.contentDocument;
        if (!sourceDocument?.documentElement || !window.MutationObserver) return;
        sourceActionDocument = sourceDocument;
        sourceActionDocument.addEventListener('click', handleSourceActionClick, true);
        sourceObserver = new MutationObserver(scheduleGeometryCapture);
        sourceObserver.observe(sourceDocument.documentElement, {
          attributes: true,
          childList: true,
          characterData: true,
          subtree: true,
        });
      }

      function handleSourceActionClick(event) {
        const action = REVIEW.sourceActionSelectors
          .map((selector) => event.target.closest?.(selector))
          .find(Boolean);
        if (!action || action.hidden) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        startOpenSettings();
      }

      function criticalDampingProgress(seconds) {
        const omega = (2 * Math.PI) / MOTION.responseSeconds;
        const decay = MOTION.dampingFraction * omega;
        return 1 - Math.exp(-decay * seconds) * (1 + decay * seconds);
      }

      function quadraticPoint(sourceCenter, targetCenter, amount) {
        // Web 坐标向下为正，因此 macOS 的“较高端点再上抬 50pt”在这里使用 min(y)-50。
        const apexY = Math.min(sourceCenter.y, targetCenter.y) - MOTION.arcHeightCssPx;
        const control = {
          x: (sourceCenter.x + targetCenter.x) / 2,
          y: 2 * apexY - 0.5 * sourceCenter.y - 0.5 * targetCenter.y,
        };
        const oneMinus = 1 - amount;
        return {
          x: oneMinus * oneMinus * sourceCenter.x + 2 * oneMinus * amount * control.x + amount * amount * targetCenter.x,
          y: oneMinus * oneMinus * sourceCenter.y + 2 * oneMinus * amount * control.y + amount * amount * targetCenter.y,
        };
      }

      function renderProxy() {
        if (!captures?.source || !captures?.target) return;
        const source = captures.source.rect;
        const target = captures.target.rect;
        const sourceCenter = center(source);
        const targetCenter = center(target);
        const visualProgress = clamp(progress, 0, 1);
        const oneMinus = 1 - visualProgress;
        const point = quadraticPoint(sourceCenter, targetCenter, visualProgress);
        const width = Math.round(lerp(source.width, target.width, visualProgress));
        const height = Math.round(lerp(source.height, target.height, visualProgress));
        const left = Math.round(point.x - width / 2);
        const top = Math.round(point.y - height / 2);
        const radius = lerp(captures.source.radius, captures.target.radius, visualProgress);
        proxy.hidden = transitionPhase === 'idle' && progress === 0;
        proxy.dataset.phase = transitionPhase;
        proxy.style.width = Math.max(width, 1) + 'px';
        proxy.style.height = Math.max(height, 1) + 'px';
        proxy.style.borderRadius = Math.max(radius, 0) + 'px';
        proxy.style.transform = 'translate3d(' + left + 'px, ' + top + 'px, 0)';
        proxy.style.opacity = '1';
        proxySource.style.opacity = String(oneMinus);
        proxySource.style.filter = 'blur(' + (MOTION.maxBlurPx * visualProgress) + 'px)';
        proxyDestination.style.opacity = String(visualProgress);
        proxyDestination.style.filter = 'blur(' + (MOTION.maxBlurPx * oneMinus) + 'px)';
        proxyDestinationShadow.style.opacity = String(visualProgress);
        proxyStroke.style.opacity = String(MOTION.strokeMaxOpacity * visualProgress);
        motionText.textContent = 'R1 DOM 替身 · apex 50 CSS px / blur 12 CSS px · 原生目标 50pt / 12pt · progress ' + visualProgress.toFixed(2);
      }

      function renderArrow() {
        const scaleX = lerp(1, MOTION.arrowScaleX, arrowStretch);
        const scaleY = lerp(1, MOTION.arrowScaleY, arrowStretch);
        hintArrow.style.transform = 'translate(-50%, ' + MOTION.arrowOffsetYPx + 'px) scale(' + scaleX + ', ' + scaleY + ')';
      }

      function prefersReducedMotion() {
        return reduceMotion.checked || reducedMotionQuery?.matches === true;
      }

      function arrowSpringProgress(seconds) {
        const naturalFrequency = Math.sqrt(MOTION.arrowStiffness / MOTION.arrowMass);
        const dampingRatio = MOTION.arrowDamping / (2 * Math.sqrt(MOTION.arrowStiffness * MOTION.arrowMass));
        const dampedFrequency = naturalFrequency * Math.sqrt(1 - dampingRatio * dampingRatio);
        const envelope = Math.exp(-dampingRatio * naturalFrequency * seconds);
        const phase = Math.cos(dampedFrequency * seconds)
          + dampingRatio / Math.sqrt(1 - dampingRatio * dampingRatio) * Math.sin(dampedFrequency * seconds);
        return 1 - envelope * phase;
      }

      function animateArrowTo(target) {
        const generation = ++arrowAnimationGeneration;
        const start = arrowStretch;
        const startedAt = performance.now();
        function frame(now) {
          if (generation !== arrowAnimationGeneration) return;
          const elapsedMs = Math.max(0, now - startedAt);
          const amount = arrowSpringProgress(elapsedMs / 1000);
          arrowStretch = start + (target - start) * amount;
          renderArrow();
          const settled = Math.abs(target - arrowStretch) <= MOTION.arrowCompletionEpsilon;
          if (settled || elapsedMs >= MOTION.arrowMaximumSettleMs) {
            arrowStretch = target;
            renderArrow();
            return;
          }
          requestAnimationFrame(frame);
        }
        requestAnimationFrame(frame);
      }

      function stopArrowLoop() {
        clearTimeout(arrowTimer);
        clearTimeout(arrowHoverTimer);
        arrowTimer = 0;
        arrowHoverTimer = 0;
        ++arrowAnimationGeneration;
        arrowStretch = 0;
        renderArrow();
      }

      function scheduleArrowCycle(delayMs) {
        clearTimeout(arrowTimer);
        arrowTimer = window.setTimeout(() => {
          if (workflowState !== 'awaitingUser' || transitionPhase !== 'presented') return;
          if (!arrowHovering) animateArrowTo(1);
          arrowTimer = window.setTimeout(() => {
            if (!arrowHovering) animateArrowTo(0);
            scheduleArrowCycle(MOTION.arrowIdleMs);
          }, MOTION.arrowStretchMs);
        }, delayMs);
      }

      function startArrowLoop() {
        if (prefersReducedMotion()) {
          stopArrowLoop();
          return;
        }
        if (!arrowTimer) scheduleArrowCycle(MOTION.arrowInitialDelayMs);
      }

      function setActionAvailability() {
        const transitionBusy = ['preparing', 'presenting', 'reversing'].includes(transitionPhase);
        actionButtons.openSettings.disabled = !['denied', 'stillDenied'].includes(workflowState) || transitionPhase !== 'idle' || transitionBusy;
        actionButtons.retry.disabled = !['awaitingUser', 'stillDenied'].includes(workflowState) || transitionPhase !== 'presented';
        actionButtons.resultSuccess.disabled = workflowState !== 'retrying';
        actionButtons.resultDenied.disabled = workflowState !== 'retrying';
        actionButtons.resultError.disabled = workflowState !== 'retrying';
        actionButtons.reset.disabled = transitionBusy;
        reverseFromAccessory.disabled = !['awaitingUser', 'stillDenied'].includes(workflowState) || transitionPhase !== 'presented';
      }

      function renderWorkflowEvents() {
        workflowEvents.replaceChildren(...occurredWorkflowEvents.map((eventName) => {
          const definition = workflowEventDefinitions[eventName];
          const item = document.createElement('li');
          item.className = 'handoff-event';
          item.dataset.event = eventName;
          item.dataset.tone = definition.tone;
          item.append(window.cavalryIcons.create(definition.icon), document.createTextNode(definition.text));
          return item;
        }));
      }

      function appendWorkflowEvent(eventName) {
        if (occurredWorkflowEvents.at(-1) === eventName) return;
        occurredWorkflowEvents.push(eventName);
        renderWorkflowEvents();
      }

      function setAccessoryVisibility(visible) {
        if (!visible && accessoryWrap.contains(document.activeElement)) document.activeElement.blur();
        accessoryWrap.inert = !visible;
        accessoryWrap.dataset.visible = String(visible);
        accessoryWrap.setAttribute('aria-hidden', String(!visible));
        if (visible) startArrowLoop();
        else stopArrowLoop();
      }

      function setWorkflowState(nextState) {
        workflowState = nextState;
        workflowLabel.dataset.state = workflowState;
        workflowLabel.textContent = workflowLabels[workflowState] || workflowState;
        const accessoryVisible = ['awaitingUser', 'retrying', 'stillDenied'].includes(workflowState) && transitionPhase === 'presented';
        setAccessoryVisibility(accessoryVisible);
        setActionAvailability();
      }

      function setTransitionPhase(nextPhase) {
        transitionPhase = nextPhase;
        transitionLabel.textContent = '视觉：' + (transitionLabels[transitionPhase] || transitionPhase);
        const accessoryVisible = ['awaitingUser', 'retrying', 'stillDenied'].includes(workflowState) && transitionPhase === 'presented';
        setAccessoryVisibility(accessoryVisible);
        setActionAvailability();
        renderProxy();
      }

      function finish(target) {
        progress = target;
        proxy.style.opacity = '1';
        proxy.dataset.motion = 'full';
        setTransitionPhase(target === 1 ? 'presented' : 'idle');
        renderProxy();
        proxy.hidden = true;
        if (target === 1) {
          appendWorkflowEvent('handoffPresented');
          setWorkflowState('awaitingUser');
        } else if (workflowState === 'returning') {
          appendWorkflowEvent('handoffDismissed');
          setWorkflowState(settledWorkflowState || 'typedError');
          settledWorkflowState = null;
        }
      }

      function animateReduced(target) {
        ++animationGeneration;
        proxy.dataset.motion = 'reduced';
        progress = target;
        renderProxy();
        finish(target);
      }

      function animateSpring(target) {
        const generation = ++animationGeneration;
        const start = progress;
        const startedAt = performance.now();
        function frame(now) {
          if (generation !== animationGeneration) return;
          const elapsed = Math.max(0, (now - startedAt) / 1000);
          const eased = clamp(criticalDampingProgress(elapsed), 0, 1);
          progress = start + (target - start) * eased;
          renderProxy();
          if (Math.abs(target - progress) <= MOTION.completionEpsilon) {
            finish(target);
            return;
          }
          requestAnimationFrame(frame);
        }
        requestAnimationFrame(frame);
      }

      function animateTo(target) {
        if (target === progress) {
          finish(target);
          return;
        }
        if (prefersReducedMotion()) animateReduced(target);
        else animateSpring(target);
      }

      function presentStaticFallback() {
        appendWorkflowEvent('sourceUnavailable');
        appendWorkflowEvent('settingsRequested');
        setWorkflowState('openingSettings');
        progress = 1;
        proxy.hidden = true;
        motionText.textContent = 'R1 静态 fallback · source capture unavailable · no flight';
        setTransitionPhase('presented');
        appendWorkflowEvent('handoffPresented');
        setWorkflowState('awaitingUser');
      }

      function startOpenSettings() {
        if (!['denied', 'stillDenied'].includes(workflowState) || transitionPhase !== 'idle') return;
        const sessionGeneration = ++handoffSessionGeneration;
        const sourceGeometry = captureSourceGeometry();
        if (!sourceGeometry) {
          presentStaticFallback();
          return;
        }
        appendWorkflowEvent('sourceCaptured');
        appendWorkflowEvent('settingsRequested');
        setWorkflowState('openingSettings');
        setTransitionPhase('preparing');
        requestAnimationFrame(() => {
          if (sessionGeneration !== handoffSessionGeneration || transitionPhase !== 'preparing') return;
          appendWorkflowEvent('settingsLocated');
          captureTargetGeometry(sourceGeometry);
          appendWorkflowEvent('destinationCaptured');
          setWorkflowState('locatingSettings');
          setTransitionPhase('presenting');
          animateTo(1);
        });
      }

      function startRetry() {
        if (!['awaitingUser', 'stillDenied'].includes(workflowState) || transitionPhase !== 'presented') return;
        appendWorkflowEvent('retryRequested');
        setWorkflowState('retrying');
      }

      function resolveRetry(result) {
        if (workflowState !== 'retrying') return;
        sourceFrame.contentWindow?.postMessage({ type: REVIEW.retryMessage, result }, location.origin);
      }

      function reverseAfterSettled(nextState, eventName) {
        if (workflowState !== 'retrying' || transitionPhase !== 'presented') return;
        appendWorkflowEvent(eventName);
        if (!captures) {
          appendWorkflowEvent('handoffDismissed');
          progress = 0;
          setTransitionPhase('idle');
          setWorkflowState(nextState);
          return;
        }
        settledWorkflowState = nextState;
        const stageRect = stage.getBoundingClientRect();
        captureTargetGeometry({ source: captures.source, stageRect });
        setWorkflowState('returning');
        setTransitionPhase('reversing');
        animateTo(0);
      }

      function handleSourceRetrySettled(event) {
        if (event.origin !== location.origin || event.source !== sourceFrame.contentWindow) return;
        if (event.data?.type !== REVIEW.settledMessage || workflowState !== 'retrying') return;
        if (event.data.result === 'success') {
          reverseAfterSettled('verified', 'operationVerified');
          return;
        }
        if (event.data.result === 'error') {
          reverseAfterSettled('typedError', 'typedError');
          return;
        }
        appendWorkflowEvent('permissionStillMissing');
        setWorkflowState('stillDenied');
      }

      function restoreDraggedApp() {
        draggableAppRow.dataset.dragging = 'false';
        destinationDropZone.dataset.dragOver = 'false';
        if (workflowState === 'awaitingUser' && transitionPhase === 'presented') startArrowLoop();
      }

      function handleDragStart(event) {
        if (workflowState !== 'awaitingUser' || transitionPhase !== 'presented') {
          event.preventDefault();
          return;
        }
        dragOutcome = 'pending';
        event.dataTransfer.effectAllowed = 'copy';
        event.dataTransfer.setData('text/uri-list', REVIEW.appBundleFileUrl);
        event.dataTransfer.setData('text/plain', 'Cavalry Language Switcher.app');
        appendWorkflowEvent('appDragStarted');
        stopArrowLoop();
        requestAnimationFrame(() => { draggableAppRow.dataset.dragging = 'true'; });
      }

      function handleDragEnd() {
        if (dragOutcome === 'pending') appendWorkflowEvent('dragCancelled');
        dragOutcome = 'idle';
        restoreDraggedApp();
      }

      function handleDrop(event) {
        if (workflowState !== 'awaitingUser' || transitionPhase !== 'presented') return;
        event.preventDefault();
        const isKnownAppSource = dragOutcome === 'pending';
        if (!isKnownAppSource) {
          dragOutcome = 'rejected';
          appendWorkflowEvent('appDropRejected');
          restoreDraggedApp();
          return;
        }
        dragOutcome = 'accepted';
        appendWorkflowEvent('appDropAccepted');
        restoreDraggedApp();
      }

      function handleExistingRowEnabled() {
        if (workflowState !== 'awaitingUser' || transitionPhase !== 'presented') return;
        existingRowSwitch.setAttribute('aria-checked', 'true');
        appendWorkflowEvent('existingRowEnabled');
      }

      function reset() {
        ++handoffSessionGeneration;
        ++animationGeneration;
        stopArrowLoop();
        progress = 0;
        dragOutcome = 'idle';
        settledWorkflowState = null;
        arrowHovering = false;
        draggableAppRow.dataset.dragging = 'false';
        destinationDropZone.dataset.dragOver = 'false';
        existingRowSwitch.setAttribute('aria-checked', 'false');
        occurredWorkflowEvents = ['transactionDenied'];
        captureGeometry();
        setTransitionPhase('idle');
        setWorkflowState('denied');
        renderWorkflowEvents();
        renderProxy();
      }

      function dispose() {
        ++handoffSessionGeneration;
        ++animationGeneration;
        stopArrowLoop();
        if (geometryFrame) cancelAnimationFrame(geometryFrame);
        geometryFrame = 0;
        sourceObserver?.disconnect();
        sourceActionDocument?.removeEventListener('click', handleSourceActionClick, true);
        reducedMotionQuery?.removeEventListener?.('change', handleReducedMotionChange);
        sourceObserver = null;
        sourceActionDocument = null;
        proxy.hidden = true;
        draggableAppRow.dataset.dragging = 'false';
        destinationDropZone.dataset.dragOver = 'false';
      }

      actionButtons.openSettings.addEventListener('click', startOpenSettings);
      actionButtons.retry.addEventListener('click', startRetry);
      actionButtons.resultSuccess.addEventListener('click', () => resolveRetry('success'));
      actionButtons.resultDenied.addEventListener('click', () => resolveRetry('denied'));
      actionButtons.resultError.addEventListener('click', () => resolveRetry('error'));
      actionButtons.reset.addEventListener('click', reset);
      reverseFromAccessory.addEventListener('click', startRetry);
      draggableAppRow.addEventListener('dragstart', handleDragStart);
      draggableAppRow.addEventListener('dragend', handleDragEnd);
      destinationDropZone.addEventListener('dragenter', (event) => {
        if (workflowState !== 'awaitingUser') return;
        event.preventDefault();
        destinationDropZone.dataset.dragOver = 'true';
      });
      destinationDropZone.addEventListener('dragover', (event) => {
        if (workflowState !== 'awaitingUser') return;
        event.preventDefault();
        event.dataTransfer.dropEffect = 'copy';
      });
      destinationDropZone.addEventListener('dragleave', () => { destinationDropZone.dataset.dragOver = 'false'; });
      destinationDropZone.addEventListener('drop', handleDrop);
      existingRowSwitch.addEventListener('click', handleExistingRowEnabled);
      accessory.addEventListener('mouseenter', () => {
        if (workflowState !== 'awaitingUser' || prefersReducedMotion()) return;
        arrowHovering = true;
        animateArrowTo(1);
        clearTimeout(arrowHoverTimer);
        arrowHoverTimer = window.setTimeout(() => animateArrowTo(0), MOTION.arrowStretchMs);
      });
      accessory.addEventListener('mouseleave', () => { arrowHovering = false; });
      reduceMotion.addEventListener('change', () => {
        if (prefersReducedMotion()) stopArrowLoop();
        else if (workflowState === 'awaitingUser' && transitionPhase === 'presented') startArrowLoop();
      });
      function handleReducedMotionChange() {
        if (prefersReducedMotion()) stopArrowLoop();
        else if (workflowState === 'awaitingUser' && transitionPhase === 'presented') startArrowLoop();
      }
      reduceMotion.checked = reducedMotionQuery?.matches === true;
      reducedMotionQuery?.addEventListener?.('change', handleReducedMotionChange);
      sourceFrame.addEventListener('load', () => {
        watchSourceDocument();
        scheduleGeometryCapture();
      });
      window.addEventListener('resize', scheduleGeometryCapture);
      window.addEventListener('message', handleSourceRetrySettled);
      window.addEventListener('pagehide', dispose, { once: true });
      if (window.ResizeObserver) new ResizeObserver(scheduleGeometryCapture).observe(stage);
      sourceFrame.src = '/app?scenario=' + REVIEW.sourceScenario + '&locale=' + encodeURIComponent(locale);
      reset();
    })();`;
}

module.exports = Object.freeze({ permissionHandoffRuntimeScript });
