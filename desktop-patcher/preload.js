const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('cavalryI18n', {
  getStatus: () => ipcRenderer.invoke('i18n:get-status'),
  browseApp: () => ipcRenderer.invoke('i18n:browse-app'),
  extractEnglish: (appPath) => ipcRenderer.invoke('i18n:extract-english', { appPath }),
  applyLanguage: (appPath, lang) => ipcRenderer.invoke('i18n:apply-language', { appPath, lang }),
  restartCavalry: (appPath) => ipcRenderer.invoke('i18n:restart-cavalry', { appPath }),
});
