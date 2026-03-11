"use client"

import { useState } from "react"
import { getChainColor } from "@/lib/portfolio/chains"

interface ChainIconProps {
  chainId: string
  size?: number
  className?: string
}

/** Map internal chain IDs → DefiLlama icon slug */
const LLAMA_SLUG: Record<string, string> = {
  ETH: "ethereum",
  ETHEREUM: "ethereum",
  BTC: "bitcoin",
  SOL: "solana",
  SOLANA: "solana",
  OPTIMISM: "optimism",
  ARBITRUM_ONE: "arbitrum",
  BASE: "base",
  POLYGON_POS: "polygon",
  AVAX: "avalanche",
  GNOSIS: "gnosis",
  BSC: "bsc",
  ZKSYNC: "zksync%20era",
  LINEA: "linea",
  SCROLL: "scroll",
  BLAST: "blast",
  MANTLE: "mantle",
  MODE: "mode",
  FANTOM: "fantom",
  ZORA: "zora",
  BERACHAIN: "berachain",
  MONAD: "monad",
}

function getLogoUrl(chainId: string): string | null {
  const slug = LLAMA_SLUG[chainId.toUpperCase()]
  if (!slug) return null
  return `https://icons.llamao.fi/icons/chains/rsz_${slug}.jpg`
}

export function ChainIcon({ chainId, size = 20, className }: ChainIconProps) {
  const [imgError, setImgError] = useState(false)
  const logoUrl = getLogoUrl(chainId)

  if (logoUrl && !imgError) {
    return (
      <img
        src={logoUrl}
        alt={chainId}
        width={size}
        height={size}
        className={`inline-flex flex-shrink-0 ${className ?? ""}`}
        style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover" }}
        onError={() => setImgError(true)}
        loading="lazy"
      />
    )
  }

  // Fallback: colored circle with first letter
  const color = getChainColor(chainId)
  return (
    <span
      className={`inline-flex items-center justify-center flex-shrink-0 text-white font-bold ${className ?? ""}`}
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        backgroundColor: color,
        fontSize: size * 0.45,
      }}
    >
      {chainId.charAt(0).toUpperCase()}
    </span>
  )
}
