import { formatCurrency } from "@/lib/utils"

export function WorkshopFooter({
  buffer,
  isSaving,
  hasChanges,
  onFinalize,
}: {
  buffer: number
  isSaving: boolean
  hasChanges: boolean
  onFinalize: () => void
}) {
  return (
    <>
      {/* Unallocated Funds Footer */}
      <div className="p-6 rounded-2xl bg-primary/5 border border-primary/10 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0">
            <span className="material-symbols-rounded text-primary" style={{ fontSize: 24 }}>info</span>
          </div>
          <div>
            <p className="text-foreground font-semibold">
              Unallocated Funds: {formatCurrency(Math.max(buffer, 0))}
            </p>
            <p className="text-foreground-muted text-xs">
              {buffer >= 0
                ? "This remains in your primary savings account by default."
                : `You've over-allocated by ${formatCurrency(Math.abs(buffer))}. Consider reducing some budgets.`}
            </p>
          </div>
        </div>
        <button
          onClick={onFinalize}
          disabled={isSaving || !hasChanges}
          className="w-full md:w-auto px-8 py-3 bg-primary text-white font-bold rounded-xl hover:bg-primary-hover transition-all disabled:opacity-50"
        >
          {isSaving ? "Saving..." : "Finalize Budget"}
        </button>
      </div>

      {/* Mobile Floating Bar */}
      <div className="lg:hidden fixed bottom-20 left-4 right-4 z-40">
        <div className="bg-primary p-4 rounded-2xl shadow-2xl flex items-center justify-between text-white">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold uppercase tracking-widest opacity-80">
              Buffer Status
            </span>
            <span className="text-lg font-bold font-data tabular-nums">
              {formatCurrency(Math.max(buffer, 0))}
            </span>
          </div>
          <button
            onClick={onFinalize}
            disabled={isSaving || !hasChanges}
            className="bg-white text-primary px-4 py-2 rounded-lg text-sm font-bold disabled:opacity-50"
          >
            {isSaving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </>
  )
}
