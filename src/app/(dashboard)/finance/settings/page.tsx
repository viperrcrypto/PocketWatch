"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import {
  useFinanceSettings,
  useFinanceAccounts,
  useConnectSimpleFIN,
  useSaveFinanceCredential,
  useDeleteFinanceCredential,
  useDisconnectInstitution,
  useDeleteAccount,
  useExchangePlaidToken,
  useVerifyFinanceCredential,
  usePlaidSyncStatus,
  type FinanceCredentialVerificationResponse,
} from "@/hooks/use-finance"
import { useSyncInstitution } from "@/hooks/finance"
import { financeFetch } from "@/hooks/finance/shared"
import { useQueryClient } from "@tanstack/react-query"
import { FinancePageHeader } from "@/components/finance/finance-page-header"
import { ConfirmDialog } from "@/components/finance/confirm-dialog"
import { PlaidDataStatusCard } from "@/components/finance/plaid-data-status"
import { AIProviderSettings } from "@/components/finance/ai-provider-settings"
import { CollapsibleSection } from "@/components/ui/collapsible-section"
import type { FinanceVerificationState } from "@/lib/finance/verification-types"
import { SettingsProviderCards } from "@/components/finance/settings/settings-provider-cards"
import { SettingsPlaidKeys } from "@/components/finance/settings/settings-plaid-keys"
import { StatementCoverageContent } from "@/components/finance/settings/statement-coverage-card"
import { StatementUploadInline } from "@/components/finance/settings/statement-upload-inline"

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
  const qc = useQueryClient()
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
  const syncInstitution = useSyncInstitution()
  const [isSyncingSF, setIsSyncingSF] = useState(false)

  const [clientId, setClientId] = useState("")
  const [secret, setSecret] = useState("")
  const [environment, setEnvironment] = useState("development")
  const [error, setError] = useState("")
  const [saved, setSaved] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [disconnectTarget, setDisconnectTarget] = useState<{ id: string; name: string } | null>(null)
  const [showSFDisconnect, setShowSFDisconnect] = useState(false)
  const [showPlaidDisconnect, setShowPlaidDisconnect] = useState(false)
  const disconnectInstitution = useDisconnectInstitution()
  const deleteAccount = useDeleteAccount()
  const [removeAccountTarget, setRemoveAccountTarget] = useState<{ id: string; name: string } | null>(null)
  const [verificationState, setVerificationState] = useState<FinanceVerificationState>("unknown")
  const [verifyError, setVerifyError] = useState<string | null>(null)
  const [verifyCode, setVerifyCode] = useState("unknown")

  const autoVerifyServices = useRef<Set<string>>(new Set())
  const hasLocalVerification = useRef(false)

  const plaidConfig = settings?.services?.find((s) => s.service === "plaid")
  const isConfigured = !!plaidConfig
  const plaidInstitutions = institutions?.filter((inst) => inst.provider === "plaid") ?? []
  const simplefinInstitutions = institutions?.filter((inst) => inst.provider === "simplefin") ?? []
  const manualInstitutions = institutions?.filter((inst) => inst.provider === "manual") ?? []

  const handleSyncSimplefin = useCallback(async () => {
    if (simplefinInstitutions.length === 0) return
    setIsSyncingSF(true)
    try {
      for (const inst of simplefinInstitutions) {
        await syncInstitution.mutateAsync(inst.id)
      }
      toast.success("SimpleFIN accounts refreshed")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sync failed")
    } finally {
      setIsSyncingSF(false)
    }
  }, [simplefinInstitutions, syncInstitution])

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
        setEnvironment("development")
        setVerificationState("unknown")
        setVerifyError(null)
        setVerifyCode("unknown")
        hasLocalVerification.current = false
        toast.success("Plaid credentials deleted")
      },
      onError: (err) => toast.error(err.message),
    })
  }

  const handleDisconnect = () => {
    if (!disconnectTarget) return
    disconnectInstitution.mutate(disconnectTarget.id, {
      onSuccess: () => {
        toast.success(`Disconnected ${disconnectTarget.name}`)
        setDisconnectTarget(null)
      },
      onError: (err) => toast.error(err.message),
    })
  }

  const handleDisconnectAllPlaid = async () => {
    try {
      for (const inst of plaidInstitutions) {
        await financeFetch(`/accounts?institutionId=${inst.id}`, { method: "DELETE" })
      }
      await financeFetch("/settings?service=plaid", { method: "DELETE" }).catch(() => {})
      setClientId("")
      setSecret("")
      setEnvironment("development")
      setVerificationState("unknown")
      setVerifyError(null)
      setVerifyCode("unknown")
      hasLocalVerification.current = false
      qc.invalidateQueries()
      toast.success("Plaid disconnected")
      setShowPlaidDisconnect(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to disconnect Plaid")
    }
  }

  const handleDisconnectAllSimplefin = async () => {
    try {
      for (const inst of simplefinInstitutions) {
        await financeFetch(`/accounts?institutionId=${inst.id}`, { method: "DELETE" })
      }
      qc.invalidateQueries()
      toast.success("SimpleFIN disconnected")
      setShowSFDisconnect(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to disconnect SimpleFIN")
    }
  }

  const handleRemoveAccount = () => {
    if (!removeAccountTarget) return
    deleteAccount.mutate(removeAccountTarget.id, {
      onSuccess: () => {
        toast.success(`Removed ${removeAccountTarget.name}`)
        setRemoveAccountTarget(null)
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
    <div className="space-y-4">
      <FinancePageHeader
        title="Finance Settings"
        subtitle="Configure API credentials and bank connections"
      />

      <CollapsibleSection
        title="Bank Connections"
        icon="account_balance"
        defaultOpen
        className="rounded-xl"
      >
        <div className="pt-4">
          <SettingsProviderCards
            isPlaidConfigured={isConfigured}
            plaidInstitutions={plaidInstitutions}
            simplefinInstitutions={simplefinInstitutions}
            manualInstitutions={manualInstitutions}
            connectSF={connectSF}
            exchangeToken={exchangeToken}
            onDisconnect={(id, name) => setDisconnectTarget({ id, name })}
            onDisconnectAllPlaid={() => setShowPlaidDisconnect(true)}
            onDisconnectAllSimplefin={() => setShowSFDisconnect(true)}
            onSyncSimplefin={handleSyncSimplefin}
            isSyncingSimplefin={isSyncingSF}
            onRemoveAccount={(id, name) => setRemoveAccountTarget({ id, name })}
            plaidKeyForm={
              <SettingsPlaidKeys
                bare
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
            }
          />
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title="Upload Statements"
        icon="upload_file"
        defaultOpen
        className="rounded-xl"
      >
        <div className="pt-4">
          <StatementUploadInline />
        </div>
      </CollapsibleSection>

      {syncStatus?.institutions && syncStatus.institutions.length > 0 && (
        <CollapsibleSection
          title="Sync Status"
          icon="sync"
          badge={syncStatus.institutions.length}
          className="rounded-xl"
        >
          <div className="pt-4">
            <PlaidDataStatusCard institutions={syncStatus.institutions} />
          </div>
        </CollapsibleSection>
      )}

      <CollapsibleSection
        title={`Data Coverage — ${new Date().getUTCFullYear()}`}
        icon="insert_chart"
        defaultOpen
        className="rounded-xl"
      >
        <div className="pt-4">
          <StatementCoverageContent />
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title="AI Intelligence"
        icon="smart_toy"
        className="rounded-xl"
      >
        <div className="pt-4">
          <AIProviderSettings />
        </div>
      </CollapsibleSection>

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

      <ConfirmDialog
        open={!!disconnectTarget}
        onClose={() => setDisconnectTarget(null)}
        onConfirm={handleDisconnect}
        title={`Disconnect ${disconnectTarget?.name ?? "institution"}?`}
        description="This will remove the connection and all associated accounts and transactions. This cannot be undone."
        confirmLabel="Disconnect"
        variant="danger"
        isLoading={disconnectInstitution.isPending}
      />

      <ConfirmDialog
        open={showPlaidDisconnect}
        onClose={() => setShowPlaidDisconnect(false)}
        onConfirm={handleDisconnectAllPlaid}
        title="Disconnect Plaid?"
        description="This will remove all Plaid bank connections, accounts, transactions, and wipe your API keys. You can reconnect with new keys afterward."
        confirmLabel="Disconnect"
        variant="danger"
        isLoading={disconnectInstitution.isPending || deleteCred.isPending}
      />

      <ConfirmDialog
        open={showSFDisconnect}
        onClose={() => setShowSFDisconnect(false)}
        onConfirm={handleDisconnectAllSimplefin}
        title="Disconnect SimpleFIN?"
        description="This will remove all SimpleFIN accounts, transactions, and wipe the access token. You can reconnect with a new setup token afterward."
        confirmLabel="Disconnect"
        variant="danger"
        isLoading={disconnectInstitution.isPending}
      />

      <ConfirmDialog
        open={!!removeAccountTarget}
        onClose={() => setRemoveAccountTarget(null)}
        onConfirm={handleRemoveAccount}
        title={`Remove ${removeAccountTarget?.name ?? "account"}?`}
        description="This will delete this account and all its transactions. If it's the last account under its institution, the institution will be removed too. This cannot be undone."
        confirmLabel="Remove"
        variant="danger"
        isLoading={deleteAccount.isPending}
      />
    </div>
  )
}
