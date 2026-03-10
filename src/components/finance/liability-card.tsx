"use client"

import { formatCurrency, cn } from "@/lib/utils"

interface CreditCardLiability {
  accountName: string | null; mask: string | null; currentBalance: number | null
  isOverdue: boolean; lastPaymentAmount: number | null; lastPaymentDate: string | null
  minimumPaymentAmount: number | null; nextPaymentDueDate: string | null
  aprs: Array<{ aprPercentage: number; aprType: string; balanceSubjectToApr: number | null }>
}

interface MortgageLiability {
  accountName: string | null; mask: string | null; currentBalance: number | null
  interestRateType: string | null; interestRatePercent: number | null
  escrowBalance: number | null; hasPmi: boolean
  nextMonthlyPayment: number | null; nextPaymentDueDate: string | null
  maturityDate: string | null; originationPrincipal: number | null
  ytdInterestPaid: number | null; ytdPrincipalPaid: number | null
}

interface StudentLoanLiability {
  accountName: string | null; mask: string | null; currentBalance: number | null
  loanName: string | null; interestRatePercent: number | null; isOverdue: boolean
  minimumPaymentAmount: number | null; nextPaymentDueDate: string | null
  expectedPayoffDate: string | null; repaymentPlanType: string | null
  outstandingInterest: number | null
  ytdInterestPaid: number | null; ytdPrincipalPaid: number | null
}

function LiabilityRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-xs text-foreground-muted">{label}</span>
      <span className="font-data text-sm font-medium text-foreground tabular-nums">{value}</span>
    </div>
  )
}

function formatDate(d: string | null) {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

export function CreditCardLiabilityCard({ data }: { data: CreditCardLiability }) {
  return (
    <div className="bg-card border border-card-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-orange-100 dark:bg-orange-500/10 flex items-center justify-center">
            <span className="material-symbols-rounded text-orange-600 dark:text-orange-400" style={{ fontSize: 18 }}>credit_card</span>
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">{data.accountName ?? "Credit Card"}</p>
            {data.mask && <p className="text-[10px] text-foreground-muted">••••{data.mask}</p>}
          </div>
        </div>
        {data.isOverdue && (
          <span className="px-2 py-0.5 text-[10px] font-medium bg-error/10 text-error rounded-full">Overdue</span>
        )}
      </div>
      {data.currentBalance !== null && (
        <p className="font-data text-lg font-bold text-foreground tabular-nums mb-3">{formatCurrency(Math.abs(data.currentBalance))}</p>
      )}
      <div className="divide-y divide-card-border/30">
        {data.aprs.length > 0 && (
          <div className="pb-2">
            <p className="text-[10px] font-medium uppercase tracking-widest text-foreground-muted mb-1">APR</p>
            <div className="flex flex-wrap gap-2">
              {data.aprs.map((apr, i) => (
                <div key={i} className="bg-gray-50 dark:bg-white/5 rounded-lg px-2.5 py-1">
                  <span className="text-xs text-foreground-muted capitalize">{apr.aprType.replace(/_/g, " ")} </span>
                  <span className="font-data text-sm font-semibold text-foreground">{apr.aprPercentage.toFixed(2)}%</span>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="pt-2 space-y-0">
          <LiabilityRow label="Min Payment" value={data.minimumPaymentAmount != null ? formatCurrency(data.minimumPaymentAmount) : "—"} />
          <LiabilityRow label="Last Payment" value={data.lastPaymentAmount != null ? `${formatCurrency(data.lastPaymentAmount)} on ${formatDate(data.lastPaymentDate)}` : "—"} />
          <LiabilityRow label="Next Due" value={formatDate(data.nextPaymentDueDate)} />
        </div>
      </div>
    </div>
  )
}

export function MortgageLiabilityCard({ data }: { data: MortgageLiability }) {
  return (
    <div className="bg-card border border-card-border rounded-xl p-5">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-lg bg-red-100 dark:bg-red-500/10 flex items-center justify-center">
          <span className="material-symbols-rounded text-red-600 dark:text-red-400" style={{ fontSize: 18 }}>home</span>
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">{data.accountName ?? "Mortgage"}</p>
          {data.mask && <p className="text-[10px] text-foreground-muted">••••{data.mask}</p>}
        </div>
      </div>
      {data.currentBalance !== null && (
        <p className="font-data text-lg font-bold text-foreground tabular-nums mb-3">{formatCurrency(Math.abs(data.currentBalance))}</p>
      )}
      <div className="space-y-0 divide-y divide-card-border/30">
        <LiabilityRow label="Interest Rate" value={
          <span className="flex items-center gap-1">
            {data.interestRatePercent != null ? `${data.interestRatePercent.toFixed(2)}%` : "—"}
            {data.interestRateType && (
              <span className="px-1.5 py-0.5 text-[9px] uppercase bg-gray-100 dark:bg-white/5 rounded text-foreground-muted">{data.interestRateType}</span>
            )}
          </span>
        } />
        <LiabilityRow label="Monthly Payment" value={data.nextMonthlyPayment != null ? formatCurrency(data.nextMonthlyPayment) : "—"} />
        <LiabilityRow label="Escrow" value={data.escrowBalance != null ? formatCurrency(data.escrowBalance) : "—"} />
        <LiabilityRow label="Maturity" value={formatDate(data.maturityDate)} />
        {data.hasPmi && <LiabilityRow label="PMI" value={<span className="text-amber-500 text-xs">Active</span>} />}
        <LiabilityRow label="YTD Interest" value={data.ytdInterestPaid != null ? formatCurrency(data.ytdInterestPaid) : "—"} />
        <LiabilityRow label="YTD Principal" value={data.ytdPrincipalPaid != null ? formatCurrency(data.ytdPrincipalPaid) : "—"} />
      </div>
    </div>
  )
}

export function StudentLoanLiabilityCard({ data }: { data: StudentLoanLiability }) {
  return (
    <div className="bg-card border border-card-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-500/10 flex items-center justify-center">
            <span className="material-symbols-rounded text-blue-600 dark:text-blue-400" style={{ fontSize: 18 }}>school</span>
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">{data.loanName ?? data.accountName ?? "Student Loan"}</p>
            {data.mask && <p className="text-[10px] text-foreground-muted">••••{data.mask}</p>}
          </div>
        </div>
        {data.isOverdue && (
          <span className="px-2 py-0.5 text-[10px] font-medium bg-error/10 text-error rounded-full">Overdue</span>
        )}
      </div>
      {data.currentBalance !== null && (
        <p className="font-data text-lg font-bold text-foreground tabular-nums mb-3">{formatCurrency(Math.abs(data.currentBalance))}</p>
      )}
      <div className="space-y-0 divide-y divide-card-border/30">
        <LiabilityRow label="Interest Rate" value={data.interestRatePercent != null ? `${data.interestRatePercent.toFixed(2)}%` : "—"} />
        <LiabilityRow label="Min Payment" value={data.minimumPaymentAmount != null ? formatCurrency(data.minimumPaymentAmount) : "—"} />
        <LiabilityRow label="Next Due" value={formatDate(data.nextPaymentDueDate)} />
        <LiabilityRow label="Payoff Date" value={formatDate(data.expectedPayoffDate)} />
        {data.repaymentPlanType && <LiabilityRow label="Plan" value={data.repaymentPlanType} />}
        {data.outstandingInterest != null && <LiabilityRow label="Outstanding Interest" value={formatCurrency(data.outstandingInterest)} />}
        <LiabilityRow label="YTD Interest" value={data.ytdInterestPaid != null ? formatCurrency(data.ytdInterestPaid) : "—"} />
      </div>
    </div>
  )
}
