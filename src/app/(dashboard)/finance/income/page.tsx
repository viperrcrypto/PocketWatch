"use client"

import { useIncomeStreams } from "@/hooks/finance/use-income-streams"
import { usePrivacyMode } from "@/hooks/use-privacy-mode"
import { PrivacyToggle } from "@/components/portfolio/privacy-toggle"
import { BlurredValue } from "@/components/portfolio/blurred-value"
import { FinancePageHeader } from "@/components/finance/finance-page-header"
import { FinanceCardSkeleton } from "@/components/finance/finance-loading"
import { formatCurrency, cn } from "@/lib/utils"
import { FadeIn } from "@/components/motion/fade-in"
import { StaggerChildren, StaggerItem } from "@/components/motion/stagger-children"

const FREQ_LABELS: Record<string, string> = {
  weekly: "Weekly",
  biweekly: "Biweekly",
  semimonthly: "Semi-monthly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  irregular: "One-time",
}

const STATUS_STYLES: Record<string, { icon: string; color: string; label: string }> = {
  on_track: { icon: "check_circle", color: "text-success", label: "On Track" },
  late: { icon: "schedule", color: "text-warning", label: "Late" },
  missed: { icon: "error", color: "text-error", label: "Missed" },
  new: { icon: "new_releases", color: "text-info", label: "New" },
}

