#!/usr/bin/env node
/**
 * [INPUT]: 依赖 languages/{en,zh-Hans,zh-Hant,ja_JP}/nodeStrings.json 与 plugins/* 的稳定 nodeType/layerType、nodeInfo/layerInfo 字段
 * [OUTPUT]: 对外提供确定性生成器与 injector/generated_quick_add_descriptions.inc；每种目标语言把完整本地说明反向映射到英文说明
 * [POS]: tools 的 Add Layer Classic 描述索引投影器；独立于通用 Qt 翻译表，不改写模型身份、QLabel 或用户查询
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');
const languagesRoot = path.join(repoRoot, 'languages');
const defaultOutputPath = path.join(
  repoRoot,
  'injector',
  'generated_quick_add_descriptions.inc'
);

const languageDefinitions = [
  { code: 'zh-Hans', symbol: 'kZhHansQuickAddDescriptionEntries' },
  { code: 'zh-Hant', symbol: 'kZhHantQuickAddDescriptionEntries' },
  { code: 'ja_JP', symbol: 'kJaQuickAddDescriptionEntries' },
];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function addRecord(records, seenKeys, record) {
  if (seenKeys.has(record.key)) {
    throw new Error(`duplicate description identity: ${record.key}`);
  }
  seenKeys.add(record.key);
  records.push(record);
}

function addNodeRecord(records, seenKeys, value, location) {
  if (!value || typeof value !== 'object' || value.nodeType == null) {
    return;
  }
  if (typeof value.nodeType !== 'string' || value.nodeType.length === 0) {
    throw new Error(`invalid nodeType at ${location}`);
  }
  if (!Object.prototype.hasOwnProperty.call(value, 'nodeInfo')) {
    return;
  }
  if (typeof value.nodeInfo !== 'string' || value.nodeInfo.length === 0) {
    throw new Error(`invalid nodeInfo at ${location}`);
  }
  addRecord(records, seenKeys, {
    key: `nodeStrings.json|nodeInfo|${value.nodeType}`,
    id: value.nodeType,
    field: 'nodeInfo',
    relativePath: 'nodeStrings.json',
    description: value.nodeInfo,
    location,
  });
}

function collectNodeDescriptions(languageCode) {
  const filePath = path.join(languagesRoot, languageCode, 'nodeStrings.json');
  const payload = readJson(filePath);
  if (!Array.isArray(payload)) {
    throw new Error(`${filePath} must contain an array`);
  }

  const records = [];
  const seenKeys = new Set();
  payload.forEach((entry, index) => {
    if (!entry || typeof entry !== 'object') {
      throw new Error(`${filePath}[${index}] must contain an object`);
    }
    addNodeRecord(records, seenKeys, entry.value, `${filePath}[${index}].value`);
    if (entry.values != null && !Array.isArray(entry.values)) {
      throw new Error(`${filePath}[${index}].values must contain an array`);
    }
    (entry.values || []).forEach((value, valueIndex) => {
      addNodeRecord(
        records,
        seenKeys,
        value,
        `${filePath}[${index}].values[${valueIndex}]`
      );
    });
  });
  return records;
}

function addPluginRecord(records, seenKeys, value, relativePath, location) {
  if (!value || typeof value !== 'object' || value.layerType == null) {
    return;
  }
  if (typeof value.layerType !== 'string' || value.layerType.length === 0) {
    throw new Error(`invalid layerType at ${location}`);
  }
  if (!Object.prototype.hasOwnProperty.call(value, 'layerInfo')) {
    return;
  }
  if (typeof value.layerInfo !== 'string' || value.layerInfo.length === 0) {
    throw new Error(`invalid layerInfo at ${location}`);
  }
  addRecord(records, seenKeys, {
    key: `${relativePath}|layerInfo|${value.layerType}`,
    id: value.layerType,
    field: 'layerInfo',
    relativePath,
    description: value.layerInfo,
    location,
  });
}

function collectPluginDescriptions(languageCode) {
  const pluginRoot = path.join(languagesRoot, languageCode, 'plugins');
  const records = [];
  const seenKeys = new Set();
  for (const fileName of fs.readdirSync(pluginRoot).sort()) {
    if (!fileName.endsWith('.json') || fileName.endsWith('Definitions.json')) {
      continue;
    }
    const relativePath = `plugins/${fileName}`;
    const filePath = path.join(pluginRoot, fileName);
    const payload = readJson(filePath);
    if (!Array.isArray(payload)) {
      throw new Error(`${filePath} must contain an array`);
    }
    payload.forEach((entry, index) => {
      if (!entry || typeof entry !== 'object') {
        throw new Error(`${filePath}[${index}] must contain an object`);
      }
      addPluginRecord(
        records,
        seenKeys,
        entry.value,
        relativePath,
        `${filePath}[${index}].value`
      );
    });
  }
  return records;
}

function compareStrings(left, right) {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function sortRecords(records) {
  return [...records].sort((left, right) => compareStrings(left.key, right.key));
}

function collectDescriptionRecords(languageCode) {
  return sortRecords([
    ...collectNodeDescriptions(languageCode),
    ...collectPluginDescriptions(languageCode),
  ]);
}

function assertSameKeys(reference, candidate, languageCode) {
  const expected = new Set(reference.map(record => record.key));
  const actual = new Set(candidate.map(record => record.key));
  if (expected.size !== reference.length || actual.size !== candidate.length) {
    throw new Error(`${languageCode} description identities contain duplicates`);
  }
  const missing = [...expected].filter(key => !actual.has(key));
  const extra = [...actual].filter(key => !expected.has(key));
  if (missing.length || extra.length) {
    throw new Error(
      `${languageCode} description identities differ; missing=${missing.join(',')} extra=${extra.join(',')}`
    );
  }
}

function buildReverseDescriptionEntries(records, descriptionField = 'description') {
  const aliases = new Map();
  for (const record of records) {
    const localized = record.localizedDescription ?? record[descriptionField];
    const english = record.englishDescription ?? record.english;
    if (typeof localized !== 'string' || localized.length === 0) {
      throw new Error(`localized description is empty for ${record.key || 'unknown identity'}`);
    }
    if (typeof english !== 'string' || english.length === 0) {
      throw new Error(`English description is empty for ${record.key || 'unknown identity'}`);
    }
    if (!aliases.has(localized)) aliases.set(localized, new Set());
    aliases.get(localized).add(english);
  }

  return [...aliases.entries()]
    .flatMap(([localizedDescription, englishDescriptions]) =>
      [...englishDescriptions].map(englishDescription => ({
        localizedDescription,
        englishDescription,
      }))
    )
    .sort((left, right) =>
      compareStrings(left.localizedDescription, right.localizedDescription)
      || compareStrings(left.englishDescription, right.englishDescription)
    );
}

function buildCatalog() {
  const english = collectDescriptionRecords('en');
  if (english.length === 0) {
    throw new Error('English description catalog must contain at least one record');
  }

  return languageDefinitions.map(language => {
    const localized = collectDescriptionRecords(language.code);
    assertSameKeys(english, localized, language.code);
    const localizedByKey = new Map(localized.map(record => [record.key, record]));
    const paired = english.map(record => ({
      key: record.key,
      englishDescription: record.description,
      localizedDescription: localizedByKey.get(record.key).description,
    }));
    const localizedEntries = buildReverseDescriptionEntries(paired);
    return {
      ...language,
      records: paired,
      localizedEntries,
      // 未翻译的 label 仍是合法的当前语言输入；共享英文 identity 使其可被精确查到。
      entries: buildReverseDescriptionEntries([
        ...english.map(record => ({
          localizedDescription: record.description,
          englishDescription: record.description,
        })),
        ...paired,
      ]),
    };
  });
}

function escapeCppString(value) {
  if (value.includes('\0')) {
    throw new Error('C++ string projection does not accept NUL');
  }
  return value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n')
    .replace(/[\u0001-\u0009\u000b\u000c\u000e-\u001f\u007f]/g, character =>
      `\\${character.charCodeAt(0).toString(8).padStart(3, '0')}`
    );
}

function renderGenerated(catalog) {
  const header = `/**
 * [INPUT]: 依赖 languages/<lang>/nodeStrings.json 的 nodeInfo 与 languages/<lang>/plugins/<plugin>.json 的 layerInfo，按相对路径/字段/稳定类型对齐三语内容
 * [OUTPUT]: 对外提供三语 Quick Add 描述反向索引的编译期字节表，由 cavalry_i18n_search_descriptions.h 懒构建 Qt QHash
 * [POS]: injector 的独立 Add Layer 搜索语义投影；只供 Classic 描述别名查找，不进入通用翻译 fallback、不改变显示文本或模型 identity
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
// Generated by tools/generate_quick_add_descriptions.js. Do not edit by hand.
`;
  const englishEntries = buildReverseDescriptionEntries(
    catalog[0].records.map(record => ({
      localizedDescription: record.englishDescription,
      englishDescription: record.englishDescription,
    }))
  );
  const arrays = [
    { symbol: 'kQuickAddEnglishDescriptionEntries', entries: englishEntries },
    ...catalog,
  ];
  const body = arrays.map(({ symbol, entries, localizedEntries }) => {
    const renderedEntries = localizedEntries || entries;
    const rows = renderedEntries.map(({ localizedDescription, englishDescription }) =>
      `    {"${escapeCppString(localizedDescription)}", "${escapeCppString(englishDescription)}"},`
    );
    return `inline constexpr QuickAddDescriptionEntry ${symbol}[] = {
${rows.join('\n')}
};
inline constexpr int ${symbol}Count = static_cast<int>(sizeof(${symbol}) / sizeof(${symbol}[0]));
`;
  }).join('\n');
  return `${header}\n${body}`;
}

function generate(destinationPath = defaultOutputPath) {
  const output = renderGenerated(buildCatalog());
  fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
  fs.writeFileSync(destinationPath, output);
  return output;
}

if (require.main === module) {
  generate(process.argv[2] || defaultOutputPath);
}

module.exports = {
  assertSameKeys,
  buildCatalog,
  buildReverseDescriptionEntries,
  collectDescriptionRecords,
  defaultOutputPath,
  escapeCppString,
  generate,
  languageDefinitions,
  renderGenerated,
};
