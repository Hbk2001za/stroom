// ============ STATE ============
let history = [];
let currentDownloadId = null;
let downloadPath = '';

// ============ INIT DOWNLOAD PATH ============
async function initDownloadPath() {
  const saved = localStorage.getItem('stroom-download-path');
  if (saved) {
    downloadPath = saved;
  } else {
    downloadPath = await window.api.getDefaultDownloadPath();
  }
}

// ============ COMMANDS ============
const qualityMap = {
  best: 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
  1080: 'bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/best[height<=1080][ext=mp4]/best[height<=1080]',
  720: 'bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/best[height<=720][ext=mp4]/best[height<=720]',
  480: 'bestvideo[height<=480][ext=mp4]+bestaudio[ext=m4a]/best[height<=480][ext=mp4]/best[height<=480]',
  360: 'bestvideo[height<=360][ext=mp4]+bestaudio[ext=m4a]/best[height<=360][ext=mp4]/best[height<=360]'
};

const bitrateMap = {
  320: '320k',
  256: '256k',
  192: '192k',
  128: '128k'
};

const batchQualityMap = {
  best: { video: 'best', mp3: '320', spotify: '320' },
  1080: { video: '1080', mp3: '256', spotify: '256' },
  720: { video: '720', mp3: '192', spotify: '192' },
  480: { video: '480', mp3: '128', spotify: '128' }
};

function buildCommand(type, url, quality) {
  const outDir = downloadPath || '~/Downloads';
  switch(type) {
    case 'video':
      const fmt = qualityMap[quality] || qualityMap.best;
      return `yt-dlp -f "${fmt}" -o "${outDir}/%(title)s.%(ext)s" "${url}"`;
    case 'mp3':
      const br = bitrateMap[quality] || '320k';
      return `yt-dlp -x --audio-format mp3 --audio-quality ${br} -o "${outDir}/%(title)s.mp3" "${url}"`;
    case 'spotify-public':
      const sbr = bitrateMap[quality] || '320k';
      return `spotdl download "${url}" --bitrate ${sbr} --output "${outDir}"`;
    case 'generic':
      if (quality === 'audio') {
        return `yt-dlp -x --audio-format mp3 --audio-quality 0 -o "${outDir}/%(title)s.%(ext)s" "${url}"`;
      }
      return `yt-dlp -o "${outDir}/%(title)s.%(ext)s" "${url}"`;
    default:
      return `yt-dlp -x --audio-format mp3 -o "${outDir}/%(title)s.mp3" "${url}"`;
  }
}

// ============ DARK MODE ============
function toggleDark() {
  document.body.classList.toggle('dark');
  const btn = document.querySelector('.dark-toggle');
  btn.textContent = document.body.classList.contains('dark') ? '☀️' : '🌙';
  localStorage.setItem('stroom-dark', document.body.classList.contains('dark'));
}

if (localStorage.getItem('stroom-dark') === 'true') {
  document.body.classList.add('dark');
  document.querySelector('.dark-toggle').textContent = '☀️';
}

// ============ TABS ============
function switchTab(name) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  const tabs = document.querySelectorAll('.tab');
  if (name === 'single') {
    tabs[0].classList.add('active');
    document.getElementById('tab-single').classList.add('active');
  } else {
    tabs[1].classList.add('active');
    document.getElementById('tab-batch').classList.add('active');
  }
}

// ============ DRAG & DROP ============
const dropZone = document.getElementById('drop-zone');
dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('drag-over'); });
dropZone.addEventListener('dragleave', () => { dropZone.classList.remove('drag-over'); });
dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  const text = e.dataTransfer.getData('text/plain');
  if (text) {
    const urls = text.split('\n').map(u => u.trim()).filter(u => u.startsWith('http'));
    if (urls.length === 1) { document.getElementById('yt-video').value = urls[0]; switchTab('single'); }
    else if (urls.length > 1) { document.getElementById('batch-urls').value = urls.join('\n'); switchTab('batch'); }
  }
});

