/**
 * AI Rebuild batch processing engine.
 * Chunks merchants into batches, sends to AI, persists results incrementally.
 */

import { db } from "@/lib/db"
import { invalidateCache } from "@/lib/cache"
import { cleanMerchantName, CATEGORIES, CONFIDENCE, uncategorizedWhere } from "./categorize"
import { callAIProviderRaw, type AIProviderType } from "./ai-providers"
import { buildRebuildMerchants, buildRebuildPrompt, parseRebuildResponse, type RebuildMerchant, type RebuildAIResult } from "./ai-rebuild-prompt"

const BATCH_SIZE = 120
const CONCURRENCY = 2
const MAX_CUSTOM_CATEGORIES = 5

export interface RebuildParams {
  userId: string
  mode: "uncategorized" | "full"
  providerConfig: { provider: AIProviderType; apiKey: string; model: string | undefined }
  retryMerchants?: string[]
}

export interface RebuildBatchResult {
  batchIndex: number
  results: Array<{ merchantName: string; category: string; subcategory: string | null; txCount: number }>
  error: string | null
}

export interface QualityCheck {
  totalTransactions: number
  categorized: number
  uncategorized: number
  categorizedPct: number
  incomeCount: number
  incomeTotal: number
  transferCount: number
  topCategories: Array<{ category: string; count: number; total: number }>
  duplicateRules: number
  orphanedRules: number
  issues: string[]
  grade: "A" | "B" | "C" | "D" | "F"
}

export interface RebuildSummary {
  totalMerchants: number
  totalTxCategorized: number
  rulesCreated: number
  rulesUpdated: number
  customCategoriesCreated: number
  batchesCompleted: number
  batchesFailed: number
  failedMerchants: string[]
  durationMs: number
  qualityCheck?: QualityCheck
}

export type SSESend = (event: string, data: unknown) => void

/**
 * Fetch and group merchants for rebuild.
 */
export async function fetchMerchantsForRebuild(
  userId: string,
  mode: "uncategorized" | "full"
): Promise<{ merchants: RebuildMerchant[]; txsByMerchant: Map<string, string[]> }> {
  // FIX Bug 10 (audit): Use canonical uncategorizedWhere instead of duplicating logic
  const where = mode === "uncategorized"
    ? uncategorizedWhere(userId)
    : { userId, isDuplicate: false, isExcluded: false }

  const txRows = await db.financeTransaction.findMany({
    where,
    select: { id: true, merchantName: true, name: true, amount: true, category: true },
    orderBy: { date: "desc" },
    take: 5000,
  })

  // Group by cleaned name
  const txsByMerchant = new Map<string, string[]>()
  const cleanedRows: Array<{ merchantName: string | null; name: string; amount: number; category: string | null }> = []

  for (const tx of txRows) {
    const cleaned = cleanMerchantName(tx.merchantName ?? tx.name)
    const ids = txsByMerchant.get(cleaned) ?? []
    ids.push(tx.id)
    txsByMerchant.set(cleaned, ids)
    cleanedRows.push({ merchantName: cleaned, name: tx.name, amount: tx.amount, category: tx.category })
  }

  const merchants = buildRebuildMerchants(cleanedRows)
  return { merchants, txsByMerchant }
}

/**
 * Fetch merchants by specific names (for retrying failed batches).
 * Queries regardless of current category — failed merchants may have been
 * partially categorized by rules from successful batches.
 */
export async function fetchMerchantsByNames(
  userId: string,
  merchantNames: string[]
): Promise<{ merchants: RebuildMerchant[]; txsByMerchant: Map<string, string[]> }> {
  const namesLower = new Set(merchantNames.map((n) => n.toLowerCase()))

  const txRows = await db.financeTransaction.findMany({
    where: { userId, isDuplicate: false, isExcluded: false },
    select: { id: true, merchantName: true, name: true, amount: true, category: true },
    orderBy: { date: "desc" },
    take: 5000,
  })

  const txsByMerchant = new Map<string, string[]>()
  const cleanedRows: Array<{ merchantName: string | null; name: string; amount: number; category: string | null }> = []

  for (const tx of txRows) {
    const cleaned = cleanMerchantName(tx.merchantName ?? tx.name)
    if (!namesLower.has(cleaned.toLowerCase())) continue
    const ids = txsByMerchant.get(cleaned) ?? []
    ids.push(tx.id)
    txsByMerchant.set(cleaned, ids)
    cleanedRows.push({ merchantName: cleaned, name: tx.name, amount: tx.amount, category: tx.category })
  }

  const merchants = buildRebuildMerchants(cleanedRows)
  return { merchants, txsByMerchant }
}

