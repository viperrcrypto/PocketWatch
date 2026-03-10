"use client"

import { useQueryClient } from "@tanstack/react-query"
import { useRefreshBalances } from "@/hooks/use-portfolio-tracker"

export function StepComplete({ onComplete }: { onComplete?: () => void }) {
  const refresh = useRefreshBalances()
  const queryClient = useQueryClient()

  const handleGoToDashboard = () => {
    refresh.mutate(undefined, {
      onSettled: () => {
        queryClient.invalidateQueries({ queryKey: ["portfolio"] })
        onComplete?.()
      },
    })
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center">
      <span
        className="material-symbols-rounded text-success"
        style={{ fontSize: 64 }}
        aria-hidden="true"
      >
        check_circle
      </span>

      <h1 className="text-2xl font-semibold text-foreground">
        You&apos;re All Set
      </h1>

      <div className="max-w-md space-y-2">
        <p className="text-foreground-muted text-sm">
          Your portfolio tracker is configured and syncing.
        </p>
        <p className="text-foreground-muted text-sm">
          Initial data sync may take a few minutes.
        </p>
      </div>

      <button
        onClick={handleGoToDashboard}
        disabled={refresh.isPending}
        className="btn-primary mt-4 px-6 py-3"
      >
        {refresh.isPending ? (
          <span className="flex items-center gap-2">
            <span className="material-symbols-rounded text-sm animate-spin">
              progress_activity
            </span>
            Syncing...
          </span>
        ) : (
          "Go to Dashboard"
        )}
      </button>
    </div>
  )
}
