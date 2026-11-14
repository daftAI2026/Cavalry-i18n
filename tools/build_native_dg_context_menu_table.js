#!/usr/bin/env node
/**
 * [INPUT]: 依赖Cavalry 2.8.1官方assets appStrings、五条source-bound审批与旧TS源。
 * [OUTPUT]: 在仓外生成native_dg_context_menu::kRows C++编译表。
 * [POS]: 候选构建期投影；不改产品catalog、TS或语言包统计。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const DATA = require('./native_dg_context_menu_data.js');
const { parseTs } = require('./generate_embedded_translations.js');
const { collectNativeCatalog } = require('./native_language_pack.js');
const { assertOfficialTarget } = require('./native_official_target.js');

const REPO_ROOT = path.resolve(__dirname, '..');
const TARGET_PATH = path.join(REPO_ROOT, 'tools', 'cavalry_native_target.json');
const APPROVED_NATIVE_PATH = path.join(REPO_ROOT, 'languages/native/remaining_global_ui_05.js');
const TS_FILES = Object.freeze({
  'zh-Hans': 'tools/zh-Hans.ts',
  'zh-Hant': 'tools/zh-Hant.ts',
  ja_JP: 'tools/ja_JP.ts',
});
const CPP_LOCALES = Object.freeze([
  ['zh-Hans', 'zhHans'], ['zh-Hant', 'zhHant'], ['ja_JP', 'japanese'],
]);
const CALLSITES = Object.freeze({
  addDuplicator: 'kAddDuplicatorActionsReturnOffset',
  groupSelected: 'kAddGroupActionReturnOffset',
  lockSelected: 'kAddLockActionReturnOffset',
  showInAttributeEditor: 'kAddShowAttributeEditorReturnOffset',
  showInSceneWindow: 'kAddShowSceneWindowReturnOffset',
});
const REQUIRED_CALLSITES = Object.freeze(Object.keys(CALLSITES));
const ROW_COUNT = 5;

function requireText(value, label) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${label} must be a non-empty string`);
  }
}

function requireData(data) {
  if (!data?.provenance || data.provenance.schemaVersion !== 1 ||
      data.provenance.scope !== 'Cavalry 2.8.1 TransformTool context-menu display only' ||
      data.provenance.reviewState !== 'source-bound-display-projection' ||
      data.provenance.officialCatalogRegistration !== false ||
      data.provenance.liveAcceptance !== false) {
    throw new Error('menu projection provenance is not source-bound display-only data');
  }
  if (!Array.isArray(data.rows) || data.rows.length !== ROW_COUNT) {
    throw new Error(`menu projection requires exactly ${ROW_COUNT} rows`);
  }
  const identities = new Set();
  const calls = new Set();
  const sources = new Set();
  for (const [index, row] of data.rows.entries()) {
    requireText(row?.identity, `row ${index} identity`);
    requireText(row?.callsite, `row ${index} callsite`);
    requireText(row?.source, `row ${index} source`);
    if (!Object.hasOwn(CALLSITES, row.callsite)) throw new Error(`unapproved menu helper: ${row.callsite}`);
    if (identities.has(row.identity) || calls.has(row.callsite) || sources.has(row.source)) {
      throw new Error(`duplicate menu identity/callsite/source: ${row.identity}`);
    }
    identities.add(row.identity);
    calls.add(row.callsite);
    sources.add(row.source);
  }
  if (REQUIRED_CALLSITES.some(callsite => !calls.has(callsite))) {
    throw new Error('all five verified helper callsites must be covered exactly once');
  }
  return data.rows;
}

function sourceHash(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function validateCatalogBytes(catalog, sourceBytes, japaneseBytes) {
  if (sourceHash(sourceBytes) !== catalog.sourceSha256) {
    throw new Error(`official English catalog SHA differs: ${catalog.source}`);
  }
  if (sourceHash(japaneseBytes) !== catalog.japaneseSha256) {
    throw new Error(`official Japanese catalog SHA differs: ${catalog.japanese}`);
  }
  return {
    source: JSON.parse(sourceBytes.toString('utf8')),
    japanese: JSON.parse(japaneseBytes.toString('utf8')),
  };
}

function readOfficialNativeEntries(assetsDirectory, targetBytes = fs.readFileSync(TARGET_PATH)) {
  const { target } = assertOfficialTarget(targetBytes);
  if (target.cavalryVersion !== '2.8.1') throw new Error('native source must target Cavalry 2.8.1');
  const catalog = target.catalogs.find(row => row.id === 'Definitions/Translation/appStrings');
  if (!catalog) throw new Error('2.8.1 target lacks appStrings source catalog');
  const sourceBytes = fs.readFileSync(path.join(assetsDirectory, catalog.source));
  const japaneseBytes = fs.readFileSync(path.join(assetsDirectory, catalog.japanese));
  const { source, japanese } = validateCatalogBytes(catalog, sourceBytes, japaneseBytes);
  const collected = collectNativeCatalog(catalog.id, source, japanese);
  if (collected.unmapped.length) throw new Error('2.8.1 appStrings contains unmapped native display leaves');
  return collected.entries;
}

function indexTsEntries(entries, context, source, locale) {
  const matches = entries.filter(row => row?.context === context && row?.source === source);
  if (matches.length === 0) throw new Error(`approved Qt TS source is missing: ${locale}:${context}:${source}`);
  const translations = new Set(matches.map(row => row.translation));
  if (translations.size !== 1) throw new Error(`ambiguous Qt TS translations: ${locale}:${context}:${source}`);
  const translation = matches[0].translation;
  requireText(translation, `Qt TS translation ${locale}:${context}:${source}`);
  return translation;
}

function requireLockReview(row) {
  const review = row?.sourceApproval?.review;
  if (row?.sourceApproval?.kind !== 'agy-refined-source-bound' ||
      row.sourceApproval.context !== 'MenuBarManager' ||
      review?.provider !== 'AGY' ||
      review?.skillPath !== '.agents/skills/baoyu-translate/SKILL.md' ||
      review?.workflow !== 'refined' || review?.reviewedBy !== 'primary-agent' ||
      review?.conversationId !== '5901dce6-2515-4e99-821b-8478befb1143') {
    throw new Error('Lock Selected must retain the reviewed AGY/baoyu refined source approval');
  }
}

function projectRows(data, { nativeEntries, tsEntriesByLocale }) {
  const rows = requireData(data);
  if (!Array.isArray(nativeEntries) || !tsEntriesByLocale || typeof tsEntriesByLocale !== 'object') {
    throw new Error('native approvals and per-locale TS entries are required');
  }
  const nativeByKey = new Map();
  for (const row of nativeEntries) {
    if (row?.key === 'sceneTree.menu.groupSelected') {
      if (nativeByKey.has(row.key)) throw new Error(`duplicate native display approval: ${row.key}`);
      nativeByKey.set(row.key, row);
    }
  }

  const projected = rows.map(row => {
    const callsiteExpression = `contract::${CALLSITES[row.callsite]}`;
    const approval = row.sourceApproval;
    const translations = {};
    if (approval?.kind === 'native-key') {
      if (approval.catalogId !== 'Definitions/Translation/appStrings' ||
          approval.key !== 'sceneTree.menu.groupSelected') {
        throw new Error(`unapproved native key for ${row.identity}`);
      }
      const nativeRow = nativeByKey.get(approval.key);
      if (!nativeRow) throw new Error(`approved native key is missing: ${approval.key}`);
      if (nativeRow.catalogId !== approval.catalogId || nativeRow.source !== row.source ||
          JSON.stringify(nativeRow.fieldPath) !== JSON.stringify(['sceneTree.menu.groupSelected'])) {
        throw new Error(`native source identity differs for ${approval.key}`);
      }
      for (const locale of ['zh-Hans', 'zh-Hant', 'ja_JP']) {
        const decision = nativeRow.translations?.[locale];
        if (!decision || decision.decision !== 'translate') {
          throw new Error(`native approval missing for ${approval.key}:${locale}`);
        }
        requireText(decision.text, `native translation ${approval.key}:${locale}`);
        translations[locale] = decision.text;
      }
    } else if (approval?.kind === 'qt-ts') {
      requireText(approval.context, `${row.identity} TS context`);
      for (const locale of ['zh-Hans', 'zh-Hant', 'ja_JP']) {
        translations[locale] = indexTsEntries(
          tsEntriesByLocale[locale], approval.context, row.source, locale);
      }
    } else if (approval?.kind === 'agy-refined-source-bound') {
      requireLockReview(row);
      // Keep the historical exact TS source in all three catalogs as the
      // caller/source identity; only the reviewed lock wording is overridden.
      for (const locale of ['zh-Hans', 'zh-Hant', 'ja_JP']) {
        indexTsEntries(tsEntriesByLocale[locale], approval.context, row.source, locale);
        requireText(row.translations?.[locale], `AGY translation ${locale}`);
        translations[locale] = row.translations[locale];
      }
    } else {
      throw new Error(`unsupported translation approval source for ${row.identity}`);
    }
    return {
      identity: row.identity,
      helperReturnOffsetExpression: callsiteExpression,
      source: row.source,
      zhHans: translations['zh-Hans'],
      zhHant: translations['zh-Hant'],
      japanese: translations.ja_JP,
    };
  });
  return projected;
}

function requireWellFormedUnicode(value, label) {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) throw new Error(`${label} has an invalid surrogate`);
      index += 1;
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      throw new Error(`${label} has an invalid surrogate`);
    }
  }
}

function cppLiteral(value, label) {
  requireWellFormedUnicode(value, label);
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

function requireProjectedRows(rows) {
  if (!Array.isArray(rows) || rows.length !== ROW_COUNT) {
    throw new Error(`projected menu table requires exactly ${ROW_COUNT} rows`);
  }
  const identities = new Set();
  const sources = new Set();
  for (const [index, row] of rows.entries()) {
    for (const field of ['identity', 'helperReturnOffsetExpression', 'source', 'zhHans', 'zhHant', 'japanese']) {
      requireText(row?.[field], `projected row ${index} ${field}`);
    }
    if (identities.has(row.identity) || sources.has(row.source)) {
      throw new Error(`duplicate projected menu row: ${row.identity}`);
    }
    identities.add(row.identity);
    sources.add(row.source);
  }
  return rows;
}

function renderTable(projectedRows) {
  const rows = requireProjectedRows(projectedRows);
  const fields = [
    'identity', 'helperReturnOffsetExpression', 'source', 'zhHans', 'zhHant', 'japanese',
  ];
  return [
    '/**',
    ' * [INPUT]: 依赖五个helper/source身份、281 native Group审批、旧TS和AGY Lock复核。',
    ' * [OUTPUT]: 提供native_dg_context_menu::kRows编译期三语表。',
    ' * [POS]: 构建期窄显示投影；不修改catalog、TS、菜单身份或官方包统计。',
    ' * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md',
    ' */',
    '// Generated by tools/build_native_dg_context_menu_table.js.',
    'namespace native_dg_context_menu {',
    `inline constexpr std::array<Row, ${ROW_COUNT}> kRows{{`,
    ...rows.map((row, index) => `    {${fields.map(field => {
      const value = field === 'helperReturnOffsetExpression'
        ? row.helperReturnOffsetExpression
        : `std::string_view{${cppLiteral(row[field], `${field}[${index}]`)}, ${Buffer.byteLength(row[field], 'utf8')}}`;
      return value;
    }).join(', ')}},`),
    '}};',
    '}  // namespace native_dg_context_menu',
    '',
  ].join('\n');
}

