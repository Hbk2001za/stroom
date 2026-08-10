#!/usr/bin/env node
// Fetches standalone yt-dlp/ffmpeg/spotdl binaries into build/bin/<platform>/
// so Stroom works out of the box with zero manual setup, instead of relying
// on Homebrew/pip/PATH. Runs automatically before packaging (see the
// "prebuild:mac" / "prebuild:win" npm scripts) and is safe to re-run — it
// skips any binary that's already present.
//
// Usage: node scripts/fetch-tools.js [mac|win]

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const platform = process.argv[2] || (process.platform === 'win32' ? 'win' : 'mac');
const outDir = path.join(__dirname, '..', 'build', 'bin', platform);
fs.mkdirSync(outDir, { recursive: true });

async function download(url, dest) {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`GET ${url} -> HTTP ${res.status}`);
  fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
}

async function latestGithubAsset(repo, matches) {
  const res = await fetch(`https://api.github.com/repos/${repo}/releases/latest`);
  if (!res.ok) throw new Error(`GET releases/latest for ${repo} -> HTTP ${res.status}`);
  const data = await res.json();
  const asset = data.assets.find(a => matches(a.name));
  if (!asset) throw new Error(`No matching asset found for ${repo} (looked at: ${data.assets.map(a => a.name).join(', ')})`);
  return asset.browser_download_url;
}

async function fetchIfMissing(dest, label, getUrl) {
  if (fs.existsSync(dest)) { console.log(`✓ ${label} already present, skipping`); return; }
  console.log(`⬇ Fetching ${label}...`);
  await download(await getUrl(), dest);
}

async function extractZipEntry(zipUrl, entryGlobHint, destFile) {
  const zipPath = destFile + '.zip';
  await download(zipUrl, zipPath);
  const extractDir = destFile + '_extract';
  fs.mkdirSync(extractDir, { recursive: true });
  if (process.platform === 'win32') {
    execSync(`powershell -NoProfile -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${extractDir}' -Force"`);
  } else {
    execSync(`unzip -o -q "${zipPath}" -d "${extractDir}"`);
  }
  const found = execSync(
    process.platform === 'win32'
      ? `powershell -NoProfile -Command "(Get-ChildItem -Path '${extractDir}' -Recurse -Filter '${entryGlobHint}').FullName"`
      : `find "${extractDir}" -iname "${entryGlobHint}" | head -1`
  ).toString().trim().split('\n')[0];
  if (!found) throw new Error(`Couldn't find ${entryGlobHint} inside ${zipUrl}`);
  fs.copyFileSync(found, destFile);
  fs.rmSync(zipPath, { force: true });
  fs.rmSync(extractDir, { recursive: true, force: true });
}

async function main() {
  if (platform === 'mac') {
    await fetchIfMissing(path.join(outDir, 'yt-dlp'), 'yt-dlp (macOS)',
      async () => 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos');
    await fetchIfMissing(path.join(outDir, 'spotdl'), 'spotdl (macOS)',
      () => latestGithubAsset('spotDL/spotify-downloader', n => n.includes('darwin')));
    // ffmpeg ships as a zip, not a bare binary, so it needs the extract path
    const ffmpegDest = path.join(outDir, 'ffmpeg');
    if (!fs.existsSync(ffmpegDest)) {
      console.log('⬇ Fetching ffmpeg (macOS)...');
      const info = await (await fetch('https://evermeet.cx/ffmpeg/info/ffmpeg/release')).json();
      await extractZipEntry(info.download.zip.url, 'ffmpeg', ffmpegDest);
    } else {
      console.log('✓ ffmpeg (macOS) already present, skipping');
    }
    for (const f of ['yt-dlp', 'ffmpeg', 'spotdl']) fs.chmodSync(path.join(outDir, f), 0o755);
  } else {
    await fetchIfMissing(path.join(outDir, 'yt-dlp.exe'), 'yt-dlp (Windows)',
      async () => 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe');
    await fetchIfMissing(path.join(outDir, 'spotdl.exe'), 'spotdl (Windows)',
      () => latestGithubAsset('spotDL/spotify-downloader', n => n.endsWith('win32.exe')));
    const ffmpegDest = path.join(outDir, 'ffmpeg.exe');
    if (!fs.existsSync(ffmpegDest)) {
      console.log('⬇ Fetching ffmpeg (Windows)...');
      await extractZipEntry('https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip', 'ffmpeg.exe', ffmpegDest);
    } else {
      console.log('✓ ffmpeg (Windows) already present, skipping');
    }
  }
  console.log(`Tools ready in ${outDir}`);
}

main().catch(err => { console.error('fetch-tools failed:', err.message); process.exit(1); });
