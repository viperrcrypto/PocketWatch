"use client"

import { useState, useMemo } from "react"
import { cn } from "@/lib/utils"
import {
  useBonusOffers,
  type BonusSearchResult,
} from "@/hooks/finance/use-bonus-tracker"

// ── Sort / Filter types ─────────────────────────────────────────

type SortKey = "bonus" | "fee_low" | "fee_high" | "spend_low" | "best_deal"
type FeeFilter = "all" | "no_fee" | "under_100" | "under_300" | "premium"

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "bonus", label: "Highest Bonus" },
  { value: "best_deal", label: "Best vs Historical" },
  { value: "fee_low", label: "Lowest Annual Fee" },
  { value: "fee_high", label: "Highest Annual Fee" },
  { value: "spend_low", label: "Lowest Spend Required" },
]

const FEE_OPTIONS: { value: FeeFilter; label: string }[] = [
  { value: "all", label: "Any Fee" },
  { value: "no_fee", label: "No Fee" },
  { value: "under_100", label: "Under $100" },
  { value: "under_300", label: "Under $300" },
  { value: "premium", label: "$300+" },
]

// ── Card Offer Card ─────────────────────────────────────────────

function OfferCard({ card }: { card: BonusSearchResult }) {
  const offer = card.offer
  if (!offer) return null

  const isBest = card.historicalPercent >= 100
  const isLow = card.historicalPercent > 0 && card.historicalPercent < 70

  return (
    <a
      href={card.url}
      target="_blank"
      rel="noopener noreferrer"
      className="block rounded-lg border border-card-border hover:border-primary/30 hover:bg-background-secondary/30 transition-all p-4 group"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors">
            {card.name}
          </p>
          <p className="text-[10px] text-foreground-muted mt-0.5">
            {card.issuer}
            {card.isBusiness ? " (Business)" : ""}
            {card.annualFee > 0
              ? ` · $${card.annualFee}/yr${card.isAnnualFeeWaived ? " (waived yr 1)" : ""}`
              : " · No annual fee"}
          </p>
        </div>
        <span
          className="material-symbols-rounded text-foreground-muted/30 group-hover:text-primary/50 transition-colors flex-shrink-0 mt-0.5"
          style={{ fontSize: 16 }}
        >
          open_in_new
        </span>
      </div>

      <div className="flex items-center gap-4 mt-3">
        <div>
          <p className="text-[9px] text-foreground-muted uppercase tracking-wider">Bonus</p>
          <p className="text-base font-data font-bold text-primary tabular-nums">
            {offer.bonusAmount.toLocaleString()}
            <span className="text-[10px] font-normal text-foreground-muted ml-1">
              {card.currency !== "USD" ? card.currency.toLowerCase() : "pts"}
            </span>
          </p>
        </div>
        <div className="w-px h-8 bg-card-border" />
        <div>
          <p className="text-[9px] text-foreground-muted uppercase tracking-wider">Spend</p>
          <p className="text-base font-data font-bold text-foreground tabular-nums">
            ${offer.spendRequired.toLocaleString()}
          </p>
        </div>
        <div className="w-px h-8 bg-card-border" />
        <div>
          <p className="text-[9px] text-foreground-muted uppercase tracking-wider">Window</p>
          <p className="text-base font-data font-bold text-foreground tabular-nums">
            {offer.days} <span className="text-[10px] font-normal text-foreground-muted">days</span>
          </p>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2 flex-wrap">
        {isBest && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-success/10 text-success text-[10px] font-medium">
            <span className="material-symbols-rounded" style={{ fontSize: 12 }}>trending_up</span>
            Best offer ever
          </span>
        )}
        {!isBest && card.historicalPercent > 0 && (
          <span className={cn(
            "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium",
            isLow ? "bg-warning/10 text-warning" : "bg-background-secondary text-foreground-muted",
          )}>
            {card.historicalPercent}% of best ({card.historicalBest.toLocaleString()})
          </span>
        )}
        {card.credits.length > 0 && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/8 text-primary text-[10px] font-medium">
            +{card.credits.length} credit{card.credits.length > 1 ? "s" : ""}
          </span>
        )}
      </div>

      {card.credits.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {card.credits.slice(0, 3).map((c, i) => (
            <span key={i} className="text-[10px] text-foreground-muted">
              {c.description} (${c.value})
              {i < Math.min(card.credits.length, 3) - 1 ? " ·" : ""}
            </span>
          ))}
        </div>
      )}
    </a>
  )
}

