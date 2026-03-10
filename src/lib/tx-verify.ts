import { parseEther, formatEther, type Hash } from "viem"
import { publicClient } from "./web3-client"

// Minimum confirmations required — 6 blocks (~72 s on mainnet) for strong finality
const MIN_CONFIRMATIONS = 6

// Known ERC-20 token contract addresses on Ethereum Mainnet (lowercase)
const TOKEN_CONTRACTS: Record<string, string> = {
  USDC: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
  USDT: "0xdac17f958d2ee523a2206206994597c13d831ec7",
}

// Supported currencies — anything else would bypass amount/recipient verification
const SUPPORTED_CURRENCIES = ["ETH", "USDC", "USDT"] as const
type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number]

// ERC-20 Transfer event topic: keccak256("Transfer(address,address,uint256)")
const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"

/**
 * Parse a decimal token-amount string to its smallest unit as BigInt.
 * Avoids floating-point precision loss from `parseFloat() * 10**decimals`.
 * e.g. parseTokenAmount("100000.07", 6) → 100000070000n
 */
function parseTokenAmount(amount: string, decimals: number): bigint {
  const [whole, frac = ""] = amount.split(".")
  const paddedFrac = frac.padEnd(decimals, "0").slice(0, decimals)
  return BigInt(whole + paddedFrac)
}

export interface TxVerificationResult {
  valid: boolean
  error?: string
  from?: string
  to?: string
  value?: string
  blockNumber?: number
  confirmations?: number
}

/**
 * Verify that a transaction exists on-chain and matches expected parameters.
 * Used to prevent fake or stolen contribution claims.
 *
 * Security guarantees:
 * - Rejects unsupported currencies (prevents bypass via unhandled currency paths)
 * - Requires a sender wallet (never skips the from-address check)
 * - For ERC-20: checks the transfer event came from the known token contract
 *   AND matches both the token-level sender (topic 1) and recipient (topic 2)
 * - Uses integer arithmetic for amount comparisons (no float precision loss)
 */
