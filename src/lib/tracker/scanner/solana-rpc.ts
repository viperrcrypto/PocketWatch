// Solana scanner using the public JSON RPC endpoint (no API key required).

import type { NewTransaction, ScanResult, TransactionType } from "../types"
import { SOLANA_DEX_PROGRAMS } from "../chains"

interface SolanaSignatureInfo {
  signature: string
  blockTime: number | null
  err: unknown
}

// Parsed transaction types from Solana RPC jsonParsed encoding
interface SolanaParsedTx {
  blockTime: number | null
  meta: {
    err: unknown
    fee: number
    preBalances: number[]
    postBalances: number[]
    preTokenBalances?: SolanaTokenBalance[]
    postTokenBalances?: SolanaTokenBalance[]
    innerInstructions?: {
      index: number
      instructions: SolanaParsedInstruction[]
    }[]
  } | null
  transaction: {
    message: {
      accountKeys: { pubkey: string; signer: boolean; writable: boolean }[]
      instructions: SolanaParsedInstruction[]
    }
    signatures: string[]
  }
}

interface SolanaTokenBalance {
  accountIndex: number
  mint: string
  owner: string
  uiTokenAmount: {
    amount: string
    decimals: number
    uiAmount: number | null
    uiAmountString: string
  }
}

interface SolanaParsedInstruction {
  program?: string
  programId: string
  parsed?: {
    type: string // "transfer", "transferChecked", etc.
    info: Record<string, unknown>
  }
}

/**
 * Scan Solana wallet using the public RPC endpoint.
 * No API key required — works with rate limits.
 * Uses getSignaturesForAddress + batched getTransaction (jsonParsed)
 * to extract token transfer and swap data.
 */
export async function scanSolanaWalletRpc(
  address: string,
  lastSignature?: string,
  userAlchemyKey?: string
): Promise<ScanResult> {
  // Use user's Alchemy key, fall back to env var, then public mainnet RPC
  const alchemyKey = userAlchemyKey || process.env.NEXT_PUBLIC_ALCHEMY_API_KEY
  const rpcUrl = alchemyKey
    ? `https://solana-mainnet.g.alchemy.com/v2/${alchemyKey}`
    : "https://api.mainnet-beta.solana.com"

  console.log(`[tracker-scan] Solana RPC (${alchemyKey ? "alchemy" : "public"}) scanning ${address.slice(0, 8)}...`)
  const transactions: NewTransaction[] = []

  // Step 1: Get recent signatures
  const sigRes = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "getSignaturesForAddress",
      params: [address, { limit: lastSignature ? 100 : 50 }],
    }),
  })

  if (!sigRes.ok) throw new Error(`Solana RPC error: ${sigRes.status}`)
  const sigData = await sigRes.json()
  if (sigData.error) throw new Error(`Solana RPC error: ${sigData.error.message}`)

  const signatures: SolanaSignatureInfo[] = sigData.result ?? []

  // Filter to only new, successful signatures
  const newSigs: SolanaSignatureInfo[] = []
  for (const sig of signatures) {
    if (lastSignature && sig.signature === lastSignature) break
    if (sig.err) continue
    newSigs.push(sig)
  }

  if (newSigs.length === 0) {
    return { transactions: [], lastSignature: lastSignature || undefined }
  }

  // Step 2: Batch fetch parsed transaction data
  const BATCH_SIZE = 20
  const toFetch = newSigs.slice(0, 50)

  for (let i = 0; i < toFetch.length; i += BATCH_SIZE) {
    const batch = toFetch.slice(i, i + BATCH_SIZE)

    const batchReq = batch.map((sig, idx) => ({
      jsonrpc: "2.0",
      id: idx,
      method: "getTransaction",
      params: [sig.signature, { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 }],
    }))

    const txRes = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(batchReq),
    })

    if (!txRes.ok) {
      console.warn(`[scanSolanaWalletRpc] batch fetch failed: ${txRes.status}`)
      continue
    }

    const batchResults: { id: number; result: SolanaParsedTx | null; error?: { message: string } }[] = await txRes.json()

    for (let j = 0; j < batch.length; j++) {
      const sig = batch[j]
      const resp = batchResults.find((r) => r.id === j)
      const txResult = resp?.result

      if (!txResult) continue // Skip null results or errors

      const parsed = parseSolanaTransaction(txResult, address, sig)
      if (parsed) transactions.push(parsed)
    }

    // Delay between batches
    if (i + BATCH_SIZE < toFetch.length) {
      await new Promise((r) => setTimeout(r, 200))
    }
  }

  console.log(`[tracker-scan] Solana RPC: ${transactions.length} txs from ${toFetch.length} sigs for ${address.slice(0, 8)}...`)

  const newestSig = newSigs[0].signature

  return {
    transactions,
    lastSignature: newestSig || undefined,
  }
}

/**
 * Parse a Solana transaction from jsonParsed RPC response.
 * Extracts token transfers, amounts, mints, and classifies BUY/SELL/TRANSFER.
 */
