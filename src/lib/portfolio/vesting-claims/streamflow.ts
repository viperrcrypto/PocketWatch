// ─── Streamflow Finance Vesting Streams Checker (Solana) ───
// Uses raw Solana JSON-RPC getProgramAccounts with memcmp filters.
// Parses Borsh-serialized stream account data from on-chain buffers.

import type { VestingChecker, VestingScanResult, VestingClaim } from "./types"
import { solanaRpc, withTimeout, resolveSPLToken } from "./rpc"

// ─── Constants ───

const STREAMFLOW_PROGRAM_ID = "strmRqUCoQUgGUan5YhzUZa6KqdzwX5L6FpUxfmKg5m"

// Base58 alphabet (Bitcoin standard)
const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"

// ─── Base58 Encoding ───

function base58Encode(bytes: Uint8Array): string {
  // Count leading zeros
  let leadingZeros = 0
  for (let i = 0; i < bytes.length; i++) {
    if (bytes[i] !== 0) break
    leadingZeros++
  }

  // Convert byte array to a big integer
  let num = BigInt(0)
  for (let i = 0; i < bytes.length; i++) {
    num = num * 256n + BigInt(bytes[i])
  }

  // Convert big integer to base58 string
  const chars: string[] = []
  while (num > 0n) {
    const remainder = Number(num % 58n)
    num = num / 58n
    chars.unshift(BASE58_ALPHABET[remainder])
  }

  // Add leading '1's for each leading zero byte
  for (let i = 0; i < leadingZeros; i++) {
    chars.unshift("1")
  }

  return chars.join("") || "1"
}

// ─── Stream Account Layout Offsets ───

const OFFSETS = {
  magic: 0,               // u64 — 8 bytes
  version: 8,             // u8  — 1 byte
  created_at: 9,          // u64 — 8 bytes
  withdrawn_amount: 17,   // u64 — 8 bytes
  canceled_at: 25,        // u64 — 8 bytes
  end_time: 33,           // u64 — 8 bytes
  last_withdrawn_at: 41,  // u64 — 8 bytes
  sender: 49,             // Pubkey — 32 bytes
  sender_tokens: 81,      // Pubkey — 32 bytes
  recipient: 113,         // Pubkey — 32 bytes
  recipient_tokens: 145,  // Pubkey — 32 bytes
  mint: 177,              // Pubkey — 32 bytes
  escrow_tokens: 209,     // Pubkey — 32 bytes
  streamflow_treasury: 241,         // Pubkey — 32 bytes
  streamflow_treasury_tokens: 273,  // Pubkey — 32 bytes
  streamflow_fee_total: 305,        // u64 — 8 bytes
  streamflow_fee_withdrawn: 313,    // u64 — 8 bytes
  streamflow_fee_percent: 321,      // f32 — 4 bytes
  partner: 325,                     // Pubkey — 32 bytes
  partner_tokens: 357,              // Pubkey — 32 bytes
  partner_fee_total: 389,           // u64 — 8 bytes
  partner_fee_withdrawn: 397,       // u64 — 8 bytes
  partner_fee_percent: 405,         // f32 — 4 bytes
  start_time: 409,                  // u64 — 8 bytes
  net_deposited_amount: 417,        // u64 — 8 bytes
  period: 425,                      // u64 — 8 bytes
  amount_per_period: 433,           // u64 — 8 bytes
  cliff: 441,                       // u64 — 8 bytes
  cliff_amount: 449,                // u64 — 8 bytes
} as const

// Minimum account data size to be a valid stream
const MIN_ACCOUNT_SIZE = 457

// ─── RPC Response Types ───

interface ProgramAccount {
  pubkey: string
  account: {
    data: [string, string] // [base64data, "base64"]
    executable: boolean
    lamports: number
    owner: string
    rentEpoch: number
  }
}

// ─── Parsed Stream Data ───

interface StreamData {
  withdrawnAmount: bigint
  canceledAt: bigint
  endTime: bigint
  mint: string
  startTime: bigint
  netDepositedAmount: bigint
  period: bigint
  amountPerPeriod: bigint
  cliff: bigint
  cliffAmount: bigint
  createdAt: bigint
}