// ── Filter Dropdown ─────────────────────────────────────────────

function FilterSelect<T extends string>({
  value,
  onChange,
  options,
  icon,
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string }[]
  icon: string
}) {
  return (
    <div className="relative flex items-center gap-1 rounded-md bg-background-secondary/60 text-[10px]">
      <span className="material-symbols-rounded text-foreground-muted pl-2" style={{ fontSize: 13 }}>{icon}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="bg-transparent text-[10px] text-foreground font-medium appearance-none py-1.5 pr-5 pl-1 cursor-pointer focus:outline-none"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <span className="material-symbols-rounded absolute right-1 top-1/2 -translate-y-1/2 text-foreground-muted/40 pointer-events-none" style={{ fontSize: 12 }}>
        expand_more
      </span>
    </div>
  )
}

// ── Toggle Chip ─────────────────────────────────────────────────

function ToggleChip({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean
  onClick: () => void
  icon: string
  label: string
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1 px-2 py-1.5 rounded-md text-[10px] font-medium transition-colors",
        active
          ? "bg-foreground text-background"
          : "bg-background-secondary/60 text-foreground-muted hover:bg-background-secondary",
      )}
    >
      <span className="material-symbols-rounded" style={{ fontSize: 13 }}>{icon}</span>
      {label}
    </button>
  )
}

// ── Main Component ──────────────────────────────────────────────

