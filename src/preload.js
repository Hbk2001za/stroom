const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  runCommand: (command, onProgress) => {
    if (onProgress) {
      ipcRenderer.on('download-progress', (event, data) => onProgress(data));
    }
    return ipcRenderer.invoke('run-command', command);
  },
  cancelCommand: () => ipcRenderer.invoke('cancel-command'),
  openDownloads: () => ipcRenderer.invoke('open-downloads')
});