// ─── Helpers ───

function readPubkey(buf: Buffer, offset: number): string {
  const bytes = buf.subarray(offset, offset + 32)
  return base58Encode(new Uint8Array(bytes))
}

function readU64(buf: Buffer, offset: number): bigint {
  return buf.readBigUInt64LE(offset)
}

function toEpochIso(timestamp: bigint): string | null {
  if (timestamp <= 0n) return null
  const ms = Number(timestamp) * 1000
  if (!Number.isFinite(ms) || ms <= 0) return null
  return new Date(ms).toISOString()
}

/**
 * Convert raw token amount (bigint) to a displayable number using actual decimals.
 * Uses string-based division to preserve precision for large values.
 */
function rawToDisplay(amount: bigint, decimals: number): number {
  if (amount === 0n) return 0
  // String-based: avoids Number(bigint) precision loss for values > 2^53
  const str = amount.toString()
  if (str.length <= decimals) {
    return Number(`0.${str.padStart(decimals, "0")}`)
  }
  const intPart = str.slice(0, str.length - decimals)
  const fracPart = str.slice(str.length - decimals)
  return Number(`${intPart}.${fracPart}`)
}

// ─── Parse stream account data ───

function parseStreamAccount(data: string): StreamData | null {
  try {
    const buf = Buffer.from(data, "base64")

    if (buf.length < MIN_ACCOUNT_SIZE) return null

    return {
      createdAt: readU64(buf, OFFSETS.created_at),
      withdrawnAmount: readU64(buf, OFFSETS.withdrawn_amount),
      canceledAt: readU64(buf, OFFSETS.canceled_at),
      endTime: readU64(buf, OFFSETS.end_time),
      mint: readPubkey(buf, OFFSETS.mint),
      startTime: readU64(buf, OFFSETS.start_time),
      netDepositedAmount: readU64(buf, OFFSETS.net_deposited_amount),
      period: readU64(buf, OFFSETS.period),
      amountPerPeriod: readU64(buf, OFFSETS.amount_per_period),
      cliff: readU64(buf, OFFSETS.cliff),
      cliffAmount: readU64(buf, OFFSETS.cliff_amount),
    }
  } catch {
    return null
  }
}

// ─── Calculate vested amount ───

function calculateVestedAmount(stream: StreamData, nowSeconds: bigint): bigint {
  const { startTime, endTime, cliff, cliffAmount, period, amountPerPeriod, netDepositedAmount } = stream

  // Before cliff: nothing vested
  if (nowSeconds < startTime + cliff) {
    return 0n
  }

  // After end: everything vested
  if (nowSeconds >= endTime) {
    return netDepositedAmount
  }

  // In the middle: calculate based on periods elapsed
  const elapsed = nowSeconds - startTime
  if (period <= 0n) {
    // Avoid division by zero — treat as fully vested if period is invalid
    return netDepositedAmount
  }

  const periodsElapsed = elapsed / period // BigInt division truncates (floor)
  let vestedAmount = cliffAmount + periodsElapsed * amountPerPeriod

  // Cap at net deposited
  if (vestedAmount > netDepositedAmount) {
    vestedAmount = netDepositedAmount
  }

  return vestedAmount
}

// ─── Build VestingClaim from a stream ───

