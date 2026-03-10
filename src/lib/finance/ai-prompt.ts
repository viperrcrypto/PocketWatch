/**
 * AI prompt builder for financial analysis.
 * Builds a structured prompt from anonymized financial context.
 */

import type { AnonymizedFinancialContext } from "./anonymize"

export interface AIInsightsResponse {
  keyInsight: { title: string; description: string }
  savingsOpportunities: Array<{ area: string; estimatedSavings: number; description: string }>
  budgetRecommendations: Array<{ category: string; suggestedLimit: number; reason: string }>
  subscriptionReview: Array<{ name: string; verdict: "keep" | "review" | "cancel"; reason: string }>
  anomalyComments: Array<{ category: string; comment: string }>
  actionItems: Array<{ action: string; priority: "high" | "medium" | "low" }>
}

function buildRecurringSection(context: AnonymizedFinancialContext): string {
  const fmt = (s: { name: string; amount: number; frequency: string; category: string | null; isWanted: boolean }) =>
    `- ${s.name}: $${s.amount}/${s.frequency} [${s.category ?? "uncategorized"}]${s.isWanted ? "" : " (marked unwanted)"}`

  const groups = {
    subscription: context.subscriptions.filter((s) => s.billType === "subscription" || !s.billType),
    insurance: context.subscriptions.filter((s) => s.billType === "insurance"),
    cc_annual_fee: context.subscriptions.filter((s) => s.billType === "cc_annual_fee"),
    membership: context.subscriptions.filter((s) => s.billType === "membership"),
    bill: context.subscriptions.filter((s) => s.billType === "bill"),
  }

  return [
    groups.subscription.length > 0 ? `SUBSCRIPTIONS (${groups.subscription.length}):\n${groups.subscription.map(fmt).join("\n")}` : null,
    groups.insurance.length > 0 ? `INSURANCE (${groups.insurance.length}):\n${groups.insurance.map(fmt).join("\n")}` : null,
    groups.cc_annual_fee.length > 0 ? `CC ANNUAL FEES (${groups.cc_annual_fee.length}):\n${groups.cc_annual_fee.map(fmt).join("\n")}` : null,
    groups.membership.length > 0 ? `MEMBERSHIPS (${groups.membership.length}):\n${groups.membership.map(fmt).join("\n")}` : null,
    groups.bill.length > 0 ? `OTHER BILLS (${groups.bill.length}):\n${groups.bill.map(fmt).join("\n")}` : null,
  ].filter(Boolean).join("\n\n") || "No subscriptions detected."
}

export function buildFinancialAnalysisPrompt(context: AnonymizedFinancialContext): string {
  return `You are a personal finance advisor analyzing spending data for ${context.month}.
Respond ONLY with valid JSON matching the schema below. No markdown, no explanation, just JSON.

SCHEMA:
{
  "keyInsight": { "title": "string (max 60 chars)", "description": "string (max 200 chars)" },
  "savingsOpportunities": [{ "area": "string", "estimatedSavings": number, "description": "string" }],
  "budgetRecommendations": [{ "category": "string", "suggestedLimit": number, "reason": "string" }],
  "subscriptionReview": [{ "name": "string", "verdict": "keep|review|cancel", "reason": "string" }],
  "anomalyComments": [{ "category": "string", "comment": "string" }],
  "actionItems": [{ "action": "string (max 100 chars)", "priority": "high|medium|low" }]
}

FINANCIAL DATA:
- Income: $${context.totalIncome.toLocaleString()}
- Spending: $${context.totalSpending.toLocaleString()}
- Savings rate: ${context.savingsRate}%
- Health score: ${context.healthScore}/100 (${context.healthGrade})
- Daily avg spend: $${context.spendingVelocity.dailyAvg.toLocaleString()}
- Projected month-end: $${context.spendingVelocity.projectedTotal.toLocaleString()}
- MoM spending change: ${context.spendingVelocity.momChangePercent > 0 ? "+" : ""}${context.spendingVelocity.momChangePercent}%
- Days remaining: ${context.spendingVelocity.daysRemaining}
- Safe daily spend: $${context.cashFlow.safeDailySpend.toLocaleString()}

SPENDING BY CATEGORY:
${context.categoryBreakdown.slice(0, 10).map((c) => {
  const budget = c.budgetLimit != null ? ` (budget: $${c.budgetLimit}, ${c.budgetUsedPercent?.toFixed(0)}% used)` : ""
  const change = c.changePercent != null ? ` [${c.changePercent > 0 ? "+" : ""}${c.changePercent}% vs last month]` : " [new]"
  return `- ${c.category}: $${c.currentTotal}${budget}${change}`
}).join("\n")}

TOP MERCHANTS:
${context.topMerchants.map((m) => `- ${m.name}: $${m.total} (${m.count}x) [${m.category ?? "uncategorized"}]`).join("\n")}

${context.anomalies.length > 0 ? `ANOMALIES (2x+ vs last month):
${context.anomalies.map((a) => `- ${a.category}: $${a.currentAmount} vs $${a.previousAmount} (${a.multiplier}x)`).join("\n")}` : ""}

RECURRING CHARGES (${context.subscriptionSummary.activeCount} active, $${context.subscriptionSummary.monthlyTotal}/mo total, subscriptions only: $${context.subscriptionSummary.monthlySubsOnly}/mo):
${buildRecurringSection(context)}
${context.subscriptionSummary.unwantedCount > 0 ? `Unwanted subs potential savings: $${context.subscriptionSummary.potentialSavings}/mo` : ""}

COST STRUCTURE:
- Recurring: $${context.recurringVsOneTime.recurringTotal} (${context.recurringVsOneTime.fixedCostRatio}%)
- One-time: $${context.recurringVsOneTime.oneTimeTotal}

Give practical, specific advice. Reference actual category names and dollar amounts. Keep responses concise.`
}
