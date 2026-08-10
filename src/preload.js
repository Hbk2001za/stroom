const { contextBridge, ipcRenderer } = require('electron');
let currentProgressListener = null;

contextBridge.exposeInMainWorld('api', {
  runCommand: (command, onProgress) => {
    if (currentProgressListener) {
      ipcRenderer.removeListener('download-progress', currentProgressListener);
      currentProgressListener = null;
    }
    if (onProgress) {
      currentProgressListener = (event, data) => onProgress(data);
      ipcRenderer.on('download-progress', currentProgressListener);
    }
    return ipcRenderer.invoke('run-command', command).finally(() => {
      if (currentProgressListener) {
        ipcRenderer.removeListener('download-progress', currentProgressListener);
        currentProgressListener = null;
      }
    });
  },
  removeVocals: (url, outDir, onProgress) => {
    if (currentProgressListener) {
      ipcRenderer.removeListener('download-progress', currentProgressListener);
      currentProgressListener = null;
    }
    if (onProgress) {
      currentProgressListener = (event, data) => onProgress(data);
      ipcRenderer.on('download-progress', currentProgressListener);
    }
    return ipcRenderer.invoke('remove-vocals', { url, outDir }).finally(() => {
      if (currentProgressListener) {
        ipcRenderer.removeListener('download-progress', currentProgressListener);
        currentProgressListener = null;
      }
    });
  },
  cancelCommand: () => ipcRenderer.invoke('cancel-command'),
  getDefaultDownloadPath: () => ipcRenderer.invoke('get-default-download-path'),
  chooseDownloadFolder: () => ipcRenderer.invoke('choose-download-folder'),
  openFolder: (p) => ipcRenderer.invoke('open-folder', p),
  copyText: (text) => ipcRenderer.invoke('copy-to-clipboard', text),
  updateTools: () => ipcRenderer.invoke('update-tools')
});
