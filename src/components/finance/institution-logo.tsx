"use client"

import { useState } from "react"

interface InstitutionLogoProps {
  src?: string | null
  size?: number // tailwind size (e.g. 7 = w-7 h-7)
}

const SIZE_MAP: Record<number, string> = {
  6: "w-6 h-6",
  7: "w-7 h-7",
  8: "w-8 h-8",
  9: "w-9 h-9",
  10: "w-10 h-10",
}

const ICON_SIZE_MAP: Record<number, number> = {
  6: 12,
  7: 14,
  8: 16,
  9: 18,
  10: 20,
}

export function InstitutionLogo({ src, size = 7 }: InstitutionLogoProps) {
  const [imgError, setImgError] = useState(false)
  const sizeClass = SIZE_MAP[size] ?? "w-7 h-7"
  const iconSize = ICON_SIZE_MAP[size] ?? 14

  if (src && !imgError) {
    // Handle raw base64 stored without the data URI prefix
    const imgSrc = src.length > 100 && !src.startsWith("http") && !src.startsWith("data:")
      ? `data:image/png;base64,${src}`
      : src

    return (
      <img
        src={imgSrc}
        alt=""
        className={`${sizeClass} rounded object-contain flex-shrink-0`}
        onError={() => setImgError(true)}
      />
    )
  }

  return (
    <div className={`${sizeClass} rounded bg-primary/10 flex items-center justify-center flex-shrink-0`}>
      <span className="material-symbols-rounded text-primary" style={{ fontSize: iconSize }}>
        account_balance
      </span>
    </div>
  )
}
