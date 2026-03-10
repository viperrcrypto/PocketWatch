// Solana scanner using Helius Enhanced Transactions API.

import type { TrackerChain, NewTransaction, ScanResult, TransactionType } from "../types"
import { SOLANA_DEX_PROGRAMS } from "../chains"

interface HeliusTransaction {
  signature: string
  timestamp: number
  type: string // SWAP, TRANSFER, UNKNOWN, etc.
  source: string // RAYDIUM, JUPITER, PUMP_FUN, SYSTEM_PROGRAM, etc.
  fee: number
  feePayer: string
  nativeTransfers?: {
    fromUserAccount: string
    toUserAccount: string
    amount: number
  }[]
  tokenTransfers?: {
    fromUserAccount: string
    toUserAccount: string
    fromTokenAccount: string
    toTokenAccount: string
    tokenAmount: number
    mint: string
    tokenStandard: string
  }[]
  accountData?: {
    account: string
    nativeBalanceChange: number
    tokenBalanceChanges?: {
      userAccount: string
      tokenAccount: string
      rawTokenAmount: { tokenAmount: string; decimals: number }
      mint: string
    }[]
  }[]
  events?: {
    swap?: {
      nativeInput?: { account: string; amount: string }
      nativeOutput?: { account: string; amount: string }
      tokenInputs?: { userAccount: string; tokenAccount: string; mint: string; rawTokenAmount: { tokenAmount: string; decimals: number } }[]
      tokenOutputs?: { userAccount: string; tokenAccount: string; mint: string; rawTokenAmount: { tokenAmount: string; decimals: number } }[]
      innerSwaps?: unknown[]
    }
  }
  description?: string
}

export async function scanSolanaWallet(
  address: string,
  apiKey: string,
  lastSignature?: string
): Promise<ScanResult> {
  const transactions: NewTransaction[] = []

  // Helius Enhanced Transactions API returns newest-first.
  // `before` returns txs OLDER than the given sig, so we must NOT pass it
  // when looking for NEW transactions. Instead, fetch the latest page and
  // stop when we encounter the lastSignature we already processed.
  // On first scan (no lastSignature), just grab the newest 50.

  let beforeSig: string | undefined = undefined // start from the tip
  let reachedKnown = false
  let pagesScanned = 0
  const MAX_PAGES = 5 // safety cap to avoid runaway pagination

  while (!reachedKnown && pagesScanned < MAX_PAGES) {
    const url = `https://api.helius.xyz/v0/addresses/${address}/transactions?api-key=${apiKey}&limit=50${beforeSig ? `&before=${beforeSig}` : ""}`

    const res = await fetch(url)
    if (!res.ok) {
      throw new Error(`Helius API error: ${res.status}`)
    }

    const heliusTxs: HeliusTransaction[] = await res.json()

    if (!heliusTxs || heliusTxs.length === 0) {
      break
    }

    for (const htx of heliusTxs) {
      // Stop when we reach the transaction we already know about
      if (lastSignature && htx.signature === lastSignature) {
        reachedKnown = true
        break
      }

      const tx = classifySolanaTransaction(htx, address)
      if (tx) {
        transactions.push(tx)
      }
    }

    // If this is the first scan (no cursor), only fetch one page
    if (!lastSignature) break

    // For pagination: use the last sig in this batch to go further back
    beforeSig = heliusTxs[heliusTxs.length - 1]?.signature
    pagesScanned++
  }

  // The newest signature for the cursor is the first tx we fetched
  // (Helius returns newest-first). Keep old cursor if no new txs found.
  const newestSig = transactions.length > 0
    ? transactions[0].txHash
    : lastSignature

  return {
    transactions,
    lastSignature: newestSig || undefined,
  }
}

