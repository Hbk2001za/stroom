# Stroom

Download YouTube videos, MP3s, Spotify tracks/playlists, and content from
hundreds of other sites — plus separate vocals from instrumentals — all
from one simple desktop app.

**Download the latest release:** https://github.com/Hbk2001za/stroom/releases/latest

---

## ⚖️ Responsible Use

Stroom is a tool — what you do with it is your responsibility. Before
downloading, converting, or editing anything, make sure you actually have
the rights or permission to do so (e.g. it's your own content, it's
licensed for personal use, or it's otherwise permitted where you live).
Copyright law varies by country and Stroom doesn't make that determination
for you.

Wherever possible, please support the artists and creators behind the
music and videos you enjoy — buy the track, stream it through a paid
service, back their Patreon, go to the show. Tools like this shouldn't be
a substitute for that.

---

## Installing on macOS

1. Download `Stroom-<version>-universal.dmg` from the [releases page](https://github.com/Hbk2001za/stroom/releases/latest) (works on both Intel and Apple Silicon Macs).
2. Open the `.dmg` and drag **Stroom** into the **Applications** folder.
3. **First launch — macOS will block the app.** This app isn't signed with an Apple Developer ID, so Gatekeeper shows a warning the first time. To open it anyway:
   - Go to **System Settings → Privacy & Security**, scroll down to the security section, and you'll see a message about Stroom being blocked. Click **Open Anyway**.
   - Then open Stroom again (from Launchpad or Applications) and confirm **Open**.
   - You only need to do this once — after the first successful launch, it opens normally.
4. **Folder access prompts.** The first time you download something, and again the first time you use "Choose Download Folder" or "Open Downloads Folder," macOS will ask for permission to access that folder. Click **Allow/OK** each time — this is normal macOS sandboxing, not a bug, and it won't ask again for the same folder once granted.

### Required tools (macOS)

None — `yt-dlp`, `ffmpeg`, and `spotdl` ship bundled inside the app, so
video/MP3/Spotify/Any-Site downloads all work immediately, no setup needed.

The only exception is **`demucs`**, used solely by the "Remove Vocals"
(Beta) feature, which still needs a one-time extra install since it
depends on PyTorch (too large to bundle).

**On Apple Silicon Macs:** open Stroom and click **"🔧 Update Tools"** at
the bottom — it installs `pipx` (if needed) and `demucs` for you,
including a fix for a real `pipx`-specific bug where `demucs` installs
without `numpy` and crashes (this button injects it automatically).

Prefer doing it yourself in Terminal instead?
```bash
brew install pipx        # skip if you already have pipx
pipx ensurepath
pipx install demucs
pipx inject demucs numpy --force
```
(`pip3 install demucs` will fail on modern Homebrew Python with an
`externally-managed-environment` error — that's expected, `pipx` is the
right tool here.)

#### 🚫 Remove Vocals is not available on Intel Macs

This is an upstream dead end, not a Stroom bug — two separate
dependencies `demucs` needs (PyTorch, and a Rust-based audio library)
have both dropped Intel Mac support, with no working combination left via
pip. The Remove Vocals card is disabled automatically on Intel Macs with
an explanation; every other feature (Video, MP3, Spotify, Any-Site) works
normally regardless of chip.

---

## Installing on Windows

1. Download `Stroom Setup <version>.exe` from the [releases page](https://github.com/Hbk2001za/stroom/releases/latest).
2. Run the installer. **Windows SmartScreen will flag it** since it isn't code-signed — click **More info**, then **Run anyway**.
3. Follow the setup wizard (you can choose the install location).

### Required tools (Windows)

None — `yt-dlp`, `ffmpeg`, and `spotdl` ship bundled inside the installer,
so video/MP3/Spotify/Any-Site downloads all work immediately, no setup
needed.

The only exception is **`demucs`**, used solely by the "Remove Vocals"
(Beta) feature, which still needs a one-time extra install since it
depends on PyTorch (too large to bundle).

**Easiest way:** open Stroom and click **"🔧 Update Tools"** at the
bottom — it installs `pipx` (if needed) and `demucs` for you, including a
fix for a real `pipx`-specific bug where `demucs` installs without `numpy`
and crashes (this button injects it automatically). Needs
[Python](https://www.python.org/downloads/) installed first (tick "Add
python.exe to PATH" during its install, then sign out/in or restart
before trying again).

Prefer doing it yourself in Command Prompt instead?
```
pip install --user pipx
pipx ensurepath
pipx install demucs
pipx inject demucs numpy --force
```

If Remove Vocals says it can't find demucs, that's what's missing.

A copy of these Windows instructions is also included with the installer:
after installing, look for `Windows Read Me First.txt` inside the app's
install folder (typically `C:\Program Files\Stroom\resources\`).

---

## Features

- 🎬 YouTube video downloads (choice of quality up to Best)
- 🎵 YouTube → MP3 (choice of bitrate)
- 🟢 Spotify track/playlist downloads
- 🌐 Any-site URL downloads (TikTok, Instagram, X, SoundCloud, Vimeo, and hundreds more via yt-dlp) — Beta
- 🎤 Remove Vocals — splits a song into an instrumental track and an isolated vocals track — Beta
- 📋 Batch downloads (paste multiple URLs at once)
- 📜 Download history (view, export, clear)
- ❤️ Support the project via BTC/BTC Lightning/ETH/SOL (Donate button in the app)
- 🌙 Dark mode
- 🔔 Checks for new versions on launch and offers a one-click download

## Updating

Stroom checks for a newer release on launch. If one's available, a banner
appears at the top with a **"Download & Install"** button — it downloads
the new installer and opens it for you automatically. You still need to
complete the last step yourself (drag the app into Applications on macOS,
or click through the installer on Windows) since Stroom isn't code-signed
and can't silently replace itself the way signed apps can.

## License

MIT

---

## ❤️ Support Stroom

If Stroom has been useful to you, consider chipping in — it genuinely
helps keep this project going. Thank you! 🙏

(You can also do this from inside the app via the **Donate** button, which
shows a QR code for each address.)

| Coin | Address |
|---|---|
| BTC | `bc1qtkh0ejsge4u7tyc0jyy98lvh87xdjhmy22v44v` |
| BTC Lightning | `bc1qqpy3hkrx53nne2f7vfkygjrgsndspcf4ptaunw` |
| ETH | `0x6f40624a25C570d77f4562F8d7b7E01497d27e9C` |
| SOL | `EMAFsQreyWNM4pLisJysefv9RauvR2jiCpKEDbTVkpcp` |
