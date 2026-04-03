import Link from "next/link"
import { formatCurrency, cn } from "@/lib/utils"
import type { CardAIEnrichedData } from "@/app/api/finance/cards/ai-enrich/route"

/* ── AI Loading Skeleton ─────────────────────────────────────── */

export function CardAILoadingSkeleton() {
  return (
    <section className="space-y-6">
      <div className="flex items-center gap-2 text-primary text-sm font-medium">
        <span className="material-symbols-rounded animate-spin" style={{ fontSize: 18 }}>progress_activity</span>
        Loading card intelligence with AI...
      </div>
      <div>
        <div className="h-5 w-48 animate-shimmer rounded mb-4" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="p-5 rounded-xl animate-shimmer">
              <div className="size-8 rounded mb-2" />
              <div className="h-3 w-16 rounded mb-2" />
              <div className="h-6 w-24 rounded" />
            </div>
          ))}
        </div>
      </div>
      <div>
        <div className="h-5 w-40 animate-shimmer rounded mb-4" />
        <div className="flex gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-10 w-40 animate-shimmer rounded-xl" />
          ))}
        </div>
      </div>
      <div>
        <div className="h-5 w-32 animate-shimmer rounded mb-4" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-4 p-4 rounded-xl animate-shimmer">
              <div className="size-10 rounded-lg" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-48 rounded" />
                <div className="h-3 w-72 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ── Payment Details ──────────────────────────────────────────── */

