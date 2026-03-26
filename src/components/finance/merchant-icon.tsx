"use client"

import { useState } from "react"
import { getCategoryMeta } from "@/lib/finance/categories"

interface MerchantIconProps {
  logoUrl?: string | null
  website?: string | null
  category?: string | null
  size?: "sm" | "md"
}

function faviconUrl(website: string): string | null {
  try {
    const host = website.includes("://") ? new URL(website).hostname : website.replace(/\/.*$/, "")
    if (!host || host.length < 3) return null
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64`
  } catch {
    return null
  }
}

export function MerchantIcon({ logoUrl, website, category, size = "md" }: MerchantIconProps) {
  const [imgFailed, setImgFailed] = useState(false)
  const [faviconFailed, setFaviconFailed] = useState(false)
  const meta = getCategoryMeta(category ?? "Uncategorized")

  const dims = size === "sm" ? "w-7 h-7" : "w-9 h-9"
  const iconSize = size === "sm" ? 14 : 18
  const roundedness = size === "sm" ? "rounded-full" : "rounded-xl"

  // Tier 1: Plaid logo
  if (logoUrl && !imgFailed) {
    return (
      <img
        src={logoUrl}
        alt=""
        className={`${dims} ${roundedness} object-cover flex-shrink-0 bg-white`}
        onError={() => setImgFailed(true)}
      />
    )
  }

  // Tier 2: Website favicon
  const favicon = website && !faviconFailed ? faviconUrl(website) : null
  if (favicon) {
    return (
      <img
        src={favicon}
        alt=""
        className={`${dims} ${roundedness} object-cover flex-shrink-0 bg-white`}
        onError={() => setFaviconFailed(true)}
      />
    )
  }

  // Tier 3: Category icon fallback
  return (
    <div
      className={`${dims} ${roundedness} flex items-center justify-center flex-shrink-0 shadow-sm`}
      style={{
        background: `linear-gradient(135deg, ${meta.hex}, color-mix(in srgb, ${meta.hex} 80%, #000))`,
      }}
    >
      <span
        className="material-symbols-rounded text-white drop-shadow-sm"
        style={{ fontSize: iconSize }}
      >
        {meta.icon}
      </span>
    </div>
  )
}
