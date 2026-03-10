"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { usePlaidLink } from "react-plaid-link"
import { useCreateLinkToken } from "@/hooks/use-finance"

interface PlaidLinkButtonProps {
  onSuccess: (publicToken: string, metadata: { institution: { institution_id: string; name: string } }) => void
  onExit?: () => void
  onError?: (message: string) => void
  className?: string
  buttonLabel?: string
}

export function PlaidLinkButton({
  onSuccess,
  onExit,
  onError,
  className,
  buttonLabel = "Connect with Plaid",
}: PlaidLinkButtonProps) {
  const [linkToken, setLinkToken] = useState<string | null>(null)
  const [tokenError, setTokenError] = useState<string | null>(null)
  const [isLoadingToken, setIsLoadingToken] = useState(false)
  const createToken = useCreateLinkToken()
  const createTokenRef = useRef(createToken)
  createTokenRef.current = createToken
  const onErrorRef = useRef(onError)
  onErrorRef.current = onError

  const fetchLinkToken = useCallback(() => {
    setIsLoadingToken(true)
    setTokenError(null)

    createTokenRef.current.mutate(undefined, {
      onSuccess: (data) => {
        setLinkToken(data.linkToken)
        setIsLoadingToken(false)
      },
      onError: (err) => {
        const message = err.message || "Failed to initialize Plaid."
        setLinkToken(null)
        setTokenError(message)
        setIsLoadingToken(false)
        onErrorRef.current?.(message)
      },
    })
  }, [])

  useEffect(() => {
    fetchLinkToken()
  }, [fetchLinkToken])

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: (publicToken, metadata) => {
      onSuccess(publicToken, metadata as { institution: { institution_id: string; name: string } })
    },
    onExit: () => onExit?.(),
  })

  const disabled = isLoadingToken || !!tokenError || !ready

  return (
    <div className="flex flex-col items-start gap-1.5">
      <button
        onClick={() => {
          if (!ready || tokenError) return
          open()
        }}
        disabled={disabled}
        className={className ?? "btn-primary flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium"}
      >
        <span className="material-symbols-rounded text-lg">account_balance</span>
        {buttonLabel}
      </button>

      {isLoadingToken && (
        <p className="text-xs text-foreground-muted">Preparing Plaid connection...</p>
      )}

      {!isLoadingToken && !tokenError && !ready && linkToken && (
        <p className="text-xs text-foreground-muted">Loading Plaid secure widget...</p>
      )}

      {tokenError && (
        <div className="flex items-center gap-2">
          <p className="text-xs text-error">{tokenError}</p>
          <button
            type="button"
            onClick={fetchLinkToken}
            className="text-xs text-primary hover:underline"
          >
            Retry
          </button>
        </div>
      )}
    </div>
  )
}
