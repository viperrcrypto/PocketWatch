"use client"

import type {
  useDeleteExternalService,
  useRenameExternalServiceKey,
  useVerifyExternalService,
} from "@/hooks/use-portfolio-tracker"
import type { ConfiguredKey } from "./settings-utils"
import { SUPPORTED_SERVICES } from "./settings-utils"

export function ApiKeyServiceRow({
  service, keys, isMultiKey, deleteKeyConfirm, setDeleteKeyConfirm,
  renamingKeyId, setRenamingKeyId, renameValue, setRenameValue,
  disabledChainsMap, setDisabledChainsMap,
  onOpenAddDialog, onDeleteKey, renameKey, verifyService, deleteService,
}: {
  service: (typeof SUPPORTED_SERVICES)[number]
  keys: ConfiguredKey[]
  isMultiKey: boolean
  deleteKeyConfirm: string | null
  setDeleteKeyConfirm: (v: string | null) => void
  renamingKeyId: string | null
  setRenamingKeyId: (v: string | null) => void
  renameValue: string
  setRenameValue: (v: string) => void
  disabledChainsMap: Record<string, string[]>
  setDisabledChainsMap: React.Dispatch<React.SetStateAction<Record<string, string[]>>>
  onOpenAddDialog: (id: string) => void
  onDeleteKey: (nameOrId: string, isKeyId?: boolean) => void
  renameKey: ReturnType<typeof useRenameExternalServiceKey>
  verifyService: ReturnType<typeof useVerifyExternalService>
  deleteService: ReturnType<typeof useDeleteExternalService>
}) {
  const hasKeys = keys.length > 0
  const primaryKey = keys[0]
  const anyVerified = keys.some((k) => k.verificationState === "verified")
  const allFailed = hasKeys && keys.every((k) => k.verificationState === "failed")

  return (
    <div className="px-5 py-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative flex-shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`https://www.google.com/s2/favicons?domain=${service.domain}&sz=64`}
              alt={service.label}
              width={32}
              height={32}
              className={`rounded-lg ${hasKeys ? "opacity-100" : "opacity-40 grayscale"}`}
              style={{ imageRendering: "auto" }}
            />
            {hasKeys && (
              <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-card ${
                anyVerified ? "bg-success" : allFailed ? "bg-error" : "bg-foreground-muted"
              }`} />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-foreground">{service.label}</span>
              {hasKeys && isMultiKey && keys.length > 1 && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-primary/10 text-primary rounded text-[10px] font-medium">
                  {keys.length} keys
                </span>
              )}
              {hasKeys && !isMultiKey && (
                <span className="text-xs text-foreground-muted font-mono">{primaryKey.api_key}</span>
              )}
            </div>
            <p className="text-xs text-foreground-muted mt-0.5 truncate">{service.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {!hasKeys && (
            <button onClick={() => onOpenAddDialog(service.id)} className="px-3 py-1.5 border border-card-border rounded-lg text-foreground-muted hover:text-foreground hover:border-card-border-hover transition-colors text-xs font-medium">
              Add Key
            </button>
          )}
        </div>
      </div>

      {hasKeys && (
        <div className="mt-2 ml-11 space-y-1.5">
          {keys.map((keyEntry, keyIndex) => {
            const keyId = keyEntry.id ?? service.id
            const isLastKey = keyIndex === keys.length - 1
            const isDeleting = deleteKeyConfirm === keyId
            const isTesting = verifyService.isPending && (
              verifyService.variables?.id === keyId || (!verifyService.variables?.id && verifyService.variables?.name === service.id)
            )

            return (
              <KeyRow
                key={keyId}
                keyId={keyId}
                keyEntry={keyEntry}
                serviceId={service.id}
                isMultiKey={isMultiKey}
                isLastKey={isLastKey}
                isDeleting={isDeleting}
                isTesting={isTesting}
                renamingKeyId={renamingKeyId}
                setRenamingKeyId={setRenamingKeyId}
                renameValue={renameValue}
                setRenameValue={setRenameValue}
                disabledChainsMap={disabledChainsMap}
                setDisabledChainsMap={setDisabledChainsMap}
                onOpenAddDialog={onOpenAddDialog}
                onDeleteKey={onDeleteKey}
                setDeleteKeyConfirm={setDeleteKeyConfirm}
                renameKey={renameKey}
                verifyService={verifyService}
                deleteService={deleteService}
              />
            )
          })}
        </div>
      )}

      {!hasKeys && service.keyUrl && (
        <div className="mt-2 ml-11">
          <a href={service.keyUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">
            Get a free key at {service.domain}
          </a>
        </div>
      )}
    </div>
  )
}

function KeyRow({
  keyId, keyEntry, serviceId, isMultiKey, isLastKey, isDeleting, isTesting,
  renamingKeyId, setRenamingKeyId, renameValue, setRenameValue,
  disabledChainsMap, setDisabledChainsMap,
  onOpenAddDialog, onDeleteKey, setDeleteKeyConfirm,
  renameKey, verifyService, deleteService,
}: {
  keyId: string
  keyEntry: ConfiguredKey
  serviceId: string
  isMultiKey: boolean
  isLastKey: boolean
  isDeleting: boolean
  isTesting: boolean
  renamingKeyId: string | null
  setRenamingKeyId: (v: string | null) => void
  renameValue: string
  setRenameValue: (v: string) => void
  disabledChainsMap: Record<string, string[]>
  setDisabledChainsMap: React.Dispatch<React.SetStateAction<Record<string, string[]>>>
  onOpenAddDialog: (id: string) => void
  onDeleteKey: (nameOrId: string, isKeyId?: boolean) => void
  setDeleteKeyConfirm: (v: string | null) => void
  renameKey: ReturnType<typeof useRenameExternalServiceKey>
  verifyService: ReturnType<typeof useVerifyExternalService>
  deleteService: ReturnType<typeof useDeleteExternalService>
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 px-2.5 rounded-lg bg-background-secondary/50">
      <div className="flex items-center gap-2 min-w-0">
        {renamingKeyId === keyId ? (
          <input
            autoFocus
            type="text"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") { renameKey.mutate({ id: keyId, label: renameValue.trim() }); setRenamingKeyId(null) }
              if (e.key === "Escape") setRenamingKeyId(null)
            }}
            onBlur={() => { renameKey.mutate({ id: keyId, label: renameValue.trim() }); setRenamingKeyId(null) }}
            placeholder="Key name..."
            className="bg-transparent border-b border-card-border focus:border-foreground outline-none py-0 text-xs text-foreground font-mono w-24 transition-colors"
          />
        ) : (
          <span className="text-xs text-foreground-muted font-mono truncate flex items-center gap-1 group/key">
            {keyEntry.label || "Key"}
            <button
              onClick={() => { setRenamingKeyId(keyId); setRenameValue(keyEntry.label || "") }}
              className="opacity-0 group-hover/key:opacity-100 text-foreground-muted hover:text-foreground transition-all"
              title="Rename key"
            >
              <span className="material-symbols-rounded" style={{ fontSize: 11 }}>edit</span>
            </button>
          </span>
        )}
        {keyEntry.api_key && keyEntry.api_key !== "••••" && (
          <span className="text-[10px] text-foreground-muted/60 font-mono">{keyEntry.api_key}</span>
        )}
        {isTesting && (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-warning/10 text-warning rounded text-[10px] font-medium">Testing...</span>
        )}
        {!isTesting && keyEntry.verificationState === "verified" && (
          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${
            disabledChainsMap[keyId]?.length ? "bg-warning/10 text-warning" : "bg-success/10 text-success"
          }`}>
            {serviceId === "alchemy" && disabledChainsMap[keyId]?.length
              ? `Verified — ${disabledChainsMap[keyId].length} chain${disabledChainsMap[keyId].length > 1 ? "s" : ""} disabled`
              : "Verified"}
          </span>
        )}
        {!isTesting && keyEntry.verificationState === "failed" && (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-error/10 text-error rounded text-[10px] font-medium">Failed</span>
        )}
        {!isTesting && keyEntry.verificationState === "unknown" && (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-foreground-muted/10 text-foreground-muted rounded text-[10px] font-medium">Not tested</span>
        )}
        {(keyEntry.consecutive429 ?? 0) > 0 && (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-warning/10 text-warning rounded text-[10px] font-medium">
            {keyEntry.consecutive429} throttled
          </span>
        )}
        {!isTesting && keyEntry.verificationState === "failed" && keyEntry.verifyError && (
          <span className="text-[10px] text-error truncate max-w-[200px]">{keyEntry.verifyError}</span>
        )}
        {!isTesting && serviceId === "alchemy" && disabledChainsMap[keyId]?.length ? (
          <span className="text-[10px] text-warning truncate max-w-[280px]">
            {disabledChainsMap[keyId].join(", ")} —{" "}
            <a href="https://dashboard.alchemy.com/" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">
              enable at dashboard.alchemy.com
            </a>
          </span>
        ) : null}
      </div>

      <div className="flex items-center gap-1 flex-shrink-0">
        {isDeleting ? (
          <div className="flex items-center gap-1">
            <button
              onClick={() => onDeleteKey(keyId, !!keyEntry.id)}
              disabled={deleteService.isPending}
              className="px-2 py-1 text-error border border-error/30 rounded-md hover:bg-error hover:text-white transition-colors disabled:opacity-50 text-[10px] font-medium"
            >
              {deleteService.isPending ? "..." : "Confirm"}
            </button>
            <button onClick={() => setDeleteKeyConfirm(null)} className="px-2 py-1 border border-card-border rounded-md text-foreground-muted hover:text-foreground transition-colors text-[10px]">
              Cancel
            </button>
          </div>
        ) : (
          <>
            {isMultiKey && isLastKey && (
              <>
                <button onClick={() => onOpenAddDialog(serviceId)} className="px-2 py-1 border border-card-border rounded-md text-foreground-muted hover:text-primary hover:border-primary/40 transition-colors text-[10px] font-medium">
                  Add Key
                </button>
                <div className="relative group">
                  <button className="p-1 text-foreground-muted hover:text-foreground transition-colors rounded-md" title="Add multiple free API keys to rotate between them, reducing rate limits and improving sync speed.">
                    <span className="material-symbols-rounded text-sm">info</span>
                  </button>
                  <div className="absolute right-0 top-full mt-1 w-52 px-2.5 py-1.5 bg-card border border-card-border rounded-lg shadow-lg text-[10px] text-foreground-muted opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity z-10">
                    Add multiple free keys to rotate automatically — reduces rate limiting and improves sync speed.
                  </div>
                </div>
              </>
            )}
            <button
              onClick={() => verifyService.mutate({ name: serviceId, id: keyEntry.id }, {
                onSuccess: (data) => {
                  const chains = data?.disabledChains
                  if (chains && chains.length > 0) {
                    setDisabledChainsMap((prev) => ({ ...prev, [keyId]: chains }))
                  } else {
                    setDisabledChainsMap((prev) => {
                      const next = { ...prev }
                      delete next[keyId]
                      return next
                    })
                  }
                },
              })}
              disabled={isTesting}
              className="px-2 py-1 border border-card-border rounded-md text-foreground-muted hover:text-primary hover:border-primary/40 transition-colors text-[10px] font-medium disabled:opacity-50"
            >
              {isTesting ? "..." : keyEntry.verificationState === "verified" ? "Retest" : "Test"}
            </button>
            <button
              onClick={() => setDeleteKeyConfirm(keyId)}
              className="p-1 text-foreground-muted hover:text-error transition-colors rounded-md hover:bg-error/5"
              title="Delete key"
            >
              <span className="material-symbols-rounded text-sm">delete</span>
            </button>
          </>
        )}
      </div>
    </div>
  )
}
