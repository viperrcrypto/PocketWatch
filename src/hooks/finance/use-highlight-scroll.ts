import { useEffect, useRef } from "react"

// Cap how many 50-row pages a ?highlight deep-link will walk forward before
// giving up, so a deleted/excluded target can't page to the end of a huge list.
const HIGHLIGHT_MAX_PAGES = 20

interface HighlightData {
  transactions: { id: string }[]
  pagination: { totalPages: number }
}

/**
 * Scroll to a `?highlight=<txId>` deep-link target (from a subscription/bill).
 * The target may be older than the current page, so this walks forward (date
 * desc, 50/page) until it appears — bounded so a missing id can't loop forever.
 */
export function useHighlightScroll(
  highlightId: string,
  data: HighlightData | undefined,
  page: number,
  setPage: (updater: (p: number) => number) => void,
) {
  const done = useRef(false)
  useEffect(() => {
    if (!highlightId || !data?.transactions) return
    if (done.current) return

    const onPage = data.transactions.some((t) => t.id === highlightId)
    if (onPage) {
      done.current = true
      const el = document.getElementById(`tx-${highlightId}`)
      if (el) setTimeout(() => el.scrollIntoView({ behavior: "smooth", block: "center" }), 300)
      return
    }

    if (page < data.pagination.totalPages && page < HIGHLIGHT_MAX_PAGES) {
      setPage((p) => p + 1)
    } else {
      // Exhausted the bounded search — stop so the user can browse normally.
      done.current = true
    }
  }, [highlightId, data, page, setPage])
}