export async function verifyTransaction(
  txHash: string,
  expectedTo: string,
  expectedFromWallet: string,
  expectedMinAmount: string,
  currency: string = "ETH"
): Promise<TxVerificationResult> {
  try {
    // ── Reject unsupported currencies ─────────────────────────────────────────
    // Without this guard, unknown currency strings skip all amount/recipient checks.
    if (!SUPPORTED_CURRENCIES.includes(currency as SupportedCurrency)) {
      return { valid: false, error: `Unsupported currency: ${currency}. Contact admin.` }
    }

    // ── Sender wallet is mandatory ────────────────────────────────────────────
    // An empty expectedFromWallet would silently skip the sender check, allowing
    // any transaction to the payment wallet to be claimed by any user.
    if (!expectedFromWallet) {
      return { valid: false, error: "Sender wallet address is required for verification" }
    }

    // ── Validate tx hash format ───────────────────────────────────────────────
    if (!txHash.match(/^0x[a-fA-F0-9]{64}$/)) {
      return { valid: false, error: "Invalid transaction hash format" }
    }

    // ── Fetch receipt (confirms tx was mined and succeeded) ───────────────────
    const receipt = await publicClient.getTransactionReceipt({ hash: txHash as Hash })

    if (!receipt) {
      return { valid: false, error: "Transaction not found or not yet mined" }
    }

    if (receipt.status !== "success") {
      return { valid: false, error: "Transaction failed on-chain" }
    }

    // ── Confirmation count ────────────────────────────────────────────────────
    const currentBlock = await publicClient.getBlockNumber()

    // Guard against RPC inconsistency (current block behind receipt block)
    if (currentBlock < receipt.blockNumber) {
      return { valid: false, error: "Block number inconsistency — please retry" }
    }

    const confirmations = Number(currentBlock - receipt.blockNumber)

    if (confirmations < MIN_CONFIRMATIONS) {
      return {
        valid: false,
        error: `Transaction needs ${MIN_CONFIRMATIONS} confirmations, has ${confirmations}`,
        confirmations,
      }
    }

    // ── Fetch full transaction details ────────────────────────────────────────
    const tx = await publicClient.getTransaction({ hash: txHash as Hash })

    if (!tx) {
      return { valid: false, error: "Transaction details not found" }
    }

    // ── Sender verification (always enforced) ─────────────────────────────────
    if (tx.from.toLowerCase() !== expectedFromWallet.toLowerCase()) {
      return {
        valid: false,
        error: "Transaction sender does not match your wallet",
        from: tx.from,
      }
    }

    // ── ETH path ─────────────────────────────────────────────────────────────
    if (currency === "ETH") {
      if (tx.to?.toLowerCase() !== expectedTo.toLowerCase()) {
        return {
          valid: false,
          error: "Transaction recipient does not match payment wallet",
          to: tx.to || undefined,
        }
      }

      const expectedWei = parseEther(expectedMinAmount)
      if (tx.value < expectedWei) {
        return {
          valid: false,
          error: `Transaction amount ${formatEther(tx.value)} ETH is less than claimed ${expectedMinAmount} ETH`,
          value: formatEther(tx.value),
        }
      }

      return {
        valid: true,
        from: tx.from,
        to: tx.to || undefined,
        value: formatEther(tx.value),
        blockNumber: Number(receipt.blockNumber),
        confirmations,
      }
    }

    // ── ERC-20 path (USDC / USDT) ─────────────────────────────────────────────
    // Verify the Transfer event:
    //   1. Emitted by the KNOWN token contract (prevents fake Transfer events)
    //   2. topic[0] = Transfer event sig
    //   3. topic[1] = expected sender (prevents transferFrom theft)
    //   4. topic[2] = expected recipient (payment wallet)
    const expectedContract = TOKEN_CONTRACTS[currency]
    const decimals = 6 // Both USDC and USDT use 6 decimals

    // Pad 20-byte addresses to 32-byte topic format (left-pad with zeros)
    const paddedExpectedTo   = "0x" + expectedTo.slice(2).toLowerCase().padStart(64, "0")
    const paddedExpectedFrom = "0x" + expectedFromWallet.slice(2).toLowerCase().padStart(64, "0")

    const transferLogs = receipt.logs.filter(
      (log) =>
        log.address.toLowerCase() === expectedContract &&
        log.topics[0]?.toLowerCase() === TRANSFER_TOPIC &&
        log.topics[1]?.toLowerCase() === paddedExpectedFrom &&
        log.topics[2]?.toLowerCase() === paddedExpectedTo
    )

    if (transferLogs.length === 0) {
      return {
        valid: false,
        error: "No token transfer from your wallet to the payment wallet found in transaction",
      }
    }

    // Validate log data format before parsing
    const logData = transferLogs[0].data
    if (!logData || logData === "0x" || logData.length < 3) {
      return { valid: false, error: "Invalid transfer log data" }
    }

    // Sum all matching Transfer logs (handles edge cases with multiple transfers)
    let logAmount = 0n
    for (const log of transferLogs) {
      try {
        logAmount += BigInt(log.data)
      } catch {
        return { valid: false, error: "Invalid transfer log data encoding" }
      }
    }

    // Use integer arithmetic to avoid float precision loss
    const expectedAmount = parseTokenAmount(expectedMinAmount, decimals)

    if (logAmount < expectedAmount) {
      const actualFormatted = (logAmount / BigInt(10 ** decimals)).toString()
      return {
        valid: false,
        error: `Token transfer amount (${actualFormatted} ${currency}) is less than claimed amount`,
        value: actualFormatted,
      }
    }

    // Return the actual verified on-chain token amount (not the ETH value which is 0)
    const verifiedAmount = (logAmount / BigInt(10 ** decimals)).toString()

    return {
      valid: true,
      from: tx.from,
      to: expectedTo,
      value: verifiedAmount,
      blockNumber: Number(receipt.blockNumber),
      confirmations,
    }
  } catch (error) {
    console.error("[TX Verify] Error:", error)
    // Never expose raw RPC error messages to clients (may contain API keys or internal URLs)
    return {
      valid: false,
      error: "Transaction verification failed. Please try again or contact support.",
    }
  }
}
