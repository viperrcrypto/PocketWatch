"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { getKnownCardImage } from "./card-image-map"

/* ── Issuer Detection ─────────────────────────────────────────────── */

const INSTITUTION_TO_ISSUER: Record<string, string> = {
  "american express": "American Express",
  "amex": "American Express",
  "chase": "Chase",
  "jpmorgan chase": "Chase",
  "citibank": "Citi",
  "citi": "Citi",
  "capital one": "Capital One",
  "discover": "Discover",
  "discover bank": "Discover",
  "wells fargo": "Wells Fargo",
  "bank of america": "Bank of America",
  "barclays": "Barclays",
  "us bank": "US Bank",
  "usaa": "USAA",
}

/**
 * Detect card issuer from institution name (primary) and card name (fallback).
 * Returns a canonical issuer name for grouping and visual matching.
 */
export function detectIssuer(institutionName: string, cardName: string): string {
  // 1. Check institutionName first (substring match against known issuers)
  const instLower = institutionName.toLowerCase()
  for (const [key, issuer] of Object.entries(INSTITUTION_TO_ISSUER)) {
    if (instLower.includes(key)) return issuer
  }

  // 2. Fall back to card name pattern matching
  const name = cardName.toLowerCase()
  if (name.includes("chase") || name.includes("sapphire") || name.includes("freedom") || name.includes("ink")) return "Chase"
  if (name.includes("amex") || name.includes("american express") || name.includes("platinum") || name.includes("gold")) return "American Express"
  if (name.includes("citi") || name.includes("double cash")) return "Citi"
  if (name.includes("capital one") || name.includes("venture") || name.includes("savor") || name.includes("quicksilver")) return "Capital One"
  if (name.includes("discover")) return "Discover"
  if (name.includes("wells fargo")) return "Wells Fargo"
  if (name.includes("bank of america")) return "Bank of America"
  if (name.includes("barclays")) return "Barclays"

  // 3. Use institution name as-is if available (better than "Other")
  if (institutionName.trim()) return institutionName.trim()

  return "Other"
}

/* ── Card Design ──────────────────────────────────────────────────── */

interface CardDesign {
  readonly gradient: string
  readonly chipColor: string
  readonly label: string
  readonly decorStyle: "orb" | "dots" | "carbon" | "none"
  readonly labelStyle?: string
}

