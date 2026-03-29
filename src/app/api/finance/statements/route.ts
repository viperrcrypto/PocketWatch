import { getCurrentUser } from "@/lib/auth"
import { apiError } from "@/lib/api-error"
import { db } from "@/lib/db"
import { NextResponse, type NextRequest } from "next/server"
import { parseStatement } from "@/lib/finance/statement-parser"
import { parsePDFStatement } from "@/lib/finance/statement-pdf-parser"
import { categorizeTransaction, cleanMerchantName } from "@/lib/finance/categorize"
import { generateExternalId, assignSequences, findFuzzyDuplicates } from "@/lib/finance/statement-dedup"
import { decryptCredential } from "@/lib/finance/crypto"
import type { AIProviderType } from "@/lib/finance/ai-providers"
import type { StatementUploadResult, BankFormat, ParsedRow } from "@/lib/finance/statement-types"

export const maxDuration = 120

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const AI_SERVICES = ["ai_claude_cli", "ai_claude_api", "ai_openai", "ai_gemini"]

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return apiError("F8010", "Authentication required", 401)

  try {
    const formData = await req.formData()
    const file = formData.get("file") as File | null
    const accountId = formData.get("accountId") as string | null

    if (!file) return apiError("F8011", "No file provided", 400)
    if (!accountId) return apiError("F8012", "No accountId provided", 400)
    if (file.size > MAX_FILE_SIZE) return apiError("F8013", "File exceeds 5MB limit", 400)

    const account = await db.financeAccount.findFirst({
      where: { id: accountId, userId: user.id },
    })
    if (!account) return apiError("F8014", "Account not found", 404)

    const fileName = file.name.toLowerCase()
    const isPDF = fileName.endsWith(".pdf")
    const isCSV = fileName.endsWith(".csv")

    if (!isPDF && !isCSV) {
      return apiError("F8016", "File must be .csv or .pdf", 400)
    }

    let rows: ParsedRow[]
    let format: BankFormat
    let parseErrors: string[]

    if (isPDF) {
      const pdfResult = await parsePDFFromFile(file, user.id)
      rows = pdfResult.rows
      format = "ai_pdf"
      parseErrors = pdfResult.errors
    } else {
      const buffer = await file.arrayBuffer()
      let csvText: string
      try {
        csvText = new TextDecoder("utf-8", { fatal: true }).decode(buffer)
      } catch {
        csvText = new TextDecoder("latin1").decode(buffer)
      }
      const parsed = parseStatement(csvText)
      rows = parsed.rows
      format = parsed.format
      parseErrors = parsed.errors
    }

    if (rows.length === 0) {
      const msg = parseErrors.length > 0 ? parseErrors[0] : "No transactions found in file"
      return apiError("F8015", msg, 400)
    }

    const sequences = assignSequences(rows)
    const externalIds = rows.map((row, i) =>
      generateExternalId(accountId, row, sequences[i])
    )

    const existingIds = new Set(
      (await db.financeTransaction.findMany({
        where: { userId: user.id, externalId: { in: externalIds } },
        select: { externalId: true },
      })).map((t) => t.externalId)
    )

    const newIndices = rows
      .map((_, i) => i)
      .filter((i) => !existingIds.has(externalIds[i]))
    const newRows = newIndices.map((i) => rows[i])
    const fuzzyDupes = await findFuzzyDuplicates(user.id, accountId, newRows)

    const userRules = await db.financeCategoryRule.findMany({
      where: { userId: user.id },
      orderBy: { priority: "desc" },
    })

    let inserted = 0
    let duplicates = 0
    const skipped = externalIds.filter((id) => existingIds.has(id)).length
    const origToLocalIdx = new Map(newIndices.map((origIdx, localIdx) => [origIdx, localIdx]))

    const batchSize = 200
    for (let b = 0; b < newIndices.length; b += batchSize) {
      const batch = newIndices.slice(b, b + batchSize)
      const createData = batch.map((origIdx) => {
        const row = rows[origIdx]
        const localIdx = origToLocalIdx.get(origIdx)!
        const isFuzzyDupe = fuzzyDupes.has(localIdx)
        const cleaned = cleanMerchantName(row.name)
        const cat = categorizeTransaction({ merchantName: cleaned, rawName: row.name }, userRules)

        return {
          userId: user.id,
          accountId,
          externalId: externalIds[origIdx],
          provider: "statement" as const,
          date: row.date,
          name: row.name,
          merchantName: cleaned,
          amount: row.amount,
          currency: account.currency ?? "USD",
          category: cat.category === "Uncategorized" ? null : cat.category,
          subcategory: cat.subcategory,
          isPending: false,
          isDuplicate: isFuzzyDupe,
          checkNumber: row.checkNumber ?? null,
        }
      })

      await db.financeTransaction.createMany({ data: createData, skipDuplicates: true })
      for (const d of createData) {
        if (d.isDuplicate) duplicates++
        else inserted++
      }
    }

    if (inserted > 0) {
      const { saveFinanceSnapshot, backfillHistoricalSnapshots } = await import(
        "@/lib/finance/sync/snapshots"
      )
      await db.financeSnapshot.deleteMany({ where: { userId: user.id } })
      await saveFinanceSnapshot(user.id)
      await backfillHistoricalSnapshots(user.id)
    }

    const result: StatementUploadResult = {
      format,
      totalRows: rows.length,
      inserted,
      skipped,
      duplicates,
      errors: parseErrors.slice(0, 10),
    }

    return NextResponse.json(result)
  } catch (err) {
    return apiError("F8019", "Failed to process statement", 500, err)
  }
}

async function parsePDFFromFile(
  file: File,
  userId: string
): Promise<{ rows: ParsedRow[]; errors: string[] }> {
  const pdfParse = (await import("pdf-parse")).default
  const buffer = Buffer.from(await file.arrayBuffer())
  const { text } = await pdfParse(buffer)

  if (!text || text.trim().length < 20) {
    return { rows: [], errors: ["Could not extract text from PDF — the file may be image-only or corrupt"] }
  }

  const providerKey = await db.externalApiKey.findFirst({
    where: { userId, serviceName: { in: AI_SERVICES }, verified: true },
    orderBy: { updatedAt: "desc" },
  })

  const providerConfig = providerKey
    ? {
        provider: providerKey.serviceName as AIProviderType,
        apiKey: await decryptCredential(providerKey.apiKeyEnc),
        model: providerKey.model ?? undefined,
      }
    : {
        provider: "ai_claude_cli" as AIProviderType,
        apiKey: "enabled",
        model: undefined,
      }

  return parsePDFStatement(text, providerConfig)
}