/**
 * Run the full rebuild in batches, calling send() for SSE progress events.
 */
export async function runRebuildBatches(
  params: RebuildParams,
  send: SSESend,
  cancelSignal: { cancelled: boolean }
): Promise<RebuildSummary> {
  const start = Date.now()
  const { userId, mode, providerConfig, retryMerchants } = params

  const { merchants, txsByMerchant } = retryMerchants?.length
    ? await fetchMerchantsByNames(userId, retryMerchants)
    : await fetchMerchantsForRebuild(userId, mode)
  const totalBatches = Math.ceil(merchants.length / BATCH_SIZE)

  send("preview", { merchantCount: merchants.length, txCount: sumTxCount(txsByMerchant), batchCount: totalBatches })

  if (merchants.length === 0) {
    const summary: RebuildSummary = { totalMerchants: 0, totalTxCategorized: 0, rulesCreated: 0, rulesUpdated: 0, customCategoriesCreated: 0, batchesCompleted: 0, batchesFailed: 0, failedMerchants: [], durationMs: Date.now() - start }
    send("complete", { summary })
    return summary
  }

  // Load context for prompt
  const [existingRules, customCategories] = await Promise.all([
    db.financeCategoryRule.findMany({ where: { userId }, select: { matchValue: true, category: true }, take: 50 }),
    db.financeCustomCategory.findMany({ where: { userId }, select: { label: true } }),
  ])

  const validCategories = new Set([...Object.keys(CATEGORIES), ...customCategories.map((c) => c.label)])
  const customBudget = { remaining: MAX_CUSTOM_CATEGORIES }
  let totalTxCategorized = 0
  let rulesCreated = 0
  let rulesUpdated = 0
  let customCategoriesCreated = 0
  let batchesCompleted = 0
  let batchesFailed = 0
  const failedMerchants: string[] = []

  // Process batches with concurrency limit
  let merchantsProcessed = 0

  async function processBatch(i: number) {
    if (cancelSignal.cancelled) return

    const batch = merchants.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE)
    send("progress", { batchIndex: i, totalBatches, merchantsProcessed, totalMerchants: merchants.length, message: `Processing batch ${i + 1}/${totalBatches}` })

    let succeeded = false
    for (let attempt = 0; attempt < 2 && !succeeded; attempt++) {
      try {
        if (attempt > 0) {
          send("progress", { batchIndex: i, totalBatches, merchantsProcessed, totalMerchants: merchants.length, message: `Retrying batch ${i + 1}...` })
          await new Promise((r) => setTimeout(r, 2_000))
        }

        const prompt = buildRebuildPrompt(batch, customCategories.map((c) => c.label), existingRules, mode)
        const rawResponse = await callAIProviderRaw(providerConfig, prompt)
        const results = parseRebuildResponse(rawResponse)

        const batchResults = await persistBatchResults(userId, results, txsByMerchant, validCategories, customBudget)

        totalTxCategorized += batchResults.txCategorized
        rulesCreated += batchResults.rulesCreated
        rulesUpdated += batchResults.rulesUpdated
        customCategoriesCreated += batchResults.newCustomCategories.length
        customBudget.remaining -= batchResults.newCustomCategories.length
        batchesCompleted++
        merchantsProcessed += batch.length

        for (const label of batchResults.newCustomCategories) {
          validCategories.add(label)
        }

        send("batch_complete", {
          batchIndex: i,
          results: batchResults.processedMerchants,
        })
        succeeded = true
      } catch (err) {
        if (attempt === 1) {
          batchesFailed++
          merchantsProcessed += batch.length
          failedMerchants.push(...batch.map((m) => m.name))
          console.error(`[ai-rebuild] Batch ${i} failed:`, err instanceof Error ? err.message : err)
          send("error", { batchIndex: i, message: err instanceof Error ? err.message : "Batch failed" })
        }
      }
    }
  }

  // Run batches with concurrency limit — check DB cancel signal every 3 batches
  for (let i = 0; i < totalBatches; i += CONCURRENCY) {
    if (cancelSignal.cancelled) break
    // Check DB cancel signal periodically (every 3rd iteration to avoid DB spam)
    if (i > 0 && i % (CONCURRENCY * 3) === 0) {
      const dbSignal = await db.settings.findUnique({ where: { key: `rebuild_signal:${userId}` }, select: { value: true } })
      if (dbSignal?.value === "cancelled") { cancelSignal.cancelled = true; break }
    }
    const chunk = Array.from({ length: Math.min(CONCURRENCY, totalBatches - i) }, (_, k) => i + k)
    await Promise.allSettled(chunk.map((idx) => processBatch(idx)))
  }

  // Invalidate caches
  invalidateCache(`deep-insights:${userId}`)
  invalidateCache(`budget-suggest:${userId}`)
  invalidateCache(`budget-ai:${userId}`)

  const summary: RebuildSummary = {
    totalMerchants: merchants.length,
    totalTxCategorized,
    rulesCreated,
    rulesUpdated,
    customCategoriesCreated,
    batchesCompleted,
    batchesFailed,
    failedMerchants,
    durationMs: Date.now() - start,
  }

  // Post-rebuild quality check
  send("progress", { batchIndex: totalBatches, totalBatches, merchantsProcessed, totalMerchants: merchants.length, message: "Running quality check..." })
  const qualityCheck = await runQualityCheck(userId)
  summary.qualityCheck = qualityCheck
  send("quality_check", { qualityCheck })

  send("complete", { summary })
  return summary
}

