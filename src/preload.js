const { contextBridge, ipcRenderer } = require('electron');
let currentProgressListener = null;

contextBridge.exposeInMainWorld('api', {
  // Remove Vocals is a dead end on Intel Mac: both PyTorch and a Rust-based
  // demucs dependency (sphn) dropped Intel Mac wheel support, and building
  // either from source hits further failures. Not worth chasing further —
  // hide/disable the feature there instead of a broken-looking retry loop.
  isIntelMac: process.platform === 'darwin' && process.arch === 'x64',
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
  updateTools: () => ipcRenderer.invoke('update-tools'),
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  downloadUpdate: (info, onProgress) => {
    let listener = null;
    if (onProgress) {
      listener = (event, data) => onProgress(data);
      ipcRenderer.on('update-download-progress', listener);
    }
    return ipcRenderer.invoke('download-update', info).finally(() => {
      if (listener) ipcRenderer.removeListener('update-download-progress', listener);
    });
  }
});
