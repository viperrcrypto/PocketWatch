import { getCurrentUser } from "@/lib/auth"
import { apiError } from "@/lib/api-error"
import { db } from "@/lib/db"
import { decryptCredential } from "@/lib/finance/crypto"
import { runRebuildBatches, fetchMerchantsForRebuild } from "@/lib/finance/ai-rebuild-engine"
import { callAIProviderRaw, getProviderLabel, type AIProviderType } from "@/lib/finance/ai-providers"
import { setCache, getCached } from "@/lib/cache"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod/v4"

export const dynamic = "force-dynamic"
export const maxDuration = 300

const AI_SERVICES = ["ai_claude_cli", "ai_claude_api", "ai_openai", "ai_gemini"]

// Cancel signal store
const g = globalThis as unknown as { __rebuildSignals?: Map<string, { cancelled: boolean }> }
if (!g.__rebuildSignals) g.__rebuildSignals = new Map()
const rebuildSignals = g.__rebuildSignals

const bodySchema = z.object({
  mode: z.enum(["uncategorized", "full"]),
  dryRun: z.boolean().optional().default(false),
})

/**
 * POST /api/finance/transactions/ai-rebuild — SSE stream
 */
export async function POST(req: NextRequest): Promise<Response> {
  const user = await getCurrentUser()
  if (!user) return apiError("F9300", "Authentication required", 401) as unknown as Response

  const body = await req.json()
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return apiError("F9301", parsed.error.issues[0]?.message ?? "Invalid request", 400) as unknown as Response
  }

  const { mode, dryRun } = parsed.data

  // Resolve AI provider
  const providerKey = await db.externalApiKey.findFirst({
    where: { userId: user.id, serviceName: { in: AI_SERVICES }, verified: true },
    orderBy: { updatedAt: "desc" },
  })
  const useCLI = !providerKey

  const encoder = new TextEncoder()
  // Cancel any existing rebuild for this user before starting a new one
  const existingSignal = rebuildSignals.get(user.id)
  if (existingSignal) existingSignal.cancelled = true

  const cancelSignal = { cancelled: false }
  rebuildSignals.set(user.id, cancelSignal)

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
        } catch { /* stream closed */ }
      }

      try {
        if (dryRun) {
          const { merchants, txsByMerchant } = await fetchMerchantsForRebuild(user.id, mode)
          let txCount = 0
          for (const ids of txsByMerchant.values()) txCount += ids.length
          send("preview", { merchantCount: merchants.length, txCount, batchCount: Math.ceil(merchants.length / 120) })
          controller.close()
          return
        }

        const providerConfig = useCLI
          ? { provider: "ai_claude_cli" as AIProviderType, apiKey: "enabled", model: undefined }
          : { provider: providerKey.serviceName as AIProviderType, apiKey: await decryptCredential(providerKey.apiKeyEnc), model: providerKey.model ?? undefined }

        const summary = await runRebuildBatches(
          { userId: user.id, mode, providerConfig },
          send,
          cancelSignal
        )

        setCache(`ai-rebuild:${user.id}`, summary, 30 * 60 * 1000)
      } catch (err) {
        send("error", { message: err instanceof Error ? err.message : "Rebuild failed" })
      } finally {
        rebuildSignals.delete(user.id)
        try { controller.close() } catch { /* already closed */ }
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  })
}

/**
 * DELETE /api/finance/transactions/ai-rebuild — cancel in-progress rebuild
 */
export async function DELETE() {
  const user = await getCurrentUser()
  if (!user) return apiError("F9310", "Authentication required", 401)

  const signal = rebuildSignals.get(user.id)
  if (signal) {
    signal.cancelled = true
    return NextResponse.json({ cancelled: true })
  }

  return NextResponse.json({ cancelled: false, message: "No rebuild in progress" })
}

/**
 * GET /api/finance/transactions/ai-rebuild — get cached rebuild summary
 */
export async function GET() {
  const user = await getCurrentUser()
  if (!user) return apiError("F9320", "Authentication required", 401)

  const cached = getCached<unknown>(`ai-rebuild:${user.id}`)
  return NextResponse.json({ summary: cached ?? null })
}
