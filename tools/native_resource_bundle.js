#!/usr/bin/env node
/**
 * [INPUT]: 依赖2.8.0/显式2.8.1候选官方assets、冻结target、Forge8、缺源365、隐藏caption1、插件caption1与源绑定DNT批准。
 * [OUTPUT]: 2.8.1候选复用已验245个fallback标签并隔离输出；默认生成development-preview；显式production-2.8拒绝缺源包并绑定三语payload摘要。
 * [POS]: macOS用户语言事务的构建输入owner；两种profile复用同一批准源，生产不改译文或target。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { createHash, randomUUID } = require('node:crypto');
const { collectNativeCatalog, resolveTranslations, renderNativePack,
  validateDemoSceneDntDisplayApprovals } = require('./native_language_pack');
const { assertNativeTranslationFormat } = require('./native_translation_format');
const { sourceEntries: forgeSourceEntries, validateSupplementEntries, SUPPLEMENT_CATALOG_ID } = require('./native_schema_supplement');
const { sourceEntriesFromDefinitions } = require('./native_schema_supplement');
const { sourceEntries: gapSourceEntries, validateGapEntries, GAP_CATALOG_ID,
  BACKGROUND_RENDERING_GAP_COUNT } = require('./native_schema_gap_sources');
const { validateGapDefinitions, validateBackgroundRenderingDefinition, CURRENT_GAP_SOURCE_ROWS } = require('./native_schema_gap_sources');
const { sourceEntries: pluginCaptionSourceEntries, validatePluginCaptionEntries,
  PLUGIN_CAPTION_CATALOG_ID, PLUGIN_CAPTION_KEY_COUNT,
  SOURCE_PATH: PLUGIN_CAPTION_SOURCE_PATH } = require('./native_plugin_caption_supplement');
const { assertOfficialTarget, assertCandidate281Target } = require('./native_official_target');
const { APPROVED_VENDOR_CORRECTIONS } = require('../languages/native/approved_vendor_corrections');
const { DEMO_MENU_DNT_KEYS } = require('../languages/native/official_demo_menus');
const LANGUAGES = Object.freeze(['zh-Hans', 'zh-Hant', 'ja_JP']);
const RESOURCE_PROFILES = Object.freeze({
  'development-preview': { kind: 'development-preview', requiresComplete: false },
  'production-2.8': { kind: 'production-2.8', requiresComplete: true },
  'development-2.8.1': { kind: 'development-preview', requiresComplete: true, cavalryVersion: '2.8.1' },
});
const sha256 = value => createHash('sha256').update(value).digest('hex');
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// -- 单一装配：源绑定先于任何输出，missing不会填入未经审批旧候选 ------
function collectOfficialEntries(pairs) {
  const entries = [];
  for (const pair of [...pairs].sort((a, b) => a.id.localeCompare(b.id, 'en'))) {
    const collected = collectNativeCatalog(pair.id, pair.source, pair.japanese);
    if (collected.unmapped.length) throw new Error(`unmapped native display leaves: ${pair.id}`);
    entries.push(...collected.entries);
  }
  return entries;
}
function buildNativeResourceBundle(pairs, approved, trustedVendorCorrections = APPROVED_VENDOR_CORRECTIONS,
  supplementalEntries = [], dntDisplayExceptionKeys = [], profile = 'development-preview') {
  const resourceProfile = RESOURCE_PROFILES[profile];
  if (!resourceProfile) throw new Error(`unsupported native resource profile: ${profile}`);
  const entries = collectOfficialEntries(pairs);
  if (!Array.isArray(supplementalEntries)) throw new Error('native schema supplement entries must be an array');
  const forge = supplementalEntries.filter(row => row?.catalogId === SUPPLEMENT_CATALOG_ID);
  const gaps = supplementalEntries.filter(row => row?.catalogId === GAP_CATALOG_ID);
  const pluginCaptions = supplementalEntries.filter(row => row?.catalogId === PLUGIN_CAPTION_CATALOG_ID);
  if (forge.length + gaps.length + pluginCaptions.length !== supplementalEntries.length) {
    throw new Error('unknown native schema supplement domain');
  }
  const verifiedForge = forge.length ? validateSupplementEntries(forge, entries) : [];
  const verifiedGaps = gaps.length ? validateGapEntries(gaps, entries, { existingSupplementEntries: verifiedForge }) : [];
  const verifiedPluginCaptions = pluginCaptions.length
    ? validatePluginCaptionEntries(pluginCaptions, entries) : [];
  const supplements = [...verifiedForge, ...verifiedGaps, ...verifiedPluginCaptions];
  entries.push(...supplements);
  const indexed = new Map();
  for (const row of entries) {
    if (indexed.has(row.key)) throw new Error(`duplicate native key: ${row.key}`);
    indexed.set(row.key, row);
  }
  const seen = new Set();
  for (const row of approved) {
    if (seen.has(row.key)) throw new Error(`duplicate approved key: ${row.key}`);
    seen.add(row.key);
    const source = indexed.get(row.key);
    if (!source) throw new Error(`unknown approved key: ${row.key}`);
    if (Object.hasOwn(row, 'dontTranslate') && typeof row.dontTranslate !== 'boolean') {
      throw new Error(`approved dontTranslate must be boolean for ${row.key}`);
    }
    if ((row.dontTranslate === true) !== (source.dontTranslate === true)) {
      throw new Error(`approved dontTranslate differs for ${row.key}`);
    }
    for (const field of ['source', 'notes', 'catalogId', 'owner', 'fieldPath']) {
      if ((field === 'source' || field === 'notes' || Object.hasOwn(row, field)) && !same(row[field], source[field])) {
        throw new Error(`approved ${field} differs for ${row.key}`);
      }
    }
    for (const language of LANGUAGES) {
      const decision = row.translations?.[language];
      if (!decision || typeof decision !== 'object' || Array.isArray(decision)
          || !Object.hasOwn(decision, 'decision') || !Object.hasOwn(decision, 'text')
          || Object.keys(decision).some(field => !['decision', 'text', 'vendorCorrection'].includes(field))) {
        throw new Error(`invalid locale decision for ${row.key}: ${language}`);
      }
    }
  }
  const dntDisplayExceptions = validateDemoSceneDntDisplayApprovals(entries, approved, dntDisplayExceptionKeys);
  const packs = {};
  const manifest = {
    schemaVersion: 1, kind: resourceProfile.kind, cavalryVersion: resourceProfile.cavalryVersion || '2.8.0',
    approvedUIKeys: approved.length, nativeKeys: entries.length,
    supplementalKeys: supplements.length, complete: false, packs: {},
  };
  for (const language of LANGUAGES) {
    const reviews = approved.map(row => {
      const translation = row.translations[language];
      const review = { key: row.key, source: row.source, decision: translation.decision, text: translation.text };
      if (Object.hasOwn(translation, 'vendorCorrection')) review.vendorCorrection = translation.vendorCorrection;
      return review;
    });
    const selectedDntApprovals = approved.filter(row => dntDisplayExceptions.has(row.key));
    const resolved = resolveTranslations(entries, language, reviews, trustedVendorCorrections, selectedDntApprovals);
    const counts = { reviewed: 0, preserved: 0, vendor: 0, missing: 0 };
    for (const row of resolved.rows) {
      // vendor按官方来源槽计数；内部状态区分原样采用与源绑定纠错，不增typed manifest字段。
      counts[row.status === 'vendor-corrected' ? 'vendor' : row.status] += 1;
      if (row.status !== 'missing') assertNativeTranslationFormat(row.source, row.text);
    }
    packs[language] = renderNativePack(resolved);
    manifest.packs[language] = {
      file: `${language}.json`, nativeLocale: resolved.nativeLocale,
      sha256: sha256(packs[language]), bytes: Buffer.byteLength(packs[language]), ...counts,
    };
  }
  manifest.complete = LANGUAGES.every(language => manifest.packs[language].missing === 0);
  if (resourceProfile.requiresComplete && !manifest.complete) {
    throw new Error(`${profile} requires complete translations for every product language`);
  }
  return { manifest, packs };
}

function safeRegularFile(root, relative) {
  if (path.isAbsolute(relative) || relative.split('/').some(part => !part || part === '.' || part === '..')) {
    throw new Error(`unsafe catalog relative path: ${relative}`);
  }
  let cursor = root;
  for (const part of relative.split('/')) {
    cursor = path.join(cursor, part);
    const info = fs.lstatSync(cursor);
    if (info.isSymbolicLink()) throw new Error(`symlink catalog path: ${relative}`);
  }
  if (!fs.lstatSync(cursor).isFile()) throw new Error(`catalog is not a regular file: ${relative}`);
  return fs.readFileSync(cursor);
}

// -- 明确输入：锁定全部source/厂商JA，不递归猜测未来catalog ----------
function buildFromAssetRoot(assetRoot, profile = 'development-preview') {
  const root = fs.realpathSync(assetRoot);
  const candidate281 = profile === 'development-2.8.1';
  const targetBytes = fs.readFileSync(path.join(__dirname,
    candidate281 ? 'cavalry_native_target_2_8_1.json' : 'cavalry_native_target.json'));
  const { target } = (candidate281 ? assertCandidate281Target : assertOfficialTarget)(targetBytes);
  const sourceLock = target.sourceFiles?.[0];
  const pairs = target.catalogs.map(catalog => {
    const source = safeRegularFile(root, catalog.source);
    const japanese = safeRegularFile(root, catalog.japanese);
    if (sha256(source) !== catalog.sourceSha256 || sha256(japanese) !== catalog.japaneseSha256) {
      throw new Error(`official native catalog digest differs: ${catalog.id}`);
    }
    return { id: catalog.id, source: JSON.parse(source), japanese: JSON.parse(japanese) };
  });
  const nodeDefinitions = safeRegularFile(root, sourceLock.path);
  if (sha256(nodeDefinitions) !== sourceLock.sha256) throw new Error('native schema supplement source digest differs');
  const officialEntries = collectOfficialEntries(pairs);
  let forge, gaps;
  if (candidate281) {
    // The exact 2.8.1 source bytes were checked above. Reuse the existing schema
    // checks and labels; all 245 distinct IDs were verified against 2.8.1 Core.
    const definitions = JSON.parse(nodeDefinitions);
    forge = sourceEntriesFromDefinitions(definitions, officialEntries);
    validateGapDefinitions(definitions, officialEntries);
    validateBackgroundRenderingDefinition(definitions, officialEntries);
    gaps = structuredClone(CURRENT_GAP_SOURCE_ROWS);
  } else {
    forge = forgeSourceEntries(nodeDefinitions, officialEntries);
    gaps = gapSourceEntries(nodeDefinitions, officialEntries);
  }
  const supplements = [...forge, ...gaps,
    ...pluginCaptionSourceEntries(safeRegularFile(root, PLUGIN_CAPTION_SOURCE_PATH), officialEntries)];
  const { approvedEntries } = require('../languages/native/approved_modules');
  const result = buildNativeResourceBundle(pairs, approvedEntries(target.cavalryVersion), undefined, supplements, DEMO_MENU_DNT_KEYS, profile);
  if (result.manifest.nativeKeys !== target.nativeKeys + target.supplementalKeys
      + PLUGIN_CAPTION_KEY_COUNT + BACKGROUND_RENDERING_GAP_COUNT
      || result.manifest.supplementalKeys !== target.supplementalKeys
        + PLUGIN_CAPTION_KEY_COUNT + BACKGROUND_RENDERING_GAP_COUNT
      || result.manifest.packs.ja_JP.vendor !== target.vendorJapaneseKeys) {
    throw new Error('native target key/vendor cardinality differs');
  }
  result.manifest.targetSha256 = sha256(targetBytes);
  result.manifest.inputSha256 = inputDigest(target.cavalryVersion);
  return result;
}

// -- 陈旧构建不能靠旧manifest重新获批；显式编译前核对tracked输入 ----
function inputDigest(cavalryVersion = '2.8.0') {
  const { APPROVED_MODULES } = require('../languages/native/approved_modules');
  const files = [
    'languages/native/approved_modules.js',
    'languages/native/approved_vendor_corrections.js',
    ...APPROVED_MODULES.map(name => `languages/native/${name}.js`),
    'tools/native_resource_bundle.js', 'tools/native_language_pack.js',
    'tools/native_demo_scene_dnt_identities.js',
    'tools/native_translation_format.js', 'tools/native_schema_supplement.js',
    'tools/native_schema_gap_sources.js', 'tools/native_plugin_caption_supplement.js',
    'tools/native_official_target.js', 'package-lock.json',
  ].sort();
  if (cavalryVersion === '2.8.1') files.push(
    'languages/native/release_2_8_1_delta.js', 'tools/cavalry_native_target_2_8_1.json');
  const repo = path.resolve(__dirname, '..');
  return sha256(JSON.stringify(files.map(file => [file, sha256(safeRegularFile(repo, file))])));
}
function validateBuildFreshness(manifest, expectedInputs, expectedTarget) {
  if (manifest.inputSha256 !== expectedInputs) throw new Error('native preview inputs are stale; rebuild native resources');
  if (manifest.targetSha256 !== expectedTarget) throw new Error('native preview target is stale; rebuild native resources');
  return true;
}
function validateResourceProfile(manifest, profile = 'development-preview') {
  const resourceProfile = RESOURCE_PROFILES[profile];
  if (!resourceProfile) throw new Error(`unsupported native resource profile: ${profile}`);
  if (manifest.cavalryVersion !== (resourceProfile.cavalryVersion || '2.8.0'))
    throw new Error('native resource version differs from profile');
  if (manifest.kind !== resourceProfile.kind) throw new Error(`native resource profile differs: expected ${resourceProfile.kind}`);
  const countsAreConsistent = Number.isSafeInteger(manifest.nativeKeys) && manifest.nativeKeys > 0
    && LANGUAGES.every(language => {
      const counts = manifest.packs?.[language];
      const values = [counts?.reviewed, counts?.preserved, counts?.vendor, counts?.missing];
      return values.every(value => Number.isSafeInteger(value) && value >= 0)
        && values.reduce((sum, value) => sum + value, 0) === manifest.nativeKeys;
    });
  if (!countsAreConsistent) throw new Error('native coverage counts differ from manifest key total');
  const countsShowComplete = LANGUAGES.every(language => manifest.packs[language].missing === 0);
  if (manifest.complete !== countsShowComplete) throw new Error('native coverage claim differs from language counts');
  if (resourceProfile.requiresComplete && !countsShowComplete) {
    throw new Error(`${profile} requires complete translations for every product language`);
  }
  return true;
}
function checkBuildOutput(profile = 'development-preview') {
  const candidate281 = profile === 'development-2.8.1';
  const root = path.resolve(__dirname, candidate281
    ? '../src-tauri/target/native-language-packs-2.8.1' : '../src-tauri/target/native-language-packs');
  const manifest = JSON.parse(safeRegularFile(root, 'manifest.json'));
  validateBuildFreshness(manifest, inputDigest(candidate281 ? '2.8.1' : '2.8.0'),
    sha256(fs.readFileSync(path.join(__dirname,
      candidate281 ? 'cavalry_native_target_2_8_1.json' : 'cavalry_native_target.json'))));
  validateResourceProfile(manifest, profile);
  for (const language of LANGUAGES) {
    const info = manifest.packs?.[language];
    if (info?.file !== `${language}.json`) throw new Error('native preview pack path differs');
    const bytes = safeRegularFile(root, info.file);
    if (bytes.length !== info.bytes || sha256(bytes) !== info.sha256) throw new Error('native preview payload differs');
  }
}

function publishBuildOutput(result) {
  const output = path.resolve(__dirname, result.manifest.cavalryVersion === '2.8.1'
    ? '../src-tauri/target/native-language-packs-2.8.1' : '../src-tauri/target/native-language-packs');
  // 派生目录是固定构建位置；不允许symlink把写入引向App或profile。
  let cursor = path.parse(output).root;
  for (const part of output.slice(cursor.length).split(path.sep)) {
    cursor = path.join(cursor, part);
    if (!fs.existsSync(cursor)) fs.mkdirSync(cursor);
    const info = fs.lstatSync(cursor);
    if (info.isSymbolicLink() || !info.isDirectory()) throw new Error(`unsafe build directory: ${cursor}`);
  }
  const allowed = new Set(['manifest.json', ...LANGUAGES.map(code => `${code}.json`)]);
  for (const name of fs.readdirSync(output)) {
    if (!allowed.has(name) || !fs.lstatSync(path.join(output, name)).isFile()
        || fs.lstatSync(path.join(output, name)).isSymbolicLink()) throw new Error(`foreign build output: ${name}`);
  }
  const atomicWrite = (name, bytes) => {
    const temporary = path.join(output, `.${name}.${randomUUID()}.tmp`);
    try { fs.writeFileSync(temporary, bytes, { mode: 0o600, flag: 'wx' }); fs.renameSync(temporary, path.join(output, name)); }
    finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
  };
  for (const language of LANGUAGES) atomicWrite(`${language}.json`, result.packs[language]);
  // manifest最后发布；构建并发读到旧manifest/新payload会因摘要不符而拒绝使用。
  atomicWrite('manifest.json', `${JSON.stringify(result.manifest, null, 2)}\n`);
  return output;
}
if (require.main === module) {
  try {
    const args = process.argv.slice(2);
    const profileAt = args.indexOf('--profile');
    const profile = profileAt >= 0 ? args[profileAt + 1] : 'development-preview';
    if (profileAt >= 0 && (!profile || args.indexOf('--profile', profileAt + 1) >= 0)) throw new Error('invalid --profile argument');
    const positional = profileAt >= 0 ? args.filter((_, index) => index !== profileAt && index !== profileAt + 1) : args;
    if (positional.length === 1 && positional[0] === '--check') { checkBuildOutput(profile); process.exit(0); }
    if (positional.length !== 2 || positional[0] !== '--assets-root') throw new Error('usage: native_resource_bundle.js --assets-root <official Contents/assets> [--profile development-preview|production-2.8|development-2.8.1]');
    const result = buildFromAssetRoot(positional[1], profile);
    const output = publishBuildOutput(result);
    console.log(JSON.stringify({
      output,
      approvedUIKeys: result.manifest.approvedUIKeys,
      nativeKeys: result.manifest.nativeKeys,
      officialCatalogKeys: result.manifest.nativeKeys - result.manifest.supplementalKeys,
      supplementalKeys: result.manifest.supplementalKeys,
      complete: result.manifest.complete,
      packs: result.manifest.packs,
    }, null, 2));
  } catch (error) { console.error(`[native-resource-bundle] ${error.message}`); process.exitCode = 1; }
}
module.exports = { buildNativeResourceBundle, buildFromAssetRoot, publishBuildOutput, validateBuildFreshness, validateResourceProfile };
