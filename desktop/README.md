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

> ✅ The Rust **compiles cleanly** — verified with `cargo check` (exit 0). Two
> initial bugs were fixed (a missing `GlobalShortcutExt` import + the window-icon
> the build macro requires). The TS side (`/api/internal/desktop-status`) is also
> build-verified.
>
> To produce a real `.app`: install the CLI (`cargo install tauri-cli --version
> "^2"`), drop a square logo in and run `cargo tauri icon <logo.png>` to generate
> real icons (the committed `icons/icon.png` is a 32px placeholder), then set
> `bundle.active: true` in `tauri.conf.json` and run `cargo tauri build`.

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

## Run / build
```bash
cd desktop/src-tauri
cargo tauri dev      # run against your local server
cargo tauri build    # produce a .app / .dmg
```

## Notes
- The window points at a remote URL, so WebAuthn passkeys won't work inside the
  WKWebView — log in with your password (7-day session).
- Keep the server running (PM2/launchd) for the window to load; otherwise it
  shows a blank page until the server is up.
