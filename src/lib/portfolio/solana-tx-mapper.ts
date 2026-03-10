/**
 * Pure mapping logic for converting Helius Enhanced Transactions to TransactionCache records.
 * No DB or network imports — safe for unit testing.
 */

export interface HeliusTransaction {
  signature: string
  timestamp: number
  type: string
  source: string
  fee: number
  feePayer: string
  slot?: number
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
  description?: string
}

export interface TransactionCacheRecord {
  userId: string
  walletAddress: string
  chain: string
  txHash: string
  blockNumber: number
  blockTimestamp: number
  category: string
  from: string
  to: string | null
  asset: string | null
  symbol: string | null
  decimals: number | null
  rawValue: string | null
  value: number | null
  usdValue: number | null
  direction: string
}

/**
 * Convert a single Helius transaction into one or more TransactionCache records.
 * A swap or multi-transfer tx produces multiple records.
 */
export function heliusTxToRecords(
  htx: HeliusTransaction,
  userId: string,
  walletAddress: string,
): TransactionCacheRecord[] {
  const records: TransactionCacheRecord[] = []
  // Solana addresses are base58 case-sensitive — no lowercasing
  const wallet = walletAddress
  const blockTimestamp = htx.timestamp
  const blockNumber = htx.slot ?? 0
  const feePayer = htx.feePayer ?? ""

  const base = {
    userId,
    walletAddress: wallet,
    chain: "SOLANA",
    txHash: htx.signature,
    blockNumber,
    blockTimestamp,
    usdValue: null as number | null,
  }

  // Native SOL transfers (skip fee payments to validators)
  if (htx.nativeTransfers) {
    for (const nt of htx.nativeTransfers) {
      const from = nt.fromUserAccount || null
      const to = nt.toUserAccount || null
      if (!from && !to) continue
      const isFrom = from === wallet
      const isTo = to === wallet
      if (!isFrom && !isTo) continue
      if (nt.amount <= 0) continue

      // Skip fee transfers: feePayer sending fee-sized amount to non-wallet addresses
      // Use ±5% threshold instead of exact match to handle rounding in multi-instruction txs
      if (isFrom && from === feePayer && !isTo && htx.fee > 0 && Math.abs(nt.amount - htx.fee) / htx.fee < 0.05) continue

      records.push({
        ...base,
        category: "external",
        from: from ?? wallet,
        to,
        asset: "native",
        symbol: "SOL",
        decimals: 9,
        rawValue: String(nt.amount),
        value: nt.amount / 1e9,
        direction: isFrom ? "out" : "in",
      })
    }
  }

  // SPL token transfers
  if (htx.tokenTransfers) {
    for (const tt of htx.tokenTransfers) {
      const from = tt.fromUserAccount || null
      const to = tt.toUserAccount || null
      if (!from && !to) continue
      const isFrom = from === wallet
      const isTo = to === wallet
      if (!isFrom && !isTo) continue
      if (tt.tokenAmount <= 0) continue

      records.push({
        ...base,
        category: "erc20", // reuse for SPL tokens
        from: from ?? wallet,
        to,
        asset: tt.mint ?? null,
        symbol: null, // Helius doesn't always provide symbol
        decimals: null,
        rawValue: String(tt.tokenAmount),
        value: tt.tokenAmount,
        direction: isFrom ? "out" : "in",
      })
    }
  }

  // If no transfers extracted (e.g. program interaction with balance changes), try accountData
  if (records.length === 0 && htx.accountData) {
    for (const acct of htx.accountData) {
      if (acct.account !== wallet) continue

      // Native balance change
      if (acct.nativeBalanceChange !== 0) {
        const isOut = acct.nativeBalanceChange < 0
        // For inflows from program interactions, use program source instead of feePayer
        const programSource = htx.source || null
        records.push({
          ...base,
          category: "external",
          from: isOut ? wallet : (programSource ?? feePayer ?? null),
          to: isOut ? (programSource ?? feePayer ?? null) : wallet,
          asset: "native",
          symbol: "SOL",
          decimals: 9,
          rawValue: String(Math.abs(acct.nativeBalanceChange)),
          value: Math.abs(acct.nativeBalanceChange) / 1e9,
          direction: isOut ? "out" : "in",
        })
      }

      // Token balance changes
      if (acct.tokenBalanceChanges) {
        for (const tbc of acct.tokenBalanceChanges) {
          const rawAmt = Number(tbc.rawTokenAmount.tokenAmount)
          if (rawAmt === 0) continue
          const decimals = tbc.rawTokenAmount.decimals
          const value = Math.abs(rawAmt) / Math.pow(10, decimals)
          const isOut = rawAmt < 0

          records.push({
            ...base,
            category: "erc20",
            from: isOut ? wallet : (htx.source || feePayer),
            to: isOut ? (htx.source || feePayer) : wallet,
            asset: tbc.mint ?? null,
            symbol: null,
            decimals,
            rawValue: String(Math.abs(rawAmt)),
            value,
            direction: isOut ? "out" : "in",
          })
        }
      }
    }
  }

  // Add gas fee row if wallet paid the fee and there are other transfers
  if (htx.fee > 0 && feePayer === wallet && records.length > 0) {
    records.push({
      ...base,
      category: "gas",
      from: wallet,
      to: null,
      asset: "native",
      symbol: "SOL",
      decimals: 9,
      rawValue: String(htx.fee),
      value: htx.fee / 1e9,
      direction: "out",
    })
  }

  return records
}
