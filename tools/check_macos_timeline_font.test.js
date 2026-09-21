/**
 * [INPUT]: 依赖 clang++、tools/macos_timeline_font_fixture.cpp 与 injector/macOS 时间轴字体策略头
 * [OUTPUT]: 对外提供 vendor-free 时间轴字体选择/借用策略的可编译、可运行回归门
 * [POS]: tools 的 macOS 时间轴 CJK 字体合同；用独立 mock 字体覆盖证明 UTF-8 边界与 24-byte 借用布局，不冒充 Cavalry ABI 或实机证据
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');
const { makeTempDir, cleanupTempDirs } = require('./test_temp_dir');
const repoRoot = path.resolve(__dirname, '..');
const injectorRoot = path.join(repoRoot, 'injector');
const source = path.join(repoRoot, 'tools', 'macos_timeline_font_fixture.cpp');
const policyName = 'cavalry_i18n_macos_timeline_font_policy.h';
const read = name => fs.readFileSync(path.join(injectorRoot, name), 'utf8');

function fixture(mutated) {
  const out = makeTempDir();
  try {
    if (mutated) fs.writeFileSync(path.join(out, policyName), mutated);
    const exe = path.join(out, 'timeline-test');
    const compile = spawnSync('c++', ['-std=c++17', '-O2', '-Wall', '-Wextra', '-Werror',
      source, '-I', out, '-I', injectorRoot, '-o', exe], { encoding: 'utf8' });
    assert.equal(compile.status, 0, compile.stderr || String(compile.error));
    return spawnSync(exe, [], { encoding: 'utf8' });
  } finally { cleanupTempDirs(); }
}
const nativeOptions = { skip: process.platform === 'win32' ? 'Mac-only policy native fixture runs on POSIX CI; Windows has independent CTest.' : false };
test('macOS timeline full-name coverage and borrowed font preserve input identity', nativeOptions, () => {
  const result = fixture();
  assert.equal(result.status, 0, result.stderr);
});
test('macOS timeline regression rejects the original no-fallback behavior', nativeOptions, () => {
  const source = read(policyName);
  const needle = 'for (std::size_t i = 0; i < candidateCount; ++i)';
  assert.ok(source.includes(needle));
  const result = fixture(source.replace(needle, 'return original;\n    ' + needle));
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /simplifiedChinese/);
});
test('macOS timeline adapter keeps exact caller ABI and rendering free of persistence', () => {
  const adapter = read('cavalry_i18n_macos_timeline_font.cpp');
  const contract = read('cavalry_i18n_macos_timeline_font_contract.h');
  for (const address of ['0x49ab44', '0x49af38', '0x525893', '0x525dd7']) assert.ok(contract.includes(address));
  for (const gate of ['imageUuidEquals', 'matchesCode', 'findMachOSymbol']) assert.ok(contract.includes(gate));
  assert.match(adapter, /caller != imageAddress/);
  assert.match(adapter, /state\.ready\.load\(std::memory_order_acquire\)/);
  assert.match(adapter, /const void \*candidates\[3\]/);
  assert.match(adapter, /selectTypeface/);
  assert.doesNotMatch(adapter, /QSaveFile|QFile|fopen|ofstream|QTimer|revision|setText/);
  assert.doesNotMatch(read(policyName), /std::vector|std::map|unordered_map|new |malloc/);
  for (const script of ['build_translator_injector.sh','check_macos_selection_values.sh','check_macos_quick_add_inputs.sh']) {
    assert.ok(fs.readFileSync(path.join(repoRoot,'tools',script),'utf8').includes('cavalry_i18n_macos_timeline_font.cpp'));
  }
});