function validatePaths(assetsInput, outputInput) {
  if (typeof assetsInput !== 'string' || typeof outputInput !== 'string' ||
      !path.isAbsolute(assetsInput) || !path.isAbsolute(outputInput)) {
    throw new Error('assets directory and output file must be absolute paths');
  }
  const assetsDirectory = path.resolve(assetsInput);
  const outputFile = path.resolve(outputInput);
  const relativeOutput = path.relative(REPO_ROOT, outputFile);
  if (relativeOutput === '' || (!relativeOutput.startsWith(`..${path.sep}`) &&
      relativeOutput !== '..' && !path.isAbsolute(relativeOutput))) {
    throw new Error('output must remain outside the repository');
  }
  if (!fs.statSync(assetsDirectory).isDirectory() ||
      outputFile.startsWith(`${assetsDirectory}${path.sep}`)) {
    throw new Error('output must not overwrite official assets input');
  }
  return { assetsDirectory, outputFile };
}

function parseArguments(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!['--assets-dir', '--out'].includes(key) || !value || value.startsWith('--')) {
      throw new Error('usage: build_native_dg_context_menu_table.js --assets-dir <absolute-dir> --out <absolute-file>');
    }
    if (Object.hasOwn(parsed, key)) throw new Error(`duplicate option: ${key}`);
    parsed[key] = value;
    index += 1;
  }
  if (!parsed['--assets-dir'] || !parsed['--out']) {
    throw new Error('both --assets-dir and --out are required');
  }
  return validatePaths(parsed['--assets-dir'], parsed['--out']);
}

