"use client"

import { useState, useMemo, useRef, useEffect } from "react"
import Link from "next/link"
import {
  useTrackedAccounts, useAddAccount, useRemoveAccount, useRenameAccount,
  useBlockchainBalances, useExternalServices, useRemoveExchangeConnection,
  useExchangeBalances, useUpdateAccountChains,
} from "@/hooks/use-portfolio-tracker"
import { EVM_CHAIN_IDS, getChainMeta } from "@/lib/portfolio/chains"
import { SUPPORTED_EXCHANGES } from "@/lib/portfolio/exchanges"
import { toExchangeServiceName } from "@/lib/portfolio/exchanges"
import type { GroupedAccount } from "@/components/portfolio/accounts/types"
import { AddWalletDialog } from "@/components/portfolio/accounts/add-wallet-dialog"
import { RemoveWalletDialog } from "@/components/portfolio/accounts/remove-wallet-dialog"
import { RemoveExchangeDialog } from "@/components/portfolio/accounts/remove-exchange-dialog"
import { WalletCard } from "@/components/portfolio/accounts/wallet-card"
import { ExchangeCard } from "@/components/portfolio/accounts/exchange-card"
import { AccountsEmptyState } from "@/components/portfolio/accounts/accounts-empty-state"
import { AccountsLoadingSkeleton } from "@/components/portfolio/accounts/accounts-loading-skeleton"
import { SetupRequiredState } from "@/components/portfolio/setup-required-state"

