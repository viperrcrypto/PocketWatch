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

/**
 * Fallback logos for chains not yet in the Trust Wallet assets repository.
 * Keys are trustWalletName values from the chain registry.
 */
const ALT_LOGO_URLS: Record<string, string> = {
  mantle: "https://icons.llamao.fi/icons/chains/rsz_mantle.jpg",
  mode: "https://icons.llamao.fi/icons/chains/rsz_mode.jpg",
  monad: "https://icons.llamao.fi/icons/chains/rsz_monad.jpg",
  zora: "https://icons.llamao.fi/icons/chains/rsz_zora.jpg",
}

function getAltLogoUrl(chainId: string): string | null {
  const meta = getChainMeta(chainId)
  if (!meta?.trustWalletName) return null
  return ALT_LOGO_URLS[meta.trustWalletName] ?? null
}

export function ChainIcon({ chainId, size = 20, className }: ChainIconProps) {
  const [twError, setTwError] = useState(false)
  const [altError, setAltError] = useState(false)
  const logoUrl = getTrustWalletLogoUrl(chainId)
  const altUrl = getAltLogoUrl(chainId)

  if (logoUrl && !twError) {
    return (
      <img
        src={logoUrl}
        alt={chainId}
        width={size}
        height={size}
        className={`inline-flex flex-shrink-0 ${className ?? ""}`}
        style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover" }}
        onError={() => setTwError(true)}
        loading="lazy"
      />
    )
  }

  if (altUrl && !altError) {
    return (
      <img
        src={altUrl}
        alt={chainId}
        width={size}
        height={size}
        className={`inline-flex flex-shrink-0 ${className ?? ""}`}
        style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover" }}
        onError={() => setAltError(true)}
        loading="lazy"
      />
    )
  }

  // Final fallback: colored circle with first letter
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
