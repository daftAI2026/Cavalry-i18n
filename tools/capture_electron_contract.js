#!/usr/bin/env node
/**
 * [INPUT]: 依赖 ./electron_harness 生成无副作用 Electron handler 环境
 * [OUTPUT]: 对外提供 captureElectronContract，并可从 CLI 打印 5 个 IPC 的规范化 snapshot
 * [POS]: tools 的 Electron 行为捕获器，被 check_electron_contract_snapshots.js 比较旧世界基准
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
const { createElectronHarness } = require('./electron_harness');

async function captureElectronContract() {
  const harness = createElectronHarness();
  const appPath = harness.appPath;
  const events = [];

  events.push({
    channel: 'i18n:get-status',
    result: await harness.invoke('i18n:get-status'),
  });
  events.push({
    channel: 'i18n:browse-app',
    result: await harness.invoke('i18n:browse-app'),
  });
  events.push({
    channel: 'i18n:extract-english',
    args: { appPath },
    result: await harness.invoke('i18n:extract-english', { appPath }),
  });
  events.push({
    channel: 'i18n:apply-language',
    args: { appPath, lang: 'zh-Hans' },
    result: await harness.invoke('i18n:apply-language', { appPath, lang: 'zh-Hans' }),
  });
  events.push({
    channel: 'i18n:restart-cavalry',
    args: { appPath },
    result: await harness.invoke('i18n:restart-cavalry', { appPath }),
  });

  return harness.normalizePaths({
    events,
    commandLog: harness.commandLog,
  });
}

if (require.main === module) {
  captureElectronContract()
    .then((snapshot) => {
      process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
    })
    .catch((error) => {
      process.stderr.write(`${error.stack || error.message}\n`);
      process.exitCode = 1;
    });
}

module.exports = {
  captureElectronContract,
};
