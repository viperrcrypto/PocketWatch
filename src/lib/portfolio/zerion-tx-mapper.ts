/**
 * Maps Zerion transaction API responses to TransactionCache records.
 *
 * Key differences from Alchemy:
 * - One API call returns ALL chains at once (no per-chain phases)
 * - Zerion provides USD value at time of transaction
 * - Transfers have direction ("in" | "out") directly
 * - Multiple transfers per transaction → multiple TransactionCache rows
 */

// Zerion chain_id strings → our chain names (must match keys in CHAIN_REGISTRY
// or resolve via getChainMeta case-insensitive lookup).
const ZERION_CHAIN_TO_OUR: Record<string, string> = {
  ethereum: "ETHEREUM",
  arbitrum: "ARBITRUM",
  base: "BASE",
  polygon: "POLYGON",
  optimism: "OPTIMISM",
  avalanche: "AVALANCHE",
  bsc: "BSC",
  gnosis: "GNOSIS",
  fantom: "FANTOM",
  aurora: "AURORA",
  moonbeam: "MOONBEAM",
  moonriver: "MOONRIVER",
  celo: "CELO",
  "zksync-era": "ZKSYNC",
  linea: "LINEA",
  scroll: "SCROLL",
  mantle: "MANTLE",
  blast: "BLAST",
  manta: "MANTA",
  mode: "MODE",
  "polygon-zkevm": "POLYGON_ZKEVM",
  zora: "ZORA",
  berachain: "BERACHAIN",
}

export interface ZerionTransferQuantity {
  int?: string     // raw integer value (e.g., "1000000" for 1 USDC with 6 decimals)
  decimals?: number
  float?: number   // human-readable amount
  numeric?: string // decimal string representation
}

export interface ZerionTransfer {
  fungible_info?: {
    name?: string
    symbol?: string
    icon?: { url?: string }
    implementations?: Array<{
      chain_id: string
      address: string | null
      decimals: number
    }>
  } | null
  nft_info?: {
    contract_address?: string
    token_id?: string
    name?: string
    collection?: { name?: string }
  } | null
  direction: "in" | "out"
  quantity?: ZerionTransferQuantity
  value?: number | null   // USD value
  price?: number | null   // USD price per unit
}

export interface ZerionTransaction {
  id: string
  type: "transactions"
  attributes: {
    operation_type: string
    hash: string
    mined_at_block?: number | null
    mined_at: string
    sent_from: string
    sent_to?: string | null
    status: "confirmed" | "failed" | "pending"
    nonce?: number
    chain_id?: string  // Sometimes present in attributes
    transfers: ZerionTransfer[]
    fee?: {
      fungible_info?: { symbol?: string; decimals?: number }
      quantity?: ZerionTransferQuantity
      value?: number | null
      price?: number | null
    } | null
  }
  relationships?: {
    chain?: {
      data?: { type: string; id: string }
    }
  }
}

export interface ZerionTransactionsPage {
  links: { next?: string | null }
  data: ZerionTransaction[]
}

