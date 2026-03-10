"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import {
  useFinanceSettings,
  useFinanceAccounts,
  useConnectSimpleFIN,
  useSaveFinanceCredential,
  useDeleteFinanceCredential,
  useExchangePlaidToken,
  useVerifyFinanceCredential,
  usePlaidSyncStatus,
  type FinanceCredentialVerificationResponse,
} from "@/hooks/use-finance"
import { FinancePageHeader } from "@/components/finance/finance-page-header"
import { ConfirmDialog } from "@/components/finance/confirm-dialog"
import { PlaidDataStatusCard } from "@/components/finance/plaid-data-status"
import { AIProviderSettings } from "@/components/finance/ai-provider-settings"
import type { FinanceVerificationState } from "@/lib/finance/verification-types"
import { SettingsProviderCards } from "@/components/finance/settings/settings-provider-cards"
import { SettingsPlaidKeys } from "@/components/finance/settings/settings-plaid-keys"

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

export default function FinanceSettingsPage() {
  const { data: settings, isLoading } = useFinanceSettings()
  const { data: institutions } = useFinanceAccounts()
  const connectSF = useConnectSimpleFIN()
  const exchangeToken = useExchangePlaidToken()
  const saveCred = useSaveFinanceCredential()
  const verifyCred = useVerifyFinanceCredential()
  const verifyCredRef = useRef(verifyCred)
  verifyCredRef.current = verifyCred
  const deleteCred = useDeleteFinanceCredential()
  const { data: syncStatus } = usePlaidSyncStatus()

  const [clientId, setClientId] = useState("")
  const [secret, setSecret] = useState("")
  const [environment, setEnvironment] = useState("sandbox")
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
  const plaidInstitutions = institutions?.filter((inst) => inst.provider === "plaid") ?? []
  const simplefinInstitutions = institutions?.filter((inst) => inst.provider === "simplefin") ?? []

  useEffect(() => {
    if (!plaidConfig) {
      setEnvironment("sandbox")
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

  const handleSave = () => {
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
  }

  const handleDelete = () => {
    deleteCred.mutate("plaid", {
      onSuccess: () => {
        setShowDeleteConfirm(false)
        setClientId("")
        setSecret("")
        setEnvironment("sandbox")
        setVerificationState("unknown")
        setVerifyError(null)
        setVerifyCode("unknown")
        hasLocalVerification.current = false
        toast.success("Plaid credentials deleted")
      },
      onError: (err) => toast.error(err.message),
    })
  }

  const verificationBadge = useMemo(() => {
    if (!isConfigured) return { label: "Not configured", tone: "bg-warning/10 text-warning" }
    if (verifyCred.isPending) return { label: "Testing", tone: "bg-primary/10 text-primary" }
    if (verificationState === "verified") return { label: "Verified", tone: "bg-success/10 text-success" }
    if (verificationState === "failed") return { label: "Failed", tone: "bg-error/10 text-error" }
    return { label: "Not tested", tone: "bg-card-border/40 text-foreground-muted" }
  }, [isConfigured, verificationState, verifyCred.isPending])

  return (
    <div className="space-y-6">
      <FinancePageHeader
        title="Finance Settings"
        subtitle="Configure API credentials and bank connections"
      />

      <SettingsProviderCards
        verificationBadge={verificationBadge}
        plaidInstitutions={plaidInstitutions}
        simplefinInstitutions={simplefinInstitutions}
        connectSF={connectSF}
        exchangeToken={exchangeToken}
      />

      <SettingsPlaidKeys
        isLoading={isLoading}
        isConfigured={isConfigured}
        plaidConfig={plaidConfig ? { maskedKey: plaidConfig.maskedKey, environment: plaidConfig.environment } : null}
        verificationState={verificationState}
        verificationBadge={verificationBadge}
        verifyCode={verifyCode}
        verifyError={verifyError}
        verifyCredPending={verifyCred.isPending}
        clientId={clientId}
        secret={secret}
        environment={environment}
        error={error}
        saved={saved}
        savePending={saveCred.isPending}
        onClientIdChange={setClientId}
        onSecretChange={setSecret}
        onEnvironmentChange={setEnvironment}
        onSave={handleSave}
        onRetest={() => runVerify(true)}
        onDelete={() => setShowDeleteConfirm(true)}
      />

      {syncStatus?.institutions && syncStatus.institutions.length > 0 && (
        <PlaidDataStatusCard institutions={syncStatus.institutions} />
      )}

      <AIProviderSettings />

      <ConfirmDialog
        open={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
        title="Delete Plaid credentials?"
        description="This will remove your Plaid API keys. Existing bank connections will remain but you won't be able to add new ones until you reconfigure."
        confirmLabel="Delete"
        variant="danger"
        isLoading={deleteCred.isPending}
      />
    </div>
  )
}