document.addEventListener('paste', (e) => {
  const text = (e.clipboardData || window.clipboardData).getData('text/plain');
  if (text && text.includes('http') && document.activeElement === document.body) {
    const urls = text.split('\n').map(u => u.trim()).filter(u => u.startsWith('http'));
    if (urls.length === 1) { document.getElementById('yt-video').value = urls[0]; switchTab('single'); }
    else if (urls.length > 1) { document.getElementById('batch-urls').value = urls.join('\n'); switchTab('batch'); }
  }
});

// ============ UI HELPERS ============
function setDownloadingUI(inputId, isDownloading) {
  if (isDownloading) {
    document.querySelectorAll('button[id^="btn-"]').forEach(b => b.disabled = true);
    document.querySelectorAll('button[id^="cancel-"]').forEach(b => b.style.display = 'none');
    const button = document.getElementById(`btn-${inputId}`);
    const cancelBtn = document.getElementById(`cancel-${inputId}`);
    if (button) button.style.display = 'none';
    if (cancelBtn) { cancelBtn.style.display = 'inline-block'; cancelBtn.disabled = false; }
  } else {
    document.querySelectorAll('button[id^="btn-"]').forEach(b => { b.disabled = false; b.style.display = 'inline-block'; });
    document.querySelectorAll('button[id^="cancel-"]').forEach(b => b.style.display = 'none');
  }
}

function updateProgress(id, percent, text) {
  const container = document.getElementById(`progress-${id}`);
  const fill = document.getElementById(`fill-${id}`);
  const txt = document.getElementById(`progress-text-${id}`);
  if (container) container.style.display = 'block';
  if (fill) fill.style.width = `${Math.min(100, Math.max(0, percent))}%`;
  if (txt) txt.textContent = text || `${Math.round(percent)}%`;
}

function resetProgress(id) {
  const container = document.getElementById(`progress-${id}`);
  if (container) container.style.display = 'none';
  const fill = document.getElementById(`fill-${id}`);
  if (fill) fill.style.width = '0%';
  const txt = document.getElementById(`progress-text-${id}`);
  if (txt) txt.textContent = '';
}

// ============ DOWNLOAD SINGLE ============
async function download(inputId, type) {
  if (currentDownloadId) { alert('A download is already in progress. Please stop it first.'); return; }

  const input = document.getElementById(inputId);
  const statusEl = document.getElementById(`status-${inputId}`);
  const url = input.value.trim();

  if (!url) { statusEl.textContent = 'Please paste a URL'; statusEl.className = 'status error'; return; }
  if (type.startsWith('spotify') && !url.includes('spotify.com/')) { statusEl.textContent = 'Please paste a valid Spotify URL'; statusEl.className = 'status error'; return; }
  if ((type === 'video' || type === 'mp3') && !url.includes('youtube.com/') && !url.includes('youtu.be/')) { statusEl.textContent = 'Please paste a valid YouTube URL'; statusEl.className = 'status error'; return; }
  if (type === 'generic' && !url.startsWith('http')) { statusEl.textContent = 'Please paste a valid URL'; statusEl.className = 'status error'; return; }
  if (type === 'remove-vocals' && !url.startsWith('http')) { statusEl.textContent = 'Please paste a valid URL'; statusEl.className = 'status error'; return; }

  currentDownloadId = inputId;
  setDownloadingUI(inputId, true);
  statusEl.textContent = type === 'remove-vocals' ? '⏳ Downloading & removing vocals...' : '⏳ Downloading...';
  statusEl.className = 'status';
  resetProgress(inputId);
  updateProgress(inputId, 5, 'Starting...');

  try {
    const qualityEl = document.getElementById(`quality-${inputId}`);
    const quality = qualityEl ? qualityEl.value : null;
    const onProgress = (data) => { if (data.progress !== undefined) updateProgress(inputId, data.progress, data.text); };

    // Vocal removal is a two-step pipeline (download, then demucs separation),
    // not a single shell command, so it has its own IPC call.
    const result = type === 'remove-vocals'
      ? await window.api.removeVocals(url, downloadPath, onProgress)
      : await window.api.runCommand(buildCommand(type, url, quality), onProgress);

    if (result.success) {
      statusEl.textContent = type === 'remove-vocals' ? `✅ ${result.message}` : '✅ Done! Check your Downloads folder';
      statusEl.className = 'status success';
      updateProgress(inputId, 100, 'Complete!');
      addToHistory(url, type, quality);
      input.value = '';
    } else if (result.cancelled) {
      statusEl.textContent = '⏹ Cancelled';
      statusEl.className = 'status';
    } else {
      statusEl.textContent = `❌ Error: ${result.message}`;
      statusEl.className = 'status error';
    }
  } catch (err) {
    statusEl.textContent = '⏹ Cancelled';
    statusEl.className = 'status';
  }

  setDownloadingUI(inputId, false);
  currentDownloadId = null;
  setTimeout(() => resetProgress(inputId), 3000);
}

