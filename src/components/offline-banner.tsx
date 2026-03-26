"use client"

import { useOnlineStatus } from "@/hooks/use-online-status"

export function OfflineBanner() {
  const isOnline = useOnlineStatus()

  if (isOnline) return null

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[9999] flex items-center justify-center gap-2 py-2 px-4 text-xs font-medium"
      style={{
        background: "var(--destructive)",
        color: "#fff",
        paddingTop: "calc(env(safe-area-inset-top) + 8px)",
      }}
    >
      <span
        className="material-symbols-rounded"
        style={{ fontSize: 16 }}
        aria-hidden="true"
      >
        cloud_off
      </span>
      <span>You're offline — showing cached data</span>
    </div>
  )
}
