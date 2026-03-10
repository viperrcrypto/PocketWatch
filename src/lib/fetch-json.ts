/**
 * Shared fetch-and-parse-JSON utility for client-side hooks.
 * Validates response status and JSON parsing with clear error messages.
 */
export async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: "include" })
  if (!res.ok) throw new Error(`Failed to fetch ${url}`)

  const text = await res.text()
  if (!text) throw new Error(`Empty response from ${url}`)

  try {
    return JSON.parse(text)
  } catch {
    throw new Error(`Invalid JSON response from ${url}`)
  }
}