// ============ BATCH DOWNLOAD ============
async function downloadBatch() {
  if (currentDownloadId) { alert('A download is already in progress. Please stop it first.'); return; }

  const textarea = document.getElementById('batch-urls');
  const type = document.getElementById('batch-type').value;
  const batchQuality = document.getElementById('quality-batch').value;
  const statusEl = document.getElementById('status-batch');
  const urls = textarea.value.split('\n').map(u => u.trim()).filter(u => u.startsWith('http'));

  if (urls.length === 0) { statusEl.textContent = 'Please paste at least one URL'; statusEl.className = 'status error'; return; }

  const hasYoutube = urls.some(u => u.includes('youtube.com') || u.includes('youtu.be'));
  const hasSpotify = urls.some(u => u.includes('spotify.com'));
  
  if (hasYoutube && hasSpotify) {
    statusEl.textContent = '❌ Please don\'t mix YouTube and Spotify URLs. Use separate batches.';
    statusEl.className = 'status error';
    return;
  }

  const qMap = batchQualityMap[batchQuality] || batchQualityMap.best;
  let quality = qMap.video;
  if (type === 'mp3') quality = qMap.mp3;
  else if (type.startsWith('spotify')) quality = qMap.spotify;

  currentDownloadId = 'batch';
  setDownloadingUI('batch', true);
  resetProgress('batch');
  updateProgress('batch', 0, `0 / ${urls.length}`);

  let completed = 0;
  let failed = 0;
  let cancelled = false;

  for (let i = 0; i < urls.length; i++) {
    if (cancelled) break;
    const url = urls[i];
    statusEl.textContent = `⏳ Downloading ${i + 1} of ${urls.length}...`;
    statusEl.className = 'status';

    try {
      const command = buildCommand(type, url, quality);
      const result = await window.api.runCommand(command, (data) => {
        if (data.progress !== undefined) {
          const overall = ((i + data.progress / 100) / urls.length) * 100;
          updateProgress('batch', overall, `${i + 1}/${urls.length} — ${data.text || ''}`);
        }
      });

      if (result.success) { completed++; addToHistory(url, type, quality); }
      else if (result.cancelled) { cancelled = true; }
      else { failed++; }
    } catch (err) { cancelled = true; }
  }

  if (cancelled) statusEl.textContent = `⏹ Cancelled (${completed} done)`;
  else if (failed > 0) statusEl.textContent = `✅ ${completed} done, ❌ ${failed} failed`;
  else statusEl.textContent = `✅ All ${completed} downloads complete!`;
  statusEl.className = cancelled ? 'status' : (failed > 0 ? 'status error' : 'status success');

  setDownloadingUI('batch', false);
  currentDownloadId = null;
  setTimeout(() => resetProgress('batch'), 3000);
}

// ============ CANCEL ============
async function cancelDownload(inputId) {
  const statusEl = document.getElementById(`status-${inputId}`);
  if (statusEl) statusEl.textContent = '⏹ Stopping...';
  await window.api.cancelCommand();
}

// ============ FOLDER BUTTONS ============
async function chooseDownloadFolder() {
  const path = await window.api.chooseDownloadFolder();
  if (path) {
    downloadPath = path;
    localStorage.setItem('stroom-download-path', path);
    const folderDisplay = document.getElementById('current-folder-display');
    if (folderDisplay) folderDisplay.textContent = `Download folder: ${path}`;
  }
}

async function openDownloadsFolder() {
  await window.api.openFolder(downloadPath);
}

// ============ HISTORY ============
function loadHistory() {
  try { history = JSON.parse(localStorage.getItem('stroom-history') || '[]'); }
  catch(e) { history = []; }
  renderHistory();
}

