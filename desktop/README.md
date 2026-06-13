# PocketWatch Desktop (Tauri v2)

A lightweight Mac menu-bar + window shell around the PocketWatch web app, so you
get an ambient net-worth glance, native notifications, and a global hotkey
instead of having to remember to open the site.

It does **not** bundle a frontend — the window points at your already-running
PocketWatch server (`http://localhost:3500`), so the whole app shows through.

## What it does
- **Window** → loads `http://localhost:3500` (frameless, native traffic lights).
- **Menu-bar tray** → shows your net worth as the tray title, refreshed every 60s
  by polling `/api/internal/desktop-status` (Bearer `POCKETWATCH_DESKTOP_SECRET`).
- **Global hotkey** `Cmd+Shift+P` → show/hide the window from anywhere.
- **Launch at login** + single-instance.

## Prerequisites
```bash
# 1. Rust toolchain
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
# 2. Tauri CLI
cargo install tauri-cli --version "^2.0"
# 3. (macOS) Xcode command line tools
xcode-select --install
```

## Configure
The app reads two env vars at runtime:
```bash
export POCKETWATCH_DESKTOP_URL="http://localhost:3500"   # your running server
export POCKETWATCH_DESKTOP_SECRET="<32+ char secret>"    # same value you set in the server's .env
```
Set `POCKETWATCH_DESKTOP_SECRET` in BOTH the server `.env` and here. Generate with
`openssl rand -hex 32`.

## Run (development)
```bash
cd desktop/src-tauri
cargo tauri dev      # opens the window against your local server, hot-reloads the shell
```

## Build & install the Mac app
```bash
cd desktop/src-tauri
cargo tauri build
```
This produces, under `desktop/src-tauri/target/release/bundle/`:
- `macos/PocketWatch.app` — drag it into `/Applications`
- `dmg/PocketWatch_<version>_<arch>.dmg` — a double-click installer

**Install:** open the `.dmg` and drag **PocketWatch** to Applications (or just copy
the `.app`). Make sure your PocketWatch server is running first, then launch it.

**Architecture:** the build targets the machine you build on — Apple Silicon
(`aarch64`) or Intel (`x86_64`). Build on the matching Mac, or pass
`--target universal-apple-darwin` for a universal binary.

> **Gatekeeper note:** the build is **unsigned** (ad-hoc), so the first launch
> shows "PocketWatch can't be opened because Apple cannot check it for malware."
> Open **System Settings → Privacy & Security**, scroll down, and click **Open
> Anyway** (one-time). To remove this warning entirely you'd code-sign + notarize
> with an Apple Developer account.

## Notes
- The window points at a remote URL, so WebAuthn passkeys won't work inside the
  WKWebView — log in with your password (7-day session).
- Keep the server running (PM2/launchd) for the window to load; otherwise it
  shows a blank page until the server is up.
