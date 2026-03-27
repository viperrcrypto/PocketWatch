/**
 * Client-side CSRF token helper.
 * Reads the csrf_token cookie and returns it for use in fetch headers.
 */

export function getCsrfToken(): string | undefined {
  if (typeof document === "undefined") return undefined
  const match = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]+)/)
  return match?.[1]
}

/**
 * Returns headers object with the CSRF token included.
 * Drop-in for any fetch call that needs CSRF protection.
 */
export function csrfHeaders(extra?: HeadersInit): HeadersInit {
  const token = getCsrfToken()
  return {
    ...(token ? { "x-csrf-token": token } : {}),
    ...extra,
  }
}
