"use client"

import { useState } from "react"
import { ProgressIndicator } from "./setup/progress-indicator"
import { StepWelcome } from "./setup/step-welcome"
import { StepApiKeys } from "./setup/step-api-keys"
import { StepAddWallet } from "./setup/step-add-wallet"
import { StepComplete } from "./setup/step-complete"

// ─── Types ───

interface PortfolioSetupWizardProps {
  initialStep?: number // 1-4, defaults to 1
  hasSharedKey?: boolean // admin configured a platform-level Zerion key
  onComplete?: () => void
}

// ─── Main Wizard ───

export default function PortfolioSetupWizard({
  initialStep = 1,
  hasSharedKey = false,
  onComplete,
}: PortfolioSetupWizardProps) {
  const [step, setStep] = useState(initialStep)

  // If a shared key is active and the user would land on step 2, skip to step 3
  const advance = () => {
    setStep((prev) => {
      const next = Math.min(prev + 1, 4)
      return next === 2 && hasSharedKey ? 3 : next
    })
  }

  return (
    <div className="min-h-screen px-6 py-12 bg-background">
      <div className="max-w-3xl mx-auto">
        <ProgressIndicator currentStep={step} />

        {step === 1 && <StepWelcome onNext={advance} />}
        {step === 2 && <StepApiKeys onNext={advance} hasSharedKey={hasSharedKey} />}
        {step === 3 && <StepAddWallet onNext={advance} />}
        {step === 4 && <StepComplete onComplete={onComplete} />}
      </div>
    </div>
  )
}
