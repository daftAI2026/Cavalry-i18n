#!/usr/bin/env node
/**
 * [INPUT]: 依赖显式2.8.0/2.8.1官方四份MetaData、各版本SHA审批、旧四语数据和source-bound补译。
 * [OUTPUT]: 在仓外生成不依赖文档ABI的384/17说明表、401根排版表及回执。
 * [POS]: tools构建期投影；不改仓库资源，不接入UI-text或默认发布链。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
'use strict';

const { createHash } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { METADATA_FILE_NAMES } = require('./native_metadata_help.js');
const { buildApprovedRuntimeRootHelpTable } = require('./native_metadata_reuse.js');
const { projectNativeHelpPopupRows } = require('./native_help_popup_rows.js');

const REPO_ROOT = path.resolve(__dirname, '..');
const LOCALES = Object.freeze(['zh-Hans', 'zh-Hant', 'ja_JP']);
const LEGACY_LOCALES = Object.freeze(['en', ...LOCALES]);
const OFFICIAL_METADATA_SHA256 = Object.freeze({
  'api_function_metadata.json': '700a10cd761ad1b262964a998bd6a2480c3fc12754630fb66fba425f116e7ec8',
  'core_api_function_metadata.json': 'ae76107c590b6b8bda39c11b167318d1092dc5863a60c056c394f7f647856229',
  'gui_api_function_metadata.json': 'f19af900076a973172ebbdcc4bd033b1e487c69b8fcc3ccfdc189fc8f5e9c47e',
  'widget_api_function_metadata.json': '25478df251d984df00be067d0dda3ae84365d85a1fe7cba8a6bc69f8834d937d',
});

const OFFICIAL_METADATA_281_SHA256 = Object.freeze({
  'api_function_metadata.json': '86ea1a09d47bd8bf37b9b8f878927cecfb99682033adf73838f5743eed11b7f4',
  'core_api_function_metadata.json': OFFICIAL_METADATA_SHA256['core_api_function_metadata.json'],
  'gui_api_function_metadata.json': 'dc248f242a41faf13c26fec7f00ef875ebc246c18a81fc760eeb46a3da767f3a',
  'widget_api_function_metadata.json': OFFICIAL_METADATA_SHA256['widget_api_function_metadata.json'],
});

function parseArguments(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!['--metadata-dir', '--out', '--cavalry-version'].includes(key) || !value || value.startsWith('--')) {
      throw new Error('usage: build_native_help_description_table.js --metadata-dir <absolute-dir> --out <absolute-file> [--cavalry-version 2.8.0|2.8.1]');
    }
    if (Object.hasOwn(parsed, key)) throw new Error(`duplicate option: ${key}`);
    parsed[key] = value;
    index += 1;
  }
  if (!parsed['--metadata-dir'] || !parsed['--out']) {
    throw new Error('both --metadata-dir and --out are required');
  }
  const paths = validatePaths(parsed['--metadata-dir'], parsed['--out']);
  if (parsed['--cavalry-version']) {
    requireVersion(parsed['--cavalry-version']);
    paths.cavalryVersion = parsed['--cavalry-version'];
  }
  return paths;
}

function validatePaths(metadataInput, outputInput) {
  if (typeof metadataInput !== 'string' || typeof outputInput !== 'string' ||
      !path.isAbsolute(metadataInput) || !path.isAbsolute(outputInput)) {
    throw new Error('metadata directory and output file must be absolute paths');
  }
  const metadataDirectory = path.resolve(metadataInput);
  const outputFile = path.resolve(outputInput);
  const relativeOutput = path.relative(REPO_ROOT, outputFile);
  if (relativeOutput === '' || (!relativeOutput.startsWith(`..${path.sep}`) && relativeOutput !== '..' && !path.isAbsolute(relativeOutput))) {
    throw new Error('output must remain outside the repository');
  }
  if (path.resolve(metadataDirectory) === path.dirname(outputFile) ||
      outputFile.startsWith(`${metadataDirectory}${path.sep}`)) {
    throw new Error('output must not overwrite official metadata input');
  }
  return { metadataDirectory, outputFile };
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function requireVersion(version) {
  if (!['2.8.0', '2.8.1'].includes(version)) throw new Error('unsupported metadata Cavalry version');
}

function readOfficialMetadata(metadataDirectory, cavalryVersion) {
  requireVersion(cavalryVersion);
  const expected = cavalryVersion === '2.8.1' ? OFFICIAL_METADATA_281_SHA256 : OFFICIAL_METADATA_SHA256;
  const documents = {};
  const inputSha256 = {};
  for (const file of METADATA_FILE_NAMES) {
    const bytes = fs.readFileSync(path.join(metadataDirectory, file));
    const actual = sha256(bytes);
    if (actual !== expected[file]) {
      throw new Error(`${file} SHA-256 differs from the locked official ${cavalryVersion} source`);
    }
    documents[file] = JSON.parse(bytes.toString('utf8'));
    inputSha256[file] = actual;
  }
  return { documents, inputSha256 };
}

function readLegacyMetadata() {
  const documents = {};
  const inputSha256 = {};
  for (const locale of LEGACY_LOCALES) {
    documents[locale] = {};
    inputSha256[locale] = {};
    for (const file of METADATA_FILE_NAMES) {
      const fullPath = path.join(REPO_ROOT, 'languages', locale, 'MetaData', file);
      const bytes = fs.readFileSync(fullPath);
      documents[locale][file] = JSON.parse(bytes.toString('utf8'));
      inputSha256[locale][file] = sha256(bytes);
    }
  }
  return { documents, inputSha256 };
}

function requireWellFormedUnicode(value, name) {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) throw new Error(`${name} contains an unpaired high surrogate`);
      index += 1;
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      throw new Error(`${name} contains an unpaired low surrogate`);
    }
  }
}

function cppLiteral(value, name) {
  requireWellFormedUnicode(value, name);
  let escaped = '';
  for (const character of value) {
    const code = character.codePointAt(0);
    if (character === '"') escaped += '\\"';
    else if (character === '\\') escaped += '\\\\';
    else if (code === 0x07) escaped += '\\a';
    else if (code === 0x08) escaped += '\\b';
    else if (code === 0x09) escaped += '\\t';
    else if (code === 0x0a) escaped += '\\n';
    else if (code === 0x0b) escaped += '\\v';
    else if (code === 0x0c) escaped += '\\f';
    else if (code === 0x0d) escaped += '\\r';
    else if (code < 0x20 || code === 0x7f) escaped += `\\${code.toString(8).padStart(3, '0')}`;
    else if (code <= 0x7e) escaped += character;
    else if (code <= 0xffff) escaped += `\\u${code.toString(16).padStart(4, '0')}`;
    else escaped += `\\U${code.toString(16).padStart(8, '0')}`;
  }
  return `u8"${escaped}"`;
}

function renderCppEntries(tableName, entries) {
  const rows = entries.map((entry, index) => {
    const values = [
      ['runtimeName', entry.runtimeName],
      ['sourceDescription', entry.sourceDescription],
      ...LOCALES.map(locale => [locale, entry.translations[locale]]),
    ].map(([field, value]) => {
      if (typeof value !== 'string' || value.length === 0) throw new Error(`entry ${index} lacks ${field}`);
      return `std::string_view{${cppLiteral(value, `${field}[${index}]`)}, ${Buffer.byteLength(value, 'utf8')}}`;
    });
    return `    {${values.join(', ')}},`;
  });
  return [
    `inline constexpr HelpDescriptionEntry ${tableName}[] = {`,
    ...rows,
    '};',
    `inline constexpr std::size_t ${tableName}Count =`,
    `    sizeof(${tableName}) / sizeof(${tableName}[0]);`,
  ];
}

function renderCppTable(entries, defEntries) {
  if (!Array.isArray(entries) || entries.length === 0 ||
      !Array.isArray(defEntries) || defEntries.length === 0) {
    throw new Error('both main and def description tables must be non-empty arrays');
  }
  return [
    '/**',
    ' * [INPUT]: 依赖所选版本SHA锁定的官方四份MetaData、源绑定复用审批与补译。',
    ' * [OUTPUT]: 提供384个非def根和17个def根的独立三语说明表。',
    ' * [POS]: 仓外构建期只读表；主表与def表隔离，不覆盖机器字段。',
    ' * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md',
    ' */',
    '// 本文件由 tools/build_native_help_description_table.js 生成。',
    '#pragma once',
    '#include "help_description_lookup.h"',
    '',
    'namespace native_help_description {',
    ...renderCppEntries('kApprovedRuntimeRootHelp', entries),
    '',
    ...renderCppEntries('kApprovedRuntimeDefHelp', defEntries),
    '}  // namespace native_help_description',
    '',
  ].join('\n');
}

