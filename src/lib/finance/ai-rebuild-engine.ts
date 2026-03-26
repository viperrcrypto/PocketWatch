/**
 * AI Rebuild batch processing engine.
 * Chunks merchants into batches, sends to AI, persists results incrementally.
 */

import { db } from "@/lib/db"
import { invalidateCache } from "@/lib/cache"
import { cleanMerchantName, CATEGORIES, CONFIDENCE, uncategorizedWhere } from "./categorize"
import { callAIProviderRaw, type AIProviderType } from "./ai-providers"
import { buildRebuildMerchants, buildRebuildPrompt, parseRebuildResponse, type RebuildMerchant, type RebuildAIResult } from "./ai-rebuild-prompt"

const BATCH_SIZE = 50
const MAX_CUSTOM_CATEGORIES = 5

export interface RebuildParams {
  userId: string
  mode: "uncategorized" | "full"
  providerConfig: { provider: AIProviderType; apiKey: string; model: string | undefined }
}

export interface RebuildBatchResult {
  batchIndex: number
  results: Array<{ merchantName: string; category: string; subcategory: string | null; txCount: number }>
  error: string | null
}

export interface RebuildSummary {
  totalMerchants: number
  totalTxCategorized: number
  rulesCreated: number
  rulesUpdated: number
  customCategoriesCreated: number
  batchesCompleted: number
  batchesFailed: number
  durationMs: number
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
 * Run the full rebuild in batches, calling send() for SSE progress events.
 */
export async function runRebuildBatches(
  params: RebuildParams,
  send: SSESend,
  cancelSignal: { cancelled: boolean }
): Promise<RebuildSummary> {
  const start = Date.now()
  const { userId, mode, providerConfig } = params

  const { merchants, txsByMerchant } = await fetchMerchantsForRebuild(userId, mode)
  const totalBatches = Math.ceil(merchants.length / BATCH_SIZE)

  send("preview", { merchantCount: merchants.length, txCount: sumTxCount(txsByMerchant), batchCount: totalBatches })

  if (merchants.length === 0) {
    const summary: RebuildSummary = { totalMerchants: 0, totalTxCategorized: 0, rulesCreated: 0, rulesUpdated: 0, customCategoriesCreated: 0, batchesCompleted: 0, batchesFailed: 0, durationMs: Date.now() - start }
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

  for (let i = 0; i < totalBatches; i++) {
    if (cancelSignal.cancelled) {
      send("progress", { batchIndex: i, totalBatches, merchantsProcessed: i * BATCH_SIZE, totalMerchants: merchants.length, message: "Cancelled" })
      break
    }

    const batch = merchants.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE)
    send("progress", { batchIndex: i, totalBatches, merchantsProcessed: i * BATCH_SIZE, totalMerchants: merchants.length, message: `Processing batch ${i + 1}/${totalBatches}` })

    let succeeded = false
    for (let attempt = 0; attempt < 3 && !succeeded; attempt++) {
      try {
        if (attempt > 0) {
          const delayMs = 2000 * attempt
          send("progress", { batchIndex: i, totalBatches, merchantsProcessed: i * BATCH_SIZE, totalMerchants: merchants.length, message: `Retrying batch ${i + 1} (attempt ${attempt + 1})...` })
          await new Promise((r) => setTimeout(r, delayMs))
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

        for (const label of batchResults.newCustomCategories) {
          validCategories.add(label)
        }

        send("batch_complete", {
          batchIndex: i,
          results: batchResults.processedMerchants,
        })
        succeeded = true
      } catch (err) {
        if (attempt === 2) {
          batchesFailed++
          send("error", { batchIndex: i, message: err instanceof Error ? err.message : "Batch failed after 3 attempts" })
        }
      }
    }
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
    durationMs: Date.now() - start,
  }

  send("complete", { summary })
  return summary
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
          needsReview: result.confidence !== "high",
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
