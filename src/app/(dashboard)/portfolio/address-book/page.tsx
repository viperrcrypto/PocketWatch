"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { toast } from "sonner"
import { useAddressBook, useAddAddressBookEntry, useDeleteAddressBookEntry } from "@/hooks/use-portfolio-tracker"
import { shortenAddress } from "@/lib/portfolio/utils"
import { PortfolioPageHeader } from "@/components/portfolio/portfolio-page-header"
import { PortfolioDataTable, type Column } from "@/components/portfolio/portfolio-data-table"
import { PortfolioEmpty } from "@/components/portfolio/portfolio-empty"
import { ChainBadge } from "@/components/portfolio/chain-badge"
import { CHAIN_OPTIONS } from "@/lib/portfolio/chains"

interface AddressBookEntry {
  address: string
  name: string
  blockchain: string
}

export default function AddressBookPage() {
  const { data: addressBook, isLoading, isError } = useAddressBook()
  const addEntry = useAddAddressBookEntry()
  const deleteEntry = useDeleteAddressBookEntry()
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [newLabel, setNewLabel] = useState("")
  const [newAddress, setNewAddress] = useState("")
  const [selectedChain, setSelectedChain] = useState("ETH")
  const [addError, setAddError] = useState("")
  const [editingAddress, setEditingAddress] = useState<string | null>(null)
  const [editValue, setEditValue] = useState("")
  const editInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editingAddress && editInputRef.current) editInputRef.current.focus()
  }, [editingAddress])

  // Normalize address book data into a flat array
  const entries: AddressBookEntry[] = (() => {
    if (!addressBook) return []
    if (Array.isArray(addressBook)) return addressBook
    if (addressBook && typeof addressBook === "object") {
      // API returns { addresses: [...] }
      const arr = (addressBook as any).addresses ?? (addressBook as any).result ?? (addressBook as any).entries
      if (Array.isArray(arr)) {
        return arr.map((item: any) => ({
          address: item.address || "",
          name: item.name || item.label || "",
          blockchain: item.blockchain || "ETH",
        }))
      }
    }
    return []
  })()

  const handleAdd = () => {
    if (!newLabel.trim()) {
      setAddError("Label is required")
      return
    }
    if (!newAddress.trim()) {
      setAddError("Address is required")
      return
    }
    const addr = newAddress.trim()
    const isValidAddress = /^0x[a-fA-F0-9]{20,}$/.test(addr) || /^[1-9A-HJ-NP-Za-km-z]{32,}$/.test(addr)
    if (!isValidAddress) {
      setAddError("Enter a valid wallet address (0x... for EVM, or base58 for Solana)")
      return
    }
    setAddError("")
    addEntry.mutate(
      { address: newAddress.trim(), name: newLabel.trim(), blockchain: selectedChain },
      {
        onSuccess: () => {
          setShowAddDialog(false)
          setNewLabel("")
          setNewAddress("")
          setSelectedChain("ETH")
        },
        onError: (err) => setAddError(err.message),
      }
    )
  }

  const handleDelete = (entry: AddressBookEntry) => {
    deleteEntry.mutate({ address: entry.address, blockchain: entry.blockchain })
  }

  const handleEditSave = (entry: AddressBookEntry) => {
    const trimmed = editValue.trim()
    if (!trimmed || trimmed === entry.name) {
      setEditingAddress(null)
      return
    }
    addEntry.mutate(
      { address: entry.address, name: trimmed, blockchain: entry.blockchain },
      { onSuccess: () => setEditingAddress(null) }
    )
  }

  const [copiedAddress, setCopiedAddress] = useState<string | null>(null)

  const handleCopy = useCallback((address: string) => {
    navigator.clipboard.writeText(address).then(() => {
      setCopiedAddress(address)
      toast.success("Address copied")
      setTimeout(() => setCopiedAddress(null), 2000)
    })
  }, [])

  const isRealAddress = (addr: string) =>
    /^0x[a-fA-F0-9]{20,}$/.test(addr) || /^[1-9A-HJ-NP-Za-km-z]{32,}$/.test(addr)

  const columns: Column<AddressBookEntry>[] = [
    {
      key: "name",
      header: "Label",
      width: "30%",
      accessor: (row) => {
        if (editingAddress === row.address) {
          return (
            <form
              onSubmit={(e) => { e.preventDefault(); handleEditSave(row) }}
              className="flex items-center gap-2"
            >
              <input
                ref={editInputRef}
                type="text"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={() => handleEditSave(row)}
                onKeyDown={(e) => { if (e.key === "Escape") setEditingAddress(null) }}
                className="bg-transparent border-b border-primary outline-none py-0.5 text-foreground font-data text-sm font-medium w-40"
              />
            </form>
          )
        }
        return (
          <span className="text-foreground font-data text-sm font-medium">
            {row.name}
          </span>
        )
      },
    },
    {
      key: "address",
      header: "Address",
      width: "40%",
      accessor: (row) => {
        if (!isRealAddress(row.address)) {
          return (
            <span className="text-foreground-muted/50 font-data text-xs italic">
              {row.address === row.name ? "No on-chain address" : row.address}
            </span>
          )
        }
        return (
          <span className="text-foreground-muted font-data text-sm" style={{ fontVariantNumeric: "tabular-nums" }}>
            {shortenAddress(row.address)}
          </span>
        )
      },
    },
    {
      key: "blockchain",
      header: "Chain",
      width: "15%",
      accessor: (row) => <ChainBadge chainId={row.blockchain} size="sm" />,
    },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      width: "15%",
      accessor: (row) => (
        <div className="flex items-center justify-end gap-1">
          {isRealAddress(row.address) && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                handleCopy(row.address)
              }}
              className="p-1 text-foreground-muted hover:text-foreground transition-colors"
              title="Copy address"
            >
              <span className="material-symbols-rounded text-base">
                {copiedAddress === row.address ? "check" : "content_copy"}
              </span>
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation()
              setEditingAddress(row.address)
              setEditValue(row.name)
            }}
            className="p-1 text-foreground-muted hover:text-foreground transition-colors"
            title="Rename label"
          >
            <span className="material-symbols-rounded text-base">edit</span>
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              handleDelete(row)
            }}
            disabled={deleteEntry.isPending}
            className="p-1 text-foreground-muted hover:text-error transition-colors disabled:opacity-50"
            title="Delete"
          >
            <span className="material-symbols-rounded text-base">delete</span>
          </button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PortfolioPageHeader
        title="Address Book"
        subtitle="Label addresses for easier identification"
        actions={
          <button
            onClick={() => setShowAddDialog(true)}
            className="flex items-center gap-2 px-4 py-2 btn-primary transition-colors text-sm font-semibold"
          >
            <span className="material-symbols-rounded text-sm">add</span>
            Add Address
          </button>
        }
      />

      {/* Add Address Dialog */}
      {showAddDialog && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-card-border w-full max-w-lg rounded-xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-card-border">
              <h2 className="text-foreground text-base font-semibold">
                Add Address
              </h2>
              <button
                onClick={() => { setShowAddDialog(false); setAddError("") }}
                className="text-foreground-muted hover:text-foreground transition-colors"
              >
                <span className="material-symbols-rounded">close</span>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block mb-2 text-foreground-muted text-xs font-semibold">
                  Label
                </label>
                <input
                  type="text"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  placeholder="e.g. My Ledger, Team Treasury"
                  className="w-full bg-transparent border-b border-card-border focus:border-foreground outline-none py-2 text-foreground placeholder-foreground-muted transition-colors font-data text-sm"
                />
              </div>

              <div>
                <label className="block mb-2 text-foreground-muted text-xs font-semibold">
                  Address
                </label>
                <input
                  type="text"
                  value={newAddress}
                  onChange={(e) => setNewAddress(e.target.value)}
                  placeholder="0x..."
                  className="w-full bg-transparent border-b border-card-border focus:border-foreground outline-none py-2 text-foreground placeholder-foreground-muted transition-colors font-data text-sm"
                />
              </div>

              <div>
                <label className="block mb-2 text-foreground-muted text-xs font-semibold">
                  Chain
                </label>
                <select
                  value={selectedChain}
                  onChange={(e) => setSelectedChain(e.target.value)}
                  className="w-full bg-transparent border-b border-card-border focus:border-foreground outline-none py-2 text-foreground transition-colors appearance-none cursor-pointer font-data text-sm rounded-none"
                >
                  {CHAIN_OPTIONS.map((chain) => (
                    <option key={chain.id} value={chain.id} className="bg-card text-foreground">
                      {chain.label}
                    </option>
                  ))}
                </select>
              </div>

              {addError && (
                <p className="text-error text-xs font-data">{addError}</p>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => { setShowAddDialog(false); setAddError("") }}
                  className="px-4 py-2 border border-card-border text-foreground-muted hover:text-foreground hover:border-card-border-hover transition-colors text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAdd}
                  disabled={addEntry.isPending}
                  className="px-4 py-2 btn-primary transition-colors disabled:opacity-50 text-sm font-semibold"
                >
                  {addEntry.isPending ? "Adding..." : "Add Address"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isError ? (
        <div className="bg-card border border-card-border p-6 rounded-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-error">
              <span className="material-symbols-rounded">error</span>
              <span className="text-sm">
                Failed to load address book. The backend may still be syncing.
              </span>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 border border-card-border text-foreground-muted hover:text-foreground hover:border-card-border-hover transition-colors flex-shrink-0 text-sm"
            >
              Retry
            </button>
          </div>
        </div>
      ) : isLoading ? (
        <PortfolioDataTable
          columns={columns}
          data={[]}
          isLoading={true}
        />
      ) : entries.length === 0 ? (
        <PortfolioEmpty
          icon="contacts"
          title="No Addresses"
          description="Label addresses to easily identify wallets and contracts across your portfolio."
          action={{ label: "Add Your First Address", onClick: () => setShowAddDialog(true) }}
        />
      ) : (
        <PortfolioDataTable
          columns={columns}
          data={entries}
        />
      )}
    </div>
  )
}