function addToHistory(url, type, quality) {
  const typeLabels = { video: '🎬 Video', mp3: '🎵 MP3', 'spotify-public': '🟢 Spotify', generic: '🌐 Any Site', 'remove-vocals': '🎤 Vocals Removed' };
  const qualLabels = { best: 'Best', 1080: '1080p', 720: '720p', 480: '480p', 360: '360p',
                       320: '320kbps', 256: '256kbps', 192: '192kbps', 128: '128kbps',
                       video: 'Video', audio: 'MP3' };
  history.unshift({
    url,
    type: typeLabels[type] || type,
    quality: qualLabels[quality] || quality || '',
    time: new Date().toLocaleString()
  });
  if (history.length > 100) history = history.slice(0, 100);
  localStorage.setItem('stroom-history', JSON.stringify(history));
  renderHistory();
}

function renderHistory() {
  const list = document.getElementById('history-list');
  if (!list) return; // inline list was removed; history now lives only in the "View All" modal
  const recent = history.slice(0, 3);
  if (recent.length === 0) {
    list.innerHTML = '<div style="color:var(--label);font-size:12px;text-align:center;padding:10px;">No downloads yet</div>';
    return;
  }
  list.innerHTML = recent.map(h => `
    <div class="history-item">
      <span class="name">${h.type}${h.quality ? ' [' + h.quality + ']' : ''} — ${h.url.substring(0, 50)}...</span>
      <span class="time">${h.time}</span>
    </div>
  `).join('');
}

function viewHistory() {
  const modal = document.getElementById('history-modal');
  const fullList = document.getElementById('history-full-list');
  
  if (history.length === 0) {
    fullList.innerHTML = '<div style="text-align:center;color:var(--label);padding:20px;">No downloads yet</div>';
  } else {
    fullList.innerHTML = history.map(h => `
      <div class="history-item">
        <span class="name">${h.type}${h.quality ? ' [' + h.quality + ']' : ''} — ${h.url.substring(0, 70)}...</span>
        <span class="time">${h.time}</span>
      </div>
    `).join('');
  }
  
  modal.style.display = 'flex';
}

function closeHistory() {
  document.getElementById('history-modal').style.display = 'none';
}

