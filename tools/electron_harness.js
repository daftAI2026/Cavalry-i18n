/**
 * [INPUT]: 依赖 ./fixtures/make_fake_cavalry_bundle 与 desktop-patcher/i18n-handlers 的注入接口
 * [OUTPUT]: 对外提供 createElectronHarness，生成 fake app、handler map、command log 与路径归一化函数
 * [POS]: tools 的无副作用 Electron harness，被 contract snapshot 捕获与回归测试使用
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createI18nHandlers } = require('../desktop-patcher/i18n-handlers');
const { makeFakeCavalryBundle } = require('./fixtures/make_fake_cavalry_bundle');

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'cavalry-i18n-electron-harness-'));
}

function makeSpawn(commandLog) {
  return (command, args = [], options = {}) => {
    commandLog.push({
      type: 'spawn',
      command,
      args,
      detached: Boolean(options.detached),
    });
    return {
      unref() {
        commandLog.push({ type: 'unref', command });
      },
    };
  };
}

function makeSpawnSync(commandLog) {
  return (command, args = [], options = {}) => {
    commandLog.push({
      type: 'spawnSync',
      command,
      args,
      stdio: options.stdio || '',
    });
    return { status: 0, stdout: '', stderr: '' };
  };
}

function createElectronHarness(options = {}) {
  const rootDir = makeTempDir();
  const userDataDir = path.join(rootDir, 'userData');
  const resourcesPath = path.join(rootDir, 'Resources');
  const { appPath, version } = makeFakeCavalryBundle(rootDir, options);
  const commandLog = [];

  fs.mkdirSync(path.join(resourcesPath, 'injector'), { recursive: true });
  fs.writeFileSync(
    path.join(resourcesPath, 'injector', 'libCavalryTranslatorInjector.dylib'),
    'fake injector\n',
    { mode: 0o755 }
  );

  const spawn = makeSpawn(commandLog);
  const spawnSync = makeSpawnSync(commandLog);
  const handlers = createI18nHandlers({
    fs,
    os,
    path,
    spawn,
    spawnSync,
    commandRunner: { spawn, spawnSync },
    dialog: {
      async showOpenDialog() {
        return { canceled: false, filePaths: [appPath] };
      },
    },
    appPaths: {
      getUserData: () => userDataDir,
      isPackaged: true,
    },
    resourcesPath,
    platform: 'darwin',
    now: () => new Date('2026-04-23T00:00:00.000Z'),
    findCavalryApp: (stateAppPath) =>
      stateAppPath && fs.existsSync(stateAppPath) ? stateAppPath : appPath,
    getDefaultAppCandidates: () => [appPath, '/Applications/Cavalry.app'],
    inspectBundle: (targetPath) => {
      const assetsRoot = path.join(targetPath, 'Contents', 'assets');
      return {
        exists: Boolean(targetPath) && fs.existsSync(targetPath),
        appPath: targetPath,
        version,
        hasAssetsRoot: fs.existsSync(assetsRoot),
        hasDefinitions: fs.existsSync(path.join(assetsRoot, 'Definitions')),
        hasLearn: fs.existsSync(path.join(assetsRoot, 'Learn')),
        hasPlugins: fs.existsSync(path.join(assetsRoot, 'Plugins')),
      };
    },
    readBundleVersion: () => version,
    verifyCodeSignature: () => ({ ok: true, message: '' }),
  });

  function normalizePaths(value) {
    const json = JSON.stringify(value, null, 2)
      .replaceAll(rootDir, '<fixture>')
      .replaceAll(process.cwd(), '<repo>')
      .replace(/cavalry-i18n-staging-\d+-\d+/g, 'cavalry-i18n-staging-<stamp>');
    return JSON.parse(json);
  }

  async function invoke(channel, payload) {
    return handlers[channel]({}, payload);
  }

  return {
    appPath,
    commandLog,
    handlers,
    invoke,
    normalizePaths,
    resourcesPath,
    rootDir,
    userDataDir,
    version,
  };
}

module.exports = {
  createElectronHarness,
};
