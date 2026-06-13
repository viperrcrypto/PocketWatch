/**
 * URL safety for UNTRUSTED provider responses (Skiplagged/Kiwi/Trivago MCP, etc.).
 *
 * Provider deep links + image URLs are rendered directly into `href`/`src` sinks
 * in the result cards. React renders `javascript:`/`data:` URLs verbatim (it only
 * warns), so a poisoned/compromised upstream MCP response could inject a
 * `javascript:` href that runs in the PocketWatch origin on one click — reading
 * the dashboard via the session cookie and mutating with the in-origin CSRF token.
 *
 * Allow ONLY absolute https:// (and protocol-relative, upgraded to https).
 * Everything else — javascript:, data:, vbscript:, http:, relative, garbage —
 * collapses to "" so the sink renders nothing.
 */
export function sanitizeExternalUrl(url: string | null | undefined): string {
  if (!url || typeof url !== "string") return ""
  const trimmed = url.trim()
  if (/^https:\/\//i.test(trimmed)) return trimmed
  if (/^\/\//.test(trimmed)) return `https:${trimmed}`
  return ""
}
