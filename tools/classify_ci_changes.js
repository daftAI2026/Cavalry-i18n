#!/usr/bin/env node
/**
 * [INPUT]: 依赖 Git 变更范围、GitHub event/ref/base/head 与仓库路径职责边界
 * [OUTPUT]: 对外提供 documentation/source/vulnerability/windows/macos-injector 五类 CI 风险投影及 GitHub Actions outputs
 * [POS]: tools 的 CI 调度分类器，只决定需要证明的证据类型；tag、手动运行、未知路径和不可解析 diff 均 fail-closed
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
'use strict';

const fs = require('node:fs');
const { execFileSync } = require('node:child_process');

const FORCE_FULL_EVENTS = new Set(['workflow_dispatch']);
const ZERO_SHA = /^0{40}$/;

const DOCUMENTATION_PATHS = [
  /^(?:AGENTS|CLAUDE|CONTRIBUTING|CODE_OF_CONDUCT|SECURITY)\.md$/,
  /^README(?:\.[^/]+)?\.md$/,
  /^LICENSE(?:\..+)?$/,
  /^docs\//,
  /^\.github\/(?:CODEOWNERS|(?:ISSUE_TEMPLATE|PULL_REQUEST_TEMPLATE)(?:\/|$))/,
  /^\.github\/(?!workflows\/).+\.md$/,
  /(?:^|\/)CLAUDE\.md$/,
];

const CONTRACT_ONLY_PATHS = [
  /^CHANGELOG\.md$/,
  /^LOCAL_BUILD_SOP\.md$/,
  /^requirements-audit\.(?:in|txt)$/,
  /^release\.config\.json$/,
  /^release-seals\//,
  /^tools\/classify_ci_changes(?:\.test)?\.js$/,
  /^tools\/dependency_vulnerability_gate(?:\.json|\.js|\.test\.js)$/,
  /^tools\/(?:check_app_contracts|check_operation_log_runtime|check_renderer_contract|check_tauri_bridge_runtime|check_tauri_build_sop)\.js$/,
  /^tools\/[^/]+\.test\.js$/,
  /^tools\/(?:macos-acceptance|windows-acceptance)\/[^/]+\.test\.js$/,
];

const DEPENDENCY_PATHS = [
  /^package(?:-lock)?\.json$/,
  /^requirements-(?:audit|ci)\.(?:in|txt)$/,
  /^rust-toolchain\.toml$/,
  /^src-tauri\/Cargo\.(?:toml|lock)$/,
  /^tools\/ci_action_pins\.json$/,
  /^tools\/dependency_vulnerability_gate(?:\.json|\.js|\.test\.js)$/,
  /^\.github\/workflows\//,
];

const WINDOWS_PATHS = [
  /^injector\/windows\//,
  /^injector\/(?:generated_translations\.inc|cavalry_i18n_translation_policy\.h)$/,
  /^renderer\//,
  /^languages\//,
  /^src-tauri\//,
  /^package(?:-lock)?\.json$/,
  /^requirements-ci\.(?:in|txt)$/,
  /^rust-toolchain\.toml$/,
  /^tools\/(?:check_windows|powershell_command|record_windows|resolve_windows|windows_|windows-acceptance\/)/,
  /^tools\/(?:cavalry_qt_target\.json|generate_embedded_translations\.js|model_display_translations\.json|resolve_cavalry_qt_sdk\.js)$/,
  /^tools\/(?:zh-Hans|zh-Hant|ja_JP)\.ts$/,
  /^\.github\/workflows\//,
];

const MACOS_INJECTOR_PATHS = [
  /^injector\/(?!windows\/)/,
  /^package(?:-lock)?\.json$/,
  /^requirements-ci\.(?:in|txt)$/,
  /^tools\/(?:build_translator_injector\.sh|cavalry_qt_target\.json|generate_embedded_translations\.js|model_display_translations\.json|resolve_cavalry_qt_sdk\.js)$/,
  /^tools\/(?:zh-Hans|zh-Hant|ja_JP)\.ts$/,
  /^tools\/macos-acceptance\//,
  /^\.github\/workflows\//,
];

function matchesAny(relativePath, patterns) {
  return patterns.some((pattern) => pattern.test(relativePath));
}

function normalizePaths(paths) {
  return [...new Set(paths.map(String).filter((value) => value.length > 0))].sort();
}

function fullScope(reason, paths = []) {
  return {
    documentationOnly: false,
    source: true,
    vulnerability: true,
    windows: true,
    macosInjector: true,
    reason,
    paths: normalizePaths(paths),
  };
}

function classifyPaths(paths, options = {}) {
  const normalized = normalizePaths(paths);
  if (options.forceFull) return fullScope(options.reason || 'forced-full', normalized);
  if (options.schedule) {
    return {
      documentationOnly: false,
      source: false,
      vulnerability: true,
      windows: false,
      macosInjector: false,
      reason: 'scheduled-vulnerability-review',
      paths: normalized,
    };
  }
  if (normalized.length === 0) return fullScope('empty-diff-fail-closed');

  const sourcePaths = normalized.filter((entry) => !matchesAny(entry, DOCUMENTATION_PATHS));
  const scope = {
    documentationOnly: sourcePaths.length === 0,
    source: sourcePaths.length > 0,
    vulnerability: normalized.some((entry) => matchesAny(entry, DEPENDENCY_PATHS)),
    windows: false,
    macosInjector: false,
    reason: sourcePaths.length === 0 ? 'documentation-only' : 'path-classified',
    paths: normalized,
  };

  for (const entry of sourcePaths) {
    if (matchesAny(entry, CONTRACT_ONLY_PATHS)) continue;

    const knownWindows = matchesAny(entry, WINDOWS_PATHS);
    const knownMacosInjector = matchesAny(entry, MACOS_INJECTOR_PATHS);
    if (knownWindows || knownMacosInjector) {
      scope.windows ||= knownWindows;
      scope.macosInjector ||= knownMacosInjector;
      continue;
    }

    // Unknown source paths are not guessed safe. Both native gates run until the
    // path is deliberately assigned a narrower responsibility above.
    scope.vulnerability = true;
    scope.windows = true;
    scope.macosInjector = true;
    scope.reason = 'unknown-source-path-fail-closed';
  }

  return scope;
}

function changedPathsForEvent({ eventName, baseSha, headSha }) {
  if (!baseSha || !headSha || ZERO_SHA.test(baseSha)) return null;
  const range = eventName === 'pull_request' ? `${baseSha}...${headSha}` : `${baseSha}..${headSha}`;
  try {
    const output = execFileSync(
      'git',
      ['diff', '--name-only', '--diff-filter=ACDMRTUXB', '-z', range],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
    );
    return output.split('\0').filter(Boolean);
  } catch (error) {
    process.stderr.write(`[ci-change-scope] unable to resolve ${range}: ${error.message}\n`);
    return null;
  }
}

function scopeForEvent({ eventName, ref, baseSha, headSha }) {
  if (ref.startsWith('refs/tags/cavalry-') || FORCE_FULL_EVENTS.has(eventName)) {
    return fullScope(ref.startsWith('refs/tags/cavalry-') ? 'release-tag' : eventName);
  }
  if (eventName === 'schedule') return classifyPaths([], { schedule: true });

  const paths = changedPathsForEvent({ eventName, baseSha, headSha });
  if (paths === null) return fullScope('unresolved-diff-fail-closed');
  return classifyPaths(paths);
}

function outputEntries(scope) {
  return {
    documentation_only: String(scope.documentationOnly),
    source: String(scope.source),
    vulnerability: String(scope.vulnerability),
    windows: String(scope.windows),
    macos_injector: String(scope.macosInjector),
    reason: scope.reason,
  };
}

function writeGithubOutputs(filePath, scope) {
  const lines = Object.entries(outputEntries(scope)).map(([key, value]) => `${key}=${value}`);
  fs.appendFileSync(filePath, `${lines.join('\n')}\n`);
}

function argumentValue(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) return '';
  const value = process.argv[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`${name} requires a value`);
  return value;
}

function main() {
  const scope = scopeForEvent({
    eventName: argumentValue('--event'),
    ref: argumentValue('--ref'),
    baseSha: argumentValue('--base'),
    headSha: argumentValue('--head'),
  });
  const outputPath = argumentValue('--github-output') || process.env.GITHUB_OUTPUT;
  if (!outputPath) throw new Error('--github-output or GITHUB_OUTPUT is required');
  writeGithubOutputs(outputPath, scope);
  console.log(JSON.stringify(scope, null, 2));
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(`[ci-change-scope] ${error.message}`);
    process.exit(1);
  }
}

module.exports = {
  classifyPaths,
  outputEntries,
  scopeForEvent,
};
