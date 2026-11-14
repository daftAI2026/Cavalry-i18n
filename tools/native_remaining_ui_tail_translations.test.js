/**
 * [INPUT]: 依赖已审定剩余UI分区、共享source/格式守门及Forge/缺源/隐藏caption/插件caption补充。
 * [OUTPUT]: 锁定五分区、82模块/10753审批键与100项demo DNT例外；保护B-6实测范围及原译值。
 * [POS]: tools剩余UI测试后半合同；不读取私账、不调用App、不批准或代表live。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { LOCALES, hash, assertAdditionalPartition, assertFiniteRepairs } = require('./native_remaining_ui_contract');
const { APPROVED_MODULES, approvedEntries } = require('../languages/native/approved_modules');
const DEMO_MENU_DNT_KEY_SET = new Set(require('../languages/native/official_demo_menus').DEMO_MENU_DNT_KEYS);
const TARGET = require('./fixtures/cavalry_native_target_2_8_0.json');
const { BACKGROUND_RENDERING_GAP_COUNT } = require('./native_schema_gap_sources');
const { NODE_A_FIFTH_REPAIRS, NODE_B_FIFTH_REPAIRS, NODE_B_SIXTH_REPAIRS, NODE_A_SIXTH_REPAIRS, NODE_B_FOURTH_REPAIRS } = require('./native_remaining_ui_final_repair_cases');

const NODE_A_FIFTH = Object.freeze({
  module: 'remaining_node_ui_a_05',
  keys: 414,
  keyset: '84fc7ad3438b27f022e3d537c1579c02b15e0b8440b1075c54eacd1adcee8a0b',
  pairs: '54126090be0150b46850192bba9575bd94b443516fd6732bb07df456f1b15e18',
  identity: '87f6213d99f966f58bc3c1157a986a1943c03ef1b2b52e20ad8c5ad8b4263dbb',
  decisions: '68e1a7356c4a2354a1559bab0da5cdfe0ee811d2aa760aade783c35c97672856',
});

const NODE_B_SIXTH = Object.freeze({
  module: 'remaining_node_ui_b_06',
  keys: 328,
  keyset: 'f87dfcee5815f9e8c3bb83f7bc299f29b5cdd4b250bbb2eae704fbc8b965fb1c',
  pairs: 'd811bf6d9b737abc776d06a98f04bffe7ee79404fc879d60698d8fac57e5b82e',
  identity: 'db7a538a3126ce7d90e6ab48be990f094558ca39ae1306128a145150fc5d9aae',
  decisions: '265d17bbad17408f3d40c5c59aae8ba44e49f71759889fb1b91457161b299648',
});
const NODE_A_SIXTH = Object.freeze({
  module: 'remaining_node_ui_a_06',
  keys: 402,
  keyset: 'c30bbc1bedf1091b877a9e6f94ebfab96b8c1f1fde75766a38d293ad42ecaa09',
  pairs: '6a05ac74a517d009583d4ec3453f883961d130524220d34aa5f18b4f85c20a02',
  identity: '7238c2941b0092ca6ff05750d31f43a394b5544660857dbe9c039839378c87ea',
  decisions: 'ca0cf9545684b3e47f486ff0e15d92fa76f7fd73fab68ac88daa391925782e15',
});
const NODE_B_FOURTH = Object.freeze({
  module: 'remaining_node_ui_b_04',
  keys: 449,
  keyset: '907aa8e5c7434550901d684bf45d470cac32295fbe6cbe72be4455a02e7cafdf',
  pairs: '00afe80cef308f7702ba30a6d72e2f8fce20e4a7da28d19f5563ff58cac78f65',
  identity: '474af5a8451e47c1218e4fb868ca59c1b5d820b834bbe818ff458ef2d74a77e8',
  decisions: 'a9e27abeef63b84591fd09feed41cbbd55c4f5b465de36ac321e343f30db1477',
});
const NODE_B_FIFTH = Object.freeze({
  module: 'remaining_node_ui_b_05',
  keys: 442,
  keyset: '43c734ea65f1cd6a1c1d6888399061d1359d3fb9340f0e710f1c3a5cedb8580b',
  pairs: '72f599988f4c9be64162909b835c3f6433422bb02b244de3aee016d8cbdfef6e',
  identity: 'b2c30b4a8322489ac62310585380ec336e45092ff671f585b3c5cad0ae709551',
  decisions: '361d746e0e2b249ecfd29af32a57d62a5ff8c9b4c5ca3ec8564a50d2c3480931',
});

const PRORES_PROFILES = Object.freeze({
  'zh-Hans': [
    'ProRes 422 HQ（1920x1080x29.97 下约 220 兆比特/秒）',
    'ProRes 422（1920x1080x29.97 下约 145 兆比特/秒）',
    'ProRes 422 LT（1920x1080x29.97 下约 100 兆比特/秒）',
    'ProRes 422 Proxy（1920x1080x29.97 下约 45 兆比特/秒）',
    'ProRes 4444（1920x1080x29.97 下约 330 兆比特/秒，不含 Alpha 通道）',
    'ProRes 4444 XQ（1920x1080x29.97 下约 495 兆比特/秒，不含 Alpha 通道）',
  ],
  'zh-Hant': [
    'ProRes 422 HQ（1920x1080x29.97 下約 220 兆位元/秒）',
    'ProRes 422（1920x1080x29.97 下約 145 兆位元/秒）',
    'ProRes 422 LT（1920x1080x29.97 下約 100 兆位元/秒）',
    'ProRes 422 Proxy（1920x1080x29.97 下約 45 兆位元/秒）',
    'ProRes 4444（1920x1080x29.97 下約 330 兆位元/秒，不含 Alpha 通道）',
    'ProRes 4444 XQ（1920x1080x29.97 下約 495 兆位元/秒，不含 Alpha 通道）',
  ],
  ja_JP: [
    'ProRes 422 HQ（1920x1080x29.97 で約 220 メガビット/秒）',
    'ProRes 422（1920x1080x29.97 で約 145 メガビット/秒）',
    'ProRes 422 LT（1920x1080x29.97 で約 100 メガビット/秒）',
    'ProRes 422 Proxy（1920x1080x29.97 で約 45 メガビット/秒）',
    'ProRes 4444（1920x1080x29.97 で約 330 メガビット/秒、Alpha チャンネルを除く）',
    'ProRes 4444 XQ（1920x1080x29.97 で約 495 メガビット/秒、Alpha チャンネルを除く）',
  ],
});

const PRORES_TOOLTIP_KEYS = Object.freeze(['attrInfo:renderProRes.codec', 'attrInfo:renderQuicktime.proResCodec']);
const data = () => require('../languages/native/remaining_node_ui_a_05');
const nodeB06 = () => require('../languages/native/remaining_node_ui_b_06');
const nodeA06 = () => require('../languages/native/remaining_node_ui_a_06');
const nodeB04 = () => require('../languages/native/remaining_node_ui_b_04');
const nodeB05 = () => require('../languages/native/remaining_node_ui_b_05');

test('Node A05 pins its complete 414-key source/identity/decision partition', () => {
  assertAdditionalPartition(NODE_A_FIFTH);
});

test('Node A05 pins 98 source-bound repairs and rejects every original-text rollback', () => {
  const rows = data().entries;
  assert.equal(NODE_A_FIFTH_REPAIRS.length, 98);
  assert.equal(new Set(NODE_A_FIFTH_REPAIRS.map(([key]) => key)).size, 43);
  assertFiniteRepairs(rows, NODE_A_FIFTH_REPAIRS);
  for (const [key, locale, before] of NODE_A_FIFTH_REPAIRS) {
    const reverted = structuredClone(rows);
    reverted.find(row => row.key === key).translations[locale].text = before;
    assert.throws(() => assertFiniteRepairs(reverted, NODE_A_FIFTH_REPAIRS), undefined, `${key}/${locale}`);
  }
});

test('Node A05 preserves numeric Fade, Fill All labels, complete ProRes tiers and codec identities', () => {
  const { entries, provenance } = data();
  const byKey = new Map(entries.map(row => [row.key, row]));
  const text = key => byKey.get(key).translations;
  assert.equal(provenance.rootRevision.changedKeys, 43);
  assert.equal(provenance.rootRevision.changedLocaleSlots, 98);
  assert.equal(provenance.rootRevision.confirmedErrorSlots, 47);
  assert.equal(provenance.rootRevision.advisorySlotsAdopted, 51);

  for (const locale of LOCALES) {
    const expectedProfiles = PRORES_PROFILES[locale];
    for (const key of PRORES_TOOLTIP_KEYS) {
      const row = byKey.get(key);
      const paragraphs = text(key)[locale].text.split('\n\n');
      assert.equal(row.source.includes('excluding alpha'), true, key);
      assert.deepEqual(paragraphs, expectedProfiles, `${key}/${locale}`);
      assert.equal(paragraphs.length, 6);
    }
  }

  assert.deepEqual(LOCALES.map(locale => text('nodeAttr:simpleValueSolver.fadeMode')[locale].text), ['衰减模式', '衰減模式', '減衰モード']);
  assert.deepEqual(LOCALES.map(locale => text('nodeAttrEnum:simpleValueSolver.fadeMode.1')[locale].text), ['按值衰减', '按值衰減', '値で減衰']);
  assert.deepEqual(LOCALES.map(locale => text('nodeAttr:simpleValueSolver.fadeValue')[locale].text), ['衰减值', '衰減值', '減衰値']);
  assert.deepEqual(LOCALES.map(locale => text('nodeInfo:simpleValueSolver')[locale].text), [
    '存储先前各帧的数值，以进行累积和／或衰减。',
    '儲存先前影格的數值，以進行累積和／或衰減。',
    '過去のフレームの値を保存し、累積および／または減衰させます。',
  ]);
  assert.match(byKey.get('nodeInfo:simpleValueSolver').notes.join(' '), /towards zero\/default over time/);

  assert.deepEqual(LOCALES.map(locale => text('nodeAttr:shapeEdgeDistribution.count')[locale].text), ['数量', '數量', '個数']);
  assert.deepEqual(LOCALES.map(locale => text('nodeAttr:shapeEdgeDistribution.fill')[locale].text), ['使用全部边', '使用全部邊', 'すべてのエッジを使用']);
  assert.deepEqual(LOCALES.map(locale => text('attrInfo:shapeEdgeDistribution.count')[locale].text), [
    '要使用的边数上限，按路径顺序取边。启用“使用全部边”时会忽略此值。',
    '要使用的邊數上限，依路徑順序取用邊。啟用「使用全部邊」時會忽略此值。',
    '使用するエッジ数の上限です。パスの順序に沿って選択します。「すべてのエッジを使用」がオンの場合は無視されます。',
  ]);
  assert.deepEqual(LOCALES.map(locale => text('attrInfo:shapeEdgeDistribution.fill')[locale].text), [
    '使用形状上的所有边，不受“数量”限制。',
    '使用形狀上的所有邊，不受「數量」限制。',
    '「個数」に関係なく、形状上のすべてのエッジを使います。',
  ]);
  assert.equal(byKey.get('nodeAttr:shapeEdgeDistribution.fill').notes[0], '"Fill" means use/include everything available.');

  const quickTime = byKey.get('nodeInfo:renderQuicktime');
  assert.equal(quickTime.source, 'Generate a QuickTime movie file.');
  assert.match(quickTime.notes.join(' '), /QuickTime is Apple’s video container format/);
  assert.deepEqual(LOCALES.map(locale => quickTime.translations[locale].text), [
    '生成 QuickTime 影片文件。', '產生 QuickTime 影片檔案。', 'QuickTime ムービーファイルを生成します。',
  ]);
  const sksl = byKey.get('nodeName:skslShader');
  assert.equal(sksl.source, 'SkSL Shader');
  assert.match(sksl.notes.join(' '), /name of a shader programming language/);
  assert.deepEqual(LOCALES.map(locale => sksl.translations[locale].text), ['SkSL 着色器', 'SkSL 著色器', 'SkSL シェーダー']);
});

test('Node B06 pins its complete 328-key source, identity and decision partition', () => {
  assertAdditionalPartition(NODE_B_SIXTH);
});

test('Node B06 pins all 40 source-bound repairs and rejects every original-text rollback', () => {
  const rows = nodeB06().entries;
  assert.equal(NODE_B_SIXTH_REPAIRS.length, 40);
  assert.equal(new Set(NODE_B_SIXTH_REPAIRS.map(([key]) => key)).size, 26);
  assertFiniteRepairs(rows, NODE_B_SIXTH_REPAIRS);
  for (const [key, locale, before] of NODE_B_SIXTH_REPAIRS) {
    const reverted = structuredClone(rows);
    reverted.find(row => row.key === key).translations[locale].text = before;
    assert.throws(() => assertFiniteRepairs(reverted, NODE_B_SIXTH_REPAIRS), undefined, `${key}/${locale}`);
  }
});

test('Node B06 keeps Stroke, Glyph, text-line, geometric-line, dimensional and physics roles source-bound', () => {
  const { entries, provenance } = nodeB06();
  const byKey = new Map(entries.map(row => [row.key, row]));
  const row = key => byKey.get(key);
  const text = (key, locale) => row(key).translations[locale].text;
  assert.equal(provenance.rootRevision.changedKeys, 26);
  assert.equal(provenance.rootRevision.changedLocaleSlots, 40);
  assert.equal(provenance.rootRevision.confirmedErrorSlots, 28);
  assert.equal(provenance.rootRevision.advisorySlotsAdopted, 12);

  // Stroke 描边是形状轮廓；繁中「筆畫」有成熟软件的合法几何用法，修订只为同owner一致性。
  assert.match(text('nodeInfo:toonOutlines', 'zh-Hant'), /多重描邊/);
  assert.equal(text('nodeTab:toonOutlines.stroke', 'zh-Hant'), '描邊');
  assert.match(row('nodeInfo:toonOutlines').notes.join(' '), /Stroke/);

  // 字形、文本行与几何线分别依各自notes定译，不全局合并 Line/Glyph。
  assert.match(text('nodeInfo:unicodeManipulator', 'zh-Hans'), /字形操作/);
  assert.match(text('nodeInfo:unicodeManipulator', 'zh-Hant'), /字形操作/);
  assert.match(text('nodeInfo:unicodeManipulator', 'ja_JP'), /グリフ操作/);
  assert.equal(text('nodeAttr:textHash.lineOffset', 'zh-Hans'), '行偏移');
  assert.equal(text('nodeAttr:textHash.lineOffset', 'zh-Hant'), '行偏移');
  assert.equal(text('nodeAttr:textHash.numberOfLines', 'zh-Hant'), '行數');
  assert.equal(text('nodeAttrEnum:trails.pathType.0', 'zh-Hans'), '直线段');
  assert.equal(text('nodeAttrEnum:trails.pathType.0', 'zh-Hant'), '直線段');
  assert.equal(text('nodeAttrEnum:unicodeManipulator.indexMode.2', 'zh-Hant'), '行');
  assert.match(row('nodeAttrEnum:trails.pathType.0').notes.join(' '), /geometric/);
  assert.match(row('nodeAttrEnum:unicodeManipulator.indexMode.2').notes.join(' '), /line of text/);

  assert.equal(text('nodeName:value2Blend', 'zh-Hant'), '混合二維數值');
  assert.equal(text('nodeName:value2Blend', 'ja_JP'), '2次元値をブレンド');
  assert.equal(text('nodeName:value3Array', 'zh-Hant'), '三維數值陣列');
  assert.equal(text('nodeName:value3Array', 'ja_JP'), '3次元値配列');
  assert.equal(text('nodeName:value3Blend', 'zh-Hant'), '混合三維數值');
  assert.equal(text('nodeName:value3Blend', 'ja_JP'), '3次元値をブレンド');
  assert.equal(text('nodeAttrEnum:thresholdFilter.blendMode.11', 'ja_JP'), '排他的論理和');
  assert.equal(text('nodeAttr:voronoiShader.levels', 'zh-Hans'), '层级');
  assert.equal(text('nodeAttr:voronoiShader.levels', 'zh-Hant'), '層級');
  assert.match(row('nodeAttr:voronoiShader.levels').notes.join(' '), /nested depth/);

  const bodyIndex = row('attrInfo:visibilityCollisionEvent.useCollisionIndex');
  assert.match(bodyIndex.notes.join(' '), /simulated physics object/);
  assert.doesNotMatch(text(bodyIndex.key, 'zh-Hans'), /刚体/);
  assert.doesNotMatch(text(bodyIndex.key, 'zh-Hant'), /剛體/);
  assert.match(text(bodyIndex.key, 'zh-Hans'), /物体索引/);
  assert.match(text(bodyIndex.key, 'zh-Hant'), /物體索引/);
  assert.match(text('nodeInfo:visibilityCollisionEvent', 'zh-Hans'), /动力学物体/);
  assert.match(text('nodeInfo:visibilityCollisionEvent', 'zh-Hant'), /動力學物體/);
  assert.doesNotMatch(text('nodeInfo:visibilityCollisionEvent', 'ja_JP'), /剛体/);
});

test('Node A06 pins its complete 402-key source, identity and decision partition', () => {
  assertAdditionalPartition(NODE_A_SIXTH);
});

test('Node A06 pins all 82 source-bound repairs and rejects every original-text rollback', () => {
  const { entries, provenance } = nodeA06();
  assert.equal(NODE_A_SIXTH_REPAIRS.length, 82);
  assert.equal(new Set(NODE_A_SIXTH_REPAIRS.map(([key]) => key)).size, 47);
  assert.equal(provenance.rootRevision.changedKeys, 47);
  assert.equal(provenance.rootRevision.changedLocaleSlots, 82);
  assert.equal(provenance.rootRevision.confirmedErrorSlots, 36);
  assert.equal(provenance.rootRevision.advisorySlotsAdopted, 46);
  assertFiniteRepairs(entries, NODE_A_SIXTH_REPAIRS);
  for (const [key, locale, before] of NODE_A_SIXTH_REPAIRS) {
    const reverted = structuredClone(entries);
    reverted.find(row => row.key === key).translations[locale].text = before;
    assert.throws(() => assertFiniteRepairs(reverted, NODE_A_SIXTH_REPAIRS), undefined, `${key}/${locale}`);
  }
});

test('Node A06 separates Taiwan spreadsheet axes, literal shortcuts, padding digits and numeric dimensions', () => {
  const { entries } = nodeA06();
  const byKey = new Map(entries.map(row => [row.key, row]));
  const text = (key, locale) => byKey.get(key).translations[locale].text;

  assert.equal(text('nodeAttr:spreadsheet.column', 'zh-Hant'), '欄標題');
  assert.equal(text('nodeAttr:spreadsheet.columnCount', 'zh-Hant'), '欄數');
  assert.equal(text('nodeAttr:spreadsheet.rowCount', 'zh-Hant'), '列數');
  assert.equal(text('nodeAttr:spreadsheet.rowIndex', 'zh-Hant'), '列索引');
  assert.equal(text('nodeAttr:spreadsheet.rowOffset', 'zh-Hant'), '列偏移');

  for (const key of ['attrInfo:string.string', 'attrInfo:stringArray.array']) {
    for (const locale of LOCALES) assert.match(text(key, locale), /Shift\+Return/);
  }
  assert.equal(text('nodeAttr:textDate.padding', 'zh-Hans'), '补零');
  assert.equal(text('nodeAttr:textDate.padding', 'zh-Hant'), '補零');
  assert.equal(text('nodeAttr:textValue.length', 'zh-Hans'), '补零位数');
  assert.equal(text('nodeAttr:textValue.length', 'zh-Hant'), '補零位數');
  assert.equal(text('nodeAttr:textValue.length', 'ja_JP'), 'ゼロ埋め桁数');

  assert.equal(text('nodeName:value2', 'zh-Hant'), '二維數值');
  assert.equal(text('nodeName:value2', 'ja_JP'), '2次元値');
  assert.equal(text('nodeName:value2Array', 'zh-Hant'), '二維數值陣列');
  assert.equal(text('nodeName:value3', 'zh-Hant'), '三維數值');
  assert.equal(text('nodeName:value3', 'ja_JP'), '3次元値');
  assert.equal(text('nodeAttrEnum:visualModifier.gradientMode.3', 'ja_JP'), 'Oklab 補間');
  assert.equal(text('nodeAttr:typeShape.monospaceMultiplier', 'ja_JP'), '等幅倍率');
  assert.equal(text('nodeAttr:visualModifier.scaleMultiplier', 'ja_JP'), 'スケール倍率');
  assert.equal(text('nodeAttrEnum:vortexField.noiseAffects.3', 'ja_JP'), '回転力');
});

test('Node B04 pins its complete 449-key source, identity and decision partition', () => {
  assertAdditionalPartition(NODE_B_FOURTH);
});

test('Node B04 pins all 58 source-bound repairs and rejects every original-text rollback', () => {
  const { entries, provenance } = nodeB04();
  assert.equal(NODE_B_FOURTH_REPAIRS.length, 58);
  assert.equal(new Set(NODE_B_FOURTH_REPAIRS.map(([key]) => key)).size, 34);
  assert.equal(provenance.rootRevision.changedKeys, 34);
  assert.equal(provenance.rootRevision.changedLocaleSlots, 58);
  assert.equal(provenance.rootRevision.confirmedErrorSlots, 41);
  assert.equal(provenance.rootRevision.advisorySlotsAdopted, 17);
  assertFiniteRepairs(entries, NODE_B_FOURTH_REPAIRS);
  for (const [key, locale, before] of NODE_B_FOURTH_REPAIRS) {
    const reverted = structuredClone(entries);
    reverted.find(row => row.key === key).translations[locale].text = before;
    assert.throws(() => assertFiniteRepairs(reverted, NODE_B_FOURTH_REPAIRS), undefined, `${key}/${locale}`);
  }
});

test('Node B04 keeps legal Stroke/Projecting Chinese while splitting numeric, geometric and physics roles', () => {
  const { entries } = nodeB04();
  const byKey = new Map(entries.map(row => [row.key, row]));
  const row = key => byKey.get(key);
  const text = (key, locale) => row(key).translations[locale].text;

  // 繁中「筆畫」有矢量描邊的成熟用法；该完整tooltip是保留项，不强迫跟随简中。
  assert.equal(text('nodeInfo:outline', 'zh-Hant'), '在形狀周圍建立幾何筆畫。');
  assert.equal(NODE_B_FOURTH_REPAIRS.some(([key, locale]) => key === 'nodeInfo:outline' && locale === 'zh-Hant'), false);
  assert.equal(text('nodeAttrEnum:outline.capStyle.2', 'zh-Hans'), '投影');
  assert.equal(text('nodeAttrEnum:outline.capStyle.2', 'zh-Hant'), '投影');
  assert.equal(text('nodeAttrEnum:outline.capStyle.2', 'ja_JP'), '突出線端');

  // Tangent 是波形函数的正切；Round cap 是线端几何，不是四舍五入。
  assert.equal(text('nodeAttrEnum:oscillatorLegacy.trigType.2', 'zh-Hans'), '正切');
  assert.equal(text('nodeAttrEnum:oscillatorLegacy.trigType.2', 'zh-Hant'), '正切');
  assert.match(row('nodeAttrEnum:oscillatorLegacy.trigType.2').notes.join(' '), /mathematical term/);
  assert.equal(text('nodeAttrEnum:outline.capStyle.1', 'zh-Hans'), '圆头端点');
  assert.equal(text('nodeAttrEnum:outline.capStyle.1', 'zh-Hant'), '圓端點');
  assert.equal(text('nodeAttrEnum:outline.capStyle.1', 'ja_JP'), '丸型線端');
  assert.match(row('nodeAttrEnum:outline.capStyle.1').notes.join(' '), /semicircular cap/);

  assert.equal(text('nodeAttrEnum:meshSolver.feedbackMode.0', 'zh-Hans'), '内部反馈');
  assert.equal(text('nodeAttrEnum:meshSolver.feedbackMode.0', 'zh-Hant'), '內部反饋');
  assert.equal(text('nodeAttrEnum:meshSolver.feedbackMode.0', 'ja_JP'), '内部フィードバック');
  assert.match(row('attrInfo:meshSolver.keepPreviousMeshes').source, /Only works in Internal Feedback mode/);
  assert.equal(text('nodeAttrEnum:pieChart.dataType.1', 'zh-Hans'), '定类');
  assert.equal(text('nodeAttrEnum:pieChart.dataType.1', 'zh-Hant'), '類別');
  assert.equal(text('nodeAttrEnum:pieChart.dataType.1', 'ja_JP'), '名義');
  assert.match(row('nodeAttrEnum:pieChart.dataType.1').notes.join(' '), /categorical, label-based data/);

  assert.match(text('nodeInfo:pinConstraint', 'zh-Hans'), /钉固在原始位置，但允许其旋转/);
  assert.match(text('nodeInfo:pinConstraint', 'zh-Hant'), /釘選至其原始位置，但允許旋轉/);
  assert.match(text('nodeInfo:pinConstraint', 'ja_JP'), /元の位置にピン留めしますが、回転は許可/);
  assert.match(text('attrInfo:pinConstraint.stretchLimit', 'zh-Hans'), /旋转限制乘以此值/);
  assert.match(text('attrInfo:pinConstraint.stretchLimit', 'zh-Hant'), /旋轉限制乘以此值/);
  assert.match(text('attrInfo:pinConstraint.stretchLimit', 'ja_JP'), /回転制限にこの値を掛け/);
  assert.equal(text('nodeName:pinConstraint', 'zh-Hans'), '铰接约束');
  assert.equal(text('nodeName:pinConstraint', 'zh-Hant'), '鉸接約束');
  assert.equal(NODE_B_FOURTH_REPAIRS.some(([key, locale]) => key === 'nodeName:pinConstraint' && ['zh-Hans', 'zh-Hant'].includes(locale)), true);
});

test('Node B05 pins its complete 442-key source, identity and decision partition', () => {
  assertAdditionalPartition(NODE_B_FIFTH);
});

test('Node B05 pins all 52 source-bound repairs and rejects every original-text rollback', () => {
  const { entries } = nodeB05();
  assert.equal(NODE_B_FIFTH_REPAIRS.length, 52);
  assert.equal(new Set(NODE_B_FIFTH_REPAIRS.map(([key]) => key)).size, 29);
  assertFiniteRepairs(entries, NODE_B_FIFTH_REPAIRS);
  for (const [key, locale, before] of NODE_B_FIFTH_REPAIRS) {
    const reverted = structuredClone(entries);
    reverted.find(row => row.key === key).translations[locale].text = before;
    assert.throws(() => assertFiniteRepairs(reverted, NODE_B_FIFTH_REPAIRS), undefined, `${key}/${locale}`);
  }
});

test('Node B05 keeps GIF/decay semantics and records bounded Destination Over evidence', () => {
  const { entries, provenance } = nodeB05();
  assert.equal(provenance.sourcePartitionSha256,
    'b79b2b3fa2ded5f71bb1b385166538db9e71fbfe63c9e02b316e24368843b3b7');
  assert.equal(provenance.candidateSha256,
    '1de637383d947b33bc9dbabbb46a5156ef2535e8904cb30b619f12fd8f262b3f');
  assert.equal(provenance.approvalReceiptSha256,
    '014fe8be78f5442a3acfab2368e2b406418fc8bf989795a82923b45513c91f15');
  const byKey = new Map(entries.map(row => [row.key, row]));
  const row = key => byKey.get(key);
  const text = (key, locale) => row(key).translations[locale].text;

  assert.equal(provenance.rootRevision.changedKeys, 29);
  assert.equal(provenance.rootRevision.changedLocaleSlots, 52);
  assert.equal(provenance.rootRevision.confirmedErrorSlots, 24);
  assert.equal(provenance.rootRevision.advisorySlotsAdopted, 28);
  assert.equal(provenance.rootRevision.additionalClassificationSha256,
    'fa3972a3e29c034fc0b9a16bf0bb6bb42bdefc42c28d20cb54587c9158f5029a');
  assert.equal(provenance.unresolvedFindingKeys, 0);
  assert.equal(provenance.unresolvedSourceBehaviorIssues, 0);

  const gif = row('attrInfo:renderGIF.paletteSource');
  assert.equal(gif.source.split('\n').length, 3);
  assert.match(gif.source, /Whole Animation.*samples frames across the range/s);
  assert.match(gif.source, /First Frame.*only sees frame one/s);
  for (const locale of LOCALES) assert.equal(text(gif.key, locale).split('\n').length, 3, `${gif.key}/${locale}`);
  assert.match(text(gif.key, 'zh-Hans'), /整个时间范围.*各种颜色/s);
  assert.match(text(gif.key, 'zh-Hans'), /首帧.*第一帧.*几乎全黑/s);
  assert.match(text(gif.key, 'zh-Hant'), /整個時間範圍.*各種顏色/s);
  assert.match(text(gif.key, 'zh-Hant'), /首幀.*第一影格.*幾乎會全黑/s);
  assert.match(text(gif.key, 'ja_JP'), /全時間範囲.*現れる色/s);
  assert.match(text(gif.key, 'ja_JP'), /最初のフレーム.*1フレーム目.*ほぼ真っ黒/s);

  const fade = row('nodeAttr:simpleValue2Solver.fadeMode');
  assert.match(fade.notes.join(' '), /decays over time|gradual decay towards zero/);
  assert.deepEqual(LOCALES.map(locale => text(fade.key, locale)), ['衰减模式', '衰減模式', '減衰モード']);
  const solver = row('nodeInfo:simpleValue2Solver');
  assert.match(solver.source, /values from previous frames/);
  assert.match(solver.notes.join(' '), /back towards zero\/default over time/);
  assert.match(text(solver.key, 'zh-Hans'), /先前各帧.*累积.*衰减/);
  assert.match(text(solver.key, 'zh-Hant'), /先前影格.*累積.*衰減/);
  assert.match(text(solver.key, 'ja_JP'), /過去のフレーム.*累積.*減衰/);

  const sticky = row('nodeInfo:stickyCollisionEvent');
  assert.match(sticky.notes.join(' '), /physically bonding\/attaching two simulated bodies/);
  assert.match(text(sticky.key, 'zh-Hans'), /动力学物体碰撞时使其相互粘附/);
  assert.match(text(sticky.key, 'zh-Hant'), /動力學物體碰撞時使其相互黏著/);
  assert.match(text(sticky.key, 'ja_JP'), /ボディが衝突したときに、互いに貼り付けます/);

  assert.deepEqual(LOCALES.map(locale => text('nodeAttr:replaceString.with', locale)), ['替换为', '取代為', '置換後']);
  assert.deepEqual(LOCALES.map(locale => text('nodeAttrEnum:shader.colorFilter.1', locale)),
    ['线性到 sRGB', '線性到 sRGB', 'リニアから sRGB']);
  assert.deepEqual(LOCALES.map(locale => text('nodeAttrEnum:shader.colorFilter.2', locale)),
    ['sRGB 到线性', 'sRGB 到線性', 'sRGB からリニア']);

  // -- B-6只闭合不透明单Fill方向；此合同不推广合成算法或运行时消费 ------------
  const destinationOver = row('nodeAttrEnum:shader.blendMode.4');
  assert.equal(destinationOver.source, 'Destination Over');
  assert.deepEqual(destinationOver.notes, [
    '"Destination" refers to the layer beneath this one; "Over" means this layer is drawn on top of it.',
  ]);
  assert.equal(destinationOver.vendorJapanese, 'Destination Over');
  assert.deepEqual(destinationOver.translations, {
    'zh-Hans': { decision: 'translate', text: '目标之上' },
    'zh-Hant': { decision: 'translate', text: '目標之上' },
    ja_JP: { decision: 'translate', text: 'デスト上' },
  });
  const [destinationOverIssue] = provenance.sourceBehaviorIssues;
  assert.equal(destinationOverIssue.key, 'nodeAttrEnum:shader.blendMode.4');
  assert.equal(destinationOverIssue.status, 'measured-note-direction-conflict');
  assert.equal(destinationOverIssue.source, 'Destination Over');
  assert.deepEqual(destinationOverIssue.notes, destinationOver.notes);
  assert.equal(destinationOverIssue.captionOnlyApproval, true);
  assert.equal(destinationOverIssue.liveBehaviorVerified, true);
  assert.equal(destinationOverIssue.liveBehaviorScope,
    'B-6: opaque single-Fill only; Normal rendered red; Destination Over rendered blue; only blendMode changed.');
  assert.equal(destinationOverIssue.sourceOrNotesModified, false);
  assert.match(destinationOverIssue.problem, /原厂note.*B-6不透明单Fill.*颜色方向.*相反/);
  assert.match(destinationOverIssue.nextEvidence, /透明Alpha、多层\/多Fill.*运行时消费者未验证/);
});

test('approved native UI registry keeps 17 official catalogs distinct from Forge and schema-gap source domains', () => {
  const rows = approvedEntries();
  const uniqueKeys = new Set(rows.map(row => row.key));
  // -- 总源分母不变；显式demo审批只改变准入数，schema补充仍独立计数 ------
  assert.equal(uniqueKeys.size, 10753);
  assert.equal(rows.length, 10753);
  assert.equal(APPROVED_MODULES.length, 82);
  assert.equal(new Set(APPROVED_MODULES).size, 82);

  assert.equal(TARGET.nativeKeys, 10473);
  assert.equal(TARGET.supplementalKeys, 373);
  assert.equal(TARGET.catalogs.length, 17);
  const targetCatalogIds = new Set(TARGET.catalogs.map(catalog => catalog.id));
  assert.equal(targetCatalogIds.size, 17);
  const forge = rows.filter(row => row.catalogId === 'Definitions/nodeDefinitions.json#prettifyAttrPath');
  const gaps = rows.filter(row => row.catalogId === 'schemaSupplement/nodeAttributes');
  const pluginCaptions = rows.filter(row => row.catalogId
    === 'pluginCaptionSupplement/Plugins/Directional Blur Filter/definitions.json');
  assert.equal(forge.length, 8);
  assert.equal(gaps.length, 366);
  assert.equal(gaps.filter(row => row.key === 'nodeAttr:dynamicIndexManager.backgroundRendering').length, 1);
  assert.equal(BACKGROUND_RENDERING_GAP_COUNT, 1);
  assert.equal(pluginCaptions.length, 1);
  const supplements = [...forge, ...gaps, ...pluginCaptions];
  assert.equal(rows.length - supplements.length, 10378);
  const explicitCatalogRows = rows.filter(row => Object.hasOwn(row, 'catalogId') && !supplements.includes(row));
  const compactRows = rows.filter(row => !Object.hasOwn(row, 'catalogId'))
    .sort((a, b) => a.key < b.key ? -1 : a.key > b.key ? 1 : 0);
  assert.equal(explicitCatalogRows.length, 8957);
  assert.equal(compactRows.length, 1421);
  assert.equal(hash(compactRows.map(row => row.key)), '2a21e4c75af004a3e2f25049f1231de40967531b37338ba03eb3d564bc0dada9');
  const registeredCatalogIds = new Set(explicitCatalogRows.map(row => row.catalogId));
  for (const catalogId of registeredCatalogIds) assert.ok(targetCatalogIds.has(catalogId), catalogId);
  assert.deepEqual([...registeredCatalogIds].sort(), [...targetCatalogIds].sort());
  assert.equal(TARGET.nativeKeys + TARGET.supplementalKeys + pluginCaptions.length
    + BACKGROUND_RENDERING_GAP_COUNT - uniqueKeys.size, 95,
  '100 selected demo DNT leaves reduce the remaining preserved rows from 195 to 95');

  const expectedLocales = [...LOCALES].sort();
  for (const row of rows) {
    assert.deepEqual(Object.keys(row.translations).sort(), expectedLocales, row.key);
    for (const locale of LOCALES) {
      const decision = row.translations[locale];
      assert.ok(['translate', 'preserve'].includes(decision.decision), `${row.key}/${locale}`);
      assert.equal(typeof decision.text, 'string', `${row.key}/${locale}`);
      assert.equal(decision.decision === 'preserve', decision.text === row.source, `${row.key}/${locale}`);
      if (row.dontTranslate === true && !DEMO_MENU_DNT_KEY_SET.has(row.key)) {
        assert.equal(decision.text, row.source, `${row.key}/${locale} DNT`);
      }
    }
  }
});
