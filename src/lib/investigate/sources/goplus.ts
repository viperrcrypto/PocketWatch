/**
 * GoPlus Security API Integration
 * Free public API for address, token, and URL security scanning
 * No API key required
 *
 * Documentation: https://docs.gopluslabs.io/
 */

import { getCached, setCache } from "@/lib/cache"

const GOPLUS_API_BASE = "https://api.gopluslabs.io/api/v1"
const CACHE_TTL = 30 * 60 * 1000 // 30 minutes

// Chain IDs for GoPlus
const CHAIN_IDS = {
  ethereum: "1",
  bsc: "56",
  polygon: "137",
  arbitrum: "42161",
  optimism: "10",
  avalanche: "43114",
  base: "8453",
  fantom: "250",
} as const

type ChainName = keyof typeof CHAIN_IDS

export interface GoPlusAddressSecurity {
  isBlacklisted: boolean
  isPhishing: boolean
  isMalicious: boolean
  isContract: boolean
  isMixerContract: boolean
  contractCreator: string | null
  contractOwner: string | null
  riskItems: string[]
  error?: string
}

export interface GoPlusTokenSecurity {
  tokenAddress: string
  tokenName: string | null
  tokenSymbol: string | null
  isHoneypot: boolean
  buyTax: number | null
  sellTax: number | null
  isOpenSource: boolean
  isProxy: boolean
  isMintable: boolean
  canTakeBackOwnership: boolean
  ownerChangeBalance: boolean
  hiddenOwner: boolean
  selfDestruct: boolean
  externalCall: boolean
  isAntiWhale: boolean
  antiWhaleModifiable: boolean
  tradingCooldown: boolean
  personalSlippageModifiable: boolean
  blacklistFunction: boolean
  whitelistFunction: boolean
  cannotBuy: boolean
  cannotSellAll: boolean
  holderCount: number | null
  lpHolderCount: number | null
  totalSupply: string | null
  riskItems: string[]
  error?: string
}

export interface GoPlusUrlSecurity {
  url: string
  isPhishing: boolean
  isWebsiteMalicious: boolean
  riskItems: string[]
  error?: string
}

export interface GoPlusSecurityResult {
  address?: GoPlusAddressSecurity
  token?: GoPlusTokenSecurity
  url?: GoPlusUrlSecurity
  overallRisk: "safe" | "low" | "medium" | "high" | "critical"
  riskScore: number // 0-100, higher = more risk
  allRiskItems: string[]
}

/**
 * Check address security on GoPlus
 */
export async function checkAddressSecurity(
  address: string,
  chain: ChainName = "ethereum"
): Promise<GoPlusAddressSecurity> {
  const cacheKey = `goplus:address:${chain}:${address.toLowerCase()}`
  const cached = getCached<GoPlusAddressSecurity>(cacheKey)
  if (cached) return cached

  try {
    const chainId = CHAIN_IDS[chain]
    const response = await fetch(
      `${GOPLUS_API_BASE}/address_security/${chainId}?address=${address.toLowerCase()}`,
      {
        headers: { Accept: "application/json" },
        next: { revalidate: 1800 },
      }
    )

    if (!response.ok) {
      throw new Error(`GoPlus API error: ${response.status}`)
    }

    const data = await response.json()

    if (data.code !== 1 || !data.result) {
      return {
        isBlacklisted: false,
        isPhishing: false,
        isMalicious: false,
        isContract: false,
        isMixerContract: false,
        contractCreator: null,
        contractOwner: null,
        riskItems: [],
        error: data.message || "No data available",
      }
    }

    const result = data.result
    const riskItems: string[] = []

    // Analyze risk flags
    if (result.blacklist_doubt === "1") {
      riskItems.push("Address appears on blacklist")
    }
    if (result.honeypot_related_address === "1") {
      riskItems.push("Associated with honeypot contracts")
    }
    if (result.phishing_activities === "1") {
      riskItems.push("Associated with phishing activities")
    }
    if (result.stealing_attack === "1") {
      riskItems.push("Associated with stealing attacks")
    }
    if (result.mixer === "1") {
      riskItems.push("Associated with mixing services")
    }
    if (result.fake_kyc === "1") {
      riskItems.push("Fake KYC detected")
    }
    if (result.malicious_mining_activities === "1") {
      riskItems.push("Malicious mining activities detected")
    }
    if (result.darkweb_transactions === "1") {
      riskItems.push("Darkweb transaction history")
    }
    if (result.cybercrime === "1") {
      riskItems.push("Cybercrime association")
    }
    if (result.money_laundering === "1") {
      riskItems.push("Money laundering association")
    }
    if (result.financial_crime === "1") {
      riskItems.push("Financial crime association")
    }
    if (result.sanctioned === "1") {
      riskItems.push("Address is sanctioned")
    }

    const securityResult: GoPlusAddressSecurity = {
      isBlacklisted: result.blacklist_doubt === "1",
      isPhishing: result.phishing_activities === "1",
      isMalicious:
        result.stealing_attack === "1" ||
        result.cybercrime === "1" ||
        result.malicious_mining_activities === "1",
      isContract: result.contract_address === "1",
      isMixerContract: result.mixer === "1",
      contractCreator: result.contract_creator || null,
      contractOwner: result.contract_owner || null,
      riskItems,
    }

    setCache(cacheKey, securityResult, CACHE_TTL)
    return securityResult
  } catch (error) {
    console.error("[GoPlus] Address security check error:", error)
    return {
      isBlacklisted: false,
      isPhishing: false,
      isMalicious: false,
      isContract: false,
      isMixerContract: false,
      contractCreator: null,
      contractOwner: null,
      riskItems: [],
      error: "Failed to check address security",
    }
  }
}

