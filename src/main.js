const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const path = require('path');
const { spawn, exec } = require('child_process');

let mainWindow;
let splashWindow;
let activeProcess = null;
let isCancelled = false;

// ── Splash screen ──────────────────────────────────
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

  // Fade out after 2.5s
  setTimeout(() => {
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.webContents.executeJavaScript(`
        document.body.style.transition = 'opacity 0.5s';
        document.body.style.opacity = '0';
      `);
      setTimeout(() => {
        createMainWindow();
        if (splashWindow) { splashWindow.close(); splashWindow = null; }
      }, 500);
    }
  }, 2500);
}

// ── Main window ────────────────────────────────────
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
  mainWindow.once('ready-to-show', () => { mainWindow.show(); });
}

app.whenReady().then(createSplashScreen);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createSplashScreen(); });

// ── IPC Handlers ───────────────────────────────────
ipcMain.handle('get-default-download-path', () => app.getPath('downloads'));

ipcMain.handle('choose-download-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Choose Download Folder',
    properties: ['openDirectory']
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});

ipcMain.handle('open-folder', async (event, folderPath) => {
  shell.openPath(folderPath);
});

// ── Auto‑update tools ──────────────────────────────
ipcMain.handle('update-tools', async () => {
  const commands = [];
  // Detect package managers
  try { execSync('which brew'); commands.push('brew upgrade yt-dlp ffmpeg'); } catch(e) { /* no brew */ }
  commands.push('pipx upgrade spotdl');
  // Fallback: also try pip if spotdl is not installed via pipx
  commands.push('pip install --upgrade spotdl 2>/dev/null || true');

  let output = '';
  for (const cmd of commands) {
    try {
      const result = await new Promise((resolve, reject) => {
        exec(cmd, { timeout: 60000 }, (err, stdout, stderr) => {
          resolve(stdout + stderr);
        });
      });
      output += `> ${cmd}\n${result}\n`;
    } catch (err) {
      output += `> ${cmd}\n⚠️  Error: ${err.message}\n`;
    }
  }
  return output.trim() || 'All tools are up to date.';
});

// ── Run download command (fixed deprecation warning) ──
function parseProgress(line) {
  const ytdlpMatch = line.match(/(\d+\.?\d*)%/);
  if (ytdlpMatch) return { progress: parseFloat(ytdlpMatch[1]), text: line.trim().substring(0, 80) };
  const spotdlMatch = line.match(/(\d+)%/);
  if (spotdlMatch) return { progress: parseFloat(spotdlMatch[1]), text: line.trim().substring(0, 80) };
  return null;
}

ipcMain.handle('run-command', async (event, command) => {
  if (activeProcess) { activeProcess.kill('SIGTERM'); activeProcess = null; }
  isCancelled = false;
  return new Promise((resolve) => {
    activeProcess = spawn(command, { shell: true, cwd: app.getPath('downloads') });
    activeProcess.stderr.on('data', (data) => {
      for (const line of data.toString().split('\n')) {
        const p = parseProgress(line);
        if (p && mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('download-progress', p);
      }
    });
    activeProcess.stdout.on('data', (data) => {
      for (const line of data.toString().split('\n')) {
        const p = parseProgress(line);
        if (p && mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('download-progress', p);
      }
    });
    activeProcess.on('close', (code) => {
      activeProcess = null;
      if (isCancelled) resolve({ success: false, message: 'Cancelled', cancelled: true });
      else if (code === 0) resolve({ success: true, message: 'Download complete!' });
      else resolve({ success: false, message: `Exited with code ${code}` });
    });
    activeProcess.on('error', (err) => { activeProcess = null; resolve({ success: false, message: err.message }); });
  });
});

ipcMain.handle('cancel-command', async () => {
  if (activeProcess) {
    isCancelled = true;
    try { process.kill(-activeProcess.pid, 'SIGTERM'); } catch(e) { activeProcess.kill('SIGTERM'); }
    activeProcess = null; return { success: true };
  }
  return { success: false, message: 'No active download' };
});