export default function AccountsPage() {
  const { data: accounts, isLoading, isError } = useTrackedAccounts()
  const { data: balancesData } = useBlockchainBalances()
  const { data: servicesData } = useExternalServices()
  const { data: exchangeBalancesData } = useExchangeBalances()
  const addAccount = useAddAccount()
  const removeAccount = useRemoveAccount()
  const renameAccount = useRenameAccount()
  const removeExchange = useRemoveExchangeConnection()
  const updateChains = useUpdateAccountChains()

  const [showAddDialog, setShowAddDialog] = useState(false)
  const [newAddress, setNewAddress] = useState("")
  const [newLabel, setNewLabel] = useState("")
  const [selectedChains, setSelectedChains] = useState<Set<string>>(new Set(EVM_CHAIN_IDS))
  const [addError, setAddError] = useState("")
  const [syncingAddresses, setSyncingAddresses] = useState<Set<string>>(new Set())
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null)
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null)
  const [editingAddress, setEditingAddress] = useState<string | null>(null)
  const [editLabel, setEditLabel] = useState("")
  const [confirmRemoveExchange, setConfirmRemoveExchange] = useState<string | null>(null)
  const [editingChainsAddress, setEditingChainsAddress] = useState<string | null>(null)
  const [editChains, setEditChains] = useState<Set<string>>(new Set())

  // Group accounts by unique address (instead of by chain)
  const grouped: GroupedAccount[] = useMemo(() => {
    if (!accounts || typeof accounts !== "object") return []
    const addressMap = new Map<string, GroupedAccount>()
    for (const [chain, chainAccounts] of Object.entries(accounts as Record<string, unknown>)) {
      if (!Array.isArray(chainAccounts)) continue
      for (const account of chainAccounts) {
        const addr = (account?.address as string)?.toLowerCase()
        if (!addr) continue
        const existing = addressMap.get(addr)
        if (existing) {
          if (!existing.chains.includes(chain)) {
            existing.chains.push(chain)
          }
        } else {
          addressMap.set(addr, { address: account.address, label: account.label || "", chains: [chain] })
        }
      }
    }
    return Array.from(addressMap.values())
  }, [accounts])

  // Track connected exchanges
  const connectedExchanges = useMemo(() => {
    const list: { id: string; label: string; domain: string }[] = []
    const services = servicesData?.services || servicesData?.result?.services
    if (Array.isArray(services)) {
      for (const svc of services) {
        const exchangeId = svc?.exchangeId || (svc?.name?.startsWith("exchange_") ? svc.name.slice(9) : null)
        if (exchangeId) {
          const def = SUPPORTED_EXCHANGES.find((e) => e.id === exchangeId)
          if (def) list.push({ id: def.id, label: def.label, domain: def.domain })
        }
      }
    }
    return list
  }, [servicesData])

  // Exchange balances per exchange
  const exchangeTotals = useMemo(() => {
    const map = new Map<string, { totalValue: number; assetCount: number }>()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- raw API shape
    const exchanges = (exchangeBalancesData as any)?.exchanges
    if (Array.isArray(exchanges)) {
      for (const ex of exchanges) {
        map.set(ex.id, { totalValue: ex.totalValue || 0, assetCount: ex.assetCount || 0 })
      }
    }
    return map
  }, [exchangeBalancesData])

  // Compute total USD balance per wallet address across all chains
  const walletBalances = useMemo(() => {
    const totals = new Map<string, number>()
    if (!balancesData || typeof balancesData !== "object") return totals
    const perAccount = (balancesData as Record<string, unknown>).per_account || balancesData
    if (perAccount && typeof perAccount === "object") {
      for (const [chain, chainData] of Object.entries(perAccount as Record<string, unknown>)) {
        if (chain === "totals" || !chainData || typeof chainData !== "object") continue
        for (const [walletAddress, accountData] of Object.entries(chainData as Record<string, unknown>)) {
          const acct = accountData as Record<string, unknown>
          const walletLower = walletAddress.toLowerCase()
          if (acct?.assets && typeof acct.assets === "object") {
            for (const [, balanceWrapper] of Object.entries(acct.assets as Record<string, unknown>)) {
              const bw = balanceWrapper as Record<string, unknown>
              const balance = (bw?.address || bw) as Record<string, string>
              const usdValue = parseFloat(balance?.value || balance?.usd_value || "0")
              if (usdValue > 0) {
                totals.set(walletLower, (totals.get(walletLower) || 0) + usdValue)
              }
            }
          }
        }
      }
    }
    return totals
  }, [balancesData])

  const walletBalancesRef = useRef(walletBalances)
  useEffect(() => { walletBalancesRef.current = walletBalances }, [walletBalances])

  const toggleChain = (chainId: string) => {
    setSelectedChains((prev) => {
      const next = new Set(prev)
      if (next.has(chainId)) next.delete(chainId)
      else next.add(chainId)
      return next
    })
  }

  const handleAddressChange = (val: string) => {
    setNewAddress(val)
    const trimmed = val.trim()
    if (trimmed.startsWith("0x") && trimmed.length >= 4) {
      setSelectedChains(new Set(EVM_CHAIN_IDS))
    } else if (/^(1|3|bc1)/i.test(trimmed)) {
      setSelectedChains(new Set(["BTC"]))
    } else if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(trimmed)) {
      setSelectedChains(new Set(["SOL"]))
    } else if (trimmed.length === 0) {
      setSelectedChains(new Set(EVM_CHAIN_IDS))
    }
  }

  const handleAdd = () => {
    if (!newAddress.trim()) { setAddError("Address is required"); return }
    if (selectedChains.size === 0) { setAddError("Select at least one chain"); return }
    setAddError("")
    const trimmedAddress = newAddress.trim()
    addAccount.mutate(
      { chains: Array.from(selectedChains), address: trimmedAddress, label: newLabel.trim() || undefined },
      {
        onSuccess: () => {
          setSyncingAddresses((prev) => new Set([...prev, trimmedAddress.toLowerCase()]))
          const checkInterval = setInterval(() => {
            const currentBalance = walletBalancesRef.current.get(trimmedAddress.toLowerCase())
            if (currentBalance != null && currentBalance > 0) {
              setSyncingAddresses((prev) => { const next = new Set(prev); next.delete(trimmedAddress.toLowerCase()); return next })
              clearInterval(checkInterval)
            }
          }, 3000)
          setTimeout(() => {
            setSyncingAddresses((prev) => { const next = new Set(prev); next.delete(trimmedAddress.toLowerCase()); return next })
            clearInterval(checkInterval)
          }, 120_000)
          setShowAddDialog(false)
          setNewAddress("")
          setNewLabel("")
          setSelectedChains(new Set(EVM_CHAIN_IDS))
        },
        onError: (err) => setAddError(err.message),
      }
    )
  }

  const handleCopy = async (address: string) => {
    try {
      await navigator.clipboard.writeText(address)
      setCopiedAddress(address)
      setTimeout(() => setCopiedAddress(null), 2000)
    } catch { /* Clipboard API may not be available */ }
  }

  const handleRemove = (account: GroupedAccount) => {
    removeAccount.mutate(
      { address: account.address, chains: account.chains },
      { onSuccess: () => setConfirmRemove(null), onError: () => setConfirmRemove(null) }
    )
  }

  const handleRemoveExchange = (exchangeId: string) => {
    removeExchange.mutate(
      { name: toExchangeServiceName(exchangeId) },
      { onSuccess: () => setConfirmRemoveExchange(null), onError: () => setConfirmRemoveExchange(null) }
    )
  }

  const handleStartEdit = (account: GroupedAccount) => {
    setEditingAddress(account.address)
    setEditLabel(account.label || "")
  }

  const handleSaveLabel = (address: string) => {
    renameAccount.mutate({ address, label: editLabel.trim() }, { onSettled: () => setEditingAddress(null) })
  }

  const handleStartEditChains = (account: GroupedAccount) => {
    const registryIds = account.chains.map((c) => getChainMeta(c)?.id).filter((id): id is string => !!id)
    setEditChains(new Set(registryIds))
    setEditingChainsAddress(account.address)
  }

  const handleSaveChains = (address: string) => {
    if (editChains.size === 0) return
    updateChains.mutate({ address, chains: Array.from(editChains) }, { onSettled: () => setEditingChainsAddress(null) })
  }

  const toggleEditChain = (chainId: string) => {
    setEditChains((prev) => {
      const next = new Set(prev)
      if (next.has(chainId)) next.delete(chainId)
      else next.add(chainId)
      return next
    })
  }

  const isEmpty = !isLoading && grouped.length === 0 && connectedExchanges.length === 0
  const noApiKey = (balancesData as Record<string, unknown>)?.error === "no_api_key"
  const sortedWallets = [...grouped].sort(
    (a, b) => (walletBalances.get(b.address.toLowerCase()) || 0) - (walletBalances.get(a.address.toLowerCase()) || 0)
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl text-foreground font-semibold">Wallets</h1>
          <p className="text-foreground-muted mt-1 text-xs">Manage tracked wallets and exchange connections</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/portfolio/settings#exchanges"
            className="flex items-center gap-2 px-4 py-2 border border-card-border text-foreground-muted hover:text-foreground hover:border-card-border-hover transition-colors text-sm font-medium rounded-lg"
          >
            <span className="material-symbols-rounded text-sm">swap_horiz</span>
            Add Exchange
          </Link>
          <button
            onClick={() => setShowAddDialog(true)}
            className="flex items-center gap-2 px-4 py-2 btn-primary transition-colors text-sm font-semibold"
          >
            <span className="material-symbols-rounded text-sm">add</span>
            Add Wallet
          </button>
        </div>
      </div>

      {/* Dialogs */}
      {showAddDialog && (
        <AddWalletDialog
          newAddress={newAddress}
          newLabel={newLabel}
          selectedChains={selectedChains}
          addError={addError}
          isPending={addAccount.isPending}
          onAddressChange={handleAddressChange}
          onLabelChange={setNewLabel}
          onToggleChain={toggleChain}
          onSetSelectedChains={setSelectedChains}
          onAdd={handleAdd}
          onClose={() => { setShowAddDialog(false); setAddError(""); setNewLabel("") }}
        />
      )}
      {confirmRemove && (
        <RemoveWalletDialog
          address={confirmRemove}
          grouped={grouped}
          isPending={removeAccount.isPending}
          onRemove={handleRemove}
          onClose={() => setConfirmRemove(null)}
        />
      )}
      {confirmRemoveExchange && (
        <RemoveExchangeDialog
          exchangeId={confirmRemoveExchange}
          exchangeLabel={connectedExchanges.find((e) => e.id === confirmRemoveExchange)?.label || confirmRemoveExchange}
          isPending={removeExchange.isPending}
          onRemove={handleRemoveExchange}
          onClose={() => setConfirmRemoveExchange(null)}
        />
      )}

      {/* API Key Banner */}
      {noApiKey && grouped.length > 0 && (
        <div className="bg-card border border-warning/40 p-4 flex items-center justify-between gap-4 rounded-xl">
          <div className="flex items-center gap-3">
            <span className="material-symbols-rounded text-warning">key</span>
            <span className="text-foreground-muted text-xs">Zerion API key not configured — wallet balances cannot be fetched.</span>
          </div>
          <Link href="/portfolio/settings" className="flex-shrink-0 px-3 py-1.5 border border-warning/60 text-warning hover:bg-warning/10 transition-colors text-xs">
            Configure
          </Link>
        </div>
      )}

      {/* Error State */}
      {isError && (
        <SetupRequiredState service="zerion" feature="tracked wallets and accounts" />
      )}

      {/* Content */}
      {isLoading ? (
        <AccountsLoadingSkeleton />
      ) : isEmpty ? (
        <AccountsEmptyState onAddWallet={() => setShowAddDialog(true)} />
      ) : (
        <div className="space-y-4">
          {sortedWallets.map((account) => (
            <WalletCard
              key={account.address}
              account={account}
              walletBalance={walletBalances.get(account.address.toLowerCase())}
              isSyncing={syncingAddresses.has(account.address.toLowerCase())}
              noApiKey={noApiKey}
              copiedAddress={copiedAddress}
              editingAddress={editingAddress}
              editLabel={editLabel}
              editingChainsAddress={editingChainsAddress}
              editChains={editChains}
              updateChainsPending={updateChains.isPending}
              onCopy={handleCopy}
              onConfirmRemove={setConfirmRemove}
              onStartEdit={handleStartEdit}
              onEditLabelChange={setEditLabel}
              onSaveLabel={handleSaveLabel}
              onCancelEdit={() => { setEditingAddress(null); setEditLabel("") }}
              onStartEditChains={handleStartEditChains}
              onToggleEditChain={toggleEditChain}
              onSaveChains={handleSaveChains}
              onCancelEditChains={() => { setEditingChainsAddress(null); setEditChains(new Set()) }}
            />
          ))}
          {connectedExchanges.map((exchange) => (
            <ExchangeCard
              key={`exchange-${exchange.id}`}
              exchange={exchange}
              totals={exchangeTotals.get(exchange.id)}
              onConfirmRemove={setConfirmRemoveExchange}
            />
          ))}
        </div>
      )}

      {/* Summary footer */}
      {!isLoading && (grouped.length > 0 || connectedExchanges.length > 0) && (
        <div className="pt-2">
          <p className="text-foreground-muted text-xs">
            {grouped.length} wallet{grouped.length !== 1 ? "s" : ""}
            {connectedExchanges.length > 0 && ` + ${connectedExchanges.length} exchange${connectedExchanges.length !== 1 ? "s" : ""}`}
            {" "}tracked
          </p>
        </div>
      )}
    </div>
  )
}
