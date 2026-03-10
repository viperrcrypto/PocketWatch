"use client"

import { useState, useMemo, useEffect, useRef } from "react"
import {
  useExternalServices,
  useAddExchangeConnection,
  useRemoveExchangeConnection,
  useVerifyExternalService,
  type ExternalServiceMutationResult,
} from "@/hooks/use-portfolio-tracker"
import { SUPPORTED_EXCHANGES, toExchangeServiceName } from "@/lib/portfolio/exchanges"
import { CollapsibleSection } from "./collapsible-section"
import { deriveVerificationState, getServicesList, showVerificationToast } from "./settings-utils"
import type { ExternalServiceVerificationState } from "@/lib/portfolio/verification"
import { ExchangeRow, AddExchangeDialog } from "./exchange-row"

export function ExchangeConnectionsSection() {
  const { data: servicesData, isLoading: servicesLoading } = useExternalServices()
  const addExchange = useAddExchangeConnection()
  const removeExchange = useRemoveExchangeConnection()
  const verifyService = useVerifyExternalService()

  const [showAddExchangeDialog, setShowAddExchangeDialog] = useState(false)
  const [selectedExchange, setSelectedExchange] = useState("")
  const [exchangeApiKey, setExchangeApiKey] = useState("")
  const [exchangeSecret, setExchangeSecret] = useState("")
  const [exchangePassphrase, setExchangePassphrase] = useState("")
  const [exchangeError, setExchangeError] = useState("")
  const [deleteExchangeConfirm, setDeleteExchangeConfirm] = useState<string | null>(null)

  const services = useMemo(() => getServicesList(servicesData), [servicesData])
  const autoVerifiedServices = useRef(new Set<string>())

  const exchangeStatuses = useMemo(() => {
    const map = new Map<string, {
      verified: boolean
      verificationState: ExternalServiceVerificationState
      error?: string
    }>()
    for (const svc of services) {
      let exId: string | null = null
      if (svc?.isExchange && svc?.exchangeId) {
        exId = svc.exchangeId
      } else if (svc?.name?.startsWith("exchange_")) {
        exId = svc.name.slice(9)
      }
      if (exId) {
        const verifyError = typeof svc.verifyError === "string" ? svc.verifyError : undefined
        map.set(exId, {
          verified: svc.verified === true,
          verificationState: deriveVerificationState(svc.verificationState, svc.verified === true, verifyError),
          error: verifyError,
        })
      }
    }
    return map
  }, [services])

  // Auto-verify unknown exchange services
  useEffect(() => {
    if (services.length === 0) return
    let cancelled = false
    const verifyUnknown = async () => {
      for (const svc of services) {
        if (cancelled) return
        if (!svc?.name?.startsWith("exchange_")) continue
        if (autoVerifiedServices.current.has(svc.name)) continue
        const state = deriveVerificationState(svc.verificationState, svc.verified === true, svc.verifyError ?? null)
        if (state !== "unknown") continue
        autoVerifiedServices.current.add(svc.name)
        try {
          await verifyService.mutateAsync({ name: svc.name })
        } catch (err) {
          console.warn("[portfolio][settings][auto-verify]", {
            serviceName: svc.name,
            error: err instanceof Error ? err.message : "Unknown error",
          })
        }
      }
    }
    void verifyUnknown()
    return () => { cancelled = true }
  }, [services, verifyService.mutateAsync])

  const openAddExchangeDialog = (exchangeId: string) => {
    setSelectedExchange(exchangeId)
    setExchangeApiKey("")
    setExchangeSecret("")
    setExchangePassphrase("")
    setExchangeError("")
    setShowAddExchangeDialog(true)
  }

  const handleAddExchange = () => {
    if (!exchangeApiKey.trim()) { setExchangeError("API Key is required"); return }
    if (!exchangeSecret.trim()) { setExchangeError("API Secret is required"); return }
    const exchangeDef = SUPPORTED_EXCHANGES.find((e) => e.id === selectedExchange)
    if (exchangeDef?.requiresPassphrase && !exchangePassphrase.trim()) {
      setExchangeError(`${exchangeDef.label} requires a passphrase`); return
    }
    setExchangeError("")
    addExchange.mutate(
      {
        name: toExchangeServiceName(selectedExchange),
        api_key: exchangeApiKey.trim(),
        api_secret: exchangeSecret.trim(),
        ...(exchangePassphrase.trim() ? { passphrase: exchangePassphrase.trim() } : {}),
      },
      {
        onSuccess: (data: ExternalServiceMutationResult) => {
          setShowAddExchangeDialog(false)
          setExchangeApiKey("")
          setExchangeSecret("")
          setExchangePassphrase("")
          setSelectedExchange("")
          setExchangeError("")
          showVerificationToast("Exchange credentials saved.", data)
        },
        onError: (err) => setExchangeError(err.message),
      }
    )
  }

  const handleDeleteExchange = (exchangeId: string) => {
    removeExchange.mutate(
      { name: toExchangeServiceName(exchangeId) },
      { onSuccess: () => setDeleteExchangeConfirm(null) }
    )
  }

  const activeExchange = SUPPORTED_EXCHANGES.find((e) => e.id === selectedExchange)

  return (
    <>
      {showAddExchangeDialog && activeExchange && (
        <AddExchangeDialog
          activeExchange={activeExchange}
          exchangeApiKey={exchangeApiKey}
          setExchangeApiKey={setExchangeApiKey}
          exchangeSecret={exchangeSecret}
          setExchangeSecret={setExchangeSecret}
          exchangePassphrase={exchangePassphrase}
          setExchangePassphrase={setExchangePassphrase}
          exchangeError={exchangeError}
          isPending={addExchange.isPending}
          onSubmit={handleAddExchange}
          onClose={() => setShowAddExchangeDialog(false)}
        />
      )}

      <CollapsibleSection
        id="exchanges"
        title="Exchange Connections"
        subtitle="Connect centralized exchanges to track your exchange holdings"
      >
        {servicesLoading ? (
          <ExchangeLoading />
        ) : (
          <div className="divide-y divide-card-border">
            {SUPPORTED_EXCHANGES.map((exchange) => (
              <ExchangeRow
                key={exchange.id}
                exchange={exchange}
                status={exchangeStatuses.get(exchange.id)}
                deleteExchangeConfirm={deleteExchangeConfirm}
                setDeleteExchangeConfirm={setDeleteExchangeConfirm}
                verifyService={verifyService}
                removeExchange={removeExchange}
                onOpenDialog={openAddExchangeDialog}
                onDelete={handleDeleteExchange}
              />
            ))}
          </div>
        )}
      </CollapsibleSection>
    </>
  )
}

function ExchangeLoading() {
  return (
    <div className="p-5 space-y-4">
      {Array.from({ length: 5 }).map((_, i) => (
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
