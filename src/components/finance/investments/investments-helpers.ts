export function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return "Never"
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return "Just now"
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export function getSyncStatus(dateStr: string | null): { color: string; label: string } {
  if (!dateStr) return { color: "bg-gray-400", label: "Never synced" }
  const hours = (Date.now() - new Date(dateStr).getTime()) / 3600000
  if (hours < 6) return { color: "bg-success", label: "Recent" }
  if (hours < 48) return { color: "bg-warning", label: "Stale" }
  return { color: "bg-error", label: "Outdated" }
}