function parseSolanaTransaction(
  tx: SolanaParsedTx,
  walletAddress: string,
  sigInfo: SolanaSignatureInfo
): NewTransaction | null {
  if (!tx.meta || tx.meta.err) return null

  const timestamp = tx.blockTime ?? sigInfo.blockTime
  const blockTimestamp = timestamp ? new Date(timestamp * 1000) : new Date()

  // Get account keys
  const accountKeys = tx.transaction.message.accountKeys.map((k) => k.pubkey)
  const walletIndex = accountKeys.indexOf(walletAddress)

  // Calculate SOL balance change for the wallet
  let solChange = 0
  if (walletIndex >= 0 && tx.meta.preBalances && tx.meta.postBalances) {
    solChange = (tx.meta.postBalances[walletIndex] - tx.meta.preBalances[walletIndex]) / 1e9
    // Subtract fee if wallet is fee payer (index 0)
    if (walletIndex === 0) {
      solChange += tx.meta.fee / 1e9 // add back fee so we see actual transfer amount
    }
  }

  // Extract token balance changes for the wallet
  const preTokens = tx.meta.preTokenBalances?.filter((b) => b.owner === walletAddress) ?? []
  const postTokens = tx.meta.postTokenBalances?.filter((b) => b.owner === walletAddress) ?? []

  // Build a map of mint -> balance change
  const tokenChanges: Map<string, { mint: string; change: number; decimals: number; postAmount: number }> = new Map()

  for (const post of postTokens) {
    const pre = preTokens.find((p) => p.mint === post.mint)
    const preAmount = pre ? parseFloat(pre.uiTokenAmount.uiAmountString || "0") : 0
    const postAmount = parseFloat(post.uiTokenAmount.uiAmountString || "0")
    const change = postAmount - preAmount
    if (Math.abs(change) > 0) {
      tokenChanges.set(post.mint, {
        mint: post.mint,
        change,
        decimals: post.uiTokenAmount.decimals,
        postAmount,
      })
    }
  }

  // Also check pre-tokens that may have been fully withdrawn
  for (const pre of preTokens) {
    if (!tokenChanges.has(pre.mint)) {
      const post = postTokens.find((p) => p.mint === pre.mint)
      const preAmount = parseFloat(pre.uiTokenAmount.uiAmountString || "0")
      const postAmount = post ? parseFloat(post.uiTokenAmount.uiAmountString || "0") : 0
      const change = postAmount - preAmount
      if (Math.abs(change) > 0) {
        tokenChanges.set(pre.mint, {
          mint: pre.mint,
          change,
          decimals: pre.uiTokenAmount.decimals,
          postAmount,
        })
      }
    }
  }

  // Check if this is a swap by looking at program IDs in instructions
  const allInstructions = [
    ...tx.transaction.message.instructions,
    ...(tx.meta.innerInstructions?.flatMap((i) => i.instructions) ?? []),
  ]
  const programIds = new Set(allInstructions.map((i) => i.programId))

  const isSwap = Object.keys(SOLANA_DEX_PROGRAMS).some((p) => programIds.has(p))

  // Determine DEX name
  let dexName: string | undefined
  for (const programId of programIds) {
    if (SOLANA_DEX_PROGRAMS[programId]) {
      dexName = SOLANA_DEX_PROGRAMS[programId]
      break
    }
  }

  // Classify the transaction
  if (isSwap && tokenChanges.size > 0) {
    // This is a DEX swap. Find tokens gained vs tokens lost.
    const tokensGained: typeof tokenChanges extends Map<string, infer V> ? [string, V][] : never = []
    const tokensLost: typeof tokenChanges extends Map<string, infer V> ? [string, V][] : never = []

    for (const [mint, info] of tokenChanges) {
      if (info.change > 0) tokensGained.push([mint, info])
      else if (info.change < 0) tokensLost.push([mint, info])
    }

    // Determine BUY vs SELL:
    // BUY = SOL decreased (or stablecoin decreased), token increased
    // SELL = token decreased, SOL increased (or stablecoin increased)
    const type: TransactionType = solChange < -0.001 ? "BUY" : solChange > 0.001 ? "SELL" : "SWAP"

    // The "primary" token is the non-SOL token (the one being traded)
    const primaryGained = tokensGained[0]
    const primaryLost = tokensLost[0]

    return {
      txHash: sigInfo.signature,
      chain: "SOLANA",
      type,
      blockTimestamp,
      tokenAddress: primaryGained?.[1].mint ?? primaryLost?.[1].mint,
      amountFormatted: primaryGained?.[1].change ?? Math.abs(primaryLost?.[1].change ?? 0),
      tokenInAddress: primaryLost?.[1].mint,
      tokenInSymbol: solChange < -0.001 ? "SOL" : undefined,
      tokenInAmount: primaryLost ? Math.abs(primaryLost[1].change) : (solChange < 0 ? Math.abs(solChange) : undefined),
      tokenOutAddress: primaryGained?.[1].mint,
      tokenOutAmount: primaryGained?.[1].change,
      tokenOutSymbol: solChange > 0.001 ? "SOL" : undefined,
      fromAddress: walletAddress,
      dexName,
    }
  }

  // Simple token transfer
  if (tokenChanges.size > 0) {
    const [mint, info] = tokenChanges.entries().next().value as [string, { mint: string; change: number; decimals: number; postAmount: number }]
    const isIncoming = info.change > 0

    return {
      txHash: sigInfo.signature,
      chain: "SOLANA",
      type: isIncoming ? "TRANSFER_IN" : "TRANSFER_OUT",
      blockTimestamp,
      tokenAddress: mint,
      amountFormatted: Math.abs(info.change),
      tokenDecimals: info.decimals,
      fromAddress: isIncoming ? undefined : walletAddress,
      toAddress: isIncoming ? walletAddress : undefined,
    }
  }

  // SOL transfer
  if (Math.abs(solChange) > 0.000001) {
    const isIncoming = solChange > 0
    return {
      txHash: sigInfo.signature,
      chain: "SOLANA",
      type: isIncoming ? "TRANSFER_IN" : "TRANSFER_OUT",
      blockTimestamp,
      tokenSymbol: "SOL",
      amountFormatted: Math.abs(solChange),
      fromAddress: isIncoming ? undefined : walletAddress,
      toAddress: isIncoming ? walletAddress : undefined,
    }
  }

  // No meaningful balance change — wallet was only referenced in the transaction
  // (e.g., lookup table, authority, cNFT). Skip to avoid noise.
  return null
}
