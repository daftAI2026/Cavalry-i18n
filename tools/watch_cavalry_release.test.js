/**
 * [INPUT]: 合成官网/Issues/API与监控工作流配置。
 * [OUTPUT]: 核验版本比较、官网漂移拒绝、关闭issue去重及最小写入边界。
 * [POS]: 版本监控离线行为合同，不触网或创建真实issue。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { parseLatest, newerThan, watch } = require('./watch_cavalry_release');
const home = (version = '2.8.1', href = `/docs/tech-info/release-notes/2.8/2-8-1-release-notes/`) =>
  `<p>Latest version: <strong>${version}</strong></p><a href=${href}><span>${version} Release Notes</span></a>`;
const options = overrides => ({ repo: 'owner/repo', baseline: '2.8.0',
  read: async url => url.endsWith('/docs/') ? home() : '<h1>2.8.1 Release Notes</h1>',
  api: () => { throw new Error('Unexpected GitHub access'); }, ...overrides });

test('parses the official quoted/unquoted Docusaurus markup and ignores script text', () => {
  for (const quote of ['', '"', "'"]) {
    const url = '/docs/tech-info/release-notes/2.8/2-8-1-release-notes/';
    const html = home().replace(`href=${url}`, `href=${quote}${url}${quote}`);
    assert.deepEqual(parseLatest(html + '<script>Latest version: 9.9.9</script>'),
      { version: '2.8.1', notesUrl: `https://cavalry.studio${url}` });
  }
});
test('parses the official release card with its trailing arrow span', () => {
  const html = home().replace('</a>', '<span>→</span></a>');
  assert.equal(parseLatest(html).version, '2.8.1');
});
test('rejects missing/ambiguous version, preview version and mismatched or offsite notes', () => {
  for (const html of ['', home() + '<p>Latest version: 2.9.0</p>', home('2.8.1-beta'),
    home().replace('2.8.1 Release Notes', '2.8 Release Notes'),
    home('2.8.1', 'https://example.com/docs/tech-info/release-notes/2.8.1/'),
    home('2.8.1', '/docs/unrelated/'), home('02.8.1')]) assert.throws(() => parseLatest(html));
});
test('compares numeric stable components rather than strings', () => {
  for (const [a, b, expected] of [['2.8.1', '2.8.0', true], ['2.10.0', '2.9.9', true],
    ['3.0.0', '2.99.99', true], ['2.8.0', '2.8.0', false], ['2.7.9', '2.8.0', false]])
    assert.equal(newerThan(a, b), expected);
  for (const invalid of ['2.8', '02.8.0', '2.8.1-rc1', '999999999999999999999.0.0'])
    assert.throws(() => newerThan(invalid, '2.8.0'));
});
test('dry-run verifies both official pages but never calls GitHub', async () => {
  const result = await watch(options());
  assert.equal(result.status, 'would-create');
  assert.match(result.body, /<!-- cavalry-upstream-release:2.8.1 -->/);
  assert.match(result.body, /2\.8\.0/);
  assert.match(result.body, /不能仅替换 UUID/);
});
test('Action discoveries carry the exact workflow run provenance', async () => {
  const runUrl = 'https://github.com/owner/repo/actions/runs/12345';
  const result = await watch(options({ runUrl }));
  assert.ok(result.body.includes(runUrl));
  await assert.rejects(watch(options({ runUrl: 'https://example.com/fake' })), /workflow run/);
});
test('equal/older version does not fetch notes or touch Issues', async () => {
  let reads = 0;
  const result = await watch(options({ baseline: '2.8.1', read: async () => { reads++; return home(); } }));
  assert.equal(result.status, 'current');
  assert.equal(reads, 1);
});
test('direct all-state issue list deduplicates even closed issues, ignoring PRs', async () => {
  for (const existing of [
    { state: 'closed', body: '<!-- cavalry-upstream-release:2.8.1 -->' },
    { state: 'open', title: '[Upstream] Cavalry 2.8.1 兼容性评估' },
  ]) {
    let calls = 0;
    const result = await watch(options({ write: true, api: route => {
      calls++;
      assert.equal(route, 'repos/owner/repo/issues?state=all&per_page=100');
      return [{ ...existing, html_url: 'https://github.com/owner/repo/issues/4' }];
    } }));
    assert.equal(result.status, 'exists');
    assert.equal(calls, 1);
  }
});
test('creates once and reruns do not duplicate; upstream HTML is never copied into issue', async () => {
  const issues = [{ pull_request: {}, title: '[Upstream] Cavalry 2.8.1 兼容性评估' }];
  let posts = 0;
  const settings = options({ write: true, api: (route, method, fields) => {
    if (method !== 'POST') return issues;
    assert.equal(route, 'repos/owner/repo/issues');
    posts++;
    const issue = { ...fields, number: 7, html_url: 'https://github.com/owner/repo/issues/7' };
    issues.push(issue); return issue;
  } });
  assert.equal((await watch(settings)).status, 'created');
  assert.equal((await watch(settings)).status, 'exists');
  assert.equal(posts, 1);
  assert.doesNotMatch(issues[1].body, /<h1>/);
});
test('network, notes drift and GitHub failure never silently become current', async () => {
  await assert.rejects(watch(options({ read: async () => { throw new Error('HTTP 503'); } })), /503/);
  await assert.rejects(watch(options({ read: async url => url.endsWith('/docs/') ? home() : '<h1>2.8 Release Notes</h1>' })), /heading/);
  await assert.rejects(watch(options({ write: true })), /Unexpected GitHub/);
  await assert.rejects(watch(options({ repo: 'owner/repo; bad' })), /owner\/repo/);
});
test('workflow is scheduled/manual only, pinned, serialized and scoped to Issues', () => {
  const YAML = require('yaml');
  const text = fs.readFileSync('.github/workflows/watch-cavalry-release.yml', 'utf8');
  const doc = YAML.parseDocument(text, { strict: true, uniqueKeys: true });
  assert.deepEqual(doc.errors, []);
  const workflow = doc.toJS();
  assert.deepEqual(Object.keys(workflow.on).sort(), ['schedule', 'workflow_dispatch']);
  assert.deepEqual(workflow.permissions, { contents: 'read', issues: 'write' });
  assert.equal(workflow.concurrency['cancel-in-progress'], false);
  assert.equal(workflow.jobs.watch['runs-on'], 'ubuntu-24.04');
  const pins = require('./ci_action_pins.json');
  for (const step of workflow.jobs.watch.steps.filter(step => step.uses)) {
    const [name, sha] = step.uses.split('@');
    assert.equal(sha, pins.actions[name].sha);
  }
  assert.equal(workflow.jobs.watch.steps[1].with['node-version'], pins.node.version);
  assert.match(workflow.jobs.watch.steps[2].run, /^node tools\/watch_cavalry_release.js --write$/);
});
