const { contextBridge } = require('electron');
const path = require('path');

contextBridge.exposeInMainWorld('electronAPI', {
  getSplashImagePath: () => path.join(__dirname, 'renderer', 'splash.png'),
  getLogoPath: () => path.join(__dirname, 'renderer', 'logo.svg')
});
