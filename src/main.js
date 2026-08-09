const { app, BrowserWindow } = require('electron');
const path = require('path');

let splashWindow;
let mainWindow;

function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 400,
    height: 300,
    frame: false,
    transparent: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  const splashHtml = path.join(__dirname, 'renderer', 'splash.html');
  splashWindow.loadFile(splashHtml);
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    show: false, // keep hidden until ready
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  mainWindow.once('ready-to-show', () => {
    // Wait 3 seconds before showing main window and closing splash
    setTimeout(() => {
      mainWindow.show();
      if (splashWindow) {
        splashWindow.close();
        splashWindow = null;
      }
    }, 3000);
  });
}

app.whenReady().then(() => {
  createSplashWindow();
  createMainWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
