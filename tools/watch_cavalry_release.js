#!/usr/bin/env node
/**
 * [INPUT]: 官方 Docs Latest version/发行说明、当前 native target 与 GitHub Issues。
 * [OUTPUT]: dry-run 候选或按版本去重的新版本兼容性 issue；网络/解析失败直接报错。
 * [POS]: 独立定时监控，不修改支持版本、翻译、ABI 或发布制品。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
'use strict';
const { spawnSync } = require('node:child_process');
const DOCS_URL = 'https://cavalry.studio/docs/';
const VERSION = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

function versionParts(value) {
  if (!VERSION.test(value)) throw new Error(`Invalid stable version: ${value}`);
  const parts = value.split('.').map(Number);
  if (!parts.every(Number.isSafeInteger)) throw new Error('Version component too large');
  return parts;
}
function newerThan(candidate, baseline) {
  const a = versionParts(candidate), b = versionParts(baseline);
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i];
  return false;
}
function plain(html) {
  return html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#160;/g, ' ').replace(/\s+/g, ' ').trim();
}
function parseLatest(html) {
  const versions = [...plain(html).matchAll(/Latest version:\s*(\d+\.\d+\.\d+)(?=\s|$)/g)];
  if (versions.length !== 1) throw new Error('Expected one official Latest version');
  const version = versions[0][1];
  versionParts(version);
  const links = [...html.matchAll(/<a\b[^>]*\bhref\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))[^>]*>([\s\S]*?)<\/a>/gi)]
    .filter(match => plain(match[4]).replace(/\s*→$/, '') === `${version} Release Notes`)
    .map(match => new URL(match[1] || match[2] || match[3], DOCS_URL));
  const urls = [...new Set(links.map(url => url.href))];
  if (urls.length !== 1) throw new Error('Missing or ambiguous matching release notes link');
  const url = new URL(urls[0]);
  if (url.origin !== new URL(DOCS_URL).origin || !url.pathname.startsWith('/docs/tech-info/release-notes/')
      || url.search || url.hash || url.username || url.password) throw new Error('Unexpected release notes URL');
  return { version, notesUrl: url.href };
}
async function readOfficial(url) {
  const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`Official docs HTTP ${response.status}`);
  if (!/text\/html/i.test(response.headers.get('content-type') || '')) throw new Error('Expected HTML docs');
  const html = await response.text();
  if (html.length > 3000000) throw new Error('Official docs response too large');
  return html;
}
function ghApi(route, method = 'GET', fields = null) {
  const args = ['api', route, '--method', method];
  if (method === 'GET') args.push('--paginate', '--slurp');
  else args.push('--input', '-');
  const result = spawnSync('gh', args, {
    encoding: 'utf8', input: fields ? JSON.stringify(fields) : undefined, maxBuffer: 16 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`GitHub API failed: ${result.stderr.trim()}`);
  const value = JSON.parse(result.stdout);
  return method === 'GET' ? value.flat() : value;
}
async function watch({ repo, baseline, write = false, read = readOfficial, api = ghApi, runUrl = null }) {
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo || '')) throw new Error('Expected owner/repo');
  versionParts(baseline);
  if (runUrl !== null && !new RegExp(`^https://github\\.com/${repo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/actions/runs/[1-9]\\d*$`).test(runUrl))
    throw new Error('Invalid workflow run URL');
  const latest = parseLatest(await read(DOCS_URL));
  if (!newerThan(latest.version, baseline)) return { status: 'current', baseline, ...latest };
  const notes = await read(latest.notesUrl);
  const headings = [...notes.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)];
  if (headings.length !== 1 || plain(headings[0][1]) !== `${latest.version} Release Notes`)
    throw new Error('Release notes heading does not match latest version');
  const marker = `<!-- cavalry-upstream-release:${latest.version} -->`;
  const title = `[Upstream] Cavalry ${latest.version} 兼容性评估`;
  const body = `${marker}\n官方已发布 Cavalry **${latest.version}**；仓库当前 native target 为 **${baseline}**。\n\n`
    + `- [官方版本入口](${DOCS_URL})\n- [官方发行说明](${latest.notesUrl})\n\n`
    + (runUrl ? `发现来源：[GitHub Actions 监控运行](${runUrl})。\n\n` : '')
    + `这是版本发现提醒，尚未证明新版注入或字体兼容。\n\n`
    + `- [ ] 获取官方安装包，记录版本、签名、架构及 SHA-256。\n`
    + `- [ ] 对比 catalog/schema/MetaData，按稳定键和英文源复用已审批译文，审定新增或改动项。\n`
    + `- [ ] 核对 Qt/Skia、映像身份、符号、调用窗和恢复事务；不能仅替换 UUID 或放宽版本门。\n`
    + `- [ ] 回归简/繁/日菜单、帮助、Timeline 测量/绘制、Viewport 与自绘节点；稳定显示和首帧分开验收。\n`
    + `- [ ] 核查 CLI、后台渲染及官方移除功能；macOS 和 Windows 分别验收。\n`
    + `- [ ] 完成安装、切语、恢复及打包验证后再更新支持版本。\n`;
  if (!write) return { status: 'would-create', baseline, ...latest, title, body };
  // List directly instead of search: search indexing can lag immediately after creation.
  const issues = api(`repos/${repo}/issues?state=all&per_page=100`);
  if (!Array.isArray(issues)) throw new Error('Expected GitHub issue list');
  const existing = issues.find(issue => !issue.pull_request
    && ((issue.body || '').includes(marker) || issue.title === title));
  if (existing) return { status: 'exists', baseline, ...latest, issueUrl: existing.html_url };
  const issue = api(`repos/${repo}/issues`, 'POST', { title, body });
  if (!Number.isSafeInteger(issue.number) || !issue.html_url) throw new Error('Invalid created issue response');
  return { status: 'created', baseline, ...latest, issueUrl: issue.html_url };
}
if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.some(arg => arg !== '--write')) {
    console.error('Usage: GITHUB_REPOSITORY=owner/repo node tools/watch_cavalry_release.js [--write]');
    process.exitCode = 1;
  } else {
    watch({ repo: process.env.GITHUB_REPOSITORY, baseline: require('./cavalry_native_target.json').cavalryVersion,
      runUrl: process.env.GITHUB_ACTIONS === 'true'
        ? `https://github.com/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}` : null,
      write: args.includes('--write') }).then(result => console.log(JSON.stringify(result, null, 2)))
      .catch(error => { console.error(`[cavalry-release-watch] ${error.message}`); process.exitCode = 1; });
  }
}
module.exports = { parseLatest, newerThan, watch };
