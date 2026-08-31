/**
 * [INPUT]: 依赖 UI Review server 暴露的真实 permissionMac renderer iframe，依赖 renderer 的 tokens/Button/语义图标/应用标识，并注入 ui_review_permission_handoff_runtime 的独立行为层。
 * [OUTPUT]: 对外提供 permissionHandoffHtml；以不压缩 400×484 source、484px 设置目标及 82px helper 的完整舞台组装 typed 写事务拒绝、设置定位、单次视觉 handoff、实时 App 控件接管、整条 App row 快照拖拽、整窗 copy-drop 审查、同进程 oracle、Later 重开提示、系统 Quit & Reopen 后 fresh-session 投影及不入库的本机 Raster/System Settings 对照区。
 * [POS]: tools UI Review 的独立权限动画舞台结构/样式层；只用 DOM/HTML 替身审查系统设置目标、视觉连续性和后端结果，本机参考缺失时降级为说明文字，不伪造 NSImage/NSPanel/NSDraggingSession 或 native 授权，并与工作台导航壳及行为层保持单向依赖。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

const { permissionHandoffRuntimeScript } = require('./ui_review_permission_handoff_runtime');

function permissionHandoffHtml() {
  return String.raw`<!doctype html>
<html class="handoff-document" lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <link rel="icon" href="data:," />
  <link rel="stylesheet" href="/renderer/tokens.css" />
  <link rel="stylesheet" href="/renderer/button.css" />
  <link rel="stylesheet" href="/renderer/styles.css" />
  <script src="/renderer/icons.js"></script>
  <title>macOS 权限 handoff UI Review</title>
  <style>
    :root {
      color-scheme: light;
      font-family: var(--font-sans);
      --handoff-stage-gap: var(--space-6);
      --handoff-stage-min-height: 604px;
      --handoff-source-viewport-width: 400px;
      --handoff-source-viewport-height: 484px;
      --handoff-target-viewport-width: 360px;
      --handoff-target-viewport-height: 484px;
      --handoff-arrow-size: 28px;
      --handoff-arrow-offset-y: -10px;
    }
    *, *::before, *::after { box-sizing: border-box; }
    html, body { min-width: 100%; min-height: 100%; margin: 0; }
    body { overflow: auto; background: var(--surface); color: var(--text); }
    button, input { font: inherit; }
    button { cursor: pointer; }
    button:disabled { cursor: default; }
    .handoff-shell { min-height: 100%; display: grid; grid-template-rows: auto minmax(0, 1fr) auto auto auto auto auto; gap: var(--space-4); padding: var(--space-6); }
    .handoff-shell > * { min-width: 0; }
    .handoff-header { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--space-6); }
    .handoff-eyebrow { margin: 0 0 var(--space-1); color: var(--tone-update); font-size: var(--type-label); font-weight: var(--weight-medium); }
    h1 { margin: 0; font-size: var(--type-heading); font-weight: var(--weight-heading); line-height: var(--line-height-heading); }
    .handoff-lede { max-width: 720px; margin: var(--space-2) 0 0; color: var(--text-secondary); font-size: var(--type-compact); line-height: var(--line-height-compact); }
    .handoff-phase { flex: 0 0 auto; min-height: var(--control-height); padding: 0 var(--padding-control-inline); display: inline-flex; align-items: center; border: var(--stroke-hairline) solid var(--border-strong); border-radius: var(--radius-pill); color: var(--text-secondary); font-size: var(--type-label); font-weight: var(--weight-medium); white-space: nowrap; }
    .handoff-state-labels { display: flex; flex-direction: column; align-items: flex-end; gap: var(--space-2); }
    .handoff-phase[data-state="verified"] { border-color: var(--tone-update); background: var(--tone-update-surface); color: var(--tone-update); }
    .handoff-phase[data-state="denied"], .handoff-phase[data-state="stillDenied"] { border-color: var(--warning); background: var(--surface-hover); color: var(--warning); }
    .handoff-transition { color: var(--text-secondary); font-size: var(--type-label); line-height: var(--line-height-label); }
    .handoff-stage { position: relative; min-height: var(--handoff-stage-min-height); display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: var(--handoff-stage-gap); }
    .handoff-pane { min-width: 0; display: flex; flex-direction: column; gap: var(--space-2); }
    .handoff-pane-heading { display: flex; align-items: center; justify-content: space-between; gap: var(--space-2); min-height: var(--line-height-label); }
    .handoff-pane-title { color: var(--text-secondary); font-size: var(--type-label); font-weight: var(--weight-medium); }
    .handoff-source-note, .handoff-native-note { color: var(--text-secondary); font-size: var(--type-label); line-height: var(--line-height-label); }
    .handoff-native-note { color: var(--tone-update); }
    .handoff-source-frame-wrap, .handoff-settings-window { min-width: 0; min-height: 0; border: var(--stroke-hairline) solid var(--border); border-radius: var(--radius-lg); background: var(--surface-raised); box-shadow: var(--shadow-dialog); }
    .handoff-source-frame-wrap { position: relative; flex: 1 1 auto; display: grid; place-items: center; padding: var(--padding-dialog); overflow: hidden; }
    #sourceFrame { display: block; inline-size: min(100%, var(--handoff-source-viewport-width)); block-size: min(100%, var(--handoff-source-viewport-height)); border: var(--stroke-hairline) solid var(--border-strong); border-radius: var(--radius-dialog); background: var(--window); box-shadow: var(--shadow-control); }
    .handoff-settings-window { inline-size: min(100%, var(--handoff-target-viewport-width)); block-size: min(100%, var(--handoff-target-viewport-height)); align-self: center; overflow: hidden; transition: border-color var(--duration-feedback) ease, box-shadow var(--duration-feedback) ease; }
    .handoff-settings-window[data-drag-over="true"] { border-color: var(--tone-info); box-shadow: 0 0 0 var(--stroke-focus) color-mix(in oklch, var(--tone-info), transparent 68%), var(--shadow-dialog); }
    .handoff-settings-titlebar { min-height: var(--control-height); display: flex; align-items: center; gap: var(--gap-inline); padding: 0 var(--padding-dialog); border-bottom: var(--stroke-hairline) solid var(--border); background: var(--surface); font-size: var(--type-label); font-weight: var(--weight-medium); }
    .handoff-settings-dot { inline-size: var(--space-2); block-size: var(--space-2); border-radius: var(--radius-circle); background: var(--border-strong); }
    .handoff-settings-content { display: flex; flex-direction: column; gap: var(--gap-section); padding: var(--space-6); }
    .handoff-settings-kicker { margin: 0; color: var(--text-secondary); font-size: var(--type-label); line-height: var(--line-height-label); }
    .handoff-settings-heading { margin: 0; font-size: var(--type-heading); font-weight: var(--weight-heading); line-height: var(--line-height-heading); }
    .handoff-target-row { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: var(--gap-inline); min-height: calc(var(--control-height) + var(--space-6)); padding: var(--padding-panel); border: var(--stroke-hairline) solid var(--border); border-radius: var(--radius-md); background: var(--surface-raised); }
    .handoff-target-app-icon { inline-size: var(--space-6); block-size: var(--space-6); display: block; object-fit: contain; }
    .handoff-target-copy { min-width: 0; display: flex; flex-direction: column; gap: var(--gap-meta-stack); font-size: var(--type-compact); line-height: var(--line-height-compact); }
    .handoff-target-copy strong { font-weight: var(--weight-medium); }
    .handoff-target-copy span { color: var(--text-secondary); font-size: var(--type-label); line-height: var(--line-height-label); }
    .handoff-target-switch { position: relative; inline-size: var(--space-8); block-size: var(--badge-height); border: 0; border-radius: var(--radius-pill); background: var(--border-strong); transition: background-color var(--duration-feedback) ease; }
    .handoff-target-switch::after { content: ''; position: absolute; inset-block-start: var(--stroke-hairline); inset-inline-start: var(--stroke-hairline); inline-size: calc(var(--badge-height) - var(--stroke-hairline) - var(--stroke-hairline)); block-size: calc(var(--badge-height) - var(--stroke-hairline) - var(--stroke-hairline)); border-radius: var(--radius-circle); background: var(--surface-raised); box-shadow: var(--shadow-control); transition: transform var(--duration-feedback) ease; }
    .handoff-target-switch[aria-checked="true"] { background: var(--tone-update); }
    .handoff-target-switch[aria-checked="true"]::after { transform: translateX(calc(var(--space-8) - var(--badge-height))); }
    .handoff-accessory-wrap { position: relative; inline-size: min(100%, var(--handoff-target-viewport-width)); align-self: center; visibility: hidden; pointer-events: none; opacity: 0; }
    .handoff-accessory-wrap[data-visible="true"] { visibility: visible; pointer-events: auto; opacity: 1; }
    .handoff-accessory { display: flex; align-items: center; gap: var(--gap-inline); padding: var(--padding-panel); border: var(--stroke-hairline) solid var(--border-strong); border-radius: var(--radius-lg); background: var(--surface-raised); box-shadow: var(--shadow-dialog); }
    .handoff-draggable-app { min-width: 0; flex: 1 1 auto; display: flex; align-items: center; gap: var(--gap-inline); padding: 0; border: 0; background: transparent; color: inherit; text-align: left; cursor: grab; }
    .handoff-draggable-app:active { cursor: grabbing; }
    .handoff-draggable-app[data-dragging="true"] { opacity: 0; }
    .handoff-drag-image-host { position: fixed; inset: -9999px auto auto -9999px; pointer-events: none; }
    .handoff-drag-image { inline-size: max-content; block-size: auto; }
    .handoff-accessory-icon { inline-size: var(--space-8); block-size: var(--space-8); flex: 0 0 auto; object-fit: contain; }
    .handoff-accessory-copy { min-width: 0; flex: 1 1 auto; display: flex; flex-direction: column; gap: var(--gap-meta-stack); font-size: var(--type-compact); line-height: var(--line-height-compact); }
    .handoff-accessory-copy strong { font-weight: var(--weight-medium); }
    .handoff-accessory-copy span { color: var(--text-secondary); font-size: var(--type-label); line-height: var(--line-height-label); }
    .handoff-hint-arrow { position: absolute; z-index: 2; inset: calc(-1 * var(--handoff-arrow-size)) auto auto 50%; inline-size: var(--handoff-arrow-size); block-size: var(--handoff-arrow-size); display: grid; place-items: center; color: var(--tone-info); filter: drop-shadow(0 4px 7px rgba(0, 0, 0, .23)); transform: translate(-50%, var(--handoff-arrow-offset-y)) scale(1); transform-origin: 50% 100%; pointer-events: none; will-change: transform; }
    .handoff-hint-arrow svg { inline-size: var(--handoff-arrow-size); block-size: var(--handoff-arrow-size); display: block; }
    .handoff-hint-arrow path, .handoff-reference-project-arrow path { stroke: var(--surface-raised); stroke-width: 18; stroke-linejoin: round; paint-order: stroke fill; }
    .handoff-proxy-layer { position: absolute; inset: 0; z-index: var(--z-toast); pointer-events: none; overflow: hidden; }
    .handoff-proxy { position: absolute; inset: 0 auto auto 0; overflow: visible; border-radius: inherit; transform-origin: center; will-change: transform, width, height; }
    .handoff-proxy-shadow, .handoff-proxy-stroke, .handoff-proxy-slot { position: absolute; inset: 0; border-radius: inherit; }
    .handoff-proxy-shadow[data-layer="key"] { box-shadow: 0 5px 15px rgba(0, 0, 0, .09); }
    .handoff-proxy-shadow[data-layer="ambient"] { box-shadow: 0 0 3px rgba(0, 0, 0, .20); }
    .handoff-proxy-shadow[data-layer="destination"] { box-shadow: 0 3px 2px rgba(0, 0, 0, .06); }
    .handoff-proxy-stroke { border: .5px solid #000; }
    .handoff-proxy-slot { overflow: hidden; transform-origin: center; will-change: opacity, filter; }
    .handoff-controls { display: flex; align-items: center; gap: var(--gap-control); }
    .handoff-control-button { min-inline-size: max-content; }
    .handoff-motion-control { min-width: 0; margin-inline-start: auto; display: flex; align-items: center; justify-content: flex-end; gap: var(--gap-inline); color: var(--text-secondary); font-size: var(--type-label); }
    .handoff-motion-control label { display: inline-flex; align-items: center; gap: var(--space-1); white-space: nowrap; }
    .handoff-inspector { display: flex; flex-wrap: wrap; justify-content: space-between; gap: var(--space-2) var(--space-6); min-height: var(--line-height-label); color: var(--text-secondary); font-size: var(--type-label); line-height: var(--line-height-label); }
    .handoff-reference { display: grid; gap: var(--space-3); padding: var(--padding-panel); border: var(--stroke-hairline) solid var(--border); border-radius: var(--radius-lg); background: var(--surface-raised); }
    .handoff-reference-heading { display: flex; align-items: baseline; justify-content: space-between; gap: var(--space-4); }
    .handoff-reference-heading h2 { margin: 0; font-size: var(--type-compact); font-weight: var(--weight-medium); line-height: var(--line-height-compact); }
    .handoff-reference-heading p { margin: 0; color: var(--text-secondary); font-size: var(--type-label); line-height: var(--line-height-label); }
    .handoff-reference-grid { display: grid; grid-template-columns: minmax(0, 1.5fr) repeat(2, minmax(132px, .5fr)); gap: var(--space-3); }
    .handoff-reference-card { min-width: 0; min-height: 152px; display: grid; align-content: start; gap: var(--space-2); padding: var(--space-3); border-radius: var(--radius-md); background: var(--surface); }
    .handoff-reference-card strong { font-size: var(--type-label); font-weight: var(--weight-medium); line-height: var(--line-height-label); }
    .handoff-reference-card small { color: var(--text-secondary); font-size: var(--type-label); line-height: var(--line-height-label); }
    .handoff-reference-media { min-height: 96px; display: grid; place-items: center; overflow: hidden; border-radius: var(--radius-sm); background-image: linear-gradient(45deg, var(--surface-hover) 25%, transparent 25%), linear-gradient(-45deg, var(--surface-hover) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, var(--surface-hover) 75%), linear-gradient(-45deg, transparent 75%, var(--surface-hover) 75%); background-position: 0 0, 0 var(--space-2), var(--space-2) calc(-1 * var(--space-2)), calc(-1 * var(--space-2)) 0; background-size: calc(var(--space-2) * 2) calc(var(--space-2) * 2); }
    .handoff-reference-system { inline-size: 100%; block-size: 180px; object-fit: contain; }
    .handoff-reference-raster { inline-size: 87px; block-size: 99px; object-fit: contain; }
    .handoff-reference-project-arrow { inline-size: 84px; block-size: 84px; display: grid; place-items: center; color: var(--tone-info); filter: drop-shadow(0 4px 7px rgba(0, 0, 0, .23)); }
    .handoff-reference-project-arrow svg { inline-size: 84px; block-size: 84px; display: block; }
    .handoff-reference-fallback { display: none; max-width: 20ch; color: var(--text-secondary); font-size: var(--type-label); line-height: var(--line-height-label); text-align: center; }
    .handoff-reference-card[data-available="false"] img { display: none; }
    .handoff-reference-card[data-available="false"] .handoff-reference-fallback { display: block; }
    .handoff-chain { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: var(--gap-inline); padding: var(--padding-panel); border: var(--stroke-hairline) solid var(--border); border-radius: var(--radius-lg); background: var(--surface-raised); }
    .handoff-chain-title { margin: 0; color: var(--text-secondary); font-size: var(--type-label); font-weight: var(--weight-medium); line-height: var(--line-height-label); }
    .handoff-event-list { min-width: 0; display: flex; flex-wrap: wrap; gap: var(--space-2) var(--space-4); margin: 0; padding: 0; list-style: none; }
    .handoff-event { display: inline-flex; align-items: center; gap: var(--space-1); color: var(--text-secondary); font-size: var(--type-label); line-height: var(--line-height-label); }
    .handoff-event svg { inline-size: var(--space-4); block-size: var(--space-4); flex: 0 0 auto; }
    .handoff-event[data-tone="warning"] { color: var(--warning); }
    .handoff-event[data-tone="success"] { color: var(--tone-update); }
    .handoff-footer { display: flex; justify-content: space-between; gap: var(--space-4); color: var(--text-secondary); font-size: var(--type-label); line-height: var(--line-height-label); }
    .handoff-footer strong { color: var(--text); font-weight: var(--weight-medium); }
    @media (max-width: 900px) {
      .handoff-shell { padding: var(--space-4); }
      .handoff-stage { grid-template-columns: 1fr; min-height: 0; }
      .handoff-source-frame-wrap { min-height: var(--handoff-source-viewport-height); }
      .handoff-settings-window { min-height: var(--handoff-target-viewport-height); }
      .handoff-proxy-layer { display: none; }
      .handoff-controls { flex-wrap: wrap; }
      .handoff-motion-control { inline-size: 100%; margin-inline-start: 0; justify-content: flex-start; }
      .handoff-reference-grid { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <main class="handoff-shell">
    <header class="handoff-header">
      <div>
        <p class="handoff-eyebrow">权限交接原型 · clean-room UI Review</p>
        <h1>macOS App Management 权限交接动画</h1>
        <p class="handoff-lede">左侧是实时生产 renderer iframe；右侧只模拟系统设置目标。中间 DOM proxy 只审查源/目标几何与视觉层 morph；原生实现必须改用 NSImage capture、每屏 NSPanel replicant 与落稳后的实时 accessory。</p>
      </div>
      <div class="handoff-state-labels">
        <output id="workflowLabel" class="handoff-phase" data-state="denied" aria-live="polite">等待打开设置</output>
        <output id="transitionLabel" class="handoff-transition" aria-live="polite">视觉：待命</output>
      </div>
    </header>

    <section id="handoffStage" class="handoff-stage" aria-label="权限交接动画舞台">
      <article class="handoff-pane">
        <div class="handoff-pane-heading">
          <span class="handoff-pane-title">Live source · production renderer</span>
          <span id="sourceState" class="handoff-source-note">等待真实源布局</span>
        </div>
        <div class="handoff-source-frame-wrap">
          <iframe id="sourceFrame" title="真实生产 renderer 权限场景"></iframe>
        </div>
      </article>

      <article class="handoff-pane">
        <div class="handoff-pane-heading">
          <span class="handoff-pane-title">Destination · system settings</span>
          <span class="handoff-native-note">native mock</span>
        </div>
        <div id="destinationDropZone" class="handoff-settings-window" data-drag-over="false">
          <div class="handoff-settings-titlebar"><span class="handoff-settings-dot" aria-hidden="true"></span><span>System Settings</span></div>
          <div class="handoff-settings-content">
            <p class="handoff-settings-kicker">Privacy &amp; Security</p>
            <h2 class="handoff-settings-heading">App Management</h2>
            <div id="destinationPermissionRow" class="handoff-target-row">
              <img class="handoff-target-app-icon" src="/renderer/app-icon.png" alt="" />
              <span class="handoff-target-copy"><strong>Language Switcher</strong><span>Allow changes to the selected app.</span></span>
              <button id="existingRowSwitch" class="handoff-target-switch" type="button" role="switch" aria-checked="false" aria-label="模拟开启已有 App 行"></button>
            </div>
            <p class="handoff-settings-kicker">The real authorization remains owned by macOS. This panel is only a visual target for review.</p>
          </div>
        </div>
        <div id="accessoryWrap" class="handoff-accessory-wrap" data-visible="false" aria-hidden="true" inert>
          <span id="hintArrow" class="handoff-hint-arrow" aria-hidden="true"></span>
          <section id="accessory" class="handoff-accessory" aria-live="polite">
            <button id="draggableAppRow" class="handoff-draggable-app" type="button" draggable="true">
              <img class="handoff-accessory-icon" src="/renderer/app-icon.png" alt="" />
              <span class="handoff-accessory-copy"><strong>Language Switcher</strong><span>列表中没有时，把 App 拖入上方列表。</span></span>
            </button>
            <button id="reverseFromAccessory" class="ui-button button button-outline handoff-control-button" type="button">重试原操作</button>
          </section>
          <span id="appDragImageHost" class="handoff-drag-image-host" aria-hidden="true" inert></span>
        </div>
      </article>

      <div class="handoff-proxy-layer" aria-hidden="true">
        <div id="proxy" class="handoff-proxy" data-phase="idle" data-motion="full" hidden>
          <div id="proxyAmbientShadow" class="handoff-proxy-shadow" data-layer="ambient"></div>
          <div id="proxyKeyShadow" class="handoff-proxy-shadow" data-layer="key"></div>
          <div id="proxyDestinationShadow" class="handoff-proxy-shadow" data-layer="destination"></div>
          <div id="proxySource" class="handoff-proxy-slot" data-layer="source"></div>
          <div id="proxyDestination" class="handoff-proxy-slot" data-layer="destination"></div>
          <div id="proxyStroke" class="handoff-proxy-stroke"></div>
        </div>
      </div>
    </section>

    <section class="handoff-controls" aria-label="动画控制">
      <button class="ui-button button button-primary handoff-control-button" data-action="open-settings" type="button">打开设置并交接</button>
      <button class="ui-button button button-outline handoff-control-button" data-action="retry" type="button">验证当前进程权限</button>
      <button class="ui-button button button-outline handoff-control-button" data-action="result-success" type="button">演示：同进程已生效</button>
      <button class="ui-button button button-outline handoff-control-button" data-action="result-denied" type="button">演示：选择稍后</button>
      <button class="ui-button button button-outline handoff-control-button" data-action="result-reopen" type="button">演示：退出并重新打开</button>
      <button class="ui-button button button-outline handoff-control-button" data-action="result-error" type="button">演示：其他错误</button>
      <button class="ui-button button button-outline handoff-control-button" data-action="reset" type="button">重置</button>
      <div class="handoff-motion-control">
        <label><input id="reduceMotion" type="checkbox" /> 项目无障碍降级：静态交接</label>
      </div>
    </section>
    <section class="handoff-chain" aria-labelledby="handoffChainTitle">
      <h2 id="handoffChainTitle" class="handoff-chain-title">本次链路事件</h2>
      <ol id="workflowEvents" class="handoff-event-list" aria-live="polite"></ol>
    </section>
    <div class="handoff-inspector"><span id="geometryText">源 / 目标几何：等待真实权限动作</span><span id="motionText">R1 单屏 DOM 替身 · 不验证 backing scale / 多屏</span></div>
    <section class="handoff-reference" aria-labelledby="handoffReferenceTitle">
      <div class="handoff-reference-heading">
        <h2 id="handoffReferenceTitle">本机视觉参考</h2>
        <p>仅由 localhost 读取系统临时目录，不进入仓库、构建或发布包。</p>
      </div>
      <div class="handoff-reference-grid">
        <article class="handoff-reference-card" data-local-reference-card data-available="pending">
          <strong>真实 System Settings</strong>
          <div class="handoff-reference-media">
            <img class="handoff-reference-system" data-local-reference src="/local-reference/system-settings.png?v=2" alt="本机 System Settings 中 Cavalry Language Switcher 的 App Management 行" />
            <span class="handoff-reference-fallback">本机参考图尚未生成。</span>
          </div>
          <small>仅保留真实目标行；账户头像、侧栏与其他 App 已从截图源头排除。窗口几何以 point 表达。</small>
        </article>
        <article class="handoff-reference-card" data-local-reference-card data-available="pending">
          <strong>私有箭头 Raster（仅箭头）</strong>
          <div class="handoff-reference-media">
            <img class="handoff-reference-raster" data-local-reference src="/local-reference/hint-arrow.png" alt="本机私有引导箭头视觉参考" />
            <span class="handoff-reference-fallback">本机参考图尚未生成。</span>
          </div>
          <small>只用于核对提示箭头。箭头下方的 App 权限项是实时可拖控件，不是截图。</small>
        </article>
        <article class="handoff-reference-card" data-available="true">
          <strong>项目自绘候选</strong>
          <div class="handoff-reference-media"><span id="referenceProjectArrow" class="handoff-reference-project-arrow" aria-hidden="true"></span></div>
          <small>项目蓝 + 白色轮廓；只借鉴“实心引导箭头”的视觉语法，不复制私有路径。</small>
        </article>
      </div>
    </section>
    <footer class="handoff-footer"><span><strong>边界：</strong>DOM/HTML mock，不打开真实系统设置，不宣称 drop、授权、多屏或混合倍率证据。</span><span>生产边界：NSImage snapshots → per-screen NSPanel replicants → live AppKit accessory</span></footer>
  </main>
  <script>${permissionHandoffRuntimeScript()}</script>
</body>
</html>`;
}

module.exports = Object.freeze({ permissionHandoffHtml });
