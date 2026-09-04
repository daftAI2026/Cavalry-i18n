#!/usr/bin/env node
/**
 * [INPUT]: 依赖 classify_ci_changes.js 的纯路径分类接口
 * [OUTPUT]: 证明文档轻门、合同门、平台门、依赖门及未知路径 fail-closed 的离线回归测试
 * [POS]: CI 风险调度器的单元测试，防止节省 Runner 时误跳产品或发布证据
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { classifyPaths } = require('./classify_ci_changes.js');

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

test('macOS-only and shared injector paths select the correct native evidence', () => {
  const macos = classifyPaths(['injector/CavalryTranslatorInjector.mm']);
  assert.equal(macos.windows, false);
  assert.equal(macos.macosInjector, true);

  const shared = classifyPaths(['injector/generated_translations.inc']);
  assert.equal(shared.windows, true);
  assert.equal(shared.macosInjector, true);
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