function renderCppLayoutRows(rows) {
  if (!Array.isArray(rows) || rows.length === 0) throw new Error('layout rows must be non-empty');
  const fields = ['key', 'runtimeName', 'kind', 'argumentsText', 'returnsText'];
  return [
    '/**',
    ' * [INPUT]: 依赖SHA锁定的官方四份MetaData前三行。',
    ' * [OUTPUT]: 提供全部根API的原厂排版文字，不含说明。',
    ' * [POS]: 构建期只读数据；同名根各自保留，宽度由当前Qt控件测量。',
    ' * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md',
    ' */',
    '// 本文件由 tools/build_native_help_description_table.js 生成。',
    '#pragma once',
    '#include <cstddef>',
    '#include <string_view>',
    'namespace native_help_popup_metadata {',
    'struct Row {',
    ...fields.map(field => `    std::string_view ${field};`),
    '};',
    'inline constexpr Row kRows[] = {',
    ...rows.map((row, index) => `    {${fields.map(field => {
      const value = row[field];
      if (typeof value !== 'string') throw new Error(`layout row ${index} lacks ${field}`);
      return `std::string_view{${cppLiteral(value, `${field}[${index}]`)}, ${Buffer.byteLength(value, 'utf8')}}`;
    }).join(', ')}},`),
    '};',
    'inline constexpr std::size_t kRowCount = sizeof(kRows) / sizeof(kRows[0]);',
    '}  // namespace native_help_popup_metadata',
    '',
  ].join('\n');
}