export function CardPaymentDetails({ liability }: {
  liability: { minimumPaymentAmount?: number | null; lastPaymentAmount?: number | null; aprs?: unknown[]; nextPaymentDueDate?: string | null }
}) {
  return (
    <section>
      <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
        <span className="material-symbols-rounded text-primary" style={{ fontSize: 22 }}>account_balance</span>
        Payment Details
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {liability.minimumPaymentAmount != null && (
          <div className="p-4 rounded-xl bg-card border border-card-border">
            <p className="text-foreground-muted text-[10px] font-semibold uppercase tracking-widest">Min Payment</p>
            <p className="text-foreground text-lg font-bold font-data tabular-nums mt-1">{formatCurrency(liability.minimumPaymentAmount)}</p>
          </div>
        )}
        {liability.lastPaymentAmount != null && (
          <div className="p-4 rounded-xl bg-card border border-card-border">
            <p className="text-foreground-muted text-[10px] font-semibold uppercase tracking-widest">Last Payment</p>
            <p className="text-foreground text-lg font-bold font-data tabular-nums mt-1">{formatCurrency(liability.lastPaymentAmount)}</p>
          </div>
        )}
        {Array.isArray(liability.aprs) && liability.aprs.length > 0 &&
          (liability.aprs as Array<{ aprPercentage: number; aprType: string; balanceSubjectToApr?: number | null }>).map((apr, i) => (
            <div key={i} className="p-4 rounded-xl bg-card border border-card-border">
              <p className="text-foreground-muted text-[10px] font-semibold uppercase tracking-widest">
                {apr.aprType === "purchase_apr" ? "Purchase APR"
                  : apr.aprType === "balance_transfer_apr" ? "Balance Transfer APR"
                  : apr.aprType === "cash_advance_apr" ? "Cash Advance APR"
                  : apr.aprType === "special" ? "Special APR"
                  : "APR"}
              </p>
              <p className="text-foreground text-lg font-bold font-data tabular-nums mt-1">
                {apr.aprPercentage.toFixed(2)}%
              </p>
              {apr.balanceSubjectToApr != null && apr.balanceSubjectToApr > 0 && (
                <p className="text-foreground-muted text-[10px] mt-0.5">{formatCurrency(apr.balanceSubjectToApr)} subject</p>
              )}
            </div>
          ))
        }
        {liability.nextPaymentDueDate && (
          <div className="p-4 rounded-xl bg-card border border-card-border">
            <p className="text-foreground-muted text-[10px] font-semibold uppercase tracking-widest">Next Due</p>
            <p className="text-foreground text-lg font-bold font-data mt-1">
              {new Date(liability.nextPaymentDueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </p>
          </div>
        )}
      </div>
    </section>
  )
}

/* ── Reward Multipliers ───────────────────────────────────────── */

export function CardRewardMultipliers({ multipliers }: {
  multipliers: Array<{ category: string; rate: number; unit: string; description?: string; icon: string }>
}) {
  if (multipliers.length === 0) return null
  return (
    <section>
      <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
        <span className="material-symbols-rounded text-primary" style={{ fontSize: 22 }}>bolt</span>
        Reward Multipliers
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {multipliers.map((m) => (
          <div key={m.category} className="p-5 rounded-xl bg-card border border-card-border hover:border-primary/30 transition-colors">
            <span className="material-symbols-rounded text-primary text-2xl mb-2 block">{m.icon}</span>
            <p className="text-foreground-muted text-xs font-medium">{m.category}</p>
            <p className="text-foreground text-xl font-bold">{m.rate}x {m.unit}</p>
            {m.description && <p className="text-foreground-muted text-[10px] mt-1">{m.description}</p>}
          </div>
        ))}
      </div>
    </section>
  )
}

/* ── Transfer Partners ────────────────────────────────────────── */

export function CardTransferPartners({ partners }: {
  partners: Array<{ name: string; ratio?: string; shortCode?: string }>
}) {
  if (partners.length === 0) return null
  return (
    <section>
      <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
        <span className="material-symbols-rounded text-primary" style={{ fontSize: 22 }}>swap_horiz</span>
        Transfer Partners
      </h3>
      <div className="flex flex-wrap gap-2">
        {partners.map((partner) => (
          <div key={partner.name} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-card border border-card-border hover:border-primary/30 transition-colors">
            {partner.shortCode && (
              <div className="size-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">{partner.shortCode}</div>
            )}
            <span className="text-sm font-semibold text-foreground">{partner.name}</span>
            {partner.ratio && (
              <span className="text-[10px] font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded">{partner.ratio}</span>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}

/* ── Card Benefits (AI) ───────────────────────────────────────── */

/** Generic features that exist on all cards — not worth displaying */
const JUNK_BENEFITS = new Set([
  "plan it®", "plan it", "plan it® payment option",
  "amex offers", "fraud protection", "dispute resolution",
  "pay over time", "zero liability", "zero fraud liability",
]);

export function CardBenefitsAI({ benefits }: {
  benefits: NonNullable<CardAIEnrichedData["benefits"]>
}) {
  const filtered = benefits.filter((b) => {
    if (JUNK_BENEFITS.has(b.name.toLowerCase().trim())) return false
    // Filter out benefits the AI says aren't offered
    const desc = b.description.toLowerCase()
    if (/not offered|not available|not included|does not (offer|include|provide)/i.test(desc)) return false
    return true
  })
  if (filtered.length === 0) return null
  return (
    <section>
      <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
        <span className="material-symbols-rounded text-primary" style={{ fontSize: 22 }}>security</span>
        Card Benefits & Protections
      </h3>
      <div className="space-y-3">
        {filtered.map((benefit, i) => (
          <div key={i} className="p-4 rounded-xl bg-card border border-card-border hover:bg-card-elevated transition-colors">
            <div className="flex items-start gap-4">
              <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary flex-shrink-0 mt-0.5">
                <span className="material-symbols-rounded" style={{ fontSize: 20 }}>{benefit.icon}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-foreground">{benefit.name}</p>
                  {benefit.value != null && benefit.value > 0 && (
                    <span className="text-xs font-semibold text-primary tabular-nums font-data flex-shrink-0">{formatCurrency(benefit.value)}</span>
                  )}
                </div>
                <p className="text-xs text-foreground-muted mt-1 leading-relaxed">{benefit.description}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

/* ── Statement Credits ────────────────────────────────────────── */

export function CardStatementCredits({ credits }: {
  credits: Array<{ name: string; amount: number; frequency: string; used?: boolean }>
}) {
  return (
    <section>
      <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
        <span className="material-symbols-rounded text-primary" style={{ fontSize: 22 }}>payments</span>
        Statement Credits
      </h3>
      <div className="space-y-3">
        {credits.map((credit, i) => (
          <div key={i} className="flex items-center justify-between p-4 rounded-xl bg-card border border-card-border">
            <div>
              <p className="text-sm font-semibold text-foreground">{credit.name}</p>
              <p className="text-[10px] text-foreground-muted capitalize">{credit.frequency}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-data text-sm font-semibold text-foreground tabular-nums">{formatCurrency(credit.amount)}</span>
              <div className={cn("px-2.5 py-1 rounded-full text-[10px] font-semibold", credit.used ? "bg-success/10 text-success" : "bg-primary/10 text-primary")}>
                {credit.used ? "Claimed" : "Available"}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

/* ── AI Refresh Button ────────────────────────────────────────── */

export function CardAIRefreshSection({
  aiEnrichedAt,
  noProvider,
  isPending,
  aiError,
  onRefresh,
}: {
  aiEnrichedAt: string | null | undefined
  noProvider: boolean
  isPending: boolean
  aiError: string | null
  onRefresh: () => void
}) {
  return (
    <section className="pt-4 border-t border-card-border">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="material-symbols-rounded text-primary" style={{ fontSize: 22 }}>auto_awesome</span>
          <div>
            <p className="text-sm font-semibold text-foreground">AI Card Intelligence</p>
            <p className="text-[10px] text-foreground-muted">
              {noProvider
                ? "Set up an AI provider to auto-fill card benefits and rewards"
                : aiEnrichedAt
                  ? `Last refreshed ${new Date(aiEnrichedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`
                  : "Enrich this card with AI to see benefits, multipliers, and transfer partners"}
            </p>
          </div>
        </div>
        {noProvider ? (
          <Link
            href="/settings?tab=finance#ai-intelligence"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-primary text-white hover:bg-primary-hover active:scale-95 transition-colors"
          >
            <span className="material-symbols-rounded" style={{ fontSize: 18 }}>settings</span>
            Configure AI Provider
          </Link>
        ) : (
          <button
            onClick={onRefresh}
            disabled={isPending}
            className={cn(
              "inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors",
              isPending ? "bg-card-elevated text-foreground-muted cursor-not-allowed" : "bg-primary/10 text-primary hover:bg-primary/20 active:scale-95",
            )}
          >
            <span className={cn("material-symbols-rounded", isPending && "animate-spin")} style={{ fontSize: 18 }}>
              {isPending ? "progress_activity" : "refresh"}
            </span>
            {isPending ? "Refreshing..." : aiEnrichedAt ? "Refresh with AI" : "Enrich with AI"}
          </button>
        )}
      </div>
      {aiError && <p className="text-error text-xs mt-2">{aiError}</p>}
    </section>
  )
}
