"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { useSaveCreditCard } from "@/hooks/use-finance"

interface CardEditModalProps {
  open: boolean
  onClose: () => void
  card: {
    readonly accountId: string
    readonly cardName: string
    readonly cardNetwork: string
    readonly annualFee: number
    readonly rewardType: string
    readonly annualFeeDate?: string | null
    readonly cardImageUrl?: string | null
  }
}

const NETWORKS = [
  { value: "visa", label: "Visa" },
  { value: "mastercard", label: "Mastercard" },
  { value: "amex", label: "American Express" },
  { value: "discover", label: "Discover" },
] as const

const REWARD_TYPES = [
  { value: "cashback", label: "Cash Back" },
  { value: "points", label: "Points" },
  { value: "miles", label: "Miles" },
] as const

export function CardEditModal({ open, onClose, card }: CardEditModalProps) {
  const [cardName, setCardName] = useState(card.cardName)
  const [cardNetwork, setCardNetwork] = useState(card.cardNetwork)
  const [annualFee, setAnnualFee] = useState(String(card.annualFee))
  const [rewardType, setRewardType] = useState(card.rewardType)
  const [annualFeeDate, setAnnualFeeDate] = useState(
    card.annualFeeDate ? card.annualFeeDate.slice(0, 10) : ""
  )
  const [cardImageUrl, setCardImageUrl] = useState(card.cardImageUrl ?? "")

  const saveCreditCard = useSaveCreditCard()

  const handleSave = () => {
    saveCreditCard.mutate(
      {
        accountId: card.accountId,
        cardName: cardName.trim(),
        cardNetwork,
        annualFee: parseFloat(annualFee) || 0,
        rewardType,
        annualFeeDate: annualFeeDate ? `${annualFeeDate}T00:00:00.000Z` : undefined,
        cardImageUrl: cardImageUrl.trim() || undefined,
      },
      { onSuccess: onClose },
    )
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg mx-4 bg-card border border-card-border rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-card-border/50">
          <h2 className="text-lg font-bold text-foreground">Edit Card</h2>
          <button
            onClick={onClose}
            className="size-8 rounded-lg flex items-center justify-center text-foreground-muted hover:text-foreground hover:bg-card-elevated transition-colors"
          >
            <span className="material-symbols-rounded" style={{ fontSize: 20 }}>close</span>
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {/* Card Name */}
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-widest text-foreground-muted block mb-1.5">
              Card Name
            </label>
            <input
              type="text"
              value={cardName}
              onChange={(e) => setCardName(e.target.value)}
              placeholder="e.g., Chase Sapphire Reserve"
              className="w-full px-3 py-2.5 rounded-lg bg-background border border-card-border text-sm text-foreground placeholder:text-foreground-muted/50 focus:outline-none focus:border-primary transition-colors"
            />
          </div>

          {/* Network + Reward Type row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-widest text-foreground-muted block mb-1.5">
                Network
              </label>
              <select
                value={cardNetwork}
                onChange={(e) => setCardNetwork(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg bg-background border border-card-border text-sm text-foreground focus:outline-none focus:border-primary transition-colors"
              >
                {NETWORKS.map((n) => (
                  <option key={n.value} value={n.value}>{n.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-widest text-foreground-muted block mb-1.5">
                Reward Type
              </label>
              <select
                value={rewardType}
                onChange={(e) => setRewardType(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg bg-background border border-card-border text-sm text-foreground focus:outline-none focus:border-primary transition-colors"
              >
                {REWARD_TYPES.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Annual Fee + Fee Date */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-widest text-foreground-muted block mb-1.5">
                Annual Fee
              </label>
              <input
                type="number"
                value={annualFee}
                onChange={(e) => setAnnualFee(e.target.value)}
                min={0}
                step={1}
                className="w-full px-3 py-2.5 rounded-lg bg-background border border-card-border text-sm text-foreground placeholder:text-foreground-muted/50 focus:outline-none focus:border-primary transition-colors"
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-widest text-foreground-muted block mb-1.5">
                Fee Date
              </label>
              <input
                type="date"
                value={annualFeeDate}
                onChange={(e) => setAnnualFeeDate(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg bg-background border border-card-border text-sm text-foreground placeholder:text-foreground-muted/50 focus:outline-none focus:border-primary transition-colors"
              />
            </div>
          </div>

          {/* Card Image URL */}
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-widest text-foreground-muted block mb-1.5">
              Card Image URL
            </label>
            <input
              type="url"
              value={cardImageUrl}
              onChange={(e) => setCardImageUrl(e.target.value)}
              placeholder="https://... (paste a card image URL)"
              className="w-full px-3 py-2.5 rounded-lg bg-background border border-card-border text-sm text-foreground placeholder:text-foreground-muted/50 focus:outline-none focus:border-primary transition-colors"
            />
            <p className="text-[10px] text-foreground-muted mt-1">
              Paste a URL to a card image to replace the generated visual
            </p>
          </div>

          {/* Image Preview */}
          {cardImageUrl.trim() && (
            <div className="rounded-xl overflow-hidden border border-card-border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={cardImageUrl.trim()}
                alt="Card preview"
                className="w-full aspect-[1.586/1] object-cover"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }}
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-card-border/50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-foreground-muted hover:text-foreground transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!cardName.trim() || saveCreditCard.isPending}
            className={cn(
              "px-5 py-2 rounded-lg text-sm font-semibold transition-all",
              saveCreditCard.isPending
                ? "bg-card-elevated text-foreground-muted cursor-not-allowed"
                : "bg-primary text-white hover:bg-primary-hover active:scale-95",
            )}
          >
            {saveCreditCard.isPending ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  )
}
