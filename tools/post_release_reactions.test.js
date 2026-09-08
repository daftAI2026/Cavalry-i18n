/**
 * [INPUT]: 依赖 node:test 与发布 reactions 的注入式 GitHub API 边界
 * [OUTPUT]: 验证公开 Release 六种 reactions、回读、重复调用与错误拒绝，不访问 GitHub
 * [POS]: 发布后非关键反馈的离线合同；不把点赞成功等同于资产发布成功
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { postReleaseReactions } = require('./post_release_reactions');
const tag = 'cavalry-2.7.2-p7';
function fixture(overrides = {}) {
  const records = [];
  const calls = [];
  const api = (route, method = 'GET', fields, paginate = false) => {
    calls.push({ route, method, fields, paginate });
    if (route.includes('/releases/tags/')) return { id: 42, tag_name: tag, draft: false, prerelease: false, ...overrides };
    if (method === 'POST') {
      let row = records.find(r => r.content === fields.content);
      if (!row) { row = { id: records.length + 1, content: fields.content }; records.push(row); }
      return row;
    }
    assert.equal(paginate, true);
    return [...records];
  };
  return { records, calls, api };
}
test('posts all six positive reactions and verifies IDs without duplicate records', () => {
  const f = fixture();
  for (let i = 0; i < 2; i++) postReleaseReactions({ tag, repo: 'owner/repo', api: f.api });
  assert.deepEqual(f.records.map(r => r.content), ['+1', 'laugh', 'hooray', 'heart', 'rocket', 'eyes']);
  assert.ok(f.calls.every(c => c.route.startsWith('repos/owner/repo/releases/')));
});
test('rejects draft, prerelease, wrong tag or invalid identity before posting', () => {
  for (const bad of [{ draft: true }, { prerelease: true }, { tag_name: 'other' }, { id: 0 }]) {
    const f = fixture(bad);
    assert.throws(() => postReleaseReactions({ tag, repo: 'owner/repo', api: f.api }));
    assert.equal(f.records.length, 0);
  }
  const f = fixture();
  assert.throws(() => postReleaseReactions({ tag: 'v1', repo: 'owner/repo', api: f.api }));
  assert.equal(f.calls.length, 0);
});
test('API failures and missing readback remain visible failures', () => {
  assert.throws(() => postReleaseReactions({ tag, repo: 'owner/repo', api: () => { throw Error('API denied'); } }), /API denied/);
  const f = fixture();
  assert.throws(() => postReleaseReactions({ tag, repo: 'owner/repo', api: (...args) => args[3] ? [] : f.api(...args) }), /readback/);
});

test('workflow posts reactions only after verified publication and keeps failures non-blocking', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const YAML = require('yaml');
  const source = fs.readFileSync(path.join(__dirname, '../.github/workflows/build.yml'), 'utf8');
  const steps = YAML.parse(source).jobs.release.steps;
  const publish = steps.findIndex(s => s.name === 'Publish GitHub Release (idempotent, digest fail-closed)');
  const reaction = steps.findIndex(s => s.name === 'Add positive Release reactions');
  assert.ok(publish >= 0 && reaction > publish);
  assert.equal(steps[reaction]['continue-on-error'], true);
  assert.equal(steps[reaction].run, 'node tools/post_release_reactions.js "$GITHUB_REF_NAME" "$GITHUB_REPOSITORY"');
  assert.equal(steps[reaction].if, undefined, 'normal success chaining must not become always()');
});