function downloadHistory() {
  if (history.length === 0) { alert('No history to export'); return; }
  
  let txt = 'Stroom Download History\n';
  txt += '='.repeat(50) + '\n\n';
  history.forEach((h, i) => {
    txt += `${i + 1}. ${h.type}${h.quality ? ' [' + h.quality + ']' : ''}\n`;
    txt += `   URL: ${h.url}\n`;
    txt += `   Date: ${h.time}\n\n`;
  });

  const blob = new Blob([txt], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `stroom-history-${new Date().toISOString().split('T')[0]}.txt`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function clearHistory() {
  if (confirm('Clear all download history?')) {
    history = [];
    localStorage.removeItem('stroom-history');
    renderHistory();
  }
}

// ============ DONATE ============
const DONATE_ADDRESSES = [
  { label: 'BTC', address: 'bc1qtkh0ejsge4u7tyc0jyy98lvh87xdjhmy22v44v', badgeClass: 'coin-btc', badgeText: '₿' },
  { label: 'BTC Lightning', address: 'bc1qqpy3hkrx53nne2f7vfkygjrgsndspcf4ptaunw', badgeClass: 'coin-btcln', badgeText: '⚡' },
  { label: 'ETH', address: '0x6f40624a25C570d77f4562F8d7b7E01497d27e9C', badgeClass: 'coin-eth', badgeText: 'Ξ' },
  { label: 'SOL', address: 'EMAFsQreyWNM4pLisJysefv9RauvR2jiCpKEDbTVkpcp', badgeClass: 'coin-sol', badgeText: 'SOL' }
];

function openDonate() {
  const list = document.getElementById('donate-list');
  list.innerHTML = DONATE_ADDRESSES.map((a, i) => `
    <div class="donate-item">
      <div class="qr-box" id="qr-${i}"></div>
      <div class="donate-info">
        <div class="coin-label">${a.label}</div>
        <button class="coin-address" onclick="copyAddress('${a.address}', this)" title="Click to copy">${a.address}</button>
      </div>
      <button class="copy-btn" onclick="copyAddress('${a.address}', this)">📋 Copy</button>
    </div>
  `).join('');

  // High error-correction level so the center logo badge doesn't break scanning
  DONATE_ADDRESSES.forEach((a, i) => {
    const box = document.getElementById(`qr-${i}`);
    new QRCode(box, {
      text: a.address, width: 68, height: 68,
      colorDark: '#000000', colorLight: '#ffffff',
      correctLevel: QRCode.CorrectLevel.H
    });
    // QRCode() clears the element's contents, so the logo badge has to be
    // re-appended after generation rather than rendered alongside it.
    const badge = document.createElement('div');
    badge.className = `qr-logo ${a.badgeClass}`;
    badge.textContent = a.badgeText;
    box.appendChild(badge);
  });

  document.getElementById('donate-modal').style.display = 'flex';
}

function closeDonate() {
  document.getElementById('donate-modal').style.display = 'none';
}

async function copyAddress(address, btn) {
  try {
    await navigator.clipboard.writeText(address);
  } catch (e) {
    if (window.api?.copyText) await window.api.copyText(address);
  }
  const original = btn.textContent;
  btn.textContent = '✅ Copied!';
  btn.disabled = true;
  setTimeout(() => { btn.textContent = original; btn.disabled = false; }, 1500);
}

// ============ UPDATE TOOLS (sets up demucs for Remove Vocals) ============
async function runUpdateTools() {
  const btn = document.getElementById('update-tools-btn');
  const original = btn.textContent;
  btn.disabled = true;
  btn.textContent = '⏳ Setting up...';
  const result = await window.api.updateTools();
  alert('✅ Setup report:\n\n' + result);
  btn.disabled = false;
  btn.textContent = original;
}

document.getElementById('update-tools-btn')?.addEventListener('click', runUpdateTools);

// ============ WELCOME / FIRST-RUN ============
function closeWelcome() {
  document.getElementById('welcome-modal').style.display = 'none';
  localStorage.setItem('stroom-welcomed', 'true');
}

function setupFromWelcome() {
  closeWelcome();
  runUpdateTools();
}

// ============ UPDATE CHECK ============
let pendingUpdate = null;

function dismissUpdateBanner() {
  document.getElementById('update-banner').style.display = 'none';
  if (pendingUpdate) sessionStorage.setItem('stroom-dismissed-update', pendingUpdate.latestVersion);
}

async function downloadUpdateNow() {
  if (!pendingUpdate) return;
  const btn = document.getElementById('update-banner-btn');
  const original = btn.textContent;
  btn.disabled = true;

  const result = await window.api.downloadUpdate(
    { downloadUrl: pendingUpdate.downloadUrl, assetName: pendingUpdate.assetName },
    (data) => { if (data.progress !== undefined) btn.textContent = `Downloading... ${data.progress}%`; }
  );

  if (result.success) {
    btn.textContent = 'Opening installer...';
    setTimeout(() => { document.getElementById('update-banner').style.display = 'none'; }, 2000);
  } else {
    alert('❌ Update download failed: ' + result.message);
    btn.disabled = false;
    btn.textContent = original;
  }
}

async function checkForUpdatesOnInit() {
  try {
    const info = await window.api.checkForUpdates();
    if (!info?.hasUpdate) return;
    if (sessionStorage.getItem('stroom-dismissed-update') === info.latestVersion) return; // already dismissed this session

    pendingUpdate = info;
    document.getElementById('update-banner-text').textContent =
      `🎉 Stroom ${info.latestVersion} is available (you have ${info.currentVersion})`;
    document.getElementById('update-banner').style.display = 'flex';
  } catch (e) { /* offline or GitHub unreachable — fail silently, not worth bothering the user */ }
}

// ============ INIT ============
async function initApp() {
  await initDownloadPath();
  const folderDisplay = document.getElementById('current-folder-display');
  if (folderDisplay) folderDisplay.textContent = `Download folder: ${downloadPath}`;
  loadHistory();
  checkForUpdatesOnInit();

  if (!localStorage.getItem('stroom-welcomed')) {
    document.getElementById('welcome-modal').style.display = 'flex';
  }
}

initApp();
