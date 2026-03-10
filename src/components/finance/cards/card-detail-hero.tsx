import Link from "next/link"
import { formatCurrency } from "@/lib/utils"
import { CreditCardVisual } from "@/components/finance/credit-card-visual"
import type { CardAIEnrichedData } from "@/app/api/finance/cards/ai-enrich/route"

export function CardDetailHero({
  card,
  issuer,
  mask,
  balance,
  rewardsValue,
  rewardsLabel,
  creditLimit,
  aiData,
  onEditClick,
}: {
  card: { cardName: string; cardNetwork: string; cardImageUrl?: string | null; rewardProgram?: string | null; rewardType: string; annualFee?: number | null; baseRewardRate: number; annualFeeDate?: string | null }
  issuer: string
  mask: string | null
  balance: number
  rewardsValue: string
  rewardsLabel: string
  creditLimit: number
  aiData: CardAIEnrichedData | null
  onEditClick: () => void
}) {
  return (
    <div className="flex flex-col lg:flex-row gap-8 items-start">
      {/* Large Card Visual */}
      <div className="w-full lg:w-1/2">
        <div className="max-w-md">
          <CreditCardVisual
            cardName={card.cardName}
            cardNetwork={card.cardNetwork}
            issuer={issuer}
            mask={mask}
            imageUrl={card.cardImageUrl ?? undefined}
            className="shadow-2xl shadow-primary/10"
          />
        </div>
      </div>

      {/* Card Info */}
      <div className="w-full lg:w-1/2 flex flex-col gap-5">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground tracking-tight">{card.cardName}</h1>
            <p className="text-primary text-sm font-medium mt-1">
              {card.rewardProgram ?? `${card.rewardType.charAt(0).toUpperCase()}${card.rewardType.slice(1)} Card`}
            </p>
          </div>
          <button
            onClick={onEditClick}
            className="size-9 rounded-lg flex items-center justify-center text-foreground-muted hover:text-foreground hover:bg-card-elevated transition-colors flex-shrink-0"
            title="Edit card details"
          >
            <span className="material-symbols-rounded" style={{ fontSize: 20 }}>edit</span>
          </button>
        </div>

        {/* Balance + Rewards stat cards */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5 rounded-xl p-4 bg-card-elevated border border-card-border">
            <p className="text-foreground-muted text-[10px] font-semibold uppercase tracking-widest">Current Balance</p>
            <p className="text-foreground text-xl font-bold font-data tabular-nums">{formatCurrency(balance)}</p>
          </div>
          <div className="flex flex-col gap-1.5 rounded-xl p-4 bg-card-elevated border border-card-border">
            <p className="text-foreground-muted text-[10px] font-semibold uppercase tracking-widest">{rewardsLabel}</p>
            <div className="flex items-center gap-2">
              <span className="material-symbols-rounded text-primary" style={{ fontSize: 16 }}>stars</span>
              <p className="text-foreground text-xl font-bold font-data tabular-nums">{rewardsValue}</p>
            </div>
          </div>
        </div>

        {/* Key stats row */}
        <div className="flex gap-6 text-sm">
          {creditLimit > 0 && (
            <div>
              <span className="text-foreground-muted text-[10px] uppercase tracking-widest font-semibold block">Limit</span>
              <p className="font-data font-semibold tabular-nums">{formatCurrency(creditLimit)}</p>
            </div>
          )}
          {card.annualFee != null && card.annualFee > 0 && (
            <div>
              <span className="text-foreground-muted text-[10px] uppercase tracking-widest font-semibold block">Annual Fee</span>
              <p className="font-data font-semibold tabular-nums">{formatCurrency(card.annualFee)}</p>
            </div>
          )}
          {card.baseRewardRate > 0 && (
            <div>
              <span className="text-foreground-muted text-[10px] uppercase tracking-widest font-semibold block">Base Rate</span>
              <p className="font-data font-semibold tabular-nums">{card.baseRewardRate}x</p>
            </div>
          )}
          {card.annualFeeDate && (
            <div>
              <span className="text-foreground-muted text-[10px] uppercase tracking-widest font-semibold block">Fee Date</span>
              <p className="font-data font-semibold tabular-nums">
                {new Date(card.annualFeeDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </p>
            </div>
          )}
          {aiData?.foreignTransactionFee && (
            <div>
              <span className="text-foreground-muted text-[10px] uppercase tracking-widest font-semibold block">Foreign TX Fee</span>
              <p className="font-data font-semibold tabular-nums">{aiData.foreignTransactionFee}</p>
            </div>
          )}
        </div>

        <Link
          href="/finance/transactions"
          className="w-full py-3 bg-primary text-white font-semibold rounded-xl hover:bg-primary-hover active:opacity-90 transition-all text-center text-sm block"
        >
          View Transactions
        </Link>
      </div>
    </div>
  )
}