/**
 * Check token security on GoPlus
 */
export async function checkTokenSecurity(
  contractAddress: string,
  chain: ChainName = "ethereum"
): Promise<GoPlusTokenSecurity> {
  const cacheKey = `goplus:token:${chain}:${contractAddress.toLowerCase()}`
  const cached = getCached<GoPlusTokenSecurity>(cacheKey)
  if (cached) return cached

  try {
    const chainId = CHAIN_IDS[chain]
    const response = await fetch(
      `${GOPLUS_API_BASE}/token_security/${chainId}?contract_addresses=${contractAddress.toLowerCase()}`,
      {
        headers: { Accept: "application/json" },
        next: { revalidate: 1800 },
      }
    )

    if (!response.ok) {
      throw new Error(`GoPlus API error: ${response.status}`)
    }

    const data = await response.json()

    if (data.code !== 1 || !data.result) {
      return {
        tokenAddress: contractAddress,
        tokenName: null,
        tokenSymbol: null,
        isHoneypot: false,
        buyTax: null,
        sellTax: null,
        isOpenSource: false,
        isProxy: false,
        isMintable: false,
        canTakeBackOwnership: false,
        ownerChangeBalance: false,
        hiddenOwner: false,
        selfDestruct: false,
        externalCall: false,
        isAntiWhale: false,
        antiWhaleModifiable: false,
        tradingCooldown: false,
        personalSlippageModifiable: false,
        blacklistFunction: false,
        whitelistFunction: false,
        cannotBuy: false,
        cannotSellAll: false,
        holderCount: null,
        lpHolderCount: null,
        totalSupply: null,
        riskItems: [],
        error: data.message || "Token not found",
      }
    }

    const tokenData = data.result[contractAddress.toLowerCase()]
    if (!tokenData) {
      return {
        tokenAddress: contractAddress,
        tokenName: null,
        tokenSymbol: null,
        isHoneypot: false,
        buyTax: null,
        sellTax: null,
        isOpenSource: false,
        isProxy: false,
        isMintable: false,
        canTakeBackOwnership: false,
        ownerChangeBalance: false,
        hiddenOwner: false,
        selfDestruct: false,
        externalCall: false,
        isAntiWhale: false,
        antiWhaleModifiable: false,
        tradingCooldown: false,
        personalSlippageModifiable: false,
        blacklistFunction: false,
        whitelistFunction: false,
        cannotBuy: false,
        cannotSellAll: false,
        holderCount: null,
        lpHolderCount: null,
        totalSupply: null,
        riskItems: [],
        error: "Token data not available",
      }
    }

    const riskItems: string[] = []

    // Analyze token risks
    if (tokenData.is_honeypot === "1") {
      riskItems.push("HONEYPOT: Cannot sell tokens")
    }
    if (tokenData.is_open_source !== "1") {
      riskItems.push("Contract source code not verified")
    }
    if (tokenData.is_proxy === "1") {
      riskItems.push("Proxy contract (can be upgraded)")
    }
    if (tokenData.is_mintable === "1") {
      riskItems.push("Token supply can be minted")
    }
    if (tokenData.can_take_back_ownership === "1") {
      riskItems.push("Ownership can be reclaimed")
    }
    if (tokenData.owner_change_balance === "1") {
      riskItems.push("Owner can modify balances")
    }
    if (tokenData.hidden_owner === "1") {
      riskItems.push("Hidden owner detected")
    }
    if (tokenData.selfdestruct === "1") {
      riskItems.push("Contract has self-destruct function")
    }
    if (tokenData.external_call === "1") {
      riskItems.push("External calls in contract")
    }
    if (tokenData.cannot_buy === "1") {
      riskItems.push("Cannot buy token")
    }
    if (tokenData.cannot_sell_all === "1") {
      riskItems.push("Cannot sell all tokens")
    }
    if (tokenData.trading_cooldown === "1") {
      riskItems.push("Trading cooldown enforced")
    }

    const buyTax = parseFloat(tokenData.buy_tax) || null
    const sellTax = parseFloat(tokenData.sell_tax) || null

    if (buyTax && buyTax > 10) {
      riskItems.push(`High buy tax: ${(buyTax * 100).toFixed(1)}%`)
    }
    if (sellTax && sellTax > 10) {
      riskItems.push(`High sell tax: ${(sellTax * 100).toFixed(1)}%`)
    }

    const result: GoPlusTokenSecurity = {
      tokenAddress: contractAddress,
      tokenName: tokenData.token_name || null,
      tokenSymbol: tokenData.token_symbol || null,
      isHoneypot: tokenData.is_honeypot === "1",
      buyTax,
      sellTax,
      isOpenSource: tokenData.is_open_source === "1",
      isProxy: tokenData.is_proxy === "1",
      isMintable: tokenData.is_mintable === "1",
      canTakeBackOwnership: tokenData.can_take_back_ownership === "1",
      ownerChangeBalance: tokenData.owner_change_balance === "1",
      hiddenOwner: tokenData.hidden_owner === "1",
      selfDestruct: tokenData.selfdestruct === "1",
      externalCall: tokenData.external_call === "1",
      isAntiWhale: tokenData.is_anti_whale === "1",
      antiWhaleModifiable: tokenData.anti_whale_modifiable === "1",
      tradingCooldown: tokenData.trading_cooldown === "1",
      personalSlippageModifiable: tokenData.personal_slippage_modifiable === "1",
      blacklistFunction: tokenData.is_blacklisted === "1",
      whitelistFunction: tokenData.is_whitelisted === "1",
      cannotBuy: tokenData.cannot_buy === "1",
      cannotSellAll: tokenData.cannot_sell_all === "1",
      holderCount: parseInt(tokenData.holder_count) || null,
      lpHolderCount: parseInt(tokenData.lp_holder_count) || null,
      totalSupply: tokenData.total_supply || null,
      riskItems,
    }

    setCache(cacheKey, result, CACHE_TTL)
    return result
  } catch (error) {
    console.error("[GoPlus] Token security check error:", error)
    return {
      tokenAddress: contractAddress,
      tokenName: null,
      tokenSymbol: null,
      isHoneypot: false,
      buyTax: null,
      sellTax: null,
      isOpenSource: false,
      isProxy: false,
      isMintable: false,
      canTakeBackOwnership: false,
      ownerChangeBalance: false,
      hiddenOwner: false,
      selfDestruct: false,
      externalCall: false,
      isAntiWhale: false,
      antiWhaleModifiable: false,
      tradingCooldown: false,
      personalSlippageModifiable: false,
      blacklistFunction: false,
      whitelistFunction: false,
      cannotBuy: false,
      cannotSellAll: false,
      holderCount: null,
      lpHolderCount: null,
      totalSupply: null,
      riskItems: [],
      error: "Failed to check token security",
    }
  }
}

