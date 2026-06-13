// PocketWatch desktop shell (Tauri v2).
// Wraps the running web app at localhost:3500 with a menu-bar net-worth glance,
// a global show/hide hotkey, and launch-at-login.
//
// NOTE: written to the Tauri v2 API but not compiled in the authoring environment.
// Validate with `cargo tauri build`; a few API specifics may need adjustment.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::time::Duration;
use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    Emitter, Manager, WindowEvent,
};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};
use tauri_plugin_opener::OpenerExt;

const TRAY_ID: &str = "pw-tray";
const POLL_SECS: u64 = 60;

fn server_url() -> String {
    std::env::var("POCKETWATCH_DESKTOP_URL").unwrap_or_else(|_| "http://localhost:3500".into())
}

/// Poll /api/internal/desktop-status and return a formatted net-worth string.
async fn fetch_net_worth() -> Option<String> {
    let secret = std::env::var("POCKETWATCH_DESKTOP_SECRET").ok()?;
    let url = format!("{}/api/internal/desktop-status", server_url());
    let client = reqwest::Client::new();
    let resp = client
        .get(&url)
        .bearer_auth(secret)
        .timeout(Duration::from_secs(10))
        .send()
        .await
        .ok()?;
    if !resp.status().is_success() {
        return None;
    }
    let json: serde_json::Value = resp.json().await.ok()?;
    let nw = json.get("netWorth")?.as_f64()?;
    Some(format!("${}", thousands(nw)))
}

/// 598484.02 -> "598,484" (menu-bar friendly, no decimals).
fn thousands(value: f64) -> String {
    let digits = format!("{:.0}", value.abs());
    let mut out = String::with_capacity(digits.len() + digits.len() / 3);
    for (i, ch) in digits.chars().enumerate() {
        if i > 0 && (digits.len() - i) % 3 == 0 {
            out.push(',');
        }
        out.push(ch);
    }
    if value < 0.0 { format!("-{}", out) } else { out }
}

/// Toggle the main window between shown+focused and hidden.
fn toggle_main(app: &tauri::AppHandle) {
    if let Some(win) = app.get_webview_window("main") {
        match win.is_visible() {
            Ok(true) => {
                let _ = win.hide();
            }
            _ => {
                let _ = win.show();
                let _ = win.set_focus();
            }
        }
    }
}

fn main() {
    let summon = Shortcut::new(Some(Modifiers::SUPER | Modifiers::SHIFT), Code::KeyP);

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        // Open external destinations (booking links, OAuth sign-in pages) in the
        // SYSTEM BROWSER instead of hijacking the app webview. Without this, an
        // external link silently no-ops and an OAuth redirect strands the window
        // on a third-party page with no way back.
        .plugin(
            tauri::plugin::Builder::<_, ()>::new("external-links")
                .on_navigation(|window, url| {
                    let host = url.host_str().unwrap_or("");
                    let is_external = matches!(url.scheme(), "http" | "https")
                        && host != "localhost"
                        && host != "127.0.0.1";
                    if is_external {
                        let _ = window
                            .app_handle()
                            .opener()
                            .open_url(url.as_str(), None::<&str>);
                        return false; // cancel in-webview navigation
                    }
                    true
                })
                .build(),
        )
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            toggle_main(app);
        }))
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(move |app, shortcut, event| {
                    if event.state == ShortcutState::Pressed && shortcut == &summon {
                        toggle_main(app);
                    }
                })
                .build(),
        )
        .setup(move |app| {
            // Register the global summon hotkey (Cmd+Shift+P).
            app.global_shortcut().register(summon)?;

            // Menu-bar tray; the title is updated by the poller below.
            let quit = MenuItem::with_id(app, "quit", "Quit PocketWatch", true, None::<&str>)?;
            let show = MenuItem::with_id(app, "show", "Open PocketWatch", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show, &quit])?;
            TrayIconBuilder::with_id(TRAY_ID)
                .icon(app.default_window_icon().cloned().expect("app icon"))
                .icon_as_template(false)
                .title("PocketWatch")
                .tooltip("PocketWatch")
                .menu(&menu)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "quit" => app.exit(0),
                    "show" => toggle_main(app),
                    _ => {}
                })
                .build(app)?;

            // Background poller: refresh the tray net-worth title every POLL_SECS.
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                loop {
                    if let Some(title) = fetch_net_worth().await {
                        if let Some(tray) = handle.tray_by_id(TRAY_ID) {
                            let _ = tray.set_title(Some(title));
                        }
                    }
                    let _ = handle.emit("desktop-status-refreshed", ());
                    tokio::time::sleep(Duration::from_secs(POLL_SECS)).await;
                }
            });

            Ok(())
        })
        .on_window_event(|window, event| {
            // Close-to-tray: hide instead of quitting so the app stays in the menu bar.
            if let WindowEvent::CloseRequested { api, .. } = event {
                let _ = window.hide();
                api.prevent_close();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running PocketWatch desktop");
}
