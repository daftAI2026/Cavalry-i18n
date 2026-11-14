#!/usr/bin/env node
/**
 * [INPUT]: 依赖十个完整owner的主代理审批、官方target域摘要helper、既有producer/格式门与同目录局部语义合同。
 * [OUTPUT]: 官方owner选择同时绑定catalogId，不混入同owner schema补充；分开锁定历史批准与201键/603现行决策摘要，保持完整source/notes/roles身份、display-only投影和真实旧译反向变异。
 * [POS]: tools 的十owner默认离线审批合同；缺模块/审批/显式注册必须失败，临时stage与私库不参与运行。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const { officialTargetSha256 } = require('./native_official_target');
const { buildNativeResourceBundle } = require('./native_resource_bundle');
const { assertNativeTranslationFormat } = require('./native_translation_format');
const {
  GENERIC_TAPER_KEYS,
  LOCALES: SEMANTIC_LOCALES,
  REPLACE_MISSING_KEYS,
  STAGGER_KEYS,
  assertAllSemanticContracts,
  assertLegacyV2Reversions,
  assertSemanticMutants,
  assertTrimTravelCopy,
} = require('./native_ten_owner_semantic_contract');

const LOCALES = Object.freeze(['zh-Hans', 'zh-Hant', 'ja_JP']);
const EXPECTED_SOURCE = Object.freeze({
  targetManifestSha256: "b6c6c6de1145035dc5ead1f21daf27d405de79fb70f430ecc828f6d09522be84",
  sourcePairLedgerSha256: "7bb4ebbffc4a9f2c89f3e0202cc7901bfa8a9e39a57fc2ab3448305d83f8ea31",
  sourceCatalogSha256: "d5c9d9e133d9e2fe7574c453aaa4f56803e7988f4314d2158562cb35c67cbec0",
  vendorJapaneseSha256: "7dc7377c54bb28ea7badcee124f8e5097f8d86f9694a37cc08c1c9b7800fc439",
  sourcePairsSha256: "d1be62e3aa1fb572d17d6b1dc2c5cd1a4071b12773f8cb3091fa09c88f7b81e8",
  identityAndNotesSha256: "f54dc9ad39f3a609c9c493f68accbaec191a4ee2971d57afc36a86ab143c4e10",
});
const EXPECTED_OWNERS = Object.freeze({
  "applyDistribution": { module: "nodes_apply_distribution", count: 16, keyset: "d5708ef0b67c4251f29ba0f940796c818f6a53473b5393c81a09c0b5934166b7", sourcePairs: "e8819571ab6523f408b337f0b37b063549c6da28e368279a820fa87f051622bc", identity: "fdd6b5895df8b0f07ea3f421c311314178a7807e429008f12eaab8629b0886aa", translations: "b4660ca7b5ab4ff4b8d2a38a3cac99ad8db5aae47a7aca7f4f1956d2fa3a62bc" },
  "applyLayout": { module: "nodes_apply_layout", count: 9, keyset: "3ce518f46d63b500f1d3fe8bafe55af20f135e44651dd23a1f3d5eb54ace16d5", sourcePairs: "59ec4db7ef00cdc7444dba1f8c3ff1969dbf69138db88ca30048d01a800cc8a0", identity: "2f04675784b012df0e423c35983ba23a13218a9e045d722dccff9a14061bc58e", translations: "e207fc677d0d89be99a265d519383d8ccd6a2ce9e81095aa9cea4935bdb58ecf" },
  "bevel": { module: "nodes_bevel", count: 15, keyset: "50a5aab36367b7e37c4166de2b814bec6854113543c6492542672cd12dd3e158", sourcePairs: "dec72a4e3e365983784fb2ea5901e2d48673c5ebe6fa88f68b8d900325d49cb1", identity: "f2aaf9526803b397df484f499acf3948245df4d7182fe7caca24b264d20c47c7", translations: "bb49e98a7fe749307f2941207e06048b96617e99aacbd41412ae36aca214491b" },
  "boolean": { module: "nodes_boolean", count: 3, keyset: "ab353799fa0bb031a5275e059d0ea3221434701b43148aa588acf6e5ce4816c8", sourcePairs: "97e64ff80baf6b50202ef6e806a28176a402e5a5ac693640a2d96ad8ecd9d943", identity: "0ff6b892e0a02adc710de813ca63f827cfe36161b7f1ede71e18fb5508e8b684", translations: "7a8ec06035851fcba48929c524fc9c1dbb926bcb692a2aaf0ad12b5aa75ab0f2" },
  "chopPath": { module: "nodes_chop_path", count: 16, keyset: "5fcab5de21bf797561fed08f4a346d2ddc08472bc4d05f9cf70551840d89c3c3", sourcePairs: "5e4a305d115e9324d35b51f37e7cd3ecb087450e867f35154cd43ea363f73442", identity: "4e6c1de243022bddab681055e24bc4321e6e4244949432672c3cbd1d97244ac0", translations: "4a0326128a90204528a0d337c71d4d618f0cd7167964315c45f64b9f3d40f6bf" },
  "colorMaterial": { module: "nodes_color_material", count: 5, keyset: "80578810d9a0f9141d417e3583c969d44531372b186030f61b0e740063139263", sourcePairs: "4683309574fd5b5f53c0056448de3f80b48b7dcfd73e2dbb39bd6504da20df7b", identity: "a2723a62b622198e56b8f0b96133d6830e0b5f59c48e876987b1fa32fc36924d", translations: "6bc820ddbad84bbb7cf4b69887021bb339b6bc92c6295e873d09daf9f0d6b6ca" },
  "countSubMeshes": { module: "nodes_count_sub_meshes", count: 10, keyset: "dc8a75802ee47c649c0b9c6242a5a66d06e024b9f5f96b162d6b11f1106a3108", sourcePairs: "f6b19ac0be57335c16f4391bf72f1c6bfe599a543db3644bea5f4e82ee475f9c", identity: "46c1ec15e8053f2a446e36a246e2b98f31fb4c9f54ed962e447f1341dfb177da", translations: "baf1eeb30ab595aa7b00a39ab4dad96608705c3727668b9cbb6b54022b2b4762" },
  "materialBehaviourHSV": { module: "nodes_material_behaviour_hsv", count: 5, keyset: "c27d2630a1ea4f2a051fa58f82084a9e4f2a08802a54c7edf72d9e1b092422f5", sourcePairs: "c5db50598a7223b5622c1d8ba1d808e944a17cfd46983fa9a92104a7b7ab780d", identity: "6ae5adf16cb49ba6896464661b5bab5ca74d48feefb4532fee5569709eaeaef6", translations: "955f2b15008f622383d793e0c4faf4e5977d2c04af6cb7161f363b5f1cf56220" },
  "strokeMaterial": { module: "nodes_stroke_material", count: 54, keyset: "a08f63ae1737aa8f3e91b370ccbce623f89fba7dd5325c42dcde3e54653e67a8", sourcePairs: "c1a35ac1209d5e91191da4b079dff0494f3e52589445818160043a3980a019ff", identity: "8befdc2e311a70b331018815228197a8580e18a80e68ec2886eec80af80b1552", translations: "470a3d5b6eede2cb1f2099729e5a84813b9dbcdc22bb5955771ec11e1932ad1b" },
  "subMesh": { module: "nodes_sub_mesh", count: 68, keyset: "692acf1976b7a8ac73ed9285728eade0cbdd9ed9c077423310374da47c527b69", sourcePairs: "07ec41e83ec014b658f4a922242ed5b23b0c717d6f742c529363bc1488cced12", identity: "67edd38b2f46caa47c2aa1c42473d31dae460e87de7a7160368f78884d0b1fb5", translations: "be14ddb3a7220d8dc8974a37a0b69884bdeb90519db7ac42a039ac21fb492b80" },
});
// 历史批准文本摘要保全；现行文本由EXPECTED_OWNERS及本轮graphicsReaudit另锁。
const HISTORICAL_TRANSLATION_DIGESTS = Object.freeze({"chopPath":"c5c322e1c1ce11fbed4e3950e90dec92939da8d5162b9194b0190638f29a0366","subMesh":"e13afbe6512e7e751e6cc287e34ad05a014287c1814885c458726958410a728a"});
const EXPECTED_TRANSLATION_DIGEST = "58de72da2b390d9bad01298d55e4d7aab625ddf4a419136a212b20433e2c340b";
const ROOT_APPROVAL = Object.freeze({
  state: 'approved-source-bound-display-input',
  approvalSha256: 'b6330d7113e0140f9766025882c66049f9e0b2550a2185447c3fa8c806abb589',
  receiptSha256: '6b9669a3367e7f33a5444cc0e2f7ccbd908c2e5b5741965979d8403e17a75aee',
  approvedAt: '2026-10-03T13:09:38.748Z',
});
const EXPECTED_ALPHA_PRESERVES = Object.freeze({
  "colorMaterial": "nodeAttr:colorMaterial.alpha",
  "strokeMaterial": "nodeAttr:strokeMaterial.alpha"
});
const SOURCE_CATALOG_ID = 'Definitions/Translation/nodeStrings';
const NATIVE_DIRECTORY = path.resolve(__dirname, '../languages/native');
const TARGET_PATH = path.resolve(__dirname, 'fixtures/cavalry_native_target_2_8_0.json');
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const digest = value => sha(JSON.stringify(value));
const compare = (left, right) => left < right ? -1 : left > right ? 1 : 0;
const ownerSpecs = Object.entries(EXPECTED_OWNERS);

function identityTuple(row) {
  return [row.key, row.catalogId, row.owner, row.fieldPath, row.source, row.notes,
    row.sourceRole ?? null, row.displayRole ?? null, row.dontTranslate ?? false, row.vendorJapanese ?? null];
}
function sortedEntries(entries) { return [...entries].sort((left, right) => compare(left.key, right.key)); }
function localeRows(entries) {
  return sortedEntries(entries).flatMap(row => LOCALES.map(locale => [
    row.key, locale, row.translations[locale].decision, row.translations[locale].text,
  ]));
}
function translationDigest(entries) { return digest(localeRows(entries)); }
function loadApprovedModules() {
  const result = [];
  for (const [owner, spec] of ownerSpecs) {
    const file = path.join(NATIVE_DIRECTORY, `${spec.module}.js`);
    assert.ok(fs.existsSync(file), `RED: formally approved owner module missing: ${file}`);
    const data = require(file);
    assert.ok(Array.isArray(data.entries), `${owner} module must export entries`);
    result.push({ owner, ...spec, data });
  }
  return result;
}
function allBatchEntries(modules = loadApprovedModules()) {
  return modules.flatMap(({ data }) => data.entries);
}
function assertFormalRegistration(modules) {
  const registry = require('../languages/native/approved_modules');
  for (const [owner, spec] of Object.entries(EXPECTED_OWNERS)) {
    assert.ok(registry.APPROVED_MODULES.includes(spec.module), `${owner} must be explicitly registered`);
  }
  assert.equal(new Set(registry.APPROVED_MODULES).size, registry.APPROVED_MODULES.length,
    'explicit approval registry has no duplicate module names');
  const registered = registry.approvedEntries();
  assert.equal(new Set(registered.map(row => row.key)).size, registered.length,
    'the current registered native key set has no collisions');
  const owners = new Set(Object.keys(EXPECTED_OWNERS));
  const selected = registered.filter(row => row.catalogId === 'Definitions/Translation/nodeStrings' && owners.has(row.owner));
  assert.equal(selected.length, 201, 'the ten registered full owners expose exactly 201 source keys');
  assert.deepEqual(selected.map(row => row.key).sort(compare), allBatchEntries(modules).map(row => row.key).sort(compare));
}
function assertSourceAndProvenance(modules) {
  const targetBytes = fs.readFileSync(TARGET_PATH);
  const target = JSON.parse(targetBytes);
  assert.equal(officialTargetSha256(targetBytes), EXPECTED_SOURCE.targetManifestSha256, 'historical native target manifest digest');
  const catalog = target.catalogs.find(row => row.id === SOURCE_CATALOG_ID);
  assert.ok(catalog, 'official nodeStrings target exists');
  assert.equal(catalog.sourceSha256, EXPECTED_SOURCE.sourceCatalogSha256);
  assert.equal(catalog.japaneseSha256, EXPECTED_SOURCE.vendorJapaneseSha256);
  assert.equal(catalog.source, 'Definitions/Translation/nodeStrings_en-GB.source.json');
  assert.equal(catalog.japanese, 'Definitions/Translation/nodeStrings_ja-JP.translation.json');
  const all = allBatchEntries(modules);
  assert.equal(all.length, 201);
  assert.equal(new Set(all.map(row => row.key)).size, 201);
  assert.equal(digest(sortedEntries(all).map(row => [row.key, row.source])), EXPECTED_SOURCE.sourcePairsSha256);
  assert.equal(digest(sortedEntries(all).map(identityTuple)), EXPECTED_SOURCE.identityAndNotesSha256);
  for (const { owner, module, count, keyset, sourcePairs, identity, translations, data } of modules) {
    const entries = data.entries;
    const provenance = data.provenance;
    assert.equal(provenance.approvalState, ROOT_APPROVAL.state, `${owner} is approved as source-bound display input only`);
    assert.equal(provenance.quotaFallback, true, `${owner} records the actual Luna quota fallback`);
    assert.equal(provenance.draftProvider, 'Grok CLI');
    assert.equal(provenance.draftTerminalResultObserved, false, 'Grok draft was nonterminal and is not claimed final');
    assert.equal(provenance.revisionProvider, 'GPT-6 Luna Max');
    assert.equal(provenance.independentReviewProvider, 'GPT-6 Luna Max');
    assert.equal(provenance.independentFullReviewCount, 2);
    assert.equal(provenance.supplementaryReviewProvider, 'AGY CLI');
    assert.equal(provenance.supplementaryReviewStatus, 'not-yet-captured; not used as a passed gate');
    assert.equal(provenance.approvedBy, 'primary-agent');
    assert.equal(provenance.approvalKind, 'source-bound display input only');
    assert.equal(provenance.approvalArtifactSha256, ROOT_APPROVAL.approvalSha256);
    assert.equal(provenance.approvalReceiptSha256, ROOT_APPROVAL.receiptSha256);
    assert.equal(provenance.approvedAt, ROOT_APPROVAL.approvedAt);
    assert.equal(provenance.owner, owner);
    assert.equal(provenance.keyCount, count);
    assert.equal(provenance.decisionSlotCount, count * 3);
    assert.equal(provenance.cavalryVersion, '2.8.0');
    assert.equal(provenance.catalogPath, catalog.source);
    assert.equal(provenance.sourceSha256, catalog.sourceSha256);
    assert.equal(provenance.vendorJapanesePath, catalog.japanese);
    assert.equal(provenance.vendorJapaneseSha256, catalog.japaneseSha256);
    assert.equal(provenance.officialTargetManifestSha256, EXPECTED_SOURCE.targetManifestSha256);
    assert.equal(provenance.officialSourcePairLedgerSha256, EXPECTED_SOURCE.sourcePairLedgerSha256);
    assert.equal(entries.length, count, `${owner} complete owner leaf count`);
    assert.deepEqual(entries.map(row => row.key), sortedEntries(entries).map(row => row.key));
    assert.equal(new Set(entries.map(row => row.key)).size, count);
    assert.equal(digest(entries.map(row => row.key)), keyset);
    assert.equal(digest(entries.map(row => [row.key, row.source])), sourcePairs);
    assert.equal(digest(entries.map(identityTuple)), identity);
    assert.equal(provenance.sourcePairsSha256, sourcePairs);
    assert.equal(provenance.sourceIdentityAndNotesSha256, identity);
    assert.equal(provenance.translationDecisionsSha256, HISTORICAL_TRANSLATION_DIGESTS[owner] || translations);
    assert.ok(entries.every(row => row.owner === owner && row.catalogId === SOURCE_CATALOG_ID));
    assert.ok(entries.every(row => Array.isArray(row.fieldPath) && Array.isArray(row.notes)));
    assert.ok(entries.every(row => typeof row.sourceRole === 'string' && typeof row.displayRole === 'string'));
    assert.ok(entries.every(row => row.vendorJapanese === row.source && row.vendorJapaneseChanged === false));
    assert.ok(entries.every(row => row.dontTranslate === false));
    assert.ok(entries.every(row => !Object.hasOwn(row, 'reason') && !Object.hasOwn(row, 'oldCandidates')),
      'rationale and old candidate evidence stay outside the runtime producer module');
  }
  assert.equal(all.filter(row => row.dontTranslate === true).length, 0);
}
function assertLocaleDecisions(modules) {
  const all = allBatchEntries(modules);
  const decisionCounts = Object.fromEntries(LOCALES.map(locale => [locale, { translate: 0, preserve: 0 }]));
  let slots = 0;
  for (const { owner, data } of modules) {
    assert.deepEqual(Object.keys(data.entries[0].translations).sort(), [...LOCALES].sort());
    for (const row of data.entries) {
      assert.deepEqual(Object.keys(row.translations).sort(), [...LOCALES].sort(), `${row.key} has exactly three locale decisions`);
      for (const locale of LOCALES) {
        const decision = row.translations[locale];
        assert.ok(decision && ['translate', 'preserve'].includes(decision.decision), `${row.key}/${locale} decision`);
        assert.equal(typeof decision.text, 'string');
        assert.ok(decision.text.trim(), `${row.key}/${locale} text`);
        if (decision.decision === 'preserve') assert.equal(decision.text, row.source, `${row.key}/${locale} source preserve`);
        else assert.notEqual(decision.text, row.source, `${row.key}/${locale} translated display copy`);
        assertNativeTranslationFormat(row.source, decision.text);
        decisionCounts[locale][decision.decision] += 1;
        slots += 1;
      }
    }
    assert.equal(translationDigest(data.entries), EXPECTED_OWNERS[owner].translations, `${owner} exact locale text snapshot`);
  }
  assert.equal(slots, 603, '201 complete keys × 3 locales');
  assert.deepEqual(decisionCounts, {
    'zh-Hans': { translate: 199, preserve: 2 },
    'zh-Hant': { translate: 199, preserve: 2 },
    ja_JP: { translate: 199, preserve: 2 },
  });
  assert.equal(translationDigest(all), EXPECTED_TRANSLATION_DIGEST, 'all 603 locale decisions are exact and source-order bound');
  for (const [owner, key] of Object.entries(EXPECTED_ALPHA_PRESERVES)) {
    const row = all.find(entry => entry.key === key);
    assert.equal(row.owner, owner);
    for (const locale of LOCALES) {
      assert.equal(row.translations[locale].decision, 'preserve');
      assert.equal(row.translations[locale].text, row.source);
    }
  }
}
function assertTranslationSnapshot(entries) {
  assert.equal(translationDigest(entries), EXPECTED_TRANSLATION_DIGEST,
    'translation snapshot rejects any locale decision/text drift');
}
function syntheticNodeStrings(entries) {
  const values = new Map();
  for (const row of entries) {
    const value = values.get(row.owner) || { nodeType: row.owner, fixtureModelIdentity: `identity:${row.owner}` };
    values.set(row.owner, value);
    let cursor = value;
    for (const part of row.fieldPath.slice(0, -1)) cursor = cursor[part] ??= {};
    const leaf = row.fieldPath.at(-1);
    assert.equal(Object.hasOwn(cursor, leaf), false, `${row.key} fixture field path is unique`);
    cursor[leaf] = { 'UI-text': row.source, notes: [...row.notes] };
  }
  return [...values.values()].map(value => ({ type: 'nodeStrings', value }));
}
function assertDisplayProjection(modules) {
  const entries = allBatchEntries(modules);
  const sourceCatalog = syntheticNodeStrings(entries);
  const sourceBefore = structuredClone(sourceCatalog);
  const pairs = [{ id: SOURCE_CATALOG_ID, source: sourceCatalog, japanese: [] }];
  const { manifest, packs } = buildNativeResourceBundle(pairs, entries);
  assert.equal(manifest.nativeKeys, 201);
  assert.equal(manifest.approvedUIKeys, 201);
  assert.equal(manifest.complete, true);
  for (const locale of LOCALES) {
    const pack = JSON.parse(packs[locale]);
    assert.equal(pack.length, 1);
    assert.equal(pack[0].language, locale === 'ja_JP' ? 'ja' : locale);
    assert.equal(pack[0].type, 'strings');
    assert.equal(Object.keys(pack[0].value).length, 201);
    for (const row of entries) {
      assert.deepEqual(pack[0].value[row.key], { 'UI-text': row.translations[locale].text }, `${row.key}/${locale} is display-only projection`);
    }
    assert.deepEqual(sourceCatalog, sourceBefore, `${locale} producer leaves source catalogs immutable`);
    for (const value of sourceCatalog.map(record => record.value)) {
      assert.equal(value.fixtureModelIdentity, `identity:${value.nodeType}`, 'model identity remains unchanged');
    }
  }
}

test('all ten full-owner modules are present and explicitly registered', () => {
  const modules = loadApprovedModules();
  assertFormalRegistration(modules);
});
test('ten owners bind the exact official source, notes, owner/fieldPath and display roles', () => {
  assertSourceAndProvenance(loadApprovedModules());
});
test('all 603 locale slots have exact source-preserve/translation decisions and valid format', () => {
  assertLocaleDecisions(loadApprovedModules());
});
test('the full 201-owner baseline passes before owner-local source-preserve mutants are rejected', () => {
  const baselineModules = loadApprovedModules();
  assertLocaleDecisions(baselineModules);
  const baseline = allBatchEntries(baselineModules);
  assertTranslationSnapshot(baseline);
  for (const module of baselineModules) for (const locale of LOCALES) {
    const changed = structuredClone(baseline);
    const target = changed.find(row => row.owner === module.owner && row.translations[locale].decision === 'translate');
    assert.ok(target, `${module.owner}/${locale} has an actual translated positive baseline`);
    const before = target.translations[locale].text;
    target.translations[locale].text = target.source;
    assert.notEqual(target.translations[locale].text, before, 'mutant changes the actual locale text');
    assert.throws(() => assertTranslationSnapshot(changed), assert.AssertionError,
      `${module.owner}/${locale} mutated locale copy is rejected after its positive baseline passed`);
  }
});
test('Stagger labels follow current Auto Animate terminology; Taper and missing-material promises stay scoped', () => {
  const modules = loadApprovedModules();
  const entries = allBatchEntries(modules);
  const autoEntries = require('../languages/native/nodes_auto_animate').entries;
  assert.equal(SEMANTIC_LOCALES.length, 3);
  assert.equal(STAGGER_KEYS.length, 9);
  assert.equal(GENERIC_TAPER_KEYS.length, 2);
  assert.equal(REPLACE_MISSING_KEYS.length, 2);
  assertAllSemanticContracts(entries, autoEntries);
});
test('single-slot semantic mutants fail only after their full positive semantic baseline passes', () => {
  const entries = allBatchEntries(loadApprovedModules());
  const autoEntries = require('../languages/native/nodes_auto_animate').entries;
  assert.equal(assertSemanticMutants(entries, autoEntries), 58,
    '52 scoped regressions plus 6 independently observed caption counterexamples; not a universal NLP oracle');
});
test('Travel wording is an accepted copy regression with source-defined spatial scope', () => {
  const entries = allBatchEntries(loadApprovedModules());
  for (const locale of ['zh-Hans', 'zh-Hant']) assertTrimTravelCopy(entries, locale);
});
test('all 39 source-bound real V2 old values fail one slot at a time after the same accepted-copy guard passes', () => {
  const entries = allBatchEntries(loadApprovedModules());
  const autoEntries = require('../languages/native/nodes_auto_animate').entries;
  assert.equal(assertLegacyV2Reversions(entries, autoEntries), 39,
    '31 required Stagger/Taper deltas plus 8 selected Travel/Replace Missing copy regressions');
});
test('native producer projects only locale display values and preserves model identity', () => {
  assertDisplayProjection(loadApprovedModules());
});
