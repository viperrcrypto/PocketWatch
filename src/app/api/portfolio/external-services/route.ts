import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { db } from "@/lib/db"
import { encrypt, decrypt } from "@/lib/crypto"
import { apiError } from "@/lib/api-error"
import { invalidateStakingResponseCache } from "@/app/api/portfolio/staking/route"
import { isExchangeService, fromExchangeServiceName, getExchangeById } from "@/lib/portfolio/exchanges"
import { validateExchangeCredentials } from "@/lib/portfolio/exchange-client"
import { verifyServiceKey } from "@/lib/portfolio/service-key-verifier"
import { MULTI_KEY_SERVICES } from "@/lib/portfolio/service-keys"
import {
  getStoredVerificationStatus,
  listExternalServiceRecords,
  persistExternalServiceVerification,
} from "@/lib/portfolio/external-service-verification-store"
import {
  deriveVerificationState,
  resolveExchangeVerification,
  type ExchangeVerifyResult,
} from "@/lib/portfolio/verification"

const VALID_SERVICES = [
  "zerion", "etherscan", "coingecko", "alchemy", "helius", "moralis",
  // Etherscan-compatible block explorers
  "bscscan", "arbiscan", "basescan", "polygonscan", "optimism_etherscan",
  "lineascan", "scrollscan", "zksync_explorer",
]

async function getKeyHint(apiKeyEnc: string): Promise<string> {
  try {
    const plain = await decrypt(apiKeyEnc)
    // For JSON credential blobs (exchanges), show nothing
    if (plain.startsWith("{")) return "••••"
    if (plain.length >= 5) return `•••${plain.slice(-5)}`
    return "••••"
  } catch {
    return "••••"
  }
}

/** GET /api/portfolio/external-services — list configured service keys */
export async function GET() {
  const user = await getCurrentUser()
  if (!user) return apiError("E9020", "Authentication required", 401)

  try {
    const keys = await listExternalServiceRecords(user.id)

    // Group keys by serviceName for multi-key services
    const keysByService = new Map<string, typeof keys>()
    for (const k of keys) {
      const existing = keysByService.get(k.serviceName) ?? []
      existing.push(k)
      keysByService.set(k.serviceName, existing)
    }

    const services = await Promise.all(keys.map(async (k) => {
      const exchangeId = fromExchangeServiceName(k.serviceName)
      const exchangeDef = exchangeId ? getExchangeById(exchangeId) : null
      const serviceKeys = keysByService.get(k.serviceName) ?? []
      const keyHint = await getKeyHint(k.apiKeyEnc)

      return {
        id: k.id,
        name: k.serviceName,
        label: k.label,
        api_key: keyHint,
        configured: true,
        verified: k.verified,
        verificationState: deriveVerificationState(k.verified, k.verifyError),
        verifyError: k.verifyError,
        consecutive429: k.consecutive429,
        lastUsedAt: k.lastUsedAt,
        multiKeyEnabled: MULTI_KEY_SERVICES.has(k.serviceName),
        keyCount: serviceKeys.length,
        ...(exchangeDef ? {
          isExchange: true,
          exchangeId: exchangeDef.id,
          exchangeLabel: exchangeDef.label,
          exchangeDomain: exchangeDef.domain,
        } : {}),
      }
    }))

    return NextResponse.json({ services })
  } catch (error) {
    return apiError("E9021", "Failed to load external services", 500, error)
  }
}

