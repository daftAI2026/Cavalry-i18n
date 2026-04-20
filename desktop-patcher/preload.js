const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktopPatcher', {
  getBootstrap: () => ipcRenderer.invoke('desktop-patcher:get-bootstrap'),
  chooseApp: () => ipcRenderer.invoke('desktop-patcher:choose-app'),
  inspectApp: (appPath) => ipcRenderer.invoke('desktop-patcher:inspect-app', appPath),
  runPatch: (options) => ipcRenderer.invoke('desktop-patcher:run-patch', options),
});
