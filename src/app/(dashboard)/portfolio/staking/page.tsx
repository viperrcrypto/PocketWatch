"use client"

import { PortfolioPageHeader } from "@/components/portfolio/portfolio-page-header"
import { StakingView } from "@/components/portfolio/staking-view"
import { LPPositionsSection } from "@/components/portfolio/lp-positions-section"

export default function StakingPage() {
  return (
    <div className="space-y-6">
      <PortfolioPageHeader title="Staking & DeFi" subtitle="Yield positions, liquidity pools, and rewards" />
      <StakingView />
      <LPPositionsSection />
    </div>
  )
}
