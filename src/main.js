const { app, BrowserWindow, ipcMain, shell, dialog, clipboard } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn, exec, execSync } = require('child_process');

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
    backgroundColor: '#202D3C'
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
    width: 680,
    height: 900,
    resizable: true,
    minWidth: 580,
    minHeight: 780,
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

ipcMain.handle('copy-to-clipboard', (event, text) => {
  clipboard.writeText(text);
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
  if (activeProcess) { try { process.kill(-activeProcess.pid, 'SIGTERM'); } catch(e) { activeProcess.kill('SIGTERM'); } activeProcess = null; }
  isCancelled = false;
  return new Promise((resolve) => {
    // detached so the shell gets its own process group — lets cancel-command
    // kill the whole tree (yt-dlp/ffmpeg/spotdl), not just the shell wrapper.
    activeProcess = spawn(command, { shell: true, cwd: app.getPath('downloads'), detached: true });
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

// ── Remove vocals (download audio, then split with demucs) ──
// Runs one child process at a time, tracked in the same `activeProcess`
// variable the run-command/cancel-command handlers use, so the existing
// cancel button works here too without any extra plumbing.
function runStep(cmd, args, cwd, progressPrefix) {
  return new Promise((resolve) => {
    activeProcess = spawn(cmd, args, { cwd, detached: true });
    let stdout = '';
    const onData = (data) => {
      const text = data.toString();
      stdout += text;
      for (const line of text.split('\n')) {
        const p = parseProgress(line);
        if (p && mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('download-progress', { progress: p.progress, text: progressPrefix + p.text });
        }
      }
    };
    activeProcess.stdout.on('data', onData);
    activeProcess.stderr.on('data', onData);
    activeProcess.on('close', (code) => { activeProcess = null; resolve({ code, stdout }); });
    activeProcess.on('error', (err) => { activeProcess = null; resolve({ code: -1, error: err }); });
  });
}

ipcMain.handle('remove-vocals', async (event, { url, outDir }) => {
  if (activeProcess) { try { process.kill(-activeProcess.pid, 'SIGTERM'); } catch(e) { activeProcess.kill('SIGTERM'); } activeProcess = null; }
  isCancelled = false;
  const dest = outDir || app.getPath('downloads');
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stroom-vocals-'));

  try {
    // Step 1: download audio via yt-dlp. --print after_move:filepath prints the
    // final file path once post-processing (the mp3 conversion) is done.
    const dl = await runStep(
      'yt-dlp',
      ['-x', '--audio-format', 'mp3', '--print', 'after_move:filepath', '-o', path.join(tmpDir, '%(title)s.%(ext)s'), url],
      tmpDir, '⬇️ '
    );
    if (isCancelled) return { success: false, cancelled: true, message: 'Cancelled' };
    if (dl.error) return { success: false, message: `yt-dlp not found: ${dl.error.message}` };
    if (dl.code !== 0) return { success: false, message: `Download failed (exit ${dl.code})` };

    const lines = dl.stdout.split('\n').map(l => l.trim()).filter(Boolean);
    const audioFile = lines[lines.length - 1];
    if (!audioFile || !fs.existsSync(audioFile)) return { success: false, message: 'Could not locate downloaded audio file' };

    // Step 2: split vocals from instrumental with demucs.
    const sep = await runStep(
      'demucs',
      ['--two-stems=vocals', '--mp3', '-o', path.join(tmpDir, 'separated'), audioFile],
      tmpDir, '🎤 '
    );
    if (isCancelled) return { success: false, cancelled: true, message: 'Cancelled' };
    if (sep.error) return { success: false, message: 'demucs not found — install with: pip install -U demucs' };
    if (sep.code !== 0) return { success: false, message: `Vocal separation failed (exit ${sep.code})` };

    // demucs produces both stems in one pass — save the instrumental and the
    // isolated vocals-only track, since the separation work is already done.
    const base = path.basename(audioFile, path.extname(audioFile));
    const stemDir = path.join(tmpDir, 'separated', 'htdemucs', base);
    const instrumentalSrc = path.join(stemDir, 'no_vocals.mp3');
    const vocalsSrc = path.join(stemDir, 'vocals.mp3');
    if (!fs.existsSync(instrumentalSrc)) return { success: false, message: 'Instrumental output not found' };

    fs.copyFileSync(instrumentalSrc, path.join(dest, `${base} (Instrumental).mp3`));
    let message = 'Done! Saved instrumental';
    if (fs.existsSync(vocalsSrc)) {
      fs.copyFileSync(vocalsSrc, path.join(dest, `${base} (Vocals Only).mp3`));
      message += ' + vocals-only';
    }
    return { success: true, message: `${message} to your Downloads folder` };
  } catch (err) {
    return { success: false, message: err.message };
  } finally {
    fs.rm(tmpDir, { recursive: true, force: true }, () => {});
  }
});
