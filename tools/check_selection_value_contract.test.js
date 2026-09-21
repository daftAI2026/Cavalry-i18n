/**
 * [INPUT]: 依赖双平台生产翻译入口、共享选择输入/Quick Add context 策略与原生回归测试源码
 * [OUTPUT]: 对外提供输入值的跨平台接线合同，锁定 QLineEdit 仅翻译提示文字、Combo/弹出列表原值保护及共享 Quick Add context 的双平台源码闭包
 * [POS]: tools 的 CI-safe 静态回归门；与原生测试互补，不冒充真实 Cavalry 字体效果验收
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

function body(source, signature) {
  const start = source.indexOf(signature);
  assert.notEqual(start, -1, signature);
  const open = source.indexOf('{', start);
  let depth = 1;
  let end = open + 1;
  for (; depth && end < source.length; ++end) {
    if (source[end] === '{') ++depth;
    if (source[end] === '}') --depth;
  }
  return source.slice(open, end);
}

test('shared selection policy uses input semantics, not a font-name blacklist', () => {
  const policy = read('injector/cavalry_i18n_input_policy.h');
  assert.match(policy, /combo->isEditable\(\)/);
  assert.match(policy, /combo->inherits\("QFontComboBox"\)/);
  assert.match(policy, /current = current->parent\(\)/);
  assert.doesNotMatch(policy, /QStringLiteral|"Bold"|"Black"|allWidgets\(|->view\(/);
});

test('macOS keeps model selection writes protected and line edits placeholder-only', () => {
  const source = read('injector/CavalryTranslatorInjector.mm');
  for (const signature of [
    'void translateListWidgetItems(', 'void translateTreeWidgetItem(',
    'void translateTableWidgetItems(',
    'void translateQtWidgetTexts(',
  ]) {
    assert.match(body(source, signature), /cavalry_i18n::preservesSelectionValue\(/, signature);
  }
  assert.match(body(source, 'void translateLineEditDisplayText('),
    /translateLineEditPlaceholder/);
  for (const widget of ['treeWidget', 'tableWidget']) {
    assert.match(body(source, 'void translateQtWidgetTexts('),
      new RegExp(`${widget} && !cavalry_i18n::preservesSelectionValue\\(${widget}\\)`));
  }
});

test('generic line edit paths on both platforms do not write business text', () => {
  const policy = read('injector/cavalry_i18n_input_policy.h');
  assert.match(policy, /translateLineEditPlaceholder/);
  const paths = [
    ['injector/CavalryTranslatorInjector.mm', 'void translateLineEditDisplayText('],
    ['injector/CavalryTranslatorInjector.mm', 'void hookLineEditTextChanges('],
    ['injector/CavalryTranslatorInjector.mm', 'void translateLineEditBeforePaint('],
    ['injector/windows/cavalry_i18n_display.cpp',
      'void CavalryDisplayTranslator::translateLineEditDisplay('],
  ];
  for (const [file, signature] of paths) {
    const scope = body(read(file), signature);
    assert.doesNotMatch(scope, /setText\s*\(/, `${file}:${signature}`);
  }
  assert.match(body(read('injector/CavalryTranslatorInjector.mm'),
    'void translateLineEditDisplayText('), /translateLineEditPlaceholder/);
  assert.match(body(read('injector/windows/cavalry_i18n_display.cpp'),
    'void CavalryDisplayTranslator::translateLineEditDisplay('),
    /translateLineEditPlaceholder/);
});

test('Windows shares the same guard for combo and custom tree popup', () => {
  const source = read('injector/windows/cavalry_i18n_display.cpp');
  for (const signature of [
    'void CavalryDisplayTranslator::translateComboBoxDisplay(',
    'void CavalryDisplayTranslator::translateTreeWidgetItemDisplay(',
  ]) {
    assert.match(body(source, signature), /cavalry_i18n::preservesSelectionValue\(/, signature);
  }
});

test('shared input and Quick Add context policies are included in both native provenance closures', () => {
  for (const file of [
    'tools/macos-acceptance/source_contract.js',
    'tools/windows_nsis_provenance.js',
  ]) {
    assert.match(read(file), /cavalry_i18n_input_policy\.h/, file);
    assert.match(read(file), /cavalry_i18n_quick_add_context\.h/, file);
  }
});
