import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { apiError } from "@/lib/api-error"
import { checkTokenSecurity, checkAddressSecurity } from "@/lib/investigate/sources/goplus"

export const maxDuration = 30

const MAX_TOKENS_PER_REQUEST = 20

interface SpamCheckRequest {
  tokens: Array<{
    contract: string
    counterparty?: string
  }>
}

interface SpamResult {
  isSpam: boolean
  score: number
  reasons: string[]
}

/** POST /api/portfolio/history/spam-check */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return apiError("E9100", "Authentication required", 401)

  let body: SpamCheckRequest
  try {
    body = await request.json()
  } catch {
    return apiError("E9101", "Invalid JSON body", 400)
  }

  if (!body.tokens || !Array.isArray(body.tokens)) {
    return apiError("E9102", "Missing tokens array", 400)
  }

  if (body.tokens.length > MAX_TOKENS_PER_REQUEST) {
    return apiError("E9103", `Max ${MAX_TOKENS_PER_REQUEST} tokens per request`, 400)
  }

  // Deduplicate contracts and counterparties
  const uniqueContracts = new Set<string>()
  const uniqueCounterparties = new Set<string>()

  for (const token of body.tokens) {
    if (token.contract) uniqueContracts.add(token.contract.toLowerCase())
    if (token.counterparty) uniqueCounterparties.add(token.counterparty.toLowerCase())
  }

  // Fetch all GoPlus data in parallel
  const [tokenResults, addressResults] = await Promise.all([
    Promise.all(
      [...uniqueContracts].map(async (contract) => {
        const result = await checkTokenSecurity(contract)
        return [contract, result] as const
      })
    ),
    Promise.all(
      [...uniqueCounterparties].map(async (addr) => {
        const result = await checkAddressSecurity(addr)
        return [addr, result] as const
      })
    ),
  ])

  const tokenMap = new Map(tokenResults)
  const addressMap = new Map(addressResults)

  // Build results keyed by contract address
  const results: Record<string, SpamResult> = {}

  for (const contract of uniqueContracts) {
    const tokenData = tokenMap.get(contract)
    let score = 0
    const reasons: string[] = []

    if (tokenData && !tokenData.error) {
      if (tokenData.isHoneypot) {
        score += 60
        reasons.push("Honeypot token")
      }
      if (tokenData.sellTax !== null && tokenData.sellTax > 0.1) {
        score += 30
        reasons.push(`High sell tax: ${(tokenData.sellTax * 100).toFixed(1)}%`)
      }
      if (!tokenData.isOpenSource && (tokenData.holderCount === null || tokenData.holderCount < 100)) {
        score += 25
        reasons.push("Unverified contract with few holders")
      }
      if (tokenData.ownerChangeBalance) {
        score += 20
        reasons.push("Owner can modify balances")
      }
      if (tokenData.cannotSellAll) {
        score += 25
        reasons.push("Cannot sell all tokens")
      }
      if (tokenData.hiddenOwner) {
        score += 15
        reasons.push("Hidden owner")
      }
    }

    results[contract] = {
      isSpam: score >= 50,
      score: Math.min(100, score),
      reasons,
    }
  }

  // Enrich results with counterparty data
  for (const token of body.tokens) {
    if (!token.counterparty) continue
    const addr = token.counterparty.toLowerCase()
    const contract = token.contract.toLowerCase()
    const addrData = addressMap.get(addr)

    if (addrData && !addrData.error && results[contract]) {
      const entry = results[contract]
      if (addrData.isBlacklisted || addrData.isPhishing) {
        const bonus = 50
        const reason = addrData.isPhishing ? "Counterparty flagged as phishing" : "Counterparty blacklisted"
        if (!entry.reasons.includes(reason)) {
          entry.reasons.push(reason)
          entry.score = Math.min(100, entry.score + bonus)
          entry.isSpam = entry.score >= 50
        }
      }
      if (addrData.isMalicious) {
        const reason = "Counterparty flagged as malicious"
        if (!entry.reasons.includes(reason)) {
          entry.reasons.push(reason)
          entry.score = Math.min(100, entry.score + 40)
          entry.isSpam = entry.score >= 50
        }
      }
    }
  }

  return NextResponse.json({ results })
}
