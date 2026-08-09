const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let mainWindow;
let splashWindow;
let activeProcess = null;
let isCancelled = false;

function createSplashScreen() {
  splashWindow = new BrowserWindow({
    width: 600,
    height: 400,
    frame: false,
    transparent: false,
    alwaysOnTop: true,
    resizable: false,
    backgroundColor: '#000000'
  });

  splashWindow.loadFile(path.join(__dirname, 'renderer', 'splash.html'));

  setTimeout(() => {
    createMainWindow();
    if (splashWindow) {
      splashWindow.close();
      splashWindow = null;
    }
  }, 3000);
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 640,
    height: 750,
    resizable: true,
    minWidth: 580,
    minHeight: 650,
    title: 'Stroom',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  mainWindow.setMenuBarVisibility(false);
  
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });
}

app.whenReady().then(createSplashScreen);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createSplashScreen();
});

function parseProgress(line) {
  const ytdlpMatch = line.match(/(\d+\.?\d*)%/);
  if (ytdlpMatch) {
    return { progress: parseFloat(ytdlpMatch[1]), text: line.trim().substring(0, 80) };
  }
  const spotdlMatch = line.match(/(\d+)%/);
  if (spotdlMatch) {
    return { progress: parseFloat(spotdlMatch[1]), text: line.trim().substring(0, 80) };
  }
  return null;
}

ipcMain.handle('run-command', async (event, command) => {
  if (activeProcess) {
    activeProcess.kill('SIGTERM');
    activeProcess = null;
  }
  
  isCancelled = false;

  return new Promise((resolve) => {
    const parts = command.split(' ');
    const cmd = parts[0];
    const args = parts.slice(1);

    activeProcess = spawn(cmd, args, {
      cwd: app.getPath('downloads'),
      shell: true
    });

    activeProcess.stderr.on('data', (data) => {
      const lines = data.toString().split('\n');
      for (const line of lines) {
        const progress = parseProgress(line);
        if (progress && mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('download-progress', progress);
        }
      }
    });

    activeProcess.stdout.on('data', (data) => {
      const lines = data.toString().split('\n');
      for (const line of lines) {
        const progress = parseProgress(line);
        if (progress && mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('download-progress', progress);
        }
      }
    });

    activeProcess.on('close', (code) => {
      activeProcess = null;
      if (isCancelled) {
        resolve({ success: false, message: 'Cancelled', cancelled: true });
      } else if (code === 0) {
        resolve({ success: true, message: 'Download complete!' });
      } else {
        resolve({ success: false, message: `Exited with code ${code}` });
      }
    });

    activeProcess.on('error', (err) => {
      activeProcess = null;
      resolve({ success: false, message: err.message });
    });
  });
});

ipcMain.handle('cancel-command', async () => {
  if (activeProcess) {
    isCancelled = true;
    try {
      process.kill(-activeProcess.pid, 'SIGTERM');
    } catch(e) {
      activeProcess.kill('SIGTERM');
    }
    activeProcess = null;
    return { success: true };
  }
  return { success: false, message: 'No active download' };
});

ipcMain.handle('open-downloads', async () => {
  shell.openPath(app.getPath('downloads'));
});
