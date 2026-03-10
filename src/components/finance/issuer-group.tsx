"use client"

import { CardGalleryItem } from "./card-gallery-item"

const ISSUER_COLORS: Record<string, string> = {
  chase: "#1e3a8a",
  amex: "#c4951a",
  "american express": "#c4951a",
  citi: "#003B70",
  "capital one": "#991b1b",
  discover: "#FF6000",
  "wells fargo": "#8b0000",
  "bank of america": "#012169",
  barclays: "#00AEEF",
  usaa: "#00529B",
  "us bank": "#D71E28",
}

const ISSUER_SHORT: Record<string, string> = {
  chase: "CHASE",
  amex: "AMEX",
  "american express": "AMEX",
  citi: "CITI",
  "capital one": "C1",
  discover: "DISC",
  "wells fargo": "WF",
  "bank of america": "BOA",
  barclays: "BARC",
  usaa: "USAA",
  "us bank": "USB",
}

interface GalleryCard {
  readonly id: string
  readonly cardName: string
  readonly cardNetwork: string
  readonly mask: string | null
  readonly balance: number
  readonly creditLimit: number
  readonly annualFee: number
  readonly rewardType: string
  readonly pointsBalance?: number | null
  readonly cashbackBalance?: number | null
  readonly annualFeeDate?: string | null
  readonly nextPaymentDueDate?: string | null
  readonly cardImageUrl?: string | null
  readonly accountType?: string
}

interface IssuerGroupProps {
  issuerName: string
  cards: readonly GalleryCard[]
}

export function IssuerGroup({ issuerName, cards }: IssuerGroupProps) {
  const issuerKey = issuerName.toLowerCase()
  const issuerColor = Object.entries(ISSUER_COLORS).find(([k]) => issuerKey.includes(k))?.[1] ?? "#6366f1"
  const issuerLabel = Object.entries(ISSUER_SHORT).find(([k]) => issuerKey.includes(k))?.[1]
    ?? issuerName.charAt(0).toUpperCase()

  return (
    <section>
      {/* Issuer header with divider line */}
      <div className="flex items-center gap-3 mb-5">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-[10px] font-black flex-shrink-0"
          style={{ backgroundColor: issuerColor }}
        >
          {issuerLabel}
        </div>
        <h3 className="text-lg font-bold text-foreground">{issuerName}</h3>
        <div className="h-px flex-grow bg-card-border/50" />
      </div>

      {/* Card gallery grid */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {cards.map((card) => (
          <CardGalleryItem
            key={card.id}
            card={{ ...card, issuer: issuerName }}
            href={`/finance/cards/${card.id}`}
          />
        ))}
      </div>
    </section>
  )
}
