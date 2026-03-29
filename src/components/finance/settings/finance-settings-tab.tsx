"use client"

import { useCallback, useState } from "react"
import { toast } from "sonner"
import {
  useFinanceAccounts,
  useConnectSimpleFIN,
  useDisconnectInstitution,
  useDeleteAccount,
  useExchangePlaidToken,
  usePlaidSyncStatus,
} from "@/hooks/use-finance"
import { useSyncInstitution } from "@/hooks/finance"
import { financeFetch } from "@/hooks/finance/shared"
import { useQueryClient } from "@tanstack/react-query"
import { usePlaidCredentials } from "@/hooks/finance/use-plaid-credentials"
import { PlaidDataStatusCard } from "@/components/finance/plaid-data-status"
import { AIProviderSettings } from "@/components/finance/ai-provider-settings"
import { CollapsibleSection } from "@/components/ui/collapsible-section"
import { SettingsProviderCards } from "@/components/finance/settings/settings-provider-cards"
import { SettingsPlaidKeys } from "@/components/finance/settings/settings-plaid-keys"
import { StatementCoverageContent } from "@/components/finance/settings/statement-coverage-card"
import { StatementUploadFlow } from "@/components/finance/upload/statement-upload-flow"
import { FinanceSettingsDialogs } from "./finance-settings-dialogs"

export function FinanceSettingsTab() {
  const qc = useQueryClient()
  const { data: institutions } = useFinanceAccounts()
  const connectSF = useConnectSimpleFIN()
  const exchangeToken = useExchangePlaidToken()
  const { data: syncStatus } = usePlaidSyncStatus()
  const syncInstitution = useSyncInstitution()
  const disconnectInstitution = useDisconnectInstitution()
  const deleteAccount = useDeleteAccount()
  const [isSyncingSF, setIsSyncingSF] = useState(false)
  const [isDisconnectingPlaid, setIsDisconnectingPlaid] = useState(false)
  const [isDisconnectingSF, setIsDisconnectingSF] = useState(false)
  const [disconnectTarget, setDisconnectTarget] = useState<{ id: string; name: string } | null>(null)
  const [showSFDisconnect, setShowSFDisconnect] = useState(false)
  const [showPlaidDisconnect, setShowPlaidDisconnect] = useState(false)
  const [removeAccountTarget, setRemoveAccountTarget] = useState<{ id: string; name: string } | null>(null)

  const plaid = usePlaidCredentials()
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
    setIsDisconnectingPlaid(true)
    try {
      for (const inst of plaidInstitutions) {
        await financeFetch(`/accounts?institutionId=${inst.id}`, { method: "DELETE" })
      }
      await financeFetch("/settings?service=plaid", { method: "DELETE" }).catch(() => {})
      plaid.resetCredentialState()
      qc.invalidateQueries()
      toast.success("Plaid disconnected")
      setShowPlaidDisconnect(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to disconnect Plaid")
    } finally {
      setIsDisconnectingPlaid(false)
    }
  }

  const handleDisconnectAllSimplefin = async () => {
    setIsDisconnectingSF(true)
    try {
      for (const inst of simplefinInstitutions) {
        await financeFetch(`/accounts?institutionId=${inst.id}`, { method: "DELETE" })
      }
      qc.invalidateQueries()
      toast.success("SimpleFIN disconnected")
      setShowSFDisconnect(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to disconnect SimpleFIN")
    } finally {
      setIsDisconnectingSF(false)
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

  return (
    <div className="space-y-4">
      <div id="bank-connections">
        <CollapsibleSection title="Bank Connections" icon="account_balance" defaultOpen className="rounded-xl">
          <div className="pt-4">
            <SettingsProviderCards
              isPlaidConfigured={plaid.isConfigured}
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
                  isLoading={plaid.isLoading}
                  isConfigured={plaid.isConfigured}
                  plaidConfig={plaid.plaidConfig ? { maskedKey: plaid.plaidConfig.maskedKey, environment: plaid.plaidConfig.environment } : null}
                  verificationState={plaid.verificationState}
                  verificationBadge={plaid.verificationBadge}
                  verifyCode={plaid.verifyCode}
                  verifyError={plaid.verifyError}
                  verifyCredPending={plaid.verifyCred.isPending}
                  clientId={plaid.clientId}
                  secret={plaid.secret}
                  environment={plaid.environment}
                  error={plaid.error}
                  saved={plaid.saved}
                  savePending={plaid.saveCred.isPending}
                  onClientIdChange={plaid.setClientId}
                  onSecretChange={plaid.setSecret}
                  onEnvironmentChange={plaid.setEnvironment}
                  onSave={plaid.handleSave}
                  onRetest={() => plaid.runVerify(true)}
                  onDelete={() => plaid.setShowDeleteConfirm(true)}
                />
              }
            />
          </div>
        </CollapsibleSection>
      </div>

      <div id="upload-statements">
        <CollapsibleSection title="Upload Statements" icon="upload_file" defaultOpen className="rounded-xl">
          <div className="pt-4">
            <StatementUploadFlow />
          </div>
        </CollapsibleSection>
      </div>

      {syncStatus?.institutions && syncStatus.institutions.length > 0 && (
        <div id="sync-status">
          <CollapsibleSection title="Sync Status" icon="sync" badge={syncStatus.institutions.length} className="rounded-xl">
            <div className="pt-4">
              <PlaidDataStatusCard institutions={syncStatus.institutions} />
            </div>
          </CollapsibleSection>
        </div>
      )}

      <div id="data-coverage">
        <CollapsibleSection title={`Data Coverage — ${new Date().getUTCFullYear()}`} icon="insert_chart" defaultOpen className="rounded-xl">
          <div className="pt-4">
            <StatementCoverageContent />
          </div>
        </CollapsibleSection>
      </div>

      <div id="ai-intelligence">
        <CollapsibleSection title="AI Intelligence" icon="smart_toy" className="rounded-xl">
          <div className="pt-4">
            <AIProviderSettings />
          </div>
        </CollapsibleSection>
      </div>

      <FinanceSettingsDialogs
        showDeleteConfirm={plaid.showDeleteConfirm}
        onCloseDeleteConfirm={() => plaid.setShowDeleteConfirm(false)}
        onConfirmDelete={plaid.handleDelete}
        deleteLoading={plaid.deleteCred.isPending}
        disconnectTarget={disconnectTarget}
        onCloseDisconnect={() => setDisconnectTarget(null)}
        onConfirmDisconnect={handleDisconnect}
        disconnectLoading={disconnectInstitution.isPending}
        showPlaidDisconnect={showPlaidDisconnect}
        onClosePlaidDisconnect={() => setShowPlaidDisconnect(false)}
        onConfirmPlaidDisconnect={handleDisconnectAllPlaid}
        plaidDisconnectLoading={isDisconnectingPlaid}
        showSFDisconnect={showSFDisconnect}
        onCloseSFDisconnect={() => setShowSFDisconnect(false)}
        onConfirmSFDisconnect={handleDisconnectAllSimplefin}
        sfDisconnectLoading={isDisconnectingSF}
        removeAccountTarget={removeAccountTarget}
        onCloseRemoveAccount={() => setRemoveAccountTarget(null)}
        onConfirmRemoveAccount={handleRemoveAccount}
        removeAccountLoading={deleteAccount.isPending}
      />
    </div>
  )
}