function generate({ metadataDirectory, outputFile, cavalryVersion = '2.8.0' }) {
  const validated = validatePaths(metadataDirectory, outputFile);
  metadataDirectory = validated.metadataDirectory;
  outputFile = validated.outputFile;
  const { documents, inputSha256 } = readOfficialMetadata(metadataDirectory, cavalryVersion);
  const legacy = readLegacyMetadata();
  const reuseManifestPath = path.join(REPO_ROOT, 'languages/native/metadata_reuse_manifest.js');
  const supplementPath = path.join(REPO_ROOT, 'languages/native/metadata_supplement.js');
  const reuseManifest = require('../languages/native/metadata_reuse_manifest.js');
  const supplement = require('../languages/native/metadata_supplement.js');
  let reuseApprovals = reuseManifest.approvals;
  let supplementEntries = supplement.entries;
  let deltaPath;
  if (cavalryVersion === '2.8.1') {
    deltaPath = path.join(REPO_ROOT, 'languages/native/metadata_2_8_1_delta.js');
    const delta = require(deltaPath);
    const replaced = new Set([...delta.removedKeys, ...delta.entries.map(entry => entry.key)]);
    reuseApprovals = reuseApprovals.filter(entry => !replaced.has(entry.key));
    supplementEntries = [...supplementEntries.filter(entry => !replaced.has(entry.key)), ...delta.entries];
  }
  const table = buildApprovedRuntimeRootHelpTable({
    metadataDocuments: documents,
    legacyDocuments: legacy.documents,
    reuseApprovals,
    supplementEntries,
  });
  const expectedCounts = {
    descriptionLeaves: 512,
    rootDescriptionLeaves: 401,
    candidateRoots: 384,
    excludedDefRoots: 17,
    nestedDescriptions: 111,
    reusedApprovals: cavalryVersion === '2.8.1' ? 473 : 478,
    supplementedDescriptions: cavalryVersion === '2.8.1' ? 39 : 34,
    reviewedDescriptions: 512,
  };
  for (const [count, expected] of Object.entries(expectedCounts)) {
    if (table.counts[count] !== expected) throw new Error(`${count} must equal ${expected}`);
  }
  if (table.entries.length !== 384) throw new Error('runtime-root table must have 384 entries');
  if (table.defEntries.length !== 17) throw new Error('runtime-def table must have 17 entries');

  const layoutRows = projectNativeHelpPopupRows(documents);
  if (layoutRows.length !== 401) throw new Error('layout table must have 401 root entries');

  const rendered = renderCppTable(table.entries, table.defEntries);
  const layoutRendered = renderCppLayoutRows(layoutRows);
  const layoutFile = `${outputFile}.layout.inc`;
  fs.mkdirSync(path.dirname(outputFile), { recursive: true });
  fs.writeFileSync(outputFile, rendered, 'utf8');
  fs.writeFileSync(layoutFile, layoutRendered, 'utf8');
  const outputSha256 = sha256(Buffer.from(rendered, 'utf8'));
  const receipt = {
    l3Contract: {
      INPUT: '所选版本SHA锁定的官方四份MetaData、旧四语MetaData、源绑定审批与补译。',
      OUTPUT: '记录384/17说明表与401根排版表身份、来源和consumer边界。',
      POS: '仓外构建期回执；不构成产品consumer或live证据。',
      PROTOCOL: '变更时更新此头部，然后检查 CLAUDE.md',
    },
    input: {
      metadataDirectory,
      cavalryVersion,
      ...(deltaPath ? { deltaSourceSha256: sha256(fs.readFileSync(deltaPath)) } : {}),
      officialMetadataSha256: inputSha256,
      legacyMetadataSha256: legacy.inputSha256,
      approvalManifestSha256: sha256(fs.readFileSync(reuseManifestPath)),
      supplementSourceSha256: sha256(fs.readFileSync(supplementPath)),
      reuseApprovals: reuseApprovals.length,
      sourceBoundSupplements: supplementEntries.length,
    },
    counts: table.counts,
    output: {
      file: outputFile,
      sha256: outputSha256,
      bytes: Buffer.byteLength(rendered, 'utf8'),
      runtimeRootEntries: table.entries.length,
      runtimeDefEntries: table.defEntries.length,
      layoutFile,
      layoutSha256: sha256(Buffer.from(layoutRendered, 'utf8')),
      layoutRootEntries: layoutRows.length,
    },
    boundary: {
      descriptionOffset: '+0x00 only',
      namespaceTablesSeparated: true,
      defRootsProjected: table.defEntries.length,
      nestedDescriptionsNotReachableByCurrentRootCaller: table.counts.nestedDescriptions,
      runtimeConsumerConnected: false,
      liveConsumerPass: false,
    },
  };
  fs.writeFileSync(`${outputFile}.receipt.json`, `${JSON.stringify(receipt, null, 2)}\n`, 'utf8');
  return receipt;
}

function main(argv) {
  try {
    const receipt = generate(parseArguments(argv));
    process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
    return 0;
  } catch (error) {
    process.stderr.write(`build_native_help_description_table: ${error.message}\n`);
    return 1;
  }
}

if (require.main === module) {
  process.exitCode = main(process.argv.slice(2));
}

module.exports = { cppLiteral, generate, parseArguments, renderCppTable, renderCppLayoutRows };
