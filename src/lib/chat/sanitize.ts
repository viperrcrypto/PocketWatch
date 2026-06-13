/**
 * Untrusted-text sanitizers for PocketLLM tool results.
 *
 * Provider-sourced fields (airline/hotel names, booking URLs, descriptions) are
 * external data serialized into LLM tool results. Strip control chars + newlines
 * and cap length so a hostile provider string can't inject prompt structure or
 * instructions. Neutralizes strings without changing the surrounding shape.
 *
 * For href/src sinks rendered in the UI, use sanitizeExternalUrl from
 * @/lib/travel/url-safety (https-only) instead of cleanUrl.
 */

export const MAX_TEXT_LENGTH = 200
const MAX_URL_LENGTH = 500

export function cleanText(value: string, maxLength: number = MAX_TEXT_LENGTH): string {
  return value
    // control chars (\n \r \t), Unicode format chars (zero-width, RTL-override
    // U+202E), and line/paragraph separators — all prompt-spoofing vectors.
    .replace(/[\p{Cc}\p{Cf}\u2028\u2029]/gu, " ")
    .replace(/\s{2,}/g, " ")
    .trim()
    .slice(0, maxLength)
}

// URLs must not be sliced (truncation makes a broken link); drop anything that is
// not a sane-length absolute http(s) URL instead.
export function cleanUrl(value: string | null | undefined): string {
  if (!value || typeof value !== "string") return ""
  const trimmed = value.trim()
  if (trimmed.length > MAX_URL_LENGTH || !/^https?:\/\//i.test(trimmed)) return ""
  return trimmed
}

export function cleanTextOrNull(value: string | null | undefined): string | null {
  return value == null ? null : cleanText(value)
}

export function cleanList(values: readonly string[]): string[] {
  return values.map((v) => cleanText(v))
}
