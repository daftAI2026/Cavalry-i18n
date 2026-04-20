const path = require('node:path');
const { execFile } = require('node:child_process');
const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const {
  buildPatchCommand,
  getDefaultAppCandidates,
  getExistingDefaultAppPath,
  inspectBundle,
  listLanguageOptions,
} = require('./lib/patcher-config');

const repoRoot = path.resolve(__dirname, '..');

function createWindow() {
  const window = new BrowserWindow({
    width: 980,
    height: 780,
    minWidth: 860,
    minHeight: 680,
    backgroundColor: '#0f1117',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  window.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

function runPatch(options) {
  return new Promise((resolve) => {
    const command = buildPatchCommand({
      repoRoot,
      appPath: options.appPath,
      outputAppPath: options.outputAppPath,
      language: options.language,
      qmTarget: options.qmTarget,
      refreshEnglish: options.refreshEnglish,
    });

    execFile(command.program, command.args, { cwd: repoRoot }, (error, stdout, stderr) => {
      resolve({
        ok: !error,
        code: error ? error.code || 1 : 0,
        stdout,
        stderr,
        command: [command.program, ...command.args].join(' '),
      });
    });
  });
}

ipcMain.handle('desktop-patcher:get-bootstrap', async () => {
  const appPath = getExistingDefaultAppPath();
  return {
    repoRoot,
    defaultAppCandidates: getDefaultAppCandidates(),
    appPath,
    languages: listLanguageOptions(repoRoot),
    diagnostics: appPath ? inspectBundle(appPath) : null,
  };
});

ipcMain.handle('desktop-patcher:choose-app', async () => {
  const result = await dialog.showOpenDialog({
    title: 'Select Cavalry.app',
    defaultPath: '/Applications',
    properties: ['openFile'],
    filters: [{ name: 'Applications', extensions: ['app'] }],
  });

  if (result.canceled || result.filePaths.length === 0) {
    return { canceled: true };
  }

  const appPath = result.filePaths[0];
  return {
    canceled: false,
    appPath,
    diagnostics: inspectBundle(appPath),
  };
});

ipcMain.handle('desktop-patcher:inspect-app', async (_event, appPath) => inspectBundle(appPath));
ipcMain.handle('desktop-patcher:run-patch', async (_event, options) => runPatch(options));

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
