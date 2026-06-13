/**
 * Trip cover imagery: a curated map of common destinations → a verified Unsplash
 * photo, with a deterministic warm-gradient fallback for everything else (and for
 * when the photo fails to load). Photos render as a plain <img> (CSP allows
 * img-src https:) over the gradient, so a failed load degrades gracefully.
 */

// [destination keyword (lowercase), Unsplash photo id] — all verified to resolve.
const CITY_PHOTOS: ReadonlyArray<readonly [string, string]> = [
  ["london", "photo-1513635269975-59663e0ac1ad"],
  ["paris", "photo-1502602898657-3e91760cbb34"],
  ["new york", "photo-1496442226666-8d4d0e62e6e9"],
  ["tokyo", "photo-1540959733332-eab4deabeeaf"],
  ["los angeles", "photo-1444723121867-7a241cacace9"],
  ["singapore", "photo-1525625293386-3f8f99389edd"],
  ["rome", "photo-1552832230-c0197dd311b5"],
  ["dubai", "photo-1512453979798-5ea266f8880c"],
  ["amsterdam", "photo-1534351590666-13e3e96b5017"],
  ["miami", "photo-1506966953602-c20cc11f75e3"],
  ["barcelona", "photo-1583422409516-2895a77efded"],
]

const GRADIENTS = [
  "linear-gradient(135deg, #f59e0b, #ef4444)",
  "linear-gradient(135deg, #3b82f6, #8b5cf6)",
  "linear-gradient(135deg, #10b981, #06b6d4)",
  "linear-gradient(135deg, #ec4899, #f97316)",
  "linear-gradient(135deg, #6366f1, #14b8a6)",
  "linear-gradient(135deg, #8b5cf6, #ec4899)",
]

function hash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

export interface DestinationCover {
  url: string | null
  gradient: string
}

/** Resolve a cover photo (if a known city) + a deterministic gradient fallback. */
export function destinationCover(destination?: string | null): DestinationCover {
  const key = (destination ?? "").toLowerCase().trim()
  const match = key ? CITY_PHOTOS.find(([city]) => key.includes(city)) : undefined
  const url = match
    ? `https://images.unsplash.com/${match[1]}?w=600&h=240&fit=crop&auto=format&q=70`
    : null
  const gradient = GRADIENTS[hash(key) % GRADIENTS.length]
  return { url, gradient }
}
