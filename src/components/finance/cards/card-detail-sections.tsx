import Link from "next/link"
import { formatCurrency, cn } from "@/lib/utils"
import type { CardAIEnrichedData } from "@/app/api/finance/cards/ai-enrich/route"

/* ── AI Loading Skeleton ─────────────────────────────────────── */

export function CardAILoadingSkeleton() {
  return (
    <section className="space-y-6 animate-pulse">
      <div className="flex items-center gap-2 text-primary text-sm font-medium">
        <span className="material-symbols-rounded animate-spin" style={{ fontSize: 18 }}>progress_activity</span>
        Loading card intelligence with AI...
      </div>
      <div>
        <div className="h-5 w-48 bg-card-elevated rounded mb-4" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="p-5 rounded-xl bg-card border border-card-border">
              <div className="size-8 bg-card-elevated rounded mb-2" />
              <div className="h-3 w-16 bg-card-elevated rounded mb-2" />
              <div className="h-6 w-24 bg-card-elevated rounded" />
            </div>
          ))}
        </div>
      </div>
      <div>
        <div className="h-5 w-40 bg-card-elevated rounded mb-4" />
        <div className="flex gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-10 w-40 bg-card-elevated rounded-xl" />
          ))}
        </div>
      </div>
      <div>
        <div className="h-5 w-32 bg-card-elevated rounded mb-4" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-4 p-4 rounded-xl bg-card border border-card-border">
              <div className="size-10 rounded-lg bg-card-elevated" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-48 bg-card-elevated rounded" />
                <div className="h-3 w-72 bg-card-elevated rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ── Signup Bonus ─────────────────────────────────────────────── */

export function CardSignupBonus({ bonus }: { bonus: { value: string; description: string } }) {
  return (
    <section className="p-5 rounded-xl bg-primary/5 border border-primary/20">
      <div className="flex items-center gap-3">
        <span className="material-symbols-rounded text-primary" style={{ fontSize: 24 }}>card_giftcard</span>
        <div>
          <p className="text-sm font-bold text-foreground">Signup Bonus: {bonus.value}</p>
          <p className="text-foreground-muted text-xs mt-0.5">{bonus.description}</p>
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
        {Array.isArray(liability.aprs) && liability.aprs.length > 0 && (
          <div className="p-4 rounded-xl bg-card border border-card-border">
            <p className="text-foreground-muted text-[10px] font-semibold uppercase tracking-widest">APR</p>
            <p className="text-foreground text-lg font-bold font-data tabular-nums mt-1">
              {(liability.aprs[0] as { aprPercentage: number }).aprPercentage.toFixed(2)}%
            </p>
          </div>
        )}
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
          <div key={m.category} className="p-5 rounded-xl bg-card border border-card-border hover:border-primary/30 transition-all">
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
          <div key={partner.name} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-card border border-card-border hover:border-primary/30 transition-all">
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

/* ── Card Benefits (DB Perks) ─────────────────────────────────── */

export function CardBenefitsDB({ perks }: {
  perks: Array<{ id: string; name: string; value?: number | null; isUsed: boolean }>
}) {
  return (
    <section>
      <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
        <span className="material-symbols-rounded text-primary" style={{ fontSize: 22 }}>security</span>
        Card Benefits
      </h3>
      <div className="space-y-3">
        {perks.map((perk) => (
          <div key={perk.id} className="flex items-center justify-between p-4 rounded-xl bg-card border border-card-border hover:bg-card-elevated transition-all">
            <div className="flex items-center gap-4">
              <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
                <span className="material-symbols-rounded" style={{ fontSize: 20 }}>{perk.isUsed ? "check_circle" : "verified_user"}</span>
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{perk.name}</p>
                {perk.value != null && perk.value > 0 && (
                  <p className="text-[10px] text-foreground-muted">Value: {formatCurrency(perk.value)}</p>
                )}
              </div>
            </div>
            <div className={cn("px-2.5 py-1 rounded-full text-[10px] font-semibold", perk.isUsed ? "bg-success/10 text-success" : "bg-warning/10 text-warning")}>
              {perk.isUsed ? "Used" : "Available"}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

/* ── Card Benefits (AI) ───────────────────────────────────────── */

export function CardBenefitsAI({ benefits }: {
  benefits: NonNullable<CardAIEnrichedData["benefits"]>
}) {
  return (
    <section>
      <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
        <span className="material-symbols-rounded text-primary" style={{ fontSize: 22 }}>security</span>
        Card Benefits
        <span className="text-[10px] font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full ml-1">AI</span>
      </h3>
      <div className="space-y-3">
        {benefits.map((benefit, i) => (
          <div key={i} className="flex items-center justify-between p-4 rounded-xl bg-card border border-card-border hover:bg-card-elevated transition-all">
            <div className="flex items-center gap-4">
              <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
                <span className="material-symbols-rounded" style={{ fontSize: 20 }}>{benefit.icon}</span>
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{benefit.name}</p>
                <p className="text-[10px] text-foreground-muted">{benefit.description}</p>
              </div>
            </div>
            {benefit.value != null && benefit.value > 0 && (
              <span className="text-xs font-semibold text-foreground-muted tabular-nums font-data">{formatCurrency(benefit.value)}</span>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}

/* ── Card Highlights (AI) ─────────────────────────────────────── */

export function CardHighlights({ highlights }: { highlights: string[] }) {
  return (
    <section>
      <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
        <span className="material-symbols-rounded text-primary" style={{ fontSize: 22 }}>auto_awesome</span>
        Key Highlights
        <span className="text-[10px] font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full ml-1">AI</span>
      </h3>
      <div className="space-y-2">
        {highlights.map((highlight, i) => (
          <div key={i} className="flex items-start gap-3 p-3 rounded-lg">
            <span className="material-symbols-rounded text-primary mt-0.5" style={{ fontSize: 16 }}>check_circle</span>
            <p className="text-sm text-foreground">{highlight}</p>
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
            href="/finance/settings"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-primary text-white hover:bg-primary-hover active:scale-95 transition-all"
          >
            <span className="material-symbols-rounded" style={{ fontSize: 18 }}>settings</span>
            Configure AI Provider
          </Link>
        ) : (
          <button
            onClick={onRefresh}
            disabled={isPending}
            className={cn(
              "inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all",
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
