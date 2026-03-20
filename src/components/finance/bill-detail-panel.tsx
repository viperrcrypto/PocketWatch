"use client"

import { formatCurrency, cn } from "@/lib/utils"
import { BillAvatar } from "./bill-avatar"
import { getCancelUrl } from "@/lib/finance/cancel-links"

interface BillDetailItem {
  id: string
  merchantName: string
  amount: number
  frequency: string
  nextDueDate: string
  daysUntil: number
  category: string | null
  billType?: string | null
  isPaid?: boolean
  logoUrl?: string | null
  accountName?: string | null
  accountMask?: string | null
  institutionName?: string | null
}

interface Props {
  bill: BillDetailItem | null
  onClose: () => void
}

const BILL_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  subscription: { label: "Subscription", color: "bg-blue-500/10 text-blue-500" },
  bill: { label: "Bill", color: "bg-amber-500/10 text-amber-500" },
  insurance: { label: "Insurance", color: "bg-emerald-500/10 text-emerald-500" },
  membership: { label: "Membership", color: "bg-violet-500/10 text-violet-500" },
  cc_payment: { label: "Card Payment", color: "bg-rose-500/10 text-rose-500" },
  cc_annual_fee: { label: "Annual Fee", color: "bg-orange-500/10 text-orange-500" },
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="py-3 border-b border-card-border/30">
      <p className="text-[10px] font-medium uppercase tracking-widest text-foreground-muted mb-2">{title}</p>
      {children}
    </div>
  )
}

export function BillDetailPanel({ bill, onClose }: Props) {
  if (!bill) return null

  const cancelInfo = bill.billType !== "cc_payment" ? getCancelUrl(bill.merchantName) : null
  const typeInfo = BILL_TYPE_LABELS[bill.billType ?? "bill"] ?? BILL_TYPE_LABELS.bill
  const hasAccount = bill.institutionName || bill.accountName || bill.accountMask
  const dueDate = new Date(bill.nextDueDate + "T00:00")

  return (
    <>
      <div className="fixed inset-0 bg-black/20 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 bottom-0 w-full max-w-[400px] bg-card border-l border-card-border z-50 overflow-y-auto">
        <div className="p-5">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <BillAvatar merchantName={bill.merchantName} logoUrl={bill.logoUrl} size="lg" />
              <div>
                <p className="text-base font-semibold text-foreground">{bill.merchantName}</p>
                <span className={cn("px-2 py-0.5 text-[10px] font-medium rounded-full", typeInfo.color)}>
                  {typeInfo.label}
                </span>
              </div>
            </div>
            <button onClick={onClose} className="p-1 rounded-lg hover:bg-background-secondary">
              <span className="material-symbols-rounded text-foreground-muted" style={{ fontSize: 20 }}>close</span>
            </button>
          </div>

          {/* Amount */}
          <p className="font-data text-2xl font-bold tabular-nums text-foreground mb-4">
            {formatCurrency(bill.amount)}
          </p>

          {/* Account */}
          {hasAccount && (
            <Section title="Account">
              <div className="flex items-center gap-2">
                <span className="material-symbols-rounded text-foreground-muted" style={{ fontSize: 16 }}>account_balance</span>
                <div>
                  {bill.institutionName && (
                    <p className="text-sm font-medium text-foreground">{bill.institutionName}</p>
                  )}
                  <p className="text-xs text-foreground-muted">
                    {[bill.accountName, bill.accountMask ? `••••${bill.accountMask}` : null].filter(Boolean).join(" · ")}
                  </p>
                </div>
              </div>
            </Section>
          )}

          {/* Schedule */}
          <Section title="Schedule">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="material-symbols-rounded text-foreground-muted" style={{ fontSize: 16 }}>schedule</span>
                <span className="text-sm text-foreground capitalize">{bill.frequency.replace("_", " ")}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-rounded text-foreground-muted" style={{ fontSize: 16 }}>event</span>
                <span className="text-sm text-foreground">
                  {bill.isPaid ? "Paid" : "Due"}{" "}
                  {dueDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                </span>
              </div>
              {bill.isPaid && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium bg-success/10 text-success rounded-full">
                  <span className="material-symbols-rounded" style={{ fontSize: 12 }}>check_circle</span>
                  Paid
                </span>
              )}
            </div>
          </Section>

          {/* Category */}
          {bill.category && (
            <Section title="Category">
              <p className="text-sm text-foreground">{bill.category}</p>
            </Section>
          )}

          {/* Cancel */}
          {cancelInfo && !bill.isPaid && (
            <div className="pt-4">
              <a
                href={cancelInfo.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 w-full px-4 py-2 text-sm font-medium text-primary border border-primary/30 rounded-lg hover:bg-primary-muted transition-colors"
              >
                <span className="material-symbols-rounded" style={{ fontSize: 16 }}>open_in_new</span>
                Cancel Subscription
              </a>
              {cancelInfo.note && (
                <p className="text-[10px] text-foreground-muted text-center mt-1.5">{cancelInfo.note}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
