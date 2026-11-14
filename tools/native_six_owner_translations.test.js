#!/usr/bin/env node
/**
 * [INPUT]: 依赖六完整owner的根审批显示模块、显式registry、官方target域摘要helper、DNT一致的合成源及公有格式/有限语义合同与producer。
 * [OUTPUT]: 官方owner选择同时绑定catalogId，不混入同owner schema补充；锁定200键/600槽source identity、DNT/技术保留、格式、源note语义和合成fixture上的display-only投影。
 * [POS]: 六owner的默认source-bound合同；固定审定值/有限反例只证明离线200键显示输入，不是通用NLP或真实Cavalry运行证据。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const { officialTargetSha256 } = require('./native_official_target');
const REPO_ROOT = path.resolve(__dirname, '..');
const APPROVAL_SHA256 = '5d6bcbc40285ff92336bb30347e255fe94d890de140f1d69ec25d66ace215196';
const SPECS = Object.freeze({
  applyCharacterSpacing: { file: 'nodes_apply_character_spacing', count: 8 },
  falloff: { file: 'nodes_falloff', count: 45 },
  pathSplit: { file: 'nodes_path_split', count: 47 },
  fourPointWarp: { file: 'nodes_four_point_warp', count: 43 },
  barChart: { file: 'nodes_bar_chart', count: 13 },
  ditheringFilter: { file: 'nodes_dithering_filter', count: 44 },
});
const LOCALES = Object.freeze(['zh-Hans', 'zh-Hant', 'ja_JP']);
const SOURCE = Object.freeze({
  manifestSha256: 'b6c6c6de1145035dc5ead1f21daf27d405de79fb70f430ecc828f6d09522be84',
  sourceJsonSha256: 'd9621efd4a442435b3699c6fe5f76aef0d1ae31ed47cfc28c2970d69a213cc12',
  sourceCatalogSha256: 'd5c9d9e133d9e2fe7574c453aaa4f56803e7988f4314d2158562cb35c67cbec0',
  vendorJapaneseSha256: '7dc7377c54bb28ea7badcee124f8e5097f8d86f9694a37cc08c1c9b7800fc439',
  sourcePairsSha256: '366f129add2a80afa7366ec5bfc5815da27bdb974363fec9597d558ef6569a12',
  identityAndNotesSha256: 'c69c91fc087dc8bd58da35ffaea5afc52d3ca8d1e595b8cddaa38deac176d5f1',
  sourceKeysetSha256: 'c9a96d7d0d297e607ac0cc39afe5dd7a67dbb37f6a656a14c09956f343f411bf',
  ownerDigests: {
    applyCharacterSpacing: { keys: '9097895aeb18fd663eb181d8ee584e856120e2d678bbaa0f4a36d67340f301b7', source: '55bc8037ef991b597773b9547b8094343f893f6f027c1332f9bd5cd1ad081315', identity: '6393451168b1d0eeb29328f9f7a385b8238a3e58230ff493ede2c7e00d0d0bc9', translations: '4bff9c9d6e2bd5ebf2b518ae79f65a1f1882c1ec52550755f37cab338d1e0ae0' },
    falloff: { keys: '1c74e4d88f031ebbe5b7886802195ddd294001a32a19d3b3913831bb38e4cd41', source: 'b5394e2a630a829f55e8a0323d8137f37bfca5476a4092ddc2ad5a198bd11b59', identity: '4c810623c2cd242a16c52039b17db42b2b5bf3c98c255c30aad02192f1714b44', translations: '53a6367e85fb9e818a4b0194188e17cd2ad898eb8d16d6f2249a129d47caedd4' },
    pathSplit: { keys: '6c1ff41848b6c8230333711bb4c80aa2626091f501f33fd0469e473c7eb8f3e9', source: '95357090520be70f0abda5ce706e76cfc22ac2f81f1690b3bd4a4e8fffc08b1e', identity: '74e881dbe8e5c8a686d626d64123bb915a59d35fc83720d906335f9ede235504', translations: '4140b60b133cd62c0b0e276d4b5f93dffcdcb4c819f316cb85eb53d0f1005c5c' },
    fourPointWarp: { keys: 'ee5800f653f5f71b2da16117e995ef6aedbaec98af06e02eb457b1546b0d8e26', source: 'f248a3bc04075e031d87b4eea8d3d4a69ab0471e5957c329da4d5e50d648a994', identity: '51e3e5fc0b5ba9f07f18f12f547dd5371d28b7a73377c67fb36cbb752acd7fb8', translations: '36e84653cf2c56130e275e25b834da25504b4c496d5b010d536ea7cb1340ee0b' },
    barChart: { keys: 'da9d169f1021f42821090a1a25a76b3c9c23ef3b0104ec7ee8318940fd1d5d22', source: 'ec74785b4cd7edc987e98a150e1136c89b843c2f5934628d31965c6c0e1d1d0b', identity: 'c7d424097c91544017e6122efbf37887232952d920e27c3b91b8af1a8cb8f777', translations: 'acbbe433e80397c68193aea2ffc88b66c9243361a4982a98d3d5d28c10c74c88' },
    ditheringFilter: { keys: '9e14d23af60d83167d0509a7a7c6adc69929a39e1d028a48739eef7c32c444c4', source: '9a125258be0f6c9609891b5d6d0c6f521ea42cc342ca42365f7808e2116a3ebb', identity: '78623fe86388a6c00c6145fde5c805fff6e0b5b5e680e4667257ee92c1c1a84b', translations: '6728b9c19a46e04143bd0e220a6a0b93d1bb9e6d6382179a2cac782f7e993730' },
  },
});
const SORT = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const sha = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const sorted = rows => [...rows].sort((a, b) => SORT(a.key, b.key));
function modulePath(owner) {
  return path.join(REPO_ROOT, 'languages/native', `${SPECS[owner].file}.js`);
}

function loadModules() {
  return Object.entries(SPECS).map(([owner, spec]) => {
    const file = modulePath(owner);
    assert.ok(fs.existsSync(file), `RED: complete six-owner candidate module missing: ${file}`);
    const data = require(file);
    assert.ok(Array.isArray(data.entries), `${owner} module exposes entries`);
    return { owner, ...spec, data };
  });
}
function allEntries(modules) { return modules.flatMap(module => module.data.entries); }
function identity(row) {
  return [row.key, row.catalogId, row.owner, row.fieldPath, row.source, row.notes,
    row.sourceRole, row.displayRole, row.dontTranslate, row.vendorJapanese ?? null];
}
function translationRows(entries) {
  return sorted(entries).flatMap(row => LOCALES.map(locale => [row.key, locale,
    row.translations[locale].decision, row.translations[locale].text]));
}
function translationDigest(entries) { return sha(translationRows(entries)); }
function approvedReferences() {
  const modules = {
    nodes_apply_opentype: require(path.join(REPO_ROOT, 'languages/native/nodes_apply_opentype.js')),
    nodes_text_shape: require(path.join(REPO_ROOT, 'languages/native/nodes_text_shape.js')),
    menus_file_edit_create_help: require(path.join(REPO_ROOT, 'languages/native/menus_file_edit_create_help.js')),
  };
  const registry = require(path.join(REPO_ROOT, 'languages/native/approved_modules.js'));
  const registryKeys = new Map(registry.approvedEntries().map(row => [row.key, row]));
  const references = [
    ['nodes_apply_opentype', 'nodeAttrEnum:applyOpenType.feature.52'],
    ['nodes_text_shape', 'nodeAttr:textShape.letterSpacing'],
    ['menus_file_edit_create_help', 'menu.create.camera'],
  ];
  for (const [moduleName, key] of references) {
    assert.ok(registry.APPROVED_MODULES.includes(moduleName), `${moduleName} is explicitly approved`);
    const local = modules[moduleName].entries.find(row => row.key === key);
    assert.ok(local, `${moduleName} owns current caption ${key}`);
    assert.deepEqual(registryKeys.get(key), local, `${key} is the registered current display caption`);
  }
  return { openType: modules.nodes_apply_opentype, textShape: modules.nodes_text_shape,
    camera: modules.menus_file_edit_create_help };
}
function assertExplicitRegistration(modules) {
  const registry = require(path.join(REPO_ROOT, 'languages/native/approved_modules.js'));
  for (const [owner, spec] of Object.entries(SPECS)) {
    assert.ok(registry.APPROVED_MODULES.includes(spec.file), `${owner} must be explicitly registered`);
  }
  assert.equal(new Set(registry.APPROVED_MODULES).size, registry.APPROVED_MODULES.length,
    'approval registry contains no duplicate module names');
  const registered = registry.approvedEntries();
  assert.equal(new Set(registered.map(row => row.key)).size, registered.length,
    'current registry has no duplicate source keys');
  const owners = new Set(Object.keys(SPECS));
  const selected = registered.filter(row => row.catalogId === 'Definitions/Translation/nodeStrings' && owners.has(row.owner));
  assert.equal(selected.length, 200);
  assert.deepEqual(sorted(selected), sorted(allEntries(modules)), 'registered source-bound rows equal the explicitly owned modules');
}
function assertSourceBinding(modules) {
  const entries = allEntries(modules);
  assert.equal(entries.length, 200);
  assert.equal(new Set(entries.map(row => row.key)).size, 200);
  const canonical = sorted(entries);
  assert.equal(sha(canonical.map(row => row.key)), SOURCE.sourceKeysetSha256);
  assert.equal(sha(canonical.map(row => [row.key, row.source])), SOURCE.sourcePairsSha256);
  assert.equal(sha(canonical.map(identity)), SOURCE.identityAndNotesSha256);
  const targetBytes = fs.readFileSync(path.join(REPO_ROOT, 'tools/fixtures/cavalry_native_target_2_8_0.json'));
  const target = JSON.parse(targetBytes);
  assert.equal(officialTargetSha256(targetBytes), SOURCE.manifestSha256);
  const catalog = target.catalogs.find(row => row.id === 'Definitions/Translation/nodeStrings');
  assert.equal(catalog.sourceSha256, SOURCE.sourceCatalogSha256);
  assert.equal(catalog.japaneseSha256, SOURCE.vendorJapaneseSha256);
  assert.ok(entries.every(row => row.catalogId === 'Definitions/Translation/nodeStrings'));
  assert.ok(entries.every(row => row.vendorJapanese === row.source && row.vendorJapaneseChanged === false));
  for (const module of modules) {
    const rows = module.data.entries;
    assert.equal(rows.length, module.count, `${module.owner} full source leaf count`);
    assert.deepEqual(rows.map(row => row.key), sorted(rows).map(row => row.key), `${module.owner} stable key order`);
    assert.equal(new Set(rows.map(row => row.key)).size, module.count);
    assert.equal(sha(rows.map(row => row.key)), SOURCE.ownerDigests[module.owner].keys);
    assert.equal(sha(rows.map(row => [row.key, row.source])), SOURCE.ownerDigests[module.owner].source);
    assert.equal(sha(rows.map(identity)), SOURCE.ownerDigests[module.owner].identity);
    assert.equal(translationDigest(rows), SOURCE.ownerDigests[module.owner].translations);
    assert.equal(module.data.provenance.owner, module.owner);
    assert.equal(module.data.provenance.keyCount, module.count);
    assert.equal(module.data.provenance.sourceJsonSha256, SOURCE.sourceJsonSha256);
    assert.equal(module.data.provenance.sourcePairsSha256, SOURCE.sourcePairsSha256);
    assert.equal(module.data.provenance.sourceIdentityAndNotesSha256, SOURCE.identityAndNotesSha256);
  }
  return entries;
}
function assertLocaleDecisions(modules) {
  const counts = Object.fromEntries(LOCALES.map(locale => [locale, { translate: 0, preserve: 0 }]));
  let slots = 0;
  const preserved = [];
  for (const { owner, data } of modules) for (const row of data.entries) {
    assert.deepEqual(Object.keys(row.translations).sort(SORT), [...LOCALES].sort(SORT), `${row.key} exact locale set`);
    for (const locale of LOCALES) {
      const decision = row.translations[locale];
      assert.ok(decision && ['translate', 'preserve'].includes(decision.decision), `${row.key}/${locale} explicit decision`);
      assert.equal(typeof decision.text, 'string');
      assert.ok(decision.text.trim(), `${row.key}/${locale} non-empty display candidate`);
      if (decision.decision === 'preserve') {
        assert.equal(decision.text, row.source, `${row.key}/${locale} preserve is exact source`);
        preserved.push([row.key, locale]);
      } else assert.notEqual(decision.text, row.source, `${row.key}/${locale} translated display slot`);
      if (row.dontTranslate) assert.equal(decision.decision, 'preserve', `${row.key}/${locale} DNT wins`);
      counts[locale][decision.decision] += 1;
      slots += 1;
    }
    assert.ok(!Object.hasOwn(row, 'reason') && !Object.hasOwn(row, 'oldCandidates'),
      'candidate reasoning and legacy candidate origins are not runtime module data');
  }
  assert.equal(slots, 600);
  assert.deepEqual(counts, {
    'zh-Hans': { translate: 198, preserve: 2 },
    'zh-Hant': { translate: 198, preserve: 2 },
    ja_JP: { translate: 198, preserve: 2 },
  });
  assert.deepEqual(preserved, [
    ...LOCALES.map(locale => ['nodeAttr:falloff.is3d', locale]),
    ...LOCALES.map(locale => ['nodeAttrEnum:ditheringFilter.pattern.2', locale]),
  ]);
  assert.equal(sorted(allEntries(modules)).filter(row => row.dontTranslate).length, 1);
  return { counts, slots, preserved };
}
function assertFormat(modules) {
  const { assertNativeTranslationFormat } = require(path.join(REPO_ROOT, 'tools/native_translation_format.js'));
  let checked = 0;
  for (const row of allEntries(modules)) for (const locale of LOCALES) {
    assertNativeTranslationFormat(row.source, row.translations[locale].text);
    checked += 1;
  }
  assert.equal(checked, 600);
  return checked;
}
function syntheticCatalog(entries) {
  const values = new Map();
  for (const row of entries) {
    const value = values.get(row.owner) || { nodeType: row.owner, fixtureModelIdentity: `identity:${row.owner}` };
    values.set(row.owner, value);
    let cursor = value;
    for (const part of row.fieldPath.slice(0, -1)) cursor = cursor[part] ??= {};
    const leaf = row.fieldPath.at(-1);
    assert.equal(Object.hasOwn(cursor, leaf), false, `${row.key} fixture field path is unique`);
    cursor[leaf] = {
      'UI-text': row.source,
      notes: [...row.notes],
      ...(row.dontTranslate === true ? { dontTranslate: true } : {}),
    };
  }
  return [...values.values()].map(value => ({ type: 'nodeStrings', value }));
}
function assertDisplayProjection(modules) {
  const entries = allEntries(modules);
  const source = syntheticCatalog(entries);
  const before = structuredClone(source);
  const pairs = [{ id: 'Definitions/Translation/nodeStrings', source, japanese: [] }];
  const { buildNativeResourceBundle } = require(path.join(REPO_ROOT, 'tools/native_resource_bundle.js'));
  const { manifest, packs } = buildNativeResourceBundle(pairs, entries);
  assert.equal(manifest.nativeKeys, 200);
  assert.equal(manifest.approvedUIKeys, 200);
  assert.equal(manifest.complete, true, 'synthetic fixture is complete only for its 200-key input');
  for (const locale of LOCALES) {
    const pack = JSON.parse(packs[locale]);
    assert.equal(Object.keys(pack[0].value).length, 200);
    for (const row of entries) assert.deepEqual(pack[0].value[row.key], { 'UI-text': row.translations[locale].text });
    assert.deepEqual(source, before, `${locale} projection is read-only`);
    for (const item of source) assert.equal(item.value.fixtureModelIdentity, `identity:${item.value.nodeType}`);
  }
}

test('six full owner source-bound modules carry real root approval and explicit registration', () => {
  const modules = loadModules();
  for (const module of modules) {
    const p = module.data.provenance;
    assert.equal(p.approvalState, 'approved-source-bound-display-input');
    assert.equal(p.registryState, 'registered-source-bound-display-input');
    assert.equal(p.sourceApprovalSha256, APPROVAL_SHA256);
    assert.equal(p.providerFinalResponseObserved, true);
    assert.equal(p.explicitEndTurnMetadataObserved, false);
    assert.equal(p.liveVerified, false);
  }
  assertExplicitRegistration(modules);
});
test('all 200 keys bind exact official source, roles, notes and source provenance', () => {
  const modules = loadModules();
  assertSourceBinding(modules);
  // -- 正向完整基线后逐槽破坏源/notes/角色和三语审定摘要 --------------
  for (let index = 0; index < modules.length; index += 1) {
    for (const field of ['source', 'notes', 'displayRole']) {
      assertSourceBinding(structuredClone(modules));
      const mutant = structuredClone(modules);
      const row = mutant[index].data.entries[0];
      row[field] = field === 'notes' ? [...row.notes, 'wrong note'] : row[field] + '-wrong';
      assert.throws(() => assertSourceBinding(mutant), assert.AssertionError);
    }
    for (const locale of LOCALES) {
      assertSourceBinding(structuredClone(modules));
      const mutant = structuredClone(modules);
      mutant[index].data.entries[0].translations[locale].text += ' wrong';
      assert.throws(() => assertSourceBinding(mutant), assert.AssertionError);
    }
  }
});
test('all 600 slots have explicit decisions, exact Bayer/2.5D preserve boundaries and valid format', () => {
  const modules = loadModules();
  assertLocaleDecisions(modules);
  assert.equal(assertFormat(modules), 600);
});
test('current candidate semantic baseline follows source notes and shared reviewed UI labels', () => {
  const modules = loadModules();
  const entries = assertSourceBinding(modules);
  require('./native_six_owner_semantic_contract').assertSemanticBaseline(entries, approvedReferences());
});
test('single-slot semantic reverse mutants fail only after each complete baseline passes', () => {
  const modules = loadModules();
  const entries = assertSourceBinding(modules);
  assertLocaleDecisions(modules);
  assert.equal(require('./native_six_owner_semantic_contract').assertSemanticMutants(entries, approvedReferences()), 63);
});
test('synthetic source-bound producer projection changes display packs only and preserves model identity', () => {
  assertDisplayProjection(loadModules());
});
