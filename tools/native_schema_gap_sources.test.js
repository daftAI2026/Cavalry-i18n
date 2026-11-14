/**
 * [INPUT]: 依赖固定365组与独立隐藏字段源行、target锁摘要及合成定义树。
 * [OUTPUT]: 保留365元组摘要，并验证当前366行投影和隐藏bool schema拒绝条件。
 * [POS]: source-only adapter合同；锁定hide=true且无UI自有字段，不批准候选或现场消费。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const { createHash } = require('node:crypto');
const {
  FIXED_GAP_LABELS,
  SOURCE_DEFINITIONS_SHA256,
  CORE_FALLBACK_SHA256,
  GAP_CATALOG_ID,
  FIXED_GAP_SOURCE_ROWS,
  FIXED_GAP_COUNT,
  BACKGROUND_RENDERING_GAP_COUNT,
  CURRENT_GAP_COUNT,
  BACKGROUND_RENDERING_GAP_SOURCE_ROW,
  CURRENT_GAP_SOURCE_ROWS,
  sourceEntries,
  validateGapEntries,
  validateGapDefinitions,
  validateBackgroundRenderingDefinition,
} = require('./native_schema_gap_sources');

const SOURCE_ROWS_SHA256 = 'd2f66a17f1a1fb9eddb26c0d8547088faa8fd99aebc7bd474d97246250f85f8f';
const TARGET_PATH = path.join(__dirname, 'fixtures/cavalry_native_target_2_8_0.json');
const sha256 = value => createHash('sha256').update(value).digest('hex');
const tupleKey = ([owner, attributeId]) => `${owner}\0${attributeId}`;

function definitionByType(definitions, nodeType) {
  return definitions.find(row => row.nodeType === nodeType);
}

function attributeOrderArrays(value, output = []) {
  if (Array.isArray(value)) {
    for (const child of value) attributeOrderArrays(child, output);
    return output;
  }
  if (!value || typeof value !== 'object') return output;
  for (const [key, child] of Object.entries(value)) {
    if (key === 'attributeOrder' && Array.isArray(child)) output.push(child);
    else attributeOrderArrays(child, output);
  }
  return output;
}

function syntheticDefinitions() {
  const inherited = new Set(FIXED_GAP_LABELS.slice(0, 13).map(tupleKey));
  const root = { nodeType: 'fixtureRoot', attributes: {} };
  const byOwner = new Map();

  FIXED_GAP_LABELS.forEach(([owner, attributeId], index) => {
    let definition = byOwner.get(owner);
    if (!definition) {
      definition = { nodeType: owner, attributes: {}, UI: { attributeOrder: [], tabs: [] } };
      byOwner.set(owner, definition);
    }
    if ([...inherited].some(key => key.startsWith(`${owner}\0`))) definition.superType = 'fixtureRoot';

    if (inherited.has(tupleKey([owner, attributeId]))) {
      root.attributes[attributeId] = { type: 'double' };
    } else if (index === 13) {
      definition.attributes[attributeId] = { type: 'list', child: { type: 'number' } };
    } else if (index === 14) {
      definition.attributes[attributeId] = { type: 'compound', children: { x: { type: 'number' } } };
    } else {
      definition.attributes[attributeId] = { type: 'number' };
    }

    if (index % 3 === 0) {
      definition.UI.attributeOrder.push(attributeId);
    } else if (index % 3 === 1) {
      definition.UI.tabs.push({ id: `tab-${index}`, attributeOrder: [attributeId] });
    } else {
      definition.UI.tabs.push({
        id: `layout-${index}`,
        layout: { rows: [{ columns: [{ attributeOrder: [attributeId] }] }] },
      });
    }
  });

  return [root, ...byOwner.values()];
}

function expectedGapRows() {
  return FIXED_GAP_LABELS.map(([owner, attributeId, source]) => ({
    key: `nodeAttr:${owner}.${attributeId}`,
    catalogId: 'schemaSupplement/nodeAttributes',
    owner,
    fieldPath: ['attributes', attributeId, 'name'],
    source,
    vendorJapanese: null,
    dontTranslate: false,
    notes: ['Cavalry 2.8 nodeDefinitions declares this Inspector attribute; English label is the verified Core fallback.'],
  }));
}

function expectedCurrentGapRows() {
  return [...expectedGapRows(), BACKGROUND_RENDERING_GAP_SOURCE_ROW];
}

function backgroundRenderingDefinitions() {
  return [
    { nodeType: 'element', attributes: {} },
    {
      nodeType: 'dynamicIndexManager', superType: 'element',
      attributes: { backgroundRendering: {
        type: 'bool', default: false, connectable: false, keyable: false, lockable: false,
      } },
      hide: true,
    },
  ];
}

function cloneGapRows(rows) {
  return rows.map(row => ({ ...row, fieldPath: [...row.fieldPath], notes: [...row.notes] }));
}

function removeDeclaredReference(definition, attributeId) {
  for (const order of attributeOrderArrays(definition.UI)) {
    for (let index = order.length - 1; index >= 0; index -= 1) {
      if (order[index] === attributeId) order.splice(index, 1);
    }
  }
}

test('fixed source rows keep the exact canonical 365-tuple identity', () => {
  assert.equal(FIXED_GAP_LABELS.length, 365);
  assert.ok(Object.isFrozen(FIXED_GAP_LABELS));
  assert.ok(FIXED_GAP_LABELS.every(row => Object.isFrozen(row) && row.length === 3
    && row.every(value => typeof value === 'string' && value.length > 0)));

  const keys = FIXED_GAP_LABELS.map(tupleKey);
  assert.equal(new Set(keys).size, 365, 'owner/id pairs are unique');
  assert.equal(new Set(FIXED_GAP_LABELS.map(([, attributeId]) => attributeId)).size, 238);
  assert.ok(FIXED_GAP_LABELS.every(([owner, attributeId]) =>
    /^[A-Za-z][A-Za-z0-9_]*$/.test(owner)
      && /^[A-Za-z][A-Za-z0-9_]*$/.test(attributeId)
      && !attributeId.includes('.')));
  assert.ok(FIXED_GAP_LABELS.every(([owner]) => owner !== 'forgeDynamicsShape'),
    'the separately reviewed eight-key Forge supplement is not part of this candidate table');

  const canonical = Buffer.from(`${JSON.stringify(FIXED_GAP_LABELS)}\n`);
  assert.equal(sha256(canonical), SOURCE_ROWS_SHA256);
});

test('source/Core digests remain the values locked by the native target', () => {
  const target = JSON.parse(fs.readFileSync(TARGET_PATH, 'utf8'));
  assert.equal(target.sourceFiles.find(row => row.path === 'Definitions/nodeDefinitions.json')?.sha256,
    SOURCE_DEFINITIONS_SHA256);
  assert.equal(target.runtimeFiles.find(row => row.path === 'Contents/Frameworks/libCore.dylib')?.sha256,
    CORE_FALLBACK_SHA256);
});

test('all fixed labels resolve through direct or inherited fields and recursive UI layouts', () => {
  const definitions = syntheticDefinitions();
  const rows = validateGapDefinitions(definitions, []);
  assert.strictEqual(rows, FIXED_GAP_LABELS);
  assert.equal(rows.length, 365);

  const firstInherited = FIXED_GAP_LABELS[0];
  const owner = definitionByType(definitions, firstInherited[0]);
  const root = definitionByType(definitions, 'fixtureRoot');
  assert.equal(owner.superType, 'fixtureRoot');
  assert.ok(Object.hasOwn(root.attributes, firstInherited[1]));
  assert.ok(definitions.some(row => Object.values(row.attributes || {}).some(field => field.type === 'list')));
  assert.ok(definitions.some(row => Object.values(row.attributes || {}).some(field => field.type === 'compound')));
});

test('the fixed inherited-field topology cannot silently drift', () => {
  const definitions = syntheticDefinitions();
  const [owner, id] = FIXED_GAP_LABELS[0];
  definitionByType(definitions, owner).attributes[id] = { type: 'double' };
  assert.throws(() => validateGapDefinitions(definitions, []), /inherited.*source row count differs/i);
});

test('unknown definition keys do not widen the fixed source-only allowlist', () => {
  const definitions = syntheticDefinitions();
  definitions.push({ nodeType: 'unreviewedOwner', attributes: { unreviewedId: { type: 'number' } },
    UI: { tabs: [{ layout: [{ attributeOrder: ['unreviewedId'] }] }] } });
  assert.strictEqual(validateGapDefinitions(definitions, []), FIXED_GAP_LABELS);
  assert.ok(!FIXED_GAP_LABELS.some(([owner, id]) => owner === 'unreviewedOwner' || id === 'unreviewedId'));
});

test('vendor nodeType index accepts numeric-leading owners and parent references', () => {
  const definitions = syntheticDefinitions();
  const [candidateOwner] = FIXED_GAP_LABELS[13];
  definitionByType(definitions, candidateOwner).superType = '3dMatrix';
  definitions.push({ nodeType: 'behaviour', superType: 'fixtureRoot', attributes: {}, UI: {} });
  definitions.push({ nodeType: '3dMatrix', superType: 'behaviour', attributes: {}, UI: {} });
  assert.strictEqual(validateGapDefinitions(definitions, []), FIXED_GAP_LABELS);
});

test('official collision evidence must be explicitly supplied', () => {
  const definitions = syntheticDefinitions();
  assert.throws(() => validateGapDefinitions(definitions), /official entries must be an array/i);
  assert.strictEqual(validateGapDefinitions(definitions, []), FIXED_GAP_LABELS);
});

test('duplicate and illegal nodeType owners fail closed', () => {
  const duplicate = syntheticDefinitions();
  duplicate.push(structuredClone(duplicate[1]));
  assert.throws(() => validateGapDefinitions(duplicate, []), /duplicate.*nodeType/i);

  const illegalOwner = syntheticDefinitions();
  illegalOwner.push({ nodeType: 'bad owner', attributes: {}, UI: {} });
  assert.throws(() => validateGapDefinitions(illegalOwner, []), /illegal.*owner/i);
});

test('missing parents and cyclic inheritance fail closed', () => {
  const missingParent = syntheticDefinitions();
  definitionByType(missingParent, 'fixtureRoot').superType = 'unresolvedParent';
  assert.throws(() => validateGapDefinitions(missingParent, []), /missing.*parent/i);

  const cycle = syntheticDefinitions();
  const firstOwner = definitionByType(cycle, FIXED_GAP_LABELS[0][0]);
  definitionByType(cycle, 'fixtureRoot').superType = firstOwner.nodeType;
  assert.throws(() => validateGapDefinitions(cycle, []), /cycle/i);
});

test('every candidate needs a resolvable field and an owner-local Inspector reference', () => {
  const missingField = syntheticDefinitions();
  const [fieldOwner, fieldId] = FIXED_GAP_LABELS[13];
  delete definitionByType(missingField, fieldOwner).attributes[fieldId];
  delete definitionByType(missingField, 'fixtureRoot').attributes[fieldId];
  assert.throws(() => validateGapDefinitions(missingField, []), /attribute.*unresolved/i);

  const missingUi = syntheticDefinitions();
  const [uiOwner, uiId] = FIXED_GAP_LABELS[0];
  removeDeclaredReference(definitionByType(missingUi, uiOwner), uiId);
  assert.throws(() => validateGapDefinitions(missingUi, []), /Inspector.*reference.*missing/i);
});

test('non-schema field values cannot satisfy a fixed candidate', () => {
  const [owner, id] = FIXED_GAP_LABELS[13];
  const invalidSchemas = [null, 'number', {}, { type: '' }, { label: 'not a schema' }];

  for (const invalidSchema of invalidSchemas) {
    const definitions = syntheticDefinitions();
    definitionByType(definitions, owner).attributes[id] = invalidSchema;
    assert.throws(() => validateGapDefinitions(definitions, []), /attribute.*schema.*invalid/i,
      `rejected invalid schema ${JSON.stringify(invalidSchema)}`);
  }
});

test('UI titles and arbitrary strings do not count as Inspector attributeOrder references', () => {
  const definitions = syntheticDefinitions();
  const [owner, id] = FIXED_GAP_LABELS[0];
  definitionByType(definitions, owner).UI = { title: id, description: `Field ${id}`, text: [id] };
  assert.throws(() => validateGapDefinitions(definitions, []), /Inspector.*reference.*missing/i);
});

test('cyclic Inspector layout objects fail closed', () => {
  const definitions = syntheticDefinitions();
  const [owner, id] = FIXED_GAP_LABELS[0];
  const cyclicLayout = { attributeOrder: [id] };
  cyclicLayout.self = cyclicLayout;
  definitionByType(definitions, owner).UI = { tabs: [cyclicLayout] };
  assert.throws(() => validateGapDefinitions(definitions, []), /cyclic Inspector layout/i);
});

test('direct and inherited official nodeAttr collisions are rejected', () => {
  const direct = syntheticDefinitions();
  const [owner, id] = FIXED_GAP_LABELS[20];
  assert.throws(() => validateGapDefinitions(direct, [{ key: `nodeAttr:${owner}.${id}` }]),
    /official.*collision/i);

  const inherited = syntheticDefinitions();
  const [child, inheritedId] = FIXED_GAP_LABELS[0];
  assert.throws(() => validateGapDefinitions(inherited, [{ key: `nodeAttr:fixtureRoot.${inheritedId}` }]),
    /official.*parent.*collision/i);
  assert.equal(definitionByType(inherited, child).superType, 'fixtureRoot');
});

test('fixed 365 source rows use the exact resource-bundle projection contract', () => {
  const expected = expectedGapRows();
  assert.equal(GAP_CATALOG_ID, 'schemaSupplement/nodeAttributes');
  assert.equal(FIXED_GAP_SOURCE_ROWS.length, 365);
  assert.ok(Object.isFrozen(FIXED_GAP_SOURCE_ROWS));
  assert.ok(FIXED_GAP_SOURCE_ROWS.every(row => Object.isFrozen(row)
    && Object.isFrozen(row.fieldPath) && Object.isFrozen(row.notes)));
  assert.deepEqual(FIXED_GAP_SOURCE_ROWS, expected);
  assert.equal(new Set(FIXED_GAP_SOURCE_ROWS.map(row => row.key)).size, 365);
  assert.ok(FIXED_GAP_SOURCE_ROWS.every(row => row.vendorJapanese === null && row.dontTranslate === false));
});

test('Background Rendering is one independent hidden source row, not part of the frozen 365', () => {
  assert.equal(FIXED_GAP_COUNT, 365);
  assert.equal(BACKGROUND_RENDERING_GAP_COUNT, 1);
  assert.equal(CURRENT_GAP_COUNT, 366);
  assert.equal(FIXED_GAP_SOURCE_ROWS.length, 365);
  assert.equal(CURRENT_GAP_SOURCE_ROWS.length, 366);
  assert.equal(validateBackgroundRenderingDefinition(backgroundRenderingDefinitions(), []),
    BACKGROUND_RENDERING_GAP_SOURCE_ROW);
  assert.deepEqual(BACKGROUND_RENDERING_GAP_SOURCE_ROW, {
    key: 'nodeAttr:dynamicIndexManager.backgroundRendering',
    catalogId: 'schemaSupplement/nodeAttributes',
    owner: 'dynamicIndexManager',
    fieldPath: ['attributes', 'backgroundRendering', 'name'],
    source: 'Background Rendering',
    vendorJapanese: null,
    dontTranslate: false,
    notes: ['Cavalry 2.8 nodeDefinitions declares this hidden boolean attribute with default false; the verified Core fallback is Background Rendering.'],
  });
});

test('Background Rendering rejects schema, hide/UI-field drift, and official collision', () => {
  const mutations = [
    definitions => { definitions[1].attributes.backgroundRendering.type = 'double'; },
    definitions => { definitions[1].attributes.backgroundRendering.default = true; },
    definitions => { definitions[1].attributes.backgroundRendering.connectable = true; },
    definitions => { definitions[1].attributes.backgroundRendering.keyable = true; },
    definitions => { definitions[1].attributes.backgroundRendering.lockable = true; },
    definitions => { definitions[1].hide = false; },
    definitions => { definitions[1].UI = null; },
    definitions => { definitions[1].UI = { attributeOrder: ['backgroundRendering'] }; },
    definitions => { definitions[1].superType = 'missingParent'; },
  ];
  for (const mutate of mutations) {
    const definitions = backgroundRenderingDefinitions();
    mutate(definitions);
    assert.throws(() => validateBackgroundRenderingDefinition(definitions, []));
  }
  assert.throws(() => validateBackgroundRenderingDefinition(backgroundRenderingDefinitions(), [
    { key: 'nodeAttr:dynamicIndexManager.backgroundRendering' },
  ]), /official.*collision/i);
  assert.throws(() => validateBackgroundRenderingDefinition(backgroundRenderingDefinitions(), [
    { key: 'nodeAttr:element.backgroundRendering' },
  ]), /official.*parent.*collision/i);
});

test('raw source adapter checks exact bytes digest before JSON parsing', () => {
  assert.throws(() => sourceEntries('[]', []), /raw bytes/i);
  assert.throws(() => sourceEntries(Buffer.from('{ malformed json'), []), /SHA-256 differs/i);
  assert.throws(() => sourceEntries(new Uint8Array([0x7b, 0x7d]), []), /SHA-256 differs/i);
});

test('gap-entry gate accepts current rows while preserving the fixed 365-row source table', () => {
  const definitions = syntheticDefinitions();
  assert.strictEqual(validateGapDefinitions(definitions, []), FIXED_GAP_LABELS);
  assert.equal(validateBackgroundRenderingDefinition(backgroundRenderingDefinitions(), []),
    BACKGROUND_RENDERING_GAP_SOURCE_ROW);
  const rows = expectedCurrentGapRows();
  const { FIXED_SOURCE_ROWS } = require('./native_schema_supplement');
  const validated = validateGapEntries(rows, [], { existingSupplementEntries: FIXED_SOURCE_ROWS });
  assert.deepEqual(validated, rows);
  assert.notStrictEqual(validated, rows);
  assert.notStrictEqual(validated[0].fieldPath, rows[0].fieldPath);
  assert.equal(validated.length, 366);
});

test('gap-entry gate requires all 366 current rows and rejects duplicate keys', () => {
  const rows = expectedCurrentGapRows();
  const { FIXED_SOURCE_ROWS } = require('./native_schema_supplement');
  const options = { existingSupplementEntries: FIXED_SOURCE_ROWS };
  assert.throws(() => validateGapEntries(rows.slice(0, -1), [], options), /exactly 366/i);

  const duplicate = cloneGapRows(rows);
  duplicate[1] = structuredClone(duplicate[0]);
  assert.throws(() => validateGapEntries(duplicate, [], options), /duplicate.*key/i);
});

test('gap-entry gate rejects official and existing Forge collisions', () => {
  const rows = expectedCurrentGapRows();
  const { FIXED_SOURCE_ROWS } = require('./native_schema_supplement');
  assert.throws(() => validateGapEntries(rows, [{ key: rows[0].key }], {
    existingSupplementEntries: FIXED_SOURCE_ROWS,
  }), /official.*collision/i);

  const collidingForge = cloneGapRows(FIXED_SOURCE_ROWS);
  collidingForge[0].key = rows[0].key;
  assert.throws(() => validateGapEntries(rows, [], { existingSupplementEntries: collidingForge }),
    /supplement.*collision/i);
});

test('gap-entry gate rejects forged rows and metadata drift', () => {
  const rows = expectedCurrentGapRows();
  const { FIXED_SOURCE_ROWS } = require('./native_schema_supplement');
  const options = { existingSupplementEntries: FIXED_SOURCE_ROWS };
  const mutations = [
    row => { row.key = 'nodeAttr:forged.value'; },
    row => { row.catalogId = 'officialCatalog'; },
    row => { row.owner = 'wrongOwner'; },
    row => { row.fieldPath = ['attributes', 'wrong', 'name']; },
    row => { row.source = 'Forged fallback'; },
    row => { row.notes = ['Copied/forged explanation']; },
    row => { row.vendorJapanese = '假的日文'; },
    row => { row.dontTranslate = true; },
    row => { delete row.dontTranslate; },
    row => { row.unreviewed = true; },
  ];

  for (const mutate of mutations) {
    const changed = cloneGapRows(rows);
    mutate(changed[0]);
    assert.throws(() => validateGapEntries(changed, [], options), /source row.*identity|row shape/i);
  }
});

test('gap-entry gate requires explicit complete evidence arguments', () => {
  const rows = expectedCurrentGapRows();
  const { FIXED_SOURCE_ROWS } = require('./native_schema_supplement');
  assert.throws(() => validateGapEntries(rows, undefined, {
    existingSupplementEntries: FIXED_SOURCE_ROWS,
  }), /official entries must be an array/i);
  assert.throws(() => validateGapEntries(rows, [], undefined), /existing supplement entries/i);
  assert.throws(() => validateGapEntries(rows, [], {}), /existing supplement entries/i);
});
