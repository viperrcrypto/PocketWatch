"use client"

import { useState, useMemo } from "react"
import {
  useExternalServices,
  useSetExternalService,
  useDeleteExternalService,
  useRenameExternalServiceKey,
  useVerifyExternalService,
  type ExternalServiceMutationResult,
} from "@/hooks/use-portfolio-tracker"
import { CollapsibleSection } from "./collapsible-section"
import {
  SUPPORTED_SERVICES,
  type ConfiguredKey,
  deriveVerificationState,
  getServicesList,
  showVerificationToast,
} from "./settings-utils"
import { ApiKeyServiceRow } from "./api-key-service-row"

export function ApiKeysSection() {
  const { data: servicesData, isLoading: servicesLoading } = useExternalServices()
  const setService = useSetExternalService()
  const deleteService = useDeleteExternalService()
  const renameKey = useRenameExternalServiceKey()
  const verifyService = useVerifyExternalService()

  const [showAddKeyDialog, setShowAddKeyDialog] = useState(false)
  const [selectedService, setSelectedService] = useState("")
  const [apiKeyInput, setApiKeyInput] = useState("")
  const [keyError, setKeyError] = useState("")
  const [deleteKeyConfirm, setDeleteKeyConfirm] = useState<string | null>(null)
  const [renamingKeyId, setRenamingKeyId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState("")
  const [disabledChainsMap, setDisabledChainsMap] = useState<Record<string, string[]>>({})

  const services = useMemo(() => getServicesList(servicesData), [servicesData])

  const MULTI_KEY_SERVICES = useMemo(() => {
    const set = new Set<string>()
    for (const svc of services) {
      if (svc?.multiKeyEnabled) set.add(svc.name)
    }
    for (const id of ["zerion", "alchemy", "helius"]) set.add(id)
    return set
  }, [services])

  const configuredServices = useMemo(() => {
    const map: Record<string, ConfiguredKey[]> = {}
    for (const svc of services) {
      if (svc?.name && !svc.name.startsWith("exchange_")) {
        const verifyError = typeof svc.verifyError === "string" ? svc.verifyError : undefined
        const entry: ConfiguredKey = {
          id: svc.id,
          api_key: svc.api_key || "****",
          label: svc.label,
          verified: svc.verified === true,
          verificationState: deriveVerificationState(svc.verificationState, svc.verified === true, verifyError),
          verifyError,
          consecutive429: svc.consecutive429 ?? 0,
        }
        if (!map[svc.name]) map[svc.name] = []
        map[svc.name].push(entry)
      }
    }
    return map
  }, [services])

  const openAddKeyDialog = (serviceId: string) => {
    setSelectedService(serviceId)
    setApiKeyInput("")
    setKeyError("")
    setShowAddKeyDialog(true)
  }

  const handleAddKey = () => {
    if (!apiKeyInput.trim()) { setKeyError("API key is required"); return }
    setKeyError("")
    setService.mutate(
      { name: selectedService, api_key: apiKeyInput.trim() },
      {
        onSuccess: (data: ExternalServiceMutationResult) => {
          setShowAddKeyDialog(false)
          setApiKeyInput("")
          setSelectedService("")
          setKeyError("")
          showVerificationToast("Key saved.", data)
        },
        onError: (err) => setKeyError(err.message),
      }
    )
  }

  const handleDeleteKey = (nameOrId: string, isKeyId?: boolean) => {
    const body = isKeyId ? { id: nameOrId } : { name: nameOrId }
    deleteService.mutate(body, { onSuccess: () => setDeleteKeyConfirm(null) })
  }

  const activeService = SUPPORTED_SERVICES.find((s) => s.id === selectedService)

  return (
    <>
      {showAddKeyDialog && (
        <AddKeyDialog
          activeService={activeService}
          selectedService={selectedService}
          apiKeyInput={apiKeyInput}
          setApiKeyInput={setApiKeyInput}
          keyError={keyError}
          isPending={setService.isPending}
          onSubmit={handleAddKey}
          onClose={() => setShowAddKeyDialog(false)}
        />
      )}

      <CollapsibleSection
        title="API Keys"
        subtitle="Connect external services to power portfolio features"
      >
        {servicesLoading ? (
          <ApiKeysLoading />
        ) : (
          <div className="divide-y divide-card-border">
            {SUPPORTED_SERVICES.map((service) => {
              const keys = configuredServices[service.id] ?? []
              return (
                <ApiKeyServiceRow
                  key={service.id}
                  service={service}
                  keys={keys}
                  isMultiKey={MULTI_KEY_SERVICES.has(service.id)}
                  deleteKeyConfirm={deleteKeyConfirm}
                  setDeleteKeyConfirm={setDeleteKeyConfirm}
                  renamingKeyId={renamingKeyId}
                  setRenamingKeyId={setRenamingKeyId}
                  renameValue={renameValue}
                  setRenameValue={setRenameValue}
                  disabledChainsMap={disabledChainsMap}
                  setDisabledChainsMap={setDisabledChainsMap}
                  onOpenAddDialog={openAddKeyDialog}
                  onDeleteKey={handleDeleteKey}
                  renameKey={renameKey}
                  verifyService={verifyService}
                  deleteService={deleteService}
                />
              )
            })}
          </div>
        )}
      </CollapsibleSection>
    </>
  )
}

/* ─── Sub-components ─── */

function AddKeyDialog({ activeService, selectedService, apiKeyInput, setApiKeyInput, keyError, isPending, onSubmit, onClose }: {
  activeService: (typeof SUPPORTED_SERVICES)[number] | undefined
  selectedService: string
  apiKeyInput: string
  setApiKeyInput: (v: string) => void
  keyError: string
  isPending: boolean
  onSubmit: () => void
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-card border border-card-border w-full max-w-lg rounded-xl shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-card-border">
          <h2 className="text-foreground text-base font-semibold">
            Add {activeService?.label} API Key
          </h2>
          <button onClick={onClose} className="text-foreground-muted hover:text-foreground transition-colors">
            <span className="material-symbols-rounded">close</span>
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block mb-2 text-foreground-muted text-xs font-semibold">Service</label>
            <input
              type="text"
              value={activeService?.label || selectedService}
              readOnly
              className="w-full bg-background-secondary border border-card-border rounded-lg py-2 px-3 text-foreground-muted outline-none cursor-not-allowed text-sm"
            />
          </div>
          <div>
            <label className="block mb-2 text-foreground-muted text-xs font-semibold">API Key</label>
            <input
              type="text"
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
              placeholder={`Paste your ${activeService?.label || ""} API key...`}
              className="w-full bg-transparent border border-card-border rounded-lg focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none py-2 px-3 text-foreground placeholder-foreground-muted/40 transition-colors text-sm"
              onKeyDown={(e) => e.key === "Enter" && onSubmit()}
            />
            {keyError && <p className="mt-1.5 text-error text-xs">{keyError}</p>}
          </div>
          {activeService?.keyUrl && (
            <p className="text-foreground-muted text-xs">
              Get your free key at{" "}
              <a href={activeService.keyUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                {activeService.domain}
              </a>
            </p>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={onClose} className="px-4 py-2 border border-card-border rounded-lg text-foreground-muted hover:text-foreground hover:border-card-border-hover transition-colors text-sm">
              Cancel
            </button>
            <button onClick={onSubmit} disabled={isPending} className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors disabled:opacity-50 text-sm font-semibold">
              {isPending ? "Saving..." : "Save Key"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function ApiKeysLoading() {
  return (
    <div className="p-5 space-y-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-center justify-between py-2">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-card-border animate-pulse rounded-lg" />
            <div>
              <div className="w-24 h-4 bg-card-border animate-pulse rounded mb-1" />
              <div className="w-48 h-3 bg-card-border animate-pulse rounded" />
            </div>
          </div>
          <div className="w-20 h-8 bg-card-border animate-pulse rounded-lg" />
        </div>
      ))}
    </div>
  )
}
