#!/usr/bin/env node
/**
 * [INPUT]: 依赖 classify_ci_changes.js 的路径分类接口与临时 Git 仓库
 * [OUTPUT]: 验证源码改名为文档仍走完整证据门；验证Windows catalog guard独占Windows门及近似未知路径仍fail-closed；证明离线验收工具合同门与未知驱动边界、技能 Markdown 文档轻门与脚本未知路径边界、合同门、共享翻译/输入/Quick Add context/display/顶部标签/搜索/Classic 评分/Quick Add 描述策略双平台门、依赖门及未知路径 fail-closed 的离线回归测试
 * [POS]: CI 风险调度器的单元测试，防止节省 Runner 时误跳产品或发布证据
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { classifyPaths, scopeForEvent } = require('./classify_ci_changes.js');

function projection(scope) {
  return {
    documentationOnly: scope.documentationOnly,
    source: scope.source,
    vulnerability: scope.vulnerability,
    windows: scope.windows,
    macosInjector: scope.macosInjector,
    reason: scope.reason,
  };
}

test('renaming executable source into documentation still requires source evidence', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ci-scope-rename-'));
  const git = (...args) => execFileSync('git', args, { cwd: directory, encoding: 'utf8' }).trim();
  const classifier = path.resolve(__dirname, 'classify_ci_changes.js');
  try {
    git('init', '-q');
    git('config', 'user.name', 'CI scope test');
    git('config', 'user.email', 'ci-scope@example.invalid');
    git('config', 'diff.renames', 'true');
    fs.writeFileSync(path.join(directory, 'future-platform.js'), 'console.log("source");\n');
    git('add', '.');
    git('commit', '-qm', 'source');
    const base = git('rev-parse', 'HEAD');
    git('mv', 'future-platform.js', 'README.md');
    git('commit', '-qm', 'rename');
    const head = git('rev-parse', 'HEAD');
    for (const event of ['push', 'pull_request']) {
      const output = path.join(directory, `outputs-${event}`);
      const scope = JSON.parse(execFileSync(process.execPath, [classifier,
        '--event', event, '--ref', 'refs/heads/main', '--base', base, '--head', head,
        '--github-output', output], { cwd: directory, encoding: 'utf8' }));
      assert.equal(scope.documentationOnly, false);
      assert.equal(scope.source, true);
      assert.equal(scope.windows, true);
      assert.equal(scope.macosInjector, true);
    }
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('public documentation uses only the lightweight documentation contract', () => {
  assert.deepEqual(
    projection(classifyPaths(['README.md', 'docs/translation-guidelines.md', 'renderer/CLAUDE.md', '.github/ISSUE_TEMPLATE/bug.yml'])),
    {
      documentationOnly: true,
      source: false,
      vulnerability: false,
      windows: false,
      macosInjector: false,
      reason: 'documentation-only',
    }
  );
});

test('project skill Markdown stays documentation while executable additions remain unknown source', () => {
  const entry = '.agents/skills/cavalry-native-display-check/SKILL.md';
  const reference = '.agents/skills/cavalry-native-display-check/references/surfaces.md';
  assert.deepEqual(projection(classifyPaths([entry, reference])), {
    documentationOnly: true,
    source: false,
    vulnerability: false,
    windows: false,
    macosInjector: false,
    reason: 'documentation-only',
  });
  assert.deepEqual(projection(classifyPaths([entry, '.agents/skills/cavalry-native-display-check/scripts/workspace_probe.py'])), {
    documentationOnly: false,
    source: true,
    vulnerability: true,
    windows: true,
    macosInjector: true,
    reason: 'unknown-source-path-fail-closed',
  });
  const nativeChange = classifyPaths([entry, 'injector/native/shared_font_fallback.mm']);
  assert.equal(nativeChange.source, true);
  assert.equal(nativeChange.windows, false);
  assert.equal(nativeChange.macosInjector, true);
  assert.equal(nativeChange.reason, 'path-classified');
  const release = classifyPaths([entry], { forceFull: true, reason: 'release-tag' });
  assert.equal(release.windows, true);
  assert.equal(release.macosInjector, true);
  assert.deepEqual(projection(scopeForEvent({
    eventName: 'push', ref: 'refs/tags/cavalry-2.7.2-p99', baseSha: '', headSha: '',
  })), projection(release));
  assert.equal(scopeForEvent({ eventName: 'workflow_dispatch', ref: 'refs/heads/main' }).macosInjector, true);
});

test('contract and SOP changes run Ubuntu source contracts without native runners', () => {
  assert.deepEqual(
    projection(classifyPaths(['LOCAL_BUILD_SOP.md', 'tools/check_tauri_build_sop.js'])),
    {
      documentationOnly: false,
      source: true,
      vulnerability: false,
      windows: false,
      macosInjector: false,
      reason: 'path-classified',
    }
  );
});

test('renderer and Windows paths run Windows packaging but not the unrelated macOS injector gate', () => {
  const renderer = classifyPaths(['renderer/app.js']);
  assert.equal(renderer.windows, true);
  assert.equal(renderer.macosInjector, false);

  const windows = classifyPaths(['injector/windows/generic/CavalryTranslator.cpp']);
  assert.equal(windows.windows, true);
  assert.equal(windows.macosInjector, false);
});

test('the Windows catalog guard producer owns only the Windows native gate', () => {
  for (const paths of [
    ['tools/native_windows_catalog_warning_guard.js'],
    ['injector/windows/native/runtime.cpp', 'injector/windows/native/CMakeLists.txt',
      'tools/native_windows_catalog_warning_guard.js', 'tools/native_windows_catalog_warning_guard.test.js'],
  ]) assert.deepEqual(projection(classifyPaths(paths)), {
    documentationOnly: false, source: true, vulnerability: false,
    windows: true, macosInjector: false, reason: 'path-classified',
  });
  assert.equal(classifyPaths(['tools/native_windows_catalog_warning_guard_extra.js']).reason,
    'unknown-source-path-fail-closed');
  assert.equal(classifyPaths(['tools/native_windows_catalog_warning_guard.test.js']).windows, false);
});

test('macOS-only and shared injector paths select the correct native evidence', () => {
  const macos = classifyPaths(['injector/CavalryTranslatorInjector.mm']);
  assert.equal(macos.windows, false);
  assert.equal(macos.macosInjector, true);

  for (const relativePath of [
    'injector/generated_translations.inc',
    'injector/cavalry_i18n_translation_policy.h',
    'injector/cavalry_i18n_input_policy.h',
    'injector/cavalry_i18n_quick_add_context.h',
    'injector/cavalry_i18n_search_policy.h',
    'injector/cavalry_i18n_classic_search.h',
    'injector/cavalry_i18n_classic_rank.h',
    'injector/cavalry_i18n_quick_add_tabs.h',
    'injector/cavalry_i18n_search_descriptions.h',
    'injector/generated_quick_add_descriptions.inc',
    'tools/generate_quick_add_descriptions.js',
  ]) {
    const shared = classifyPaths([relativePath]);
    assert.equal(shared.windows, true, relativePath);
    assert.equal(shared.macosInjector, true, relativePath);
  }

  const display = classifyPaths(['injector/cavalry_i18n_quick_add_display.h']);
  assert.equal(display.windows, true);
  assert.equal(display.macosInjector, true);

  for (const relativePath of [
    'languages/en/nodeStrings.json',
    'languages/zh-Hans/plugins/boxBlurFilter.json',
    'languages/zh-Hant/nodeStrings.json',
    'languages/ja_JP/plugins/zoomBlurFilter.json',
  ]) {
    const descriptions = classifyPaths([relativePath]);
    assert.equal(descriptions.windows, true, relativePath);
    assert.equal(descriptions.macosInjector, true, relativePath);
  }
});

test('dependency and workflow changes run vulnerability and both native gates', () => {
  for (const relativePath of ['package-lock.json', '.github/workflows/build.yml']) {
    const scope = classifyPaths([relativePath]);
    assert.equal(scope.source, true, relativePath);
    assert.equal(scope.vulnerability, true, relativePath);
    assert.equal(scope.windows, true, relativePath);
    assert.equal(scope.macosInjector, true, relativePath);
  }
});

test('advisory-only inputs run the vulnerability gate without native packaging', () => {
  for (const relativePath of ['requirements-audit.txt', 'tools/dependency_vulnerability_gate.json']) {
    const scope = classifyPaths([relativePath]);
    assert.equal(scope.source, true, relativePath);
    assert.equal(scope.vulnerability, true, relativePath);
    assert.equal(scope.windows, false, relativePath);
    assert.equal(scope.macosInjector, false, relativePath);
  }
});

test('unknown source and automation paths fail closed to every expensive gate', () => {
  for (const relativePath of ['future-platform/entry.rs', '.github/dependabot.yml']) {
    assert.deepEqual(projection(classifyPaths([relativePath])), {
      documentationOnly: false,
      source: true,
      vulnerability: true,
      windows: true,
      macosInjector: true,
      reason: 'unknown-source-path-fail-closed',
    }, relativePath);
  }
});

test('release/manual events force every gate while schedule isolates advisory drift', () => {
  const forced = classifyPaths([], { forceFull: true, reason: 'release-tag' });
  assert.deepEqual(projection(forced), {
    documentationOnly: false,
    source: true,
    vulnerability: true,
    windows: true,
    macosInjector: true,
    reason: 'release-tag',
  });

  const scheduled = classifyPaths([], { schedule: true });
  assert.deepEqual(projection(scheduled), {
    documentationOnly: false,
    source: false,
    vulnerability: true,
    windows: false,
    macosInjector: false,
    reason: 'scheduled-vulnerability-review',
  });
});

test('an empty unresolved push diff fails closed', () => {
  const scope = classifyPaths([]);
  assert.equal(scope.source, true);
  assert.equal(scope.vulnerability, true);
  assert.equal(scope.windows, true);
  assert.equal(scope.macosInjector, true);
  assert.equal(scope.reason, 'empty-diff-fail-closed');
});

test('offline acceptance forms use source contracts without native runners', () => {
  for (const file of ['checklist.js','catalog.js','migration.js','scene-scope.js','scene-scope.test.js','run_flow.py',
    'test_run_flow.py','plugin-actions.json','plugin-acceptance-scope.json']) {
    const scope=classifyPaths([`tools/acceptance/${file}`]);
    assert.equal(scope.source,true,file);
    assert.equal(scope.vulnerability,false,file);
    assert.equal(scope.windows,false,file);
    assert.equal(scope.macosInjector,false,file);
  }
  for (const file of ['new-native-driver.mm','unknown.js','unknown.json']) {
    const unknown=classifyPaths([`tools/acceptance/${file}`]);
    assert.equal(unknown.windows,true,file);
    assert.equal(unknown.macosInjector,true,file);
  }
});

