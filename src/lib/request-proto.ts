/**
 * Whether the ORIGINAL request arrived over https.
 *
 * Cookie `secure` flags must track the real transport, not NODE_ENV: under
 * `next start` (production) the app is reached BOTH ways —
 *   - https via the Cloudflare tunnel (which sets x-forwarded-proto: https)
 *   - plain http://localhost:3500 (browser dev + the Tauri desktop app)
 * WebKit (the desktop app's WKWebView) refuses to store Secure cookies over
 * plain http — unlike Chrome it does not exempt localhost — so a
 * NODE_ENV-based Secure flag silently breaks login in the desktop app.
 *
 * Spoofing note: a direct-to-localhost client could send x-forwarded-proto
 * itself, but forging "https" only ADDS the Secure flag (self-defeating), and
 * over the tunnel Cloudflare overwrites the header — so this can't be used to
 * strip Secure from tunnel traffic.
 */

import { headers } from "next/headers"

export async function isSecureRequest(): Promise<boolean> {
  const h = await headers()
  const proto = (h.get("x-forwarded-proto") ?? "").split(",")[0]!.trim()
  return proto === "https"
}
