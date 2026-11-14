/**
 * [INPUT]: 依赖15个正式Cavalry 2.8 Guide/Plugin source-bound模块、approved_modules显式注册、官方target域摘要helper、原生投影/资源bundle/格式producer及有限纠错登记。
 * [OUTPUT]: 分开锁定历史批准与现行三语摘要（含Twist单键修订），约束396键身份、13有限纠错/377原样、6DNT及真实producer门；不含候选译值。
 * [POS]: tools的完整Guide/Plugin入库合同；它只验证source-bound开发预览输入，不读取App/profile、不写public、不证明live UI或release。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const { officialTargetSha256 } = require('./native_official_target');

function findRepositoryRoot() {
  const candidates = [process.cwd(), path.resolve(__dirname, '..'), path.resolve(__dirname, '../..')];
  const root = candidates.find(candidate => fs.existsSync(path.join(candidate, 'package.json'))
    && fs.existsSync(path.join(candidate, 'tools/native_language_pack.js')));
  assert.ok(root, 'run from the repo root, or place this contract under tools/');
  assert.ok(fs.statSync(path.join(root, 'package.json')).isFile(), 'repository package.json is a file');
  return root;
}
const REPO_ROOT = findRepositoryRoot();
const LANGUAGES = Object.freeze(['zh-Hans', 'zh-Hant', 'ja_JP']);
const { nativeSourceIdentitySha256 } = require('./native_language_pack');
const { APPROVED_VENDOR_CORRECTIONS } = require('../languages/native/approved_vendor_corrections');
const CHINESE_LOCALES = Object.freeze(['zh-Hans', 'zh-Hant']);
const FULL_REVIEW_SCOPE = Object.freeze({ catalogs: 15, entries: 396, localeSlots: 1188 });
const MODULES = Object.freeze([
  { file: 'guides', catalogId: 'Learn/Guides/Translation/strings', count: 98 },
  { file: 'plugins_bilateral_blur', catalogId: 'Plugins/Bilateral Blur Filter/Translation/strings', count: 8 },
  { file: 'plugins_box_blur', catalogId: 'Plugins/Box Blur Filter/Translation/strings', count: 4 },
  { file: 'plugins_bulge', catalogId: 'Plugins/Bulge Filter/Translation/strings', count: 16 },
  { file: 'plugins_chroma_key', catalogId: 'Plugins/Chroma Key Filter/Translation/strings', count: 62 },
  { file: 'plugins_directional_blur', catalogId: 'Plugins/Directional Blur Filter/Translation/strings', count: 6 },
  { file: 'plugins_erosion', catalogId: 'Plugins/Erosion Filter/Translation/strings', count: 15 },
  { file: 'plugins_gaussian_blur', catalogId: 'Plugins/Gaussian Blur Filter/Translation/strings', count: 4 },
  { file: 'plugins_grain', catalogId: 'Plugins/Grain Filter/Translation/strings', count: 41 },
  { file: 'plugins_light_sweep', catalogId: 'Plugins/Light Sweep Filter/Translation/strings', count: 26 },
  { file: 'plugins_polar_coordinates', catalogId: 'Plugins/Polar Coordinates Filter/Translation/strings', count: 18 },
  { file: 'plugins_ripple', catalogId: 'Plugins/Ripple Filter/Translation/strings', count: 32 },
  { file: 'plugins_spherise', catalogId: 'Plugins/Spherise Filter/Translation/strings', count: 45 },
  { file: 'plugins_twist', catalogId: 'Plugins/Twist Filter/Translation/strings', count: 13 },
  { file: 'plugins_zoom_blur', catalogId: 'Plugins/Zoom Blur Filter/Translation/strings', count: 8 },
]);
const TARGET = Object.freeze({
  manifestSha256: 'b6c6c6de1145035dc5ead1f21daf27d405de79fb70f430ecc828f6d09522be84',
  sourcePairsSha256: '1956109842a57bb433b53d8da462143b0228cbff5543518633a920701bc02783',
  canonicalKeysetSha256: 'a57ec2176c872013de1f022233ec0d1ae2cd08b77e50f6f77d3ed1ba0124a29e',
  sourceIdentityAndNotesSha256: '87b5db5d682b8e0da5433a4ec10ea11fd477d0bdd6581d7e51cb4979342e688a',
  sourceJsonSha256: 'b0c1aecab95df92ce2a591c61e61b415720318a6271bca2a8151ac449bf0571c',
});
const DNT_KEYS = Object.freeze([
  'onboarding.demo.audio.label',
  'onboarding.demo.axonometric.label',
  'onboarding.demo.dynamicText.label',
  'onboarding.demo.gradientAlongPath.label',
  'onboarding.demo.overAndOver.label',
  'onboarding.demo.variableFont.label',
]);
const ROOT_APPROVAL = Object.freeze({
  // 主代理双全域独审及delta修正后锁定批准摘要；不依赖私有stage或未审candidate。
  sourceApprovalSha256: "1188e33280b780f41d7f23c0f12c3391a40ccfd2d127bc8bbf79c3d672c435e9",
  rootRevisedCandidateSha256: "21d29cb431e216619f93d89d441b4e08c31c17311d1ff0a5a713b57aa1d8db01",
  rootAdjudicationSha256: "af3329fccece6f28bbff3ce09a729759e7c1b4a5661f7f67b33ce32faf1c3ed8",
  localeTranslationSha256: Object.freeze({"zh-Hans":"a9898c09e865348ab974241febe6eafbfa968b16eb097bf5ac6d01b2d5a3dd82","zh-Hant":"e34603c72ea9bc4b1dd2da62e6e422edec314358b14db2c9ae2f7f19d7272e14","ja_JP":"79ea92db02b95ee79db968b41843cbe664a7bb0ab10c3141793bbe4eda5e07e0"}),
});
// 当前摘要含Twist单键修订；历史ROOT_APPROVAL谱系不覆盖。
const CURRENT_REAUDIT_LOCALE_DIGESTS = Object.freeze({"zh-Hans":"9e2a114c4c79fd1717b246b2ba6f2d518092883afe64c5edde977a2c52bd3ae7","zh-Hant":"6ddd22878bf6d57bada93004b4e087db40100fbe7ddb18688e1cf196344cdc10","ja_JP":"2c5331cd3adb35d75dfeeeca64f0d7775c1c39d83bee839cd3bc10de8cccd489"});
const HISTORICAL_MODULE_LOCALE_DIGESTS = Object.freeze({"guides":{"zh-Hans":"53a4067cf7913ac2daf957f3e5a8696ea3d566f4bd81b7ff6ff4b8c864c7ac62","zh-Hant":"4bfa094f121c0a7a456c9c37dcc501fae3a7aa6c056497cb919efece2de1c6b9","ja_JP":"e10a7e469ef6805bd5285d83438a9ffd6795c8b59aaeec53784c23f0625553e4"},"plugins_bilateral_blur":{"zh-Hans":"b8ace5504975ee2329fe25819553519303c027c82ae9a7d3a82180f2d6118733","zh-Hant":"35df6daaeed69a7bef7ca7d31c66b2bee62bda71775650e607f56513f9f5633d","ja_JP":"ab03a00fafbe0257c135d4f9ed8535af5605ad7205d71caa8831e885375480e2"},"plugins_box_blur":{"zh-Hans":"843739ded3d35a5a24124b2fdd5e3e085c2725edc78a997614827e8d3047abcc","zh-Hant":"38f2e1f2f6823d10b59a395fe8d35511435f5df6fb13a128ae37794f57c41c97","ja_JP":"971f7b16907466334bd4bf8fd70488d25a87ef62dbfc83221edeb48f98373cd7"},"plugins_bulge":{"zh-Hans":"50601e7c34e56cf8f56635fbb36832c28ff1d890d6e1ec9f3eabd6894c93d953","zh-Hant":"0afc1138b40dfc73dfacdd12af502a8cd4310a6330dc3ba8a0108c46b65f32bd","ja_JP":"b755fbd8732a4570c62952741900d64536d1f3b8c612bec4b7f57eaf74e170fc"},"plugins_chroma_key":{"zh-Hans":"793d20a51d029939eb34611ae41a2cf573ea79d587300d0045aa66543db5d9d9","zh-Hant":"008ea3d95e0c6d2b04f4c43ba8adcc9401f2df3e088c8fe5ada929db3b7e5eca","ja_JP":"f87b321c285ece5bb800e2fbf13965addee50fecd9f5eb16ecaa8ffbbf0bfe3a"},"plugins_directional_blur":{"zh-Hans":"0012c303abde9486d025bf9eb61cfb9b942d36474ceb5f52e6cc062a18eb68d8","zh-Hant":"64b1cfaa3186a5e2d42d5eadc6fd441bc14fed8461a4d90b4c69cd700db1c6dd","ja_JP":"5bb00ac9aded37ea0022822ce285886ab94294bcd1de7f63fad022de73152507"},"plugins_erosion":{"zh-Hans":"6d97109e13593c62f2447626246dcffaf8c0987952a30487df856e1e870fbe1f","zh-Hant":"9b6fae8dd1c8904afb9c7f2e34d365d58890ca6be0a10287244319f946cb1a33","ja_JP":"ee5d4ad26ef75d061eca82d40456d3c5af3a5ab961c7313d9251c217a36fd9a8"},"plugins_gaussian_blur":{"zh-Hans":"519677356e3b90b207103c5b99a7a61e72ca5b68a8aa516b6ac5cf966a51cb94","zh-Hant":"a9f9a7ad7b116bcab69e47a66834c1d9d71ec5a3ba53d7e81b8fbd3de8f93703","ja_JP":"6ee66827802267168b089733caf3bcdde835c5f689bfecdea3cfb42082e00ab6"},"plugins_grain":{"zh-Hans":"3be7acc13db73a23e59322b1399d8091f1c585922d5d9a53be197447c0c4f354","zh-Hant":"b8a5a5afec5ccb70ef60ddd9f5e3b9c1e39d8df5e98918a8faf241efe755a1b5","ja_JP":"d5feef7f158972e8c7f02b1a32c43663c24657e3e2dd9b45a63b463b981db7a7"},"plugins_light_sweep":{"zh-Hans":"5bb762fbaebb6dc2ad6f3ffe1d354dd7afe3d3441125218769a2cd02c550f8cf","zh-Hant":"8c5cbe733c3bc1c8bc8ffd810bb1489d31500e4b99857ac703d55d1676be1611","ja_JP":"bef8c1010bf971a031510af969ef3d31258ea3040888496ca81ae79112f3c182"},"plugins_polar_coordinates":{"zh-Hans":"97475b5427544ca5aafe4930dafb8fe8940874017c56345310a75b776cde5b25","zh-Hant":"432af3981ba7537c956f3bc72bc7bd278e675c61536f9cd6387ca73e16aea22b","ja_JP":"427a67934e7faa52eaea723a038da1cdd7ef0174d44ace6bcabe90c162b36f43"},"plugins_ripple":{"zh-Hans":"0232b1ccfe7a98d06b5571152101c53d913ba0c45ec76d2ef412a967fbbe9dfb","zh-Hant":"a04d2ce66f7a3c0d2aea8f4a05e37c5da84144994aa42621e983de23c85e5209","ja_JP":"8cc846d3e830d947d49babb13260f402e8f2ffd9c3046acefa4adf766f6638ab"},"plugins_spherise":{"zh-Hans":"f73811c220a37e814d82e3f0f08d12d4c198424cfcfa3e484f8b626c679a01d7","zh-Hant":"3c704c61729b58f1bba8706cfe9bf9fc1a0f21447114c2247a9ae69195fd4b0d","ja_JP":"6c1909320ce66426470f499e5d0101f5ded319c33a00fdf4277f30a99c1ed1aa"},"plugins_twist":{"zh-Hans":"0c2362769ee98475318945851bf06e1339dfcdf32be466740fa23e42a2aac69d","zh-Hant":"63fd51b5bcd193dbe7345d98d1598491c232f4f3e8b5a4fab1d94411bebdb456","ja_JP":"fc74a1329f07e4ffd362653d5584364c759c3716402b4da17c36e8006575774d"},"plugins_zoom_blur":{"zh-Hans":"931b9f814664d2665850eb91235cc5e0119357fe9bbd62656af443d40a5bbe61","zh-Hant":"503275fa00e6f3f050ddb0c3371b795abb1c88acac7c4a6e867e18e448c9ed47","ja_JP":"9fd814001de03ba86fd2a1964ab3e81c974926f519d81d0580f34d95ccdcb999"}});
const CURRENT_MODULE_LOCALE_DIGESTS = Object.freeze({"guides":{"zh-Hans":"b34bcbf9c1ec6403775aeb215d3528b6b345d48b233d841df34fd5818784c778","zh-Hant":"4bfa094f121c0a7a456c9c37dcc501fae3a7aa6c056497cb919efece2de1c6b9","ja_JP":"e10a7e469ef6805bd5285d83438a9ffd6795c8b59aaeec53784c23f0625553e4"},"plugins_bilateral_blur":{"zh-Hans":"b8ace5504975ee2329fe25819553519303c027c82ae9a7d3a82180f2d6118733","zh-Hant":"35df6daaeed69a7bef7ca7d31c66b2bee62bda71775650e607f56513f9f5633d","ja_JP":"bc3a34fbd9371d627d2dcb01fd057c1d5f875bde158b2e6151dceaf6321ffd5a"},"plugins_box_blur":{"zh-Hans":"843739ded3d35a5a24124b2fdd5e3e085c2725edc78a997614827e8d3047abcc","zh-Hant":"38f2e1f2f6823d10b59a395fe8d35511435f5df6fb13a128ae37794f57c41c97","ja_JP":"c695f27d0909ca9c4edefb7f0684799f137acd7078759e24c5514284f8a8f41e"},"plugins_bulge":{"zh-Hans":"50601e7c34e56cf8f56635fbb36832c28ff1d890d6e1ec9f3eabd6894c93d953","zh-Hant":"0afc1138b40dfc73dfacdd12af502a8cd4310a6330dc3ba8a0108c46b65f32bd","ja_JP":"fc2ff7ee0a518b0454ffd71e9de710c02a7c0531bb7cb0ce544c0d6864acacac"},"plugins_chroma_key":{"zh-Hans":"793d20a51d029939eb34611ae41a2cf573ea79d587300d0045aa66543db5d9d9","zh-Hant":"008ea3d95e0c6d2b04f4c43ba8adcc9401f2df3e088c8fe5ada929db3b7e5eca","ja_JP":"f87b321c285ece5bb800e2fbf13965addee50fecd9f5eb16ecaa8ffbbf0bfe3a"},"plugins_directional_blur":{"zh-Hans":"0012c303abde9486d025bf9eb61cfb9b942d36474ceb5f52e6cc062a18eb68d8","zh-Hant":"64b1cfaa3186a5e2d42d5eadc6fd441bc14fed8461a4d90b4c69cd700db1c6dd","ja_JP":"5bb00ac9aded37ea0022822ce285886ab94294bcd1de7f63fad022de73152507"},"plugins_erosion":{"zh-Hans":"6d97109e13593c62f2447626246dcffaf8c0987952a30487df856e1e870fbe1f","zh-Hant":"9b6fae8dd1c8904afb9c7f2e34d365d58890ca6be0a10287244319f946cb1a33","ja_JP":"80e0a62287008b0a8c5d19d6b6f2c3092656d49bf4a6f9bb159da7db43a19767"},"plugins_gaussian_blur":{"zh-Hans":"519677356e3b90b207103c5b99a7a61e72ca5b68a8aa516b6ac5cf966a51cb94","zh-Hant":"a9f9a7ad7b116bcab69e47a66834c1d9d71ec5a3ba53d7e81b8fbd3de8f93703","ja_JP":"23ecf27b148952abac48894fe4058085a1a331a183023b9109e38d1b14a3a645"},"plugins_grain":{"zh-Hans":"3be7acc13db73a23e59322b1399d8091f1c585922d5d9a53be197447c0c4f354","zh-Hant":"b8a5a5afec5ccb70ef60ddd9f5e3b9c1e39d8df5e98918a8faf241efe755a1b5","ja_JP":"eebda998072331a88270eb257df7c305d00b3f00db91314d9ea60d97f8a68d4a"},"plugins_light_sweep":{"zh-Hans":"5bb762fbaebb6dc2ad6f3ffe1d354dd7afe3d3441125218769a2cd02c550f8cf","zh-Hant":"8c5cbe733c3bc1c8bc8ffd810bb1489d31500e4b99857ac703d55d1676be1611","ja_JP":"67b598673f7344a84af49fe042ff6eff0c42e55ff72d8cacac0b05c8cda127cb"},"plugins_polar_coordinates":{"zh-Hans":"97475b5427544ca5aafe4930dafb8fe8940874017c56345310a75b776cde5b25","zh-Hant":"432af3981ba7537c956f3bc72bc7bd278e675c61536f9cd6387ca73e16aea22b","ja_JP":"427a67934e7faa52eaea723a038da1cdd7ef0174d44ace6bcabe90c162b36f43"},"plugins_ripple":{"zh-Hans":"0232b1ccfe7a98d06b5571152101c53d913ba0c45ec76d2ef412a967fbbe9dfb","zh-Hant":"a04d2ce66f7a3c0d2aea8f4a05e37c5da84144994aa42621e983de23c85e5209","ja_JP":"03caac5a0b9de359c45350f7d69de36462efef024df6005854bdcff6a26bd790"},"plugins_spherise":{"zh-Hans":"f73811c220a37e814d82e3f0f08d12d4c198424cfcfa3e484f8b626c679a01d7","zh-Hant":"3c704c61729b58f1bba8706cfe9bf9fc1a0f21447114c2247a9ae69195fd4b0d","ja_JP":"2e661220b375ca8a1dbecbd707ab3244a7c07fa7413f7dc1285bf46877204c5c"},"plugins_twist":{"zh-Hans":"f4236233d27e99a80377a32eeca3ce7485fdcfb5c0118876e52fdecba4a59f3a","zh-Hant":"0d1cefd1224eacf622267e38ac5259ded05adf59e6393a0e771328aa56111003","ja_JP":"d02cbd068b39a6a8a788c38fee90b731d05e20d40f16ae4a450c8f9fa0c3d572"},"plugins_zoom_blur":{"zh-Hans":"931b9f814664d2665850eb91235cc5e0119357fe9bbd62656af443d40a5bbe61","zh-Hant":"503275fa00e6f3f050ddb0c3371b795abb1c88acac7c4a6e867e18e448c9ed47","ja_JP":"d504f095c0a38bd68572876e8a8d8d99891716d3a0b9f5e1319a41204b19ba97"}});
const ROOT_SEMANTIC_EXPECTATIONS = Object.freeze({
  // -- 由主代理给定的有限语义锚；完整译文摘要仍须等独审后填入 --------
  projectPathsRemainRelative: Object.freeze({ 'zh-Hans': '相对于项目', 'zh-Hant': '相對於專案' }),
  filterAmountMeansStrengthOrPixels: Object.freeze({ 'zh-Hans': '模糊像素量', 'zh-Hant': '模糊像素量' }),
  grainChannelAmountIsNotACount: Object.freeze({ 'zh-Hans': '蓝色通道颗粒量', 'zh-Hant': '藍色通道顆粒量' }),
  chromaScreenMeansGreenBlueBackdrop: Object.freeze({ 'zh-Hans': '色幕颜色', 'zh-Hant': '色幕顏色' }),
});
const ROOT_SEMANTIC_COUNTEREXAMPLES = Object.freeze({
  // -- 最小坏例：丢relative、Amount作数量、通道Amount作数量、Screen作显示屏 --
  projectPathsRemainRelative: Object.freeze({ 'zh-Hans': '项目路径', 'zh-Hant': '專案路徑' }),
  filterAmountMeansStrengthOrPixels: Object.freeze({ 'zh-Hans': '数量', 'zh-Hant': '數量' }),
  grainChannelAmountIsNotACount: Object.freeze({ 'zh-Hans': '蓝色数量', 'zh-Hant': '藍色數量' }),
  chromaScreenMeansGreenBlueBackdrop: Object.freeze({ 'zh-Hans': '屏幕颜色', 'zh-Hant': '螢幕顏色' }),
});
const SORT = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const shaJson = value => sha(JSON.stringify(value));
const modulePath = file => path.join(REPO_ROOT, 'languages/native', `${file}.js`);
const required = relative => require(path.join(REPO_ROOT, relative));

function sortedRows(rows) {
  return [...rows].sort((a, b) => SORT(a.key, b.key));
}
function keysetDigest(rows) {
  return shaJson(sortedRows(rows).map(row => row.key));
}
function sourcePairsDigest(rows) {
  return shaJson(sortedRows(rows).map(row => [row.key, row.source]));
}
function sourceIdentity(row) {
  return [row.key, row.catalogId, row.owner ?? null, row.fieldPath, row.source,
    row.notes || [], row.dontTranslate === true, row.vendorJapanese ?? null];
}
function sourceIdentityDigest(rows) {
  return shaJson(sortedRows(rows).map(sourceIdentity));
}
function localeDecisionDigest(rows, locale) {
  return shaJson(sortedRows(rows).map(row => [row.key, row.translations[locale].decision, row.translations[locale].text]));
}
function localeDecisionSummary(rows) {
  return Object.fromEntries(LANGUAGES.map(locale => [locale, localeDecisionDigest(rows, locale)]));
}
function sourceLeaf(row, text) {
  const leaf = { 'UI-text': text, notes: [...(row.notes || [])] };
  if (row.dontTranslate === true) leaf.dontTranslate = true;
  return leaf;
}
function setLeaf(root, fieldPath, leaf) {
  let cursor = root;
  for (const key of fieldPath.slice(0, -1)) {
    cursor[key] ??= {};
    assert.ok(cursor[key] && typeof cursor[key] === 'object' && !Array.isArray(cursor[key]), `valid nested source path ${fieldPath.join('.')}`);
    cursor = cursor[key];
  }
  const key = fieldPath.at(-1);
  assert.equal(Object.hasOwn(cursor, key), false, `unique source field path ${fieldPath.join('.')}`);
  cursor[key] = leaf;
}
function producerPairs(rows) {
  const groups = new Map();
  for (const row of rows) {
    let group = groups.get(row.catalogId);
    if (!group) {
      group = { id: row.catalogId, type: row.catalogId.endsWith('/strings') && row.catalogId.startsWith('Learn/Guides/') ? 'strings' : 'layerStrings', strings: {}, owners: new Map() };
      groups.set(row.catalogId, group);
    }
    if (group.type === 'strings') {
      assert.equal(row.fieldPath.length, 1, `guide string field path is one registry key: ${row.key}`);
      group.strings[row.fieldPath[0]] = sourceLeaf(row, row.source);
      continue;
    }
    assert.equal(typeof row.owner, 'string', `layer entry has canonical producer owner: ${row.key}`);
    const [author, ...layerParts] = row.owner.split('::');
    const layerType = layerParts.join('::');
    assert.ok(author && layerType, `owner has author::layerType shape: ${row.owner}`);
    if (!group.owners.has(row.owner)) group.owners.set(row.owner, { author, layerType });
    setLeaf(group.owners.get(row.owner), row.fieldPath, sourceLeaf(row, row.source));
  }
  const pairs = [...groups.values()].map(group => ({
    id: group.id,
    source: group.type === 'strings'
      ? [{ type: 'strings', value: group.strings }]
      : [...group.owners.values()].map(value => ({ type: 'layerStrings', value })),
    japanese: [],
  }));
  const byCatalog = new Map(pairs.map(pair => [pair.id, pair]));
  for (const row of rows) {
    if (row.vendorJapanese == null) continue;
    const pair = byCatalog.get(row.catalogId);
    const japaneseLeaf = sourceLeaf(row, row.vendorJapanese);
    if (row.catalogId.endsWith('/strings') && row.catalogId.startsWith('Learn/Guides/')) {
      let record = pair.japanese[0];
      if (!record) pair.japanese.push(record = { type: 'strings', value: {} });
      record.value[row.fieldPath[0]] = japaneseLeaf;
    } else {
      const author = row.owner.split('::')[0];
      const layerType = row.owner.split('::').slice(1).join('::');
      let record = pair.japanese.find(candidate => candidate.value.author === author && candidate.value.layerType === layerType);
      if (!record) pair.japanese.push(record = { type: 'layerStrings', value: { author, layerType } });
      setLeaf(record.value, row.fieldPath, japaneseLeaf);
    }
  }
  return pairs.sort((a, b) => SORT(a.id, b.id));
}
function nativeProjection(rows, pairs) {
  const { collectNativeCatalog } = required('tools/native_language_pack.js');
  return pairs.flatMap(pair => {
    const result = collectNativeCatalog(pair.id, pair.source, pair.japanese);
    assert.deepEqual(result.unmapped, [], `${pair.id} has no unsupported producer identities`);
    return result.entries;
  });
}
function updateLeafText(pair, row, replacement, japanese = false) {
  const records = japanese ? pair.japanese : pair.source;
  if (pair.id === 'Learn/Guides/Translation/strings') {
    const leaf = records[0].value[row.fieldPath[0]];
    leaf['UI-text'] = replacement;
    return;
  }
  const owner = row.owner.split('::');
  const record = records.find(item => item.value.author === owner[0] && item.value.layerType === owner.slice(1).join('::'));
  assert.ok(record, `fixture owner exists for ${row.key}`);
  let leaf = record.value;
  for (const key of row.fieldPath) leaf = leaf[key];
  leaf['UI-text'] = replacement;
}
function assertTargetAndCatalogBinding(modules, rows) {
  const targetBytes = fs.readFileSync(path.join(REPO_ROOT, 'tools/fixtures/cavalry_native_target_2_8_0.json'));
  const target = JSON.parse(targetBytes);
  assert.equal(officialTargetSha256(targetBytes), TARGET.manifestSha256, 'historical 2.8.0 target/source domain stays source-bound');
  assert.equal(target.cavalryVersion, '2.8.0');
  const targetCatalogs = new Map(target.catalogs.map(catalog => [catalog.id, catalog]));
  assert.equal(MODULES.length, 15);
  assert.equal(rows.length, 396);
  assert.deepEqual(MODULES.reduce((sum, item) => sum + item.count, 0), 396);
  assert.deepEqual(new Set(MODULES.map(item => item.catalogId)).size, 15);
  for (const { file, catalogId, count } of MODULES) {
    const data = modules.get(file);
    const targetEntry = targetCatalogs.get(catalogId);
    assert.ok(targetEntry, `target manifest contains full catalog ${catalogId}`);
    assert.equal(data.entries.length, count, `${file} covers its complete catalog slice`);
    assert.ok(data.entries.every(row => row.catalogId === catalogId), `${file} does not leak adjacent catalog identities`);
    const p = data.provenance;
    assert.equal(p.catalogId, catalogId, `${file} provenance uses canonical catalog identity`);
    assert.equal(p.catalogPath, targetEntry.source, `${file} binds official source path`);
    assert.equal(p.sourceSha256, targetEntry.sourceSha256, `${file} binds official source bytes`);
    assert.equal(p.vendorJapanesePath, targetEntry.japanese, `${file} binds vendor Japanese path`);
    assert.equal(p.vendorJapaneseSha256, targetEntry.japaneseSha256, `${file} binds vendor Japanese bytes`);
    assert.equal(p.officialTargetManifestSha256, TARGET.manifestSha256, `${file} binds exact target manifest`);
  }
  assert.equal(new Set(rows.map(row => row.key)).size, 396, 'canonical keyset is globally unique');
  assert.ok(rows.every(row => !row.key.startsWith('guide:') && !row.key.startsWith('plugin:')),
    'research-only guide:/plugin: identifiers never enter the runtime registry');
  assert.equal(keysetDigest(rows), TARGET.canonicalKeysetSha256, 'runtime keys equal the audited canonical keyset');
  assert.equal(sourcePairsDigest(rows), TARGET.sourcePairsSha256, 'canonical key/source pairs remain exact');
  assert.equal(sourceIdentityDigest(rows), TARGET.sourceIdentityAndNotesSha256,
    'catalog, owner, field path, source, notes, DNT and vendor-JA identity remain exact');
}
function assertModuleProvenance(modules) {
  const all = [...modules.values()].flatMap(({ entries }) => entries);
  assert.equal(MODULES.length, FULL_REVIEW_SCOPE.catalogs, 'review batch catalog scope is 15');
  assert.equal(all.length, FULL_REVIEW_SCOPE.entries, 'review batch entry scope is 396');
  assert.equal(all.length * LANGUAGES.length, FULL_REVIEW_SCOPE.localeSlots, 'two independent full reviews cover all 1188 locale slots');
  assert.match(ROOT_APPROVAL.sourceApprovalSha256 || '', /^[a-f0-9]{64}$/,
    'primary must provide the exact source-bound approval digest before registration');
  assert.match(ROOT_APPROVAL.rootRevisedCandidateSha256 || '', /^[a-f0-9]{64}$/,
    'primary must pin the final root-revised candidate digest');
  assert.match(ROOT_APPROVAL.rootAdjudicationSha256 || '', /^[a-f0-9]{64}$/,
    'primary must pin the final root adjudication digest');
  assert.ok(ROOT_APPROVAL.localeTranslationSha256 && typeof ROOT_APPROVAL.localeTranslationSha256 === 'object',
    'primary must provide the final per-locale decision/text digests');
  for (const { file, count } of MODULES) {
    const { provenance: p, entries } = modules.get(file);
    assert.equal(p.cavalryVersion, '2.8.0');
    assert.equal(p.qtVersion, '6.9.2');
    assert.equal(p.bundleIdentifier, 'com.scenegroup.cavalry');
    assert.equal(p.keyCount, count);
    assert.equal(p.decisionSlotCount, count * LANGUAGES.length);
    assert.equal(p.keysetSha256, keysetDigest(entries));
    assert.equal(p.sourcePairsSha256, sourcePairsDigest(entries));
    assert.equal(p.sourceIdentityAndNotesSha256, sourceIdentityDigest(entries));
    assert.deepEqual(p.translationDecisionsSha256, HISTORICAL_MODULE_LOCALE_DIGESTS[file]);
    assert.equal(p.approvalState, 'approved-source-bound-display-input');
    assert.equal(p.approvedBy, 'primary-agent');
    assert.equal(p.candidateModel, 'gpt-6-luna');
    assert.equal(p.candidateReasoningEffort, 'max');
    assert.equal(p.providerEndTurnMetadataObserved, false);
    assert.equal(p.independentFullReviewCount, 2);
    assert.equal(p.independentFullReviewSlotsPerReviewer, FULL_REVIEW_SCOPE.localeSlots,
      `${file} records the full-batch 1188-slot reviewer scope, not a per-module slot count`);
    assert.equal(p.independentFullReviewReceipts.length, 2);
    assert.ok(p.independentFullReviewReceipts.every(receipt => /^[a-f0-9]{64}$/.test(receipt.sha256)));
    assert.equal(p.sourceJsonSha256, TARGET.sourceJsonSha256, `${file} binds the exact captured source JSON`);
    assert.equal(p.sourceApprovalSha256, ROOT_APPROVAL.sourceApprovalSha256,
      `${file} carries the exact primary-approved source-bound digest`);
    assert.equal(p.rootRevisedCandidateSha256, ROOT_APPROVAL.rootRevisedCandidateSha256,
      `${file} binds the primary's final revised candidate`);
    assert.equal(p.rootAdjudicationSha256, ROOT_APPROVAL.rootAdjudicationSha256,
      `${file} binds the primary's final adjudication`);
    assert.equal(p.liveVerified, false);
    assert.equal(p.live, 'NOT_RUN');
    assert.equal(p.publicRelease, 'NOT_APPROVED');
  }
  for (const [file, data] of modules) assert.deepEqual(localeDecisionSummary(data.entries), CURRENT_MODULE_LOCALE_DIGESTS[file], `${file} current approved locale digests`);
  assert.equal(all.length, 396);
  assert.deepEqual(localeDecisionSummary(all), CURRENT_REAUDIT_LOCALE_DIGESTS,
    'three locale decision/text digests must be supplied by the primary agent after adjudication');
}
function assertRegistration(modules) {
  const registry = required('languages/native/approved_modules.js');
  for (const { file } of MODULES) assert.ok(registry.APPROVED_MODULES.includes(file), `${file} is explicitly registered`);
  assert.equal(new Set(registry.APPROVED_MODULES).size, registry.APPROVED_MODULES.length, 'approval registry has no duplicate modules');
  const registered = registry.approvedEntries();
  assert.equal(new Set(registered.map(row => row.key)).size, registered.length, 'approval registry has no duplicate runtime keys');
  for (const row of [...modules.values()].flatMap(module => module.entries)) {
    assert.deepEqual(registered.find(candidate => candidate.key === row.key), row, `${row.key} is exposed unchanged by approvedEntries()`);
  }
}
function assertDecisionsAndDnt(rows) {
  const dnt = rows.filter(row => row.dontTranslate === true).map(row => row.key).sort(SORT);
  assert.deepEqual(dnt, [...DNT_KEYS].sort(SORT), 'only the six audited demo identity labels are DNT');
  const vendorChanges = rows.filter(row => row.vendorJapanese && row.vendorJapanese !== row.source);
  assert.equal(vendorChanges.length, 390, 'exactly 390 source rows have changed vendor-Japanese values');
  assert.equal(rows.filter(row => row.dontTranslate === true && row.vendorJapanese !== row.source).length, 0,
    'DNT rows do not acquire competing vendor translations');
  const registry = new Map(APPROVED_VENDOR_CORRECTIONS.map(proof => [proof.key, proof]));
  assert.equal(registry.size, 13, 'only the finite root-approved Japanese corrections are registered');
  for (const row of vendorChanges) {
    const proof = registry.get(row.key);
    if (!proof) {
      assert.equal(row.translations.ja_JP.text, row.vendorJapanese,
        `${row.key} Japanese review slot remains byte-for-byte equal to official vendor JA`);
      assert.equal(Object.hasOwn(row.translations.ja_JP, 'vendorCorrection'), false);
    } else {
      assert.equal(nativeSourceIdentitySha256(row), proof.sourceIdentitySha256);
      assert.equal(sha(row.translations.ja_JP.text), proof.translationSha256);
      assert.equal(proof.approvalReceiptSha256, '5c85772dbbe527736eb35487cd63f6c5f4a1d97fbe2a0de0fa23d06694e7abc6');
      assert.deepEqual(row.translations.ja_JP.vendorCorrection, { approvedBy: 'primary-agent',
        approvalState: 'approved-source-bound-vendor-correction', sourceIdentitySha256: proof.sourceIdentitySha256,
        translationSha256: proof.translationSha256, vendorJapanese: row.vendorJapanese,
        approvalReceiptSha256: proof.approvalReceiptSha256 });
    }
  }
  for (const row of rows) {
    assert.ok(Array.isArray(row.notes) && row.notes.every(note => typeof note === 'string'), `${row.key} source notes are explicit`);
    assert.deepEqual(Object.keys(row.translations).sort(), [...LANGUAGES].sort(), `${row.key} has all three explicit locale decisions`);
    for (const locale of LANGUAGES) {
      const decision = row.translations[locale];
      assert.ok(['translate', 'preserve'].includes(decision.decision), `${row.key}/${locale} decision is explicit`);
      assert.ok(typeof decision.text === 'string' && decision.text.trim(), `${row.key}/${locale} display text is nonempty`);
      assert.equal(decision.decision === 'preserve', decision.text === row.source,
        `${row.key}/${locale} preserve means exact source, translation means changed text`);
      if (row.dontTranslate === true) {
        assert.equal(decision.decision, 'preserve', `${row.key}/${locale} official DNT is preserved`);
      }
    }
  }
}
function findEntry(rows, key) {
  const row = rows.find(candidate => candidate.key === key);
  assert.ok(row, `semantic anchor exists in official 396-key scope: ${key}`);
  return row;
}
function glossaryTerm(name) {
  const text = fs.readFileSync(path.join(REPO_ROOT, 'docs/cavalry-glossary.md'), 'utf8');
  const line = text.split(/\r?\n/).find(value => new RegExp(`^\\|\\s*${name}\\s*\\|`).test(value));
  assert.ok(line, `project glossary contains ${name}`);
  const cells = line.split('|').map(cell => cell.trim()).filter(Boolean);
  assert.ok(cells.length >= 4, `glossary row has source, zh-Hans, zh-Hant, ja: ${name}`);
  return cells[2];
}
function assertSemanticRegressions(rows, currentApprovedRows) {
  const byLocale = (key, locale) => findEntry(rows, key).translations[locale].text;
  const current = new Map(currentApprovedRows.map(row => [row.key, row]));
  for (const locale of CHINESE_LOCALES) {
    const magic = current.get('menu.anim.magicEasing')?.translations?.[locale]?.text;
    const bounce = current.get('menu.anim.easingBounceOut')?.translations?.[locale]?.text;
    assert.ok(magic && bounce, `current reviewed menu captions exist for ${locale}`);
    const guide = byLocale('onboarding.animationBasics.step3.body', locale);
    assert.ok(guide.includes(magic), `${locale} Guide references the currently approved Magic Easing menu caption`);
    assert.ok(guide.includes(bounce), `${locale} Guide references the currently approved Bounce Out menu caption`);
    const line = byLocale('nodeAttrEnum:sceneGroup::lightSweepFilter.shape.0', locale);
    assert.ok(byLocale('attrInfo:sceneGroup::lightSweepFilter.useFalloff', locale).includes(line),
      `${locale} useFalloff tooltip references this filter's current Line enum`);
  }
  assert.ok(byLocale('onboarding.animationBasics.step3.body', 'zh-Hant').includes(glossaryTerm('Keyframe')),
    'zh-Hant Keyframe uses the approved project glossary term');
  assert.ok(byLocale('onboarding.animationBasics.step2.body', 'zh-Hant').includes(glossaryTerm('Viewport')),
    'zh-Hant Viewport uses the approved project glossary term');
  assert.ok(byLocale('onboarding.uiDeepDive.step4.body', 'zh-Hant').includes(glossaryTerm('Frame Rate')),
    'zh-Hant Frame Rate uses the approved project glossary term');
  const spheriseShininess = byLocale('nodeAttr:sceneGroup::spheriseFilter.shininess', 'zh-Hant');
  assert.doesNotMatch(spheriseShininess, /泽/, '繁體 Spherise Shininess must not contain the simplified character 泽');

  const semanticAnchors = {
    projectPathsRemainRelative: findEntry(rows, 'onboarding.uiDeepDive.step6.body'),
    filterAmountMeansStrengthOrPixels: findEntry(rows, 'attrInfo:sceneGroup::bilateralBlurFilter.amount'),
    grainChannelAmountIsNotACount: findEntry(rows, 'nodeAttr:sceneGroup::grainFilter.blueAmount'),
    chromaScreenMeansGreenBlueBackdrop: findEntry(rows, 'nodeAttr:sceneGroup::chromaKeyFilter.screenColor'),
  };
  for (const [contract, entry] of Object.entries(semanticAnchors)) {
    for (const locale of CHINESE_LOCALES) {
      const reviewedFragment = ROOT_SEMANTIC_EXPECTATIONS[contract]?.[locale];
      const negativeFragment = ROOT_SEMANTIC_COUNTEREXAMPLES[contract]?.[locale];
      assert.ok(typeof reviewedFragment === 'string' && reviewedFragment.trim(),
        `primary must fill reviewed semantic fragment ${contract}/${locale}; do not copy draft candidate wording`);
      assert.ok(typeof negativeFragment === 'string' && negativeFragment.trim() && negativeFragment !== reviewedFragment,
        `primary must fill a distinct reviewed negative fragment ${contract}/${locale}`);
      assert.ok(entry.translations[locale].text.includes(reviewedFragment),
        `${contract}/${locale} retains the root-reviewed semantic distinction`);
      assert.ok(!entry.translations[locale].text.includes(negativeFragment),
        `${contract}/${locale} rejects the root-reviewed semantic counterexample`);
    }
  }
}
function replaceText(rows, key, locale, before, after) {
  const row = findEntry(rows, key);
  assert.ok(row.translations[locale].text.includes(before), `${key}/${locale} includes mutation anchor`);
  row.translations[locale].text = row.translations[locale].text.replace(before, after);
  return row;
}
function assertSemanticRegressionNegatives(rows, currentApprovedRows) {
  const { assertNativeTranslationFormat } = required('tools/native_translation_format.js');
  assert.doesNotThrow(() => assertSemanticRegressions(rows, currentApprovedRows), 'approved actual rows pass before mutants');
  const current = new Map(currentApprovedRows.map(row => [row.key, row]));
  const semantics = [
    ['projectPathsRemainRelative', 'onboarding.uiDeepDive.step6.body'],
    ['filterAmountMeansStrengthOrPixels', 'attrInfo:sceneGroup::bilateralBlurFilter.amount'],
    ['grainChannelAmountIsNotACount', 'nodeAttr:sceneGroup::grainFilter.blueAmount'],
    ['chromaScreenMeansGreenBlueBackdrop', 'nodeAttr:sceneGroup::chromaKeyFilter.screenColor'],
  ];
  for (const [contract, key] of semantics) for (const locale of CHINESE_LOCALES) {
    const good = ROOT_SEMANTIC_EXPECTATIONS[contract][locale];
    const bad = ROOT_SEMANTIC_COUNTEREXAMPLES[contract][locale];
    const mutant = structuredClone(rows);
    const changed = replaceText(mutant, key, locale, good, bad);
    assert.doesNotThrow(() => assertNativeTranslationFormat(changed.source, changed.translations[locale].text),
      `${contract}/${locale} mutant preserves source runtime format`);
    assert.throws(() => assertSemanticRegressions(mutant, currentApprovedRows), undefined,
      `${contract}/${locale} rejects loss of the reviewed meaning in a clone of the formal row`);
  }
  for (const locale of CHINESE_LOCALES) {
    const guideKey = 'onboarding.animationBasics.step3.body';
    for (const [captionKey, label] of [
      ['menu.anim.magicEasing', 'Magic Easing'],
      ['menu.anim.easingBounceOut', 'Bounce Out'],
    ]) {
      const caption = current.get(captionKey)?.translations?.[locale]?.text;
      assert.ok(caption, `${locale} currently approved ${label} caption exists`);
      const mutant = structuredClone(rows);
      const changed = replaceText(mutant, guideKey, locale, caption, `__wrong_${label.replaceAll(' ', '_')}__`);
      assert.doesNotThrow(() => assertNativeTranslationFormat(changed.source, changed.translations[locale].text),
        `${locale} wrong ${label} caption mutant preserves the Guide's HTML contract`);
      assert.throws(() => assertSemanticRegressions(mutant, currentApprovedRows), undefined,
        `${locale} rejects the Guide's stale/wrong ${label} menu caption`);
    }
    const lineKey = 'nodeAttrEnum:sceneGroup::lightSweepFilter.shape.0';
    const circle = currentApprovedRows.find(row => row.key === 'nodeAttrEnum:sceneGroup::lightSweepFilter.shape.1')
      ?.translations?.[locale]?.text;
    const line = findEntry(rows, lineKey).translations[locale].text;
    assert.ok(circle && circle !== line, `${locale} current Line/Circle enum captions are distinct`);
    const mutant = structuredClone(rows);
    const changed = replaceText(mutant, 'attrInfo:sceneGroup::lightSweepFilter.useFalloff', locale, line, circle);
    assert.doesNotThrow(() => assertNativeTranslationFormat(changed.source, changed.translations[locale].text),
      `${locale} stale Line enum mutant preserves format`);
    assert.throws(() => assertSemanticRegressions(mutant, currentApprovedRows), undefined,
      `${locale} rejects a useFalloff tooltip that cites Circle rather than the current Line enum`);
  }
  const hantShininess = structuredClone(rows);
  const shininess = findEntry(hantShininess, 'nodeAttr:sceneGroup::spheriseFilter.shininess');
  shininess.translations['zh-Hant'].text += '泽';
  assert.doesNotThrow(() => assertNativeTranslationFormat(shininess.source, shininess.translations['zh-Hant'].text));
  assert.throws(() => assertSemanticRegressions(hantShininess, currentApprovedRows), /泽/,
    'a Hant Spherise Shininess clone with simplified 泽 is rejected');

  const vendorMutant = structuredClone(rows);
  const vendorRow = vendorMutant.find(row => row.vendorJapanese && row.vendorJapanese !== row.source);
  assert.ok(vendorRow, 'a real changed official vendor-JA row exists for a drift counterexample');
  vendorRow.translations.ja_JP.text += ' [drift]';
  assert.throws(() => assertDecisionsAndDnt(vendorMutant), /byte-for-byte equal/,
    'a real Japanese row clone drifting from vendor bytes is rejected');
}
function assertRealProducer(rows) {
  const { buildNativeResourceBundle } = required('tools/native_resource_bundle.js');
  const pairs = producerPairs(rows);
  const before = JSON.stringify(pairs);
  const approved = rows.map(row => ({ ...row, translations: structuredClone(row.translations) }));
  const result = buildNativeResourceBundle(pairs, approved);
  assert.equal(result.manifest.nativeKeys, 396);
  assert.equal(result.manifest.approvedUIKeys, 396);
  assert.equal(result.manifest.complete, true);
  assert.equal(result.manifest.packs.ja_JP.vendor, 390, 'real resolver counts exactly 390 vendor-origin slots, including 13 approved corrections');
  assert.equal(result.manifest.packs.ja_JP.preserved, 6, 'DNT remains source in Japanese despite vendor/review paths');
  for (const [locale, nativeLocale] of [['zh-Hans', 'zh-Hans'], ['zh-Hant', 'zh-Hant'], ['ja_JP', 'ja']]) {
    const [record] = JSON.parse(result.packs[locale]);
    assert.equal(record.type, 'strings');
    assert.equal(record.language, nativeLocale);
    assert.equal(Object.keys(record.value).length, 396, `${locale} projects all 396 resolved UI strings`);
    assert.ok(Object.values(record.value).every(value => Object.keys(value).length === 1 && typeof value['UI-text'] === 'string'),
      `${locale} output is UI-text-only`);
    if (locale === 'ja_JP') for (const row of rows) {
      const expected = row.dontTranslate === true ? row.source
        : row.translations.ja_JP.vendorCorrection ? row.translations.ja_JP.text
          : row.vendorJapanese && row.vendorJapanese !== row.source ? row.vendorJapanese
          : row.translations.ja_JP.text;
      assert.equal(record.value[row.key]['UI-text'], expected, `${row.key} Japanese runtime pack uses exact vendor/DNT/review precedence`);
    }
  }
  assert.equal(JSON.stringify(pairs), before, 'the production projection does not mutate source/Japanese catalogs');

  const projected = nativeProjection(rows, pairs);
  assert.equal(keysetDigest(projected), TARGET.canonicalKeysetSha256,
    'collectNativeCatalog derives the producer keyspace; research keys cannot substitute');
  assert.equal(sourceIdentityDigest(projected), TARGET.sourceIdentityAndNotesSha256,
    'actual producer projections preserve all canonical source identity and vendor-JA fields');

  const sourceMutation = structuredClone(pairs);
  const mutationRow = rows.find(row => row.catalogId === 'Learn/Guides/Translation/strings' && row.source.length > 0);
  updateLeafText(sourceMutation.find(pair => pair.id === mutationRow.catalogId), mutationRow, `${mutationRow.source} mutation`);
  assert.throws(() => buildNativeResourceBundle(sourceMutation, approved), /approved source differs/,
    'real bundle producer rejects changed source identity before emission');
  const notesMutation = structuredClone(pairs);
  const pluginRow = rows.find(row => row.catalogId !== 'Learn/Guides/Translation/strings' && row.notes.length > 0);
  let leaf = notesMutation.find(pair => pair.id === pluginRow.catalogId).source[0].value;
  for (const part of pluginRow.fieldPath) leaf = leaf[part];
  leaf.notes = [...leaf.notes, 'unreviewed context mutation'];
  assert.throws(() => buildNativeResourceBundle(notesMutation, approved), /approved notes differs/,
    'real bundle producer rejects changed source notes before emission');
}
function assertFormats(rows) {
  const { assertNativeTranslationFormat } = required('tools/native_translation_format.js');
  let checked = 0;
  for (const row of rows) for (const locale of LANGUAGES) {
    assertNativeTranslationFormat(row.source, row.translations[locale].text);
    checked += 1;
  }
  assert.equal(checked, 1188, 'all 396×3 target strings pass runtime-token/HTML/ICU format validation');
  const placeholderRow = findEntry(rows, 'onboarding.animationBasics.step0.body');
  assert.throws(() => assertNativeTranslationFormat(placeholderRow.source,
    placeholderRow.translations['zh-Hans'].text.replace('{0}', '')),
  /placeholder|format/i, 'a lost graphic placeholder is rejected');
  const htmlRow = findEntry(rows, 'onboarding.animationBasics.step3.body');
  assert.throws(() => assertNativeTranslationFormat(htmlRow.source,
    htmlRow.translations['zh-Hant'].text.replace('</b>', '')),
  /HTML|format/i, 'a changed rich-text boundary is rejected');
}

test('15 complete Guide/Plugin modules are present before any candidate data can pass', async t => {
  const modules = new Map();
  for (const spec of MODULES) {
    await t.test(`${spec.file}: formal source-bound module exists`, () => {
      const file = modulePath(spec.file);
      assert.ok(fs.existsSync(file), `RED: missing formal module ${file}`);
      const data = require(file);
      assert.ok(data && Array.isArray(data.entries), `${spec.file} exports entries`);
      assert.ok(data.provenance && typeof data.provenance === 'object', `${spec.file} exports provenance`);
      modules.set(spec.file, data);
    });
  }
  // -- 当前缺模块时只报告真实RED；不构造stub、不消费stage译稿、不假装跑绿色合同 --
  if (modules.size !== MODULES.length) return;

  const rows = [...modules.values()].flatMap(module => module.entries);
  await t.test('all 15 catalog identities and 396 canonical source rows are exact', () => assertTargetAndCatalogBinding(modules, rows));
  await t.test('root and independent-review provenance binds approved decisions, not candidate drafts', () => assertModuleProvenance(modules));
  await t.test('registration is explicit and visible through approvedEntries()', () => assertRegistration(modules));
  await t.test('three-locale decisions, six DNT keys and 390 vendor-JA values are complete', () => assertDecisionsAndDnt(rows));
  await t.test('source/notes changes fail at the actual resource-bundle producer', () => assertRealProducer(rows));
  await t.test('all translations preserve runtime placeholder, HTML and ICU structure', () => assertFormats(rows));
  await t.test('finite semantic baselines and actual-row counterexamples are enforced', () => {
    const currentApprovedRows = required('languages/native/approved_modules.js').approvedEntries();
    assertSemanticRegressions(rows, currentApprovedRows);
    assertSemanticRegressionNegatives(rows, currentApprovedRows);
  });
});

test('shared production format gate rejects placeholder loss and ICU branch loss', () => {
  const { assertNativeTranslationFormat } = required('tools/native_translation_format.js');
  assert.doesNotThrow(() => assertNativeTranslationFormat('Click {0} to continue.', '按下 {0} 繼續。'));
  assert.throws(() => assertNativeTranslationFormat('Click {0} to continue.', '按下繼續。'), /placeholder|format/i);
  const source = '{count, plural, one {# file} other {# files}}';
  assert.doesNotThrow(() => assertNativeTranslationFormat(source, '{count, plural, one {# Datei} other {# Dateien}}'));
  assert.throws(() => assertNativeTranslationFormat(source, '{count, plural, one {# Datei}}'), /ICU|format|OTHER/i);
});
