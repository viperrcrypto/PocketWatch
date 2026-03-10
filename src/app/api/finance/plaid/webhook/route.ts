import { db } from "@/lib/db"
import { apiError } from "@/lib/api-error"
import { syncInstitution, saveFinanceSnapshot } from "@/lib/finance/sync"
import { verifyPlaidWebhook } from "@/lib/finance/webhook-verify"
import { financeRateLimiters, getClientId, rateLimitHeaders } from "@/lib/rate-limit"
import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod/v4"

const webhookBodySchema = z.object({
  webhook_type: z.string().min(1).max(100),
  webhook_code: z.string().min(1).max(100),
  item_id: z.string().min(1).max(200),
  error: z.object({
    error_code: z.string(),
    error_message: z.string(),
  }).optional(),
})

export async function POST(req: NextRequest) {
  // Rate limit webhooks
  const clientId = getClientId(req)
  const rl = financeRateLimiters.webhook(`webhook:${clientId}`)
  if (!rl.success) {
    return apiError("F1025", "Webhook rate limit exceeded", 429, undefined, rateLimitHeaders(rl))
  }

  try {
    const rawBody = await req.text()

    // Verify Plaid webhook signature (skip in development/sandbox if no key)
    const verificationHeader = req.headers.get("plaid-verification")
    if (verificationHeader) {
      const isValid = await verifyPlaidWebhook(rawBody, verificationHeader)
      if (!isValid) {
        console.warn("[finance.webhook.invalid_signature]", { ref: "F1021" })
        return apiError("F1021", "Invalid webhook signature", 401)
      }
    } else if (process.env.NODE_ENV === "production") {
      // In production, require signature
      console.warn("[finance.webhook.missing_signature]", { ref: "F1022" })
      return apiError("F1022", "Missing webhook signature", 401)
    }

    const body = JSON.parse(rawBody)
    const parsed = webhookBodySchema.safeParse(body)
    if (!parsed.success) {
      return apiError("F1023", "Invalid webhook payload", 400)
    }
    const { webhook_type, webhook_code, item_id, error } = parsed.data

    const institution = await db.financeInstitution.findFirst({
      where: { plaidItemId: item_id },
    })

    if (!institution) {
      return NextResponse.json({ received: true })
    }

    if (webhook_type === "TRANSACTIONS") {
      if (webhook_code === "SYNC_UPDATES_AVAILABLE") {
        // Trigger sync for this institution, then save snapshot
        syncInstitution(institution.id)
          .then(() => saveFinanceSnapshot(institution.userId))
          .catch(console.error)
      }
    }

    if (webhook_type === "ITEM") {
      if (webhook_code === "ERROR") {
        await db.financeInstitution.update({
          where: { id: institution.id },
          data: {
            status: "error",
            errorCode: error?.error_code ?? null,
            errorMessage: error?.error_message ?? null,
          },
        })
      }
    }

    return NextResponse.json({ received: true })
  } catch (err) {
    return apiError("F1020", "Webhook processing failed", 500, err)
  }
}