function classifySolanaTransaction(
  htx: HeliusTransaction,
  walletAddress: string
): NewTransaction | null {
  const type = mapHeliusType(htx, walletAddress)

  // Extract swap details from events
  let tokenInSymbol: string | undefined
  let tokenInAmount: number | undefined
  let tokenInAddress: string | undefined
  let tokenOutSymbol: string | undefined
  let tokenOutAmount: number | undefined
  let tokenOutAddress: string | undefined
  let tokenAddress: string | undefined
  let tokenSymbol: string | undefined
  let amountFormatted: number | undefined
  let valueUsd: number | undefined

  if (htx.events?.swap) {
    const swap = htx.events.swap
    // Native input (SOL spent)
    if (swap.nativeInput) {
      tokenInSymbol = "SOL"
      tokenInAmount = Number(swap.nativeInput.amount) / 1e9
    }
    // Native output (SOL received)
    if (swap.nativeOutput) {
      tokenOutSymbol = "SOL"
      tokenOutAmount = Number(swap.nativeOutput.amount) / 1e9
    }
    // Token inputs
    if (swap.tokenInputs?.[0]) {
      const ti = swap.tokenInputs[0]
      tokenInAddress = ti.mint
      tokenInAmount = Number(ti.rawTokenAmount.tokenAmount) / Math.pow(10, ti.rawTokenAmount.decimals)
    }
    // Token outputs
    if (swap.tokenOutputs?.[0]) {
      const to = swap.tokenOutputs[0]
      tokenOutAddress = to.mint
      tokenOutAmount = Number(to.rawTokenAmount.tokenAmount) / Math.pow(10, to.rawTokenAmount.decimals)
    }

    // Determine the main token (not SOL)
    if (tokenOutAddress && tokenOutSymbol !== "SOL") {
      tokenAddress = tokenOutAddress
      amountFormatted = tokenOutAmount
    } else if (tokenInAddress && tokenInSymbol !== "SOL") {
      tokenAddress = tokenInAddress
      amountFormatted = tokenInAmount
    }
  }

  // ─── Fallback: reconstruct swap from tokenTransfers + nativeTransfers ───
  // Pump.fun and some DEXes don't populate events.swap, but Helius still
  // provides tokenTransfers (SPL transfers) and nativeTransfers (SOL flow).
  if (!tokenInAddress && !tokenOutAddress && (type === "BUY" || type === "SELL" || type === "SWAP")) {
    const wallet = walletAddress.toLowerCase()

    // Extract SPL token transfers involving this wallet
    const tokenIn = htx.tokenTransfers?.find(
      (tt) => tt.fromUserAccount?.toLowerCase() === wallet && tt.mint && tt.tokenAmount > 0
    )
    const tokenOut = htx.tokenTransfers?.find(
      (tt) => tt.toUserAccount?.toLowerCase() === wallet && tt.mint && tt.tokenAmount > 0
    )

    if (tokenIn) {
      tokenInAddress = tokenIn.mint
      tokenInAmount = tokenIn.tokenAmount
    }
    if (tokenOut) {
      tokenOutAddress = tokenOut.mint
      tokenOutAmount = tokenOut.tokenAmount
    }

    // Extract SOL flow from nativeTransfers
    if (htx.nativeTransfers && htx.nativeTransfers.length > 0) {
      const solSent = htx.nativeTransfers
        .filter((nt) => nt.fromUserAccount?.toLowerCase() === wallet)
        .reduce((sum, nt) => sum + (nt.amount || 0), 0)
      const solReceived = htx.nativeTransfers
        .filter((nt) => nt.toUserAccount?.toLowerCase() === wallet)
        .reduce((sum, nt) => sum + (nt.amount || 0), 0)

      if (solSent > 0 && !tokenInAddress) {
        tokenInSymbol = "SOL"
        tokenInAmount = solSent / 1e9
      }
      if (solReceived > 0 && !tokenOutAddress) {
        tokenOutSymbol = "SOL"
        tokenOutAmount = solReceived / 1e9
      }
    }

    // Also try accountData tokenBalanceChanges as last resort
    if (!tokenInAddress && !tokenOutAddress && htx.accountData) {
      for (const acct of htx.accountData) {
        if (acct.account?.toLowerCase() !== wallet) continue
        if (!acct.tokenBalanceChanges) continue
        for (const tbc of acct.tokenBalanceChanges) {
          const rawAmt = Number(tbc.rawTokenAmount.tokenAmount)
          const decimals = tbc.rawTokenAmount.decimals
          const amount = rawAmt / Math.pow(10, decimals)
          if (rawAmt > 0) {
            // Wallet received this token
            tokenOutAddress = tbc.mint
            tokenOutAmount = amount
          } else if (rawAmt < 0) {
            // Wallet sent this token
            tokenInAddress = tbc.mint
            tokenInAmount = Math.abs(amount)
          }
        }
      }
    }

    // Determine the main token (not SOL)
    if (tokenOutAddress && tokenOutSymbol !== "SOL") {
      tokenAddress = tokenOutAddress
      amountFormatted = tokenOutAmount
    } else if (tokenInAddress && tokenInSymbol !== "SOL") {
      tokenAddress = tokenInAddress
      amountFormatted = tokenInAmount
    }
  }

  // Handle transfers
  if (type === "TRANSFER_IN" || type === "TRANSFER_OUT") {
    if (htx.nativeTransfers?.[0]) {
      const nt = htx.nativeTransfers[0]
      amountFormatted = nt.amount / 1e9
      tokenSymbol = "SOL"
    }
    if (htx.tokenTransfers?.[0]) {
      const tt = htx.tokenTransfers[0]
      tokenAddress = tt.mint
      amountFormatted = tt.tokenAmount
    }
  }

  const dexName = SOLANA_DEX_PROGRAMS[htx.source] || mapHeliusSource(htx.source)

  return {
    txHash: htx.signature,
    chain: "SOLANA",
    type,
    blockTimestamp: new Date(htx.timestamp * 1000),
    tokenAddress,
    tokenSymbol,
    amountFormatted,
    valueUsd,
    tokenInAddress,
    tokenInSymbol,
    tokenInAmount,
    tokenOutAddress,
    tokenOutSymbol,
    tokenOutAmount,
    fromAddress: htx.feePayer,
    toAddress: undefined,
    dexName,
  }
}

function mapHeliusType(htx: HeliusTransaction, walletAddress: string): TransactionType {
  switch (htx.type) {
    case "SWAP": {
      // Determine BUY vs SELL based on SOL flow
      // If wallet's native balance decreased, they spent SOL = BUY
      const accountChange = htx.accountData?.find(
        (a) => a.account === walletAddress
      )
      if (accountChange) {
        return accountChange.nativeBalanceChange < 0 ? "BUY" : "SELL"
      }
      return "SWAP"
    }
    case "TRANSFER": {
      // Check direction
      if (htx.nativeTransfers?.[0]) {
        return htx.nativeTransfers[0].fromUserAccount === walletAddress
          ? "TRANSFER_OUT"
          : "TRANSFER_IN"
      }
      if (htx.tokenTransfers?.[0]) {
        return htx.tokenTransfers[0].fromUserAccount === walletAddress
          ? "TRANSFER_OUT"
          : "TRANSFER_IN"
      }
      return "TRANSFER_IN"
    }
    default:
      return "UNKNOWN"
  }
}

function mapHeliusSource(source: string): string | undefined {
  const map: Record<string, string> = {
    RAYDIUM: "Raydium",
    JUPITER: "Jupiter",
    ORCA: "Orca",
    PUMP_FUN: "Pump.fun",
    SYSTEM_PROGRAM: "System",
    MAGIC_EDEN: "Magic Eden",
    TENSOR: "Tensor",
  }
  return map[source]
}