export interface TransactionCacheInsert {
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

/** Extract the page cursor from a Zerion `links.next` URL (null if no more pages). */
export function extractZerionCursor(linksNext: string | null | undefined): string | null {
  if (!linksNext) return null
  try {
    const url = new URL(linksNext)
    return url.searchParams.get("page[after]")
  } catch {
    return null
  }
}

/**
 * Map a single Zerion transaction to one or more TransactionCache rows.
 *
 * Each transfer in the transaction becomes a row. If there are no transfers
 * (e.g., an approval or failed tx), one placeholder row is created.
 */
export function zerionTxToRecords(
  tx: ZerionTransaction,
  userId: string,
  walletAddress: string,
): TransactionCacheInsert[] {
  const { attributes, relationships } = tx
  // chain_id may be in attributes (older API) or relationships.chain.data.id (current API)
  const rawChainId = attributes.chain_id ?? relationships?.chain?.data?.id
  const chain = rawChainId ? ZERION_CHAIN_TO_OUR[rawChainId] : undefined
  if (!chain) {
    if (rawChainId) console.warn(`[zerion-mapper] Skipping unsupported chain: ${rawChainId}`)
    return []
  }

  const blockTimestamp = Math.floor(new Date(attributes.mined_at).getTime() / 1000)
  const blockNumber = attributes.mined_at_block ?? 0
  const txHash = attributes.hash.toLowerCase()
  const txFrom = (attributes.sent_from ?? "").toLowerCase()
  const txTo = attributes.sent_to?.toLowerCase() ?? null
  const walletLower = walletAddress.toLowerCase()

  const records: TransactionCacheInsert[] = []

  for (const transfer of attributes.transfers) {
    const direction = transfer.direction // "in" | "out"

    // Infer per-transfer from/to so the unique key distinguishes in vs out rows.
    // "out": wallet sends → from=wallet, to=counterparty
    // "in": wallet receives → from=counterparty, to=wallet
    const fromAddr = direction === "in"
      ? (txFrom !== walletLower ? txFrom : txTo ?? null)
      : (txFrom === walletLower ? txFrom : txTo ?? txFrom)
    const toAddr   = direction === "in"  ? walletLower : txTo

    let asset: string | null = null
    let symbol: string | null = null
    let decimals: number | null = null
    let category: string

    if (transfer.nft_info) {
      category = "erc721"
      asset = transfer.nft_info.contract_address?.toLowerCase() ?? null
      const nftName = transfer.nft_info.collection?.name ?? transfer.nft_info.name ?? null
      const tokenId = transfer.nft_info.token_id
      symbol = nftName && tokenId ? `${nftName} #${tokenId}` : nftName
      decimals = 0
    } else if (transfer.fungible_info) {
      // Find the implementation on this specific chain for the contract address
      const impl = transfer.fungible_info.implementations?.find(
        (i) => i.chain_id === rawChainId,
      )
      if (impl?.address) {
        category = "erc20"
        asset = impl.address.toLowerCase()
        decimals = impl.decimals
      } else {
        // No contract address on this chain → native token
        category = "external"
        asset = "native"
        decimals = transfer.fungible_info.implementations?.[0]?.decimals ?? 18
      }
      symbol = transfer.fungible_info.symbol ?? null
    } else {
      continue // unknown transfer type — skip
    }

    records.push({
      userId,
      walletAddress: walletLower,
      chain,
      txHash,
      blockNumber,
      blockTimestamp,
      category,
      from: fromAddr ?? txFrom,
      to: toAddr,
      asset,
      symbol,
      decimals,
      rawValue: transfer.quantity?.int ?? null,
      value: transfer.quantity?.float ?? null,
      usdValue: transfer.value ?? null,
      direction,
    })
  }

  // Add gas fee as a separate row if present and non-zero
  const fee = attributes.fee
  if (fee && fee.quantity?.float && fee.quantity.float > 0) {
    records.push({
      userId,
      walletAddress: walletLower,
      chain,
      txHash,
      blockNumber,
      blockTimestamp,
      category: "gas",
      from: walletLower,
      to: null,
      asset: "native",
      symbol: fee.fungible_info?.symbol ?? null,
      decimals: fee.fungible_info?.decimals ?? 18,
      rawValue: fee.quantity.int ?? null,
      value: fee.quantity.float,
      usdValue: fee.value ?? null,
      direction: "out",
    })
  }

  // No transfers → skip approvals entirely, create placeholder only for non-approve contract calls
  if (records.length === 0 && attributes.status === "confirmed") {
    // Approvals produce no transfers and just clutter the history — skip them
    if (attributes.operation_type === "approve") return records

    records.push({
      userId,
      walletAddress: walletLower,
      chain,
      txHash,
      blockNumber,
      blockTimestamp,
      category: "external",
      from: txFrom,
      to: txTo,
      asset: "native",
      symbol: null,
      decimals: null,
      rawValue: null,
      value: 0,
      usdValue: null,
      direction: txFrom === walletLower ? "out" : "in",
    })
  }

  return records
}
