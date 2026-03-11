"use client"

import { usePortfolioProvision } from "@/hooks/use-portfolio-tracker"

export function StepWelcome({ onNext }: { onNext: () => void }) {
  const provision = usePortfolioProvision()

  const handleGetStarted = () => {
    provision.mutate(undefined, {
      onSuccess: () => onNext(),
    })
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center">
      <span
        className="material-symbols-rounded text-foreground-muted"
        style={{ fontSize: 64 }}
        aria-hidden="true"
      >
        account_balance_wallet
      </span>

      <h1 className="text-2xl font-semibold text-foreground">
        Portfolio Tracker
      </h1>

      <p className="text-foreground-muted max-w-md text-sm">
        Track your crypto portfolio across multiple chains and exchanges. Your
        data is fully private and encrypted.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8 max-w-2xl">
        {[
          {
            icon: "currency_exchange",
            title: "Multi-Chain Tracking",
            desc: "ETH, BTC, SOL, Polygon, Arbitrum, and more",
          },
          {
            icon: "swap_horiz",
            title: "Exchange Integration",
            desc: "Connect Binance, Kraken, and other exchanges",
          },
          {
            icon: "layers",
            title: "Staking & NFTs",
            desc: "Monitor staking rewards and NFT collections",
          },
        ].map((card) => (
          <div
            key={card.title}
            className="bg-card border border-card-border rounded-xl p-4 text-center"
          >
            <span
              className="material-symbols-rounded text-foreground-muted mb-3 block"
              style={{ fontSize: 32 }}
              aria-hidden="true"
            >
              {card.icon}
            </span>
            <h3 className="text-foreground text-sm font-semibold mb-1">
              {card.title}
            </h3>
            <p className="text-foreground-muted text-xs">
              {card.desc}
            </p>
          </div>
        ))}
      </div>

      <button
        onClick={handleGetStarted}
        disabled={provision.isPending}
        className="btn-primary mt-6 px-6 py-3"
      >
        {provision.isPending ? (
          <span className="flex items-center gap-2">
            <span className="material-symbols-rounded text-sm animate-spin">
              progress_activity
            </span>
            Setting up...
          </span>
        ) : (
          "Get Started"
        )}
      </button>

      {provision.isError && (
        <p className="text-error text-xs">
          {provision.error?.message || "Setup failed. Please try again."}
        </p>
      )}
    </div>
  )
}
