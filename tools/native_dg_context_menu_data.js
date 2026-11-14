/**
 * [INPUT]: 依赖281原生Group审批、旧TS精确MenuBarManager源及AGY精修Lock审批。
 * [OUTPUT]: 声明五个TransformTool helper到唯一批准源的映射，不内置旧译文。
 * [POS]: 281 arm64 addAction窄显示投影；不注册catalog或拓宽产品翻译表。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
'use strict';

const provenance = Object.freeze({
  schemaVersion: 1,
  scope: 'Cavalry 2.8.1 TransformTool context-menu display only',
  reviewState: 'source-bound-display-projection',
  officialCatalogRegistration: false,
  liveAcceptance: false,
});

const lockReview = Object.freeze({
  provider: 'AGY',
  skillPath: '.agents/skills/baoyu-translate/SKILL.md',
  workflow: 'refined',
  reviewedBy: 'primary-agent',
  conversationId: '5901dce6-2515-4e99-821b-8478befb1143',
});

const rows = Object.freeze([
  Object.freeze({
    identity: 'transformTool.addDuplicator',
    callsite: 'addDuplicator',
    source: 'Add to Duplicator',
    sourceApproval: Object.freeze({ kind: 'qt-ts', context: 'MenuBarManager' }),
  }),
  Object.freeze({
    identity: 'transformTool.groupSelected',
    callsite: 'groupSelected',
    source: 'Group Selected',
    sourceApproval: Object.freeze({
      kind: 'native-key',
      catalogId: 'Definitions/Translation/appStrings',
      key: 'sceneTree.menu.groupSelected',
    }),
  }),
  Object.freeze({
    identity: 'transformTool.lockSelected',
    callsite: 'lockSelected',
    source: 'Lock Selected',
    sourceApproval: Object.freeze({
      kind: 'agy-refined-source-bound',
      context: 'MenuBarManager',
      review: lockReview,
    }),
    translations: Object.freeze({
      'zh-Hans': '锁定所选图层',
      'zh-Hant': '鎖定所選圖層',
      ja_JP: '選択項目をロック',
    }),
  }),
  Object.freeze({
    identity: 'transformTool.showInAttributeEditor',
    callsite: 'showInAttributeEditor',
    source: 'Show in Attribute Editor',
    sourceApproval: Object.freeze({ kind: 'qt-ts', context: 'MenuBarManager' }),
  }),
  Object.freeze({
    identity: 'transformTool.showInSceneWindow',
    callsite: 'showInSceneWindow',
    source: 'Show in Scene Window',
    sourceApproval: Object.freeze({ kind: 'qt-ts', context: 'MenuBarManager' }),
  }),
]);

module.exports = { provenance, rows };
