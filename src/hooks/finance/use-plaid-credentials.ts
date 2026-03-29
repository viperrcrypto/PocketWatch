"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import {
  useFinanceSettings,
  useSaveFinanceCredential,
  useDeleteFinanceCredential,
  useVerifyFinanceCredential,
  type FinanceCredentialVerificationResponse,
} from "@/hooks/use-finance"
import type { FinanceVerificationState } from "@/lib/finance/verification-types"

function deriveVerificationState(payload?: Partial<FinanceCredentialVerificationResponse> | null): {
  verificationState: FinanceVerificationState
  verifyError: string | null
  verifyCode: string
} {
  if (!payload) {
    return { verificationState: "unknown", verifyError: null, verifyCode: "unknown" }
  }
  const verificationState = payload.verificationState
    ?? (payload.verified ? "verified" : payload.verifyError ? "failed" : "unknown")
  return {
    verificationState,
    verifyError: payload.verifyError ?? null,
    verifyCode: payload.verifyCode ?? "unknown",
  }
}

export function usePlaidCredentials() {
  const { data: settings, isLoading } = useFinanceSettings()
  const saveCred = useSaveFinanceCredential()
  const verifyCred = useVerifyFinanceCredential()
  const verifyCredRef = useRef(verifyCred)
  verifyCredRef.current = verifyCred
  const deleteCred = useDeleteFinanceCredential()

  const [clientId, setClientId] = useState("")
  const [secret, setSecret] = useState("")
  const [environment, setEnvironment] = useState("development")
  const [error, setError] = useState("")
  const [saved, setSaved] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [verificationState, setVerificationState] = useState<FinanceVerificationState>("unknown")
  const [verifyError, setVerifyError] = useState<string | null>(null)
  const [verifyCode, setVerifyCode] = useState("unknown")

  const autoVerifyServices = useRef<Set<string>>(new Set())
  const hasLocalVerification = useRef(false)

  const plaidConfig = settings?.services?.find((s) => s.service === "plaid")
  const isConfigured = !!plaidConfig

  useEffect(() => {
    if (!plaidConfig) {
      setEnvironment("development")
      setVerificationState("unknown")
      setVerifyError(null)
      setVerifyCode("unknown")
      hasLocalVerification.current = false
      return
    }
    setEnvironment(plaidConfig.environment)
    const derived = deriveVerificationState(plaidConfig)
    if (!hasLocalVerification.current || derived.verificationState !== "unknown") {
      setVerificationState(derived.verificationState)
      setVerifyError(derived.verifyError)
      setVerifyCode(derived.verifyCode)
    }
  }, [plaidConfig])

  const applyVerification = useCallback((
    payload: FinanceCredentialVerificationResponse,
    opts?: { notify?: boolean; context?: string }
  ) => {
    const derived = deriveVerificationState(payload)
    hasLocalVerification.current = true
    setVerificationState(derived.verificationState)
    setVerifyError(derived.verifyError)
    setVerifyCode(derived.verifyCode)
    if (!opts?.notify) return
    const context = opts.context ?? "Plaid verification"
    if (derived.verificationState === "verified") { toast.success(`${context}: verified`); return }
    if (derived.verificationState === "failed") { toast.error(`${context}: ${derived.verifyError ?? "failed"}`); return }
    toast.info(`${context}: verification currently unavailable`)
  }, [])

  const applyVerificationRef = useRef(applyVerification)
  applyVerificationRef.current = applyVerification

  const runVerify = useCallback((notify = false) => {
    verifyCredRef.current.mutate(
      { service: "plaid" },
      {
        onSuccess: (payload) => applyVerificationRef.current(payload, { notify, context: "Plaid verification" }),
        onError: (err) => {
          hasLocalVerification.current = true
          setVerificationState("unknown")
          setVerifyCode("unknown")
          setVerifyError(err.message)
          if (notify) toast.error(err.message)
        },
      },
    )
  }, [])

  useEffect(() => {
    if (!isConfigured) return
    if (autoVerifyServices.current.has("plaid")) return
    autoVerifyServices.current.add("plaid")
    runVerify(false)
  }, [isConfigured, runVerify])

  const resetCredentialState = useCallback(() => {
    setClientId("")
    setSecret("")
    setEnvironment("development")
    setVerificationState("unknown")
    setVerifyError(null)
    setVerifyCode("unknown")
    hasLocalVerification.current = false
  }, [])

  const handleSave = useCallback(() => {
    if (!clientId.trim() || !secret.trim()) { setError("Both Client ID and Secret are required"); return }
    setError("")
    setSaved(false)
    saveCred.mutate(
      { service: "plaid", clientId: clientId.trim(), secret: secret.trim(), environment },
      {
        onSuccess: (payload) => {
          setSaved(true)
          setClientId("")
          setSecret("")
          applyVerification(payload, { notify: true, context: "Plaid keys saved" })
        },
        onError: (err) => setError(err.message),
      },
    )
  }, [clientId, secret, environment, saveCred, applyVerification])

  const handleDelete = useCallback(() => {
    deleteCred.mutate("plaid", {
      onSuccess: () => {
        setShowDeleteConfirm(false)
        resetCredentialState()
        toast.success("Plaid credentials deleted")
      },
      onError: (err) => toast.error(err.message),
    })
  }, [deleteCred, resetCredentialState])

  const verificationBadge = useMemo(() => {
    if (!isConfigured) return { label: "Not configured", tone: "bg-warning/10 text-warning" }
    if (verifyCred.isPending) return { label: "Testing", tone: "bg-primary/10 text-primary" }
    if (verificationState === "verified") return { label: "Verified", tone: "bg-success/10 text-success" }
    if (verificationState === "failed") return { label: "Failed", tone: "bg-error/10 text-error" }
    return { label: "Not tested", tone: "bg-card-border/40 text-foreground-muted" }
  }, [isConfigured, verificationState, verifyCred.isPending])

  return {
    isLoading,
    isConfigured,
    plaidConfig,
    clientId, setClientId,
    secret, setSecret,
    environment, setEnvironment,
    error,
    saved,
    showDeleteConfirm, setShowDeleteConfirm,
    verificationState,
    verifyError,
    verifyCode,
    verificationBadge,
    verifyCred,
    deleteCred,
    saveCred,
    handleSave,
    handleDelete,
    runVerify,
    resetCredentialState,
  }
}