/**
 * Check URL/website security on GoPlus
 */
export async function checkUrlSecurity(url: string): Promise<GoPlusUrlSecurity> {
  const cacheKey = `goplus:url:${Buffer.from(url).toString("base64")}`
  const cached = getCached<GoPlusUrlSecurity>(cacheKey)
  if (cached) return cached

  try {
    const response = await fetch(
      `${GOPLUS_API_BASE}/phishing_site?url=${encodeURIComponent(url)}`,
      {
        headers: { Accept: "application/json" },
        next: { revalidate: 1800 },
      }
    )

    if (!response.ok) {
      throw new Error(`GoPlus API error: ${response.status}`)
    }

    const data = await response.json()

    if (data.code !== 1 || !data.result) {
      return {
        url,
        isPhishing: false,
        isWebsiteMalicious: false,
        riskItems: [],
        error: data.message || "Unable to check URL",
      }
    }

    const result = data.result
    const riskItems: string[] = []

    if (result.phishing_site === "1") {
      riskItems.push("PHISHING SITE DETECTED")
    }
    if (result.website_contract_security) {
      for (const warning of result.website_contract_security) {
        riskItems.push(warning)
      }
    }

    const urlResult: GoPlusUrlSecurity = {
      url,
      isPhishing: result.phishing_site === "1",
      isWebsiteMalicious:
        result.phishing_site === "1" ||
        (result.website_contract_security?.length || 0) > 0,
      riskItems,
    }

    setCache(cacheKey, urlResult, CACHE_TTL)
    return urlResult
  } catch (error) {
    console.error("[GoPlus] URL security check error:", error)
    return {
      url,
      isPhishing: false,
      isWebsiteMalicious: false,
      riskItems: [],
      error: "Failed to check URL security",
    }
  }
}

/**
 * Comprehensive GoPlus security check
 * Checks address, token (if contract), and URL
 */
