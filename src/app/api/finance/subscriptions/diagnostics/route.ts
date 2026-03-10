import { getCurrentUser } from "@/lib/auth"
import { apiError } from "@/lib/api-error"
import { db } from "@/lib/db"
import { classifyBillType, enrichMerchantName, type BillType } from "@/lib/finance/bill-type-classifier"
import { NextResponse } from "next/server"

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return apiError("F6100", "Authentication required", 401)

  try {
    const subscriptions = await db.financeSubscription.findMany({
      where: { userId: user.id, status: { not: "dismissed" } },
      orderBy: { amount: "desc" },
    })

    // Fetch account info
    const accountIds = [...new Set(
      subscriptions.map((s) => s.accountId).filter((id): id is string => id != null)
    )]
    const accounts = accountIds.length > 0
      ? await db.financeAccount.findMany({
          where: { id: { in: accountIds } },
          select: { id: true, type: true, subtype: true, mask: true, institution: { select: { institutionName: true } } },
        })
      : []
    const accountMap = new Map(accounts.map((a) => [a.id, a]))

    // Classify each subscription
    const diagnostics = subscriptions.map((s) => {
      const acct = s.accountId ? accountMap.get(s.accountId) : null
      const { billType, reason } = classifyBillType({
        merchantName: s.merchantName,
        frequency: s.frequency,
        category: s.category,
        amount: s.amount,
        accountType: acct?.type ?? null,
        accountSubtype: acct?.subtype ?? null,
      })

      const storedBillType = s.billType as BillType | null
      const effectiveBillType = storedBillType ?? billType
      const enrichedName = enrichMerchantName(
        s.merchantName,
        acct?.institution?.institutionName ?? null,
        acct?.mask ?? null,
      )

      const acctLabel = acct
        ? `${acct.institution?.institutionName ?? "Unknown"} ••••${acct.mask ?? "????"}`
        : null

      return {
        id: s.id,
        merchantName: s.merchantName,
        enrichedName,
        billType: effectiveBillType,
        storedBillType,
        computedBillType: billType,
        classificationReason: reason,
        frequency: s.frequency,
        amount: s.amount,
        status: s.status,
        nextChargeDate: s.nextChargeDate?.toISOString().slice(0, 10) ?? null,
        accountInfo: acctLabel,
        category: s.category,
      }
    })

    // Issues detection
    const issues: Array<{ type: string; description: string; subscriptionId: string }> = []
    for (const d of diagnostics) {
      if (d.enrichedName === d.merchantName && d.billType === "cc_annual_fee") {
        issues.push({ type: "generic_name", description: `CC fee "${d.merchantName}" has no card info — missing account link`, subscriptionId: d.id })
      }
      if (!d.accountInfo && d.billType === "cc_annual_fee") {
        issues.push({ type: "missing_account", description: `CC fee "${d.merchantName}" not linked to an account`, subscriptionId: d.id })
      }
      if (d.storedBillType && d.storedBillType !== d.computedBillType) {
        issues.push({ type: "possible_misclass", description: `"${d.merchantName}" stored as ${d.storedBillType} but would compute as ${d.computedBillType}`, subscriptionId: d.id })
      }
    }

    // Summary
    const active = diagnostics.filter((d) => d.status === "active")
    const byType: Record<string, number> = {}
    for (const d of active) {
      byType[d.billType] = (byType[d.billType] ?? 0) + 1
    }

    // Categorization health (sample uncategorized)
    const uncatCount = await db.financeTransaction.count({
      where: { userId: user.id, isDuplicate: false, isExcluded: false, OR: [{ category: null }, { category: "" }, { category: "Uncategorized" }] },
    })

    return NextResponse.json({
      summary: {
        totalActive: active.length,
        totalByBillType: byType,
        issueCount: issues.length,
      },
      subscriptions: diagnostics,
      issues,
      categorization: {
        uncategorizedTransactions: uncatCount,
      },
    })
  } catch (err) {
    return apiError("F6101", "Diagnostics failed", 500, err)
  }
}
