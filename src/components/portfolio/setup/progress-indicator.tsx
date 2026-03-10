"use client"

const STEP_LABELS = ["Welcome", "API Key", "Wallet", "Complete"] as const

export function ProgressIndicator({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex items-center justify-center mb-12">
      {STEP_LABELS.map((label, index) => {
        const stepNum = index + 1
        const isCompleted = stepNum < currentStep
        const isCurrent = stepNum === currentStep

        return (
          <div key={label} className="flex items-center">
            {/* Connecting line before (except first) */}
            {index > 0 && (
              <div
                className={`h-[2px] ${
                  stepNum <= currentStep ? "bg-success" : "bg-card-border"
                }`}
                style={{ width: 40 }}
              />
            )}

            {/* Step circle + label */}
            <div className="flex flex-col items-center">
              <div
                className={`flex items-center justify-center border-2 rounded-full ${
                  isCompleted
                    ? "bg-success border-success"
                    : isCurrent
                      ? "bg-transparent border-primary"
                      : "bg-transparent border-card-border"
                }`}
                style={{ width: 32, height: 32 }}
              >
                {isCompleted ? (
                  <span
                    className="material-symbols-rounded text-white"
                    style={{ fontSize: 18 }}
                  >
                    check
                  </span>
                ) : (
                  <span
                    className={`font-data text-xs font-semibold ${isCurrent ? "text-primary" : "text-foreground-muted"}`}
                  >
                    {stepNum}
                  </span>
                )}
              </div>
              <span
                className={`mt-2 text-[10px] font-medium tracking-wider ${
                  isCurrent
                    ? "text-foreground"
                    : isCompleted
                      ? "text-success"
                      : "text-foreground-muted"
                }`}
              >
                {label}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
