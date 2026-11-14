/**
 * [INPUT]: 依赖native_schema_supplement的锁定nodeDefinitions投影与合成schema契约。
 * [OUTPUT]: 验证固定8个Forge回退源行及显式DNT=false、精确字段/父链/Inspector顺序、字节摘要与官方键碰撞拒绝。
 * [POS]: tools/native producer的source-only合同；无三语决策、无App/profile、无私stage依赖。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');
const { createHash } = require('node:crypto');
const supplement = require('./native_schema_supplement');

const EXPECTED = [
  ['time', 'Time', { type: 'int', compConnect: 'time' }],
  ['startFrame', 'Start Frame', { type: 'int', min: 0 }],
  ['gravity', 'Gravity', { type: 'double2', default: { x: 0, y: -10 }, children: { x: { prefix: 'X' }, y: { prefix: 'Y' } } }],
  ['groundFriction', 'Ground Friction', { type: 'double', default: 1, min: 0, softMax: 2, step: 0.01, dimming: 'groundMode == 0' }],
  ['groundBounce', 'Ground Bounce', { type: 'double', default: 0.1, min: 0, softMax: 1, step: 0.01, dimming: 'groundMode == 0' }],
  ['velocityIterations', 'Velocity Iterations', { type: 'int', default: 30, min: 1, keyable: false }],
  ['positionIterations', 'Position Iterations', { type: 'int', default: 10, min: 1, keyable: false }],
  ['fields', 'Fields', { type: 'list', vectorAutoDelete: true, child: { type: 'nodeId', supportedInputNodeTypes: ['dynamicField'] } }],
];
const SHAPE_ORDER = ['time', 'startFrame', 'gravity', 'groundMode', 'groundFriction', 'groundBounce',
  'velocityIterations', 'positionIterations', 'fields', 'collisionEvents'];
function definitionsFixture() {
  const chain = [
    ['forgeDynamicsShape', 'shape'], ['shape', 'drawable'], ['drawable', 'transform'],
    ['transform', 'element'], ['element', 'molecule'], ['molecule'],
  ].map(([nodeType, superType]) => ({ nodeType, ...(superType === undefined ? {} : { superType }), attributes: {} }));
  chain[0].attributes = Object.fromEntries(EXPECTED.map(([id, , schema]) => [id, structuredClone(schema)]));
  chain[0].UI = { tabs: [{ id: 'shape', attributeOrder: [...SHAPE_ORDER] }] };
  return chain;
}
test('source supplement is exactly the eight locked Forge owner/id/fallback rows', () => {
  const entries = supplement.sourceEntriesFromDefinitions(definitionsFixture());
  assert.equal(entries.length, 8);
  assert.deepEqual(entries.map(({ key, source }) => [key, source]),
    EXPECTED.map(([id, source]) => [`nodeAttr:forgeDynamicsShape.${id}`, source]));
  assert.ok(entries.every(row => row.dontTranslate === false), 'all supplementary source rows state translateability explicitly');
  assert.ok(entries.every(row => row.catalogId === supplement.SUPPLEMENT_CATALOG_ID
    && row.owner === 'forgeDynamicsShape' && row.notes.length === 1
    && !Object.hasOwn(row, 'translations') && !Object.hasOwn(row, 'vendorJapanese')));
});
test('source supplement rejects duplicate or missing owner/parent/schema/UI identities', () => {
  const base = definitionsFixture();
  const mutations = [
    defs => { defs[0].attributes.groundFriction.step = 1; },
    defs => { delete defs[0].attributes.fields; },
    defs => { defs[0].superType = 'drawable'; },
    defs => { defs.find(row => row.nodeType === 'shape').superType = 'transform'; },
    defs => { defs.find(row => row.nodeType === 'element').superType = null; },
    defs => { defs[0].UI.tabs[0].attributeOrder.reverse(); },
    defs => { defs.push(structuredClone(defs[0])); },
  ];
  for (const mutate of mutations) {
    const changed = structuredClone(base);
    mutate(changed);
    assert.throws(() => supplement.sourceEntriesFromDefinitions(changed), /supplement|Forge|schema|parent|owner|UI/i);
  }
});
test('source supplement verifies pinned bytes and rejects official-key collisions', () => {
  assert.match(supplement.SOURCE_SHA256, /^[a-f0-9]{64}$/);
  const target = JSON.parse(fs.readFileSync(`${__dirname}/fixtures/cavalry_native_target_2_8_0.json`, 'utf8'));
  assert.equal(target.nativeKeys, 10473);
  assert.equal(target.supplementalKeys, 373);
  assert.deepEqual(target.sourceFiles, [{ path: supplement.SOURCE_PATH, sha256: supplement.SOURCE_SHA256 }]);
  assert.throws(() => supplement.sourceEntries(Buffer.from('[]')), /digest|SHA/i);
  const entries = supplement.sourceEntriesFromDefinitions(definitionsFixture());
  assert.throws(() => supplement.sourceEntriesFromDefinitions(definitionsFixture(), [
    { key: entries[0].key, source: entries[0].source },
  ]), /collision/i);
  assert.equal(createHash('sha256').update(Buffer.from('[]')).digest('hex') === supplement.SOURCE_SHA256, false);
});
