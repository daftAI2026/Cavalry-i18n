/**
 * [INPUT]: 依赖DG/TransformTool源声明、281 native审批与现有Qt TS源。
 * [OUTPUT]: 验证五项来源绑定、AGY lock复核、生成行和漂移拒绝。
 * [POS]: 纯Node构建合同；不注册官方键，不启动App或证明实屏消费。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const DATA = require('./native_dg_context_menu_data.js');
const { parseTs } = require('./generate_embedded_translations.js');
const APPROVED_NATIVE = require('../languages/native/remaining_global_ui_05.js');
const generator = require('./build_native_dg_context_menu_table.js');

const REPO_ROOT = path.resolve(__dirname, '..');
const TS_ENTRIES = Object.fromEntries([
  ['zh-Hans', 'zh-Hans.ts'], ['zh-Hant', 'zh-Hant.ts'], ['ja_JP', 'ja_JP.ts'],
].map(([locale, filename]) => [
  locale, parseTs(path.join(REPO_ROOT, 'tools', filename)),
]));

function cloneData() { return JSON.parse(JSON.stringify(DATA)); }
function cloneTs() { return JSON.parse(JSON.stringify(TS_ENTRIES)); }

function projected() {
  return generator.projectRows(DATA, {
    nativeEntries: APPROVED_NATIVE.entries,
    tsEntriesByLocale: TS_ENTRIES,
  });
}

test('projects exactly five helper/source-bound rows from existing native and TS approvals', () => {
  const rows = projected();
  assert.equal(rows.length, 5);
  assert.equal(new Set(rows.map(row => row.identity)).size, 5);
  assert.equal(new Set(rows.map(row => row.source)).size, 5);
  assert.deepEqual(rows.map(row => row.identity), DATA.rows.map(row => row.identity));

  const group = rows.find(row => row.identity === 'transformTool.groupSelected');
  assert.equal(group.source, 'Group Selected');
  assert.deepEqual(
    [group.zhHans, group.zhHant, group.japanese],
    ['将所选项编组', '將所選項目群組', '選択項目をグループ化'],
  );

  const duplicatedTsSource = rows.find(row => row.identity === 'transformTool.addDuplicator');
  assert.deepEqual(
    [duplicatedTsSource.zhHans, duplicatedTsSource.zhHant, duplicatedTsSource.japanese],
    ['添加到复制器', '新增至複製器', 'デュプリケーターに追加'],
  );
  const lock = rows.find(row => row.identity === 'transformTool.lockSelected');
  assert.deepEqual(
    [lock.zhHans, lock.zhHant, lock.japanese],
    ['锁定所选图层', '鎖定所選圖層', '選択項目をロック'],
  );

  const attr = rows.find(row => row.identity === 'transformTool.showInAttributeEditor');
  assert.deepEqual(
    [attr.zhHans, attr.zhHant, attr.japanese],
    ['在属性编辑器中显示', '在屬性編輯器中顯示', '属性エディターで表示'],
  );
  const scene = rows.find(row => row.identity === 'transformTool.showInSceneWindow');
  assert.deepEqual(
    [scene.zhHans, scene.zhHant, scene.japanese],
    ['在场景窗口中显示', '在場景視窗中顯示', 'シーンウィンドウで表示'],
  );
});

test('rejects stale native source, wrong catalog identity, and missing approved key', () => {
  const wrongSource = APPROVED_NATIVE.entries.map(row => row.key === 'sceneTree.menu.groupSelected'
    ? { ...row, source: 'Group Layers' } : row);
  assert.throws(() => generator.projectRows(DATA, {
    nativeEntries: wrongSource, tsEntriesByLocale: TS_ENTRIES,
  }), /native source identity differs/);

  const wrongCatalog = APPROVED_NATIVE.entries.map(row => row.key === 'sceneTree.menu.groupSelected'
    ? { ...row, catalogId: 'Definitions/Translation/nodeStrings' } : row);
  assert.throws(() => generator.projectRows(DATA, {
    nativeEntries: wrongCatalog, tsEntriesByLocale: TS_ENTRIES,
  }), /native source identity differs/);

  assert.throws(() => generator.projectRows(DATA, {
    nativeEntries: APPROVED_NATIVE.entries.filter(row => row.key !== 'sceneTree.menu.groupSelected'),
    tsEntriesByLocale: TS_ENTRIES,
  }), /approved native key is missing/);
});

test('reuses exact unaccelerated TS context/source and rejects ambiguous source translations', () => {
  const changedContext = cloneTs();
  changedContext['zh-Hans'] = changedContext['zh-Hans'].map(row =>
    row.context === 'MenuBarManager' && row.source === 'Show in Scene Window'
      ? { ...row, context: 'OtherMenu' } : row);
  assert.throws(() => generator.projectRows(DATA, {
    nativeEntries: APPROVED_NATIVE.entries, tsEntriesByLocale: changedContext,
  }), /approved Qt TS source is missing/);

  const ambiguous = cloneTs();
  ambiguous['zh-Hans'].push({
    context: 'MenuBarManager', source: 'Add to Duplicator', translation: '其他译文',
  });
  assert.throws(() => generator.projectRows(DATA, {
    nativeEntries: APPROVED_NATIVE.entries, tsEntriesByLocale: ambiguous,
  }), /ambiguous Qt TS translations/);

  const rows = projected();
  const showAttr = DATA.rows.find(row => row.callsite === 'showInAttributeEditor');
  assert.equal(showAttr.source, 'Show in Attribute Editor');
  assert.equal(showAttr.source.includes('&'), false);
  assert.equal(rows.find(row => row.identity === showAttr.identity).source, showAttr.source);
});

test('requires Lock Selected to retain the explicit AGY and baoyu refined review receipt', () => {
  const stale = cloneData();
  stale.rows.find(row => row.callsite === 'lockSelected')
    .sourceApproval.review.conversationId = 'stale-review';
  assert.throws(() => generator.projectRows(stale, {
    nativeEntries: APPROVED_NATIVE.entries, tsEntriesByLocale: TS_ENTRIES,
  }), /AGY\/baoyu refined source approval/);
});

test('rejects official catalog byte drift and emits a five-row C++ table', () => {
  const sourceBytes = Buffer.from('{"type":"strings"}');
  const japaneseBytes = Buffer.from('{"type":"strings","language":"ja"}');
  const record = {
    source: 'source.json', sourceSha256: crypto.createHash('sha256').update(sourceBytes).digest('hex'),
    japanese: 'ja.json', japaneseSha256: crypto.createHash('sha256').update(japaneseBytes).digest('hex'),
  };
  assert.deepEqual(generator.validateCatalogBytes(record, sourceBytes, japaneseBytes), {
    source: { type: 'strings' }, japanese: { type: 'strings', language: 'ja' },
  });
  assert.throws(() => generator.validateCatalogBytes(
    record, Buffer.from('{"type":"strings","stale":true}'), japaneseBytes),
  /English catalog SHA differs/);

  const table = generator.renderTable(projected());
  assert.match(table, /native_dg_context_menu::kRows/);
  assert.equal((table.match(/^    \{/gm) || []).length, 5);
  assert.match(table, /contract::kAddGroupActionReturnOffset/);
  assert.match(table, /\\u9501\\u5b9a\\u6240\\u9009\\u56fe\\u5c42/);

  const assetsDir = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'dg-menu-assets-test.'));
  const outDir = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'dg-menu-table-test.'));
  try {
    const out = path.join(outDir, 'table.inc');
    const argumentsOut = generator.parseArguments(['--assets-dir', assetsDir, '--out', out]);
    assert.equal(argumentsOut.outputFile, out);
    assert.throws(() => generator.parseArguments([
      '--assets-dir', assetsDir,
      '--out', path.join(REPO_ROOT, 'table.inc'),
    ]), /outside the repository/);
  } finally {
    fs.rmSync(assetsDir, { recursive: true, force: true });
    fs.rmSync(outDir, { recursive: true, force: true });
  }
});
