/**
 * [INPUT]: canonical repository root 与 acceptance producer 根目录。
 * [OUTPUT]: 返回 acceptance-v2 必须冻结的完整、确定性 source→snapshot 路径闭包及 Guide staging 文件表。
 * [POS]: live producer 与独立 release verifier 共用的 source-closure 真相源，防止任一侧省略受审源码。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const LANGUAGES = Object.freeze(['zh-Hans', 'zh-Hant', 'ja_JP']);
const GUIDE_FILES = Object.freeze([
  ['onboarding.json', 'Learn/onboarding.json'],
  ['Learn/Guides/guides.json', 'Learn/Guides/guides.json'],
  ['Learn/Guides/strings.json', 'Learn/Guides/strings.json'],
]);

function sourceEntries(repo, acceptanceRoot = path.join(repo, 'tools', 'macos-acceptance')) {
  const acceptance = [
    'acceptance_harness.js', 'artifact_identity.js', 'build_acceptance_v2.sh', 'host_identity.js',
    'path_safety.js', 'source_contract.js',
    ...fs.readdirSync(path.join(acceptanceRoot, 'drivers'))
      .filter((name) => /\.(mm|inc)$/.test(name)).sort().map((name) => `drivers/${name}`),
    ...fs.readdirSync(path.join(acceptanceRoot, 'helpers'))
      .filter((name) => name.endsWith('.swift')).sort().map((name) => `helpers/${name}`),
    'fixtures/replace-source.png', 'fixtures/replace-source.mp4', 'fixtures/dynamic-proof-two.png',
  ].map((relative) => ({
    source: path.join(acceptanceRoot, relative),
    destination: path.join('acceptance', relative),
  }));
  const product = [
    'injector/CavalryTranslatorInjector.mm',
    'injector/cavalry_i18n_translation_policy.h',
    'injector/cavalry_i18n_macos_tool_help_text_path.h',
    'injector/cavalry_i18n_macos_tool_help_text_path.cpp',
    'injector/generated_translations.inc',
    'tools/build_translator_injector.sh',
    'tools/generate_embedded_translations.js',
    'tools/cavalry_qt_target.json',
    'tools/model_display_translations.json',
    'tools/runtime-noise-quarantine.json',
    'tools/zh-Hans.ts', 'tools/zh-Hant.ts', 'tools/ja_JP.ts',
  ].map((relative) => ({ source: path.join(repo, relative), destination: path.join('repo', relative) }));
  for (const language of LANGUAGES) {
    for (const [source] of GUIDE_FILES) {
      product.push({
        source: path.join(repo, 'languages', language, source),
        destination: path.join('repo', 'languages', language, source),
      });
    }
  }
  return [...acceptance, ...product];
}

module.exports = { GUIDE_FILES, sourceEntries };
