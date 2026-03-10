/**
 * EtherFi vault balance reader.
 * Reads on-chain balanceOf for Katana BoringVault + liquidETH vault tokens,
 * then prices them via DeFiLlama coin pricing.
 */

import { getPublicClient, safeContractRead } from "../multi-chain-client"
import { formatUnits } from "viem"
import { getCurrentPrices } from "@/lib/defillama"

// ─── Vault definitions ───

const ETHERFI_VAULTS = [
  {
    address: "0x69d210d3b60E939BFA6E87cCcC4fAb7e8F44C16B",
    name: "Katana ETH Vault",
    symbol: "katanaETH",
    decimals: 18,
    coinId: "ethereum:0x69d210d3b60e939bfa6e87cccc4fab7e8f44c16b",
  },
  {
    address: "0xf0bb20865277abd641a307ece5ee04e79073416c",
    name: "Liquid ETH",
    symbol: "liquidETH",
    decimals: 18,
    coinId: "ethereum:0xf0bb20865277abd641a307ece5ee04e79073416c",
  },
] as const

const ERC20_BALANCE_ABI = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const

// ─── Types ───

export interface VaultPosition {
  vault: string
  symbol: string
  quantity: number
  price: number
  value: number
  chain: "ethereum"
  wallet: string
  contractAddress: string
}

// ─── Fetcher ───

export async function getEtherFiVaultBalances(
  walletAddresses: string[],
): Promise<VaultPosition[]> {
  const client = getPublicClient(1) // Ethereum mainnet
  if (!client) return []

  // Read balanceOf for each vault × wallet in parallel
  const balancePromises = ETHERFI_VAULTS.flatMap((vault) =>
    walletAddresses.map(async (wallet) => {
      const raw = await safeContractRead<bigint>(client, {
        address: vault.address as `0x${string}`,
        abi: ERC20_BALANCE_ABI,
        functionName: "balanceOf",
        args: [wallet as `0x${string}`],
      })
      if (!raw || raw === 0n) return null
      const quantity = parseFloat(formatUnits(raw, vault.decimals))
      return { vault, wallet, quantity }
    }),
  )

  const results = (await Promise.all(balancePromises)).filter(
    (r): r is NonNullable<typeof r> => r !== null,
  )
  if (results.length === 0) return []

  // Get prices from DeFiLlama
  const coinIds = [...new Set(results.map((r) => r.vault.coinId))]
  const tokens = coinIds.map((id) => {
    const [chain, address] = id.split(":")
    return { chain, address }
  })
  // Fallback anchor price for ETH-denominated vault tokens.
  tokens.push({ chain: "ethereum", address: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2" })

  const priceMap: Record<string, number> = {}
  let ethPrice = 0
  try {
    const priceData = await getCurrentPrices(tokens)
    for (const id of coinIds) {
      const entry = priceData.coins[id]
      if (entry?.price) priceMap[id] = entry.price
    }
    ethPrice = priceData.coins["ethereum:0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2"]?.price ?? 0
  } catch (err) {
    console.warn("[etherfi-vaults] Price fetch failed:", err)
  }

  const positions: VaultPosition[] = []
  for (const r of results) {
    const fallbackEth = /eth/i.test(r.vault.symbol) ? ethPrice : 0
    const price = priceMap[r.vault.coinId] ?? fallbackEth
    positions.push({
      vault: r.vault.name,
      symbol: r.vault.symbol,
      quantity: r.quantity,
      price,
      value: r.quantity * price,
      chain: "ethereum",
      wallet: r.wallet,
      contractAddress: r.vault.address,
    })
  }

  return positions
}
