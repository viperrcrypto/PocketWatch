"use client"

import { formatCurrency, cn } from "@/lib/utils"

interface TransactionDetail {
  id: string; name: string; merchantName: string | null; amount: number; date: string
  category: string | null; subcategory: string | null; plaidCategory: string | null
  logoUrl: string | null; website: string | null; merchantEntityId: string | null
  paymentChannel: string | null; authorizedDate: string | null; checkNumber: string | null
  transactionCode: string | null; isPending: boolean
  location: {
    address: string | null; city: string | null; region: string | null
    postalCode: string | null; country: string | null
    lat: number | null; lon: number | null; storeNumber: string | null
  } | null
  paymentMeta: Record<string, string | null> | null
  counterparties: Array<{
    name: string; type: string; logoUrl: string | null
    website: string | null; entityId: string | null; confidenceLevel: string | null
  }> | null
}

const CHANNEL_ICONS: Record<string, { icon: string; label: string }> = {
  "online": { icon: "language", label: "Online" },
  "in store": { icon: "storefront", label: "In Store" },
  "other": { icon: "more_horiz", label: "Other" },
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="py-3 border-b border-card-border/30">
      <p className="text-[10px] font-medium uppercase tracking-widest text-foreground-muted mb-2">{title}</p>
      {children}
    </div>
  )
}

interface Props {
  transaction: TransactionDetail | null
  onClose: () => void
}

export function TransactionDetailPanel({ transaction, onClose }: Props) {
  if (!transaction) return null

  const channel = CHANNEL_ICONS[transaction.paymentChannel ?? ""] ?? null
  const loc = transaction.location
  const hasLocation = loc && (loc.city || loc.region || loc.country)
  const counterparties = transaction.counterparties ?? []

  return (
    <>
      <div className="fixed inset-0 bg-black/20 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 bottom-0 w-full max-w-[400px] bg-card border-l border-card-border z-50 overflow-y-auto">
        <div className="p-5">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              {transaction.logoUrl ? (
                <img src={transaction.logoUrl} alt="" className="w-10 h-10 rounded-lg object-cover" />
              ) : (
                <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-white/5 flex items-center justify-center">
                  <span className="material-symbols-rounded text-foreground-muted" style={{ fontSize: 20 }}>receipt</span>
                </div>
              )}
              <div>
                <p className="text-base font-semibold text-foreground">{transaction.merchantName ?? transaction.name}</p>
                <p className="text-xs text-foreground-muted">{new Date(transaction.date).toLocaleDateString("en-US", { weekday: "short", month: "long", day: "numeric", year: "numeric" })}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5">
              <span className="material-symbols-rounded text-foreground-muted" style={{ fontSize: 20 }}>close</span>
            </button>
          </div>

          {/* Amount */}
          <p className={cn("font-data text-2xl font-bold tabular-nums mb-4", transaction.amount > 0 ? "text-foreground" : "text-success")}>
            {transaction.amount > 0 ? "-" : "+"}{formatCurrency(Math.abs(transaction.amount))}
          </p>

          {/* Payment Info */}
          {(channel || transaction.authorizedDate) && (
            <Section title="Payment">
              <div className="space-y-1.5">
                {channel && (
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-rounded text-foreground-muted" style={{ fontSize: 16 }}>{channel.icon}</span>
                    <span className="text-sm text-foreground">{channel.label}</span>
                  </div>
                )}
                {transaction.authorizedDate && (
                  <p className="text-xs text-foreground-muted">
                    Authorized: {new Date(transaction.authorizedDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </p>
                )}
                {transaction.isPending && (
                  <span className="px-2 py-0.5 text-[10px] font-medium bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 rounded-full">Pending</span>
                )}
              </div>
            </Section>
          )}

          {/* Merchant */}
          {transaction.website && (
            <Section title="Merchant">
              <a href={transaction.website.startsWith("http") ? transaction.website : `https://${transaction.website}`} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline">
                {transaction.website}
              </a>
            </Section>
          )}

          {/* Location */}
          {hasLocation && (
            <Section title="Location">
              <div className="flex items-start gap-2">
                <span className="material-symbols-rounded text-foreground-muted mt-0.5" style={{ fontSize: 16 }}>location_on</span>
                <div>
                  {loc!.address && <p className="text-sm text-foreground">{loc!.address}</p>}
                  <p className="text-sm text-foreground">
                    {[loc!.city, loc!.region, loc!.postalCode].filter(Boolean).join(", ")}
                    {loc!.country && loc!.country !== "US" && ` ${loc!.country}`}
                  </p>
                </div>
              </div>
            </Section>
          )}

          {/* Counterparties */}
          {counterparties.length > 0 && (
            <Section title="Counterparties">
              <div className="space-y-2">
                {counterparties.map((cp, i) => (
                  <div key={i} className="flex items-center gap-2.5">
                    {cp.logoUrl ? (
                      <img src={cp.logoUrl} alt="" className="w-6 h-6 rounded" />
                    ) : (
                      <div className="w-6 h-6 rounded bg-gray-100 dark:bg-white/5 flex items-center justify-center">
                        <span className="material-symbols-rounded text-foreground-muted" style={{ fontSize: 14 }}>business</span>
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-medium text-foreground">{cp.name}</p>
                      <p className="text-[10px] text-foreground-muted capitalize">{cp.type}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Category */}
          <Section title="Category">
            <div className="space-y-1">
              {transaction.category && <p className="text-sm text-foreground">{transaction.category}{transaction.subcategory ? ` / ${transaction.subcategory}` : ""}</p>}
              {transaction.plaidCategory && <p className="text-xs text-foreground-muted">Plaid: {transaction.plaidCategory.replace(/\|/g, " > ")}</p>}
            </div>
          </Section>

          {/* Check/Code */}
          {(transaction.checkNumber || transaction.transactionCode) && (
            <Section title="Reference">
              {transaction.checkNumber && <p className="text-sm text-foreground">Check #{transaction.checkNumber}</p>}
              {transaction.transactionCode && <p className="text-xs text-foreground-muted">Code: {transaction.transactionCode}</p>}
            </Section>
          )}
        </div>
      </div>
    </>
  )
}
