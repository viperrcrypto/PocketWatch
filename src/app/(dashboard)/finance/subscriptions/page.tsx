"use client"

import { BudgetSubscriptionsSection } from "@/components/finance/budgets/budget-subscriptions-section"

export default function SubscriptionsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Subscriptions</h1>
        <p className="text-sm text-foreground-muted mt-0.5">
          Every recurring charge — which card it&rsquo;s on, what it costs, and how to cancel.
        </p>
      </div>
      <BudgetSubscriptionsSection />
    </div>
  )
}