async function streamToClaim(
  accountPubkey: string,
  stream: StreamData,
  walletAddress: string,
  nowSeconds: bigint,
): Promise<VestingClaim | null> {
  // Skip empty streams
  if (stream.netDepositedAmount === 0n) return null

  const vestedAmount = calculateVestedAmount(stream, nowSeconds)
  const claimableAmount = vestedAmount > stream.withdrawnAmount
    ? vestedAmount - stream.withdrawnAmount
    : 0n

  // Resolve SPL token metadata (symbol + decimals)
  const tokenMeta = await resolveSPLToken(stream.mint)

  // Determine status (including depleted for canceled or fully withdrawn)
  let status: VestingClaim["status"]
  if (stream.canceledAt > 0n && claimableAmount > 0n) {
    status = "claimable" // Canceled but still has withdrawable tokens
  } else if (stream.canceledAt > 0n) {
    status = "depleted"
  } else if (claimableAmount <= 0n && vestedAmount >= stream.netDepositedAmount) {
    status = "depleted"
  } else if (claimableAmount > 0n) {
    status = "claimable"
  } else {
    status = "locked"
  }

  const lockedAmount = stream.netDepositedAmount > vestedAmount
    ? stream.netDepositedAmount - vestedAmount
    : 0n

  // Compute cliff date: start_time + cliff offset
  const cliffTimestamp = stream.startTime + stream.cliff

  return {
    id: accountPubkey,
    platform: "Streamflow",
    token: tokenMeta.symbol,
    tokenAddress: stream.mint,
    chain: "SOL",
    totalAmount: rawToDisplay(stream.netDepositedAmount, tokenMeta.decimals),
    claimedAmount: rawToDisplay(stream.withdrawnAmount, tokenMeta.decimals),
    claimableAmount: rawToDisplay(claimableAmount, tokenMeta.decimals),
    lockedAmount: rawToDisplay(lockedAmount, tokenMeta.decimals),
    usdValue: null,
    startDate: toEpochIso(stream.startTime),
    endDate: toEpochIso(stream.endTime),
    cliffDate: toEpochIso(cliffTimestamp),
    status,
    claimUrl: `https://app.streamflow.finance/contract/solana/mainnet/${accountPubkey}`,
    iconUrl: "https://app.streamflow.finance/icon/favicon.ico",
    walletAddress,
    contractAddress: STREAMFLOW_PROGRAM_ID,
    planId: accountPubkey,
  }
}

// ─── Fetch streams for a single Solana address ───

async function fetchStreamsForAddress(
  solanaAddress: string,
  timeoutMs: number,
): Promise<{ claims: VestingClaim[]; error?: string }> {
  try {
    const accounts = await withTimeout(
      solanaRpc<ProgramAccount[]>("getProgramAccounts", [
        STREAMFLOW_PROGRAM_ID,
        {
          encoding: "base64",
          filters: [
            {
              memcmp: {
                offset: OFFSETS.recipient,
                bytes: solanaAddress,
              },
            },
          ],
        },
      ]),
      timeoutMs,
      [] as ProgramAccount[],
    )

    if (!accounts || !Array.isArray(accounts)) {
      return { claims: [] }
    }

    const nowSeconds = BigInt(Math.floor(Date.now() / 1000))
    const claims: VestingClaim[] = []

    for (const account of accounts) {
      try {
        const base64Data = Array.isArray(account.account.data)
          ? account.account.data[0]
          : account.account.data

        if (typeof base64Data !== "string") continue

        const stream = parseStreamAccount(base64Data)
        if (!stream) continue

        const claim = await streamToClaim(account.pubkey, stream, solanaAddress, nowSeconds)
        if (claim) {
          claims.push(claim)
        }
      } catch {
        // Skip malformed accounts silently
        continue
      }
    }

    return { claims }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { claims: [], error: msg }
  }
}

// ─── Exported Checker ───

export const streamflowChecker: VestingChecker = {
  platform: "Streamflow",
  iconUrl: "https://app.streamflow.finance/icon/favicon.ico",

  async check(
    _evmAddresses: string[],
    solanaAddresses: string[],
    options?: { timeout?: number },
  ): Promise<VestingScanResult> {
    const timeoutMs = options?.timeout ?? 15_000
    const allClaims: VestingClaim[] = []
    const errors: string[] = []

    for (const address of solanaAddresses) {
      try {
        const { claims, error } = await fetchStreamsForAddress(address, timeoutMs)

        if (error) {
          errors.push(`${address}: ${error}`)
        }

        allClaims.push(...claims)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        errors.push(`${address}: ${msg}`)
      }
    }

    return {
      claims: allClaims,
      platform: "Streamflow",
      chainsChecked: ["SOL"],
      ...(errors.length > 0 ? { error: errors.join("; ") } : {}),
    }
  },
}
