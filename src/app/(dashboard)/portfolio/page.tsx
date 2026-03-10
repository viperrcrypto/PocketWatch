"use client"

import { useState } from "react"
import { useOnboardingStatus } from "@/hooks/use-portfolio-tracker"
import PortfolioSetupWizard from "@/components/portfolio/portfolio-setup-wizard"
import { PortfolioDashboard } from "@/components/portfolio/portfolio-dashboard"

export default function PortfolioPage() {
  const {
    isComplete,
    hasSharedKey,
    isLoading: onboardingLoading,
    isError,
    suggestedStep,
  } = useOnboardingStatus()
  const [wizardCompleted, setWizardCompleted] = useState(false)

  // Show dashboard immediately if onboarding is complete or was completed this session.
  if (isComplete || wizardCompleted) {
    return <PortfolioDashboard />
  }

  // Only show loading skeleton while onboarding check runs for the first time
  if (onboardingLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 bg-card-border animate-pulse rounded-lg" />
        <div className="bg-card border border-card-border h-80 animate-pulse rounded-xl" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="bg-card border border-card-border p-4 h-24 animate-pulse rounded-xl"
            />
          ))}
        </div>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <span className="material-symbols-rounded text-4xl text-error">
          cloud_off
        </span>
        <h2 className="text-foreground text-lg font-semibold">
          Portfolio Service Unavailable
        </h2>
        <p className="text-foreground-muted max-w-md text-center text-sm">
          Could not reach the portfolio backend. This usually resolves within
          a few minutes. Try refreshing the page.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 border border-card-border text-foreground-muted hover:text-foreground hover:border-card-border-hover transition-colors rounded-xl text-xs tracking-wide"
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <PortfolioSetupWizard
      initialStep={suggestedStep}
      hasSharedKey={hasSharedKey}
      onComplete={() => setWizardCompleted(true)}
    />
  )
}
