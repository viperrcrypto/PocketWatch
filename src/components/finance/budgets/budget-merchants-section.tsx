import { FrequentMerchants } from "@/components/finance/frequent-merchants"
import { LargestPurchases } from "@/components/finance/largest-purchases"

export function BudgetMerchantsSection({
  frequentMerchants,
  largestPurchases,
}: {
  frequentMerchants: Array<any>
  largestPurchases: Array<any>
}) {
  if (frequentMerchants.length === 0 && largestPurchases.length === 0) return null

  return (
    <>
      <div className="bg-card border border-card-border rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-card-border/50">
          <span className="text-[10px] font-medium uppercase tracking-widest text-foreground-muted">
            Frequent Merchants
          </span>
        </div>
        <FrequentMerchants merchants={frequentMerchants} />
      </div>

      <div className="bg-card border border-card-border rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-card-border/50">
          <span className="text-[10px] font-medium uppercase tracking-widest text-foreground-muted">
            Largest Purchases
          </span>
        </div>
        <LargestPurchases purchases={largestPurchases.map((p) => ({ ...p, merchantName: p.name, logoUrl: p.logoUrl }))} />
      </div>
    </>
  )
}
