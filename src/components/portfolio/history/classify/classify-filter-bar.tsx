import {
  CLASSIFICATION_OPTIONS,
  DIRECTION_OPTIONS,
  CHAIN_FILTER_OPTIONS,
} from "@/components/portfolio/classify-helpers"

export function ClassifyFilterBar({
  search,
  classificationFilter,
  directionFilter,
  chainFilter,
  unreviewedOnly,
  hasFilters,
  onSearchChange,
  onClassificationChange,
  onDirectionChange,
  onChainChange,
  onUnreviewedToggle,
  onClearFilters,
}: {
  search: string
  classificationFilter: string
  directionFilter: string
  chainFilter: string
  unreviewedOnly: boolean
  hasFilters: boolean
  onSearchChange: (value: string) => void
  onClassificationChange: (value: string) => void
  onDirectionChange: (value: string) => void
  onChainChange: (value: string) => void
  onUnreviewedToggle: () => void
  onClearFilters: () => void
}) {
  return (
    <div className="bg-card border border-card-border p-4 mb-6 rounded-xl space-y-4">
      {/* Search */}
      <div className="relative">
        <span className="material-symbols-rounded absolute left-2.5 top-1/2 -translate-y-1/2 z-10 text-foreground-muted pointer-events-none" style={{ fontSize: 16 }}>search</span>
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Escape") onSearchChange("") }}
          placeholder="Search by tx hash, address, or symbol..."
          className="w-full bg-background border border-card-border-hover focus:border-foreground outline-none py-2 pl-9 pr-9 text-foreground placeholder-foreground-muted transition-colors rounded-lg text-sm font-data"
        />
        {search && (
          <button
            onClick={() => onSearchChange("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground-muted hover:text-foreground transition-colors"
            title="Clear search"
          >
            <span className="material-symbols-rounded text-[16px]">close</span>
          </button>
        )}
      </div>

      {/* Filter dropdowns */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
        <div>
          <label className="text-[10px] font-medium tracking-wider text-foreground-muted mb-2 block">Classification</label>
          <div className="relative">
            <select
              value={classificationFilter}
              onChange={(e) => onClassificationChange(e.target.value)}
              className="w-full bg-background border border-card-border-hover focus:border-foreground outline-none py-2 px-3 pr-8 text-foreground transition-colors appearance-none cursor-pointer rounded-lg text-sm"
            >
              {CLASSIFICATION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value} className="bg-card text-foreground">{opt.label}</option>
              ))}
            </select>
            <span className="material-symbols-rounded absolute right-2 top-1/2 -translate-y-1/2 text-foreground-muted text-sm pointer-events-none">expand_more</span>
          </div>
        </div>

        <div>
          <label className="text-[10px] font-medium tracking-wider text-foreground-muted mb-2 block">Direction</label>
          <div className="relative">
            <select
              value={directionFilter}
              onChange={(e) => onDirectionChange(e.target.value)}
              className="w-full bg-background border border-card-border-hover focus:border-foreground outline-none py-2 px-3 pr-8 text-foreground transition-colors appearance-none cursor-pointer rounded-lg text-sm"
            >
              {DIRECTION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value} className="bg-card text-foreground">{opt.label}</option>
              ))}
            </select>
            <span className="material-symbols-rounded absolute right-2 top-1/2 -translate-y-1/2 text-foreground-muted text-sm pointer-events-none">expand_more</span>
          </div>
        </div>

        <div>
          <label className="text-[10px] font-medium tracking-wider text-foreground-muted mb-2 block">Chain</label>
          <div className="relative">
            <select
              value={chainFilter}
              onChange={(e) => onChainChange(e.target.value)}
              className="w-full bg-background border border-card-border-hover focus:border-foreground outline-none py-2 px-3 pr-8 text-foreground transition-colors appearance-none cursor-pointer rounded-lg text-sm"
            >
              {CHAIN_FILTER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value} className="bg-card text-foreground">{opt.label}</option>
              ))}
            </select>
            <span className="material-symbols-rounded absolute right-2 top-1/2 -translate-y-1/2 text-foreground-muted text-sm pointer-events-none">expand_more</span>
          </div>
        </div>

        <div className="flex items-end h-full">
          <label className="flex items-center gap-2 cursor-pointer py-2">
            <input
              type="checkbox"
              checked={unreviewedOnly}
              onChange={onUnreviewedToggle}
              className="w-4 h-4 rounded border-card-border-hover accent-primary cursor-pointer"
            />
            <span className="text-sm text-foreground-muted">Unreviewed only</span>
          </label>
        </div>

        <div className="flex items-end h-full">
          {hasFilters && (
            <button
              onClick={onClearFilters}
              className="px-4 py-2 border border-card-border text-foreground-muted hover:text-foreground hover:border-card-border-hover transition-colors rounded-xl text-xs tracking-wide"
            >
              Clear Filters
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
