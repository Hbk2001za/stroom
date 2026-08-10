const { app, BrowserWindow, ipcMain, shell, dialog, clipboard } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn, exec, execSync } = require('child_process');

let mainWindow;
let splashWindow;
let activeProcess = null;
let isCancelled = false;

// `pip install --user` on macOS's system/python.org Python (as opposed to
// Homebrew's) installs console scripts into ~/Library/Python/<version>/bin
// — a real, reproduced gap: this is where `pipx` itself can end up if it
// was bootstrapped via the pip fallback (no Homebrew present), which then
// meant nothing pipx-installed afterward (demucs included) could be found.
function userPythonBinDirs(home) {
  const base = path.join(home, 'Library', 'Python');
  try {
    return fs.readdirSync(base)
      .map(v => path.join(base, v, 'bin'))
      .filter(p => fs.existsSync(p));
  } catch (e) {
    return [];
  }
}

// ── Fix PATH for GUI-launched apps ──────────────────
// A double-clicked .app on macOS gets a bare PATH from launchd/LaunchServices
// (no Homebrew, no ~/.local/bin), unlike a Terminal shell. Without this,
// yt-dlp/ffmpeg/spotdl/demucs all fail with "command not found" (exit 127)
// even though they work fine when the app is started via `npm start`.
function fixPath() {
  if (process.platform === 'win32') return; // Windows PATH is inherited correctly already
  const home = os.homedir();
  const fallbackDirs = [
    '/opt/homebrew/bin', '/opt/homebrew/sbin', // Apple Silicon Homebrew
    '/usr/local/bin', '/usr/local/sbin',        // Intel Homebrew
    path.join(home, '.local/bin'),              // pipx default (also brew pipx)
    ...userPythonBinDirs(home),                 // pip --user on macOS's system Python
    '/usr/bin', '/bin', '/usr/sbin', '/sbin'
  ];

  let loginShellPath = '';
  try {
    const shell = process.env.SHELL || '/bin/zsh';
    loginShellPath = execSync(`${shell} -ilc 'echo -n "$PATH"'`, { encoding: 'utf8', timeout: 5000 }).trim();
  } catch (e) { /* login shell probing failed — fall back to the hardcoded list below */ }

  const combined = [loginShellPath, process.env.PATH, ...fallbackDirs].filter(Boolean).join(':');
  const seen = new Set();
  process.env.PATH = combined.split(':').filter(p => p && !seen.has(p) && seen.add(p)).join(':');
}
fixPath();

// ── Bundled tool resolution ─────────────────────────
// yt-dlp/ffmpeg/spotdl ship inside the app (via extraResources) so Stroom
// works with zero setup. Falls back to whatever's on PATH — used in dev
// mode (no extraResources bundle exists yet) and for tools we don't bundle
// (demucs: needs a separate PyTorch-inclusive build per platform).
function resolveTool(name) {
  const ext = process.platform === 'win32' ? '.exe' : '';
  if (app.isPackaged) {
    const bundled = path.join(process.resourcesPath, 'bin', name + ext);
    if (fs.existsSync(bundled)) return bundled;
  }
  return name;
}

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
  splashWindow.webContents.on('did-finish-load', () => {
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.webContents.executeJavaScript(
        `document.getElementById('splash-version').textContent = 'v${app.getVersion()}';`
      );
    }
  });

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

// ── Update check ─────────────────────────────────────
// Kicked off the moment the splash screen appears (not on main-window
// ready) so the network round-trip overlaps with the splash's ~3s display
// time instead of adding a visible delay of its own. The renderer requests
// the result later via check-for-updates, which just awaits this same
// promise — by then it's usually already resolved.
const REPO = 'Hbk2001za/stroom';
let updateCheckPromise = null;

function isNewerVersion(latest, current) {
  const a = latest.replace(/^v/, '').split('.').map(Number);
  const b = current.replace(/^v/, '').split('.').map(Number);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] || 0, y = b[i] || 0;
    if (x !== y) return x > y;
  }
  return false;
}

