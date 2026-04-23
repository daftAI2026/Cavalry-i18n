#!/usr/bin/env node
/**
 * [INPUT]: 依赖 ./capture_electron_contract 与 tools/fixtures/electron_contract_snapshot.json
 * [OUTPUT]: 对外提供 Electron handler contract snapshot 回归测试，确保 5 个 IPC 行为可重复比较
 * [POS]: tools 的 Phase 0 行为冻结测试，阻止 Tauri 迁移追平一个不可信旧世界
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { captureElectronContract } = require('./capture_electron_contract');

const snapshotPath = path.join(__dirname, 'fixtures', 'electron_contract_snapshot.json');

test('electron handler contract matches the no-side-effect snapshot', async () => {
  const expected = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
  const actual = await captureElectronContract();

  assert.deepEqual(actual, expected);
  assert.equal(
    actual.commandLog.some((entry) => /^\/Applications/.test(JSON.stringify(entry))),
    false,
    'snapshot harness must not touch a real /Applications bundle'
  );
});
