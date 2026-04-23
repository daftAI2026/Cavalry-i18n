/**
 * [INPUT]: 依赖 electron contextBridge/ipcRenderer 调用主进程 i18n:* IPC 通道
 * [OUTPUT]: 对外提供 window.cavalryI18n 的 5 个 Promise API
 * [POS]: desktop-patcher 的 renderer 兼容桥，隔离 DOM 脚本与 Electron IPC
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('cavalryI18n', {
  getStatus: () => ipcRenderer.invoke('i18n:get-status'),
  browseApp: () => ipcRenderer.invoke('i18n:browse-app'),
  extractEnglish: (appPath) => ipcRenderer.invoke('i18n:extract-english', { appPath }),
  applyLanguage: (appPath, lang) => ipcRenderer.invoke('i18n:apply-language', { appPath, lang }),
  restartCavalry: (appPath) => ipcRenderer.invoke('i18n:restart-cavalry', { appPath }),
});