async function checkForUpdatesInternal() {
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`);
    if (!res.ok) return { hasUpdate: false };
    const release = await res.json();
    const latestVersion = release.tag_name;
    const current = app.getVersion();
    if (!isNewerVersion(latestVersion, current)) return { hasUpdate: false };

    const wantExt = process.platform === 'win32' ? '.exe' : '.dmg';
    const asset = release.assets.find(a => a.name.toLowerCase().endsWith(wantExt));
    if (!asset) return { hasUpdate: false };

    return {
      hasUpdate: true,
      latestVersion,
      currentVersion: current,
      downloadUrl: asset.browser_download_url,
      assetName: asset.name,
      releaseUrl: release.html_url
    };
  } catch (e) {
    return { hasUpdate: false };
  }
}

ipcMain.handle('check-for-updates', async () => updateCheckPromise || checkForUpdatesInternal());

ipcMain.handle('download-update', async (event, { downloadUrl, assetName }) => {
  try {
    const dest = path.join(app.getPath('temp'), assetName);
    const res = await fetch(downloadUrl, { redirect: 'follow' });
    if (!res.ok) return { success: false, message: `HTTP ${res.status}` };

    const total = Number(res.headers.get('content-length')) || 0;
    let received = 0;
    const fileStream = fs.createWriteStream(dest);
    for await (const chunk of res.body) {
      received += chunk.length;
      fileStream.write(chunk);
      if (total && mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('update-download-progress', { progress: Math.round((received / total) * 100) });
      }
    }
    await new Promise((resolve) => fileStream.end(resolve));

    // Mac: mounts the DMG in Finder. Windows: launches the installer
    // directly (same as double-clicking it) — SmartScreen will still show
    // its warning since the exe is unsigned, that part can't be automated.
    shell.openPath(dest);
    return { success: true };
  } catch (err) {
    return { success: false, message: err.message };
  }
});

app.whenReady().then(() => {
  updateCheckPromise = checkForUpdatesInternal();
  createSplashScreen();
});
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
// yt-dlp/ffmpeg/spotdl ship bundled with the app now, so this button's real
// job is setting up demucs (Remove Vocals) — the one tool we can't bundle
// because of its PyTorch dependency. pipx is the right way to install a CLI
// tool like demucs without hitting Homebrew Python's "externally-managed-
// environment" (PEP 668) restriction.
ipcMain.handle('update-tools', async () => {
  const hasCmd = (probe) => { try { execSync(probe); return true; } catch (e) { return false; } };
  const hasBrew = hasCmd('which brew');
  const hasPipx = hasCmd(process.platform === 'win32' ? 'where pipx' : 'which pipx');

  const commands = [];
  if (!hasPipx) {
    // "pip3" isn't guaranteed on Windows (python.org's installer may only
    // provide "pip" or "python -m pip" depending on version/options), so
    // try the plausible invocations in order rather than assume one exists.
    commands.push(hasBrew
      ? 'brew install pipx'
      : 'pip3 install --user pipx || pip install --user pipx || python3 -m pip install --user pipx || python -m pip install --user pipx');
    commands.push('pipx ensurepath');
  }
  // Intel Mac dead end, confirmed via PyPI metadata: demucs pins
  // torch<2.3 + numpy<2 specifically for darwin+x86_64, because PyTorch
  // dropped Intel Mac wheels entirely after 2.2.2. numpy's last <2 release
  // (1.26.4) only ships wheels up to Python 3.12 — none for 3.13+. So on
  // an Intel Mac running a newer Python, pip is forced to build ancient
  // numpy from source, which fails outright (numpy's legacy build needs
  // distutils, removed in modern Python/setuptools). The only fix is
  // installing demucs with an older, compatible Python if one exists.
  const isIntelMac = process.platform === 'darwin' && process.arch === 'x64';
  const compatiblePython = isIntelMac
    ? ['python3.12', 'python3.11', 'python3.10', 'python3.9'].find(p => hasCmd(`which ${p}`))
    : null;

  if (isIntelMac && !compatiblePython) {
    commands.push('echo "Remove Vocals needs Python 3.9-3.12 on Intel Macs (PyTorch dropped Intel Mac support after version 2.2, which needs an older numpy with no wheels for Python 3.13+). Run: brew install python@3.11 — then click Update Tools again."');
  } else {
    const pythonFlag = compatiblePython ? ` --python ${compatiblePython}` : '';
    // --force on the install fallback in case a previous attempt got killed
    // mid-install (see the 10-minute timeout below) and left a partial venv.
    commands.push(`pipx upgrade demucs || pipx install demucs --force${pythonFlag}`);
    // demucs imports numpy directly, but pipx's isolated venv doesn't always
    // pull it in as a transitive dependency — confirmed reproducible: demucs
    // installed via plain pip gets numpy as a side effect and works, but the
    // same version installed via pipx throws "ModuleNotFoundError: No module
    // named 'numpy'" at runtime (exit 1) without this.
    commands.push('pipx inject demucs numpy --force');
  }

  let output = '';
  for (const cmd of commands) {
    // Re-fix PATH before each step: if a prior step just installed pipx for
    // the first time (e.g. into ~/Library/Python/X.Y/bin), that directory
    // didn't exist yet when fixPath() ran at app launch, so it wouldn't be
    // picked up without re-checking now.
    fixPath();
    try {
      // demucs pulls in PyTorch (hundreds of MB) — a 60s timeout isn't
      // remotely enough on a slower connection. Confirmed reproduced: the
      // install was silently killed mid-way ("creating virtual
      // environment... installing demucs..." then nothing), which then
      // made the next step fail too since no venv existed to inject into.
      const result = await new Promise((resolve, reject) => {
        exec(cmd, { timeout: 600000, maxBuffer: 1024 * 1024 * 10, env: process.env }, (err, stdout, stderr) => {
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

// The renderer builds commands as plain shell strings starting with a bare
// tool name (e.g. "yt-dlp -f ... url"). Swap that leading token for the
// bundled binary's absolute path, and point yt-dlp/spotdl at the bundled
// ffmpeg explicitly via their own flags — this is what makes downloads work
// with zero setup instead of depending on the user's PATH.
function prepareCommand(command) {
  const ffmpeg = resolveTool('ffmpeg');
  if (command.startsWith('yt-dlp ')) {
    return `"${resolveTool('yt-dlp')}" --ffmpeg-location "${ffmpeg}" ${command.slice('yt-dlp '.length)}`;
  }
  if (command.startsWith('spotdl ')) {
    return `"${resolveTool('spotdl')}" ${command.slice('spotdl '.length)} --ffmpeg "${ffmpeg}"`;
  }
  return command;
}

ipcMain.handle('run-command', async (event, command) => {
  if (activeProcess) { try { process.kill(-activeProcess.pid, 'SIGTERM'); } catch(e) { activeProcess.kill('SIGTERM'); } activeProcess = null; }
  isCancelled = false;
  return new Promise((resolve) => {
    // detached so the shell gets its own process group — lets cancel-command
    // kill the whole tree (yt-dlp/ffmpeg/spotdl), not just the shell wrapper.
    activeProcess = spawn(prepareCommand(command), { shell: true, cwd: app.getPath('downloads'), detached: true });
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

// Pulls the last non-empty line out of a process's combined stdout+stderr —
// for a Python traceback this is usually the actual exception message
// (e.g. "ModuleNotFoundError: No module named 'numpy'"), which is far more
// useful in the UI than a bare exit code.
function lastLine(output) {
  const lines = (output || '').split('\n').map(l => l.trim()).filter(Boolean);
  return lines[lines.length - 1] || '(no output)';
}

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
      resolveTool('yt-dlp'),
      ['-x', '--audio-format', 'mp3', '--ffmpeg-location', resolveTool('ffmpeg'), '--print', 'after_move:filepath', '-o', path.join(tmpDir, '%(title)s.%(ext)s'), url],
      tmpDir, '⬇️ '
    );
    if (isCancelled) return { success: false, cancelled: true, message: 'Cancelled' };
    if (dl.error) return { success: false, message: `yt-dlp not found: ${dl.error.message}` };
    if (dl.code !== 0) return { success: false, message: `Download failed (exit ${dl.code}): ${lastLine(dl.stdout)}` };

    const lines = dl.stdout.split('\n').map(l => l.trim()).filter(Boolean);
    const audioFile = lines[lines.length - 1];
    if (!audioFile || !fs.existsSync(audioFile)) return { success: false, message: 'Could not locate downloaded audio file' };

    // Step 2: split vocals from instrumental with demucs.
    const sep = await runStep(
      resolveTool('demucs'), // not bundled yet — falls back to PATH
      ['--two-stems=vocals', '--mp3', '-o', path.join(tmpDir, 'separated'), audioFile],
      tmpDir, '🎤 '
    );
    if (isCancelled) return { success: false, cancelled: true, message: 'Cancelled' };
    if (sep.error) return { success: false, message: 'demucs not found — click "🔧 Update Tools" to install it' };
    if (sep.code !== 0) return { success: false, message: `Vocal separation failed (exit ${sep.code}): ${lastLine(sep.stdout)}` };

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
