/**
 * [INPUT]: 依赖仓外表生成器、合成行与可选的SHA锁定官方MetaData目录。
 * [OUTPUT]: 验证C++转义、仓外边界、384/17说明表及401根排版表。
 * [POS]: 纯构建期合同；不读取安装profile，不启动App，不证明live consumer。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');

const generator = require('./build_native_help_description_table.js');
const REPO_ROOT = path.resolve(__dirname, '..');

test('escapes C++ UTF-8 literals without losing byte length', () => {
  const value = 'say "hi" \\\n\0 中文 😀';
  assert.equal(generator.cppLiteral(value, 'synthetic'),
    'u8"say \\"hi\\" \\\\\\n\\000 \\u4e2d\\u6587 \\U0001f600"');
  const table = generator.renderCppTable([{
    runtimeName: 'makePlane',
    sourceDescription: 'Creates a plane.',
    translations: {
      'zh-Hans': '平面。',
      'zh-Hant': '平面。',
      ja_JP: '平面を作成します。',
    },
  }], [{
    runtimeName: 'makePlaneDef',
    sourceDescription: 'Builds a deformer plane.',
    translations: {
      'zh-Hans': '生成变形平面。',
      'zh-Hant': '產生變形平面。',
      ja_JP: 'デフォーマ平面を生成します。',
    },
  }]);
  assert.match(table, /\[OUTPUT\]: 提供384个非def根和17个def根的独立三语说明表。/);
  assert.match(table, /std::string_view\{u8"\\u5e73\\u9762\\u3002", 9\}/);
  assert.match(table, /kApprovedRuntimeDefHelp\[\]/);
  assert.match(table, /makePlaneDef/);
  assert.match(table, /kApprovedRuntimeRootHelpCount/);
  assert.match(table, /kApprovedRuntimeDefHelpCount/);
  assert.doesNotMatch(table, /signature|return_type|arguments/);
});

test('requires explicit absolute source and an output outside the repository', () => {
  const external = path.join(os.tmpdir(), 'cavalry-help-table-fixture');
  assert.deepEqual(generator.parseArguments([
    '--metadata-dir', external,
    '--out', path.join(os.tmpdir(), 'cavalry-help-table.inc'),
  ]), {
    metadataDirectory: path.resolve(external),
    outputFile: path.resolve(os.tmpdir(), 'cavalry-help-table.inc'),
  });
  assert.throws(() => generator.parseArguments([]), /both --metadata-dir and --out are required/);
  assert.throws(() => generator.parseArguments([
    '--metadata-dir', 'relative-source', '--out', path.join(os.tmpdir(), 'table.inc'),
  ]), /must be absolute/);
  assert.throws(() => generator.parseArguments([
    '--metadata-dir', external, '--out', path.join(REPO_ROOT, 'table.inc'),
  ]), /outside the repository/);
  assert.throws(() => generator.parseArguments([
    '--metadata-dir', external,
    '--out', path.join(external, 'table.inc'),
  ]), /must not overwrite official metadata input/);
  assert.throws(() => generator.generate({
    metadataDirectory: external,
    outputFile: path.join(REPO_ROOT, 'table.inc'),
  }), /outside the repository/);
});

test('rejects unpaired UTF-16 surrogates before generating UTF-8 source', () => {
  assert.throws(() => generator.cppLiteral('\ud800', 'synthetic'), /unpaired high surrogate/);
  assert.throws(() => generator.cppLiteral('\udc00', 'synthetic'), /unpaired low surrogate/);
});

test('2.8.1 metadata requires an explicit supported version', () => {
  const args = ['--metadata-dir', path.join(os.tmpdir(), 'metadata'), '--out', path.join(os.tmpdir(), 'help.inc')];
  assert.equal(generator.parseArguments([...args, '--cavalry-version', '2.8.1']).cavalryVersion, '2.8.1');
  assert.throws(() => generator.parseArguments([...args, '--cavalry-version', '2.8.2']), /unsupported metadata/);
});

test('projects layout strings separately without description or locale data', () => {
  const row = {
    key: 'api_function_metadata.json#/same/description', runtimeName: 'same', kind: 'function',
    argumentsText: 'id:string, <i>force:bool</i>', returnsText: '',
  };
  const result = generator.renderCppLayoutRows([row, {
    ...row, key: 'core_api_function_metadata.json#/same/description', kind: 'property',
    argumentsText: '', returnsText: '{left, right}',
  }]);
  assert.match(result, /native_help_popup_metadata/);
  assert.match(result, /std::string_view\{u8"id:string, <i>force:bool<\/i>", 28\}/);
  assert.match(result, /std::string_view\{u8"", 0\}/);
  assert.match(result, /std::string_view\{u8"property", 8\}/);
  assert.equal((result.match(/u8"same"/g) || []).length, 2);
  assert.doesNotMatch(result, /sourceDescription|translations|zh-Hant/);
  assert.throws(() => generator.renderCppLayoutRows([]), /must be non-empty/);
});

test('generates the locked 384 main and 17 def official tables outside the checkout', {
  skip: !process.env.CAVALRY_2_8_METADATA_DIR,
}, () => {
  const outputDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'cavalry-help-table-contract.'));
  const outputFile = path.join(outputDirectory, 'runtime-root-description-table.inc');
  try {
    const receipt = generator.generate({
      metadataDirectory: process.env.CAVALRY_2_8_METADATA_DIR,
      outputFile,
    });
    assert.equal(receipt.counts.descriptionLeaves, 512);
    assert.equal(receipt.counts.rootDescriptionLeaves, 401);
    assert.equal(receipt.counts.candidateRoots, 384);
    assert.equal(receipt.counts.excludedDefRoots, 17);
    assert.equal(receipt.counts.nestedDescriptions, 111);
    assert.equal(receipt.output.runtimeRootEntries, 384);
    assert.equal(receipt.output.runtimeDefEntries, 17);
    assert.equal(receipt.output.layoutRootEntries, 401);
    const layout = fs.readFileSync(receipt.output.layoutFile, 'utf8');
    assert.match(layout, /kRows\[\]/);
    assert.equal((layout.match(/#\//g) || []).length, 401);
    assert.equal(receipt.boundary.namespaceTablesSeparated, true);
    assert.equal(receipt.boundary.defRootsProjected, 17);
    assert.equal(receipt.boundary.runtimeConsumerConnected, false);
    assert.equal(receipt.boundary.liveConsumerPass, false);
    assert.ok(fs.readFileSync(outputFile, 'utf8').includes('kApprovedRuntimeRootHelp[]'));
    const persistedReceipt = JSON.parse(fs.readFileSync(`${outputFile}.receipt.json`, 'utf8'));
    assert.deepEqual(persistedReceipt, receipt);
  } finally {
    fs.rmSync(outputDirectory, { recursive: true, force: true });
  }
});

test('2.8.1 keeps all help roots while replacing changed descriptions and encode names', {
  skip: !process.env.CAVALRY_2_8_1_METADATA_DIR,
}, () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'cavalry-281-help.'));
  const outputFile = path.join(directory, 'help.inc');
  try {
    const metadataDirectory = process.env.CAVALRY_2_8_1_METADATA_DIR;
    assert.throws(() => generator.generate({ metadataDirectory, outputFile }), /locked official 2.8.0/);
    const receipt = generator.generate({ metadataDirectory, outputFile, cavalryVersion: '2.8.1' });
    assert.equal(receipt.counts.reusedApprovals, 473);
    assert.equal(receipt.counts.supplementedDescriptions, 39);
    assert.equal(receipt.counts.descriptionLeaves, 512);
    assert.equal(receipt.output.runtimeRootEntries, 384);
    assert.equal(receipt.output.runtimeDefEntries, 17);
    assert.equal(receipt.output.layoutRootEntries, 401);
    const table = fs.readFileSync(outputFile, 'utf8');
    assert.match(table, /u8"encode"/);
    assert.match(table, /u8"encodeFile"/);
    assert.doesNotMatch(table, /u8"encrypt(?:File)?"/);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
