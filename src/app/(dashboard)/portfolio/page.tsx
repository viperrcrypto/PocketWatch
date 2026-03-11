"use client"

import { useState } from "react"
import { useOnboardingStatus } from "@/hooks/use-portfolio-tracker"
import PortfolioSetupWizard from "@/components/portfolio/portfolio-setup-wizard"
import { PortfolioDashboard } from "@/components/portfolio/portfolio-dashboard"
import { SetupRequiredState } from "@/components/portfolio/setup-required-state"

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
      <div className="py-10">
        <SetupRequiredState service="zerion" feature="your portfolio overview" />
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
