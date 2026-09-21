/**
 * [INPUT]: 依赖 clang++、tools/macos_timeline_font_fixture.cpp 与 injector/macOS 时间轴字体策略头
 * [OUTPUT]: 对外提供 vendor-free 时间轴字体选择/借用策略的可编译、可运行回归门
 * [POS]: tools 的 macOS 时间轴 CJK 字体合同；用独立 mock 字体覆盖证明 UTF-8 边界与 24-byte 借用布局，不冒充 Cavalry ABI 或实机证据
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');

const repoRoot = path.resolve(__dirname, '..');
const source = path.join(repoRoot, 'tools', 'macos_timeline_font_fixture.cpp');
const injectorRoot = path.join(repoRoot, 'injector');

function run(command, args) {
  return spawnSync(command, args, {
    cwd: repoRoot,
    encoding: 'utf8',
    maxBuffer: 1024 * 1024,
  });
}

test('macOS timeline font policy fixture compiles and passes the native mock contract', () => {
  const buildRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), 'cavalry-i18n-macos-timeline-font-')
  );
  const executable = path.join(buildRoot, 'macos_timeline_font_fixture');

  try {
    const compile = run('clang++', [
      '-std=c++17',
      '-O2',
      '-Wall',
      '-Wextra',
      '-Werror',
      source,
      '-I',
      injectorRoot,
      '-o',
      executable,
    ]);
    assert.equal(
      compile.status,
      0,
      [
        'clang++ failed to compile the macOS timeline font fixture',
        compile.stdout,
        compile.stderr,
      ].filter(Boolean).join('\n')
    );

    const execution = run(executable, []);
    assert.equal(
      execution.status,
      0,
      [
        'macOS timeline font fixture failed',
        execution.stdout,
        execution.stderr,
      ].filter(Boolean).join('\n')
    );
  } finally {
    fs.rmSync(buildRoot, { recursive: true, force: true });
  }
});
