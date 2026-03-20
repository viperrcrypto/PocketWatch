import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { db } from "@/lib/db"
import { apiError } from "@/lib/api-error"
import { isExchangeService, fromExchangeServiceName } from "@/lib/portfolio/exchanges"
import { getExchangeCredentials } from "@/lib/portfolio/service-keys"
import { validateExchangeCredentials } from "@/lib/portfolio/exchange-client"
import { decrypt } from "@/lib/crypto"
import { verifyServiceKey } from "@/lib/portfolio/service-key-verifier"
import {
  getStoredVerificationStatus,
  persistExternalServiceVerification,
} from "@/lib/portfolio/external-service-verification-store"
import {
  deriveVerificationState,
  resolveExchangeVerification,
  type ExchangeVerifyResult,
} from "@/lib/portfolio/verification"

const STANDARD_SERVICES = new Set(["zerion", "etherscan", "coingecko", "alchemy", "helius", "moralis"])

/** POST /api/portfolio/external-services/verify — re-verify exchange credentials */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return apiError("E9040", "Authentication required", 401)

  try {
    const body = await request.json()
    const { name } = body

    if (!name || typeof name !== "string") {
      return apiError("E9041", "name is required", 400)
    }

    const serviceName = name.toLowerCase()
    if (isExchangeService(serviceName)) {
      const exchangeId = fromExchangeServiceName(serviceName)
      if (!exchangeId) {
        return apiError("E9043", "Unknown exchange", 400)
      }

      const existing = await getStoredVerificationStatus(user.id, serviceName)
      if (!existing) {
        return apiError("E9044", "No credentials found for this exchange", 404)
      }

      const credentials = await getExchangeCredentials(user.id, exchangeId)
      if (!credentials) {
        return apiError("E9044", "No credentials found for this exchange", 404)
      }

      let verifyResult: ExchangeVerifyResult
      try {
        verifyResult = await validateExchangeCredentials(exchangeId, credentials)
      } catch (err) {
        verifyResult = {
          valid: false,
          code: "unknown",
          error: err instanceof Error ? err.message : "Validation failed",
        }
      }

      const resolved = resolveExchangeVerification(verifyResult, existing.verified === true)

      console.info("[portfolio][external-services-verify][E9045_VERIFY]", {
        serviceName,
        exchangeId,
        verifyCode: verifyResult.code,
        verificationState: resolved.responseVerificationState,
        persistedVerified: resolved.persistedVerified,
      })

      await persistExternalServiceVerification(
        user.id,
        serviceName,
        resolved.persistedVerified,
        resolved.persistedVerifyError,
      )

      return NextResponse.json({
        success: true,
        serviceName,
        isExchange: true,
        verified: resolved.responseVerified,
        verificationState: resolved.responseVerificationState,
        verifyCode: verifyResult.code,
        verifyError: resolved.responseVerifyError,
      })
    }

    if (!STANDARD_SERVICES.has(serviceName)) {
      return apiError("E9042", "Unsupported service verification target", 400)
    }

    // For multi-key services, verify a specific key by ID if provided
    const keyId = body.id as string | undefined
    const keyRecord = keyId
      ? await db.externalApiKey.findFirst({
          where: { id: keyId, userId: user.id, serviceName },
          select: { id: true, apiKeyEnc: true },
        })
      : await db.externalApiKey.findFirst({
          where: { userId: user.id, serviceName },
          orderBy: { createdAt: "asc" },
          select: { id: true, apiKeyEnc: true },
        })
    if (!keyRecord) {
      return apiError("E9044", "No API key found for this service", 404)
    }

    let decryptedKey: string
    try {
      decryptedKey = await decrypt(keyRecord.apiKeyEnc)
    } catch {
      // Backward compatibility for historical plaintext rows.
      decryptedKey = keyRecord.apiKeyEnc
    }
    const verifyResult = await verifyServiceKey(serviceName, decryptedKey)
    const verifyError = verifyResult.verified ? null : verifyResult.message

    console.info("[portfolio][external-services-verify][E9045_VERIFY]", {
      serviceName,
      exchangeId: null,
      verifyCode: verifyResult.code,
      verificationState: deriveVerificationState(verifyResult.verified, verifyError),
      persistedVerified: verifyResult.verified,
    })

    // Update the specific key record directly
    await db.externalApiKey.update({
      where: { id: keyRecord.id },
      data: { verified: verifyResult.verified, verifyError },
    })

    return NextResponse.json({
      success: true,
      id: keyRecord.id,
      serviceName,
      isExchange: false,
      verified: verifyResult.verified,
      verificationState: deriveVerificationState(verifyResult.verified, verifyError),
      verifyCode: verifyResult.code,
      verifyError,
      disabledChains: verifyResult.disabledChains ?? [],
    })
  } catch (error) {
    return apiError("E9045", "Failed to verify external service credentials", 500, error)
  }
}
