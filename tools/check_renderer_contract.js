#!/usr/bin/env node
/**
 * [INPUT]: renderer 静态 DOM、语义 token/图标表、user-profile-text→ui-text四语字典、project-link-control固定外链适配、Select/Tooltip/Path/Activity/Updater/Toast/About/Windows caption 状态机、UI Review补丁状态与fake bridge/动态目录、nativeDefaultEnglish/nativeOfficialDefaultEnglish/nativeOwnedHans preview fixture、Restore/remediation/permission handoff、Issue form、来源通知/窗口配置、冻结bridge API与scope/locale/resource策略合同、node:crypto。
 * [OUTPUT]: 守住 UI 单向依赖、400×504主窗（40px标题栏+434px内容+30px footer）/Activity、原生标题栏、主页面 20px padding 派生的 10px 同行动作关系、无重复视觉标题但保留 OS 标题的 About（含四语「关注+平台图标」双列、GitHub/License全宽、平台区分的可访问名称、Phosphor XLogo与Simple Icons CC0路径指纹及固定链接合同）、Trigger/popup 双投影且开启后不漂移并保留但禁用当前语言的 Select 占位、跨平台 reconciliation Restore、版本只读门禁、普通验证失败才显露固定报告入口/四语文案且不得要求重装或不可见详情、typed 缺失基线错误才要求重装的 Activity 原位合同、仅消费后端只读清理投影、局部着色的 warning/error Marker、无描边彩色 Badge、局部失败 Toast、必要 AlertDialog 与单任务流；权限原型另冻结不受工作台假窗口压缩的完整 stage、当前 50pt 弧线/双图/项目自绘箭头节奏、532×112 的“单行指令 / Back + App row”参考同形 helper、透明底整条 App row snapshot 的 HTML drag 审查边界、瞬时 Alert/持久 Activity 两端点的一套 handoff 合同及不入库的本机视觉对照，并明确拒绝把 DOM 单屏替身冒充 NSImage/NSPanel/NSDraggingSession、多屏倍率或原生授权证据；工作台必须实时消费生产 renderer，显式 Back 才回到重新捕获的 Activity 动作，业务 settled 只清层，且不因 Node 模块缓存返回旧审查资源；另锁定 installation/userProfile DTO 投影、原厂English/Japanese与unknown+owned zh-Hans徽章矩阵、scope不推断安装来源、用户级Switch直达事务、仅Restore确认、固定英文恢复、Switch-only resource gate 与 hostless owned-only strict grant、nativeRestoreOnly结果不启动及host-probe不能伪造 Channel error 三项回归、三类固定 native 错误路由、仅 explicit Cavalry 2.8.0 preview + installed 2.7.2 时显露的闭合 legacyRelease 项和四语标签。
 * [POS]: renderer 的快速静态契约测试；冻结宽品牌标识的等可见间距；只证明配置/source 形状，不虚称 packaged WebView CSP 执行。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {
  fixtureSource,
  permissionHandoffHtml,
  renderReviewDocument,
  workspaceHtml,
} = require('./ui_review_server');
const {
  badgeCatalogHtml,
  feedbackCatalogHtml,
  iconCatalogHtml,
} = require('./ui_review_catalogs');
const { APP_SYNTAX_FILES } = require('./check_app_syntax.js');

const repoRoot = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(repoRoot, relative), 'utf8');
const UI_LOCALE_MARKERS = ['  en: {', "  'zh-Hans': {", "  'zh-Hant': {", '  ja_JP: {'];
const PROFILE_TEXT_KEYS = [
  'nativeUserProfileRecoveryTitle',
  'nativeResourceUnavailableTitle', 'nativeUserProfileReconciliation',
  'nativeResourceUnavailable', 'nativeUserProfileResourcesUnavailableRecovery',
  'nativeUserLanguageFailureTitle', 'nativeUserLanguageConflict', 'nativeUserLanguagePermissionDenied',
  'cavalryStillRunningUserProfile', 'nativeUserProfileRestoreConfirmTitle',
  'nativeUserProfileRestoreConfirmBody', 'nativeEnglishRestoreOnlyOutcome',
  'phaseVerifyEnglishRestoreRunningTitle', 'phaseVerifyEnglishRestoreCompletedTitle',
  'phaseVerifyEnglishRestoreErrorTitle', 'phaseEnsureRecoveryUserProfileRunningTitle',
  'phaseEnsureRecoveryUserProfileCompletedTitle', 'phaseEnsureRecoveryUserProfileErrorTitle',
  'phaseApplyEnglishRestoreRunningTitle', 'phaseApplyEnglishRestoreCompletedTitle',
  'phaseApplyEnglishRestoreErrorTitle',
];
const UPDATE_ICON_PATH = 'M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216Zm37.66-101.66a8,8,0,0,1-11.32,11.32L136,107.31V168a8,8,0,0,1-16,0V107.31l-18.34,18.35a8,8,0,0,1-11.32-11.32l32-32a8,8,0,0,1,11.32,0Z';
const RESTORE_ICON_PATH = 'M208,32H83.31A15.86,15.86,0,0,0,72,36.69L36.69,72A15.86,15.86,0,0,0,32,83.31V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V48A16,16,0,0,0,208,32ZM88,48h80V80H88ZM208,208H48V83.31l24-24V80A16,16,0,0,0,88,96h80a16,16,0,0,0,16-16V48h24Zm-80-96a40,40,0,1,0,40,40A40,40,0,0,0,128,112Zm0,64a24,24,0,1,1,24-24A24,24,0,0,1,128,176Z';

function uiLocaleBodies(source) {
  return UI_LOCALE_MARKERS.map((marker, index) => {
    const start = source.indexOf(marker);
    assert.notEqual(start, -1, `${marker} locale missing`);
    const nextMarker = UI_LOCALE_MARKERS[index + 1];
    const end = nextMarker ? source.indexOf(nextMarker, start) : source.indexOf('\n};', start);
    assert.notEqual(end, -1, `${marker} locale body is incomplete`);
    return source.slice(start, end);
  });
}

function sourceFunction(source, signature, nextSignature) {
  const start = source.indexOf(signature);
  assert.notEqual(start, -1, `${signature} missing`);
  const end = source.indexOf(nextSignature, start + signature.length);
  assert.notEqual(end, -1, `${signature} boundary missing`);
  return source.slice(start, end);
}

function sourceStatement(source, marker) {
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `${marker} missing`);
  const end = source.indexOf(';', start + marker.length);
  assert.notEqual(end, -1, `${marker} terminator missing`);
  return source.slice(start, end + 1);
}

test('renderer copy extraction stays in the renderer map and both pages load it before UI_TEXT', () => {
  const rendererMap = read('renderer/CLAUDE.md');
  const toolsMap = read('tools/CLAUDE.md');
  const mainPage = read('renderer/index.html');
  const aboutPage = read('renderer/about.html');
  const catalogs = read('tools/ui_review_catalogs.js');
  const packagedCheck = read('tools/check_tauri_packaged_app.js');
  const artifactManifest = JSON.parse(read('tools/source_artifact_manifest.json'));
  const packageJson = JSON.parse(read('package.json'));
  assert.match(rendererMap, /^# renderer\/\n/m);
  assert.doesNotMatch(rendererMap, /^# tools\/\n/m);
  assert.match(toolsMap, /^# tools\/\n/m);
  assert.doesNotMatch(toolsMap, /^# renderer\/\n/m, 'a renderer map must not be prepended to the tools map');
  assert.match(rendererMap, /^user-profile-text\.js:.*四语 userProfile/m);
  assert.match(toolsMap, /^check_renderer_contract\.js:/m);
  for (const [name, page] of [['main', mainPage], ['About', aboutPage]]) {
    assert.match(
      page,
      /<script src="\.\/tauri-bridge\.js"><\/script>\s*<script src="\.\/user-profile-text\.js"><\/script>\s*<script src="\.\/ui-text\.js"><\/script>/,
      `${name} must load native profile copy before the unified UI_TEXT consumer`
    );
  }
  assert.match(catalogs, /'<script src="\/renderer\/user-profile-text\.js"><\/script>',\s*'<script src="\/renderer\/ui-text\.js"><\/script>'/);
  assert.match(packagedCheck, /'user-profile-text\.js': sha256\(path\.join\(rendererRoot, 'user-profile-text\.js'\)\)/);
  assert.match(packagedCheck, /'index\.html', '\/styles\.css', '\/support-footer\.css', '\/project-link-control\.js', '\/support-footer\.js', '\/operation-log\.css', '\/user-profile-text\.js', '\/ui-text\.js'/);
  assert.ok(artifactManifest.requiredPaths.includes('renderer/user-profile-text.js'));
  assert.ok(artifactManifest.requiredPaths.includes('renderer/support-footer.css'));
  assert.ok(artifactManifest.requiredPaths.includes('renderer/support-footer.js'));
  assert.equal(packageJson.scripts['check:app'], 'node tools/check_app_syntax.js');
  assert.ok(APP_SYNTAX_FILES.indexOf('renderer/user-profile-text.js') < APP_SYNTAX_FILES.indexOf('renderer/ui-text.js'));
  assert.ok(APP_SYNTAX_FILES.includes('renderer/support-footer.js'));
});

test('UI Review renders the exact production shell and replaces only the data bridge', () => {
  const reviewServerSource = read('tools/ui_review_server.js');
  const workspaceModulePath = require.resolve('./ui_review_workspace');
  require(workspaceModulePath);
  require.cache[workspaceModulePath].exports = Object.freeze({ workspaceHtml: () => '<stale-workspace />' });
  const production = read('renderer/index.html');
  const review = renderReviewDocument();
  const aboutProduction = read('renderer/about.html');
  const aboutReview = renderReviewDocument('about.html');
  const workspace = workspaceHtml();
  const fixture = fixtureSource();
  const permissionHandoff = read('renderer/permission-handoff.js');
  const normalized = review
    .replace('\n  <base href="/renderer/" />', '')
    .replace('<script src="/fixture.js"></script>\n  ', '');

  assert.equal(normalized, production, 'review app may inject a base and fixture bridge, but may not copy or edit production UI');
  assert.notEqual(workspace, '<stale-workspace />', 'review server must evict stale workspace modules before rendering');
  assert.match(workspace, /\.window \{[^}]*width: 400px; height: 504px;/, 'review workspace must preserve the old main track and add the footer below it');
  assert.equal(
    aboutReview.replace('\n  <base href="/renderer/" />', '').replace('<script src="/fixture.js"></script>\n  ', ''),
    aboutProduction,
    'review About may inject a base and fixture bridge, but may not copy or edit production UI'
  );
  assert.match(workspace, /\.window\[data-surface="about"\] \{ width: 320px; height: 354px;/, 'About review frame must preserve the social row and full-width project rows');
  assert.match(fixture, /if \(scenario === 'aboutLinkToast'\)[\s\S]*?waitForReady\('#aboutXiaohongshuLink'\)/, 'About link failure fixture must exercise the new fixed social link');
  assert.match(review, /<script src="\/fixture\.js"><\/script>\s*<script src="\.\/tauri-bridge\.js"><\/script>/);
  assert.match(workspace, /<iframe id="reviewFrame"[^>]*><\/iframe>/);
  assert.match(workspace, /data-view="handoff"[^>]*><span>权限 handoff<\/span>/);
  assert.match(workspace, /const reviewPages = Object\.freeze\(\{ handoff: '\/handoff' \}\)/);
  assert.match(workspace, /\.window\[data-surface="handoff"\] \{ width: 100%; height: 100%; border: 0;/);
  assert.match(workspace, /\.stage\[data-kind="handoff"\] \{ display: block; padding: 0; \}/);
  assert.match(workspace, /data-scenario="updateAvailable"[^>]*><span>更新可用 · Tooltip<\/span>/);
  assert.match(workspace, /data-scenario="verifyFailure"[^>]*><span>普通验证失败 · 报告问题<\/span>/);
  assert.match(workspace, /data-scenario="error"[^>]*><span>错误立即打断 · Cavalry 仍在运行<\/span>/);
  for (const view of ['feedback', 'icons', 'badges']) {
    assert.match(workspace, new RegExp(`data-view="${view}"`));
    assert.match(workspace, new RegExp(`${view}: '/catalog/${view}'`));
  }
  assert.doesNotMatch(workspace, /id="(?:appVersion|currentLanguage|statusPanel|languageSelectRoot)"/);
  assert.doesNotMatch(workspace, /class="(?:badge|status-panel|toast)"/);
  assert.match(workspace, /const windowsScenarios = new Set\(\['windowsClean', 'permissionWindows'\]\)/);
  assert.match(workspace, /windowFrame\.dataset\.platform = windowsScenarios\.has\(scenario\) \? 'windows' : 'macos'/);
  assert.match(workspace, /\.window\[data-platform="windows"\] \.lights \{ display: none; \}/);
  assert.match(workspace, /fetch\('\/revision'/);
  assert.match(workspace, /if \(revision && next !== revision\) location\.reload\(\)/);
  assert.doesNotMatch(workspace, /revision && next !== revision\) frame\.contentWindow\.location\.reload/);
  assert.match(reviewServerSource, /for \(const request of reviewModuleRequests\) delete require\.cache\[require\.resolve\(request\)\]/);
  assert.match(reviewServerSource, /const reviewSourcePaths = Object\.freeze\(reviewModuleRequests\.map\(\(request\) => require\.resolve\(request\)\)\)/);
  assert.match(reviewServerSource, /return \[\.\.\.rendererSources, \.\.\.reviewSourcePaths\]/);
  assert.match(reviewServerSource, /process\.env\.CAVALRY_UI_REVIEW_REFERENCE_ROOT/);
  assert.match(reviewServerSource, /path\.join\(os\.tmpdir\(\), 'cavalry-i18n-ui-review'\)/);
  assert.match(reviewServerSource, /'\/local-reference\/hint-arrow\.png'/);
  assert.match(reviewServerSource, /'\/local-reference\/system-settings\.png'/);
  assert.match(reviewServerSource, /'\/local-reference\/accessory-helper\.png'/);
  assert.match(reviewServerSource, /url\.pathname === '\/favicon\.ico'/);
  assert.match(reviewServerSource, /Local reference unavailable/);
  assert.doesNotMatch(reviewServerSource, /const \{ workspaceHtml, permissionHandoffHtml \} = require\('\.\/ui_review_workspace'\)/);
  assert.doesNotMatch(reviewServerSource, /function rendererRevision\(\)/);
  assert.match(fixture, /window\.cavalryI18n = Object\.freeze/);
  assert.match(fixture, /scenario === 'verifyFailure' && phase === 'verifyInstallation'[\s\S]*?errorCode: null/);
  assert.match(fixture, /scenario === 'error' && phase === 'verifyInstallation'[\s\S]*?errorCode: 'cavalryStillRunning'/);
  assert.doesNotMatch(fixture, /nativeRestoreOnlyHostFailure' && phase === 'verifyInstallation'/,
    'an internal host probe failure must not invent a Channel error phase');
  assert.match(fixture, /\['updateAvailable', 'updateConfirm', 'update', 'updateFailure'\]\.includes\(scenario\)/);
  assert.match(fixture, /scenario === 'permissionMac' \? 'openPrivacy' : 'none'/);
  assert.match(fixture, /nativeOfficialScenario = \['nativeOfficialDefaultEnglish'\]\.includes\(scenario\)/);
  assert.match(fixture, /installationMode: nativeOfficialScenario[\s\S]*?\? 'official'[\s\S]*?nativeProfileScenario \|\| windowsScenario[\s\S]*?\? 'unknown'/);
  assert.match(fixture, /nativeLocaleStateByScenario = Object\.freeze\([\s\S]*?nativeDefaultEnglish: 'unset'[\s\S]*?nativeOwnedHans: 'explicit'/);
  assert.match(fixture, /officialRecoveryAvailable: nativeProfileScenario \? false/);
  assert.match(fixture, /\['verifyInstallation', 'ensureBaseline', 'applyTransaction', 'restartCavalry'\]/);
  assert.match(fixture, /onEvent\(\{ phase: 'downloading', downloaded, contentLength: total \}\)/);
  assert.match(
    fixture,
    /onEvent\(\{ phase, state: 'completed' \}\);\s*if \(permissionScenario && reviewOutcome === 'success' && phase === 'applyTransaction'\) \{\s*window\.parent\.postMessage\(\{ type: permissionReviewSettledMessage, result: 'success' \}, location\.origin\);\s*\}\s*\}\s*currentLang/,
    'permission review success must settle after applyTransaction commit and before restart'
  );
  assert.doesNotMatch(fixture, /<main|<header|class="badge"|class="status-panel"/, 'fixture owns data only, never product markup');

  const feedbackCatalog = feedbackCatalogHtml();
  const iconCatalog = iconCatalogHtml();
  const badgeCatalog = badgeCatalogHtml();
  for (const catalog of [feedbackCatalog, iconCatalog, badgeCatalog]) {
    assert.match(catalog, /\/renderer\/tokens\.css/);
    assert.match(catalog, /\/renderer\/styles\.css/);
  }
  assert.match(feedbackCatalog, /\/renderer\/ui-text\.js/);
  assert.match(iconCatalog, /\/renderer\/icons\.js/);
  assert.match(badgeCatalog, /\/renderer\/ui-text\.js/);
  assert.doesNotMatch(iconCatalog, /<path\s+d=/, 'icon catalog must use the production icon factory rather than copied paths');

  const handoff = permissionHandoffHtml();
  assert.match(handoff, /--handoff-stage-min-height: 604px/);
  assert.match(handoff, /\.handoff-shell > \* \{ min-width: 0; \}/);
  assert.match(handoff, /const sourceScenarioUrl = '\/app\?scenario=' \+ REVIEW\.sourceScenario/);
  assert.match(handoff, /actionButtons\.reset\.addEventListener\('click', \(\) => reset\(\{ reloadSource: true \}\)\)/);
  assert.match(handoff, /if \(reloadSource\) \{[\s\S]*?sourceReloadPending = true[\s\S]*?sourceFrame\.src = sourceScenarioUrl/);
  assert.match(handoff, /sourceFrame\.addEventListener\('load',[\s\S]*?sourceReloadDocument = sourceFrame\.contentDocument/);
  assert.match(handoff, /sourceReloadPending && sourceFrame\.contentDocument === sourceReloadDocument/);
  assert.match(handoff, /actionButtons\.openSettings\.disabled = sourceReloadPending \|\|/);
  assert.match(handoff, /sourceFrame\.src = sourceScenarioUrl/);
  assert.match(handoff, /sourceScenario: 'permissionMac'/);
  assert.match(handoff, /native mock/);
  assert.match(handoff, /R1 单屏 DOM 替身 · 不验证 backing scale \/ 多屏/);
  assert.match(handoff, /生产边界：NSImage snapshots → per-screen NSPanel replicants → live AppKit accessory/);
  assert.match(handoff, /项目无障碍降级：静态交接/);
  assert.match(handoff, /\/renderer\/tokens\.css/);
  assert.match(handoff, /\/renderer\/button\.css/);
  assert.match(handoff, /\/renderer\/icons\.js/);
  assert.match(handoff, /\/renderer\/app-icon\.png/);
  assert.match(handoff, /window\.cavalryIcons\.create\('handoffArrow'\)/);
  assert.match(handoff, /window\.cavalryIcons\.create\('back'\)/);
  assert.match(handoff, /--handoff-accessory-width: 532px/);
  assert.match(handoff, /--handoff-accessory-height: 112px/);
  assert.match(handoff, /Drag Cavalry Language Switcher to the list above to allow App Management/);
  assert.match(handoff, /id="reverseFromAccessory" class="handoff-accessory-back"[^>]*aria-label="Back"/);
  assert.match(handoff, /id="draggableAppRow"[\s\S]*?<span class="handoff-accessory-copy">Cavalry Language Switcher<\/span>/);
  assert.match(handoff, /\.handoff-drag-image \{[^}]*border-color: transparent;[^}]*background: transparent;[^}]*box-shadow: none;/);
  assert.doesNotMatch(handoff, /Not listed\?|重试原操作|handoff-accessory-copy[^\n]*<span>/);
  assert.match(handoff, /id="handoffReferenceTitle">本机视觉参考/);
  assert.match(handoff, /src="\/local-reference\/hint-arrow\.png"/);
  assert.match(handoff, /src="\/local-reference\/accessory-helper\.png\?v=1"/);
  assert.match(handoff, /私有箭头 Raster（仅箭头）/);
  assert.match(handoff, /App 权限项是实时可拖控件，不是截图/);
  assert.match(handoff, /src="\/local-reference\/system-settings\.png\?v=2"/);
  assert.match(handoff, /账户头像、侧栏与其他 App 已从截图源头排除/);
  assert.match(handoff, /不进入仓库、构建或发布包/);
  assert.match(handoff, /class="ui-button button button-primary handoff-control-button"/);
  assert.match(handoff, /responseSeconds: 0\.72/);
  assert.match(handoff, /dampingFraction: 1/);
  assert.match(handoff, /arcHeightCssPx: 50/);
  assert.match(handoff, /maxBlurPx: 12/);
  assert.match(handoff, /arrowInitialDelayMs: 500/);
  assert.match(handoff, /arrowStretchMs: 250/);
  assert.match(handoff, /arrowIdleMs: 4000/);
  assert.match(handoff, /arrowScaleX: 1\.15/);
  assert.match(handoff, /arrowScaleY: 1\.6/);
  assert.match(handoff, /arrowMass: 1/);
  assert.match(handoff, /arrowStiffness: 200/);
  assert.match(handoff, /arrowDamping: 11/);
  assert.match(handoff, /const decay = MOTION\.dampingFraction \* omega/);
  assert.match(handoff, /return 1 - Math\.exp\(-decay \* seconds\) \* \(1 \+ decay \* seconds\)/);
  assert.match(handoff, /const apexY = Math\.min\(sourceCenter\.y, targetCenter\.y\) - MOTION\.arcHeightCssPx/);
  assert.match(handoff, /y: 2 \* apexY - 0\.5 \* sourceCenter\.y - 0\.5 \* targetCenter\.y/);
  assert.match(handoff, /iframeRect\.width - borderLeft - borderRight/);
  assert.match(handoff, /iframeRect\.height - borderTop - borderBottom/);
  assert.match(handoff, /sourceActionSelectors: Object\.freeze\(\['#modalPrimaryButton', '#permissionButton'\]\)/);
  assert.match(handoff, /document\.importNode\(sourceElement, true\)/);
  assert.match(handoff, /sourceElement\.querySelectorAll\('\*'\)/);
  assert.match(handoff, /sourceObserver = new MutationObserver\(scheduleGeometryCapture\)/);
  assert.match(handoff, /sourceObserver\.observe\(sourceDocument\.documentElement/);
  assert.match(handoff, /transitionPhase === 'presented' && captures\?\.source[\s\S]*?captureTargetGeometry\(\{ source: captures\.source/);
  assert.match(handoff, /if \(transitionPhase === 'idle'\) captureGeometry\(\)/);
  assert.match(handoff, /replaceClone\(proxySource, source\.element\)/);
  assert.match(handoff, /replaceClone\(proxyDestination, target\.element\)/);
  assert.match(handoff, /selector: '#draggableAppRow'/);
  assert.match(handoff, /function startOpenSettings\(sourceRect = null, returnRect = null\)[\s\S]*?captureSourceGeometry\(\)/);
  assert.match(handoff, /requestedSourceRect = sourceRect/);
  assert.match(handoff, /requestedReturnRect = returnRect/);
  assert.match(handoff, /proxySource\.style\.opacity/);
  assert.match(handoff, /proxyDestination\.style\.opacity/);
  assert.match(handoff, /const visualProgress = clamp\(progress, 0, 1\)/);
  assert.match(handoff, /proxySource\.style\.filter = 'blur\('/);
  assert.match(handoff, /proxyDestination\.style\.filter = 'blur\('/);
  assert.match(handoff, /prefers-reduced-motion: reduce/);
  assert.match(handoff, /function prefersReducedMotion\(\)[\s\S]*?reducedMotionQuery\?\.matches === true/);
  assert.match(handoff, /reducedMotionQuery\?\.addEventListener\?\.\('change', handleReducedMotionChange\)/);
  assert.match(handoff, /mouseenter[\s\S]*?prefersReducedMotion\(\)/);
  assert.match(handoff, /function animateReduced\(target\)/);
  assert.match(handoff, /function animateSpring\(target\)/);
  assert.match(handoff, /function animateReduced\(target\)[\s\S]*?proxy\.dataset\.motion = 'reduced'/);
  assert.match(handoff, /function animateSpring\(target\)[\s\S]*?proxy\.dataset\.motion = 'full'/);
  assert.match(handoff, /function presentStaticFallback\(\)[\s\S]*?sourceUnavailable[\s\S]*?setTransitionPhase\('presented'\)/);
  assert.match(handoff, /if \(!sourceGeometry\) \{[\s\S]*?presentStaticFallback\(\)/);
  assert.match(handoff, /if \(!source\) \{[\s\S]*?sourceState\.textContent = '源动作不可用'/);
  assert.match(handoff, /R1 静态 fallback · source capture unavailable · no flight/);
  assert.match(handoff, /let transitionPhase = 'idle'[\s\S]*?let workflowState = 'denied'/);
  assert.match(handoff, /function finish\(target\)[\s\S]*?setTransitionPhase\(target === 1 \? 'presented' : 'idle'\)[\s\S]*?proxy\.hidden = true/);
  const handoffFinish = sourceFunction(handoff, 'function finish(target)', 'function animateReduced(target)');
  assert.doesNotMatch(handoffFinish, /appDropAccepted|protectedApplyCommitted/, 'visual completion must not manufacture drop or protected-write success');
  for (const eventName of ['transactionDenied', 'sourceCaptured', 'sourceUnavailable', 'settingsRequested', 'settingsLocated', 'destinationCaptured', 'handoffPresented', 'appDragStarted', 'appDropAccepted', 'appDropRejected', 'dragCancelled', 'existingRowEnabled', 'handoffDismissed', 'retryRequested', 'laterChosen', 'protectedApplyCommitted', 'permissionStillMissing', 'systemQuitAndReopen', 'freshSessionStarted', 'typedError']) {
    assert.match(handoff, new RegExp(`${eventName}: Object\\.freeze|appendWorkflowEvent\\('${eventName}'\\)|occurredWorkflowEvents = \\['${eventName}'\\]`));
  }
  assert.match(handoff, /openMessage: 'cavalry-ui-review:permission-handoff-open'/);
  assert.match(handoff, /function handleSourceMessage\(event\)[\s\S]*?startOpenSettings\(event\.data\.sourceRect \|\| null, event\.data\.returnRect \|\| null\)/);
  assert.match(handoff, /postMessage\(\{ type: REVIEW\.openedMessage \}/);
  assert.match(handoff, /postMessage\(\{ type: REVIEW\.eventMessage, outcome: 'retryRequested' \}/);
  assert.match(permissionHandoff, /function captureSourceRect\(element\)/);
  assert.match(permissionHandoff, /function captureViewport\(\)/);
  assert.match(permissionHandoff, /api\.openPrivacySecurity\(\{ sourceRect, returnRect, viewportCss \}, \(event\) =>/);
  assert.match(permissionHandoff, /event\.outcome === 'retryRequested'[\s\S]*?onRetry/);
  assert.match(handoff, /function resolveRetry\(result\)[\s\S]*?workflowState !== 'retrying'/);
  assert.match(handoff, /resultError: document\.querySelector\('\[data-action="result-error"\]'\)/);
  assert.match(handoff, /const resultCanBeInjected = \['awaitingUser', 'retrying'\]\.includes\(workflowState\)/);
  assert.match(handoff, /const reopenCanBeInjected = \['awaitingUser', 'retrying', 'stillDenied'\]\.includes\(workflowState\)/);
  assert.match(handoff, /actionButtons\.resultError\.disabled = !resultCanBeInjected/);
  assert.match(handoff, /function demonstrateRetryResult\(result\)[\s\S]*?startRetry\(\)[\s\S]*?resolveRetry\(result\)/);
  assert.match(handoff, /function simulateLater\(\)[\s\S]*?laterChosen[\s\S]*?demonstrateRetryResult\('denied'\)/);
  assert.match(handoff, /function dismissFromAccessory\(\)[\s\S]*?setWorkflowState\('returning'\)[\s\S]*?animateTo\(0\)/);
  assert.match(handoff, /function returnCapture\(stageRect\)[\s\S]*?#permissionButton/);
  assert.match(handoff, /function cleanupAfterSettled\(nextState, eventName\)[\s\S]*?setTransitionPhase\('idle'\)/);
  assert.doesNotMatch(handoff, /reverseAfterSettled/);
  assert.match(handoff, /reverseFromAccessory\.addEventListener\('click', dismissFromAccessory\)/);
  assert.match(handoff, /actionButtons\.resultDenied\.addEventListener\('click', simulateLater\)/);
  assert.match(handoff, /demonstrateRetryResult\('error'\)/);
  assert.match(handoff, /演示：同进程已生效/);
  assert.match(handoff, /演示：选择稍后/);
  assert.match(handoff, /演示：退出并重新打开/);
  assert.match(handoff, /draggableAppRow\.addEventListener\('dragstart', handleDragStart\)/);
  assert.match(handoff, /destinationDropZone\.addEventListener\('drop', handleDrop\)/);
  assert.match(handoff, /event\.dataTransfer\.effectAllowed = 'copy'/);
  assert.match(handoff, /appBundleFileUrl: 'file:\/\/\/Applications\/Cavalry%20Language%20Switcher\.app'/);
  assert.match(handoff, /event\.dataTransfer\.setData\('text\/uri-list', REVIEW\.appBundleFileUrl\)/);
  assert.match(handoff, /const isKnownAppSource = dragOutcome === 'pending'[\s\S]*?if \(!isKnownAppSource\)[\s\S]*?appDropRejected/);
  assert.match(handoff, /appDropAccepted[\s\S]*?System Settings 模拟接收 App；正在验证权限/);
  assert.match(handoff, /id="destinationDropZone" class="handoff-settings-window" data-drag-over="false"/);
  assert.match(handoff, /id="appDragImageHost" class="handoff-drag-image-host" aria-hidden="true" inert/);
  assert.match(handoff, /const appDragImage = draggableAppRow\.cloneNode\(true\)/);
  assert.match(handoff, /appDragImage\.style\.inlineSize = rowRect\.width \+ 'px'/);
  assert.match(handoff, /event\.dataTransfer\.setDragImage\?\.\(appDragImage, dragOffsetX, dragOffsetY\)/);
  assert.doesNotMatch(handoff, /handoff-drag-image-size|(?<![0-9])56px/, 'target sample drags the live app-row snapshot, not an icon-only proxy');
  assert.match(handoff, /function handleDrop\(event\)[\s\S]*?existingRowSwitch\.setAttribute\('aria-checked', 'true'\)[\s\S]*?demonstrateRetryResult\('denied'\)/);
  assert.match(handoff, /function simulateSystemQuitAndReopen\(\)[\s\S]*?sourceFrame\.src = freshSessionUrl[\s\S]*?freshSessionStarted/);
  assert.doesNotMatch(handoff, /系统设置接受 copy drop/, 'browser review must not present an HTML drop as native System Settings evidence');
  assert.match(handoff, /id="existingRowSwitch"[\s\S]*?role="switch" aria-checked="false"/);
  assert.match(handoff, /existingRowSwitch\.setAttribute\('aria-checked', 'true'\)/);
  assert.match(handoff, /function setAccessoryVisibility\(visible\)[\s\S]*?accessoryWrap\.inert = !visible/);
  assert.match(handoff, /const sessionGeneration = \+\+handoffSessionGeneration[\s\S]*?sessionGeneration !== handoffSessionGeneration/);
  assert.match(handoff, /function dispose\(\)[\s\S]*?sourceObserver\?\.disconnect\(\)[\s\S]*?proxy\.hidden = true/);
  assert.match(handoff, /requestAnimationFrame\(frame\)/);
  assert.doesNotMatch(handoff, /durationSeconds: 0\.72|initialAlpha: 0\.9|minimumLaunchScale: 0\.58|liftRatio: 0\.18|liftMinimumPx: 44|liftMaximumPx: 140/, 'handoff must not retain public-replica motion constants as current sample truth');
  assert.doesNotMatch(handoff, /<span class="handoff-target-glyph"|<span[^>]*>✓<\/span>|<span[^>]*>↗<\/span>/, 'review icons must reuse production assets instead of handwritten glyphs');
  assert.doesNotMatch(handoff, /destinationAnchor|dataset\.reached|data-active=/, 'handoff completion must land on the helper rather than pretend the System Settings row is granted');
  assert.doesNotMatch(handoff, /<dialog|modal-backdrop|modal-dialog/, 'handoff must use the production iframe instead of copying the permission dialog');
});

function cssRule(source, selector) {
  const start = source.indexOf(selector);
  assert.notEqual(start, -1, `${selector} rule missing`);
  const open = source.indexOf('{', start + selector.length);
  const close = source.indexOf('}', open + 1);
  assert.ok(open > start && close > open, `${selector} rule is incomplete`);
  return source.slice(start, close + 1);
}

const REQUIRED_IDS = [
  'skipLink', 'mainContent', 'windowTitle', 'appVersion', 'appPath', 'appPathPrefix', 'appPathLeaf', 'languageSectionLabel', 'currentLabel', 'currentLanguage', 'installationBadge',
  'updateControl', 'updateButton', 'updateTooltip', 'updateTooltipText', 'updateAnnouncement',
  'aboutControl', 'aboutButton', 'aboutTooltip', 'aboutTooltipText',
  'windowsWindowControls', 'windowMinimizeButton', 'windowMaximizeButton', 'windowCloseButton',
  'installationMode', 'switchToLabel', 'languageSelectRoot', 'languageSelect', 'languageSelectTrigger', 'languageSelectValue', 'languageSelectPopup', 'languageSelectList', 'browseButton', 'applyButton', 'restoreButton',
  'permissionButton', 'legacyReleaseButton', 'reportIssueButton', 'statusLabel', 'statusIdle', 'statusIntro', 'statusViewport', 'statusOutcome',
  'modalBackdrop', 'modalTitle', 'modalBody', 'modalPrimaryButton', 'modalSecondaryButton', 'statusText',
  'supportFooter', 'supportFooterMessage', 'supportFooterLinks', 'supportGithubLink', 'supportGithubIcon',
  'supportTwitterLink', 'supportTwitterIcon', 'supportXiaohongshuLink', 'supportXiaohongshuIcon',
];

const REQUIRED_API_METHODS = [
  'getStatus', 'browseApp', 'applyLanguage', 'openPrivacySecurity',
  'openProjectLink', 'showAbout', 'getSwitcherVersion',
  'checkUpdate', 'installUpdate',
  'minimizeWindow', 'toggleMaximizeWindow', 'isWindowMaximized', 'closeWindow',
];

test('semantic icon registry is frozen, defensive, and returns independent accessible SVG nodes', () => {
  const createNode = () => ({
    attributes: new Map(), children: [],
    setAttribute(key, value) { this.attributes.set(key, String(value)); },
    append(...children) { this.children.push(...children); },
  });
  const window = {};
  vm.runInNewContext(read('renderer/icons.js'), {
    window,
    document: { createElementNS: createNode },
  });
  const first = window.cavalryIcons.create('verify');
  const second = window.cavalryIcons.create('verify');
  assert.equal(Object.isFrozen(window.cavalryIcons), true);
  assert.notEqual(first, second, 'each consumer must receive an independent SVG node');
  assert.deepEqual(Object.fromEntries(first.attributes), {
    viewBox: '0 0 256 256', 'aria-hidden': 'true', focusable: 'false', fill: 'currentColor',
  });
  assert.ok(first.children[0].attributes.get('d'));
  assert.equal(
    window.cavalryIcons.create('restore').children[0].attributes.get('d'),
    RESTORE_ICON_PATH,
    'Restore must use the pinned Phosphor Regular FloppyDiskBack path'
  );
  assert.ok(window.cavalryIcons.create('dragUp')?.children[0]?.attributes.get('d'), 'permission drag hint must resolve through the shared icon registry');
  assert.equal(window.cavalryIcons.create('unknown'), null, 'unknown semantic names must fail closed');
});

test('Toast follows the pinned shadcn/Base UI timing while consuming local design tokens', () => {
  const tokens = read('renderer/tokens.css');
  const styles = read('renderer/toast.css');
  const control = read('renderer/toast-control.js');
  const projectLinkControl = read('renderer/project-link-control.js');
  const app = read('renderer/app.js');
  const aboutWindow = read('renderer/about-window.js');

  assert.match(control, /const DEFAULT_TIMEOUT_MS = 5000;/);
  assert.match(control, /const DEFAULT_LIMIT = 3;/);
  assert.match(control, /record\.type === 'loading'/, 'loading Toast must not auto-dismiss');
  assert.match(control, /record\.remaining = Math\.max\(record\.remaining - \(now - record\.startedAt\), 0\)/);
  assert.match(control, /viewport\.addEventListener\('mouseenter',[\s\S]*?pauseTimers\(\)/);
  assert.match(control, /viewport\.addEventListener\('focusin',[\s\S]*?pauseTimers\(\)/);
  assert.match(control, /global\.addEventListener\('blur',[\s\S]*?pauseTimers\(\)/);
  assert.match(control, /event\.key !== 'F6'/);
  assert.match(control, /event\.key === 'Escape'/);
  assert.match(control, /while \(records\.length > limit\)/);

  assert.match(tokens, /--toast-viewport-inset:\s*var\(--space-4\)/, 'Toast keeps the approved 16px source inset');
  assert.match(tokens, /--toast-content-padding:\s*var\(--space-4\)/);
  assert.match(tokens, /--toast-content-gap:\s*var\(--space-3\)/);
  assert.match(tokens, /--toast-copy-gap:\s*var\(--space-1\)/);
  assert.match(tokens, /--duration-toast-transform:\s*500ms/);
  assert.match(tokens, /--duration-toast-content:\s*250ms/);
  assert.match(tokens, /--duration-toast-height:\s*150ms/);
  assert.match(styles, /right:\s*var\(--toast-viewport-inset\);[\s\S]*?bottom:\s*var\(--toast-viewport-inset\)/);
  assert.match(styles, /padding:\s*var\(--toast-content-padding\)/);
  assert.match(styles, /inset:\s*calc\(var\(--toast-close-hit-expansion\) \* -1\)/);
  assert.match(styles, /translateY\(var\(--toast-entry-distance\)\)/);

  assert.match(app, /onError:\s*\(\) => toastControl\.show\(/);
  assert.doesNotMatch(app, /onError:\s*\(\) => setStatus\('aboutOpenFailed'/, 'About failure must not overwrite Activity');
  assert.match(projectLinkControl, /description:\s*text\('openProjectLinkFailed'\)/);
  assert.match(aboutWindow, /global\.createProjectLinkControl\(/);
});

test('renderer retains DOM anchors and uses only local resources', () => {
  const html = read('renderer/index.html');
  const tokens = read('renderer/tokens.css');
  const buttonStyles = read('renderer/button.css');
  const styles = read('renderer/styles.css');
  const supportStyles = read('renderer/support-footer.css');
  const operationStyles = read('renderer/operation-log.css');
  const toastStyles = read('renderer/toast.css');
  const toastControl = read('renderer/toast-control.js');
  const icons = read('renderer/icons.js');
  const operationLog = read('renderer/operation-log.js');
  const supportFooter = read('renderer/support-footer.js');
  const supportFollowHand = read('renderer/support-follow-hand.js');
  const updateProgress = read('renderer/update-progress.js');
  const tooltipControl = read('renderer/tooltip-control.js');
  const thirdPartyNotices = read('renderer/THIRD_PARTY_NOTICES.md');
  const aboutStyles = read('renderer/about.css');
  const windowControlStyles = read('renderer/window-controls.css');
  const app = read('renderer/app.js');
  const profileText = read('renderer/user-profile-text.js');
  const uiText = read('renderer/ui-text.js');
  const languageScope = read('renderer/language-scope.js');
  const versionGuidance = read('renderer/version-guidance.js');
  for (const id of REQUIRED_IDS) assert.match(html, new RegExp(`id="${id}"`), `#${id} missing`);
  const staticButtons = [...html.matchAll(/<button\b[^>]*>/g)].map((match) => match[0]);
  assert.equal(staticButtons.length, 14, 'production shell must keep fourteen static button elements');
  assert.equal(staticButtons.filter((tag) => /class="[^"]*\bui-button\b/.test(tag)).length, 13, 'every static action except the Select Trigger must consume ui-button');
  assert.match(staticButtons.find((tag) => tag.includes('id="languageSelectTrigger"')) || '', /class="select-trigger"/, 'Select Trigger must preserve its independent component state');
  assert.match(toastControl, /closeButton\.className = 'ui-button toast-close'[\s\S]*?setAttribute\('data-variant', 'ghost'\)/, 'runtime Toast close must consume the ghost ui-button variant');
  assert.doesNotMatch(
    html,
    /id="(?:maintenanceHeading|extractButton|restoreEnglishButton)"/,
    'the single-task UI must not retain the old Recovery controls'
  );
  const htmlWithoutSvgNamespace = html.replace(/\s+xmlns="http:\/\/www\.w3\.org\/2000\/svg"/g, '');
  const implementationCss = `${buttonStyles}\n${styles}\n${supportStyles}\n${operationStyles}\n${toastStyles}\n${aboutStyles}\n${windowControlStyles}`.replace(/\/\*[\s\S]*?\*\//g, '');
  const operationWithoutRuntimeState = operationStyles.replace(
    /--operation-(?:scroll-fade-(?:top|bottom)|shimmer-(?:base|highlight))\s*:[^;]+;/g,
    ''
  );
  const tunableImplementationCss = implementationCss
    .replace(/@property\s+--operation-scroll-fade-(?:top|bottom)\s*\{[\s\S]*?\}/g, '')
    .replace(/@keyframes\s+operation-scroll-fade-[^{]+\{[\s\S]*?\n\}/g, '');
  assert.doesNotMatch(htmlWithoutSvgNamespace, /https?:\/\//, 'renderer HTML must not load remote resources');
  assert.doesNotMatch(tokens, /@import|url\(["']?https?:/i, 'tokens must not load remote resources');
  assert.doesNotMatch(buttonStyles, /@import|url\(["']?https?:/i, 'Button styles must not load remote resources');
  assert.doesNotMatch(styles, /@import|url\([\"']?https?:/i, 'styles must not load remote resources');
  assert.doesNotMatch(supportStyles, /@import|url\([\"']?https?:/i, 'support footer styles must not load remote resources');
  assert.doesNotMatch(operationStyles, /@import|url\([\"']?https?:/i, 'operation log styles must not load remote resources');
  assert.doesNotMatch(toastStyles, /@import|url\([\"']?https?:/i, 'Toast styles must not load remote resources');
  assert.doesNotMatch(icons, /@import|url\([\"']?https?:/i, 'icon registry must not load remote resources');
  assert.doesNotMatch(aboutStyles, /@import|url\([\"']?https?:/i, 'about styles must not load remote resources');
  assert.doesNotMatch(windowControlStyles, /@import|url\([\"']?https?:/i, 'window controls must not load remote resources');
  assert.match(html, /<footer id="supportFooter" class="support-footer">[\s\S]*?id="supportFooterMessage"[\s\S]*?id="supportFooterLinks"[\s\S]*?id="supportGithubLink"[\s\S]*?id="supportTwitterLink"[\s\S]*?id="supportXiaohongshuLink"[\s\S]*?<\/footer>/);
  assert.match(styles, /grid-template-rows:\s*var\(--titlebar-height\) minmax\(0, 1fr\) var\(--support-footer-height\)/, 'footer occupies a separate shell track below existing content');
  assert.doesNotMatch(supportStyles, /border-top:/, 'footer shares the content gap without a divider');
  assert.match(tokens, /--support-footer-height:\s*calc\(/, 'footer derives its height from actual shared geometry');
  assert.match(tokens, /--support-link-hit-size:\s*var\(--space-8\)/);
  assert.match(tokens, /--support-link-icon-size:\s*var\(--space-4\)/);
  assert.match(supportStyles, /\.support-footer-message\s*\{[^}]*font-size:\s*var\(--type-compact\)[^}]*font-weight:\s*var\(--weight-medium\)[^}]*line-height:\s*var\(--line-height-compact\)[^}]*white-space:\s*nowrap/);
  assert.doesNotMatch(supportStyles, /text-overflow|overflow:\s*hidden/, 'support copy must remain visible at the 360px inner width');
  assert.match(supportStyles, /\.support-footer-link-xiaohongshu:hover\s*\{\s*color:\s*var\(--brand-xiaohongshu\)/);
  assert.doesNotMatch(supportStyles, /\.support-footer-link-xiaohongshu\s*\{[^}]*color:\s*var\(--brand-xiaohongshu\)/, 'footer Xiaohongshu stays neutral before hover');
  assert.match(uiText, /supportFooterMessage: '关注我们'/);
  assert.match(buttonStyles, /\.ui-button\s*\{[\s\S]*?display:\s*inline-flex;[\s\S]*?align-items:\s*center;[\s\S]*?justify-content:\s*center;[\s\S]*?appearance:\s*none;[\s\S]*?background:\s*transparent;[\s\S]*?white-space:\s*nowrap;[\s\S]*?user-select:\s*none;[\s\S]*?cursor:\s*pointer/);
  assert.match(buttonStyles, /\.ui-button:disabled\s*\{[\s\S]*?pointer-events:\s*none;[\s\S]*?opacity:\s*var\(--opacity-control-disabled\)/);
  assert.match(buttonStyles, /\.ui-button > svg\s*\{[\s\S]*?flex:\s*0 0 auto;[\s\S]*?pointer-events:\s*none/);
  assert.match(thirdPartyNotices, /## shadcn\/ui[\s\S]*Licensed under the MIT License/);
  assert.match(thirdPartyNotices, /## Phosphor Icons[\s\S]*Licensed under the MIT License/);
  assert.match(thirdPartyNotices, /simple-icons\/simple-icons\/blob\/4d29a35c954699b389a834aacc97dd6e7e74143c\/icons\/github\.svg[\s\S]*CC0 1\.0/);
  assert.match(
    html,
    /<link rel="stylesheet" href="\.\/tokens\.css" \/>\s*<link rel="stylesheet" href="\.\/button\.css" \/>\s*<link rel="stylesheet" href="\.\/styles\.css" \/>\s*<link rel="stylesheet" href="\.\/support-footer\.css" \/>\s*<link rel="stylesheet" href="\.\/operation-log\.css" \/>\s*<link rel="stylesheet" href="\.\/toast\.css" \/>\s*<link rel="stylesheet" href="\.\/about\.css" \/>\s*<link rel="stylesheet" href="\.\/window-controls\.css" \/>/,
    'semantic tokens must load before shared and platform visual implementations'
  );
  assert.match(
    html,
    /<script src="\.\/tauri-bridge\.js"><\/script>\s*<script src="\.\/user-profile-text\.js"><\/script>\s*<script src="\.\/ui-text\.js"><\/script>\s*<script src="\.\/language-scope\.js"><\/script>\s*<script src="\.\/version-guidance\.js"><\/script>\s*<script src="\.\/icons\.js"><\/script>\s*<script src="\.\/select-control\.js"><\/script>\s*<script src="\.\/tooltip-control\.js"><\/script>\s*<script src="\.\/path-display\.js"><\/script>\s*<script src="\.\/operation-log\.js"><\/script>\s*<script src="\.\/permission-handoff\.js"><\/script>\s*<script src="\.\/update-progress\.js"><\/script>\s*<script src="\.\/toast-control\.js"><\/script>\s*<script src="\.\/project-link-control\.js"><\/script>\s*<script src="\.\/support-follow-hand\.js"><\/script>\s*<script src="\.\/support-footer\.js"><\/script>\s*<script src="\.\/about-control\.js"><\/script>\s*<script src="\.\/window-controls\.js"><\/script>\s*<script src="\.\/app\.js"><\/script>/,
    'renderer scripts must load bridge, copy, policies, components, then app'
  );
  assert.match(profileText, /const NATIVE_USER_PROFILE_TEXT = Object\.freeze\(/);
  assert.match(uiText, /\.\.\.NATIVE_USER_PROFILE_TEXT\.(?:en|'zh-Hans'|'zh-Hant'|ja_JP)/);
  assert.match(icons, /window\.cavalryIcons = Object\.freeze\(\{ create: createIcon \}\)/);
  for (const brand of ['githubLogo', 'xLogo', 'xiaohongshuLogo']) assert.match(icons, new RegExp(`\\b${brand}: \\{`));
  for (const iconName of ['spinner', 'checkCircle', 'warningCircle', 'infoCircle', 'errorCircle', 'verify', 'archive', 'translate', 'restore', 'open', 'download', 'package', 'update', 'back', 'minimizeWindow', 'maximizeWindow', 'restoreWindow', 'close']) {
    assert.match(icons, new RegExp(`\\b${iconName}: \\{`), `${iconName} must stay in the semantic icon registry`);
  }
  assert.doesNotMatch(operationLog, /const ICONS|createElementNS|<path/, 'operation log must consume icon names without owning SVG path data');
  assert.match(supportFooter, /global\.createSupportFooterControl = createSupportFooterControl/);
  assert.match(supportFooter, /openProjectLink\(entry\.target\)/);
  assert.doesNotMatch(supportFooter, /https?:\/\/|openProjectLink\([^)]*url/i, 'footer must dispatch fixed IDs, never a URL');
  assert.match(operationLog, /const createIcon = window\.cavalryIcons\.create;/);
  assert.match(uiText, /const UI_TEXT = \{/);
  assert.doesNotMatch(app, /const UI_TEXT = \{/);
  assert.match(languageScope, /window\.createLanguageScopeController = createLanguageScopeController/);
  assert.doesNotMatch(languageScope, /__TAURI__|\.invoke\(/, 'scope policy must not cross the Tauri bridge boundary');
  assert.match(versionGuidance, /window\.cavalryVersionGuidance = Object\.freeze/);
  assert.doesNotMatch(versionGuidance, /__TAURI__|\.invoke\(/, 'version policy must not cross the Tauri bridge boundary');
  assert.doesNotMatch(`${tokens}\n${styles}`, /@font-face|Geist|assets\/fonts/, 'renderer must use the platform font stack');
  assert.match(tokens, /--font-sans:\s*-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif/);
  assert.match(tokens, /--font-mono:\s*ui-monospace, "SFMono-Regular", "Cascadia Mono", Consolas, monospace/);
  assert.doesNotMatch(styles, /--[a-z0-9-]+\s*:/i, 'shared implementation must consume tokens instead of defining private constants');
  assert.doesNotMatch(buttonStyles, /--[a-z0-9-]+\s*:/i, 'Button implementation must consume tokens instead of defining private constants');
  assert.doesNotMatch(operationWithoutRuntimeState, /--[a-z0-9-]+\s*:/i, 'operation implementation may own runtime CSS state, but no private design constants');
  assert.doesNotMatch(toastStyles, /--[a-z0-9-]+\s*:/i, 'Toast implementation must consume tokens instead of defining private constants');
  assert.doesNotMatch(aboutStyles, /--[a-z0-9-]+\s*:/i, 'about implementation must consume tokens instead of defining private constants');
  assert.doesNotMatch(supportStyles, /--[a-z0-9-]+\s*:/i, 'support footer must consume tokens instead of defining private constants');
  assert.doesNotMatch(windowControlStyles, /--[a-z0-9-]+\s*:/i, 'platform implementation must consume tokens instead of defining private constants');
  assert.doesNotMatch(tunableImplementationCss, /#[0-9a-f]{3,8}|rgba?\(|[+-]?(?:\d+\.?\d*|\.\d+)(?:px|ms|em|deg)|:\s*(?:black|white)(?:\s|;|,)/i, 'implementation CSS must not own tunable design literals');
  const tokenDefinitions = [...tokens.matchAll(/(--[a-z0-9-]+)\s*:/gi)].map((match) => match[1]);
  const tokenReferences = `${tokens}\n${buttonStyles}\n${styles}\n${supportStyles}\n${operationStyles}\n${toastStyles}\n${aboutStyles}\n${windowControlStyles}\n${tooltipControl}\n${operationLog}\n${toastControl}\n${supportFooter}\n${supportFollowHand}`;
  assert.deepEqual(
    tokenDefinitions.filter(
      (name) => !tokenReferences.includes(`var(${name})`) && !tokenReferences.includes(`'${name}'`)
    ),
    [],
    'semantic tokens must have a real consumer'
  );
  assert.equal(fs.existsSync(path.join(repoRoot, 'renderer/assets')), false, 'unused bundled font assets must stay removed');
  assert.ok(app.trimEnd().split(/\r?\n/).length <= 800, 'renderer/app.js must stay within the 800-line contract');
  assert.ok(uiText.trimEnd().split(/\r?\n/).length <= 800, 'renderer/ui-text.js must stay within the 800-line contract');
  assert.ok(languageScope.trimEnd().split(/\r?\n/).length <= 800, 'renderer/language-scope.js must stay within the 800-line contract');
  assert.ok(versionGuidance.trimEnd().split(/\r?\n/).length <= 800, 'renderer/version-guidance.js must stay within the 800-line contract');
  assert.ok(updateProgress.split(/\r?\n/).length <= 800, 'renderer/update-progress.js must stay within the 800-line contract');
  assert.ok(tooltipControl.split(/\r?\n/).length <= 800, 'renderer/tooltip-control.js must stay within the 800-line contract');
  assert.ok(toastControl.split(/\r?\n/).length <= 800, 'renderer/toast-control.js must stay within the 800-line contract');
  assert.match(cssRule(styles, 'html,\nbody'), /overflow:\s*hidden;/, 'the window must not scroll as a whole');
  assert.match(cssRule(styles, '.content'), /overflow:\s*hidden;/, 'the main content must not scroll');
  const selectListRule = cssRule(styles, '.select-list');
  assert.match(selectListRule, /max-height:\s*var\(--select-popup-max-height\);/);
  assert.match(selectListRule, /overflow-y:\s*auto;/, 'the Select list must own its bounded scroll');
  assert.doesNotMatch(selectListRule, /overflow:\s*hidden;/, 'Select list scrolling must not be clipped');
  const statusPanelRule = cssRule(operationStyles, '.status-panel');
  const statusPanelWithPermissionRule = cssRule(
    operationStyles,
    '.status-panel:has(> .status-action-button:not([hidden]))'
  );
  assert.match(statusPanelRule, /grid-template-rows:\s*minmax\(0,\s*1fr\);/);
  assert.match(statusPanelRule, /gap:\s*0;/, 'hidden status actions must not retain a grid gap');
  assert.match(statusPanelWithPermissionRule, /grid-template-rows:\s*minmax\(0,\s*1fr\) auto;/);
  assert.match(statusPanelWithPermissionRule, /gap:\s*var\(--operation-group-gap\);/);
  assert.match(statusPanelRule, /padding:\s*var\(--padding-panel\);/);
  assert.match(statusPanelRule, /border:\s*var\(--stroke-hairline\) solid var\(--border\);/);
  assert.match(statusPanelRule, /border-radius:\s*var\(--radius-lg\);/);
  assert.match(cssRule(operationStyles, '.status-viewport'), /overflow-y:\s*auto;/, 'the task event viewport must own its bounded scroll');
});

test('update control preserves the supplied small icon and accessible tooltip contract', () => {
  const html = read('renderer/index.html');
  const tokens = read('renderer/tokens.css');
  const buttonStyles = read('renderer/button.css');
  const styles = read('renderer/styles.css');
  const operationStyles = read('renderer/operation-log.css');
  const icons = read('renderer/icons.js');
  const operationLog = read('renderer/operation-log.js');
  const aboutStyles = read('renderer/about.css');
  const windowControlStyles = read('renderer/window-controls.css');
  const app = read('renderer/app.js');
  const updateProgress = read('renderer/update-progress.js');
  const bridge = read('renderer/tauri-bridge.js');
  const selectControl = read('renderer/select-control.js');
  const tooltipControl = read('renderer/tooltip-control.js');
  const pathDisplay = read('renderer/path-display.js');
  const windowControls = read('renderer/window-controls.js');
  const aboutControl = read('renderer/about-control.js');
  const aboutPage = read('renderer/about.html');
  const aboutWindow = read('renderer/about-window.js');
  const uiText = read('renderer/ui-text.js');
  const updateButton = html.match(/<button id="updateButton"[\s\S]*?<\/button>/)?.[0];
  assert.ok(updateButton, '#updateButton block missing');
  assert.match(
    updateButton,
    /<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" width="18" height="18" fill="currentColor" viewBox="0 0 256 256" aria-hidden="true" focusable="false">/
  );
  assert.match(updateButton, /id="updateButton"[^>]*aria-label="[^"]+"/);
  assert.doesNotMatch(updateButton, /aria-describedby=/, 'closed Tooltip must not keep a stale accessible description');
  const pathMatch = updateButton.match(/<path d="([^"]+)"><\/path>/);
  assert.ok(pathMatch, 'update icon path missing');
  assert.equal(pathMatch[1], UPDATE_ICON_PATH, 'update icon path must remain exact');
  assert.match(html, /id="updateControl"[^>]*data-tooltip-state="closed"[^>]*hidden/);
  assert.match(html, /id="updateTooltip"[^>]*data-slot="tooltip-content"[^>]*role="tooltip"[^>]*aria-hidden="true"[\s\S]*?<div class="tooltip-arrow" data-slot="tooltip-arrow" aria-hidden="true"><\/div>/);
  assert.match(html, /id="updateAnnouncement"[^>]*role="status"[^>]*aria-live="polite"/);
  assert.match(updateButton, /class="ui-button update-button"[^>]*data-variant="ghost"[^>]*data-size="icon-xs"/);
  assert.match(styles, /\.ui-button\.update-button\s*\{[\s\S]*?color: var\(--tone-update\)/);
  assert.match(tokens, /--titlebar-native-control-size:\s*16px/);
  assert.match(tokens, /--update-icon-visual-size:\s*20px/);
  assert.match(tokens, /--titlebar-action-hit-size:\s*24px/);
  assert.match(html, /class="titlebar-copy"[\s\S]*?id="windowTitle"[\s\S]*?id="updateControl"[\s\S]*?<\/div>/);
  assert.match(buttonStyles, /\.ui-button\[data-size="icon-xs"\]\s*\{[\s\S]*?width: var\(--titlebar-action-hit-size\);[\s\S]*?height: var\(--titlebar-action-hit-size\);[\s\S]*?border-radius: var\(--radius-circle\)/);
  assert.match(styles, /\.update-button svg\s*\{[\s\S]*?width: var\(--update-icon-visual-size\);[\s\S]*?height: var\(--update-icon-visual-size\)/);
  assert.doesNotMatch(styles, /--update-icon-path-scale|\.update-button svg path\s*\{[\s\S]*?transform:/);
  assert.match(styles, /body\[data-platform="windows"\] \.native-controls-space\s*\{[\s\S]*?display:\s*none/);
  const updateHoverBlock = styles.match(/\.ui-button\.update-button:hover:not\(:disabled\)\s*\{([^}]*)\}/)?.[1];
  assert.ok(updateHoverBlock, 'update hover state missing');
  assert.doesNotMatch(updateHoverBlock, /translateY/);
  assert.match(styles, /\.tooltip\[data-state="open"\]/);
  assert.match(styles, /\.tooltip\s*\{[\s\S]*?visibility: hidden/);
  assert.match(styles, /\.tooltip\s*\{[\s\S]*?position:\s*fixed;[\s\S]*?padding:\s*var\(--tooltip-padding-block\) var\(--tooltip-padding-inline\)/);
  const tooltipArrowRule = cssRule(styles, '.tooltip-arrow');
  assert.match(tooltipArrowRule, /left:\s*var\(--tooltip-arrow-inline\)/);
  assert.match(tooltipArrowRule, /top:\s*var\(--tooltip-arrow-bottom-inset\)/);
  assert.match(tooltipArrowRule, /width:\s*var\(--tooltip-arrow-size\)/);
  assert.match(tooltipControl, /document\.body\.append\(popup\)/, 'Tooltip popup must use a body portal');
  assert.match(tooltipControl, /event\.pointerType !== 'touch'/, 'touch must not synthesize a Tooltip');
  assert.match(tooltipControl, /trigger\.setAttribute\('aria-describedby', descriptionId\)/);
  assert.match(tooltipControl, /trigger\.removeAttribute\('aria-describedby'\)/);
  assert.match(tooltipControl, /side === 'bottom'/);
  assert.match(tooltipControl, /Math\.min\([\s\S]*?Math\.max\(idealLeft, collisionPadding\)/, 'Tooltip must shift inside the viewport');
  assert.match(pathDisplay, /Math\.max\(path\.lastIndexOf\('\/'\), path\.lastIndexOf\('\\\\'\)\)/);
  assert.match(pathDisplay, /leaf:\s*path\.slice\(slash\)/, 'path display must preserve the final separator and leaf');
  assert.match(styles, /\.app-path-prefix\s*\{[\s\S]*?text-overflow:\s*ellipsis/);
  assert.match(styles, /\.app-path-leaf\s*\{[\s\S]*?flex:\s*0 0 auto/);
  assert.doesNotMatch(styles, /transition:\s*all/);
  assert.doesNotMatch(styles, /grain|@keyframes\s+fade-up/);
  assert.match(styles, /:where\(button:not\(\.select-trigger\)\):focus-visible\s*\{/);
  const selectFocusBlock = styles.match(/\.select-trigger:focus-visible\s*\{([^}]*)\}/)?.[1];
  assert.ok(selectFocusBlock, 'select focus state missing');
  assert.match(selectFocusBlock, /border-color:[\s\S]*?background:/);
  assert.doesNotMatch(selectFocusBlock, /outline:|box-shadow:/, 'select must not draw a focus ring');
  assert.match(styles, /\.select-popup\s*\{[\s\S]*?top:\s*0;/);
  assert.match(selectControl, /renderState\(\);[\s\S]*?alignPopupItemToTrigger\(selected >= 0 \? list\.children\[activeIndex\] : popupPlaceholder\);[\s\S]*?return;/);
  const selectRenderState = selectControl.match(/function renderState\(\)\s*\{([\s\S]*?)\n\s*\}\n\n\s*function setOpen/)?.[1];
  assert.ok(selectRenderState, 'Select renderState boundary missing');
  assert.doesNotMatch(selectRenderState, /alignPopupItemToTrigger/, 'pointer movement must not reposition the popup through renderState');
  const modalPrimaryFocusBlock = styles.match(/\.modal-actions \.button-primary:focus-visible\s*\{([^}]*)\}/)?.[1];
  assert.ok(modalPrimaryFocusBlock, 'AlertDialog primary focus override missing');
  assert.match(modalPrimaryFocusBlock, /outline:\s*none/);
  assert.match(modalPrimaryFocusBlock, /outline-offset:\s*0/);
  assert.match(styles, /:where\(button:not\(\.select-trigger\)\):focus-visible\s*\{/);
  assert.match(app, /modalBackdrop\.showModal\(\);\s*modalPrimaryButton\.focus\(\)/);
  assert.match(app, /modalBackdrop\.addEventListener\('close', finalizeModalClose\)/);
  assert.match(app, /modalBackdrop\.addEventListener\('cancel', \(event\) => event\.preventDefault\(\)\)/);
  assert.match(app, /const returnFocus = modalReturnFocus;[\s\S]*?returnFocus\.focus\(\)/);
  assert.match(html, /<section class="language-section" aria-labelledby="languageSectionLabel">/);
  assert.match(html, /id="languageSelectTrigger"[^>]*role="combobox"[^>]*aria-haspopup="listbox"[^>]*aria-expanded="false"/);
  assert.match(html, /id="languageSelectValue"[^>]*data-placeholder="true"[^>]*>Choose a language<\/span>/);
  assert.match(html, /id="languageSelectPopupPlaceholder"[^>]*aria-hidden="true"[^>]*hidden>Choose a language<\/div>/);
  assert.match(html, /class="select-chevron"[^>]*>[\s\S]*?<svg[^>]*viewBox="0 0 24 24"[\s\S]*?<path d="m6 9 6 6 6-6"><\/path>/);
  assert.match(html, /id="languageSelectList"[^>]*role="listbox"/);
  assert.match(html, /class="language-control-row"[\s\S]*?id="applyButton"[^>]*>Switch<\/button>[\s\S]*?id="restoreButton"[^>]*>Restore English<\/button>/);
  assert.match(html, /<dialog id="modalBackdrop"[^>]*role="alertdialog"[^>]*aria-modal="true"[^>]*aria-labelledby="modalTitle"[^>]*aria-describedby="modalBody">/);
  assert.match(html, /id="statusPanel"[^>]*aria-labelledby="statusLabel"/);
  assert.match(html, /id="statusLabel"[\s\S]*?id="statusIdle"[\s\S]*?id="statusIntro"[^>]*hidden[\s\S]*?id="statusViewport"[\s\S]*?id="statusText"[^>]*role="log"[^>]*aria-live="polite"[\s\S]*?id="statusOutcome"[^>]*role="status"[^>]*aria-live="polite"[^>]*hidden[\s\S]*?id="permissionButton"[^>]*hidden[\s\S]*?id="legacyReleaseButton"[^>]*hidden[\s\S]*?id="reportIssueButton"[^>]*hidden/, 'idle, fixed intro, bounded live log, fixed outcome, and conditional recovery/report actions must remain in source order');
  assert.match(tokens, /--control-height:\s*36px/);
  assert.match(tokens, /--space-5:\s*20px/);
  assert.match(tokens, /--padding-window:\s*var\(--space-5\)/);
  assert.match(tokens, /--gap-section:\s*var\(--space-4\)/);
  assert.match(tokens, /--line-height-heading:\s*24px/);
  assert.match(tokens, /--line-height-metadata:\s*18px/);
  assert.match(tokens, /--line-height-label:\s*16px/);
  assert.match(tokens, /--gap-meta-stack:\s*var\(--space-1\)/);
  assert.match(tokens, /--badge-height:\s*20px/);
  assert.match(tokens, /--badge-padding-inline:\s*var\(--space-2\)/);
  assert.match(tokens, /--radius-pill:\s*999px/);
  assert.match(tokens, /--radius-select-trigger:\s*8px/);
  assert.match(tokens, /--radius-select-popup:\s*8px/);
  assert.match(tokens, /--radius-select-item:\s*6px/);
  assert.match(tokens, /--select-chevron-size:\s*16px/);
  assert.match(tokens, /--select-item-height:\s*28px/);
  assert.match(tokens, /--select-item-padding-leading:\s*var\(--space-2\)/);
  assert.match(tokens, /--select-item-padding-trailing:\s*var\(--space-8\)/);
  assert.match(tokens, /--select-indicator-size:\s*16px/);
  assert.match(styles, /\.select-popup\s*\{[\s\S]*?border:\s*0;[\s\S]*?border-radius:\s*var\(--radius-select-popup\)[\s\S]*?box-shadow:\s*var\(--shadow-select-popup\)/);
  assert.match(selectControl, /function alignPopupItemToTrigger\(item\)[\s\S]*?getBoundingClientRect\(\)[\s\S]*?alignedTop/);
  assert.match(selectControl, /popupPlaceholder\.hidden = !\(open && !hasSelection\)/);
  assert.match(selectControl, /alignPopupItemToTrigger\(selected >= 0 \? list\.children\[activeIndex\] : popupPlaceholder\)/);
  assert.match(selectControl, /root\.dataset\.placeholder = String\(!hasSelection\)/);
  assert.match(selectControl, /select\.value = options\.some\([\s\S]*?\? previousValue : '';/);
  assert.doesNotMatch(html, /id="about(?:Dialog|Title|Version|CloseButton|TwitterLink|TwitterLabel|XiaohongshuLink|XiaohongshuLabel|RepositoryLink|RepositoryLabel|LicenseLink|LicenseLabel)"/, 'About content must not remain in the main window');
  assert.match(html, /id="aboutControl"[^>]*data-tooltip-state="closed"[^>]*hidden/);
  assert.match(aboutControl, /createAboutControl/);
  assert.match(aboutControl, /button\.append\(icons\.create\('infoCircle'\)\)/);
  assert.match(aboutControl, /api\.showAbout\(\)/);
  assert.match(aboutControl, /control\.hidden = platform !== 'windows'/);
  assert.doesNotMatch(aboutControl, /https?:\/\//, 'About entry must not own an external URL');
  assert.match(aboutPage, /<link rel="stylesheet" href="\.\/toast\.css" \/>/);
  assert.match(
    aboutPage,
    /<link rel="stylesheet" href="\.\/tokens\.css" \/>\s*<link rel="stylesheet" href="\.\/button\.css" \/>\s*<link rel="stylesheet" href="\.\/styles\.css" \/>\s*<link rel="stylesheet" href="\.\/window-controls\.css" \/>\s*<link rel="stylesheet" href="\.\/about\.css" \/>\s*<link rel="stylesheet" href="\.\/toast\.css" \/>/,
    'About must consume the shared titlebar implementation before its page-specific layer',
  );
  assert.match(aboutPage, /class="window-surface about-surface"/);
  assert.match(aboutPage, /class="titlebar about-titlebar" data-tauri-drag-region/);
  assert.match(aboutPage, /class="native-controls-space"[^>]*data-tauri-drag-region/);
  assert.match(aboutPage, /class="window-title"[^>]*data-tauri-drag-region[^>]*aria-hidden="true"><\/span>/);
  assert.match(aboutPage, /id="aboutWindowControls"[^>]*class="windows-window-controls"[^>]*hidden/);
  assert.match(aboutPage, /id="aboutWindowCloseButton"[^>]*class="ui-button window-control-button window-control-close"[^>]*data-size="icon-sm"/);
  assert.match(aboutPage, /<script src="\.\/icons\.js"><\/script>\s*<script src="\.\/toast-control\.js"><\/script>\s*<script src="\.\/project-link-control\.js"><\/script>\s*<script src="\.\/about-window\.js"><\/script>/);
  assert.match(aboutPage, /<script src="\.\/user-profile-text\.js"><\/script>\s*<script src="\.\/ui-text\.js"><\/script>\s*<script src="\.\/icons\.js"><\/script>/);
  assert.match(aboutPage, /<img class="about-app-icon" src="\.\/app-icon\.png" alt="" aria-hidden="true" \/>/);
  const socialRow = aboutPage.match(/<div class="about-social-links">([\s\S]*?)<\/div>/)?.[1] || '';
  const twitterRow = socialRow.match(/<a id="aboutTwitterLink"[\s\S]*?<\/a>/)?.[0] || '';
  const xiaohongshuRow = socialRow.match(/<a id="aboutXiaohongshuLink"[\s\S]*?<\/a>/)?.[0] || '';
  assert.match(aboutPage, /<div class="about-social-links">[\s\S]*?<a id="aboutTwitterLink" class="about-link" href="#twitter"[\s\S]*?<span id="aboutTwitterLabel">Follow<\/span>\s*<span id="aboutTwitterIcon" class="about-link-icon" aria-hidden="true"><\/span>[\s\S]*?<\/a>[\s\S]*?<a id="aboutXiaohongshuLink" class="about-link" href="#xiaohongshu"[\s\S]*?<span id="aboutXiaohongshuLabel">Follow<\/span>\s*<span id="aboutXiaohongshuIcon" class="about-link-icon about-link-icon-xiaohongshu" aria-hidden="true"><\/span>[\s\S]*?<\/a>[\s\S]*?<\/div>\s*<a id="aboutRepositoryLink" class="about-link"[\s\S]*?<a id="aboutLicenseLink" class="about-link"/);
  assert.match(twitterRow, /<span id="aboutTwitterLabel">Follow<\/span>\s*<span id="aboutTwitterIcon" class="about-link-icon" aria-hidden="true"><\/span>/);
  assert.doesNotMatch(aboutPage, /@daftAI|daftai/i, 'About follow buttons must not show an account name');
  assert.match(aboutWindow, /\['#aboutTwitterIcon', 'xLogo'\]/);
  assert.equal(
    icons.match(/xLogo:\s*\{[\s\S]*?paths:\s*\['([^']+)'/)?.[1],
    'M214.75,211.71l-62.6-98.38,61.77-67.95a8,8,0,0,0-11.84-10.76L143.24,99.34,102.75,35.71A8,8,0,0,0,96,32H48a8,8,0,0,0-6.75,12.3l62.6,98.37-61.77,68a8,8,0,1,0,11.84,10.76l58.84-64.72,40.49,63.63A8,8,0,0,0,160,224h48a8,8,0,0,0,6.75-12.29ZM164.39,208,62.57,48h29L193.43,208Z',
    'About must use the upstream Phosphor Regular XLogo path, not a generic close X or the retired Twitter bird'
  );
  assert.doesNotMatch(twitterRow, /M23\.953 4\.57/, 'About must not regress to the Twitter bird');
  assert.match(xiaohongshuRow, /<span id="aboutXiaohongshuIcon" class="about-link-icon about-link-icon-xiaohongshu" aria-hidden="true"><\/span>/);
  assert.match(aboutWindow, /\['#aboutXiaohongshuIcon', 'xiaohongshuLogo'\]/);
  assert.match(aboutStyles, /\.about-link-icon-xiaohongshu\s*\{\s*width:\s*calc\(var\(--about-link-icon-size\) \* 2\)/);
  assert.match(tokens, /--brand-xiaohongshu:\s*#ff2442/);
  assert.match(aboutStyles, /\.about-link-icon-xiaohongshu\s*\{[^}]*color:\s*var\(--brand-xiaohongshu\)/);
  const xiaohongshuPath = icons.match(/xiaohongshuLogo:\s*\{[\s\S]*?viewBox:\s*'0 7\.5 24 9',[\s\S]*?paths:\s*\['([^']+)'/)?.[1] || '';
  assert.equal(
    crypto.createHash('sha256').update(xiaohongshuPath).digest('hex'),
    '1d15f62d2a7d33f664fe682a597ec239803c55dbb100736cc21079088d3701ef',
    'shared About/footer registry must retain the pinned Simple Icons Xiaohongshu glyph path'
  );
  assert.equal((aboutPage.match(/class="about-link"/g) || []).length, 4, 'About keeps two social links and full-width GitHub/license links on one link component');
  assert.match(aboutStyles, /\.about-social-links\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)[\s\S]*?gap:\s*var\(--space-1\)/);
  assert.match(aboutPage, /id="aboutRepositoryLink"[\s\S]*?class="about-link-icon"[\s\S]*?id="aboutRepositoryLabel"/);
  assert.match(aboutWindow, /getSwitcherVersion\(\)/);
  assert.match(aboutWindow, /cavalryIcons\.create\('close'\)/);
  assert.match(aboutWindow, /cavalryI18n\.closeAboutWindow\(\)/);
  assert.match(aboutWindow, /openProjectLink\(link\)/);
  assert.match(aboutWindow, /wireProjectLink\('#aboutXiaohongshuLink', 'xiaohongshu', openProjectLink\)/);
  assert.match(aboutWindow, /aboutXiaohongshuLinkAria/);
  assert.match(aboutWindow, /text\(locale, 'aboutSocialFollow'\)/);
  assert.match(uiText, /aboutSocialFollow: 'Follow'/);
  assert.match(uiText, /aboutSocialFollow: '关注'/);
  assert.match(uiText, /aboutSocialFollow: '關注'/);
  assert.match(uiText, /aboutSocialFollow: 'フォロー'/);
  assert.match(uiText, /aboutTwitterLinkAria: 'Follow on X \(Twitter\)'/);
  assert.match(uiText, /aboutXiaohongshuLinkAria: 'Follow on Xiaohongshu'/);
  assert.match(uiText, /aboutTwitterLinkAria: '在Twitter\/X关注'/);
  assert.match(uiText, /aboutXiaohongshuLinkAria: '在小红书关注'/);
  assert.match(uiText, /aboutTwitterLinkAria: '在Twitter\/X關注'/);
  assert.match(uiText, /aboutXiaohongshuLinkAria: '在小紅書關注'/);
  assert.match(uiText, /aboutTwitterLinkAria: 'X（Twitter）をフォロー'/);
  assert.match(uiText, /aboutXiaohongshuLinkAria: '小紅書をフォロー'/);
  assert.doesNotMatch(uiText, /@daftAI|daftai/i, 'About copy must not expose an account name');
  assert.equal((uiText.match(/aboutXiaohongshuLinkAria:/g) || []).length, 4, 'About social accessible names cover all four locales');
  assert.equal((uiText.match(/aboutSocialFollow:/g) || []).length, 4, 'About visible Follow labels cover all four locales');
  assert.match(aboutWindow, /wireProjectLink\('#aboutRepositoryLink', 'repository', openProjectLink\)/);
  assert.match(aboutWindow, /wireProjectLink\('#aboutTwitterLink', 'twitter', openProjectLink\)/);
  assert.match(aboutWindow, /wireProjectLink\('#aboutLicenseLink', 'license', openProjectLink\)/);
  assert.match(aboutWindow, /createToastControl/);
  assert.match(aboutWindow, /createProjectLinkControl/);
  assert.match(read('renderer/project-link-control.js'), /projectLinkFailedTitle/);
  assert.doesNotMatch(aboutWindow, /showAbout/);
  assert.doesNotMatch(aboutPage, /https?:\/\//, 'About page must use fixed bridge ids, not renderer URLs');
  assert.match(bridge, /PROJECT_LINK_MANIFEST = Object\.freeze\(\['twitter', 'xiaohongshu', 'repository', 'license', 'reportIssue', 'legacyRelease'\]\)/);
  assert.match(read('renderer/THIRD_PARTY_NOTICES.md'), /simple-icons\/simple-icons\/blob\/4d29a35c954699b389a834aacc97dd6e7e74143c\/icons\/xiaohongshu\.svg[\s\S]*?CC0 1\.0/);
  assert.match(bridge, /invoke\('open_project_link', \{ link \}\)/);
  assert.match(bridge, /showAbout:\s*\(\) => invoke\('show_about'\)\.then\(normalizeAction\)/);
  assert.match(bridge, /closeAboutWindow:\s*\(\) => invokeWindow\('close', 'about'\)/);
  assert.match(bridge, /invoke\('plugin:app\|version'\)/);
  assert.doesNotMatch(bridge, /openProjectLink:\s*\(url\)/, 'bridge must expose a fixed link id, never a renderer URL');
  assert.match(tokens, /--about-app-icon-size:\s*calc\(var\(--space-16\) \+ var\(--space-4\)\)/);
  assert.match(tokens, /--about-link-icon-size:\s*16px/);
  assert.doesNotMatch(aboutStyles, /\.about-(?:dialog|close)\b/);
  assert.match(aboutStyles, /\.about-surface\s*\{[\s\S]*?grid-template-rows:\s*minmax\(0, 1fr\)/);
  assert.match(aboutStyles, /html:is\(\[data-platform="macos"\], \[data-platform="windows"\]\) \.about-titlebar\s*\{[\s\S]*?position:\s*absolute;[\s\S]*?inset:\s*0 0 auto;[\s\S]*?display:\s*flex/);
  assert.match(aboutStyles, /\.about-window\s*\{[\s\S]*?align-content:\s*end;[\s\S]*?padding:\s*var\(--padding-window\)[\s\S]*?overflow:\s*hidden/);
  assert.match(aboutStyles, /\.about-links\s*\{[\s\S]*?gap:\s*var\(--gap-page-actions\)/);
  assert.match(aboutStyles, /\.about-app-icon\s*\{[\s\S]*?width:\s*var\(--about-app-icon-size\)[\s\S]*?height:\s*var\(--about-app-icon-size\)/);
  assert.deepEqual(
    fs.readFileSync(path.join(repoRoot, 'renderer/app-icon.png')),
    fs.readFileSync(path.join(repoRoot, 'src-tauri/icons/128x128.png')),
    'About must reuse the packaged application icon projection exactly'
  );
  assert.equal(fs.existsSync(path.join(repoRoot, 'renderer/about-dialog.js')), false, 'the old in-window About controller must stay deleted');
  for (const token of [
    '--type-heading: 16px',
    '--type-compact: 14px',
    '--type-label: 13px',
    '--type-metadata: 13px',
    '--weight-regular: 400',
    '--weight-heading: 450',
    '--weight-medium: 500',
  ]) {
    assert.ok(tokens.includes(token), `missing renderer type role: ${token}`);
  }
  for (const token of [
    '--space-1: 4px',
    '--space-2: 8px',
    '--space-3: 12px',
    '--space-4: 16px',
    '--space-5: 20px',
    '--space-6: 24px',
    '--space-8: 32px',
    '--space-16: 64px',
  ]) {
    assert.ok(tokens.includes(token), `missing renderer spacing role: ${token}`);
  }
  assert.match(tokens, /--titlebar-native-gap:\s*var\(--space-2\)/);
  assert.match(tokens, /--titlebar-native-control-size:\s*16px/);
  assert.match(tokens, /--titlebar-text-optical-offset:\s*-1px/);
  assert.match(tokens, /--titlebar-native-controls-width:\s*var\(--space-16\)/);
  assert.match(tokens, /--titlebar-block-padding:\s*var\(--space-3\)/);
  assert.match(tokens, /--titlebar-height:\s*calc\(var\(--titlebar-native-control-size\) \+ var\(--titlebar-block-padding\) \+ var\(--titlebar-block-padding\)\)/);
  assert.match(tokens, /--padding-panel:\s*var\(--space-3\)/);
  assert.match(tokens, /--radius-lg:\s*10px/);
  assert.match(tokens, /--padding-control-inline:\s*var\(--space-3\)/);
  assert.match(styles, /\.titlebar\s*\{[\s\S]*?padding:\s*0 var\(--padding-panel\)/);
  assert.match(tokens, /--windows-caption-edge-padding:\s*var\(--space-1\)/);
  assert.match(tokens, /--windows-title-optical-padding:\s*15px/);
  assert.match(styles, /html\[data-platform="windows"\] \.titlebar\s*\{[\s\S]*?padding-inline-start:\s*var\(--windows-title-optical-padding\);[\s\S]*?padding-inline-end:\s*var\(--windows-caption-edge-padding\)/);
  assert.match(styles, /\.window-title\s*\{[\s\S]*?font-size:\s*var\(--type-heading\)[\s\S]*?font-weight:\s*var\(--weight-heading\)[\s\S]*?line-height:\s*var\(--line-height-heading\)/);
  assert.match(styles, /\.content\s*\{[\s\S]*?padding:\s*var\(--padding-window\)/);
  assert.match(styles, /\.content\s*\{[\s\S]*?display:\s*grid;[\s\S]*?grid-template-rows:\s*auto auto minmax\(0,\s*1fr\);[\s\S]*?align-content:\s*start/);
  assert.match(styles, /\.content\s*>\s*section:first-child\s*\{[\s\S]*?margin-bottom:\s*var\(--gap-flow\)/);
  assert.match(styles, /\.language-section\s*\{[\s\S]*?display:\s*grid;[\s\S]*?gap:\s*var\(--section-heading-control-gap\)/);
  assert.match(tokens, /--section-heading-control-gap:\s*var\(--space-2\)/);
  assert.match(tokens, /--dialog-width:\s*320px/);
  assert.match(tokens, /--dialog-header-gap:\s*var\(--space-2\)/);
  assert.match(tokens, /--dialog-content-gap:\s*var\(--space-4\)/);
  assert.match(cssRule(styles, '.modal-backdrop'), /position:\s*fixed;[\s\S]*?inset:\s*var\(--titlebar-height\) 0 0;[\s\S]*?height:\s*auto;/);
  assert.doesNotMatch(cssRule(styles, '.modal-backdrop'), /height:\s*100%/, 'AlertDialog must preserve the desktop titlebar identity layer');
  assert.match(styles, /\.modal-title\s*\{[\s\S]*?font-size:\s*var\(--type-heading\)[\s\S]*?font-weight:\s*var\(--weight-medium\)[\s\S]*?line-height:\s*var\(--line-height-heading\)/);
  assert.match(styles, /\.modal-body\s*\{[\s\S]*?font-size:\s*var\(--type-compact\)[\s\S]*?font-weight:\s*var\(--weight-regular\)[\s\S]*?line-height:\s*var\(--line-height-compact\)[\s\S]*?text-wrap:\s*wrap;[\s\S]*?white-space:\s*pre-line/);
  assert.doesNotMatch(styles, /\.modal-body\s*\{[\s\S]*?text-wrap:\s*balance/, 'AlertDialog prose must preserve natural wrapping');
  assert.match(tokens, /--gap-page-actions:\s*10px/);
  assert.match(styles, /\.language-control-row\s*\{[\s\S]*?row-gap:\s*var\(--gap-flow\);[\s\S]*?column-gap:\s*var\(--gap-page-actions\)/);
  assert.match(operationStyles, /\.status-panel\s*\{[\s\S]*?min-height:\s*var\(--operation-panel-min-height\);[\s\S]*?margin-top:\s*var\(--gap-flow\)/);
  assert.doesNotMatch(operationStyles, /\.status-label\s*\{/, 'the generic task heading must not be visible');
  assert.match(operationStyles, /\.operation-event-title\s*\{[\s\S]*?font-size:\s*var\(--type-compact\)[\s\S]*?line-height:\s*var\(--line-height-compact\)/);
  assert.doesNotMatch(tokens, /--alert-(?:height|icon|padding|column|copy)/);
  assert.match(tokens, /--operation-marker-size:\s*var\(--space-4\)/);
  assert.match(tokens, /--operation-panel-min-height:\s*176px/);
  assert.match(tokens, /--operation-marker-gap:\s*var\(--space-2\)/);
  assert.match(tokens, /--operation-scrollbar-size:\s*10px/);
  assert.match(tokens, /--operation-marker-description-offset:\s*2px/);
  assert.match(tokens, /--operation-scroll-fade-none:\s*0px/);
  assert.match(tokens, /--operation-scroll-fade-size:\s*var\(--space-2\)/);
  assert.match(tokens, /--duration-message-delta:\s*40ms/);
  assert.match(tokens, /--operation-live-edge-tolerance:\s*var\(--space-1\)/);
  assert.match(tokens, /--operation-scroll-edge-tolerance:\s*var\(--stroke-hairline\)/);
  assert.doesNotMatch(tokens, /--operation-scroll-fade-reveal:/);
  assert.match(tokens, /--operation-shimmer-angle:\s*20deg/);
  assert.match(tokens, /--operation-shimmer-spread:\s*calc\(3ch \+ var\(--space-1\) \* 10\)/);
  assert.match(tokens, /--operation-shimmer-highlight-alpha:\s*0\.2/);
  assert.doesNotMatch(styles, /\.separator\s*\{/);
  assert.doesNotMatch(html, /class="separator"/, 'business sections must use spacing rather than decorative dividers');
  assert.doesNotMatch(styles, /text-box-trim/, 'cross-platform layout must not depend on experimental glyph-box trimming');
  assert.doesNotMatch(styles, /\.installation-heading\s*\{[^}]*min-height:/, 'installation typography must size its parent without a duplicate height constraint');
  assert.match(styles, /\.installation-name\s*\{[\s\S]*?line-height:\s*var\(--line-height-compact\)/);
  assert.match(styles, /\.skip-link,\s*\.tooltip,\s*\.app-path\s*\{[\s\S]*?font-size:\s*var\(--type-metadata\)[\s\S]*?font-weight:\s*var\(--weight-regular\)[\s\S]*?line-height:\s*var\(--line-height-metadata\)[\s\S]*?font-synthesis:\s*none/);
  assert.match(styles, /\.badge\s*\{[\s\S]*?font-size:\s*var\(--type-label\)[\s\S]*?font-weight:\s*var\(--weight-heading\)[\s\S]*?line-height:\s*var\(--line-height-label\)/);
  assert.match(styles, /\.app-path\s*\{[\s\S]*?margin:\s*var\(--gap-meta-stack\)\s+0\s+0/);
  assert.match(styles, /\.badge\s*\{[\s\S]*?min-height:\s*var\(--badge-height\)[\s\S]*?padding:\s*0 var\(--badge-padding-inline\)[\s\S]*?border-radius:\s*var\(--radius-pill\)/);
  assert.match(tokens, /--badge-language-bg:\s*#edf6ff/);
  assert.match(tokens, /--tone-info:\s*oklch\(57\.61% 0\.2508 258\.23\)/);
  assert.match(tokens, /--badge-language-text:\s*var\(--tone-info\)/);
  assert.match(tokens, /--badge-green-bg:\s*#edf9f0/);
  assert.doesNotMatch(tokens, /--badge-(?:language|green)-border:/, 'filled semantic badges must not own a visible outline token');
  assert.match(styles, /\.badge\[data-kind="language"\]\s*\{[\s\S]*?border-color:\s*transparent;[\s\S]*?background:\s*var\(--badge-language-bg\)[\s\S]*?color:\s*var\(--badge-language-text\)/);
  assert.match(styles, /\.badge\[data-state="official"\]\s*,\s*\.badge\[data-kind="green-subtle"\]\s*\{[\s\S]*?border-color:\s*transparent;[\s\S]*?background:\s*var\(--badge-green-bg\)[\s\S]*?color:\s*var\(--badge-green-text\)/);
  assert.doesNotMatch(styles, /\.badge\[data-state="(?:translated|modified)"\]/);
  assert.match(cssRule(styles, '.installation-item'), /display:\s*flex;[\s\S]*?padding:\s*var\(--padding-panel\)/);
  assert.doesNotMatch(cssRule(styles, '.installation-item'), /grid-template-columns:/, 'an optional folder action must not leave an empty grid track');
  assert.match(html, /id="browseButton"[^>]*disabled hidden/);
  assert.match(app, /function installationSelectionIsRequired\(\)\s*\{\s*return !state\.appPath;\s*\}/);
  assert.match(app, /function syncInstallationSelection\(\)\s*\{[\s\S]*?browseButton\.hidden = !installationSelectionIsRequired\(\)/);
  assert.match(app, /syncInstallationBadges\(\);\s*syncInstallationSelection\(\);\s*state\.ready = true/);
  assert.match(operationStyles, /\.status-task-shell\s*\{[\s\S]*?grid-template-rows:\s*minmax\(0, 1fr\)/);
  assert.match(operationStyles, /\.status-panel\[data-mode="running"\] \.status-task-shell\s*\{[\s\S]*?grid-template-rows:\s*auto minmax\(0, 1fr\)/);
  assert.match(operationStyles, /\.status-panel\[data-mode="running"\]\[data-has-outcome="true"\] \.status-task-shell\s*\{[\s\S]*?grid-template-rows:\s*auto minmax\(0, 1fr\) auto/);
  assert.match(operationStyles, /\.status-idle-message\s*\{[\s\S]*?place-items:\s*center/);
  assert.match(operationStyles, /\.status-message\s*\{[\s\S]*?color:\s*var\(--text\)[\s\S]*?font-size:\s*var\(--type-compact\)/);
  assert.doesNotMatch(operationStyles, /var\(--text-primary\)/, 'Activity must consume the canonical text token rather than a missing alias');
  assert.match(operationStyles, /\.status-viewport\s*\{[\s\S]*?overflow-y:\s*auto/);
  assert.match(operationStyles, /\.status-viewport\[data-overflowing="true"\][\s\S]*?mask-image:\s*linear-gradient/);
  assert.match(operationStyles, /\.status-viewport\[data-overflowing="true"\]\[data-at-start="true"\]\s*\{[\s\S]*?--operation-scroll-fade-top:\s*var\(--operation-scroll-fade-none\)/);
  assert.match(operationStyles, /\.status-viewport\[data-overflowing="true"\]\[data-at-end="true"\]\s*\{[\s\S]*?--operation-scroll-fade-bottom:\s*var\(--operation-scroll-fade-none\)/);
  assert.doesNotMatch(operationStyles, /animation-timeline:\s*scroll\(self y\)/);
  assert.match(operationStyles, /\.status-text\s*\{[\s\S]*?display:\s*flex;[\s\S]*?flex-direction:\s*column/);
  assert.doesNotMatch(operationStyles, /\.operation-event:first-child\s*\{[\s\S]*?margin-top:\s*auto/, 'short event streams must begin at the padded top edge');
  assert.doesNotMatch(operationStyles, /data-variant="separator"/, 'the approved idle and task intro replace decorative separators');
  assert.match(operationStyles, /\.operation-event\s*\{[\s\S]*?display:\s*flex;[\s\S]*?align-items:\s*center;[\s\S]*?gap:\s*var\(--operation-marker-gap\)[\s\S]*?color:\s*var\(--text-secondary\)/);
  assert.match(operationStyles, /\.operation-event-marker\s*\{[\s\S]*?width:\s*var\(--operation-marker-size\);[\s\S]*?height:\s*var\(--operation-marker-size\)/);
  assert.match(tokens, /--warning:\s*oklch\(52\.79% 0\.1496 54\.65\)/);
  assert.match(operationStyles, /\.operation-event\[data-state="warning"\] \.operation-event-marker\s*\{[\s\S]*?color:\s*var\(--warning\)/);
  assert.match(operationStyles, /\.operation-event\[data-state="error"\] \.operation-event-marker\s*\{[\s\S]*?color:\s*var\(--danger\)/);
  assert.match(operationStyles, /\.operation-event:is\(\[data-state="warning"\], \[data-state="error"\]\) \.operation-event-title\s*\{[\s\S]*?color:\s*var\(--text\)/);
  assert.doesNotMatch(operationStyles, /\.operation-event\[data-state="(?:warning|error)"\]\s*\{[\s\S]*?(?:background|border|color):/, 'severity belongs to the marker, not an Alert-like event row');
  assert.doesNotMatch(operationStyles, /\.operation-event(?::is\([^}]+\)|\[data-state="(?:warning|error)"\]) \.operation-event-(?:title|description)\s*\{[\s\S]*?color:\s*var\(--(?:warning|danger)\)/, 'severity hue must not overwhelm readable event copy');
  assert.match(operationStyles, /\.operation-event-title\s*\{[\s\S]*?color:\s*inherit;[\s\S]*?font-weight:\s*var\(--weight-regular\)/);
  assert.match(operationStyles, /\.operation-event\[data-state="running"\] \.operation-event-marker\[data-icon="spinner"\] svg\s*\{[\s\S]*?animation:\s*operation-spin/);
  assert.match(operationStyles, /\.operation-event\[data-state="running"\] \.operation-event-title\s*\{[\s\S]*?oklch\([\s\S]*?from currentColor l c h \/ calc\(alpha \* var\(--operation-shimmer-highlight-alpha\)\)[\s\S]*?background-image:\s*linear-gradient[\s\S]*?background-position:\s*0 0[\s\S]*?animation:\s*operation-shimmer/);
  assert.match(operationStyles, /@keyframes operation-shimmer\s*\{[\s\S]*?from\s*\{\s*background-position:\s*100% 0;\s*\}[\s\S]*?to\s*\{\s*background-position:\s*0 0;\s*\}/);
  assert.match(operationLog, /DEFAULT_ICON_BY_STATE[\s\S]*?running:\s*'spinner'/);
  assert.match(icons, /const ICONS = Object\.freeze\(\{/);
  assert.match(operationLog, /const remaining = viewport\.scrollHeight - viewport\.clientHeight - viewport\.scrollTop;[\s\S]*?followLiveEdge = remaining <= cssNumber\('--operation-live-edge-tolerance'\)/);
  assert.match(operationLog, /function syncScrollFade\(\)[\s\S]*?viewport\.dataset\.atStart[\s\S]*?viewport\.dataset\.atEnd/);
  assert.match(operationLog, /String\(text \|\| ''\)\.match\(\/\\S\+\\s\*\/g\)/);
  assert.match(operationLog, /motionDuration\('--duration-message-delta'\)/);
  assert.match(operationLog, /motionDuration\('--duration-operation-running-min'\)/);
  assert.match(operationLog, /motionDuration\('--duration-operation-step-gap'\)/);
  assert.match(operationLog, /cancelVisualQueue\(\{ flushEvents: true \}\);[\s\S]*?renderEvent\(event\)/);
  assert.match(operationStyles, /\.operation-event\s*\{[\s\S]*?animation:\s*operation-marker-enter var\(--duration-feedback\) ease-out both/);
  assert.match(tokens, /--duration-operation-running-min:\s*360ms/);
  assert.match(tokens, /--duration-operation-step-gap:\s*var\(--duration-feedback\)/);
  assert.match(tokens, /--duration-operation-blocking-dwell:\s*1200ms/);
  assert.match(operationLog, /async function presentBlocking\(event\)[\s\S]*?urgent: true[\s\S]*?--duration-operation-blocking-dwell/);
  assert.match(operationLog, /remeasure: syncAfterLayout/);
  assert.match(app, /permissionButton\.hidden =[\s\S]*?operationLog\.remeasure\(\)/);
  assert.match(operationLog, /cssNumber\('--operation-live-edge-tolerance'\)/);
  assert.match(app, /verifyInstallation:\s*'verify'[\s\S]*?ensureBaseline:\s*'archive'[\s\S]*?applyTransaction:\s*'translate'[\s\S]*?restartCavalry:\s*'open'/);
  assert.match(app, /restoring && phase === 'applyTransaction' \? 'restore' : PHASE_ICONS\[phase\]/);
  assert.match(updateProgress, /updateDownloadCompletedTitle[\s\S]*?icon:\s*'download'/);
  assert.match(updateProgress, /updateInstallCompletedTitle[\s\S]*?icon:\s*'package'/);
  assert.match(app, /key === 'updatePreviewAvailable'/);
  assert.match(html, /class="titlebar" data-tauri-drag-region/);
  assert.doesNotMatch(html, /traffic-light/, 'macOS traffic lights must remain native');
  assert.match(html, /id="windowsWindowControls"[^>]*data-maximized="false"[^>]*hidden/);
  assert.match(html, /id="windowsWindowControls"[\s\S]*?id="aboutButton"[\s\S]*?id="windowMinimizeButton"/, 'About must be immediately before minimize in the Windows caption group');
  assert.match(html, /id="aboutButton"[^>]*class="ui-button window-control-button"[^>]*data-variant="ghost"[^>]*data-size="icon-sm"/);
  assert.match(html, /id="windowMinimizeButton"[^>]*class="ui-button window-control-button"[^>]*data-variant="ghost"[^>]*data-size="icon-sm"/);
  assert.match(html, /id="windowMaximizeButton"[^>]*class="ui-button window-control-button"[^>]*data-variant="ghost"[^>]*data-size="icon-sm"/);
  assert.match(html, /id="windowCloseButton"[^>]*class="ui-button window-control-button window-control-close"[^>]*data-variant="ghost"[^>]*data-size="icon-sm"/);
  const windowControlsMarkup = html.match(/<div id="windowsWindowControls"[\s\S]*?<\/div>\s*<\/header>/)?.[0];
  assert.ok(windowControlsMarkup, 'Windows caption markup missing');
  assert.doesNotMatch(windowControlsMarkup, /<svg/, 'Windows caption glyphs must come from the shared icon registry');
  assert.match(windowControls, /platform === 'windows'/);
  assert.match(windowControls, /api\.isWindowMaximized\(\)/);
  assert.match(windowControls, /appendIcon\(minimizeButton, 'minimizeWindow'\)/);
  assert.match(windowControls, /appendIcon\(maximizeButton, 'maximizeWindow', 'window-icon-maximize'\)/);
  assert.match(windowControls, /appendIcon\(maximizeButton, 'restoreWindow', 'window-icon-restore'\)/);
  assert.match(windowControls, /appendIcon\(closeButton, 'close'\)/);
  assert.match(app, /createWindowControls\(\{ api, text: t, icons: window\.cavalryIcons \}\)/);
  assert.match(windowControlStyles, /height:\s*var\(--titlebar-height\)/);
  assert.match(windowControlStyles, /gap:\s*var\(--windows-caption-button-gap\)/);
  assert.match(windowControlStyles, /\.window-control-button\s*\{[\s\S]*?cursor:\s*default/);
  assert.match(windowControlStyles, /background:\s*var\(--surface-hover\)/);
  assert.match(windowControlStyles, /background:\s*var\(--danger\)/);
  assert.doesNotMatch(windowControlStyles, /--windows-caption-(?:hover|active|close)/);
  assert.equal((html.match(/class="ui-button window-control-button(?: window-control-close)?"/g) || []).length, 4, 'Windows main caption must have About plus three system Button consumers');
  assert.match(tokens, /--windows-caption-button-size:\s*var\(--space-8\)/);
  assert.match(tokens, /--windows-caption-button-gap:\s*var\(--space-1\)/);
  assert.match(tokens, /--windows-caption-icon-size:\s*var\(--space-4\)/);
  assert.match(buttonStyles, /\.ui-button\[data-size="icon-sm"\]\s*\{[\s\S]*?width:\s*var\(--windows-caption-button-size\);[\s\S]*?height:\s*var\(--windows-caption-button-size\);[\s\S]*?border-radius:\s*var\(--radius-md\)/);
  assert.match(windowControlStyles, /\.window-control-button svg\s*\{[\s\S]*?fill:\s*currentColor/);
  assert.match(styles, /\.titlebar\s*\{[\s\S]*?display:\s*flex/);
  assert.match(styles, /\.titlebar\s*\{[\s\S]*?align-items:\s*center/);
  assert.match(styles, /\.titlebar\s*\{[\s\S]*?border-bottom:\s*0;[\s\S]*?box-shadow:\s*var\(--shadow-titlebar-divider\)/);
  assert.match(styles, /\.titlebar-copy\s*\{[\s\S]*?align-items:\s*center/);
  assert.match(styles, /\.titlebar-copy\s*\{[\s\S]*?gap:\s*var\(--gap-inline\)/);
  assert.match(styles, /\.window-title\s*\{[\s\S]*?transform:\s*translateY\(var\(--titlebar-text-optical-offset\)\)/);
  assert.match(styles, /\.content\s*\{[\s\S]*?display:\s*grid;[\s\S]*?grid-template-rows:\s*auto auto minmax\(0,\s*1fr\)/);
  assert.match(styles, /\.tooltip-anchor\s*\{[\s\S]*?display:\s*inline-flex;[\s\S]*?align-items:\s*center/);
  assert.match(styles, /\.tooltip-anchor\s*\{[\s\S]*?pointer-events:\s*auto/, 'update control must remain interactive inside non-interactive title copy');
  assert.match(styles, /\.installation-item\s*\{[\s\S]*?display:\s*flex/);
  assert.match(styles, /\.language-control-row\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2/);
  assert.match(styles, /\.select-root\s*\{[\s\S]*?grid-column:\s*1\s*\/\s*-1/);
  assert.match(cssRule(styles, '.content'), /overflow:\s*hidden/);
  assert.match(cssRule(styles, '.select-list'), /overflow-y:\s*auto/);
  assert.match(operationStyles, /\.status-panel\[data-mode="running"\] \.status-task-shell/);
  assert.match(app, /applyShellPlatform\(state\.platform\)/);
  assert.match(app, /window\.createTooltipControl/);
  assert.doesNotMatch(app, /updateControl\.addEventListener\('(?:mouseenter|focusin)'/);
  assert.match(app, /state\.ready = false;[\s\S]*?setBusy\(state\.busy\);[\s\S]*?await api\.getStatus\(\)/);
});

test('renderer builds language options safely and bridge API is frozen/minimal', () => {
  const html = read('renderer/index.html');
  const app = read('renderer/app.js');
  const uiText = read('renderer/ui-text.js');
  const selectControl = read('renderer/select-control.js');
  const languageScope = read('renderer/language-scope.js');
  const versionGuidance = read('renderer/version-guidance.js');
  const bridge = read('renderer/tauri-bridge.js');
  assert.doesNotMatch(app, /\.innerHTML\s*=/, 'renderer must not interpolate backend data as HTML');
  assert.match(selectControl, /document\.createElement\('option'\)/);
  assert.match(selectControl, /nativeOption\.textContent\s*=/);
  assert.match(selectControl, /option\.badge/);
  assert.match(selectControl, /className = 'badge select-item-badge'/);
  assert.match(selectControl, /createElementNS\('http:\/\/www\.w3\.org\/2000\/svg', 'svg'\)/);
  assert.match(selectControl, /path\.setAttribute\('d', 'm20 6-11 11-5-5'\)/);
  assert.match(languageScope, /languages\.filter\(\(language\) => language\.value !== 'en'\)/);
  assert.match(languageScope, /disabled:\s*!canSwitch\(\) \|\| \(isCurrentLanguage && patchStatus === 'current'\)/);
  assert.match(languageScope, /patchStatus === 'updateAvailable' \|\| patchStatus === 'unknown'/);
  assert.match(languageScope, /'updateLanguagePatch' : 'apply'/);
  assert.match(read('renderer/styles.css'), /\.badge\[data-kind="green-subtle"\]/);
  assert.match(read('renderer/styles.css'), /\.select-item-badge[\s\S]*?pointer-events:\s*none/);
  assert.match(selectControl, /nativeOption\.disabled = option\.disabled/);
  assert.match(selectControl, /aria-disabled/);
  const restoreConfirmationFunction = sourceFunction(
    app,
    'function showRestoreConfirmation() {',
    'async function showPermissionWait'
  );
  assert.match(
    restoreConfirmationFunction,
    /const restoreAction = state\.platform === 'macos' \? 'restore-official' : 'en';/
  );
  assert.match(app, /restoreButton\.addEventListener\('click', requestRestore\)/);
  const requestApplyFunction = sourceFunction(app, 'function requestApply() {', 'function requestRestore');
  assert.match(requestApplyFunction, /const nextLanguage = languageSelect\.value;/);
  assert.match(requestApplyFunction, /void runApply\(nextLanguage\)\.catch\(recoverOperationFailure\);/);
  assert.match(requestApplyFunction, /languageScope\.showConfirmation\('switch'/);
  assert.match(requestApplyFunction, /if \(languageScope\.showConfirmation\('switch'[\s\S]*?\)\) return;\s*void runApply\(nextLanguage\)/,
    'normal Switch runs immediately when the scope policy declines a confirmation');
  assert.match(languageScope, /action !== 'restore'[\s\S]*?return false/,
    'user-profile scope no longer opens a normal Switch confirmation');
  assert.doesNotMatch(app, /showApplyConfirmation|t\('confirmTitle'\)|t\('confirmBody'\)/);
  for (const body of uiLocaleBodies(uiText)) {
    assert.match(body, /apply: '(?:Switch|切换|切換|切り替える)'/);
    assert.doesNotMatch(body, /confirmTitle:|confirmBody:|continue:/);
  }
  assert.doesNotMatch(app, /maintenanceHeading|extractButton|restoreEnglishButton|refreshEnglish/);
  assert.match(app, /statusLabel\.textContent = t\('taskProgressLabel'\)/);
  assert.match(app, /operationLog\.start\(\{[\s\S]*?restoreIntro[\s\S]*?applyIntro/);
  assert.match(app, /const message = t\(restoring \? 'restoreOutcome' : 'applyOutcome'[\s\S]*?operationLog\.complete\(message\)/);
  assert.match(app, /operationLog\.idle\(\)/);
  assert.match(app, /operationLog\.replace\(\{/);
  assert.match(app, /operationLog\.upsert\(operationPhaseCopy\(event, context\)\)/);
  assert.match(app, /reportIssueButton\.addEventListener\('click', \(\) => void openProjectLink\('reportIssue'\)\)/);
  assert.match(app, /legacyReleaseButton\.addEventListener\('click', \(\) => void openProjectLink\('legacyRelease'\)\)/);
  assert.match(app, /const openProjectLink = window\.createProjectLinkControl\(\{ api, text: t, toast: toastControl \}\)/);
  assert.doesNotMatch(app, /async function openProjectLink|function showProjectLinkFailure/, 'shared project-link adapter owns navigation failure feedback');
  assert.match(app, /versionGuidance\.shouldOfferLegacyRelease\(bootstrapState\)/);
  assert.match(app, /versionGuidance\.buttonLabel\(uiLocale\)/);
  assert.match(app, /versionGuidance\.statusKey\(state\.versionCompatibility\)/);
  assert.match(versionGuidance, /status\.versionCompatibility === 'olderUnsupported'[\s\S]*?status\.version === '2\.7\.2'[\s\S]*?status\.supportedVersion === '2\.8\.0'/);
  for (const label of [
    'Download p12 for Cavalry 2.7.2',
    '下载 2.7.2 对应的 p12',
    '下載 2.7.2 對應的 p12',
    'Cavalry 2.7.2 用の p12 をダウンロード',
  ]) assert.ok(versionGuidance.includes(label), `version guidance must localize ${label}`);
  assert.match(app, /reportIssueButton\.textContent = t\('reportIssueButton'\)/);
  assert.match(app, /visualState === 'official'/);
  assert.match(app, /installationBadge\.dataset\.state = showInstallation \? 'official' : 'unknown'/);
  const installationBadgeGate = sourceStatement(app, 'const showInstallation =');
  assert.match(installationBadgeGate, /state\.platform === 'macos'[\s\S]*?Boolean\(state\.appPath\)[\s\S]*?visualState === 'official'/);
  assert.doesNotMatch(installationBadgeGate, /currentLang|nativeLocaleState|nativeResourceAvailable|patchStatus|zh-Hans|ja_JP/,
    'the renderer must display backend classification, never infer Official from a language or resource');
  assert.doesNotMatch(app, /translatedBadge|modifiedBadge|installationBadgeState/);
  assert.match(languageScope, /return match \? match\.label : code === 'en' \? 'English' : text\('unknownLanguage'\)/);
  assert.match(languageScope, /if \(code === 'restore-official'\) return text\('restore'\)/, 'installation macOS Restore keeps its existing localized action label');
  assert.doesNotMatch(uiText, /englishUi:/, 'English is a stable Cavalry language identity, not localized shell copy');
  assert.match(html, /id="currentLanguage"[^>]*data-kind="language"[\s\S]*id="installationBadge"[^>]*data-kind="installation"/);
  assert.match(app, /updateButton\.addEventListener/);
  assert.match(app, /updateControl\.hidden = !\(updatePreviewEnabled \|\| state\.updateInfo\?\.available\)/);
  assert.doesNotMatch(app, /parts\.push\(update\.notes\)/, 'the compact update confirmation must not inline manifest changelog text');
  assert.match(app, /updateTooltipText\.textContent = t\('updateTooltip'\)/);
  assert.match(app, /state\.installationMode === 'official'/);
  assert.match(bridge, /Object\.freeze\(\{/);
  assert.match(bridge, /LANGUAGE_MANIFEST/);
  assert.match(bridge, /PATCH_STATUS = new Set\(\['current', 'updateAvailable', 'unknown', 'notApplicable'\]\)/);
  assert.match(bridge, /LANGUAGE_SCOPE = new Set\(\['installation', 'userProfile'\]\)/);
  assert.match(bridge, /currentLang: supportedLanguage[\s\S]*?languageScope === 'userProfile' \? 'unknown' : 'en'/);
  assert.match(bridge, /nativeResourceAvailable: languageScope === 'installation'[\s\S]*?result\.nativeResourceAvailable === true/);
  assert.match(bridge, /nativeEnglishRestoreAvailable: languageScope === 'userProfile'[\s\S]*?supportedLanguage && result\.currentLang !== 'en'[\s\S]*?result\.reconciliationRequired !== true[\s\S]*?result\.nativeEnglishRestoreAvailable === true/);
  assert.match(bridge, /nativeRestoreOnly: allowNativeRestoreOnly && result\.ok === true && currentLang === 'en'[\s\S]*?warningCodes\.length === 0[\s\S]*?result\.reconciliationRequired !== true[\s\S]*?result\.permissionRequired !== true[\s\S]*?!result\.error && !result\.errorCode[\s\S]*?result\.nativeRestoreOnly === true/);
  assert.match(bridge, /normalizeAction\(result, lang === 'en'\)/);
  assert.match(bridge, /patchStatus: PATCH_STATUS\.has\(result\.patchStatus\) \? result\.patchStatus : 'unknown'/);
  for (const method of REQUIRED_API_METHODS) assert.match(bridge, new RegExp(`${method}:`));
  assert.doesNotMatch(bridge, /restartCavalry:/, 'restart is internal to apply, not a renderer API');
  assert.doesNotMatch(app, /api\.restartCavalry\(/, 'renderer must not split apply/restart operations');
});

test('support footer gives wide brand marks the same visible icon gap', () => {
  const css = read('renderer/support-footer.css');
  assert.match(css, /\.support-footer-link-xiaohongshu\s*\{[^}]*width:\s*calc\(var\(--support-link-hit-size\) \+ var\(--support-link-icon-size\)\)/,
    'the 32px Xiaohongshu mark needs a 48px slot, not the 16px marks’ 32px slot');
});

test('Tauri configuration disables global injection and declares a local-only CSP', () => {
  const tokens = read('renderer/tokens.css');
  const styles = read('renderer/styles.css');
  const supportFooterStyles = read('renderer/support-footer.css');
  const windowControls = read('renderer/window-controls.js');
  const windowControlStyles = read('renderer/window-controls.css');
  const config = JSON.parse(read('src-tauri/tauri.conf.json'));
  assert.equal(config.app.withGlobalTauri, false);
  assert.equal(typeof config.app.security.csp, 'string');
  assert.match(config.app.security.csp, /default-src 'self'/);
  assert.match(config.app.security.csp, /script-src 'self'/);
  assert.doesNotMatch(config.app.security.csp, /https?:\/\//);
  const window = config.app.windows.find((candidate) => candidate.label === 'main');
  assert.equal(window.decorations, true);
  assert.equal(window.titleBarStyle, 'Overlay');
  assert.equal(window.hiddenTitle, true);
  assert.equal(window.width, 400);
  assert.equal(window.height, 504);
  assert.equal(window.minWidth, 400);
  assert.equal(window.minHeight, 504);
  const capabilities = JSON.parse(read('src-tauri/capabilities/default.json'));
  assert.ok(capabilities.permissions.includes('core:window:allow-start-dragging'));
  for (const permission of [
    'core:window:allow-minimize',
    'core:window:allow-toggle-maximize',
    'core:window:allow-close',
  ]) assert.ok(capabilities.permissions.includes(permission));
  const windowsConfig = JSON.parse(read('src-tauri/tauri.windows.conf.json'));
  const windowsWindow = windowsConfig.app.windows.find((candidate) => candidate.label === 'main');
  for (const key of ['title', 'url', 'useHttpsScheme', 'resizable', 'center']) {
    assert.equal(windowsWindow[key], window[key], `Windows ${key} must reuse the shared window contract`);
  }
  assert.equal(windowsWindow.decorations, false);
  assert.equal(windowsWindow.width, 420);
  assert.equal(windowsWindow.height, 524);
  assert.equal(windowsWindow.minWidth, 420);
  assert.equal(windowsWindow.minHeight, 524);
  assert.equal(windowsWindow.transparent, true);
  assert.equal(windowsWindow.shadow, false);
  assert.equal(windowsWindow.visible, false);
  assert.match(tokens, /--line-height-label:\s*16px/);
  assert.match(tokens, /--space-1:\s*4px/);
  assert.match(tokens, /--space-4:\s*16px/);
  assert.match(tokens, /--space-5:\s*20px/);
  assert.match(tokens, /--space-8:\s*32px/);
  assert.match(tokens, /--padding-window:\s*var\(--space-5\)/);
  assert.doesNotMatch(tokens, /--support-footer-padding-block:/, 'content owns the existing top gap');
  assert.match(tokens, /--support-footer-spacing:\s*calc\(var\(--padding-window\) \/ 2\)/, 'one fixed 10px token owns both footer edges');
  assert.match(styles, /\.content\s*\{[^}]*padding:\s*var\(--padding-window\) var\(--padding-window\) var\(--support-footer-spacing\)/, 'top gap is padding, not a second margin');
  assert.match(tokens, /--support-footer-gap:\s*var\(--space-3\)/);
  assert.match(tokens, /--support-link-hit-size:\s*var\(--space-8\)/);
  assert.match(tokens, /--support-link-icon-size:\s*var\(--space-4\)/);
  assert.match(tokens, /--support-footer-height:\s*calc\(var\(--line-height-compact\)\s*\+\s*var\(--support-footer-spacing\)\)/);
  assert.match(supportFooterStyles, /\.support-footer\s*\{[\s\S]*?grid-template-columns:\s*auto auto;[\s\S]*?grid-template-rows:\s*var\(--line-height-compact\);[\s\S]*?justify-content:\s*center;[\s\S]*?align-items:\s*center;[\s\S]*?gap:\s*var\(--support-footer-gap\)/);
  assert.match(supportFooterStyles, /padding:\s*0\s+var\(--padding-window\)\s+var\(--support-footer-spacing\)/);
  assert.match(supportFooterStyles, /\.support-footer\s*\{[^}]*text-align:\s*left/, 'single-row copy remains readable inside the centered group');
  assert.match(supportFooterStyles, /\.support-footer-links\s*\{[^}]*height:\s*var\(--support-link-icon-size\)[^}]*justify-content:\s*center/, 'links stay on one visual row in the centered group');
  assert.match(read('renderer/support-footer.js'), /setAttribute\('title', label\)/, 'icon-only links retain visible localized action hints');
  assert.match(supportFooterStyles, /\.support-footer-links\s*\{[^}]*display:\s*flex;[^}]*align-items:\s*center/);
  assert.match(supportFooterStyles, /\.support-footer-link\s*\{[^}]*width:\s*var\(--support-link-hit-size\);[^}]*height:\s*var\(--support-link-hit-size\)/, '32px hit targets remain centered inside the 16px visual row');
  assert.match(tokens, /--windows-shell-radius:\s*32px/);
  assert.match(tokens, /--window-shadow-inset:\s*10px/);
  assert.match(tokens, /--about-caption-icon-size:\s*var\(--windows-caption-icon-size\)/);
  assert.match(styles, /html\[data-platform="windows"\] body\s*\{[\s\S]*padding: var\(--window-shadow-inset\)/);
  assert.match(styles, /border-radius: var\(--windows-shell-radius\)/);
  assert.match(styles, /corner-shape: squircle/);
  assert.match(windowControlStyles, /#aboutButton svg\s*\{[\s\S]*?width:\s*var\(--about-caption-icon-size\);[\s\S]*?height:\s*var\(--about-caption-icon-size\)/);
  assert.match(styles, /box-shadow: var\(--shadow-window\)/);
  assert.match(styles, /body\[data-maximized="true"\][\s\S]*padding: 0/);
  assert.match(windowControls, /document\.body\.dataset\.maximized = maximized/);
  assert.match(read('renderer/app.js'), /const initialPlatform = document\.documentElement\.dataset\.platform \|\| ''/);
  assert.match(read('renderer/app.js'), /document\.addEventListener\('cavalry-platform-ready'/);
  assert.match(read('renderer/about-window.js'), /document\.addEventListener\('cavalry-platform-ready'/);
});


test('renderer localizes reinstall and composable warning-code paths without raw warning prose', () => {
  const app = read('renderer/app.js');
  const uiText = read('renderer/ui-text.js');
  const profileText = read('renderer/user-profile-text.js');
  const languageScope = read('renderer/language-scope.js');
  const bridge = read('renderer/tauri-bridge.js');
  const styles = read('renderer/styles.css');
  assert.equal((uiText.match(/^\s{4}reinstallRequired:/gm) || []).length, 4, 'all four UI locales must localize the reinstall route');
  const localeBodies = uiLocaleBodies(uiText);
  const nativeCopies = vm.runInNewContext(`${profileText}\nNATIVE_USER_PROFILE_TEXT`, {});
  const mergedCopies = vm.runInNewContext(`${profileText}\n${uiText}\nUI_TEXT`, {});
  const localeNames = ['en', 'zh-Hans', 'zh-Hant', 'ja_JP'];
  assert.deepEqual(Object.keys(nativeCopies).sort(), [...localeNames].sort());
  for (const locale of localeNames) {
    assert.deepEqual(Object.keys(nativeCopies[locale]).sort(), [...PROFILE_TEXT_KEYS].sort(), `${locale} userProfile copy domain drifted`);
    assert.equal(Object.keys(mergedCopies[locale]).length, 192, `${locale} merged UI_TEXT key count must omit obsolete startup notice and duplicate default-label keys`);
    for (const removedSwitchKey of ['nativeUserProfileSwitchConfirmTitle', 'nativeUserProfileSwitchConfirmBody']) {
      assert.equal(Object.hasOwn(nativeCopies[locale], removedSwitchKey), false, `${locale} no longer owns ${removedSwitchKey}`);
      assert.equal(Object.hasOwn(mergedCopies[locale], removedSwitchKey), false, `${locale} no longer exports ${removedSwitchKey}`);
    }
    for (const key of PROFILE_TEXT_KEYS) {
      assert.equal(mergedCopies[locale][key], nativeCopies[locale][key], `${locale}.${key} must be consumed from the extracted domain`);
    }
  }
  for (const body of localeBodies) {
    for (const key of PROFILE_TEXT_KEYS) {
      assert.doesNotMatch(body, new RegExp(`^\\s{4}${key}:`, 'm'), `${key} must have one owner in user-profile-text.js`);
    }
  }
  for (const locale of localeBodies) {
    const recovery = locale.match(/^\s{4}verifyInstallationRecovery: '([^']+)'/m)?.[1];
    const reportLabel = locale.match(/^\s{4}reportIssueButton: '([^']+)'/m)?.[1];
    assert.ok(recovery, 'each locale needs generic verification recovery copy');
    assert.ok(reportLabel, 'each locale needs a localized issue-form button label');
    assert.doesNotMatch(recovery, /reinstall|重新安装|重新安裝|再インストール/i, 'a generic verification error must not prescribe reinstall');
    assert.ok(recovery.includes(reportLabel), 'recovery copy must point to its visible, localized report button');
    assert.doesNotMatch(recovery, /error details|错误详情|錯誤詳情|エラーの詳細/i, 'do not request details the UI does not expose');
  }
  const issueTemplate = read('.github/ISSUE_TEMPLATE/bug_report.yml');
  assert.match(issueTemplate, /name:\s*Bug Report/);
  assert.match(issueTemplate, /Nothing is collected or uploaded automatically/);
  assert.match(uiText, /reinstallRequired: 'This Cavalry installation has no complete, verified original backup[^\n]*restoring English[^\n]*Reinstall Cavalry \{supportedVersion\} from the official installer, reopen the Switcher, then choose a language again\.'/);
  assert.match(uiText, /reinstallRequired: '此 Cavalry 安装缺少完整且可验证的原厂备份[^\n]*恢复英文[^\n]*重新安装 Cavalry \{supportedVersion\}[^\n]*重新打开语言切换器，再选择语言。'/);
  assert.match(uiText, /reinstallRequired: '此 Cavalry 安裝缺少完整且可驗證的原廠備份[^\n]*還原英文[^\n]*重新安裝 Cavalry \{supportedVersion\}[^\n]*重新開啟語言切換器，再選擇語言。'/);
  assert.match(uiText, /reinstallRequired: 'この Cavalry インストールには完全で検証済みの元のバックアップ[^\n]*英語への復元[^\n]*Cavalry \{supportedVersion\} を再インストール[^\n]*言語スイッチャーを開き直してから言語を選び直してください。'/);
  assert.doesNotMatch(uiText, /(?:officialMode|modifiedMode|recoveryMode|officialBadge|modifiedBadge):[^\n]*(?:Managed \/ Unverified|已管理|未验证|未驗證|管理済み \/ 未検証)/);
  assert.doesNotMatch(
    uiText,
    /interrupted update|中断的更新|中斷的更新|中断した更新/,
    'startup transaction recovery must not be mislabeled as an updater failure'
  );
  assert.match(uiText, /closeCavalryTitle: 'Cavalry 正在运行'/);
  assert.match(uiText, /cavalryStillRunning: '保存工作并退出 Cavalry 后重试。安装内容未被修改。'/);
  assert.match(uiText, /newerVersionUnsupported: '语言切换器目前支持 Cavalry \{supportedVersion\}，不会修改此安装。你可以继续使用 Cavalry；请在兼容更新发布后再试。'/);
  assert.doesNotMatch(uiText, /signatureResidueRepairable|legacy signing residue|旧版签名残留|舊版簽名殘留|旧版署名残留/);
  assert.doesNotMatch(uiText, /原始英文文件|original English files|原始英文檔案|元の英語ファイル/);
  assert.equal((uiText.match(/^\s{4}restore:/gm) || []).length, 4, 'all four UI locales must localize the single Restore action');
  for (const copy of [
    "restoreConfirmTitle: 'Restore English?'",
    "restoreConfirmBody: 'Cavalry will return to English and reopen.'",
    "restoreConfirmTitle: '恢复英文？'",
    "restoreConfirmBody: 'Cavalry 将恢复为英文并重新打开。'",
    "restoreConfirmTitle: '還原英文？'",
    "restoreConfirmBody: 'Cavalry 將還原為英文並重新開啟。'",
    "restoreConfirmTitle: '英語に戻しますか？'",
    "restoreConfirmBody: 'Cavalry を英語に戻して、もう一度開きます。'",
  ]) {
    assert.match(uiText, new RegExp(copy.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.doesNotMatch(uiText, /restoreConfirmTitle: ['\"](?:Restore|恢复|還原).*Cavalry/);
  assert.doesNotMatch(
    uiText,
    /maintenance|refreshEnglish|restoreEnglish|restoreOfficialShort|officialRestore|runtimeResidueAfterRefresh/,
    'obsolete Recovery/Refresh copy must stay deleted'
  );
  for (const key of [
    'unknownLanguage',
    'officialBadge',
    'patchUpdateBadge',
    'languageOptionUpdateAria',
    'updateLanguagePatch',
    'statusLabel',
    'taskProgressLabel',
    'idlePrompt',
    'applyIntro',
    'restoreIntro',
    'updateIntro',
    'applyOutcome',
    'restoreOutcome',
    'minimizeWindow',
    'maximizeWindow',
    'restoreWindow',
    'closeWindow',
    'readyToApplyTitle',
    'reinstallCavalryTitle',
    'reinstallRequired',
    'closeCavalryTitle',
    'preparingApplyTitle',
    'restoringTitle',
    'restoredTitle',
    'appliedTitle',
    'phaseVerifyInstallationRunningTitle',
    'phaseVerifyInstallationCompletedTitle',
    'phaseVerifyInstallationErrorTitle',
    'verifyInstallationRecovery',
    'reportIssueButton',
    'phaseEnsureRecoveryRunningTitle',
    'phaseEnsureRecoveryCompletedTitle',
    'phaseEnsureRecoveryErrorTitle',
    'phaseApplyRunningTitle',
    'phaseApplyCompletedTitle',
    'phaseApplyErrorTitle',
    'phaseRestoreRunningTitle',
    'phaseRestoreCompletedTitle',
    'phaseRestoreErrorTitle',
    'phaseRestartRunningTitle',
    'phaseRestartCompletedTitle',
    'phaseRestartWarningTitle',
    'phaseRestartErrorTitle',
    'restartRecovery',
    'restoreFailed',
    'warningStateDurabilityPending',
    'warningRecoveryCleanupPending',
    'warningProtectedRecoveryEvidenceRetained',
    'warningTemporaryCleanupPending',
    'warningFinderFallbackUsed',
    'warningNonFatalCleanup',
    'appliedWithWarnings',
    'runtimeResidueWarning',
    'preparingApply',
    'restoring',
    'restoreConfirmTitle',
    'restoreConfirmBody',
    'restoreSuccess',
    'restoreWithWarnings',
    'updateAvailableAnnouncement',
    'updateConfirmTitle',
    'updateConfirmBody',
    'updateMacAdhocNote',
    'installUpdate',
    'updateDownloadRunningTitle',
    'updateDownloadProgress',
    'updateDownloadCompletedTitle',
    'updateInstallRunningTitle',
    'updateInstallCompletedTitle',
    'updateRestartRunningTitle',
    'updaterNotConfigured',
    'updaterUnsupportedPlatform',
    'updateCheckFailed',
    'updateInstallFailed',
    'updateNotChecked',
    'updateBusy',
    'updateStateUnavailable',
  ]) {
    for (const body of localeBodies) {
      assert.match(body, new RegExp(`^\\s{4}${key}:`, 'm'), `${key} missing from a locale`);
    }
  }
  const englishRestorePhaseCopies = [
    ['Restoring English', 'English restored', 'Could not restore English'],
    ['正在恢复英文', '已恢复英文', '无法恢复英文'],
    ['正在還原英文', '已還原英文', '無法還原英文'],
    ['英語を復元中', '英語に戻しました', '英語に戻せませんでした'],
  ];
  for (const [index, locale] of localeNames.entries()) {
    const body = nativeCopies[locale];
    assert.ok(body.nativeEnglishRestoreOnlyOutcome, 'every locale distinguishes restore from launch');
    const [running, completed, error] = englishRestorePhaseCopies[index];
    assert.equal(body.phaseApplyEnglishRestoreRunningTitle, running);
    assert.equal(body.phaseApplyEnglishRestoreCompletedTitle, completed);
    assert.equal(body.phaseApplyEnglishRestoreErrorTitle, error);
    assert.ok(body.phaseVerifyEnglishRestoreRunningTitle, 'every locale avoids presenting profile English verification as host verification');
    assert.ok(body.phaseVerifyEnglishRestoreCompletedTitle);
    assert.ok(body.phaseVerifyEnglishRestoreErrorTitle);
  }
  for (const copy of [
    'English restored. No verified compatible installation; Cavalry was not started.',
    '已恢复英文。未验证到兼容安装，Cavalry 未启动。',
    '已還原英文。未能驗證相容安裝，Cavalry 未啟動。',
    '英語に戻しました。互換性のあるインストールを確認できないため、Cavalry は起動していません。',
  ]) assert.ok(Object.values(nativeCopies).some((locale) => Object.values(locale).includes(copy)), `hostless Restore copy missing: ${copy}`);
  assert.doesNotMatch(app, /requiresCavalryReinstall|restoreIsBlockedByMissingBaseline/);
  assert.doesNotMatch(app, /startupRecoveryError|setStatus\('reinstallRequired', 'error'\)/);
  assert.match(app, /const restoreAction = state\.platform === 'macos' \? 'restore-official' : 'en';/);
  assert.doesNotMatch(app, /macosSignatureResidueRepairable|signatureResidueRepairable|legacySignatureResidue/);
  assert.doesNotMatch(bridge, /macosSignatureResidueRepairable|legacySignatureResidue/);
  assert.match(bridge, /macosPermissionHandoffRequired: result\.platform === 'macos' && result\.macosPermissionHandoffRequired === true/);
  assert.doesNotMatch(app, /macosPermissionHandoffRequired|startMacosPermissionHandoff|macosPermissionHandoffIsRequired/);
  assert.match(app, /if \(result\.permissionRequired\) \{[\s\S]*showPermissionWait\(nextLanguage/);
  assert.match(uiText, /const STATUS_TITLE_KEYS = Object\.freeze\(\{/);
  assert.match(uiText, /reinstallRequired: 'reinstallCavalryTitle'/);
  assert.match(app, /warningCodes\.includes\('stateDurabilityPending'\)/);
  assert.match(app, /browseButton\.disabled[\s\S]*durabilityPending/);
  const setBusyFunction = sourceFunction(app, 'function setBusy(isBusy) {', 'function localizeShell');
  const applyDisabledStatement = sourceStatement(setBusyFunction, 'applyButton.disabled =');
  assert.match(applyDisabledStatement, /!languageSelect\.value/, 'Switch must require an explicit target-language choice');
  assert.match(applyDisabledStatement, /!languageScope\.canSwitch\(\)/, 'missing native resources block only the Switch path');
  assert.match(applyDisabledStatement, /state\.controlsBlocked[\s\S]*durabilityPending;/);
  assert.doesNotMatch(applyDisabledStatement, /reinstallRequired/);
  assert.doesNotMatch(
    applyDisabledStatement,
    /state\.needsExtract/,
    'a clean official install may auto-create its baseline on Apply'
  );
  const restoreDisabledStatement = sourceStatement(setBusyFunction, 'restoreButton.disabled =');
  assert.match(restoreDisabledStatement, /languageScope\.restoreIsNeeded\(state\.appPath, state\.currentLang, state\.englishRestoreNeeded\)/);
  assert.match(restoreDisabledStatement, /state\.controlsBlocked && !languageScope\.hostlessRestoreAvailable\(state\.appPath\)/,
    'only strict owned-image policy may bypass incompatible-host blocking for English Restore');
  assert.doesNotMatch(restoreDisabledStatement, /languageScope\.canSwitch/, 'missing native resources must not disable Restore');
  assert.doesNotMatch(restoreDisabledStatement, /restoreIsBlockedByMissingBaseline\(\)/);
  assert.match(restoreDisabledStatement, /state\.controlsBlocked[\s\S]*durabilityPending;/);
  assert.match(languageScope, /function restoreIsNeeded\(appPath, currentLang, reconciliationRequired\)/);
  assert.match(languageScope, /function hostlessRestoreAvailable\(appPath\)/);
  assert.match(languageScope, /nativeEnglishRestoreAvailable === true/);
  assert.match(languageScope, /status\.versionCompatibility !== 'supported'/);
  assert.match(languageScope, /currentLang !== 'en' \|\| reconciliationRequired/);
  assert.doesNotMatch(languageScope, /platform === 'windows'/);
  assert.doesNotMatch(languageScope, /installationMode/, 'managed English must not expose a no-op Restore action');
  const retryCallback = sourceFunction(app, 'onRetry: () => {', 'onError:');
  assert.match(app, /permissionRetryAttempt: 0/);
  assert.match(retryCallback, /state\.permissionRetryAttempt \+= 1;/);
  assert.match(retryCallback, /attemptId:\s*`permission-retry-\$\{state\.permissionRetryAttempt\}`/);
  assert.doesNotMatch(retryCallback, /resumeAfterPermission/, 'permission retry must not insert synthetic narration');
  const runApplyFunction = sourceFunction(
    app,
    "async function runApply(nextLanguage, { attemptId = '' } = {}) {",
    'function handlePermissionButton'
  );
  assert.match(runApplyFunction, /const restoring = languageScope\.isRestoreAction\(nextLanguage\);/);
  assert.match(runApplyFunction, /result\.nativeRestoreOnly === true\) operationLog\.complete\(t\('nativeEnglishRestoreOnlyOutcome'\)\)/);
  assert.match(app, /languageScope\.phaseTitleKey\([\s\S]*?,\s*restoring\s*\)/);
  assert.match(languageScope, /isUserProfile\(\) && restoring && phase === 'verifyInstallation'/);
  assert.match(languageScope, /isUserProfile\(\) && restoring && phase === 'applyTransaction'/);
  assert.match(runApplyFunction, /setReportIssueVisible\(false\)/, 'a new operation must clear the previous report action');
  assert.match(app, /const id = attemptId \? `\$\{attemptId\}:\$\{phase\}` : phase;/);
  assert.match(runApplyFunction, /phase: 'verifyInstallation', state: 'running'/);
  assert.match(runApplyFunction, /api\.applyLanguage\(state\.appPath, nextLanguage, \(event\) => \{/);
  assert.match(runApplyFunction, /updateOperationPhase\(event, operationContext\)/);
  assert.match(runApplyFunction, /result\.errorCode === 'cavalryStillRunning'[\s\S]*?return;[\s\S]*?const verificationFailureId = attemptId \? `\$\{attemptId\}:verifyInstallation` : 'verifyInstallation';\s*setReportIssueVisible\(!result\.errorCode && terminalPhaseEvent\?\.id === verificationFailureId\)/, 'typed process errors must return before the ordinary verify-only report action');
  assert.match(app, /function updateOperationPhase\(event, context\) \{\s*if \(context\.attemptId && \['verifyInstallation', 'ensureBaseline'\]\.includes\(event\.phase\) && \['running', 'completed'\]\.includes\(event\.state\)\) return;/);
  assert.match(runApplyFunction, /if \(!attemptId\) \{\s*state\.permissionRetryAttempt = 0;\s*operationLog\.start\(/);
  assert.doesNotMatch(runApplyFunction, /:resume|resumeAfterPermission/, 'permission retry must append only real backend phases');
  const restoreConfirmationFunction = sourceFunction(
    app,
    'function showRestoreConfirmation() {',
    'function showPermissionWait'
  );
  assert.match(
    restoreConfirmationFunction,
    /onPrimary: \(\) => \{\s*closeModal\(\);\s*void runApply\(restoreAction\)\.catch\(recoverOperationFailure\);\s*\}/
  );
  const bootstrapFunction = sourceFunction(app, 'async function bootstrap({ renderActivity = true } = {}) {', 'async function browseForApp');
  assert.match(
    bootstrapFunction,
    /const reconciliationRequired = bootstrapState\.reconciliationRequired === true;/
  );
  assert.match(bootstrapFunction, /state\.englishRestoreNeeded = reconciliationRequired;/);
  assert.match(bootstrapFunction, /const runtimeResidueDetected =\s*state\.platform === 'windows' && reconciliationRequired;/);
  assert.match(bootstrapFunction, /languageSelectControl\.setValue\(''\)/, 'bootstrap must not silently preselect a target language');
  const permissionWaitFunction = sourceFunction(
    app,
    "async function showPermissionWait(nextLanguage, phaseId = 'permissionRequired', macBodyKey = 'permissionMacBody', activityBodyKey = 'waitingPermission') {",
    'async function bootstrap'
  );
  assert.match(permissionWaitFunction, /primary: needsElevation \? t\('requestElevation'\) : t\('openSettings'\)/);
  assert.match(permissionWaitFunction, /title: t\(needsElevation \? 'permissionWindowsTitle' : 'permissionMacTitle'\)/);
  assert.match(permissionWaitFunction, /body: t\(needsElevation \? 'permissionWindowsBody' : macBodyKey\)/);
  assert.match(permissionWaitFunction, /secondary: t\('cancel'\)/);
  assert.match(permissionWaitFunction, /description: t\(needsElevation \? 'waitingPermission' : activityBodyKey\)/);
  assert.match(permissionWaitFunction, /await operationLog\.presentBlocking\(\{[\s\S]*?id: phaseId,[\s\S]*?state: 'warning'/);
  assert.match(runApplyFunction, /await showPermissionWait\(nextLanguage, terminalPhaseEvent\?\.id\)/);
  assert.match(runApplyFunction, /if \(attemptId && state\.platform === 'macos'\)[\s\S]*?state\.pendingAction = ''[\s\S]*?setPermissionWait\(false\)[\s\S]*?permissionRestartRequiredTitle[\s\S]*?permissionRestartRequiredBody/);
  assert.match(runApplyFunction, /const message = t\(restoring \? 'restoreOutcome' : 'applyOutcome'[\s\S]*?operationLog\.complete\(message\)/);
  assert.doesNotMatch(app, /operationVerified|permissionVerified|permission-verified/, 'permission success must not add a product Activity event');
  assert.doesNotMatch(permissionWaitFunction, /setStatus\('waitingPermission'/);
  assert.doesNotMatch(permissionWaitFunction, /retryApply|Retry Apply/);
  assert.doesNotMatch(app, /maintenanceHeading|extractButton|restoreEnglishButton|refreshEnglish/);
  assert.doesNotMatch(app, /reconcileEnglish|reconcileButton|runReconciliation|showReconciliation/);
  assert.doesNotMatch(app, /state\.reconciliationRequired/, 'residue detection must not become renderer mutation state');
  assert.doesNotMatch(app, /result\.warning(?!Codes)/, 'app.js must never render backend warning prose');
  assert.doesNotMatch(app, /result\.error\b/, 'app.js must never render backend error prose');
  assert.match(runApplyFunction, /result\.errorCode === 'reinstallRequired'[\s\S]*?title: t\('reinstallCavalryTitle'\)[\s\S]*?description: t\('reinstallRequired', \{ supportedVersion: state\.supportedVersion \}\)/);
  assert.match(runApplyFunction, /languageScope\.failureTextKey\(result\.errorCode\)[\s\S]*?nativeUserLanguageFailureTitle/);
  assert.match(bridge, /WARNING_CODE_MANIFEST/);
  assert.match(bridge, /warning:\s*null/);
  assert.match(bridge, /warningCodes:\s*Object\.freeze/);
  assert.doesNotMatch(bridge, /extractEnglish|extract_english/);
  assert.doesNotMatch(bridge, /reconcileEnglish/);
  assert.doesNotMatch(styles, /--text-muted/);
  assert.doesNotMatch(styles, /reconcile-button/);
});

test('typed reinstallRequired replaces the failed phase with an actionable official reinstall route', async () => {
  const app = read('renderer/app.js');
  const runApplyFunction = sourceFunction(
    app,
    "async function runApply(nextLanguage, { attemptId = '' } = {}) {",
    'function handlePermissionButton'
  );
  const projections = [];
  const reportIssueVisibility = [];
  const state = {
    appPath: '/Applications/Cavalry.app',
    currentLang: 'en',
    pendingAction: '',
    busy: false,
    platform: 'macos',
    stateDurabilityPending: false,
    permissionRetryAttempt: 0,
    supportedVersion: '2.7.2',
  };
  const context = {
    state,
    setBusy(value) { state.busy = value; },
    setPermissionWait() {},
    setReportIssueVisible(value) { reportIssueVisibility.push(value); },
    languageScope: {
      languageLabel: (language) => language,
      isRestoreAction: () => false,
      failureTextKey: () => null,
    },
    t: (key, params = {}) => `${key}:${params.supportedVersion || ''}`,
    operationPhaseCopy: ({ phase, state: phaseState }) => ({
      id: phase,
      title: 'generic phase title',
      description: '',
      state: phaseState,
    }),
    updateOperationPhase: (event) => projections.push({ kind: 'phase', event }),
    operationLog: {
      start() {},
      upsert: (event) => projections.push({ kind: 'upsert', event }),
      finishRunning: (state) => projections.push({ kind: 'finish', state }),
    },
    api: {
      async applyLanguage(_appPath, _language, onEvent) {
        onEvent({ phase: 'ensureBaseline', state: 'running' });
        onEvent({ phase: 'ensureBaseline', state: 'error' });
        return { ok: false, permissionRequired: false, errorCode: 'reinstallRequired' };
      },
    },
    bootstrap: async () => {},
    appendPostCommitWarnings: () => {},
  };

  await vm.runInNewContext(`${runApplyFunction}\nrunApply('zh-Hans')`, context);

  const failure = projections.find(({ kind, event }) => kind === 'upsert' && event.state === 'error');
  assert.ok(failure, 'a failed backend operation must remain visible in Activity');
  assert.deepEqual(JSON.parse(JSON.stringify(failure.event)), {
    id: 'ensureBaseline',
    title: 'reinstallCavalryTitle:',
    description: 'reinstallRequired:2.7.2',
    state: 'error',
  }, 'the typed error should replace the generic failed phase and include the supported host version');
  assert.equal(state.pendingAction, '', 'a blocked action must not remain pending');
  assert.equal(state.busy, false, 'the renderer must release controls after the typed failure');
  assert.deepEqual(reportIssueVisibility, [false], 'typed errors must never reveal the generic report action');
});

test('update icon stays hidden until preview or an updater check result and renderer has no network client', () => {
  const html = read('renderer/index.html');
  const app = read('renderer/app.js');
  const updateProgress = read('renderer/update-progress.js');
  const bridge = read('renderer/tauri-bridge.js');
  const uiText = read('renderer/ui-text.js');
  assert.match(html, /id="updateControl"[^>]*hidden/);
  assert.match(html, /id="updateTooltip"[^>]*role="tooltip"/);
  assert.match(uiText, /updateTooltip:/);
  assert.match(uiText, /updateMacAdhocNote:/);
  assert.match(app, /function updatePreviewRequested\(\)/);
  assert.match(app, /preview=update/);
  assert.match(app, /window\.__CAVALRY_I18N_PREVIEW__/);
  assert.doesNotMatch(app, /alertPreview|previewLocale|showLongestAlertPreview/);
  assert.match(app, /if \(updatePreviewEnabled \|\| typeof api\.checkUpdate !== 'function'\) return/);
  assert.match(app, /const result = await api\.checkUpdate\(\)/);
  assert.match(app, /const result = await api\.installUpdate\(\(event\) => updateProgress\.project\(event, update\)\)/);
  assert.match(updateProgress, /function createUpdateProgress/);
  assert.match(updateProgress, /phase === 'downloading'/);
  assert.match(updateProgress, /phase === 'installing'/);
  assert.match(updateProgress, /phase === 'restarting'/);
  assert.match(bridge, /invoke\('check_update'\)/);
  assert.match(bridge, /invoke\('install_update', \{ onEvent: channel \}\)/);
  assert.match(bridge, /UPDATE_ERROR_CODE_MANIFEST/);
  assert.match(bridge, /UPDATE_PHASE_MANIFEST/);
  assert.match(bridge, /normalizeUpdateEvent/);
  assert.match(bridge, /class OrderedChannel/);
  assert.match(bridge, /transformCallback/);
  assert.match(bridge, /OPERATION_PHASE_MANIFEST/);
  assert.match(bridge, /onEvent: channel/);
  assert.doesNotMatch(bridge, /url:\s*pick|signature:\s*pick|rawJson:\s*pick/);
  assert.doesNotMatch(app, /fetch\s*\(/i);
  assert.doesNotMatch(app, /axios/i);
  assert.doesNotMatch(app, /openLatestRelease|open_latest_release/);
  assert.doesNotMatch(bridge, /openLatestRelease|open_latest_release/);
});

test('UI Review patch fixtures preserve update state on rejection and converge on success', async () => {
  for (const [scenario, expected] of [['translated', 'current'], ['patchUpdate', 'updateAvailable'], ['patchDrift', 'updateAvailable'], ['managedLegacy', 'unknown'], ['official', 'notApplicable']]) {
    const window = { addEventListener() {} };
    vm.runInNewContext(fixtureSource(), {
      window, navigator: {}, URLSearchParams, location: { search: '?scenario=' + scenario },
      setTimeout: (resolve) => resolve(),
    });
    const api = window.cavalryI18n;
    assert.equal((await api.getStatus()).patchStatus, expected, scenario);
    if (!scenario.startsWith('patch')) continue;
    const events = [];
    const result = await api.applyLanguage('/fixture', 'zh-Hans', (event) => events.push(event));
    assert.equal(result.ok, scenario !== 'patchDrift');
    assert.equal((await api.getStatus()).patchStatus, scenario === 'patchDrift' ? 'updateAvailable' : 'current');
    if (scenario === 'patchDrift') {
      assert.equal(result.errorCode, null, 'preview must not invent a production error code');
      assert.deepEqual(JSON.parse(JSON.stringify(events.at(-1))), { phase: 'applyTransaction', state: 'error' });
    }
    assert.match(workspaceHtml(), new RegExp('data-scenario="' + scenario + '"'));
  }
});

test('UI Review native preview fixtures separate locale state, installation source, and the legacy release boundary', async () => {
  const fixtures = [
    ['nativeDefaultEnglish', {
      version: '2.8.0', supportedVersion: '2.8.0', versionCompatibility: 'supported',
      languageScope: 'userProfile', nativeResourceAvailable: true, currentLang: 'en',
      nativeLocaleState: 'unset', patchStatus: 'notApplicable', installationMode: 'unknown',
      officialRecoveryAvailable: false, nativeEnglishRestoreAvailable: false, reconciliationRequired: false,
    }],
    ['nativeOfficialDefaultEnglish', {
      version: '2.8.0', supportedVersion: '2.8.0', versionCompatibility: 'supported',
      languageScope: 'userProfile', nativeResourceAvailable: true, currentLang: 'en',
      nativeLocaleState: 'unset', patchStatus: 'notApplicable', installationMode: 'official',
      officialRecoveryAvailable: false, nativeEnglishRestoreAvailable: false, reconciliationRequired: false,
    }],
    ['nativeOwnedHans', {
      version: '2.8.0', supportedVersion: '2.8.0', versionCompatibility: 'supported',
      languageScope: 'userProfile', nativeResourceAvailable: true, currentLang: 'zh-Hans',
      nativeLocaleState: 'explicit', patchStatus: 'current', installationMode: 'unknown',
      officialRecoveryAvailable: false, nativeEnglishRestoreAvailable: false, reconciliationRequired: false,
    }],
    ['nativeUnknown', {
      version: '2.8.0', supportedVersion: '2.8.0', versionCompatibility: 'supported',
      languageScope: 'userProfile', nativeResourceAvailable: true, currentLang: 'unknown',
      patchStatus: 'unknown', reconciliationRequired: false,
    }],
    ['nativeResourceUnavailable', {
      version: '2.8.0', supportedVersion: '2.8.0', versionCompatibility: 'supported',
      languageScope: 'userProfile', nativeResourceAvailable: false, currentLang: 'zh-Hans',
      patchStatus: 'current', reconciliationRequired: false,
    }],
    ['nativeRecoveryNoResources', {
      version: '2.8.0', supportedVersion: '2.8.0', versionCompatibility: 'supported',
      languageScope: 'userProfile', nativeResourceAvailable: false, currentLang: 'unknown',
      patchStatus: 'unknown', reconciliationRequired: true,
    }],
    ['nativeLegacyRelease', {
      version: '2.7.2', supportedVersion: '2.8.0', versionCompatibility: 'olderUnsupported',
      languageScope: 'userProfile', nativeResourceAvailable: true, currentLang: 'en',
      patchStatus: 'notApplicable', reconciliationRequired: false,
    }],
    ['nativeRestoreOnly', {
      version: '2.8.0', supportedVersion: '2.8.0', versionCompatibility: 'unknownUnsupported',
      languageScope: 'userProfile', installationMode: 'unknown', nativeResourceAvailable: false, currentLang: 'zh-Hans',
      nativeEnglishRestoreAvailable: true, appPath: '', reconciliationRequired: false,
    }],
    ['nativeRestoreOnlyHostFailure', {
      version: '2.8.0', supportedVersion: '2.8.0', versionCompatibility: 'supported',
      languageScope: 'userProfile', installationMode: 'unknown', nativeResourceAvailable: false, currentLang: 'zh-Hans',
      nativeEnglishRestoreAvailable: true, appPath: '/Applications/Cavalry.app', reconciliationRequired: false,
    }],
  ];

  for (const [scenario, expected] of fixtures) {
    const window = { addEventListener() {} };
    vm.runInNewContext(fixtureSource(), {
      window, navigator: {}, URLSearchParams, location: { search: '?scenario=' + scenario },
      setTimeout: (resolve) => resolve(),
    });
    const status = await window.cavalryI18n.getStatus();
    for (const [key, value] of Object.entries(expected)) {
      assert.equal(status[key], value, `${scenario}.${key}`);
    }
  }
});

test('UI Review projects owned Simplified Chinese as unknown and does not infer installation source from locale', async () => {
  for (const [scenario, nextLanguage, expectedMode] of [
    ['nativeDefaultEnglish', 'zh-Hans', 'unknown'],
    ['nativeOfficialDefaultEnglish', 'zh-Hans', 'official'],
    ['nativeOwnedHans', 'en', 'unknown'],
  ]) {
    const window = { addEventListener() {} };
    vm.runInNewContext(fixtureSource(), {
      window, navigator: {}, URLSearchParams, location: { search: '?scenario=' + scenario },
      setTimeout: (resolve) => resolve(),
    });
    assert.equal((await window.cavalryI18n.getStatus()).installationMode, expectedMode, `${scenario} starts from the evidenced source state`);
    const result = await window.cavalryI18n.applyLanguage('/fixture', nextLanguage);
    assert.equal(result.ok, true, `${scenario} changes language in the fixture`);
    const after = await window.cavalryI18n.getStatus();
    assert.equal(after.currentLang, nextLanguage, `${scenario} projects the changed locale`);
    assert.equal(after.installationMode, expectedMode, `${scenario} does not infer source from locale`);
    assert.equal(after.officialRecoveryAvailable, false, `${scenario} does not invent installation recovery ownership`);
    assert.equal(after.nativeEnglishRestoreAvailable, false, `${scenario} does not grant English restore ownership`);
  }
});

test('UI Review restoreOnly fixtures model owned hostless and same-version host-probe failure without a restart phase', async () => {
  for (const [scenario, expectedVerifyState, appPath] of [
    ['nativeRestoreOnly', 'completed', ''],
    ['nativeRestoreOnlyHostFailure', 'completed', '/Applications/Cavalry.app'],
  ]) {
    const window = { addEventListener() {} };
    vm.runInNewContext(fixtureSource(), {
      window, navigator: {}, URLSearchParams, location: { search: `?scenario=${scenario}` },
      setTimeout: (resolve) => resolve(),
    });
    const events = [];
    const result = await window.cavalryI18n.applyLanguage(appPath, 'en', (event) => events.push(event));
    assert.equal(result.ok, true, `${scenario} restore commits`);
    assert.equal(result.nativeRestoreOnly, true, `${scenario} does not claim Cavalry launch`);
    assert.deepEqual(events.map(({ phase, state }) => [phase, state]), [
      ['verifyInstallation', 'running'], ['verifyInstallation', expectedVerifyState],
      ['ensureBaseline', 'running'], ['ensureBaseline', 'completed'],
      ['applyTransaction', 'running'], ['applyTransaction', 'completed'],
    ], `${scenario} reports the actual three phases and never a restart`);
    const after = await window.cavalryI18n.getStatus();
    assert.equal(after.currentLang, 'en');
    assert.equal(after.nativeEnglishRestoreAvailable, false);
    assert.equal(after.installationMode, 'unknown', `${scenario} cannot promote a failed host probe to official`);
  }
});
