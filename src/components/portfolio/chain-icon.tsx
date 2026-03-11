"use client"

import { useState } from "react"
import { getChainColor, getChainMeta } from "@/lib/portfolio/chains"

interface ChainIconProps {
  chainId: string
  size?: number
  className?: string
}

/** Official logos from Trust Wallet assets repository */
function getTrustWalletLogoUrl(chainId: string): string | null {
  const meta = getChainMeta(chainId)
  if (!meta?.trustWalletName || meta.trustWalletName === "exchange") return null
  return `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/${meta.trustWalletName}/info/logo.png`
}

export function ChainIcon({ chainId, size = 20, className }: ChainIconProps) {
  const [imgError, setImgError] = useState(false)
  const logoUrl = getTrustWalletLogoUrl(chainId)

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
