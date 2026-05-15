#!/usr/bin/env node
/**
 * [INPUT]: 依赖 release.config.json、package.json 与 GitHub tag 环境变量
 * [OUTPUT]: 对外提供 release tag 校验、资产命名与 GitHub Actions 环境变量写入能力
 * [POS]: tools 的发布协议守门器，把内部 SemVer 与 Cavalry 目标版本补丁号分离
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

const fs = require('node:fs');
const path = require('node:path');

const rootDir = process.cwd();
const args = process.argv.slice(2);

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(rootDir, relativePath), 'utf8'));
}

function requireString(value, field) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`release.config.json ${field} must be a non-empty string.`);
  }
}

function loadConfig() {
  const config = readJson('release.config.json');
  for (const field of [
    'targetCavalryVersion',
    'releaseTagPrefix',
    'releaseTagPattern',
    'releaseTitleTemplate',
    'assetNameTemplate',
  ]) {
    requireString(config[field], field);
  }
  return config;
}

function optionValue(name) {
  const index = args.indexOf(name);
  if (index === -1) return null;
  const value = args[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`${name} requires a value.`);
  }
  return value;
}

function renderTemplate(template, patch) {
  return template.replaceAll('${patch}', patch);
}

function resolveTag() {
  return optionValue('--tag') || process.env.GITHUB_REF_NAME || '';
}

function metadataForTag(config, tag) {
  if (!new RegExp(config.releaseTagPattern).test(tag)) {
    throw new Error(`Release tag "${tag}" does not match ${config.releaseTagPattern}.`);
  }
  const patch = tag.slice(config.releaseTagPrefix.length);
  if (!/^[0-9]+$/.test(patch)) {
    throw new Error(`Release tag "${tag}" must end with a numeric patch id.`);
  }
  return {
    RELEASE_TAG: tag,
    RELEASE_PATCH: patch,
    TARGET_CAVALRY_VERSION: config.targetCavalryVersion,
    INTERNAL_APP_VERSION: readJson('package.json').version,
    RELEASE_TITLE: renderTemplate(config.releaseTitleTemplate, patch),
    RELEASE_ASSET_NAME: renderTemplate(config.assetNameTemplate, patch),
  };
}

function writeGithubEnv(metadata) {
  const lines = Object.entries(metadata).map(([key, value]) => `${key}=${value}`);
  if (process.env.GITHUB_ENV) {
    fs.appendFileSync(process.env.GITHUB_ENV, `${lines.join('\n')}\n`);
  }
  console.log(lines.join('\n'));
}

function checkProtocol(config) {
  const sampleTag = `${config.releaseTagPrefix}1`;
  const sample = metadataForTag(config, sampleTag);
  if (sample.RELEASE_TITLE !== 'Cavalry Language Switcher for Cavalry 2.7.2 patch 1') {
    throw new Error('releaseTitleTemplate does not render the frozen title contract.');
  }
  if (sample.RELEASE_ASSET_NAME !== 'Cavalry.Language.Switcher_Cavalry-2.7.2-p1_aarch64.dmg') {
    throw new Error('assetNameTemplate does not render the frozen asset contract.');
  }
  if (new RegExp(config.releaseTagPattern).test('v0.1.11')) {
    throw new Error('releaseTagPattern must reject internal SemVer tags.');
  }
}

function main() {
  const config = loadConfig();
  if (args.includes('--check')) {
    checkProtocol(config);
    console.log('[release-metadata] OK: release protocol is stable');
    return;
  }

  const tag = resolveTag();
  if (!tag) {
    throw new Error('No release tag found. Pass --tag or run under a tag-triggered GitHub Action.');
  }
  const metadata = metadataForTag(config, tag);
  if (args.includes('--github-env')) {
    writeGithubEnv(metadata);
    return;
  }
  console.log(JSON.stringify(metadata, null, 2));
}

try {
  main();
} catch (error) {
  console.error(`[release-metadata] ${error.message}`);
  process.exit(1);
}
