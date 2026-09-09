/**
 * [INPUT]: 依赖 macOS Quick Add 类别标签适配器源码与共享 tabs/Classic ABI 合同
 * [OUTPUT]: 对外提供 macOS Fast/Classic Quick Add 类别 getter 适配器的静态安全合同
 * [POS]: tools 的 macOS Quick Add 类别回归门；只锁源码边界与双架构 ABI 证据，不冒充 vendor live UI 证据
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('macOS Quick Add category adapter exposes a narrow source getter contract', () => {
  const header = read('injector/cavalry_i18n_macos_quick_add_category.h');
  assert.match(header, /MacQuickAddCategoryApi/);
  assert.match(header, /macQuickAddCategoryApi\(\) noexcept/);
  assert.match(header, /QWidget/);
  assert.match(header, /QString/);
  assert.match(header, /\[PROTOCOL\]: 变更时更新此头部，然后检查 CLAUDE\.md/);
});

test('macOS category adapter reuses exact owner/source policy and the existing Cavalry gate', () => {
  const source = read('injector/cavalry_i18n_macos_quick_add_category.cpp');
  assert.match(source, /#include\s+"cavalry_i18n_quick_add_tabs\.h"/);
  assert.match(source, /#include\s+"cavalry_i18n_macos_classic_rank\.h"/);
  assert.match(source, /macClassicQuickAddPriorityApi\(\)/);
  assert.match(source, /isQuickAddCategoryLabel\(/);
  assert.match(source, /isQuickAddCategorySource\(/);
  assert.match(source, /static\s+RuntimeState\s+gState/);
  assert.doesNotMatch(source, /setText\s*\(/);
  assert.doesNotMatch(source, /setQuickAddCategoryDisplayText\s*\(/);
});

test('macOS category getter delegates independent dlsym/RVA verification to the shared gate', () => {
  const source = read('injector/cavalry_i18n_macos_quick_add_category.cpp');
  assert.match(source, /macVerifiedQuickAddUiFunction\s*\(/);
  assert.match(source, /_ZNK13RolloverLabel4textEv/);
  assert.match(source, /__arm64__|__aarch64__/);
  assert.match(source, /__x86_64__/);
  assert.match(source, /0x44180/);
  assert.match(source, /0x466c0/);
  assert.match(source, /kArmRolloverLabelTextCode/);
  assert.match(source, /kX8664RolloverLabelTextCode/);
  assert.doesNotMatch(source, /dlopen\s*\(|dlsym\s*\(|_dyld_/);
});

test('macOS category getter uses the compiler QString return ABI, not a handwritten sret form', () => {
  const source = read('injector/cavalry_i18n_macos_quick_add_category.cpp');
  const implementation = source.replace(/\/\/.*|\/\*[\s\S]*?\*\//g, '');
  assert.match(source, /using\s+RolloverLabelTextFunction\s*=\s*QString\s*\(\*\)\s*\(const\s+void\s*\*\)/);
  assert.doesNotMatch(source, /RolloverLabelTextFunction\s*=\s*void/);
  assert.doesNotMatch(source, /RolloverLabelTextFunction[\s\S]{0,160}QString\s*\*/);
  assert.doesNotMatch(implementation, /sret/i);
});

test('macOS category adapter is read-only after one bounded initialization attempt', () => {
  const source = read('injector/cavalry_i18n_macos_quick_add_category.cpp');
  assert.doesNotMatch(source, /QFile|QSaveFile|fopen\s*\(|std::ofstream|std::ifstream|system\s*\(/);
  assert.match(source, /static\s+RuntimeState\s+gState/);
  assert.match(source, /return\s+QString\s*\(\)/);
});
