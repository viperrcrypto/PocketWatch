"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { getChainColor, hexToRgba } from "@/lib/portfolio/chains"
import { ChainIcon } from "@/components/portfolio/chain-icon"
import { getTokenImageUrl, getNativeChainKey } from "@/lib/portfolio/token-image"

/**
 * Build a CoinCap CDN URL from a token symbol.
 * Works for most top tokens (BTC, ETH, USDC, USDT, DAI, LINK, UNI, etc.)
 */
function getCoinCapUrl(symbol: string): string {
  return `https://assets.coincap.io/assets/icons/${symbol.toLowerCase()}@2x.png`
}

/**
 * Hardcoded icon URLs for tokens where Zerion/TrustWallet/CoinCap CDN
 * don't reliably provide icons. Keyed by UPPERCASE symbol.
 */
const KNOWN_TOKEN_ICONS: Record<string, string> = {
  MILADY: "https://coin-images.coingecko.com/coins/images/26540/small/256x256.png?1696525614",
  LOCK: "https://coin-images.coingecko.com/coins/images/35132/small/LOCK_Logo.png?1707443455",
  LADYS: "https://coin-images.coingecko.com/coins/images/30570/small/milady_200.png?1696091474",
  RLUSD: "https://coin-images.coingecko.com/coins/images/44823/small/rlusd-icon-1000px.png",
  AETHRLUSD: "https://coin-images.coingecko.com/coins/images/44823/small/rlusd-icon-1000px.png",
  PYUSD: "https://coin-images.coingecko.com/coins/images/31212/small/PYUSD_Logo_%282%29.png",
  AETHPYUSD: "https://coin-images.coingecko.com/coins/images/31212/small/PYUSD_Logo_%282%29.png",
  USDE: "https://coin-images.coingecko.com/coins/images/33613/small/usde.png",
  SUSDE: "https://coin-images.coingecko.com/coins/images/33669/small/sUSDe.png",
  KING: "https://coin-images.coingecko.com/coins/images/35354/small/KING.png",
  PENDLE: "https://coin-images.coingecko.com/coins/images/15069/small/Pendle_Logo_Normal-03.png",
}

function getKnownTokenIcon(symbol: string): string | null {
  return KNOWN_TOKEN_ICONS[symbol.toUpperCase()] ?? null
}

interface PortfolioAssetIconProps {
  asset: string
  assetId?: string
  chain?: string
  iconUrl?: string | null
  size?: number
  showChainBadge?: boolean
  className?: string
}

export function PortfolioAssetIcon({ asset, assetId, chain, iconUrl, size = 32, showChainBadge = true, className }: PortfolioAssetIconProps) {
  // 0 = zerion/primary, 1 = Trust Wallet CDN, 2 = CoinCap, 3 = known token icon, 4 = initials
  const [imgStage, setImgStage] = useState(0)

  const initials = asset.slice(0, 3).toUpperCase()
  const fontSize = size < 24 ? 8 : size < 36 ? 10 : 12
  const chainColor = chain ? getChainColor(chain) : null

  // Check if this is a native chain token (ETH, BTC, SOL, etc.)
  const nativeChainKey = getNativeChainKey(assetId ?? asset, chain)

  // Stage 0: Zerion icon URL (highest quality, direct from API)
  // Stage 1: Trust Wallet CDN for CAIP-19 tokens
  // Stage 2: CoinCap CDN using the display symbol
  // Stage 3: Known token icon (hardcoded CoinGecko URLs for niche tokens)
  // Stage 4: Initials fallback
  const trustWalletUrl = !nativeChainKey ? getTokenImageUrl(assetId ?? asset, chain) : null
  const coinCapUrl = !nativeChainKey ? getCoinCapUrl(asset) : null
  const knownIconUrl = !nativeChainKey ? getKnownTokenIcon(asset) : null

  // Determine which image URL to show based on current stage
  let imageUrl: string | null = null
  if (!nativeChainKey) {
    if (imgStage === 0 && iconUrl) {
      imageUrl = iconUrl
    } else if (imgStage <= 1 && trustWalletUrl) {
      imageUrl = trustWalletUrl
    } else if (imgStage <= 2 && coinCapUrl) {
      imageUrl = coinCapUrl
    } else if (imgStage <= 3 && knownIconUrl) {
      imageUrl = knownIconUrl
    }
    // imgStage >= 4 → no image, show initials
  }

  const handleImageError = () => {
    if (imgStage === 0 && iconUrl) {
      setImgStage(1) // Zerion failed → try Trust Wallet
    } else if (imgStage <= 1 && trustWalletUrl) {
      setImgStage(2) // Trust Wallet failed → try CoinCap
    } else if (imgStage <= 2 && coinCapUrl) {
      setImgStage(3) // CoinCap failed → try known token icon
    } else {
      setImgStage(4) // All failed → show initials
    }
  }

  const badgeSize = Math.max(14, Math.round(size * 0.5))

  return (
    <div className={cn("relative inline-flex flex-shrink-0", className)}>
      {/* Main asset circle */}
      <div
        className="flex items-center justify-center overflow-hidden"
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          background: nativeChainKey
            ? hexToRgba(getChainColor(nativeChainKey), 0.15)
            : chainColor ? hexToRgba(chainColor, 0.12) : "var(--card-elevated)",
          border: `1px solid ${nativeChainKey
            ? hexToRgba(getChainColor(nativeChainKey), 0.35)
            : chainColor ? hexToRgba(chainColor, 0.3) : "var(--card-border)"}`,
        }}
      >
        {nativeChainKey ? (
          <ChainIcon chainId={nativeChainKey} size={Math.round(size * 0.7)} />
        ) : imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt={asset}
            width={size}
            height={size}
            style={{ borderRadius: "50%", objectFit: "cover" }}
            onError={handleImageError}
          />
        ) : (
          <span
            className="font-data font-semibold uppercase tracking-wide"
            style={{
              fontSize,
              color: chainColor ?? "var(--foreground-muted)",
            }}
          >
            {initials}
          </span>
        )}
      </div>

      {/* Chain logo sub-badge (circle over circle) — hide for native tokens */}
      {showChainBadge && chain && !nativeChainKey && (
        <span
          className="absolute flex items-center justify-center"
          style={{
            bottom: -1,
            right: -1,
            width: badgeSize,
            height: badgeSize,
            borderRadius: "50%",
            backgroundColor: "var(--background)",
            border: "1.5px solid var(--background)",
            overflow: "hidden",
            boxShadow: "0 0 0 1px rgba(255,255,255,0.06)",
          }}
        >
          <ChainIcon chainId={chain} size={Math.round(badgeSize * 0.82)} />
        </span>
      )}
    </div>
  )
}