export async function runGoPlusSecurityScan(params: {
  address?: string
  tokenAddress?: string
  url?: string
  chain?: ChainName
}): Promise<GoPlusSecurityResult> {
  const { address, tokenAddress, url, chain = "ethereum" } = params

  const results: GoPlusSecurityResult = {
    overallRisk: "safe",
    riskScore: 0,
    allRiskItems: [],
  }

  // Run all checks in parallel
  const promises: Promise<void>[] = []

  if (address) {
    promises.push(
      checkAddressSecurity(address, chain).then((res) => {
        results.address = res
        results.allRiskItems.push(...res.riskItems)
      })
    )
  }

  if (tokenAddress) {
    promises.push(
      checkTokenSecurity(tokenAddress, chain).then((res) => {
        results.token = res
        results.allRiskItems.push(...res.riskItems)
      })
    )
  }

  if (url) {
    promises.push(
      checkUrlSecurity(url).then((res) => {
        results.url = res
        results.allRiskItems.push(...res.riskItems)
      })
    )
  }

  await Promise.allSettled(promises)

  // Calculate overall risk
  results.riskScore = calculateGoPlusRiskScore(results)
  results.overallRisk = getRiskLevel(results.riskScore)

  return results
}

/**
 * Calculate risk score from GoPlus results
 */
function calculateGoPlusRiskScore(results: GoPlusSecurityResult): number {
  let score = 0

  // Address risks
  if (results.address) {
    if (results.address.isBlacklisted) score += 50
    if (results.address.isPhishing) score += 50
    if (results.address.isMalicious) score += 50
    if (results.address.isMixerContract) score += 30
  }

  // Token risks
  if (results.token) {
    if (results.token.isHoneypot) score += 100
    if (!results.token.isOpenSource) score += 15
    if (results.token.isProxy) score += 10
    if (results.token.isMintable) score += 10
    if (results.token.ownerChangeBalance) score += 25
    if (results.token.hiddenOwner) score += 20
    if (results.token.selfDestruct) score += 20
    if (results.token.cannotSellAll) score += 30
    if (results.token.cannotBuy) score += 30
    if (results.token.buyTax && results.token.buyTax > 0.1) score += 15
    if (results.token.sellTax && results.token.sellTax > 0.1) score += 15
  }

  // URL risks
  if (results.url) {
    if (results.url.isPhishing) score += 80
    if (results.url.isWebsiteMalicious) score += 50
  }

  return Math.min(100, score)
}

function getRiskLevel(
  score: number
): "safe" | "low" | "medium" | "high" | "critical" {
  if (score === 0) return "safe"
  if (score < 20) return "low"
  if (score < 50) return "medium"
  if (score < 80) return "high"
  return "critical"
}

/**
 * Get risk signals for evidence generation
 */
export function getGoPlusRiskSignals(results: GoPlusSecurityResult): {
  signals: string[]
  severity: "positive" | "neutral" | "medium" | "high" | "critical"
} {
  const signals: string[] = []

  if (results.allRiskItems.length === 0) {
    signals.push("GoPlus security scan: No issues detected")
    return { signals, severity: "positive" }
  }

  // Critical issues
  if (results.address?.isBlacklisted) {
    signals.push("ADDRESS BLACKLISTED by GoPlus")
  }
  if (results.address?.isPhishing) {
    signals.push("ADDRESS associated with PHISHING")
  }
  if (results.address?.isMalicious) {
    signals.push("ADDRESS flagged as MALICIOUS")
  }
  if (results.token?.isHoneypot) {
    signals.push("TOKEN is a HONEYPOT - cannot sell")
  }
  if (results.url?.isPhishing) {
    signals.push("WEBSITE is a PHISHING SITE")
  }

  // High severity
  if (results.address?.isMixerContract) {
    signals.push("Address is a mixer/privacy contract")
  }
  if (results.token?.ownerChangeBalance) {
    signals.push("Token owner can modify balances")
  }
  if (results.token?.hiddenOwner) {
    signals.push("Token has hidden owner")
  }
  if (results.token?.cannotSellAll) {
    signals.push("Token cannot be fully sold")
  }

  // Medium severity
  if (results.token && !results.token.isOpenSource) {
    signals.push("Token contract not verified")
  }
  if (results.token?.isProxy) {
    signals.push("Token is upgradeable proxy")
  }
  if (results.token?.isMintable) {
    signals.push("Token supply can be increased")
  }

  // Determine overall severity
  let severity: "positive" | "neutral" | "medium" | "high" | "critical" =
    "neutral"
  if (results.riskScore >= 80) severity = "critical"
  else if (results.riskScore >= 50) severity = "high"
  else if (results.riskScore >= 20) severity = "medium"
  else if (results.riskScore === 0) severity = "positive"

  return { signals, severity }
}
