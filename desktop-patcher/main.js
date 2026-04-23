/**
 * [INPUT]: 依赖 electron 的窗口、生命周期与 IPC 能力，依赖 ./i18n-handlers 注册业务 handler
 * [OUTPUT]: 对外提供桌面补丁器主进程入口、窗口创建与真实 Electron 依赖装配
 * [POS]: desktop-patcher 的原生壳层，只负责 Electron wiring，不承载补丁业务逻辑
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');
const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const { registerI18nHandlers } = require('./i18n-handlers');

function createWindow() {
  const window = new BrowserWindow({
    useContentSize: true,
    width: 480,
    height: 500,
    minWidth: 420,
    minHeight: 500,
    backgroundColor: '#f8f8fa',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  window.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

function createElectronI18nDeps() {
  return {
    fs,
    os,
    path,
    spawn,
    spawnSync,
    dialog,
    appPaths: {
      getUserData: () => app.getPath('userData'),
      isPackaged: () => app.isPackaged,
    },
    commandRunner: {
      spawn,
      spawnSync,
    },
    resourcesPath: process.resourcesPath,
    now: () => new Date(),
    platform: process.platform,
  };
}

registerI18nHandlers(ipcMain, createElectronI18nDeps());

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
