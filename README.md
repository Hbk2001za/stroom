# Stroom

Download YouTube videos, MP3s, Spotify tracks/playlists, and content from
hundreds of other sites — plus separate vocals from instrumentals — all
from one simple desktop app.

**Download the latest release:** https://github.com/Hbk2001za/stroom/releases/latest

---

## Installing on macOS

1. Download `Stroom-<version>-universal.dmg` from the [releases page](https://github.com/Hbk2001za/stroom/releases/latest) (works on both Intel and Apple Silicon Macs).
2. Open the `.dmg` and drag **Stroom** into the **Applications** folder.
3. **First launch — macOS will block the app.** This app isn't signed with an Apple Developer ID, so Gatekeeper shows a warning the first time. To open it anyway:
   - Go to **System Settings → Privacy & Security**, scroll down to the security section, and you'll see a message about Stroom being blocked. Click **Open Anyway**.
   - Then open Stroom again (from Launchpad or Applications) and confirm **Open**.
   - You only need to do this once — after the first successful launch, it opens normally.
4. **Folder access prompts.** The first time you download something, and again the first time you use "Choose Download Folder" or "Open Downloads Folder," macOS will ask for permission to access that folder. Click **Allow/OK** each time — this is normal macOS sandboxing, not a bug, and it won't ask again for the same folder once granted.

### Required command-line tools (macOS)

Stroom relies on a few well-known open-source command-line tools to actually do the downloading/converting. Install these once via [Homebrew](https://brew.sh):

```bash
brew install yt-dlp ffmpeg
pipx install spotdl
pip3 install -U demucs   # only needed for the "Remove Vocals" feature
```

If you don't have Homebrew or pipx yet:

```bash
# Homebrew
curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh | bash

# pipx
brew install pipx
pipx ensurepath
```

Stroom will use whichever `yt-dlp`, `ffmpeg`, `spotdl`, and `demucs` it finds on your system — no need to restart the app after installing them, just try the download again.

---

## Installing on Windows

1. Download `Stroom Setup <version>.exe` from the [releases page](https://github.com/Hbk2001za/stroom/releases/latest).
2. Run the installer. **Windows SmartScreen will flag it** since it isn't code-signed — click **More info**, then **Run anyway**.
3. Follow the setup wizard (you can choose the install location).

### Required command-line tools (Windows)

- [yt-dlp](https://github.com/yt-dlp/yt-dlp/releases) — download `yt-dlp.exe` and place it somewhere on your `PATH`
- [ffmpeg](https://www.gyan.dev/ffmpeg/builds/) — download a build and add its `bin` folder to your `PATH`
- `spotdl`: `pip install spotdl`
- `demucs` (optional, for vocal removal): `pip install -U demucs`

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
