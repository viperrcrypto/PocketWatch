import { getCurrentUser } from "@/lib/auth"
import { apiError } from "@/lib/api-error"
import { db } from "@/lib/db"
import { decryptCredential } from "@/lib/finance/crypto"
import { runRebuildBatches, fetchMerchantsForRebuild, fetchMerchantsByNames } from "@/lib/finance/ai-rebuild-engine"
import { callAIProviderRaw, getProviderLabel, type AIProviderType } from "@/lib/finance/ai-providers"
import { setCache, getCached } from "@/lib/cache"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod/v4"

export const dynamic = "force-dynamic"
export const maxDuration = 300

const AI_SERVICES = ["ai_claude_cli", "ai_claude_api", "ai_openai", "ai_gemini"]

// DB-backed cancel signal — survives HMR reloads and multi-worker deployments
const SIGNAL_KEY = (userId: string) => `rebuild_signal:${userId}`

async function getSignalStatus(userId: string): Promise<"running" | "cancelled" | null> {
  const row = await db.settings.findUnique({ where: { key: SIGNAL_KEY(userId) } })
  return (row?.value as string | null) as "running" | "cancelled" | null
}

async function setSignalStatus(userId: string, status: "running" | "cancelled") {
  await db.settings.upsert({
    where: { key: SIGNAL_KEY(userId) },
    create: { key: SIGNAL_KEY(userId), value: status },
    update: { value: status },
  })
}

async function clearSignal(userId: string) {
  await db.settings.delete({ where: { key: SIGNAL_KEY(userId) } }).catch(() => {})
}

const bodySchema = z.object({
  mode: z.enum(["uncategorized", "full"]),
  dryRun: z.boolean().optional().default(false),
  retryMerchants: z.array(z.string()).optional(),
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

  const { mode, dryRun, retryMerchants } = parsed.data

  // Resolve AI provider
  const providerKey = await db.externalApiKey.findFirst({
    where: { userId: user.id, serviceName: { in: AI_SERVICES }, verified: true },
    orderBy: { updatedAt: "desc" },
  })
  const useCLI = !providerKey

  const encoder = new TextEncoder()

  // Block concurrent rebuilds
  const existingStatus = await getSignalStatus(user.id)
  if (existingStatus === "running") {
    return apiError("AIR04", "A rebuild is already in progress. Cancel it first or wait for it to finish.", 409)
  }

  await setSignalStatus(user.id, "running")

  // In-memory signal for this request's cancel checks (faster than DB polling per batch)
  const cancelSignal = { cancelled: false }

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
          { userId: user.id, mode, providerConfig, retryMerchants },
          send,
          cancelSignal
        )

        setCache(`ai-rebuild:${user.id}`, summary, 30 * 60 * 1000)
      } catch (err) {
        send("error", { message: err instanceof Error ? err.message : "Rebuild failed" })
      } finally {
        await clearSignal(user.id)
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

  // Set DB signal to cancelled — the engine checks this per batch
  await setSignalStatus(user.id, "cancelled")
  return NextResponse.json({ cancelled: true })
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