export function BonusTrackerSection() {
  const [query, setQuery] = useState("")
  const [sort, setSort] = useState<SortKey>("bonus")
  const [feeFilter, setFeeFilter] = useState<FeeFilter>("all")
  const [hasCredits, setHasCredits] = useState(false)
  const [personalOnly, setPersonalOnly] = useState(false)
  const [showFilters, setShowFilters] = useState(false)

  const { data, isLoading, isFetching } = useBonusOffers(query, "All")

  const allCards = data?.cards ?? []

  const filtered = useMemo(() => {
    let result = allCards.filter((c) => c.offer)

    // Fee filter
    if (feeFilter === "no_fee") result = result.filter((c) => c.annualFee === 0)
    else if (feeFilter === "under_100") result = result.filter((c) => c.annualFee < 100)
    else if (feeFilter === "under_300") result = result.filter((c) => c.annualFee < 300)
    else if (feeFilter === "premium") result = result.filter((c) => c.annualFee >= 300)

    // Credits filter
    if (hasCredits) result = result.filter((c) => c.credits.length > 0)

    // Personal only
    if (personalOnly) result = result.filter((c) => !c.isBusiness)

    // Sort
    result.sort((a, b) => {
      const ao = a.offer!, bo = b.offer!
      switch (sort) {
        case "bonus": return bo.bonusAmount - ao.bonusAmount
        case "best_deal": return b.historicalPercent - a.historicalPercent
        case "fee_low": return a.annualFee - b.annualFee
        case "fee_high": return b.annualFee - a.annualFee
        case "spend_low": return ao.spendRequired - bo.spendRequired
        default: return 0
      }
    })

    return result
  }, [allCards, sort, feeFilter, hasCredits, personalOnly])

  const activeFilterCount =
    (feeFilter !== "all" ? 1 : 0) +
    (hasCredits ? 1 : 0) +
    (personalOnly ? 1 : 0)

  return (
    <div className="bg-card border border-card-border rounded-xl overflow-hidden">
      <div className="px-5 py-3 border-b border-card-border/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="material-symbols-rounded text-foreground-muted" style={{ fontSize: 16 }}>local_offer</span>
          <span className="text-[10px] font-medium uppercase tracking-widest text-foreground-muted">
            Card Offers
          </span>
          {!isLoading && filtered.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-background-secondary text-foreground-muted text-[9px] font-data font-bold tabular-nums">
              {filtered.length}
            </span>
          )}
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={cn(
            "flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-medium transition-colors",
            showFilters || activeFilterCount > 0
              ? "bg-primary/10 text-primary"
              : "text-foreground-muted hover:bg-background-secondary",
          )}
        >
          <span className="material-symbols-rounded" style={{ fontSize: 14 }}>tune</span>
          Filters
          {activeFilterCount > 0 && (
            <span className="w-4 h-4 rounded-full bg-primary text-background text-[9px] font-bold flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      <div className="p-5 space-y-3">
        {/* Search */}
        <div className="flex items-center gap-2 rounded-lg border border-card-border bg-background px-3 py-2 focus-within:ring-2 focus-within:ring-primary/30" role="search">
          <span className="material-symbols-rounded text-foreground-muted flex-shrink-0" style={{ fontSize: 18 }}>search</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name..."
            className="w-full bg-transparent text-sm text-foreground placeholder:text-foreground-muted/50 focus:outline-none"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            name="rewards-search"
            data-1p-ignore
            data-lpignore="true"
            data-protonpass-ignore
            data-form-type="other"
          />
          {isFetching ? (
            <span className="material-symbols-rounded animate-spin text-foreground-muted flex-shrink-0" style={{ fontSize: 16 }}>progress_activity</span>
          ) : query ? (
            <button onClick={() => setQuery("")} className="text-foreground-muted hover:text-foreground transition-colors flex-shrink-0">
              <span className="material-symbols-rounded" style={{ fontSize: 14 }}>close</span>
            </button>
          ) : null}
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="flex items-center gap-2 flex-wrap animate-in fade-in slide-in-from-top-1 duration-150">
            <FilterSelect value={sort} onChange={setSort} options={SORT_OPTIONS} icon="sort" />
            <FilterSelect value={feeFilter} onChange={setFeeFilter} options={FEE_OPTIONS} icon="payments" />
            <ToggleChip
              active={hasCredits}
              onClick={() => setHasCredits(!hasCredits)}
              icon="card_giftcard"
              label="Has Credits"
            />
            <ToggleChip
              active={personalOnly}
              onClick={() => setPersonalOnly(!personalOnly)}
              icon="person"
              label="Personal Only"
            />
            {activeFilterCount > 0 && (
              <button
                onClick={() => {
                  setSort("bonus")
                  setFeeFilter("all")
                  setHasCredits(false)
                  setPersonalOnly(false)
                }}
                className="text-[10px] text-foreground-muted hover:text-foreground transition-colors ml-1"
              >
                Clear all
              </button>
            )}
          </div>
        )}

        {/* Cards list */}
        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <span className="material-symbols-rounded animate-spin text-foreground-muted" style={{ fontSize: 20 }}>progress_activity</span>
          </div>
        )}

        {!isLoading && filtered.length > 0 && (
          <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
            {filtered.map((card) => (
              <OfferCard key={card.cardId} card={card} />
            ))}
          </div>
        )}

        {!isLoading && filtered.length === 0 && (
          <div className="text-center py-6">
            <p className="text-xs text-foreground-muted">
              No offers match your filters
            </p>
            {activeFilterCount > 0 && (
              <button
                onClick={() => {
                  setFeeFilter("all")
                  setHasCredits(false)
                  setPersonalOnly(false)
                }}
                className="text-[10px] text-primary hover:underline mt-1"
              >
                Clear filters
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
