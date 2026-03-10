import {
  BULK_ACTIONS,
  getClassificationBadgeStyle,
} from "@/components/portfolio/classify-helpers"

export function ClassifyBulkActions({
  selectedCount,
  isPending,
  onBulkClassify,
  onBulkClear,
  onDeselectAll,
}: {
  selectedCount: number
  isPending: boolean
  onBulkClassify: (classification: string) => void
  onBulkClear: () => void
  onDeselectAll: () => void
}) {
  if (selectedCount === 0) return null

  return (
    <div className="bg-card border border-primary/30 rounded-xl px-4 py-3 mb-4 flex flex-wrap items-center gap-3">
      <span className="text-sm text-foreground font-medium">{selectedCount} selected</span>
      <span className="text-foreground-muted text-sm">&mdash;</span>
      <span className="text-xs text-foreground-muted">Classify as:</span>
      {BULK_ACTIONS.map((action) => (
        <button
          key={action.value}
          onClick={() => onBulkClassify(action.value)}
          disabled={isPending}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors disabled:opacity-50 ${getClassificationBadgeStyle(action.value)} border-current/20 hover:opacity-80`}
        >
          {action.label}
        </button>
      ))}
      <button
        onClick={onBulkClear}
        disabled={isPending}
        className="px-3 py-1.5 rounded-lg text-xs font-medium border border-warning/30 text-warning hover:border-warning/60 transition-colors disabled:opacity-50"
      >
        Clear
      </button>
      <div className="flex-1" />
      <button
        onClick={onDeselectAll}
        className="text-xs text-foreground-muted hover:text-foreground transition-colors"
      >
        Deselect all
      </button>
    </div>
  )
}
