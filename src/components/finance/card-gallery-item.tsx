import Link from "next/link"
import { formatCurrency, cn } from "@/lib/utils"
import { CreditCardVisual } from "./credit-card-visual"
import { getKnownAnnualFee } from "./card-image-map"

interface CardGalleryItemProps {
  card: {
    readonly id: string
    readonly cardName: string
    readonly cardNetwork: string
    readonly issuer: string
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
  href: string
}

export function CardGalleryItem({ card, href }: CardGalleryItemProps) {
  const isBusiness = card.accountType === "business_credit" || /business/i.test(card.cardName)
  // Use known annual fee as fallback when DB has $0 but we know the real fee
  const effectiveAnnualFee = card.annualFee > 0
    ? card.annualFee
    : (getKnownAnnualFee(card.cardName, card.issuer) ?? 0)
  const rewardsValue = card.rewardType === "cashback"
    ? formatCurrency(card.cashbackBalance ?? 0)
    : (card.pointsBalance ?? 0).toLocaleString()
  const rewardsLabel = card.rewardType === "cashback" ? "Cash Back" : "Points"

  return (
    <Link
      href={href}
      className={cn(
        "block rounded-2xl overflow-hidden p-5",
        "border backdrop-blur-sm transition-all duration-200",
        "bg-card/60 border-card-border/50",
        "hover:border-primary/30 hover:shadow-lg",
      )}
    >
      <div className="flex flex-col md:flex-row gap-5">
        {/* Card Visual */}
        <div className="w-full md:w-56 flex-shrink-0">
          <CreditCardVisual
            cardName={card.cardName}
            cardNetwork={card.cardNetwork}
            issuer={card.issuer}
            mask={card.mask}
            imageUrl={card.cardImageUrl ?? undefined}
          />
        </div>

        {/* Card Details */}
        <div className="flex-grow flex flex-col justify-between py-0.5 min-w-0">
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-base font-semibold text-foreground truncate">
                {card.cardName.toLowerCase() === "credit card"
                  ? `${card.issuer}${card.mask ? ` ••••${card.mask}` : ""}`
                  : card.cardName}
              </h4>
              {isBusiness && (
                <span className="flex-shrink-0 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider bg-orange-100 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400 rounded">
                  Business
                </span>
              )}
            </div>
            <p className="text-xs text-foreground-muted mt-0.5">
              {effectiveAnnualFee > 0 ? `$${effectiveAnnualFee}/yr` : "No Annual Fee"}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-x-6 gap-y-3 mt-4">
            <div>
              <p className="text-[10px] uppercase font-semibold text-primary tracking-widest">Balance</p>
              <p className="font-data text-sm font-semibold text-foreground tabular-nums mt-0.5">
                {formatCurrency(card.balance)}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase font-semibold text-primary tracking-widest">{rewardsLabel}</p>
              <p className="font-data text-sm font-semibold text-foreground tabular-nums mt-0.5">
                {rewardsValue}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase font-semibold text-primary tracking-widest">Limit</p>
              <p className="font-data text-sm font-semibold text-foreground-muted tabular-nums mt-0.5">
                {card.creditLimit > 0 ? formatCurrency(card.creditLimit) : "No Preset"}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase font-semibold text-primary tracking-widest">Annual Fee</p>
              <p className="font-data text-sm font-semibold text-foreground-muted tabular-nums mt-0.5">
                {effectiveAnnualFee > 0 ? formatCurrency(effectiveAnnualFee) : "$0"}
              </p>
            </div>
          </div>

          {(card.nextPaymentDueDate || card.annualFeeDate) && (
            <div className="grid grid-cols-2 gap-x-6 mt-3 pt-3 border-t border-card-border/30">
              {card.nextPaymentDueDate && (
                <div>
                  <p className="text-[10px] uppercase font-semibold text-primary tracking-widest">Payment Due</p>
                  <p className="font-data text-sm font-semibold text-foreground mt-0.5">
                    {new Date(card.nextPaymentDueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </p>
                </div>
              )}
              {card.annualFeeDate && (
                <div>
                  <p className="text-[10px] uppercase font-semibold text-primary tracking-widest">Fee Due</p>
                  <p className="font-data text-sm font-semibold text-foreground-muted mt-0.5">
                    {new Date(card.annualFeeDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Link>
  )
}