function loadInputs(assetsDirectory) {
  const targetBytes = fs.readFileSync(TARGET_PATH);
  const { target } = assertOfficialTarget(targetBytes);
  const metadataNativeEntries = readOfficialNativeEntries(assetsDirectory, targetBytes);
  const approvedNative = require(APPROVED_NATIVE_PATH);
  const nativeEntries = approvedNative.entries;
  const tsEntriesByLocale = Object.fromEntries(Object.entries(TS_FILES).map(([locale, file]) => [
    locale, parseTs(path.join(REPO_ROOT, file)),
  ]));
  return { target, metadataNativeEntries, nativeEntries, tsEntriesByLocale };
}

function main(argv = process.argv.slice(2)) {
  const { assetsDirectory, outputFile } = parseArguments(argv);
  const { metadataNativeEntries, nativeEntries, tsEntriesByLocale } = loadInputs(assetsDirectory);
  const descriptorRows = requireData(DATA);
  const groupApproval = descriptorRows.find(row => row.callsite === 'groupSelected')?.sourceApproval;
  const groupSource = metadataNativeEntries.find(row => row.key === groupApproval?.key);
  if (!groupSource) throw new Error(`281 source catalog lacks ${groupApproval?.key}`);
  const rows = projectRows(DATA, { nativeEntries, tsEntriesByLocale });
  if (groupSource.source !== rows.find(row => row.identity === 'transformTool.groupSelected')?.source) {
    throw new Error('281 native Group Selected source differs from its approved display source');
  }
  fs.mkdirSync(path.dirname(outputFile), { recursive: true });
  fs.writeFileSync(outputFile, renderTable(rows));
  process.stdout.write(`rows=${rows.length} target=2.8.1 source=${groupSource.key} out=${outputFile}\n`);
}

if (require.main === module) {
  try { main(); }
  catch (error) {
    process.stderr.write(`build_native_dg_context_menu_table: ${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  CALLSITES,
  parseArguments,
  validateCatalogBytes,
  readOfficialNativeEntries,
  projectRows,
  renderTable,
};
