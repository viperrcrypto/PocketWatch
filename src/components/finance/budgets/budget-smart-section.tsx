"use client"

import { useAIInsights, useGenerateAIInsights } from "@/hooks/use-finance"
import { BudgetSmartInsights } from "./budget-smart-insights"
import { BudgetSmartBills } from "./budget-smart-bills"

interface BudgetInsight {
  type: "info" | "warning" | "success" | "danger"
  icon: string
  title: string
  description: string
}

interface BillItem {
  id: string
  merchantName: string
  amount: number
  daysUntil: number
  category: string | null
}

export function BudgetSmartSection({
  insights,
  bills,
}: {
  insights: BudgetInsight[]
  bills: BillItem[]
}) {
  const { data: aiData, isLoading: aiLoading } = useAIInsights()
  const generate = useGenerateAIInsights()

  const hasProvider = !!aiData?.hasProvider
  const aiInsights = aiData?.insights

  const hasInsights = insights.length > 0 || aiInsights || hasProvider
  const hasBills = bills.length > 0
  const hasContent = hasInsights || hasBills
  if (aiLoading || !hasContent) return null

  // Single section — full width
  if (hasInsights && !hasBills) {
    return (
      <div className="bg-card border border-card-border rounded-2xl p-6">
        <BudgetSmartInsights
          insights={insights}
          aiInsights={aiInsights}
          hasProvider={hasProvider}
          isGenerating={generate.isPending}
          onGenerate={(force) => generate.mutate(force ? { force: true } : {})}
        />
      </div>
    )
  }

  if (!hasInsights && hasBills) {
    return (
      <div className="bg-card border border-card-border rounded-2xl p-6">
        <BudgetSmartBills bills={bills} />
      </div>
    )
  }

  // Both sections — two independent cards
  return (
    <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      <div className="bg-card border border-card-border rounded-2xl p-6">
        <BudgetSmartInsights
          insights={insights}
          aiInsights={aiInsights}
          hasProvider={hasProvider}
          isGenerating={generate.isPending}
          onGenerate={(force) => generate.mutate(force ? { force: true } : {})}
        />
      </div>
      <div className="bg-card border border-card-border rounded-2xl p-6">
        <BudgetSmartBills bills={bills} />
      </div>
    </section>
  )
}
