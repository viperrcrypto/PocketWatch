// External chart and trade links for the Wallet Tracker.
// Provides chart analysis links, DEX trade links, and Telegram bot URLs.

import type { TrackerChain } from "./types"

export interface ExternalLink {
  name: string
  url: string
}

// ─── Chain Slug Maps ───

const DEXSCREENER_CHAIN: Record<TrackerChain, string> = {
  ETHEREUM: "ethereum",
  ARBITRUM: "arbitrum",
  BASE: "base",
  POLYGON: "polygon",
  BSC: "bsc",
  SOLANA: "solana",
  OPTIMISM: "optimism",
  LINEA: "linea",
  SCROLL: "scroll",
  ZKSYNC: "zksync",
}

const GMGN_CHAIN: Record<TrackerChain, string> = {
  ETHEREUM: "eth",
  ARBITRUM: "arb",
  BASE: "base",
  POLYGON: "polygon",
  BSC: "bsc",
  SOLANA: "sol",
  OPTIMISM: "optimism",
  LINEA: "linea",
  SCROLL: "scroll",
  ZKSYNC: "zksync",
}

const BIRDEYE_CHAIN: Record<TrackerChain, string> = {
  ETHEREUM: "ethereum",
  ARBITRUM: "arbitrum",
  BASE: "base",
  POLYGON: "polygon",
  BSC: "bsc",
  SOLANA: "solana",
  OPTIMISM: "optimism",
  LINEA: "linea",
  SCROLL: "scroll",
  ZKSYNC: "zksync",
}

const BULLX_CHAINID: Record<TrackerChain, number> = {
  ETHEREUM: 1,
  ARBITRUM: 42161,
  BASE: 8453,
  POLYGON: 137,
  BSC: 56,
  SOLANA: 1399811149,
  OPTIMISM: 10,
  LINEA: 59144,
  SCROLL: 534352,
  ZKSYNC: 324,
}

// ─── Chart Links (GMGN, BE, DS, PH, BLX, AXI) ───

/** Returns chart/analytics links matching solanamanbot style. */
export function getChartLinks(chain: TrackerChain, tokenAddress: string): ExternalLink[] {
  const links: ExternalLink[] = [
    { name: "GMGN", url: getGmgnUrl(chain, tokenAddress) },
    { name: "BE", url: getBirdEyeUrl(chain, tokenAddress) },
    { name: "DS", url: getDexScreenerUrl(chain, tokenAddress) },
  ]

  if (chain === "SOLANA") {
    links.push(
      { name: "PH", url: `https://photon-sol.tinyastro.io/en/lp/${tokenAddress}` },
      { name: "BLX", url: `https://neo.bullx.io/terminal?chainId=${BULLX_CHAINID[chain]}&address=${tokenAddress}` },
      { name: "AXI", url: `https://axiom.trade/t/${tokenAddress}` },
    )
  } else {
    links.push(
      { name: "BLX", url: `https://neo.bullx.io/terminal?chainId=${BULLX_CHAINID[chain]}&address=${tokenAddress}` },
    )
  }

  return links
}

// ─── Trade Links (Trojan, BonkBot, Axiom, GMGN for Solana / DEX frontends for EVM) ───

/** Returns trade/buy links - Telegram bots for Solana, DEX frontends for EVM. */
export function getTradeLinks(chain: TrackerChain, tokenAddress: string): ExternalLink[] {
  if (chain === "SOLANA") {
    return [
      { name: "Trojan", url: getTrojanUrl(chain, tokenAddress) },
      { name: "BonkBot", url: getBonkBotUrl(chain, tokenAddress) },
      { name: "Axiom", url: getAxiomTradeUrl(chain, tokenAddress) },
      { name: "GMGN", url: `https://t.me/GMGN_sol_bot?start=i_trackme_c_${tokenAddress}` },
    ]
  }

  // EVM chains - link to DEX frontends
  const chainSlug = DEXSCREENER_CHAIN[chain]
  return [
    { name: "Uniswap", url: `https://app.uniswap.org/swap?outputCurrency=${tokenAddress}&chain=${chainSlug}` },
    { name: "1inch", url: `https://app.1inch.io/#/${BULLX_CHAINID[chain]}/simple/swap/ETH/${tokenAddress}` },
  ]
}

// ─── Individual URL Helpers (used by Telegram bot keyboards) ───

export function getGmgnUrl(chain: TrackerChain, tokenAddress: string): string {
  return `https://gmgn.ai/${GMGN_CHAIN[chain]}/token/${tokenAddress}`
}

export function getDexScreenerUrl(chain: TrackerChain, tokenAddress: string): string {
  return `https://dexscreener.com/${DEXSCREENER_CHAIN[chain]}/${tokenAddress}`
}

export function getBirdEyeUrl(chain: TrackerChain, tokenAddress: string): string {
  return `https://birdeye.so/token/${tokenAddress}?chain=${BIRDEYE_CHAIN[chain]}`
}

export function getTrojanUrl(_chain: TrackerChain, tokenAddress: string): string {
  return `https://t.me/paris_trojanbot?start=r-viperr-${tokenAddress}`
}

export function getBonkBotUrl(_chain: TrackerChain, tokenAddress: string): string {
  return `https://t.me/bonkbot_bot?start=ref_viperr_ca_${tokenAddress}`
}

export function getAxiomTradeUrl(_chain: TrackerChain, tokenAddress: string): string {
  return `https://axiom.trade/t/${tokenAddress}`
}

// ─── DexScreener Chart Embed ───

/** Returns the DexScreener chart embed URL for an iframe preview. Requires a pairAddress. */
export function getDexScreenerChartEmbed(chain: TrackerChain, pairAddress: string): string {
  return `https://dexscreener.com/${DEXSCREENER_CHAIN[chain]}/${pairAddress}?embed=1&theme=dark&info=0&trades=0`
}

/** Returns the DexScreener chain slug for a given TrackerChain. */
export function getDexScreenerChainSlug(chain: TrackerChain): string {
  return DEXSCREENER_CHAIN[chain]
}

// ─── Utility ───

/** Truncate an address to `0x1234...abcd` format. */
export function truncateAddress(address: string, chars = 4): string {
  if (!address) return ""
  if (address.length <= chars * 2 + 3) return address
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`
}