/** PUT /api/portfolio/external-services — save/update a service API key */
export async function PUT(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return apiError("E9022", "Authentication required", 401)

  try {
    const body = await request.json()
    const { name, api_key, api_secret, passphrase } = body

    if (!name || typeof name !== "string") {
      return apiError("E9023", "name is required", 400)
    }

    const serviceName = name.toLowerCase()
    const isExchange = isExchangeService(serviceName)

    // Validate service name
    if (!isExchange && !VALID_SERVICES.includes(serviceName)) {
      return apiError("E9024", `Invalid service. Must be one of: ${VALID_SERVICES.join(", ")} or an exchange (exchange_binance, etc.)`, 400)
    }

    if (isExchange) {
      // Exchange credentials: encrypt as JSON blob with apiKey + secret + passphrase
      if (!api_key || typeof api_key !== "string" || api_key.trim().length < 4) {
        return apiError("E9025", "api_key is required (at least 4 characters)", 400)
      }
      if (!api_secret || typeof api_secret !== "string" || api_secret.trim().length < 4) {
        return apiError("E9025", "api_secret is required for exchanges (at least 4 characters)", 400)
      }

      const exchangeId = fromExchangeServiceName(serviceName)
      const exchangeDef = exchangeId ? getExchangeById(exchangeId) : null
      if (!exchangeId || !exchangeDef) {
        return apiError("E9024", "Unknown exchange service", 400)
      }
      if (exchangeDef?.requiresPassphrase && (!passphrase || typeof passphrase !== "string")) {
        return apiError("E9025", `${exchangeDef.label} requires a passphrase`, 400)
      }

      // Normalize PEM secret: convert literal \n strings to real newlines
      let secret = api_secret.trim()
      if (secret.includes("BEGIN EC PRIVATE KEY") || secret.includes("BEGIN RSA PRIVATE KEY")) {
        secret = secret.replace(/\\n/g, "\n")
      }

      const trimmedKey = api_key.trim()
      const trimmedPassphrase = passphrase ? passphrase.trim() : undefined

      const credentialBlob = JSON.stringify({
        apiKey: trimmedKey,
        secret,
        ...(trimmedPassphrase ? { passphrase: trimmedPassphrase } : {}),
      })
      const encrypted = await encrypt(credentialBlob)

      const existing = await getStoredVerificationStatus(user.id, serviceName)

      // Validate credentials, but treat transient failures as non-blocking.
      let verifyResult: ExchangeVerifyResult
      try {
        verifyResult = await validateExchangeCredentials(exchangeId, {
          apiKey: trimmedKey,
          secret,
          ...(trimmedPassphrase ? { passphrase: trimmedPassphrase } : {}),
        })
      } catch (err) {
        verifyResult = {
          valid: false,
          code: "unknown",
          error: err instanceof Error ? err.message : "Validation failed",
        }
      }

      const resolved = resolveExchangeVerification(verifyResult, existing?.verified === true)

      console.info("[portfolio][external-services][E9026_VERIFY]", {
        serviceName,
        exchangeId,
        verifyCode: verifyResult.code,
        verificationState: resolved.responseVerificationState,
        persistedVerified: resolved.persistedVerified,
      })

      const existingExchange = await db.externalApiKey.findFirst({
        where: { userId: user.id, serviceName },
      })
      if (existingExchange) {
        await db.externalApiKey.update({
          where: { id: existingExchange.id },
          data: { apiKeyEnc: encrypted },
        })
      } else {
        await db.externalApiKey.create({
          data: { userId: user.id, serviceName, apiKeyEnc: encrypted },
        })
      }

      await persistExternalServiceVerification(
        user.id,
        serviceName,
        resolved.persistedVerified,
        resolved.persistedVerifyError,
      )

      return NextResponse.json({
        success: true,
        name: serviceName,
        isExchange: true,
        verified: resolved.responseVerified,
        verificationState: resolved.responseVerificationState,
        verifyCode: verifyResult.code,
        verifyError: resolved.responseVerifyError,
      })
    }

    // Standard service key (single api_key)
    if (!api_key || typeof api_key !== "string" || api_key.trim().length < 8) {
      return apiError("E9025", "api_key is required and must be at least 8 characters", 400)
    }

    const trimmedKey = api_key.trim()
    const encrypted = await encrypt(trimmedKey)
    const keyLabel = typeof body.label === "string" ? body.label.trim() || null : null

    // For multi-key services: check for duplicate key, then create new entry
    // For single-key services: upsert (replace existing)
    if (MULTI_KEY_SERVICES.has(serviceName)) {
      const MAX_KEYS_PER_SERVICE = 10

      // Use a transaction to prevent race-condition duplicates
      const created = await db.$transaction(async (tx) => {
        const existing = await tx.externalApiKey.findMany({
          where: { userId: user.id, serviceName },
        })

        if (existing.length >= MAX_KEYS_PER_SERVICE) {
          throw new Error(`Maximum of ${MAX_KEYS_PER_SERVICE} keys per service`)
        }

        // Dedup: check if this exact key already exists
        for (const ex of existing) {
          let decrypted: string
          try {
            decrypted = await decrypt(ex.apiKeyEnc)
          } catch {
            decrypted = ex.apiKeyEnc
          }
          if (decrypted === trimmedKey) {
            throw new Error("This API key is already added for this service")
          }
        }

        const autoLabel = keyLabel ?? `Key ${existing.length + 1}`

        return tx.externalApiKey.create({
          data: {
            userId: user.id,
            serviceName,
            apiKeyEnc: encrypted,
            label: autoLabel,
            priority: existing.length,
          },
        })
      }).catch((err) => {
        // Return the dedup/limit error as a 400 instead of 500
        if (err instanceof Error && (err.message.includes("already added") || err.message.includes("Maximum"))) {
          return { error: err.message } as const
        }
        throw err
      })

      if ("error" in created) {
        return apiError("E9025", created.error, 400)
      }

      const verifyResult = await verifyServiceKey(serviceName, trimmedKey)
      const verifyError = verifyResult.verified ? null : verifyResult.message

      await db.externalApiKey.update({
        where: { id: created.id },
        data: { verified: verifyResult.verified, verifyError },
      })

      return NextResponse.json({
        success: true,
        id: created.id,
        name: serviceName,
        label: created.label,
        verified: verifyResult.verified,
        verificationState: deriveVerificationState(verifyResult.verified, verifyError),
        verifyCode: verifyResult.code,
        verifyError,
      })
    }

    // Single-key service: find existing and update, or create new
    const existing = await db.externalApiKey.findFirst({
      where: { userId: user.id, serviceName },
    })

    if (existing) {
      await db.externalApiKey.update({
        where: { id: existing.id },
        data: { apiKeyEnc: encrypted },
      })
    } else {
      await db.externalApiKey.create({
        data: { userId: user.id, serviceName, apiKeyEnc: encrypted },
      })
    }

    const verifyResult = await verifyServiceKey(serviceName, trimmedKey)
    const verifyError = verifyResult.verified ? null : verifyResult.message

    console.info("[portfolio][external-services][E9026_VERIFY]", {
      serviceName,
      exchangeId: null,
      verifyCode: verifyResult.code,
      verificationState: deriveVerificationState(verifyResult.verified, verifyError),
      persistedVerified: verifyResult.verified,
    })

    await persistExternalServiceVerification(user.id, serviceName, verifyResult.verified, verifyError)

    return NextResponse.json({
      success: true,
      name: serviceName,
      verified: verifyResult.verified,
      verificationState: deriveVerificationState(verifyResult.verified, verifyError),
      verifyCode: verifyResult.code,
      verifyError,
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to save API key"
    return apiError("E9026", msg, 500, error)
  }
}

/** PATCH /api/portfolio/external-services — rename a service key */
export async function PATCH(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return apiError("E9040", "Authentication required", 401)

  try {
    const body = await request.json()
    const { id, label } = body

    if (!id || typeof id !== "string") {
      return apiError("E9041", "id is required", 400)
    }
    if (typeof label !== "string") {
      return apiError("E9042", "label is required", 400)
    }

    const record = await db.externalApiKey.findFirst({
      where: { id, userId: user.id },
    })
    if (!record) {
      return apiError("E9043", "Key not found", 404)
    }

    await db.externalApiKey.update({
      where: { id },
      data: { label: label.trim() || null },
    })

    return NextResponse.json({ success: true, id, label: label.trim() || null })
  } catch (error) {
    return apiError("E9044", "Failed to rename key", 500, error)
  }
}

/** DELETE /api/portfolio/external-services — remove a service key */
export async function DELETE(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return apiError("E9027", "Authentication required", 401)

  try {
    const body = await request.json()
    const { name, id } = body

    // Delete by specific key ID (multi-key)
    if (id && typeof id === "string") {
      const record = await db.externalApiKey.findFirst({
        where: { id, userId: user.id },
      })
      if (!record) {
        return apiError("E9028", "Key not found", 404)
      }
      await db.externalApiKey.delete({ where: { id } })
      // If this was the last key for an exchange, purge its cached data
      const exchangeId = record.serviceName.startsWith("exchange_") ? record.serviceName.slice(9) : null
      if (exchangeId) {
        const remaining = await db.externalApiKey.count({
          where: { userId: user.id, serviceName: record.serviceName },
        })
        if (remaining === 0) {
          await Promise.all([
            db.exchangeTransactionCache.deleteMany({ where: { userId: user.id, exchangeId } }),
            db.exchangeSyncState.deleteMany({ where: { userId: user.id, exchangeId } }),
          ])
        }
      }
      invalidateStakingResponseCache(user.id)
      return NextResponse.json({ success: true })
    }

    // Delete all keys for a service (legacy / single-key)
    if (!name || typeof name !== "string") {
      return apiError("E9028", "name or id is required", 400)
    }

    const serviceName = name.toLowerCase()
    await db.externalApiKey.deleteMany({
      where: { userId: user.id, serviceName },
    })
    // Purge exchange cached data when exchange is fully disconnected
    if (serviceName.startsWith("exchange_")) {
      const exchangeId = serviceName.slice(9)
      await Promise.all([
        db.exchangeTransactionCache.deleteMany({ where: { userId: user.id, exchangeId } }),
        db.exchangeSyncState.deleteMany({ where: { userId: user.id, exchangeId } }),
      ])
    }

    invalidateStakingResponseCache(user.id)
    return NextResponse.json({ success: true })
  } catch (error) {
    return apiError("E9029", "Failed to delete API key", 500, error)
  }
}
