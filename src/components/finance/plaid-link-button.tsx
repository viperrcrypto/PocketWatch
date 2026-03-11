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

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: (publicToken, metadata) => {
      onSuccess(publicToken, metadata as { institution: { institution_id: string; name: string } })
    },
    onExit: () => onExit?.(),
  })

  // Auto-open Plaid once the token arrives after a click-triggered fetch
  const pendingOpen = useRef(false)
  useEffect(() => {
    if (pendingOpen.current && linkToken && ready) {
      pendingOpen.current = false
      open()
    }
  }, [linkToken, ready, open])

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <button
        onClick={() => {
          if (isLoadingToken) return
          if (linkToken && ready) {
            open()
          } else if (!linkToken) {
            pendingOpen.current = true
            fetchLinkToken()
          }
        }}
        disabled={isLoadingToken}
        className={className ?? "btn-primary flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium"}
        title={tokenError ? `${tokenError} — Click to retry` : undefined}
      >
        <span className="material-symbols-rounded" style={{ fontSize: className ? 14 : 18 }}>account_balance</span>
        {isLoadingToken ? "..." : tokenError ? `${buttonLabel} ↻` : buttonLabel}
      </button>
    </div>
  )
}