function getCardDesign(cardName: string, cardNetwork: string, issuer: string): CardDesign {
  const name = cardName.toLowerCase()
  const iss = issuer.toLowerCase()

  // ── Chase ──────────────────────────────────────────────
  if (iss === "chase") {
    if (name.includes("sapphire") && name.includes("reserve"))
      return { gradient: "from-[#0c1d3a] to-[#1a3a6a]", chipColor: "bg-yellow-500/80", label: "SAPPHIRE RESERVE", decorStyle: "orb" }
    if (name.includes("sapphire"))
      return { gradient: "from-[#1e3a8a] to-[#2563eb]", chipColor: "bg-yellow-500/80", label: "SAPPHIRE", decorStyle: "orb" }
    if (name.includes("freedom"))
      return { gradient: "from-slate-800 to-slate-600", chipColor: "bg-slate-400/80", label: "FREEDOM", decorStyle: "dots" }
    if (name.includes("ink"))
      return { gradient: "from-slate-900 to-slate-700", chipColor: "bg-yellow-500/80", label: "INK", decorStyle: "dots" }
    if (name.includes("amazon"))
      return { gradient: "from-[#131921] to-[#232f3e]", chipColor: "bg-yellow-500/80", label: "AMAZON", decorStyle: "none" }
    return { gradient: "from-blue-900 to-blue-700", chipColor: "bg-yellow-400/70", label: "CHASE", decorStyle: "orb" }
  }

  // ── American Express ───────────────────────────────────
  if (iss === "american express" || iss === "amex") {
    if (name.includes("gold"))
      return { gradient: "from-[#c4951a] to-[#8b6914]", chipColor: "bg-white/30", label: "GOLD", decorStyle: "carbon", labelStyle: "border border-white/40 px-1.5 py-0.5 rounded text-[8px]" }
    if (name.includes("platinum"))
      return { gradient: "from-[#7c7c7c] to-[#4a4a4a]", chipColor: "bg-white/30", label: "PLATINUM", decorStyle: "carbon", labelStyle: "border border-white/40 px-1.5 py-0.5 rounded text-[8px]" }
    if (name.includes("green"))
      return { gradient: "from-emerald-700 to-emerald-900", chipColor: "bg-white/30", label: "GREEN", decorStyle: "carbon" }
    if (name.includes("blue business") || name.includes("blue cash") || name.includes("blue"))
      return { gradient: "from-[#006fcf] to-[#003b8e]", chipColor: "bg-yellow-400/70", label: "BLUE", decorStyle: "carbon" }
    if (name.includes("delta"))
      return { gradient: "from-[#003366] to-[#001a33]", chipColor: "bg-yellow-400/70", label: "DELTA", decorStyle: "carbon" }
    if (name.includes("hilton"))
      return { gradient: "from-[#002855] to-[#001a3a]", chipColor: "bg-yellow-400/70", label: "HILTON", decorStyle: "carbon" }
    if (name.includes("marriott"))
      return { gradient: "from-[#7c2d12] to-[#431407]", chipColor: "bg-yellow-400/70", label: "MARRIOTT", decorStyle: "carbon" }
    return { gradient: "from-[#006fcf] to-[#004a8f]", chipColor: "bg-white/30", label: "AMEX", decorStyle: "carbon" }
  }

  // ── Capital One ────────────────────────────────────────
  if (iss === "capital one") {
    if (name.includes("venture"))
      return { gradient: "from-[#991b1b] to-[#5a1010]", chipColor: "bg-slate-300/40", label: "VENTURE X", decorStyle: "orb" }
    if (name.includes("savor"))
      return { gradient: "from-[#6d28d9] to-[#4c1d95]", chipColor: "bg-slate-300/40", label: "SAVOR", decorStyle: "orb" }
    if (name.includes("quicksilver"))
      return { gradient: "from-slate-700 to-slate-500", chipColor: "bg-slate-300/40", label: "QUICKSILVER", decorStyle: "none" }
    return { gradient: "from-red-800 to-red-950", chipColor: "bg-slate-300/40", label: "CAPITAL ONE", decorStyle: "orb" }
  }

  // ── Citi ───────────────────────────────────────────────
  if (iss === "citi") {
    if (name.includes("double cash"))
      return { gradient: "from-[#003b70] to-[#001f3f]", chipColor: "bg-slate-400/60", label: "DOUBLE CASH", decorStyle: "none" }
    if (name.includes("premier"))
      return { gradient: "from-[#003b70] to-[#001f3f]", chipColor: "bg-yellow-400/70", label: "PREMIER", decorStyle: "none" }
    return { gradient: "from-blue-800 to-blue-950", chipColor: "bg-slate-400/60", label: "CITI", decorStyle: "none" }
  }

  // ── Other Issuers ──────────────────────────────────────
  if (iss === "discover")
    return { gradient: "from-orange-500 to-orange-700", chipColor: "bg-white/40", label: "DISCOVER", decorStyle: "none" }
  if (iss === "wells fargo")
    return { gradient: "from-red-700 to-[#8b0000]", chipColor: "bg-yellow-400/60", label: "WELLS FARGO", decorStyle: "none" }
  if (iss === "bank of america")
    return { gradient: "from-[#012169] to-[#001340]", chipColor: "bg-slate-400/60", label: "BOA", decorStyle: "none" }
  if (iss === "barclays")
    return { gradient: "from-cyan-600 to-cyan-800", chipColor: "bg-white/40", label: "BARCLAYS", decorStyle: "none" }

  // ── Fallback by network ────────────────────────────────
  const networkDefaults: Record<string, CardDesign> = {
    visa: { gradient: "from-blue-800 to-blue-950", chipColor: "bg-yellow-400/60", label: "", decorStyle: "none" },
    mastercard: { gradient: "from-gray-800 to-gray-950", chipColor: "bg-yellow-400/60", label: "", decorStyle: "none" },
    amex: { gradient: "from-[#006fcf] to-[#004a8f]", chipColor: "bg-white/30", label: "AMEX", decorStyle: "carbon" },
    discover: { gradient: "from-orange-500 to-orange-700", chipColor: "bg-white/40", label: "DISCOVER", decorStyle: "none" },
  }
  return networkDefaults[cardNetwork] ?? { gradient: "from-gray-700 to-gray-900", chipColor: "bg-gray-400/60", label: "", decorStyle: "none" }
}