export default function FinanceIncomePage() {
  const { data, isLoading, isError } = useIncomeStreams()
  const { isHidden, togglePrivacy } = usePrivacyMode()

  if (isError) {
    return (
      <div className="space-y-6">
        <FinancePageHeader title="Income Streams" />
        <div className="bg-card border border-error/30 rounded-xl p-8 text-center">
          <span className="material-symbols-rounded text-error mb-2 block" style={{ fontSize: 32 }}>error</span>
          <p className="text-sm text-error">Failed to load income data.</p>
        </div>
      </div>
    )
  }

  const streams = data?.streams ?? []
  const summary = data?.summary
  const recurring = streams.filter((s) => s.frequency !== "irregular")
  const oneTime = streams.filter((s) => s.frequency === "irregular")

  return (
    <div className="space-y-6">
      <FinancePageHeader
        title="Income Streams"
        subtitle="Recurring income detected from your transactions"
        actions={<PrivacyToggle isHidden={isHidden} onToggle={togglePrivacy} />}
      />

      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <FinanceCardSkeleton key={i} />)}
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <StaggerChildren className="grid grid-cols-2 lg:grid-cols-4 gap-4" staggerMs={60}>
            <StaggerItem>
              <SummaryCard
                icon="payments" label="Monthly Estimate"
                value={formatCurrency(summary?.monthlyEstimate ?? 0)}
                isHidden={isHidden}
              />
            </StaggerItem>
            <StaggerItem>
              <SummaryCard
                icon="account_balance_wallet" label="6-Month Total"
                value={formatCurrency(summary?.totalReceived6mo ?? 0)}
                isHidden={isHidden}
              />
            </StaggerItem>
            <StaggerItem>
              <SummaryCard
                icon="autorenew" label="Recurring Sources"
                value={String(summary?.recurringSources ?? 0)}
                isHidden={false}
              />
            </StaggerItem>
            <StaggerItem>
              <SummaryCard
                icon={summary?.lateOrMissed ? "warning" : "check_circle"}
                label="Late / Missed"
                value={String(summary?.lateOrMissed ?? 0)}
                isHidden={false}
                accent={summary?.lateOrMissed ? "error" : "success"}
              />
            </StaggerItem>
          </StaggerChildren>

          {/* Recurring Income Streams */}
          {recurring.length > 0 && (
            <FadeIn delay={0.1}>
              <div className="bg-card border border-card-border rounded-xl overflow-hidden" style={{ boxShadow: "var(--shadow-sm)" }}>
                <div className="px-5 py-4 border-b border-card-border/50">
                  <h3 className="text-sm font-semibold text-foreground">Recurring Income</h3>
                </div>
                <div className="divide-y divide-card-border/30">
                  {recurring.map((stream) => (
                    <IncomeStreamRow key={stream.merchantName} stream={stream} isHidden={isHidden} />
                  ))}
                </div>
              </div>
            </FadeIn>
          )}

          {/* One-time / New */}
          {oneTime.length > 0 && (
            <FadeIn delay={0.15}>
              <div className="bg-card border border-card-border rounded-xl overflow-hidden" style={{ boxShadow: "var(--shadow-sm)" }}>
                <div className="px-5 py-4 border-b border-card-border/50">
                  <h3 className="text-sm font-semibold text-foreground-muted">Recent One-Time Income</h3>
                </div>
                <div className="divide-y divide-card-border/30">
                  {oneTime.map((stream) => (
                    <IncomeStreamRow key={stream.merchantName} stream={stream} isHidden={isHidden} />
                  ))}
                </div>
              </div>
            </FadeIn>
          )}

          {streams.length === 0 && (
            <div className="bg-card rounded-xl p-12 text-center" style={{ boxShadow: "var(--shadow-sm)" }}>
              <span className="material-symbols-rounded text-foreground-muted/40 block mb-3" style={{ fontSize: 36 }}>payments</span>
              <h3 className="text-sm font-semibold text-foreground mb-1">No income detected yet</h3>
              <p className="text-xs text-foreground-muted max-w-sm mx-auto">
                Income streams are automatically detected from transactions categorized as &quot;Income&quot;. Make sure your paycheck and deposit transactions are properly categorized.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ─── Sub-components ──────────────────────────────────────────

function SummaryCard({ icon, label, value, isHidden, accent }: {
  icon: string; label: string; value: string; isHidden: boolean; accent?: "success" | "error"
}) {
  return (
    <div className="bg-card rounded-xl p-4" style={{ boxShadow: "var(--shadow-sm)" }}>
      <div className="flex items-center gap-2 mb-2">
        <span className={cn("material-symbols-rounded", accent === "error" ? "text-error" : accent === "success" ? "text-success" : "text-foreground-muted")} style={{ fontSize: 16 }}>{icon}</span>
        <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-foreground-muted">{label}</span>
      </div>
      <p className="text-lg font-bold tabular-nums text-foreground">
        <BlurredValue isHidden={isHidden}>{value}</BlurredValue>
      </p>
    </div>
  )
}

function IncomeStreamRow({ stream, isHidden }: { stream: import("@/hooks/finance/use-income-streams").IncomeStream; isHidden: boolean }) {
  const status = STATUS_STYLES[stream.status] ?? STATUS_STYLES.on_track
  const nextDate = stream.nextExpected
    ? new Date(stream.nextExpected).toLocaleDateString("en-US", { month: "short", day: "numeric" })
    : null
  const lastDate = new Date(stream.lastDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })

  return (
    <div className="px-5 py-4 flex items-center gap-4 hover:bg-background-secondary/50 transition-colors">
      {/* Status icon */}
      <span className={cn("material-symbols-rounded flex-shrink-0", status.color)} style={{ fontSize: 20 }}>
        {status.icon}
      </span>

      {/* Name + frequency */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{stream.merchantName}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[10px] text-foreground-muted">{FREQ_LABELS[stream.frequency]}</span>
          {stream.consistency > 0 && stream.frequency !== "irregular" && (
            <>
              <span className="text-foreground-muted/30">·</span>
              <span className="text-[10px] text-foreground-muted">{Math.round(stream.consistency * 100)}% consistent</span>
            </>
          )}
          {stream.monthCount > 1 && (
            <>
              <span className="text-foreground-muted/30">·</span>
              <span className="text-[10px] text-foreground-muted">{stream.monthCount} months</span>
            </>
          )}
        </div>
      </div>

      {/* Next expected */}
      <div className="hidden sm:block text-right flex-shrink-0">
        {nextDate ? (
          <div>
            <p className="text-[10px] text-foreground-muted">Next expected</p>
            <p className="text-xs font-medium tabular-nums text-foreground">{nextDate}</p>
          </div>
        ) : (
          <div>
            <p className="text-[10px] text-foreground-muted">Last received</p>
            <p className="text-xs font-medium tabular-nums text-foreground">{lastDate}</p>
          </div>
        )}
      </div>

      {/* Amount */}
      <div className="text-right flex-shrink-0">
        <p className="text-sm font-semibold tabular-nums text-success">
          <BlurredValue isHidden={isHidden}>{formatCurrency(stream.avgAmount)}</BlurredValue>
        </p>
        <span className={cn("text-[10px] font-medium", status.color)}>{status.label}</span>
      </div>
    </div>
  )
}