// ─── Post-Rebuild Quality Check ─────────────────────────────────

async function runQualityCheck(userId: string): Promise<QualityCheck> {
  const issues: string[] = []

  // Count categorized vs uncategorized
  const [total, uncategorized] = await Promise.all([
    db.financeTransaction.count({ where: { userId, isDuplicate: false, isExcluded: false } }),
    db.financeTransaction.count({ where: { userId, isDuplicate: false, isExcluded: false, OR: [{ category: null }, { category: "Uncategorized" }] } }),
  ])
  const categorized = total - uncategorized
  const categorizedPct = total > 0 ? Math.round((categorized / total) * 100) : 0

  if (categorizedPct < 90) issues.push(`Only ${categorizedPct}% categorized (target: 95%+)`)
  if (uncategorized > 50) issues.push(`${uncategorized} transactions still uncategorized`)

  // Check income classification
  const [incomeAgg, transferAgg] = await Promise.all([
    db.financeTransaction.aggregate({ where: { userId, isDuplicate: false, isExcluded: false, category: "Income" }, _count: true, _sum: { amount: true } }),
    db.financeTransaction.aggregate({ where: { userId, isDuplicate: false, isExcluded: false, category: "Transfer" }, _count: true, _sum: { amount: true } }),
  ])

  const incomeCount = incomeAgg._count
  const incomeTotal = Math.abs(incomeAgg._sum.amount ?? 0)
  const transferCount = transferAgg._count

  if (incomeCount === 0) issues.push("No income transactions found — payroll may be miscategorized")
  if (incomeTotal < 500 && total > 100) issues.push(`Income total is only $${incomeTotal.toFixed(2)} — suspiciously low`)

  // Top categories
  const catGroups = await db.financeTransaction.groupBy({
    by: ["category"],
    where: { userId, isDuplicate: false, category: { not: null } },
    _count: { _all: true },
    _sum: { amount: true },
    orderBy: { _sum: { amount: "desc" } },
    take: 8,
  })
  const topCategories = catGroups.map((g) => ({
    category: g.category ?? "Unknown",
    count: g._count._all,
    total: Math.round((g._sum?.amount ?? 0) * 100) / 100,
  }))

  // Check for duplicate rules (same matchValue)
  const rules = await db.financeCategoryRule.findMany({
    where: { userId },
    select: { matchValue: true },
  })
  const ruleValues = rules.map((r) => r.matchValue.toLowerCase())
  const duplicateRules = ruleValues.length - new Set(ruleValues).size

  if (duplicateRules > 10) issues.push(`${duplicateRules} duplicate categorization rules`)

  // Check for orphaned rules (rules for categories that don't exist)
  const validCats = new Set(Object.keys(CATEGORIES))
  const customCats = await db.financeCustomCategory.findMany({ where: { userId }, select: { label: true } })
  for (const c of customCats) validCats.add(c.label)
  const allRules = await db.financeCategoryRule.findMany({ where: { userId }, select: { category: true } })
  const orphanedRules = allRules.filter((r) => !validCats.has(r.category)).length

  if (orphanedRules > 5) issues.push(`${orphanedRules} rules point to non-existent categories`)

  // Grade
  let grade: QualityCheck["grade"] = "A"
  if (categorizedPct < 70 || incomeCount === 0) grade = "F"
  else if (categorizedPct < 80 || issues.length >= 4) grade = "D"
  else if (categorizedPct < 90 || issues.length >= 2) grade = "C"
  else if (categorizedPct < 95 || issues.length >= 1) grade = "B"

  return {
    totalTransactions: total,
    categorized,
    uncategorized,
    categorizedPct,
    incomeCount,
    incomeTotal: Math.round(incomeTotal * 100) / 100,
    transferCount,
    topCategories,
    duplicateRules,
    orphanedRules,
    issues,
    grade,
  }
}

