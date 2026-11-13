/**
 * [INPUT]: 依赖批准模块、官方100项DNT身份表与原生资源producer的纯投影接口
 * [OUTPUT]: 锁定300个三语值、完整官方身份、精确DNT例外与production profile透传
 * [POS]: tools 的源绑定数据合同；合成官方catalog，不生成磁盘包或启动Cavalry
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const { APPROVED_MODULES, approvedEntries } = require('../languages/native/approved_modules');
const demoMenus = require('../languages/native/official_demo_menus');
const { OFFICIAL_DEMO_SCENE_DNT_IDENTITIES } = require('./native_demo_scene_dnt_identities');
const { collectNativeCatalog, nativeSourceIdentitySha256 } = require('./native_language_pack');
const { buildNativeResourceBundle } = require('./native_resource_bundle');

const CATALOG = 'Definitions/Translation/appStrings';
const LOCALES = ['zh-Hans', 'zh-Hant', 'ja_JP'];

function makeFixture(entries) {
  const source = {};
  const japanese = {};
  for (const row of entries) {
    source[row.key] = {
      'UI-text': row.source,
      notes: row.notes,
      dontTranslate: row.dontTranslate,
    };
    japanese[row.key] = { 'UI-text': row.vendorJapanese };
  }
  return [{
    id: CATALOG,
    source: [{ type: 'strings', value: source }],
    japanese: [{ type: 'strings', language: 'ja-JP', value: japanese }],
  }];
}

function nativeIdentity(row) {
  const identity = {};
  for (const field of ['catalogId', 'key', 'fieldPath', 'source', 'notes', 'dontTranslate', 'vendorJapanese']) {
    if (Object.hasOwn(row, field)) identity[field] = row[field];
  }
  return identity;
}

test('approved module contains 100 complete official leaves and 300 exact locale decisions', () => {
  const { entries, DEMO_MENU_DNT_KEYS, provenance } = demoMenus;
  const keys = entries.map(row => row.key);
  const slots = entries.reduce((count, row) => count + Object.keys(row.translations).length, 0);

  assert.equal(entries.length, 100);
  assert.equal(new Set(keys).size, 100);
  assert.equal(slots, 300);
  assert.deepEqual(DEMO_MENU_DNT_KEYS, keys);
  assert.equal(provenance.approvalState, 'root-approved-menu-text-only');
  assert.equal(provenance.officialScripts, 100);
  assert.equal(provenance.translationSlots, 300);
  assert.match(provenance.approvalFileSha256, /^[a-f0-9]{64}$/);
  assert.ok(!keys.includes('demoScene.javascript'));
  assert.ok(!keys.includes('demoScene.audio.audioSolver'));

  const [fixture] = makeFixture(entries);
  const collected = collectNativeCatalog(CATALOG, fixture.source, fixture.japanese).entries;
  const byKey = new Map(collected.map(row => [row.key, row]));
  for (const row of entries) {
    assert.equal(row.dontTranslate, true, row.key);
    assert.deepEqual(nativeIdentity(row), byKey.get(row.key), row.key);
    assert.equal(nativeSourceIdentitySha256(row), OFFICIAL_DEMO_SCENE_DNT_IDENTITIES[row.key], row.key);
    assert.deepEqual(Object.keys(row.translations).sort(), [...LOCALES].sort(), row.key);
    for (const locale of LOCALES) {
      assert.deepEqual(row.translations[locale], {
        decision: 'translate', text: row.translations[locale].text,
      }, `${row.key}:${locale}`);
      assert.ok(row.translations[locale].text.trim(), `${row.key}:${locale}`);
      assert.notEqual(row.translations[locale].text, row.source, `${row.key}:${locale}`);
    }
  }
});

test('approved assembly totals 10753 unique keys while the default builder keeps DNT closed', () => {
  assert.equal(APPROVED_MODULES.length, 82);
  assert.ok(APPROVED_MODULES.includes('official_demo_menus'));
  const approvals = approvedEntries();
  assert.equal(approvals.length, 10753);
  assert.equal(new Set(approvals.map(row => row.key)).size, 10753);

  const pairs = makeFixture(demoMenus.entries);
  const defaultBuild = buildNativeResourceBundle(pairs, demoMenus.entries);
  assert.equal(defaultBuild.manifest.approvedUIKeys, 100);
  for (const locale of LOCALES) {
    assert.equal(defaultBuild.manifest.packs[locale].preserved, 100);
    assert.equal(defaultBuild.manifest.packs[locale].reviewed, 0);
  }
});

test('asset-root production path opts in only through the approved demo module', () => {
  const pairs = makeFixture(demoMenus.entries);
  const result = buildNativeResourceBundle(pairs, demoMenus.entries,
    undefined, [], demoMenus.DEMO_MENU_DNT_KEYS);
  assert.equal(result.manifest.approvedUIKeys, 100);
  assert.equal(result.manifest.nativeKeys, 100);

  for (const locale of LOCALES) {
    const pack = JSON.parse(result.packs[locale])[0].value;
    assert.equal(Object.keys(pack).length, 100);
    assert.equal(result.manifest.packs[locale].reviewed, 100);
    assert.equal(result.manifest.packs[locale].preserved, 0);
    for (const row of demoMenus.entries) {
      assert.equal(pack[row.key]['UI-text'], row.translations[locale].text, `${row.key}:${locale}`);
    }
  }

  const producer = fs.readFileSync(path.join(__dirname, 'native_resource_bundle.js'), 'utf8');
  assert.match(producer,
    /buildNativeResourceBundle\(pairs, approvedEntries\(target\.cavalryVersion\), undefined, supplements, DEMO_MENU_DNT_KEYS, profile\)/,
    'buildFromAssetRoot must use the narrowly approved producer');
});
