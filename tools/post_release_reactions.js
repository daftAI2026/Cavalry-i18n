#!/usr/bin/env node
/**
 * [INPUT]: 依赖 gh CLI、release.config.json 的 tag 约束和已公开 GitHub Release
 * [OUTPUT]: 添加并回读六种正向 reactions；只操作指定 Release 的反馈，不修改正文、tag 或资产
 * [POS]: 发布成功后的非关键反馈步骤，沿用 Incodex 六种 reaction；GitHub 按账号去重，失败不触发重新发布
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
'use strict';
const { spawnSync } = require('node:child_process');
const { releaseTagPattern } = require('../release.config.json');
const reactions = ['+1', 'laugh', 'hooray', 'heart', 'rocket', 'eyes'];

function githubApi(route, method = 'GET', fields = {}, paginate = false) {
  const args = ['api', route, '--method', method];
  for (const [key, value] of Object.entries(fields)) args.push('-f', `${key}=${value}`);
  if (paginate) args.push('--paginate', '--slurp');
  const result = spawnSync('gh', args, { encoding: 'utf8' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(result.stderr.trim() || 'GitHub API failed');
  const value = JSON.parse(result.stdout);
  return paginate ? value.flat() : value;
}

function postReleaseReactions({ tag, repo, api = githubApi }) {
  if (typeof tag !== 'string' || !new RegExp(releaseTagPattern).test(tag)) throw new Error('Invalid release tag');
  if (typeof repo !== 'string' || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo)) throw new Error('Invalid repository');
  const release = api(`repos/${repo}/releases/tags/${tag}`);
  if (!Number.isSafeInteger(release.id) || release.id <= 0 || release.tag_name !== tag
      || release.draft !== false || release.prerelease !== false) {
    throw new Error('Expected an existing public stable Release');
  }
  const endpoint = `repos/${repo}/releases/${release.id}/reactions`;
  const posted = reactions.map(content => {
    const response = api(endpoint, 'POST', { content });
    if (!Number.isSafeInteger(response.id) || response.id <= 0 || response.content !== content) {
      throw new Error(`Invalid reaction response: ${content}`);
    }
    return response;
  });
  const actual = api(`${endpoint}?per_page=100`, 'GET', {}, true);
  for (const expected of posted) {
    if (!actual.some(row => row.id === expected.id && row.content === expected.content)) {
      throw new Error(`Reaction readback missing: ${expected.content}`);
    }
  }
  return release.id;
}

if (require.main === module) {
  try {
    if (process.argv.length !== 4) throw new Error('Usage: node tools/post_release_reactions.js <tag> <owner/repo>');
    const id = postReleaseReactions({ tag: process.argv[2], repo: process.argv[3] });
    console.log(`[release-reactions] Verified six reactions on release ${id}`);
  } catch (error) {
    console.error(`[release-reactions] ${error.message}`);
    process.exitCode = 1;
  }
}
module.exports = { postReleaseReactions };