// ─── Internal ──────────────────────────────────────────────────

async function persistBatchResults(
  userId: string,
  results: RebuildAIResult[],
  txsByMerchant: Map<string, string[]>,
  validCategories: Set<string>,
  customBudget: { remaining: number }
): Promise<{
  txCategorized: number
  rulesCreated: number
  rulesUpdated: number
  newCustomCategories: string[]
  processedMerchants: Array<{ merchantName: string; category: string; subcategory: string | null; txCount: number }>
}> {
  let txCategorized = 0
  let rulesCreated = 0
  let rulesUpdated = 0
  const newCustomCategories: string[] = []
  const processedMerchants: Array<{ merchantName: string; category: string; subcategory: string | null; txCount: number }> = []

  await db.$transaction(async (prisma) => {
    for (const result of results) {
      let { category } = result

      // Handle new custom categories — track outside transaction to avoid
      // stale budget counter if the transaction rolls back
      if (result.isNewCategory && !validCategories.has(category)) {
        if (customBudget.remaining > 0) {
          await prisma.financeCustomCategory.upsert({
            where: { userId_label: { userId, label: category } },
            create: { userId, label: category, icon: "label", hex: "#78716c" },
            update: {},
          })
          newCustomCategories.push(category)
        } else {
          category = "Uncategorized"
        }
      } else if (!validCategories.has(category)) {
        continue // Skip invalid categories
      }

      if (category === "Uncategorized") continue

      // Find matching transaction IDs
      const exactIds = txsByMerchant.get(result.merchantName)
      const lowerKey = [...txsByMerchant.keys()].find((k) => k.toLowerCase() === result.merchantName.toLowerCase())
      const ids = exactIds ?? (lowerKey ? txsByMerchant.get(lowerKey) ?? [] : [])

      if (ids.length === 0) continue

      // Update transactions
      await prisma.financeTransaction.updateMany({
        where: { id: { in: ids }, userId },
        data: {
          category,
          subcategory: result.subcategory,
          isAutoApplied: true,
          needsReview: result.confidence === "low",
        },
      })
      txCategorized += ids.length

      // Upsert rule
      const cleaned = cleanMerchantName(result.merchantName)
      if (cleaned.length > 1) {
        const existing = await prisma.financeCategoryRule.findFirst({
          where: { userId, matchType: "contains", matchValue: cleaned },
        })
        if (existing) {
          await prisma.financeCategoryRule.update({
            where: { id: existing.id },
            data: { category, subcategory: result.subcategory, source: "ai_rebuild", lastUsedAt: new Date() },
          })
          rulesUpdated++
        } else {
          await prisma.financeCategoryRule.create({
            data: {
              userId,
              matchType: "contains",
              matchValue: cleaned,
              category,
              subcategory: result.subcategory,
              priority: 10,
              confidence: CONFIDENCE.INITIAL_AI,
              source: "ai_rebuild",
            },
          })
          rulesCreated++
        }
      }

      processedMerchants.push({ merchantName: result.merchantName, category, subcategory: result.subcategory, txCount: ids.length })
    }
  })

  return { txCategorized, rulesCreated, rulesUpdated, newCustomCategories, processedMerchants }
}

function sumTxCount(map: Map<string, string[]>): number {
  let total = 0
  for (const ids of map.values()) total += ids.length
  return total
}
