#!/usr/bin/env node
/**
 * [INPUT]: 依赖 generate_quick_add_descriptions.js、四语 nodeStrings/plugins JSON 与生成式 C++ 输出
 * [OUTPUT]: 对外提供 Quick Add 描述索引的确定性/结构同构/碰撞保留合同，阻止标题猜测、数组 index 对齐和通用 fallback 混入
 * [POS]: tools 的 Classic Add Layer 描述索引离线回归；不启动 Cavalry、不读取凭据、不冒充现场 QLabel 证据
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');

const root = path.resolve(__dirname, '..');
const generator = require('./generate_quick_add_descriptions.js');

test('English and target description identities are complete and structurally aligned', () => {
  const english = generator.collectDescriptionRecords('en');
  assert.ok(english.length > 0);
  assert.equal(new Set(english.map(record => record.key)).size, english.length);
  for (const { code } of generator.languageDefinitions) {
    const localized = generator.collectDescriptionRecords(code);
    assert.deepEqual(
      localized.map(record => record.key),
      english.map(record => record.key),
      `${code} must align by stable path/field/type, not array position`
    );
    assert.ok(localized.every(record => record.description.length > 0));
  }
});

test('reverse index retains all English values for a localized collision and deduplicates identical pairs', () => {
  const entries = generator.buildReverseDescriptionEntries([
    { key: 'a', localizedDescription: '同一说明', englishDescription: 'English one' },
    { key: 'b', localizedDescription: '同一说明', englishDescription: 'English two' },
    { key: 'c', localizedDescription: '同一说明', englishDescription: 'English one' },
  ]);
  assert.deepEqual(entries, [
    { localizedDescription: '同一说明', englishDescription: 'English one' },
    { localizedDescription: '同一说明', englishDescription: 'English two' },
  ]);
});

test('stable identity drift fails closed before a C++ projection is emitted', () => {
  assert.throws(
    () => generator.assertSameKeys(
      [{ key: 'nodeStrings.json|nodeInfo|kept' }],
      [{ key: 'nodeStrings.json|nodeInfo|changed' }],
      'fixture'
    ),
    /fixture description identities differ; missing=.*kept.*extra=.*changed/
  );
});

test('C++ string escaping keeps UTF-8 readable and bounds every control escape', () => {
  assert.equal(generator.escapeCppString('中A0'), '中A0');
  assert.equal(generator.escapeCppString('\u0001A9'), '\\001A9');
  const escaped = generator.escapeCppString('中A0"\\\n\r\t\u0001');
  assert.match(escaped, /^中A0/);
  assert.match(escaped, /\\"/);
  assert.match(escaped, /\\\\/);
  assert.match(escaped, /\\n/);
  assert.match(escaped, /\\r/);
  assert.match(escaped, /\\011/);
  assert.match(escaped, /\\001/);
  assert.throws(() => generator.escapeCppString('nul\u0000'), /does not accept NUL/);
});

test('generated projection is deterministic, independent, and separate from generic TranslationEntry', () => {
  const first = generator.renderGenerated(generator.buildCatalog());
  const second = generator.renderGenerated(generator.buildCatalog());
  assert.equal(first, second);
  assert.equal(
    fs.readFileSync(generator.defaultOutputPath, 'utf8'),
    first,
    'checked-in projection must be regenerated from the JSON source'
  );
  assert.match(first, /QuickAddDescriptionEntry/);
  assert.doesNotMatch(first, /TranslationEntry/);
  assert.doesNotMatch(first, /entriesForLanguage/);

  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'cavalry-quick-add-descriptions-'));
  try {
    const outputPath = path.join(temporary, 'generated.inc');
    generator.generate(outputPath);
    assert.equal(fs.readFileSync(outputPath, 'utf8'), first);
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
});

test('current source contains the three known same-language description collisions without title identity mapping', () => {
  const englishDescriptions = new Set(
    generator.collectDescriptionRecords('en').map(record => record.description)
  );
  const catalog = generator.buildCatalog();
  for (const language of catalog) {
    const duplicateLocalized = new Map();
    for (const record of language.records) {
      const values = duplicateLocalized.get(record.localizedDescription) || new Set();
      values.add(record.englishDescription);
      duplicateLocalized.set(record.localizedDescription, values);
    }
    const collisions = [...duplicateLocalized.values()].filter(values => values.size > 1);
    assert.equal(collisions.length, 0, `${language.code} has no ambiguous English text in current catalog`);
    for (const description of englishDescriptions) {
      assert.ok(
        language.entries.some(entry =>
          entry.localizedDescription === description
          && entry.englishDescription === description
        ),
        `${language.code} must recognize an English description left untranslated`
      );
    }
    assert.ok(language.entries.length >= language.records.length);
  }
});