function NetworkLogo({ network }: { network: string }) {
  switch (network) {
    case "mastercard":
      return (
        <div className="flex">
          <div className="size-6 rounded-full bg-red-500/80" />
          <div className="size-6 rounded-full bg-orange-400/80 -ml-2.5" />
        </div>
      )
    case "visa":
      return <span className="text-white/70 text-xs font-bold italic tracking-wider">VISA</span>
    case "amex":
      return (
        <span className="material-symbols-rounded text-white/50" style={{ fontSize: 24 }}>
          account_balance
        </span>
      )
    case "discover":
      return <span className="text-white/70 text-[10px] font-bold tracking-wider">DISCOVER</span>
    default:
      return null
  }
}

interface CreditCardVisualProps {
  cardName: string
  cardNetwork: string
  issuer: string
  mask: string | null
  imageUrl?: string
  className?: string
}

export function CreditCardVisual({
  cardName, cardNetwork, issuer, mask, imageUrl, className,
}: CreditCardVisualProps) {
  const [imageFailed, setImageFailed] = useState(false)

  // Priority: DB image (AI-enriched) > known card map > procedural render
  const resolvedImage = imageUrl ?? getKnownCardImage(cardName, issuer)

  if (resolvedImage && !imageFailed) {
    return (
      <div className={cn(
        "relative w-full aspect-[1.586/1] rounded-xl overflow-hidden shadow-2xl",
        className,
      )}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={resolvedImage}
          alt={cardName}
          className="w-full h-full object-cover"
          onError={() => setImageFailed(true)}
        />
        {/* Last 4 digits overlay */}
        {mask && (
          <div className="absolute bottom-0 left-0 right-0 px-4 pb-3 pt-6 bg-gradient-to-t from-black/60 to-transparent">
            <p className="text-white font-mono tracking-[0.15em] text-sm drop-shadow-lg">
              {"•••• "}{mask}
            </p>
          </div>
        )}
      </div>
    )
  }

  const design = getCardDesign(cardName, cardNetwork, issuer)

  return (
    <div className={cn(
      "relative w-full aspect-[1.586/1] rounded-xl p-5 text-white overflow-hidden",
      "bg-gradient-to-br flex flex-col justify-between shadow-2xl",
      design.gradient, className,
    )}>
      {/* Decorative orbs */}
      {design.decorStyle === "orb" && (
        <>
          <div className="absolute -right-10 -top-10 size-40 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute -left-10 -bottom-10 size-48 bg-black/20 rounded-full blur-2xl" />
        </>
      )}

      {/* Decorative dot pattern */}
      {design.decorStyle === "dots" && (
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: "radial-gradient(circle at 2px 2px, white 1px, transparent 0)",
            backgroundSize: "12px 12px",
          }}
        />
      )}

      {/* Decorative fine lines */}
      {design.decorStyle === "carbon" && (
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.15) 2px, rgba(255,255,255,0.15) 4px)",
          }}
        />
      )}

      {/* Top: contactless + card label */}
      <div className="flex justify-between items-start relative z-10">
        <span className="material-symbols-rounded text-white/80" style={{ fontSize: 28 }}>
          contactless
        </span>
        {design.label && (
          <span className={cn(
            "text-white/50 text-[10px] font-bold uppercase tracking-wider",
            design.labelStyle,
          )}>
            {design.label}
          </span>
        )}
      </div>

      {/* Middle: chip + card number */}
      <div className="relative z-10">
        <div className={cn("w-10 h-7 rounded-sm mb-3", design.chipColor)} />
        <p className="text-white font-mono tracking-[0.15em] text-base">
          {"•••• "}{mask ?? "••••"}
        </p>
      </div>

      {/* Bottom: cardholder + network logo */}
      <div className="flex justify-between items-end relative z-10">
        <p className="text-white/60 text-[10px] font-medium uppercase tracking-wide">
          Card Member
        </p>
        <NetworkLogo network={cardNetwork} />
      </div>
    </div>
  )
}
